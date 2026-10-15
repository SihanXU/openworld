"""S2 · Environments (docs/fresh-pool.md §3), on a host with Docker; builds have the network, nothing after does.

Two layers, so a repository's dependencies are installed once: the repository's environment (its recipe's
image moved to the newest candidate's base commit, the recipe's install run there; if that fails, the
official Python image with a fresh clone and the same install), then per task a thin layer at the task's own
base commit. The Dockerfiles are kept with the tasks (S5 writes them into the task repository), but a rebuild
resolves dependencies again and can drift: the built images are the artifact.
"""

from __future__ import annotations

import collections
import concurrent.futures as cf
import os
import shlex
import time

from common import ACTIVATE, docker, env_tag, path, read_jsonl, task_tag, append_jsonl

GIT_AT = (
    "cd /testbed && git config --global --add safe.directory '*' && "
    "(git remote get-url origin >/dev/null 2>&1 && git remote set-url origin {url} || git remote add origin {url}) && "
    "git fetch --quiet --no-tags origin {sha} && git checkout -qf {sha} && git clean -fdq"
)


def install_lines(recipe: dict) -> list[str]:
    """The recipe's install, as shell lines: its variables, system packages, pip packages, install commands."""
    lines = [f"export {k}={shlex.quote(str(v))}" for k, v in (recipe.get("env_vars") or {}).items()]
    lines += list(recipe.get("pre_install") or [])
    if recipe.get("pip_packages"):
        lines.append("pip install -q " + " ".join(shlex.quote(p) for p in recipe["pip_packages"]))
    lines += list(recipe.get("install") or [])
    return lines


def run_line(*lines: str) -> str:
    """One RUN of a Dockerfile: the environment activated, every line must succeed."""
    body = " && ".join(f"({l})" for l in lines if l.strip()) or "true"
    return f"RUN {ACTIVATE}; set -e; {body}"


def env_dockerfile(recipe: dict, sha: str) -> str:
    url = f"https://github.com/{recipe['repo']}.git"
    lines = [f"FROM {recipe['image']}", 'SHELL ["/bin/bash", "-c"]', run_line(GIT_AT.format(url=url, sha=sha))]
    inst = install_lines(recipe)
    if inst:
        lines.append(run_line("cd /testbed", *inst))
    return "\n".join(lines + ["WORKDIR /testbed", ""])


def fallback_dockerfile(recipe: dict, sha: str) -> str:
    """The official Python image at the recipe's Python, a fresh clone, the same install."""
    py = recipe.get("python") or "3.11"
    url = f"https://github.com/{recipe['repo']}.git"
    return "\n".join(
        [
            f"FROM python:{py}-bookworm",
            'SHELL ["/bin/bash", "-c"]',
            "RUN apt-get update -qq && apt-get install -y -qq git build-essential >/dev/null && rm -rf /var/lib/apt/lists/*",
            f"RUN git init -q /testbed && cd /testbed && git remote add origin {url} && git fetch --quiet --no-tags origin {sha} && git checkout -qf {sha}",
            run_line("cd /testbed", *(install_lines(recipe) or ["pip install -q -e ."])),
            "WORKDIR /testbed",
            "",
        ]
    )


def task_dockerfile(recipe: dict, inst: dict) -> str:
    """The task's layer: its base commit; the install again where the recipe has one (dependencies mostly there)."""
    url = f"https://github.com/{inst['repo']}.git"
    lines = [f"FROM {env_tag(inst['repo'])}", 'SHELL ["/bin/bash", "-c"]', run_line(GIT_AT.format(url=url, sha=inst["base_commit"]))]
    inst_lines = install_lines(recipe) if recipe.get("install") else []
    if inst_lines:
        lines.append(run_line("cd /testbed", *inst_lines))
    return "\n".join(lines + ["WORKDIR /testbed", ""])


def build(tag: str, dockerfile: str, where: str, timeout: int = 3600) -> tuple[bool, str, float]:
    os.makedirs(where, exist_ok=True)
    with open(os.path.join(where, "Dockerfile"), "w", encoding="utf-8", newline="\n") as f:
        f.write(dockerfile)
    t0 = time.time()
    r = docker(["build", "-q", "-t", tag, where], timeout=timeout)
    return r.returncode == 0, (r.stdout + r.stderr)[-3000:], round(time.time() - t0, 1)


def build_repo(recipe: dict, insts: list[dict]) -> list[dict]:
    """A repository's environment, then its tasks' layers; a row for each image."""
    rows = []
    newest = max(insts, key=lambda i: i["created_at"])["base_commit"]
    where = path("env", recipe["key"].replace("/", "__"), "Dockerfile")[: -len("Dockerfile")]
    ok, log, secs = build(env_tag(recipe["repo"]), env_dockerfile(recipe, newest), where)
    how = "recipe"
    if not ok:
        ok, log2, secs2 = build(env_tag(recipe["repo"]), fallback_dockerfile(recipe, newest), where)
        how, log, secs = "fallback", log + "\n--- fallback ---\n" + log2, secs + secs2
    rows.append({"kind": "env", "repo": recipe["repo"], "tag": env_tag(recipe["repo"]), "ok": ok, "how": how, "secs": secs, **({} if ok else {"log": log})})
    if not ok:
        return rows
    for inst in insts:
        tdir = path("tasks", inst["instance_id"], "Dockerfile")[: -len("Dockerfile")]
        ok, log, secs = build(task_tag(inst["instance_id"]), task_dockerfile(recipe, inst), tdir)
        rows.append({"kind": "task", "instance_id": inst["instance_id"], "repo": inst["repo"], "tag": task_tag(inst["instance_id"]), "ok": ok, "secs": secs, **({} if ok else {"log": log})})
    return rows


def run(workers: int = 4, limit: int | None = None, only: list[str] | None = None) -> None:
    recipes = {r["key"]: r for r in read_jsonl(path("recipes.jsonl"))}
    by_repo = collections.defaultdict(list)
    for c in read_jsonl(path("s4", "kept.jsonl")):
        by_repo[c["repo"].lower()].append(c)
    done = {r["repo"].lower() for r in read_jsonl(path("s2", "builds.jsonl")) if r["kind"] == "env"}
    todo = [k for k in sorted(by_repo) if k not in done and (not only or k in only)]
    todo = todo[:limit] if limit else todo
    print(f"S2: {len(done)} repositories built before, {len(todo)} to go, {workers} at a time", flush=True)
    with cf.ThreadPoolExecutor(workers) as pool:
        futures = {pool.submit(build_repo, recipes[k], by_repo[k]): k for k in todo if k in recipes}
        for fut in cf.as_completed(futures):
            rows = fut.result()
            for r in rows:
                append_jsonl(path("s2", "builds.jsonl"), r)
            env = rows[0]
            print(f"  {env['repo']}: environment {'ok (' + env['how'] + ')' if env['ok'] else 'FAILED'}, {sum(1 for r in rows[1:] if r['ok'])}/{len(rows) - 1} tasks built", flush=True)
