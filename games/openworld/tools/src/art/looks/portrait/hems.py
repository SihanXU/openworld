"""What of a garment falls over the shoes and what goes into them (docs/looks.md §4), in place.

    python hems.py <out dir>        (run by build.py after clean.py)

The stack is body < legs < outfit < shoes: stockings and trousers go into the boots. But an outfit layer is one
picture of everything its wearer has on — a coat or a cloak and the trousers under it, a dress, a robe with a stole —
and what hangs to or below the knee must fall over the boots' shafts while the trousers go into them. A whole part put
over the shoes (`above`) drew a cloak's trousers over the riding boots; one left under them drew the boots over a
coat's skirt. So every outfit is cut, from the highest row any shoe of its body reaches down:

- what goes into the shoes — the trousers, the greaves (the colour keys clean.json `into` names for the outfit, as
  the prompts in parts.py drew them) and bare skin — stays in the outfit layer, under the shoes;
- everything else (the coat, the cloak, the skirt, the robe, a stole or an apron on it, a hem's trim), with the ink
  round it, is a layer of its own drawn over the shoes (`<file>.hem`, the layer's `above`).

Every outfit of every body that reaches a shoe's rows is cut so. And a boot encloses the leg (clean.json `encloses`,
the manifest's `encloses`): below its top edge the runtime draws nothing that lies under it — no trouser or stocking
beside the shaft or between the boots — only the boot and what falls over it. A hem already cut is put
back and cut again, so running it twice changes nothing. `games/openworld/tools/test/portrait.test.ts` holds the
order for every outfit × shoes on every body.
"""

from __future__ import annotations

import json
import os
import sys
import time

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


# what of a garment's ink goes with its cloth: zone-0 pixels whose nearest coloured pixel is the cloth's, this near
INK_REACH = 3
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "clean.json"), encoding="utf-8") as _f:
    _table = json.load(_f)
INTO: dict[str, list[str]] = _table["into"]
ENCLOSES: list[str] = _table["encloses"]


def load(root: str, file: str) -> tuple[np.ndarray, np.ndarray]:
    paint = np.asarray(Image.open(os.path.join(root, file + ".png")).convert("RGBA")).copy()
    value = np.asarray(Image.open(os.path.join(root, file + ".z.png")).convert("RGBA")).copy()
    return paint, value


def on_canvas(root: str, l: dict, W: int, H: int) -> tuple[np.ndarray, np.ndarray]:
    p, v = load(root, l["file"])
    cp = np.zeros((H, W, 4), np.uint8)
    cv = np.zeros((H, W, 4), np.uint8)
    cp[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] = p
    cv[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] = v
    return cp, cv


def save(root: str, file: str, paint: np.ndarray, value: np.ndarray) -> tuple[int, int, int, int] | None:
    """Write a canvas-sized layer cropped to what it covers; its box on the canvas, or None when it covers nothing."""
    ys, xs = np.nonzero(value[..., 3] > 0)
    if not len(ys):
        return None
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    for ext, img in ((".png", paint), (".z.png", value)):
        # a file another program holds a moment (Windows: an indexer, a scanner) is tried again
        for attempt in range(5):
            try:
                Image.fromarray(img[y0:y1, x0:x1], "RGBA").save(os.path.join(root, file + ext), optimize=True)
                break
            except OSError:
                if attempt == 4:
                    raise
                time.sleep(1)
    return x0, y0, x1 - x0, y1 - y0


def shoe_top(m: dict, body: str) -> int | None:
    """The highest row any shoe of the body reaches (a riding boot's top)."""
    tops = [l["y"] for pid, per in m["parts"].items() if pid.startswith("shoes.") and body in per for l in per[body]["layers"]]
    return min(tops) if tops else None


def over_shoes(value: np.ndarray, top: int, into: list[int]) -> np.ndarray:
    """The pixels of an outfit (value map on the canvas) that fall over the shoes, from row `top` (the highest a shoe
    reaches) down: every coloured zone but those that go into the shoes (`into`, 1-based), and the ink nearest them."""
    a = value[..., 3] > 0
    zone = np.where(a, value[..., 1].astype(np.int32) // 40, -1)
    rows = (np.arange(value.shape[0]) >= top)[:, None]
    over = (zone > 0) & ~np.isin(zone, into) & rows
    if not over.any():
        return over
    dist, (iy, ix) = ndi.distance_transform_edt(~(zone > 0), return_indices=True)
    ink = (zone == 0) & rows & over[iy, ix] & (dist <= INK_REACH)
    return over | ink


def hems(root: str) -> list[str]:
    """Cut every outfit that a shoe can reach into what falls over the shoes and what goes into them, in place; the
    hem layers written."""
    with open(os.path.join(root, "manifest.json"), encoding="utf-8") as f:
        m = json.load(f)
    W, H = m["w"], m["h"]
    done = []
    for pid, per in m["parts"].items():
        if not pid.startswith("outfit."):
            continue
        for body, e in per.items():
            top = shoe_top(m, body)
            if top is None:
                continue
            # the part's layers put back together (a hem cut before goes back into its layer)
            layers = [l for l in e["layers"] if not l["file"].endswith(".hem")]
            hemmed = {l["file"][: -len(".hem")]: l for l in e["layers"] if l["file"].endswith(".hem")}
            out = []
            for l in layers:
                cp, cv = on_canvas(root, l, W, H)
                had = l["file"] in hemmed
                if had:
                    hp, hv = on_canvas(root, hemmed[l["file"]], W, H)
                    put = hv[..., 3] > 0
                    cp[put] = hp[put]
                    cv[put] = hv[put]
                over = over_shoes(cv, top, [l["zones"].index(k) + 1 for k in [*INTO.get(pid, []), "skin"] if k in l["zones"]]) if l["z"] == "outfit" and ".1" in l["zones"] else np.zeros((H, W), bool)
                hp = np.where(over[..., None], cp, 0).astype(np.uint8)
                hv = np.where(over[..., None], cv, 0).astype(np.uint8)
                cp[over] = 0
                cv[over] = 0
                rest = save(root, l["file"], cp, cv)
                if rest is not None:
                    l["x"], l["y"], l["w"], l["h"] = rest
                    out.append(l)
                # the hem written over the old one; removed only when there is none any more
                box = save(root, l["file"] + ".hem", hp, hv) if over.any() else None
                if box is None and had:
                    for ext in (".hem.png", ".hem.z.png"):
                        os.remove(os.path.join(root, l["file"] + ext))
                if box is not None:
                    out.append({"file": l["file"] + ".hem", "x": box[0], "y": box[1], "w": box[2], "h": box[3], "z": l["z"], "zones": l["zones"], "above": ["shoes"]})
                    done.append(l["file"] + ".hem")
            e["layers"] = out
            # what falls over the shoes is the hem's to say: the part as a whole stays in its place
            if "above" in e:
                e["above"] = [s for s in e["above"] if s != "shoes"]
                if not e["above"]:
                    del e["above"]
    # a boot encloses the leg: below its top nothing under it shows (portrait.ts `encloses`)
    for pid, per in m["parts"].items():
        if pid.startswith("shoes."):
            for e in per.values():
                if pid in ENCLOSES:
                    e["encloses"] = True
                else:
                    e.pop("encloses", None)
    with open(os.path.join(root, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(m, f, indent=1)
    return done


if __name__ == "__main__":
    cut_ = hems(sys.argv[1])
    print(len(cut_), "hems cut:", " ".join(cut_))
