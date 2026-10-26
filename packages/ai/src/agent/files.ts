// Where the self-state's files are (state.ts): a directory on disk under Node (node.ts), or files kept in
// memory (`MemFiles`) where there is no disk — a browser's worker running the player's own modder (docs/byok.md),
// which saves them where it likes (`entries`, `onChange`). The paths are the caller's: `join` makes them.

export interface Files {
  join(...parts: string[]): string
  exists(path: string): boolean
  /** A file's text (throws when there is none). */
  read(path: string): string
  /** Write a file (its directory made first: `mkdir`). */
  write(path: string, text: string): void
  append(path: string, text: string): void
  /** A directory and its parents. */
  mkdir(path: string): void
  /** The names in a directory. */
  list(path: string): string[]
  /** A file, or a directory with everything in it. */
  copy(from: string, to: string): void
  rename(from: string, to: string): void
  /** A file, or a directory with everything in it (nothing when there is none). */
  remove(path: string): void
  /** A new empty directory of its own. */
  tempDir(prefix: string): string
}

let fallback: (() => Files) | undefined

/** The files a caller gets when it names none: Node's disk once node.ts is loaded (the package's Node entry loads it). */
export function defaultFiles(): Files {
  if (!fallback) throw new Error('no files here: pass a Files (MemFiles in a browser), or load @openworld/ai for the disk')
  return fallback()
}

export function useDefaultFiles(make: () => Files): void {
  fallback = make
}

/** Files in memory: every path with `/`, a file's directories made with it (and kept, as a disk keeps them). */
export class MemFiles implements Files {
  private files = new Map<string, string>()
  private dirs = new Set<string>()
  private temp = 0
  /** Called after every change (a store keeps them, debounced as it likes). */
  onChange?: () => void

  constructor(entries: Record<string, string> = {}) {
    for (const [p, t] of Object.entries(entries)) this.put(norm(p), t)
  }

  private put(p: string, text: string): void {
    this.files.set(p, text)
    this.parents(p)
  }

  private parents(p: string): void {
    for (let i = p.lastIndexOf('/'); i > 0; i = p.lastIndexOf('/', i - 1)) this.dirs.add(p.slice(0, i))
  }

  /** Every file, to keep and to give back to the constructor. */
  entries(): Record<string, string> {
    return Object.fromEntries(this.files)
  }

  join(...parts: string[]): string {
    return norm(parts.filter(Boolean).join('/'))
  }

  exists(path: string): boolean {
    const p = norm(path)
    return this.files.has(p) || this.dirs.has(p)
  }

  read(path: string): string {
    const t = this.files.get(norm(path))
    if (t === undefined) throw new Error(`no such file: ${path}`)
    return t
  }

  write(path: string, text: string): void {
    this.put(norm(path), text)
    this.onChange?.()
  }

  append(path: string, text: string): void {
    const p = norm(path)
    this.put(p, (this.files.get(p) ?? '') + text)
    this.onChange?.()
  }

  mkdir(path: string): void {
    const p = norm(path)
    this.dirs.add(p)
    this.parents(p)
  }

  list(path: string): string[] {
    const under = `${norm(path)}/`
    const names = new Set<string>()
    for (const p of [...this.files.keys(), ...this.dirs]) if (p.startsWith(under)) names.add(p.slice(under.length).split('/')[0])
    return [...names].sort()
  }

  copy(from: string, to: string): void {
    const a = norm(from)
    const b = norm(to)
    const file = this.files.get(a)
    if (file !== undefined) this.put(b, file)
    for (const [p, t] of [...this.files]) if (p.startsWith(`${a}/`)) this.put(b + p.slice(a.length), t)
    for (const d of [...this.dirs]) if (d === a || d.startsWith(`${a}/`)) this.dirs.add(b + d.slice(a.length))
    this.onChange?.()
  }

  rename(from: string, to: string): void {
    const a = norm(from)
    const t = this.files.get(a)
    if (t === undefined) throw new Error(`no such file: ${from}`)
    this.files.delete(a)
    this.put(norm(to), t)
    this.onChange?.()
  }

  remove(path: string): void {
    const p = norm(path)
    for (const f of [...this.files.keys()]) if (f === p || f.startsWith(`${p}/`)) this.files.delete(f)
    for (const d of [...this.dirs]) if (d === p || d.startsWith(`${p}/`)) this.dirs.delete(d)
    this.onChange?.()
  }

  tempDir(prefix: string): string {
    const d = `/tmp/${prefix}${++this.temp}`
    this.dirs.add(d)
    return d
  }
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}
