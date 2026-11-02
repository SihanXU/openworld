"""Astra, the First Martyr, the final boss (docs/finale.md §4): his boss strips drawn over Alberic's delivered ones
(stripkit.py), and his six skill effects; and the dark he leaves on the floor (fixture:night_pool).

No portrait was delivered; docs/finale.md describes him: a gaunt man in a grey shroud, bound by the five instruments as
they come back to him — the crown of thorns on long white hair, the scourge's welts open, the black scale at his neck, the
nails through his hands and feet, the lance through his chest — and the dark leaking out of the wounds like smoke that
falls. The cream is the shroud's grey, the cape its torn dark, the crown thorns, the helm his face between the white
hair; the sword, where it hangs before him, is the dark pouring down out of his hands to the floor, and swung, a blade of
it.

    python3 games/openworld/tools/src/art/astra.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from stripkit import (BLADE, CAPE, CREAM, FIXTURES, FX, GOLD, INK, OUTLINE, SKIRT, Frame, blank, build, dot, erase_blade, fx_disc,
                      fx_ink, fx_line, hx, ring, shades, write_effects, write_strips)

SHROUD = shades(['CDD0CB', 'BEC2BC', 'ADB1AB', '959993', '898D87', '84887F', '6E726C', '5C605A'])
TORN = {'953737': '4A4A52', '712B2C': '303036'}
BRASS = shades(['A89C84', '9C907A', '8C826C', '7C725E', '6E6654', '625A4C', '4C463A', '4C463A'], GOLD)
SKIN = shades(['DAD6CE', 'CECAC2', 'C0BCB3', 'A8A49B', '9C988F', '96928A', '807C74', '6C6860'])
HAIR, HAIR_MID, HAIR_DARK = 'E6E4DE', 'C4C1BA', '948F88'
THORN, THORN_DARK, THORN_TIP = '4E3A2A', '2E2218', '6E5A40'
WELT, WELT_DARK = '9A2E2C', '5E1A1C'
IRON, IRON_DARK, IRON_LIT = '3C3E46', '24262C', '6A6E78'
NIGHT = ['3E2C52', '2C1F3C', '1C1428', '120C1A']
NIGHT_EDGE = '6A4E8C'
ARCS = {'FFFFFF': 'C8B4E8', 'FFE9B0': '6A4E8C', 'F3B876': '2C1F3C'}


def crown(fr: Frame) -> None:
    """The crown's gold is thorns: a twisted band, points bristling up and out."""
    pts = []
    for y in range(max(0, fr.top - 1), fr.top + 5):
        for x in range(fr.cx - 9, fr.cx + 10):
            if fr.k(x, y) in GOLD:
                fr.put(x, y, THORN if (x + y) % 3 else THORN_DARK)
                pts.append((x, y))
    if not pts:
        return
    by = max(y for _, y in pts)
    xs = [x for x, _ in pts]
    for k, x in enumerate(range(min(xs) - 1, max(xs) + 2, 2)):
        h = 2 + (k % 3 == 1)
        lean = -1 if x < fr.cx else 1
        for t in range(h):
            fr.put(x + (lean if t == h - 1 else 0), by - 3 - t, THORN_TIP if t == h - 1 else THORN, behind=True)


def face(fr: Frame) -> None:
    helm = fr.helm()
    if not helm:
        return
    xs = [x for x, _ in helm]
    l, r = min(xs), max(xs)
    for (x, y) in helm:
        k = fr.k(x, y)
        if fr.side == 'back':
            fr.put(x, y, HAIR if x < fr.cx else HAIR_MID)
        elif k in SKIN:
            fr.put(x, y, SKIN['9D8C84'] if x in (l + 1, r - 1) or y >= fr.top + 12 else SKIN[k])
    # the hair, long, down over the shoulders to the chest
    falls = {'front': (l, r), 'back': (l, r), 'right': (l, None), 'left': (None, r)}[fr.side]
    for edge in falls:
        if edge is None:
            continue
        out = -1 if edge == l else 1
        for t, (x0, end) in enumerate(((edge, fr.top + 26), (edge + out, fr.top + 22 + (fr.i % 2)), (edge - out, fr.top + 19))):
            if t == 2 and fr.side not in ('front',):
                continue
            for y in range(fr.top + 4, end):
                fr.put(x0, y, HAIR if t == 0 and y < end - 4 else HAIR_MID if t != 1 else HAIR_DARK)
            fr.put(x0, end, INK, behind=True)
        for y in range(fr.top + 4, fr.top + 24):
            fr.put(edge + out * 2, y, INK, behind=True)
    if fr.side == 'back':  # the hair down the back
        for x in range(l + 1, r):
            for y in range(fr.top + 15, fr.top + 24 + (x % 3)):
                if fr.filled(x, y):
                    fr.put(x, y, HAIR_MID if x % 2 else HAIR)


