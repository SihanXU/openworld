// The showcase's places again in other seasons and on other days, for the scale film: a place's own file with its ground,
// its buildings and its things changed —
//   winter    the snow laid over what grows (as ground.ts snowOver lays it), trees pines, the forts' and ruins' snowy
//             pictures, the water's edge ice, the flowers and the crops gone under it
//   autumn    the grass gone dry in patches, the flowers over, leaves fallen in drifts
//   spring    flowers come up in the grass in drifts, blossom along the ways, flowers in the beds
//   festival  lanterns lit and standards up along the streets and squares, stalls set out, more people come in
// A variant is a map of its own (its id `promo.<variant>.<place>`); what stands in it is moved there with it.
import type { RawChunk } from '@openworld/engine'
import { generateLook } from '@openworld-game/content'
import { CHAR_OF, TERRAIN_CHARS } from '../../../games/openworld/content/src/ontology.ts'
import { BUILDINGS } from '../../../games/openworld/client/src/catalog.ts'

export type Variant = 'winter' | 'autumn' | 'spring' | 'festival'
type Ent = RawChunk['entities'][number] & { place?: { on: string; map?: string; x?: number; y?: number } }

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }
const OPEN = new Set(['plaza', 'paving', 'flags', 'cobble', 'flagstone', 'path', 'gravel'])

/** How much of a place's ground is of these terrains (0–1). */
export function share(c: RawChunk, terrains: string[]): number {
  let n = 0, all = 0
  for (const row of c.map.rows) for (const ch of row) { all++; if (terrains.includes(TERRAIN_CHARS[ch])) n++ }
  return n / Math.max(1, all)
}

