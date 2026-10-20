// Place names for the continent's backdrop (docs/continent.md §4): each region names its places in its own words,
// in both languages at once — a prefix and a root that mean the same in English and Chinese ("Saltmere", 盐湖),
// then what the place is ("Saltmere Mill", 盐湖磨坊). A name is never used twice in the world.

import type { Rng } from '@openworld/engine'

/** A name in both languages at once. */
export type Name = { en: string; zh: string }

type Pair = [string, string]

/** Each region's first halves: what its land and its suffering put in a name. */
const PREFIX: Record<string, Pair[]> = {
  frostfang: [['Frost', '霜'], ['Pine', '松'], ['Grey', '灰'], ['Wolf', '狼'], ['Thorn', '棘'], ['Ice', '冰'], ['North', '北'], ['Cold', '寒'], ['Fir', '杉'], ['Gull', '鸥'], ['Rime', '凇'], ['Brier', '荆'], ['Snow', '雪'], ['Elk', '麋']],
  redmarch: [['Red', '赤'], ['Iron', '铁'], ['Blood', '血'], ['Scar', '痕'], ['Spear', '矛'], ['War', '战'], ['Rust', '锈'], ['Ember', '烬'], ['Brand', '烙'], ['Lash', '鞭'], ['Shield', '盾'], ['Banner', '旗'], ['Hawk', '鹰'], ['Flint', '燧']],
  tithe: [['Salt', '盐'], ['Grain', '谷'], ['Scale', '衡'], ['Dust', '尘'], ['Copper', '铜'], ['Chaff', '糠'], ['Tithe', '税'], ['Barley', '麦'], ['Coin', '钱'], ['Dry', '旱'], ['Gold', '金'], ['Weigh', '秤'], ['Millet', '粟'], ['Sack', '囊']],
  palefen: [['Pale', '苍'], ['Mire', '泥'], ['Bone', '骨'], ['Nail', '钉'], ['Dusk', '暮'], ['Reed', '苇'], ['Mourn', '哀'], ['Still', '寂'], ['Grave', '冢'], ['Fog', '雾'], ['Crow', '鸦'], ['Ashen', '烬'], ['Moth', '蛾'], ['Wan', '黯']],
  altar: [['White', '白'], ['Saint', '圣'], ['Lance', '枪'], ['Vigil', '守'], ['Chalk', '垩'], ['Choir', '咏'], ['Alb', '素'], ['Martyr', '殉'], ['Bell', '钟'], ['Candle', '烛'], ['High', '高'], ['Psalm', '诵'], ['Lily', '百合'], ['Dove', '鸽']],
  holy: [['Sun', '日'], ['Dawn', '曙'], ['Gold', '金'], ['Lamb', '羔'], ['Pilgrim', '朝圣'], ['Halo', '环'], ['Grace', '恩'], ['Light', '光'], ['Vow', '誓'], ['Glory', '荣'], ['Myrrh', '没药'], ['Incense', '香']],
}

/** Second halves, every region's: what kind of ground the name stands on. */
const ROOT: Pair[] = [['mere', '湖'], ['vale', '谷'], ['stead', '庄'], ['wick', '坞'], ['holm', '洲'], ['gate', '门'], ['moor', '原'], ['crest', '岭'], ['well', '泉'], ['field', '野'], ['brook', '溪'], ['ridge', '脊'], ['combe', '坳'], ['fen', '泽'], ['stone', '石'], ['wood', '林'], ['ford', '津'], ['barrow', '丘'], ['by', '屯'], ['heath', '坡']]

/** What a kind of place adds to its name (a village is its name alone in English). */
export const KIND_WORDS: Record<string, Pair> = {
  village: ['', '村'],
  town: ['', '镇'],
  city: ['', '城'],
  farm: [' Farm', '农庄'],
  mill: [' Mill', '磨坊'],
  camp: [' Camp', '营地'],
  ruin: [' Ruins', '遗迹'],
  shrine: [' Shrine', '神龛'],
  cave: [' Cave', '洞窟'],
  mine: [' Mine', '矿坑'],
  tower: [' Tower', '塔'],
  graveyard: [' Graves', '墓园'],
  fort: [' Keep', '堡'],
  battlefield: [' Field', '古战场'],
  cathedral: [' Abbey', '修道院'],
}

/** Names made so far: none is given twice. */
export class Namer {
  private used = new Set<string>()
  private stems = new Set<string>()

  constructor(private rng: Rng) {}

  /** Mark a name taken (a hand-made place's, a fixed one). */
  take(name: Name): void {
    this.used.add(name.en.toLowerCase())
  }

  /** A new name for a place of `kind` in `region`. */
  name(region: string, kind: string): Name {
    const pre = PREFIX[region] ?? PREFIX.frostfang
    const [ke, kz] = KIND_WORDS[kind] ?? ['', '']
    for (let tries = 0; tries < 400; tries++) {
      const [pe, pz] = this.rng.pick(pre)
      const [re, rz] = this.rng.pick(ROOT)
      const stem = `${pe}${re}`
      // a stem once only, so "Saltmere" and "Saltmere Mill" are never two places apart
      if (this.stems.has(stem) && tries < 300) continue
      const name = { en: `${stem}${ke}`, zh: `${pz}${rz}${kz}` }
      if (this.used.has(name.en.toLowerCase())) continue
      this.used.add(name.en.toLowerCase())
      this.stems.add(stem)
      return name
    }
    throw new Error(`no name left for a ${kind} in ${region}`)
  }
}

/** A place's id from its name: the region's, then its name in lower case ("redmarch.ironwick-keep"). */
export const placeId = (region: string, name: Name): string => `${region}.${name.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
