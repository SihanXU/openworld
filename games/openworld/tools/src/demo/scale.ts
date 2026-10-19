// The world at scale (docs/continent.md §9 C, E): load the world, walk into fifty maps — played ones, the backdrop's
// towns and wilds, the overworld between —, as the worker plays it (the maps far behind put away, frames carrying what
// is in view and what changed), and time a tick, a frame on the world map and a save. `npm run scale` prints the
// numbers; the scale test (continent.test.ts) holds them to their bounds.

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { Game, ROSTER, RuleLibrary, snapshot, type Engine, type FrameView, type MapChunk } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk, wildChunkFor } from '@openworld-game/content'
import { FrameEncoder } from '@openworld/runtime/src/frameDelta.ts'
import { buildFord } from './world.ts'

export interface ScaleNumbers {
  /** Maps walked into, and the maps whose things are in memory at the end. */
  maps: number
  inMemory: number
  /** Things kept in memory at the end, and how many of them are people. */
  entities: number
  people: number
  /** Milliseconds: a tick in the backdrop's largest town (its people about), on a played map, and on the world map. */
  townTickMs: number
  townPeople: number
  playedTickMs: number
  overworldTickMs: number
  /** A frame on the world map: milliseconds to make, and what it weighs (JSON characters) — whole, and as sent (in view, what changed). */
  overworldFrameMs: number
  overworldFrameChars: number
  overworldSentChars: number
  /** A save (JSON characters): whole, and its state alone (the rest is the rule library, as big in every world); how long it takes to make. */
  saveChars: number
  stateChars: number
  saveMs: number
  /** Milliseconds to enter a map (its chunk come, the step in), on the average. */
  enterMs: number
}

const time = (f: () => void, n = 1): number => {
  const t0 = performance.now()
  for (let i = 0; i < n; i++) f()
  return (performance.now() - t0) / n
}

/** Where to stand on a map: a cell one fits nearest its middle. */
function spot(eng: Engine, map: string): { x: number; y: number } {
  const m = eng.world.map(map)!
  const cx = Math.floor(m.width / 2)
  const cy = Math.floor(m.height / 2)
  for (let r = 0; r < Math.max(m.width, m.height); r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (eng.world.fits(eng.world.player, map, cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy }
  return { x: cx, y: cy }
}

export function scaleRun(opts: { maps?: number; ticks?: number; keep?: number } = {}): ScaleNumbers {
  const n = opts.maps ?? 50
  const world = buildFord()
  const raw = new Map([...world.chunks, ...world.backdrop].map((c) => [c.map.id, c]))
  const game = Game.create(world.index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  game.keepMaps = opts.keep ?? 8
  const eng = game.engine
  const w = eng.world
  // as the worker does: a map's chunk made (a wilderness) or read (a file), and the maps far behind put away
  const chunkOf = (id: string): MapChunk => {
    const file = raw.get(id)
    if (file) return decodeChunk(structuredClone(file))
    if (!w.map('overworld')) game.loadChunk(chunkOf('overworld'))
    return wildChunkFor(w, id)!
  }
  const arrive = (id: string) => {
    if (!w.map(id)) game.loadChunk(chunkOf(id))
    for (const need of game.neededMaps()) game.loadChunk(chunkOf(need))
  }
  arrive(w.state.spawn.map)
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
  })
  const go = (id: string) => {
    arrive(id)
    eng.author(() => eng.teleport(w.player, { map: id, ...spot(eng, id) }))
    game.trim()
  }
  const played = world.chunks.map((c) => c.map.id).filter((id) => !['tutorial', 'offstage', 'haven', 'overworld'].includes(id) && !id.startsWith('haven.'))
  const backdrop = world.backdrop.map((c) => c.map.id)
  const peopled = backdrop.filter((id) => (world.index.maps.find((m) => m.id === id)?.npcs ?? 0) > 0)
  const others = backdrop.filter((id) => !peopled.includes(id))
  const route: string[] = []
  for (let i = 0; route.length < n; i++) {
    const pick = i % 5 === 0 ? played[(i / 5) % played.length] : i % 5 === 4 ? 'overworld' : i % 2 ? peopled[i % peopled.length] : others[i % others.length]
    if (pick && route[route.length - 1] !== pick) route.push(pick)
  }
  let enter = 0
  for (const id of route) {
    enter += time(() => go(id))
    for (let t = 0; t < (opts.ticks ?? 20); t++) eng.tick()
  }
  // a tick in the backdrop's largest town, a tick in the village, a tick and a frame on the world map
  const town = [...peopled].sort((a, b) => (world.index.maps.find((m) => m.id === b)!.npcs) - (world.index.maps.find((m) => m.id === a)!.npcs))[0]
  go(town)
  for (let t = 0; t < 60; t++) eng.tick()
  const townTickMs = time(() => eng.tick(), 100)
  const townPeople = w.people().filter((e) => e.place.on === 'tile' && e.place.map === town).length
  go('meadow')
  for (let t = 0; t < 20; t++) eng.tick()
  const playedTickMs = time(() => eng.tick(), 100)
  go('overworld')
  for (let t = 0; t < 20; t++) eng.tick()
  const overworldTickMs = time(() => eng.tick(), 100)
  // the view a 1280×720 screen shows at the game's zoom (3: a cell is 48 pixels), round the player
  const at = w.posOf(w.player)!
  const view: FrameView = { map: 'overworld', x: at.x - 13, y: at.y - 8, w: 27, h: 16 }
  let frame = snapshot(eng)
  const overworldFrameChars = JSON.stringify(frame).length
  const overworldFrameMs = time(() => (frame = snapshot(eng, { view })), 20)
  const frames = new FrameEncoder()
  frames.encode(snapshot(eng, { view }))
  eng.tick()
  const sent = frames.encode(snapshot(eng, { view }))
  const overworldSentChars = JSON.stringify(sent).length
  let saveChars = 0
  let stateChars = 0
  const saveMs = time(() => {
    const save = game.save()
    saveChars = JSON.stringify(save).length
    stateChars = JSON.stringify(save.state).length
  })
  const all = Object.values(w.state.entities)
  return {
    maps: route.length,
    inMemory: Object.entries(w.state.chunks ?? {}).filter(([m, c]) => m !== ROSTER && !c.away).length,
    entities: all.length,
    people: all.filter((e) => e.npc).length,
    townTickMs,
    townPeople,
    playedTickMs,
    overworldTickMs,
    overworldFrameMs,
    overworldFrameChars,
    overworldSentChars,
    saveChars,
    stateChars,
    saveMs,
    enterMs: enter / route.length,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase()) {
  const keep = process.argv.includes('--keep-all') ? 1e9 : undefined
  const r = scaleRun({ keep })
  const f = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2))
  for (const [k, v] of Object.entries(r)) console.log(`${k.padEnd(20)} ${f(v)}`)
}
