// Chapter 3, the Third Seal (docs/chapter-3.md; content chapter3.ts): the Vale of Scales down the grain road from the Red
// Host's camp — its maps, the places its people keep, and the chapter's scenes. The Chaff Road, dead fields and still
// windmills, a scale at the crossroads; Fairweight, the market town round its great scale, the weigh-house with the
// Church's black weight, the Grain Guild's hall and its sealed granary, the poorhouse, the Chapel of the Measure; the White
// Pans, where the Lightened stand facing the Black Balance until the wind takes them; the Black Balance, its dead clerks
// and its counting room; and behind its fog the Scale Floor, where Ele, the Priest of the Black Scales, weighs the Vale.

import type { AiData, StepDef } from '@openworld/engine'
import { BLUE_SCARF, CH3, CHAPTER_FOUR, DEAD_WHEAT, DUST_HEAP, ELE_CAMPAIGN, ELE_ID, GRANARY_DOORS, GREAT_SCALE, HANGING_PAN, LEDGER, SALT_PAN, SCALE_OF_HUNGER, STANDING_KINDS, WAYSIDE_SCALE, WEIGHT_OF_SIN, createBoss } from '@openworld-game/content'
import { MapBuilder, rng, type Cell } from '../builder.ts'
import { L, GROUND_YIELD, appears, lay, levelCreatures } from '../kit.ts'
import { home } from '../village.ts'
import type { Place } from '../continent/generate.ts'
import { roomsBehind } from '../continent/rooms.ts'
import { planHall, glow, lit } from '../showcase/halls.ts'
import { decor, frontage, lamp, panels, strew, unshut } from '../showcase/dress.ts'
import { glowAt, stair } from '../showcase/ground.ts'
import { clearDoorsteps, houseRow, pave } from '../showcase/street.ts'
import { VALE_HOVELS } from '../../art/arch/buildings/regions.ts'
import { wildFloor } from '../wildfloor.ts'
import { noise, seal, ways } from './country.ts'
import { spot } from './chapter2.ts'

/** Edge openings: the grain road in from the camp (west), then east to Fairweight, the White Pans, the Black Balance. */
export const VALE = {
  road: { w: 56, h: 30, west: [14, 15], east: [13, 14, 15] },
  town: { w: 48, h: 36, west: [15, 16, 17], east: [15, 16, 17], south: [23, 24] },
  pans: { w: 50, h: 30, west: [14, 15, 16], east: [14, 15, 16] },
  balance: { w: 44, h: 32, west: [14, 15, 16] },
  floor: { w: 30, h: 30 },
} as const

/** Where the scenes stage their people. */
export const CH3_AT = {
  arrival: { corwin: [17, 20] as Cell },
  weighing: { haskel: [20, 15] as Cell, edith: [23, 15] as Cell, ottilie: [27, 14] as Cell, elsie: [17, 16] as Cell },
  ledger: { severin: [8, 7] as Cell },
  // (one comes in out of Ele's sight, as into the Pillar Yard)
  floor: { arrive: [14, 26] as Cell, ele: [14, 9] as Cell, severin: [9, 6] as Cell, gate: [[14, 28], [15, 28]] as Cell[], pans: [[6, 8], [21, 8]] as Cell[] },
} as const

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 6 })
const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })
const inRect = ([rx, ry, rw, rh]: readonly number[], x: number, y: number) => x >= rx && y >= ry && x < rx + rw && y < ry + rh
/** The Vale as a place, for the halls on a plan and the rooms behind its doors (planHall, roomsBehind read its region). */
const VALE_PLACE = { id: 'fairweight', name: L('Fairweight', '公秤镇'), region: 'tithe', kind: 'town', x: 46, y: 24, seed: 4301 } as unknown as Place

/** A hall of the Vale on its plan (plans.ts HALLS), walked into: its rooms walled as the plan's parts. */
function valeHall(key: Parameters<typeof planHall>[1], id: string, en: string, zh: string, floor: string, rooms: string[], opts: Parameters<typeof planHall>[5] = {}) {
  const { m, P } = planHall(VALE_PLACE, key, id, L(en, zh), floor, opts)
  m.backdrop = false
  for (const r of rooms) m.rooms.push({ style: 'shell', x: P[r].x - 1, y: P[r].y - 1, w: P[r].w + 2, h: P[r].h + 2 })
  return { m, P }
}

/** A field of dead wheat: bare earth in furrows, the wheat standing grey in its rows, straw strewn, cracks where the rain forgot it. */
function deadField(m: MapBuilder, x0: number, y0: number, w: number, h: number, seed: number): void {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (!m.free(x, y) || m.get(x, y) === 'path') continue
      m.set(x, y, 'dirt')
      if ((x - x0) % 2 === 0 && noise(x, y, 3, seed) > 0.22) m.fixture(DEAD_WHEAT, x, y)
    }
  for (let k = 0; k < Math.floor((w * h) / 40); k++) {
    const [x, y] = [x0 + 1 + 2 * rng.int(0, Math.floor((w - 2) / 2)), y0 + rng.int(0, h - 2)]
    decor(m, rng.chance(0.6) ? 'decor_straw' : `decor_cracks_${rng.int(0, 2)}`, x, y)
  }
}

// =================================================================== the Chaff Road

/** The crossroads on the Chaff Road, where the wayside scale stands; Nessa's waystone and her camp east of it. */
const ROAD = { cross: [22, 12] as Cell, stone: [38, 10] as Cell, camp: [41, 7] as Cell, mills: [[29, 1], [44, 2]] as Cell[] }

/**
 * The Chaff Road: the grain road where it comes down out of the March into the Vale of Scales. Flat ground, dead fields in
 * their strips on either side, a low rise to the north-east where two windmills stand still. At the crossroads a scale on
 * a post like a gibbet: everything that comes into the Vale is weighed. A waystone further on, where an almanac-maker has
 * pitched her tent to measure the sunset over the flattest horizon in the Five Lands.
 */
