// The base rule library (design.md §5.6–5.9): every mechanic of the world as the nature of a
// host. A rule says what a class of thing does when an event happens to it; it writes only that
// thing, and affects others by emitting impulses they answer for themselves. The root rules make
// resolution total: deliberate acts and impulses are undefined at the root (the AI answers them),
// contact, time and sight are no change, elements follow physics. Anything these rules leave
// undefined is the Mod port's.

import { NIGHT_CAP, type Amount, type Cond, type Effect, type EmitTo, type Impulse, type PropValue, type RoleName, type RoleRef, type Rule, type Selector, type Tree } from '@lsw/engine'

const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })
const L = (en: string, zh: string) => ({ en, zh })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: L(en, zh) })
const say = (en: string, zh: string, who?: RoleName): Effect => ({ op: 'say', text: L(en, zh), ...(who && { who }) })
const vfx = (fx: string, at?: RoleRef): Effect => ({ op: 'vfx', fx, ...(at && { at }) })
const emit = (impulse: Impulse, to: EmitTo, params?: Record<string, PropValue | Amount | { typeOf: RoleName }>, extra: Partial<Extract<Effect, { op: 'emit' }>> = {}): Effect => ({ op: 'emit', impulse, to, ...(params && { params }), ...extra })
const add = (status: string, duration?: number): Effect => ({ op: 'addStatus', status, ...(duration && { duration }) })
const remove = (status: string): Effect => ({ op: 'removeStatus', status })
const DO = (...effects: Effect[]): Tree => ({ do: effects })
const ASK = (confirm: { en: string; zh: string }, ...effects: Effect[]): Tree => ({ do: effects, confirm })
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
/** What a blow carries beyond its power, passed on to the strike (combat.ts): a bleed it opens, health it draws back. */
const WOUND = { bleed: { param: 'bleed' }, drain: { param: 'drain' } }
/** What burning takes from a thing with durability (nothing from one without: it cannot break). */
const WEAR: Effect = { op: 'hurt', amount: 1, element: 'fire', pierce: true }
const spread = (chance: number): Effect => emit('element', { area: { radius: 1 } }, { element: 'fire', power: 1 }, { chance, filter: { tags: ['flammable'], notStatus: ['wet', 'burning', 'frozen'] } })

// ------------------------------------------------------------------ the roots: resolution is total

