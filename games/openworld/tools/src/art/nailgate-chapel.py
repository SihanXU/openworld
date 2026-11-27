"""Nailgate's Chapel of the Nail (nailgate.chapel) as the user drew it (2026-11-25): their sheet
(nailgate-chapel/sheet.png) and mock-up (nailgate-chapel/ref.png); what the sheet has not, the earlier ones' as the user
asked: the candelabra the Rest's chapel's (rest-chapel/sheet.png), the small banners of the cross the Scourging House's
(scourge-chapel/sheet.png), the runner drawn as the Rest's is. Taken as painted, only made smaller, at four pixels to
the game's one.

- The things (Fixtures/NailgateChapel.png, client/src/nailgate-chapel.json `pieces`), each drawn where it stands by its
  id (catalog.ts placedSprites): the altar of the Nail, the man nailed to the tree over it, the nail in its case laid on
  it; the candelabra, lit; the chronicle open on its desk with the quill; Nessa's tables, her papers weighted with
  stones; the sexton's forge and his anvil with the hammer and the quench bucket; the box of
  nails, open; the lamp-keepers' chest with a grave-lamp and a cloth on it; the two cots, one patched, one worn (and
  the same at a room's bed's size, `poor_cot_*`, the beds of the world's poorest rooms: catalog.ts, the theme `poor`).
- The posts (`post_*`): doorposts bristling with nails, one either side of the runner (catalog.ts `ngchapel_post_*`,
  each standing on its cell).
- On the floor (`floor`, over the hall and the way in from (2, 8)): the boards a shade darker than the game's own; the dais the altar and the candelabra stand on, dark wood; the
  runner down from it to the way in.
- The walls (Buildings/NailgateChapelWalls.png, `walls`): the chapel's own walls (`ngchapel_shell`, its windows the
  arch's, drawn by tools/src/art/arch) four times as large, and on them, as the mock-up hangs them, a banner of the cross
  either side of the altar with a lamp hung under it, the shelves under the windows, books and jars.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts ngchapel_shell
    python3 games/openworld/tools/src/art/nailgate-chapel.py
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
OUT = 'Fixtures/NailgateChapel.png'
POSTS_OUT = 'Fixtures/NailgateChapelPost{}.png'
FLOOR_OUT = 'Fixtures/NailgateChapelFloor.png'
WALLS_OUT = 'Buildings/NailgateChapelWalls.png'
SHELL = 'Buildings/ngchapel_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/nailgate-chapel.json'
T = 16
K = 4
P = T * K


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


OWN, REST, SCOURGE = sheet(ART / 'nailgate-chapel/sheet.png'), sheet(ART / 'rest-chapel/sheet.png'), sheet(ART / 'scourge-chapel/sheet.png')
# the anvil as the user cut it again from the sheet (2026-11-25)
ANVIL = sheet(ART / 'nailgate-chapel/anvil.png')


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
    'altar': taken(OWN, (33, 34, 417, 628), 57.5),
    'plaque': taken(OWN, (433, 187, 682, 358), 27),
    'chronicle': taken(OWN, (698, 140, 1033, 422), 40),
    'tables': taken(OWN, (1055, 92, 1509, 418), 55),
    'forge': taken(OWN, (420, 381, 621, 659), 27),
    'anvil': taken(ANVIL, (159, 198, 1126, 1044), 30.5),
    'nails': taken(OWN, (836, 458, 1028, 676), 21.6),
    'lampchest': taken(OWN, (1045, 445, 1294, 676), 35),
    'lantern': taken(OWN, (1319, 476, 1422, 641), 9),
    'cot_patched': taken(OWN, (53, 694, 257, 996), 26),
    'cot_worn': taken(OWN, (331, 700, 531, 994), 26),
    # the same two cots at a room's bed's size, for the poorest rooms of the world (catalog.ts, the theme `poor`)
    'poor_cot_patched': taken(OWN, (53, 694, 257, 996), 20),
    'poor_cot_worn': taken(OWN, (331, 700, 531, 994), 20),
    'post_w': taken(OWN, (591, 680, 709, 995), 11.7),
    'post_e': taken(OWN, (780, 680, 892, 994), 11.7),
    'shelf_books': taken(OWN, (935, 733, 1209, 916), 26),
    'shelf_jars': taken(OWN, (1239, 733, 1513, 916), 26),
    # the earlier sheets': the candelabra, the small banner of the cross
    'candelabrum': taken(REST, (1193, 144, 1323, 402), 14),
    'banner': taken(SCOURGE, (1120, 484, 1281, 750), 14),
}


def over(base: str, top: str, cx: float, ty: float) -> Image.Image:
    """`top` laid on `base`, its middle at `cx` of the base's width and its top at `ty` of its height."""
    b, t = PIECE[base].copy(), PIECE[top]
    b.alpha_composite(t, (round(b.width * cx - t.width / 2), round(b.height * ty)))
    return b


