// The showcase places drawn whole with their cells numbered every five, to choose where the page's films look from.
// npx tsx site/tools/survey-places.ts <outDir> [map …]   (development only; reads games/openworld/public/world)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadGame } from '../../games/openworld/wiki/src/game.ts'
import { renderMap } from '../../games/openworld/wiki/src/render-map.ts'

const [OUT, ...ONLY] = process.argv.slice(2)
const PUB = 'games/openworld/public/world'
const PLACES = ONLY.length ? ONLY : [
  'frostfang.rimeholm', 'redmarch.warcombe', 'tithe.weighmarket', 'palefen.dusk-moorings', 'altar.highheath-abbey',
  'tithe.barleyridge-farm', 'redmarch.brandby-mine', 'altar.bellwick-farm', 'palefen.ashengate-ruins', 'frostfang.northmoor-cave',
  'tithe.goldmere-tower', 'redmarch.scarwell-camp', 'frostfang.frostbarrow-camp',
]
mkdirSync(OUT, { recursive: true })
const g = loadGame()
g.maps = PLACES.map((id) => {
  const c = JSON.parse(readFileSync(join(PUB, 'maps', `${id}.json`), 'utf8'))
  return { kind: 'map', id, zh: '', en: id, title: '', group: c.map.kind, map: c.map, entities: c.entities }
}) as never
for (const id of PLACES) {
  const { w, h, png } = renderMap(g, id, 1)
  writeFileSync(join(OUT, `${id}.png`), png)
  console.log(id, w, h)
}
