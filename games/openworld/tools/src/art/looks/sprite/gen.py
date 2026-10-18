"""Front and back drafts of the bases: drawn from the prompt, and edited from the approved 3/4 drafts.

    python -I gen.py   (writes drafts/<facing>-<body>-<how><seed>.png, skipping ones already there)
"""
import os
import sys

HERE = os.getcwd()  # the work folder: drafts/ and the grids
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portrait'))
from PIL import Image
import comfy

STYLE = ('Very low resolution pixel art game sprite, the whole character is only about 36 pixels tall and 20 pixels wide, '
         'each pixel drawn as a big visible square block, like a Final Fantasy Brave Exvius unit sprite: chibi proportions '
         'with a big head (the head about a third of the height), a compact body and short legs, {view}, arms at the sides, '
         'feet slightly apart, a 1-pixel dark outline, simple cel shading lit from the upper left, centred, plain white background. ')
VIEW = {
    'front': 'standing in a straight front view facing the viewer, symmetrical',
    'back': 'standing in a straight back view seen from behind, the back of the head and the back of the body toward the viewer, the face not visible',
}
BODY = {
    'man': 'A bald man base body (mannequin): completely bald round head, {face}an athletic build, only plain light grey boxer shorts, barefoot.',
    'woman': 'A bald woman base body (mannequin): completely bald round head, {face}a slim feminine build, a plain light grey tank top and light grey shorts, barefoot.',
}
FACE = {'man': 'a handsome young adult face, blue eyes, ', 'woman': 'a pretty young adult face, blue eyes, '}
EDIT = {
    'front': ('Turn this character so it faces the viewer directly: a straight front view, symmetrical, standing with the arms at the sides '
              'and the feet slightly apart. Keep everything else the same: the same chibi proportions, the same big-block pixel art style '
              'and size, the same bald head and face style, the same build and the same light grey clothes, plain white background.'),
    'back': ('Show this same character from behind: a straight back view, the back of the bald head and the back of the body toward the viewer, '
             'the face not visible, standing with the arms at the sides and the feet slightly apart. Keep everything else the same: the same '
             'chibi proportions, the same big-block pixel art style and size, the same build and the same light grey clothes, plain white background.'),
}
SRC = {'man': 'drafts/l-man-33.png', 'woman': 'drafts/l-woman-33.png'}

jobs = []
for facing in ('front', 'back'):
    for body in ('man', 'woman'):
        face = FACE[body] if facing == 'front' else ''
        for seed in (32, 7):
            jobs.append((f'drafts/{facing}-{body}-e{seed}.png', EDIT[facing], seed, SRC[body]))
            jobs.append((f'drafts/{facing}-{body}-t{seed}.png', STYLE.format(view=VIEW[facing]) + BODY[body].format(face=face), seed, None))
for out, prompt, seed, src in jobs:
    path = os.path.join(HERE, out)
    if os.path.exists(path):
        continue
    img = Image.open(os.path.join(HERE, src)).convert('RGB') if src else None
    print(out, flush=True)
    comfy.run(prompt, seed, img).save(path)
print('done', flush=True)
