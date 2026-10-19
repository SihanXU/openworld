"""An outfit on every frame of a facing.  python -I outfit.py outfit body facing   (body: man, woman, child)

Its spec is outfits.json's entry: "keys" (each key's colour in the drafts, the reference its cloth is read by),
"fixed" (keys in a colour of the outfit's own), "arm" and "leg" ([[up to, cloth], …]: a limb's cloth by how far along
it, 0 at the shoulder or the hip, 1 at the hand or the sole; "skin" bare), "skirt" ({key, bottom}: from the hem to that
row one cloth across, the gap between the legs filled), "panels" (pieces laid by place on rects of the standing
frame's rows and columns, moved with each frame's bob and hips: an apron, a belt, a stole, a tabard, braces), "as"
(a key the drafts show read as another: what a panel draws instead), a facing's own "torso" (one cloth: a jacket's
back), and a body's own overrides ("woman": {…}).

The draft (outfitfit.py's reading) says which cloth lies on each body cell of the standing frame. From it: a limb's
cloth by the spans, the torso's and the hips' by place (an open jacket over a shirt), moved with the torso in a
step. Every frame of the facing is then dressed by its own body parts, so the clothes follow its arms and legs; the
tone of each cell is the base's own (its light, mid, shade, dark). Under one cloth the body's own lines go (the
waist's, the legs' between them); a long skirt keeps its standing shape in the 3/4 stride, the stride's legs cleared.
Written: of-<outfit>-<FRAME>.txt (the outfit alone) and dw-<outfit>-<FRAME>.txt (worn). Needs the bases' grids in
bg/ (bases.py out bg) and the drafts in drafts/ (drafts/outfit-<outfit>-<body>-<facing>.png).
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write
import outfitfit
from regions import label

FRAMES = {
    ('man', 'down'): ['MAN_DOWN', 'MAN_DOWN_A', 'MAN_DOWN_B'],
    ('man', 'up'): ['MAN_UP', 'MAN_UP_A', 'MAN_UP_B'],
    ('man', 'left'): ['MAN_LEFT', 'MAN_LEFT_A', 'MAN_LEFT_B'],
    ('woman', 'down'): ['WOMAN_DOWN', 'WOMAN_DOWN_PASS', 'WOMAN_DOWN_A', 'WOMAN_DOWN_B'],
    ('woman', 'up'): ['WOMAN_UP', 'WOMAN_UP_PASS', 'WOMAN_UP_A', 'WOMAN_UP_B'],
    ('woman', 'left'): ['WOMAN_LEFT', 'WOMAN_LEFT_A', 'WOMAN_LEFT_B'],
    ('child', 'down'): ['CHILD_DOWN', 'CHILD_DOWN_PASS', 'CHILD_DOWN_A', 'CHILD_DOWN_B'],
    ('child', 'up'): ['CHILD_UP', 'CHILD_UP_PASS', 'CHILD_UP_A', 'CHILD_UP_B'],
    ('child', 'left'): ['CHILD_LEFT', 'CHILD_LEFT_A', 'CHILD_LEFT_B'],
}
BINS = 10
L, TONE = outfitfit.LETTERS, outfitfit.TONE


def profiles(base, cloth, body):
    dist = {}
    lab, marks = label(base, body, dist)
    limb = {'arm': [Counter() for _ in range(BINS)], 'leg': [Counter() for _ in range(BINS)]}
    torso = {}
    t0 = marks['chin'] + 2
    for (y, x), k in cloth.items():
        if base[y][x] in 'KL' or k is None:
            continue
        if (y, x) in dist:
            kind, dn = dist[(y, x)]
            limb[kind][min(BINS - 1, int(dn * BINS))][k] += 1
        elif lab[y][x] in 'tpn':
            torso[(y - t0, x)] = k
    prof = {}
    for kind, bins in limb.items():
        got = [b.most_common(1)[0][0] if b else None for b in bins]
        for i in range(BINS):
            if got[i] is None:
                near = [got[j] for j in sorted(range(BINS), key=lambda j: abs(j - i)) if got[j] is not None]
                got[i] = near[0] if near else 'skin'
        prof[kind] = got
    return prof, torso


def skirt_mask(base, cloth, extra, body, key):
    """The skirt's cells on the standing frame, from its hem down: (rows below the hem, column)."""
    lab, marks = label(base, body)
    hem = marks['hem']
    # the skirt is all its own cloth (what lies over it, an apron, is a piece laid by place)
    cells = {(y - hem, x): key for (y, x), k in cloth.items() if y > hem and k not in (None, 'skin')}
    cells.update({(y - hem, x): key for (y, x), (k, _) in extra.items() if y > hem})
    return cells


