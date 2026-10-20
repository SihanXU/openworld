// What an author may have the AI draft besides a new thing (the editor's AI drafter): a person, a map. The editor says
// what the game has to draw on (a map's anchors, the kinds of people, the ground's characters, the kinds of things);
// the draft is held to that shape here before the author sees it, and the editor compiles it with the project before
// it is taken in. Pure: the pipeline asks and repairs, the prompts describe.

export type DraftKind = 'person' | 'map'

/** What the game has, as the editor tells it. */
export interface DraftContext {
  /** A person's map, and its named spots (`map:anchor`, those of other maps too). */
  map?: string
  anchors?: string[]
  /** The kinds of people there are. */
  kinds?: { id: string; name?: string }[]
  /** One of the game's own files of that kind, as an example of its form. */
  sample?: unknown
  /** The ids taken already (people, or maps). */
  taken?: string[]
  /** The ground's characters, for a map. */
  chars?: { char: string; terrain: string; name?: string }[]
  /** The kinds of things a map may hold. */
  things?: { id: string; name?: string }[]
  /** The largest map to draft (width, height). */
  maxSize?: [number, number]
  /** The language the game is written in (its words are written in it). */
  lang?: string
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isText = (v: unknown) => typeof v === 'string' || (obj(v) && Object.values(v).every((x) => typeof x === 'string'))

/** Why a drafted person is not yet a person file of this game (none: it is). */
export function personProblems(p: unknown, ctx: DraftContext): string[] {
  if (!obj(p)) return ['the answer is not a person file (an object)']
  const out: string[] = []
  if (typeof p.id !== 'string' || !/^npc\.[a-z0-9_]+$/.test(p.id)) out.push('id: "npc.<lower_case>"')
  else if (ctx.taken?.includes(p.id)) out.push(`id "${p.id}" is taken: choose another`)
  if (!isText(p.name)) out.push('name: their name, as text')
  if (typeof p.type !== 'string') out.push('type: one of the kinds of people')
  else if (ctx.kinds?.length && !ctx.kinds.some((k) => k.id === p.type)) out.push(`type "${p.type}" is not a kind of person here: one of ${ctx.kinds.map((k) => k.id).join(', ')}`)
  const place = p.place as Record<string, unknown> | undefined
  if (!obj(place) || place.on !== 'tile' || typeof place.x !== 'number' || typeof place.y !== 'number') out.push('place: {"on": "tile", "map": "<map>", "x": <n>, "y": <n>}')
  else if (ctx.map && place.map !== ctx.map) out.push(`place.map: "${ctx.map}" (the map they are drafted for)`)
  const npc = p.npc as Record<string, unknown> | undefined
  if (!obj(npc)) return [...out, 'npc: {"role", "schedule": [...], "person": {"lines": [...]}}']
  const schedule = Array.isArray(npc.schedule) ? (npc.schedule as unknown[]) : undefined
  if (!schedule?.length) out.push('npc.schedule: their day, entries {from, to, at, activity}')
  for (const [i, e] of (schedule ?? []).entries()) {
    if (!obj(e)) { out.push(`npc.schedule[${i}]: an object`); continue }
    if (typeof e.from !== 'number' || typeof e.to !== 'number' || e.from < 0 || e.to > 24 || e.from > 24 || e.to < 0) out.push(`npc.schedule[${i}]: from and to are hours, 0 to 24`)
    if (typeof e.at !== 'string') out.push(`npc.schedule[${i}].at: a named spot "map:anchor"`)
    else if (ctx.anchors?.length && !ctx.anchors.includes(e.at)) out.push(`npc.schedule[${i}].at "${e.at}" is no named spot: one of ${ctx.anchors.slice(0, 40).join(', ')}`)
  }
  const lines = obj(npc.person) && Array.isArray(npc.person.lines) ? (npc.person.lines as unknown[]) : undefined
  if (!lines?.length) out.push('npc.person.lines: what they say, entries {key, text} (key "default", "greeting:first" …)')
  for (const [i, l] of (lines ?? []).entries()) if (!obj(l) || typeof l.key !== 'string' || !isText(l.text)) out.push(`npc.person.lines[${i}]: {key, text}`)
  return out
}

/** Why a drafted map is not yet a map file of this game (none: it is). */
export function mapProblems(c: unknown, ctx: DraftContext): string[] {
  if (!obj(c) || !obj(c.map)) return ['the answer is not a map file ({"map": {...}, "entities": [...]})']
  const m = c.map
  const out: string[] = []
  if (typeof m.id !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(m.id)) out.push('map.id: lower case letters, digits, - and _')
  else if (ctx.taken?.includes(m.id)) out.push(`map.id "${m.id}" is taken: choose another`)
  if (!isText(m.name)) out.push('map.name: its name, as text')
  const [mw, mh] = ctx.maxSize ?? [48, 36]
  const w = m.width, h = m.height
  if (typeof w !== 'number' || typeof h !== 'number' || w < 8 || h < 8 || w > mw || h > mh) out.push(`map.width and map.height: 8 to ${mw} by 8 to ${mh}`)
  const rows = Array.isArray(m.rows) ? (m.rows as unknown[]) : []
  if (typeof h === 'number' && rows.length !== h) out.push(`map.rows: ${h} rows (one a line of the map), not ${rows.length}`)
  const known = new Set((ctx.chars ?? []).map((x) => x.char))
  const bad = new Set<string>()
  rows.forEach((r, y) => {
    if (typeof r !== 'string') return void out.push(`map.rows[${y}]: a string`)
    if (typeof w === 'number' && [...r].length !== w) out.push(`map.rows[${y}]: ${w} characters, not ${[...r].length}`)
    if (known.size) for (const ch of r) if (!known.has(ch)) bad.add(ch)
  })
  if (bad.size) out.push(`map.rows: characters the ground has none for: ${[...bad].map((x) => JSON.stringify(x)).join(' ')} (use only ${[...known].join('')})`)
  const inside = (x: unknown, y: unknown) => typeof x === 'number' && typeof y === 'number' && typeof w === 'number' && typeof h === 'number' && x >= 0 && y >= 0 && x < w && y < h
  for (const [k, v] of Object.entries(obj(m.anchors) ? m.anchors : {})) if (!Array.isArray(v) || !inside(v[0], v[1])) out.push(`map.anchors.${k}: [x, y] on the map`)
  const kinds = new Set((ctx.things ?? []).map((x) => x.id))
  const ents = Array.isArray(c.entities) ? (c.entities as unknown[]) : []
  if (!Array.isArray(c.entities)) out.push('entities: the things on the map (may be [])')
  ents.forEach((e, i) => {
    if (!obj(e) || typeof e.id !== 'string' || typeof e.type !== 'string') return void out.push(`entities[${i}]: {id, type, place}`)
    if (kinds.size && !kinds.has(e.type)) out.push(`entities[${i}].type "${e.type}" is not a kind of thing here`)
    const p = e.place as Record<string, unknown> | undefined
    if (!obj(p) || p.on !== 'tile' || !inside(p.x, p.y)) out.push(`entities[${i}].place: {"on": "tile", "map": "<id>", "x", "y"} on the map`)
  })
  return out
}

/** A drafted map as a map file: what the draft leaves out filled in (no portals: they are the author's to make). */
export function settleMap(c: Record<string, unknown>): Record<string, unknown> {
  const m = c.map as Record<string, unknown>
  const id = m.id as string
  return {
    ...c,
    map: { kind: 'wild', light: 'outdoor', zone: 'peaceful', anchors: {}, regions: {}, ...m, portals: [] },
    entities: ((c.entities as Record<string, unknown>[] | undefined) ?? []).map((e) => ({ ...e, place: { ...(e.place as object), on: 'tile', map: id } })),
  }
}
