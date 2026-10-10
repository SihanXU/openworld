"""Cut the drawn parts into the game's portrait layers and write the manifest (docs/looks.md §4).

    python -I build.py <work dir> <out dir>     (out: games/openworld/public/assets/lsw/Looks/portrait)

Reads <work>/lib/base-<body>.png and <work>/parts/<part>[@<body>][~<mood>].png (parts.py), writes per layer a
paint and a value map (extract.py) at the game's size, and manifest.json (client/src/assets/figure/portrait.ts).
A part not drawn yet is left out of the manifest: the portrait shows the body without it.
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
from bases import neck_row  # noqa: E402
from extract import SIZE, background, changed, figure, load, luminance, matte  # noqa: E402

OUT_SIZE = SIZE
HEADS = {"man": "woman", "boy": "girl"}
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


def skin_mask(rgb: np.ndarray, skin_ref: np.ndarray) -> np.ndarray:
    """Pixels the colour of the base's skin (in its hue band, light enough), shaded or lit."""
    h, s, v = hsv(rgb)
    hr, sr, vr = hsv(skin_ref[None, None, :])
    dh = np.minimum(np.abs(h - hr[0, 0]), 360 - np.abs(h - hr[0, 0]))
    return (dh < 22) & (s > 0.04) & (s < 0.6) & (v > 0.45)


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
    paint = Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a8]), "RGBA").resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    va = Image.fromarray(np.dstack([np.clip(value, 0, 255).astype(np.uint8), a8]), "LA").resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    zi = Image.fromarray((zones * 40).astype(np.uint8), "L").resize((OUT_SIZE, OUT_SIZE), Image.NEAREST)
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


