"""Run a list of generations (docs/looks.md §4): each job draws or edits one picture; done ones are skipped.

    python -I batch.py jobs.json

A job: {"out": "path.png", "prompt": "...", "seed": 1, "edit": "input.png"?}. Paths are relative to the jobs file.
"""

from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image  # noqa: E402

import comfy  # noqa: E402
from bases import prepare  # noqa: E402


def main(path: str) -> None:
    root = os.path.dirname(os.path.abspath(path))
    jobs = json.load(open(path, encoding="utf-8"))
    # passes until nothing more can run: a job waits for the picture it edits (a base, a face's neutral)
    progress = True
    while progress:
        progress = False
        prepare(root)
        for i, j in enumerate(jobs):
            progress |= run(root, i, j, len(jobs))


def run(root: str, i: int, j: dict, n: int) -> bool:
    if True:
        out = os.path.join(root, j["out"])
        if os.path.exists(out):
            return False
        os.makedirs(os.path.dirname(out), exist_ok=True)
        t = time.time()
        src = os.path.join(root, j["edit"]) if j.get("edit") else None
        if src and not os.path.exists(src):
            return False
        try:
            img = comfy.edit(Image.open(src).convert("RGB"), j["prompt"], j.get("seed", 0)) if src else comfy.draw(j["prompt"], j.get("seed", 0))
        except Exception as e:  # noqa: BLE001 - one failed picture does not stop the library
            print(f"[{i + 1}/{n}] {j['out']} failed: {e}", flush=True)
            return False
        img.save(out)
        print(f"[{i + 1}/{n}] {j['out']} in {time.time() - t:.0f}s", flush=True)
        prepare(root)
        return True


if __name__ == "__main__":
    main(sys.argv[1])
