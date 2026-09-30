// World generator: builds Saenvar at full scale from the ontology and writes the static
// world files the web client streams (index.json + one chunk per map).
//
//   npm run gen:world            (writes packages/client/public/world/)

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Rng, type AiData, type Appearance, type Entity, type MapMeta, type Portal, type Pos, type ScheduleEntry, type Text, type WorldIndex } from '@lsw/engine'
import { FORM_BY_ID, TERRAIN_CHARS, makeItem, pickForm, type Context, type RawChunk } from '@lsw/content'
import { Grid, noise2, type Exit, type Side } from './grid.ts'
import { linesFor, personName } from './names.ts'

const SEED = 20260930
/** Bump when content changes shape (types, map layout): old saves are then discarded. */
const WORLD_VERSION = `saenvar-3-${SEED}`
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../client/public/world')

// ------------------------------------------------------------------ world plan

interface Biome {
  ground: string
  alt: string // secondary ground
  accent: string // flowers etc.
  tree: string
  water: string
  road: string
  wall: string // building walls
}

interface Region {
  id: string
  name: Text
  hub: Text
  villages: [Text, Text]
  wilds: [Text, Text, Text]
  dungeon: Text
  biome: Biome
  wildCreatures: string[]
  dungeonCreatures: string[]
  lore: Text
}

const L = (en: string, zh: string): Text => ({ en, zh })

const REGIONS: Region[] = [
  {
    id: 'frostfang',
    name: L('Frostfang Hold', '霜牙领'),
    hub: L('Snowbridge', '雪桥城'),
    villages: [L('Rimeholm', '凛霜村'), L('Wolfden', '狼窝村')],
    wilds: [L('Frozen Pass', '冰封山口'), L('Pinewatch Woods', '望松林'), L('Barrow Moor', '古墓荒原')],
    dungeon: L('Frost Seal Barrow', '霜印古墓'),
    biome: { ground: 'n', alt: '.', accent: ',', tree: 'P', water: '~', road: '=', wall: 'H' },
    wildCreatures: ['slime/frost_slime', 'beast/frost_wolf', 'beast/wolf', 'slime/green_slime'],
    dungeonCreatures: ['undead/skeleton', 'undead/ghost', 'golem/ice_golem', 'slime/frost_slime'],
    lore: L('The clans still sing of the Frost War.', '部族至今还在传唱霜战的歌。'),
  },
  {
    id: 'crownlands',
    name: L('Argent Crownlands', '银冠京畿'),
    hub: L('Argent City', '银冠城'),
    villages: [L('Millbrook', '磨溪村'), L('Oakfold', '橡栏村')],
    wilds: [L('King\'s Road', '王道'), L('Golden Fields', '金色麦田'), L('Legion Heath', '军团荒地')],
    dungeon: L('Old Legion Catacombs', '旧军团墓穴'),
    biome: { ground: '.', alt: ',', accent: '*', tree: 'T', water: '~', road: '=', wall: 'X' },
    wildCreatures: ['slime/green_slime', 'beast/boar', 'beast/wolf', 'slime/spark_slime'],
    dungeonCreatures: ['undead/skeleton', 'undead/ghost', 'golem/stone_golem', 'beast/bat'],
    lore: L('The Emperor has not been seen in public for a year.', '皇帝已经一年没在人前露面了。'),
  },
  {
    id: 'tidewatch',
    name: L('Tidewatch', '潮汐湾'),
    hub: L('Saltport', '盐港'),
    villages: [L('Gullrock', '鸥岩村'), L('Brinewick', '咸水村')],
    wilds: [L('Salt Flats', '盐滩'), L('Wreck Coast', '沉船海岸'), L('Dune Path', '沙丘小径')],
    dungeon: L('The Drowned Isle', '沉岛'),
    biome: { ground: '.', alt: 's', accent: '*', tree: 'T', water: '~', road: '=', wall: 'H' },
    wildCreatures: ['slime/water_slime', 'crab', 'slime/spark_slime', 'slime/green_slime'],
    dungeonCreatures: ['crab', 'undead/ghost', 'slime/water_slime', 'undead/skeleton'],
    lore: L('Smugglers use the old sea caves.', '走私贩子在用那些老海蚀洞。'),
  },
  {
    id: 'verdant',
    name: L('Verdant Reach', '苍翠林域'),
    hub: L('Canopy', '林冠镇'),
    villages: [L('Mossbank', '苔岸村'), L('Thornwick', '荆棘村')],
    wilds: [L('Elderwood', '古木林'), L('Standing Stones', '立石阵'), L('Fern Hollow', '蕨谷')],
    dungeon: L('Witch Hollow', '女巫谷'),
    biome: { ground: '.', alt: '*', accent: ',', tree: 'T', water: '~', road: '=', wall: 'H' },
    wildCreatures: ['slime/green_slime', 'beast/wolf', 'beast/boar', 'wisp/storm_wisp'],
    dungeonCreatures: ['wisp/storm_wisp', 'beast/bat', 'undead/ghost', 'slime/spark_slime'],
    lore: L('The Dawn College keeps its spire lit all night.', '晨曦学院的尖塔彻夜长明。'),
  },
  {
    id: 'ashen',
    name: L('Ashen Waste', '灰烬荒原'),
    hub: L('Cindergate', '焦门'),
    villages: [L('Slagfield', '渣原村'), L('Emberwell', '余烬井')],
    wilds: [L('Smoking Plain', '冒烟平原'), L('Obsidian Scar', '黑曜裂谷'), L('Exiles\' Road', '流放者之路')],
    dungeon: L('Ash Seal Ruin', '灰印遗迹'),
    biome: { ground: 'a', alt: ',', accent: 'g', tree: 't', water: 'L', road: 'g', wall: 'X' },
    wildCreatures: ['slime/fire_slime', 'imp/fire_imp', 'beast/boar', 'slime/green_slime'],
    dungeonCreatures: ['imp/fire_imp', 'golem/stone_golem', 'slime/fire_slime', 'undead/skeleton'],
    lore: L('The ground here is warm even in winter.', '这里的地面连冬天都是暖的。'),
  },
  {
    id: 'ringed',
    name: L('the Ringed Ruins', '环冠遗墟'),
    hub: L('Ringwatch Camp', '守环营地'),
    villages: [L('Shardfall', '碎环村'), L('Gatekeep', '守门村')],
    wilds: [L('Ring-road Remnant', '环道残段'), L('Fallen Colonnade', '倾颓柱廊'), L('Gate of Echoes', '回音之门')],
    dungeon: L('The Seal Vault', '封印库'),
    biome: { ground: 'g', alt: '.', accent: '#', tree: 'T', water: '~', road: '#', wall: 'X' },
    wildCreatures: ['golem/stone_golem', 'undead/skeleton', 'wisp/storm_wisp', 'slime/spark_slime'],
    dungeonCreatures: ['golem/stone_golem', 'undead/ghost', 'wisp/storm_wisp', 'undead/skeleton'],
    lore: L('The ring-stones answer to Ancient blood.', '环石只回应先民的血脉。'),
  },
]

// ------------------------------------------------------------------ generated map

