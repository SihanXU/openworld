"""The portrait parts the pipeline draws (docs/looks.md §4): one edit of a locked full-body base per part and body
(and per mood for faces), in the order they are needed. `python -I parts.py <work dir>` writes the jobs for batch.py.

The style (agreed 2026-10-18): full figures about seven heads tall in crisp thin
dark sepia ink lines, fine hatching in the folds, flat muted fills, on a flat pale cream ground. The bases carry it;
every edit keeps it.

How each kind is drawn so it can be cut and repainted (build.py):
- hair, beards and brows in a neutral mid grey: their value is their shading, the look gives the colour;
- a garment's colours in key hues the cut can tell apart: its main cloth pure red (colour 1), its second cloth
  pure green (colour 2), its leather or metal pure blue (colour 3); anything else keeps its paint;
- every edit keeps the base's head, pose, framing and background, so the change is the part;
- the feet stay bare under an outfit and the legs stay bare under shoes: stockings and shoes are their own slots.

Bodies: each has its own head and face (a man is not her head on his body), so every head part is drawn on every
body it is for. The bases themselves are drawn by `base_jobs` (the woman's and the man's from the agreed trial).
"""

from __future__ import annotations

import json
import os
import sys

STYLE = "the same art style and line style: thin dark sepia ink lines, fine hatching, flat muted colours"
KEEP = f"Keep everything else exactly the same: the same face, the same head, the same body, the same pose, the same framing, the same plain pale cream background, {STYLE}."
KEEP_FACE = f"Keep the head's shape, the body, the pose, the framing, the plain pale cream background and {STYLE} exactly the same."
GREY_HAIR = "in a plain medium grey colour"
KEYS = "Use flat solid key colours: the main fabric pure red, the second fabric pure green, any leather, metal or trim pure blue."
BARE = "The feet stay bare: no shoes, no socks, no stockings; wherever the legs show below the clothes they stay bare skin as before."

ADULTS = ["woman", "man"]
CHILDREN = ["girl", "boy"]
ALL = ADULTS + CHILDREN
WHO = {"woman": "her", "man": "him", "girl": "her", "boy": "him"}
SHE = {"woman": "she", "man": "he", "girl": "she", "boy": "he"}

# --------------------------------------------------------------------- the bases
CHILD_BODY = ("a small child's body much shorter than an adult's, about four and a half heads tall, narrow shoulders, short thin arms and "
              "legs and a flat chest")


def base_jobs() -> list[dict]:
    """The four bases: the woman's and the man's cleaned of their ground, the girl's from her, the boy's from the girl."""
    j = [
        {"out": "lib/base-woman.png", "edit": "lib/base-woman-raw.png", "seed": 1,
         "prompt": "Remove the dark shadow on the ground under and around her feet and the hatching lines on her right leg, so the background is the same flat plain pale cream everywhere and both legs are drawn alike. " + KEEP},
        {"out": "lib/base-man.png", "edit": "lib/base-man-raw.png", "seed": 2,
         "prompt": "Remove the dark shadow on the ground under and around his feet, so the background is the same flat plain pale cream everywhere. " + KEEP},
        {"out": "lib/base-girl.png", "edit": "lib/base-woman.png", "seed": 3,
         "prompt": f"Turn her into a little girl of eight: {CHILD_BODY}; a child's own face: a round soft face with big round anime eyes with detailed irises and a light catch, a tiny nose and a small mouth; still completely bald, wearing a plain light grey sleeveless tank top and plain light grey shorts, barefoot. She stands front-facing in the same calm pose, centred, her feet on the same line as before, so she is much shorter and her head is lower in the picture. The same flat plain pale cream background, no shadow on the ground, {STYLE}."},
        {"out": "lib/base-boy.png", "edit": "lib/base-girl.png", "seed": 4,
         "prompt": f"Turn her into a little boy of nine with a boy's own face: slightly narrower eyes with short lashes and no eyeliner, slightly thicker straight eyebrows, a small nose and a small closed mouth, still a child's round face; a boy's body of the same height and build, completely bald, wearing a plain light grey sleeveless tank top and plain light grey shorts, barefoot. Keep the same pose, the same height, the same framing, the same flat plain pale cream background, {STYLE}."},
    ]
    return j


