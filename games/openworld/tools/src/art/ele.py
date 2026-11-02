"""Ele, the Priest of the Black Scales, the Third Seal-bearer (docs/chapter-3.md §4): their boss strips drawn over Alberic's
delivered ones (stripkit.py), and their five skill effects.

From the collaborator's portrait (wiki/images/seal3-priest-of-the-black-scales-ele.webp): the cream armour and skirt black
vestments, wheat worked in gold down the skirt, the cape a dark umber; the crown a black mitre edged in gold, a thin gold
halo behind it; the helm a gaunt, sallow face (the visor's dark the eye sockets and the nose's shadow) between falls of
white hair; the sword the staff of the balance, gold, a short beam at its head and two pans hanging from it, one heaped
with grain, the other dripping black cloth. Planted (the sword point down), the staff's head is up; swung, it leads.

    python3 games/openworld/tools/src/art/ele.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

from stripkit import (BLADE, CAPE, CREAM, FX, GOLD, INK, OUTLINE, SKIRT, Frame, blank, build, dot, fx_disc, fx_ink, fx_line,
                      ring, shades, write_effects, write_strips)

VEST = shades(['5C5666', '4C4756', '3E3A47', '332F3B', '2E2A35', '2B2732', '24212A', '1C1A21'])
UMBER = {'953737': '3E2F1C', '712B2C': '281E12'}
AGOLD = shades(['F0D27A', 'E2C064', 'CCA552', 'B88E42', 'A57C38', '8C6C3A', '6C4C26', '6C4C26'], GOLD)
SKIN = shades(['C8C0AE', 'BAB19E', 'ABA18D', '938874', '857A67', '7F7461', '685D4E', '554B3F'])
HAIR, HAIR_MID, HAIR_DARK = 'DEDBD3', 'B3AFA6', '7E7A72'
G_LIGHT, G_MID, G_DARK = 'F0D27A', 'C49A48', '7A5A2C'
MITRE, MITRE_LIT = '2A2631', '4A4556'
CLOTH, CLOTH_DARK = '1E1B22', '101014'
GRAIN = 'E8C870'
ARCS = {'FFFFFF': 'FFF4D0', 'FFE9B0': 'E8C46A', 'F3B876': '8A6A3A'}


def mitre(fr: Frame) -> None:
    """The mitre where the crown was: black, edged and banded in gold, cleft at its top."""
    cx, base = fr.cx, fr.top + 4
    half = 3 if fr.side in ('left', 'right') else 5
    height = 13
    pts = []
    for dy in range(height):
        y = base - dy
        w = half if dy < 7 else max(1, round(half * (height - dy) / (height - 6)))
        for x in range(cx - w, cx + w + 1):
            if dy >= height - 2 and fr.side not in ('left', 'right') and x == cx:
                continue  # the cleft between its two peaks
            pts.append((x, y))
    s = set(pts)
    for (x, y) in pts:
        edge = (x - 1, y) not in s or (x + 1, y) not in s or (x, y - 1) not in s
        c = G_MID if edge else (MITRE_LIT if x < cx - 1 else MITRE)
        if y in (base, base - 1):
            c = G_LIGHT if x < cx else G_MID
        if x == cx and fr.side in ('front', 'back') and y < base - 1:
            c = G_LIGHT
        fr.put(x, y, c)
    fr.ink_round(pts)
    if fr.side == 'back':  # the lappets, down the back of the head
        for lx in (cx - 3, cx + 3):
            for y in range(base + 1, base + 13):
                fr.put(lx, y, MITRE if y % 4 else G_MID)
                fr.put(lx + (1 if lx > cx else -1), y, INK, behind=True)


def face(fr: Frame) -> None:
    """The helm a gaunt face between falls of white hair (all hair from behind)."""
    helm = fr.helm()
    if not helm:
        return
    xs = [x for x, _ in helm]
    l, r = min(xs), max(xs)
    for (x, y) in helm:
        k = fr.k(x, y)
        if fr.side == 'back':
            fr.put(x, y, HAIR if x < fr.cx - 1 else HAIR_MID if x < fr.cx + 2 else HAIR_DARK)
        elif k in SKIN:
            fr.put(x, y, SKIN[k])
    # the cheeks hollow: the face's edges and its lower rows in shadow
    for (x, y) in helm:
        k = fr.k(x, y)
        if fr.side != 'back' and k in SKIN and (x in (l + 1, r - 1) or y >= fr.top + 12):
            fr.put(x, y, SKIN['9D8C84'])
    # the hair, two thin falls past the jaw onto the shoulders, uneven at their ends
    falls = {'front': (l, r), 'back': (l, r), 'right': (l, None), 'left': (None, r)}[fr.side]
    for edge in falls:
        if edge is None:
            continue
        out = -1 if edge == l else 1
        for t, (x0, end) in enumerate(((edge, fr.top + 18), (edge + out, fr.top + 15 + (fr.i % 2)))):
            pts = [(x0, y) for y in range(fr.top + 4, end)]
            for (x, y) in pts:
                fr.put(x, y, HAIR if t == 0 and y < end - 3 else HAIR_MID if t == 0 else HAIR_DARK)
            fr.put(x0, end, INK, behind=True)
        for y in range(fr.top + 4, fr.top + 16):
            fr.put(edge + out * 2, y, INK, behind=True)


def staff(fr: Frame) -> None:
    """The balance's staff where the sword is: its own pixels the robe's, then the gold staff drawn along it."""
    axis = fr.blade()
    if fr.clip == 'walk_up':
        # from behind: only the head shows, over the shoulders
        hx_, hy = fr.cx + 1, fr.top - 13
        fr.line(hx_, hy, hx_, 70, G_MID, behind=True)
        head(fr, hx_, hy, 0.0)
        return
    if not axis:
        return
    (hx_, hy), (tx, ty) = axis
    for y in range(fr.h):  # the sword's own pixels go under the robe's black
        for x in range(fr.w):
            if fr.k(x, y) == BLADE or (fr.k(x, y) in ('DACDC1', 'C1B2A8') and (fr.k(x + 1, y) == BLADE or fr.k(x - 1, y) == BLADE)):
                fr.put(x, y, VEST.get(fr.k(x, y), VEST['C1B2A8']) if fr.k(x, y) != BLADE else VEST['B6A59B'])
    dx, dy = tx - hx_, ty - hy
    length = math.hypot(dx, dy) or 1
    ux, uy = dx / length, dy / length
    planted = uy > 0.85 and length > 15
    if planted:
        # point down: the staff stands on the ground and rises behind the head
        foot_y = 71
        top_y = fr.top - 13
        x = hx_ + (tx - hx_) * 0  # vertical
        fr.line(x, hy, tx, foot_y, G_MID)
        fr.line(x + 1, hy, tx + 1, foot_y, G_DARK)
        fr.line(x, top_y, x, hy, G_MID, behind=True)
        fr.line(x + 1, top_y, x + 1, hy, G_DARK, behind=True)
        head(fr, x, top_y, 0.0)
    else:
        # swung or held up: it leads with its head
        ex, ey = tx + ux * 10, ty + uy * 10
        bx, by = hx_ - ux * 7, hy - uy * 7
        fr.line(hx_, hy, ex, ey, G_MID)
        fr.line(hx_ + (1 if abs(ux) < 0.7 else 0), hy + (1 if abs(ux) >= 0.7 else 0), ex + (1 if abs(ux) < 0.7 else 0), ey + (1 if abs(ux) >= 0.7 else 0), G_DARK)
        fr.line(bx, by, hx_, hy, G_DARK, behind=True)
        head(fr, ex, ey, math.atan2(uy, ux) + math.pi / 2)


def head(fr: Frame, x: float, y: float, ang: float) -> None:
    """The balance at the staff's head: a short beam across it, two pans hanging from its ends on chains."""
    ca, sa = math.cos(ang), math.sin(ang)
    ends = [(x - ca * 8, y - sa * 8), (x + ca * 8, y + sa * 8)]
    fr.line(ends[0][0], ends[0][1], ends[1][0], ends[1][1], G_LIGHT)
    fr.line(ends[0][0], ends[0][1] + 1, ends[1][0], ends[1][1] + 1, G_DARK)
    fr.put(x, y - 1, G_LIGHT)
    fr.put(x, y - 2, G_MID)
    for n, (ex, ey) in enumerate(ends):
        sway = round(math.sin((fr.i / max(1, fr.n)) * 2 * math.pi + n)) if fr.clip.startswith(('idle', 'walk')) else 0
        for t in range(1, 7):
            fr.put(ex + (sway if t > 3 else 0), ey + t, 'A08A60' if t % 2 else '6C5A3A')
        px, py = ex + sway, ey + 7
        pan = [(px + i, py) for i in range(-3, 4)] + [(px + i, py + 1) for i in range(-2, 3)]
        for (qx, qy) in pan:
            fr.put(qx, qy, G_MID if qy == py else G_DARK)
        if n == 0:  # the grain, heaped
            for i in range(-2, 3):
                fr.put(px + i, py - 1, GRAIN)
            fr.put(px, py - 2, GRAIN)
        else:  # the black cloth, dripping
            for i, d in ((-2, 3), (0, 4), (2, 2)):
                for t in range(2, 2 + d):
                    fr.put(px + i, py + t, CLOTH if t < 1 + d else CLOTH_DARK)
        fr.ink_round(pan + [(px + i, py - 1) for i in range(-2, 3)])


