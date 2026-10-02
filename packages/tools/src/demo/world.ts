// The Ford (docs/game-design.md): the whole demo on one map. A crossing at the edge of the map
// where the road ends at a river; the ferrykeeper's camp, a stranded peddler's cart, a dead tree
// at the narrows, a dry meadow, a marsh, and the hollow the slimes come out of after dark. The far
// bank is the goal. `buildFord()` is pure (the completeness test builds the world in memory);
// run as a script it writes the default web world.
//
//   npx tsx packages/tools/src/demo/world.ts

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Entity, MapMeta, Pos, SceneDef, ScheduleEntry, ScheduleVariant, Text, WorldIndex } from '@lsw/engine'
import { INVARIANTS, PROTECTED_FACTS, type RawChunk } from '@lsw/content'
import { CATALOG } from '../../../client/src/assets/catalog.ts'
import { MapBuilder, rng } from './builder.ts'
import type { PersonDef, Slot } from './person.ts'
import { PEOPLE } from './people.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../client/public/world')
export const VERSION = 'ford-1'
export const START_HOUR = 13
const L = (en: string, zh: string): Text => ({ en, zh })
const SOLID = new Set(['water', 'deepwater', 'tree', 'pine', 'bush', 'rock', 'wall', 'woodwall', 'roof', 'cave_wall', 'lava', 'charred_tree', 'void'])

/** The river: x from..to (inclusive) per row; the narrows are one tile narrower. */
export const RIVER = { from: 26, to: 30, narrows: [9, 10, 11], far: 31 }

/** Where things are (the completeness test reads these too). */
export const AT = {
  spawn: [16, 16],
  campfire: [16, 15],
  tent: [11, 11],
  chest: [14, 13],
  cart: [19, 11],
  haystack: [10, 18],
  axe: [18, 18],
  torch: [17, 16],
  bucket: [24, 16],
  winch: [24, 14],
  raft: [26, 15],
  deadTree: [26, 10],
  burrow: [7, 3],
  fireSlime: [8, 5],
  frostSlime: [24, 4],
  farLanding: [33, 15],
} as const satisfies Record<string, readonly [number, number]>

