"""A head part (a hat, a beard) from its drafts, like hairmake.py but in its own letters and keys.

    python -I partmake.py hat straw man "fghi:#c0993c" [jklm:#4a3226] [--facings left,down,up] [--line e]

What the edit changed against the bald draft becomes the part. With one key its tones go by lightness (light to dark,
the darkest quarter its line); with two keys each cell goes to the nearer key colour first. Written:
<kind>-<id>-<facing>.txt (the part alone) and w-<kind>-<id>-<facing>.txt/.png (worn on that body's base).
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image
from walk import read, write

FIT = {
    ('left', 'man'): ('drafts/l-man-33.png', '-66:0,34:3,368:13,737:35', 33.4, 'bg/MAN_LEFT.txt'),
    ('left', 'woman'): ('drafts/l-woman-33.png', '-62:0,34:3,355:13,739:35', 32.1, 'bg/WOMAN_LEFT.txt'),
    ('down', 'man'): ('drafts/front-man-e7.png', '-61:0,34:3,350:13,737:35', 30, 'bg/MAN_DOWN.txt'),
    ('down', 'woman'): ('drafts/front-woman-e32.png', '-61:0,34:3,350:13,738:35', 31, 'bg/WOMAN_DOWN.txt'),
    ('up', 'man'): ('drafts/back-man-e32.png', '-61:0,36:3,360:13,728:35', 32, 'bg/MAN_UP.txt'),
    ('up', 'woman'): ('drafts/back-woman-e32.png', '-60:0,34:3,348:13,730:35', 31, 'bg/WOMAN_UP.txt'),
}


def cut(kind, pid, facing, body, keys, tol=60, share=0.4, solid=0):
    bald_p, kn, s, base_p = FIT[(facing, body)]
    knots = sorted((int(r), float(y)) for y, r in (k.split(':') for k in kn.split(',')))

    def ytop(r):
        for (r0, y0), (r1, y1) in zip(knots, knots[1:]):
            if r0 <= r <= r1:
                return y0 + (y1 - y0) * (r - r0) / (r1 - r0)

    A = Image.open(bald_p).convert('RGB')
    B = Image.open(f'drafts/{kind}-{pid}-{facing}.png').convert('RGB')
    W, H = A.size
    pa, pb = A.load(), B.load()
    bg = lambda c: min(c) > 226
    pts = [(x, y) for y in range(0, H, 2) for x in range(0, W, 2) if not bg(pa[x, y])]
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    d2 = lambda a, b: sum((a[i] - b[i]) ** 2 for i in range(3))
    cells = {}
    for r in range(0, 34):
        ya, yb = ytop(r), ytop(r + 1)
        if ya is None or yb is None:
            continue
        for c in range(24):
            xa = cx + (c - 12) * s
            n, got = 0, []
            for y in range(int(ya), int(yb) + 1):
                for x in range(int(xa), int(xa + s) + 1):
                    if not (0 <= x < W and 0 <= y < H):
                        continue
                    n += 1
                    p, q = pa[x, y], pb[x, y]
                    if sum(abs(p[i] - q[i]) for i in range(3)) > tol and not bg(q):
                        got.append(q)
            if n and len(got) >= share * n:
                got.sort(key=lum)
                cells[(r, c)] = got[len(got) // 2]
    # a speck: a cell no other part cell touches
    cells = {p: v for p, v in cells.items() if any((p[0] + j, p[1] + i) in cells for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    out = [['.'] * 24 for _ in range(36)]
    groups = {}
    for p, col in cells.items():
        k = min(keys, key=lambda k: d2(col, keys[k][1])) if len(keys) > 1 else list(keys)[0]
        groups.setdefault(k, []).append((p, col))
    for k, items in groups.items():
        letters = keys[k][0]
        ls = sorted(lum(c) for _, c in items)
        cut_ = [ls[int(len(ls) * f)] for f in (0.25, 0.55, 0.8)] if len(ls) > 3 else [0, 0, 0]
        for p, col in items:
            out[p[0]][p[1]] = letters[3 - sum(lum(col) > t for t in cut_)]
    # a cap or a hood is one piece over the head: above `solid` each row whole from its leftmost cell to its rightmost
    for y in range(solid):
        xs = [x for x in range(24) if out[y][x] != '.']
        if len(xs) >= 2:
            first = next(k for k in keys)
            for x in range(min(xs), max(xs) + 1):
                if out[y][x] == '.':
                    out[y][x] = keys[first][0][1]
    base, pal = read(base_p)
    worn = [list(r) for r in base]
    for y in range(36):
        for x in range(24):
            if out[y][x] != '.':
                worn[y][x] = out[y][x]
    # the part's edge against the background is its darkest tone
    for y in range(36):
        for x in range(24):
            if out[y][x] != '.' and any(not (0 <= y + j < 36 and 0 <= x + i < 24) or worn[y + j][x + i] == '.' for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                k = next(k for k, (letters, _) in keys.items() if out[y][x] in letters)
                out[y][x] = keys[k][0][3]
                worn[y][x] = out[y][x]
    tones = ''
    for k, (letters, col) in keys.items():
        for i, L in enumerate(letters):
            f = [1.25, 1.0, 0.72, 0.45][i]
            tones += f'{L} #' + '%02x%02x%02x' % tuple(max(0, min(255, int(col[j] * f))) for j in range(3)) + '\n'
    write(f'{kind}-{pid}-{facing}.txt', [''.join(r) for r in out], tones)
    pals = dict(l.split() for l in (pal + tones).strip().split('\n'))
    write(f'w-{kind}-{pid}-{facing}.txt', [''.join(r) for r in worn], '\n'.join(f'{k} {v}' for k, v in pals.items()) + '\n')
    subprocess.run([sys.executable, '-I', os.path.join(HERE, 'px.py'), 'load', f'w-{kind}-{pid}-{facing}.txt', f'w-{kind}-{pid}-{facing}.png'], check=True)
    return out


if __name__ == '__main__':
    a, skip = [], False
    for x in sys.argv[1:]:
        if skip:
            skip = False
        elif x.startswith('--'):
            skip = x in ('--facings', '--line', '--solid', '--share')
        else:
            a.append(x)
    kind, pid, body = a[0], a[1], a[2]
    keys = {}
    for i, spec in enumerate(a[3:]):
        letters, hexc = spec.split(':')
        keys[str(i + 1)] = (letters, tuple(int(hexc[j:j + 2], 16) for j in (1, 3, 5)))
    facings = sys.argv[sys.argv.index('--facings') + 1].split(',') if '--facings' in sys.argv else ['left', 'down', 'up']
    for f in facings:
        if os.path.exists(f'drafts/{kind}-{pid}-{f}.png'):
            cut(kind, pid, f, body, keys, share=float(sys.argv[sys.argv.index('--share') + 1]) if '--share' in sys.argv else 0.4, solid=int(sys.argv[sys.argv.index('--solid') + 1]) if '--solid' in sys.argv else 0)
            print(kind, pid, f)
