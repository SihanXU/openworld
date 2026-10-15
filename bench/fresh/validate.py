"""S3 · Validation (docs/fresh-pool.md §3), on the host, with no network: each task's tests run three times with
the test patch alone and three times with the gold patch too, parsed by the official log parser the recipe
names. FAIL_TO_PASS fail in every run before and pass in every run after; PASS_TO_PASS pass in all six; a test
that passes only sometimes is in neither; a task where a test that passed before fails after is dropped.
"""

from __future__ import annotations

import concurrent.futures as cf
import os
import tempfile
import time

from common import ACTIVATE, append_jsonl, docker, path, read_jsonl, task_tag

RUNS = 3
TIMEOUT = 900  # one run of a task's tests, in seconds
START, END = ">>>>> Start Test Output", ">>>>> End Test Output"  # swebench.harness.constants
PASSING = {"PASSED", "XFAIL"}


def test_files(test_patch: str) -> list[str]:
    """The test modules the test patch adds or changes (the files the tests are run on)."""
    from unidiff import PatchSet

    return [f.path for f in PatchSet(test_patch) if not f.is_removed_file and f.path.endswith(".py") and "test" in os.path.basename(f.path)]


def touched(test_patch: str) -> list[str]:
    from unidiff import PatchSet

    return [f.path for f in PatchSet(test_patch) if not f.is_added_file]


def eval_script(inst: dict, recipe: dict) -> str:
    """The task's eval.sh, in the official tasks' shape: the test files reset, the test patch applied, the tests run between the markers."""
    base, files = inst["base_commit"], test_files(inst["test_patch"])
    reset = f"git checkout {base} {' '.join(touched(inst['test_patch']))}" if touched(inst["test_patch"]) else "true"
    runner = recipe.get("runner") or "pytest -rA"
    return "\n".join(
        [
            "#!/bin/bash",
            "set -uxo pipefail",
            ACTIVATE,
            "cd /testbed",
            "git config --global --add safe.directory /testbed",
            f"git -c core.fileMode=false diff {base}",
            reset,
            "git apply -v - <<'EOF_lsw_fresh'",
            inst["test_patch"].rstrip("\n"),
            "EOF_lsw_fresh",
            f": '{START}'",
            f"{runner} {' '.join(files)}",
            f": '{END}'",
            reset,
            "",
        ]
    )


def parse(log: str, parser: str) -> dict[str, str]:
    """The tests' statuses, from the output between the markers, by the official parser."""
    from swebench.harness.log_parsers import PARSER_REGISTRY

    section = log.split(START, 1)[-1].split(END, 1)[0] if START in log else log
    return PARSER_REGISTRY[parser or "parse_log_pytest"](section, None)


def classify(before: list[dict[str, str]], after: list[dict[str, str]]) -> tuple[list[str], list[str], list[str]]:
    """FAIL_TO_PASS, PASS_TO_PASS, and the regressions (passing in every run before, failing in some run after)."""
    passes = lambda runs, t: [r.get(t) in PASSING for r in runs]
    tests = sorted({t for r in before + after for t in r})
    f2p = [t for t in tests if not any(passes(before, t)) and all(passes(after, t))]
    p2p = [t for t in tests if all(passes(before, t)) and all(passes(after, t))]
    regressions = [t for t in tests if all(passes(before, t)) and not all(passes(after, t))]
    return f2p, p2p, regressions


def run_tests(image: str, script: str, gold: str | None) -> tuple[str, float, int]:
    """One run in a fresh container with no network: the gold patch applied first when given, then eval.sh."""
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "eval.sh"), "w", encoding="utf-8", newline="\n") as f:
            f.write(script)
        with open(os.path.join(d, "run.sh"), "w", encoding="utf-8", newline="\n") as f:
            f.write("cd /testbed\n" + ("git apply -v /lsw/gold.patch || exit 97\n" if gold else "") + f"timeout {TIMEOUT} bash /lsw/eval.sh\n")
        if gold:
            with open(os.path.join(d, "gold.patch"), "w", encoding="utf-8", newline="\n") as f:
                f.write(gold)
        t0 = time.time()
        r = docker(["run", "--rm", "--network", "none", "-v", f"{d}:/lsw:ro", image, "bash", "/lsw/run.sh"], timeout=TIMEOUT + 120)
        return r.stdout + r.stderr, round(time.time() - t0, 1), r.returncode


def validate(inst: dict, recipe: dict) -> dict:
    image, script = task_tag(inst["instance_id"]), eval_script(inst, recipe)
    if not test_files(inst["test_patch"]):
        return {"instance_id": inst["instance_id"], "ok": False, "why": "no-test-module"}
    before, after, secs = [], [], []
    for gold in [None, inst["patch"]]:
        for _ in range(RUNS):
            log, s, code = run_tests(image, script, gold)
            secs.append(s)
            if gold and code == 97:
                return {"instance_id": inst["instance_id"], "ok": False, "why": "gold-does-not-apply"}
            (after if gold else before).append(parse(log, recipe.get("log_parser")))
    f2p, p2p, regressions = classify(before, after)
    why = "no-fail-to-pass" if not f2p else "regression" if regressions else "slow" if max(secs) > TIMEOUT else "too-many-tests" if len(f2p) > 50 else None
    row = {"instance_id": inst["instance_id"], "ok": why is None, "FAIL_TO_PASS": f2p, "PASS_TO_PASS": p2p, "regressions": regressions, "secs": max(secs), "eval_sh": script}
    if why:
        row["why"] = why
    return row


def run(workers: int = 8, limit: int | None = None) -> None:
    recipes = {r["key"]: r for r in read_jsonl(path("recipes.jsonl"))}
    built = {r["instance_id"] for r in read_jsonl(path("s2", "builds.jsonl")) if r["kind"] == "task" and r["ok"]}
    done = {r["instance_id"] for r in read_jsonl(path("s3", "results.jsonl"))}
    todo = [c for c in read_jsonl(path("s4", "kept.jsonl")) if c["instance_id"] in built and c["instance_id"] not in done]
    todo = todo[:limit] if limit else todo
    print(f"S3: {len(done)} validated before, {len(todo)} to go, {workers} at a time", flush=True)
    with cf.ThreadPoolExecutor(workers) as pool:
        futures = {pool.submit(validate, c, recipes[c["repo"].lower()]): c for c in todo}
        for fut in cf.as_completed(futures):
            c = futures[fut]
            try:
                row = fut.result()
            except Exception as e:
                row = {"instance_id": c["instance_id"], "ok": False, "why": f"error: {e}"[:300]}
            append_jsonl(path("s3", "results.jsonl"), {k: v for k, v in row.items() if k != "eval_sh"})
            if row["ok"]:
                append_jsonl(path("s3", "validated.jsonl"), {**c, **row})
            print(f"  {c['instance_id']}: {'kept, ' + str(len(row['FAIL_TO_PASS'])) + ' fail-to-pass' if row['ok'] else row['why']}", flush=True)
