// Chapter 2, the Second Seal (docs/chapter-2.md; content chapter2.ts): the Scarred March over Cinder Pass — its maps,
// the places its people keep, and the chapter's scenes. Off the pass's south side, once the dragon is dead: the
// Lashmarks, red ground cut by ravines like the marks of a lash, where the Red Host's two companies meet every dusk;
// the camp of the Left Company behind its palisade, its war hall and its field hospital; the Scourging House of the Red
// Order, its court of whipping posts, its hall and the undercroft where red channels run west under the wall; the
// War-Giver's Bastion, its old guard dead at their posts; and behind its fog the Pillar Yard, where Matthias stands
// chained to the broken Scourging Post. The first half of the chapter (Emberfall, the dragon) is maps.ts and scenes.ts.

import type { AiData, StepDef } from '@openworld/engine'
import { CH1, CH2, CHAPTER_THREE, LEFT_BANNER, MATTHIAS_CAMPAIGN, MATTHIAS_ID, POST_CHAIN, RED_CHANNEL, RED_STANDARD, SCOURGING_POST, WAR_DRUM, WHIPPING_POST, createBoss } from '@openworld-game/content'
import { MapBuilder, type Cell } from '../builder.ts'
import { L, GROUND_YIELD, appears, lay, levelCreatures } from '../kit.ts'
import { home } from '../village.ts'
import type { Place } from '../continent/generate.ts'
import { planHall, glow, lit } from '../showcase/halls.ts'
import { decor, strew, unshut } from '../showcase/dress.ts'
import { glowAt, palisade, stair } from '../showcase/ground.ts'
import { linkStair } from '../showcase/rooms.ts'
import { wildFloor } from '../wildfloor.ts'
import { noise, seal, ways } from './country.ts'
import { PASS } from './maps.ts'

/** Edge openings: the pass's south side down into the Lashmarks, then east to the camp, the Scourging House, the Bastion. */
export const MARCH = {
  lash: { w: 56, h: 30, north: [8, 9, 10], east: [13, 14, 15] },
  camp: { w: 44, h: 30, west: [13, 14, 15], east: [13, 14, 15], south: [20, 21] },
  house: { w: 40, h: 28, west: [13, 14, 15], east: [13, 14, 15] },
  bastion: { w: 40, h: 30, west: [13, 14, 15] },
  yard: { w: 30, h: 30 },
} as const

/** Where the scenes stage their people (the dusk's lines, the bridges, where Dunn sits down). */
export const CH2_AT = {
  descent: { dunn: [10, 9] as Cell, meet: [10, 6] as Cell, away: [22, 13] as Cell },
  dusk: {
    left: [[22, 17], [24, 17], [26, 17], [28, 17]] as Cell[],
    right: [[17, 27], [35, 27]] as Cell[],
    bridge: [[17, 19], [35, 19], [17, 24], [35, 24]] as Cell[],
    dunn: [24, 18] as Cell,
    vera: [26, 16] as Cell,
  },
  undercroft: { severin: [5, 8] as Cell },
  // (one comes in out of his sight, as into the knight's field: he sees twelve cells)
  yard: { arrive: [14, 26] as Cell, post: [12, 5] as Cell, matthias: [18, 12] as Cell, severin: [9, 6] as Cell, gate: [[14, 28], [15, 28]] as Cell[] },
} as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 6 })
const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })
const inRect = ([rx, ry, rw, rh]: readonly number[], x: number, y: number) => x >= rx && y >= ry && x < rx + rw && y < ry + rh
/** The March's region for the halls built on a plan (planHall reads a place's region). */
const MARCH_PLACE = { region: 'redmarch' } as Place

/** The nearest free tile to (x, y). */
export function spot(m: MapBuilder, x: number, y: number, walk = false): [number, number] {
  for (let r = 0; r <= 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        if (walk ? m.walkable(x + dx, y + dy) : m.free(x + dx, y + dy)) return [x + dx, y + dy]
      }
  throw new Error(`no open tile near ${m.id}:${x},${y}`)
}

/** A hall of the March on its plan (plans.ts HALLS), walked into: its rooms walled as the plan's parts. */
function marchHall(key: Parameters<typeof planHall>[1], id: string, en: string, zh: string, floor: string, rooms: string[], opts: Parameters<typeof planHall>[5] = {}) {
  const { m, P } = planHall(MARCH_PLACE, key, id, L(en, zh), floor, opts)
  m.backdrop = false
  for (const r of rooms) m.rooms.push({ style: 'shell', x: P[r].x - 1, y: P[r].y - 1, w: P[r].w + 2, h: P[r].h + 2 })
  return { m, P }
}

/** A run of the March's palisade down column `x` from y0 to y1: its pieces as long as fit, a cell left over a stake fence. */
function palisadeY(b: MapBuilder, x: number, y0: number, y1: number): void {
  let y = y0
  while (y <= y1) {
    const n = [8, 6, 4, 3].find((k) => y + k - 1 <= y1)
    if (!n) {
      b.fence('fence', [x, y], [x, y1])
      return
    }
    b.building(`march_palisade_y${n}`, x, y, [], true)
    y += n
  }
}

/** The Red Host's banner: a white pillar on red; the Left Company's carry a row of stitches under the pillar. */
const banner = (left: boolean) => ({
  name: L('A standard of the Red Host', '赤军的军旗'),
  tags: ['readable'],
  props: left
    ? { text: 'A red banner on a pole, a white pillar stitched on it, and under the pillar a short row of stitches: the Left Company\'s.', text_zh: '旗杆上挂着一面红旗，绣着一根白色的柱子，柱子下面有一小排针脚：这是左营的旗。' }
    : { text: 'A red banner on a pole, a white pillar stitched on it. It is the banner of the near side of the ravine, without the row of stitches.', text_zh: '旗杆上挂着一面红旗，绣着一根白色的柱子。和沟这边的那面一模一样，只是少了那排针脚。' },
})

// =================================================================== the Lashmarks

/** The plain's height (half levels); the ravines' floor lies two levels below it. */
const PLAIN = 4
/** The ravines: where each runs (x from, to), its middle row as a curve, its half-width. The middle one is the big one. */
const RAVINES = [
  { x0: 20, x1: 47, mid: (x: number) => 5.5 + 1.2 * Math.sin(x / 4), half: 2.3 },
  { x0: 3, x1: 52, mid: (x: number) => 21.5 + 1.4 * Math.sin(x / 5 + 1), half: 2.9 },
] as const
/** The plank bridges over the middle ravine (their columns), the stair down into it at its west end. */
const BRIDGES = [16, 34] as const
const RAVINE_STAIR = [5, 3] as const

const inRavine = (r: (typeof RAVINES)[number], x: number, y: number) => {
  if (x < r.x0 || x > r.x1) return false
  const taper = Math.min(1, (x - r.x0) / 3, (r.x1 - x) / 3)
  return Math.abs(y - r.mid(x)) <= r.half * taper + 0.6
}

/**
 * The Lashmarks: where the road comes down off Cinder Pass onto red ground, cut east to west by long ravines like the
 * marks of a lash. The road runs east along the plain between them to the camp. South of it, on the near edge of the
 * middle ravine, the Left Company forms its line at dusk; the Right comes over the two plank bridges from the far side.
 * The old battlefield is left where it lies: bones, broken spears, a cart; two banners alike either side of the ravine.
 * A stair is cut down into the middle ravine at its west end, where the drummer's drum fell.
 */
