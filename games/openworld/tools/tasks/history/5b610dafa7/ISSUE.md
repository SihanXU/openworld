# Gear levels 1–20, the Vowbound's ten vows, and the forest's two flanks

## What is wanted

Three connected pieces of work.

1. **Gear levels.** Every piece worn or wielded has a level from 1 to 20. Its main stats grow with its quality and its level. A finer piece at the same level is strictly better, and a higher-level piece of the same quality is strictly better. The quality sets how many rolled extras ("affixes") a piece gets, from 2 to 6. The level widens how far those extras may reach. The level curve is data in the world params (`gearLevels`), not hard-coded.
2. **Vows.** A Vowbound piece carries a named vow, one of ten defined in content. The classes module answers vows the way it answers talents, wherever the piece is worn or held. A Vowbound piece also rolls its extras like any other piece, including the story's named ones.
3. **Map and tooltip content.** Two new maps flank the forest. The tooltip reads worn gear. Lightning seeks a tall thing four times in five.

### Gear levels in detail

- **Quality and affix count.** Affix count by quality is crude 2, common 3, fine 4, masterwork 5, vowed 5, legendary 6. A monster's own piece keeps the loot table's four.
- **Level 1.** The first level is the Ford's.
- **Level growth.** Each level above 1 adds a fixed fraction to main stats, a smaller fraction to "shares" (rate-like stats), and a fraction to the ceiling of rolled extras. The curve is `{ max: 20, perLevel, affixPerLevel, affixCount }`.
- **Where levels come from.** The piece's source sets its level:
  - the maker, for what is forged or crafted;
  - the merchant, for what is stocked;
  - the map, for what is laid there;
  - the monster, for its own drops;
  - the author, for quest gear.
- **Prices.** Prices scale with level.
- **Stigmatic arms.** Legendary arms and the Crown of Thorns are rebuilt on the curve at a high fixed level (10), far above anything made or found on the Ford. Their own special traits are kept.
- **Clothing defence.** Cloaks, hats, hoods, boots and gloves now give a little defence (hoods a little dodge, boots a little move haste, gloves a little crit).
- **Luck replaces three stats.** Standing-your-ground, stealth and perception no longer exist as gear stats, and luck takes their place. A save's pieces that rolled any of the three, or carry one of them as their own stat, are converted.

### Vows in detail

There are ten vows: `vigil`, `dawn`, `holdfast`, `thorn`, `mercy`, `silence`, `pilgrim`, `ward`, `hunt`, `lone`. Each has an English and Chinese name and an English and Chinese telling.

The previous trait list, which gave a flat stat bonus, is removed.

### Maps and other content

- **Maps.** Charcoal Hollow (map id `charcoal`) lies west of the forest, and Reedbend (`reedbend`) lies east. Each is reached by a trail from the forest.
- **Residents.** The maps have two new residents, Orrin (`npc.orrin`) and Hilde (`npc.hilde`).
- **Errands.** There are five errands: `clamp`, `boars`, `birds` (Orrin) and `catch`, `boatbell` (Hilde).
- **Documentation and baselines.** The wiki, docs, schemas and the coverage baseline are updated to match.

## Expected behaviour

**Gear**
- `makeItem` for a wearable or wieldable form accepts `level` (default 1).
  - At a fixed level and material, stats rise strictly with quality in the order crude, common, fine, masterwork, vowed, legendary.
  - At a fixed quality, stats rise strictly with level from 1 to 20.
  - Tools, valuables and non-slotted items carry no level scaling.
