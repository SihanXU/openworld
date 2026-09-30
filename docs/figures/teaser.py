"""Generate the paper teaser figure (docs/figures/teaser.svg).

Schematic art: pixel scenes are drawn procedurally until real game screenshots exist.
Render to PNG with docs/figures/render.mjs.
"""
import random
from pathlib import Path

W, H = 2200, 880
FONT = "Segoe UI, Helvetica, Arial, sans-serif"
MONO = "Consolas, Menlo, monospace"

INK = "#1f2933"
MUTED = "#6b7785"
OURS = "#1f7a8c"      # rule engine / ours
OURS_BG = "#e3f1f4"
AI = "#e07a1f"        # AI / patch
AI_BG = "#fdf0e3"
OK = "#2e8b57"
BAD = "#b83a3a"
WM = "#8a8f98"        # neural world model

out: list[str] = []


def el(s: str) -> None:
    out.append(s)


def text(x, y, s, size=18, fill=INK, weight="normal", anchor="start", family=FONT, italic=False):
    style = ' font-style="italic"' if italic else ""
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    el(f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" fill="{fill}" '
       f'font-weight="{weight}" text-anchor="{anchor}" xml:space="preserve"{style}>{s}</text>')


def rect(x, y, w, h, fill, stroke="none", sw=0, rx=0, extra=""):
    el(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" '
       f'stroke-width="{sw}" rx="{rx}" {extra}/>')


def arrow(x1, y1, x2, y2, color=INK, sw=2.5, dash=False, marker="arrow"):
    d = ' stroke-dasharray="7 6"' if dash else ""
    el(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"{d} '
       f'marker-end="url(#{marker}-{color[1:]})"/>')


def path_arrow(d, color=INK, sw=2.5, dash=False):
    ds = ' stroke-dasharray="7 6"' if dash else ""
    el(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{ds} '
       f'marker-end="url(#arrow-{color[1:]})"/>')


# ---------------------------------------------------------------- pixel art
TILE_COL = {
    "g": ["#6ab04c", "#63a646", "#71b852"],
    "G": ["#a3b845", "#9aae3f", "#adc24d"],      # dry grass (flammable)
    "f": ["#a3b845"],                              # burning dry grass
    "b": ["#4b3b2f", "#453629"],                   # burnt
    "w": ["#3d7fd6", "#4287de"],
    "i": ["#bfe6f5", "#cdeefa"],                   # frozen water
    "p": ["#d8b779", "#d2b072"],
    "T": ["#2f6b33"],
    "R": ["#a8432f"],
    "W": ["#e8d6a6"],
    "D": ["#6b4226"],
    "s": ["#7a7f87", "#737880", "#80858d"],        # stone
    "S": ["#e9eef2", "#dfe6eb"],                   # snow
    "d": ["#e2c77d", "#dcc076"],                   # desert
    "o": ["#9c7a4c", "#94734a"],                   # wood floor
    "k": ["#2b2d33"],                              # void / wall
}


def tile(x, y, t, sz, rng):
    cols = TILE_COL[t]
    rect(x, y, sz, sz, rng.choice(cols))
    if t == "T":
        r = sz * 0.45
        el(f'<circle cx="{x+sz/2}" cy="{y+sz/2}" r="{r}" fill="#3f8f45"/>')
        el(f'<circle cx="{x+sz/2-r*0.3}" cy="{y+sz/2-r*0.3}" r="{r*0.35}" fill="#57a85c"/>')
    elif t == "f":
        flame(x, y, sz)
    elif t == "w" and rng.random() < 0.25:
        rect(x + sz * 0.2, y + sz * 0.4, sz * 0.35, sz * 0.08, "#7fb2ee")
    elif t == "i":
        el(f'<line x1="{x+sz*0.2}" y1="{y+sz*0.7}" x2="{x+sz*0.6}" y2="{y+sz*0.3}" '
           f'stroke="#ffffff" stroke-width="{max(1, sz*0.08)}"/>')
    elif t == "R":
        rect(x, y + sz * 0.75, sz, sz * 0.25, "#8a3524")
    elif t == "D":
        rect(x + sz * 0.7, y + sz * 0.5, sz * 0.12, sz * 0.12, "#e0c060")