class Builder:
    def __init__(self, work: str, out: str):
        self.work = work
        self.out = out
        self.bases: dict[str, np.ndarray] = {}
        self.figs: dict[str, np.ndarray] = {}
        self.manifest: dict = {"size": OUT_SIZE, "bodies": {}, "parts": {}, "heads": HEADS}
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
            self.bases[body] = load(p)
            self.figs[body] = figure(self.bases[body], self.bg)
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
        sk = skin_mask(rgb, self.skin_ref) & fig
        lines = fig & (luminance(rgb) < 90)
        zones = np.where(sk, 1, 0)
        zones = nearest_fill(zones, lines) * (alpha > 0)
        # only lines that border the skin are skin's: the rest stay the paint's
        value = np.where(zones == 1, self.skin(ndi.gaussian_filter(luminance(rgb), 0.8)), 0)
        e = save(self.out, f"body/{body}", rgb, alpha, zones, value)
        if e:
            self.manifest["bodies"][body] = {"layers": [{**e, "z": "body", "zones": ["skin"]}]}

    # -------------------------------------------------------------- the parts

    def zones_of(self, rgb: np.ndarray, region: np.ndarray, keys: list[str]) -> tuple[np.ndarray, np.ndarray]:
        """Zones (by the keys' meaning) and values of a region: key hues for a part's own colours, skin by its
        hue, hair and brows by their grey, eyes by the iris; lines take their neighbour's zone."""
        h, s, v = hsv(rgb)
        lum = ndi.gaussian_filter(luminance(rgb), 0.8)
        zones = np.zeros(rgb.shape[:2], np.int32)
        for k, key in enumerate(keys, start=1):
            if key == ".1":
                m = (s > 0.35) & ((h < 22) | (h > 330)) & (v > 0.2)
            elif key == ".2":
                m = (s > 0.3) & (h > 80) & (h < 170) & (v > 0.2)
            elif key == ".3":
                m = (s > 0.3) & (h > 190) & (h < 265) & (v > 0.2)
            elif key == "skin":
                m = skin_mask(rgb, self.skin_ref)
            elif key == "eyes":
                # the irises (drawn blue on the base): not the mouth's red, not the blush
                m = (s > 0.25) & (v > 0.25) & (v < 0.97) & (h > 150) & (h < 300) & ~skin_mask(rgb, self.skin_ref)
            elif key == "hair":
                m = (s < 0.22) & (v > 0.18) & (v < 0.9)
            else:
                continue
            zones[m & region & (zones == 0)] = k
        lines = region & (v < 0.3) & (zones == 0)
        zones = nearest_fill(zones, lines) * region
        value = np.zeros(lum.shape, np.float32)
        for k, key in enumerate(keys, start=1):
            m = zones == k
            if not m.any():
                continue
            norm = self.skin if key == "skin" else Normaliser(lum[m & ~lines])
            value[m] = norm(lum[m])
        return zones, value

    def emit(self, pid: str, body: str, mood: str | None, z: str, keys: list[str], rgb, alpha, region) -> dict | None:
        if keys == ["skin"]:
            # a mark or the lines of age is skin, whatever colour the model drew it in: a scar a darker skin, not red paint
            reg = region & (alpha > 0.01)
            zones = reg.astype(np.int32)
            # a little darker than the skin round it, never its darkest line
            value = np.where(reg, 150 + (self.skin(ndi.gaussian_filter(luminance(rgb), 0.8)) - 150) * 0.45, 0)
        else:
            zones, value = self.zones_of(rgb, region & (alpha > 0.01), keys)
        tag = f".{mood}" if mood else ""
        e = save(self.out, f"{pid}/{body}.{z}{tag}", rgb, alpha, zones, value)
        return {**e, "z": z, "zones": keys} if e else None

    def put(self, pid: str, body: str, mood: str | None, layers: list[dict]) -> None:
        if not layers:
            return
        entry = self.manifest["parts"].setdefault(pid, {}).setdefault(body, {"layers": []})
        if pid in COVERING:
            entry["covers"] = True
        if mood:
            entry.setdefault("moods", {})[mood] = layers
        else:
            entry["layers"] = layers

    def diff_part(self, pid: str, body: str, slot: str, img: np.ndarray, base: np.ndarray, fig: np.ndarray, mood: str | None = None) -> None:
        ch = changed(base, img)
        reg = ndi.binary_dilation(ch, iterations=2) & (np.abs(img - base).max(axis=2) > 8)
        neck = neck_row(fig)
        layers: list[dict] = []
        if slot in ("hair", "beard"):
            # only what is hair: an edit that touched the face as well does not bring the face along
            reg &= ~skin_mask(img, self.skin_ref)
        if slot == "hair":
            rgb, alpha = matte(img, self.bg, reg, fig)
            front = alpha * fig
            back = alpha * ~fig
            for z, a in (("hair", front), ("hairBack", back)):
                e = self.emit(pid, body, mood, z, ["hair"], rgb, a, a > 0.01)
                if e:
                    layers.append(e)
        elif slot in ("outfit", "armour", "cloak"):
            reg &= np.arange(SIZE)[:, None] > neck - 40
            rgb, alpha = matte(img, self.bg, reg, fig)
            e = self.emit(pid, body, mood, slot, [".1", ".2", ".3", "skin"], rgb, alpha, alpha > 0.01)
            if e:
                layers.append(e)
        else:
            z, keys = {"hat": ("hat", [".1", ".2"]), "beard": ("beard", ["hair"]), "age": ("age", ["skin"]), "mark": ("mark", ["skin"]), "glasses": ("glasses", [".1"])}[slot]
            if slot in ("age", "mark"):
                # on the head only; age's lines are what the edit darkened (the face's own shape stays the base's)
                reg &= np.arange(SIZE)[:, None] < neck
            if slot == "age":
                reg &= luminance(img) < luminance(base) - 14
            rgb, alpha = matte(img, self.bg, reg, fig)
            if slot in ("age", "mark"):
                # laid lightly: a line of age, an old scar, not paint
                alpha = ndi.gaussian_filter(alpha, 0.7) * (0.6 if slot == "age" else 0.7)
            e = self.emit(pid, body, mood, z, keys, rgb, alpha, alpha > 0.01)
            if e:
                layers.append(e)
        self.put(pid, body, mood, layers)

    def face_part(self, pid: str, body: str) -> None:
        """A face: what replaces the base's eyes, brows, nose and mouth, in every mood (the neutral and each)."""
        base = self.base(body)
        neutral = self.part_image(pid)
        if base is None or neutral is None:
            return
        fig = self.figs[body]
        neck = neck_row(fig)
        head = fig & (np.arange(SIZE)[:, None] < neck)
        inner = ndi.binary_erosion(head, iterations=18)
        # the base's own features: what in the head is not plain skin
        feats = inner & ~skin_mask(base, self.skin_ref)
        images = {None: neutral, **{m: self.part_image(f"{pid}~{m}") for m in MOODS}}
        union = feats.copy()
        for im in images.values():
            if im is not None:
                union |= changed(base, im) & inner
        mask = ndi.binary_dilation(ndi.binary_closing(union, iterations=5), iterations=8) & inner
        soft = np.clip(ndi.gaussian_filter(mask.astype(np.float32), 3.0) * 1.6, 0, 1)
        for mood, im in images.items():
            if im is None:
                continue
            e = self.emit(pid, body, mood, "face", ["skin", "eyes", "hair"], im, soft, soft > 0.01)
            if e:
                self.put(pid, body, mood, [e])

    def run(self) -> dict:
        for body in ("woman", "man", "girl", "boy"):
            self.body(body)
        names = sorted(f[:-4] for f in os.listdir(os.path.join(self.work, "parts")) if f.endswith(".png"))
        for name in names:
            if "~" in name:
                continue
            pid, _, body = name.partition("@")
            slot = pid.split(".")[0]
            if slot == "face":
                self.face_part(pid, "girl" if pid == "face.child" else "woman")
                continue
            body = body or ("girl" if pid in ("hair.pigtails", "hair.tuft", "hair.childbob") else "man" if slot == "beard" else "woman")
            base = self.base(body)
            img = self.part_image(name)
            if base is None or img is None:
                continue
            self.diff_part(pid, body, slot, img, base, self.figs[body])
            print("cut", name, flush=True)
        with open(os.path.join(self.out, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(self.manifest, f, indent=1)
        return self.manifest


if __name__ == "__main__":
    m = Builder(sys.argv[1], sys.argv[2]).run()
    print(len(m["parts"]), "parts,", len(m["bodies"]), "bodies")