# --------------------------------------------------------------------- the head's parts (on every body they are for)
HAIR = {
    "hair.long": (ADULTS, "long straight hair with straight-cut bangs over the forehead, falling over the shoulders down to the chest"),
    "hair.short": (ADULTS, "a short haircut: short at the back and the sides with the ears showing, a little longer on top, a short fringe"),
    "hair.messy": (ADULTS, "short tousled messy spiky hair with a messy fringe"),
    "hair.swept": (ADULTS, "short hair combed back from the forehead, the forehead bare"),
    "hair.cropped": (ADULTS, "a very short crew cut: an even, smooth, solid layer of short hair following the shape of the skull, the forehead and ears showing"),
    "hair.thin": (["man"], "a balding head: the top of the head bald and shiny, short hair left only on the sides and the back of the head above the ears (only the hair: the face stays exactly as young as before, no wrinkles, the same eyes)"),
    "hair.tied": (ADULTS, "long hair pulled back and tied low at the nape, a few loose strands framing the face, the forehead mostly bare"),
    "hair.bob": (ADULTS, "a chin-length bob with straight bangs"),
    "hair.wavy": (ADULTS, "long wavy curly hair falling past the shoulders to the waist, a side-swept fringe"),
    "hair.braid": (ADULTS, "hair parted in the middle with a single thick braid hanging over the left shoulder to the chest"),
    "hair.bun": (ADULTS, "hair pulled back into a neat round bun on the top of the head, the forehead bare"),
    "hair.ponytail": (ADULTS, "a high ponytail tied at the back of the head, a fringe over the forehead, the ponytail visible behind the head"),
    "hair.pigtails": (CHILDREN, "two short pigtails tied at the sides of the head and straight bangs"),
    "hair.tuft": (CHILDREN, "short messy hair with a tuft sticking up on top"),
    "hair.childbob": (CHILDREN, "a round bowl-cut bob with straight bangs"),
}
FACES = {
    "face.soft": (ADULTS, "soft gentle eyes, thin arched eyebrows, a small gentle mouth"),
    "face.bright": (ADULTS, "big bright lively eyes with large light catches, raised eyebrows, a small open cheerful mouth"),
    "face.keen": (ADULTS, "narrow sharp eyes with a keen look, straight eyebrows, a small firm mouth"),
    "face.stern": (ADULTS, "narrowed stern eyes with small irises, thick heavy straight eyebrows, a firm straight mouth"),
    "face.weary": (ADULTS, "tired heavy-lidded half-closed eyes, softly drooping eyebrows, a small calm mouth"),
    "face.child": (CHILDREN, "big round innocent eyes with large light catches, small eyebrows, a small mouth"),
}
# how each body's face stays its own, and in the style, when its features change: the eyes as refined as the base's
EYES = ("drawn as refined anime eyes like before, the same size or larger, with detailed irises and a small light catch; "
        "the irises a flat pure blue (the cut finds them by it and the look gives their colour)")
OWN_FACE = {
    "woman": f"The eyes {EYES} and dark upper lashes. It stays her own pretty young woman's face.",
    "man": f"The eyes {EYES}, short lashes and no eyeliner. It stays his own handsome young man's face, the same jaw.",
    "girl": f"The eyes {EYES} and dark upper lashes. It stays her own little girl's face.",
    "boy": f"The eyes {EYES}, short lashes and no eyeliner. It stays his own little boy's face.",
}
MOODS = {
    "happy": "smiling happily, the eyes gently curved, the mouth open in a smile",
    "sad": "sad, the eyebrows raised in the middle, the eyes glistening, the mouth turned down",
    "angry": "angry, the eyebrows pulled down hard, the eyes narrowed, the mouth in a tight frown",
    "surprised": "surprised, the eyes wide open, the eyebrows raised high, the mouth a small round o",
    "shy": "shy and embarrassed, blushing on the cheeks, looking slightly aside, a small uncertain smile",
}
BEARDS = {
    "beard.full": "a full thick beard covering the jaw and chin, with a moustache, the mouth closed under it",
    "beard.moustache": "a neat moustache, no beard",
    "beard.stubble": "short stubble on the jaw, chin and upper lip",
}
HATS = {
    "hat.straw": (ADULTS, "a wide-brimmed straw hat, the straw pure red"),
    "hat.kerchief": (["woman"], "a cloth headscarf covering the head and tied under the chin, the cloth pure red"),
    "hat.hood": (ADULTS, "a loose cloth hood up over the head, framing the face, the cloth pure red"),
    "hat.helm": (ADULTS, "a simple round iron helmet with cheek guards, the metal pure red"),
    "hat.cap": (ADULTS, "a soft cloth cap with a short brim, the cloth pure red, the brim pure green"),
    "hat.circlet": (ADULTS, "a thin metal circlet resting on the head, round the forehead just above the eyebrows and above the ears, the metal pure red"),
    "hat.thorns": (ADULTS, "a crown of thorny branches around the head, the thorns pure red"),
}
OTHER = {
    "age.lined": (ADULTS, "Make the face look about seventy years old: fine wrinkles around the eyes, smile lines beside the mouth, a few lines on the forehead and slightly sagging cheeks"),
    "mark.scar": (ADULTS, "Add a thin old scar running diagonally across the left cheek"),
    "mark.freckles": (ALL, "Add light freckles across the nose and cheeks"),
    "glasses.round": (ADULTS, "Give {who} round spectacles with thin metal frames, the frames pure red"),
}

