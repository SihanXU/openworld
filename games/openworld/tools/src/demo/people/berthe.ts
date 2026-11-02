// Sister Berthe of Fairweight's poorhouse (docs/chapter-3.md §7): she feeds eleven children from a sack of bran and has
// given away her own share for months; thin as a rake, dry, fierce. She will not let her children near the scale:
// hunger is how the body asks to live.

import { line, type PersonDef } from '../person.ts'

export const berthe: PersonDef = {
  id: 'npc.berthe',
  role: 'priest',
  essential: true,
  tags: ['storybound', 'devout'],
  name: { en: 'Sister Berthe', zh: '贝尔特修女' },
  gender: 'female',
  look: { parts: { hair: 'hair.bun', face: 'face.weary', outfit: 'outfit.robe', hat: 'hat.kerchief' }, colors: { hair: 'umber', eyes: 'hazel', skin: 'fair', 'outfit.1': 'slate', 'hat.1': 'linen' } },
  age: 45,
  favourite: 'item/food/bread',
  temperament: { personality: 'stubborn', manner: 'plain', social: 'outgoing', outlook: 'wary' },
  ties: { 'npc.elsie': 'in her care', 'npc.haskel': 'quarrels with him' },
  purse: 4,
  trade: { stock: [['item/material/herb', 2], ['item/material/cloth', 1]] },
  schedules: {
    default: [
      [22, 5, 'fairweight.poorhouse:berthe.bed', 'sleep'],
      [5, 12, 'fairweight.poorhouse:berthe.kitchen', 'feed the children'],
      [12, 17, 'fairweight:berthe.lane', 'beg bread for the poorhouse'],
      [17, 22, 'fairweight.poorhouse:berthe.kitchen', 'put the children to bed'],
    ],
  },
  lines: [
    line('chat', 'Bran porridge again. The children say it tastes of nothing. I tell them that is what hope tastes of, and they laugh at me.', '又是麸皮粥。孩子们说没味道。我跟他们说，希望就是这个味，他们就笑话我。'),
    line('chat', 'I gave my bread to the little ones in the spring and it has become a habit. Don\'t look at me like that.', '开春的时候我把面包分给小的，后来就成了习惯。别那样看着我。'),
    line('greeting:first', 'A pilgrim. Sit down if you like; we have nothing to offer you but a bench. I am Sister Berthe. I keep the poorhouse, such as it is.', '一个朝圣者。想坐就坐吧，除了长凳，我们也没别的能招待你。我是贝尔特修女，管着这座济贫院，就这么个济贫院。', { once: true }),
    line('default', 'Hunger is how the body asks to live. Take it away and the body stops asking. I have watched it stop asking in forty people.', '饿，是身子在求着活下去。把饿拿走，身子就不求了。我亲眼看着四十个人的身子不再求了。'),
    line('default', 'None of mine go near that scale while I am alive. They are hungry. Good. Hungry children are alive.', '只要我还活着，我的孩子谁也别想靠近那杆秤。他们饿。好。饿着的孩子是活的。'),
    line('hour:night', 'Go to bed, pilgrim. Some of us still need to.', '去睡吧，朝圣者。我们当中，有些人还需要睡觉。'),
    line('fact:ch3.pans', 'You saw them. Now tell me it is mercy.', '你看见他们了。现在你跟我说，那是不是慈悲。', { once: true, mood: 'angry' }),
    line('topic:scale_tipped', 'They are all hungry again. Every one of them. I have never been so glad of anything in my life.', '他们又全都饿了。一个不落。我这辈子从来没为什么事这么高兴过。', { mood: 'happy' }),
    line('fact:ch3.end', 'They ate, and then they slept, all over the square, like children. I covered them with whatever I had.', '他们吃了，然后就睡了，满广场都是，跟孩子似的。我把手边能找到的东西都给他们盖上了。'),
    line('given:item/food/bread', 'Bread. This goes to the children, and I will hear no argument.', '面包。这个给孩子们，我不听你争。', { mood: 'happy' }),
  ],
}