# the altar with the nail in its case laid on it, over the crucified man's feet, as the mock-up sets it
PIECE['altar'] = over('altar', 'plaque', 0.5, 0.53)

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
# (game pixels), each where the mock-up has it; the forge on its own cell's middle, so that the glow the game gives a lit
# thing there is on its fire, the anvil half a cell east of the mock-up's to leave it room
THINGS = {
    'altar': (8, -4), 'candelabrum': (-8, 0), 'chronicle': (-7, 8), 'tables': (3, -4),
    'forge': (0, -6), 'anvil': (0, 5), 'nails': (0, 0), 'lampchest': (2, 0),
    'cot_patched': (6, 2), 'cot_worn': (-6, 2),
    # (as the rooms' own beds stand: on the cell's middle, a pixel over its foot)
    'poor_cot_patched': (0, -1), 'poor_cot_worn': (0, -1),
}
x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[n].width + 2 for n in THINGS), max(PIECE[n].height for n in THINGS))), {}
for name, (east, foot) in THINGS.items():
    img = PIECE[name]
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)

# the posts: each two cells by three, its middle at x and its foot at y (game pixels from the canvas's top left)
POSTS = {
    'w': ('post_w', (0.84 * T, 2.8 * T)),   # from (6, 11), standing on (6, 13)
    'e': ('post_e', (1.2 * T, 2.8 * T)),    # from (10, 11), on (11, 13)
}
posts = {}
for key, (name, (mx, fy)) in POSTS.items():
    img = hard(PIECE[name])
    canvas = Image.new('RGBA', (2 * P, 3 * P))
    canvas.alpha_composite(img, (round(mx * K - img.width / 2), round(fy * K - img.height)))
    out = POSTS_OUT.format(key.upper())
    canvas.save(LSW / out, optimize=True)
    posts[key] = {'img': f'lsw/{out}', 'tw': 2, 'th': 3, 'pixelsPerTile': P}

# ------------------------------------------------------------------------------------------------ on the floor
# the hall and the way in, fourteen cells by nine from (2, 8); places in the map's cells
FX, FY, FW, FH = 2, 8, 14, 9
WOOD, PLANK, LIP, RISER = (92, 58, 36), (78, 48, 30), (132, 88, 52), (64, 40, 26)
BOARD, BOARD_JOINT = (214, 184, 138), (196, 166, 122)
RED, WEAVE, GOLD, GOLD_DIM, DARK = (150, 38, 40), (134, 32, 35), (218, 168, 74), (176, 124, 50), (74, 18, 22)


