"""Walk drafts: the approved 3/4 drafts edited into a stride.  python -I gen_walk.py  (drafts/walk-<body>-<n>-<seed>.png)"""
import os
import sys

HERE = os.getcwd()  # the work folder: drafts/ and the grids
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portrait'))
from PIL import Image
import comfy

KEEP = ('Keep everything else exactly the same: the same 3/4 view facing left, the same chibi proportions, the same big-block '
        'pixel art style and size, the same bald head and face, the same build and the same light grey clothes, plain white background.')
POSE = {
    'a': ('Show this same character walking to the left, caught mid-stride: the leg farther from the viewer steps forward to the left, '
          'the leg nearer the viewer is behind with its heel lifted, the feet clearly apart, the arms swinging in opposition to the legs. '),
    'b': ('Show this same character walking to the left, caught mid-stride: the leg nearer the viewer steps forward to the left, '
          'the leg farther from the viewer is behind with its heel lifted, the feet clearly apart, the arms swinging in opposition to the legs. '),
}
SRC = {'man': 'drafts/l-man-33.png', 'woman': 'drafts/l-woman-33.png'}
for body, src in SRC.items():
    img = Image.open(os.path.join(HERE, src)).convert('RGB')
    for n, pose in POSE.items():
        for seed in (32, 7):
            out = os.path.join(HERE, f'drafts/walk-{body}-{n}-{seed}.png')
            if os.path.exists(out):
                continue
            print(out, flush=True)
            comfy.run(pose + KEEP, seed, img).save(out)
print('done', flush=True)
