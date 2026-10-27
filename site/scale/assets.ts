// The scale film's material, drawn by the game's own code (npm run gen:world first):
//   maps.jpg       the 128 maps the film splits into, no one twice: the showcase's and the hand-made country first,
//                  then the towns, the rooms that look like no other, villages, fields and places below, spread through
//                  the order; each the square of twelve cells that tells most of it, at the game's own size (192 x 192)
//   lead.png       the map the film opens on (Firstlight), whole
//   continent.png  the world map as the game draws it, which the maps fly into, each to its own place
//   people.png     every person's map figure from their look, walking toward us (4 frames) and standing, 24 x 36 each
//   faces.png      some of them as the dialogue shows them: the cast's own portraits first, then others' busts, 128 x 128
//   items.png      every item picture in the catalogue, in a 24 x 24 cell each
// with a .json beside each saying what is where.  npx tsx site/scale/assets.ts [maps] [people] [items]  (all by default)
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
    // (brought up, each output pixel the one it falls on)
    for (let yy = Math.floor(y * k); yy < Math.max(Math.floor(y * k) + 1, Math.floor((y + 1) * k)); yy++) for (let xx = Math.floor(x * k); xx < Math.max(Math.floor(x * k) + 1, Math.floor((x + 1) * k)); xx++) {
      const i = ((oy + yy) * img.w + ox + xx) * 4
      r += img.rgba[i]; g += img.rgba[i + 1]; b += img.rgba[i + 2]; n++
    }
    out.set([r / n, g / n, b / n, 255], (y * size + x) * 4)
  }
  return out
}

// ------------------------------------------------------------------ maps

