# Chapter 2: The Second Seal (第二印 · 鞭刑柱)

Status: **built 2026-10-30.** The user's request (2026-10-30): design Chapter 2's story, build it and open its maps.
Playable from the Crown home to the chapter's card; proved offline by `tools/test/demo.test.ts` CH2 (the whole chapter and
its errands) and Q2–Q6 (the dragon), the reach by `tools/test/release.test.ts`. §14 lists what was built and where. It follows [lore.md](lore.md) (§4 the second suffering, §6 and §12 the Second Seal-bearer, the agreed additions)
and keeps Chapter 1's principles ([chapter-1.md](chapter-1.md) §2) and [writing.md](writing.md). Marked **[proposal]**:
what this design adds beyond lore.md, open to change.

## 1. The chapter in one paragraph

The Crown is home, and the road east is open. Beyond the Sunrise Road lies **Emberfall**, a mining town that sold its
iron over **Cinder Pass** to the Church's garrison in the Scarred March, until a dragon came down from Cinder Peak in the
lengthening nights and shut the pass. The Second Seal-bearer is in the March, so the dragon has to go. Over the pass the
ground turns red and is cut by long ravines like the marks of a lash. There the **Red Host**, the March's garrison,
has fought itself every dusk for sixty-one years, the Left Company against the Right under the same banner, and no
soldier feels a wound: a man walks to camp with an arrow through his shoulder and asks for his supper. The surgeon has
nothing to do and counts the men who die on their feet without noticing. The Red Order's brothers scourge themselves at
dusk in the Scourging House "to take a stroke off the Rider", and under their hall red channels run west. In the War-Giver's
Bastion **Matthias**, chained to the broken Scourging Post, draws every soldier's pain into himself along threads of red
light. He is not cruel: centuries of the scourge taught his flesh to bear anything, so he took his men's pain from them
as a gift, and without pain nothing told them to stop. He falls, and gives it back: across the March the soldiers cry
out all at once, and the war ends. Lumi catches part of the seal; the grey man takes the rest. That evening the sun sets
at seven.

## 2. Principles it keeps

- **The goal of each step is a state** (game-design.md §2): the dragon dead, the pass crossed, Matthias down, the Chain
  carried. One gate of the story's: the way down off the pass into the March opens when the dragon is dead (the pass's
  saddle is under its nest), the way the road to Emberfall opened when the knight fell.
- **The place teaches.** Clues are things and what people do: the arrow in a cheerful man's shoulder, the surgeon's
  ledger of men who died standing, two companies under one banner, the red channels in the undercroft floor, the threads
  in the Pillar Yard.
