# The main line's sets (2026-11-01)

Asked for: enrich the gear, at least thirty sets, spread over the main line's chapters. Built on the gear of
[gear.md](gear.md) (main stats by level, rolled affixes, sets counted by slot): **thirty-two sets, 153 pieces**,
five or six to a chapter, each piece a type of its own with its own picture and its own words. The forged
profession sets and the monster families' sets of gear.md §3 stay as they are, beside these.

## 1. What a chapter's sets are

Each chapter holds sets of four kinds, so every chapter has something for every profession and every way of
playing, and every way of finding things pays in gear:

| Kind | Where its pieces are | What it is |
| --- | --- | --- |
| **The order's armour** | the chapter's dungeon: remains (`fixture/remains/bones` holding the piece) and chests | what the people who served the Seal-bearer wore; its six pieces end in a power |
| **The people's gear** | the chapter's town: a merchant's stock, and the chapter's errands' rewards | what the living of the region wear and make |
| **The wanderer's gear** | off the road: remains in the wilds, a side room, a cell | someone's story told piece by piece |
| **Trinkets** | a hoard, a shop, a reward | neck, ear, ring |

And two sets cross the whole line: **The Pilgrims Before** (one piece in each chapter, on the bones of a pilgrim
sent before you, each of another century) and **The Five Seals** (each Seal-bearer's own piece, surely dropped when
it falls: the loot module's trophy, a boss's chance 1).

## 2. The rules of a piece

- **A type of its own** under a wearable form (`item/armor/helmet/thornward`), its form giving its slot, look and
  makeup; its own picture (`item:set/<set>/<slot>`, 16×16, drawn by `tools/src/art/sets.py`); its words
  (`text`, `text_zh`: FromSoftware's manner, docs/writing.md — who wore it, what became of them, never what to feel).
- **Main stats by level**, as a trophy's (trophies.ts): written as a level-1 piece's, scaled by the world's curve to
  the set's level (each Pilgrim's piece to its own chapter's), ×1.25 (a set's piece is fine). Its shares (critical
  chance, dodge, speed) are its own. It rolls its four affixes as it is made, as every piece does.
- **The bonuses** at 2 / 4 / 6 pieces (an armour set, a four-piece set at 2 / 4, trinkets at 2 / 3, the Five Seals at
  2 / 3 / 4 / 5). A bonus's attack and defence are scaled by the set's level as the pieces' are (a bonus of +2
  defence at level 15 is +7), its shares are not. A piece's `night:<key>` counts only at night; a bonus's too.
- **A power** at the top of most sets: the best a set gives, beyond any number. A bonus may grant a vow (items.ts
  VOWS), a relic's power (RELICS) or a set's own power (`SET_POWERS`); the classes module's combat answers all three
  as it answers a piece that carries them. Two sources of one power are one power.

## 3. The engine

- `GearSet.bonuses[i]` may carry `vow`, `relic` or `power` (a string each) beside its `props` (`GearSetBonus`).
- `World.setBonuses(e)`: the bonuses each worn set reaches (a piece per slot, as before); `World.stat` adds their props
  (and `night:<key>` at night, as a piece's), the classes module's `powersOf` their vows and relics, `setPowersOf`
  their powers.
- **A piece whose kind names its own level is made as it is** (a set's piece, a trophy): a merchant's restock (the
  society module) and the content's `makeItem` keep its main stats and roll its extras at that level, wherever it is
  made; a quest pays one with `setPiece(type, quest)` (quests/kit.ts), seeded by its name.
- **A piece's own colour on the one who wears it**: `lookColor` (a look colour) before its material's (`wornLook`).
- **A shield's block** adds what else is worn (a set's `block`), only while a shield is in the off hand.
- **Its words in its tooltip**: a worn piece's `text` / `text_zh` (the runtime's tooltip), in the margin's colour.
- `powers.ts`: the relics', the vows' and the sets' powers (`RELICS`, `VOWS`, `SET_POWERS`), out of items.ts.

## 3a. Where it is built

Content `gearsets/` (kit.ts the shape and the numbers, a file per chapter, across.ts, index.ts what the rest reads),
`powers.ts`, `items.ts` (a form per piece), `ontology.ts` (the sets; the Seal-bearers' sure drops), `quests/kit.ts`
`setPiece`; the demo's `sets/` (each map's spots; `laySetPieces` in `buildFord`), a person's stock (`piecesSoldBy`,
world.ts); the pictures `tools/src/art/sets.ts` → `public/assets/lsw/Items/Sets/<set>/<slot>.png`, the client's
catalogue; the proof `tools/test/gearsets.test.ts`.

## 4. The sets

Level is the set's (its pieces' main stats); lean is the profession its bonuses serve best.

