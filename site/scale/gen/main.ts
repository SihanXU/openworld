// The scale film's maps and moments, made (npm run gen:world first):
//   the places built the showcase's way — its places, Firstlight, the Abbey, the Foot and the Summit — and their halls
//   and houses (each interior that stands on its plan's shell); those places again in winter, autumn and spring and on
//   a festival day (seasons.ts); the hall plans furnished anew for other uses (halls.ts); new hamlets of every region
//   in the showcase's buildings (places.ts). The made ones are written to
//   var/scale/promo/<id>.json for the trailer stage to load.
// Each map drawn as the game draws it and looked over for its telling windows (the most of what it has little of —
// roofs, stalls, water, furniture — and the most things and people), as many as do not overlap much: squares for the
// maps act's stills, wider ones for the scenes, each at an hour and in weather that suit it. The list goes to the
// stage's folder (scaleshots.json; ?film=scale-maps and ?film=scale-scenes film it).
//   npx tsx site/scale/gen/main.ts
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RawChunk } from '@openworld/engine'
import { loadGame } from '../../../games/openworld/wiki/src/game.ts'
import { renderMap } from '../../../games/openworld/wiki/src/render-map.ts'
import { decodePng, encodePng, type Image } from '../../../games/openworld/wiki/src/png.ts'
import { allHalls } from './halls.ts'
import { allPlaces } from './places.ts'
import { share, variant, type Variant } from './seasons.ts'
import { alike, signature } from '../likeness.mjs'

const PUB = 'games/openworld/public/world/maps'
const PROMO = 'var/scale/promo'
const OUT = 'games/openworld/client/src/trailer/scaleshots.json'
mkdirSync(PROMO, { recursive: true })
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }
const pick = <T,>(l: T[], s: string): T => l[Math.floor(hash(s) * l.length)]

// ------------------------------------------------------------------ the maps

const PLACES = ['holy.sunwell-abbey', 'holy.quarter-1', 'holy.quarter-2', 'holy.quarter-3', 'holy.quarter-4', 'holy.quarter-5', 'frostfang.rimeholm', 'redmarch.warcombe', 'tithe.weighmarket', 'palefen.dusk-moorings', 'altar.highheath-abbey', 'tithe.barleyridge-farm', 'redmarch.brandby-mine', 'altar.bellwick-farm', 'palefen.ashengate-ruins', 'frostfang.northmoor-cave', 'tithe.goldmere-tower', 'redmarch.scarwell-camp', 'frostfang.frostbarrow-camp', 'meadow', 'abbey', 'foot', 'summit']
interface Source { chunk: RawChunk; src?: string; family: string; inside: boolean; variant?: Variant }
const read = (id: string): RawChunk => JSON.parse(readFileSync(join(PUB, `${id}.json`), 'utf8'))
const sources: Source[] = []
for (const id of PLACES) {
  const c = read(id)
  sources.push({ chunk: c, family: id, inside: false })
  const vs: Variant[] = ['festival']
  if (share(c, ['snow', 'ice']) < 0.2) vs.push('winter')
  if (share(c, ['grass', 'flowers']) > 0.15) vs.push('autumn', 'spring')
  for (const v of vs) {
    const vc = variant(c, v)
    writeFileSync(join(PROMO, `${vc.map.id}.json`), JSON.stringify(vc))
    sources.push({ chunk: vc, src: `${vc.map.id}.json`, family: id, inside: false, variant: v })
  }
}
// the interiors that stand on their plans' shells (the halls, Firstlight's and the Road's houses)
for (const f of readdirSync(PUB)) {
  const c: RawChunk = JSON.parse(readFileSync(join(PUB, f), 'utf8'))
  if (c.map.kind !== 'interior' && c.map.kind !== 'dungeon') continue
  if (!(c.map.stamps ?? []).some((s: { key: string }) => /_shell@|^wall_|^nave_/.test(String(s.key)))) continue
  sources.push({ chunk: c, family: c.map.id, inside: true })
}
for (const m of allHalls()) {
  const c = m.chunk()
  writeFileSync(join(PROMO, `${c.map.id}.json`), JSON.stringify(c))
  sources.push({ chunk: c, src: `${c.map.id}.json`, family: c.map.id.split('.').slice(0, 3).join('.'), inside: true })
}
// new hamlets of every region, in the showcase's buildings (places.ts)
for (const m of allPlaces()) {
  const c = m.chunk()
  writeFileSync(join(PROMO, `${c.map.id}.json`), JSON.stringify(c))
  sources.push({ chunk: c, src: `${c.map.id}.json`, family: c.map.id, inside: false })
}
console.log(`${sources.length} maps (${sources.filter((s) => s.src).length} made)`)

