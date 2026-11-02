# Chapter 3: The Third Seal (第三印 · 饥刑之秤)

Status: **built 2026-11-01** (the user's request, 2026-11-01: "按照我们的剧情主线去完成整个游戏"). Playable from Chapter 2's quiet dusk to
the chapter's card; proved offline by `tools/test/demo.test.ts` CH3 (the whole chapter and its errands), the reach by
`tools/test/release.test.ts`. §13 lists what was built and where. It follows
[lore.md](lore.md) (§4 the third suffering, §6 and §12 the Third Seal-bearer, §9 the first reversal, the agreed additions)
and keeps Chapter 1's principles ([chapter-1.md](chapter-1.md) §2) and [writing.md](writing.md). The whole of the main line
after Chapter 2 is in four documents: this one, [chapter-4.md](chapter-4.md), [chapter-5.md](chapter-5.md) and
[finale.md](finale.md); §2 of this one holds what all four share. Marked **[proposal]**: what this design adds beyond
lore.md, open to change.

## 1. The chapter in one paragraph

Beyond the March the grain road runs south and east, eight days, into **the Vale of Scales**, once the granary of the Five
Lands. The days are short now and the wheat does not ripen; the Vale is hungry. In the market town of **Fairweight**
everything is weighed: the tithe, the grain, the poor. On weighing day the hungry climb the weigh-house steps and stand
in the pan of the town's great scale, and the Weighmaster sets the Church's black weight in the other pan. Those found
heavier go home hungry. Those found lighter are **Lightened**: from that day they feel no hunger and need no sleep. The
Lightened work the dead fields day and night, smiling, and grow lighter, until one morning they walk out onto the salt
pans and stand there, facing the Black Balance, until the wind takes them. The dust that blows over the Vale is what is
left of them. In **the Black Balance**, **Ele**, the Priest of the Black Scales, who has not eaten in three hundred years
and whose flesh was found "lighter than sin", weighs the whole Vale: so much grain, so much hunger, and it must balance.
Ele is not cruel. Ele carries the Vale's hunger as part of Astra's burden, and gives the poor the only release the scale
allows: the need taken out of them. In Ele's ledger every column, five of them, is carried to one account. Severin is in
the counting room before the pilgrim. Ele falls and the scale tips: the Lightened are hungry again, all at once. The
Grain Guild's granary is sealed for the Church's carts; the pilgrim opens it, by key or by axe. The sun sets at six.

## 2. The main line after Chapter 2 (all four documents)

### 2.1 One step of the vessel in each land [proposal]

The five sufferings make a person able to hold the First Night (lore.md §3–§4), one step each. Each Seal-bearer, bent
by centuries of bearing one step, has done to their land what their suffering does to a body, and calls it mercy:

| Seal | Suffering's real work (lore §4) | What its bearer does to the land |
|---|---|---|
| 1, the Crown (Alberic) | the self's borders worn thin | his knights forgot themselves; all he remembers is to hold (Chapter 1) |
| 2, the Scourge (Matthias) | the flesh made to bear endless pain | he took his soldiers' pain; with nothing to stop them they fight forever (Chapter 2) |
| 3, the Scales (Ele) | no need of food, sleep, a body's wants | Ele takes the poor's need; the Lightened feel no hunger and waste to dust (this chapter) |
| 4, the Nails (Nacht) | fixed to the world while the soul is eaten | he nails the Fens' dead to the world; none may die or go (Chapter 4) |
| 5, the Lance (the Witnesses) | made the gate the Night pours into | the failed pilgrims under the altar, one open wound, crying "How long?" (Chapter 5) |

Nobody says this pattern; the player can find it. It also says what the player is becoming: each relic and each of
Lumi's boons is one step of it, worn (lore.md §13).

### 2.2 The two reversals, chapter by chapter

| Chapter | What the player is shown | What they believe after it |
|---|---|---|
| 2 | the red channels under the Scourging House run west (lore §9: structures carrying power to the Holy City) | the Church takes something from the seals |
| 3 | Ele's ledger: five columns, every total carried to one account, the Hall's, and the Hall has drawn more each year since the nights began to lengthen (§9: the five bearers' burdens flow to one place) | something in the Holy City is eating |
| 4 | Nessa's proof: the nights lengthened on the very days the Church's chronicle records signs of life in the Holy Body; the black Shroud that carried the body (§9: the darkness inside the body; the nights and the signs of life coincide) | **Astra is the First Night, waking** (the first reversal, §9): the player takes Severin's side and they hunt him together (agreed additions) |
| 5 | the roll of the white-robed: every pilgrim of four hundred years who died on the road; the pilgrimage chooses whoever can bear the five (§13); the second vessel's niche | the Church is making Astra a new body, and it is the pilgrim |
| Finale | Astra asks them to leave, then tests them, and dies glad; the Night pours out of him (§10, §11, §15, §16) | he was the cage; someone must be the cage; the pilgrim takes it up |

### 2.3 Threads through the four

- **Severin** (agreed additions): ahead of the pilgrim in the Vale (the ledger); collapsing under what he carries in the
  Fens, where the pilgrim comes to his belief and they go on together; with them through the Heights and into the Holy
  City; in the Holiest he learns he was wrong, and that every seal he kept from the Hall made the cage weaker. He stays as
  the new vessel's keeper: the Ashen Watch kept the flame of the first dawn; he keeps this one.
- **Lumi** (agreed additions, chapter-1.md §3b): one edge of the truth in each chapter, never stated by her: in the Vale
  the scale does not move when she stands in it; in the Fens the dead know her; under the altar she reads her own
  niche and thinks it a nice name. At the end she gives back what she caught and goes up to see the morning.
- **Nessa Quill** (Chapter 1): her almanac of sunsets. Met again on the Chaff Road; in the Fens she brings the proof.
  The old almanac's last page, which begs someone to "stop him", is read wrong all game (he is Astra the monster) and
  right in the Holiest (someone begging Astra not to take the Night into himself).
- **Cassian** (Chapter 1's previous pilgrim, "he reached the Holy City"): his niche in the catacombs is empty: *not yet
  brought*.
- **The nights** (agreed additions): `night.shift` 3 after Ele (dusk 18:00), 4 after Nacht (17:00), 5 after the Witnesses
  (16:00), 6 in the Holy City (15:00); at the end the sun rises whole (`night.shift` 0).

### 2.4 Opening the road

Each chapter's end opens the next (a fact the next chapter's portals and sites wait for, content `regions.ts`): `world.ch3`
(Chapter 2's quiet dusk), `world.ch4` (this chapter's end), `world.ch5`, `world.fin`. The chapters' maps lie on the
continent in their regions, each chain on cells of the continent's own roads (`asIs`, as the March's do), its first map's
cell fixed (`overworld.ts` `PLACES[...].cell`); the long road between two chapters is one portal from the last hub to the
next chapter's first map, crossed once with a card ("The grain road ran south and east for eight days."). Waypoint
statues in each chapter carry the pilgrim back. The edges onto the world map still wait for `world.part2`.

## 3. What Chapter 3 shows of the world

| Lore | How Chapter 3 shows it |
|---|---|
| The third suffering, hunger (§4): the Church's "release from the flesh's desires"; its real work, to cut the bearer's need of food, sleep and a body's wants | the weighing and the Lightened, who need nothing (the real work, misread as grace); the Chapel of the Measure's litany "the flesh at last was lighter than sin" (the Church's reading) |
| "His flesh at last was lighter than sin" | the Church's black weight in the weigh-house, the Weight of Sin; Ele, who has not eaten for three hundred years |
| The Seal-bearers suffer and are twisted (§6, §12) | Ele carries the Vale's hunger and, weighing it, gives the poor release by taking their need |
| The five burdens flow to one place (§9) | Ele's ledger, five columns, all carried to the Hall's account; more drawn every year the nights have lengthened |
| Crops wither as the Night returns (§2) | the Vale's dead wheat; still windmills; the mill grinding salt |
| The world's cruel rule (§11) | Ele's last words: hunger is never made less, only weighed out (heard as cynicism; true of the Night) |

## 4. The boss: Ele, the Priest of the Black Scales, Third Seal-bearer (黑衡司铎·厄勒)

| | |
|---|---|
| Lore | The Third Seal (the black rider of Revelation: "a pair of balances in his hand ... A measure of wheat for a penny, and three measures of barley for a penny"), bearer of the Scale of Hunger's share (lore.md §6, §12). |
| What hunger did | The third suffering cuts the need of food and sleep (§4). Ele has neither eaten nor slept in three hundred years and can no longer remember what need is like. When the nights began to lengthen and the Vale's wheat failed, Ele saw the famine as a weight: so much grain, so many mouths. It could not be made smaller. It could be moved. Ele began to take the need out of those the scale found lightest **[proposal]**. |
| Look | From the collaborator's portrait (`wiki/images/seal3-priest-of-the-black-scales-ele.webp`): a tall, gaunt figure in black and gold vestments embroidered with wheat, a mitre with a halo behind it, a great staff that is the beam of a balance, one pan heaped with grain, the other dripping black cloth; a ledger at the belt; coins underfoot. |
| In Chapter 3 | Seen first through others: the Weighmaster serves Ele's measure; Sister Berthe calls the scale a grave with a lid; the Guildmistress says the Black Balance weighs the tithe fairly; the Lightened smile and say they are light. |
| Their end | Struck down, Ele is hungry for the first time in three hundred years and does not know the feeling: "What is this? ... Oh. This is what they asked me to take." Ele tips the pans empty and holds out the scale. Last words: "Hunger is not made less. It is only weighed out. Remember that, pilgrim, when it is weighed out to you." |

### Their fight [proposal]

On the kits module (docs/skills.md), on **the Scale Floor** behind the Black Balance's fog (docs/boss-rooms.md). Two phases:

| Skill | Shape | Effect |
|---|---|---|
| 衡量 / The Weighing | a line toward the foe, 10 | the beam swings down; the struck are made heavy (slowed) |
| 秤盘坠落 / The Pan Falls | a circle on the foe, radius 2 | the great pan comes down; a heavy blow |
| 谷雨 / Grain Rain | spots round the foe | grain pours from the hanging pans |
| 饥馑 / Famine | a ring round Ele, 4 | the struck go hungry (their food falls) |
| 轻于罪 / Lighter Than Sin (phase II's opening) | a ring round Ele, 5 | at half health Ele rises off the floor, weightless; a push |

Campaign body (content `ELE_CAMPAIGN`): 760 health, armour 2, attack 16, for a player of about level 12; the Boss Studio's
1600 / 3 / 28. Art: the old Pride strips redrawn in Ele's colours, black and gold, a mitre and halo, the balance staff
(`tools/src/art/ele.py`); five effects.

## 5. Severin in Chapter 3

| Seen | The Vale's reading | True |
|---|---|---|
| A grey man in the Black Balance's counting room, reading the ledger | a thief among the tithe | he is reading where the seals' weight goes |
| "Every column is carried to the same account. Something there is eating." | heresy | the first reversal's reading of lore §9 (true structure, wrong cause) |
| He takes the third seal's loose power into the lantern | a heretic feeding on a holy seal | the flame nearly goes out; he coughs ash; three is more than he can carry |
| "When you have the Nails, come to the Fens. I will show you what you are carrying them to." | — | he means to show the pilgrim the Shroud (Chapter 4) |

## 6. The chapter, beat by beat

| # | Where | Beat | Goal (a state) | Clue planted |
|---|---|---|---|---|
| 0 | the Red Host's camp | Chapter 2's end opens the grain road (`world.ch3`); Brannoc: the Vale stopped sending grain three seasons ago; *The Grain Road* begins | — | — |
| 1 | the Chaff Road | First arrival: the card "The grain road ran south and east for eight days. The fields along it were empty." A Lightened man works a dead field at noon by lantern light, smiling | reach Fairweight | the lantern at noon |
| 2 | the Chaff Road | Nessa Quill at the waystone, measuring the sunset over the flat horizon: the sun set at seven tonight; she is going on south to the Fens, where the dusk does not lift | (beat) | her table |
| 3 | Fairweight | *Weighing Day*: the Weighmaster weighs a widow against the Church's black weight; her pan rises; the crowd says "light"; she smiles | see the weighing | the Weight of Sin; the Register |
| 4 | Fairweight, the poorhouse | Sister Berthe will not let her children be weighed: "Hunger is how the body asks to live." Elsie and her jar of dust | speak with Berthe | the jar |
| 5 | the White Pans | The Standing: the Lightened in rows on the salt, facing the Black Balance; one, as the pilgrim comes near, goes to dust in the wind. Lumi stands in a weighing pan by the old salt-works; it does not move | reach the Black Balance's gate | the dust |
| 6 | the Black Balance | The Hollow Clerks still at their desks; the counting room: Severin and Ele's ledger | (scene) | the ledger's five columns (lore §9) |
| 7 | the Scale Floor | **Ele, the Priest of the Black Scales** | Ele down | — |
| 8 | the Scale Floor | *The Scale*: Ele's hunger and last words; the Scale of Hunger given; Lumi catches part of the seal; Severin the rest: "Three." He coughs ash. "Come to the Fens." | the Scale carried | Ele's last words (§11) |
| 9 | Fairweight | *Hunger*: the Lightened are hungry again, all at once, and the guild's granary is sealed for the Church's carts | the granary open (its key from the Guildmistress, or its door broken) | — |
| 10 | Fairweight | *The Supper*: Berthe feeds the town from the granary; Corwin tastes bread and says his wife's name; the sun sets at six. The card: **Chapter 3 · The Third Seal — end** | — | the earlier sunset |

## 7. People

| Person | Where | Who |
|---|---|---|
| **Weighmaster Haskel** (称量官哈斯克尔) | Fairweight, the weigh-house | 56; keeps the great scale and the Church's black weight; exact, gentle, sure he is merciful: "No one in Fairweight starves. The scale sees to that." **Unsaid**: he weighed his own son, who was found light, and walked onto the salt two winters ago. |
| **Sister Berthe** (贝尔特修女) | Fairweight, the poorhouse | 45; feeds the hungry from nothing; has given away her own bread for months and is thin as a rake; will not let her children near the scale. |
| **Elsie** (艾尔西) | the poorhouse | 9; her mother was Lightened and walked onto the salt last spring; she keeps a jar of salt and dust "so Mama is somewhere". |
| **Corwin** (科温) | the fields by Fairweight | 63; Lightened; works the dead fields all night by lantern; cheerful, light as straw; cannot remember the taste of bread or his wife's name. |
| **Guildmistress Ottilie** (奥蒂莉会长) | Fairweight, the guild hall | 50; heads the Grain Guild; its granary is full and sealed for the Holy City's tithe-carts; frightened, exact: "It is weighed and owed. It is not ours to give." Holds the granary's key. |
| **Godwin** (戈德温), the miller | Fairweight, the mill | 41; his mill grinds salt now; gruff, ashamed. |
| Nessa Quill (Chapter 1) | the Chaff Road | measuring the sunset; going on to the Fens |
| Severin | the counting room, the Scale Floor | §5 |

## 8. Lumi's third boon

**Lightness of the Fast (斋戒之轻)**: movement +15% for her leader (`lead:moveHaste` 0.15) — the third suffering makes the
flesh light (lore.md §4). Given by the `scale` scene's `tell` (`unlock: 'fast'`).

## 9. The Scale of Hunger (饥刑之秤)

The third of the five instruments: a small balance of black iron on a cord, its pans no wider than a palm, one of them
worn through; worn at the neck, **Stigmatic**. Its power, ***Lighter Than Sin* (轻于罪)** **[proposal]**: the hungrier its
wearer, the quicker they move and strike, up to +30% on an empty belly (the needs module's hunger, read by the classes
module's haste). No price but the one the body already asks: one who stays hungry does not heal. Defence +1 at the base,
attack +2 at the Stigmatic level.

## 10. Quests

**Main**:

| Quest | From | Goals | Done |
|---|---|---|---|
| *The Grain Road* (`grain_road`) | Chapter 2 done (`world.ch3`) | the Vale, Fairweight, the weighing seen | the weighing seen |
| *The Third Seal* (`third_seal`) | the weighing seen | Berthe, the White Pans, the Black Balance, the counting room, **Ele** | Ele down |
| *The Granary* (`granary`) | the Scale carried | the granary open, the supper | the chapter's card |

**Side** (`errand()`):

| Quest | Giver | Asks | Reward |
|---|---|---|---|
| *Bread for the Poorhouse* (济贫院的面包) | Berthe | 4 bread | the Almoner's Shawl (Fine) |
| *Where Mama Is* (妈妈在哪儿) | Elsie | a jar of salt from where the Standing stand | a Child's Ribbon (Vowbound) |
| *Corwin's Wife* (科温的妻子) | Corwin | her name, from the weigh-house's Register (ask the Weighmaster) | Corwin's Lantern (Fine) |
| *One More Grinding* (再磨一回) | Godwin | 6 wheat | the Miller's Apron (Fine) and flour |

## 11. Maps

The Vale's maps are a chain on the continent's road west of Weighmarket, in the region **the Vale of Scales** (`tithe`:
the world filter's straw grade): cells (45,24), (46,24), (47,24), (48,24). The continent's sealed seat of the Vale far to
the south (`tithe.the-black-balance`) is drawn as the wild: the hand-made Black Balance stands for it (`replaces`).

| Map | Size | What is there |
|---|---|---|
| **The Chaff Road** (糠路, `chaffroad`) | 56×30, wild | the grain road from the March (west); dead stubble and dust; three windmills standing still; a wayside scale at the crossroads; the Lightened at work; Nessa's waystone; a waypoint statue; famished wolves, crows (bats), dust wraiths |
| **Fairweight** (公秤镇, `fairweight`) | 48×36, town, peaceful | the square and its great scale before the weigh-house (`fairweight.weighhouse`: the black weight, the Register); the guild hall (`fairweight.guild`), the granary (`fairweight.granary`, locked); the poorhouse (`fairweight.poorhouse`); the mill; the Chapel of the Measure; houses |
| **The White Pans** (白盐滩, `saltpans`) | 50×30, wild | salt flats; the Standing in rows facing south-east; dust devils; the old salt-works and their pans; salt-crusted carts |
| **The Black Balance** (黑衡殿, `blackbalance`) | 44×32, combat | Ele's seat on a mound of grain gone to dust; the basilica's court; the Hollow Clerks; the counting room (`blackbalance.counting`: the ledger); a waypoint statue; the fog into the Scale Floor |
| **The Scale Floor** (衡台, `scalefloor`) | 30×30, arena | a black floor under the great balance's two hanging pans; grain falling; Ele |

## 12. Decisions and open questions

Open: every [proposal] above; Ele's body is the Pride strips redrawn until the user delivers Ele's own.

## 13. As built (2026-11-01)

**Where**: content `chapter3.ts` (the facts `CH3`, Ele's id and campaign numbers, the Vale's fixtures: the wayside scale,
the great scale, the Weight of Sin, the hanging pans, the ledger, the salt pans, the dead wheat, the dust heaps, the
Standing in three shapes, the granary's barred doors; `CH3_RULES`: the Guild's key unbars the doors, broken they are gone,
either way the story keeps `ch3.granary`; one of the Standing told `crumble` goes to dust), `items.ts` (the Scale of
Hunger, the blue scarf, the Guild's key; the relic power's words `RELICS.scales`), `bosses.ts` (Ele's kit, fight and
rules), `afflictions.ts` (the famine's `famished`, `body/famine`), `bossrooms.ts`, `boons.ts` (`fast`), `quests/main.ts`
(`grain_road`, `third_seal`, `granary`), `quests/side.ts` (`poorbread`, `scarf`, `wifename`, `grinding`), `regions.ts`
(`CHAPTER_THREE` … `FINALE`), `rules.ts` (`SITE_GATES` for each later road), `migratePartTwo.ts` (a chapter's end opens
the next road in an older save), `ontology.ts` (the terrain `salt`, its character `v`); the classes module's `combat.ts`
(the relic `scales`: haste by hunger). The demo: `tools/src/demo/quest/chapter3.ts` (the maps, the halls, the scenes
`CHAPTER3_STORY`), `quest/chapter2.ts` (the camp's south gate; the quiet dusk sets `world.ch3`; its card names the grain
road), `people/*.ts` (seven new people; Nessa on the Chaff Road; Brannoc's word on the grain road), `world.ts`,
`overworld.ts` (`PLACES[...].cell`: a chain laid from a fixed cell). The runtime draws salt as the snow's sheet, warmed.
Art: `tools/src/art/ele.py` (over Alberic's strips), `tools/src/art/chapter3.py` (icons and fixtures), the shared
`tools/src/art/stripkit.py`.

**Names**: three people were renamed from the design to keep clear of people already in the game: the poorhouse's
Sister Berthe (was Maud), Elsie (was Tamsin), Godwin the miller (was Bram).

**Facts and steps**: `world.ch3` (Chapter 2's `quiet_dusk`), `ch3.road` (`vale_arrival`: the travel card), `nessa_vale`,
`ch3.weighing` (`weighing`), `ch3.maud` (`third_seal` stage 20, Berthe spoken to), `lumi_pan` (a beat), `ch3.pans`
(`standing`), `ch3.balance` (`balance_court`), `ch3.ledger` (`ledger`), `sins.defeated.ele`, `ch3.scale` (`scale`: the
Scale, the boon, Severin, `night.shift` 3), `ch3.hunger` (`hunger`), `ch3.granary` (the doors), `ch3.end` and `world.ch4`
(`supper`, 17:00–23:00 in Fairweight), then `chapter3_end` (the card).

**Maps**: `chaffroad` (56×30, cell (45,24), in from the camp's south gate; the mills' rise; `wp.chaffroad`),
`fairweight` (48×36; the square and its great scale, the street, the lane; `fairweight.weighhouse`, `.guild`, `.granary`,
`.poorhouse`, `.chapel`, `.miller`, the hovels' rooms), `saltpans` (50×30, salt crust; the Standing; Elsie's mother),
`blackbalance` (44×32, the mound; the court of dead clerks; `blackbalance.counting`; `wp.blackbalance`; the basilica's
doors the fog), `scalefloor` (30×30, behind the fog).
