"""S0 · Recipes (docs/fresh-pool.md §3): for each Python repository SWE-rebench or SWE-bench-Live has built,
the environment of its most recent task — how to install it, which Python, how its tests run and how
their output is read — so a new pull request of the same repository can be built the same way.
"""

from __future__ import annotations

import collections
import shlex

from common import RECIPE_SINCE, path, pool, write_jsonl

# the sources with Python tasks, and the columns a recipe needs from each
SOURCES = ["rebench-leaderboard", "rebench-v2", "live"]
COLUMNS = ["instance_id", "repo", "created_at", "install_config", "test_cmds", "log_parser", "image_name", "docker_image", "language"]


def looks_like_test_path(token: str) -> bool:
    return token.endswith(".py") or ".py::" in token or ("/" in token and not token.startswith("-"))


def runner_of(test_cmd: str | None) -> str | None:
    """A test command without the files it was given: the trailing paths are the old task's, a new task names its own."""
    if not test_cmd:
        return None
    try:
        tokens = shlex.split(test_cmd)
    except ValueError:
        return None
    while tokens and looks_like_test_path(tokens[-1]):
        tokens.pop()
    return shlex.join(tokens) if tokens else None


def recipe_of(row: dict) -> dict:
    """One task's environment, in one shape whatever the source wrote."""
    cfg = row.get("install_config") or {}
    install = cfg.get("install")
    if isinstance(install, str):
        install = [install] if install.strip() else []
    test_cmd = cfg.get("test_cmd") or (" && ".join(row["test_cmds"]) if row.get("test_cmds") else None)
    return {
        "repo": row["repo"],
        "source": row["source"],
        "instance_id": row["instance_id"],
        "created_at": row["created_at"],
        "image": row.get("image"),
        # SWE-bench-Live builds its environments with an agent and keeps no install command: the image is the recipe
        "install": install if row["source"] != "live" else None,
        "pre_install": list(cfg.get("pre_install") or []),
        "pip_packages": list(cfg.get("pip_packages") or []),
        "python": cfg.get("python") or None,
        "env_vars": cfg.get("env_vars") or None,
        "base_image": cfg.get("base_image_name") or None,
        "test_cmd": test_cmd,
        "runner": runner_of(test_cmd),
        "log_parser": parser_name(cfg.get("log_parser") or row.get("log_parser")),
    }


def parser_name(name: str | None) -> str | None:
    """The official parser's name: SWE-bench-Live writes `pytest` for swebench's `parse_log_pytest`."""
    return name if not name or name.startswith("parse_log_") else f"parse_log_{name}"


def choose(rows: list[dict], since: str = RECIPE_SINCE) -> list[dict]:
    """
    Per repository (by name, case aside): the recipe of its most recent SWE-rebench task, if that task is
    recent enough; else its most recent SWE-bench-Live task's; repositories with nothing since `since` are
    left out. Each recipe also says how many tasks the repository has and its last task's date.
    """
    by_repo: dict[str, list[dict]] = collections.defaultdict(list)
    for r in rows:
        if (r.get("language") or "python") == "python" and r.get("created_at"):
            by_repo[r["repo"].lower()].append(r)
    out = []
    for key, rs in sorted(by_repo.items()):
        rs.sort(key=lambda r: r["created_at"], reverse=True)
        if rs[0]["created_at"] < since:
            continue
        rebench = [r for r in rs if r["source"] != "live" and r["created_at"] >= since]
        pick = rebench[0] if rebench else next(r for r in rs if r["source"] == "live")
        rec = recipe_of(pick)
        rec.update({"key": key, "tasks": len(rs), "last": rs[0]["created_at"]})
        out.append(rec)
    return out


def run() -> list[dict]:
    rows = []
    for key in SOURCES:
        got = pool.rows(key, COLUMNS)
        print(f"{key}: {len(got)} tasks")
        rows += got
    recipes = choose(rows)
    n = write_jsonl(path("recipes.jsonl"), recipes)
    by = collections.Counter(r["source"] for r in recipes)
    print(f"{n} repositories with a recipe since {RECIPE_SINCE} -> {path('recipes.jsonl')}: {dict(by)}")
    print(f"  with an install command: {sum(1 for r in recipes if r['install'])}; with a test runner: {sum(1 for r in recipes if r['runner'])}")
    print(f"  log parsers: {dict(collections.Counter(r['log_parser'] for r in recipes).most_common(6))}")
    return recipes
