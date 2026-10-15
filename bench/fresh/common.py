"""What every stage of the miner shares: where its data lives, the dates, JSONL, GitHub's token."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Iterable, Iterator

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BENCH = os.path.join(ROOT, "bench")
# the stages' outputs hold gold patches: they stay in var/ (not tracked), never in this repository
DATA = os.environ.get("LSW_FRESH_DATA") or os.path.join(ROOT, "var", "fresh")

sys.path.insert(0, BENCH)
import pool  # noqa: E402  (bench/pool.py: the sources at their pinned revisions, range reads)

# a pull request created on or after this day cannot be in Kimi K3's training data (its release)
CUTOFF = pool.AFTER
# a recipe from a task created since this day is recent enough to still install (docs/fresh-pool.md §2)
RECIPE_SINCE = "2025-06-01"
# candidates kept per repository at S1: twice the pool's cap of 5, for what validation drops
PER_REPO = 10


def path(*parts: str) -> str:
    p = os.path.join(DATA, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def read_jsonl(file: str) -> Iterator[dict]:
    if not os.path.exists(file):
        return
    with open(file, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def write_jsonl(file: str, rows: Iterable[dict]) -> int:
    n = 0
    with open(file, "w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            n += 1
    return n


def append_jsonl(file: str, row: dict) -> None:
    with open(file, "a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


# before every command in a task's image: its conda environment, where it has one (the SWE-bench family's images)
ACTIVATE = "if [ -f /opt/miniconda3/bin/activate ]; then source /opt/miniconda3/bin/activate; conda activate testbed 2>/dev/null || true; fi"
# the images the miner builds: a repository's environment, then a thin layer per task
# under LSW_FRESH_REGISTRY when they are pushed (D2: ghcr.io/sihanxu), so a task's image is named where the team pulls it
REGISTRY = os.environ.get("LSW_FRESH_REGISTRY", "").rstrip("/")
ENV_TAG = (REGISTRY + "/" if REGISTRY else "") + "lsw-fresh-env.{key}:v0"
TASK_TAG = (REGISTRY + "/" if REGISTRY else "") + "lsw-fresh.sweb.eval.x86_64.{id1776}:v0"


def env_tag(repo: str) -> str:
    return ENV_TAG.format(key=repo.lower().replace("/", "_1776_"))


def task_tag(instance_id: str) -> str:
    return TASK_TAG.format(id1776=instance_id.replace("__", "_1776_").lower())


def docker(args: list[str], timeout: int = 3600, input: str | None = None) -> subprocess.CompletedProcess:
    """The docker CLI (LSW_DOCKER names another, with its first arguments: the tests' stand-in)."""
    import shlex

    cli = [t.strip('"') for t in shlex.split(os.environ.get("LSW_DOCKER", "docker"), posix=os.name != "nt")]
    try:
        return subprocess.run([*cli, *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, input=input)
    except subprocess.TimeoutExpired as e:
        return subprocess.CompletedProcess(e.cmd, 124, e.stdout or "", f"timed out after {timeout} s")


def github_token() -> str:
    """GITHUB_TOKEN, else the token `gh` is signed in with (read-only use: search, pull requests, issues)."""
    t = os.environ.get("GITHUB_TOKEN")
    if t:
        return t
    r = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True)
    if r.returncode or not r.stdout.strip():
        sys.exit("no GitHub token: set GITHUB_TOKEN or sign in with `gh auth login`")
    return r.stdout.strip()
