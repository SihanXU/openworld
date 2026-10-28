// The homestead (docs/homestead.md): the Held Ground as a working place — Alberic's stall, its three shelves (farming,
// ranching, fishing) and what it buys back; and what the shelves sell does what it should, as Minecraft and Stardew
// have it: seeds take root, fertilizer adds to a harvest, feed makes a beast fed for the day (a fed cow gives milk to a
// bucket, once a day), a crated beast set down walks out, bait on a rod makes the fish bite more (its casts kept on
// the rod). The coin is the Dawnmark, the Held Ground's own. Buying and selling are made at the stall as anything is
// made at a station: what one gives is used up, what one gets comes into one's bag (engine `craft`).

import { TICKS_PER_DAY, type Cond, type Effect, type Recipe, type Rule, type Text, type Tree } from '@openworld/engine'
import { FORM_BY_ID } from './items.ts'
import { VEGETABLE_CROPS } from './crops.ts'
import { buyBackPrice, shelfPrice } from './prices.ts'
import { stackKey } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** The Held Ground's coin. */
export const COIN = 'item/misc/thornmark'
/** How long a beast fed stays fed, and a cow milked stays milked (a game day). */
export const FED_FOR = TICKS_PER_DAY
/** The only bait before bait identity was saved: a plain stack of the ordinary bait form. */
const PLAIN_BAIT_KEY = stackKey({ type: 'item/misc/bait' })

/** Base rules (content rules.ts BASE_RULES): what the things are, wherever they are. */
const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })

const nameOf = (type: string): Text => {
  const f = FORM_BY_ID[type]
  return f ? L(f.en, f.zh) : L(type, type)
}
const spriteOf = (type: string) => FORM_BY_ID[type]?.sprite ?? 'item:bag'

/** Seeds on the farming shelf: how many come at once (fewer of the dearer, which give dearer crops or keep bearing). */
const SEEDS: Record<string, number> = { pumpkin: 3, cauliflower: 3, melon: 3, corn: 3, blueberry: 3, strawberry: 3, pepper: 3, eggplant: 3 }
/** The fish the stall buys (the rarer, the dearer: the Dawnscale bites only at first light). */
const FISH = ['sunfish', 'perch', 'catfish', 'eel', 'pike', 'carp', 'dawnscale']

/** A shelf's offer: `count` of a thing at the standard price and a merchant's quarter (prices.ts; seeds: more for a Seed Merchant, life.ts). */
const buy = (group: string, type: string, count: number): Recipe => ({
  id: `shop/buy/${type.split('/').slice(1).join('-')}`, group, name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type: COIN, count: shelfPrice(type, count) }], make: { type }, station: 'stall', count, ...(type.startsWith('item/seed/') && { bonus: 'buy:farm' }),
})
/** What the stall buys back: one of a thing for half its standard price (more for a Market Gardener's crops, a Rancher's goods, an Ore Merchant's ore: life.ts). */
const sell = (type: string, bonus?: string): Recipe => ({
  id: `shop/sell/${type.split('/').slice(1).join('-')}`, group: 'sell', name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type, count: 1 }], make: { type: COIN }, station: 'stall', count: buyBackPrice(type), ...(bonus && { bonus }),
})

export const SHOP_RECIPES: Recipe[] = [
  // farming: seeds, fertilizer, an acorn, a shovel (to lift a plant or a stump)
  buy('farm', 'item/seed/wheat', 5),
  ...VEGETABLE_CROPS.map((c) => buy('farm', `item/seed/${c.id}`, SEEDS[c.id] ?? 5)),
  buy('farm', 'item/seed/berry', 3),
  buy('farm', 'item/seed/herb', 3),
  buy('farm', 'item/material/fertilizer', 3),
  buy('farm', 'item/seed/acorn', 1),
  buy('farm', 'item/tool/shovel', 1),
  buy('farm', 'item/tool/hoe', 1),
  buy('farm', 'item/tool/sickle', 1),
  { ...buy('farm', 'item/vessel/bucket/empty', 1), id: 'shop/buy/farm-bucket' },
  // ranching: feed, a bucket for milking, beasts in crates
  buy('ranch', 'item/material/feed', 5),
  buy('ranch', 'item/vessel/bucket/empty', 1),
  buy('ranch', 'item/misc/crate_hen', 1),
  buy('ranch', 'item/misc/crate_calf', 1),
  // fishing: bait, a rod
  buy('fish', 'item/misc/bait', 5),
  buy('fish', 'item/tool/fishing_rod', 1),
  // what the stall buys back
  sell('item/material/wheat', 'sell:farm'),
  ...VEGETABLE_CROPS.map((c) => sell(`item/food/${c.id}`, 'sell:farm')),
  sell('item/food/berries', 'sell:farm'),
  sell('item/material/herb', 'sell:farm'),
  sell('item/food/egg/raw', 'sell:ranch'),
  sell('item/vessel/bucket/milk', 'sell:ranch'),
  sell('item/food/fish/raw'),
  ...FISH.map((id) => sell(`item/food/fish/${id}`)),
  sell('item/misc/old_boot'),
  // ore and coal (an Ore Merchant gets more), and the ranch's goods (a Rancher gets more)
  sell('item/material/iron_ore', 'sell:smith'),
  sell('item/material/gold_ore', 'sell:smith'),
  sell('item/material/coal', 'sell:smith'),
  sell('item/material/leather', 'sell:ranch'),
  sell('item/material/feather', 'sell:ranch'),
  sell('item/food/honey', 'sell:ranch'),
  sell('item/food/cheese', 'sell:ranch'),
]

