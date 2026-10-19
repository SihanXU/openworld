"""A draft → a 24x36 grid with a piecewise vertical map (each band its own rows) and one horizontal scale a band group.

    python -I fit2.py draft.png out.txt --knots 34:3,346:13,356:14,580:24,738:35 --xs 30.5:0,18:13 [--ink 0.4]

--knots y:row pairs: draft y maps to the top of that row, linearly between knots.
--xs scale:row pairs: from that row down, a cell is that many draft pixels wide (default: the band's own height).
"""
import sys
from PIL import Image

sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
PAL = {
    'K': '#202020',
    'H': '#ffe2b4', 'J': '#fec793', 'F': '#cf904f', 'Q': '#905620',
    'V': '#d0d0d0', 'W': '#a0a0a0', 'T': '#808080', 'X': '#606060',
    'P': '#1f8efe', 'M': '#013f80', 'O': '#fdfdde',
}
RGB = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in PAL.items()}


def dist(c, d):
    rm = (c[0] + d[0]) / 2
    return (2 + rm / 256) * (c[0] - d[0]) ** 2 + 4 * (c[1] - d[1]) ** 2 + (2 + (255 - rm) / 256) * (c[2] - d[2]) ** 2


a = sys.argv[1:]
src, out = a[0], a[1]
o = {a[i]: a[i + 1] for i in range(2, len(a) - 1, 2)}
knots = sorted((int(r), float(y)) for y, r in (k.split(':') for k in o['--knots'].split(',')))
xs = sorted((int(r), float(s)) for s, r in (k.split(':') for k in o['--xs'].split(','))) if '--xs' in o else []
ink = float(o.get('--ink', 0.4))


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
    return s or (ytop(r + 1) - ytop(r))


im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
bg = lambda c: min(c) > 226
pts = [(x, y) for y in range(0, H, 2) for x in range(0, W, 2) if not bg(px[x, y])]
cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
cache = {}
grid = [['.'] * 24 for _ in range(36)]
for r in range(36):
    ya, yb = ytop(r), ytop(r + 1)
    if ya is None or yb is None:
        continue
    s = xscale(r)
    for c in range(24):
        xa = cx + (c - 12) * s
        cnt, n = {}, 0
        for y in range(int(ya), int(yb) + 1):
            for x in range(int(xa), int(xa + s) + 1):
                if not (0 <= x < W and 0 <= y < H):
                    continue
                p = px[x, y]
                n += 1
                if bg(p):
                    k = '.'
                else:
                    k = cache.get(p)
                    if k is None:
                        k = cache[p] = min(RGB, key=lambda q: dist(RGB[q], p))
                cnt[k] = cnt.get(k, 0) + 1
        if not n or cnt.get('.', 0) > n * 0.5:
            continue
        if cnt.get('K', 0) >= n * ink:
            grid[r][c] = 'K'
            continue
        cnt.pop('.', None)
        grid[r][c] = max(cnt, key=cnt.get)
open(out, 'w', newline='\n').write('\n'.join(''.join(r) for r in grid) + '\n\n' + '\n'.join(f'{k} {v}' for k, v in PAL.items()) + '\n')
