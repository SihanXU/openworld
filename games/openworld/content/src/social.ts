// The people's social life as data (docs/npc-sandbox.md): what people take as deeds and what each costs, the
// watches that keep the law, the numbers of regard, gossip and trade, the verbs of the talk panel, the statuses
// it uses, and the people's rules — how a person answers what they see, what is said to them, what they are told.
// The engine holds the mechanisms (social.ts, conduct.ts, the primitives); every judgement here is a rule of a
// host, reading anything and writing only itself.

import { TICKS_PER_DAY, type Cond, type DeedDef, type Effect, type EmitTo, type LawDef, type PropValue, type Rule, type Selector, type SocialParams, type StatusDef, type TalkVerb, type Text, type Tree, type TypeDef } from '@openworld/engine'
import { COIN } from './homestead.ts'
import { DISCOUNT, MARKDOWN, MARKUP } from './prices.ts'
import { MINOR } from './protection.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })
const DO = (...effects: Effect[]): Tree => ({ do: effects })
const NOTHING: Tree = { do: [] }
const IF = (cond: Cond, then: Tree, otherwise?: Tree): Tree => ({ if: cond, then, ...(otherwise !== undefined && { else: otherwise }) })
const HOLE = (...dflt: Effect[]): Tree => ({ undefined: true, ...(dflt.length && { default: dflt }) })
const param = (key: string, cmp: PropValue | { gt?: number; ne?: PropValue }): Cond => ({ param: { key, cmp } })
const say = (en: string, zh: string): Effect => ({ op: 'say', text: L(en, zh) })
const all = (...c: Cond[]): Cond => ({ all: c })
const any = (...c: Cond[]): Cond => ({ any: c })
const not = (c: Cond): Cond => ({ not: c })
const has = (role: 'host' | 'actor' | 'target' | 'instrument', status: string): Cond => ({ has: { role, status } })
const tag = (role: 'host' | 'actor' | 'target' | 'instrument', t: string): Cond => ({ has: { role, tag: t } })
const add = (status: string, duration?: number): Effect => ({ op: 'addStatus', status, ...(duration && { duration }) })
const emote = (mood: 'angry' | 'surprised' | 'happy' | 'sad' | 'shy'): Effect => ({ op: 'emote', mood })
const emit = (impulse: 'notify' | 'handle', to: EmitTo, params?: Record<string, PropValue | { param: string } | { idOf: 'host' | 'actor' | 'item' | 'target' }>, extra: Partial<Extract<Effect, { op: 'emit' }>> = {}): Effect => ({ op: 'emit', impulse, to, ...(params && { params }), ...extra })
const regard = (delta: number): Effect => ({ op: 'regard', delta })
const what = (w: string) => param('what', w)
const says = (s: string) => param('say', s)

/** The coin of the world: the Held Ground's Dawnmark (homestead.ts). */
export const SOCIAL_COIN = COIN

// ------------------------------------------------------------------ deeds (§2.2)

/**
 * What people take as deeds when they see them (Skyrim's crimes, its fines): each a condition on the `seen`
 * event (see engine.ts `see`: params act, theirs, from, person, harm, killed, element, trespass), the fine
 * the watch charges (theft: half the thing's worth), and the regard it takes from its victim. The worst first.
 */
export const DEEDS: DeedDef[] = [
  { id: 'murder', name: L('murder', '杀害'), told: L('{who} killed {whom}', '{who}杀了{whom}'), rank: 0, fine: 1000, weight: 100, violent: true, when: all(param('act', 'use'), param('person', true), param('killed', true)) },
  { id: 'assault', name: L('assault', '袭击'), told: L('{who} attacked {whom}', '{who}打了{whom}'), rank: 1, fine: 40, weight: 35, violent: true, when: all(param('act', 'use'), param('person', true), param('harm', { gt: 0 })) },
  { id: 'pickpocket', name: L('pickpocketing', '扒窃'), told: L("{who} picked {whom}'s pocket ({what})", '{who}扒了{whom}的口袋（{what}）'), rank: 2, fine: 25, weight: 25, when: all(param('act', 'take'), param('theirs', true), param('from', 'person')) },
  { id: 'arson', name: L('arson', '纵火'), told: L("{who} set {whom}'s {what} alight", '{who}放火烧了{whom}的{what}'), rank: 3, fine: 40, weight: 30, when: all(param('act', 'use'), param('theirs', true), any(tag('instrument', 'fire-source'), param('element', 'fire'))) },
  { id: 'theft', name: L('theft', '偷窃'), told: L('{who} stole {what} from {whom}', '{who}偷了{whom}的{what}'), rank: 4, fine: 'value', weight: 15, when: all(param('act', 'take'), param('theirs', true)) },
  { id: 'lockpick', name: L('lockpicking', '撬锁'), told: L("{who} picked the lock of {whom}'s {what}", '{who}撬了{whom}的{what}的锁'), rank: 4.5, fine: 5, weight: 8, when: all(param('act', 'use'), param('theirs', true), tag('instrument', 'lockpick')) },
  { id: 'vandalism', name: L('vandalism', '破坏'), told: L("{who} smashed at {whom}'s {what}", '{who}砸了{whom}的{what}'), rank: 5, fine: 10, weight: 10, when: all(param('act', 'use'), param('theirs', true), param('harm', { gt: 0 })) },
  { id: 'trespass', name: L('trespass', '擅闯'), told: L("{who} was at {whom}'s door in the night", '{who}半夜摸到了{whom}的门口'), rank: 6, fine: 5, weight: 5, when: all(param('act', 'presence'), param('trespass', true)) },
]

