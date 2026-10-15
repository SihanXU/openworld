"""The miner's rules, without the network: python -m pytest bench/fresh (bench/requirements.txt)."""

from collect import is_test_path, resolved_issues, screen, split_patch
from recipes import choose, recipe_of, runner_of


def test_a_runner_keeps_the_options_and_drops_the_old_tasks_files():
    cmd = "pytest --no-header -rA --tb=line --color=no -p no:cacheprovider -W ignore::DeprecationWarning test/a.py test/b.py::test_x"
    assert runner_of(cmd) == "pytest --no-header -rA --tb=line --color=no -p no:cacheprovider -W ignore::DeprecationWarning"
    assert runner_of("pytest -rA -W ignore::DeprecationWarning") == "pytest -rA -W ignore::DeprecationWarning"
    assert runner_of(None) is None


def row(repo, source, created, **kw):
    return {"repo": repo, "source": source, "instance_id": f"{repo.replace('/', '__')}-{created[:4]}", "created_at": created, "image": f"img/{repo}", "language": kw.pop("language", "python"), **kw}


def test_a_repository_takes_its_most_recent_swe_rebench_recipe_else_swe_bench_lives():
    lb = {"install": "pip install -e .", "python": "3.11", "test_cmd": "pytest -rA t/a.py", "log_parser": "parse_log_pytest", "pre_install": ["apt-get install -y x"]}
    v2 = {"install": ["pip install -e .[dev]"], "base_image_name": "python_base_310", "test_cmd": "pytest -rA t/b.py", "log_parser": "parse_log_pytest"}
    rows = [
        row("a/one", "rebench-leaderboard", "2026-01-02T00:00:00", install_config=lb),
        row("A/One", "rebench-v2", "2025-07-01T00:00:00", install_config=v2),
        row("a/one", "live", "2026-03-01T00:00:00", test_cmds=["pytest -rA t/c.py"], log_parser="parse_log_pytest"),
        row("b/two", "live", "2025-08-01T00:00:00", test_cmds=["pytest t/d.py"], log_parser="parse_log_pytest"),
        row("c/old", "rebench-v2", "2024-01-01T00:00:00", install_config=v2),
        row("d/go", "rebench-v2", "2026-01-01T00:00:00", install_config=v2, language="go"),
    ]
    got = {r["key"]: r for r in choose(rows)}
    assert sorted(got) == ["a/one", "b/two"]  # too old, not Python: left out
    one = got["a/one"]
    assert (one["source"], one["install"], one["python"], one["runner"], one["tasks"], one["last"]) == ("rebench-leaderboard", ["pip install -e ."], "3.11", "pytest -rA", 3, "2026-03-01T00:00:00")
    assert one["pre_install"] == ["apt-get install -y x"]
    two = got["b/two"]
    assert (two["source"], two["install"], two["runner"]) == ("live", None, "pytest")  # the image is the recipe
    assert recipe_of(row("x/y", "rebench-v2", "2026-01-01", install_config=v2))["base_image"] == "python_base_310"


def test_the_issues_a_pull_request_resolves_are_found_as_swe_bench_finds_them():
    url = "https://github.com/o/r.git"
    text = "Fixes #12 and closes https://github.com/o/r/issues/7.\nSee #3.\n<!-- fixes #99 -->\nRelated to #5"
    assert resolved_issues(text, url) == ["7", "12"]


def pr(files, *, n=None, author="someone", kind="User", body="fixes #1", commits=1, more=0):
    return {
        "number": 1,
        "title": "t",
        "body": body,
        "changedFiles": n if n is not None else len(files),
        "author": {"login": author, "__typename": kind},
        "files": {"totalCount": len(files), "nodes": [{"path": f} for f in files]},
        "commits": {"totalCount": commits + more, "nodes": [{"commit": {"message": "m"}} for _ in range(commits)]},
    }


def test_a_pull_request_is_a_candidate_only_past_every_rule():
    url = "https://github.com/o/r.git"
    ok = ["src/mod.py", "tests/test_mod.py"]
    assert screen(pr(ok), url)[0] == "candidate"
    assert screen(pr(ok), url)[1] == {"tests": ["tests/test_mod.py"], "code": ["src/mod.py"], "issues": ["1"]}
    assert screen(pr(ok, author="dependabot[bot]"), url)[0] == "bot"
    assert screen(pr(ok, kind="Bot"), url)[0] == "bot"
    assert screen(pr(ok, n=16), url)[0] == "size"
    assert screen(pr(["src/mod.py"]), url)[0] == "no-tests"
    assert screen(pr(["tests/test_mod.py"]), url)[0] == "no-code"
    assert screen(pr(["README.md", "tests/test_mod.py"]), url)[0] == "no-python"
    assert screen(pr(ok, body="refactor"), url)[0] == "no-issue"
    assert screen(pr(ok, body="refactor", commits=10, more=3), url)[0] == "more-commits"  # the rest of the commits are read


def test_test_files_are_told_apart_by_the_official_words():
    assert is_test_path("tests/test_a.py") and is_test_path("pkg/testing/util.py") and is_test_path("e2e/run.py")
    assert is_test_path("src/latest.py")  # "test" anywhere in the path: SWE-bench's rule, kept as it is
    assert not is_test_path("src/mod.py")


DIFF = """diff --git a/src/mod.py b/src/mod.py
--- a/src/mod.py
+++ b/src/mod.py
@@ -1,1 +1,1 @@
-x = 1
+x = 2
diff --git a/tests/test_mod.py b/tests/test_mod.py
--- a/tests/test_mod.py
+++ b/tests/test_mod.py
@@ -1,1 +1,2 @@
 import mod
+assert mod.x == 2
"""


def test_the_diff_splits_into_the_gold_patch_and_the_test_patch():
    fix, test = split_patch(DIFF)
    assert "src/mod.py" in fix and "tests/test_mod.py" not in fix
    assert "tests/test_mod.py" in test and "+assert mod.x == 2" in test