export function buildChaffRoad(): MapBuilder {
  const P = VALE.road
  const m = new MapBuilder('chaffroad', L('The Chaff Road', '糠路'), 'wild', P.w, P.h, 'dirt', 'field', 'outdoor', 'tithe')
  m.gearLevel = 11
  m.raise(0, 0, m.w, m.h, 2)
  // the rise north-east, where the mills stand
  m.raise(27, 0, m.w - 27, 8, 4)
  stair(m, 34, 8, 2, 4, 2, 'path')
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const n = noise(x, y, 6, 801)
      if (n > 0.86) m.set(x, y, 'drygrass')
    }
  // the grain road east, the track north-south across it at the crossroads
  m.path([[0, 14], [12, 14], [22, 13], [34, 14], [46, 13], [55, 14]], 'path', 3)
  m.path([[22, 0], [22, 13], [24, 29]], 'path', 1)
  m.path([[35, 13], [35, 9], [34, 6], [36, 3]], 'path', 1)
  // the dead fields in their strips, either side of the road
  for (const [x, y, w, h, s] of [[3, 2, 16, 9, 811], [3, 18, 17, 9, 812], [26, 18, 26, 9, 813]] as [number, number, number, number, number][]) deadField(m, x, y, w, h, s)
  // the mills on the rise, still
  for (const [x, y] of ROAD.mills) m.building(x === ROAD.mills[0][0] ? 'vale_windmill_a' : 'vale_windmill_b', x, y)
  // the wayside scale at the crossroads
  const [cx, cy] = ROAD.cross
  m.fixture(WAYSIDE_SCALE, cx + 2, cy - 1)
  m.fixture('fixture/sign', cx - 2, cy - 1, { props: { text: 'WEST: THE MARCH. EAST: FAIRWEIGHT, THE WHITE PANS, THE BLACK BALANCE.', text_zh: '往西：边境。往东：公秤镇、白盐滩、黑衡殿。' } })
  // the waystone and the almanac-maker's camp
  const [sx, sy] = ROAD.stone
  m.fixture('fixture/nature/boulder', sx, sy, { name: L('A waystone', '路碑'), tags: ['readable'], props: { text: 'A waystone of the grain road, worn smooth on the side the carts passed. Someone has scratched a line on its top and marked it with the hours.', text_zh: '运粮路上的一块路碑，靠大车走过的那一面被磨得光溜溜的。碑顶有人刻了一道线，还标上了钟点。' } })
  const [tx, ty] = ROAD.camp
  m.building('march_tent_c', tx, ty)
  m.fixture('fixture/light/campfire', tx + 1, ty + 4, lit)
  glowAt(m, tx + 1, ty + 4, 'night', 0.4)
  m.fixture('fixture/container/crate', tx + 3, ty + 3, { name: L('A crate of almanacs', '一箱历书') })
  // carts left on the road, a cart's wheel, bones of a draught ox
  m.fixture('fixture/furniture/cart', ...spot(m, 14, 12), { name: L('An empty grain cart', '一辆空运粮车') })
  m.fixture('fixture/furniture/cart', ...spot(m, 47, 16), { name: L('A grain cart with a broken axle', '一辆断了轴的运粮车') })
  m.fixture('fixture/remains/bones', ...spot(m, 49, 17))
  for (const [x, y, n] of [[10, 13, 0], [30, 15, 1], [42, 12, 2]] as [number, number, number][]) decor(m, `decor_cracks_${n}`, x, y)
  // a statue where the road comes in from the March
  m.fixture('fixture/sacred/waypoint', ...spot(m, 6, 11), { id: 'wp.chaffroad', name: L('Chaff Road statue', '糠路传送雕像') })
  // the people's places (people/corwin.ts, nessa.ts)
  m.anchor('nessa.stone', ...spot(m, sx, sy + 1, true))
  m.anchor('nessa.camp', ...spot(m, tx + 1, ty + 3, true))
  m.regions.arrival = [0, 9, 9, 11]
  m.regions.stone = [sx - 4, sy - 3, 9, 7]
  // what lives off the road: lean wolves, a boar in the stubble, bats over the mills at dusk
  m.creature('beast/wolf', ...spot(m, 12, 5, true), HUNT())
  m.creature('beast/wolf', ...spot(m, 15, 6, true), HUNT())
  m.creature('beast/wolf', ...spot(m, 45, 23, true), HUNT())
  m.creature('beast/boar', ...spot(m, 8, 23, true), HUNT(4))
  m.creature('beast/bat', ...spot(m, 40, 4, true), HUNT(6))
  m.creature('beast/bat', ...spot(m, 50, 5, true), HUNT(6))
  m.appear = [...GROUND_YIELD, appears('actor/creature/beast/wolf', ['dirt', 'farmland'], 2, 2400, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 } })]
  // dry rock and scrub round the edges, open where the roads go
  const keep = (x: number, y: number) => m.near(x, y, (t) => t === 'path', 2) || inRect([sx - 3, ty - 1, 10, 8], x, y)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (keep(x, y) || !m.free(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 1.2 + (noise(x, y, 5, 803) - 0.4) * 2.5) m.set(x, y, 'rock')
    }
  seal(m, ways(m, { west: P.west, east: P.east }), 'rock')
  lay(m, 'item/material/stone', 3, [4, 12, 30, 4])
  wildFloor(m, 0.4, keep)
  levelCreatures(m)
  return m
}

// =================================================================== Fairweight

/** Where Fairweight's buildings stand (their footprints' top-left): north of the street and of the lane, facing south. */
const TOWN = {
  weighhouse: [18, 2] as Cell,
  scales: [21, 9] as Cell,
  guild: [3, 6] as Cell,
  granary: [34, 3] as Cell,
  mill: [41, 6] as Cell,
  miller: [34, 11] as Cell,
  poorhouse: [2, 22] as Cell,
  chapel: [37, 18] as Cell,
  square: [14, 7, 20, 11] as const,
  street: 15,
  lane: 27,
  fields: [2, 30, 44, 5] as const,
}

/**
 * Fairweight: the market town of the Vale, round its square. The great scale stands in the middle of the square before
 * the weigh-house, where the Weighmaster keeps the Church's black weight and the Register of everyone he has weighed. The
 * Grain Guild's hall stands west of the square, its granary east of it, sealed and barred, and beyond that a windmill that
 * grinds salt. The street runs through west to east below the square; a lane below it, where the poor live, the poorhouse
 * at its west end and the Chapel of the Measure at its east; and beyond the lane the town's own fields, dead, where the
 * Lightened work all night by lantern.
 */
export function buildFairweight(): MapBuilder[] {
  const P = VALE.town
  const m = new MapBuilder('fairweight', L('Fairweight', '公秤镇'), 'town', P.w, P.h, 'dirt', 'village', 'outdoor', 'tithe')
  m.zone = 'peaceful'
  m.raise(0, 0, m.w, m.h, 2)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const n = noise(x, y, 5, 821)
      if (n > 0.88) m.set(x, y, 'drygrass')
    }
  // the square, the street below it west to east, the lane below that, the ways between them
  const [qx, qy, qw, qh] = TOWN.square
  m.rect(qx, qy, qw, qh, 'paving')
  panels(m, qx, qy, qw, qh, 6)
  for (let y = qy; y < qy + qh; y++) for (let x = qx; x < qx + qw; x++) if (Math.hypot(x + 0.5 - 23.5, y + 0.5 - 11.5) < 5) m.set(x, y, 'plaza')
  pave(m, 0, TOWN.street, m.w, 3, 'flags')
  pave(m, 0, TOWN.lane, m.w, 2, 'dirt')
  for (const x of [13, 34]) m.rect(x, TOWN.street + 3, 2, TOWN.lane - TOWN.street - 3, 'path')
  // the weigh-house at the square's head, the great scale before it
  const [wx, wy] = TOWN.weighhouse
  m.building('vale_counting', wx, wy, ['weighhouse'], true)
  const [sx, sy] = TOWN.scales
  m.building('vale_scales', sx, sy)
  // the Grain Guild's hall, west; its granary, east, barred; the mill beyond it, and the miller's hovel
  const [gx, gy] = TOWN.guild
  m.building('town_guild', gx, gy, ['guild'], true)
  const [rx, ry] = TOWN.granary
  m.building('vale_granary_a', rx, ry, ['granary'], true)
  const [dx, dy] = m.doors.granary
  m.fixture('fixture/sign', dx + 2, dy + 1, { props: { text: 'SEALED FOR THE TITHE OF THE HOLY CITY. BY ORDER OF THE GRAIN GUILD.', text_zh: '此仓封存，供圣城什一税。谷物行会令。' } })
  m.path([[dx, dy + 2], [qx + qw - 1, dy + 2]], 'paving', 1)
  const [mx, my] = TOWN.mill
  m.building('vale_windmill_b', mx, my)
  const [hx, hy] = TOWN.miller
  m.building('vale_hovel_3', hx, hy, ['miller'], true)
  for (const [x, y] of [[mx - 1, my + 7], [mx + 4, my + 7]] as Cell[]) m.fixture('fixture/container/sack', ...spot(m, x, y), { name: L('A sack of ground salt', '一袋磨好的盐') })
  for (const d of ['weighhouse', 'guild', 'miller']) {
    const [x, y] = m.doors[d]
    m.path([[x, y + 1], [x, TOWN.street]], 'paving', 1)
  }
  // the hovels north of the lane
  const hovels = houseRow(m, 15, 32, TOWN.lane - 2, VALE_HOVELS, 'fh', 0.3, { setback: 1, yards: ['bare'] })
  // the poorhouse at the lane's west end, the chapel at its east
  const [px, py] = TOWN.poorhouse
  m.building('vale_poorhouse', px, py, ['poorhouse'], true)
  const [cx, cy] = TOWN.chapel
  m.building('fort_chapel', cx, cy, ['chapel'], true)
  for (const d of ['poorhouse', 'chapel']) {
    const [x, y] = m.doors[d]
    m.path([[x, y + 1], [x, TOWN.lane]], 'path', 1)
  }
  // the guild's garden north of its hall, gone to seed; two dead trees
  for (const [x, y] of [[1, 2], [12, 3]] as Cell[]) m.set(x, y, 'charred_tree')
  m.rect(2, 1, 9, 4, 'dirt')
  for (const [x, y] of [[3, 2], [6, 2], [9, 3]] as Cell[]) m.fixture(DEAD_WHEAT, x, y)
  // the track south through the fields, the fen road (docs/chapter-4.md: opened by the chapter's end)
  m.rect(VALE.town.south[0], TOWN.lane + 2, 2, m.h - TOWN.lane - 2, 'path')
  // the fields beyond the lane, dead; a scarecrow
  const [fx, fy, fw, fh] = TOWN.fields
  deadField(m, fx, fy, fw, fh, 829)
  m.fixture('fixture/scarecrow', fx + 20, fy + 2)
  // the square's furniture: lamps, a well, benches, the carts that came empty
  for (const [x, y] of [[qx, qy], [qx + qw - 1, qy], [qx, qy + qh - 1], [qx + qw - 1, qy + qh - 1]] as Cell[]) lamp(m, x, y, 0.3)
  m.fixture('fixture/water/well/square', qx + 3, qy + 6)
  for (const [x, y] of [[qx + 16, qy + 8], [qx + 6, qy + 9]] as Cell[]) m.fixture('fixture/garden/bench', x, y)
  for (const [x, y] of [[qx + 17, qy + 3], [qx + 2, qy + 3]] as Cell[]) m.fixture('fixture/furniture/cart', x, y, { name: L('An empty cart', '一辆空车') })
  m.fixture('fixture/sign/noticeboard', qx + qw - 3, qy + 6, { tags: ['readable'], props: { text: 'WEIGHING DAY IS EVERY DAY. THE HUNGRY MAY BE WEIGHED. — H., WEIGHMASTER', text_zh: '每日皆为过秤日。饥者可来过秤。——称量官 H.' } })
  // the people's places (people/haskel.ts, berthe.ts, elsie.ts, corwin.ts, edith.ts, ottilie.ts, godwin.ts)
  m.anchor('haskel.scale', ...spot(m, sx + 2, sy + 6, true))
  m.anchor('ottilie.square', ...spot(m, qx + 15, qy + 8, true))
  m.anchor('berthe.lane', ...spot(m, 10, TOWN.lane, true))
  m.anchor('elsie.edge', ...spot(m, m.w - 3, TOWN.street + 1, true))
  m.anchor('elsie.well', ...spot(m, qx + 4, qy + 8, true))
  m.anchor('corwin.field', ...spot(m, fx + 10, fy + 2, true))
  m.anchor('edith.field', ...spot(m, fx + 28, fy + 3, true))
  m.anchor('godwin.mill', ...spot(m, mx + 3, my + 8, true))
  m.regions.square = [qx, qy, qw, qh + 1]
  m.regions.street = [0, TOWN.street - 1, m.w, 5]
  // the clutter of a poor town
  frontage(m, hovels, true)
  strew(m, 0, 0, m.w, m.h, 0.04, 'poor')
  clearDoorsteps(m)
  unshut(m)
  // the granary's barred doors in its doorway (after the doorsteps are cleared: these are meant to shut it)
  m.fixture(GRANARY_DOORS, dx, dy, { id: 'fairweight.granary.doors' })
  m.appear = GROUND_YIELD
  // within: every hovel's room (the halls are valeInteriors')
  const rooms = roomsBehind(m, VALE_PLACE, hovels.doors)
  for (const r of rooms) r.backdrop = false
  return [m, ...rooms]
}