// ------------------------------------------------------------------ the law (§2.7)

/** The watches: who keeps the law where (a map's `law`), where its jail is, and what it will not pardon. */
export const LAWS: Record<string, LawDef> = {
  firstlight: { id: 'firstlight', name: L('the Firstlight watch', '初原村守卫'), jail: { map: 'meadow', anchor: 'cells' }, unpardonable: 1000 },
}

// ------------------------------------------------------------------ the numbers (§2.4, §2.5, §2.10)

export const SOCIAL: SocialParams = {
  coin: SOCIAL_COIN,
  regardStart: 0,
  regardTie: 30,
  talk: 2,
  fade: 0.1,
  gossipEvery: 150,
  gossipDays: 3,
  perceiveEvery: 10,
  fearTicks: 600,
  // a robbery takes twice the victim's might (level, arms, defence, body): one overwhelmed gives up what it has
  robEdge: 2,
  // a merchant sells at the standard price and a quarter and buys at half (prices.ts)
  markup: MARKUP,
  markdown: MARKDOWN,
  fence: 0.5,
  // a friend made stays one: a liking fades a hundredth of the way a day (a grudge a tenth); a merchant at full regard
  // asks three tenths less (and pays a fifth more)
  fadeUp: 0.01,
  discount: DISCOUNT,
  // the Held Ground's beds (haven.ts: one by the camp from the first; each residents' tent built, two more): one held
  // in full regard may be asked to come and live there — ten hearts in the talk panel, a mark a liking keeps five days
  // as it fades (a hundredth a day: 100 is 95 five days on), not one it holds only for the hour after the last gain
  residence: {
    map: 'haven',
    at: 95,
    work: {
      controller: { type: 'actor/person/steward', tags: ['haven-steward'] },
      crop: { type: 'fixture/crop', tags: ['crop'] },
      ripe: { type: 'fixture/crop', tags: ['ripe'] },
      growing: { type: 'fixture/crop', tags: ['growing'], notStatus: ['watered'] },
      livestock: { type: 'actor/creature/animal', tags: ['livestock'] },
      unfed: { type: 'actor/creature/animal', tags: ['livestock'], notStatus: ['fed'] },
      milkable: { type: 'actor/creature/animal/cow', status: ['fed'], notStatus: ['milked'] },
      egg: { type: 'item/food/egg/raw' },
      warehouse: { type: 'fixture/container', props: { capacity: { gt: 0 } } },
      feed: { type: 'item/material/feed' },
      yieldTypeProp: 'yieldType',
      seedTypeProp: 'seedType',
      pickBonusProp: 'pick',
      yieldBase: 1,
      seedCount: 1,
    },
    slots: [
      { anchor: 'home.camp' },
      { anchor: 'home.lodge1.a', when: 'haven.build.lodge1' },
      { anchor: 'home.lodge1.b', when: 'haven.build.lodge1' },
      { anchor: 'home.lodge2.a', when: 'haven.build.lodge2' },
      { anchor: 'home.lodge2.b', when: 'haven.build.lodge2' },
      { anchor: 'home.lodge3.a', when: 'haven.build.lodge3' },
      { anchor: 'home.lodge3.b', when: 'haven.build.lodge3' },
    ],
    // asleep in their bed from nine at night to seven, the day by the fire (a bed's `.day` anchor)
    days: [
      { from: 21, to: 7, at: 'bed', activity: 'sleep' },
      { from: 7, to: 21, at: 'day', activity: 'live' },
    ],
    yes: L("...Live there? With you? — Yes. Give me a moment to pack. I'll see you in the Held Ground.", '……搬去那儿住？和你一起？——好。让我收拾一下东西。我们誓守之地见。'),
    full: L("I'd like that. But you've no bed for me there yet — ask Alberic to raise another tent.", '我很想去。可你那儿还没有我的床位——去找阿尔贝里克再搭一顶营帐吧。'),
  },
}

// ------------------------------------------------------------------ statuses

const HOUR = TICKS_PER_DAY / 24

