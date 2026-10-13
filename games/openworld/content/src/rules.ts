// The base rule library (design.md §5.6–5.9): every mechanic of the world as the nature of a
// host. A rule says what a class of thing does when an event happens to it; it writes only that
// thing, and affects others by emitting impulses they answer for themselves. The root rules make
// resolution total: deliberate acts and impulses are undefined at the root (the AI answers them),
// contact, time and sight are no change, elements follow physics. Anything these rules leave
// undefined is the Mod port's.

import { HOMESTEAD_RULES } from './homestead.ts'
import { LIFE_RULES } from './life.ts'
import { CH1 } from './chapter1.ts'
import { VILLAGE_SHOP_RULES } from './village.ts'
import { PERSON_NEWS, SOCIAL_RULES } from './social.ts'
import { FAITH_RULES } from './faith.ts'
import { type Amount, type Cond, type Effect, type Text, type EmitTo, type Impulse, type PropValue, type RoleName, type RoleRef, type Rule, type Selector, type Tree } from '@openworld/engine'
import { HUNGRY_BELOW } from '@openworld/modules'

const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })
const L = (en: string, zh: string) => ({ en, zh })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: L(en, zh) })
const say = (en: string, zh: string, who?: RoleName): Effect => ({ op: 'say', text: L(en, zh), ...(who && { who }) })
const vfx = (fx: string, at?: RoleRef): Effect => ({ op: 'vfx', fx, ...(at && { at }) })
const emit = (impulse: Impulse, to: EmitTo, params?: Record<string, PropValue | Amount | { typeOf: RoleName } | { idOf: RoleName }>, extra: Partial<Extract<Effect, { op: 'emit' }>> = {}): Effect => ({ op: 'emit', impulse, to, ...(params && { params }), ...extra })
const add = (status: string, duration?: number): Effect => ({ op: 'addStatus', status, ...(duration && { duration }) })
const remove = (status: string): Effect => ({ op: 'removeStatus', status })
const DO = (...effects: Effect[]): Tree => ({ do: effects })
const ASK = (confirm: { en: string; zh: string }, ...effects: Effect[]): Tree => ({ do: effects, confirm })
/** An answer that says what the input ending at it does ("Eat {instrument}", "Feed {instrument} to {target}"). */
const AS = (label: Text, leaf: Tree): Tree => (typeof leaf === 'object' && 'do' in leaf ? { ...leaf, label } : leaf)
const NOTHING: Tree = { do: [] }
const IF = (cond: Cond, then: Tree, otherwise?: Tree): Tree => ({ if: cond, then, ...(otherwise !== undefined && { else: otherwise }) })
const HOLE = (...dflt: Effect[]): Tree => ({ undefined: true, ...(dflt.length && { default: dflt }) })
const param = (key: string, value: PropValue): Cond => ({ param: { key, cmp: value } })
const is = (role: RoleName, sel: Selector): Cond => ({ is: { role, sel } })
const has = (role: RoleName, status: string): Cond => ({ has: { role, status } })
const tag = (role: RoleName, t: string): Cond => ({ has: { role, tag: t } })
const not = (c: Cond): Cond => ({ not: c })
const all = (...c: Cond[]): Cond => ({ all: c })
const any = (...c: Cond[]): Cond => ({ any: c })
const taken = (into: 'hand' | 'contents' | 'tile'): Effect => emit('taken', 'item', { into }, { other: 'host' })
const POWER: Amount = { param: 'power' }
const ELEMENT = { param: 'element' }
/** What a blow carries beyond its power, passed on to the strike (combat.ts): a bleed it opens, health it draws back, a relic's affliction. */
const WOUND = { bleed: { param: 'bleed' }, drain: { param: 'drain' }, afflict: { param: 'afflict' }, afflictFor: { param: 'afflictFor' } }
/** What burning takes from a thing with durability (nothing from one without: it cannot break). */
const WEAR: Effect = { op: 'hurt', amount: 1, element: 'fire', pierce: true }
const spread = (chance: number): Effect => emit('element', { area: { radius: 1 } }, { element: 'fire', power: 1 }, { chance, filter: { tags: ['flammable'], notStatus: ['wet', 'burning', 'frozen'] } })

// ------------------------------------------------------------------ the roots: resolution is total

/** A place of the overworld (world-model.md §5.6): what is done to it from there is out of reach. */
const SITE: Selector = { type: 'site' }
const TOO_FAR = log('Too far to reach: go in first (E).', '够不着：先进去（E）。')

const ROOTS: Rule[] = [
  rule({
    id: 'core/use',
    doc: 'Using a thing on something its nature says nothing about: the bare body used on anything is a blow (Minecraft\'s fist), and so is anything swung; on a place of the overworld it is out of reach; on a creature it is held out to it (the creature answers: offered, design.md §5.2). On anything else it is the player\'s experiment: undefined (the AI answers).',
    on: 'act/use',
    tree: IF(
      { none: 'instrument' },
      DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'blunt', ...WOUND })),
      IF(
        is('target', SITE),
        AS(L('Out of reach — go in first (E)', '够不着——先进去（E）'), DO(TOO_FAR)),
        IF(
          param('attack', true),
          AS(L('Strike {target} with {instrument}', '用{instrument}打{target}'), DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'blunt', ...WOUND }))),
          IF(
            all(is('target', { type: 'actor/creature' }), not({ same: ['actor', 'target'] })),
            AS(L('Hold out {instrument} to {target}', '把{instrument}递给{target}'), DO(emit('offered', 'target', undefined, { item: 'host' }))),
            HOLE(log('Nothing happens.', '什么也没有发生。')),
          ),
        ),
      ),
    ),
  }),
  rule({
    id: 'core/put',
    doc: 'Putting the host somewhere (physics: never asked): a person is handed it, anything else that lives does not take what is put on it, anything else receives it.',
    on: 'act/put',
    tree: IF(
      is('target', { type: 'actor/person' }),
      AS(L('Give {instrument} to {target}', '把{instrument}交给{target}'), DO(emit('offered', 'target', undefined, { item: 'host' }))),
      IF(is('target', { type: 'actor' }), DO(log('{target} does not take it.', '{target}不收。')), DO(emit('receive', 'target', undefined, { item: 'host' }))),
    ),
  }),
  rule({
    id: 'core/put-bound',
    doc: 'A bound thing (the Oath-Thorn: the way into a place one carries) does not leave its bearer\'s hand for another\'s; put anywhere else, it is put as anything is.',
    host: { tags: ['bound'] },
    on: 'act/put',
    tree: IF(is('target', { type: 'actor/person' }), DO(say('This stays with me.', '这个得留在我身上。', 'actor')), 'inherit'),
  }),
  rule({ id: 'core/take', doc: 'Taking the target with the hands: it is taken (and answers how).', on: 'act/take', tree: DO(emit('taken', 'target', { into: { param: 'into' }, quiet: { param: 'quiet' } }, { other: 'actor' })) }),
  rule({ id: 'core/hands', doc: 'A bare hand on the target: it is handled (and answers how); what the hand asks of it rides along — a companion\'s boon, what is said to a person (a talk verb, its choice, the thing it is about; the offer or topic of a quest, docs/quests.md).', on: 'act/hands', tree: DO(emit('handle', 'target', { boon: { param: 'boon' }, say: { param: 'say' }, choice: { param: 'choice' }, item: { param: 'item' }, quest: { param: 'quest' }, topic: { param: 'topic' } })) }),
  rule({ id: 'core/move', doc: 'Moving: one step, or to a place.', on: 'act/move', tree: DO({ op: 'step' }) }),
  rule({ id: 'core/craft', doc: 'Crafting what the recipe makes from what is carried.', on: 'act/craft', tree: DO({ op: 'craft' }) }),
  rule({ id: 'core/learn', doc: 'Learning what the act names: a skill (with skill points), a profession (at a trainer).', on: 'act/learn', tree: DO({ op: 'learn' }) }),
  rule({ id: 'core/impulse', doc: 'What is done to a thing is undefined unless its nature says (the AI answers).', on: 'impulse', tree: HOLE() }),
  rule({
    id: 'core/strike',
    doc: 'A blow on something with no answer of its own: what has durability loses it (as well as the instrument works on what it is made of; nothing if the instrument is softer — too hard), and the element the blow carries reaches it; a plain blow on what cannot break is undefined.',
    on: 'impulse/strike',
    tree: IF(
      { prop: { role: 'host', key: 'maxHp', cmp: { gt: 0 } } },
      IF({ param: { key: 'element', cmp: { ne: '' } } }, DO({ op: 'hurt', amount: POWER, blow: true }, emit('element', 'host', { element: ELEMENT, power: POWER })), DO({ op: 'hurt', amount: POWER, blow: true })),
      IF({ param: { key: 'element', cmp: { ne: '' } } }, DO(emit('element', 'host', { element: ELEMENT, power: POWER })), HOLE()),
    ),
  }),
  rule({
    id: 'core/handle',
    doc: 'A bare hand on something with no answer of its own: undefined (it is looked at meanwhile).',
    on: 'impulse/handle',
    tree: HOLE(log('It is {host}.', '这是{host}。')),
  }),
  rule({
    id: 'core/taken',
    doc: 'A portable thing taken moves into the taker\'s hand (or bag, or onto the ground); anything else stays where it is (taking is physics: never asked).',
    on: 'impulse/taken',
    tree: IF(
      is('host', { tags: ['portable'] }),
      IF(
        param('into', 'contents'),
        DO({ op: 'move', to: 'other', into: 'contents' }),
        IF(param('into', 'tile'), DO({ op: 'move', to: 'other', into: 'tile' }), IF(param('quiet', true), DO({ op: 'move', to: 'other', into: 'hand' }), AS(L('Take {target}', '拿起{target}'), DO({ op: 'move', to: 'other', into: 'hand' }, log('You take {host}.', '你拿起了{host}。'))))),
      ),
      DO(log('That stays where it is.', '这个拿不走。')),
    ),
  }),
  // putting is physics (never asked): what has room takes the thing, what has none refuses; using a thing on something is where the AI answers
  rule({ id: 'core/receive', doc: 'Something put on a thing with no answer of its own: there is no room there.', on: 'impulse/receive', tree: DO(log('There is no room there.', '那里放不下。')) }),
  // what one makes of a thing held out to one (a rope used on a slime, armour put on someone) is one's own nature: undefined unless it says
  rule({ id: 'core/offered', doc: 'Something held out to one with no answer of its own: undefined (the AI answers).', on: 'impulse/offered', tree: HOLE() }),
  rule({
    id: 'core/restore',
    doc: 'Health or hunger given back; or a night\'s sleep (until it is time to rise, giving back as the room says); a warm spring\'s mending (health, and one is soaking while it goes on).',
    on: 'impulse/restore',
    tree: IF(param('which', 'sleep'), DO({ op: 'sleep' }), IF(param('which', 'spring'), DO({ op: 'heal', amount: { param: 'amount' } }, add('soaking')), IF(param('which', 'hunger'), DO({ op: 'feed', amount: { param: 'amount' } }), DO({ op: 'heal', amount: { param: 'amount' } })))),
  }),
  rule({ id: 'core/notify', doc: 'News: noted, nothing changes, unless the host says.', on: 'impulse/notify', tree: NOTHING }),
  rule({
    id: 'core/coat',
    doc: 'Oil coats whatever is not water.',
    on: 'impulse/coat',
    tree: IF(all(param('substance', 'oil'), not(tag('host', 'water'))), DO(add('oiled'), vfx('splash')), HOLE()),
  }),
  rule({
    id: 'core/push',
    doc: 'A pushed actor steps (or gets out of where it cannot be); a pushed thing is undefined.',
    on: 'impulse/push',
    tree: IF(is('host', { type: 'actor' }), IF(param('ashore', true), DO({ op: 'ashore' }), DO({ op: 'step' })), HOLE()),
  }),
  rule({
    id: 'core/element',
    doc: 'Elements follow physics: fire burns the flammable and lights the lightable, water wets and douses, ice freezes the wet, lightning charges the wet and the conductive; otherwise no change.',
    on: 'impulse/element',
    tree: IF(
      param('element', 'fire'),
      IF(
        all(has('host', 'oiled'), not(has('host', 'wet')), not(has('host', 'frozen')), not(has('host', 'burning')), not(tag('host', 'water'))),
        DO(remove('oiled'), add('burning'), emit('element', { area: { radius: 1 } }, { element: 'fire', power: 3 }, { chance: 0.7, filter: { tags: ['flammable'], notStatus: ['wet'] } }), vfx('explosion')),
        IF(
          has('host', 'wet'),
          DO(remove('wet'), vfx('steam')),
          IF(
            has('host', 'frozen'),
            DO(remove('frozen'), add('wet'), vfx('steam')),
            IF(
              tag('host', 'lightable'),
              // a lightable thing takes fire as its flame (a lantern post alight does not catch as well)
              IF(not(has('host', 'lit')), DO(add('lit'), vfx('fire_burst')), NOTHING),
              IF(all(tag('host', 'flammable'), not(has('host', 'burning'))), DO(add('burning'), vfx('fire_burst')), NOTHING),
            ),
          ),
        ),
      ),
      IF(
        param('element', 'water'),
        IF(
          has('host', 'burning'),
          DO(remove('burning'), add('wet'), vfx('steam')),
          IF(has('host', 'lit'), DO(remove('lit'), vfx('steam')), IF(tag('host', 'water'), NOTHING, DO(add('wet'), vfx('splash')))),
        ),
        IF(
          param('element', 'ice'),
          IF(has('host', 'burning'), DO(remove('burning'), vfx('steam')), IF(all(has('host', 'wet'), not(has('host', 'thawed'))), DO(add('frozen'), add('thawed'), vfx('frost')), NOTHING)),
          IF(
            param('element', 'lightning'),
            IF(
              has('host', 'wet'),
              DO(remove('wet'), add('electrified'), emit('element', { area: { radius: 2 } }, { element: 'lightning', power: 4 }, { chance: 0.9, filter: { status: ['wet'] } }), vfx('sparks')),
              IF(
                tag('host', 'conductive'),
                DO(add('electrified'), vfx('sparks')),
                IF(all(tag('host', 'flammable'), tag('host', 'dry'), not(has('host', 'burning'))), DO(add('burning'), vfx('sparks')), NOTHING),
              ),
            ),
            IF(all(param('element', 'wind'), has('host', 'burning')), DO(emit('element', { area: { radius: 2 } }, { element: 'fire', power: 1 }, { chance: 0.5, filter: { tags: ['flammable'], notStatus: ['wet'] } }), vfx('gust')), NOTHING),
          ),
        ),
      ),
    ),
  }),
  rule({ id: 'core/contact', doc: 'Touching is no change unless the host says.', on: 'contact', tree: NOTHING }),
  rule({
    id: 'core/touch',
    doc: 'Physics of touch: what burns burns what touches it (stepping into fire, a burning thing put down on straw); charged ground shocks what stands on it; wet ground wets it; otherwise no change.',
    on: 'contact/begin',
    tree: IF(
      has('host', 'burning'),
      DO(emit('element', 'other', { element: 'fire', power: 2 })),
      IF(
        all(param('how', 'under'), has('host', 'electrified')),
        DO(emit('element', 'other', { element: 'lightning', power: 2 })),
        IF(all(param('how', 'under'), is('host', { type: 'tile' }), any(has('host', 'wet'), tag('host', 'wet-ground'))), DO(emit('element', 'other', { element: 'water', power: 1 })), NOTHING),
      ),
    ),
  }),
  rule({ id: 'core/bump', doc: 'Bumping is no change unless the host says.', on: 'bump', tree: NOTHING }),
  rule({ id: 'core/time', doc: 'Time passing is no change unless the host says.', on: 'time', tree: NOTHING }),
  rule({
    id: 'core/stage',
    doc: 'A clock running out: a thing in a stage whose clock it is becomes what its stage says next (a stump a tree, a sprout a young plant, thin ice water; a hen lays) — world-model.md §6.5; for anything else, no change.',
    on: 'time/timer',
    tree: DO({ op: 'grow' }),
  }),
  rule({ id: 'core/threshold', doc: 'Gaining or losing a status, crossing a line: no change unless the host says.', on: 'threshold', tree: NOTHING }),
  rule({
    id: 'core/fall',
    doc: 'What stood on something and stands on nothing now falls to the first floor below (physics: defined, never asked; nothing happens while a floor is there).',
    on: 'contact/end',
    tree: IF(param('how', 'on'), DO({ op: 'fall' }), NOTHING),
  }),
  rule({
    id: 'core/break',
    doc: 'Something with durability at none (world-model.md §6.3): an essential one goes down (and comes to); one made of something breaks down into it (its makeup × the recovery rate) and spills what it holds; anything else is undefined (meanwhile it is gone).',
    on: 'threshold/cross',
    tree: IF(
      param('name', 'broken'),
      IF(
        tag('host', 'essential'),
        DO(add('down'), vfx('poof', 'tileOf:host'), log('{host} collapses.', '{host}倒下了。')),
        IF({ makeup: 'host' }, DO(vfx('dust', 'tileOf:host'), log('{host} breaks.', '{host}碎了。'), { op: 'breakdown' }), HOLE({ op: 'dropContents' }, { op: 'destroy' })),
      ),
      NOTHING,
    ),
  }),
  rule({ id: 'core/seen', doc: 'Seeing an act is no change unless the seer says.', on: 'seen', tree: NOTHING }),
  rule({ id: 'core/stuck', doc: 'A person who cannot go on: undefined (the AI answers); meanwhile they wait.', on: 'stuck', tree: HOLE() }),
  rule({ id: 'core/broken', doc: 'Content the story must keep playable broke: undefined (the AI answers); meanwhile its authored fallback runs.', on: 'broken', tree: HOLE({ op: 'fallback' }) }),
]