- **The first reversal begins** (lore.md §9). Chapter 1 kept to the first layer. Chapter 2 shows the first structure
  that carries something to the Holy City (the undercroft's channels), and gives it two readings: the Prior's (the
  penitents' blood carried to the Holy See, "how the Church keeps the Five") and Severin's (follow them west). Nobody
  says Astra is a monster.
- **The night lengthens** (lore.md §12; agreed additions): when Matthias falls, `night.shift` 2 (dusk 19:00, dawn 06:00).
- **Designed for the AI**: the clue things are ordinary things; the March's spell is the story's and the people's, not a
  game rule that takes the player's hurt away (narration only: the player bleeds and does not feel it).

## 3. What Chapter 2 shows of the world

| Lore | How Chapter 2 shows it |
|---|---|
| The second suffering, the scourge (§4): the Church's "the flesh repays everyone's sin"; its real work, to make the flesh bear the Night's endless pain | The Red Order's dusk scourging and their litany (the Church's reading); Matthias, who bore so much he could take everyone's pain (the real work, misread by everyone) |
| The Seal-bearers suffer and are twisted (§6, §12) | Matthias took his men's pain out of kindness; the war that never ends is what is left when nobody can be hurt |
| Power carried to the Holy City (§9, first reversal) | the undercroft's red channels running west; the Prior's register of the "offering" sent west |
| The dead not resting (§2) | the Bastion's old guard: soldiers who died at their posts without noticing and still stand them, bones in red rags |
| Creatures out of the First Night's records (§7) | the dragon of Cinder Peak: Wren's book has it only in the annals of the First Night |
| Severin (agreed additions) | ahead of the pilgrim: in the undercroft, at Matthias's fall, and at Holt's cot |
| Lumi, the failed second vessel (§3b of chapter-1.md) | at the post her back stings where she has no wound |

## 4. The boss: Matthias the War-Giver, Second Seal-bearer (赐战者·马提亚)

| | |
|---|---|
| Lore | The Second Seal (the red rider of Revelation: "power was given to him to take peace from the earth, that they should kill one another; and there was given unto him a great sword"), bearer of the Scourging Post's share of Astra's burden (lore.md §6, §12). |
| What the scourge did | The scourge's real work is to make the flesh bear the Night's endless pain (§4). After three hundred years Matthias can bear anything, so he bears everyone's: sixty-one years ago, after a night battle that left the field crying out, he stretched out his hand and took his men's pain. No one under his banner has felt a wound since. Without pain nothing told them to stop: within the year the Host had turned on itself **[proposal]**. |
| His look | From the collaborator's portrait (`wiki/images/seal2-war-giver-mattia.webp`): a giant in a hooded, torn blood-red tabard over dark iron, a halo of iron spikes, a great cross-hilted sword point down, chains from the broken Scourging Post wound round him, red threads running from his hand to the soldiers. |
| In Chapter 2 | Seen first through others: Odran in Emberfall remembers him taking a novice's lashes; Brannoc calls him "the Rider" and is proud no man of his falls back; the Prior calls the painless war grace; Vera calls it a slow death. |
| His end | Struck down, he feels his own pain again: "It hurts. I had forgotten how much." He lets the threads go, and outside every soldier's pain comes back to him at once. "Now that it hurts, they will stop." He tears the chain from the post and holds it out: what the Church sent the pilgrim for. He dies as a man. |

### His fight [proposal]

On the kits module (docs/skills.md), in the **Pillar Yard** behind the Bastion's fog (docs/boss-rooms.md). He is chained to
the post; the chain is long. Two phases:

| Skill | Shape | Effect |
|---|---|---|
| 赐战之剑 / The Given Sword | a cone ahead, radius 3 | a heavy sweep of the great sword |
| 鞭笞 / The Lash | a cross from him, 5 each way | the post's chains lash out along four lines; bleeding |
| 赤骑冲锋 / The Red Charge | a line toward the foe, 8 | he drags the chain across the yard; a push |
| 赤线 / The Red Threads | five spots round the foe | threads of red light strike down |
| 柱下 / At the Post (phase II's opening) | a ring round him, 4 | at half health he puts his back to the post; the ring of chains whips out |

Campaign body softer than the Boss Studio's (as Alberic's): the studio 1400 health / armour 3 / attack 26; the campaign
640 / 2 / 14 (content `MATTHIAS_CAMPAIGN`, for a player of about level 9 after the dragon). His art is Alberic's boss
strips redrawn (`tools/src/art/matthias.py` → `public/assets/lsw/Bosses/matthias/`): the tabard blood-red, the armour
dark iron, the crown's spikes a halo, a red hood, the chains added; his five effects drawn in the same script. The
runtime draws every strip boss alike (`runtime/src/assets/bosses.ts` `STRIP_BOSSES`, `isStripBoss`).

## 5. Severin in Chapter 2

| Seen | The camp's / the Order's reading | True |
|---|---|---|
| He walks the undercroft with his lantern | a heretic in the Order's holy place | he is reading where the channels go |
| "These run west. Follow them to the end and you are in the Holy City." | heresy | true (lore.md §9's structure; his reading of it, Astra waking, is the first reversal) |
| He draws the second seal's loose power into the lantern | a heretic feeding on a holy seal | he keeps it from the Holy City; the flame gutters, he flinches harder than at the first |
| He sits by Holt's cot and burns the wound shut with an ember | — | every act of his protects someone (chapter-1.md §5) |

His rule holds: he never harms anyone, never explains more than a sentence, and the player never fights him.

## 6. The chapter, beat by beat

| # | Where | Beat | Goal (a state) | Clue planted |
|---|---|---|---|---|
| 0 | Firstlight | Chapter 1's homecoming ends with the road east open (`world.ch2`): the chapter's card, then *The Dragon Road* begins | — | — |
| 1 | Emberfall | Mara's welcome: the dragon came down off Cinder Peak in the long nights and shut the pass; the Red Host's carts no longer come for the iron. Odran, an old brother of the Red Order, lives here | enter Emberfall | Odran's scars; "past the pass you won't feel your cuts. Watch your blood." |
| 2 | Emberfall, the mine, the meadow, Hushwood | *Arm for the dragon* (as built: Garrick's blade, Wren's draughts) | the blade and the draught | Wren: the dragon is only in the annals of the First Night |
| 3 | Cinder Pass, the lair | **The dragon of Cinder Peak** | the dragon dead | — |
| 4 | Cinder Pass | the way down south into the March opens | — | the snow stops; the ground below is red |
| 5 | The Lashmarks (鞭痕原) | The descent: red ground cut by ravines. A briar cuts the pilgrim's arm; it bleeds and does not hurt. A soldier of the Red Host walks by with an arrow through his shoulder and points the way to camp | reach the camp | the arrow; the red ground |
| 6 | The Camp of the Red Host (赤旗营) | Captain Brannoc: the Rider is in the Bastion east, past the Scourging House; he grants an audience to those who have fought under him. Vera the surgeon, Wil the drummer. Holt is here, enlisted | speak with Brannoc | Vera's ledger; two companies, one banner |
| 7 | The Lashmarks at dusk | *The Dusk*: the Left and Right Companies charge across the ravine under the same banner; men fall and get up; one does not, and nobody notices but Vera. Holt laughs in the line | (scene, 18:00–20:00) | the dead man nobody noticed |
| 8 | The Scourging House (鞭笞院) | The brothers scourge themselves at dusk; Prior Lucan: the Rider takes the Host's pain, and the Order takes strokes off the Rider; the painless war is grace | speak with the Prior | the litany; the register of the offering sent west |
| 9 | The Scourging House's undercroft | Red channels in the floor run west. Severin is there: "These run west. Follow them to the end and you are in the Holy City." He leaves | (scene) | the channels (lore §9) |
| 10 | The War-Giver's Bastion (赐战者堡垒) | The outer ward: the old guard, dead at their posts and standing them; the Left Company's banner, taken sixty-one years ago, on its pole by the gate | reach the Pillar Yard | the banner |
| 11 | The Pillar Yard (刑柱庭) | **Matthias the War-Giver** | Matthias down | the threads |
| 12 | The Pillar Yard | *The Chain*: "It hurts." The threads go slack; outside, the March cries out. He gives the Chain of the Scourging Post and dies. Lumi catches part of the seal (her back stings); Severin takes the rest: "Two." He goes east | the Chain carried | — |
| 13 | The camp | *The Quiet Dusk*: men lie in rows, feeling sixty-one years of wounds; Vera has work. Holt on a cot: the grey man sat by him and burned his wound shut. "I'm not going after him. Not this time." The sun sets at seven. The card: **Chapter 2 · The Second Seal — end** | back to the camp | the earlier sunset |

## 7. People

New people, as data (`tools/src/demo/people/*.ts`):

| Person | Where | Who |
|---|---|---|
| **Odran** (奥德兰) | Emberfall, the house on the square | 74; an old brother of the Red Order who left the March forty years ago, the only one in Emberfall who knows what is over the pass. His back is a lattice of scars. He served Matthias as a novice: "He took my lashes for me. All twelve. He said he had room." **Unsaid**: he left because one morning he cut his hand and felt nothing, and was afraid. |
| **Captain Brannoc** (布兰诺克队长) | the camp | 52; captain of the Left Company; curt, proud, a soldier's sentences. Has not felt a wound in thirty years and is proud no man of his falls back. The Right stole the Left's banner sixty-one years ago, he says, and the Left will have it back. |
| **Vera** (薇拉), the surgeon | the camp, her tent | 38; the Host's surgeon; dry, exact, tired. Nobody comes to her tent. She walks the line after every dusk and writes down the wounds men walk about with, and the names of those who died on their feet. |
| **Wil** (威尔), the drummer | the camp | 11; born in the camp; has never felt pain and does not know what it is. Burns his hand at the cook fire and keeps talking. Asks the pilgrim what "hurt" is like. |
| **Prior Lucan** (卢坎院长) | the Scourging House | 60; prior of the Red Order; devout, measured, the Church's register. Believes the painless war is the Kingdom come. |
| Holt (existing) | Emberfall, then the camp | went east to catch the grey man; enlists at the camp; fights in the dusk without feeling it; after Matthias, his wounds come back at once |
| Severin (existing) | scenes | §5 |

## 8. Lumi's second boon

**Scourge's Endurance (鞭痕之忍)**: defence +3 for her leader — the scourge makes the flesh bear what it is dealt (lore.md
§4; the player does not know what it is for). Given by the `chain` scene's `tell` (`unlock: 'endure'`).

## 9. The Chain of the Scourging Post (鞭刑柱之链)

The second of the five instruments: an iron chain ending in the ring that was set in the post, worn at the waist,
**Stigmatic**. Its power, ***Unbowed* (血尽不倒)** **[proposal]**: the more hurt its wearer, the harder they strike, up to
+50% at the last of their health — the legend that Astra on the post did not fall even when his blood ran out (lore.md
§4). Its cost: dodge −10% (the flesh that bears does not step aside). Defence +2, attack +2 at the Stigmatic level. The power is
the classes module's (`combat.ts`, the relic `scourge`), its words `RELICS.scourge`.

## 10. Quests

**Main** (one always under way, as in Chapter 1):

| Quest | From | Goals | Done |
|---|---|---|---|
| *The Dragon Road* (`dragon_road`, as built; its words rewritten) | the Crown home and the road east open | Emberfall, Mara, the blade, the draughts, the pass, the dragon | the dragon dead |
| *The Second Seal* (`second_seal`) | the dragon dead | down into the March, Brannoc, the dusk, the Scourging House, the undercroft, the Bastion, **Matthias** | Matthias down |
| *The Quiet Dusk* (`march_quiet`) | the Chain carried | back to the camp | the chapter's card |

**Side** (`errand()`):

| Quest | Giver | Asks | Reward |
|---|---|---|---|
| *Bandages Nobody Asks For* (没人来要的绷带) | Vera | 3 linen and 3 herbs | the Surgeon's Gloves (Fine) |
| *The Drum in the Ravine* (掉进沟里的鼓) | Wil | his drum, in the Lashmarks' ravine | a Drummer's Cord (Fine) |
| *The Novice's Scourge* (见习修士的鞭子) | Odran | lay his old scourge on the Scourging House's altar (to the Prior) | the Red Order's Cord (Vowbound) |
| *The Stolen Banner* (被抢走的军旗) | Brannoc | the Left Company's banner, in the Bastion's outer ward | Captain's Pauldrons (Masterwork) |

## 11. Maps

The March maps are a chain on the world map off the pass's south side (cells of the continent: the pass (13,5), then
(13,6), (14,6), (15,6), (16,6)), their maps' region **the Scarred March** (`redmarch`: the world filter's red grade). They
lie on the pilgrims' road as the continent made it (`overworld.ts` `PLACES` … `asIs`: not handed to the generator, their
ground the road's), so the continent and every backdrop and showcase place stay as they were (making it again would move
them all). The continent's own sealed seat of the March, far to the east, is drawn as the wild: the hand-made Bastion
stands for it (`replaces`, `REPLACED`).

