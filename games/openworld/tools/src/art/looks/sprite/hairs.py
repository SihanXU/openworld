"""The hairstyles' grids into the runtime (docs/looks.md §3.1).

    python -I hairs.py <dir>   # <dir>/hairs.json + <dir>/hair-<style>-<facing>.txt -> packages/runtime/src/assets/figure/basehair.ts

hairs.json: {"<style>": {"down": 13, "left": "13@12", "up": 99}, ...} — per facing, the row from which the hair hangs
behind the body (drawn only where the body is not), and optionally the column from which it does ('13@12': long hair in
the 3/4 view falls over the far shoulder in front and down the back behind). A grid is the part alone on the
standing head (hairmake.py): letters a (light) .. c (the colour) .. e (its dark line).
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *['..'] * 7))
OUT = os.path.join(ROOT, 'packages', 'runtime', 'src', 'assets', 'figure', 'basehair.ts')
FACINGS = ('down', 'up', 'left')


def grid(path):
    t = open(path, encoding='utf-8').read().replace('\r', '')
    g, p = t.split('\n\n', 1)
    rows = g.split('\n')[:36]
    assert len(rows) == 36 and all(len(r) == 24 for r in rows), path
    assert set(''.join(rows)) <= set('.abcde'), path
    return rows, dict(l.split() for l in p.strip().split('\n'))


def main():
    folder = sys.argv[1]
    spec = json.load(open(os.path.join(folder, 'hairs.json'), encoding='utf-8'))
    pal = None
    out = [
        "// The hairstyles on the bases (docs/looks.md §3.1), written by games/openworld/tools/src/art/looks/sprite/hairs.py:",
        "// each drawn by ComfyUI on the bald drafts, cut out against them and set on the standing head. Letters: a (light)",
        "// .. c (the colour, repainted from the look's hair) .. e (the hair's dark line). One grid per facing fits both",
        "// adult bodies (they share the head) and follows the head as it bobs; below `back` the hair hangs behind the body.",
        "",
        "import type { BaseFacing } from './bases.ts'",
        "",
        "export interface BaseHair {",
        "  grids: Record<BaseFacing, string[]>",
        "  /** Per facing: from this row down, and from this column across, the hair hangs behind the body. */",
        "  back: Record<BaseFacing, [number, number]>",
        "}",
        "",
    ]
    body = []
    for style, back in spec.items():
        body.append(f"  'hair.{style}': {{")
        rc = {f: (str(back[f]).split('@') + ['0'])[:2] for f in FACINGS}
        body.append("    back: { " + ', '.join(f"{f}: [{rc[f][0]}, {rc[f][1]}]" for f in FACINGS) + " },")
        body.append("    grids: {")
        for f in FACINGS:
            rows, p = grid(os.path.join(folder, f'hair-{style}-{f}.txt'))
            pal = pal or p
            body.append(f"      {f}: [")
            body += [f"        '{r}'," for r in rows]
            body.append("      ],")
        body.append("    },")
        body.append("  },")
    out.append("/** The hair's authored tones: `c` becomes the look's hair colour, the others keep their steps from it. */")
    out.append("export const HAIR_PALETTE: Record<string, string> = {")
    out += [f"  {k}: '{pal[k]}'," for k in 'abcde']
    out.append("}")
    out.append("")
    out.append("export const BASE_HAIRS: Record<string, BaseHair> = {")
    out += body
    out.append("}")
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('written', OUT, len(spec), 'styles')


if __name__ == '__main__':
    main()