export function variant(src: RawChunk, v: Variant): RawChunk {
  const c: RawChunk = structuredClone(src)
  const id = `promo.${v}.${src.map.id}`
  const W = c.map.width, H = c.map.height
  const grid = c.map.rows.map((r) => [...r].map((ch) => TERRAIN_CHARS[ch]))
  const at = (x: number, y: number) => grid[y]?.[x]
  const ents = c.entities as Ent[]
  for (const e of ents) if (e.place?.on === 'tile') e.place.map = id
  // the cells something stands on
  const standing = new Set(ents.filter((e) => e.place?.on === 'tile').map((e) => `${e.place!.x},${e.place!.y}`))
  if (v === 'winter') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = grid[y][x]
      if (t === 'grass' || t === 'drygrass' || t === 'flowers' || t === 'flowerbed' || t === 'farmland' || t === 'dirt') grid[y][x] = 'snow'
      else if (t === 'tree') grid[y][x] = 'pine'
      else if (t === 'water' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = at(x + dx, y + dy); return n && n !== 'water' && n !== 'deepwater' && n !== 'bridge' })) grid[y][x] = 'ice'
    }
    // drifts over the paving where the wind leaves them
    for (let k = 0; k < Math.round((W * H) / 160); k++) {
      const cx = Math.floor(hash(`${id}${k}x`) * W), cy = Math.floor(hash(`${id}${k}y`) * H), r = 1 + Math.floor(hash(`${id}${k}r`) * 2)
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) if (OPEN.has(at(x, y)) && Math.hypot((x - cx) / 1.4, y - cy) <= r && !standing.has(`${x},${y}`)) grid[y][x] = 'snow'
    }
    c.map.stamps = (c.map.stamps ?? []).map((s: { key: string }) => { const [name, slice] = String(s.key).split('@'); const snowy = `snow_${name}`; return BUILDINGS[snowy] ? { ...s, key: slice ? `${snowy}@${slice}` : snowy } : s })
    c.entities = ents.filter((e) => !/^fixture\/(nature\/(flowers|plant|tuft)|crop\/)/.test(e.type)) as never
  }
  if (v === 'autumn') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = grid[y][x]
      if ((t === 'grass' && hash(`${id}${x >> 2},${y >> 2}`) < 0.6) || t === 'flowers') grid[y][x] = 'drygrass'
    }
    // leaves in drifts under the trees and along the ways
    let n = 0
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const t = grid[y][x]
      if ((t === 'drygrass' || t === 'grass' || OPEN.has(t)) && !standing.has(`${x},${y}`) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 'tree') && hash(`${id}l${x},${y}`) < 0.5) {
        ents.push({ id: `${id}.leaves${n++}`, type: 'fixture/nature/leaves', place: { on: 'tile', map: id, x, y } } as Ent)
        standing.add(`${x},${y}`)
      }
    }
    c.entities = ents.filter((e) => !/^fixture\/nature\/flowers/.test(e.type)) as never
  }
  if (v === 'spring') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = grid[y][x]
      if (t === 'drygrass' || (t === 'grass' && hash(`${id}${x >> 2},${y >> 2}`) < 0.25)) grid[y][x] = t === 'drygrass' ? 'grass' : 'flowers'
    }
    let n = 0
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const t = grid[y][x]
      if ((t === 'grass' || t === 'flowers') && !standing.has(`${x},${y}`) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => OPEN.has(at(x + dx, y + dy)) || at(x + dx, y + dy) === 'tree') && hash(`${id}b${x},${y}`) < 0.22) {
        ents.push({ id: `${id}.bloom${n++}`, type: 'fixture/nature/flowers', place: { on: 'tile', map: id, x, y } } as Ent)
        standing.add(`${x},${y}`)
      }
    }
    c.entities = ents as never
  }
  if (v === 'festival') {
    // the open ground near where people are: lanterns, standards and stalls along it, more people on it
    const people = ents.filter((e) => e.type.startsWith('actor/person') && e.place?.on === 'tile')
    let n = 0
    const near = (x: number, y: number) => people.some((p) => Math.abs(p.place!.x! - x) < 8 && Math.abs(p.place!.y! - y) < 6)
    const clear = (x: number, y: number) => OPEN.has(at(x, y)) && !standing.has(`${x},${y}`) && [[0, -1], [0, 1]].every(([dx, dy]) => at(x + dx, y + dy) !== 'wall' && at(x + dx, y + dy) !== 'roof')
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!clear(x, y) || !near(x, y)) continue
      const u = hash(`${id}f${x},${y}`)
      const type = u < 0.05 ? 'fixture/light/lantern' : u < 0.075 ? 'fixture/standard' : u < 0.09 ? 'fixture/furniture/stall' : u < 0.1 ? 'fixture/furniture/cart/flowers' : u < 0.16 ? 'person' : ''
      if (!type) continue
      standing.add(`${x},${y}`)
      const eid = `${id}.f${n++}`
      if (type === 'person') {
        const role = ['villager', 'merchant', 'villager', 'bard', 'noble', 'child', 'traveler'][Math.floor(hash(eid) * 7)]
        ents.push({ id: eid, type: `actor/person/${role}`, name: { en: 'someone', zh: '某人' }, place: { on: 'tile', map: id, x, y }, facing: 'down', look: generateLook(eid, { sex: hash(eid + 's') < 0.5 ? 'female' : 'male', age: role === 'child' ? 9 : 18 + Math.floor(hash(eid + 'a') * 50), role }), npc: { role, schedule: [{ from: 0, to: 24, map: id, x, y, activity: 'work' }] } } as never)
      } else {
        ents.push({ id: eid, type, place: { on: 'tile', map: id, x, y }, ...(type.includes('light') ? { statuses: { lit: -1 } } : {}) } as never)
        if (type.includes('light')) (c.map.lights ??= []).push({ x: x + 0.5, y: y + 0.6, w: 3.2, h: 2.2, color: '#ffb35c', shape: 'glow', when: 'night', strength: 0.4 } as never)
      }
    }
    c.entities = ents as never
  }
  c.map.rows = grid.map((r) => r.map((t) => CHAR_OF[t]).join(''))
  c.map.id = id
  c.map.backdrop = true
  c.map.portals = []
  return c
}
