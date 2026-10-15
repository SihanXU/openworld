"""S2–S5 without Docker or the network: the Dockerfiles, eval.sh, the verdict on the runs, the screens, the
export and the freeze. python -m pytest bench/fresh"""

import json
import os
import subprocess
import sys

import build
import export
import screen
import validate
from common import append_jsonl, path, write_jsonl

HERE = os.path.dirname(os.path.abspath(__file__))

TEST_PATCH = """diff --git a/tests/test_mod.py b/tests/test_mod.py
--- a/tests/test_mod.py
+++ b/tests/test_mod.py
@@ -1,1 +1,2 @@
 import mod
+assert mod.x == 2
diff --git a/tests/data/fixture.txt b/tests/data/fixture.txt
new file mode 100644
--- /dev/null
+++ b/tests/data/fixture.txt
@@ -0,0 +1 @@
+x
"""
GOLD = "\n".join(["diff --git a/src/mod.py b/src/mod.py", "--- a/src/mod.py", "+++ b/src/mod.py", "@@ -1,1 +1,9 @@", "-x = 1", *[f"+line_{i} = {i}" for i in range(8)], "+x = 2", ""])
RECIPE = {
    "repo": "o/r", "key": "o/r", "source": "rebench-leaderboard", "instance_id": "o__r-1", "image": "swerebench/sweb.eval.x86_64.o_1776_r-1:latest",
    "install": ["pip install -e ."], "pre_install": ["apt-get install -y libx"], "pip_packages": ["pytest==8.0"], "env_vars": {"A": "1"},
    "python": "3.11", "runner": "pytest --no-header -rA", "log_parser": "parse_log_pytest",
}


def inst(n=7, **kw):
    statement = " ".join(["The parser loses the second value when a field repeats, and it should keep both of them in order."] * 3)
    return {"repo": "o/r", "instance_id": f"o__r-{n}", "pull_number": n, "base_commit": f"{n:040d}", "patch": GOLD, "test_patch": TEST_PATCH, "problem_statement": statement, "hints_text": "", "created_at": f"2026-08-{n:02d}T00:00:00Z", "issue_numbers": [str(n)], "issue_after": True, "pr_url": f"https://github.com/o/r/pull/{n}", **kw}


def test_the_environment_moves_the_recipes_image_to_the_base_commit_and_installs_there():
    df = build.env_dockerfile(RECIPE, "abc123")
    assert df.startswith("FROM swerebench/sweb.eval.x86_64.o_1776_r-1:latest")
    assert "git fetch --quiet --no-tags origin abc123 && git checkout -qf abc123" in df
    assert "(export A=1) && (apt-get install -y libx) && (pip install -q pytest==8.0) && (pip install -e .)" in df
    task = build.task_dockerfile(RECIPE, inst())
    assert task.startswith("FROM lsw-fresh-env.o_1776_r:v0") and "origin " + "7".zfill(40) in task and "pip install -e ." in task
    live = {**RECIPE, "source": "live", "install": None, "pre_install": [], "pip_packages": [], "env_vars": None}
    assert "pip install" not in build.task_dockerfile(live, inst())  # SWE-bench-Live's way: the commit checked out, nothing reinstalled
    assert build.fallback_dockerfile(RECIPE, "abc123").startswith("FROM python:3.11-bookworm")


def test_a_repository_whose_recipe_does_not_build_falls_back_to_the_official_python_image(monkeypatch, tmp_path):
    log = tmp_path / "docker.jsonl"
    monkeypatch.setenv("FAKE_DOCKER_LOG", str(log))
    monkeypatch.setenv("LSW_DOCKER", f'"{sys.executable}" "{os.path.join(HERE, "fake_docker.py")}"')
    rows = build.build_repo({**RECIPE, "image": "FAILFROM/broken"}, [inst(7), inst(8)])
    assert rows[0]["ok"] and rows[0]["how"] == "fallback"
    assert [r["ok"] for r in rows[1:]] == [True, True]
    assert sum(1 for l in log.read_text().splitlines() if json.loads(l)[0] == "build") == 4  # recipe, fallback, two tasks


def test_eval_sh_has_the_official_shape():
    sh = validate.eval_script(inst(), RECIPE)
    assert validate.test_files(TEST_PATCH) == ["tests/test_mod.py"]  # a fixture is applied, not run
    assert f"git checkout {'7'.zfill(40)} tests/test_mod.py" in sh
    assert "git apply -v - <<'EOF_lsw_fresh'" in sh and "+assert mod.x == 2" in sh
    assert ": '>>>>> Start Test Output'\npytest --no-header -rA tests/test_mod.py\n: '>>>>> End Test Output'" in sh


LOG = """noise before
>>>>> Start Test Output
PASSED tests/test_mod.py::test_a
FAILED tests/test_mod.py::test_b - AssertionError: x
ERROR tests/test_mod.py::test_c
>>>>> End Test Output
PASSED tests/elsewhere.py::test_not_in_the_section
"""


