"""A draft queue that keeps running: python -I queue.py [size]   (stop: create the file queue.stop)

Every pass it reads queue.json (a list of {"out", "src", "prompt", "seed"}; "src" null draws from nothing) and makes
the first job whose picture is missing, so jobs can be added while it runs. An edit runs at `size` (default 768): its
source is scaled to it and the picture scaled back to the source's size, so the layout stays where it was. Prints
each picture as it is made.
"""
import json
import os
import sys
import time

HERE = os.getcwd()
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portrait'))
from PIL import Image
import comfy

SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 768
while not os.path.exists('queue.stop'):
    try:
        jobs = json.load(open('queue.json', encoding='utf-8'))
    except Exception:
        time.sleep(5)
        continue
    todo = [j for j in jobs if not os.path.exists(j['out'])]
    if not todo:
        time.sleep(10)
        continue
    j = todo[0]
    img = Image.open(j['src']).convert('RGB') if j.get('src') else None
    full = img.size if img else None
    if img and img.size[0] != SIZE:
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
    t0 = time.time()
    try:
        out = comfy.run(j['prompt'], j.get('seed', 32), img)
        if full and out.size != full:
            out = out.resize(full, Image.LANCZOS)
        out.save(j['out'])
        print(j['out'], f'{time.time() - t0:.0f}s', len(todo) - 1, 'left', flush=True)
    except Exception as e:
        print('failed', j['out'], e, flush=True)
        time.sleep(10)
print('stopped', flush=True)