// ------------------------------------------------------------------ their windows

const g = loadGame()
g.maps = sources.map(({ chunk: c }) => ({ kind: 'map', id: c.map.id, zh: '', en: c.map.id, title: '', group: c.map.kind, map: c.map, entities: c.entities })) as never

/** Per cell: the colours the map has little of, the things and people on it; the black round a hall against it. */
function cells(img: Image, c: RawChunk): { score: Float64Array; wc: number; hc: number } {
  const S = 16, wc = Math.floor(img.w / S), hc = Math.floor(img.h / S)
  const code = (i: number) => ((img.rgba[i] >> 5) << 6) | ((img.rgba[i + 1] >> 5) << 3) | (img.rgba[i + 2] >> 5)
  const freq = new Map<number, number>()
  for (let i = 0; i < img.rgba.length; i += 4) freq.set(code(i), (freq.get(code(i)) ?? 0) + 1)
  const score = new Float64Array(wc * hc), total = img.w * img.h
  for (let y = 0; y < hc * S; y++) for (let x = 0; x < wc * S; x++) {
    const i = (y * img.w + x) * 4, l = (img.rgba[i] + img.rgba[i + 1] + img.rgba[i + 2]) / 3
    score[Math.floor(y / S) * wc + Math.floor(x / S)] += (freq.get(code(i))! / total < 0.01 ? 1 : 0) - (l < 30 ? 2.5 : 0)
  }
  for (const e of c.entities as { type: string; place?: { on: string; x?: number; y?: number } }[]) {
    if (e.place?.on !== 'tile') continue
    const k = e.place.y! * wc + e.place.x!
    // (crops in their rows, flowers and leaves strewn are ground, not things: a field's strips tell little)
    if (k >= 0 && k < score.length) score[k] += e.type.startsWith('actor/person') ? 160 : /^fixture\/(crop|nature\/(flowers|leaves|tuft|reeds))/.test(e.type) ? 4 : e.type.startsWith('fixture/') ? 50 : 0
  }
  return { score, wc, hc }
}
/** How light a window is as drawn (its mean, 0–255): one too dark tells nothing in a small window. */
function light(img: Image, x0: number, y0: number, w: number, h: number): number {
  let t = 0, n = 0
  for (let y = y0 * 16; y < (y0 + h) * 16; y += 4) for (let x = x0 * 16; x < (x0 + w) * 16; x += 4) { const i = (y * img.w + x) * 4; t += img.rgba[i] + img.rgba[i + 1] + img.rgba[i + 2]; n += 3 }
  return t / Math.max(1, n)
}
/** The best windows of w x h cells, best first, none overlapping a chosen one by more than `overlap` of its cells. */
function windows(r: ReturnType<typeof cells>, w: number, h: number, most: number, overlap = 0.3, img?: Image): { x: number; y: number; s: number }[] {
  w = Math.min(w, r.wc); h = Math.min(h, r.hc)
  const ii = new Float64Array((r.wc + 1) * (r.hc + 1)), W1 = r.wc + 1
  for (let y = 0; y < r.hc; y++) for (let x = 0; x < r.wc; x++) ii[(y + 1) * W1 + x + 1] = r.score[y * r.wc + x] + ii[y * W1 + x + 1] + ii[(y + 1) * W1 + x] - ii[y * W1 + x]
  const all: { x: number; y: number; s: number }[] = []
  for (let y = 0; y + h <= r.hc; y++) for (let x = 0; x + w <= r.wc; x++) all.push({ x, y, s: ii[(y + h) * W1 + x + w] - ii[y * W1 + x + w] - ii[(y + h) * W1 + x] + ii[y * W1 + x] })
  all.sort((a, b) => b.s - a.s)
  const out: { x: number; y: number; s: number }[] = []
  for (const c of all) {
    if (out.length >= most || c.s < all[0].s * 0.45) break
    if (img && light(img, c.x, c.y, w, h) < 70) continue
    if (out.some((o) => (Math.max(0, Math.min(o.x + w, c.x + w) - Math.max(o.x, c.x)) * Math.max(0, Math.min(o.y + h, c.y + h) - Math.max(o.y, c.y))) / (w * h) > overlap)) continue
    out.push(c)
  }
  return out
}

