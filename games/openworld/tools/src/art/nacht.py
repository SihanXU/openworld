"""Nacht, Reinholder of Death, the Fourth Seal-bearer (docs/chapter-4.md §4): his boss strips, a rider on a pale horse, and
his five skill effects; and the grave-hands he leaves on the ford (fixture:grave_hands).

From the collaborator's portrait (wiki/images/seal4-reinholder-of-death-nacht.webp): a rider in white rags over dark armour,
hooded, a halo of thin spikes behind his head, a long scythe with a rag streaming from it, on a gaunt pale horse hung with
bells and chains, rags over its flanks. The rider is Alberic's strips (stripkit.py) redrawn — his armour dark iron, his cape
and helm white rags with the face in shadow, the sword a scythe — and set in the saddle; the horse is drawn here, frame by
frame, its legs in a four-beat walk. The frames are wider and taller than Alberic's (96x100, the hooves' line at y 95),
with his clips' frames, timings and hit frames.

    python3 games/openworld/tools/src/art/nacht.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from stripkit import (ARC, BLADE, CAPE, CLIPS, CREAM, FIXTURES, FX, GOLD, INK, OUTLINE, Frame, blank, clip_frames, dot, fx_disc,
                      fx_ink, fx_line, hx, ring, shades, write_effects, write_strips)

NW, NH = 96, 100
GROUND = 95
ANCHOR = (48, GROUND)

IRON = shades(['6A6E78', '5E626C', '52555F', '43464F', '3C3F48', '393B44', '2E3038', '25272E'])
SILVER = shades(['D6D4CC', 'C4C2BA', 'ADABA2', '98968E', '86847C', '76746C', '5E5C56', '5E5C56'], GOLD)
RAG, RAG_MID, RAG_DARK, RAG_DEEP = 'E6E4DC', 'C9C7BE', 'A4A29A', '7C7A72'
HORSE = ['E2DED2', 'C9C3B5', 'A69F91', '7E786C', '57524B']
MANE = ['EEEDE8', 'C2BFB6', '8E8A82']
HOOF = '3A3430'
EYE, GLOW = '1A1616', 'CFEDE6'
BRONZE, BRONZE_DARK = 'B08A4A', '6E5228'
LINK, LINK_DARK = 'A8ACB4', '6C7078'
STEEL, STEEL_EDGE, STEEL_DARK = 'B4B8C0', 'E6EAEE', '6E727C'
POLE, POLE_DARK = '4A3E36', '2E2622'
ARCS = {'FFFFFF': 'F2F6F4', 'FFE9B0': 'C8D8D4', 'F3B876': '6E8480'}


class Layer:
    """A part drawn on its own, then inked round and laid over what is behind it."""

    def __init__(self):
        self.a = np.zeros((NH, NW, 4), np.uint8)

    def put(self, x: float, y: float, c: str) -> None:
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < NW and 0 <= yi < NH:
            self.a[yi, xi] = (*hx(c), 255)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, shade) -> None:
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (x - cx) / rx, (y - cy) / ry
                if u * u + v * v <= 1:
                    self.put(x, y, shade(u, v))

    def poly(self, pts: list[tuple[float, float]], shade) -> None:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            for x in range(int(min(xs)), int(max(xs)) + 1):
                if inside(pts, x + 0.5, y + 0.5):
                    self.put(x, y, shade(x, y))

    def thick(self, x0: float, y0: float, x1: float, y1: float, w0: float, w1: float, shade) -> None:
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
        for s in range(n + 1):
            t = s / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            w = w0 + (w1 - w0) * t
            for dx in np.arange(-w / 2, w / 2 + 0.01, 0.5):
                self.put(x + dx, y, shade(dx / max(w / 2, 0.5), t))

    def ink(self) -> 'Layer':
        filled = self.a[..., 3] > 0
        out = np.zeros_like(filled)
        out[1:] |= filled[:-1]
        out[:-1] |= filled[1:]
        out[:, 1:] |= filled[:, :-1]
        out[:, :-1] |= filled[:, 1:]
        edge = out & ~filled
        self.a[edge] = (*hx(INK), 255)
        return self

    def over(self, base: np.ndarray) -> None:
        m = self.a[..., 3] > 0
        base[m] = self.a[m]


def inside(pts, x, y) -> bool:
    c = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            c = not c
        j = i
    return c


def hshade(u: float, v: float) -> str:
    """The horse's coat lit from the top left."""
    d = u * 0.6 + v * 0.8
    return HORSE[0] if d < -0.55 else HORSE[1] if d < 0.05 else HORSE[2] if d < 0.6 else HORSE[3]