- The number of `sub:*` extras on a rolled piece follows its quality's affix count. `affixes: false` rolls none. A higher level may roll wider extras.
- A form that is its own tier is of that tier even when no quality is passed. Examples are the scallop, the Order's seal and the Stigmatic arms. It must not get a doubled quality tag or name prefix.
- Older saves are stamped. `migrateGear` gives every worn or wielded entity without a level the level 1 (or its type's level). It leaves existing numbers untouched, and it is idempotent via its layout fact.

**Vows**
- A rolled Vowbound piece (slotted) gets `props.vow` set to a vow id.
  - If `opts.vow` is given, that vow is used.
  - If `opts.vow === false`, no vow is given.
  - If the form names its own vow (the scallop's `pilgrim`, the Order's seal's `thorn`), that is kept and none is rolled.
  - A Vowbound piece also rolls its 5 extras.
- `vowsOf(world, entity)` returns the set of vow ids across everything the entity wears or holds. Two pieces of one vow are one vow.
- The vows' effects, using the Vowbound piece's keeper as the subject:

| Vow | Effect |
|---|---|
| `hunt` | A blow on an unhurt foe is always a critical. |
| `holdfast` | After standing still for a second, blows deal +25% and damage taken is −30%. A step ends it. |
| `ward` | The first blow of a fight is halved; the next is not. It resets after 10 seconds out of the fray. |
| `mercy` | A blow on a foe below a third of its health drains 2. |
| `dawn` | By day, each blow drains 1 and damage taken is −10%. No effect at night. |
| `vigil` | At night, +20% crit chance and +15% move speed. |
| `silence` | Sneaking no longer slows the keeper. Blows struck while sneaking get +25% crit. |
| `pilgrim` | On a road, +30% move speed. On the move, +10% dodge. |
| `lone` | With no companion following, blows deal +15% and the keeper gets +10% dodge. A companion ends it. |
| `thorn` | Whoever strikes the keeper hand to hand loses 3 health. A prick from the Thorn is not answered with another prick. A foe out of reach is not pricked. |

- `migrateVows` finds Vowbound slotted pieces in an older save that have no vow.
  - Each gets its vow. A named story piece gets its assigned vow via `NAMED_VOWS` (keyed by English name: Brother Odo's Pauldrons → holdfast, Sister Maren's Ring → mercy, Tomas's Belt of Vigil → vigil, Fennick's Squire Helm → ward, Cassian's Prayer Cord → dawn). Any other piece gets one drawn deterministically from its id.
  - Its main stats are raised to its tier's values at its level, never lowered.
  - It rolls the extras if it has none.
  - The migration is idempotent via its layout fact.

**Maps and errands**
- The forest has portals to `charcoal` on the rows listed in `FLANKS.forestWest`, and to `reedbend` on `FLANKS.forestEast`. The matching edge tiles are walkable.
- **Charcoal Hollow**
  - It has solid kiln mounds at `FAT.kilns` and 4 boars.
  - It has at least 3 coal and at least 3 feathers lying about.
  - Orrin is there in the afternoon.
  - Entering it plays the `dell_first` scene.
  - A roost oak at `FAT.roost` plays `roost_dusk` at dusk and sets `ch1.roost`.
- **Orrin's errands**
  - `clamp`: six logs, paid in 4 coal.
  - `boars`: four boars, for a level-2 player.
  - `birds`: ask Gus, who says something about the west, then collect three feathers. This sets `ch1.birds` and gives a feather quill.
- **Reedbend**
  - It has `fish: true` and a pier at `FAT.pier` (bridge terrain with deep water four tiles east).
  - A drowned stone at `FAT.stone` plays `drowned_stone` and sets `ch1.drowned_stone`.
  - There are 3 water slimes.
  - The entity `quest.hilde.bell` sits on the spit at `FAT.spit`.
  - Hilde is there at noon.
  - Entering it plays `bend_first`.
- **Hilde's errands**
  - `catch`: three fish of any kind, paid in 5 bait.
  - `boatbell`: bring the bell, which she keeps. This sets `ch1.boatbell`.
- **Overworld.** The charcoal map sits two cells west of the bend, and the forest one cell west. The bend is a camp on the river's own cell, and that cell remains impassable.
- **Icons.** The armour and jewellery icons come from a new gear sprite set.

## Requirements

- Gear level is stored on the piece as a prop, with 1 as the default and migration stamp.
- The curve is world data (`params.gearLevels` in the ontology and its schema) and is read by the engine's gear-stat and affix-roll functions.
- The engine's `gearProps` takes a level and the curve, and `rollAffixes` takes a quality and a level. Both are backward compatible when called without them.
- The strict monotonicity holds for every pair of adjacent qualities and levels, including for the Stigmatic arms relative to common ones.
- Each of the ten vows is answered by `vowsOf` and takes effect in strike, damage and delay computations as described above.
- `QualityDef` has an optional `vows` list, so that the craft primitive can give a vowed result a vow.
- The old flat-trait list `VOW_TRAITS` is gone.
- Fresh games set the three new layout facts (stats, gear, vows) so that migrations don't re-run. Loaded old saves run `migrateStats`, `migrateGear` and `migrateVows`.
- The item tooltip reads a worn piece's level, its vow's name and telling, and its extras (client `items.vows` is passed the `VOWS` table).
- Lightning picks a tall target four times in five.
- Existing tests that assumed old numbers (cloth hat defence 0, set bonuses reading stealth) are adjusted for the new clothing defence and luck.

## Interface

**Engine** (`@openworld/engine`)
- `gearProps(form, material?, quality?, level?, gearLevels?) → Record<string, number>`. The last two arguments are new and optional.
- `levelFactor`: exported, giving the level multiplier from a level and the curve.
- `rollAffixes(data, slot, rng, opts?: { quality?: string; level?: number })`. The `opts` argument is new.
- `WorldParams.gearLevels?: { max: number; perLevel: number; affixPerLevel: number; affixCount: Record<string, number> }`.
- `QualityDef.vows?: string[]`.

**Content** (`@openworld-game/content`)
- `GEAR_LEVELS` (`gear.ts`), exported from the index.
- `VOWS: Record<string, { en; zh; text: { en; zh } }>` and `VOW_IDS: string[]` (`items.ts`).
- `makeItem(rng, form, opts)`. `opts` now has `affixes?: boolean`, `vow?: string | false` and `level?: number`; it replaces the old `trait` option.
- `leveled(form, quality, level, material?)`: gear stats at a level.
- `migrateGear`, `migrateVows`, `GEAR_LAYOUT`, `VOWS_LAYOUT`, `NAMED_VOWS` (`migrateGear.ts`).
- `migrateStats`, `STATS_LAYOUT` (`migrateStats.ts`).
- `MATERIAL_DEFS` and `QUALITY_DEFS()` must stay exported.
- `FAITH`, `CHURCH`, `FAITH_STATUSES`, `FAITH_RULES` (`faith.ts`, exported from the index).

**Modules** (`@openworld/modules`)
- `vowsOf(world, entity): Set<string>` (`combat.ts`). `combatDelay`, `combatStrike`, `combatDamage` and `finishCombatStrike` stay exported.

**Tools** (`games/openworld/tools/src/demo/quest/flanks.ts`)
- `FLANKS`: `{ forestWest: number[]; forestEast: number[] }`, the portal rows.
- `FAT`: map coordinates, with `kilns: [x, y][]` and `roost`, `pier`, `stone`, `spit` as `[x, y]`.

**Entities and content ids**
- Maps `charcoal` and `reedbend`.
- NPCs `npc.orrin` and `npc.hilde`.
- Entity `quest.hilde.bell`.
- Quests `clamp`, `boars`, `birds`, `catch`, `boatbell`.

**Client**
- `CLIENT_GAME.items` gains a `vows` field.
