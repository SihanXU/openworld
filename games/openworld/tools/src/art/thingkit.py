"""What the later chapters' small pictures share (chapter4.py, chapter5.py, finale.py): a picture drawn pixel by pixel in
hex colours, lines, boxes and lit ellipses, the pack's dark outline put round it afterwards, and a preview sheet of every
picture on a ground colour, enlarged.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
ITEMS = ROOT / 'games/openworld/public/assets/lsw/Items'
FIXTURES = ROOT / 'games/openworld/public/assets/lsw/Fixtures'
INK = '2A2020'


def rgba(h: str, a: int = 255) -> tuple[int, int, int, int]:
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


class Pic:
    def __init__(self, w: int, h: int):
        self.a = np.zeros((h, w, 4), np.uint8)
        self.w, self.h = w, h

    def put(self, x: float, y: float, c: str, a: int = 255) -> None:
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < self.w and 0 <= yi < self.h:
            if a >= 255 or self.a[yi, xi, 3] == 0:
                self.a[yi, xi] = rgba(c, a)
            else:  # a see-through colour laid over what is there
                src = np.array(rgba(c), float)
                dst = self.a[yi, xi].astype(float)
                t = a / 255
                self.a[yi, xi, :3] = (src[:3] * t + dst[:3] * (1 - t)).astype(np.uint8)

    def get(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3] > 0

    def line(self, x0: float, y0: float, x1: float, y1: float, c: str, a: int = 255) -> None:
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for s in range(n + 1):
            self.put(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, c, a)

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: str, a: int = 255) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, c, a)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, shade, a: int = 255) -> None:
        """A filled ellipse, each pixel's colour `shade(u, v)` by where it lies in it (u, v in -1..1)."""
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (x - cx) / rx, (y - cy) / ry
                if u * u + v * v <= 1:
                    c = shade(u, v)
                    if c:
                        self.put(x, y, c, a)

    def ring(self, cx: float, cy: float, rx: float, ry: float, c: str, a: int = 255) -> None:
        n = int(max(rx, ry) * 8) + 8
        import math
        for s in range(n):
            t = 2 * math.pi * s / n
            self.put(cx + rx * math.cos(t), cy + ry * math.sin(t), c, a)

    def outline(self, c: str = INK, skip=None) -> None:
        """The pack's dark outline round everything drawn (but where `skip(x, y)` says not: a ground's open edge)."""
        filled = self.a[..., 3] > 0
        out = []
        for y in range(self.h):
            for x in range(self.w):
                if filled[y, x] or (skip and skip(x, y)):
                    continue
                if any(0 <= x + dx < self.w and 0 <= y + dy < self.h and filled[y + dy, x + dx] and self.a[y + dy, x + dx, 3] > 200 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.append((x, y))
        for x, y in out:
            self.put(x, y, c)

    def save(self, path: Path) -> None:
        Image.fromarray(self.a).save(path)


def lit(u: float, v: float, light: str, mid: str, dark: str, bias: float = 0) -> str:
    """Three shades by the light from the top left."""
    d = u * 0.6 + v * 0.8 + bias
    return light if d < -0.35 else mid if d < 0.45 else dark


def write(icons: dict, fixtures: dict) -> dict[str, Pic]:
    pics: dict[str, Pic] = {}
    for name, f in icons.items():
        pics[name] = f()
        pics[name].save(ITEMS / f'{name}.png')
    for name, f in fixtures.items():
        pics[name] = f()
        pics[name].save(FIXTURES / f'{name}.png')
    for name, pic in pics.items():
        print(f'  {name}.png {pic.w}x{pic.h}')
    return pics


def preview(pics: dict[str, Pic], path: Path, ground=(150, 142, 120, 255), scale: int = 5) -> None:
    H = max(pic.h for pic in pics.values()) + 8
    W = sum(pic.w + 6 for pic in pics.values()) + 6
    canvas = Image.new('RGBA', (W, H), ground)
    x = 6
    for pic in pics.values():
        canvas.alpha_composite(Image.fromarray(pic.a), (x, H - pic.h - 4))
        x += pic.w + 6
    canvas.resize((canvas.width * scale, canvas.height * scale), Image.NEAREST).save(path)