def halo(fr: Frame) -> None:
    cx, cy = fr.cx, fr.top - 2
    ring(fr, cx, cy, 11, G_DARK)
    ring(fr, cx, cy, 10, G_MID)
    for i in range(18):
        ang = math.radians(-180 + i * 20)
        for t in np.linspace(11.5, 14.5 if i % 2 else 13, 6):
            fr.put(cx + math.cos(ang) * t, cy + math.sin(ang) * t, G_MID, behind=True)


def wheat(fr: Frame) -> None:
    """Wheat worked in gold down the front of the skirt (and the old blood's drops gold thread)."""
    lines = [fr.cx - 5, fr.cx + 5] if fr.side in ('front', 'back') else [fr.cx + (3 if fr.side == 'right' else -3)]
    for lx in lines:
        for y in range(SKIRT[0] + 1, SKIRT[1]):
            if fr.body(lx, y) and fr.k(lx, y) in CREAM:
                fr.put(lx, y, G_MID if y % 2 else G_DARK)
                if y % 3 == 0:
                    for s in (-1, 1):
                        if fr.body(lx + s, y - 1) and fr.k(lx + s, y - 1) in CREAM:
                            fr.put(lx + s, y - 1, G_MID)


def draw(fr: Frame) -> np.ndarray:
    for y in range(fr.h):
        for x in range(fr.w):
            k = fr.keys[y][x]
            if not k:
                continue
            if fr.is_arc(x, y):
                fr.put(x, y, ARCS[k])
            elif k in CREAM:
                # the old blood on the skirt is gold thread now; cream is black vestment
                fr.put(x, y, VEST[k])
            elif k in CAPE:
                # a drop of the old blood on the cream (a few cape-red pixels alone) is gold thread; the cape is umber
                drop = sum(fr.k(x + dx, y + dy) in CAPE for dx in (-1, 0, 1) for dy in (-1, 0, 1)) <= 3 and fr.near(x, y, set(CREAM))
                fr.put(x, y, G_MID if drop else UMBER[k])
            elif k in GOLD and y > fr.top + 2:
                fr.put(x, y, AGOLD[k])
    # the crown's gold points are gone under the mitre: clear them first
    for y in range(max(0, fr.top - 1), fr.top + 4):
        for x in range(fr.cx - 8, fr.cx + 9):
            if fr.k(x, y) in GOLD or (fr.k(x, y) in OUTLINE and y < fr.top + 3):
                fr.clear(x, y)
    wheat(fr)
    face(fr)
    halo(fr)
    mitre(fr)
    staff(fr)
    return fr.a