const ROOTS: Rule[] = [
  rule({
    id: 'core/use',
    doc: 'Using a thing on something is undefined unless its nature says (the AI answers); a bare hand strikes what a blow is aimed at (and any creature), and handles anything else.',
    on: 'act/use',
    tree: IF(
      { none: 'instrument' },
      IF(any(param('attack', true), is('target', { type: 'actor/creature' })), DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'blunt', ...WOUND })), DO(emit('handle', 'target'))),
      HOLE(log('Nothing happens.', '什么也没有发生。')),
    ),
  }),
  rule({
    id: 'core/put',
    doc: 'Putting the host somewhere: an actor is offered it, anything else receives it.',
    on: 'act/put',
    tree: IF(is('target', { type: 'actor' }), DO(emit('offered', 'target', undefined, { item: 'host' })), DO(emit('receive', 'target', undefined, { item: 'host' }))),
  }),
  rule({ id: 'core/take', doc: 'Taking the target with the hands: it is taken (and answers how).', on: 'act/take', tree: DO(emit('taken', 'target', { into: { param: 'into' }, quiet: { param: 'quiet' } }, { other: 'actor' })) }),
  rule({ id: 'core/hands', doc: 'A bare hand on the target: it is handled (and answers how).', on: 'act/hands', tree: DO(emit('handle', 'target')) }),
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
    doc: 'A portable thing taken moves into the taker\'s hand (or bag, or onto the ground); anything else is undefined.',
    on: 'impulse/taken',
    tree: IF(
      is('host', { tags: ['portable'] }),
      IF(
        param('into', 'contents'),
        DO({ op: 'move', to: 'other', into: 'contents' }),
        IF(param('into', 'tile'), DO({ op: 'move', to: 'other', into: 'tile' }), IF(param('quiet', true), DO({ op: 'move', to: 'other', into: 'hand' }), DO({ op: 'move', to: 'other', into: 'hand' }, log('You take {host}.', '你拿起了{host}。')))),
      ),
      HOLE(log('That stays where it is.', '这个拿不走。')),
    ),
  }),
  rule({ id: 'core/receive', doc: 'Something put on a thing with no answer of its own: undefined.', on: 'impulse/receive', tree: HOLE(log('There is no room there.', '那里放不下。')) }),
  rule({ id: 'core/offered', doc: 'Something offered with no answer of its own: undefined.', on: 'impulse/offered', tree: HOLE() }),
  rule({
    id: 'core/restore',
    doc: 'Health or hunger given back.',
    on: 'impulse/restore',
    tree: IF(param('which', 'hunger'), DO({ op: 'feed', amount: { param: 'amount' } }), DO({ op: 'heal', amount: { param: 'amount' } })),
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
              all(tag('host', 'lightable'), not(has('host', 'lit'))),
              DO(add('lit'), vfx('fire_burst')),
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
          IF(has('host', 'burning'), DO(remove('burning'), vfx('steam')), IF(has('host', 'wet'), DO(add('frozen'), vfx('frost')), NOTHING)),
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
  rule({ id: 'core/threshold', doc: 'Gaining or losing a status, crossing a line: no change unless the host says.', on: 'threshold', tree: NOTHING }),
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

const BODIES: Rule[] = [
  rule({
    id: 'combat/struck',
    doc: 'An actor struck loses health (a frozen one shatters under a blunt or earthen blow); the one who struck becomes its foe; the element of the blow reaches it.',
    host: ACTOR,
    on: 'impulse/strike',
    tree: IF(
      all(has('host', 'frozen'), any(param('edge', 'blunt'), param('element', 'earth'))),
      DO(remove('frozen'), { op: 'hurt', amount: { param: 'power', mul: 1.5 } }, { op: 'foe' }, vfx('shatter')),
      IF(
        { param: { key: 'element', cmp: { ne: '' } } },
        DO({ op: 'hurt', amount: POWER }, { op: 'foe' }, vfx('hit'), emit('element', 'host', { element: ELEMENT, power: POWER })),
        DO({ op: 'hurt', amount: POWER }, { op: 'foe' }, vfx('hit')),
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
    doc: 'At no health: the essential (people, the player) go down for a while (as anything essential); the rest are gone — they drop what they carried and what they leave behind, and the one who struck learns from it.',
    host: ACTOR,
    on: 'threshold/cross',
    tree: IF(
      param('name', 'broken'),
      IF(
        tag('host', 'essential'),
        'inherit',
        DO(
          { op: 'dropContents', still: true },
          { op: 'spawn', type: '@prop:host.drop', at: 'tileOf:host', count: { prop: 'drops', of: 'host' }, still: true },
          emit('notify', 'actor', { what: 'defeat', xp: { prop: 'maxHp', of: 'host' } }),
          // the story hears what fell, and to whom (quests count it)
          emit('notify', 'story', { what: 'defeat', type: { typeOf: 'host' } }),
          vfx('poof', 'tileOf:host'),
          log('{host} is defeated.', '{host}被打倒了。'),
          { op: 'destroy' },
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
    doc: 'Whoever defeated a foe gains experience as much as its full health (and is rewarded with experience when a quest is handed in). A mage felling a foe with a focus mends 3 (Arcane Recovery); an assassin felling one up close mends a tenth of their health (Shadow Recovery).',
    host: ACTOR,
    on: 'impulse/notify',
    tree: IF(
      param('what', 'defeat'),
      IF(
        all(tag('host', 'skill:arcane-recovery'), is('instrument', { type: 'item/weapon/magic' })),
        DO({ op: 'gainXp', amount: { param: 'xp' } }, { op: 'heal', amount: 3 }),
        IF(
          all(tag('host', 'skill:shadow-recovery'), not(is('instrument', { type: 'item/weapon/magic' })), not(is('instrument', { type: 'item/weapon/ranged' }))),
          DO({ op: 'gainXp', amount: { param: 'xp' } }, { op: 'heal', amount: { prop: 'maxHp', of: 'host', mul: 0.1 } }),
          DO({ op: 'gainXp', amount: { param: 'xp' } }),
        ),
      ),
      IF(param('what', 'reward'), DO({ op: 'gainXp', amount: { param: 'xp' } }), 'inherit'),
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
    id: 'body/hunger',
    doc: 'Hunger (Minecraft\'s food bar): it drains; well fed (90 % and up) the body heals, starving (0) it loses health, but never the last point.',
    host: { type: 'actor', props: { maxHunger: { gt: 0 } }, notStatus: ['down'] },
    on: 'time/period',
    tree: IF(
      param('name', 'hunger'),
      DO({ op: 'addProp', key: 'hunger', delta: -1, min: 0 }),
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
    doc: 'The story tells a person where it stands (the player\'s stage): they keep it.',
    host: PERSON,
    on: 'impulse/notify',
    tree: IF(
      param('what', 'quest'),
      DO({ op: 'setProp', key: 'quest', value: { param: 'value' } }),
      IF(param('what', 'prologue'), DO({ op: 'setProp', key: 'prologue', value: { param: 'value' } }), 'inherit'),
    ),
  }),
]

// ------------------------------------------------------------------ people: hands, gifts, sight, days

const PEOPLE: Rule[] = [
  rule({
    id: 'people/talk',
    doc: 'A hand on a person: a quest they have for you (handed in, taken on, a word they were to hear — docs/quests.md), else what fits the moment.',
    host: PERSON,
    on: 'impulse/handle',
    tree: IF({ same: ['host', 'actor'] }, 'inherit', DO({ op: 'quest' })),
  }),
  rule({
    id: 'people/accept',
    doc: 'A person handed a thing takes it and says what they make of it.',
    host: PERSON,
    on: 'impulse/offered',
    tree: IF({ same: ['host', 'actor'] }, 'inherit', DO(taken('contents'), { op: 'say', text: '@given' })),
  }),
  rule({
    id: 'seen/owner-take',
    doc: 'A person who sees someone take what is theirs objects (and people talk).',
    host: PERSON,
    on: 'seen',
    tree: IF(all(param('act', 'take'), param('owner', 'mine')), DO(say('Hey — that is mine.', '喂——那是我的。'), { op: 'emote', mood: 'angry' }, emit('notify', 'story', { what: 'topic', value: 'theft', days: 2 }))),
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

const USE: Selector[] = []
void USE
const useOrPut = ['act/use', 'act/put'] as const

const INSTRUMENTS: Rule[] = [
  rule({
    id: 'use/eat',
    confirm: L('Eat {instrument}?', '要吃掉{instrument}吗？'),
    doc: 'Food used on oneself feeds hunger (Minecraft): health comes back from being well fed, not from the bite.',
    host: { tags: ['edible'] },
    on: 'act/use',
    tree: IF({ same: ['actor', 'target'] }, DO(emit('restore', 'actor', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), emit('notify', 'story', { what: 'meal' }), log('You eat {host}.', '你吃掉了{host}。'), { op: 'destroy' })),
  }),
  rule({
    id: 'use/eat-medicine',
    confirm: L('Eat {instrument}?', '要吃掉{instrument}吗？'),
    doc: 'Medicine eaten (a healing herb) heals as well as it feeds.',
    host: { tags: ['edible', 'medicinal'] },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      DO(emit('restore', 'actor', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), emit('restore', 'actor', { which: 'hunger', amount: { prop: 'food', of: 'host' } }), vfx('heal', 'actor'), log('You eat {host}.', '你吃掉了{host}。'), { op: 'destroy' }),
    ),
  }),
  rule({
    id: 'use/drink',
    confirm: L('Drink {instrument}?', '要喝掉{instrument}吗？'),
    doc: 'A drink used on oneself heals.',
    host: { tags: ['drinkable'] },
    on: 'act/use',
    tree: IF({ same: ['actor', 'target'] }, DO(emit('restore', 'actor', { which: 'hp', amount: { prop: 'heal', of: 'host', add: 1 } }), vfx('heal', 'actor'), log('You drink {host}.', '你喝下了{host}。'), { op: 'destroy' })),
  }),
  rule({
    id: 'use/water',
    doc: 'Water poured on something (or drunk, if it is oneself): water reaches it, and the vessel is empty. Putting a vessel down only sets it down.',
    host: { tags: ['liquid:water'] },
    on: 'act/use',
    tree: IF(
      { same: ['actor', 'target'] },
      ASK(L('Drink {instrument}?', '要喝掉{instrument}吗？'), emit('restore', 'actor', { which: 'hp', amount: 2 }), { op: 'transform', into: '@prop:emptyType' }, log('Refreshing.', '清凉解渴。')),
      IF(is('target', { tags: ['water'] }), 'inherit', DO(emit('element', 'target', { element: 'water', power: 1 }), { op: 'transform', into: '@prop:emptyType' }, log('You pour water on {target}.', '你把水泼在了{target}上。'))),
    ),
  }),
  rule({
    id: 'use/oil',
    doc: 'Oil poured on something coats it; the vessel is empty.',
    host: { tags: ['liquid:oil'] },
    on: 'act/use',
    tree: IF(any({ same: ['actor', 'target'] }, is('target', { tags: ['water'] })), 'inherit', DO(emit('coat', 'target', { substance: 'oil' }), { op: 'transform', into: '@prop:emptyType' }, log('Slick oil coats {target}.', '{target}被泼上了一层滑腻的油。'))),
  }),
  ...useOrPut.map((on) =>
    rule({
      id: `use/fill${on === 'act/put' ? '-put' : ''}`,
      doc: 'An empty vessel at water (a well, a fountain, a lake) fills.',
      host: { tags: ['empty-vessel'] },
      on,
      tree: IF(is('target', { tags: ['water-source'] }), DO({ op: 'transform', into: '@prop:waterType' }, vfx('splash', 'target'), log('Filled with water.', '你装满了水。'))),
    }),
  ),
  rule({
    id: 'use/fire',
    doc: 'A flame held to something: fire reaches it (the flammable burn, the lightable are lit). A torch put down is only set down.',
    host: { tags: ['fire-source'] },
    on: 'act/use',
    tree: IF({ same: ['actor', 'target'] }, 'inherit', DO(emit('element', 'target', { element: 'fire', power: 2 }))),
  }),
  rule({
    id: 'use/cook',
    doc: 'Raw food held over a lit fire cooks.',
    host: { tags: ['cookable', 'raw'] },
    on: 'act/use',
    tree: IF(is('target', { tags: ['cookware'], status: ['lit'] }), DO({ op: 'transform', into: '@prop:cookedType' }, vfx('smoke', 'target'), log('It sizzles and cooks.', '滋滋作响，熟了。'))),
  }),
  rule({
    id: 'use/blade',
    doc: 'A blade used on something (not a person) strikes it with a cutting edge.',
    host: { type: 'item/weapon/blade' },
    on: 'act/use',
    tree: IF(is('target', PERSON), 'inherit', DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'cut', ...WOUND }))),
  }),
  rule({
    id: 'use/weapon',
    doc: 'A weapon used on something (not a person) strikes it.',
    host: { type: 'item/weapon' },
    on: 'act/use',
    tree: IF(is('target', PERSON), 'inherit', DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'blunt', ...WOUND }))),
  }),
  rule({
    id: 'use/spell',
    doc: 'A wand cast at something (not a person) strikes it with its element.',
    host: { type: 'item/weapon/magic' },
    on: 'act/use',
    tree: IF(is('target', PERSON), 'inherit', DO(emit('strike', 'target', { power: POWER, element: ELEMENT, edge: 'magic', ...WOUND }))),
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
      doc: `A ${t.slice(5)} works what it is used on: a blow with a ${edge} edge.`,
      host: { tags: [t] },
      on: 'act/use',
      tree: IF(any({ same: ['actor', 'target'] }, is('target', PERSON)), 'inherit', DO(emit('strike', 'target', { power: POWER, edge, ...WOUND }))),
    }),
  ),
  ...(['key', 'writing', 'tool:fishing'] as const).map((t) =>
    rule({
      id: `use/${t.replace('tool:', '')}`,
      doc: 'A key, a quill, a fishing line: a careful hand on the target, with the instrument in it.',
      host: { tags: [t] },
      on: 'act/use',
      tree: IF({ same: ['actor', 'target'] }, 'inherit', DO(emit('handle', 'target'))),
    }),
  ),
  rule({
    id: 'use/rope',
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
    doc: 'Open ground takes what is put down on it.',
    host: { type: 'tile', notTags: ['solid', 'liquid'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), log('You put down {item}.', '你放下了{item}。'))),
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
    doc: 'Lava takes what is put in it (and burns what can burn).',
    host: { type: 'tile', tags: ['molten'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), vfx('fire_burst'))),
  }),
  rule({
    id: 'core/receive-item',
    doc: 'Something put on a loose item lies beside it.',
    host: { type: 'item' },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), log('You put down {item}.', '你放下了{item}。'))),
  }),
  rule({
    id: 'core/receive-surface',
    doc: 'A table, counter, bench or altar takes what is set on it (it lies on that tile).',
    host: { type: 'fixture', tags: ['surface'] },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', DO(taken('tile'), log('You set {item} on {host}.', '你把{item}放在了{host}上。'))),
  }),
  rule({
    id: 'core/receive-store',
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
    doc: 'A lit fire takes what is fed to it: the flammable burn there; raw food is held to it.',
    host: { tags: ['lightable'], status: ['lit'] },
    on: 'impulse/receive',
    tree: IF(
      is('item', { tags: ['cookable', 'raw'] }),
      DO(emit('element', 'item', { element: 'fire', power: 1 })),
      IF(is('item', { tags: ['flammable'] }), DO(taken('tile'), emit('element', 'item', { element: 'fire', power: 3 }), log('{item} goes into the fire.', '{item}被丢进了火里。')), 'inherit'),
    ),
  }),
  rule({
    id: 'element/cook',
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
    doc: 'A hand opens or closes a container; a key locks or unlocks it.',
    host: CONTAINER,
    on: 'impulse/handle',
    tree: IF(
      tag('instrument', 'key'),
      IF(tag('host', 'locked'), DO({ op: 'removeTag', tag: 'locked' }, { op: 'open' }, vfx('sparkle'), log('Click. It opens.', '咔哒一声，开了。')), IF(has('host', 'open'), 'inherit', DO({ op: 'addTag', tag: 'locked' }, vfx('sparkle'), log('Click. It is locked.', '咔哒一声，锁上了。')))),
      IF(tag('host', 'locked'), DO(say('Locked.', '锁住了。', 'actor')), DO({ op: 'open' }, vfx('dust'))),
    ),
  }),
  rule({
    id: 'core/read',
    doc: 'A hand on something written: it is read.',
    host: { type: 'fixture', tags: ['readable'] },
    on: 'impulse/handle',
    tree: DO({ op: 'say', text: '@line' }),
  }),
]

