"""The Chapel of the First Dawn on Dawn Hill (the map `chapel`) as the user drew it (2026-11-24): their sheet
(first-dawn-chapel/sheet.png) and mock-up (first-dawn-chapel/ref.png). The sheet is taken as it was painted, only made
smaller, at four pixels to the game's one; the floor is drawn here after its swatches.

- The things (Fixtures/FirstDawnChapel.png, client/src/first-dawn-chapel.json `pieces`): the first hearth, its ring of
  stones round cold ash (the sheet's embers put out: the hearth has been cold for centuries; `hearth_lit` keeps them),
  the old pews broken as the roof left them, the fallen stone. Drawn for those things alone, where they stand
  (catalog.ts placedSprites).
- The floor (Fixtures/FirstDawnChapelFloor.png, `floor`): laid as ground over the whole map (catalog.ts
  `dawnchapel_floor`): the nave's flags two by two to a cell, some cracked, moss in their joints near the grass; the apse
  a dais two steps up; grass where the roof came down, its edge ragged over the flags with earth between; the sheet's
  pebbles, rubble, tufts, flowers, moss and leaves strewn on it.
- The walls (Buildings/FirstDawnChapelWalls.png, `walls`): the chapel's broken walls (`dhchapel_shell`,
  tools/src/art/arch) four times as large, ivy from the sheet hanging from their broken tops, the sun's violet banner
  on the nave's west wall. Each laid in the strip of the wall it hangs on (catalog.ts BUILDINGS.dhchapel_shell).

Run after the walls are drawn and the world is made (it reads the map's cells):

    npx tsx games/openworld/tools/src/art/arch/main.ts dhchapel_shell && npm run gen:world
    python3 games/openworld/tools/src/art/first-dawn-chapel.py [preview-dir]
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent / 'first-dawn-chapel'
GAME = Path(__file__).resolve().parents[3]
LSW = GAME / 'public/assets/lsw'
OUT = 'Fixtures/FirstDawnChapel.png'
FLOOR_OUT = 'Fixtures/FirstDawnChapelFloor.png'
WALLS_OUT = 'Buildings/FirstDawnChapelWalls.png'
SHELL = 'Buildings/dhchapel_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
MAP = GAME / 'public/world/maps/chapel.json'
INDEX = GAME / 'client/src/first-dawn-chapel.json'
T = 16
K = 4
P = T * K  # a cell, in these pictures' pixels
rng = np.random.default_rng(20261124)

def sheet(name: str) -> Image.Image:
    raw = np.array(Image.open(HERE / name).convert('RGBA'))
    raw[raw[..., 3] < 96] = 0
    return Image.fromarray(raw)


# the user's sheets: the first (pews, banners, the ring, stones, weeds, the floor's swatches), the candlesticks and the
# bell's beam (extras.png), the windows (windows.png)
SHEET, EXTRAS, WINDOWS, STONES = sheet('sheet.png'), sheet('extras.png'), sheet('windows.png'), sheet('stones.png')
# the game's own stones (the art pack's nature tiles, a tile 16 pixels), drawn four times as large as the pack is
NATURE = Image.open(GAME / 'public/assets/na/Backgrounds/Tilesets/TilesetNature.png').convert('RGBA')


def stone_of_the_game(x: int, y: int, w: int = 16, h: int = 16) -> Image.Image:
    p = NATURE.crop((x, y, x + w, y + h))
    return p.crop(p.getbbox()).resize((p.crop(p.getbbox()).width * K, p.crop(p.getbbox()).height * K), Image.NEAREST)


def taken(box: tuple[int, int, int, int], width: float, src: Image.Image | None = None) -> Image.Image:
    """A piece of a sheet, `width` game pixels wide (premultiplied, so no fringe bleeds in)."""
    p = (src or SHEET).crop(box).convert('RGBa')
    s = width * K / p.width
    p = p.resize((max(1, round(p.width * s)), max(1, round(p.height * s))), Image.LANCZOS).convert('RGBA')
    a = np.array(p)
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


def cold(img: Image.Image) -> Image.Image:
    """The embers put out: what glows red and orange in the ring turned to grey ash, as dark or light as it was."""
    a = np.array(img).astype(float)
    f = a[..., :3] / 255
    hsv = np.array([[colorsys.rgb_to_hsv(*p) for p in row] for row in f])
    ember = (a[..., 3] > 0) & (hsv[..., 1] > 0.45) & ((hsv[..., 0] < 0.11) | (hsv[..., 0] > 0.93))
    lum = f @ [0.299, 0.587, 0.114]
    ash = np.clip(40 + lum * 120, 0, 255)
    a[ember, 0], a[ember, 1], a[ember, 2] = ash[ember] * 0.98, ash[ember] * 0.96, ash[ember]
    return Image.fromarray(a.round().astype(np.uint8))


# ------------------------------------------------------------------------------------------------ the sheet's pieces
RING = (146, 351, 483, 513)  # the ring with the pebbles beside it
PIECES_SRC = {
    'pew': ((103, 112, 408, 311), 44),
    'pew_broken': ((465, 112, 771, 311), 44),
    'pew_overgrown': ((821, 112, 1126, 311), 44),
    'banner': ((1180, 96, 1303, 311), 15),
    'banner_sun': ((1342, 96, 1465, 314), 15),
    'block': ((583, 383, 735, 503), 26),
    'block_small': ((763, 401, 889, 498), 15),
    'rubble': ((1121, 371, 1334, 489), 30),
    'chunk': ((1352, 416, 1432, 482), 10),
    'pebbles': ((933, 439, 991, 480), 7),
    'pebble_a': ((975, 405, 1023, 441), 5),
    'pebble_b': ((1013, 451, 1043, 477), 3),
    'vine_full': ((94, 546, 195, 753), 13),
    'vine_mid': ((232, 551, 291, 702), 8),
    'vine_thin': ((339, 552, 376, 712), 5),
    'vine_branch': ((418, 559, 559, 683), 17),
    'vine_wide': ((589, 547, 737, 725), 18),
    'leaves': ((784, 577, 891, 650), 12),
    'leaf_a': ((921, 587, 990, 641), 8),
    'leaf_b': ((1011, 590, 1059, 638), 6),
    'tuft': ((703, 670, 805, 736), 12),
    'tuft_mid': ((834, 680, 922, 736), 10),
    'tuft_small': ((953, 698, 1017, 736), 7),
    'flowers': ((1066, 677, 1159, 740), 11),
    'flower': ((1186, 688, 1240, 736), 6),
    'moss': ((1266, 687, 1386, 730), 14),
    'moss_small': ((1400, 704, 1454, 728), 6),
}
PIECE = {name: taken(box, w) for name, (box, w) in PIECES_SRC.items()}
PIECE.update({
    'candle_a': taken((362, 206, 551, 701), 11, EXTRAS),
    'candle_b': taken((713, 219, 902, 701), 11, EXTRAS),
    'bell': taken((1085, 160, 1494, 701), 40, EXTRAS),
    'window_tall': taken((107, 56, 354, 484), 32, WINDOWS),
    'window_narrow': taken((405, 93, 568, 484), 13, WINDOWS),
    'window_broken': taken((627, 156, 847, 484), 18, WINDOWS),
    # the stones (stones.png): pebbles, a few together, heaps, a squared block, a broken slab, a chunk of the wall
    'r_pebbles': taken((108, 327, 232, 430), 9, STONES),
    'r_group': taken((338, 283, 577, 445), 16, STONES),
    'r_heap': taken((651, 229, 1021, 454), 26, STONES),
    'r_block': taken((1112, 279, 1363, 454), 22, STONES),
    'r_slab': taken((45, 671, 309, 826), 18, STONES),
    'r_chunk': taken((365, 616, 586, 830), 14, STONES),
    'r_low': taken((646, 662, 995, 821), 22, STONES),
    'r_pile': taken((1048, 573, 1407, 842), 24, STONES),
})
PIECE['hearth_lit'] = taken(RING, 40)
PIECE['hearth'] = cold(PIECE['hearth_lit'])

# the things on the floor: the picture, how far its middle stands east of its cell's, how far its foot stands above its
# cell's bottom edge (game pixels; under it, less than none)
FLOOR_THINGS = {
    'hearth': (0, 1), 'hearth_lit': (0, 1),
    'pew': (0, -4), 'pew_broken': (0, -4), 'pew_overgrown': (0, -4),
    'block': (0, -1),
    'candle_a': (0, 3), 'candle_b': (0, 3),
    'r_block': (0, -1),
}


def pack(cut: dict[str, Image.Image], width: int) -> tuple[Image.Image, dict[str, tuple[int, int]]]:
    at, x, y, shelf = {}, 0, 0, 0
    for name, img in cut.items():
        if x + img.width > width:
            x, y, shelf = 0, y + shelf + 2, 0
        at[name] = (x, y)
        x += img.width + 2
        shelf = max(shelf, img.height)
    sheet = Image.new('RGBA', (width, y + shelf))
    for name, img in cut.items():
        sheet.alpha_composite(img, at[name])
    return sheet, at


things, at = pack({n: PIECE[n] for n in FLOOR_THINGS}, 512)
pieces = {}
for name, (east, foot) in FLOOR_THINGS.items():
    img = PIECE[name]
    x, y = at[name]
    pieces[name] = {'x': x, 'y': y, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
things.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, things.size)

# ------------------------------------------------------------------------------------------------ the floor
chunk = json.loads(MAP.read_text())['map']
rows = chunk['rows']
H, W = len(rows), len(rows[0])
FLAGS, GRASS = set('F'), set('.')
cell = np.array([[1 if c in FLAGS else 2 if c in GRASS else 0 for c in r] for r in rows])
# the plan (tools/src/art/arch/plans.ts dhchapel, the map's TOP rows of the dark over it): the apse, a dais
TOP = 7
APSE = (6, 1 + TOP, 5, 2)

STONE = np.array([156, 142, 120], float)
GROUT = np.array([124, 112, 95], float)  # (faint: the flags' joints barely darker than the flags)
EARTH = np.array([134, 108, 78], float)


def grass_texture() -> np.ndarray:
    """The sheet's grass swatch, its middle (no rim), a cell of it."""
    g = SHEET.crop((712 + 12, 799 + 12, 844 - 12, 934 - 12)).convert('RGB').resize((P, P), Image.LANCZOS)
    return np.array(g).astype(float)


