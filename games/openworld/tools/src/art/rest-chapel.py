"""The chapel of the Five at the Pilgrims' Rest (waystation.chapel) as the user drew it (2026-11-24): their sheet
(rest-chapel/sheet.png) and mock-up (rest-chapel/ref.png), and what it shares with Firstlight's chapel taken from that
one's sheet (firstlight-chapel/sheet.png): the stone altar, the carved five wounds, the Church's banners and pennants.
Taken as painted, only made smaller, at four pixels to the game's one (drawn at a quarter).

- The things (Fixtures/RestChapel.png, client/src/rest-chapel.json `pieces`): the altar of the five wounds, the gilt
  candelabra either side of it, lit, the long pews along the nave (`fixture:pew_long`). The altar and the candelabra
  drawn where they stand (catalog.ts placedSprites).
- Laid on the floor (`runner`, `rug`, `firewood`): the runner from the altar to the door, deep red, its gold lines and
  crosses drawn here as Firstlight's is; the priest's rug by his cot; the wood for the brazier he does not light, stacked
  in his cell's corner (catalog.ts `wschapel_*`, pilgrimage.ts lays them).
- The walls (Buildings/RestChapelWalls.png, `walls`): the chapel's own walls (`wschapel_shell`, drawn bare by
  tools/src/art/arch) four times as large, and on them, as the mock-up hangs them, the great window with its cross, two
  lancets either side, the red banners, the five wounds standing proud over the altar; the priest's cell's two pennants.

Run it after the walls are drawn, and again whenever they are:

    npx tsx games/openworld/tools/src/art/arch/main.ts wschapel_shell
    python3 games/openworld/tools/src/art/rest-chapel.py [preview-dir]
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ART = Path(__file__).resolve().parent
GAME = Path(__file__).resolve().parents[3]
LSW = GAME / 'public/assets/lsw'
OUT = 'Fixtures/RestChapel.png'
RUNNER_OUT = 'Fixtures/RestChapelRunner.png'
RUG_OUT = 'Fixtures/RestChapelRug.png'
WOOD_OUT = 'Fixtures/RestChapelFirewood.png'
WALLS_OUT = 'Buildings/RestChapelWalls.png'
SHELL = 'Buildings/wschapel_shell.png'
BUILDINGS = GAME / 'client/src/buildings.json'
INDEX = GAME / 'client/src/rest-chapel.json'
T = 16
K = 4
P = T * K


def sheet(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < 96] = 0
    return Image.fromarray(a)


OWN, FIRSTLIGHT = sheet(ART / 'rest-chapel/sheet.png'), sheet(ART / 'firstlight-chapel/sheet.png')


def taken(src: Image.Image, box: tuple[int, int, int, int], width: float) -> Image.Image:
    p = src.crop(box).convert('RGBa')
    s = width * K / p.width
    p = p.resize((max(1, round(p.width * s)), max(1, round(p.height * s))), Image.LANCZOS).convert('RGBA')
    a = np.array(p)
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


def violet(img: Image.Image) -> Image.Image:
    a = np.array(img).astype(float) / 255
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            r, g, b, al = a[y, x]
            if al == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            if (h < 0.06 or h > 0.94) and s > 0.35:
                a[y, x, :3] = colorsys.hsv_to_rgb(0.77, s * 0.85, v * 0.95)
    return Image.fromarray((a * 255).round().astype(np.uint8))


PIECE = {
    # the sheet's own
    'candelabrum': taken(OWN, (1193, 144, 1323, 402), 14),
    'pew_long': taken(OWN, (636, 170, 806, 860), 20),
    'pew_long_e': taken(OWN, (849, 170, 1015, 860), 20),  # (its fellow across the aisle, facing it)
    'window_big': taken(OWN, (252, 200, 580, 606), 34),
    'lancet': taken(OWN, (112, 261, 228, 541), 10),
    'firewood': taken(OWN, (1134, 438, 1367, 610), 28),
    'rug': taken(OWN, (1074, 656, 1432, 850), 46),
    # Firstlight's: the altar, the five wounds, the banners
    'altar': taken(FIRSTLIGHT, (532, 19, 933, 211), 60),
    'relief': taken(FIRSTLIGHT, (418, 225, 836, 540), 72),
    'banner': taken(FIRSTLIGHT, (580, 570, 724, 791), 24),
    'pennant': taken(FIRSTLIGHT, (790, 581, 879, 778), 15),
}
PIECE['pennant_violet'] = violet(PIECE['pennant'])

# the things: the picture, how far its middle stands east of its cell's, how far its foot stands above its cell's bottom
THINGS = {'altar': (0, -1), 'candelabrum': (0, 6), 'pew_long': (0, -2), 'pew_long_e': (0, -2)}
x, cut, pieces = 0, Image.new('RGBA', (sum(PIECE[n].width + 2 for n in THINGS), max(PIECE[n].height for n in THINGS))), {}
for name, (east, foot) in THINGS.items():
    img = PIECE[name]
    cut.alpha_composite(img, (x, 0))
    pieces[name] = {'x': x, 'y': 0, 'w': img.width, 'h': img.height, 'ax': img.width / 2 - east * K, 'ay': img.height + foot * K}
    x += img.width + 2
cut.save(LSW / OUT, optimize=True)
print('→', LSW / OUT, cut.size)

# ------------------------------------------------------------------------------------------------ on the floor
# the runner: three cells across with the runner on their middle, eight long (the nave below the altar's row)
RUNNER_W, RUNNER_TILES = 38, (3, 8)
DARK, RED, WEAVE, GOLD, GOLD_DIM = (74, 18, 22), (152, 38, 40), (136, 32, 35), (218, 168, 74), (176, 124, 50)


def runner() -> Image.Image:
    tw, th = RUNNER_TILES
    W, H = tw * P, th * P
    a = np.zeros((H, W, 4), np.uint8)
    w, h = RUNNER_W * K, H
    x0 = (W - w) // 2
    yy, xx = np.mgrid[0:h, 0:w]
    inset = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy))
    u, v = xx // K, yy // K
    rgb = np.empty((h, w, 3), np.uint8)
    rgb[:] = RED
    rgb[(u % 4 == 0) | (v % 4 == 0)] = WEAVE
    rgb[(inset >= 2 * K) & (inset < 3 * K)] = GOLD
    rgb[(inset >= 5 * K) & (inset < 5 * K + K // 2)] = GOLD_DIM
    # the crosses down its middle, each in its diamond, as the mock-up's (and its altar's frontal)
    cx = w // 2
    for cy in [round(h * f) for f in (0.2, 0.5, 0.8)]:
        d = np.abs(xx - cx) + np.abs(yy - cy)
        rgb[(d >= 9 * K) & (d < 9 * K + K // 2)] = GOLD
        arm = 5 * K
        rgb[(np.abs(xx - cx) < K) & (np.abs(yy - cy) < arm)] = GOLD
        rgb[(np.abs(yy - cy) < K) & (np.abs(xx - cx) < arm * 0.75)] = GOLD
    rgb[inset < K] = DARK
    shade = (xx > w - 3 * K) & (inset >= K)
    rgb[shade] = (rgb[shade] * 0.88).astype(np.uint8)
    a[:, x0:x0 + w, :3] = rgb
    a[:, x0:x0 + w, 3] = 255
    return Image.fromarray(a)


runner().save(LSW / RUNNER_OUT, optimize=True)


def hard(img: Image.Image) -> Image.Image:
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return Image.fromarray(a)


# the priest's rug: four cells across and two down, the rug on their middle
rug = Image.new('RGBA', (4 * P, 2 * P))
rug.alpha_composite(hard(PIECE['rug']), ((4 * P - PIECE['rug'].width) // 2, (2 * P - PIECE['rug'].height) // 2))
rug.save(LSW / RUG_OUT, optimize=True)
# the wood: two cells across and two high, stacked in the corner of the lower one, its foot a little up from its bottom
wood = Image.new('RGBA', (2 * P, 2 * P))
wood.alpha_composite(hard(PIECE['firewood']), (2, 2 * P - 3 * K - PIECE['firewood'].height))
wood.save(LSW / WOOD_OUT, optimize=True)

# ------------------------------------------------------------------------------------------------ the walls
shell = json.loads(BUILDINGS.read_text())['buildings']['wschapel_shell']
bare = Image.open(LSW / SHELL).convert('RGBA')
walls = bare.resize((bare.width * K, bare.height * K), Image.NEAREST)
by_row = {s['row']: s for s in shell['slices']}
TOP = 7
NAVE_FACE = (2 + TOP) * T
CELL_FACE = (3 + TOP) * T
MID = 2 + 11 / 2


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


# (the piece, the face, its middle in cells, its foot over the floor in game pixels, whether it stands proud)
HUNG = [
    ('window_big', NAVE_FACE, MID, 74, False),
    *[('lancet', NAVE_FACE, MID + d, 64, False) for d in (-4.7, -3.1, 3.1, 4.7)],
    *[('banner', NAVE_FACE, MID + d, 18, False) for d in (-3.9, 3.9)],
    ('relief', NAVE_FACE, MID, 15, True),
    # (over the course that runs along the cell's wall, not across it)
    ('pennant_violet', CELL_FACE, 15.8, 48, False),
    ('pennant', CELL_FACE, 17.2, 48, False),
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
    'runner': {'img': f'lsw/{RUNNER_OUT}', 'tw': RUNNER_TILES[0], 'th': RUNNER_TILES[1], 'pixelsPerTile': P},
    'rug': {'img': f'lsw/{RUG_OUT}', 'tw': 4, 'th': 2, 'pixelsPerTile': P},
    'firewood': {'img': f'lsw/{WOOD_OUT}', 'tw': 2, 'th': 2, 'pixelsPerTile': P},
    'walls': {'img': f'lsw/{WALLS_OUT}', 'pixelsPerTile': P, 'slices': [{**s, 'x': s['x'] * K, 'y': s['y'] * K} for s in shell['slices']]},
}, indent=1) + '\n')
print('→', INDEX)
