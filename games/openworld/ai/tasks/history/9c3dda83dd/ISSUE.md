# Modder: a fast "live" profile for player-facing patches, with background review and revision; engine guards for catch-all rules and stale text names

## What is wanted

Today a player who triggers an undefined interaction waits about 100 s for the modder's patch. The modder runs a single heavy loop: tool round trips, a blocking review, and model-written tests. That loop should stay available, but only as an **offline** profile. A new **live** profile should serve players quickly (the aim is a few seconds per patch). It does this by:

- doing deterministic work in code instead of in model turns;
- making one low-reasoning model call;
- moving review to after the player has the patch;
- guarding against stalled providers.

The engine and library need a few supporting changes:

- Catch-all interaction rules must be rejected.
- Interaction text must use role names as they were when the rule began.
- A shared-library rule must be replaceable by a revision.

The modder also needs per-call timing and cost reporting.

## Expected behaviour

**Profiles**
- A `Modder` can be built with `profile: 'live' | 'offline'`. Offline is the full loop (tools, blocking review, model-written tests). Live and offline settings are data in the harness state; the repair budget, for example, is read per profile (`harness().offline.repair.maxRounds`).
- Live profile, happy path: the model is called once, with no tools. The accepted episode records `profile: 'live'` and `usage.calls === 1`. The player gets the patch before any review runs. Review runs afterwards in the background, and `modder.settled()` resolves when that background work is done. The review appears in the journal as a `review` entry.
- Live profile, failure: if the live attempt fails (here, the model gives unusable output, and the live repair budget is one answer plus one repair), the player gets the failed outcome and the fallback immediately. The request is then reworked in the background under the offline profile as a new episode with `escalatedFrom` set to the failed episode and `profile: 'offline'`. If that succeeds, the rule is added to the shared library.
- Live profile, late review: after a patch ships, the reviewer may return a `revise` verdict with notes. The patch is then redone offline. The revision prompt contains a `# Revision` section. The new patch **replaces** the shipped rule in the shared library. The patch log shows the old rule added, then removed, then the new rule added, so clients see remove-then-add. The revision episode records `revises` as the original episode, and its outcome is `accepted`.
- A shipped rule that only narrates (log, say, vfx) and changes nothing in the world is flagged to the reviewer. The review prompt contains the text `changes nothing in the world`. Rules that do not generalize are flagged the same way.

**Brief (live)**
Before the call, code assembles a brief: for each role, its type, tag, status and default-prop information, plus the library rules that already speak about this target or instrument, most relevant first. This replaces the repeated `search_rules` tool turns.

**Deterministic repairs (no extra model turn)**
- A correct rule in the wrong wrapper is accepted on the first attempt. The shapes are:
  - an artifact that is the rule itself;
  - `{kind:'rule', ...ruleFields}`;
  - a bare rule;
  - `{rules:[...]}`.

  The harness re-wraps these into the patch shape, and the attempt records the fixes in `attempts[0].fixes` (non-empty). No repair round is spent.
- `narrowVerbs(patch, request, validationResult)` handles a rule that conflicts at equal specificity only because it also claims verbs the player did not use. It narrows that rule to the requested verb and returns `{ patch, fixes }`, where `fixes[0]` mentions "narrowed". It returns `undefined` when the validation errors are not an equal-specificity conflict.

**Derived generalization tests (live)**
For each interaction rule in a live patch that has no tests, the harness writes a test itself. It replays the requested interaction, records what changed on the target and instrument (statuses added or removed, destroyed, terrain changed, spawned types), then swaps in **another instance** of the class the rule names and checks that the rule fires there with the same effects.
- Prefer an instance from a different branch of the type tree than the original.
- A test that holds is attached to the rule with a name like `derived: target actor/creature/...`. It must use a different type from the original, and its expectations include e.g. `{ key: 'target', hasStatus: 'frozen' }`. The attempt records a note like `derived a test on target …` in `attempts[0].derived`.
- A rule that does not hold up, or has no other instance to try, gets no test. A note says so, and the reviewer is told.

**Tail guard (model adapter)**
`ChatOptions` gains `reasoning`, `hedgeMs`, `deadlineMs` and `retries`.
- With `hedgeMs`, if the first request has not answered after that long, an identical second request is sent to the **next provider** in the pinned `provider.order`, rotated (`['a','b']` becomes `['b','a']`). The first answer wins and the other request is aborted. The reply has `hedged: true` if the second request won.
- A failed request, including an empty or unparseable body, launches the second request immediately rather than waiting for the hedge timer.
- `deadlineMs` bounds one try. When a try hits its deadline it is abandoned and retried, up to `retries` times (default 1).
- Without `hedgeMs` or `deadlineMs`, behaviour is unchanged.
- `reasoning: 'none'` sends `reasoning: {enabled:false}`. Other levels send `reasoning: {effort}`.

**Reporting**
- Replies carry wall time (`ms`), `provider`, reasoning tokens and cost (USD) when the provider reports them. For OpenRouter, ask the API to include usage cost.
- `Meter` keeps one record per call (purpose, ms, input/output/reasoning tokens, tool count, provider, hedged) and a running `cost`.
- Episode `usage` includes `cost` alongside `calls`, `input` and `output`. A mock provider returning `cost: 0.0005` per call, over 3 calls, gives a cost of about 0.0015.
- Anthropic-model system prompts are marked for caching.
- Environment: `LSW_MODEL_PROVIDERS=a,b` pins providers in order, with fallbacks allowed. `LSW_MODEL_SORT` lets the router choose instead.
- Repair-round prompts begin with `The validator rejected`.

