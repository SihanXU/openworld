"""The finale's small pictures (docs/finale.md): the Holiest's bier with Astra's shrouded body on it (three cells wide,
drawn from its middle cell), an empty niche of gold-veined stone for one instrument, the Confluence's four other channels
(the undercroft's red channel, tools/src/art/chapter2.py, recoloured: the Vale's grey dust, the Fens' black water, the
Heights' milky white, the coast's channel grown over with thorns), and a statue of a Seal-bearer on its plinth along the
Processional Way.

    python3 games/openworld/tools/src/art/finale.py [preview-dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from thingkit import FIXTURES, Pic, lit, preview, rgba, write

STONE = ('D2CABC', 'ACA496', '7E766A')
SHROUD = ('A4A9AE', '7C838A', '565D66')  # cool grey linen, darker than the stone
MARBLE = ('5A524C', '443E3A', '2E2A28')
GOLD = ('E6C46C', 'C49A48', '8A6A30')
STATUE = ('C8C2B4', 'A29C8E', '76706A')


def bier() -> Pic:
    """Astra's bier in the Holiest (48x32 over three cells, drawn from its middle cell): a long block of pale stone, on it a
    grey shroud over a gaunt shape lying with its head to the left — the head, the sunken breast, the knees, the feet — the
    cloth hanging over the stone's front edge in a few long folds."""
    p = Pic(48, 32)
    # the block: its top's edge, its long face in panels, its plinth
    p.rect(1, 18, 46, 19, STONE[0])
    p.rect(2, 20, 45, 28, STONE[1])
    p.rect(2, 20, 3, 28, STONE[0])
    p.rect(44, 20, 45, 28, STONE[2])
    for x in (12, 23, 34):  # the panels
        p.line(x, 23, x, 27, STONE[2])
    p.rect(0, 29, 47, 31, STONE[2])
    p.rect(0, 29, 47, 29, STONE[1])
    # the body under the shroud: smooth heights along it, the head round and highest at the left
    def height(x: float) -> float:
        # one continuous mound the length of a man, the head rising at its left end, the knees and the feet at its right
        if not 4 <= x <= 44:
            return 0
        t = min(1, (x - 4) / 4, (44 - x) / 3)
        body = 3.2 * t
        head = 3.4 * math.exp(-((x - 7.5) / 2.4) ** 2)
        breast = -0.7 * math.exp(-((x - 17) / 3) ** 2)
        knees = 1.0 * math.exp(-((x - 31) / 2.6) ** 2)
        feet = 1.8 * math.exp(-((x - 41.5) / 1.6) ** 2)
        return max(body + head + breast + knees + feet, 1.2)
    for x in range(4, 45):
        top = 18.5 - height(x)
        for y in range(int(round(top)), 19):
            u = (y - top) / max(18.5 - top, 1)
            p.put(x, y, SHROUD[0] if u < 0.45 else SHROUD[1])
    # the cloth hanging over the front edge: a band with a few long soft folds
    for x in range(4, 45):
        fold = (x - 4) % 10
        for y in range(19, 22 + (1 if 3 <= fold <= 6 else 0)):
            p.put(x, y, SHROUD[2] if fold == 0 else SHROUD[1])
    p.put(10, 13, SHROUD[1])  # the shade under the chin
    # a thread of darkness seeping from under the cloth at the breast, down the stone
    for k in range(5):
        p.put(18, 23 + k, '1E1A24', 230 - k * 35)
    p.outline()
    return p


