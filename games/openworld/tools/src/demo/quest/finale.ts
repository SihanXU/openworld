// The finale (docs/finale.md; content finale.ts): the Holy City at the main line's end — its maps, the places its people
// keep, and the last scenes. The close of the Most Holy Hall, the avenue up to it between the statues of the five bearers,
// the great church's front filling the sky; the nave, where the Primate tells the pilgrim the truth and opens the floor
// behind the altar; the Confluence below, where the channels of the five lands run into one; and the Holiest, the round
// crypt where Astra lies on his bier with five niches round him. The ending is played there, and stays there.

import type { StepDef } from '@openworld/engine'
import { ASTRA_CAMPAIGN, ASTRA_ID, BEARER_STATUE, BIER, CHANNELS, FIN, INSTRUMENT_NICHE, RED_CHANNEL, createBoss } from '@openworld-game/content'
import { MapBuilder, type Cell } from '../builder.ts'
import { L, levelCreatures } from '../kit.ts'
import { lamp, parterre, unshut } from '../showcase/dress.ts'
import { glowAt } from '../showcase/ground.ts'
import { linkDoors, linkStair } from '../showcase/rooms.ts'
import { NAVE } from '../../art/arch/plans.ts'
import { lit, glow } from '../showcase/halls.ts'
import { seal, ways } from './country.ts'
import { spot } from './chapter2.ts'

/** The close's way in from the road down out of the Heights (its south edge). */
export const HOLY = {
  close: { w: 50, h: 84, south: [24, 25] },
  confluence: { w: 40, h: 30 },
  holiest: { w: 30, h: 30 },
} as const

/** Where the church stands on the close (26 by 44 cells, its porch on the last row), the parvis and the avenue below it. */
const CHURCH: Cell = [12, 18]
const PARVIS = { x: 8, y: 62, w: 34, h: 8 }
const AVENUE = { x: 21, y: 70, w: 8 }

/** Where the scenes stage their people. */
export const FIN_AT = {
  arrival: { severin: [26, 78] as Cell },
  primate: { primate: [17, 22] as Cell },
  confluence: { severin: [22, 9] as Cell },
  // (one comes in out of Astra's sight)
  holiest: { arrive: [14, 26] as Cell, bier: [14, 5] as Cell, astra: [14, 15] as Cell, severin: [12, 25] as Cell, gate: [[14, 28], [15, 28]] as Cell[] },
} as const

const say = (who: string, en: string, zh: string, mood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy') => ({ say: who, text: L(en, zh), ...(mood && { mood }) })

/** The five bearers in stone, with their seals: the avenue's statues, a pair a seal. */
const BEARERS: [string, string][] = [
  ['THE FIRST SEAL. THE CROWN. HE HOLDS.', '第一印。荆棘冠。他守住了。'],
  ['THE SECOND SEAL. THE SCOURGE. HE BEARS.', '第二印。鞭刑柱。他担住了。'],
  ['THE THIRD SEAL. THE SCALES. THEY WEIGH.', '第三印。饥刑之秤。他们称量。'],
  ['THE FOURTH SEAL. THE NAILS. HE KEEPS.', '第四印。钉刑圣木。他留住了。'],
  ['THE FIFTH SEAL. THE LANCE. THEY WAIT.', '第五印。穿心圣枪。他们等待。'],
]

/** A channel laid cell by cell along straight runs between corner points (left on any floor, never on a wall). */
function channelRun(m: MapBuilder, type: string, pts: Cell[]): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [[ax, ay], [bx, by]] = [pts[i], pts[i + 1]]
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
    for (let k = 0; k <= n; k++) {
      const x = ax + Math.sign(bx - ax) * k
      const y = ay + Math.sign(by - ay) * k
      if (m.free(x, y) && !['cave_wall', 'wall'].includes(m.get(x, y))) m.fixture(type, x, y)
    }
  }
}

// =================================================================== the close of the Most Holy Hall

/**
 * The close of the Most Holy Hall: the road from the Heights comes in at the south gate and climbs an avenue between the
 * statues of the five bearers, a pair to each seal, to the parvis, where the great church's west front fills the sky. Its
 * fountain, its parterres, its lamps; the Hall's wardens at the porch.
 */
