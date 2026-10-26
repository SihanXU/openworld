# Add an auditor that plays against each patch in the sandbox and counts only what it reproduces

## What is wanted

The deterministic checks (validator, replay, repeat check, economy LP) judge the form of a patch. Some exploits fit that form. For example, a rope used on a creature that turns into Dragonsbane is valid, writes only its host, and is one for one in the economy LP, yet it is a cheap road to the rarest blade in the world.

Add an **auditor**: a model-driven agent that runs after the deterministic checks and plays against a patch like a player out to break the game. It looks for:

- farms (something made again and again for nothing),
- cheap roads to rare things,
- softlocks,
- harm to someone who should not be hurt,
- runaway chains.

The model only searches. The code decides. The auditor's tools are the sandbox:

- `look` shows the request's scene and its triggering event.
- `run` plays acts, ticks and repeats in a fresh copy of the scene, reporting the result with the patch and without it.

A finding consists of a setup, steps and claims. The code replays it and counts it only when its claims hold with the patch and do not all hold without it. A finding the sandbox does not bear out is recorded and never acted on.

The auditor is wired into the pipeline in two ways:

- **Offline (blocking):** it runs before the patch ships. A patch it breaks goes back to the designer with the evidence. This applies to the JSON path and to the repo path. On the repo path the broken patch is not committed.
- **Live (after shipping, in the background):** a patch it breaks is removed from the shared library at once, so clients drop it on their next sync. The patch is then sent to one offline revision, if revising is enabled. A live finding that the sandbox does not confirm leaves the patch alone.

An auditor that errors or fails finds nothing, since the deterministic checks already passed. Everything it runs is bounded.

The harness gets a new setting, `audit {enabled, blocking, rounds, reasoning}`, on by default. A harness saved before this change must behave as if it had the default.

## Expected behaviour

**Confirming a finding.** Take a request where a rope is used on a slime and no rule defines the outcome.

- A patch makes "rope used on a creature" transform the rope into Dragonsbane. The finding "after one use the instrument is of type Dragonsbane" is confirmed, and its evidence shows Dragonsbane +1 in the "with the patch" summary.
- A patch where "rope used on a creature" spawns a stone into the actor's contents for free. The finding "30 uses leave at least 30 stones held by the actor" is confirmed.
- A claim that does not hold with the patch is not confirmed. The reason says it does not hold. Example: asking for two Dragonsbane after one use.
- A claim the world already makes true without the patch (for example, the actor is of the player type) is not confirmed. The reason says it holds without the patch too.
- The Dragonsbane finding against a harmless patch (the slime merely sniffs the rope) is not confirmed. The claim does not hold.
- A finding that asks for a billion repeats or ticks is cut short and finishes in bounded time. Acts, ticks, repeats and the number of findings read from one answer all have limits.

**Claims** available to a finding:

- thing count of a type (optionally inside a holder, at any depth, with a minimum),
- a numeric property with optional min and max,
- a status held,
- a thing gone,
- a thing is of a given type,
- a minimum number of events traced.

**Steps** are: an act (use, put, take, hands, move, craft, learn, with optional actor, target, instrument and params), a number of ticks, or a repeat of nested steps. A target or instrument may be a thing key or `tile:x,y`. An unknown act is an error that stops the run, and the run reports it.

**The `run` report**, for both patched and unpatched worlds, includes:

- what answered each act,
- things made or gone by type,
- the actors' numbers and statuses,
- the event count,
- recent warnings,
- why the run stopped, if it did.

**In the pipeline.**

- Live, a patch that is shipped and then broken by the auditor is removed from the library after the request has been answered as accepted. An unconfirmed claim leaves the patch in the library.
- Offline, a draft the auditor breaks goes back to the designer. The draft's attempt records the audit with the confirmed findings and the count of unconfirmed ones, and the notes sent back include the evidence. The designer's next harmless draft ships.
- The auditor's tool use is limited to the configured number of rounds. After the last round it must give a final JSON answer, and its tool output is clipped.
- The attempt phase gains an `audit` value for this case.
- The audit's confirmed and unconfirmed findings and its usage are journaled as a note.
- The auditor runs on the offline provider settings.

