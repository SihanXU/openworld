"""The near-leg stride, described by where things lie in the picture.  python -I gen_walk3.py"""
import os
import sys

HERE = os.getcwd()  # the work folder: drafts/ and the grids
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portrait'))
from PIL import Image
import comfy

PROMPT = ('Show this same character walking to the left, caught mid-stride, with the legs crossed over at the thighs: the leg '
          'nearest the viewer (the one on the right of the picture now) swings forward and its foot lands on the left of the '
          'picture, passing in front of the other leg; the far leg is left behind on the right of the picture, its heel lifted, '
          'partly hidden behind the near leg. The arm nearest the viewer swings back to the right; the far arm swings forward '
          'to the left. Keep everything else exactly the same: the same 3/4 view facing left, the same chibi proportions, the '
          'same big-block pixel art style and size, the same bald head and face, the same build and the same light grey '
          'clothes, plain white background.')
for body in ('man', 'woman'):
    img = Image.open(os.path.join(HERE, f'drafts/l-{body}-33.png')).convert('RGB')
    for seed in (5, 19, 23):
        out = os.path.join(HERE, f'drafts/walk3-{body}-{seed}.png')
        if os.path.exists(out):
            continue
        print(out, flush=True)
        comfy.run(PROMPT, seed, img).save(out)
print('done', flush=True)
