# Patch statuses, ingredient counts and the economy check have gaps that let invalid or exploitable content through

## What is wrong

Four related problems were found in review.

1. **A patch can redefine an existing status.** A patch that brings a status with the same id as one already in the base ontology, in the shared library, or earlier in the same patch is accepted even if its definition differs. Accepting it silently changes the behaviour of entities that already have the status (for example an actor that is already `frozen`). Comparing definitions for "identical" is also sensitive to object key order, so a harmless reordering is not recognised as the same definition.

2. **Counts are not properly validated.**
   - A new type's makeup count is only checked to be a number above 0, so fractional, `NaN`, `Infinity` and unsafe huge values pass. The check also reads the type's declared makeup rather than its resolved makeup.
   - At execution, `craft` with a recipe whose ingredient count is invalid (fractional, zero, negative, non-finite, beyond the safe integer range) proceeds and can consume nothing while still making the product.

3. **The economy ("nothing from nothing") check has blind spots.** It examines each rule in isolation, so:
   - an emit whose receivers answer it with spawns is not composed with those answers, so a sender that is used up and a receiver that produces more than was taken goes undetected (whether the receiver is defined in the library or in the same patch);
   - rules hosted by a class or by tags (not a single type) are not expanded to the types they match;
   - a host that is used up is only counted if it is an item, not other kinds of host (e.g. a fixture);
   - a breakable type's own `broken` (threshold/cross) rule is not treated as its break step, so a new fixture whose broken rule yields more than it is made from, or which remains as a spent host after breaking, is missed;
   - adding a new receiver does not re-evaluate an already committed sender whose conversion it changes;
   - paths that cannot be modelled are silent, and gaps that already existed in the base library would be blamed on a patch.

4. **The simplex and free-lunch/price calculations are scale-sensitive.** Fixed absolute tolerances mean that very small or very large coefficients are treated as zero or dropped, so a tiny but necessary step can vanish from a returned mix, and a tiny positive cost with no source can be wrongly called a free lunch. Results are not verified against the original constraints.

## Expected behaviour

**Statuses**
- A status artifact whose id already exists (base ontology, shared library, or an earlier status artifact in the same patch) with a different definition is rejected with an error like `artifact[i]: status "<id>" already exists with a different definition`. The existing state is not changed.
- An identical definition is accepted, including when object keys are in a different order (also within nested objects such as `props`).

**Counts**
- Makeup counts must be positive safe integers; otherwise the error for `makeup[i].count` says it must be a positive safe integer. `chance` remains a separate field; `{count: 1, chance: 0.5}` is valid.
- Invalid makeup counts are judged on the type's resolved makeup.
- `craft` on a recipe with any invalid need count does nothing: nothing is consumed and nothing is made. A valid recipe with count 1 consumes one ingredient per craft and makes one product.

**Economy**
- An emit is composed with the answers of its receivers (library-defined or patched), so a sender that takes one thing and whose receiver spawns more than it took is a free lunch (count 2 fails; count 1 passes). Chances on a later emit are weighed in without duplicating the input; a chance of 0.5 passes where 1 fails in a relay chain.
- Rule hosts given as a tag or a parent class are expanded to every type they match; the steps for such a rule take the converted item type.
- A host of any kind that is used up is counted as taken.
- A breakable type's own `broken` rule gives its break step, including when the host remains after breaking (spent host), and a new fixture's own rule is included.
- A new receiver re-checks an already committed sender.
- A path that cannot be modelled (e.g. emit to an area with a chance, receivers that cannot be counted) yields a warning of the form `economy: <path>: … not modelled; the economy proof covers only extracted conversions`. Warnings are not errors. Only warnings that a patch adds are reported, not those already present with the existing library. A fair conversion produces no economy warnings.
- If the check cannot be certified, the patch is refused with an error that says the conversions could not be verified.

**Simplex / free lunch / prices**
- Results are unaffected by scaling rows, columns or the objective (from 1e-12 to 1e12): the solution, value and dual keep the same meaning in the original units.
- A tiny but necessary step (e.g. 1 unit of an input made from 1e10) stays in the returned mix.
- A positive input with no source is never a free lunch however small (1e-12 … 1e10); `prices` returns valid prices for it. A genuine tiny cycle is still found.
- Malformed programmes (non-finite or non-rectangular) are rejected. `simplexMax([], [], [1])` is unbounded; `simplexMax([[]], [1], [])` gives `{x: [], y: [0], value: 0}`.
- The solution, the dual and the optimum are verified against the original constraints; if they cannot be certified an error is thrown.

## Requirements

- Status redefinition is rejected as above; identical definitions (key-order independent) are accepted, and `alreadyHeld` uses the same equality for statuses.
- Makeup counts and recipe counts are positive safe integers; crafting with an invalid count is refused with no effect.
- `economySteps` and `ruleSteps` follow a rule through the impulses it emits, using the receivers' defined and patched answers, expanding class/tag hosts, treating any used-up host as taken, and treating a breakable type's `broken` rule as its break step.
- Unmodelled paths are reported as warnings; `WorldLibrary.validate` returns them in `warnings`, only those new with the patch, and does not fail the patch for them.
- `validate` still fails with an economy error for a real free lunch the patch introduces, and when the check cannot verify the conversions.
- Existing rules whose conversions change because of a new patch are re-evaluated.
- The simplex solves in balanced units and certifies results against the original constraints.
- Existing behaviour that is not described here is preserved.

## Interface

- `economySteps(onto: Ontology, rules: Rule[], recovery: number, warnings?: string[]): Step[]` in `packages/modder/src/economy.ts` — new optional `warnings` array that receives unmodelled-path messages.
- `ruleSteps(rule: Rule, onto: Ontology, rules?: Rule[], warnings?: string[]): Step[]` in `packages/modder/src/economy.ts` — `rules` defaults to `[rule]`; `warnings` as above.
- `WorldLibrary.validate(...)` result carries economy `warnings` in its `warnings` list (strings starting with `economy:`).
