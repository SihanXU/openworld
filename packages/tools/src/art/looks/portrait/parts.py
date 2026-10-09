"""The portrait parts the pipeline draws (docs/looks.md §4): one edit of a locked base bust per part (and per
mood for faces), in the order they are needed. `python -I parts.py <work dir>` writes the jobs for batch.py.

How each kind is drawn so it can be cut and repainted (extract.py):
- hair, beards and brows in a neutral mid grey: their value is their shading, the look gives the colour;
- a garment's three colours in key hues the cut can tell apart: its main cloth pure red (its colour 1), its
  second cloth pure green (colour 2), its leather or metal pure blue (colour 3); anything else keeps its paint;
- every edit keeps the base's head, pose, framing and background, so the change is the part.

Bodies: the woman's base is drawn first; the man's is her bust with a man's body under the same head, so every
head part (hair, faces, hats, beards, glasses, marks) is drawn once on her and fits both. Children have their own
head (the girl's), shared by the boy.
"""

from __future__ import annotations

import json
import os
import sys

KEEP = "Keep everything else exactly the same: the same face, the same head, the same body, the same top, the same pose, the same framing, the same plain background, the same anime art style."
KEEP_HEAD = "Keep the head and the face exactly the same and in the same place, the same pose, the same framing, the same plain background, the same anime art style."
GREY_HAIR = "in a plain medium grey colour"
KEYS = "Use flat solid key colours: the main fabric pure red, the second fabric pure green, any leather, metal or trim pure blue."

