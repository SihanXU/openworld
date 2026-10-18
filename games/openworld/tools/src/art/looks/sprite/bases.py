"""The bases between the runtime's module and grid files one edits (docs/looks.md §3.1).

    python -I bases.py out <dir>   # packages/runtime/src/assets/figure/bases.ts -> <dir>/<NAME>.txt
    python -I bases.py in <dir>    # <dir>/<NAME>.txt -> the module's grids (its frames table is kept; a grid it does not
                                   # have yet is added before the palette, for the table to name)

A grid file is the rows of letters, a blank line, then 'L #rrggbb' per letter (the module's palette): what px.py,
walk.py and the other tools here read and write.
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *['..'] * 7))
MODULE = os.path.join(ROOT, 'packages', 'runtime', 'src', 'assets', 'figure', 'bases.ts')
GRID = re.compile(r"const (\w+) = \[\n((?:  '[^']*',\n)+)\]")


def palette(src):
    block = re.search(r'BASE_PALETTE[^{]*\{\n(.*?)\n\}', src, re.S).group(1)
    return dict(re.findall(r"(\w): '(#[0-9a-f]{6})'", block))


def main():
    cmd, folder = sys.argv[1], sys.argv[2]
    src = open(MODULE, encoding='utf-8').read()
    pal = palette(src)
    tail = '\n'.join(f'{k} {v}' for k, v in pal.items()) + '\n'
    if cmd == 'out':
        os.makedirs(folder, exist_ok=True)
        for name, body in GRID.findall(src):
            rows = re.findall(r"'([^']*)'", body)
            open(os.path.join(folder, name + '.txt'), 'w', encoding='utf-8', newline='\n').write('\n'.join(rows) + '\n\n' + tail)
            print(name)
    elif cmd == 'in':
        def grid(name):
            rows = open(os.path.join(folder, name + '.txt'), encoding='utf-8').read().replace('\r', '').split('\n\n')[0].split('\n')
            assert len(rows) == 36 and all(len(r) == 24 for r in rows), name
            assert set(''.join(rows)) - {'.'} <= set(pal), name
            return f'const {name} = [\n' + ''.join(f"  '{r}',\n" for r in rows) + ']'

        def put(m):
            return grid(m.group(1)) if os.path.exists(os.path.join(folder, m.group(1) + '.txt')) else m.group(0)

        out = GRID.sub(put, src)
        have = {name for name, _ in GRID.findall(src)}
        new = [grid(f[:-4]) for f in sorted(os.listdir(folder)) if f.endswith('.txt') and f[:-4] not in have and re.fullmatch(r'[A-Z_]+', f[:-4])]
        if new:
            at = out.index('/** The authored colours')
            out = out[:at] + '\n\n'.join(new) + '\n\n' + out[at:]
        open(MODULE, 'w', encoding='utf-8', newline='\n').write(out)
        print('written', MODULE, len(new), 'added')


if __name__ == '__main__':
    main()
