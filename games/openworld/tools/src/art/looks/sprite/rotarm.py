"""An arm turned about its shoulder: python -I rotarm.py in.txt out.txt sy sx r0 r1 c0 c1 degrees front|behind

The arm's cells (rows r0..r1, cols c0..c1) turn about the shoulder (sy, sx) by the angle (positive: clockwise on the
screen, so an arm reaching left swings down toward the body). Each target cell takes the arm cell it turns from; an
arm in front is drawn over the body, one behind only where the background shows. Then every fill cell touching the
background gets its outline there, and a lone outline cell left in the air is dropped.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write
src, dst = sys.argv[1], sys.argv[2]
sy, sx = float(sys.argv[3]), float(sys.argv[4])
r0, r1, c0, c1 = map(int, sys.argv[5:9])
ang = math.radians(float(sys.argv[9]))
front = sys.argv[10] == 'front'
rows, pal = read(src)
g = [list(r) for r in rows]
arm = {(y, x): rows[y][x] for y in range(r0, r1 + 1) for x in range(c0, c1 + 1) if rows[y][x] != '.'}
for (y, x) in arm:
    g[y][x] = '.'
c, s = math.cos(ang), math.sin(ang)
placed = {}
for y in range(36):
    for x in range(24):
        # the source: the target turned back by the angle
        dy, dx = y + 0.5 - sy, x + 0.5 - sx
        oy = sy + dy * c - dx * s
        ox = sx + dx * c + dy * s
        p = (int(math.floor(oy)), int(math.floor(ox)))
        if p in arm:
            placed[(y, x)] = arm[p]
for (y, x), ch in placed.items():
    if front or g[y][x] == '.':
        g[y][x] = ch
FILL = set('OHJFQMNPVWTXabcde')
for y in range(36):
    for x in range(24):
        if g[y][x] in FILL:
            for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                Y, X = y + j, x + i
                if 0 <= Y < 36 and 0 <= X < 24 and g[Y][X] == '.':
                    g[Y][X] = 'K'
for y in range(36):
    for x in range(24):
        if g[y][x] == 'K' and not any(0 <= y + j < 36 and 0 <= x + i < 24 and g[y + j][x + i] in FILL for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))):
            g[y][x] = '.'
write(dst, [''.join(r) for r in g], pal)