export const SOCIAL_STATUSES: StatusDef[] = [
  // the input's posture: walking soft (slower), a blade out (any actor may have them)
  { id: 'sneaking', name: L('sneaking', '潜行'), moveDelay: 1.6 },
  { id: 'drawn', name: L('weapon drawn', '拔出武器') },
  // a witness on its way to tell the watch; an owner waiting for what was taken to come back
  { id: 'reporting', name: L('going to the watch', '要去报官'), duration: 300 },
  { id: 'demanding', name: L('waiting for it back', '等着要回东西'), duration: 300 },
  { id: 'demanded', name: L('has asked', '讨要过了'), duration: TICKS_PER_DAY },
  // one who has warned someone off their place, or told them to put a blade away; one after the wanted
  { id: 'warning', name: L('warning', '警告中'), duration: 150 },
  { id: 'warned', name: L('has warned', '警告过了'), duration: HOUR },
  { id: 'warned-blade', name: L('has warned of the blade', '提醒过收刀'), duration: 300 },
  { id: 'pursuing', name: L('pursuing', '追捕中'), duration: 300 },
  // talked round once today (a guard, stopped and asked to let one go)
  { id: 'persuaded', name: L('talked round', '已被说服过'), duration: TICKS_PER_DAY },
  // robbed, or a hand tried in their pocket, once today
  { id: 'robbed', name: L('robbed today', '今天被抢过'), duration: TICKS_PER_DAY },
  { id: 'pilfered', name: L('a hand in the pocket today', '今天被摸过口袋'), duration: TICKS_PER_DAY },
  // told there are no gods, once today
  { id: 'doubted', name: L('heard the unbeliever', '听过无神论了'), duration: TICKS_PER_DAY },
  // given the thing they like best today (its special warmth comes once a day)
  { id: 'cheered', name: L('delighted', '欢喜'), duration: TICKS_PER_DAY },
  // in the cells
  { id: 'jailed', name: L('jailed', '关押中'), immobilize: true, pose: 'lie' },
]

// ------------------------------------------------------------------ types

export const SOCIAL_TYPES: TypeDef[] = [
  // a watch (§2.7): a resident thing whose ledger is its props
  { id: 'resident/watch', name: L('watch', '守卫队'), tags: ['watch'] },
  // what a person leaves when they die: a container of what they carried, its household's (§2.8)
  { id: 'fixture/remains', name: L('remains', '遗骸'), tags: ['remains'], sprite: 'fixture:remains' },
  { id: 'fixture/remains/body', name: L('body', '遗体'), tags: ['container', 'body', 'flesh'], sprite: 'fixture:body', props: { capacity: 40 }, stage: { lasts: 2 * TICKS_PER_DAY, into: 'fixture/remains/bones' } },
  { id: 'fixture/remains/bones', name: L('bones', '白骨'), tags: ['container', 'bone'], sprite: 'fixture:bones', props: { capacity: 40 } },
]

// ------------------------------------------------------------------ the talk panel (§2.9)

const PERSON: Selector = { type: 'actor/person' }
const WATCHMAN: Selector = { type: 'actor/person', tags: ['watchman'] }
const MERCHANT: Selector = { type: 'actor/person', tags: ['merchant'] }
const COINS = (n: number): Cond => ({ count: { role: 'actor', in: 'contents', match: { type: SOCIAL_COIN }, cmp: { gte: n } } })
const FOLLOWS: Cond = { leads: ['actor', 'host'] }
const GRUDGE: Cond = { grudge: { of: 'host', toward: 'actor' } }
const WANTED: Cond = { bounty: { role: 'actor', cmp: { gt: 0 } } }
const BRIBE = 10
/** One not protected as a minor by their explicit tag or recorded age. */
const GROWN: Cond = not(MINOR)
/** The Held Ground, its residents' home (SOCIAL.residence). */
const RESIDENCE = SOCIAL.residence!
/** Asked to come and live in the Held Ground: what each part of it takes (the talk verb's condition is all of them). */
const INVITE = {
  // one the main story needs where they are does not leave
  free: not(tag('host', 'storybound')),
  // not one who lives there already
  away: not({ prop: { role: 'host', key: 'resident', cmp: RESIDENCE.map } }),
  // the Held Ground is one's own: its steward, the White Knight, is down
  ours: { prop: { role: 'story', key: 'sins.defeated.alberic', cmp: { gte: 1 } } } as Cond,
  // held in full regard (the residence's mark: the talk panel's ten hearts)
  regard: { regard: { of: 'host', toward: 'actor', cmp: { gte: RESIDENCE.at } } } as Cond,
}

