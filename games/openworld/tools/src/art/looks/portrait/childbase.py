"""A child's base from a drawing of the child at full frame height (docs/looks.md §4): the model draws a child as tall
as the frame whatever it is told, so the drawing is scaled down to the child's height, its soles on the line the
adults' stand on, on the same flat ground. The children's bases of 2026-10-26 (the user's choice, "自然的孩子") are
the trial's `natural-girl-0` and `natural-boy-0` at 0.74.

    python -I childbase.py <drawing.png> <adult base.png> <out.png> [scale]
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from bases import feet_row  # noqa: E402
from extract import background, figure, load  # noqa: E402
from scipy import ndimage as ndi  # noqa: E402


def child(drawing: str, adult: str, out: str, scale: float = 0.74) -> None:
    img = load(drawing)
    bg = background(img)
    soles = feet_row(img, bg)
    base = load(adult)
    ground = background(base)
    target = feet_row(base, ground)
    # the figure alone (its outline closed and filled, a pixel of feather), on the adults' own flat ground: the
    # drawing's paper is a shade off theirs and showed as a box
    fig = ndi.binary_fill_holes(ndi.binary_closing(figure(img, bg), iterations=2)) & (np.arange(img.shape[0])[:, None] <= soles + 2)
    alpha = np.clip(ndi.gaussian_filter(ndi.binary_dilation(fig, iterations=1).astype(np.float32), 0.7), 0, 1)[..., None]
    flat = img * alpha + ground * (1 - alpha)
    h, w = img.shape[:2]
    small = Image.fromarray(np.clip(flat, 0, 255).astype(np.uint8)).resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    a = np.asarray(small).astype(np.float32)
    canvas = np.tile(ground, (h, w, 1)).astype(np.float32)
    # the soles of the scaled drawing on the adults' line, the figure centred
    x0, y0 = (w - small.width) // 2, target - round(soles * scale)
    canvas[max(0, y0) : y0 + small.height, x0 : x0 + small.width] = a[max(0, -y0) : min(small.height, h - y0)]
    Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).save(out)


if __name__ == "__main__":
    a = sys.argv[1:]
    child(a[0], a[1], a[2], float(a[3]) if len(a) > 3 else 0.74)
