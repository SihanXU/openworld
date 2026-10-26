# Deepen each profession's skill tree to twenty-two nodes: new active skills, enhancements, talents and capstones

## What is wanted

Each of the four professions (assassin, warrior, ranger, mage) currently has a tree of ten nodes (six talents, four active skills). Each tree should grow to twenty-two nodes with the following shape:

- **Three new active skills** per profession, the third of each an **ultimate** costing two points and joining two arms of the tree.
- **Five enhancements** per profession: talents that do not stand alone but add their numbers to one of the profession's active skills whenever that skill is cast.
- **Three new talents** of the profession's own.
- **One capstone** talent costing two points and joining two arms, which answers what the tree has become.

The engine needs the machinery these nodes call for: new kinds of cast, extra numbers on existing kinds, talents that respond to a creature being defeated, and a cooldown-reduction stat. The skill-tree ring layout must also cope with the crowding that the deeper trees bring. One existing talent, Fortitude, should change meaning (see below).

The new content, by profession:

**Assassin**
- Actives: Throwing Knives (a single shot at the first foe ahead, 5 cells); Fan of Knives (hits every foe on the eight surrounding cells and makes them bleed); Vanishing Strikes (ultimate: steps behind up to 3 foes within 5 cells in turn, striking each).
- Enhancements: Shadow Strike (cooldown −3 s, reach +2), Envenom (+3 poisoned blows), Smoke Bomb (+2 s), Flurry (+2 stabs), Fan of Knives (power +0.3).
- Talents: Venom Mastery (dagger: +20% damage to a bleeding target), Nightstalker (dagger: +15% damage at night), Nimble Blade (dagger in hand: dodge +8%).
- Capstone: Master Assassin — whenever you fell a creature, Shadow Strike is ready again at once.

**Warrior**
- Actives: Wide Slash (one sweep across the three cells ahead); Iron Guard (3 s of combat damage taken −60%, but movement is slower); Heaven Splitter (ultimate: a blow down the 5×3 cells ahead, stunning what it strikes).
- Enhancements: Shield Bash (stun +1 s), Charge (+2 cells), War Cry (+3 s), Earthsplitter (power +0.4), Wide Slash (power +0.4).
- Talents: Shield Wall (shield worn: block +5%), Bloodthirst (on felling a creature, mend 5% of max health), Fortitude (see below).
- Capstone: Undying Spirit — whenever you fell a creature, every skill's cooldown comes 1 s nearer to ready.

**Ranger**
- Actives: Concussive Shot (a shot that stuns the first foe in line for 1 s); Hawk Eye (5 s: a shooting weapon reaches 3 cells farther, critical chance +20%); Arrow Storm (ultimate: five arrows side by side, each passing through every foe in its line).
- Enhancements: Multishot (+2 arrows), Leap Shot (+1 cell back, cooldown −2 s), Piercing Arrow (power +0.5), Arrow Rain (+2 volleys), Concussive Shot (stun +1 s).
- Talents: Light Gear (movement speed +10%), Deadly Shot (bow: critical damage +25%), Windwalker (bow in hand: dodge +5%).
- Capstone: Marksman — each cast that hits brings the caster's other skills 0.5 s nearer to ready.

**Mage**
- Actives: Frost Bolt (an ice shot that freezes the first foe ahead for 1 s); Thunderstorm (lightning falls on the 3×3 around the first foe ahead, once a second for 3 rounds); Meteor (ultimate: strikes the first thing ahead and burns the 5×5 around it, fire).
- Enhancements: Fireball (power +0.5), Frost Nova (radius +1), Chain Lightning (+2 targets), Blink (+2 cells, cooldown −3 s), Frost Bolt (frozen +1 s).
- Talents: Mana Surge (every skill's cooldown −10%), Elementalist (what carries an element strikes 15% harder: a staff with an element, an element's spell), Arcane Barrier (max health +10).
- Capstone: Elemental Master — every third skill cast does not go on cooldown.

**Fortitude (changed).** It no longer adds health. Instead, control effects that hold the bearer still (stun, freeze, kneeling) delivered by a blow last half as long. Without this the Boss Challenge's warrior beats the White Knight while ignoring every warning.

## Expected behaviour