# ---- the skill effects -----------------------------------------------------------------------------------------------

def fx_weigh() -> np.ndarray:
    # the Weight of Sin comes down on the cell: a black iron weight with its ring, the ground cracking and the dust thrown out
    n = 5
    a = blank(n)
    for f in range(n):
        y = [6, 24, 40, 40, 40][f]  # its foot
        if f < 4:
            sink = 0 if f < 3 else 1
            for dy in range(14):
                yy = y - 14 + dy + sink
                half = 6 + dy // 3
                for x in range(32 - half, 32 + half + 1):
                    c = '5C5666' if x < 32 - half + 2 else '1C1A21' if x > 32 + half - 3 else '332F3B'
                    if dy < 2:
                        c = '4C4756'
                    dot(a, f, x, yy, c)
            for x in range(28, 37):  # the seal stamped in gold on its face
                if (x - 32) ** 2 < 10:
                    dot(a, f, x, y - 6 + sink, G_MID)
            fx_disc(a, f, 32, y - 16 + sink, 3, 2.2, G_MID, hollow=0.35)
            if f < 2:
                for t in range(4):
                    dot(a, f, 25 + t * 4, y - 20 - t % 2 * 2, 'FFF4D0')
            fx_ink(a, f)
        if f >= 2:
            r = [0, 0, 9, 15, 20][f]
            for k in range(16):
                ang = math.radians(180 + k * 12)
                for t in range(max(1, r - 5), r):
                    dot(a, f, 32 + math.cos(ang) * t * 1.3, 42 + math.sin(ang) * t * 0.4, 'B8A27A' if f < 4 else '8C7A5A')
            for cx_, d in ((-1, 1), (1, 1)):  # cracks
                fx_line(a, f, 32 + cx_ * 8, 42, 32 + cx_ * (12 + f * 2), 46 + f, '2A2020')
    return a


