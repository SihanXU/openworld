# Upstream loop: detect promotable learned rules and propose base rules for them

## What is wanted

The learned layer answers holes in the base rules one host type at a time. When many sibling types answer the same hole the same way, or a class keeps falling into the same hole, the base rules should gain a rule for the whole class. Two parts are wanted:

1. **A detector** that finds these cases from the shared library and the ontology, with no model.
2. **A driver** that turns a candidate into a repository task for an agent: a workspace, an issue, and a judge the agent cannot touch. It also creates the branch for the result. A person merges; nothing is merged automatically and the running world is unchanged.

Supporting changes:
- Coverage cells must say where an answer would go, so the judge can tell which class and hole a newly answered cell belongs to.
- The `claude-code` model backend currently pays about 2 s per call for the CLI's own traffic (update check, telemetry, error reports, surveys). That traffic should be switched off for the child process.
- The answer format asked of the design model has an unread `summary` field. It should be dropped from the prompts and the retry and diagnostic messages that mention it.

## Expected behaviour

### Detector

- **Lowest common ancestor** of a list of type ids: the deepest shared path prefix of at least two segments. It is undefined when the types share only the root segment or when the list is empty. A single type is its own ancestor.
- **Tree equivalence**: two learned trees are equivalent when their condition structure and effect ops and arguments agree, ignoring wording and presentation. Text, `fx` and `mood` of `log`, `say`, `emote` and `vfx` effects are ignored, but the op itself is kept, so a rule that narrates differs from a silent one. A leaf's doc, label and confirm are ignored. The host's own type is replaced by a placeholder wherever it appears, in selectors, `transform.into` and `spawn.type`, so `green_slime` turning into `green_slime` and `fire_slime` turning into `fire_slime` match. Equal trees give the same canonical string regardless of key order.
- **S1, sibling convergence**: live learned rules placed at a host type are grouped by (kind, hole) and clustered by canonical tree.
  - A cluster becomes a candidate when it has at least K=3 distinct host types, those types have a common ancestor (at least two segments), and the share is at least S=0.5.
  - The share is the cluster's types divided by the types of that class reached at that hole. Reach comes from the group's own host types and from the optional sweep counts (`type|kind|hole` → asked count), ignoring types no longer defined.
  - Example: three slimes answer alike and a fourth answers differently → one candidate on `actor/creature/slime` with the three types, their rules, and share 0.75. With only the three, the share is 1. If the sweep says six slimes reach the hole, the share is 0.5; raising S to 0.6 removes the candidate, and raising K to 4 removes it too.
- **S2, a class asked often**: using the per-(type, kind, hole) asked counts, a class (a type or any ancestor with at least two segments) asked at least N=5 times at one hole is a candidate. Only the narrowest qualifying class is reported. A class already covered by an S1 candidate at the same hole (either containing the other) is skipped. It carries the asked count, the types asked, and the live learned rules under the class. It has no canonical tree. Four questions are not enough.
- **Asked counts** are taken from every rule patch in the library's log, live or later removed, counted per `type|kind|hole`.
- Results are ordered by signal, then by share descending, then by ancestor.
- The thresholds are overridable per call.
- S3 (by hand) belongs to the driver.

### Driver and judge

- **Issue**: it quotes the hole's base rule from its source file with `file:from-to`, lists the class's leaf types with the answered ones in bold, states the evidence per signal, and for each learned rule gives its id, host, doc, the scene that asked (as `kind — role: type, …`), and its tree. It asks for one base rule on the class, says the line bound, and says how it is judged.
- **Workspace**: the engine and content as a repository, with the engine read-only (and checked by hash), and the judge's own files kept out of the diff.
- **Promotion test**: generated from the learned rules' scenes. For each, the scene must now resolve to a base rule (not a hole, not a learned rule) with the learned rule's expectations, minus `resolvedBy`. On unchanged content the test fails with a message containing "still a hole at <hole>".
- **Coverage regression**: compare the sweep before and after.
  - Every cell that was defined must keep its rule. A cell that became undefined, changed rule or vanished is a regression.
  - A newly defined cell counts as gained only if it was open at the candidate's kind and hole, on a type under the candidate's class. Otherwise it is a stray.
- **Bounds**:
  - Only `rules.ts` (required) plus at most `items.ts` and `ontology.ts` may change.
  - At most L=80 changed lines (added plus deleted; a binary change counts as over).
  - Exactly one new `rule({`.
  - `BASE_RULES` is still exported.
  - The engine is unchanged.
  - Each reason is reported as a separate string.
- **Unattended runs** need a container. Without one, and without an explicit local-run flag, there is no task.
- **Verdict** has sections `bounds`, `promotion`, `coverage` and `content suite`, each marked pass or FAIL. Coverage reports how many cells were newly answered at the hole on the class.
- **Branch name** is derived from the hole and class: non-alphanumerics become `-`, collapsed and trimmed, prefixed `upstream/`. Example: hole `core/use#!{"none":"instrument"}` with class `actor/creature/slime` gives `upstream/core-use-none-instrument-actor-creature-slime`.
- **Limits**: one open proposal per (hole, class), three a day, and never merged by this tool.
- **CLI**: `npm run upstream -- scan | propose <hole> <class> | status`, with `propose --candidate <n>`. `scan` and tests run no model.

