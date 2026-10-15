# The god loop: learned rules may not forge the game's own news, checks see more, faults are reported, and scenes are not held up

## What is wrong

The loop in which the AI proposes learned rules (patches) to the shared world library has several holes found in review, plus some avoidable costs.

1. **Learned rules can forge the game's records.** A learned rule may emit a `notify` impulse with any `what` ("quest", "defeat", "reward", "status"…). A person's quest stage is set by it, and the story settles a quest word or a defeat from it, so a learned rule speaking for a stone can skip the main quest.
2. **The validator accepts tags nothing carries.** A selector or `has` condition naming a tag that no thing in the world has passes validation.
3. **The repeat check misses some farms.** Experience or fullness gained for nothing is not counted as a yield.
4. **The auditor depends on a model to find even obvious farms,** and its scripted acts do not reach as far as the original event did.
5. **A reviewer that gives no verdict blocks nothing and gets no follow-up.** The rule ships and is never reviewed. In the repo mode, what the auditor breaks is never given back to the agent.
6. **Clients cannot report a learned rule they set aside at run time,** so a bad rule stays in the shared library.
7. **A scene can be held up by the world's own questions** (a learned-rule question asked by the world freezes its players while the scene plays). A story step with a region is checked only when someone enters a region, so a condition beside the region that becomes true while one stands in it is missed.

There are also costs to cut: building a sandbox clones the whole ontology; building or cloning a rule library re-sorts its indexes per rule; the validation proof key hashes every rule; a covering replay runs even when no learned tree could answer; clean live episodes are reflected on four at a time.

## Expected behaviour

- A learned rule that emits `notify` with `params.what` other than `"topic"` is refused by the validator with a message containing "may notify only a topic". `"topic"` passes.
- Independently of the validator, a person does not take a quest or prologue stage from `notify` news whose source is a thing (item, fixture, tile, creature). The story ignores quest/defeat news whose source is an item, fixture or tile. A rule slipped past the validator that emits `notify` `what: 'quest'` leaves the player's `quest` prop unset.
- The validator refuses a selector tag (`tags`/`notTags`) or `has.tag` that nothing in the world carries, with a message containing `no thing in the world carries the tag "<tag>"`. "Carries" covers tags of types (inherited), terrains, instances, and tags used by hosts of rules in the library. Tags in the run-time families `skill:`, `profession:`, `faction:`, `tool:`, `liquid:`, `material:`, `quality:`, `element:`, `role:` always pass. An existing tag like `heavy` passes.
- The repeat check counts, per repeat, a rise in the actor's `xp` or `hunger` as a yield (in addition to things made).
- A deterministic probe repeats the scene's act 30 times with the patch and without it:
  - It reports a `farm` finding, with evidence containing "with the patch", when the patch leaves at least 30 more things than without it. A rule that spawns a thing and destroys it each time is not a farm.
  - It also reports a farm when `xp` or `hunger` gains exceed the unpatched gains by at least 30.
  - It returns nothing when the scene's event has no actor or is not an `act/…` event.
  - The auditor runs the probe first and returns its findings if any, asking the model only when it finds nothing. A probe failure is logged and falls through to the model.
  - Acts in audit runs reach as far as the original event did (unbounded reach).
- If the pre-shipping reviewer gave no verdict (`error`), the rule ships anyway, is flagged, and is reviewed again after the fact. In the repo mode, when the auditor confirms findings, the agent gets them once (with its previous draft) and the second draft is committed only if it passes a re-audit.
- A client reports a set-aside learned rule. The service counts distinct clients per rule. Once the count reaches the harness bound `faults.remove` (default 2), the rule leaves the shared library and, if revision is enabled, is revised offline with the reason. Non-learned or unknown rules are not counted or removed.
- While a scene plays, a question the world itself asks (origin `world`) holds nobody: the default runs at once, the record's status is `fallback`, nothing is frozen, and the answer, when it later arrives, still applies if the event stands.
- A story step with a region is looked at again every 30 ticks (not only on arrival) while someone stands in a region.
- Performance expectations: sandbox builds share the world's ontology (copied only on the first write to the index), libraries build indexes once on construction/clone, the validation proof key uses the library version instead of stringifying every rule, `covering` skips the replay when the library has no learned tree at the request's hole for its host type and kind, and the default reflection batch is 8.
- `docs/upstream.md` is added, describing as a proposal (nothing coded) the loop by which the AI proposes base rules and a person merges them.

## Requirements

- All behaviours above hold, and the base content's own rules still validate (the only placement-style refusals for base rules may include the new "may notify only a topic").
- The ontology passed to a sandbox must not be mutated by writes made inside the sandbox (adding a type or status).
- Existing behaviour of the base library, the sandbox and replays is otherwise unchanged.
- `DEFAULT_HARNESS.reflect.batch` is 8; `DEFAULT_HARNESS.faults` is `{ remove: 2 }`.
- The client, when connected to a modder service with a model, reports faults by `POST {modderUrl}/fault` with `{rule, reason}`, fire-and-forget with failures ignored.
- `POST /fault` with a body lacking a string `rule` returns 400; otherwise it returns the result of the fault handling. The client id defaults to the remote address if not given.
- With no verdict from the reviewer, both the pre-shipping reviews and the after-the-fact reviews are made (the review is asked again after shipping).

## Interface

- `Harness.faults?: { remove: number }` in `packages/agent/src/state.ts` (default `{ remove: 2 }`).
- `Engine.onFault?: (rule: Rule, reason: string) => void` in `packages/engine/src/engine.ts`; called when a learned rule is set aside at run time.
- `Modder.fault(ruleId: string, reason: string, client?: string): { rule: string; counted: number; removed: boolean }` in `packages/modder/src/pipeline.ts` (`client` defaults to `'anon'`).
- `probe(req: ModRequest, onto: Ontology, base: RuleLibrary, patched: RuleLibrary): Confirmed[]` in `packages/modder/src/audit.ts`, exported from `@lsw/modder`'s index (alongside `withPatch`, which must also be importable from `../src/index.ts`).
- `holeKey` and `patchKey` exported from `@lsw/engine` (already used by the modder library) must be available there.
- `materializeWorld` gains an optional `audit?: { notes: string[]; draft: Patch }` option in `packages/modder/src/repo.ts`.
- Route `POST /fault` in `packages/modder/src/server.ts`, body `{rule, reason, client?}`.
- `docs/upstream.md` (new file).
