"""An outfit cut from its draft onto a standing base.  python -I outfitfit.py outfit body facing key1=#rrggbb,key2=…,key3=…

The draft says which cloth lies where: every body cell below the chin is read in the dressed draft and called skin,
one of the outfit's keys or a dark line by the nearest reference colour; a lone cell takes its neighbours' cloth, and
the grey underclothes are always covered. The tone comes from the base itself (its light, mid, shade and dark), so the
cloth keeps the body's form. Cloth the draft puts beyond the body (a skirt, a coat's tail, a boot's cuff) is added with
its own tones and outlined. Written: o-<outfit>-<body>-<facing>.txt (the outfit alone: letters 1:qrst 2:uvwx 3:yzAB,
light to dark) and dw-…txt/.png (the base wearing it).
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from walk import read, write

LETTERS = {'1': 'qrst', '2': 'uvwx', '3': 'yzAB', '4': 'CDEG'}
TONE = {'O': 0, 'H': 0, 'V': 0, 'J': 1, 'F': 2, 'W': 2, 'T': 2, 'Q': 3, 'X': 3, 'M': 1, 'N': 1, 'P': 1}
FIT = {
    ('left', 'man'): ('drafts/l-man-33.png', '34:3,368:13,737:35', '33.4:0,16.8:13', 'bg/MAN_LEFT.txt'),
    ('left', 'woman'): ('drafts/l-woman-33.png', '34:3,355:13,739:35', '32.1:0,17.45:13', 'bg/WOMAN_LEFT.txt'),
    ('down', 'man'): ('drafts/front-man-e7.png', '34:3,364:14,737:35', '30:0,17.8:14', 'bg/MAN_DOWN.txt'),
    ('down', 'woman'): ('drafts/front-woman-e32.png', '34:3,350:13,358:14,580:24,738:35', '31:0,18:13', 'bg/WOMAN_DOWN.txt'),
    ('up', 'man'): ('drafts/back-man-e32.png', '36:3,360:13,376:14,510:22,588:27,728:35', '32:0,17:13', 'bg/MAN_UP.txt'),
    ('up', 'woman'): ('drafts/back-woman-e32.png', '34:3,348:13,356:14,580:24,730:35', '31:0,18:13', 'bg/WOMAN_UP.txt'),
}
SKIN = [(0xf6, 0xc8, 0x9c), (0xe8, 0x98, 0x68), (0xc0, 0x70, 0x48)]
DARK = (0x22, 0x20, 0x30)


def tones(keys):
    out = ''
    for k, col in keys.items():
        for i, letter in enumerate(LETTERS[k]):
            f = [1.22, 1.0, 0.76, 0.52][i]
            out += f'{letter} #' + '%02x%02x%02x' % tuple(max(0, min(255, int(col[j] * f))) for j in range(3)) + '\n'
    return out


def fit_child(draft, base_p):
    """A child's draft is an edit of the child's own frame drawn big, scaled and moved by the model: its scale and
    place from the head's top and the soles (rows 9 and 35) and the head's left edge at its widest row."""
    im = Image.open(draft).convert('RGB')
    W, H = im.size
    p = im.load()
    bg = lambda c: min(c) > 226
    ys = [y for y in range(H) if any(not bg(p[x, y]) for x in range(0, W, 2))]
    y_t, y_b = ys[0], ys[-1] + 1
    s = (y_b - y_t) / 26
    base, _ = read(base_p)
    r = 13
    x_l = min(x for x in range(24) if base[r][x] != '.')
    yy = int(y_t + (r - 9 + 0.5) * s)
    xb = next(x for x in range(W) if not bg(p[x, yy]))
    ox = xb - x_l * s
    return f'{y_t}:9,{y_b}:35', f'{s}:0', ox + 12 * s


def read_cloth(outfit, body, facing, keys):
    """The standing base, its body cells' cloth (a key, 'skin', or None: covered, unknown), and cloth beyond the body."""
    if body == 'child':
        base_p = f'bg/CHILD_{facing.upper()}.txt'
        bald_p = f'drafts/outfit-{outfit}-child-{facing}.png'
        kn, xs_s, cx0 = fit_child(bald_p, base_p)
    else:
        bald_p, kn, xs_s, base_p = FIT[(facing, body)]
        cx0 = None
    knots = sorted((int(r), float(y)) for y, r in (k.split(':') for k in kn.split(',')))
    xs = sorted((int(r), float(s)) for s, r in (k.split(':') for k in xs_s.split(',')))

    def ytop(r):
        for (r0, y0), (r1, y1) in zip(knots, knots[1:]):
            if r0 <= r <= r1:
                return y0 + (y1 - y0) * (r - r0) / (r1 - r0)

    def xscale(r):
        v = None
        for r0, s in xs:
            if r >= r0:
                v = s
        return v

    A = Image.open(bald_p).convert('RGB')
    B = Image.open(f'drafts/worn-{outfit.split(".")[1]}-{body}-{facing}.png' if '.' in outfit else f'drafts/outfit-{outfit}-{body}-{facing}.png').convert('RGB')
    W, H = A.size
    pa, pb = A.load(), B.load()
    bg = lambda c: min(c) > 226
    pts = [(x, y) for y in range(0, H, 2) for x in range(0, W, 2) if not bg(pa[x, y])]
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2 if cx0 is None else cx0
    base, pal = read(base_p)
    chin = next(y for y in range(36) if any(c != '.' for c in base[y])) + 9
    refs = [('skin', c) for c in SKIN] + [('dark', DARK)] + [(k, c) for k, c in keys.items()]
    # a piece worn over the underclothes (armour.plate) leaves them bare: their grey is read as no cloth
    worn = '.' in outfit
    if worn:
        refs += [('skin', c) for c in ((0xd0, 0xd0, 0xd0), (0xa8, 0xa8, 0xb0), (0x80, 0x80, 0x88))]
    d2 = lambda a, b: sum((a[i] - b[i]) ** 2 for i in range(3))

    def read_cell(r, c):
        ya, yb, s = ytop(r), ytop(r + 1), xscale(r)
        xa = cx + (c - 12) * s
        votes, cols, n = Counter(), [], 0
        for y in range(int(ya), int(yb) + 1):
            for x in range(int(xa), int(xa + s) + 1):
                if not (0 <= x < W and 0 <= y < H):
                    continue
                n += 1
                q = pb[x, y]
                if bg(q):
                    votes['bg'] += 1
                    continue
                k = min(refs, key=lambda kc: d2(q, kc[1]))[0]
                votes[k] += 1
                cols.append(q)
        return votes, cols, n

    cloth = {}
    extra = {}
    for r in range(chin + 1, 35):
        for c in range(24):
            votes, cols, n = read_cell(r, c)
            if not n:
                continue
            cloth_votes = {k: v for k, v in votes.items() if k in keys}
            if base[r][c] not in '.KL':
                if cloth_votes and sum(cloth_votes.values()) >= 0.35 * n:
                    cloth[(r, c)] = max(cloth_votes, key=cloth_votes.get)
                elif base[r][c] in 'VWTX' and not worn:
                    cloth[(r, c)] = None  # covered, its cloth from the neighbours
            elif base[r][c] == '.' and cloth_votes and sum(cloth_votes.values()) >= 0.5 * n:
                k = max(cloth_votes, key=cloth_votes.get)
                lum = sorted(0.3 * q[0] + 0.59 * q[1] + 0.11 * q[2] for q in cols)[len(cols) // 2]
                extra[(r, c)] = (k, lum)
    for p in [(r, c) for r in range(chin + 1, 35) for c in range(24) if base[r][c] not in '.KL' and (r, c) not in cloth]:
        cloth[p] = 'skin'
    # lone cells take their neighbours' cloth; the underclothes' cells too
    for _ in range(2):
        for p in list(cloth):
            y, x = p
            nb = Counter(cloth.get((y + j, x + i)) for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)) if cloth.get((y + j, x + i)) not in (None, 'skin'))
            if cloth[p] is None or (nb and cloth[p] not in nb and sum(nb.values()) >= 3):
                cloth[p] = nb.most_common(1)[0][0] if nb else None
    return base, cloth, extra, pal


