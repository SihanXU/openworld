"""Where a face's eyes are and how big (docs/looks.md §4): the measure every face picture is held to.

The style draws irises in grey (their value is their shading; the look gives the colour), so an iris is a round blob
of low saturation and middle lightness inside the head, between the brows and the nose; brows are grey too but long
and flat, lashes and lines darker, the whites lighter. A picture's eyes are its two largest such round blobs, one each
side of the face's middle. Sizes are in head widths, so a man's and a girl's numbers compare.

    python -I eyes.py <picture.png> [...]       prints each picture's eyes
    python -I eyes.py --irises <out dir>         a cut's irises made round (`round_iris`) and given their depth (`deepen`), in place
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass

import numpy as np
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bases import feet_row  # noqa: E402
from extract import H, background, figure, load  # noqa: E402


@dataclass
class Eyes:
    """Both irises: the centre (x, y) of each, their mean width and height, all in head widths; and the head's top and width in pixels."""

    left: tuple[float, float]
    right: tuple[float, float]
    w: float
    h: float
    top: int
    hw: int
    boxes: list[tuple[int, int, int, int]]

    @property
    def span(self) -> float:
        """From the left iris's centre to the right's."""
        return self.right[0] - self.left[0]

    @property
    def y(self) -> float:
        """The irises' height below the top of the head."""
        return (self.left[1] + self.right[1]) / 2


def hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mx = rgb.max(axis=2) / 255.0
    mn = rgb.min(axis=2) / 255.0
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return s, mx


def head(img: np.ndarray, bg: np.ndarray) -> tuple[int, int, int, int]:
    """The head: its top row, the neck row, its left and right columns (at its widest above the neck)."""
    soles = feet_row(img, bg)
    fig = figure(img, bg) & (np.arange(H)[:, None] <= soles + 2)
    rows = np.nonzero(fig.any(axis=1))[0]
    top = int(rows.min())
    tall = soles - top
    lo, hi = top + int(0.07 * tall), top + int(0.32 * tall)
    widths = fig[lo:hi].sum(axis=1)
    neck = lo + int(np.argmin(np.where(widths > 0, widths, 1 << 20)))
    span = fig[top:neck]
    widest = top + int(np.argmax(span.sum(axis=1)))
    cols = np.nonzero(fig[widest])[0]
    return top, neck, int(cols.min()), int(cols.max())


