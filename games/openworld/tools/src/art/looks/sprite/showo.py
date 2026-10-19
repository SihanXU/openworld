"""Outfits on their frames, big: python -I showo.py out.png outfit:BODY[:FRAMES,…] …"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px import read, sprite
S = int(os.environ.get('S', 5))
FR = {'WOMAN': ['WOMAN_DOWN', 'WOMAN_DOWN_A', 'WOMAN_DOWN_B', 'WOMAN_LEFT', 'WOMAN_LEFT_A', 'WOMAN_LEFT_B', 'WOMAN_UP', 'WOMAN_UP_A'],
      'MAN': ['MAN_DOWN', 'MAN_DOWN_A', 'MAN_DOWN_B', 'MAN_LEFT', 'MAN_LEFT_A', 'MAN_LEFT_B', 'MAN_UP', 'MAN_UP_A']}
rows = []
for a in sys.argv[2:]:
    o, b = a.split(':')[:2]
    rows.append([f'dw-{o}-{n}.txt' for n in FR[b]])
img = Image.new('RGB', (8 * (24 * S + 4) + 4, len(rows) * (36 * S + 4) + 4), (92, 128, 80))
for j, r in enumerate(rows):
    for i, n in enumerate(r):
        if not os.path.exists(n):
            continue
        sp = sprite(*read(n)).resize((24 * S, 36 * S), Image.NEAREST)
        img.paste(sp, (4 + i * (24 * S + 4), 4 + j * (36 * S + 4)), sp)
img.save(sys.argv[1])
