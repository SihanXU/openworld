"""The cropped style's 3/4: its hair carried over the back of the head, which the cut missed."""
import sys, os
sys.path.insert(0, os.getcwd())
from walk import read, write
rows, pal = read('hair-cropped-left.txt')
g = [list(r) for r in rows]
for y, x, ch in [(6, 12, 'c'), (6, 13, 'd'), (6, 14, 'd'), (6, 15, 'd'), (7, 13, 'c'), (7, 14, 'd'), (7, 15, 'd'), (8, 14, 'd'), (8, 15, 'd')]:
    if g[y][x] == '.':
        g[y][x] = ch
write('hair-cropped-left.txt', [''.join(r) for r in g], pal)