/** The weigh-house: the Church's black weight on its plinth, the Register on its stand, the Weighmaster's desk and cot. */
export function buildWeighhouse(): MapBuilder {
  const { m, P } = valeHall('counting', 'fairweight.weighhouse', 'The Weigh-House', '称量所', 'parquet', [], { floors: [['strong', 'floor_stone'], ['clerks', 'floor_wood']] })
  const H = P.hall
  const S = P.strong
  m.fixture(WEIGHT_OF_SIN, S.x + 2, S.y + 1, { id: 'fairweight.weight' })
  for (const x of [S.x, S.x + 4]) m.fixture('fixture/light/candles', x, S.y + 1, lit)
  for (let x = H.x + 4; x <= H.x + 16; x++) if (x !== H.x + 10) m.fixture('fixture/furniture/counter', x, H.y + 2)
  m.fixture('fixture/furniture/bookstand', P.clerks.x + 1, P.clerks.y, {
    id: 'fairweight.register',
    name: L('The Register of the Weighed', '过秤名录'),
    tags: ['readable'],
    props: { text: 'A thick book of names, a line each: the name, the date, "light" or "not light". In the early pages there is a "light" now and then. In the last year nearly every line says it. On one line, in the same neat hand: "Aldric, son of the Weighmaster. Light."', text_zh: '一本厚厚的名册，一人一行：名字、日期，后面写着“轻”或者“不轻”。前面几页，偶尔才有一个“轻”。最近这一年，几乎每一行都是。其中一行，还是那工整的笔迹：“称量官之子奥德里克。轻。”' },
  })
  m.fixture('fixture/furniture/desk', P.clerks.x + 5, P.clerks.y + 1, { name: L("The Weighmaster's desk", '称量官的书桌') })
  m.fixture('fixture/furniture/bed', H.x + 19, H.y + 6, { name: L("The Weighmaster's cot", '称量官的小床') })
  m.fixture('fixture/container/bookcase', H.x, H.y + 5)
  m.fixture('fixture/container/cupboard', H.x + 16, H.y + 7, { name: L("The Weighmaster's cupboard", '称量官的橱柜') })
  glow(m, S.x + 2.5, S.y + 1.5, 8, 4, '#ffc46b', 0.35)
  m.anchor('haskel.desk', ...spot(m, P.clerks.x + 5, P.clerks.y + 2, true))
  m.anchor('haskel.bed', ...spot(m, H.x + 19, H.y + 7, true))
  m.regions.weight = [S.x - 1, S.y, S.w + 2, S.h + 2]
  return m
}

/** The Grain Guild's hall: the guildmistress's table on its dais, the ledgers, the strongbox where the granary's key is kept. */
export function buildGuildHall(): MapBuilder {
  const { m, P } = valeHall('council', 'fairweight.guild', 'The Grain Guild', '谷物行会', 'parquet', [], { floors: [['dais', 'carpet_royal']] })
  const H = P.hall
  const D = P.dais
  m.fixture('fixture/furniture/table/long', D.x + 3, D.y + 1, { name: L("The guild's table", '行会的长桌') })
  m.fixture('fixture/furniture/throne', D.x + 4, D.y, { name: L("The guildmistress's chair", '会长的椅子') })
  m.fixture('fixture/container/chest', D.x + 8, D.y, { name: L("The guild's strongbox", '行会的保险箱') })
  m.fixture(LEDGER, H.x + 3, H.y + 2, { name: L("The guild's ledger", '行会的账簿'), props: { text: 'The Grain Guild\'s ledger. The granary is full: so many measures of wheat, so many of barley, all of it entered "owed to the Holy City". The tithe-carts were due three seasons ago. In the margin, smaller: "still not come".', text_zh: '谷物行会的账簿。粮仓是满的：多少斗麦子，多少斗大麦，每一笔后面都写着“欠圣城”。什一税的车三季以前就该来了。页边上有一行小字：“还是没来。”' } })
  for (const x of [H.x + 1, H.x + H.w - 2]) m.fixture('fixture/container/bookcase', x, H.y)
  for (const [x, y] of [[D.x, D.y + 1], [D.x + D.w - 1, D.y + 1]] as Cell[]) m.fixture('fixture/light/candelabrum', x, y, lit)
  m.fixture('fixture/furniture/bed', H.x + H.w - 2, H.y + H.h - 2, { name: L("The guildmistress's bed", '会长的床') })
  glow(m, D.x + D.w / 2, D.y + 1.5, 10, 4, '#ffc46b', 0.35)
  m.anchor('ottilie.desk', ...spot(m, D.x + 4, D.y + 2, true))
  m.anchor('ottilie.bed', ...spot(m, H.x + H.w - 2, H.y + H.h - 3, true))
  return m
}

