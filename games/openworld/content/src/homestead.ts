// The homestead (docs/homestead.md): the Held Ground as a working place — Alberic's stall, its three shelves (farming,
// ranching, fishing) and what it buys back; and what the shelves sell does what it should, as Minecraft and Stardew
// have it: seeds take root, fertilizer adds to a harvest, feed makes a beast fed for the day (a fed cow gives milk to a
// bucket, once a day), a crated beast set down walks out, bait on a rod makes the fish bite more (its casts kept on
// the rod). The coin is the Thornmark, the Held Ground's own. Buying and selling are made at the stall as anything is
// made at a station: what one gives is used up, what one gets comes into one's bag (engine `craft`).

import { TICKS_PER_DAY, type Effect, type Recipe, type Rule, type Text } from '@openworld/engine'
import { FORM_BY_ID } from './items.ts'
import { VEGETABLE_CROPS } from './crops.ts'

const L = (en: string, zh: string): Text => ({ en, zh })

/** The Held Ground's coin. */
export const COIN = 'item/misc/thornmark'
/** How long a beast fed stays fed, and a cow milked stays milked (a game day). */
export const FED_FOR = TICKS_PER_DAY

/** Base rules (content rules.ts BASE_RULES): what the things are, wherever they are. */
const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })

const nameOf = (type: string): Text => {
  const f = FORM_BY_ID[type]
  return f ? L(f.en, f.zh) : L(type, type)
}
const spriteOf = (type: string) => FORM_BY_ID[type]?.sprite ?? 'item:bag'

/** Seeds on the farming shelf: how many for how much (Stardew's dearer seeds give dearer crops, or keep bearing). */
const SEED: Record<string, [number, number]> = {
  carrot: [5, 8], turnip: [5, 6], tomato: [5, 12], pumpkin: [3, 15],
  parsnip: [5, 5], potato: [5, 10], radish: [5, 8], cauliflower: [3, 20], melon: [3, 24],
  corn: [3, 18], blueberry: [3, 24], strawberry: [3, 20], pepper: [3, 14], eggplant: [3, 16],
}
/** What the stall pays for one of a crop. */
const CROP_PRICE: Record<string, number> = {
  carrot: 5, turnip: 4, tomato: 6, pumpkin: 14, parsnip: 4, potato: 6, radish: 5, cauliflower: 18, melon: 22,
  corn: 5, blueberry: 3, strawberry: 6, pepper: 4, eggplant: 6,
}
/** What it pays for one of a fish (the rarer, the dearer: the Dawnscale bites only at first light). */
const FISH_PRICE: Record<string, number> = { sunfish: 6, perch: 8, catfish: 20, eel: 18, pike: 16, carp: 30, dawnscale: 80 }

/** A shelf's offer: `count` of a thing for `price` Thornmarks. */
const buy = (group: string, type: string, count: number, price: number): Recipe => ({
  id: `shop/buy/${type.split('/').slice(1).join('-')}`, group, name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type: COIN, count: price }], make: { type }, station: 'stall', count,
})
/** What the stall buys back: one of a thing for `price` Thornmarks. */
const sell = (type: string, price: number): Recipe => ({
  id: `shop/sell/${type.split('/').slice(1).join('-')}`, group: 'sell', name: nameOf(type), sprite: spriteOf(type),
  needs: [{ type, count: 1 }], make: { type: COIN }, station: 'stall', count: price,
})

export const SHOP_RECIPES: Recipe[] = [
  // farming: seeds, fertilizer, an acorn, a shovel (to lift a plant or a stump)
  buy('farm', 'item/seed/wheat', 5, 5),
  ...VEGETABLE_CROPS.map((c) => buy('farm', `item/seed/${c.id}`, SEED[c.id]?.[0] ?? 5, SEED[c.id]?.[1] ?? 8)),
  buy('farm', 'item/seed/berry', 3, 10),
  buy('farm', 'item/seed/herb', 3, 8),
  buy('farm', 'item/material/fertilizer', 3, 10),
  buy('farm', 'item/seed/acorn', 1, 4),
  buy('farm', 'item/tool/shovel', 1, 15),
  // ranching: feed, a bucket for milking, beasts in crates
  buy('ranch', 'item/material/feed', 5, 6),
  buy('ranch', 'item/vessel/bucket/empty', 1, 8),
  buy('ranch', 'item/misc/crate_hen', 1, 40),
  buy('ranch', 'item/misc/crate_calf', 1, 120),
  // fishing: bait, a rod
  buy('fish', 'item/misc/bait', 5, 5),
  buy('fish', 'item/tool/fishing_rod', 1, 25),
  // what the stall buys back
  sell('item/material/wheat', 3),
  ...VEGETABLE_CROPS.map((c) => sell(`item/food/${c.id}`, CROP_PRICE[c.id] ?? 4)),
  sell('item/food/berries', 1),
  sell('item/material/herb', 3),
  sell('item/food/egg/raw', 4),
  sell('item/vessel/bucket/milk', 12),
  sell('item/food/fish/raw', 6),
  ...Object.entries(FISH_PRICE).map(([id, price]) => sell(`item/food/fish/${id}`, price)),
  sell('item/misc/old_boot', 1),
]

