"""A shot's reference board (docs/character-art.md §4): artworks found by the tags of what the shot holds, on Safebooru (all-ages), best
scored first; with `game_cg` among the tags, official game CGs only. For studying where the camera stands, how much of the frame the figure
takes and where the light comes from — never fed to a model, never shipped, kept outside the repository.

    python -I refboard.py <work dir> <name> "<tags>" ["<tags>" …]      (PER=8 a query; LANDSCAPE=0 to keep tall pictures)

Writes <work>/<name>/<id>.jpg, <work>/<name>/index.json (each one's query, score, tags and page) and <work>/<name>-board.png, a contact
sheet to look through. What is not for all ages is skipped; look over the sheet before using any of it.
"""

from __future__ import annotations

import io
import json
import os
import sys
import urllib.request

from PIL import Image, ImageDraw

API = "https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=60&tags={}+sort:score"
PAGE = "https://safebooru.org/index.php?page=post&s=view&id={}"


def fetch(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()


def main() -> None:
    work, name, queries = sys.argv[1], sys.argv[2], sys.argv[3:]
    out = os.path.join(work, name)
    os.makedirs(out, exist_ok=True)
    per = int(os.environ.get("PER", "8"))
    wide = os.environ.get("LANDSCAPE", "1") == "1"
    seen: set[int] = set()
    picked: list[dict] = []
    for q in queries:
        try:
            posts = json.loads(fetch(API.format(q.replace(" ", "+"))) or b"[]")
        except Exception as e:  # noqa: BLE001
            print("query failed:", q, e)
            continue
        n = 0
        for p in posts:
            if n >= per:
                break
            if p["id"] in seen or p.get("rating") not in (None, "general", "safe"):
                continue
            # a CG is wide
            if wide and int(p.get("width", 0)) < int(p.get("height", 1)) * 1.05:
                continue
            try:
                Image.open(io.BytesIO(fetch(p.get("sample_url") or p["file_url"]))).convert("RGB").save(os.path.join(out, f"{p['id']}.jpg"), quality=88)
            except Exception as e:  # noqa: BLE001
                print("skipped", p["id"], e)
                continue
            seen.add(p["id"])
            picked.append({"id": p["id"], "query": q, "score": p.get("score"), "tags": p.get("tags", "")[:300], "page": PAGE.format(p["id"])})
            n += 1
    json.dump(picked, open(os.path.join(out, "index.json"), "w"), ensure_ascii=False, indent=1)
    cols, tw, th = 4, 420, 236
    sheet = Image.new("RGB", (cols * tw, max(1, (len(picked) + cols - 1) // cols) * (th + 16)), (20, 20, 20))
    draw = ImageDraw.Draw(sheet)
    for i, p in enumerate(picked):
        im = Image.open(os.path.join(out, f"{p['id']}.jpg"))
        im.thumbnail((tw, th))
        x, y = (i % cols) * tw, (i // cols) * (th + 16)
        sheet.paste(im, (x + (tw - im.width) // 2, y + 16))
        draw.text((x + 4, y + 2), f"{p['id']}  [{p['query']}]", fill=(230, 230, 230))
    sheet.save(os.path.join(work, f"{name}-board.png"))
    print(f"{name}: {len(picked)} pictures → {os.path.join(work, name + '-board.png')}")


if __name__ == "__main__":
    main()
