"""Drafts side by side, small: python -I showd.py out.png name… (drafts/<name>-<facing>.png for down, left, up)"""
import sys
from PIL import Image
names = sys.argv[2:]
S = 256
o = Image.new('RGB', (3 * S, len(names) * S), 'white')
for j, n in enumerate(names):
    for i, f in enumerate(('down', 'left', 'up')):
        try:
            o.paste(Image.open(f'drafts/{n}-{f}.png').convert('RGB').resize((S, S)), (i * S, j * S))
        except FileNotFoundError:
            pass
o.save(sys.argv[1])
