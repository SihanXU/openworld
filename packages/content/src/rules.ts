// The base rule library: every mechanic of the world as data. Object interactions,
// elemental reactions, environment physics and combat all live here, in one engine.
// Anything these rules do not cover is an *undefined interaction* for the Mod port.

import type { Amount, Cond, Effect, RoleRef, Rule, Selector } from '@lsw/engine'

const base = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })
const say = (who: 'actor' | 'target', en: string, zh: string): Effect => ({ op: 'say', who, text: { en, zh } })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: { en, zh } })
const vfx = (fx: string, at: RoleRef = 'target'): Effect => ({ op: 'vfx', at, fx })

const EMPTY_HAND: Selector = { none: true }
const PUT_OR_USE: ('put' | 'interact')[] = ['put', 'interact']

// ------------------------------------------------------------------ taking & placing

const TAKING: Rule[] = [
  base({
    id: 'core/take-item',
    doc: 'Pick up a loose item (into the hand if free, else the pack).',
    on: 'interaction',
    when: { verb: ['take'], target: { kind: 'item' } },
    do: [{ op: 'moveTo', of: 'target', to: 'actor', into: 'hand' }, log('You take {target}.', '你拿起了{target}。')],
  }),
  base({
    id: 'core/take-nothing',
    fallback: true,
    doc: 'Nothing loose on this tile.',
    on: 'interaction',
    when: { verb: ['take'], target: { kind: 'tile' } },
    do: [say('actor', 'Nothing here to take.', '这里没什么可拿的。')],
  }),
  base({
    id: 'core/take-closed',
    on: 'interaction',
    when: { verb: ['take'], target: { kind: 'fixture', tags: ['container'], notStatus: ['open'] } },
    do: [say('actor', 'It is closed.', '它是关着的。')],
  }),
  base({
    id: 'core/take-empty',
    on: 'interaction',
    when: { verb: ['take'], target: { kind: 'fixture', tags: ['container'], status: ['open'] } },
    do: [say('actor', 'It is empty.', '里面空空如也。')],
  }),
  base({
    id: 'core/put-down',
    doc: 'Set the held item down on open ground.',
    on: 'interaction',
    when: { verb: ['put'], target: { kind: 'tile', notTags: ['solid', 'liquid'] } },
    do: [{ op: 'moveTo', of: 'instrument', to: 'target' }, log('You put down {instrument}.', '你放下了{instrument}。')],
  }),
  base({
    id: 'core/put-on-item',
    doc: 'Placing something on a loose item just sets it down beside it.',
    on: 'interaction',
    when: { verb: ['put'], target: { kind: 'item' } },
    do: [{ op: 'moveTo', of: 'instrument', to: 'tileOf:target' }, log('You put down {instrument}.', '你放下了{instrument}。')],
  }),
  base({
    id: 'core/store',
    doc: 'Put the held item into an open container.',
    on: 'interaction',
    priority: 2,
    when: { verb: ['put'], target: { kind: 'fixture', tags: ['container'], status: ['open'] } },
    do: [{ op: 'moveTo', of: 'instrument', to: 'target', into: 'contents' }, log('You put {instrument} into {target}.', '你把{instrument}放进了{target}。')],
  }),
  base({
    id: 'core/store-closed',
    on: 'interaction',
    priority: 2,
    when: { verb: ['put'], target: { kind: 'fixture', tags: ['container'], notStatus: ['open'] } },
    do: [say('actor', 'It is closed.', '它是关着的。')],
  }),
  base({
    id: 'core/take-fixed',
    fallback: true,
    doc: 'Fixtures stay where they are (containers answer for themselves).',
    on: 'interaction',
    when: { verb: ['take'], target: { kind: 'fixture' } },
    do: [say('actor', 'That stays where it is.', '这个拿不走。')],
  }),
  base({
    id: 'core/put-on-surface',
    doc: 'Set the held item on a table, counter, stall, bench, altar or anvil (it lies on that tile; take it back from there).',
    on: 'interaction',
    priority: 1,
    when: { verb: ['put'], target: { kind: 'fixture', tags: ['surface'] } },
    do: [{ op: 'moveTo', of: 'instrument', to: 'tileOf:target' }, log('You set {instrument} on {target}.', '你把{instrument}放在了{target}上。')],
  }),
  base({
    id: 'core/put-in-water',
    doc: 'Water refuses what is put in it, so nothing is lost; filling a vessel claims the case first.',
    on: 'interaction',
    when: { verb: ['put'], target: { kind: 'tile', tags: ['water'] } },
    do: [say('actor', 'It would sink.', '会沉下去的。')],
  }),
  base({
    id: 'core/put-in-lava',
    doc: 'Lava burns up anything flammable put in it.',
    on: 'interaction',
    when: { verb: ['put'], target: { kind: 'tile', tags: ['molten'] }, instrument: { tags: ['flammable'] } },
    do: [{ op: 'destroy', of: 'instrument' }, vfx('fire_burst'), log('{instrument} burns up in the lava.', '{instrument}在熔岩里烧成了灰。')],
  }),
  base({
    id: 'core/put-blocked',
    doc: 'Solid ground (walls, trees, rock, deep water, lava) takes nothing: the last word on putting there.',
    on: 'interaction',
    priority: -1,
    when: { verb: ['put'], target: { kind: 'tile', tags: ['solid'] } },
    do: [say('actor', 'There is no room there.', '那里放不下。')],
  }),
  base({
    id: 'core/store-full',
    doc: 'A container at its capacity refuses more.',
    on: 'interaction',
    priority: 2,
    when: { verb: ['put'], target: { kind: 'fixture', tags: ['container'], status: ['open'] } },
    guard: { count: { role: 'target', in: 'contents', cmp: { gte: { prop: 'capacity', of: 'target' } } } },
    do: [say('actor', 'It is full.', '已经装满了。')],
  }),
  base({
    id: 'core/give',
    doc: 'Hand the held item to a person: they take it and say what they make of it.',
    on: 'interaction',
    when: { verb: ['put'], target: { type: 'actor/person', self: false } },
    do: [{ op: 'give', to: 'target', item: 'instrument' }],
  }),
]

// ------------------------------------------------------------------ empty-handed interaction