| Map | Size | What is there |
|---|---|---|
| **The Lashmarks** (鞭痕原, `lashmarks`) | 56×30, wild | the way down from the pass (north-west); red dirt and dry grass; three long ravines (rock walls) crossed by plank bridges; the old battlefield in the middle, weapons in the ground; two banners alike on either side; a waypoint statue; wolves, boars, fire imps; Wil's drum in the ravine |
| **The Camp of the Red Host** (赤旗营, `redcamp`) | 44×30, village, peaceful | a palisade; tents in rows; the surgeon's tent (`redcamp.surgery`) and the captain's tent (`redcamp.command`); the cook fire, weapon racks, practice dummies; Brannoc, Vera, Wil, Holt |
| **The Scourging House** (鞭笞院, `scourgehouse`) | 40×28, peaceful | the Red Order's chapterhouse on a red ridge; scourging posts in its court; the brothers' cells; the hall (`scourgehouse.hall`: the altar of the Post, the register) and its undercroft (`scourgehouse.undercroft`: the red channels) |
| **The War-Giver's Bastion** (赐战者堡垒, `bastion`) | 40×30, combat | broken walls on a red rise; the old guard (bones in red rags) at their posts; the banner by the gate; the fog into the Pillar Yard |
| **The Pillar Yard** (刑柱庭, `pillaryard`) | 30×24, arena | the broken Scourging Post at its heart; Matthias chained to it |

