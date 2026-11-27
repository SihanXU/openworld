"""Sunwell Abbey's nave (holy.sunwell-abbey.nave) in the user's own pictures (2026-11-26), laid as their mock-up lays it
(sunwell-nave/ref.png, the final one; the first, the right half of var/screens/sunwell-nave-v1-vs-mockup.png) on the
nave's plan (art/arch/plans.ts NAVE). Their sheets: the crossing's labyrinth, a pier and the four spandrels that square
the labyrinth (sunwell-nave/crossing.png); the altar rail's two runs, the choir's steps between their posts, a slab with
gilt corners, the lectern and the pulpit (sunwell-nave/rail.png); the apse's whole wall — the great window between two
lancets over a blind arcade (sunwell-nave/apse-wall.png); the organ (sunwell-nave/organ.png, its right half, the user's
of the third pass); the chapels' niches with their windows, violet and blue, the kneelers, an altar, lilies and smaller
flowers in urns (sunwell-nave/chapel.png); the two roses, the arms' door and the stair down (sunwell-nave/arms.png); the
founders' tomb (sunwell-nave/tomb.png). Taken as painted, their red fringe peeled, made smaller, at four pixels to the
game's one. The chapels' altars are the Most Holy Hall's, its saint in her starry niche (holyhall-nave.py
`chapel_virgin`, as the user asked: the same picture, not composed again here); from its sheets too, larger than it has
them, the high altar with its tabernacle, the candelabra down the nave and the pews.

- The things (Fixtures/SunwellNave.png, client/src/sunwell-nave.json `pieces`): the organ, the high altar, the lectern,
  the pulpit, the pews, the lilies (catalog.ts the theme `sunwell`; the reliquary drawn by nothing, the altar's tabernacle
  its picture); the rail's two runs, the arms' tombs and the candelabra down the nave, drawn by their ids (catalog.ts
  placedSprites).
- On the floor, laid as ground (catalog.ts `sunnave_*`, abbey.ts lays them): the floor over the whole map (`floor`), as
  the mock-up colours it — warm pale marble, the arms' crimson lattice carpet, a band of it across the foot of the nave,
  a pale kerb along every wall, and the Most Holy Hall's runner (crimson, a gilt border, a gilt cross every so often) up
  the nave and the choir; over it the labyrinth squared by its spandrels in the crossing (`labyrinth`), the steps from the
  choir down to the crossing across its whole width, a post at either end, the runner down them (`steps`), the slab under
  the high altar (`slab`), the stair down to the crypt in the west arm (`stair`).
- The piers (`pier`): one standing on the middle of the bottom row of three cells by five, at the crossing's corners.
- The walls (Buildings/SunwellNaveWalls.png, `walls`): the nave's own walls (`nave_shell`, drawn bare in the rose-grey
  stone where these hang by tools/src/art/arch) four times as large, each stone dressed in the warm limestone of the
  user's apse wall (`dress`), and on them: the apse's wall from end to end; the choir's bays the chapels' sheet's niche
  with its window, whole, violet to the west, blue to the east, hung over the saint who stands before it; each arm its
  door, a tall one, under its rose (larger, as the user asked of 2026-11-26), rose-red to the west, blue to the east, the
  Most Holy Hall's banner on the side of each toward the choir (holyhall-nave/vestry.png; the east one turned about,
  so the two answer each other); each chapel's wall the user's carved rose
  (sunwell-nave/medallion.png) in the middle over its saint's niche. The crossing's piers between the choir and the arms
  (`nave_pier`, Buildings/SunwellNavePier.png, `wallPier`) in the same dressed stone.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts nave_shell
    python3 games/openworld/tools/src/art/sunwell-nave.py
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
OUT = 'Fixtures/SunwellNave.png'
WALLS_OUT = 'Buildings/SunwellNaveWalls.png'
SHELL = 'Buildings/nave_shell.png'
PIER_WALL_SRC = 'Buildings/nave_pier.png'
PIER_WALL_OUT = 'Buildings/SunwellNavePier.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/sunwell-nave.json'
T = 16
K = 4
P = T * K

DIR = ART / 'sunwell-nave'


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


CROSSING, RAIL, APSE, CHAPEL, ARMS, TOMB, ORGAN, MEDALLION = (sheet(DIR / f'{n}.png') for n in ('crossing', 'rail', 'apse-wall', 'chapel', 'arms', 'tomb', 'organ', 'medallion'))
# the Most Holy Hall's sheets (holyhall-nave.py takes the same boxes from them)
HOLY_SIDE, HOLY_RAIL, HOLY_PEW, HOLY_VESTRY = (sheet(ART / 'holyhall-nave' / f'{n}.png') for n in ('side-altar', 'rail', 'pew', 'vestry'))
HOLY_INDEX = GAME / 'client/src/holyhall-nave.json'


def peel(p: np.ndarray, rounds: int = 6) -> np.ndarray:
    """The sheets' red fringe peeled from the outside in: a pixel on the edge, red and not the piece's own (far redder
    than it is green or blue), cleared, `rounds` times over."""
    p = p.copy()
    r, g, b = (p[..., i].astype(int) for i in range(3))
    fringe = (r > 110) & (r > 1.9 * np.maximum(g, b)) & (np.maximum(g, b) < 110)
    for _ in range(rounds):
        clear = p[..., 3] == 0
        edge = ndimage.binary_dilation(clear) & ~clear
        hit = edge & fringe
        if not hit.any():
            break
        p[hit] = 0
    return p


def taken(src: Image.Image, box: tuple[int, int, int, int], width: float, flip: bool = False, height: float | None = None,
          fringe: bool = True, specks: float = 0.02) -> Image.Image:
    """The piece in `box`, its fringe peeled (unless its sheet has none) and its stray specks dropped (what is smaller
    than `specks` of the piece), made `width` game pixels wide (and `height` high, if given; else as the sheet has it),
    turned upside down if asked."""
    p = np.array(src.crop(box))
    if fringe:
        p = peel(p)
    lab, n = ndimage.label(p[..., 3] > 0)
    if n > 1:
        sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
        p[~np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * specks])] = 0
    img = Image.fromarray(p)
    if flip:
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
    img = img.convert('RGBa')
    s = width * K / img.width
    size = (round(width * K), round(height * K)) if height else (max(1, round(img.width * s)), max(1, round(img.height * s)))
    img = img.resize(size, Image.LANCZOS).convert('RGBA')
    a = np.array(img)
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


def hard(img: Image.Image) -> Image.Image:
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return Image.fromarray(a)


# ------------------------------------------------------------------------------------------------ the plan
# the nave's parts in the map's cells (art/arch/plans.ts NAVE, its TOP rows of dark counted in)
TOP = 9
PARTS = {
    'apse': (12, 16, 11, 8), 'choir': (9, 20, 17, 7), 'transept': (2, 27, 31, 8), 'nave': (7, 35, 21, 23),
    'chapelW1': (4, 39, 3, 5), 'chapelW2': (4, 48, 3, 5), 'chapelE1': (28, 39, 3, 5), 'chapelE2': (28, 48, 3, 5),
    'narthex': (12, 58, 11, 3), 'door': (17, 61, 1, 1),
}
W, H = 35, 62
AX = 17.5                          # the axis, the middle of column 17
CROSS_MID = 31.0                   # the crossing's middle row line (its rows 27 to 34)

# ------------------------------------------------------------------------------------------------ the pictures
LAB_W = 6.4 * T                    # the labyrinth, squared by its spandrels (each as long as the labyrinth's radius)
ORGAN_W = 5.4 * T                  # the organ before the apse's wall, its pipes over the high altar behind it
NICHE_W = 2.7 * T                  # the chapels' sheet's niche on a choir bay's wall, the pilasters showing
NICHE_Z = 30                       # hung over the saint who stands before it, its window clear of his head
DOOR_W = 2.4 * T                   # an arm's door under its rose, as tall as the candelabra either side of it
ROSE_W = 3.5 * T                   # an arm's rose, between the door's head and the coping (the user's word: larger)
BANNER_W = 1.25 * T                # the Most Holy Hall's banner, hung by each rose on the side toward the choir
MEDAL_W = 1.8 * T                  # the carved rose of the user's picture, on each chapel's wall over its saint's niche
TOMB_W = 1.2 * T                   # a founder's tomb, three to an arm two cells apart
GROW = 1.3                         # the Most Holy Hall's high altar and candelabra, this much larger here (the user's word)
SLAB_W = 3.75 * T                  # the slab under the high altar, grown with it
PIECE = {
    # the crossing's sheet
    'labyrinth': taken(CROSSING, (89, 88, 843, 839), LAB_W),
    'pier': taken(CROSSING, (912, 97, 1123, 762), 1.3 * T),
    'span_nw': taken(CROSSING, (156, 902, 368, 1137), LAB_W / 2, height=LAB_W / 2),
    'span_ne': taken(CROSSING, (407, 902, 607, 1137), LAB_W / 2, height=LAB_W / 2),
    'span_sw': taken(CROSSING, (654, 902, 853, 1137), LAB_W / 2, flip=True, height=LAB_W / 2),
    'span_se': taken(CROSSING, (888, 902, 1098, 1137), LAB_W / 2, flip=True, height=LAB_W / 2),
    # the apse's sheet: its whole wall (as high as the apse's face, 11 cells, a little taller than painted), the organ;
    # the lancets either side of the great window, cut out for the choir's bays
    'apse_wall': taken(APSE, (101, 127, 946, 917), 11 * T, height=11 * T),
    # the organ's sheet: its right half
    'organ': taken(ORGAN, (520, 145, 1360, 938), ORGAN_W),
    # the chapels' sheet: its niches with their windows, whole (the choir bays'), the lilies
    'niche_violet': taken(CHAPEL, (189, 46, 593, 801), NICHE_W),
    'niche_blue': taken(CHAPEL, (662, 46, 1066, 801), NICHE_W),
    'lilies': taken(CHAPEL, (863, 839, 993, 1021), 1.0 * T),
    'flowers': taken(CHAPEL, (868, 1045, 984, 1198), 0.8 * T),
    # the arms' sheet
    'rose_red': taken(ARMS, (211, 42, 568, 394), ROSE_W),
    'rose_blue': taken(ARMS, (674, 42, 1029, 394), ROSE_W),
    # the Most Holy Hall's banner (holyhall-nave.py takes the same box; crimson itself, so no fringe peeled); the user's
    # carved rose (sunwell-nave/medallion.png, drawn on its own)
    'banner': taken(HOLY_VESTRY, (1009, 89, 1176, 430), BANNER_W, fringe=False, specks=0.01),
    'medallion': taken(MEDALLION, (220, 159, 1091, 1029), MEDAL_W, fringe=False),
    'door': taken(ARMS, (107, 418, 387, 779), DOOR_W),
    'stair': taken(ARMS, (418, 839, 837, 1213), 3 * T),
    # the tomb's own sheet
    'tomb': taken(TOMB, (185, 71, 836, 1474), TOMB_W),
    # the Most Holy Hall's sheets, larger than it has them: the high altar with its tabernacle and candles, the candelabrum
    # of five, the pew
    'high_altar': taken(HOLY_SIDE, (352, 532, 753, 917), 53 * GROW, fringe=False, specks=0.01),
    'candelabrum': taken(HOLY_RAIL, (396, 22, 642, 525), 24 * GROW, fringe=False, specks=0.01),
    'pew': taken(HOLY_PEW, (75, 295, 1373, 851), 65, fringe=False, specks=0.01),
    # the rail's sheet
    'rail_w': taken(RAIL, (51, 101, 539, 377), 5.5 * T),
    'rail_e': taken(RAIL, (715, 101, 1204, 377), 5.5 * T),
    'steps': taken(RAIL, (75, 433, 1180, 694), 17 * T),
    'slab': taken(RAIL, (86, 878, 439, 1094), SLAB_W),
    'lectern': taken(RAIL, (565, 817, 744, 1095), 1.7 * T),
    'pulpit': taken(RAIL, (904, 766, 1157, 1121), 1.9 * T),
}

# the east arm's banner turned about, to answer the west one's
PIECE['banner_e'] = PIECE['banner'].transpose(Image.FLIP_LEFT_RIGHT)

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
# (game pixels), as the mock-up stands them. The rail's runs each from the choir's wall to the way up: the west one from
# 9.2 to 14.7, drawn by its cell 11; the east one mirrored, by its cell 23. The pulpit at the steps' east end, its middle
# a little east of its cell's (abbey.ts its cell 22)
RAIL_EAST = (9.2 + 5.5 / 2 - 11.5) * T
THINGS = {
    'organ': ('organ', 0, 0),
    'high_altar': ('high_altar', 0, 0),
    'candelabrum': ('candelabrum', 0, 0),
    'pew': ('pew', 0, 1),
    'lectern': ('lectern', 0, 1),
    'pulpit': ('pulpit', 2, 1),
    'rail_w': ('rail_w', RAIL_EAST, 0),
    'rail_e': ('rail_e', -RAIL_EAST, 0),
    'lilies': ('lilies', 0, 1),
    'flowers': ('flowers', 0, 1),
    'tomb': ('tomb', 0, 0),
    'nothing': (None, 0, 0),
}
PIECE[None] = Image.new('RGBA', (1, 1))
x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[p].width + 2 for p, _, _ in THINGS.values()), max(PIECE[p].height for p, _, _ in THINGS.values()))), {}
for name, (pic, east, foot) in THINGS.items():
    img = hard(PIECE[pic])
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)


def canvas(name: str, tw: int, th: int) -> tuple[Image.Image, dict]:
    return Image.new('RGBA', (tw * P, th * P)), {'img': f'lsw/Fixtures/SunwellNave_{name}.png', 'tw': tw, 'th': th, 'pixelsPerTile': P}


def save(img: Image.Image, spec: dict) -> dict:
    img.save(LSW / spec['img'].removeprefix('lsw/'), optimize=True)
    print('→', spec['img'], img.size)
    return spec


GROUND: dict[str, dict] = {}

# ------------------------------------------------------------------------------------------------ the floor
# over the whole map (a canvas 35 by 62 laid at (0, 0), before every other ground), as the mock-up colours it: warm pale
# marble in slabs a cell square, the transept's arms crimson lattice carpet to their piers, a band of it across the foot
# of the nave, a pale kerb along every wall, the shade at the walls' feet; the Most Holy Hall's runner (holyhall-nave.py
# `runner`) from the west door up the nave to the crossing, and in the choir from the altar's slab down to the steps
cells = np.zeros((H, W), bool)
for (cx, cy, cw, ch) in PARTS.values():
    cells[cy:cy + ch, cx:cx + cw] = True
yy, xx = np.mgrid[0:H * P, 0:W * P]
gx, gy = (xx + 0.5) / P, (yy + 0.5) / P
cxi, cyi = np.minimum(gx.astype(int), W - 1), np.minimum(gy.astype(int), H - 1)
fx, fy = gx - cxi, gy - cyi
img = np.zeros((H * P, W * P, 3), np.float32)
alpha = cells[cyi, cxi]


def rect(x0: float, y0: float, w: float, h: float) -> np.ndarray:
    return (gx >= x0) & (gx < x0 + w) & (gy >= y0) & (gy < y0 + h)


def rgb(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def hsh(a: np.ndarray, b: np.ndarray, c: int) -> np.ndarray:
    """A number in [0, 1) for each pair of integers."""
    h = (a.astype(np.int64) * 374761393 + b.astype(np.int64) * 668265263 + c * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0


def paint(mask: np.ndarray, colour: str, k: np.ndarray | float = 1.0) -> None:
    kk = k[mask] if isinstance(k, np.ndarray) else k
    img[mask] = rgb(colour) * (kk[..., None] if isinstance(kk, np.ndarray) else kk)


def blend(mask: np.ndarray, colour: str, a: float) -> None:
    img[mask] = img[mask] * (1 - a) + rgb(colour) * a


grain = 1 + (hsh((gx * T).astype(int), (gy * T).astype(int), 11) - 0.5) * 0.05

# ---- the marble: slabs a cell square, each a shade its own, its top and west edges lit and its others shaded, the joints
# between; a faint vein wandering through
slab_tone = 1 + (hsh(np.floor(gx), np.floor(gy), 5) - 0.5) * 0.08
paint(alpha, '#dfbdb1', slab_tone * grain)
vein = np.abs(np.sin(gx * 2.3 + np.sin(gy * 1.3 + gx * 0.4) * 2.1 + np.sin(gy * 0.37) * 3)) < 0.035
blend(alpha & vein & (hsh(np.floor(gx / 2), np.floor(gy / 2), 8) < 0.55), '#c49f94', 0.45)
blend(alpha & ((fy < 0.05) | (fx < 0.05)), '#f3dcd2', 0.45)
blend(alpha & ((fy > 0.93) | (fx > 0.93)), '#a7847b', 0.3)
blend(alpha & ((fy > 0.975) | (fx > 0.975)), '#8f6e66', 0.55)

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
    d = np.minimum(d, np.where(diag[cyi, cxi], np.maximum(fx if ox < 0 else 1 - fx, fy if oy < 0 else 1 - fy), 9))


def carpet(mask: np.ndarray, x0: float, y0: float, x1: float, y1: float) -> None:
    """A crimson carpet over `mask` (its edges x0..x1, y0..y1): a lattice of rose lines in diamonds 0.7 cell across, a
    gilt stud where four meet, a dark edge and a gilt line within it, as the mock-up lays the arms'."""
    size = 0.7
    u, v = (gx + gy) / size, (gx - gy) / size
    weave = 1 + (hsh((gx * T * 2).astype(int), (gy * T).astype(int), 13) - 0.5) * 0.06
    paint(mask, '#8b2a33', weave * (1 + (hsh(np.floor(u), np.floor(v), 3) - 0.5) * 0.06))
    du, dv = np.abs(u - np.round(u)), np.abs(v - np.round(v))
    blend(mask & ((du < 0.045) | (dv < 0.045)), '#c0625f', 0.6)
    blend(mask & (du < 0.11) & (dv < 0.11), '#d9a548', 0.9)
    e = np.minimum.reduce([gx - x0, x1 - gx, gy - y0, y1 - gy])
    blend(mask & (e < 0.05), '#4c1519', 0.9)
    blend(mask & (e >= 0.05) & (e < 0.16), '#6d1d24', 0.85)
    blend(mask & (np.abs(e - 0.11) < 0.025), '#d6a54d', 0.95)


