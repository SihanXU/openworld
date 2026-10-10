// Where the editor's projects are (docs/engine-split.md §15, the standalone editor): any folder on the disk that
// holds a game.json. The editor keeps the ones it has opened (its recent list, in its own folder: the user's
// ~/.openworld-editor unless told otherwise) and lists the projects of its shelves beside them (folders whose
// sub-folders are games: the repository's games/ in development). Each project is addressed by a key, a short
// name made from its folder's, which the editor's URLs and the player's /games/<key>/ use. A new project is a
// template's copy in a folder of the author's choosing. Nothing here ever deletes a project's files: forgetting
// one takes it off the list.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { formatJson, type GameJson } from '@openworld/format'
import { gameFolder, isProject, projectDir, projectFolder, type GameFolder } from '@openworld/format/src/serve.ts'
import type { RawChunk, Text } from '@openworld/engine'

export interface Template {
  name: Text
  /** What a new project from it holds. */
  doc: Text
  /** Its project (a folder with a game.json). */
  dir: string
  /** Made from the folder, then changed (the empty project: the starter's kinds of things, one blank map). */
  shape?: (dir: string) => void
}

export interface WorkspaceOptions {
  /** The editor's own folder: what it keeps between runs (the recent projects). */
  home?: string
  /** Folders whose sub-folders are projects, always listed (the repository's games/ in development). */
  shelves?: string[]
  /** The templates a new project is made from, by id. */
  templates: Record<string, Template>
  /** Where a new project goes unless the author says (default ~/OpenWorld Projects). */
  projects?: string
}

export interface ProjectInfo {
  /** The editor's name for it (its URLs, the player's /games/<key>/). */
  key: string
  /** The game's own id and name (its game.json). */
  id: string
  name: Text
  modules: string[]
  maps: number
  people: number
  /** Its folder. */
  dir: string
  /** The shelf it is on (none: opened from its folder). */
  shelf?: string
  /** When it was last opened (ms), for the recent ones. */
  opened?: number
  /** Its folder is gone or no longer a project (it stays listed until forgotten). */
  missing?: boolean
}

interface Recent {
  key: string
  dir: string
  opened: number
}

export class WorkspaceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** A key from a folder's name: lower case letters, digits and -, as the player's URLs take it. */
export function keyOf(name: string): string {
  const k = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return k || 'project'
}

/** A game's id from a name the author typed. */
export const ID = /^[a-z][a-z0-9-]{0,40}$/

/** The things of a folder of the format counted (its JSON files). */
const count = (dir: string, d: string) => (existsSync(join(dir, d)) ? readdirSync(join(dir, d)).filter((f) => f.endsWith('.json')).length : 0)

export class Workspace {
  readonly home: string
  readonly shelves: string[]
  readonly projectsDir: string

  constructor(readonly opts: WorkspaceOptions) {
    this.home = resolve(opts.home ?? process.env.OPENWORLD_EDITOR_HOME ?? join(homedir(), '.openworld-editor'))
    this.shelves = (opts.shelves ?? []).map((s) => resolve(s))
    this.projectsDir = resolve(opts.projects ?? join(homedir(), 'OpenWorld Projects'))
  }

  // ------------------------------------------------------------------ the recent list

  private recentFile(): string {
    return join(this.home, 'recent.json')
  }
  private recent(): Recent[] {
    try {
      return (JSON.parse(readFileSync(this.recentFile(), 'utf8')) as { projects: Recent[] }).projects ?? []
    } catch {
      return []
    }
  }
  private keep(list: Recent[]): void {
    mkdirSync(this.home, { recursive: true })
    writeFileSync(this.recentFile(), formatJson({ projects: list }))
  }

  /** The shelves' projects: each a sub-folder that is one (or holds one baked in its project/). */
  private shelved(): { key: string; dir: string; root: string; shelf: string }[] {
    return this.shelves.flatMap((shelf) =>
      existsSync(shelf)
        ? readdirSync(shelf)
            .filter((id) => /^[a-z0-9][a-z0-9-]*$/.test(id) && projectDir(shelf, id))
            .map((id) => ({ key: id, dir: projectDir(shelf, id)!, root: join(shelf, id), shelf }))
        : [],
    )
  }

  private info(key: string, dir: string, extra: Partial<ProjectInfo>): ProjectInfo {
    if (!isProject(dir)) return { key, id: key, name: basename(dir), modules: [], maps: 0, people: 0, dir, missing: true, ...extra }
    let g: Partial<GameJson> = {}
    try {
      g = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')) as GameJson
    } catch {
      return { key, id: key, name: basename(dir), modules: [], maps: 0, people: 0, dir, missing: true, ...extra }
    }
    return { key, id: g.id ?? key, name: g.name ?? key, modules: g.modules ?? [], maps: count(dir, 'maps'), people: count(dir, 'people'), dir, ...extra }
  }

  /** Every project the editor knows: the recent ones (newest first), then the shelves'. */
  list(): ProjectInfo[] {
    const shelved = this.shelved()
    const onShelf = new Set(shelved.map((s) => s.dir))
    const recent = this.recent()
      .filter((r) => !onShelf.has(r.dir))
      .sort((a, b) => b.opened - a.opened)
      .map((r) => this.info(r.key, r.dir, { opened: r.opened }))
    const opened = new Map(this.recent().map((r) => [r.dir, r.opened]))
    return [...recent, ...shelved.map((s) => this.info(s.key, s.dir, { shelf: s.shelf, ...(opened.has(s.dir) && { opened: opened.get(s.dir) }) }))]
  }