const HANDS: Rule[] = [
  base({
    id: 'core/talk',
    doc: 'Talk to a person: they say what fits the moment.',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: 'actor/person', self: false }, instrument: EMPTY_HAND },
    do: [{ op: 'say', who: 'target', text: '@line' }],
  }),
  base({
    id: 'core/examine-creature',
    fallback: true,
    on: 'interaction',
    when: { verb: ['interact'], target: { type: 'actor/creature' }, instrument: EMPTY_HAND },
    do: [log('{target} eyes you warily.', '{target}警惕地盯着你。')],
  }),
  base({
    id: 'core/open-close',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'fixture', tags: ['container'], notTags: ['locked'] }, instrument: EMPTY_HAND },
    do: [{ op: 'open', of: 'target' }, vfx('dust')],
  }),
  base({
    id: 'core/locked',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'fixture', tags: ['container', 'locked'] }, instrument: EMPTY_HAND },
    do: [say('actor', 'Locked.', '锁住了。')],
  }),
  base({
    id: 'core/read',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'fixture', tags: ['readable'] }, instrument: EMPTY_HAND },
    do: [{ op: 'say', who: 'target', text: '@line' }],
  }),
  base({
    id: 'core/examine-fixture',
    fallback: true,
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'fixture' }, instrument: EMPTY_HAND },
    do: [log('It is {target}.', '这是{target}。')],
  }),
  base({
    id: 'core/examine-item',
    fallback: true,
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'item' }, instrument: EMPTY_HAND },
    do: [log('{target}.', '{target}。')],
  }),
  base({
    id: 'core/examine-ground',
    fallback: true,
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile' }, instrument: EMPTY_HAND },
    do: [log('{target}.', '{target}。')],
  }),
  base({
    id: 'core/examine-self',
    fallback: true,
    on: 'interaction',
    when: { verb: ['interact'], target: { self: true }, instrument: EMPTY_HAND },
    do: [say('actor', 'I feel fine.', '我感觉还行。')],
  }),
]

// ------------------------------------------------------------------ using held things

const USING: Rule[] = [
  base({
    id: 'core/eat',
    confirm: { en: 'Eat {instrument}?', zh: '要吃掉{instrument}吗？' },
    on: 'interaction',
    when: { verb: ['interact'], target: { self: true }, instrument: { tags: ['edible'] } },
    do: [
      { op: 'heal', of: 'actor', amount: { prop: 'heal', of: 'instrument', add: 1 } },
      vfx('heal', 'actor'),
      log('You eat {instrument}.', '你吃掉了{instrument}。'),
      { op: 'destroy', of: 'instrument' },
    ],
  }),
  base({
    id: 'core/drink',
    confirm: { en: 'Drink {instrument}?', zh: '要喝掉{instrument}吗？' },
    on: 'interaction',
    when: { verb: ['interact'], target: { self: true }, instrument: { tags: ['drinkable'] } },
    do: [{ op: 'heal', of: 'actor', amount: { prop: 'heal', of: 'instrument', add: 1 } }, vfx('heal', 'actor'), log('You drink {instrument}.', '你喝下了{instrument}。'), { op: 'destroy', of: 'instrument' }],
  }),
  base({
    id: 'core/drink-water',
    confirm: { en: 'Drink {instrument}?', zh: '要喝掉{instrument}吗？' },
    on: 'interaction',
    priority: 1,
    when: { verb: ['interact'], target: { self: true }, instrument: { tags: ['liquid:water'] } },
    do: [{ op: 'heal', of: 'actor', amount: 2 }, { op: 'transform', of: 'instrument', into: '@prop:emptyType' }, log('Refreshing.', '清凉解渴。')],
  }),
  base({
    id: 'core/fill-water',
    doc: 'Fill an empty vessel at water (a well, a fountain, a lake).',
    on: 'interaction',
    priority: 1,
    when: { verb: PUT_OR_USE, target: { tags: ['water-source'] }, instrument: { tags: ['empty-vessel'] } },
    do: [{ op: 'transform', of: 'instrument', into: '@prop:waterType' }, vfx('splash'), log('Filled with water.', '你装满了水。')],
  }),
  base({
    id: 'core/douse',
    doc: 'Water puts out fire (and leaves things wet).',
    on: 'interaction',
    priority: 5,
    when: { verb: PUT_OR_USE, target: { status: ['burning'], notTags: ['water'] }, instrument: { tags: ['liquid:water'] } },
    do: [
      { op: 'removeStatus', of: 'target', status: 'burning' },
      { op: 'addStatus', of: 'target', status: 'wet' },
      { op: 'transform', of: 'instrument', into: '@prop:emptyType' },
      vfx('steam'),
      log('Hssss — the fire dies.', '嘶——火灭了。'),
    ],
  }),
  base({
    id: 'core/splash',
    doc: 'Pour water on anything: it gets wet.',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { notTags: ['water'] }, instrument: { tags: ['liquid:water'] } },
    do: [
      { op: 'addStatus', of: 'target', status: 'wet' },
      { op: 'transform', of: 'instrument', into: '@prop:emptyType' },
      vfx('splash'),
      log('You splash water on {target}.', '你把水泼在了{target}上。'),
    ],
  }),
  base({
    id: 'core/pour-oil',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { notTags: ['water'] }, instrument: { tags: ['liquid:oil'] } },
    do: [
      { op: 'addStatus', of: 'target', status: 'oiled' },
      { op: 'transform', of: 'instrument', into: '@prop:emptyType' },
      vfx('splash'),
      log('Slick oil coats {target}.', '{target}被泼上了一层滑腻的油。'),
    ],
  }),
  base({
    id: 'core/ignite',
    doc: 'A flame sets flammable things alight.',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { tags: ['flammable'], notStatus: ['wet', 'burning', 'frozen'] }, instrument: { tags: ['fire-source'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'burning' }, vfx('fire_burst'), log('{target} catches fire!', '{target}烧了起来！')],
  }),
  base({
    id: 'core/ignite-oiled',
    doc: 'Oil makes anything burn, and burn hard.',
    on: 'interaction',
    priority: 1,
    when: { verb: PUT_OR_USE, target: { status: ['oiled'], notStatus: ['burning', 'wet', 'frozen'] }, instrument: { tags: ['fire-source'] } },
    do: [
      { op: 'removeStatus', of: 'target', status: 'oiled' },
      { op: 'addStatus', of: 'target', status: 'burning' },
      { op: 'hit', of: 'target', element: 'fire', power: 6 },
      { op: 'spread', from: 'target', status: 'burning', radius: 1, chance: 0.6, filter: { tags: ['flammable'], notStatus: ['wet'] } },
      vfx('explosion'),
      log('The oil ignites with a roar!', '油轰地一下燃了起来！'),
    ],
  }),
  base({
    id: 'core/ignite-wet',
    on: 'interaction',
    priority: 1,
    when: { verb: PUT_OR_USE, target: { tags: ['flammable'], status: ['wet'] }, instrument: { tags: ['fire-source'] } },
    do: [vfx('smoke'), say('actor', 'Too wet to catch.', '太湿了，点不着。')],
  }),
  base({
    id: 'core/light',
    doc: 'Light a campfire, brazier, candles or a forge.',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { tags: ['lightable'], notStatus: ['lit', 'wet'] }, instrument: { tags: ['fire-source'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'lit' }, vfx('fire_burst'), log('{target} flickers to life.', '{target}被点燃了。')],
  }),
  base({
    id: 'core/snuff',
    doc: 'Water puts out a lit fixture.',
    on: 'interaction',
    priority: 2,
    when: { verb: PUT_OR_USE, target: { tags: ['lightable'], status: ['lit'] }, instrument: { tags: ['liquid:water'] } },
    do: [
      { op: 'removeStatus', of: 'target', status: 'lit' },
      { op: 'transform', of: 'instrument', into: '@prop:emptyType' },
      vfx('steam'),
      log('The flames hiss out.', '火苗嘶地熄灭了。'),
    ],
  }),
  base({
    id: 'core/cook',
    doc: 'Hold raw food over a lit fire to cook it.',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { tags: ['cookware'], status: ['lit'] }, instrument: { tags: ['cookable', 'raw'] } },
    do: [{ op: 'transform', of: 'instrument', into: '@prop:cookedType' }, vfx('smoke'), log('It sizzles and cooks.', '滋滋作响，熟了。')],
  }),
  base({
    id: 'core/burn-in-fire',
    doc: 'Feed flammable things to a lit fire: they burn away.',
    on: 'interaction',
    priority: 3,
    when: { verb: ['put'], target: { tags: ['lightable'], status: ['lit'] }, instrument: { tags: ['flammable'] } },
    do: [{ op: 'destroy', of: 'instrument' }, vfx('fire_burst'), log('{instrument} burns away.', '{instrument}烧成了灰。')],
  }),
  base({
    id: 'core/mine',
    on: 'interaction',
    when: { verb: ['interact'], target: { tags: ['mineable'] }, instrument: { tags: ['tool:pickaxe'] } },
    do: [{ op: 'spawn', type: 'item/material/stone', at: 'tileOf:actor' }, vfx('dust'), log('Chips of stone fly.', '石屑纷飞。')],
  }),
  base({
    id: 'core/mine-rock',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile', tags: ['mineable', 'rock'] }, instrument: { tags: ['tool:pickaxe'] } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'gravel' }, { op: 'spawn', type: 'item/material/stone', at: 'tileOf:target' }, vfx('dust'), log('The rock breaks apart.', '岩石碎开了。')],
  }),
  base({
    id: 'core/unlock',
    on: 'interaction',
    when: { verb: ['interact'], target: { tags: ['locked'] }, instrument: { tags: ['key'] } },
    do: [{ op: 'removeTag', of: 'target', tag: 'locked' }, { op: 'open', of: 'target' }, vfx('sparkle'), log('Click. It opens.', '咔哒一声，开了。')],
  }),
  base({
    id: 'core/lock',
    doc: 'A key locks a closed container again.',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'fixture', tags: ['container'], notTags: ['locked'], notStatus: ['open'] }, instrument: { tags: ['key'] } },
    do: [{ op: 'addTag', of: 'target', tag: 'locked' }, vfx('sparkle'), log('Click. It is locked.', '咔哒一声，锁上了。')],
  }),
  base({
    id: 'core/till',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile', tags: ['diggable'] }, instrument: { tags: ['tool:hoe'] } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'farmland' }, vfx('dust')],
  }),
  base({
    id: 'core/fish-bite',
    doc: 'Cast a line into water: sometimes something bites.',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile', tags: ['water'] }, instrument: { tags: ['tool:fishing'] } },
    guard: { chance: 0.35 },
    do: [{ op: 'spawn', type: 'item/food/fish/raw', at: 'actor', into: 'contents' }, vfx('splash'), log('A tug — you reel in a fish!', '一沉——你拉上来一条鱼！')],
  }),
  base({
    id: 'core/fish-wait',
    doc: 'Cast a line into water: nothing yet.',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile', tags: ['water'] }, instrument: { tags: ['tool:fishing'] } },
    do: [vfx('splash'), log('The float bobs. Nothing bites — yet.', '浮漂晃了晃。还没咬钩。')],
  }),
]

