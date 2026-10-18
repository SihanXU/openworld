"""The child's frames from the woman's (docs/looks.md §3.1).  python -I kidcarve.py <bg dir>   (WOMAN_*.txt -> CHILD_*.txt)

A child has the same head (so every head part fits) on a shorter body: one torso row taken out (15 rows below the
head's top), the legs resampled to six rows (five on a step: the hips bob, the soles stay on row 34) and drawn closer
together (the front and back by 0.85 of their spread, the 3/4 view by 0.6), each leg outlined again, the far one
first. No bust: the shading row under it becomes the plain grey's. The 3/4 strides' legs are too short to resample
well; they are drawn small here (LEGS), in the adult strides' shape: the far leg forward in A, the near in B.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write
from regions import components, label

NAMES = ['DOWN', 'DOWN_PASS', 'DOWN_A', 'DOWN_B', 'UP', 'UP_PASS', 'UP_A', 'UP_B', 'LEFT', 'LEFT_A', 'LEFT_B']
STAND_HEM = 23  # the woman's standing hem: a step's hips are one row lower
LEGS = {
    'LEFT_A': [
        '........KJFKKHJJK.......',
        '.......KJJK..KJJFK......',
        '.....KKJJFK...KJJFK.....',
        '....KFJJJK.....KJFK.....',
        '.....KKKK.......KK......'],
    'LEFT_B': [
        '........KJJKFFK.........',
        '.......KJJK.KFFK........',
        '.....KKJJFK..KFFK.......',
        '....KFJJJK....KFK.......',
        '.....KKKK......K........'],
}


def legs_from(adult, kid, kid_hem, ha, f):
    """The adult's legs below row `ha`, each resampled into the child's rows below `kid_hem` and moved toward the
    hips' middle by `f` of its spread, then outlined: the far (smaller) leg first, the near one over it."""
    lab, m = label(adult, 'woman')
    fill = {(y, x) for y in range(ha + 1, 35) for x in range(24) if adult[y][x] not in '.KL' and lab[y][x] not in 'uad'}
    hips = [x for y in range(m['waist'], m['hem'] + 1) for x in range(24) if lab[y][x] == 'p']
    cx = (min(hips) + max(hips)) / 2
    out = [list(r) for r in kid]
    na, nk = max(y for y, _ in fill) - ha, 33 - kid_hem
    for comp in sorted(components(fill), key=len):
        cells = {}
        for y in range(kid_hem + 1, 34):
            ya = ha + 1 + round((y - kid_hem - 1) * (na - 1) / max(1, nk - 1))
            xs = sorted(x for (yy, x) in comp if yy == ya)
            if xs:
                d = round(((xs[0] + xs[-1]) / 2 - cx) * (f - 1))
                for x in xs:
                    cells[(y, x + d)] = adult[ya][x]
        for (y, x) in {(y + j, x + i) for (y, x) in cells for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1))} - set(cells):
            if 0 <= x < 24 and (kid_hem < y < 36 or (y == kid_hem and out[y][x] == '.')):
                out[y][x] = 'K'
        for (y, x), ch in cells.items():
            if 0 <= x < 24:
                out[y][x] = ch
    return [''.join(r) for r in out]


def child(adult, name):
    top = next(y for y, r in enumerate(adult) if r.strip('.'))
    bob = top - 3
    ha = STAND_HEM + bob
    upper = [r for y, r in enumerate(adult[:ha + 1]) if y != top + 15]
    kid_hem = 28 + bob
    kid = ['.' * 24 for _ in range(36)]
    for i, r in enumerate(upper):
        kid[kid_hem - (len(upper) - 1) + i] = r
    kid = legs_from(adult, kid, kid_hem, ha, 0.6 if 'LEFT' in name else 0.85)
    for i, r in enumerate(LEGS.get(name, [])):
        kid[30 + i] = r
    # no bust: its shading row is the grey's
    for y in range(19, 27):
        m = re.search(r'T{4,}', kid[y])
        if m:
            s, e = m.span()
            kid[y] = kid[y][:s] + 'V' * (e - s - 1) + 'W' + kid[y][e:]
    return kid


if __name__ == '__main__':
    folder = sys.argv[1]
    for n in NAMES:
        adult, pal = read(os.path.join(folder, f'WOMAN_{n}.txt'))
        write(os.path.join(folder, f'CHILD_{n}.txt'), child(adult, n), pal)
        print(f'CHILD_{n}')
