# The fresh pool: mining Python tasks the frozen model cannot have seen

Status: **agreed and built (2026-10-14)**: D1, D2, D4 and D5 as §7 recommends; D3 (the host) to be named
before S2. S0 and S1 have run here (the numbers in §9); S2–S5 and the evaluation are written and tested
without Docker (`bench/fresh/`, `bench/evaluate.py`) and run on the host with one command each. The choice it
serves was agreed the same day: the measured benchmark is **A + B** (docs/rsi-experiments.md §4.1, Q0) — A, Python tasks
we mine ourselves from pull requests created on or after Kimi K3's release (2026-07-16), on
environments SWE-rebench already built, with no model called; B, the 133 post-release tasks of
SWE-bench-Live MultiLang (`bench/pools/post-k3.json`) as the first slice. This document is the design
of A's miner and of how B is evaluated.

## 1. What it makes

- **Tasks** in the official SWE-bench task-repository format (SWE-bench 5.x: `task.yaml`,
  `tests.json`, `problem_statement.md`, `hints.md`, `gold.patch`, `test.patch`, `eval.sh`,
  `Dockerfile`, one directory per task, `sweb.yaml` at the root), so the official tooling checks them
  (`swebench dataset check`), builds and publishes their images (`swebench images build|check|push`)
  and evaluates predictions on them (`swebench eval <task repo>`). Nothing of ours sits between a
  prediction and its verdict.
- **Decontaminated by construction**: the fix (the pull request) was created on or after
  2026-07-16. Whether the issue was opened after it too is recorded, and reported as a stricter cut.
- **No model anywhere**: the statement is the real issue's text; environments are SWE-rebench's
  recipes, which a model wrote once, for SWE-rebench; validation is running tests; screening is rules
  and a person.
- **Target**: 600 validated tasks, at most 5 per repository (so at least 120 repositories), frozen at
  `world-v0` as `bench/pools/fresh-v0.json` (identifiers and metadata only, like `post-k3.json`).
  With B that is about 730 tasks: §4.6 of rsi-experiments.md wants 300 or more.

## 2. Measured before designing (2026-10-14)

**The recipes.** Every SWE-rebench instance carries an `install_config` — the install commands
(`pip install -e .`, extras, build tools), the Python version, `pre_install` and `pip_packages`,
environment variables, the test command with the files the test patch touches
(`pytest --no-header -rA --tb=line --color=no -p no:cacheprovider <files>`) and the log parser
(`parse_log_pytest`). SWE-rebench V2 adds a base image per Python version (`python_base_310`) and an
image per task (`swerebenchv2/<repo>:<pr>-<sha>`); the leaderboard's are
`swerebench/sweb.eval.x86_64.<id>`.

**The repositories.** Across SWE-rebench V2 (7,243 Python tasks of 32,079), its leaderboard (860) and
SWE-bench-Live (1,888): **1,093 Python repositories with a recipe; 427 with a task created since
2025-06** (a recipe recent enough to still install), 146 since 2026-01; 460 with five or more tasks.

**The yield, sampled.** 50 of the 427 (seed 7), through GitHub's GraphQL API: 4,329 pull requests
merged and created on or after 2026-07-16; 1,873 change tests and code; 982 close an issue; **589 do
all three in 1–15 files** (426 with the issue opened after the date too). Over the 427 that is about
**5,000 candidates** before any test is run. Large repositories dominate (celery 71, iceberg-python 14
in the sample), hence the per-repository cap.

**The images.** Every family checked — SWE-bench, SWE-rebench, SWE-bench-Live — keeps the repository
in `/testbed` and runs as root (their configurations on Docker Hub); the SWE runner already works
them so (rsi-experiments.md §4.3, F1).

**The official tooling.** `swebench dataset collect REPOS --cutoff-date YYYYMMDD` turns a
repository's pull requests into candidate instances by SWE-bench's own method: a pull request that
resolves an issue (by GitHub's closing keywords), the statement from the issue's title and body, the
hints from its comments, the diff split into the code patch and the test patch. The task repository's
`eval.sh` (activate the environment, check out the test files at the base commit, apply the test
patch, run the tests) and `tests.json` (FAIL_TO_PASS, PASS_TO_PASS) are the evaluation's whole input.

## 3. The pipeline

Six stages, each a command over the previous stage's output (one JSONL per stage, appended as it
goes, so every stage resumes where it stopped), each recording what it asked of GitHub or Docker.