export const TALK: TalkVerb[] = [
  // small talk: news, a chat (one of their own lines, or what they like best let slip: people.ts), a gift (the panel, §2.15)
  { id: 'ask', group: 'talk', label: L('What news?', '最近有什么事？') },
  { id: 'chat', group: 'talk', label: L("Let's talk a while.", '聊聊天吧。') },
  { id: 'gift', group: 'talk', label: L('I have something for you.', '送你一样东西。') },
  // dealings: a merchant's trade, the trainer's professions, the Held Ground's steward (haven.ts), an invitation to live there
  { id: 'trade', group: 'deal', label: L("Let's trade.", '做点买卖吧。'), when: { is: { role: 'host', sel: MERCHANT } } },
  { id: 'profession', group: 'deal', label: L('About professions…', '关于职业……'), when: { is: { role: 'host', sel: { type: 'actor/person/trainer' } } } },
  { id: 'haven', group: 'deal', label: L('The Held Ground…', '领地扩建……'), when: { is: { role: 'host', sel: { tags: ['haven-steward'] } } } },
  // the dresser (dresser.ts): one's look changed, for coin and wildflowers
  { id: 'restyle', group: 'deal', label: L('Could you do something with my look?', '帮我改改样子吧。'), when: { is: { role: 'host', sel: { tags: ['dresser'] } } } },
  // one held in full regard, free to leave, asked to come and live in the Held Ground (once it is one's own)
  { id: 'invite', group: 'deal', label: L('Come and live in the Held Ground?', '要不要搬来誓守之地住？'), when: all(INVITE.regard, INVITE.free, INVITE.away, INVITE.ours) },
  // company: to follow, to wait, to go on, to go home
  { id: 'follow', group: 'company', label: L('Come with me.', '跟我来。'), when: not(FOLLOWS) },
  { id: 'wait', group: 'company', label: L('Wait here.', '在这儿等着。'), when: all(FOLLOWS, not({ prop: { role: 'host', key: 'waiting', cmp: true } })) },
  { id: 'come', group: 'company', label: L("Let's go on.", '我们走吧。'), when: all(FOLLOWS, { prop: { role: 'host', key: 'waiting', cmp: true } }) },
  { id: 'dismiss', group: 'company', label: L('Go home.', '回家去吧。'), when: FOLLOWS },
  // amends: for what they hold against one, and what one owes the watch
  { id: 'giveback', group: 'amends', label: L('Give back what I took.', '把拿走的东西还回去。'), when: GRUDGE },
  { id: 'apologise', group: 'amends', label: L("I'm sorry.", '对不起。'), when: GRUDGE },
  { id: 'turnin', group: 'amends', label: L('I want to settle what I owe the watch ({bounty}).', '我要了结欠守卫队的账（{bounty}）。'), when: all({ is: { role: 'host', sel: WATCHMAN } }, WANTED) },
  // the underhand: a bribe; robbery (might against might: no roll) and theft (a roll of nimbleness), once a day to each,
  // never a child; words against the gods (lower one's faith; the devout take it ill), once a day to each, never to a child
  { id: 'bribe', group: 'shady', label: L(`Bribe (${BRIBE})`, `贿赂（${BRIBE}）`), when: COINS(BRIBE) },
  { id: 'rob', group: 'shady', label: L('Your money or your life.', '抢劫：要钱还是要命。'), when: all(GROWN, not(has('host', 'robbed'))) },
  { id: 'steal', group: 'shady', label: L('(Slip a hand into their pocket.)', '偷窃：（悄悄把手伸进他的口袋。）'), when: all(GROWN, not(has('host', 'pilfered'))) },
  { id: 'unbelief', group: 'shady', label: L('There are no gods watching, you know.', '散布无神论：其实根本没有神在看着。'), when: all(GROWN, not(has('host', 'doubted'))) },
  // a guard who has stopped one the watch wants: these only
  { id: 'pay', arrest: true, group: 'watch', label: L('Pay the fine ({bounty}).', '交罚金（{bounty}）。'), when: { canPay: { role: 'actor' } } },
  { id: 'jail', arrest: true, group: 'watch', label: L('Go to jail.', '跟你去牢房。') },
  { id: 'persuade', arrest: true, group: 'watch', label: L('Talk your way out.', '设法说服他。'), when: all(not({ unpardonable: 'actor' }), not(has('host', 'persuaded'))) },
  { id: 'bribe', arrest: true, group: 'watch', label: L('Bribe ({bribe}).', '行贿（{bribe}）。'), when: all(not({ unpardonable: 'actor' }), { canPay: { role: 'actor', mul: 1.5 } }) },
  { id: 'resist', arrest: true, group: 'watch', label: L('Resist!', '拒捕！') },
]

// ------------------------------------------------------------------ the people's rules

/** Lines a witness says, by the deed. */
const CRY: [string, Text][] = [
  ['murder', L('Murder! Murder!', '杀人了！杀人了！')],
  ['assault', L('Guards! Someone help!', '卫兵！快来人啊！')],
  ['pickpocket', L('Thief! A cutpurse!', '小偷！有扒手！')],
  ['arson', L('Fire! Someone set it alight!', '着火了！有人放火！')],
  ['theft', L('I saw that. Thief!', '我看见了。小偷！')],
  ['vandalism', L('Hey! Leave that be!', '喂！别乱砸！')],
]
/** A witness's answer: these effects, and the cry the deed draws from them. */
const witnessed = (...effects: Effect[]): Tree => CRY.reduceRight<Tree>((rest, [deed, line]) => IF({ deed }, DO(...effects, { op: 'say', text: line }), rest), DO(...effects))

/** What a person does about a deed they saw (docs/npc-sandbox.md §2.6). */
const SEE_DEED: Tree = IF(
  // one who keeps the watch: it is told at once, and the violent are stopped by force
  tag('host', 'watchman'),
  IF(
    any({ deed: 'murder' }, { deed: 'assault' }),
    DO({ op: 'witness' }, { op: 'report' }, { op: 'foe' }, say('Stop right there!', '站住！'), emote('angry')),
    DO({ op: 'witness' }, { op: 'report' }, say('I saw that. The watch will have its due.', '我看见了。守卫队会找你算账的。'), emote('angry')),
  ),
  IF(
    any(param('victim', 'me'), param('victim', 'ours')),
    // against them or theirs: a blow is answered by the body (combat/struck: a fight, or fear) and a cry for help;
    // a thing taken, by asking for it back (conduct.ts) and, if it does not come, the watch
    IF(
      any({ deed: 'murder' }, { deed: 'assault' }),
      DO({ op: 'witness' }, add('reporting'), emit('notify', { around: 8 }, { what: 'help' }), say('Help! Guards!', '救命！卫兵！'), emote('surprised')),
      DO({ op: 'witness' }, add('reporting', 900), say('Hey — that is mine!', '喂——那是我的！'), emote('angry'), emit('notify', 'story', { what: 'topic', value: 'theft', days: 2 })),
    ),
    // a witness: the violent fled and cried out against, the rest told to the watch — unless one keeps quiet about such things
    IF(
      any({ deed: 'murder' }, { deed: 'assault' }),
      witnessed({ op: 'witness' }, add('reporting'), emit('notify', { around: 8 }, { what: 'help' }), emote('surprised')),
      IF({ prop: { role: 'host', key: 'lawful', cmp: false } }, DO({ op: 'witness' }), witnessed({ op: 'witness' }, add('reporting'), emote('surprised'))),
    ),
  ),
)