**Engine**
- **Catch-all rejection.** An interaction rule whose target and instrument selectors both lack any positive constraint (type, tags, status, id, player) is rejected by `validatePatch`. The error message contains `too broad`. For example, "any item on anything: log Nothing happens" with `instrument: { none: false }` is rejected. The same rule with `instrument: { tags: ['fiber'] }` is not. The authoring rules shown to the modder say this. Base-library rules are exempt (the base library's generic answers are deliberately broad, so the existing test that validates BASE_RULES ignores this error).
- **Immediate attempt line.** When an interaction is undefined and a request is raised, a neutral line is logged at once saying what the player is trying. It describes the attempt only, never the outcome. Variants: take, put, bare reach (no instrument), instrument on yourself, instrument on target. It is available in English and Chinese.
- **Stable names in text.** For rules that log or say, `{target}`, `{instrument}` and `{actor}` are filled with the names the roles had when the rule started, not at the time each effect runs. Example: a rule that destroys the instrument and then logs "The {target} eats the {instrument}." produces "The green slime eats the Rope." and not an unnamed or missing instrument.

**Library**
- `WorldLibrary.workspace`, `validate` and `commit` accept a list of rule ids the patch replaces. These are judged as if absent: no conflict with them, and their regression cases are dropped. On commit they are removed from the log first, if they are patch-origin rules.

**Client**
- Wait for a modder patch drops from 45 s to 15 s. A later patch still teaches the world.
- Prefetch: if the player faces an undefined interaction with something in hand for about 0.5 s, the client requests the patch ahead of time and submits it through the normal validator. Bare-floor targets don't trigger this. It is capped per session, runs one request at a time, and never repeats for the same target and instrument pair.

**Tooling**
- `npm run latency` runs a latency benchmark over unseen interactions. It reports per-call timing, tokens, cost and provider.
- The model key is loaded from a gitignored `<repo>/.env`. Variables already set in the environment win.

## Requirements

- Offline profile behaviour is unchanged from before, apart from reading its settings from the `offline` section of the harness.
- Live profile uses exactly one model call and no tools on the success path.
- The live design call does not wait for review. Review always follows shipping.
- Failed live requests escalate to offline in the background and leave a linked episode.
- `revise` verdicts produce a linked episode and replace the old rule in the shared library, with remove-then-add visible in the patch log.
- Wrapper repairs and verb narrowing happen in code, are recorded on the attempt, and do not consume repair rounds.
- A derived test is attached only if it actually holds on a different instance.
- The tail guard never leaves requests running after the winner returns.
- The engine rejects catch-all interaction rules in patches. All existing base rules still validate apart from the `too broad` error.
- Text templates use role names from the start of the rule, and nested rule runs restore the outer names.
- Usage reports are backward compatible: episodes with `calls`, `input` and `output` still match, and `cost` is added.

## Interface

- `narrowVerbs(patch: Patch, req: ModRequest, res: ValidationResult): { patch: Patch; fixes: string[] } | undefined` — exported from `packages/modder/src/fixes.ts`, re-exported from the modder package index.
- `normalizePatch(x: unknown): { patch?: Patch; fixes: string[] }` — same file, exported.
- `briefOf(req: ModRequest, lib: RuleLibrary, onto: Ontology): string` and `relatedRules(req: ModRequest, lib: RuleLibrary): Rule[]` — `packages/modder/src/brief.ts`, exported from the index.
- `deriveTests(patch: Patch, req: ModRequest, lib: RuleLibrary, onto: Ontology): { patch: Patch; notes: string[] }` and `changesNothing(rule: Rule): boolean` — `packages/modder/src/derive.ts`, exported from the index.
- `attemptLine(eng: Engine, ev: GameEvent): { en: string; zh: string }` — exported from the engine's `mod.ts`.
- `Modder` options: `profile?: 'live' | 'offline'`.
- Episode fields: `profile`, `escalatedFrom`, `revises`, `usage.cost`; attempt fields: `fixes?: string[]`, `derived?: string[]`.
- `Modder.settled(): Promise<void>` — resolves when background review, escalation and revision work is finished.
- Harness data: `harness().offline` (with `repair.maxRounds`) and a matching `live` section.
- `ChatOptions`: `reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high'`, `hedgeMs?: number`, `deadlineMs?: number`, `retries?: number`.
- `ModelReply`: `ms?: number`, `provider?: string`, `hedged?: boolean`, and `usage.cost?`, `usage.reasoning?`.
- `CallRecord` interface and `Meter.cost`, `Meter.log: CallRecord[]` — `packages/modder/src/model.ts`.
- `WorldLibrary.workspace(ws?, without?: string[])`, `WorldLibrary.validate(patch, req?, ws?, replaces?: string[])`, `WorldLibrary.commit(patch, req?, ws?, now?, replaces?: string[])`.
- `OpenAICompatModel` hedges with the provider order rotated when `extraBody.provider.order` has at least two entries.
- Environment variables: `LSW_MODEL_PROVIDERS`, `LSW_MODEL_SORT`.
- npm script `latency` → `packages/tools/src/latency.ts`.
