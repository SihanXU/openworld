"""Grade predictions on a frozen pool with the benchmark's own harness (docs/rsi-experiments.md §4.2), and write
one table: a row per task, resolved or not. Nothing of ours decides a verdict.

  python bench/evaluate.py bench/pools/<pool>.json <predictions.jsonl> --run-id <id> [--workers 8] [--gold]

- tasks of the fresh pool: `swebench eval <the task repository compiled> -p <predictions> --run-id <id>`
  (LSW_FRESH_TASKS: the task repository, D1 of docs/fresh-pool.md, compiled by S5's `swebench dataset build`);
- tasks of SWE-bench Verified (the pilot's): `swebench eval verified`;
- tasks of SWE-bench-Live MultiLang (post-k3): SWE-bench-Live's own harness, `python -m evaluation.evaluation`
  in a checkout of microsoft/SWE-bench-Live at LIVE_COMMIT (LSW_LIVE_REPO), per language split.

--gold grades the pool's own gold patches; with --repeat 3, a task counts only if all three runs resolve it — as
SWE-bench-Live asks a pool to be filtered on the machine that evaluates (tests drift); the fresh pool's is S5's.
Writes <predictions>.<run-id>.resolved.jsonl.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import subprocess
import sys
import tempfile

LIVE_COMMIT = "62d02936a0726fbf4597b05bd07b09fb99eddae6"  # microsoft/SWE-bench-Live, 2026-09-25


def predictions(file: str, ids: set[str]) -> dict[str, dict]:
    out = {}
    with open(file, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                p = json.loads(line)
                if p["instance_id"] in ids:
                    out[p["instance_id"]] = p
    return out


def fresh(ids: list[str], preds: dict, run_id: str, workers: int, gold: bool) -> dict[str, bool]:
    root = os.environ.get("LSW_FRESH_TASKS")
    if not root:
        sys.exit("LSW_FRESH_TASKS: the fresh pool's task repository")
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "fresh"))
    from export import dataset_dir  # the task repository compiled by S5 (swebench dataset build)

    cmd = ["swebench", "eval", dataset_dir(root), "--run-id", run_id, "-j", str(workers), *[x for i in ids for x in ("-i", i)]]
    with tempfile.TemporaryDirectory() as d:
        if gold:
            cmd.append("--gold")
        else:
            p = os.path.join(d, "preds.jsonl")
            with open(p, "w", encoding="utf-8") as f:
                for i in ids:
                    if i in preds:
                        f.write(json.dumps(preds[i]) + "\n")
            cmd += ["-p", p]
        subprocess.run(cmd, check=True)
    with open(os.path.join("logs", "evaluation", run_id, "results.json"), encoding="utf-8") as f:
        resolved = set(json.load(f).get("resolved_ids", []))
    return {i: i in resolved for i in ids}


def verified(ids: list[str], preds: dict, run_id: str, workers: int, gold: bool) -> dict[str, bool]:
    """The pilot's SWE-bench Verified tasks, by the official harness on the official images."""
    cmd = ["swebench", "eval", "verified", "--run-id", run_id, "-j", str(workers), *[x for i in ids for x in ("-i", i)]]
    with tempfile.TemporaryDirectory() as d:
        if gold:
            cmd.append("--gold")
        else:
            p = os.path.join(d, "preds.jsonl")
            with open(p, "w", encoding="utf-8") as f:
                for i in ids:
                    if i in preds:
                        f.write(json.dumps(preds[i]) + "\n")
            cmd += ["-p", p]
        subprocess.run(cmd, check=True)
    with open(os.path.join("logs", "evaluation", run_id, "results.json"), encoding="utf-8") as f:
        resolved = set(json.load(f).get("resolved_ids", []))
    return {i: i in resolved for i in ids}


def live(tasks: list[dict], preds: dict, run_id: str, workers: int, gold: bool) -> dict[str, bool]:
    repo = os.environ.get("LSW_LIVE_REPO")
    if not repo:
        sys.exit(f"LSW_LIVE_REPO: a checkout of microsoft/SWE-bench-Live at {LIVE_COMMIT}, installed (pip install -e .)")
    head = subprocess.run(["git", "-C", repo, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    if head != LIVE_COMMIT:
        sys.exit(f"{repo} is at {head}, not at {LIVE_COMMIT}")
    out = {}
    by_split = collections.defaultdict(list)
    for t in tasks:
        by_split[t["language"]].append(t["instance_id"])
    with tempfile.TemporaryDirectory() as d:
        patches = os.path.join(d, "preds.json")
        with open(patches, "w", encoding="utf-8") as f:
            json.dump({i: {"model_patch": p["model_patch"]} for i, p in preds.items()}, f)
        for split, ids in sorted(by_split.items()):
            od = os.path.abspath(os.path.join("logs", "live", run_id, split))
            cmd = [sys.executable, "-m", "evaluation.evaluation", "--dataset", "SWE-bench-Live/MultiLang", "--split", split, "--instance_ids", *ids, "--platform", "linux", "--patch_dir", "gold" if gold else patches, "--output_dir", od, "--workers", str(workers), "--overwrite", "0"]
            subprocess.run(cmd, check=True, cwd=repo)
            with open(os.path.join(od, "results.json"), encoding="utf-8") as f:
                ok = set(json.load(f).get("success_ids", []))
            out.update({i: i in ok for i in ids})
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("pool")
    ap.add_argument("predictions", nargs="?")
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--gold", action="store_true")
    ap.add_argument("--repeat", type=int, default=1, help="with --gold: resolved only if every one of these runs resolves it")
    a = ap.parse_args()
    pool = json.load(open(a.pool, encoding="utf-8"))
    tasks = pool["tasks"]
    ids = {t["instance_id"] for t in tasks}
    preds = {} if a.gold else predictions(a.predictions, ids)
    fresh_ids = [t["instance_id"] for t in tasks if t["source"] == "fresh"]
    live_tasks = [t for t in tasks if t["source"] == "multilang"]
    verified_ids = [t["instance_id"] for t in tasks if t["source"] == "verified"]
    runs = []
    for k in range(a.repeat if a.gold else 1):
        run_id = a.run_id if k == 0 else f"{a.run_id}-{k + 1}"
        v = {}
        if fresh_ids:
            v.update(fresh(fresh_ids, preds, run_id, a.workers, a.gold))
        if live_tasks:
            v.update(live(live_tasks, preds, run_id, a.workers, a.gold))
        if verified_ids:
            v.update(verified(verified_ids, preds, f"{run_id}-verified", a.workers, a.gold))
        runs.append(v)
    verdict = {i: all(r.get(i, False) for r in runs) for i in ids}
    out = f"{a.predictions or a.pool}.{a.run_id}.resolved.jsonl"
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        for t in tasks:
            f.write(json.dumps({"instance_id": t["instance_id"], "source": t["source"], "language": t["language"], "predicted": t["instance_id"] in preds or a.gold, "resolved": verdict.get(t["instance_id"], False)}) + "\n")
    n = sum(verdict.values())
    print(f"{out}: {n}/{len(tasks)} resolved")


if __name__ == "__main__":
    main()
