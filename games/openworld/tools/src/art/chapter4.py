"""Chapter 4's small pictures (docs/chapter-4.md): its story items' icons (16x16) — the Holy Wood of the Nails, a ferryman's
coin, Jory's kite — and its fixtures: a doorpost of Nailgate driven full of nails, a grave post by the causeway, the
Shroud of the Translation in its reliquary, and the Holy Wood standing in the Ford of the Dead (32x48 over one cell).

    python3 games/openworld/tools/src/art/chapter4.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from thingkit import Pic, lit, preview, write

# black wood, iron nails (light, mid, dark), rust; grey weathered wood; the fen's water
BLACK = ('5A4A44', '3C302C', '241C1A')
IRON = ('C4C8CE', '7E828C', '43464E')
RUST = ('A06A42', '74452A')
GREY_WOOD = ('9A9286', '766F64', '524C44')
CLOTH = ('BAB6AC', '8E8A82', '64615B')
WATER = ('8AA0A8', '627A84', '445860')


def nail_head(p: Pic, x: float, y: float, big: bool = False, rust: bool = False, new: bool = False) -> None:
    """A nail's head: dark iron with a glint at its top left (rusted: brown; new: bright). Big: a square head two across."""
    head, glint, shade = ('9EA2AA', 'F0F2F4', '6A6E76') if new else (('6E3E22', 'C07A48', '4A2614') if rust else ('2E3036', 'C4C8CE', '1E2026'))
    if big:
        p.rect(int(x), int(y), int(x) + 1, int(y) + 1, head)
        p.put(int(x), int(y), glint)
        p.put(int(x) + 1, int(y) + 1, shade)
    else:
        p.put(x, y, head)
        p.put(x - 1, y - 1, glint)


# ---- icons ------------------------------------------------------------------------------------------------------------

def holy_wood() -> Pic:
    # a board of black wood the length of a forearm, lying corner to corner, three great nails through it; their points
    # stand out of its underside
    p = Pic(16, 16)
    for t in range(-1, 15):  # the board: five pixels thick, bottom-left to top-right
        for w in range(5):
            x, y = 1 + t, 13 - t + w - 2
            c = BLACK[0] if w < 2 else BLACK[1] if w < 4 else BLACK[2]
            if (t + w * 3) % 7 == 0:
                c = BLACK[2]  # the grain
            p.put(x, y, c)
    for t in (3, 7, 11):  # the nails: a head on the face, a point out of the underside
        x, y = 1 + t, 13 - t
        nail_head(p, x - 1, y - 2, big=True, rust=t == 7)
        p.put(x + 1, y + 3, IRON[0])
        p.put(x + 2, y + 4, IRON[1])
    p.outline()
    return p


def ferry_coin() -> Pic:
    # an old bronze coin with a square hole, gone green with age
    p = Pic(16, 16)
    p.ellipse(8, 8, 6.4, 6.4, lambda u, v: lit(u, v, 'B8A060', '8E7A44', '5E4E2A'))
    p.ring(8, 8, 5.2, 5.2, '6E5C30')
    for (x, y) in ((4, 9), (5, 11), (11, 4), (12, 7), (10, 12), (6, 4), (3, 7)):  # verdigris
        p.put(x, y, '7EA08A')
        p.put(x + 1, y, '5E8270')
    p.rect(7, 7, 9, 9, '000000', 0)  # the hole
    for x in range(7, 10):
        for y in range(7, 10):
            p.a[y, x] = 0
    for k in range(6, 11):  # the hole's raised rim, dark on its far sides
        for (x, y) in ((k, 6), (k, 10), (6, k), (10, k)):
            p.put(x, y, '5E4E2A' if x == 10 or y == 10 else '6E5C30')
    p.outline()
    for x in range(7, 10):  # the hole stays clear of the outline
        for y in range(7, 10):
            p.a[y, x] = 0
    return p


def jory_kite() -> Pic:
    # a small diamond kite of patched cloth on two crossed sticks, its tail torn short, three bows left on it
    p = Pic(16, 16)
    top, left, right, bot = (8, 0), (2, 6), (14, 6), (8, 12)

    def inside(x: float, y: float) -> int:
        # which quarter of the diamond (0..3), or -1 outside
        if y <= 6:
            half = (y - top[1]) / 6 * 6
        else:
            half = (bot[1] - y) / 6 * 6
        if abs(x - 8) > half:
            return -1
        return (0 if x < 8 else 1) + (0 if y < 6 else 2)

    colours = ['B4584A', 'D2A850', '6E88A4', 'B4584A']
    for y in range(0, 13):
        for x in range(0, 16):
            q = inside(x, y)
            if q >= 0:
                p.put(x, y, colours[q])
    for (x, y) in ((10, 3), (11, 4), (10, 4)):  # a patch, stitched on
        p.put(x, y, 'C8C0A8')
    p.put(9, 3, '8E846C')
    p.line(8, 0, 8, 12, '5E4630')  # the sticks
    p.line(2, 6, 14, 6, '5E4630')
    for (x, y) in ((5, 4), (6, 9), (11, 9)):  # the cloth's light, the shade under the cross
        p.put(x, y, 'E2C890' if (x, y) == (6, 9) else 'D07060')
    p.outline()
    # the tail, torn: a string down and to the left, three bows
    p.line(8, 13, 5, 15, '6A5A44')
    for (x, y, c) in ((7, 14, 'B4584A'), (5, 15, 'D2A850')):
        p.put(x - 1, y, c)
        p.put(x + 1, y, c)
    return p


