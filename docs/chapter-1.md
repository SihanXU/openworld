# Chapter 1: The First Seal (第一印 · 荆棘冠)

Status: **built** (2026-10-05, [lore.md](lore.md) and its agreed additions). Playable from the barrow
quest to the chapter's card; proved offline by `tools/test/demo.test.ts` C1 (the whole chapter), C2 (the
errands) and C3 (the longer nights). §11 lists what was built and where.

Marked **[proposal]**: what this design adds beyond lore.md and the user's decisions, open to change.

## 1. The chapter in one paragraph

The days are getting shorter. You come down from the mountain with a fairy at your side to
**Firstlight**, a village named for the first dawn after the First Night — the morning Astra's
fifth suffering ended. Its chapel keeps a flame the village believes was lit from that dawn's first
ray. The footbridge east is gone: a white rider in a crown of thorns tore it out board by board in
the rain. While you bring the restless dead's prisoners home from the barrow, a grey man is seen
at the edges of everything. On the night of the rescue he walks into the chapel, lifts the
Firstlight into a lantern and leaves east, across the river on ice he makes as he walks. Then the
Church's letter comes: the five Seal-bearers are failing, the Long Night is returning, and a
pilgrim guided by a fairy is called to the pilgrimage. You mend the bridge and find the White
Knight on the far road, holding the ford as his kingdom, kneeling to no one. You bring him down
and take the Crown. His seal's power breaks loose; Lumi catches part of it, and the grey man
steps out of the smoke and draws the rest into the stolen flame: "Every seal you break makes the
night longer. Ask your Church why." That evening the sun sets four minutes earlier.

## 2. Principles it keeps

- **The goal of each step is a state** (game-design.md §2): the bridge passable, the knight down,
  the Crown carried. Every way across still counts; the grey man's ice crossing *shows* the ice
  route before it is needed.
- **The place teaches, not text.** Clues are things: the shrine stone's cracked first wound, the
  thorns in the bridge's stumps, the marked loaf in the barrow, chalk drawings on walls, Nessa's
  table of sunsets.
- **First layer only** (lore.md §8). Chapter 1 never questions the official history: Astra saved
  the world, the pilgrimage repeats his miracle. Every later reveal is something Chapter 1 shows
  and people misread. The chapter never lies.
- **The night lengthens as the player succeeds** (lore.md §12): defeating the knight removes a
  support; the first sign is shown, not told (the earlier sunset).
- **Designed for the AI even with no model** (CLAUDE.md): the clue things are ordinary things whose
  deeper uses are undefined leaves (the warm ember, the marked loaf, the thorns, the Crown itself).

## 3. What Chapter 1 shows of the world

| Lore (lore.md) | How Chapter 1 shows it |
|---|---|
| The days shortening (§2, §7) | People speak of earlier dusks; Nessa keeps a table of sunset times; the night-born are bolder; after the knight falls, the night really is longer (decided): its start moves earlier with each seal that falls, a story prop the calendar reads |
| The dead not resting (§2) | the barrow's dead keep the two foragers; the barrow warden is a man buried a century ago who will not lie down |
| The Five Sufferings and Astra (§1, §4, §5) | Firstlight's chapel: five carved wounds round Astra the First Martyr; Ilse's litany: "Suffering is not God's abandonment. It is the proof the debt is being paid." |
| The Seal-bearers failing (§6, §7) | the Church's letter; the shrine stone at the Mountain Foot has five carved wounds, and the first (the crown) is cracked and weeps black |
| The pilgrimage (§7) | the letter names a pilgrim; Ilse sends you, with the chapel's blessing |
| The selection (§13), unseen | Lumi carries each seal's power for you — and she is what is left of the last one who tried to bear the Five (§3b) |
| The bearers suffer and are twisted (§6, §12) | Alberic was a kind knight; Fennick served under him; the crown has eaten his self (the crown's real work, §4: the self's borders worn thin) |

## 3b. Lumi, the failed second vessel (decided 2026-10-05)

Lumi is not a guide the Church sent. She is what remains of the **second vessel**: long ago, someone
tried to take up the Five after Astra and could not bear them. The sufferings stripped her of her
power and her memory and left her small, a fairy, with no idea what she was. (When and why that
attempt was made is for later chapters.)

- **Why she catches the seals' power**: what is left of her still answers the seals; when a bearer
  falls, the loose power goes to her the way water finds an old riverbed. She thinks it is a gift.
- **Chapter 1 shows only edges**: she shivers at the shrine stone's cracked wound ("It's colder
  near it. I don't like it. I don't know why I don't like it."); she does not know how old she is;
  the Church's courier stares at her and says nothing; Severin looks at her a moment too long after
  the knight falls — he knows what a fairy that drinks seals once was.
- **Her lines stay light**: she is cheerful, curious, brave; the sadness is the player's to find
  later, never hers to state.

## 4. The boss: the White Knight Alberic, First Seal-bearer

| | |
|---|---|
| Lore | The First Seal (the white rider of Revelation), bearer of the Crown of Thorns' share of Astra's burden (lore.md §6, §12). |
| What the crown did | The crown's real work is to wear away the self's borders (§4). After centuries Alberic remembers only that he must *hold*: he took the far bank as his kingdom and tore down the bridge so that nothing crosses that does not kneel. He is not cruel; he no longer knows what he is holding back. |
| In Chapter 1 | Seen first through others: Hesper saw a white rider in the rain pull the planks out with his hands and lay the nails in a row on the pier "like coins on a counter, like a toll"; thorns are driven into every stump. On the East Road he waits on a white horse gone pale and thin, his helm grown through with thorns. |
| The fight | **Built** (2026-10-05): see *Alberic's kit* below. |
| His end | Struck down, he lifts the crown off his own head for the first time and holds it out: "Take it. It was never mine to hold." He dies as a man, not a monster. The Crown of Thorns is the player's (the first of the five instruments, carried to the Holy City). |

### Alberic's kit (built 2026-10-05)

From the user's reference art (a great helm grown through with a crown of thorns; a torn white tabard
with gold work and old blood; a longsword pointed at the ground; a bow and a quiver): the project's
own illustrated pixel art, generated with the built-in image tool. The v3 remake uses a high
overhead 2D view: helmet roof, shoulder tops and spread cape, foreshortened torso and legs.
128x128 frames shown at 1.25x; collision remains 3x2. There are 84 drawn frames: the following
seven four-frame actions in down, right and up directions (left mirrors right). See
`alberic-art.md` and `alberic-art-v3-prompts.json`. The old code-drawn and v2 portrait atlases
are retained but no longer loaded.