// the hours and the weather by what a map is: the places by day and into the night, winter grey, autumn in its low
// sun, the festivals at dusk and after; a hall by day or by its candles
const HOURS: Record<string, number[]> = { place: [7, 9.5, 12, 14.5, 17, 18.6, 20.5, 22], winter: [9, 11.5, 14, 16.5, 21], spring: [7, 9, 11, 15, 18], autumn: [8, 10.5, 16, 17.6, 18.8], festival: [18.8, 20, 21.5, 23], hall: [10, 13, 16, 20.5, 22.5] }
/** The maps act's stills keep to the light: the day, its gold at evening, the festivals' lanterns at dusk. */
const STILL_HOURS: Record<string, number[]> = { place: [8, 10, 12, 14.5, 16.5, 18], winter: [10, 12, 14.5], spring: [8, 11, 15], autumn: [9, 16, 17.5], festival: [18.8, 19.6], hall: [11, 15, 20.5] }
const WEATHER: Record<string, string[]> = { place: ['sun', 'sun', 'sun', 'cloud', 'rain', 'fog', 'storm', 'sun'], winter: ['cloud', 'fog', 'cloud', 'sun'], spring: ['sun', 'sun', 'rain', 'cloud'], autumn: ['sun', 'fog', 'rain', 'sun'], festival: ['sun', 'sun', 'cloud'], hall: ['sun'] }

