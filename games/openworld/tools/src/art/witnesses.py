"""The White-Robed Witnesses Beneath the Altar, the Fifth Seal-bearer (docs/chapter-5.md §4): their boss strips, three robed
figures as one body, and their five skill effects.

From the collaborator's portrait (wiki/images/seal5-white-robed-witnesses.webp): white-robed, hooded, gold haloes, hands
raised. Each figure is Alberic's strips (stripkit.py) redrawn — the cream a cold white, the cape grey rags, the helm a white
hood with the face in its shadow, a thin gold halo, both hands raised — and three stand together: one before, two behind
it a little higher and darker, out of step with it. Before one strikes, the one in front lifts the lance's shadow, a
blade of gold light. The frames are wider than Alberic's (90x80, the soles' line at y 75), with his clips' frames,
timings and hit frames.

    python3 games/openworld/tools/src/art/witnesses.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from stripkit import (ARC, BLADE, CAPE, CLIPS, CREAM, FX, GOLD, INK, OUTLINE, Frame, blank, clip_frames, dot, erase_blade, fx_disc,
                      fx_ink, fx_line, ring, shades, write_effects, write_strips)

WW, WH = 90, 80
ANCHOR = (45, 75)
ROBE = shades(['F4F2EC', 'E8E6E0', 'DAD8D2', 'C4C2BC', 'B6B4AE', 'B0AEA8', '9A9892', '86847E'])
GOLDS = shades(['F6DA8A', 'EAC872', 'D8B05E', 'C49A4E', 'B08A44', '96784A', '76582E', '76582E'], GOLD)
RAGS = {'953737': 'BCBAB2', '712B2C': '96948C'}
HOOD, HOOD_MID, HOOD_DARK, SHADOW = 'F0EEE8', 'D6D4CE', 'ABA9A2', '1A181E'
SKIN = 'D8CCBC'
HALO, HALO_DARK, HALO_TIP = 'D8B05E', '96784A', 'F6DA8A'
LIGHT, LIGHT_EDGE = 'F6E7A8', 'FFFBE6'
ARCS = {'FFFFFF': 'FFFBE6', 'FFE9B0': 'F6E7A8', 'F3B876': 'C8A050'}


def witness(fr: Frame, arms: bool, lance: bool) -> np.ndarray:
    """One of them, drawn over Alberic's frame."""
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
                fr.put(x, y, ROBE[k])
            elif k in CAPE:
                drop = sum(fr.k(x + dx, y + dy) in CAPE for dx in (-1, 0, 1) for dy in (-1, 0, 1)) <= 3
                fr.put(x, y, ROBE['C1B2A8'] if drop else RAGS[k])
            elif k in GOLD:
                if y <= fr.top + 2:
                    fr.clear(x, y)
                else:
                    fr.put(x, y, GOLDS[k])
    erase_blade(fr, lambda k: ROBE['C1B2A8'])
    hood(fr)
    halo(fr)
    if arms:
        raise_hands(fr)
    if lance:
        lance_light(fr)
    return fr.a


