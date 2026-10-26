// npx tsx games/openworld/wiki/src/render-showcase.ts <out dir> [scale] [map id prefix…]
// Draws the showcase's maps (docs/showcase.md; backdrop maps, which the wiki itself never draws) as the game draws them
// (render-map.ts), from the world's files, for review: the place, its halls and rooms.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGame } from './game.ts'
import { renderMap } from './render-map.ts'

const out = process.argv[2] ?? '/tmp/showcase-maps'
const scale = Number(process.argv[3] ?? 1) || 1
const prefixes = process.argv.slice(4).length ? process.argv.slice(4) : ['holy.sunwell-abbey', 'holy.quarter-1', 'holy.quarter-2', 'holy.quarter-3', 'holy.quarter-4', 'holy.quarter-5']
mkdirSync(out, { recursive: true })
const g = loadGame()
const dir = fileURLToPath(new URL('../../public/world/maps/', import.meta.url))
for (const f of readdirSync(dir)) {
  const id = f.replace(/\.json$/, '')
  const place = prefixes.find((p) => id === p || id.startsWith(p + '.'))
  if (!place) continue
  // (the rooms behind the houses' doors only when asked)
  if (id !== place && /-\d+$/.test(id) && !process.env.ROOMS) continue
  const chunk = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  if (!g.maps.some((m) => m.id === id)) (g.maps as unknown[]).push({ id, map: chunk.map, en: chunk.map.name.en, zh: chunk.map.name.zh, chunk, entities: chunk.entities })
  try {
    const r = renderMap(g, id, scale)
    writeFileSync(join(out, `${id}.png`), r.png)
    console.log(id, `${r.w}x${r.h}`)
  } catch (e) {
    console.error(id, (e as Error).message)
  }
}
