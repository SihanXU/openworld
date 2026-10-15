# Active skills, a skill bar, skill sources, and death that leaves a bundle

## What is wanted

The game has only passive skills in its tree. We want **active skills** the player casts, and the supporting systems around them.

1. **Twenty active skills.** Everyone has four: Whirlwind, Cleave, Gale Step, Mend. Each of the four professions (assassin, warrior, ranger, mage) has four more:
   - assassin: shadow-strike, envenom, smoke-bomb, flurry
   - warrior: shield-bash, charge, war-cry, earthsplitter
   - ranger: multishot, leap-shot, piercing-arrow, arrow-rain
   - mage: fireball, frost-nova, chain-lightning, blink
2. **A six-slot skill bar.** A learned active skill goes into the first empty slot by itself. Slots can be set, swapped or emptied. A slot is cast by index. Each cast rests for the skill's cooldown, and the frame shows what is in each slot, its time left, its cooldown and whether it is usable.
3. **Sources of active skills.** A skill may be had from the skill tree, from a skill book read on oneself (no points spent; the book is used up), or from a worn piece whose `skill` prop names it. The engine can list the active skills one currently has and where each comes from.
4. **Death.** On a normal-difficulty rise, what is worn, the weapon in hand and what is important (e.g. the Oath-Thorn) stay with the player. The rest is gathered into a single bundle item left where the player fell. A hand on the bundle, or taking it, gives everything back whole and removes the bundle.
5. **Homestead / client work** (crops, fishing, stall, fish shadows, trainer mark, skill panel UI, bow icon, etc.) accompanies this. Behaviour not described under Expected behaviour below is outside what must be pinned down here.

## Expected behaviour

**Skill bar**
- With 10 skill points: learning a passive skill (`light-footed`) leaves the bar `[null ×6]`. Learning the active `gale-step` puts it in slot 0. Learning passive `strength` changes nothing; learning `cleave` puts it in slot 1.
- Setting `gale-step` into slot 1 swaps: the bar starts `['cleave','gale-step']`. Setting a skill that is not known (`whirlwind`) or is passive (`strength`) returns false. Setting a slot to `null` empties it and returns true.
- Casting slot 0 with Whirlwind known returns true and hurts a slime beside the player. Afterwards the skill's remaining cooldown equals its cooldown (80 ticks for Whirlwind), and the frame's `player.skillbar[0]` is `{ id: 'whirlwind', left: 80, cooldown: 80, usable: true }`. Casting again while resting returns false and does nothing. After 80 ticks the remaining cooldown is 0.
- A skill of another profession than the player's current one is not cast (returns false).
- Each of the twenty skills, cast with a suitable weapon (a bow for ranger skills, a staff for mage skills, bare hand otherwise), does what its name says against slimes:
  - Whirlwind: hurts all enemies around. Cleave: hurts the one in front. Flurry: several quick hits on the one in front.
  - Gale Step: quickens movement (`combat.hasteUntil` in the future). Mend: restores hp. War Cry: `combat.rallyUntil` set; blows taken are lighter and blows dealt heavier. Smoke Bomb: `combat.veilUntil` set; a hostile adjacent creature stops attacking. Envenom: `combat.envenomHits` becomes 5; the next strikes carry a bleed, counting down one per blow.
  - Shadow-strike: hurts a target 3 tiles ahead and leaves the player behind it (the side opposite to where it faces). Charge: rushes to just before a target 3 tiles ahead and hurts it. Shield-bash: hurts and stuns the one in front. Earthsplitter: hurts a line/area ahead.
  - Multishot: hits targets in a spread. Piercing-arrow: hits every enemy along a row. Arrow-rain: hits an area, landing over the following ticks. Leap-shot: hurts the target while the player jumps back two tiles, still facing it.
  - Fireball: hurts a target and one beside it. Frost-nova: hurts and freezes nearby enemies. Chain-lightning: hits a chain of enemies. Blink: moves the player two tiles forward past an obstacle.
- Every cast leaves a positive remaining cooldown.

**Skill books**
- Using a skill book (made by `skillBook(id)` from the item type `item/document/skillbook`) on oneself teaches its skill without spending points, and the book is removed. The engine's known list then contains `{ id: 'whirlwind', source: 'book' }`, and `snapshot(...).player.actives` shows the same.
- A second copy of an already-known skill is not read and stays. A book for another profession's skill (fireball for a non-mage) is not read and stays.
- A book-taught skill can be put on the bar and cast.

**Worn pieces**
- A worn item with prop `skill: 'fireball'` gives that skill whatever the profession; the known list shows `{ id: 'fireball', source: 'gear', item: <itemId> }`. Before wearing, putting it on the bar is refused. After taking the piece off, the slot keeps the skill but the frame shows `usable: false` and casting returns false.

