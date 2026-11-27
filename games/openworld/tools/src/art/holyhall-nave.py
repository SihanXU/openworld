"""The nave of the Most Holy Hall (holyhall.nave) as the user drew it (2026-11-25), laid as their mock-up lays it
(holyhall-nave/ref.png; the first one, holyhall-nave/ref-first.png) on the nave's own plan (art/arch/plans.ts
HOLY_NAVE). Their sheets: the altar and its company (holyhall-nave/altar.png); the windows, the arcade and the candles
(holyhall-nave/windows.png); the crossing's channels, its star, the piers and a balustrade (holyhall-nave/crossing.png);
the candelabra, a rail and the font (holyhall-nave/rail.png); the choir's stalls and the slab, shut and lifted
(holyhall-nave/stalls.png); the side altar and its company (holyhall-nave/side-altar.png); the vestry's things and a
banner (holyhall-nave/vestry.png); the four chapels' altars in their niches (holyhall-nave/chapels.png). Taken as
painted, only made smaller, at four pixels to the game's one.

- The things (Fixtures/HolyNave.png, client/src/holyhall-nave.json `pieces`), each drawn where it stands by its id
  (catalog.ts placedSprites): the high altar; the statues on their plinths; the candelabra and the processional crosses
  either side of it, lit; the candles at the apse's wall, lit; the rail's two runs (the rail's other cells drawn by
  nothing); the stalls, the Primate's chair at the head of the east ones; the candelabra down the aisles, lit; the two
  fonts. In the west arm the vestry: its wardrobe, rack of vestments, vestment stand, chest and small box (the sets'
  chests, the Curia's pieces in them) and its table; in the east arm the side altar with its tabernacle, lilies either
  side, a kneeler; a banner on each arm's wall. The chapels' altars, each cut from
  its sheet where its kneeler's cushion begins, so one may stand between altar and kneeler: the swords and the chalice,
  the monstrance (its lectern out on the aisle), the lily and the book, the saint; the Second's reliquaries by the lower
  two. The slab over the stair, shut and lifted (`slab`, `slab_open`: its type's own look, catalog.ts
  `fixture:altar_slab`, lifted when it bears `open`).
- The piers (Fixtures/HolyNavePier.png, `pier`): one standing on the middle of the bottom row of three cells by five
  (catalog.ts `holynave_pier`, finale.ts lays four).
- On the floor (`floor`, laid as ground over the whole map, catalog.ts `holynave_floor`): the mock-up's floors — the
  sanctuary's grey stone and its wide lattice, the choir's darker, the transept's arms and their aisles red, the
  crossing's pale squares, the nave's dark stone, the chapels' and the narthex's pale stone, a pale kerb along every wall;
  the two steps in the rail's gap and the three down from the choir; the crimson runners; in the crossing the five
  lands' channels meeting (the sheet's own piece, as wide as the crossing), their stem up the steps narrowing to the
  runner's width under its gilt fringe, the star where they meet.
- The walls (Buildings/HolyNaveWalls.png, `walls`): the nave's own walls (`holynave_shell`, drawn bare in the rose-grey
  stone by tools/src/art/arch) four times as large, and on them, as the mock-up hangs them, the apse's great window
  between two lancets over the blind arcade, the candles on the lancets' sills; the sanctuary's bays a lancet each over
  the arcade; the arms' banners, and the side altar's niche over it.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts holynave_shell
    python3 games/openworld/tools/src/art/holyhall-nave.py
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
OUT = 'Fixtures/HolyNave.png'
PIER_OUT = 'Fixtures/HolyNavePier.png'
FLOOR_OUT = 'Fixtures/HolyNaveFloor.png'
WALLS_OUT = 'Buildings/HolyNaveWalls.png'
SHELL = 'Buildings/holynave_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/holyhall-nave.json'
T = 16
K = 4
P = T * K


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


DIR = ART / 'holyhall-nave'
ALTAR, WINDOWS = sheet(DIR / 'altar.png'), sheet(DIR / 'windows.png')
CROSSING, RAIL, STALLS = sheet(DIR / 'crossing.png'), sheet(DIR / 'rail.png'), sheet(DIR / 'stalls.png')
SIDE, VESTRY, CHAPELS = sheet(DIR / 'side-altar.png'), sheet(DIR / 'vestry.png'), sheet(DIR / 'chapels.png')
EXTRAS, PEW = sheet(DIR / 'extras.png'), sheet(DIR / 'pew.png')
# (the channels' piece's box takes in the feet of the piers and of a balustrade over it: those cleared from a copy)
_c = np.array(CROSSING)
_c[300:336, 360:566] = 0
_c[300:336, 694:900] = 0
CHANNEL_SHEET = Image.fromarray(_c)


def taken(src: Image.Image, box: tuple[int, int, int, int], width: float, specks: bool = True) -> Image.Image:
    """The piece in `box`, its stray specks dropped (unless asked not to), made `width` game pixels wide."""
    p = np.array(src.crop(box))
    lab, n = ndimage.label(p[..., 3] > 0)
    if specks and n > 1:
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


CHAPEL_F = 0.15                    # the chapels' altars: game pixels to a pixel of their sheet, all four alike


def chapel(box: tuple[int, int, int, int], ky: int, kx: tuple[int, int]) -> tuple[Image.Image, Image.Image, float]:
    """A chapel's altar as the sheet draws it, its niche and its kneeler, cut where the kneeler's cushion begins (`ky`):
    the niche and the altar (all above, and what stands beside the kneeler below), and the kneeler; and how far the
    kneeler's middle stands east of the whole's, in game pixels."""
    p = np.array(CHAPELS.crop(box))
    y0, x0 = ky - box[1], kx[0] - box[0]
    x1 = kx[1] - box[0]
    kneel = p[y0:, x0:x1].copy()
    p[y0:, x0:x1] = 0
    out = []
    for a in (p, kneel):
        lab, n = ndimage.label(a[..., 3] > 0)
        if n > 1:
            sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
            a[~np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.02])] = 0
        im = Image.fromarray(a).convert('RGBa')
        im = im.resize((max(1, round(im.width * CHAPEL_F * K)), max(1, round(im.height * CHAPEL_F * K))), Image.LANCZOS).convert('RGBA')
        b = np.array(im)
        b[b[..., 3] < 24] = 0
        out.append(Image.fromarray(b))
    east = ((kx[0] + kx[1]) / 2 - (box[0] + box[2]) / 2) * CHAPEL_F
    return out[0], out[1], east


# the four chapels' altars: the sheet's box, where its kneeler's cushion begins, the kneeler's columns
CHAPEL_AT = {
    'swords': ((192, 624, 528, 1222), 1085, (285, 437)),
    'monstrance': ((156, 12, 575, 604), 478, (288, 440)),
    'lily': ((759, 632, 1015, 1222), 1088, (809, 961)),
    'virgin': ((713, 13, 1062, 603), 474, (815, 960)),
}
CHAPEL = {k: chapel(*v) for k, v in CHAPEL_AT.items()}

# the sheets' pieces, each box a little wider than what is drawn in it; widths in game pixels, as the mock-up has them
BIG_W = 95.0                       # the great window; the lancets as the sheet has them beside it
LANCET_W = BIG_W * 200 / 470
STALL_SCALE = 98 / 650             # the stalls, the Primate's row as wide to a seat as the others
SLAB_SCALE = 56 / 530              # the slab, lifted as wide to a pixel as shut
PIECE = {
    # the altar's sheet
    'altar': taken(ALTAR, (243, 57, 1009, 671), 112),
    'statue': taken(ALTAR, (32, 102, 220, 660), 26),
    'cross': taken(ALTAR, (848, 699, 990, 1198), 26),
    # the windows' sheet
    'window_big': taken(WINDOWS, (388, 38, 866, 601), BIG_W),
    'lancet': taken(WINDOWS, (111, 111, 319, 599), LANCET_W),
    'lancet_side': taken(WINDOWS, (111, 111, 319, 599), 34),
    'arcade': taken(WINDOWS, (51, 639, 399, 825), 76),
    'arcade_side': taken(WINDOWS, (51, 639, 399, 825), 46),
    'candles': taken(WINDOWS, (78, 873, 216, 1027), 18),
    'candles_sill': taken(WINDOWS, (78, 873, 216, 1027), 14),
    # the crossing's sheet
    'star': taken(CROSSING, (570, 43, 819, 283), 37),
    'balustrade': taken(CROSSING, (795, 249, 1043, 331), 99),
    # the rail's sheet: the candelabra, the font
    'candelabrum5': taken(RAIL, (396, 22, 642, 525), 24),
    'candelabrum3': taken(RAIL, (937, 53, 1113, 525), 17),
    'font': taken(RAIL, (1113, 581, 1357, 949), 29),
    # the stalls' sheet
    'stalls': taken(STALLS, (195, 134, 851, 490), 656 * STALL_SCALE),
    'stalls_chair': taken(STALLS, (926, 60, 1606, 490), 680 * STALL_SCALE),
    'slab': taken(STALLS, (285, 556, 821, 848), 536 * SLAB_SCALE),
    'slab_open': taken(STALLS, (931, 556, 1480, 848), 549 * SLAB_SCALE),
    # the side altar's sheet: its niche (laid on the wall), the altar with its tabernacle, the lilies, the kneeler
    'niche': taken(SIDE, (361, 27, 776, 524), 56),
    'side_altar': taken(SIDE, (352, 532, 753, 917), 53),
    'lilies': taken(SIDE, (186, 613, 334, 917), 21),
    'kneeler': taken(SIDE, (439, 948, 697, 1167), 29),
    # the vestry's sheet
    'wardrobe': taken(VESTRY, (105, 28, 408, 593), 32),
    'rack': taken(VESTRY, (425, 123, 793, 578), 42),
    'stand': taken(VESTRY, (836, 144, 995, 578), 19),
    'banner': taken(VESTRY, (1009, 89, 1176, 430), 22),
    'table': taken(VESTRY, (303, 617, 869, 985), 56),
    'reliquary': taken(VESTRY, (70, 702, 190, 899), 14),
    'chest': taken(VESTRY, (75, 1045, 228, 1182), 22),
    'box': taken(VESTRY, (246, 1074, 369, 1178), 17),
    # the last sheet: the vestry's round window, the piers, the pews
    'oculus': taken(EXTRAS, (57, 371, 393, 710), 24),
    'pier': taken(EXTRAS, (435, 228, 644, 814), 28),
    'pew': taken(PEW, (75, 295, 1373, 851), 52),
}
for k, (alt, kn, _) in CHAPEL.items():
    PIECE[f'chapel_{k}'], PIECE[f'kneel_{k}'] = alt, kn
PIECE['nothing'] = Image.new('RGBA', (1, 1))

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
# (game pixels), as the mock-up stands them
THINGS = {
    'altar': ('altar', 0, 2),
    'statue_w': ('statue', -2, 0), 'statue_e': ('statue', 2, 0),
    'candelabrum_w': ('candelabrum3', -5, 2), 'candelabrum_e': ('candelabrum3', 5, 2),
    'cross_w': ('cross', -5, -10), 'cross_e': ('cross', 5, -10),
    'candles_w': ('candles', -3, 10), 'candles_e': ('candles', 3, 10),
    'rail_w': ('balustrade', 2.4, 0), 'rail_e': ('balustrade', -2.4, 0),
    'stalls_w': ('stalls', 13.6, 2), 'stalls_e': ('stalls', 2.4, 2), 'stalls_chair': ('stalls_chair', 2.4, 2),
    'candelabrum_aisle_w': ('candelabrum5', 8, 0), 'candelabrum_aisle_e': ('candelabrum5', -8, 0),
    'font': ('font', 0, 0),
    'slab': ('slab', 1, -13), 'slab_open': ('slab_open', 1, -13),
    'nothing': ('nothing', 0, 0),
    # the same, standing square on their cells, for other churches (Sunwell Abbey's nave, catalog.ts its theme)
    'candelabrum_tall': ('candelabrum5', 0, 0), 'statue_c': ('statue', 0, 0), 'cross_c': ('cross', 0, 0),
    'pew': ('pew', 0, 1),
    # the transept's arms: the vestry's things (the Curia's pieces in all but the table), the side altar and its company
    'wardrobe': ('wardrobe', 5, 3), 'rack': ('rack', 0, 3), 'stand': ('stand', 0, 0), 'table': ('table', -4, 6),
    'chest': ('chest', 0, 0), 'box': ('box', 0, 0), 'reliquary': ('reliquary', 0, 0),
    'side_altar': ('side_altar', -8, 0), 'lilies_w': ('lilies', 5, 0), 'lilies_e': ('lilies', -5, 0), 'kneeler': ('kneeler', -8, 3),
}
# the chapels' altars, their cut on the line 0.1 cell over the altar's cell's bottom; their kneelers below, the cut on the
# same line (the kneeler's cell one row nearer)
for k, (alt, kn, east) in CHAPEL.items():
    THINGS[f'chapel_{k}'] = (f'chapel_{k}', 0, 0)
    THINGS[f'kneel_{k}'] = (f'kneel_{k}', east, 0)

x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[p].width + 2 for p, _, _ in THINGS.values()), max(PIECE[p].height for p, _, _ in THINGS.values()))), {}
for name, (pic, east, foot) in THINGS.items():
    img = PIECE[pic]
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
# a chapel's altar stands on its cut (the line 0.1 cell over its cell's bottom); its kneeler, a cell nearer, hangs from
# the same line
for k, (box, ky, _) in CHAPEL_AT.items():
    pieces[f'chapel_{k}']['ay'] = round((ky - box[1]) * CHAPEL_F * K) + 0.1 * P
    pieces[f'kneel_{k}']['ay'] = 1.1 * P
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)

# the pier: standing on the middle of the bottom row of three cells by five
pier = hard(PIECE['pier'])
PIER_H = 6
canvas = Image.new('RGBA', (3 * P, PIER_H * P))
canvas.alpha_composite(pier, (round(1.5 * P - pier.width / 2), PIER_H * P - pier.height - 2 * K))
canvas.save(LSW / PIER_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ the plan
# the nave's parts in the map's cells (art/arch/plans.ts HOLY_NAVE)
PARTS = {
    'apse': (12, 11, 11, 6), 'choir': (9, 17, 17, 14), 'crossing': (9, 31, 17, 6),
    'armW': (2, 25, 6, 5), 'armE': (27, 25, 6, 5), 'aisleW': (7, 30, 1, 7), 'aisleE': (27, 30, 1, 7),
    'aisleW2': (8, 34, 1, 3), 'aisleE2': (26, 34, 1, 3),
    'chapelW1': (4, 35, 3, 3), 'chapelW2': (4, 45, 3, 7), 'chapelE1': (28, 35, 3, 3), 'chapelE2': (28, 45, 3, 7),
    'nave': (7, 37, 21, 20), 'narthex': (12, 57, 11, 4), 'door': (17, 61, 1, 1),
}
W, H = 35, 62
AX = 17.5                         # the axis, the middle of column 17
RAIL_FRONT = 22.0                 # the sanctuary's edge (the rail on row 21)
GAP = (15.6, 19.4)                # the rail's gap, the way up to the altar
STEPS = (29.0, 31.0)              # the three steps down from the choir to the crossing
ALTAR_FOOT = 19.9
# the channels' piece (its box on the sheet, and within it what is drawn): as wide as the crossing, its head on the
# crossing's first row under the steps, a little shorter than the sheet has it so the star falls where the nave begins;
# down the steps its stem, narrowing to the runner's width at their head
FAN_BOX, FAN_X, FAN_Y = (366, 330, 896, 551), (369, 893), (330, 548)
FAN_SX = 17 * P / (FAN_X[1] - FAN_X[0])                 # floor pixels to a pixel of the sheet, across
FAN_SY = 5.45 * P / (525 - FAN_Y[0])                    # and down: the star 5.45 cells under the fan's head
FAN_LEFT = 9.0 * P - (FAN_X[0] - FAN_BOX[0]) * FAN_SX
FAN_TOP = 31.0 * P - (FAN_Y[0] - FAN_BOX[1]) * FAN_SY
STEM_X = (571, 688)                                    # the stem where it runs straight, and the rows it does
STEM_Y = (326, 350)
STAR_AT = (AX, (FAN_TOP + (525 - FAN_BOX[1]) * FAN_SY) / P)   # where the five meet

cells = np.zeros((H, W), bool)
for (cx, cy, cw, ch) in PARTS.values():
    cells[cy:cy + ch, cx:cx + cw] = True

# ------------------------------------------------------------------------------------------------ the floor
yy, xx = np.mgrid[0:H * P, 0:W * P]
gx, gy = (xx + 0.5) / P, (yy + 0.5) / P
cxi, cyi = np.minimum(gx.astype(int), W - 1), np.minimum(gy.astype(int), H - 1)
fx, fy = gx - cxi, gy - cyi
img = np.zeros((H * P, W * P, 3), np.float32)
alpha = cells[cyi, cxi]


def rect(r: tuple[float, float, float, float]) -> np.ndarray:
    x0, y0, w, h = r
    return (gx >= x0) & (gx < x0 + w) & (gy >= y0) & (gy < y0 + h)


def rgb(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def hsh(a: np.ndarray, b: np.ndarray, c: int) -> np.ndarray:
    """A number in [0, 1) for each pair of integers."""
    h = (a.astype(np.int64) * 374761393 + b.astype(np.int64) * 668265263 + c * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0


def paint(mask: np.ndarray, colour: np.ndarray | str, k: np.ndarray | float = 1.0) -> None:
    c = rgb(colour) if isinstance(colour, str) else colour
    kk = k[mask] if isinstance(k, np.ndarray) else k
    img[mask] = c * (kk[..., None] if isinstance(kk, np.ndarray) else kk)


def blend(mask: np.ndarray, colour: str, a: float) -> None:
    img[mask] = img[mask] * (1 - a) + rgb(colour) * a


# the grain: a game pixel's own little shade
grain = 1 + (hsh((gx * T).astype(int), (gy * T).astype(int), 11) - 0.5) * 0.05


def lattice(mask: np.ndarray, size: float, base: str, line: str, dot: str, w: float = 0.035) -> None:
    """Diamonds `size` cells across, thin lines between them, a stud where four meet; each diamond a shade its own."""
    u, v = (gx + gy) / size, (gx - gy) / size
    tone = 1 + (hsh(np.floor(u), np.floor(v), 3) - 0.5) * 0.07
    paint(mask, base, tone * grain)
    du, dv = np.abs(u - np.round(u)), np.abs(v - np.round(v))
    blend(mask & ((du < w / size * 1.4) | (dv < w / size * 1.4)), line, 0.4)
    blend(mask & (du < 0.09) & (dv < 0.09), dot, 0.45)


def squares(mask: np.ndarray, size: float, base: str, grout: str, w: float = 0.03, stagger: bool = False) -> None:
    """Square slabs `size` cells on a side (rows staggered if asked), the joints between, each slab a shade its own."""
    row = np.floor(gy / size)
    sx = gx / size + (0.5 * (row % 2) if stagger else 0)
    tone = 1 + (hsh(np.floor(sx), row, 5) - 0.5) * 0.09
    paint(mask, base, tone * grain)
    ju, jv = np.abs(sx - np.round(sx)), np.abs(gy / size - np.round(gy / size))
    blend(mask & ((ju < w / size) | (jv < w / size)), grout, 0.4)
    blend(mask & (ju < 0.07) & (jv < 0.07) & (hsh(np.round(sx), np.round(gy / size), 6) < 0.3), grout, 0.25)


choir_all = rect(PARTS['choir'])
sanct = (rect(PARTS['apse']) | choir_all) & (gy < RAIL_FRONT)
choir = choir_all & (gy >= RAIL_FRONT) & (gy < STEPS[0])
steps = choir_all & (gy >= STEPS[0])
crossing = rect(PARTS['crossing'])
red = np.zeros_like(alpha)
for k in ('armW', 'armE', 'aisleW', 'aisleE', 'aisleW2', 'aisleE2'):
    red |= rect(PARTS[k])
nave = rect(PARTS['nave'])
pale = np.zeros_like(alpha)
for k in ('chapelW1', 'chapelW2', 'chapelE1', 'chapelE2', 'narthex', 'door'):
    pale |= rect(PARTS[k])

# the sanctuary's grey stone and its wide lattice; the choir's darker; the steps' pale stone
lattice(sanct, 1.5, '#776567', '#8b787a', '#9d898a', 0.03)
lattice(choir, 1.0, '#584749', '#6b5a5b', '#806d6c')
squares(steps, 1.0, '#b6a09b', '#958079', stagger=True)
# the crossing's pale squares
squares(crossing, 0.75, '#cdb3a8', '#a98f86')
# the transept's arms and their aisles, red tiles
lattice(red, 0.6, '#753d41', '#8d5254', '#9c6262', 0.03)
# the nave's dark stone and its lattice
lattice(nave, 1.0, '#5a4a4d', '#6c5b5d', '#7d6b6b')
# the chapels', the narthex's and the door's pale stone
squares(pale, 0.75, '#c8aa9e', '#a3887f', stagger=True)

# ---- the kerb: a pale stone along every wall (where the floor meets wall, not floor), the shade at its foot
KERB = 0.2
pad = np.pad(cells, 1)
wallN, wallS = ~pad[0:H, 1:W + 1], ~pad[2:H + 2, 1:W + 1]
wallW, wallE = ~pad[1:H + 1, 0:W], ~pad[1:H + 1, 2:W + 2]
dN = np.where(wallN[cyi, cxi], fy, 9)
dS = np.where(wallS[cyi, cxi], 1 - fy, 9)
dW = np.where(wallW[cyi, cxi], fx, 9)
dE = np.where(wallE[cyi, cxi], 1 - fx, 9)
d = np.minimum.reduce([dN, dS, dW, dE])
for (ox, oy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
    diag = ~pad[1 + oy:H + 1 + oy, 1 + ox:W + 1 + ox]
    ddx = fx if ox < 0 else 1 - fx
    ddy = fy if oy < 0 else 1 - fy
    d = np.minimum(d, np.where(diag[cyi, cxi], np.maximum(ddx, ddy), 9))
kerb = alpha & (d < KERB)
paint(kerb, '#b89a8f', (1 + (hsh(np.floor(gx * 2), np.floor(gy * 2), 7) - 0.5) * 0.06) * grain)
blend(kerb & (np.abs(d - KERB) < 0.025), '#7d6461', 0.9)
blend(kerb & (d < 0.03), '#6a5150', 0.7)
shade = alpha & (d >= KERB) & (d < KERB + 0.7)
img[shade] *= (0.8 + 0.2 * ((d[shade] - KERB) / 0.7) ** 0.7)[..., None]
north = alpha & (dN < 1.4) & (dN >= KERB)
img[north] *= (0.78 + 0.22 * ((dN[north] - KERB) / 1.2).clip(0, 1) ** 0.6)[..., None]


def riser(span: np.ndarray, front: float, deep: float = 0.22) -> None:
    """A step's front: its lip lit, the riser down from it darker, its foot, the shadow on the tread below."""
    blend(span & (gy >= front - 0.06) & (gy < front), '#d6c0b6', 0.9)
    rise = span & (gy >= front) & (gy < front + deep)
    paint(rise, '#7a6662', grain * (1 - (gy - front).clip(0, 1) * 0.7))
    blend(span & (gy >= front + deep) & (gy < front + deep + 0.05), '#3f3033', 0.85)
    blend(span & (gy >= front + deep + 0.05) & (gy < front + deep + 0.2), '#000000', 0.18)


