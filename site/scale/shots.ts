// The scale film's shot list, made from the world (npm run gen:world first): for every map, where on it and when to look
// so it shows what it is and something going on there.
//   a still   the map in the maps act: a square of twelve cells (of a room seven) round its people and the things it has little of (a
//             hearth, a loom, stalls, an altar, water), at the hour most of its people are in it and awake
//   a scene   the map in the scenes act: a wider look somewhere else on it, at another hour and in its weather; where
//             the place allows, something happening (a fire lit, a beast met, lightning)
// A room's people are kept in its town's file: `also` names the files their records are in. Written to the trailer
// stage's folder, which films them (?film=scale-maps, ?film=scale-scenes).
//   npx tsx site/scale/shots.ts
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadGame } from '../../games/openworld/wiki/src/game.ts'
import { renderMap } from '../../games/openworld/wiki/src/render-map.ts'
import { decodePng, type Image } from '../../games/openworld/wiki/src/png.ts'

const PUB = 'games/openworld/public'
const OUT = 'games/openworld/client/src/trailer/scaleshots.json'
type Stint = { from: number; to: number; map: string; x: number; y: number; activity?: string }
type Ent = { id: string; type: string; place?: { on: string; map?: string; x?: number; y?: number }; npc?: { schedule?: Stint[] } }
const files = readdirSync(join(PUB, 'world/maps')).filter((f) => f.endsWith('.json'))
const chunks: { map: { id: string; kind: string; region?: string; width: number; height: number; rows: string[] }; entities: Ent[] }[] = files.map((f) => JSON.parse(readFileSync(join(PUB, 'world/maps', f), 'utf8')))
const index = JSON.parse(readFileSync(join(PUB, 'world/index.json'), 'utf8'))
const info = new Map<string, { kind: string; region?: string; backdrop?: boolean }>(index.maps.map((m: { id: string }) => [m.id, m]))
const g = loadGame()
g.maps = chunks.map((c) => ({ kind: 'map', id: c.map.id, zh: '', en: c.map.id, title: '', group: c.map.kind, map: c.map, entities: c.entities })) as never

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000 }
const within = (h: number, s: Stint) => (s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to)

// everyone, and the file their record is in
const people: { e: Ent; file: string }[] = []
for (const c of chunks) for (const e of c.entities) if (e.type.startsWith('actor/person')) people.push({ e, file: c.map.id })
/** Who is on a map at an hour, and where: by their day if they have one, else where they stand. */
function present(map: string, hour: number): { x: number; y: number; awake: boolean; file: string }[] {
  const out: { x: number; y: number; awake: boolean; file: string }[] = []
  for (const { e, file } of people) {
    const stint = e.npc?.schedule?.find((s) => within(hour, s))
    if (stint) { if (stint.map === map) out.push({ x: stint.x, y: stint.y, awake: stint.activity !== 'sleep', file }) }
    else if (e.place?.on === 'tile' && e.place.map === map) out.push({ x: e.place.x!, y: e.place.y!, awake: true, file })
  }
  return out
}

/** Per cell: how much of it is what the map has little of (its colours rarer than one in a hundred), the black round a
 *  cave counted against it. */
function rarity(img: Image): { score: Float64Array; wc: number; hc: number } {
  const S = 16, wc = Math.floor(img.w / S), hc = Math.floor(img.h / S)
  const code = (i: number) => ((img.rgba[i] >> 5) << 6) | ((img.rgba[i + 1] >> 5) << 3) | (img.rgba[i + 2] >> 5)
  const freq = new Map<number, number>()
  for (let i = 0; i < img.rgba.length; i += 4) freq.set(code(i), (freq.get(code(i)) ?? 0) + 1)
  const score = new Float64Array(wc * hc), total = img.w * img.h
  for (let y = 0; y < hc * S; y++) for (let x = 0; x < wc * S; x++) {
    const i = (y * img.w + x) * 4, l = (img.rgba[i] + img.rgba[i + 1] + img.rgba[i + 2]) / 3
    score[Math.floor(y / S) * wc + Math.floor(x / S)] += (freq.get(code(i))! / total < 0.01 ? 1 : 0) - (l < 25 ? 3 : 0)
  }
  return { score, wc, hc }
}
/** The best window of w x h cells: the rare colours in it, and a person in it worth a good deal; `avoid` a window
 *  already used, kept out of. */
function window(r: ReturnType<typeof rarity>, w: number, h: number, folk: { x: number; y: number }[], avoid?: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  w = Math.min(w, r.wc); h = Math.min(h, r.hc)
  let best = -Infinity, at = { x: 0, y: 0 }
  for (let y = 0; y + h <= r.hc; y++) for (let x = 0; x + w <= r.wc; x++) {
    let s = 0
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) s += r.score[yy * r.wc + xx]
    for (const p of folk) if (p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) s += 120
    if (avoid) { const ox = Math.max(0, Math.min(x + w, avoid.x + avoid.w) - Math.max(x, avoid.x)), oy = Math.max(0, Math.min(y + h, avoid.y + avoid.h) - Math.max(y, avoid.y)); s *= 1 - 0.7 * (ox * oy) / (w * h) }
    s *= 1 - 0.1 * (Math.abs((x + w / 2) / r.wc - 0.5) + Math.abs((y + h / 2) / r.hc - 0.5))
    if (s > best) (best = s), (at = { x, y })
  }
  return at
}

