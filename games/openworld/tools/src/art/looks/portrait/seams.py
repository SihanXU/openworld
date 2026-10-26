"""Where a face layer meets the body it lies on, are their skins the same (docs/looks.md §4)? A face whose skin is
lighter or darker than the body's shows as a box round the eyes once hair frames it. Reads a cut's layers (the value
maps: R the value, G 40 × the zone, A coverage) and, per face, body and mood, compares the face's skin values in its
rim with the body's at the same places.

    python -I seams.py <out dir> [limit]     (prints every face whose rim differs by more than `limit`, default 4)
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def canvas(out: str, layer: dict, w: int, h: int) -> np.ndarray:
    z = np.asarray(Image.open(os.path.join(out, layer["file"] + ".z.png")).convert("RGBA")).astype(np.float32)
    c = np.zeros((h, w, 4), np.float32)
    c[layer["y"] : layer["y"] + layer["h"], layer["x"] : layer["x"] + layer["w"]] = z
    return c


def main(out: str, limit: float) -> int:
    m = json.load(open(os.path.join(out, "manifest.json"), encoding="utf-8"))
    W, H = m["w"], m["h"]
    bodies = {b: canvas(out, d["layers"][0], W, H) for b, d in m["bodies"].items()}
    bad = 0
    rows = []
    for pid, per in m["parts"].items():
        if not pid.startswith("face."):
            continue
        for body, p in per.items():
            for mood, layers in [("neutral", p["layers"]), *(p.get("moods") or {}).items()]:
                f = canvas(out, layers[0], W, H)
                b = bodies[body]
                skin_k = layers[0]["zones"].index("skin") + 1
                inside = f[..., 3] > 200
                rim = inside & ~ndi.binary_erosion(inside, iterations=6)
                both = rim & (np.round(f[..., 1] / 40) == skin_k) & (np.round(b[..., 1] / 40) == 1) & (b[..., 3] > 200)
                if both.sum() < 30:
                    continue
                d = float(np.median(f[..., 0][both]) - np.median(b[..., 0][both]))
                rows.append((abs(d), f"{pid}@{body} {mood}", d))
    rows.sort(reverse=True)
    for a, name, d in rows:
        if a > limit:
            bad += 1
            print(f"{name}: the face's skin {d:+.1f} from the body's")
    print(f"{len(rows)} faces, {bad} over {limit}; the largest {rows[0][2]:+.1f} ({rows[0][1]})" if rows else "no faces")
    return bad


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 4.0) else 0)