ADULT_HAIR = {
    "hair.long": "long straight hair with straight-cut bangs over the forehead, falling over her shoulders down to her chest",
    "hair.short": "a short men's haircut: short at the back and the sides with the ears showing, a little longer on top, a short fringe",
    "hair.messy": "short tousled messy spiky hair with a messy fringe",
    "hair.swept": "short hair combed back from the forehead, the forehead bare",
    "hair.cropped": "a very short crew cut: an even, smooth, solid layer of short hair following the shape of the skull, the forehead and ears showing",
    "hair.thin": "an old man's balding head: the top of the head bald and shiny, short hair left only on the sides and the back of the head above the ears",
    "hair.tied": "long hair pulled back and tied low at the nape, a few loose strands framing the face, the forehead mostly bare",
    "hair.bob": "a chin-length bob with straight bangs",
    "hair.wavy": "long wavy curly hair falling past her shoulders, a side-swept fringe",
    "hair.braid": "hair parted in the middle with a single thick braid hanging over her left shoulder to her chest",
    "hair.bun": "hair pulled back into a neat round bun on the top of the head, the forehead bare",
    "hair.ponytail": "a high ponytail tied at the back of the head, a fringe over the forehead, the ponytail visible behind her head",
}
MAN_HAIR = {"hair.thin"}
CHILD_HAIR = {
    "hair.pigtails": "two short pigtails tied at the sides of the head and straight bangs",
    "hair.tuft": "short messy hair with a tuft sticking up on top",
    "hair.childbob": "a round bowl-cut bob with straight bangs",
}
FACES = {
    "face.soft": "soft gentle round eyes with long lashes, thin arched eyebrows, a small gentle mouth",
    "face.bright": "big bright lively eyes with large highlights, raised eyebrows, a small open cheerful mouth",
    "face.keen": "narrow sharp eyes with a keen look, straight eyebrows, a small firm mouth",
    "face.stern": "narrowed stern eyes with small irises, thick heavy straight eyebrows, a firm straight mouth",
    "face.weary": "tired heavy-lidded half-closed eyes, softly drooping eyebrows, a small calm mouth",
}
MOODS = {
    "happy": "smiling happily, the eyes gently curved, the mouth open in a smile",
    "sad": "sad, the eyebrows raised in the middle, the eyes glistening, the mouth turned down",
    "angry": "angry, the eyebrows pulled down hard, the eyes narrowed, the mouth in a tight frown",
    "surprised": "surprised, the eyes wide open, the eyebrows raised high, the mouth a small round o",
    "shy": "shy and embarrassed, blushing on the cheeks, looking slightly aside, a small uncertain smile",
}
BEARDS = {
    "beard.full": "a full thick beard covering the jaw and chin, with a moustache",
    "beard.moustache": "a neat moustache, no beard",
    "beard.stubble": "short stubble on the jaw, chin and upper lip",
}
# what is only worn (an item's look, docs/looks.md §5): over whatever the person wears
WORN = {
    "armour.plate": "a plain metal breastplate over the chest, the metal pure red",
    "cloak.cloak": "a cloak fastened at the throat and hanging from the shoulders, the cloth pure red",
    "cloak.pauldrons": "a pair of metal pauldrons on the shoulders, the metal pure red",
}
HATS = {
    "hat.straw": "a wide-brimmed straw hat, the straw pure red",
    "hat.kerchief": "a cloth headscarf covering the head and tied under the chin, the cloth pure red",
    "hat.hood": "a loose cloth hood up over the head, framing the face, the cloth pure red",
    "hat.helm": "a simple round iron helmet with cheek guards, the metal pure red",
    "hat.cap": "a soft cloth cap with a short brim, the cloth pure red, the brim pure green",
    "hat.circlet": "a thin metal circlet around the head, the metal pure red",
    "hat.thorns": "a crown of thorny branches around the head, the thorns pure red",
}
OTHER = {
    "age.lined": "Make the face look about seventy years old: fine wrinkles around the eyes, smile lines beside the mouth, a few lines on the forehead and slightly sagging cheeks",
    "mark.scar": "Add a thin old scar running diagonally across the left cheek",
    "mark.freckles": "Add light freckles across the nose and cheeks",
    "glasses.round": "Give her round spectacles with thin metal frames, the frames pure red",
}
OUTFITS = {
    "outfit.dress": (["woman"], "a simple medieval village dress: a fitted bodice and long skirt (pure red) over a blouse with short sleeves (pure green)"),
    "outfit.workdress": (["woman"], "a plain work dress with long sleeves (pure red) and a long apron over it (pure green), a leather waist tie (pure blue)"),
    "outfit.shawl": (["woman"], "a long plain dress (pure red) with a knitted shawl over the shoulders (pure green)"),
    "outfit.oilcloth": (["woman", "man"], "a long waxed oilcloth coat with a high collar (pure red) over a plain shirt (pure green), buckles (pure blue)"),
    "outfit.robe": (["woman"], "a long hooded herbalist's robe with wide sleeves, the hood down (pure red), a collar lining (pure green), a leather belt with pouches (pure blue)"),
    "outfit.coat": (["woman", "man"], "a long tailored scholar's coat with a high collar (pure red) over a waistcoat and shirt (pure green), buttons (pure blue)"),
    "outfit.vestment": (["woman", "man"], "a long priest's vestment robe (pure red) with a stole hanging over both shoulders (pure green), embroidered trim (pure blue)"),
    "outfit.tunic": (["man"], "a belted medieval tunic with long sleeves (pure red), a shirt collar showing (pure green), a leather belt (pure blue)"),
    "outfit.workshirt": (["man"], "a work shirt with sleeves rolled up to the elbows (pure red) and suspenders (pure green)"),
    "outfit.apron": (["man"], "a blacksmith's heavy leather apron (pure red) over a sleeveless undershirt (pure green), bare muscular arms, leather straps (pure blue)"),
    "outfit.travel": (["woman", "man"], "a travelling coat (pure red) over a shirt (pure green), a satchel strap across the chest (pure blue)"),
    "outfit.gambeson": (["man"], "a padded quilted gambeson (pure green) under a guard's tabard (pure red), a leather belt and iron buckles (pure blue)"),
    "outfit.plate": (["man"], "plate armour with pauldrons (pure blue) under a knight's surcoat (pure red) with a trim (pure green)"),
    "outfit.gi": (["man"], "a wrapped martial-arts jacket crossing at the chest (pure red) tied with a sash belt (pure green)"),
    "outfit.cloak": (["woman", "man"], "a long heavy travelling cloak closed at the throat (pure red) over a tunic (pure green), a clasp (pure blue)"),
    "outfit.adventurer": (["woman", "man"], "adventurer's clothes: a fitted tunic (pure red) over a shirt (pure green), a leather vest and belt (pure blue)"),
    "outfit.smock": (["girl", "boy"], "a simple child's smock (pure red) over a shirt (pure green)"),
    "outfit.pinafore": (["girl"], "a pinafore dress (pure red) over a blouse (pure green)"),
}