// ------------------------------------------------------------------ actors: bodies

const PERSON: Selector = { type: 'actor/person' }
const ACTOR: Selector = { type: 'actor' }
const ESSENTIAL: Selector = { type: 'actor', tags: ['essential'] }
/** What one carried, bundled where one fell (body/rise). */
const BUNDLE = 'item/misc/bundle'

const BODIES: Rule[] = [
  rule({
    id: 'body/rise',
    doc: 'One who has fallen, told by the story to rise (the death screen\'s choice): one gets up, whole — leaving what one carried bundled where one fell (one\'s coin loose beside it), when one rises at home (but what one wears, the weapon in one\'s hand and what is important stay with one). Told of a home (a bed slept in, a waypoint woken), one keeps it.',
    host: ESSENTIAL,
    on: 'impulse/notify',
    tree: IF(
      param('what', 'respawn'),
      IF(
        param('drop', true),
        DO({ op: 'dropContents', keepWorn: true, keep: ['important'], bundle: BUNDLE, loose: ['currency'] }, remove('down'), { op: 'setProp', key: 'hp', value: 1 }, { op: 'heal', amount: { prop: 'maxHp', of: 'host' } }, log('You rise again. What you carried lies bundled where you fell, your coin scattered beside it; what you wore and what matters most are still with you.', '你重新站了起来。身上的东西打成一包留在了倒下的地方，钱撒在旁边；穿戴的装备和重要物品还在身上。')),
        DO(remove('down'), { op: 'setProp', key: 'hp', value: 1 }, { op: 'heal', amount: { prop: 'maxHp', of: 'host' } }, log('You get up again.', '你重新站了起来。')),
      ),
      IF(param('what', 'home'), DO({ op: 'setProp', key: 'home', value: { param: 'value' } }), 'inherit'),
    ),
  }),
  rule({
    id: 'body/belongings',
    label: L('Gather {target}', '收回{target}'),
    doc: 'One\'s belongings, bundled where one fell: a hand on the bundle, or taking it, and all of it comes back to whoever opens it; the bundle is gone.',
    host: { type: BUNDLE },
    on: 'impulse/handle',
    tree: DO({ op: 'dropContents', to: 'actor' }, log('You gather up your belongings.', '你收回了自己的东西。'), { op: 'destroy' }),
  }),
  rule({
    id: 'body/belongings-taken',
    doc: 'One\'s belongings, bundled where one fell, taken (F): opened as by a hand — all of it comes back to the taker; the bundle is gone. An empty one is taken as anything is.',
    host: { type: BUNDLE },
    on: 'impulse/taken',
    tree: IF({ count: { role: 'host', in: 'contents', cmp: { gt: 0 } } }, DO({ op: 'dropContents', to: 'other' }, log('You gather up your belongings.', '你收回了自己的东西。'), { op: 'destroy' }), 'inherit'),
  }),
  rule({
    id: 'body/wear',
    doc: 'Something one wears, used on one (one\'s own, or another\'s held out): one puts it on (what was in its slot comes off), or takes it off if it is on (world-model.md §6.8).',
    host: ACTOR,
    on: 'impulse/offered',
    tree: IF(all(param('wear', true), is('item', { tags: ['wearable'] })), IF({ same: ['host', 'actor'] }, DO({ op: 'wear' }), DO(taken('contents'), { op: 'wear' })), 'inherit'),
  }),
  rule({
    id: 'combat/struck',
    doc: 'An actor struck takes the blow as anything with durability does — as well as what struck works on what it is made of (world-model.md §6.1, §6.8; a frozen one shatters under a blunt or earthen blow); the one who struck becomes its foe; the element of the blow reaches it.',
    host: ACTOR,
    on: 'impulse/strike',
    tree: IF(
      all(has('host', 'frozen'), any(param('edge', 'blunt'), param('element', 'earth'))),
      DO(remove('frozen'), { op: 'hurt', amount: { param: 'power', mul: 1.5 }, blow: true }, { op: 'foe' }, vfx('shatter')),
      IF(
        { param: { key: 'element', cmp: { ne: '' } } },
        DO({ op: 'hurt', amount: POWER, blow: true }, { op: 'foe' }, vfx('hit'), emit('element', 'host', { element: ELEMENT, power: POWER })),
        DO({ op: 'hurt', amount: POWER, blow: true }, { op: 'foe' }, vfx('hit')),
      ),
    ),
  }),
  rule({
    id: 'element/actor',
    doc: 'Elements on a body: fire sets it burning (steam off the wet, thaw off the frozen, hurting either way); the fiery and the icy are healed by their own element and hurt by its opposite; lightning arcs through the wet; wind blows it away.',
    host: ACTOR,
    on: 'impulse/element',
    tree: IF(
      param('element', 'fire'),
      IF(
        // oil on a body goes up as oil does anywhere (physics, at the root)
        all(has('host', 'oiled'), not(has('host', 'wet')), not(has('host', 'frozen')), not(has('host', 'burning'))),
        'inherit',
        IF(
          tag('host', 'fiery'),
          DO({ op: 'heal', amount: 2 }, vfx('fire_burst')),
          IF(
            has('host', 'wet'),
            DO(remove('wet'), { op: 'hurt', amount: { param: 'power', mul: 0.8 } }, vfx('steam')),
            IF(has('host', 'frozen'), DO(remove('frozen'), add('wet'), { op: 'hurt', amount: { param: 'power', mul: 0.5 } }, vfx('steam')), IF(has('host', 'burning'), NOTHING, DO(add('burning', 25), vfx('fire_burst')))),
          ),
        ),
      ),
      IF(
        param('element', 'water'),
        IF(tag('host', 'fiery'), IF({ param: { key: 'power', cmp: { gt: 0 } } }, DO({ op: 'hurt', amount: { param: 'power', mul: 1.2 } }, add('wet'), vfx('steam')), DO(add('wet'), vfx('steam'))), 'inherit'),
        IF(
          param('element', 'ice'),
          IF(tag('host', 'icy'), DO({ op: 'heal', amount: 2 }, vfx('frost')), 'inherit'),
          IF(
            param('element', 'lightning'),
            IF(
              has('host', 'wet'),
              DO(remove('wet'), add('electrified'), { op: 'hurt', amount: { param: 'power', mul: 0.8 } }, emit('element', { area: { radius: 2 } }, { element: 'lightning', power: 4 }, { chance: 0.9, filter: { status: ['wet'] } }), vfx('sparks')),
              IF(tag('host', 'charged'), NOTHING, IF(tag('host', 'construct'), DO({ op: 'hurt', amount: { param: 'power', mul: 0.5 } }, vfx('sparks')), DO(add('electrified'), vfx('sparks')))),
            ),
            IF(param('element', 'wind'), DO({ op: 'step', away: 'source', tiles: 2 }, vfx('gust')), 'inherit'),
          ),
        ),
      ),
    ),
  }),
  rule({
    id: 'combat/defeat',
    doc: 'At no health: the essential (people, the player) go down for a while (as anything essential); the rest break down into what they are made of and spill what they carried (lying still: taken with F), and the one who struck learns from it (world-model.md §6.8, D9).',
    host: ACTOR,
    on: 'threshold/cross',
    tree: IF(
      param('name', 'broken'),
      IF(
        tag('host', 'essential'),
        'inherit',
        DO(
          // the striker learns from it, and may find the kind's own piece (trophies.ts) in their bag
          emit('notify', 'actor', { what: 'defeat', xp: { prop: 'maxHp', of: 'host' }, trophy: { prop: 'trophy', of: 'host' }, trophyChance: { prop: 'trophyChance', of: 'host' } }),
          // the story hears what fell, and to whom (quests count it)
          vfx('poof', 'tileOf:host'),
          log('{host} is defeated.', '{host}被打倒了。'),
          { op: 'breakdown', still: true },
        ),
      ),
    ),
  }),
  rule({
    id: 'combat/come-to',
    doc: 'The essential come to with half their health.',
    host: ESSENTIAL,
    on: 'time/timer',
    tree: IF(param('status', 'down'), DO({ op: 'setProp', key: 'hp', value: 1 }, { op: 'heal', amount: { prop: 'maxHp', of: 'host', mul: 0.5 } }, log('{host} comes to.', '{host}醒了过来。'))),
  }),
  rule({
    id: 'combat/learn',
    doc: 'Whoever defeated a foe gains experience as much as its full health, and may find the foe kind\'s own piece of gear in their bag (a chance each felling, sure at the fiftieth: the trophy primitive) (and is rewarded with experience when a quest is handed in; told of a deed\'s weight, what = karma or faith, its karma or faith moves by delta). A mage felling a foe with a staff mends 3 (Arcane Recovery); an assassin felling one with a dagger mends a tenth of their health (Shadow Recovery): a profession\'s talents answer its own weapons only (profession.ts).',
    host: ACTOR,
    on: 'impulse/notify',
    tree: IF(
      param('what', 'defeat'),
      IF(
        all(tag('host', 'skill:arcane-recovery'), is('instrument', { tags: ['profession:mage'] })),
        DO({ op: 'gainXp', amount: { param: 'xp' } }, { op: 'trophy' }, { op: 'heal', amount: 3 }),
        IF(
          all(tag('host', 'skill:shadow-recovery'), is('instrument', { tags: ['profession:assassin'] })),
          DO({ op: 'gainXp', amount: { param: 'xp' } }, { op: 'trophy' }, { op: 'heal', amount: { prop: 'maxHp', of: 'host', mul: 0.1 } }),
          DO({ op: 'gainXp', amount: { param: 'xp' } }, { op: 'trophy' }),
        ),
      ),
      IF(
        param('what', 'reward'),
        DO({ op: 'gainXp', amount: { param: 'xp' } }),
        // a deed's weight on one's good and evil, or on one's faith (a quest's reward, a prayer, words against the gods)
        IF(param('what', 'karma'), DO({ op: 'moral', key: 'karma', delta: { param: 'delta' } }), IF(param('what', 'faith'), DO({ op: 'moral', key: 'faith', delta: { param: 'delta' } }), 'inherit')),
      ),
    ),
  }),
  rule({
    id: 'body/bleed',
    doc: 'A bleeding body loses 1 health a second, through any defence (Hemorrhage\'s wound): in the name of whoever opened it.',
    host: { type: 'actor', status: ['bleeding'] },
    on: 'time/period',
    tree: IF(param('status', 'bleeding'), DO({ op: 'hurt', amount: 1, pierce: true }), 'inherit'),
  }),
  rule({
    id: 'body/adrenaline',
    doc: 'Adrenaline (the skill): while the rush lasts the body mends 1 a second.',
    host: { type: 'actor', status: ['adrenaline'], tags: ['skill:adrenaline'] },
    on: 'time/period',
    tree: IF(param('status', 'adrenaline'), DO({ op: 'heal', amount: 1 }), 'inherit'),
  }),
  rule({
    id: 'train/dummy',
    label: L('Strike {target}', '打{target}'),
    doc: 'A training dummy knocked down (no health left) stands up again, whole, and the story hears of it (the tutorial\'s blow lesson waits on it).',
    host: { type: 'fixture/dummy' },
    on: 'threshold/cross',
    tree: IF(param('name', 'broken'), DO(vfx('poof', 'tileOf:host'), { op: 'heal', amount: 99 }, emit('notify', 'story', { what: 'dummy' }), log('{host} topples, and rocks upright again.', '{host}被打倒了，又晃晃悠悠地立了起来。')), 'inherit'),
  }),
  rule({
    id: 'body/hungry',
    doc: 'Under six tenths of a full food bar one is hungry (hunger falls slowly then: a body goes days without food); fed over it again, one is not.',
    host: { type: 'actor', props: { maxHunger: { gt: 0 } } },
    on: 'threshold/cross',
    tree: IF(param('name', 'hungry'), IF(param('way', 'up'), DO({ op: 'removeStatus', status: 'hungry' }), DO({ op: 'addStatus', status: 'hungry' })), 'inherit'),
  }),
  rule({
    id: 'body/hunger',
    doc: 'Hunger (Minecraft\'s food bar): it drains — fast while fed, slowly once hungry; well fed (90 % and up) the body heals, starving (0) it loses health, but never the last point.',
    host: { type: 'actor', props: { maxHunger: { gt: 0 } }, notStatus: ['down'] },
    on: 'time/period',
    tree: IF(
      param('name', 'hunger'),
      // under the line without the status (a save from before it, a thing made hungry): it is put right
      IF(
        all({ prop: { role: 'host', key: 'hunger', bounds: { lt: { prop: 'maxHunger', of: 'host', mul: HUNGRY_BELOW } } } }, not(has('host', 'hungry'))),
        DO({ op: 'addProp', key: 'hunger', delta: -1, min: 0 }, { op: 'addStatus', status: 'hungry' }),
        DO({ op: 'addProp', key: 'hunger', delta: -1, min: 0 }),
      ),
      IF(
        param('name', 'vitals'),
        IF(
          all(
            // well fed: 90 % and up — from half with Second Wind, a quarter with Regeneration (the skills)
            any(
              { prop: { role: 'host', key: 'hunger', bounds: { gte: { prop: 'maxHunger', of: 'host', mul: 0.9 } } } },
              all(tag('host', 'skill:second-wind'), { prop: { role: 'host', key: 'hunger', bounds: { gte: { prop: 'maxHunger', of: 'host', mul: 0.5 } } } }),
              all(tag('host', 'skill:regeneration'), { prop: { role: 'host', key: 'hunger', bounds: { gte: { prop: 'maxHunger', of: 'host', mul: 0.25 } } } }),
            ),
            { prop: { role: 'host', key: 'hp', bounds: { lt: { prop: 'maxHp', of: 'host' } } } },
          ),
          DO({ op: 'heal', amount: 1 }),
          IF(all({ prop: { role: 'host', key: 'hunger', cmp: { lte: 0 } } }, { prop: { role: 'host', key: 'hp', cmp: { gt: 1 } } }), DO({ op: 'hurt', amount: 1, pierce: true }), NOTHING),
        ),
      ),
    ),
  }),
  rule({
    id: 'body/stage',
    doc: 'The story tells a person where it stands (the player\'s stage): they keep it. Told to step into a pocket place (what = pocket: the Oath-Thorn\'s Held Ground), they go — or, in it, come back out. Told to mend (what = mend: the Mend skill), they mend by as much. Told to pay, to hand something over, to give back what is not theirs, to go to the cells; told the news, reminded to chat, told to calm down, called to help (docs/npc-sandbox.md).',
    host: PERSON,
    on: 'impulse/notify',
    tree: IF(
      param('what', 'pocket'),
      DO({ op: 'pocket' }),
      IF(
      // told of a skill book read (use/read-skillbook): one learns from it, and it is used up — or one says why not
      param('what', 'read'),
      DO({ op: 'learn', book: true }),
      IF(
      // told to mend (the Mend skill, actives.ts): one mends by as much
      param('what', 'mend'),
      DO({ op: 'heal', amount: { param: 'amount' } }, vfx('heal')),
      PERSON_NEWS('inherit'),
    ))),
  }),
]