# --------------------------------------------------------------------- what is worn over the clothes
WORN = {
    "armour.plate": "a plain metal breastplate over the chest, the metal pure red",
    "cloak.cloak": "a cloak fastened at the throat and hanging from the shoulders down to the calves, the cloth pure red",
    "cloak.pauldrons": "a pair of metal pauldrons on the shoulders, the metal pure red",
}

# --------------------------------------------------------------------- the clothes: (bodies, words, long)
# long: it falls over the ankles, so it is drawn over the shoes (build.py: `above`)
OUTFITS = {
    "outfit.dress": (["woman"], "a simple village dress full of fine detail: a fitted laced bodice and a long skirt to the ankles with an embroidered hem (pure red) over a blouse with short puffed sleeves and a ruffled collar (pure green), a thin leather waist cord (pure blue)", True),
    "outfit.workdress": (["woman"], "a plain work dress with long rolled sleeves and a skirt to the calves (pure red), a long patched apron with a ruffled edge over it (pure green), a leather waist tie with a small pouch (pure blue)", True),
    "outfit.shawl": (["woman"], "a long plain dress to the ankles (pure red) with a knitted shawl crossed over the shoulders and tied (pure green)", True),
    "outfit.oilcloth": (["woman", "man"], "a long waxed oilcloth coat to the knees with a high collar and buckled straps (pure red) over a plain shirt and trousers to the ankles (pure green), buckles (pure blue)", False),
    "outfit.robe": (["woman"], "a long herbalist's robe to the ankles with wide sleeves and its hood folded down flat on the back behind the neck (pure red), the head bare, a collar lining (pure green), a leather belt with pouches and little bottles (pure blue)", True),
    "outfit.coat": (["woman", "man"], "a long tailored scholar's coat to the knees with a high collar and worn cuffs (pure red) over a waistcoat, a shirt and trousers to the ankles (pure green), buttons (pure blue)", False),
    "outfit.vestment": (["woman", "man"], "a long priest's vestment robe to the ankles (pure red) with a stole hanging over both shoulders down to the knees (pure green), embroidered trim (pure blue)", True),
    "outfit.tunic": (["man"], "a belted medieval tunic to the thighs with long sleeves (pure red), a shirt collar showing and trousers to the ankles (pure green), a leather belt (pure blue)", False),
    "outfit.workshirt": (["man"], "a work shirt with sleeves rolled up to the elbows (pure red), suspenders and trousers to the ankles (pure green)", False),
    "outfit.apron": (["man"], "a blacksmith's heavy leather apron to the knees (pure red) over a sleeveless undershirt and trousers to the ankles (pure green), bare muscular arms, leather straps (pure blue)", False),
    "outfit.travel": (["woman", "man"], "a travelling coat to the knees with worn cuffs (pure red) over a shirt and trousers to the ankles (pure green), a satchel strap across the chest (pure blue)", False),
    "outfit.gambeson": (["man"], "a padded quilted gambeson to the thighs and trousers to the ankles (pure green) under a guard's tabard (pure red), a leather belt and iron buckles (pure blue)", False),
    "outfit.plate": (["man"], "plate armour with pauldrons, gauntlets and greaves down to the ankles (pure blue) under a knight's surcoat to the knees (pure red) with a trim (pure green)", False),
    "outfit.gi": (["man"], "a wrapped martial-arts jacket crossing at the chest (pure red) tied with a sash belt, and loose trousers to the ankles (pure green)", False),
    "outfit.cloak": (["woman", "man"], "a long heavy travelling cloak without a hood to the ankles, closed at the throat (pure red), the head bare, over a tunic and trousers (pure green), a clasp (pure blue)", True),
    "outfit.adventurer": (["woman", "man"], "adventurer's clothes: a fitted tunic to the thighs (pure red) over a shirt and close trousers to the ankles (pure green), a leather vest, belt and pouches (pure blue)", False),
    "outfit.smock": (["girl", "boy"], "a simple child's smock to the knees (pure red) over a shirt (pure green)", False),
    "outfit.pinafore": (["girl"], "a pinafore dress to the knees (pure red) over a blouse with puffed sleeves (pure green)", False),
}