// ------------------------------------------------------------------ woodcutting

const AXE: Selector = { tags: ['tool:axe'] }
const LIVING_TREE: Selector = { kind: 'tile', tags: ['tree', 'flammable'] }
const STUMP: Selector = { kind: 'tile', type: 'tile/stump' }

const WOOD: Rule[] = [
  base({
    id: 'wood/notch',
    doc: 'The first swing of an axe notches a tree.',
    on: 'interaction',
    when: { verb: ['interact'], target: { ...LIVING_TREE, notStatus: ['notched'] }, instrument: AXE },
    do: [{ op: 'addStatus', of: 'target', status: 'notched' }, vfx('leaves'), log('The axe bites into {target}.', '斧头砍进了{target}。')],
  }),
  base({
    id: 'wood/fell',
    doc: 'The second swing fells it: a stump that grows back, two logs and a stick.',
    on: 'interaction',
    when: { verb: ['interact'], target: { ...LIVING_TREE, status: ['notched'] }, instrument: AXE },
    do: [
      { op: 'removeStatus', of: 'target', status: 'notched' },
      { op: 'setTerrain', of: 'target', terrain: 'stump' },
      { op: 'addStatus', of: 'target', status: 'regrowing' },
      { op: 'spawn', type: 'item/material/log', at: 'tileOf:target', count: 2 },
      { op: 'spawn', type: 'item/material/stick', at: 'tileOf:target' },
      vfx('leaves'),
      log('Timber!', '树倒了！'),
    ],
  }),
  base({
    id: 'wood/acorn',
    doc: 'A felled tree sometimes drops an acorn.',
    on: 'interaction',
    compose: true,
    when: { verb: ['interact'], target: { ...LIVING_TREE, status: ['notched'] }, instrument: AXE },
    guard: { chance: 0.25 },
    do: [{ op: 'spawn', type: 'item/seed/acorn', at: 'tileOf:target' }],
  }),
  base({
    id: 'wood/regrow',
    doc: 'A stump left alone grows back into a tree.',
    on: 'expire',
    when: { status: ['regrowing'], target: STUMP },
    guard: { count: { role: 'target', in: 'tile', match: { kind: 'actor' }, cmp: { eq: 0 } } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'tree' }, vfx('leaves')],
  }),
  base({
    id: 'wood/regrow-later',
    doc: 'Someone is standing on the stump: try again in an hour rather than grow around them.',
    on: 'expire',
    priority: 1,
    when: { status: ['regrowing'], target: STUMP },
    guard: { count: { role: 'target', in: 'tile', match: { kind: 'actor' }, cmp: { gte: 1 } } },
    do: [{ op: 'addStatus', of: 'target', status: 'regrowing', duration: 600 }],
  }),
  base({
    id: 'wood/split',
    doc: 'An axe splits a log into two planks.',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: 'item/material/log' }, instrument: AXE },
    do: [
      log('You split the log into planks.', '你把木头劈成了木板。'),
      { op: 'transform', of: 'target', into: 'item/material/plank' },
      { op: 'spawn', type: 'item/material/plank', at: 'tileOf:target' },
      vfx('dust'),
    ],
  }),
  base({
    id: 'wood/uproot',
    doc: 'A shovel digs a stump out for good.',
    on: 'interaction',
    when: { verb: ['interact'], target: STUMP, instrument: { tags: ['tool:shovel'] } },
    do: [
      { op: 'removeStatus', of: 'target', status: 'regrowing' },
      { op: 'setTerrain', of: 'target', terrain: 'dirt' },
      { op: 'spawn', type: 'item/material/stick', at: 'tileOf:target' },
      vfx('dust'),
      log('You dig out the stump.', '你把树桩挖了出来。'),
    ],
  }),
  base({
    id: 'wood/char',
    doc: 'An axe breaks a charred tree down to coal and ash.',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile', type: 'tile/charred_tree' }, instrument: AXE },
    do: [
      { op: 'setTerrain', of: 'target', terrain: 'ash' },
      { op: 'spawn', type: 'item/material/coal', at: 'tileOf:target' },
      vfx('dust'),
      log('The charred wood crumbles to coal.', '焦木碎成了煤炭。'),
    ],
  }),
]