# the arms' carpets, from the kerb to the crossing's piers; the band across the nave's foot
for (x0, y0, x1, y1) in ((2 + KERB, 27 + KERB, 8.9, 35 - KERB), (26.1, 27 + KERB, 33 - KERB, 35 - KERB), (7.6, 56.1, 27.4, 57.3)):
    carpet(alpha & rect(x0, y0, x1 - x0, y1 - y0), x0, y0, x1, y1)

kerb = alpha & (d < KERB)
paint(kerb, '#ecd6cb', (1 + (hsh(np.floor(gx * 2), np.floor(gy * 2), 7) - 0.5) * 0.05) * grain)
blend(kerb & (np.abs(d - KERB) < 0.025), '#9f7f75', 0.9)
blend(kerb & (d < 0.03), '#7d6058', 0.7)
shade = alpha & (d >= KERB) & (d < KERB + 0.6)
img[shade] *= (0.86 + 0.14 * ((d[shade] - KERB) / 0.6) ** 0.7)[..., None]
north = alpha & (dN < 1.2) & (dN >= KERB)
img[north] *= (0.86 + 0.14 * ((dN[north] - KERB) / 1.0).clip(0, 1) ** 0.6)[..., None]


def runner(y0: float, y1: float, width: float) -> None:
    """The Most Holy Hall's runner (holyhall-nave.py): crimson, a gilt border, a gilt cross every so often."""
    x0, x1 = AX - width / 2, AX + width / 2
    m = alpha & (gx >= x0) & (gx < x1) & (gy >= y0) & (gy < y1)
    weave = 1 + (hsh((gx * T * 2).astype(int), (gy * T).astype(int), 13) - 0.5) * 0.06
    paint(m, '#8d2b31', weave)
    e = np.minimum(gx - x0, x1 - gx)
    blend(m & (e < 0.05), '#4c1519', 0.9)
    for at, wd in ((0.13, 0.035), (0.22, 0.02)):
        blend(m & (np.abs(e - at) < wd), '#d6a54d', 0.95)
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
    blend(m & (gy >= y0) & (gy < y0 + 0.12), '#000000', 0.35)