export function buildHolyClose(): MapBuilder[] {
  const P = HOLY.close
  const m = new MapBuilder('holyhall', L('The Most Holy Hall', '至圣大殿'), 'temple', P.w, P.h, 'grass', 'temple', 'outdoor', 'holy')
  m.zone = 'peaceful'
  // the church; the orchard round its chevet, room for its picture to rise into
  const [cx, cy] = CHURCH
  m.building('abbey_church', cx, cy, ['church.west', 'church.west2'])
  for (let y = 1; y < cy; y += 3) for (let x = 3; x < P.w - 3; x += 4) if (x < cx - 1 || x > cx + 26) m.set(x + (y % 2), y, 'tree')
  // the parvis before the west front: paving, parterres, the grand fountain, the bearers' first statues
  const mid = cx + 13
  m.rect(PARVIS.x, PARVIS.y, PARVIS.w, PARVIS.h, 'paving')
  m.building('town_fountain_grand', mid - 3, PARVIS.y + 2)
  parterre(m, PARVIS.x + 2, PARVIS.y + 2, 9, 4)
  parterre(m, PARVIS.x + PARVIS.w - 11, PARVIS.y + 2, 9, 4)
  for (const [x, y] of [[PARVIS.x + 1, PARVIS.y + 1], [PARVIS.x + PARVIS.w - 2, PARVIS.y + 1], [PARVIS.x + 1, PARVIS.y + PARVIS.h - 2], [PARVIS.x + PARVIS.w - 2, PARVIS.y + PARVIS.h - 2]] as Cell[]) lamp(m, x, y)
  for (const x of [mid - 6, mid + 5]) m.fixture('fixture/standard', x, PARVIS.y)
  // the avenue down to the gate, the statues in pairs either side, lamps between
  m.rect(AVENUE.x, PARVIS.y + PARVIS.h, AVENUE.w, P.h - PARVIS.y - PARVIS.h, 'flags')
  m.rect(AVENUE.x + 1, PARVIS.y + PARVIS.h, AVENUE.w - 2, P.h - PARVIS.y - PARVIS.h, 'paving')
  BEARERS.forEach(([en, zh], i) => {
    const y = PARVIS.y + PARVIS.h + 1 + i * 2
    for (const x of [AVENUE.x - 2, AVENUE.x + AVENUE.w + 1]) m.fixture(BEARER_STATUE, x, y, { props: { text: `A tall statue of a hooded figure on a plinth, its face worn smooth. On the plinth: ${en}`, text_zh: `一尊戴兜帽的高大雕像，立在石座上，面孔已经磨平了。石座上刻着：${zh}` } })
  })
  for (let y = PARVIS.y + PARVIS.h + 2; y < P.h - 2; y += 4) for (const x of [AVENUE.x - 1, AVENUE.x + AVENUE.w]) if (m.free(x, y)) lamp(m, x, y)
  for (let y = PARVIS.y + PARVIS.h; y < P.h; y++) for (const x of [AVENUE.x - 4, AVENUE.x + AVENUE.w + 3]) if (m.free(x, y)) m.set(x, y, 'bush')
  m.fence('stonewall', [1, P.h - 3], [AVENUE.x - 1, P.h - 3])
  m.fence('stonewall', [AVENUE.x + AVENUE.w, P.h - 3], [P.w - 2, P.h - 3])
  // the people's places (people/primate.ts, wardens.ts, nessa.ts)
  m.anchor('warden.porch.w', ...spot(m, mid - 3, PARVIS.y, true))
  m.anchor('warden.porch.e', ...spot(m, mid + 3, PARVIS.y, true))
  m.anchor('nessa.parvis', ...spot(m, mid + 4, PARVIS.y + 5, true))
  m.regions.gate = [AVENUE.x - 4, P.h - 12, AVENUE.w + 8, 12]
  m.regions.parvis = [PARVIS.x, PARVIS.y, PARVIS.w, PARVIS.h]
  unshut(m)
  seal(m, ways(m, { south: P.south }), 'rock')
  // within: the nave, its door the church's west door
  const nave = buildHolyNave()
  linkDoors(m, [m.doors['church.west']], nave, [nave.doors.out])
  m.portal(m.doors['church.west2'][0], m.doors['church.west2'][1], nave.id, NAVE.axis, NAVE.door[1] - 1, nave.name)
  return [m, nave]
}

/**
 * The nave of the Most Holy Hall (its plan art/arch/plans.ts NAVE, the showcase's great church's): dark, the candles by
 * the hundred, the five channels' grates in its floor; at the high altar the Primate, and behind the altar the stone that
 * lifts on the stair down to the Confluence.
 */