def welts(fr: Frame) -> None:
    """The scourge's welts open across the shroud: more across the back."""
    cx, t = fr.cx, fr.top
    strokes = [(-9, 20, 5, 27), (-6, 30, 8, 37), (-10, 40, 4, 47), (-4, 52, 9, 58)]
    if fr.side == 'back':
        strokes += [(-8, 24, 9, 31), (-9, 34, 7, 42), (-7, 45, 9, 50)]
    if fr.side in ('left', 'right'):
        strokes = [(-4, 22, 4, 28), (-5, 34, 4, 40), (-4, 46, 4, 52)]
    for (x0, y0, x1, y1) in strokes:
        n = max(abs(x1 - x0), abs(y1 - y0))
        for s in range(n + 1):
            x, y = round(cx + x0 + (x1 - x0) * s / n), round(t + (y0 - 20) + (y1 - y0) * s / n + 20 - 20 + 0)
            y = round(fr.top + y0 - 20 + (y1 - y0) * s / n + 20 - 0) - 0
            if fr.body(x, y) and fr.k(x, y) in CREAM:
                fr.put(x, y, WELT)
                if fr.body(x, y + 1) and fr.k(x, y + 1) in CREAM:
                    fr.put(x, y + 1, WELT_DARK)


def scale(fr: Frame) -> None:
    """The black scale on its cord at the neck (from before)."""
    if fr.side != 'front':
        return
    x, y = fr.cx, fr.top + 18
    for dx in range(-3, 4):
        fr.put(x + dx, y, IRON_DARK)
    fr.put(x, y - 1, IRON_DARK)
    for px in (x - 3, x + 3):
        fr.put(px, y + 1, IRON_DARK)
        fr.put(px - 1, y + 2, IRON)
        fr.put(px, y + 2, IRON)
        fr.put(px + 1, y + 2, IRON)


def lance(fr: Frame) -> None:
    """The lance through his chest: its shaft out before him, falling away, its blade out of his back."""
    cx, t = fr.cx, fr.top
    if fr.side == 'front':
        entry, butt, tip = (cx + 1, t + 24), (cx - 15, t + 40), (cx + 15, t + 9)
    elif fr.side == 'back':
        entry, butt, tip = (cx - 1, t + 24), (cx + 15, t + 40), (cx - 15, t + 9)
    else:
        f = 1 if fr.side == 'right' else -1
        entry, butt, tip = (cx + f * 4, t + 25), (cx + f * 19, t + 37), (cx - f * 16, t + 13)
    shaft_front = fr.side != 'back'
    a_end = butt if shaft_front else tip
    b_end = tip if shaft_front else butt
    fr.line(entry[0], entry[1] - 1, a_end[0], a_end[1] - 1, IRON_LIT)
    fr.line(entry[0], entry[1], a_end[0], a_end[1], IRON)
    fr.line(entry[0], entry[1] + 1, a_end[0], a_end[1] + 1, INK)
    fr.line(entry[0], entry[1], b_end[0], b_end[1], IRON, behind=True)
    fr.line(entry[0], entry[1] + 1, b_end[0], b_end[1] + 1, IRON_DARK, behind=True)
    fr.line(entry[0], entry[1] - 1, b_end[0], b_end[1] - 1, INK, behind=True)
    fr.line(entry[0], entry[1] + 2, b_end[0], b_end[1] + 2, INK, behind=True)
    # the blade at the tip: a long black leaf
    ux, uy = tip[0] - entry[0], tip[1] - entry[1]
    ln = math.hypot(ux, uy)
    ux, uy = ux / ln, uy / ln
    for s in range(7):
        w = [1, 2, 2, 2, 1, 1, 0][s]
        for d in range(-w, w + 1):
            fr.put(tip[0] + ux * s - uy * d, tip[1] + uy * s + ux * d, IRON_LIT if d < 0 else IRON_DARK, behind=fr.side != 'back')
    # the wound: dark round where it goes in
    for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)):
        if fr.body(entry[0] + dx, entry[1] + dy):
            fr.put(entry[0] + dx, entry[1] + dy, NIGHT[2])