| Row | Frames |
|---|---|
| idle | standing, sword point down, bow at his side; the tabard stirs; a glint on the crown |
| walk | a heavy armoured step |
| attack | the sword raised, held high and burning, plunged into the ground, held there (*Thorns*) |
| arrow | bow raised, drawn, loosed, lowered; shoots along the map-facing direction |
| volley | a separate raised/skyward draw, release and recovery, viewed from above |
| hurt | recoil, buckle, brace and recover; retains the actual armour colours |
| death | **kneels, removes the crown, offers it, falls**; the crown rests beside his gauntlet |

| Skill | Shape | Wind-up / recovery | Damage, effect | Its effect art |
|---|---|---|---|---|
| 征服之矢 / Arrow of Conquest | a three-wide line ahead, 8 | 1.8 / 1.4 s | 30 | a white-gold arrow and broken feather trail, oriented along the locked shot |
| 白羽箭雨 / White-Feather Volley | five spots round the target, 4 | 2.0 / 1.4 s | 24 | white-feathered arrows fall, strike and stand in the dust |
| 荆冠·屈膝 / Thorns Bend the Knee | a ring round him, 4 (inside and outside are safe) | 2.2 / 1.4 s | 34; the struck are made to kneel (entranced, 0.8 s) | bronze/ivory briars erupt on the marked rim, crumble and sink; no central impact |

1200 health, armour 2; phase II at half health (the encounter system's: shorter wind-ups, harder
blows). Proved by `bosses.test.ts` (all four kits' skills, art) and `boss-balance.test.ts` (every
profession loses to him ignoring the warnings; a dodging warrior beats him). He is in the Boss
Studio and the Boss Challenge; his campaign place (the East Road, his kingdom of thorns) and his
balance for a Chapter 1 player come with the chapter.

## 5. The antagonist: Severin, the Greyvowed (灰誓者·塞弗林)

| | |
|---|---|
| Who | About 40. Grey travelling cloak, ash-dark hands, a hooded brass lantern. Once a brother of the **Ashen Watch** (灰烬守望), the Church order that kept the flames lit from the first dawn; the Church dissolved it twenty years ago and named its last brothers heretics. Raised as a foundling by Firstlight's chapel keeper. |
| What the village sees | A heretic who scraped the holy shrine stone, lured two foragers into the barrow, and stole the Firstlight. |
| What he believes (decided) | From the start, the first reversal (lore.md §9): **Astra is the monster** — the First Night itself, sealed, waking as the seals weaken — and the Church, feeding the seals' power to the Holy City, is waking him. So the pilgrimage, which carries the five instruments and the seals' power back to Astra's body for the Great Rite, would raise him. |
| What he does | He works against the pilgrim from the first day. He takes the Firstlight, a flame of the first dawn, to hold what each fallen seal leaves, so that it never reaches the Holy City **[proposal: how he uses the flame]**. He gets there first, takes what he can, and tells the pilgrim the truth as he sees it. |
| His rule | Never harms anyone, never explains more than a sentence. Every act of his also protects someone. The player never fights him (decided). |
| His arc (decided) | Ch1 onward: the antagonist, against the pilgrimage. Mid-game: the player comes to his belief, and they hunt Astra together. During that hunt they find the second reversal (lore.md §10): Astra is not the Night but its cage — and Severin was wrong about what he was fighting. |

**His acts in Chapter 1, as seen and as true:**

| Seen | Village's reading | True |
|---|---|---|
| Fresh ash on the shrine stone's cracked first wound | a heretic defiling a holy stone | he was reading how far the first seal had failed |
| "the grey man shut the inner door on us" (Lina, Oskar) | he trapped them | he shut the restless warden *in*, and left them a loaf marked with the Watch's sign |
| Pell's warm stone | a stranger's cursed trinket | an ember of a dawn flame: the night-born keep off Pell's window |
| He takes the Firstlight, walks east on ice | theft of a relic; sorcery | he needs the dawn flame to hold what the seals leave, and takes it before the pilgrimage begins |
| He draws the knight's loose power into the lantern | a heretic feeding on a holy seal | he keeps it from reaching the Holy City (where, he believes, it would wake Astra); the flame gutters and he flinches |
| "Every seal you break makes the night longer. Ask your Church why." | heresy | true (lore.md §12) |

## 6. The chapter, beat by beat

Quest stages are the quests' own (docs/quests.md, 2026-10-09: `rescue`, `vigil`, `first_seal`, `crown_home`), answering the story's facts below.
New stages are marked **new**.

| # | Where | Beat | Goal (a state) | Clue planted |
|---|---|---|---|---|
| P | Mountain | The prologue, unchanged, except: the seal stone at the Mountain Foot is a wayside shrine of the Five Sufferings, five carved wounds, the first cracked and weeping black, fresh ash on it; Lumi: "It's colder near it." | reach the Ford | the cracked first wound; the ash |
| 0a | The Ford | Hesper's arrival scene: the bridge was *taken* by a white rider in a crown of thorns; the nails laid like a toll; "the evenings come sooner every week." She sends you to the village | enter Firstlight | thorns in the stumps (things; E reads them) |
| 0b | Firstlight | The chapel and its flame, Ilse's litany, Rowan's request (the barrow), new people about the square | take on *Lost in the Barrow* | Pell's chalk drawing of a grey man; Nessa's sunset table |
| 0c | The barrow | Lina and Oskar in the side cells; the restless warden behind a door shut from outside | the warden down; both found | the marked loaf; "the grey man shut the door" |
| 1 **new** | Firstlight, night | *The Night of the Flame*: the village gives thanks in the chapel; at 22:00 a scene — the grey man in the chapel, the flame into his lantern, Holt shouts, he walks east. The player can follow and watch him freeze the river and cross | (scene) | the ice crossing, shown; he looks back once at Ilse's window |
| 2 **new** | Firstlight | *The Letter*: at dawn a Church courier brings the Holy City's proclamation: the Seal-bearers fail, the Long Night returns, the pilgrimage is called, and one who has walked down from the mountain with a fairy is named to it. Ilse blesses you and names your road: the First Seal-bearer, beyond the ford | talk to Ilse | the letter (a document); the courier stares at Lumi and says nothing |
| 3 | Firstlight → Ford | *The Broken Bridge*: Joss and the three planks; the ferry, the dead tree and the ice still work | stand on the far bank | Joss: "nails pulled straight. No storm pulls nails." |
| 3b **new** | The Pilgrim's Road (§14) | Past the far bank the road east runs through the Church's Rest (the oath at the five wounds), five wayside shrines, the ruined Abbey of the Thorn north of it, and the Kneeling Field | the oath, the shrines, the writ and the seal, the field | the writ of relief never sent; the stones of those who would not kneel |
| 4 | East Road | Out of the Kneeling Field: the farmstead (crops dying in the short days; night things came). Edda in the barn. Beyond it, a ring of thorns round a field of kneeling stones: the knight's kingdom | — | Edda: "the night things came; the grey one pulled me out" |
| 5 | East Road | **The White Knight Alberic** | the knight down | the kneeling stones are those who came before and would not kneel to him, carved on their knees all the same **[proposal]** |
| 6 **new** | East Road | *The Crown*: he offers the Crown and dies; its power breaks loose; Lumi catches part of it and glows (the story gives her the first boon); the grey man steps out of the smoke, draws the rest into the lantern; a barrier, no fight: "Every seal you break makes the night longer. Ask your Church why." He looks at Lumi a moment too long, and goes east | the Crown carried | his hand shakes after the binding |
| 7 **new** | Firstlight | *Return*: the village rejoices at the Crown; Rowan hardens against the heretic; Ilse says nothing and keeps the cold altar swept. Nessa, that evening: "Four minutes. The sun set four minutes early." A card: **Chapter 1 · The First Seal — end** | talk to Rowan | the earlier sunset |

