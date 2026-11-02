"""The ending's two pictures (docs/finale.md §1, §8; docs/lore.md §17), painted over the game's own map renders.

- ending_dawn.png: Firstlight Village (map `meadow`, where the game begins) at the first true dawn after a year of
  lengthening nights: cool violet shade, gold light raking in from the east, a glow rising over the hills at the top
  right, a morning haze; the windows warm; at one window a child, and on its sill a small spark of light (Lumi).
- ending_holiest.png: the Holiest under the Holy City after the end: near black, a cold violet tint, a faint light on the
  bier; in front of it the new bearer sitting on the floor, hooded, the lance standing out of their chest, the crown
  faint on the head; behind the bier the dark moving, smoky shapes with a faint violet rim.

Both 1280x720; what matters keeps to the upper 70% (the dialogue box covers the rest while the scene plays). The maps are
rendered as the game draws them (the wiki's renderer), then cropped, scaled up by whole pixels, and graded.

    python3 games/openworld/tools/src/art/cg/ending.py [--meadow render.png] [--holiest render.png] [--out dir]

Without the renders given, it makes them: `meadow` from the world's files (wiki/src/render-showcase.ts), `holiest` from
the world's files if it has been generated, else from its builder (the scratch renderer, if present).
"""
from __future__ import annotations

import argparse
import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[6]
OUT = ROOT / 'games/openworld/public/assets/lsw/CG'
W, H = 1280, 720


def render(map_id: str, into: Path) -> Path:
    """The map as the game draws it, at one pixel a pixel (the world's files, else the builder's scratch renderer)."""
    world = ROOT / f'games/openworld/public/world/maps/{map_id}.json'
    if world.exists():
        subprocess.run(['npx', 'tsx', 'games/openworld/wiki/src/render-showcase.ts', str(into), '1', map_id], cwd=ROOT, check=True, capture_output=True)
    else:
        subprocess.run(['npx', 'tsx', 'games/openworld/wiki/src/zz-render-built.ts', str(into), map_id], cwd=ROOT, check=True, capture_output=True)
    return into / f'{map_id}.png'


