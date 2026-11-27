"""Firstlight's chapel (meadow.church) as the user drew it (2026-11-24): its altar of the five wounds and what stands in it,
and the pictures on its walls, from the user's sheet (firstlight-chapel/sheet.png) and pew (firstlight-chapel/pew.png),
laid out as the mock-ups show (firstlight-chapel/ref-layout.png the room, ref-walls.png the walls). The sheet is taken
as it was painted, only made smaller, never redrawn, at four pixels to the game's one (drawn at a quarter); what the
sheet marks in red (the beds, the bookshelf, the potted plants) is not taken: those keep the game's own pictures.

- The things on the floor (Fixtures/FirstlightChapel.png, client/src/firstlight-chapel.json `pieces`): the stone altar
  on its two steps (`fixture:stone_altar`, four cells wide), the candles in threes either side of it, lit and cold, the
  pew, the sister's desk and its stool, the brother's night table with its lantern. The catalogue draws them in the
  chapel alone (its theme `chapel`, catalog.ts), the altar wherever a stone altar stands.
- The walls (Buildings/FirstlightChapelWalls.png, `walls`): the chapel's own walls (`flchurch_shell`, drawn bare by
  tools/src/art/arch: stone, its pilasters and course) made four times as large, and on them, where the mock-up hangs
  them, the carved five wounds round Astra over the altar, the great window over that, two lancets either side, the
  Church's red banners, a lancet and a pennant in each cell (the sister's violet), a pennant on each pier of the arches,
  the shelf over the sister's desk. Each picture is laid in the strip of the wall it hangs on, so it stands and fades
  with that wall (catalog.ts BUILDINGS.flchurch_shell, at 64 pixels a tile).

Run it after the chapel's walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts flchurch_shell
    python3 games/openworld/tools/src/art/firstlight-chapel.py [preview-dir]
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'firstlight-chapel'
GAME = Path(__file__).resolve().parents[3]
LSW = GAME / 'public/assets/lsw'
OUT = 'Fixtures/FirstlightChapel.png'
WALLS_OUT = 'Buildings/FirstlightChapelWalls.png'
SHELL = 'Buildings/flchurch_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/firstlight-chapel.json'
T = 16  # a cell, in the game's pixels
K = 4  # these pictures' pixels to the game's one


def clean(img: Image.Image) -> Image.Image:
    """The sheet's own matte off: its faint red fringe (alpha under a third) cleared, the rest kept as painted."""
    a = np.array(img.convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


SHEET = clean(Image.open(HERE / 'sheet.png'))
PEW = clean(Image.open(HERE / 'pew.png'))


def taken(src: Image.Image, box: tuple[int, int, int, int], width: float) -> Image.Image:
    """A piece of a picture, `width` game pixels wide at K pixels to one (premultiplied, so no fringe bleeds in)."""
    p = src.crop(box).convert('RGBa')
    s = width * K / p.width
    p = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS).convert('RGBA')
    a = np.array(p)
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


def snuffed(box: tuple[int, int, int, int], candles: list[tuple[int, int, int]]) -> Image.Image:
    """The candles cold: over each candle's top (x0, x1, its top row, in the crop) the flame cleared but for a short black
    wick, and the flame's light on the wax just under it given back to the wax."""
    p = np.array(SHEET.crop(box)).astype(int)
    R, G, B = p[..., 0], p[..., 1], p[..., 2]
    flame = (R - B > 90) & (R > 150)
    for x0, x1, top in candles:
        reg = p[:, x0:x1]
        wax = reg[top + 4:top + 14][(reg[top + 4:top + 14, :, 2] > 150) & (reg[top + 4:top + 14, :, 3] > 0)]
        cream = wax[:, :3].mean(0).round().astype(int) if len(wax) else np.array([226, 214, 190])
        mid = (x0 + x1) // 2
        for y in range(0, top):
            for x in range(x0, x1):
                wick = abs(x - mid) <= 1 and y >= top - 5
                p[y, x] = [40, 30, 24, 255] if wick else 0
        for y in range(top, top + 8):
            for x in range(x0, x1):
                if p[y, x, 3] and flame[y, x]:
                    p[y, x, :3] = cream
    return Image.fromarray(p.astype(np.uint8))