const ANIMAL = { type: 'actor/creature/animal' }
/** What a beast fed does: fed for a day (two, fed by a Herdsman: life.ts), and glad of it. */
const fedFor = (days: number): Effect[] => [{ op: 'addStatus', status: 'fed', duration: FED_FOR * days }, { op: 'emote', mood: 'happy' }, { op: 'log', text: L('{host} eats happily.', '{host}吃得很开心。') }]
const FED = fedFor(1)
const BAIT_MISMATCH: Tree = { do: [{ op: 'log', text: L('Use up the bait already on this rod before changing bait.', '鱼竿上的鱼饵还没用完，用完才能换别的。') }] }
const APPLY_BAIT: Tree = { do: [{ op: 'emit', impulse: 'notify', to: 'item', params: { what: 'bait', casts: { param: 'casts' }, baitKey: { param: 'baitKey' } } }, { op: 'destroy' }] }
const tagged = (id: string): Cond => ({ has: { role: 'actor', tag: `skill:${id}` } })
/** Fed: for a day, or two for a Herdsman; with what else the feeding brings (a hen's egg, the call to a mate). */
const fed = (...extra: Effect[]): Tree => ({ if: tagged('herdsman'), then: { do: [...fedFor(2), ...extra] }, else: { do: [...FED, ...extra] } })
/** A hen fed by an Egg Collector lays at once (feedEggs); a Hen Whisperer's now and then hatches a chick. */
const henFed = (...extra: Effect[]): Tree => {
  const eggs: Effect = { op: 'spawn', type: 'item/food/egg/raw', at: 'tileOf:host', count: { prop: 'feedEggs', of: 'actor' }, still: true }
  return { if: { all: [tagged('hen-whisperer'), { chance: 0.15 }] }, then: fed(eggs, { op: 'spawn', type: '@prop:host.babyType', at: 'tileOf:host', ownerFrom: 'host' }, ...extra), else: fed(eggs, ...extra) }
}
/** Milked: for a day, half a day for a Milker's cow. */
const MILKED: Tree = { if: tagged('milker'), then: { do: [{ op: 'addStatus', status: 'milked', duration: FED_FOR / 2 }] }, else: { do: [{ op: 'addStatus', status: 'milked', duration: FED_FOR }] } }
/** Resting from young: a day, half a day when it was a Quick Breeder's feeding. */
const rest = (...extra: Effect[]): Tree => ({ if: tagged('quick-breeder'), then: { do: [{ op: 'addStatus', status: 'bred', duration: FED_FOR / 2 }, ...extra] }, else: { do: [{ op: 'addStatus', status: 'bred', duration: FED_FOR }, ...extra] } })