interface Building {
  x: number
  y: number
  w: number
  h: number
  door: [number, number]
  kind: string
  interior?: GenMap
}

interface GenMap {
  id: string
  name: Text
  region: string
  kind: string
  grid: Grid
  portals: Portal[]
  entities: Entity[]
  exits: Partial<Record<Side, Exit>>
  buildings: Building[]
  /** Outdoor spots for schedules. */
  spots: Record<string, [number, number][]>
  settlement?: string // id of the settlement map an interior belongs to
}

const rng = new Rng(SEED)
const maps: GenMap[] = []
let entitySeq = 0
const eid = (m: string) => `${m}~${(++entitySeq).toString(36)}`

function newMap(id: string, name: Text, region: string, kind: string, w: number, h: number, fill: string): GenMap {
  const m: GenMap = { id, name, region, kind, grid: new Grid(w, h, fill), portals: [], entities: [], exits: {}, buildings: [], spots: {} }
  maps.push(m)
  return m
}

const walkableChar = (c: string) => {
  const t = TERRAIN_CHARS[c]
  return !['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'void'].includes(t)
}

function occupied(m: GenMap, x: number, y: number): boolean {
  return m.entities.some((e) => e.place.on === 'tile' && e.place.x === x && e.place.y === y)
}

function freeTile(m: GenMap, x: number, y: number): boolean {
  return m.grid.in(x, y) && walkableChar(m.grid.get(x, y)) && !occupied(m, x, y) && !m.portals.some((p) => p.x === x && p.y === y)
}

function randomFree(m: GenMap, filter?: (x: number, y: number) => boolean, tries = 400): [number, number] | undefined {
  for (let i = 0; i < tries; i++) {
    const x = rng.int(1, m.grid.w - 2)
    const y = rng.int(1, m.grid.h - 2)
    if (freeTile(m, x, y) && (!filter || filter(x, y))) return [x, y]
  }
  return undefined
}

function addFixture(m: GenMap, type: string, x: number, y: number, extra: Partial<Entity> = {}): Entity {
  const e: Entity = { id: eid(m.id), type, place: { on: 'tile', map: m.id, x, y }, ...extra }
  m.entities.push(e)
  return e
}

function fillContainer(m: GenMap, c: Entity, ctx: Context, n: number) {
  for (let i = 0; i < n; i++) {
    const it = makeItem(rng, pickForm(rng, ctx))
    m.entities.push({ id: eid(m.id), ...it, place: { on: 'inside', holder: c.id } })
  }
}

function dropItem(m: GenMap, ctx: Context, x: number, y: number) {
  const it = makeItem(rng, pickForm(rng, ctx))
  m.entities.push({ id: eid(m.id), ...it, place: { on: 'tile', map: m.id, x, y } })
}

// ------------------------------------------------------------------ exits & links

function planExit(m: GenMap, side: Side, len = 3): Exit {
  const along = side === 'N' || side === 'S' ? m.grid.w : m.grid.h
  const at = Math.floor(along / 2) - 1 + rng.int(-3, 3)
  const e: Exit = { side, at, len }
  m.exits[side] = e
  return e
}

function link(a: GenMap, sa: Side, b: GenMap, sb: Side) {
  const ea = a.exits[sa]!
  const eb = b.exits[sb]!
  const n = Math.min(ea.len, eb.len)
  const ca = a.grid.exitCells(ea)
  const cb = b.grid.exitCells(eb)
  for (let i = 0; i < n; i++) {
    const [tx, ty] = b.grid.inward(eb, i)
    a.portals.push({ x: ca[i][0], y: ca[i][1], to: b.id, tx, ty, label: b.name })
    const [ux, uy] = a.grid.inward(ea, i)
    b.portals.push({ x: cb[i][0], y: cb[i][1], to: a.id, tx: ux, ty: uy, label: a.name })
  }
}

function linkStairs(a: GenMap, ax: number, ay: number, b: GenMap, bx: number, by: number) {
  const arrive = (m: GenMap, x: number, y: number): [number, number] => {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (walkableChar(m.grid.get(x + dx, y + dy))) return [x + dx, y + dy]
    return [x, y + 1]
  }
  const [bx2, by2] = arrive(b, bx, by)
  const [ax2, ay2] = arrive(a, ax, ay)
  a.portals.push({ x: ax, y: ay, to: b.id, tx: bx2, ty: by2, label: b.name })
  b.portals.push({ x: bx, y: by, to: a.id, tx: ax2, ty: ay2, label: a.name })
}

// ------------------------------------------------------------------ towns

const HUB_SPECIAL = ['inn', 'shop', 'smithy', 'temple', 'library', 'barracks', 'shop', 'inn']
const VILLAGE_SPECIAL = ['inn', 'shop']

function genTown(id: string, name: Text, region: Region, kind: 'hub' | 'village', sides: Side[]): GenMap {
  const hub = kind === 'hub'
  const [W, H] = hub ? [96, 72] : [60, 44]
  const b = region.biome
  const m = newMap(id, name, region.id, kind, W, H, b.ground)
  const g = m.grid
  const seed = rng.int(1, 1e9)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = noise2(seed, x, y, 7)
      if (n > 0.72) g.set(x, y, b.alt)
      else if (n < 0.14) g.set(x, y, b.accent)
    }
  g.border(b.tree, 2)
  const cx = Math.floor(W / 2)
  const cy = Math.floor(H / 2)
  const road = hub ? '#' : b.road
  // plaza
  const pw = hub ? 14 : 8
  const ph = hub ? 10 : 6
  g.rect(cx - pw / 2, cy - ph / 2, pw, ph, road)
  // exits + roads to the plaza
  for (const s of sides) {
    const e = planExit(m, s, 3)
    const { sx, sy } = g.openExit(e, road, cx, cy)
    g.road(sx, sy, cx, cy, road, hub ? 3 : 2, rng)
  }
  // ring street in hubs
  if (hub) g.frame(cx - 30, cy - 22, 60, 44, road)
  // buildings
  const specials = [...(hub ? HUB_SPECIAL : VILLAGE_SPECIAL)]
  const target = hub ? 36 : 16
  const isGround = (c: string) => c === b.ground || c === b.alt || c === b.accent
  for (let tries = 0; tries < 6000 && m.buildings.length < target; tries++) {
    const w = rng.int(5, specials.length ? 9 : 7)
    const h = rng.int(4, 5)
    const x = rng.int(3, W - w - 3)
    const y = rng.int(3, H - h - 4)
    let ok = true
    for (let j = y - 1; j <= y + h + 1 && ok; j++) for (let i = x - 1; i <= x + w; i++) if (!isGround(g.get(i, j))) ok = false
    if (!ok) continue
    // the door's street tile must be within reach of a road
    const dx = x + Math.floor(w / 2)
    const dy = y + h - 1
    let near: [number, number] | undefined
    for (let r = 1; r < 10 && !near; r++)
      for (const [ox, oy] of [[0, r], [r, 0], [-r, 0], [0, -r]]) if (g.get(dx + ox, dy + 1 + oy) === road) near = [dx + ox, dy + 1 + oy]
    if (!near) continue
    g.rect(x, y, w, h - 2, 'r')
    g.rect(x, y + h - 2, w, 2, b.wall)
    g.set(dx, dy, 'D')
    g.road(dx, dy + 1, near[0], near[1], hub ? '#' : b.road, 1, undefined, (c) => isGround(c) || c === road)
    const kind2 = specials.length ? specials.shift()! : 'house'
    m.buildings.push({ x, y, w, h, door: [dx, dy], kind: kind2 })
  }
  // decor
  const decor = hub ? 70 : 30
  for (let i = 0; i < decor; i++) {
    const p = randomFree(m, (x, y) => isGround(g.get(x, y)) && !nearDoor(m, x, y))
    if (!p) continue
    const r = rng.next()
    if (r < 0.45) g.set(p[0], p[1], rng.chance(0.7) ? b.tree : 'b')
    else if (r < 0.6) addFixture(m, 'fixture/container/barrel', p[0], p[1])
    else if (r < 0.7) fillContainerAt(m, 'fixture/container/crate', p, 'home', rng.int(1, 3))
    else if (r < 0.78) addFixture(m, 'fixture/nature/logpile', p[0], p[1])
    else if (r < 0.85) addFixture(m, 'fixture/furniture/bench', p[0], p[1])
    else g.set(p[0], p[1], b.accent)
  }
  // plaza centrepiece and stalls
  addFixture(m, hub ? 'fixture/water/fountain' : 'fixture/water/well', cx, cy)
  if (hub) {
    for (let i = 0; i < 8; i++) {
      const sx = cx - pw / 2 + 1 + (i % 4) * 3
      const sy = i < 4 ? cy - ph / 2 + 1 : cy + ph / 2 - 2
      const stall = addFixture(m, 'fixture/furniture/stall', sx, sy)
      stall.contents = []
      m.spots.stall = [...(m.spots.stall ?? []), [sx, sy + (i < 4 ? 1 : -1)]]
    }
    // lamp posts along the ring street
    for (let i = 0; i < 24; i++) {
      const p = randomFree(m, (x, y) => isGround(g.get(x, y)) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => g.get(x + a, y + c) === road))
      if (p) addFixture(m, 'fixture/light/lamppost', p[0], p[1], { statuses: { lit: -1 } })
    }
    addFixture(m, 'fixture/dummy', cx + 9, cy + 7)
    addFixture(m, 'fixture/dummy', cx + 11, cy + 7)
  } else {
    // fields with fences and haystacks
    for (let f = 0; f < 3; f++) {
      const fw = rng.int(6, 10)
      const fh = rng.int(4, 6)
      const fx = rng.int(4, W - fw - 4)
      const fy = rng.int(4, H - fh - 4)
      let ok = true
      for (let j = fy - 1; j <= fy + fh && ok; j++) for (let i = fx - 1; i <= fx + fw && ok; i++) if (!isGround(g.get(i, j)) || occupied(m, i, j)) ok = false
      if (!ok) continue
      g.rect(fx, fy, fw, fh, rng.chance(0.5) ? 'm' : ',')
      for (let i = fx - 1; i <= fx + fw; i++) addFixture(m, 'fixture/fence', i, fy - 1)
      addFixture(m, 'fixture/nature/haystack', fx + fw - 1, fy + fh - 1)
      m.spots.field = [...(m.spots.field ?? []), [fx + 1, fy + 1], [fx + fw - 2, fy + 1]]
    }
  }
  // signs at the exits
  for (const s of sides) {
    const e = m.exits[s]!
    const [ix, iy] = g.inward(e, 0)
    const sx = s === 'N' || s === 'S' ? ix - 1 : ix + (s === 'W' ? 2 : -2)
    const sy = s === 'N' || s === 'S' ? iy + (s === 'N' ? 2 : -2) : iy - 1
    if (freeTile(m, sx, sy) && isGround(g.get(sx, sy))) addFixture(m, 'fixture/sign', sx, sy, { props: { text: `${nameOf(name)} — ${s}` } })
  }
  m.spots.plaza = []
  for (let j = cy - ph / 2; j < cy + ph / 2; j++) for (let i = cx - pw / 2; i < cx + pw / 2; i++) if (freeTile(m, i, j)) m.spots.plaza.push([i, j])
  m.spots.gate = sides.map((s) => g.inward(m.exits[s]!, 1))
  m.spots.ground = []
  for (let k = 0; k < (hub ? 160 : 60); k++) {
    const p = randomFree(m, (x, y) => isGround(g.get(x, y)) && !nearDoor(m, x, y))
    if (p) m.spots.ground.push(p)
  }
  m.spots.street = []
  for (let k = 0; k < 60; k++) {
    const p = randomFree(m, (x, y) => g.get(x, y) === road && !nearDoor(m, x, y))
    if (p) m.spots.street.push(p)
  }
  // interiors
  for (const bld of m.buildings) bld.interior = genInterior(m, bld, region)
  return m
}

