"""What the strip bosses drawn over Alberic's delivered strips share (tools/src/art/matthias.py began it; ele.py, nacht.py,
witnesses.py and astra.py use this): the delivery's frames read, his palette by what it paints, where his head and his
sword are in each frame, drawing in front of or behind what is there, the strips and their json written, the 64x64
effect strips and the preview sheets.

Alberic's strips (public/assets/lsw/Bosses/alberic/boss01_01: idle, four walks, three attacks; 60x76 frames, the sole's
anchor at (30, 71) in every frame) keep their frames, timings and hit frames in every boss drawn over them, so the runtime
plays them all alike (packages/runtime/src/assets/bosses.ts STRIP_BOSSES).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
SRC = ROOT / 'games/openworld/public/assets/lsw/Bosses/alberic/boss01_01'
BOSSES = ROOT / 'games/openworld/public/assets/lsw/Bosses'
FIXTURES = ROOT / 'games/openworld/public/assets/lsw/Fixtures'
DELIVERY = ROOT / 'packages/runtime/src/assets/boss01_01.json'
CLIPS = ['idle', 'walk_down', 'walk_up', 'walk_left', 'walk_right', 'attack_right', 'attack_left', 'attack_down']
FW, FH = 60, 76
ANCHOR = (30, 71)

# Alberic's palette by what it paints
CREAM = ['EDE1D2', 'E4DACD', 'DACDC1', 'C1B2A8', 'B6A59B', 'BDAC9C', '9D8C84', '897972']  # light to dark
GOLD = ['F3B876', 'EEB16E', 'DBA161', 'CE9659', 'C48B5B', '9E8771', '81563E', '855137']
CAPE = ['953737', '712B2C']
OUTLINE = {'2A2020', '231B1C', '382020', '381F14', '3F1E12'}
BLADE = 'A6968D'
ARC = ['FFFFFF', 'FFE9B0', 'F3B876']
INK = '2A2020'
SKIRT = (50, 64)  # the skirt's rows, between the belt and the boots' outline


def hx(s: str) -> tuple[int, int, int]:
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def key(p) -> str:
    return '%02X%02X%02X' % (int(p[0]), int(p[1]), int(p[2]))


def clip_frames(clip: str) -> list[np.ndarray]:
    im = np.array(Image.open(SRC / f'{clip}.png').convert('RGBA'))
    return [im[:, i * FW:(i + 1) * FW].copy() for i in range(im.shape[1] // FW)]


def side_of(clip: str) -> str:
    """'front', 'back', 'left' or 'right': which way the frame faces."""
    if clip.endswith('left'):
        return 'left'
    if clip.endswith('right'):
        return 'right'
    return 'back' if clip == 'walk_up' else 'front'


class Frame:
    """One of Alberic's frames being drawn over: `src` as delivered, `a` the picture, `keys` each pixel's colour."""

    def __init__(self, src: np.ndarray, clip: str, index: int, count: int):
        self.src, self.a = src, src.copy()
        self.h, self.w = src.shape[:2]
        self.clip, self.i, self.n = clip, index, count
        self.side = side_of(clip)
        self.keys = [[key(src[y, x]) if src[y, x, 3] else '' for x in range(self.w)] for y in range(self.h)]
        crown = [(x, y) for y in range(self.h) for x in range(self.w) if self.keys[y][x] in GOLD and y <= 29]
        self.top = min(y for _, y in crown)
        self.cx = round(sum(x for x, _ in crown) / len(crown))

    # -- reading
    def k(self, x: int, y: int) -> str:
        return self.keys[y][x] if 0 <= x < self.w and 0 <= y < self.h else ''

    def near(self, x: int, y: int, ks, r: int = 1) -> bool:
        return any(self.k(x + dx, y + dy) in ks for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dx or dy)

    def body(self, x: int, y: int) -> bool:
        """Drawn, and not outline or the swing's arc: a surface of the figure."""
        k = self.k(x, y)
        return bool(k) and k not in OUTLINE and k not in ARC

    def filled(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3] > 0

    def is_arc(self, x: int, y: int) -> bool:
        return self.k(x, y) in ARC and self.near(x, y, {'FFFFFF', 'FFE9B0'}, 2)

    def helm(self) -> list[tuple[int, int]]:
        """The helm's pixels: the cream of the head between the crown's band and the shoulders."""
        out = []
        for y in range(self.top + 3, min(self.h, self.top + 16)):
            for x in range(max(0, self.cx - 8), min(self.w, self.cx + 9)):
                if self.k(x, y) in CREAM or (self.k(x, y) in OUTLINE and self.near(x, y, set(CREAM)) and self.inside_helm(x, y)):
                    out.append((x, y))
        return out

    def inside_helm(self, x: int, y: int) -> bool:
        row = [xx for xx in range(max(0, self.cx - 8), min(self.w, self.cx + 9)) if self.k(xx, y) in CREAM]
        return bool(row) and min(row) < x < max(row)

    def blade(self) -> tuple[tuple[float, float], tuple[float, float]] | None:
        """The sword's axis in this frame: its hilt end and its point (the end nearer the body is the hilt)."""
        pts = np.array([(x, y) for y in range(self.h) for x in range(self.w) if self.k(x, y) == BLADE], float)
        if len(pts) < 8:
            return None
        c = pts.mean(axis=0)
        u, s, vt = np.linalg.svd(pts - c)
        d = vt[0]
        t = (pts - c) @ d
        e0, e1 = c + d * t.min(), c + d * t.max()
        body = np.array([self.cx, 45.0])
        hilt, tip = (e0, e1) if np.linalg.norm(e0 - body) < np.linalg.norm(e1 - body) else (e1, e0)
        return (float(hilt[0]), float(hilt[1])), (float(tip[0]), float(tip[1]))

    # -- drawing
    def put(self, x: float, y: float, c: str, behind: bool = False) -> None:
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < self.w and 0 <= yi < self.h and (not behind or self.a[yi, xi, 3] == 0):
            self.a[yi, xi] = (*hx(c), 255)

    def clear(self, x: int, y: int) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = 0

    def line(self, x0: float, y0: float, x1: float, y1: float, c: str, behind: bool = False) -> list[tuple[int, int]]:
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        done = []
        for s in range(n + 1):
            x, y = int(round(x0 + (x1 - x0) * s / n)), int(round(y0 + (y1 - y0) * s / n))
            if (x, y) not in done:
                self.put(x, y, c, behind)
                done.append((x, y))
        return done

    def ink_round(self, pts, behind: bool = True) -> None:
        """An outline round the pixels `pts`, where nothing is drawn yet."""
        s = set(pts)
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in s:
                    self.put(x + dx, y + dy, INK, behind=behind)


