// The compiler (docs/engine-split.md §5, P3): a project's files → the bundle the runtime loads, and the world
// (index and map files) beside it. It merges the ontology over the standard library's, puts the rules
// together, resolves the people's anchors, lays the maps out by their edge links, counts what is where and
// derives what the story protects, and reports every problem it finds (check.ts) instead of throwing.

import { storyTopics, type Entity, type MapMeta, type Ontology, type Pos, type RawChunk, type Rule, type ScheduleEntry, type WorldIndex } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { checkProject } from './check.ts'
import { FORMAT, type Bundle, type Compiled, type GameJson, type OntologyPart, type PersonFile, type Problem, type Project } from './project.ts'

/** Records merged by key (a later file's entry replaces an earlier one's). */
const RECORDS = ['types', 'statuses', 'terrains', 'laws', 'professions', 'resistances', 'efficiency', 'materials', 'factions'] as const
/** Lists of names: joined, each once. */
const NAMES = ['elements', 'vfx', 'instanceTags'] as const
/** Lists of things with a key: joined, a later one of the same key replacing the earlier. */
const KEYED: Record<string, string> = { thresholds: 'name', periods: 'name', roomRoles: 'role', deeds: 'id', talk: 'id', qualities: 'id' }

/** The ontology: the standard library's (unless the game says not), then each of the project's parts in order. */
export function mergeOntology(parts: OntologyPart[], game: Pick<GameJson, 'stdlib' | 'modules' | 'params'>): Ontology {
  const out: Record<string, unknown> = { types: {}, statuses: {}, terrains: {}, elements: [], vfx: [] }
  const all = [...(game.stdlib === false ? [] : [STDLIB_ONTOLOGY as OntologyPart]), ...parts]
  for (const part of all)
    for (const [k, v] of Object.entries(part)) {
      if (v === undefined) continue
      if ((RECORDS as readonly string[]).includes(k)) {
        const into = (out[k] ??= {}) as Record<string, unknown>
        if (Array.isArray(v)) for (const x of v as { id: string }[]) into[x.id] = x
        else Object.assign(into, v)
      } else if ((NAMES as readonly string[]).includes(k)) {
        const into = (out[k] ??= []) as string[]
        for (const x of v as string[]) if (!into.includes(x)) into.push(x)
      } else if (k in KEYED) {
        const key = KEYED[k]
        const into = (out[k] ??= []) as Record<string, unknown>[]
        for (const x of v as Record<string, unknown>[]) {
          const i = into.findIndex((y) => y[key] === x[key])
          if (i >= 0) into[i] = x
          else into.push(x)
        }
      } else if (k === 'params') out.params = { ...(out.params as object), ...(v as object) }
      else if (k === 'appear') out.appear = [...((out.appear as unknown[]) ?? []), ...(v as unknown[])]
      else out[k] = v
    }
  out.params = { ...(out.params as object), ...game.params }
  out.modules = [...(game.modules ?? [])]
  return structuredClone(out) as unknown as Ontology
}

/** The rules: the standard library's (unless the game says not), then the project's; a rule of an id already there takes its place. */
export function mergeRules(files: Rule[][], game: Pick<GameJson, 'stdlib'>): Rule[] {
  const out: Rule[] = []
  const at = new Map<string, number>()
  for (const r of [...(game.stdlib === false ? [] : STDLIB_RULES), ...files.flat()]) {
    const rule = { ...structuredClone(r), source: r.source ?? { origin: 'base' as const } }
    const i = at.get(r.id)
    if (i !== undefined) out[i] = rule
    else at.set(r.id, out.push(rule) - 1)
  }
  return out
}

/** A person's file as the world keeps the person: each schedule entry's anchor put in its place. */
export function resolvePerson(p: PersonFile, anchor: (name: string) => Pos | undefined, problems: Problem[], file?: string): Entity {
  const e = structuredClone(p) as Entity
  if (!p.npc) return e
  e.npc!.schedule = p.npc.schedule.map((s, i) => {
    if (s.at === undefined) return s as ScheduleEntry
    const { at, ...rest } = s
    const pos = anchor(at)
    if (!pos) problems.push({ level: 'error', code: 'reference', file, at: `npc.schedule[${i}]`, message: `${p.id}: no anchor "${at}" (write it as map:anchor, the anchor one of the map's)` })
    return { ...rest, map: pos?.map ?? '', x: pos?.x ?? 0, y: pos?.y ?? 0 } as ScheduleEntry
  })
  return e
}

