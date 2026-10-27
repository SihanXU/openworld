// Radiant favours (docs/quests.md §3): the Story Manager makes them out of the world's news — someone hungry with
// no coin, a theft its owner saw, the evening's night-born, a morning's errand between households — and they sit
// with the one who asks (a yellow "!", the notice board) until taken on, turned down, or their time runs out.
// Generic kinds of favour, never another game's content; each fills its aliases from the news or the village.

import type { QuestDef } from '@openworld/engine'
import { L } from './kit.ts'
import { SOCIAL_COIN } from '../social.ts'

const PERSON = { type: 'actor/person' } as const

export const FAVORS: QuestDef[] = [
  {
    id: 'meal',
    kind: 'favor',
    title: L('A Bite to Eat', '一口吃的'),
    summary: L('{hungry} has not eaten all day and has no coin for a meal. Bring them something to eat ({key:put} hands it over).', '{hungry}一整天没吃东西了，身上也没钱买。给{hungry}带点吃的（按 {key:put} 递给对方）。'),
    aliases: { hungry: { from: 'target' } },
    objectives: [{ id: 'feed', text: L('Something to eat for {hungry}', '给{hungry}的吃的'), target: 'hungry', on: { give: { tags: ['edible'] }, to: 'hungry' } }],
    stages: [
      { n: 10, show: ['feed'], log: L('{hungry} is hungry, with no coin for a meal.', '{hungry}饿着肚子，身上没钱买吃的。') },
      { n: 100, on: { objectives: ['feed'] }, complete: true, by: 'hungry', say: L('Oh — thank you. I will not forget it.', '哦——谢谢你。我不会忘的。'), reward: { xp: 10, regard: { hungry: 15 } }, log: L('{hungry} ate.', '{hungry}吃上了东西。') },
      { n: 200, on: { gone: 'hungry' }, failed: true, log: L('{hungry} is gone.', '{hungry}已经不在了。') },
    ],
    start: { news: 'hungry', offer: 'hungry', most: 2 },
    deadline: 8,
    offer: L('I have not eaten since yesterday, and there is not a coin on me. ...If you have anything to spare, I would be grateful.', '我从昨天到现在什么都没吃，身上一个子儿也没有。……你要是有多余的吃的，能不能分我一点？'),
    accepted: L('You would? Anything at all.', '你愿意？什么都行。'),
    declined: L('No. I understand.', '没事。我明白。'),
    waiting: L('Anything to eat. Anything.', '吃的就行。什么都行。'),
  },
  {
    id: 'recover',
    kind: 'favor',
    title: L('What Was Taken', '失物'),
    summary: L('{thief} took {thing} from {owner}, who saw it. Get it back and bring it to {owner}.', '{thief}拿走了{owner}的{thing}，被{owner}看见了。把它拿回来，交还给{owner}。'),
    // (a meal taken is eaten: only a thing that keeps is a favour to get back)
    aliases: { owner: { from: 'target' }, thief: { from: 'actor' }, thing: { from: 'item', match: { notTags: ['edible'] }, keep: true } },
    objectives: [
      { id: 'get', text: L('Get {thing} back from {thief}', '从{thief}那里拿回{thing}'), target: 'thief', talk: true, on: { carry: 'thing' } },
      { id: 'return', text: L('Give {thing} back to {owner}', '把{thing}还给{owner}'), target: 'owner', on: { give: 'thing', to: 'owner' } },
    ],
    topics: [{ id: 'demand', with: 'thief', label: L('Give back what you took.', '把你拿走的东西交出来。') }],
    stages: [
      { n: 10, show: ['get', 'return'], log: L('{owner} saw {thief} take {thing}.', '{owner}看见{thief}拿走了{thing}。') },
      { n: 20, on: { talk: 'thief', topic: 'demand' }, from: [10], by: 'thief', say: L('...Fine. Take it. It was not worth the trouble.', '……行吧。拿去。为这个不值得惹麻烦。'), take: [{ match: 'thing', count: 1, from: 'thief', to: 'player' }], log: L('{thief} gave {thing} up.', '{thief}交出了{thing}。') },
      { n: 100, on: { objectives: ['return'] }, done: ['get', 'return'], complete: true, by: 'owner', say: L('My {thing}! I did not think I would see it again.', '我的{thing}！我还以为再也见不到它了。'), reward: { xp: 15, items: [{ type: SOCIAL_COIN, count: 10 }], regard: { owner: 15 } }, log: L('{thing} is back with {owner}.', '{thing}回到了{owner}手里。') },
      { n: 200, on: { gone: 'thing' }, failed: true, log: L('{thing} is gone for good.', '{thing}已经没了。') },
    ],
    start: { news: 'deed', offer: 'owner', most: 2 },
    deadline: 24,
    offer: L('{thief} took my {thing}, right in front of me. If you can get it back, I will make it worth your while.', '{thief}当着我的面拿走了我的{thing}。你要是能拿回来，我不会亏待你。'),
    accepted: L('Thank you. {thief} will not have gone far.', '谢谢你。{thief}走不远的。'),
    waiting: L('My {thing}. {thief} still has it.', '我的{thing}。还在{thief}那里。'),
  },
  {
    id: 'parcel',
    kind: 'favor',
    title: L('A Letter to Carry', '捎封信'),
    summary: L('{sender} has a letter for {recipient}. Carry it over ({key:put} hands it to them).', '{sender}有一封信要给{recipient}。帮忙送过去（按 {key:put} 递给对方）。'),
    aliases: {
      sender: { find: { ...PERSON, map: 'meadow', person: true, pick: 'random', notTags: ['merchant', 'watchman'] } },
      recipient: { find: { ...PERSON, map: 'meadow', person: true, pick: 'random' } },
      letter: { make: { type: 'item/document/letter', in: 'player', name: L("{sender}'s letter to {recipient}", '{sender}给{recipient}的信') }, keep: true },
    },
    objectives: [{ id: 'deliver', text: L('The letter to {recipient}', '把信交给{recipient}'), target: 'recipient', on: { give: 'letter', to: 'recipient' } }],
    stages: [
      { n: 10, show: ['deliver'], log: L('{sender} gave me a letter for {recipient}.', '{sender}托我把一封信带给{recipient}。') },
      { n: 100, on: { objectives: ['deliver'] }, complete: true, by: 'recipient', say: L('A letter? From {sender}? ...Thank you for bringing it.', '一封信？{sender}写的？……谢谢你送来。'), reward: { xp: 10, items: [{ type: SOCIAL_COIN, count: 6 }], regard: { sender: 8, recipient: 5 } }, log: L('{recipient} has the letter.', '信交到了{recipient}手里。') },
      { n: 200, on: { gone: 'recipient' }, failed: true, log: L('{recipient} is gone.', '{recipient}已经不在了。') },
      { n: 210, on: { gone: 'letter' }, failed: true, log: L('The letter is lost.', '信丢了。') },
    ],
    start: { news: 'morning', offer: 'sender', most: 1, chance: 0.6 },
    deadline: 12,
    offer: L('Would you carry a letter to {recipient} for me? My legs are not what they were.', '能帮我给{recipient}捎封信吗？我的腿脚不如从前了。'),
    accepted: L('Here. Mind you do not read it.', '给。可别偷看。'),
    waiting: L('The letter, to {recipient}.', '那封信，交给{recipient}。'),
  },
  {
    id: 'cull',
    kind: 'favor',
    title: L('The Night-born', '清剿夜行者'),
    summary: L('{guard} wants the night-born kept away tonight. Put down 3 of them out past the fence, then go back to {guard}.', '{guard}想让夜行者今晚别靠近。到围栏外面打倒 3 个，再回去找{guard}。'),
    aliases: { guard: { find: { ...PERSON, tags: ['watchman'], person: true, pick: 'random' }, essential: true } },
    objectives: [
      { id: 'kill', text: L('Night-born put down', '打倒的夜行者'), count: { kill: { tags: ['nightborn'] } }, need: 3 },
      { id: 'back', text: L('Back to {guard}', '回去找{guard}'), target: 'guard', talk: true },
    ],
    stages: [
      { n: 10, show: ['kill'], log: L('{guard} asked me to thin the night-born out.', '{guard}托我去清一清夜里的东西。') },
      { n: 20, on: { objectives: ['kill'] }, show: ['back'], log: L('Three of them down. Back to {guard}.', '打倒了三个。回去找{guard}。') },
      { n: 100, on: { all: [{ talk: 'guard' }, { objectives: ['kill'] }] }, done: ['back'], complete: true, say: L('Good. The village sleeps easier for it.', '好。村子今晚能睡得安稳些。'), reward: { xp: 20, items: [{ type: SOCIAL_COIN, count: 12 }], regard: { guard: 8 } }, log: L('{guard} paid me for the night\'s work.', '{guard}为这一晚的活儿付了钱。') },
    ],
    start: { news: 'night', offer: 'guard', most: 1, chance: 0.6 },
    deadline: 10,
    offer: L('The night-born are thick out past the fence again. Put three of them down before morning, and the watch will pay.', '围栏外面的夜行者又多起来了。天亮之前打倒三个，守卫队给你钱。'),
    accepted: L('Mind the trees. They come out of the dark there.', '小心树林。它们从那边的黑暗里出来。'),
    waiting: L('Three of them, before morning.', '三个，天亮之前。'),
  },
]