def leg(L: Layer, x: float, y: float, swing: float, lift: float, far: bool, upper=12, lower=11) -> None:
    """A leg from its joint at (x, y): the forearm swung by `swing` (radians), the knee bent by `lift`."""
    dark = 1 if far else 0
    kx, ky = x + math.sin(swing) * upper, y + math.cos(swing) * upper
    a2 = swing - lift
    fx_, fy = kx + math.sin(a2) * lower, ky + math.cos(a2) * lower
    fy = min(fy, GROUND - 2)
    L.thick(x, y, kx, ky, 5, 3, lambda s, t: HORSE[min(4, (1 if s < 0 else 2) + dark)])
    L.thick(kx, ky, fx_, fy, 3, 2, lambda s, t: HORSE[min(4, (1 if s < 0 else 2) + dark)])
    for dx in (-1, 0, 1):
        L.put(fx_ + dx, fy + 1, HOOF)
        L.put(fx_ + dx, fy + 2, HOOF)


def gait(clip: str, i: int, n: int, k: int) -> tuple[float, float]:
    """Leg k's swing and knee in frame i: a four-beat walk when walking, a shift of weight when still."""
    if clip.startswith('walk'):
        ph = (i / n + [0.0, 0.5, 0.25, 0.75][k]) * 2 * math.pi
        swing = math.sin(ph) * 0.35
        lift = max(0.0, math.cos(ph)) * 0.7
        return swing, lift
    ph = (i / max(1, n)) * 2 * math.pi
    return math.sin(ph + k) * 0.03, 0.0


def rags(L: Layer, x0: float, x1: float, y0: float, y1: float, i: int, seed: int) -> None:
    """Ragged white cloth hanging from y0 to about y1, torn at the bottom, folds down it."""
    rng = np.random.default_rng(seed)
    cuts = [y1 + rng.integers(-4, 3) for _ in range(int(x1 - x0) + 1)]
    for n, x in enumerate(range(int(x0), int(x1) + 1)):
        bottom = cuts[n] + (1 if (x + i) % 5 == 0 else 0)
        for y in range(int(y0), int(bottom)):
            fold = (x - int(x0)) % 4
            c = RAG if fold == 0 else RAG_MID if fold in (1, 3) else RAG_DARK
            if y > bottom - 3:
                c = RAG_DARK if fold else RAG_MID
            L.put(x, y, c)


def bell(L: Layer, x: float, y: float) -> None:
    for dy, w in ((0, 0), (1, 1), (2, 1), (3, 2)):
        for dx in range(-w, w + 1):
            L.put(x + dx, y + dy, BRONZE if dx <= 0 else BRONZE_DARK)
    L.put(x, y + 4, BRONZE_DARK)