**Death (normal difficulty)**
- After falling and rising, what the player carried (e.g. bread) lies in exactly one `item/misc/bundle` at the place of the fall, whose contents list the carried items, and which is not "dropped" loose.
- A worn helmet, the weapon held in hand, and the Oath-Thorn (`item/relic/oath_thorn`) remain the player's. Unequipped extra weapons go into the bundle.
- Acting on the bundle with `hands`, or `take` (F), from an adjacent tile returns all contents to the player and the bundle no longer exists (and none ends up in the inventory as a bundle).

**Crops**
- Vegetable crops still each have five native-resolution sprite parts (growth stages, produce, seeds); only the garden crops (`GARDEN_CROPS`) additionally ship an `atlas` image.

## Requirements

- Active skills are defined in content and exported as `ACTIVE_SKILLS` (the twenty) and are also present in `SKILLS` / `SKILL_BY_ID`. Each has an `active` definition including a `cooldown` in ticks, and a profession when profession-bound.
- Learning an active skill via the tree auto-places it in the bar's first empty slot; learning passives never does.
- The bar has exactly six slots; `skillbar()` returns six entries of skill id or `null`.
- Setting a skill into a slot where another sits swaps the two. Only skills currently known (tree, book, or worn gear) and active can be set. Setting `null` clears.
- Casting requires: the slot is filled, the skill is currently had, it is not resting, and it matches the player's profession (if it has one). Casting returns whether it took effect.
- A skill's blows are struck with a weapon only; a blow never dresses its target (no use/wear side effects on the target).
- A weapon readied in a main-hand slot (`slot: 'weapon'` pieces) strikes while the hand holds something else; the engine provides `weaponOf` to find the striking weapon.
- Ranged weapons that loose arrows carry a `missile` prop.
- A `fighting` condition applies for five seconds after being struck, striking or chased.
- The Oath-Thorn does not open mid-fight, is bound (not handed to anyone) and is important.
- Death/rise on normal: worn items, the weapon in hand and important items stay; all else goes into one bundle item at the fall site; hands or take unpack it whole.
- Skill book reading goes through `use` on oneself with the book as instrument; known or wrong-profession books are not consumed.
- Homestead content (crops, fishing, stall, fish shadows per `MapData.fish`) exists as described by the commit; Bram stays at his place in Firstlight's drill yard (tag `stationary`) with a trainer mark; older saves adopt the world's schedules and tags.
- The client adds a skill bar (Shift+1–6 to cast, cooldown sweep), a skill panel (U / button) listing every active skill and its source, a `cast` and `setSkill` message pair, twenty code-drawn skill icons, a bow icon and arrow missile art.
- Existing tests keep passing, with the updates the above implies (the crop sprite test, death tests).

## Interface

Engine (`@lsw/engine`, `actives.ts`):
- `castLeft(eng: Engine, e: Entity, skillId: string): number` — ticks of cooldown left (0 when ready).
- `knownActives(eng: Engine, e: Entity): { id: string; source: 'tree' | 'book' | 'gear'; item?: string }[]` — active skills currently had, with source; `item` is the worn piece's id for `gear`.
- `weaponOf` — finds the weapon that strikes (main-hand slot, or held).
- Exported combat helpers used with active effects: `combatDamage(eng, e, amount, attacker, flag)`, `combatDelay(world, e, base, kind)`, `combatStrike(world, attacker, target, power, hits, extra, flag)` returning at least `{ power, bleed }`.
- `Engine.controls`: `setSkill(slot: number, id: string | null): boolean`, `cast(slot: number): boolean`, `skillbar(): (string | null)[]`, `learn(def)` auto-placing actives, `wear(itemId, putOn?)`.
- Entity `combat` fields: `hasteUntil`, `rallyUntil`, `veilUntil`, `envenomHits`.
- Frame: `player.skillbar: ({ id: string; left: number; cooldown: number; usable: boolean } | null)[]` and `player.actives: { id: string; source: 'tree' | 'book' | 'gear'; item?: string }[]`.

Content (`@lsw/content`):
- `ACTIVE_SKILLS`: the twenty active skill definitions.
- `skillBook(skillId: string)`: props for an `item/document/skillbook` item teaching that skill.
- `GARDEN_CROPS`: the illustrated crops (a subset of `VEGETABLE_CROPS`).
- `COIN` (type id of the coin item), item types `item/misc/bundle`, `item/relic/oath_thorn`.

Client: `SkillBar` in `ui/skillbar.ts`, `SkillPanel` in `ui/skillpanel.ts`, `ToWorker` messages `{ t: 'cast'; slot }` and `{ t: 'setSkill'; slot; id }`, `Hud` callback `toggleSkillPanel`.