const ANIMAL = { type: 'actor/creature/animal' }
/** What a beast fed does: fed for a day, and glad of it. */
const FED: Effect[] = [{ op: 'addStatus', status: 'fed', duration: FED_FOR }, { op: 'emote', mood: 'happy' }, { op: 'log', text: L('{host} eats happily.', '{host}吃得很开心。') }]

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
    tree: { if: { is: { role: 'target', sel: ANIMAL } }, then: { do: [{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'fed' } }, { op: 'destroy' }] }, else: 'inherit' },
  })),
  story({
    id: 'home/fed',
    doc: 'A beast fed is fed for a day (Stardew\'s hay, Minecraft\'s wheat): content, and a fed cow can be milked; told it is milked, it is milked for the day.',
    host: ANIMAL,
    on: 'impulse/notify',
    tree: {
      if: { param: { key: 'what', cmp: 'fed' } },
      then: { do: FED },
      else: { if: { param: { key: 'what', cmp: 'milked' } }, then: { do: [{ op: 'addStatus', status: 'milked', duration: FED_FOR }] }, else: 'inherit' },
    },
  }),
  // breeding (Minecraft's): a cow or a hen fed calls to the fed of its kind close by; one not resting from young answers
  // with a calf or a chick of its own (and rests a day). A young one never breeds.
  ...(['cow', 'chicken'] as const).map((kind) => story({
    id: `home/breed-${kind}`,
    doc: `A ${kind} fed (not resting from young) calls to the fed ${kind}s beside it; one that hears the call (fed, not resting) bears its young beside it, and both rest a day (the caller is told); told it is milked, a cow is milked for the day.`,
    host: { type: `actor/creature/animal/${kind}` },
    on: 'impulse/notify',
    tree: {
      if: { param: { key: 'what', cmp: 'fed' } },
      // one resting from young does not call
      then: { if: { has: { role: 'host', status: 'bred' } }, then: { do: FED }, else: { do: [...FED, { op: 'emit', impulse: 'notify', to: { area: { radius: 3 } }, params: { what: 'mate' }, filter: { type: `actor/creature/animal/${kind}`, status: ['fed'], notStatus: ['bred'] } }] } },
      else: {
        // the call heard: the young born beside it, and the caller told so (both rest a day)
        if: { all: [{ param: { key: 'what', cmp: 'mate' } }, { has: { role: 'host', status: 'fed' } }, { not: { has: { role: 'host', status: 'bred' } } }] },
        then: { do: [{ op: 'spawn', type: '@prop:host.babyType', at: 'tileOf:host' }, { op: 'addStatus', status: 'bred', duration: FED_FOR }, { op: 'emit', impulse: 'notify', to: 'source', params: { what: 'rested' } }, { op: 'emote', mood: 'happy' }, { op: 'vfx', fx: 'sparkle' }, { op: 'log', text: L(kind === 'cow' ? 'A calf is born!' : 'A chick hatches!', kind === 'cow' ? '一头小牛出生了！' : '一只小鸡孵出来了！') }] },
        else: {
          if: { param: { key: 'what', cmp: 'rested' } },
          then: { do: [{ op: 'addStatus', status: 'bred', duration: FED_FOR }] },
          else: { if: { param: { key: 'what', cmp: 'milked' } }, then: { do: [{ op: 'addStatus', status: 'milked', duration: FED_FOR }] }, else: 'inherit' },
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
        else: { do: [{ op: 'log', text: L('{target} will not give milk — feed it first, and only once a day.', '{target}不肯产奶——先喂饱它，而且一天只能挤一次。') }] },
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
    tree: { do: [{ op: 'spawn', type: '@prop:host.animalType', at: 'target' }, { op: 'vfx', fx: 'dust', at: 'target' }, { op: 'log', text: L('The crate opens, and out it comes.', '箱子打开，里面的动物走了出来。') }, { op: 'destroy' }] },
  }),
  story({
    id: 'home/bait',
    label: L('Bait {target}', '给{target}挂饵'),
    doc: 'Bait used on a fishing rod: the rod is told, and keeps the casts it is good for; the bait is used up.',
    host: { tags: ['bait'] },
    on: 'act/use',
    tree: { if: { is: { role: 'target', sel: { tags: ['tool:fishing'] } } }, then: { do: [{ op: 'emit', impulse: 'notify', to: 'target', params: { what: 'bait', casts: { prop: 'casts', of: 'host' } } }, { op: 'destroy' }] }, else: 'inherit' },
  }),
  story({
    id: 'home/rod',
    doc: 'A fishing rod keeps its bait: told it is baited, it has that many more casts; told a baited cast is spent, one fewer.',
    host: { tags: ['tool:fishing'] },
    on: 'impulse/notify',
    tree: {
      if: { param: { key: 'what', cmp: 'bait' } },
      then: { do: [{ op: 'addProp', key: 'bait', delta: { param: 'casts' } }, { op: 'log', text: L('You bait the hook.', '你挂好了鱼饵。') }] },
      else: { if: { param: { key: 'what', cmp: 'cast' } }, then: { do: [{ op: 'addProp', key: 'bait', delta: -1, min: 0 }] }, else: 'inherit' },
    },
  }),
]