def fx_pan() -> np.ndarray:
    # the great pan comes down out of the air onto the spot, and the ground rings out from under it
    n = 6
    a = blank(n)
    for f in range(n):
        py = [8, 22, 38, 44, 44, 44][f]
        if f < 5:
            for t in range(0, py - 6, 2):  # the chains above it
                for cx_ in (18, 46):
                    dot(a, f, cx_ + (32 - cx_) * t / max(1, py), t, '8A7A5A')
            fx_disc(a, f, 32, py, 16, 5, '6C4C26')
            fx_disc(a, f, 32, py - 1, 15, 4, 'B88E42')
            fx_disc(a, f, 32, py - 2, 12, 2.5, 'E2C064')
            fx_ink(a, f)
        if f >= 3:
            r = [0, 0, 0, 18, 24, 28][f]
            fx_disc(a, f, 32, 50, r, r * 0.3, 'C4A86A' if f < 5 else '8C7444', hollow=0.75)
    return a


def fx_grain() -> np.ndarray:
    # grain pouring down out of a pan above onto the spot, heaping and spilling
    n = 6
    a = blank(n)
    rng = np.random.default_rng(3)
    for f in range(n):
        tip = [20, 42, 56, 56, 56, 56][f]
        stream = f < 5
        if stream:
            for y in range(0 if f < 3 else 6 * (f - 2), tip):
                for dx in (-2, -1, 0, 1, 2):
                    if rng.random() < 0.55:
                        dot(a, f, 32 + dx + rng.integers(-1, 2), y, GRAIN if rng.random() < 0.7 else 'B88E42')
        if f >= 2:
            h = [0, 0, 2, 4, 5, 5][f]
            for x in range(32 - 4 * h, 32 + 4 * h + 1):
                top = 57 - h + abs(x - 32) // 4
                for y in range(top, 58):
                    dot(a, f, x, y, 'E2C064' if y == top else 'B88E42')
            for _ in range(10 * h):
                dot(a, f, 32 + rng.normal(0, 7 * h / 3), 57 - rng.random() * 2, GRAIN)
        fx_ink(a, f, '5A4422')
    return a


