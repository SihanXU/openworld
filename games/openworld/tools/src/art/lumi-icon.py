"""Lumi in pixels (2026-10-27): the corner badge that opens her panel, and the game's own icon — her own portrait
(docs/cast/lumi.md, the bust portrait.py ships), brought down to pixel art in a gilt ring on her night: a close head and
shoulders, the yellow five-petal flower in her hair. Not redrawn: her face is the portrait's, so it is the same beauty
the dialogue and her panel show. Brought down in 5x5 blocks (each the block's mean, but her eyes' line art kept where a
block holds a lash), its colours to an adaptive palette of 48 with no dither, the flower held to its own three yellows,
a short line for her mouth, a glint in each eye; her wing behind her taken out. Two faces: calm, and for the button
under the pointer the same face with a faint smile (the line's ends lifted a pixel; no blush).

    python games/openworld/tools/src/art/lumi-icon.py [preview-dir]

Writes public/assets/lsw/Ui/LumiBadge.png, LumiBadgeHappy.png (60x60, shown at whole multiples, pixelated) and the
game's icons in public/icons/: favicon.png (60), icon-192.png and icon-512.png (on her night ground, for a home screen).
"""

from __future__ import annotations

import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.normpath(os.path.join(HERE, "..", "..", "..", "public"))
UI = os.path.join(PUBLIC, "assets", "lsw", "Ui")
ICONS = os.path.join(PUBLIC, "icons")

N = 60
CX, CY = 29.5, 32.0  # the ring's centre (between pixels: the badge is symmetric left to right)

PAL = {
    ".": (0, 0, 0, 0),
    # ink: hers (fairy.ts k) and the ring's walnut
    "k": (62, 42, 78, 255),
    "n": (74, 40, 18, 255),
    # the gilt ring: light, gold, shade
    "Y": (255, 241, 160, 255),
    "y": (246, 194, 50, 255),
    "o": (201, 128, 31, 255),
    # the night inside: three tones, lightest at the top
    "1": (78, 68, 136, 255),
    "2": (54, 46, 102, 255),
    "3": (34, 29, 70, 255),
    "*": (255, 246, 214, 255),
    # hair: light, mid, shade, deep
    "L": (236, 232, 252, 255),
    "h": (212, 204, 244, 255),
    "H": (170, 160, 224, 255),
    "j": (134, 118, 198, 255),
    # skin, its shade, blush, mouth
    "s": (255, 233, 218, 255),
    "S": (242, 200, 184, 255),
    "b": (255, 168, 192, 255),
    "m": (208, 96, 128, 255),
    # eyes: ink, iris dark, iris, lower light, glint
    "K": (52, 34, 86, 255),
    "e": (96, 70, 184, 255),
    "v": (128, 104, 214, 255),
    "E": (176, 186, 248, 255),
    "i": (255, 255, 255, 255),
    # the flower: petal, its shade, heart, its ink
    "g": (255, 214, 102, 255),
    "G": (240, 170, 70, 255),
    "c": (226, 120, 56, 255),
    "f": (150, 84, 30, 255),
    # dress and ribbon
    "d": (246, 248, 255, 255),
    "D": (190, 204, 238, 255),
    "r": (86, 140, 226, 255),
    "R": (52, 96, 180, 255),
    # wings: glass, its blue, vein, edge
    "w": (226, 246, 255, 255),
    "p": (186, 224, 250, 255),
    "q": (150, 200, 244, 255),
    "W": (96, 160, 226, 255),
}

Y_, X_ = np.mgrid[0:N, 0:N].astype(np.float32)
PX, PY = X_ + 0.5, Y_ + 0.5  # pixel centres


def ellipse(cx: float, cy: float, rx: float, ry: float, angle: float = 0.0) -> np.ndarray:
    a = math.radians(angle)
    dx, dy = PX - cx, PY - cy
    u = dx * math.cos(a) + dy * math.sin(a)
    v = -dx * math.sin(a) + dy * math.cos(a)
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1.0


def ring(r: float) -> np.ndarray:
    return (PX - CX) ** 2 + (PY - CY) ** 2 <= r * r


