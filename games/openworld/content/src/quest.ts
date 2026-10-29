// The main quest past the Ford (docs/main-quest.md): Emberfall, the old mine, fire and frost,
// Cinder Pass and the dragon. Its state is facts under `mq.` (protected like the Ford's: only
// these rules and the scenes change them), and the `emberfall` quest (quests/main.ts) answers them.
// The rules here are the turn-ins and rewards the people of Emberfall make, and the dragon's end (its fight, its brood
// among it, is a boss's: bosses.ts).

import type { Cond, Effect, Rule, Text, Tree } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

const story = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base', note: 'story' } })
const say = (en: string, zh: string): Effect => ({ op: 'say', text: { en, zh } })
const log = (en: string, zh: string): Effect => ({ op: 'log', text: { en, zh } })
/** News for the story, which keeps the `mq.` facts (design.md §5.8: others notify it). */
const notify = (what: string): Effect => ({ op: 'emit', impulse: 'notify', to: 'story', params: { what } })
const DO = (...effects: Effect[]): Tree => ({ do: effects })
const IF = (cond: Cond, then: Tree, otherwise: Tree = 'inherit'): Tree => ({ if: cond, then, else: otherwise })
const all = (...c: Cond[]): Cond => ({ all: c })
const fact = (key: string, cmp: number | { gte?: number; lt?: number }): Cond => ({ prop: { role: 'story', key, cmp, default: 0 } })
const what = (w: string): Cond => ({ param: { key: 'what', cmp: w } })

export const ELDER = 'actor/person/elder'
export const SMITH = 'actor/person/smith'
export const HERBALIST = 'actor/person/herbalist'
export const DRAGON = 'actor/creature/dragon'
export const BLADE = 'item/weapon/blade/dragonsbane'
export const DRAUGHT = 'item/potion/fire_resist'

/** What the smith and the herbalist ask for: the item, the fact that counts it, how many. */
export const ASKS = {
  ore: { type: 'item/material/iron_ore', fact: 'mq.ore', need: 5, of: SMITH },
  coal: { type: 'item/material/coal', fact: 'mq.coal', need: 3, of: SMITH },
  fireweed: { type: 'item/material/fireweed', fact: 'mq.fireweed', need: 3, of: HERBALIST },
  frostcap: { type: 'item/material/frostcap', fact: 'mq.frostcap', need: 3, of: HERBALIST },
} as const

/**
 * A turn-in: the person handed the asked-for item takes it and tells the story, until it is
 * enough; then they say so and leave it in your hand.
 */