function nearDoor(m: GenMap, x: number, y: number) {
  return m.buildings.some((b) => Math.abs(b.door[0] - x) <= 1 && y >= b.door[1] && y <= b.door[1] + 2)
}

function fillContainerAt(m: GenMap, type: string, p: [number, number], ctx: Context, n: number, extra: Partial<Entity> = {}) {
  const c = addFixture(m, type, p[0], p[1], extra)
  fillContainer(m, c, ctx, n)
  return c
}

const nameOf = (t: Text) => (typeof t === 'string' ? t : t.en)

// ------------------------------------------------------------------ interiors

const INTERIOR: Record<string, { w: number; h: number; floor: string; name: [string, string] }> = {
  house: { w: 12, h: 9, floor: 'f', name: ['House', '民居'] },
  inn: { w: 18, h: 12, floor: 'f', name: ['Inn', '旅店'] },
  shop: { w: 14, h: 10, floor: 'f', name: ['General Store', '杂货铺'] },
  smithy: { w: 14, h: 10, floor: 'F', name: ['Smithy', '铁匠铺'] },
  temple: { w: 16, h: 12, floor: 'F', name: ['Temple', '神殿'] },
  library: { w: 16, h: 12, floor: 'c', name: ['Library', '书院'] },
  barracks: { w: 18, h: 10, floor: 'F', name: ['Barracks', '兵营'] },
}

