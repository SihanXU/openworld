"""The altars of the Church's chapels on the road, each as its own words describe it (2026-11-24, a first look for the
user): Firstlight's stone altar (firstlight-chapel/sheet.png) recut in each chapel's stone and cloth, with a carved
retable standing behind it — the wound the chapel keeps, from the same sheet's tiles of the five wounds:

- the Chapel of the Five at the Pilgrims' Rest (waystation.chapel): white stone, a violet frontal, all five round Astra;
- the Chapel of the Pillar at the Scourge-house (scourgehouse.hall): red stone, a black frontal, the pillar and its cords;
- the Chapel of the Measure at Fairweight (fairweight.chapel): pale stone, a green frontal, the scales;
- the Chapel of the Nail at Nailgate (nailgate.chapel): black wood, a bone-white frontal, the nail.

Each is drawn for its altar alone (catalog.ts placedSprites, by the altar's id where it stands): the walls the chapels
share with other halls are not touched. Four pixels to the game's one (drawn at a quarter).

    python3 games/openworld/tools/src/art/chapel-altars.py [preview-dir]
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'firstlight-chapel'
GAME = Path(__file__).resolve().parents[3]
LSW = GAME / 'public/assets/lsw'
OUT = 'Fixtures/ChapelAltars.png'
INDEX = GAME / 'client/src/chapel-altars.json'
T = 16
K = 4

sheet = np.array(Image.open(HERE / 'sheet.png').convert('RGBA'))
sheet[sheet[..., 3] < 96] = 0
SHEET = Image.fromarray(sheet)

ALTAR = (532, 19, 933, 211)
RELIEF = (418, 225, 836, 540)
TILES = {'crown': (853, 293, 959, 399), 'pillar': (966, 293, 1062, 399), 'scales': (1071, 293, 1173, 399), 'nail': (901, 412, 1004, 518), 'lance': (1027, 412, 1130, 518)}


def taken(box: tuple[int, int, int, int], width: float) -> Image.Image:
    p = SHEET.crop(box).convert('RGBa')
    s = width * K / p.width
    p = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS).convert('RGBA')
    a = np.array(p)
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


def hsv(a: np.ndarray) -> np.ndarray:
    f = a[..., :3].astype(float) / 255
    return np.array([[colorsys.rgb_to_hsv(*px) for px in row] for row in f])


def recolor(img: Image.Image, stone: tuple[int, int, int] | None, cloth: tuple[int, int, int] | None = None) -> Image.Image:
    """The picture's stone and its frontal in other colours, each kept as light and dark as it was: `stone` the stone's
    middle colour (all of the picture but its dark outline and the frontal), `cloth` the frontal's red (its gold and
    its outline as they are). The frontal is where the picture's red is."""
    a = np.array(img).astype(float)
    h = hsv(a.astype(np.uint8))
    lum = a[..., :3] @ [0.299, 0.587, 0.114] / 255
    shown = a[..., 3] > 0
    # (the cloth's red: bright and strong, not the dark red-brown of the outline)
    red = shown & (h[..., 1] > 0.45) & (h[..., 2] > 0.45) & ((h[..., 0] < 0.04) | (h[..., 0] > 0.94))
    frontal = np.zeros_like(shown)
    if cloth is not None and red.sum() > 50:
        ys, xs = np.where(red)
        # (the cloth's own rectangle, its gold border with it: what is red, a little round it)
        y0, y1, x0, x1 = np.percentile(ys, 3), np.percentile(ys, 97), np.percentile(xs, 3), np.percentile(xs, 97)
        frontal[int(y0) - 2:int(y1) + 3, int(x0) - 2:int(x1) + 3] = True
        frontal &= shown
    rock = shown & ~frontal & (lum > 0.16)
    cloth_px = frontal & red
    for mask, to in ((rock, stone), (cloth_px, cloth)):
        if to is None or not mask.any():
            continue
        mid = np.median(lum[mask])
        k = (lum[mask] / mid)[:, None]
        a[mask, :3] = np.clip(np.array(to, float)[None, :] * k, 0, 255)
    return Image.fromarray(a.round().astype(np.uint8))


def altar_with(retable: Image.Image, altar: Image.Image) -> Image.Image:
    """The altar with its retable standing behind it, the retable's foot hidden behind the altar's top."""
    lap = round(altar.height * 0.22)
    W = max(altar.width, retable.width)
    H = retable.height + altar.height - lap
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(retable, ((W - retable.width) // 2, 0))
    out.alpha_composite(altar, ((W - altar.width) // 2, H - altar.height))
    return out


# name: the altar's width and the retable's (game pixels), the retable (a tile, or the whole relief), the stone and
# the frontal's colour, whether the retable takes the altar's stone, how far its middle stands east of its cell's
ALTARS = {
    'five': (48, 58, RELIEF, (226, 222, 212), (104, 62, 132), False, 0),
    'pillar': (56, 30, TILES['pillar'], (176, 92, 78), (52, 44, 48), True, -T / 2),
    'measure': (48, 30, TILES['scales'], (222, 216, 196), (52, 98, 64), True, 0),
    'nail': (48, 30, TILES['nail'], (78, 58, 46), (214, 206, 188), True, 0),
}

cut, pieces = {}, {}
for name, (aw, rw, box, stone, cloth, same, east) in ALTARS.items():
    altar = recolor(taken(ALTAR, aw), stone, cloth)
    retable = taken(box, rw)
    if same:
        retable = recolor(retable, stone)
    cut[name] = (altar_with(retable, altar), east)

x, H = 0, max(img.height for img, _ in cut.values())
sheet_out = Image.new('RGBA', (sum(img.width + 2 for img, _ in cut.values()), H))
for name, (img, east) in cut.items():
    sheet_out.alpha_composite(img, (x, 0))
    # (its anchor the cell's bottom middle, a game pixel under its own bottom edge)
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height - K}
    print(f'{name:8s} {img.width}x{img.height} → {img.width / K:.1f}x{img.height / K:.1f} game px')
    x += img.width + 2
sheet_out.save(LSW / OUT, optimize=True)
INDEX.write_text(json.dumps({'img': f'lsw/{OUT}', 'scale': 1 / K, 'pieces': pieces}, indent=1) + '\n')
print('→', LSW / OUT, sheet_out.size, '→', INDEX)

if len(sys.argv) > 1:
    bg = Image.new('RGBA', sheet_out.size, (110, 120, 110, 255))
    bg.alpha_composite(sheet_out)
    bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST).save(Path(sys.argv[1]) / 'chapel-altars.png')
