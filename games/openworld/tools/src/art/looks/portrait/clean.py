"""Clear the stray pixels from the cut layers, in place (docs/looks.md §4).

    python clean.py <out dir> [--dry] [--report <png prefix>]     (out: games/openworld/public/assets/lsw/Looks/portrait)

An edit redraws the whole picture, not only the part: the model's round trip moves the base's own lines and hatching
by a pixel or two all over the figure, and the cut (build.py) takes some of them for the part — a shirt's grey
hatching is in the hair's grey, a body's outline is ink. Repainted in a look's colours they show: blonde streaks
across a dress, a second outline down the legs, specks on the knees. They are opaque, so no alpha threshold finds
them; what tells them from the part is their shape. A part is a mass (hair, cloth, leather) with thin things that
belong to it (strands, laces, a frame's edge) close to that mass; a stray is a thin stroke or a small patch away
from it. The cut also takes the picture's flat ground where it fills a hole (the gap between an arm and the waist)
or lies along an edge: a cream wedge, a pale rim round a coat, a patch beside a boot. So, per part, body and mood,
over the union of its layers (the hair in front and the hair behind are one thing), by the table in clean.json:

1. the ground goes (`ground_of`; not in a face or the glasses, whose whites are the eyes' and the lenses'), and the
   bodies' own gaps below the neck;
2. what lies outside the slot's band of the figure's height goes, and for a part that says so what lies over the
   eyes;
3. speckle goes: components smaller than a few pixels, or that are all faint;
4. the core is what survives an opening (strokes thinner than the slot's width go), in pieces big enough to be a
   part's;
5. what is kept is the core grown back along the layer's own pixels by a reach (strands and lines on the mass's
   edge come back, a stroke across the dress does not); for what hangs from the head, the pieces that reach the head
   or lie off the body (long hair behind it, seen past the arms);
6. parts made of dots or fine strokes (a face, freckles, a scar, age's lines, stubble, glasses, thinning hair) have
   no core: their band (and the eyes) and the speckle filter are all.

Each layer keeps only its kept pixels, in both its images (the paint's alpha and the value map's agree, a pixel
without coverage has no zone, value or colour), cropped again; manifest.json takes the new boxes. It runs over what
build.py wrote, and running it twice changes nothing. `games/openworld/tools/test/portrait.test.ts` holds the result.
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

EIGHT = np.ones((3, 3), bool)


class Frame:
    """A body's frame from its own layer: the head's top, the neck, the soles (as build.py reads them from the base)."""

    def __init__(self, fig: np.ndarray):
        rows = np.nonzero(fig.any(axis=1))[0]
        self.top, self.soles = int(rows.min()), int(rows.max())
        tall = self.soles - self.top
        lo, hi = self.top + int(0.07 * tall), self.top + int(0.32 * tall)
        widths = fig[lo:hi].sum(axis=1)
        self.neck = lo + int(np.argmin(np.where(widths > 0, widths, 1 << 20)))
        self.tall = tall
        self.fig = fig

    def row(self, at: tuple[str, float]) -> int:
        """A row of the figure: ("h", f) f head heights below the head's top (the neck at 1), ("t", f) a fraction of
        the whole height (the soles at 1). A child's head is a quarter of it, an adult's a seventh."""
        unit, f = at
        return self.top + int(round(f * (self.neck - self.top if unit == "h" else self.tall)))


# per slot: the core's half width, the reach back along the layer's pixels, the smallest core piece, the band of rows
# it may lie in (Frame.row: the head's parts in head heights, the rest in the figure's), whether it hangs from the
# head; a part's own overrides; what speckle is; the bases' ground (clean.json, which the test reads too)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "clean.json"), encoding="utf-8") as _f:
    TABLE = json.load(_f)
SLOTS: dict[str, dict] = TABLE["slots"]
SPECK = TABLE["speck"]
FAINT = TABLE["faint"]
# the bases' flat pale ground (extract.background)
GROUND = np.array(TABLE["ground"], np.float32)


def params(pid: str) -> dict:
    """A part's numbers: its slot's, with its own overrides (a part of fine strokes has no core)."""
    return {**SLOTS[pid.split(".")[0]], **TABLE["parts"].get(pid, {})}


def keep_mask(alpha: np.ndarray, pid: str, fr: Frame, eyes: np.ndarray) -> np.ndarray:
    """What of a part's coverage (its layers' union on the canvas, 0-255) is the part's own. `eyes`: where the body's
    faces draw their eyes, which a part that says so never covers (an edit that redrew the eyes brings them in the
    hair's grey)."""
    p = params(pid)
    m = alpha > 0
    lo, hi = p["band"]
    band = np.zeros_like(m)
    band[max(fr.row(lo), 0) : max(fr.row(hi) + 1, 0)] = True
    m &= band
    if p.get("eyes") is False:
        m &= ~eyes
    lab, n = ndi.label(m, structure=EIGHT)
    if n:
        idx = np.arange(1, n + 1)
        size = ndi.sum(m, lab, idx)
        peak = ndi.maximum(alpha, lab, idx)
        ok = np.concatenate([[False], (size >= SPECK) & (peak >= FAINT)])
        m = ok[lab]
    if not p["r"]:
        return m
    solid = m & (alpha >= 128)
    core = ndi.binary_opening(solid, structure=EIGHT, iterations=p["r"])
    lab, n = ndi.label(core, structure=EIGHT)
    if n:
        idx = np.arange(1, n + 1)
        size = ndi.sum(core, lab, idx)
        ok = size >= p["piece"]
        if p.get("head"):
            # a solid piece lying mostly on the eyes is an eye the edit redrew in the hair's grey (a lock over an eye
            # is a piece of the hair's mass, mostly elsewhere)
            ok &= ndi.mean(eyes, lab, idx) <= 0.5
        core = np.concatenate([[False], ok])[lab]
    grown = ndi.binary_dilation(core, structure=EIGHT, iterations=p["reach"], mask=m) if core.any() else core
    if "reachOn" in p and core.any():
        # on the body a strand is grown back only a little (the body's own lines lie there, redrawn); off it, against
        # the ground, as far as the reach (a spike's tip)
        grown &= ndi.binary_dilation(core, structure=EIGHT, iterations=p["reachOn"], mask=m) | ~fr.fig
    if p.get("head"):
        # nothing thin of it over the eyes
        grown = core | (grown & ~eyes)
        # what is grown, in pieces: those that reach above the neck (long hair hangs from the head), and those that
        # lie mostly off the body (long hair behind it, seen past the arms and between an arm and the waist); a
        # solid patch on the body away from the head is the body's own hatching, redrawn
        lab, n = ndi.label(grown, structure=EIGHT)
        if n:
            idx = np.arange(1, n + 1)
            top = ndi.minimum(np.broadcast_to(np.arange(alpha.shape[0])[:, None], alpha.shape), lab, idx)
            off = ndi.mean(~fr.fig, lab, idx)
            grown = np.concatenate([[False], (top <= fr.neck) | (off > 0.5)])[lab]
    return grown


def ground_of(paint: np.ndarray, value: np.ndarray, from_row: int = 0, body: np.ndarray | None = None, eyes: np.ndarray | None = None) -> np.ndarray:
    """The ground a layer took in: pixels of the bases' flat ground colour that keep their paint (zone 0), in pieces
    of a few pixels or more, or on the layer's outer edge - a pale rim round a garment, a patch beside a boot, the
    gap between an arm and the waist filled in (the cut fills holes). From `from_row` down (a body's own face has
    the eyes' whites; the faces and the glasses are not asked). A part's (`body`: where the body is, over the
    layer's box, inset by groundInset): only pieces lying mostly off it — beside it, on its edge — or on the eyes
    (`eyes`, over the box: their whites, redrawn); well inside the body a pale piece is a highlight the part drew (a
    bald head's gloss)."""
    cover = value[..., 3] > 0
    near = (np.abs(paint[..., :3].astype(np.float32) - GROUND).max(axis=2) < TABLE["groundTol"]) & (value[..., 1] == 0) & cover
    near[: max(from_row, 0)] = False
    if not near.any():
        return near
    # the outside: the uncovered pixels that reach the layer's edge
    lab, _ = ndi.label(np.pad(~cover, 1, constant_values=True))
    outside = (lab == lab[0, 0])[1:-1, 1:-1]
    rim = ndi.binary_dilation(outside, structure=EIGHT)
    lab, n = ndi.label(near, structure=EIGHT)
    idx = np.arange(1, n + 1)
    size = ndi.sum(near, lab, idx)
    edge = ndi.maximum(rim, lab, idx).astype(bool)
    stray = (size >= TABLE["groundPiece"]) | edge
    if body is not None:
        stray &= (ndi.mean(~body, lab, idx) > 0.5) | (ndi.mean(eyes, lab, idx) > 0.5)
    return np.concatenate([[False], stray])[lab]


def load(root: str, file: str) -> tuple[np.ndarray, np.ndarray]:
    paint = np.asarray(Image.open(os.path.join(root, file + ".png")).convert("RGBA")).copy()
    value = np.asarray(Image.open(os.path.join(root, file + ".z.png")).convert("RGBA")).copy()
    return paint, value


def groups(m: dict):
    """Every part, body and mood with its layers (a part's moods are groups of their own)."""
    for pid, bodies in m["parts"].items():
        for body, e in bodies.items():
            yield pid, body, None, e["layers"]
            for mood, ls in (e.get("moods") or {}).items():
                yield pid, body, mood, ls


def clean(root: str, dry: bool = False, report: str | None = None) -> dict[str, int]:
    """Clear every layer until nothing more goes (what one pass clears can bare an edge of ground, or leave a stroke
    that hung on it alone). The pixels cleared per body and part."""
    total = sweep(root, dry, report)
    while not dry:
        more = sweep(root)
        if not any(more.values()):
            return total
        for k, v in more.items():
            total[k] = total.get(k, 0) + v
    return total


def sweep(root: str, dry: bool = False, report: str | None = None) -> dict[str, int]:
    """One pass over every layer."""
    with open(os.path.join(root, "manifest.json"), encoding="utf-8") as f:
        m = json.load(f)
    W, H = m["w"], m["h"]
    frames: dict[str, Frame] = {}
    removed: dict[str, int] = {}
    for body, e in m["bodies"].items():
        fig = np.zeros((H, W), bool)
        for l in e["layers"]:
            _, v = load(root, l["file"])
            fig[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] |= v[..., 3] > 0
        fr = Frame(fig)
        for l in e["layers"]:
            paint, value = load(root, l["file"])
            g = ground_of(paint, value, fr.neck - l["y"])
            removed[f"body/{body}"] = int(g.sum())
            paint[g] = 0
            value[g] = 0
            bare = value[..., 3] == 0
            if g.any() or paint[bare].any() or value[bare].any():
                paint[bare] = 0
                value[bare] = 0
                fig[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] &= ~bare
                if not dry:
                    path = os.path.join(root, l["file"])
                    Image.fromarray(paint, "RGBA").save(path + ".png", optimize=True)
                    Image.fromarray(value, "RGBA").save(path + ".z.png", optimize=True)
        fr.fig = fig
        frames[body] = fr
    eyes = {body: eyes_of(root, m, body) for body in m["bodies"]}
    inner = {body: ndi.binary_erosion(fr.fig, structure=EIGHT, iterations=TABLE["groundInset"]) for body, fr in frames.items()}
    sheets: dict[str, list] = {}
    for pid, body, mood, layers in groups(m):
        fr = frames[body]
        pix = [(l, *load(root, l["file"])) for l in layers]
        asked = pid.split(".")[0] not in TABLE["groundKept"]
        box = lambda a, l: a[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]]  # noqa: E731
        grounds = [ground_of(p, v, body=box(inner[body], l), eyes=box(eyes[body], l)) if asked else np.zeros(v.shape[:2], bool) for l, p, v in pix]
        union = np.zeros((H, W), np.uint8)
        for (l, _, v), g in zip(pix, grounds):
            sub = union[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]]
            np.maximum(sub, np.where(g, 0, v[..., 3]), out=sub)
        keep = keep_mask(union, pid, fr, eyes[body])
        gone = (union > 0) & ~keep
        for (l, _, _), g in zip(pix, grounds):
            gone[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] |= g
        removed[f"{pid}/{body}" + (f"~{mood}" if mood else "")] = int(gone.sum())
        if report and mood is None:
            sheets.setdefault(body, []).append((pid, keep, gone, fr))
        if dry:
            continue
        for (l, paint, value), g in zip(pix, grounds):
            # kept and covered by this layer: nothing else of it carries a zone, a value or a colour
            k = keep[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] & (value[..., 3] > 0) & ~g
            if not paint[~k].any() and not value[~k].any():
                continue
            paint[~k] = 0
            value[~k] = 0
            ys, xs = np.nonzero(value[..., 3] > 0)
            if not len(ys):
                # a layer with nothing of the part left: an empty pixel, so the manifest stays as it is shaped
                ys, xs = np.array([0]), np.array([0])
            y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
            path = os.path.join(root, l["file"])
            Image.fromarray(paint[y0:y1, x0:x1], "RGBA").save(path + ".png", optimize=True)
            Image.fromarray(value[y0:y1, x0:x1], "RGBA").save(path + ".z.png", optimize=True)
            l["x"], l["y"], l["w"], l["h"] = l["x"] + x0, l["y"] + y0, x1 - x0, y1 - y0
    if not dry:
        with open(os.path.join(root, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(m, f, indent=1)
    if report:
        write_report(report, root, m, sheets)
    return removed


def eyes_of(root: str, m: dict, body: str) -> np.ndarray:
    """Where a body's faces draw their eyes, every face and mood (the zone of the `eyes` key), a little widened."""
    eyes = np.zeros((m["h"], m["w"]), bool)
    for pid, b, _, layers in groups(m):
        if b != body or pid.split(".")[0] != "face":
            continue
        for l in layers:
            if "eyes" not in l["zones"]:
                continue
            _, v = load(root, l["file"])
            k = l["zones"].index("eyes") + 1
            eyes[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] |= (v[..., 1] == 40 * k) & (v[..., 3] > 0)
    return ndi.binary_dilation(eyes, structure=EIGHT, iterations=3)


def write_report(prefix: str, root: str, m: dict, sheets: dict) -> None:
    """Per body, every part: the body grey, what is kept red, what goes green, at a third — to look at."""
    W, H, k = m["w"], m["h"], 3
    for body, cells in sheets.items():
        base = np.full((H, W, 3), 255, np.uint8)
        base[frames_fig(root, m, body)] = (205, 205, 205)
        tiles = []
        for pid, keep, gone, _ in cells:
            c = base.copy()
            c[keep] = (210, 30, 30)
            c[ndi.binary_dilation(gone, iterations=2)] = (0, 170, 60)
            tiles.append(np.asarray(Image.fromarray(c).resize((W // k, H // k), Image.BOX)))
        cols = 8
        rows = (len(tiles) + cols - 1) // cols
        g = np.full((rows * (H // k), cols * (W // k), 3), 255, np.uint8)
        for n, t in enumerate(tiles):
            y, x = (n // cols) * (H // k), (n % cols) * (W // k)
            g[y : y + H // k, x : x + W // k] = t
        Image.fromarray(g).save(f"{prefix}-{body}.png")


def frames_fig(root: str, m: dict, body: str) -> np.ndarray:
    fig = np.zeros((m["h"], m["w"]), bool)
    for l in m["bodies"][body]["layers"]:
        _, v = load(root, l["file"])
        fig[l["y"] : l["y"] + l["h"], l["x"] : l["x"] + l["w"]] |= v[..., 3] > 0
    return fig


if __name__ == "__main__":
    args = sys.argv[1:]
    rep = args[args.index("--report") + 1] if "--report" in args else None
    out = clean(args[0], dry="--dry" in args, report=rep)
    for k, v in sorted(out.items(), key=lambda kv: -kv[1]):
        if v:
            print(f"{v:7d}  {k}")
    print(sum(out.values()), "pixels cleared over", sum(1 for v in out.values() if v), "of", len(out), "layers' groups")
