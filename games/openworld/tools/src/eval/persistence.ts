// Persistence and consistency (paper §7.2), adapting WHAM's protocol: change the state of a map, leave it for a game
// minute, an hour, a day or seven days (or save and load), come back, and compare what is there, thing by thing,
// with a run in which the map never went dormant. The world is walked as the game's worker walks it: the maps far
// behind put away, read again from their files on the way back, their timers and inbox caught up on entering. And
// determinism: the same new game and the same inputs, twice, hash for hash at every hour, also across a save.
// No model is called.
//
//   npx tsx games/openworld/tools/src/eval/persistence.ts [--days 1,7] [--out var/eval/persistence.json]

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Game, RuleLibrary, TICKS_PER_HOUR, TICKS_PER_MINUTE, type Entity, type MapChunk, type SaveData } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk, wildChunkFor } from '@openworld-game/content'
import { buildFord } from '../demo/world.ts'

const world = buildFord()
const raw = new Map([...world.chunks, ...world.backdrop].map((c) => [c.map.id, c]))
const onto = buildOntology()
const library = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
/** A map far from the played land: going there puts the probe's map away (game.keepMaps). */
const AWAY = world.backdrop.map((c) => c.map.id).find((id) => id.startsWith('holy.') && !id.includes('.', 5)) ?? 'overworld'

/** A game as the worker runs it: maps made or read when needed, the far ones put away. */
function boot(game = Game.create(world.index, onto, library())) {
  game.keepMaps = 8
  const eng = game.engine
  const w = eng.world
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
  const spot = (map: string) => {
    const m = w.map(map)!
    for (let r = 0; r < Math.max(m.width, m.height); r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (w.fits(w.player, map, Math.floor(m.width / 2) + dx, Math.floor(m.height / 2) + dy)) return { x: Math.floor(m.width / 2) + dx, y: Math.floor(m.height / 2) + dy }
    return { x: 1, y: 1 }
  }
  const go = (id: string) => {
    arrive(id)
    eng.author(() => eng.teleport(w.player, { map: id, ...spot(id) }))
    game.trim()
  }
  arrive(w.state.spawn.map)
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
  })
  return { game, eng, w, go, arrive }
}
type Run = ReturnType<typeof boot>

/** One change to a map's state, and the things to look at afterwards. */
interface Probe {
  name: string
  map: string
  change: (r: Run) => void
  /** what to compare of the changed thing(s) */
  look: (r: Run) => unknown
}
const firstOf = (r: Run, map: string, type: string) => r.w.entitiesOnMap(map).find((e) => e.type.startsWith(type))
const brief = (e: Entity | undefined) => (e ? { type: e.type, statuses: Object.keys(e.statuses ?? {}).sort(), place: e.place, props: e.props } : null)
const PROBES: Probe[] = [
  {
    name: 'place a thing',
    map: 'meadow',
    change: (r) => r.eng.author(() => r.w.add({ id: 'probe.stone', type: 'item/material/stone', place: { on: 'tile', map: 'meadow', x: 22, y: 18 } })),
    look: (r) => brief(r.w.get('probe.stone')),
  },
  {
    name: 'burn a fixture',
    map: 'meadow',
    change: (r) => r.eng.author(() => r.w.setStatus({ e: firstOf(r, 'meadow', 'fixture/container/woodpile')!.id }, 'burning', r.w.state.tick + 50 * TICKS_PER_MINUTE)),
    look: (r) => {
      const at = world.chunks.find((c) => c.map.id === 'meadow')!.entities.find((e) => e.type.startsWith('fixture/container/woodpile'))!.place as { x: number; y: number }
      return r.w.entitiesOnMap('meadow').filter((e) => e.place.on === 'tile' && Math.abs((e.place as any).x - at.x) <= 1 && Math.abs((e.place as any).y - at.y) <= 1 && !e.npc && e.id !== r.w.player.id).map(brief).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    },
  },
  {
    name: 'fell a creature',
    map: 'hollow',
    change: (r) => r.eng.author(() => r.w.destroy(firstOf(r, 'hollow', 'actor/creature')!)),
    look: (r) => r.w.entitiesOnMap('hollow').filter((e) => e.type.startsWith('actor/creature')).map((e) => e.type).sort(),
  },
  {
    name: 'give a person an item',
    map: 'meadow',
    change: (r) => r.eng.author(() => r.w.add({ id: 'probe.gift', type: 'item/food/bread', place: { on: 'inside', holder: 'npc.marta' } })),
    look: (r) => ({ gift: brief(r.w.get('probe.gift'))?.place ?? null }),
  },
  {
    name: 'plant a crop',
    map: 'meadow',
    change: (r) => r.eng.author(() => r.w.add({ id: 'probe.crop', type: 'fixture/crop/wheat/sprout', place: { on: 'tile', map: 'meadow', x: 22, y: 21 } })),
    look: (r) => {
      const e = r.w.get('probe.crop')
      return e ? { type: e.type, statuses: Object.keys(e.statuses ?? {}).sort() } : r.w.entitiesOnMap('meadow').filter((x) => x.place.on === 'tile' && (x.place as any).x === 22 && (x.place as any).y === 21).map((x) => x.type)
    },
  },
]

/** Everything on a map but the player, as compared: each thing's type, statuses and place; people apart. */
function mapState(r: Run, map: string): Map<string, string> {
  return new Map(r.w.entitiesOnMap(map).filter((e) => e.id !== r.w.player.id).map((e) => [e.id, JSON.stringify([e.type, Object.keys(e.statuses ?? {}).sort(), e.npc ? 'person' : e.place])]))
}