export function buildLashmarks(): MapBuilder {
  const P = MARCH.lash
  const m = new MapBuilder('lashmarks', L('The Lashmarks', '鞭痕原'), 'wild', P.w, P.h, 'dirt', 'field', 'outdoor', 'redmarch')
  m.gearLevel = 8
  m.raise(0, 0, m.w, m.h, PLAIN)
  // red dirt, dry grass where the noise swells, drifted sand in its hollows
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const n = noise(x, y, 6, 701)
      if (n > 0.7) m.set(x, y, 'drygrass')
      else if (n < 0.2) m.set(x, y, 'sand')
    }
  // the road down off the pass, then east between the ravines
  m.path([[9, 0], [9, 4], [11, 8], [15, 11], [23, 13], [33, 14], [44, 13], [55, 14]], 'path', 3, { edge: 'sand', edgeP: 0.08 })
  // the ravines: two levels down, their floors sand and bare dirt
  for (const r of RAVINES)
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++)
        if (inRavine(r, x, y)) {
          m.raise(x, y, 1, 1, 0)
          m.set(x, y, noise(x, y, 3, 707) > 0.5 ? 'sand' : 'dirt')
        }
  const [ravineA, ravineB] = RAVINES
  // the bridges over the middle ravine: planks at the plain's height, three wide
  for (const bx of BRIDGES)
    for (let x = bx; x < bx + 3; x++)
      for (let y = 0; y < m.h; y++)
        if (inRavine(ravineB, x, y)) {
          m.raise(x, y, 1, 1, PLAIN)
          m.set(x, y, 'bridge')
        }
  // the stair cut down into its west end
  const [sx, sw] = RAVINE_STAIR
  let top = 0
  while (!inRavine(ravineB, sx + 1, top)) top++
  stair(m, sx, top, sw, PLAIN, 0, 'path')
  m.regions.ravine = [3, Math.floor(ravineB.mid(20) - 4), 50, 9]
  // rock along the edges, outcrops on the plain
  const keep = (x: number, y: number) => m.near(x, y, (t) => t === 'path' || t === 'bridge', 2) || inRect([5, 0, 9, 9], x, y)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (keep(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      const thick = 1.4 + (noise(x, y, 5, 703) - 0.4) * 3
      if (edge < thick || (noise(x, y, 3, 709) > 0.86 && !inRavine(ravineA, x, y) && !inRavine(ravineB, x, y))) m.set(x, y, 'rock')
    }
  seal(m, ways(m, { north: P.north, east: P.east }), 'rock')
  // the way down: a waypoint statue where the road meets the plain
  m.fixture('fixture/sacred/waypoint', ...spot(m, 13, 7), { id: 'wp.lashmarks', name: L('Lashmarks statue', '鞭痕原传送雕像') })
  m.regions.descent = [5, 0, 10, 8]
  // the old battlefield on the near edge of the middle ravine and beyond it: bones, spears left where they fell, a cart
  m.regions.field = [12, 14, 32, 6]
  for (const [x, y] of [[19, 17], [27, 18], [31, 16], [38, 17], [22, 27], [30, 26], [41, 27]] as Cell[]) m.fixture('fixture/remains/bones', ...spot(m, x, y))
  for (const [x, y] of [[25, 16], [33, 18], [20, 26]] as Cell[]) m.item({ form: 'item/weapon/polearm/spear', material: 'iron', quality: 'crude', name: L('A broken spear', '一支断矛') }, ...spot(m, x, y))
  m.fixture('fixture/furniture/cart', ...spot(m, 40, 16), { name: L('A broken supply cart', '一辆坏掉的辎重车') })
  for (const [x, y] of [[36, 9], [47, 17], [14, 25], [44, 25]] as Cell[]) m.set(...spot(m, x, y), 'charred_tree')
  for (const [n, x, y] of [[0, 18, 10], [1, 30, 11], [2, 42, 10], [0, 26, 25], [1, 38, 26]] as [number, number, number][]) decor(m, `decor_cracks_${n}`, x, y)
  // the two banners alike, either side of the ravine
  m.fixture(RED_STANDARD, ...spot(m, 21, 16), banner(true))
  m.fixture(RED_STANDARD, ...spot(m, 26, 27), banner(false))
  // the drummer's drum, down in the ravine
  const floor = Math.round(ravineB.mid(12)) + 1
  m.item({ form: WAR_DRUM }, ...spot(m, 12, floor, true)).id = 'quest.wil.drum'
  // what lives on the plain: wolves off the road, a boar in the scrub, fire imps at the far side's east end, more of them in the long nights
  // (all of them away from the bridges, where the companies meet at dusk)
  m.creature('beast/wolf', ...spot(m, 44, 9, true), HUNT())
  m.creature('beast/wolf', ...spot(m, 50, 18, true), HUNT())
  m.creature('beast/boar', ...spot(m, 7, 27, true), HUNT(4))
  m.creature('imp/fire_imp', ...spot(m, 46, 26, true), { behaviour: 'ranged', temper: 'aggressive', sight: 6, leash: 6 })
  m.creature('imp/fire_imp', ...spot(m, 51, 25, true), { behaviour: 'ranged', temper: 'aggressive', sight: 6, leash: 6 })
  m.appear = [...GROUND_YIELD, appears('actor/creature/imp/fire_imp', ['dirt', 'sand'], 2, 2400, { ai: { behaviour: 'ranged', temper: 'aggressive', sight: 6, leash: 6 } })]
  m.sprinkle('fixture/nature/tuft', 0.05, (x, y, t) => t === 'drygrass' && !keep(x, y))
  lay(m, 'item/material/stone', 3, [6, 10, 20, 6])
  wildFloor(m, 0.5, keep)
  levelCreatures(m)
  return m
}

// =================================================================== the camp of the Red Host

/** Where the camp's buildings stand (their footprints' top-left): the war hall, the field hospital. */
const CAMP = { warhall: [17, 4] as Cell, hospital: [4, 7] as Cell, fire: [24, 20] as Cell, drill: [31, 5, 8, 5] as const }

/**
 * The camp of the Red Host's Left Company: a palisade round a square of red earth, the road through it west to east
 * between its two gates. North of the road the war hall, where the captain keeps the map of the Lashmarks, and the field
 * hospital, where nobody comes; east of them the drill ground's dummies and racks. South of the road the tents in their
 * rows, the cook fire and its pot, the barrels, crates and carts of an army that has stood in one place sixty-one years.
 */
