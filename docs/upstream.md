# The upstream loop: the AI proposes base rules (proposed, 2026-10-09)

Status: **built (2026-10-09):** the detector, the task, the verdict, the proposal and the CLI, with
the thresholds §8 asked about decided (K = 3, S = one half, N = 5, L = 80; a person merges; a
declined proposal is only recorded). See "As built" at the end.

## 1. Why

Since design.md §5.16 a learned rule is one type's, placed at one open leaf. The learned layer
cannot generalize any more: a rope's answer for a green slime says nothing about a wolf, and
siblings are answered independently and may disagree. That is the intended division: what holds
for a class belongs in the base, which is authored. This loop lets the AI *propose* base rules,
as a repository change with tests, and a person merge them. The base stays the trust boundary;
the world keeps playing to its end without a model; the AI's generalizations arrive through code
review, not through the live path.

It is also the paper's second thread made concrete: the same SWE-style agent that works world
tasks and engine tasks (rsi.md §3) works the base's content, and the judge is outside its reach.

## 2. The signal: when to propose

A proposal is made for one **hole** (`holeKey`: the base rule and the branch) and one **class**
(a type of the ontology), from evidence the service already keeps:

- `WorldLibrary.asked`: the scene each live learned rule answered;
- the learned rules themselves (host type, kind, hole, tree);
- the ontology (the type tree, tags, props).