- A skill cast by someone who knows enhancements for it uses its base numbers plus the enhancements' additions (cooldown, power, range, count, ticks, radius). Enhancements for skills the caster does not know, or not learned, have no effect. Cooldowns stay at least 5 ticks, and the caster's cooldown reduction (the `cdr` stat) shortens every cast's cooldown by that fraction, capped at half.
- Shadow Strike with Mastery has cooldown 30 ticks lower and range 2 greater than without; Mana Surge with `cdr` 0.1 makes a 100-tick cooldown 90.
- Elemental Master: casts 1 and 2 of a skill rest as usual; the third cast leaves it immediately castable again. Counting is per caster across all skills.
- Marksman: a cast that damages at least one foe shortens every other skill's remaining cooldown by 5 ticks (not below zero, not the skill just cast). A cast that hits nothing does nothing.
- A defeat (the caster's blow felled a creature, by a plain attack or by a skill) triggers the caster's defeat talents: Master Assassin resets Shadow Strike's cooldown to ready; Undying Spirit shortens every active skill's remaining cooldown by 10 ticks; Bloodthirst restores 5% of max health (at least 1) when the caster is below max.
- Iron Guard: while active, damage taken is ×0.4 and move delay ×1.5. Hawk Eye: while active, a weapon whose range exceeds 1 reaches 3 further and the caster's critical chance is +0.2.
- Throwing Knives and Concussive Shot are shots hitting only the first foe in line; Frost Bolt likewise with an ice bolt and freeze. Wide Slash hits the cell ahead and the two beside it. Heaven Splitter hits a 3-wide, 5-deep strip with stun. Arrow Storm's arrows, when "through", strike every foe in their line, five lines wide. Vanishing Strikes strikes up to `count` foes in turn and succeeds if at least one was struck. Fan of Knives applies bleeding to each foe hit. Thunderstorm rains lightning-element volleys; Meteor has a blast of radius 2 (a 5×5).
- Venom Mastery, Nightstalker and Elementalist raise damage as described; Deadly Shot raises critical damage by 0.25; Nimble Blade and Windwalker add dodge only when the wielded weapon is the caster's own profession weapon; Shield Wall adds 0.05 to block (still capped).
- Fortitude: a stun/freeze/kneel arriving with a blow lasts half the stated ticks (at least 1) for a bearer of `skill:fortitude`; other afflictions are unaffected.
- Skill layout: on each ring of a branch (same branch and depth), icons closer than a minimum gap (76 px along the ring) are nudged apart, keeping their order, so the deep trees fit without overlap.
- Art: each new skill has an icon key registered; the thrown-knife projectile has a catalog entry.

## Requirements

- Each profession has exactly 22 nodes of its own: 7 active skills (one ultimate with cost 2 and two requirements), 5 enhancements (`modifies` each naming that profession's own active skill), and, among the rest, a capstone of cost 2 with two requirements. At least three nodes per profession have cost 2 and two requirements.
- Total skills for the assassin on the combat branches: 42 shared non-active talents, 22 profession nodes, 11 active skills (everyone's four plus seven).
- Every active skill in the registry can be cast and does what its description says on a field of foes.
- Active-skill cast kinds exist for: shot, arc, guard, aim, slam. Existing kinds accept the new numbers (count on shadow-strike and multishot, radius on fireball, element on rain and shot, bleed on whirlwind, `through` on multishot).
- Damage talents apply only under the stated conditions (dagger, night, bleeding target, element, bow).
- Defeats are counted per striker so talents can answer them, whether the blow came from a skill or a plain attack.
- Fortitude no longer grants max health.
- Existing skills and cast behaviour not mentioned remain unchanged.
- Wiki profession pages and the skill page are updated to reflect the new trees.

## Interface

In `packages/content/src/skills.ts`:
- `PROFESSION_DEEPER: SkillDef[]` — the new nodes; included in the registry (`SKILLS`) alongside `ACTIVE_SKILLS`.

`SkillDef` gains:
- `modifies?: { skill: string; cooldown?: number; power?: number; range?: number; count?: number; ticks?: number; radius?: number }` — an enhancement.
- Existing `grant` stats accept `cdr`, and talents may grant `moveHaste`, `maxHp`.

`ActiveDef` gains:
- New `kind` values: `'shot' | 'arc' | 'guard' | 'aim' | 'slam'`.
- Optional fields: `missile?: string`, `element?: string`, `radius?: number`, `through?: boolean`, `bleed?: number`.

In `packages/engine/src/actives.ts` (exported from `@lsw/engine`):
- `effectiveActive(eng: Engine, e: Entity, def: SkillDef): ActiveDef` — the skill as this caster casts it, with learned enhancements added and cooldown reduced by `cdr`.
- `castCooldown(eng: Engine, e: Entity, id: string): number` — ticks the skill rests after a cast by this caster (0 if the skill is not active).
- `onDefeat(eng: Engine, a: Entity): void` — applies the defeat talents of the striker.

Entity combat state gains fields used by the above: `ironUntil`, `aimUntil` (tick numbers), `casts`, `defeats` (counters).

`packages/engine` exports `TICKS_PER_HOUR` (if not already exported).

Client: `SKILL_ART_KEYS` gains the 48 new icon keys; the asset catalog gains `'missile:knife'`.
