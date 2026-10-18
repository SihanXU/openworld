"""The cloak worn over any outfit (cloak.cloak) from the long cloak's outfit (outfit.cloak), frame by frame.

    python -I worncloak.py   (in the work folder, after outfit.py cloak for the man and the woman)

The worn cloak's own drafts read badly (its oatmeal is the skin's), and the outfit's cloak is already laid on every
frame; so the worn one is that cloak's cloth alone (its key 1) where a cloak worn over other clothes shows: beside
the body and the legs, over the arms and the shoulders, and the whole back. Written: of-cloak.cloak-<FRAME>.txt in
the cloak slot's letters (4567).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write
from regions import label

FRAMES = {
    'man': ['MAN_DOWN', 'MAN_DOWN_A', 'MAN_DOWN_B', 'MAN_UP', 'MAN_UP_A', 'MAN_UP_B', 'MAN_LEFT', 'MAN_LEFT_A', 'MAN_LEFT_B'],
    'woman': ['WOMAN_DOWN', 'WOMAN_DOWN_PASS', 'WOMAN_DOWN_A', 'WOMAN_DOWN_B', 'WOMAN_UP', 'WOMAN_UP_PASS', 'WOMAN_UP_A',
              'WOMAN_UP_B', 'WOMAN_LEFT', 'WOMAN_LEFT_A', 'WOMAN_LEFT_B'],
}
TO = dict(zip('qrst', '4567'))

for body, names in FRAMES.items():
    for name in names:
        frame, _ = read(f'bg/{name}.txt')
        cloak, pal = read(f'of-cloak-{name}.txt')
        lab, marks = label(frame, body)
        back = 'UP' in name
        out = [['.'] * 24 for _ in range(36)]
        for y in range(36):
            for x in range(24):
                ch = cloak[y][x]
                if ch in TO and (back or frame[y][x] == '.' or lab[y][x] in 'uad' or y <= marks['chin'] + 3):
                    out[y][x] = TO[ch]
        # its outline where it meets the background
        for y in range(36):
            for x in range(24):
                if cloak[y][x] == 'K' and frame[y][x] == '.' and any(0 <= y + j < 36 and 0 <= x + i < 24 and out[y + j][x + i] in '4567' for j, i in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out[y][x] = 'K'
        tones = ''.join(f'{TO[k]} {v}\n' for k, v in (l.split() for l in pal.strip().split('\n')) if k in TO)
        write(f'of-cloak.cloak-{name}.txt', [''.join(r) for r in out], tones)
        print(f'of-cloak.cloak-{name}.txt')
