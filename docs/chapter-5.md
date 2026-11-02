# Chapter 5: The Fifth Seal (第五印 · 穿心圣枪)

Status: **built 2026-11-01**. Playable from Chapter 4's ferry to the chapter's card; proved offline by
`tools/test/demo.test.ts` CH5, the reach by `tools/test/release.test.ts`. §13 lists what was built and where. It follows [lore.md](lore.md) (§4 the fifth suffering, §6 and §12 the Fifth Seal-bearer,
§13 why the protagonist was chosen, the agreed additions: Lumi the failed second vessel) and the main line's shared plan
in [chapter-3.md](chapter-3.md) §2. Marked **[proposal]**: what this design adds beyond lore.md.

## 1. The chapter in one paragraph

West of the Holy City the land climbs into **the White Altar Heights**, chalk cliffs and monasteries. Severin walks with
the pilgrim now. At the head of the White Stair stands **Whiteveil Abbey**, whose brothers keep the catacombs under its
altar. There the Church brings its dead pilgrims: every pilgrim named in four hundred years who died on the road, robed in
white and laid in a niche, with their name and their year. They do not rest. The lance's wound in the soul is theirs to
carry, all of them together, and in the dark under the altar they murmur one question: "How long?" The abbot robes them
and keeps the roll, and the roll says what the pilgrimage is: whenever the seals weaken the Church names pilgrims, and
the one who can bring down the five and bear their power is the one the Great Rite needs, "a bearer new" (lore.md §13).
Severin reads it his way: the Church is making Astra a new body, and it is the pilgrim. Cassian of Firstlight's niche is
there, empty: *not yet brought*. The oldest niche, deepest down, says: *Lu—, the second. She took up the Five in the
fourth year and bore them a night and a day. The Night went out of her, and she went small.* Lumi reads it and says it
is a nice name. Under the altar the Witnesses rise as one, the Fifth Seal-bearer. When they fall the Lance comes out of the
altar and they say "It is enough," and lie down. The sun sets at four. The pilgrim and Severin go down to the Holy City.

## 2. Principles it keeps (beyond chapter-3.md §2)

- **Lumi never states her sadness** (chapter-1.md §3b): the niche says it; she reads it aloud and likes the name; the
  player knows.
- **§13 is told by the Church's own record**, plainly, by an abbot who thinks it holy; the player reads it with
  Severin's eyes (a new body), not yet with the truth's (a new cage).
- **The night lengthens**: `night.shift` 5 after the Witnesses (dusk 16:00, dawn 07:30).

## 3. What Chapter 5 shows of the world

| Lore | How Chapter 5 shows it |
|---|---|
| The fifth suffering, the lance (§4): the body made the gate the Night pours into | the Witnesses: four hundred years of the dead under one altar, one open wound, crying "How long?" |
| The martyrs of the fifth seal (Revelation 6:9–11: robes given, told to rest "until their fellowservants also ... should be fulfilled") | the robes; the abbot's teaching that they wait for the one who will finish the road |
| Why the protagonist was chosen (§13) | the roll; Sister Agathe sewing a robe to the pilgrim's measure |
| Lumi, the second vessel (agreed additions) | her niche, the oldest |
| Chapter 1's previous pilgrim | Cassian's empty niche |

## 4. The boss: the White-Robed Witnesses Beneath the Altar, Fifth Seal-bearer (祭坛之下的白衣万证)

| | |
|---|---|
| Lore | The Fifth Seal (the martyrs under the altar), bearers of the Lance's share, the wound in the soul (lore.md §6, §12). |
| Who they are [proposal] | Every pilgrim named in four hundred years who died on the road, and those who reached the Holy City and could not bear the Rite: robed, laid under the altar, given the lance's wound to carry together. The first of them is the second vessel's attempt (§3b): when she failed, the Church split the burden among five bearers; the dead pilgrims have been the fifth ever since. |
| Look | From the collaborator's portrait (`wiki/images/seal5-white-robed-witnesses.webp`): a heap of white-robed figures round a Gothic altar, gold haloes, hands raised, the Lance standing in the altar under a ring of light; candles, incense. |
| Their end | "Is it fulfilled?" — "It is enough." They lie down; the Lance comes free of the altar into the pilgrim's hands. |

### Their fight [proposal]

