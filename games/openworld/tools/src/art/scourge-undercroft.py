"""The Scourging House's undercroft (scourgehouse.undercroft) as the user drew it (2026-11-25): their sheet
(scourge-undercroft/sheet.png) and mock-up (scourge-undercroft/ref.png). Taken as painted, only made smaller, at four
pixels to the game's one; the candelabra the Rest's chapel's (rest-chapel.py).

- The things (Fixtures/ScourgeUndercroft.png, client/src/scourge-undercroft.json `pieces`), the map's own looks
  (catalog.ts, the theme `undercroft`): the bare stone altar, the grey brother's bones sprawled in his cloak (the sets'
  bones), the tombstone of the scourge, the amphora (the pot), the candelabra either side of the altar, lit; the
  channels' own cells drawn by nothing, the floor's picture drawing them (`red_channel`).
- The font of blood (`font`): a picture standing on its cell (catalog.ts `scundercroft_font`).
- On the floor (`floor`, over the hall, the apse and the landing from (3, 6)): the mock-up's dark flagstones, the red channels, from the altar's foot down the hall's
  middle and branching west three times to the drains in the west wall, their corners turned; the drains, the blood
  run out of them and down the wall; the blood spilt by the font, the bowls, the amphora, the stone and the bones; two
  small bowls; stones fallen from the vault.
- The walls (Buildings/ScourgeUndercroftWalls.png, `walls`): the undercroft's own walls (`scundercroft_shell`, drawn bare
  by tools/src/art/arch) four times as large and a shade darker, and on them, as the mock-up hangs them, the Order's
  banner of the scourge over the altar between two arched niches, a niche and a torch on the hall's wall either side.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts scundercroft_shell
    python3 games/openworld/tools/src/art/scourge-undercroft.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ART = Path(__file__).resolve().parent
GAME = Path(__file__).resolve().parents[3]
LSW = GAME / 'public/assets/lsw'
OUT = 'Fixtures/ScourgeUndercroft.png'
FONT_OUT = 'Fixtures/ScourgeUndercroftFont.png'
FLOOR_OUT = 'Fixtures/ScourgeUndercroftFloor.png'
WALLS_OUT = 'Buildings/ScourgeUndercroftWalls.png'
SHELL = 'Buildings/scundercroft_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/scourge-undercroft.json'
T = 16
K = 4
P = T * K


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


OWN, REST = sheet(ART / 'scourge-undercroft/sheet.png'), sheet(ART / 'rest-chapel/sheet.png')


def taken(src: Image.Image, box: tuple[int, int, int, int], width: float, specks: bool = False) -> Image.Image:
    """The piece in `box` (its stray specks dropped, unless it is made of them), made `width` game pixels wide."""
    p = np.array(src.crop(box))
    lab, n = ndimage.label(p[..., 3] > 0)
    if n > 1 and not specks:
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
    'niche': taken(OWN, (60, 105, 311, 459), 21),
    'niche_small': taken(OWN, (60, 105, 311, 459), 19),
    'altar': taken(OWN, (335, 241, 657, 459), 35),
    'tomb': taken(OWN, (674, 111, 902, 459), 22),
    'banner': taken(OWN, (921, 89, 1190, 458), 28),
    'font': taken(OWN, (133, 506, 396, 788), 26),
    'bowl': taken(OWN, (423, 613, 606, 754), 16),
    'amphora': taken(OWN, (647, 494, 849, 788), 20),
    'bones': taken(OWN, (882, 575, 1446, 776), 38),
    'blood_big': taken(OWN, (100, 830, 445, 975), 26, specks=True),
    'blood': taken(OWN, (480, 840, 700, 962), 16, specks=True),
    'blood_small': taken(OWN, (780, 855, 935, 942), 10, specks=True),
    'torch': taken(OWN, (529, 1052, 623, 1251), 8),
    'drain': taken(OWN, (894, 1065, 991, 1238), 13),
    'rubble': taken(OWN, (1016, 845, 1186, 947), 14),
    'rubble_small': taken(OWN, (1271, 868, 1414, 942), 11, specks=True),
    'candelabrum': taken(REST, (1193, 144, 1323, 402), 13),
}

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
# (game pixels), each where the mock-up has it
THINGS = {'altar': (-8, -3), 'bones': (0, 6), 'tomb': (-8, -4), 'amphora': (2, 0), 'candelabrum': (0, 2)}
x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[n].width + 2 for n in THINGS), max(PIECE[n].height for n in THINGS))), {}
for name, (east, foot) in THINGS.items():
    img = PIECE[name]
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
# (the channels' own cells: drawn by the floor's picture, so by nothing of their own)
pieces['nothing'] = {'x': 0, 'y': cut.height - 1, 'w': 1, 'h': 1, 'ax': 0, 'ay': 1}
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)


def standing(name: str, tw: int, th: int, at: tuple[float, float]) -> Image.Image:
    """`tw` by `th` cells, the piece's middle at x and its foot at y of `at` (game pixels from the top left)."""
    img = hard(PIECE[name])
    canvas = Image.new('RGBA', (tw * P, th * P))
    canvas.alpha_composite(img, (round(at[0] * K - img.width / 2), round(at[1] * K - img.height)))
    return canvas