# ---- fixtures ---------------------------------------------------------------------------------------------------------

def nail_post() -> Pic:
    """A doorpost of Nailgate (16x24, its foot on the cell's): grey wood driven full of nails, one for each of the dead
    kept inside — dozens of heads, most dark, some rusted, a few new and bright at a man's height."""
    p = Pic(16, 24)
    wood = ('B4ADA2', '948C80', '6C655A')
    for y in range(2, 23):  # the post, six pixels wide, lit from the left
        for x in range(5, 11):
            c = wood[0] if x <= 6 else wood[1] if x < 10 else wood[2]
            if (y * 5 + x) % 13 == 0:
                c = wood[2]  # the grain
            p.put(x, y, c)
    p.rect(4, 1, 11, 2, wood[1])  # the cap
    p.rect(4, 1, 10, 1, wood[0])
    p.put(11, 2, wood[2])
    import random
    rnd = random.Random(7)
    for y in range(4, 21, 2):  # the nails in rough rows, from the cap to the knee
        for x in range(6 + (y // 2) % 2, 11, 2):
            if rnd.random() < 0.85:
                kind = rnd.random()
                nail_head(p, x + rnd.choice((0, 0, 1)) - (1 if x > 9 else 0), y + rnd.choice((0, 1)), rust=kind < 0.25, new=(10 <= y <= 13 and kind > 0.78))
    p.rect(3, 22, 12, 23, '4A4038', 160)  # its foot in the mud
    p.outline()
    return p


def grave_post() -> Pic:
    """A grave post by the causeway (16x24): a cross of black wood leaning out over the water, nails in it, a strip of grey
    cloth tied at the crossing, its loose end lifting."""
    p = Pic(16, 24)
    lean = lambda y: (22 - y) * 0.18
    for y in range(2, 23):  # the upright, three wide, leaning right as it rises
        for w in range(3):
            p.put(6 + w + lean(y), y, BLACK[0] if w == 0 else BLACK[1] if w == 1 else BLACK[2])
    p.put(7 + lean(2), 1, BLACK[1])  # its cut top
    for x in range(3, 13):  # the crossbar, two deep
        p.put(x + lean(7), 7, BLACK[0] if x < 10 else BLACK[1])
        p.put(x + lean(8), 8, BLACK[2])
    for (x, y) in ((4, 7), (11, 7), (7, 13), (7, 17), (8, 20)):  # nails
        nail_head(p, x + lean(y) + 0.4, y, rust=(x + y) % 3 == 0)
    for x in range(5, 11):  # the cloth tied round the crossing
        p.put(x + lean(9), 9, CLOTH[0] if x < 8 else CLOTH[1])
        p.put(x + lean(10), 10, CLOTH[1] if x < 9 else CLOTH[2])
    for k, (x, y) in enumerate(((12, 9), (13, 8), (14, 8), (15, 9), (13, 10))):  # its loose end, lifting
        p.put(x, y, CLOTH[0] if k % 2 == 0 else CLOTH[1])
    p.rect(3, 22, 12, 23, '3E4A4E', 150)  # the water at its foot
    p.outline()
    return p


def shroud() -> Pic:
    """The Shroud of the Translation (16x24): a glass reliquary on a carved stand, a folded black cloth inside whose black
    seems to move — an inky swirl with a faint violet sheen."""
    p = Pic(16, 24)
    # the stand: carved dark wood, a moulding, two feet
    p.rect(3, 17, 12, 19, '6A4A30')
    p.rect(3, 17, 12, 17, '8A6440')
    p.rect(5, 20, 10, 21, '4E3420')
    p.rect(4, 22, 6, 23, '4E3420')
    p.rect(9, 22, 11, 23, '3A2616')
    for x in (5, 8, 11):
        p.put(x, 18, '4E3420')  # the carving
    # the glass case: a pale frame of gilt, the glass faintly blue
    p.rect(2, 5, 13, 16, 'C8D8E0', 70)
    for x in range(2, 14):
        p.put(x, 4, 'C8A050')
        p.put(x, 16, '9C7838')
    for y in range(4, 17):
        p.put(2, y, 'C8A050')
        p.put(13, y, '9C7838')
    # the cloth, folded on a little cushion, its black an inky swirl
    p.rect(4, 13, 11, 15, '6A2A34')  # the cushion
    for y in range(8, 14):
        for x in range(4, 12):
            u, v = (x - 7.5) / 4, (y - 10.5) / 3
            ang = math.atan2(v, u)
            r = math.hypot(u, v)
            swirl = math.sin(ang * 2 + r * 5)
            c = '161220' if swirl < 0.1 else '2E2444' if swirl < 0.6 else '6A58A0'
            p.put(x, y, c)
    p.line(4, 8, 11, 8, '0E0A14')  # the fold's edge
    p.put(9, 9, '8A7AB0')  # a glint of violet
    # the glass's shine, over all
    p.line(4, 6, 6, 6, 'FFFFFF', 150)
    p.line(3, 7, 3, 10, 'FFFFFF', 110)
    p.outline()
    return p


def holy_wood_tree() -> Pic:
    """The Holy Wood (32x48 over one cell, anchored at the bottom middle): a dead black tree standing in the shallows of the
    Ford of the Dead, three great iron nails driven through its trunk, their points out the far side."""
    p = Pic(32, 48)
    # the water round its foot: rings on the shallows
    p.ellipse(16, 45, 13, 2.6, lambda u, v: WATER[0] if v < -0.2 else WATER[1], 170)
    p.ring(16, 45, 9, 1.6, 'B4C8CE', 150)
    # the trunk, thick at the foot, twisting up
    for y in range(10, 46):
        t = (45 - y) / 35
        half = 3.4 - t * 1.6
        cx = 16 + math.sin(t * 3.2) * 1.6
        for x in range(int(cx - half) - 1, int(cx + half) + 2):
            u = (x - cx) / max(half, 0.5)
            if abs(u) <= 1:
                c = BLACK[0] if u < -0.4 else BLACK[1] if u < 0.5 else BLACK[2]
                if (y * 2 + x) % 9 == 0:
                    c = BLACK[2]
                p.put(x, y, c)
    # the roots into the water
    for (x0, x1, y1) in ((14, 9, 46), (18, 24, 46), (15, 12, 47), (17, 21, 47)):
        p.line(x0, 43, x1, y1, BLACK[1])
    # the branches, bare and crooked
    def branch(x0: float, y0: float, ang: float, length: float, width: int, depth: int) -> None:
        x1 = x0 + math.cos(ang) * length
        y1 = y0 - math.sin(ang) * length
        for w in range(width):
            p.line(x0 + w * 0.6, y0, x1 + w * 0.4, y1, BLACK[1] if w == 0 else BLACK[2])
        if depth:
            branch(x1, y1, ang + 0.55, length * 0.62, max(1, width - 1), depth - 1)
            branch(x1, y1, ang - 0.6, length * 0.55, max(1, width - 1), depth - 1)
    branch(16, 13, 1.25, 8, 2, 2)
    branch(15, 19, 2.55, 9, 2, 2)
    branch(17, 22, 0.45, 9, 2, 2)
    branch(16, 10, 1.8, 6, 1, 1)
    # the three great nails through the trunk: square heads on the face, their points out the right-hand side
    for y in (20, 28, 36):
        cx = 16 + math.sin((45 - y) / 35 * 3.2) * 1.6
        p.rect(int(cx) - 2, y, int(cx), y + 2, '3A3C44')
        p.put(int(cx) - 2, y, 'D0D4DA')
        p.put(int(cx) - 1, y, '9EA2AA')
        p.put(int(cx), y + 2, '1E2026')
        for k in range(4):  # the point out the far side
            p.put(int(cx) + 3 + k, y + 1, '8E929A' if k < 3 else '5E626A')
        p.put(int(cx) - 3, y + 3, RUST[1])  # a rust streak below the head
        p.put(int(cx) - 2, y + 4, RUST[1])
    p.outline(skip=lambda x, y: y >= 43)
    return p


ICONS = {'HolyWood': holy_wood, 'FerryCoin': ferry_coin, 'JoryKite': jory_kite}
FIXTURE_ART = {'NailPost': nail_post, 'GravePost': grave_post, 'Shroud': shroud, 'HolyWoodTree': holy_wood_tree}

if __name__ == '__main__':
    pics = write(ICONS, FIXTURE_ART)
    if len(sys.argv) > 1:
        preview(pics, Path(sys.argv[1]) / 'chapter4_things.png', ground=(96, 108, 100, 255))