def violet(img: Image.Image) -> Image.Image:
    """A pennant dyed violet (the mock-up's in the sister's cell): its red turned, its gold left as it is."""
    a = np.array(img).astype(float) / 255
    out = a.copy()
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            r, g, b, al = a[y, x]
            if al == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            if (h < 0.06 or h > 0.94) and s > 0.35:
                out[y, x, :3] = colorsys.hsv_to_rgb(0.77, s * 0.85, v * 0.95)
    return Image.fromarray((out * 255).round().astype(np.uint8))


CANDLES = (1221, 293, 1333, 394)
# name: the picture, its width in game pixels, how far its middle stands east of its cell's (game pixels: the altar's
# is its four cells' middle, its own cell the second of them), how far its foot stands above its cell's bottom edge
# (game pixels; under it, less than none): the candles at the wall's foot, either side of the altar's upper step
FLOOR: dict[str, tuple[Image.Image, float, float, float]] = {
    'altar': (taken(SHEET, (532, 19, 933, 211), 66), 66, T / 2, -1),
    'candles': (taken(SHEET, CANDLES, 19), 19, 0, 9),
    'candles_cold': (taken(snuffed(CANDLES, [(12, 36, 42), (42, 66, 33), (76, 100, 42)]), (0, 0, 112, 101), 19), 19, 0, 9),
    'pew': (taken(PEW, (123, 234, 819, 700), 44), 44, 0, -4),
    'desk': (taken(SHEET, (299, 938, 427, 1045), 24), 24, -4, -2),
    'stool': (taken(SHEET, (461, 957, 538, 1036), 13), 13, -4, -3),
    'nightstand': (taken(SHEET, (884, 844, 989, 1026), 18), 18, 0, -3),
}

# what hangs on the walls: the picture and its width in game pixels
WALL = {
    'relief': taken(SHEET, (418, 225, 836, 540), 72),
    'window': taken(SHEET, (158, 545, 371, 783), 34),
    'lancet': taken(SHEET, (416, 574, 500, 783), 11),
    'banner': taken(SHEET, (580, 570, 724, 791), 24),
    'pennant': taken(SHEET, (790, 581, 879, 778), 11),
    'shelf': taken(SHEET, (307, 820, 458, 915), 23),
}
WALL['pennant_violet'] = violet(WALL['pennant'])

# The chapel's plan (tools/src/art/arch/plans.ts `flchurch`, its map TOP rows of the dark over it): the nave, the two
# cells and the arches between, in the map's cells.
TOP = 8
NAVE = (6, 2 + TOP, 14, 11)
CELL_W = (2, 3 + TOP, 3, 5)
CELL_E = (21, 3 + TOP, 3, 5)
ARCHES = ((5, 5 + TOP), (20, 5 + TOP))
MID = NAVE[0] + NAVE[2] / 2  # the nave's middle, between two cells
NAVE_FACE = NAVE[1] * T  # the face of the wall at the nave's head (its foot, the floor's first row's top edge)
CELL_FACE = CELL_W[1] * T
PIER_FACE = ARCHES[0][1] * T  # the arches' piers, the short faces over each arch

