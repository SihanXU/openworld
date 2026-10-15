"""S1 · Candidates (docs/fresh-pool.md §3): the pull requests of each recipe's repository that were merged and
created on or after the cutoff, filtered, and made into task instances by SWE-bench's own method.

SWE-bench's collector (`swebench dataset collect`) asks GitHub for every closed pull request and, for each,
its commits, to find the issues it resolves: one call per pull request, more than ten hours over these
repositories. So the first pass here is one GraphQL search per repository that brings title, body,
commits and files together, and the official rule is applied to them as it would be (the closing
keywords and the pattern of `swebench.collect.utils`, over title, body and commit messages, comments cut;
the test files told apart by the official words). Only the pull requests that pass become instances, with
the official hints (`_extract_hints`) and the official instance fields.
"""

from __future__ import annotations

import collections
import datetime as dt
import json
import re
import time
import urllib.error
import urllib.request

from common import CUTOFF, PER_REPO, append_jsonl, github_token, path, read_jsonl

# the official words: a file whose path holds one of them belongs to the test patch (swebench.collect.utils.extract_patches)
TEST_WORDS = ["test", "tests", "e2e", "testing"]
MAX_FILES = 15  # SWE-rebench's bound on the files a task's pull request changes

QUERY = """query($q: String!, $after: String, $first: Int!) {
  rateLimit { cost remaining resetAt }
  search(query: $q, type: ISSUE, first: $first, after: $after) {
    issueCount pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest {
      number title body url createdAt mergedAt baseRefOid additions deletions changedFiles
      author { login __typename }
      files(first: 16) { totalCount nodes { path additions deletions } }
      commits(first: 10) { totalCount nodes { commit { message } } }
    } } } }"""


def is_test_path(p: str) -> bool:
    return any(w in p for w in TEST_WORDS)


def resolved_issues(text: str, clone_url: str) -> list[str]:
    """The issues a pull request resolves, as swebench.collect.utils.Repo.extract_resolved_issues finds them in its text."""
    from swebench.collect.utils import PR_KEYWORDS, build_issues_pattern

    text = re.sub(r"(?s)<!--.*?-->", "", text)
    return sorted({num for word, num in build_issues_pattern(clone_url).findall(text) if word.lower() in PR_KEYWORDS}, key=int)


def is_bot(author: dict | None) -> bool:
    return bool(author) and (author.get("__typename") == "Bot" or author.get("login", "").endswith("[bot]"))


def screen(pr: dict, clone_url: str) -> tuple[str, dict]:
    """Why a pull request is not a candidate (the first rule it fails), or 'candidate' — with what was found."""
    files = [f["path"] for f in pr["files"]["nodes"]]
    tests = [f for f in files if is_test_path(f)]
    code = [f for f in files if not is_test_path(f)]
    info = {"tests": tests, "code": code, "issues": []}
    if is_bot(pr.get("author")):
        return "bot", info
    if not 1 <= pr["changedFiles"] <= MAX_FILES:
        return "size", info
    if not tests:
        return "no-tests", info
    if not code:
        return "no-code", info
    if not any(f.endswith(".py") for f in code):
        return "no-python", info
    text = "\n".join([pr.get("title") or "", pr.get("body") or "", *[c["commit"]["message"] for c in pr["commits"]["nodes"]]])
    info["issues"] = resolved_issues(text, clone_url)
    if not info["issues"]:
        # the first ten commits were read: a keyword in a later one is looked for when it matters (collect_repo)
        return ("more-commits" if pr["commits"]["totalCount"] > len(pr["commits"]["nodes"]) else "no-issue"), info
    return "candidate", info


def split_patch(diff: str) -> tuple[str, str]:
    """The gold patch and the test patch, as swebench.collect.utils.extract_patches splits a pull request's diff."""
    from unidiff import PatchSet

    fix, test = "", ""
    for f in PatchSet(diff):
        if is_test_path(f.path):
            test += str(f)
        else:
            fix += str(f)
    return fix, test


# ---------------------------------------------------------------- GitHub


