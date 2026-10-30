// The scale film's material, from the game's own code and its stage (npm run gen:world first):
//   maps.webp      the 1,024 maps the film splits into, each a still the trailer stage took (site/scale/gen/main.ts
//                  made the list: the showcase's places and halls, those places in winter, autumn, spring and on festival
//                  days, the hall plans furnished anew, every window unlike the others): Firstlight and the showcase's
//                  best first, then every sort spread through the order, 96 x 96 each
//   big.webp       the first 64 of them at 192 x 192, for the first levels, where they are drawn large
//   lead.webp      the map the film opens on (Firstlight), whole
//   people.webp    every person's map figure from their look, walking toward us (4 frames) and standing, 24 x 36 each
//   faces.webp     some of them as the dialogue shows them: the cast's own portraits first, then others' busts, 128 x 128
//   items.webp     every item picture in the catalogue, in a 24 x 24 cell each
// with a .json beside each saying what is where.  npx tsx site/scale/assets.ts [maps] [people] [items]  (all by default)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Look } from '@openworld/engine'
import { generateLook } from '@openworld-game/content'
import { loadGame } from '../../games/openworld/wiki/src/game.ts'
import { renderMap } from '../../games/openworld/wiki/src/render-map.ts'
import { CATALOG } from '../../games/openworld/wiki/src/bundle.ts'
import { decodePng, encodePng, type Image } from '../../games/openworld/wiki/src/png.ts'
import { FH, FW, IDLE_ROW, composeSprite } from '../../packages/runtime/src/assets/figure/sprite.ts'
import { composePortrait } from '../../packages/runtime/src/assets/figure/portrait.ts'
import { alike, signature } from './likeness.mjs'
import { compOf, rectOf, sameView } from './views.mjs'
import { bustOf, layerFromDisk, loadManifest, peopleLooks } from '../../games/openworld/tools/src/art/looks/review.ts'

const OUT = 'site/scale/assets'
// a sheet of figures kept to the pixel: lossless WebP, about half the PNG
const lossless = (name: string, png: Uint8Array) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'png_pipe', '-i', '-', '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', join(OUT, name)], { input: png, stdio: ['pipe', 'inherit', 'inherit'] })
  if (r.status !== 0) throw new Error(`cannot make ${name}`)
}
const PUB = 'games/openworld/public'
mkdirSync(OUT, { recursive: true })
const asked = process.argv.slice(2)
const want = (part: string) => !asked.length || asked.includes(part)
const hashOf = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000 }

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
    save(name: string) { lossless(name, encodePng(w, h, rgba)) },
  }
}

// ------------------------------------------------------------------ maps