def test_runs_are_read_by_the_official_parser_and_judged_over_all_six():
    assert validate.parse(LOG, "parse_log_pytest") == {"tests/test_mod.py::test_a": "PASSED", "tests/test_mod.py::test_b": "FAILED", "tests/test_mod.py::test_c": "ERROR"}
    P, F = "PASSED", "FAILED"
    before = [{"a": P, "b": F, "c": F, "flaky": P, "lost": P}, {"a": P, "b": F, "c": F, "flaky": F, "lost": P}, {"a": P, "b": F, "lost": P}]
    after = [{"a": P, "b": P, "c": P, "flaky": P, "lost": P}, {"a": P, "b": P, "c": P, "flaky": P, "lost": F}, {"a": P, "b": P, "c": P, "flaky": P, "lost": P}]
    f2p, p2p, regressions = validate.classify(before, after)
    assert f2p == ["b", "c"]  # c's missing run before counts as not passing
    assert p2p == ["a"]  # flaky passes only sometimes before: in neither list
    assert regressions == ["lost"]


def test_the_rules_drop_short_statements_leaked_fixes_large_patches_and_a_second_pull_request_for_one_issue():
    assert screen.rule(inst()) is None
    assert screen.rule(inst(problem_statement="It breaks. https://x.y/z")) == "short-statement"
    leaked = inst(problem_statement=inst()["problem_statement"] + "\n" + "\n".join(f"line_{i} = {i}" for i in range(8)))
    assert screen.rule(leaked) == "statement-holds-the-fix"
    big = "\n".join(["diff --git a/a.py b/a.py", "--- a/a.py", "+++ b/a.py", "@@ -1,1 +1,201 @@", *[f"+v{i} = {i}" for i in range(201)]])
    assert screen.rule(inst(patch=big)) == "large-gold-patch"
    write_jsonl(path("s1", "candidates.jsonl"), [inst(7), inst(8, issue_numbers=["7"]), inst(9, problem_statement="short")])
    got = screen.screen_candidates()
    assert got == {"kept": 1, "dropped": {"issue-taken": 1, "short-statement": 1}}


def test_the_export_is_an_official_task_repository_and_the_freeze_keeps_identifiers_only(tmp_path):
    write_jsonl(path("recipes.jsonl"), [RECIPE])
    for n in range(1, 9):
        t = {**inst(n), "FAIL_TO_PASS": ["tests/test_mod.py::test_b"], "PASS_TO_PASS": ["tests/test_mod.py::test_a"], "eval_sh": validate.eval_script(inst(n), RECIPE), "ok": True}
        append_jsonl(path("s3", "validated.jsonl"), t)
        os.makedirs(os.path.dirname(path("tasks", t["instance_id"], "Dockerfile")), exist_ok=True)
        open(path("tasks", t["instance_id"], "Dockerfile"), "w").write(build.task_dockerfile(RECIPE, t))
    write_jsonl(path("s4", "review-dropped.jsonl"), [{"instance_id": "o__r-8"}])
    root = str(tmp_path / "tasks-repo")
    assert export.export(root) == 7  # the reviewed-out task is not exported
    d = os.path.join(root, "tasks", "o__r-3")
    assert sorted(os.listdir(d)) == ["Dockerfile", "eval.sh", "gold.patch", "problem_statement.md", "task.yaml", "test.patch", "tests.json"]
    yaml = open(os.path.join(d, "task.yaml")).read()
    assert 'instance_id: "o__r-3"' in yaml and "datasets:\n- SihanXU/lsw-fresh" in yaml and 'image: "lsw-fresh.sweb.eval.x86_64.o_1776_r-3:v0"' in yaml
    sys.path.insert(0, os.path.dirname(HERE))
    import pool  # bench/pool.py reads task.yaml back for `fetch`

    assert pool.task_yaml(yaml)["base_commit"] == "3".zfill(40) and pool.task_yaml(yaml)["datasets"] == ["SihanXU/lsw-fresh"]
    with open(path("s5", "gold-resolved.json"), "w") as f:
        json.dump([f"o__r-{n}" for n in range(1, 8) if n != 2], f)  # the official harness did not resolve o__r-2
    subprocess.run(["git", "init", "-q", root], check=True)
    frozen = export.freeze(root, name="fresh-test", per_repo=3, until="2026-08-07")
    try:
        # o__r-8 reviewed out, o__r-2 not resolved by the gold run, o__r-7 created on the window's end: five left, three a repository
        assert frozen["counts"]["tasks"] == 3
        assert {t["instance_id"] for t in frozen["tasks"]} <= {"o__r-1", "o__r-3", "o__r-4", "o__r-5", "o__r-6"}
        assert set(frozen["tasks"][0]) == {"instance_id", "source", "repo", "language", "created_at", "image", "issue_after"}  # no patch, no statement
    finally:
        os.remove(os.path.join(os.path.dirname(HERE), "pools", "fresh-test.json"))