CHOIR_RUNNER = 1.8                 # the runner's width in the choir and down its steps
ALTAR_FOOT = 19.0                  # the high altar's foot (abbey.ts: on row 18), the slab's middle under it
runner(ALTAR_FOOT + PIECE['slab'].height / P / 2 - 0.05, 24.4, CHOIR_RUNNER)
runner(CROSS_MID + 3.35, H, 2.0)
floor, spec = canvas('floor', W, H)
floor = Image.fromarray(np.dstack([np.clip(img, 0, 255), np.where(alpha, 255, 0)]).astype(np.uint8))
GROUND['floor'] = save(floor, spec)
del yy, xx, gx, gy, cxi, cyi, fx, fy, img, alpha, grain, slab_tone, vein, d, dN, dS, dW, dE, kerb, shade, north

# the labyrinth: its square 6.4 cells on a side, its middle the crossing's (a canvas 7 by 8 laid at (14, 27))
lab, spec = canvas('labyrinth', 7, 8)
mx, my = 3.5 * P, (CROSS_MID - 27) * P
L = PIECE['labyrinth']
half = L.width / 2
for k, (sx, sy) in {'span_nw': (-1, -1), 'span_ne': (1, -1), 'span_sw': (-1, 1), 'span_se': (1, 1)}.items():
    s = hard(PIECE[k])
    lab.alpha_composite(s, (round(mx + (0 if sx > 0 else -s.width)), round(my + (0 if sy > 0 else -s.height))))
