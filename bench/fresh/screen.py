"""S4 · Screens (docs/fresh-pool.md §3), no model. The rules on the statement and the patch run before anything
is built (a task they drop costs no build); the test count after validation; a person reads a sample at the
end, as SWE-bench Verified's annotators read theirs, and the share dropped is reported as the pool's noise.
"""

from __future__ import annotations

import csv
import random
import re

import collect
from common import path, read_jsonl, write_jsonl

MIN_WORDS = 40  # a statement shorter than this does not say what a fix must do
LEAK_LINES = 8  # this many consecutive added lines of the gold patch in the statement give the answer away
MAX_GOLD_LINES = 200  # beyond this a pull request is a feature with its tests, not a fix
MAX_F2P = 50
REVIEW = 30

URL = re.compile(r"https?://\S+")
LOGLIKE = re.compile(r"^\s*(at |File \"|Traceback|\[\d|\d{4}-\d\d-\d\d|E\s{2,}|>>>|\$ |[A-Za-z_.]+(Error|Exception):)")


def words(text: str) -> int:
    return len(re.findall(r"[A-Za-z]{2,}", URL.sub(" ", text)))


def prose_share(text: str) -> float:
    """The share of non-empty lines that are neither a link nor a log or traceback line."""
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return 0.0
    return sum(1 for l in lines if not URL.fullmatch(l.strip()) and not LOGLIKE.match(l)) / len(lines)


def added_lines(patch: str) -> list[str]:
    return [l[1:].strip() for l in patch.splitlines() if l.startswith("+") and not l.startswith("+++")]


def changed_lines(patch: str) -> int:
    return sum(1 for l in patch.splitlines() if (l.startswith("+") and not l.startswith("+++")) or (l.startswith("-") and not l.startswith("---")))


def leaks(patch: str, text: str, run: int = LEAK_LINES) -> bool:
    """Whether `run` consecutive non-empty added lines of the gold patch appear, in order, in the text."""
    lines = [l for l in added_lines(patch) if l]
    norm = "\n".join(l.strip() for l in text.splitlines() if l.strip())
    return any("\n".join(lines[i : i + run]) in norm for i in range(0, max(0, len(lines) - run + 1)))


def rule(inst: dict) -> str | None:
    """Why a candidate is dropped before it is built, or None."""
    text = inst["problem_statement"]
    if words(text) < MIN_WORDS:
        return "short-statement"
    if prose_share(text) < 0.2:
        return "only-links-or-logs"
    if leaks(inst["patch"], text + "\n" + (inst.get("hints_text") or "")):
        return "statement-holds-the-fix"
    if changed_lines(inst["patch"]) > MAX_GOLD_LINES:
        return "large-gold-patch"
    return None


def screen_candidates() -> dict:
    """The rules over S1's candidates, and one task per issue (the earliest pull request keeps it)."""
    cands = sorted(collect.read_all("candidates"), key=lambda c: c["created_at"])
    kept, dropped, issues = [], [], set()
    for c in cands:
        why = rule(c)
        keys = {f"{c['repo'].lower()}#{n}" for n in c["issue_numbers"]}
        if not why and keys & issues:
            why = "issue-taken"
        if why:
            dropped.append({"instance_id": c["instance_id"], "why": why})
        else:
            issues |= keys
            kept.append(c)
    write_jsonl(path("s4", "kept.jsonl"), kept)
    write_jsonl(path("s4", "dropped.jsonl"), dropped)
    by = {}
    for d in dropped:
        by[d["why"]] = by.get(d["why"], 0) + 1
    print(f"screens: {len(kept)} kept of {len(cands)}; dropped {by}")
    return {"kept": len(kept), "dropped": by}


def review_sheet(n: int = REVIEW, seed: int = 0) -> str:
    """A sample of validated tasks for a person to judge, as a sheet to read and a CSV to fill."""
    tasks = list(read_jsonl(path("s3", "validated.jsonl")))
    sample = random.Random(seed).sample(tasks, min(n, len(tasks)))
    md = [
        "# The fresh pool: tasks to judge",
        "",
        "For each task, a severity in review.csv (SWE-bench Verified's scale): 0 the statement says what a correct fix",
        "does and the tests check exactly that; 1 a little to fill in, the tests fair; 2 too vague to know, or the tests",
        "check something narrower or wider than the statement asks; 3 impossible without the gold patch. 2 or 3 drops it.",
        "",
    ]
    for t in sample:
        md += [f"## {t['instance_id']}", "", t["pr_url"], "", "### Statement", "", t["problem_statement"].strip(), "", "### Tests that must go from failing to passing", ""]
        md += [f"- `{x}`" for x in t["FAIL_TO_PASS"][:20]] + ["", "### Gold patch", "", "```diff", t["patch"].strip()[:6000], "```", ""]
    with open(path("s4", "review.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(md))
    with open(path("s4", "review.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["instance_id", "severity", "note"])
        for t in sample:
            w.writerow([t["instance_id"], "", ""])
    print(f"{len(sample)} tasks to judge: {path('s4', 'review.md')}, severities in {path('s4', 'review.csv')}")
    return path("s4", "review.csv")


def apply_review(csv_path: str) -> dict:
    """The judged sample: severity 2 or more drops a task; the share dropped estimates the whole pool's."""
    with open(csv_path, encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["severity"].strip()]
    bad = [r["instance_id"] for r in rows if int(r["severity"]) >= 2]
    write_jsonl(path("s4", "review-dropped.jsonl"), [{"instance_id": i} for i in bad])
    out = {"judged": len(rows), "dropped": len(bad), "share": round(len(bad) / len(rows), 3) if rows else None}
    print(f"review: {out}")
    return out
