// A new thing in a game (the editor's AI plan, M1): what it needs to hold before it is taken in. It can be had (from
// what the world holds at the start, through the rules that make things and the recipes, the way a player gets it),
// it is good for something (a recipe needs it, or an act with it has an answer), and its numbers sit among its
// kind's. Read from a compiled project with the new types beside it; the editor shows each check with its reason.

import { OntologyIndex, deriveRecipes, restoreLibrary, validatePatch, type LibraryData, type Ontology, type Patch, type Recipe, type Rule, type Selector, type TypeDef } from '@openworld/engine'
import { holesFor } from './holes.ts'
import type { Compiled } from './project.ts'

export interface ThingCheck {
  id: 'valid' | 'obtainable' | 'useful' | 'numbers'
  ok: boolean
  /** What was found: how it is had, what it is good for, why not. */
  detail: string[]
}

export interface ThingReport {
  type: string
  checks: ThingCheck[]
  /** Its acts as a thing held and as a thing acted on: how many were tried, how many are still holes. */
  acts: { checked: number; holes: number }
}

/** The ontology with more types in it (the patches the game ships with, a draft's). */
export function withTypes(onto: Ontology, types: TypeDef[]): Ontology {
  const o = structuredClone(onto)
  for (const t of types) o.types[t.id] = t
  return o
}

const typesOf = (p: Patch): TypeDef[] => p.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type] : []))
const rulesOf = (p: Patch): Rule[] => p.artifacts.flatMap((a) => (a.kind === 'rule' ? [a.rule] : []))
const isA = (id: string, of: string) => id === of || id.startsWith(`${of}/`)

/** Every string inside a value (a map, a person, a rule's tree), for the type ids it names. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) for (const x of v) strings(x, out)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out)
  return out
}

/** What a rule's tree makes: the types its spawns, transforms and appearances name. */
function madeBy(tree: unknown, out: string[] = []): string[] {
  if (Array.isArray(tree)) for (const x of tree) madeBy(x, out)
  else if (tree && typeof tree === 'object') {
    const o = tree as Record<string, unknown>
    if (o.op === 'spawn' || o.op === 'appear') for (const k of ['type', 'types']) out.push(...strings(o[k]))
    if (o.op === 'transform' && typeof o.into === 'string') out.push(o.into)
    for (const x of Object.values(o)) if (x && typeof x === 'object') madeBy(x, out)
  }
  return out
}

/** What a quest or a story step hands over: the types its rewards name, and what its effects make. */
function rewardsOf(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) rewardsOf(x, out)
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (o.reward) strings(o.reward, out)
    for (const x of Object.values(o)) if (x && typeof x === 'object') rewardsOf(x, out)
  }
  return out
}

/** The game's own recipes (its crafting table, the shops' wares among them: a stall is a station), beside the types'. */
function gameRecipes(c: Compiled): Recipe[] {
  const r = (c.bundle.client as { crafting?: { recipes?: unknown } } | undefined)?.crafting?.recipes
  return Array.isArray(r) ? (r as Recipe[]).filter((x) => typeof x?.make?.type === 'string' && Array.isArray(x.needs)) : []
}

/** Can a thing of a type be carried (the `portable` tag, the engine's World.isPortable): only such a thing is in a bag or a hand. */
const carriable = (idx: OntologyIndex, t: string) => idx.resolve(t).tags.includes('portable')

/**
 * What a player can have in this game, and how: the things the maps and the people hold at the start, then (until
 * nothing more is found) what the rules of things one has make, and what the recipes make of things one has (at a
 * station one has, with the tools one carries). A thing is "had" by its type; the first way found is kept. A fixture
 * had (a table, a chest, a workbench) is a station or a rule's host, never a recipe's part or tool: the engine
 * crafts only from what one carries.
 */