def radial(cx: float, cy: float, r: float) -> np.ndarray:
    """1 at (cx, cy) falling smoothly to 0 at r, over the whole frame."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    return np.clip(1 - d, 0, 1) ** 2


def blocks(draw: ImageDraw.ImageDraw, px: int, cells: list[tuple[int, int]], ox: int, oy: int, color: tuple[int, ...]) -> None:
    """Pixel art at a scale: each (x, y) a `px`-wide square from the origin."""
    for x, y in cells:
        draw.rectangle([ox + x * px, oy + y * px, ox + x * px + px - 1, oy + y * px + px - 1], fill=color)


# ------------------------------------------------------------------ the dawn

def dawn(src: Path) -> Image.Image:
    im = Image.open(src).convert('RGB')
    # the village street, the chapel and its bell tower, the houses either side: half the map's width, scaled by two
    crop = im.crop((160, 0, 800, 360)).resize((W, H), Image.NEAREST)
    a = np.asarray(crop).astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # the windows' glass (pale blue in the pack) lit warm from within and by the low sun
    glass = (b > 0.78) & (g > 0.55) & (b > r + 0.12) & (r < 0.9)
    # (only glass in a window: beside the pack's brown frames; pebbles and the pond are pale blue too)
    frame = (np.abs(r - 125 / 255) < 0.04) & (np.abs(g - 82 / 255) < 0.04) & (np.abs(b - 54 / 255) < 0.04)
    near = np.asarray(Image.fromarray((frame * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
    glass &= near
    a[glass] = np.array([1.0, 0.83, 0.55]) * (0.75 + 0.25 * a[glass].mean(axis=-1, keepdims=True))
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    # the deeper the shade already drawn, the deeper now (the sun is low): a little more contrast
    a = np.clip((a - 0.5) * 1.12 + 0.5, 0, 1) ** 1.15
    # before the sun: the whole village dim, cool and violet
    lum = a.mean(axis=-1, keepdims=True)
    cool = a * np.array([0.50, 0.50, 0.70]) + np.array([0.05, 0.04, 0.10]) * (1 - lum) + 0.02
    # the sun's light raking in from the east, low: strong at the top right, gone by the left and the bottom
    reach = np.clip((x / W) * 1.05 + (1 - y / H) * 0.75 - 0.62, 0, 1) ** 1.3
    gold = a * np.array([1.16, 0.96, 0.70]) + np.array([0.08, 0.04, 0.0])
    a = cool * (1 - reach[..., None]) + gold * reach[..., None]
    # the windows lit warm through it all, a little light spilling round them
    win = Image.fromarray((glass * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
    spill = (np.asarray(win).astype(np.float32) / 255)[..., None]
    a[glass] = np.array([1.0, 0.82, 0.52])
    a = a + spill * np.array([0.30, 0.20, 0.08])
    # the glow coming up over the hills at the top right, and the sun's rays slanting down from it
    glow = radial(W * 1.05, -H * 0.18, W * 0.95)[..., None]
    a = 1 - (1 - a) * (1 - glow * np.array([0.85, 0.58, 0.28]))
    ang = math.radians(32)
    u = (W - x) * math.cos(ang) + y * math.sin(ang)
    v = -(W - x) * math.sin(ang) + y * math.cos(ang)
    rays = np.zeros_like(x)
    for c, wdt, st in [(-90, 34, 0.18), (10, 20, 0.12), (110, 46, 0.16), (240, 26, 0.10), (360, 40, 0.09), (500, 30, 0.06)]:
        rays += st * np.exp(-((v - c) / wdt) ** 2) * np.clip(1 - u / (W * 1.15), 0, 1) ** 1.5
    a = a + rays[..., None] * np.array([1.0, 0.80, 0.52])
    # the morning haze: warm, thicker toward the top (the far side of the village)
    haze = (0.12 * (1 - y / H) ** 1.5 + 0.015)[..., None]
    a = a * (1 - haze) + np.array([0.95, 0.80, 0.68]) * haze
    # a soft fall-off at the edges, deepest at the bottom left
    vig = 1 - 0.38 * np.clip(np.sqrt(((x - W * 0.6) / (W * 0.6)) ** 2 + ((y - H * 0.35) / (H * 0.7)) ** 2) - 0.45, 0, 1)
    a = a * vig[..., None]
    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    # the child at the window of the stone house east of the chapel, the spark on its sill
    d = ImageDraw.Draw(out)
    wx, wy = 712, 265
    head = [(2, 3), (3, 3), (4, 3), (1, 4), (2, 4), (3, 4), (4, 4), (5, 4), (1, 5), (2, 5), (3, 5), (4, 5), (5, 5), (2, 6), (3, 6), (4, 6)]
    shoulders = [(x, 7) for x in range(0, 7)] + [(x, 8) for x in range(0, 7)]
    blocks(d, 2, head + shoulders, wx + 2, wy + 2, (62, 42, 40))
    blocks(d, 2, [(4, 4), (4, 5)], wx + 2, wy + 2, (196, 140, 96))  # the low sun on a cheek
    spark = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spark)
    sx, sy = 733, 288
    for rr, al in [(34, 22), (22, 40), (13, 80), (7, 140), (4, 200)]:
        sd.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=(255, 236, 190, al))
    spark = spark.filter(ImageFilter.GaussianBlur(3))
    out = Image.alpha_composite(out.convert('RGBA'), spark)
    d = ImageDraw.Draw(out)
    blocks(d, 2, [(0, 0), (1, 0), (0, 1), (1, 1)], sx - 2, sy - 2, (255, 252, 232, 255))
    blocks(d, 2, [(-1, 0), (2, 1), (0, -1), (1, 2)], sx - 2, sy - 2, (255, 230, 170, 200))
    return out.convert('RGB')


# ------------------------------------------------------------------ the Holiest

def bearer(d: ImageDraw.ImageDraw, ox: int, oy: int, px: int) -> None:
    """The new bearer sitting on the floor with their back to the bier, hooded, facing out; the lance out of their chest
    up and to the side; the crown faint on the hood. Pixel art, `px` screen pixels a pixel, its rim lit from behind."""
    ink, cloak, fold, rim, hood_in = (6, 5, 10), (30, 26, 42), (20, 17, 30), (116, 96, 158), (2, 2, 4)
    # the hood and the shoulders, the cloak spread on the floor round the knees
    shape: dict[tuple[int, int], tuple[int, int, int]] = {}
    for y in range(0, 7):
        half = 2 + (y + 1) // 2
        for x in range(9 - half, 10 + half):
            shape[(x, y)] = cloak
    for y in range(7, 20):
        half = 5 + (y - 7) // 2 if y < 16 else 9
        for x in range(9 - half, 10 + half):
            shape[(x, y)] = cloak
    for x in range(1, 18):
        shape[(x, 20)] = fold
    # the dark inside the hood; the folds
    for x, y in [(8, 3), (9, 3), (10, 3), (7, 4), (8, 4), (9, 4), (10, 4), (11, 4), (8, 5), (9, 5), (10, 5), (9, 6)]:
        shape[(x, y)] = hood_in
    for y in range(9, 20):
        for x in (6, 12) if y > 11 else ():
            shape[(x, y)] = fold
    for x in range(5, 14):
        shape[(x, 15)] = fold
    # the outline, then the rim of light along the top and the sides (the bier's glow behind)
    cells = set(shape)
    for (x, y) in list(cells):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in cells:
                d.rectangle([ox + (x + dx) * px, oy + (y + dy) * px, ox + (x + dx) * px + px - 1, oy + (y + dy) * px + px - 1], fill=ink)
    for (x, y), c in shape.items():
        d.rectangle([ox + x * px, oy + y * px, ox + x * px + px - 1, oy + y * px + px - 1], fill=c)
    for (x, y) in cells:
        if (x, y - 1) not in cells and shape[(x, y)] != hood_in:
            d.rectangle([ox + x * px, oy + y * px, ox + x * px + px - 1, oy + y * px + px - 1], fill=rim)
        elif ((x - 1, y) not in cells or (x + 1, y) not in cells) and y < 16:
            d.rectangle([ox + x * px, oy + y * px, ox + x * px + px - 1, oy + y * px + px - 1], fill=(64, 52, 92))
    # the knees drawn up under the cloak, a fold between them
    for (x, y) in [(6, 12), (7, 12), (6, 13), (7, 13), (8, 13), (11, 12), (12, 12), (10, 13), (11, 13), (12, 13)]:
        d.rectangle([ox + x * px, oy + y * px, ox + x * px + px - 1, oy + y * px + px - 1], fill=(44, 38, 62))
    for y in range(12, 16):
        d.rectangle([ox + 9 * px, oy + y * px, ox + 9 * px + px - 1, oy + y * px + px - 1], fill=fold)
    # the crown of thorns on the hood: thorns standing up off its rim, their tips caught by the light behind
    for x, top in [(6, 0), (7, -1), (9, -2), (11, -1), (12, 0), (8, -1), (10, -1)]:
        for y in range(top, top + 2):
            d.rectangle([ox + x * px, oy + y * px, ox + x * px + px - 1, oy + y * px + px - 1], fill=(64, 34, 46))
        d.rectangle([ox + x * px, oy + (top - 1) * px, ox + x * px + px - 1, oy + (top - 1) * px + px - 1], fill=(172, 110, 120))
    # the lance: out of the chest, up and to the right, black, a sliver of light along its upper side, the blade at its end
    for k in range(0, 30):
        x, y = 10 + k * 0.5, 9 - k
        d.rectangle([ox + round(x * px), oy + round(y * px), ox + round(x * px) + px - 1, oy + round(y * px) + px - 1], fill=(4, 3, 8))
        if k % 2 == 1:
            d.rectangle([ox + round(x * px) - px, oy + round(y * px), ox + round(x * px) - 1, oy + round(y * px) + px - 1], fill=(138, 118, 176))
    tip = (10 + 29 * 0.5, 9 - 29)
    for dx, dy in ((0, -1), (0, -2), (1, -1), (-1, -1)):
        d.rectangle([ox + round((tip[0] + dx) * px), oy + round((tip[1] + dy) * px), ox + round((tip[0] + dx) * px) + px - 1, oy + round((tip[1] + dy) * px) + px - 1], fill=(30, 24, 44) if dy == -1 else (150, 130, 190))


def holiest(src: Path) -> Image.Image:
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32).copy()
    # Astra gone from the crypt: the floor under him put back from the same columns further down (the tiles repeat by 16)
    bx0, by0, bx1, by1 = 188, 136, 288, 264
    a[by0:by1, bx0:bx1] = a[by0 + 128:by1 + 128, bx0:bx1]
    # (the thorn channel's short run above the bier reads as a ladder in the dark: the floor beside it put over it)
    a[28:84, 240:256] = a[28:84, 256:272]
    im = Image.fromarray(a.astype(np.uint8))
    # the bier near the top of the frame, the floor before it where the bearer sits; four pixels a pixel
    cx0, cy0 = 80, 24
    big = im.crop((cx0, cy0, cx0 + 320, cy0 + 180)).resize((W, H), Image.NEAREST)
    a = np.asarray(big).astype(np.float32) / 255
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    # near black, cold and violet; the last light lies on the bier and the floor before it
    bier = ((235 - cx0) * 4, (86 - cy0) * 4)
    light = np.maximum(radial(bier[0], bier[1] - 20, 420), 0.8 * radial(bier[0], bier[1] + 180, 300))
    tone = a * np.array([0.44, 0.42, 0.66])
    a = tone * (0.035 + 0.78 * light[..., None] ** 1.2) + np.array([0.05, 0.02, 0.09]) * light[..., None] ** 2
    # the dark that moves behind the bier: smoky shapes reaching up out of it, darker than the dark, a violet rim
    rng = np.random.default_rng(11)
    q = 4
    smoke = Image.new('L', (W // q, H // q), 0)
    sd = ImageDraw.Draw(smoke)
    base_y = (bier[1] - 6) / q
    for _ in range(38):
        sx = rng.normal(bier[0] / q, 44)
        sy = base_y - abs(rng.normal(0, 26))
        rx, ry = rng.uniform(8, 26), rng.uniform(10, 34)
        sd.ellipse([sx - rx, sy - ry, sx + rx, sy + ry], fill=int(rng.uniform(80, 170)))
    for _ in range(11):
        sx = rng.normal(bier[0] / q, 52)
        pts = [(sx, base_y + 4)]
        for k in range(7):
            pts.append((pts[-1][0] + rng.uniform(-10, 10), pts[-1][1] - rng.uniform(7, 14)))
        sd.line(pts, fill=int(rng.uniform(140, 200)), width=int(rng.uniform(4, 10)))
    smoke = smoke.filter(ImageFilter.GaussianBlur(4)).resize((W, H), Image.BICUBIC)
    m = np.asarray(smoke).astype(np.float32) / 255
    m = np.clip(m * 1.3, 0, 1) * np.clip((bier[1] + 40 - y) / 80, 0, 1)
    rim = np.clip(m * (1 - m) * 4, 0, 1) ** 1.5
    a = a * (1 - 0.92 * m[..., None]) + rim[..., None] * np.array([0.20, 0.10, 0.32]) * (0.25 + light[..., None])
    # the frame's edges into the black
    vig = np.clip(1.2 - np.sqrt(((x - W / 2) / (W * 0.52)) ** 2 + ((y - H * 0.4) / (H * 0.62)) ** 2), 0, 1)
    a = a * vig[..., None]
    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    # the bearer before the bier, small in the frame
    bearer(ImageDraw.Draw(out), bier[0] - 9 * 4, bier[1] + 64, 4)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--meadow')
    ap.add_argument('--holiest')
    ap.add_argument('--out', default=str(OUT))
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        meadow = Path(args.meadow) if args.meadow else render('meadow', Path(tmp))
        crypt = Path(args.holiest) if args.holiest else render('holiest', Path(tmp))
        dawn(meadow).save(out / 'ending_dawn.png', optimize=True)
        holiest(crypt).save(out / 'ending_holiest.png', optimize=True)
    print(f'{out}/ending_dawn.png, {out}/ending_holiest.png')


if __name__ == '__main__':
    main()
