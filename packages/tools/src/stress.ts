// Stress test at full scale: load EVERY map chunk into one engine, simulate game-hours,
// walk the player through portals, and check invariants + timing.
//
//   npx tsx packages/tools/src/stress.ts [hours]

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Game, RuleLibrary, snapshot, type WorldIndex } from '@lsw/engine'
import { BASE_RULES, buildOntology, decodeChunk, type RawChunk } from '@lsw/content'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../client/public/world-saenvar')
const hours = Number(process.argv[2] ?? 6)

const t0 = performance.now()
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')) as WorldIndex
const game = Game.create(index, buildOntology(), new RuleLibrary(BASE_RULES))
const eng = game.engine
for (const m of index.maps) {
  const raw = JSON.parse(readFileSync(join(DIR, 'maps', `${m.id}.json`), 'utf8')) as RawChunk
  game.loadChunk(decodeChunk(raw))
}
const tLoad = performance.now() - t0
const w = eng.world
const count = (p: string) => Object.values(w.state.entities).filter((e) => e.type.startsWith(p)).length
console.log(`loaded ${index.maps.length} maps in ${tLoad.toFixed(0)} ms: ${Object.keys(w.state.entities).length} entities (${count('actor/person')} people, ${count('actor/creature')} creatures, ${count('item/')} items, ${count('fixture/')} fixtures)`)

// invariants
function check(label: string) {
  let bad = 0
  for (const e of Object.values(w.state.entities)) {
    const p = e.place
    if (p.on === 'inside') {
      const h = w.get(p.holder)
      if (!h || !h.contents?.includes(e.id)) bad++
    } else if (p.on === 'hand') {
      const h = w.get(p.holder)
      if (!h || h.held !== e.id) bad++
    } else if (p.on === 'tile') {
      if (!w.entitiesAt(p.map, p.x, p.y).includes(e)) bad++
    }
  }
  console.log(`[${label}] placement invariant violations: ${bad}`)
  if (bad) process.exitCode = 1
}
check('after load')

// simulate with the player standing in the capital, then touring through portals
const hub = 'crownlands.hub'
eng.teleport(w.player, { map: hub, x: 48, y: 36 })
const ticks = hours * 600
let worst = 0
let total = 0
let moved = 0
const npcPos = new Map<string, string>()
for (const e of w.entitiesOnMap(hub)) if (e.npc && e.place.on === 'tile') npcPos.set(e.id, `${e.place.x},${e.place.y}`)
for (let i = 0; i < ticks; i++) {
  const a = performance.now()
  eng.tick()
  snapshot(eng)
  const dt = performance.now() - a
  total += dt
  worst = Math.max(worst, dt)
}
for (const e of w.entitiesOnMap(hub)) if (e.npc && e.place.on === 'tile' && npcPos.get(e.id) !== `${e.place.x},${e.place.y}`) moved++
console.log(`simulated ${hours} game-hours (${ticks} ticks) in ${hub}: ${(total / ticks).toFixed(3)} ms/tick avg, ${worst.toFixed(1)} ms worst; ${w.entitiesOnMap(hub).filter((e) => e.npc).length} NPCs on map now, ${moved} of the original moved`)

// portal tour: step onto portals of successive maps
let hops = 0
let cur = hub
const seen = new Set<string>([cur])
for (let k = 0; k < 40; k++) {
  const m = w.map(cur)!
  const p = m.portals.find((q) => !seen.has(q.to)) ?? m.portals[0]
  if (!p) break
  // stand next to the portal and step in
  const dirs: [number, number, 'up' | 'down' | 'left' | 'right'][] = [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]
  let entered = false
  for (const [dx, dy, d] of dirs) {
    if (!w.walkable(cur, p.x + dx, p.y + dy, w.state.player)) continue
    w.place(w.player, { on: 'tile', map: cur, x: p.x + dx, y: p.y + dy })
    eng.step(w.player, d)
    if (w.posOf(w.player)!.map !== cur) {
      entered = true
      break
    }
  }
  if (!entered) {
    if (k < 3) console.log('  could not enter', p, 'player', w.posOf(w.player), 'busy', eng.busy(w.player), 'statuses', w.player.statuses)
    continue
  }
  cur = w.posOf(w.player)!.map
  seen.add(cur)
  hops++
  for (let i = 0; i < 50; i++) eng.tick()
}
console.log(`portal tour: ${hops} hops across ${seen.size} maps`)
check('after simulation')

// the undefined-interaction path at scale
const nearby = w.entitiesOnMap(cur).find((e) => e.ai || e.npc)
if (nearby) {
  const before = game.mods.records.length
  const rope = w.create('item/tool/rope', { on: 'hand', holder: w.state.player })
  const r = eng.interact('interact', w.state.player, { e: nearby.id })
  console.log(`interact rope → ${nearby.type}: ${r.defined ? `defined by ${r.rule?.id}` : 'UNDEFINED → Mod port'} (records ${before} → ${game.mods.records.length})`)
  w.destroy(rope)
}
const json = JSON.stringify(game.save())
console.log(`save size: ${(json.length / 1e6).toFixed(1)} MB (all maps loaded)`)