def flame(x, y, sz):
    u = sz / 8
    pts = [(1, 7), (7, 7), (6, 3), (5, 5), (4, 1), (3, 4), (2, 2)]
    el('<polygon points="' + " ".join(f"{x+a*u},{y+b*u}" for a, b in pts) + '" fill="#e8451e"/>')
    pts = [(2.5, 7), (5.5, 7), (5, 4.5), (4, 3), (3, 5)]
    el('<polygon points="' + " ".join(f"{x+a*u},{y+b*u}" for a, b in pts) + '" fill="#f7a21b"/>')
    rect(x + 3.5 * u, y + 5.5 * u, u, 1.5 * u, "#ffe066")


def sprite(x, y, rows, pal, px):
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            if c != ".":
                rect(round(x + i * px, 2), round(y + j * px, 2), px + 0.3, px + 0.3, pal[c])


PLAYER = ["..HHHH..", ".HHHHHH.", ".HSSSSH.", "..SESE..", "..SSSS..",
          ".BBBBBB.", "SBBBBBBS", ".BBBBBB.", "..L..L..", "..F..F.."]
NPC = ["..hhhh..", ".hhhhhh.", ".hSSSSh.", "..SESE..", "..SSSS..",
       ".rrrrrr.", "SrrrrrrS", ".rrrrrr.", "..L..L..", "..F..F.."]
SLIME = ["...CC...", "..CCCC..", ".CCCCCC.", "CCKCCKCC", "CCCCCCCC", ".CCCCCC."]
BUCKET = ["wwwww", "gbbbg", "gbbbg", ".ggg."]
FLASK = [".c.", ".n.", "ooo", "ooo", "ooo"]
PAL = {"H": "#6b3e1f", "S": "#f1c27d", "E": "#1f1f1f", "B": "#2e63b8", "L": "#2b2b3a",
       "F": "#4a3020", "h": "#2b2b2b", "r": "#b8342e", "C": "#5fd0c0", "K": "#133a36",
       "w": "#4a90e2", "g": "#8a8f98", "b": "#6d5a45", "c": "#d9c9a3", "n": "#5a4632",
       "o": "#3b2a1a"}


# ---------------------------------------------------------------- defs
def defs():
    el("<defs>")
    for c in [INK, OURS, AI, OK, BAD, WM, MUTED]:
        el(f'<marker id="arrow-{c[1:]}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" '
           f'markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>')
    el('<filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">'
       '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.12"/></filter>')
    el("</defs>")


def panel_title(x, y, tag, title, sub):
    text(x, y, tag, 26, INK, "bold")
    text(x + 38, y, title, 26, INK, "bold")
    text(x, y + 30, sub, 17, MUTED)


