"""The main colours of a draft's clothes: python -I samplec.py draft.png [k]  (k-means over the non-skin, non-white, non-dark pixels)"""
import sys, random
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB').resize((256, 256))
k = int(sys.argv[2]) if len(sys.argv) > 2 else 4
px = [p for p in im.get_flattened_data() if min(p) < 230 and max(p) > 50]
skin = [(0xf6, 0xc8, 0x9c), (0xe8, 0x98, 0x68), (0xfe, 0xc7, 0x93), (0xcf, 0x90, 0x4f)]
d2 = lambda a, b: sum((a[i] - b[i]) ** 2 for i in range(3))
px = [p for p in px if min(d2(p, s) for s in skin) > 900 and not (p[2] > p[0] + 40 and p[2] > 150)]
random.seed(1)
cs = random.sample(px, k)
for _ in range(12):
    groups = [[] for _ in cs]
    for p in px:
        groups[min(range(len(cs)), key=lambda i: d2(p, cs[i]))].append(p)
    cs = [tuple(sum(c[j] for c in g) // len(g) for j in range(3)) if g else cs[i] for i, g in enumerate(groups)]
for c, g in sorted(zip(cs, groups), key=lambda t: -len(t[1])):
    print('#%02x%02x%02x' % c, len(g))