def dilate(m: np.ndarray, diag: bool = False) -> np.ndarray:
    out = m.copy()
    out[1:, :] |= m[:-1, :]
    out[:-1, :] |= m[1:, :]
    out[:, 1:] |= m[:, :-1]
    out[:, :-1] |= m[:, 1:]
    if diag:
        out[1:, 1:] |= m[:-1, :-1]
        out[1:, :-1] |= m[:-1, 1:]
        out[:-1, 1:] |= m[1:, :-1]
        out[:-1, :-1] |= m[1:, 1:]
    return out


class Canvas:
    def __init__(self) -> None:
        self.g = np.full((N, N), ".", dtype="<U1")

    def fill(self, mask: np.ndarray, c: str, where: np.ndarray | None = None) -> None:
        m = mask if where is None else mask & where
        self.g[m] = c

    def put(self, x: int, y: int, c: str) -> None:
        if 0 <= x < N and 0 <= y < N:
            self.g[y, x] = c

    def grid(self, x0: int, y0: int, rows: list[str]) -> None:
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c != " ":
                    self.put(x0 + i, y0 + j, c)

    def solid(self) -> np.ndarray:
        return self.g != "."

    def png(self) -> Image.Image:
        rgba = np.zeros((N, N, 4), np.uint8)
        for k, v in PAL.items():
            rgba[self.g == k] = v
        return Image.fromarray(rgba, "RGBA")


# ---------------------------------------------------------------- the ring and the night in it

R_OUT, R_GOLD, R_IN = 27.6, 26.6, 24.0


def badge(cv: Canvas) -> None:
    cv.fill(ring(R_OUT), "n")
    gold = ring(R_GOLD) & ~ring(R_IN + 0.9)
    ang = np.degrees(np.arctan2(PY - CY, PX - CX))  # 0 east, -90 north
    lit = (ang > -170) & (ang < -60)
    shade = (ang > 20) & (ang < 140)
    cv.fill(gold, "y")
    cv.fill(gold & lit, "Y")
    cv.fill(gold & shade, "o")
    cv.fill(ring(R_IN + 0.9) & ~ring(R_IN), "n")
    inside = ring(R_IN)
    # the night: lighter at the top, a checker between the tones (the pack's dither)
    t = (PY - (CY - R_IN)) / (2 * R_IN)
    checker = ((X_ + Y_) % 2) == 0
    tone = np.where(t < 0.30, "1", np.where(t < 0.40, np.where(checker, "1", "2"), np.where(t < 0.62, "2", np.where(t < 0.72, np.where(checker, "2", "3"), "3"))))
    cv.g[inside] = tone[inside]
    for x, y in ((14, 24), (45, 20), (47, 38), (12, 40), (40, 52)):
        if inside[y, x]:
            cv.put(x, y, "*")


# ---------------------------------------------------------------- her: her own portrait, in pixels

PORTRAITS = os.path.join(PUBLIC, "assets", "lsw", "Portraits", "lumi")
# the square of her bust (400x400, portrait.py's) the ring shows: her face a little above its middle, the flower at its top left
CROP = (86, 0, 334, 248)
# her eyes on the bust (cx, cy, rx, ry): drawn a little firmer before the picture is brought down, so they read at its size
EYES = ((182, 135, 20, 13), (243, 135, 20, 13))
# where her wing shows behind her on the bust (taken out: nothing round her but the ring)
WING = (262, 100, 340, 250)
COLOURS = 48
# her mouth on the bust (its middle)
MOUTH = (213, 175)
# her face's line art on the bust (x0, y0, x1, y1): eyes, lashes, brows and mouth, kept drawn as it comes down
FACE_LINES = ((160, 118, 204, 150), (221, 118, 265, 150))
# the flower on the bust (cx, cy, r): only there is yellow the flower's
FLOWER_AT = (130, 90, 34)


