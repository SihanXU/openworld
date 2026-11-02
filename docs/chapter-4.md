# Chapter 4: The Fourth Seal (第四印 · 钉刑圣木)

Status: **built 2026-11-01**. Playable from Chapter 3's supper to the chapter's card; proved offline by
`tools/test/demo.test.ts` CH4, the reach by `tools/test/release.test.ts`. §13 lists what was built and where. It follows [lore.md](lore.md) (§4 the fourth suffering, §6 and §12 the Fourth Seal-bearer,
§9 the first reversal, the agreed additions: the player comes to Severin's belief at mid-game) and the main line's shared
plan in [chapter-3.md](chapter-3.md) §2. Marked **[proposal]**: what this design adds beyond lore.md.

## 1. The chapter in one paragraph

South of the Vale the land sinks into **the Pale Fens**, where the dusk hardly lifts. In the Fens no one has died for
forty years. The dead get up. They go home and take up their places, a little greyer and quieter each year, and their
families keep them: every doorpost in the stilt village of **Nailgate** bristles with iron nails, one for each of the dead
kept inside. The sexton drives the nails. The ferryman of the dead has not had a passenger in forty years. Old Hedda is a
hundred and nine, and cannot die. The dead forget slowly, and those who have forgotten everything wander the Drowned
Graves at night as **the Pale**. Every dusk the Pale Rider, **Nacht**, rides the causeways on his pale horse, gathers the
wanderers and nails them back to their houses. Nacht bears the Nails' share of Astra's burden, death's erosion, and holds
every soul of the Fens to the world: "None of mine will go into the dark." Nessa Quill is in Nailgate with the proof she
has found: the nights have lengthened on the very days the Church's own chronicle records signs of life in the Holy Body.
In the Ossuary of the Holy Wood is the Shroud that wrapped Astra's body when it was carried to the Holy City; it is
black, and the black moves under the hand. Severin is there, on his knees: the three seals in his lantern are more than
he can hold. He says it plainly at last: "He is waking. And you are carrying him his limbs." The pilgrim believes him.
Nacht falls; the dead of the Fens lie down; the ferryman's boat goes out full. The pilgrim and Severin go west together
to take the last instrument before the Church can use it. The sun sets at five.

## 2. Principles it keeps (beyond chapter-3.md §2)

- **The turn is earned by things, not told**: Nessa's two columns of dates; the Shroud; Severin's collapse. The player
  turns because of what they saw; Severin only says the sentence they already believe.
- **The mercy is real**: Nacht is right that death in the Fens now leads into the dark (the Night seeps in, lore.md §10).
  He is wrong that holding them is better. The dead's own words show it (Liese forgetting Piet's name; Hedda).
- **The night lengthens**: `night.shift` 4 after Nacht (dusk 17:00, dawn 07:00).

## 3. What Chapter 4 shows of the world

| Lore | How Chapter 4 shows it |
|---|---|
| The fourth suffering, the nails (§4): the Church's "accepting death"; its real work, to fix the bearer to the world while the Night eats the soul | the nails in Nailgate's doorposts, one for each of the dead kept (the real work, on a village); the sexton's litany "he accepted death, and death did not take him" |
| The dead not resting (§2, §7) | the Fens' dead at home; the Pale in the Drowned Graves |
| The darkness inside the Holy Body (§9) | the Shroud of the Translation in the Ossuary: black, moving |
| The nights lengthen with the body's signs of life (§9) | Nessa's table beside the Church's chronicle of the Quickening |
| Severin's belief (agreed additions) | the pilgrim comes to it here and goes on with him |

## 4. The boss: Nacht, Reinholder of Death, Fourth Seal-bearer (死之执辔者·纳赫特)

