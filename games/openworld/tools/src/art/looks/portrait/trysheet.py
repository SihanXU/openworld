"""Every face try with its measured irises boxed, beside its reference (faces.py, eyes.py): a small JPEG to check the
measure and the faces from afar.  python -I trysheet.py <work dir> <out.jpg> [only…]"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from eyes import measure, off  # noqa: E402
from faces import Refs, passes  # noqa: E402

CELL = 220


def head_crop(path: str, near=None) -> Image.Image:
    im = Image.open(path).convert("RGB")
    e = measure(path, near=near)
    d = ImageDraw.Draw(im)
    if e is None:
        d.text((10, 10), "no eyes", fill=(255, 0, 0))
        return im.crop((184, 0, 584, 400)).resize((CELL, CELL))
    for x, y, w, h in e.boxes:
        d.rectangle((x, y, x + w, y + h), outline=(255, 0, 0), width=2)
    cx = int(e.boxes[0][0] + e.boxes[1][0] + e.boxes[1][2]) // 2
    side = int(e.hw * 1.15)
    top = max(0, e.top - side // 12)
    return im.crop((cx - side // 2, top, cx + side // 2, top + side)).resize((CELL, CELL))


def main(work: str, out: str, only: list[str]) -> None:
    report = json.load(open(os.path.join(work, "faces.json"), encoding="utf-8"))
    every = json.load(open(os.path.join(work, "jobs.json"), encoding="utf-8"))
    refs = Refs(work, every)
    jobs = {os.path.basename(j["out"])[:-4]: j for j in every}
    names = [n for n in report if not only or any(o in n for o in only)]
    cols = 1 + max(len(report[n]["tries"]) for n in names)
    sheet = Image.new("RGB", (cols * CELL, len(names) * (CELL + 16)), (40, 44, 56))
    d = ImageDraw.Draw(sheet)
    for r, n in enumerate(names):
        y = r * (CELL + 16)
        # the reference measured as faces.py measures it (near its own reference)
        ref = refs(jobs[n]["edit"])
        above = refs.by_out.get(jobs[n]["edit"])
        sheet.paste(head_crop(os.path.join(work, jobs[n]["edit"]), refs(above["edit"]) if above else None), (0, y))
        d.text((2, y + CELL), f"{n} ref", fill=(220, 220, 220))
        for c, t in enumerate(report[n]["tries"], start=1):
            path = os.path.join(work, t["file"])
            sheet.paste(head_crop(path, ref), (c * CELL, y))
            # measured again: the sheet shows what the measure says now
            e = measure(path, near=ref)
            o = off(e, ref) if e and ref else {}
            ok = bool(o) and passes(o, jobs[n].get("target"))
            label = ("OK " if ok else "") + " ".join(f"{k}{v:+.2f}" for k, v in o.items())
            d.text((c * CELL + 2, y + CELL), label, fill=(120, 255, 120) if ok else (255, 160, 120))
    sheet.save(out, quality=82)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
