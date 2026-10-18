"""A part over a base: python -I wear.py base.txt part.txt out.txt [dy]  (the part's letters drawn over, moved dy rows)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write
base, pal = read(sys.argv[1])
part, ppal = read(sys.argv[2])
dy = int(sys.argv[4]) if len(sys.argv) > 4 else 0
g = [list(r) for r in base]
for y, r in enumerate(part):
    for x, ch in enumerate(r):
        if ch != '.' and 0 <= y + dy < len(g):
            g[y + dy][x] = ch
pals = dict(l.split() for l in (pal + ppal).strip().split('\n'))
write(sys.argv[3], [''.join(r) for r in g], '\n'.join(f'{k} {v}' for k, v in pals.items()) + '\n')
