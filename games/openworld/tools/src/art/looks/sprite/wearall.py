"""Parts worn on frames as the runtime wears them, big: python -I wearall.py out.png ROW …
ROW = FRAME[,FRAME…]:part,part…   part: hair-<style> (back from hairs.json), d:<details id>, h:<head grid prefix> (…-<facing>.txt), o:<outfit>
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px import sprite
from walk import read

HP = 'a #b38a5c\nb #8f6845\nc #6b4a32\nd #4a3424\ne #2a1d14\nf #e0c070\ng #c0993c\nh #8a6a2a\ni #4a3a1a\nj #8a6a4a\nk #6a4a32\nl #4a3424\nm #2a1d14\nn #c08a4a\no #a6733a\np #f0f0e8\n'
backs = json.load(open('hairs.json')) if os.path.exists('hairs.json') else {}


def facing_of(n):
    return 'down' if 'DOWN' in n else 'up' if 'UP' in n else 'left'


def wear(frame, parts):
    g, pal = read(f'bg/{frame}.txt')
    cells = [list(r) for r in g]
    top = next(y for y, r in enumerate(g) if r.strip('.'))
    dy = top - 3
    f = facing_of(frame)
    pal = pal + HP
    for p in parts:
        if p.startswith('o:'):
            o, pp = read(f'of-{p[2:]}-{frame}.txt')
            pal += pp
            for y in range(36):
                for x in range(24):
                    if o[y][x] == '_': cells[y][x] = '.'
                    elif o[y][x] != '.': cells[y][x] = o[y][x]
            continue
        if p.startswith('hair-'):
            path = f'{p}-{f}.txt'
            b = backs.get(p[5:], {}).get(f, 13)
            br, bc = (int(str(b).split('@')[0]), int(str(b).split('@')[1]) if '@' in str(b) else 0)
        elif p.startswith('d:'):
            path, br, bc = f'details/{p[2:]}-{f}.txt', 99, 0
        else:
            path, br, bc = f'{p[2:]}-{f}.txt', 99, 0
        if not os.path.exists(path):
            continue
        h, _ = read(path)
        for y in range(36):
            for x in range(24):
                ch = h[y][x]
                Y = y + dy
                if ch == '.' or not 0 <= Y < 36:
                    continue
                if y >= br and x >= bc and cells[Y][x] != '.':
                    continue
                cells[Y][x] = ch
    P = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in (l.split() for l in pal.strip().split('\n'))}
    return sprite([''.join(r) for r in cells], P)


S = int(os.environ.get('S', 6))
rows = []
for a in sys.argv[2:]:
    frames, parts = a.split(':', 1)
    rows.append([(fr, parts.split(',')) for fr in frames.split(',')])
w = max(len(r) for r in rows)
img = Image.new('RGB', (w * (24 * S + 4) + 4, len(rows) * (36 * S + 4) + 4), (92, 128, 80))
for j, r in enumerate(rows):
    for i, (fr, parts) in enumerate(r):
        sp = wear(fr, parts).resize((24 * S, 36 * S), Image.NEAREST)
        img.paste(sp, (4 + i * (24 * S + 4), 4 + j * (36 * S + 4)), sp)
img.save(sys.argv[1])
