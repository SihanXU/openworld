// What the AI drafter (drafter.ts) tells the modder the game has for a person or a map, where a drafted file goes in
// the project, and its problems compiled with the project before it is taken in. Pure of the page.

import type { Patch, RawChunk } from '@openworld/engine'
import { compile, type PersonFile, type Problem } from '@openworld/format'
import type { Ctx } from './context.ts'
import { langName, sourceLang, tx } from './words.ts'

/** A person's: the map shown, its spots and those of the maps its portals join, the kinds of people, a sample, the ids taken. */
export function personContext(ctx: Ctx) {
  const maps = ctx.store.maps().map((m) => m.data)
  const here = maps.find((m) => m.map.id === ctx.map)
  const joined = new Set([ctx.map, ...(here?.map.portals ?? []).map((p) => p.to), ...maps.filter((m) => m.map.portals.some((p) => p.to === ctx.map)).map((m) => m.map.id)])
  // (never a cell one arrives on: the game's start, a portal's landing; someone standing there stands in the player's way)
  const start = ctx.store.game.start
  const landings = new Set([`${start.map}:${start.x},${start.y}`, ...maps.flatMap((m) => m.map.portals.map((p) => `${p.to}:${p.tx},${p.ty}`))])
  const anchors = maps.filter((m) => joined.has(m.map.id)).flatMap((m) => Object.entries(m.map.anchors ?? {}).filter(([, [x, y]]) => !landings.has(`${m.map.id}:${x},${y}`)).map(([a]) => `${m.map.id}:${a}`))
  const onto = ctx.onto()
  const people = ctx.store.list<PersonFile>('people')
  const sample = (people.find((p) => p.data.place.on === 'tile' && p.data.place.map === ctx.map) ?? people[0])?.data
  return {
    map: ctx.map,
    anchors,
    kinds: Object.keys(onto.types).filter((k) => k.startsWith('actor/person/') && k !== 'actor/person/player').map((id) => ({ id, name: tx(onto.types[id]?.name) })),
    sample,
    taken: people.map((p) => p.data.id),
    lang: langName(sourceLang()),
  }
}

/** A map's: the ground's characters, the kinds of things the maps hold most, the ids taken. */
export function mapContext(ctx: Ctx) {
  const onto = ctx.onto()
  const used = new Map<string, number>()
  for (const m of ctx.store.maps()) for (const e of m.data.entities) if (e.place.on === 'tile') used.set(e.type, (used.get(e.type) ?? 0) + 1)
  const things = [...used].sort((a, b) => b[1] - a[1]).slice(0, 120).map(([id]) => ({ id, name: tx(onto.types[id]?.name) }))
  return {
    chars: Object.entries(ctx.store.game.terrainChars).filter(([, id]) => !(onto.terrains[id]?.tags ?? []).includes('overworld') && id !== 'void').map(([char, terrain]) => ({ char, terrain, name: tx(onto.terrains[terrain]?.name) })),
    things,
    taken: ctx.store.maps().map((m) => m.data.map.id),
    maxSize: [40, 30] as [number, number],
    lang: langName(sourceLang()),
  }
}

/** Where a drafted person or map goes in the project. */
export function fileOf(kind: 'person' | 'map', data: Record<string, unknown>): string {
  return kind === 'person' ? `people/${String(data.id).replace(/^npc\./, '').replace(/[^A-Za-z0-9._-]+/g, '-')}.json` : `maps/${String((data.map as { id: string }).id)}.json`
}

/** The draft's problems as the game would have them: the project compiled with it in (nothing written). */
export function problemsWith(ctx: Ctx, kind: 'person' | 'map', file: string, data: Record<string, unknown>): Problem[] {
  const p = ctx.store.project()
  if (kind === 'person') p.people = [...p.people.filter((x) => x.file !== file), { file, data: data as unknown as PersonFile }]
  else p.maps = [...p.maps.filter((x) => x.file !== file), { file, data: data as unknown as RawChunk }]
  return compile(p).problems.filter((x) => x.file === file)
}


/** A step of a draft as the modder keeps it (GET /trace): the AI's answer summed up and its JSON, what the engine sent back, a picture drawn. */
export interface Step {
  at: number
  who: 'ai' | 'engine' | 'artist'
  text: string
  data?: unknown
  problems?: string[]
}

/**
 * What a message in the drafter's chat asks the modder. With no draft held yet it is a draft of what the author said;
 * with one, a revision of it: the conversation's first ask stays the intent, the message is what to change, and the draft
 * goes back as it was (a thing's pictures left out: they are drawn again from its look).
 */
export function draftRequest(kind: 'thing' | 'person' | 'map', said: string, id: string, held?: { intent: string; patch?: Patch; data?: unknown }): { path: '/create' | '/draft'; body: Record<string, unknown> } {
  const previous = !held ? undefined : kind === 'thing' ? { artifacts: (held.patch?.artifacts ?? []).map((a) => (a.kind === 'type' ? { ...a, type: { ...a.type, art: undefined, sprite: undefined } } : a)) } : held.data
  const ask = held ? { intent: held.intent, previous, feedback: said } : { intent: said }
  return kind === 'thing' ? { path: '/create', body: { ...ask, id } } : { path: '/draft', body: { kind, ...ask, id } }
}