**Defaults.**

- Live: enabled, not blocking, a handful of tool rounds, low reasoning.
- Offline profile: blocking, medium reasoning.
- An older saved harness with no `audit` entry gets these defaults when read through the audit settings helper.

## Requirements

- Confirmation must require that all claims hold with the patch, and that not all of them hold without it.
- A finding with no claims, or with steps or claims that are not arrays, is not confirmed.
- If the scene cannot be built with the patch, the finding is not confirmed. If it cannot be built without the patch, that counts in favour of the finding.
- A finding the sandbox does not confirm is kept in the record with the reason, and never acts on the patch.
- Each run starts from a fresh copy of the request's scene plus the finding's setup. Runs must not mutate the request's scenario.
- Offline blocking audit: a confirmed finding consumes a repair round and sends the evidence back as a retry. Once repair rounds are exhausted, the episode stops as it does for other failures.
- Offline blocking audit on the repo path: a broken patch is not committed, and an audit attempt is recorded on the episode.
- Live audit is skipped for revision episodes and when the audit is disabled or blocking.
- The auditor runs only when enabled in the (profile-resolved) harness.
- Existing tests that depend on exact call sequences must be able to turn the auditor off through the harness.

## Interface

All in `packages/modder/src/audit.ts` and re-exported from the modder package index, unless noted.

- `type Claim` is a union of:
  - `{ count: { type: string; in?: string; atLeast: number } }`
  - `{ prop: { key: string; name: string; atLeast?: number; atMost?: number } }`
  - `{ status: { key: string; has: string } }`
  - `{ gone: string }`
  - `{ is: { key: string; type: string } }`
  - `{ events: { atLeast: number } }`
- `type AuditStep` is a union of:
  - `{ act: Verb; actor?: string; target?: string; instrument?: string; params?: Record<string, PropValue> }`
  - `{ tick: number }`
  - `{ repeat: number; steps: AuditStep[] }`
- `interface Finding { title: string; kind: string; setup?: ScenarioEntity[]; steps: AuditStep[]; expect: Claim[] }`
- `interface Confirmed extends Finding { evidence: string }`
- `interface AuditResult { confirmed: Confirmed[]; unconfirmed: { finding: Finding; why: string }[] }`
- `withPatch(lib: RuleLibrary, patch: Patch): RuleLibrary` returns a clone of the library with the patch's types, statuses and rules in it.
- `run(sc: Scenario, onto: Ontology, lib: RuleLibrary, setup?: ScenarioEntity[], steps?: AuditStep[])` returns `{ eng, lines, error? }`.
- `holds(eng: Engine, c: Claim): boolean`
- `confirm(f: Finding, sc: Scenario, onto: Ontology, base: RuleLibrary, patched: RuleLibrary): Confirmed | { why: string }`
- `auditTools(sc, onto, base, patched): Tool[]` returns the `look` and `run` tools.
- `interface AuditOptions { rounds: number; reasoning?; provider? }`
- `audit(model, system, user, req, onto, base, patch, o: AuditOptions): Promise<AuditResult>`

In `@lsw/agent`:

- `Harness.audit?: { enabled: boolean; blocking?: boolean; rounds: number; reasoning?: Reasoning }`, optional so that older harnesses still load.
- `Harness.offline.audit?: Partial<AuditConfig>`
- `type AuditConfig = NonNullable<Harness['audit']>`
- `auditOf(h: Harness): AuditConfig` fills a harness's audit settings from the default.
- `DEFAULT_HARNESS.audit` and `DEFAULT_HARNESS.offline.audit` hold the defaults above.
- `profileOf` resolves the audit settings for the offline profile.
- `Attempt.phase` gains `'audit'`.
- `Attempt.audit?: { confirmed: string[]; unconfirmed: number }`

In `packages/modder/src/prompts.ts`:

- `AUDIT_SYSTEM: string`
- `auditUser(req, patch, outcome): string`
- `auditNotes(findings: { title; kind; evidence }[]): string[]`
- `auditRepairUser(notes: string[]): string`

The model call made by the auditor uses the `purpose` value `'audit'`.
