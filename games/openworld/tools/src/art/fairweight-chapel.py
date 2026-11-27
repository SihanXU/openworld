"""Fairweight's Chapel of the Measure (fairweight.chapel) as the user drew it (2026-11-25): their sheet
(fairweight-chapel/sheet.png) and mock-up (fairweight-chapel/ref.png); what the sheet has not, the earlier ones' as the
user asked: the windows and the candelabra the Rest's chapel's (rest-chapel/sheet.png), the pews Firstlight's (its own
look, firstlight-chapel.py), the runner the Rest's (rest-chapel.py), the almoner's box the plain chest. Taken as
painted, only made smaller, at four pixels to the game's one.

- The things (Fixtures/FairweightChapel.png, client/src/fairweight-chapel.json `pieces`): the altar of the Measure, a
  man in one pan of the scale and the sheaves in the other carved over it, its frontal and its steps (drawn where it
  stands, catalog.ts placedSprites); the map's own looks (catalog.ts, the theme `fairweight`): the candelabra, lit; in
  the almoner's room the shelf with its cloth and a cobweb, the sacks with grain spilt by them, the table with the
  basket of bread and a cloth on it.
- On the floor (`steps`): the platform the altar stands on, two tiers of pale stone, gold at their edges.
- The walls (Buildings/FairweightChapelWalls.png, `walls`): the chapel's own walls (`fwchapel_shell`, drawn bare by
  tools/src/art/arch) four times as large, and on them, as the mock-up hangs them, the great window and the lancets, the
  banners of the scale and the sheaf and of the cross and the scale, the niches of the weights and of the sheaf, in the
  almoner's room a banner and the tablet of the bread and the sheaf.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts fwchapel_shell
    python3 games/openworld/tools/src/art/fairweight-chapel.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ART = Path(__file__).resolve().parent
GAME = Path(__file__).resolve().parents[3]
LSW = GAME / 'public/assets/lsw'
OUT = 'Fixtures/FairweightChapel.png'
STEPS_OUT = 'Fixtures/FairweightChapelSteps.png'
WALLS_OUT = 'Buildings/FairweightChapelWalls.png'
SHELL = 'Buildings/fwchapel_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/fairweight-chapel.json'
T = 16
K = 4
P = T * K


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


OWN, REST = sheet(ART / 'fairweight-chapel/sheet.png'), sheet(ART / 'rest-chapel/sheet.png')


def taken(src: Image.Image, box: tuple[int, int, int, int], width: float) -> Image.Image:
    """The piece in `box`, its stray specks dropped, made `width` game pixels wide."""
    p = np.array(src.crop(box))
    lab, n = ndimage.label(p[..., 3] > 0)
    if n > 1:
        sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.01])
        p[~keep] = 0
    img = Image.fromarray(p).convert('RGBa')
    s = width * K / img.width
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS).convert('RGBA')
    a = np.array(img)
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


def hard(img: Image.Image) -> Image.Image:
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return Image.fromarray(a)


PIECE = {
    # the sheet's own
    'altar': taken(OWN, (69, 32, 627, 677), 72),
    'banner_scale': taken(OWN, (624, 43, 819, 406), 20),
    'banner_cross': taken(OWN, (840, 43, 1030, 406), 20),
    'niche_weights': taken(OWN, (642, 430, 838, 677), 20),
    'niche_sheaf': taken(OWN, (864, 430, 1062, 676), 20),
    'tablet': taken(OWN, (1103, 447, 1452, 673), 35),
    'table': taken(OWN, (58, 719, 460, 976), 52),
    'shelf': taken(OWN, (486, 710, 785, 981), 37),
    'sacks': taken(OWN, (817, 748, 1111, 987), 26),
    # the Rest's: the windows and the candelabra
    'window_big': taken(REST, (252, 200, 580, 606), 26),
    'lancet': taken(REST, (112, 261, 228, 541), 12),
    'candelabrum': taken(REST, (1193, 144, 1323, 402), 13),
}

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
# (game pixels), each where the mock-up has it: the altar and the candelabra on the platform against the wall, the shelf
# and the sacks against the almoner's room's wall
THINGS = {'altar': (0, 6), 'candelabrum': (0, 8), 'shelf': (3, 8), 'sacks': (-8, 6), 'table': (2, -4)}
x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[n].width + 2 for n in THINGS), max(PIECE[n].height for n in THINGS))), {}
for name, (east, foot) in THINGS.items():
    img = PIECE[name]
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)

# ------------------------------------------------------------------------------------------------ on the floor
# the altar's platform: eleven cells by two from the nave's north-west corner (2, 9); its outer tier wide, its inner
# under the altar, each a pale top, a line of gold, a riser and a shadow on the floor. Places in the map's cells
SX, SY, SW, SH = 2, 9, 11, 2
TOP, GOLD, RISER, SHADOW = (230, 220, 196), (186, 146, 64), (190, 178, 152), (0, 0, 0)
INNER_TOP = (238, 230, 208)


def steps() -> Image.Image:
    a = np.zeros((SH * P, SW * P, 4), np.uint8)

    def band(x0: float, x1: float, y0: float, y1: float, rgb: tuple[int, int, int], alpha: int = 255) -> None:
        a[round((y0 - SY) * P):round((y1 - SY) * P), round((x0 - SX) * P):round((x1 - SX) * P)] = (*rgb, alpha)

    for (x0, x1), front, top in (((3.7, 11.3), 9.72, TOP), ((5.3, 9.7), 10.05, INNER_TOP)):
        band(x0, x1, SY, front, top)
        band(x0, x1, front, front + 0.06, GOLD)
        band(x0, x1, front + 0.06, front + 0.22, RISER)
        band(x0, x1, front + 0.22, front + 0.32, SHADOW, 60)
        # its ends: a riser down each side, a line of gold along its top
        for xe in (x0, x1 - 0.1):
            band(xe, xe + 0.1, SY, front + 0.22, RISER)
        band(x0 + 0.1, x0 + 0.16, SY, front, GOLD)
        band(x1 - 0.16, x1 - 0.1, SY, front, GOLD)
    return Image.fromarray(a)


steps().save(LSW / STEPS_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['fwchapel_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
by_row = {s['row']: s for s in shell['slices']}
TOP_ROWS = 7
NAVE_FACE = (2 + TOP_ROWS) * T
CELL_FACE = (3 + TOP_ROWS) * T
MID = 7.5


def lay(img: Image.Image, s: dict, mx: float, my: float) -> None:
    sx = round((s['x'] + mx - s['col'] * T) * K)
    sy = round((s['y'] + my - (s['row'] - s['th'] + 1) * T) * K)
    x0, y0 = s['x'] * K, s['y'] * K
    assert x0 <= sx and y0 <= sy and sx + img.width <= x0 + s['tw'] * T * K and sy + img.height <= y0 + s['th'] * T * K, f'off the strip of row {s["row"]}'
    region = walls.crop((sx, sy, sx + img.width, sy + img.height))
    over = Image.alpha_composite(region, img)
    mask = Image.fromarray(((np.array(region)[..., 3] > 0) * 255).astype(np.uint8))
    walls.paste(over, (sx, sy), mask)


def both(d: float) -> list[float]:
    """A place west of the nave's middle and its fellow east of it."""
    return [MID - d, MID + d]