// ------------------------------------------------------------------ building
//
// Things are built where they will stand: one material put on another starts a piece of
// unfinished work that counts what goes in, and a hammer finishes it. An axe (a pickaxe for
// stone) takes unfinished work apart again, so nothing put into it is lost.

const HAMMER: Selector = { tags: ['tool:hammer'] }
const PLANK: Selector = { type: 'item/material/plank' }
const STICK: Selector = { type: 'item/material/stick' }
const STONE: Selector = { type: 'item/material/stone' }
const FRAME = 'fixture/build/frame'
const RING = 'fixture/build/ring'

/** Put `held` on a loose `on` item: it becomes `into`, and the held one goes into it. */
const start = (id: string, held: Selector, on: string, into: string, en: string, zh: string, props: Record<string, number> = {}): Rule =>
  base({
    id,
    on: 'interaction',
    when: { verb: ['put'], target: { kind: 'item', type: on }, instrument: held },
    do: [
      { op: 'destroy', of: 'instrument' },
      { op: 'transform', of: 'target', into },
      ...Object.entries(props).map(([key, value]): Effect => ({ op: 'setProp', of: 'target', key, value })),
      vfx('dust'),
      log(en, zh),
    ],
  })

/** A hammer on `from` (with these props) turns it into `into`. */
const finish = (id: string, from: string, into: string, en: string, zh: string, props?: Record<string, number>, extra: Effect[] = []): Rule =>
  base({
    id,
    on: 'interaction',
    when: { verb: ['interact'], target: { type: from, ...(props && { props }) }, instrument: HAMMER },
    do: [{ op: 'transform', of: 'target', into }, ...extra, vfx('dust'), log(en, zh)],
  })

/** A tool takes unfinished work apart into what went into it. */
const undo = (id: string, from: string, tool: Selector, back: [string, Amount][]): Rule =>
  base({
    id,
    doc: 'Nothing put into unfinished work is lost: it comes apart into its materials.',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: from }, instrument: tool },
    do: [
      ...back.map(([type, count]): Effect => ({ op: 'spawn', type, at: 'tileOf:target', count })),
      { op: 'destroy', of: 'target' },
      vfx('dust'),
      log('{target} comes apart.', '{target}被拆开了。'),
    ],
  })

const BUILD: Rule[] = [
  // a chest (or a crate) from a frame of planks
  start('build/start-frame', PLANK, 'item/material/plank', FRAME, 'Two planks make a frame.', '两块木板搭成了框架。', { planks: 2 }),
  base({
    id: 'build/add-plank',
    on: 'interaction',
    when: { verb: ['put'], target: { type: FRAME, props: { planks: { lt: 4 } } }, instrument: PLANK },
    do: [{ op: 'destroy', of: 'instrument' }, { op: 'addProp', of: 'target', key: 'planks', delta: 1 }, log('A frame of {target.planks} planks.', '框架上有{target.planks}块木板了。')],
  }),
  base({
    id: 'build/frame-full',
    on: 'interaction',
    when: { verb: ['put'], target: { type: FRAME, props: { planks: { gte: 4 } } }, instrument: PLANK },
    do: [say('actor', 'It is ready for a hammer.', '可以用锤子敲了。')],
  }),
  ...(
    [
      [2, 'A frame of 2 planks. A hammer makes a crate; two more make a chest.', '两块木板的框架。用锤子能做成板条箱；再加两块能做成箱子。'],
      [3, 'A frame of 3 planks. One more makes a chest.', '三块木板的框架。再加一块就能做成箱子。'],
      [4, 'A frame of 4 planks. A hammer makes a chest.', '四块木板的框架。用锤子能做成箱子。'],
    ] as const
  ).map(([n, en, zh]) =>
    base({
      id: `build/read-frame-${n}`,
      on: 'interaction',
      when: { verb: ['interact'], target: { type: FRAME, props: { planks: n } }, instrument: EMPTY_HAND },
      do: [say('actor', en, zh)],
    }),
  ),
  finish('build/finish-crate', FRAME, 'fixture/container/crate', 'You nail together a crate.', '你钉好了一个板条箱。', { planks: 2 }),
  finish('build/finish-chest', FRAME, 'fixture/container/chest', 'You nail together a chest.', '你钉好了一个箱子。', { planks: 4 }),
  base({
    id: 'build/unfinished',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: FRAME, props: { planks: 3 } }, instrument: HAMMER },
    do: [say('actor', 'One more plank.', '还差一块木板。')],
  }),
  ...(
    [
      ['fixture/container/crate', 1],
      ['fixture/container/chest', 2],
    ] as const
  ).map(([type, planks]) =>
    base({
      id: `build/dismantle-${type.split('/').pop()}`,
      doc: 'An axe breaks up an unlocked crate or chest: its contents spill and half its planks come back.',
      on: 'interaction',
      when: { verb: ['interact'], target: { type, notTags: ['locked'] }, instrument: AXE },
      do: [
        { op: 'dropContents', of: 'target' },
        { op: 'spawn', type: 'item/material/plank', at: 'tileOf:target', count: planks },
        { op: 'destroy', of: 'target' },
        vfx('dust'),
        log('You break up {target}.', '你拆掉了{target}。'),
      ],
    }),
  ),
  undo('build/unframe', FRAME, AXE, [['item/material/plank', { prop: 'planks', of: 'target' }]]),

  // a fence from stakes
  start('build/stakes', STICK, 'item/material/stick', 'fixture/build/stakes', 'Two sticks make stakes.', '两根树枝立成了木桩。'),
  finish('build/fence', 'fixture/build/stakes', 'fixture/fence', 'You nail up a fence.', '你钉好了一段栅栏。'),
  undo('build/unstake', 'fixture/build/stakes', AXE, [['item/material/stick', 2]]),

  // a campfire from a ring of stones and two sticks
  start('build/ring', STONE, 'item/material/stone', RING, 'Two stones make a fire ring.', '两块石头围成了火圈。', { sticks: 0 }),
  base({
    id: 'build/ring-stick',
    on: 'interaction',
    when: { verb: ['put'], target: { type: RING, props: { sticks: 0 } }, instrument: STICK },
    do: [{ op: 'destroy', of: 'instrument' }, { op: 'setProp', of: 'target', key: 'sticks', value: 1 }, log('One more stick.', '再加一根树枝。')],
  }),
  base({
    id: 'build/campfire',
    on: 'interaction',
    when: { verb: ['put'], target: { type: RING, props: { sticks: 1 } }, instrument: STICK },
    do: [{ op: 'destroy', of: 'instrument' }, { op: 'transform', of: 'target', into: 'fixture/light/campfire' }, vfx('dust'), log('A campfire, ready to light.', '篝火搭好了，可以点了。')],
  }),
  undo('build/unring', RING, { tags: ['tool:pickaxe'] }, [
    ['item/material/stone', 2],
    ['item/material/stick', { prop: 'sticks', of: 'target' }],
  ]),

  // a sign from a plank on a stick, written with a quill while carrying ink
  start('build/post', PLANK, 'item/material/stick', 'fixture/build/post', 'A plank on a stick: a sign post.', '木板架在树枝上，成了牌子立柱。'),
  finish('build/sign', 'fixture/build/post', 'fixture/sign', 'You nail up a blank sign.', '你钉好了一块空白的告示牌。', undefined, [{ op: 'addTag', of: 'target', tag: 'blank' }]),
  undo('build/unpost', 'fixture/build/post', AXE, [
    ['item/material/plank', 1],
    ['item/material/stick', 1],
  ]),
  base({
    id: 'build/read-blank',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: 'fixture/sign', tags: ['blank'] }, instrument: EMPTY_HAND },
    do: [say('actor', 'It is blank.', '上面什么也没写。')],
  }),
  base({
    id: 'build/write-sign',
    doc: 'A quill writes on a blank sign while you carry ink. Until free-text input exists, it writes one fixed line.',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: 'fixture/sign', tags: ['blank'] }, instrument: { tags: ['writing'] } },
    guard: { count: { role: 'actor', in: 'contents', match: { type: 'item/misc/ink' }, cmp: { gte: 1 } } },
    do: [{ op: 'removeTag', of: 'target', tag: 'blank' }, { op: 'addTag', of: 'target', tag: 'handmade' }, log('You write on the sign.', '你在告示牌上写了字。')],
  }),
  base({
    id: 'build/read-handmade',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: 'fixture/sign', tags: ['handmade'] }, instrument: EMPTY_HAND },
    do: [say('actor', 'Made by hand.', '亲手所制。')],
  }),

  // a bridge, one plank at a time
  base({
    id: 'build/bridge',
    doc: 'A plank put on shallow water becomes a stretch of bridge.',
    on: 'interaction',
    when: { verb: ['put'], target: { kind: 'tile', type: 'tile/water' }, instrument: PLANK },
    do: [{ op: 'destroy', of: 'instrument' }, { op: 'setTerrain', of: 'target', terrain: 'bridge' }, vfx('splash'), log('You lay a plank across the water.', '你在水上铺了一块木板。')],
  }),
]