The player can relight the cold altar with any flame (ordinary fire physics). It burns; Ilse
thanks them and says it is fire, not the Firstlight.

## 7. People

Six new people, as data (`tools/src/demo/people/*.ts`). Each has a life, a stake in the chapter, and
one thing they do not say.

### Sister Ilse (伊尔丝修女), keeper of Firstlight's chapel

- 56; a nun of the Five Sufferings; calm, dry-humoured, ink on her cuffs. Tends the flame at dawn
  and dusk; reads the litany: *"Suffering is not God's abandonment. It is the proof the debt is
  being paid."*
- **Stake**: the flame was hers to keep. She receives the Church's letter and sends you.
- **Her chapel** stands on the square behind Astra's altar and the flame (`meadow.church`, built 2026-10-11 as a "church of
  the First Dawn" on the east road and merged into hers 2026-10-12: the First Dawn's is the chapel on Dawn Hill, §13).
  Brother Anselm (68) serves in it and keeps its bookstand of skill books; on the east road Greta keeps the general store
  and Haldor the smithy.
- **Unsaid**: she raised Severin; she recognised his walk in the chapel and told no one. She once
  read a Watch book the Church burned.
- Lines (sample): "The flame is older than the houses. The houses were built to keep it company." /
  "火比房子还老。房子是为了陪它才盖起来的。" — after the theft: "Some people take a thing to keep
  it." / "有些人拿走一样东西，是为了守住它。"

### Joss (乔斯), the bridgewright

- 58; gruff, precise. Built the footbridge twenty years ago with Aldo, Hesper's husband.
- **Stake**: someone took his bridge apart *neatly*. Teaches the plank route.
- **Unsaid**: a grey young man paid for the bridge in old Watch coin, "for a road out of here a
  cart could take in a hurry."
- **Side quest, *The Ninth Nail***: one of the laid nails is missing; it is in the knight's kingdom.
  Reward: a fine hammer and the story of who paid for the bridge.

### Pell (佩尔), a boy who draws

- 9; Marta's nephew. Draws in chalk on walls.
- **Stake**: he has seen the grey man three times; the man gave him a stone that is warm at night,
  and the night-born keep off his window.
- **Side quest, *Pell's Drawings***: four drawings (the shrine stone, the barrow door, the bridge,
  the chapel at night); found, they give the order of the grey man's visits — each the night
  *before* something bad. Reward: a spare warm ember (its uses left to the world).

### Nessa Quill (奈莎·奎尔), an almanac-maker stranded by the bridge

- 31; quick, sleepless. Measures the sky for the Church's almanacs.
- **Stake**: her table of sunsets: every month the sun sets earlier, and the curve matches an old
  almanac from before the First Night that she bought from Tobin. She wants to cross to measure
  the far horizon.
