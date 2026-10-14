# RSI experiments: design

Status: **agreed (2026-10-14)**: the four decisions in §2, then the recommendations of §11 (Q0–Q5),
agreed with the user the same day. Built so far: §10 steps 1 and 2 — the pool counted (§4.1: the
agreed pool did not exist, so Q0 was decided again: A + B, A's miner in fresh-pool.md, proposed) and
the SWE faults F1–F4 fixed (§4.3).

This document turns the paper's second claim (rsi.md §1, the paper's §2.9) into experiments: what
is measured, on what, from which self-states, with which controls, and what must be fixed in the
code first. The machinery it uses is built and smoke-tested (rsi.md §3–§9); no experiment has run.

## 1. What the experiments must show

The claim: with the model's weights frozen, the self-state the modder forms *on its own* while it
works the world makes it better at coding tasks harder than world patches, which it never saw.

$$\mathrm{Perf}(\pi_{\theta, M_{t_k}}; \mathcal{B}) \text{ increasing in } k$$

Four hypotheses, each with its own evidence:

| | Hypothesis | Evidence | Control |
|---|---|---|---|
| H1 | **Transfer.** Snapshot $M_{t_k}$ resolves more of the external benchmark than the naive start $M_{t_0}$ | the benchmark's resolve rate per snapshot (§4: a fresh pool the model cannot have seen; Verified only for the pilot) | the naive start on the same model; the snapshot also with its step cap held at the naive 40 |
| H2 | **Attribution.** The gain lives in the parts of the self-state | the final snapshot with memory, skills or harness left out (`SelfState.open(dir, clock, ablate)`) | the full snapshot |
| H3 | **The world matters.** A self-state formed on the *growing* world beats one formed with the same budget on the world as it was at $t_0$ | arm G against arm F (§6.3) on the benchmark and on the ladder | the frozen-world arm F |
| H4 | **In-domain growth.** The agent gets better at the world's own harder tasks, including ones from its future | the ladder's pass rate per rung, on tasks mined after the snapshot (§5.5) | the naive start on the same tasks |

H3 is what makes this the paper's claim rather than "an agent with memory": without it the world is
only a task source. H4 is the world's own learning curve and costs little, because the tasks are
ours.

What does **not** count (rsi.md §1, paper §2.9): faster patching of interaction classes already
answered (that is amortization), and any gain bought with more compute. Every table reports cost and
steps beside the resolve rate, and the main comparison is also run with the step cap held at the
naive start's 40 (`NAIVE_AGENT.maxSteps`), since the outer loop may move that setting.

## 2. Decisions (agreed 2026-10-14)

| # | Decision | What it means here |
|---|---|---|
| D1 | The external benchmark is **SWE-bench Verified**, starting with a **t0 pilot** | **reopened the same day** (§4.1): Verified is saturated (Kimi K3 93.4 %) and contaminated. The pilot stays on Verified, to prove the chain and price a run; the measured benchmark is Q0 in §11 |
| D2 | The **task ladder is mined from this repository's history** | §5: commits with tests become fail-to-pass tasks, SWE-bench style; the collaborators' scaling keeps adding them |
| D3 | **Snapshots at world milestones**, not at episode counts | §6: a tagged world release is a milestone; the RSI curve's x axis is the size of the world |
| D4 | **One frozen model** for every RSI run | §3: chosen before any checkpoint runs, pinned to one provider and one precision, recorded per call |

## 3. The model (D4)

"Frozen" has to hold operationally, not just by name. Today it does not: the naive agent lets
OpenRouter fall back across three providers (`NAIVE_AGENT.provider`: moonshotai, parasail, together,
`allow_fallbacks: true`), and providers may serve the same model at different precisions and with
different inference stacks. For the RSI runs:

- one provider, no fallbacks (a failed call is retried on the same provider, then the step fails);
- temperature, reasoning setting and token limits fixed in a run manifest; the outer loop may still
  change the agent's own `temperature` and `reasoning` within their bounds (that is part of the
  harness), and every table reports them;
- the model id, the provider and the served precision recorded with every call (`Meter` already
  logs provider and usage; the manifest adds the rest), and a run whose calls disagree with its
  manifest is void.

The pin lives in the run manifest, outside the self-state, and overrides the harness's `provider`:
neither a preset nor the outer loop can move it.

The two candidates:

