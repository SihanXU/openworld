// Firstlight Village's shops (the houses one walks into: tools/src/demo/village.ts): the general store's counter and
// the church's bookstand. Each is a station whose offers are recipes, as the Held Ground's stall's are
// (homestead.ts): what one gives (Thornmarks, or a thing sold) and what one gets, at a fixed price, made beside it.
// A hand on the counter or the stand opens the shop panel on its shelves (`shop:<station>`).

import type { Recipe, Rule, Text } from '@openworld/engine'
import { FORM_BY_ID } from './items.ts'
import { COIN } from './homestead.ts'
import { ACTIVE_SKILLS, skillBook } from './skills.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
const nameOf = (type: string): Text => {
  const f = FORM_BY_ID[type]
  return f ? L(f.en, f.zh) : L(type, type)
}
const spriteOf = (type: string) => FORM_BY_ID[type]?.sprite ?? 'item:bag'

/** A shop: the station its counter is, its name, and its shelves (the panel's tabs: group, English, Chinese). */
export interface ShopDef {
  station: string
  name: Text
  shelves: [group: string, en: string, zh: string][]
}

export const SHOPS: ShopDef[] = [
  { station: 'stall', name: L("Alberic's stall", '阿尔贝里克的货摊'), shelves: [['farm', 'Farming', '农业'], ['ranch', 'Ranching', '牧业'], ['fish', 'Fishing', '渔业'], ['sell', 'Sell', '出售']] },
  { station: 'store', name: L('General Store', '杂货铺'), shelves: [['supplies', 'Supplies', '杂货'], ['provisions', 'Provisions', '食物药水'], ['store-sell', 'Sell', '出售']] },
  { station: 'books', name: L('Church Bookstand', '教堂书架'), shelves: [['books', 'Skill Books', '技能书'], ['books-profession', 'Profession', '职业技能书']] },
]

const buy = (station: string, group: string, type: string, count: number, price: number): Recipe => ({
  id: `${station}/buy/${type.split('/').slice(1).join('-')}`, group, name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type: COIN, count: price }], make: { type }, station, count,
})
const sell = (station: string, type: string, price: number): Recipe => ({
  id: `${station}/sell/${type.split('/').slice(1).join('-')}`, group: `${station}-sell`, name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type, count: 1 }], make: { type: COIN }, station, count: price,
})

/** The general store: what a traveller needs on the road, and what it buys back from the wild. */
const STORE: Recipe[] = [
  buy('store', 'supplies', 'item/light/torch', 1, 4),
  buy('store', 'supplies', 'item/light/candle', 2, 3),
  buy('store', 'supplies', 'item/light/lantern', 1, 25),
  buy('store', 'supplies', 'item/tool/rope', 1, 8),
  buy('store', 'supplies', 'item/tool/flint', 1, 6),
  buy('store', 'supplies', 'item/tool/knife', 1, 12),
  buy('store', 'supplies', 'item/vessel/flask/empty', 1, 3),
  buy('store', 'supplies', 'item/vessel/bucket/empty', 1, 6),
  buy('store', 'supplies', 'item/tool/fishing_rod', 1, 15),
  buy('store', 'supplies', 'item/misc/bait', 5, 5),
  buy('store', 'provisions', 'item/food/bread', 2, 4),
  buy('store', 'provisions', 'item/food/cheese', 1, 5),
  buy('store', 'provisions', 'item/food/apple', 3, 3),
  buy('store', 'provisions', 'item/food/ale', 1, 4),
  buy('store', 'provisions', 'item/potion/healing', 1, 20),
  buy('store', 'provisions', 'item/potion/antidote', 1, 15),
  sell('store', 'item/material/herb', 2),
  sell('store', 'item/food/berries', 1),
  sell('store', 'item/food/mushroom/raw', 2),
  sell('store', 'item/material/feather', 1),
  sell('store', 'item/material/leather', 4),
  sell('store', 'item/food/egg/raw', 2),
]

/**
 * The church's bookstand: a book for every skill one learns from books, the common ones on one shelf, the
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

/** A hand on a shop's counter opens its panel (the stall's is homestead.ts home/stall). */
export const VILLAGE_SHOP_RULES: Rule[] = [
  { station: 'store', type: 'fixture/furniture/counter/store' },
  { station: 'books', type: 'fixture/furniture/bookstand' },
].map(({ station, type }) => ({
  id: `village/shop-${station}`,
  label: L('Trade at {target}', '在{target}交易'),
  doc: `A hand on the ${station === 'store' ? 'general store\'s counter' : 'church\'s bookstand'}: its shelves are shown (the shop panel; buying and selling are made there).`,
  host: { type },
  on: 'impulse/handle',
  tree: { do: [{ op: 'panel', panel: `shop:${station}` }] },
  source: { origin: 'base' },
}))
