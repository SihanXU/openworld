# Hold learned-rule placement to review: open leaves, live places, real holes, revisions in place, and bosses not lashed by grass

## What is wrong

The first cut of "learned rules take one leaf" (design.md §5.16) has gaps found in review:

1. **A leaf that is both open and an answer.** A leaf with `undefined: true` that also carries `do` is accepted by neither side consistently: the validator should refuse it, yet the engine reads it as an answer or ambiguously. Nothing it carries should ever run.
2. **A question's place goes stale.** A request records the open leaf where its answer goes when asked. If another answer grows the tree before this one arrives, the recorded place is wrong, and the answer lands at the wrong leaf (e.g. the root) or is refused.
3. **A learned rule set aside at run time still occupies its leaf.** After quarantine the game treats the leaf as open, but the library (and so the validator's replays) still treats it as answered, so a new answer to that leaf is refused.
4. **A rule's `hole` is not checked against the base.** A learned rule can name a hole that is not an open leaf of any existing base rule (a made-up rule, a non-leaf path, a leaf that is defined). When a base rule's branches change, learned rules below it silently lose their place. Answers that grew below a rule that was not restored are also kept as orphans.
5. **A revision loses its predecessor's place.** When a rule is replaced by a revision, answers that grew below the old rule lose their place in the tree, and shared-library clients do not know that the new patch is a revision.
6. **The repo mode (agent-written rules) does not place what the agent wrote**, and its issue text still describes class-level rules.
7. **A boss offered a handful of grass is lashed down** by the general `creature/offered` rule, though bosses should not be held by fibre.

## Expected behaviour

- A leaf `{undefined: true, do: [...]}` is refused by patch validation with a message saying a leaf is open or an answer, never both. If such a rule is nevertheless in the library, the engine treats the leaf as open: the event resolves as undefined, a question is raised, and the `do` does not run.
- Placing a patch for a request (`placePatch`) can take the current ontology and library. When given them, it replays the request's scene against the library as it is now (with the patch's own rules ignored) and, if the event falls undefined at a different hole or open leaf than the request recorded, uses the current one. It records a fix mentioning that the rule was "placed where the event falls undefined now". If the scene cannot be built, it places as asked and leaves the validator to report. Example: two questions asked while a type's tree was empty (both at `[]`); the first is answered with `if X then … else undefined`; the second's answer is then placed at the else branch of that `if`, and validates.
- The place is read from the live library in every route that takes a patch: the port's `submit` for its own request, the modder pipeline, and the repo mode for the collected patch.
- Setting aside a learned rule at run time (a fault, severe or repeated) records the quarantine and also removes the rule from the library. Its leaf is open again for the validator's replays, and a new rule can then be placed at it.
- Validation of a learned rule's `hole`: it must name a base rule that exists (not a patch rule), and the path must point to an open leaf of that rule. Otherwise it is refused with a reason: "no base rule …" for a missing rule, "not an open leaf …" for a non-open leaf or a non-existent branch (including a hole naming the root of a rule that branches before its hole).
- Restoring a saved library (`restoreLibrary`): after the saved rules are checked, any learned rule left with no place (its leaf gone or answered because a rule above it was not restored) is removed and reported through the `dropped` callback with the reason, never silently. The same must hold for sync and prune.
- A revision takes the place of the rule it replaces. The patch log entry records which learned rules it replaces. When a revision is added in place of a removed predecessor with the same tree key, it takes the predecessor's position in the order, so answers that had grown below the old rule are no longer stale if their paths still fit. This holds for the port, the world library, and the client's sync of the shared log.
- The repo-mode issue text tells the agent that the rule is one type's: `host` is exactly `{type: <the host's type>}`, `on` is the exact event kind, the harness sets the place (`hole`, `at`), a case not answered ends in `{"undefined": true}` and never `"inherit"`.
- A boss offered a thing is not lashed down, even by something fibrous. It is left to its own kind to answer. A non-boss creature (e.g. a green slime) offered grass is still frozen.

## Requirements

- Validator rejects a leaf that has both `undefined` and `do`.
- Resolution treats a leaf with `undefined` as open even if it carries `do`.
- `placePatch` accepts an optional third argument carrying the current ontology and library, and re-places the rule at the hole and open leaf where the event now falls undefined. Without it, behaviour is as before.
- The port, the modder pipeline, and the repo mode pass the live library to `placePatch`.
- A learned rule quarantined at run time is removed from the library as well as recorded.
- Validation checks that a learned rule's `hole` names an existing base rule and an open leaf in it, with distinct error messages for the two failures.
- `restoreLibrary` removes and reports learned rules left stale after restoring.
- `RuleLibrary.add` accepts an optional identifier of a removed rule that the new rule replaces. If that rule's tree key equals the new rule's, the new rule keeps its position in the tree order.
- `ModPort.submit` accepts the list of replaced rules as an optional fourth argument.
- Patch log entries carry an optional `replaces` list, set by the world library on a revision and honoured when the log is applied, both in the world library and in the client sync.
- The repo-mode issue text is updated as described.
- `creature/offered` leaves a boss to its own kind's answer.
- The economy fixtures name real open leaves of base rules for their holes.

## Interface

- `placePatch(patch: Patch, req: ModRequest, now?: { ontology: Ontology; library: RuleLibrary }): { patch: Patch; fixes: string[] }` — in `@lsw/engine` (`packages/engine/src/mod.ts`); the third parameter is new.
- `RuleLibrary.add(rule: Rule, now?: string, inPlaceOf?: string): void` — in `packages/engine/src/rules.ts`; `inPlaceOf` is new.
- `ModPort.submit(id: string | undefined, patch: Patch, scenario?: Scenario, replaces?: string[]): ValidationResult` — in `packages/engine/src/mod.ts`; `replaces` is new.
- `PatchLogEntry` (add variant) gains an optional field `replaces?: string[]` — in `packages/engine/src/mod.ts`.
- `restoreLibrary(base, saved, ontology, …, dropped?)` is used by the tests with the `dropped` callback receiving `(id, reason)`; it must be exported from `@lsw/engine`, and it must call `dropped` for rules left without a place.