export function buildHolyNave(): MapBuilder {
  const NP = NAVE.parts
  const AX = NAVE.axis
  const nave = new MapBuilder('holyhall.nave', L('The Most Holy Hall — the Nave', '至圣大殿·中殿'), 'interior', NAVE.plan[0].length, NAVE.plan.length, 'void', 'temple', 'indoor', 'holy')
  nave.zone = 'peaceful'
  const inside = (r: { x: number; y: number; w: number; h: number }, t: string) => nave.rect(r.x, r.y, r.w, r.h, t)
  for (const r of Object.values(NP)) inside(r, 'lattice')
  for (const r of [NP.apse, NP.choir, NP.chapelW1, NP.chapelW2, NP.chapelE1, NP.chapelE2, NP.narthex]) inside(r, 'marble')
  nave.rect(9, NP.transept.y, 17, NP.transept.h, 'marble')
  const dais = NP.apse.y
  const step = NP.choir.y + NP.choir.h - 3
  nave.raise(NP.choir.x, dais, NP.choir.w, step - dais, 2)
  nave.raise(NP.apse.x, dais, NP.apse.w, NP.choir.y - dais, 2)
  nave.raise(NP.choir.x, step, NP.choir.w, 1, 1)
  nave.rect(AX - 1, NP.transept.y + NP.transept.h, 3, NP.nave.h + NP.narthex.h, 'carpet_royal')
  nave.rect(AX - 1, step - 4, 3, NP.transept.y - (step - 4), 'carpet_royal')
  nave.rect(AX - 2, dais + 3, 5, step - 4 - (dais + 3), 'carpet_royal')
  nave.set(AX, NAVE.door[1], 'door')
  nave.building('nave_shell', 0, 0)
  // the apse: the high altar, and behind it the stone over the stair down (lifted by the Primate)
  nave.fixture('fixture/sacred/altar/high', AX, dais + 3, { props: { text: 'TO ASTRA, WHO BEARS THE NIGHT FOR US. AS LONG AS SOMEONE BEARS THE FIVE, THE DAWN WILL NOT GO OUT.', text_zh: '献给为我们承受黑夜的阿斯特拉。只要仍有人承担五苦，黎明便不会熄灭。' } })
  nave.doors.down = [AX, dais + 1]
  for (const k of [-1, 1]) {
    nave.fixture('fixture/light/candelabrum', AX + k * 3, dais + 3, lit)
    nave.fixture('fixture/sacred/cross', AX + k * 4, dais + 1)
    nave.fixture('fixture/sacred/saint', AX + k * 7, NP.choir.y)
    nave.fixture('fixture/light/candelabrum', AX + k * 8, step - 2, lit)
  }
  for (let x = NP.choir.x; x < NP.choir.x + NP.choir.w; x++) if (Math.abs(x - AX) > 2) nave.fixture('fixture/sacred/rail', x, step - 1)
  // the crossing: a grate for each of the five channels in its floor, running toward the altar
  for (const [i, t] of [RED_CHANNEL, CHANNELS.dust, CHANNELS.black, CHANNELS.white, CHANNELS.thorn].entries()) nave.fixture(t, AX - 4 + i * 2, NP.transept.y + 3)
  for (const x of [9, 25]) for (const y of [NP.transept.y, NP.transept.y + NP.transept.h - 1]) nave.building('nave_pier', x, y)
  // the nave: pews, candles by the hundred along the walls
  for (let y = NP.nave.y + 3; y < NP.nave.y + NP.nave.h - 2; y += 2) for (const x of [AX - 6, AX - 3, AX + 3, AX + 6]) nave.fixture('fixture/furniture/pew', x, y)
  for (let y = NP.nave.y + 1; y < NP.nave.y + NP.nave.h; y += 4) for (const x of [NP.nave.x, NP.nave.x + NP.nave.w - 1]) nave.fixture('fixture/light/candles', x, y, lit)
  for (const r of [NP.chapelW1, NP.chapelW2, NP.chapelE1, NP.chapelE2]) nave.fixture('fixture/light/candelabrum', r.x + 1, r.y + 1, lit)
  nave.fixture('fixture/sacred/font', AX - 4, NP.narthex.y + 1)
  // the light: the candles' gold, the great window dark (the sun is short now)
  nave.lights.push({ x: AX, y: dais + 4, w: 7, h: 6, color: '#ffc46b', shape: 'glow', when: 'always', strength: 0.5 })
  for (const [x, y] of [[NP.nave.x, NP.nave.y + 9], [NP.nave.x + NP.nave.w - 1, NP.nave.y + 9], [NP.nave.x, NP.nave.y + 17], [NP.nave.x + NP.nave.w - 1, NP.nave.y + 17]]) nave.lights.push({ x, y, w: 4, h: 4, color: '#ffb35c', shape: 'glow', when: 'always', strength: 0.4 })
  nave.vistas.push({ at: [NP.choir.x, NP.apse.y, NP.choir.w, NP.choir.y + NP.choir.h - NP.apse.y], zoom: 0.6, focus: [AX, NP.apse.y - 4], share: 0.5 })
  nave.vistas.push({ at: [2, NP.transept.y, 31, NP.nave.y + NP.nave.h - NP.transept.y], zoom: 0.75, focus: [AX, NP.apse.y], share: 0.35 })
  nave.anchors = { 'primate.altar': [AX, dais + 5], 'primate.choir': [AX + 2, step - 3] }
  nave.doors.out = [AX, NAVE.door[1]]
  nave.regions.choir = [NP.choir.x, NP.transept.y, NP.choir.w, NP.transept.h + 2]
  return nave
}