// ------------------------------------------------------------------ the ground and the trees

const LIVING_TREE: Selector = { type: 'tile', tags: ['tree', 'flammable'] }
const STUMP: Selector = { type: 'tile/stump' }
const NOBODY_HERE: Cond = { count: { role: 'host', in: 'tile', match: { type: 'actor' }, cmp: { eq: 0 } } }
const FELL: Effect[] = [remove('notched'), { op: 'transform', into: 'tile/stump' }, add('regrowing'), { op: 'spawn', type: 'item/material/log', at: 'host', count: 2 }, { op: 'spawn', type: 'item/material/stick', at: 'host' }, vfx('leaves'), log('Timber!', '树倒了！')]

const GROUND: Rule[] = [
  rule({
    id: 'wood/notch',
    doc: 'An axe on a living tree bites into it: it loses durability (as any blow) and shows a notch, which heals if the tree is left alone.',
    host: LIVING_TREE,
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:axe'), DO({ op: 'hurt', amount: POWER, blow: true }, add('notched'), vfx('leaves'), log('The axe bites into {host}.', '斧头砍进了{host}。')), 'inherit'),
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
    id: 'wood/regrow',
    doc: 'A stump left alone grows back into a tree (someone standing on it: it waits an hour).',
    host: STUMP,
    on: 'time/timer',
    tree: IF(param('status', 'regrowing'), IF(NOBODY_HERE, DO({ op: 'transform', into: 'tile/tree' }, vfx('leaves')), DO(add('regrowing', 600)))),
  }),
  rule({
    id: 'wood/uproot',
    doc: 'A shovel digs a stump out for good.',
    host: STUMP,
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:shovel'), DO({ op: 'spawn', type: 'item/material/stick', at: 'host' }, vfx('dust'), log('You dig out the stump.', '你把树桩挖了出来。'), { op: 'destroy' })),
  }),
  rule({
    id: 'wood/char',
    doc: 'An axe breaks a charred tree down to coal.',
    host: { type: 'tile/charred_tree' },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:axe'), DO({ op: 'spawn', type: 'item/material/coal', at: 'host' }, vfx('dust'), log('The charred wood crumbles to coal.', '焦木碎成了煤炭。'), { op: 'destroy' })),
  }),
  rule({
    id: 'wood/split',
    doc: 'An axe splits a log into two planks.',
    host: { type: 'item/material/log' },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:axe'), DO(log('You split the log into planks.', '你把木头劈成了木板。'), { op: 'transform', into: 'item/material/plank' }, { op: 'spawn', type: 'item/material/plank', at: 'tileOf:host' }, vfx('dust'))),
  }),
  rule({
    id: 'farm/till',
    doc: 'A hoe turns diggable ground into farmland.',
    host: { type: 'tile', tags: ['diggable'] },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:hoe'), DO({ op: 'transform', into: 'tile/farmland' }, vfx('dust'))),
  }),
  rule({
    id: 'core/fish',
    doc: 'A line cast into water: sometimes something bites.',
    host: { type: 'tile', tags: ['water'] },
    on: 'impulse/handle',
    tree: IF(
      tag('instrument', 'tool:fishing'),
      IF({ chance: 0.35 }, DO({ op: 'spawn', type: 'item/food/fish/raw', at: 'actor', into: 'contents' }, vfx('splash'), log('A tug — you reel in a fish!', '一沉——你拉上来一条鱼！')), DO(vfx('splash'), log('The float bobs. Nothing bites — yet.', '浮漂晃了晃。还没咬钩。'))),
    ),
  }),
  rule({
    id: 'element/freeze-water',
    doc: 'Ice turns water into walkable ice, spreading a little; that ice thaws in time.',
    host: { type: 'tile/water' },
    on: 'impulse/element',
    tree: IF(param('element', 'ice'), DO({ op: 'transform', into: 'tile/ice' }, add('chilled'), emit('element', { area: { radius: 1 } }, { element: 'ice', power: 1 }, { chance: 0.7, filter: { type: 'tile/water' } }), vfx('frost')), 'inherit'),
  }),
  rule({
    id: 'element/thaw-ice',
    doc: 'Fire on ice turns it back to water.',
    host: { type: 'tile/ice' },
    on: 'impulse/element',
    tree: IF(param('element', 'fire'), DO({ op: 'transform', into: 'tile/water' }, vfx('steam')), 'inherit'),
  }),
  rule({
    id: 'frost/thaw',
    doc: 'Ice that magic made thaws back to water.',
    host: { type: 'tile/ice' },
    on: 'time/timer',
    tree: IF(param('status', 'chilled'), DO({ op: 'transform', into: 'tile/water' }, vfx('splash'))),
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
    doc: 'A material put on another to build: it gives itself to the work.',
    host: { type: material },
    on: 'act/put',
    tree: IF(when ? all(is('target', on), when) : is('target', on), DO(emit('receive', 'target', { what: material.split('/').pop()! }, { item: 'host' }), { op: 'destroy' })),
  })
/** A loose `on` item receiving `what` becomes `into` (with these props). */
const become = (id: string, on: string, what: string, into: string, en: string, zh: string, props: Record<string, number> = {}): Rule =>
  rule({
    id,
    host: { type: on },
    on: 'impulse/receive',
    tree: IF(param('what', what), DO({ op: 'transform', into }, ...Object.entries(props).map(([key, value]): Effect => ({ op: 'setProp', key, value })), vfx('dust'), log(en, zh)), 'inherit'),
  })
/** A tool's blow takes unfinished work apart into what went into it. */
const undo = (id: string, from: string, tool: string, back: [string, Amount][]): Rule =>
  rule({
    id,
    doc: 'Nothing put into unfinished work is lost: it comes apart into its materials.',
    host: { type: from },
    on: 'impulse/strike',
    tree: IF(tag('instrument', tool), DO(...back.map(([type, count]): Effect => ({ op: 'spawn', type, at: 'tileOf:host', count })), vfx('dust'), log('{host} comes apart.', '{host}被拆开了。'), { op: 'destroy' })),
  })

const BUILD: Rule[] = [
  // a chest (or a crate) from a frame of planks
  give('build/plank-to-plank', PLANK, { type: PLANK }),
  become('build/start-frame', PLANK, 'plank', FRAME, 'Two planks make a frame.', '两块木板搭成了框架。', { planks: 2 }),
  give('build/plank-to-frame', PLANK, { type: FRAME }, { prop: { role: 'target', key: 'planks', cmp: { lt: 4 } } }),
  rule({
    id: 'build/frame',
    doc: 'A frame takes planks up to four; a hammer makes a crate of two or a chest of four.',
    host: { type: FRAME },
    on: 'impulse',
    tree: IF(
      all({ param: { key: 'what', cmp: 'plank' } }, { prop: { role: 'host', key: 'planks', cmp: { lt: 4 } } }),
      DO({ op: 'addProp', key: 'planks', delta: 1 }, log('A frame of {host.planks} planks.', '框架上有{host.planks}块木板了。')),
      IF(
        all(tag('instrument', 'tool:hammer'), { prop: { role: 'host', key: 'planks', cmp: 2 } }),
        DO({ op: 'transform', into: 'fixture/container/crate' }, vfx('dust'), log('You nail together a crate.', '你钉好了一个板条箱。')),
        IF(
          all(tag('instrument', 'tool:hammer'), { prop: { role: 'host', key: 'planks', cmp: 4 } }),
          DO({ op: 'transform', into: 'fixture/container/chest' }, vfx('dust'), log('You nail together a chest.', '你钉好了一个箱子。')),
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
  become('build/stakes', STICK, 'stick', 'fixture/build/stakes', 'Two sticks make stakes.', '两根树枝立成了木桩。'),
  rule({
    id: 'build/fence',
    host: { type: 'fixture/build/stakes' },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:hammer'), DO({ op: 'transform', into: 'fixture/fence' }, vfx('dust'), log('You nail up a fence.', '你钉好了一段栅栏。'))),
  }),
  undo('build/unstake', 'fixture/build/stakes', 'tool:axe', [[STICK, 2]]),
  // a campfire from a ring of stones and two sticks
  give('build/stone-to-stone', STONE, { type: STONE }),
  become('build/ring', STONE, 'stone', RING, 'Two stones make a fire ring.', '两块石头围成了火圈。', { sticks: 0 }),
  give('build/stick-to-ring', STICK, { type: RING }),
  rule({
    id: 'build/ring-stick',
    doc: 'A fire ring takes two sticks and is a campfire.',
    host: { type: RING },
    on: 'impulse/receive',
    tree: IF(
      param('what', 'stick'),
      IF({ prop: { role: 'host', key: 'sticks', cmp: 0 } }, DO({ op: 'setProp', key: 'sticks', value: 1 }, log('One more stick.', '再加一根树枝。')), DO({ op: 'transform', into: 'fixture/light/campfire' }, vfx('dust'), log('A campfire, ready to light.', '篝火搭好了，可以点了。'))),
      'inherit',
    ),
  }),
  undo('build/unring', RING, 'tool:pickaxe', [
    [STONE, 2],
    [STICK, { prop: 'sticks', of: 'host' }],
  ]),
  // a sign from a plank on a stick, written with a quill while carrying ink
  give('build/plank-to-stick', PLANK, { type: STICK }),
  become('build/post', STICK, 'plank', 'fixture/build/post', 'A plank on a stick: a sign post.', '木板架在树枝上，成了牌子立柱。'),
  rule({
    id: 'build/sign',
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
    doc: 'A blank sign: bare-handed it is blank; a quill writes on it while you carry ink. Until free-text input exists, it writes one fixed line.',
    host: { type: 'fixture/sign', tags: ['blank'] },
    on: 'impulse/handle',
    tree: IF(
      tag('instrument', 'writing'),
      IF({ count: { role: 'actor', in: 'contents', match: { type: 'item/misc/ink' }, cmp: { gte: 1 } } }, DO({ op: 'removeTag', tag: 'blank' }, { op: 'addTag', tag: 'handmade' }, log('You write on the sign.', '你在告示牌上写了字。')), 'inherit'),
      DO(say('It is blank.', '上面什么也没写。', 'actor')),
    ),
  }),
  rule({ id: 'build/read-handmade', host: { type: 'fixture/sign', tags: ['handmade'] }, on: 'impulse/handle', tree: DO(say('Made by hand.', '亲手所制。', 'actor')) }),
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
const harvested: Effect[] = [
  { op: 'spawn', type: '@prop:host.yieldType', at: 'tileOf:host', count: { prop: 'yield', of: 'host' } },
  { op: 'spawn', type: '@prop:host.seedType', at: 'tileOf:host', count: 2 },
]
const picked: Effect[] = [
  { op: 'spawn', type: '@prop:host.yieldType', at: 'other', into: 'hand' },
  { op: 'spawn', type: '@prop:host.seedType', at: 'tileOf:host' },
]
/** A perennial goes back to its young stage, its fertilizer spent. */
const regrow: Effect[] = [{ op: 'transform', into: '@prop:regrowType' }, remove('fertilized'), { op: 'setProp', key: 'yield', value: 2 }]

const FARM: Rule[] = [
  ...useOrPut.map((on) =>
    rule({
      id: `farm/sow${on === 'act/put' ? '-put' : ''}`,
      doc: 'A seed put on bare farmland takes root as its crop.',
      host: { tags: ['plantable'] },
      on,
      tree: IF(all(is('target', { type: 'tile/farmland' }), NOTHING_GROWS), DO(log('You sow {host}.', '你播下了{host}。'), { op: 'move', to: 'target' }, { op: 'transform', into: '@prop:cropType' }, vfx('dust'))),
    }),
  ),
  ...useOrPut.map((on) =>
    rule({
      id: `farm/plant-acorn${on === 'act/put' ? '-put' : ''}`,
      doc: 'An acorn takes root in any diggable ground and becomes a tree in two game days.',
      host: { tags: ['acorn'] },
      on,
      tree: IF(all(is('target', { type: 'tile', tags: ['diggable'] }), NOTHING_GROWS), DO(log('You plant an acorn.', '你种下了一颗橡子。'), { op: 'move', to: 'target' }, { op: 'transform', into: '@prop:cropType' }, add('rooting'), vfx('dust'))),
    }),
  ),
  rule({
    id: 'farm/water',
    doc: 'Water on a growing crop waters it (two hours later it grows a stage).',
    host: GROWING,
    on: 'impulse/element',
    tree: IF(all(param('element', 'water'), not(has('host', 'watered'))), DO(add('watered'), vfx('splash'), log('You water {host}.', '你给{host}浇了水。')), 'inherit'),
  }),
  rule({ id: 'farm/grow', doc: 'Two game hours after watering, a crop grows one stage.', host: GROWING, on: 'time/timer', tree: IF(param('status', 'watered'), DO({ op: 'transform', into: '@prop:nextType' }, vfx('leaves'))) }),
  ...useOrPut.map((on) =>
    rule({
      id: `farm/ash${on === 'act/put' ? '-put' : ''}`,
      doc: 'Ash worked into a growing crop\'s soil is used up.',
      host: { type: 'item/material/ash' },
      on,
      tree: IF(is('target', { ...GROWING, notStatus: ['fertilized'] }), DO(emit('coat', 'target', { substance: 'ash' }), { op: 'destroy' })),
    }),
  ),
  rule({
    id: 'farm/fertilize',
    doc: 'Ash on a growing crop: one more of the crop at harvest.',
    host: GROWING,
    on: 'impulse/coat',
    tree: IF(all(param('substance', 'ash'), not(has('host', 'fertilized'))), DO(add('fertilized'), { op: 'addProp', key: 'yield', delta: 1 }, vfx('sparkle'), log('You work ash into the soil.', '你把灰烬翻进了土里。')), 'inherit'),
  }),
  rule({
    id: 'farm/harvest',
    doc: 'A sickle harvests a ripe crop: its yield and two seeds (a perennial grows back).',
    host: { type: 'fixture', tags: ['crop', 'ripe'] },
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:sickle'), IF(tag('host', 'perennial'), DO(...harvested, log('You harvest {host}.', '你收割了{host}。'), ...regrow, vfx('leaves')), DO(...harvested, log('You harvest {host}.', '你收割了{host}。'), vfx('leaves', 'tileOf:host'), { op: 'destroy' }))),
  }),
  rule({
    id: 'farm/pick',
    doc: 'Picking a ripe crop by hand: one of the crop and one seed (a perennial grows back).',
    host: { type: 'fixture', tags: ['crop', 'ripe'] },
    on: 'impulse/taken',
    tree: IF(tag('host', 'perennial'), DO(...picked, log('You pick {host}.', '你摘下了{host}。'), ...regrow, vfx('leaves')), DO(...picked, log('You pick {host}.', '你摘下了{host}。'), vfx('leaves', 'tileOf:host'), { op: 'destroy' })),
  }),
  rule({
    id: 'farm/dig-up',
    doc: 'A shovel lifts a plant and gives back its seed.',
    host: CROP,
    on: 'impulse/strike',
    tree: IF(tag('instrument', 'tool:shovel'), DO(log('You dig up {host}.', '你挖出了{host}。'), { op: 'transform', into: '@prop:seedType' }, vfx('dust'))),
  }),
  rule({
    id: 'farm/root',
    doc: 'A rooted sapling becomes a tree (someone standing on it: an hour later).',
    host: { type: 'fixture/crop/oak/sapling' },
    on: 'time/timer',
    tree: IF(param('status', 'rooting'), IF(NOBODY_HERE, DO({ op: 'transform', into: 'tile/tree' }, vfx('leaves')), DO(add('rooting', 600)))),
  }),
]

// ------------------------------------------------------------------ animals and the world's clocks

const WORLD_RULES: Rule[] = [
  rule({
    id: 'animal/lay-egg',
    doc: 'A hen lays an egg where she stands, then starts on the next.',
    host: { type: 'actor', tags: ['lays-eggs'] },
    on: 'time/timer',
    tree: IF(param('status', 'laying'), DO({ op: 'spawn', type: 'item/food/egg/raw', at: 'tileOf:host', still: true }, add('laying'))),
  }),
  rule({
    id: 'world/clocks',
    doc: 'The world\'s clocks: the ground yields; rain wets the people and creatures out under it and douses fires; a storm\'s lightning seeks what stands tall.',
    host: { type: 'resident/world' },
    on: 'time/period',
    tree: IF(
      param('name', 'forage'),
      DO({ op: 'forage' }),
      IF(
        all(param('name', 'weather'), { weather: ['rain', 'storm'] }, { outdoors: true }),
        // rain is water without force: it wets and douses, it does not wound (a fire slime steams in it)
        DO(emit('element', { map: true }, { element: 'water', power: 0 }, { filter: { type: 'actor' } }), emit('element', { map: true }, { element: 'water', power: 0 }, { filter: { status: ['burning'] } })),
        IF(
          all(param('name', 'storm'), { weather: ['storm'] }, { outdoors: true }),
          DO({ op: 'lightning', power: 4 }),
          // after dark, out in the wild, the dead and the bats come, a few at a time (nightspawn.ts)
          IF(
            all(param('name', 'night'), { hour: { from: 21, to: 5 } }, { outdoors: true }),
            DO({ op: 'appear', types: { 'actor/creature/undead/zombie': 0.6, 'actor/creature/beast/bat': 0.4 }, ring: [6, 10], cap: NIGHT_CAP, tag: 'nightborn' }),
            NOTHING,
          ),
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
    doc: 'A profession trainer, spoken to: a quest if they have one, a word, and the choice of profession (from level 5; a change gives back the profession branch\'s points).',
    host: { type: 'actor/person/trainer' },
    on: 'impulse/handle',
    tree: IF({ same: ['host', 'actor'] }, 'inherit', DO({ op: 'quest' }, { op: 'panel', panel: 'profession' })),
  }),
  rule({
    id: 'companion/talk',
    doc: 'A companion, spoken to (E), says again what it last pointed out.',
    host: COMPANION,
    on: 'impulse/handle',
    tree: DO({ op: 'say', text: '@hint' }),
  }),
  rule({
    id: 'companion/witness',
    doc: 'A companion sees someone try what the world has never seen (an act it has no answer for): it tells the story, which counts the experiments (the prologue waits for the first).',
    host: COMPANION,
    on: 'seen',
    tree: IF(param('defined', false), DO(emit('notify', 'story', { what: 'experiment' })), NOTHING),
  }),
  rule({
    id: 'night/dawn',
    doc: 'The night-born crumble away in daylight, a few at a time.',
    host: { type: 'actor', tags: ['nightborn'] },
    on: 'time/period',
    tree: IF(all(param('name', 'dawn'), { hour: { from: 5, to: 21 } }, { chance: 0.5 }), DO(vfx('poof', 'tileOf:host'), { op: 'destroy' }), 'inherit'),
  }),
  rule({
    id: 'story/quests',
    doc: 'The story settles a quest\'s business it is told of: a word between a giver and the one who spoke to them, a defeat (quests.ts).',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: IF(param('what', 'quest'), DO({ op: 'quests' }), IF(param('what', 'defeat'), DO({ op: 'quests' }), 'inherit')),
  }),
  rule({
    id: 'companion/guide',
    doc: 'Take hold of a companion (F): it stays where it is and tells what the story asks for now, and how.',
    host: COMPANION,
    on: 'impulse/taken',
    tree: DO({ op: 'say', text: '@objective' }),
  }),
  rule({
    id: 'creature/not-taken',
    doc: 'People and creatures are not picked up: undefined (the AI may say otherwise), and with no answer the hand comes away empty.',
    host: ACTOR,
    on: 'impulse/taken',
    tree: HOLE(log('It cannot be picked up.', '这个拿不起来。')),
  }),
  rule({
    id: 'waypoint/attune',
    doc: 'A hand on a waypoint statue wakes it (once): it remembers you, and the world map (M) can take you to it. Woken, it hums.',
    host: WAYPOINT,
    on: 'impulse/handle',
    tree: IF(
      has('host', 'attuned'),
      DO(log('The statue hums. Open the map (M) to travel to another one.', '雕像嗡嗡作响。打开地图（M）就能传送到别的传送雕像。')),
      DO(add('attuned'), emit('notify', 'story', { what: 'waypoint' }), vfx('heal'), log('The statue wakes under your hand. (M: the map — travel to any statue you have woken.)', '雕像在你手下亮了起来。（M：地图——可以传送到任何唤醒过的传送雕像。）')),
    ),
  }),
  rule({
    id: 'skill/firemaker',
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
    doc: 'Something put on a thing nothing else defines (a grass tuft, a boulder, a statue): undefined — the AI may answer — and with no answer it is set down on that thing\'s tile.',
    host: { type: 'fixture' },
    on: 'impulse/receive',
    tree: IF({ none: 'item' }, 'inherit', HOLE(taken('tile'), log('You set {item} down by {host}.', '你把{item}放在了{host}旁。'))),
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
    confirm: L('Drink {instrument}?', '要喝掉{instrument}吗？'),
    doc: 'The fireproof draught, drunk.',
    host: { type: 'item/potion/fire_resist' },
    on: 'act/use',
    tree: IF({ same: ['actor', 'target'] }, DO(emit('coat', 'actor', { substance: 'fireproof' }), { op: 'destroy' }), 'inherit'),
  }),
]

export const BASE_RULES: Rule[] = [...ROOTS, ...BODIES, ...PEOPLE, ...INSTRUMENTS, ...PLACING, ...GROUND, ...FIRE, ...BUILD, ...FARM, ...WORLD_RULES, ...JOURNEY]