### Prologue and Chapter 1 — the Ford, Firstlight, the forest, the Pilgrim's Road, the White Knight (levels 1–5)

| Set | Lv | Lean | Pieces | Where | 2 | 4 | 6 / power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Firstlight Watch** 初原守望 | 2 | any | 6 armour | Haldor sells the helm, gloves, belt and boots; *The Watch* errand the pauldrons; Rowan's rescue the hauberk | def +1 | def +2 | Vow of the Held Ground |
| **Dawn Vigil** 晨光守夜 | 3 | mage | hood, cloak, gloves, boots | *The Vigil* the cloak; Dawn Hill's shrine, the hill mine, the mill cellar | night def +2, cdr 5% | Vow of Vigil | — |
| **Wildwood** 野林 | 2 | ranger | cap, oilskin, boots, earring | the forest flanks' errands (Orrin, Hilde, the coppice, the fowler) | crit 3%, luck 5% | Vow of the Hunt | — |
| **Five Wounds** 五伤 | 3 | mage | amulet, earring, ring | Firstlight's errands (the pilgrim's amulet, the star-glass, Nessa's ring) | cdr 6% | atk +2, cdr 6%, xp 10% (3) | — |
| **Thornward** 荆卫 | 5 | warrior | 6 armour | the Order of the Thorn's dead on the Pilgrim's Way, the Kneeling Field and the abbey | def +2 | block 5%, atk +1 | Vow of the Thorn |

### Chapter 2 — Emberfall, Cinder Peak, the Scarred March, Matthias (levels 4–9)

| Set | Lv | Lean | Pieces | Where | 2 | 4 | 6 / power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Ashguard** 灰甲 | 6 | warrior | 6 armour | Garrick of Emberfall sells them | def +2 | atk +2 | Heart of Embers (relic) |
| **Pitman's** 矿工 | 5 | warrior | lamp-hat, gloves, belt, boots | the mine under Emberfall: the dead miners' remains | def +2 | def +3, luck 10% | — |
| **Cinder Hoard** 烬峰宝藏 | 8 | mage | amulet, earring, ring | the dragon's lair, its hoard | atk +2 | cdr 8%, crit damage 20% (3) | — |
| **Ashen Watch** 灰烬守望 | 8 | assassin | 6 armour | Severin's dead brothers, hidden in the March: the Lashmarks, the bastion, the pass, the Scourge House's undercroft | dodge 4% | crit 6% | Vow of Silence |
| **Lashmark Company** 鞭痕连队 | 8 | ranger | helm, pauldrons, gloves, cord | the camp's errands (the captain's pauldrons, the surgeon's gloves, the drummer's cord); Kell sells the helm | attack speed 5% | atk +3, crit 5% | — |
| **Red Order** 红衣修会 | 9 | warrior | 6 armour | chests in the Scourge House (where the Order still lives), the Pillar Yard's and the bastion's dead | def +2 | atk +2, def +2 | **Blood Price** |

### Chapter 3 — the Vale of Scales, Ele (levels 11–12)