// =================================================================== the Confluence

/**
 * The Confluence: the old works under the Hall, where the channels of the five lands run in out of the dark — red from the
 * March, dust from the Vale, black water from the Fens, white from the Heights, thorns from the coast — and meet in one
 * before the fog of the Holiest. Things that are not of this world come up out of the dark between them. By the fog, the
 * weapons of pilgrims who came this far.
 */
export function buildConfluence(): MapBuilder {
  const P = HOLY.confluence
  const m = new MapBuilder('confluence', L('The Confluence', '五渠汇'), 'interior', P.w, P.h, 'cave_floor', 'crypt', 'dark', 'holy')
  m.zone = 'combat'
  m.gearLevel = 20
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (x < 2 || y < 2 || x >= P.w - 2 || y >= P.h - 2) m.set(x, y, 'cave_wall')
  m.rect(18, 2, 4, 7, 'marble')
  // the five channels, each from its own side, running straight in and turning down into the basin before the fog
  m.rect(17, 8, 6, 3, 'marble')
  const runs: [string, Cell[]][] = [
    [RED_CHANNEL, [[37, 5], [23, 5], [23, 8]]],
    [CHANNELS.dust, [[37, 13], [23, 13], [23, 11]]],
    [CHANNELS.black, [[20, 24], [20, 11]]],
    [CHANNELS.white, [[2, 13], [16, 13], [16, 11]]],
    [CHANNELS.thorn, [[2, 5], [16, 5], [16, 8]]],
  ]
  for (const [t, pts] of runs) channelRun(m, t, pts)
  // the fog of the Holiest at the head of the meeting
  const fogs: Cell[] = [[19, 2], [20, 2]]
  fogs.forEach(([x, y], i) => {
    const [ix, iy] = FIN_AT.holiest.gate[i]
    m.portal(x, y, 'holiest', ix, iy - 2, L('The Holiest', '至圣所'))
    m.fixture('fixture/fog', x, y, { name: L('The fog of the Holiest', '至圣所的雾门'), props: { boss: 'astra', interior: 'holiest', interiorX: ix, interiorY: iy - 2 } })
  })
  for (const [x, y] of [[17, 3], [22, 3]] as Cell[]) {
    m.fixture('fixture/light/brazier', x, y, lit)
    glowAt(m, x, y, 'always', 0.5)
  }
  // what pilgrims who came this far left at the door
  m.item({ form: 'item/weapon/polearm/spear', material: 'iron', name: L("A pilgrim's spear, left at the door", '朝圣者留在门前的长矛') }, ...spot(m, 16, 6, true))
  m.item({ form: 'item/weapon/blade/sword', material: 'iron', name: L("A pilgrim's sword, left at the door", '朝圣者留在门前的剑') }, ...spot(m, 24, 6, true))
  // the things that come up out of the dark between the channels
  for (const [x, y] of [[10, 10], [30, 12], [12, 22], [28, 22]] as Cell[]) m.creature('undead/ghost', ...spot(m, x, y, true), { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 })
  for (const [x, y] of [[8, 16], [33, 8]] as Cell[]) m.creature('wisp', ...spot(m, x, y, true), { behaviour: 'melee', temper: 'aggressive', sight: 5, leash: 6 })
  m.fixture('fixture/sacred/waypoint', ...spot(m, 22, 25), { id: 'wp.confluence', name: L('Confluence statue', '五渠汇传送雕像') })
  m.anchors = { stair: [20, 26] }
  m.regions.meeting = [12, 4, 16, 12]
  m.regions.below = [0, 0, P.w, P.h]
  levelCreatures(m)
  return m
}