| | |
|---|---|
| Lore | The Fourth Seal (the pale rider of Revelation: "his name that sat on him was Death, and Hell followed with him"), bearer of the Holy Wood of the Nails' share, death's erosion (lore.md §6, §12). |
| What the nails did | The nails fix their bearer to the world however much of the soul is eaten (§4). Nacht has been fixed for three hundred years and knows what lies past death now: the dark that is coming back. Forty years ago, when the dusk over the Fens stopped lifting, he took up the reins of Death's horse and would not let it go out: no soul of his would go into that dark **[proposal]**. |
| Look | From the collaborator's portrait (`wiki/images/seal4-reinholder-of-death-nacht.webp`): a rider in white rags over dark armour on a pale, gaunt horse hung with bells and chains, a halo of thin spikes, a long scythe with a rag streaming from it; graves, lilies, hooded mourners. |
| In Chapter 4 | Seen first through others: the sexton calls him the Keeper; Piet thanks him every night for his wife; Hedda curses him; the ferryman says only that the river has been empty forty years. |
| His end | Struck from the horse, he lets go of the reins: "Then go. All of you. I cannot see where." The bells stop. Across the Fens the dead lie down where they stand. He gives the Holy Wood and dies, and his horse walks into the river. |

### His fight [proposal]

On **the Ford of the Dead** behind the Ossuary's fog. Two phases:

