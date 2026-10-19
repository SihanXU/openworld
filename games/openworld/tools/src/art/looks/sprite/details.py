"""The face's small parts on the bases, drawn by hand on the standing head: python -I details.py

Each is a set of cells per facing (down: the front, left: the 3/4 view; from behind nothing shows), in the base's own
letters (K the line, F Q the skin's shades, so they take the look's skin) or the glasses' n o p. Writes d-<id>-<facing>.txt
and a sheet, details.png, of every one worn on both bodies.
"""
import os, sys
sys.path.insert(0, os.getcwd())
from walk import read, write
from px import read as pxread, sprite
from PIL import Image

D = {
    # faces: the base's eyes are the bright ones
    'face.soft': {'down': {(8, 9): 'Q', (8, 10): 'Q', (8, 13): 'Q', (8, 14): 'Q'},
                  'left': {(8, 8): 'Q', (8, 11): 'Q', (8, 12): 'Q'}},
    'face.keen': {'down': {(10, 9): 'J', (10, 10): 'M', (10, 13): 'M', (10, 14): 'J'},
                  'left': {(10, 8): 'M', (10, 11): 'M', (10, 12): 'J'}},
    'face.stern': {'down': {(7, 8): 'K', (7, 9): 'K', (7, 10): 'K', (7, 13): 'K', (7, 14): 'K', (7, 15): 'K'},
                   'left': {(7, 8): 'K', (7, 11): 'K', (7, 12): 'K', (7, 13): 'K'}},
    'face.child': {'down': {(9, 9): 'M', (9, 10): 'M', (9, 13): 'M', (9, 14): 'M', (10, 9): 'O', (10, 10): 'P', (10, 13): 'P', (10, 14): 'O', (11, 9): 'P', (11, 10): 'P', (11, 13): 'P', (11, 14): 'P'},
                   'left': {(9, 8): 'M', (10, 8): 'P', (11, 8): 'P', (9, 11): 'M', (9, 12): 'M', (10, 11): 'P', (10, 12): 'O', (11, 11): 'P', (11, 12): 'P'}},
    'face.weary': {'down': {(9, 10): 'K', (9, 13): 'K', (9, 9): 'F', (9, 14): 'F'},
                   'left': {(9, 8): 'K', (9, 11): 'K', (9, 12): 'F'}},
    # glasses: round rims under and beside the eyes, a bridge between
    'glasses.round': {'down': {(9, 8): 'o', (10, 8): 'o', (11, 9): 'o', (11, 10): 'o', (10, 11): 'n', (9, 11): 'p',
                               (9, 12): 'p', (10, 12): 'n', (11, 13): 'o', (11, 14): 'o', (10, 15): 'o', (9, 15): 'o'},
                      'left': {(11, 8): 'o', (9, 10): 'p', (11, 11): 'o', (11, 12): 'o', (10, 13): 'o', (9, 13): 'o', (9, 14): 'n', (9, 15): 'n'}},
    'mark.scar': {'down': {(9, 14): 'Q', (10, 15): 'Q', (11, 14): 'Q'},
                  'left': {(10, 13): 'Q', (11, 14): 'Q', (9, 14): 'Q'}},
    'mark.freckles': {'down': {(11, 9): 'F', (11, 11): 'F', (11, 12): 'F', (11, 14): 'F'},
                      'left': {(11, 9): 'F', (11, 10): 'F', (11, 12): 'F'}},
    'age.lined': {'down': {(11, 8): 'F', (11, 15): 'F', (12, 10): 'F', (12, 13): 'F'},
                  'left': {(11, 8): 'F', (11, 12): 'F', (12, 10): 'F'}},
}
PAL = 'n #c08a4a\no #a6733a\np #f0f0e8\n'
os.makedirs('details', exist_ok=True)
for pid, facings in D.items():
    for f, cells in facings.items():
        g = [['.'] * 24 for _ in range(36)]
        for (y, x), ch in cells.items():
            g[y][x] = ch
        write(f'details/{pid}-{f}.txt', [''.join(r) for r in g], PAL)
# the sheet: every detail on both bodies, front and 3/4, at 6x
S = 12
crop = (5, 4, 19, 14)
items = list(D) if len(sys.argv) < 2 else sys.argv[1].split(',')
img = Image.new('RGB', (len(items) * (2 * ((crop[2] - crop[0]) * S + 6)) + 12, 2 * ((crop[3] - crop[1]) * S + 8) + 12), (92, 128, 80))
for i, pid in enumerate(items):
    for j, body in enumerate(('MAN', 'WOMAN')):
        for k, f in enumerate(('down', 'left')):
            base, pal = read(f'bg/{body}_{f.upper()}.txt')
            g = [list(r) for r in base]
            for (y, x), ch in D[pid][f].items():
                g[y][x] = ch
            rows, p2 = [''.join(r) for r in g], dict(l.split() for l in (pal + PAL).strip().split('\n'))
            sp = sprite(rows, {kk: tuple(int(v[q:q + 2], 16) for q in (1, 3, 5)) for kk, v in p2.items()}).crop(crop)
            sp = sp.resize((sp.width * S, sp.height * S), Image.NEAREST)
            img.paste(sp, (6 + i * (2 * (sp.width + 6)) + k * (sp.width + 6), 6 + j * (sp.height + 8)), sp)
img.save('details.png')
print(len(items), 'details')
