# Gear: rolled affixes, monster trophies, sets

Built 2026-10-11 and 2026-10-12. A piece of gear's numbers come from three places: its **main stats** (its form ×
its material × its quality, world-model.md §6.8; a trophy's are its own), a few **affixes** rolled when it is made,
and the **set** it belongs to, worn with others of it. All three are read by `World.stat(e, key)` (engine
`world.ts`), so a rule, a blow or a tooltip sees them alike. The player's pages: wiki 装备, 词条, 专属掉落, 套装.

## 1. Affixes

- **The table is the world's** (`Ontology.affixes`, an `AffixTable`, engine `affixes.ts`): how many a piece rolls
  (`count`) and the pool (`AffixDef`: a stat `key`, `min`, `max`, `step`, the `slots` it may roll on — all when
  none —, a `weight`, 1 when none). The game's table is content `trophies.ts` `AFFIX_TABLE`: four of thirteen
  (attack, defence, critical chance and damage, dodge, health per hit, cooldowns, experience, stealth, standing
  one's ground, perception, move speed only on the feet, waist, shoulders, body and ear, attack speed only on the
  weapon, hands, ring, ear and off hand); attack, health per hit, stealth, perception and the rest weigh less.
- **Rolled once, as the piece is made in the world** (`rollAffixes`): crafted (`craft`, for a made thing with a
  slot), dropped as a trophy (below), restocked by a merchant (the society module's `restock`), or laid on a map
  (content `items.ts` `makeItem`). Each different one from the pool by weight, a value in its range on its step,
  kept as a `sub:<key>` prop. A piece that already carries affixes never rolls again (`hasAffixes`). What the
  author makes as written rolls none: a profession's first weapon (`makeItem` with `trait: false`), a quest's
  named reward gear.
- **Counted while worn**: `World.stat` adds `sub:<key>` of every worn piece, the weapon kept in the main hand
  included, and of a weapon held in hand that is not the worn one. What lies in the bag counts nothing.
- **Intended** (in progress): a piece rolls from a seed of its own rather than from the world's random stream.

## 2. Monster trophies

- **Each kind of monster names its own piece of gear**: its type's `trophy` (the piece's type, under a wearable
  form that gives its slot and picture) and `trophyChance`. The game's are content `trophies.ts` `TROPHIES`, one
  per kind: a common kind 4 %, a stronger one 10 %, a boss's sure; main stats fixed in the piece's props.
- **The drop**: whoever fells the creature hears of it (`combat/defeat`) and answers with the `trophy` primitive:
  by the chance, or surely once it has felled `params.trophyPity` (50 by default) of that kind without one. The
  count is the striker's own (prop `trophy.<type>`), raised by each felling that brings nothing and reset when the
  piece comes. The piece is made in the striker's bag and rolls its affixes like any other; the tooltip names the
  kind whose trophy it is.
- **Intended** (in progress): the primitive moves from the kernel into a `loot` module (`packages/modules`), and a
  trophy is only a type that some creature type names — no list of trophies the engine knows.

## 3. Sets

- **The world's sets** (`Ontology.sets`, `GearSet`): an id, a name, how many pieces, and its bonuses
  (`{ pieces, props, text }`). A piece carries its set as its prop `set`.
- **Counted by slot**: `World.stat` gathers, for each set, the distinct `slot`s of the worn pieces of it — two
  rings of one set count once — and adds every bonus whose `pieces` the count reaches (the bonuses add up).
- **The profession sets** (content `sets.ts` `SET_DEFS`, after Dungeon Fighter): each of the four professions has
  eleven pieces, forged at an anvil with a smith's hammer carried (`SET_RECIPES`: the set's level, the Jeweler for
  jewellery; the first need gives the material). They make two sets (`GEAR_SETS`): the armour (head, shoulders,
  body, hands, waist, feet: bonuses at 2, 4 and 6) and the trinkets (`<id>_trinkets`: neck, ear, ring: at 2 and
  3). The weapon and the off hand are in no set; they are the profession's own (their forms' `profession:`
  tags), the rest anyone may wear. New forms for them: the jerkin, the robe, and three off hands (the parrying
  dagger, the quiver, the tome).
- **The monster sets** (content `trophies.ts` `TROPHY_SETS`): each family's trophies make an armour or a trinket
  set by the same rules; two bosses' pieces stand alone, stronger, in none.
- (First built 2026-10-11 as one set of twelve pieces per profession, the weapon among them, with bonuses at 3, 6,
  9 and 12 pieces counted per piece; split into armour and trinkets, counted by slot, 2026-10-12.)

## 4. Where it lives

Engine: `affixes.ts`, `World.stat` (`world.ts`), the `trophy` primitive and `craft` (`effects.ts`), the types
(`types.ts`: `AffixTable`, `GearSet`, `WorldParams.trophyPity`). Modules: `society` `restock`. Content:
`trophies.ts`, `sets.ts`, `items.ts`, the trophy and chance on each kind (`ontology.ts`). Runtime: the tooltip's
affixes, trophy line and set lines lit by the count worn (`ui/tooltip.ts`). Tests:
`games/openworld/tools/test/trophies.test.ts`.
