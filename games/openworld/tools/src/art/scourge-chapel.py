"""The Chapel of the Pillar in the Scourging House (scourgehouse.hall) as the user drew it (2026-11-25): their sheet
(scourge-chapel/sheet.png), the register's desk and the windows (scourge-chapel/extras.png) and the mock-up
(scourge-chapel/ref.png); the bookshelf from Firstlight's chapel's sheet (firstlight-chapel/sheet.png) and the rug from
the Rest's (rest-chapel/sheet.png). Taken as painted, only made smaller, at four pixels to the game's one.

- The things (Fixtures/ScourgeChapel.png, client/src/scourge-chapel.json `pieces`): the altar of the Post, the man bound
  and the scourges round him on its face (drawn where it stands, catalog.ts placedSprites); the chapel's own looks
  (catalog.ts, the theme `scourge`): its gilt candlesticks, lit, its pews with the Order's cloth, the vestry cupboard
  (the vestry chest's look), the bookshelf, the copyist's desk with the register open on it.
- Laid on the floor (`rug`, `rug_small`, `stair`, `steps`): the rug under the desk and the shelf, a smaller one under the
  cupboard, the stair down to the undercroft in its stone frame, the two steps up to the raised apse (catalog.ts `scchapel_*`, chapter2.ts lays them).
- The walls (Buildings/ScourgeChapelWalls.png, `walls`): the chapel's own walls (`scchapel_shell`, drawn bare by
  tools/src/art/arch) four times as large, and on them, as the mock-up hangs them, the great window and the lancets,
  the retable of the Post standing proud behind the altar, the Order's banners of the cross and of the scourge.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts scchapel_shell
    python3 games/openworld/tools/src/art/scourge-chapel.py
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
OUT = 'Fixtures/ScourgeChapel.png'
RUG_OUT = 'Fixtures/ScourgeChapelRug.png'
RUG_SMALL_OUT = 'Fixtures/ScourgeChapelRugSmall.png'
STAIR_OUT = 'Fixtures/ScourgeChapelStair.png'
STEPS_OUT = 'Fixtures/ScourgeChapelSteps.png'
WALLS_OUT = 'Buildings/ScourgeChapelWalls.png'
SHELL = 'Buildings/scchapel_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/scourge-chapel.json'
T = 16
K = 4
P = T * K


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


OWN, EXTRAS = sheet(ART / 'scourge-chapel/sheet.png'), sheet(ART / 'scourge-chapel/extras.png')
FIRSTLIGHT, REST = sheet(ART / 'firstlight-chapel/sheet.png'), sheet(ART / 'rest-chapel/sheet.png')


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
    'retable': taken(OWN, (78, 30, 590, 437), 102),
    'altar': taken(OWN, (608, 198, 1000, 434), 84),
    'candle': taken(OWN, (1035, 118, 1111, 426), 11),
    'stair': taken(OWN, (1252, 206, 1447, 405), 30),
    'pew': taken(OWN, (348, 490, 663, 629), 56),
    'cupboard': taken(OWN, (73, 510, 294, 851), 36),
    'banner_small': taken(OWN, (1120, 484, 1281, 750), 11),
    'banner_cross': taken(OWN, (1120, 484, 1281, 750), 24),
    'banner_scourge': taken(OWN, (1302, 484, 1465, 750), 26),
    'square_cross': taken(OWN, (1120, 782, 1282, 953), 20),
    # the register's desk and the windows
    'desk': taken(EXTRAS, (130, 246, 593, 751), 36),
    'window_big': taken(EXTRAS, (778, 113, 1185, 763), 30),
    'lancet': taken(EXTRAS, (1382, 243, 1542, 751), 14),
    # Firstlight's bookshelf, the Rest's rug
    'bookshelf': taken(FIRSTLIGHT, (948, 557, 1139, 794), 32),
    'rug': taken(REST, (1074, 656, 1432, 850), 60),
    'rug_small': taken(REST, (1074, 656, 1432, 850), 48),
}

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
# (game pixels). The altar's cell is the west middle one of its four, so its middle is half a cell east.
THINGS = {'altar': (T / 2, -3), 'candle': (0, 1), 'pew': (0, -2), 'cupboard': (0, 8), 'bookshelf': (9, -3), 'desk': (-5, -2)}
x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[n].width + 2 for n in THINGS), max(PIECE[n].height for n in THINGS))), {}
for name, (east, foot) in THINGS.items():
    img = PIECE[name]
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)


# ------------------------------------------------------------------------------------------------ on the floor
def floor_piece(name: str, tw: int, th: int, at: tuple[float, float]) -> Image.Image:
    """`tw` by `th` cells, the piece's middle at `at` (game pixels from the top left)."""
    img = hard(PIECE[name])
    canvas = Image.new('RGBA', (tw * P, th * P))
    canvas.alpha_composite(img, (round(at[0] * K - img.width / 2), round(at[1] * K - img.height / 2)))
    return canvas