function genInterior(town: GenMap, bld: Building, region: Region): GenMap {
  const spec = INTERIOR[bld.kind]
  const id = `${town.id}.${bld.kind}${town.buildings.indexOf(bld)}`
  const nm = L(`${nameOf(town.name)} ${spec.name[0]}`, `${typeof town.name === 'string' ? town.name : town.name.zh}·${spec.name[1]}`)
  const m = newMap(id, nm, region.id, 'interior', spec.w, spec.h, spec.floor)
  m.settlement = town.id
  const g = m.grid
  const wall = bld.kind === 'house' || bld.kind === 'inn' ? 'H' : 'X'
  g.border(wall)
  g.rect(0, 0, spec.w, 2, wall)
  const dx = Math.floor(spec.w / 2)
  g.set(dx, spec.h - 1, 'D')
  if (bld.kind === 'temple' || bld.kind === 'library') g.rect(dx - 1, 2, 3, spec.h - 3, 'c')
  // portals: town door <-> interior door
  town.portals.push({ x: bld.door[0], y: bld.door[1], to: id, tx: dx, ty: spec.h - 2, label: nm })
  m.portals.push({ x: dx, y: spec.h - 1, to: town.id, tx: bld.door[0], ty: bld.door[1] + 1, label: town.name })
  const put = (type: string, x: number, y: number, extra: Partial<Entity> = {}) => (freeTile(m, x, y) && !(x === dx && y >= spec.h - 3) ? addFixture(m, type, x, y, extra) : undefined)
  const shelfRow = (type: string, ctx: Context, n: [number, number], every = 2) => {
    for (let x = 1; x < spec.w - 1; x += every) {
      if (Math.abs(x - dx) <= 1) continue
      const c = put(type, x, 2)
      if (c) fillContainer(m, c, ctx, rng.int(n[0], n[1]))
    }
  }
  m.spots.bed = []
  m.spots.work = []
  switch (bld.kind) {
    case 'house': {
      shelfRow(rng.pick(['fixture/container/wardrobe', 'fixture/container/shelf']), 'home', [5, 10], 3)
      const c = put('fixture/container/chest', spec.w - 2, 3, rng.chance(0.2) ? { tags: ['locked'] } : {})
      if (c) fillContainer(m, c, 'home', rng.int(5, 11))
      put('fixture/light/fireplace', 1, 3, rng.chance(0.5) ? { statuses: { lit: -1 } } : {})
      put('fixture/furniture/table', dx - 2, 5)
      put('fixture/furniture/chair', dx - 3, 5)
      put('fixture/furniture/chair', dx - 1, 5)
      for (const [x, y] of [[1, 5], [1, 6], [spec.w - 2, 5], [spec.w - 2, 6]] as [number, number][]) {
        if (put('fixture/furniture/bed', x, y)) m.spots.bed.push([x, y])
      }
      const bar = put('fixture/container/barrel', spec.w - 3, 3)
      if (bar) fillContainer(m, bar, 'home', rng.int(3, 7))
      break
    }
    case 'inn': {
      put('fixture/furniture/counter', 3, 3)
      put('fixture/furniture/counter', 4, 3)
      put('fixture/furniture/counter', 5, 3)
      m.spots.work.push([4, 4])
      shelfRow('fixture/container/barrel', 'inn', [4, 9], 2)
      put('fixture/light/fireplace', spec.w - 2, 3, { statuses: { lit: -1 } })
      for (let t = 0; t < 4; t++) {
        const tx = 3 + (t % 2) * 6
        const ty = 5 + Math.floor(t / 2) * 3
        put('fixture/furniture/table', tx, ty)
        put('fixture/furniture/chair', tx - 1, ty)
        put('fixture/furniture/chair', tx + 1, ty)
      }
      for (let y = 4; y < spec.h - 2; y++) if (put('fixture/furniture/bed', spec.w - 2, y)) m.spots.bed.push([spec.w - 2, y])
      break
    }
    case 'shop': {
      shelfRow('fixture/container/shelf', 'shop', [12, 20], 2)
      for (let x = 3; x < spec.w - 3; x++) if (Math.abs(x - dx) > 1) put('fixture/furniture/counter', x, 5)
      m.spots.work.push([dx + 3, 4], [dx - 3, 4])
      for (let y = 6; y < spec.h - 2; y += 2) {
        const c = put('fixture/container/crate', 1, y)
        if (c) fillContainer(m, c, 'shop', rng.int(4, 9))
      }
      break
    }
    case 'smithy': {
      put('fixture/craft/forge', 2, 3, { statuses: { lit: -1 } })
      put('fixture/craft/anvil', 4, 4)
      put('fixture/water/trough', 2, 5)
      m.spots.work.push([5, 4], [3, 4])
      shelfRow('fixture/container/shelf', 'smithy', [6, 12], 3)
      for (let y = 4; y < spec.h - 2; y += 2) {
        const c = put('fixture/container/crate', spec.w - 2, y)
        if (c) fillContainer(m, c, 'smithy', rng.int(3, 8))
      }
      break
    }
    case 'temple': {
      put('fixture/sacred/altar', dx, 3)
      put('fixture/sacred/statue', dx - 3, 2)
      put('fixture/sacred/statue', dx + 3, 2)
      put('fixture/light/candles', dx - 2, 3, { statuses: { lit: -1 } })
      put('fixture/light/candles', dx + 2, 3, { statuses: { lit: -1 } })
      m.spots.work.push([dx, 4])
      for (let y = 6; y < spec.h - 2; y += 2) for (const x of [dx - 4, dx - 3, dx + 3, dx + 4]) put('fixture/furniture/bench', x, y)
      const c = put('fixture/container/chest', 1, 3)
      if (c) fillContainer(m, c, 'temple', rng.int(5, 10))
      break
    }
    case 'library': {
      shelfRow('fixture/container/bookshelf', 'library', [10, 20], 1)
      for (let y = 5; y < spec.h - 3; y += 3) {
        for (const x of [3, spec.w - 4]) {
          put('fixture/furniture/table', x, y)
          put('fixture/furniture/chair', x, y + 1)
          put('fixture/light/candles', x + 1, y, { statuses: { lit: -1 } })
        }
      }
      m.spots.work.push([dx, 4], [3, 7], [spec.w - 4, 7])
      break
    }
    case 'barracks': {
      for (let x = 1; x < spec.w - 1; x++) if (Math.abs(x - dx) > 1 && put('fixture/furniture/bed', x, 3)) m.spots.bed.push([x, 3])
      for (let x = 1; x < spec.w - 1; x++) if (Math.abs(x - dx) > 1 && x % 2 === 0 && put('fixture/furniture/bed', x, 5)) m.spots.bed.push([x, 5])
      const rack = put('fixture/container/shelf', 1, 7)
      if (rack) fillContainer(m, rack, 'smithy', rng.int(6, 10))
      put('fixture/furniture/table', spec.w - 4, 7)
      m.spots.work.push([spec.w - 5, 7])
      break
    }
  }
  const floor: [number, number][] = []
  // keep the doorway lane clear: nobody idles in front of the door
  for (let y = 2; y < spec.h - 1; y++) for (let x = 1; x < spec.w - 1; x++) if (freeTile(m, x, y) && !(Math.abs(x - dx) <= 1 && y >= spec.h - 3)) floor.push([x, y])
  m.spots.floor = floor
  if (!m.spots.bed.length) m.spots.bed = floor.slice(0, 4)
  if (!m.spots.work.length) m.spots.work = floor.slice(0, 3)
  return m
}

// ------------------------------------------------------------------ wilds

