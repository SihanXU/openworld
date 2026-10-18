"""The outfits' and the worn pieces' grids into the runtime (docs/looks.md §3.1).

    python -I outfits.py <dir>   # <dir>/outfits.json + <dir>/of-<id>-<FRAME>.txt -> packages/runtime/src/assets/figure/baseoutfit.ts

outfits.json gives each piece's key colours ("keys": {"1": "#…", …}; the ones in "fixed" are not the look's to
change); an id without a slot is an outfit's ("dress" is outfit.dress), "armour.plate" and "cloak.cloak" are worn over
it. A grid is the piece alone on one base frame (outfit.py): an outfit's letters 1:qrst 2:uvwx 3:yzAB 4:CDEG (light to
dark), the armour's 0123, a cloak's 4567; K an outline it adds (a skirt's), _ a cell it clears (the legs a long skirt
hides). A child's (on the CHILD_ frames) is worn by the girl and the boy alike, unless its "bodies" says.
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *['..'] * 7))
OUT = os.path.join(ROOT, 'packages', 'runtime', 'src', 'assets', 'figure', 'baseoutfit.ts')
FRAMES = {
    'man': {'down': ('MAN_DOWN', ['MAN_DOWN', 'MAN_DOWN_A', 'MAN_DOWN', 'MAN_DOWN_B']),
            'up': ('MAN_UP', ['MAN_UP', 'MAN_UP_A', 'MAN_UP', 'MAN_UP_B']),
            'left': ('MAN_LEFT', ['MAN_LEFT', 'MAN_LEFT_A', 'MAN_LEFT', 'MAN_LEFT_B'])},
    'woman': {'down': ('WOMAN_DOWN', ['WOMAN_DOWN_PASS', 'WOMAN_DOWN_A', 'WOMAN_DOWN_PASS', 'WOMAN_DOWN_B']),
              'up': ('WOMAN_UP', ['WOMAN_UP_PASS', 'WOMAN_UP_A', 'WOMAN_UP_PASS', 'WOMAN_UP_B']),
              'left': ('WOMAN_LEFT', ['WOMAN_LEFT', 'WOMAN_LEFT_A', 'WOMAN_LEFT', 'WOMAN_LEFT_B'])},
    'child': {'down': ('CHILD_DOWN', ['CHILD_DOWN_PASS', 'CHILD_DOWN_A', 'CHILD_DOWN_PASS', 'CHILD_DOWN_B']),
              'up': ('CHILD_UP', ['CHILD_UP_PASS', 'CHILD_UP_A', 'CHILD_UP_PASS', 'CHILD_UP_B']),
              'left': ('CHILD_LEFT', ['CHILD_LEFT', 'CHILD_LEFT_A', 'CHILD_LEFT', 'CHILD_LEFT_B'])},
}
LETTERS = {
    'outfit': (('1', 'qrst'), ('2', 'uvwx'), ('3', 'yzAB'), ('4', 'CDEG')),
    'armour': (('1', '0123'),),
    'cloak': (('1', '4567'),),
}


def part(path):
    rows = open(path, encoding='utf-8').read().replace('\r', '').split('\n\n')[0].split('\n')[:36]
    assert len(rows) == 36 and all(len(r) == 24 for r in rows), path
    assert set(''.join(rows)) <= set('.qrstuvwxyzABCDEG01234567K_' + 'LOHJFQVWTX'), path
    used = [y for y, r in enumerate(rows) if r.strip('.')]
    if not used:
        return 0, []
    return used[0], rows[used[0]:used[-1] + 1]


def main():
    folder = sys.argv[1]
    spec = json.load(open(os.path.join(folder, 'outfits.json'), encoding='utf-8'))
    consts, table = [], []
    for outfit, s in spec.items():
        pid = outfit if '.' in outfit else f'outfit.{outfit}'
        cname = pid.replace('.', '_').upper()
        bodies = []
        for body, facings in FRAMES.items():
            if not os.path.exists(os.path.join(folder, f'of-{outfit}-{facings["left"][0]}.txt')):
                continue
            names = {n for idle, walk in facings.values() for n in [idle, *walk]}
            for n in sorted(names):
                top, rows = part(os.path.join(folder, f'of-{outfit}-{n}.txt'))
                consts.append(f"const {cname}_{n}: BasePart = {{ top: {top}, rows: [")
                consts += [f"  '{r}'," for r in rows]
                consts.append("] }")
            fac = ', '.join(f"{f}: {{ idle: {cname}_{idle}, walk: [{', '.join(f'{cname}_{w}' for w in walk)}] }}" for f, (idle, walk) in facings.items())
            for b in (s.get('bodies', ['girl', 'boy']) if body == 'child' else [body]):
                bodies.append(f"    {b}: {{ {fac} }},")
        if not bodies:
            continue
        keys = ', '.join(f"{k}: '{v}'" for k, v in s['keys'].items())
        fixed = ', '.join(f"'{k}'" for k in s.get('fixed', []))
        table.append(f"  '{pid}': {{\n    keys: {{ {keys} }},\n    fixed: [{fixed}],\n    bodies: {{\n" + '\n'.join(bodies) + "\n    },\n  },")
    out = [
        "// The outfits and what is worn over them on the bases (docs/looks.md §3.1), written by",
        "// games/openworld/tools/src/art/looks/sprite/outfits.py: each read from ComfyUI drafts of the bald bases wearing it",
        "// and laid on every frame by its body parts (a sleeve by how far along the arm, a jacket's front by place, an apron",
        "// by its place on the hips), the tones the base's own. Letters, light to dark, per slot: an outfit's 1 qrst, 2 uvwx,",
        "// 3 yzAB (the look's keys outfit.1-3, repainted) and 4 CDEG (a colour of its own); the armour's 0123 (armour.1); a",
        "// cloak's 4567 (cloak.1). K an outline a piece adds (a skirt's), _ a cell it clears (the stride a long skirt hides).",
        "",
        "import type { BaseBody, BaseFacing } from './bases.ts'",
        "",
        "/** A part on one frame: its rows from `top` down. */",
        "export interface BasePart {",
        "  top: number",
        "  rows: string[]",
        "}",
        "",
        "/** A piece on a body: per facing, its part on the idle frame and on each of the walk's four. */",
        "export type PieceFrames = Record<BaseFacing, { idle: BasePart; walk: [BasePart, BasePart, BasePart, BasePart] }>",
        "",
        "export interface BaseOutfit {",
        "  /** The authored colour of each key (the reference the look's colour replaces). */",
        "  keys: Record<string, string>",
        "  /** Keys whose colour is the piece's own, not the look's. */",
        "  fixed: string[]",
        "  bodies: Partial<Record<BaseBody, PieceFrames>>",
        "}",
        "",
        "/** Per slot, its letters' keys and tones. */",
        "export const PIECE_LETTERS: Record<'outfit' | 'armour' | 'cloak', Record<string, [string, number]>> = {",
    ]
    for slot, keys in LETTERS.items():
        out.append(f"  {slot}: {{")
        out += [f"    {ch if ch.isalpha() else repr(ch)}: ['{k}', {i}]," for k, letters in keys for i, ch in enumerate(letters)]
        out.append("  },")
    out += ["}", ""] + consts + ["", "export const BASE_OUTFITS: Record<string, BaseOutfit> = {"] + table + ["}"]
    open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('written', OUT, len(table), 'pieces')


if __name__ == '__main__':
    main()