class GitHub:
    def __init__(self, token: str):
        self.token = token
        self.cost = 0

    def graphql(self, q: str, after: str | None = None) -> dict:
        last: Exception | None = None
        first = 50
        for attempt in range(8):
            # a page of heavy pull requests (long bodies, many files) can time out on GitHub's side: halve it first
            body = json.dumps({"query": QUERY, "variables": {"q": q, "after": after, "first": first}}).encode()
            req = urllib.request.Request("https://api.github.com/graphql", data=body, headers={"Authorization": f"bearer {self.token}", "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = json.load(r)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
                last = e
                if first > 5:
                    first //= 2
                    continue
                time.sleep(min(300, 15 * 2**attempt))  # 502s and secondary limits: back off
                continue
            if data.get("errors") and not data.get("data"):
                last = RuntimeError(str(data["errors"])[:300])
                if first > 5:
                    first //= 2
                    continue
                time.sleep(min(300, 15 * 2**attempt))
                continue
            rl = data["data"]["rateLimit"]
            self.cost += rl["cost"]
            if rl["remaining"] < 200:  # wait for the hour to turn
                reset = dt.datetime.fromisoformat(rl["resetAt"].replace("Z", "+00:00"))
                time.sleep(max(0, (reset - dt.datetime.now(dt.timezone.utc)).total_seconds()) + 5)
            return data["data"]["search"]
        raise RuntimeError(f"GitHub GraphQL failed: {last}")

    def search(self, q: str) -> tuple[list[dict], int]:
        s = self.graphql(q)
        nodes, total = s["nodes"], s["issueCount"]
        while s["pageInfo"]["hasNextPage"]:
            s = self.graphql(q, s["pageInfo"]["endCursor"])
            nodes += s["nodes"]
        return [n for n in nodes if n], total

    def merged_since(self, full_name: str, since: str, until: str) -> list[dict]:
        """Merged pull requests created in [since, until): a search answers at most 1,000, so a full window is halved."""
        prs, total = self.search(f"repo:{full_name} is:pr is:merged created:{since}..{until}")
        if total <= 1000:
            return prs
        a, b = dt.date.fromisoformat(since), dt.date.fromisoformat(until)
        mid = (a + (b - a) / 2).isoformat()
        return self.merged_since(full_name, since, mid) + self.merged_since(full_name, mid, until)

    def diff(self, full_name: str, number: int) -> str:
        """The pull request's diff, as its `diff_url` serves it to the official collector (here through the API)."""
        url = f"https://api.github.com/repos/{full_name}/pulls/{number}"
        headers = {"Authorization": f"token {self.token}", "Accept": "application/vnd.github.diff"}
        for attempt in range(6):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
                    return r.read().decode("utf-8", errors="replace")
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
                time.sleep(min(300, 10 * 2**attempt))
        raise RuntimeError(f"no diff for {full_name}#{number}")


def statement_and_hints(pull: dict, repo) -> tuple[str, str, list[str]]:
    """swebench.collect.utils.extract_problem_statement_and_hints, which also gives back when each issue was opened."""
    from swebench.collect.utils import _extract_hints

    text, hints, opened = "", [], []
    for number in pull["resolved_issues"]:
        issue = repo.call_api(repo.api.issues.get, owner=repo.owner, repo=repo.name, issue_number=int(number))
        if issue is None:
            continue
        text += f"{issue.title or ''}\n{issue.body or ''}\n"
        opened.append(issue.created_at)
        hints.append("\n".join(_extract_hints(pull, repo, issue.number)))
    return text, "\n".join(hints), opened


# ---------------------------------------------------------------- a repository


def collect_repo(recipe: dict, gh: GitHub, token: str, until: str) -> tuple[dict, list[dict]]:
    """One repository's funnel (how many pull requests each rule left) and its candidate instances."""
    from swebench.collect.utils import Repo

    repo = Repo(*recipe["repo"].split("/"), token=token)
    if repo.repo is None:
        return {"repo": recipe["repo"], "error": "repository not found"}, []
    full = repo.repo.full_name
    clone_url = f"https://github.com/{full}.git"
    cost0 = gh.cost
    prs = list({p["number"]: p for p in gh.merged_since(full, CUTOFF, until)}.values())  # halved windows share a day
    funnel = collections.Counter(merged=len(prs))
    eligible = []
    for pr in prs:
        why, info = screen(pr, clone_url)
        if why == "more-commits":  # the official rule reads every commit message
            commits = repo.get_all_loop(repo.api.pulls.list_commits, pull_number=pr["number"], quiet=True)
            text = "\n".join([pr.get("title") or "", pr.get("body") or "", *[c.commit.message for c in commits]])
            info["issues"] = resolved_issues(text, clone_url)
            why = "candidate" if info["issues"] else "no-issue"
        funnel[why] += 1
        if why == "candidate":
            eligible.append((pr, info))
    eligible.sort(key=lambda x: x[0]["createdAt"], reverse=True)
    out = []
    for pr, info in eligible[:PER_REPO]:
        pull = {"number": pr["number"], "resolved_issues": info["issues"], "base": {"sha": pr["baseRefOid"]}, "created_at": pr["createdAt"]}
        patch, test_patch = split_patch(gh.diff(full, pr["number"]))
        statement, hints, opened = statement_and_hints(pull, repo)
        inst = {
            # the official instance (swebench.collect.build_dataset.create_instance)
            "repo": full,
            "pull_number": pr["number"],
            "instance_id": f"{full}-{pr['number']}".replace("/", "__"),
            "issue_numbers": info["issues"],
            "base_commit": pr["baseRefOid"],
            "patch": patch,
            "test_patch": test_patch,
            "problem_statement": statement,
            "hints_text": hints,
            "created_at": pr["createdAt"],
            # ours
            "merged_at": pr["mergedAt"],
            "pr_url": pr["url"],
            "author": (pr.get("author") or {}).get("login"),
            "changed_files": pr["changedFiles"],
            "additions": pr["additions"],
            "deletions": pr["deletions"],
            "test_files": info["tests"],
            "code_files": info["code"],
            "issue_opened": opened,
            "issue_after": bool(opened) and all(o >= CUTOFF for o in opened),
            "recipe": recipe["instance_id"],
            "collected": dt.date.today().isoformat(),
        }
        # the official checks (swebench.collect.build_dataset: is_valid_instance, has_test_patch)
        if not inst["patch"] or not inst["problem_statement"].strip():
            funnel["invalid"] += 1
            continue
        if not inst["test_patch"].strip():
            funnel["invalid"] += 1
            continue
        out.append(inst)
    row = {"repo": recipe["repo"], "full_name": full, **funnel, "kept": len(out), "graphql_cost": gh.cost - cost0}
    return row, out


def shard_files(name: str) -> list[str]:
    """`name`.jsonl and the shards' `name`.<i>of<n>.jsonl (S1 may run as several processes, each writing its own)."""
    import glob

    return sorted(glob.glob(path("s1", f"{name}.jsonl")) + glob.glob(path("s1", f"{name}.*of*.jsonl")))


def read_all(name: str):
    """Every shard's rows; a candidate once (a repository redone after a stop may have written it twice)."""
    seen = set()
    for f in shard_files(name):
        for r in read_jsonl(f):
            key = r.get("instance_id") if name == "candidates" else None
            if key and key in seen:
                continue
            seen.add(key)
            yield r


def run(limit: int | None = None, only: list[str] | None = None, until: str | None = None, shard: tuple[int, int] = (0, 1)) -> None:
    token = github_token()
    gh = GitHub(token)
    until = until or (dt.date.today() + dt.timedelta(days=1)).isoformat()
    recipes = list(read_jsonl(path("recipes.jsonl")))
    if not recipes:
        raise SystemExit("no recipes: run `fresh.py recipes` first")
    i, n = shard
    suffix = "" if n == 1 else f".{i}of{n}"
    done = {r["repo"] for r in read_all("funnel")}
    todo = [r for k, r in enumerate(recipes) if k % n == i and r["repo"] not in done and (not only or r["repo"].lower() in only)]
    todo = todo[:limit] if limit else todo
    print(f"{len(done)} repositories done before, {len(todo)} to go (pull requests created {CUTOFF} to {until})", flush=True)
    for i, rec in enumerate(todo, 1):
        try:
            row, insts = collect_repo(rec, gh, token, until)
        except Exception as e:  # one repository's failure is recorded, and the run goes on
            row, insts = {"repo": rec["repo"], "error": f"{type(e).__name__}: {e}"[:400]}, []
        for inst in insts:
            append_jsonl(path("s1", f"candidates{suffix}.jsonl"), inst)
        append_jsonl(path("s1", f"funnel{suffix}.jsonl"), row)
        print(f"[{i}/{len(todo)}] {rec['repo']}: {row.get('merged', 0)} merged, {row.get('candidate', 0)} candidates, {row.get('kept', 0)} kept{' — ' + row['error'] if 'error' in row else ''}", flush=True)