def fx_famine() -> np.ndarray:
    # hunger drawn out of the cell: a stalk of wheat bowing and withering, husks and grey dust lifting off it
    n = 6
    a = blank(n)
    rng = np.random.default_rng(11)
    motes = [(rng.uniform(14, 50), rng.uniform(36, 58), rng.uniform(0.7, 1.4)) for _ in range(34)]
    for f in range(n):
        bow = f * 0.32
        pts = []
        for t in range(26):  # the stalk, bowing further each frame
            ang = -math.pi / 2 + bow * (t / 26) ** 1.5
            x = 32 + sum(math.cos(-math.pi / 2 + bow * (u / 26) ** 1.5) for u in range(t))
            y = 56 + sum(math.sin(-math.pi / 2 + bow * (u / 26) ** 1.5) for u in range(t))
            pts.append((x, y))
        col = ['C9A050', 'A8884A', '8C7A5A', '6E6458', '5A5248', '4A4238'][f]
        for (x, y) in pts:
            dot(a, f, x, y, col)
        hx_, hy = pts[-1]
        for k in range(5):  # its ear
            dot(a, f, hx_ - 1, hy + k * 0.8, col)
            dot(a, f, hx_ + 1, hy + k * 0.8, col)
        for (x, y, sp) in motes:
            yy = y - f * 6 * sp
            if yy < 4 or yy > 60:
                continue
            c = '9A8E7C' if sp > 1 else '6E6458'
            dot(a, f, x + math.sin(yy / 5) * 2, yy, c)
            dot(a, f, x + math.sin(yy / 5) * 2 + 1, yy, c)
            if sp > 1.1:
                dot(a, f, x + math.sin(yy / 5) * 2, yy + 1, '4A4238')
        fx_ink(a, f, '231B1C')
        r = 8 + f * 4
        fx_disc(a, f, 32, 57, r, r * 0.3, '4A4030' if f < 4 else '2E281E', hollow=0.75)
    return a


def fx_lighter() -> np.ndarray:
    # Ele rises: a ring of gold light thrown out and up, motes lifting off it
    n = 6
    a = blank(n)
    for f in range(n):
        r = [6, 12, 18, 23, 27, 30][f]
        fx_disc(a, f, 32, 40, r, r * 0.45, G_LIGHT if f < 3 else G_MID if f < 5 else G_DARK, hollow=0.7)
        for k in range(12):
            ang = math.radians(k * 30 + f * 9)
            x = 32 + math.cos(ang) * r
            y = 40 + math.sin(ang) * r * 0.45 - f * 3
            dot(a, f, x, y, 'FFF4D0')
            dot(a, f, x, y - 1, G_LIGHT)
    return a


def effects(preview: Path | None) -> dict:
    out = {'weigh': fx_weigh(), 'pan': fx_pan(), 'grain': fx_grain(), 'famine': fx_famine(), 'lighter': fx_lighter()}
    write_effects('ele', out, preview)
    return out


if __name__ == '__main__':
    pv = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    sheets = build('ele', draw)
    write_strips('ele', sheets, fx_colors=['#FFF4D0', '#E8C46A'], preview=pv)
    e = effects(pv)
    print('Ele →', 'public/assets/lsw/Bosses/ele')
    for k, v in sheets.items():
        print(f'  {k}.png {v.shape[1]}x{v.shape[0]}')
    for k, v in e.items():
        print(f'  effect-{k}.png {v.shape[1]}x{v.shape[0]} ({v.shape[1] // FX} frames)')