// ------------------------------------------------------------------ people: hands, gifts, sight, days

const PEOPLE: Rule[] = [
  rule({
    id: 'people/accept',
    label: L('Give {instrument} to {target}', '把{instrument}送给{target}'),
    doc: 'A person handed a thing takes it: their own brought back, they let go what they held against the one who took it; a gift, they warm to the giver as its worth says, and say what they make of it (one put on them is theirs to wear).',
    host: PERSON,
    on: 'impulse/offered',
    tree: IF(
      any({ same: ['host', 'actor'] }, param('wear', true)),
      'inherit',
      IF(
        { owns: ['host', 'item'] },
        AS(L('Give {instrument} back to {target}', '把{instrument}还给{target}'), DO(taken('contents'), { op: 'settle' }, { op: 'regard', delta: 5 }, say('…Thank you for bringing it back.', '……谢谢你把它还回来。'), { op: 'news', kind: 'give' })),
        DO(taken('contents'), { op: 'regard', delta: { prop: 'value', of: 'item', mul: 0.3, add: 2 } }, { op: 'say', text: '@given' }, { op: 'news', kind: 'give' }),
      ),
    ),
  }),
  rule({
    id: 'stuck/relight',
    doc: 'A person whose fire has gone out (and is not soaked) lights it again.',
    host: PERSON,
    on: 'stuck',
    tree: IF(is('target', { tags: ['lightable'], notStatus: ['lit', 'wet'] }), DO(emit('element', 'target', { element: 'fire', power: 2 }), say('Out again. Pass me the flint.', '又灭了。把火石递给我。'))),
  }),
]

// ------------------------------------------------------------------ using held things (the instrument's nature)

/** A person, with nothing drawn against them: what is in hand is not a blow on them (the AI says what it is). */
const UNDRAWN_ON_PERSON: Cond = all(is('target', PERSON), not(has('actor', 'drawn')))

const USE: Selector[] = []
void USE
const useOrPut = ['act/use', 'act/put'] as const

/** Who gets hungry, and so can be fed. */
const FEEDS: Selector = { type: 'actor', props: { maxHunger: { gt: 0 } } }

/** What each tool does to what it is used on, when the thing itself does not say. */
const TOOL_LABELS: Record<string, Text> = {
  'tool:pickaxe': L('Mine {target}', '开采{target}'),
  'tool:hoe': L('Hoe {target}', '锄{target}'),
  'tool:shovel': L('Dig {target}', '挖{target}'),
  'tool:sickle': L('Cut {target}', '割{target}'),
  'tool:hammer': L('Hammer {target}', '敲打{target}'),
  key: L('Try the key in {target}', '用钥匙试{target}'),
  writing: L('Write on {target}', '在{target}上写字'),
  lockpick: L('Pick the lock of {target}', '撬{target}的锁'),
  'tool:fishing': L('Cast into {target}', '往{target}里甩竿'),
}

/**
 * Where a thing set down by hand goes: open ground, the open air of a storey (a floor laid in it),
 * or what is built there (a floor laid on it, a wall stacked on a wall) — the cell takes it as G's put.
 */
const SET_ON: Cond = any(is('target', { type: 'tile', notTags: ['solid', 'liquid'] }), is('target', { type: 'structure' }))

const INSTRUMENTS: Rule[] = [
  // the left click builds (Terraria, Minecraft's place): a built thing or a fixture used on where it can go is set down there
  ...(['structure', 'fixture'] as const).map((type) =>
    rule({
      id: `use/set-${type}`,
      label: L('Set {instrument} down', '放下{instrument}'),
      doc: `A ${type === 'structure' ? 'built thing (a wall, a floor, a door, stairs)' : 'fixture (a bed, a workbench)'} used on open ground, a floor or what is built there is set down there, as G sets it (the cell answers: it takes it or refuses). Used on anything else, or swung as a blow, it is what its nature says.`,
      host: { type },
      on: 'act/use',
      tree: IF(all(not(param('attack', true)), SET_ON), DO(emit('receive', 'target', undefined, { item: 'host' })), 'inherit'),
    }),
  ),
  rule({
    id: 'use/read',
    label: L('Read {instrument}', '阅读{instrument}'),
    doc: 'A document with something written in it (its text, text_zh), used on oneself, is read; one with nothing written is the world\'s to answer.',
    host: { type: 'item/document', tags: ['readable'] },
    on: 'act/use',
    tree: IF(all({ same: ['actor', 'target'] }, { prop: { role: 'host', key: 'text' } }), DO({ op: 'log', text: '@line' }), 'inherit'),
  }),
  rule({
    id: 'use/read-skillbook',
    label: L('Read {instrument}', '阅读{instrument}'),
    doc: 'A skill book used on oneself is read: one is told the skill it teaches (its `teaches`), and learns it from the book (body/stage, what = read).',
    host: { type: 'item/document/skillbook' },
    on: 'act/use',
    tree: IF({ same: ['actor', 'target'] }, DO(emit('notify', 'actor', { what: 'read', skill: { prop: 'teaches', of: 'host' } }, { item: 'host' })), 'inherit'),
  }),
  rule({
    id: 'use/wear',
    doc: 'Something one wears, used on someone (oneself, or another): it is put on them (world-model.md §6.8).',
    host: { tags: ['wearable'] },
    on: 'act/use',
    // (a blow is never a dressing: a helmet swung at a slime is a blow, as anything swung is)
    tree: IF(param('attack', true), 'inherit', IF(
      { same: ['actor', 'target'] },
      // on oneself: put on, or taken off when it is on (a weapon taken up, or put away)
      IF(
        { worn: 'host' },
        IF(tag('host', 'weapon'), AS(L('Put away {instrument}', '收起{instrument}'), DO(emit('offered', 'target', { wear: true }, { item: 'host' }))), AS(L('Take off {instrument}', '脱下{instrument}'), DO(emit('offered', 'target', { wear: true }, { item: 'host' })))),
        IF(tag('host', 'weapon'), AS(L('Wield {instrument}', '装备{instrument}'), DO(emit('offered', 'target', { wear: true }, { item: 'host' }))), AS(L('Put on {instrument}', '穿上{instrument}'), DO(emit('offered', 'target', { wear: true }, { item: 'host' })))),
      ),
      // (a weapon is not put on another: used on them, it is what it is — a blow, or what its own rules say)
      IF(all(is('target', { type: 'actor' }), not(tag('host', 'weapon'))), AS(L('Put {instrument} on {target}', '给{target}穿上{instrument}'), DO(emit('offered', 'target', { wear: true }, { item: 'host' }))), 'inherit'),
    )),
  }),
  rule({
    id: 'use/eat',
    doc: 'Food used on oneself is eaten: it feeds hunger (Minecraft: health comes back from being well fed, not from the bite). Used on another who gets hungry, it feeds them; on anything else it is undefined (a wolf offered meat: the AI answers).',
    host: { tags: ['edible'] },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      AS(L('Eat {instrument}', '吃掉{instrument}'), ASK(L('Eat {instrument}?', '要吃掉{instrument}吗？'), emit('restore', 'actor', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), emit('notify', 'story', { what: 'meal' }), log('You eat {host}.', '你吃掉了{host}。'), { op: 'destroy' })),
      IF(is('target', FEEDS), AS(L('Feed {instrument} to {target}', '给{target}吃{instrument}'), DO(emit('restore', 'target', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), log('You feed {target} {host}.', '你喂{target}吃了{host}。'), { op: 'destroy' })), 'inherit'),
    ),
  }),
  rule({
    id: 'use/eat-medicine',
    doc: 'Medicine eaten (a healing herb) heals as well as it feeds — oneself, or another it is given to.',
    host: { tags: ['edible', 'medicinal'] },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      // (a Herbalist draws twice the good from it: life.ts)
      IF(
        tag('actor', 'skill:herbalist'),
        AS(L('Eat {instrument}', '吃掉{instrument}'), ASK(L('Eat {instrument}?', '要吃掉{instrument}吗？'), emit('restore', 'actor', { which: 'hp', amount: { prop: 'heal', of: 'host', mul: 2, add: 2 } }), emit('restore', 'actor', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), vfx('heal', 'actor'), log('You eat {host}, and know what it is good for.', '你吃下{host}，你很清楚它的药效。'), { op: 'destroy' })),
        AS(L('Eat {instrument}', '吃掉{instrument}'), ASK(L('Eat {instrument}?', '要吃掉{instrument}吗？'), emit('restore', 'actor', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), emit('restore', 'actor', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), vfx('heal', 'actor'), log('You eat {host}.', '你吃掉了{host}。'), { op: 'destroy' })),
      ),
      IF(is('target', FEEDS), AS(L('Give {instrument} to {target}', '给{target}吃{instrument}'), DO(emit('restore', 'target', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), emit('restore', 'target', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), vfx('heal', 'target'), log('You give {target} {host}.', '你给{target}吃了{host}。'), { op: 'destroy' })), 'inherit'),
    ),
  }),
  rule({
    id: 'use/drink',
    doc: 'A drink used on oneself, or on another living thing, heals them.',
    host: { tags: ['drinkable'] },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      AS(L('Drink {instrument}', '喝掉{instrument}'), ASK(L('Drink {instrument}?', '要喝掉{instrument}吗？'), emit('restore', 'actor', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), vfx('heal', 'actor'), log('You drink {host}.', '你喝下了{host}。'), { op: 'destroy' })),
      IF(is('target', { type: 'actor' }), AS(L('Give {instrument} to {target} to drink', '给{target}喝{instrument}'), DO(emit('restore', 'target', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), vfx('heal', 'target'), log('You give {target} {host}.', '你给{target}喝下了{host}。'), { op: 'destroy' })), 'inherit'),
    ),
  }),
  rule({
    id: 'use/drink-vessel',
    doc: 'A drink carried in a vessel (a bucket of milk), drunk by oneself or given to another: it heals and feeds them, and the vessel is left empty.',
    host: { type: 'item/vessel', tags: ['drinkable'] },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      AS(L('Drink {instrument}', '喝掉{instrument}'), ASK(L('Drink {instrument}?', '要喝掉{instrument}吗？'), emit('restore', 'actor', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), emit('restore', 'actor', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), vfx('heal', 'actor'), log('You drink {host}.', '你喝下了{host}。'), { op: 'transform', into: '@prop:emptyType' })),
      IF(is('target', FEEDS), AS(L('Give {instrument} to {target} to drink', '给{target}喝{instrument}'), DO(emit('restore', 'target', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), emit('restore', 'target', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), vfx('heal', 'target'), log('You give {target} {host}.', '你给{target}喝下了{host}。'), { op: 'transform', into: '@prop:emptyType' })), 'inherit'),
    ),
  }),
  rule({
    id: 'use/water',
    doc: 'Water poured on something (or drunk, if it is oneself): water reaches it, and the vessel is empty. Putting a vessel down only sets it down.',
    host: { tags: ['liquid:water'] },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      AS(L('Drink {instrument}', '喝掉{instrument}'), ASK(L('Drink {instrument}?', '要喝掉{instrument}吗？'), emit('restore', 'actor', { which: 'hp', amount: 2 }), { op: 'transform', into: '@prop:emptyType' }, log('Refreshing.', '清凉解渴。'))),
      IF(is('target', { tags: ['water'] }), 'inherit', AS(L('Splash {target}', '泼向{target}'), DO(emit('element', 'target', { element: 'water', power: 1 }), { op: 'transform', into: '@prop:emptyType' }, log('You pour water on {target}.', '你把水泼在了{target}上。')))),
    ),
  }),
  rule({
    id: 'use/oil',
    label: L('Pour oil on {target}', '往{target}上倒油'),
    doc: 'Oil poured on something coats it; the vessel is empty.',
    host: { tags: ['liquid:oil'] },
    on: 'act/use',
    tree: IF(any({ same: ['actor', 'target'] }, is('target', { tags: ['water'] })), 'inherit', DO(emit('coat', 'target', { substance: 'oil' }), { op: 'transform', into: '@prop:emptyType' }, log('Slick oil coats {target}.', '{target}被泼上了一层滑腻的油。'))),
  }),
  ...useOrPut.map((on) =>
    rule({
      id: `use/fill${on === 'act/put' ? '-put' : ''}`,
      label: L('Fill {instrument}', '装满{instrument}'),
      doc: 'An empty vessel at water (a well, a fountain, a lake) fills.',
      host: { tags: ['empty-vessel'] },
      on,
      tree: IF(is('target', { tags: ['water-source'] }), DO({ op: 'transform', into: '@prop:waterType' }, vfx('splash', 'target'), log('Filled with water.', '你装满了水。'))),
    }),
  ),
  rule({
    id: 'use/fire',
    label: L('Set fire to {target}', '点燃{target}'),
    doc: 'A flame held to something: fire reaches it (the flammable burn, the lightable are lit). A torch put down is only set down.',
    host: { tags: ['fire-source'] },
    on: 'act/use',
    tree: IF({ same: ['actor', 'target'] }, 'inherit', DO(emit('element', 'target', { element: 'fire', power: 2 }))),
  }),
  rule({
    id: 'use/cook',
    label: L('Cook {instrument} over {target}', '在{target}上烤{instrument}'),
    doc: 'Raw food held over a lit fire cooks.',
    host: { tags: ['cookable', 'raw'] },
    on: 'act/use',
    tree: IF(is('target', { tags: ['cookware'], status: ['lit'] }), DO({ op: 'transform', into: '@prop:cookedType' }, vfx('smoke', 'target'), log('It sizzles and cooks.', '滋滋作响，熟了。'))),
  }),
  rule({
    id: 'use/blade',
    doc: 'A blade used on something strikes it with a cutting edge — on a person only with the blade drawn (X: a blow on a person is meant).',
    host: { type: 'item/weapon/blade' },
    on: 'act/use',
    tree: IF(UNDRAWN_ON_PERSON, 'inherit', DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'cut', ...WOUND }))),
  }),
  rule({
    id: 'use/polearm',
    doc: 'A spear or a halberd used on something strikes it with a point — on a person only with it drawn.',
    host: { type: 'item/weapon/polearm' },
    on: 'act/use',
    tree: IF(UNDRAWN_ON_PERSON, 'inherit', DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'pierce', ...WOUND }))),
  }),
  rule({
    id: 'use/weapon',
    doc: 'A weapon used on something strikes it — on a person only with it drawn.',
    host: { type: 'item/weapon' },
    on: 'act/use',
    tree: IF(UNDRAWN_ON_PERSON, 'inherit', DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'blunt', ...WOUND }))),
  }),
  rule({
    id: 'use/spell',
    doc: 'A wand cast at something strikes it with its element — at a person only with it drawn.',
    host: { type: 'item/weapon/magic' },
    on: 'act/use',
    tree: IF(UNDRAWN_ON_PERSON, 'inherit', DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'magic', ...WOUND }))),
  }),
  ...(
    [
      ['tool:pickaxe', 'pierce'],
      ['tool:hoe', 'dig'],
      ['tool:shovel', 'dig'],
      ['tool:sickle', 'cut'],
      ['tool:hammer', 'blunt'],
    ] as const
  ).map(([t, edge]) =>
    rule({
      id: `use/${t.slice(5)}`,
      label: TOOL_LABELS[t],
      doc: `A ${t.slice(5)} works what it is used on: a blow with a ${edge} edge.`,
      host: { tags: [t] },
      on: 'act/use',
      tree: IF(
        any({ same: ['actor', 'target'] }, UNDRAWN_ON_PERSON),
        'inherit',
        // (a Heavy Pick strikes half again as hard: life.ts)
        t === 'tool:pickaxe' ? IF(tag('actor', 'skill:heavy-pick'), DO(emit('strike', 'target', { power: { param: 'power', mul: 1.5 }, edge, ...WOUND })), DO(emit('strike', 'target', { power: POWER, edge, ...WOUND }))) : DO(emit('strike', 'target', { power: POWER, edge, ...WOUND })),
      ),
    }),
  ),
  ...(['key', 'writing', 'tool:fishing', 'lockpick'] as const).map((t) =>
    rule({
      id: `use/${t.replace('tool:', '')}`,
      label: TOOL_LABELS[t],
      doc: 'A key, a quill, a fishing line, a lockpick: a careful hand on the target, with the instrument in it.',
      host: { tags: [t] },
      on: 'act/use',
      tree: IF({ same: ['actor', 'target'] }, 'inherit', DO(emit('handle', 'target'))),
    }),
  ),
  rule({
    id: 'use/rope',
    label: L('Tie {instrument} to {target}', '把{instrument}系在{target}上'),
    doc: 'A rope used on a fixture is tied to it (it receives the rope).',
    host: { type: 'item/tool/rope' },
    on: 'act/use',
    tree: IF(is('target', { type: 'fixture' }), DO(emit('receive', 'target', undefined, { item: 'host' }))),
  }),
]

