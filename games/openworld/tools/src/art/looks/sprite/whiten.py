"""A draft's background made plain white: everything light and grey reached from the border (a drawn checkerboard too).

    python -I whiten.py in.png out.png
"""
import sys
from collections import deque
from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
W, H = im.size
p = im.load()
light = lambda c: min(c) > 175 and max(c) - min(c) < 22
seen = set()
q = deque((x, y) for x in range(W) for y in (0, H - 1)) 
q.extend((x, y) for y in range(H) for x in (0, W - 1))
while q:
    x, y = q.popleft()
    if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or not light(p[x, y]):
        continue
    seen.add((x, y))
    p[x, y] = (255, 255, 255)
    q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
im.save(sys.argv[2])