def fill_rows(cells, keys):
    """A piece laid over the cloth (an apron) is whole across each row: its cells from its leftmost to its rightmost."""
    for k in keys:
        rows = {}
        for (y, x), v in cells.items():
            if v == k:
                rows.setdefault(y, []).append(x)
        for y, xs in rows.items():
            for x in range(min(xs), max(xs) + 1):
                cells[(y, x)] = k
    return cells


def wear_skirt(frame, body, out, mask, key, bottom, open_=False):
    """A skirt on a frame: from the hem to its bottom row every body cell is skirt, and so is the standing skirt's
    shape (the gap between the legs); its silhouette outlined. Below it the frame's feet stay. An open one (a cloak
    from the front) is only the standing skirt's cells beside the legs: the legs between keep their own clothes."""
    lab, marks = label(frame, body)
    hem = marks['hem']
    arms = arms_of(lab, marks)
    hips = [x for y in range(marks['waist'], hem + 1) for x in range(24) if lab[y][x] == 'p']
    lo, hi = min(hips), max(hips)
    cells = set()
    for y in range(hem + 1, bottom + 1):
        # the body's cells and the standing skirt's, never the hands, flaring a cell every two rows from the hips
        k = 1 + (y - hem) // 2
        if open_:
            # each side from the standing cloak's edge in to the legs (or the hands)
            mid = (lo + hi) / 2
            xs = [x for x in range(24) if (y - hem, x) in mask]
            left = [x for x in xs if x < mid]
            right = [x for x in xs if x > mid]
            if left:
                x = min(left)
                while x < mid and frame[y][x] in '.KL' and (y, x) not in arms:
                    cells.add((y, x))
                    x += 1
            if right:
                x = max(right)
                while x > mid and frame[y][x] in '.KL' and (y, x) not in arms:
                    cells.add((y, x))
                    x -= 1
            continue
        row = [x for x in range(lo - k, hi + k + 1) if 0 <= x < 24 and (y, x) not in arms and (frame[y][x] != '.' or (y - hem, x) in mask)]
        # a skirt is one cloth across: each row from its leftmost cell to its rightmost
        if row:
            cells |= {(y, x) for x in range(min(row), max(row) + 1)}
    # its sides never narrow going down and widen a cell a row at most
    spans = {}
    for (y, x) in cells:
        a, b = spans.get(y, (x, x))
        spans[y] = (min(a, x), max(b, x))
    prev = None
    for y in range(hem + 1, bottom + 1 if not open_ else hem + 1):
        if y not in spans:
            continue
        a, b = spans[y]
        if prev:
            a = min(max(a, prev[0] - 1), prev[0])
            b = max(min(b, prev[1] + 1), prev[1])
            for x in range(a, b + 1):
                if (y, x) not in cells and frame[y][x] not in '.KL' or True:
                    cells.add((y, x))
            cells -= {(y, x) for x in range(24) if x < a or x > b}
        spans[y] = prev = (a, b)
    xs = [x for (_, x) in cells] or [12]
    lo, hi = min(xs), max(xs)
    for (y, x) in cells:
        ch = frame[y][x]
        if ch in 'OHJFQVWTX':
            tone = TONE.get(ch, 1)
        else:
            f = (x - lo) / max(1, hi - lo)
            tone = 2 if open_ else 0 if f < 0.2 else 1 if f < 0.65 else 2
        k = mask.get((y - hem, x), key)
        if k != key:
            same = lambda j, i: mask.get((y - hem + j, x + i)) == k
            tone = 2 if not same(0, 1) or not same(1, 0) else 0 if not same(0, -1) else 1
        out[y][x] = L[k][tone]
    edge = set()
    for (y, x) in cells:
        for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (y + j, x + i)
            if 0 <= p[0] < 36 and 0 <= p[1] < 24 and p not in cells and frame[p[0]][p[1]] in '.KL':
                edge.add(p)
    return cells, edge


