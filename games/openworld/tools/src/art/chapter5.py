"""Chapter 5's small pictures (docs/chapter-5.md): the Lance That Pierced the Heart's icon (16x16), and the White Altar
Heights' fixtures — a white robe on a pole over a pilgrim's grave, a burial niche in the chalk with a white-robed body in
it and the same niche empty, the altar with the Lance standing in it (two cells wide), a white-robed sleeper on the
catacomb floor, a sewing frame with a robe half sewn.

    python3 games/openworld/tools/src/art/chapter5.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from thingkit import Pic, lit, preview, write

ROBE = ('F4F1EA', 'DAD5CA', 'B2AC9F')
CHALK = ('E8E2D4', 'CFC8B8', 'ADA594')
HOLLOW = ('8C8476', '6A6356', '4A443A')
GOLD = ('E6C46C', 'C49A48', '8A6A30')
DARKWOOD = ('7A5A3C', '5A4028', '3A2818')
LANCE = ('5E5C66', '2C2A32', '18161C')


# ---- icon -------------------------------------------------------------------------------------------------------------

def holy_lance() -> Pic:
    # a plain old spear lying corner to corner: its ash shaft dark with handling, an iron socket, the blade black to the socket
    p = Pic(16, 16)
    for t in range(0, 10):  # the shaft, from the bottom-left corner
        x, y = 1 + t, 14 - t
        p.put(x, y, DARKWOOD[0] if t % 3 else DARKWOOD[1])
        p.put(x + 1, y, DARKWOOD[2])
    p.put(11, 4, '8E8A84')  # the socket's band
    p.put(12, 4, '5E5A54')
    p.put(11, 5, '5E5A54')
    for k in range(5):  # the leaf-shaped blade, black, an edge of grey on its lit side
        x, y = 12 + k * 0.7, 3 - k * 0.7
        p.put(x, y, LANCE[1])
        p.put(x + 1, y, LANCE[2])
        p.put(x, y - 1, LANCE[0] if k < 4 else LANCE[1])
    p.put(15, 0, LANCE[1])
    p.outline()
    return p


# ---- fixtures ---------------------------------------------------------------------------------------------------------

def robe_pole() -> Pic:
    """A pilgrim's grave on the White Stair (16x32): a white robe hung by its shoulders from a pole and crossbar over a
    low chalk mound, its hem stirring."""
    p = Pic(16, 32)
    p.ellipse(8, 29, 6.5, 2.4, lambda u, v: lit(u, v, CHALK[0], CHALK[1], CHALK[2]))  # the mound
    for y in range(3, 29):  # the pole
        p.put(7, y, DARKWOOD[0])
        p.put(8, y, DARKWOOD[2])
    for x in range(3, 13):  # the crossbar
        p.put(x, 5, DARKWOOD[1] if x < 11 else DARKWOOD[2])
    # the robe: shoulders on the bar, sleeves hanging, the body widening to a hem that lifts to the right
    for y in range(6, 24):
        t = (y - 6) / 17
        half = 3.5 + t * 1.8
        sway = math.sin(y * 0.5) * 0.4 + t * t * 1.4
        for x in range(int(8 - half + sway) - 1, int(8 + half + sway) + 2):
            u = (x - (8 + sway)) / half
            if abs(u) <= 1:
                c = ROBE[0] if u < -0.3 else ROBE[1] if u < 0.55 else ROBE[2]
                if y > 9 and abs(u) < 0.12 and y < 20:
                    c = ROBE[2]  # the fall of its front
                p.put(x, y, c)
    for y in range(6, 13):  # the sleeves hanging from the bar's ends
        p.put(3 + (y - 6) * 0.1, y, ROBE[1])
        p.put(12 + (y - 6) * 0.15, y, ROBE[2])
    for x in range(3, 15):  # the hem's lift
        if (x + 1) % 3 == 0:
            p.put(x + 0.6, 24, ROBE[1])
    p.outline()
    return p


def niche(empty: bool = False) -> Pic:
    """A burial niche cut in the catacombs' chalk (16x16, a piece of the wall face): an arched hollow, in it a body in a white
    robe lying with its head to the left and a small ring of gold at the head — or empty, its name plate under it."""
    p = Pic(16, 16)
    for y in range(16):  # the wall face: chalk in courses
        for x in range(16):
            c = CHALK[0] if (y % 5) != 4 else CHALK[2]
            if (x + (y // 5) * 5) % 8 == 7 and y % 5 != 4:
                c = CHALK[1]
            p.put(x, y, c)
    # the arched hollow
    for y in range(3, 12):
        for x in range(1, 15):
            arch = y >= 5 or (x - 7.5) ** 2 / 49 + (y - 5) ** 2 / 4 <= 1
            if arch:
                p.put(x, y, '3A342C' if y < 7 else '4E473C')
    p.line(1, 12, 14, 12, CHALK[2])  # the sill
    p.line(1, 13, 14, 13, '9C9482')
    if not empty:
        # the body: a long white shape, the hood at the left, the feet at the right
        for x in range(3, 14):
            p.put(x, 10, ROBE[0])
            p.put(x, 11, ROBE[1])
            if 4 <= x <= 12:
                p.put(x, 9, ROBE[0])
        p.line(5, 8, 12, 8, '2A2020')  # its outline against the dark
        p.ellipse(3.6, 9.6, 1.6, 1.4, lambda u, v: ROBE[0] if u < 0 else ROBE[1])  # the hooded head
        for x in (6, 9, 12):
            p.put(x, 9, ROBE[1])  # the folds
        p.ring(3.6, 8.2, 1.6, 0.8, GOLD[0])  # the little halo
        p.put(3, 7, GOLD[1])
    else:
        p.rect(5, 14, 10, 15, '8A7A5A')  # the name plate
        p.line(6, 14, 9, 14, 'B0A078')
    return p


def lance_altar() -> Pic:
    """The altar Beneath the Altar (32x56 over two cells, drawn from its west cell): a block of white stone carved on its
    face, the black Lance standing upright in it, a faint ring of light round it near its head."""
    p = Pic(32, 56)
    # the altar block: its top, its carved front, its foot
    p.rect(1, 38, 30, 41, CHALK[0])
    p.rect(1, 38, 30, 38, 'F6F2E8')
    p.rect(2, 42, 29, 52, CHALK[1])
    p.rect(2, 42, 4, 52, CHALK[0])
    p.rect(27, 42, 29, 52, CHALK[2])
    p.rect(0, 53, 31, 55, CHALK[2])
    p.rect(0, 53, 31, 53, CHALK[1])
    for x in (8, 15, 22):  # the carving: three arches with a figure in each
        for y in range(44, 51):
            if y > 45 or abs(x + 2.5 - (x + 2.5)) < 1:
                pass
        p.rect(x, 45, x + 4, 50, CHALK[2])
        p.rect(x + 1, 44, x + 3, 44, CHALK[2])
        p.rect(x + 2, 46, x + 2, 49, ROBE[1])  # a robed figure carved in it
        p.put(x + 2, 45, GOLD[1])
    # the cloth over the altar's top, a red stripe down its middle
    p.rect(10, 38, 21, 46, ROBE[0])
    p.rect(14, 38, 17, 46, 'A8322E')
    p.rect(10, 46, 21, 46, ROBE[2])
    # the lance, standing in the altar, black to its socket
    for y in range(6, 39):
        p.put(15, y, LANCE[0] if y > 14 else LANCE[1])
        p.put(16, y, LANCE[2])
    p.rect(14, 14, 17, 15, '8E8A84')  # the socket's band
    for k in range(9):  # the leaf blade, widest a third of the way up, an edge of grey on its lit side
        wide = 3 <= k <= 5
        p.put(15, 13 - k, LANCE[0] if wide else LANCE[1])
        p.put(16, 13 - k, LANCE[2])
        if wide:
            p.put(14, 13 - k, LANCE[0])
            p.put(17, 13 - k, LANCE[2])
    p.put(15, 4, LANCE[1])
    p.outline()
    # the ring of light round it near its head (after the ink: light is never outlined), its glow on the blade
    p.ring(15.5, 9, 7, 2.4, 'FFF4C8', 220)
    p.ring(15.5, 9, 6.2, 1.9, 'F0D070', 120)
    p.put(14, 8, 'B8B4C0')
    return p


def shadow(p: Pic, cx: float, cy: float, rx: float, ry: float) -> None:
    """A soft shadow on the floor under a figure, laid only where nothing is drawn (after the ink)."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u, v = (x - cx) / rx, (y - cy) / ry
            if u * u + v * v <= 1 and not p.get(x, y):
                p.put(x, y, '3A342E', 110)


