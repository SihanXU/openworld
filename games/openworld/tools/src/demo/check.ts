// A headless playtest of the Ford: two game days with nobody at the keys. Checks that the people
// keep their days (within a few tiles of where their schedule says) — those on the active map or bound
// for it; a dormant map is frozen, its people placed by their schedules when it is entered (D21) — prints what the world did by
// itself (the storm, the night, the requests it would have asked), and a few lines to read.
//
//   npx tsx games/openworld/tools/src/demo/check.ts

import { Game, RuleLibrary, TICKS_PER_HOUR, chooseLine, scheduleAt, scheduleFor } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from './world.ts'

const { index, chunks } = buildFord()
const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
for (const c of chunks) game.loadChunk(decodeChunk(c))
const eng = game.engine
const w = eng.world
// nobody at the keys, standing in Firstlight Village, where most people live: theirs is the active map
eng.author(() => eng.teleport(w.player, { map: 'meadow', x: 20, y: 14 }))
let off = 0
let total = 0
/** Everyone, the dormant maps' frozen people too (the measure before W9). */
let offAll = 0
let totalAll = 0
const report: Record<string, number> = {}
const kinds: Record<string, number> = {}
const dispatch = eng.dispatch.bind(eng)
eng.dispatch = (ev) => ((kinds[ev.kind] = (kinds[ev.kind] ?? 0) + 1), dispatch(ev))
for (let t = 0; t < TICKS_PER_HOUR * 48; t++) {
  if (w.scene) eng.story.advance()
  eng.tick()
  // measured at the end of each hour: people have had the hour to get where their day says
  if (w.state.tick % TICKS_PER_HOUR === TICKS_PER_HOUR - 1) {
    for (const n of index.npcs) {
      const e = w.get(n.id)!
      const s = scheduleAt(scheduleFor(eng, e), w.hour())
      const p = w.posOf(e)
      // an hour with a threat at hand (or flat on the ground, or held in the cells) is not the schedule's to keep
      const threatened = w.entitiesOnMap(p?.map ?? '').some((o) => o.place.on === 'tile' && p && eng.hostileTo(o, e) && Math.abs(o.place.x - p.x) + Math.abs(o.place.y - p.y) <= 6)
      if (threatened || w.hasStatus({ e: e.id }, 'down') || w.hasStatus({ e: e.id }, 'jailed')) continue
      const away = !s || !p || p.map !== s.map || Math.abs(p.x - s.x) + Math.abs(p.y - s.y) > 3
      totalAll++
      if (away) offAll++
      if (p?.map !== eng.activeMap && s?.map !== eng.activeMap) continue
      total++
      if (away) (off++, (report[n.id] = (report[n.id] ?? 0) + 1), process.env.CHECK_VERBOSE && console.log(n.id, Math.floor(w.hour()), s?.activity, s && [s.x, s.y], p && [p.x, p.y], w.calendar().weather))
    }
  }
}
console.log(`day ${w.calendar().day} ${Math.floor(w.hour())}h · off-schedule ${off}/${total} (on or bound for the active map; everyone: ${offAll}/${totalAll})`, report)
console.log('events', kinds)
console.log('the world would have asked:', game.mods.records.map((r) => `${r.origin}: ${r.request.summary}`))
for (const id of ['npc.hesper', 'npc.tobin']) {
  const e = w.get(id)!
  const a = chooseLine(eng, e)
  const b = chooseLine(eng, e)
  console.log(id, '|', a?.key, '|', JSON.stringify(a?.text), '\n   ', b?.key, '|', JSON.stringify(b?.text))
}
if (off > total * 0.05) process.exitCode = 1