export const HOMESTEAD_RULES: Rule[] = [
  story({
    id: 'home/stall',
    label: L('Trade at {target}', '在{target}交易'),
    doc: 'A hand on the Held Ground\'s stall: its shelves and what it buys back are shown (the shop panel; buying and selling are made there).',
    host: { type: 'fixture', tags: ['stall'] },
    on: 'impulse/handle',
    tree: { do: [{ op: 'panel', panel: 'shop' }] },
  }),
  ...(['act/use', 'act/put'] as const).map((on) => story({
    id: `home/feed${on === 'act/put' ? '-put' : ''}`,
    label: L('Feed {instrument} to {target}', '给{target}喂{instrument}'),
    doc: 'Feed given to a beast: it is told it is fed (and answers itself); the feed is eaten.',
    host: { tags: ['feed'] },
    on,
    // (a Stockman's feeding feeds the hungry beasts around too: life.ts)
    tree: {
      if: { is: { role: 'target', sel: ANIMAL } },
      then: {
        if: tagged('stockman'),
        then: {
          if: { residentWorkFeed: 'actor' },
          then: { do: [{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'fed' } }, { op: 'destroy' }] },
          else: { do: [{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'fed' } }, { op: 'emit', impulse: 'notify', to: { area: { radius: 2 } }, params: { what: 'fed' }, filter: { ...ANIMAL, notStatus: ['fed'] } }, { op: 'destroy' }] },
        },
        else: { do: [{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'fed' } }, { op: 'destroy' }] },
      },
      else: 'inherit',
    },
  })),
  story({
    id: 'home/fed',
    doc: 'A beast fed is fed for a day (Stardew\'s hay, Minecraft\'s wheat): content; a configured steward may ask this animal to confirm a one-animal legacy ownership claim in its own outcome; a fed cow can be milked, and told it is milked, it is milked for the day.',
    host: ANIMAL,
    on: 'impulse/notify',
    tree: {
      if: { param: { key: 'what', cmp: 'resident-work-claim' } },
      then: { do: [{ op: 'residentWork/update' }] },
      else: {
        if: { param: { key: 'what', cmp: 'fed' } },
        then: fed(),
        else: { if: { param: { key: 'what', cmp: 'milked' } }, then: MILKED, else: 'inherit' },
      },
    },
  }),
  // breeding (Minecraft's): a cow or a hen fed calls to the fed of its kind close by; one not resting from young answers
  // with a calf or a chick of its own (and rests a day). A young one never breeds.
  ...(['cow', 'chicken'] as const).map((kind) => story({
    id: `home/breed-${kind}`,
    doc: `A ${kind} fed (not resting from young) calls to the fed ${kind}s beside it; one that hears the call (fed, not resting) bears its young beside it, and both rest a day (the caller is told); told it is milked, a cow is milked for the day.`,
    host: { type: `actor/creature/animal/${kind}` },
    on: 'impulse/notify',
    // (the feeder's skills shape it, life.ts: a Herdsman's feeding lasts, an Egg Collector's hen lays, a Breeder's beasts
    // bear twins, a Quick Breeder's rest less, a Milker's cow is milked again sooner)
    tree: {
      if: { param: { key: 'what', cmp: 'fed' } },
      // one resting from young does not call
      then: { if: { has: { role: 'host', status: 'bred' } }, then: kind === 'chicken' ? henFed() : fed(), else: (kind === 'chicken' ? henFed : fed)({ op: 'emit', impulse: 'notify', to: { area: { radius: 3 } }, params: { what: 'mate' }, filter: { type: `actor/creature/animal/${kind}`, status: ['fed'], notStatus: ['bred'] } }) },
      else: {
        // the call heard: the young born beside it (twins, now and then, for a Breeder), and the caller told so (both rest)
        if: { all: [{ param: { key: 'what', cmp: 'mate' } }, { has: { role: 'host', status: 'fed' } }, { not: { has: { role: 'host', status: 'bred' } } }] },
        then: (() => {
          const born = (n: number): Tree => rest({ op: 'spawn', type: '@prop:host.babyType', at: 'tileOf:host', count: n, ownerFrom: 'host' }, { op: 'emit', impulse: 'notify', to: 'source', params: { what: 'rested' } }, { op: 'emote', mood: 'happy' }, { op: 'vfx', fx: 'sparkle' }, { op: 'log', text: n > 1 ? L(kind === 'cow' ? 'Twin calves are born!' : 'Two chicks hatch!', kind === 'cow' ? '一对双胞胎小牛出生了！' : '孵出了两只小鸡！') : L(kind === 'cow' ? 'A calf is born!' : 'A chick hatches!', kind === 'cow' ? '一头小牛出生了！' : '一只小鸡孵出来了！') })
          return { if: { all: [tagged('breeder'), { chance: 0.3 }] }, then: born(2), else: born(1) } as Tree
        })(),
        else: {
          if: { param: { key: 'what', cmp: 'rested' } },
          then: rest(),
          else: { if: { param: { key: 'what', cmp: 'milked' } }, then: MILKED, else: 'inherit' },
        },
      },
    },
  })),
  story({
    id: 'home/milk',
    label: L('Milk {target}', '给{target}挤奶'),
    doc: 'An empty bucket used on a cow: fed and not yet milked today, it gives milk (the bucket is a bucket of milk, the cow is told); unfed, it will not.',
    host: { type: 'item/vessel/bucket/empty' },
    on: 'act/use',
    tree: {
      if: { is: { role: 'target', sel: { type: 'actor/creature/animal/cow' } } },
      then: {
        if: { all: [{ has: { role: 'target', status: 'fed' } }, { not: { has: { role: 'target', status: 'milked' } } }] },
        then: { do: [{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'milked' } }, { op: 'transform', into: 'item/vessel/bucket/milk' }, { op: 'vfx', fx: 'splash' }, { op: 'log', text: L('You milk {target}.', '你给{target}挤了奶。') }] },
        else: { do: [{ op: 'log', text: L('{target} gives no milk. Feed it first; it can be milked once a day.', '{target}挤不出奶。先把它喂饱；一天只能挤一次。') }] },
      },
      else: 'inherit',
    },
  }),
  story({
    id: 'home/crate',
    label: L('Let {instrument} out', '放出{instrument}'),
    doc: 'A crated beast set down: the beast walks out where it is set, the crate is gone.',
    host: { tags: ['animal-crate'] },
    on: 'act/put',
    tree: { do: [{ op: 'spawn', type: '@prop:host.animalType', at: 'target', owner: 'actor' }, { op: 'vfx', fx: 'dust', at: 'target' }, { op: 'log', text: L('The crate opens, and out it comes.', '箱子打开，里面的动物走了出来。') }, { op: 'destroy' }] },
  }),
  story({
    id: 'home/bait',
    label: L('Bait {target}', '给{target}挂饵'),
    doc: 'Bait used on a fishing rod: matching bait adds its own casts to the rod; different bait cannot be mixed until the current bait is spent. The bait is used up only when accepted.',
    host: { tags: ['bait'] },
    on: 'act/use',
    tree: { if: { is: { role: 'target', sel: { tags: ['tool:fishing'] } } }, then: { do: [{ op: 'emit', impulse: 'notify', to: 'host', item: 'target', params: { what: 'bait-check', casts: { prop: 'casts', of: 'host' }, baitKey: { stackKeyOf: 'host' } } }] }, else: 'inherit' },
  }),
  story({
    id: 'home/bait-check',
    doc: 'The bait host checks the rod it was actually used on before it destroys itself. Its own stack identity is derived by the engine and carried to the rod only after a match; stale or different bait leaves the bait untouched.',
    host: { tags: ['bait'] },
    on: 'impulse/notify',
    tree: {
      if: { param: { key: 'what', cmp: 'bait-check' } },
      then: {
        if: { all: [{ same: ['host', 'instrument'] }, { is: { role: 'item', sel: { tags: ['tool:fishing'] } } }] },
        then: {
          if: { prop: { role: 'item', key: 'bait', cmp: { gt: 0 } } },
          then: {
            if: { prop: { role: 'item', key: 'baitKey' } },
            then: { if: { propEqualsParam: { role: 'item', key: 'baitKey', param: 'baitKey' } }, then: APPLY_BAIT, else: BAIT_MISMATCH },
            else: { if: { param: { key: 'baitKey', cmp: PLAIN_BAIT_KEY } }, then: APPLY_BAIT, else: BAIT_MISMATCH },
          },
          else: APPLY_BAIT,
        },
        else: 'inherit',
      },
      else: 'inherit',
    },
  }),
  story({
    id: 'home/rod-panel',
    label: L('Choose bait for {instrument}', '给{instrument}装饵'),
    doc: 'Right-clicking yourself with a fishing rod opens its bait chooser; other targets keep their own action.',
    host: { type: 'item/tool/fishing_rod' },
    on: 'act/use',
    tree: { if: { same: ['actor', 'target'] }, then: { do: [{ op: 'panel', panel: 'bait' }] }, else: 'inherit' },
  }),
  story({
    id: 'home/rod',
    doc: 'A fishing rod keeps its bait: told it is baited, it has that many more casts; told a baited cast is spent, one fewer.',
    host: { tags: ['tool:fishing'] },
    on: 'impulse/notify',
    tree: {
      if: { param: { key: 'what', cmp: 'bait' } },
      then: { do: [{ op: 'addProp', key: 'bait', delta: { param: 'casts' } }, { op: 'setProp', key: 'baitKey', value: { param: 'baitKey' } }, { op: 'log', text: L('You bait the hook.', '你挂好了鱼饵。') }] },
      else: { if: { param: { key: 'what', cmp: 'cast' } }, then: { do: [{ op: 'addProp', key: 'bait', delta: -1, min: 0 }] }, else: 'inherit' },
    },
  }),
]