## Requirements

- Detection is pure code over the library and ontology.
- The thresholds `K=3`, `S=0.5`, `N=5` are exported and overridable per call. The driver adds `L=80` and 3 proposals a day.
- Only live learned rules that are placed at a host type take part in S1.
- A hole's source is found by the rule id before any `#` branch suffix.
- The effects-from-scene helper that the existing derivation code uses internally is exported so the upstream loop can reuse it, with its behaviour unchanged.
- The sweep's cells carry an `open` key (`type|kind|hole`) for cells whose outcome is undefined, and the key is absent otherwise.
- The engine workspace helper accepts an optional temp-dir prefix, with the current default unchanged.
- The `claude-code` child process runs with the update check, telemetry, non-essential traffic, error reporting, cost warnings, bug command and feedback survey disabled through its environment. The parent environment is otherwise kept.
- The answer format shown to the design model, and the repair, finalize, no-JSON and "JSON but no patch" messages, no longer mention `summary`. The design prompt asks for a minified object.
- The existing suite still passes.

## Interface

In `packages/modder/src/promote.ts`, re-exported from the `@lsw/modder` index:
- `PROMOTE: { K: number; S: number; N: number }`, equal to `{ K: 3, S: 0.5, N: 5 }`.
- `interface Candidate { kind: string; hole: string; ancestor: string; types: string[]; rules: Rule[]; share: number; signal: 'S1' | 'S2' | 'S3'; normalized?: string; asked?: number }`.
- `lowestCommonAncestor(types: string[]): string | undefined`.
- `normalizeTree(tree: Tree, hostType: string): unknown`.
- `normalKey(tree: Tree, hostType: string): string`.
- `askedCounts(library: WorldLibrary): Map<string, number>`.
- `candidates(library: WorldLibrary, onto: Ontology, sweepCounts?: Map<string, number>, o?: Partial<typeof PROMOTE>): Candidate[]`.

In `packages/modder/src/derive.ts`:
- `effectsOf(sc: Scenario, rule: Rule, lib: RuleLibrary, onto: Ontology): Expectation[] | undefined` is now exported.

In `packages/tools/src/coverage.ts`:
- `Cell.open?: string`.

In `packages/tools/src/engine-tasks.ts`:
- `engineWorkspace(o?: { prefix?: string })`.

In `packages/tools/src/upstream.ts` (new; also the `upstream` script in the root `package.json`):
- `UPSTREAM`, equal to `{ ...PROMOTE, L: 80, MAX_PER_DAY: 3 }`.
- `hashDir(dir: string): string`.
- `contentWorkspace(): { dir: string; engineHash: string; dispose: () => void }`.
- `holeSource(hole: string): { file: string; lines: [number, number]; text: string } | undefined`.
- `leafTypes(onto: Ontology, ancestor: string): string[]`.
- `issueFor(c: Candidate, ctx: IssueContext): string`, with `IssueContext { onto; scenes: Record<string, Scenario>; cellsByRule?: Record<string, number>; note?: string; L?: number }`.
- `interface PromotionCase { rule: string; type: string; hole: string; scene: Scenario; expect: Expectation[] }`.
- `promotionCases(c: Candidate, library: WorldLibrary): PromotionCase[]`.
- `promotionTest(cases: PromotionCase[]): string`, built from the template `packages/tools/tasks/upstream/promotion.test.ts.tmpl`. The template has a `/*__CASES__*/ []` marker and its failure message contains "still a hole at <hole>".
- `type SweepMap = Record<string, { outcome: Outcome; rule?: string; open?: string }>`.
- `sweepMap(cells): SweepMap`, keyed `hand|target|verb`.
- `interface SweepDiff { regressions: string[]; strays: string[]; gained: number }`.
- `compareSweeps(before: SweepMap, after: SweepMap, c: Pick<Candidate, 'kind' | 'hole' | 'ancestor'>): SweepDiff`. The message formats are:
  - Regressions: `<key>: was <rule>, now <rule>`, `<key>: was <rule>, now undefined`, or `<key>: gone from the sweep`.
  - Strays: `<key>: now <rule> (was open at <open>)`.
- `interface BoundsInput { numstat: string; rulesBefore: number; rulesAfter: number; exportsBase: boolean; engineChanged: boolean; L?: number }`.
- `checkBounds(b: BoundsInput): string[]`. Message formats:
  - `<file>: not a file a proposal may change (…)`
  - `rules.ts: unchanged …`
  - `<n> lines changed, more than <L>`
  - `<n> new rule(s) in rules.ts, not one`
  - `rules.ts no longer exports BASE_RULES`
  - `packages/engine changed: …`
- `interface UpstreamTask { task: AgentTask; cases: PromotionCase[]; issue: string; workspace: string; dispose: () => Promise<void> }`.
- `upstreamTask(c: Candidate, o: { library: WorldLibrary; isolation?: Isolation; localRun?: boolean; note?: string; cellsByRule?: Record<string, number>; L?: number }): Promise<UpstreamTask | undefined>`. The task has `kind: 'upstream'`, `statement` equal to the issue, `localRun`, and a `verdict` that produces the sections above.
- `branchFor(p: { hole: string; ancestor: string }): string`.