function genWild(id: string, name: Text, region: Region, sides: Side[], withStairs: boolean): GenMap & { stairs?: [number, number] } {
  const [W, H] = [64, 48]
  const b = region.biome
  const m: GenMap & { stairs?: [number, number] } = newMap(id, name, region.id, 'wild', W, H, b.ground)
  const g = m.grid
  const s1 = rng.int(1, 1e9)
  const s2 = rng.int(1, 1e9)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = noise2(s1, x, y, 9)
      const t = noise2(s2, x, y, 5)
      if (n > 0.68) g.set(x, y, b.tree)
      else if (n > 0.62) g.set(x, y, 'b')
      else if (t > 0.7) g.set(x, y, b.alt)
      else if (t < 0.18) g.set(x, y, b.accent)
    }
  // ponds (or lava pools in the waste)
  for (let p = 0; p < rng.int(1, 3); p++) {
    const px = rng.int(8, W - 12)
    const py = rng.int(8, H - 12)
    const r = rng.int(2, 4)
    for (let y = -r - 1; y <= r + 1; y++)
      for (let x = -r - 2; x <= r + 2; x++) {
        const d = (x * x) / ((r + 1.5) * (r + 1.5)) + (y * y) / (r * r)
        if (d < 1) g.set(px + x, py + y, d < 0.35 && b.water === '~' ? 'W' : b.water)
      }
    if (region.id === 'frostfang' && rng.chance(0.6)) {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (g.get(px + x, py + y) === '~' && rng.chance(0.5)) g.set(px + x, py + y, 'i')
    }
  }
  // coast: sea on one side
  if (region.id === 'tidewatch') {
    for (let y = 0; y < H; y++) {
      const edge = W - 14 + Math.round(3 * Math.sin(y / 5))
      for (let x = edge; x < W; x++) g.set(x, y, x > edge + 4 ? 'W' : x > edge ? '~' : 's')
      for (let x = edge - 3; x < edge; x++) g.set(x, y, 's')
    }
  }
  // rocks
  for (let i = 0; i < 25; i++) g.set(rng.int(2, W - 3), rng.int(2, H - 3), 'R')
  g.border(b.tree, 2)
  const cx = Math.floor(W / 2)
  const cy = Math.floor(H / 2)
  for (const s of sides) {
    const e = planExit(m, s, 3)
    const { sx, sy } = g.openExit(e, b.road, cx, cy)
    g.road(sx, sy, cx, cy, b.road, 2, rng)
  }
  if (region.id === 'ringed') {
    // ruined colonnades
    for (let k = 0; k < 10; k++) {
      const rx = rng.int(4, W - 12)
      const ry = rng.int(4, H - 10)
      g.rect(rx, ry, rng.int(4, 8), rng.int(3, 6), '#')
      for (let i = 0; i < 6; i++) g.set(rx + rng.int(0, 7), ry + rng.int(0, 5), 'X')
    }
    addFixture(m, 'fixture/sacred/seal_stone', cx + 3, cy + 3)
  }
  if (withStairs) {
    let sx = cx + rng.int(-14, 14)
    let sy = cy + rng.int(-10, 10)
    sx = Math.max(4, Math.min(W - 5, sx))
    sy = Math.max(4, Math.min(H - 5, sy))
    g.rect(sx - 2, sy - 2, 5, 3, 'R')
    g.set(sx, sy, '>')
    g.set(sx, sy + 1, b.road)
    g.road(sx, sy + 1, cx, cy, b.road, 1, rng)
    m.stairs = [sx, sy]
  }
  // a camp
  const camp = randomFree(m, (x, y) => walkableChar(g.get(x, y)) && g.get(x, y) !== b.road)
  if (camp) {
    addFixture(m, 'fixture/light/campfire', camp[0], camp[1])
    const s = randomFree(m, (x, y) => Math.abs(x - camp[0]) + Math.abs(y - camp[1]) <= 3)
    if (s) fillContainerAt(m, 'fixture/container/sack', s, 'wild', rng.int(2, 4))
    const l = randomFree(m, (x, y) => Math.abs(x - camp[0]) + Math.abs(y - camp[1]) <= 3)
    if (l) addFixture(m, 'fixture/nature/logpile', l[0], l[1])
  }
  for (let i = 0; i < 8; i++) {
    const p = randomFree(m)
    if (!p) continue
    const t = rng.pick(['fixture/nature/boulder', 'fixture/nature/mushroom_ring', 'fixture/nature/beehive', 'fixture/nature/haystack', 'fixture/container/pot'])
    if (t === 'fixture/container/pot') fillContainerAt(m, t, p, 'wild', rng.int(1, 3))
    else addFixture(m, t, p[0], p[1])
  }
  for (let i = 0; i < 90; i++) {
    const p = randomFree(m)
    if (p) dropItem(m, 'wild', p[0], p[1])
  }
  m.spots.field = []
  for (let k = 0; k < 40; k++) {
    const p = randomFree(m)
    if (p) m.spots.field.push(p)
  }
  populateCreatures(m, region.wildCreatures, rng.int(18, 26))
  return m
}

// ------------------------------------------------------------------ dungeons

function genDungeon(id: string, name: Text, region: Region, floor: number): GenMap & { up: [number, number]; down?: [number, number] } {
  const [W, H] = [48, 36]
  const stone = region.id === 'frostfang' || region.id === 'ringed' || region.id === 'crownlands'
  const floorC = stone ? 'F' : 'o'
  const wallC = 'O' // dark cave walls read clearly against any floor
  const m = newMap(id, name, region.id, 'dungeon', W, H, wallC) as GenMap & { up: [number, number]; down?: [number, number] }
  const g = m.grid
  const rooms: [number, number, number, number][] = []
  for (let t = 0; t < 300 && rooms.length < 9; t++) {
    const w = rng.int(5, 10)
    const h = rng.int(4, 8)
    const x = rng.int(2, W - w - 2)
    const y = rng.int(2, H - h - 2)
    if (rooms.some(([a, b, c, d]) => x < a + c + 2 && x + w + 2 > a && y < b + d + 2 && y + h + 2 > b)) continue
    rooms.push([x, y, w, h])
    g.rect(x, y, w, h, floorC)
  }
  rooms.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < rooms.length; i++) {
    const [ax, ay, aw, ah] = rooms[i - 1]
    const [bx, by, bw, bh] = rooms[i]
    g.road(ax + (aw >> 1), ay + (ah >> 1), bx + (bw >> 1), by + (bh >> 1), floorC, 2, rng)
  }
  const [fx, fy, fw] = rooms[0]
  m.up = [fx + (fw >> 1), fy]
  g.set(m.up[0], m.up[1], '<')
  if (floor === 1) {
    const [lx, ly, lw, lh] = rooms[rooms.length - 1]
    m.down = [lx + (lw >> 1), ly + lh - 1]
    g.set(m.down[0], m.down[1], '>')
  }
  if (region.id === 'ashen') for (let i = 0; i < 3; i++) {
    const [rx, ry, rw, rh] = rng.pick(rooms.slice(1))
    g.rect(rx + 1, ry + 1, Math.max(1, rw - 4), Math.max(1, rh - 4), 'L')
  }
  if (region.id === 'tidewatch') for (let i = 0; i < 3; i++) {
    const [rx, ry, rw, rh] = rng.pick(rooms.slice(1))
    g.rect(rx + 1, ry + 1, Math.max(1, rw - 4), Math.max(1, rh - 4), '~')
  }
  for (const [rx, ry, rw, rh] of rooms.slice(1)) {
    const inRoom = (x: number, y: number) => x >= rx && x < rx + rw && y >= ry && y < ry + rh
    const c = randomFree(m, inRoom)
    if (c) fillContainerAt(m, 'fixture/container/chest', c, 'dungeon', rng.int(2, 6), rng.chance(0.4) ? { tags: ['locked'] } : {})
    for (let k = 0; k < rng.int(1, 3); k++) {
      const p = randomFree(m, inRoom)
      if (p) fillContainerAt(m, rng.pick(['fixture/container/pot', 'fixture/container/crate', 'fixture/container/barrel']), p, 'dungeon', rng.int(0, 3))
    }
    const br = randomFree(m, inRoom)
    if (br && rng.chance(0.5)) addFixture(m, 'fixture/light/brazier', br[0], br[1], rng.chance(0.6) ? { statuses: { lit: -1 } } : {})
    for (let k = 0; k < rng.int(2, 5); k++) {
      const p = randomFree(m, inRoom)
      if (p) dropItem(m, 'dungeon', p[0], p[1])
    }
  }
  populateCreatures(m, region.dungeonCreatures, rng.int(20, 28))
  return m
}