function buildMap(): MapBuilder {
  const m = new MapBuilder('ford', L('The Ford', '渡口'), 'wild', 40, 30, 'grass', 'Village', 'outdoor', 'frostfang')
  // ------------------------------------------------------------ the river and its banks
  for (let y = 0; y < m.h; y++) {
    const from = RIVER.narrows.includes(y) ? RIVER.from + 1 : RIVER.from
    for (let x = from; x <= RIVER.to; x++) m.set(x, y, 'water')
    if (!RIVER.narrows.includes(y) && y % 7 !== 3) m.set(RIVER.from - 1, y, rng.chance(0.6) ? 'sand' : 'grass')
    m.set(RIVER.far, y, rng.chance(0.5) ? 'sand' : 'grass')
  }
  // the dead tree stands on a spit at the narrows, rock to either side: it can only be felled from the west, across the water
  m.set(26, 9, 'rock')
  m.set(26, 11, 'rock')
  m.set(25, 10, 'grass')
  // the frost slime keeps the river's edge frozen by the hollow's mouth (the ice route, shown before it is taught)
  for (const [x, y] of [[26, 3], [26, 4], [26, 5], [27, 4]] as const) m.set(x, y, 'ice')
  // ------------------------------------------------------------ the edges: cliff and hollow to the north, woods west and south
  for (let x = 0; x < 22; x++) for (let y = 0; y < 2 + (x % 5 === 0 ? 1 : 0); y++) m.set(x, y, 'rock')
  m.organic(7, 3.5, 2.6, 1.6, 'gravel')
  for (let y = 0; y < m.h; y++) for (let x = 0; x < 2; x++) if (!(y >= 15 && y <= 17)) m.set(x, y, rng.chance(0.25) ? 'pine' : 'tree')
  for (let x = 0; x < RIVER.from - 1; x++) for (let y = 27; y < m.h; y++) if (y > 27 || rng.chance(0.7)) m.set(x, y, rng.chance(0.2) ? 'pine' : 'tree')
  for (const [cx, cy, r] of [[4, 8, 2.2], [5, 23, 2.6], [12, 25, 1.8]] as const)
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x - cx, y - cy) <= r && m.get(x, y) === 'grass' && rng.chance(0.7)) m.set(x, y, rng.chance(0.2) ? 'bush' : 'tree')
  // ------------------------------------------------------------ the dry meadow (fire runs here) and the marsh (lightning runs here)
  m.scatter(12, 3, 10, 6, 'drygrass', 0.75)
  m.organic(21, 23, 3.2, 2.4, 'mud')
  for (const [x, y] of [[20, 22], [21, 23], [22, 23], [22, 24]] as const) m.set(x, y, 'water')
  // ------------------------------------------------------------ the road in from the west, and the paths of the camp
  m.path([[0, 16], [6, 16], [12, 17], [16, 18]], 'path', 2, { edge: 'dirt', edgeP: 0.25 })
  m.path([[17, 17], [20, 16], [23, 15]], 'path', 1)
  m.path([[16, 14], [17, 12], [19, 12]], 'path', 1)
  // the near landing and the far one, and the road east into the unwritten
  m.set(25, 15, 'bridge')
  m.set(25, 16, 'bridge')
  m.set(RIVER.far, 15, 'bridge')
  m.set(RIVER.far, 16, 'bridge')
  m.path([[32, 15], [35, 14], [39, 15]], 'path', 1)
  // ------------------------------------------------------------ the camp
  m.scenery('tent_patched', AT.tent[0], AT.tent[1], 'tent')
  m.fixture('fixture/light/campfire', ...AT.campfire, { id: 'ford.campfire', statuses: { lit: -1 } })
  m.fixture('fixture/container/chest', ...AT.chest, { id: 'ford.chest', props: { owner: 'npc.hesper', capacity: 8 } }, [
    { form: 'item/tool/rope', props: { owner: '' } },
    { form: 'item/food/bread', props: { owner: 'npc.hesper' } },
  ])
  m.item({ form: 'item/weapon/blade/axe', material: 'iron', name: L('Old Axe', '旧斧头') }, ...AT.axe)
  m.item('item/light/torch', ...AT.torch)
  m.fixture('fixture/nature/haystack', ...AT.haystack)
  // the peddler's cart and his wares on it
  m.fixture('fixture/furniture/cart', ...AT.cart, { id: 'ford.cart', props: { owner: 'npc.tobin' } })
  m.item({ form: 'item/weapon/magic/wand', material: 'wood', element: 'ice', name: L('Frost Wand', '寒霜魔杖'), props: { owner: 'npc.tobin' } }, ...AT.cart)
  m.item({ form: 'item/vessel/flask/oil', props: { owner: 'npc.tobin' } }, ...AT.cart)
  // the landing: the winch whose rope snapped, the raft, a bucket
  m.fixture('fixture/ferry/winch', ...AT.winch, { id: 'ford.winch', statuses: { broken: -1 } })
  m.fixture('fixture/ferry/raft', ...AT.raft, { id: 'ford.raft' })
  m.item('item/vessel/bucket/empty', ...AT.bucket)
  // the dead tree at the narrows, and the hollow the slimes come out of
  m.fixture('fixture/nature/dead_tree', ...AT.deadTree, { id: 'ford.dead_tree' })
  m.fixture('fixture/nature/burrow', ...AT.burrow, { id: 'ford.burrow' })
  m.creature('slime/fire_slime', ...AT.fireSlime, { id: 'ford.fire_slime', temper: 'wary', sight: 4 }).ai!.night = { map: 'ford', x: 11, y: 16 }
  m.creature('slime/frost_slime', ...AT.frostSlime, { id: 'ford.frost_slime', temper: 'nocturnal', sight: 4 }).ai!.night = { map: 'ford', x: 14, y: 12 }
  // ------------------------------------------------------------ anchors (schedules, scenes) and the goal
  m.anchor('camp.fire', 15, 15)
  m.anchor('camp.warm', 17, 15)
  m.anchor('camp.bed', 15, 16)
  m.anchor('tent.mouth', 12, 14)
  m.anchor('tent.side', 14, 14)
  m.anchor('cart', 19, 12)
  m.anchor('cart.bed', 20, 12)
  m.anchor('landing.winch', 23, 14)
  m.anchor('landing.nets', 23, 17)
  m.anchor('landing.edge', 25, 13)
  m.anchor('far.landing', ...AT.farLanding)
  m.regions = { far_bank: [RIVER.far, 0, m.w - RIVER.far, m.h] }
  // ------------------------------------------------------------ detail
  const grassy = (t: string) => t === 'grass'
  m.sprinkle('tufts', 0.05, (_x, _y, t) => grassy(t))
  m.sprinkle('pebbles', 0.25, (x, y, t) => t === 'gravel' || (t === 'sand' && m.near(x, y, (n) => n === 'water')))
  m.sprinkle('flowers', 0.06, (x, y, t) => grassy(t) && x > RIVER.far)
  m.sprinkle('leaves', 0.1, (x, y, t) => grassy(t) && m.near(x, y, (n) => n === 'tree' || n === 'pine'))
  m.sprinkle('puddle', 0.15, (_x, _y, t) => t === 'mud')
  return m
}