def nails(fr: Frame) -> list[tuple[int, int]]:
    """The nails' heads in his hands and feet; where the dark leaks from."""
    out = []
    axis = fr.blade()
    if axis and fr.side != 'back':
        hx_, hy = axis[0]
        for dx in (-2, 2):
            out.append((round(hx_ + dx), round(hy)))
    for dx in (-4, 4) if fr.side in ('front', 'back') else (0,):
        out.append((fr.cx + dx + (1 if fr.side == 'right' else -1 if fr.side == 'left' else 0), 68))
    for (x, y) in out:
        fr.put(x, y, IRON_LIT)
        fr.put(x + 1, y, IRON_DARK)
        fr.put(x, y + 1, IRON_DARK)
    return out


def dark(fr: Frame, wounds: list[tuple[int, int]]) -> None:
    """The dark leaking from the wounds, falling like smoke, and pooling about his feet."""
    for (wx, wy) in wounds:
        for k in range(3):
            y = wy + 2 + (fr.i * 2 + k * 5) % 14
            x = wx + round(math.sin((fr.i + k) * 1.7)) + (k - 1)
            if y < 72:
                fr.put(x, y, NIGHT[k % 2])
                fr.put(x, y + 1, NIGHT[2], behind=True)
    w = 13 + (fr.i % 4 in (1, 2))
    for x in range(fr.cx - w, fr.cx + w + 1):
        for y in (71, 72):
            e = ((x - fr.cx) / w) ** 2
            if e <= 1 and not (y == 72 and e > 0.6):
                fr.put(x, y, NIGHT[1] if (x + fr.i) % 5 else NIGHT_EDGE, behind=True)


def night_blade(fr: Frame) -> None:
    """Hanging before him, the sword is the dark pouring out of his hands to the floor; swung, a blade of it."""
    axis = fr.blade()
    if not axis or fr.clip == 'walk_up':
        return
    (hx_, hy), (tx, ty) = axis
    ux, uy = tx - hx_, ty - hy
    ln = math.hypot(ux, uy) or 1
    ux, uy = ux / ln, uy / ln
    if uy > 0.85:
        # a column of falling dark from the hands to the floor, wavering
        for y in range(round(hy), 71):
            sway = round(math.sin(y / 4 + fr.i)) if y > hy + 4 else 0
            for d in (-1, 0, 1):
                c = NIGHT[0] if d == 0 else NIGHT[1]
                if (y + fr.i * 3) % 7 == 0 and d == 0:
                    c = NIGHT_EDGE
                fr.put(hx_ + d + sway, y, c)
        return
    if fr.side in ('left', 'right') and fr.clip.startswith('walk'):
        return
    ex, ey = tx + ux * 9, ty + uy * 9
    fr.line(hx_, hy, ex, ey, NIGHT[1])
    fr.line(hx_ + (1 if abs(ux) < 0.7 else 0), hy + (1 if abs(ux) >= 0.7 else 0), ex + (1 if abs(ux) < 0.7 else 0), ey + (1 if abs(ux) >= 0.7 else 0), NIGHT_EDGE)
    fr.line(hx_ - (1 if abs(ux) < 0.7 else 0), hy - (1 if abs(ux) >= 0.7 else 0), ex - (1 if abs(ux) < 0.7 else 0), ey - (1 if abs(ux) >= 0.7 else 0), NIGHT[3])