## 12. Opening it

- **`world.ch2`** (content `regions.ts` `CHAPTER_TWO`) opens Chapter 2's road: set by Chapter 1's homecoming (`return`);
  an older save whose Crown is home gets it on loading. It opens the East Road's way to Emberfall and Emberfall, the mine,
  the pass, the lair and the March's maps (their `opensWhen`). Their edges onto the world map stay shut (`edgesWhen`:
  `world.part2`, which still opens the whole continent, from the dev console): beyond the chain the world map is
  later chapters'.
- The release's reach (`release.test.ts`): before the Crown is home, as before; after it, Chapter 2's places too; never
  a backdrop place or a world-map cell east of the river.

## 13. Decisions and open questions

Decided with this design (2026-10-30): Chapter 2 is the Second Seal; the dragon line stays as its first half, the gate to
the March; Matthias as above; Holt goes east; Severin shows the channels.

Open: Matthias's body is redrawn from Alberic's strips until the user delivers his own.

## 14. As built (2026-10-30)

**Where**: content `chapter2.ts` (the facts `CH2`, Matthias's id and campaign numbers, the post, the posts, the channels,
the Red Host's standard), `items.ts` (the Chain, Wil's drum, Odran's scourge, the Left's banner; the relic power's words),
`bosses.ts` (Matthias's kit, fight and rules), `bossrooms.ts` (his room), `boons.ts` (`endure`), `quests/main.ts`
(`dragon_road` reworded, `second_seal`, `march_quiet`), `quests/side.ts` (`bandages`, `drum`, `odran`, `banner`),
`regions.ts` (`CHAPTER_TWO`), `rules.ts` (`SITE_GATES`: the road east until the Crown is home; the way down under the
dragon's nest), `migratePartTwo.ts` (an older save with the Crown home gets the road open); the classes module's
`combat.ts` (the relic `scourge`). The demo: `tools/src/demo/quest/chapter2.ts` (the maps, the halls, the scenes
`CHAPTER2_STORY`, the hooks on the pass, Emberfall and offstage), `quest/scenes.ts` (the dragon line reworded: the
council names the pass and the March; the dragon's fall no longer ends the game), `quest/maps.ts` (`PASS.south`),
`people/*.ts` (ten new people; Holt goes east; Wren's book), `world.ts`, `overworld.ts`. Art: `tools/src/art/matthias.py`,
`tools/src/art/chapter2.py` (icons, the post, the channels, the standard).

**Facts and steps**: `world.ch2` (the homecoming `return`), `mq.dragon` (the dragon dead: opens the pass's south way),
`ch2.march` (`march_descent`), `ch2.camp` (`second_seal` stage 40), `ch2.dusk` (`dusk_battle`, 18:00–20:00 on the
Lashmarks), `ch2.house`, `ch2.channels` (`undercroft`), `ch2.bastion` (`bastion_ward`), `sins.defeated.matthias`,
`ch2.chain` (`chain`: the Chain, the boon, Severin, `night.shift` 2), `ch2.end` (`quiet_dusk`, 19:00–23:00 at the camp),
then `chapter2_end` (the card). Beats: `odran_first`, `pass_south`, `house_dusk`.

**Maps**: `lashmarks` (56×30; the plain at four half levels, the two ravines at nought, two bridges and a stair into the
middle one; the waypoint `wp.lashmarks`), `redcamp` (44×30; `redcamp.warhall`, `redcamp.hospital`), `scourgehouse`
(40×28; `scourgehouse.hall` with the stair down to `scourgehouse.undercroft`, `scourgehouse.cells`), `bastion` (40×30; the
keep's two doors the fog; `wp.bastion`), `pillaryard` (30×30, behind the fog; one comes in out of Matthias's sight).
