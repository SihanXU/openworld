"""The game's lights from one art pack as it was painted: the brazier and the candlestick each plain and rich, the
standing candelabrum, the lamp post and the lantern post each plain and rich, the campfire in two makes.

The pack (lights/sheet-a.png, sheet-b.png) is taken as it is, only made smaller, never redrawn, at four pixels to the
game's one (the catalogue draws them at a quarter, pixel for pixel at the game's zoom of four); the haze the pack's
background left round its pieces is taken away. The pack paints every light burning: that is its `lit` look, and its
cold one is the same picture with the fire taken out (the flame gone, the coals and the glass dark). Which make a thing
has (client/src/catalog.ts): the brazier, the candlestick, the lamp post and the lantern by its map's theme (plain or
rich, Catalog.fixtureThemes), the campfire picked by the thing.

    python3 games/openworld/tools/src/art/lights.py [preview.png]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent / 'lights'
GAME = Path(__file__).resolve().parents[3]
OUT = GAME / 'public/assets/lsw/Fixtures/Lights.png'
INDEX = GAME / 'client/src/lights.json'
K = 4  # this sheet's pixels to the game's one


def pack(name: str) -> Image.Image:
    a = np.array(Image.open(HERE / f'sheet-{name}.png').convert('RGBA'))
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)  # the haze round the pieces gone; the pieces' own edges hard
    return Image.fromarray(a)


SHEETS = {n: pack(n) for n in ('a', 'b')}

# name: (sheet, the pack's box, how it goes cold), and each family's size in the game's pixels (one piece's width or
# height; the family's others at its scale, as the pack drew them beside it)
PIECES = {
    'brazier_plain': ('a', (324, 100, 641, 436), 'coals'),
    'brazier_rich': ('a', (763, 95, 1104, 447), 'coals'),
    'candles_plain': ('a', (189, 640, 439, 878), 'wick'),
    'candles_rich': ('a', (568, 595, 860, 922), 'wick'),
    'candelabrum': ('a', (1021, 540, 1216, 931), 'wick'),
    'lamppost_plain': ('b', (120, 91, 322, 489), 'glass'),
    'lamppost_rich': ('b', (475, 92, 747, 489), 'glass'),
    'lantern_plain': ('b', (70, 600, 237, 966), 'glass'),
    'lantern_rich': ('b', (351, 584, 581, 970), 'glass'),
    'campfire_ring': ('b', (655, 640, 979, 945), 'ash'),
    'campfire_tepee': ('b', (1057, 600, 1390, 952), 'ash'),
}
FAMILIES = {
    'brazier': ('brazier_plain', {'w': 15}),
    'candles': ('candelabrum', {'h': 18}),
    'candelabrum': ('candelabrum', {'h': 18}),
    'lamppost': ('lamppost_plain', {'h': 30}),
    'lantern': ('lantern_rich', {'h': 24}),
    'campfire': ('campfire_ring', {'w': 18}),
}


def trimmed(sheet: str, box: tuple[int, int, int, int]) -> Image.Image:
    p = SHEETS[sheet].crop(box)
    ys, xs = np.nonzero(np.array(p)[..., 3])
    return p.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def hsl(a: np.ndarray):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = r * 0.3 + g * 0.59 + b * 0.11
    sat = a[..., :3].max(-1) - a[..., :3].min(-1)
    return r, g, b, lum, sat


def dark(a: np.ndarray, where: np.ndarray, base: tuple[int, int, int], spread: float) -> None:
    """Paint `where` a dark colour, keeping something of its shading."""
    lum = hsl(a)[3]
    for i, c in enumerate(base):
        a[..., i] = np.where(where, np.clip(c + (lum - 128) * spread, 0, 255), a[..., i])


def cold(img: Image.Image, how: str) -> Image.Image:
    a = np.array(img).astype(int)
    r, g, b, lum, sat = hsl(a)
    solid = a[..., 3] > 0
    h, w = solid.shape
    if how == 'coals':
        # the fire: the warm patches that rise above the bowl's rim, and its sparks; within the bowl, coals
        warm = solid & (r > 150) & (r - b > 90)
        grey = solid & (sat < 40) & (lum > 60)
        rim = int(np.nonzero(grey.any(1))[0].min())  # the bowl's top: its back rim
        lab, n = ndimage.label(warm)
        fire = np.isin(lab, [i for i, s in enumerate(ndimage.find_objects(lab), 1) if s[0].start < rim + h // 20])
        # (its pale heart in it)
        ys, xs = np.nonzero(fire)
        box = np.zeros_like(fire)
        box[ys.min():ys.max() + 1, xs.min():xs.max() + 1] = True
        fire |= box & solid & (lum > 180) & (sat > 30)
        # above the back rim (and its ink) nothing is the bowl's: the flame, the sparks and their edges go
        rows = np.arange(h)[:, None]
        a[solid & (rows < rim - 2 * K), 3] = 0
        above = fire & (rows < rim + h // 30)
        a[above, 3] = 0
        dark(a, fire & ~above, (46, 38, 34), 0.12)
    elif how == 'wick':
        # each candle's flame (the warm and bright above its wax) gone, a wick in its place
        wax = solid & (sat < 50) & (lum > 170)
        lab, n = ndimage.label(ndimage.binary_opening(wax, iterations=2))
        lab = lab * (ndimage.sum(wax, lab, lab) > 200)
        for s in filter(None, ndimage.find_objects(lab)):
            top, x0, x1 = s[0].start, s[1].start, s[1].stop
            band = np.zeros_like(solid)
            band[:top, max(0, x0 - (x1 - x0) // 2):x1 + (x1 - x0) // 2] = True
            flame = band & solid & ~wax & ((r > 150) & (r - b > 50) | (lum > 170) & (sat >= 50))
            flame |= band & solid & (lum < 90) & ndimage.binary_dilation(flame, iterations=3)
            a[flame, 3] = 0
            cx, ww = (x0 + x1) // 2, max(K, (x1 - x0) // 6)
            a[max(0, top - 3 * K):top, cx - ww // 2:cx + (ww + 1) // 2] = (40, 30, 26, 255)
    elif how == 'glass':
        # the lamp's glass, and the light in it, dark
        glow = solid & (lum > 195) & (b < r + 10)
        glow = ndimage.binary_dilation(glow, iterations=1) & solid & (lum > 150) & (sat < 140)
        dark(a, glow, (58, 54, 52), 0.18)
    elif how == 'ash':
        # the fire and the glow under the wood dead: ash and char
        glow = solid & (r > 200) & (g > 100) & (b < 120)
        glow = ndimage.binary_dilation(glow, iterations=1) & solid & (r > 180) & (r - b > 90) | solid & (lum > 200) & (sat > 60)
        dark(a, glow, (74, 66, 62), 0.15)
    return Image.fromarray(a.astype(np.uint8))


def foot(img: Image.Image) -> float:
    """Where it stands: the middle of what it stands on, its bottom rows (a lamp post's post, not its hanging lamp)."""
    a = np.array(img)[..., 3]
    rows = a[-max(2, a.shape[0] // 25):].any(0)
    xs = np.nonzero(rows)[0]
    return (xs.min() + xs.max() + 1) / 2


raw = {name: trimmed(sheet, box) for name, (sheet, box, _) in PIECES.items()}
scale = {}
for fam, (ref, size) in FAMILIES.items():
    p = raw[ref]
    scale[fam] = size['w'] * K / p.width if 'w' in size else size['h'] * K / p.height
pieces: dict[str, Image.Image] = {}
for name, (_, _, how) in PIECES.items():
    k = scale[name.split('_')[0]]
    p = raw[name]
    lit = p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)
    # (gone cold at the pack's size, then made smaller)
    c = cold(p, how)
    pieces[f'{name}_lit'] = lit
    pieces[name] = c.resize(lit.size, Image.LANCZOS)

WIDTH = 1024
order = sorted(pieces, key=lambda n: -pieces[n].height)
places, x, y, row = {}, 0, 0, 0
for name in order:
    img = pieces[name]
    if x + img.width > WIDTH:
        x, y, row = 0, y + row + 2, 0
    places[name] = (x, y)
    x, row = x + img.width + 2, max(row, img.height)
sheet = Image.new('RGBA', (WIDTH, y + row))
index = {}
for name, img in pieces.items():
    sx, sy = places[name]
    sheet.alpha_composite(img, (sx, sy))
    # its foot (the cell's bottom middle) under what it stands on, a game pixel above its bottom
    index[name] = {'x': sx, 'y': sy, 'w': img.width, 'h': img.height, 'ax': round(foot(img), 1), 'ay': img.height - K}
    print(f'{name:22s} {img.width / K:5.1f} x {img.height / K:5.1f} game px')
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, optimize=True)
INDEX.write_text(json.dumps({'img': 'lsw/Fixtures/Lights.png', 'scale': 1 / K, 'pieces': index}, indent=1) + '\n')
print('→', OUT, sheet.width, 'x', sheet.height)

if len(sys.argv) > 1:
    # each piece cold and lit side by side, at the pack's size halved (to look the masks over)
    names = list(PIECES)
    tiles = [(raw[n], cold(raw[n], PIECES[n][2])) for n in names]
    W = sum(t[0].width // 2 + 20 for t in tiles)
    H = max(t[0].height for t in tiles) // 2
    view = Image.new('RGBA', (W, H * 2 + 10), (120, 110, 96, 255))
    x = 0
    for lit, c in tiles:
        half = (lit.width // 2, lit.height // 2)
        view.alpha_composite(lit.resize(half), (x, H - half[1]))
        view.alpha_composite(c.resize(half), (x, 2 * H + 10 - half[1]))
        x += half[0] + 20
    view.save(sys.argv[1])