// =================================================================== people

function slots(p: PersonDef, key: string, list: Slot[], at: (name: string) => Pos): ScheduleEntry[] {
  // a variant covers the whole day
  const covered = new Array(24).fill(false)
  for (const [from, to] of list) for (let h = from; h !== to; h = (h + 1) % 24) covered[h] = true
  const gap = covered.indexOf(false)
  if (gap >= 0) throw new Error(`${p.id} schedule ${key} leaves hour ${gap} uncovered`)
  return list.map(([from, to, anchor, activity, needs]) => ({ from, to, ...at(anchor), activity, ...(needs && { uses: needs.uses, need: needs.need }) }))
}

function person(p: PersonDef, at: (name: string) => Pos): Entity {
  const schedule = slots(p, 'default', p.schedules.default, at)
  const schedules: ScheduleVariant[] = Object.entries(p.schedules).map(([key, list]) => ({ key, entries: slots(p, key, list, at) }))
  const hourIn = (s: ScheduleEntry, h: number) => (s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to)
  const first = schedule.find((s) => hourIn(s, START_HOUR)) ?? schedule[0]
  return {
    id: p.id,
    type: `actor/person/${p.role}`,
    name: p.name,
    place: { on: 'tile', map: first.map, x: first.x, y: first.y },
    facing: 'down',
    props: { age: p.age },
    npc: {
      role: p.role,
      schedule,
      look: p.look,
      lines: p.lines.filter((l) => l.key === 'default').map((l) => l.text),
      faction: 'ford',
      person: { temperament: p.temperament, ties: p.ties, lines: p.lines, schedules },
    },
  }
}

// =================================================================== scenes

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

const scenes: SceneDef[] = [
  {
    // The afternoon after the storm: you wake by the ferrykeeper's fire.
    id: 'arrival',
    map: 'ford',
    script: [
      { place: 'npc.hesper', map: 'ford', x: 17, y: 16 },
      { face: 'npc.hesper', dir: 'left' },
      { face: 'player', dir: 'right' },
      { wait: 10 },
      say('npc.hesper', 'Awake. Good. You came in with the storm last night, half drowned on the road.', '醒了。好。你昨夜跟着风暴一起来的，在路上差点淹死。'),
      say('npc.hesper', 'The storm took the ferry rope as well. Nobody crosses until it is mended.', '风暴把渡绳也扯断了。修好之前，谁也过不去。'),
      say('npc.tobin', 'And nobody eats, either!', '也没人有饭吃！', 'surprised'),
      say('npc.hesper', 'That is Tobin. He talks.', '那是托宾。他话多。'),
      { give: 'item/food/bread' },
      say('player', '(Still in your pack: the end of a travel loaf.)', '（行囊里还剩半块路上吃的面包。）'),
      { prop: 'quest', value: 1 },
    ],
  },
  {
    // The ferry: she takes you over on the mended line (or wades you over when every way is gone).
    id: 'ferry',
    map: 'ford',
    manual: true,
    script: [
      { fade: 'out' },
      { wait: 12 },
      { warp: 'ford', x: AT.farLanding[0], y: AT.farLanding[1] },
      { place: 'npc.hesper', map: 'ford', x: 23, y: 14 },
      { fade: 'in' },
      say('npc.hesper', 'There. Mind the step — and the road. Nobody has walked it since the storm.', '到了。小心脚下——也小心那条路。风暴以后还没人走过。'),
    ],
  },
  {
    // The goal is a state: however you got here, the far bank ends the story.
    id: 'far_bank',
    map: 'ford',
    when: { region: 'far_bank' },
    script: [
      { fact: 'ford.crossed', value: 1 },
      { prop: 'quest', value: 2 },
      { wait: 10 },
      say('npc.hesper', 'Go on, then. If you find the far end of that road, come back and tell me what is there.', '那就走吧。要是你走到了那条路的尽头，回来告诉我那边有什么。'),
      say('npc.tobin', 'Wait for me! … No? Next time, then.', '等等我！……不等？那下回吧。'),
      { topic: 'crossed', days: 30 },
      {
        card: L(
          'THE FORD\n\nYou crossed.\nPast here, nothing is written yet.\n\nEverything the world learned from you is in the Threadbook (J).',
          '渡口\n\n你过了河。\n从这里往东，什么都还没写成。\n\n世界从你身上学到的一切，都记在织线簿里（J）。',
        ),
      },
    ],
  },
]