/** The granary: sacks heaped to the walls, more grain than the town has eaten in a year, all of it owed. */
export function buildGranary(): MapBuilder {
  const { m, P } = valeHall('granary', 'fairweight.granary', 'The Granary', '粮仓', 'floor_wood', [])
  const F = P.floor
  for (let x = F.x; x < F.x + F.w - 1; x += 2) decor(m, 'decor_sacks', x, F.y)
  for (const y of [F.y + 3, F.y + 5, F.y + 7]) for (const x of [F.x + 2, F.x + 6, F.x + 18, F.x + 22]) decor(m, 'decor_sacks', x, y)
  for (const [x, y] of [[F.x + 8, F.y + 2], [F.x + 17, F.y + 2], [F.x + 8, F.y + 9], [F.x + 17, F.y + 9]] as Cell[]) m.building('crypt_pillar', x, y)
  for (const [x, y] of [[F.x + 4, F.y + 4], [F.x + 20, F.y + 8], [F.x + 9, F.y + 9], [F.x + 16, F.y + 2]] as Cell[]) m.fixture('fixture/container/sack', x, y, { name: L('A sack of tithe wheat', '一袋什一税麦子') })
  glow(m, F.x + 13, F.y + 3, 10, 4, '#ffc46b', 0.25)
  m.regions.floor = [F.x, F.y, F.w, F.h]
  return m
}

/** The poorhouse: pallets close along the walls, the long table, the kitchen's pot on with bran in it. */
export function buildPoorhouse(): MapBuilder {
  const { m, P } = valeHall('poorhouse', 'fairweight.poorhouse', 'The Poorhouse', '济贫院', 'floor_wood', [], { floors: [['kitchen', 'floor_stone']] })
  const H = P.hall
  const K = P.kitchen
  m.fixture('fixture/craft/cauldron', K.x + 2, K.y, { ...lit, name: L('The poorhouse pot', '济贫院的锅') })
  decor(m, 'decor_firewood', K.x, K.y)
  for (let k = 0; k < 6; k++) m.fixture('fixture/furniture/bed', H.x + 8 + k * 2, H.y, { name: L('A pallet', '一张草铺') })
  for (const x of [H.x, H.x + 2, H.x + 4, H.x + 15, H.x + 17, H.x + 19]) m.fixture('fixture/furniture/bed', x, H.y + 8, { name: L('A pallet', '一张草铺') })
  m.fixture('fixture/furniture/table/long', H.x + 7, H.y + 4, { name: L('The poorhouse table', '济贫院的长桌') })
  m.fixture('fixture/container/sack', H.x + 19, H.y + 3, { name: L('A sack of bran', '一袋麸皮') })
  m.fixture('fixture/container/shelf', H.x + 1, H.y + 3, { name: L("A shelf with a jar on it", '架子上放着一个罐子'), tags: ['readable'], props: { text: 'A shelf by the child\'s pallet. On it, a small clay jar with grey dust in it, and a stopper.', text_zh: '孩子草铺边上的一个架子。上面放着一个小陶罐，里面装着灰土，盖着塞子。' } })
  glow(m, K.x + 2.5, K.y + 2, 7, 4, '#ff8a3a', 0.4)
  m.anchor('berthe.kitchen', ...spot(m, K.x + 2, K.y + 2, true))
  m.anchor('berthe.bed', ...spot(m, H.x + 9, H.y + 1, true))
  m.anchor('elsie.bed', ...spot(m, H.x + 1, H.y + 7, true))
  m.anchor('poor.table', ...spot(m, H.x + 9, H.y + 6, true))
  return m
}

/** The Chapel of the Measure: a scale carved over the altar, the litany on the wall. */
export function buildMeasureChapel(): MapBuilder {
  const { m, P } = valeHall('prchapel', 'fairweight.chapel', 'Chapel of the Measure', '衡量礼拜堂', 'floor_stone', [], { music: 'temple' })
  const N = P.nave
  m.fixture('fixture/sacred/altar', N.x + 5, N.y, {
    name: L('The altar of the Measure', '衡量祭坛'),
    tags: ['readable'],
    props: { text: 'An altar of pale stone. Carved over it, a man standing in one pan of a scale, the other pan heaped with sheaves. The man\'s pan is the higher. Under it: HIS FLESH AT LAST WAS LIGHTER THAN SIN. BLESSED ARE THE LIGHT.', text_zh: '一座浅色石头砌的祭坛。上方刻着一个人站在一杆秤的一只盘里，另一只盘里堆满了麦捆。人站的那只盘子更高。底下刻着：其肉身终轻于罪。轻者有福。' },
  })
  for (const x of [N.x + 2, N.x + 8]) m.fixture('fixture/light/candles', x, N.y, lit)
  for (const y of [N.y + 3, N.y + 5, N.y + 7]) for (const x of [N.x + 1, N.x + 7]) m.fixture('fixture/furniture/bench', x, y)
  glow(m, N.x + 5.5, N.y + 1.5, 8, 4, '#ffd27a', 0.35)
  return m
}

/** The miller's house by the windmill: one room, a cot, flour dust on everything though there is no flour. */
export function buildMillerHouse(): MapBuilder {
  return home('fairweight.miller', "The Miller's House", '磨坊主的家', 1, 'wood')
}

// =================================================================== the White Pans

/** The old salt-works north-west; the rows of the Standing; where Elsie's mother stands. */
const PANS = { works: [4, 3, 14, 8] as const, rows: [20, 4, 26, 22] as const, mother: [36, 19] as Cell, crumbling: [27, 13] as Cell, pan: [10, 9] as Cell }

/**
 * The White Pans: the salt flats east of Fairweight, white to the edge of sight. The old salt-works lie in the north-west,
 * their pans crusted over, a weighing pan on its frame by the sheds. East of them the Standing: the Lightened who walked
 * out here, in loose rows, all facing south-east toward the Black Balance, grey with dust. Here and there a low heap of
 * dust where one of them sat down. The road runs east through them.
 */