// ------------------------------------------------------------------ farming
//
// A crop is a fixture that names its next stage, yield, seed and yield count as props, so
// one set of rules grows and harvests every plant. Watering starts a timer (`watered`); when
// it runs out the crop moves on a stage. Ash fertilizes: one more of the crop at harvest.

const CROP: Selector = { kind: 'fixture', tags: ['crop'] }
const GROWING: Selector = { kind: 'fixture', tags: ['crop', 'growing'] }
const RIPE_ANNUAL: Selector = { kind: 'fixture', tags: ['crop', 'ripe'], notTags: ['perennial'] }
const RIPE_PERENNIAL: Selector = { kind: 'fixture', tags: ['crop', 'ripe', 'perennial'] }
const NOTHING_GROWS: Cond = { count: { role: 'target', in: 'tile', match: { tags: ['crop'] }, cmp: { eq: 0 } } }
const NOBODY_THERE: Cond = { count: { role: 'target', in: 'tile', match: { kind: 'actor' }, cmp: { eq: 0 } } }
const SICKLE: Selector = { tags: ['tool:sickle'] }

const harvested = (count: Amount): Effect[] => [
  { op: 'spawn', type: '@prop:target.yieldType', at: 'tileOf:target', count },
  { op: 'spawn', type: '@prop:target.seedType', at: 'tileOf:target', count: 2 },
]
const picked: Effect[] = [
  { op: 'spawn', type: '@prop:target.yieldType', at: 'actor', into: 'hand' },
  { op: 'spawn', type: '@prop:target.seedType', at: 'tileOf:target' },
]
/** A perennial goes back to its young stage, its fertilizer spent. */
const regrow: Effect[] = [
  { op: 'transform', of: 'target', into: '@prop:regrowType' },
  { op: 'removeStatus', of: 'target', status: 'fertilized' },
  { op: 'setProp', of: 'target', key: 'yield', value: 2 },
]

