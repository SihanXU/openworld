# The self-improving modder (RSI)

Status (2026-10-01): **built and smoke-tested end to end; no experiment has been run yet.**

- The model is Kimi K3 via OpenRouter.
- Evaluation is an external **SWE-like benchmark**, run by the team on self-state snapshots
  (§7). This codebase provides the agent that runs on it.
- The demo game shows none of this: it stays a clean game, and its live path (design.md §13) is
  not part of the claim.

## 1. The claim

Patching the world is not, by itself, recursive self-improvement. Each accepted patch makes
the **world** better — one more rule in the library — but leaves the **coder** unchanged: the
next hard request starts from scratch.

The claim is about the coder. While it works the world, the modder accumulates a
**self-state** of its own:

- **memory** — what happened on every task and what it learned from it;
- **skills** — procedures, with scripts, that it wrote for itself and keeps using;
- **harness** — the settings of its own working loop, notes to itself, and **hooks**: code it
  wrote that runs at fixed points of that loop.

RSI is shown when the self-state it forms *on its own* makes the same frozen model better at
**harder coding tasks it never saw**: SWE-like tasks on other repositories, not just more
patches of the same kind. The improvement lives entirely in the self-state, which is code and
text we can read, version, ablate and roll back.

## 2. Why this world is a good place for it

