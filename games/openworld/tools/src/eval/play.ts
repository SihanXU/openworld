// Model calls over play (paper §7.2, cost over play): scripted explorers play the world — they walk, travel between
// maps, and use things they carry (a bag of what the world places, a little of it changed every hour) on what is about them, hands on things, put things down and take them up — with
// nobody to ask, and the game's own mod port records every situation that fell undefined (its class, as the modder
// keys one question per situation). A situation answered once is answered for every later player, so the model is
// called once per situation the first time anyone reaches it: the calls in an hour are the situations first reached
// in it, by one player alone (a library of their own) or by all of them together (one shared library). No model.
//
//   npx tsx games/openworld/tools/src/eval/play.ts [--players 8] [--hours 20] [--out var/eval/play.json]

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Game, RuleLibrary, TICKS_PER_HOUR, type MapChunk } from '@openworld/engine'
import { BASE_RULES, FORMS, STORY_RULES, buildOntology, decodeChunk, wildChunkFor } from '@openworld-game/content'
import { buildFord } from '../demo/world.ts'

const argv = process.argv.slice(2)
const opt = (k: string, d: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)
const PLAYERS = Number(opt('players', '8'))
const HOURS = Number(opt('hours', '20'))
const out = opt('out', 'var/eval/play.json')

const world = buildFord()
const raw = new Map([...world.chunks, ...world.backdrop].map((c) => [c.map.id, c]))
const onto = buildOntology()
const PLAYED = world.chunks.map((c) => c.map.id).filter((id) => !['tutorial', 'offstage', 'overworld'].includes(id) && !id.startsWith('haven'))
const PLACES = world.backdrop.map((c) => c.map.id)
/** What an explorer comes by: the items the world places, as often as it places them (one entry each). */
const PLACED = [...world.chunks, ...world.backdrop].flatMap((c) => c.entities.filter((e) => e.type.startsWith('item/')).map((e) => e.type))
const KINDS = new Set(FORMS.map((f) => f.id))
const CARRY = PLACED.filter((t) => KINDS.has(t))
/** A bag of this many things, two of them changed every hour (what a player picks up, sells, uses up). */
const BAG = 10