export function buildRedCamp(): MapBuilder {
  const P = MARCH.camp
  const m = new MapBuilder('redcamp', L('The Camp of the Red Host', '赤旗营'), 'village', P.w, P.h, 'dirt', 'village', 'outdoor', 'redmarch')
  m.zone = 'peaceful'
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const n = noise(x, y, 5, 721)
      if (n > 0.68) m.set(x, y, 'drygrass')
      else if (n < 0.24) m.set(x, y, 'sand')
    }
  m.path([[0, 14], [43, 14]], 'path', 3, { edge: 'sand', edgeP: 0.08 })
  // the palisade, its gates on the road west and east, and the south gate the grain road leaves by (docs/chapter-3.md §2.4)
  palisade(m, 2, 41, 3)
  palisade(m, 2, 19, 27)
  palisade(m, 22, 41, 27)
  m.path([[MARCH.camp.south[0], 15], [MARCH.camp.south[0], m.h - 1]], 'path', 2)
  for (const x of [2, 41]) {
    palisadeY(m, x, 4, 11)
    palisadeY(m, x, 17, 26)
  }
  for (const [x, y] of [[4, 9], [4, 17], [37, 9], [37, 17]] as Cell[]) m.building('march_watchtower', x, y)
  // the war hall and the field hospital, their doors on the road
  const [wx, wy] = CAMP.warhall
  const [hx, hy] = CAMP.hospital
  m.building('march_warhall', wx, wy, ['warhall'], true)
  m.building('march_hospital', hx, hy, ['hospital'], true)
  for (const d of ['warhall', 'hospital']) {
    const [dx, dy] = m.doors[d]
    m.path([[dx, dy + 1], [dx, 13]], 'path', 1)
  }
  for (const [x, y] of [[wx + 2, wy + 7], [wx + 12, wy + 7]] as Cell[]) m.fixture(RED_STANDARD, x, y, banner(true))
  for (const [x, y] of [[wx + 4, wy + 7], [wx + 10, wy + 7]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'night', 0.45)
  }
  // the drill ground: sand, dummies and racks of spears
  const [dx0, dy0, dw, dh] = CAMP.drill
  m.rect(dx0, dy0, dw, dh, 'sand')
  for (const x of [dx0 + 1, dx0 + 3, dx0 + 5]) m.fixture('fixture/dummy', x, dy0 + 1)
  m.fixture('fixture/furniture/rack/arms', dx0, dy0 + 3)
  m.fixture('fixture/furniture/rack/arms', dx0 + 7, dy0 + 3)
  // the tents south of the road in their rows, the cook fire among them
  const TENTS: [number, number, string][] = [[5, 18, 'a'], [10, 18, 'b'], [16, 18, 'c'], [30, 18, 'b'], [35, 18, 'a'], [5, 23, 'c'], [10, 23, 'a'], [16, 23, 'b'], [29, 23, 'c'], [34, 23, 'a']]
  for (const [x, y, k] of TENTS) m.building(`march_tent_${k}`, x, y)
  const [fx, fy] = CAMP.fire
  m.fixture('fixture/light/campfire', fx, fy, lit)
  glowAt(m, fx, fy, 'always', 0.45)
  m.fixture('fixture/craft/cauldron', fx + 2, fy, { name: L('The camp pot', '营里的大锅') })
  for (const [x, y] of [[fx - 2, fy + 1], [fx + 1, fy + 2], [fx - 1, fy - 2]] as Cell[]) m.fixture('fixture/furniture/bench/log', x, y)
  for (const [x, y] of [[23, 24], [24, 24], [39, 21], [7, 26]] as Cell[]) m.fixture('fixture/container/barrel', x, y)
  for (const [x, y] of [[26, 24], [39, 24], [14, 21]] as Cell[]) m.fixture('fixture/container/crate', x, y)
  for (const [x, y] of [[23, 26], [3, 21]] as Cell[]) m.fixture('fixture/container/sack', x, y)
  m.fixture('fixture/furniture/cart', 33, 11, { name: L('A cart that came from Emberfall', '从余烬镇来的大车') })
  for (const [x, y] of [[38, 12], [38, 16]] as Cell[]) m.fixture(RED_STANDARD, x, y, banner(true))
  // the people's places (people/brannoc.ts, vera.ts, wil.ts, kell.ts, dunn.ts, holt.ts)
  m.anchor('brannoc.yard', ...spot(m, wx + 7, wy + 8, true))
  m.anchor('vera.round', ...spot(m, 12, 16, true))
  m.anchor('wil.fire', ...spot(m, fx - 1, fy + 1, true))
  m.anchor('dunn.fire', ...spot(m, fx + 1, fy + 1, true))
  m.anchor('kell.gate', ...spot(m, 6, 13, true))
  m.anchor('holt.drill', ...spot(m, dx0 + 2, dy0 + 3, true))
  for (const [name, x, y] of [['wil.bed', 12, 22], ['dunn.bed', 18, 22], ['kell.bed', 7, 22], ['holt.bed', 32, 22]] as [string, number, number][]) m.anchor(name, ...spot(m, x, y, true))
  m.regions.gate = [0, 10, 8, 9]
  m.regions.southgate = [18, 24, 6, 6]
  m.regions.fire = [fx - 4, fy - 3, 9, 6]
  strew(m, 3, 4, 38, 23, 0.04, 'poor')
  unshut(m)
  m.appear = GROUND_YIELD
  return m
}

/** The war hall: the captain's map of the Lashmarks on the long table, his chair at its head, his cot by the dais. */
export function buildCampWarhall(): MapBuilder {
  const { m, P } = marchHall('warhall', 'redcamp.warhall', 'The War Hall', '军议厅', 'floor_stone', [], { floors: [['dais', 'carpet_royal']] })
  const H = P.hall
  const D = P.dais
  m.fixture('fixture/furniture/table/long', H.x + 11, H.y + 3, {
    name: L('The map of the Lashmarks', '鞭痕原地图'),
    tags: ['readable'],
    props: { text: 'A map of the March pinned to the table. Across the middle ravine of the Lashmarks two lines of little flags face each other. They have been moved back and forth so often that the paper under them is worn through.', text_zh: '桌上钉着一张边境地图。鞭痕原中间那道沟的两边，两排小旗面对面插着。它们被来回挪了太多次，底下的纸都磨穿了。' },
  })
  for (const x of [H.x + 9, H.x + 14]) m.fixture('fixture/furniture/chair', x, H.y + 4)
  m.fixture('fixture/furniture/throne', D.x + 4, D.y, { name: L("The captain's chair", '队长的椅子') })
  m.fixture('fixture/furniture/bed', D.x + 8, D.y, { name: L("The captain's cot", '队长的行军床') })
  for (const [x, y] of [[D.x, D.y], [D.x + 9, D.y]] as Cell[]) m.fixture(RED_STANDARD, x, y, banner(true))
  for (const [x, y] of [[D.x + 1, D.y + 2], [D.x + 7, D.y + 2]] as Cell[]) m.fixture('fixture/light/brazier', x, y, lit)
  for (const x of [H.x + 2, H.x + 5, H.x + 18, H.x + 21]) m.fixture('fixture/furniture/rack/arms', x, H.y)
  m.fixture('fixture/container/chest', D.x + 6, D.y)
  glow(m, H.x + 12, H.y + 3.5, 14, 5, '#ffc46b', 0.4)
  m.anchor('brannoc.table', ...spot(m, H.x + 11, H.y + 6, true))
  m.anchor('brannoc.bed', ...spot(m, D.x + 8, D.y + 1, true))
  return m
}

/** The field hospital: its beds made and empty, its shelf of rolled bandages, the surgeon's ledger on her table. */
export function buildCampHospital(): MapBuilder {
  const { m, P } = marchHall('hospital', 'redcamp.hospital', 'The Field Hospital', '野战医院', 'floor_wood', ['ward'], { floors: [['shrine', 'floor_stone']] })
  const W = P.ward
  const S = P.shrine
  m.fixture('fixture/sacred/altar', S.x + 2, S.y)
  for (const x of [S.x, S.x + 5]) m.fixture('fixture/light/candles', x, S.y, lit)
  for (const x of [W.x, W.x + 2, W.x + 4, W.x + 6, W.x + 16, W.x + 18, W.x + 20, W.x + 22]) for (const y of [W.y, W.y + 8]) m.fixture('fixture/furniture/bed', x, y, { name: L('A made bed', '铺好的空床') })
  m.fixture('fixture/furniture/table', W.x + 11, W.y + 4, {
    name: L("The surgeon's ledger", '军医的账簿'),
    tags: ['readable'],
    props: { text: 'A thick ledger on the table. On the left-hand pages, wounds: a spear under the ribs, a cut to the bone, an arrow in the back, and beside each, "walked away". On the right-hand pages, names, and beside each a date and three words: "on his feet".', text_zh: '桌上一本厚账簿。左边几页记的是伤：肋下一矛，砍到骨头的一刀，背上一支箭，每一条后面都写着「自己走了」。右边几页记的是名字，每个名字后面一个日期，还有四个字：「站着死的」。' },
  })
  m.fixture('fixture/container/shelf', W.x + 23, W.y + 3, { name: L('A shelf of rolled bandages', '一架卷好的绷带') })
  m.fixture('fixture/craft/cauldron', W.x + 13, W.y + 4, lit)
  m.fixture('fixture/container/cupboard', W.x, W.y + 3)
  glow(m, S.x + 3, S.y + 1.5, 8, 4, '#ffb35c', 0.4)
  m.anchor('vera.ward', ...spot(m, W.x + 10, W.y + 5, true))
  m.anchor('vera.bed', ...spot(m, W.x + 22, W.y + 1, true))
  return m
}

