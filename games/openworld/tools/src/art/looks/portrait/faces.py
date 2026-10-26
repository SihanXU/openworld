"""The faces drawn and held to their eyes (docs/looks.md §4): each face picture is measured (eyes.py) against its
reference — a face's neutral against its body's base, a mood against its face's neutral — and drawn again with
another seed while its eyes moved, up to `TRIES` times; the closest try is kept and flagged when none passed.

    python -I faces.py <work dir> [only…] [--remeasure]   (the face jobs of <work>/jobs.json; `only` filters by name;
    --remeasure: the tries drawn already, measured again against their references as they are now, nothing drawn)
    python -I faces.py <work dir> --composite <name>…        (a mood none of whose tries held: its neutral's eyes over
                                                              its closest try, see composite)
    python -I faces.py <work dir> --transplant <name>…       (the neutral with the closest try's brows and mouth on it)

Every try stays in <work>/tries/ and the numbers go to <work>/faces.json, for the review sheet.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image  # noqa: E402

import comfy  # noqa: E402
from eyes import Eyes, measure, off  # noqa: E402

TRIES = int(os.environ.get("LSW_FACE_TRIES", "5"))
# how far the eyes may move: the irises' width (their circles') and the eyes' span as a fraction, their height in the
# head in head widths. How much of an iris the lids leave is the expression's, never held.
SIZE = 0.08
PLACE = 0.02


def passes(d: dict[str, float], target: dict[str, float] | None = None) -> bool:
    """Whether the eyes are where they should be: the reference's, or as far from it as a job's `target` says (a size
    reference a sixth smaller), held closer then (half the tolerance)."""
    t = target or {}
    k = 0.6 if target else 1.0
    return abs(d["w"] - t.get("w", 0)) <= SIZE * k and abs(d["span"] - t.get("span", 0)) <= SIZE * k and abs(d["y"] - t.get("y", 0)) <= PLACE


def score(d: dict[str, float], target: dict[str, float] | None = None) -> float:
    t = target or {}
    return abs(d["w"] - t.get("w", 0)) / SIZE + abs(d["span"] - t.get("span", 0)) / SIZE + abs(d["y"] - t.get("y", 0)) / PLACE


class Refs:
    """Each picture's eyes measured as a reference: a base plainly, anything drawn from another picture near that
    one's eyes (a mood near its neutral, a neutral near its size reference, that near its base) — so a heavy brow is
    never taken for an eye in a reference either."""

    def __init__(self, work: str, jobs: list[dict]):
        self.work = work
        self.by_out = {j["out"]: j for j in jobs}
        self.cache: dict[str, Eyes | None] = {}

    def __call__(self, rel: str) -> Eyes | None:
        if rel not in self.cache:
            j = self.by_out.get(rel)
            # only faces and size references chain; a base is measured on its own (the girl's was drawn from the
            # woman's, whose eyes are elsewhere)
            chained = j is not None and (j.get("target") or j["out"].startswith("parts/face."))
            near = self(j["edit"]) if chained else None
            self.cache[rel] = measure(os.path.join(self.work, rel), near=near)
        return self.cache[rel]

    def forget(self, rel: str) -> None:
        self.cache.pop(rel, None)


def composite(work: str, name: str, j: dict, ref: Eyes, report: dict) -> dict:
    """For a mood whose eyes would not hold in any try (a surprise opens them wider whatever it is told): its eyes —
    the irises, the lids, the lashes — taken from its reference (the face's neutral), the rest (the brows, the mouth,
    a blush) from its closest try, blended over a few pixels. Its eyes are then its neutral's by construction."""
    import numpy as np
    from scipy import ndimage as ndi

    tries = report[name]["tries"]
    best = min((t for t in tries if t["off"]), key=lambda t: score(t["off"]))
    src = np.asarray(Image.open(os.path.join(work, j["edit"])).convert("RGB")).astype(np.float32)
    img = np.asarray(Image.open(os.path.join(work, best["file"])).convert("RGB")).astype(np.float32)
    if img.shape != src.shape:
        img = np.asarray(Image.open(os.path.join(work, best["file"])).convert("RGB").resize(src.shape[1::-1])).astype(np.float32)
    yy, xx = np.mgrid[0 : src.shape[0], 0 : src.shape[1]]
    mask = np.zeros(src.shape[:2], np.float32)
    # both pictures' eyes (the try's opened wider would show round the neutral's as a second lid), each the whole eye
    # about its iris: the corners either side, the lid and lashes above (short of the brow), the lower lid
    theirs = measure(os.path.join(work, best["file"]), near=ref)
    for x, y, w, h in [*ref.boxes, *(theirs.boxes if theirs else [])]:
        cx, cy, r = x + w / 2, y + h / 2, w / 2
        up = (yy < cy) * (r * 1.55) + (yy >= cy) * (r * 1.6)
        mask = np.maximum(mask, ((((xx - cx) / (r * 2.3)) ** 2 + ((yy - cy) / up) ** 2) <= 1).astype(np.float32))
    mask = np.clip(ndi.gaussian_filter(mask, 2.0), 0, 1)[..., None]
    out = src * mask + img * (1 - mask)
    path = os.path.join(work, "tries", f"{name}.composite.png")
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path)
    shutil.copyfile(path, os.path.join(work, j["out"]))
    entry = {"kept": os.path.relpath(path, work), "ok": True, "off": {"w": 0.0, "h": 0.0, "span": 0.0, "y": 0.0}, "composite": best["file"], "tries": tries}
    report[name] = entry
    return entry


