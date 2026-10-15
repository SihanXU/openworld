# Each storey builds its own: reach and placement are per-storey, and the ceiling is only laid when chosen

## What is wrong (for a fix) or What is wanted (for a feature)

Today, setting a thing down searches for room: `World.settleZ` starts at a storey and looks upward for the lowest storey where the thing fits and is held. As a result:

- A floor put over walls from below silently climbs to a storey higher and becomes a "ceiling" without the player choosing that.
- A wall put on a wall from below stacks into a taller wall.
- A floor laid on grass can end up a storey up instead of covering the ground.
- A player cannot do anything on the storey above (the open air there is not a thing that can be reached), and the reach of the put/take acts is not tied to a storey.

Wanted: a thing rests on the storey it is set on or nowhere. Each storey is built from its own level. The ceiling (the floor of the storey above) is laid or taken down only when the player explicitly chooses it, never as the default. The open air above the ground is something one can reach and set things in, the way the ground is on the ground's storey.

## Expected behaviour

**Reach.** An actor on storey z reaches, for any actor and any act, its own floor, its volume, and its ceiling (the floor of the storey above), and nothing else. Things on the storey below are out of reach (e.g. a chest at a cell on the ground is not met from a floor one storey up; `take` and `hands` on it give no plan). The open air of a cell above the ground is a reachable target for put and take only, never for E / other acts.

**Where a thing rests (per-storey rules).** Setting a thing on storey z of a cell either puts it on z or refuses; it never moves to another storey. Reasons for refusal:
- *taken*: a space it takes is already occupied there (a floor already laid, a wall already there). A wall put on a wall from below is therefore refused ("Something is there already."); a taller wall is built only from the storey above, by standing on a floor beside it.
- *ground*: a floor laid on the ground (storey 0) covers it, where one can stand on that ground. Laying a floor on grass puts it on storey 0 (the cell's top is then the floor; taking it off shows the grass again). Water, trees, etc. refuse ("A floor cannot be laid on this ground."). Laying a floor under something already standing there (a bed) is allowed; the bed then stands on it.
- *stairs*: stairs keep the storey over them open, so no floor is laid in the ceiling above stairs ("Stairs keep the storey over them open.").
- *unheld*: above the ground, a floor needs walls to hold it (a wall's reach is two cells); a wall or door above the ground needs a wall or door directly under it (on the storey below) that supports. Otherwise: "Nothing would hold it up."

**The ceiling in the chooser.** For put and take, the long-press chooser lists the ceiling over the spot as its last entry (layer `CEILING`, name "The ceiling"). The ceiling is never the default: plain put/take at a spot with a wall meets the wall, not the ceiling. Choosing the ceiling for put lays a floor in the storey above the actor's storey over the aimed cell (the aimed spot on the actor's own storey, regardless of what is there); choosing it for take takes that floor down. The palette preview of an upward placement says "Lay the ceiling" when it is possible.

**A floor that something rests on is not taken.** A floor above the ground with anything else on it (a wall, a bed, someone standing on it) cannot be taken down, either via the chooser or via move effects in rules; what is on it must be taken first. Once it is cleared, the ceiling can be taken down.

**Open air.** A cell on a storey above the ground with no floor laid is open air, a new terrain `air` (type `tile/air`, tag `air`), never on a map; it exists only as a reachable target. Receiving into it takes whatever is set there (a floor laid, a wall set on the wall below). It is not drawn and does not count as a layer for E/hands/other acts, and the coverage tooling should not try to face it on a map.

**Palette.** `previewPlace(type, aim, up?)` and `place(type, aim, facing?, up?)` take an `up` flag meaning "in the ceiling over the aim" (one's storey + 1). When it cannot go there, the reason text is one of the refusals above ("Something is there already.", "There is a floor there already." when a floor is refused because a floor is there, "A floor cannot be laid on this ground.", "Stairs keep the storey over them open.", "Nothing would hold it up."), or "Out of reach." when the aim is beyond carrying reach.

**Prologue text.** The house objective and the "tut_fire" line should say the overhead piece is the ceiling, laid by holding G and choosing "The ceiling" (or R in the build palette).

## Requirements

- `World.settleZ(e, map, x, y, z)` returns `z` if the thing can rest there, else `undefined`; it never searches other storeys.
- A new `World.settleWhy(e, map, x, y, z)` returns the refusal reason (`'taken' | 'ground' | 'stairs' | 'unheld'`) or `undefined` when the thing can rest. Out-of-bounds cells or storeys outside `0..storeys` are `'unheld'`.
- A floor on the ground storey is not refused as `taken` by the ground's own floor; it is refused as `ground` where the ground is solid or liquid, or where a terrain with a volume is.
- A floor above the ground is held only if supporters exist (walls within reach); stairs on the storey below refuse it.
- A non-floor thing above the ground needs a floor on that storey, or (for walls and doors) a supporting wall/door directly beneath.
- `World.bears(e)` is true for a floor above the ground with any other entity on its cell and storey.
- `World.isAir(e)` is true for the open-air entity.
- Put/take through the controls respect `settleWhy` for the thing set on a cell or structure, and refuse to take a floor that `bears`.
- The `move` effect does nothing to a floor that `bears`.
- The ceiling is the last chooser entry for put and take, and is never chosen without `layer === CEILING`.
- Plain `Engine.inReach` for put/take also admits the ceiling (target on storey +1 that is air or a floor) at the same horizontal distance.
- Content: add the `air` terrain, a `core/receive-air` rule for `tile/air` that accepts an item put there, and update the prologue texts.
- The coverage tool does not generate a target for the `air` terrain.
- Existing behaviours that relied on climbing (floor/wall auto-stacking) are replaced by the above.

## Interface

- `CEILING` — `export const CEILING = -1` in `packages/engine/src/controls.ts` (exported from `@lsw/engine`): the chooser layer for the ceiling over a spot.
- `Controls.previewPlace(type: string, aim: Aim, up?: boolean): { ok: boolean; reason: Text; carried: number }` — new optional `up`.
- `Controls.place(type: string, aim: Aim, facing?: Dir, up?: boolean): boolean` — new optional `up`.
- `Controls.plan(key, aim?, layer?)` accepts `CEILING` as `layer` for `'put'` and `'take'`; `Controls.choices(key, aim?)` includes a final `{ layer: CEILING, name: { en: 'The ceiling', zh: '天花板' }, plan }` entry for put and take when it has a plan.
- `World.settleWhy(e: Entity, map: string, x: number, y: number, z?: number): 'taken' | 'ground' | 'stairs' | 'unheld' | undefined` in `packages/engine/src/world.ts`.
- `World.settleZ(e: Entity, map: string, x: number, y: number, z?: number): number | undefined` — semantics changed as above (last parameter is the storey, not a search start).
- `World.bears(e: Entity): boolean`.
- `World.isAir(e: Entity | undefined): boolean`.
- Terrain `air` (entity type `tile/air`, tag `air`, name "空中"/"open air") in `packages/content/src/ontology.ts`.
- Rule `core/receive-air` (host `tile/air`, on `impulse/receive`) in `packages/content/src/rules.ts`.