const files = readdirSync(join(PUB, 'world/maps')).filter((f) => f.endsWith('.json') && f !== 'offstage.json')
const index = JSON.parse(readFileSync(join(PUB, 'world/index.json'), 'utf8'))
type Info = { id: string; kind: string; region?: string; backdrop?: boolean; width: number; height: number; name: { en: string }; portals?: { to: string }[] }
const info = new Map<string, Info>(index.maps.map((m: Info) => [m.id, m]))
const g = loadGame()
const chunks = files.map((f) => JSON.parse(readFileSync(join(PUB, 'world/maps', f), 'utf8')))
// every map, the backdrop's too, where the renderer looks for them
g.maps = chunks.map((c) => ({ kind: 'map', id: c.map.id, zh: '', en: c.map.id, title: '', group: c.map.kind, map: c.map, entities: c.entities })) as never
if (want('maps')) {
  const LEAD = 'meadow'
  // the places the film shows first, as the one map splits: the showcase (docs/showcase.md) and the hand-made country
  // by turns
  const SHOWCASE = ['holy.quarter-2', 'holy.sunwell-abbey', 'frostfang.rimeholm', 'holy.quarter-3', 'redmarch.warcombe', 'tithe.weighmarket', 'holy.quarter-1', 'palefen.dusk-moorings', 'altar.highheath-abbey', 'holy.quarter-4', 'tithe.barleyridge-farm', 'redmarch.brandby-mine', 'holy.quarter-5', 'altar.bellwick-farm', 'palefen.ashengate-ruins', 'frostfang.northmoor-cave', 'tithe.goldmere-tower', 'redmarch.scarwell-camp', 'frostfang.frostbarrow-camp']
  const HAND = ['ford', 'mill', 'reedbend', 'emberfall', 'charcoal', 'dawnhill', 'summit', 'haven', 'forest', 'waystation', 'abbey', 'pasture', 'pilgrimway', 'sanctum']
  // the rooms that look like no other: halls, chapels, crypts, workshops, the showcase's own (never the houses and
  // tents, which are one room many times over)
  const ROOMS = ['holy.sunwell-abbey.nave', 'holy.sunwell-abbey.library', 'holy.quarter-1.hall', 'frostfang.northmoor-cave.icelake', 'redmarch.warcombe.warhall', 'tithe.weighmarket.granary', 'holy.quarter-4.inn-0', 'palefen.dusk-moorings.ossuary', 'altar.highheath-abbey.chapel', 'frostfang.rimeholm.longhall', 'redmarch.brandby-mine.workings', 'tithe.goldmere-tower.observatory', 'holy.quarter-2.hall', 'meadow.smithy', 'palefen.ashengate-ruins.drowned', 'altar.bellwick-farm.manorhall', 'redmarch.warcombe.armoury', 'holy.quarter-3.hall', 'abbey.crypt', 'frostfang.frostbarrow-camp.hall', 'tithe.goldmere-tower.alchemy', 'holy.sunwell-abbey.refectory', 'meadow.church', 'altar.highheath-abbey.catacombs', 'frostfang.rimeholm.boathouse', 'redmarch.scarwell-camp.burrow', 'holy.quarter-1.solar', 'tithe.weighmarket.counting', 'holy.quarter-4.teahouse-1', 'abbey.tomb', 'frostfang.northmoor-cave.icecave', 'holy.sunwell-abbey.belfry', 'waystation.chapel', 'holy.quarter-1.barracks-1', 'millcellar']
  const COUNT = 128
  /** What a map is, for spreading the sorts through every level: its kind, a backdrop field by what stands on it. */
  const sort = (m: Info) => m.kind === 'interior' ? 'room' : m.id.endsWith('.depths') ? 'depths' : !m.backdrop ? 'hand' : m.kind === 'field' ? `field:${m.id.match(/-([a-z]+)$/)?.[1] ?? 'field'}` : m.kind
  const all = [...info.values()].filter((m) => m.kind !== 'overworld' && m.id !== 'offstage' && m.id !== 'tutorial')
  const first = [LEAD, ...SHOWCASE.flatMap((id, k) => [id, HAND[k]])].filter((id): id is string => !!id && info.has(id))
  const taken = new Set(first)
  /** Of a list, the first `n` with the regions taking turns. */
  const turns = (list: Info[], n: number) => {
    const by = new Map<string, Info[]>()
    for (const m of list) by.set(m.region ?? '', [...(by.get(m.region ?? '') ?? []), m])
    const out: Info[] = []
    for (let k = 0; out.length < Math.min(n, list.length); k++) for (const l of by.values()) if (l[k] && out.length < n) out.push(l[k])
    return out
  }
  const free = (f: (m: Info) => boolean) => all.filter((m) => !taken.has(m.id) && f(m))
  // the rest by sort: every town and cathedral, the rest of the hand-made country, the rooms, a few villages of each
  // region, one field of each sort (never the depths
  // below a cave, black round their tunnels); more than are needed, for those that come out too dark
  const groups: Info[][] = [
    free((m) => ['town', 'cathedral', 'temple'].includes(m.kind)),
    free((m) => sort(m) === 'hand' && m.kind !== 'interior'),
    ROOMS.map((id) => info.get(id)!).filter((m) => m && !taken.has(m.id)),
    turns(free((m) => m.kind === 'village'), 24),
    [...new Map(turns(free((m) => sort(m).startsWith('field:')), 999).map((m) => [sort(m), m])).values()],
  ]
  // each group spread evenly through the order (one of n at (k + 1/2) / n), so every level holds every sort
  const placed: [number, Info][] = []
  for (const list of groups) list.forEach((m, k) => placed.push([(k + 0.5 + hashOf(m.id) * 0.3) / list.length, m]))
  placed.sort((a, b) => a[0] - b[0])
  const order = [...first.map((id) => info.get(id)!), ...placed.map(([, m]) => m)]
  // where each is on the continent: its own cell on the world map; a room or a place below, the cell of the map it
  // opens onto
  const ow = chunks.find((c) => c.map.id === 'overworld')
  const cellOf = new Map<string, [number, number]>()
  for (const e of ow.entities) if (e.props?.map && e.place?.on === 'tile') cellOf.set(e.props.map, [e.place.x, e.place.y])
  const cell = (id: string, seen = new Set<string>()): [number, number] | undefined => {
    if (cellOf.has(id)) return cellOf.get(id)
    // the Held Ground is reached by the road, by no door: at the road's end
    if (id === 'haven') return cell('pilgrimway', seen)
    seen.add(id)
    for (const p of info.get(id)?.portals ?? []) if (!seen.has(p.to)) { const c = cell(p.to, seen); if (c) return c }
    return undefined
  }
  /** The window of a map's picture that tells most of it: the square of `win` cells holding most of the colours the map
   *  has little of (roofs, walls, water, stalls, against its grass and floors), the black round a cave counted against
   *  it, the middle a little preferred. */
  const telling = (img: Image, win: number): [number, number] => {
    const S = 16, wc = Math.floor(img.w / S), hc = Math.floor(img.h / S)
    const code = (i: number) => ((img.rgba[i] >> 5) << 6) | ((img.rgba[i + 1] >> 5) << 3) | (img.rgba[i + 2] >> 5)
    const freq = new Map<number, number>()
    for (let i = 0; i < img.rgba.length; i += 4) freq.set(code(i), (freq.get(code(i)) ?? 0) + 1)
    const score = new Float64Array(wc * hc), total = img.w * img.h
    for (let y = 0; y < hc * S; y++) for (let x = 0; x < wc * S; x++) {
      const i = (y * img.w + x) * 4, l = (img.rgba[i] + img.rgba[i + 1] + img.rgba[i + 2]) / 3
      score[Math.floor(y / S) * wc + Math.floor(x / S)] += (freq.get(code(i))! / total < 0.01 ? 1 : 0) - (l < 25 ? 3 : 0)
    }
    let best = -Infinity, at: [number, number] = [0, 0]
    for (let y = 0; y + win <= hc; y++) for (let x = 0; x + win <= wc; x++) {
      let s = 0
      for (let yy = y; yy < y + win; yy++) for (let xx = x; xx < x + win; xx++) s += score[yy * wc + xx]
      s *= 1 - 0.15 * (Math.abs((x + win / 2) / wc - 0.5) + Math.abs((y + win / 2) / hc - 0.5))
      if (s > best) (best = s), (at = [x, y])
    }
    return [at[0] * S, at[1] * S]
  }
  // twelve cells of each (of a room, as much as is square), at the game's own size: the film draws them larger, pixel
  // for pixel
  const WIN = 12, M = WIN * 16, cols = 16
  const s = sheet(cols * M, Math.ceil(COUNT / cols) * M)
  const out: { id: string; kind: string; region?: string; cell?: [number, number] }[] = []
  for (const m of order) {
    if (out.length === COUNT) break
    let img: Image
    try { img = decodePng(renderMap(g, m.id, 1).png) } catch (e) { console.warn('cannot draw', m.id, (e as Error).message); continue }
    const win = Math.min(WIN, Math.floor(img.w / 16), Math.floor(img.h / 16))
    const [x0, y0] = telling(img, win)
    const cut: Image = { w: win * 16, h: win * 16, rgba: new Uint8Array(win * 16 * win * 16 * 4) }
    for (let y = 0; y < cut.h; y++) cut.rgba.set(img.rgba.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + cut.w) * 4), y * cut.w * 4)
    // a cut mostly black (a cave's rock, the dark round a room) tells nothing in a small window
    let dark = 0
    for (let i = 0; i < cut.rgba.length; i += 4) if (cut.rgba[i] + cut.rgba[i + 1] + cut.rgba[i + 2] < 75) dark++
    if (dark / (cut.w * cut.h) > 0.2 && !first.includes(m.id)) { console.log('  too dark:', m.id); continue }
    const n = out.length
    s.put(win === WIN ? cut.rgba : square(cut, M), M, 0, 0, M, M, (n % cols) * M, Math.floor(n / cols) * M)
    out.push({ id: m.id, kind: sort(m), region: m.region, cell: cell(m.id) })
  }
  s.save('maps.png')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(OUT, 'maps.png'), '-q:v', '2', join(OUT, 'maps.jpg')], { stdio: 'inherit' })
  rmSync(join(OUT, 'maps.png'))
  writeFileSync(join(OUT, 'lead.png'), renderMap(g, LEAD, 1).png)
  // the continent as the world map draws it, which the maps go into, each to its own place
  writeFileSync(join(OUT, 'continent.png'), renderMap(g, 'overworld', 1).png)
  writeFileSync(join(OUT, 'maps.json'), JSON.stringify({ size: M, cols, lead: LEAD, continent: { w: ow.map.width, h: ow.map.height }, maps: out }))
  const tally = new Map<string, number>()
  for (const m of out) tally.set(m.kind, (tally.get(m.kind) ?? 0) + 1)
  console.log(`${out.length} maps:`, Object.fromEntries(tally))
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
  s.save('items.png')
  writeFileSync(join(OUT, 'items.json'), JSON.stringify({ size: C, cols, keys }))
  console.log(`${keys.length} item pictures`)
}