def draw(fr: Frame) -> np.ndarray:
    for y in range(fr.h):
        for x in range(fr.w):
            k = fr.keys[y][x]
            if not k:
                continue
            if fr.is_arc(x, y):
                fr.put(x, y, ARCS[k])
            elif k == BLADE:
                continue
            elif k in CREAM:
                fr.put(x, y, SHROUD[k])
            elif k in CAPE:
                drop = sum(fr.k(x + dx, y + dy) in CAPE for dx in (-1, 0, 1) for dy in (-1, 0, 1)) <= 3 and fr.near(x, y, set(CREAM))
                fr.put(x, y, WELT if drop else TORN[k])
            elif k in GOLD and y > fr.top + 4:
                fr.put(x, y, BRASS[k])
    erase_blade(fr, lambda k: SHROUD.get(k, SHROUD['C1B2A8']) if k != BLADE else SHROUD['B6A59B'])
    crown(fr)
    welts(fr)
    face(fr)
    scale(fr)
    wounds = nails(fr)
    lance(fr)
    night_blade(fr)
    dark(fr, wounds)
    return fr.a


# ---- the skill effects -----------------------------------------------------------------------------------------------

def fx_crown() -> np.ndarray:
    # a ring of black thorns breaking up out of the floor round him and falling back
    n = 6
    a = blank(n)
    for f in range(n):
        h = [2, 6, 10, 11, 8, 4][f]
        for k in range(10):
            ang = math.radians(k * 36)
            bx, by = 32 + math.cos(ang) * 20, 40 + math.sin(ang) * 9
            for t in range(h):
                lean = math.cos(ang) * t * 0.25
                dot(a, f, bx + lean, by - t, THORN if t < h - 2 else THORN_TIP)
                dot(a, f, bx + lean + 1, by - t, THORN_DARK)
            if h > 4:
                dot(a, f, bx + 2, by - h // 2, THORN_TIP)
        fx_ink(a, f)
    return a


def fx_welts() -> np.ndarray:
    # the lash's strokes laid across the cell, red, one after another
    n = 5
    a = blank(n)
    strokes = [(10, 20, 54, 40), (12, 44, 52, 22), (16, 30, 50, 50)]
    for f in range(n):
        for k, (x0, y0, x1, y1) in enumerate(strokes):
            if k > f:
                continue
            fade = f - k >= 3
            for s in range(41):
                t = s / 40
                x = x0 + (x1 - x0) * t
                y = y0 + (y1 - y0) * t + math.sin(t * math.pi) * -4
                if fade and s % 3:
                    continue
                dot(a, f, x, y, WELT if not fade else WELT_DARK)
                dot(a, f, x, y + 1, WELT_DARK)
                if f == k:
                    dot(a, f, x, y - 1, 'E8B0A8')
    return a


def fx_weight() -> np.ndarray:
    # a black pan comes down on the spot, heavy, and the floor cracks
    n = 5
    a = blank(n)
    for f in range(n):
        py = [10, 28, 44, 45, 45][f]
        if f < 4:
            fx_disc(a, f, 32, py, 15, 5, IRON_DARK)
            fx_disc(a, f, 32, py - 1, 13, 3.5, IRON)
            fx_disc(a, f, 32, py - 2, 9, 1.5, IRON_LIT)
            fx_ink(a, f)
        if f >= 2:
            for k in range(6):
                ang = math.radians(k * 60 + 10)
                for t in range(4, 6 + f * 3):
                    dot(a, f, 32 + math.cos(ang) * t * 1.4, 50 + math.sin(ang) * t * 0.4, '1A1616')
    return a


def fx_nails() -> np.ndarray:
    # three black nails driven down into the spot together
    n = 5
    a = blank(n)
    for f in range(n):
        for k, (nx, ny) in enumerate(((22, 52), (32, 56), (42, 51))):
            tip = min(ny, [10, 30, 56, 56, 56][f] - k * 3 + (ny - 52))
            for y in range(max(0, tip - 18), tip):
                w = 1 if y < tip - 3 else 0
                for d in range(-w, w + 1):
                    dot(a, f, nx + d, y, IRON_LIT if d < 0 else IRON_DARK if d > 0 else IRON)
            for d in range(-3, 4):
                dot(a, f, nx + d, max(0, tip - 19), IRON)
            if f >= 2 and tip >= ny - 1:
                for d in (-3, 3):
                    dot(a, f, nx + d, ny + 1, NIGHT[1])
        fx_ink(a, f)
    return a


def fx_lance() -> np.ndarray:
    # the lance thrust: a black shaft of dark with a violet edge driven through the cell
    n = 5
    a = blank(n)
    for f in range(n):
        reach = [20, 52, 64, 64, 64][f]
        w = [1, 2, 3, 2, 1][f]
        for x in range(0, reach):
            for d in range(-w, w + 1):
                c = NIGHT_EDGE if abs(d) == w else NIGHT[1] if abs(d) == w - 1 else NIGHT[3]
                if f >= 3 and (x + d) % 3 == 0:
                    continue
                dot(a, f, x, 32 + d, c)
        if reach < 64:
            for s in range(6):  # its head
                for d in range(-(5 - s) // 2, (5 - s) // 2 + 1):
                    dot(a, f, reach + s, 32 + d, IRON_LIT if d < 0 else IRON)
        # the dark it drags: motes shed off the shaft, drifting up and down from it as it goes
        rng = np.random.default_rng(31 + f)
        for _ in range(6 + 5 * f):
            x = rng.uniform(0, max(8, reach - 2))
            off = rng.uniform(w + 1, w + 3 + 2 * f) * (1 if rng.random() < 0.5 else -1)
            dot(a, f, x, 32 + off, NIGHT_EDGE if rng.random() < 0.4 else NIGHT[1])
    return a


def fx_night() -> np.ndarray:
    # the First Night spilling on the floor: a pool of dark spreading, tendrils feeling out from it, motes rising
    n = 6
    a = blank(n)
    rng = np.random.default_rng(13)
    for f in range(n):
        r = [6, 11, 15, 18, 19, 19][f]
        fx_disc(a, f, 32, 46, r, r * 0.42, NIGHT[2])
        fx_disc(a, f, 32, 46, r * 0.7, r * 0.3, NIGHT[3])
        for k in range(7):
            ang = math.radians(k * 51 + f * 5)
            for t in range(r, r + 3 + f):
                dot(a, f, 32 + math.cos(ang) * t, 46 + math.sin(ang) * t * 0.42 + math.sin(t) * 0.8, NIGHT[1])
        for _ in range(5 + f * 2):
            dot(a, f, rng.uniform(32 - r, 32 + r), 46 - rng.uniform(2, 6 + f * 3), NIGHT_EDGE)
        fx_disc(a, f, 32, 46, r + 0.5, r * 0.42 + 0.5, NIGHT_EDGE, hollow=0.86)
    return a


def night_pool() -> Image.Image:
    """The dark he leaves on the floor (fixture:night_pool, a 16x16 ground tile)."""
    p = np.zeros((16, 16, 4), np.uint8)

    def put(x, y, c):
        if 0 <= x < 16 and 0 <= y < 16:
            p[y, x] = (*hx(c), 255)
    for y in range(16):
        for x in range(16):
            e = ((x - 7.5) / 7.2) ** 2 + ((y - 9) / 5.2) ** 2
            wob = 0.12 * math.sin(x * 1.3 + y)
            if e <= 1 + wob:
                put(x, y, NIGHT[3] if e < 0.35 else NIGHT[2] if e < 0.75 else NIGHT[1])
            elif e <= 1.18 + wob:
                put(x, y, NIGHT_EDGE)
    for (x, y) in ((5, 7), (10, 9), (7, 11), (3, 4), (12, 5)):
        put(x, y, 'B8A0E0' if (x + y) % 2 else NIGHT_EDGE)
    return Image.fromarray(p)


def effects(preview: Path | None) -> dict:
    out = {'crown': fx_crown(), 'welts': fx_welts(), 'weight': fx_weight(), 'nails': fx_nails(), 'lance': fx_lance(), 'night': fx_night()}
    write_effects('astra', out, preview)
    night_pool().save(FIXTURES / 'NightPool.png')
    return out


if __name__ == '__main__':
    pv = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    sheets = build('astra', draw)
    write_strips('astra', sheets, fx_colors=['#C8B4E8', '#6A4E8C'], preview=pv)
    e = effects(pv)
    print('Astra →', 'public/assets/lsw/Bosses/astra')
    for k, v in sheets.items():
        print(f'  {k}.png {v.shape[1]}x{v.shape[0]}')
    for k, v in e.items():
        print(f'  effect-{k}.png {v.shape[1]}x{v.shape[0]} ({v.shape[1] // FX} frames)')
