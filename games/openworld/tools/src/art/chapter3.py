"""Chapter 3's small pictures (docs/chapter-3.md): its story items' icons (16x16) and its fixtures — the Vale's dead wheat (the ripe
wheat's layout, grey and bowed), Fairweight's great scale (three cells wide, its beam and pans drawn above its base row), the Church's black weight, the Standing on the salt
(three figures of salt and dust), a heap of grain-dust, the great pan hanging over the Scale Floor (two cells wide), the
wayside scale at the crossroads, a salt pan (a floor tile, seamless), the Black Balance's ledger on its stand.

Each is drawn from shapes in a few shades and given the pack's dark outline afterwards.

    python3 games/openworld/tools/src/art/chapter3.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
CROPS = ROOT / 'games/openworld/public/assets/lsw/Crops'
ITEMS = ROOT / 'games/openworld/public/assets/lsw/Items'
FIXTURES = ROOT / 'games/openworld/public/assets/lsw/Fixtures'

C = {
    'k': '2A2020',  # the outline
    'I': '6E727C', 'i': '4A4E58', 'j': '2E3038', 'h': '9AA0AA',  # black iron, its light
    'W': 'B07A48', 'w': '7A4E2C', 'v': '4E3020', 'V': 'C8925A',  # wood
    'G': 'D8B060', 'g': 'A07838', 'e': '6C4C26',  # old brass and gold
    'B': '5A7EA8', 'b': '3E5E84', 'n': '2C4262', 'N': '7E9CC0',  # blue wool, faded
    'S': 'EEEBE2', 's': 'D2CEC4', 't': 'AEA99E', 'u': '86817A', 'o': '625E58',  # salt and dust, light to dark
    'P': 'E8D8B8', 'p': 'C4AE88', 'q': '9C8462',  # paper
    'L': '6A3E26', 'l': '45281A',  # leather
    'D': 'B8B0A0', 'd': '8E8678', 'c': '6A6458',  # grain-dust
    'R': 'A8433A',  # a ribbon mark, the ledger's red ink
    'Z': '1C1A21',  # a hollow
    'Y': '9A9180', 'y': '6A6252', 'E': 'B0A992', 'F': 'D2CCB8', 'x': '3A3129', 'f': '6C6250',  # dead straw, empty ears
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

    def get(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3] > 0

    def line(self, x0: float, y0: float, x1: float, y1: float, k: str) -> None:
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for s in range(n + 1):
            self.put(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, k)

    def rect(self, x0: int, y0: int, x1: int, y1: int, k: str) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, k)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, shade) -> None:
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (x - cx) / rx, (y - cy) / ry
                if u * u + v * v <= 1:
                    self.put(x, y, shade(u, v))

    def outline(self, k: str = 'k') -> None:
        filled = self.a[..., 3] > 0
        out = []
        for y in range(self.h):
            for x in range(self.w):
                if not filled[y, x] and any(0 <= x + dx < self.w and 0 <= y + dy < self.h and filled[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.append((x, y))
        for x, y in out:
            self.put(x, y, k)

    def save(self, path: Path) -> None:
        Image.fromarray(self.a).save(path)


def lit(u: float, v: float, light: str, mid: str, dark: str) -> str:
    d = u * 0.6 + v * 0.8
    return light if d < -0.35 else mid if d < 0.45 else dark


# ---- icons ------------------------------------------------------------------------------------------------------------

def scale_of_hunger() -> Pic:
    # a small balance of black iron on a cord: the beam on its post, two pans on chains, the right one worn through
    p = Pic(16, 16)
    p.put(7, 0, 'p')  # the cord's loop over the top
    p.put(8, 0, 'p')
    p.put(6, 1, 'p')
    p.put(9, 1, 'p')
    for y in range(2, 13):  # the post
        p.put(7, y, 'h' if y < 4 else 'I')
        p.put(8, y, 'i')
    for x in range(1, 15):  # the beam
        p.put(x, 3, 'h' if x < 7 else 'I')
        p.put(x, 4, 'j')
    for cx in (2, 13):  # the chains, straight down
        for y in range(5, 9):
            p.put(cx, y, 'u' if y % 2 else 'o')
    for x in range(0, 5):  # the left pan, whole
        p.put(x, 9, 'I' if x < 2 else 'i')
    for x in range(1, 4):
        p.put(x, 10, 'j')
    for x in range(11, 16):  # the right pan, worn through in the middle
        p.put(x, 9, 'I' if x < 13 else 'i')
    p.put(12, 10, 'j')
    p.put(14, 10, 'j')
    for x in range(5, 11):  # the foot
        p.put(x, 13, 'I' if x < 8 else 'i')
        p.put(x, 14, 'j')
    p.outline()
    return p


def blue_scarf() -> Pic:
    # a scarf of blue wool, faded, folded twice over, a little grey with salt dust; a fringe at its end
    p = Pic(16, 16)
    for y in range(4, 12):
        for x in range(2, 14):
            band = (y - 4) // 3
            k = ['N', 'B', 'b'][band % 3]
            if x > 11 and y < 8:
                k = 'b'
            p.put(x, y + (1 if x > 9 and y > 9 else 0), k)
    for x in range(2, 14):  # the fold's edge
        p.put(x, 7, 'n')
    for y in range(5, 12, 2):  # the weave
        for x in range(3, 13, 3):
            p.put(x + (y // 2) % 2, y, 'n')
    for x in range(5, 12):  # the end hanging over, and its fringe
        p.put(x, 12, 'B')
        p.put(x, 13, 'b' if x % 2 else 'N')
        if x % 2:
            p.put(x, 14, 'N')
    for (x, y) in ((4, 5), (9, 6), (12, 9), (6, 10), (10, 11)):  # salt dust caught in the wool
        p.put(x, y, 's')
    p.outline()
    return p


def granary_key() -> Pic:
    # a big iron key: a round bow, a long shank, a heavy bit
    p = Pic(16, 16)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 4.5, y - 4.5)
            if 1.8 <= d <= 3.9:
                light = (x - 4.5) + (y - 4.5) < -1
                p.put(x, y, 'h' if light else 'I' if (x - 4.5) + (y - 4.5) < 2 else 'i')
    for t in range(9):  # the shank, along the diagonal
        x, y = 7 + t, 7 + t
        if x < 15 and y < 15:
            p.put(x, y, 'I')
            p.put(x + 1, y, 'i')
    for (x, y) in ((11, 13), (11, 14), (12, 14), (13, 12), (14, 12), (14, 11)):  # the bit's wards
        p.put(x, y, 'i')
    p.outline()
    return p


# ---- fixtures ---------------------------------------------------------------------------------------------------------

def great_scale() -> Pic:
    """Fairweight's great scale (48x56; its base row the bottom 16 pixels, three cells): a stone plinth, the post, the beam
    a little tipped, two pans as wide as a cell hung on chains, big enough to stand in. Anchored at its base row's foot."""
    p = Pic(48, 56)
    # the plinth: three steps of grey stone across the base row
    for y in range(44, 56):
        for x in range(2, 46):
            if y < 47 and not 18 <= x <= 29:
                continue
            k = 's' if y in (44, 47) else 't' if (x + y // 3) % 7 else 'u'
            if y > 52:
                k = 'u' if x % 6 else 'o'
            p.put(x, y, k)
    # the post, oak, with iron bands
    for y in range(6, 44):
        for x in range(22, 26):
            k = 'V' if x == 22 else 'W' if x < 25 else 'w'
            if y % 12 == 0:
                k = 'i'
            p.put(x, y, k)
    p.rect(20, 3, 27, 7, 'i')  # the pivot's iron
    p.rect(21, 4, 26, 5, 'I')
    # the beam: tipped (the left pan a little lower)
    for x in range(2, 46):
        y = 6 + (24 - x) * 0.08
        p.put(x, y, 'V')
        p.put(x, y + 1, 'W')
        p.put(x, y + 2, 'w')
    # the chains and the pans
    for (cx, beam_y, pan_y) in ((7, 8, 38), (40, 5, 35)):
        for y in range(beam_y + 2, pan_y):
            for dx in (-5, 5):
                p.put(cx + dx * (y - beam_y) / (pan_y - beam_y), y, 'I' if y % 2 else 'i')
        for x in range(cx - 7, cx + 8):  # the pan: a wide shallow dish of brass
            p.put(x, pan_y, 'G' if x < cx else 'g')
        for x in range(cx - 6, cx + 7):
            p.put(x, pan_y + 1, 'g')
        for x in range(cx - 5, cx + 6):
            p.put(x, pan_y + 2, 'e')
    p.outline()
    return p


def weight_of_sin() -> Pic:
    # the Church's black weight: a squat iron frustum, a ring on top, the third seal stamped in gold on its face
    p = Pic(16, 16)
    for y in range(5, 15):
        half = 3 + (y - 5) // 2
        for x in range(8 - half, 8 + half):
            k = 'I' if x < 8 - half + 2 else 'j' if x > 8 + half - 3 else 'i'
            if y == 5:
                k = 'I'
            p.put(x, y, k)
    for y in range(1, 5):  # the ring
        for x in range(5, 11):
            d = math.hypot(x - 7.5, (y - 3.2) * 1.3)
            if 1.3 <= d <= 2.6:
                p.put(x, y, 'h' if x < 8 else 'I')
    for (x, y) in ((7, 9), (8, 9), (6, 10), (9, 10), (7, 11), (8, 11), (7, 10)):  # the seal: a balance in a ring
        p.put(x, y, 'G' if (x, y) != (7, 10) else 'g')
    p.outline()
    return p


def standing(kind: str) -> Pic:
    """One of the Standing on the salt (16x26): a person gone to salt and dust, standing still, crumbling at the feet."""
    p = Pic(16, 26)
    tall = {'a': 23, 'b': 21, 'c': 15}[kind]
    top = 25 - tall
    thin = kind == 'b'
    facing_away = kind != 'b'
    cx = 8
    # the head
    hr = 2.4 if kind != 'c' else 2.2
    hy = top + 3
    p.ellipse(cx + (1 if thin else 0), hy, hr, hr + 0.4, lambda u, v: lit(u, v, 'S', 's', 't'))
    # the body: shoulders to the hem, the arms hanging
    sh = 3 if not thin else 2
    hem = 24
    for y in range(hy + 3, hem):
        t = (y - hy - 3) / max(1, hem - hy - 3)
        half = sh + (1 if t > 0.5 and kind == 'b' else 0) - (1 if t > 0.75 and kind != 'b' else 0)
        bend = 1 if thin and y < hy + 7 else 0
        for x in range(cx - half + bend, cx + half + 1 + bend):
            u = (x - cx) / (half + 0.5)
            p.put(x, y, lit(u, t * 2 - 1, 'S', 's', 't'))
    for side in (-1, 1):  # the arms
        for y in range(hy + 4, hy + 4 + (tall // 2)):
            p.put(cx + side * (sh + 1) + (1 if thin else 0) * (side > 0), y, 's' if side < 0 else 't')
    # the cracks and the crumbling feet
    for (x, y) in ((cx - 1, hy + 6), (cx, hy + 7), (cx + 1, hy + 9), (cx - 2, hy + 11)):
        if p.get(int(x), int(y)):
            p.put(x, y, 'u')
    for x in range(cx - 4, cx + 5):
        p.put(x, 25, 'd' if x % 2 else 't')
        if abs(x - cx) < 3:
            p.put(x, 24, 't')
    if not facing_away:  # hollow eyes
        p.put(cx, hy, 'o')
        p.put(cx + 2, hy, 'o')
    else:
        for y in range(hy - 1, hy + 2):  # the back of the head: no face, a little darker
            p.put(cx - 1 + (1 if thin else 0), y, 's')
    p.outline('o')
    return p


def dust_heap() -> Pic:
    # a low heap of grey grain-dust, drifted
    p = Pic(16, 16)
    for y in range(8, 16):
        for x in range(16):
            u = (x - 7.5) / 7.5
            h = 15 - (6 * (1 - u * u)) - 0.6 * math.sin(x * 1.7)
            if y >= h:
                p.put(x, y, 'D' if y < h + 1.5 and x < 9 else 'd' if (x + y) % 5 else 'c')
    for (x, y) in ((4, 13), (9, 11), (12, 14), (6, 15)):
        p.put(x, y, 'D')
    p.outline()
    return p


def hanging_pan() -> Pic:
    """The great pan over the Scale Floor (32x48: its base row the bottom 16 pixels, two cells): a bronze-black pan hung
    high on four chains that run up out of sight, its shadow on the floor below. Anchored at its base row's foot."""
    p = Pic(32, 48)
    for y in range(40, 46):  # its shadow on the floor
        for x in range(4, 28):
            if ((x - 15.5) / 12) ** 2 + ((y - 43) / 2.6) ** 2 <= 1:
                p.put(x, y, 'o')
    sh = p.a.copy()
    p.a[:] = 0
    for cx in (5, 12, 19, 26):  # the chains, from out of sight above
        for y in range(0, 22):
            x = cx + (15.5 - cx) * y / 60
            p.put(x, y, 'I' if y % 2 else 'i')
    for y in range(20, 30):  # the pan: a deep wide bowl of dark bronze, lit from the top left
        t = (y - 20) / 10
        half = 14 - t * t * 8
        for x in range(int(16 - half), int(16 + half) + 1):
            u = (x - 16) / half
            k = 'g' if y == 20 else lit(u, t * 2 - 1, 'g', 'e', 'v')
            p.put(x, y, k)
    for x in range(3, 29):  # the rim
        p.put(x, 20, 'G' if x < 16 else 'g')
    p.outline()
    m = p.a[..., 3] == 0
    p.a[m] = sh[m]
    return p


def wayside_scale() -> Pic:
    # the wayside scale at the crossroads (16x32): a post like a gibbet, a beam, two small pans hanging empty
    p = Pic(16, 32)
    for y in range(4, 31):
        p.put(7, y, 'W')
        p.put(8, y, 'w')
    for x in range(1, 15):
        p.put(x, 4, 'V')
        p.put(x, 5, 'w')
    p.line(8, 9, 12, 5, 'w')  # the brace
    for cx in (2, 13):
        for y in range(6, 12):
            p.put(cx, y, 'u' if y % 2 else 'o')
        for x in range(cx - 2, cx + 3):
            p.put(x, 12, 'g' if x < cx else 'e')
        p.put(cx, 13, 'e')
    for x in range(4, 12):  # stones round its foot
        p.put(x, 31, 't' if x % 3 else 'u')
    p.outline()
    return p


def salt_pan() -> Pic:
    # a salt pan (a floor tile): a white crust cracked into plates, the low rim on its top and left edges, so that a field of
    # them is a grid of shallow pans
    p = Pic(16, 16)
    for y in range(16):
        for x in range(16):
            k = 'S' if (x * 3 + y * 5) % 11 else 's'
            p.put(x, y, k)
    for (x0, y0, x1, y1) in ((2, 6, 9, 4), (9, 4, 14, 8), (5, 13, 9, 9), (9, 9, 15, 12), (2, 10, 5, 13)):  # cracks
        p.line(x0, y0, x1, y1, 't')
    for t in range(16):
        p.put(t, 0, 'u')
        p.put(0, t, 'u')
        p.put(t, 1, 't')
        p.put(1, t, 't')
    return p


def ledger() -> Pic:
    # Ele's ledger open on its stand (16x20): two pages of columns, a red line under each total
    p = Pic(16, 20)
    for y in range(12, 20):  # the stand
        p.put(7, y, 'W')
        p.put(8, y, 'w')
    for x in range(4, 12):
        p.put(x, 19, 'w')
    for y in range(4, 12):  # the book, tilted toward us
        for x in range(1, 15):
            k = 'P' if x < 8 else 'p'
            if x in (7, 8):
                k = 'q'
            p.put(x, y, k)
    for y in range(5, 11):  # the columns of figures
        for x in (2, 4, 9, 11, 13):
            if (x + y) % 3:
                p.put(x, y, 'u')
    p.line(2, 9, 6, 9, 'R')
    p.line(9, 9, 13, 9, 'R')
    for x in range(0, 16):  # the binding below
        p.put(x, 12, 'L' if x % 15 else 'l')
    p.outline()
    return p


def dead_wheat() -> Pic:
    """The Vale's dead wheat (16x24, laid out as the ripe wheat is, lsw/Crops/wheat/ripe.png, its foot on the cell's): grey
    straw leaning every way, each stalk bowed over at the top and its ear hanging empty; two snapped off short, an ear on the
    ground, dead leaves at the foot. Tiled in rows on dirt it is a field that died standing."""
    p = Pic(16, 24)
    straw, straw_dark, ear, ear_light, ink = 'Y', 'y', 'E', 'F', 'x'
    # (foot x, top x, top y, which way its ear hangs or None if snapped)
    stalks = [(1, 0, 8, 1), (4, 5, 6, -1), (6, 8, 9, 1), (9, 9, 15, None), (11, 12, 7, -1), (14, 15, 10, -1), (3, 2, 16, None)]
    for (fx_, tx, ty, hang) in stalks:
        for y in range(ty, 24):
            x = fx_ + (tx - fx_) * (23 - y) / max(1, 23 - ty)
            p.put(x, y, straw if (y + fx_) % 4 else straw_dark)
        if hang is None:  # snapped: a splintered top, pale where it broke
            p.put(tx, ty, ear_light)
            p.put(tx + 1, ty + 1, straw_dark)
            continue
        # bowed over at the top: the empty ear hangs down from the bend, a husk at a time
        p.put(tx + hang, ty - 1, straw)
        for n in range(5):
            ex, ey = tx + hang * (2 if n > 1 else 1), ty + n
            p.put(ex, ey, ear_light if n % 2 == 0 else ear)
            if n % 2 == 1:
                p.put(ex + hang, ey, ink)  # the empty husks' dark between them
        p.put(tx + hang * 2, ty + 5, ink)
    for (x, y) in ((0, 23), (2, 22), (5, 23), (7, 22), (10, 23), (12, 22), (13, 23), (15, 22)):  # dead leaves at the foot
        p.put(x, y, 'f')
    for x in (6, 7, 8):  # an ear lying where it fell
        p.put(x, 21, ear if x % 2 else ear_light)
    p.put(9, 21, ink)
    return p


def rgb_hex(hx_: str) -> tuple[int, int, int, int]:
    return (int(hx_[0:2], 16), int(hx_[2:4], 16), int(hx_[4:6], 16), 255)


ICONS = {'ScaleOfHunger': scale_of_hunger, 'BlueScarf': blue_scarf, 'GranaryKey': granary_key}
FIXTURE_ART = {
    'GreatScale': great_scale, 'WeightOfSin': weight_of_sin, 'StandingA': lambda: standing('a'), 'StandingB': lambda: standing('b'),
    'StandingC': lambda: standing('c'), 'DustHeap': dust_heap, 'HangingPan': hanging_pan, 'WaysideScale': wayside_scale,
    'SaltPan': salt_pan, 'Ledger': ledger, 'DeadWheat': dead_wheat,
}

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
        H = max(pic.h for pic in pics.values())
        W = sum(pic.w + 4 for pic in pics.values()) + 52
        canvas = Image.new('RGBA', (W, H), (150, 142, 120, 255))
        x = 0
        for name, pic in pics.items():
            canvas.alpha_composite(Image.fromarray(pic.a), (x, H - pic.h))
            x += pic.w + 4
        dirt = Image.new('RGBA', (64, 48), (120, 86, 58, 255))
        dw = Image.fromarray(pics['DeadWheat'].a)
        for k in range(4):
            for j in range(2):
                dirt.alpha_composite(dw, (k * 16, j * 24))
        dirt.resize((64 * 6, 48 * 6), Image.NEAREST).save(pv / 'dead_wheat_field.png')
        tile = Image.fromarray(pics['SaltPan'].a)
        for k in range(3):
            for j in range(3):
                canvas.alpha_composite(tile, (x + k * 16, H - 48 + j * 16))
        canvas.resize((canvas.width * 5, canvas.height * 5), Image.NEAREST).save(pv / 'chapter3_things.png')