# the font of blood: two cells by three from (14, 9), standing on (15, 11), its middle at x 15.2 and its foot at y 11.6
standing('font', 2, 3, (1.2 * T, 2.6 * T)).save(LSW / FONT_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ on the floor
# the hall, the apse and the landing, twenty cells by fifteen from (3, 6); places in the map's cells
FX, FY, FW, FH = 3, 6, 20, 15
floor = Image.new('RGBA', (FW * P, FH * P))


def px(cx: float, cy: float) -> tuple[float, float]:
    return (cx - FX) * P, (cy - FY) * P


# the floor the mock-up's: dark flagstones, each half a cell high and a cell long, every course set half a stone over,
# each stone a little lighter or darker than the next, their joints darker still; on the hall's, the apse's and the
# landing's cells (the plan's), but for the stair in its frame
FLOORS = [(3, 8, 20, 10), (9, 6, 8, 2), (11, 18, 4, 3)]
STAIR_HOLE = (12, 18, 13, 19)
STONE, JOINT = np.array([80, 82, 72]), np.array([54, 56, 49])


def flagstones() -> np.ndarray:
    H, W = FH * P, FW * P
    yy, xx = np.mgrid[0:H, 0:W]
    gx, gy = xx / K, yy / K  # game pixels
    course = (gy // 8).astype(int)
    sx = gx + (course % 2) * 8
    stone = (sx // 16).astype(int)
    jitter = ((stone * 73856093) ^ (course * 19349663)) % 13 - 6
    rgb = STONE[None, None, :] + jitter[..., None]
    joint = (gy % 8 < 1) | (sx % 16 < 1)
    rgb[joint] = JOINT
    lit = (gy % 8 >= 1) & (gy % 8 < 2) & ~joint
    rgb[lit] = rgb[lit] + 8
    a = np.zeros((H, W, 4), np.uint8)
    a[..., :3] = np.clip(rgb, 0, 255)
    inside = np.zeros((H, W), bool)
    for x, y, w, h in FLOORS:
        inside |= (gx >= (x - FX) * T) & (gx < (x - FX + w) * T) & (gy >= (y - FY) * T) & (gy < (y - FY + h) * T)
    x0, y0, x1, y1 = STAIR_HOLE
    inside &= ~((gx >= (x0 - FX) * T) & (gx < (x1 - FX) * T) & (gy >= (y0 - FY) * T) & (gy < (y1 - FY) * T))
    a[..., 3] = np.where(inside, 255, 0)
    # the stair's frame: a dark ring round its cell and a paler one inside it, as the mock-up sets it
    def ring(d: float, w: float, rgb: tuple[int, int, int]) -> None:
        r = (gx >= (x0 - FX) * T - d) & (gx < (x1 - FX) * T + d) & (gy >= (y0 - FY) * T - d) & (gy < (y1 - FY) * T + d)
        r &= ~((gx >= (x0 - FX) * T - d + w) & (gx < (x1 - FX) * T + d - w) & (gy >= (y0 - FY) * T - d + w) & (gy < (y1 - FY) * T + d - w))
        a[r] = (*rgb, 255)
    ring(5, 2, (46, 47, 41))
    ring(3, 3, (104, 104, 92))
    ring(0.75, 0.75, (40, 40, 36))
    return a


floor = Image.fromarray(flagstones())


# the channels: the trunk from the altar's foot down the middle, three branches west to the wall, each corner turned
TRUNK_X, TOP, BRANCHES, WEST, R = 13.0, 7.25, (9.55, 12.54, 16.66), 3.2, 0.35


def channel_paths() -> list[list[tuple[float, float]]]:
    paths = []
    last = BRANCHES[-1]
    paths.append([(TRUNK_X, TOP), (TRUNK_X, last - R)])
    for y in BRANCHES:
        arc = [(TRUNK_X - R + R * math.cos(t), y - R + R * math.sin(t)) for t in np.linspace(0, math.pi / 2, 8)]
        paths.append([*arc, (WEST, y)])
    return paths


# (cut a hand wide into the stone: a pale rim, the dark cut, the blood in it, its shine)
draw = ImageDraw.Draw(floor)
for width, colour in ((9, (122, 116, 104, 255)), (7, (34, 8, 10, 255)), (5, (132, 16, 22, 255)), (1.5, (196, 48, 50, 255))):
    for path in channel_paths():
        pts = [px(x, y - (0.05 if width < 2 else 0)) for x, y in path]
        draw.line(pts, fill=colour, width=round(width * K), joint='curve')
        for p in (pts[0], pts[-1]):
            r = width * K / 2
            draw.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=colour)


def put(name: str, cx: float, cy: float, foot: bool = False) -> None:
    """A piece laid on the floor, its middle at (cx, cy) in cells, or its foot there."""
    img = hard(PIECE[name])
    x, y = px(cx, cy)
    floor.alpha_composite(img, (round(x - img.width / 2), round(y - (img.height if foot else img.height / 2))))


# the drains in the west wall, a channel into each, the blood run out of them and down onto the floor
for y in BRANCHES:
    put('blood_small', 3.55, y + 0.55)
    img = hard(PIECE['drain'])
    x0, y0 = px(3.4, y)
    floor.alpha_composite(img, (round(x0 - img.width / 2), round(y0 - img.height * 0.42)))
# what was spilt: by the font, by the bowl, by the amphora, by the stone, round the bones, along the channels
for name, cx, cy in [('blood', 14.9, 11.75), ('blood_small', 15.8, 11.95), ('blood', 16.1, 15.4), ('blood_small', 20.3, 11.15),
                     ('blood_small', 11.6, 15.35), ('blood_big', 4.9, 14.75), ('blood_small', 8.6, 9.75), ('blood_small', 11.6, 12.75),
                     ('blood_small', 13.25, 8.2), ('blood_small', 14.3, 12.6), ('blood_small', 20.8, 16.4), ('blood_small', 6.2, 17.2)]:
    put(name, cx, cy)
# the bowls set down by the font and by the east pillars; the stones fallen from the vault in the corners
put('bowl', 16.18, 15.1, foot=True)
put('bowl', 14.1, 12.55, foot=True)
for name, cx, cy in [('rubble', 21.6, 8.6), ('rubble_small', 16.9, 8.5), ('rubble', 21.4, 17.3), ('rubble_small', 9.3, 17.4), ('rubble_small', 4.2, 8.6)]:
    put(name, cx, cy)
floor.save(LSW / FLOOR_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['scundercroft_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
# (the stone the mock-up's dark warm grey, well darker than the arch's, as the user asked: its colour taken out, a
# little warmth put in, and darkened; the pale pilasters stay paler than the walls between them)
_w = np.array(walls).astype(float)
_lum = _w[..., :3] @ np.array([0.299, 0.587, 0.114])
_w[..., :3] = np.clip(_lum[..., None] * np.array([1.0, 0.95, 0.88]) * 0.58, 0, 255)
walls = Image.fromarray(_w.round().astype(np.uint8))
by_row = {s['row']: s for s in shell['slices']}
TOP_ROWS = 5
APSE_FACE = (1 + TOP_ROWS) * T
HALL_FACE = (3 + TOP_ROWS) * T
MID = 13.0


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


# (the piece, the face, its middle in cells, its foot over the floor in game pixels), as the mock-up hangs them
HUNG = [
    ('banner', APSE_FACE, MID, 9),
    *[('niche', APSE_FACE, m, 12) for m in both(2.75)],
    *[('niche_small', HALL_FACE, m, 9) for m in both(8.46)],
    *[('torch', HALL_FACE, m, 28) for m in both(6.12)],
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
    'font': {'img': f'lsw/{FONT_OUT}', 'tw': 2, 'th': 3, 'pixelsPerTile': P},
    'floor': {'img': f'lsw/{FLOOR_OUT}', 'tw': FW, 'th': FH, 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