// ------------------------------------------------------------------ creatures

const RANGED = new Set(['imp/fire_imp', 'wisp/storm_wisp', 'undead/ghost'])
const PASSIVE = new Set(['slime/green_slime', 'slime/water_slime', 'crab'])
const LOOT: Record<string, string[]> = {
  beast: ['item/food/meat/raw', 'item/material/leather', 'item/material/bone'],
  undead: ['item/material/bone', 'item/misc/skull', 'item/valuable/coin_pouch'],
  golem: ['item/material/stone', 'item/material/iron_ore', 'item/gem'],
  slime: ['item/material/herb', 'item/food/berries'],
  imp: ['item/material/coal', 'item/material/fireweed'],
  wisp: ['item/gem', 'item/material/feather'],
  crab: ['item/food/fish/raw', 'item/material/salt'],
}

function populateCreatures(m: GenMap, kinds: string[], n: number) {
  for (let i = 0; i < n; i++) {
    const p = randomFree(m, (x, y) => !m.portals.some((q) => Math.abs(q.x - x) + Math.abs(q.y - y) < 6) && !Object.values(m.exits).some((e) => e && m.grid.exitCells(e).some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 8)))
    if (!p) continue
    const k = rng.pick(kinds)
    const type = `actor/creature/${k}`
    const ai: AiData = {
      behaviour: RANGED.has(k) ? 'ranged' : 'melee',
      hostile: !PASSIVE.has(k),
      sight: RANGED.has(k) ? 7 : 6,
      home: { map: m.id, x: p[0], y: p[1] },
    }
    const c: Entity = { id: eid(m.id), type, place: { on: 'tile', map: m.id, x: p[0], y: p[1] }, ai, facing: 'down' }
    m.entities.push(c)
    const loot = LOOT[k.split('/')[0]] ?? []
    if (loot.length && rng.chance(0.7)) {
      const form = FORM_BY_ID[rng.pick(loot)]
      if (form) m.entities.push({ id: eid(m.id), ...makeItem(rng, form), place: { on: 'inside', holder: c.id } })
    }
  }
}

// ------------------------------------------------------------------ people

interface Settlement {
  town: GenMap
  region: Region
  wilds: GenMap[]
}

const npcs: (Entity & { _items?: Entity[] })[] = []

function look(): Appearance {
  return { skin: rng.int(0, 7), hair: rng.int(0, 11), hairStyle: rng.int(0, 7), top: rng.int(0, 19), bottom: rng.int(0, 19) }
}

function spotIn(m: GenMap, key: string): [number, number] {
  const list = m.spots[key]?.length ? m.spots[key] : m.spots.floor?.length ? m.spots.floor : m.spots.plaza?.length ? m.spots.plaza : m.spots.field
  return list ? rng.pick(list) : [Math.floor(m.grid.w / 2), Math.floor(m.grid.h / 2)]
}

const at = (m: GenMap, key: string) => {
  const [x, y] = spotIn(m, key)
  return { map: m.id, x, y }
}

function makeNpc(role: string, home: Pos, schedule: ScheduleEntry[], region: Region, settlementId: string): Entity {
  const id = `npc.${(npcs.length + 1).toString(36)}`
  const items: Entity[] = []
  for (let i = 0; i < rng.int(2, 5); i++) items.push({ id: `${id}~${i}`, ...makeItem(rng, pickForm(rng, 'npc')), place: { on: 'inside', holder: id } })
  const first = schedule.find((s) => s.from <= 8 && s.to > 8) ?? schedule[0]
  const e: Entity & { _items?: Entity[] } = {
    id,
    type: `actor/person/${role}`,
    name: personName(rng),
    place: { on: 'tile', map: first.map, x: first.x, y: first.y },
    facing: 'down',
    npc: { role, home, schedule, appearance: look(), lines: linesFor(role, rng, region.lore), faction: settlementId },
    _items: items,
  }
  npcs.push(e)
  return e
}

function day(home: Pos, morning: Pos, work: Pos, lunch: Pos, evening: Pos): ScheduleEntry[] {
  const s = (from: number, to: number, p: Pos, activity: string): ScheduleEntry => ({ from, to, map: p.map, x: p.x, y: p.y, activity })
  return [s(22, 6, home, 'sleep'), s(6, 8, morning, 'morning'), s(8, 12, work, 'work'), s(12, 13, lunch, 'lunch'), s(13, 18, work, 'work'), s(18, 22, evening, 'leisure')]
}

const HUB_ROLES = ['villager', 'villager', 'merchant', 'noble', 'child', 'child', 'scholar', 'bard', 'beggar', 'soldier', 'guard', 'mage', 'herbalist', 'hunter', 'miner', 'traveler']
const VILLAGE_ROLES = ['farmer', 'farmer', 'farmer', 'villager', 'child', 'child', 'herbalist', 'hunter', 'fisher', 'miner']

