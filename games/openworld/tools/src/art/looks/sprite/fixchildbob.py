"""The bowl cut seen from behind: its draft drew a face under the fringe, so the back is the bob's back cut at the
ears (its rows to the ears, then its hairline).  python -I fixchildbob.py   (in the work folder, after hairmake.py bob)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk import read, write

bob, pal = read('hair-bob-up.txt')
write('hair-childbob-up.txt', list(bob[:11]) + [bob[13], bob[14]] + ['.' * 24] * 23, pal)
print('hair-childbob-up.txt')
