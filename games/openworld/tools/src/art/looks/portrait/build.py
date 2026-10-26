"""Cut the drawn parts into the game's portrait layers and write the manifest (docs/looks.md §4).

    python -I build.py <work dir> <out dir>     (out: games/openworld/public/assets/lsw/Looks/portrait)

Reads <work>/lib/base-<body>.png and <work>/parts/<part>@<body>[~<mood>].png (parts.py), writes per layer a
paint and a value map (extract.py) at the game's size, and manifest.json (runtime/src/assets/figure/portrait.ts):
the canvas (a full figure, W x H), each body's layers and its bust (the square the dialogue box shows: the head
and the shoulders), each part's layers per body. A part not drawn yet is left out of the manifest: the portrait
shows the body without it.
"""

from __future__ import annotations

import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bases import feet_row  # noqa: E402
from extract import H, W, background, changed, figure, load, luminance, matte  # noqa: E402
from parts import LONG  # noqa: E402
from eyes import deepen, iris_mask, measure, round_iris  # noqa: E402

BODIES = ("woman", "man", "girl", "boy")
MOODS = ["happy", "sad", "angry", "surprised", "shy"]
# hats under which the hair goes: the hair shows only below their lower edge
COVERING = {"hat.straw", "hat.kerchief", "hat.hood", "hat.helm", "hat.cap"}


def hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r, g, b = (rgb[..., k] / 255.0 for k in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r)
    gg = m & (mx == g) & ~rr
    bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    h *= 60
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


class Normaliser:
    """A zone's luminance onto the shared value scale (lines toward 0, shadow ~145, base 180, light ~222).

    Anchored at the zone's median (its base tone, which becomes the look's colour itself) with a gain each side
    that brings its shadow and its light to the scale's, but never steeper than 1.4: a flat zone (cel-shaded skin)
    keeps its small variations small, so the model's paper-grain does not turn into blotches.
    """

    def __init__(self, lum: np.ndarray):
        v = lum if lum.size >= 16 else np.array([60, 120, 160, 200, 240], np.float32)
        self.m = float(np.median(v))
        lo, hi = np.percentile(v, [8, 96])
        self.gs = float(np.clip(35.0 / max(self.m - lo, 1.0), 0.6, 1.4))
        self.gl = float(np.clip(42.0 / max(hi - self.m, 1.0), 0.6, 1.4))

    def __call__(self, lum: np.ndarray) -> np.ndarray:
        d = lum - self.m
        return np.clip(180.0 + np.where(d < 0, d * self.gs, d * self.gl), 0, 255)


def skin_mask(rgb: np.ndarray, skin_ref: np.ndarray, lo: float = 0.7, vmin: float = 0.45) -> np.ndarray:
    """Pixels the colour of the base's skin (in its hue band, light enough), shaded or lit: at least `lo` of the
    skin's own saturation — the style's warm greys (hair, brows, the ink's hatching) are in the same hue band and
    only less saturated; `vmin` how light it must be (the style's skin is light, its hair mid-grey)."""
    h, s, v = hsv(rgb)
    hr, sr, vr = hsv(skin_ref[None, None, :])
    dh = np.minimum(np.abs(h - hr[0, 0]), 360 - np.abs(h - hr[0, 0]))
    return (dh < 22) & (s > lo * float(sr[0, 0])) & (s < 0.6) & (v > vmin)


INK = np.array([46.0, 34.0, 28.0])  # the style's dark sepia ink (docs/looks.md §4)


def inked(rgb: np.ndarray, lines: np.ndarray) -> np.ndarray:
    """The lines kept as ink, whatever colour they were drawn beside: the style's lines are never repainted (a red
    key cloth's outline is ink, not dark red). Their darkness is kept, their colour is the ink's."""
    out = rgb.copy()
    lum = luminance(rgb)[..., None]
    out[lines] = (INK * np.clip(lum / 46.0, 0.0, 2.2))[lines]
    return out


def nearest_fill(zones: np.ndarray, holes: np.ndarray) -> np.ndarray:
    """Lines take the zone of the nearest coloured pixel (a line round red cloth is red cloth's darkest)."""
    known = (zones > 0) & ~holes
    if not known.any():
        return zones
    _, (iy, ix) = ndi.distance_transform_edt(~known, return_indices=True)
    out = zones.copy()
    out[holes] = zones[iy[holes], ix[holes]]
    return out


