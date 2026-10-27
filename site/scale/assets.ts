// The scale film's material, from the game's own code and its stage (npm run gen:world first):
//   maps.jpg       the 1,024 maps the film splits into, each the still the trailer stage took of it (site/scale/shots.ts:
//                  its telling square with its own people in it; ?film=scale-maps, export.mjs --clip-w 192 into
//                  var/scale/stills/p<n>), none like another (likeness.mjs): the showcase's places and the hand-made
//                  country first, then every sort of place spread through the order, 96 x 96 each
//   big.jpg        the first 64 of them at 192 x 192, for the first levels, where they are drawn large
//   lead.png       the map the film opens on (Firstlight), whole
//   people.png     every person's map figure from their look, walking toward us (4 frames) and standing, 24 x 36 each
//   faces.png      some of them as the dialogue shows them: the cast's own portraits first, then others' busts, 128 x 128
//   items.png      every item picture in the catalogue, in a 24 x 24 cell each
// with a .json beside each saying what is where.  npx tsx site/scale/assets.ts [maps] [people] [items]  (all by default)
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

// ------------------------------------------------------------------ maps

const files = readdirSync(join(PUB, 'world/maps')).filter((f) => f.endsWith('.json') && f !== 'offstage.json')
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
  // the rooms that are their own (a hall, a chapel, a workshop), not one of a town's homes
  const OWN_ROOM = /(smithy|barracks|chapel|church|library|crypt|tomb|nave|belfry|refectory|teahouse|inn|hall$|solar|armoury|granary|counting|observatory|alchemy|workings|oldworks|ossuary|undercroft|drowned|catacombs|manorhall|gallery|cellar|icecave|icelake|longhall|boathouse|hospital|warhall|lodge|burrow|garrison|healer|poorhouse|barn|mill|tower|hostel|shop|store)/
  const COUNT = 1024
  // every map's still from the stage (shots.ts, ?film=scale-maps, export.mjs --clip-w 192 into var/scale/stills/p<n>)
  type Entry = { map: string; kind: string; region?: string; made: boolean; people: number }
  const list: Entry[] = JSON.parse(readFileSync('games/openworld/client/src/trailer/scaleshots.json', 'utf8'))
  const stillOf = new Map<string, string>()
  for (const part of readdirSync('var/scale/stills')) {
    const { shots } = JSON.parse(readFileSync(join('var/scale/stills', part, 'cues.json'), 'utf8'))
    for (const s of shots) stillOf.set(s.id.slice(2), join('var/scale/stills', part, 'frames', `${String(s.start).padStart(5, '0')}.png`))
  }
  const sort = (m: Entry) => m.kind === 'interior' ? (OWN_ROOM.test(m.map) ? 'room' : 'home') : m.map.endsWith('.depths') ? 'depths' : m.made ? 'hand' : m.kind === 'field' ? 'field' : m.kind
  const byId = new Map(list.map((m) => [m.map, m]))
  const first = [LEAD, ...SHOWCASE.flatMap((id, k) => [id, HAND[k]])].filter((id): id is string => !!id && byId.has(id))
  // the rest by sort, each spread evenly through the order (one of n at (k + 1/2) / n), its regions taking turns, so
  // every level holds every sort; the rooms with no one in them last of all
  const bySort = new Map<string, Entry[]>()
  for (const m of list) if (!first.includes(m.map) && stillOf.has(m.map)) bySort.set(sort(m), [...(bySort.get(sort(m)) ?? []), m])
  const placed: [number, Entry][] = []
  for (const [, l] of bySort) {
    const regions = new Map<string, Entry[]>()
    for (const m of l) regions.set(m.region ?? '', [...(regions.get(m.region ?? '') ?? []), m])
    const turns: Entry[] = []
    for (let k = 0; turns.length < l.length; k++) for (const r of regions.values()) if (r[k]) turns.push(r[k])
    turns.forEach((m, k) => placed.push([(k + 0.5 + hashOf(m.map) * 0.3) / turns.length + (m.people === 0 && m.kind === 'interior' ? 1 : 0), m]))
  }
  placed.sort((a, b) => a[0] - b[0])
  // taken in that order, none like one taken before it (likeness.mjs)
  const taken: { m: Entry; sig: ReturnType<typeof signature> }[] = []
  const passed: string[] = []
  for (const m of [...first.map((id) => byId.get(id)!), ...placed.map(([, m]) => m)]) {
    if (taken.length === COUNT) break
    const sig = signature(stillOf.get(m.map)!)
    const twin = taken.find((t) => alike(t.sig, sig))
    if (twin) { passed.push(`${m.map} (like ${twin.m.map})`); continue }
    taken.push({ m, sig })
  }
  if (taken.length < COUNT) throw new Error(`only ${taken.length} maps unlike each other`)
  // the atlas at half the still (96 px), the first 64 whole (192 px) for the first levels, where they are drawn large
  const M = 96, cols = 32, BIG = 192, bigCols = 8, bigN = 64
  const tiles = join(OUT, 'tiles.txt')
  const sheetOf = (ms: Entry[], size: number, c: number, name: string) => {
    writeFileSync(tiles, ms.map((m) => `file '${resolve(stillOf.get(m.map)!).replace(/\\/g, '/')}'`).join('\n'))
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', tiles, '-vf', `scale=${size}:${size}:flags=area,tile=${c}x${Math.ceil(ms.length / c)}`, '-frames:v', '1', '-q:v', '3', join(OUT, name)], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error(`cannot make ${name}`)
  }
  sheetOf(taken.map((t) => t.m), M, cols, 'maps.jpg')
  sheetOf(taken.slice(0, bigN).map((t) => t.m), BIG, bigCols, 'big.jpg')
  rmSync(tiles)
  writeFileSync(join(OUT, 'lead.png'), renderMap(g, LEAD, 1).png)
  writeFileSync(join(OUT, 'maps.json'), JSON.stringify({ size: M, cols, lead: LEAD, big: { size: BIG, cols: bigCols, count: bigN }, maps: taken.map(({ m }) => ({ id: m.map, kind: sort(m), region: m.region })) }))
  const tally = new Map<string, number>()
  for (const { m } of taken) tally.set(sort(m), (tally.get(sort(m)) ?? 0) + 1)
  console.log(`${taken.length} maps, none alike:`, Object.fromEntries(tally), `\n  passed over as like one taken: ${passed.length}`)
  for (const p of passed.slice(0, 20)) console.log(`    ${p}`)
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
