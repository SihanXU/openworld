# How the game's words are written

Status: **agreed with the user 2026-10-27.** Every line a person says, every scene, every quest's text, every readable thing on a
map is written to this page. It replaced a voice the user found unreadable: lines that read as translated, quips with a twist at the
end, a fairy who explained every clue and every feeling, the story's secrets said aloud in a stranger's first line.

The model is FromSoftware's writing (Dark Souls, Elden Ring), studied from the games' own text, not from memory: Melina's whole
dialogue in the official Chinese; Irina, Kenneth Haight, Boc, Roderika, Alexander and Gurranq in Elden Ring; the Crestfallen Warrior
and Solaire in Dark Souls; and a dozen item descriptions (talismans, keys, seeds, a letter, weapons). What was found there is §1; the
rules that follow from it are §2; each kind of text is §3; worked examples, §5.

## 1. What their text does

1. **Every sentence is whole and plain.** A first meeting is told in order: a greeting, the name, where they are from, what happened
   (as they saw it), what they want of you, where to go. Irina's first speech is fifteen lines and all of it is clear on one reading;
   so is Melina's offer (what a Finger Maiden is, that you have none, that she can stand in, what she asks in return). Only a
   character whose mind is going speaks in broken pieces (Gurranq), and that is his alone.
2. **The fragments are in what each person knows, not in the grammar.** Each knows one piece and tells it from where they stand, with
   their limits: Irina was born with weak eyes, so she says only that "the servants rebelled" and that she heard howling; what the
   servants are, you see for yourself in the castle. No one is there to explain the world. The truth is put together by the player from
   many mouths and many objects.
3. **The world's history comes as hearsay.** "Or so I hear." "It is said that…" "Perhaps…" The speaker passes on what they were told,
   and may be wrong.
4. **Where to go and what to do is never hidden.** "My fort lies to the south, beyond the Mistwood." "Stormveil, on the cliff, holds a
   shardbearer." The why is what is withheld.
5. **Everyone sounds like themselves.** A pompous lordling, a humble seamster who calls you "master", a jar who laughs at his own
   bravado, a soldier who mocks you as he helps you, a maiden who pauses before she speaks and says "I would ask you to…". The humour
   comes from who they are, never from a line built to be clever.
6. **Feeling is said by the one who feels it, simply.** "I fear for father's life." "Tell them I love them." No one stands beside the
   hero saying how sad this is. Melina, the companion, speaks at places and about the place, or about herself; she never remarks on what
   the player has just found.