// ------------------------------------------------------------------ receiving, being taken, being handled

const CONTAINER: Selector = { type: 'fixture', tags: ['container'] }

const PLACING: Rule[] = [
  rule({
    id: 'core/receive-ground',
    label: L('Place {instrument}', '放下{instrument}'),
    doc: 'Open ground takes what is put down on it.',
    host: { type: 'tile', notTags: ['solid', 'liquid'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), log('You put down {item}.', '你放下了{item}。'))),
  }),
  rule({
    id: 'core/receive-air',
    label: L('Place {instrument}', '放下{instrument}'),
    doc: 'The open air of a storey above the ground takes what something there would hold up: a floor laid in it, a wall set on the wall below (docs/building.md).',
    host: { type: 'tile/air' },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'))),
  }),
  rule({
    id: 'core/receive-solid',
    doc: 'Solid ground (walls, trees, rock) takes nothing.',
    host: { type: 'tile', tags: ['solid'], notTags: ['liquid'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(say('There is no room there.', '那里放不下。', 'actor'))),
  }),
  rule({
    id: 'core/receive-water',
    doc: 'Water refuses what is put in it, so nothing is lost.',
    host: { type: 'tile', tags: ['water'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(log('It would sink.', '会沉下去的。'))),
  }),
  rule({
    id: 'core/receive-lava',
    label: L('Throw {instrument} into {target}', '把{instrument}扔进{target}'),
    doc: 'Lava takes what is put in it (and burns what can burn).',
    host: { type: 'tile', tags: ['molten'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), vfx('fire_burst'))),
  }),
  rule({
    id: 'core/receive-item',
    label: L('Put {instrument} down by {target}', '把{instrument}放在{target}旁'),
    doc: 'Something put on a loose item lies beside it.',
    host: { type: 'item' },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), log('You put down {item}.', '你放下了{item}。'))),
  }),
  rule({
    id: 'core/receive-surface',
    label: L('Set {instrument} on {target}', '把{instrument}放在{target}上'),
    doc: 'A table, counter, bench or altar takes what is set on it (it lies on that tile).',
    host: { type: 'fixture', tags: ['surface'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), log('You set {item} on {host}.', '你把{item}放在了{host}上。'))),
  }),
  rule({
    id: 'core/receive-store',
    label: L('Put {instrument} in {target}', '把{instrument}放进{target}'),
    doc: 'An open container takes what is put in it, up to its capacity; a closed one takes nothing.',
    host: CONTAINER,
    on: 'impulse/receive',
    tree: IF(
      { none: 'item' },
      'inherit',
      IF(
        has('host', 'open'),
        IF({ count: { role: 'host', in: 'contents', cmp: { gte: { prop: 'capacity', of: 'host' } } } }, DO(say('It is full.', '已经装满了。', 'actor')), DO(taken('contents'), log('You put {item} into {host}.', '你把{item}放进了{host}。'))),
        DO(say('It is closed.', '它是关着的。', 'actor')),
      ),
    ),
  }),
  rule({
    id: 'element/burn-away',
    label: L('Put {instrument} into the fire', '把{instrument}丢进火里'),
    doc: 'A lit fire takes what is fed to it: the flammable burn there; raw food set on a fire made for cooking (cookware) is held to it, as use/cook holds it there.',
    host: { tags: ['lightable'], status: ['lit'] },
    on: 'impulse/receive',
    tree: IF(
      all(is('item', { tags: ['cookable', 'raw'] }), tag('host', 'cookware')),
      DO(emit('element', 'item', { element: 'fire', power: 1 })),
      IF(is('item', { tags: ['flammable'] }), DO(taken('tile'), emit('element', 'item', { element: 'fire', power: 3 }), log('{item} goes into the fire.', '{item}被丢进了火里。')), 'inherit'),
    ),
  }),
  rule({
    id: 'element/cook',
    label: L('Cook {instrument}', '烤{instrument}'),
    doc: 'Raw food in fire cooks.',
    host: { tags: ['cookable', 'raw'] },
    on: 'impulse/element',
    tree: IF(param('element', 'fire'), DO({ op: 'transform', into: '@prop:cookedType' }, vfx('smoke'), log('It sizzles and cooks.', '滋滋作响，熟了。'))),
  }),
  rule({
    id: 'core/taken-container',
    doc: 'A container stays where it is: closed it says so, open its contents are taken from its panel.',
    host: CONTAINER,
    on: 'impulse/taken',
    tree: IF(has('host', 'open'), DO(say('Take what is inside from it.', '从里面拿吧。', 'other')), DO(say('It is closed.', '它是关着的。', 'other'))),
  }),
  rule({
    id: 'core/open-close',
    doc: 'A hand opens or closes a container; a key locks or unlocks it; a lockpick, worked at a lock, may spring it (and one who sees it knows what it is).',
    host: CONTAINER,
    on: 'impulse/handle',
    tree: IF(
      tag('instrument', 'lockpick'),
      IF(tag('host', 'locked'), IF({ chance: 0.5 }, AS(L('Pick the lock of {target}', '撬{target}的锁'), DO({ op: 'removeTag', tag: 'locked' }, { op: 'open' }, vfx('sparkle'), log('Click — the lock gives.', '咔哒——锁开了。'))), DO(log('The pick slips. Try again.', '撬锁器滑了一下。再试试。'))), DO(log('It is not locked.', '它没有上锁。'))),
      IF(
      tag('instrument', 'key'),
      IF(tag('host', 'locked'), AS(L('Unlock {target}', '打开{target}的锁'), DO({ op: 'removeTag', tag: 'locked' }, { op: 'open' }, vfx('sparkle'), log('Click. It opens.', '咔哒一声，开了。'))), IF(has('host', 'open'), 'inherit', AS(L('Lock {target}', '锁上{target}'), DO({ op: 'addTag', tag: 'locked' }, vfx('sparkle'), log('Click. It is locked.', '咔哒一声，锁上了。'))))),
      IF(tag('host', 'locked'), AS(L('Try {target}', '试着打开{target}'), DO(say('Locked.', '锁住了。', 'actor'))), IF(has('host', 'open'), AS(L('Close {target}', '关上{target}'), DO({ op: 'open' }, vfx('dust'))), AS(L('Open {target}', '打开{target}'), DO({ op: 'open' }, vfx('dust'))))),
      ),
    ),
  }),
  rule({
    id: 'core/read',
    label: L('Read {target}', '阅读{target}'),
    doc: 'A hand on something written: it is read.',
    host: { type: 'fixture', tags: ['readable'] },
    on: 'impulse/handle',
    tree: DO({ op: 'say', text: '@line' }),
  }),
]

// ------------------------------------------------------------------ the ground and the trees

const LIVING_TREE: Selector = { type: 'tile', tags: ['tree', 'flammable'] }
const STUMP: Selector = { type: 'tile/stump' }
// (two logs and a stick — more by what the feller's skills grant: Timber Master, Forester; content life.ts)
const FELL: Effect[] = [remove('notched'), { op: 'transform', into: 'tile/stump' }, { op: 'spawn', type: 'item/material/log', at: 'host', count: { prop: 'fellLogs', of: 'actor', add: 2 } }, { op: 'spawn', type: 'item/material/stick', at: 'host', count: { prop: 'fellSticks', of: 'actor', add: 1 } }, { op: 'spawn', type: 'item/seed/acorn', at: 'host', count: { prop: 'fellAcorns', of: 'actor' } }, vfx('leaves'), log('Timber!', '树倒了！')]

