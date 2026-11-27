"""Firstlight's churchyard (meadow) as the user drew it (2026-11-24): its gravestones in two designs, one to a row, from
the user's drawings (firstlight-graves/cross.png, the headstone with a cross over a bed of earth; firstlight-graves/gothic.png,
the pointed headstone between two pinnacles over a bed of grass). Each is taken as it was painted, only made smaller,
never redrawn, at four pixels to the game's one (drawn at a quarter), both at one scale so the two rows match.

The gravestones stay where they stood (tools/src/demo/village.ts); each picture is a grave two cells wide whose headstone
is over the gravestone's cell and whose bed reaches into the cell west of it, so it is laid with its middle on the line
between those two cells and its foot on the cell's bottom edge. Drawn by placement (catalog.ts placedSprites), the
gravestones elsewhere keep the generic stone cross.

    python3 games/openworld/tools/src/art/firstlight-graves.py [preview-dir]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'firstlight-graves'
GAME = Path(__file__).resolve().parents[3]
LSW = GAME / 'public/assets/lsw'
OUT = 'Fixtures/FirstlightGraves.png'
INDEX = GAME / 'client/src/firstlight-graves.json'
T = 16  # a cell, in the game's pixels
K = 4  # these pictures' pixels to the game's one
WIDE = 30  # the cross grave's width in game pixels: a little under its two cells, so the graves of a row stand apart
LIFT = 1  # how far a picture's foot stands above its cell's bottom edge (game pixels)


def clean(path: Path) -> Image.Image:
    """A drawing with its matte off (its faint fringe, alpha under a third, cleared) and cut to what is drawn."""
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    ys, xs = np.nonzero(a[..., 3])
    return Image.fromarray(a).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def smaller(img: Image.Image, s: float) -> Image.Image:
    """A picture made `s` times as large (premultiplied, so no fringe bleeds in)."""
    p = img.convert('RGBa').resize((round(img.width * s), round(img.height * s)), Image.LANCZOS).convert('RGBA')
    a = np.array(p)
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


DRAWN = {name: clean(HERE / f'{name}.png') for name in ('cross', 'gothic')}
S = WIDE * K / DRAWN['cross'].width
CUT = {name: smaller(img, S) for name, img in DRAWN.items()}

sheet = Image.new('RGBA', (sum(img.width for img in CUT.values()) + 2 * (len(CUT) - 1), max(img.height for img in CUT.values())))
pieces, x = {}, 0
for name, img in CUT.items():
    sheet.alpha_composite(img, (x, 0))
    # the middle on the line between its two cells (half a cell west of its own cell's middle), the foot on the cell's edge
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 + T / 2 * K, 'ay': img.height - LIFT * K}
    print(f'{name:7s} {img.width}x{img.height} → {img.width / K:.1f}x{img.height / K:.1f} game px')
    x += img.width + 2
sheet.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, sheet.size)
INDEX.write_text(json.dumps({'img': f'lsw/{OUT}', 'scale': 1 / K, 'pieces': pieces}, indent=1) + '\n')
print('→', INDEX)

if len(sys.argv) > 1:
    view = Path(sys.argv[1])
    view.mkdir(parents=True, exist_ok=True)
    bg = Image.new('RGBA', sheet.size, (110, 140, 80, 255))
    bg.alpha_composite(sheet)
    bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST).save(view / 'graves.png')
    print('→', view)