# --------------------------------------------------------------------- legs and shoes (their own slots)
LEGS = {
    "legs.stockings": (["woman", "girl"], "long knitted stockings up over the knees, the knit pure red"),
    "legs.hose": (ALL, "thick wool hose covering the legs up to the shorts, the wool pure red"),
    "legs.wraps": (["man", "boy"], "cloth leg wraps wound round the shins from the ankles to the knees, the cloth pure red"),
}
SHOES = {
    "shoes.boots": (ALL, "worn leather lace-up ankle boots, the leather pure red, the laces pure green"),
    "shoes.shoes": (ALL, "plain low leather shoes, the leather pure red"),
    "shoes.buckled": (["woman", "girl"], "neat buckled strap shoes, the leather pure red, the buckles pure blue"),
    "shoes.tall": (ADULTS, "tall leather riding boots up to the knees with a turned-down cuff, the leather pure red"),
    "shoes.sandals": (ADULTS, "simple leather sandals with straps across the feet, the straps pure red"),
}


def jobs() -> list[dict]:
    j: list[dict] = base_jobs()
    add = lambda out, edit, prompt, seed: j.append({"out": out, "edit": edit, "prompt": prompt, "seed": seed})
    # neutral faces first: every person has one
    for i, (pid, (bodies, d)) in enumerate(FACES.items()):
        for b in bodies:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Change only {WHO[b]} eyes, eyebrows and mouth: {d}, a calm neutral expression. The eyebrows {GREY_HAIR}. {OWN_FACE[b]} " + KEEP_FACE, 100 + i)
    # hair
    for i, (pid, (bodies, d)) in enumerate(HAIR.items()):
        for b in bodies:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Give {WHO[b]} {d}, {GREY_HAIR}. Change only the hair. " + KEEP, 200 + i)
    # clothes, legs and shoes, per body
    for i, (pid, (bodies, d, _)) in enumerate(OUTFITS.items()):
        for b in bodies:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Dress {WHO[b]} in {d}. {KEYS} {BARE} Change only the clothes. " + KEEP, 300 + i)
    for i, (pid, (bodies, d)) in enumerate(LEGS.items()):
        for b in bodies:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Put {d} on {WHO[b]} legs. Change nothing else: the feet stay bare. " + KEEP, 360 + i)
    for i, (pid, (bodies, d)) in enumerate(SHOES.items()):
        for b in bodies:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Put {d} on {WHO[b]} feet. Change only the feet. " + KEEP, 380 + i)
    # head things
    for i, (pid, (bodies, d)) in enumerate(HATS.items()):
        for b in bodies:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Put {d} on {WHO[b]} head. Change only the head covering. " + KEEP, 400 + i)
    for i, (pid, d) in enumerate(BEARDS.items()):
        add(f"parts/{pid}@man.png", "lib/base-man.png", f"Give him {d}, {GREY_HAIR}. " + KEEP, 450 + i)
    for i, (pid, (bodies, d)) in enumerate(OTHER.items()):
        for b in bodies:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", d.format(who=WHO[b]) + ". " + KEEP, 470 + i)
    for i, (pid, d) in enumerate(WORN.items()):
        for b in ADULTS:
            add(f"parts/{pid}@{b}.png", f"lib/base-{b}.png", f"Put on {WHO[b]} {d}. Change nothing else. " + KEEP, 480 + i)
    # moods last: a face is complete without them (the neutral one stands in)
    for i, (pid, (bodies, _)) in enumerate(FACES.items()):
        for b in bodies:
            for k, (mood, d) in enumerate(MOODS.items()):
                add(f"parts/{pid}@{b}~{mood}.png", f"parts/{pid}@{b}.png", f"Change only the expression of the face: {d}. Keep the same eyes' shape and colour, the same eyebrows' shape. {OWN_FACE[b]} " + KEEP, 500 + i * 10 + k)
    return j


# what build.py reads of the parts: the long outfits (drawn over the shoes)
LONG = {pid for pid, (_, _, long) in OUTFITS.items() if long}


if __name__ == "__main__":
    out = os.path.join(sys.argv[1], "jobs.json")
    json.dump(jobs(), open(out, "w", encoding="utf-8"), indent=1)
    print(out, len(jobs()))