| | Kimi K3 via OpenRouter | Opus 5.5 via `claude -p` |
|---|---|---|
| Weights | **public** (released July 2026: 2.8T-parameter MoE, 104B active, a custom Kimi K3 license) — a reader can rerun the frozen θ | closed; the id may be retired |
| Pinning | one provider (Moonshot's own) at its stated precision | the id as `claude -p` resolves it |
| Sampling | temperature, as the harness sets it | none exposed: `--effort` only |
| Tool calls | native (OpenAI-compatible) | a text protocol over a tool-less session (`ClaudeCodeModel`) — not how the model is normally driven, a confound for transfer |
| Cost | per token | per token, or a subscription's rate limits |
| Headroom | none on Verified (93.4 %, §4.1); room on fresh tasks (its card: DeepSWE 67.5) | none on Verified either (Opus 5: 96.0 %); room on fresh tasks |
| Decontamination | tasks dated after its release (2026-07-16) are unseen | tasks dated after its knowledge cut-off (June 2026) are unseen |
| Use in the project so far | the model of every RSI smoke test and of most live-modder measurements | the `claude-code` backend of the live modder; the router's evaluation (design.md §13) |

**Recommendation: Kimi K3, Moonshot's provider only.** The deciding reasons are public weights (the
paper's "θ frozen" is checkable) and native tool calls; both models leave room on fresh tasks and
neither on Verified.

## 4. The benchmark (D1)

### 4.1 SWE-bench Verified, and why it cannot be the measured benchmark

What it is:
- 500 Python instances from 12 repositories (django 231, sympy 75, sphinx 44, matplotlib 34,
  scikit-learn 32, astropy 22, xarray 22, pytest 19, pylint 10, requests 8, seaborn 2, flask 1), each
  with a `difficulty`: under 15 minutes 194, 15 minutes to an hour 261, 1–4 hours 42, over 4 hours 3
  ([HF dataset](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified),
  [OpenAI's introduction](https://openai.com/index/introducing-swe-bench-verified/)).
- Evaluation with the `swebench` package (5.0.2): `swebench eval verified -p preds.jsonl --run-id <id>
  -j <workers>`, or the older `python -m swebench.harness.run_evaluation --dataset_name
  SWE-bench/SWE-bench_Verified --predictions_path preds.jsonl --max_workers 8 --run_id <id>`. One image
  per instance, `swebench/sweb.eval.x86_64.<id>` with `__` written `_1776_` (the template in `swe.ts`
  already does this), about 1.1 GB compressed each, 189 GiB of unique layers for the 500
  ([Epoch](https://epoch.ai/blog/swebench-docker)); at least 120 GB of disk, 16 GB of RAM, 8 cores;
  x86_64 (arm64 is experimental).
- How SWE-bench made its instances is the method §5.3 follows: merged PRs that touch tests, kept only
  if a test goes from failing to passing.

Why it cannot carry H1 (facts as of 2026-10-14):
- **Saturated.** Vals.ai's bash-only runs (mini-SWE-agent) put **Kimi K3 at 93.4 %** and Claude Opus 5
  at 97.0 %, and the page was archived on 2026-09-01 as saturated
  ([Vals](https://www.vals.ai/benchmarks/swebench)). The official leaderboard has taken no entry since
  2026-02-26.
- **Contaminated and partly broken.** OpenAI stopped reporting it on 2026-02-23: of the hard problems
  it audited, 59.4 % have materially flawed tests, and frontier models reproduce gold patches verbatim
  ([OpenAI](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)). Anthropic's Opus
  5.5 system card no longer reports it.

With the frozen model at about 93 % under an agent as plain as ours, what is left unsolved is mostly
flawed tests, and what is solved may be memory: a self-state's gain cannot show there. **D1 is
reopened** (§11, Q0). Verified stays for the pilot, where its mature images and harness test the
mechanics (§4.3, §4.4); the measured benchmark should be one the frozen model cannot have seen and has
room on:

| Candidate | What | Fit |
|---|---|---|
| [SWE-rebench](https://swe-rebench.com) | Python tasks mined continuously from fresh PRs; tasks dated against each model's release; five runs and a standard error as standard | decontaminated by date; the May–July 2026 window (111 tasks) tops out at 64.5 ± 1.4 (Fable 5): room |
| [SWE-bench-Live](https://arxiv.org/abs/2505.23419) | 1,319 tasks from issues since 2024, 93 repositories, automated environments, regular updates, now several languages | decontaminated by date; language mix to check |
| [Multi-SWE-bench](https://arxiv.org/abs/2504.02605) | 1,632 instances in 7 languages, TypeScript and JavaScript among them | the language match (§4.6); built in 2025, so likely in the model's training data |
| SWE-bench Pro | 1,865 tasks (731 public) | Opus 5.5 reports 89.9; OpenAI estimates about 30 % broken and retracted its recommendation |
| DeepSWE | 113 tasks written from scratch; Kimi K3's card reports 67.5 | room, but too few for §4.6's power |

**Recommendation: the union of SWE-rebench and SWE-bench-Live tasks created after Kimi K3's release
(API 2026-07-16; weights 2026-07-27), frozen as one list at `world-v0`**, so every snapshot meets the
same tasks and none of them can be in the frozen model's training data. Its size is the first thing to
count: §4.6 wants 300 or more. Each source has its own images and evaluation, so the pilot also runs
five of its tasks through the chain.

**Counted (2026-10-14; `python bench/pool.py count`, each dataset at the revision `pool.py` pins).**
The agreed pool does not exist yet: the public datasets lag the world by months, and none of them has
a Python task created on or after Kimi K3's release.

| Source | Tasks | Created | On or after 2026-07-16 |
|---|---|---|---|
| SWE-rebench leaderboard (`nebius/SWE-rebench-leaderboard`) | 860 | 2025-01-03 … 2026-05-12 | 0 |
| SWE-rebench V2 (`nebius/SWE-rebench-V2`) | 32,079 | 2014-11-10 … 2025-10-31 | 0 |
| SWE-bench-Live (`SWE-bench-Live/SWE-bench-Live`, Python) | 1,888 | 2021-07-22 … 2025-09-02 | 0 |
| SWE-bench-Live MultiLang (`SWE-bench-Live/MultiLang`) | 1,077 | 2020-06-29 … 2026-07-31 | **133**: Rust 32, C 31, Java 28, C++ 20, C# 17, JavaScript 5; no TypeScript |

(SWE-rebench V2's raw pull requests, `nebius/SWE-rebench-V2-PRs`, 126,300 without images, end on
2025-07-23.) The 133 are frozen as `bench/pools/post-k3.json` (39 repositories; every image found on
Docker Hub; identifiers and metadata only), the only pool that meets the date; they are few, in no language the world speaks, and concentrated (httrack 25, langchain4j 14,
duckdb 12). **Q0 is open again**, with these choices:

| | Choice | Size now | Decontaminated | Cost |
|---|---|---|---|---|
| A | **Mine fresh Python tasks ourselves**, SWE-rebench's way: merged pull requests created after 2026-07-16 that resolve an issue and change tests, in repositories whose environments SWE-rebench already built (their `install_config` and images), kept if a test goes from failing to passing in Docker; the statement is the real issue's text, so no model is called | unknown until mined; a sample of 50 repositories found 589 candidates, about 5,000 over the 427 with recent recipes, before validation (docs/fresh-pool.md §2) | by date | the Linux host's time and disk; the same method as the ladder's miner (§5.3) |
| B | **Take the 133 now** as the first slice, and add to it as A or the public datasets bring more | 133 (about 8–9 pp detectable, §4.6) | by date | none |
| C | **Move the date back** (from 2026-03: 110 Python tasks of SWE-rebench and about 650 of MultiLang) | ~760 | unknown: K3's training cut-off is not published | none |
| D | **Wait** for the next public releases (now about two months behind for SWE-rebench's leaderboard and MultiLang, a year for SWE-bench-Live's Python set) | — | by date | time |

Recommendation: **A, with B as its first slice** (the pilot's five come from B). A is the only
choice that gives a Python pool of the agreed size that the model cannot have seen, it keeps growing
as the experiment runs, and its method is the ladder's. **Agreed 2026-10-14**; A's miner is designed
in [fresh-pool.md](fresh-pool.md).

### 4.2 How the agent meets it

```
instances.jsonl ──npm run agent -- swe --state <snapshot> --env docker──▶ predictions.jsonl
                     (a fork of the snapshot, nothing recorded: swe.ts)
predictions.jsonl ──the benchmark's own evaluation (swebench eval …)──▶ resolved / unresolved per instance
```

The agent never sees the hidden tests; the official harness applies each prediction in a fresh
container and runs them. The self-state under evaluation is a throwaway fork (`swe.ts`:
`state.fork()`, `record: false`), so the benchmark never becomes training data.

### 4.3 What must be fixed before the pilot

Reading `packages/agent/src/swe.ts`, `env.ts` and `loop.ts` against the SWE-bench images' Dockerfile
templates (`swebench/harness/dockerfiles/python.py`, v4.0.4: Ubuntu with git, build tools, Python and
Miniconda; the repository installed in `/testbed` by `setup_repo.sh`; the `testbed` conda environment
activated from `/root/.bashrc`; no node) found four faults that would spoil a run. None was visible in
the smoke test (a local instance, no Docker).

| | Fault | Effect | Fix |
|---|---|---|---|
| F1 | `solve()` clones the repository on the host and bind-mounts the fresh checkout over the image's `/testbed` | the image's `/testbed` holds the environment's in-place build (compiled extensions for scikit-learn, astropy, matplotlib…); a fresh checkout hides it, so imports fail and the agent cannot run the repository's tests | copy `/testbed` out of the image (`docker cp`) into the workspace and mount that back. Commands run as `bash -lc`; the environment should come up through `/root/.profile` → `/root/.bashrc`, which the pilot checks on each repository |
| F2 | hooks run as `node .agent/hooks/…` inside the task's container | the images carry no node. A start hook then prints nothing useful, and a presubmit hook exits 127 — which counts as a block, so **the tuned arm, and any self-state that wrote a presubmit hook, can never submit** and burns its steps trying (the diff is still taken at the end, so the run looks merely worse, not broken) | mount a static node read-only into the container (`/opt/lsw/node`), on the hooks' PATH only |
| F3 | the CLI runs instances one after another, and has no `--ablate` | a pool of 300–500 tasks at ~10 minutes each is 50–80 hours per arm; ablations cannot be run from the command line | `--workers N` (one container each), `--ablate memory,skills,harness`, and a per-instance record (outcome, steps, tokens, cost, time, provider) beside `predictions.jsonl` |
| F4 | the model's provider is not pinned, and nothing ties a run to its model | §3 | the run manifest, checked against every call |

**As built (2026-10-14).** Fixed in `packages/agent` (`env.ts`, `swe.ts`, `loop.ts`, `model.ts`,
`cli.ts`), tested in `test/agent.test.ts` with a stand-in for the docker CLI (`test/fake-docker.mjs`:
an image is a directory, `exec` runs on the host), since this machine has no Docker. Reading the code
for F1 found two more faults of the same kind, fixed with it:

- **Git refused the workspace.** The workspace belongs to the host's user and the container's commands
  run as root, and git refuses a repository owned by someone else: the diff, taken in the container,
  would have been empty. Each container now starts with `git config --global --add safe.directory '*'`
  (`CONTAINER_SETUP`).
- **The diff began at HEAD**, so whatever the image's install had changed in tracked files would have
  been part of the answer, and would not apply where the evaluation's image has it already. The
  workspace's start is now `refs/lsw/base` (`freezeBaseline`): what the image left untracked is
  excluded, what it changed in tracked files is committed, and `gitDiff` diffs against that ref.

What each fix is now:

| | Fix |
|---|---|
| F1 | `DockerEnv.copyOut` (`docker create` + `docker cp`) brings the image's `/testbed` to the host; `freezeBaseline` marks where the agent began; the container mounts it back, runs `CONTAINER_SETUP` once and `IMAGE_INIT` (the `testbed` conda environment, where there is one) before every command, and gives the workspace back to the host's user (`chown`) before it goes. An instance names its own `image` and `workdir` (every image family checked — SWE-bench, SWE-rebench, SWE-bench-Live — keeps the repository in `/testbed` and runs as root) |
| F2 | `DockerEnv.start({ node })` mounts a Linux node read-only at `/opt/lsw/bin/node` (`HOOK_NODE`, on the host's Linux node by default, `LSW_HOOK_NODE` to choose one); hooks run with `env.node`; the agent's own commands keep the image's PATH |
| F3 | `npm run agent -- swe … --workers N --ablate memory,skills,harness --resume`; `<out>.runs.jsonl` holds each instance's outcome, steps, tokens, cost, time and providers; an existing predictions file is refused unless `--resume`, which skips what is done |
| F4 | `LSW_MODEL_PIN=moonshotai` (`LSW_MODEL_QUANT=fp8`): every request asks those providers only, with no fallback, overriding the harness; a reply from anyone else raises `PIN_BREACH`, and an instance that met it is void (no prediction; retried on resume). `<out>.manifest.json` holds the model, backend, pin, state, harness version, ablations, the instances' hash and the agent's code hash, and a resumed run whose manifest differs is refused |

Not yet checked against real Docker: the pilot (§4.4) does that on the Linux host.

### 4.4 The t0 pilot

- **Instances**: 20 from Verified, fixed in a file in the repository, stratified over the
  repositories (scikit-learn, astropy and matplotlib among them: their in-place builds test F1) and
  the difficulty buckets, with at least two from the hardest; plus 5 from the measured pool (§4.1),
  for its images and its evaluation.
- **Arms**: naive twice, tuned once.
- **Where**: the Linux host (Docker since 2026-10-03), four instances at a time.
- **What it measures**: whether the chain holds end to end (the prediction applies, the harness
  evaluates it), whether the tuned arm's hooks run and it submits, per-instance cost, steps and wall
  time. At about 93 % the two naive runs say little about noise; the noise floor comes from the
  baseline on the measured pool (§4.5).
- **Gates to go on**: the chain holds on at least 23 of 25 instances in every arm; the tuned arm
  submits on at least 18 of 25; the cost per instance is known. Otherwise fix and repeat the pilot.
- **Cost**: about 75 agent episodes, on the order of $10–50 (§8).
- **Frozen** as `bench/pools/pilot.json` (`python bench/pool.py pilot`): 20 Verified tasks (scikit-learn,
  astropy and matplotlib three each, django four, sphinx three, sympy and xarray two each; 7 under 15
  minutes, 9 of 15 minutes to an hour, 4 of 1–4 hours) and one MultiLang task each in C, C++, C#, Java and
  JavaScript. On the host:

```bash
python bench/pool.py fetch bench/pools/pilot.json                     # → var/bench/pilot.instances.jsonl
npm run agent -- preset naive --state var/rsi/naive
LSW_MODEL_PIN=moonshotai npm run agent -- swe --instances var/bench/pilot.instances.jsonl --state var/rsi/naive --env docker --workers 4 --out var/pilot/naive-1.jsonl
python bench/evaluate.py bench/pools/pilot.json var/pilot/naive-1.jsonl --run-id naive-1   # the benchmarks' own harnesses
```

### 4.5 The t0 baseline

After the pilot, on the measured pool frozen at `world-v0`: naive three times (the noise floor, and
the baseline every later snapshot is compared with), tuned once (the human reference). The team runs
the benchmark at scale (rsi.md §7); this design hands them the snapshot, the task list, the command
and the evaluation command, and the pilot shows the chain works.

### 4.6 Power, ceiling and the language gap

**Power.** Arms are compared instance by instance (McNemar on the discordant pairs). With $n$
instances and a share $d$ of them on which two arms disagree, the smallest difference detected at
$\alpha = 0.05$ with 80 % power is about $2.8\sqrt{d/n}$:

| $n$ | $d = 0.10$ | $d = 0.15$ | $d = 0.20$ |
|---|---|---|---|
| 100 | 8.9 pp | 10.8 pp | 12.5 pp |
| 200 | 6.3 pp | 7.7 pp | 8.9 pp |
| 300 | 5.1 pp | 6.3 pp | 7.2 pp |
| 500 | 4.0 pp | 4.8 pp | 5.6 pp |

$d$ is not small even between two runs of one agent: on Verified, Opus 4.8's score moved by under
1 pp across four repetitions while about 11 % of the instances flipped
([SWE-Proof](https://arxiv.org/abs/2609.21190)), and Anthropic advises scepticism about differences
under 3 pp ([infrastructure noise](https://www.anthropic.com/engineering/infrastructure-noise)). So a
gain of a few points needs 300 tasks or more, and the main comparisons (t0 naive against the final
snapshot; G against F) are run three times each and reported with their spread.

**Ceiling.** The measured pool must leave the frozen model room at $t_0$: if the naive start resolves
more than about 80 % of it, the pool is too easy for the gains we expect, and harder tasks of the
same sources are drawn instead. On Verified there is no room (§4.1).

**The language gap.** The measured pool is mostly Python (SWE-rebench is Python only; Verified is
too); every task the agent learns from in this world is TypeScript (rules as JSON, the engine,
vitest). Skills and hooks written for vitest will not apply;
what can transfer is the general part — lessons about reading failures and finding prior patterns,
hooks that locate related code, the loop's settings. This is a real risk for H1, and the reason for
the optional second benchmark in §11 (Q3): a language-matched one shows transfer where the domain
gap is smaller, the Python pool where it is largest.

## 5. The ladder (D2)

The paper's ladder — single rules, multi-rule mechanics, new engine primitives, whole gameplay
systems — is today one rung and two tasks: the curriculum's world holes (single rules) and two
hand-made engine tasks (`toggle-status`, `prop-eq`). The repository's own history fills the rest.

### 5.1 What the history offers

Measured from `origin/main` on 2026-10-14 (`git log --numstat`, nothing run yet):

- 229 commits that are not merges, from 8 authors, 2026-09-30 to 2026-10-14, about 15 a day;
- **156 change both tests and code** (tests: `test/` or `*.test.ts`; code: `.ts/.json` outside docs,
  wiki, assets, baselines and locales);
- their code changes: median 225 lines; 27 at most 50, 43 at 51–200, 42 at 201–800, 32 at
  801–3,000, 12 above 3,000 (whole phases and systems: Phase 1, Hearthvale, the event model's
  migration, the NPC sandbox, the quests, the format, languages — too large for one task at a
  40-step budget; left out, and named in the paper as the ladder's top that the agent does not yet
  reach);
- `package-lock.json` changed 11 times, so about a dozen dependency environments cover all of them;
- every commit is later than Kimi K3's release (the repository began on 2026-09-30), so no ladder
  task can be in the frozen model's training data.

At the present pace a week of the collaborators' work adds on the order of 70 candidates. That is the
point of D2: **the world's growth is itself the stream of harder tasks**, measured, not asserted.

### 5.2 Rungs

| Rung | What | Source | Candidates (before validation) |
|---|---|---|---|
| R1 | a single rule at one hole | the curriculum's world holes (offline profile, as now), and the few small content-only commits | unbounded (the sweep's undefined cells); 4 from history |
| R2 | a mechanic: several rules, types, statuses, or a small fix across two places | commits touching content and tools, or the kernel by ≤ 40 lines | 29 |
| R3 | an engine change: a primitive, a condition, behaviour, the modder | commits touching the engine, modules, format, stdlib, modder or agent, ≤ 800 lines | 47 |
| R4 | a system: four or more areas, or 801–3,000 lines | the larger commits | 64 |

Of the 140, 91 also touch the runtime or the editor (R2 9, R3 24, R4 58). Their tests are vitest too,
but some need a DOM or a browser; validation (§5.3) drops those that cannot run headless.

### 5.3 From a commit to a task

As SWE-bench builds its instances from pull requests, R2E-Gym from commits (the problem statement
written back from the diff and the failing tests), and SWE-bench Pro with a rewritten statement,
requirements and interface ([SWE-bench](https://arxiv.org/abs/2310.06770),
[R2E-Gym](https://arxiv.org/abs/2504.07164), [SWE-bench Pro](https://arxiv.org/abs/2509.16941)):

1. **Candidate**: a commit (or a merged PR's squashed range) that changes code and tests.
2. **Workspace**: the repository at the parent commit, the packages and games only (no docs,
   wiki or assets beyond what tests read), line endings normalized as `engineWorkspace` does; the
   dependencies of the parent's `package-lock.json`, installed once per lock in an image
   (`lsw-hist:<lock-hash>`, built from `lsw-sandbox`).
3. **Fail-to-pass**: apply the commit's test changes alone and run the touched test files with
   vitest's JSON reporter: the tests that fail are the candidates for FAIL_TO_PASS. Apply the whole
   commit: those that now pass are FAIL_TO_PASS; the tests of the touched files that pass before
   and after are PASS_TO_PASS. Keep the task only if FAIL_TO_PASS is not empty, the gold commit
   passes three times in a row (no flakes), and nothing needs the network or a browser.
4. **The issue**: written by a model from the commit message, the PR description (`gh pr view`), the
   diff and the test changes, as a bug report or feature request **without the solution**; with a
   *Requirements* and an *Interface* section naming the symbols and files the hidden tests import
   (as SWE-bench Pro does), since a test that imports a new function is unsolvable without its name.
   The writer is not the frozen agent model (Sonnet 5.5 through `claude-code`, since the agent is Kimi K3).
5. **Leakage checks**: no line of the gold patch's added code in the issue (an n-gram check), no test
   name that gives the answer away, and a person reads 20 issues at random before the first run.
6. **The task**: `games/openworld/tools/tasks/history/<sha>/` with `ISSUE.md`, `meta.json` (commit,
   parent, rung, lock hash, FAIL_TO_PASS, PASS_TO_PASS, the test command) and `hidden.patch` (the
   test changes). The verdict is the engine tasks' (`engine-tasks.ts`): the hidden tests pass, and so
   does everything that passed before. Unattended, it runs only in a container (rsi.md §6).

The miner is a generalization of `engineWorkspace` and `engineTask`: the same workspace, the same
verdict, at any commit.

**As built (2026-10-14)** — `games/openworld/tools/src/ladder.ts` (`npm run ladder -- candidates | validate |
issues | status`), tested in `games/openworld/tools/test/ladder.test.ts`:
- **candidates**: 144 commits on `origin/main` (R1 4, R2 29, R3 47, R4 64; 11 lockfiles), each with its parent,
  test files, code files, rung and the parent's lockfile.
- **the workspace** of a parent: `git archive` of what tests need (the packages and games and their configs —
  not the docs, the wiki, the served assets, nor `games/openworld/tools/tasks`, so no task's hidden tests are
  in another's workspace), LF throughout, a repository of its own; the dependencies of its lockfile installed
  once (`var/ladder/deps/<lock>`, `npm ci`) and linked in, its own packages to its own copies.
- **validate**: the test changes alone, three runs of the commit's test files (vitest's JSON report); the
  whole commit, three more; FAIL_TO_PASS, PASS_TO_PASS and regressions by the fresh pool's rule. Our own code,
  so it runs on this machine; the agent that works the tasks runs only in a container.
- **issues**: a model (the configured backend; Sonnet 5.5 through `claude-code` for these) writes each validated
  commit's issue from the commit message, its pull request, the change and the test changes, with
  Requirements and an Interface section; an issue that quotes six consecutive added lines of the change is
  asked again, then dropped. A task is `games/openworld/tools/tasks/history/<sha>/`: `ISSUE.md`, `meta.json`,
  `hidden.patch`.
- **the task** (`historyTask`, `historySource`): the parent's workspace, the commit's test files as they were for
  the agent to run, and the verdict — the hidden test changes applied, every FAIL_TO_PASS and PASS_TO_PASS test
  passing; the curriculum works one every other step (`npm run curriculum -- --ladder [--until <day>]`), and the
  outer loop replays them.

### 5.4 Yield and a fallback

**Measured (2026-10-14):** of the 144 candidates (R1 4, R2 29, R3 47, R4 64), **125 validated** — R1 3,
R2 23, R3 46, R4 53 — with a median of 6 FAIL_TO_PASS tests (at most 177); dropped: 7 with no test going from
failing to passing, 5 where a test that passed before fails after, 5 whose tests do not run headless, 1 slower
than five minutes a run, 1 whose test changes lie in `games/openworld/tools/tasks` (kept out of workspaces). All
125 issues are Sonnet 5.5's (through `claude -p`), a median of about 1,000 words; none quotes six
consecutive lines of its change or names a hidden test file. The person's reading of 20 (§5.3, 5) is
`npm run ladder -- review` → `var/ladder/review.md`. The planning figure was half; the fallback below is not
needed. **If fewer than 40 tasks survive across R2–R4**, the ladder is topped up by
injected bugs on the current tree (SWE-smith's method, [arXiv 2504.21798](https://arxiv.org/abs/2504.21798):
break a function the tests cover, keep it if a passing test then fails, the issue written from the
diff and the failing test), labelled as synthetic and kept out of H4's held-out sets.

### 5.5 The temporal split

Each task has a date. A milestone (§6) splits the history into windows: the tasks of window $k$ (the
commits between milestones $k-1$ and $k$) are, for snapshot $k-1$, **tasks from its future**,
which it cannot have seen. So:

- **held-out (H4)**: snapshot $k-1$ and the naive start on window $k$'s tasks, once they exist;
- **curriculum**: from milestone $k$ on, window $k$'s tasks join the pool the agent works.

Window 0 is the whole history before $t_0$ (the 144 candidates of R1–R4): the curriculum's ladder
from the start. The paper's "difficulty rises by itself" gets numbers per window: the gold patches' size and
spread, the tests they need, the naive start's pass rate on them.

## 6. Milestones and snapshots (D3)

### 6.1 A milestone

A milestone is a tag `world-vN` on `main`, cut by a person when the content team lands a release, at
least a week apart; four to six over the scaling period. `world-v0` is cut before the first
curriculum run and is $t_0$. Commits land several times a day, so a snapshot per merge would cost a
benchmark run per merge; a tag is the unit the team already thinks in. For the paper's runs this
replaces the episode-count checkpoints of rsi.md §7 (`--checkpoint N`); `curves.jsonl` keeps its
numbers between milestones.

The world's size at each tag is the x axis: maps, people and creatures, item kinds, types, base
rules, learned rules, the sweep's cells and the share undefined (the world-side harness reports these;
docs/paper-eval.md when it lands).

### 6.2 At each milestone

1. Tag `world-vN`; build the world at the tag.
2. Mine window $N$ (§5.3).
3. **Held-out**: snapshot $N-1$ and the naive start on window $N$'s tasks (H4).
4. **Curriculum** on the G arm (§6.3) with a fixed budget per milestone, the same for every
   milestone: world holes at the tag (R1, offline profile), ladder tasks from windows $\le N$ (R2–R4),
   the outer loop every 10 episodes. The mix is fixed in advance (proposal: half R1, half R2–R4,
   the rungs in proportion to the pool) so the budget does not drift to whatever is cheap.
5. **Snapshot** `world-vN` with its meta (the tag's commit, the world's size, episodes, spend,
   harness version, lessons, skills, hooks).
6. **Benchmark**: the measured pool (§4.1) on the snapshot (the team), plus the cheap in-domain sets.

### 6.3 Arms

| Arm | Self-state | Runs on | When |
|---|---|---|---|
| naive | the naive preset | benchmark, ladder | t0 (×3), and on each new window's tasks |
| tuned | the human reference preset | benchmark, ladder | t0 |
| **G** | the curriculum on the growing world | benchmark, ladder | every milestone |
| **F** | the same budget per milestone on `world-v0` only: its holes and window 0's tasks | benchmark, ladder | the middle and the last milestone |
| G − memory / − skills / − harness | the last G snapshot with a part left out | benchmark | the last milestone (and the middle, if the budget allows) |
| G, steps capped | the last G snapshot with `maxSteps` held at 40 | benchmark | the last milestone |

F answers H3. Its budget is matched to G episode for episode, so the only difference is what the
world posed.

### 6.4 As built (2026-10-14)

`games/openworld/tools/src/rsi.ts` (`npm run rsi -- plan | milestone | heldout <tag> --arm G|F`), its plan tested in
`games/openworld/tools/test/rsi.test.ts`:
- the milestones are the tags `world-v*`, by their commits' dates; a milestone's window is the ladder tasks dated
  after the previous tag and up to this one;
- **held-out**: the arm's previous snapshot and the naive start (the naive harness, no memory, no skills), each a
  throwaway fork, on the window's tasks, nothing recorded → `var/rsi/<arm>/heldout/<tag>.jsonl`;
- **curriculum**: `npm run curriculum -- --ladder --until <date> --improve-every 10` in the arm's world — G this
  checkout at the tag, F a checkout of `world-v0` (`--world`; a `git worktree` with its own `npm ci`) and the
  ladder up to `world-v0` only; `--episodes` (default 200) sets its steps, about 1.5 episodes each;
- **snapshot** `<tag>` with its meta (arm, tag, commit, date, the world's commit, the pin, the window), and
  `var/rsi/<arm>/runs/<tag>/RUN.md`: the benchmark's commands on the measured pool for the team;
- a run refuses to start without `LSW_MODEL_PIN` (`--no-pin` for a smoke test).

## 7. Guard rails kept

Unchanged from rsi.md §6: the judges (the validator, the hidden tests, the replay sets, the
benchmark) are outside the self-state; benchmark runs use a fork and record nothing; unattended
commands run only in containers with no network; the history tasks' hidden tests stay on the host
and are copied in only for the verdict, as the engine tasks' are. New here: the mined tasks' gold
patches never enter a workspace, and the issue writer is a different model from the agent.

## 8. Cost and time

From the smoke tests (rsi.md §9, Kimi K3): about $0.006 an agent step on short transcripts; an SWE
instance of 5 steps cost $0.01, engine tasks of 9–16 steps $0.06–0.09. Kimi K3's list price is about
$3 per million input tokens, $0.30 cached and $15 output (aggregators, October 2026; OpenRouter's
providers differ, one of them serving fp4 — another reason for §3's pin). A benchmark task runs up to
40 steps on a transcript of tens of thousands of tokens, mostly cached, so roughly $0.10–0.60; **one
arm on a pool of 300–500 tasks is roughly $30–300** and 6–20 hours at four tasks at a time. The pilot
replaces these with measurements. Disk on the Linux host: the pilot's 20 Verified images are about
22 GB compressed (the harness asks for 120 GB free in any case); the pool's images, one or a few GB
each, set the rest.

| Run | Arm-runs × tasks | Rough cost |
|---|---|---|
| pilot | 3 × 25 | $10–50 |
| t0 baseline | 4 × the pool | $120–1,200 |
| later milestones | G × 1 at each (×3 at the last), F at two: 8 arm-runs | $240–2,400 |
| final ablations and the step cap | 4 × the pool | $120–1,200 |
| curriculum per milestone, G | ~200 episodes | $20–80 |
| curriculum per milestone, F | the same, matched | $20–80 |
| held-out ladder per window | 2 × ~50 tasks | $10–30 |

Over five milestones (`world-v0` and four more) that is on the order of **$700–6,000**, dominated by
the benchmark runs: the pool's size sets most of it, and the pilot narrows the rest.

## 9. What goes in the paper

| | Table or figure | From |
|---|---|---|
| T-R1 | the measured pool's resolve rate, cost and steps: naive, tuned, each G snapshot, F; mean and spread over runs | §4.5, §6 |
| F-R1 | the same against the world's size at each milestone (x: rules and maps; y: resolve rate), G and F | §6.1 |
| T-R2 | ablations of the last snapshot; the step-capped run | §6.3 |
| T-R3 | the ladder per rung: pass rate of naive and of each snapshot on its future window | §5.5 |
| F-R2 | difficulty per window: gold patch size, files, tests; the naive pass rate | §5.5 |
| T-R4 | the outer loop: proposals by kind, kept and rejected, the replay numbers | the journal |
| — | what transferred: a lesson, a skill, a hook, with the episodes that formed it and the benchmark instances it was used on | the self-state |

*Built (2026-10-14):* `npm run rsi -- report` (`games/openworld/tools/src/rsi-report.ts`) writes T-R1, T-R3 and T-R4 from
what the milestones leave under `var/rsi/<arm>/` — the benchmark's verdicts and records, the held-out ladder, the
journal's proposals — with every comparison paired task by task (McNemar's exact test, against naive at `world-v0`).

## 10. Build steps, once agreed

1. **The pool** (§4.1): count the SWE-rebench and SWE-bench-Live tasks created after 2026-07-16 that
   have images, by repository and language; freeze the list. No model calls. *Done 2026-10-14
   (`bench/pool.py`): 133 tasks, none of them Python — Q0 is open again.*
2. **SWE fixes F1–F4** (§4.3), checked on three Verified instances by hand. *Fixed and tested with a
   stand-in for docker on 2026-10-14; the check on real images is the pilot's.*
3. **The pilot** (§4.4), and its gates.
4. **The miner** (§5.3): candidates, environments, validation, issues, leakage checks; its yield. *Built
   2026-10-14 (§5.3, As built).*
5. **The milestone runner**: one command for §6.2 steps 1–5 (`npm run rsi -- milestone world-vN`),
   the run manifest (§3), the arms of §6.3. *Built 2026-10-14 (§6.4).*
6. **`world-v0`**: the tag, the t0 baseline handed to the team.

Each step is built and smoke-tested at the smallest size before anything larger runs.

## 11. Open questions

| # | Question | Recommendation |
|---|---|---|
| Q0 | The measured benchmark, now that Verified is saturated and contaminated (§4.1) | agreed: SWE-rebench and SWE-bench-Live tasks created after Kimi K3's release, frozen at `world-v0`, 300 or more; Verified for the pilot only. **Reopened** (no such Python task is published yet, §4.1) and **agreed again as A + B**: Python tasks mined after the release (fresh-pool.md), the 133 of MultiLang as the first slice |
| Q1 | The model (§3) | Kimi K3, Moonshot's provider only |
| Q2 | The budget ceiling | fix it after the pilot prices a task; the range now is $700–6,000, set mostly by the pool's size |
| Q3 | A second, language-matched benchmark (§4.6) | yes, if it costs no more than one arm per milestone: the TypeScript and JavaScript tasks of SWE-bench-Live created after the model's release; Multi-SWE-bench's only if that is too few, reported as possibly seen |
| Q4 | Who cuts the `world-vN` tags | the user, with the content team, at least a week apart |
| Q5 | Arm F (the frozen-world control) | yes: without it H3, the paper's link between the world and the coder, is untested |