export function buildSaltPans(): MapBuilder {
  const P = VALE.pans
  const m = new MapBuilder('saltpans', L('The White Pans', '白盐滩'), 'wild', P.w, P.h, 'salt', 'field', 'outdoor', 'tithe')
  m.gearLevel = 12
  m.raise(0, 0, m.w, m.h, 2)
  // sand along the edges and in streaks; the salt everywhere else
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      const n = noise(x, y, 7, 841)
      if (edge < 3 + n * 3 || n < 0.16) m.set(x, y, 'sand')
    }
  m.path([[0, 15], [16, 15], [30, 14], [49, 15]], 'sand', 2)
  // the old salt-works: the pans in their grid, racks, a ruined shed, the weighing pan
  const [wx, wy, ww, wh] = PANS.works
  for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) for (const [ox, oy] of [[0, 0], [1, 0]] as Cell[]) m.fixture(SALT_PAN, wx + i * 3 + ox, wy + j * 2 + oy)
  m.building('ruin_low_x3', wx + 1, wy + wh - 1)
  for (const [x, y] of [[wx + ww - 1, wy], [wx + ww - 1, wy + 3]] as Cell[]) m.fixture('fixture/furniture/rack', x, y)
  m.fixture('fixture/furniture/cart', wx + ww + 1, wy + 5, { name: L('A salt cart, crusted white', '一辆结满白盐的盐车') })
  const [px, py] = PANS.pan
  m.fixture(WAYSIDE_SCALE, px, py, { name: L('A weighing pan', '一杆秤'), props: { text: 'The salt-works\' scale, a pan on a frame for weighing the salt by the sack. Its chain is rusted, but it still swings.', text_zh: '盐场的秤，一只秤盘吊在架子上，按袋称盐用的。链子锈了，可还能晃。' } })
  m.regions.works = [wx - 1, wy - 1, ww + 4, wh + 3]
  // the Standing, in loose rows, all facing south-east; heaps of dust where some of them sat down
  const [rx, ry, rw, rh] = PANS.rows
  let k = 0
  for (let y = ry; y < ry + rh; y += 3)
    for (let x = rx + ((y / 3) % 2); x < rx + rw; x += 3) {
      if (Math.abs(y - 14.5) < 2 || noise(x, y, 4, 847) > 0.82) continue
      const [jx, jy] = [x + rng.int(0, 1), y + rng.int(0, 1)]
      if (!m.free(jx, jy) || (jx === PANS.mother[0] && jy === PANS.mother[1])) continue
      if (rng.chance(0.12)) m.fixture(DUST_HEAP, jx, jy)
      else m.fixture(STANDING_KINDS[k++ % 3], jx, jy)
    }
  // one of them, near the road, nearly gone (the scene `standing` sends the wind through her)
  const [ux, uy] = PANS.crumbling
  m.fixture(STANDING_KINDS[0], ...spot(m, ux, uy), { id: 'saltpans.crumbling' })
  // Elsie's mother, her blue scarf at her feet
  const [mx, my] = PANS.mother
  m.fixture(STANDING_KINDS[1], mx, my, { id: 'saltpans.mother', props: { text: 'A woman stands here on the salt, facing south-east. She is grey with dust from her hair to her shoes, and very light: the wind moves her dress, and she sways with it. At her feet lies a blue scarf.', text_zh: '一个女人站在盐滩上，脸朝东南。她从头发到鞋子都被尘土染成了灰色，人也很轻：风一吹裙子，她就跟着晃。她脚边落着一条蓝围巾。' } })
  m.item({ form: BLUE_SCARF }, ...spot(m, mx, my + 1, true)).id = 'quest.elsie.scarf'
  m.regions.mother = [mx - 2, my - 2, 5, 5]
  m.regions.rows = [rx, ry, rw, rh]
  // what else the salt keeps: an overturned cart, the bones of an ox, ruts going nowhere
  m.fixture('fixture/furniture/cart', ...spot(m, 40, 22), { name: L('A cart on its side, half buried in salt', '一辆翻倒的车，半埋在盐里') })
  for (const [x, y] of [[42, 23], [12, 21], [33, 25]] as Cell[]) decor(m, 'decor_bones', ...spot(m, x, y))
  for (const [x, y] of [[8, 18], [22, 24], [45, 9], [30, 3]] as Cell[]) m.fixture(DUST_HEAP, ...spot(m, x, y))
  // what comes out over the salt at night: the dust that was people, and moves (ghosts); lean wolves at the edges
  m.creature('beast/wolf', ...spot(m, 6, 24, true), HUNT())
  m.creature('beast/wolf', ...spot(m, 44, 4, true), HUNT())
  m.appear = [appears('actor/creature/undead/ghost', ['salt', 'sand'], 3, 2400, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 8 }, night: true })]
  seal(m, ways(m, { west: P.west, east: P.east }), 'rock')
  levelCreatures(m)
  return m
}

// =================================================================== the Black Balance

/** The basilica at the Black Balance's east end (its doors the fog into the Scale Floor), the counting house on its court. */
const BALANCE = { keep: [28, 9] as Cell, counting: [6, 3] as Cell, court: [4, 9, 24, 14] as const, mound: [14, 0, 30, 32] as const }

/**
 * The Black Balance: Ele's seat, raised on a mound of the Vale's grain gone to dust. The road climbs onto the mound from
 * the west into a court of black flags where the Hollow Clerks still sit at their desks in rows, counting what nobody
 * brings any more. The counting house stands on the court's north side; the basilica closes its east end, and its doors
 * are a wall of fog. Tithe-collectors' bones stand guard by the carts.
 */
export function buildBlackBalance(): MapBuilder {
  const P = VALE.balance
  const m = new MapBuilder('blackbalance', L('The Black Balance', '黑衡殿'), 'dungeon', P.w, P.h, 'sand', 'ruins', 'outdoor', 'tithe')
  m.gearLevel = 12
  m.raise(0, 0, m.w, m.h, 2)
  // the mound: four half levels up, a stair up from the road
  m.raise(4, 2, m.w - 6, m.h - 4, 4)
  stair(m, 2, 14, 3, 2, 4, 'path')
  m.path([[0, 15], [4, 15]], 'path', 3)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) if (m.heights[y][x] === 2 && noise(x, y, 5, 861) > 0.55) m.set(x, y, 'salt')
  // the court of black flags
  const [qx, qy, qw, qh] = BALANCE.court
  m.rect(qx, qy, qw, qh, 'flagstone')
  m.rect(qx + qw, BALANCE.keep[1] + 4, BALANCE.keep[0] + 10 - qx - qw, 4, 'flagstone')
  // the counting house on the court's north side
  const [cx, cy] = BALANCE.counting
  m.building('vale_counting', cx, cy, ['counting'], true)
  // the basilica at the east end: its doors the fog into the Scale Floor
  const [kx, ky] = BALANCE.keep
  m.building('fort_keep', kx, ky - 7, [], true)
  const doors: Cell[] = [[kx + 5, ky + 3], [kx + 6, ky + 3]]
  doors.forEach(([x, y], i) => {
    const [ix, iy] = CH3_AT.floor.gate[i]
    m.portal(x, y, 'scalefloor', ix, iy - 2, L('The Scale Floor', '衡台'))
    m.fixture('fixture/fog', x, y, { name: L("The Black Balance's fog", '黑衡的雾门'), props: { boss: 'ele', interior: 'scalefloor', interiorX: ix, interiorY: iy - 2 } })
  })
  for (const [x, y] of [[kx + 3, ky + 4], [kx + 8, ky + 4]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'always', 0.45)
  }
  m.regions.gate = [kx + 1, ky + 3, 10, 6]
  // the Hollow Clerks at their desks in the court
  for (const [x, y] of [[8, 11], [12, 11], [16, 11], [8, 19], [12, 19], [16, 19]] as Cell[]) {
    m.fixture('fixture/furniture/desk', x, y)
    m.creature('undead/ghost', x, y + 1, { behaviour: 'melee', temper: 'aggressive', sight: 4, leash: 4 })
  }
  // the tithe-collectors' bones by the carts that never left
  for (const [x, y] of [[22, 12], [22, 19]] as Cell[]) m.creature('undead/skeleton', ...spot(m, x, y, true), { behaviour: 'melee', temper: 'aggressive', sight: 4, leash: 3 })
  for (const [x, y] of [[21, 10], [24, 21]] as Cell[]) m.fixture('fixture/furniture/cart', ...spot(m, x, y), { name: L('A tithe-cart, full of dust', '一辆装满灰土的什一税车') })
  // the grain of the mound, gone to dust, heaped against the walls
  for (const [x, y] of [[5, 22], [9, 24], [25, 24], [38, 24], [40, 5], [27, 3]] as Cell[]) m.fixture(DUST_HEAP, ...spot(m, x, y), { name: L('A heap of grain gone to dust', '一堆化成灰的粮食'), props: { text: 'Grain, once. It crumbles to grey powder between the fingers.', text_zh: '以前是粮食。一捻，就成了灰粉。' } })
  for (const [x, y, n] of [[10, 25, 0], [20, 27, 1], [33, 24, 2], [37, 18, 0]] as [number, number, number][]) decor(m, `decor_cracks_${n}`, x, y)
  for (const [x, y] of [[14, 26], [31, 27]] as Cell[]) decor(m, 'decor_bones', x, y)
  m.fixture(GREAT_SCALE, ...spot(m, 30, 22), { name: L("The Black Balance's tithe-scale", '黑衡殿的什一秤'), props: { text: 'A scale for weighing the tithe by the cart, its beam as long as a cart and its pans black with use. One pan holds a little grey dust. The other holds nothing, and is the lower.', text_zh: '一杆按车称什一税的秤，秤杆有一辆车那么长，两只秤盘都用得发黑了。一只盘里有一点灰土。另一只什么也没有，却沉得更低。' } })
  // a statue where the stair comes up onto the mound
  m.fixture('fixture/sacred/waypoint', ...spot(m, 5, 12), { id: 'wp.blackbalance', name: L('Black Balance statue', '黑衡殿传送雕像') })
  m.regions.court = [qx, qy, qw, qh]
  const keep = (x: number, y: number) => m.near(x, y, (t) => t === 'flagstone' || t === 'path' || t === 'door', 2)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (keep(x, y) || !m.free(x, y)) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 1.2 + (noise(x, y, 5, 863) - 0.4) * 2.5) m.set(x, y, 'rock')
    }
  seal(m, ways(m, { west: P.west }), 'rock')
  wildFloor(m, 0.3, keep)
  levelCreatures(m)
  return m
}