def ring(fr: Frame, cx: float, cy: float, r: float, c: str, squash: float = 1.0, behind: bool = True, step: float = 3) -> None:
    for i in range(int(360 / step)):
        ang = math.radians(i * step)
        fr.put(cx + math.cos(ang) * r, cy + math.sin(ang) * r * squash, c, behind)


def recolour_map(fr: Frame, maps: dict[str, dict[str, str]], skirt: dict[str, str] | None = None) -> None:
    """Every pixel whose colour a map names takes its new one (`skirt` for the cream below the belt)."""
    for y in range(fr.h):
        for x in range(fr.w):
            k = fr.keys[y][x]
            if not k:
                continue
            if skirt and k in skirt and SKIRT[0] <= y <= SKIRT[1]:
                fr.put(x, y, skirt[k])
                continue
            for m in maps.values():
                if k in m:
                    fr.put(x, y, m[k])
                    break


def shades(colours: list[str], of: list[str] = CREAM) -> dict[str, str]:
    """Alberic's shades of a colour (light to dark) to new ones, as many as given (the last repeated)."""
    return {k: colours[min(i, len(colours) - 1)] for i, k in enumerate(of)}


def write_strips(name: str, sheets: dict[str, np.ndarray], fw: int = FW, fh: int = FH, anchor=ANCHOR, fx_colors=None,
                 preview: Path | None = None, note: str = '') -> None:
    out = BOSSES / name
    out.mkdir(parents=True, exist_ok=True)
    for clip, sheet in sheets.items():
        Image.fromarray(sheet).save(out / f'{clip}.png')
    meta = json.loads(DELIVERY.read_text())
    meta['source'] = f'derived from alberic/boss01_01 by games/openworld/tools/src/art/{name}.py' + (f' ({note})' if note else '')
    meta['canvas'] = [fw, fh]
    meta['anchor'] = list(anchor)
    meta['anchor_note'] = 'the sole (or hoof) line, the same in every frame of every clip'
    meta['palette'] = sorted({key(p) for s in sheets.values() for p in s.reshape(-1, 4) if p[3]})
    if fx_colors:
        meta['fx_colors'] = fx_colors
    for clip in meta['animations'].values():
        clip.pop('preview_gif', None)
        clip.pop('frame_files', None)
        clip['frame_w'], clip['frame_h'] = fw, fh
    (out / f'{name}.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    if preview:
        rows = [sheets[c] for c in CLIPS]
        wmax = max(r.shape[1] for r in rows)
        canvas = Image.new('RGBA', (wmax, fh * len(rows)), (58, 58, 72, 255))
        for i, r in enumerate(rows):
            canvas.alpha_composite(Image.fromarray(r), (0, i * fh))
        canvas.resize((wmax * 3, fh * len(rows) * 3), Image.NEAREST).save(preview / f'{name}_strips.png')


# ---- the skill effects: 64x64 frames in a strip -------------------------------------------------------------------

FX = 64


def blank(n: int) -> np.ndarray:
    return np.zeros((FX, FX * n, 4), np.uint8)


def dot(a: np.ndarray, f: int, x: float, y: float, c: str, alpha: int = 255) -> None:
    xi, yi = int(round(x)), int(round(y))
    if 0 <= xi < FX and 0 <= yi < FX:
        a[yi, f * FX + xi] = (*hx(c), alpha)


def fx_line(a: np.ndarray, f: int, x0: float, y0: float, x1: float, y1: float, c: str) -> None:
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for s in range(n + 1):
        dot(a, f, x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, c)


def fx_disc(a: np.ndarray, f: int, cx: float, cy: float, rx: float, ry: float, c: str, hollow: float = 0) -> None:
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            e = ((x - cx) / max(rx, 0.01)) ** 2 + ((y - cy) / max(ry, 0.01)) ** 2
            if e <= 1 and e >= hollow:
                dot(a, f, x, y, c)


def fx_ink(a: np.ndarray, f: int, colour: str = INK) -> None:
    """An outline round what one frame holds, where it is empty."""
    sub = a[:, f * FX:(f + 1) * FX]
    filled = sub[..., 3] > 0
    for y in range(FX):
        for x in range(FX):
            if not filled[y, x] and any(0 <= x + dx < FX and 0 <= y + dy < FX and filled[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                dot(a, f, x, y, colour)


def write_effects(name: str, effects: dict[str, np.ndarray], preview: Path | None = None) -> None:
    out = BOSSES / name
    out.mkdir(parents=True, exist_ok=True)
    for k, a in effects.items():
        Image.fromarray(a).save(out / f'effect-{k}.png')
    if preview:
        rows = list(effects.values())
        wmax = max(r.shape[1] for r in rows)
        canvas = Image.new('RGBA', (wmax, FX * len(rows)), (58, 58, 72, 255))
        for i, r in enumerate(rows):
            canvas.alpha_composite(Image.fromarray(r), (0, i * FX))
        canvas.resize((wmax * 3, FX * len(rows) * 3), Image.NEAREST).save(preview / f'{name}_fx.png')


def build(name: str, draw, fw: int = FW, fh: int = FH) -> dict[str, np.ndarray]:
    """Every clip's frames drawn by `draw(frame) -> picture` and joined into strips."""
    sheets = {}
    for clip in CLIPS:
        frames = clip_frames(clip)
        drawn = [draw(Frame(f, clip, i, len(frames))) for i, f in enumerate(frames)]
        sheets[clip] = np.concatenate(drawn, axis=1)
        assert sheets[clip].shape[0] == fh and sheets[clip].shape[1] == fw * len(frames), (clip, sheets[clip].shape)
    return sheets


def erase_blade(fr: Frame, inside_colour) -> None:
    """The sword gone: where it lies over the figure its pixels take `inside_colour(key)`; where it stands out from the
    figure it and its outline are cleared."""
    blade = {(x, y) for y in range(fr.h) for x in range(fr.w)
             if fr.k(x, y) == BLADE or (fr.k(x, y) in ('DACDC1', 'C1B2A8') and (fr.k(x + 1, y) == BLADE or fr.k(x - 1, y) == BLADE))}
    cleared = set()
    for (x, y) in blade:
        left = any(fr.k(x - d, y) in CREAM and (x - d, y) not in blade for d in (1, 2, 3))
        right = any(fr.k(x + d, y) in CREAM and (x + d, y) not in blade for d in (1, 2, 3))
        if left and right:
            fr.put(x, y, inside_colour(fr.k(x, y)))
        else:
            fr.clear(x, y)
            cleared.add((x, y))
    for y in range(fr.h):
        for x in range(fr.w):
            if fr.k(x, y) in OUTLINE and fr.filled(x, y) and any((x + dx, y + dy) in cleared for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                if not any(fr.filled(x + dx, y + dy) and fr.k(x + dx, y + dy) not in OUTLINE and (x + dx, y + dy) not in cleared
                           for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy):
                    fr.clear(x, y)
