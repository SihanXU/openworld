"""The things of the outdoors and the villages from one art pack as it was painted, each in two makes: the arms rack,
the cooking rack over its fire, the dead tree, the well, the scarecrow, and the bench by a campfire or a road.

The pack (outdoor/sheet-a.png, sheet-b.png) is taken as it is, only made smaller, never redrawn, at four pixels to the
game's one (the catalogue draws them at a quarter, pixel for pixel at the game's zoom of four); the haze the pack's
background left round its pieces is taken away. A thing's two makes are drawn at one scale, as the pack drew them;
which one a thing has is picked by the thing (client/src/catalog.ts: neither is the richer).

    python3 games/openworld/tools/src/art/outdoor.py [preview.png]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'outdoor'
GAME = Path(__file__).resolve().parents[3]
OUT = GAME / 'public/assets/lsw/Fixtures/Outdoor.png'
INDEX = GAME / 'client/src/outdoor.json'
K = 4  # this sheet's pixels to the game's one


def pack(name: str) -> Image.Image:
    a = np.array(Image.open(HERE / f'sheet-{name}.png').convert('RGBA'))
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)  # the haze round the pieces gone; the pieces' own edges hard
    return Image.fromarray(a)


SHEETS = {n: pack(n) for n in 'ab'}

# a thing's two makes (sheet, the pack's box), and its size in the game's pixels (the first make's width or height;
# the second at its scale). A man is some 32 high.
PIECES = {
    # spears, a sword and a shield; an axe, a spear, a bow and a quiver
    'arms_rack': (('a', (63, 107, 440, 489)), ('a', (39, 603, 417, 990)), {'h': 28}),
    # the pot hung over the fire, garlic and peppers drying; a shelf of meat and jars over it, a pan
    'rack': (('a', (498, 118, 937, 490)), ('a', (493, 600, 929, 996)), {'w': 32}),
    # (as high as the one at Vesper Ford, tools/src/art/ford-crossing.py)
    'dead_tree': (('a', (1009, 72, 1401, 489)), ('a', (1011, 556, 1405, 992)), {'h': 48}),
    # under its roof of tiles; its bare frame (a village square's middle: a little higher than a man)
    'well': (('b', (103, 119, 449, 515)), ('b', (93, 623, 451, 1013)), {'h': 36}),
    'scarecrow': (('b', (570, 102, 847, 511)), ('b', (564, 589, 857, 1009)), {'h': 32}),
    # a plank bench with no back, and one with a back (as high as a chair's back)
    'log_bench': (('b', (939, 685, 1382, 1004)), ('b', (932, 292, 1360, 463)), {'w': 28}),
}


def trimmed(sheet: str, box: tuple[int, int, int, int]) -> Image.Image:
    p = SHEETS[sheet].crop(box)
    ys, xs = np.nonzero(np.array(p)[..., 3])
    return p.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def foot(img: Image.Image) -> float:
    """Where it stands: the middle of its bottom rows."""
    a = np.array(img)[..., 3]
    xs = np.nonzero(a[-max(2, a.shape[0] // 25):].any(0))[0]
    return (xs.min() + xs.max() + 1) / 2


pieces: dict[str, Image.Image] = {}
for key, (one, two, size) in PIECES.items():
    first = trimmed(*one)
    k = size['w'] * K / first.width if 'w' in size else size['h'] * K / first.height
    for i, (sheet, box) in enumerate((one, two), 1):
        p = trimmed(sheet, box)
        pieces[f'{key}_{i}'] = p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)

WIDTH = 1024
order = sorted(pieces, key=lambda n: -pieces[n].height)
places, x, y, row = {}, 0, 0, 0
for name in order:
    img = pieces[name]
    if x + img.width > WIDTH:
        x, y, row = 0, y + row + 2, 0
    places[name] = (x, y)
    x, row = x + img.width + 2, max(row, img.height)
sheet = Image.new('RGBA', (WIDTH, y + row))
index = {}
for name, img in pieces.items():
    sx, sy = places[name]
    sheet.alpha_composite(img, (sx, sy))
    # its foot (the cell's bottom middle) under what it stands on, a game pixel above its bottom
    index[name] = {'x': sx, 'y': sy, 'w': img.width, 'h': img.height, 'ax': round(foot(img), 1), 'ay': img.height - K}
    print(f'{name:14s} {img.width / K:5.1f} x {img.height / K:5.1f} game px')
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, optimize=True)
INDEX.write_text(json.dumps({'img': 'lsw/Fixtures/Outdoor.png', 'scale': 1 / K, 'pieces': index}, indent=1) + '\n')
print('→', OUT, sheet.width, 'x', sheet.height)

if len(sys.argv) > 1:
    view = Image.new('RGBA', sheet.size, (120, 110, 96, 255))
    view.alpha_composite(sheet)
    view.save(sys.argv[1])
