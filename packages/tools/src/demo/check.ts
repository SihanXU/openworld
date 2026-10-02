// A headless playtest of the generated Hearthvale: two game days with every map loaded; checks
// that the people keep their schedules (and prints a few of their lines to read).
//
//   npx tsx packages/tools/src/demo/check.ts

import { readFileSync } from 'node:fs'
import { chooseLine, Game, RuleLibrary, scheduleFor, TICKS_PER_HOUR, type WorldIndex } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk, type RawChunk } from '@lsw/content'
const dir = 'packages/client/public/world/'
const index = JSON.parse(readFileSync(dir + 'index.json', 'utf8')) as WorldIndex
const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
for (const m of index.maps) game.loadChunk(decodeChunk(JSON.parse(readFileSync(dir + `maps/${m.id}.json`, 'utf8')) as RawChunk))
const eng = game.engine
const w = eng.world
let off = 0
let total = 0
const report: Record<string, number> = {}
for (let t = 0; t < TICKS_PER_HOUR * 48; t++) {
  if (w.state.scene) eng.scenes.advance()
  eng.tick()
  if (t % (TICKS_PER_HOUR) === TICKS_PER_HOUR - 1) {
    const cal = w.calendar()
    for (const n of index.npcs) {
      const e = w.get(n.id)!
      const s = scheduleFor(eng, e, cal).find((s) => (s.from <= s.to ? cal.hour >= s.from && cal.hour < s.to : cal.hour >= s.from || cal.hour < s.to))
      const p = w.posOf(e)
      total++
      if (!s || !p || p.map !== s.map || Math.abs(p.x - s.x) + Math.abs(p.y - s.y) > 3) { off++; report[n.id] = (report[n.id] ?? 0) + 1 }
    }
  }
}
console.log(`day ${w.calendar().day} ${Math.floor(w.calendar().hour)}h · off-schedule ${off}/${total}`, report, 'facts', w.state.facts)
for (const id of ['npc.hollis', 'npc.pip', 'npc.oda', 'npc.fenn', 'npc.wren', 'npc.brann']) {
  const e = w.get(id)!
  const a = chooseLine(eng, e)
  const b = chooseLine(eng, e)
  console.log(id, '|', a?.key, '|', JSON.stringify(a?.text), '\n   ', b?.key, '|', JSON.stringify(b?.text))
}
if (off > total * 0.02) process.exitCode = 1
