"""A draft → a 24x36 letter grid in the example's palette, its head and body each scaled to their own rows.

    python -I fit.py draft.png out.txt --neck Y [--top 3 --head 10 --sole 34 --ink 0.4]

Every source pixel is classed to the nearest palette colour; a cell takes its majority, the outline winning at --ink.
"""
import sys
from PIL import Image

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
top, hr, sole, ink = int(o.get('--top', 3)), int(o.get('--head', 10)), int(o.get('--sole', 34)), float(o.get('--ink', 0.4))
neck = int(o['--neck'])
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()
bg = lambda c: min(c) > 226
pts = [(x, y) for y in range(0, H, 2) for x in range(0, W, 2) if not bg(px[x, y])]
x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
cx = (x0 + x1) / 2
br = sole - top + 1 - hr
bands = [(y0, neck, top, hr), (neck, y1 + 1, top + hr, br)]
cache = {}
grid = [['.'] * 24 for _ in range(36)]
for (b0, b1, r0, nr) in bands:
    s = (b1 - b0) / nr
    for r in range(nr):
        ya = b0 + r * s
        for c in range(24):
            xa = cx + (c - 12) * s
            cnt, n = {}, 0
            for y in range(int(ya), int(ya + s) + 1):
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
                grid[r0 + r][c] = 'K'
                continue
            cnt.pop('.', None)
            grid[r0 + r][c] = max(cnt, key=cnt.get)
open(out, 'w', newline='\n').write('\n'.join(''.join(r) for r in grid) + '\n\n' + '\n'.join(f'{k} {v}' for k, v in PAL.items()) + '\n')
print(src, 'head scale', round((neck - y0) / hr, 1), 'body scale', round((y1 + 1 - neck) / br, 1))
