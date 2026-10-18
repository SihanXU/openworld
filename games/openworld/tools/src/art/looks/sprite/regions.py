"""Each base frame's body parts, for clothes to follow a frame's pose.  python -I regions.py <grids dir> <out dir>

Letters: h head, n neck, t torso (from the shoulders to the waist), p pelvis (the waist to the hem), u upper arm,
a forearm, d hand, g thigh, s shin, f foot. Outline cells take the part of the fill cell next to them.
A limb's parts go by its distance from where it leaves the body (a breadth-first walk over its fill cells).
"""
import os
import sys
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write

FILL = set('OHJFQMNPVWTX')
CLOTH = set('VWTX')


def components(cells):
    cells, out = set(cells), []
    while cells:
        start = cells.pop()
        comp, q = {start}, deque([start])
        while q:
            y, x = q.popleft()
            for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c = (y + j, x + i)
                if c in cells:
                    cells.remove(c)
                    comp.add(c)
                    q.append(c)
        out.append(comp)
    return out


def walk_from(comp, starts):
    d = {s: 0 for s in starts}
    q = deque(starts)
    while q:
        y, x = q.popleft()
        for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c = (y + j, x + i)
            if c in comp and c not in d:
                d[c] = d[(y, x)] + 1
                q.append(c)
    return d


def label(g, body, dist=None):
    H, W = len(g), len(g[0])
    top = next(y for y in range(H) if any(ch != '.' for ch in g[y]))
    chin = top + 9
    fill = {(y, x) for y in range(H) for x in range(W) if g[y][x] in FILL}
    hem = max(y for (y, x) in fill if g[y][x] in CLOTH)
    lab = [['.'] * W for _ in range(H)]
    for (y, x) in fill:
        if y <= chin:
            lab[y][x] = 'h'
        elif y == chin + 1:
            lab[y][x] = 'n'
    # the armpit: the first row below the neck where the body's fill splits into three runs or more
    def runs(y):
        r, prev = 0, False
        for x in range(W):
            on = (y, x) in fill
            r += on and not prev
            prev = on
        return r
    armpit = next((y for y in range(chin + 2, hem) if runs(y) >= 3), chin + 5)
    for (y, x) in fill:
        if chin + 2 <= y < armpit:
            lab[y][x] = 't'
    waist = hem - 3 if body in ('woman', 'child') else min(y for (y, x) in fill if g[y][x] in CLOTH)
    if body in ('woman', 'child'):
        # her dress is the torso: the arms are the skin beside it, from the dress's top down
        armpit = min(y for (y, x) in fill if g[y][x] in CLOTH and y > chin + 1) + 1
        for (y, x) in fill:
            if chin + 2 <= y < armpit:
                lab[y][x] = 't'
        dress = [(y, x) for (y, x) in fill if armpit <= y <= hem and g[y][x] in CLOTH]
        for (y, x) in dress:
            lab[y][x] = 'p' if y >= waist else 't'
        mid = [(y, x) for (y, x) in fill if armpit <= y <= hem and g[y][x] not in CLOTH]
        comps = components(mid)
        centres = []
    else:
        mid = [(y, x) for (y, x) in fill if armpit <= y <= hem]
        comps = components(mid)
        centres = [c for c in comps if sum(1 for (y, x) in c if 10 <= x <= 13) >= 2]
    for c in comps:
        if c in centres:
            for (y, x) in c:
                lab[y][x] = 'p' if y >= waist else 't'
            continue
        starts = [p for p in c if p[0] == min(q[0] for q in c)]
        d = walk_from(c, starts)
        m = max(d.values()) or 1
        # an arm hanging straight down is measured by its rows (a sleeve ends level), a swinging one along itself
        ys, xs = [p[0] for p in c], [p[1] for p in c]
        hang = max(ys) - min(ys) + 1 >= 2.5 * (max(xs) - min(xs) + 1)
        for p, v in d.items():
            if hang:
                v = (p[0] - min(ys)) / max(1, max(ys) - min(ys)) * m
            lab[p[0]][p[1]] = 'u' if v < 0.45 * m else 'a' if v < m - 1 else 'd'
            if dist is not None:
                dist[p] = ('arm', v / m)
    legs = [(y, x) for (y, x) in fill if y > hem]
    for c in components(legs):
        starts = [p for p in c if p[0] == min(q[0] for q in c)]
        d = walk_from(c, starts)
        bottom = max(y for (y, x) in c)
        m = max(d.values()) or 1
        for p, v in d.items():
            lab[p[0]][p[1]] = 'f' if p[0] >= bottom - 1 else 'g' if v < 0.45 * m else 's'
            if dist is not None:
                dist[p] = ('leg', 1.0 if p[0] >= bottom - 1 else min(0.95, v / m))
    # outline cells: the part of a fill neighbour (the lowest part wins: a hem over a leg is the leg's)
    order = 'hntpuadgsf'
    for y in range(H):
        for x in range(W):
            if g[y][x] in 'KL':
                near = [lab[y + j][x + i] for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + j < H and 0 <= x + i < W and lab[y + j][x + i] != '.' and g[y + j][x + i] not in 'KL']
                if near:
                    lab[y][x] = max(near, key=order.index)
    return lab, dict(top=top, chin=chin, armpit=armpit, waist=waist, hem=hem)


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.endswith('.txt'):
            continue
        g, _ = read(os.path.join(src, f))
        lab, marks = label(g, 'woman' if f.startswith('WOMAN') else 'man')
        write(os.path.join(out, f), [''.join(r) for r in lab], 'h #f0d0a0\nn #c08060\nt #3060c0\np #303090\nu #30a0a0\na #60c060\nd #e0e040\ng #c03030\ns #e07030\nf #804020\n')
        print(f, marks)