7. **An item's text has three parts:** what it is; what it does; one or two sentences of its history ending on a concrete detail, never
   a moral. Some carry only the use (a rusted key opens a door in the castle). Some add one dry practical note ("Think well before using
   one."). A letter is described as the thing it is: a silk handkerchief, a little blood on it, words that can be made out.

## 2. The rules

1. **Whole, plain sentences, readable at once.** No telegraph style ("Lina. Oskar. Barrow. Not back."). No sentence the reader has to
   parse twice.
2. **A first meeting tells its story in order:** greeting → name → what happened → what they want → where to go. Later lines restate the
   ask in one sentence, or move on to the person's own life.
3. **Each person says only what they know, from where they stand.** They may be wrong, they may not know, they may refuse to say. They
   talk about their work, their things, what is in front of them — not about the meaning of suffering, life or the world.
4. **The world's history comes through hearsay, the Church's teaching, and things.** "They say…", "Sister Ilse says…", "the Church
   teaches…", an inscription, a register, a letter. No one explains the setting on purpose. Nothing a later chapter reveals is said
   aloud early (lore.md §9–§16 stay hidden in Part One; a hint, once, at most).
5. **Where and what are concrete.** Name the place and the direction, the thing and the number. The why is left to the player.
6. **Each person has a voice** (§4): register, sentence length, what they always come back to. No aphorisms. No line that ends on a
   reversal ("…or they won't", "…if you think about it", "…or I was quicker"). No witty folk wisdom.
7. **Feeling is said plainly by the one who feels it.** Lumi does not interpret, sum up or announce feelings: not "that's the saddest
   book I ever saw", not "kind… tired, but kind", not "that's worse, much worse". Her sadness is the player's to find (docs/cast/lumi.md).
8. **Things and places carry the fragments**: what it is → (what it does) → one concrete detail. No closing moral.

### Chinese

The Chinese is written as Chinese, not translated from the English line beside it; the two say the same thing, each in its own idiom.

- No translationese: long 的-chains before a noun (「那位为我们走进古墓的人」), 「一个……的人」 openings, 被 where Chinese uses an active
  verb, literal English idioms (「钱流得慢」), English sentence order (「站着是给那些有地方要去的人的」).
- Registers: villagers in plain spoken Chinese; the Church, the knights and old inscriptions in a measured written register that leans
  classical where it is ceremony (the official Chinese of Elden Ring is the reference: 「穿越雾前来的人啊」「希望你……」); Lumi as a bright,
  curious girl; a child as a child.
- 「……」 is a person's own habit (a hesitant speaker) or a real trailing-off, not a rhythm every line uses; 「——」 marks an interruption or a
  turn to the key word at the end of a sentence, at most once in a line.
- The names are the established ones (wiki/译名.json, the people's records); the creed's canonical words (lore.md §1) are kept as they are.

### English

Plain, modern, spoken English for ordinary people; a slightly older, formal English for the Church, the knights and Alberic (FromSoftware
gives "thee" and "thou" to nobility and the old; use it sparingly, for Alberic, the abbot's ghost and ceremony only). The same rules: whole
sentences, no quips, no twist endings.

## 3. Each kind of text

- **A person's lines** (`line(key, en, zh)`): `greeting:first` and the first `default` are the first meeting (rule 2). `chat` is small talk
  in their voice about their own day, work and people — concrete, one to three sentences; no more than one or two of a person's chats may
  be a hidden kindness, and none a moral. `topic:*` and `fact:*` lines are news as this person takes it: what they saw or heard and what it
  means to them, said simply. `hour:*` and `weather:*` are short and practical. `favourite` says what they like in their voice.
- **Scenes** (`say(who, en, zh, mood)`): people talk as above. The player's parenthesised narration describes what is seen, in short
  concrete sentences, in the present, without interpretation. Lumi reacts briefly and as herself (curious, frightened, practical) — she
  may ask a question; she never answers the scene's question for the player.
- **Lumi's bubbles** (`say: L(…)` on beats): she notices one thing at a place — a sound, a smell, a cold — in one or two sentences. She
  may point at the next step if the player needs it ("Tam's cellar is down there").
- **Readable things** (`text`/`text_zh` on fixtures, letters, registers, inscriptions): the object's words as written, or what is seen on
  it; rule 8.
- **Quests**: `title` a short name. `summary` two sentences at most: who asks, what for, and where. `objectives[].text` a plain task with
  its place ("Find Oskar in the ossuary, on the second floor"). `hint` where to go and what to do, story first; when the step needs a key,
  one plain sentence with the `{key:…}` after it — a hint that is a tutorial (the clearing, the guides) teaches as plainly as possible.
  `log` one or two sentences of what happened or who said what (「罗万说，……」), in the player's plain first person where it is a diary.
  `say` (what the giver says at a stage) and `waiting` follow the giver's voice. Rewards' item names follow rule 8's naming: what it is,
  whose it was.
- **Backdrop people** (`continent/folk.ts`): one whole sentence or two, in the voice of what they are (farmer, merchant, guard, child,
  pilgrim …), about what is in front of them; the lengthening nights, the closed road east, the shortages show through their work, never
  as a comment on the world.

## 4. Voices

Read the person's own record (its header comment, `temperament`, `ties`) and `docs/cast/<id>.md` where there is one. In brief:

| Who | How they speak |
|---|---|
| Rowan, Firstlight's elder | grave, polite, few words but whole sentences; responsibility, the village's count of souls |
| Sister Ilse | gentle, formal, warm, a little absent-minded (forgets what she came for); weak eyes, knows people by their step; devout without preaching except when she preaches |
| Lumi | bright, curious, brave, quick; questions; frightened when it is cold; never says the sad thing |
| Severin | cold, sparing, whole sentences; says what he will do and what he wants, never explains why |
| Pell | an excited boy who draws; talks fast, asks to draw everything |
| Hesper | blunt ferrykeeper, river talk, will not admit her hands are stiff |
| Fennick | an old squire remembering; long sentences when he remembers, short when he is asked |
| Lina | prickly, proud, will not ask for help; brief |
| Oskar | the oldest forager, grumbling, practical |
| Alberic | an old knight; formal, slow, slightly archaic; keeps his vow, wants a name to remember |
| Caius | the Church's priest at the Rest: kind, tired, certain, official phrasing when he is being official |
| Edda | a frightened, worn farm widow; jumps when spoken to |
| Nessa | an almanac-maker; numbers, sunsets, the curve |
| Garrick | loud at the anvil, quiet elsewhere |
| Wren | young, quick, read about dragons |
| Mara | Emberfall's elder; tough, counts what is left |
| Tobin | a peddler who never stops talking |
| the others | from their record: their trade, their age, their temperament |

## 5. Examples (agreed)

**Rowan, the first meeting**
> 你是从山上下来的吧。我叫罗万，是这个村子的长老。
> 起风暴那天，村里有两个人去了南边的古墓避雨，一个叫莉娜，一个叫奥斯卡。到今天还没回来。
> 那座古墓里埋的都是死人。以前死人是安安静静躺着的，这阵子不是了。
> 我年纪大了，下不去。村里能拿兵器的人，也没剩几个。
> 你要是肯走一趟：往南穿过草原和森林，到荆棘谷，两块立石中间就是古墓的入口。拜托了。

*You've come down off the mountain, then. I'm Rowan; I'm elder here, for what that's worth. / The day the storm broke, two of ours went
into the old barrow to the south for shelter — Lina and Oskar. They've not come back. / The dead lie in that barrow. They used to lie
quiet. Not lately. / I'm too old to go down there myself, and we've few left who can hold a blade. / If you'd go: south through the
grassland and the forest to Thornwood Hollow. The barrow mouth is between two standing stones. I'd be grateful.*

Later: 「古墓在南边的荆棘谷，两块立石中间。莉娜和奥斯卡，拜托你了。」

**Sister Ilse, a chat** (her own situation, and a thread for later):
> 啊，是你呀。你的脚步声，我已经记住了。我的眼睛从小就怕光，白天看人总是模模糊糊的，只好靠耳朵。所以往后你来，不用出声，我也认得出是你。

**Severin, the first meeting** (what he wants, not the secret):
> 朝圣者，回去吧。这条路走到头，也没有你要找的东西。
> 荆棘后面那位骑士，守这条路守了三百年。他是个好人，到现在也还是。
> 教会要你去取他的冠冕。你去取吧，我不拦你。
> 只是冠冕摘下来的时候，会有东西从里面出来。那个东西，我要带走。
> （他看了露米一眼，看了很久，什么也没说，转身走了。）

**Backdrop people**
- 农夫：东边那几垄我这礼拜翻了两遍，土还是硬邦邦的。往年这时候早就松了。
- 商人：要什么随便看。灯油就别问了，这个月一滴都没进来，家家都缺。
- 路人：我是往西边去的。东边那条大路，听说过了河就走不通了，有个骑士拦在路上。
- 卫兵：天黑以后别出村子。围栏外面那些东西，去年还没这么多。

**Lumi in the watchman's hut**, after the log is read: 「这里好冷……我们快走吧。」 (not a word about the log).

**A readable thing: the unsent writ**
> 一份盖着骑士团火漆的替任文书。上面写着：持冠者阿尔贝里克承印已满四十年，当另派一人接替。
> 火漆完好，没有拆过，也没有寄出去。
> 背面有一行字，墨色比正文新：找不到愿意承受的人。就让他继续守着吧。

**An item's text** (the shape for any description to come):
> 朝圣者的扇贝徽记，用一根旧绳穿着。
> 教会点名的朝圣者出发前都会领到一枚，戴着它走完往东的路。
> 这一枚是在森林深处的石冢旁找到的。绳子已经朽了，扇贝背面刻着一个名字：卡西安。

**Quest text**
- summary: 莉娜和奥斯卡在起风暴那天躲进了南边的古墓，一直没有回来。村长罗万托你去找他们。
- log: 罗万说，古墓里的死人最近不肯安息。
- hint: 赫斯珀说，白骑士拆走了沼泽边小桥上的三块木板。补上它，或者另找办法过河。

## 6. What a rewrite keeps

Ids, keys, `{key:…}`, `{favourite}`, `{hungry}` and every other placeholder, moods, the structure of each record and scene, numbers that
match the game (counts, prices, directions), and every fact the story and the tests rely on. A line that already keeps these rules stays
as it is; the rewrite is of the text, not of the story.