// =================================================================== the Scourging House

/** The court of the Red Order: its posts, the chapel at its head, the brothers' cells beside it, their graves. */
const HOUSE = { chapel: [17, 1] as Cell, cells: [25, 3] as Cell, court: [9, 9, 22, 5] as const, posts: [[12, 11], [14, 11], [16, 11], [23, 11], [25, 11], [27, 11]] as Cell[] }

/**
 * The Scourging House: the Red Order's chapterhouse on the red ridge east of the camp. North of the road its court in a
 * dry-stone wall, flagged, six whipping posts in two rows where the brothers stand at dusk; the chapel at the court's head
 * (its hall and the undercroft under it) and the brothers' cells beside it. West of the court a burned orchard;
 * south of the road the Order's graves, one of them for a novice who is not dead.
 */
export function buildScourgeHouse(): MapBuilder {
  const P = MARCH.house
  const m = new MapBuilder('scourgehouse', L('The Scourging House', '鞭笞院'), 'village', P.w, P.h, 'dirt', 'temple', 'outdoor', 'redmarch')
  m.zone = 'peaceful'
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const n = noise(x, y, 6, 731)
      if (n > 0.7) m.set(x, y, 'drygrass')
      else if (n < 0.22) m.set(x, y, 'sand')
    }
  m.path([[0, 14], [39, 14]], 'path', 3, { edge: 'sand', edgeP: 0.08 })
  // the chapel and the cells
  const [cx, cy] = HOUSE.chapel
  const [bx, by] = HOUSE.cells
  m.building('fort_chapel', cx, cy, ['hall'], true)
  m.building('fort_barracks', bx, by, ['cells'], true)
  // the court before them, flagged in its wall; the posts
  const [qx, qy, qw, qh] = HOUSE.court
  m.rect(qx + 1, qy, qw - 2, qh - 1, 'flagstone')
  m.yard(qx, qy - 1, qw, qh + 1, 'stonewall', [[19, qy + qh - 1], [20, qy + qh - 1]])
  m.path([[19, qy + qh], [19, 13]], 'path', 2)
  for (const [x, y] of HOUSE.posts) m.fixture(WHIPPING_POST, x, y)
  for (const d of ['hall', 'cells']) {
    const [dx, dy] = m.doors[d]
    m.path([[dx, dy + 1], [dx, qy]], 'flagstone', 1)
  }
  for (const [x, y] of [[qx + 1, qy], [qx + qw - 2, qy]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'night', 0.4)
  }
  // the orchard, burned
  for (const [x, y] of [[3, 4], [6, 5], [4, 8], [7, 9], [3, 11]] as Cell[]) m.set(x, y, 'charred_tree')
  // the Order's graves south of the road
  const GRAVES: [number, number, string, string][] = [
    [8, 19, 'BROTHER AMBROSE OF THE PILLAR. HE TOOK HIS STROKES.', '柱下修士安布罗斯。他受过了他的鞭。'],
    [11, 19, 'BROTHER CEDRIC OF THE PILLAR. HE TOOK HIS STROKES.', '柱下修士塞德里克。他受过了他的鞭。'],
    [14, 19, 'ODRAN, NOVICE. GONE FROM US. WE TAKE HIS STROKES.', '见习修士奥德兰。离我们而去。他的鞭，由我们代受。'],
    [8, 22, 'BROTHER HALE OF THE PILLAR. HE TOOK HIS STROKES.', '柱下修士黑尔。他受过了他的鞭。'],
    [11, 22, 'A STONE WITH NO NAME. HE TOOK HIS STROKES.', '一块没有名字的碑。他受过了他的鞭。'],
  ]
  for (const [x, y, en, zh] of GRAVES) m.fixture('fixture/sacred/tomb', x, y, { props: { text: en, text_zh: zh } })
  m.fixture('fixture/sign', 22, 16, { props: { text: 'THE SCOURGING HOUSE OF THE RED ORDER. EAST: THE BASTION. NONE GO EAST UNBIDDEN.', text_zh: '红衣修会·鞭笞院。往东：堡垒。未蒙召者，不得东行。' } })
  // the people's places (people/lucan.ts, ivo.ts)
  m.anchor('lucan.court', ...spot(m, 20, qy + 2, true))
  m.anchor('lucan.post', ...spot(m, HOUSE.posts[3][0], HOUSE.posts[3][1] + 1, true))
  m.anchor('ivo.post', ...spot(m, HOUSE.posts[1][0], HOUSE.posts[1][1] + 1, true))
  m.anchor('ivo.graves', ...spot(m, 12, 21, true))
  m.regions.court = [qx, qy - 1, qw, qh + 1]
  // red rock round it all, closed but for the road
  const keep = (x: number, y: number) => m.near(x, y, (t) => t === 'path' || t === 'flagstone', 2) || inRect([qx - 1, 0, qw + 2, qy + qh + 1], x, y) || inRect([bx - 1, 0, 16, by + 6], x, y) || inRect([6, 18, 11, 6], x, y)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (keep(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 1.4 + (noise(x, y, 5, 733) - 0.4) * 3) m.set(x, y, 'rock')
    }
  seal(m, ways(m, { west: P.west, east: P.east }), 'rock')
  strew(m, 0, 0, m.w, m.h, 0.04, 'poor')
  unshut(m)
  m.appear = GROUND_YIELD
  return m
}

/** The chapel of the Red Order: the altar of the Post in its apse, its pews, the register of the offering, the stair down. */
export function buildScourgeHall(): MapBuilder {
  const { m, P } = marchHall('chapel', 'scourgehouse.hall', 'Chapel of the Pillar', '刑柱礼拜堂', 'floor_stone', [], { music: 'temple', floors: [['apse', 'marble']] })
  const N = P.nave
  const A = P.apse
  const ax = A.x + 4
  m.rect(ax - 1, N.y, 2, N.h, 'carpet_royal')
  m.fixture('fixture/sacred/altar', ax, A.y, {
    id: 'scourgehouse.altar',
    name: L('The altar of the Post', '刑柱祭坛'),
    tags: ['readable'],
    props: { text: 'An altar of red stone. Carved on its face, a man bound to a pillar, and round him many hands holding scourges. Below: THE FLESH REPAYS WHAT ALL OWE.', text_zh: '一座红石祭坛。正面刻着一个绑在柱子上的人，四周许多只手握着鞭子。底下刻着：以肉身偿还众人之罪。' },
  })
  for (const x of [A.x, A.x + 7]) m.fixture('fixture/light/candelabrum', x, A.y, lit)
  for (const y of [N.y + 2, N.y + 5, N.y + 8]) for (const x of [N.x + 3, N.x + 14]) m.fixture('fixture/furniture/bench', x, y)
  const W = P.chapelW
  m.fixture('fixture/furniture/bookstand', W.x + 1, W.y, {
    name: L('The register of the offering', '献祭簿'),
    tags: ['readable'],
    props: { text: 'A register in a red binding. Each evening has its line: the date, how many brothers stood at the posts, how many strokes. At the foot of every page, in the same hand: "Carried west." The last line is yesterday\'s.', text_zh: '一本红皮册子。每个黄昏记一行：日期，几个修士站到了柱前，挨了多少鞭。每一页最底下都是同一个人的笔迹：「已西送。」最后一行是昨天的。' },
  })
  m.fixture('fixture/light/candles', W.x + 1, W.y + 3, lit)
  // the stair down to the undercroft, in the east chapel
  const E = P.chapelE
  m.doors.down = [E.x + 1, E.y + 1]
  glow(m, ax + 0.5, A.y + 1.5, 9, 4, '#ff7a5a', 0.45)
  m.anchor('lucan.altar', ...spot(m, ax, A.y + 2, true))
  m.regions.altar = [ax - 2, A.y, 5, 4]
  return m
}