def floor() -> Image.Image:
    a = np.zeros((FH * P, FW * P, 4), np.uint8)
    yy, xx = np.mgrid[0:FH * P, 0:FW * P]
    gx, gy = xx / K / T + FX, yy / K / T + FY  # cells

    def box(x0: float, x1: float, y0: float, y1: float) -> np.ndarray:
        return (gx >= x0) & (gx < x1) & (gy >= y0) & (gy < y1)

    def paint(mask: np.ndarray, rgb: tuple[int, int, int], alpha: int = 255) -> None:
        a[mask] = (*rgb, alpha)

    # the boards a shade darker than the game's wooden floor (238, 207, 155), as the user asked: long boards half a cell
    # wide, their joints faint, on the hall's and the way in's cells (the plan's)
    boards = box(2, 16, 8, 15) | box(7, 11, 15, 17)
    bx, by = gx * T, gy * T  # game pixels
    paint(boards, BOARD)
    paint(boards & ((by % 8 < 0.5) | (((bx + (by // 8 % 3) * 11) % 32) < 0.5)), BOARD_JOINT)

    # the dais: dark boards, a lit lip, a riser, a shadow on the floor
    x0, x1, front = 6.55, 11.45, 9.15
    paint(box(x0, x1, FY, front), WOOD)
    paint(box(x0, x1, FY, front) & ((yy // K) % 5 == 0), PLANK)
    paint(box(x0, x1, front, front + 0.06), LIP)
    paint(box(x0, x1, front + 0.06, front + 0.2), RISER)
    paint(box(x0, x1, front + 0.2, front + 0.3), (0, 0, 0), 70)
    for xe in (x0, x1 - 0.06):
        paint(box(xe, xe + 0.06, FY, front + 0.2), RISER)
    # the runner from the dais down the hall and the way in to the door, as the Rest's: red, its weave, two lines of
    # gold, crosses down its middle
    rx0, rx1, ry0, ry1 = 7.85, 10.15, front + 0.2, 15.9
    r = box(rx0, rx1, ry0, ry1)
    u, v = ((gx - rx0) * T).astype(int), ((gy - ry0) * T).astype(int)
    inset = np.minimum(np.minimum(gx - rx0, rx1 - gx), np.minimum(gy - ry0, ry1 - gy)) * T
    paint(r, RED)
    paint(r & ((u % 4 == 0) | (v % 4 == 0)), WEAVE)
    paint(r & (inset >= 2) & (inset < 3), GOLD)
    paint(r & (inset >= 5) & (inset < 5.5), GOLD_DIM)
    cx = (rx0 + rx1) / 2
    for cy in [ry0 + (ry1 - ry0) * f for f in (0.14, 0.38, 0.62, 0.86)]:
        dx, dy = np.abs(gx - cx) * T, np.abs(gy - cy) * T
        paint(r & (dx + dy >= 9) & (dx + dy < 9.5), GOLD)
        paint(r & (dx < 1) & (dy < 5), GOLD)
        paint(r & (dy < 1) & (dx < 3.75), GOLD)
    paint(r & (inset < 1), DARK)
    return Image.fromarray(a)


floor().save(LSW / FLOOR_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['ngchapel_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
by_row = {s['row']: s for s in shell['slices']}
FACE = (3 + 5) * T
MID = 9.0


def lay(img: Image.Image, s: dict, mx: float, my: float) -> None:
    sx = round((s['x'] + mx - s['col'] * T) * K)
    sy = round((s['y'] + my - (s['row'] - s['th'] + 1) * T) * K)
    x0, y0 = s['x'] * K, s['y'] * K
    assert x0 <= sx and y0 <= sy and sx + img.width <= x0 + s['tw'] * T * K and sy + img.height <= y0 + s['th'] * T * K, f'off the strip of row {s["row"]}'
    region = walls.crop((sx, sy, sx + img.width, sy + img.height))
    over_ = Image.alpha_composite(region, img)
    mask = Image.fromarray(((np.array(region)[..., 3] > 0) * 255).astype(np.uint8))
    walls.paste(over_, (sx, sy), mask)


def both(d: float) -> list[float]:
    """A place west of the middle and its fellow east of it."""
    return [MID - d, MID + d]


# (the piece, its middle in cells, its foot over the floor in game pixels), as the mock-up hangs them on the north wall:
# the arch puts a window every other cell (3, 5, 7, 9, 11, 13, 15); the altar's retable hides the one at 9, a banner over
# the rail each of those at 7 and 11, a lamp hung under it, and the four the mock-up has keep a shelf under them
HUNG = [
    *[('banner', m, 39) for m in both(2.0)],
    *[('lantern', m, 12) for m in both(2.0)],
    *[('shelf_books', m, 13) for m in both(6.0)],
    *[('shelf_jars', m, 13) for m in both(4.0)],
]
for name, mid, z in HUNG:
    img = hard(PIECE[name])
    lay(img, by_row[FACE // T - 1], mid * T - img.width / K / 2, FACE - z - img.height / K)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'posts': posts,
    'floor': {'img': f'lsw/{FLOOR_OUT}', 'tw': FW, 'th': FH, 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
