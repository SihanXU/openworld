"""A draft with the fit's cell grid drawn on it, beside the fit, both big.

    python -I gridover.py draft.png fit.txt out.png --knots … --xs s:0 [--rows r0,r1]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from px import read, sprite

a = sys.argv[1:]
src, fit, out = a[:3]
o = {a[i]: a[i + 1] for i in range(3, len(a) - 1, 2)}
knots = sorted((int(r), float(y)) for y, r in (k.split(':') for k in o['--knots'].split(',')))
s = float(o['--xs'].split(':')[0])
r0, r1 = (int(v) for v in o.get('--rows', '0,36').split(','))
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
pts = [(x, y) for y in range(0, H, 2) for x in range(0, W, 2) if min(px[x, y]) <= 226]
cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2


def ytop(r):
    for (ra, ya), (rb, yb) in zip(knots, knots[1:]):
        if ra <= r <= rb:
            return ya + (yb - ya) * (r - ra) / (rb - ra)


S = 28
big = Image.new('RGB', (24 * S * 2 + 60, (r1 - r0) * S + 40), (255, 255, 255))
d = ImageDraw.Draw(big)
for r in range(r0, r1):
    ya, yb = ytop(r), ytop(r + 1)
    if ya is None or yb is None:
        continue
    for c in range(24):
        xa = cx + (c - 12) * s
        cell = im.crop((int(xa), int(ya), int(xa + s), int(yb))).resize((S, S))
        big.paste(cell, (20 + c * S, 20 + (r - r0) * S))
for c in range(25):
    d.line([(20 + c * S, 20), (20 + c * S, 20 + (r1 - r0) * S)], fill=(255, 0, 0), width=1)
for r in range(r1 - r0 + 1):
    d.line([(20, 20 + r * S), (20 + 24 * S, 20 + r * S)], fill=(255, 0, 0), width=1)
    if r < r1 - r0:
        d.text((4, 24 + r * S), str(r + r0), fill=(0, 0, 0))
for c in range(24):
    d.text((24 + c * S, 6), str(c % 10), fill=(0, 0, 0))
g, pal = read(fit)
sp = sprite(g, pal).crop((0, r0, 24, r1)).resize((24 * S, (r1 - r0) * S), Image.NEAREST)
big.paste((92, 128, 80), (40 + 24 * S, 20, 40 + 48 * S, 20 + (r1 - r0) * S))
big.paste(sp, (40 + 24 * S, 20), sp)
big.save(out)