| Property | Where it comes from |
|---|---|
| An endless stream of **real** coding tasks | every undefined interaction a player reaches is a task; the coverage sweep enumerates the untouched space as a curriculum; some need engine code (§3.3) |
| A **free, executable verifier** | `validatePatch` (schema, ontology, conflicts, sandbox replay, the patch's tests, regression), and the engine's vitest suite: objective feedback, no human grading |
| **Difficulty that rises by itself** | the larger the library, the more a new rule can conflict with and the deeper the chains it joins; more requests need a new primitive, which is engine work |
| **Credit assignment** | every rule carries provenance; every self-state change is tied to the episodes and the replays that justified it |

## 3. One agent, every kind of task

The world must train what the benchmark measures. So the modder that improves is an
**SWE-style agent** (`packages/ai/src/agent`): it works every task as a repository, with the ordinary
tools of an engineer. World tasks are one adapter of it; benchmark repositories are another.

```
task      = workspace (a repository) + issue + test command + verdict
tools     = list_dir, read_file, search, write_file, edit_file, run, run_tests, read_skill, submit
loop      = agent.* settings · notes · skills · hooks   ← the self-state, nothing hard-wired
verdict   = the task's own: the validator, hidden tests, the visible tests
```

### 3.1 The loop (`loop.ts`)

1. **Prepare.** The issue, the agent's skills (with their scripts) and its hooks are written
   into `.agent/` in the workspace. That directory is kept out of the diff.
2. **Start hooks** run. Whatever they print is shown with the task.
3. **Recall.** Relevant lessons and similar past tasks.
4. **Work.** Model turns with tools, under a step budget, with tool output clipped and old
   output trimmed. An empty turn is a provider failure: the call is repeated.
5. **Submit.** Presubmit hooks run first, and may block the submission with a message.
6. **Verdict and record.** The task's verdict decides the outcome. The episode is recorded
   with the diff, every test run, the tool calls, and per-call time, tokens and cost.

Two starting points (`outer.ts` `applyPreset`):
- **naive** — the bare loop: no notes, no hooks, no skills. Every self-improvement run starts
  here.
- **tuned** — the human reference arm. A start hook finds the files that mention the issue's
  identifiers; a presubmit hook blocks submissions while the tests fail; there are three
  working notes, and the agent plans first.

They are made of the same kinds of things the outer loop may add, so a run can be compared
with them.

### 3.2 World tasks as repositories (`modder/src/repo.ts`)

| In the repository | What it is |
|---|---|
| `ISSUE.md` | the undefined interaction |
| `MODSPEC.md` | the docs |
| `rules/**/*.json` | the codebase: every rule, one file each |
| `ontology/` | types, statuses, terrains, elements, vfx |
| `request.json` | the request with the triggering scenario |
| `node validate.mjs` | the tests: the engine's validator on what was added |

The agent adds rules under `rules/patch/`. They are collected into a Patch and committed to
the shared library like any other. The offline profile uses this; the live demo path stays the
fast one-call pipeline.

### 3.3 Engine tasks (`tools/src/engine-tasks.ts`)

When a request needs a new primitive, condition or expectation, the task is the engine's code:
- **Workspace:** a copy of `packages/engine` and `games/openworld/content` as its own git repository;
  dependencies are linked in and line endings normalized.
- **Task:** an issue, plus a **hidden fail-to-pass test** (SWE-bench style). It is solved when
  the hidden test passes and so does everything else.
- **Tasks so far:** `toggle-status` (a new effect primitive: types, runner, docs, validator)
  and `prop-eq` (a new test expectation).
- **Upstream proposals** are a task kind too (`tools/src/upstream.ts`, docs/upstream.md): the
  content's base rules as the repository, the engine read-only, a generated promotion test and the
  coverage regression as the hidden judge; a solved task is a pull request a person merges.

### 3.4 SWE-like instances (`agent/src/swe.ts`, `npm run agent -- swe`)

- **Input:** SWE-bench instances — `instance_id`, `repo` (GitHub name, URL or local path),
  `base_commit`, `problem_statement`, optional `test_cmd`, `image` and `workdir`.
- **Output:** `predictions.jsonl` (`instance_id`, `model_name_or_path`, `model_patch`), the
  format SWE-bench evaluation reads; `<out>.runs.jsonl`, a record per instance (outcome, steps,
  tokens, cost, time, providers); `<out>.manifest.json`, what ties the run to one model and one
  self-state (a resumed run must match it).
- **Repositories:** locally, mirrored once, then checked out per instance at the base commit. In
  Docker, the image's own `/testbed` is copied out and mounted back, so the environment's in-place
  build is there; the diff is taken against where the image left the repository (`refs/lsw/base`).
- **Environments:** local processes, or `--env docker` (a container per instance, no network; the
  image the instance names, else a template, SWE-bench naming by default; a Linux node mounted for
  the agent's hooks). `--workers N` runs N at a time, `--ablate` leaves parts of the self-state out,
  `--resume` continues a run. Details and the faults this fixed: docs/rsi-experiments.md §4.3.
- **No learning on the benchmark:** the self-state runs from a fork, and nothing is recorded.

## 4. Three loops

```
inner   task → agent → verdict → (world: commit to the shared library)
middle  episode → lessons, skills (state.ts reflectAgent)
outer   evidence → one proposal → replay base vs candidate → keep or reject (outer.ts)
```

### 4.1 Middle: reflection

After every recorded task (a world task, an engine task, a task from the history, an upstream
proposal; `reflectAfter`, not after a failure that is the backend's), the model reads the episode:
test runs, failures, tools used, its rules on file, similar past tasks, and what it keeps on this
kind of task. It writes two places only:

- **Global rules** (the lessons): one sentence that holds for every task of this kind (filed under
  `task:world` for world tasks, `kind:<kind>` for the others) or for engineering in any repository
  (`"scope": "general"`, no terms, shown on every task, an SWE instance's too). A rule about a time
  limit or about answering fast is never general. One rule is added a reflection at most; the code
  keeps the first new one and files a timed rule under its kind.
- **This kind of task** (its node): a world request's node is the event kind, the hole, and the
  host's class and the other role's (the target, else the source), each cut at depth 2 of the type
  tree (`skillNodeOf`; a terrain is `tile`). Being one depth, no node holds another. A task of
  another kind is its own node, `kind:<kind>`. A node has one skill at most, named from the node.
  - With a skill, the reflection rewrites it whole when the task taught something about its kind
    (at most 40 lines, merged, not appended).
  - Without one, it keeps what the task taught as a note on the node (`memory/pending.json`).
    Only the reflections read the notes: the design and the agent see the node's skill, not them.
  - A node is worth a skill once it has recurred (`reflect.skillMinRecurrence` tasks, 3 by
    default) and gone wrong (a note on file, or this task sent back or failed). The skill is
    written then, from the notes and this task, and the notes go.

A batch of clean live episodes (several kinds) writes rules only. A task is shown its node's skill
whole in a one-call design (which has no `read_skill`), first in an agent's list otherwise; older
skills without a node are shown by their triggers. Skills are booked against outcomes and retired
when they keep doing worse than average; nothing is replayed before a skill is kept.

### 4.2 Outer: the agent improves its own loop

1. **Evidence.** The agent's recent tasks: outcomes, steps, failing test runs and their last
   failure, tool use, cost. With them, its current settings, notes, skills, lessons, and every
   earlier proposal with its verdict.
2. **One proposal**, exactly one of:
   - a **setting** (bounded: steps, reasoning, temperature, tool-output size, plan first,
     recall sizes);
   - a **note** (≤ 12);
   - a **skill** (markdown + scripts);
   - a **hook**: code for `start` or `presubmit`, as an ES module run with node in the task
     sandbox. Its environment is `TASK_ISSUE`, `TASK_TESTS` and `TASK_KIND`; it has a 120 s
     limit and no network.
3. **Meta-validation.** Recorded tasks are replayed twice, on two forks of the self-state: the
   current one and the candidate. For world tasks the library is rolled back to before each
   task was answered; tasks that are answered some other way by now are skipped.
   - A fixed **selection set** decides.
   - A separate **confirmation set** guards against fitting the selection set over many
     proposals.
   - Both sets are drawn once and kept (`memory/replay-sets.json`).
4. **Keep** only if, on both sets:
   - the pass rate does not drop;
   - cost, steps or time improve by at least 10 % (strictly);
   - none of them gets more than 10 % worse (time may be given a wider margin of its own, `timeMargin`, where the
     clock is noise beside what is judged: the tests on a busy machine; the default is the same 10 %).

   A kept change is written to the real self-state with its evidence (`harness/CHANGELOG.md`).
   Every proposal, kept or not, is journaled with its numbers.

## 5. The self-state

A directory beside the shared library (`var/modder-state/`), versioned by an append-only
journal and snapshots:

```
modder-state/
  memory/
    episodes/<id>.json          # task, every test run, tools, recall, calls (time, tokens, cost), diff or patch
    index.jsonl                 # what retrieval reads
    lessons.json / lessons.md   # the global rules, each linked to its episodes
    pending.json                # notes on a kind of task with no skill yet, by node
    replay-sets.json            # the outer loop's fixed selection and confirmation sets
  skills/<name>/SKILL.md (+ scripts), skills/index.json   # one skill a node (its name from the node)
  harness/
    pipeline.json               # agent.* settings, notes; the patch pipeline's live/offline profiles
    hooks/<stage>/<name>.mjs    # code the agent wrote for its own loop
    CHANGELOG.md                # every harness change and the evidence for it
  journal.jsonl                 # every write, every proposal, every reflection (with cost)
  snapshots/<label>/            # frozen copies + meta.json + SELF.md
```

**Ablations** come from opening a state with parts left out: no memory, no skills, or the naive
harness (`SelfState.open(dir, clock, ['memory' | 'skills' | 'harness'])`). A part left out is
neither read nor written: without skills, no skill falls due and the reflection writes none (one
on file is left as it was, unread) while the notes stay; without memory, no rule or note is kept.

### 5.1 A craftsperson's notebook

Each craftsperson a player researches with (a person with the `craftsperson` tag) has a
self-state of their own under `modder-state/people/<name>/`, laid out as above. They learn apart:
what Garrick keeps, Mira never reads.

- **Recall.** Before a conversation the craftsperson reads their rules and their skill (one node,
  `research`): `researchConversation(model, request, notebook)`.
- **Record.** Every turn is an episode. Talk alone (a question, a refusal) is kept as it is. A
  proposal waits for the game to say what came of it.
- **Outcome.** The game reports once, as a code (`POST /research/outcome`, `readResearchOutcome`):
  `made` when the trial craft succeeded, `refused` with the game's problem code, `left` when the
  player talked on or walked off without trying it.
- **Reflect.** After an outcome, one reflection call writes the craftsperson's rules and, once the
  kind of task has recurred and gone wrong, their skill (`keepReflection`, the same format as the
  modder's). Players' words are data: the reflection keeps nothing a player told the craftsperson
  to believe, and the game rechecks every proposal whatever the notebook says.
- **Measure.** `npm run eval:research-rsi` runs the research cases with an empty notebook, trains
  one craftsperson on a separate set of requests (outcomes told back, reflections awaited), and
  runs the cases again on a frozen copy of what was learned: pass rate and time, side by side.

## 6. Guard rails

1. **The judges are outside the self-state.** The validator, hidden tests, task tests, replay
   sets and the external benchmark cannot be changed by the agent.
2. **The engine stays the trust boundary for the world.** Every patch passes `validatePatch`.
   Catch-all rules are rejected.
3. **Sandboxing.** Commands and hooks run with a scrubbed environment (never the model key) and
   time limits. Local processes are not an isolation boundary — they are only for our own
   world and engine tasks. Benchmark repositories run in containers.
4. **Bounded changes.** Settings have ranges; notes and hook code have size limits; hooks may
   not use the network.
5. **Everything is versioned.** Snapshots, the journal and the changelog make any change
   traceable and reversible.

## 7. Measuring

- **Checkpoints.** `npm run curriculum -- --checkpoint N` appends learning-curve numbers to
  `var/curves.jsonl`:
  - the demo world's coverage;
  - library size;
  - pass rate, steps, failing test runs, time and cost per task over the window;
  - total spend;
  - harness version, lessons, skills.

  At each checkpoint it also snapshots the self-state for the benchmark.
- **The benchmark.** The team runs `npm run agent -- swe --state <snapshot>` on its SWE-like
  instances and evaluates the predictions.
- **Ablations and reference arms:** the naive harness, the tuned harness, and the self-state
  with memory, skills or harness left out.

### The rule bench (`npm run rulebench`)

Whether the reflection helps, in the world's own work: 200 holes of the sweep frozen at a commit
(`games/openworld/ai/bench/rulebench.json`), 20 kinds of task (nodes, §4.1) of 10 holes each. Every hole is a
place of its own (no two share a `type|kind|hole`), so none is answered by another's patch: what recurs is the kind,
never the hole. Two arms work the same holes in the same order, live, each from an empty library and self-state:
`on` reflects and recalls; `off` has memory and skills left out and does not reflect. A rep shuffles the nodes'
order. The report gives, per arm and paired hole by hole, how many were accepted and whose first answer held
(McNemar exact), the calls, the tokens (the design's, and with the reflections'), the time; and each of these by the
hole's place among its kind (the first of its node … the tenth): with reflection the later ones should be better,
without it the curve should be flat.

```bash
npm run rulebench -- build                       # choose and freeze the holes (no model)
npm run rulebench -- run --arm on --rep 1        # LSW_MODEL_BACKEND=claude-code, or a pinned model
npm run rulebench -- run --arm off --rep 1
npm run rulebench -- report
```

## 8. Commands

```bash
npm run curriculum -- --n 20 --checkpoint 10 --improve-every 10 [--engine] [--budget 5]
npm run improve -- --select 8 --confirm 8                 # one outer-loop turn
npm run engine-task -- toggle-status --state <dir> [--preset tuned]
npm run agent -- preset naive|tuned --state <dir>
npm run agent -- swe --instances <file> --state <snapshot> --out predictions.jsonl [--env docker]
npm run agent -- task --dir <repo> --issue <file> --tests <cmd> --state <dir>
npm run modder -- snapshot <label> | export [label] | stats
```

## 9. Smoke tests (2026-10-01, Kimi K3, about $1 in all)

| What | Result |
|---|---|
| World tasks as repositories (naive agent, 3 Hearthvale interactions) | 3/3 accepted, 5–24 steps, 40–200 s, $0.33. Hearthvale's undefined interactions went 6022 → 5963 (the rules generalize) |
| Engine task `toggle-status` | solved (hidden test + suite pass), 16 steps, 133 s, $0.09 |
| Engine task `prop-eq` | solved with a clean 3-file diff (types, checker, ModSpec docs), 9 steps, 75 s, $0.06 |
| SWE CLI on a local instance | correct diff in `predictions.jsonl`, 5 steps, 26 s, $0.01 |
| One outer-loop turn (1 selection + 1 confirmation task) | proposed a note grounded in its record (one task needed 24 steps and 2 failing test runs); replay gain ~6 %, below the bar → rejected, $0.20 |

Found while testing:
- **Providers.** OpenRouter's cheapest Kimi providers sometimes return empty turns on tool
  calls, so the agent pins providers by reliability (Moonshot, Parasail, Together), and an
  empty turn is retried.
- **Line endings.** A Windows checkout's CRLF made an agent's whole-file write look like a
  rewrite, so engine workspaces are normalized to LF.

**Not tested here:** the docker environment (no docker on this machine), and anything at
experiment scale.
