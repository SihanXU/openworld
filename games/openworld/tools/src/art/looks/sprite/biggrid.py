"""Rows r0.. of a grid big with a ruler: python -I biggrid.py grid.txt out.png [r0]"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from px import read
rows, pal = read(sys.argv[1])
r0 = int(sys.argv[3]) if len(sys.argv) > 3 else 14
s = 20
n = len(rows) - r0
im = Image.new('RGB', (24 * s + 40, n * s + 40), (92, 128, 80))
d = ImageDraw.Draw(im)
for y in range(r0, len(rows)):
    for x, ch in enumerate(rows[y]):
        if ch != '.':
            d.rectangle([30 + x * s, 30 + (y - r0) * s, 30 + x * s + s - 1, 30 + (y - r0) * s + s - 1], fill=pal[ch])
for x in range(24):
    d.text((30 + x * s + 5, 10), str(x), fill=(255, 255, 255))
    d.line([(30 + x * s, 30), (30 + x * s, 30 + n * s)], fill=(80, 110, 70))
for y in range(r0, len(rows)):
    d.text((4, 30 + (y - r0) * s + 4), str(y), fill=(255, 255, 255))
im.save(sys.argv[2])
