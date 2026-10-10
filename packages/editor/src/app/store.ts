// The project open in the editor: every file of it by path, as the format writes it (docs/engine-split.md §5).
// An edit changes a file's data in memory and marks it unsaved; Save writes what changed through the service;
// Undo takes the last edit back. The compiler runs here as it runs anywhere (it is pure): what the canvas draws
// and what the validation panel lists are the project as it is now, saved or not.

import { compile, type Compiled, type GameJson, type Project, type Sourced } from '@openworld/format'
import type { RawChunk } from '@openworld/engine'

/** The folders of the format, each a list of files of one kind. */
export const FOLDERS = ['ontology', 'rules', 'maps', 'people', 'quests', 'story', 'client', 'learned'] as const
export type Folder = (typeof FOLDERS)[number]

interface Edit {
  file: string
  /** The file's text before the edit (none: it did not exist). */
  before?: string
  why: string
  stroke?: number
}

export class Store {
  /** Every file, by its path in the project. */
  private docs = new Map<string, unknown>()
  private dirty = new Set<string>()
  private deleted = new Set<string>()
  private undos: Edit[] = []
  private listeners = new Set<(why: string, file?: string) => void>()
  private made?: Compiled
  private madeFor = -1
  private version = 0

  constructor(readonly id: string, p: Project) {
    this.docs.set('game.json', p.game)
    for (const f of FOLDERS) for (const s of (p[f] ?? []) as Sourced<unknown>[]) this.docs.set(s.file, s.data)
    if (p.catalog !== undefined) this.docs.set('catalog.json', p.catalog)
    if (p.extra !== undefined) this.docs.set('extra.json', p.extra)
  }

  static async open(id: string): Promise<Store> {
    const r = await fetch(`/api/projects/${encodeURIComponent(id)}`)
    if (!r.ok) throw new Error(((await r.json()) as { error: string }).error)
    return new Store(id, (await r.json()) as Project)
  }

  on(fn: (why: string, file?: string) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit(why: string, file?: string): void {
    this.version++
    for (const fn of this.listeners) fn(why, file)
  }

  get game(): GameJson {
    return this.docs.get('game.json') as GameJson
  }

  get<T>(file: string): T | undefined {
    return this.docs.get(file) as T | undefined
  }

  /** The files of a folder, in name order. */
  list<T>(folder: Folder): Sourced<T>[] {
    return [...this.docs.keys()].filter((f) => f.startsWith(`${folder}/`)).sort().map((file) => ({ file, data: this.docs.get(file) as T }))
  }

  maps(): Sourced<RawChunk>[] {
    return this.list<RawChunk>('maps')
  }
  mapFile(id: string): string | undefined {
    return this.maps().find((m) => m.data.map.id === id)?.file
  }

  /**
   * Change a file: its data, changed in place by `edit`, is unsaved until Save; Undo takes it back. Changes of one
   * stroke (a brush dragged over many cells: the same `stroke`) are undone together.
   */
  change<T>(file: string, why: string, edit: (data: T) => void, stroke?: number): void {
    const data = this.docs.get(file) as T
    if (data === undefined) throw new Error(`no file ${file}`)
    const before = JSON.stringify(data)
    edit(data)
    if (JSON.stringify(data) === before) return
    const last = this.undos[this.undos.length - 1]
    if (!(stroke !== undefined && last?.stroke === stroke && last.file === file)) this.undos.push({ file, before, why, stroke })
    this.dirty.add(file)
    this.emit(why, file)
  }

  /** A new file (a map, a person, a quest). */
  add(file: string, data: unknown, why: string): void {
    if (this.docs.has(file)) throw new Error(`${file} exists`)
    this.undos.push({ file, why })
    this.docs.set(file, data)
    this.deleted.delete(file)
    this.dirty.add(file)
    this.emit(why, file)
  }

  /** A file removed (Save deletes it). */
  remove(file: string, why: string): void {
    const data = this.docs.get(file)
    if (data === undefined) return
    this.undos.push({ file, before: JSON.stringify(data), why })
    this.docs.delete(file)
    this.dirty.delete(file)
    this.deleted.add(file)
    this.emit(why, file)
  }

  /** Take the last edit back: what it was called. */
  undo(): string | undefined {
    const u = this.undos.pop()
    if (!u) return undefined
    if (u.before === undefined) {
      this.docs.delete(u.file)
      this.deleted.add(u.file)
      this.dirty.delete(u.file)
    } else {
      this.docs.set(u.file, JSON.parse(u.before))
      this.deleted.delete(u.file)
      this.dirty.add(u.file)
    }
    this.emit(`undo: ${u.why}`, u.file)
    return u.why
  }

  unsaved(): number {
    return this.dirty.size + this.deleted.size
  }

  /** Write what changed through the service. */
  async save(): Promise<void> {
    const base = `/api/projects/${encodeURIComponent(this.id)}/files/`
    for (const file of [...this.dirty]) {
      const r = await fetch(base + file, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(this.docs.get(file)) })
      if (!r.ok) throw new Error(`${file}: ${((await r.json()) as { error: string }).error}`)
      this.dirty.delete(file)
    }
    for (const file of [...this.deleted]) {
      const r = await fetch(base + file, { method: 'DELETE' })
      if (!r.ok) throw new Error(`${file}: ${((await r.json()) as { error: string }).error}`)
      this.deleted.delete(file)
    }
    this.emit('saved')
  }

  /** The project as the compiler takes it. */
  project(): Project {
    const p: Project = { game: this.game, ontology: this.list('ontology'), rules: this.list('rules'), maps: this.list('maps'), people: this.list('people'), quests: this.list('quests'), story: this.list('story'), client: this.list('client'), learned: this.list('learned') }
    if (this.docs.has('catalog.json')) p.catalog = this.docs.get('catalog.json')
    if (this.docs.has('extra.json')) p.extra = this.docs.get('extra.json') as Project['extra']
    return p
  }

  /** The project compiled as it is now (kept until the next edit). */
  compiled(): Compiled {
    if (!this.made || this.madeFor !== this.version) {
      this.made = compile(structuredClone(this.project()))
      this.madeFor = this.version
    }
    return this.made
  }
}
