# Make the modder's patch checks explore chance per site, replay the full scenario, land falls beside bodies on the right storey, and return `covered` when a parallel lane filled the hole

## What is wrong

Four defects in the checks on a modder's patches:

1. **Chance in the repeat check.** The repeat check (the "endless yield" check) forces every chance in an outcome to a single boolean, once true and once false. It therefore never tries mixed paths, such as an outer chance that holds while an inner one fails. A patch that yields for free 25% of the time (e.g. nested chances where only the "outer holds, inner fails" path yields) passes. Chance emits and breakdown fractions are also forced rather than explored, and a replay whose triggering event is itself gated by chance can hide the yield on later replays.

2. **Scenario replay loses state that rules read.** A scenario built from a live request (`buildScenario`) and rebuilt in the sandbox drops:
   - carried items that are not roles (a held item, bag contents, nested bags), especially when many loose neighbours are nearby;
   - the instance props of the story and the world;
   - the storey (z) of things and cells, and what stands above a participant (its roof or cover);
   - the type of a cell thing below the top (e.g. a floor turned to water under a tree replays as grass).

   Scenario refs also cannot name a storey.

3. **Falls onto a body.** When a floor collapses and the faller lands on a cell occupied by a body (e.g. a hen) on the landing storey, the search for a free neighbouring cell ignores the storey and drops the faller on storey 0. Floors are skipped and fall damage is under-charged.

4. **Parallel lanes.** If another lane's design fills the same hole while a request is still being designed, the second request's design ties with the first in validation, enters repair, and fails. It should recognise it is covered.

## Expected behaviour

**Chance exploration**
- Each chance site reached during the repeat check gets its own outcome: a chance condition, a chance emit (per receiver and emit), and each breakdown part's fractional chance. The outcome is kept across the repeated replays (12), so the same site gives the same answer each time within one assignment.
- All assignments are explored depth first as sites are discovered. Every alternative starts from the same world.
- Chances of probability 0 are always false and of 1 always true; neither creates a branch.
- Sites that are not reached in a given path create no branches.
- At most 64 complete assignments are explored. A check needing more is refused as unproven, with an error that mentions the repeat check, the 64 limit, chance assignments, and that safety could not be established. Exactly 64 safe assignments is accepted. 6 independent `{any:[chance 0.5, chance 1]}` conditions (64 assignments) pass; 7 are refused. 7 independent `{chance: 0.5}` conditions pass, because later sites are unreachable once an earlier one fails.
- The same limit applies in the library audit: a registered rule whose scenario exceeds the bound is reported with that reason instead of being silently skipped.
- Examples that must be refused as endless yields: a nested chance (0.5 then 0.5) whose only yielding path is outer holds / inner fails; a rule whose triggering replay is itself gated by a chance and then sets a status that closes the gate; an emit with a chance and a receiver with its own chance, where only a mixed path yields; a chance emit that fails to fire, leaving a later impulse to yield because a gating prop was never set.
- Breakdown: with chance forced true, the fractional part of a part's expected count produces one extra item; forced false, none.
- Play (no exploration active) still uses ordinary randomness.
- The triggering event's first replay uses the same assignment, so it is explored before it can gate later yields.

**Scenario replay**
- A scenario keeps the closure of what the participants hold: items in hand and in bags (any depth), even when they are not roles and even when more than 12 loose neighbours exist. Holders are placed before their contents regardless of the order of the entity list.
- The story's and world's instance props are kept and restored.
- Things carry their storey (z); cells at other storeys, and lower cell things whose type differs from the terrain rows, are kept with their type and state. A floor turned to water under a tree replays as water, with its statuses (e.g. `wet`).
- What stands above a participant (a floor/volume on a higher storey over it) is kept, so `covered` is true for it in the replay, even among many ground neighbours.
- Refs may name a storey: `tile:x,y,z[:space]`. A cell on storey 1 addressed this way resolves to that cell.
- The spec text shown to the model describes the new scenario shape.

**Falls**
- A fall onto a body lands in a free cell beside it on the *landing* storey (not storey 0). Falling from storey 3 or 4 onto a body on storey 2 lands the faller at a neighbouring free cell on storey 2, leaves the body alone in the original cell, and deals damage by the actual drop: `max(0, drop − safeFall) × fallDamage`, where drop is the distance between the starting storey and the landing storey.

**Lanes**
- When a non-revision request's validation fails, and the library now covers that request (another lane filled the hole meanwhile), the outcome is `covered` with that rule and patch, with no repair rounds. In the case of two parallel lanes with different designs, one is `accepted` and the other `covered`, and only one rule enters the log.

## Requirements

- Chance conditions, chance emits and breakdown fractions each consult one decision per site, via a shared mechanism, rather than a single global boolean.
- The repeat check explores assignments depth first, restoring the same starting world for each, up to 64 assignments; beyond that it throws a dedicated error that validation reports as an error and the library audit reports as a finding.
- Probabilities ≤0 and ≥1 never branch.
- The triggering replay is part of the explored assignment (the validator and audit use a fresh sandbox, not an already-replayed engine).
- Scenario building and filling satisfy everything under "Scenario replay"; a cyclic holding is an error.
- Fall placement uses the landing storey for free-cell search and for damage.
- Pipeline re-checks coverage before entering repair for non-revision requests.
- Existing behaviour is otherwise unchanged (the existing suite and `check:world` results remain as before).

## Interface

All in `@lsw/engine` unless noted.

- `World.chance(site: object, p: number, part?: number): boolean` — in `world.ts`. Without exploration active, returns `rand() < p`; with exploration, 0 → false, 1 → true, else defers to `luck`.
- `World.luck?: (site: object, part: number) => boolean` — in `world.ts`. Changes type from `boolean` to a per-site decision function. A test sets it to `() => true` or `() => false`.
- `REPEAT_ASSIGNMENTS = 64` — constant exported from `sandbox.ts`.
- `class RepeatLimitError extends Error` — exported from `sandbox.ts`. Its message names the repeat check, the 64 limit, chance assignments, and that safety could not be established.
- `endlessYield(eng: Engine, ev: GameEvent, prime?: boolean): boolean` — in `sandbox.ts`; optional `prime` runs the triggering event once, under the same assignment, before the repeated replays. May throw `RepeatLimitError`.
- `Scenario.residents?: Partial<Record<'story' | 'world', Record<string, PropValue>>>` — in `types.ts`.
- `Scenario.cells` entries gain `z?: number` and `type?: string`.
- `ScenarioEntity.z?: number` — in `types.ts`.
- `World.cellTop(map, x, y, z = 0)` — gains an optional storey argument.
- `Engine.nearestFree(p, actor?)` — `p` may carry `z`, and the result keeps it (`{map, x, y, z?}`).
- The `tile:x,y[,z][:space]` ref form is accepted for scenario roles.
- `RepeatLimitError` and `buildSandbox` are used by `@lsw/modder`'s library audit (imported from `@lsw/engine`).