// =================================================================== the world

export interface FordWorld {
  index: WorldIndex
  chunks: RawChunk[]
}

export function buildFord(): FordWorld {
  const m = buildMap()
  for (const [name, [x, y]] of Object.entries(m.anchors)) {
    const t = m.get(x, y)
    if (SOLID.has(t) || m.solid.has(y * m.w + x)) throw new Error(`anchor ${name} at ${x},${y} is not walkable (${t})`)
  }
  const at = (name: string): Pos => {
    const a = m.anchors[name]
    if (!a) throw new Error(`unknown anchor ${name}`)
    return { map: m.id, x: a[0], y: a[1] }
  }
  const npcs = PEOPLE.map((p) => person(p, at))
  const chunk = m.chunk()
  let items = 0
  let fixtures = 0
  let creatures = 0
  const kinds = new Set<string>()
  for (const e of chunk.entities) {
    if (e.type.startsWith('item/')) (items++, kinds.add(`${e.type}|${(e.tags ?? []).join(',')}`))
    else if (e.type.startsWith('fixture/')) fixtures++
    else if (e.type.startsWith('actor/creature')) creatures++
  }
  const meta: MapMeta = { id: m.id, name: m.name, kind: m.kind, region: m.region, width: m.w, height: m.h, portals: m.portals, npcs: npcs.length, items }
  const index: WorldIndex = {
    name: L('The Ford', '渡口'),
    version: VERSION,
    seed: 4242,
    start: { map: m.id, x: AT.spawn[0], y: AT.spawn[1] },
    startHour: START_HOUR,
    maps: [meta],
    npcs,
    player: {
      id: 'player',
      type: 'actor/person/player',
      name: L('You', '你'),
      place: { on: 'none' },
      facing: 'up',
      look: CATALOG.roles.player?.[0] ?? 'NinjaGreen',
      props: { hp: 40, maxHp: 40, atk: 2, def: 0, speed: 2, quest: 0 },
    },
    stats: { maps: 1, npcs: npcs.length, creatures, items, itemKinds: kinds.size, fixtures },
    scenes,
    invariants: INVARIANTS,
    protectedFacts: PROTECTED_FACTS,
    weather: [
      { day: 1, from: 0, to: 17, weather: 'cloud' },
      { day: 1, from: 17, to: 20, weather: 'storm' },
      { day: 1, from: 20, to: 24, weather: 'rain' },
      { day: 2, from: 0, to: 8, weather: 'fog' },
      { day: 2, from: 8, to: 24, weather: 'sun' },
    ],
  }
  return { index, chunks: [chunk] }
}

// =================================================================== write

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase()) {
  const { index, chunks } = buildFord()
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'maps'), { recursive: true })
  for (const c of chunks) writeFileSync(join(OUT, 'maps', `${c.map.id}.json`), JSON.stringify(c))
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
  const lines = PEOPLE.reduce((n, p) => n + p.lines.length, 0)
  const s = index.stats
  console.log(`The Ford: ${s.maps} map, ${s.npcs} people (${lines} lines), ${s.creatures} creatures, ${s.items} items (${s.itemKinds} kinds), ${s.fixtures} fixtures → ${OUT}`)
}