# what hangs where: the picture, the face it is on, its middle (cells, east from the map's west edge), its foot's
# height over the floor (game pixels), and whether it stands proud of the wall: as ref-walls.png hangs them. The carved
# five wounds stand proud, over the altar and between the pilasters, in front of the course and with their shadow on
# the wall (the user's word of 2026-11-24: smaller, on top of all, standing off the wall)
HUNG = [
    ('window', NAVE_FACE, MID, 74),
    *[('lancet', NAVE_FACE, MID + d, 64) for d in (-6.0, -3.75, 3.75, 6.0)],
    ('relief', NAVE_FACE, MID, 15, True),
    *[('banner', NAVE_FACE, MID + d, 18) for d in (-4.3, 4.3)],
    ('pennant_violet', CELL_FACE, CELL_W[0] + 0.4, 22),
    ('lancet', CELL_FACE, CELL_W[0] + 1.25, 64),
    ('shelf', CELL_FACE, CELL_W[0] + 2.25, 24),
    ('pennant', CELL_FACE, CELL_E[0] + 2.6, 22),
    ('lancet', CELL_FACE, CELL_E[0] + 1.75, 64),
    *[('pennant', PIER_FACE, x + 0.5, 22) for x, _ in ARCHES],
]


def pack(cut: dict[str, Image.Image], width: int) -> tuple[Image.Image, dict[str, tuple[int, int]]]:
    """Shelf-pack pictures into one sheet `width` wide."""
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


# ------------------------------------------------------------------------------------------------ the things on the floor
floor, at = pack({n: img for n, (img, *_) in FLOOR.items()}, 512)
pieces = {}
for name, (img, w, east, foot) in FLOOR.items():
    x, y = at[name]
    # (its anchor the cell's bottom middle: `foot` under its own bottom edge)
    pieces[name] = {'x': x, 'y': y, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    print(f'{name:13s} {img.width}x{img.height} → {img.width / K:.1f}x{img.height / K:.1f} game px')
floor.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, floor.size)

# ------------------------------------------------------------------------------------------------ the carpet
# The runner from the altar's step to the door, as the mock-ups lay it: deep red, a fine weave, a dark edge, a gold line
# inside it and a finer one inside that, a little gold square at each inner corner (as the altar's frontal has). Drawn
# here, the sheet has none: laid as ground (catalog.ts `flchapel_runner`), four cells across with the runner on their
# middle, as long as the nave below the altar's row.
RUNNER_W = 40  # game pixels across
RUNNER_TILES = (4, NAVE[3] - 1)
DARK, RED, WEAVE, GOLD, GOLD_DIM = (74, 18, 22), (152, 38, 40), (136, 32, 35), (218, 168, 74), (176, 124, 50)