def robed_sleeper() -> Pic:
    """One of the white-robed lying under the altar (16x16, filling most of the cell): on its back, head to the left, seen
    from above and in front — broad in the shoulders, narrowing to the feet; a white cloth over the face; a thin ring of
    gold laid flat behind the head; the robe's folds shaded down its front; a dark outline and a shadow so it stands off a
    white floor."""
    p = Pic(16, 16)
    # the body: its top (lit) and its front (shaded), broad at the shoulders, narrow at the feet
    for x in range(5, 15):
        t = (x - 5) / 9
        half = 3.8 - t * 1.6  # the body's half-width across, from above
        cy = 8.4
        top, bot = cy - half, cy + half
        for y in range(int(round(top)), int(round(bot)) + 2):
            if y <= cy - 0.5:
                c = ROBE[0]
            elif y <= bot - 0.2:
                c = ROBE[1]
            else:
                c = ROBE[2]  # the front edge, falling to the floor
            p.put(x, y, c)
    for x in (8, 11):  # the folds across the body
        p.line(x, 6.2 + (x - 5) * 0.12, x + 1, 11 - (x - 5) * 0.1, ROBE[2])
    p.rect(7, 8, 8, 9, 'D2CCC0')  # the hands folded on the breast
    p.put(14, 7, ROBE[0])  # the feet, together
    p.put(14, 10, ROBE[2])
    # the head: the hood, the cloth over the face
    p.ellipse(3.0, 8.4, 2.6, 2.9, lambda u, v: lit(u, v, ROBE[0], ROBE[1], ROBE[2]))
    p.ellipse(2.8, 8.1, 1.5, 1.7, lambda u, v: 'FFFFFF' if u + v < 0 else 'E4E0D6')  # the face cloth
    for y in range(6, 12):  # the neck's shadow between the head and the shoulders
        p.put(5, y, ROBE[2] if 7 <= y <= 10 else '8E887C')
    p.outline('1E1814')
    shadow(p, 8.5, 13.6, 7.6, 1.6)
    # the thin ring of gold round the head's crown (after the ink: light is never outlined)
    for k in range(48):
        t = 2 * math.pi * k / 48
        x, y = 3.0 + 3.6 * math.cos(t), 8.2 + 3.8 * math.sin(t)
        if y < 7.6 and x < 6.6:
            p.put(x, y, 'D8B060')
    return p


