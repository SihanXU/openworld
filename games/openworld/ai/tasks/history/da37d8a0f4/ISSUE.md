# Learned rules take one leaf of their type's tree; the base answers the general cases

## What is wrong (for a fix) / What is wanted (for a feature)

**Learned rules.** The learned layer answers undefined outcomes by writing class-wide rules (host selectors with tags, branch kinds such as `impulse`, `inherit` leaves, ties among learned rules). This needs replacing:

- Answers pile up one patch at a time per class, and ties, overrides and a "regression set" (a replay of recent acts) are kept to police them.
- Generalization happens inside the learned layer, which is hard to audit and quarantine.

Wanted: a learned rule is **one type's, placed at one open leaf** of that type's own tree for the base hole it fills.

- Its host is exactly `{type: T}`, T being the event host's type. Its `on` is the exact event kind.
- It has a `hole` (the base hole it fills) and an `at` (the path to the open leaf it replaces).
- The harness sets host, `on`, `hole` and `at` from the request. The model writes only the tree.
- There is one tree per (type, kind, hole), composed from its answers in order. A later answer replaces an open leaf of an earlier one.
- Each leaf keeps its answer, so provenance, audit removal and runtime quarantine stay per rule.
- A learned rule never inherits. A case it does not answer is `{"undefined": true}` and is asked later (the hole's default runs meanwhile). An `if` needs an `else`. A leaf is open or an answer, never both.
- Resolution: the base chain as before; at a hole, the host type's own tree. The resolution reports where the next answer goes, the request carries it as `hole.at`, and the question's class key includes it.

Removed with this: ties among learned rules, the regression set (the client's ring of recent acts, the service's queue, the validator's replay step), `overrides` in validation results, `narrowKinds`, and the sibling generalization test (the derived test is the scene that asked).

Monotonicity over the base holds by construction: the base is resolved first, and a learned rule has no undefined leaf it could close for others.

**Base general cases.** What a player expects of a whole class should be the base's, not learned one patch at a time. Add to the base rules:

- A thing used on a creature is held out to it (`offered`), and anything swung is a blow.
- A creature is lashed down (frozen 30, the item goes onto it) by anything fibrous, and fed by anything edible. Otherwise it is its own kind's to answer (bosses included).
- A wild creature snaps at a bare hand and takes the reacher for a foe. Animals are left to their own rules.
- A cell is only touched. A place of the overworld is entered instead.
- A lit fire dries and thaws whoever warms their hands at it.
- Ore used on a lit forge becomes its bar. Iron and gold ingots become item forms.
- A down companion waits.

What the design calls the player's experiments (a thing used on the ground, on an item, on a person, on oneself, on a fixture with no purpose) stays undefined on purpose.

The planner, when E is pressed with nothing pointed at, lets what one stands on take E from an unanswered thing only if the answer does something (a bed, a place), not the ground's "touched".

## Expected behaviour

- A stone used on a dead tree, a stone offered to a green slime, and a bare hand on a dead tree remain undefined. These are the holes the tests use.
- An answer for one of them is a rule hosted by exactly that item or fixture type (e.g. `item/material/stone`, `fixture/nature/dead_tree`), with `hole` equal to the hole key of the base hole reached and `at` the path of the open leaf (`[]` for the type's first answer).
- A second answer from the same type at the same hole is placed at an open leaf of the first rule's tree. Placing it at a leaf that is already answered is refused.
- A draft whose host, kind, hole or path is wrong or missing is corrected from the request when it answers this request. An `inherit` leaf in a draft becomes `{"undefined": true}`.
- Validation refuses:
  - an `inherit` leaf, an `if` without an `else`, and a host with more than `type`;
  - a branch kind for `on`, and a missing or made-up `hole`;
  - a path leading nowhere or to an answered leaf;
  - a rule that answers nothing (all leaves open);
  - two rules of one patch taking one leaf.
- Validation results carry no `overrides`.
- Iron ore (`smelts` → iron ingot) or gold ore used on a lit forge becomes its bar. On a cold forge it says the forge wants fire. On any other target it defers.
- A rope or other fibrous item used on a creature lashes it down. An edible item feeds it. A swung weapon is a blow.
- A bare hand on a wild creature gets bitten and makes it a foe. On an animal it is left to the animal's own rules.
- A bare hand on a plain cell is "touched". On an overworld place it enters.
- A bare hand at a lit fire dries and thaws a wet or frozen actor. Otherwise it only warms.
- A down companion, when stuck, stays where it fell and shows sadness.

## Requirements

- The host of a learned rule is exactly `{type}`, `on` is an exact event kind, `hole` is a non-empty string, `at` is an optional list of strings.
- A rule library can compose a type's answers for a (type, kind, hole) into one tree, locate a leaf by path in it, and list the learned rules for a type and kind. Resolution at a hole consults only the host type's own tree and reports the path of the open leaf the event fell into.
- A learned rule that inherits is invalid. A learned layer answers only where the base is undefined and cannot change a defined outcome.
- The hole key function and the placement of a patch (setting host, kind, hole and `at` from a request) are exported from the engine.
- A patch submitted in answer to a recorded request is placed by the harness before validation. A rule that answers another request keeps the place it was written with.
- With the scene that asked, validation requires that one rule be placed where the event fell undefined and that it actually define it. Without a scene, each rule must fit the library's tree: a first answer or an open leaf.
- A leaf that is both open and an answer is refused and read as open. A question asked before the tree grew is placed where the event falls undefined now.
- A learned rule set aside at run time leaves the library, and its leaf is open again.
- A revision takes its predecessor's place, so what grew below it stays.
- A base rule whose branches change makes the learned rules below it fail on restore, sync and prune, with the reason, never silently.
- The request's class key includes the open leaf's path.
- The client no longer keeps or sends a regression set; the validation UI no longer shows overrides; the starting-point template for the Mod Console sets host, hole and `at` from the request.
- Base rules keep their specificity ranking and the content tests' tie checks. The base rules (BASE_RULES, STORY_RULES) pass validation except for the placement rules that apply only to learned rules.
- Older class-style patches in a library are kept but never consulted. `library prune` rolls them back, and saves drop them on load with the reason.
- The authoring guidance and spec given to the model describe the new shape: type's own rule, harness-set place, open leaves, `if` with `else`, no `inherit`.

## Interface

- `holeKey(rule: string, path: string[]): string` — exported from `@lsw/engine` (moved to `rules.ts`).
- `patchKey(type: string, kind: string, hole: string): string` — exported from `@lsw/engine` (`rules.ts`); the key of one (type, kind, hole) tree.
- `locate(tree: Tree, at: string[])` — exported from `@lsw/engine` (`rules.ts`); returns the open or answered leaf at that path (with the `leaf`), or nothing when the path leads nowhere.
- `placePatch(patch: Patch, req: ModRequest): { patch: Patch; fixes: string[] }` — exported from `@lsw/engine` (`mod.ts`).
- `Rule.hole?: string` and `Rule.at?: string[]` — new fields on learned rules.
- `ModRequest.hole.at: string[]` — the path in the host type's own tree to the open leaf.
- `Resolution.open?: { path: string[] }` — where the next answer goes.
- `RuleLibrary.learned(type, kind)` — the learned rules for a type and kind; `RuleLibrary.stale()` — answers whose leaf is gone or already answered; `compose` — builds a type's tree from its answers.
- `ValidationResult` no longer has `overrides`. `ModWorkspace` no longer has `regression`. `ModPort` no longer has `regression` or `observe`. `UndefinedSink` no longer has `observe`.
- Content: `GENERAL` rules with ids `creature/offered`, `creature/handle`, `tile/handle`, `fire/warm-hands`, `smelt/ore`, `companion/stuck` in `packages/content/src/rules.ts`, plus the `core/use` root changes.
- Item forms `item/material/iron_ingot` and `item/material/gold_ingot`. Iron and gold ore carry `props.smelts` naming their bar.
