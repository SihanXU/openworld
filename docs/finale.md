# The Finale: The Most Holy Hall (终章 · 至圣大殿)

Status: **built 2026-11-01**. Playable from Chapter 5's bells to the last sentence; proved offline by
`tools/test/demo.test.ts` FIN, the reach by `tools/test/release.test.ts`. §12 lists what was built and where. It follows [lore.md](lore.md) §10 (the second reversal), §11 (the world's rule), §13–§17
(the chosen one, Astra, the fight, the preview ending, the closing shot) and the main line's shared plan in
[chapter-3.md](chapter-3.md) §2. Lore's own words are kept (Astra's lines, the last sentence); marked **[proposal]**:
what this design adds.

## 1. The finale in one paragraph

The road from the Heights comes down into **the Holy City** by the Processional Way, and the bells ring for the pilgrim
who carries five. Severin cannot come in by the door: he is a heretic of the Ashen Watch. He goes down into the old works
under the city to come up through the channels. On the Hall's steps **the Primate** meets the pilgrim and leads them in
for the Great Rite of the Five. He tells them the truth plainly, and they do not believe it: "We are not waking him. We
have been holding him shut." In the nave the floor opens, and the Primate sends the pilgrim down alone. In **the
Confluence** the channels of the five lands run into one — red from the March, dust from the Vale, black water from the
Fens, white from the Heights, thorn-grown from the coast — and Severin is waiting there, his lantern burning white. In
**the Holiest** Astra's body lies on its bier. As the pilgrim comes near, the five instruments leave their pack and go to
him: the crown onto his head, the scourge's welts open, the scale rises, the nails fix him, the lance goes into his chest.
He opens his eyes. "Leave this place." They fight. "You do not know what you are asking." At the last: "Good." "At least
this time..." "I can die." He dies, and the Night comes out of him. Severin's lantern goes out, and he understands: "He
was holding it. All this time he was holding it." The way up goes black. The five instruments lie before the pilgrim. The
pilgrim takes up the Five. Lumi gives back what she caught and goes up to see the morning. Outside, the sun rises. In
Firstlight the shutters open, a child sees his first true morning, and far off a bell rings. In the Holiest the pilgrim
sits in the dark with the lance in their chest, and the dark behind them moves.

> **只要仍有人承担五苦，黎明便不会熄灭。**
> *As long as someone bears the Five, the dawn will not go out.*

## 2. Principles

- **The second reversal is shown, not told** (lore.md §10): the Primate says it and is not believed; Astra's words and
  death prove it; the Night pouring out is the proof the player cannot argue with. Severin says one sentence about it.
- **The choice is an act** (game-design.md §2): after Astra falls the way up is black and only one thing in the Holiest
  answers the hands, the five instruments on the bier: *Take up the Five*. Only this ending is made (lore.md §16).
