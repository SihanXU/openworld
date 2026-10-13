// Where things are used (docs/engine-split.md §16 E2, RPG Maker's event searcher): the story's facts, each with
// where it is set and where it is read, and any id — a type, a person, a map, a quest, a step, a rule — with every
// place of the project that names it. Read from the project's files as they are now (saved or not). Pure.

/** A place a file names something: the file, the path into it, what it does there, and where the editor opens it. */
export interface Use {
  file: string
  path: string
  how: 'set' | 'read' | 'names'
  /** An id the file's mode opens at (a map's thing, a rule, a step, a type). */
  at?: string
}

type Json = unknown
type Path = (string | number)[]

const pathText = (p: Path) => p.map((k) => (typeof k === 'number' ? `[${k}]` : `.${k}`)).join('').replace(/^\./, '')

/** The id a path into a file opens at: the thing, rule, step or entry it is in. */
function atOf(file: string, data: Json, p: Path): string | undefined {
  const idAt = (list: unknown, i: unknown) => (Array.isArray(list) && typeof i === 'number' ? (list[i] as { id?: string } | undefined)?.id : undefined)
  const d = data as Record<string, unknown>
  if (file.startsWith('maps/') && p[0] === 'entities') return idAt(d.entities, p[1])
  if (file.startsWith('rules/') || file.startsWith('learned/')) return idAt(Array.isArray(data) ? data : d.rules, Array.isArray(data) ? p[0] : p[1])
  if (file.startsWith('story/') && p[0] === 'steps') return idAt(d.steps, p[1])
  if (file.startsWith('ontology/') && typeof p[0] === 'string') return idAt(d[p[0]], p[1])
  return undefined
}

/** Every value of a file, with its path (and the object it sits in). */
function walk(v: Json, p: Path, visit: (v: Json, p: Path, parent?: Record<string, unknown>) => void, parent?: Record<string, unknown>): void {
  visit(v, p, parent)
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...p, i], visit, undefined))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, [...p, k], visit, v as Record<string, unknown>)
}

/** Is a path inside a condition (a step's `when`, a quest's trigger, a rule's `if`, an invariant's tests)? */
const reading = (p: Path) => p.some((k) => k === 'when' || k === 'on' || k === 'if' || k === 'holds' || k === 'start' || k === 'auto' || k === 'all' || k === 'any' || k === 'not')

/**
 * The story's facts, each with where it is set (a step's facts, a scene's `fact`, a quest's reward, a rule telling the
 * story `fact.<key>`) and read (a trigger's facts, a quest's `fact`, a line's `fact:` key or `{fact:…}` slot, a way that
 * opens on one, a counting objective).
 */
export function factUses(files: { file: string; data: Json }[]): Map<string, Use[]> {
  const out = new Map<string, Use[]>()
  const add = (key: string, u: Use) => {
    if (!key) return
    out.set(key, [...(out.get(key) ?? []), u])
  }
  for (const { file, data } of files) {
    walk(data, [], (v, p, parent) => {
      const use = (key: string, how: Use['how']) => add(key, { file, path: pathText(p), how, at: atOf(file, data, p) })
      const last = p[p.length - 1]
      if (typeof v === 'string') {
        const line = v.match(/^fact:(.+)$/)
        if (line) use(line[1], 'read')
        for (const m of v.matchAll(/\{fact:([^}]+)\}/g)) use(m[1], 'read')
        if (last === 'fact' && parent && !('value' in parent)) use(v, 'read')
        if (last === 'fact' && parent && 'value' in parent) use(v, 'set')
        if (last === 'nightFact') use(v, 'read')
        return
      }
      if (!v || typeof v !== 'object' || Array.isArray(v)) return
      const o = v as Record<string, unknown>
      // a record of facts: set where a step or a reward keeps them, read where a trigger tests them
      if (last === 'facts' || last === 'fact') for (const k of Object.keys(o)) use(k, last === 'fact' || reading(p) ? 'read' : 'set')
      // a rule's notice to the story: `fact.<key>` params
      for (const k of Object.keys(o)) if (k.startsWith('fact.') && k.length > 5) add(k.slice(5), { file, path: pathText([...p, k]), how: 'set', at: atOf(file, data, p) })
    })
  }
  return out
}

/**
 * Every place a file names an id: as a value, a key, or (for a type) the start of a longer path under it
 * (`kinds`: item/food names item/food/apple). The file and path, and where its mode opens.
 */
export function usesOf(files: { file: string; data: Json }[], id: string, kinds = false): Use[] {
  const out: Use[] = []
  if (!id) return out
  const hit = (s: string) => s === id || (kinds && s.startsWith(`${id}/`)) || s === `${id}:` || s.startsWith(`${id}:`)
  for (const { file, data } of files)
    walk(data, [], (v, p) => {
      const named = typeof v === 'string' && hit(v)
      if (named) out.push({ file, path: pathText(p), how: 'names', at: atOf(file, data, p) })
      if (v && typeof v === 'object' && !Array.isArray(v)) for (const k of Object.keys(v)) if (hit(k)) out.push({ file, path: pathText([...p, k]), how: 'names', at: atOf(file, data, p) })
    })
  return out
}

/** The mode a file is edited in. */
export function modeOf(file: string): string {
  if (file.startsWith('maps/')) return 'map'
  if (file.startsWith('people/')) return 'people'
  if (file.startsWith('quests/')) return 'quests'
  if (file.startsWith('story/')) return 'story'
  if (file.startsWith('rules/')) return 'rules'
  if (file.startsWith('learned/')) return 'holes'
  if (file.startsWith('ontology/')) return 'database'
  if (file === 'catalog.json') return 'assets'
  return 'game'
}
