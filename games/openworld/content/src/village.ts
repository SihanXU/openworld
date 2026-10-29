// Firstlight Village's shops (the houses one walks into: tools/src/demo/village.ts): the general store's counter and
// the bookstand in Sister Ilse's chapel at Astra's altar, which Brother Anselm keeps. Each is a station whose offers
// are recipes, as the Held Ground's stall's are (homestead.ts): what one gives (Dawnmarks, or a thing sold) and what
// one gets, at a fixed price, made beside it. A hand on the counter or the stand opens the shop panel on its shelves
// (`shop:<station>`); a bookstand that is a written thing (the Rest's litany) is read instead.

import type { Recipe, Rule, Text } from '@openworld/engine'
import { FORM_BY_ID } from './items.ts'
import { buyBackPrice, shelfPrice } from './prices.ts'
import { COIN } from './homestead.ts'
import { ACTIVE_SKILLS, skillBook } from './skills.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
const nameOf = (type: string): Text => {
  const f = FORM_BY_ID[type]
  return f ? L(f.en, f.zh) : L(type, type)
}
const spriteOf = (type: string) => FORM_BY_ID[type]?.sprite ?? 'item:bag'

/** A shop: the station its counter is, its name, and its shelves (the panel's tabs: the recipes' group, its name, whether it buys from one). */
export interface ShopDef {
  station: string
  name: Text
  shelves: { group: string; name: Text; sell?: boolean }[]
}

const SELL = { name: L('Sell', '出售'), sell: true }
export const SHOPS: ShopDef[] = [
  { station: 'stall', name: L("Alberic's stall", '阿尔贝里克的货摊'), shelves: [{ group: 'farm', name: L('Farming', '农业') }, { group: 'ranch', name: L('Ranching', '牧业') }, { group: 'fish', name: L('Fishing', '渔业') }, { group: 'sell', ...SELL }] },
  { station: 'store', name: L('General Store', '杂货铺'), shelves: [{ group: 'supplies', name: L('Supplies', '杂货') }, { group: 'provisions', name: L('Provisions', '食物与药水') }, { group: 'store-sell', ...SELL }] },
  { station: 'books', name: L('Chapel Bookstand', '礼拜堂书架'), shelves: [{ group: 'books', name: L('Skill Books', '技能书') }, { group: 'books-profession', name: L('Profession', '职业技能书') }] },
]

/**
 * Firstlight's chapel (docs/chapter-1.md §7, Sister Ilse): it stands behind Astra's altar on the square, and Brother
 * Anselm keeps its bookstand. (It was a "church of the First Dawn" on the east road, 2026-10-11, until it was merged
 * into her chapel, 2026-10-12: the First Dawn's is the chapel on Dawn Hill.) Its sign by the door, which an older save
 * moves here (game.ts).
 */
export const CHAPEL_SIGN = {
  id: 'village.church.sign',
  at: [22, 12] as const,
  /** where it stood on the east road */
  was: [51, 17] as const,
  text: "FIRSTLIGHT CHAPEL. The flame and Astra's altar, kept by Sister Ilse. Skill books at the bookstand within; ask Brother Anselm.",
  text_zh: '初原村礼拜堂。圣火与阿斯特拉祭坛，由伊尔丝修女看守。堂内书架有技能书，请找安塞姆修士。',
}

const buy = (station: string, group: string, type: string, count: number, price = shelfPrice(type, count)): Recipe => ({
  id: `${station}/buy/${type.split('/').slice(1).join('-')}`, group, name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type: COIN, count: price }], make: { type }, station, count,
})
const sell = (station: string, type: string, price = buyBackPrice(type)): Recipe => ({
  id: `${station}/sell/${type.split('/').slice(1).join('-')}`, group: `${station}-sell`, name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type, count: 1 }], make: { type: COIN }, station, count: price,
})

/** The general store: what a traveller needs on the road, and what it buys back from the wild — at any merchant's prices. */
const STORE: Recipe[] = [
  buy('store', 'supplies', 'item/light/torch', 1),
  buy('store', 'supplies', 'item/light/candle', 2),
  buy('store', 'supplies', 'item/light/lantern', 1),
  buy('store', 'supplies', 'item/tool/rope', 1),
  buy('store', 'supplies', 'item/tool/flint', 1),
  buy('store', 'supplies', 'item/tool/knife', 1),
  buy('store', 'supplies', 'item/vessel/flask/empty', 1),
  buy('store', 'supplies', 'item/vessel/bucket/empty', 1),
  buy('store', 'supplies', 'item/tool/fishing_rod', 1),
  buy('store', 'supplies', 'item/misc/bait', 5),
  buy('store', 'provisions', 'item/food/bread', 2),
  buy('store', 'provisions', 'item/food/cheese', 1),
  buy('store', 'provisions', 'item/food/apple', 3),
  buy('store', 'provisions', 'item/food/ale', 1),
  buy('store', 'provisions', 'item/potion/healing', 1),
  buy('store', 'provisions', 'item/potion/antidote', 1),
  sell('store', 'item/material/herb'),
  sell('store', 'item/food/berries'),
  sell('store', 'item/food/mushroom/raw'),
  sell('store', 'item/material/feather'),
  sell('store', 'item/material/leather'),
  sell('store', 'item/food/egg/raw'),
]

/**
 * The chapel's bookstand: a book for every skill one learns from books, the common ones on one shelf, the
 * professions' on another, dearer (a profession's book teaches only one of that profession).
 */
const BOOKS: Recipe[] = ACTIVE_SKILLS.map((s) => {
  const book = skillBook(s.id)
  return {
    id: `books/${s.id}`, group: s.profession ? 'books-profession' : 'books', name: book.name!, sprite: 'item:book',
    needs: [{ type: COIN, count: s.profession ? 120 : 60 }], make: book, station: 'books',
  }
})

export const VILLAGE_SHOP_RECIPES: Recipe[] = [...STORE, ...BOOKS]

/**
 * A hand on a shop's counter opens its panel (the stall's is homestead.ts home/stall). A counter or stand with something
 * written on it instead (the litany on the bookstand in the Pilgrims' Rest's chapel) is read, as any written thing is.
 */
export const VILLAGE_SHOP_RULES: Rule[] = [
  { station: 'store', type: 'fixture/furniture/counter/store' },
  { station: 'books', type: 'fixture/furniture/bookstand' },
].map(({ station, type }) => ({
  id: `village/shop-${station}`,
  doc: `A hand on the ${station === 'store' ? 'general store\'s counter' : 'chapel\'s bookstand'}: its shelves are shown (the shop panel; buying and selling are made there) — unless it is a written thing (readable, with a text), which is read (core/read).`,
  host: { type },
  on: 'impulse/handle',
  tree: { if: { all: [{ has: { role: 'host', tag: 'readable' } }, { prop: { role: 'host', key: 'text' } }] }, then: 'inherit', else: { do: [{ op: 'panel', panel: `shop:${station}` }], label: L('Trade at {target}', '在{target}交易') } },
  source: { origin: 'base' },
}))
