"""The containers and goods of the whole game from one art pack as it was painted: the barrel and the sack, each shut
and open; the pot plain and painted; the firewood, the hay and the hand cart in two makes. (The chest and the crate
are interior-furniture.py's, from a later pack.)

The pack (containers/sheet.png) is taken as it is, only made smaller, never redrawn, at four pixels to the game's one
(the catalogue draws them at a quarter, pixel for pixel at the game's zoom of four); the haze the pack's background left
round its pieces (pixels all but clear) is taken away. A shut piece and its open one stand on the same foot, so that
opening it does not move it. Which make a thing has (client/src/catalog.ts): the pot by its map's theme (plain or
rich, Catalog.fixtureThemes), the firewood, the hay and the cart picked by the thing.

    python3 games/openworld/tools/src/art/containers.py [preview.png]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'containers'
GAME = Path(__file__).resolve().parents[3]
OUT = GAME / 'public/assets/lsw/Fixtures/Containers.png'
INDEX = GAME / 'client/src/containers.json'
K = 4  # this sheet's pixels to the game's one

_a = np.array(Image.open(HERE / 'sheet.png').convert('RGBA'))
_a[..., 3] = np.where(_a[..., 3] >= 128, 255, 0)  # the haze round the pieces gone; the pieces' own edges hard
PACK = Image.fromarray(_a)

# name: the pack's box, its size in the game's pixels (a width or a height)
PIECES = {
    'barrel': ((101, 58, 301, 296), {'h': 20}),
    'barrel_open': ((357, 58, 557, 294), None),  # (as the shut one: the same scale)
    'sack': ((753, 49, 955, 269), {'w': 16}),
    'sack_open': ((964, 56, 1164, 269), None),
    'pot_plain': ((1279, 76, 1448, 261), {'h': 16}),
    'pot_rich': ((1484, 72, 1686, 262), {'h': 16}),
    'firewood_logs': ((710, 339, 955, 529), {'w': 24}),
    'firewood_split': ((963, 335, 1197, 533), {'w': 24}),
    'hay_bales': ((1238, 332, 1480, 539), {'h': 22}),
    'hay_sheaf': ((1503, 309, 1732, 547), {'h': 22}),
    'cart_empty': ((736, 592, 1132, 848), {'w': 30}),
    'cart_loaded': ((1221, 564, 1625, 849), {'w': 30}),
}


def trimmed(box: tuple[int, int, int, int]) -> Image.Image:
    p = PACK.crop(box)
    ys, xs = np.nonzero(np.array(p)[..., 3])
    return p.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


pieces: dict[str, Image.Image] = {}
last_k = 1.0
for name, (box, size) in PIECES.items():
    p = trimmed(box)
    # an open piece at its shut one's scale
    k = last_k if size is None else (size['w'] * K / p.width if 'w' in size else size['h'] * K / p.height)
    last_k = k
    pieces[name] = p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)

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
    # its foot (the cell's bottom middle) under its middle, a game pixel above its bottom
    index[name] = {'x': sx, 'y': sy, 'w': img.width, 'h': img.height, 'ax': img.width / 2, 'ay': img.height - K}
    print(f'{name:15s} {img.width / K:5.1f} x {img.height / K:5.1f} game px')
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, optimize=True)
INDEX.write_text(json.dumps({'img': 'lsw/Fixtures/Containers.png', 'scale': 1 / K, 'pieces': index}, indent=1) + '\n')
print('→', OUT, sheet.width, 'x', sheet.height)

if len(sys.argv) > 1:
    view = Image.new('RGBA', sheet.size, (120, 110, 96, 255))
    view.alpha_composite(sheet)
    view.save(sys.argv[1])