function explorer(seed: number) {
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]
  const game = Game.create(world.index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
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
    for (const n of game.neededMaps()) game.loadChunk(chunkOf(n))
  }
  arrive(w.state.spawn.map)
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
  })
  const travel = () => {
    const to = rnd() < 0.5 ? pick(PLAYED) : pick(PLACES)
    arrive(to)
    const m = w.map(to)!
    for (let k = 0; k < 200; k++) {
      const x = Math.floor(rnd() * m.width), y = Math.floor(rnd() * m.height)
      if (w.fits(w.player, to, x, y)) {
        eng.author(() => eng.teleport(w.player, { map: to, x, y }))
        break
      }
    }
    game.trim()
  }
  travel()
  const bag = Array.from({ length: BAG }, () => pick(CARRY))
  let made = 0
  const acts = { use: 0, hands: 0, put: 0, take: 0 }
  for (let h = 0; h < HOURS; h++) {
    if (process.env.PLAY_DEBUG) console.log(`  [${seed}] hour ${h} on ${w.posOf(w.player)?.map} question ${!!w.state.question} scene ${!!w.scene} raised ${game.mods.records.length}`)
    if (h % 2 === 0 && h) travel()
    for (let k = 0; k < 2; k++) bag[Math.floor(rnd() * BAG)] = pick(CARRY)
    for (let t = 0; t < TICKS_PER_HOUR; t++) {
      if (t % 10 === 0 && rnd() < 0.6) eng.movePlayer(pick(['up', 'down', 'left', 'right'] as const), true)
      if (t % 30 === 15 && !w.state.question) {
        const at = w.posOf(w.player)
        if (at) {
          // what is about: things within two steps, else the ground before one
          const near = w.entitiesOnMap(at.map).filter((e) => e.id !== w.player.id && e.place.on === 'tile' && Math.abs((e.place as any).x - at.x) + Math.abs((e.place as any).y - at.y) <= 2)
          const target = near.length && rnd() < 0.8 ? { e: pick(near).id } : (w.cellRef(at.map, at.x, Math.max(0, at.y - 1)) as any)
          const r = rnd()
          try {
            if (r < 0.7) {
              // something carried, used on it
              const id = `carry.${made++}`
              eng.author(() => w.add({ id, type: pick(bag), place: { on: 'hand', holder: w.player.id } }))
              eng.act('use', w.player.id, target, { instrument: { e: id } })
              acts.use++
              const held = w.get(id)
              if (held && held.place.on === 'hand') eng.author(() => w.destroy(held))
            } else if (r < 0.85) (eng.act('hands', w.player.id, target), acts.hands++)
            else if (r < 0.93) (eng.act('take', w.player.id, target), acts.take++)
            else {
              const id = `carry.${made++}`
              eng.author(() => w.add({ id, type: pick(bag), place: { on: 'hand', holder: w.player.id } }))
              eng.act('put', w.player.id, target, { instrument: { e: id } })
              acts.put++
            }
          } catch {
            // an act the world refuses (out of reach, nothing there) is no situation
          }
        }
      }
      // a scene the story plays runs on as the headless playtest runs it (check.ts): the explorer is not held in it
      if (w.scene) eng.story.advance()
      eng.tick()
      for (const n of game.neededMaps()) arrive(n)
    }
  }
  // each situation's first hour, and how often it came up
  const first = new Map<string, number>()
  const times = new Map<string, number>()
  for (const r of game.mods.records) {
    const hour = Math.floor(r.tick / TICKS_PER_HOUR) - Math.floor(game.mods.records[0]?.tick / TICKS_PER_HOUR || 0)
    if (!first.has(r.signature)) first.set(r.signature, Math.max(0, hour))
    times.set(r.signature, (times.get(r.signature) ?? 0) + 1)
  }
  return { seed, acts, raised: game.mods.records.length, first, times }
}

const SEEDS = opt('seeds', '') ? opt('seeds', '').split(',').map(Number) : Array.from({ length: PLAYERS }, (_, i) => i + 1)
const runs = SEEDS.map((seed) => {
  const r = explorer(seed)
  console.log(`player ${seed}: ${Object.entries(r.acts).map(([k, v]) => `${k} ${v}`).join(', ')}; ${r.raised} undefined outcomes, ${r.first.size} situations`)
  return r
})
const perHour = (first: Map<string, number>) => Array.from({ length: HOURS }, (_, h) => [...first.values()].filter((x) => x === h).length)
const alone = runs.map((r) => perHour(r.first))
// one shared library: a situation is asked the first hour anyone reaches it
const shared = new Map<string, number>()
for (const r of runs) for (const [k, h] of r.first) shared.set(k, Math.min(shared.get(k) ?? Infinity, h))
const pooled = perHour(shared)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const aloneMean = Array.from({ length: HOURS }, (_, h) => +mean(alone.map((a) => a[h])).toFixed(1))
// how the situations are spread: how many came up once, and the share of all undefined outcomes the commonest tenth make
const counts = new Map<string, number>()
for (const r of runs) for (const [k, n] of r.times) counts.set(k, (counts.get(k) ?? 0) + n)
const sorted = [...counts.values()].sort((a, b) => b - a)
const total = sorted.reduce((a, b) => a + b, 0)
const top = sorted.slice(0, Math.ceil(sorted.length / 10)).reduce((a, b) => a + b, 0)
const result = {
  players: PLAYERS, hours: HOURS,
  callsPerHourAlone: aloneMean, callsPerHourShared: pooled,
  situations: { alone: +mean(runs.map((r) => r.first.size)).toFixed(1), shared: shared.size, onceOnly: sorted.filter((n) => n === 1).length, topTenthShare: +(top / total).toFixed(2), outcomes: total },
}
console.log(JSON.stringify(result))
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(result, null, 1))