# ---- the steps: two in the rail's gap up to the altar, three down from the choir to the crossing
gap = choir_all & (gx >= GAP[0]) & (gx < GAP[1])
squares(gap & (gy >= RAIL_FRONT - 0.5) & (gy < RAIL_FRONT + 0.7), 1.0, '#b6a09b', '#958079')
for front in (RAIL_FRONT - 0.45, RAIL_FRONT + 0.25):
    riser(gap, front, 0.18)
for front in np.linspace(STEPS[0] + 0.55, STEPS[1] - 0.2, 3):
    riser(choir_all, float(front))
# the choir's raised edge over the steps either side of the runner, sloping down to the steps beside it (the mock-up's)
CURB = (28.62, 28.8, 29.08)       # its top's back, its top's front (the lip), its foot
gap = 0.95                        # half the way left open for the runner and the channels' stem
for sign in (-1, 1):
    e = AX + sign * gap                                    # the curb's inner end
    side = choir_all & ((gx - AX) * sign >= gap)
    # the slope: over its last 0.45 cell the curb comes down to the first step
    k = np.clip((0.45 - (gx - AX) * sign + gap) / 0.45, 0, 1) if False else np.clip(1 - ((gx - AX) * sign - gap) / 0.45, 0, 1)
    dy = k * (CURB[2] - CURB[0] - 0.06)
    top = side & (gy >= CURB[0] + dy) & (gy < CURB[1] + dy * 0.5)
    face = side & (gy >= CURB[1] + dy * 0.5) & (gy < CURB[2])
    paint(top, '#d4beb4', grain * (1 + (hsh(np.floor(gx * 1.5), np.floor(gy), 9) - 0.5) * 0.06))
    paint(face, '#9a837c', grain * (1 - (gy - CURB[1]).clip(0, 1) * 0.5))
    blend(side & (gy >= CURB[0] + dy - 0.035) & (gy < CURB[0] + dy), '#4a3a3d', 0.55)         # its back edge's shadow
    blend(side & (np.abs(gy - (CURB[1] + dy * 0.5)) < 0.02), '#efe0d8', 0.6)                     # the lip, lit
    blend(side & (gy >= CURB[2]) & (gy < CURB[2] + 0.04), '#3f3033', 0.8)                        # its foot
    blend(side & (gy >= CURB[2] + 0.04) & (gy < CURB[2] + 0.16), '#000000', 0.2)
    joints = side & (gy >= CURB[0] + dy) & (gy < CURB[2]) & (np.abs(((gx - AX) * sign - gap) % 1.5 - 0.75) > 0.735)
    blend(joints & (k == 0), '#6f5a57', 0.5)