**Beneath the Altar**, behind the catacombs' fog. Two phases:

| Skill | Shape | Effect |
|---|---|---|
| 何时 / "How Long?" | a ring round them, 5 | the cry; a blow and a push |
| 白袍坠落 / The Robes Fall | spots round the foe | robes fall like shrouds; the struck are slowed |
| 殉者之手 / The Martyrs' Hands | a cross from them, 5 each way | hands reach out of the heap |
| 圣枪之影 / The Lance's Shadow | a line toward the foe, 12 | a beam from the altar |
| 万证 / The Myriad (phase II's opening) | a ring round them, 6 | at half health all of them rise; the ring of hands |

Campaign body (`WITNESSES_CAMPAIGN`): 1000 health, armour 3, attack 20, for a player of about level 18; the Boss Studio's
2000 / 3 / 32. Art: the old Envy strips redrawn as white-robed figures with gold haloes, three to a body
(`tools/src/art/witnesses.py`); five effects.

## 5. Severin in Chapter 5

He walks with the pilgrim (a second companion who follows and never fights, `npc.severin` led by the story) from the
White Stair to the Holy City. In the robing house he reads the roll and says: "They are not renewing a rite. They are
making him a new body. You." At the altar's fall the fifth seal's loose power goes into the lantern with the pilgrim's
hand on it; the flame burns white. "Five. Now we end it."

## 6. The chapter, beat by beat

| # | Where | Beat | Goal | Clue |
|---|---|---|---|---|
| 0 | Nailgate | Chapter 4's end opens the west road (`world.ch5`); *The White Stair* begins; Severin follows | — | — |
| 1 | the White Stair | First arrival: the card "West, the land climbed out of the fens into white stone. It took six days." Robes on poles beside the path, each over a grave | reach the abbey | the robes |
| 2 | the White Stair, a cliff cell | Ysolde, a hermit: a pilgrim of forty years ago who turned back at the third seal | (beat) | — |
| 3 | Whiteveil Abbey | Abbot Benedek welcomes the pilgrim as the Church's own; the robing house: Sister Agathe measuring cloth against the pilgrim with her eyes | speak with the abbot | the robe |
| 4 | the robing house | *The Roll*: four hundred years of names; Severin: "They are making him a new body." | read the roll | §13 |
| 5 | the catacombs | The niches; "How long?"; Cassian's empty niche; the oldest niche, and Lumi reading it | reach the altar's fog | Lumi's niche |
| 6 | Beneath the Altar | **The White-Robed Witnesses** | the Witnesses down | — |
| 7 | Beneath the Altar | *It Is Enough*: they lie down; the Lance comes free; Lumi catches the last; Severin with the pilgrim's hand on the lantern: "Five. Now we end it." | the Lance carried | — |
| 8 | Whiteveil Abbey | The bells ring by themselves at four; the sun goes down; the abbot kneels to the pilgrim. The card: **Chapter 5 · The Fifth Seal — end** | back to the abbey | — |

## 7. People

| Person | Where | Who |
|---|---|---|
| **Abbot Benedek** (本尼德克院长) | Whiteveil Abbey | 72; robes the dead pilgrims, keeps the roll; knows the selection and calls it holy: "Every one of them was chosen. The road chooses, and it has chosen you." |
| **Sister Agathe** (阿加特修女) | the robing house | 50; has sewn two thousand robes; is sewing one now and will not say for whom. |
| **Brother Tomas** (托马斯修士) | the abbey | 24; a novice who carries the dead down and wants to leave. |
| **Ysolde** (伊索尔德) | the White Stair, a cliff cell | 68; named pilgrim forty years ago; turned back after the third seal; has lived in the cell since. |
| Severin | following | §5 |

## 8. Lumi's fifth boon

**Passage of the Lance (圣枪之贯)**: critical chance +15% for her leader (`lead:critChance` 0.15) — what passes through.

## 9. The Lance That Pierced the Heart (穿心圣枪)

The last of the five instruments: a plain spear of old iron, its blade black to the socket; a weapon (a spear's reach),
**Stigmatic**. Its power, ***Through the Heart* (贯心)** **[proposal]**: its wielder's blows pass through armour (the struck's
defence counts for nothing). Its cost: they take 10% more harm (the wound that does not close).

## 10. Quests

**Main**: *The White Stair* (`white_stair`: the Heights, the abbey, the abbot), *The Fifth Seal* (`fifth_seal`: the roll,
the catacombs, **the Witnesses**), *Bells at Four* (`bells`: back to the abbey; the card).

**Side**:

| Quest | Giver | Asks | Reward |
|---|---|---|---|
| *Not Yet Brought* (尚未带来) | — (Cassian's niche; offered by the abbot when asked about it) | Cassian's scallop, laid in his niche | Cassian's Robe (Vowbound) |
| *Thread* (丝线) | Agathe | 3 linen | the Robe-Sewer's Thimble (Fine) |
| *Leaving* (离开) | Tomas | a road pass from the abbot's desk | a Novice's Rope Belt (Fine) |

## 11. Maps

A chain on the continent's road through the Heights, region **the White Altar Heights** (`altar`: bleached, cold): cells
(12,27), (12,28), (12,29). The continent's sealed seat (`altar.the-altar-beneath`) is drawn as the wild: the hand-made
abbey stands for it.

| Map | Size | What is there |
|---|---|---|
| **The White Stair** (白阶, `whitestair`) | 40×40, wild | switchbacks up chalk terraces (the relief in steps); robes on poles; hermits' cells in the faces; white wolves; a waypoint statue |
| **Whiteveil Abbey** (白纱修道院, `whiteveil`) | 46×36, peaceful | the church (`whiteveil.church`: the altar, the stair down), the robing house (`whiteveil.robing`: the roll), cells, garth, graves on the summit |
| **The Catacombs of the Witnesses** (万证墓窟, `catacombs`) | 40×36, interior, combat | niches of the white-robed; the Restless; Cassian's niche; the oldest niche; a waypoint statue; the fog to the altar |
| **Beneath the Altar** (坛下, `beneathaltar`) | 30×30, arena | the altar and the Lance; the Witnesses |

## 12. Decisions and open questions

Open: every [proposal]; the Witnesses' art is the Envy strips redrawn until the user delivers theirs.

## 13. As built (2026-11-01)

**Where**: content `chapter5.ts` (the facts `CH5`, the Witnesses' id and campaign numbers, the robes on poles, the
niches filled and empty, the altar of the Lance, the white-robed lying and kneeling, Agathe's frame, the road pass;
`CH5_RULES`: Cassian's scallop, used on the niche kept for him (`for: cassian`), is laid there and gone from the hand,
the niche's plate says BROUGHT and the story keeps `ch5.cassian`), `items.ts` (the Lance, a spear, `RELICS.lance`; the road
pass), `bosses.ts` (the Witnesses' kit, fight and rules), `bossrooms.ts`, `boons.ts` (`pierce`), `quests/main.ts`
(`white_stair`, `fifth_seal`, `bells`), `quests/side.ts` (`cassian`, `thread`, `leaving`). The demo:
`tools/src/demo/quest/chapter5.ts` (the maps, the halls, the scenes `CHAPTER5_STORY`), `quest/chapter4.ts` (Nailgate's
west walk), `people/*.ts` (four new people; Severin in Whiteveil's garth, his lines on the roll and the Lance),
`world.ts`, `overworld.ts`. Art: `tools/src/art/witnesses.py`, `tools/src/art/chapter5.py`.

**Names**: the hermit is Ysolde (was Oda).

**Facts and steps**: `world.ch5` (Chapter 4's `the_ferry`), `ch5.road` (`stair_arrival`: the travel card, Severin beside),
`hermit`, `ch5.abbot` (`white_stair` done), `ch5.roll` (`roll`), `ch5.niches` (`the_niches`, the north gallery),
`beneath_altar`, `sins.defeated.witnesses`, `ch5.lance` (`enough`: the Lance, the boon, the flame white, `night.shift`
5), `ch5.end` and `world.fin` (`bells_at_four`, 14:00–23:00 in the abbey), then `chapter5_end`.

**Maps**: `whitestair` (40×40, cell (12,27), in from Nailgate's west walk; three shelves of chalk, the switchbacks;
`wp.whitestair`), `whiteveil` (46×36; `whiteveil.church` with the stair down, `.robing`, `.cells`), `catacombs` (the
catacombs plan; `wp.catacombs`; the fog at the head of the north gallery), `beneathaltar` (30×30, behind the fog).