def portrait(mood: str, smile: bool = False) -> Image.Image:
    """Her bust brought down to the ring's inside, its own colours kept (an adaptive palette), no dither: pixels; `smile`: the
    mouth's ends lifted a pixel."""
    from PIL import ImageDraw, ImageEnhance, ImageFilter
    im = Image.open(os.path.join(PORTRAITS, f"{mood}.webp")).convert("RGBA")
    a = np.array(im).astype(np.float32)
    # her wing out: in its region, what is wing-coloured (green at least red's; her hair has red above green)
    r, g = a[..., 0], a[..., 1]
    wing = np.clip((g - r + 3) / 5, 0, 1)
    zone = np.zeros(wing.shape, np.float32)
    zone[WING[1]:WING[3], WING[0]:WING[2]] = 1
    a[..., 3] *= 1 - wing * zone
    im = Image.fromarray(a.astype(np.uint8), "RGBA")
    # the eyes firmer: their lashes darker, their colour fuller
    eyes = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(eyes)
    for cx, cy, rx, ry in EYES:
        d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    eyes = eyes.filter(ImageFilter.GaussianBlur(4))
    firm = ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(1.7)).enhance(1.06)
    im = Image.composite(firm, im, eyes)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im = ImageEnhance.Color(im).enhance(1.12)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=110, threshold=2))
    crop = im.crop(CROP)
    size = round(2 * R_IN + 2)
    # brought down in blocks of 5: each pixel the block's mean, but where her line art is (the eyes, lashes, brows and
    # mouth: the face's box), a block that holds a dark line takes that line's colour — so the lines stay drawn
    K = 5
    big = np.array(crop.resize((size * K, size * K), Image.LANCZOS)).astype(np.float32)
    blocks = big.reshape(size, K, size, K, 4).transpose(0, 2, 1, 3, 4).reshape(size, size, K * K, 4)
    mean = blocks.mean(axis=2)
    lum = blocks[..., 0] * 0.3 + blocks[..., 1] * 0.59 + blocks[..., 2] * 0.11
    darkest = np.take_along_axis(blocks, lum.argmin(axis=2)[..., None, None].repeat(4, -1), axis=2)[:, :, 0]
    k = size / (CROP[2] - CROP[0])
    yy, xx = np.mgrid[0:size, 0:size]
    face = np.zeros((size, size), bool)
    for box in FACE_LINES:
        fx0, fy0, fx1, fy1 = ((v - CROP[i % 2]) * k for i, v in enumerate(box))
        face |= (xx >= fx0) & (xx < fx1) & (yy >= fy0) & (yy < fy1)
    # a line: the block's darkest is truly dark (a lash, the iris's rim), and well below the block's mean
    mean_lum = mean[..., 0] * 0.3 + mean[..., 1] * 0.59 + mean[..., 2] * 0.11
    line = face & (lum.min(axis=2) < 95) & (mean_lum - lum.min(axis=2) > 60)
    out = np.where(line[..., None], darkest, mean)
    out[..., 3] = mean[..., 3]
    small = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    alpha = small.getchannel("A").point(lambda v: 255 if v > 120 else 0)
    flat = small.convert("RGB").quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    # the flower kept its own: what is yellow in the small picture takes the nearest of the flower's three tones (the
    # palette would merge so small a thing into her skin)
    sm = np.array(small).astype(np.int32)
    fl = np.array(flat)
    fx, fy, fr = FLOWER_AT
    k = small.width / (CROP[2] - CROP[0])
    yy, xx = np.mgrid[0:small.height, 0:small.width]
    near = (xx + 0.5 - (fx - CROP[0]) * k) ** 2 + (yy + 0.5 - (fy - CROP[1]) * k) ** 2 <= (fr * k) ** 2
    yellow = near & (sm[..., 0] - sm[..., 2] > 55) & (sm[..., 1] > 120) & (sm[..., 3] > 120)
    tones = np.array([PAL["g"][:3], PAL["G"][:3], PAL["c"][:3], PAL["f"][:3]], np.int32)
    d = ((sm[..., None, :3] - tones[None, None]) ** 2).sum(-1)
    fl[yellow, :3] = tones[d.argmin(-1)][yellow]
    # her mouth: a short soft line where it is (the bust's own is too fine to come down); smiling, its ends a pixel up
    mx, my = MOUTH
    y = int((my - CROP[1]) * k)
    x0 = int((mx - CROP[0]) * k)
    for x in (x0 - 1, x0):
        fl[y, x, :3] = (204, 120, 140)
    if smile:
        for x in (x0 - 2, x0 + 1):
            fl[y - 1, x, :3] = (214, 136, 152)
    # a glint in each eye, at the top of the iris toward the light (the bust's own are too small to come down)
    if "blink" not in mood:
        for cx, cy, _, _ in EYES:
            gx = int((cx - CROP[0]) * k) - 1
            gy = int((cy - CROP[1]) * k) - 1
            for x, y in ((gx, gy),):
                if 0 <= x < size and 0 <= y < size:
                    fl[y, x, :3] = (255, 255, 255)
    flat = Image.fromarray(fl, "RGBA")
    flat.putalpha(alpha)
    return flat