def main():
    outfit, body, facing, keyspec = sys.argv[1:5]
    keys = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in (kv.split('=') for kv in keyspec.split(','))}
    base, cloth, extra, pal = read_cloth(outfit, body, facing, keys)
    out = [['.'] * 24 for _ in range(36)]
    for (y, x), k in cloth.items():
        if k and k != 'skin':
            out[y][x] = LETTERS[k][TONE.get(base[y][x], 1)]
    if extra:
        lums = sorted(v for _, v in extra.values())
        cut = [lums[int(len(lums) * f)] for f in (0.25, 0.55, 0.85)]
        for (y, x), (k, v) in extra.items():
            if any(0 <= y + j < 36 and 0 <= x + i < 24 and (out[y + j][x + i] != '.' or (y + j, x + i) in extra) for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = LETTERS[k][3 - sum(v > t for t in cut)]
    write(f'o-{outfit}-{body}-{facing}.txt', [''.join(r) for r in out], ''.join(f'{LETTERS[k][1]} #{"%02x%02x%02x" % keys[k]}\n' for k in keys))
    worn = [list(r) for r in base]
    for y in range(36):
        for x in range(24):
            if out[y][x] != '.' and worn[y][x] not in 'KL':
                worn[y][x] = out[y][x]
    for y in range(36):
        for x in range(24):
            if worn[y][x] == '.' and any(0 <= y + j < 36 and 0 <= x + i < 24 and out[y + j][x + i] != '.' and base[y + j][x + i] == '.' for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                worn[y][x] = 'K'
    tones = {}
    for k, col in keys.items():
        for i, L in enumerate(LETTERS[k]):
            f = [1.22, 1.0, 0.76, 0.52][i]
            tones[L] = '#%02x%02x%02x' % tuple(max(0, min(255, int(col[j] * f))) for j in range(3))
    write(f'dw-{outfit}-{body}-{facing}.txt', [''.join(r) for r in worn], pal + ''.join(f'{L} {v}\n' for L, v in tones.items()))
    print(outfit, body, facing, Counter(v for v in cloth.values()), len(extra), 'beyond the body')


if __name__ == '__main__':
    main()