# ---- the runners: crimson, a gilt border, a gilt cross every so often


def runner(y0: float, y1: float, width: float, folds: tuple[float, ...] = ()) -> None:
    x0, x1 = AX - width / 2, AX + width / 2
    m = alpha & (gx >= x0) & (gx < x1) & (gy >= y0) & (gy < y1)
    weave = 1 + (hsh((gx * T * 2).astype(int), (gy * T).astype(int), 13) - 0.5) * 0.06
    paint(m, '#8d2b31', weave)
    e = np.minimum(gx - x0, x1 - gx)
    blend(m & (e < 0.05), '#4c1519', 0.9)
    for at, wd in ((0.13, 0.035), (0.22, 0.02)):
        blend(m & (np.abs(e - at) < wd), '#d6a54d', 0.95)
    # the crosses: a gilt four-pointed star, its sides drawn in, a knob past each point, little rays between its arms, a
    # garnet at its heart; lit from the north-west, edged in the carpet's dark
    v = ((gy - y0 - 0.8) % 1.6) - 0.8
    u = gx - AX
    au, av = np.abs(u), np.abs(v)
    A, B = 0.23, 0.33
    inner = (au / A) ** 0.6 + (av / B) ** 0.6 < 1
    edge = ((au / (A + 0.04)) ** 0.6 + (av / (B + 0.04)) ** 0.6 < 1) & ~inner
    knobs = np.zeros_like(inner)
    for cu, cv in ((0, B + 0.055), (0, -B - 0.055), (A + 0.055, 0), (-A - 0.055, 0)):
        knobs |= np.abs(u - cu) + np.abs(v - cv) < 0.04
    rays = (np.abs(au - av) < 0.014) & (u * u + v * v < 0.15 ** 2) & (u * u + v * v > 0.065 ** 2)
    heart = u * u + v * v < 0.042 ** 2
    ring = (u * u + v * v < 0.065 ** 2) & ~heart
    on = m & (gy > y0 + 0.45) & (gy < y1 - 0.45)
    blend(on & edge, '#4e1418', 0.55)
    gold = on & (inner | knobs | rays | ring)
    blend(gold, '#d9a548', 1.0)
    blend(gold & (u + v < -0.02), '#f6d886', 0.75)
    blend(gold & (u + v > 0.05), '#9c6a26', 0.55)
    blend(on & heart, '#7a1a22', 1.0)
    blend(on & heart & (u + v < 0), '#c0414b', 0.7)
    for front in folds:
        img[m & (gy >= front) & (gy < front + 0.18)] *= 0.62
        blend(m & (gy >= front - 0.04) & (gy < front), '#c0505a', 0.6)
    blend(m & (gy >= y0) & (gy < y0 + 0.12), '#000000', 0.35)


