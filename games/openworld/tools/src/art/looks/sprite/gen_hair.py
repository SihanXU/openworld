"""Hair drafts: the approved bald drafts of each facing edited to wear a hairstyle.  python -I gen_hair.py style…"""
import os
import sys

HERE = os.getcwd()
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portrait'))
from PIL import Image
import comfy

STYLES = {
    'short': 'short neat dark brown hair, a little longer on top, with a fringe falling over the forehead',
    'ponytail': 'long dark brown hair tied high at the back of the head in a ponytail that falls down to the shoulder blades, with a fringe over the forehead',
    'messy': 'tousled, messy medium-short dark brown hair sticking out in all directions, with a messy fringe',
    'swept': 'dark brown hair swept straight back from the forehead, neat and combed back, the forehead uncovered',
    'cropped': 'very short cropped dark brown hair, a buzz cut close to the scalp all over',
    'thin': 'thinning greyish brown hair: a bald crown on top with a ring of short hair around the sides and the back of the head',
    'tied': 'long dark brown hair parted in the middle and tied back low at the nape into a short tail behind the neck, the forehead uncovered',
    'bob': 'a chin-length dark brown bob with a straight fringe across the forehead',
    'long': 'long straight dark brown hair falling down past the shoulders to the middle of the back, with a fringe',
    'wavy': 'long wavy, curly dark brown hair falling past the shoulders, with a soft fringe',
    'braid': 'long dark brown hair in a single thick braid that hangs over the front of one shoulder down to the chest, with a fringe',
    'bun': 'dark brown hair pulled back and up into a round bun at the back of the head, a few strands framing the face, no fringe',
}
SRC = {
    'left': ('drafts/l-man-33.png', 'drafts/l-woman-33.png'),
    'down': ('drafts/front-man-e7.png', 'drafts/front-woman-e32.png'),
    'up': ('drafts/back-man-e32.png', 'drafts/back-woman-e32.png'),
}
WHO = {'short': 0, 'ponytail': 1, 'messy': 0, 'swept': 0, 'cropped': 0, 'thin': 0, 'tied': 1, 'bob': 1, 'long': 1, 'wavy': 1, 'braid': 1, 'bun': 1}
for style in sys.argv[1:]:
    for facing, srcs in SRC.items():
        out = os.path.join(HERE, f'drafts/hair-{style}-{facing}.png')
        if os.path.exists(out):
            continue
        img = Image.open(os.path.join(HERE, srcs[WHO[style]])).convert('RGB')
        prompt = (f'Give this bald character {STYLES[style]}. Change nothing else: the same pose, view, size and position, the same '
                  'face, body and clothes, the same big-block pixel art style with a 1-pixel dark outline, plain white background.')
        print(out, flush=True)
        comfy.run(prompt, 32, img).save(out)
print('done', flush=True)
