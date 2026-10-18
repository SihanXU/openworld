"""The far-leg stride with the arms the right way: the near arm forward across the body, the far arm back behind it."""
import os
import sys

HERE = os.getcwd()
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portrait'))
from PIL import Image
import comfy

PROMPT = ('Show this same character walking to the left, caught mid-stride: the leg farther from the viewer steps forward '
          'to the left and the leg nearer the viewer is behind on the right with its heel lifted. The arm nearer the viewer '
          'swings forward to the left, across the front of the body; the far arm swings back to the right, behind the body, '
          'mostly hidden by it. The arms swing close to the body, not out to the sides. Keep everything else exactly the '
          'same: the same 3/4 view facing left, the same chibi proportions, the same big-block pixel art style and size, '
          'the same bald head and face, the same build and the same light grey clothes, plain white background.')
for body in ('man', 'woman'):
    img = Image.open(os.path.join(HERE, f'drafts/l-{body}-33.png')).convert('RGB')
    for seed in (3, 17, 29):
        out = os.path.join(HERE, f'drafts/walk4-{body}-{seed}.png')
        if os.path.exists(out):
            continue
        print(out, flush=True)
        comfy.run(PROMPT, seed, img).save(out)
print('done', flush=True)