function populateSettlement(s: Settlement) {
  const { town, region } = s
  const hub = town.kind === 'hub'
  const by = (k: string) => town.buildings.filter((b) => b.kind === k).map((b) => b.interior!)
  const inns = by('inn')
  const shops = by('shop')
  const outdoorWork = (role: string): Pos => {
    switch (role) {
      case 'farmer':
        return town.spots.field?.length ? at(town, 'field') : at(rng.pick(s.wilds), 'field')
      case 'hunter':
      case 'miner':
      case 'herbalist':
        return at(rng.pick(s.wilds), 'field')
      case 'guard':
      case 'soldier':
        return at(town, 'gate')
      case 'merchant':
        return town.spots.stall?.length ? at(town, 'stall') : at(shops.length ? rng.pick(shops) : town, 'work')
      case 'fisher':
      case 'sailor':
        return at(rng.pick(s.wilds), 'field')
      case 'scholar':
      case 'mage': {
        const lib = by('library')
        return lib.length ? at(rng.pick(lib), 'work') : at(town, 'plaza')
      }
      case 'child':
      case 'beggar':
      case 'bard':
        return at(town, 'plaza')
      default:
        return at(town, rng.pick(['street', 'street', 'ground', 'plaza']))
    }
  }
  const outside = (): Pos => at(town, rng.pick(['street', 'ground', 'ground', 'plaza']))
  const leisure = (home: Pos): Pos => {
    const r = rng.next()
    if (r < 0.45) return home
    if (r < 0.75 && inns.length) return at(rng.pick(inns), 'floor')
    return outside()
  }
  const lunch = (home: Pos): Pos => {
    const r = rng.next()
    if (r < 0.4 && inns.length) return at(rng.pick(inns), 'floor')
    if (r < 0.7) return home
    return outside()
  }
  // workers who live where they work
  for (const b of town.buildings) {
    const m = b.interior!
    const staff: Record<string, [string, number]> = { inn: ['innkeeper', 2], shop: ['merchant', 2], smithy: ['smith', 2], temple: ['priest', 3], library: ['scholar', 2], barracks: ['guard', 12] }
    const st = staff[b.kind]
    if (!st) continue
    for (let i = 0; i < st[1]; i++) {
      const home = at(m, 'bed')
      const work = st[0] === 'guard' && i % 2 ? at(town, 'gate') : at(m, 'work')
      makeNpc(st[0], home, day(home, at(m, 'floor'), work, at(m, 'floor'), rng.chance(0.5) ? leisure(home) : work), region, town.id)
    }
  }
  // residents
  for (const b of town.buildings.filter((b) => b.kind === 'house')) {
    const m = b.interior!
    const n = rng.int(hub ? 5 : 4, hub ? 7 : 6)
    for (let i = 0; i < n; i++) {
      const role = rng.pick(hub ? HUB_ROLES : VILLAGE_ROLES)
      const home = at(m, 'bed')
      const morning = rng.chance(0.7) ? at(m, 'floor') : outside()
      makeNpc(role, home, day(home, morning, outdoorWork(role), lunch(at(m, 'floor')), leisure(at(m, 'floor'))), region, town.id)
    }
  }
}

function populateTravelers(region: Region, hub: GenMap, villages: GenMap[], wilds: GenMap[], n: number) {
  const inns = hub.buildings.filter((b) => b.kind === 'inn').map((b) => b.interior!)
  for (let i = 0; i < n; i++) {
    const home = at(rng.pick(inns), 'floor')
    const v = rng.pick(villages)
    const w = rng.pick(wilds)
    const s = (from: number, to: number, p: Pos, activity: string): ScheduleEntry => ({ from, to, map: p.map, x: p.x, y: p.y, activity })
    makeNpc(rng.pick(['traveler', 'traveler', 'merchant', 'bard', 'soldier', 'sailor']), home, [
      s(22, 7, home, 'sleep'),
      s(7, 10, at(hub, rng.pick(['street', 'ground', 'plaza'])), 'market'),
      s(10, 13, at(w, 'field'), 'travel'),
      s(13, 17, at(v, 'plaza'), 'visit'),
      s(17, 20, at(w, 'field'), 'travel'),
      s(20, 22, at(rng.pick(inns), 'floor'), 'evening'),
    ], region, hub.id)
  }
}

// ------------------------------------------------------------------ the starting valley

function genStart(): GenMap {
  const W = 46
  const H = 34
  const m = newMap('hearthvale', L('Hearthvale', '炉谷'), 'frostfang', 'village', W, H, '.')
  const g = m.grid
  const seed = 77
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (noise2(seed, x, y, 6) < 0.15) g.set(x, y, '*')
  g.border('T', 2)
  // dry field in the north-east (the fire lesson)
  g.rect(26, 3, 17, 10, ',')
  for (let x = 25; x <= 42; x++) addFixture(m, 'fixture/fence', x, 13)
  addFixture(m, 'fixture/nature/haystack', 30, 6)
  addFixture(m, 'fixture/nature/haystack', 36, 9)
  addFixture(m, 'fixture/nature/haystack', 40, 5)
  // pond in the south-east with a little bridge
  for (let y = 22; y <= 30; y++)
    for (let x = 28; x <= 42; x++) {
      const d = ((x - 35) * (x - 35)) / 49 + ((y - 26) * (y - 26)) / 16
      if (d < 1) g.set(x, y, d < 0.3 ? 'W' : '~')
    }
  // road west to Rimeholm, and village lanes
  const e = planExit(m, 'W', 3)
  e.at = 15
  g.openExit(e, '=', 20, 16)
  g.road(1, 16, 22, 16, '=', 2)
  g.road(22, 16, 22, 31, '=', 1)
  g.road(22, 16, 22, 4, '=', 1)
  // three houses
  const houses: [number, number, number, string][] = [
    [6, 5, 7, 'house'],
    [14, 5, 7, 'shop'],
    [6, 21, 8, 'house'],
  ]
  for (const [x, y, w, kind] of houses) {
    g.rect(x, y, w, 3, 'r')
    g.rect(x, y + 3, w, 2, 'H')
    const dx = x + Math.floor(w / 2)
    g.set(dx, y + 4, 'D')
    g.road(dx, y + 5, dx, 16, '=', 1)
    m.buildings.push({ x, y, w, h: 5, door: [dx, y + 4], kind })
  }
  const frost = REGIONS[0]
  for (const b of m.buildings) b.interior = genInterior(m, b, frost)
  // village square: well, campfire, training dummy, notice board
  addFixture(m, 'fixture/water/well', 18, 18)
  addFixture(m, 'fixture/light/campfire', 25, 19)
  addFixture(m, 'fixture/nature/logpile', 26, 20)
  addFixture(m, 'fixture/dummy', 12, 18)
  addFixture(m, 'fixture/sign/noticeboard', 20, 14, { props: { text: 'Hearthvale notice: slimes in the south meadow. Keep fire away from the hay field. — Elder Maren' } })
  addFixture(m, 'fixture/sign', 4, 14, { props: { text: '← Rimeholm · Snowbridge' } })
  const chest = addFixture(m, 'fixture/container/chest', 15, 19, { tags: ['locked'] })
  for (const f of ['item/weapon/magic/wand', 'item/potion/healing', 'item/gem'])
    m.entities.push({ id: eid(m.id), ...makeItem(rng, FORM_BY_ID[f], { element: f.includes('wand') ? 'lightning' : null, material: f.includes('wand') ? 'crystal' : undefined }), place: { on: 'inside', holder: chest.id } })
  const crate = addFixture(m, 'fixture/container/crate', 27, 19)
  fillContainer(m, crate, 'home', 3)
  const barrel = addFixture(m, 'fixture/container/barrel', 17, 19)
  fillContainer(m, barrel, 'inn', 2)
  // a starter kit laid out around the square
  const kit: [string, number, number, Parameters<typeof makeItem>[2]?][] = [
    ['item/vessel/bucket/empty', 19, 20],
    ['item/vessel/bucket/water', 20, 20],
    ['item/light/torch', 23, 18],
    ['item/vessel/flask/oil', 24, 21],
    ['item/weapon/magic/wand', 21, 21, { element: 'fire', material: 'wood', quality: 'common' }],
    ['item/weapon/magic/wand', 22, 21, { element: 'ice', material: 'bone', quality: 'common' }],
    ['item/weapon/magic/staff', 23, 22, { element: 'wind', material: 'wood', quality: 'common' }],
    ['item/weapon/blade/sword', 13, 17, { material: 'iron', quality: 'common', element: null }],
    ['item/weapon/blade/axe', 24, 13, { material: 'iron', quality: 'common', element: null }],
    ['item/tool/pickaxe', 25, 13, { material: 'iron', quality: 'common' }],
    ['item/tool/smith_hammer', 23, 13, { material: 'iron', quality: 'common' }],
    ['item/tool/rope', 20, 22],
    ['item/food/fish/raw', 26, 18],
    ['item/food/apple', 19, 17],
    ['item/key', 10, 11, { material: 'iron', quality: 'common' }],
    ['item/vessel/flask/empty', 14, 12],
  ]
  for (const [f, x, y, opts] of kit) m.entities.push({ id: eid(m.id), ...makeItem(rng, FORM_BY_ID[f], opts ?? {}), place: { on: 'tile', map: m.id, x, y } })
  m.entities.push({ id: 'start~bread', ...makeItem(rng, FORM_BY_ID['item/food/bread']), place: { on: 'inside', holder: 'player' } })
  // creatures in the south meadow and by the pond
  const slimes: [string, number, number, boolean][] = [
    ['slime/green_slime', 10, 28, false],
    ['slime/green_slime', 14, 30, false],
    ['slime/fire_slime', 17, 27, false],
    ['slime/spark_slime', 26, 29, false],
    ['slime/water_slime', 30, 21, false],
    ['slime/frost_slime', 42, 20, false],
    ['beast/boar', 38, 15, false],
  ]
  for (const [k, x, y, hostile] of slimes)
    m.entities.push({ id: eid(m.id), type: `actor/creature/${k}`, place: { on: 'tile', map: m.id, x, y }, facing: 'down', ai: { behaviour: 'melee', hostile, sight: 5, home: { map: m.id, x, y } } })
  m.spots.plaza = [[17, 17], [19, 16], [21, 18], [24, 17], [16, 20], [20, 19]]
  m.spots.field = [[30, 11], [34, 11], [38, 11], [27, 8]]
  m.spots.street = [[22, 10], [22, 24], [12, 16], [8, 16]]
  return m
}

