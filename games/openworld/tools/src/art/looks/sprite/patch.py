"""Rows replaced in a grid: python -I patch.py base.txt out.txt rows.txt  (rows.txt: 'NN <24 letters>' per line)."""
import sys

base, out, spec = sys.argv[1:4]
t = open(base, encoding='utf-8').read().replace('\r', '')
g, p = t.split('\n\n', 1)
rows = g.split('\n')
for line in open(spec, encoding='utf-8').read().replace('\r', '').split('\n'):
    if line.strip() and not line.startswith('#'):
        n, r = line.split()
        assert len(r) == 24, (n, r, len(r))
        rows[int(n)] = r
open(out, 'w', newline='\n').write('\n'.join(rows) + '\n\n' + p)
