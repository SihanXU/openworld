"""The back view's hair carried down to the nape: python -I nape.py style… [--to 10]

The drafts' backs keep the lower back of the head bald; a short style covers it. Every skin cell of the back head
below the hair, down to row --to, becomes hair (c and d alternating, the last row d and e: the hairline).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write

args = [a for a in sys.argv[1:] if not a.startswith('--')]
to = int(sys.argv[sys.argv.index('--to') + 1]) if '--to' in sys.argv else 10
full = '--full' in sys.argv  # long hair: all the back head is hair, no hairline
BASE = 'WOMAN_UP.txt' if '--woman' in sys.argv else 'MAN_UP.txt'
args = [a for a in args if a != str(to)]


def strand(x):
    # combed strands seen from behind, lit from the left: lighter on the left, a darker line every third column
    tone = 'b' if x <= 9 else 'c' if x <= 13 else 'd'
    return {'b': 'c', 'c': 'd', 'd': 'e'}[tone] if x % 3 == 2 else tone
for style in args:
    base, _ = read(BASE)
    hair, pal = read(f'hair-{style}-up.txt')
    g = [list(r) for r in hair]
    for x in range(24):
        top = next((y for y in range(36) if g[y][x] != '.'), None)
        if top is None:
            continue
        for y in range(top, to + 1):
            if g[y][x] == '.' and base[y][x] in 'OHJFQ':
                g[y][x] = strand(x) if (y < to or full) else ('e' if x % 3 == 0 else 'd')
    write(f'hair-{style}-up.txt', [''.join(r) for r in g], pal)
    worn = [list(r) for r in base]
    for y, r in enumerate(g):
        for x, ch in enumerate(r):
            if ch != '.':
                worn[y][x] = ch
    bpal = open(BASE).read().split('\n\n')[1]
    pals = dict(l.split() for l in (bpal + pal).strip().split('\n'))
    write(f'w-{style}-up.txt', [''.join(r) for r in worn], '\n'.join(f'{k} {v}' for k, v in pals.items()) + '\n')
    print(style)
