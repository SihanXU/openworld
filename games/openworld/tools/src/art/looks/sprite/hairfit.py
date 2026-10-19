"""A part fitted from two drafts: what the edit changed (the haired draft against the bald one) onto the grid.

    python -I hairfit.py bald.png haired.png out.txt --knots y:row,… --xs scale:row,… [--tol 60] [--share 0.4]

A cell is the part's where at least --share of its pixels changed by more than --tol; its tone is the changed pixels'
mean lightness, put in five steps a (light) … e (the part's dark line) by the part's own spread of lightness.
"""
import sys
from PIL import Image

a = sys.argv[1:]
bald, haired, out = a[0], a[1], a[2]
o = {a[i]: a[i + 1] for i in range(3, len(a) - 1, 2)}
knots = sorted((int(r), float(y)) for y, r in (k.split(':') for k in o['--knots'].split(',')))
xs = sorted((int(r), float(s)) for s, r in (k.split(':') for k in o['--xs'].split(',')))
tol, share = float(o.get('--tol', 60)), float(o.get('--share', 0.4))


def ytop(r):
    for (r0, y0), (r1, y1) in zip(knots, knots[1:]):
        if r0 <= r <= r1:
            return y0 + (y1 - y0) * (r - r0) / (r1 - r0)
    return None


def xscale(r):
    s = None
    for r0, v in xs:
        if r >= r0:
            s = v
    return s


A = Image.open(bald).convert('RGB')
B = Image.open(haired).convert('RGB')
W, H = A.size
pa, pb = A.load(), B.load()
bg = lambda c: min(c) > 226
pts = [(x, y) for y in range(0, H, 2) for x in range(0, W, 2) if not bg(pa[x, y])]
cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
cells = {}
for r in range(36):
    ya, yb = ytop(r), ytop(r + 1)
    if ya is None or yb is None:
        continue
    s = xscale(r)
    for c in range(24):
        xa = cx + (c - 12) * s
        n, ch = 0, []
        for y in range(int(ya), int(yb) + 1):
            for x in range(int(xa), int(xa + s) + 1):
                if not (0 <= x < W and 0 <= y < H):
                    continue
                n += 1
                p, q = pa[x, y], pb[x, y]
                if sum(abs(p[i] - q[i]) for i in range(3)) > tol and not bg(q):
                    ch.append(lum(q))
        if n and len(ch) >= share * n:
            cells[(r, c)] = sorted(ch)[len(ch) // 2]
grid = [['.'] * 24 for _ in range(36)]
if cells:
    vals = sorted(cells.values())
    cut = [vals[int(len(vals) * f)] for f in (0.12, 0.35, 0.65, 0.9)]
    for (r, c), v in cells.items():
        grid[r][c] = 'edcba'[sum(v > t for t in cut)]
pal = {'a': '#b38a5c', 'b': '#8f6845', 'c': '#6b4a32', 'd': '#4a3424', 'e': '#2a1d14'}
open(out, 'w', newline='\n').write('\n'.join(''.join(r) for r in grid) + '\n\n' + '\n'.join(f'{k} {v}' for k, v in pal.items()) + '\n')
print(out, len(cells), 'cells')
