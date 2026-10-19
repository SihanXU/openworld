"""The braid's back ends where its front does (row 27), its tip a dark line."""
import sys, os
sys.path.insert(0, os.getcwd())
from walk import read, write
rows, pal = read('hair-braid-up.txt')
for y in range(28, 36):
    rows[y] = '.' * 24
rows[27] = '...........e............'
write('hair-braid-up.txt', rows, pal)