def jobs() -> list[dict]:
    j: list[dict] = []
    add = lambda out, edit, prompt, seed: j.append({"out": out, "edit": edit, "prompt": prompt, "seed": seed})
    # bases
    add("lib/base-man-raw.png", "lib/base-woman.png", "Change only the body below the neck into a slim young man's body: moderately broad shoulders, a flat chest, a lean build that is not muscular, wearing a plain light grey sleeveless tank top. " + KEEP_HEAD, 21)
    add("lib/base-girl.png", "lib/base-woman.png", "Turn her into a little girl of seven: a small child's body, much smaller than an adult's, with narrow shoulders, short thin arms and a completely flat chest, a round chubby child's face with big eyes and soft cheeks, still completely bald, wearing a plain light grey sleeveless tank top. Same front-facing pose, the head centered at the same height, the same plain background, the same anime art style.", 27)
    add("lib/base-boy-raw.png", "lib/base-girl.png", "Change only the body below the neck into a nine-year-old boy's body, wearing a plain light grey sleeveless tank top. " + KEEP_HEAD, 24)
    # neutral faces first: every person has one
    for i, (pid, d) in enumerate(FACES.items()):
        add(f"parts/{pid}.png", "lib/base-woman.png", f"Change only her eyes, eyebrows and mouth: {d}, a calm neutral expression. The eyebrows {GREY_HAIR}. " + KEEP, 100 + i)
    add("parts/face.child.png", "lib/base-girl.png", "Change only her eyes, eyebrows and mouth: big round innocent eyes with large highlights, small eyebrows, a small mouth, a calm neutral expression. " + KEEP, 110)
    # hair
    for i, (pid, d) in enumerate(ADULT_HAIR.items()):
        if pid == "hair.long":
            continue
        # a man's own style is drawn on his base (the head is the same; only he wears it)
        if pid in MAN_HAIR:
            add(f"parts/{pid}@man.png", "lib/base-man.png", f"Give him {d}, {GREY_HAIR}. " + KEEP, 200 + i)
        else:
            add(f"parts/{pid}.png", "lib/base-woman.png", f"Give her {d}, {GREY_HAIR}. " + KEEP, 200 + i)
    for i, (pid, d) in enumerate(CHILD_HAIR.items()):
        add(f"parts/{pid}.png", "lib/base-girl.png", f"Give her {d}, {GREY_HAIR}. " + KEEP, 220 + i)
    # outfits, per body
    for i, (pid, (bodies, d)) in enumerate(OUTFITS.items()):
        for b in bodies:
            who = {"woman": "her", "man": "him", "girl": "her", "boy": "him"}[b]
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Dress {who} in {d}. {KEYS} Change only the clothes. " + KEEP, 300 + i)
    # head things
    for i, (pid, d) in enumerate(HATS.items()):
        add(f"parts/{pid}.png", "lib/base-woman.png", f"Put {d} on her head. Change only the head covering. " + KEEP, 400 + i)
    for i, (pid, d) in enumerate(BEARDS.items()):
        add(f"parts/{pid}.png", "lib/base-man.png", f"Give him {d}, {GREY_HAIR}. " + KEEP, 450 + i)
    for i, (pid, d) in enumerate(OTHER.items()):
        add(f"parts/{pid}.png", "lib/base-woman.png", f"{d}. " + KEEP, 470 + i)
    for i, (pid, d) in enumerate(WORN.items()):
        for b in ("woman", "man"):
            who = {"woman": "her", "man": "him"}[b]
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Put on {who} {d}. Change nothing else. " + KEEP, 480 + i)
    # moods last: a face is complete without them (the neutral one stands in)
    for i, pid in enumerate([*FACES, "face.child"]):
        for k, (mood, d) in enumerate(MOODS.items()):
            add(f"parts/{pid}~{mood}.png", f"parts/{pid}.png", f"Change only the expression of the face: {d}. Keep the same eyes' shape and colour, the same eyebrows' shape. " + KEEP, 500 + i * 10 + k)
    return j


if __name__ == "__main__":
    out = os.path.join(sys.argv[1], "jobs.json")
    json.dump(jobs(), open(out, "w", encoding="utf-8"), indent=1)
    print(out, len(jobs()))
