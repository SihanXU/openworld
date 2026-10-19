"""The front and back steps' arms, swinging with the body in front of or over them.

In every step the shorter, higher leg is the farther one: from the front the leg pushing off behind, from behind the
leg stepping ahead. So in step a (the right leg, as drawn, the shorter) the arm on the right comes toward the viewer
and is drawn over the hip, while the left arm goes the other way and its forearm is hidden behind the body; step b is
the other way round. Only the rows below the elbows change.
"""
import sys, os
sys.path.insert(0, os.getcwd())
from walk import read, write

ROWS = {
    # the woman: her right forearm over the hip, her left forearm hidden from the elbow
    ('woman', 'front', 'right'): {21: '......KKKVVVVVKFFK......', 22: '........KVVVVKFQK.......', 23: '........KVVVVVKK........', 24: '........KVVKKVWK........'},
    ('woman', 'front', 'left'): {21: '......KJJKVVVVWKKK......', 22: '.......KJJKVVVWK........', 23: '........KKVVVVWK........', 24: '........KVVKKVWK........'},
    # the man: the same, his arms two wide and his hands at the shorts' hem
    ('man', 'front', 'right'): {23: '.....KKKKKKKKKKKFFK.....', 24: '.......KVVVVVVKFFK......', 25: '.......KVVVVVVKFQK......', 26: '.......KVVWKKWVKK.......', 27: '.......KKKKKKKKKK.......'},
    ('man', 'front', 'left'): {23: '.....KJJKKKKKKKKKKK.....', 24: '......KJJKVVVVVWK.......', 25: '......KJFKVVVVVWK.......', 26: '.......KKVWKKWVWK.......', 27: '.......KKKKKKKKKK.......'},
    # from behind the woman's dress is the same; the man's shorts show their seam
    ('woman', 'back', 'right'): None,
    ('woman', 'back', 'left'): None,
    ('man', 'back', 'right'): {23: '.....KKKKKKKKKKKFFK.....', 24: '.......KVVVWVVKFFK......', 25: '.......KVVVWVVKFQK......', 26: '.......KVVWKKWVKK.......', 27: '.......KKKKKKKKKK.......'},
    ('man', 'back', 'left'): {23: '.....KJJKKKKKKKKKKK.....', 24: '......KJJKVVWVVWK.......', 25: '......KJFKVVWVVWK.......', 26: '.......KKVWKKWVWK.......', 27: '.......KKKKKKKKKK.......'},
}
ROWS[('woman', 'back', 'right')] = ROWS[('woman', 'front', 'right')]
ROWS[('woman', 'back', 'left')] = ROWS[('woman', 'front', 'left')]
for body in ('man', 'woman'):
    for view in ('front', 'back'):
        for step, near in (('a', 'right'), ('b', 'left')):
            rows, pal = read(f'{view}-{body}-{step}.txt')
            for y, r in ROWS[(body, view, near)].items():
                assert len(r) == 24, (body, view, near, y, len(r))
                rows[y] = r
            write(f'nw-{view}-{body}-{step}.txt', rows, pal)
print('ok')
