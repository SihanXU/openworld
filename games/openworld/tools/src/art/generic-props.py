"""Three things the whole game has many of, from one art pack as it was painted: the notice board, the stone cross over a
grave, the bench in three makes (plain, with a back, old and mossed over).

The pack (generic-props/props.png) is taken as it is, only made smaller, never redrawn, at four pixels to the game's one
(the catalogue draws them at a quarter, pixel for pixel at the game's zoom of four):
- the board, for every sign, notice board and commission board (`fixture:sign`, `fixture:noticeboard`,
  `fixture:questboard`);
- the cross, for every gravestone (`fixture:gravestone`), and the wayside cross at the Mountain Foot (the prefab
  `foot_waycross`, its own picture at 64 pixels a tile: FootWaycross.png, standing where the old one stood);
- the benches, a look each picked by the thing (`fixture:bench`: the backed one most, a church's pew).

The first three maps keep their own pictures (the catalogue pins what stands there), but for the Mountain Foot's cross.

    python3 games/openworld/tools/src/art/generic-props.py [preview.png]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'generic-props'
GAME = Path(__file__).resolve().parents[3]
OUT = GAME / 'public/assets/lsw/Fixtures/GenericProps.png'
CROSS_OUT = GAME / 'public/assets/lsw/Fixtures/FootWaycross.png'
INDEX = GAME / 'client/src/generic-props.json'
T = 16  # a cell, in the game's pixels
K = 4  # this sheet's pixels to the game's one
PACK = Image.open(HERE / 'props.png').convert('RGBA')

# name: the pack's box, its width in the game's pixels, how far below its cell's bottom edge its foot stands
PIECES = {
    'board': ((187, 19, 597, 413), 19, 1),
    'cross': ((223, 431, 562, 1007), 13, 1),
    'bench': ((683, 141, 1310, 336), 26, 1),
    'pew': ((677, 367, 1317, 685), 26, 1),
    'worn': ((666, 704, 1316, 1004), 26, 1),
}


def taken(box: tuple[int, int, int, int], width: float, k: int = K) -> Image.Image:
    p = PACK.crop(box)
    s = width * k / p.width
    return p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS)


WIDTH = 512
cut = {name: (taken(box, w), lift) for name, (box, w, lift) in PIECES.items()}
sheet = Image.new('RGBA', (WIDTH, max(img.height for img, _ in cut.values())))
index, x = {}, 0
for name, (img, lift) in cut.items():
    sheet.alpha_composite(img, (x, 0))
    # its foot (the cell's bottom middle): under its middle, `lift` game pixels above its bottom
    index[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2, 'ay': img.height - lift * K}
    print(f'{name:6s} {img.width}x{img.height} → {img.width / K:.1f}x{img.height / K:.1f} game px')
    x += img.width + 2
sheet = sheet.crop((0, 0, x, sheet.height))
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, optimize=True)
INDEX.write_text(json.dumps({'img': 'lsw/Fixtures/GenericProps.png', 'scale': 1 / K, 'pieces': index}, indent=1) + '\n')
print('→', OUT, sheet.width, 'x', sheet.height)

# the Mountain Foot's wayside cross: a prefab two tiles wide and four high (catalog.ts foot_waycross), its picture at 64
# pixels a tile; the cross as tall as the old one (44 of the game's pixels), its middle and foot where the old one's were
# (15.5 across, 62 down)
P = 64
cross = taken(PIECES['cross'][0], 1, P)  # (a width of one to begin with: made to its height below)
s = 44 * P / T / cross.height
cross = cross.resize((round(cross.width * s), round(cross.height * s)), Image.LANCZOS)
tile = Image.new('RGBA', (2 * P, 4 * P))
tile.alpha_composite(cross, (round(15.5 * P / T - cross.width / 2), round(62 * P / T - cross.height)))
tile.save(CROSS_OUT, optimize=True)
print('→', CROSS_OUT, f'(the cross {cross.width * T / P:.1f}x{cross.height * T / P:.1f} game px)')

if len(sys.argv) > 1:
    view = Image.new('RGBA', sheet.size, (110, 150, 80, 255))
    view.alpha_composite(sheet)
    view.save(sys.argv[1])