**S1 · Sibling convergence.** Group the live learned rules by (kind, hole). Within a group, take
the host types and their lowest common ancestor `A` in the type tree. Normalize each rule's tree
(drop `doc`, `label`, text; keep conditions and effects; a `transform`/`spawn` type that is the
host's own type or a prop of it is abstracted). If at least `K` types (default 3) under `A` have
*equivalent* normalized trees, and together they are at least a share `S` (default one half) of
the leaf types under `A` that the sweep reaches at this hole, the group is a candidate: "the
class `A`, at this hole, answers like this".

**S2 · A hole the class keeps falling into.** The coverage sweep (`tools/src/coverage.ts`) counts
undefined cells per (hole, class). A class whose cells at one hole were asked about `N` times
(default 5) in the live log, answered or not, is a candidate for an *authored hole with a
default* or a class rule, even before S1 converges: the question itself is the evidence that the
base says nothing where players keep looking.

**S3 · The person's own request.** `npm run upstream -- propose <hole> <class>` with a note. The
user said "slimes and wolves belong in the base"; that is this signal by hand.

Not a signal (for now): the fire-axe kind of case, where every step is defined and the gap is a
combination the base ignores. It needs an authored hole first (design.md §5.16, the base's
general cases); the lint that finds such combinations (an answering rule reads none of the props
that distinguish the host from its class) is a separate tool, and its output feeds S2.

## 3. The task: a repository, an issue, tests the agent cannot touch

The agent is `packages/agent` (loop.ts), as for engine tasks (`tools/src/engine-tasks.ts`), with
the workspace machinery of those: a copy of the repository with `games/openworld/content` writable and
`packages/engine` read only, dependencies linked in, line endings normalized, run in the
`lsw-sandbox` container (no network, no `.env`).

**The issue** (`ISSUE.md`): the hole (the base rule's id and the branch, quoted from `rules.ts`),
the class `A` and its leaf types, the evidence: each learned rule (host, tree, the scene it
answered, how many cells of the sweep it answered), and the ask: write **one base rule on `A`**
(or a narrower class, never an instance) for this kind at this hole that gives these outcomes,
with `inherit` for what it does not answer; keep the existing base rules' outcomes; add it to the
right block of `rules.ts`; a `doc`; a `label` if an input reaches it.

**The tests** (the judge, generated outside the workspace, read only there):

1. **Promotion.** For each learned rule the proposal subsumes: replay its asking scene under the
   new base; it must resolve to a base rule (not a hole), and the derived expectations of the
   learned rule (its `resolvedBy` aside) must hold: the same statuses gained and lost, numbers
   moved the same way, the same things spawned or destroyed.
2. **No defined outcome changes.** The coverage sweep, run on the base before and after: every
   cell that was `specific` or `generic` resolves to the same rule id, except cells the proposal
   is for (undefined before). The existing baseline test ("never takes a purpose away") stays.
3. **The content suite.** `vitest run games/openworld/content games/openworld/tools` (ties among base rules, the
   validator sweep, the demo's completeness, the economy and yield sweeps, `check:world`).
4. **Bounds.** The diff touches only `games/openworld/content/src/rules.ts` (and `items.ts` /
   `ontology.ts` when a type or status is needed), at most `L` lines (default 80), one new rule
   (plus at most one type or status).

The task is solved when all four pass. The agent sees the test commands and their output; it
never edits them (they live outside the workspace, like the engine tasks' hidden tests).

**The verdict and the proposal.** A solved task becomes a branch `upstream/<hole>-<class>` and a
pull request against `main` (`gh pr create`), with the issue, the evidence, the diff and the
tests' output in its body, labelled `upstream`. A person merges. Nothing in the running world
changes until then.

## 4. After the merge

- The service's `library prune` (and every client's `restoreLibrary` and sync) drops the learned
  rules the base now answers: their asking scenes resolve to the base ("the triggering event is
  already defined by …"), which the validator reports. `RuleLibrary.stale()` lists what grew below
  them.
- The curriculum's next sweep measures the gain: cells answered by the new base rule.
- The episode is recorded in the self-state like any other (`kind: 'upstream'`), with the
  outcome `merged` / `declined` / `stale` as the PR closes; reflection runs on it; the outer loop
  may replay it.

## 5. Guard rails

- **The judges are outside the self-state** (rsi.md §6): the generated promotion test, the
  coverage regression, the content suite and the human merge.
- **The engine is never in the workspace writable.** A proposal that needs a primitive is an
  engine task (rsi.md §3.3), a separate kind with its own hidden tests.
- **One hole, one class, one rule per proposal**; a size bound; no more than one open proposal
  per (hole, class); a daily budget of proposals and of model spend.
- **No live effect.** The live path keeps answering per type while the proposal waits; after the
  merge those answers are retired, not rewritten.

## 6. Where it goes

| Piece | Where |
|---|---|
| candidate detection (S1, S2), tree normalization and equivalence | `packages/modder/src/promote.ts` |
| the task: workspace, issue, generated tests | `games/openworld/tools/src/upstream.ts` (reusing `engine-tasks.ts`'s workspace and `agent/env.ts`'s isolation) |
| the promotion test template | `games/openworld/tools/tasks/upstream/promotion.test.ts.tmpl` |
| the driver | `npm run upstream -- scan \| propose <hole> <class> \| status` |
| the record | `var/modder-state/memory/episodes/<id>.json` with `kind: 'upstream'`; `harness/CHANGELOG.md` untouched (this is content, not the harness) |

## 7. Cost

One offline episode per proposal: engine tasks took 9–16 steps, 75–133 s, $0.06–0.09 on Kimi
K3 (rsi.md §9); a content rule is simpler than a primitive. The candidate scan is code and runs
on every curriculum checkpoint.

## 8. Open questions for the user

1. Thresholds `K`, `S`, `N`: start at 3, one half, 5?
2. Should S2 propose an *authored hole with a default* (keeps the AI's room) or a defined class
   rule? Proposal: the agent chooses and says why; the reviewer decides.
3. Merge by a person always, or auto-merge when the four tests pass and the diff is within
   bounds? Proposal: a person, until ten proposals have been reviewed.
4. Does a declined proposal teach the agent (a lesson), or only the record?

## 9. As built (2026-10-09)

| Piece | File |
|---|---|
| S1 and S2, `normalizeTree` / `normalKey`, `lowestCommonAncestor`, `askedCounts` (every question the log took, by `type|kind|hole`), `candidates()` | `packages/modder/src/promote.ts` |
| the workspace (`contentWorkspace`: the engine's files read-only and hashed; the judge's sweep runner in `.upstream/`, out of the diff), the issue (`issueFor`, the hole quoted from its source by `holeSource`), the promotion cases (`promotionCases`, derive.ts's `effectsOf` without `resolvedBy`) and test (`promotionTest`), the coverage regression (`compareSweeps`: a defined cell keeps its rule; what is newly defined is at the hole, on the class), the bounds (`checkBounds`), the task (`upstreamTask`), the proposal (`openProposal`: a branch `upstream/<hole>-<class>` from HEAD in a temporary worktree, the diff applied, pushed, `gh pr create --base main --label upstream`), the guard rails (`Proposals`: `var/upstream/open.json`, one open per hole and class, a daily cap), the driver (`propose`, `scan`, `byHand`, `status`) | `games/openworld/tools/src/upstream.ts` |
| the promotion test template (`/*__CASES__*/` takes the cases) | `games/openworld/tools/tasks/upstream/promotion.test.ts.tmpl` |
| the sweep's cells carry `open`, the key an answer would go to (`type|kind|hole`): the class's reach at a hole | `games/openworld/tools/src/coverage.ts` |
| tests: three slimes alike → one S1 candidate; a differing sibling apart; S2 at five questions; the task's issue; the promotion test failing on the content as it is and passing with a class rule; the whole verdict; the bounds and the regression | `packages/modder/test/promote.test.ts`, `games/openworld/tools/test/upstream.test.ts` |

```
npm run upstream -- scan [--data var] [--sweep]          # the candidates now; --sweep adds the sweep's reach and each learned rule's cells
npm run upstream -- propose --candidate <n> [--sweep]    # one proposal: the task, the agent, the verdict, the PR
npm run upstream -- propose <hole> <class> [--kind k] [--note …]   # S3, by hand
npm run upstream -- … --dry                              # build the task and print its issue; no model
npm run upstream -- … --max 3 --L 80 --state <dir> --preset tuned
npm run upstream -- status                               # the proposals and how they stand (gh says merged / declined)
```

The record: the episode (`kind: 'upstream'`, the PR url in its `submission`, the new rule's id in
`rules`) in the modder's self-state (`var/modder-state`), and the proposal in `var/upstream/open.json`.
What §4 describes after the merge (`library prune`, the next sweep) needs nothing new: the base
answers the scenes, the validator reports it, the learned rules go.

Deviations from the design above: the verdict runs the content suite only (`vitest run
games/openworld/content`; the tools' suite — the demo's completeness, the baseline — is not in the
workspace, which holds the engine and the content as the engine tasks do); a proposal is judged
locally with the person running it (`localRun`), or in the `lsw-sandbox` container unattended, as
engine tasks are; the regression also refuses a rule that newly answers cells outside the hole and
class proposed (the bound "one hole, one class" made checkable).
