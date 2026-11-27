"""The ferrykeeper's camp at Vesper Ford: the camp pack's pieces brought down to the game's pixel and cut into its things.

The pack (ferry-camp/pack.png, its transparent pieces as they were painted) holds three groups drawn whole — the tent
with its lantern post, potted flowers and chest; the cooking fire under its rack with a stool beside it; the work stall
under its awning with a barrel, potted flowers, a crate, spare planks and a coil of rope — and the camp's loose pieces:
a bench, rope rails, a chopping block with its axe, logs, a chest and crates, barrels, sacks, a small table, grass,
stones and a flower. The wooden sign (ferry-camp/wood_sign.png) is the earlier pack's.

Each piece is reduced by whole blocks to the size the camp wants it at, never smoothed: a block's pixel is the colour
most of it has, its outline when outline is a good part of it, and it is there or not, nothing between.

A group is cut into the things it shows, so that what is drawn is what the world holds, each piece drawn by its own
thing: a mask a piece, the group's first thing taking what the others leave. Where a piece stood in front of another,
the one behind keeps a gap there; the pieces stand on cells that put them back together as the group was drawn (each
piece's place in its group is the cell it stands on, `at`, counted from the group's first thing; content ford.ts
FORD_CAMP stands them so, and a test holds it). Three pieces are changed: the fire is drawn cold, charred wood in its
ring (the game draws the flame over a lit fire itself), and the smoke over the pot is left out with it; the chopping
block's axe is cut out of it into a piece of its own, which the camp's old axe is drawn with while it lies on the block.

The pieces are packed into one sheet (public/assets/lsw/Fixtures/FerryCamp.png); client/src/ferry-camp.json says where
each one is on it and where on it its cell's foot is (the middle of the cell's bottom edge), and for a group's pieces
the cell each stands on in its group.

    python3 games/openworld/tools/src/art/ferry-camp.py [preview.png]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent / 'ferry-camp'
GAME = Path(__file__).resolve().parents[3]
OUT = GAME / 'public/assets/lsw/Fixtures/FerryCamp.png'
INDEX = GAME / 'client/src/ferry-camp.json'
T = 16  # a cell, in pixels


def load(name: str) -> np.ndarray:
    return np.array(Image.open(HERE / f'{name}.png').convert('RGBA')).astype(int)


def reduce(a: np.ndarray, k: float, ink: int = 70, share: float = 0.28) -> np.ndarray:
    """A piece k source pixels to one: each block's most common colour (its outline when that is over a quarter of it)."""
    H, W, _ = a.shape
    w, h = round(W / k), round(H / k)
    out = np.zeros((h, w, 4), np.uint8)
    for j in range(h):
        y0 = int(j * H / h)
        y1 = max(y0 + 1, int((j + 1) * H / h))
        for i in range(w):
            x0 = int(i * W / w)
            x1 = max(x0 + 1, int((i + 1) * W / w))
            b = a[y0:y1, x0:x1].reshape(-1, 4)
            solid = b[b[:, 3] >= 128]
            if len(solid) < 0.5 * len(b):
                continue
            dark = solid[solid[:, :3] @ [0.3, 0.59, 0.11] < ink]
            pool = dark if len(dark) >= share * len(solid) else solid
            _, which, count = np.unique(pool[:, :3] // 12, axis=0, return_inverse=True, return_counts=True)
            out[j, i, :3] = np.median(pool[which.ravel() == np.argmax(count)][:, :3], axis=0)
            out[j, i, 3] = 255
    return out


PACK = load('pack')


def part(box: tuple[int, int, int, int], k: float) -> np.ndarray:
    """A box of the pack (left, top, right, bottom), reduced."""
    x0, y0, x1, y1 = box
    return reduce(PACK[y0:y1, x0:x1], k)


def grid(a: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    return np.mgrid[0:a.shape[0], 0:a.shape[1]]


def ellipse(cx: float, cy: float, rx: float, ry: float):
    return lambda y, x: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def lum(a: np.ndarray) -> np.ndarray:
    return a[..., :3] @ np.array([0.3, 0.59, 0.11])


def sat(a: np.ndarray) -> np.ndarray:
    return a[..., :3].max(-1) - a[..., :3].min(-1)


def cold(fire: np.ndarray, inner, ring) -> np.ndarray:
    """The fire gone out: inside its ring of stones, the flame and the burning wood charred dark."""
    u = fire.copy()
    y, x = grid(fire)
    r, g, b = (fire[..., i].astype(int) for i in range(3))
    stone = (sat(fire) < 40) & (r < 225)
    burning = inner(y, x) & (fire[..., 3] > 0) & ~stone
    l = lum(fire)
    for lo, colour in ((200, (92, 80, 70)), (150, (82, 60, 44)), (100, (62, 46, 36)), (-1, (36, 28, 24))):
        m = burning & (l > lo)
        u[m, :3] = colour
        burning &= ~m
    # a flame's tip that rose over a stone of the ring: the stone's grey; one that rose over the ring, gone
    tip = ~inner(y, x) & (fire[..., 3] > 0) & (r > 190) & (g > 80) & (r - b > 60)
    u[tip & ring(y, x), :3] = (150, 146, 140)
    u[tip & ~ring(y, x)] = 0
    return u


def group(a: np.ndarray, root: str, foot: tuple[int, int], members: dict) -> dict:
    """A group cut into its things: each member a mask and the cell it stands on counted from the root's; the root takes
    the rest. Each piece is returned with its foot (its cell's bottom middle) in its own frame."""
    y, x = grid(a)
    left = a[..., 3] > 0
    pieces = {}
    for name, (mask, at) in members.items():
        m = mask(y, x) & left
        pieces[name] = (np.where(m[..., None], a, 0), at)
        left &= ~m
    pieces[root] = (np.where(left[..., None], a, 0), (0, 0))
    out = {}
    for name, (p, (dx, dy)) in pieces.items():
        out[name] = (p, (foot[0] + T * dx, foot[1] + T * dy), root, (dx, dy))
    return out


def alone(p: np.ndarray, dx: int = 0, lift: int = 0) -> tuple:
    """A piece standing alone on its cell: its foot on the cell's, its middle `dx` right of the cell's middle; `lift`
    how far below the cell's bottom edge it reaches."""
    ys, xs = np.nonzero(p[..., 3])
    return (p, ((xs.min() + xs.max() + 1) / 2 - dx, ys.max() + 1 - lift), None, None)


# ------------------------------------------------------------------ the tent, its lantern post, potted flowers and chest
tent = part((56, 60, 530, 420), 5.7)
TENT = group(tent, 'tent', (40, 52), {
    'chest': (lambda y, x: (x >= 64) & (y >= 34), (2, 0)),
    'lantern': (lambda y, x: ((x <= 19) & (y >= 13) & (y <= 24)) | ((x <= 17) & (y > 24) & (y <= 36)) | ((x <= 8) & (y > 36)), (-2, 0)),
    'planter': (lambda y, x: ellipse(17, 45, 8.5, 5.5)(y, x) | ((x >= 9) & (x <= 25) & (y >= 48)), (-1, 1)),
})

# ------------------------------------------------------------------ the cooking fire, the rack over it, the stool by it
K = 6.6  # the fire a little larger than the pack's other loose pieces; its cuts below are counted in pixels of 7.6
q = 7.6 / K
fire = part((600, 66, 905, 414), K)
fy, fx = grid(fire)
fire[(fy <= 16 * q) | ((fy <= 22 * q) & (lum(fire) > 150) & (sat(fire) < 60))] = 0  # the smoke
by_it = (fx >= 29 * q) & (fy >= 30 * q)
seat = np.where(by_it[..., None], fire, 0)  # the stool, which stands alone
fire[by_it] = 0
r, g, b = (fire[..., i].astype(int) for i in range(3))
flame = (fire[..., 3] > 0) & (r > 190) & (g > 80) & (r - b > 60)  # the fire's, wherever it rose
ring = ellipse(15.5 * q, 39.5 * q, 11.5 * q, 7 * q)
FIRE = group(fire, 'fire', (round(16 * q), round(46 * q)), {
    'rack': (lambda y, x: (~ring(y, x) | ((x >= 9 * q) & (x <= 22 * q) & (y <= 36 * q))) & ~flame, (0, -1)),
})
FIRE['fire'] = (cold(FIRE['fire'][0], ellipse(15.5 * q, 39.5 * q, 7.5 * q, 4.6 * q), ring),) + FIRE['fire'][1:]

# ------------------------------------------------------------------ the work stall and what stands round it
stall = part((952, 62, 1406, 410), 5.7)
STALL = group(stall, 'stall', (40, 46), {
    'planks': (lambda y, x: (x >= 38) & (x <= 60) & (y >= 50), (1, 1)),
    'rope': (lambda y, x: (x >= 60) & (x <= 77) & (y >= 48) & ~((x >= 73) & (y <= 50)), (2, 1)),
    'crate': (lambda y, x: (x >= 44) & (x <= 60) & (y >= 39) & (y <= 51), (1, 0)),
    'pot': (lambda y, x: (x <= 12) & (y >= 22) & (y <= 45), (-2, 0)),
    'barrel': (lambda y, x: (x >= 11) & (x <= 23) & (y >= 28) & (y <= 45), (-1, 0)),
})

# ------------------------------------------------------------------ the chopping block and its axe
block = part((1178, 456, 1324, 640), 7.6)
by, bx = grid(block)
top = ellipse(9.5, 12, 8, 3.2)
grey = (sat(block) < 45) & (block[..., 3] > 0) & (lum(block) > 60)
axe_px = (by <= 8) | (grey & (by <= 16)) | ((by <= 15) & (lum(block) <= 60) & (bx >= 5) & (bx <= 13) & ~top(by - 1, bx) & (by <= 10))
axe_px &= block[..., 3] > 0
stump = np.where(axe_px[..., None], 0, block)
tan = np.median(block[top(by, bx) & ~axe_px & (lum(block) > 140)][:, :3], axis=0)
inside = top(by, bx) & axe_px
stump[inside, :3] = tan
stump[inside, 3] = 255
rim = ~top(by, bx) & top(by + 1, bx) & (by <= 12) & (stump[..., 3] == 0)
stump[rim] = (40, 28, 22, 255)
axe = np.where(axe_px[..., None], block, 0)

# ------------------------------------------------------------------ the loose pieces
logs = part((54, 684, 344, 856), 8)
crates = part((583, 676, 764, 848), 8.5)
sacks = part((1163, 686, 1386, 856), 8.5)
table = part((253, 878, 468, 1050), 8)
bench = part((90, 506, 396, 602), 6.8)
rail = part((483, 482, 735, 604), 7.6)
rail_turn = part((860, 462, 1061, 623), 7.6)
grass = part((605, 931, 721, 1009), 7.6)
stones = part((796, 953, 888, 1012), 7.6)
flower = part((975, 944, 1062, 1008), 7.6)
sign = reduce(load('wood_sign'), 4.5)

def foot_of(p: np.ndarray, lift: int) -> tuple[float, int]:
    ys, xs = np.nonzero(p[..., 3])
    return (xs.min() + xs.max() + 1) / 2, ys.max() + 1 - lift


PIECES: dict[str, tuple] = {
    **TENT, **FIRE, **STALL,
    'seat': alone(seat, lift=2),
    'block': alone(stump, lift=2),
    # the axe where it bit: drawn on the block's own cell, its frame the block's
    'axe': (axe, foot_of(stump, 2), None, None),
    'bench': alone(bench, lift=2),
    'logs': alone(logs, lift=1),
    'crates': alone(crates, lift=2),
    'sacks': alone(sacks, lift=2),
    'table': alone(table, lift=2),
    'rail': alone(rail, lift=1),
    'rail_turn': alone(rail_turn, lift=1),
    'grass': alone(grass, lift=2),
    'stones': alone(stones, lift=4),
    'flower': alone(flower, lift=4),
    'sign': alone(sign, lift=2),
}


def trim(p: np.ndarray) -> tuple[np.ndarray, int, int]:
    ys, xs = np.nonzero(p[..., 3])
    return p[ys.min():ys.max() + 1, xs.min():xs.max() + 1], int(xs.min()), int(ys.min())


# packed in rows, tallest first, each row as tall as its first piece, the sheet 256 wide
WIDTH = 256
cut = {name: trim(p) + (foot, root, at) for name, (p, foot, root, at) in PIECES.items()}
order = sorted(cut, key=lambda n: -cut[n][0].shape[0])
places, x, y, row = {}, 0, 0, 0
for name in order:
    h, w = cut[name][0].shape[:2]
    if x + w > WIDTH:
        x, y, row = 0, y + row + 1, 0
    places[name] = (x, y)
    x, row = x + w + 1, max(row, h)
sheet = np.zeros((y + row, WIDTH, 4), np.uint8)
index = {}
for name in PIECES:
    p, ox, oy, foot, root, at = cut[name]
    h, w = p.shape[:2]
    sx, sy = places[name]
    sheet[sy:sy + h, sx:sx + w] = p
    entry = {'x': sx, 'y': sy, 'w': w, 'h': h, 'ax': round(float(foot[0] - ox), 1), 'ay': round(float(foot[1] - oy), 1)}
    if root and name != root:
        entry['group'] = {'root': root, 'at': list(at)}
    index[name] = entry
    print(f'{name:10s} {w:3d}x{h:<3d} foot {entry["ax"]},{entry["ay"]}' + (f'  {root}{tuple(at)}' if root and name != root else ''))
OUT.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(sheet).save(OUT)
INDEX.write_text(json.dumps({'img': 'lsw/Fixtures/FerryCamp.png', 'pieces': index}, indent=1) + '\n')
print('→', OUT, sheet.shape[1], 'x', sheet.shape[0])

if len(sys.argv) > 1:
    view = Image.new('RGBA', (sheet.shape[1], sheet.shape[0]), (146, 170, 72, 255))
    view.alpha_composite(Image.fromarray(sheet))
    view.resize((view.width * 4, view.height * 4), Image.NEAREST).save(sys.argv[1])