const GROUND: Rule[] = [
  rule({
    id: 'wood/notch',
    label: L('Chop {target}', '砍{target}'),
    doc: 'An axe on a living tree bites into it: it loses durability (as any blow) and shows a notch, which heals if the tree is left alone.',
    host: LIVING_TREE,
    on: 'impulse/strike',
    // (a Sharp Axe bites half again as deep: life.ts)
    tree: IF(tag('instrument', 'tool:axe'), IF(tag('actor', 'skill:sharp-axe'), DO({ op: 'hurt', amount: { param: 'power', mul: 1.5 }, blow: true }, add('notched'), vfx('leaves'), log('The axe bites deep into {host}.', '斧头深深砍进了{host}。')), DO({ op: 'hurt', amount: POWER, blow: true }, add('notched'), vfx('leaves'), log('The axe bites into {host}.', '斧头砍进了{host}。'))), 'inherit'),
  }),
  rule({
    id: 'wood/heal',
    doc: 'A notch left alone heals: the tree is whole again.',
    host: LIVING_TREE,
    on: 'time/timer',
    tree: IF(param('status', 'notched'), DO({ op: 'heal', amount: { prop: 'maxHp', of: 'host' } }), 'inherit'),
  }),
  rule({
    id: 'wood/fell',
    doc: 'A living tree broken falls: a stump that grows back, two logs, a stick, and now and then an acorn (a woodcutter gets a log more); one broken by fire is a charred tree.',
    host: LIVING_TREE,
    on: 'threshold/cross',
    tree: IF(
      param('name', 'broken'),
      IF(
        has('host', 'burning'),
        DO({ op: 'transform', into: 'tile/charred_tree' }, vfx('smoke')),
        // a woodcutter (the skill, content/src/skills.ts) gets one more log from the same tree
        IF(tag('actor', 'skill:woodcutter'), DO(...FELL, { op: 'spawn', type: 'item/material/log', at: 'host' }), IF({ chance: 0.25 }, DO(...FELL, { op: 'spawn', type: 'item/seed/acorn', at: 'host' }), DO(...FELL))),
      ),
      'inherit',
    ),
  }),
  rule({
    id: 'wood/uproot',
    label: L('Dig out {target}', '挖出{target}'),
    doc: 'A shovel digs a stump out for good.',
    host: STUMP,
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:shovel'), DO({ op: 'spawn', type: 'item/material/stick', at: 'host' }, vfx('dust'), log('You dig out the stump.', '你把树桩挖了出来。'), { op: 'destroy' })),
  }),
  rule({
    id: 'wood/char',
    label: L('Break up {target}', '敲碎{target}'),
    doc: 'An axe breaks a charred tree down to coal.',
    host: { type: 'tile/charred_tree' },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:axe'), DO({ op: 'spawn', type: 'item/material/coal', at: 'host' }, vfx('dust'), log('The charred wood crumbles to coal.', '焦木碎成了煤炭。'), { op: 'destroy' })),
  }),
  rule({
    id: 'wood/split',
    label: L('Split {target}', '劈开{target}'),
    doc: 'An axe splits a log into two planks.',
    host: { type: 'item/material/log' },
    on: 'impulse/strike',
    // the two planks pop out (the magnet takes them in), as anything a rule drops
    // (a Carpenter gets more: life.ts)
    tree: IF(tag('instrument', 'tool:axe'), DO(log('You split the log into planks.', '你把木头劈成了木板。'), { op: 'spawn', type: 'item/material/plank', at: 'tileOf:host', count: { prop: 'splitPlanks', of: 'actor', add: 2 } }, vfx('dust'), { op: 'destroy' })),
  }),
  rule({
    id: 'farm/till',
    label: L('Till {target}', '翻{target}的土'),
    doc: 'A hoe turns diggable ground into farmland.',
    host: { type: 'tile', tags: ['diggable'] },
    on: 'impulse/strike',
    // (a Wide Hoe tills the diggable ground around too: life.ts farm/tilled)
    tree: IF(tag('instrument', 'tool:hoe'), IF(tag('actor', 'skill:wide-hoe'), DO({ op: 'transform', into: 'tile/farmland' }, vfx('dust'), emit('notify', { area: { radius: 1 } }, { what: 'till' }, { filter: { type: 'tile', tags: ['diggable'] } })), DO({ op: 'transform', into: 'tile/farmland' }, vfx('dust')))),
  }),
  rule({
    id: 'core/fish',
    label: L('Fish in {target}', '在{target}里钓鱼'),
    doc: 'A line cast into water: sometimes something bites — twice as often on a baited hook (a baited cast is spent: the rod is told); what bites is mostly a fish, now and then a golden carp, or an old boot. A cast stirs the water, and nothing bites there until it settles (a yield waits on time, world-model.md D23).',
    host: { type: 'tile', tags: ['water'] },
    on: 'impulse/handle',
    tree: IF(
      tag('instrument', 'tool:fishing'),
      IF(
        has('host', 'stirred'),
        DO(vfx('splash'), log('The water is stirred up. Let it settle.', '水被搅浑了，等它静下来。')),
        // (an Angler's bite more often; a Bait Saver keeps the bait half the times it is taken clean: life.ts)
        IF(
          { prop: { role: 'instrument', key: 'bait', cmp: { gt: 0 } } },
          IF(
            any({ chance: 0.7 }, all(tag('actor', 'skill:angler'), { chance: 0.5 })),
            CATCH(true),
            IF(
              all(tag('actor', 'skill:bait-saver'), { chance: 0.5 }),
              DO(add('stirred'), vfx('splash'), log('Nothing bites — but the bait is still on the hook.', '没有咬钩——但鱼饵还挂在钩上。')),
              DO(add('stirred'), emit('notify', 'instrument', { what: 'cast' }), vfx('splash'), log('The bait is taken clean. Nothing.', '鱼饵被啃光了。什么也没钓到。')),
            ),
          ),
          IF(any({ chance: 0.35 }, all(tag('actor', 'skill:angler'), { chance: 0.23 })), CATCH(false), DO(add('stirred'), vfx('splash'), log('The float bobs. Nothing bites — yet.', '浮漂晃了晃。还没咬钩。'))),
        ),
      ),
    ),
  }),
  rule({
    id: 'element/freeze-water',
    label: L('Freeze {target}', '冻住{target}'),
    doc: 'Ice turns water into walkable ice, spreading a little (the cast\'s own cell spreads to those beside it, and no further); that ice thaws in time.',
    host: { type: 'tile/water' },
    on: 'impulse/element',
    // only a strong frost (a cast, power 2 and up) spreads, and what it spreads is weak: one cast is a few cells, not a river
    tree: IF(
      param('element', 'ice'),
      IF(
        { param: { key: 'power', cmp: { gte: 2 } } },
        DO({ op: 'transform', into: 'tile/ice' }, add('chilled'), emit('element', { area: { radius: 1 } }, { element: 'ice', power: 1 }, { chance: 0.7, filter: { type: 'tile/water' } }), vfx('frost')),
        DO({ op: 'transform', into: 'tile/ice' }, add('chilled'), vfx('frost')),
      ),
      'inherit',
    ),
  }),
  rule({
    id: 'element/thaw-ice',
    label: L('Thaw {target}', '融化{target}'),
    doc: 'Fire on ice turns it back to water.',
    host: { type: 'tile/ice' },
    on: 'impulse/element',
    tree: IF(param('element', 'fire'), DO({ op: 'transform', into: 'tile/water' }, vfx('steam')), 'inherit'),
  }),
  rule({
    id: 'water/ashore',
    doc: 'Whoever finds water closing over them (the ice gave way) is put ashore.',
    host: { type: 'tile', tags: ['water'] },
    on: 'contact/begin',
    tree: IF(all(param('how', 'under'), is('other', { type: 'actor' })), DO(emit('push', 'other', { ashore: true }))),
  }),
  rule({
    id: 'water/no-fire',
    doc: 'Burning never takes hold on water.',
    host: { type: 'tile', tags: ['water'] },
    on: 'threshold/gain',
    tree: IF(param('status', 'burning'), DO(remove('burning'), vfx('steam'))),
  }),
  rule({
    id: 'element/conduct',
    doc: 'Lightning on conductive ground (water) charges it and arcs to the conductive and the wet around.',
    host: { type: 'tile', tags: ['conductive'] },
    on: 'impulse/element',
    tree: IF(
      param('element', 'lightning'),
      DO(add('electrified'), emit('element', { area: { radius: 2 } }, { element: 'lightning', power: 1 }, { chance: 0.9, filter: { tags: ['conductive'], notStatus: ['electrified'] } }), emit('element', { area: { radius: 2 } }, { element: 'lightning', power: 4 }, { chance: 0.9, filter: { status: ['wet'] } }), vfx('sparks')),
      'inherit',
    ),
  }),
  rule({
    id: 'fire/burn-out-ground',
    doc: 'Burnt ground is ash; a burnt tree is charred, a burnt wall black; what else burns on the ground (a bush, a stump) is gone.',
    host: { type: 'tile', tags: ['flammable'] },
    on: 'time/timer',
    tree: IF(
      param('status', 'burning'),
      IF(tag('host', 'tree'), DO({ op: 'transform', into: 'tile/charred_tree' }, vfx('smoke')), IF(tag('host', 'wall'), DO({ op: 'transform', into: 'tile/burnt_wall' }, vfx('smoke')), DO({ op: 'transform', into: 'tile/ash' }, vfx('smoke')))),
    ),
  }),
  rule({
    id: 'fire/wear',
    doc: 'A burning thing with durability (a body, a tree, a wooden wall) loses it as it burns, now and then (an element is a damage channel, world-model.md §6.2).',
    host: { status: ['burning'], props: { maxHp: { gt: 0 } } },
    on: 'time/period',
    tree: IF(all(param('status', 'burning'), { chance: 0.5 }), DO(WEAR), 'inherit'),
  }),
  rule({
    id: 'fire/burnt-wall',
    doc: 'A wooden wall that burns down to nothing stands black (world-model.md §10.3, 13).',
    host: { type: 'tile/woodwall' },
    on: 'threshold/cross',
    tree: IF(all(param('name', 'broken'), has('host', 'burning')), DO({ op: 'transform', into: 'tile/burnt_wall' }, vfx('smoke')), 'inherit'),
  }),
  rule({
    id: 'water/bridge',
    label: L('Lay {instrument} across {target}', '用{instrument}在{target}上搭桥'),
    doc: 'A plank laid on shallow water, or a trunk fallen across it, makes a stretch of bridge.',
    host: { type: 'tile/water' },
    on: 'impulse/receive',
    tree: IF(any(param('what', 'plank'), param('what', 'trunk')), DO({ op: 'transform', into: 'tile/bridge' }, vfx('splash')), 'inherit'),
  }),
]

// ------------------------------------------------------------------ things on fire, things that burn what they touch


const FIRE: Rule[] = [
  ...(
    [
      ['fire/spread', { type: 'tile', tags: ['flammable'], status: ['burning'] }, 0.07],
      ['fire/spread-dry', { type: 'tile', tags: ['flammable', 'dry'], status: ['burning'] }, 0.3],
      ['fire/spread-thing', { type: 'fixture', tags: ['flammable'], status: ['burning'] }, 0.1],
      ['fire/spread-dry-thing', { type: 'fixture', tags: ['flammable', 'dry'], status: ['burning'] }, 0.3],
      ['fire/spread-structure', { type: 'structure', tags: ['flammable'], status: ['burning'] }, 0.1],
    ] as [string, Selector, number][]
  ).map(([id, host, chance]) =>
    rule({
      id,
      doc: 'A burning thing reaches its flammable neighbours now and then (dry things fast).',
      host,
      on: 'time/period',
      // and it wears as it burns, as anything burning does (fire/wear)
      tree: IF(param('status', 'burning'), IF({ chance: 0.5 }, DO(spread(chance), WEAR), DO(spread(chance)))),
    }),
  ),

  rule({
    id: 'fire/fiery-touch',
    doc: 'A fiery creature sets alight the dry, flammable things it comes up against or walks over.',
    host: { type: 'actor', tags: ['fiery'] },
    on: 'contact/begin',
    tree: IF(is('other', { tags: ['flammable', 'dry'], notStatus: ['wet', 'burning', 'frozen'] }), DO(emit('element', 'other', { element: 'fire', power: 1 }))),
  }),
  rule({
    id: 'fire/fiery-bump',
    doc: 'A fiery creature that runs up against something dry and flammable sets it alight.',
    host: { type: 'actor', tags: ['fiery'] },
    on: 'bump',
    tree: IF(is('other', { tags: ['flammable', 'dry'], notStatus: ['wet', 'burning', 'frozen'] }), DO(emit('element', 'other', { element: 'fire', power: 1 }), vfx('fire_burst', 'other'))),
  }),


  ...(['contact/begin', 'contact/stay'] as const).map((on) =>
    rule({
      id: on === 'contact/begin' ? 'spring/soak' : 'spring/soak-on',
      doc: 'A warm spring mends whoever sits in it: a little health as they step in (a splash), and more for as long as they stay.',
      host: { type: 'tile', tags: ['spring'] },
      on,
      tree: IF(
        all(param('how', 'under'), is('other', { type: 'actor' })),
        on === 'contact/begin' ? DO(emit('restore', 'other', { which: 'spring', amount: 1 }), vfx('splash', 'other')) : DO(emit('restore', 'other', { which: 'spring', amount: 1 })),
      ),
    }),
  ),
  ...(['contact/begin', 'contact/stay'] as const).map((on) =>
    rule({
      id: on === 'contact/begin' ? 'lava/burn' : 'lava/burn-on',
      doc: 'Lava burns what lies on it, and goes on burning it.',
      host: { type: 'tile', tags: ['molten'] },
      on,
      tree: IF(param('how', 'under'), DO(emit('element', 'other', { element: 'fire', power: 6 }))),
    }),
  ),
  rule({
    id: 'fire/burn-out-thing',
    doc: 'A burnt thing leaves ash and what it held.',
    host: { type: 'fixture', tags: ['flammable'] },
    on: 'time/timer',
    tree: IF(param('status', 'burning'), DO({ op: 'dropContents' }, { op: 'spawn', type: 'item/material/ash', at: 'tileOf:host' }, vfx('smoke', 'tileOf:host'), { op: 'destroy' })),
  }),
  rule({
    id: 'fire/burnt-structure',
    doc: 'A wooden wall, floor, door or stair that burns down to nothing (fire/wear) is ash, not its planks; a short fire only scorches it.',
    host: { type: 'structure', tags: ['flammable'] },
    on: 'threshold/cross',
    tree: IF(all(param('name', 'broken'), has('host', 'burning')), DO({ op: 'spawn', type: 'item/material/ash', at: 'tileOf:host' }, vfx('smoke', 'tileOf:host'), { op: 'destroy' }), 'inherit'),
  }),
  rule({
    id: 'fire/explode',
    doc: 'Something explosive that catches fire goes off: a blow as strong as its blast to everything round it, fire to what burns there, and it is gone.',
    host: { type: 'item', tags: ['explosive'] },
    on: 'threshold/gain',
    tree: IF(
      param('status', 'burning'),
      DO(
        emit('strike', { area: { radius: 1 } }, { power: { prop: 'blast', of: 'host' }, element: 'fire', edge: 'blunt' }),
        emit('element', { area: { radius: 1 } }, { element: 'fire', power: 2 }, { filter: { tags: ['flammable'], notStatus: ['wet', 'burning'] } }),
        vfx('explosion', 'tileOf:host'),
        { op: 'destroy' },
      ),
      'inherit',
    ),
  }),
  rule({
    id: 'fire/burn-out-item',
    doc: 'A burnt item is ash.',
    host: { type: 'item', tags: ['flammable'] },
    on: 'time/timer',
    tree: IF(param('status', 'burning'), DO({ op: 'transform', into: 'item/material/ash' }, vfx('smoke', 'tileOf:host'))),
  }),
  rule({
    id: 'water/freeze-tile',
    doc: 'Water that freezes is ice (thin: it thaws).',
    host: { type: 'tile/water' },
    on: 'threshold/gain',
    tree: IF(param('status', 'frozen'), DO({ op: 'transform', into: 'tile/ice' }, remove('frozen'), add('chilled'))),
  }),
  rule({
    id: 'combat/break',
    doc: 'Breakable fixtures shatter when broken and spill their contents (into their makeup, if they have one).',
    host: { type: 'fixture', tags: ['breakable'] },
    on: 'threshold/cross',
    tree: IF(param('name', 'broken'), IF({ makeup: 'host' }, DO(vfx('poof', 'tileOf:host'), { op: 'breakdown' }), DO({ op: 'dropContents' }, vfx('poof', 'tileOf:host'), { op: 'destroy' })), 'inherit'),
  }),
  rule({
    id: 'element/shatter-fragile',
    doc: 'Earth shatters what is fragile.',
    host: { type: 'fixture', tags: ['fragile'] },
    on: 'impulse/element',
    tree: IF(param('element', 'earth'), DO({ op: 'dropContents' }, vfx('shatter', 'tileOf:host'), { op: 'destroy' }), 'inherit'),
  }),
]

// ------------------------------------------------------------------ building: one material put on another, a hammer finishes

const PLANK = 'item/material/plank'
const STICK = 'item/material/stick'
const STONE = 'item/material/stone'
const FRAME = 'fixture/build/frame'
const RING = 'fixture/build/ring'

