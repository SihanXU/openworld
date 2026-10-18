"""A draft's rows as coarse classes, every 6 px: python -I rows.py draft.png [y0 y1]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
W, H = im.size
y0, y1 = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (0, H)
pts = [x for x in range(0, W, 2) for y in range(0, H, 8) if min(im.getpixel((x, y))) < 200]
cx = (min(pts) + max(pts)) // 2
def cls(p):
    if min(p) > 228: return '.'
    if max(p) < 90: return 'K'
    if abs(p[0] - p[2]) < 30: return 'V'
    return 'S'
for y in range(y0, y1, 6):
    print(y, ''.join(cls(im.getpixel((x, y))) for x in range(cx - 150, cx + 151, 6)))
