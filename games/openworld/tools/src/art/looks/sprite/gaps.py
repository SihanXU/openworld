"""Fill pixels touching the background (outline gaps): python -I gaps.py grid.txt …"""
import sys
for f in sys.argv[1:]:
    g = open(f).read().split('\n\n')[0].split('\n')
    bad = set()
    for y, r in enumerate(g):
        for x, c in enumerate(r):
            if c in '.KL':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if not (0 <= Y < len(g) and 0 <= X < len(g[Y])) or g[Y][X] == '.':
                    bad.add((y, x, c))
    print(f, 'gaps (row, col):', sorted(bad))
