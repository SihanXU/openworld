"""Lumi's panel picture in layers (2026-10-27), so her panel can move her: the wings flutter, the eyes blink.

    python games/openworld/tools/src/art/portraits/panel-layers.py [preview-dir]

From what `portrait.py ship` left in her assets (public/assets/lsw/Portraits/lumi/: <mood>-panel.webp, the figure with
her wings, and <mood>-blink.webp, the bust's blink), it writes beside them:
- panel-wings-left.webp, panel-wings-right.webp: her wings alone (the near pair at the left, the far one at the right),
  cut by their colour — ice-blue to white, green at least red's (her lavender hair, red above green, is not; nor her
  skin) — in the regions where wings are and her dress and ribbon are not; the same in every mood (a mood edits her face);
- <mood>-panel-body.webp: the picture with the wings taken out (what is wing is clear: they are behind her);
- <mood>-panel-blink.webp: her closed eyes alone, from the bust's blink of that mood, set where her eyes are on the
  panel picture (the bust and the panel picture are two crops of one drawing: lumi.json `bust` and `panel`), feathered,
  to lay over the body.
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "public", "assets", "lsw", "Portraits", "lumi"))
PERSON = json.load(open(os.path.join(HERE, "lumi.json"), encoding="utf-8"))
MOODS = ["neutral", *PERSON["moods"]]

# where her wings are on the panel picture (720x720), and not her dress or its ribbon's tails
LEFT_ZONE = (0, 90, 262, 560)
RIGHT_ZONE = (432, 120, 520, 300)


def to_panel(x: float, y: float) -> tuple[float, float]:
    """A point of the drawing (the sprite's pixels) on the panel picture."""
    bx, by, bx1, _ = PERSON["panel"]
    s = PERSON["panelOut"] / (bx1 - bx)
    return (x - bx) * s, (y - by) * s


def bust_on_panel(img: Image.Image) -> Image.Image:
    """A bust (400x400) laid over the panel picture's canvas where it is in the drawing."""
    b0x, b0y, b1x, _ = PERSON["bust"]
    p0x, p0y, p1x, _ = PERSON["panel"]
    scale = (PERSON["panelOut"] / (p1x - p0x)) * ((b1x - b0x) / PERSON["out"])
    size = round(PERSON["out"] * scale)
    big = img.resize((size, size), Image.LANCZOS)
    ox, oy = to_panel(b0x, b0y)
    canvas = Image.new("RGBA", (PERSON["panelOut"], PERSON["panelOut"]), (0, 0, 0, 0))
    canvas.alpha_composite(big, (round(ox), round(oy)))
    return canvas


def eyes_mask() -> Image.Image:
    m = Image.new("L", (PERSON["panelOut"], PERSON["panelOut"]), 0)
    d = ImageDraw.Draw(m)
    p0x, _, p1x, _ = PERSON["panel"]
    s = PERSON["panelOut"] / (p1x - p0x)
    for cx, cy, rx, ry in PERSON["eyes"]:
        x, y = to_panel(cx, cy)
        # a little more than the pipeline's own region: the lashes' ends
        d.ellipse((x - rx * s * 1.15, y - ry * s * 1.25, x + rx * s * 1.15, y + ry * s * 1.25), fill=255)
    return m.filter(ImageFilter.GaussianBlur(3))


def wing_mask(img: Image.Image) -> np.ndarray:
    a = np.array(img).astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    # the wing's glass (ice-blue to near white) and its lines (a darker grey-blue): green at least red's — her lavender
    # hair has red above green, and so has her skin
    colour = np.clip((g - r + 3) / 5, 0, 1) * np.clip((b - 96) / 30, 0, 1)
    zone = np.zeros(al.shape, np.float32)
    for x0, y0, x1, y1 in (LEFT_ZONE, RIGHT_ZONE):
        zone[y0:y1, x0:x1] = 1
    zone = np.array(Image.fromarray((zone * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
    return colour * zone * (al / 255)


def main() -> None:
    neutral = Image.open(os.path.join(ASSETS, "neutral-panel.webp")).convert("RGBA")
    w = wing_mask(neutral)
    # close the hair's thin strands over the wing (they stay hers, drawn over it) and soften the cut
    wm = Image.fromarray((w * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    wa = np.array(wm.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    # what the wings take out of the body: a little more than the wing (its anti-aliased edge against the clear ground),
    # never her hair or skin
    a = np.array(neutral).astype(np.float32)
    hers = np.clip((a[..., 0] - a[..., 1] - 2) / 8, 0, 1)  # red above green: hair, skin, the flower
    grown = np.array(wm.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
    cut = np.maximum(wa, grown * (1 - hers))
    base = np.array(neutral).astype(np.float32)
    half = PERSON["panelOut"] // 2 - 10
    for side, cols in (("left", slice(0, half)), ("right", slice(half, None))):
        layer = base.copy()
        keep = np.zeros_like(wa)
        keep[:, cols] = wa[:, cols]
        layer[..., 3] = base[..., 3] * keep
        Image.fromarray(layer.astype(np.uint8), "RGBA").save(os.path.join(ASSETS, f"panel-wings-{side}.webp"), quality=90, method=6, lossless=False)
    mask = eyes_mask()
    for mood in MOODS:
        pic = Image.open(os.path.join(ASSETS, f"{mood}-panel.webp")).convert("RGBA")
        arr = np.array(pic).astype(np.float32)
        arr[..., 3] = arr[..., 3] * (1 - cut)
        Image.fromarray(arr.astype(np.uint8), "RGBA").save(os.path.join(ASSETS, f"{mood}-panel-body.webp"), quality=90, method=6)
        blink = bust_on_panel(Image.open(os.path.join(ASSETS, f"{mood}-blink.webp")).convert("RGBA"))
        b = np.array(blink).astype(np.float32)
        b[..., 3] = b[..., 3] * (np.array(mask).astype(np.float32) / 255)
        Image.fromarray(b.astype(np.uint8), "RGBA").save(os.path.join(ASSETS, f"{mood}-panel-blink.webp"), quality=92, method=6)
    if len(sys.argv) > 1:
        prev = sys.argv[1]
        os.makedirs(prev, exist_ok=True)
        bg = (30, 26, 52, 255)
        tiles = []
        for name in ("panel-wings-left", "panel-wings-right", "neutral-panel-body"):
            t = Image.new("RGBA", neutral.size, bg)
            t.alpha_composite(Image.open(os.path.join(ASSETS, f"{name}.webp")).convert("RGBA"))
            tiles.append(t)
        # the blink laid on its body, and the open face beside it, at the eyes
        body = Image.open(os.path.join(ASSETS, "neutral-panel-body.webp")).convert("RGBA")
        shut = body.copy()
        shut.alpha_composite(Image.open(os.path.join(ASSETS, "neutral-panel-blink.webp")).convert("RGBA"))
        x0, y0 = to_panel(PERSON["face"][0], PERSON["face"][1])
        x1, y1 = to_panel(PERSON["face"][2], PERSON["face"][3])
        box = (int(x0) - 20, int(y0) - 20, int(x1) + 20, int(y1) + 20)
        for im in (body, shut):
            t = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), bg)
            t.alpha_composite(im.crop(box))
            tiles.append(t.resize((t.width * 2, t.height * 2), Image.LANCZOS))
        W = sum(t.width for t in tiles[:3]) // 2
        sheet = Image.new("RGBA", (W + 20 + tiles[3].width * 2 + 20, 380), (60, 50, 40, 255))
        x = 0
        for t in tiles[:3]:
            sheet.alpha_composite(t.resize((t.width // 2, t.height // 2)), (x, 10))
            x += t.width // 2
        x += 20
        for t in tiles[3:]:
            sheet.alpha_composite(t.resize((t.width // 1, t.height // 1)).resize((t.width * 360 // t.height // 1, 360)), (x, 10))
            x += t.width * 360 // t.height + 10
        sheet.save(os.path.join(prev, "lumi-panel-layers.png"))
    print("Lumi's panel layers →", ASSETS)


if __name__ == "__main__":
    main()