/** The material put on a loose `on` item gives itself to it (it is used up). */
const give = (id: string, material: string, on: Selector, when: Cond | undefined = undefined): Rule =>
  rule({
    id,
    label: L('Build with {instrument}', '用{instrument}搭建'),
    doc: 'A material put on another to build: it gives itself to the work.',
    host: { type: material },
    on: 'act/put',
    tree: IF(when ? all(is('target', on), when) : is('target', on), DO(emit('receive', 'target', { what: material.split('/').pop()! }, { item: 'host' }), { op: 'destroy' })),
  })
/** A loose `on` item receiving `what` becomes `into` (with these props). */
const become = (id: string, on: string, what: string, into: string, en: string, zh: string, props: Record<string, number> = {}, label?: Text): Rule =>
  rule({
    id,
    ...(label && { label }),
    host: { type: on },
    on: 'impulse/receive',
    tree: IF(param('what', what), DO({ op: 'transform', into }, ...Object.entries(props).map(([key, value]): Effect => ({ op: 'setProp', key, value })), vfx('dust'), log(en, zh)), 'inherit'),
  })
/** A tool's blow takes unfinished work apart into what went into it. */
const undo = (id: string, from: string, tool: string, back: [string, Amount][]): Rule =>
  rule({
    id,
    label: L('Take {target} apart', '拆开{target}'),
    doc: 'Nothing put into unfinished work is lost: it comes apart into its materials.',
    host: { type: from },
    on: 'impulse/strike',
    tree: IF(tag('instrument', tool), DO(...back.map(([type, count]): Effect => ({ op: 'spawn', type, at: 'tileOf:host', count })), vfx('dust'), log('{host} comes apart.', '{host}被拆开了。'), { op: 'destroy' })),
  })

const BUILD: Rule[] = [
  // a chest (or a crate) from a frame of planks
  give('build/plank-to-plank', PLANK, { type: PLANK }),
  become('build/start-frame', PLANK, 'plank', FRAME, 'Two planks make a frame.', '两块木板搭成了框架。', { planks: 2 }, L('Start a frame', '搭一个框架')),
  give('build/plank-to-frame', PLANK, { type: FRAME }, { prop: { role: 'target', key: 'planks', cmp: { lt: 4 } } }),
  rule({
    id: 'build/frame',
    doc: 'A frame takes planks up to four; a hammer makes a crate of two or a chest of four.',
    host: { type: FRAME },
    on: 'impulse',
    tree: IF(
      all({ param: { key: 'what', cmp: 'plank' } }, { prop: { role: 'host', key: 'planks', cmp: { lt: 4 } } }),
      { do: [{ op: 'addProp', key: 'planks', delta: 1 }, log('A frame of {host.planks} planks.', '框架上有{host.planks}块木板了。')], label: L('Add {instrument} to {target}', '把{instrument}加到{target}上') },
      IF(
        all(tag('instrument', 'tool:hammer'), { prop: { role: 'host', key: 'planks', cmp: 2 } }),
        { do: [{ op: 'transform', into: 'fixture/container/crate' }, vfx('dust'), log('You nail together a crate.', '你钉好了一个板条箱。')], label: L('Nail {target} into a crate', '把{target}钉成板条箱') },
        IF(
          all(tag('instrument', 'tool:hammer'), { prop: { role: 'host', key: 'planks', cmp: 4 } }),
          { do: [{ op: 'transform', into: 'fixture/container/chest' }, vfx('dust'), log('You nail together a chest.', '你钉好了一个箱子。')], label: L('Nail {target} into a chest', '把{target}钉成箱子') },
          IF(
            all(tag('instrument', 'tool:hammer'), { prop: { role: 'host', key: 'planks', cmp: 3 } }),
            DO(say('One more plank.', '还差一块木板。', 'actor')),
            IF(is('item', { type: PLANK }), DO(say('The frame holds no more planks.', '框架放不下更多木板了。', 'actor')), 'inherit'),
          ),
        ),
      ),
    ),
  }),
  rule({
    id: 'build/read-frame',
    label: L('Look at {target}', '看看{target}'),
    doc: 'A frame says how far it is.',
    host: { type: FRAME },
    on: 'impulse/handle',
    tree: IF(
      { prop: { role: 'host', key: 'planks', cmp: 2 } },
      DO(say('A frame of 2 planks. A hammer makes a crate; two more make a chest.', '两块木板的框架。用锤子能做成板条箱；再加两块能做成箱子。', 'actor')),
      IF({ prop: { role: 'host', key: 'planks', cmp: 3 } }, DO(say('A frame of 3 planks. One more makes a chest.', '三块木板的框架。再加一块就能做成箱子。', 'actor')), DO(say('A frame of 4 planks. A hammer makes a chest.', '四块木板的框架。用锤子能做成箱子。', 'actor'))),
    ),
  }),
  undo('build/unframe', FRAME, 'tool:axe', [[PLANK, { prop: 'planks', of: 'host' }]]),
  ...(
    [
      ['fixture/container/crate', 1],
      ['fixture/container/chest', 2],
    ] as const
  ).map(([type, planks]) =>
    rule({
      id: `build/dismantle-${type.split('/').pop()}`,
      doc: 'An axe breaks up an unlocked crate or chest: its contents spill and half its planks come back.',
      host: { type, notTags: ['locked'] },
      on: 'impulse/strike',
      tree: IF(tag('instrument', 'tool:axe'), DO({ op: 'dropContents' }, { op: 'spawn', type: PLANK, at: 'tileOf:host', count: planks }, vfx('dust'), log('You break up {host}.', '你拆掉了{host}。'), { op: 'destroy' })),
    }),
  ),
  // a fence from stakes
  give('build/stick-to-stick', STICK, { type: STICK }),
  become('build/stakes', STICK, 'stick', 'fixture/build/stakes', 'Two sticks make stakes.', '两根树枝立成了木桩。', {}, L('Set stakes', '立木桩')),
  rule({
    id: 'build/fence',
    label: L('Build a fence', '搭篱笆'),
    host: { type: 'fixture/build/stakes' },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:hammer'), DO({ op: 'transform', into: 'fixture/fence' }, vfx('dust'), log('You nail up a fence.', '你钉好了一段栅栏。'))),
  }),
  undo('build/unstake', 'fixture/build/stakes', 'tool:axe', [[STICK, 2]]),
  // a campfire from a ring of stones and two sticks
  give('build/stone-to-stone', STONE, { type: STONE }),
  become('build/ring', STONE, 'stone', RING, 'Two stones make a fire ring.', '两块石头围成了火圈。', { sticks: 0 }, L('Lay a ring of stones', '摆一圈石头')),
  give('build/stick-to-ring', STICK, { type: RING }),
  rule({
    id: 'build/ring-stick',
    label: L('Build a campfire', '搭营火'),
    doc: 'A fire ring takes two sticks and is a campfire.',
    host: { type: RING },
    on: 'impulse/receive',
    tree: IF(
      param('what', 'stick'),
      IF({ prop: { role: 'host', key: 'sticks', cmp: 0 } }, DO({ op: 'setProp', key: 'sticks', value: 1 }, log('One more stick.', '再加一根树枝。')), DO({ op: 'transform', into: 'fixture/light/campfire' }, vfx('dust'), log('A campfire, ready to light.', '营火搭好了，可以点了。'))),
      'inherit',
    ),
  }),
  undo('build/unring', RING, 'tool:pickaxe', [
    [STONE, 2],
    [STICK, { prop: 'sticks', of: 'host' }],
  ]),
  // a sign from a plank on a stick, written with a quill while carrying ink
  give('build/plank-to-stick', PLANK, { type: STICK }),
  become('build/post', STICK, 'plank', 'fixture/build/post', 'A plank on a stick: a sign post.', '木板架在树枝上，成了牌子立柱。', {}, L('Put up a post', '立一根柱子')),
  rule({
    id: 'build/sign',
    label: L('Make a sign', '做告示牌'),
    host: { type: 'fixture/build/post' },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:hammer'), DO({ op: 'transform', into: 'fixture/sign' }, { op: 'addTag', tag: 'blank' }, vfx('dust'), log('You nail up a blank sign.', '你钉好了一块空白的告示牌。'))),
  }),
  undo('build/unpost', 'fixture/build/post', 'tool:axe', [
    [PLANK, 1],
    [STICK, 1],
  ]),
  rule({
    id: 'build/write-sign',
    label: L('Write on {target}', '在{target}上写字'),
    doc: 'A blank sign: bare-handed it is blank; a quill writes on it while you carry ink. Until free-text input exists, it writes one fixed line.',
    host: { type: 'fixture/sign', tags: ['blank'] },
    on: 'impulse/handle',
    tree: IF(
      tag('instrument', 'writing'),
      IF({ count: { role: 'actor', in: 'contents', match: { type: 'item/misc/ink' }, cmp: { gte: 1 } } }, DO({ op: 'removeTag', tag: 'blank' }, { op: 'addTag', tag: 'handmade' }, log('You write on the sign.', '你在告示牌上写了字。')), 'inherit'),
      DO(say('It is blank.', '上面什么也没写。', 'actor')),
    ),
  }),
  rule({ id: 'build/read-handmade', label: L('Read {target}', '阅读{target}'), host: { type: 'fixture/sign', tags: ['handmade'] }, on: 'impulse/handle', tree: DO(say('Made by hand.', '亲手所制。', 'actor')) }),
  // a bridge, one plank at a time
  give('build/plank-on-water', PLANK, { type: 'tile/water' }),
]

// ------------------------------------------------------------------ farming
//
// A crop is a fixture that names its next stage, yield, seed and yield count as props, so one
// set of rules grows and harvests every plant. Watering starts a timer (`watered`); when it runs
// out the crop moves on a stage. Ash fertilizes: one more of the crop at harvest.

const CROP: Selector = { type: 'fixture', tags: ['crop'] }
const GROWING: Selector = { type: 'fixture', tags: ['crop', 'growing'] }
const NOTHING_GROWS: Cond = { count: { role: 'target', in: 'tile', match: { tags: ['crop'] }, cmp: { eq: 0 } } }
const picked: Effect[] = [
  { op: 'spawn', type: '@prop:host.yieldType', at: 'other', into: 'hand', count: { prop: 'pick', of: 'actor', add: 1 } },
  { op: 'spawn', type: '@prop:host.seedType', at: 'tileOf:host' },
]
/** A perennial goes back to its young stage, its fertilizer spent. */
const regrow: Effect[] = [{ op: 'transform', into: '@prop:regrowType' }, remove('fertilized'), { op: 'setProp', key: 'yield', value: 2 }]

/**
 * What bites (core/fish), after Stardew's waters: at first light, rarely, a Dawnscale; now and then a golden carp or a
 * soggy boot; in rain a catfish; at night an eel; in deep water a pike; by day a sunfish; else a perch or a fish.
 * A baited cast is spent (the rod is told).
 */
function CATCH(baited: boolean): Tree {
  // (a Master Angler brings up a fish more with every catch; a Lucky Catch finds the rare ones twice as often; a Deep
  // Fisher finds pike in any water: life.ts)
  const caught = (type: string, en: string, zh: string): Tree => DO(add('stirred'), { op: 'spawn', type, at: 'actor', into: 'contents' }, { op: 'spawn', type: 'item/food/fish/raw', at: 'actor', into: 'contents', count: { prop: 'fishExtra', of: 'actor' } }, ...(baited ? [emit('notify', 'instrument', { what: 'cast' })] : []), vfx('splash'), log(en, zh))
  const lucky = (p: number): Cond => any({ chance: p }, all(tag('actor', 'skill:lucky-catch'), { chance: p }))
  return IF(all({ hour: { from: 5, to: 8 } }, lucky(0.03)), caught('item/food/fish/dawnscale', 'The line glows as it comes up — a Dawnscale, scales like the first morning!', '鱼线出水时在发光——是晨鳞鱼，鳞片像第一个清晨！'),
    IF(lucky(0.06), caught('item/food/fish/carp', 'Gold flashes in the water — a golden carp!', '水里闪过一道金光——是金鳞鲤！'),
      IF({ chance: 0.08 }, caught('item/misc/old_boot', 'Something heavy... an old boot.', '沉甸甸的……是一只旧靴子。'),
        IF(all({ weather: ['rain', 'storm'] }, { chance: 0.4 }), caught('item/food/fish/catfish', 'A whiskered head out of the rain — a catfish!', '雨里钻出一个长胡子的脑袋——是鲶鱼！'),
          IF(all({ hour: { from: 20, to: 5 } }, { chance: 0.45 }), caught('item/food/fish/eel', 'It writhes on the line in the dark — an eel!', '黑暗里它在鱼线上扭动——是鳗鱼！'),
            IF(all(any(is('host', { type: 'tile/deepwater' }), tag('actor', 'skill:deep-fisher')), { chance: 0.45 }), caught('item/food/fish/pike', 'Long and toothy, from the deep — a pike!', '又长又多牙，从深水里来——是狗鱼！'),
              IF(all({ hour: { from: 6, to: 19 } }, { chance: 0.45 }), caught('item/food/fish/sunfish', 'A bright little sunfish!', '一条亮闪闪的太阳鱼！'),
                IF({ chance: 0.45 }, caught('item/food/fish/perch', 'A striped perch!', '一条带条纹的河鲈！'),
                  caught('item/food/fish/raw', 'A tug — you reel in a fish!', '一沉——你拉上来一条鱼！')))))))))
}

/** A crop watered: its status (twice as long for Irrigation), and the crops around told (a Sprinkler's). */
function WATER(): Tree {
  const around = emit('notify', { area: { radius: 1 } }, { what: 'water' }, { filter: { ...GROWING, notStatus: ['watered'] } })
  const watered = (long: boolean, wide: boolean) => DO(add('watered', long ? 2400 : undefined), ...(wide ? [around] : []), vfx('splash'), log('You water {host}.', '你给{host}浇了水。'))
  const wide = (long: boolean) => IF(tag('actor', 'skill:sprinkler'), watered(long, true), watered(long, false))
  return IF(tag('actor', 'skill:irrigation'), wide(true), wide(false))
}

/**
 * Harvesting a ripe crop with a sickle (farm/harvest, and one rule for each kind of crop: a farmer who knows that kind
 * gets more of it): its yield, more for Bountiful (harvest) and the kind's skill (`harvest:<kind>`), and seeds (more for
 * Farmer); a Golden Harvest now and then twice over; a perennial grows back — keeping its fertilizer and yield for a
 * Perennial Keeper (content life.ts).
 */
