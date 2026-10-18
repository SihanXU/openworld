"""The head's parts into the runtime (docs/looks.md §3.1): the face's variants, marks, age, beards, glasses and hats.

    python -I heads.py <dir>   # <dir>/heads.json + the grids it names -> packages/runtime/src/assets/figure/basehead.ts

heads.json: {"<part id>": {"grid": "<path with {f} for the facing>", "hides": {"<facing>": row}}, …}. A grid is the
part alone on the standing adult's head (rows 3-12; a child's head is the same, lower), in the facing it shows in
(down, left; up when it shows from behind): the base's own letters (K the line, O H J F Q the skin, M P N the eyes),
the hair's a-e (a beard), a hat's f g h i (hat.1) and j k l m (hat.2), the glasses' n o (glasses.1) and p (their
glint). `hides`: under the hat, the hair above that row is not drawn. A part with no grids draws nothing (the base is
already it: bright eyes).
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *['..'] * 7))
OUT = os.path.join(ROOT, 'packages', 'runtime', 'src', 'assets', 'figure', 'basehead.ts')
LETTERS = set('KLOHJFQMNP' + 'abcde' + 'fghijklm' + 'nop')


def part(path):
    rows = open(path, encoding='utf-8').read().replace('\r', '').split('\n\n')[0].split('\n')[:36]
    assert len(rows) == 36 and all(len(r) == 24 for r in rows), path
    assert set(''.join(rows)) - {'.'} <= LETTERS, (path, set(''.join(rows)) - LETTERS - {'.'})
    used = [y for y, r in enumerate(rows) if r.strip('.')]
    return used[0], rows[used[0]:used[-1] + 1]


def main():
    folder = sys.argv[1]
    spec = json.load(open(os.path.join(folder, 'heads.json'), encoding='utf-8'))
    consts, table = [], []
    for pid, s in spec.items():
        grids = []
        for f in ('down', 'up', 'left'):
            path = os.path.join(folder, s['grid'].format(f=f)) if s.get('grid') else None
            if not path or not os.path.exists(path):
                continue
            top, rows = part(path)
            c = f"{pid.replace('.', '_').upper()}_{f.upper()}"
            consts.append(f"const {c}: BasePart = {{ top: {top}, rows: [")
            consts += [f"  '{r}'," for r in rows]
            consts.append("] }")
            grids.append(f"{f}: {c}")
        hides = s.get('hides')
        line = f"  '{pid}': {{ grids: {{ {', '.join(grids)} }}" + (f", hides: {{ {', '.join(f'{k}: {v}' for k, v in hides.items())} }}" if hides else '') + ' },'
        table.append(line)
    out = [
        "// The head's parts on the bases (docs/looks.md §3.1), written by games/openworld/tools/src/art/looks/sprite/heads.py:",
        "// the face's variants, a scar, freckles and age's lines drawn by hand on the standing head; beards and hats cut from",
        "// ComfyUI drafts of the bald heads wearing them. One grid per facing fits every body (they share the head; a child's",
        "// is the same, lower) and follows the head as it bobs. Letters: the base's own (K the line, O H J F Q the skin, M P N",
        "// the eyes), the hair's a-e (a beard), a hat's f g h i (hat.1) and j k l m (hat.2), the glasses' n o (glasses.1) and",
        "// p (their glint).",
        "",
        "import type { BaseFacing } from './bases.ts'",
        "import type { BasePart } from './baseoutfit.ts'",
        "",
        "export interface BaseHead {",
        "  /** The part on the standing head, in the facings it shows in. */",
        "  grids: Partial<Record<BaseFacing, BasePart>>",
        "  /** A hat's: per facing, the hair above this row is under it. */",
        "  hides?: Partial<Record<BaseFacing, number>>",
        "}",
        "",
        "/** The head parts' own letters: their key and tone (light to dark). */",
        "export const HEAD_LETTERS: Record<string, [string, number]> = {",
    ]
    for key, letters in (('hat.1', 'fghi'), ('hat.2', 'jklm')):
        out += [f"  {ch}: ['{key}', {i}]," for i, ch in enumerate(letters)]
    out += ["  n: ['glasses.1', 1],", "  o: ['glasses.1', 2],", "}", "",
            "/** Letters in a colour of their own: the glasses' glint. */",
            "export const HEAD_FIXED: Record<string, string> = { p: '#f0f0e8' }", ""]
    out += consts + ["", "export const BASE_HEADS: Record<string, BaseHead> = {"] + table + ["}"]
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('written', OUT, len(table), 'parts')


if __name__ == '__main__':
    main()