def robed_kneeling() -> Pic:
    """One of the white-robed kneeling round the altar (16x24, its foot on the cell's): broad hooded shoulders, the head bowed
    low between them, the sleeves meeting at the hands, the robe spread on the floor round the knees; a faint ring of gold
    behind the head; a dark outline so it stands off a white floor."""
    p = Pic(16, 24)
    # the robe pooled on the floor round the knees
    for y in range(17, 23):
        half = 4.4 + (y - 17) * 0.45
        for x in range(int(8 - half), int(8 + half) + 2):
            u = (x - 8) / half
            if abs(u) <= 1.0:
                p.put(x, y, ROBE[1] if y < 21 and abs(u) < 0.6 else ROBE[2] if u > -0.4 else ROBE[1])
    # the body, bent forward: shoulders broad at the top, narrowing to the waist
    for y in range(8, 18):
        half = 5.0 - (y - 8) * 0.16
        for x in range(int(8 - half), int(8 + half) + 2):
            u = (x - 8) / half
            if abs(u) <= 1.0:
                p.put(x, y, ROBE[0] if u < -0.3 else ROBE[1] if u < 0.5 else ROBE[2])
    # the sleeves: from the shoulders' edges down and in to the hands, their inner line shaded
    p.line(4, 10, 7, 15, ROBE[2])
    p.line(12, 10, 9, 15, ROBE[2])
    p.rect(7, 14, 9, 15, 'D2CCC0')  # the hands together
    for (x, y0) in ((5, 16), (11, 16)):  # the folds below the arms
        p.line(x, y0, x - (1 if x < 8 else -1), 21, ROBE[2])
    # the head, hooded and bowed low between the shoulders: the hood's crown, a dark sliver of its opening below
    p.ellipse(8, 8.4, 2.7, 2.5, lambda u, v: lit(u, v, ROBE[0], ROBE[1], ROBE[2]))
    p.line(7, 10, 9, 10, '6A6356')
    p.outline('1E1814')
    shadow(p, 8, 23.0, 7.0, 1.2)
    # the faint ring of gold behind the head (after the ink: light is never outlined), above the shoulders
    for k in range(48):
        t = 2 * math.pi * k / 48
        x, y = 8 + 4.2 * math.cos(t), 7.0 + 3.6 * math.sin(t)
        xi, yi = int(round(x)), int(round(y))
        if y < 8.2 and (not p.get(xi, yi) or tuple(p.a[yi, xi, :3]) == (30, 24, 20)):
            p.put(x, y, 'E0C068', 210)
    return p