const FARM: Rule[] = [
  base({
    id: 'farm/sow',
    doc: 'A seed put on bare farmland takes root as its crop.',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { kind: 'tile', type: 'tile/farmland' }, instrument: { tags: ['plantable'] } },
    guard: NOTHING_GROWS,
    do: [
      log('You sow {instrument}.', '你播下了{instrument}。'),
      { op: 'moveTo', of: 'instrument', to: 'target' },
      { op: 'transform', of: 'instrument', into: '@prop:cropType' },
      vfx('dust'),
    ],
  }),
  base({
    id: 'farm/plant-acorn',
    doc: 'An acorn takes root in any diggable ground and becomes a tree in two game days.',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { kind: 'tile', tags: ['diggable'] }, instrument: { tags: ['acorn'] } },
    guard: NOTHING_GROWS,
    do: [
      log('You plant an acorn.', '你种下了一颗橡子。'),
      { op: 'moveTo', of: 'instrument', to: 'target' },
      { op: 'transform', of: 'instrument', into: '@prop:cropType' },
      { op: 'addStatus', of: 'instrument', status: 'rooting' },
      vfx('dust'),
    ],
  }),
  base({
    id: 'farm/water',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { ...GROWING, notStatus: ['watered'] }, instrument: { tags: ['liquid:water'] } },
    do: [
      { op: 'addStatus', of: 'target', status: 'watered' },
      { op: 'transform', of: 'instrument', into: '@prop:emptyType' },
      vfx('splash'),
      log('You water {target}.', '你给{target}浇了水。'),
    ],
  }),
  base({
    id: 'farm/grow',
    doc: 'Two game hours after watering, a crop grows one stage.',
    on: 'expire',
    when: { status: ['watered'], target: GROWING },
    do: [{ op: 'transform', of: 'target', into: '@prop:nextType' }, vfx('leaves')],
  }),
  base({
    id: 'farm/fertilize',
    doc: 'Ash on a growing crop: one more of the crop at harvest.',
    on: 'interaction',
    when: { verb: PUT_OR_USE, target: { ...GROWING, notStatus: ['fertilized'] }, instrument: { type: 'item/material/ash' } },
    do: [
      { op: 'destroy', of: 'instrument' },
      { op: 'addStatus', of: 'target', status: 'fertilized' },
      { op: 'addProp', of: 'target', key: 'yield', delta: 1 },
      vfx('sparkle'),
      log('You work ash into the soil.', '你把灰烬翻进了土里。'),
    ],
  }),
  base({
    id: 'farm/harvest',
    on: 'interaction',
    when: { verb: ['interact'], target: RIPE_ANNUAL, instrument: SICKLE },
    do: [...harvested({ prop: 'yield', of: 'target' }), log('You harvest {target}.', '你收割了{target}。'), { op: 'destroy', of: 'target' }, vfx('leaves', 'tileOf:target')],
  }),
  base({
    id: 'farm/harvest-perennial',
    on: 'interaction',
    when: { verb: ['interact'], target: RIPE_PERENNIAL, instrument: SICKLE },
    do: [...harvested({ prop: 'yield', of: 'target' }), log('You harvest {target}.', '你收割了{target}。'), ...regrow, vfx('leaves')],
  }),
  base({
    id: 'farm/pick',
    doc: 'Picking by hand: one of the crop and one seed.',
    on: 'interaction',
    when: { verb: ['take'], target: RIPE_ANNUAL },
    do: [...picked, log('You pick {target}.', '你摘下了{target}。'), { op: 'destroy', of: 'target' }, vfx('leaves', 'tileOf:target')],
  }),
  base({
    id: 'farm/pick-perennial',
    on: 'interaction',
    when: { verb: ['take'], target: RIPE_PERENNIAL },
    do: [...picked, log('You pick {target}.', '你摘下了{target}。'), ...regrow, vfx('leaves')],
  }),
  base({
    id: 'farm/dig-up',
    doc: 'A shovel lifts a plant and gives back its seed.',
    on: 'interaction',
    when: { verb: ['interact'], target: CROP, instrument: { tags: ['tool:shovel'] } },
    do: [log('You dig up {target}.', '你挖出了{target}。'), { op: 'transform', of: 'target', into: '@prop:seedType' }, vfx('dust')],
  }),
  base({
    id: 'farm/root',
    doc: 'A rooted sapling becomes a tree.',
    on: 'expire',
    when: { status: ['rooting'], target: { type: 'fixture/crop/oak/sapling' } },
    guard: NOBODY_THERE,
    do: [{ op: 'setTerrain', of: 'tileOf:target', terrain: 'tree' }, { op: 'destroy', of: 'target' }, vfx('leaves', 'tileOf:target')],
  }),
  base({
    id: 'farm/root-later',
    doc: 'Someone is standing on it: try again in an hour.',
    on: 'expire',
    priority: 1,
    when: { status: ['rooting'], target: { type: 'fixture/crop/oak/sapling' } },
    guard: { count: { role: 'target', in: 'tile', match: { kind: 'actor' }, cmp: { gte: 1 } } },
    do: [{ op: 'addStatus', of: 'target', status: 'rooting', duration: 600 }],
  }),
]

// ------------------------------------------------------------------ combat & elements