# ---------------------------------------------------------------- (a) the world
def biome_map(x, y, cols, rows, sz, kind, rng):
    grid = [["g"] * cols for _ in range(rows)]
    if kind == "town":
        for r in range(rows):
            grid[r][cols // 2] = "p"
        for c in range(cols):
            grid[rows // 2][c] = "p"
        for _ in range(5):
            hx, hy = rng.randrange(0, cols - 3), rng.randrange(0, rows - 2)
            if abs(hy - rows // 2) < 2 or abs(hx - cols // 2) < 3:
                continue
            for dx in range(3):
                grid[hy][hx + dx] = "R"
                grid[hy + 1][hx + dx] = "W"
            grid[hy + 1][hx + 1] = "D"
    elif kind == "forest":
        for r in range(rows):
            for c in range(cols):
                if rng.random() < 0.45:
                    grid[r][c] = "T"
        for c in range(cols):
            grid[rng.randrange(rows)][c] = "p"
    elif kind == "coast":
        for r in range(rows):
            edge = int(cols * 0.55 + 2 * rng.random())
            for c in range(edge, cols):
                grid[r][c] = "w"
            if edge - 1 >= 0:
                grid[r][edge - 1] = "d"
    elif kind == "snow":
        for r in range(rows):
            for c in range(cols):
                grid[r][c] = "S"
                if rng.random() < 0.12:
                    grid[r][c] = "T"
        for c in range(3, 9):
            for r in range(3, 6):
                grid[r][c] = "i"
    elif kind == "desert":
        for r in range(rows):
            for c in range(cols):
                grid[r][c] = "d"
        for c in range(cols):
            grid[rows - 3][c] = "p"
        grid[2][3] = grid[2][4] = "w"
    elif kind == "dungeon":
        for r in range(rows):
            for c in range(cols):
                grid[r][c] = "k"
        for _ in range(4):
            rx, ry = rng.randrange(0, cols - 4), rng.randrange(0, rows - 3)
            for dx in range(4):
                for dy in range(3):
                    grid[ry + dy][rx + dx] = "s"
        for c in range(cols):
            grid[rows // 2][c] = "s" if rng.random() < 0.9 else "k"
    elif kind == "interior":
        for r in range(rows):
            for c in range(cols):
                edge = r in (0, rows - 1) or c in (0, cols - 1)
                grid[r][c] = "k" if edge else "o"
        grid[rows - 1][cols // 2] = "D"
    elif kind == "fields":
        for r in range(rows):
            for c in range(cols):
                grid[r][c] = "G" if (r // 2) % 2 == 0 else "g"
        for r in range(rows):
            grid[r][2] = "p"
    for r in range(rows):
        for c in range(cols):
            tile(x + c * sz, y + r * sz, grid[r][c], sz, rng)
    # people and items as pixels
    walk = [(c, r) for r in range(rows) for c in range(cols) if grid[r][c] in "gpdSos"]
    for _ in range(rng.randint(3, 7)):
        if walk:
            c, r = rng.choice(walk)
            rect(x + c * sz + sz * 0.25, y + r * sz + sz * 0.1, sz * 0.5, sz * 0.8,
                 rng.choice(["#2e63b8", "#b8342e", "#7a3fb0", "#2b2b3a", "#c07a1a"]))
    for _ in range(rng.randint(3, 8)):
        if walk:
            c, r = rng.choice(walk)
            rect(x + c * sz + sz * 0.35, y + r * sz + sz * 0.35, sz * 0.3, sz * 0.3, "#ffd23f")


def panel_a():
    x0, y0 = 40, 60
    panel_title(x0, y0, "(a)", "A large symbolic world", "state and rules are code: persistent, exact, inspectable")
    rng = random.Random(7)
    kinds = ["town", "forest", "coast", "fields", "interior",
             "dungeon", "town", "snow", "forest", "interior",
             "desert", "coast", "interior", "town", "dungeon",
             "fields", "snow", "dungeon", "desert", "town"]
    cols, rows, sz, gap = 14, 10, 8, 14
    gx, gy = x0, y0 + 60
    centers = []
    for k, kind in enumerate(kinds):
        c, r = k % 5, k // 5
        x = gx + c * (cols * sz + gap)
        y = gy + r * (rows * sz + gap)
        el(f'<g filter="url(#shadow)">')
        biome_map(x, y, cols, rows, sz, kind, rng)
        el("</g>")
        rect(x, y, cols * sz, rows * sz, "none", "#ffffff", 1.5)
        centers.append((x + cols * sz / 2, y + rows * sz / 2))
    # portals between maps
    links = [(0, 1), (1, 2), (0, 5), (5, 6), (6, 7), (2, 7), (6, 11), (10, 11), (11, 12),
             (12, 13), (7, 8), (8, 9), (13, 18), (14, 19), (15, 16), (16, 17), (17, 18), (10, 15), (3, 4), (3, 8)]
    for a, b in links:
        (x1, y1), (x2, y2) = centers[a], centers[b]
        el(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#ffffff" stroke-width="2.5" '
           f'stroke-dasharray="4 4" opacity="0.9"/>')
        for cx, cy in ((x1, y1), (x2, y2)):
            el(f'<circle cx="{cx}" cy="{cy}" r="4" fill="#ffffff" stroke="{INK}" stroke-width="1.2"/>')
    grid_bottom = gy + 4 * (rows * sz + gap)
    text(gx + 5 * (cols * sz + gap) - gap, grid_bottom + 10, "… maps linked by portals", 16, MUTED,
         anchor="end", italic=True)

    # scale badges
    by = grid_bottom + 45
    badges = [("10¹", "maps"), ("10³", "NPCs with schedules"), ("10⁴", "items / fixtures")]
    bw = 190
    for k, (big, small) in enumerate(badges):
        bx = gx + k * (bw + 19)
        rect(bx, by, bw, 92, OURS_BG, OURS, 2, 10)
        text(bx + bw / 2, by + 50, big, 40, OURS, "bold", "middle")
        text(bx + bw / 2, by + 78, small, 16, INK, anchor="middle")

    # ontology strip
    oy = by + 130
    text(gx, oy, "Every entity is typed and tagged, so rules address classes, not instances:", 16, INK)
    chips = ["item › container › bucket", "tags: liquid:water", "status: burning", "element: fire"]
    cx, cyy = gx, oy + 14
    for ch in chips:
        w = 8.6 * len(ch) + 24
        if cx + w > gx + 600:
            cx, cyy = gx, cyy + 42
        rect(cx, cyy, w, 32, "#f3f5f7", "#c9d1d9", 1.2, 16)
        text(cx + w / 2, cyy + 22, ch, 15, INK, anchor="middle", family=MONO)
        cx += w + 10
    return gx + 5 * (cols * sz + gap)


# ---------------------------------------------------------------- (b) play + JIT modding
SCENE = [
    "TTTTTTTTTTTTTTTT",
    "TggggGGGGGgggppT",
    "TgggGGffGGGggppT",
    "TggGGffbGGgggppT",
    "TgggGGGGGggggppT",
    "TggggggggggggppT",
    "TggiiiigggggpppT",
    "TgiiiiiiwggggRRR",
    "TgiiiiiwwggppWWW",
    "TggwwwwwgggppWDW",
    "TgggggggggpppppT",
    "TTTTTTTTTTTTTTTT",
]


def scene(x, y, sz):
    rng = random.Random(3)
    for r, row in enumerate(SCENE):
        for c, t in enumerate(row):
            tile(x + c * sz, y + r * sz, t, sz, rng)
    px = sz / 8
    # player at (8,3) facing the fire, holding a bucket
    sprite(x + 8 * sz, y + 3 * sz - sz * 0.25, PLAYER, PAL, px * 1.0)
    sprite(x + 7.55 * sz, y + 3.45 * sz, BUCKET, PAL, px * 0.9)
    # steam puffs over the doused tile (7,3)
    for dx, dy, r in [(0.3, -0.1, 0.22), (0.6, -0.35, 0.18), (0.45, -0.6, 0.14)]:
        el(f'<circle cx="{x+(7+dx)*sz}" cy="{y+(3+dy)*sz}" r="{r*sz}" fill="#ffffff" opacity="0.85"/>')
    # frozen slime at (4,7) on the ice, with an oil flask thrown at it
    sprite(x + 4 * sz, y + 7 * sz + sz * 0.2, SLIME, PAL, px)
    el(f'<rect x="{x+3.9*sz}" y="{y+6.95*sz}" width="{1.2*sz}" height="{1.05*sz}" fill="#bfe6f5" '
       f'opacity="0.45" stroke="#ffffff" stroke-width="1.5"/>')
    sprite(x + 5.3 * sz, y + 6.2 * sz, FLASK, PAL, px * 0.9)
    # villager on the path
    sprite(x + 12 * sz, y + 9 * sz - sz * 0.25, NPC, PAL, px)
    # numbered markers
    for n, (cx, cy) in {"1": (7.5, 1.35), "2": (4.5, 5.7)}.items():
        el(f'<circle cx="{x+cx*sz}" cy="{y+cy*sz}" r="{sz*0.42}" fill="{INK}" stroke="#fff" stroke-width="2"/>')
        text(x + cx * sz, y + cy * sz + sz * 0.16, n, sz * 0.5, "#ffffff", "bold", "middle")
    rect(x, y, 16 * sz, 12 * sz, "none", INK, 2)


def box(x, y, w, h, fill, stroke, title, lines=(), title_col=None, mono=False, size=16):
    el('<g filter="url(#shadow)">')
    rect(x, y, w, h, fill, stroke, 2, 10)
    el("</g>")
    text(x + 14, y + 27, title, 18, title_col or stroke, "bold")
    for k, ln in enumerate(lines):
        text(x + 14, y + 52 + k * (size + 6), ln, size, INK, family=MONO if mono else FONT)


def panel_b(x0):
    y0 = 60
    panel_title(x0, y0, "(b)", "Play: rules run the world; the AI only patches gaps",
                "take · put · interact  →  rule library  →  hit: execute  |  miss: just-in-time mod")
    sz = 22
    sx, sy = x0, y0 + 60
    scene(sx, sy, sz)
    text(sx, sy + 12 * sz + 24, "live 2D JRPG scene (schematic)", 15, MUTED, italic=True)

    # interaction outcomes to the right of the scene
    cx = sx + 16 * sz + 30
    cw = 1600 - cx
    # (1) defined
    box(cx, sy, cw, 118, OURS_BG, OURS, "①  put(water_bucket → burning grass)",
        ["rule hit  core/douse-fire", "→ remove burning · bucket→empty · steam"], mono=False)
    text(cx + cw - 14, sy + 27, "no AI call", 16, OK, "bold", "end")
    # (2) undefined
    box(cx, sy + 140, cw, 118, AI_BG, AI, "②  interact(frozen slime, holding oil_flask)",
        ["no rule matches  (oil × frozen)", "→ undefined interaction: freeze 2 entities, ask"])
    text(cx + cw - 14, sy + 167, "AI call", 16, AI, "bold", "end")

    # JIT modding loop below
    ly = sy + 12 * sz + 60
    bw1 = 250
    box(x0, ly, bw1, 128, "#ffffff", AI, "Mod request",
        ["event + context", "+ ModSpec (DSL,", "   ontology, assets)"])
    box(x0 + bw1 + 40, ly, 190, 128, AI_BG, AI, "LLM modder",
        ["reads context,", "writes a type-", "level rule"])
    arrow(x0 + bw1 + 2, ly + 64, x0 + bw1 + 38, ly + 64, AI)
    px_ = x0 + bw1 + 40 + 190 + 40
    pw = 1600 - px_
    arrow(px_ - 38, ly + 64, px_ - 2, ly + 64, AI)
    el('<g filter="url(#shadow)">')
    rect(px_, ly, pw, 128, "#1e252d", AI, 2, 10)
    el("</g>")
    code = [("patch", AI), ("", None)]
    lines = ['rule "oil-coats-frozen":',
             '  when interact|put, instrument[oil],',
             '       target.status[frozen]',
             '  do addStatus(target, oiled); vfx(slick)']
    text(px_ + 14, ly + 24, "patch  (type-level, with tests)", 15, AI, "bold")
    for k, ln in enumerate(lines):
        text(px_ + 14, ly + 50 + k * 21, ln, 14, "#e6edf3", family=MONO)

    # validate + library
    vy = ly + 128 + 45
    arrow(px_ + pw / 2, ly + 130, px_ + pw / 2, vy - 2, AI)
    box(px_, vy, pw, 128, "#ffffff", OK, "validatePatch  (trust boundary)",
        ["✓ schema   ✓ ontology & assets", "✓ no conflict at same specificity", "✓ sandbox replay + patch tests"])
    lib_w = px_ - 40 - x0
    arrow(px_ - 2, vy + 64, px_ - 38, vy + 64, OK)
    box(x0, vy, lib_w, 128, OURS_BG, OURS, "Rule library  (shared by all players · versioned)",
        ["core/douse-fire   core/fire-spread", "core/wet+ice→frozen   core/hit-damage",
         ""], size=15)
    text(x0 + 14, vy + 52 + 2 * 21 + 2, "patch/oil-coats-frozen   ← new, permanent", 15, AI, "bold", family=MONO)

    # back to the game
    ry = vy + 128 + 42
    path_arrow(f"M {x0+lib_w/2} {vy+130} L {x0+lib_w/2} {ry-4}", OURS)
    text(x0, ry + 22, "② re-resolves and now hits the patch: the slime is oiled, and any later fire ignites it —",
         17, INK)
    text(x0, ry + 46, "for every instance of these types, for every player, with no further AI calls.", 17, INK)


# ---------------------------------------------------------------- (c) why code
def film(x, y, n, w, h, noisy, rng):
    for k in range(n):
        fx = x + k * (w + 6)
        rect(fx, y, w, h, "#2b2f36", "none", 0, 3)
        base = ["#6ab04c", "#3d7fd6", "#d8b779", "#a8432f"]
        for i in range(6):
            for j in range(4):
                cols = base[:]
                c = cols[(i // 2 + j // 2) % 4]
                if noisy and rng.random() < 0.18 * k:
                    c = rng.choice(["#8a6fb0", "#c9c9c9", "#e07a1f", "#555"])
                rect(fx + 3 + i * (w - 6) / 6, y + 3 + j * (h - 6) / 4, (w - 6) / 6 + 0.3, (h - 6) / 4 + 0.3, c)


def panel_c(x0):
    y0 = 60
    panel_title(x0, y0, "(c)", "Why code, not a world model", "")
    rng = random.Random(11)
    w = W - 40 - x0
    # neural world model
    cy = y0 + 45
    rect(x0, cy, w, 190, "#f4f5f7", WM, 2, 10)
    text(x0 + 14, cy + 28, "Neural world model", 19, "#4b5058", "bold")
    film(x0 + 14, cy + 44, 6, 62, 44, True, rng)
    text(x0 + 14, cy + 120, "• a network predicts every frame", 16, INK)
    text(x0 + 14, cy + 144, "• state lives in pixels: drifts, forgets", 16, INK)
    text(x0 + 14, cy + 168, "• one scene, minutes of context", 16, INK)
    # symbolic world
    sy = cy + 210
    rect(x0, sy, w, 190, OURS_BG, OURS, 2, 10)
    text(x0 + 14, sy + 28, "Large Symbolic World (ours)", 19, OURS, "bold")
    film(x0 + 14, sy + 44, 6, 62, 44, False, rng)
    text(x0 + 14, sy + 120, "• code runs every frame; AI only on novelty", 16, INK)
    text(x0 + 14, sy + 144, "• explicit state: persistent, consistent", 16, INK)
    text(x0 + 14, sy + 168, "• world-scale, runs in a browser", 16, INK)

    # schematic cost plot
    py = sy + 225
    text(x0, py, "Model calls over play time (schematic)", 18, INK, "bold")
    ax, ay, aw, ah = x0 + 40, py + 25, w - 60, 250
    el(f'<line x1="{ax}" y1="{ay+ah}" x2="{ax+aw}" y2="{ay+ah}" stroke="{INK}" stroke-width="2" '
       f'marker-end="url(#arrow-{INK[1:]})"/>')
    el(f'<line x1="{ax}" y1="{ay+ah}" x2="{ax}" y2="{ay}" stroke="{INK}" stroke-width="2" '
       f'marker-end="url(#arrow-{INK[1:]})"/>')
    text(ax + aw, ay + ah + 26, "play time", 15, MUTED, anchor="end")
    el(f'<text x="{ax-14}" y="{ay+ah/2}" font-family="{FONT}" font-size="15" fill="{MUTED}" '
       f'text-anchor="middle" transform="rotate(-90 {ax-14} {ay+ah/2})">cumulative calls</text>')
    # world model: linear, one pass per frame
    el(f'<line x1="{ax}" y1="{ay+ah}" x2="{ax+aw*0.42}" y2="{ay+8}" stroke="{WM}" stroke-width="3.5"/>')
    text(ax + aw * 0.42 + 8, ay + 26, "world model: every frame", 15, "#4b5058", "bold")
    # ours: saturating
    pts = []
    import math
    for k in range(0, 101):
        t = k / 100
        v = 1 - math.exp(-4.2 * t)
        pts.append(f"{ax + t * (aw - 10)},{ay + ah - v * ah * 0.42}")
    el(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{OURS}" stroke-width="3.5"/>')
    text(ax + aw - 10, ay + ah - ah * 0.42 - 14, "ours: only on novelty", 15, OURS, "bold", "end")
    # patch events: dense early, sparse later
    r2 = random.Random(5)
    for k in range(40):
        t = -math.log(1 - r2.random() * 0.985) / 4.2
        if t < 1:
            tx = ax + t * (aw - 10)
            el(f'<line x1="{tx}" y1="{ay+ah-2}" x2="{tx}" y2="{ay+ah-14}" stroke="{AI}" stroke-width="2"/>')
    text(ax + aw * 0.55, ay + ah - 24, "patches, each reused forever", 14, AI, anchor="middle")


def main():
    el(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    defs()
    rect(0, 0, W, H, "#ffffff")
    right_a = panel_a()
    el(f'<line x1="{right_a+28}" y1="50" x2="{right_a+28}" y2="{H-20}" stroke="#e1e5ea" stroke-width="2"/>')
    panel_b(right_a + 56)
    el(f'<line x1="1628" y1="50" x2="1628" y2="{H-30}" stroke="#e1e5ea" stroke-width="2"/>')
    panel_c(1656)
    el("</svg>")
    Path(__file__).with_name("teaser.svg").write_text("\n".join(out), encoding="utf-8")


if __name__ == "__main__":
    main()