def sewing_frame() -> Pic:
    """Sister Agathe's frame (16x24): a robe of white linen stretched on a wooden frame, sewn to the waist, the rest
    pinned and loose; a needle hangs on its thread."""
    p = Pic(16, 24)
    for y in range(2, 23):  # the uprights
        p.put(2, y, DARKWOOD[0])
        p.put(13, y, DARKWOOD[1])
    for x in range(1, 15):  # the top and bottom bars
        p.put(x, 2, DARKWOOD[0] if x < 13 else DARKWOOD[1])
        p.put(x, 19, DARKWOOD[1])
    p.rect(1, 22, 4, 23, DARKWOOD[2])  # the feet
    p.rect(11, 22, 14, 23, DARKWOOD[2])
    # the robe: sewn above (whole cloth), below only pinned pieces with gaps between
    for y in range(3, 11):
        for x in range(4, 12):
            p.put(x, y, ROBE[0] if x < 7 else ROBE[1] if x < 10 else ROBE[2])
    for x in range(4, 12):  # the stitched seam at the waist
        p.put(x, 11, 'A49E90' if x % 2 else ROBE[2])
    for (x0, x1) in ((4, 6), (8, 11)):  # two loose panels below, not joined
        for y in range(12, 18):
            for x in range(x0, x1 + 1):
                p.put(x, y, ROBE[1] if x < x1 else ROBE[2])
    for (x, y) in ((4, 12), (6, 12), (8, 12), (11, 12)):  # the pins
        p.put(x, y, 'C4C8CE')
    p.line(11, 14, 12, 20, 'D8D2C2')  # the thread, the needle on it
    p.put(12, 21, 'C4C8CE')
    p.outline()
    return p


ICONS = {'HolyLance': holy_lance}
FIXTURE_ART = {
    'RobePole': robe_pole, 'Niche': niche, 'NicheEmpty': lambda: niche(True), 'LanceAltar': lance_altar,
    'RobedSleeper': robed_sleeper, 'RobedKneeling': robed_kneeling, 'SewingFrame': sewing_frame,
}

def crowd(pics: dict, path: Path) -> None:
    """Some thirty of the white-robed, lying and kneeling, scattered on a white marble floor before dark rock, enlarged."""
    import random
    from PIL import Image
    rnd = random.Random(5)
    W, H = 12 * 16, 8 * 16
    floor = Image.new('RGBA', (W, H), (238, 234, 226, 255))
    px = floor.load()
    for y in range(H):  # the marble's joints and a little veining
        for x in range(W):
            if x % 16 == 0 or y % 16 == 0:
                px[x, y] = (214, 208, 196, 255)
    for x in range(W):  # dark rock along the top
        for y in range(10):
            px[x, y] = (46, 42, 40, 255) if y < 8 else (70, 64, 58, 255)
    sleeper = Image.fromarray(pics['RobedSleeper'].a)
    kneel = Image.fromarray(pics['RobedKneeling'].a)
    spots = []
    for _ in range(400):
        cx, cy = rnd.randrange(0, 12), rnd.randrange(1, 8)
        if (cx, cy) not in spots:
            spots.append((cx, cy))
        if len(spots) == 30:
            break
    for cx, cy in sorted(spots, key=lambda c: c[1]):
        if rnd.random() < 0.5:
            floor.alpha_composite(sleeper, (cx * 16, cy * 16))
        else:
            floor.alpha_composite(kneel, (cx * 16, cy * 16 - 8))
    floor.save(path.with_name(path.stem + '_1x.png'))
    floor.resize((W * 4, H * 4), Image.NEAREST).save(path)


if __name__ == '__main__':
    pics = write(ICONS, FIXTURE_ART)
    if len(sys.argv) > 1:
        preview(pics, Path(sys.argv[1]) / 'chapter5_things.png', ground=(176, 170, 156, 255))
        crowd(pics, Path(sys.argv[1]) / 'witnesses_crowd.png')