lab.alpha_composite(hard(L), (round(mx - L.width / 2), round(my - L.height / 2)))
GROUND['labyrinth'] = save(lab, spec)
# the steps: across the choir from its west wall (column 9) to its east (26), their foot the crossing's first row (27);
# a canvas 17 by 5 laid at (9, 22)
steps, spec = canvas('steps', 17, 5)
s = hard(PIECE['steps'])
steps.alpha_composite(s, (round((17 * P - s.width) / 2), 5 * P - s.height))
# the runner down them, the choir's own width: crimson in the stone's own light and shade, so each step's lip and riser
# shows through, its border the floor runner's (a dark edge, two gilt lines)
a = np.array(steps).astype(np.float32)
x0, x1 = round((AX - CHOIR_RUNNER / 2 - 9) * P), round((AX + CHOIR_RUNNER / 2 - 9) * P)
band = a[:, x0:x1]
on = band[..., 3] > 0
lum = band[..., :3].mean(-1)
shade = (lum / np.median(lum[on])).clip(0.35, 1.35)
cols = (np.arange(x1 - x0) + 0.5) / P
e = np.broadcast_to(np.minimum(cols, (x1 - x0) / P - cols), on.shape)
colour = np.broadcast_to(np.array([141, 43, 49], np.float32), band[..., :3].shape).copy()
colour[e < 0.05] = (76, 21, 25)
colour[(np.abs(e - 0.13) < 0.035) | (np.abs(e - 0.22) < 0.02)] = (214, 165, 77)
band[on, :3] = colour[on] * shade[on, None]
a[:, x0:x1] = band
steps = Image.fromarray(a.clip(0, 255).astype(np.uint8))
GROUND['steps'] = save(steps, spec)
# the slab under the high altar, its middle on the altar's foot (a canvas 5 by 4 laid at (15, 17), the altar on its row
# 18)
slab, spec = canvas('slab', 5, 4)
s = hard(PIECE['slab'])
slab.alpha_composite(s, (round((5 * P - s.width) / 2), round((ALTAR_FOOT - 17) * P - s.height / 2)))
GROUND['slab'] = save(slab, spec)
# the stair down: its opening over the stair's cell (the canvas's middle column, its second row), its red step before it
# on the row one comes up onto (a canvas 3 by 3 laid at (2, 32))
stair, spec = canvas('stair', 3, 3)
s = hard(PIECE['stair'])
stair.alpha_composite(s, (round((3 * P - s.width) / 2), round(2.75 * P - s.height)))
GROUND['stair'] = save(stair, spec)
# the pier: standing on the middle of the bottom row of three cells by five
PIER_H = 5
pier, pier_spec = canvas('pier', 3, PIER_H)
s = hard(PIECE['pier'])
pier.alpha_composite(s, (round(1.5 * P - s.width / 2), PIER_H * P - s.height - 2 * K))
save(pier, pier_spec)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['nave_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
by_row = {s['row']: s for s in shell['slices']}

# ---- the stone: the shell as tools/src/art/arch draws it, in a few flat colours at sixteen pixels to the cell, here four
# times as large with each of its stones dressed, as the mock-up's walls are: in the warm pale limestone of the user's own
# apse wall and niches (rather than the renderer's grey rose), each stone a tone its own, a little lighter above than
# below, lit along its top and west edges and shaded along its foot and east, a grain through it, a pore here and there;
# the joints between them thinned to half. The renderer's courses, pilasters, coping and ledges kept as it laid them, and
# its shade (the band of stones it darkens), its stepped edge softened
FACE_C, LIT_C, DASH_C, SHADE_C = (151, 118, 112), (174, 138, 127), (122, 94, 91), (92, 70, 70)
STONE, STONE_LIT, JOINT = rgb('#c09c90'), rgb('#d4b2a4'), rgb('#7a5d59')
IN_SHADE = 0.82


def is_c(a: np.ndarray, c: tuple[int, int, int]) -> np.ndarray:
    return (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2]) & (a[..., 3] > 0)


