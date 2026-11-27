"""The Church of Whiteveil (whiteveil.church) as the user drew it (2026-11-25): their sheet (whiteveil-church/sheet.png),
the drapes (whiteveil-church/drapes.png), the windows (whiteveil-church/windows.png) and the mock-up
(whiteveil-church/ref.png); what the sheet has not, the earlier ones' as the user asked: the candelabra the Rest's
chapel's (rest-chapel/sheet.png), the pews the Chapel of the Pillar's (its own look, catalog.ts the theme `whiteveil`). Taken as
painted, only made smaller, at four pixels to the game's one.

- The things (Fixtures/WhiteveilChurch.png, client/src/whiteveil-church.json `pieces`), each drawn where it stands by its
  id (catalog.ts placedSprites): the altar of Whiteveil, the robed dead lying side by side carved on its face, the lance
  on its retable; the candelabra, lit; the two statues of Astra with the lance; the lilies in their urns; the chest under
  its white cloth that keeps the Stole of the Elect.
- The stair down (`stair`): the arch over the way down to the catacombs, its lamps lit, standing on the stair's cell in
  the east chapel (catalog.ts `wvchurch_stair`).
- On the floor (`floor`, from (7, 11)): the apse's green stone come forward two steps into the nave between the statues,
  the slab with its two grates before the altar, over the air of the catacombs.
- The walls (Buildings/WhiteveilChurchWalls.png, `walls`): the church's own walls (`wvchurch_shell`, drawn bare by
  tools/src/art/arch) four times as large, and on them, as the mock-up hangs them, the great window of the lance and the
  lancets, the white drapes from their gilt knobs, the banners of the lance.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts wvchurch_shell
    python3 games/openworld/tools/src/art/whiteveil-church.py
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
OUT = 'Fixtures/WhiteveilChurch.png'
STAIR_OUT = 'Fixtures/WhiteveilChurchStair.png'
FLOOR_OUT = 'Fixtures/WhiteveilChurchFloor.png'
WALLS_OUT = 'Buildings/WhiteveilChurchWalls.png'
SHELL = 'Buildings/wvchurch_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/whiteveil-church.json'
T = 16
K = 4
P = T * K


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


DIR = ART / 'whiteveil-church'
OWN, DRAPES, WINDOWS = sheet(DIR / 'sheet.png'), sheet(DIR / 'drapes.png'), sheet(DIR / 'windows.png')
REST = sheet(ART / 'rest-chapel/sheet.png')


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
    'altar': taken(OWN, (101, 39, 671, 525), 88),
    'statue': taken(OWN, (916, 57, 1112, 538), 31),
    'swag': taken(OWN, (1125, 63, 1480, 318), 44),
    'stair': taken(OWN, (707, 557, 1019, 987), 38),
    'slab': taken(OWN, (1062, 580, 1483, 709), 68),
    'banner_a': taken(OWN, (58, 585, 222, 899), 27),
    'banner_b': taken(OWN, (238, 587, 400, 910), 27),
    'chest': taken(OWN, (409, 703, 681, 888), 34),
    'lilies_a': taken(OWN, (1065, 746, 1187, 955), 14),
    'lilies_b': taken(OWN, (1207, 746, 1336, 955), 14),
    # the drapes, a knob at the window's side of each
    'drape_w': taken(DRAPES, (50, 123, 571, 903), 40),
    'drape_e': taken(DRAPES, (964, 123, 1485, 903), 40),
    # the windows
    'window_big': taken(WINDOWS, (392, 60, 797, 971), 34),
    'lancet': taken(WINDOWS, (964, 303, 1128, 971), 11),
    'lancet_small': taken(WINDOWS, (964, 303, 1128, 971), 10),
    # the Rest's candelabra: the tall ones by the altar, the small one in the west chapel
    'candelabrum': taken(REST, (1193, 144, 1323, 402), 19),
    'candles': taken(REST, (1193, 144, 1323, 402), 12),
}

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
# (game pixels), each where the mock-up has it. The altar's cell is the west middle one of its, so its middle is half a
# cell east; the candelabra a little in toward it; the lilies by the statues out from them; the urn behind the chest
# stands back against the wall
THINGS = {
    'altar': (T / 2, 0), 'candelabrum_w': (2, 0), 'candelabrum_e': (-2, 0), 'statue': (3, 2),
    'lilies_w': (-2, 3), 'lilies_e': (3, 3), 'lilies_back': (2, 13), 'chest': (2, 0), 'candles': (5, 0),
}
PIECE['candelabrum_w'] = PIECE['candelabrum_e'] = PIECE['candelabrum']
PIECE['lilies_w'], PIECE['lilies_e'], PIECE['lilies_back'] = PIECE['lilies_a'], PIECE['lilies_b'], PIECE['lilies_a']
x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[n].width + 2 for n in THINGS), max(PIECE[n].height for n in THINGS))), {}
for name, (east, foot) in THINGS.items():
    img = PIECE[name]
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)

# the stair down: three cells by four from (25, 14), the arch's middle at the stair's cell's (26, 17) and its foot on the
# bottom of it
stair = hard(PIECE['stair'])
canvas = Image.new('RGBA', (3 * P, 4 * P))
canvas.alpha_composite(stair, (round(1.5 * P - stair.width / 2), 4 * P - stair.height))
canvas.save(LSW / STAIR_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ on the floor
# sixteen cells by five from (7, 11): the apse (11..18, rows 11..13) and the nave's first row; places in the map's cells
FX, FY, FW, FH = 7, 11, 16, 5
TOP, GROUT, LIP, RISER, LINE = (150, 158, 146), (128, 136, 124), (182, 188, 176), (112, 120, 108), (70, 74, 66)
W_TOP, W_GROUT, W_RISER = (236, 234, 230), (212, 208, 204), (190, 186, 182)
CARPET = (14.0, 16.0)  # the runner's columns


def floor() -> Image.Image:
    a = np.zeros((FH * P, FW * P, 4), np.uint8)
    yy, xx = np.mgrid[0:FH * P, 0:FW * P]
    gx, gy = xx / P + FX, yy / P + FY

    def box(x0: float, x1: float, y0: float, y1: float) -> np.ndarray:
        return (gx >= x0) & (gx < x1) & (gy >= y0) & (gy < y1)

    def paint(mask: np.ndarray, rgb: tuple[int, int, int], alpha: int = 255) -> None:
        a[mask] = (*rgb, alpha)

    off = np.zeros_like(gx, bool)

    # the statues' plinths either side: white stone a step over the nave, its lip, its riser
    for x0, x1 in ((8.0, 10.6), (19.4, 22.0)):
        paint(box(x0, x1, 14, 14.8), W_TOP)
        paint(box(x0, x1, 14, 14.8) & (((gx * T) % 16 < 0.5) | ((gy * T) % 8 < 0.5)), W_GROUT)
        paint(box(x0, x1, 14.8, 14.95), W_RISER)
        paint(box(x0, x1, 14.95, 15.0), LINE)
        paint(box(x0, x1, 15.0, 15.1), (0, 0, 0), 50)
        for xe in (x0, x1 - 0.06):
            paint(box(xe, xe + 0.06, 14, 14.95), W_RISER)

    # the apse's green stone come forward into the nave, two steps down to it, the lower a little wider
    for (x0, x1), front, rgb in (((10.6, 19.4), 15.05, RISER), ((11.0, 19.0), 14.55, TOP)):
        top = box(x0, x1, 14, front) & ~off
        paint(top, TOP)
        paint(top & (((gx * T + 8) % 16 < 0.5) | ((gy * T) % 8 < 0.5)), GROUT)
        paint(box(x0, x1, front - 0.06, front) & ~off, LIP)
        paint(box(x0, x1, front, front + 0.18) & ~off, RISER)
        paint(box(x0, x1, front + 0.18, front + 0.24) & ~off, LINE)
        for xe in (x0, x1 - 0.08):
            paint(box(xe, xe + 0.08, 14, front + 0.24), LINE)
    # the runner begins under the lower step (chapter5.ts lays it from the nave's second row), a shadow on its head
    paint(box(*CARPET, 15.29, 15.4), (0, 0, 0), 50)

    # the slab before the altar, its two grates over the air of the catacombs, on the apse's last row
    slab = hard(PIECE['slab'])
    sx, sy = round((15.0 - FX) * P - slab.width / 2), round((13.5 - FY) * P - slab.height / 2)
    img = Image.fromarray(a)
    img.alpha_composite(slab, (sx, sy))
    return img


floor().save(LSW / FLOOR_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['wvchurch_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
by_row = {s['row']: s for s in shell['slices']}
TOP_ROWS = 9
APSE_FACE = (2 + TOP_ROWS) * T
NAVE_FACE = (5 + TOP_ROWS) * T
WING_FACE = (8 + TOP_ROWS) * T
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


def both(d: float) -> list[float]:
    """A place west of the middle and its fellow east of it."""
    return [MID - d, MID + d]


# (the piece, the face, its middle in cells, its foot over the floor in game pixels), as the mock-up hangs them; the
# west's drape and banner, and their fellows east
HUNG = [
    # the apse: the great window of the lance over the altar's retable, a lancet either side, the drapes from their
    # knobs beside the window swept out over the lancets' feet
    ('window_big', APSE_FACE, MID, 43),
    *[('lancet', APSE_FACE, m, 67) for m in both(3.0)],
    ('drape_w', APSE_FACE, MID - 2.6, 52),
    ('drape_e', APSE_FACE, MID + 2.6, 52),
    # the nave's north walls either side of the apse: a lancet high, the drape from the knob on the pilaster sweeping
    # down past it, the banner of the lance hung low under them
    *[('lancet', NAVE_FACE, m, 70) for m in both(8.75)],
    ('drape_w', NAVE_FACE, MID - 8.05, 58),
    ('drape_e', NAVE_FACE, MID + 8.05, 58),
    ('banner_a', NAVE_FACE, MID - 8.5, 8),
    ('banner_b', NAVE_FACE, MID + 8.5, 8),
    # the side chapels: two lancets, the swag between their pilasters under them (two cells higher than the mock-up's, as
    # the user asked)
    *[('lancet_small', WING_FACE, m, 45 + 2 * T) for d in (12.05, 10.75) for m in both(d)],
    *[('swag', WING_FACE, m, 6 + 2 * T) for m in both(11.4)],
]
# the drapes and swags hang from knobs on the pilasters, which stand proud of the wall in the strip of the row before
# it: laid there too, over them
OVER_PILASTERS = {'drape_w', 'drape_e', 'swag'}
for name, face, mid, z in HUNG:
    img = hard(PIECE[name])
    mx, my = mid * T - img.width / K / 2, face - z - img.height / K
    row = face // T - 1
    lay(img, by_row[row], mx, my)
    if name in OVER_PILASTERS:
        lay(img, by_row[row + 1], mx, my)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'stair': {'img': f'lsw/{STAIR_OUT}', 'tw': 3, 'th': 4, 'pixelsPerTile': P},
    'floor': {'img': f'lsw/{FLOOR_OUT}', 'tw': FW, 'th': FH, 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