// =================================================================== the Holiest

/**
 * The Holiest (docs/boss-rooms.md): the round crypt under the Most Holy Hall. Its floor white stone in a ring, its walls the
 * rock, five arched niches round it for the five instruments; the five channels run into the foot of the bier at its
 * heart, where Astra has lain four hundred years. Behind one, the fog; once he is dead, the way up is the Night's.
 */
export function buildHoliest(): MapBuilder {
  const P = HOLY.holiest
  const m = new MapBuilder('holiest', L('The Holiest', '至圣所'), 'field', P.w, P.h, 'cave_wall', 'crypt', 'dark', 'holy')
  m.gearLevel = 20
  for (let y = 0; y < P.h; y++)
    for (let x = 0; x < P.w; x++) {
      const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 14)
      if (d < 12.5) m.set(x, y, d > 11.4 ? 'flags' : 'marble')
    }
  m.rect(13, 25, 4, P.h - 25, 'marble')
  const [bx, by] = FIN_AT.holiest.bier
  m.fixture(BIER, bx, by, { id: 'holiest.bier' })
  // the five channels into its sides
  for (const [t, pts] of [[RED_CHANNEL, [[4, 5], [12, 5]]], [CHANNELS.white, [[4, 7], [12, 7], [12, 6]]], [CHANNELS.dust, [[25, 5], [17, 5]]], [CHANNELS.black, [[25, 7], [17, 7], [17, 6]]], [CHANNELS.thorn, [[15, 2], [15, 4]]]] as [string, Cell[]][]) channelRun(m, t, pts)
  // the five niches round the wall
  for (const [x, y] of [[8, 3], [21, 3], [26, 11], [3, 11], [11, 2]] as Cell[]) m.fixture(INSTRUMENT_NICHE, ...spot(m, x, y))
  for (const [x, y] of [[9, 7], [20, 7], [7, 18], [22, 18]] as Cell[]) m.fixture('fixture/light/candles', ...spot(m, x, y), lit)
  glow(m, bx + 0.5, by + 1, 8, 4, '#c8b8ff', 0.35)
  // the First Martyr, risen from his bier (the campaign's body: content finale.ts)
  const [ax, ay] = FIN_AT.holiest.astra
  const k = createBoss('astra', { map: m.id, x: ax, y: ay }, ASTRA_ID)
  k.props = { ...k.props, ...ASTRA_CAMPAIGN }
  m.entities.push(k)
  // the gate: the fog, sealed while he stands; then the way up, until the Night takes it (`fin.way`)
  FIN_AT.holiest.gate.forEach(([x, y], i) => {
    m.portal(x, y, 'confluence', 19 + i, 3, L('The Confluence', '五渠汇'))
    m.fixture('fixture/fog', x, y, { name: L('The fog of the Holiest', '至圣所的雾门'), props: { boss: 'astra' } })
  })
  m.anchors.arrive = [FIN_AT.holiest.arrive[0], FIN_AT.holiest.arrive[1]]
  m.anchor('severin.door', ...spot(m, FIN_AT.holiest.severin[0], FIN_AT.holiest.severin[1], true))
  m.regions.crypt = [3, 3, P.w - 6, P.h - 4]
  m.vistas.push({ at: [2, 2, P.w - 4, P.h - 4], zoom: 0.75, focus: [15, 10], share: 0.35 })
  return m
}

// =================================================================== the scenes

const H = FIN_AT.holiest

/** The last sentence (lore.md §17), the card over the Holiest. */
const LAST = L('As long as someone bears the Five,\nthe dawn will not go out.', '只要仍有人承担五苦，\n黎明便不会熄灭。')