- **Unsaid**: the old almanac's last pages, written as the First Night fell, are in a hand that
  begs someone to "stop him" — a line she cannot place (lore.md §9's first misreading, planted).
- **Side quest, *The Measure of Days***: take her sunset readings at three waypoint statues (the
  mountain's). Reward: the old almanac (a document).

### Fennick (芬尼克), an old templar

- 62; drinks at the square's bench; once a templar of the Seal-bearers' escort.
- **Stake**: he squired for Alberic in the long hold, six years in his youth, when the knight had worn the crown two
  hundred and fifty years and was still "the gentlest man who ever wore armour" (§14's three hundred years), and saw
  the crown take more of him every year. When the village says *knight*, he goes quiet.
- **Unsaid**: he left the escort the night Alberic did not know his name. He also knew Severin.
- Lines (sample): "He used to kneel to children. Now he makes the world kneel to him. That is what
  the crown does." / "他以前会对孩子单膝下跪。现在他要整个世界向他下跪。那顶冠冕就是这样改变人的。"

### Edda (艾达), the farmstead's survivor

- 44; the farmer on the East Road; hiding in the barn.
- **Stake**: the short days killed her crops; the night things came; the grey man pulled her out.
  She asks for her late husband's ring, taken into the knight's kingdom.
- **Unsaid**: she owes the heretic her life and is afraid to say so.
- After the knight falls she moves to Firstlight.

### Changes to existing people

| Person | Change |
|---|---|
| Hesper | the white rider took the bridge; the evenings come sooner; Aldo and Joss built the footbridge |
| Rowan | the storm line becomes the rider; he trusts the Church; after the theft he hardens against the heretic |
| Holt | sworn to catch the grey man; after the knight he wants to come on the pilgrimage (a later hook) |
| Tobin | sold Nessa the old almanac; sold the grey man a frost charm, paid in Watch coin |
| Lina, Oskar | their rescue lines name the shut door and the marked loaf; the dead "would not lie down" |
| Marta | worried about Pell's stories |
| Lumi | shivers at the shrine stone; does not know how old she is; the courier and Severin both stare at her (§3b) |

## 8. Lumi's boons (built 2026-10-04; renamed for the new setting)

Each Seal-bearer's power breaks loose when they fall; Lumi takes up part of it. Five, one per seal.
The first, from the Crown of Thorns, is **Crown's Insight (荆冠之悟)**: experience +100% — the crown
wears the self's borders thin, and a thinner self learns faster (lore.md §4; the player does not
know that is what it is for).

- Lumi carries **one** at a time, the others kept, changed **only beside a woken waypoint statue**
  (touch one: *Lumi's Powers*, five slots, the ones not yet found sealed).
- As data (`content/src/boons.ts`): a boon is a status of the fairy, `boon_<id>`, whose
  `lead:<stat>` props add to her leader's stats (`World.stat`); Crown's Insight is `lead:xpRate` 1.
  Given by the story (a notify she answers: `companion/boon`); chosen by an act of the hands on her
  (`companion/talk` → `boon`), refused unless a woken statue is within three tiles.
- **The moment** (2026-10-14): taking up a power is an fx of its own (`boon`: who, the boon, its name, its seal —
  the status's `seal` prop — and where it left, the scene's `tell` param `from`, the kneeling knight). The client
  draws a cold light arcing from him to her with motes trailing, a burst and a flash as it arrives, her body lit
  and lifted for a moment (`render/scene.ts` `boonLight`), and the HUD names it — "第一印 · 露米接住了圣印之力 /
  荆冠之悟" (`hud.ts` `boonBanner`, the game's `boonGained` text). The scene waits 3.2 s for it before she speaks.
- Tests: `tools/test/boons.test.ts`.
- **[proposal]** The other four follow their sufferings: the scourge (enduring blows), the scales
  (hunger), the nails (holding fast), the spear (what passes through).

## 9. What changes in the game

- **Content**: six person records; Severin and the Church courier as actors that appear in scenes;
  the night-of-the-flame, the letter, the crown and return scenes (`quest/scenes.ts`); the stages
  above (`quest.ts`, `village.ts`, objectives); the chapel (Firstlight's square fire becomes the
  chapel's altar flame, `firstlight.lit` a story prop); the shrine stone's wounds; the thorns, the
  marked loaf, the chalk drawings, the warm ember, the letter, the old almanac, the ninth nail and
  the **Crown of Thorns** as types; the knight's kingdom on the East Road (a ring of thorns, the
  kneeling stones, the bridge's planks).
- **The boss**: Alberic's kit, footprint and art (not designed yet); his defeat tells the story,
  which gives Lumi her boon (`notify` what = boon, unlock = `xp`) and spawns the Crown.
- **Rules, not code** (CLAUDE.md, the event model): the theft is a scene; the cold altar is a
  status; the clue things answer what the base rules cover and leave the rest undefined.
- **Proof**: every new person and thing witnesses a requirement in `tools/test/demo.test.ts`
  (C1: the chapter played headless and offline).

## 10. Decisions and open questions

Decided: the Firstlight is not recovered and Severin escapes; no fight with Severin; one
Seal-bearer per chapter, each leaving a boon; names unchanged; the setting is lore.md. 2026-10-05:
Severin believes Astra is the monster from the start, works against the pilgrim, and later hunts
Astra with them, finding the second reversal on the way; Lumi is the failed second vessel, her power
and memory lost; the nights really lengthen; Alberic is built (art, kit, effects); later chapters
wait until Chapter 1 is done.

Open: how Severin uses the dawn flame (marked [proposal]); Alberic's balance for a Chapter 1 player.

## 11. As built (2026-10-05)

**Stages** (as first built, the player's `quest` prop; since 2026-10-09 the quests' stages in `content/src/quests/main.ts` — 0.5 is `vigil`, 0.6 `first_seal` 20, 0.7 its 30, 2 its 40, 2.5 `crown_home`, 2.9 `dragon_road`):

| `quest` | Objective | Ends when |
|---|---|---|
| 0 | Help Firstlight Village (Rowan: the barrow) | the quest is handed in (`village.rescued`) |
| 0.5 | A night of thanks | night in the village: *night_flame* plays (`ch1.flame_stolen`) |
| 0.6 | The morning after | the first morning after, in the village: *letter* plays (`ch1.letter`) |
| 0.7 | The pilgrim's road (Ilse) | *The Pilgrim's Road* handed in: Fennick, Joss, Hesper spoken to |
| 1 | Mend the bridge | the far bank (any way across) |
| 2 | The White Knight's road | Alberic falls (`sins.defeated.alberic`): *crown* plays (`ch1.crown`, `night.shift` 1) |
| 2.5 | Bring the Crown home | back in the village: *return* plays (`ch1.end`), the chapter's card |
| 2.9 | Chapter 2: the road to Emberfall | entering Emberfall (stage 3, as before) |

**The main line never breaks** (2026-10-07; `CH1_QUESTS`, `VILLAGE_QUESTS`, engine `quests.ts`: `auto`,
`self`, `skipWhen`). One main quest is always under way, each taken on by itself as the last ends:

| Main quest | From | Goals (states) | Done |
|---|---|---|---|
| *Down from the Mountain* (`descent`) | a new game | the shrine stone (Mountain Foot), the Ford, Firstlight | by itself; or once in the village |
| *Lost in the Barrow* (`rescue`, Rowan) | the welcome in Firstlight | the barrow mouth (through the grassland, the forest, the hollow), Lina (barrow), Oskar (ossuary), the warden (sanctum) | handed in to Rowan |
| *The Vigil* (`vigil`, Ilse; §13) | the rescue handed in | lamp oil, dawnbloom, the bell; back to Ilse | handed in to Ilse |
| *The First Seal* (`first_seal`) | the vigil handed in | the night of thanks, the letter, across the river, the oath at the Rest, the five shrines, the writ and the Order's seal, the Kneeling Field (§14), **the White Knight** | by itself |
| *The Crown of Thorns* (`crown_home`) | the knight's fall | the Crown home (`ch1.end`) | by itself |

Whatever comes before the knight is done once he falls (`skipWhen: sins.defeated.alberic`): a player who
goes straight for him finds the rescue (and its outcome: the foragers home), the First Seal and Ilse's road
behind them, and the night of the flame, the tale and the letter no longer play (demo P5). Ilse's *Pilgrim's
Road* is a side quest now; the far bank moves the stage on from the letter (0.7).

**The barrow, three floors down** (`tools/src/demo/hollow.ts`): the Old Barrow (Lina's cell; a stair in the
east cell), the **Ossuary of the Thorn** (`ossuary`: the Order's dead in named niches — one carved for Fennick,
empty and swept —, the roll of the Order on its altar ending with Alberic, Oskar's cell, skeletons and a
ghost) and the **Warden's Sanctum** (`sanctum`: the warden — Tomas, the Commander's brother — guarding the
altar where Alberic's vow is cut: "I WILL HOLD UNTIL I AM RELIEVED", an ash thumbprint under it). The floors
are reached by stairs and lie under the barrow's overworld cell. Eleven maps lead to the knight: Cloudtop,
the Mountain Foot, the Ford, Firstlight, the grassland, the forest, Thornwood Hollow, the barrow, the
ossuary, the sanctum and the East Road.

**Gear and its tiers** (2026-10-07; content `items.ts` QUALITIES, demo C6). Six tiers: Crude 粗制, Common,
Fine 精良, Masterwork 大师, and two the story names — **Vowbound 遗誓** (purple: what those bound by a vow left
behind, the Order of the Thorn's dead, the pilgrim before you; found, never made) and, highest, **Stigmatic 圣痕**
(crimson-gold: it bears one of Astra's five wounds; only the Seal-bearers carry it, never rolled, and each piece
asks something back — the id stays `legendary`; the professions' legendary arms the Seal-bearers drop are
Stigmatic). The tooltip names the two story tiers and what a piece gives where it is worn (a cost in red).

**Effects** (2026-10-07; the classes module's `combat.ts`, `World.stat`; content `RELICS`, `VOWS`; tests
`equipment.test.ts`). A Vowbound piece keeps the **vow** it was made under (`vow`, 2026-10-13; before, only a small
trait — a dodge, a lifesteal — which left the named pieces below a common one with its three extras): a promise
with a condition and what it pays, answered as a talent is (`vowsOf`), and like any piece it rolls its extras. Ten
vows: Vigil (night: +20% crit, +15% speed), Dawn (day: 1 drawn back a blow, −10% taken), the Held Ground (standing:
+25% given, −30% taken), the Thorn (a melee blow on you pricks the striker for 3: a strike of yours back, the piece
its instrument, never answered with thorns), Mercy (a foe under a third: 2 drawn back), Silence (sneaking unslowed,
+25% crit from it), the Road (+30% speed on a road, +10% dodge moving), the Shield (a fight's first blow halved),
the Hunt (a blow on an unhurt foe is a critical), the Lone Road (no companion: +15% given, +10% dodge). A rolled piece
takes one (`QualityDef.vows`; the craft primitive, `makeItem`); the story's own name theirs (Odo's pauldrons the Held
Ground, Maren's ring Mercy, Tomas's belt Vigil, the scallop the Road, Fennick's helm the Shield, Cassian's cord Dawn,
the Order's seal the Thorn; `NAMED_VOWS`), and keep their small numbers besides (`night:def`, a lifesteal, a dodge;
`holdFast` still reads). Older saves: `migrateVows` gives each Vowbound piece its vow, brings its main stats up to its
tier's (never down) and rolls the extras it never had. Every Stigmatic piece carries a power of its own, one of each
in the world (`relic`):

| Piece | Power |
|---|---|
| Crown of Thorns | *None Cross That Do Not Kneel*: 20% of blows force the struck to kneel (1 s, `knelt`) |
| Nightfang | *Tooth of the Night*: +25% critical chance at night |
| Mirrorshard | *Stolen Face*: a critical draws back 3 more health |
| Oathbrand | *Oath Kept*: below 30% health, lifesteal ×3 |
| Galestring | *Running Wind*: each hit, +30% movement speed for 2 s |
| Starfall | *Falling Star*: every fifth hit is a critical |
| Emberheart | *Heart of Embers*: 25% of hits set the struck burning |
| Rimecrown | *Crown of Rime*: 20% of hits freeze the struck a moment |
| The Unfallen Wall | *Unfallen*: once a minute, a felling blow is turned aside |
| Dragonsbane | *Dragonslayer*: double damage against dragons and whelps |

What a blow does to the struck (kneeling, burning, frozen) travels with it (`afflict`, as bleeding does) and the
struck takes it as its own status.

| Where | Piece | Tier |
|---|---|---|
| *Down from the Mountain* | Traveller's Boots | Common |
| Cloudtop, the shelter | Watchman's Cloak | Fine |
| Mountain Foot, the hunter's hut | Hunter's Gloves | Common |
| Thornwood Hollow, the thickets | Thornproof Boots | Fine |
| The barrow, by Lina's cell | Rusted Helm of the Thorn | Crude |
| The ossuary, Odo's and Maren's niches | Brother Odo's Pauldrons, Sister Maren's Ring | Vowbound |
| The sanctum, the warden falls | Tomas's Belt of Vigil | Vowbound |
| *Lost in the Barrow* (Rowan) | Rowan's Old Hauberk | Fine |
| The forest camp | the Pilgrim's Scallop (neck) | Vowbound |
| *Pell's Drawings* / *The Ninth Nail* / *Edda's Ring* / *Night on the Grassland* | Chalk-dusted Cloak / Joss's Tool Belt / Edda's Work Gloves / Brin's Bone Ring | Fine |
| *The Watchman's Log* (Nessa) / *The Pilgrim's Road* (Ilse) | Star-glass Earring / Amulet of the Five Wounds | Masterwork |
| *The Old Templar* (Fennick) | Fennick's Squire Helm | Vowbound |
| The East Road, a kneeling stone; the kingdom | A Kneeling Pilgrim's Earring; Gauntlets of the White Host | Fine; Masterwork |
| The White Knight | the Crown of Thorns (head: +4 defence, +2 attack, −50% experience: it wears the self away) | Stigmatic |

**Story before the knight** (2026-10-06; `CHAPTER1_STORY` in `tools/src/demo/quest/chapter1.ts`, proved by
demo C4): each place and step has its scene.

| Scene | Where, when | What happens |
|---|---|---|
| `village_arrival` | first into Firstlight | Ilse at the flame, Pell wants to draw Lumi, Rowan asks for help |
| `barrow_cells` | Lina's cell in the barrow | the grey man shut the inner door and left bread with an ash mark; Lumi: the dead cannot lie down |
| `warden_falls` | the warden down | its last words: "The night is coming back. I could not lie down." |
| `tale` | the village at dusk, after the rescue, before the theft | Ilse tells the First Night and the Five; at the spear, Lumi shivers |
| `night_flame` | the village at night | the grey man takes the Firstlight |
| `ford_night` | the Ford, before the letter | the river's ice already gone; a lantern far off east |
| `letter` | the morning after | the courier, the proclamation |
| `fennick_memory` | after Fennick is asked | Alberic knelt to children; one morning he asked Fennick's name |
| `hesper_stumps` | after Hesper is asked | thorns in the stumps; Aldo's bridge |
| `road_east` (a beat) | first onto the East Road | Lumi: the sun is lower than it should be; thorns planted along the road |
| `burned_farm` | the farmstead | the dragon's claw marks (Chapter 2's hook) |
| `edda_barn` | the barn | Edda: the knight took all that shone; the grey man pulled her out |
| `severin_warning` | the road before the thorns, after the letter | the grey man tries to turn the pilgrim back: the seals hold Astra, the First Night wears his face; to Lumi: "You of all of them should know… No. You would not remember." No fight |
| `statue_rest` (a beat) | the statue before the thorns | Lumi: rest here; it is colder past the thorns than at the shrine stone |
| `watch_log` | Cloudtop, beside the shelter's table | the Church's sunset watch: years of earlier sunsets nobody read; the last page, a light asleep in the snow that asked how old it was (Lumi does not remember) |
| `pasture_first` (a beat) | first onto the grassland | the herd keeps to the north, away from the trees |
| `kneeling_herd` | the grassland at dusk (17–20) | the cows kneel, all facing east; Brin: since the bridge went; the dead come up at night |
| `forest_quiet` (a beat) | first into the forest | no birds |
| `pilgrim_camp` | the forest's south-east clearing | the cold camp of the pilgrim before you: the same proclamation, thirty-one years old, another name; his scallop by the cairn |
| `pilgrim_ghost` | the camp after dark | a pale shape kneels: "I knelt to him. Do not kneel." |
| `hollow_first`, `barrow_mouth` (beats) | Thornwood Hollow; the barrow mouth | the dead below sleep badly; the carved stones of the Order of the Thorn (Fennick: the warden was one of Alberic's brothers) |
| `far_bank_early` (a beat) | the far bank before stage 1 | across early: `ford.crossed`, but the stage waits for the pilgrim's road (`far_bank` needs stage 1) |
| `ossuary_enter`, `niches` (beats) | the ossuary; its hall of niches | a whole order of knights buried together, not sleeping; Fennick's empty niche, swept |
| `oskar_cell` | Oskar's cell in the ossuary | he went down looking for a way out; the roll's last name; the warden walks below like a guard on a wall |
| `sanctum_enter` (a beat) | the sanctum | the warden guards an altar: it thinks it still has a post |
| `kingdom` | inside the ring | "None cross that do not kneel. Another pilgrim. They always send another." |
| `crown`, `return` | after the knight | as above |

**Quests**: main *The Pilgrim's Road* (Ilse); side *Pell's Drawings* (four chalk drawings: the shrine
stone at the Mountain Foot, the barrow door, the footbridge, the flame), *The Measure of Days* (Nessa:
three waypoint statues woken), *The Old Templar* (Fennick: three of the dead), *The Ninth Nail* (Joss) and
*Edda's Ring* (both in the knight's kingdom), and (2026-10-07) *The Watchman's Log* (Nessa: read the log
on Cloudtop), *Night on the Grassland* (Brin, the herder: three of the dead on the grassland) and *The
Pilgrim Before* (Ilse, once the forest camp is found: Brother Cassian's scallop). With the village's own
(stew, Mia's ring, the hollow, firewood) the chapter has fourteen before the knight; every map before
the knight carries some of the story (demo C5).

**People**: Ilse, Joss, Pell, Nessa, Fennick in the village; Brin, the herder, on the grassland by day; Edda in the burned farm's barn (in the village
after the knight); Severin and the Church courier wait on `offstage` (a plot linked to nothing) and the
scenes place them. Hesper, Rowan, Holt, Tobin, Lina, Oskar and Marta have new lines.

**The world**: Astra's altar beside the flame; waypoint statues in the village, at the Ford and on the
East Road before the kingdom (Lumi's power is chosen beside one); the kingdom of thorns (a ring of briars,
kneeling stones, the ninth nail and the band); Alberic in it, softer than in the Boss Challenge (300
health, armour 1, plain blow 5, skills ×0.4: a dodging level-5 player of any profession wins in 20–40 s);
the road to Emberfall shut until he falls (`Portal.opensWhen`).

**Engine pieces**: the night's length (`calendar.ts` `nightHours`, `World.isNight`, appearances with
`night`, the frame's `night` for the screen); a scene's `tell` (a notice to someone: the fairy's boon); a
boss body's `skillScale`; a written thing's `text_zh`; a quest's talk goal comes before the person's own
errand (`quests.ts`); `light/told` (a light the story tells to go out or burn answers itself).

## 12. The Held Ground (built 2026-10-07)

When the White Knight falls, one thorn of his crown stays green where he fell: the **Oath-Thorn** (`item/relic/oath_thorn`,
Vowbound; the step `oath_thorn`, which also reaches a save whose knight fell before it existed). Used on oneself
(right click) it takes one into **the Held Ground** (誓守之地, map `haven`) and, used there, back where one stood
(engine primitive `pocket`: the host keeps `pocket.return`; content `body/stage` answers the notice). It lies nowhere
on the overworld.

The Held Ground is the player's camp: a peaceful field round **the planted sword** (Alberic's longsword, point down),
his tent and post, a chest, tilled earth to sow, a pond (beasts are bought, crated, at the stall) — build, farm and keep animals there as
anywhere. It is ringed by **three rings of mist** (`fixture/nature/mist`, each with its `ring`): beyond the first a
grove and stones, beyond the second a meadow and water, beyond the third boundary stones and iron in the rock.

**Alberic, freed of the crown, is its steward** (`npc.alberic`; human form `lsw/Characters/Alberic`, the pack's Master
recoloured by `tools/src/art/alberic-human.swift`: white hair, the knight's steel, the Order's gold, the thorns' scar on
his brow). He keeps his vow turned round — "You relieved me. So I hold for you now." He does not remember names and asks
yours; he remembers a squire he cannot see. He grows the ground three ways in its panel (content `haven.ts`, since
fb7bb3a; his errands `haven1`–`haven3` are gone, and an older save's are closed by `migrateHaven`): the land (what each
ring asks is handed into the ground's stock; it sets the story's `haven.size`, and every bank of mist looks now and then,
the `mist` period, whether the ground has grown past its ring, and lifts: `haven/mist-lifts`), new grounds beyond the
mist, and buildings on plots at the heart. Demo H1 plays it.

An older save is given the people the world has since added (engine `upgrade`), so the steward is in it too.

## 13. Firstlight's own country: the vigil (built 2026-10-07)

Between the rescue and the night of thanks the main line is **The Vigil** (`vigil`, Sister Ilse; taken on by itself
once the rescue is handed in, done when the knight has fallen): Firstlight keeps a vigil at its flame for those who
come home, and Ilse needs **lamp oil** from the cellar under Tam's mill, **dawnbloom** from Dawn Hill, and **the old
bell** rung in the Chapel of the First Dawn. Handed in (the Cloak of the Dawn Vigil, Masterwork), `ch1.vigil` is set:
the tale and the night of the flame wait for it; then *The First Seal* (demo V1).

Four maps (`tools/src/demo/quest/vigil.ts`), through two new gaps in Firstlight's woods:

| Map | Reached | What is there |
|---|---|---|
| **Millbrook** (水车磨坊, `mill`) | Firstlight's west edge | the brook and its footbridge, the mill (a longhouse), a thin wheat field, Tam the miller (`npc.tam`: the wheel turns slower every week) |
| **The Mill Cellar** (`millcellar`) | the mill's door | barrels and crates, the two flasks of vigil oil, slimes and a spider come in from the night |
| **Dawn Hill** (晨光丘, `dawnhill`) | Firstlight's north edge | the hill two levels up, the Dawnstone ("HERE THE SUN ROSE AGAIN"), dawnbloom facing east, wolves, a waypoint statue |
| **Chapel of the First Dawn** (初晓礼拜堂, `chapel`) | the temple's door on the hilltop | the cold first hearth where the Firstlight was kindled, the bell rope in the tower's corner (`chapel_bell`) |
| **Dawn Hill Mine** (晨光丘矿洞, `hillmine`, 2026-10-14) | Dawn Hill's west edge (a track and a sign) | the first chapter's ore for the village's smithy: an adit, a hall, two galleries; five iron veins, four coal seams, three boulders, braziers, a worn stone pickaxe at the mouth, bats that come back; no gold (the Old Mine's and the quarry's) |

**Veins grow back where they were** (2026-10-14, every mine's): a vein mined spills half its ore and leaves its
spent face (`fixture/nature/spentvein/<ore>`, the vein's `spent` prop), bedrock harder than any tool (content
`bedrock`, hardness 9; a blow on it is `mine/spent`: dust and a word, no question for the AI), whole again, whose
stage turns it back into the vein in a game day (`VEIN_REGROWS`). The Old Mine's veins no longer appear elsewhere
(its `appear` keeps its hunters only). Demo W21.

Waypoint statues now also stand on Dawn Hill and by the barrow mouth in Thornwood Hollow (`wp.dawnhill`,
`wp.hollow`). Fifteen maps led to the knight then; the Pilgrim's Road (§14) puts seven more on the main line (the Rest
and its chapel, the road, the abbey, its hall and its crypt, the Kneeling Field): twenty-two, with the Rest's hostel
beside them.

**Gear on the ground** shows as one bundle (`item:loot`, tools `art/gear.ts`): what it is shows only once it is
picked up. More errands pay in gear: Marta's Kitchen Sash, Mia's Ribbon Earring, Militia Pauldrons (Holt), the
Surveyor's Ring (Nessa), Cassian's Prayer Cord (Ilse, Vowbound).

## 14. The Pilgrim's Road (built 2026-10-12)

The user's request: many more maps before the knight, built round the Church and its faith, and the White Knight
foreshadowed. Between the far bank and the knight the First Seal now runs through four places (content
`pilgrimage.ts`; maps and scenes `tools/src/demo/quest/pilgrimage.ts`; demo PR1 plays it through the player's own inputs;
`tools/test/pilgrimage.test.ts`):

| Place | What it is | What it shows |
|---|---|---|
| **The Pilgrims' Rest** (`waystation`; its chapel `waystation.chapel`, hostel `waystation.hostel`) | the Church's halt on the far bank; Father Caius (`npc.caius`) takes the pilgrim's oath at the altar of the five wounds; Maud and Wynn, pilgrims who stopped here | the Church as it means itself: the Five recited in full, as the Church reads them (the Nails: "upon the holy wood he accepted death", lore.md §4's first layer); the litany ("as long as one bears the Five, the Long Night shall not return", §5); the Holy See's notice, which speaks of the pilgrimage as it is proclaimed (§7): seek out the five Seal-bearers, overcome them, bring the five instruments home; the hostel book of pilgrims who "went east, did not come back"; Caius: the knight "was due relief, once"; Wynn's rhyme of the knight who knelt to children |
| **The Pilgrim's Road** (`pilgrimway`) | five wayside shrines, one per suffering (`fixture/sacred/wayshrine/<id>`), each lit by what it asks laid on it (G): something for the head, a cord, a meal, metal, a light — the road itself holds one of each (a hat, a plaited cord, a loaf in an abandoned cart, a dented helm, a candle); Brother Ezra (`npc.ezra`), a penitent | the Five as acts; the knight's mark on the signposts ("none cross that do not kneel"); white pennants mended less the further east they hang; Ezra saw the knight mending a flag |
| **The Abbey of the Thorn** (`abbey`; `abbey.hall`, `abbey.crypt`) | the Order's ruined house, north of the road; its dead still keep the hours; Prior Wendel, the last keeper (`abbey.abbot`), in the crypt among the abbey's priors | Alberic made a knight (the statue: kneeling to a child); the Order's roll, forty-one names ending with him, as the ossuary's (no knight was made after him); memorial stones for Brother Odo, Sister Maren and Brother Tomas, who lie in the ossuary under Thornwood Hollow (§11); his journal (the kite, the forty years, the forty-first, "hold"; his brother by blood is Hugh — Tomas, the warden, is a sworn brother of the Order, buried a century ago, §3); the **writ of relief**, never sent: "Let him hold. He will not know the difference."; the Order's seal (`item/valuable/order_seal`) |
| **The Kneeling Field** (`kneelfield`) | the kingdom's outskirts, before the East Road, where pilgrims knelt to pray before they went on | the stones, as on the East Road (§6), of those who went on and would not kneel to him, carved on their knees all the same, each with a name and a year of the Crown; straw subjects tied kneeling, facing east; the newest stone uncut (the selection, lore.md §13, stays unseen: nobody says what it is for) |

**[proposal]** The dating and the Church's institutions here are this design's, beyond lore.md (whose §6, §7 say only
"数百年", several hundred years):
- the First Seal-bearer has held **three hundred years** (the "years of the Crown");
- his bearing was set at a **forty-year term**, with relief to follow;
- the **writ of relief was withheld** by the abbey's Prior, who could find no successor willing to bear it;
- the **Holy See** is the Church's seat, an institution that issues notices and keeps the Rest;
- **pilgrims have been sent since the 212th year** of the Crown (the Kneeling Field's oldest stone; Brother Cassian,
  thirty-one years ago, is one of them).

The rest of Chapter 1 keeps to this timeline: Fennick squired for the knight in the long hold, two hundred and fifty years
after the crowning (§7); the warden Tomas is a sworn brother of the Order buried a century ago (§3), not Alberic's brother by
blood.

What it keeps (§2, §3b): the Church speaks of the mission only, never of kneeling to the knight; the
Nails are the Church's reading (the hidden one, lore.md §4, is a later chapter's); Lumi's lines stay light — the writ's
"forty years" and the journal's "forty-first year" are left side by side for the player to read, and the Kneeling Field's
stones speak for themselves.

The First Seal's stages: 40 across the river → 50 the oath (`ch1.oath`; the pilgrim's own **Sworn Scallop**,
`item/valuable/scallop/sworn`: a scallop, but not the one the pilgrim before left in the forest, which *The Pilgrim
Before* asks for — `sworn` tells them apart) → 60 the five shrines (`ch1.shrines.<id>`) → 70 the writ and the seal
(`ch1.writ`, `ch1.order_seal`) → 80 the Kneeling Field (`ch1.kneelfield`) → 100 the knight. Nothing is gated: the knight
still falls to one who goes straight for him, and every stage before him is done with him (`PAST_KNIGHT`). A save at
stage 40 from before the road shows the oath on loading (content `game.ts`).

Fixed after review (2026-10-13):
- **A shrine never takes what must not be given away** (`KEPT`): a relic (the Crown of Thorns is worn on the head),
  what is important (the Order's seal is metal), bound, or a keepsake (Mia's ring, a scallop). It refuses it and says so.
- **Past the knight** the Rest's welcome (`rest_arrival`) and the oath (`pilgrim_oath`) do not play (the only way east to
  Emberfall runs through the Rest); `rest_after` greets one who comes from him, and Caius's first word says nothing of
  him either way.