/** The undercroft: its vault on pillars, the altar at its head, and the red channels running from it west under the wall. */
export function buildUndercroft(): MapBuilder {
  const { m, P } = marchHall('undercroft', 'scourgehouse.undercroft', 'The Undercroft', '地下室', 'floor_stone', ['hall'], { music: 'crypt', light: 'dark', outside: false })
  const H = P.hall
  for (const y of [H.y + 2, H.y + 7]) for (const x of [H.x + 4, H.x + 15]) m.building('crypt_pillar', x, y)
  m.fixture('fixture/sacred/altar', P.apse.x + 4, P.apse.y, { name: L('A bare altar', '一座光秃秃的祭坛') })
  for (const x of [P.apse.x + 1, P.apse.x + 6]) m.fixture('fixture/light/candles', x, P.apse.y, lit)
  // the channels: from below the altar, west to the wall and under it
  for (const y of [H.y + 1, H.y + 4, H.y + 8]) for (let x = H.x; x <= P.apse.x + 4; x++) if (m.free(x, y)) m.fixture(RED_CHANNEL, x, y)
  glow(m, P.apse.x + 4, P.apse.y + 1.5, 8, 4, '#ff5a4a', 0.4)
  m.anchors = { stair: [P.landing.x + 1, P.landing.y] }
  m.regions.channels = [H.x, H.y, H.w, H.h]
  return m
}

/** The brothers' cells: four cots, the Prior's and Brother Ivo's among them. */
export function buildScourgeCells(): MapBuilder {
  return home('scourgehouse.cells', "The Brothers' Cells", '修士居室', 4, 'stone')
}

// =================================================================== the War-Giver's Bastion

/** The keep at the Bastion's east end: its two doors are the fog's, into the Pillar Yard. */
const KEEP = [26, 5] as Cell

/**
 * The War-Giver's Bastion: a fortress on a red rise, its curtain walls broken. The road comes in at the west between two
 * ruined towers and runs across the ward to the keep at its east end, whose doors are a wall of fog. The Rider's old
 * guard still stand their posts across the ward: soldiers who died there without noticing, bones in red rags. By the
 * keep's gate, on a broken pole among them, the banner the Right took from the Left sixty-one years ago.
 */
export function buildBastion(): MapBuilder {
  const P = MARCH.bastion
  const m = new MapBuilder('bastion', L("The War-Giver's Bastion", '赐战者堡垒'), 'dungeon', P.w, P.h, 'dirt', 'ruins', 'outdoor', 'redmarch')
  m.gearLevel = 8
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const n = noise(x, y, 5, 741)
      if (n > 0.72) m.set(x, y, 'drygrass')
      else if (n < 0.34) m.set(x, y, 'flagstone')
    }
  m.path([[0, 14], [20, 14], [31, 16]], 'flagstone', 3)
  // the keep and its gate
  const [kx, ky] = KEEP
  m.building('fort_keep', kx, ky, [], true)
  // the curtain walls, broken: north and south of the ward, towers at their ends
  for (const [x, y] of [[4, 2], [16, 2], [4, 26], [16, 26]] as Cell[]) m.building('fort_wall_x6', x, y, [], true)
  for (const [x, y] of [[10, 2], [10, 26]] as Cell[]) m.building('ruin_wall_x6', x, y, [], true)
  for (const [x, y] of [[1, 9], [1, 17]] as Cell[]) m.building('ruin_tower', x, y)
  for (const [x, y] of [[22, 1], [22, 25]] as Cell[]) m.building('fort_tower_square', x, y)
  for (const [n, x, y] of [[0, 8, 6], [1, 13, 21], [2, 19, 8]] as [number, number, number][]) m.building(`ruin_column_${n}`, x, y)
  m.building('decor_column_fallen', 15, 18)
  // the old guard at their posts
  m.regions.ward = [0, 0, P.w, P.h]
  for (const [x, y] of [[9, 10], [9, 18], [15, 9], [15, 20], [21, 11], [21, 18]] as Cell[]) m.creature('undead/skeleton', ...spot(m, x, y, true), { behaviour: 'melee', temper: 'aggressive', sight: 4, leash: 3 })
  for (const [x, y] of [[6, 12], [12, 16], [18, 13], [24, 20], [11, 7]] as Cell[]) m.fixture('fixture/remains/bones', ...spot(m, x, y))
  for (const [x, y] of [[7, 7], [7, 21], [19, 6], [19, 22]] as Cell[]) m.fixture(RED_STANDARD, ...spot(m, x, y), { name: L('A torn standard', '一面破军旗'), tags: ['readable'], props: { text: 'A red banner gone brown, torn to its last third. A white pillar can still be made out on it.', text_zh: '一面红旗，颜色已经发褐，只剩下三分之一。上面还看得出一根白色的柱子。' } })
  // the keep's gate: its doors are the fog into the Pillar Yard; braziers either side; the banner on its pole beside
  const doors: Cell[] = [[kx + 5, ky + 10], [kx + 6, ky + 10]]
  doors.forEach(([x, y], i) => {
    const [ix, iy] = CH2_AT.yard.gate[i]
    m.portal(x, y, 'pillaryard', ix, iy - 2, L('The Pillar Yard', '刑柱庭'))
    m.fixture('fixture/fog', x, y, { name: L("The War-Giver's fog", '赐战者的雾门'), props: { boss: 'matthias', interior: 'pillaryard', interiorX: ix, interiorY: iy - 2 } })
  })
  m.rect(kx + 4, ky + 11, 4, 2, 'flagstone')
  for (const [x, y] of [[kx + 3, ky + 11], [kx + 8, ky + 11]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'always', 0.45)
  }
  m.regions.gate = [kx - 2, ky + 9, 12, 6]
  m.item({ form: LEFT_BANNER }, ...spot(m, kx + 1, ky + 12)).id = 'quest.brannoc.banner'
  // a statue where the road comes in, before the ward
  m.fixture('fixture/sacred/waypoint', ...spot(m, 4, 12), { id: 'wp.bastion', name: L('Bastion statue', '堡垒传送雕像') })
  // red rock round it, closed but for the road in
  const keep = (x: number, y: number) => m.near(x, y, (t) => t === 'flagstone' || t === 'door', 2)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (keep(x, y) || !m.free(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 1.2 + (noise(x, y, 5, 743) - 0.4) * 2.5) m.set(x, y, 'rock')
    }
  seal(m, ways(m, { west: P.west }), 'rock')
  wildFloor(m, 0.4, keep)
  levelCreatures(m)
  return m
}

// =================================================================== the Pillar Yard

/**
 * The Pillar Yard (docs/boss-rooms.md): the Bastion's inner court, a map of its own behind the keep's fog. Red flagstones
 * worn bare in a ring round the broken Scourging Post at its middle, where Matthias stands chained; walls all round, the
 * fog of the gate behind one as one comes in, sealed while he stands. Nobody lives here: the story sets its own stage.
 */
