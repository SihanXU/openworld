"""The bases between the runtime's module and grid files one edits (docs/looks.md §3.1).

    python -I bases.py out <dir>   # packages/runtime/src/assets/figure/bases.ts -> <dir>/<NAME>.txt
    python -I bases.py in <dir>    # <dir>/<NAME>.txt -> the module's grids (its frames table is kept)

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
        def put(m):
            path = os.path.join(folder, m.group(1) + '.txt')
            if not os.path.exists(path):
                return m.group(0)
            rows = open(path, encoding='utf-8').read().replace('\r', '').split('\n\n')[0].split('\n')
            assert len(rows) == 36 and all(len(r) == 24 for r in rows), path
            assert set(''.join(rows)) - {'.'} <= set(pal), path
            return f'const {m.group(1)} = [\n' + ''.join(f"  '{r}',\n" for r in rows) + ']'
        open(MODULE, 'w', encoding='utf-8', newline='\n').write(GRID.sub(put, src))
        print('written', MODULE)


if __name__ == '__main__':
    main()