# the rug under the desk and the shelf: five cells by three from (5, 14), its middle at (7.2, 15.2)
floor_piece('rug', 5, 3, (2.2 * T, 1.2 * T)).save(LSW / RUG_OUT, optimize=True)
# the small one under the cupboard: four cells by four from (2, 17), its middle at (3.6, 19.5)
floor_piece('rug_small', 4, 4, (1.6 * T, 2.5 * T)).save(LSW / RUG_SMALL_OUT, optimize=True)
# the stair: three cells by three about the stair's own cell
floor_piece('stair', 3, 3, (1.5 * T, 1.5 * T)).save(LSW / STAIR_OUT, optimize=True)


# the apse raised over the nave, as the user drew it (scourge-chapel/steps.png): the platform's edge halfway down its last
# row and two steps down from it to the nave, the lower a little wider, the runner laid up over them. Ten cells by four
# from the apse's west wall (10, 11); the bands in game pixels from the top
STEPS_TILES = (10, 4)
EDGE, UPPER, URISER, LOWER, LRISER, LINE, SHADOW = (122, 114, 107), (240, 236, 230), (178, 170, 162), (226, 220, 212), (152, 144, 136), (92, 86, 82), (0, 0, 0)
CARPET, CARPET_GOLD = (167, 47, 57), (244, 215, 132)
CARPET_SHADE, GOLD_SHADE = (118, 33, 40), (186, 158, 92)


def steps() -> Image.Image:
    tw, th = STEPS_TILES
    a = np.zeros((th * P, tw * P, 4), np.uint8)

    def band(x0: float, x1: float, y0: float, y1: float, rgb: tuple[int, int, int], alpha: int = 255) -> None:
        a[round(y0 * K):round(y1 * K), round(x0 * K):round(x1 * K)] = (*rgb, alpha)

    def sides(x0: float, x1: float, y0: float, y1: float, rgb: tuple[int, int, int]) -> None:
        """A band at the apse's west side and its fellow at the east, the canvas mirrored about its middle."""
        band(x0, x1, y0, y1, rgb)
        band(tw * T - x1, tw * T - x0, y0, y1, rgb)

    W0, W1 = 1 * T, 9 * T  # the apse's floor, wall to wall
    O0, O1 = 0.6 * T, 9.4 * T  # the lower step, a little wider, out into the nave
    # the platform's sides: its edge stepping down to each side wall, from the apse's head to its front
    # (clear of the pilasters at the apse's corners, three pixels either side of the wall's line)
    sides(W0 + 3, W0 + 6, 0, 41, URISER)
    sides(W0 + 6, W0 + 10, 0, 37, UPPER)
    sides(W0 + 10, W0 + 11, 0, 37, EDGE)
    # its front: the edge, the upper step, its riser, the lower step, its riser, the line where it meets the floor, a shadow
    band(W0, W1, 36, 37, EDGE)
    band(W0, W1, 37, 41, UPPER)
    band(W0, W1, 41, 45, URISER)
    band(O0, O1, 45, 49, LOWER)
    band(O0, O1, 49, 53, LRISER)
    band(O0, O1, 53, 54, LINE)
    for i, al in enumerate((80, 50, 24)):
        band(O0, O1, 54 + i, 55 + i, SHADOW, al)
    # the lower step's ends, and their shadow on the floor
    sides(O0, O0 + 1, 45, 54, LINE)
    sides(O0 - 2, O0, 45, 56, SHADOW)
    a[round(45 * K):round(56 * K), round((O0 - 2) * K):round(O0 * K), 3] = 50
    a[round(45 * K):round(56 * K), round(O1 * K):round((O1 + 2) * K), 3] = 50
    # the runner up over them (the nave's own carpet below the platform's row, the risers' shade over it)
    cx0, cx1 = 4 * T, 6 * T
    band(cx0, cx1, 36, 48, CARPET)
    band(cx0, cx0 + 1, 36, 48, CARPET_GOLD)
    band(cx1 - 1, cx1, 36, 48, CARPET_GOLD)
    band(cx0, cx1, 41, 45, CARPET_SHADE)
    band(cx0, cx0 + 1, 41, 45, GOLD_SHADE)
    band(cx1 - 1, cx1, 41, 45, GOLD_SHADE)
    a[round(48 * K):round(56 * K), round(cx0 * K):round(cx1 * K)] = 0
    band(cx0, cx1, 49, 53, SHADOW, 90)
    return Image.fromarray(a)


