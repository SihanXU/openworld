// The scale film's material, drawn by the game's own code (npm run gen:world first):
//   maps.png      every map (the hand-made and the backdrop's), as the game draws it, cut to a square, 64 x 64 each
//   lead.png      the map the film opens on (Firstlight), whole, at the game's own size
//   big.jpg       the places it splits into first (the showcase's and the hand-made country by turns), 256 x 256 each
//   people.png    every person's map figure from their look, walking toward us (4 frames) and standing, 24 x 36 each
//   faces.png     some of them as the dialogue shows them: the cast's own portraits first, then others' busts, 128 x 128 each
//   items.png     every item picture in the catalogue, in a 24 x 24 cell each
// with a .json beside each saying what is where.  npx tsx site/scale/assets.ts
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Look } from '@openworld/engine'
import { generateLook } from '@openworld-game/content'
import { loadGame } from '../../games/openworld/wiki/src/game.ts'
import { renderMap } from '../../games/openworld/wiki/src/render-map.ts'
import { CATALOG } from '../../games/openworld/wiki/src/bundle.ts'
import { decodePng, encodePng, type Image } from '../../games/openworld/wiki/src/png.ts'
import { FH, FW, IDLE_ROW, composeSprite } from '../../packages/runtime/src/assets/figure/sprite.ts'
import { composePortrait } from '../../packages/runtime/src/assets/figure/portrait.ts'
import { bustOf, layerFromDisk, loadManifest, peopleLooks } from '../../games/openworld/tools/src/art/looks/review.ts'

const OUT = 'site/scale/assets'
const PUB = 'games/openworld/public'
mkdirSync(OUT, { recursive: true })

/** An empty RGBA canvas and a way to put pixels in it. */
function sheet(w: number, h: number) {
  const rgba = new Uint8Array(w * h * 4)
  return {
    rgba,
    put(src: Uint8Array | Uint8ClampedArray, sw: number, sx: number, sy: number, cw: number, ch: number, dx: number, dy: number) {
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const i = ((sy + y) * sw + sx + x) * 4, o = ((dy + y) * w + dx + x) * 4
        if (dy + y < 0 || dy + y >= h || dx + x < 0 || dx + x >= w || !src[i + 3]) continue
        rgba.set(src.subarray(i, i + 4), o)
      }
    },
    save(name: string) { writeFileSync(join(OUT, name), encodePng(w, h, rgba)) },
  }
}

/** A picture cut to its middle square and brought down to `size` (each output pixel the average of what it covers). */
function square(img: Image, size: number): Uint8Array {
  const s = Math.min(img.w, img.h), ox = Math.floor((img.w - s) / 2), oy = Math.floor((img.h - s) / 2)
  const out = new Uint8Array(size * size * 4)
  const k = s / size
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, n = 0
    for (let yy = Math.floor(y * k); yy < Math.floor((y + 1) * k); yy++) for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) {
      const i = ((oy + yy) * img.w + ox + xx) * 4
      r += img.rgba[i]; g += img.rgba[i + 1]; b += img.rgba[i + 2]; n++
    }
    out.set([r / n, g / n, b / n, 255], (y * size + x) * 4)
  }
  return out
}

// ------------------------------------------------------------------ maps