def arms_of(lab, marks):
    """A frame's arm cells: labelled arm and outside the hips' columns (skin between the hips is the thighs' top)."""
    hips = [x for y in range(marks['waist'], marks['hem'] + 1) for x in range(24) if lab[y][x] == 'p']
    lo, hi = (min(hips), max(hips)) if hips else (24, -1)
    return {(y, x) for y in range(36) for x in range(24) if lab[y][x] in 'uad' and not (y >= marks['hem'] - 1 and lo <= x <= hi)}


def restride(frame, out, stand, stand_worn, body, bottom):
    """A long skirt in a 3/4 stride: the legs are hidden, so the skirt keeps the standing one's shape (a row shorter
    for the step's bob) under this frame's hips, its hem a cell wider each side, and the feet peek out a cell ahead and
    a cell behind. The stride's own legs below the hips are erased ('_')."""
    lab, marks = label(frame, body)
    slab, smarks = label(stand, body)
    hem, shem = marks['hem'], smarks['hem']
    mid = lambda lb, m: sum(x for y in range(m['waist'], m['hem'] + 1) for x in range(24) if lb[y][x] == 'p') / max(1, sum(1 for y in range(m['waist'], m['hem'] + 1) for x in range(24) if lb[y][x] == 'p'))
    dx = round(mid(lab, marks) - mid(slab, smarks))
    n_f, n_s = bottom - hem, bottom - shem
    arms = arms_of(lab, marks)
    for y in range(hem, 36):
        for x in range(24):
            if (y, x) in arms:
                continue
            if lab[y][x] in 'gsfuad' or (frame[y][x] in 'KL' and y > hem + 1):
                out[y][x] = '_' if frame[y][x] != '.' else '.'
            elif y > hem:
                out[y][x] = '.' if out[y][x] != '_' else '_'
    sarms = arms_of(slab, smarks)
    for y in range(hem, 35):
        ys = shem + round((y - hem) * n_s / max(1, n_f)) if y <= bottom else y
        for x in range(24):
            xs = x - dx
            if not 0 <= xs < 24 or (y, x) in arms or (ys, xs) in sarms or (slab[ys][xs] in 'uad' and stand[ys][xs] in 'KL'):
                continue
            ch = stand_worn[ys][xs]
            if ch != '.' and (ys > shem or frame[y][x] not in 'VWTX'):
                out[y][x] = ch
    # the hem a cell wider each side on its last rows, the feet apart
    for y in range(bottom - 1, bottom + 1):
        row = [x for x in range(24) if out[y][x] not in '._' and out[y][x] != 'K' and (y, x) not in arms]
        if row:
            lo, hi = min(row), max(row)
            if lo - 1 >= 0:
                out[y][lo - 1] = out[y][lo]
                out[y][lo - 2] = 'K' if lo - 2 >= 0 else out[y][lo - 2]
            if hi + 2 < 24:
                out[y][hi + 1] = out[y][hi]
                out[y][hi + 2] = 'K'
    feet = [(y, x) for y in range(bottom + 1, 35) for x in range(24) if out[y][x] not in '._']
    if feet:
        cut = (min(x for _, x in feet) + max(x for _, x in feet)) / 2
        moved = {}
        for (y, x) in feet:
            moved[(y, x - 1 if x < cut else x + 1)] = out[y][x]
            out[y][x] = '_' if frame[y][x] != '.' else '.'
        for (y, x), ch in moved.items():
            if 0 <= x < 24:
                out[y][x] = ch
        # the gap between the feet closed under the hem
        for (y, x) in [(bottom + 1, x) for x in range(24)]:
            if out[y][x] in '._' and out[y - 1][x] not in '._K' and (out[y][x - 1] not in '._' or out[y][x + 1] not in '._'):
                out[y][x] = 'K'
    return out