function HARVEST(kind?: string): Tree {
  const yieldOf: Effect[] = [
    { op: 'spawn', type: '@prop:host.yieldType', at: 'tileOf:host', count: { prop: 'yield', of: 'host' } },
    { op: 'spawn', type: '@prop:host.yieldType', at: 'tileOf:host', count: { prop: 'harvest', of: 'actor' } },
    ...(kind ? [{ op: 'spawn', type: '@prop:host.yieldType', at: 'tileOf:host', count: { prop: `harvest:${kind}`, of: 'actor' } } as Effect] : []),
    { op: 'spawn', type: '@prop:host.seedType', at: 'tileOf:host', count: { prop: 'seeds', of: 'actor', add: 2 } },
  ]
  const twice: Effect[] = [{ op: 'spawn', type: '@prop:host.yieldType', at: 'tileOf:host', count: { prop: 'yield', of: 'host' } }, log('A golden harvest — twice over!', '金色丰收——收成翻倍！')]
  const after = (golden: boolean): Tree =>
    IF(
      tag('host', 'perennial'),
      IF(tag('actor', 'skill:perennial-keeper'), DO(...yieldOf, ...(golden ? twice : []), log('You harvest {host}.', '你收割了{host}。'), { op: 'transform', into: '@prop:regrowType' }, vfx('leaves')), DO(...yieldOf, ...(golden ? twice : []), log('You harvest {host}.', '你收割了{host}。'), ...regrow, vfx('leaves'))),
      DO(...yieldOf, ...(golden ? twice : []), log('You harvest {host}.', '你收割了{host}。'), vfx('leaves', 'tileOf:host'), { op: 'destroy' }),
    )
  return IF(all(tag('actor', 'skill:golden-harvest'), { chance: 0.15 }), after(true), after(false))
}
/** The harvest of whatever kind the crop is (one rule, farm/harvest: the kind decides which farmer's skill adds more). */
function HARVEST_ANY(): Tree {
  const kinds = (i: number): Tree => (i < CROP_KINDS.length ? IF(tag('host', `crop:${CROP_KINDS[i]}`), HARVEST(CROP_KINDS[i]), kinds(i + 1)) : HARVEST())
  return IF(tag('instrument', 'tool:sickle'), kinds(0))
}
/** Picking a ripe crop by hand: one (two for Green Fingers) and a seed; a perennial grows back (as harvesting). */
function PICK(): Tree {
  const keep = (perennial: boolean): Tree => (perennial ? IF(tag('actor', 'skill:perennial-keeper'), DO(...picked, log('You pick {host}.', '你摘下了{host}。'), { op: 'transform', into: '@prop:regrowType' }, vfx('leaves')), DO(...picked, log('You pick {host}.', '你摘下了{host}。'), ...regrow, vfx('leaves'))) : DO(...picked, log('You pick {host}.', '你摘下了{host}。'), vfx('leaves', 'tileOf:host'), { op: 'destroy' }))
  return IF(tag('host', 'perennial'), keep(true), keep(false))
}
/** The kinds of crop a farmer may know best (life.ts; ontology.ts crop:<kind>). */
const CROP_KINDS = ['grain', 'herb', 'berry', 'root', 'gourd', 'fruit'] as const

const FARM: Rule[] = [
  ...useOrPut.map((on) =>
    rule({
      id: `farm/sow${on === 'act/put' ? '-put' : ''}`,
      label: L('Sow {instrument}', '播下{instrument}'),
      doc: 'A seed put on bare farmland takes root as its crop.',
      host: { tags: ['plantable'] },
      on,
      tree: IF(all(is('target', { type: 'tile/farmland' }), NOTHING_GROWS), DO(log('You sow {host}.', '你播下了{host}。'), { op: 'move', to: 'target' }, { op: 'transform', into: '@prop:cropType' }, vfx('dust'))),
    }),
  ),
  ...useOrPut.map((on) =>
    rule({
      id: `farm/plant-acorn${on === 'act/put' ? '-put' : ''}`,
      label: L('Plant {instrument}', '种下{instrument}'),
      doc: 'An acorn takes root in any diggable ground and becomes a tree in two game days.',
      host: { tags: ['acorn'] },
      on,
      tree: IF(all(is('target', { type: 'tile', tags: ['diggable'] }), NOTHING_GROWS), DO(log('You plant an acorn.', '你种下了一颗橡子。'), { op: 'move', to: 'target' }, { op: 'transform', into: '@prop:cropType' }, vfx('dust'))),
    }),
  ),
  rule({
    id: 'farm/water',
    label: L('Water {target}', '给{target}浇水'),
    doc: 'Water on a growing crop waters it (two hours later it grows a stage).',
    host: GROWING,
    on: 'impulse/element',
    // (Irrigation: the water stays twice as long; a Sprinkler waters the growing crops around too: life.ts farm/watered)
    tree: IF(all(param('element', 'water'), not(has('host', 'watered'))), WATER(), 'inherit'),
  }),
  ...useOrPut.map((on) =>
    rule({
      id: `farm/ash${on === 'act/put' ? '-put' : ''}`,
      label: L('Work {instrument} into {target}', '把{instrument}翻进{target}的土里'),
      doc: 'Ash worked into a growing crop\'s soil is used up.',
      host: { type: 'item/material/ash' },
      on,
      tree: IF(is('target', { ...GROWING, notStatus: ['fertilized'] }), DO(emit('coat', 'target', { substance: 'ash' }), { op: 'destroy' })),
    }),
  ),
  ...useOrPut.map((on) =>
    rule({
      id: `farm/fertilizer${on === 'act/put' ? '-put' : ''}`,
      label: L('Fertilize {target}', '给{target}施肥'),
      doc: 'Fertilizer (the stall\'s) worked into a growing crop\'s soil is used up.',
      host: { type: 'item/material/fertilizer' },
      on,
      tree: IF(is('target', { ...GROWING, notStatus: ['fertilized'] }), DO(emit('coat', 'target', { substance: 'fertilizer' }), { op: 'destroy' })),
    }),
  ),
  rule({
    id: 'farm/fertilize',
    label: L('Fertilize {target}', '给{target}施肥'),
    doc: 'Ash (or fertilizer) on a growing crop: one more of the crop at harvest.',
    host: GROWING,
    on: 'impulse/coat',
    tree: IF(
      all(any(param('substance', 'ash'), param('substance', 'fertilizer')), not(has('host', 'fertilized'))),
      IF(
        param('substance', 'ash'),
        // (Rich Soil: one more again: life.ts)
        DO(add('fertilized'), { op: 'addProp', key: 'yield', delta: { prop: 'fertilize', of: 'actor', add: 1 } }, vfx('sparkle'), log('You work ash into the soil.', '你把灰烬翻进了土里。')),
        DO(add('fertilized'), { op: 'addProp', key: 'yield', delta: { prop: 'fertilize', of: 'actor', add: 1 } }, vfx('sparkle'), log('You work fertilizer into the soil.', '你把肥料翻进了土里。')),
      ),
      'inherit',
    ),
  }),
  rule({
    id: 'farm/harvest',
    label: L('Harvest {target}', '收割{target}'),
    doc: 'A sickle harvests a ripe crop: its yield and two seeds (a perennial grows back); more by the harvester\'s skills — Bountiful, Farmer, the skill of the crop\'s kind (crop:<kind>), Golden Harvest, Perennial Keeper (life.ts).',
    host: { type: 'fixture', tags: ['crop', 'ripe'] },
    on: 'impulse/strike',
    tree: HARVEST_ANY(),
  }),
  rule({
    id: 'farm/pick',
    label: L('Pick {target}', '采摘{target}'),
    doc: 'Picking a ripe crop by hand: one of the crop and one seed (a perennial grows back).',
    host: { type: 'fixture', tags: ['crop', 'ripe'] },
    on: 'impulse/taken',
    tree: PICK(),
  }),
  rule({
    id: 'farm/dig-up',
    label: L('Dig up {target}', '挖出{target}'),
    doc: 'A shovel lifts a plant and gives back its seed.',
    host: CROP,
    on: 'impulse/strike',
    // (a Seed Saver gets two seeds more: life.ts)
    tree: IF(tag('instrument', 'tool:shovel'), DO(log('You dig up {host}.', '你挖出了{host}。'), { op: 'spawn', type: '@prop:host.seedType', at: 'tileOf:host', count: { prop: 'digSeeds', of: 'actor' } }, { op: 'transform', into: '@prop:seedType' }, vfx('dust'))),
  }),
]

// ------------------------------------------------------------------ animals and the world's clocks

const WORLD_RULES: Rule[] = [
  rule({
    id: 'world/clocks',
    doc: 'The world\'s clocks: what appears by itself appears (the ground\'s yield, creatures that come back, the night\'s walkers); rain wets the people and creatures out under it and douses fires; a storm\'s lightning seeks what stands tall.',
    host: { type: 'resident/world' },
    on: 'time/period',
    tree: IF(
      param('name', 'appear'),
      DO({ op: 'appear' }),
      IF(
        all(param('name', 'weather'), { weather: ['rain', 'storm'] }, { outdoors: true }),
        // rain is water without force: it wets and douses, it does not wound (a fire slime steams in it)
        // and falls only on what is out under the sky: under a roof one stays dry (world-model.md §5.3)
        DO(emit('element', { map: true, sky: true }, { element: 'water', power: 0 }, { filter: { type: 'actor' } }), emit('element', { map: true, sky: true }, { element: 'water', power: 0 }, { filter: { status: ['burning'] } })),
        IF(
          all(param('name', 'storm'), { weather: ['storm'] }, { outdoors: true }),
          DO({ op: 'lightning', power: 4 }),
          NOTHING,
        ),
      ),
    ),
  }),
  rule({
    id: 'story/topic',
    doc: 'News for the story: something people will talk about while it is fresh.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: IF(param('what', 'topic'), DO({ op: 'topic', id: '@param:value' }), 'inherit'),
  }),
]


// ------------------------------------------------------------------ the prologue, the village, professions (docs/prologue.md, quests.md, skill-tree.md)

const COMPANION: Selector = { type: 'actor', tags: ['companion'] }
const WAYPOINT: Selector = { type: 'fixture/sacred/waypoint' }

const JOURNEY: Rule[] = [
  rule({
    id: 'trainer/talk',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'A profession trainer, spoken to: a quest if they have one, a word, and the choice of profession (from level 5; a change gives back the profession branch\'s points); asked anything else, as anyone.',
    host: { type: 'actor/person/trainer' },
    on: 'impulse/handle',
    tree: IF({ same: ['host', 'actor'] }, 'inherit', IF(param('say', 'profession'), DO({ op: 'panel', panel: 'profession' }), IF({ param: { key: 'say', cmp: { ne: '' } } }, 'inherit', DO({ op: 'quest' }, { op: 'talk' }, { op: 'panel', panel: 'profession' })))),
  }),
  rule({
    id: 'companion/talk',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'A companion, spoken to (E), tells what the story asks for now and how (else what it last pointed out), and opens its panel: what the main road asks now, and the five seals\' powers, those taken up and those still sealed (one is changed only beside a woken waypoint). Asked to carry one of its boons (param boon, from that panel), it takes it up if a woken waypoint is near (boons.ts).',
    host: COMPANION,
    on: 'impulse/handle',
    tree: IF({ param: { key: 'boon', cmp: { ne: '' } } }, DO({ op: 'boon' }), DO({ op: 'say', text: '@guide' }, { op: 'panel', panel: 'companion' })),
  }),
  rule({
    id: 'light/told',
    doc: 'A light the story tells to go out or to burn (notify what = status, remove or add lit: a scene\'s `status`) answers itself: a flame taken, a lamp lit for a feast.',
    host: { type: 'fixture/light' },
    on: 'impulse/notify',
    tree: IF(all(param('what', 'status'), param('remove', 'lit')), DO(remove('lit')), IF(all(param('what', 'status'), param('add', 'lit')), DO(add('lit')), 'inherit')),
  }),
  rule({
    id: 'companion/struck',
    doc: 'A companion struck by the one it follows takes the blow as any blow, and says so: it is no silent target. A blow from anyone else is a blow.',
    host: COMPANION,
    on: 'impulse/strike',
    tree: IF({ leads: ['actor', 'host'] }, DO({ op: 'hurt', amount: POWER, blow: true }, { op: 'emote', mood: 'surprised' }, { op: 'say', text: L('Ow! It is me — watch where you swing!', '哎哟！是我呀——看着点再挥！') }), 'inherit'),
  }),
  rule({
    id: 'companion/boon',
    doc: 'A companion told it is given a boon (notify what = boon, param unlock: its id) keeps it, and carries it if it carries none (boons.ts).',
    host: COMPANION,
    on: 'impulse/notify',
    tree: IF(param('what', 'boon'), DO({ op: 'boon' }), 'inherit'),
  }),
  rule({
    id: 'companion/witness',
    doc: 'A companion sees someone try what the world has never seen (an act it has no answer for): it tells the story, which counts the experiments (the prologue waits for the first).',
    host: COMPANION,
    on: 'seen',
    tree: IF(all(param('defined', false), not(param('own', true))), DO(emit('notify', 'story', { what: 'experiment' })), NOTHING),
  }),
  rule({
    id: 'night/dawn',
    doc: 'The night-born crumble away in daylight, a few at a time.',
    host: { type: 'actor', tags: ['nightborn'] },
    on: 'time/period',
    tree: IF(all(param('name', 'dawn'), { night: false }, { chance: 0.5 }), DO(vfx('poof', 'tileOf:host'), { op: 'destroy' }), 'inherit'),
  }),
  // ---------------------------------------------------------------- quests (docs/quests.md)
  rule({
    id: 'story/quests',
    doc: 'The story is told an offer was taken on (what = accept, param quest: the actor took it from the source, its giver): the quest begins. Told facts to keep (what = facts: a quest\'s reward), it keeps them.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: IF(param('what', 'accept'), DO({ op: 'startQuest' }), IF(param('what', 'facts'), DO({ op: 'facts' }), 'inherit')),
  }),
  rule({
    id: 'story/manager',
    doc: 'The Story Manager: the story sees the world\'s news (a step played, a fact kept, a quest over, a place entered, the evening, a theft, the hungry): the quests that begin on it begin, the radiant offers on it are made (docs/quests.md §2.3).',
    host: { type: 'resident/story' },
    on: 'seen',
    tree: DO({ op: 'begin' }),
  }),
  rule({
    id: 'quest/news',
    doc: 'A quest sees news it listens for (who its taker spoke to, what was felled or is gone, what the taker holds and where they are, the story\'s facts, the other quests): it moves on as its triggers say.',
    host: { type: 'resident/quest' },
    on: 'seen',
    tree: DO({ op: 'advance' }),
  }),
  rule({
    id: 'quest/notify',
    doc: 'A quest told to reach a stage (what = stage, param n: a scene\'s, a rule\'s), to be taken on (accept: by the actor), turned down (decline), or that it failed (fail): it answers itself.',
    host: { type: 'resident/quest' },
    on: 'impulse/notify',
    tree: IF(param('what', 'stage'), DO({ op: 'stage', n: { param: 'n' } }), IF(param('what', 'accept'), DO({ op: 'accept' }), IF(param('what', 'decline'), DO({ op: 'decline' }), IF(param('what', 'fail'), DO({ op: 'failQuest' }), 'inherit')))),
  }),
  rule({
    id: 'quest/due',
    doc: 'A quest\'s time runs out (its status due): an offer is withdrawn, a quest under way fails.',
    host: { type: 'resident/quest' },
    on: 'time/timer',
    tree: IF(param('status', 'due'), DO({ op: 'failQuest' }), 'inherit'),
  }),
  rule({
    id: 'board/read',
    label: L('Look at {target}', '看看{target}'),
    doc: 'The commission board (docs/quests.md §3): read with a hand, it shows the favours people want done (its panel); asked to take one on (say quest), the quest named is taken on.',
    host: { type: 'fixture/sign/questboard' },
    on: 'impulse/handle',
    tree: IF(param('say', 'quest'), DO({ op: 'quest' }), DO({ op: 'panel', panel: 'board' })),
  }),
  rule({
    id: 'creature/not-taken',
    doc: 'People and creatures are not picked up (taking is physics: never asked).',
    host: ACTOR,
    on: 'impulse/taken',
    tree: DO(log('It cannot be picked up.', '这个拿不起来。')),
  }),
  rule({
    id: 'waypoint/attune',
    doc: 'A hand on a waypoint statue wakes it (once): it remembers you, and the world map (M) can take you to it. Woken, it hums, and opens the panel where the companion\'s boon is chosen.',
    host: WAYPOINT,
    on: 'impulse/handle',
    tree: IF(
      has('host', 'attuned'),
      AS(L('Listen to {target}', '倾听{target}'), DO(log('The statue hums. Open the map (M) to travel to another one.', '雕像嗡嗡作响。打开地图（M）就能传送到别的传送雕像。'), { op: 'panel', panel: 'boons' })),
      AS(L('Wake {target}', '唤醒{target}'), DO(add('attuned'), emit('notify', 'story', { what: 'waypoint' }), emit('notify', 'actor', { what: 'home', value: { idOf: 'host' } }), vfx('heal'), log('The statue wakes under your hand. (M: the map — travel to any statue you have woken.)', '雕像在你手下亮了起来。（M：地图——可以传送到任何唤醒过的传送雕像。）'))),
    ),
  }),
  rule({
    id: 'skill/firemaker',
    label: L('Light {target} with {instrument}', '用{instrument}点燃{target}'),
    doc: 'A firemaker (the skill) works a plain stick until a campfire, brazier or candles catch.',
    host: { type: 'item/material/stick' },
    on: 'act/use',
    tree: IF(
      all(tag('actor', 'skill:firemaker'), is('target', { tags: ['lightable'], notStatus: ['lit', 'wet'] })),
      DO(emit('element', 'target', { element: 'fire', power: 2 }), log('You work the stick until {target} catches.', '你钻木生火，{target}被点燃了。')),
      'inherit',
    ),
  }),
  rule({
    id: 'fixture/receive',
    label: L('Set {instrument} down by {target}', '把{instrument}放在{target}旁'),
    doc: 'Something put on a thing nothing else defines (a grass tuft, a boulder, a statue) is set down on that thing\'s tile (putting is physics: never asked).',
    host: { type: 'fixture' },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), log('You set {item} down by {host}.', '你把{item}放在了{host}旁。'))),
  }),
  rule({
    id: 'body/fireproof',
    doc: 'The fireproof draught\'s coat: fire does a quarter of its harm for five minutes.',
    host: ACTOR,
    on: 'impulse/coat',
    tree: IF(param('substance', 'fireproof'), DO(add('fireproof', 3000), vfx('sparkle'), log('A cool calm spreads under your skin: fire will hardly touch you now.', '一股清凉在皮肤下散开：火现在几乎伤不到你了。')), 'inherit'),
  }),
  rule({
    id: 'use/drink-fireproof',
    doc: 'The fireproof draught, drunk — by oneself, or by another it is given to.',
    host: { type: 'item/potion/fire_resist' },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      AS(L('Drink {instrument}', '喝掉{instrument}'), ASK(L('Drink {instrument}?', '要喝掉{instrument}吗？'), emit('coat', 'actor', { substance: 'fireproof' }), { op: 'destroy' })),
      IF(is('target', { type: 'actor' }), AS(L('Give {instrument} to {target} to drink', '给{target}喝{instrument}'), DO(emit('coat', 'target', { substance: 'fireproof' }), log('You give {target} {host}.', '你给{target}喝下了{host}。'), { op: 'destroy' })), 'inherit'),
    ),
  }),
]