const files = readdirSync(join(PUB, 'world/maps')).filter((f) => f.endsWith('.json') && f !== 'overworld.json' && f !== 'offstage.json')
const index = JSON.parse(readFileSync(join(PUB, 'world/index.json'), 'utf8'))
const info = new Map(index.maps.map((m: { id: string }) => [m.id, m]))
const g = loadGame()
const chunks = files.map((f) => JSON.parse(readFileSync(join(PUB, 'world/maps', f), 'utf8')))
// every map, the backdrop's too, where the renderer looks for them
g.maps = chunks.map((c) => ({ kind: 'map', id: c.map.id, zh: '', en: c.map.id, title: '', group: c.map.kind, map: c.map, entities: c.entities })) as never
// what the film shows first as the one map splits, in this order: the showcase places (docs/showcase.md) and the
// hand-made country by turns
const SHOWCASE = ['holy.quarter-2', 'holy.sunwell-abbey', 'frostfang.rimeholm', 'holy.quarter-3', 'redmarch.warcombe', 'tithe.weighmarket', 'holy.quarter-1', 'palefen.dusk-moorings', 'altar.highheath-abbey', 'holy.quarter-4', 'tithe.barleyridge-farm', 'redmarch.brandby-mine', 'holy.quarter-5', 'altar.bellwick-farm', 'palefen.ashengate-ruins', 'frostfang.northmoor-cave', 'tithe.goldmere-tower', 'redmarch.scarwell-camp', 'frostfang.frostbarrow-camp']
const LEAD = 'meadow'
const handMade = index.maps.filter((m: { id: string; backdrop?: boolean; kind: string }) => !m.backdrop && ['wild', 'village', 'field'].includes(m.kind) && m.id !== LEAD && m.id !== 'tutorial' && m.id !== 'offstage').map((m: { id: string }) => m.id)
const SHOWN: string[] = []
for (let k = 0; k < Math.max(SHOWCASE.length, handMade.length); k++) for (const id of [SHOWCASE[k], handMade[k]]) if (id) SHOWN.push(id)
{
  const M = 64, cols = 32
  const list = chunks.map((c) => c.map.id)
  const s = sheet(cols * M, Math.ceil(list.length / cols) * M)
  // the first 31 (the tiles of the first five splits, drawn larger than the atlas's squares)
  const BIG = 256, bigCols = 8, bigN = Math.min(31, SHOWN.length), big = sheet(bigCols * BIG, Math.ceil(bigN / bigCols) * BIG)
  const out: { id: string; region?: string; kind?: string; made: boolean; show?: number }[] = []
  let n = 0
  const t0 = Date.now()
  for (const id of list) {
    let img: Image
    try { img = decodePng(renderMap(g, id, 1).png) } catch (e) { console.warn('cannot draw', id, (e as Error).message); continue }
    s.put(square(img, M), M, 0, 0, M, M, (n % cols) * M, Math.floor(n / cols) * M)
    const m = info.get(id) as { region?: string; kind?: string; backdrop?: boolean } | undefined
    const show = SHOWN.indexOf(id)
    out.push({ id, region: m?.region, kind: m?.kind, made: !m?.backdrop, ...(show >= 0 ? { show } : {}) })
    if (show >= 0 && show < bigN) big.put(square(img, BIG), BIG, 0, 0, BIG, BIG, (show % bigCols) * BIG, Math.floor(show / bigCols) * BIG)
    if (++n % 100 === 0) console.log(`  maps ${n}/${list.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  }
  s.save('maps.png')
  writeFileSync(join(OUT, 'lead.png'), renderMap(g, LEAD, 1).png)
  big.save('big.png')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(OUT, 'big.png'), '-q:v', '5', join(OUT, 'big.jpg')], { stdio: 'inherit' })
  rmSync(join(OUT, 'big.png'))
  writeFileSync(join(OUT, 'maps.json'), JSON.stringify({ size: M, cols, lead: LEAD, big: { size: BIG, cols: bigCols, count: bigN }, maps: out }))
  console.log(`${out.length} maps`)
}

// ------------------------------------------------------------------ people

{
  const people: { id: string; look: Look }[] = []
  const seen = new Set<string>()
  for (const p of peopleLooks()) if (p.id !== 'player') (people.push(p), seen.add(p.id))
  for (const c of chunks) for (const e of c.entities) {
    if (!e.type.startsWith('actor/person') || seen.has(e.id)) continue
    const look = typeof e.look === 'object' && e.look ? e.look : generateLook(e.id, { sex: 'female', age: e.props?.age ?? 30, role: e.type.split('/').pop() })
    people.push({ id: e.id, look })
    seen.add(e.id)
  }
  // four walking frames toward us, then the standing one
  const F = 5, cols = 16, cw = FW * F
  const s = sheet(cols * cw, Math.ceil(people.length / cols) * FH)
  people.forEach(({ look }, n) => {
    const fig = composeSprite(look)
    for (let f = 0; f < F; f++) s.put(fig, FW * 4, 0, (f < 4 ? f : IDLE_ROW) * FH, FW, FH, (n % cols) * cw + f * FW, Math.floor(n / cols) * FH)
  })
  s.save('people.png')
  writeFileSync(join(OUT, 'people.json'), JSON.stringify({ w: FW, h: FH, frames: F, cols, count: people.length }))
  console.log(`${people.length} people`)

  // faces: the cast's own portraits (as the dialogue shows them), then some of everyone, their busts
  const m = loadManifest()
  if (m) {
    const B = 128, n = 48, cols2 = 8
    const s2 = sheet(cols2 * B, Math.ceil(n / cols2) * B)
    /** A picture brought down to B x B as a picture is (smooth), kept transparent where the figure is not. */
    const down = (img: Image) => {
      const sm = Math.min(img.w, img.h), k2 = sm / B, out = new Uint8Array(B * B * 4)
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
        let r = 0, gg = 0, b = 0, a = 0, cnt = 0
        for (let yy = Math.floor(y * k2); yy < Math.floor((y + 1) * k2); yy++) for (let xx = Math.floor(x * k2); xx < Math.floor((x + 1) * k2); xx++) {
          const i = (yy * img.w + xx) * 4, al = img.rgba[i + 3]
          r += img.rgba[i] * al; gg += img.rgba[i + 1] * al; b += img.rgba[i + 2] * al; a += al; cnt++
        }
        out.set([a ? r / a : 0, a ? gg / a : 0, a ? b / a : 0, a / cnt], (y * B + x) * 4)
      }
      return out
    }
    // the cast's portraits are webp: ffmpeg gives their pixels
    const webp = (file: string): Image | undefined => {
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' })
      const [w, h] = (probe.stdout ?? '').trim().split(',').map(Number)
      if (!w || !h) return undefined
      const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 26 })
      return r.status === 0 ? { w, h, rgba: new Uint8Array(r.stdout) } : undefined
    }
    const faces: Uint8Array[] = []
    for (const p of Object.values(CATALOG.portraits ?? {})) {
      const img = webp(join(PUB, 'assets', p.dir, 'neutral.webp'))
      if (img) faces.push(down(img))
    }
    const own = new Set(Object.keys(CATALOG.portraits ?? {}))
    const rest = people.filter((p) => !own.has(p.id))
    for (let k = 0; faces.length < n && k < rest.length; k += Math.floor(rest.length / n)) {
      const { look } = rest[k]
      const bust = bustOf(m, look, composePortrait(m, look, undefined, layerFromDisk))
      faces.push(down({ w: bust.w, h: bust.h, rgba: new Uint8Array(bust.rgba.buffer) }))
    }
    faces.forEach((f, k) => s2.put(f, B, 0, 0, B, B, (k % cols2) * B, Math.floor(k / cols2) * B))
    s2.save('faces.png')
    writeFileSync(join(OUT, 'faces.json'), JSON.stringify({ size: B, cols: cols2, count: faces.length, own: Math.min(own.size, faces.length) }))
    console.log(`${faces.length} faces`)
  }
}

// ------------------------------------------------------------------ items

{
  const ASSETS = fileURLToPath(new URL('../../games/openworld/public/assets/', import.meta.url))
  const imgs = new Map<string, Image | null>()
  const load = (p: string) => {
    if (!imgs.has(p)) { try { imgs.set(p, decodePng(readFileSync(ASSETS + (p.startsWith('lsw/') ? p : `na/${p}`)))) } catch { imgs.set(p, null) } }
    return imgs.get(p) ?? undefined
  }
  const C = 24, cols = 32
  const keys = Object.keys(CATALOG.items).filter((k) => { const d = CATALOG.items[k]; return d && d.w <= C && d.h <= C && load(d.img) })
  const s = sheet(cols * C, Math.ceil(keys.length / cols) * C)
  keys.forEach((k, n) => {
    const d = CATALOG.items[k], img = load(d.img)!
    s.put(img.rgba, img.w, d.x, d.y, d.w, d.h, (n % cols) * C + Math.floor((C - d.w) / 2), Math.floor(n / cols) * C + Math.floor((C - d.h) / 2))
  })
  s.save('items.png')
  writeFileSync(join(OUT, 'items.json'), JSON.stringify({ size: C, cols, keys }))
  console.log(`${keys.length} item pictures`)
}

// ------------------------------------------------------------------ the continent's shape

{
  // every land cell of the world map, the most inland first (the most land among its neighbours, then a fixed order)
  const ow = JSON.parse(readFileSync(join(PUB, 'world/maps/overworld.json'), 'utf8')).map
  const land = (x: number, y: number) => y >= 0 && y < ow.height && x >= 0 && x < ow.width && ow.rows[y][x] !== '0'
  const cells: [number, number, number][] = []
  for (let y = 0; y < ow.height; y++) for (let x = 0; x < ow.width; x++) {
    if (!land(x, y)) continue
    let n = 0
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (land(x + dx, y + dy)) n++
    cells.push([x, y, n])
  }
  cells.sort((a, b) => b[2] - a[2] || a[1] - b[1] || a[0] - b[0])
  writeFileSync(join(OUT, 'continent.json'), JSON.stringify({ w: ow.width, h: ow.height, cells: cells.map(([x, y]) => [x, y]) }))
  console.log(`${cells.length} land cells`)
}
