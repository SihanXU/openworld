"""The facings side by side: big on top, at game scale (4x) on grass below.

    python -I present.py out.png front.png left.png back.png [+ front.png left.png back.png …]
A sprite named '!x.png' is x.png mirrored (the right facing).
"""
import sys
from PIL import Image, ImageOps

out, args = sys.argv[1], sys.argv[2:]
groups, cur = [], []
for a in args:
    if a == '+':
        groups.append(cur); cur = []
    else:
        cur.append(a)
groups.append(cur)


def load(f):
    if f.startswith('!'):
        return ImageOps.mirror(Image.open(f[1:]).convert('RGBA'))
    return Image.open(f).convert('RGBA')


S, G = 10, 4
cw = 24 * S
W = 30 + max(len(g) for g in groups) * (cw + 20)
H = 20 + len(groups) * (36 * S + 20) + 36 * G + 40
img = Image.new('RGB', (W, H), (92, 128, 80))
y = 20
for g in groups:
    x = 30
    for f in g:
        b = load(f).resize((cw, 36 * S), Image.NEAREST)
        img.paste(b, (x, y), b); x += cw + 20
    y += 36 * S + 20
x = 30
for g in groups:
    for f in g:
        s = load(f).resize((24 * G, 36 * G), Image.NEAREST)
        img.paste(s, (x, y), s); x += 24 * G - 20
    x += 40
img.save(out)