runner(ALTAR_FOOT - 0.1, STEPS[0], 1.6, (RAIL_FRONT - 0.45, RAIL_FRONT + 0.25))
# the choir's runner ends at the steps' head in a gilt fringe
fringe = alpha & (np.abs(gx - AX) < 0.8) & (gy >= STEPS[0] - 0.1) & (gy < STEPS[0] + 0.02)
paint(fringe, '#c99a45', 1.0)
blend(fringe & (((gx * T * 2).astype(int) % 2) == 0), '#7a5520', 0.6)
runner(STAR_AT[1], H, 2.2)

floor = Image.fromarray(np.dstack([np.clip(img, 0, 255), np.where(alpha, 255, 0)]).astype(np.uint8))
# the crossing: the five lands' channels as the sheet lays them, from the crossing's west edge to its east
fan = CHANNEL_SHEET.crop(FAN_BOX).convert('RGBa')
fan = fan.resize((round(fan.width * FAN_SX), round(fan.height * FAN_SY)), Image.LANCZOS).convert('RGBA')
floor.alpha_composite(hard(fan), (round(FAN_LEFT), round(FAN_TOP)))
# their stem up the steps: the sheet's straight run of it, tiled, narrowing from the fan's head to the runner's width at
# the steps' head (the runner's fringe over its top)
run = CHANNEL_SHEET.crop((STEM_X[0], STEM_Y[0], STEM_X[1], STEM_Y[1])).convert('RGBa')
run = np.array(run.resize((round(run.width * FAN_SX), round(run.height * FAN_SX)), Image.LANCZOS)).astype(np.float32)
top, bottom = round(STEPS[0] * P), round(FAN_TOP)
full = run.shape[1]
STEM_MID = FAN_LEFT + ((STEM_X[0] + STEM_X[1]) / 2 - FAN_BOX[0]) * FAN_SX   # the fan's stem's middle, to the pixel
# (counted up from the fan's head, so the row over it is the sheet's row over the fan's first)
head = round((FAN_Y[0] - STEM_Y[0]) * FAN_SX)
fl = np.array(floor).astype(np.float32)
for r in range(top, bottom):
    t = (r - top) / (bottom - top)
    w = 1.6 * P + (full - 1.6 * P) * t ** 1.8
    row = run[(head - (bottom - r)) % run.shape[0]]
    xs = np.linspace(0, full - 1, max(2, round(w)))
    src = np.stack([np.interp(xs, np.arange(full), row[:, c]) for c in range(4)], 1)
    x0 = round(STEM_MID - len(xs) / 2)
    a = src[:, 3:4] / 255
    rgb_ = np.where(a > 0, src[:, :3] / np.maximum(a, 1e-6), 0)
    seg = fl[r, x0:x0 + len(xs)]
    seg[:, :3] = seg[:, :3] * (1 - a) + rgb_ * a
    seg[:, 3] = np.maximum(seg[:, 3], src[:, 3])