const files = readdirSync(join(PUB, 'world/maps')).filter((f) => f.endsWith('.json') && f !== 'offstage.json')
const g = loadGame()
const chunks = files.map((f) => JSON.parse(readFileSync(join(PUB, 'world/maps', f), 'utf8')))
// every map, the backdrop's too, where the renderer looks for them
g.maps = chunks.map((c) => ({ kind: 'map', id: c.map.id, zh: '', en: c.map.id, title: '', group: c.map.kind, map: c.map, entities: c.entities })) as never
if (want('maps')) {
  const LEAD = 'meadow'
  const COUNT = 1024
  // every still the stage took (site/scale/gen/main.ts made the list, every window unlike the others as drawn;
  // ?film=scale-maps, export.mjs --clip-w 192, in parts, into var/scale/stills/p<n>)
  type Entry = { id: string; map: string; src?: string; family: string; variant?: string; inside: boolean; region?: string; x: number; y: number; w: number; h: number }
  const { stills } = JSON.parse(readFileSync('games/openworld/client/src/trailer/scaleshots.json', 'utf8')) as { stills: Entry[] }
  const frameOf = new Map<string, string>()
  for (const part of readdirSync('var/scale/stills').filter((d) => !d.endsWith('.log'))) {
    const cues = join('var/scale/stills', part, 'cues.json')
    if (!existsSync(cues)) continue
    for (const s of JSON.parse(readFileSync(cues, 'utf8')).shots) { const f = join('var/scale/stills', part, 'frames', `${String(s.start).padStart(5, '0')}.png`); if (existsSync(f)) frameOf.set(s.id, f) }
  }
  const sortOf = (e: Entry) => (e.inside ? (e.src ? 'made hall' : 'hall') : e.variant ?? 'place')
  const have = stills.filter((e) => frameOf.has(e.id))
  // the first: Firstlight; then each place's best window (its first) and each hall's by turns, so the first levels are
  // the showcase's own; then every sort spread evenly through the order, the places of a sort taking turns in it
  const firstOf = (e: Entry) => e.id.endsWith('#0')
  const lead = have.find((e) => e.map === LEAD && firstOf(e))!
  const places = have.filter((e) => firstOf(e) && !e.inside && !e.variant && e !== lead)
  const halls = have.filter((e) => firstOf(e) && e.inside && !e.src)
  const opening: Entry[] = [lead]
  for (let k = 0; opening.length < 32 && (places[k] || halls[k]); k++) for (const e of [places[k], places[k + 20], halls[k]]) if (e && opening.length < 32 && !opening.includes(e)) opening.push(e)
  const rest = have.filter((e) => !opening.includes(e))
  const bySort = new Map<string, Entry[]>()
  for (const e of rest) bySort.set(sortOf(e), [...(bySort.get(sortOf(e)) ?? []), e])
  const placed: [number, Entry][] = []
  for (const [, l] of bySort) {
    const fam = new Map<string, Entry[]>()
    for (const e of l) fam.set(e.family, [...(fam.get(e.family) ?? []), e])
    const turns: Entry[] = []
    for (let k = 0; turns.length < l.length; k++) for (const f of fam.values()) if (f[k]) turns.push(f[k])
    turns.forEach((e, k) => placed.push([(k + 0.5 + hashOf(e.id) * 0.3) / turns.length, e]))
  }
  placed.sort((a, b) => a[0] - b[0])
  // taken in that order, none like one taken before it as the stage drew it (likeness.mjs)
  // and none a view of what one taken before it is a view of (views.mjs)
  const order: Entry[] = [], sigs: ReturnType<typeof signature>[] = [], views: { comp: string; rect: number[] }[] = []
  let passed = 0
  for (const e of [...opening, ...placed.map(([, e]) => e)]) {
    if (order.length === COUNT) break
    const sig = signature(frameOf.get(e.id)!)
    const view = { comp: compOf(e), rect: rectOf(e) }
    if (sigs.some((t) => alike(t, sig)) || views.some((v) => sameView(v, view))) { passed++; continue }
    order.push(e)
    sigs.push(sig)
    views.push(view)
  }
  if (order.length < COUNT) throw new Error(`only ${order.length} stills unlike each other`)
  console.log(`  passed over as like one taken: ${passed}`)
  // the atlas at half the still (96 px), the first 64 whole (192 px) for the first levels, where they are drawn large
  const M = 96, cols = 32, BIG = 192, bigCols = 8, bigN = 64
  const tiles = join(OUT, 'tiles.txt')
  const sheetOf = (es: Entry[], size: number, c: number, name: string) => {
    writeFileSync(tiles, es.map((e) => `file '${resolve(frameOf.get(e.id)!).replace(/\\/g, '/')}'`).join('\n'))
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', tiles, '-vf', `scale=${size}:${size}:flags=area,tile=${c}x${Math.ceil(es.length / c)}`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', join(OUT, name)], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error(`cannot make ${name}`)
  }
  sheetOf(order, M, cols, 'maps.webp')
  sheetOf(order.slice(0, bigN), BIG, bigCols, 'big.webp')
  rmSync(tiles)
  lossless('lead.webp', renderMap(g, LEAD, 1).png)
  writeFileSync(join(OUT, 'maps.json'), JSON.stringify({ size: M, cols, lead: LEAD, big: { size: BIG, cols: bigCols, count: bigN }, maps: order.map((e) => ({ id: e.id, sort: sortOf(e), region: e.region, comp: compOf(e), rect: rectOf(e) })) }))
  const tally = new Map<string, number>()
  for (const e of order) tally.set(sortOf(e), (tally.get(sortOf(e)) ?? 0) + 1)
  console.log(`${order.length} maps:`, Object.fromEntries(tally))
}

// ------------------------------------------------------------------ people

if (want('people')) {
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
  s.save('people.webp')
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
    s2.save('faces.webp')
    writeFileSync(join(OUT, 'faces.json'), JSON.stringify({ size: B, cols: cols2, count: faces.length, own: Math.min(own.size, faces.length) }))
    console.log(`${faces.length} faces`)
  }
}

// ------------------------------------------------------------------ items

if (want('items')) {
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
  s.save('items.webp')
  writeFileSync(join(OUT, 'items.json'), JSON.stringify({ size: C, cols, keys }))
  console.log(`${keys.length} item pictures`)
}