def her(mood: str, smile: bool = False) -> tuple[np.ndarray, np.ndarray]:
    """Her pixels on the badge's canvas (RGBA), and where she is."""
    p = portrait(mood, smile)
    layer = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ox = round(CX - p.width / 2)
    oy = round(CY - p.height / 2)
    layer.alpha_composite(p, (ox, oy))
    rgba = np.array(layer)
    return rgba, rgba[..., 3] > 0


def compose(happy: bool) -> Image.Image:
    cv = Canvas()
    badge(cv)
    base = cv.png()
    out = np.array(base)
    rgba, solid = her("neutral", smile=happy)
    inside = ring(R_IN)
    # her crown and the flower break out over the ring's top (her pixels there, above its middle, that are hair or petal)
    r, g, b = rgba[..., 0].astype(int), rgba[..., 1].astype(int), rgba[..., 2].astype(int)
    hair_or_petal = ((b > r) & (b - g > 18)) | ((r - b > 60) & (g > 120))
    crown = np.zeros_like(solid)
    show = solid & (inside | crown)
    out[show] = rgba[show]
    # ink round her where she breaks out (the pack's outline), and where her hair meets the night inside
    ink = np.array(PAL["k"], np.uint8)
    edge_out = dilate(crown) & ~show & ~inside
    out[edge_out & (out[..., 3] > 0)] = ink
    out[edge_out & (out[..., 3] == 0)] = ink
    edge_in = dilate(show) & ~show & inside
    out[edge_in] = ink
    return Image.fromarray(out, "RGBA")


def tile(img: Image.Image, size: int) -> Image.Image:
    """The icon for a home screen: on her night ground, the badge at a whole multiple, centred."""
    bg = Image.new("RGBA", (size, size), PAL["3"])
    # a soft lift of the night toward the middle
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
    t = np.clip(1 - d, 0, 1)[..., None]
    a = np.array(PAL["3"], np.float32)
    b = np.array(PAL["1"], np.float32)
    bg = Image.fromarray((a * (1 - t) + b * t).astype(np.uint8), "RGBA")
    k = max(1, size // (N + 4))
    big = img.resize((N * k, N * k), Image.NEAREST)
    bg.alpha_composite(big, ((size - N * k) // 2, (size - N * k) // 2))
    return bg


def main() -> None:
    os.makedirs(UI, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)
    calm = compose(False)
    happy = compose(True)
    calm.save(os.path.join(UI, "LumiBadge.png"), optimize=True)
    happy.save(os.path.join(UI, "LumiBadgeHappy.png"), optimize=True)
    calm.save(os.path.join(ICONS, "favicon.png"), optimize=True)
    tile(calm, 192).save(os.path.join(ICONS, "icon-192.png"), optimize=True)
    tile(calm, 512).save(os.path.join(ICONS, "icon-512.png"), optimize=True)
    if len(sys.argv) > 1:
        prev = sys.argv[1]
        os.makedirs(prev, exist_ok=True)
        sheet = Image.new("RGBA", (N * 8 * 2 + 30 + 200, N * 8 + 20), (52, 40, 30, 255))
        sheet.alpha_composite(calm.resize((N * 8, N * 8), Image.NEAREST), (10, 10))
        sheet.alpha_composite(happy.resize((N * 8, N * 8), Image.NEAREST), (N * 8 + 20, 10))
        sheet.alpha_composite(calm.resize((N * 2, N * 2), Image.NEAREST), (N * 16 + 40, 10))
        sheet.alpha_composite(calm, (N * 16 + 40, 120))
        sheet.save(os.path.join(prev, "lumi-icon-sheet.png"))
    print("Lumi in pixels →", UI, "and", ICONS)


if __name__ == "__main__":
    main()