def dress(src: np.ndarray, ox: int, oy: int) -> np.ndarray:
    """A slice of the bare shell (`src`, its top-left at (ox, oy) on the map in game pixels) four times as large, its
    stones dressed."""
    face, lit, dash, sh = (is_c(src, c) for c in (FACE_C, LIT_C, DASH_C, SHADE_C))
    band = ndimage.binary_opening(dash | sh, np.ones((2, 2), bool))
    stone, joint = face | lit | (dash & band), (dash & ~band) | sh
    up = lambda m: np.repeat(np.repeat(m, K, 0), K, 1)
    out = up(src).astype(np.float32)
    lab = up(ndimage.label(stone)[0])
    S, J, L = up(stone), up(joint), up(lit)
    # the shade: the band's stones and joints darker, its edge soft
    shade = ndimage.gaussian_filter(np.where(up(band), IN_SHADE, 1.0), K * 0.9)
    # each stone grown a pixel into the joints about it, which are left half as wide
    d, (iy, ix) = ndimage.distance_transform_edt(~S, return_indices=True)
    grow = J & (d <= 1.0)
    lab = np.where(grow, lab[iy, ix], lab)
    L = np.where(grow, L[iy, ix], L)
    S = S | grow
    J = J & ~grow
    h, w = lab.shape
    Y, X = np.mgrid[0:h, 0:w]
    gx, gy = ox * K + X, oy * K + Y
    if lab.max():
        boxes = ndimage.find_objects(lab)
        y0 = np.array([0] + [b[0].start if b else 0 for b in boxes]); y1 = np.array([1] + [b[0].stop if b else 1 for b in boxes])
        x0 = np.array([0] + [b[1].start if b else 0 for b in boxes])
        v = ((Y - y0[lab]) / np.maximum(1, y1[lab] - y0[lab])).clip(0, 1)
        tone = 1 + (hsh(ox * K + x0[lab], oy * K + y0[lab], 21) - 0.5) * 0.11
        k = tone * (1.05 - 0.1 * v)
        same = lambda dy, dx: np.roll(np.roll(lab, dy, 0), dx, 1) == lab
        k = np.where(~same(1, 0), k * 1.12, k)                       # its top edge (the pixel above another's)
        k = np.where(~same(0, 1) & same(1, 0), k * 1.05, k)         # its west edge
        k = np.where(~same(-1, 0), k * 0.84, k)                      # its foot
        k = np.where(same(-1, 0) & ~same(-2, 0), k * 0.93, k)
        k = np.where(~same(0, -1) & same(-1, 0), k * 0.92, k)        # its east edge
        k = k * (1 + (hsh(gx, gy, 23) - 0.5) * 0.06) * (1 + (hsh(gx // 3, gy // 3, 24) - 0.5) * 0.05)
        k = np.where(hsh(gx // 2, gy // 2, 25) < 0.012, k * 0.88, k)
        base = np.where(L[..., None], STONE_LIT, STONE)
        out[..., :3] = np.where(S[..., None], base * (k * shade)[..., None], out[..., :3])
    grit = 1 + (hsh(gx, gy, 26) - 0.5) * 0.08
    out[..., :3] = np.where(J[..., None], JOINT * (grit * shade)[..., None], out[..., :3])
    return out.clip(0, 255).astype(np.uint8)


src = np.array(bare)
walls = np.array(bare.resize((bare.width * K, bare.height * K), Image.NEAREST))
for s in shell['slices']:
    x, y, w, h = s['x'], s['y'], s['tw'] * T, s['th'] * T
    walls[y * K:(y + h) * K, x * K:(x + w) * K] = dress(src[y:y + h, x:x + w], s['col'] * T, (s['row'] - s['th'] + 1) * T)
walls = Image.fromarray(walls)

# the bare shell laid out on the map as the game draws it (row by row, each strip over those behind), to measure the
# faces by: how high a face rises at a column, from its foot up to the ceiling's dark over it
laid = Image.new('RGBA', (W * T, H * T))
for s in sorted(shell['slices'], key=lambda s: s['row']):
    laid.alpha_composite(bare.crop((s['x'], s['y'], s['x'] + s['tw'] * T, s['y'] + s['th'] * T)), (s['col'] * T, (s['row'] - s['th'] + 1) * T))
laid = np.array(laid)
DARK = is_c(laid, (42, 37, 48)) | is_c(laid, (30, 27, 35)) | is_c(laid, (20, 27, 27)) | (laid[..., 3] == 0)


def rise(x: float, foot: int) -> int:
    """How high the face standing on `foot` (game pixels) rises at column `x` (cells), its coping counted in."""
    col = DARK[:foot, int(x * T)]
    return foot - (np.nonzero(col)[0].max() + 1)


def lay(img: Image.Image, s: dict, mx: float, my: float) -> None:
    sx = round((s['x'] + mx - s['col'] * T) * K)
    sy = round((s['y'] + my - (s['row'] - s['th'] + 1) * T) * K)
    x0, y0 = s['x'] * K, s['y'] * K
    assert x0 <= sx and y0 <= sy and sx + img.width <= x0 + s['tw'] * T * K and sy + img.height <= y0 + s['th'] * T * K, f'off the strip of row {s["row"]}'
    region = walls.crop((sx, sy, sx + img.width, sy + img.height))
    over = Image.alpha_composite(region, img)
    mask = Image.fromarray(((np.array(region)[..., 3] > 0) * 255).astype(np.uint8))
    walls.paste(over, (sx, sy), mask)


APSE_FACE = PARTS['apse'][1] * T
BAY_FACE = PARTS['choir'][1] * T
ARM_FACE = PARTS['transept'][1] * T
COPING = 6                         # the coping under the ceiling's dark and its shade, kept clear
# the arms' roses: each in the middle of the wall between its door's head and the coping, a banner by each on the side
# toward the choir, its middle with the rose's, halfway from the rose's edge to the arm's end (the west arm's face ends
# with its column 8, the east one mirrored)
door_top = PIECE['door'].height / K
rose_z = (door_top + rise(5.5, ARM_FACE) - COPING - ROSE_W) / 2
arm_end = 9.0
banner_x = ((5.5 * T + ROSE_W / 2) / T + arm_end) / 2
banner_z = rose_z + ROSE_W / 2 - PIECE['banner'].height / K / 2
# the chapels: the carved rose in the middle of the wall over the saint's niche (the Most Holy Hall's altar, standing on
# the chapel's first row, its top `ay` above its anchor at that row's foot), between it and the coping
virgin = json.loads(HOLY_INDEX.read_text())['pieces']['chapel_virgin']
niche_z = virgin['ay'] / K - T
CHAPELS = [(r[0] + r[2] / 2, r[1] * T) for r in (PARTS['chapelW1'], PARTS['chapelW2'], PARTS['chapelE1'], PARTS['chapelE2'])]
HUNG = [
    # the apse: its wall from end to end
    ('apse_wall', APSE_FACE, AX, 0),
    # the choir's bays: the chapels' sheet's niche each, whole, violet to the west, blue to the east, over the saint who
    # stands before it on the floor (abbey.ts)
    ('niche_violet', BAY_FACE, 10.5, NICHE_Z), ('niche_blue', BAY_FACE, 24.5, NICHE_Z),
    # the transept's arms: a tall door under a rose, a banner by it toward the choir
    ('door', ARM_FACE, 5.5, 0), ('door', ARM_FACE, 29.5, 0),
    ('rose_red', ARM_FACE, 5.5, rose_z), ('rose_blue', ARM_FACE, 29.5, rose_z),
    ('banner', ARM_FACE, banner_x, banner_z), ('banner_e', ARM_FACE, 2 * AX - banner_x, banner_z),
    # the chapels' walls
    *[('medallion', face, mid, (niche_z + rise(mid, face) - COPING - MEDAL_W) / 2) for mid, face in CHAPELS],
]
print('rose z', rose_z, 'banner', banner_x, banner_z, 'medallions', [round((niche_z + rise(m, f) - COPING - MEDAL_W) / 2, 1) for m, f in CHAPELS])
for name, face, mid, z in HUNG:
    pic = hard(PIECE[name])
    lay(pic, by_row[face // T - 1], mid * T - pic.width / K / 2, face - z - pic.height / K)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

# the crossing's piers between the choir and the arms (`nave_pier`, a building of its own, abbey.ts lays two), dressed as
# the walls are
pier_wall = json.loads(BUILDINGS.read_text())['buildings']['nave_pier']
pw = np.array(Image.open(LSW / PIER_WALL_SRC).convert('RGBA'))
Image.fromarray(dress(pw, 0, 0)).save(LSW / PIER_WALL_OUT, optimize=True)
print('→', LSW / PIER_WALL_OUT)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'ground': GROUND,
    'pier': pier_spec,
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
    'wallPier': {'img': f'lsw/{PIER_WALL_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in pier_wall['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