export function obtainable(c: Compiled, extra: TypeDef[] = []): Map<string, string> {
  const onto = withTypes(c.bundle.ontology, [...(c.bundle.learned?.types ?? []), ...extra])
  const idx = new OntologyIndex(onto)
  const known = new Set(Object.keys(onto.types))
  const have = new Map<string, string>()
  const add = (t: string, how: string) => void (have.has(t) || have.set(t, how))
  // at the start: every type a map or a person names (what stands and lies there, what is inside, loot, what appears)
  for (const ch of c.chunks) {
    for (const s of strings(ch.entities)) if (known.has(s)) add(s, `on the map ${ch.map.id}`)
    for (const s of strings((ch.map as { appear?: unknown }).appear)) if (known.has(s)) add(s, `appears on the map ${ch.map.id}`)
    const chars = new Set((ch.map.rows ?? []).join(''))
    for (const [ch1, terrain] of Object.entries(c.bundle.terrainChars)) if (chars.has(ch1)) add(`tile/${terrain}`, `ground of the map ${ch.map.id}`)
  }
  for (const p of c.index.npcs ?? []) for (const s of strings(p)) if (known.has(s) && s.startsWith('item/')) add(s, `carried by ${p.id}`)
  for (const q of c.index.quests ?? []) for (const s of rewardsOf(q)) if (known.has(s)) add(s, `a reward of the quest ${q.id}`)
  for (const st of c.index.steps ?? []) for (const s of [...rewardsOf(st), ...madeBy(st)]) if (known.has(s)) add(s, `given by the story step ${(st as { id?: string }).id ?? ''}`.trim())
  const rules = [...c.bundle.rules, ...(c.bundle.learned?.rules ?? [])]
  const recipes = [...deriveRecipes(idx), ...gameRecipes(c)]
  const tagsOf = (t: string) => idx.resolve(t).tags
  const hosts = (sel: Selector | 'world' | 'story' | undefined) =>
    !sel || sel === 'world' || sel === 'story' ? true : [...have.keys()].some((t) => (!sel.type || isA(t, sel.type)) && (sel.tags ?? []).every((g) => tagsOf(t).includes(g)))
  const stations = () => new Set([...have.keys()].flatMap((t) => tagsOf(t).filter((g) => g.startsWith('station:')).map((g) => g.slice(8))))
  for (let grew = true; grew; ) {
    const before = have.size
    for (const r of rules) if (hosts(r.host)) for (const t of madeBy(r.tree)) if (known.has(t)) add(t, `made by the rule ${r.id}`)
    const at = stations()
    const carried = new Set([...have.keys()].filter((t) => carriable(idx, t)).flatMap(tagsOf))
    for (const r of recipes) {
      if (have.has(r.make.type ?? '')) continue
      const placeOk = !r.station || r.station === 'hands' || at.has(r.station)
      if (placeOk && r.needs.every((n) => have.has(n.type) && carriable(idx, n.type)) && (r.tools ?? []).every((g) => carried.has(g)))
        add(r.make.type!, `made ${!r.station || r.station === 'hands' ? 'by hand' : `at a ${r.station}`} from ${r.needs.map((n) => `${n.count} ${n.type}`).join(' + ')}`)
    }
    grew = have.size > before
  }
  return have
}

/**
 * What a player of a game has to make new things of, as the modder is told it: the things one can have and carry
 * (a recipe's parts and tools), and the stations one can have (fixtures had count only as these).
 */
export function makingStock(c: Compiled): { had: string[]; stations: string[] } {
  const have = obtainable(c)
  const idx = new OntologyIndex(withTypes(c.bundle.ontology, c.bundle.learned?.types ?? []))
  const ids = [...have.keys()].filter((id) => !id.startsWith('tile/') && !id.startsWith('actor/'))
  const stations = [...new Set(ids.flatMap((id) => idx.resolve(id).tags.filter((g) => g.startsWith('station:')).map((g) => g.slice(8))))]
  return { had: ids.filter((id) => carriable(idx, id)), stations }
}

