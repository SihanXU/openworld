"""The client's repainting (client/src/assets/figure/color.ts) in Python, for the pipeline's review sheets."""

from __future__ import annotations

import colorsys

import numpy as np


def hex_rgb(h: str) -> tuple[float, float, float]:
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def _towards(h: float, target: float, by: float) -> float:
    d = ((target - h + 540) % 360) - 180
    return h + (1 if d > 0 else -1) * min(abs(d), by)


def shade(rgb, step: float):
    r, g, b = (c / 255 for c in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    if step == 0:
        return rgb
    if step < 0:
        k = -step
        h2, s2, l2 = _towards(h, 255, 7 * k), s + 0.04 * k * (1 - s), l * (1 - 0.24 * k)
    else:
        h2, s2, l2 = _towards(h, 55, 8 * step), s * (1 - 0.06 * step), l + (1 - l) * 0.3 * step
    r, g, b = colorsys.hls_to_rgb((h2 % 360) / 360, min(1, max(0, l2)), min(1, max(0, s2)))
    return (r * 255, g * 255, b * 255)


def gradient(rgb) -> np.ndarray:
    stops = [(0, shade(shade(rgb, -2), -1)), (70, shade(rgb, -2)), (140, shade(rgb, -1)), (180, rgb), (225, shade(rgb, 1)), (255, shade(rgb, 2))]
    out = np.zeros((256, 3), np.float32)
    for v in range(256):
        i = 0
        while i < len(stops) - 2 and v > stops[i + 1][0]:
            i += 1
        v0, c0 = stops[i]
        v1, c1 = stops[i + 1]
        t = 0 if v1 == v0 else min(1, max(0, (v - v0) / (v1 - v0)))
        out[v] = [c0[k] + (c1[k] - c0[k]) * t for k in range(3)]
    return out


def paint(value: np.ndarray, rgb) -> np.ndarray:
    return gradient(rgb)[np.clip(value, 0, 255).astype(np.int32)]
