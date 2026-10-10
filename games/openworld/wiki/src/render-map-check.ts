// npx tsx games/openworld/wiki/src/render-map-check.ts [scale]
// Draws every map of the game (render-map.ts) into <tmp>/openworld-maps/<id>.png, with each one's size and
// time; exits 1 if any fails.

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadGame } from './game.ts'
import { renderMap } from './render-map.ts'

const scale = Number(process.argv[2] ?? 1) || 1
const out = join(tmpdir(), 'openworld-maps')
mkdirSync(out, { recursive: true })
const t0 = Date.now()
const g = loadGame()
console.log(`game loaded (${Date.now() - t0} ms)`)
const t1 = Date.now()
let failed = 0
for (const m of g.maps) {
  const t = Date.now()
  try {
    const r = renderMap(g, m.id, scale)
    writeFileSync(join(out, `${m.id}.png`), r.png)
    console.log(`${m.id.padEnd(12)} ${m.zh.padEnd(8, '　')} ${`${r.w}x${r.h}`.padEnd(10)} ${String(Math.round(r.png.length / 1024)).padStart(5)} KB ${String(Date.now() - t).padStart(5)} ms`)
  } catch (e) {
    failed++
    console.error(`${m.id}: ${(e as Error).stack ?? e}`)
  }
}
console.log(`${g.maps.length - failed}/${g.maps.length} maps in ${Date.now() - t1} ms → ${out}`)
if (failed) process.exitCode = 1
