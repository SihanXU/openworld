# Player inputs, attacks and bag ignore storeys and real capacity; walls and chosen targets misbehave; dormant maps lose stage timing

## What is wrong

Several independent defects in the engine's player controls, combat and dormant-map handling:

1. **Storeys (z) are dropped.** When the player is on an upper storey (z ≥ 1), many things silently fall back to storey 0: the chosen target of the hands/take/put/use inputs, the pointer's layer stack and chooser, aiming at a distant point, the attack ray and sweep, the reach check against things on another storey, the front cell, the loot magnet, and dropping an item from the menu. A blow on storey 1 can land on a creature on storey 0, and loot on the player's own storey is not pulled in. Floors that are placed as things (not terrain) are not treated as the cell's ground on their storey.
2. **Sorting the bag uses the wrong capacity.** Organizing always pads to the default slot count (30) even when the player has a bigger bag (Big Pack: 40), so slots are lost or items are mis-sorted.
3. **Walls and the ray.** A ray stops only at a wall beyond its first cell, so a wall directly ahead does not stop a shot, and a ranged blow reaches past it.
4. **Chosen targets.** A blow aimed at a chosen target (for example a thing in the bag, or a creature announced by a plan) can strike somebody else on the ray, or strike something that is out of reach or off the ray. A ranged weapon aimed at distance 0 does nothing sensible.
5. **Dormant map catch-up.** When a map that was dormant becomes active again, its stage timers are not caught up as if the map had been active. A timer's following stage should start from its scheduled deadline, not from the current tick, and timers that come due during the catch-up (including those scheduled by the catch-up itself) must also be processed, without any possibility of looping forever.

## Expected behaviour

**Storeys**
- With the player on z=1 and equivalent targets at z=0 and z=1 on the cell ahead, `hands`, `take` and `put` plans choose the z=1 target, with the plan position at z=1, and running them acts on that one only.
- `layers` for a cell on z=1 lists only things on z=1 (a z=1 stick, then the z=1 floor), ignoring stack entries from other storeys. `choices` and `plan` for `take` agree. `aim` with a pointer far beyond reach steps back to a spot that keeps z=1.
- Space (strike) and a pointed `use` blow, with or without a ranged weapon, hit only the z=1 creature ahead; the z=0 one is untouched. A sweep hits only creatures of its own storey.
- A ranged ray on z=1 that finds nothing ends at the floor of its last cell on its own storey (not on a ground cell of storey 0).
- `front` of the player keeps z. `distance` between things on different storeys is undefined. `inReach` is false for every verb against a thing on another storey, including something carried by a creature there. `playerAttack` against such a target strikes nothing.
- The magnet pulls dropped loot on the player's own storey only.
- Dropping from the menu puts the item on the floor in front of the player, on the player's storey.

**Bag**
- Organizing with 30, 31 or 40 stacks (after learning Big Pack) leaves 40 slots, every stack present in a slot, and the set of carried items unchanged.

**Walls and ranged blows**
- A wall 1 or 2 tiles ahead stops Space and a chosen shot at a target behind it: the target is not hurt; for Space the struck thing is the wall's own cell (the one the wall makes up on top).
- An open ray still hits the first body ahead.
- Using a bow, wand or staff on a thing in the bag keeps the plan's announced target: the blow strikes exactly that thing, and a creature in front is not hit.
- A chosen target off the ray is refused; nobody else is struck. A closer body on the ray does not replace the target announced by a plan.

**Dormant timers**
- A hen on a dormant map for three laying periods yields the same eggs and the same next deadline as on an active map (3 eggs, next deadline 7200, tick 5401 in the test setup).
- A thing with chained stages (10 → 20 → 40 ticks, the last yielding an egg) returning to an active map at tick 111 ends in the last stage with its stage deadline 150 and the earlier yields made, and the clock is left at 111. This holds also when entry happens inside the event queue.
- With a condition-waiting stage and another cycling stage, timers are processed in time order. Each timer event carries its scheduled deadline in its params as `at`; the waiting stage's re-check is scheduled from that deadline.
- A stage whose condition is unmet with a wait of 0 cannot make entry loop forever: the catch-up is bounded.

## Requirements

- Z is preserved everywhere listed above: targeting, ray, sweep, magnet, `front`, `distance`, `cellTop`, `cellRef`, `layers`, and the pointer/aim functions.
- A floor thing counts as a cell's ground, alongside terrain, for `cellTop`, `cellRef` and `layers`.
- Bag organizing uses the player's actual slot count.
- A ray is stopped by a wall in its first cell; the blow then reaches that wall's own rules.
- A blow with a chosen target strikes that target or nothing. A target that is not in reach, has no position, or is not on the ray for a ranged weapon is refused. A ranged weapon may strike a target at distance 0. No bolt effect is shown when the ray has zero length.
- Dormant catch-up repeatedly takes the earliest due timer on the map, processes its whole event chain, then looks again, at most a bounded number of times (the existing event budget).
- A `time/timer` event carries `at` (the scheduled deadline) in its params. Stage changes and stage re-arming (`grow`, `transform`, stage start) compute from `at` when present, otherwise from the current tick.
- Active-map behaviour is unchanged.

## Interface

- `World.cellTop(map: string, x: number, y: number, z?: number): Entity | undefined` in `packages/engine/src/world.ts` (z defaults to 0).
- `World.cellRef(map: string, x: number, y: number, z?: number): Ref` in `packages/engine/src/world.ts` (z defaults to 0).
- `World.transform(e: Entity, type: string, at?: number): void` in `packages/engine/src/world.ts` (`at` defaults to the current tick).
- `time/timer` event params gain a numeric `at` field (the scheduled deadline); the `grow` effect reads it. No other new public names.