/** Why a type cannot be had: its recipe's parts, station and tools that cannot. */
function whyNot(t: TypeDef, have: Map<string, string>, idx: OntologyIndex): string[] {
  if (!t.makeup?.length || !t.station) return ['no recipe makes it, no rule makes it, and no map holds it']
  const out = t.makeup.flatMap((m) =>
    !have.has(m.type) ? [`its part ${m.type} cannot be had`] : !carriable(idx, m.type) ? [`its part ${m.type} cannot be carried (only what one carries is made into things; a fixture is a station)`] : [],
  )
  const at = new Set([...have.keys()].flatMap((x) => idx.resolve(x).tags.filter((g) => g.startsWith('station:')).map((g) => g.slice(8))))
  if (t.station !== 'hands' && !at.has(t.station)) out.push(`no ${t.station} can be had to make it at`)
  return out.length ? out : ['it is not reached from the start']
}

/** The numbers a type's props hold, beside the same numbers of its kind's other types (its siblings). */
function numbers(t: TypeDef, onto: Ontology, idx: OntologyIndex): ThingCheck {
  const parent = t.id.split('/').slice(0, -1).join('/')
  const own = idx.resolve(t.id).props
  const sibs = Object.keys(onto.types).filter((id) => id !== t.id && id.split('/').slice(0, -1).join('/') === parent)
  const detail: string[] = []
  let ok = true
  for (const [k, v] of Object.entries(own)) {
    if (typeof v !== 'number') continue
    const vs = sibs.map((s) => idx.resolve(s).props[k]).filter((x): x is number => typeof x === 'number')
    if (!vs.length) continue
    const lo = Math.min(...vs)
    const hi = Math.max(...vs)
    // a new thing may be the best or the least of its kind, not four times past either
    const out = (v > 0 && hi > 0 && v > hi * 4) || (v >= 0 && lo > 0 && v < lo / 4)
    if (out) ok = false
    detail.push(`${k} ${v} (its kind: ${lo}–${hi})${out ? ': far outside' : ''}`)
  }
  if (!detail.length) detail.push(sibs.length ? 'no number its kind also has' : 'no other thing of its kind to compare with')
  return { id: 'numbers', ok, detail }
}

/** The checks of a draft's new things in a compiled game, one report per new type. */
export function checkThings(c: Compiled, draft: Patch): ThingReport[] {
  const learned = c.bundle.learned
  const fresh = typesOf(draft)
  const onto = withTypes(c.bundle.ontology, [...(learned?.types ?? []), ...fresh])
  const idx = new OntologyIndex(onto)
  const lib = restoreLibrary(c.bundle.rules, learned, structuredClone(c.bundle.ontology))
  const res = validatePatch(draft, { ontology: structuredClone(c.bundle.ontology), library: lib })
  const have = obtainable(c, fresh)
  const recipes = [...deriveRecipes(idx), ...gameRecipes(c)]
  const withDraft: LibraryData = { version: learned?.version ?? 1, log: learned?.log ?? [], statuses: learned?.statuses ?? [], types: [...(learned?.types ?? []), ...fresh], rules: [...(learned?.rules ?? []), ...rulesOf(draft).map((r) => ({ ...r, source: { ...r.source, origin: 'patch' as const } }))] }
  return fresh.map((t) => {
    const valid: ThingCheck = { id: 'valid', ok: res.ok, detail: res.ok ? ['the engine takes it (schema, ontology, replay)'] : res.errors }
    const how = have.get(t.id)
    const obtain: ThingCheck = { id: 'obtainable', ok: !!how, detail: how ? [how] : whyNot(t, have, idx) }
    // what it is good for: recipes that need it, and its acts that have an answer (held, and acted on)
    const needed = recipes.filter((r) => r.needs.some((n) => n.type === t.id)).map((r) => `a part of ${r.make.type}`)
    const held = holesFor(c.bundle.ontology, c.bundle.rules, { hands: [t.id], verbs: ['use', 'self'], learned: withDraft })
    const on = holesFor(c.bundle.ontology, c.bundle.rules, { targets: [t.id], learned: withDraft })
    const checked = held.checked + on.checked
    const holes = held.cells.length + on.cells.length
    const answered = checked - holes
    const useful: ThingCheck = { id: 'useful', ok: needed.length > 0 || answered > 0, detail: [...needed, `${answered} of ${checked} acts with it have an answer; ${holes} are holes the AI answers in play`] }
    return { type: t.id, checks: [valid, obtain, useful, numbers(t, onto, idx)], acts: { checked, holes } }
  })
}