def close_lines(frame, body, out):
    """Under a dress the body's own lines between the hips and the hem are hidden: a line cell with the dress on its
    left and its right (and no arm beside it) takes the dress's cloth."""
    lab, marks = label(frame, body)
    arms = arms_of(lab, marks)
    cloth = lambda y, x: 0 <= x < 24 and out[y][x] not in '._K' and (y, x) not in arms
    line = lambda y, x: (out[y][x] if out[y][x] != '.' else frame[y][x]) in 'KL'
    for y in range(marks['waist'], min(36, marks['hem'] + 3)):
        x = 1
        while x < 23:
            # a run of one or two line cells between the dress's cloth
            n = 1 if line(y, x) and not line(y, x + 1) else 2 if line(y, x) and x + 2 < 24 and line(y, x + 1) and not line(y, x + 2) else 0
            run = [(y, x + i) for i in range(n)]
            if n and cloth(y, x - 1) and cloth(y, x + n) and not any((y + j, c + i) in arms for (_, c) in run for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                for (_, c) in run:
                    out[y][c] = out[y][x - 1]
            x += max(1, n)
    # and a line across the body under one cloth: the cloth above it and below it
    for y in range(marks['chin'] + 3, min(35, marks['hem'] + 3)):
        for x in range(24):
            here = out[y][x] if out[y][x] != '.' else frame[y][x]
            if here in 'KL' and cloth(y - 1, x) and cloth(y + 1, x) and not any((y + j, x + i) in arms for j, i in ((0, 1), (0, -1))):
                out[y][x] = out[y + 1][x]


def wear_cape(frame, body, out, stand, extra, key):
    """A cloak hanging from the shoulders beside the body (seen from the front or the side): the standing draft's
    cloth of that key beyond the body, from below the chin to the hem, each row filled in to the body and outlined,
    moved with the frame's bob."""
    lab, marks = label(frame, body)
    slab, smarks = label(stand, body)
    dy = marks['top'] - smarks['top']
    rows = {}
    for (y, x), (k, _) in extra.items():
        if k == key and smarks['chin'] + 3 <= y <= smarks['hem']:
            rows.setdefault(y + dy, []).append(x)
    cells = set()
    for y, xs in rows.items():
        if not 0 <= y < 36:
            continue
        body_x = [x for x in range(24) if frame[y][x] != '.' or out[y][x] not in '._']
        if not body_x:
            continue
        lo, hi = min(body_x), max(body_x)
        for x in xs:
            if x < lo:
                cells |= {(y, c) for c in range(x, lo)}
            elif x > hi:
                cells |= {(y, c) for c in range(hi + 1, x + 1)}
    for (y, x) in cells:
        out[y][x] = L[key][2]
    for (y, x) in cells:
        for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (y + j, x + i)
            if 0 <= p[0] < 36 and 0 <= p[1] < 24 and p not in cells and frame[p[0]][p[1]] == '.' and out[p[0]][p[1]] in '._':
                out[p[0]][p[1]] = 'K'


def wear_panels(frame, body, out, worn, panels, facing, stand):
    """Pieces laid on the outfit by place (an apron, a belt, a tabard, a stole): rects in the standing frame's rows and
    columns, moved with this frame's bob and hips. A piece covers the body and the skirt (and the lines inside them),
    never an arm, never the background. Its tones: a belt follows the body's shading; a panel is flat, light on its
    left column, in shade on its right and dark on its last row."""
    lab, marks = label(frame, body)
    slab, smarks = label(stand, body)
    dy = marks['top'] - smarks['top']
    mid = lambda lb, m: sum(x for y in range(m['waist'], m['hem'] + 1) for x in range(24) if lb[y][x] == 'p') / max(1, sum(1 for y in range(m['waist'], m['hem'] + 1) for x in range(24) if lb[y][x] == 'p'))
    dx = round(mid(lab, marks) - mid(slab, smarks))
    arms = arms_of(lab, marks)
    for p in panels:
        cells = set()
        for y0, y1, x0, x1 in p.get(facing, []):
            for y in range(y0 + dy, y1 + dy + 1):
                for x in range(x0 + dx, x1 + dx + 1):
                    if not (0 <= y < 36 and 0 <= x < 24) or worn[y][x] == '.' or (y, x) in arms or lab[y][x] == 'h':
                        continue
                    if worn[y][x] in 'KL' and not (0 < x < 23 and worn[y][x - 1] != '.' and worn[y][x + 1] != '.' and (y, x - 1) not in arms and (y, x + 1) not in arms):
                        continue
                    cells.add((y, x))
        for (y, x) in cells:
            if p.get('shade') == 'body':
                tone = TONE.get(frame[y][x], 1)
            else:
                tone = 2 if (y + 1, x) not in cells or (y, x + 1) not in cells else 0 if (y, x - 1) not in cells else 1
            out[y][x] = worn[y][x] = L[p['key']][tone]


def torso_centres(frame, body):
    """Each row's middle of the torso and hips (rows from two below the chin)."""
    lab, marks = label(frame, body)
    t0 = marks['chin'] + 2
    out = {}
    for y in range(t0, marks['hem'] + 1):
        xs = [x for x in range(24) if lab[y][x] in 'tp']
        if xs:
            out[y - t0] = (min(xs) + max(xs)) / 2
    return out


def dress(frame, body, prof, torso, stand=None):
    """The outfit on a frame: limbs by their spans, the torso by place — in a step, the place moved with the torso
    (each row by how far its middle moved from the standing frame's)."""
    dist = {}
    lab, marks = label(frame, body, dist)
    t0 = marks['chin'] + 2
    shift = {}
    if stand is not None:
        a, b = torso_centres(frame, body), torso_centres(stand, body)
        shift = {r: round(a[r] - b[r]) for r in a if r in b}
    out = [['.'] * 24 for _ in range(36)]
    for y in range(36):
        for x in range(24):
            ch = frame[y][x]
            if ch in '.KL' or lab[y][x] in '.h':
                continue
            if (y, x) in dist:
                kind, dn = dist[(y, x)]
                k = prof[kind][min(BINS - 1, int(dn * BINS))]
            elif lab[y][x] in 'tpn':
                key = (y - t0, x - shift.get(y - t0, 0))
                if key in torso:
                    k = torso[key]
                else:
                    cand = [(abs(r - key[0]) * 2 + abs(c - key[1]), v) for (r, c), v in torso.items() if abs(r - key[0]) <= 1]
                    k = min(cand)[1] if cand else ('skin' if ch not in 'VWTX' else None)
                if lab[y][x] == 'n' and key not in torso:
                    k = 'skin'
            else:
                continue
            if k and k != 'skin':
                out[y][x] = L[k][TONE.get(ch, 1)]
    return out


def spans(spec):
    """A limb's cloth along it from the outfit's spec: [[up to, cloth], …] -> a cloth per bin."""
    out = []
    for i in range(BINS):
        d = (i + 0.5) / BINS
        out.append(next(k for upto, k in spec if d <= upto))
    return out


def main():
    import json
    outfit, body, facing = sys.argv[1:4]
    spec = json.load(open('outfits.json'))[outfit]
    # a body may say otherwise (a coat shorter on the woman, the stole closer)
    spec = {**spec, **spec.get(body, {})}
    keys = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in spec['keys'].items()}
    base, cloth, extra, _ = outfitfit.read_cloth(outfit, body, facing, keys)
    for k, to in spec.get('as', {}).items():
        cloth = {p: (to if v == k else v) for p, v in cloth.items()}
        extra = {p: ((to, l) if v == k else (v, l)) for p, (v, l) in extra.items()}
    prof, torso = profiles(base, cloth, body)
    for kind in ('arm', 'leg'):
        if kind in spec:
            prof[kind] = spans(spec[kind])
    # a facing may say the torso is one cloth (a jacket's back: the shirt's opening is the front's)
    whole = spec.get(facing, {}).get('torso')
    if whole:
        dist = {}
        lab, marks = label(base, body, dist)
        t0 = marks['chin'] + 2
        for key in list(torso):
            y = key[0] + t0
            if lab[y][key[1]] == 't':
                torso[key] = whole
    print(outfit, body, facing, 'arm', ''.join(p[0] if p != 'skin' else '.' for p in prof['arm']), 'leg', ''.join(p[0] if p != 'skin' else '.' for p in prof['leg']))
    tones = outfitfit.tones(keys)
    sk = spec.get(facing, {}).get('skirt', spec.get('skirt'))
    mask = fill_rows(skirt_mask(base, cloth, extra, body, sk['key']), spec.get('fill', [])) if sk else None
    if spec.get('fill'):
        # the same piece above the skirt (an apron's bib, its waist)
        rows = {}
        for (r, c), v in torso.items():
            rows.setdefault(r, {})[c] = v
        for k in spec['fill']:
            for r, cols in rows.items():
                xs = [c for c, v in cols.items() if v == k]
                if xs:
                    for c in range(min(xs), max(xs) + 1):
                        if c in cols:
                            torso[(r, c)] = k
    if spec.get('belt'):
        # a belt: the torso's row at the waist, all one cloth
        lab, marks = label(base, body)
        t0 = marks['chin'] + 2
        r = marks['waist'] - t0 + spec['belt'].get('at', 0)
        for (rr, c) in list(torso):
            if rr == r:
                torso[(rr, c)] = spec['belt']['key']
    stand_worn = None
    for name in FRAMES[(body, facing)]:
        frame, pal = read(f'bg/{name}.txt')
        out = dress(frame, body, prof, torso, read(f'bg/{FRAMES[(body, facing)][0]}.txt')[0])
        worn = [list(r) for r in frame]
        stride = sk and not sk.get('open') and facing == 'left' and stand_worn is not None and sk['bottom'] >= 30
        if sk and not stride:
            cells, edge = wear_skirt(frame, body, out, mask, sk['key'], sk['bottom'], sk.get('open', False))
            for (y, x) in cells:
                worn[y][x] = out[y][x]
            for (y, x) in edge:
                if frame[y][x] in '.KL' or (y, x) not in cells:
                    worn[y][x] = 'K'
                    out[y][x] = 'K'
        if stride:
            out = restride(frame, out, read(f'bg/{FRAMES[(body, facing)][0]}.txt')[0], stand_worn, body, sk['bottom'])
        if spec.get('cape') and facing != 'up':
            wear_cape(frame, body, out, base, extra, spec['cape'])
        if spec.get('panels'):
            w2 = [list(r) for r in frame]
            for y in range(36):
                for x in range(24):
                    if out[y][x] != '.':
                        w2[y][x] = '.' if out[y][x] == '_' else out[y][x]
            wear_panels(frame, body, out, w2, spec['panels'], facing, read(f'bg/{FRAMES[(body, facing)][0]}.txt')[0])
        if sk:
            close_lines(frame, body, out)
        # a worn piece (armour.plate, cloak.cloak) is in its slot's letters: its key 1 as 0123 or 4567
        slot_letters = {'armour': '0123', 'cloak': '4567'}.get(outfit.split('.')[0]) if '.' in outfit else None
        if slot_letters:
            out = [[slot_letters['qrst'.index(c)] if c in 'qrst' else c for c in r] for r in out]
            tones_w = tones + ''.join(f"{slot_letters[i]} {l.split()[1]}\n" for i, l in enumerate(tones.strip().split('\n')[:4]))
        else:
            tones_w = tones
        write(f'of-{outfit}-{name}.txt', [''.join(r) for r in out], tones_w)
        for y in range(36):
            for x in range(24):
                if out[y][x] != '.':
                    worn[y][x] = '.' if out[y][x] == '_' else out[y][x]
        if stand_worn is None:
            stand_worn = [r[:] for r in worn]
        write(f'dw-{outfit}-{name}.txt', [''.join(r) for r in worn], pal + tones_w)


if __name__ == '__main__':
    main()
