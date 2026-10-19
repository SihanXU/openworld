"""A grid drawn under the user's red strokes (user-legs.png: 16 px cells, figure 1 at x 335, rows from y -5).

    python -I overlay.py grid.txt out.png [x0 y0 x1 y1 in cells]
"""
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from px import read

S, OX, OY = 16, 335, -5
src = Image.open('user-legs.png').convert('RGB')
rows, pal = read(sys.argv[1])
im = Image.new('RGB', src.size, (92, 128, 80))
d = ImageDraw.Draw(im)
for y, r in enumerate(rows):
    for x, ch in enumerate(r):
        if ch not in '. ':
            d.rectangle([OX + x * S, OY + y * S, OX + x * S + S - 1, OY + y * S + S - 1], fill=pal[ch])
for y in range(src.height):
    for x in range(OX, OX + 24 * S):
        p = src.getpixel((x, y))
        if p[0] > 200 and p[1] < 120 and p[2] < 120:
            im.putpixel((x, y), (255, 40, 40))
a = [int(v) for v in sys.argv[3:7]] or [4, 10, 19, 36]
im = im.crop((OX + a[0] * S, max(0, OY + a[1] * S), OX + a[2] * S, min(src.height, OY + a[3] * S)))
d = ImageDraw.Draw(im)
im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
d = ImageDraw.Draw(im)
for c in range(a[0], a[2]):
    d.text(((c - a[0]) * S * 2 + 10, 2), str(c), fill=(255, 255, 255))
for r in range(a[1], a[3]):
    y = (OY + r * S - max(0, OY + a[1] * S)) * 2
    if 0 <= y < im.height:
        d.text((2, y + 10), str(r), fill=(255, 255, 255))
im.save(sys.argv[2])
