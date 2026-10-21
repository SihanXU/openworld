// The continent's regions (docs/continent.md, docs/lore.md §6): one for each of the five seals, held by its
// Seal-bearer and marked by its suffering, round the Holy City where the five are carried. Frostfang Coast, the
// first seal's, is where the game is played now; the others are backdrop (docs/continent.md §1): walkable,
// peopled later, with no story yet.

import type { RegionLook, Text } from '@openworld/engine'

export interface RegionDef {
  id: string
  name: Text
  /** One line of what it is: the suffering it carries and how the land shows it. */
  doc: Text
  /** Its seal (docs/lore.md §4) and its sacred instrument's wayshrine (fixture/sacred/wayshrine/<seal>); the Holy City has none. */
  seal?: 'crown' | 'scourge' | 'scales' | 'nails' | 'lance'
  /** Drawn on the world map: its border and its name. */
  color: string
  /** Nothing of the story is played there yet: its places are background (docs/continent.md §1). */
  backdrop?: boolean
  /**
   * How its maps look (docs/continent.md §9 B): the world filter's grade there and how dim its light. The Frostfang
   * Coast has none — the played land keeps the game's own look.
   */
  look?: RegionLook
}

export const REGIONS: RegionDef[] = [
  {
    id: 'frostfang',
    name: { en: 'Frostfang Coast', zh: '霜牙海岸' },
    doc: { en: 'The first seal\'s: a cold coast of pine and fords, the White Knight\'s kingdom, briars where the Crown of Thorns is carried.', zh: '第一印之地：松林与渡口的寒冷海岸，白骑士的王国，荆棘冠的重负化作遍地荆棘。' },
    seal: 'crown',
    color: '#9cc4dc',
  },
  {
    id: 'redmarch',
    name: { en: 'The Scarred March', zh: '赤痕边境' },
    doc: { en: 'The second seal\'s: red badlands and steppe where the war never ends — forts, old battlefields, the whipping post\'s welts in the rock.', zh: '第二印之地：战事从未停歇的赤岩荒原与草原——要塞、古战场，鞭刑柱的血痕刻进岩石。' },
    seal: 'scourge',
    color: '#c8644a',
    // the red of the rock and of the welts: warm, dusty, a little dim
    look: { tint: '#c86a48', tintAmount: 0.22, desat: 0.05, shade: 0.04 },
    backdrop: true,
  },
  {
    id: 'tithe',
    name: { en: 'The Vale of Scales', zh: '衡谷平原' },
    doc: { en: 'The third seal\'s: a great grain plain gone barren, salt flats and dust, market towns where everything is weighed and the poor go hungry.', zh: '第三印之地：枯死的大粮原、盐滩与尘暴；集市城里万物过秤，穷人挨饿。' },
    seal: 'scales',
    color: '#d6b45a',
    // grain gone to dust: a pale straw light, the colour drained from it
    look: { tint: '#d8c08a', tintAmount: 0.2, desat: 0.18 },
    backdrop: true,
  },
  {
    id: 'palefen',
    name: { en: 'The Pale Fens', zh: '苍白林沼' },
    doc: { en: 'The fourth seal\'s: marsh and dead wood under a dusk that hardly lifts, graveyards and ossuaries — the dead who will not rest.', zh: '第四印之地：几乎不散的黄昏下的沼泽与死林，墓园与骨堂——不得安息的亡者。' },
    seal: 'nails',
    color: '#8a9a8c',
    // a dusk that hardly lifts: grey-green, the colour nearly gone, dim by day and darker at night
    look: { tint: '#6f8a80', tintAmount: 0.35, desat: 0.4, shade: 0.24 },
    backdrop: true,
  },
  {
    id: 'altar',
    name: { en: 'The White Altar Heights', zh: '白坛高地' },
    doc: { en: 'The fifth seal\'s: white stone highlands and cliffs, monasteries and reliquaries, the catacombs of the martyrs under the altar.', zh: '第五印之地：白石高原与悬崖，修道院与圣髑堂，祭坛之下殉道者的地下墓穴。' },
    seal: 'lance',
    color: '#e6e0d0',
    // white stone under a high, cold light: bleached, a touch of blue
    look: { tint: '#dfe4ee', tintAmount: 0.2, desat: 0.12 },
    backdrop: true,
  },
  {
    id: 'holy',
    name: { en: 'The Holy City', zh: '圣城' },
    doc: { en: 'Where the five are carried: the city of the Church of the Five Sufferings round the Most Holy Hall, and the old works under it that carry power to it.', zh: '五苦汇聚之处：围绕至圣大殿的五苦圣教之城，以及城下把力量输向它的古老结构。' },
    color: '#f0d890',
    // the city of candles and gold leaf: a warm gold
    look: { tint: '#f0cf7a', tintAmount: 0.16, desat: -0.05 },
    backdrop: true,
  },
]

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]))

/**
 * The fact a place whose story is not told yet waits for (content SITE_GATES): no rule sets it, so such a place —
 * a Seal-bearer's seat beyond the first, the Most Holy Hall — stays sealed and says so.
 */
export const UNTOLD = 'world.untold'

/**
 * The fact the story's second part waits for (release 1, docs/release-1.md): the road east of the Ford — the
 * Pilgrim's Road, the abbey, the Kneeling Field, the East Road — and all beyond it. Release 1 is Part One, the
 * west bank: no rule sets it there, so the Ford's road east and the places beyond stay sealed (SITE_GATES, a
 * portal's `opensWhen`) after Part One's ending on the far bank. The dev console sets it to play on.
 */
export const PART_TWO = 'world.part2'
