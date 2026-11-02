"""Chapter 2's small pictures (docs/chapter-2.md): its story items' icons (16x16) and two fixtures, the broken Scourging
Post of the Pillar Yard (16x32) and the undercroft's red channel (a 16x16 floor tile, seamless left to right).

Each is drawn from shapes in a few shades and given the item icons' dark outline afterwards.

    python3 games/openworld/tools/src/art/chapter2.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
ITEMS = ROOT / 'games/openworld/public/assets/lsw/Items'
FIXTURES = ROOT / 'games/openworld/public/assets/lsw/Fixtures'

C = {
    'k': '2A2020',  # the outline
    'I': 'C4C8D0', 'i': '8A8E98', 'j': '565A64',  # iron
    'R': 'C83A36', 'r': '8E1F21', 'q': '5E1217',  # red cloth, red leather
    'W': 'B07A48', 'w': '7A4E2C', 'v': '4E3020',  # wood
    'P': 'E8D8B8', 'p': 'C4AE88',  # paper, drum skin
    'L': '7A4228', 'l': '4E2818',  # leather
    'G': 'D49A50', 'g': 'A36A34',  # gold, wax
    'S': 'A8A090', 's': '7E7868', 't': '57524A', 'u': '403C36',  # stone
    'C': 'D8C8A0', 'c': 'A8946A',  # cord
    'x': '3A1A18',  # old stains
    'B': '7A1216', 'b': '520A0E', 'H': 'B8302C',  # the channel's dark red, and its glint
}


def rgb(k: str) -> tuple[int, int, int, int]:
    h = C[k]
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Pic:
    def __init__(self, w: int, h: int):
        self.a = np.zeros((h, w, 4), np.uint8)
        self.w, self.h = w, h

    def put(self, x: float, y: float, k: str) -> None:
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < self.w and 0 <= yi < self.h:
            self.a[yi, xi] = rgb(k)

    def line(self, x0: float, y0: float, x1: float, y1: float, k: str) -> None:
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for s in range(n + 1):
            self.put(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, k)

    def rect(self, x0: int, y0: int, x1: int, y1: int, k: str) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, k)

    def outline(self, k: str = 'k', skip: set[str] | None = None) -> None:
        a = self.a
        filled = a[..., 3] > 0
        if skip:
            keep = np.zeros_like(filled)
            for y in range(self.h):
                for x in range(self.w):
                    if filled[y, x] and '%02X%02X%02X' % tuple(a[y, x, :3]) not in {C[s] for s in skip}:
                        keep[y, x] = True
            filled = keep
        out = []
        for y in range(self.h):
            for x in range(self.w):
                if a[y, x, 3]:
                    continue
                if any(0 <= x + dx < self.w and 0 <= y + dy < self.h and filled[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.append((x, y))
        for x, y in out:
            self.put(x, y, k)

    def save(self, path: Path) -> None:
        Image.fromarray(self.a).save(path)


def chain() -> Pic:
    # an iron chain ending in the big ring that was set in the post
    p = Pic(16, 16)
    cx, cy = 5.0, 5.0
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - cx, y - cy)
            if 2.2 <= d <= 4.4:
                light = (x - cx) + (y - cy) < -1.5
                dark = (x - cx) + (y - cy) > 2.5
                p.put(x, y, 'I' if light else 'j' if dark else 'i')
    for n, (lx, ly) in enumerate([(8.6, 8.6), (10.8, 10.8), (13.0, 13.0)]):
        if n % 2 == 0:  # a link seen face on: a small oval ring along the diagonal
            for y in range(16):
                for x in range(16):
                    u, v = ((x - lx) + (y - ly)) / 1.414, ((x - lx) - (y - ly)) / 1.414
                    e = (u / 1.9) ** 2 + (v / 1.2) ** 2
                    if 0.45 <= e <= 1.25:
                        p.put(x, y, 'I' if u < 0 else 'i')
        else:  # a link edge on: a short bar across it
            p.line(lx - 1, ly + 1, lx + 1, ly - 1, 'i')
            p.put(lx - 1, ly + 1, 'I')
    p.outline()
    return p


def drum() -> Pic:
    # a small side drum with red hoops and its cords, two sticks crossed over it
    p = Pic(16, 16)
    p.rect(3, 8, 12, 13, 'W')
    p.rect(3, 8, 4, 13, 'w')
    p.rect(11, 8, 12, 13, 'w')
    for x in range(3, 13):  # the cords in a zigzag over the shell
        p.put(x, 9 + (x % 4 if x % 4 < 3 else 4 - x % 4), 'C')
    p.rect(3, 13, 12, 13, 'r')  # the bottom hoop
    p.rect(3, 7, 12, 7, 'r')  # the top hoop
    for x in range(4, 12):  # the skin
        p.put(x, 6, 'p')
    for x in range(5, 11):
        p.put(x, 6, 'P')
    p.rect(3, 7, 3, 7, 'q')
    p.rect(12, 7, 12, 7, 'q')
    p.line(3, 1, 8, 5, 'W')
    p.line(13, 1, 9, 5, 'W')
    p.put(3, 1, 'p')
    p.put(13, 1, 'p')
    p.outline()
    return p


def scourge() -> Pic:
    # a short scourge: a wooden handle bound at its head, knotted cords hanging from it
    p = Pic(16, 16)
    p.line(2, 14, 6, 10, 'W')
    p.line(3, 14, 7, 10, 'w')
    p.put(2, 14, 'v')
    p.rect(6, 8, 8, 10, 'L')
    p.put(6, 8, 'l')
    p.outline()
    for (ex, ey) in ((15, 2), (15, 7), (11, 1), (14, 12), (8, 1)):
        p.line(8.5, 8.5, ex, ey, 'C')
        for t in (0.4, 0.7, 1.0):  # the knots
            x, y = 8.5 + (ex - 8.5) * t, 8.5 + (ey - 8.5) * t
            p.put(x, y, 'c')
            p.put(x + 1, y, 'c')
    return p


def banner() -> Pic:
    # a red banner folded on a broken pole
    p = Pic(16, 16)
    p.line(3, 15, 9, 1, 'w')
    p.line(4, 15, 10, 1, 'W')
    p.put(9, 0, 'v')
    p.put(11, 1, 'W')  # the splintered break
    poly = [(8, 3), (14, 4), (13, 11), (7, 10)]
    for y in range(16):
        for x in range(16):
            inside = True
            for i in range(4):
                (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % 4]
                if (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0) < 0:
                    inside = False
            if inside:
                p.put(x, y, 'R')
    for (x0, y0, x1, y1) in ((10, 4, 9, 10), (12, 4, 11, 11)):  # the folds
        p.line(x0, y0, x1, y1, 'r')
    p.line(7, 10, 13, 11, 'q')
    p.put(10, 7, 'P')  # a pale mark on it, worn to a smudge
    p.put(11, 7, 'P')
    p.outline()
    return p


def ledger() -> Pic:
    # a thick ledger in stained leather, the pages' edge showing
    p = Pic(16, 16)
    p.rect(3, 3, 12, 12, 'L')
    p.rect(3, 3, 4, 12, 'l')  # the spine
    p.rect(5, 13, 13, 13, 'P')  # the pages under the cover
    p.rect(13, 4, 13, 13, 'p')
    p.rect(5, 14, 13, 14, 'p')
    p.rect(7, 5, 11, 6, 'p')  # the label
    p.put(9, 9, 'x')
    p.put(10, 9, 'x')
    p.put(9, 10, 'x')
    p.put(11, 11, 'x')
    p.outline()
    return p


def register() -> Pic:
    # a red-bound register with a wax seal and its ribbon
    p = Pic(16, 16)
    p.rect(3, 2, 12, 13, 'r')
    p.rect(3, 2, 4, 13, 'q')
    p.rect(13, 3, 13, 13, 'P')
    p.rect(5, 14, 13, 14, 'p')
    p.put(11, 3, 'G')
    p.put(12, 2, 'G')  # a gilt corner
    p.line(9, 9, 8, 15, 'R')  # the ribbon
    p.line(9, 9, 10, 15, 'q')
    for y in range(16):
        for x in range(16):
            if math.hypot(x - 8.5, y - 8.0) <= 2.3:
                p.put(x, y, 'G' if x + y < 16 else 'g')
    p.put(8, 8, 'g')
    p.outline()
    return p


def post() -> Pic:
    # the broken Scourging Post: a thick weathered pillar broken off jaggedly at head height, two iron rings side by side
    # at the height of a man's wrists with their chains' ends, old stains running down to its foot
    p = Pic(16, 32)
    tops = [10, 8, 10, 9, 7, 9, 8, 11, 9, 10]
    for i, x in enumerate(range(3, 13)):
        for y in range(tops[i], 29):
            p.put(x, y, 'S' if i < 2 else 't' if i >= 8 else 's')
        p.put(x, tops[i], 'P' if 2 <= i <= 6 else 'S')  # the break, paler where it is fresh
    for (y, x0, x1) in ((17, 4, 7), (21, 8, 11), (25, 5, 8)):  # cracks
        p.line(x0, y, x1, y + 1, 'u')
    p.rect(2, 28, 13, 30, 's')  # the plinth
    p.rect(2, 28, 3, 30, 'S')
    p.rect(12, 28, 13, 30, 't')
    for rx in (2.5, 12.5):  # set in its two sides
        ry = 14
        for y in range(ry - 2, ry + 3):
            for x in range(int(rx) - 2, int(rx) + 3):
                d = math.hypot(x - rx, y - ry)
                if 1.0 <= d <= 2.0 and not (3 <= x <= 12 and 1.0 <= d <= 1.4):
                    p.put(x, y, 'I' if y <= ry else 'i')
        for k, y in enumerate(range(ry + 2, ry + 6)):  # the chain's end
            p.put(rx - 0.5 + (k % 2), y, 'I' if k % 2 == 0 else 'j')
    for (x, y) in ((4, 18), (4, 19), (5, 21), (11, 18), (11, 20), (10, 22), (9, 26), (6, 27), (8, 27), (11, 27), (5, 25)):
        p.put(x, y, 'x')  # stains running down from under the rings
    p.outline()
    for x in range(1, 15):  # the dark ground round its foot
        if (x * 5) % 3:
            p.put(x, 31, 'x')
    return p


def standard() -> Pic:
    # the Red Host's banner on its pole: red cloth hanging from a crossbar, torn a little at the foot, a white pillar
    # stitched down its middle
    p = Pic(16, 32)
    for y in range(2, 31):  # the pole
        p.put(7, y, 'W')
        p.put(8, y, 'w')
    p.put(7, 1, 'G')
    p.put(8, 1, 'g')  # its finial
    p.rect(2, 3, 13, 3, 'w')  # the crossbar
    for x in range(2, 14):
        p.put(x, 3, 'W' if x < 8 else 'w')
    hem = {2: 17, 3: 18, 4: 16, 5: 18, 6: 19, 7: 17, 8: 18, 9: 19, 10: 17, 11: 18, 12: 16, 13: 17}
    for x in range(2, 14):  # the cloth, its hem torn
        for y in range(4, hem[x] + 1):
            p.put(x, y, 'R' if x < 5 else 'q' if x > 11 else 'r' if (x + y) % 7 == 0 else 'R' if x < 8 else 'r')
    for y in range(6, 15):  # the white pillar stitched on it
        p.put(7, y, 'P')
        p.put(8, y, 'p')
    p.rect(6, 6, 9, 6, 'P')  # its capital
    p.rect(6, 14, 9, 14, 'P')  # its foot
    p.put(9, 6, 'p')
    p.put(9, 14, 'p')
    p.outline()
    for x in (6, 9):  # the ground at its foot
        p.put(x, 31, 'u')
    return p


def channel() -> Pic:
    # a narrow gutter cut across a flagstone floor, dark red standing in it; its patterns repeat every 8 pixels so the
    # tile joins itself left and right
    p = Pic(16, 16)
    for x in range(16):
        p.put(x, 5, 'S')
        p.put(x, 6, 'u')
        for y in (7, 8, 9):
            p.put(x, y, 'B' if y == 7 or (x + y) % 8 else 'b')
        p.put(x, 9, 'b')
        p.put(x, 10, 's')
        p.put(x, 11, 't' if x % 8 in (2, 3, 6) else 'u')
    for x in (3, 11):  # a glint on the surface
        p.put(x, 7, 'H')
        p.put(x + 1, 7, 'H')
    p.put(7, 8, 'H')
    p.put(15, 8, 'H')
    return p


ICONS = {
    'ChainOfThePost': chain, 'WarDrum': drum, 'NoviceScourge': scourge, 'LeftBanner': banner,
    'SurgeonLedger': ledger, 'OfferingRegister': register,
}
FIXTURE_ART = {'ScourgingPost': post, 'RedChannel': channel, 'RedStandard': standard}

if __name__ == '__main__':
    pv = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    pics = {}
    for name, f in ICONS.items():
        pics[name] = f()
        pics[name].save(ITEMS / f'{name}.png')
    for name, f in FIXTURE_ART.items():
        pics[name] = f()
        pics[name].save(FIXTURES / f'{name}.png')
    for name, pic in pics.items():
        print(f'  {name}.png {pic.w}x{pic.h}')
    if pv:
        W = sum(pic.w + 4 for pic in pics.values()) + 16 * 3
        canvas = Image.new('RGBA', (W, 32), (58, 58, 72, 255))
        x = 0
        for name, pic in pics.items():
            canvas.alpha_composite(Image.fromarray(pic.a), (x, 32 - pic.h))
            x += pic.w + 4
        tile = Image.fromarray(pics['RedChannel'].a)
        floor = Image.new('RGBA', (48, 16), (110, 104, 96, 255))
        for k in range(3):
            floor.alpha_composite(tile, (k * 16, 0))
        canvas.alpha_composite(floor, (x, 16))
        canvas.resize((canvas.width * 6, canvas.height * 6), Image.NEAREST).save(pv / 'chapter2_icons.png')