# the steps' fronts over it, so it goes down them
stem = (np.abs(gx - AX) < 2.2) & (gy >= STEPS[0]) & (gy < STEPS[1])
for front in np.linspace(STEPS[0] + 0.55, STEPS[1] - 0.2, 3):
    fl[stem & (gy >= front) & (gy < front + 0.22), :3] *= 0.74
    lip = stem & (gy >= front - 0.05) & (gy < front)
    fl[lip, :3] = fl[lip, :3] * 0.75 + 230 * 0.25
floor = Image.fromarray(fl.clip(0, 255).astype(np.uint8))
star = hard(PIECE['star'])
floor.alpha_composite(star, (round(STAR_AT[0] * P - star.width / 2), round(STAR_AT[1] * P - star.height / 2)))
floor.save(LSW / FLOOR_OUT, optimize=True)
print('→', LSW / FLOOR_OUT, floor.size)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['holynave_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
by_row = {s['row']: s for s in shell['slices']}
APSE_FACE = PARTS['apse'][1] * T
BAY_FACE = PARTS['choir'][1] * T
ARM_FACE = PARTS['armW'][1] * T


def lay(img: Image.Image, s: dict, mx: float, my: float) -> None:
    sx = round((s['x'] + mx - s['col'] * T) * K)
    sy = round((s['y'] + my - (s['row'] - s['th'] + 1) * T) * K)
    x0, y0 = s['x'] * K, s['y'] * K
    assert x0 <= sx and y0 <= sy and sx + img.width <= x0 + s['tw'] * T * K and sy + img.height <= y0 + s['th'] * T * K, f'off the strip of row {s["row"]}'
    region = walls.crop((sx, sy, sx + img.width, sy + img.height))
    over = Image.alpha_composite(region, img)
    mask = Image.fromarray(((np.array(region)[..., 3] > 0) * 255).astype(np.uint8))
    walls.paste(over, (sx, sy), mask)


ARCADE_H = PIECE['arcade'].height / K
SIDE_ARCADE_H = PIECE['arcade_side'].height / K
LANCET_OFF = (BIG_W + LANCET_W) / 2 / T
BAYS = [10.5, 24.5]                # the sanctuary's bays' middles
HUNG = [
    # the apse: the blind arcade along its foot, the great window over it between two lancets, candles on their sills
    *[('arcade', APSE_FACE, AX + k * 2.4, 0) for k in (-1, 1)],
    ('window_big', APSE_FACE, AX, ARCADE_H - 1),
    *[('lancet', APSE_FACE, AX + k * LANCET_OFF, ARCADE_H - 1) for k in (-1, 1)],
    *[('candles_sill', APSE_FACE, AX + k * LANCET_OFF, ARCADE_H + 3) for k in (-1, 1)],
    # the bays: the arcade, a lancet over it, candles on its sill
    *[('arcade_side', BAY_FACE, m, 0) for m in BAYS],
    *[('lancet_side', BAY_FACE, m, SIDE_ARCADE_H - 1) for m in BAYS],
    *[('candles_sill', BAY_FACE, m, SIDE_ARCADE_H + 2) for m in BAYS],
    # the transept's arms: a banner on each by the choir's wall; in the east one the side altar's niche over it
    ('banner', ARM_FACE, 7.3, 42), ('banner', ARM_FACE, 27.7, 42),
    ('oculus', ARM_FACE, 5.0, 70),
    ('niche', ARM_FACE, 30.0, 22),
]
for name, face, mid, z in HUNG:
    pic = hard(PIECE[name])
    lay(pic, by_row[face // T - 1], mid * T - pic.width / K / 2, face - z - pic.height / K)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'pier': {'img': f'lsw/{PIER_OUT}', 'tw': 3, 'th': PIER_H, 'pixelsPerTile': P},
    'floor': {'img': f'lsw/{FLOOR_OUT}', 'tw': W, 'th': H, 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
