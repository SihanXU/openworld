# Combat by what things are made of: material and quality factors, wearable gear, resistances, and bodies that break down

## What is wanted

Combat should depend on what things are made of and what they wear.

1. **Factors.** A material has an attack factor and a defence factor, and a quality has a single factor. A thing's power (weapons, tools) and its defence (armour) come from its form's number multiplied by those factors. This applies to things made through the recipe/`madeOf` path and to the item catalogue's generated items alike. Today materials add a flat bonus instead.
2. **Wearing.** Armour and clothing become wearable and have a slot (helmet and hat: head; shield: arm; breastplate: body; cloak: back; boots: feet; gloves: hands). The wearer puts the thing on by offering it to themselves. Only one thing fits in a slot; putting on a second thing in an occupied slot removes the first. Offering a thing already worn takes it off. Armour adds its defence while worn.
3. **Stats.** An actor's effective stat is its own number plus what its statuses add plus what it wears. Attack, defence and the resistances all read this effective stat.
4. **Resistances.** Each element names a resistance stat (a percentage). Harm done in answer to an element counts as that element's harm. The resistance takes its share away: 0 takes nothing, 100 takes all of it, and a negative value makes the harm greater. Fireproof stops being a special case in the engine and becomes a status that adds a fire resistance of 75.
5. **Bodies break down.** Actors take blows the way anything with durability does. At no health, a non-essential creature breaks down into its makeup instead of simply vanishing, and spills what it carried. Both the makeup and the spilled items lie still on the ground, so they are picked up deliberately and not drawn in by the magnet. The cow and the chicken get a makeup in place of their old drop/drops props, and the cyclops's ore becomes something it carries and spills as loot, not a drop prop.
6. **Client.** Slots in the bag and toolbar that hold a worn item show a worn mark.

## Expected behaviour

Power is `round(form power × material attack × quality factor)`, at least 1. Defence is the same with the defence factor. Examples:
- Sword: wooden → 3, iron → 6, crude iron → 5, fine iron → 8.
- Helmet (defence 1 in the form): iron → 2. Breastplate (defence 3): leather → 3.

Wearing:
- Offering an iron helmet to oneself sets `wear:head` to the helmet's id. Defence rises by 2, so a blow of 6 on the player does 4 damage.
- Offering a hat while the helmet is on puts the hat in `wear:head`. The helmet comes off, and defence drops to 0 for a cloth hat.
- Offering the worn item again removes it, and `wear:head` is unset.
- A worn item that is no longer in the wearer's bag or hand (dropped on the ground, say) counts for nothing.
- Only things marked wearable that have a slot can be worn. Only the wearer's own things can be worn.

Resistances (with piercing blows, so defence is out of the picture):
- 8 fire damage does 8 without protection. With fireproof it does 2. Ice damage is unaffected at 8.
- Fireproof (75) plus a worn cloak with 25 fire resistance gives a total of 100, so fire does 0.
- Resistance is capped at 100 for the purpose of reducing harm.

Defeat:
- When the cyclops falls, the two iron ore it carried lie on its tile and are not flagged as dropped (so the magnet leaves them for the player to pick up). Cows and chickens leave their makeup the same way.
- Essential actors (people, the player) still go down for a while and are not broken down.

## Requirements

- Materials have `attack` and `defence` factors in place of the flat `power`. Qualities have a `factor` in place of the flat `power`. The factors keep the existing ordering, e.g. iron stronger than wood and fine stronger than crude, with the numbers above for the cases listed.
- Power and defence are computed in one shared place, used both by `madeOf` and by the item catalogue's item generation, so the two give the same results for the same form, material and quality.
- Armour forms carry a `def` prop in place of the old `armor` prop. Armour and clothing forms are tagged wearable and have a `slot` prop.
- A rule on actors lets a wearable item that is offered to its own holder be worn or taken off, via a new `wear` effect primitive. The effect records the item in the actor's `wear:<slot>` prop and logs that the item was put on or taken off.
- `World` provides a stat read that combines own number, status props and worn items. The attack used for strikes, the defence applied to blows, and the resistances all use it.
- Statuses can declare props that they add to their holder's stats. The ontology can declare each element's resistance stat. The content names `resFire`, `resWater`, `resIce`, `resLightning`, `resWind` and `resEarth` for the six elements.
- The `fireproof` status adds `resFire` 75. The engine's special case for fireproof is removed. Fireproof's other behaviour (clearing and warding burning, duration) stays.
- The `hurt` effect uses the element of an `impulse/element` event when the effect does not set one itself. A blow whose resisted amount falls to 0 or below does nothing.
- Strikes on an actor are treated as blows, i.e. `hurt` with `blow` set, including the shattering of a frozen actor.
- `breakdown` accepts an option that leaves what it produces and spills lying still (not flagged as dropped). The defeat rule for non-essential actors uses it in place of destroying the actor and spawning drops. The defeat notifications to the killer and to the story still happen.
- The snapshot's bag slots report `worn` when any item of the stack is worn. The client shows a worn mark on bag and toolbar slots.
- The demo's cyclops carries the ore it hoarded in the mine, which it spills when it falls.
- The engine docs and primitive list describe `wear` and the changed `hurt` and `breakdown`.

## Interface

In `packages/engine/src/recipes.ts` (exported from `@lsw/engine`):
- `gearProps(form: Record<string, PropValue>, m?: MaterialDef, q?: QualityDef): Record<string, number>`: returns `power` and/or `def` computed from the form's numbers, the material's `attack`/`defence` and the quality's `factor`. Each is rounded and at least 1, and absent when the form has no such number.

In `packages/engine/src/types.ts`:
- `MaterialDef.attack?: number` and `MaterialDef.defence?: number` (factors, 1 when absent). `MaterialDef.power` is removed.
- `QualityDef.factor: number`. `QualityDef.power` is removed.
- `StatusDef.props?: Record<string, number>`: stat additions while the status is held.
- `Ontology.resistances?: Record<string, string>`: element → resistance stat name.
- `Effect` gains `{ op: 'wear' }`. `{ op: 'breakdown' }` becomes `{ op: 'breakdown'; still?: boolean }`.

In `packages/engine/src/world.ts` (`World`):
- `stat(e: Entity, key: string, dflt?: number): number`: own number plus statuses' props plus worn items' numbers.
- `worn(e: Entity): Entity[]`: the things named by the entity's `wear:<slot>` props that it still holds (in its bag or hand).

In `packages/engine/src/snapshot.ts`:
- `Frame['player']['slots']` entries gain an optional `worn?: boolean`.

In `packages/content/src/items.ts`:
- `Material` gains `attack` and `defence` in place of `power`. `QUALITIES` entries have `factor` in place of `power`.

Content:
- Rule `body/wear` (host: any actor, on `impulse/offered`) running the `wear` effect.
- Prop names: `wear:<slot>` on the wearer, `slot` on wearable items, `def` on armour, and the resistance stats `resFire`, `resWater`, `resIce`, `resLightning`, `resWind`, `resEarth`.