export function buildPillarYard(): MapBuilder {
  const P = MARCH.yard
  const m = new MapBuilder('pillaryard', L('The Pillar Yard', '刑柱庭'), 'field', P.w, P.h, 'flagstone', 'ruins', 'outdoor', 'redmarch')
  m.gearLevel = 9
  const [px, py] = CH2_AT.yard.post
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const d = Math.hypot((x - px - 3) / 1.2, y - py - 5)
      if (d > 5.5 && d < 7) m.set(x, y, 'dirt')
      else if (noise(x, y, 4, 751) > 0.72) m.set(x, y, 'sand')
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 1) m.set(x, y, 'wall')
    }
  for (const [x, y] of [[0, 0], [P.w - 7, 0]] as Cell[]) m.building('fort_tower_round', x, y)
  // the post at its heart; its old stains round the foot
  m.fixture(SCOURGING_POST, px, py, { id: 'pillaryard.post' })
  for (const [x, y] of [[px - 1, py + 1], [px + 1, py + 1], [px, py + 2]] as Cell[]) m.set(x, y, 'dirt')
  for (const [x, y] of [[px - 6, py + 4], [px + 6, py + 3], [px - 4, py + 10], [px + 5, py + 9]] as Cell[]) m.fixture('fixture/remains/bones', x, y)
  for (const [x, y] of [[4, 3], [P.w - 5, 3], [4, P.h - 4], [P.w - 5, P.h - 4]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'always', 0.5)
  }
  // the War-Giver, chained to the post (the campaign's body: content chapter2.ts)
  const [mx, my] = CH2_AT.yard.matthias
  const k = createBoss('matthias', { map: m.id, x: mx, y: my }, MATTHIAS_ID)
  k.props = { ...k.props, ...MATTHIAS_CAMPAIGN }
  m.entities.push(k)
  // the gate: the fog on it, sealed while he stands; back out to the keep's doors
  CH2_AT.yard.gate.forEach(([x, y], i) => {
    m.set(x, y, 'flagstone')
    m.set(x, y + 1, 'flagstone')
    m.portal(x, y, 'bastion', KEEP[0] + 5 + i, KEEP[1] + 11, L("The War-Giver's Bastion", '赐战者堡垒'))
    m.fixture('fixture/fog', x, y, { name: L("The War-Giver's fog", '赐战者的雾门'), props: { boss: 'matthias' } })
  })
  m.anchors.arrive = [CH2_AT.yard.arrive[0], CH2_AT.yard.arrive[1]]
  m.regions.yard = [2, 2, P.w - 4, P.h - 3]
  m.vistas.push({ at: [2, 2, P.w - 4, P.h - 4], zoom: 0.75, focus: [px, py + 2], share: 0.35 })
  return m
}

// =================================================================== hooks on maps built elsewhere

/** Cinder Pass: its way down south into the March, under the lair's trail (opened by the dragon's death: overworld.ts, world.ts). */
export function chapter2Pass(m: MapBuilder): void {
  for (const x of PASS.south) for (let y = m.h - 3; y < m.h; y++) m.set(x, y, 'path')
  m.path([[20, 30], [21, 34], [20, m.h - 1]], 'path', 2)
  m.fixture('fixture/sign', 22, 33, { props: { text: 'SOUTH: THE SCARRED MARCH. THE RED HOST.', text_zh: '往南：赤痕边境。赤军。' } })
}

/** Emberfall: where Odran sits on the square, and where Holt keeps when he comes east after the thief. */
export function chapter2Emberfall(m: MapBuilder): void {
  m.anchor('odran.square', ...spot(m, 23, 16, true))
  m.anchor('holt.square', ...spot(m, 17, 18, true))
}

/** The scenes' people who live nowhere a map shows: the Right Company's two, and where Dunn is after the dusk. */
export function chapter2Offstage(m: MapBuilder): void {
  m.anchor('roderick.hide', ...spot(m, 1, 4, true))
  m.anchor('osric.hide', ...spot(m, 3, 4, true))
  m.anchor('dunn.gone', ...spot(m, 7, 4, true))
}

// =================================================================== the scenes

const D = CH2_AT.dusk
const Y = CH2_AT.yard

/** The chapter's card at its end. */
const CHAPTER_END = {
  en: 'CHAPTER TWO · THE SECOND SEAL\n\nThe War-Giver gave back what he had taken.\nThe Red Host lay down its spears and wept.\nThe grey man carried a second light east.\nAnd the night came sooner again.',
  zh: '第二章 · 第二印\n\n赐战者把拿走的疼还了回去。\n赤军放下长矛，哭了出来。\n灰衣人带着第二道光往东去了。\n夜晚又来得更早了。',
}