/** The counting room: the clerks' bookcases, the strongroom, and on its stand the ledger of the five columns. */
export function buildCountingRoom(): MapBuilder {
  const { m, P } = valeHall('counting', 'blackbalance.counting', 'The Counting Room', '账房', 'floor_stone', [], { music: 'crypt', light: 'dark', floors: [['strong', 'floor_stone'], ['clerks', 'floor_wood']] })
  const H = P.hall
  const S = P.strong
  m.fixture(LEDGER, H.x + 10, H.y + 3, {
    id: 'blackbalance.ledger',
    name: L("Ele's ledger", '厄勒的账簿'),
    props: { text: 'A ledger as big as a door, open on its stand. Each page has five columns, headed with the five seals: the Crown, the Scourge, the Scales, the Nails, the Lance. Each column is a list of weights, and at the foot of each the total is carried, in the same hand, to one account: THE HALL. The last pages are written smaller and smaller. The Hall has drawn more every year since the nights began to lengthen.', text_zh: '一本门板那么大的账簿，摊在架子上。每一页分五栏，栏头是五道印：荆棘冠、鞭刑柱、饥刑之秤、钉刑圣木、穿心圣枪。每一栏都是一串重量，每一栏的总数，都由同一个笔迹转进同一个账户：大殿。最后几页的字越写越小。自从夜晚开始变长，大殿每年支取的都比前一年多。' },
  })
  for (let x = H.x + 4; x <= H.x + 16; x += 4) m.fixture('fixture/furniture/desk', x, H.y + 6)
  for (let x = P.clerks.x; x <= P.clerks.x + 4; x += 2) m.fixture('fixture/container/bookcase', x, P.clerks.y)
  for (let x = S.x; x <= S.x + 5; x += 2) m.fixture('fixture/container/chest', x, S.y)
  for (const x of [H.x + 8, H.x + 12]) m.fixture('fixture/light/candles', x, H.y + 3, lit)
  glow(m, H.x + 10.5, H.y + 3.5, 9, 4, '#ffcf6a', 0.4)
  m.regions.room = [H.x, H.y, H.w, H.h]
  return m
}

// =================================================================== the Scale Floor

/**
 * The Scale Floor (docs/boss-rooms.md): the Black Balance's inner floor, a map of its own behind the fog. Black flags
 * under the two pans of the great balance, hung on chains from a dark too high to see; grain trickles from their lips and
 * never runs out. Ele stands between them. Walls all round, the fog behind one as one comes in, sealed while Ele stands.
 */
export function buildScaleFloor(): MapBuilder {
  const P = VALE.floor
  const m = new MapBuilder('scalefloor', L('The Scale Floor', '衡台'), 'field', P.w, P.h, 'flagstone', 'ruins', 'dark', 'tithe')
  m.gearLevel = 12
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 13)
      if (d < 10.5) m.set(x, y, d > 9.4 ? 'flags' : 'plaza')
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 1) m.set(x, y, 'wall')
    }
  // the two pans, the grain under them
  for (const [x, y] of CH3_AT.floor.pans) {
    m.fixture(HANGING_PAN, x, y)
    for (const [ox, oy] of [[0, 1], [1, 1], [-1, 0], [2, 0]] as Cell[]) m.set(x + ox, y + oy, 'sand')
  }
  for (const [x, y] of [[4, 22], [25, 22], [5, 4], [24, 4]] as Cell[]) m.fixture(DUST_HEAP, x, y)
  for (const [x, y] of [[4, 3], [P.w - 5, 3], [4, P.h - 4], [P.w - 5, P.h - 4]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'always', 0.5)
  }
  // the Priest of the Black Scales (the campaign's body: content chapter3.ts)
  const [ex, ey] = CH3_AT.floor.ele
  const k = createBoss('ele', { map: m.id, x: ex, y: ey }, ELE_ID)
  k.props = { ...k.props, ...ELE_CAMPAIGN }
  m.entities.push(k)
  // the gate: the fog on it, sealed while Ele stands; back out to the basilica's doors
  CH3_AT.floor.gate.forEach(([x, y], i) => {
    m.set(x, y, 'flagstone')
    m.set(x, y + 1, 'flagstone')
    m.portal(x, y, 'blackbalance', BALANCE.keep[0] + 5 + i, BALANCE.keep[1] + 4, L('The Black Balance', '黑衡殿'))
    m.fixture('fixture/fog', x, y, { name: L("The Black Balance's fog", '黑衡的雾门'), props: { boss: 'ele' } })
  })
  m.anchors.arrive = [CH3_AT.floor.arrive[0], CH3_AT.floor.arrive[1]]
  m.regions.floor = [2, 2, P.w - 4, P.h - 3]
  m.vistas.push({ at: [2, 2, P.w - 4, P.h - 4], zoom: 0.75, focus: [15, 11], share: 0.35 })
  return m
}

// =================================================================== the scenes

const W = CH3_AT.weighing
const F = CH3_AT.floor

/** The chapter's card at its end. */
const CHAPTER_END = {
  en: 'CHAPTER THREE · THE THIRD SEAL\n\nThe Priest of the Black Scales was hungry at the last.\nFairweight ate on its square, and wept, and ate.\nThe grey man carried a third light south.\nAnd the night came sooner again.',
  zh: '第三章 · 第三印\n\n黑衡司铎到最后，终于饿了。\n公秤镇的人在广场上吃饭，哭着，吃着。\n灰衣人带着第三道光往南去了。\n夜晚又来得更早了。',
}

