// The scale film's "no picture twice", checked on what the page shows: every map's tile cut from maps.webp, a frame of
// every scene cut from its sheet, each pair compared — how alike they look (likeness.mjs) and whether they are one view
// of one place (views.mjs). Prints the closest pairs; fails if any are alike or one view.
//   node site/scale/alike.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { alike, distance, signature } from './likeness.mjs'
import { sameView } from './views.mjs'

const A = 'site/scale/assets'
const maps = JSON.parse(readFileSync(join(A, 'maps.json'), 'utf8'))
const clips = JSON.parse(readFileSync(join(A, 'clips/clips.json'), 'utf8'))
const sigs = (items) => items.map((it) => ({ ...it, sig: signature(it.file, it.crop) }))
const mapSigs = sigs(maps.maps.map((m, k) => ({ id: m.id, comp: m.comp, rect: m.rect, file: join(A, 'maps.webp'), crop: [(k % maps.cols) * maps.size, Math.floor(k / maps.cols) * maps.size, maps.size, maps.size] })))
// the middle frame of each scene
const clipSigs = sigs(clips.map((c) => { const f = Math.floor(c.frames / 2); return { id: c.id, comp: c.comp, rect: c.rect, file: join(A, 'clips', c.sheet), crop: [(f % c.cols) * c.w, c.y + Math.floor(f / c.cols) * c.h, c.w, c.h] } }))
let bad = 0
for (const [name, l] of [['maps', mapSigs], ['scenes', clipSigs]]) {
  const pairs = []
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const d = distance(l[i].sig, l[j].sig); pairs.push({ a: l[i].id, b: l[j].id, ...d, alike: alike(l[i].sig, l[j].sig) || sameView(l[i], l[j]) }) }
  const twins = pairs.filter((p) => p.alike)
  pairs.sort((x, y) => x.bits / 40 + x.colour / 12 - (y.bits / 40 + y.colour / 12))
  console.log(`${name}: ${l.length}, ${twins.length} alike; closest:`)
  for (const p of pairs.slice(0, 5)) console.log(`  ${p.bits} bits, colour ${p.colour.toFixed(1)}  ${p.a}  ${p.b}`)
  bad += twins.length
}
process.exit(bad ? 1 : 0)
