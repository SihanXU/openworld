"""Matthias the War-Giver, the Second Seal-bearer (docs/chapter-2.md §4): his boss strips drawn over Alberic's delivered ones.

Alberic's strips (public/assets/lsw/Bosses/alberic/boss01_01: idle, four walks, three attacks; 60x76 frames, the sole's anchor
at (30, 71) in every frame) are redrawn in Matthias's colours from the collaborator's portrait: the cream armour dark iron,
the cream skirt a blood-red tabard torn at the hem, the cape a dark crimson, the crown's spikes a larger halo of rust-gold
iron behind a dark red hood, iron chains across the body and one hanging from the belt, the gold slash arcs blood-red. Each
pixel is mapped by its colour and the band it lies in (head and body above the belt, the skirt below it, the feet): every
frame shares the anchor, so the bands are the same rows in all of them. Then his five skill effects, drawn here as strips
of 64x64 frames.

    python3 games/openworld/tools/src/art/matthias.py [preview-dir]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
SRC = ROOT / 'games/openworld/public/assets/lsw/Bosses/alberic/boss01_01'
OUT = ROOT / 'games/openworld/public/assets/lsw/Bosses/matthias'
DELIVERY = ROOT / 'packages/runtime/src/assets/boss01_01.json'
CLIPS = ['idle', 'walk_down', 'walk_up', 'walk_left', 'walk_right', 'attack_right', 'attack_left', 'attack_down']
FW, FH = 60, 76


def hx(s: str) -> tuple[int, int, int]:
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


# Alberic's palette by what it paints
CREAM = {'EDE1D2', 'E4DACD', 'DACDC1', 'C1B2A8', 'B6A59B', 'BDAC9C', '9D8C84', '897972'}
GOLD = {'F3B876', 'EEB16E', 'DBA161', 'CE9659', 'C48B5B', '9E8771', '81563E', '855137'}
CAPE = {'953737': '6E1A1E', '712B2C': '4A1013'}
OUTLINE = {'2A2020', '231B1C', '382020', '381F14', '3F1E12'}
BLADE = 'A6968D'
ARC = {'FFFFFF': 'FFE2E0', 'FFE9B0': 'E0484C', 'F3B876': '8E1A1E'}

# what each cream becomes: dark iron (armour, helm, boots) and the blood-red tabard (the skirt)
IRON = {'EDE1D2': '6F737E', 'E4DACD': '686C77', 'DACDC1': '5C606B', 'C1B2A8': '4C505B', 'B6A59B': '464A55',
        'BDAC9C': '434651', '9D8C84': '393C46', '897972': '30333C'}
TABARD = {'EDE1D2': 'B0302E', 'E4DACD': 'A82C2B', 'DACDC1': '8E1F21', 'C1B2A8': '6E161A', 'B6A59B': '6A1519',
          'BDAC9C': '5E1217', '9D8C84': '4A0E12', '897972': '4A0E12'}
RUST = {'F3B876': 'D49A50', 'EEB16E': 'C98E48', 'DBA161': 'B57A3C', 'CE9659': 'A36A34', 'C48B5B': '8F5A2C',
        '9E8771': '7A5A3E', '81563E': '5E3A26', '855137': '5A3420'}
STEEL, STEEL_LIGHT = '9AA1AB', 'CDD3DB'
HOOD, HOOD_DARK = '5A1418', '3E0D10'
LINK, LINK_DARK = 'C4C8D0', '7C808A'
HALO, HALO_TIP, HALO_DARK = 'C08A44', 'E6B864', '7A4E22'
INK = '2A2020'

SKIRT = (50, 64)  # the rows of the skirt, between the belt and the boots' outline


def key(p) -> str:
    return '%02X%02X%02X' % (p[0], p[1], p[2])


def put(a: np.ndarray, x: int, y: int, c: str, behind: bool = False) -> None:
    if 0 <= x < a.shape[1] and 0 <= y < a.shape[0] and (not behind or a[y, x, 3] == 0):
        a[y, x] = (*hx(c), 255)


def recolour(src: np.ndarray, fi: int, n: int, clip: str) -> np.ndarray:
    a = src.copy()
    h, w = a.shape[:2]
    keys = [[key(src[y, x]) if src[y, x, 3] else '' for x in range(w)] for y in range(h)]

    def near(x: int, y: int, ks: set[str], r: int = 1) -> bool:
        return any(0 <= x + dx < w and 0 <= y + dy < h and keys[y + dy][x + dx] in ks
                   for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dx or dy)

    # the head: the crown's gold above the shoulders
    crown = [(x, y) for y in range(h) for x in range(w) if keys[y][x] in GOLD and y <= 29]
    top = min(y for _, y in crown)
    cx = round(sum(x for x, _ in crown) / len(crown))
    for y in range(h):
        for x in range(w):
            k = keys[y][x]
            if not k:
                continue
            if k in ARC and near(x, y, {'FFFFFF', 'FFE9B0'}, 2):
                put(a, x, y, ARC[k])
            elif k == BLADE:
                put(a, x, y, STEEL)
            elif k in CREAM and (near(x, y, {BLADE}) and k in {'DACDC1', 'C1B2A8'} and abs(y - SKIRT[0]) < 30
                                 and (x + 1 < w and keys[y][x + 1] == BLADE or x > 0 and keys[y][x - 1] == BLADE)):
                put(a, x, y, STEEL_LIGHT)  # the blade's lit edge beside its grey
            elif k in CREAM:
                put(a, x, y, TABARD[k] if SKIRT[0] <= y <= SKIRT[1] else IRON[k])
            elif k in GOLD:
                if y <= top + 2:
                    put(a, x, y, RUST[k])  # the crown's points: the halo's foot
                elif y <= 29:
                    put(a, x, y, HOOD if k in {'F3B876', 'EEB16E', 'DBA161', 'CE9659'} else HOOD_DARK)  # the crown's band: the hood's crown
                else:
                    put(a, x, y, RUST[k])
            elif k in CAPE:
                put(a, x, y, CAPE[k])

    # the hood: the helm's sides wrapped in dark red, a pixel out
    for y in range(top + 3, top + 17):
        row = [x for x in range(max(0, cx - 9), min(w, cx + 10)) if keys[y][x] in CREAM or keys[y][x] in GOLD]
        if not row:
            continue
        l, r = min(row), max(row)
        if r - l < 4:
            continue
        across = y <= top + 5
        for x in range(l, r + 1):
            if across or x - l < 3 or r - x < 3:
                put(a, x, y, HOOD_DARK if x in (l, r) or (across and y == top + 3) else HOOD)
        if y <= top + 12:
            put(a, l - 1, y, INK, behind=True)
            put(a, r + 1, y, INK, behind=True)

    # the halo: iron spikes round the head, behind everything
    hy = top + 8
    for i in range(72):  # the ring behind the head
        ang = math.radians(i * 5)
        put(a, round(cx + math.cos(ang) * 9), round(hy + math.sin(ang) * 9), HALO_DARK, behind=True)
        put(a, round(cx + math.cos(ang) * 8), round(hy + math.sin(ang) * 8), HALO, behind=True)
    for i in range(13):  # its spikes, long and short by turns, over the top and down the sides
        ang = math.radians(-198 + i * 18)
        r1 = 16 if i % 2 == 0 else 13
        for t in np.linspace(9, r1, 16):
            x, y = round(cx + math.cos(ang) * t), round(hy + math.sin(ang) * t)
            put(a, x, y, HALO_TIP if t > r1 - 2 else HALO, behind=True)
            if t < r1 - 3:
                put(a, x + (1 if math.cos(ang) <= 0 else -1), y, HALO_DARK, behind=True)

    # a chain across the body from shoulder to hip, over what is drawn there
    body = lambda x, y: src[y, x, 3] and keys[y][x] not in OUTLINE and keys[y][x] not in ARC
    side = clip.endswith('left') or clip.endswith('right')
    (x0, y0), (x1, y1) = ((cx - 4, 37), (cx + 5, 48)) if side else ((cx - 9, 31), (cx + 8, 47))
    steps = max(abs(x1 - x0), abs(y1 - y0))
    for s in range(steps + 1):
        x, y = round(x0 + (x1 - x0) * s / steps), round(y0 + (y1 - y0) * s / steps)
        if 0 <= x < w and 0 <= y < h and body(x, y):
            put(a, x, y, LINK if s % 2 == 0 else LINK_DARK)
            if body(x, y + 1) and s % 2 == 0:
                put(a, x, y + 1, INK)

    # a length of chain hanging from the belt on his left (the viewer's right), swinging as he moves
    sway = round(math.sin(fi / n * 2 * math.pi)) if not clip.startswith('attack') else 0
    belt = [x for x in range(w) if src[SKIRT[0] - 1, x, 3] and keys[SKIRT[0] - 1][x] not in OUTLINE]
    if belt:
        hx0 = max(belt) + (0 if side else -2)
        for y in range(SKIRT[0] - 1, 69):
            x = hx0 + (sway if y > 58 else 0) + (1 if (y // 2) % 2 else 0)
            put(a, x, y, LINK if y % 2 == 0 else LINK_DARK)
            put(a, x + 1, y, INK, behind=True)

    # the tabard torn at the hem: notches where the hash says
    for x in range(w):
        y = SKIRT[1]
        if keys[y][x] in CREAM and (x * 7 + fi * 0 + 3) % 5 == 0 and keys[y + 1][x] in OUTLINE:
            put(a, x, y, INK)
            if keys[y - 1][x] in CREAM:
                put(a, x, y - 1, TABARD['9D8C84'])
    return a


def strips(preview: Path | None) -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = json.loads(DELIVERY.read_text())
    sheets = {}
    for clip in CLIPS:
        im = np.array(Image.open(SRC / f'{clip}.png').convert('RGBA'))
        n = im.shape[1] // FW
        frames = [recolour(im[:, i * FW:(i + 1) * FW], i, n, clip) for i in range(n)]
        sheet = np.concatenate(frames, axis=1)
        Image.fromarray(sheet).save(OUT / f'{clip}.png')
        sheets[clip] = sheet
    meta['source'] = 'derived from alberic/boss01_01 by games/openworld/tools/src/art/matthias.py'
    meta['palette'] = sorted({key(p) for s in sheets.values() for p in s.reshape(-1, 4) if p[3]})
    meta['fx_colors'] = ['#FFE2E0', '#E0484C']
    for clip in meta['animations'].values():
        clip.pop('preview_gif', None)
        clip.pop('frame_files', None)
    (OUT / 'matthias.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    if preview:
        rows = [sheets[c] for c in CLIPS]
        wmax = max(r.shape[1] for r in rows)
        canvas = np.zeros((FH * len(rows), wmax, 4), np.uint8)
        canvas[..., :3] = (58, 58, 72)
        canvas[..., 3] = 255
        for i, r in enumerate(rows):
            im = Image.fromarray(canvas)
            im.alpha_composite(Image.fromarray(r), (0, i * FH))
            canvas = np.array(im)
        Image.fromarray(canvas).resize((wmax * 3, FH * len(rows) * 3), Image.NEAREST).save(preview / 'matthias_strips.png')
    return sheets


# ---- the skill effects: 64x64 frames in a strip -------------------------------------------------------------------

FX = 64


def blank(n: int) -> np.ndarray:
    return np.zeros((FX, FX * n, 4), np.uint8)


def dot(a: np.ndarray, f: int, x: float, y: float, c: str, alpha: int = 255) -> None:
    xi, yi = round(x), round(y)
    if 0 <= xi < FX and 0 <= yi < FX:
        a[yi, f * FX + xi] = (*hx(c), alpha)


def fx_sword() -> np.ndarray:
    # a heavy sweep: an arc of red steel opening across the frame and fading, a dark edge behind its bright one
    n = 5
    a = blank(n)
    for f in range(n):
        span = [0.45, 0.8, 1.0, 1.0, 1.0][f]
        fade = [0, 0, 0, 1, 2][f]
        for r in range(18, 29):
            for t in np.linspace(-150, -150 + 200 * span, 220):
                ang = math.radians(t)
                x, y = 32 + math.cos(ang) * r, 34 + math.sin(ang) * r * 0.8
                edge = r - 18
                c = 'FFE2E0' if edge >= 9 else 'E0484C' if edge >= 6 else 'A82C2B' if edge >= 3 else '5E1217'
                if fade and edge < 3 * fade:
                    continue
                if fade == 2 and (int(t) // 7) % 3 == 0:
                    continue
                dot(a, f, x, y, c)
    return a


def fx_lash() -> np.ndarray:
    # a length of chain whipping down onto the cell and the red crack where it lands: no direction of its own, so it serves
    # every cell of the cross it is played on
    n = 5
    a = blank(n)
    for f in range(n):
        tip = [22, 44, 54, 54, 54][f]
        if f <= 3:
            for y in range(4, tip):
                x = 32 + math.sin((y + f * 5) / 6) * (5 - f) * (1 - y / 64)
                if f == 3 and y % 3 == 0:
                    continue
                link = (y // 3) % 2 == 0
                dot(a, f, x - 1, y, INK if link else LINK_DARK)
                dot(a, f, x, y, LINK if link else LINK_DARK)
                dot(a, f, x + 1, y, LINK_DARK if link else INK)
        if f >= 2:
            r = [0, 0, 5, 9, 11][f]
            for k in range(10):
                ang = math.radians(k * 36 + f * 7)
                for t in range(1, r):
                    if f == 4 and t < r - 4:
                        continue
                    dot(a, f, 32 + math.cos(ang) * t, 54 + math.sin(ang) * t * 0.45, 'FFE2E0' if t < 3 and f == 2 else 'E0484C' if t < r - 2 else '8E1F21')
    return a


def fx_charge() -> np.ndarray:
    # dust thrown up behind and a red streak where he went
    n = 5
    a = blank(n)
    rng = np.random.default_rng(7)
    puffs = [(rng.uniform(4, 60), rng.uniform(30, 54), rng.uniform(2, 5)) for _ in range(14)]
    for f in range(n):
        for i in range(64):
            if i < 64 - f * 10:
                for dy in (-1, 0, 1):
                    c = 'E0484C' if dy == 0 else 'A82C2B'
                    if (i + f * 3) % 9 < 6 - f:
                        dot(a, f, i, 40 + dy, c)
        for (px, py, pr) in puffs:
            r = pr + f * 1.2
            for yy in range(-8, 9):
                for xx in range(-9, 10):
                    e = (xx / r) ** 2 + (yy / (r * 0.6)) ** 2
                    if e <= 1 and (f < 4 or (xx + yy) % 2):
                        dot(a, f, px + xx, py + yy, ('C8AE96' if yy < 0 else 'A08670') if f < 3 else '8A7462')
    return a


def fx_threads() -> np.ndarray:
    # a thread of red light drawn down onto the spot, a flare where it strikes
    n = 6
    a = blank(n)
    for f in range(n):
        tip = [18, 40, 58, 58, 58, 58][f]
        width = [0, 0, 1, 2, 1, 0][f]
        for y in range(0, tip):
            x = 32 + math.sin(y / 6 + f) * (2 if f < 3 else 0)
            for dx in range(-width, width + 1):
                dot(a, f, x + dx, y, 'FFE2E0' if dx == 0 and f in (2, 3) else 'E0484C')
        if f >= 2:
            r = [0, 0, 3, 7, 10, 12][f]
            for t in range(0, 360, 8):
                ang = math.radians(t)
                dot(a, f, 32 + math.cos(ang) * r, 58 + math.sin(ang) * r * 0.4, 'E0484C' if f < 5 else '8E1F21')
            if f in (2, 3):
                for dx in range(-3, 4):
                    dot(a, f, 32 + dx, 58, 'FFE2E0')
    return a


def fx_post() -> np.ndarray:
    # a ring of chains whipping out from the centre and falling
    n = 6
    a = blank(n)
    for f in range(n):
        r = [6, 12, 18, 24, 27, 28][f]
        for k in range(8):
            base = math.radians(k * 45 + f * 6)
            for t in range(4, r):
                bend = math.sin(t / 5) * 0.12
                x, y = 32 + math.cos(base + bend) * t, 32 + math.sin(base + bend) * t * 0.7
                if f == 5 and t % 6 < 2:
                    continue
                link = (t // 3) % 2 == 0
                dot(a, f, x, y, LINK if link else LINK_DARK)
                dot(a, f, x + 1, y, LINK_DARK)
                dot(a, f, x, y + 1, INK)
                dot(a, f, x + 1, y + 1, INK)
            ex, ey = 32 + math.cos(base) * r, 32 + math.sin(base) * r * 0.7
            if f >= 2:
                for d in range(3):
                    dot(a, f, ex + d - 1, ey, 'E0484C')
    return a


def effects(preview: Path | None) -> dict:
    out = {'sword': fx_sword(), 'lash': fx_lash(), 'charge': fx_charge(), 'threads': fx_threads(), 'post': fx_post()}
    for k, a in out.items():
        Image.fromarray(a).save(OUT / f'effect-{k}.png')
    if preview:
        rows = list(out.values())
        wmax = max(r.shape[1] for r in rows)
        canvas = Image.new('RGBA', (wmax, FX * len(rows)), (58, 58, 72, 255))
        for i, r in enumerate(rows):
            canvas.alpha_composite(Image.fromarray(r), (0, i * FX))
        canvas.resize((wmax * 3, FX * len(rows) * 3), Image.NEAREST).save(preview / 'matthias_fx.png')
    return out


if __name__ == '__main__':
    pv = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    s = strips(pv)
    e = effects(pv)
    print('Matthias →', OUT)
    for k, v in s.items():
        print(f'  {k}.png {v.shape[1]}x{v.shape[0]} ({v.shape[1] // FW} frames)')
    for k, v in e.items():
        print(f'  effect-{k}.png {v.shape[1]}x{v.shape[0]} ({v.shape[1] // FX} frames)')
