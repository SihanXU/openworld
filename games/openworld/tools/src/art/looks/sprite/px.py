"""Sprite drafting tools (docs/looks.md): letter grids <-> pictures, the user's example, side-by-side views.

    python -I px.py load grid.txt out.png          # a grid file (letters, a blank line, 'L #rrggbb' per letter) to a sprite
    python -I px.py big grid.txt out.png [scale]   # big, with a ruler every 4 cells
    python -I px.py demo                           # demo.png: the user's example (Cloud) as a 24x36 sprite
    python -I px.py compare out.png a.png b.png …  # sprites big and at game scale on grass (a <=40-row sprite at 4x, else 2x)
"""
import sys
from PIL import Image, ImageDraw

# The user's example, read back from its grid (cells of ~11 px): 34 rows, the figure in columns 10..27.
DEMO = [
    '............ABAA....................',
    '.............BCCB..B................',
    '..............BDCBBDB...............',
    '............BBEFGDEDFBA.............',
    '...........BCDDFHHDIFDDA............',
    '............BCFCCFFCFCDFA...........',
    '...........BDFCGDFCCDCDHFA..........',
    '..........BDFFGDFFDGDGGDA...........',
    '...........BBHAFFJFGFFGFFA..........',
    '............BDAKJJLKFJFHA...........',
    '............ADAMJJMNFFFA............',
    '.............AAJOOPOQDA.............',
    '...............AJJFQLKL.............',
    '..............LBAAALRBL.............',
    '..............ASBBSBLTNB............',
    '.............ANBUSSRTNVNB...........',
    '............ATWKBRKKXNNTB...........',
    '............AWTBKKYBKXTXK...........',
    '............KKKBYZYBKKKKYK..........',
    '............YZYAZYZBKYZaZK..........',
    '...........KFJAAAYAAKKFJFQK.........',
    '...........KBbKKTNTAKKKFJKK.........',
    '..........KAcAKABQBAAKKKKAK.........',
    '..........KcAKKKBKKBZBKABAKK........',
    '..........KAcAYZaKYYaZKcABAK........',
    '...........KAKZaaYKYaaYKKAK.........',
    '.............KZaaZKKYaZYKK..........',
    '.............KYZZYKKYZZYK...........',
    '..............KYKKKKKYYK............',
    '..............KKAKK.KBHBK...........',
    '.............KBHBKK.KKAKK...........',
    '............KBdHBAK.KBHAK...........',
    '.............KKKKK..KHdBK...........',
    '.....................KKK............',
]
DEMO_PAL = {
    'A': '#3f2d20', 'B': '#534133', 'C': '#fefea7', 'D': '#fec310', 'E': '#af875f', 'F': '#cf904f', 'G': '#eae194', 'H': '#9f6f3f',
    'I': '#ffff0e', 'J': '#fec793', 'K': '#202020', 'L': '#101010', 'M': '#013f80', 'N': '#b0b0ad', 'O': '#fdfdde', 'P': '#1f8efe',
    'Q': '#905620', 'R': '#394632', 'S': '#5d6f49', 'T': '#808080', 'U': '#96af7a', 'V': '#d0d0d0', 'W': '#a0a0a0', 'X': '#606060',
    'Y': '#293259', 'Z': '#3f517d', 'a': '#5a71a6', 'b': '#905843', 'c': '#6d3f30', 'd': '#c09571',
}
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def read(src):
    t = open(src, encoding='utf-8').read().replace('\r', '')
    g, p = t.split('\n\n', 1)
    pal = {l.split()[0]: hexrgb(l.split()[1]) for l in p.strip().split('\n')}
    return g.split('\n'), pal


def sprite(rows, pal):
    sp = Image.new('RGBA', (max(len(r) for r in rows), len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in '. ':
                sp.putpixel((x, y), (*pal.get(ch, (255, 0, 255)), 255))
    return sp


def big(src, out, s=14):
    rows, pal = read(src)
    W, H = max(len(r) for r in rows), len(rows)
    im = Image.new('RGB', (W * s + 30, H * s + 30), (92, 128, 80))
    d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in '. ':
                d.rectangle([30 + x * s, 30 + y * s, 30 + x * s + s - 1, 30 + y * s + s - 1], fill=pal.get(ch, (255, 0, 255)))
    for x in range(0, W, 4): d.text((30 + x * s, 8), str(x), fill=(255, 255, 255))
    for y in range(0, H, 4): d.text((4, 30 + y * s), str(y), fill=(255, 255, 255))
    im.save(out)


def demo():
    rows = ['.' * 24] + ['...' + r[10:28] + '...' for r in DEMO] + ['.' * 24]
    sprite(rows, {k: hexrgb(v) for k, v in DEMO_PAL.items()}).save('demo.png')


def compare(out, files):
    sps = [Image.open(f).convert('RGBA') for f in files]
    cells = []
    for sp in sps:
        s = 4 if sp.height <= 40 else 2
        g = sp.resize((sp.width * s, sp.height * s), Image.NEAREST)
        b = sp.resize((sp.width * s * 3, sp.height * s * 3), Image.NEAREST)
        cells.append((g, b))
    W = sum(b.width for _, b in cells) + sum(g.width for g, _ in cells) + 20 * (2 * len(cells) + 1)
    H = max(b.height for _, b in cells) + 40
    img = Image.new('RGB', (W, H), (92, 128, 80))
    x = 20
    for g, b in cells:
        img.paste(b, (x, 20), b); x += b.width + 20
    for g, b in cells:
        img.paste(g, (x, H - 20 - g.height), g); x += g.width + 20
    img.save(out)


if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'load': sprite(*read(sys.argv[2])).save(sys.argv[3])
    elif c == 'big': big(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 14)
    elif c == 'demo': demo()
    elif c == 'compare': compare(sys.argv[2], sys.argv[3:])
