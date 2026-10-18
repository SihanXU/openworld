"""A step frame from a standing grid: the body above `split` one lower (the bob), each leg cut to fit and lifted.

    from walk import step
    rows = step(rows, split=27, legs=[(0, 11, [29], 0), (12, 23, [28, 29, 30], 2)])

A leg is (first col, last col, standing rows to drop, lift): its columns from `split` down lose the dropped rows and
are set so their last row lands `lift` above the sole row (34). Columns are a leg's alone below `split`.
"""

SOLE = 34


def step(rows, split, legs, bob=1):
    W = len(rows[0])
    out = [['.'] * W for _ in rows]
    for y in range(split):
        if 0 <= y + bob < len(rows):
            for x in range(W):
                out[y + bob][x] = rows[y][x]
    for c0, c1, drop, lift in legs:
        kept = [y for y in range(split, SOLE + 1) if y not in drop]
        top = SOLE - lift - len(kept) + 1
        for i, y in enumerate(kept):
            for x in range(c0, c1 + 1):
                if rows[y][x] != '.':
                    out[top + i][x] = rows[y][x]
    return [''.join(r) for r in out]


def read(path):
    t = open(path, encoding='utf-8').read().replace('\r', '')
    g, p = t.split('\n\n', 1)
    return g.split('\n')[:36], p


def write(path, rows, pal):
    open(path, 'w', newline='\n').write('\n'.join(rows) + '\n\n' + pal)


def sole_of(pattern):
    """A leg's bottom: its fill closed with outline, its outline corners left open (a rounded heel)."""
    return ''.join('K' if c not in '.K' else '.' for c in pattern)


def stride(rows, split, planted, lifted, bob=1, lift=2):
    """A step: the body one lower; the planted leg (c0, c1, drop) keeps its foot on the sole row; the lifted leg
    (c0, c1, top rows kept, shin row) is its top rows, then its shin down to `lift` above the sole, closed by a sole."""
    out = [list(r) for r in step(rows, split, [(*planted, 0)], bob)]
    c0, c1, keep, shin = lifted
    for y in range(split + bob, len(out)):
        for x in range(c0, c1 + 1):
            out[y][x] = '.'
    leg = [rows[y][c0:c1 + 1] for y in keep]
    end = SOLE - lift
    n = end - (split + bob) + 1
    pat = rows[shin][c0:c1 + 1]
    leg = leg + [pat] * (n - len(leg) - 1) + [sole_of(pat)]
    for i, seg in enumerate(leg):
        for j, ch in enumerate(seg):
            if ch != '.':
                out[split + bob + i][c0 + j] = ch
    return [''.join(r) for r in out]


def shift_block(rows, r0, r1, c0, c1, dx, dy=0, fill='.'):
    """Move the cells rows r0..r1 x cols c0..c1 by (dx, dy); what they leave is `fill` unless something else lands."""
    g = [list(r) for r in rows]
    block = [(y, x, rows[y][x]) for y in range(r0, r1 + 1) for x in range(c0, c1 + 1) if rows[y][x] != '.']
    for y, x, _ in block:
        g[y][x] = fill
    for y, x, ch in block:
        g[y + dy][x + dx] = ch
    return [''.join(r) for r in g]