- **The ending is quiet** (lore.md §17): the village at dawn, then the Holiest with no music, the sentence, black.
- **The save after the end keeps the ending**: the pilgrim is in the Holiest and cannot leave (its door is the Night's).

## 3. What the finale shows of the world

| Lore | How the finale shows it |
|---|---|
| The structures carrying power to the Holy City (§9) | the Confluence: the five lands' channels meeting under the Hall |
| Astra is the cage, not the Night (§10) | the Primate's words; Astra's; the Night out of his body when he dies |
| There must always be someone (§11) | the Primate's doctrine; the instruments before the pilgrim |
| The pilgrimage chooses the next (§13) | the Primate: "The road has chosen." |
| The final trial (§15) | the fight, Astra's three lines |
| The preview ending and closing shot (§16, §17) | the inheritance; Firstlight at dawn; the Holiest in the dark; the sentence |
| "stop him" (Nessa's almanac, Chapter 1) | on the bier's foot, the rest of the line: *He said it could be given a vessel, and that it would be him. We could not stop him.* |

## 4. The final boss: Astra, the First Martyr (初殉者·阿斯特拉)

| | |
|---|---|
| Lore | §3, §10, §14–§16. |
| Look [proposal] | A gaunt man in a grey shroud, bound to his bier by the instruments as they return: the crown of thorns on a head of long white hair, the welts open across his back, the scale hanging from his neck, the nails through hands and feet, the lance through his chest; darkness leaking from the wounds like smoke that falls. |
| His three lines | Phase I: "离开这里。" / "Leave this place." Phase II: "你不知道自己正在请求什么。" / "You do not know what you are asking." At the end: "很好。" "至少这一次……" "我可以死了。" / "Good." "At least this time..." "I can die." |

### His fight [proposal]

**The Holiest**: a round crypt, the bier at its heart, five niches round the wall (one for each instrument). Three
phases, each a suffering more:

| Phase | Skills |
|---|---|
| I (bound; "Leave this place.") | 荆冠 / The Crown (a ring of thorns round him; the struck kneel); 鞭痕 / The Welts (a cross of lashes) |
| II (at two thirds; "You do not know what you are asking.") | 秤压 / The Weight (a pan comes down on the foe); 圣钉 / The Nails (nails fall in spots) |
| III (at one third, risen) | 圣枪 / The Lance (a line through the crypt); 原夜 / The First Night (spots of dark that linger and burn) |

Campaign body (`ASTRA_CAMPAIGN`): 1400 health, armour 4, attack 24, for a player of about level 20; the Boss Studio's
2600 / 4 / 34. Art: the project's own (`tools/src/art/astra.py`); six effects.

## 5. People

| Person | Where | Who |
|---|---|---|
| **Primate Aurelian** (首席司祭奥勒良) | the Most Holy Hall | 81; head of the Church of the Five Sufferings; keeps the deepest doctrine (lore §11): there must always be an Astra. Not cruel; old; tired; tells the pilgrim the truth and is not believed. |
| Severin | the Confluence, the Holiest | §6 |
| Lumi | — | §7 |
| the Holy City's people | the Processional Way | pilgrims, a choir, the Hall's wardens |

## 6. Severin's end

He goes down by the old works and meets the pilgrim in the Confluence: "Now we end it." In the Holiest he sees Astra
open his eyes and does not move. When Astra dies and the dark pours out, the lantern goes out in his hand. "He was holding
it. All this time he was holding it." Then: "Every seal I kept from him made the cage weaker. Ask your Church why, I said."
When the pilgrim takes up the Five, he sits down by the Holiest's door. His last line, to no one: "The Watch kept the flame
of the first dawn. Someone has to keep this one." **[proposal]**

## 7. Lumi's end

When the five instruments go into the pilgrim, the five powers she caught go with them, out of her. Her last lines:
"Oh. I remember this." ... "It was dark like this. I'm sorry it's you." ... "I'll go up and look at the morning for you."
She goes up the black stair as a small light. In Firstlight at dawn, a small light rests on a windowsill. **[proposal]**

## 8. The finale, beat by beat

| # | Where | Beat | Goal |
|---|---|---|---|
| 0 | Whiteveil Abbey | Chapter 5's end opens the road down (`world.fin`); *The Great Rite* begins | — |
| 1 | the Processional Way | First arrival: the card "The road went down out of the white hills into the Holy City. The bells were ringing." The crowd, the statues of the five bearers; Severin turns off into the old works | reach the Hall |
| 2 | the Most Holy Hall | *The Primate*: the truth, not believed; the floor opens | go down |
| 3 | the Confluence | the five channels; Night-born creatures leaking up; Severin: "Now we end it." | reach the Holiest |
| 4 | the Holiest | *The Rite*: the instruments go to Astra; he opens his eyes | — |
| 5 | the Holiest | **Astra, the First Martyr** | Astra down |
| 6 | the Holiest | *The Night*: "Good." "At least this time..." "I can die." The dark pours out; the lantern goes out; Severin's lines; the way up goes black | — |
| 7 | the Holiest | the pilgrim takes up the Five (an act on the instruments on the bier) | the Five taken up |
| 8 | — | *Dawn*: the instruments go into the pilgrim one by one; Lumi; outside the sun rises (`night.shift` 0); Firstlight at dawn (a picture); the Holiest in the dark (the pilgrim seated, no music); the sentence; black | — |

## 9. Quests

**Main**: *The Great Rite* (`great_rite`: the Holy City, the Primate, the Confluence, the Holiest, **Astra**, the Five taken
up). It ends the main line.

## 10. Maps

A chain on the Holy City's cells south of the Hall (region **the Holy City**, warm gold): the Processional Way at the
continent's road cell south of the Hall, and the hand-made Most Holy Hall on the Hall's own cell (31,23), standing for
the continent's sealed `holy.hall` (`replaces`). The Confluence and the Holiest are below it (interiors).

| Map | Size | What is there |
|---|---|---|
| **The Processional Way** (圣道, `processional`) | 36×48, peaceful | a grand avenue climbing north between the statues of the five bearers; crowds; the Hall's front at the head |
| **The Most Holy Hall** (至圣大殿, `holyhall`) | 34×46, peaceful | the nave; the Primate; the floor that opens; a waypoint statue |
| **The Confluence** (五渠汇, `confluence`) | 40×34, interior, combat | five channels meeting; Night-born; Severin |
| **The Holiest** (至圣所, `holiest`) | 30×30, arena | the bier; five niches; Astra |

## 11. After the end

The save after the closing card holds the end: the pilgrim in the Holiest, its door shut by the dark (`fin.end`), the
night shift 0 above. The title page keeps it as the last save; a new game starts again from the beginning.

## 12. As built (2026-11-01)

**Where**: content `finale.ts` (the facts `FIN`, Astra's id and campaign numbers, `THE_FIVE`; the bier, the five niches,
the channels of the four other lands as kinds of the March's red channel, the bearers' statues, the Night on the floor;
`FIN_RULES`: a hand on the bier once the Night is out takes up the Five, the Night burns and fades), `bosses.ts` (Astra's
kit and fight: three phases, a suffering more each; the phases' lines his own), `bossrooms.ts`, `quests/main.ts`
(`great_rite`), `rules.ts` (`SITE_GATES` for `fin.way`; `companion/boon` answers `farewell`: the fairy follows no one).
The demo: `tools/src/demo/quest/finale.ts` (the close and the nave on the showcase's great church and its plan `NAVE`,
the Confluence, the Holiest, the scenes `FINALE_STORY`), `quest/chapter5.ts` (Whiteveil's road east), `people/primate.ts`,
`people/wardens.ts`, Nessa on the parvis, Severin's last days, `world.ts`, `overworld.ts`. Art: `tools/src/art/astra.py`,
`tools/src/art/finale.py`; the ending's two pictures `tools/src/art/cg/ending.py` → `public/assets/lsw/CG/`.

**The instruments stay the pilgrim's** through the last fight: what goes to Astra in the Rite is "something of each"
(the narration), so no piece of the pilgrim's gear is taken before the hardest fight; at the bier they are in the
pilgrim's hands without being taken out of the pack.

**Facts and steps**: `world.fin` (Chapter 5's `bells_at_four`), `fin.road` (`holy_arrival`: the card; Severin goes in
under), `nessa_city`, `fin.primate` (`primate`: the floor opens; the nave's stair waits for it), `fin.confluence`
(`confluence`), `fin.rite` and `fin.way` 1 (`rite`), `sins.defeated.astra`, `fin.night` and `fin.way` 0 (`the_night`:
the way up is the Night's), `fin.five` (the bier), `fin.end` (`dawn`: the inheritance, Lumi's farewell, Severin's last
line, `night.shift` 0, the two pictures, the card).

**Maps**: `holyhall` (50×84, the Hall's own cell (31,23), in from Whiteveil's east side; the church's west front, the
parvis, the avenue of the bearers), `holyhall.nave`, `confluence` (40×30; `wp.confluence`), `holiest` (30×30, behind the
fog; its way out waits for `fin.way`).