def save(out_dir: str, rel: str, rgb: np.ndarray, alpha: np.ndarray, zones: np.ndarray, value: np.ndarray) -> dict | None:
    """Write a layer at the game's size, cropped to what it covers: its paint and its value map. Its manifest entry."""
    a8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    # the paint is read only where no colour key repaints a pixel (zone 0): elsewhere it is left blank, which packs small
    rgb = np.where((zones > 0)[..., None], 0, rgb)
    paint = Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a8]), "RGBA")
    va = Image.fromarray(np.dstack([np.clip(value, 0, 255).astype(np.uint8), a8]), "LA")
    zi = Image.fromarray((zones * 40).astype(np.uint8), "L")
    P = np.asarray(paint)
    VA = np.asarray(va)
    Z = np.asarray(zi)
    A = VA[..., 1]
    ys, xs = np.nonzero(A > 4)
    if not len(ys):
        return None
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    zmap = np.dstack([VA[..., 0], Z, np.zeros_like(Z), A])[y0:y1, x0:x1]
    path = os.path.join(out_dir, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(P[y0:y1, x0:x1], "RGBA").save(path + ".png", optimize=True)
    Image.fromarray(zmap.astype(np.uint8), "RGBA").save(path + ".z.png", optimize=True)
    return {"file": rel.replace(os.sep, "/"), "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}


class Frame:
    """Where a body's parts are, read from its base: the head's top, the neck, the knees and the soles; the bust."""

    def __init__(self, fig: np.ndarray, soles: int):
        rows = np.nonzero(fig.any(axis=1))[0]
        self.top = int(rows.min())
        self.soles = soles
        tall = self.soles - self.top
        # the neck: the narrowest row between the head and the shoulders (a head is a seventh of an adult, a
        # quarter of a child)
        lo, hi = self.top + int(0.07 * tall), self.top + int(0.32 * tall)
        widths = fig[lo:hi].sum(axis=1)
        self.neck = lo + int(np.argmin(np.where(widths > 0, widths, 1 << 20)))
        self.knees = self.top + int(0.68 * tall)
        cols = np.nonzero(fig[self.top : self.neck].any(axis=0))[0]
        self.cx = int((cols.min() + cols.max()) // 2) if len(cols) else W // 2
        hh = self.neck - self.top
        # the bust: a square from a little over the head to the chest, the head about two fifths of it (a child's
        # head is bigger for its height: never more than half the figure)
        side = min(int(hh * 2.7), tall // 2, W)
        y0 = max(0, self.top - int(hh * 0.3))
        x0 = int(np.clip(self.cx - side // 2, 0, W - side))
        self.bust = {"x": x0, "y": y0, "w": side, "h": side}

    def rows(self, a: int, b: int) -> np.ndarray:
        """A mask of the rows from a to b (exclusive)."""
        m = np.zeros((H, W), bool)
        m[max(a, 0) : max(b, 0)] = True
        return m


class Builder:
    def __init__(self, work: str, out: str):
        self.work = work
        self.out = out
        self.bases: dict[str, np.ndarray] = {}
        self.figs: dict[str, np.ndarray] = {}
        self.frames: dict[str, Frame] = {}
        self.manifest: dict = {"w": W, "h": H, "bodies": {}, "parts": {}}
        woman = load(os.path.join(work, "lib", "base-woman.png"))
        self.bg = background(woman)
        f = figure(woman, self.bg)
        self.skin_ref = self._skin_ref(woman, f)
        lum = luminance(woman)
        self.skin = Normaliser(lum[f & skin_mask(woman, self.skin_ref)])

    @staticmethod
    def _skin_ref(img: np.ndarray, fig: np.ndarray) -> np.ndarray:
        """The base's skin: the most common warm, light colour of the figure."""
        h, s, v = hsv(img)
        cand = fig & (v > 0.7) & (s > 0.06) & (s < 0.45) & ((h < 50) | (h > 340))
        return np.median(img[cand], axis=0)

    def base(self, body: str) -> np.ndarray | None:
        if body not in self.bases:
            p = os.path.join(self.work, "lib", f"base-{body}.png")
            if not os.path.exists(p):
                return None
            img = load(p)
            soles = feet_row(img, self.bg)
            fig = figure(img, self.bg) & (np.arange(H)[:, None] <= soles + 2)
            self.bases[body] = img
            self.figs[body] = fig
            self.frames[body] = Frame(fig, soles)
        return self.bases[body]

    def part_image(self, name: str) -> np.ndarray | None:
        p = os.path.join(self.work, "parts", name + ".png")
        return load(p) if os.path.exists(p) else None

    # -------------------------------------------------------------- the bodies

    def body(self, body: str) -> None:
        img = self.base(body)
        if img is None:
            return
        fig = self.figs[body]
        rgb, alpha = matte(img, self.bg, fig, fig)
        # the plain grey underclothes, with the hatching in their folds: never skin, though the ink's warm grey is
        # in the skin's hue band
        _, sat, val = hsv(rgb)
        cloth = ndi.binary_fill_holes(ndi.binary_closing(fig & (sat < 0.07) & (val > 0.55), iterations=6)) & fig
        cloth = ndi.binary_opening(cloth, iterations=3)
        sk = skin_mask(rgb, self.skin_ref) & fig & ~cloth
        lines = fig & (luminance(rgb) < 90)
        zones = np.where(sk & ~lines, 1, 0) * (alpha > 0)
        # the lines are the style's ink: kept, never repainted with the skin
        rgb = inked(rgb, lines)
        value = np.where(zones == 1, self.skin(ndi.gaussian_filter(luminance(rgb), 0.8)), 0)
        e = save(self.out, f"body/{body}", rgb, alpha, zones, value)
        if e:
            self.manifest["bodies"][body] = {"layers": [{**e, "z": "body", "zones": ["skin"]}], "bust": self.frames[body].bust}

    # -------------------------------------------------------------- the parts

    def zones_of(self, rgb: np.ndarray, region: np.ndarray, keys: list[str], iris: np.ndarray | None = None, hair_where: np.ndarray | None = None, paint: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
        """Zones (by the keys' meaning) and values of a region: key hues for a part's own colours, skin by its
        hue, hair and brows by their grey, eyes by where the irises are (`iris`: they are grey like the brows);
        `hair_where`: where a face's grey is its brows (above it, a raised brow's forehead lines are not)."""
        h, s, v = hsv(rgb)
        lum = ndi.gaussian_filter(luminance(rgb), 0.8)
        zones = np.zeros(rgb.shape[:2], np.int32)
        # the irises and the brows first: a grey brow in the ink's warm grey is in the skin's hue band
        order = sorted(enumerate(keys, start=1), key=lambda kk: {"eyes": 0, "hair": 1}.get(kk[1], 2))
        for k, key in order:
            if key == ".1":
                m = (s > 0.35) & ((h < 22) | (h > 330)) & (v > 0.2)
            elif key == ".2":
                m = (s > 0.3) & (h > 80) & (h < 170) & (v > 0.2)
            elif key == ".3":
                m = (s > 0.3) & (h > 190) & (h < 265) & (v > 0.2)
            elif key == "skin":
                m = skin_mask(rgb, self.skin_ref)
            elif key == "eyes":
                if iris is None:
                    continue
                m = iris
            elif key == "hair":
                # beside skin (a face's brows) only the darker greys: the skin's light is not hair
                m = (s < 0.22) & (v > 0.18) & (v < (0.72 if "skin" in keys else 0.9))
                if hair_where is not None:
                    m &= hair_where
            else:
                continue
            zones[m & region & (zones == 0)] = k
        if paint is not None:
            # what keeps its own paint, never repainted (a face's drawn strokes and its blush)
            zones[paint] = 0
        lines = region & (v < 0.3) & (zones == 0)
        # the lines stay ink (zone 0, their paint), so the figure keeps its drawn line whatever its colours
        zones = zones * region
        value = np.zeros(lum.shape, np.float32)
        for k, key in enumerate(keys, start=1):
            m = zones == k
            if not m.any():
                continue
            norm = self.skin if key == "skin" else Normaliser(lum[m & ~lines])
            value[m] = norm(lum[m])
        return zones, value

    def emit(self, pid: str, body: str, mood: str | None, z: str, keys: list[str], rgb, alpha, region, iris: np.ndarray | None = None, hair_where: np.ndarray | None = None, strokes: np.ndarray | None = None, blush: np.ndarray | None = None, pre: tuple[np.ndarray, np.ndarray] | None = None) -> dict | None:
        if pre is not None:
            # zones and values worked out over a larger whole (a hairstyle's front and back, one normalisation)
            zones, value = pre[0] * (region & (alpha > 0.01)), pre[1]
            _, _, v = hsv(rgb)
            rgb = inked(rgb, region & (zones == 0) & (v < 0.38))
        elif keys == ["skin"]:
            # a mark or the lines of age is skin, whatever colour the model drew it in: a scar a darker skin, not red paint
            reg = region & (alpha > 0.01)
            zones = reg.astype(np.int32)
            # a little darker than the skin round it, never its darkest line
            value = np.where(reg, 150 + (self.skin(ndi.gaussian_filter(luminance(rgb), 0.8)) - 150) * 0.45, 0)
        else:
            keep = None
            if strokes is not None or blush is not None:
                keep = np.zeros(region.shape, bool)
                for k_ in (strokes, blush):
                    if k_ is not None:
                        keep |= k_
                keep &= ~(iris if iris is not None else np.zeros_like(keep))
            zones, value = self.zones_of(rgb, region & (alpha > 0.01), keys, iris, hair_where, keep)
            if "eyes" in keys:
                # a face's skin is flat, as the style's fills are: its drawn shades (the tan above a boy's eyes) kept at
                # half their depth, so they never read as patches of another colour
                value = np.where(zones == 1, 180 + (value - 180) * 0.5, value)
                # and its irises keep their pupil and ring (the normalisation left them a flat disc)
                value = deepen(value, zones == keys.index("eyes") + 1)
            _, _, v = hsv(rgb)
            # the lines and a face's drawn strokes are the style's ink (the blush keeps its own pink)
            rgb = inked(rgb, region & (zones == 0) & ((v < 0.38) | (strokes if strokes is not None else False)))
        tag = f".{mood}" if mood else ""
        e = save(self.out, f"{pid}/{body}.{z}{tag}", rgb, alpha, zones, value)
        return {**e, "z": z, "zones": keys} if e else None

    def put(self, pid: str, body: str, mood: str | None, layers: list[dict]) -> None:
        if not layers:
            return
        entry = self.manifest["parts"].setdefault(pid, {}).setdefault(body, {"layers": []})
        if pid in COVERING:
            entry["covers"] = True
        if pid in LONG:
            entry["above"] = ["shoes"]
        if mood:
            entry.setdefault("moods", {})[mood] = layers
        else:
            entry["layers"] = layers

    def diff_part(self, pid: str, body: str, slot: str, img: np.ndarray, mood: str | None = None) -> None:
        base, fig, fr = self.bases[body], self.figs[body], self.frames[body]
        ch = changed(base, img)
        reg = ndi.binary_dilation(ch, iterations=2) & (np.abs(img - base).max(axis=2) > 8)
        # nothing below the soles is anyone's: the ground (a shadow the model drew) is left out
        reg &= fr.rows(0, fr.soles + (8 if slot == "shoes" else 3))
        layers: list[dict] = []
        if slot in ("hair", "beard"):
            # only what is hair: an edit that touched the face as well does not bring the face along (the skin
            # judged strictly: warm grey hair, sometimes drawn brownish, is close to it in hue, never in lightness)
            reg &= ~skin_mask(img, self.skin_ref, lo=0.85, vmin=0.78)
        if slot == "beard":
            # nor the teeth of a mouth the edit opened under the moustache: a beard is grey, never white
            _, bs, bv = hsv(img)
            reg &= ~((bv > 0.86) & (bs < 0.12))
        if slot == "hair":
            # never the face's own features: the eyes (an edit that put on hair redraws them a little, and over another
            # face they would show as a second pair) and the brows where the edit left them as they were
            found = measure(base)
            if found is not None:
                yy, xx = np.mgrid[0:H, 0:W]
                # each eye about its iris (w its diameter): the white and the lashes either side, the lids
                for x, y, w, h in found.boxes:
                    reg &= ((xx - x - w / 2) / (w * 1.25)) ** 2 + ((yy - y - h / 2) / (h * 0.8)) ** 2 > 1
                brows = fr.rows(fr.top + int(0.3 * (fr.neck - fr.top)), int(min(b[1] for b in found.boxes)))
                reg &= ~(brows & (np.abs(img - base).max(axis=2) < 28))
            # on the face's bare skin (between the ears, from the brows to the chin), hair is only what is clearly darker
            # than the skin it lies on: a strand of the fringe is, the cheeks' shading the edit redrew is not (taken as
            # hair, it laid a pale wash of the hair's colour over the face). Over the ears and the scalp it is whole.
            on_skin = fig & skin_mask(base, self.skin_ref) & fr.rows(0, fr.neck)
            if found is not None:
                fr_r = found.w * found.hw / 2
                fr_cy = found.top + found.y * found.hw
                fr_mid = sum(b[0] + b[2] / 2 for b in found.boxes) / 2
                on_skin &= fr.rows(int(fr_cy - 5 * fr_r), H) & (np.abs(np.arange(W)[None, :] - fr_mid) <= 0.36 * found.hw)
            dark = reg & on_skin & (luminance(base) - luminance(img) >= 35)
            # whole strands: a strand's light streaks are as light as skin and the rule would hole them, and every hole's
            # edge is feathered — the fringe's tips came out a dotted, half-clear band. Closed and filled, within what
            # the edit changed; then no specks
            whole = ndi.binary_fill_holes(ndi.binary_closing(dark, iterations=2)) & reg
            whole = ndi.binary_opening(whole, iterations=1)
            lab, _ = ndi.label(whole)
            sizes = ndi.sum(whole, lab, range(1, lab.max() + 1)) if lab.max() else []
            whole &= ~np.isin(lab, [i + 1 for i, n_ in enumerate(sizes) if n_ < 60])
            reg = (reg & ~on_skin) | whole
            rgb, alpha = matte(img, self.bg, reg, fig)
            front = alpha * fig
            back = alpha * ~fig
            # one normalisation over the whole hairstyle, then split: each layer normalised alone gave the same hair two
            # tones either side of the bald figure's outline (an ear-shaped patch where the hair covers the ears)
            whole_zv = self.zones_of(rgb, alpha > 0.01, ["hair"])
            for z, a in (("hair", front), ("hairBack", back)):
                e = self.emit(pid, body, mood, z, ["hair"], rgb, a, a > 0.01, pre=whole_zv)
                if e:
                    layers.append(e)
        elif slot in ("outfit", "armour", "cloak", "legs", "shoes"):
            if slot == "legs":
                reg &= fr.rows(fr.neck + (fr.soles - fr.neck) // 3, H)
            elif slot == "shoes":
                reg &= fr.rows(fr.knees - (fr.soles - fr.knees) // 3, H)
            else:
                reg &= fr.rows(fr.neck - (fr.neck - fr.top) // 4, H)
            keys = [".1", ".2", ".3", "skin"]
            if slot in ("legs", "shoes"):
                # stockings and shoes are cloth and leather only: the skin an edit redrew beside them (an ankle's
                # hatching) is the body's, and over the stockings it would show as skin
                reg &= ~skin_mask(img, self.skin_ref)
                keys = [".1", ".2", ".3"]
            else:
                # below the knees the legs are the body's, the stockings' and the shoes': a skirt's edit that redrew
                # the ankles' hatching does not bring skin over them
                reg &= ~(skin_mask(img, self.skin_ref) & fr.rows(fr.knees, H))
            rgb, alpha = matte(img, self.bg, reg, fig)
            e = self.emit(pid, body, mood, slot, keys, rgb, alpha, alpha > 0.01)
            if e:
                layers.append(e)
        else:
            z, keys = {"hat": ("hat", [".1", ".2"]), "beard": ("beard", ["hair"]), "age": ("age", ["skin"]), "mark": ("mark", ["skin"]), "glasses": ("glasses", [".1"])}[slot]
            hh = fr.neck - fr.top
            # on the head only (a hat's brim reaches out and a little down; a beard to the chest)
            reg &= fr.rows(0, fr.neck + (hh // 2 if slot in ("hat", "beard") else 0))
            if slot == "hat":
                reg &= ~skin_mask(img, self.skin_ref)
            if slot in ("age", "mark"):
                # away from the eyes, the brows and the mouth, which are the face part's (an edit that added freckles
                # may have recoloured the eyes too)
                head = fig & fr.rows(0, fr.neck)
                reg &= ~ndi.binary_dilation(ndi.binary_erosion(head, iterations=6) & ~skin_mask(base, self.skin_ref), iterations=7)
            if slot == "age":
                # age's lines are thin dark strokes the edit added (a black top-hat finds strokes, not the whole
                # face the edit redrew)
                lum = luminance(img)
                reg &= (ndi.grey_closing(lum, size=7) - lum > 16) & (lum < luminance(base) - 10)
            rgb, alpha = matte(img, self.bg, reg, fig)
            if slot in ("age", "mark"):
                # laid lightly: a line of age, an old scar, not paint
                alpha = ndi.gaussian_filter(alpha, 0.7) * (0.6 if slot == "age" else 0.7)
            e = self.emit(pid, body, mood, z, keys, rgb, alpha, alpha > 0.01)
            if e:
                layers.append(e)
        self.put(pid, body, mood, layers)

    def match_skin(self, im: np.ndarray, base: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """A picture's skin brought to the base's under a part's mask: per channel, the ratio of their skins' medians
        in the mask's rim (where the part meets the body)."""
        rim = mask & ~ndi.binary_erosion(mask, iterations=10)
        a = rim & skin_mask(im, self.skin_ref) & skin_mask(base, self.skin_ref)
        if a.sum() < 50:
            return im
        ratio = np.median(base[a], axis=0) / np.maximum(np.median(im[a], axis=0), 1.0)
        return np.clip(im * ratio, 0, 255)

    def face_part(self, pid: str, body: str) -> None:
        """A face: what replaces the base's eyes, brows, nose and mouth, in every mood (the neutral and each)."""
        base = self.base(body)
        neutral = self.part_image(f"{pid}@{body}")
        if base is None or neutral is None:
            return
        fig, fr = self.figs[body], self.frames[body]
        images = {None: neutral, **{m: self.part_image(f"{pid}@{body}~{m}") for m in MOODS}}
        # the eyes sought near the body's size reference's (faces.py drew every face from it): a heavy brow is never
        # taken for an eye, nor coloured as one
        ref_path = os.path.join(self.work, "lib", f"base-{body}-face.png")
        ref = measure(load(ref_path)) if os.path.exists(ref_path) else measure(base)
        if ref is None:
            return
        # the layer is the whole face, one outline for every face and mood of the body (2026-10-25: the layer was what
        # each picture changed, a ragged shape with holes, and its edges showed as a box, specks and seams under hair):
        # inside the head's outline (the body keeps its line), from above the highest a brow is raised to the chin,
        # short of the ears; its top edge fades into the forehead
        head = fig & fr.rows(0, fr.neck)
        inner = ndi.binary_erosion(head, iterations=3)
        r = ref.w * ref.hw / 2
        cy = ref.top + ref.y * ref.hw
        mid = sum(b[0] + b[2] / 2 for b in ref.boxes) / 2
        yy, xx = np.mgrid[0:H, 0:W]
        top = cy - 6.5 * r
        mask = inner & (yy >= top) & (np.abs(xx - mid) <= 0.42 * ref.hw)
        soft = np.clip(ndi.gaussian_filter(mask.astype(np.float32), 1.0) * 1.3, 0, 1)
        soft *= np.clip((yy - top) / (2.0 * r), 0, 1)
        for mood, im in images.items():
            if im is None:
                continue
            found = measure(im, near=ref)
            if found is None:
                print(f"  {pid}@{body} {mood or 'neutral'}: no eyes found, left out", flush=True)
                continue
            # the brows: on each side the largest grey stroke above the eye (wherever the mood put it: an angry brow
            # comes down onto the lid), not the lids' shading, never the iris
            r = found.w * found.hw / 2
            cy = found.top + found.y * found.hw
            _, bs, bv = hsv(im)
            # (a brow's grey is dark; the light grey shade some faces have under the brows is skin's, below)
            grey = (bs < 0.22) & (bv > 0.18) & (bv < 0.62) & fr.rows(int(cy - 5 * r), int(cy - 0.5 * r)) & mask
            yy_, xx_ = np.mgrid[0:H, 0:W]
            core = np.zeros((H, W), bool)
            for bx, by, bw, bh in found.boxes:
                core |= (xx_ - bx - bw / 2) ** 2 + (yy_ - by - bh / 2) ** 2 <= (0.75 * bw / 2) ** 2
            grey &= ~ndi.binary_dilation(core, iterations=2)
            lab, _ = ndi.label(grey)
            mid = sum(b[0] + b[2] / 2 for b in found.boxes) / 2
            ids = []
            for side in (lambda c: c < mid, lambda c: c >= mid):
                cand = [(int((lab[sl] == i).sum()), i) for i, sl in enumerate(ndi.find_objects(lab), start=1) if sl is not None and side((sl[1].start + sl[1].stop) / 2) and (sl[1].stop - sl[1].start) > 1.5 * r]
                if cand:
                    ids.append(max(cand)[1])
            brows = ndi.binary_dilation(np.isin(lab, ids), iterations=1)
            # the face's skin made the body's: a face drawn from its size reference (two edits from the base) drifts
            # lighter or darker, and its layer showed as a box round the eyes
            im = self.match_skin(im, base, mask)
            # the face's grey shades and white highlights (a light shade under the brows, a highlight on the nose) are made
            # the plain skin, so they take the look's skin: left as drawn they showed as a white dot, and kept at their
            # own lightness the shade turned an orange-brown patch. Not the eyes (their whites), not the brows, not lines
            eyes_area = np.zeros((H, W), bool)
            for bx, by, bw, bh in found.boxes:
                ecx, ecy, er = bx + bw / 2, by + bh / 2, bw / 2
                eyes_area |= ((xx_ - ecx) / (2.7 * er)) ** 2 + ((yy_ - ecy) / (1.9 * er)) ** 2 <= 1
            hs, ss, vs = hsv(im)
            skin_px = mask & skin_mask(im, self.skin_ref)
            if skin_px.sum() > 100:
                tone = np.median(im[skin_px], axis=0)
                # what is light and not skin (a grey shade, a cream highlight between the skin's saturation and none);
                # pure white is the teeth's and the eyes' own and stays
                pale = mask & ~eyes_area & ~ndi.binary_dilation(brows, iterations=2) & ~skin_mask(im, self.skin_ref) & (vs > 0.5) & (ss < 0.3) & (ss >= 0.06)
                im = im.copy()
                im[pale] = tone
            # strokes the face drew on its skin (a nose's shadow, lines under the eyes, the blush's hatching): darker than
            # the skin round them, not grey brows; repainted as skin they turned a dark red-brown
            lum = luminance(im)
            local = ndi.median_filter(lum, size=15)
            _, sat, val = hsv(im)
            strokes = (lum < local - 28) & mask & ~(brows & (sat < 0.22))
            h_, _, _ = hsv(im)
            blush = mask & (sat > 0.28) & ((h_ < 20) | (h_ > 330)) & (val > 0.6)
            # round: the lower lid's grey joined to an iris ran from it as a tail (a tear of the eye colour)
            iris = round_iris(iris_mask(im, found) & ~ndi.binary_dilation(brows, iterations=2))
            e = self.emit(pid, body, mood, "face", ["skin", "eyes", "hair"], im, soft, soft > 0.01, iris, brows, strokes, blush)
            if e:
                self.put(pid, body, mood, [e])

    def run(self, only: list[str] | None = None) -> dict:
        for body in BODIES:
            self.body(body)
        names = sorted(f[:-4] for f in os.listdir(os.path.join(self.work, "parts")) if f.endswith(".png"))
        for name in names:
            if "~" in name or "@" not in name:
                continue
            if only and not any(name.startswith(o) for o in only):
                continue
            pid, _, body = name.partition("@")
            slot = pid.split(".")[0]
            if self.base(body) is None:
                continue
            if slot == "face":
                self.face_part(pid, body)
            else:
                img = self.part_image(name)
                if img is None:
                    continue
                self.diff_part(pid, body, slot, img)
            print("cut", name, flush=True)
        with open(os.path.join(self.out, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(self.manifest, f, indent=1)
        return self.manifest


if __name__ == "__main__":
    # `--only face. hair.`: those parts cut again into the cut there already (the rest of its manifest kept)
    args = sys.argv[3:]
    only = args[args.index("--only") + 1 :] if "--only" in args else None
    b = Builder(sys.argv[1], sys.argv[2])
    if only and os.path.exists(os.path.join(sys.argv[2], "manifest.json")):
        old = json.load(open(os.path.join(sys.argv[2], "manifest.json"), encoding="utf-8"))
        b.manifest["parts"] = {k: v for k, v in old["parts"].items() if not any(k.startswith(o) for o in only)}
    m = b.run(only)
    print(len(m["parts"]), "parts,", len(m["bodies"]), "bodies")
    # what the edits redrew of the body, and the ground, is no part's (clean.py)
    from clean import clean  # noqa: E402

    gone = clean(sys.argv[2])
    print(sum(gone.values()), "stray pixels cleared")
    # a coat's hem over the riding boots, its trousers under them (hems.py); the irises round, with their depth (eyes.py)
    from hems import hems  # noqa: E402

    print(len(hems(sys.argv[2])), "hems cut")
    from eyes import deepen_cut  # noqa: E402

    print(deepen_cut(sys.argv[2]), "face layers' irises made round and deepened")