steps().save(LSW / STEPS_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['scchapel_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
# (the white stone a shade darker than the arch's, as the user asked)
_w = np.array(walls)
_w[..., :3] = (_w[..., :3].astype(float) * 0.9).round().astype(np.uint8)
walls = Image.fromarray(_w)
by_row = {s['row']: s for s in shell['slices']}
TOP = 9
APSE_FACE = (2 + TOP) * T
NAVE_FACE = (5 + TOP) * T
WING_FACE = (8 + TOP) * T
MID = 15.0


def lay(img: Image.Image, s: dict, mx: float, my: float) -> None:
    sx = round((s['x'] + mx - s['col'] * T) * K)
    sy = round((s['y'] + my - (s['row'] - s['th'] + 1) * T) * K)
    x0, y0 = s['x'] * K, s['y'] * K
    assert x0 <= sx and y0 <= sy and sx + img.width <= x0 + s['tw'] * T * K and sy + img.height <= y0 + s['th'] * T * K, f'off the strip of row {s["row"]}'
    region = walls.crop((sx, sy, sx + img.width, sy + img.height))
    over = Image.alpha_composite(region, img)
    mask = Image.fromarray(((np.array(region)[..., 3] > 0) * 255).astype(np.uint8))
    walls.paste(over, (sx, sy), mask)


def shadow_of(img: Image.Image) -> Image.Image:
    a = np.array(img)
    out = np.zeros_like(a)
    out[..., 3] = (a[..., 3].astype(float) * 0.34).astype(np.uint8)
    pad = Image.new('RGBA', (img.width + 6, img.height + 8))
    pad.alpha_composite(Image.fromarray(out), (6, 8))
    return pad


def both(d: float) -> list[float]:
    """A place west of the middle and its fellow east of it."""
    return [MID - d, MID + d]


# (the piece, the face, its middle in cells, its foot over the floor in game pixels, whether it stands proud), as the
# mock-up hangs them
HUNG = [
    # the apse: the great window over the retable of the Post, a lancet either side, a small banner of the cross
    # between the retable and each corner
    ('window_big', APSE_FACE, MID, 84, False),
    *[('lancet', APSE_FACE, m, 84, False) for m in both(3.05)],
    *[('banner_small', APSE_FACE, m, 34, False) for m in both(3.5)],
    ('retable', APSE_FACE, MID, 2, True),
    # the nave's north walls either side of the apse: two lancets, under the one the banner of the scourge, under the
    # other the square of the cross
    # (a cell lower than the apse's, their sills on the string course, as the user asked)
    *[('lancet', NAVE_FACE, m, 69, False) for d in (9.06, 5.53) for m in both(d)],
    *[('banner_scourge', NAVE_FACE, m, 22, False) for m in both(9.0)],
    *[('square_cross', NAVE_FACE, m, 36, False) for m in both(5.82)],
    # the side chapels: two lancets and a banner of the cross under them
    *[('lancet', WING_FACE, m, 72, False) for d in (12.55, 11.0) for m in both(d)],
    *[('banner_cross', WING_FACE, m, 20, False) for m in both(11.78)],
]
for name, face, mid, z, proud in HUNG:
    img = hard(PIECE[name])
    mx, my = mid * T - img.width / K / 2, face - z - img.height / K
    row = face // T - 1
    if proud:
        lay(shadow_of(img), by_row[row], mx, my)
        lay(img, by_row[row + 1], mx, my)
    lay(img, by_row[row], mx, my)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'rug': {'img': f'lsw/{RUG_OUT}', 'tw': 5, 'th': 3, 'pixelsPerTile': P},
    'rug_small': {'img': f'lsw/{RUG_SMALL_OUT}', 'tw': 4, 'th': 4, 'pixelsPerTile': P},
    'stair': {'img': f'lsw/{STAIR_OUT}', 'tw': 3, 'th': 3, 'pixelsPerTile': P},
    'steps': {'img': f'lsw/{STEPS_OUT}', 'tw': STEPS_TILES[0], 'th': STEPS_TILES[1], 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
