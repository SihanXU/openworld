"""The crossing at Vesper Ford, from the art packs as they were painted: the landing, the broken footbridge, the line.

Three packs (ford-crossing/): `broken.png` the footbridge as the rider left it — its two ends, their ends torn ragged,
the stumps of the piles in the water, two new planks spliced onto the torn ends; `ferry.png` the landing — the winch
with its snapped line, the post on the far bank, the two piers, the boat, a length of line, the block it runs on, and
the whole of it strung; `bridge.png` the footbridge whole. Each piece is taken as it is, only made smaller, never
redrawn: to the size and place the art reference gives it over the map (the reference's frames, measured against the
pieces by matching each one in them), at four pixels to the game's one, so that at the game's zoom of four it is drawn
pixel for pixel (the catalogue draws them at a quarter).

What is drawn while (client/src/catalog.ts reads client/src/ford-crossing.json):
- the piers, the boat and the far post: always;
- the winch: its line snapped (`broken`), the pack's own winch, the frayed ends hanging; spliced, the line strung from
  its drum to the knot on the far post's ring, the block over the boat with its chain down to it;
- the footbridge, by which of the three cells of its gap are water: a stump of a pile in each that is, a new plank in
  each that is not (spliced onto the torn end beside it); all three laid, the bridge whole.

    python3 games/openworld/tools/src/art/ford-crossing.py [preview.png]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'ford-crossing'
GAME = Path(__file__).resolve().parents[3]
OUT = GAME / 'public/assets/lsw/Fixtures/FordCrossing.png'
INDEX = GAME / 'client/src/ford-crossing.json'
T = 16  # a cell, in the game's pixels
K = 4  # this sheet's pixels to the game's one
PACKS = {n: Image.open(HERE / f'{n}.png').convert('RGBA') for n in ('broken', 'ferry', 'bridge')}
# the dead tree at the narrows: standing, felled across the river, its stump (painted on white: the white taken away)
_tree = np.array(Image.open(HERE / 'deadtree.png').convert('RGBA'))
_white = (_tree[..., :3].min(-1) > 222) & (_tree[..., :3].max(-1).astype(int) - _tree[..., :3].min(-1) < 24)
_tree[_white, 3] = 0
PACKS['deadtree'] = Image.fromarray(_tree)
# (the standing tree's box reaches over the felled trunk's torn end, beside it in the pack: without it)
_tree[400:, 460:530, 3] = 0
PACKS['deadtree_standing'] = Image.fromarray(_tree)

# The reference's frames are a screenshot of the map at 96 screen pixels a cell, shown 1448/1324 larger: the left edge
# of cell 34 at 865 and the top of row 16 at 235 there.
SHOWN = 1448 / 1324


def game(ex: float, ey: float) -> tuple[float, float]:
    """A point of the reference's frame, in the map's game pixels."""
    return 34 * T + (ex / SHOWN - 865) / 6, 16 * T + (ey / SHOWN - 235) / 6


def taken(pack: str, box: tuple[int, int, int, int], scale: float) -> Image.Image:
    """A box of a pack, at the size the reference shows it (`scale` of the pack's), in this sheet's pixels."""
    p = PACKS[pack].crop(box)
    k = scale / SHOWN / 6 * K
    return p.resize((max(1, round(p.width * k)), max(1, round(p.height * k))), Image.LANCZOS)


# name: pack, box, the reference's scale of it, where the reference has its box's top left, the cell it is drawn on
# (the reference's frames: p4 the line snapped and the bridge broken; p5 two planks laid; p6 the bridge whole)
PLACED = {
    'winch': ('ferry', (472, 69, 753, 344), 0.6312, (20, 91), (25, 15)),
    'post': ('ferry', (1241, 77, 1373, 328), 0.6152, (1171, 87), (36, 15)),
    'pier_w': ('ferry', (73, 144, 392, 330), 0.7036, (93, 245), (26, 16)),
    'pier_e': ('ferry', (827, 143, 1154, 328), 0.6857, (941, 246), (34, 16)),
    'boat': ('ferry', (76, 441, 409, 604), 0.6589, (262, 273), (28, 16)),
    'end_w': ('broken', (78, 53, 575, 399), 0.5670, (258, 837), (28, 22)),
    'end_e': ('broken', (840, 53, 1365, 399), 0.5429, (867, 842), (34, 22)),
    'pile_31': ('broken', (78, 507, 206, 645), 0.5634, (594, 936), (31, 22)),
    'pile_32': ('broken', (212, 459, 343, 618), 0.5875, (667, 854), (32, 22)),
    'pile_33': ('broken', (350, 507, 481, 648), 0.5795, (752, 947), (33, 22)),
    'plank_31': ('broken', (539, 477, 809, 655), 0.6071, (493, 890), (31, 22)),
    'plank_33': ('broken', (856, 477, 1143, 655), 0.6071, (746, 890), (33, 22)),
    'bridge': ('bridge', (56, 723, 1389, 1031), 0.6571, (264, 836), (28, 22)),
}

pieces: dict[str, tuple[Image.Image, float, float, tuple[int, int]]] = {}
for name, (pack, box, scale, (ex, ey), cell) in PLACED.items():
    gx, gy = game(ex, ey)
    pieces[name] = (taken(pack, box, scale), gx, gy, cell)

# The map's west pier is three cells (world.ts FOOTBRIDGE: 28–30), the reference's end two and a half: its deck is drawn
# longer, a board of it (between the ladder and the torn end, where no leg stands) laid in again, so that its torn end
# comes to the gap and no cell one stands on shows the water. Its posts stand on the bank, as the reference has them.
WEST_POSTS, WEST_TORN = 27.8 * T, 31.3 * T
_, box, scale, (ex, ey), cell = PLACED['end_w'][0], *PLACED['end_w'][1:]
x0, y0, x1, y1 = box
k = scale / SHOWN / 6 * K
want = (WEST_TORN - WEST_POSTS) * K / k  # its width in the pack's pixels
board = (392, 431)
src = PACKS['broken'].crop(box)
n = max(0, round((want - src.width) / (board[1] - board[0])))
longer = Image.new('RGBA', (src.width + n * (board[1] - board[0]), src.height))
cut_at = board[1] - x0
longer.alpha_composite(src.crop((0, 0, cut_at, src.height)), (0, 0))
for i in range(n):
    longer.alpha_composite(src.crop((board[0] - x0, 0, cut_at, src.height)), (cut_at + i * (board[1] - board[0]), 0))
longer.alpha_composite(src.crop((cut_at, 0, src.width, src.height)), (cut_at + n * (board[1] - board[0]), 0))
k = (WEST_TORN - WEST_POSTS) * K / longer.width  # (to the cell exactly)
pieces['end_w'] = (longer.resize((round(longer.width * k), round(longer.height * k * scale / SHOWN / 6 * K / k)), Image.LANCZOS), WEST_POSTS, game(ex, ey)[1], cell)

# the east pier ends at the east edge of its last cell (35) and the whole bridge spans 28–35 to it, the posts on the
# bank: the east end set a little on, the whole bridge a little wider, so that no plank of the map's own shows past them
EAST_POSTS = 36.4 * T  # (the right of the picture: its posts stand on the east edge of cell 35, their leaves past it)
img, gx, gy, cell = pieces['end_e']
pieces['end_e'] = (img, EAST_POSTS - img.width / K, gy, cell)
img, gx, gy, cell = pieces['bridge']
k = (EAST_POSTS - gx) * K / img.width
pieces['bridge'] = (img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS), gx, gy - (k - 1) * img.height / K / 2, cell)

# the gap is what the two torn ends leave open (the east end's reaches into the gap's last cell, as the reference has
# it): a stump of a pile in each of its cells, spaced over it as the reference spaces them
east_torn = pieces['end_e'][1]
for name, at in (('pile_31', 0.18), ('pile_32', 0.52), ('pile_33', 0.84)):
    img, gx, gy, cell = pieces[name]
    pieces[name] = (img, WEST_TORN + at * (east_torn - WEST_TORN) - img.width / K / 2, gy, cell)
# a new plank spliced onto the west torn end overlaps it as the reference's does (its own torn end over the end's)
img, gx, gy, cell = pieces['plank_31']
pieces['plank_31'] = (img, WEST_TORN - 0.38 * T, gy, cell)
# a plank laid in the middle of the gap alone: the west one's, a cell on
img, gx, gy, _ = pieces['plank_31']
pieces['plank_32'] = (img, gx + T, gy, (32, 22))


# ------------------------------------------------------------------ the line strung (p7): the winch, the line, the block, the knot
def at(img: Image.Image, canvas: Image.Image, origin: tuple[float, float], gx: float, gy: float) -> None:
    canvas.alpha_composite(img, (round((gx - origin[0]) * K), round((gy - origin[1]) * K)))


# the winch with its line wound on and none hanging: the pack's, its two frayed ends taken off under the drum
winch = PACKS['ferry'].crop((472, 69, 753, 344))
w = np.array(winch)
ys, xs = np.mgrid[0:w.shape[0], 0:w.shape[1]]
X, Y = xs + 472, ys + 69
frayed = ((X >= 562) & (X <= 600) & (Y >= 226) & (Y <= 289)) | ((X >= 630) & (X <= 670) & (Y >= 226) & (Y <= 298))
w[frayed] = 0
wound = Image.fromarray(w)
k = 0.6312 / SHOWN / 6 * K
wound = wound.resize((round(wound.width * k), round(wound.height * k)), Image.LANCZOS)
wx, wy = game(20, 91)

# the line: the pack's length of it, as thick as the reference shows it, laid end to end (a whole number of its twists
# each time) from the drum to the knot
rope = np.array(PACKS['ferry'].crop((479, 497, 1184, 535)))
lum = rope[..., :3].astype(float) @ [0.3, 0.59, 0.11]
row = lum[lum.shape[0] // 2] - lum[lum.shape[0] // 2].mean()
ac = np.correlate(row, row, 'full')[len(row) - 1:]
period = int(np.argmax(ac[20:120]) + 20)
start = 40
twists = (len(row) - 2 * start) // period
length = Image.fromarray(rope[:, start:start + twists * period])
k = 0.5161 / SHOWN / 6 * K
length = length.resize((round(length.width * k), round(length.height * k)), Image.LANCZOS)
x0, y_mid = game(137, 173)
x1, _ = game(1125, 173)

block = taken('ferry', (1266, 420, 1330, 598), 0.5679)
bx, by = game(303, 156)
knot = taken('ferry', (1195, 745, 1268, 805), 0.7393)
kx, ky = game(1118, 146)

left, top = min(wx, x0), min(wy, by, ky, y_mid - length.height / K / 2)
right = max(kx + knot.width / K, x1)
bottom = max(wy + wound.height / K, by + block.height / K)
line = Image.new('RGBA', (round((right - left) * K) + 1, round((bottom - top) * K) + 1))
x = x0
while x < x1:
    piece = length if (x1 - x) * K >= length.width else length.crop((0, 0, round((x1 - x) * K), length.height))
    at(piece, line, (left, top), x, y_mid - length.height / K / 2)
    x += length.width / K
at(wound, line, (left, top), wx, wy)
at(block, line, (left, top), bx, by)
at(knot, line, (left, top), kx, ky)
pieces['line'] = (line, left, top, (25, 15))


# ------------------------------------------------------------------ the dead tree at the narrows (world.ts AT.deadTree, 28,10)
# Standing, three cells high, its roots on its cell; felled (content ford.ts ford/chop-dead-tree: its stump on its cell,
# the water east of it a way over, row 10's 29–34), its stump there and its trunk laid from the stump to the far bank,
# the trunk's middle along the row one walks (catalog.ts draws the river under it).
def by_height(box: tuple[int, int, int, int], height: float) -> Image.Image:
    p = PACKS['deadtree_standing'].crop(box)
    k = height * K / p.height
    return p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)


TREE_BOX, STUMP_BOX, TRUNK_BOX = (78, 108, 515, 668), (88, 775, 392, 990), (466, 338, 1372, 636)
tree = by_height(TREE_BOX, 48)
k = 48 / (TREE_BOX[3] - TREE_BOX[1])  # the tree's scale, the stump's too
stump = by_height(STUMP_BOX, (STUMP_BOX[3] - STUMP_BOX[1]) * k)
# the roots' middle (the trunk's foot, a third in from the left of the picture) on the cell's middle
pieces['dead_tree'] = (tree, 28.5 * T - tree.width * 0.42 / K, 11 * T + 1 - tree.height / K, (28, 10))
pieces['stump'] = (stump, 28.5 * T - stump.width * 0.5 / K, 11 * T + 1 - stump.height / K, (28, 10))
TRUNK_FROM, TRUNK_TO = 28.75 * T, 35.4 * T  # its torn end on the stump's side, its crown over the far bank
p = PACKS['deadtree'].crop(TRUNK_BOX)
k = (TRUNK_TO - TRUNK_FROM) * K / p.width
trunk = p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)
body = (528 - TRUNK_BOX[1]) * k / K  # the middle of the trunk's body below its picture's top, in game pixels
pieces['trunk'] = (trunk, TRUNK_FROM, 10.5 * T - body, (29, 10))


# ------------------------------------------------------------------ the sheet
def trim(img: Image.Image) -> tuple[Image.Image, int, int]:
    a = np.array(img)[..., 3]
    ys, xs = np.nonzero(a > 8)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)), int(xs.min()), int(ys.min())


WIDTH = 1024
cut = {n: trim(img) + (gx, gy, cell) for n, (img, gx, gy, cell) in pieces.items() if n != 'plank_32'}
order = sorted(cut, key=lambda n: -cut[n][0].height)
places, x, y, row = {}, 0, 0, 0
for name in order:
    img = cut[name][0]
    if x + img.width > WIDTH:
        x, y, row = 0, y + row + 2, 0
    places[name] = (x, y)
    x, row = x + img.width + 2, max(row, img.height)
sheet = Image.new('RGBA', (WIDTH, y + row))
index = {}
for name, (img, gx, gy, cell) in pieces.items():
    src = 'plank_31' if name == 'plank_32' else name
    p, ox, oy, *_ = cut[src]
    sx, sy = places[src]
    sheet.alpha_composite(p, (sx, sy))
    # where on it the foot of its cell is (the cell's bottom middle), in this sheet's pixels
    cx, cy = cell
    left, top = gx * K + ox, gy * K + oy
    index[name] = {'x': sx, 'y': sy, 'w': p.width, 'h': p.height, 'ax': round((cx * T + T / 2) * K - left, 1), 'ay': round((cy + 1) * T * K - top, 1), 'cell': [cx, cy]}
    print(f'{name:9s} {p.width:4d}x{p.height:<4d} cell {cx},{cy}  foot {index[name]["ax"]},{index[name]["ay"]}')
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, optimize=True)
INDEX.write_text(json.dumps({'img': 'lsw/Fixtures/FordCrossing.png', 'scale': 1 / K, 'pieces': index}, indent=1) + '\n')
print('→', OUT, sheet.width, 'x', sheet.height, f'(rope twist {period}px, {twists} a length)')

if len(sys.argv) > 1:
    view = Image.new('RGBA', sheet.size, (70, 130, 170, 255))
    view.alpha_composite(sheet)
    view.save(sys.argv[1])