def transplant(work: str, name: str, j: dict, ref: Eyes, report: dict) -> dict:
    """The other way round, for a mood whose try lifts the lids almost to the brows (a surprise on a narrowed or
    half-lidded face), where no mask round the eyes can take the brows without the lifted lid's line: the neutral
    picture with only the brows and the mouth of the closest try put on it. In the band above the eyes, a pixel is the
    try's where either picture has a brow there (the brows are mid grey; a lid's line is dark and is never taken); below
    the eyes, the try's where it changed the picture (the mouth). The eyes are the neutral's untouched."""
    import numpy as np
    from scipy import ndimage as ndi

    tries = report[name]["tries"]
    best = min((t for t in tries if t["off"]), key=lambda t: score(t["off"]))
    src = np.asarray(Image.open(os.path.join(work, j["edit"])).convert("RGB")).astype(np.float32)
    img = np.asarray(Image.open(os.path.join(work, best["file"])).convert("RGB")).astype(np.float32)
    r = ref.hw * ref.w / 2
    cy = min(b[1] + b[3] / 2 for b in ref.boxes)
    x0 = min(b[0] for b in ref.boxes) - 2.6 * r
    x1 = max(b[0] + b[2] for b in ref.boxes) + 2.6 * r
    yy, xx = np.mgrid[0 : src.shape[0], 0 : src.shape[1]]
    inside = (xx > x0) & (xx < x1)

    def brow(a: np.ndarray) -> np.ndarray:
        mx, mn = a.max(axis=2) / 255, a.min(axis=2) / 255
        s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
        return (s < 0.22) & (mx > 0.3) & (mx < 0.78)

    band = inside & (yy < cy - 1.3 * r) & (yy > cy - 5.5 * r)
    # the try's brows: on each side the largest grey stroke in the band (a lifted lid's shading is grey too, but small)
    lab, n = ndi.label(ndi.binary_opening(brow(img) & band, iterations=1))
    mid = (x0 + x1) / 2
    keep_ids = []
    for side in (lambda c: c < mid, lambda c: c >= mid):
        sizes = [(int((lab == i).sum()), i) for i, sl in enumerate(ndi.find_objects(lab), start=1) if sl is not None and side((sl[1].start + sl[1].stop) / 2)]
        if sizes:
            keep_ids.append(max(sizes)[1])
    new = band & ndi.binary_dilation(np.isin(lab, keep_ids), iterations=2)
    # the neutral's own brows where the try has none: painted over with the skin round them (the try has a lifted
    # lid's line there, which would show as a second lid)
    old = band & ndi.binary_dilation(brow(src), iterations=3) & ~new
    bare = band & ~ndi.binary_dilation(brow(src) | brow(img), iterations=4) & (src.min(axis=2) > 120)
    skin = np.median(src[bare], axis=0) if bare.any() else np.array([240.0, 225.0, 210.0])
    paint = src.copy()
    paint[old] = skin
    below = inside & (yy > cy + 2.2 * r) & (yy < cy + 9 * r)
    changed = np.abs(img - src).max(axis=2) > 30
    mouth = below & ndi.binary_dilation(ndi.binary_opening(changed & below, iterations=1), iterations=4)
    mask = np.clip(ndi.gaussian_filter((new | mouth).astype(np.float32), 1.2), 0, 1)[..., None]
    soft_old = np.clip(ndi.gaussian_filter(old.astype(np.float32), 1.2), 0, 1)[..., None]
    base = src * (1 - soft_old) + paint * soft_old
    out = img * mask + base * (1 - mask)
    path = os.path.join(work, "tries", f"{name}.transplant.png")
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path)
    shutil.copyfile(path, os.path.join(work, j["out"]))
    report[name] = {"kept": os.path.relpath(path, work), "ok": True, "off": {"w": 0.0, "h": 0.0, "span": 0.0, "y": 0.0}, "transplant": best["file"], "tries": tries}
    return report[name]