def instrument_niche() -> Pic:
    """One of the five niches round the Holiest's wall (16x24): an arch cut in dark stone veined with gold, its edge gilt, a
    gilt ledge at its foot, empty."""
    p = Pic(16, 24)
    for y in range(24):  # the dark marble face, thin gold veins wandering down it
        for x in range(16):
            c = MARBLE[0] if x < 3 else MARBLE[1] if x < 13 else MARBLE[2]
            p.put(x, y, c)
    for (x0, y0, x1, y1) in ((1, 0, 3, 7), (3, 7, 1, 14), (14, 2, 12, 9), (12, 21, 15, 23), (0, 18, 2, 23)):
        p.line(x0, y0, x1, y1, '8A6A30')
    hollow = lambda x, y: 3 <= x <= 12 and 4 <= y <= 18 and (y >= 8 or (x - 7.5) ** 2 / 20.25 + (y - 8) ** 2 / 16 <= 1)
    for y in range(24):
        for x in range(16):
            if hollow(x, y):
                p.put(x, y, '1C1818' if y < 11 else '262020')
            elif any(hollow(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and y < 19:
                p.put(x, y, GOLD[0] if x < 8 and y < 14 else GOLD[1])  # the gilt edge, lit from the top left
    p.rect(2, 19, 13, 20, GOLD[1])  # the ledge
    p.rect(2, 19, 13, 19, GOLD[0])
    return p


def channels() -> dict[str, Pic]:
    """The Confluence's channels: the red channel's tile (Chapter 2) with its water recoloured, and one grown over with
    thorns that reach up over its lip and hang below it."""
    src = np.array(Image.open(FIXTURES / 'RedChannel.png').convert('RGBA'))
    red = {(122, 18, 22): 0, (82, 10, 14): 1, (184, 48, 44): 2}  # the water: its body, its depth, its glint
    looks = {
        'ChannelDust': ('9E9686', '767060', 'C2BAAA'),
        'ChannelBlack': ('1C1C24', '0E0E14', '6A7490'),
        'ChannelWhite': ('E6E2D8', 'C6C0B2', 'FFFFFF'),
        'ChannelThorn': ('3A2E24', '241C16', '5A4632'),
    }
    out: dict[str, Pic] = {}
    for name, cols in looks.items():
        p = Pic(16, 16)
        p.a = src.copy()
        for y in range(16):
            for x in range(16):
                k = tuple(int(v) for v in src[y, x, :3])
                if src[y, x, 3] and k in red:
                    p.a[y, x] = rgba(cols[red[k]])
        out[name] = p
    # the thorns: dark stems across the channel, barbs up over the lip and down past the stone below
    t = out['ChannelThorn']
    for x0 in (1, 6, 11):
        t.line(x0, 9, x0 + 4, 6, '4A3A28')
        t.line(x0 + 4, 6, x0 + 5, 4, '2E2418')
        t.put(x0 + 2, 6, '2E2418')  # barbs
        t.put(x0 + 5, 7, '2E2418')
    for x0 in (3, 9, 14):
        t.line(x0, 9, x0 - 1, 12, '4A3A28')
        t.put(x0 - 2, 12, '2E2418')
    for (x, y) in ((4, 5), (10, 6), (15, 4)):  # a little dark-red at the barbs' tips
        t.put(x, y, '6A2A24')
    return out


def bearer_statue() -> Pic:
    """A statue of one of the five Seal-bearers along the Processional Way (16x40, standing on its base cell): a hooded,
    armoured figure of weathered stone, broad in the shoulders, both hands on a sword point-down before it, on a plinth
    carved with a seal."""
    p = Pic(16, 40)
    # the plinth: a block with a moulding, a round seal carved on its face
    p.rect(2, 31, 13, 39, STATUE[1])
    p.rect(2, 31, 4, 39, STATUE[0])
    p.rect(11, 31, 13, 39, STATUE[2])
    p.rect(1, 30, 14, 31, STATUE[0])
    p.rect(1, 38, 14, 39, STATUE[2])
    p.ring(7.5, 34.5, 2.2, 2.2, STATUE[2])
    p.put(7, 34, STATUE[2])
    # the cloak, from broad shoulders to the hem on the plinth
    for y in range(10, 30):
        half = 5.4 - (y - 10) * 0.08 if y < 14 else 4.2 + (y - 14) * 0.06
        for x in range(int(7.5 - half), int(7.5 + half) + 2):
            u = (x - 7.5) / half
            if abs(u) <= 1.0:
                p.put(x, y, STATUE[0] if u < -0.4 else STATUE[1] if u < 0.45 else STATUE[2])
    p.rect(2, 9, 13, 11, STATUE[1])  # the pauldrons, a ridge of plate over each shoulder
    p.rect(2, 9, 5, 9, STATUE[0])
    p.rect(10, 9, 13, 9, STATUE[2])
    # the hood over the head, its face lost in shadow
    p.ellipse(7.5, 5.5, 3, 3.6, lambda u, v: lit(u, v, STATUE[0], STATUE[1], STATUE[2]))
    p.put(7, 1, STATUE[1])
    p.rect(6, 5, 9, 7, '4E4842')
    p.put(6, 5, '6A645C')
    # the sword point-down before it, the hands on the pommel
    p.line(7, 14, 7, 29, '9A9488')
    p.line(8, 14, 8, 29, '5E5850')
    p.rect(4, 16, 11, 16, '9A9488')  # the crossguard
    p.rect(4, 17, 11, 17, '5E5850')
    p.rect(6, 12, 9, 14, STATUE[0])  # the hands, one over the other
    p.line(6, 13, 9, 13, STATUE[2])
    for (x, y) in ((4, 21), (10, 25), (5, 27), (11, 19)):  # weathering
        p.put(x, y, '8A8478')
    p.outline()
    return p


ICONS: dict = {}
FIXTURE_ART = {'Bier': bier, 'InstrumentNiche': instrument_niche, 'BearerStatue': bearer_statue}

if __name__ == '__main__':
    pics = write(ICONS, FIXTURE_ART)
    for name, pic in channels().items():
        pic.save(FIXTURES / f'{name}.png')
        pics[name] = pic
        print(f'  {name}.png 16x16')
    if len(sys.argv) > 1:
        preview(pics, Path(sys.argv[1]) / 'finale_things.png', ground=(120, 112, 100, 255))
