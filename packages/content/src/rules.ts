// The base rule library: every mechanic of the world as data. Object interactions,
// elemental reactions, environment physics and combat all live here, in one engine.
// Anything these rules do not cover is an *undefined interaction* for the Mod port.

import type { Effect, RoleRef, Rule, Selector } from '@lsw/engine'

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
    id: 'core/give',
    doc: 'Hand the held item to a person.',
    on: 'interaction',
    when: { verb: ['put'], target: { type: 'actor/person', player: false } },
    do: [
      { op: 'moveTo', of: 'instrument', to: 'target', into: 'contents' },
      say('target', 'For me? Thank you!', '给我的？谢谢你！'),
      log('You give {instrument} to {target}.', '你把{instrument}交给了{target}。'),
    ],
  }),
]

// ------------------------------------------------------------------ empty-handed interaction

const HANDS: Rule[] = [
  base({
    id: 'core/talk',
    on: 'interaction',
    when: { verb: ['interact'], target: { type: 'actor/person', player: false }, instrument: EMPTY_HAND },
    do: [{ op: 'say', who: 'target', text: '@line' }],
  }),
  base({
    id: 'core/examine-creature',
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
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'fixture' }, instrument: EMPTY_HAND },
    do: [log('It is {target}.', '这是{target}。')],
  }),
  base({
    id: 'core/examine-item',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'item' }, instrument: EMPTY_HAND },
    do: [log('{target}.', '{target}。')],
  }),
  base({
    id: 'core/examine-ground',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile' }, instrument: EMPTY_HAND },
    do: [log('{target}.', '{target}。')],
  }),
  base({
    id: 'core/examine-self',
    on: 'interaction',
    when: { verb: ['interact'], target: { player: true }, instrument: EMPTY_HAND },
    do: [say('actor', 'I feel fine.', '我感觉还行。')],
  }),
]

// ------------------------------------------------------------------ using held things

const USING: Rule[] = [
  base({
    id: 'core/eat',
    on: 'interaction',
    when: { verb: ['interact'], target: { player: true }, instrument: { tags: ['edible'] } },
    do: [{ op: 'heal', of: 'actor', amount: { prop: 'heal', of: 'instrument', add: 1 } }, vfx('heal', 'actor'), log('You eat {instrument}.', '你吃掉了{instrument}。'), { op: 'destroy', of: 'instrument' }],
  }),
  base({
    id: 'core/drink',
    on: 'interaction',
    when: { verb: ['interact'], target: { player: true }, instrument: { tags: ['drinkable'] } },
    do: [{ op: 'heal', of: 'actor', amount: { prop: 'heal', of: 'instrument', add: 1 } }, vfx('heal', 'actor'), log('You drink {instrument}.', '你喝下了{instrument}。'), { op: 'destroy', of: 'instrument' }],
  }),
  base({
    id: 'core/drink-water',
    on: 'interaction',
    priority: 1,
    when: { verb: ['interact'], target: { player: true }, instrument: { tags: ['liquid:water'] } },
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
    id: 'core/chop',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile', tags: ['tree', 'flammable'] }, instrument: { tags: ['tool:axe'] } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'stump' }, { op: 'spawn', type: 'item/material/log', at: 'tileOf:target' }, vfx('leaves'), log('Timber!', '树倒了！')],
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
    id: 'core/till',
    on: 'interaction',
    when: { verb: ['interact'], target: { kind: 'tile', tags: ['diggable'] }, instrument: { tags: ['tool:hoe'] } },
    do: [{ op: 'setTerrain', of: 'target', terrain: 'farmland' }, vfx('dust')],
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
    do: [{ op: 'setTerrain', of: 'target', terrain: 'ice' }, { op: 'removeStatus', of: 'target', status: 'frozen' }],
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

const DEFEAT: Rule[] = [
  base({
    id: 'combat/defeat',
    on: 'defeat',
    when: { target: { kind: 'actor' } },
    do: [{ op: 'dropContents', of: 'target' }, vfx('poof', 'tileOf:target'), log('{target} is defeated.', '{target}被打倒了。'), { op: 'destroy', of: 'target' }],
  }),
]

export const BASE_RULES: Rule[] = [...TAKING, ...HANDS, ...USING, ...HITS, ...STATUS, ...ENTER, ...DEFEAT]