| Set | Lv | Lean | Pieces | Where | 2 | 4 | 6 / power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Grain Guild** 粮行 | 11 | any | chain, earring, signet | Ottilie sells them | luck 10% | xp 15%, crit 4% (3) | — |
| **Almoner's** 施赈 | 11 | warrior | shawl, ribbon, apron, mittens | the Vale's errands (Berthe's bread, Elsie's scarf, Godwin's grinding); the mittens in the last almoner's box in Fairweight's chapel | def +2 | Vow of Mercy | — |
| **Tithe Riders** 什一骑手 | 12 | ranger | hood, mantle, bracers, boots | the riders who died carrying the tithe: the Chaff Road, the salt | crit 4% | Running Wind (relic) | — |
| **The Lightened** 称轻者 | 12 | assassin | 6 armour | the Standing's leavings on the salt pans | dodge 4% | move 6%, crit 5% | **Light as Chaff** |
| **Black Balance** 黑衡 | 12 | mage | 6 armour | Ele's church: the Black Balance, the Scale Floor | cdr 5% | atk +3 | **The Measure** |

### Chapter 4 — the Pale Fens, Nacht (levels 14–15)

| Set | Lv | Lean | Pieces | Where | 2 | 4 | 6 / power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Ferryman's** 渡人 | 14 | any | Hedda's shawl, coin cord, oar-pin earring, bracelet | Hedda's errand the shawl ("take my shawl"), Sanne's the bracelet; Klaas sells the coin cord; the oar-pins in a box at the landing | luck 10% | xp 15%, lifesteal 1 | — |
| **Gravelamp** 墓灯 | 14 | ranger | hood, mantle, gloves, belt | Barnaby's errand the gloves; the chapel, the causeway's grave-posts | crit 5% | **Lamplight** | — |
| **Reliquary** 圣骨匣 | 15 | mage | cowl, robe, gloves, earring | Bone Isle's reliquary | cdr 6% | **Shroud-ward** | — |
| **Fenwalker** 沼行 | 15 | assassin | 6 armour | the Drowned Graves and the causeway's drowned | dodge 4% | crit 6%, move 5% | **Undertow** |
| **Reinholder** 执辔 | 15 | warrior | 6 armour | the Ossuary on Bone Isle, the Dead Ford | def +2 | atk +2, def +2 | Nailed to the World (relic) |

### Chapter 5 — the White Altar Heights, the Witnesses (levels 17–18)

| Set | Lv | Lean | Pieces | Where | 2 | 4 | 6 / power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Chalk Stair** 白阶 | 17 | ranger | mantle, gloves, rope, sandals | the graves along the White Stair | move 6% | atk +3, crit 6% | — |
| **Turned Back** 回头者 | 17 | assassin | hood, cloak, boots, ring | Ysolde's hood by her cell, the others who turned back on the lower stair; she sells the ring | dodge 5% | Vow of the Lone Road | — |
| **The Restless** 不安者 | 18 | any | locket, earring, ring | the catacombs' niches | cdr 8% | lifesteal 1, crit damage 25% (3) | — |
| **The Elect** 选民 | 18 | warrior | 6 armour | Whiteveil's gifts to the chosen: the abbot's circlet (*The White Stair*), Agathe's robe cut to your measure (her errand), chests in the church, the robing house, the cells | def +3 | atk +3 | **Chosen of the Road** |
| **White-Robed** 白衣 | 18 | mage | 6 armour | the catacombs, Beneath the Altar | cdr 6% | atk +3, crit 5% | Through the Heart (relic) |

### The finale — the Holy City (level 20)

| Set | Lv | Lean | Pieces | Where | 2 | 4 | 6 / power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Porch Wardens** 门廊守卫 | 20 | warrior | 6 armour | the wardens sell them; the porch's armoury | def +3 | atk +3, block 5% | Vow of the Shield |
| **The Curia** 圣廷 | 20 | mage | 6 armour | the vestry chests of the nave and its chapels; the Primate sells his gloves | cdr 6% | atk +3 | **Doctrine** |
| **The Last Door** 最后之门 | 20 | ranger | hood, gloves, belt, boots | what pilgrims left at the Holiest's door (the Confluence) | crit 6% | **Those Who Came This Far** | — |
| **The Second's** 第二位 | 20 | assassin | circlet, shawl, slippers, earring | reliquaries in the nave's chapels, a coffer and a box in the Confluence | dodge 5% | **Went Small** | — |

### Across the line

| Set | Lv | Pieces | Where | Bonuses |
| --- | --- | --- | --- | --- |
| **The Pilgrims Before** 先行朝圣者 | each its chapter's | hat (Ch1), boots (Ch2), belt (Ch3), gloves (Ch4), mantle (Ch5), habit (finale) | a pilgrim's bones in each chapter | 2: move 5%; 4: dodge 5%, xp 10%; 6: Vow of the Road |
| **The Five Seals** 五印 | each its boss's | ring (Alberic), cord (Matthias), weight (Ele), spur (Nacht), murmur (the Witnesses) | each Seal-bearer drops its own, surely | 2: atk +2; 3: def +3; 4: crit 8%; 5: **The Night Kept** |

## 5. The sets' own powers (`SET_POWERS`, combat.ts)

| Power | Set | What it does |
| --- | --- | --- |
| Blood Price 血偿 | Red Order | Each blow you take: +6% damage for 6 s, up to five times. |
| The Measure 衡量 | Black Balance | +25% damage on a foe whose share of its health is greater than yours. |
| Light as Chaff 轻如糠秕 | The Lightened | While hungry (below half food): dodge +12%, movement +10%. |
| Lamplight 引魂灯 | Gravelamp | +30% damage on the undead. |
| Undertow 暗流 | Fenwalker | A critical hit drags the struck to their knees for a second. |
| Shroud-ward 裹尸布之护 | Reliquary | Below half health: skills rest 25% less and you take 15% less harm. |
| Chosen of the Road 道路所选 | The Elect | +10% damage for each relic of the Five Sufferings carried (to +50%). |
| Doctrine 教义 | The Curia | Active skills' blows deal +25%. |
| Those Who Came This Far 走到这里的人 | The Last Door | +30% damage on a boss. |
| Went Small 变小了 | The Second's | With a companion at your side: dodge +10%, skills rest 15% less. |
| The Night Kept 守夜之印 | The Five Seals | At night: +20% damage and 15% less harm taken. |