export const CHAPTER2_STORY: StepDef[] = [
  // ------------------------------------------------------------------ Emberfall, the pass
  {
    // Emberfall with the road open: the old brother on the square (a beat)
    id: 'odran_first',
    when: { map: 'emberfall', facts: { [CH1.end]: 1 } },
    say: L('That old man on the bench keeps rubbing his back. Like it itches.', '长凳上那个老爷爷一直在揉后背，好像很痒似的。'),
  },
  {
    // the pass's south side, the dragon dead: the way down into the March
    id: 'pass_south',
    when: { map: 'pass', facts: { [CH2.dragon]: 1 } },
    say: L('The snow stops down there, to the south. The ground below is red.', '往南边下去，雪就没了。下面的地是红的。'),
    hint: L('The way down into the Scarred March is at the south end of the pass.', '下到赤痕边境的路，在山道的南头。'),
  },
  // ------------------------------------------------------------------ the March
  {
    // Down off the pass: red ground, a cut that does not hurt, a soldier with an arrow in him.
    id: 'march_descent',
    when: { map: 'lashmarks', region: 'descent' },
    script: [
      say('player', '(The road comes down off the pass onto red ground. Long ravines cut across it from east to west, as far as you can see.)', '（大路从山口下来，落到一片红土上。一道道长沟从东到西横着割过去，望不到头。）'),
      say('player', '(A briar at the roadside catches your arm. A line of blood runs down to your wrist. You feel nothing.)', '（路边的荆棘勾住了你的胳膊，一道血一直流到手腕。你一点感觉也没有。）'),
      say('pip', "Your arm! You're bleeding. ...Doesn't it hurt?", '你的胳膊！在流血呢。……不疼吗？', 'surprised'),
      { place: 'npc.dunn', map: 'lashmarks', x: CH2_AT.descent.dunn[0], y: CH2_AT.descent.dunn[1] },
      { move: 'npc.dunn', x: CH2_AT.descent.meet[0], y: CH2_AT.descent.meet[1] },
      say('player', '(A soldier in red comes up the road. An arrow stands out of his shoulder, its shaft snapped short. He is whistling.)', '（一个穿红衣的士兵沿着路走上来。他肩膀上插着一支箭，箭杆折断了一截。他在吹口哨。）'),
      say('npc.dunn', "A pilgrim, over the pass? Then the dragon's gone. Good. The camp is east along the road. Tell the captain Dunn sent you.", '翻山过来的朝圣者？那魔龙是没了。好。营地顺着路往东走就到。跟队长说，是邓恩叫你来的。', 'happy'),
      say('pip', "There's an arrow in you!", '你身上插着箭呢！', 'surprised'),
      say('npc.dunn', 'This? I got it at dusk yesterday. Vera wants it out. I keep forgetting.', '这个？昨天黄昏挨的。薇拉说要拔，我老是忘。'),
      { move: 'npc.dunn', x: CH2_AT.descent.away[0], y: CH2_AT.descent.away[1] },
      { place: 'npc.dunn', map: 'redcamp', x: 25, y: 21 },
      { fact: CH2.march, value: 1 },
    ],
  },
  {
    // The camp: what an army looks like when nobody feels a wound; Holt has signed on.
    id: 'camp_arrival',
    when: { map: 'redcamp', region: 'gate' },
    script: [
      say('player', '(Tents in rows inside a palisade, a war hall, a cook fire. The same red banner with a white pillar hangs everywhere. Nobody here limps, though many are bandaged badly or not at all.)', '（木栅栏里，一排排营帐，一座军议厅，一口煮饭的大锅。到处挂着同一面红旗，上面一根白柱子。这里没有一个人瘸着腿走路，可许多人身上的伤只是胡乱包了包，有的根本没包。）'),
      { place: 'npc.holt', map: 'redcamp', x: 7, y: 15 },
      say('npc.holt', 'Pilgrim! So you came over too. I signed on with the Left Company. I took a cut across the back this morning and never felt a thing. Not a thing!', '朝圣者！你也翻过来了。我在左营报了名。今天早上背上挨了一刀，一点感觉都没有。一点都没有！', 'happy'),
      say('npc.holt', "The grey man came through here. I'll find him. But the captain says I fight at dusk first.", '那个灰衣人从这儿过去了，我会找到他的。不过队长说，先得打完今晚这一仗。'),
      say('pip', "Holt, your back's all red.", '霍尔特，你背上全红了。', 'sad'),
      say('npc.holt', 'Is it? Huh.', '是吗？嗯。'),
    ],
  },
  {
    // The dusk on the Lashmarks: the Left and the Right under one banner; Dunn sits down and does not get up.
    id: 'dusk_battle',
    when: { map: 'lashmarks', hour: { from: 18, to: 20 }, facts: { [CH2.camp]: 1 } },
    script: [
      { music: 'battle' },
      say('player', '(A drum starts up on the near side of the middle ravine. The Left Company forms its line along the edge.)', '（中间那道沟的这一边响起了鼓声。左营沿着沟沿排开了队列。）'),
      { place: 'npc.brannoc', map: 'lashmarks', x: D.left[0][0], y: D.left[0][1] },
      { place: 'npc.kell', map: 'lashmarks', x: D.left[1][0], y: D.left[1][1] },
      { place: 'npc.dunn', map: 'lashmarks', x: D.left[2][0], y: D.left[2][1] },
      { place: 'npc.holt', map: 'lashmarks', x: D.left[3][0], y: D.left[3][1] },
      { place: 'npc.roderick', map: 'lashmarks', x: D.right[0][0], y: D.right[0][1] },
      { place: 'npc.osric', map: 'lashmarks', x: D.right[1][0], y: D.right[1][1] },
      say('npc.brannoc', 'Left Company! For the banner!', '左营！为了军旗！', 'angry'),
      say('npc.roderick', 'Right Company! For the banner!', '右营！为了军旗！', 'angry'),
      say('player', '(Both lines run onto the bridges under the same red banner, and meet.)', '（两边的人扛着同样的红旗冲上桥，撞在一起。）'),
      { move: 'npc.kell', x: D.bridge[0][0], y: D.bridge[0][1] },
      { move: 'npc.holt', x: D.bridge[1][0], y: D.bridge[1][1] },
      { move: 'npc.roderick', x: D.bridge[2][0], y: D.bridge[2][1] },
      { move: 'npc.osric', x: D.bridge[3][0], y: D.bridge[3][1] },
      say('player', '(Spears go in and come out. Men are knocked down and get up again. No one cries out. You hear only the drum, and boots, and breathing.)', '（长矛扎进去，又拔出来。有人被撞倒，又爬起来。没有一个人喊疼。你只听得见鼓声、脚步声和喘气声。）'),
      say('npc.holt', 'Ha! Pilgrim, look! Not a thing!', '哈！朝圣者你看！一点都不疼！', 'happy'),
      { wait: 20 },
      say('player', '(The drum stops. Both sides walk back across the bridges as if a bell had rung the end of the day.)', '（鼓声停了。两边的人像听见了收工的钟，各自从桥上走回去。）'),
      { move: 'npc.kell', x: D.left[1][0], y: D.left[1][1] },
      { move: 'npc.holt', x: D.left[3][0], y: D.left[3][1] },
      { place: 'npc.roderick', map: 'offstage', x: 1, y: 4 },
      { place: 'npc.osric', map: 'offstage', x: 3, y: 4 },
      { move: 'npc.dunn', x: D.dunn[0], y: D.dunn[1] },
      say('player', '(Dunn stands by the edge with his spear up. Then he sits down in the dust, and does not get up.)', '（邓恩拄着长矛站在沟沿上。过了一会儿，他坐到了土里，再也没站起来。）'),
      { place: 'npc.vera', map: 'lashmarks', x: D.vera[0], y: D.vera[1] },
      say('npc.vera', 'Dunn. A spear under the ribs four days ago, an arrow yesterday. He told me it was nothing.', '邓恩。四天前肋下挨了一矛，昨天又中了一箭。他跟我说，没什么。', 'sad'),
      say('player', '(Vera closes his eyes and writes in her book. Nobody else has looked round.)', '（薇拉合上他的眼睛，在本子上写了几笔。别的人谁也没回头看一眼。）'),
      say('npc.vera', 'That is the third this month. They do not know when they are dying, so they do not stop.', '这个月第三个了。他们不知道自己快死了，所以停不下来。'),
      { place: 'npc.dunn', map: 'offstage', x: 7, y: 4 },
      { place: 'npc.brannoc', map: 'redcamp', x: 24, y: 12 },
      { place: 'npc.kell', map: 'redcamp', x: 6, y: 13 },
      { place: 'npc.holt', map: 'redcamp', x: 33, y: 9 },
      { place: 'npc.vera', map: 'redcamp', x: 12, y: 16 },
      { music: '' },
      { fact: CH2.dusk, value: 1 },
      { topic: 'dunn', days: 10 },
    ],
  },
  {
    // The Scourging House at dusk: the brothers at their posts (a beat)
    id: 'house_dusk',
    when: { map: 'scourgehouse', region: 'court', hour: { from: 17, to: 19 } },
    say: L("They're whipping themselves. ...Why doesn't anyone stop them?", '他们在抽自己……为什么没人拦着？'),
  },
  {
    // The undercroft: the channels run west; the grey man has been reading them.
    id: 'undercroft',
    when: { map: 'scourgehouse.undercroft' },
    script: [
      say('player', '(Under the chapel, gutters a hand wide are cut in the floor. Something dark red stands in them. They all run the same way: west, under the wall.)', '（礼拜堂底下，地上凿着一道道一掌宽的沟槽，里面积着暗红色的东西。它们全都朝一个方向去：往西，从墙根底下穿过去。）'),
      { place: 'npc.severin', map: 'scourgehouse.undercroft', x: CH2_AT.undercroft.severin[0], y: CH2_AT.undercroft.severin[1] },
      { music: 'severin' },
      say('npc.severin', 'You came down.', '你下来了。'),
      say('npc.severin', 'These run west. Follow them to the end and you are in the Holy City.', '这些沟往西去。顺着走到头，就是圣城。'),
      say('npc.severin', 'I am going to the Bastion. When the second seal breaks, I will be there.', '我要去堡垒。第二道印碎的时候，我会在那儿。'),
      say('pip', 'Wait! What runs in them?', '等等！沟里流的是什么？', 'surprised'),
      say('player', '(He does not answer. He goes up the stair past you, and is gone.)', '（他没有回答，从你身边走上楼梯，不见了。）'),
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { music: '' },
      { fact: CH2.channels, value: 1 },
    ],
  },
  {
    // The Bastion's ward: the old guard (a beat)
    id: 'bastion_ward',
    when: { map: 'bastion' },
    say: L("Those soldiers by the walls... they're only bones. They're still standing guard.", '墙边那些士兵……只剩骨头了。还站着岗呢。'),
    facts: { [CH2.bastion]: 1 },
  },
  {
    // The Pillar Yard: the War-Giver at his post.
    id: 'pillar_yard',
    when: { map: 'pillaryard', region: 'yard', facts: { [CH2.matthias]: 0 } },
    script: [
      say('player', '(A yard of red stone. In its middle stands a broken pillar, and chained to it a giant in a torn red tabard, a ring of iron spikes round his head. Threads of red light run from his open hand out over the walls.)', '（一片红石铺成的院子。正中立着一根断柱，柱上锁着一个巨人，披着破烂的红罩袍，头上围着一圈铁刺。一缕缕红色的光从他摊开的手里伸出去，越过了院墙。）'),
      say(MATTHIAS_ID, 'Another one who has come to fight. Good.', '又来了一个要打仗的人。好。'),
      say(MATTHIAS_ID, 'Come, then. Nothing hurts here. I see to that.', '来吧。在这里，什么都不疼。有我在。'),
    ],
  },
  {
    // The Chain: he feels his own pain again and gives the March back its own; Lumi catches part of the seal; the grey man the rest.
    id: 'chain',
    when: { map: 'pillaryard', facts: { [CH2.matthias]: 1 } },
    script: [
      { music: 'sorrow' },
      { wait: 22 },
      say('player', '(Matthias goes down on one knee against the post. The red threads running from his hand go slack, one after another.)', '（马提亚靠着刑柱单膝跪了下去。从他手里伸出去的那些红线，一根接一根地松了。）'),
      say('player', '("It hurts. ...I had forgotten how much.")', '（“疼。……我都忘了，原来这么疼。”）', 'sad'),
      say('player', '(Outside the walls, far off, men begin to cry out. Then more of them, all across the March.)', '（墙外很远的地方，有人喊了起来。接着是更多的人，整片边境都在喊。）'),
      say('player', '("Do you hear them? That is their own pain. I held it for them sixty-one years. Now that it hurts, they will stop.")', '（“听见了吗？那是他们自己的疼。我替他们拿了六十一年。现在疼了，他们就会停下来了。”）', 'sad'),
      say('player', '(He takes hold of the chain where it runs into the post and pulls. The ring comes out of the stone. He holds the chain out to you.)', '（他攥住拴进柱子的那截链子，一扯，铁环从石头里脱了出来。他把链子递给你。）'),
      say('player', '("Take it. This is what your Church sent you for.")', '（“拿去吧。你的教会派你来，就是为了这个。”）'),
      { give: POST_CHAIN },
      say('player', '(Something comes loose from the chain, a cold light, and runs to Lumi.)', '（链子上有什么东西散了出来，是一道冷光，流向了露米。）'),
      { tell: 'pip', params: { what: 'boon', unlock: 'endure', from: MATTHIAS_ID } },
      { wait: 32 },
      say('pip', 'It came to me again! ...Ow. My back stings.', '又到我这儿来了！……嘶，背上好疼。', 'surprised'),
      say('pip', "It's gone now. That's strange. There's nothing wrong with my back.", '已经不疼了。好奇怪，我背上又没有伤。'),
      { place: 'npc.severin', map: 'pillaryard', x: Y.severin[0], y: Y.severin[1] },
      { music: 'severin' },
      say('player', '(The grey man steps out from behind the post and opens his lantern. The rest of the light goes into the flame. It shrinks to a point, and he has to hold the lantern with both hands.)', '（灰衣人从柱子后面走出来，打开提灯。剩下的光流进了火里。火苗缩成了一个点，他得用两只手才捧得住那盏灯。）'),
      say('npc.severin', 'Two.', '第二道了。'),
      say('npc.severin', 'The night will come earlier again. You know where to ask why.', '夜晚又要来得早一些了。为什么，你知道该去问谁。'),
      say('player', '(He looks at Lumi for a long time. Then he goes out through the fog, east.)', '（他看了露米很久，然后穿过雾门，往东去了。）'),
      { move: 'npc.severin', x: Y.gate[0][0], y: Y.gate[0][1] - 1 },
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { fact: CH2.chain, value: 1 },
      // the second seal down: the night longer again (calendar.ts nightHours: dusk at seven, dawn at six)
      { fact: 'night.shift', value: 2 },
      { topic: 'quiet_dusk', days: 30 },
    ],
  },
  {
    // The quiet dusk: the camp feels its wounds; Holt on a cot; Wil learns what hurt is. The chapter ends.
    id: 'quiet_dusk',
    when: { map: 'redcamp', facts: { [CH2.chain]: 1 }, hour: { from: 19, to: 23 } },
    script: [
      say('player', '(Men lie in rows between the tents. Some are weeping. Vera goes from one to the next with her bag, and does not stop.)', '（营帐之间，人一排排地躺着，有的在哭。薇拉提着她的包，从一个人走到下一个人，一刻也没停。）'),
      say('npc.vera', 'Sixty-one years of wounds, all on one evening. I have more work tonight than in all the years before it.', '六十一年的伤，一个晚上全回来了。我今晚的活，比之前所有年头加起来还多。'),
      say('npc.brannoc', 'The Right sent a man over under a white rag. He asked whether we have a surgeon. I told him we do.', '右营派了个人，打着块白布过来，问我们有没有军医。我说有。'),
      say('player', '(Holt lies on a cot by the hospital, his side bound up. Under the binding a burn has closed the wound, neat as a seam.)', '（霍尔特躺在医院门口的一张行军床上，腰上缠着布。布底下，一道烙痕把伤口封住了，像缝过一样整齐。）'),
      say('npc.holt', 'The thief was here. The grey one. He sat with me half the night and burned the cut shut with that lantern of his.', '那个贼来过了。灰衣服那个。他在我旁边坐了半夜，用他那盏灯把伤口烙上了。'),
      say('npc.holt', "I'm not going after him. Not this time.", '我不追他了。这回不追了。'),
      say('npc.wil', "Pilgrim, I burned my hand on the pot, and it hurts! It really hurts! Is this what hurt is?", '朝圣者，我的手被锅烫了，好疼！真的好疼！这就是疼吗？', 'sad'),
      say('player', '(The sun has gone down behind the red hills. It went down at seven.)', '（太阳已经落到红色的山后面去了。七点就落了。）'),
      { fact: CH2.end, value: 1 },
      // the grain road south to the Vale of Scales opens (docs/chapter-3.md §2.4)
      { fact: CHAPTER_THREE, value: 1 },
      { music: 'ending' },
    ],
  },
  {
    // The chapter's card.
    id: 'chapter2_end',
    when: { after: 'quiet_dusk' },
    script: [{ card: L(`${CHAPTER_END.en}\n\nThe grain road south to the Vale of Scales is open.`, `${CHAPTER_END.zh}\n\n往南去衡谷平原的运粮路通了。`) }],
  },
]

/** The camp's halls, the Scourging House's rooms: linked to their doors (world.ts). */
export function marchInteriors(camp: MapBuilder, house: MapBuilder): MapBuilder[] {
  const warhall = buildCampWarhall()
  const hospital = buildCampHospital()
  const hall = buildScourgeHall()
  const undercroft = buildUndercroft()
  const cells = buildScourgeCells()
  camp.linkInterior('warhall', warhall)
  camp.linkInterior('hospital', hospital)
  house.linkInterior('hall', hall)
  house.linkInterior('cells', cells)
  linkStair(hall, hall.doors.down, undercroft, undercroft.anchors.stair, true)
  return [warhall, hospital, hall, undercroft, cells]
}

