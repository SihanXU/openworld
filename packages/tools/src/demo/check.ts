// A headless playtest of the Ford: two game days with nobody at the keys. Checks that the people
// keep their days (within a few tiles of where their schedule says), prints what the world did by
// itself (the storm, the night, the requests it would have asked), and a few lines to read.
//
//   npx tsx packages/tools/src/demo/check.ts

import { Game, RuleLibrary, TICKS_PER_HOUR, chooseLine, scheduleAt, scheduleFor } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from './world.ts'

const { index, chunks } = buildFord()
const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
for (const c of chunks) game.loadChunk(decodeChunk(c))
const eng = game.engine
const w = eng.world
let off = 0
let total = 0
const report: Record<string, number> = {}
const kinds: Record<string, number> = {}
const dispatch = eng.dispatch.bind(eng)
eng.dispatch = (ev) => ((kinds[ev.kind] = (kinds[ev.kind] ?? 0) + 1), dispatch(ev))
for (let t = 0; t < TICKS_PER_HOUR * 48; t++) {
  if (w.scene) eng.scenes.advance()
  eng.tick()
  // measured at the end of each hour: people have had the hour to get where their day says
  if (w.state.tick % TICKS_PER_HOUR === TICKS_PER_HOUR - 1) {
    for (const n of index.npcs) {
      const e = w.get(n.id)!
      const s = scheduleAt(scheduleFor(eng, e), w.hour())
      const p = w.posOf(e)
      // an hour with a threat at hand (or flat on the ground) is not the schedule's to keep
      const threatened = w.entitiesOnMap(p?.map ?? '').some((o) => o.place.on === 'tile' && p && eng.hostileTo(o, e) && Math.abs(o.place.x - p.x) + Math.abs(o.place.y - p.y) <= 6)
      if (threatened || w.hasStatus({ e: e.id }, 'down')) continue
      total++
      if (!s || !p || p.map !== s.map || Math.abs(p.x - s.x) + Math.abs(p.y - s.y) > 3) (off++, (report[n.id] = (report[n.id] ?? 0) + 1), process.env.CHECK_VERBOSE && console.log(n.id, Math.floor(w.hour()), s?.activity, s && [s.x, s.y], p && [p.x, p.y], w.calendar().weather))
    }
  }
}
console.log(`day ${w.calendar().day} ${Math.floor(w.hour())}h · off-schedule ${off}/${total}`, report)
console.log('events', kinds)
console.log('the world would have asked:', game.mods.records.map((r) => `${r.origin}: ${r.request.summary}`))
for (const id of ['npc.hesper', 'npc.tobin']) {
  const e = w.get(id)!
  const a = chooseLine(eng, e)
  const b = chooseLine(eng, e)
  console.log(id, '|', a?.key, '|', JSON.stringify(a?.text), '\n   ', b?.key, '|', JSON.stringify(b?.text))
}
if (off > total * 0.05) process.exitCode = 1