def keep(work: str, out: str, name: str, j: dict, tries: list[dict], report: dict) -> dict | None:
    """The try kept: the one kept before while it still passes (what was drawn from it stays true to it), else the
    first that passes, else the closest; copied to the part's place."""
    before = report.get(name, {}).get("kept")
    kept = next((t for t in tries if t["ok"] and t["file"] == before), None)
    kept = kept or next((t for t in tries if t["ok"]), None) or min((t for t in tries if t["off"]), key=lambda t: score(t["off"], j.get("target")), default=None)
    if kept is not None:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        shutil.copyfile(os.path.join(work, kept["file"]), out)
        report[name] = {"kept": kept["file"], "ok": kept["ok"], "off": kept["off"], "tries": tries}
    return kept


def main(work: str, only: list[str], remeasure: bool = False) -> None:
    every = json.load(open(os.path.join(work, "jobs.json"), encoding="utf-8"))
    refs = Refs(work, every)
    jobs = [j for j in every if j["out"].startswith("parts/face.") or j.get("target")]
    if only:
        jobs = [j for j in jobs if any(o in j["out"] for o in only)]
    # the size references first, then the neutrals (the moods' references), then the moods
    jobs.sort(key=lambda j: 0 if j.get("target") else 1 if "~" not in j["out"] else 2)
    report_path = os.path.join(work, "faces.json")
    report = json.load(open(report_path, encoding="utf-8")) if os.path.exists(report_path) else {}
    os.makedirs(os.path.join(work, "tries"), exist_ok=True)
    for n, j in enumerate(jobs, start=1):
        out = os.path.join(work, j["out"])
        name = os.path.basename(out)[:-4]
        ref = refs(j["edit"])
        if ref is None:
            print(f"[{n}/{len(jobs)}] {name}: its reference has no eyes found, skipped", flush=True)
            continue
        if remeasure:
            # the tries drawn already, measured again against the reference as it is now; nothing is drawn
            tries = report.get(name, {}).get("tries", [])
            for t in tries:
                e = measure(os.path.join(work, t["file"]), near=ref)
                t["off"] = off(e, ref) if e else None
                t["ok"] = t["off"] is not None and passes(t["off"], j.get("target"))
            kept = keep(work, out, name, j, tries, report)
            refs.forget(j["out"])
            if kept is not None:
                print(f"[{n}/{len(jobs)}] {name}: {'ok' if kept['ok'] else 'none passes'} (try {tries.index(kept)} of {len(tries)})", flush=True)
            json.dump(report, open(report_path, "w", encoding="utf-8"), indent=1)
            continue
        # done when kept and passing (one that kept only the closest try is drawn again)
        if os.path.exists(out) and report.get(name, {}).get("ok"):
            continue
        src = os.path.join(work, j["edit"])
        tries = []
        first = len(report.get(name, {}).get("tries", []))
        for k in range(first, first + TRIES):
            t0 = time.time()
            seed = j["seed"] + 7919 * k
            img = comfy.edit(Image.open(src).convert("RGB"), j["prompt"], seed)
            path = os.path.join(work, "tries", f"{name}.{k}.png")
            img.save(path)
            e = measure(path, near=ref)
            d = off(e, ref) if e else None
            ok = d is not None and passes(d, j.get("target"))
            tries.append({"seed": seed, "file": os.path.relpath(path, work), "off": d, "ok": ok})
            print(f"[{n}/{len(jobs)}] {name} try {k}: {'ok' if ok else 'moved'} {json.dumps({a: round(b, 3) for a, b in (d or {}).items()})} {time.time() - t0:.0f}s", flush=True)
            if ok:
                break
        # this run's tries chosen from (the earlier ones failed), all of them kept in the report
        earlier = report.get(name, {}).get("tries", [])
        kept = keep(work, out, name, j, tries, report)
        refs.forget(j["out"])
        if kept is None:
            print(f"[{n}/{len(jobs)}] {name}: no eyes found in any try", flush=True)
            continue
        report[name]["tries"] = earlier + tries
        json.dump(report, open(report_path, "w", encoding="utf-8"), indent=1)


def composites(work: str, names: list[str], how=None) -> None:
    every = json.load(open(os.path.join(work, "jobs.json"), encoding="utf-8"))
    refs = Refs(work, every)
    by_name = {os.path.basename(j["out"])[:-4]: j for j in every}
    report_path = os.path.join(work, "faces.json")
    report = json.load(open(report_path, encoding="utf-8"))
    for name in names:
        j = by_name[name]
        (how or composite)(work, name, j, refs(j["edit"]), report)
        print(f"{name}: from {report[name].get('composite') or report[name].get('transplant')}", flush=True)
    json.dump(report, open(report_path, "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    args = sys.argv[2:]
    if args and args[0] == "--composite":
        composites(sys.argv[1], args[1:])
    elif args and args[0] == "--transplant":
        composites(sys.argv[1], args[1:], transplant)
    else:
        main(sys.argv[1], [a for a in args if a != "--remeasure"], "--remeasure" in args)