// ------------------------------------------------------------------ the overworld (world-model.md §5.1, §5.6)


// ------------------------------------------------------------------ building (world-model.md §6.6, §6.7)

const BUILDING: Rule[] = [
  rule({
    id: 'build/door-open',
    doc: 'A shut door taken hold of opens: what walks may pass.',
    host: { type: 'structure/door' },
    on: 'impulse/handle',
    tree: AS(L('Open {target}', '打开{target}'), DO({ op: 'transform', into: 'structure/door/open' }, vfx('dust'))),
  }),
  rule({
    id: 'build/door-shut',
    doc: 'An open door taken hold of shuts.',
    host: { type: 'structure/door/open' },
    on: 'impulse/handle',
    // (its name is "Open Door": the label names the act, not the state again)
    tree: AS(L('Close the door', '关上门'), DO({ op: 'transform', into: 'structure/door' }, vfx('dust'))),
  }),
  rule({
    id: 'bed/sleep',
    label: L('Sleep', '睡觉'),
    doc: 'A bed, taken hold of: one lies down and sleeps until it is time to rise (a bed in a bedroom gives a full night\'s rest).',
    host: { type: 'fixture/furniture/bed' },
    on: 'impulse/handle',
    // the bed one sleeps in is one's home: one rises there again after a fall
    tree: DO(log('You lie down.', '你躺了下来。'), emit('notify', 'actor', { what: 'home', value: { idOf: 'host' } }), emit('restore', 'actor', { which: 'sleep' })),
  }),
  rule({
    id: 'build/stack',
    label: L('Stack {instrument} on {target}', '把{instrument}叠在{target}上'),
    doc: 'Something put on a built thing goes on top of it: it comes to rest on the lowest storey with room for it there (a floor laid over a wall, a bed set on a floor).',
    host: { type: 'structure' },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'))),
  }),
  rule({
    id: 'build/collapse',
    doc: 'A floor that loses what held it up (the wall under it broken) and has nothing else to hold it comes down: it breaks, and what stood on it falls. One taken down into a bag or a hand has not lost its footing: it was carried off.',
    host: { props: { needsSupport: true } },
    on: 'contact/end',
    tree: IF(all(param('how', 'support'), not({ rel: { role: 'host', how: 'support' } }), not({ rel: { role: 'host', how: 'in' } }), not({ rel: { role: 'host', how: 'held' } })), DO(vfx('dust', 'tileOf:host'), log('{host} comes down.', '{host}塌了下来。'), { op: 'setProp', key: 'hp', value: 0 }), 'inherit'),
  }),
]

/**
 * The ways the story opens on the world map: a place whose `opensWhen` is the fact is sealed until the story
 * sets it (as a portal's `opensWhen`), and says why. Beyond the White Knight on the East Road: Emberfall and
 * all east of it.
 */
export const SITE_GATES: { fact: string; say: { en: string; zh: string } }[] = [
  { fact: CH1.knight, say: L('The White Knight still holds the East Road. There is no way past him yet.', '白骑士还守在东大路上，暂时过不去。') },
]

/** A tent with a room behind its flap (its `interior`, `interiorX`, `interiorY`): a hand on it, and in one goes. */
const TENTS: Rule[] = [
  rule({
    id: 'tent/enter',
    label: L('Go into {target}', '进入{target}'),
    doc: 'A hand on a tent that has a room (its interior props): one goes in, out again by its flap in front of it. A tent with none: no change.',
    host: { type: 'fixture/tent' },
    on: 'impulse/handle',
    tree: IF(
      { prop: { role: 'host', key: 'interior', cmp: { ne: '' } } },
      DO(emit('push', 'actor', { map: { prop: 'interior', of: 'host' }, x: { prop: 'interiorX', of: 'host' }, y: { prop: 'interiorY', of: 'host' } })),
      'inherit',
    ),
  }),
]

const SITES: Rule[] = [
  rule({
    id: 'site/enter',
    label: L('Enter {target}', '进入{target}'),
    doc: 'Empty hands on a place of the overworld: one goes in — pushed into the map it stands for, on the side one stands; a place the story has not opened yet (its `opensWhen` fact unset) says why and stays shut.',
    host: SITE,
    on: 'impulse/handle',
    tree: SITE_GATES.reduceRight<Tree>(
      (open, g) => IF({ all: [{ prop: { role: 'host', key: 'opensWhen', cmp: g.fact } }, { prop: { role: 'story', key: g.fact, cmp: 0, default: 0 } }] }, AS(L('Sealed: {target}', '未开放：{target}'), DO(log(g.say.en, g.say.zh))), open),
      DO(emit('push', 'actor', { map: { prop: 'map', of: 'host' } })),
    ),
  }),
  rule({
    id: 'site/far',
    label: L('Out of reach — go in first (E)', '够不着——先进去（E）'),
    doc: 'Anything else done to a place of the overworld (a blow, something put, taken) is out of reach: defined, nothing changes (the question would mix scales).',
    host: SITE,
    on: 'impulse',
    tree: DO(TOO_FAR),
  }),
]


// ------------------------------------------------------------------ the general cases (2026-10-09)
// What a player expects of a class without its sub-types asking one by one (design.md §5.16: the
// learned layer answers one type at one leaf; what holds for a class is the base's). Each ends in
// `inherit` where a sub-type, or the AI, may still have something to say.

const CREATURE: Selector = { type: 'actor/creature' }

const GENERAL: Rule[] = [
  rule({
    id: 'creature/offered',
    doc: 'A creature held out a thing: something fibrous lashes it down (the rope goes onto it); something edible it snaps up (the food is told it is eaten: food/eaten); anything else, and anything offered a boss, is its own kind\'s to answer (undefined at the root).',
    host: CREATURE,
    on: 'impulse/offered',
    tree: IF(
      any({ same: ['host', 'actor'] }, tag('host', 'boss')),
      'inherit',
      IF(
        all(tag('item', 'fiber'), not(has('host', 'frozen'))),
        AS(L('Bind {target} with {instrument}', '用{instrument}捆住{target}'), DO(add('frozen', 30), taken('contents'), vfx('dust'), log('{host} is lashed down with {item}.', '{host}被{item}捆住了。'))),
        IF(
          tag('item', 'edible'),
          AS(L('Feed {instrument} to {target}', '给{target}吃{instrument}'), DO(emit('notify', 'item', { what: 'eaten' }), { op: 'emote', mood: 'happy' }, vfx('sparkle'), log('{host} snaps up {item}.', '{host}一口吞下了{item}。'))),
          'inherit',
        ),
      ),
    ),
  }),
  rule({
    id: 'food/eaten',
    doc: 'Food told it is eaten (snapped up by a creature it was held out to: creature/offered) is gone; any other news it only notes.',
    host: { tags: ['edible'] },
    on: 'impulse/notify',
    tree: IF(param('what', 'eaten'), DO({ op: 'destroy' }), 'inherit'),
  }),
  rule({
    id: 'creature/handle',
    label: L('Reach out to {target}', '向{target}伸手'),
    doc: 'A bare hand reached toward a wild creature: it snaps at the hand and takes the reacher for a foe. An animal is its own to answer.',
    host: CREATURE,
    on: 'impulse/handle',
    tree: IF(
      any({ same: ['host', 'actor'] }, tag('host', 'animal')),
      'inherit',
      DO(emit('strike', 'actor', { power: { prop: 'atk', of: 'host' }, edge: 'pierce' }), { op: 'foe' }, { op: 'emote', mood: 'angry' }, vfx('hit', 'actor'), log('{host} snaps at the outstretched hand!', '{host}朝伸来的手猛咬一口！')),
    ),
  }),
  rule({
    id: 'tile/handle',
    label: L('Touch {target}', '摸摸{target}'),
    doc: 'A bare hand on the ground, a floor or any other cell with no answer of its own: it is only touched (a place of the overworld is entered instead: site/enter).',
    host: { type: 'tile' },
    on: 'impulse/handle',
    tree: IF(tag('host', 'overworld'), 'inherit', DO(vfx('dust'), log('Your hand brushes {host}. Nothing comes of it.', '你的手拂过{host}。什么也没有发生。'))),
  }),
  rule({
    id: 'fire/warm-hands',
    label: L('Warm yourself at {target}', '在{target}旁取暖'),
    doc: 'A bare hand at a lit fire: the wet and the frozen dry and thaw in its heat (the fire reaches them, gently); the rest only feel its warmth.',
    host: { type: 'fixture', tags: ['lightable'], status: ['lit'] },
    on: 'impulse/handle',
    tree: IF(
      any(has('actor', 'wet'), has('actor', 'frozen')),
      DO(emit('element', 'actor', { element: 'fire', power: 0 }), log('You warm yourself at {host}; the damp steams off you.', '你在{host}旁取暖，湿气蒸发了。')),
      DO(vfx('heal', 'actor'), log('Warmth from {host} seeps into your hands.', '{host}的暖意渗进手心。')),
    ),
  }),
  rule({
    id: 'smelt/ore',
    doc: 'Ore used on a lit forge is smelted into its bar (the ore\'s `smelts`); a cold forge only wants fire first. On anything else, undefined.',
    host: { type: 'item/material', tags: ['ore'] },
    on: 'act/use',
    tree: IF(
      is('target', { type: 'fixture/craft/forge', status: ['lit'] }),
      AS(L('Smelt {instrument} in {target}', '在{target}里熔炼{instrument}'), DO({ op: 'transform', into: '@prop:smelts' }, vfx('smoke', 'target'), log('The ore glows in {target} and runs into a bar.', '矿石在{target}中烧得通红，熔成了一块金属锭。'))),
      IF(is('target', { type: 'fixture/craft/forge' }), AS(L('Smelt {instrument} in {target}', '在{target}里熔炼{instrument}'), DO(log('{target} is cold. It wants a fire first.', '{target}是冷的，得先生火。'))), 'inherit'),
    ),
  }),
  rule({
    id: 'companion/stuck',
    doc: 'A companion that is down cannot follow: it stays where it fell until it comes to.',
    host: COMPANION,
    on: 'stuck',
    tree: IF(has('host', 'down'), DO({ op: 'emote', mood: 'sad' }, log('{host} lies where it fell, too weak to follow.', '{host}倒在原地，虚弱得跟不上。')), 'inherit'),
  }),
]

export const BASE_RULES: Rule[] = [...ROOTS, ...BODIES, ...PEOPLE, ...SOCIAL_RULES, ...FAITH_RULES, ...INSTRUMENTS, ...PLACING, ...GROUND, ...FIRE, ...BUILD, ...FARM, ...WORLD_RULES, ...JOURNEY, ...SITES, ...TENTS, ...BUILDING, ...HOMESTEAD_RULES, ...GENERAL, ...LIFE_RULES, ...VILLAGE_SHOP_RULES]
