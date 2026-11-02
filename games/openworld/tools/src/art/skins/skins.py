"""Agent skins as the game's character sheets (docs/agent-players.md §5).

The drafts (branch art/character-skin-drafts, art/character-skins/) are 1287x1222 images of four rows, front, left,
back and right, of four walking frames each. The game draws a character from one sheet of equal cells, a column to a
direction (down, up, left, right) and a row to a walking frame, so each draft is cut into its sixteen frames, brought
to one scale on one foot line and laid out so. Two drafts come with an atlas of the cuts; the third is cut by its alpha.

    python3 -I skins.py --src <art/character-skins> --out games/openworld/public/assets/lsw/Characters/Skins

Writes <out>/<id>/SpriteSheet.png for each skin. Needs Pillow and numpy.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

CELL = 64
FOOT = 2
DIRS = ['down', 'up', 'left', 'right']
ROWS = ['down', 'left', 'up', 'right']
ALPHA = 32
SEARCH = 90

SKINS = {
    'whale': ('鲸鱼娘', 'whale-girl-source-4x4-v1.png', 'whale-girl-phaser-atlas.json'),
    'gpt': ('GPT龙娘', 'dragon-girl-hanfu-4x4-v1.png', 'dragon-girl-phaser-atlas.json'),
    'claude': ('Claude娘', 'claude-sprite-pixel-v2.png', None),
}


def runs(flags):
    out, start = [], None
    for i, on in enumerate(flags):
        if on and start is None:
            start = i
        if not on and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(flags)))
    return out


def frames_by_atlas(img, atlas):
    frames = {}
    for name, f in atlas['frames'].items():
        r, s = f['frame'], f['spriteSourceSize']
        crop = img.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        frames[name] = (crop, s['x'], s['y'], (f['sourceSize']['w'], f['sourceSize']['h']))
    return frames


def frames_by_alpha(img):
    solid = np.array(img)[:, :, 3] > ALPHA
    height = solid.shape[0]
    profile = solid.sum(axis=1)
    cuts = []
    for k in (1, 2, 3):
        mid = int(height * k / 4)
        cuts.append(mid - SEARCH + int(profile[mid - SEARCH:mid + SEARCH].argmin()))
    frames = {}
    for row, (top, bottom) in zip(ROWS, zip([0] + cuts, cuts + [height])):
        cols = runs(solid[top:bottom].any(axis=0))
        if len(cols) != 4:
            raise SystemExit(f'{row}: found {len(cols)} frames, not 4')
        for i, (left, right) in enumerate(cols):
            ys = runs(solid[top:bottom, left:right].any(axis=1))
            crop = img.crop((left, top + ys[0][0], right, top + ys[-1][1]))
            frames[f'{row}_{i}'] = (crop, 0, 0, crop.size)
    return frames


def build(frames, atlas_based):
    canvas = [sz if atlas_based else crop.size for crop, _, _, sz in frames.values()]
    scale = min((CELL - 2) / max(w for w, _ in canvas), (CELL - FOOT - 1) / max(h for _, h in canvas))
    sheet = Image.new('RGBA', (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for col, direction in enumerate(DIRS):
        for row in range(4):
            crop, ox, oy, (cw, ch) = frames[f'{direction}_{row}']
            size = (max(1, round(crop.size[0] * scale)), max(1, round(crop.size[1] * scale)))
            small = crop.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
            if atlas_based:
                x = round((CELL - cw * scale) / 2 + ox * scale)
                y = round(CELL - FOOT - ch * scale + oy * scale)
            else:
                x = (CELL - small.size[0]) // 2
                y = CELL - FOOT - small.size[1]
            sheet.alpha_composite(small, (col * CELL + x, row * CELL + y))
    return sheet


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--src', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    for skin, (folder, image, atlas_file) in SKINS.items():
        img = Image.open(os.path.join(args.src, folder, image)).convert('RGBA')
        if atlas_file:
            with open(os.path.join(args.src, folder, atlas_file), encoding='utf8') as f:
                frames = frames_by_atlas(img, json.load(f))
        else:
            frames = frames_by_alpha(img)
        sheet = build(frames, atlas_file is not None)
        os.makedirs(os.path.join(args.out, skin), exist_ok=True)
        sheet.save(os.path.join(args.out, skin, 'SpriteSheet.png'), optimize=True)
        print(skin, sheet.size)


if __name__ == '__main__':
    main()
