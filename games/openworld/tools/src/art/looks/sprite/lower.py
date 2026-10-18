"""An arm lowered: python -I lower.py in.txt out.txt r0 r1 c0 c1 shoulder k

The cells in rows r0..r1, cols c0..c1 (the arm, off the body) move down by round((shoulder - x) * k): the farther from
the shoulder the lower, so the arm's own pixels tilt down. Then every fill cell left touching the background gets its
outline there.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write
src, dst = sys.argv[1], sys.argv[2]
r0, r1, c0, c1, sh = map(int, sys.argv[3:8])
k = float(sys.argv[8])
rows, pal = read(src)
g = [list(r) for r in rows]
cells = [(y, x, rows[y][x]) for y in range(r0, r1 + 1) for x in range(c0, c1 + 1) if rows[y][x] != '.']
for y, x, _ in cells:
    g[y][x] = '.'
for y, x, ch in cells:
    dy = round((sh - x) * k)
    if g[y + dy][x] == '.' or g[y + dy][x] == 'K':
        g[y + dy][x] = ch
FILL = set('OHJFQMNPVWTX')
for y in range(36):
    for x in range(24):
        if g[y][x] in FILL:
            for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                Y, X = y + j, x + i
                if 0 <= Y < 36 and 0 <= X < 24 and g[Y][X] == '.':
                    g[Y][X] = 'K'
write(dst, [''.join(r) for r in g], pal)
