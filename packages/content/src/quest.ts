// The main quest past the Ford (docs/main-quest.md): Emberfall, the old mine, fire and frost,
// Cinder Pass and the dragon. Its state is facts under `mq.` (protected like the Ford's: only
// these rules and the scenes change them) and the player's `quest` prop. Each stage's goal is a
// state; the rules here are the turn-ins and rewards the people of Emberfall make, and the
// dragon's phases.

import type { Cond, Effect, Rule, Text, Tree } from '@lsw/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

/** Objectives for the stages after the Ford's (the Ford's are 0–2, in ford.ts). */
export const QUEST_OBJECTIVES: Record<number, { title: Text; hint: Text; progress?: { fact: string; need: number; label: Text }[] }> = {
  3: {
    title: L('Emberfall', '余烬镇'),
    hint: L('Find Mara, the elder of Emberfall. She will know what burns the hills.', '找到余烬镇的长老玛拉。她会知道是什么在烧山。'),
  },
  4: {
    title: L('Arm for the dragon', '为屠龙做准备'),
    hint: L(
      'Garrick the smith will forge a blade for 5 iron ore and 3 coal — the old mine north of the village has the veins (a pickaxe breaks them; the richest lie past the cyclops). Wren the herbalist will brew a fireproof draught for 3 fireweed (Firstlight Village) and 3 frostcap (the forest). Hand them what they ask (G), then talk to them (E).',
      '铁匠加里克要 5 块铁矿石和 3 块煤来锻一把剑——镇北的旧矿坑里有矿脉（用镐敲开）。草药师雷恩要 3 株火焰草（初原村）和 3 朵霜盖菇（森林）来熬防火药剂。把东西交给他们（G），再和他们说话（E）。',
    ),
    progress: [
      { fact: 'mq.ore', need: 5, label: L('Iron ore', '铁矿石') },
      { fact: 'mq.coal', need: 3, label: L('Coal', '煤') },
      { fact: 'mq.fireweed', need: 3, label: L('Fireweed', '火焰草') },
      { fact: 'mq.frostcap', need: 3, label: L('Frostcap', '霜盖菇') },
      { fact: 'mq.blade', need: 1, label: L('Dragonsbane', '屠龙剑') },
      { fact: 'mq.draught', need: 1, label: L('Fireproof draught', '防火药剂') },
    ],
  },
  5: {
    title: L('Cinder Pass', '烬岭山道'),
    hint: L('Climb the pass east of Emberfall to the dragon\'s lair. Drink the fireproof draught before you go in.', '翻过余烬镇东边的山道，去魔龙的巢穴。进去之前喝下防火药剂。'),
  },
  6: {
    title: L('The dragon of Cinder Peak', '烬峰魔龙'),
    hint: L('Defeat the dragon. Space strikes; keep out of its line of fire, and mind its whelps.', '打倒魔龙。空格键攻击；别站在它喷火的直线上，小心它的幼龙。'),
  },
  7: {
    title: L('The end', '终章'),
    hint: L('The dragon is dead. Emberfall can sleep. What you taught the world is in the Threadbook (J).', '魔龙死了，余烬镇可以安睡了。你教会这个世界的事都记在织线簿里（J）。'),
  },
}

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
  turnIn('smith-ore', ASKS.ore, ['Good iron. Five ore and three coal, and you will have your blade.', '好铁。五块矿石、三块煤，你的剑就有了。'], ['That is iron enough. Coal, now — if you have not brought it.', '铁够了。现在要煤——如果你还没带来的话。']),
  turnIn('smith-coal', ASKS.coal, ['Coal for the forge. It will burn hot enough for dragon-steel.', '炉子用的煤。烧得够旺，能炼屠龙的钢。'], ['That is coal enough.', '煤够了。']),
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
        say('There. Dragonsbane. Twelve generations of my family have waited to forge that one. Bring it back red.', '拿着。屠龙剑。我家十二代人都在等着锻这一把。带着它沾满龙血回来。'),
        log('Garrick hands you Dragonsbane.', '加里克把屠龙剑交到你手里。'),
      ),
    ),
  }),
  // ---------------------------------------------------------------- the herbalist: fireweed and frostcap, two draughts
  turnIn('herbalist-fireweed', ASKS.fireweed, ['Fireweed. It only grows where the ground remembers fire.', '火焰草。只长在记得火的地方。'], ['Fireweed enough.', '火焰草够了。']),
  turnIn('herbalist-frostcap', ASKS.frostcap, ['Frostcap, from the cold side of the forest. Good.', '霜盖菇，长在森林背阴那边的。很好。'], ['Frostcap enough.', '霜盖菇够了。']),
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
        say("Two draughts. Drink one at the lair's mouth: for a few minutes the fire will barely warm you. The other is for when the first runs out.", '两瓶药剂。在巢穴门口喝一瓶：接下来几分钟，火只会让你觉得有点暖。另一瓶留着第一瓶失效时用。'),
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
    id: 'mq/dragon-whelps',
    doc: 'Struck again once below half, the dragon shrieks and its whelps pour out of the dark (once); every blow still wounds it.',
    host: { type: DRAGON },
    on: 'impulse/strike',
    tree: IF(
      all({ prop: { role: 'host', key: 'hp', cmp: { lt: 350 } } }, fact('mq.whelps', 0)),
      DO(
        { op: 'hurt', amount: { param: 'power' } },
        { op: 'foe' },
        notify('whelps'),
        { op: 'spawn', type: 'actor/creature/whelp', at: 'host', count: 3 },
        { op: 'vfx', fx: 'fire_burst' },
        log('The dragon shrieks. Its whelps pour out of the dark!', '魔龙一声尖啸，幼龙从黑暗里涌了出来！'),
      ),
    ),
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
        { op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'defeat', xp: { prop: 'maxHp', of: 'host' } } },
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
        all(what('meal'), { prop: { role: 'actor', key: 'prologue' } }),
        DO({ op: 'addProp', key: 'prologue.meals', delta: 1 }),
        IF(what('experiment'), DO({ op: 'addProp', key: 'world.experiments', delta: 1 }), IF(what('dummy'), DO({ op: 'addProp', key: 'tutorial.dummy', delta: 1 }))),
      ),
    ),
  }),
]