const HITS: Rule[] = [
  base({
    id: 'combat/damage',
    doc: 'Every hit on an actor deals damage (composes with any reaction).',
    on: 'hit',
    compose: true,
    when: { target: { kind: 'actor' } },
    do: [{ op: 'damage', of: 'target', amount: 'power' }, vfx('hit')],
  }),
  base({
    id: 'combat/break',
    doc: 'Breakable fixtures shatter and spill their contents (composes with any reaction).',
    on: 'hit',
    compose: true,
    when: { target: { kind: 'fixture', tags: ['breakable'] } },
    do: [{ op: 'dropContents', of: 'target' }, { op: 'destroy', of: 'target' }, vfx('poof', 'tileOf:target')],
  }),
  // fire
  base({
    id: 'element/fire-ignites',
    on: 'hit',
    when: { element: ['fire'], target: { tags: ['flammable'], notStatus: ['wet', 'frozen', 'burning'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'burning' }, vfx('fire_burst')],
  }),
  base({
    id: 'element/fire-burns-creature',
    on: 'hit',
    when: { element: ['fire'], target: { kind: 'actor', notTags: ['fiery'], notStatus: ['wet', 'frozen', 'burning'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'burning', duration: 25 }, vfx('fire_burst')],
  }),
  base({
    id: 'element/vaporize',
    doc: 'Fire on something wet flashes to steam: bonus damage, no burning.',
    on: 'hit',
    when: { element: ['fire'], target: { status: ['wet'], notStatus: ['frozen'] } },
    do: [{ op: 'removeStatus', of: 'target', status: 'wet' }, { op: 'damage', of: 'target', amount: 'power', mul: 0.8 }, vfx('steam')],
  }),
  base({
    id: 'element/melt',
    on: 'hit',
    when: { element: ['fire'], target: { status: ['frozen'] } },
    do: [{ op: 'removeStatus', of: 'target', status: 'frozen' }, { op: 'addStatus', of: 'target', status: 'wet' }, { op: 'damage', of: 'target', amount: 'power', mul: 0.5 }, vfx('steam')],
  }),
  base({
    id: 'element/thaw-ice',
    on: 'hit',
    when: { element: ['fire'], target: { type: 'tile/ice' } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'water' }, vfx('steam')],
  }),
  base({
    id: 'element/explode-oil',
    on: 'hit',
    when: { element: ['fire'], target: { status: ['oiled'], notStatus: ['wet', 'frozen', 'burning'], notTags: ['fiery', 'water'] } },
    do: [
      { op: 'removeStatus', of: 'target', status: 'oiled' },
      { op: 'addStatus', of: 'target', status: 'burning' },
      { op: 'damage', of: 'target', amount: 'power', mul: 1.5 },
      { op: 'spread', from: 'target', status: 'burning', radius: 1, chance: 0.7, filter: { tags: ['flammable'], notStatus: ['wet'] }, hit: { element: 'fire', power: 3 } },
      vfx('explosion'),
    ],
  }),
  base({
    id: 'element/fire-vs-fiery',
    on: 'hit',
    when: { element: ['fire'], target: { tags: ['fiery'], notStatus: ['wet', 'frozen'] } },
    do: [{ op: 'heal', of: 'target', amount: 2 }, vfx('fire_burst')],
  }),
  // water
  base({
    id: 'element/water-soaks',
    on: 'hit',
    when: { element: ['water'], target: { notStatus: ['burning'], notTags: ['water'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'wet' }, vfx('splash')],
  }),
  base({
    id: 'element/water-douses',
    on: 'hit',
    when: { element: ['water'], target: { status: ['burning'] } },
    do: [{ op: 'removeStatus', of: 'target', status: 'burning' }, { op: 'addStatus', of: 'target', status: 'wet' }, vfx('steam')],
  }),
  base({
    id: 'element/water-vs-fiery',
    on: 'hit',
    when: { element: ['water'], target: { tags: ['fiery'], notTags: ['water'], notStatus: ['burning'] } },
    do: [{ op: 'damage', of: 'target', amount: 'power', mul: 1.2 }, { op: 'addStatus', of: 'target', status: 'wet' }, vfx('steam')],
  }),
  // ice
  base({
    id: 'element/freeze',
    doc: 'Ice on something wet freezes it solid.',
    on: 'hit',
    when: { element: ['ice'], target: { status: ['wet'], notStatus: ['burning'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'frozen' }, vfx('frost')],
  }),
  base({
    id: 'element/ice-quench',
    on: 'hit',
    when: { element: ['ice'], target: { status: ['burning'] } },
    do: [{ op: 'removeStatus', of: 'target', status: 'burning' }, vfx('steam')],
  }),
  base({
    id: 'element/freeze-water',
    doc: 'Ice turns water into walkable ice, spreading a little.',
    on: 'hit',
    when: { element: ['ice'], target: { type: 'tile/water' } },
    do: [
      { op: 'setTerrain', of: 'target', terrain: 'ice' },
      { op: 'addStatus', of: 'target', status: 'chilled' },
      { op: 'spread', from: 'target', status: 'frozen', radius: 1, chance: 0.7, filter: { type: 'tile/water' } },
      vfx('frost'),
    ],
  }),
  base({
    id: 'element/ice-vs-icy',
    on: 'hit',
    when: { element: ['ice'], target: { tags: ['icy'], notStatus: ['wet', 'burning'] } },
    do: [{ op: 'heal', of: 'target', amount: 2 }, vfx('frost')],
  }),
  // lightning
  base({
    id: 'element/conduct',
    doc: 'Lightning on something wet arcs through everything wet nearby.',
    on: 'hit',
    when: { element: ['lightning'], target: { status: ['wet'] } },
    do: [
      { op: 'removeStatus', of: 'target', status: 'wet' },
      { op: 'addStatus', of: 'target', status: 'electrified' },
      { op: 'damage', of: 'target', amount: 'power', mul: 0.8 },
      { op: 'spread', from: 'target', status: 'electrified', radius: 2, filter: { status: ['wet'] }, hit: { element: 'lightning', power: 4 } },
      vfx('sparks'),
    ],
  }),
  base({
    id: 'element/conduct-water',
    on: 'hit',
    when: { element: ['lightning'], target: { kind: 'tile', tags: ['conductive'] } },
    do: [
      { op: 'addStatus', of: 'target', status: 'electrified' },
      { op: 'spread', from: 'target', status: 'electrified', radius: 2, chance: 0.9, filter: { tags: ['conductive'] } },
      { op: 'spread', from: 'target', status: 'electrified', radius: 2, filter: { status: ['wet'] }, hit: { element: 'lightning', power: 4 } },
      vfx('sparks'),
    ],
  }),
  base({
    id: 'element/shock',
    on: 'hit',
    when: { element: ['lightning'], target: { kind: 'actor', notStatus: ['wet'], notTags: ['charged'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'electrified' }, vfx('sparks')],
  }),
  base({
    id: 'element/shock-metal',
    on: 'hit',
    priority: 1,
    when: { element: ['lightning'], target: { kind: 'actor', tags: ['construct'], notStatus: ['wet'] } },
    do: [{ op: 'damage', of: 'target', amount: 'power', mul: 0.5 }, vfx('sparks')],
  }),
  base({
    id: 'element/lightning-ignites',
    on: 'hit',
    when: { element: ['lightning'], target: { kind: 'tile', tags: ['flammable', 'dry'], notStatus: ['wet', 'burning'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'burning' }, vfx('sparks')],
  }),
  // wind
  base({
    id: 'element/gust',
    on: 'hit',
    when: { element: ['wind'], target: { kind: 'actor' } },
    do: [{ op: 'push', of: 'target', away: 'actor', tiles: 2 }, vfx('gust')],
  }),
  base({
    id: 'element/fan-flames',
    doc: 'Wind on a fire spreads it.',
    on: 'hit',
    priority: 1,
    when: { element: ['wind'], target: { status: ['burning'] } },
    do: [{ op: 'spread', from: 'target', status: 'burning', radius: 2, chance: 0.5, filter: { tags: ['flammable'], notStatus: ['wet'] } }, vfx('gust')],
  }),
  // earth / blunt force
  base({
    id: 'element/shatter',
    doc: 'A heavy blow shatters a frozen target.',
    on: 'hit',
    when: { element: ['earth', 'none'], target: { kind: 'actor', status: ['frozen'] } },
    do: [{ op: 'removeStatus', of: 'target', status: 'frozen' }, { op: 'damage', of: 'target', amount: 'power', mul: 1.5 }, vfx('shatter')],
  }),
  base({
    id: 'element/earth-breaks',
    on: 'hit',
    when: { element: ['earth'], target: { kind: 'fixture', tags: ['fragile'] } },
    do: [{ op: 'dropContents', of: 'target' }, { op: 'destroy', of: 'target' }, vfx('shatter', 'tileOf:target')],
  }),
]

// ------------------------------------------------------------------ statuses over time

const STATUS: Rule[] = [
  base({
    id: 'fire/spread',
    doc: 'Fire creeps to flammable neighbours.',
    on: 'tick',
    when: { status: ['burning'], target: { kind: 'tile', tags: ['flammable'] } },
    do: [{ op: 'spread', from: 'target', status: 'burning', radius: 1, chance: 0.07, filter: { tags: ['flammable'], notStatus: ['wet', 'burning', 'frozen'] } }],
  }),
  base({
    id: 'fire/spread-dry',
    doc: 'Dry grass burns fast.',
    on: 'tick',
    when: { status: ['burning'], target: { kind: 'tile', tags: ['flammable', 'dry'] } },
    do: [{ op: 'spread', from: 'target', status: 'burning', radius: 1, chance: 0.3, filter: { tags: ['flammable'], notStatus: ['wet', 'burning', 'frozen'] } }],
  }),
  base({
    id: 'fire/spread-from-things',
    on: 'tick',
    when: { status: ['burning'], target: { kind: 'fixture', tags: ['flammable'] } },
    do: [{ op: 'spread', from: 'target', status: 'burning', radius: 1, chance: 0.1, filter: { tags: ['flammable'], notStatus: ['wet', 'burning', 'frozen'] } }],
  }),
  base({
    id: 'fire/spread-dry-things',
    doc: 'Dry things (hay, ripe wheat) burn as fast as dry grass.',
    on: 'tick',
    when: { status: ['burning'], target: { kind: 'fixture', tags: ['flammable', 'dry'] } },
    do: [{ op: 'spread', from: 'target', status: 'burning', radius: 1, chance: 0.3, filter: { tags: ['flammable'], notStatus: ['wet', 'burning', 'frozen'] } }],
  }),
  base({
    id: 'fire/scorch-actor',
    on: 'tick',
    when: { status: ['burning'], target: { kind: 'actor' } },
    guard: { chance: 0.5 },
    do: [{ op: 'damage', of: 'target', amount: 1, element: 'fire', pierce: true }],
  }),
  base({
    id: 'fire/burn-out-ground',
    on: 'expire',
    when: { status: ['burning'], target: { kind: 'tile', tags: ['flammable'] } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'ash' }, vfx('smoke')],
  }),
  base({
    id: 'fire/burn-out-tree',
    on: 'expire',
    when: { status: ['burning'], target: { kind: 'tile', tags: ['tree', 'flammable'] } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'charred_tree' }, vfx('smoke')],
  }),
  base({
    id: 'fire/burn-out-thing',
    on: 'expire',
    when: { status: ['burning'], target: { kind: 'fixture', tags: ['flammable'] } },
    do: [{ op: 'dropContents', of: 'target' }, { op: 'spawn', type: 'item/material/ash', at: 'tileOf:target' }, { op: 'destroy', of: 'target' }, vfx('smoke', 'tileOf:target')],
  }),
  base({
    id: 'fire/burn-out-item',
    on: 'expire',
    when: { status: ['burning'], target: { kind: 'item', tags: ['flammable'] } },
    do: [{ op: 'transform', of: 'target', into: 'item/material/ash' }, vfx('smoke', 'tileOf:target')],
  }),
  base({
    id: 'frost/freeze-water-tile',
    on: 'status',
    when: { status: ['frozen'], target: { type: 'tile/water' } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'ice' }, { op: 'removeStatus', of: 'target', status: 'frozen' }, { op: 'addStatus', of: 'target', status: 'chilled' }],
  }),
  base({
    id: 'frost/thaw',
    doc: 'Ice that magic made thaws back to water (whoever stands on it is put ashore, wet).',
    on: 'expire',
    when: { status: ['chilled'], target: { type: 'tile/ice' } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'water' }, vfx('splash')],
  }),
  base({
    id: 'fire/no-fire-on-water',
    doc: 'Burning never takes hold on water.',
    on: 'status',
    when: { status: ['burning'], target: { kind: 'tile', tags: ['water'] } },
    do: [{ op: 'removeStatus', of: 'target', status: 'burning' }, vfx('steam')],
  }),
]

// ------------------------------------------------------------------ stepping on things

const ENTER: Rule[] = [
  base({
    id: 'step/into-fire',
    on: 'enter',
    when: { target: { status: ['burning'] }, actor: { notStatus: ['wet'], notTags: ['fiery'] } },
    do: [{ op: 'addStatus', of: 'actor', status: 'burning', duration: 20 }],
  }),
  base({
    id: 'step/puddle',
    on: 'enter',
    when: { target: { status: ['wet'] }, actor: { notStatus: ['wet'] } },
    do: [{ op: 'addStatus', of: 'actor', status: 'wet', duration: 120 }],
  }),
  base({
    id: 'step/mud',
    on: 'enter',
    when: { target: { type: 'tile/mud' }, actor: { notStatus: ['wet'] } },
    do: [{ op: 'addStatus', of: 'actor', status: 'wet', duration: 80 }],
  }),
  base({
    id: 'step/live-wire',
    on: 'enter',
    when: { target: { status: ['electrified'] } },
    do: [{ op: 'hit', of: 'actor', element: 'lightning', power: 2, by: 'actor' }],
  }),
]

// ------------------------------------------------------------------ the world's own events
//
// The common cases of what creatures, people and content do by themselves. What these leave
// open is undefined: the modder answers it when it is salient (design.md §5.4–5.7).

const WORLD: Rule[] = [
  base({
    id: 'meet/fire-catches',
    doc: 'A fiery creature that comes up to something dry and flammable sets it alight.',
    on: 'meet',
    when: { actor: { tags: ['fiery'] }, target: { kind: 'fixture', tags: ['flammable', 'dry'], notStatus: ['wet', 'burning', 'frozen'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'burning' }, vfx('fire_burst')],
  }),
  base({
    id: 'witness/owner-take',
    doc: 'A person who sees you take what is theirs objects (and people talk).',
    on: 'witness',
    when: { about: ['take:owner'], actor: { type: 'actor/person' } },
    do: [say('actor', 'Hey — that is mine.', '喂——那是我的。'), { op: 'emote', who: 'actor', mood: 'angry' }, { op: 'topic', id: 'theft', days: 2 }],
  }),
  base({
    id: 'blocked/relight',
    doc: 'A person whose fire has gone out (and is not soaked) lights it again.',
    on: 'blocked',
    when: { actor: { type: 'actor/person' }, target: { tags: ['lightable'], notStatus: ['lit', 'wet'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'lit' }, vfx('fire_burst'), say('actor', 'Out again. Pass me the flint.', '又灭了。把火石递给我。')],
  }),
]

const DEFEAT: Rule[] = [
  base({
    id: 'combat/down',
    doc: 'At no health the essential (people, the player) collapse for a while.',
    on: 'defeat',
    when: { target: { kind: 'actor', tags: ['essential'] } },
    do: [{ op: 'addStatus', of: 'target', status: 'down' }, vfx('poof', 'tileOf:target'), log('{target} collapses.', '{target}倒下了。')],
  }),
  base({
    id: 'combat/come-to',
    doc: 'They come to with half their health.',
    on: 'expire',
    when: { status: ['down'], target: { kind: 'actor', tags: ['essential'] } },
    do: [{ op: 'setProp', of: 'target', key: 'hp', value: 1 }, { op: 'heal', of: 'target', amount: { prop: 'maxHp', of: 'target', mul: 0.5 } }, log('{target} comes to.', '{target}醒了过来。')],
  }),
  base({
    id: 'combat/defeat',
    on: 'defeat',
    when: { target: { kind: 'actor', notTags: ['essential'] } },
    do: [{ op: 'dropContents', of: 'target' }, vfx('poof', 'tileOf:target'), log('{target} is defeated.', '{target}被打倒了。'), { op: 'destroy', of: 'target' }],
  }),
]

export const BASE_RULES: Rule[] = [...TAKING, ...HANDS, ...USING, ...WOOD, ...BUILD, ...FARM, ...HITS, ...STATUS, ...ENTER, ...WORLD, ...DEFEAT]