GRASS_TEX = grass_texture()
img = np.zeros((H * P, W * P, 4), float)
yy, xx = np.mgrid[0:P, 0:P]
for cy in range(H):
    for cx in range(W):
        if not cell[cy, cx]:
            continue
        # a flag to a cell (now and then two), each its own shade; a light bevel on its top and west, dark on its foot
        # and east, a thin dark joint round it
        tile = np.zeros((P, P, 3))
        parts = [(0, 0, P, P)] if rng.random() < 0.8 else ([(0, 0, P // 2, P), (P // 2, 0, P // 2, P)] if rng.random() < 0.5 else [(0, 0, P, P // 2), (0, P // 2, P, P // 2)])
        for fx, fy, fw, fh in parts:
            tone = 1 + rng.uniform(-0.05, 0.04)
            u, v = xx[fy:fy + fh, fx:fx + fw] - fx, yy[fy:fy + fh, fx:fx + fw] - fy
            c = np.broadcast_to(STONE * tone, (fh, fw, 3)).copy()
            c *= (1 + rng.normal(0, 0.02, (fh, fw)))[..., None]
            c[(v < 4) | (u < 4)] *= 1.06
            c[(v >= fh - 4) | (u >= fw - 4)] *= 0.92
            c[(v < 1) | (u < 1) | (v >= fh - 1) | (u >= fw - 1)] = GROUT
            tile[fy:fy + fh, fx:fx + fw] = c
            # a crack across some of them: a jagged dark line, lit along its lower edge
            if rng.random() < 0.2:
                px, py = rng.integers(8, fw - 8), 2
                while py < fh - 6:
                    nx, ny = int(np.clip(px + rng.integers(-7, 8), 4, fw - 5)), min(fh - 4, py + int(rng.integers(3, 8)))
                    for t in np.linspace(0, 1, 14):
                        qx, qy = int(round(px + (nx - px) * t)), int(round(py + (ny - py) * t))
                        tile[fy + qy, fx + qx] = GROUT * 0.8
                        tile[fy + qy + 1, fx + qx] = STONE * 1.06
                    px, py = nx, ny
                    if rng.random() < 0.3:
                        break
        # the apse a dais, its flags paler
        ax, ay, aw, ah = APSE
        if ax <= cx < ax + aw and ay <= cy < ay + ah:
            tile *= 1.06
        img[cy * P:(cy + 1) * P, cx * P:(cx + 1) * P, :3] = tile
        img[cy * P:(cy + 1) * P, cx * P:(cx + 1) * P, 3] = 255

# the grass where the roof came down, its edge ragged over the flags, earth between: by a soft field of the grass cells
field = np.kron((cell == 2).astype(float), np.ones((P, P)))
field = np.array(Image.fromarray((field * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))).astype(float) / 255
noise = np.array(Image.fromarray((rng.random((H * 4, W * 4)) * 255).astype(np.uint8)).resize((W * P, H * P), Image.BICUBIC)).astype(float) / 255
field = field + (noise - 0.5) * 0.45
ground = img[..., 3] > 0
gt = np.tile(GRASS_TEX, (H, W, 1))
grass = ground & (field > 0.5)
earth = ground & (field > 0.36) & ~grass
img[earth, :3] = EARTH * (1 + (noise[earth, None] - 0.5) * 0.25)
img[grass, :3] = gt[grass]
# moss in the joints near the grass
joint = ground & ~grass & ~earth & (np.abs(img[..., :3] - GROUT).sum(2) < 12) & (field + (noise - 0.5) * 0.3 > 0.27)
img[joint, :3] = np.array([128, 150, 60]) * (0.85 + noise[joint, None] * 0.3)

# the dais's two steps down to the nave, across the apse's foot
ax, ay, aw, ah = APSE
x0, x1 = ax * P, (ax + aw) * P
foot = (ay + ah) * P
for top, h, k in ((foot - 28, 6, 1.12), (foot - 22, 8, 0.78), (foot - 14, 6, 1.1), (foot - 8, 8, 0.74)):
    img[top:top + h, x0:x1, :3] = STONE * k
img[foot - 28:foot - 27, x0:x1, :3] = GROUT * 0.8

floor = Image.fromarray(np.clip(img, 0, 255).round().astype(np.uint8))

# under the walls and a cell round them, the dark ground the mock-up has outside the chapel: the walls stand on it (the
# game would otherwise lay the ground round a wall under it, the grass beside it as grass)
DUSK = np.array([52, 42, 56, 255], np.uint8)
fl = np.array(floor)
for cy in range(H):
    for cx in range(W):
        near = any(0 <= cy + dy < H and 0 <= cx + dx < W and rows[cy + dy][cx + dx] != 'V' for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        if rows[cy][cx] == 'X' or (rows[cy][cx] == 'V' and near):
            fl[cy * P:(cy + 1) * P, cx * P:(cx + 1) * P] = DUSK
floor = Image.fromarray(fl)

# what lies on it (the piece, its middle in cells — x, y — from the map's top-left): as the mock-up strews them
STREWN = [
    ('tuft', 8.5, 11.4), ('tuft_small', 8.2, 12.6), ('tuft_mid', 8.8, 13.6), ('tuft_small', 4.6, 16.7), ('tuft_mid', 3.6, 18.4),
    ('tuft_small', 12.0, 10.6), ('tuft_mid', 6.6, 10.5), ('tuft_small', 17.6, 12.9), ('tuft', 17.3, 14.3),
    ('r_heap', 12.4, 10.8), ('r_group', 13.2, 13.7), ('r_pebbles', 3.8, 17.7), ('r_pebbles', 17.6, 13.9), ('r_pebbles', 12.7, 17.8),
    ('r_slab', 9.6, 18.3), ('r_low', 3.9, 10.7), ('r_chunk', 10.3, 16.7), ('r_pebbles', 16.2, 10.9),
    ('flowers', 11.3, 16.6), ('flower', 12.7, 17.0), ('flower', 10.4, 17.9), ('flowers', 13.1, 15.6),
    ('moss', 10.0, 14.6), ('moss_small', 4.3, 11.6), ('moss_small', 7.3, 17.3), ('moss', 3.6, 14.0),
    ('leaves', 3.6, 12.0), ('leaf_a', 6.9, 9.6), ('leaf_b', 10.5, 9.7), ('leaf_a', 12.7, 11.8), ('leaf_b', 17.4, 10.6),
]
for name, cx, cy in STREWN:
    p = PIECE[name]
    floor.alpha_composite(p, (round(cx * P - p.width / 2), round(cy * P - p.height / 2)))
floor.save(LSW / FLOOR_OUT, optimize=True)
print('→', LSW / FLOOR_OUT, floor.size)

# ------------------------------------------------------------------------------------------------ the walls
# Every wall of the chapel drawn here, cell by cell, in the strips of the chapel's own walls (dhchapel_shell, whose
# pictures only make the strips): its north walls as fronts of coursed stone to a top that has fallen block by block —
# a block stays only where one below still bears it — with the wall's thickness along that top; the apse's back wall
# rising to its gable over the great window; the piers standing out of the walls on their plinths, their caps over
# them, a side in shadow; the low walls round the rest, their tops seen from above as thick as they are. Drawn at two
# pixels to the game's one (doubled into the strips): every edge hard.
shell = json.loads(BUILDINGS.read_text())['buildings']['dhchapel_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = np.zeros((bare.height * K, bare.width * K, 4), np.uint8)
A = 2  # this drawing's pixels to the game's one
WALL = set('X')
wall_at = lambda x, y: 0 <= y < H and 0 <= x < W and rows[y][x] in WALL

# (warm sandstone, as the mock-up's: its tops pale, its fronts the sand, the joints and the ink a dark brown)
FACE = np.array([212, 178, 140], float)
TOPC = np.array([242, 208, 168], float)
MORTAR = np.array([158, 126, 96], float)
HOLE = np.array([104, 80, 62], float)
INK = np.array([52, 38, 34], float)
MOSS = np.array([122, 142, 56], float)
CH = 7 * A  # a course, in this drawing's pixels

layers: dict[int, np.ndarray] = {}


def layer(row: int) -> np.ndarray:
    if row not in layers:
        layers[row] = np.zeros((H * T * A, W * T * A, 4), float)
    return layers[row]


def plot(L: np.ndarray, y: int, x: int, rgb) -> None:
    if 0 <= y < L.shape[0] and 0 <= x < L.shape[1]:
        L[y, x, :3] = np.clip(rgb, 0, 255)
        L[y, x, 3] = 255


def courses(x0: int, x1: int, n: int, seed: int) -> list[list[list]]:
    """The blocks of n courses from x0 to x1: each course its blocks [start, end, tone, chip, crack], half a block over."""
    r = np.random.default_rng(seed)
    out = []
    for k in range(n):
        blocks, x = [], x0 - int(r.integers(0, 14 * A)) if k % 2 else x0 - int(r.integers(0, 6 * A))
        while x < x1:
            ln = int(r.integers(12 * A, 21 * A))
            blocks.append([x, x + ln, 1 + r.uniform(-0.07, 0.06), r.choice(['', '', '', '', 'l', 'r']), r.random() < 0.03, True])
            x += ln
        out.append(blocks)
    return out


def brick(L, y, x, b, v, u_from, base_tone=1.0):
    """A pixel of a block: v rows down from the course's top, u across from its start."""
    ln = b[1] - b[0]
    u = x - b[0]
    if v == CH - 1 or u == 0:
        return MORTAR
    c = FACE * b[2] * base_tone
    if v == 0:
        c = c * 1.1
    elif v == CH - 2:
        c = c * 0.88
    if u == 1:
        c = c * 1.05
    elif u == ln - 1:
        c = c * 0.9
    if b[3] == 'l' and v < 3 and u < 4 or b[3] == 'r' and v < 3 and u > ln - 5:
        return HOLE * 1.1
    if b[4] and abs((u - ln * 0.3) - v * 0.9) < 0.6:
        return INK * 1.25
    if rng.random() < 0.05:
        c = c * 0.9
    return c


def front(row: int, base: int, x0c: float, x1c: float, keys: list[tuple[float, float]], seed: int, top_d: int = 10,
          pier: bool = False, keep: list[tuple[float, float, float]] = ()) -> np.ndarray:
    """A wall's front from the map's x0c to x1c (cells) standing on `base` (game pixels down the map), as high as `keys`
    say ((cell, height) between which it runs straight), its blocks fallen as they would; `keep` holds it up to at least
    a height over a span (cells: from, to, height: a window's top). Returns its top per column (game pixels)."""
    L = layer(row)
    x0, x1 = round(x0c * T * A), round(x1c * T * A)
    yb = base * A
    want = np.interp(np.arange(x0, x1) / (T * A), [k[0] for k in keys], [k[1] for k in keys]) * A
    for a_, b_, hk in keep:
        m = (np.arange(x0, x1) >= a_ * T * A) & (np.arange(x0, x1) < b_ * T * A)
        want[m] = np.maximum(want[m], hk * A)
    n = int(want.max() // CH) + 2
    cs = courses(x0, x1, n, seed)
    r = np.random.default_rng(seed + 1)
    for k in range(n):
        for bl in cs[k]:
            lo, hi = max(bl[0], x0), min(bl[1], x1)
            if hi <= lo:
                bl[5] = False
                continue
            w = want[(lo + hi) // 2 - x0]
            top = (k + 1) * CH
            # (the top courses fall unevenly: a block may be gone a course or two under the wall's line, or stand over it)
            bl[5] = top <= w + (r.uniform(-0.5, 0.3) * CH if pier else r.choice([-1.6, -1.0, -0.6, -0.2, 0.2, 0.4]) * CH)
            if k and bl[5]:
                under = sum(max(0, min(hi, c[1]) - max(lo, c[0])) for c in cs[k - 1] if c[5])
                bl[5] = under >= 0.45 * (hi - lo)
    # the top of each column, and what stands at each course of it (a block, or the hole where one fell)
    tops = np.zeros(x1 - x0, int)
    for k in range(n):
        for bl in cs[k]:
            if bl[5]:
                tops[max(bl[0], x0) - x0:min(bl[1], x1) - x0] = (k + 1) * CH
    for x in range(x0, x1):
        zt = tops[x - x0]
        for z in range(zt):
            k = z // CH
            bl = next((c for c in cs[k] if c[0] <= x < c[1]), None)
            y = yb - 1 - z
            v = CH - 1 - (z % CH)
            if bl is None or not bl[5]:
                plot(L, y, x, HOLE * (0.85 if v > 1 else 1.0))
                continue
            c = brick(L, y, x, bl, v, 0, 0.93 if z < 2 * CH else 1.0)
            if z < CH and r.random() < 0.06:
                c = MOSS * r.uniform(0.85, 1.1)
            plot(L, y, x, c)
        # its thickness: the top of the wall seen from above, as deep as top_d
        d = top_d * A
        for t in range(d):
            y = yb - zt - d + t
            if t == 0:
                c = INK
            elif t == d - 1:
                c = TOPC * 1.08
            elif t == d // 2:
                c = TOPC * 0.9
            else:
                c = TOPC * (0.97 + 0.06 * ((x // (12 * A) + (t > d // 2)) % 2))
                if rng.random() < 0.04:
                    c = c * 0.9
            plot(L, y, x, c)
    # where the top steps down: a dark edge down the higher block's side, a shadow on the lower top beside it
    for x in range(x0 + 1, x1):
        z0, z1 = tops[x - 1 - x0], tops[x - x0]
        if z0 == z1:
            continue
        hi_x, lo_x, zh, zl = (x - 1, x, z0, z1) if z0 > z1 else (x, x - 1, z1, z0)
        d = top_d * A
        for y in range(yb - zh - d, yb - zl - d + 1):
            plot(L, y, hi_x, INK)
        for y in range(yb - zl - d, yb - zl):
            sx = lo_x + (1 if lo_x > hi_x else -1)
            plot(L, y, lo_x, L[y, lo_x, :3] * 0.8)
            plot(L, y, sx, L[y, sx, :3] * 0.88)
    if pier:
        # a pier's sides: its west lit, its east a face in shadow, both edged; its plinth and its cap a block wider
        for x in (x0, x0 + 1):
            for y in range(yb - tops[x - x0] - top_d * A, yb):
                plot(L, y, x, INK if x == x0 else L[y, x, :3] * 1.08)
        for x in range(x1 - 3 * A, x1):
            for y in range(yb - tops[x - x0] - top_d * A + 1, yb):
                plot(L, y, x, INK if x == x1 - 1 else L[y, x, :3] * 0.8)
        for z in range(0, CH):
            for x in list(range(x0 - A, x0)) + list(range(x1, x1 + A)):
                plot(L, yb - 1 - z, x, INK if z == CH - 1 or x in (x0 - A, x1 + A - 1) else FACE * (1.0 if x < x0 else 0.82))
        zc = int(tops.min())
        for z in range(zc - CH // 2, zc):
            for x in list(range(x0 - A, x0)) + list(range(x1, x1 + A)):
                plot(L, yb - 1 - z, x, INK if z == zc - 1 or x in (x0 - A, x1 + A - 1) else TOPC * (1.02 if x < x0 else 0.84))
    return tops / A


# The low walls round the rest of the chapel: a band of stone along the floor's edge, a little more than a third of a
# cell thick, its top seen from above and its face where it looks south; a post a little higher at its corners and
# its ends; broken low here and there. Laid out at this drawing's scale as a field of heights over the map (what of
# each cell it stands on), and drawn from it as the game sees things: tops raised by their height, faces under them.
BAND = 7  # game pixels thick
FLOORISH = set('F.D')
floor_at = lambda x, y: 0 <= y < H and 0 <= x < W and rows[y][x] in FLOORISH


def low_walls(cells: set[tuple[int, int]]) -> None:
    hf = np.zeros((H * T * A, W * T * A), int)  # the height of the low wall standing on each point, game pixels
    along = np.zeros_like(hf)  # 1 where its stones run east-west, 2 north-south
    bw, c = BAND * A, T * A
    for (cx, cy) in cells:
        x0, y0 = cx * c, cy * c
        h = 7 - 3 * int((cx * 5 + cy * 11) % 9 == 0)
        sides = {'n': floor_at(cx, cy - 1), 's': floor_at(cx, cy + 1), 'w': floor_at(cx - 1, cy), 'e': floor_at(cx + 1, cy)}
        if sides['n']:
            hf[y0:y0 + bw, x0:x0 + c], along[y0:y0 + bw, x0:x0 + c] = h, 1
        if sides['s']:
            hf[y0 + c - bw:y0 + c, x0:x0 + c], along[y0 + c - bw:y0 + c, x0:x0 + c] = h, 1
        if sides['w']:
            hf[y0:y0 + c, x0:x0 + bw], along[y0:y0 + c, x0:x0 + bw] = h, 2
        if sides['e']:
            hf[y0:y0 + c, x0 + c - bw:x0 + c], along[y0:y0 + c, x0 + c - bw:x0 + c] = h, 2
        # where only a corner of the floor touches it: a post on that corner
        for dx, dy, px, py in ((-1, -1, 0, 0), (1, -1, c - bw, 0), (-1, 1, 0, c - bw), (1, 1, c - bw, c - bw)):
            if floor_at(cx + dx, cy + dy) and not floor_at(cx + dx, cy) and not floor_at(cx, cy + dy):
                hf[y0 + py:y0 + py + bw, x0 + px:x0 + px + bw] = 11
        # posts where the band turns, and where it meets the rest of the walls
        turns = (sides['n'] or sides['s']) and (sides['w'] or sides['e'])
        if turns:
            for dx, dy in ((0, 0), (c - bw, 0), (0, c - bw), (c - bw, c - bw)):
                blk = hf[y0 + dy:y0 + dy + bw, x0 + dx:x0 + dx + bw]
                if (blk > 0).all():
                    blk[:] = 11
    # draw it: each point's top raised by its height, its face below where the ground south of it is lower
    for yf in range(hf.shape[0]):
        row = yf // c
        L = layer(row)
        for xf in np.where(hf[yf] > 0)[0]:
            h = hf[yf, xf] * A
            hs = hf[yf + 1, xf] * A if yf + 1 < hf.shape[0] else 0
            o = along[yf, xf]
            g = (xf if o == 1 else yf)
            jt = (g // (A * 26)) != ((g - 1) // (A * 26)) or (h >= 11 * A)
            top = TOPC * (0.98 + 0.05 * ((g // (A * 26)) % 2))
            if jt and h < 11 * A and o:
                top = MORTAR * 1.25
            if rng.random() < 0.05:
                top = top * 0.92
            plot(L, yf - h, xf, top)
            for z in range(hs, h):
                y = yf - z
                v = h - 1 - z
                cc = FACE * (0.96 + 0.06 * ((xf // (A * 26)) % 2))
                if v == 0:
                    cc = TOPC * 1.05
                elif (xf // (A * 26)) != ((xf - 1) // (A * 26)) or (z == CH // 2 and h > CH):
                    cc = MORTAR
                elif z < 2:
                    cc = cc * 0.85
                plot(L, y, xf, cc)


# the north fronts (the row whose strip each is drawn in, the line it stands on, from and to in cells, its heights,
# what holds it up): as ref.png draws them
NAVE_FACE, APSE_FACE, PIER_FACE = (3 + TOP) * T, APSE[1] * T, (5 + TOP) * T
FRONTS = [
    (9, NAVE_FACE, 3, 5, [(3, 40), (3.5, 52), (4.0, 70), (4.6, 82), (5, 86)], [(3.55, 4.65, 72)], False),
    (7, APSE_FACE, 6, 11, [(6, 40), (6.8, 58), (7.6, 72), (8.5, 94), (9.4, 72), (10.2, 52), (11, 36)], [(7.4, 9.6, 68)], False),
    (9, NAVE_FACE, 12, 14, [(12, 90), (12.6, 82), (13.2, 60), (13.7, 50), (14, 44)], [(12.1, 13.1, 76)], False),
    (9, NAVE_FACE, 15, 18, [(15, 62), (15.8, 58), (16.5, 66), (17.3, 54), (18, 48)], [(15, 18, 50)], False),
]
PIERS = [  # (row, base, x, height)
    (9, NAVE_FACE, 2, 64), (9, NAVE_FACE, 5, 104), (9, NAVE_FACE, 11, 100), (11, PIER_FACE, 14, 98), (11, PIER_FACE, 18, 90),
]
covered = {(2, 9), (5, 7), (5, 8), (5, 9), (11, 7), (11, 8), (11, 9), (14, 9), (14, 10), (14, 11), (18, 9), (18, 10), (18, 11)}
for x in range(6, 11):
    covered.add((x, 7))
covered |= {(x, 9) for x in (3, 4, 12, 13, 15, 16, 17)}
# the low walls round the rest: a little broken here and there
low_walls({(x, y) for y in range(H) for x in range(W) if wall_at(x, y) and (x, y) not in covered})

fronts_top = {}
for i, (row, base, x0c, x1c, keys, keep, _) in enumerate(FRONTS):
    fronts_top[i] = front(row, base, x0c, x1c, keys, 9000 + i, keep=keep)
for i, (row, base, x, h) in enumerate(PIERS):
    front(row, base, x, x + 1, [(x, h), (x + 1, h)], 9100 + i, top_d=8, pier=True)


for L in layers.values():
    on = L[..., 3] > 0
    edge = on & ~(np.roll(on, 1, 0) & np.roll(on, -1, 0) & np.roll(on, 1, 1) & np.roll(on, -1, 1))
    L[edge, :3] = INK


def set_into(row: int, img: Image.Image, mx: float, my: float, frame: bool = True) -> None:
    """A picture set into a wall drawn in a row (its top-left at the map's mx, my): its edge hard, the wall's joint round
    it and the wall's shadow inside its east and lower edges, as though the stone were cut for it."""
    L = layer(row)
    a = np.array(img.resize((round(img.width / K * A), round(img.height / K * A)), Image.LANCZOS)).astype(float)
    ox, oy = round(mx * A), round(my * A)
    on = a[..., 3] >= 128
    if frame:
        hgt, wid = on.shape
        for j in range(-1, hgt + 1):
            for i in range(-1, wid + 1):
                inside = 0 <= j < hgt and 0 <= i < wid and on[j, i]
                if inside:
                    continue
                near = any(0 <= j + dj < hgt and 0 <= i + di < wid and on[j + dj, i + di] for dj, di in ((0, 1), (0, -1), (1, 0), (-1, 0)))
                y, x = oy + j, ox + i
                if near and 0 <= y < L.shape[0] and L[y, x, 3] > 0:
                    plot(L, y, x, MORTAR * 0.8)
    for j, i in zip(*np.where(on)):
        plot(L, oy + j, ox + i, a[j, i, :3])


# the windows set into the walls, the banner hung under the west one
for row, face, mid, z, name in ((7, APSE_FACE, 8.5, 6, 'window_tall'), (9, NAVE_FACE, 4.1, 36, 'window_narrow'), (9, NAVE_FACE, 12.6, 40, 'window_narrow')):
    p = PIECE[name]
    set_into(row, p, mid * T - p.width / K / 2, face - z - p.height / K)
p = PIECE['banner_sun']
set_into(9, p, 4.1 * T - p.width / K / 2, NAVE_FACE - 3 - p.height / K, frame=False)

# the ivy: from the broken tops down the walls, down the piers' sides, out of the joints low on the west wall
def top_y(i: int, xc: float) -> float:
    row, base, x0c, x1c, *_ = FRONTS[i]
    return base - fronts_top[i][min(len(fronts_top[i]) - 1, max(0, round((xc - x0c) * T * A)))]


for name, row, xc, y in (
    ('vine_full', 9, 2.75, NAVE_FACE - 64 - 7), ('vine_mid', 7, 6.9, top_y(1, 6.9) - 1), ('vine_wide', 7, 10.15, top_y(1, 10.15) - 1),
    ('vine_branch', 9, 12.0, NAVE_FACE - 100 - 6), ('vine_thin', 9, 13.55, top_y(2, 13.55) - 1), ('vine_mid', 11, 14.75, PIER_FACE - 98 - 6),
    ('vine_mid', 11, 18.3, PIER_FACE - 90 - 6), ('leaf_a', 9, 3.4, NAVE_FACE - 9), ('leaves', 9, 13.3, NAVE_FACE - 9),
):
    p = PIECE[name]
    set_into(row, p, xc * T - p.width / K / 2, y, frame=False)

# into the strips: each row's drawing, doubled, where its strip lies on the sheet
for s in shell['slices']:
    x0, y0 = s['col'] * T * A, (s['row'] - s['th'] + 1) * T * A
    x1, y1 = x0 + s['tw'] * T * A, (s['row'] + 1) * T * A
    L = layers.get(s['row'])
    if L is None:
        continue
    part = np.clip(L[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    big = np.array(Image.fromarray(part).resize((part.shape[1] * K // A, part.shape[0] * K // A), Image.NEAREST))
    walls[s['y'] * K:s['y'] * K + big.shape[0], s['x'] * K:s['x'] * K + big.shape[1]] = big
for row, L in layers.items():
    if row not in {s['row'] for s in shell['slices']} and (L[..., 3] > 0).any():
        print('  (nothing to lay row', row, 'in)')
walls = Image.fromarray(walls)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

# the bell's beam, long enough to sit in the piers either side of the tower (they stand in front of its ends), and its
# rope down the middle: a picture five cells across and four high (catalog.ts dawnchapel_bell; vigil.ts hangs it)
BELL_OUT = 'Fixtures/FirstDawnChapelBell.png'
b = PIECE['bell']
bh = round(b.height * 0.27)
beam = b.crop((0, 0, b.width, bh)).resize((58 * K, bh), Image.NEAREST)
rope = b.crop((0, bh, b.width, b.height))
bell = Image.new('RGBA', (5 * P, 4 * P))
bell.alpha_composite(beam, (round(2.5 * P - beam.width / 2), 0))
bell.alpha_composite(rope, (round(2.5 * P - rope.width / 2), bh))
a_ = np.array(bell)
a_[..., 3] = np.where(a_[..., 3] >= 128, 255, 0)
Image.fromarray(a_).save(LSW / BELL_OUT, optimize=True)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'floor': {'img': f'lsw/{FLOOR_OUT}', 'tw': W, 'th': H, 'pixelsPerTile': P},
    'bell': {'img': f'lsw/{BELL_OUT}', 'tw': 5, 'th': 4, 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)

if len(sys.argv) > 1:
    view = Path(sys.argv[1])
    whole = Image.new('RGBA', (W * P, H * P), (20, 20, 26, 255))
    whole.alpha_composite(floor)
    for s in sorted(shell['slices'], key=lambda s: s['row']):
        st = walls.crop((s['x'] * K, s['y'] * K, (s['x'] + s['tw'] * T) * K, (s['y'] + s['th'] * T) * K))
        whole.alpha_composite(st, (s['col'] * P, (s['row'] - s['th'] + 1) * P))
    whole.resize((W * 32, H * 32), Image.LANCZOS).save(view / 'first-dawn-raw.png')