function turnIn(id: string, ask: (typeof ASKS)[keyof typeof ASKS], thanks: [string, string], enough: [string, string]): Rule {
  return story({
    id: `mq/${id}`,
    doc: `${ask.of.split('/').pop()} takes ${ask.type.split('/').pop()} toward the ${ask.need} asked for.`,
    host: { type: ask.of },
    on: 'impulse/offered',
    tree: IF(
      { is: { role: 'item', sel: { type: ask.type } } },
      IF(
        all(fact('mq.council', 1), fact(ask.fact, { lt: ask.need })),
        DO({ op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' }, notify(ask.fact), say(...thanks), { op: 'emote', mood: 'happy' }),
        IF(fact(ask.fact, { gte: ask.need }), DO(say(...enough))),
      ),
    ),
  })
}

export const QUEST_RULES: Rule[] = [
  // ---------------------------------------------------------------- Emberfall: the elder's council
  story({
    id: 'mq/elder-council',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'The elder tells of the dragon and what it will take (once).',
    host: { type: ELDER },
    on: 'impulse/handle',
    tree: IF(all(fact('mq.council', 0), { none: 'instrument' }, { not: { param: { key: 'say', cmp: { ne: '' } } } }), DO(notify('council'))),
  }),
  // ---------------------------------------------------------------- the smith: ore and coal, a blade
  turnIn('smith-ore', ASKS.ore, ['Good iron, that! Five ore and three coal, and you\'ll have your blade.', '好铁！五块矿石、三块煤，你的剑就有了。'], ['That\'s iron enough. Now the coal, if you haven\'t brought it yet.', '铁够了。还差煤，你要是还没拿来的话。']),
  turnIn('smith-coal', ASKS.coal, ['Coal! That\'ll burn hot enough to work dragon-steel.', '煤！这下炉子能烧到炼屠龙钢的火候了。'], ['That\'s coal enough.', '煤够了。']),
  story({
    id: 'mq/smith-forge',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'With five ore and three coal, the smith forges Dragonsbane.',
    host: { type: SMITH },
    on: 'impulse/handle',
    tree: IF(
      all(fact('mq.ore', { gte: ASKS.ore.need }), fact('mq.coal', { gte: ASKS.coal.need }), fact('mq.blade', 0), { not: { param: { key: 'say', cmp: { ne: '' } } } }),
      DO(
        { op: 'spawn', type: BLADE, at: 'actor', into: 'contents' },
        notify('blade'),
        { op: 'vfx', fx: 'sparkle' },
        say('There it is. Dragonsbane. My family has waited twelve generations to forge that blade. Come back with the dragon\'s blood on it!', '好了，屠龙剑！我们家等了十二代，才等到锻这把剑。带着龙血回来见我！'),
        log('Garrick hands you Dragonsbane.', '加里克把屠龙剑交到你手里。'),
      ),
    ),
  }),
  // ---------------------------------------------------------------- the herbalist: fireweed and frostcap, two draughts
  turnIn('herbalist-fireweed', ASKS.fireweed, ['Fireweed! The books say it only grows where there\'s been a fire.', '火焰草！书上说，它只长在着过火的地方。'], ['That\'s enough fireweed.', '火焰草够了。']),
  turnIn('herbalist-frostcap', ASKS.frostcap, ['Frostcap, from the shady side of Hushwood. Good.', '霜盖菇，噤声林背阴那边长的。很好。'], ['That\'s enough frostcap.', '霜盖菇够了。']),
  story({
    id: 'mq/herbalist-brew',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'With three fireweed and three frostcap, the herbalist brews two fireproof draughts.',
    host: { type: HERBALIST },
    on: 'impulse/handle',
    tree: IF(
      all(fact('mq.fireweed', { gte: ASKS.fireweed.need }), fact('mq.frostcap', { gte: ASKS.frostcap.need }), fact('mq.draught', 0), { not: { param: { key: 'say', cmp: { ne: '' } } } }),
      DO(
        { op: 'spawn', type: DRAUGHT, at: 'actor', into: 'contents', count: 2 },
        notify('draught'),
        { op: 'vfx', fx: 'sparkle' },
        say("Two draughts. Drink one at the lair's mouth, and for a few minutes the fire will barely warm you. The other is for when the first wears off.", '两瓶药剂。到了巢穴门口喝一瓶，之后几分钟里，火烧到身上也只是有点暖。第一瓶药效过了，就喝另一瓶。'),
        log('Wren gives you two fireproof draughts.', '雷恩给了你两瓶防火药剂。'),
      ),
    ),
  }),
  // ---------------------------------------------------------------- the dragon
  story({
    id: 'mq/whelps-scatter',
    doc: 'Once the dragon is slain, its whelps lose heart and scatter into the dark, one by one: the victory is not followed by a fight one can no longer win the story for.',
    host: { type: 'actor/creature/whelp' },
    on: 'time/period',
    tree: IF(all({ param: { key: 'name', cmp: 'orphaned' } }, fact('mq.dragon', 1), { chance: 0.3 }), DO({ op: 'vfx', fx: 'poof', at: 'tileOf:host' }, log('A whelp shrieks and flees into the dark.', '一只幼龙尖叫着逃进了黑暗。'), { op: 'destroy' }), 'inherit'),
  }),
  story({
    id: 'mq/dragon-slain',
    doc: 'The dragon falls: what it leaves, the experience of it, and the end of the main quest.',
    host: { type: DRAGON },
    on: 'threshold/cross',
    tree: IF(
      { param: { key: 'name', cmp: 'broken' } },
      DO(
        { op: 'dropContents', still: true },
        { op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'defeat', xp: { prop: 'maxHp', of: 'host' }, trophy: { prop: 'trophy', of: 'host' }, trophyChance: { prop: 'trophyChance', of: 'host' } } },
        notify('dragon'),
        { op: 'vfx', fx: 'poof' },
        log('{host} is defeated.', '{host}被打倒了。'),
        { op: 'destroy' },
      ),
    ),
  }),
  // ---------------------------------------------------------------- the story keeps the main quest's facts
  story({
    id: 'mq/story',
    doc: 'The story hears what happened past the Ford and keeps it: what the smith and the herbalist were given, the blade and the draughts, the whelps, the dragon slain; the council.',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: IF(
      what('mq.ore'),
      DO({ op: 'addProp', key: 'mq.ore', delta: 1 }),
      IF(
        what('mq.coal'),
        DO({ op: 'addProp', key: 'mq.coal', delta: 1 }),
        IF(
          what('mq.fireweed'),
          DO({ op: 'addProp', key: 'mq.fireweed', delta: 1 }),
          IF(
            what('mq.frostcap'),
            DO({ op: 'addProp', key: 'mq.frostcap', delta: 1 }),
            IF(
              what('blade'),
              DO({ op: 'setProp', key: 'mq.blade', value: 1 }),
              IF(
                what('draught'),
                DO({ op: 'setProp', key: 'mq.draught', value: 1 }),
                IF(
                  what('whelps'),
                  DO({ op: 'setProp', key: 'mq.whelps', value: 1 }),
                  IF(what('dragon'), DO({ op: 'setProp', key: 'mq.dragon', value: 1 }, { op: 'scene', id: 'victory' }), IF(what('council'), DO({ op: 'scene', id: 'council' }))),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  }),
  // ---------------------------------------------------------------- the journey's own news (docs/prologue.md, quests.md)
  story({
    id: 'journey/story',
    doc: 'The story counts the waypoint statues woken, the meals eaten and the experiments a companion saw (the prologue waits for the first of each).',
    host: { type: 'resident/story' },
    on: 'impulse/notify',
    tree: IF(
      what('waypoint'),
      DO({ op: 'addProp', key: 'waypoints.attuned', delta: 1 }),
      IF(
        what('meal'),
        DO({ op: 'addProp', key: 'prologue.meals', delta: 1 }),
        IF(what('experiment'), DO({ op: 'addProp', key: 'world.experiments', delta: 1 }), IF(what('dummy'), DO({ op: 'addProp', key: 'tutorial.dummy', delta: 1 }))),
      ),
    ),
  }),
]