def horse_side(clip: str, i: int, n: int) -> tuple[list[Layer], list[Layer], tuple[float, float]]:
    """The horse facing right: the layers behind the rider, those before him, and where his saddle is."""
    bob = 1 if clip.startswith('walk') and i % 4 in (1, 2) else 0
    breath = 1 if clip == 'idle' and i % 8 in (2, 3, 4, 5) else 0
    back, front = [], []
    # the far legs
    far = Layer()
    for k, (x, y) in ((2, (62, 72)), (3, (30, 72))):
        s, l = gait(clip, i, n, k)
        leg(far, x + 1, y + bob, s, l, True)
    back.append(far.ink())
    # the tail
    tail = Layer()
    sway = math.sin(i / max(1, n) * 2 * math.pi) * 2
    for strand in range(4):
        for t in range(28):
            x = 19 - t * 0.25 + sway * t / 28 + (strand - 1.5) * 0.9
            y = 60 + bob + t
            tail.put(x, y, MANE[min(2, strand // 2 + (1 if t > 20 else 0))])
    back.append(tail.ink())
    # the body: rump, barrel, chest; the ribs; the neck and head
    body = Layer()
    body.ellipse(29, 64 + bob, 10, 10, hshade)
    body.ellipse(45, 66 + bob - breath, 20, 9 + breath, hshade)
    body.ellipse(60, 65 + bob, 8, 9, hshade)
    for r in range(4):  # the ribs showing through
        for y in range(63 + bob, 72 + bob):
            body.put(44 + r * 4 + (y - 63) * 0.15, y, HORSE[2])
    neck = [(56, 59 + bob), (66, 52 + bob), (73, 43 + bob), (78, 46 + bob), (70, 58 + bob), (66, 70 + bob)]
    body.poly(neck, lambda x, y: HORSE[1] if y < 56 + bob - (x - 60) * 0.6 else HORSE[2])
    head_ = [(72, 41 + bob), (77, 40 + bob), (87, 54 + bob), (86, 58 + bob), (81, 58 + bob), (73, 47 + bob)]
    body.poly(head_, lambda x, y: HORSE[0] if x + (y - 40) * 0.2 < 79 else HORSE[1] if x < 84 else HORSE[2])
    body.put(73, 38 + bob, HORSE[1])  # the ears
    body.put(74, 39 + bob, HORSE[1])
    body.put(75, 37 + bob, HORSE[2])
    back.append(body.ink())
    # the mane, the eye, the bridle and its bells
    detail = Layer()
    for t in range(20):
        x, y = 72 - t * 0.75, 42 + bob + t * 0.8
        for d in range(3 + (t % 3)):
            detail.put(x - 1 + d * 0.3, y + d, MANE[min(2, d // 2)])
    detail.put(79, 46 + bob, EYE)
    detail.put(80, 46 + bob, GLOW)
    for x in range(74, 86):  # the noseband and the rein
        detail.put(x, 51 + bob + (x - 74) * 0.25, POLE_DARK)
    for t in range(14):
        detail.put(70 - t * 1.2, 52 + bob + t * 0.4, POLE_DARK)
    for x in range(56, 68):  # the chain across the chest, and its bells
        detail.put(x, 62 + bob + abs(x - 62) * 0.3 * -1 + 2, LINK if x % 2 else LINK_DARK)
    for bx in (58, 62, 66):
        bell(detail, bx, 64 + bob)
    back.append(detail)
    # before the rider: the rags over the near flank, the near legs
    cloth = Layer()
    rags(cloth, 36, 56, 56 + bob, 77 + bob, i, 4)
    front.append(cloth.ink())
    near = Layer()
    for k, (x, y) in ((0, (58, 72)), (1, (28, 72))):
        s, l = gait(clip, i, n, k)
        leg(near, x, y + bob, s, l, False)
    front.append(near.ink())
    return back, front, (47, 58 + bob)


def horse_front(clip: str, i: int, n: int, facing_away: bool) -> tuple[list[Layer], list[Layer], tuple[float, float]]:
    """The horse coming at us (or going away): its chest and head before the rider, or its rump and tail."""
    bob = 1 if clip.startswith('walk') and i % 4 in (1, 2) else 0
    back, front = [], []
    hind = Layer()
    for k, x in ((2, 44), (3, 52)):
        s, l = gait(clip, i, n, k)
        lift = int(l * 3)
        hind.thick(x, 74 + bob, x, GROUND - 3 - lift, 4, 3, lambda u, t: HORSE[3 if u > 0 else 2])
        for dx in (-1, 0, 1):
            hind.put(x + dx, GROUND - 2 - lift, HOOF)
            hind.put(x + dx, GROUND - 3 - lift, HOOF)
    back.append(hind.ink())
    body = Layer()
    # the chest behind the head, in its own shadow so the head stands out before it
    body.ellipse(48, 69 + bob, 15, 10, lambda u, v: HORSE[2] if u * 0.6 + v * 0.8 < 0.1 else HORSE[3])
    if not facing_away:  # the neck rising behind the head to the saddle
        body.poly([(42, 70 + bob), (44, 55 + bob), (52, 55 + bob), (54, 70 + bob)], lambda x, y: HORSE[2] if x < 49 else HORSE[3])
    back.append(body.ink())
    cloth = Layer()
    if facing_away:
        rags(cloth, 33, 39, 57 + bob, 78 + bob, i, 7)
        rags(cloth, 57, 63, 57 + bob, 78 + bob, i, 8)
    else:  # from before only the rags' edges show, over the shoulders
        rags(cloth, 32, 35, 58 + bob, 74 + bob, i, 7)
        rags(cloth, 61, 64, 58 + bob, 74 + bob, i, 8)
    legs = Layer()
    for k, x in ((0, 41), (1, 55)):
        s, l = gait(clip, i, n, k)
        lift = int(l * 4)
        legs.thick(x, 75 + bob, x, GROUND - 2 - lift, 4, 2.5, lambda u, t: HORSE[1 if u < 0 else 2])
        for dx in (-1, 0, 1):
            legs.put(x + dx, GROUND - 1 - lift, HOOF)
            legs.put(x + dx, GROUND - lift, HOOF)
    if facing_away:
        tail = Layer()
        sway = math.sin(i / max(1, n) * 2 * math.pi) * 1.5
        for strand in range(5):
            for t in range(26):
                tail.put(48 + (strand - 2) * 0.8 + sway * t / 26, 60 + bob + t, MANE[min(2, abs(strand - 2) // 1 + (1 if t > 20 else 0)) if abs(strand - 2) < 3 else 2])
        front += [cloth.ink(), legs.ink(), tail.ink()]
    else:
        head_ = Layer()
        T = 57 + bob
        head_.poly([(43, T), (54, T), (54, T + 8), (52, T + 21), (45, T + 21), (43, T + 8)],
                   lambda x, y: HORSE[0] if 47 <= x <= 49 else HORSE[1] if x < 51 else HORSE[2] if y < T + 16 else HORSE[3])
        for ex in (43, 53):  # the ears, up against the rider's iron
            for t in range(1, 4):
                head_.put(ex + (0 if ex < 48 else 1), T - t, HORSE[1 if t < 3 else 2])
        head_.ink()
        for ex in (45, 52):
            head_.put(ex, T + 5, EYE)
            head_.put(ex, T + 4, GLOW)
        for nx in (46, 51):  # the nostrils
            head_.put(nx, T + 19, HORSE[4])
        for x in range(44, 54):  # the noseband
            head_.put(x, T + 12, POLE_DARK)
        for t in range(9):  # the forelock
            head_.put(48 + (t % 3) - 1, T + t // 3, MANE[t % 2])
        bells = Layer()
        for x in range(38, 59):
            bells.put(x, 70 + bob + abs(x - 48) * -0.15 + 1.5, LINK if x % 2 else LINK_DARK)
        for bx in (40, 56):
            bell(bells, bx, 70 + bob)
        front += [cloth.ink(), legs.ink(), head_, bells]
    return back, front, (48, 58 + bob)


def rider(fr: Frame) -> np.ndarray:
    """Alberic redrawn as the rider: dark iron, white rags, the face in shadow under a rag hood; his legs and skirt gone (the
    horse and its rags are there); the sword left out (the scythe is drawn after)."""
    for y in range(fr.h):
        for x in range(fr.w):
            k = fr.keys[y][x]
            if not k:
                continue
            if fr.is_arc(x, y):
                fr.put(x, y, ARCS[k])
                continue
            if y >= 51 or k == BLADE or (k in ('DACDC1', 'C1B2A8') and (fr.k(x + 1, y) == BLADE or fr.k(x - 1, y) == BLADE)):
                fr.clear(x, y)
                continue
            if k in CREAM:
                fr.put(x, y, IRON[k])
            elif k in CAPE:
                fr.put(x, y, RAG_MID if k == CAPE[0] else RAG_DARK)
            elif k in GOLD:
                if y <= fr.top + 2:
                    fr.clear(x, y)
                else:
                    fr.put(x, y, SILVER[k])
    # a rag hood over the helm, the face in shadow
    helm = fr.helm()
    if helm:
        xs = [x for x, _ in helm]
        l, r = min(xs), max(xs)
        for (x, y) in helm:
            inner = l + 2 < x < r - 2 and y > fr.top + 5
            if fr.side == 'back':
                c = RAG_MID if (x - l) % 3 else RAG_DARK
            elif fr.side in ('left', 'right'):
                front_edge = r - 3 if fr.side == 'right' else l + 3
                in_face = (x >= front_edge if fr.side == 'right' else x <= front_edge) and y > fr.top + 5
                c = '17151A' if in_face else RAG_MID if (x - l) % 3 else RAG_DARK
            else:
                c = '17151A' if inner else RAG_MID if (x - l) % 3 else RAG_DARK
            fr.put(x, y, c)
        for y in range(fr.top + 1, fr.top + 5):  # the hood's crown, a little above the helm's
            for x in range(l + (fr.top + 5 - y) // 2, r - (fr.top + 5 - y) // 2 + 1):
                fr.put(x, y, RAG if x < (l + r) // 2 else RAG_MID)
        if fr.side != 'back':  # two points of light in the shadow
            if fr.side == 'front':
                fr.put(fr.cx - 2, fr.top + 9, GLOW)
                fr.put(fr.cx + 2, fr.top + 9, GLOW)
            else:
                fr.put(r - 2 if fr.side == 'right' else l + 2, fr.top + 9, GLOW)
        hood = [(x, y) for y in range(fr.top + 1, fr.top + 16) for x in range(l - 1, r + 2) if fr.filled(x, y)]
        for y in range(fr.top + 1, fr.top + 16):
            row = [x for x in range(l - 2, r + 3) if fr.filled(x, y)]
            if row:
                fr.put(min(row) - 1, y, INK, behind=True)
                fr.put(max(row) + 1, y, INK, behind=True)
        fr.put((l + r) // 2, fr.top, INK, behind=True)
    # the halo of thin spikes, behind the head
    cx, cy = fr.cx, fr.top + 6
    ring(fr, cx, cy, 8, '8E8C84', behind=True)
    for k in range(15):
        ang = math.radians(-196 + k * 15)
        r1 = 17 if k % 2 == 0 else 13
        for t in np.linspace(8.5, r1, 14):
            fr.put(cx + math.cos(ang) * t, cy + math.sin(ang) * t, 'DCDAD2' if t > r1 - 2 else 'A8A69E', behind=True)
    return fr.a


def scythe(canvas: np.ndarray, fr: Frame, dx: int, dy: int, side: str) -> None:
    """The scythe where the sword was: a long dark pole along its axis, the curved blade at its head, a rag from it."""
    axis = fr.blade()
    if fr.clip == 'walk_up':
        axis = ((fr.cx + 8.0, 44.0), (fr.cx + 8.0, 70.0))
    if not axis:
        return
    (hx_, hy), (tx, ty) = axis
    hx_, hy, tx, ty = hx_ + dx, hy + dy, tx + dx, ty + dy
    L = Layer()
    ux, uy = tx - hx_, ty - hy
    ln = math.hypot(ux, uy) or 1
    ux, uy = ux / ln, uy / ln
    if uy > 0.85 and ln > 15:  # point down: held upright, the head high (beside him, seen from before)
        ux, uy = 0.0, -1.0
        if side == 'front':
            hx_ += 11
        head = (hx_, fr.top + dy - 18)
        butt = (hx_, hy + 12)
    else:
        head = (hx_ + ux * (ln + 14), hy + uy * (ln + 14))
        butt = (hx_ - ux * 10, hy - uy * 10)
    L.thick(butt[0], butt[1], head[0], head[1], 2, 2, lambda s, t: POLE if s < 0 else POLE_DARK)
    # the blade: a crescent from the head, curving back the way the pole came and out to the side it faces
    out = 1 if side in ('right', 'front') else -1
    px, py = -uy * out, ux * out  # perpendicular, toward the side
    for t in range(16):
        f = t / 15
        bx = head[0] + px * t * 1.1 - ux * (f * f) * 9
        by = head[1] + py * t * 1.1 - uy * (f * f) * 9
        w = 2.5 * (1 - f) + 0.5
        for d in np.arange(0, w, 0.5):
            L.put(bx + ux * d, by + uy * d, STEEL_EDGE if d < 0.6 else STEEL if d < 1.6 else STEEL_DARK)
    # the rag, streaming from the head
    for t in range(10):
        L.put(head[0] - px * 2 - ux * t * 0.4 + math.sin(t + fr.i) * 0.8, head[1] - py * 2 + t * 0.9, RAG if t < 6 else RAG_DARK)
    L.ink()
    L.over(canvas)


def compose(fr: Frame) -> np.ndarray:
    side = fr.side
    if fr.clip.startswith('attack') and fr.i == fr.n - 1:
        side = fr.side = 'front'  # the last frame of a blow is the idle's first: the horse turned to us again
    clip = fr.clip
    canvas = np.zeros((NH, NW, 4), np.uint8)
    if side in ('left', 'right'):
        back, front, (sx, sy) = horse_side(clip, fr.i, fr.n)
        if side == 'left':
            for L in back + front:
                L.a = L.a[:, ::-1].copy()
            sx = NW - 1 - sx
    else:
        back, front, (sx, sy) = horse_front(clip, fr.i, fr.n, side == 'back')
    for L in back:
        L.over(canvas)
    body = rider(fr)
    dx, dy = int(round(sx - fr.cx)), int(round(sy - 50))
    if side == 'back':
        scythe(canvas, fr, dx, dy, side)
    im = Image.fromarray(canvas)
    im.alpha_composite(Image.fromarray(body), (dx, dy)) if dx >= 0 and dy >= 0 else None
    canvas = np.array(im)
    for L in front:
        L.over(canvas)
    if side != 'back':
        scythe(canvas, fr, dx, dy, side)
    return canvas


def build() -> dict[str, np.ndarray]:
    sheets = {}
    for clip in CLIPS:
        frames = clip_frames(clip)
        drawn = [compose(Frame(f, clip, i, len(frames))) for i, f in enumerate(frames)]
        sheets[clip] = np.concatenate(drawn, axis=1)
    return sheets


# ---- the skill effects -----------------------------------------------------------------------------------------------

def fx_reap() -> np.ndarray:
    # the scythe's sweep: a pale crescent opening across the cell, a ghost-green rim, fading in tatters
    n = 5
    a = blank(n)
    for f in range(n):
        span = [0.4, 0.75, 1.0, 1.0, 1.0][f]
        fade = [0, 0, 0, 1, 2][f]
        for r in range(16, 28):
            for t in np.linspace(-160, -160 + 210 * span, 240):
                ang = math.radians(t)
                x, y = 32 + math.cos(ang) * r, 36 + math.sin(ang) * r * 0.75
                e = r - 16
                c = 'F2F6F4' if e >= 9 else 'C8D8D4' if e >= 6 else '7E9A94' if e >= 3 else '3E524E'
                if fade and e < 4 * fade:
                    continue
                if fade == 2 and (int(t) // 6) % 3 == 0:
                    continue
                dot(a, f, x, y, c)
    return a


def fx_charge() -> np.ndarray:
    # hoofbeats: four hoofprints struck pale into the ground and a cold streak of the horse's passing
    n = 5
    a = blank(n)
    rng = np.random.default_rng(5)
    for f in range(n):
        for i in range(64):
            if (i + f * 4) % 10 < 7 - f and i < 64 - f * 8:
                dot(a, f, i, 40, 'C8D8D4')
                dot(a, f, i, 41, '7E9A94')
        for k in range(min(4, f + 1)):
            hx_, hy = 12 + k * 13, 46 + (k % 2) * 6
            fx_disc(a, f, hx_, hy, 3, 2, '3A3430')
            fx_disc(a, f, hx_, hy, 2, 1.2, '57524B')
        for _ in range(12):
            x, y = rng.uniform(0, 64), rng.uniform(34, 56)
            r = 1 + f * 0.8
            fx_disc(a, f, x, y, r, r * 0.6, 'B8B2A6' if f < 3 else '8A847A')
    return a


def fx_nails() -> np.ndarray:
    # an iron nail as long as a forearm driven down into the spot, the ground split round it
    n = 6
    a = blank(n)
    for f in range(n):
        tip = [14, 34, 54, 56, 56, 56][f]
        for y in range(max(0, tip - 26), tip):
            w = 2 if y < tip - 22 else 1 if y < tip - 3 else 0
            for dx in range(-w, w + 1):
                dot(a, f, 32 + dx, y, '9A9EA6' if dx < 0 else '5E626C' if dx > 0 else '7C808A')
        for dx in range(-4, 5):  # its head
            dot(a, f, 32 + dx, max(0, tip - 27), '6C7078')
            dot(a, f, 32 + dx, max(0, tip - 26), '9A9EA6')
        if f >= 2:
            for k in range(6):
                ang = math.radians(k * 60 + 15)
                for t in range(2, 3 + f * 2):
                    dot(a, f, 32 + math.cos(ang) * t, 56 + math.sin(ang) * t * 0.4, '2A2020')
            if f in (2, 3):
                for dx in range(-6, 7, 3):
                    dot(a, f, 32 + dx, 53 - abs(dx) // 2, 'F2F6F4')
        fx_ink(a, f)
    return a


def fx_knell() -> np.ndarray:
    # the bells: a bronze bell swinging, and rings of sound going out from it
    n = 6
    a = blank(n)
    for f in range(n):
        ang = math.sin(f * 1.3) * 0.4
        for dy in np.arange(0, 12, 0.5):
            w = 2 + int(dy) // 2
            for dx in np.arange(-w, w + 0.5, 0.5):
                x = 32 + dx * math.cos(ang) - dy * math.sin(ang)
                y = 20 + dy * math.cos(ang) + dx * math.sin(ang)
                dot(a, f, x, y, BRONZE if dx <= 0 else BRONZE_DARK)
        fx_ink(a, f)
        for k in range(3):
            r = 10 + f * 5 + k * 8
            if r < 34:
                fx_disc(a, f, 32, 28, r, r * 0.6, 'C8D8D4' if k == 0 else '7E9A94', hollow=0.88)
    return a


def fx_reins() -> np.ndarray:
    # the reins pulled: grave-hands rising out of the ground, pale and grasping, and sinking back
    n = 6
    a = blank(n)
    hands = [(20, 50, 0), (34, 54, 1), (46, 49, 2)]
    for f in range(n):
        rise = [3, 8, 13, 15, 12, 6][f]
        for hx_, hy, k in hands:
            h = rise - k
            if h <= 0:
                continue
            for y in range(hy - h, hy):  # the forearm
                for dx in (-1, 0, 1):
                    dot(a, f, hx_ + dx, y, 'C9C3B5' if dx < 1 else 'A69F91')
            for fi in range(4):  # the fingers
                fx_line(a, f, hx_ - 2 + fi * 1.3, hy - h, hx_ - 3 + fi * 2, hy - h - 4 - (fi % 2), 'E2DED2')
            fx_disc(a, f, hx_, hy, 5, 1.8, '2E2A26')
        fx_ink(a, f)
    return a


def grave_hands() -> Image.Image:
    """The hazard the reins leave (fixture:grave_hands, a 16x16 ground tile): pale hands reaching out of black earth."""
    p = np.zeros((16, 16, 4), np.uint8)

    def put(x, y, c):
        if 0 <= x < 16 and 0 <= y < 16:
            p[y, x] = (*hx(c), 255)
    for y in range(9, 15):
        for x in range(1, 15):
            if ((x - 7.5) / 7) ** 2 + ((y - 12) / 3) ** 2 <= 1:
                put(x, y, '2E2A26' if (x + y) % 3 else '3A342E')
    for (bx, by, h) in ((4, 12, 6), (9, 13, 8), (12, 11, 5)):
        for y in range(by - h, by):
            put(bx, y, 'C9C3B5')
            put(bx + 1, y, 'A69F91')
        for k in range(3):
            put(bx - 1 + k, by - h - 1, 'E2DED2')
            put(bx - 1 + k * 1, by - h - 2 - (k % 2), 'E2DED2')
    filled = p[..., 3] > 0
    for y in range(16):
        for x in range(16):
            if not filled[y, x] and any(0 <= x + dx < 16 and 0 <= y + dy < 16 and filled[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                put(x, y, INK)
    return Image.fromarray(p)


def effects(preview: Path | None) -> dict:
    out = {'reap': fx_reap(), 'charge': fx_charge(), 'nails': fx_nails(), 'knell': fx_knell(), 'reins': fx_reins()}
    write_effects('nacht', out, preview)
    grave_hands().save(FIXTURES / 'GraveHands.png')
    return out


if __name__ == '__main__':
    pv = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    sheets = build()
    write_strips('nacht', sheets, fw=NW, fh=NH, anchor=ANCHOR, fx_colors=['#F2F6F4', '#C8D8D4'], preview=pv,
                 note='the rider; the horse drawn here')
    e = effects(pv)
    print('Nacht →', 'public/assets/lsw/Bosses/nacht')
    for k, v in sheets.items():
        print(f'  {k}.png {v.shape[1]}x{v.shape[0]}')
    for k, v in e.items():
        print(f'  effect-{k}.png {v.shape[1]}x{v.shape[0]} ({v.shape[1] // FX} frames)')
