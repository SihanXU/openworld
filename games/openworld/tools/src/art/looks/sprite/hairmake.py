"""A hairstyle from its three drafts to parts on the bases.  python -I hairmake.py style [--back down:13,left:13@12,up:99]

Run in the work folder, after `bases.py out .` (the bases' grids) and `gen_hair.py` (the drafts).

Writes hair-<style>-<facing>.txt (the part alone: letters a..e, its dark line drawn against the body it was drafted
on, specks dropped) and w-<style>-<facing>.txt/.png (worn on that body), and prints the backFrom rows.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from walk import read, write

PY = sys.executable
MAN = {'short', 'messy', 'swept', 'cropped', 'thin', 'tuft'}
FIT = {
    ('left', 'man'): ('drafts/l-man-33.png', '-66:0,34:3,368:13,737:35', '33.4:0', 'MAN_LEFT.txt'),
    ('left', 'woman'): ('drafts/l-woman-33.png', '-62:0,34:3,355:13,739:35', '32.1:0', 'WOMAN_LEFT.txt'),
    ('down', 'man'): ('drafts/front-man-e7.png', '-61:0,34:3,350:13,737:35', '30:0', 'MAN_DOWN.txt'),
    ('down', 'woman'): ('drafts/front-woman-e32.png', '-61:0,34:3,350:13,738:35', '31:0', 'WOMAN_DOWN.txt'),
    ('up', 'man'): ('drafts/back-man-e32.png', '-61:0,36:3,360:13,728:35', '32:0', 'MAN_UP.txt'),
    ('up', 'woman'): ('drafts/back-woman-e32.png', '-60:0,34:3,348:13,730:35', '31:0', 'WOMAN_UP.txt'),
}
HAIR = set('abcde')


def part(style, facing, back_from, back_col=0):
    body = 'man' if style in MAN else 'woman'
    bald, knots, xs, base_txt = FIT[(facing, body)]
    raw = f'raw-{style}-{facing}.txt'
    subprocess.run([PY, '-I', os.path.join(HERE, 'hairfit.py'), bald, f'drafts/hair-{style}-{facing}.png', raw, '--knots', knots, '--xs', xs], check=True)
    base, pal = read(base_txt)
    hair, hpal = read(raw)
    H, W = len(base), len(base[0])
    cells = {(y, x) for y, r in enumerate(hair) for x, ch in enumerate(r) if ch in HAIR}
    near = lambda y, x: sum((y + j, x + i) in cells for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    cells = {c for c in cells if near(*c)}
    worn = [list(r) for r in base]
    shown = set()
    for (y, x) in cells:
        if y >= back_from and x >= back_col and base[y][x] != '.':
            continue
        worn[y][x] = hair[y][x]
        shown.add((y, x))
    out = [['.'] * W for _ in range(H)]
    for (y, x) in cells:
        out[y][x] = hair[y][x]
    for (y, x) in shown:
        if any(not (0 <= y + j < H and 0 <= x + i < W) or worn[y + j][x + i] == '.' for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            worn[y][x] = 'e'
            out[y][x] = 'e'
    write(f'hair-{style}-{facing}.txt', [''.join(r) for r in out], hpal)
    pals = dict(l.split() for l in (pal + hpal).strip().split('\n'))
    write(f'w-{style}-{facing}.txt', [''.join(r) for r in worn], '\n'.join(f'{k} {v}' for k, v in pals.items()) + '\n')
    subprocess.run([PY, '-I', os.path.join(HERE, 'px.py'), 'load', f'w-{style}-{facing}.txt', f'w-{style}-{facing}.png'], check=True)


if __name__ == '__main__':
    style = sys.argv[1]
    back = {'down': (13, 0), 'left': (13, 0), 'up': (99, 0)}
    if '--back' in sys.argv:
        for kv in sys.argv[sys.argv.index('--back') + 1].split(','):
            k, v = kv.split(':')
            row, _, col = v.partition('@')
            back[k] = (int(row), int(col or 0))
    for facing in ('down', 'left', 'up'):
        part(style, facing, *back[facing])
    print(style, 'backFrom', back)