def runner() -> Image.Image:
    tw, th = RUNNER_TILES
    W, H = tw * T * K, th * T * K
    a = np.zeros((H, W, 4), np.uint8)
    x0 = (W - RUNNER_W * K) // 2
    w, h = RUNNER_W * K, H
    yy, xx = np.mgrid[0:h, 0:w]
    # (how far in from the nearest edge, and from the nearest end, in this picture's pixels)
    side = np.minimum(xx, w - 1 - xx)
    end = np.minimum(yy, h - 1 - yy)
    inset = np.minimum(side, end)
    u, v = xx // K, yy // K
    rgb = np.empty((h, w, 3), np.uint8)
    rgb[:] = RED
    rgb[(u % 4 == 0) | (v % 4 == 0)] = WEAVE
    rgb[(inset >= 2 * K) & (inset < 3 * K)] = GOLD
    rgb[(inset >= 5 * K) & (inset < 5 * K + K // 2)] = GOLD_DIM
    # the inner corners' squares (two game pixels, a red one in each)
    for cy in (6 * K, h - 8 * K):
        for cx in (6 * K, w - 8 * K):
            rgb[cy:cy + 2 * K, cx:cx + 2 * K] = GOLD
            rgb[cy + K // 2:cy + 3 * K // 2, cx + K // 2:cx + 3 * K // 2] = RED
    rgb[inset < K] = DARK
    # the light from the west: its east edge a shade darker
    shade = (xx > w - 3 * K) & (inset >= K)
    rgb[shade] = (rgb[shade] * 0.88).astype(np.uint8)
    a[:, x0:x0 + w, :3] = rgb
    a[:, x0:x0 + w, 3] = 255
    return Image.fromarray(a)


RUNNER_OUT = 'Fixtures/FirstlightChapelRunner.png'
runner().save(LSW / RUNNER_OUT, optimize=True)
print('→', LSW / RUNNER_OUT, RUNNER_TILES)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['flchurch_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
by_row = {s['row']: s for s in shell['slices']}
# a proud piece's shadow on the wall: east and down of it (the light from the west, high), a third dark
SHADOW = (1.5, 2.0, 0.34)


def shadow_of(img: Image.Image) -> Image.Image:
    a = np.array(img)
    out = np.zeros_like(a)
    out[..., 3] = (a[..., 3].astype(float) * SHADOW[2]).astype(np.uint8)
    dx, dy = round(SHADOW[0] * K), round(SHADOW[1] * K)
    pad = Image.new('RGBA', (img.width + dx, img.height + dy))
    pad.alpha_composite(Image.fromarray(out), (dx, dy))
    return pad


def lay(img: Image.Image, s: dict, mx: float, my: float, name: str) -> None:
    """A picture laid on a strip at the map's (mx, my) (game pixels), only over what the strip shows."""
    sx = round((s['x'] + mx - s['col'] * T) * K)
    sy = round((s['y'] + my - (s['row'] - s['th'] + 1) * T) * K)
    x0, y0 = s['x'] * K, s['y'] * K
    x1, y1 = x0 + s['tw'] * T * K, y0 + s['th'] * T * K
    assert x0 <= sx and y0 <= sy and sx + img.width <= x1 and sy + img.height <= y1, f'{name} runs off the strip of row {s["row"]}'
    region = walls.crop((sx, sy, sx + img.width, sy + img.height))
    # (laid only on the wall: where the strip shows nothing, nor does it)
    over = Image.alpha_composite(region, img)
    mask = Image.fromarray(((np.array(region)[..., 3] > 0) * 255).astype(np.uint8))
    walls.paste(over, (sx, sy), mask)


for name, face, mid, z, *proud in HUNG:
    img = WALL[name]
    # its top-left on the map (game pixels)
    mx = mid * T - img.width / K / 2
    my = face - z - img.height / K
    row = face // T - 1  # the wall row whose face it is
    if proud:
        # its shadow, then itself, on its face; and itself over the fronts of the pilasters and the course, which stand
        # out of the face into the row before it (drawn in front of the face)
        lay(shadow_of(img), by_row[row], mx, my, name)
        lay(img, by_row[row], mx, my, name)
        lay(img, by_row[row + 1], mx, my, name)
    else:
        lay(img, by_row[row], mx, my, name)
walls.save(LSW / WALLS_OUT, optimize=True)
print('→', LSW / WALLS_OUT, walls.size)

INDEX.write_text(json.dumps({
    'img': f'lsw/{OUT}',
    'scale': 1 / K,
    'pieces': pieces,
    'runner': {'img': f'lsw/{RUNNER_OUT}', 'tw': RUNNER_TILES[0], 'th': RUNNER_TILES[1], 'pixelsPerTile': T * K},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': T * K, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)

if len(sys.argv) > 1:
    # the walls as the map lays them, and the floor's pieces: to look at
    view = Path(sys.argv[1])
    view.mkdir(parents=True, exist_ok=True)
    W = max(s['col'] + s['tw'] for s in shell['slices']) * T * K
    H = (max(s['row'] for s in shell['slices']) + 1) * T * K
    whole = Image.new('RGBA', (W, H), (40, 34, 40, 255))
    for s in sorted(shell['slices'], key=lambda s: s['row']):
        strip = walls.crop((s['x'] * K, s['y'] * K, (s['x'] + s['tw'] * T) * K, (s['y'] + s['th'] * T) * K))
        whole.alpha_composite(strip, (s['col'] * T * K, (s['row'] - s['th'] + 1) * T * K))
    whole.save(view / 'walls.png')
    bg = Image.new('RGBA', floor.size, (110, 120, 110, 255))
    bg.alpha_composite(floor)
    bg.save(view / 'floor.png')
    print('→', view)
