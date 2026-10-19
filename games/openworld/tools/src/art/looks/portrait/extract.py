"""Cut a generated picture into a look part's portrait layers (docs/looks.md §4).

Every part is drawn by editing one locked base bust (a bald figure in a plain top on a flat background), so a
part is what the edit changed. This module finds the figure and the change, mattes the edges against the known
background, splits what lies outside the base figure (drawn behind it: long hair) from what lies on it, and
turns colour into value so the game can repaint a layer in any colour:

- a layer is two images: its paint (RGBA, the generated colours: fixed pixels and a fallback) and its value map
  (R: the value 0-255 after normalising, G: the zone 40*k, A: coverage). Zone 0 keeps the paint's colour; zone
  k > 0 is the part's k-th colour key, repainted through a gradient of the look's colour (client color.ts).
- values are normalised per zone so the zone's shadow sits near 140, its base near 180 and its lights near
  225, whatever colour the model painted it in; the darkest lines go toward 20.
"""

from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 768, 1536  # the generation's size (comfy.py) and the game's portrait canvas: a full figure


def load(path: str) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def background(img: np.ndarray) -> np.ndarray:
    """The flat background's colour: the median of the picture's border."""
    b = np.concatenate([img[:8].reshape(-1, 3), img[-8:].reshape(-1, 3), img[:, :8].reshape(-1, 3), img[:, -8:].reshape(-1, 3)])
    return np.median(b, axis=0)


def figure(img: np.ndarray, bg: np.ndarray, tol: float = 14.0) -> np.ndarray:
    """What is not background: everything not connected to the border through background-coloured pixels."""
    near = np.abs(img - bg).max(axis=2) < tol
    lab, _ = ndi.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge))
    fig = ~bgmask
    return ndi.binary_fill_holes(ndi.binary_opening(fig, iterations=1))


def changed(base: np.ndarray, edit: np.ndarray, tol: float = 26.0, min_blob: int = 60) -> np.ndarray:
    """Where the edit differs from the base: a per-pixel colour distance over a tolerance, cleaned of specks."""
    d = np.sqrt(((edit - base) ** 2).sum(axis=2))
    # blur a little first: the VAE's round trip moves single pixels everywhere a little
    d = ndi.gaussian_filter(d, 1.0)
    m = d > tol
    m = ndi.binary_opening(m, iterations=1)
    m = ndi.binary_closing(m, iterations=2)
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= min_blob])
        m = keep
    return ndi.binary_fill_holes(m)


def matte(edit: np.ndarray, bg: np.ndarray, region: np.ndarray, inside: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Colour and coverage of a region: opaque on the base figure (`inside`), and over the background un-mixed
    from the background colour by how far each pixel is from it (the edges of hair against the flat grey)."""
    alpha = np.zeros(edit.shape[:2], np.float32)
    dist = np.abs(edit - bg).max(axis=2)
    soft = np.clip((dist - 4.0) / 40.0, 0, 1)
    alpha[region] = 1.0
    out = region & ~inside
    alpha[out] = soft[out]
    # feather the cut by a pixel where the region meets the base figure (no hard stair on skin)
    edge = region & ~ndi.binary_erosion(region, iterations=1) & inside
    alpha[edge] = np.minimum(alpha[edge], 0.6)
    rgb = edit.copy()
    a = np.maximum(alpha, 1e-3)[..., None]
    unmixed = (edit - (1 - a) * bg) / a
    rgb[out] = np.clip(unmixed[out], 0, 255)
    return rgb, alpha


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def normalise(lum: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """A zone's luminance onto the shared value scale: lines ~20, shadow ~140, base ~180, light ~225, top 255."""
    v = lum[mask]
    if v.size < 16:
        return np.full(lum.shape, 180.0)
    p = np.percentile(v, [1, 30, 60, 92, 99.5])
    src = np.array([v.min(), *p, max(v.max(), p[-1] + 1)])
    dst = np.array([10, 30, 145, 180, 222, 248, 255], np.float32)
    src = np.maximum.accumulate(src + np.arange(len(src)) * 1e-3)
    return np.interp(lum, src, dst)


def save_layer(path: str, rgb: np.ndarray, alpha: np.ndarray, zones: np.ndarray, value: np.ndarray) -> tuple[int, int, int, int] | None:
    """Write a layer cropped to what it covers: `<path>.png` (paint) and `<path>.z.png` (value, zone, alpha). Its box."""
    ys, xs = np.nonzero(alpha > 0.02)
    if not len(ys):
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    paint = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a8])[y0:y1, x0:x1]
    zv = np.dstack([np.clip(value, 0, 255).astype(np.uint8), (zones * 40).astype(np.uint8), np.zeros_like(a8), a8])[y0:y1, x0:x1]
    Image.fromarray(paint, "RGBA").save(path + ".png", optimize=True)
    Image.fromarray(zv, "RGBA").save(path + ".z.png", optimize=True)
    return int(x0), int(y0), int(x1 - x0), int(y1 - y0)