def hood(fr: Frame) -> None:
    helm = fr.helm()
    if not helm:
        return
    xs = [x for x, _ in helm]
    l, r = min(xs), max(xs)
    for (x, y) in helm:
        if fr.side == 'back':
            c = HOOD if x < fr.cx else HOOD_MID
        elif fr.side in ('left', 'right'):
            edge = r - 3 if fr.side == 'right' else l + 3
            in_face = (x >= edge if fr.side == 'right' else x <= edge) and y > fr.top + 5
            c = SHADOW if in_face else HOOD if x < fr.cx else HOOD_MID
        else:
            c = SHADOW if l + 2 < x < r - 2 and y > fr.top + 5 else HOOD if x < fr.cx else HOOD_MID
        fr.put(x, y, c)
    if fr.side == 'front':  # the chin, pale in the shadow
        fr.put(fr.cx - 1, fr.top + 13, SKIN)
        fr.put(fr.cx, fr.top + 13, SKIN)
    for y in range(fr.top + 1, fr.top + 5):  # the hood's crown
        for x in range(l + (fr.top + 5 - y) // 2, r - (fr.top + 5 - y) // 2 + 1):
            fr.put(x, y, HOOD if x < (l + r) // 2 else HOOD_MID)
    for y in range(fr.top + 1, fr.top + 16):
        row = [x for x in range(l - 2, r + 3) if fr.filled(x, y)]
        if row:
            fr.put(min(row) - 1, y, INK, behind=True)
            fr.put(max(row) + 1, y, INK, behind=True)
    fr.put((l + r) // 2, fr.top, INK, behind=True)


def halo(fr: Frame) -> None:
    cx, cy = fr.cx, fr.top + 6
    ring(fr, cx, cy, 9, HALO_DARK)
    ring(fr, cx, cy, 8, HALO)
    for k in range(12):
        ang = math.radians(-180 + k * 16.4)
        for t in np.linspace(9.5, 12 if k % 2 else 11, 4):
            fr.put(cx + math.cos(ang) * t, cy + math.sin(ang) * t, HALO_TIP, behind=True)


def raise_hands(fr: Frame) -> None:
    """Both hands lifted (one, seen from the side), white sleeves falling back from the wrists."""
    s0 = fr.top + 18
    if fr.side in ('front', 'back'):
        arms = [(fr.cx - 8, s0, fr.cx - 13, fr.top + 3), (fr.cx + 8, s0, fr.cx + 13, fr.top + 3)]
    else:
        f = 1 if fr.side == 'right' else -1
        arms = [(fr.cx + f * 4, s0, fr.cx + f * 14, fr.top + 6)]
    sway = 1 if fr.i % 8 in (2, 3, 4, 5) and fr.clip.startswith(('idle', 'walk')) else 0
    for (x0, y0, x1, y1) in arms:
        y1 += sway
        pts = []
        for t in np.linspace(0, 1, 30):
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for d in (-1, 0, 1):
                p = (int(round(x + d)), int(round(y)))
                if p not in pts:
                    pts.append(p)
        for (x, y) in pts:
            fr.put(x, y, ROBE['EDE1D2'] if x < (x0 + x1) / 2 + 0.5 - 1 else ROBE['C1B2A8'])
        hand = [(int(round(x1)) + dx, int(round(y1)) + dy) for dx in (0, 1) for dy in (-2, -1)]
        for (x, y) in hand:
            fr.put(x, y, SKIN)
        fr.ink_round(pts + hand)


def lance_light(fr: Frame) -> None:
    """The lance's shadow along the sword's line: a blade of gold light, longer than the sword."""
    axis = fr.blade()
    if not axis:
        return
    (hx_, hy), (tx, ty) = axis
    ux, uy = tx - hx_, ty - hy
    ln = math.hypot(ux, uy) or 1
    ux, uy = ux / ln, uy / ln
    ex, ey = tx + ux * 8, ty + uy * 8
    fr.line(hx_ - ux * 4, hy - uy * 4, ex, ey, LIGHT)
    fr.line(hx_ - ux * 4 + (1 if abs(ux) < 0.7 else 0), hy - uy * 4 + (1 if abs(ux) >= 0.7 else 0), ex + (1 if abs(ux) < 0.7 else 0), ey + (1 if abs(ux) >= 0.7 else 0), LIGHT_EDGE)
    for t in range(4):  # the head, a leaf of light
        fr.put(ex + ux * t, ey + uy * t, LIGHT_EDGE)


def dim(a: np.ndarray, k: float = 0.8) -> np.ndarray:
    b = a.copy()
    m = b[..., 3] > 0
    rgb = b[..., :3].astype(float)
    rgb[m] = rgb[m] * k + np.array([18, 18, 30]) * (1 - k)
    b[..., :3] = rgb.clip(0, 255).astype(np.uint8)
    return b


def paste(canvas: np.ndarray, pic: np.ndarray, dx: int, dy: int) -> None:
    h, w = pic.shape[:2]
    for y in range(h):
        yy = y + dy
        if not 0 <= yy < WH:
            continue
        for x in range(w):
            xx = x + dx
            if 0 <= xx < WW and pic[y, x, 3]:
                canvas[yy, xx] = pic[y, x]


def compose(clip: str, i: int, frames: dict[str, list[np.ndarray]]) -> np.ndarray:
    canvas = np.zeros((WH, WW, 4), np.uint8)
    n = len(frames[clip])
    strike = clip.startswith('attack')
    # the two behind: out of step, in the same clip when walking, standing still (facing the same way) when it strikes
    behind_clip = {'attack_right': 'walk_right', 'attack_left': 'walk_left', 'attack_down': 'idle'}.get(clip, clip)
    bf = frames[behind_clip]
    for (dx, dy, phase, mirror) in ((-16, -3, 3, True), (16, -3, 5, False)):
        j = 0 if strike and behind_clip != 'idle' else (i + phase) % len(bf)
        fr = Frame(bf[j], behind_clip, j, len(bf))
        pic = dim(witness(fr, True, False))
        if mirror and fr.side in ('front', 'back'):
            pic = pic[:, ::-1]
        paste(canvas, pic, 15 + dx, 4 + dy)
    fr = Frame(frames[clip][i], clip, i, n)
    lifted = strike and 0 < i < n - 1
    pic = witness(fr, not lifted, lifted)
    paste(canvas, pic, 15, 4)
    return canvas


def build() -> dict[str, np.ndarray]:
    frames = {c: clip_frames(c) for c in CLIPS}
    return {c: np.concatenate([compose(c, i, frames) for i in range(len(frames[c]))], axis=1) for c in CLIPS}


# ---- the skill effects -----------------------------------------------------------------------------------------------

def fx_howlong() -> np.ndarray:
    # the cry: rings of pale sound going out, and the breath of it, white
    n = 6
    a = blank(n)
    for f in range(n):
        for k in range(3):
            r = 6 + f * 5 + k * 7
            if r < 33:
                fx_disc(a, f, 32, 36, r, r * 0.55, 'FFFBE6' if k == 0 and f < 3 else 'DAD8D2' if k < 2 else '9A9892', hollow=0.86)
        for s in range(8):
            ang = math.radians(s * 45 + 22)
            r0, r1 = 4 + f * 4, 9 + f * 5
            fx_line(a, f, 32 + math.cos(ang) * r0, 36 + math.sin(ang) * r0 * 0.55, 32 + math.cos(ang) * r1, 36 + math.sin(ang) * r1 * 0.55, 'F4F2EC' if f < 4 else 'B6B4AE')
    return a


def fx_robes() -> np.ndarray:
    # a white robe falling out of the dark onto the spot like a shroud, settling, and gone
    n = 6
    a = blank(n)
    for f in range(n):
        top = [2, 14, 28, 36, 38, 38][f]
        spread = [6, 9, 12, 16, 18, 18][f]
        h = [22, 22, 20, 14, 8, 5][f]
        for y in range(top, top + h):
            t = (y - top) / max(1, h)
            w = 3 + spread * t
            for x in range(int(32 - w), int(32 + w) + 1):
                fold = (x + y // 3) % 5
                c = 'F4F2EC' if fold == 0 else 'E8E6E0' if fold < 3 else 'C4C2BC'
                if f == 5 and (x + y) % 2:
                    continue
                dot(a, f, x, y + math.sin(x / 3 + f) * 1.2, c)
        fx_ink(a, f, '6E6C66')
    return a


def fx_hands() -> np.ndarray:
    # white hands reaching up out of the ground, sleeves falling back from them
    n = 5
    a = blank(n)
    hands = [(22, 52), (32, 56), (42, 51)]
    for f in range(n):
        rise = [4, 11, 17, 15, 8][f]
        for k, (hx_, hy) in enumerate(hands):
            h = rise - abs(k - 1) * 2
            if h <= 0:
                continue
            for y in range(hy - h, hy):
                for dx in (-2, -1, 0, 1, 2):
                    dot(a, f, hx_ + dx, y, 'F4F2EC' if dx < 0 else 'DAD8D2' if dx < 2 else 'B6B4AE')
            for fi in range(4):
                fx_line(a, f, hx_ - 2 + fi * 1.3, hy - h, hx_ - 3 + fi * 2, hy - h - 4 - (fi % 2), 'D8CCBC')
            fx_disc(a, f, hx_, hy, 5, 1.6, '2A2630')
        fx_ink(a, f)
    return a


def fx_lance() -> np.ndarray:
    # the lance's shadow: a column of gold light striking down onto the cell and burning there
    n = 5
    a = blank(n)
    for f in range(n):
        w = [1, 3, 4, 3, 1][f]
        tip = [30, 58, 58, 58, 58][f]
        for y in range(0, tip):
            for dx in range(-w, w + 1):
                c = LIGHT_EDGE if abs(dx) < w - 1 or w == 1 else LIGHT if abs(dx) < w else 'C8A050'
                dot(a, f, 32 + dx, y, c)
        if f >= 1:
            r = [0, 6, 11, 14, 16][f]
            fx_disc(a, f, 32, 58, r, r * 0.35, LIGHT if f < 3 else 'C8A050', hollow=0.6)
    return a


def fx_myriad() -> np.ndarray:
    # all of them rising: haloes going up out of the floor in a ring, more and more
    n = 6
    a = blank(n)
    rng = np.random.default_rng(9)
    spots = [(rng.uniform(8, 56), rng.uniform(30, 58), rng.integers(0, 3)) for _ in range(14)]
    for f in range(n):
        for (x, y, k) in spots:
            if k > f:
                continue
            yy = y - (f - k) * 4
            fx_disc(a, f, x, yy, 4, 2, HALO, hollow=0.45)
            dot(a, f, x, yy - 3, HALO_TIP)
            dot(a, f, x - 3, yy - 2, HALO_TIP)
            dot(a, f, x + 3, yy - 2, HALO_TIP)
        r = 8 + f * 4
        fx_disc(a, f, 32, 46, r, r * 0.4, 'F4F2EC' if f < 3 else 'C4C2BC', hollow=0.85)
    return a


def effects(preview: Path | None) -> dict:
    out = {'howlong': fx_howlong(), 'robes': fx_robes(), 'hands': fx_hands(), 'lance': fx_lance(), 'myriad': fx_myriad()}
    write_effects('witnesses', out, preview)
    return out


if __name__ == '__main__':
    pv = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    sheets = build()
    write_strips('witnesses', sheets, fw=WW, fh=WH, anchor=ANCHOR, fx_colors=['#FFFBE6', '#F6E7A8'], preview=pv,
                 note='three to a body')
    e = effects(pv)
    print('The Witnesses →', 'public/assets/lsw/Bosses/witnesses')
    for k, v in sheets.items():
        print(f'  {k}.png {v.shape[1]}x{v.shape[0]}')
    for k, v in e.items():
        print(f'  effect-{k}.png {v.shape[1]}x{v.shape[0]} ({v.shape[1] // FX} frames)')