/** What a person makes of someone's presence (social.ts `perceive`). */
const SEE_PRESENCE: Tree = IF(
  param('trespass', true),
  IF(
    has('host', 'warning'),
    NOTHING,
    IF(
      has('host', 'warned'),
      DO({ op: 'witness' }, add('warning'), add('reporting', 60), say("That's it — I'm calling the watch!", '够了——我去叫守卫！'), emote('angry')),
      DO(add('warning'), add('warned'), say('What are you doing here at this hour? Out!', '这么晚你在这儿干什么？出去！'), emote('angry')),
    ),
  ),
  IF(
    param('suspect', true),
    DO({ op: 'witness' }, add('reporting', 600), say('You! It was you — I remember that face!', '你！就是你——我记得这张脸！'), emote('angry')),
    IF(
      all(param('drawn', true), tag('host', 'watchman')),
      IF(has('host', 'warned-blade'), NOTHING, DO(add('warned-blade'), say('Put that away before someone gets hurt.', '把那玩意儿收起来，别伤着人。'))),
      IF(
        all(param('wanted', { gt: 0 }), tag('host', 'watchman')),
        IF(has('host', 'pursuing'), NOTHING, DO(add('pursuing'), say('You there! Stop in the name of the watch!', '那边的！以守卫队的名义，站住！'), emote('angry'))),
        IF(param('meet', true), DO({ op: 'witness' }), NOTHING),
      ),
    ),
  ),
)

/** A chain of cases: the first whose condition holds answers, else the last. */
const cases = (list: [Cond, Tree][], otherwise: Tree): Tree => list.reduceRight<Tree>((rest, [c, t]) => IF(c, t, rest), otherwise)