def windows(img: np.ndarray, band: np.ndarray, hw: int, mid: float) -> dict[str, tuple[int, int, int, int]] | None:
    """Roughly where each eye is: the largest round grey-to-black blob each side of the face's middle (after lines and
    lashes are opened away), its box. A heavy brow may join it; the circle found inside settles that."""
    s, v = hsv(img)
    m = band & (s < 0.25) & (v < 0.78)
    m = ndi.binary_fill_holes(ndi.binary_closing(m, iterations=1))
    m = ndi.binary_opening(m, structure=np.ones((3, 3)), iterations=max(2, hw // 50))
    lab, _ = ndi.label(m)
    best: dict[str, tuple[int, tuple[int, int, int, int]]] = {}
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        bw, bh = x1 - x0, y1 - y0
        area = int((lab[sl] == i).sum())
        if bw < hw * 0.04 or bh < bw * 0.3 or bh > bw * 1.8:
            continue
        side = "left" if (x0 + x1) / 2 < mid else "right"
        if side not in best or area > best[side][0]:
            best[side] = (area, (x0, y0, bw, bh))
    return {k: b for k, (_, b) in best.items()} if len(best) == 2 else None


def circle(lum: np.ndarray, body: np.ndarray, box: tuple[int, int, int, int], hw: int, near: tuple[float, float, float] | None = None) -> tuple[float, float, float] | None:
    """The iris in a window round an eye: the circle its outline votes for (a Hough transform along the gradient: at
    an iris's edge the light white or skin lies outside, the darker iris inside). Lids cut the circle, brows and lashes
    make none; a brow's arc may, but its inside is skin, and a vote counts as much as the inside is iris (`body`, the
    grey to black). Its centre and radius, in the picture's pixels. `near`: a reference's circle (an edit keeps the
    picture where it was): the centre is sought within a radius of it across and most of one up and down, so a brow
    drawn down over a narrowed eye is never taken for it — an iris further off has moved past any tolerance anyway."""
    x, y, w, h = box
    cx, cy = x + w / 2, y + h / 2
    half = max(w, h, int(0.26 * hw)) * 0.75
    if near is not None:
        cx, cy = near[0], near[1]
        half = max(half, near[2] * 2.6)
    x0, x1 = int(max(0, cx - half)), int(min(lum.shape[1], cx + half))
    y0, y1 = int(max(0, cy - half)), int(min(lum.shape[0], cy + half))
    win = ndi.gaussian_filter(lum[y0:y1, x0:x1], 1.0)
    inside = body[y0:y1, x0:x1].astype(np.float32)
    gx = ndi.sobel(win, axis=1)
    gy = ndi.sobel(win, axis=0)
    mag = np.hypot(gx, gy)
    if mag.max() <= 0:
        return None
    ys, xs = np.nonzero(mag > 0.2 * mag.max())
    ux, uy = gx[ys, xs] / mag[ys, xs], gy[ys, xs] / mag[ys, xs]
    # only the iris's lower and side edges vote (their outside lighter below and beside): the upper arc is where a lid
    # covers it and its line lies, and a lowered lid would draw the circle up and small
    low = uy >= -0.3
    ys, xs, ux, uy = ys[low], xs[low], ux[low], uy[low]
    wt = mag[ys, xs]
    rmin, rmax = max(3, int(0.045 * hw)), int(0.13 * hw)
    hgt, wid = win.shape
    best = (0.0, 0.0, 0.0, 0.0)
    peaks: dict[int, float] = {}
    for r in range(rmin, rmax + 1):
        # the centre lies a radius back against the gradient (towards the darker inside)
        px = np.round(xs - r * ux).astype(int)
        py = np.round(ys - r * uy).astype(int)
        ok = (px >= 0) & (px < wid) & (py >= 0) & (py < hgt)
        acc = np.zeros((hgt, wid))
        np.add.at(acc, (py[ok], px[ok]), wt[ok])
        # a whole circle's votes grow with its radius, a lid cuts some: weighed by the radius's square root, so a small
        # ring of lashes does not outvote the iris; and the centre near the window's middle (the eye found roughly)
        acc = ndi.gaussian_filter(acc, 1.0) / np.sqrt(r) * ndi.uniform_filter(inside, size=max(3, int(r * 1.2)))
        if near is None:
            acc[:, : int(wid * 0.15)] = 0
            acc[:, int(wid * 0.85) :] = 0
        else:
            nx, ny, nr = near[0] - x0, near[1] - y0, near[2]
            keep = np.zeros_like(acc, bool)
            keep[max(0, int(ny - 0.8 * nr)) : int(ny + 0.8 * nr) + 1, max(0, int(nx - 1.2 * nr)) : int(nx + 1.2 * nr) + 1] = True
            acc[~keep] = 0
        j = int(np.argmax(acc))
        peaks[r] = float(acc.flat[j])
        if acc.flat[j] > best[0]:
            best = (float(acc.flat[j]), float(j % wid), float(j // wid), float(r))
    if best[0] <= 0:
        return None
    # the radius between whole pixels: a parabola through the best radius's peak and its neighbours' (a pixel is a
    # tenth of an adult's iris, more than the tolerance)
    r = int(best[3])
    rad = float(r)
    if r - 1 in peaks and r + 1 in peaks:
        a_, b_, c_ = peaks[r - 1], peaks[r], peaks[r + 1]
        den = a_ - 2 * b_ + c_
        if den < 0:
            rad = r + 0.5 * (a_ - c_) / den
    return x0 + best[1], y0 + best[2], rad


def measure(path: str | np.ndarray, iris: str = "grey", near: Eyes | None = None) -> Eyes | None:
    """The eyes of a picture, a file or its pixels (None: two irises not found). `iris`: how they are painted, grey (the
    style's) or blue (the first library's): only the rough windows need to know.

    An iris is measured as the circle its outline makes (circle): its width is the circle's, whatever a lid covers;
    its place the circle's centre; its height what the lids leave of it (the grey and black down its middle). `near`:
    the reference's eyes, sought near (see circle)."""
    img = load(path) if isinstance(path, str) else path
    bg = background(img)
    top, neck, l, r = head(img, bg)
    hw = r - l
    hh = neck - top
    s, v = hsv(img)
    band = np.zeros(s.shape, bool)
    band[top + int(0.38 * hh) : top + int(0.80 * hh), l + hw // 10 : r - hw // 10] = True
    mid = (l + r) / 2
    win = windows(img, band, hw, mid)
    if win is None:
        return None
    lum = (img[..., 0] * 0.299 + img[..., 1] * 0.587 + img[..., 2] * 0.114) / 255.0
    body = ndi.binary_fill_holes((s < 0.25) & (v < 0.78))
    refs = {}
    if near is not None:
        for k, b in zip(("left", "right"), near.boxes):
            refs[k] = (b[0] + b[2] / 2, b[1] + b[3] / 2, b[2] / 2)
    found = {k: circle(lum, body, b, hw, refs.get(k)) for k, b in win.items()}
    if any(c is None for c in found.values()):
        return None
    boxes = []
    centres = []
    radii: list[float] = []
    for side in ("left", "right"):
        cx, cy, rad = found[side]  # type: ignore[misc]
        # what the lids leave: the iris's grey and black down its middle, within the circle
        col = body[int(cy - rad) : int(cy + rad) + 1, int(cx)]
        seen = int(col.sum())
        boxes.append((int(cx - rad), int(cy - rad), int(round(2 * rad)), int(round(2 * rad))))
        radii.append(rad)
        centres.append(((cx - l) / hw, (cy - top) / hw, seen / hw))
    return Eyes(
        (centres[0][0], centres[0][1]),
        (centres[1][0], centres[1][1]),
        sum(radii) / hw,
        (centres[0][2] + centres[1][2]) / 2,
        top,
        hw,
        boxes,
    )


def iris_mask(img: np.ndarray, e: Eyes, reach: float = 1.5) -> np.ndarray:
    """The irises and their pupils, by where the eyes are: about each iris found, the grey piece its middle lies in —
    bounded by the eye's dark lines and its white, so whole even when the circle found was a little small or off — and
    the dark pupil. Only below the upper lid's height: a brow drawn down onto the eye can join the piece above it (the
    caller takes the brows out too)."""
    s, v = hsv(img)
    out = np.zeros(s.shape, bool)
    yy, xx = np.mgrid[0 : s.shape[0], 0 : s.shape[1]]
    for x, y, w, h in e.boxes:
        cx, cy, r = x + w / 2, y + h / 2, w / 2
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        window = (d2 <= (r * reach) ** 2) & (yy >= cy - 0.85 * r)
        grey = window & (s < 0.25) & (v > 0.25) & (v < 0.8)
        lab, _ = ndi.label(grey)
        middle = d2 <= (0.6 * r) ** 2
        ids = np.unique(lab[middle & grey])
        iris = np.isin(lab, ids[ids > 0])
        pupil = (d2 <= (0.5 * r) ** 2) & (v <= 0.25) & (s < 0.35)
        out |= ndi.binary_fill_holes(iris | pupil) & window
    return out


# an iris's darkest (its pupil, its rim) on the value scale: near the gradient's ink, so a recoloured iris keeps its
# pupil and its ring (portrait.ts `gradient`: lines toward 0, the colour itself at 180)
DARK = 25


def deepen(value: np.ndarray, iris: np.ndarray) -> np.ndarray:
    """An iris's depth given back: the irises are drawn in a light grey with a faint pupil, and a zone's normalisation
    (build.py `Normaliser`, its gain bounded) leaves their darkest near the middle of the scale — recoloured, an iris
    was a flat disc with no pupil or ring, and the eyes looked blank. Below the irises' median the values are stretched
    so their darkest twentieth reaches DARK; the lights are left. Never flattens, and a second time changes
    nothing."""
    v = value[iris].astype(np.float32)
    if v.size < 20:
        return value
    m = float(np.median(v))
    lo = float(np.percentile(v, 5))
    if lo <= DARK + 3 or m - lo < 1:
        return value
    g = (m - DARK) / (m - lo)
    out = value.astype(np.float32)
    d = out - m
    out = np.where(iris & (d < 0), m + d * g, out)
    return np.clip(out, 0, 255)


def round_iris(iris: np.ndarray) -> np.ndarray:
    """An iris is round: the lower lid's grey and its lashes, joined to it, ran from it as a tail below the eye (the
    look's eye colour as a tear on the cheek). Each piece keeps what an opening by a small disc leaves (the iris,
    some thirteen pixels across) and a pixel back along its edge; the tail, a few pixels wide, is not the iris's."""
    disc = np.array([[0, 1, 1, 1, 0], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [0, 1, 1, 1, 0]], bool)
    core = ndi.binary_opening(iris, structure=disc)
    return iris & ndi.binary_dilation(core, structure=np.ones((3, 3), bool))


def deepen_cut(out: str) -> int:
    """Over every face layer of a cut, every mood: the irises made round (`round_iris`; what leaves them is the lid's
    line, the style's ink) and given their depth (`deepen`). The layers changed."""
    import json

    from PIL import Image

    m = json.load(open(os.path.join(out, "manifest.json"), encoding="utf-8"))
    n = 0
    for pid, per in m["parts"].items():
        if not pid.startswith("face."):
            continue
        for p in per.values():
            for layer in [*p["layers"], *[l for ls in (p.get("moods") or {}).values() for l in ls]]:
                if "eyes" not in layer["zones"]:
                    continue
                path = os.path.join(out, layer["file"])
                z = np.asarray(Image.open(path + ".z.png").convert("RGBA")).copy()
                paint = np.asarray(Image.open(path + ".png").convert("RGBA")).copy()
                was = (z[..., 1] == 40 * (layer["zones"].index("eyes") + 1)) & (z[..., 3] > 0)
                iris = round_iris(was)
                tail = was & ~iris
                if tail.any():
                    # the lid's line: ink as dark as its value says (build.py `inked`)
                    ink = np.array([46.0, 34.0, 28.0]) * np.clip(z[..., 0][tail][:, None] / 100.0, 1.0, 2.2)
                    paint[tail, :3] = np.round(ink).astype(np.uint8)
                    z[tail, 0] = 0
                    z[tail, 1] = 0
                r = np.round(deepen(z[..., 0], iris)).astype(np.uint8)
                if tail.any() or not np.array_equal(r, z[..., 0]):
                    z[..., 0] = r
                    Image.fromarray(z, "RGBA").save(path + ".z.png", optimize=True)
                    Image.fromarray(paint, "RGBA").save(path + ".png", optimize=True)
                    n += 1
    return n


def off(e: Eyes, ref: Eyes) -> dict[str, float]:
    """How far a picture's eyes are from a reference's, each as a fraction (sizes) or in head widths (places)."""
    return {
        "w": e.w / ref.w - 1,
        "h": e.h / ref.h - 1,
        "span": e.span / ref.span - 1,
        "y": e.y - ref.y,
    }


def within(e: Eyes, ref: Eyes, size: float = 0.08, place: float = 0.02, h: float | None = None) -> bool:
    """Whether a picture's eyes are the reference's: the irises' width and span within `size`, their height within `h`
    (an eyelid may cover more or less of an iris: looser), their place within `place` head widths."""
    d = off(e, ref)
    return abs(d["w"]) <= size and abs(d["span"]) <= size and abs(d["h"]) <= (h if h is not None else size * 3) and abs(d["y"]) <= place


if __name__ == "__main__":
    if sys.argv[1:2] == ["--irises"]:
        print(deepen_cut(sys.argv[2]), "face layers' irises made round and deepened")
        sys.exit(0)
    for p in sys.argv[1:]:
        e = measure(p)
        print(os.path.basename(p), "no eyes found" if e is None else f"w {e.w:.3f} h {e.h:.3f} span {e.span:.3f} y {e.y:.3f} (head {e.hw}px)")