- **The Rest's litany** on its bookstand is read with a hand (E), as any written thing; only a bookstand with nothing
  written on it is a shop (Firstlight's chapel's).

**Faith, and good and evil** (the user's request, 2026-10-12; content `faith.ts`, the society module's `conscience`,
`moral`, `kinship`): the one at the keys carries `karma` and `faith`, each −100..100. Karma falls by a quarter of a
deed's weight whenever one does a deed, seen or not (the doer is offered its own `seen` event, params `own`); it rises
with a favour done (a quest reward with regard: +3), what was taken given back (+2), an apology taken (+1). A positive
regard gain is scaled by the doer's karma against the person's alignment (`alignment` prop, else from honesty):
×(1 + 0.6·k·a), so the good warm sooner to the good and the wicked to the wicked. Faith rises with prayer (E on an
altar +4, on a wayside shrine +2, once a day each: status `prayed`) and with a shrine lit (+5); the talk verb
`unbelief` lowers it (−5; the `devout` take it ill). The Church answers it here: at the Rest, after the oath, Caius
blesses the devout (faith ≥ 30: holy water, `ch1.church.blessed`) or turns away the unbeliever (≤ −30:
`ch1.church.shunned`); the Grey Man meets the unbeliever on the road (`ch1.church.greyman`); the Kneeling Field reads
differently to each. Later chapters read these facts. Luck (gear) widens a creature's trophy chance and its chance
parts, × (1 + luck). Standing your ground, stealth and perception left the sheet and the gear (the engine still reads
them).

