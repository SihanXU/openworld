"""The bases every part is drawn on (docs/looks.md §4). A man's (a boy's) base is the woman's (the girl's) head on
his own body: the edit draws the body, and the head is pasted back exactly, so one set of head parts fits both."""

from __future__ import annotations

import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from extract import background, figure, load

# whose head each raw body takes
HEAD_OF = {"base-man": "base-woman", "base-boy": "base-girl"}


def neck_row(fig: np.ndarray) -> int:
    """The neck: the narrowest row of the figure between its head and its shoulders."""
    widths = fig.sum(axis=1)
    top = int(np.argmax(widths > 0))
    lo, hi = top + int(0.25 * (1024 - top)), top + int(0.75 * (1024 - top))
    band = widths[lo:hi]
    return lo + int(np.argmin(np.where(band > 0, band, 9999)))


def composite(head_path: str, raw_path: str, out_path: str) -> None:
    head = load(head_path)
    raw = load(raw_path)
    bg = background(head)
    fig = figure(head, bg)
    y = neck_row(fig)
    # the head's own pixels above the neck (and the background round it), blended over twelve rows into the body
    w = np.zeros(head.shape[:2], np.float32)
    w[: y - 6] = 1.0
    for k in range(12):
        w[y - 6 + k] = 1.0 - (k + 1) / 13
    w = ndi.gaussian_filter(w, 1.5)
    out = head * w[..., None] + raw * (1 - w[..., None])
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(out_path)


def prepare(root: str) -> None:
    """Make every composite base whose raw body is drawn and whose head exists."""
    for name, head in HEAD_OF.items():
        out = os.path.join(root, "lib", name + ".png")
        raw = os.path.join(root, "lib", name + "-raw.png")
        src = os.path.join(root, "lib", head + ".png")
        if not os.path.exists(out) and os.path.exists(raw) and os.path.exists(src):
            composite(src, raw, out)
            print(f"composed {name}", flush=True)