  /** A project's folder by its key. */
  dir(key: string): string {
    return this.folder(key).project!
  }

  /** A project as served (its project, its assets). */
  folder(key: string): GameFolder {
    const s = this.shelved().find((x) => x.key === key)
    if (s) return gameFolder(dirname(s.root), basename(s.root))!
    const r = this.recent().find((x) => x.key === key)
    if (r && isProject(r.dir)) return projectFolder(r.dir)
    throw new WorkspaceError(404, `no project ${key}`)
  }

  /** A folder opened as a project: put on the recent list (or moved to its top), and its key. */
  open(path: string): ProjectInfo {
    const dir = resolve(path)
    if (!isProject(dir)) {
      if (isProject(join(dir, 'project'))) return this.open(join(dir, 'project'))
      throw new WorkspaceError(400, `${dir} is not a project (it has no game.json)`)
    }
    const s = this.shelved().find((x) => x.dir === dir)
    const list = this.recent()
    const had = list.find((r) => r.dir === dir)
    const taken = new Set([...this.shelved().map((x) => x.key), ...list.filter((r) => r.dir !== dir).map((r) => r.key)])
    let key = s?.key ?? had?.key ?? keyOf(basename(dir) === 'project' ? basename(dirname(dir)) : basename(dir))
    if (!s && !had) for (let i = 2; taken.has(key); i++) key = `${keyOf(basename(dir)).slice(0, 36)}-${i}`
    const next = [{ key, dir, opened: Date.now() }, ...list.filter((r) => r.dir !== dir)].slice(0, 30)
    this.keep(next)
    return this.info(key, dir, { opened: next[0].opened, ...(s && { shelf: s.shelf }) })
  }

  /** Take a project off the recent list (its files stay where they are). */
  forget(key: string): void {
    this.keep(this.recent().filter((r) => r.key !== key))
  }

  /**
   * A new project: a template's files (its data and its assets, never its tests or builds) in `folder`/`name`
   * (default: the editor's projects folder, the game's id), with its own id and name; opened at once.
   */
  create(o: { template?: string; id: string; name: Text; folder?: string; dirName?: string }): ProjectInfo {
    if (!ID.test(o.id)) throw new WorkspaceError(400, `"${o.id}" is not a game id (lower case letters, digits and -, a letter first)`)
    const template = this.opts.templates[o.template ?? Object.keys(this.opts.templates)[0]]
    if (!template) throw new WorkspaceError(400, `no template ${o.template}`)
    const parent = resolve(o.folder ?? this.projectsDir)
    const to = join(parent, o.dirName?.trim() || o.id)
    if (existsSync(to) && (!statSync(to).isDirectory() || readdirSync(to).length)) throw new WorkspaceError(409, `${to} exists and is not empty`)
    mkdirSync(to, { recursive: true })
    const from = template.dir
    cpSync(from, to, {
      recursive: true,
      filter: (src) => {
        const top = relative(from, src).split(sep)[0]
        return !['test', 'dist', 'node_modules', 'tsconfig.json', 'package.json'].includes(top)
      },
    })
    template.shape?.(to)
    const g = JSON.parse(readFileSync(join(to, 'game.json'), 'utf8')) as GameJson
    writeFileSync(join(to, 'game.json'), formatJson({ ...g, id: o.id, name: o.name, version: '1', doc: undefined }))
    return this.open(to)
  }

  /** The folders under a folder (for choosing where a project is, where the desktop has no dialog of its own). */
  browse(path?: string): { path: string; parent?: string; dirs: { name: string; project: boolean }[]; home: string; projects: string } {
    const at = resolve(path || this.projectsDir)
    const where = existsSync(at) && statSync(at).isDirectory() ? at : homedir()
    let dirs: { name: string; project: boolean }[] = []
    try {
      dirs = readdirSync(where, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
        .map((d) => ({ name: d.name, project: isProject(join(where, d.name)) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      // a folder one may not read lists nothing
    }
    const parent = dirname(where)
    return { path: where, ...(parent !== where && { parent }), dirs, home: homedir(), projects: this.projectsDir }
  }
}

/**
 * The empty project: the template's kinds of things, rules, pictures and sounds, but no map, person, quest or
 * story of its own — one blank map of the template's first plain ground, ringed by its first solid terrain.
 */
export function emptyShape(dir: string): void {
  for (const d of ['maps', 'people', 'quests', 'story', 'learned']) rmSync(join(dir, d), { recursive: true, force: true })
  const g = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')) as GameJson
  const chars = Object.entries(g.terrainChars)
  const ground = chars.find(([, t]) => t === 'grass')?.[0] ?? chars[0][0]
  const edge = chars.find(([, t]) => t === 'tree')?.[0] ?? chars.find(([, t]) => t === 'wall')?.[0] ?? ground
  const w = 32
  const h = 20
  const rows = Array.from({ length: h }, (_, y) => (y === 0 || y === h - 1 ? edge.repeat(w) : edge + ground.repeat(w - 2) + edge))
  const map: RawChunk = { map: { id: 'world', name: { en: 'A new map', zh: '新地图' }, kind: 'village', width: w, height: h, rows, portals: [] }, entities: [] }
  mkdirSync(join(dir, 'maps'), { recursive: true })
  writeFileSync(join(dir, 'maps', 'world.json'), formatJson(map))
  const { order: _order, origin: _origin, begin: _begin, starts: _starts, companions: _companions, ...rest } = g
  writeFileSync(join(dir, 'game.json'), formatJson({ ...rest, start: { map: 'world', x: Math.floor(w / 2), y: Math.floor(h / 2) } }))
}
