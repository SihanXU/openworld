"""S5 · Export and freeze (docs/fresh-pool.md §3). The validated tasks, less what the screens and the review
dropped, as an official SWE-bench task repository (one directory per task: task.yaml, tests.json,
problem_statement.md, hints.md, gold.patch, test.patch, eval.sh, Dockerfile; sweb.yaml at the root), which the
official tooling checks (`swebench dataset check`) and grades with each task's own gold patch (`swebench eval
<repo> --gold`) — a task it does not resolve is dropped. Then the pool is frozen: up to five tasks a
repository, sampled with a fixed seed, as identifiers only (bench/pools/fresh-v0.json).
"""

from __future__ import annotations

import collections
import datetime as dt
import json
import os
import random
import shutil
import subprocess
import sys

from common import BENCH, CUTOFF, DATA, path, read_jsonl, task_tag

DATASET = "SihanXU/lsw-fresh"  # the name the task repository publishes under (sweb.yaml), private (D1)
PER_REPO = 5
TARGET = 600


def yaml_scalar(v) -> str:
    return json.dumps(v, ensure_ascii=False)  # JSON strings and numbers are YAML scalars


def task_yaml(t: dict) -> str:
    fields = {
        "base_commit": t["base_commit"],
        "created_at": t["created_at"],
        "datasets": None,
        "environment_setup_commit": t["base_commit"],
        "eval_type": "pass_and_fail",
        "image": task_tag(t["instance_id"]),
        "instance_id": t["instance_id"],
        "log_parser": t["log_parser"],
        "repo": t["repo"],
        "split": "test",
        "version": "0",
    }
    lines = []
    for k, v in fields.items():
        lines += [f"{k}:", f"- {DATASET}"] if k == "datasets" else [f"{k}: {yaml_scalar(v)}"]
    return "\n".join(lines) + "\n"


def usable() -> list[dict]:
    """Validated, and not dropped by the review."""
    dropped = {r["instance_id"] for r in read_jsonl(path("s4", "review-dropped.jsonl"))}
    recipes = {r["key"]: r for r in read_jsonl(path("recipes.jsonl"))}
    out = []
    for t in read_jsonl(path("s3", "validated.jsonl")):
        if t["instance_id"] not in dropped:
            out.append({**t, "log_parser": recipes[t["repo"].lower()].get("log_parser") or "parse_log_pytest"})
    return out


def write_task(root: str, t: dict) -> None:
    d = os.path.join(root, "tasks", t["instance_id"])
    os.makedirs(d, exist_ok=True)
    files = {
        "task.yaml": task_yaml(t),
        "tests.json": json.dumps({"FAIL_TO_PASS": t["FAIL_TO_PASS"], "PASS_TO_PASS": t["PASS_TO_PASS"]}, indent=2) + "\n",
        "problem_statement.md": t["problem_statement"],
        "gold.patch": t["patch"],
        "test.patch": t["test_patch"],
        "eval.sh": t["eval_sh"],
    }
    if (t.get("hints_text") or "").strip():
        files["hints.md"] = t["hints_text"]
    for name, body in files.items():
        with open(os.path.join(d, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(body)
    # the Dockerfile S2 built the task's layer from (its FROM is the repository's environment image)
    shutil.copyfile(path("tasks", t["instance_id"], "Dockerfile"), os.path.join(d, "Dockerfile"))


def export(root: str) -> int:
    tasks = usable()
    os.makedirs(os.path.join(root, "tasks"), exist_ok=True)
    with open(os.path.join(root, "sweb.yaml"), "w", encoding="utf-8", newline="\n") as f:
        f.write(f"datasets:\n- {DATASET}\nsplits:\n- test\n")
    for t in tasks:
        write_task(root, t)
    print(f"{len(tasks)} tasks -> {root}")
    return len(tasks)


def dataset_dir(root: str) -> str:
    """Where `swebench dataset build` compiles the task repository (the harness reads <dir>/test.parquet)."""
    import glob

    found = glob.glob(os.path.join(root, "dist", "**", "test.parquet"), recursive=True)
    if not found:
        sys.exit(f"no test.parquet under {root}/dist: run the export first")
    return os.path.dirname(found[0])


def gold_check(root: str, run_id: str = "lsw-fresh-gold", workers: int = 8) -> set[str]:
    """`swebench dataset check` and `build`, then the official harness on every task's gold patch: the tasks it resolves."""
    for cmd in [["swebench", "dataset", "check", root], ["swebench", "dataset", "build", root, "-o", os.path.join(root, "dist")]]:
        if subprocess.run(cmd).returncode:
            sys.exit(f"{' '.join(cmd)} failed")
    cmd = ["swebench", "eval", dataset_dir(root), "--gold", "--run-id", run_id, "-j", str(workers)]
    if subprocess.run(cmd).returncode:
        sys.exit(f"{' '.join(cmd)} failed")
    with open(os.path.join("logs", "evaluation", run_id, "results.json"), encoding="utf-8") as f:
        resolved = set(json.load(f).get("resolved_ids", []))
    with open(path("s5", "gold-resolved.json"), "w", encoding="utf-8") as f:
        json.dump(sorted(resolved), f)
    return resolved


def freeze(root: str, name: str = "fresh-v0", per_repo: int = PER_REPO, target: int = TARGET, seed: int = 0, until: str | None = None) -> dict:
    """Up to `per_repo` tasks a repository the gold check resolved, sampled with `seed`, at most `target`: identifiers only."""
    resolved = set(json.load(open(path("s5", "gold-resolved.json"), encoding="utf-8")))
    until = until or dt.date.today().isoformat()
    tasks = [t for t in usable() if t["instance_id"] in resolved and t["created_at"] < until]
    rng = random.Random(seed)
    by_repo = collections.defaultdict(list)
    for t in sorted(tasks, key=lambda t: t["instance_id"]):
        by_repo[t["repo"]].append(t)
    picked = []
    for repo in sorted(by_repo):
        ts = by_repo[repo]
        picked += rng.sample(ts, min(per_repo, len(ts)))
    if len(picked) > target:
        picked = rng.sample(picked, target)
    picked.sort(key=lambda t: (t["created_at"], t["instance_id"]))
    commit = subprocess.run(["git", "-C", root, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip() or None
    pool = {
        "name": name,
        "frozen": dt.date.today().isoformat(),
        "criterion": {"created_on_or_after": CUTOFF, "created_before": until, "per_repo": per_repo, "target": target, "seed": seed, "gold_resolved": True},
        "sources": {"fresh": {"dataset": DATASET, "task_repo": os.path.basename(os.path.abspath(root)), "revision": commit}},
        "counts": {
            "tasks": len(picked),
            "repositories": len({t["repo"] for t in picked}),
            "issue_also_after": sum(1 for t in picked if t["issue_after"]),
            "by_month": dict(sorted(collections.Counter(t["created_at"][:7] for t in picked).items())),
            "largest_repositories": dict(collections.Counter(t["repo"] for t in picked).most_common(5)),
        },
        "tasks": [{"instance_id": t["instance_id"], "source": "fresh", "repo": t["repo"], "language": "python", "created_at": t["created_at"], "image": task_tag(t["instance_id"]), "issue_after": t["issue_after"]} for t in picked],
    }
    out = os.path.join(BENCH, "pools", f"{name}.json")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(pool, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"{out}: {json.dumps(pool['counts'])}")
    return pool


def default_root() -> str:
    return os.environ.get("LSW_FRESH_TASKS") or os.path.join(DATA, "lsw-fresh-tasks")