## 15. The forest's flanks (built 2026-10-13)

The user's request: more maps left and right of the forest, with quests of their own. Two places off the forest's sides
(`tools/src/demo/quest/flanks.ts`; errands in content `quests/side.ts`; demo FL1), each with one who lives there, a
room behind their door, and what they ask. The forest's side trail now runs on west (rows 14–16), and a trail leaves
the east clearing (rows 16–18).

| Place | What is there | Errands |
|---|---|---|
| **The Charcoal Dell** (烧炭谷, `charcoal`; hut `charcoal.hut`) | Orrin the charcoal burner (`npc.orrin`: sells coal, torches, logs) at three kilns (the `kiln` prefab) on trodden earth and ash, coal lying about and in his crate; coppice woods with stumps and four boars (more come back); west, the **roost oak** in a ring of trees, feathers under it, his tally board ("DAYS SINCE THE BIRDS CAME") | *Wood for the Clamp* (6 logs → 4 coal, a cap); *Boars in the Coppice* (level 2: 4 boars on the map); *Where the Birds Went* (Gus asked — he says the birds rose and flew west the night the bridge came down; 3 feathers; `ch1.birds`) |
| **The Reed Bend** (芦苇湾, `reedbend`; cabin `reedbend.cabin`) | the Ford's river bending south along the east side, shallows then deep water (fish: `MapData.fish`); Hilde the fisher (`npc.hilde`: fish, bait, a rod) on her pier, a smoke-fire, salt, nets; the **spit** with Rolf's boat bell (`quest.hilde.bell`, keepsake) among three water slimes; the **drowned stone**, a carving of a fish given to a child — no thorns, no wounds, nobody kneeling (the faith before the Church, lore.md) | *Three for the Smoke* (3 fish of any kind → bait, an oilskin); *The Bell on the Spit* (the bell → a luck ring; `ch1.boatbell`) |

Why the forest is quiet (§11's `forest_quiet`) is answered here: at dusk (`roost_dusk`) every bird of the forest sits
silent in the oak, facing east, as the herd kneels east — birds know before people do. Lumi's beats: `dell_first`,
`roost_dusk` (`ch1.roost`), `bend_first`, `drowned_stone` (`ch1.drowned_stone`); Orrin and Hilde each have a line that
answers the fact once.

The overworld (world-model.md §5.1, D22): the dell is a woods cell west of the forest's; the bend lies on the **river's
own cell** east of it — a camp drawn there, but the cell is river ground and not stood on, so it is reached only through
the forest and the river remains a barrier crossed by the Ford alone (demo W6, the overworld's mirrored-barriers check:
the bend has one bank, its water reaching the map's edge).