/** What is said to a person (a talk verb, `say`): one rule for all people, a merchant's and a guard's over it. */
const TALK_TREE: Tree = IF(
  { same: ['host', 'actor'] },
  'inherit',
  IF(
    { none: 'instrument' },
    cases(
      [
        // spoken to: what fits the moment (a quest, a line), and the talk opens
        [not(param('say', { ne: '' })), DO({ op: 'quest' }, { op: 'talk' })],
        [says('ask'), DO({ op: 'talk' }, { op: 'tell', to: 'actor' })],
        // a chat: one of their chat lines, or — once — what they like best; a gift: the panel opens, the thing given is an act
        [says('chat'), DO({ op: 'say', text: '@chat' })],
        [says('gift'), DO({ op: 'panel', panel: 'gift' })],
        // a quest's verb (docs/quests.md §2.4): an offer taken on or turned down, a topic of a quest under way
        [says('quest'), DO({ op: 'quest' })],
        [
          says('follow'),
          IF(
            tag('host', 'essential'),
            DO(say("I can't leave — I'm needed here.", '我走不开——这里离不开我。')),
            IF(
              any({ regard: { of: 'host', toward: 'actor', cmp: { gte: 25 } } }, tag('host', 'hireling')),
              DO({ op: 'follow', leader: 'actor' }, say('Lead on, then.', '那就走吧，你带路。'), emote('happy')),
              DO(say("I don't know you well enough for that.", '我跟你还没熟到那份上。')),
            ),
          ),
        ],
        [says('wait'), DO({ op: 'setProp', key: 'waiting', value: true }, say("I'll wait here.", '我在这儿等你。'))],
        // asked to come and live in the Held Ground: what the talk verb asks, checked again (a word may be said with no
        // verb offered); all of it holding and a bed free there, they go (the society module's moveIn)
        [
          says('invite'),
          cases(
            [
              [not(INVITE.free), DO(say("I can't leave — I'm needed here.", '我走不开——这里离不开我。'))],
              [not(INVITE.away), DO(say('I live there already.', '我已经住在那儿了。'))],
              [not(INVITE.ours), DO(say("Live where? You've no ground of your own to ask me to.", '搬去哪儿？你还没有自己的地方呢。'))],
              [not(INVITE.regard), DO(say("I don't know you well enough for that.", '我跟你还没熟到那份上。'))],
            ],
            DO({ op: 'moveIn' }),
          ),
        ],
        [says('come'), DO({ op: 'setProp', key: 'waiting', value: false }, say('Right behind you.', '我跟着你。'))],
        [says('dismiss'), DO({ op: 'follow' }, say("I'll head home, then.", '那我回家了。'))],
        [
          says('bribe'),
          IF(
            COINS(BRIBE),
            DO(emit('notify', 'actor', { what: 'pay', amount: BRIBE }), regard(12), { op: 'settle' }, say("Most kind. Let's forget it ever happened.", '太客气了。就当什么都没发生过吧。'), emote('happy')),
            DO(say('With what?', '拿什么给？')),
          ),
        ],
        // A minor-specific refusal also handles legacy words sent directly, including intimidation.
        [all(any(says('rob'), says('steal'), says('unbelief'), says('intimidate')), MINOR), DO(say("…I'm going to tell my mother.", '……我要去告诉妈妈。'), emote('surprised'))],
        // robbed: might against might (the social numbers' robEdge) — overwhelmed, they hand over half their coin and their
        // two dearest things and fear the robber; not, they beat the robber down to one point of health. Either way
        // they think far less of them, and no second robbery today
        [
          says('rob'),
          IF(
            { sway: { of: 'host', by: 'actor', how: 'rob' } },
            DO(add('robbed'), { op: 'plunder', coins: 0.5, items: 2 }, { op: 'fear' }, regard(-40), say("T-take it! Take it and go!", '拿、拿去！拿了就走！'), emote('surprised')),
            DO(add('robbed'), emit('notify', 'actor', { what: 'beaten', left: 1 }), regard(-60), say('Your life, then. Lie there and think about it.', '那就要你的命好了。躺着好好想想吧。'), emote('angry')),
          ),
        ],
        // a hand in their pocket: a roll of the thief's nimbleness against their perception — unnoticed, a third of their
        // coin and their dearest thing are gone; caught, they beat the thief to half their health and think far less of them
        [
          says('steal'),
          IF(
            { sway: { of: 'host', by: 'actor', how: 'steal' } },
            DO(add('pilfered'), { op: 'plunder', coins: 0.34, items: 1 }),
            DO(add('pilfered'), emit('notify', 'actor', { what: 'beaten', share: 0.5 }), regard(-40), say('Hands off, thief!', '把手拿开，小偷！'), emote('angry')),
          ),
        ],
        [
          says('apologise'),
          IF(
            GRUDGE,
            IF(
              { sway: { of: 'host', by: 'actor', how: 'persuade', bonus: 0.15 } },
              DO({ op: 'settle' }, regard(5), emit('notify', 'actor', { what: 'karma', delta: 1 }), say("…Fine. Don't let it happen again.", '……算了。别再有下次。')),
              DO(regard(-2), say("Sorry won't mend it.", '一句对不起可补不回来。')),
            ),
            DO(say('For what?', '为什么？')),
          ),
        ],
        [says('giveback'), DO(emit('notify', 'actor', { what: 'surrender' }), { op: 'settle' }, regard(8), emit('notify', 'actor', { what: 'karma', delta: 2 }), say("Good. We'll leave it there.", '好。这事就到此为止。'))],
        // told there are no gods: the speaker's own faith wavers for saying it; the devout are hurt by it, the rest wonder
        [
          says('unbelief'),
          IF(
            tag('host', 'devout'),
            DO(add('doubted'), emit('notify', 'actor', { what: 'faith', delta: -5 }), regard(-8), say('Hold your tongue. They suffered five times over for that mouth of yours.', '闭嘴。他们为你这张嘴受了五重苦难。'), emote('angry')),
            DO(add('doubted'), emit('notify', 'actor', { what: 'faith', delta: -5 }), say('…No gods? Then who is keeping the sun up?', '……没有神？那是谁在托着太阳？'), emote('surprised')),
          ),
        ],
        // asked for what one took (an owner, conduct.ts): one may give it back (the talk) or not; nothing said back here
        [says('demand'), NOTHING],
        // stopped by one who keeps the watch: the one at the keys chooses, anyone else yields (the `arrest` primitive)
        [says('arrest'), DO({ op: 'arrest' })],
        [says('trade'), DO(say("I've nothing to sell.", '我没什么可卖的。'))],
        [says('turnin'), DO(say('Take that up with the watch.', '这事去找守卫队吧。'))],
        [says('bye'), NOTHING],
      ],
      // a word no rule knows: the person's to answer (the AI's place, docs/npc-sandbox.md §2.12)
      HOLE(say('…', '……')),
    ),
    'inherit',
  ),
)

const GUARD_TREE: Tree = IF(
  { same: ['host', 'actor'] },
  'inherit',
  cases(
    [
      [says('pay'), IF({ canPay: { role: 'actor' } }, DO({ op: 'fine' }, say('Paid in full. Now behave yourself.', '罚金交齐了。以后老实点。')), DO(say("You can't pay that. The cells, then.", '你付不起。那就进牢房吧。'), { op: 'imprison' }))],
      [says('jail'), DO(say('Come along, then.', '那就跟我走吧。'), { op: 'imprison' })],
      [
        all(says('persuade'), WANTED),
        cases(
          [
            [{ unpardonable: 'actor' }, DO(add('persuaded'), say('Not for blood. Never for blood.', '血债没得商量。绝不。'))],
            [has('host', 'persuaded'), DO(say("We've talked. Pay, or come quietly.", '话已经说过了。交钱，或者老实跟我走。'))],
            [{ sway: { of: 'host', by: 'actor', how: 'persuade' } }, DO(add('persuaded'), emit('notify', 'watch', { what: 'pardon' }), say('…Fine. Get out of my sight.', '……行吧。别让我再看见你。'))],
          ],
          DO(add('persuaded'), regard(-3), say('Nice try. Pay, or come quietly.', '想得美。交钱，或者老实跟我走。')),
        ),
      ],
      [
        all(says('bribe'), WANTED),
        IF(all(not({ unpardonable: 'actor' }), { canPay: { role: 'actor', mul: 1.5 } }), DO({ op: 'fine', mul: 1.5, keep: true }, say("I didn't see a thing. Neither did you.", '我什么也没看见。你也是。')), DO(say("That won't cover it.", '这点钱可不够。'))),
      ],
      [says('resist'), DO(say('Then you pay in blood!', '那就拿血来偿！'), emote('angry'), emit('notify', 'actor', { what: 'resist' }), { op: 'foe' }, emit('notify', { around: 10 }, { what: 'help' }, { filter: { tags: ['watchman'] } }))],
      [says('turnin'), IF(WANTED, DO(emit('handle', 'actor', { say: 'arrest' })), DO(say('You owe the watch nothing.', '你不欠守卫队什么。')))],
    ],
    'inherit',
  ),
)