| Skill | Shape | Effect |
|---|---|---|
| 镰刈 / The Reaping | a cone ahead, radius 3 | the scythe's sweep |
| 苍白冲锋 / The Pale Charge | a line toward the foe, 9 | the horse rides through; a push |
| 钉落 / The Nails Fall | spots round the foe | iron nails rain down; the struck are pinned (kneel) |
| 丧钟 / The Knell | a ring round him, 4 | the horse's bells; the struck are slowed |
| 亡者之辔 / The Reins of the Dead (phase II's opening) | a ring round him, 6 | at half health he pulls the reins: grave-hands rise round the ford and hold whoever wades into them |

Campaign body (`NACHT_CAMPAIGN`): 900 health, armour 3, attack 18, for a player of about level 15; the Boss Studio's
1800 / 3 / 30. Art: a rider on a pale horse (`tools/src/art/nacht.py`); five effects; the grave-hands as a hazard (as the
dragon's embers).

## 5. Severin in Chapter 4

| Seen | The Fens' reading | True |
|---|---|---|
| On his knees in the Ossuary, the lantern's flame blue and low | a heretic struck down in a holy place | three seals' power is more than the flame and he can carry |
| He shows the pilgrim the Shroud | sacrilege | lore §9's darkness in the body (true thing, his reading: a monster) |
| "He is waking. And you are carrying him his limbs." | heresy | the first reversal, which the player now believes |
| At Nacht's fall he cannot take the fourth seal's loose power; Lumi takes more of it than ever before, and he takes what is left with the pilgrim's hand on the lantern | — | from here they go on together |

## 6. The chapter, beat by beat

| # | Where | Beat | Goal | Clue |
|---|---|---|---|---|
| 0 | Fairweight | Chapter 3's end opens the fen road (`world.ch4`); *The Fen Road* begins | — | — |
| 1 | the Long Causeway | First arrival: the card "The road went down into the fens for five days. On the last two the sun did not come up." Grave-posts nailed along the causeway | reach Nailgate | the nails |
| 2 | Nailgate | *The Kept*: Piet's dead wife Liese sets the table; she does not know who the pilgrim is, nor, for a moment, who Piet is. The sexton drives a nail into Piet's doorpost | (scene) | the nails; Liese |
| 3 | Nailgate, the chapel | Nessa Quill: her sunset table beside the Church's chronicle of the Quickening — the same days. "They knew. The Church has been writing it down." | speak with Nessa | the two columns (lore §9) |
| 4 | Nailgate, the landing | Klaas the ferryman: forty years with no passenger | (beat) | the coin box |
| 5 | the Drowned Graves | At dusk the Pale; the Pale Rider seen on the far causeway, gathering them (scene, 17:00–19:00) | see the Rider | — |
| 6 | the Ossuary of the Holy Wood | Severin on his knees; the Shroud: "He is waking. And you are carrying him his limbs." The pilgrim's journal: *I believe him.* | (scene) | the Shroud (lore §9) |
| 7 | the Ford of the Dead | **Nacht, Reinholder of Death** | Nacht down | — |
| 8 | the Ford | *The Reins*: "Then go." The bells stop. The Holy Wood given. Lumi catches more than ever; Severin, with the pilgrim's hand on the lantern, the rest: "Four. ...We go on together." | the Holy Wood carried | — |
| 9 | Nailgate | *The Ferry*: the dead lie down where they stand; the village lays them in the boats; Klaas's boat goes out full; Hedda dies in her bed and is glad; the sun sets at five | back to Nailgate | — |
| 10 | Nailgate | The card: **Chapter 4 · The Fourth Seal — end** | — | — |

## 7. People

| Person | Where | Who |
|---|---|---|
| **Klaas** (克拉斯), the ferryman | Nailgate, the landing | 71; ferryman of the dead; has kept his boat tarred for forty years without a passenger; keeps the coins the dead used to bring in a box. |
| **Old Hedda** (老海达) | Nailgate, her house | 109; bedridden; cannot die; wants to: "Ask him to let go of me." |
| **Piet** (皮特) | Nailgate, his house | 52; a fisherman; grateful to Nacht for his wife. |
| **Liese** (莉泽) | Piet's house | dead eleven years; keeps house; grey, quiet; some days she does not know Piet's name. |
| **Sanne** (桑娜) | Nailgate | 16; plays with her dead brother Jory, who has been eight for eight years. |
| **Jory** (乔里) | Nailgate | dead; eight; does not understand why his sister got tall. |
| **Sexton Barnaby** (司事巴纳比) | Nailgate, the chapel | 58; drives the nails; believes it mercy: "A nail for each one kept. None of ours goes into the dark." |
| Nessa Quill | Nailgate, the chapel | the proof |
| Severin | the Ossuary, the ford | §5 |

## 8. Lumi's fourth boon

**Hold of the Nails (圣钉之守)**: standing one's ground, the leader takes 20% less harm (`lead:holdFast` 0.2) — the nails
fix the body fast (lore.md §4).

## 9. The Holy Wood of the Nails (钉刑圣木)

The fourth of the five instruments: a board of black wood as long as a forearm, from the tree Astra was nailed to, with
three great nails still through it; held in the off hand, **Stigmatic**. Its power, ***Nailed to the World* (钉于此世)**
**[proposal]**: below a quarter of its bearer's health they take half harm. Its cost: movement −10% (nailed). Defence +2,
attack +2 at the Stigmatic level.

## 10. Quests

**Main**: *The Fen Road* (`fen_road`: the Fens, Nailgate, Nessa), *The Fourth Seal* (`fourth_seal`: the Drowned Graves, the
Rider, the Ossuary, **Nacht**), *The Ferry* (`ferry`: back to Nailgate; the card).

**Side**:

| Quest | Giver | Asks | Reward |
|---|---|---|---|
| *The Ferryman's Coin* (渡钱) | Hedda | a ferryman's coin from Klaas's box, for when she goes | Hedda's Shawl (Fine) |
| *Jory's Kite* (乔里的风筝) | Sanne | Jory's kite, caught in a dead tree in the Drowned Graves | a Sister's Bracelet (Vowbound) |
| *Nails* (钉子) | Barnaby | 3 iron ingots | the Sexton's Gloves (Fine) |

## 11. Maps

A chain on the continent's causeway road down the Fens, region **the Pale Fens** (`palefen`: grey-green, dim): cells
(42,33), (42,34), (42,35), (42,36). The continent's sealed seat (`palefen.the-pale-rider-s-ossuary`) is drawn as the wild:
the hand-made Ossuary stands for it.

| Map | Size | What is there |
|---|---|---|
| **The Long Causeway** (长堤, `causeway`) | 36×44, wild | the road from the Vale (north); a causeway over black water; dead trees; fog lamps; nailed grave-posts; bog wisps; the Pale at night; a waypoint statue |
| **Nailgate** (钉门村, `nailgate`) | 46×36, village, peaceful | houses on piles and walks over the water; nailed doorposts; the chapel (`nailgate.chapel`); the ferryman's landing; Piet's house (`nailgate.piet`), Hedda's (`nailgate.grete`) |
| **The Drowned Graves** (沉墓地, `drowned`) | 46×34, wild | a sinking graveyard; leaning stones and coffins in the water; the Pale; Jory's kite in a dead tree |
| **The Ossuary of the Holy Wood** (圣木骨堂, `ossuary`) | 40×32, combat | Nacht's seat on its island; a chapel of bones (`ossuary.reliquary`: the Shroud); a waypoint statue; the fog into the ford |
| **The Ford of the Dead** (亡者渡, `deadford`) | 30×30, arena | a black ford; the Holy Wood standing in the shallows; Nacht |

## 12. Decisions and open questions

Open: every [proposal]; Nacht's art is the project's own until the user delivers his.

## 13. As built (2026-11-01)

**Where**: content `chapter4.ts` (the facts `CH4`, Nacht's id and campaign numbers, the nailed doorpost, the grave-post,
the Shroud, the Holy Wood standing in the ford, the dead's hands; `CH4_RULES`: the hands hold whoever wades in and sink
back in a while), `items.ts` (the Holy Wood, the ferryman's coin, Jory's kite; the Lance for Chapter 5; `RELICS.nails` and
`RELICS.lance`), `bosses.ts` (Nacht's kit, fight and rules; the reins leave the dead's hands), `bossrooms.ts`, `boons.ts`
(`hold`; `pierce` for Chapter 5), `quests/main.ts` (`fen_road`, `fourth_seal`, `ferry`), `quests/side.ts` (`ferrycoin`,
`kite`, `nails`; the first two too late after the ferry); the classes module's `combat.ts` (the relics `nails`: half harm
below a quarter of health; `lance`: blows through armour, a tenth more taken). The demo: `tools/src/demo/quest/chapter4.ts`
(the maps, the halls and houses, the scenes `CHAPTER4_STORY`, the Fens' dead offstage once they lie down), `quest/chapter3.ts`
(Fairweight's track south through its fields), `people/*.ts` (seven new people; Nessa in Nailgate's chapel; Severin waits
at the landing once the fourth seal is down and gives his name), `world.ts`, `overworld.ts`. Art: `tools/src/art/nacht.py`,
`tools/src/art/chapter4.py`.

**Names**: renamed from the design to keep clear of people already in the game: Old Hedda (was Grete), Klaas the ferryman
(was Ansel; not Aldo, the name of Hesper's late husband at the Ford), Sanne (was Mira), Barnaby the sexton (was Wendel).

**Severin from here on** is with the pilgrim through the scenes (placed beside them), not a follower that walks the maps:
a man who never fights would only be in the way of every fight, and a lost follower is worse than a present scene.

**Facts and steps**: `world.ch4` (Chapter 3's `supper`), `ch4.road` (`fen_arrival`: the travel card), `ch4.kept`
(`kept`), `ch4.nessa` (`quickening`, the chapel), `landing` (a beat), `ch4.rider` (`rider`, 17:00–20:00 on the Drowned
Graves), `ch4.shroud` (`shroud`, the reliquary), `dead_ford`, `sins.defeated.nacht`, `ch4.wood` (`reins`: the Holy Wood,
the boon, Severin, `night.shift` 4), `ch4.end` and `world.ch5` (`the_ferry`, 16:00–23:00 in Nailgate), then `chapter4_end`.

**Maps**: `causeway` (36×44, cell (42,33), in from Fairweight's fields; `wp.causeway`), `nailgate` (46×36; the walks and
houses on piles; `nailgate.piet`, `.hedda`, `.sanne`, `.klaas`, `.chapel`, the rows' rooms), `drowned` (46×34), `boneisle`
(40×32, the island; `boneisle.reliquary`; `wp.boneisle`; the arch's fog), `deadford` (30×30, behind the fog).
