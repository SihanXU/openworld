"""The bases every part is drawn on (docs/looks.md §4): four full figures — the woman, the man, the girl and the
boy — each with its own head and face, bald, in a plain grey top and shorts, barefoot, standing on one line.

A base is drawn whole by an edit (parts.py), never pasted from another's head: a man has his own face, so every
head part (hair, faces, hats, beards, glasses, marks) is drawn on each body it is for. What lies below the soles
is ground, never the figure: the model likes to draw a shadow there, and `ground` clears it.
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image

from extract import background, figure, load


def soles(fig: np.ndarray) -> int:
    """The lowest row of a figure: where its feet stand."""
    rows = np.nonzero(fig.any(axis=1))[0]
    return int(rows.max()) if len(rows) else fig.shape[0] - 1


def feet_row(img: np.ndarray, bg: np.ndarray) -> int:
    """Where the feet stand, not counting a shadow: the lowest row with skin or a line narrower than the stance.

    A shadow is wide and flat; the feet are two narrow shapes. Going up from the bottom, the first row whose
    figure is no wider than the figure a tenth of the height above it is the soles' row."""
    fig = figure(img, bg)
    h = fig.shape[0]
    rows = np.nonzero(fig.any(axis=1))[0]
    if not len(rows):
        return h - 1
    top, bottom = int(rows.min()), int(rows.max())
    probe = bottom - (bottom - top) // 12
    ref = fig[probe].sum() * 1.6 + 6
    y = bottom
    while y > probe and fig[y].sum() > ref:
        y -= 1
    return y


def ground(img: np.ndarray, bg: np.ndarray, below: int, margin: int = 3) -> np.ndarray:
    """The picture with everything below a row (and a margin) painted the background: no ground under anyone."""
    out = img.copy()
    out[below + margin + 1 :] = bg
    return out


def prepare(root: str) -> None:
    """Clear the ground under every base drawn (once: the base is rewritten in place and marked done)."""
    for body in ("woman", "man", "girl", "boy"):
        p = os.path.join(root, "lib", f"base-{body}.png")
        done = p + ".clean"
        if not os.path.exists(p) or os.path.exists(done):
            continue
        img = load(p)
        bg = background(img)
        y = feet_row(img, bg)
        Image.fromarray(np.clip(ground(img, bg, y), 0, 255).astype(np.uint8)).save(p)
        open(done, "w").close()
        print(f"cleared the ground under the {body} (soles at {y})", flush=True)