export const FINALE_STORY: StepDef[] = [
  {
    // Down into the Holy City: the bells for the pilgrim who carries five; Severin goes another way, under.
    id: 'holy_arrival',
    when: { map: 'holyhall', region: 'gate' },
    script: [
      { card: L('The road went down out of the white hills into the Holy City.\nThe bells were ringing.', '路从白色的群山里下来，进了圣城。\n钟声正在响。') },
      { place: 'npc.severin', map: 'holyhall', x: FIN_AT.arrival.severin[0], y: FIN_AT.arrival.severin[1] },
      say('player', '(An avenue climbs between statues of hooded figures, two to each seal, toward a church whose front fills the sky. People stand along it, quiet, to see the pilgrim who carries five.)', '（一条大道从两排戴兜帽的雕像之间往上爬，一道印两尊，一直通到一座正面高得遮住了天的教堂。人们静静地站在道旁，来看这个带着五件圣器的朝圣者。）'),
      say('pip', "They're all looking at you.", '他们都在看你。', 'shy'),
      say('npc.severin', 'They will open the door to you. Not to me. There is another way in: under. Go in by the door. I will find you below.', '他们会给你开门，不会给我开。还有一条路进去：从底下。你走正门。我会在下面找到你。'),
      say('npc.severin', 'Whatever the Primate tells you, remember the Shroud.', '不管首席司祭跟你说什么，记住那块裹尸布。'),
      { move: 'npc.severin', x: FIN_AT.arrival.severin[0] + 6, y: FIN_AT.arrival.severin[1] },
      { place: 'npc.severin', map: 'offstage', x: 2, y: 2 },
      { fact: FIN.road, value: 1 },
    ],
  },
  {
    // The almanac-maker on the parvis (a beat).
    id: 'nessa_city',
    when: { map: 'holyhall', region: 'parvis', facts: { [FIN.road]: 1 } },
    say: L("That's Nessa, by the fountain. She came all the way to the Holy City with her tables.", '那是奈莎，在喷泉边上。她带着她的表，一路来到了圣城。'),
  },
  {
    // The Primate at the altar: the truth, plainly, and not believed; the floor opened behind the altar.
    id: 'primate',
    when: { map: 'holyhall.nave', region: 'choir', facts: { [FIN.road]: 1 } },
    script: [
      { place: 'npc.primate', map: 'holyhall.nave', x: FIN_AT.primate.primate[0], y: FIN_AT.primate.primate[1] },
      say('player', '(The nave is dark but for candles, hundreds of them. An old man in white and gold waits at the high altar alone.)', '（中殿里很暗，只有蜡烛，几百支。一个穿白金祭袍的老人独自等在高祭坛前。）'),
      say('npc.primate', 'Bearer. You have brought all five. It has been four hundred years.', '承担者。五件你都带来了。等了四百年。'),
      say('npc.primate', 'You have been told that we feed him. That the channels carry the seals\' strength here to wake him.', '有人跟你说过，我们在喂养他。说那些沟槽把诸印的力量运到这里，是为了唤醒他。'),
      say('npc.primate', 'We are not waking him. We have been holding him shut.', '我们不是在唤醒他。我们一直在把他关住。'),
      say('npc.primate', 'Every night for four hundred years he has carried what you cannot see. The bearers carried a little of it for him. They are gone now, and what they carried is in your pack.', '四百年来，每一个夜晚，他都在承担一样你看不见的东西。持印者们替他分担了一点。如今他们都不在了，他们承担的东西，就在你的包里。'),
      say('player', '(You think of the black Shroud, and the dates in Nessa\'s table, and say nothing.)', '（你想起那块黑色的裹尸布，想起奈莎表上的那些日子，什么也没说。）'),
      say('npc.primate', 'I cannot make you believe me. Go down. He will show you.', '我没法让你相信我。下去吧。他会让你看见的。'),
      say('player', '(He kneels behind the altar and lifts a stone out of the floor. A stair goes down into the dark.)', '（他跪到祭坛后面，从地上掀起一块石板。一道楼梯往下通进黑暗里。）'),
      say('pip', '...He sounds so tired.', '……他听上去好累。', 'sad'),
      { fact: FIN.primate, value: 1 },
    ],
  },
  {
    // The Confluence: the channels of the five lands meeting; Severin come up from under.
    id: 'confluence',
    when: { map: 'confluence', region: 'meeting', facts: { [FIN.primate]: 1 } },
    script: [
      { place: 'npc.severin', map: 'confluence', x: FIN_AT.confluence.severin[0], y: FIN_AT.confluence.severin[1] },
      say('player', '(Channels run in out of the dark from every side: red, grey, black, white, and one grown over with thorns. They meet before a wall of fog.)', '（一道道沟槽从四面八方的黑暗里流进来：红的、灰的、黑的、白的，还有一道长满了荆棘。它们在一堵雾墙前汇到一起。）'),
      say('npc.severin', 'The March. The Vale. The Fens. The Heights. The coast. Every one of them ends here, under his body.', '边境。衡谷。林沼。高地。海岸。每一道都通到这里，通到他的身体底下。'),
      say('npc.severin', 'What did the Primate tell you? ...No. Do not tell me. It does not matter now.', '首席司祭跟你说了什么？……不。别告诉我。现在已经不重要了。'),
      say('npc.severin', 'Now we end it.', '现在，我们去了结它。'),
      { fact: FIN.confluence, value: 1 },
    ],
  },
  {
    // The Rite: something of each instrument goes to the body; Astra opens his eyes.
    id: 'rite',
    when: { map: 'holiest', region: 'crypt', facts: { [FIN.astra]: 0 } },
    script: [
      { music: '' },
      { place: 'npc.severin', map: 'holiest', x: H.severin[0], y: H.severin[1] },
      say('player', '(A round crypt of white stone, five empty niches in its walls. At its heart, on a bier, lies a gaunt man in a grey shroud, his white hair spread on the stone. The channels run into the foot of the bier.)', '（一间圆形的白石墓室，四壁有五个空壁龛。正中的灵柩台上躺着一个枯瘦的人，裹着灰色的尸布，一头白发散在石头上。那些沟槽都流进了灵柩台的脚下。）'),
      say('player', '(In your pack the five instruments grow cold and heavy. Something of each goes out of them toward the body.)', '（你包里的五件圣器变得又冷又沉。每一件里都有什么东西流了出去，流向那具身体。）'),
      say('player', '(Thorns close round his brow. The welts open across his back. The scale lifts at his throat and steadies. The wounds of the nails open in his hands and feet. Under his ribs, the lance\'s wound opens.)', '（荆棘合拢在他的额头上。鞭痕在他背上一道道裂开。秤在他喉前升起，然后平稳下来。他的手脚上，钉孔裂开了。他的肋下，圣枪的伤口裂开了。）'),
      say('player', '(Astra opens his eyes.)', '（阿斯特拉睁开了眼睛。）'),
      say(ASTRA_ID, 'Leave this place.', '离开这里。'),
      { fact: FIN.rite, value: 1 },
      { fact: FIN.way, value: 1 },
    ],
  },
  {
    // The Night: "Good." "At least this time..." "I can die." The dark out of him; Severin's lantern out; the way up black.
    id: 'the_night',
    when: { map: 'holiest', facts: { [FIN.astra]: 1 } },
    script: [
      { music: '' },
      { wait: 22 },
      say('player', '(Astra sinks down against his bier. He looks at you a long time.)', '（阿斯特拉靠着灵柩台倒了下去。他看了你很久。）'),
      say('player', '("Good.")', '（“很好。”）'),
      say('player', '("At least this time...")', '（“至少这一次……”）'),
      say('player', '("I can die.")', '（“我可以死了。”）', 'sad'),
      say('player', '(He is still. Then the dark comes out of him: out of the five wounds, out of his mouth and his eyes, falling like smoke that sinks instead of rising. It fills the crypt to the knee, to the waist.)', '（他不动了。接着，黑暗从他身体里涌了出来：从五道伤口里，从他的嘴里和眼睛里，像烟一样，却是往下沉，不是往上飘。它淹到膝盖，又淹到腰。）'),
      { place: 'npc.severin', map: 'holiest', x: H.severin[0], y: H.severin[1] },
      say('player', '(Severin\'s lantern goes out in his hand.)', '（塞弗林手里的提灯灭了。）'),
      say('npc.severin', 'He was holding it.', '他一直在关着它。'),
      say('npc.severin', 'All this time, he was holding it.', '这么久以来，他一直在关着它。'),
      say('npc.severin', 'Every seal I kept from him made the cage weaker. "Ask your Church why," I said. ...I should have asked.', '我从他那里截走的每一道印，都让这座牢笼更弱一分。“去问你的教会为什么，”我说过。……该去问的人，是我。'),
      say('player', '(Behind you the stair up is black. The dark comes up it from below, and does not stop. Far above, a bell begins to ring, and stops.)', '（你身后，往上的楼梯一片漆黑。黑暗从底下顺着它涌上来，没有停。远远的上方，有一口钟响了起来，又停了。）'),
      say('pip', 'Pilgrim. On the bier. ...They want to be taken up. I know that feeling. I don\'t know how I know it.', '朝圣者。灵柩台上。……它们想被人接过去。我知道这种感觉。我不知道自己为什么知道。', 'sad'),
      { fact: FIN.night, value: 1 },
      { fact: FIN.way, value: 0 },
    ],
  },
  {
    // Dawn: the Five taken up; Lumi goes up to the morning; the sun rises; Firstlight; the Holiest in the dark; the sentence.
    id: 'dawn',
    when: { facts: { [FIN.five]: 1 } },
    script: [
      { music: '' },
      say('player', '(You lay your hands on the bier. The five instruments are in them. You did not take them out of your pack.)', '（你把手放在灵柩台上。五件圣器就在你手里。你并没有把它们从包里拿出来。）'),
      say('player', '(The Crown is on your head before you lift it. The thorns go in.)', '（还没等你举起，荆棘冠就已经戴在了你头上。荆棘扎了进去。）'),
      say('player', '(Across your back the welts open, one after another.)', '（你背上，鞭痕一道接一道地裂开。）'),
      say('player', '(The Scale rises at your throat, wavers, and comes level.)', '（秤在你喉前升起，晃了晃，平了。）'),
      say('player', '(The nails go through your hands and your feet and into the stone, and hold.)', '（钉子穿过你的双手和双脚，钉进石头里，钉住了。）'),
      say('player', '(The Lance turns in your hand and goes in under your ribs, to the heart.)', '（圣枪在你手里一转，从你肋下刺了进去，一直刺进心脏。）'),
      say('pip', 'Oh. I remember this.', '啊。我想起来了。'),
      say('pip', 'It was dark like this. ...I\'m sorry it\'s you.', '那时候也是这么黑。……对不起，是你。', 'sad'),
      say('player', '(Five small lights go out of her and into you. She is very small now, a spark no bigger than a candle\'s.)', '（五道小小的光从她身上离开，进了你的身体。她现在变得很小很小，只剩一点火星，比烛焰还小。）'),
      say('pip', 'I\'ll go up and look at the morning for you.', '我上去替你看看早晨。', 'happy'),
      { tell: 'pip', params: { what: 'farewell' } },
      { place: 'pip', map: 'offstage', x: 10, y: 4 },
      say('player', '(The dark turns toward you, all of it at once, and comes. It is very cold. Then it is very quiet.)', '（黑暗一齐转向你，涌了过来。很冷。然后，很安静。）'),
      say('npc.severin', 'The Watch kept the flame of the first dawn. Someone has to keep this one.', '灰烬守望守着第一次黎明的火。总得有人守着这一个。'),
      // the sun rises whole (calendar.ts nightHours: the night back to its old hours)
      { fact: 'night.shift', value: 0 },
      { fade: 'out' },
      { wait: 20 },
      { picture: 'lsw/CG/ending_dawn.png' },
      { fade: 'in' },
      say('player', '(Far away, over the hills behind Firstlight, the sun comes up whole, for the first time in a year.)', '（很远的地方，初原村后面的山上，太阳完整地升了起来。一年来，这是第一次。）'),
      say('player', '(Along the street the shutters open. At a window a boy sees his first true morning. A small light rests on the sill beside him.)', '（街上的窗板一扇扇打开。一扇窗前，一个男孩看见了他生平第一个真正的早晨。他身边的窗台上，停着一点小小的光。）'),
      say('player', '(In the chapel, a bell begins to ring.)', '（礼拜堂里，钟声响了起来。）'),
      { fade: 'out' },
      { wait: 20 },
      { picture: 'lsw/CG/ending_holiest.png' },
      { fade: 'in' },
      say('player', '(Under the Holy City, in the Holiest, you sit in the dark. The Lance is still in your chest. Behind you, the dark moves, slowly.)', '（圣城底下，至圣所里，你坐在黑暗之中。圣枪仍插在你胸口。你身后，黑暗缓慢地蠕动着。）'),
      { card: LAST, art: 'lsw/CG/ending_holiest.png' },
      { picture: null },
      { place: 'npc.severin', map: 'holiest', x: H.severin[0], y: H.severin[1] },
      { fact: FIN.end, value: 1 },
      { fade: 'out' },
    ],
  },
]

/** The Holy City's halls below the Hall: the nave's stair down to the Confluence, opened by the Primate. */
export function holyInteriors(nave: MapBuilder, confluence: MapBuilder): void {
  linkStair(nave, nave.doors.down, confluence, confluence.anchors.stair, true)
  for (const p of nave.portals) if (p.to === 'confluence') p.opensWhen = FIN.primate
}

/** Where Severin keeps the door of the Holiest after the end (the offstage map's own corner for Lumi, gone up). */
export function finaleOffstage(m: MapBuilder): void {
  m.anchor('pip.gone', ...spot(m, 10, 4, true))
}