// ------------------------------------------------------------------ assemble

function main() {
  const start = genStart()
  const regionMaps: { hub: GenMap; wilds: GenMap[]; villages: GenMap[]; dungeons: GenMap[] }[] = []
  for (const [ri, region] of REGIONS.entries()) {
    const id = region.id
    const wildA = genWild(`${id}.wildA`, region.wilds[0], region, ['W', 'E'], false)
    const wildB = genWild(`${id}.wildB`, region.wilds[1], region, ['N', 'S'], false)
    const wildC = genWild(`${id}.wildC`, region.wilds[2], region, ['E', 'W'], true)
    const hub = genTown(`${id}.hub`, region.hub, region, 'hub', ['N', 'E', 'S', 'W'])
    const villageA = genTown(`${id}.villageA`, region.villages[0], region, 'village', ri === 0 ? ['W', 'E'] : ['W'])
    const villageB = genTown(`${id}.villageB`, region.villages[1], region, 'village', ['N'])
    const d1 = genDungeon(`${id}.dungeon1`, L(`${nameOf(region.dungeon)} I`, `${(region.dungeon as { zh: string }).zh}·上层`), region, 1)
    const d2 = genDungeon(`${id}.dungeon2`, L(`${nameOf(region.dungeon)} II`, `${(region.dungeon as { zh: string }).zh}·下层`), region, 2)
    link(hub, 'E', wildA, 'W')
    link(wildA, 'E', villageA, 'W')
    link(hub, 'S', wildB, 'N')
    link(wildB, 'S', villageB, 'N')
    link(hub, 'W', wildC, 'E')
    linkStairs(wildC, wildC.stairs![0], wildC.stairs![1], d1, d1.up[0], d1.up[1])
    linkStairs(d1, d1.down![0], d1.down![1], d2, d2.up[0], d2.up[1])
    if (ri === 0) link(villageA, 'E', start, 'W')
    regionMaps.push({ hub, wilds: [wildA, wildB, wildC], villages: [villageA, villageB], dungeons: [d1, d2] })
  }
  // ring of regions: hub N <-> next region's wildC W
  for (let i = 0; i < REGIONS.length; i++) {
    const a = regionMaps[i].hub
    const b = regionMaps[(i + 1) % REGIONS.length].wilds[2]
    link(a, 'N', b, 'W')
  }
  // people
  for (const [ri, region] of REGIONS.entries()) {
    const r = regionMaps[ri]
    populateSettlement({ town: r.hub, region, wilds: r.wilds })
    for (const v of r.villages) populateSettlement({ town: v, region, wilds: r.wilds })
    populateTravelers(region, r.hub, r.villages, r.wilds, 60)
  }
  populateSettlement({ town: start, region: REGIONS[0], wilds: [regionMaps[0].wilds[0]] })

  // write
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'maps'), { recursive: true })
  let items = 0
  let fixtures = 0
  let creatures = 0
  const kinds = new Set<string>()
  const metas: MapMeta[] = []
  for (const m of maps) {
    for (const e of m.entities) {
      if (e.type.startsWith('item/')) {
        items++
        kinds.add(`${e.type}|${(e.tags ?? []).join(',')}`)
      } else if (e.type.startsWith('fixture/')) fixtures++
      else if (e.type.startsWith('actor/creature')) creatures++
    }
    const raw: RawChunk = {
      map: { id: m.id, name: m.name, region: m.region, kind: m.kind, width: m.grid.w, height: m.grid.h, rows: m.grid.rows(), portals: m.portals },
      entities: m.entities,
    }
    writeFileSync(join(OUT, 'maps', `${m.id}.json`), JSON.stringify(raw))
    metas.push({
      id: m.id,
      name: m.name,
      kind: m.kind,
      region: m.region,
      width: m.grid.w,
      height: m.grid.h,
      portals: m.portals,
      npcs: npcs.filter((n) => n.place.on === 'tile' && n.place.map === m.id).length,
      items: m.entities.filter((e) => e.type.startsWith('item/')).length,
    })
  }
  for (const n of npcs)
    for (const it of n._items ?? []) {
      items++
      kinds.add(`${it.type}|${(it.tags ?? []).join(',')}`)
    }
  const player: Entity = {
    id: 'player',
    type: 'actor/person/player',
    name: L('You', '你'),
    place: { on: 'none' },
    facing: 'down',
    props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2 },
  }
  const index: WorldIndex = {
    name: L('Saenvar', '赛恩瓦尔'),
    version: WORLD_VERSION,
    seed: SEED,
    start: { map: 'hearthvale', x: 19, y: 18 },
    maps: metas,
    npcs,
    player,
    stats: {
      maps: maps.length,
      npcs: npcs.length,
      creatures,
      items,
      itemKinds: kinds.size,
      fixtures,
    },
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
  const ext = maps.filter((m) => m.kind !== 'interior').length
  console.log(
    `Saenvar: ${maps.length} maps (${ext} exterior, ${maps.length - ext} interiors), ${npcs.length} NPCs, ${creatures} creatures, ` +
      `${items} items (${kinds.size} distinct kinds), ${fixtures} fixtures → ${OUT}`,
  )
}

main()
