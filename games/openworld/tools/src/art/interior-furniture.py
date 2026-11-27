"""The furniture of the game's rooms from its art packs as they were painted, each piece in two makes: a plain one, of
farmhouses, villages, cells and barracks, and a rich one, of the Holy City, lords' seats, cathedrals and the rooms of
the well-off; and the tavern's, of inns, hostels and refectories (its tables and seats; the rest of it plain). Which a
room has is its map's theme (Catalog.fixtureThemes): by what the room is, else by the place it is a room of
(tools/src/demo/continent/continent.json), else picked by the map, one make for a whole room. A table and its seats
come in sets (`_2`: a theme's second set), one set to a room, picked by the map; a seat with a picture turned west
(`_left`) shows it when it faces west, the other when it faces east.

The packs (interior-furniture/sheet-a.png … sheet-e.png) are taken as they are, only made smaller, never redrawn, at
four pixels to the game's one (the catalogue draws them at a quarter, pixel for pixel at the game's zoom of four); the
pieces a pack drew together (a table and its chairs) keep the sizes it gave them, one scale for a sheet. One piece is
changed: the fireplace is painted burning; its cold one has the fire taken out of the hearth (the game draws it lit with
the pack's own, `lit`). The chest and the crate (sheet-d) are shut, open with things in, and open empty.

    python3 games/openworld/tools/src/art/interior-furniture.py [preview.png]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'interior-furniture'
GAME = Path(__file__).resolve().parents[3]
OUT = GAME / 'public/assets/lsw/Fixtures/InteriorFurniture.png'
INDEX = GAME / 'client/src/interior-furniture.json'
CONTINENT = GAME / 'tools/src/demo/continent/continent.json'
K = 4  # this sheet's pixels to the game's one
SHEETS = {n: Image.open(HERE / f'sheet-{n}.png').convert('RGBA') for n in 'abcde'}
for n in 'cde':  # (the haze round these packs' pieces gone; their edges hard)
    _a = np.array(SHEETS[n])
    _a[..., 3] = np.where(_a[..., 3] >= 128, 255, 0)
    SHEETS[n] = Image.fromarray(_a)

# the catalogue's sprite key: its two makes (sheet, box), and its size in the game's pixels (a width or a height)
PIECES = {
    'bed': (('b', (276, 25, 465, 382)), ('b', (507, 14, 730, 382)), {'h': 32}),
    'long_table': (('b', (141, 631, 696, 809)), ('b', (718, 629, 1305, 808)), {'w': 48}),
    'counter': (('b', (365, 867, 645, 1047)), ('b', (709, 809, 1063, 1063)), {'w': 18}),
    # (a shop's shelves stand in rows along a wall: a cell wide each; a bookshelf taller than a man, wider than a cell)
    'shelf': (('a', (250, 24, 450, 350)), ('a', (612, 13, 838, 350)), {'w': 16.5}),
    'bookshelf': (('a', (214, 371, 473, 692)), ('a', (588, 343, 862, 692)), {'h': 34}),
    'workbench': (('a', (117, 711, 499, 908)), ('a', (560, 695, 943, 908)), {'w': 32}),
    'fireplace': (('a', (193, 935, 449, 1178)), ('a', (577, 922, 917, 1178)), {'plain': {'h': 26}, 'rich': {'w': 32}}),
    'plant': (('a', (239, 1197, 422, 1433)), ('a', (621, 1195, 845, 1435)), {'h': 20}),
}


def taken(sheet: str, box: tuple[int, int, int, int], size: dict) -> Image.Image:
    p = SHEETS[sheet].crop(box)
    a = np.array(p)
    ys, xs = np.nonzero(a[..., 3] > 8)
    p = p.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    k = size['w'] * K / p.width if 'w' in size else size['h'] * K / p.height
    return p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)


def cold(fire: Image.Image) -> Image.Image:
    """The hearth gone cold: the fire (the largest patch of its bright, hot colour, and the pale heart in it) the
    hearth's dark; the logs and the stone stay."""
    from scipy import ndimage
    a = np.array(fire).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = r * 0.3 + g * 0.59 + b * 0.11
    sat = a[..., :3].max(-1) - a[..., :3].min(-1)
    hot = (a[..., 3] > 0) & (r > 200) & (sat > 120) & (b < 110)
    hot[: hot.shape[0] * 2 // 5] = False  # (the fire burns low in the hearth: not the cloth on the mantel)
    lab, n = ndimage.label(ndimage.binary_dilation(hot, iterations=1))
    fire_ = lab == 1 + int(np.argmax(ndimage.sum(hot, lab, range(1, n + 1))))
    # its heart: the pale yellow inside it
    heart = ndimage.binary_fill_holes(fire_) & (a[..., 3] > 0) & (lum > 150)
    ys, xs = np.nonzero(fire_)
    box = np.zeros_like(fire_)
    box[ys.min():ys.max() + 1, xs.min():xs.max() + 1] = True
    flame = (fire_ & hot) | heart | (box & (lum > 190))
    out = a.copy()
    out[flame, :3] = (38, 28, 24)
    return Image.fromarray(out.astype(np.uint8))


pieces: dict[str, Image.Image] = {}
for key, (plain, rich, size) in PIECES.items():
    for make, (sheet, box) in (('plain', plain), ('rich', rich)):
        img = taken(sheet, box, size.get(make, size))
        if key == 'fireplace':
            pieces[f'{key}_{make}_lit'] = img
            img = cold(img)
        pieces[f'{key}_{make}'] = img


def seam(sheet: str, x: int, y0: int, y1: int, band: int = 24) -> np.ndarray:
    """Where two pieces drawn touching part: a line from top to bottom near column `x` through the clear and the ink
    between them (the cheapest way down, a step aside at most each row), its column on each row from `y0`."""
    a = np.array(SHEETS[sheet])[y0:y1, x - band:x + band + 1].astype(int)
    lum = a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
    cost = np.where(a[..., 3] == 0, 0, np.where(lum < 70, 1, 40)).astype(float)
    cost += np.abs(np.arange(cost.shape[1]) - band)[None, :] * 0.01  # (straight down where all else is equal)
    acc = cost.copy()
    for y in range(1, len(acc)):
        prev = acc[y - 1]
        acc[y] += np.minimum(prev, np.minimum(np.r_[np.inf, prev[:-1]], np.r_[prev[1:], np.inf]))
    path = np.zeros(len(acc), int)
    path[-1] = int(np.argmin(acc[-1]))
    for y in range(len(acc) - 2, -1, -1):
        j = path[y + 1]
        lo, hi = max(0, j - 1), min(len(acc[y]), j + 2)
        path[y] = lo + int(np.argmin(acc[y][lo:hi]))
    return path + x - band


def cut(sheet: str, box: tuple[int, int, int, int], left: int | None = None, right: int | None = None) -> Image.Image:
    """A piece: what is drawn in `box`, between the seams it shares with what touches it (at columns `left`, `right`),
    the seam's own ink kept on both sides."""
    x0, y0, x1, y1 = box
    a = np.array(SHEETS[sheet].crop(box))
    cols = np.arange(x0, x1)[None, :]
    keep = np.ones(a.shape[:2], bool)
    if left is not None:
        keep &= cols >= seam(sheet, left, y0, y1)[:, None] - 1
    if right is not None:
        keep &= cols <= seam(sheet, right, y0, y1)[:, None] + 1
    a[~keep, 3] = 0
    ys, xs = np.nonzero(a[..., 3] > 8)
    return Image.fromarray(a).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


# the tables and their seats, and the chest and the crate: each sheet at one scale, as its pieces were drawn together
SETS = {
    # sheet-c: the plain round table between its chairs (the west one turned east), the rich table between its own
    'c': {
        'chair_plain': (235, 45, 367, 229), 'table_plain': (381, 63, 604, 229), 'chair_plain_left': (628, 46, 759, 229),
        'chair_rich': (908, 19, 1038, 229), 'table_rich': (1056, 62, 1330, 228),
    },
    # sheet-d: the rich chairs about a round table with flowers on it, the plain chairs about a table with a candle and
    # books; the chest and the crate
    'd': {
        '(chair_rich)': ((215, 50, 400, 334), None, 363), 'table_rich_2': ((340, 50, 640, 334), 363, 609),
        'chair_plain_2': (830, 85, 946, 338), 'table_plain_2': (950, 53, 1217, 338), 'chair_plain_2_left': (1222, 85, 1335, 331),
        'chest': (305, 419, 570, 641), 'chest_open': (639, 383, 896, 647), 'chest_empty': (970, 384, 1226, 647),
        'crate': (303, 700, 569, 955), 'crate_open': (628, 700, 902, 955), 'crate_empty': (959, 700, 1235, 955),
    },
    # sheet-e: the tavern's long table between its benches, its barrel table between barrel stools
    'e': {
        'chair_tavern_2': ((15, 60, 170, 347), None, 136), 'table_tavern_2': ((100, 60, 430, 347), 136, 396),
        'chair_tavern_2_left': ((360, 60, 518, 347), 396, None),
        'chair_tavern': (586, 181, 719, 356), 'table_tavern': ((690, 41, 1000, 360), 719, 974),
    },
}
cuts = {s_: {n: cut(s_, *(b if isinstance(b[0], tuple) else (b,))) for n, b in pieces_.items()} for s_, pieces_ in SETS.items()}
# a sheet's scale: the plain chair 16 game pixels high; the next sheet's rich chair as high as this one's; a barrel
# stool 11 high (a seat's height)
k_c = 16 * K / cuts['c']['chair_plain'].height
k_of = {'c': k_c, 'd': cuts['c']['chair_rich'].height * k_c / cuts['d']['(chair_rich)'].height, 'e': 11 * K / cuts['e']['chair_tavern'].height}
for s_, made in cuts.items():
    for n, p in made.items():
        if not n.startswith('('):
            pieces[n] = p.resize((round(p.width * k_of[s_]), round(p.height * k_of[s_])), Image.LANCZOS)


def foot(img: Image.Image) -> float:
    """Where it stands: the middle of its bottom rows."""
    a = np.array(img)[..., 3]
    xs = np.nonzero(a[-max(2, a.shape[0] // 25):].any(0))[0]
    return (xs.min() + xs.max() + 1) / 2


# ------------------------------------------------------------------ the sheet: in rows, tallest first
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
    # its foot (the cell's bottom middle) under its middle, a game pixel above its bottom
    index[name] = {'x': sx, 'y': sy, 'w': img.width, 'h': img.height, 'ax': round(foot(img), 1), 'ay': img.height - K}
    print(f'{name:22s} {img.width / K:5.1f} x {img.height / K:5.1f} game px')
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, optimize=True)

# ------------------------------------------------------------------ which make a map's rooms have (Catalog.fixtureThemes rules)
# the first rule whose pattern matches a map's id gives its theme; a theme of two is picked by the map
PICK = ['plain', 'rich']
rules = []
# what a room is (the last of its id: rooms.ts names them): an inn's, a hostel's, a refectory's tables the tavern's
rules.append({'match': r'\.(inn|tavern|hostel|refectory)(-\d+)?$', 'theme': 'tavern'})
RICH_ROOMS = ['manorhall', 'solar', 'library', 'counting', 'teahouse', 'elder', 'weighhouse', 'nave']
PLAIN_ROOMS = ['poorhouse', 'farmhouse', 'cell', 'cells', 'barracks', 'tent', 'mill', 'hospital', 'garrison',
               'smithy', 'cook', 'cabin', 'hut', 'cellar', 'guards', 'woodhouse', 'warhall']
rules.append({'match': rf'\.({"|".join(RICH_ROOMS)})(-\d+)?$', 'theme': 'rich'})
rules.append({'match': rf'\.({"|".join(PLAIN_ROOMS)})(-\d+)?$', 'theme': 'plain'})
# the place it is a room of, by its kind: the Holy City's, a cathedral's and a lord's seat's rich; a town's and another
# city's either; the rest — villages, farms, mills, mines, camps, forts, towers, ruins — plain
places = json.loads(CONTINENT.read_text())['places']
by_theme: dict[str, list[str]] = {'rich': [], 'plain': []}
for p in places:
    kind = p['kind']
    if p['region'] == 'holy' and kind in ('city', 'cathedral', 'town') or kind in ('cathedral', 'seat'):
        by_theme['rich'].append(p['id'])
    elif kind in ('town', 'city'):
        continue
    else:
        by_theme['plain'].append(p['id'])
for theme, ids in by_theme.items():
    rules.append({'match': rf'^({"|".join(re.escape(i) for i in sorted(ids))})(\.|$)', 'theme': theme})
# the hand-made maps: the Holy City's rich; Firstlight, Emberfall, the abbey and the camps plain
rules.append({'match': r'^(holyhall|whiteveil|holiest)(\.|$)', 'theme': 'rich'})
# (the Cloudtop's watch shelter, the Mountain Foot's hut, the ferrykeeper's tent among them)
rules.append({'match': r'^(summit|foot|ford|meadow|emberfall|abbey|redcamp|charcoal|reedbend|eastroad|waystation|forest|pasture|mill)(\.|$)', 'theme': 'plain'})
rules.append({'match': r'.', 'theme': ' '.join(PICK)})

INDEX.write_text(json.dumps({'img': 'lsw/Fixtures/InteriorFurniture.png', 'scale': 1 / K, 'pieces': index, 'rules': rules}, indent=1) + '\n')
print('→', OUT, sheet.width, 'x', sheet.height, f'({len(rules)} rules)')

if len(sys.argv) > 1:
    view = Image.new('RGBA', sheet.size, (120, 110, 96, 255))
    view.alpha_composite(sheet)
    view.save(sys.argv[1])