const HOURS = [6.5, 8, 9.5, 11, 12.5, 14, 15.5, 17, 18.5, 20, 21.5, 23]
/** The beasts met in each region's wilds. */
const FOES: Record<string, string[]> = {
  frostfang: ['beast/frost_wolf', 'golem/ice_golem', 'slime/frost_slime'],
  redmarch: ['beast/boar', 'imp/fire_imp', 'slime/fire_slime'],
  tithe: ['beast/wolf', 'slime/green_slime', 'beast/boar'],
  palefen: ['undead/ghost', 'spider', 'slime/water_slime'],
  altar: ['undead/skeleton', 'wisp', 'slime/spark_slime'],
  holy: ['beast/wolf', 'slime/green_slime', 'undead/zombie'],
}
const WEATHER: ['sun' | 'cloud' | 'rain' | 'fog' | 'storm', number][] = [['sun', 0.5], ['cloud', 0.15], ['rain', 0.15], ['fog', 0.1], ['storm', 0.1]]
const weatherOf = (u: number) => { let a = 0; for (const [w, p] of WEATHER) if (u < (a += p)) return w; return 'sun' }

const shots: unknown[] = []
const t0 = Date.now()
for (const c of chunks) {
  const id = c.map.id, m = info.get(id)
  if (!m || ['overworld'].includes(m.kind) || id === 'offstage' || id === 'tutorial') continue
  let img: Image
  try { img = decodePng(renderMap(g, id, 1).png) } catch { continue }
  const r = rarity(img)
  const room = m.kind === 'interior', open = !room
  // the still: the hour most of its people are in it and awake (a room in the day, while they work at home)
  const count = (h: number) => present(id, h).filter((p) => p.awake).length
  // a room at an hour its people are in it, which hour by the room (rooms of one kind told apart by their light too);
  // the open country by day, when the most are out
  const roomHours = [8, 11, 14, 19.5, 21].filter((h) => count(h) > 0)
  const stillHour = room && roomHours.length ? roomHours[Math.floor(hash(id + 'h') * roomHours.length)] : (room ? [8, 11, 14, 19.5] : [9.5, 11, 12.5, 14, 15.5]).reduce((a, b) => (count(b) > count(a) ? b : a))
  const busiest = Math.max(...HOURS.map(count))
  // a second hour for a room (another take, should the first look like one already shown)
  const altOf = (h: number) => roomHours.find((x) => Math.abs(x - h) >= 3) ?? roomHours.find((x) => x !== h) ?? h
  // a room close, round its people and its things (the rooms of one kind are much alike: who lives there tells them
  // apart); the open country wider
  const C = room ? 7 : 12
  const sw = window(r, C, C, present(id, stillHour).filter((p) => p.awake))
  const still = { x: sw.x + Math.min(C, r.wc) / 2, y: sw.y + Math.min(C, r.hc) / 2, hour: stillHour, cells: C, ...(room ? { alt: altOf(stillHour) } : {}) }
  // the scene: another hour (by the map, so neighbours differ), somewhere else on it if it is large enough
  const order = HOURS.slice().sort((a, b) => hash(id + a) - hash(id + b))
  const sceneHour = order.find((h) => Math.abs(h - stillHour) >= 3 && (open || count(h) > 0)) ?? order[0]
  const folk = present(id, sceneHour)
  const [VW, VH] = room ? [9, 5] : [16, 9]
  const vw = window(r, VW, VH, folk, { x: sw.x, y: sw.y, w: C, h: C })
  const scene: Record<string, unknown> = { x: vw.x + Math.min(VW, r.wc) / 2, y: vw.y + Math.min(VH, r.hc) / 2, hour: sceneHour, cells: [VW, VH], ...(room ? { alt: altOf(sceneHour) } : {}) }
  if (open) scene.weather = weatherOf(hash(id + 'w'))
  // what happens: lightning in a storm; a fire lit at dusk where one stands in sight; a beast met in the wilds
  const inView = (e: Ent) => e.place?.on === 'tile' && e.place.map === id && Math.abs(e.place.x! - (scene.x as number)) < 7 && Math.abs(e.place.y! - (scene.y as number)) < 4
  const fire = c.entities.find((e) => /campfire|bonfire|brazier/.test(e.type) && inView(e))
  if (open && scene.weather === 'storm') scene.event = { kind: 'strike' }
  else if (fire && sceneHour >= 17) scene.event = { kind: 'fire', at: [fire.place!.x, fire.place!.y] }
  else if (open && ['wild', 'field', 'dungeon'].includes(m.kind) && hash(id + 'f') < 0.35) {
    const foes = FOES[m.region ?? 'holy'] ?? FOES.holy
    scene.event = { kind: 'fight', foe: `actor/creature/${foes[Math.floor(hash(id + 'k') * foes.length)]}` }
  }
  // the one at the keys: off in the corner furthest from both, unless they fight
  const corners: [number, number][] = [[1, 1], [c.map.width - 2, 1], [1, c.map.height - 2], [c.map.width - 2, c.map.height - 2]]
  const far = (p: [number, number]) => Math.min(Math.hypot(p[0] - still.x, p[1] - still.y), Math.hypot(p[0] - (scene.x as number), p[1] - (scene.y as number)))
  const stand = corners.reduce((a, b) => (far(b) > far(a) ? b : a))
  const also = [...new Set([...present(id, stillHour), ...folk].map((p) => p.file).filter((f) => f !== id))]
  shots.push({ map: id, kind: m.kind, region: m.region, made: !m.backdrop, size: [c.map.width, c.map.height], people: busiest, stand, also, still, scene })
  if (shots.length % 100 === 0) console.log(`  ${shots.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
}
writeFileSync(OUT, JSON.stringify(shots))
console.log(`${shots.length} maps → ${OUT}`)