type Shot = { id: string; map: string; src?: string; family: string; variant?: string; inside: boolean; region?: string; x: number; y: number; w: number; h: number; hour: number; weather: string; stand: [number, number]; also: string[] }
// the files a world map's people are kept in, when not its own (a hall's, in its place's)
const keptIn = new Map<string, Set<string>>()
for (const f of readdirSync(PUB)) {
  const c: RawChunk = JSON.parse(readFileSync(join(PUB, f), 'utf8'))
  for (const e of c.entities as { type: string; place?: { on: string; map?: string } }[]) if (e.type.startsWith('actor/person') && e.place?.on === 'tile' && e.place.map && e.place.map !== c.map.id) keptIn.set(e.place.map, (keptIn.get(e.place.map) ?? new Set()).add(c.map.id))
}
const alsoOf = (id: string) => [...(keptIn.get(id) ?? [])]
const stills: Shot[] = [], scenes: Shot[] = []
// each window as drawn (var/scale/windows): what decides which are alike, and a look before the stage films them
const WIN = 'var/scale/windows'
mkdirSync(WIN, { recursive: true })
const crop = (img: Image, x: number, y: number, w: number, h: number) => { const o = new Uint8Array(w * 16 * h * 16 * 4); for (let j = 0; j < h * 16; j++) o.set(img.rgba.subarray(((y * 16 + j) * img.w + x * 16) * 4, ((y * 16 + j) * img.w + (x + w) * 16) * 4), j * w * 16 * 4); return encodePng(w * 16, h * 16, o) }
const t0 = Date.now()
for (const s of sources) {
  const c = s.chunk, id = c.map.id
  let img: Image
  try { img = decodePng(renderMap(g, id, 1).png) } catch (e) { console.warn('cannot draw', id, (e as Error).message); continue }
  const r = cells(img, c)
  const area = c.map.width * c.map.height
  const sort = s.inside ? 'hall' : s.variant ?? 'place'
  // stills: squares of twelve cells outside, eleven inside (the room as a picture); scenes 16 x 9 outside, 14 x 8 inside;
  // a hall's windows two at most and apart (its walls and its rows of things are much the same along it)
  const [sw, vw, vh] = s.inside ? [11, 14, 8] : [12, 16, 9]
  const most = s.inside ? 2 : s.variant ? Math.min(18, Math.round(area / 350)) : Math.min(36, Math.round(area / 220))
  const apart = s.inside ? 0.12 : 0.3
  const far = (x: number, y: number): [number, number] => [x < c.map.width / 2 ? c.map.width - 2 : 1, y < c.map.height / 2 ? c.map.height - 2 : 1]
  windows(r, sw, sw, most, apart, img).forEach((w, k) => {
    const key = `${id}#${k}`
    writeFileSync(join(WIN, `m${stills.length}.png`), crop(img, w.x, w.y, Math.min(sw, r.wc), Math.min(sw, r.hc)))
    stills.push({ id: `m:${key}`, map: id, src: s.src, family: s.family, variant: s.variant, inside: s.inside, region: c.map.region, x: w.x + Math.min(sw, r.wc) / 2, y: w.y + Math.min(sw, r.hc) / 2, w: Math.min(sw, r.wc), h: Math.min(sw, r.hc), hour: pick(STILL_HOURS[sort], key + 'h'), weather: s.inside ? 'sun' : pick(WEATHER[sort], key + 'w'), stand: far(w.x, w.y), also: alsoOf(id) })
  })
  // scenes: twice as many windows, each at an hour of its own
  windows(r, vw, vh, s.inside ? 2 : most * 2, s.inside ? 0.15 : 0.4, img).forEach((w, k) => {
    const key = `${id}@${k}`
    writeFileSync(join(WIN, `s${scenes.length}.png`), crop(img, w.x, w.y, Math.min(vw, r.wc), Math.min(vh, r.hc)))
    scenes.push({ id: `s:${key}`, map: id, src: s.src, family: s.family, variant: s.variant, inside: s.inside, region: c.map.region, x: w.x + Math.min(vw, r.wc) / 2, y: w.y + Math.min(vh, r.hc) / 2, w: Math.min(vw, r.wc), h: Math.min(vh, r.hc), hour: pick(HOURS[sort], key + 'h'), weather: s.inside ? 'sun' : pick(WEATHER[sort], key + 'w'), stand: far(w.x, w.y), also: alsoOf(id) })
  })
}
// none like another as drawn (likeness.mjs): a window in the same place's season that changed nothing in it, a hall
// furnished alike, is let go — the same view in other light is still the same view
const distinct = (l: Shot[], tag: string) => {
  const kept: { sig: ReturnType<typeof signature> }[] = []
  return l.filter((_, i) => { const sig = signature(join(WIN, `${tag}${i}.png`)); if (kept.some((k) => alike(k.sig, sig))) return false; kept.push({ sig }); return true })
}
const keptStills = distinct(stills, 'm'), keptScenes = distinct(scenes, 's')
console.log(`alike let go: ${stills.length - keptStills.length} stills, ${scenes.length - keptScenes.length} scenes`)
writeFileSync(OUT, JSON.stringify({ stills: keptStills, scenes: keptScenes }))
console.log(`${keptStills.length} stills, ${keptScenes.length} scenes → ${OUT} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
