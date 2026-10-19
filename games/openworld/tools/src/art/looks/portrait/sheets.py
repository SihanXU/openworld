"""Contact sheets of the drawn parts, small JPEGs per kind, for checking from afar: python sheets.py <work> <out dir>."""
import os
import sys

from PIL import Image, ImageDraw

work, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
names = sorted(f[:-4] for f in os.listdir(os.path.join(work, "parts")) if f.endswith(".png"))
kinds: dict[str, list[str]] = {}
for n in names:
    kind = n.split(".")[0]
    if kind == "face":
        kind = "mood" if "~" in n else "face"
    kinds.setdefault(kind, []).append(n)
HEAD = {"woman": (234, 20, 534, 350), "man": (234, 20, 534, 350), "girl": (230, 120, 540, 480), "boy": (230, 120, 540, 480)}
for kind, ns in kinds.items():
    head = kind in ("face", "mood", "hair", "hat", "beard", "age", "mark", "glasses")
    w, h = (180, 200) if head else (130, 260)
    cols = 8
    rows = (len(ns) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w, rows * (h + 14)), "white")
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(ns):
        im = Image.open(os.path.join(work, "parts", n + ".png")).convert("RGB")
        body = n.split("@")[1].split("~")[0]
        if kind == "hair":
            im = im.crop((134, HEAD[body][1], 634, HEAD[body][1] + 560))
        elif head:
            im = im.crop(HEAD[body])
        x, y = (i % cols) * w, (i // cols) * (h + 14)
        sheet.paste(im.resize((w, h)), (x, y))
        d.text((x + 2, y + h), n, fill=(0, 0, 0))
    sheet.save(os.path.join(out, f"{kind}.jpg"), quality=80)
    print(kind, len(ns))
