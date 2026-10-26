# No endless yield: a repeated event must stop making things, and new breakable things must say what they are made of

## What is wrong

A "stick farm" exists. An event someone can repeat at will (for example a blow on a stump or a statue) can spawn an item each time while the host stays exactly as it was. The player or an AI-authored patch can repeat it with no time between and get unlimited items from nothing. The validator has no check for this, and the AI that writes patches is not told the rule. The base library itself has one case: fishing yields a fish with no cost to the water, so it can be repeated endlessly.

Related gaps:

- A newly authored type that can break (has `props.maxHp`) is not required to say what it is made of or what it leaves when it breaks.
- Requests shown to the AI do not say what each role is made of or what it leaves.
- Stored patches that already make something from nothing cannot be found.

## Expected behaviour

**Repeat check.**
- Take the triggering event of a patch's scenario and replay it 12 times in a row with no time passing between replays.
- Count, for each replay, the new things made. Things that are cells (terrain-cell entities) do not count as things made.
- Stop counting if the host no longer exists.
- It is an endless yield if all 12 replays ran, the host still stands at the end, and at least one of the last 4 replays made something.
- The check applies only to events someone can repeat at will: `act`, `impulse`, `contact`, `bump`, `seen`, including their sub-kinds such as `impulse/strike`. Clock events, threshold events and the like are never judged.
- `validatePatch` runs this check on every patch that comes with a scenario. When it fails, it reports an error containing the words "endless yield" and tells the author that a yield must cost its host (a status that gates the yield and runs out, durability, or using the host up).
- Example refused: a rule on a statue, on `impulse/strike`, that just spawns a stick each time.
- Example accepted: the same rule gated by `not has host status` that adds a status after yielding. The status stops further yields, so there is no endless-yield error.

**New types.**
- Validating a new type (including what it inherits) that has `props.maxHp` requires:
  - `props.material`, naming a known material. Otherwise the error mentions `props.material`. An unknown name gives an error saying it is "not a material".
  - A makeup (a list of `{type, count, chance?}`) or a rule of its own on `threshold/cross` hosted by that type. Otherwise the error mentions `makeup`.
- Every makeup part must name an existing type (known, or defined in the same patch) and have a count above 0.
- A type without `maxHp` needs neither material nor makeup.
- A type with `maxHp`, a known material and a valid makeup produces no material or makeup error.

**Base library fishing.**
- Casting a line into water stirs the water. A new status, `stirred`, lasts 100 ticks. While the water is stirred, fishing gives only a "stirred up, let it settle" message and yields nothing, with a splash.
- A cast that catches a fish, and a cast that catches nothing, both stir the water.
- Over every act any input can make, on everything the player can face, with each hand and verb, no base-library act that yields anything keeps yielding when repeated. The set of acts that do yield is not trivial (felling, mining, harvesting, splitting, fishing and so on).

**Information for the AI.**
- The authoring rules in the ModSpec state the yield rule (the validator replays the event 12 times with no time between and refuses an endless yield; change the host or use it up) and state that things with durability already lose it to blows and fire and break into their makeup. They also say a new breakable type must name its material and what it leaves.
- Entity information in requests includes each role's material (id, category, hardness) and its makeup.

**Modder tooling.**
- A library audit lists stored patch rules that make something from nothing. It replays each one's recorded regression scenario and reports it if it is an endless yield. Scenarios that can no longer be built are skipped.
- The modder CLI has `library audit`. It prints one line per offending rule with the reason, then a summary of how many patch rules there are, how many have a recorded event, and how many need review. It removes nothing.

## Requirements

- The repeat check is exposed so that it can be run on any engine and event. The base-library sweep and the validator use the same check.
- Replaying must not disturb the real world. It runs on a replayed copy.
- Event kinds not listed above never count as endless yield.
- The validator's existing replay errors are unchanged. The new error is added on top.
- Existing fixtures that spawn on every repeat must be changed to gate the yield (for instance by adding a status the host then has), so they still pass the repeat check.
- The audit never deletes or edits a stored patch.

## Interface

In the engine package (exported from `@lsw/engine`, from `sandbox.ts`):

- `repeatYields(eng: Engine, ev: GameEvent, times?: number): number[]`
  - Queues and flushes `ev` up to `times` times (default 12) on `eng`.
  - Stops early if the host is gone.
  - Returns, for each replay, how many new non-cell entities now exist.
- `endlessYield(eng: Engine, ev: GameEvent): boolean`
  - As described under "Repeat check".
- `REPEAT_TIMES = 12`
- `REPEAT_TAIL = 4`
- `REPEATABLE: string[]`
  - The repeatable event kinds: `['act', 'impulse', 'contact', 'bump', 'seen']`.
- `scenarioEvent(sc, eng)` is used by the validator and the audit, so it must be exported from the engine package.

In the engine's `mod.ts`:

- `EntityInfo` gains optional `material?: { id: string; category: string; hardness: number }` and `makeup?: { type: string; count: number; chance?: number }[]`.

In the modder package:

- `WorldLibrary.audit(): { rule: string; reason: string }[]`
- CLI: `library audit`

In the content package:

- A new status `stirred` (`{ en: 'stirred up', zh: '搅浑' }`, duration 100).
- The `core/fish` rule is gated on `stirred`.