const MERCHANT_TREE: Tree = IF(
  { same: ['host', 'actor'] },
  'inherit',
  IF(says('trade'), DO({ op: 'restock' }, { op: 'panel', panel: 'trade' }, say('Have a look.', '随便看看。')),
  IF(says('buy'), DO({ op: 'restock' }, { op: 'sell' }),
  IF(all(says('sell'), { is: { role: 'instrument', sel: { tags: ['portable'] } } }), DO({ op: 'buy' }),
  'inherit'))),
)

/** What a person is told (impulse/notify), beside what body/stage keeps (rules.ts folds these in there). */
export const PERSON_NEWS = (rest: Tree): Tree =>
  // Resident work commands and internal acknowledgements are a person-side notification branch.
  IF(any(what('resident-work-command'), what('resident-work-internal')), DO({ op: 'residentWork/update' }),
  // Choosing to fight the watch takes a fighting stance; putting it away again yields to arrest.
  IF(what('resist'), DO(add('drawn')),
  IF(what('pay'), DO({ op: 'pay', amount: { param: 'amount' }, to: 'source' }),
  // a quest's reward (docs/quests.md): what one makes of the one who did it (the actor)
  IF(what('regard'), DO({ op: 'regard', delta: { param: 'delta' } }),
  IF(what('give'), DO({ op: 'give', to: 'source' }),
  IF(what('surrender'), DO({ op: 'surrender' }),
  // beaten by one robbed or caught with a hand in their pocket: down to a share of one's health, or to what is left
  IF(all(what('beaten'), param('share', { gt: 0 })), DO({ op: 'beaten', share: { param: 'share' } }),
  IF(what('beaten'), DO({ op: 'beaten', left: { param: 'left' } }),
  IF(what('jail'), DO({ op: 'jail' }),
  IF(what('chat'), DO({ op: 'tell', to: 'other' }),
  IF(what('news'), DO({ op: 'hear' }),
  IF(what('calm'), DO({ op: 'calm' }),
  // a cry for help: one who fights (a guard, the smith) takes the attacker as its foe; the rest keep away from them
  IF(what('help'), IF(any({ prop: { role: 'host', key: 'fights', cmp: true } }, tag('host', 'watchman')), DO({ op: 'foe' }), DO({ op: 'fear' })),
  rest)))))))))))))