export const CHAPTER3_STORY: StepDef[] = [
  {
    // Down the grain road: eight days, the fields dead, a man at work at noon with a lantern.
    id: 'vale_arrival',
    when: { map: 'chaffroad', region: 'arrival' },
    script: [
      { card: L('The grain road ran south and east for eight days.\nThe fields along it were empty.', '运粮路往东南走了八天。\n路两边的田，全是空的。') },
      say('player', '(Flat country to the edge of the sky. Wheat stands in the fields, grey and light, the ears empty. Two windmills on a rise to the north do not turn.)', '（一马平川，一直平到天边。田里立着麦子，灰灰的，轻飘飘的，穗子都是空的。北边坡上有两座风车，一动不动。）'),
      { place: 'npc.corwin', map: 'chaffroad', x: CH3_AT.arrival.corwin[0], y: CH3_AT.arrival.corwin[1] },
      say('player', '(In the field by the road a man is hoeing between the dead rows. It is broad day. A lit lantern hangs from his belt.)', '（路边的田里，有个人在枯死的垄沟间锄地。大白天的，他腰上还挂着一盏点着的灯。）'),
      say('npc.corwin', 'Good day, pilgrim! Or good night. I lose track. I do not sleep any more, you see, so it is all the one day.', '你好啊，朝圣者！要不就是晚上好。我分不清了。你看，我不睡觉了，所以一天连着一天，都是同一天。', 'happy'),
      say('pip', "Aren't you hungry? There's nothing growing.", '你不饿吗？地里什么都长不出来。', 'surprised'),
      say('npc.corwin', 'Hungry? No. Not since I was weighed. Fairweight is on along the road. They will weigh you too, if you ask.', '饿？不饿。过了秤以后就不饿了。公秤镇顺着路往前走就到。你要是愿意，他们也会给你过秤的。', 'happy'),
      say('pip', "Everything here is the colour of bread crust. ...And he's so thin.", '这里的东西都是面包皮的颜色。……他好瘦啊。', 'sad'),
      { place: 'npc.corwin', map: 'fairweight', x: 19, y: 31 },
      { fact: CH3.road, value: 1 },
    ],
  },
  {
    // The almanac-maker at the waystone, measuring the sunset over the flattest horizon in the Five Lands.
    id: 'nessa_vale',
    when: { map: 'chaffroad', region: 'stone', facts: { [CH3.road]: 1 } },
    script: [
      say('npc.nessa', 'You! The pilgrim from Firstlight. Of course it is you. Every time a seal falls, the sun goes down earlier, and here you are.', '是你！初原村那个朝圣者。当然是你。每倒下一道印，太阳就落得更早，然后你就出现了。', 'surprised'),
      say('npc.nessa', 'Seven o\'clock tonight. On the day I left Firstlight it was a quarter past eight. I have it all written down.', '今晚七点。我离开初原村那天，是八点一刻。我全都记下来了。'),
      say('npc.nessa', 'The old almanac\'s curve and mine still match. To the minute.', '那本旧历书的曲线，和我的还是对得上。分毫不差。'),
      say('npc.nessa', 'I am going on south, to the Fens. They say the dusk there never lifts. I want to know why. If you come that way, look for me.', '我要继续往南，去林沼。听说那里的黄昏从来不散。我想知道为什么。你要是往那边走，就来找我。'),
    ],
  },
  {
    // Weighing day: a widow stands in the great pan against the Church's black weight, and is found light.
    id: 'weighing',
    when: { map: 'fairweight', region: 'square' },
    script: [
      say('player', '(People stand in a line on the square before the great scale. They are thin, and quiet. A woman in black steps up into the big pan.)', '（广场上，人们在大秤前排成一队。个个都瘦，都不出声。一个穿黑衣的女人跨进了那只大秤盘。）'),
      { place: 'npc.haskel', map: 'fairweight', x: W.haskel[0], y: W.haskel[1] },
      { place: 'npc.edith', map: 'fairweight', x: W.edith[0], y: W.edith[1] },
      { place: 'npc.ottilie', map: 'fairweight', x: W.ottilie[0], y: W.ottilie[1] },
      say('npc.haskel', 'Edith, widow, of Fairweight. Weighed against the Measure.', '伊迪丝，寡妇，公秤镇人。以衡砣称之。'),
      say('player', '(The Weighmaster sets a black iron weight in the small pan. The beam tips. The woman\'s pan goes up, slowly, until it hangs level with the other, and then higher.)', '（称量官把一块黑铁秤砣放进小盘里。秤杆一歪。女人那边的秤盘慢慢升起来，升到和另一边一样平，又升得更高。）'),
      say('npc.haskel', 'Light.', '轻。'),
      say('npc.ottilie', 'Light.', '轻。'),
      say('npc.edith', '...I am not hungry. I am not hungry at all.', '……我不饿了。一点都不饿了。', 'happy'),
      say('player', '(She steps down, smiling, and walks off toward the fields. Nobody stops her. A woman in a grey habit pulls a little girl back out of the line by the hand.)', '（她笑着走下来，朝田里去了。没有人拦她。一个穿灰色会衣的女人拉着一个小女孩的手，把她从队伍里拽了出来。）'),
      { place: 'npc.elsie', map: 'fairweight', x: W.elsie[0], y: W.elsie[1] },
      say('pip', 'She looked happy. ...Why does that make me feel strange?', '她看起来很高兴。……为什么我心里怪怪的？', 'sad'),
      say('npc.haskel', 'A pilgrim. You may be weighed too, if you are hungry. No one in Fairweight starves. The scale sees to that.', '一位朝圣者。你要是饿了，也可以来过秤。公秤镇没有人会饿死。有这杆秤在。'),
      { place: 'npc.edith', map: 'fairweight', x: 27, y: 32 },
      { place: 'npc.elsie', map: 'fairweight', x: 7, y: 30 },
      { fact: CH3.weighing, value: 1 },
      { topic: 'edith_weighed', days: 10 },
    ],
  },
  {
    // The salt-works' scale: the fairy stands in its pan, and it does not move (a beat).
    id: 'lumi_pan',
    when: { map: 'saltpans', region: 'works' },
    say: L("I stood in that pan just now. It didn't move at all. ...Do I weigh nothing?", '我刚才站到那只秤盘里了。它一点都没动。……我是不是一点重量都没有？'),
  },
  {
    // The Standing on the salt: the Lightened in rows, facing the Black Balance; one of them goes to dust in the wind.
    id: 'standing',
    when: { map: 'saltpans', region: 'rows' },
    script: [
      say('player', '(People stand on the salt in loose rows, hundreds of them, all facing south-east. They are grey with dust. None of them moves.)', '（盐滩上站着人，一排一排，稀稀拉拉，有好几百个，全都脸朝东南。他们身上落满了灰。没有一个在动。）'),
      say('pip', 'Hello? ...They can\'t hear me.', '你好？……他们听不见。', 'sad'),
      say('player', '(A wind comes over the salt. The woman nearest the road sways in it, and the wind takes her, a little at a time, from the edges in, until there is only a heap of dust where she stood.)', '（一阵风刮过盐滩。离路最近的那个女人在风里晃了晃，风就把她带走了，一点一点，从边上往里，直到她站过的地方只剩下一小堆灰。）'),
      { tell: 'saltpans.crumbling', params: { what: 'crumble' } },
      { wait: 20 },
      say('pip', 'She was lighter than the wind.', '她比风还轻。', 'sad'),
      say('player', '(South-east, at the far end of the salt, there is something black on a mound.)', '（往东南看，盐滩的尽头，一座土丘上有个黑黑的东西。）'),
      { fact: CH3.pans, value: 1 },
    ],
  },
  {
    // The Black Balance's court: the clerks still at their desks (a beat).
    id: 'balance_court',
    when: { map: 'blackbalance' },
    say: L("Those clerks are still writing. ...They're dead. What are they counting?", '那些书记官还在写。……他们是死人。他们在数什么？'),
    facts: { [CH3.balance]: 1 },
  },
  {
    // The counting room: the ledger of the five columns, and the grey man reading it.
    id: 'ledger',
    when: { map: 'blackbalance.counting' },
    script: [
      say('player', '(A long room of desks and shelves. On a stand at its middle, a ledger as big as a door lies open, and a man in grey is reading it by his lantern.)', '（一间狭长的屋子，摆满了桌子和书架。正中的架子上摊着一本门板那么大的账簿，一个穿灰衣的人正就着提灯在读。）'),
      { place: 'npc.severin', map: 'blackbalance.counting', x: CH3_AT.ledger.severin[0], y: CH3_AT.ledger.severin[1] },
      { music: 'severin' },
      say('npc.severin', 'Five columns. One for each seal. Look at the foot of each.', '五栏。一印一栏。你看每一栏的最底下。'),
      say('npc.severin', 'Every one is carried to the same account. The Hall. For three hundred years.', '每一栏都转进同一个账户。大殿。转了三百年。'),
      say('npc.severin', 'And every year since the nights began to lengthen, the Hall has drawn more.', '自从夜晚开始变长，大殿每年支取的都比前一年多。'),
      say('pip', 'What does the Hall do with it?', '大殿拿这些做什么？', 'surprised'),
      say('npc.severin', 'Something there is eating.', '那里有什么东西在吃。'),
      say('npc.severin', 'Ele is on the floor beyond the fog. When the third seal breaks, I will be there.', '厄勒在雾门后面的衡台上。第三道印碎的时候，我会在那儿。'),
      say('player', '(He closes his lantern\'s shutter and goes out past you.)', '（他合上提灯的挡板，从你身边走了出去。）'),
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { music: '' },
      { fact: CH3.ledger, value: 1 },
    ],
  },
  {
    // The Scale Floor: the Priest of the Black Scales between the pans.
    id: 'scale_floor',
    when: { map: 'scalefloor', region: 'floor', facts: { [CH3.ele]: 0 } },
    script: [
      say('player', '(A floor of black stone under two great pans hanging from the dark. Grain trickles from their lips. Between them stands someone tall and thin in black and gold, holding the beam of a balance like a staff.)', '（一片黑石地面，头顶的黑暗里垂下两只巨大的秤盘，谷粒从盘沿细细地漏下来。两只盘子中间站着一个又高又瘦的人，一身黑金色的祭袍，把一杆秤的秤杆当作手杖拄着。）'),
      say(ELE_ID, 'A pilgrim. Come to be weighed.', '一位朝圣者。来过秤的。'),
      say(ELE_ID, 'Everything that comes into the Vale is weighed. So much grain. So much hunger. It must balance.', '凡入衡谷者，皆须过秤。这么多粮食，这么多饥饿。必须两相平衡。'),
    ],
  },
  {
    // The Scale: Ele hungry at the last; the Scale of Hunger given; Lumi catches part of the seal; the grey man the rest.
    id: 'scale',
    when: { map: 'scalefloor', facts: { [CH3.ele]: 1 } },
    script: [
      { music: 'sorrow' },
      { wait: 22 },
      say('player', '(Ele goes down on one knee. The beam falls from their hands. Above, the grain stops running from the pans.)', '（厄勒单膝跪了下去，秤杆从手里掉了。头顶上，秤盘里漏着的谷粒停了。）'),
      say('player', '("What is this? ...It is hollow. Here.")', '（“这是什么？……空的。这里。”）', 'sad'),
      say('player', '("Oh. ...This is what they asked me to take from them.")', '（“啊。……这就是他们求我替他们拿走的东西。”）', 'sad'),
      say('player', '("Hunger is not made less, pilgrim. It is only weighed out. Remember that, when it is weighed out to you.")', '（“饥饿不会变少，朝圣者。它只会被分出去。等它分到你头上的时候，记住这句话。”）'),
      say('player', '(Ele takes a small black scale from their belt, tips its pans empty, and holds it out to you.)', '（厄勒从腰间取下一杆黑色的小秤，把秤盘倒空，递给了你。）'),
      { give: SCALE_OF_HUNGER },
      say('player', '(Something comes loose from the scale, a cold light, and runs to Lumi.)', '（秤上有什么东西散了出来，是一道冷光，流向了露米。）'),
      { tell: 'pip', params: { what: 'boon', unlock: 'fast', from: ELE_ID } },
      { wait: 32 },
      say('pip', 'It came to me again! ...Oh. I\'m hungry. I\'ve never been hungry.', '又到我这儿来了！……哎呀。我饿了。我从来没饿过。', 'surprised'),
      say('pip', 'It\'s gone again. I feel light. Lighter than before.', '又没了。我觉得好轻。比以前更轻了。'),
      { place: 'npc.severin', map: 'scalefloor', x: F.severin[0], y: F.severin[1] },
      { music: 'severin' },
      say('player', '(The grey man comes out from behind a pan and opens his lantern. The rest of the light goes into the flame. It nearly goes out. He coughs, and what he coughs into his hand is ash.)', '（灰衣人从秤盘后面走出来，打开了提灯。剩下的光流进火里。火苗差点灭了。他咳了起来，咳在手心里的是灰。）'),
      say('npc.severin', 'Three.', '第三道了。'),
      say('npc.severin', 'When you have the Nails, come to the Fens. I will show you what you are carrying them to.', '等你拿到圣钉，就到林沼来。我让你看看，你是把它们送到什么东西那里去。'),
      say('player', '(He goes out through the fog, south.)', '（他穿过雾门，往南去了。）'),
      { move: 'npc.severin', x: F.gate[0][0], y: F.gate[0][1] - 1 },
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { fact: CH3.scale, value: 1 },
      // the third seal down: the night longer again (calendar.ts nightHours: dusk at six, dawn at half past six)
      { fact: 'night.shift', value: 3 },
      { topic: 'scale_tipped', days: 30 },
    ],
  },
  {
    // Fairweight after the scale tipped: the Lightened hungry again, all at once; the granary sealed for the Church.
    id: 'hunger',
    when: { map: 'fairweight', facts: { [CH3.scale]: 1 } },
    script: [
      say('player', '(The square is full of people. The Lightened have come in from the fields. They are holding their stomachs, and some of them are crying.)', '（广场上挤满了人。被称轻的人都从田里回来了。他们捂着肚子，有的在哭。）'),
      { place: 'npc.berthe', map: 'fairweight', x: 22, y: 16 },
      { place: 'npc.edith', map: 'fairweight', x: 25, y: 16 },
      say('npc.edith', 'I am hungry. I am so hungry. I had forgotten. How could I have forgotten this?', '我饿。我好饿。我都忘了。我怎么会忘了这个？', 'sad'),
      say('npc.berthe', 'Three years of hunger, all on one morning. The granary is full. The Guild has it sealed for the Church\'s carts, and the carts have not come in three seasons.', '三年的饿，一个早上全回来了。粮仓是满的。行会把它封着，等教会的车来拉，可那些车三季都没来了。', 'angry'),
      say('npc.berthe', 'The key is with Ottilie at the guild hall. Or the doors are only wood.', '钥匙在行会会馆的奥蒂莉手里。要不然，那两扇门也不过是木头做的。'),
      { fact: CH3.hunger, value: 1 },
    ],
  },
  {
    // The supper on the square: the granary open, the town fed; Corwin tastes bread. The chapter ends.
    id: 'supper',
    when: { map: 'fairweight', facts: { [CH3.granary]: 1 }, hour: { from: 17, to: 23 } },
    script: [
      say('player', '(Berthe\'s kettles are on fires across the square. The whole town sits on the paving with bowls, and eats, and cries, and eats.)', '（贝尔特的锅支在广场各处的火上。全镇的人都坐在石板地上，捧着碗，吃着，哭着，又吃着。）'),
      { place: 'npc.berthe', map: 'fairweight', x: 22, y: 16 },
      { place: 'npc.corwin', map: 'fairweight', x: 25, y: 17 },
      { place: 'npc.ottilie', map: 'fairweight', x: 28, y: 16 },
      { place: 'npc.haskel', map: 'fairweight', x: 19, y: 16 },
      say('npc.corwin', 'Bread. ...I had forgotten bread. It tastes of my kitchen. There was someone in my kitchen.', '面包。……我把面包都忘了。它是我家灶房的味道。我家灶房里，原来还有一个人。', 'sad'),
      say('npc.ottilie', 'I will write to the Holy City that the scale broke, and that a pilgrim opened the granary. Both are true.', '我会写信告诉圣城，大秤坏了，有个朝圣者打开了粮仓。两件都是实话。'),
      say('npc.haskel', 'The beam has split down its length. I have weighed this town for thirty years. ...I do not know what I will do in the mornings.', '秤杆从头到尾裂开了。这个镇子我称了三十年。……往后的早上，我都不知道该干什么。', 'sad'),
      say('npc.berthe', 'Eat something, Haskel. Then go to bed. That is what the mornings are for.', '吃点东西吧，哈斯克尔。然后去睡觉。早上本来就是干这个的。'),
      say('player', '(The sun has gone down behind the dead fields. It went down at six.)', '（太阳已经落到枯死的田地后面去了。六点就落了。）'),
      { fact: CH3.end, value: 1 },
      { fact: CHAPTER_FOUR, value: 1 },
      { music: 'ending' },
    ],
  },
  {
    // The chapter's card.
    id: 'chapter3_end',
    when: { after: 'supper' },
    script: [{ card: L(`${CHAPTER_END.en}\n\nThe road south into the Pale Fens is open.`, `${CHAPTER_END.zh}\n\n往南去苍白林沼的路通了。`) }],
  },
]

/** The Vale's halls, linked to their doors (world.ts). */
export function valeInteriors(town: MapBuilder, balance: MapBuilder): MapBuilder[] {
  const weighhouse = buildWeighhouse()
  const guild = buildGuildHall()
  const granary = buildGranary()
  const poorhouse = buildPoorhouse()
  const chapel = buildMeasureChapel()
  const counting = buildCountingRoom()
  town.linkInterior('weighhouse', weighhouse)
  town.linkInterior('guild', guild)
  town.linkInterior('granary', granary)
  town.linkInterior('poorhouse', poorhouse)
  town.linkInterior('chapel', chapel)
  const miller = buildMillerHouse()
  town.linkInterior('miller', miller)
  balance.linkInterior('counting', counting)
  return [weighhouse, guild, granary, poorhouse, chapel, counting, miller]
}
