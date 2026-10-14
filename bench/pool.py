"""The RSI experiments' benchmark pool (docs/rsi-experiments.md §4.1): the public SWE-style datasets
counted by date, a pool frozen as identifiers, a frozen pool's instances fetched for a run.

A pool is decontaminated by date: only tasks created on or after a day the frozen model cannot have
trained past (Kimi K3's release, 2026-07-16). Each source is pinned to a revision of its dataset, so a
count or a pool means the same thing on any machine and later. A frozen pool holds identifiers and
metadata only — never a problem statement, a patch or a test — so nothing the agent may read in this
repository tells it a benchmark answer; `fetch` writes the instances into var/ (not tracked).

No model is called. Needs pyarrow (pip install pyarrow); only the columns needed are read, by HTTP
range requests, so the datasets are never downloaded whole.

  python bench/pool.py count [--after 2026-07-16]
  python bench/pool.py freeze <name> [--after 2026-07-16] [--sources multilang,…] [--languages …] [--no-image-check]
  python bench/pool.py fetch bench/pools/<name>.json [--out var/bench/<name>.instances.jsonl]
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import io
import json
import os
import sys
import urllib.request

HF = "https://huggingface.co/datasets"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Kimi K3's release (the API on 2026-07-16, the weights on 2026-07-27): no task created on or after it
# can be in the frozen model's training data (docs/rsi-experiments.md §3).
AFTER = "2026-07-16"

# The sources, each at the revision it was counted at (2026-10-14). `image`: the column naming the
# task's image, or a template on the instance id; `language`: a column, a fixed language, or the split.
SOURCES: dict[str, dict] = {
    "rebench-leaderboard": {
        "dataset": "nebius/SWE-rebench-leaderboard",
        "revision": "34d5a58864acf91613740a09ec5d205228dcfa39",
        "files": ["data/test-00000-of-00001.parquet"],
        "image": "docker_image",
        "language": "python",
    },
    "rebench-v2": {
        "dataset": "nebius/SWE-rebench-V2",
        "revision": "10483de0f50fe5da545942705a76c6150171af7f",
        "files": ["data/train-00000-of-00001.parquet"],
        "image": "image_name",
        "language": "column",
    },
    "live": {
        "dataset": "SWE-bench-Live/SWE-bench-Live",
        "revision": "b51a86422e10cfd403beb4773e5a2947953e36ec",
        "files": ["data/full-00000-of-00002.parquet", "data/full-00001-of-00002.parquet"],
        "image": "template:starryzhang/sweb.eval.x86_64.{id1776}",
        "language": "python",
    },
    "multilang": {
        "dataset": "SWE-bench-Live/MultiLang",
        "revision": "3638632e8153a10ca422c1022bed79023084b5c9",
        "files": [f"data/{lang}-00000-of-00001.parquet" for lang in ["c", "cpp", "cs", "go", "java", "js", "rust", "ts"]],
        "image": "docker_image",
        "language": "split",
    },
}

META = ["instance_id", "repo", "created_at", "image_name", "docker_image", "language"]
FULL = ["instance_id", "repo", "base_commit", "problem_statement", "hints_text"]


class RangeFile(io.RawIOBase):
    """A read-only, seekable file over HTTP range requests: pyarrow reads the footer and the columns it needs."""

    def __init__(self, url: str):
        self.url, self.pos = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, off: int, whence: int = 0) -> int:
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def read(self, n: int = -1) -> bytes:
        if n is None or n < 0:
            n = self.size - self.pos
        if n == 0 or self.pos >= self.size:
            return b""
        end = min(self.size, self.pos + n) - 1
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
        self.pos += len(data)
        return data

    def readinto(self, b) -> int:
        d = self.read(len(b))
        b[: len(d)] = d
        return len(d)


def when(v) -> str | None:
    """A created_at as ISO text (the sources write it as text, or as seconds, milliseconds or nanoseconds)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        x = float(v)
        x = x / 1e9 if x > 1e14 else x / 1e3 if x > 1e11 else x
        return dt.datetime.fromtimestamp(x, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    if hasattr(v, "isoformat"):
        return v.isoformat()[:19]
    return str(v).replace(" ", "T")[:19]


def rows(key: str, columns: list[str]) -> list[dict]:
    """A source's rows, the named columns only (those it has), with its language and image resolved."""
    import pyarrow.parquet as pq

    src = SOURCES[key]
    out = []
    for f in src["files"]:
        p = pq.ParquetFile(RangeFile(f"{HF}/{src['dataset']}/resolve/{src['revision']}/{f}"))
        have = [c for c in columns if c in p.schema_arrow.names]
        split = os.path.basename(f).split("-")[0]
        for r in p.read(columns=have).to_pylist():
            if "created_at" in r:
                r["created_at"] = when(r["created_at"])
            lang = src["language"]
            r["language"] = r.get("language") if lang == "column" else split if lang == "split" else lang
            img = src["image"]
            r["image"] = img[len("template:"):].replace("{id1776}", r["instance_id"].replace("__", "_1776_")).lower() if img.startswith("template:") else r.get(img)
            for c in ("image_name", "docker_image"):
                r.pop(c, None)
            r["source"] = key
            out.append(r)
    return out


def image_exists(ref: str) -> bool:
    """Whether Docker Hub has the image (its manifest answers), asked anonymously."""
    name, _, tag = ref.partition(":")
    tag = tag or "latest"
    try:
        with urllib.request.urlopen(f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{name}:pull", timeout=60) as r:
            token = json.load(r)["token"]
        accept = ",".join(
            [
                "application/vnd.docker.distribution.manifest.v2+json",
                "application/vnd.docker.distribution.manifest.list.v2+json",
                "application/vnd.oci.image.manifest.v1+json",
                "application/vnd.oci.image.index.v1+json",
            ]
        )
        req = urllib.request.Request(f"https://registry-1.docker.io/v2/{name}/manifests/{tag}", method="HEAD", headers={"Authorization": f"Bearer {token}", "Accept": accept})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status == 200
    except Exception:
        return False


def count(after: str) -> dict:
    report = {}
    for key, src in SOURCES.items():
        rs = rows(key, META)
        dates = sorted(r["created_at"] for r in rs if r["created_at"])
        late = [r for r in rs if (r["created_at"] or "") >= after]
        report[key] = {
            "dataset": src["dataset"],
            "revision": src["revision"],
            "tasks": len(rs),
            "first": dates[0] if dates else None,
            "last": dates[-1] if dates else None,
            "after": len(late),
            "after_by_language": dict(collections.Counter(r["language"] for r in late).most_common()),
            "last_months": dict(sorted(collections.Counter(d[:7] for d in dates).items())[-6:]),
        }
        r = report[key]
        print(f"{key:20} {r['tasks']:6} tasks, {r['first']} to {r['last']}; on or after {after}: {r['after']} {r['after_by_language']}")
        print(f"{'':20} last months: {r['last_months']}")
    return report


def freeze(name: str, after: str, sources: list[str], languages: list[str] | None, check_images: bool) -> dict:
    tasks, seen = [], set()
    for key in sources:
        for r in rows(key, META):
            if (r["created_at"] or "") < after or (languages and r["language"] not in languages):
                continue
            ident = r["instance_id"].lower()
            if ident in seen:  # the same pull request in two sources: the first source keeps it
                continue
            seen.add(ident)
            tasks.append({k: r.get(k) for k in ("instance_id", "source", "repo", "language", "created_at", "image")})
    missing = []
    if check_images:
        for t in tasks:
            if not t["image"] or not image_exists(t["image"]):
                missing.append(t["instance_id"])
        tasks = [t for t in tasks if t["instance_id"] not in missing]
    tasks.sort(key=lambda t: (t["created_at"], t["instance_id"]))
    pool = {
        "name": name,
        "frozen": dt.date.today().isoformat(),
        "criterion": {"created_on_or_after": after, "sources": sources, "languages": languages, "images_checked": check_images},
        "sources": {k: {"dataset": SOURCES[k]["dataset"], "revision": SOURCES[k]["revision"]} for k in sources},
        "counts": {
            "tasks": len(tasks),
            "dropped_without_image": len(missing),
            "by_source": dict(collections.Counter(t["source"] for t in tasks).most_common()),
            "by_language": dict(collections.Counter(t["language"] for t in tasks).most_common()),
            "repositories": len({t["repo"] for t in tasks}),
            "largest_repositories": dict(collections.Counter(t["repo"] for t in tasks).most_common(5)),
        },
        "tasks": tasks,
    }
    os.makedirs(os.path.join(ROOT, "bench", "pools"), exist_ok=True)
    path = os.path.join(ROOT, "bench", "pools", f"{name}.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(pool, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"{path}: {json.dumps(pool['counts'])}")
    return pool


def fetch(pool_path: str, out: str | None) -> str:
    with open(pool_path, encoding="utf-8") as f:
        pool = json.load(f)
    want = {t["instance_id"]: t for t in pool["tasks"]}
    got = {}
    for key, pin in pool["sources"].items():
        if SOURCES[key]["revision"] != pin["revision"]:
            sys.exit(f"{key}: the pool was frozen at {pin['revision']}, this file reads {SOURCES[key]['revision']}")
        for r in rows(key, FULL):
            if r["instance_id"] in want and r["instance_id"] not in got:
                t = want[r["instance_id"]]
                got[r["instance_id"]] = {
                    "instance_id": r["instance_id"],
                    "repo": r["repo"],
                    "base_commit": r["base_commit"],
                    "problem_statement": r["problem_statement"],
                    "hints_text": r.get("hints_text") or "",
                    "image": t["image"],
                    "workdir": "/testbed",
                }
    lost = [i for i in want if i not in got]
    if lost:
        sys.exit(f"{len(lost)} tasks of the pool are not in its sources: {lost[:5]}")
    out = out or os.path.join(ROOT, "var", "bench", f"{pool['name']}.instances.jsonl")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        for t in pool["tasks"]:
            f.write(json.dumps(got[t["instance_id"]], ensure_ascii=False) + "\n")
    print(f"{out}: {len(got)} instances")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("count")
    c.add_argument("--after", default=AFTER)
    c.add_argument("--json", help="also write the counts here")
    z = sub.add_parser("freeze")
    z.add_argument("name")
    z.add_argument("--after", default=AFTER)
    z.add_argument("--sources", default=",".join(SOURCES))
    z.add_argument("--languages")
    z.add_argument("--no-image-check", action="store_true")
    g = sub.add_parser("fetch")
    g.add_argument("pool")
    g.add_argument("--out")
    a = ap.parse_args()
    if a.cmd == "count":
        report = count(a.after)
        if a.json:
            with open(a.json, "w", encoding="utf-8", newline="\n") as f:
                json.dump({"after": a.after, "counted": dt.date.today().isoformat(), "sources": report}, f, indent=1)
                f.write("\n")
    elif a.cmd == "freeze":
        unknown = [s for s in a.sources.split(",") if s not in SOURCES]
        if unknown:
            sys.exit(f"unknown sources {unknown} (known: {', '.join(SOURCES)})")
        freeze(a.name, a.after, a.sources.split(","), a.languages.split(",") if a.languages else None, not a.no_image_check)
    else:
        fetch(a.pool, a.out)


if __name__ == "__main__":
    main()