function trial(p: Probe, ticks: number, mode: 'stay' | 'away' | 'save') {
  let r = boot()
  r.go(p.map)
  for (let t = 0; t < 30; t++) r.eng.tick()
  p.change(r)
  if (mode === 'stay') for (let t = 0; t < ticks; t++) r.eng.tick()
  else if (mode === 'away') {
    r.go(AWAY)
    for (let t = 0; t < ticks; t++) r.eng.tick()
    r.go(p.map)
  } else {
    // saved where it stands, loaded into a new game, played on there
    const save: SaveData = JSON.parse(JSON.stringify(r.game.save()))
    r = boot(Game.load(save, world.index, onto, library()))
    r.arrive(p.map)
    for (let t = 0; t < ticks; t++) r.eng.tick()
  }
  r.eng.tick()
  return { look: p.look(r), state: mapState(r, p.map) }
}

function compare(a: ReturnType<typeof trial>, b: ReturnType<typeof trial>) {
  let people = 0
  let things = 0
  const differ: string[] = []
  for (const id of new Set([...a.state.keys(), ...b.state.keys()])) {
    const x = a.state.get(id), y = b.state.get(id)
    if (x === y) continue
    if ((x ?? y)!.includes('"person"')) people++
    else (things++, differ.length < 5 && differ.push(`${id}: ${x ?? 'absent'} / ${y ?? 'absent'}`))
  }
  return { same: JSON.stringify(a.look) === JSON.stringify(b.look), probed: [a.look, b.look], things, people, differ }
}

// ---------------------------------------------------------------- determinism

/**
 * The world as it stands where the player is: the clock, the dice, and every thing on the player's map or on none
 * (the story, the quests, what is carried). Which far maps happen to be kept in memory is the host's business, not the
 * world's (a loaded save keeps fewer), so it is left out.
 */
function hashOf(r: Run): string {
  const map = r.w.posOf(r.w.player)?.map
  // what is nowhere (the story, the quests, the residents) and what is on the player's map, whatever it holds
  const things = Object.values(r.w.state.entities).filter((e) => e.place.on === 'none' || r.w.posOf(e)?.map === map).sort((a, b) => a.id.localeCompare(b.id))
  return createHash('sha256').update(JSON.stringify([r.w.state.tick, r.w.state.rng, things])).digest('hex').slice(0, 16)
}
/** A new game played for `hours` with a seeded walk (a step every few ticks), hashed every hour; saved and loaded at `saveAt` hours. */
function session(seed: number, hours: number, saveAt?: number): string[] {
  let r = boot()
  r.go('meadow')
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const hashes: string[] = []
  for (let h = 0; h < hours; h++) {
    if (h === saveAt) {
      const save: SaveData = JSON.parse(JSON.stringify(r.game.save()))
      r = boot(Game.load(save, world.index, onto, library()))
      r.arrive(r.w.posOf(r.w.player)!.map)
    }
    // as the worker plays: a held direction every so often, a tick, the maps the player needs loaded and the far ones put away
    let dir: 'up' | 'down' | 'left' | 'right' | undefined
    for (let t = 0; t < TICKS_PER_HOUR; t++) {
      if (t % 20 === 0) dir = rnd() < 0.3 ? undefined : (['up', 'down', 'left', 'right'] as const)[Math.floor(rnd() * 4)]
      if (dir) r.eng.movePlayer(dir, true)
      r.eng.tick()
      for (const need of r.game.neededMaps()) r.arrive(need)
      if (t % 600 === 0) r.game.trim()
    }
    hashes.push(hashOf(r))
  }
  return hashes
}

const argv = process.argv.slice(2)
const opt = (k: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : undefined)
const out = opt('out') ?? 'var/eval/persistence.json'
const durations: [string, number][] = [['1 minute', TICKS_PER_MINUTE], ['1 hour', TICKS_PER_HOUR], ...(opt('days') ?? '1,7').split(',').map((d): [string, number] => [`${d} day${d === '1' ? '' : 's'}`, Number(d) * 24 * TICKS_PER_HOUR])]
const rows: Record<string, unknown>[] = []
if (!argv.includes('--determinism-only')) for (const p of PROBES)
  for (const [label, ticks] of durations) {
    const stay = trial(p, ticks, 'stay')
    const away = compare(stay, trial(p, ticks, 'away'))
    const saved = label === '1 hour' ? compare(stay, trial(p, ticks, 'save')) : undefined
    rows.push({ probe: p.name, after: label, away, saved })
    console.log(`${p.name.padEnd(22)} ${label.padEnd(9)} away: ${away.same ? 'same' : 'DIFFERS'} (things ${away.things}, people ${away.people})${saved ? `  saved: ${saved.same ? 'same' : 'DIFFERS'} (things ${saved.things}, people ${saved.people})` : ''}`)
    if (!away.same) console.log(`      ${JSON.stringify(away.probed).slice(0, 300)}`)
    for (const d of away.differ.slice(0, 2)) console.log(`      ${d.slice(0, 200)}`)
  }
const det: Record<string, unknown>[] = []
for (const seed of [1, 2, 3]) {
  const a = session(seed, 24)
  const b = session(seed, 24)
  const c = session(seed, 24, 12)
  const first = (x: string[]) => x.findIndex((h, i) => h !== a[i])
  det.push({ seed, hours: 24, replay: first(b) < 0 ? 'identical' : `differs from hour ${first(b) + 1}`, acrossSave: first(c) < 0 ? 'identical' : `differs from hour ${first(c) + 1}` })
  console.log(`determinism seed ${seed}: replay ${det.at(-1)!.replay}; across a save at hour 12: ${det.at(-1)!.acrossSave}`)
}
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ away: AWAY, probes: rows, determinism: det }, null, 1))