# (the piece, the face, its middle in cells, its foot over the floor in game pixels), as the mock-up hangs them; each
# clear of the pilasters (the nave's at 2, 5, 10 and 13, the room's at 14 and 19) and of the string course at 69
HUNG = [
    # the nave's north wall: the great window over the altar, two lancets either side over the course; under it the
    # banner of the scale and the sheaf and the niche of the weights west, the niche of the sheaf and the banner of the
    # cross and the scale east
    ('window_big', NAVE_FACE, MID, 78),
    *[('lancet', NAVE_FACE, m, 76) for d in (4.9, 3.05) for m in both(d)],
    ('banner_scale', NAVE_FACE, 2.85, 22),
    ('niche_weights', NAVE_FACE, 4.1, 31),
    ('niche_sheaf', NAVE_FACE, 10.9, 31),
    ('banner_cross', NAVE_FACE, 12.15, 22),
    # the almoner's room: three lancets, the banner of the scale and the sheaf, the tablet of the bread and the sheaf
    *[('lancet', CELL_FACE, m, 76) for m in (14.55, 16.5, 18.45)],
    ('banner_scale', CELL_FACE, 15.15, 22),
    ('tablet', CELL_FACE, 17.4, 44),
]
for name, face, mid, z in HUNG:
    img = hard(PIECE[name])
    lay(img, by_row[face // T - 1], mid * T - img.width / K / 2, face - z - img.height / K)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'steps': {'img': f'lsw/{STEPS_OUT}', 'tw': SW, 'th': SH, 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
