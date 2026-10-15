"""The fresh pool's miner (docs/fresh-pool.md): Python tasks from pull requests created on or after Kimi K3's
release, on environments SWE-rebench built, by SWE-bench's own method. No model is called.

Stages, each resumable (what it wrote is kept, and it goes on where it stopped); outputs in var/fresh/
(LSW_FRESH_DATA), which hold gold patches and are never tracked in this repository:

  here (Python, a GitHub token):
    fresh.py recipes                 S0  each repository's environment                   -> recipes.jsonl
    fresh.py candidates [--limit n] [--repos a/b,…] [--until YYYY-MM-DD]
                     [--shard i/n]   S1  merged pull requests -> candidate instances     -> s1/candidates*.jsonl
    fresh.py screen                  S4a the rules, before anything is built             -> s4/kept.jsonl
  on the Linux host (Docker; LSW_FRESH_REGISTRY names the registry the images go to):
    fresh.py host [--workers 8]      S2 + S3  environments, task layers, validation       -> s2/, s3/validated.jsonl
    fresh.py review                  S4b a sample for a person to judge                   -> s4/review.md, review.csv
    fresh.py reviewed <review.csv>       the severities: 2 or more drops a task
    fresh.py finish [--root <dir>] [--push]
                                     S5  the task repository, swebench's checks and gold run, the freeze
                                         -> <root> (LSW_FRESH_TASKS), bench/pools/fresh-v0.json
  anywhere:
    fresh.py counts                  the numbers so far -> bench/fresh/counts.json (no patches)

Python 3.12 with bench/requirements.txt (swebench 5.0.2 for the official rules, parsers and harness).
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import os
import subprocess

import collect
from common import BENCH, CUTOFF, PER_REPO, path, read_jsonl

STAGES = ["merged", "bot", "size", "no-tests", "no-code", "no-python", "no-issue", "candidate", "invalid", "kept"]


def counts() -> dict:
    recs = list(read_jsonl(path("recipes.jsonl")))
    funnel = list(collect.read_all("funnel"))
    cands = list(collect.read_all("candidates"))
    total = collections.Counter()
    for row in funnel:
        total.update({k: row.get(k, 0) for k in STAGES})
    with_candidates = [r for r in funnel if r.get("kept")]
    builds = list(read_jsonl(path("s2", "builds.jsonl")))
    results = list(read_jsonl(path("s3", "results.jsonl")))
    report = {
        "counted": dt.date.today().isoformat(),
        "cutoff": CUTOFF,
        "per_repo": PER_REPO,
        "recipes": {"repositories": len(recs), "by_source": dict(collections.Counter(r["source"] for r in recs))},
        "s1": {
            "repositories_searched": len(funnel),
            "repositories_failed": sum(1 for r in funnel if "error" in r),
            "repositories_with_candidates": len(with_candidates),
            "funnel": {k: total[k] for k in STAGES},
            "candidates": len(cands),
            "issue_also_after": sum(1 for c in cands if c["issue_after"]),
            "by_month": dict(sorted(collections.Counter(c["created_at"][:7] for c in cands).items())),
            "largest": dict(collections.Counter(c["repo"] for c in cands).most_common(10)),
            "repositories_with_5_or_more": sum(1 for r in with_candidates if r["kept"] >= 5),
            "graphql_cost": sum(r.get("graphql_cost", 0) for r in funnel),
        },
        "s4_rules": {"kept": sum(1 for _ in read_jsonl(path("s4", "kept.jsonl"))), "dropped": dict(collections.Counter(d["why"] for d in read_jsonl(path("s4", "dropped.jsonl"))))},
        "s2": {
            "environments": sum(1 for b in builds if b["kind"] == "env"),
            "environments_ok": dict(collections.Counter(b["how"] for b in builds if b["kind"] == "env" and b["ok"])),
            "tasks_built": sum(1 for b in builds if b["kind"] == "task" and b["ok"]),
            "tasks_failed": sum(1 for b in builds if b["kind"] == "task" and not b["ok"]),
        },
        "s3": {"validated": sum(1 for r in results if r["ok"]), "dropped": dict(collections.Counter(r.get("why") for r in results if not r["ok"]))},
    }
    out = os.path.join(BENCH, "fresh", "counts.json")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(report, f, indent=1)
        f.write("\n")
    print(json.dumps(report, indent=1))
    return report


def push(root: str) -> None:
    """The validated tasks' images, under the names their task.yaml gives (LSW_FRESH_REGISTRY), and their environments."""
    from common import docker, env_tag, task_tag

    tags = {task_tag(t["instance_id"]) for t in read_jsonl(path("s3", "validated.jsonl"))}
    tags |= {env_tag(t["repo"]) for t in read_jsonl(path("s3", "validated.jsonl"))}
    for tag in sorted(tags):
        r = docker(["push", tag], timeout=3600)
        print(f"  push {tag}: {'ok' if r.returncode == 0 else r.stderr.strip()[-200:]}", flush=True)


def main() -> None:
    import build
    import export
    import recipes
    import screen
    import validate

    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("recipes")
    c = sub.add_parser("candidates")
    c.add_argument("--limit", type=int)
    c.add_argument("--repos", help="only these repositories (owner/name, comma-separated)")
    c.add_argument("--until", help="pull requests created before this day (default: tomorrow)")
    c.add_argument("--shard", default="0/1", help="i/n: this process takes every n-th repository from the i-th (each shard writes its own files)")
    sub.add_parser("screen")
    h = sub.add_parser("host")
    h.add_argument("--workers", type=int, default=8)
    h.add_argument("--limit", type=int, help="repositories to build (S2) and tasks to validate (S3)")
    h.add_argument("--repos")
    sub.add_parser("review")
    rv = sub.add_parser("reviewed")
    rv.add_argument("csv")
    fi = sub.add_parser("finish")
    fi.add_argument("--root", default=export.default_root())
    fi.add_argument("--push", action="store_true", help="push the images (LSW_FRESH_REGISTRY) before the gold run")
    fi.add_argument("--until", help="the window's end: the day world-v0 is cut (default today)")
    fi.add_argument("--workers", type=int, default=8)
    sub.add_parser("counts")
    a = ap.parse_args()
    only = [r.strip().lower() for r in a.repos.split(",")] if getattr(a, "repos", None) else None
    if a.cmd == "recipes":
        recipes.run()
    elif a.cmd == "candidates":
        i, n = (int(x) for x in a.shard.split("/"))
        collect.run(limit=a.limit, only=only, until=a.until, shard=(i, n))
    elif a.cmd == "screen":
        screen.screen_candidates()
    elif a.cmd == "host":
        build.run(workers=max(1, a.workers // 2), limit=a.limit, only=only)
        validate.run(workers=a.workers)
    elif a.cmd == "review":
        screen.review_sheet()
    elif a.cmd == "reviewed":
        screen.apply_review(a.csv)
    elif a.cmd == "finish":
        export.export(a.root)
        subprocess.run(["git", "-C", a.root, "init", "-q"], check=False)
        subprocess.run(["git", "-C", a.root, "add", "-A"], check=False)
        subprocess.run(["git", "-C", a.root, "-c", "user.email=lsw@local", "-c", "user.name=lsw", "commit", "-qm", f"fresh pool export {dt.date.today()}"], check=False)
        if a.push:
            push(a.root)
        export.gold_check(a.root, workers=a.workers)
        export.freeze(a.root, until=a.until)
    else:
        counts()


if __name__ == "__main__":
    main()
