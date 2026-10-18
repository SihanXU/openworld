"""Every hairstyle worn as the game wears it (the runtime's layering), on both bodies: python -I hairpreview.py out.png"""
import json, os, sys
sys.path.insert(0, os.getcwd())
from PIL import Image
from walk import read
from px import sprite, hexrgb
spec = json.load(open('hairs.json'))
BASE = {('man', 'down'): 'MAN_DOWN', ('man', 'left'): 'MAN_LEFT', ('man', 'up'): 'MAN_UP',
        ('woman', 'down'): 'WOMAN_DOWN', ('woman', 'left'): 'WOMAN_LEFT', ('woman', 'up'): 'WOMAN_UP'}
S = 4
rows_out = []
for style, back in spec.items():
    cells = []
    for body in ('man', 'woman'):
        for facing in ('down', 'left', 'up'):
            base, pal = read(BASE[(body, facing)] + '.txt')
            hair, hpal = read(f'hair-{style}-{facing}.txt')
            r, _, c = str(back[facing]).partition('@')
            br, bc = int(r), int(c or 0)
            g = [list(x) for x in base]
            for y, line in enumerate(hair):
                for x, ch in enumerate(line):
                    if ch == '.':
                        continue
                    if y >= br and x >= bc and base[y][x] != '.':
                        continue
                    g[y][x] = ch
            pals = {k: hexrgb(v) for k, v in (l.split() for l in (pal + hpal).strip().split('\n'))}
            cells.append(sprite([''.join(x) for x in g], pals).resize((24 * S, 36 * S), Image.NEAREST))
    rows_out.append(cells)
W = 6 * (24 * S + 6) + 12
H = len(rows_out) * (36 * S + 6) + 12
img = Image.new('RGB', (W, H), (92, 128, 80))
for j, cells in enumerate(rows_out):
    for i, c in enumerate(cells):
        img.paste(c, (6 + i * (24 * S + 6) + (12 if i >= 3 else 0) - (6 if i >= 3 else 0), 6 + j * (36 * S + 6)), c)
img.save(sys.argv[1])