/** Where each map lies (its top left, in tiles), from the edge links: the world map lays maps out by it. Maps reached only through doors are left out. */
export function placeMaps(chunks: RawChunk[], origin: string | undefined): Map<string, { x: number; y: number }> {
  const by = new Map(chunks.map((c) => [c.map.id, c.map]))
  const out = new Map<string, { x: number; y: number }>()
  const first = origin && by.get(origin)
  if (!first) return out
  out.set(first.id, { x: 0, y: 0 })
  const queue = [first]
  while (queue.length) {
    const a = queue.shift()!
    const pa = out.get(a.id)!
    for (const p of a.portals) {
      const b = by.get(p.to)
      if (!b || out.has(b.id)) continue
      let pos: { x: number; y: number } | undefined
      if (p.x === a.width - 1) pos = { x: pa.x + a.width, y: pa.y + p.y - p.ty }
      else if (p.x === 0) pos = { x: pa.x - b.width, y: pa.y + p.y - p.ty }
      else if (p.y === a.height - 1) pos = { x: pa.x + p.x - p.tx, y: pa.y + a.height }
      else if (p.y === 0) pos = { x: pa.x + p.x - p.tx, y: pa.y - b.height }
      if (!pos) continue
      out.set(b.id, pos)
      queue.push(b)
    }
  }
  return out
}

/** A project → its bundle, its world, and what is wrong with it. */
export function compile(p: Project): Compiled {
  const problems: Problem[] = []
  const g = p.game
  const ontology = mergeOntology(p.ontology.map((f) => f.data), g)
  const rules = mergeRules(p.rules.map((f) => f.data), g)
  const chunks = p.maps.map((f) => structuredClone(f.data))
  const anchor = (name: string): Pos | undefined => {
    const [mapId, key] = name.split(':')
    const m = chunks.find((c) => c.map.id === mapId)?.map
    const a = key !== undefined ? m?.anchors?.[key] : undefined
    return m && a ? { map: m.id, x: a[0], y: a[1] } : undefined
  }
  const npcs = p.people.map((f) => resolvePerson(f.data, anchor, problems, f.file))
  const steps = p.story.flatMap((f) => f.data.steps ?? [])
  const quests = p.quests.map((f) => structuredClone(f.data))
  const at = placeMaps(chunks, g.start.map)
  const onMap = (e: Entity, id: string) => e.place.on === 'tile' && e.place.map === id
  const maps: MapMeta[] = chunks.map((c) => ({
    id: c.map.id,
    name: c.map.name,
    kind: c.map.kind,
    ...(c.map.region && { region: c.map.region }),
    width: c.map.width,
    height: c.map.height,
    portals: c.map.portals,
    npcs: npcs.filter((n) => onMap(n, c.map.id)).length,
    items: c.entities.filter((e) => e.type.startsWith('item/')).length,
    ...(at.has(c.map.id) && { at: at.get(c.map.id) }),
  }))
  const placed = chunks.flatMap((c) => c.entities)
  const kinds = new Set(placed.filter((e) => e.type.startsWith('item/')).map((e) => `${e.type}|${(e.tags ?? []).join(',')}`))
  const index: WorldIndex = {
    name: g.name,
    version: g.version,
    seed: g.seed,
    start: g.start,
    ...(g.begin && { begin: g.begin }),
    ...(g.starts && { starts: g.starts }),
    ...(g.startHour !== undefined && { startHour: g.startHour }),
    maps,
    npcs,
    player: structuredClone(g.player),
    ...(g.companions && { companions: structuredClone(g.companions) }),
    stats: {
      maps: chunks.length,
      npcs: npcs.length,
      creatures: placed.filter((e) => e.type.startsWith('actor/creature')).length,
      items: placed.filter((e) => e.type.startsWith('item/')).length,
      itemKinds: kinds.size,
      fixtures: placed.filter((e) => e.type.startsWith('fixture/')).length,
    },
    steps,
    invariants: p.story.flatMap((f) => f.data.invariants ?? []),
    // the story's facts, and the topics it raises itself (its news: no patch raises one)
    protectedFacts: [...new Set([...p.story.flatMap((f) => f.data.protectedFacts ?? []), ...storyTopics(steps, rules).map((t) => `topic.${t}`)])],
    weather: p.story.flatMap((f) => f.data.weather ?? []),
    quests,
    ...p.extra,
  }
  const client = p.client?.length ? Object.assign({}, ...p.client.map((f) => f.data)) : undefined
  const bundle: Bundle = {
    format: FORMAT,
    game: { id: g.id, name: g.name, version: g.version, ...(g.engine && { engine: g.engine }), modules: [...(g.modules ?? [])], ...(g.plugins && { plugins: g.plugins }) },
    ontology,
    rules,
    terrainChars: g.terrainChars,
    ...(p.catalog !== undefined && { catalog: p.catalog }),
    ...(client && { client }),
  }
  problems.push(...checkProject(p, { ontology, rules, chunks, npcs, index }))
  return { bundle, index, chunks, problems }
}