```
S0 recipes ─▶ S1 candidates ─▶ S2 environments ─▶ S3 validation ─▶ S4 screens ─▶ S5 export, freeze
  (here)       (here, GitHub)    (Linux host, Docker, network)   (host, no network)   (here, a person)   (host)
```

### S0 · Recipes (no network beyond Hugging Face)

For each of the 427 repositories: the recipe of its most recent task (its `install_config`, its image,
its source and the task's date). Recipes from SWE-rebench V2 and the leaderboard share a schema;
SWE-bench-Live's (`test_cmds`, `log_parser`) are mapped onto it. Output `recipes.jsonl`.

### S1 · Candidates (GitHub, read-only, through `gh`'s token)

Per repository, `swebench dataset collect <repo> --cutoff-date 20260716`, then our filters:

- merged, and created on or after 2026-07-16 and before the window's end (D5);
- resolves at least one issue; a test patch and a code patch, both non-empty; the code patch touches
  Python; 1–15 files (SWE-rebench's bound); not authored by a bot;
- **at most 10 candidates per repository**, the most recent first (twice the final cap, for what
  validation drops).

Recorded with each: the issue's creation date (the stricter cut), the pull request's URL, author,
size, and the recipe it will use. Output `candidates.jsonl`, in the instance fields SWE-bench uses.

*As built (M1):* the official collector asks GitHub for every closed pull request and then, for each,
its commits — one call per pull request, more than ten hours over these repositories. So the first pass
is one GraphQL search per repository (merged, created in the window) that brings each pull request's
title, body, first ten commits and files together, and the official rules are applied to them: the
closing keywords and pattern of `swebench.collect.utils` over title, body and commit messages
(comments cut; the remaining commits read when the first ten found nothing and there are more), the
test files told apart by the official words. Only what passes becomes an instance, with the official
hints (`_extract_hints`), the official patch split and the official validity checks
(`bench/fresh/collect.py`).

### S2 · Environments (the Linux host; network during builds only)

Two layers, so a repository's dependencies are installed once:

1. **The repository's environment**: `FROM` its recipe's image (the OS packages and the `testbed`
   conda environment at the recipe's Python), the repository fetched at the newest candidate's base
   commit, the recipe's `pre_install` and `install` run. If that fails, the fallback is SWE-rebench
   V2's base image for the recipe's Python, a fresh clone, the same install. If both fail, the
   repository is dropped and the reason recorded. Tag `lsw-fresh/env.<repo>:v0`.
2. **The task's layer**: the task's base commit checked out, the install run again (the dependencies
   are mostly there: seconds to a minute), the tree cleaned. Tag
   `lsw-fresh/sweb.eval.x86_64.<id with __ as _1776_>:v0`.

Each task's `Dockerfile` (its `FROM` and the `RUN` lines) is written into the task repository so the
official `swebench images build` can rebuild it. But a rebuild resolves dependencies again and can
drift, so **the built images are the artifact**, pushed where the team can pull them (D2).

### S3 · Validation (the host; `--network none`)

In each task's image, `eval.sh` is run three times in each of two states — the test patch alone,
then the test patch with the gold patch — and parsed by the log parser the recipe names (the
official parsers in `swebench.harness.log_parsers`):

- **FAIL_TO_PASS**: failing (or erroring) in all three runs before, passing in all three after;
- **PASS_TO_PASS**: passing in all six;
- **kept** if FAIL_TO_PASS is not empty, no test that passed before fails after, and one run takes
  under 15 minutes. A test that passes only some of the time is in neither list.

Written in the official form: `tests.json`, and `eval.sh` shaped as the official tasks' are.

### S4 · Screens (here; no model)

By rule:
- the statement has at least 40 words and is not only links or a log;
- no run of 8 or more lines of the gold patch's added code appears in the statement or the hints;
- one task per issue (a later pull request closing the same issue is dropped);
- FAIL_TO_PASS has at most 50 tests, and the gold patch at most 200 changed lines (beyond that it is
  a feature with a test suite, not a fix).

By a person: 30 tasks at random, each judged as SWE-bench Verified's annotators judged — is the
statement enough to know what a correct fix does, and do the tests check that and not something
narrower or wider (severity 0–3; 2 or more drops it). The share dropped is reported as the pool's
estimated noise: Verified's annotators dropped 68 % of SWE-bench, and OpenAI later found flaws in
much of what remained, so a raw mined pool is expected to be noisy; a noisy pool lowers the ceiling
for every arm alike, and the comparisons between arms stay paired (§4.6 of rsi-experiments.md).

### S5 · Export and freeze (the host)

1. The surviving tasks as the task repository (D1), `swebench dataset check` on it.
2. `swebench eval <task repo> --gold`: the official harness resolves every task with its own gold
   patch, or the task is dropped — the harness's own word that the task is well formed.
3. **Freeze** at `world-v0`: up to 5 per repository, sampled with a fixed seed to the target →
   `bench/pools/fresh-v0.json`; `pool.py` gains a `fresh` source that reads the task repository at a
   pinned commit, and `fetch` writes the instances `npm run agent -- swe` reads (with each task's
   image).

## 4. B: the 133

Their images are SWE-bench-Live's, their evaluation SWE-bench-Live's MultiLang harness (per-language
build, test and print commands and log parsers, fields of the dataset). They are evaluated with that
harness at a pinned commit; the pilot runs one task per language through it. A and B are reported
apart and together: A is the Python measure, B shows the same comparison in six other languages.

## 5. Where it runs, what it costs

| Stage | Where | Time | Notes |
|---|---|---|---|
| S0 | here | minutes | Hugging Face range reads, as `pool.py` |
| S1 | here | hours | about 5,000 pull requests: their diffs, issues and comments through GitHub's API (5,000 requests an hour); resumable |
| S2, S3 | the Linux host (D3) | about 15–25 hours | ~2,000 tasks processed for ~600 kept, 3–6 minutes each, 8 at a time |
| S4 | here | an hour of a person | 30 tasks read |
| S5 | the host | hours | the gold evaluation of ~600 tasks; pushing the images |

Disk on the host: a repository's environment is 1–3 GB, a task's layer small, so at most ~150
repositories (the ones with the most candidates and the most recent recipes) keep it near
150–450 GB. **No model is called**; the cost is the host's time and its disk.

## 6. The code

`bench/fresh/`, Python 3.12, its requirements in `bench/requirements.txt` (`swebench==5.0.2`,
`pyarrow`): `recipes.py`, `collect.py` (around `swebench.collect`), `build.py`, `validate.py`,
`screen.py`, `export.py`, and one command, `python bench/fresh/fresh.py <stage> [--resume] [--limit n]
[--repos …]`. The parts that do not need Docker — filters, FAIL_TO_PASS from parsed runs, the
screens, the export — are tested with pytest on fixtures (a small repository, recorded API answers, a
stand-in for docker as in `packages/agent/test`); the Docker parts are checked on the host at the
smallest size first (§8).

The ladder's miner (rsi-experiments.md §5.3) shares the method — three runs before and after, the same
lists, the same thresholds — not the code: its tasks are this repository's TypeScript under vitest.

## 7. Decisions (the user's)

| # | Question | Recommendation |
|---|---|---|
| D1 | Where the task repository lives (gold patches, `eval.sh`, Dockerfiles) | a private GitHub repository of its own, `SihanXU/lsw-fresh-tasks`: kept out of this one, whose code the agent works in |
| D2 | Where the built images go | pushed to the GitHub Container Registry, private (`ghcr.io/sihanxu/lsw-fresh`): a rebuild drifts, and the team must evaluate on the same images |
| D3 | The Linux host | one with Docker and about 500 GB free |
| D4 | The size | 600 validated, at most 5 per repository, at most 150 repositories |
| D5 | The window's end | the day `world-v0` is cut; what is created after it waits for a later pool |

## 8. Milestones

Each is built, then run at the smallest size before anything larger.

1. **M1 · S0 and S1, here.** The real number of candidates (replacing §2's extrapolation), by
   repository and month.
2. **M2 · S2 and S3 on the host**, 5 repositories × 3 tasks: environments, the task layers, validation.
3. **M3 · S4 and S5**: the screens, the task repository, the gold evaluation, a 20-task `fresh-pilot`
   pool, and the pilot's tasks (rsi-experiments.md §4.4) drawn from it and from B.
4. **M4 · the full run** to the target, and the freeze at `world-v0`.
5. **M5 · B's evaluation path** with SWE-bench-Live's harness.

M1 needs nothing but this machine and can start as soon as this design is agreed; M2 onwards needs
D3's host; S5's push of the images needs D1 and D2.

## 9. As built (2026-10-14)

**The code.** `bench/fresh/` — `recipes.py` (S0), `collect.py` (S1), `screen.py` (S4: the rules before any
build, the review sheet and its verdicts after validation), `build.py` (S2), `validate.py` (S3), `export.py`
(S5: the task repository, `swebench dataset check` and `build`, the gold run, the freeze), `fresh.py` (the
commands), `common.py`; tests in `test_fresh.py` and `test_stages.py` (12, with a stand-in for docker,
`fake_docker.py`), run with `python -m pytest bench/fresh` in the environment of `bench/requirements.txt`.
`bench/evaluate.py` grades predictions on a frozen pool with each benchmark's own harness — `swebench eval`
on the compiled task repository for the fresh pool, SWE-bench-Live's `evaluation.evaluation` at a pinned
commit (`62d02936`) for B — into one table of resolved tasks. `bench/pool.py fetch` reads the fresh pool's
instances from the task repository (`LSW_FRESH_TASKS`) at the commit the pool was frozen at.

What changed from §3 as it was built:
- **S1's first pass** is GraphQL with the official rules applied locally (above, S1); the funnel per
  repository is kept (`s1/funnel*.jsonl`), and S1 runs as shards (`--shard i/n`), each writing its own files.
- **A heavy page is halved**: a search page of fifty pull requests with their files and commits can time out on
  GitHub's side for the busiest repositories (litellm merges dozens a day); a failed page is asked again at
  half the size before any back-off.
- **The rules of S4 run before S2**, so a candidate they drop costs no build; the person's review runs after
  S3 (`fresh.py review`, then `fresh.py reviewed <csv>`).
- **Parser names**: SWE-bench-Live writes `pytest` where swebench names `parse_log_pytest`; recipes carry
  the official name.
- **Images are named under `LSW_FRESH_REGISTRY`** (D2: `ghcr.io/sihanxu`), so `task.yaml` names a task's
  image where the team pulls it; `fresh.py finish --push` pushes the environments and the tasks' layers.
- **`swebench eval` reads a compiled dataset** (`<dir>/test.parquet`), not the task repository itself: S5
  compiles it with `swebench dataset build` into `<root>/dist`.
- **The SWE runner** (`packages/agent/src/swe.ts`) now finds a repository an image keeps below `/testbed`
  (`repositoryIn`), as some of SWE-bench-Live's images do and as its own evaluation looks for it.

**On the host**, once D3 is named (Docker, ~500 GB, the venv of `bench/requirements.txt`, `gh` signed in):

```bash
python bench/fresh/fresh.py screen
LSW_FRESH_REGISTRY=ghcr.io/sihanxu python bench/fresh/fresh.py host --workers 8      # S2 + S3
python bench/fresh/fresh.py review          # 30 tasks to judge: s4/review.md, review.csv
python bench/fresh/fresh.py reviewed var/fresh/s4/review.csv
LSW_FRESH_REGISTRY=ghcr.io/sihanxu python bench/fresh/fresh.py finish --push --until <world-v0's day>
python bench/evaluate.py bench/pools/post-k3.json --gold --repeat 3 --run-id gold-b   # B: three gold runs, as SWE-bench-Live asks
```

**M1's numbers (2026-10-14; `bench/fresh/counts.json`).** S0: 427 repositories with a recipe (SWE-rebench's
leaderboard 281, its V2 58, SWE-bench-Live 88). S1, over all 427 (none failed): 51,047 pull requests merged and
created from 2026-07-16 to 2026-10-14; the rules left 6,157 (dropped: 9,737 by bots, 4,760 too large, 10,842
without tests, 2,570 without code, 3,656 without Python, 13,325 resolving no issue); 2,072 kept at ten a
repository, from 328 repositories (204 with five or more); 1,576 of them with the issue opened after the date
too; by month July (from the 16th) 169, August 445, September 782, October (to the 14th) 676. The rules of S4:
1,728 left (dropped: 212 with a gold patch over 200 lines, 96 statements too short, 28 a second pull request for
one issue, 7 statements that quote the fix, 1 only links or logs). The yield §2 extrapolated (about 5,000 before
the rules) holds.

What the pool's size now depends on is S3's yield on the host. At five a repository the 1,728 can give at most
about 1,000 tasks; 600 needs about three in five of them to build and go from failing to passing. If fewer
survive, the cap rises to the ten S1 kept, or the pool is frozen smaller (§4.6 of rsi-experiments.md: 300 is the
floor for about 5 points).