export const SOCIAL_RULES: Rule[] = [
  rule({
    id: 'people/speak',
    doc: 'One speaking to another (a hand with something to say): one asking back what was taken says so and waits; one who keeps the watch tells the wanted to stop; the rest is the listener\'s to answer (docs/npc-sandbox.md §2.6–2.7).',
    host: PERSON,
    on: 'act/hands',
    tree: IF(
      says('demand'),
      DO(say('That is mine — give it back.', '那是我的——还给我。'), emote('angry'), add('demanding'), add('demanded'), emit('handle', 'target', { say: 'demand', item: { param: 'item' } })),
      IF(says('arrest'), DO(say('Stop right there! The watch wants a word.', '站住！守卫队有话问你。'), emit('handle', 'target', { say: 'arrest' })), 'inherit'),
    ),
  }),
  rule({
    id: 'people/talk',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'A hand on a person: a quest they have for you, else what fits the moment, and their talk opens (§2.9). Asked (a talk verb): news, a chat (one of their chat lines, or once what they like best), a gift (the panel), to follow, to wait, bribed, robbed (might against might: overwhelmed they hand over coin and goods, else they beat the robber to a point of health), a hand in their pocket (a roll of nimbleness: unnoticed it takes coin and a thing, caught the thief is beaten to half), told there are no gods, an apology, what was taken given back, stopped by the watch; a minor by tag or recorded age is explicitly refused robbery, theft, unbelief and intimidation; a word no rule knows is theirs to answer (the AI\'s).',
    host: PERSON,
    on: 'impulse/handle',
    tree: TALK_TREE,
  }),
  rule({
    id: 'people/trade',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'A merchant asked to trade shows its goods (its stock, made up once a day); asked for one of them (param item), it sells it at its price; offered a thing (the instrument), it buys it if it is the seller\'s to sell — a fence buys what is not (§2.10).',
    host: MERCHANT,
    on: 'impulse/handle',
    tree: MERCHANT_TREE,
  }),
  rule({
    id: 'people/watch',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'One who keeps the watch, having stopped one it wants: paid, the bounty is cleared (and what was not theirs taken back); refused, or too poor, the cells; talked round or bribed (not for blood); resisted, it fights and calls the watch (§2.7).',
    host: WATCHMAN,
    on: 'impulse/handle',
    tree: GUARD_TREE,
  }),
  rule({
    id: 'people/see',
    doc: 'A person who did a deed sees it too, witnessed or not: its karma falls (conscience). A person who sees a deed takes it in (who did it, or how they looked) and answers by who they are: the watch at once; the wronged cry out or ask back, and people talk of a theft; witnesses tell the watch, unless they keep quiet. Seeing someone where they should not be, a stranger they remember, a blade drawn, one the watch wants: they say so. An act the world had no answer for is asked once, of its host; what it comes to is seen when it is answered (§2.6, §2.12).',
    host: PERSON,
    on: 'seen',
    // (one with no record of its own — whose answers are an input's — makes nothing of it here)
    // (one's own deed — seen by its doer, witnessed or not — weighs on its karma: its conscience)
    tree: IF(param('own', true), DO({ op: 'conscience' }), IF({ remembers: 'host' }, IF(param('act', 'presence'), SEE_PRESENCE, IF({ deed: true }, SEE_DEED, NOTHING)), NOTHING)),
  }),
  rule({
    id: 'people/report',
    doc: 'A witness on its way (reporting), or an owner whose thing did not come back (demanding): the watch is told.',
    host: PERSON,
    on: 'time/timer',
    tree: IF(any(param('status', 'reporting'), param('status', 'demanding')), DO({ op: 'report' }), 'inherit'),
  }),
  rule({
    id: 'people/morning',
    doc: 'Each morning one has one\'s purse again (a day\'s wage), and a merchant its stock.',
    host: PERSON,
    on: 'time/period',
    tree: IF(param('name', 'morning'), DO({ op: 'restock' }), 'inherit'),
  }),
  rule({
    id: 'people/death',
    doc: 'A person at no health who is not essential dies (the essential go down): one who struck learns from it, people will talk of it, and they become their body, a container of what they carried (§2.8).',
    host: PERSON,
    on: 'threshold/cross',
    tree: IF(
      all(param('name', 'broken'), not(tag('host', 'essential'))),
      DO(
        { op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'defeat', xp: { prop: 'maxHp', of: 'host' } } },
        emit('notify', 'story', { what: 'topic', value: 'death', days: 4 }),
        { op: 'vfx', fx: 'poof', at: 'tileOf:host' },
        { op: 'log', text: L('{host} dies.', '{host}死了。') },
        { op: 'die' },
      ),
      'inherit',
    ),
  }),
  rule({
    id: 'people/pockets',
    label: L("Pick {target}'s pocket", '扒{target}的口袋'),
    doc: 'Taken hold of by one sneaking (E, sneaking): a person\'s pockets are open to the hand — each thing taken from them is an act, seen or not (§2.10).',
    host: PERSON,
    on: 'impulse/taken',
    tree: IF(all(has('actor', 'sneaking'), not({ same: ['host', 'actor'] })), DO({ op: 'panel', panel: 'pockets' }), 'inherit'),
  }),
  rule({
    id: 'people/plant',
    label: L("Slip {instrument} into {target}'s pocket", '把{instrument}塞进{target}的口袋'),
    doc: 'A thing put on a person by one sneaking (G) goes into their pocket unasked: a hand in a pocket, seen or not (§2.10).',
    host: { type: 'item', tags: ['portable'] },
    on: 'act/put',
    tree: IF(all({ is: { role: 'target', sel: PERSON } }, has('actor', 'sneaking'), not({ same: ['actor', 'target'] }), not(tag('host', 'bound'))), DO({ op: 'move', to: 'target', into: 'contents' }), 'inherit'),
  }),
  rule({
    id: 'remains/search',
    label: L('Search {target}', '翻找{target}'),
    doc: 'A hand on what a person left (a body, bones): one searches it — what they carried is there to take (and taking it is taking what is another\'s).',
    host: { type: 'fixture/remains' },
    on: 'impulse/handle',
    tree: IF(has('host', 'open'), DO(), DO({ op: 'open' })),
  }),
  rule({
    id: 'watch/ledger',
    doc: 'A watch keeps its ledger: a deed reported raises the doer\'s bounty by its fine (each deed once); paid, or pardoned, the bounty is cleared (§2.7).',
    host: { type: 'resident/watch' },
    on: 'impulse/notify',
    tree: IF(what('report'), DO({ op: 'charge' }), IF(what('pardon'), DO({ op: 'charge', clear: true }), 'inherit')),
  }),
  rule({
    id: 'resident-work/body-command',
    doc: 'Only a resident work order or its own transient work step is handled by the resident work module; worker-side authorization is checked again by its own-host primitive.',
    host: { type: 'fixture/remains/body' },
    on: 'impulse/notify',
    tree: IF(any(what('resident-work-command'), what('resident-work-internal')), DO({ op: 'residentWork/update' }), 'inherit'),
  }),
]
