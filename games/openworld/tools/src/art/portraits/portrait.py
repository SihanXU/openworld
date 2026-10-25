"""A person's own portrait (docs/character-art.md §4c), from a sprite drawn on white to the game's files:

    python portrait.py cut   <person.json> <sprite on white.png> <work dir>    the cut-out: <work>/neutral.png
    python portrait.py moods <person.json> <work dir> [mood …]                  each mood, and every face's blink and talk: <work>/<mood>[-blink|-talk].png
                                                                                  (the moods named alone, and their frames, when any are)
    python portrait.py moods <person.json> <work dir> --frames[=talk] [mood …]  the frames alone (of those named), the moods kept
    python portrait.py moods <person.json> <work dir> --sheet=<design sheet>    each mood drawn after its face on the sheet (`moodRefs`)
    python portrait.py ship  <person.json> <work dir> <assets dir>              the busts: <assets>/<mood>.webp (and <mood>-panel.webp, a wider
                                                                                  picture per mood for a game's own panel, where the person has `panel`)

`cut` needs rembg (`pip install "rembg[gpu]"`; isnet-anime, its alpha refined by pymatting); `moods` a local ComfyUI with the portrait
pipeline's Qwen-Image-Edit and its node that keeps a picture at its own size (../looks/portrait/comfy_node.py, setup.md).

What it does, and why:
- the cut: the sprite turned to face right if it was drawn facing left (`mirror`; every own portrait faces the dialogue's text, and the
  regions are in the turned sprite's pixels); the matting model's alpha, then the white ground un-mixed from every half-transparent edge pixel (F = (C - (1 - a) W) / a);
  then the white still caught in black hair's edge (the model keeps it as hair) keyed out: in a band along the silhouette, a light neutral
  pixel next to dark hair is hair over white (alpha = (255 - L) / (255 - L_hair), colour the hair's), except in the person's `keep`
  boxes (a feather, earrings, the face) and in any large light area (a shirt, cuffs, a lining);
- a mood: the face alone edited (the `faceCrop` at 3x, the stock encoder shifts a face, the sized one keeps it), pasted back through a
  soft ellipse (`face`) only where the cut is solid, so nothing but the face changes — or, where the person has `features`, through those
  ellipses alone (the eyes and brows, the mouth and cheeks), so a finely drawn face keeps its own outline and the hair over it;
- each face's blink and talk (the neutral's and every mood's): that face edited with the expression kept, and taken from the edit only in
  the eyes' and the mouth's ellipses (`eyes`, `mouth`), the rest that face's own pixels — an edit redraws the eyes a little too, and a
  talking frame that does flickers at the eyes' corners as the mouth moves; a blink asks for no blush unless the mood has one (`blushes`);
  a mood may word its own frame (`moodFrames`: a smiling face talks with its smile, not with the neutral's open mouth), or have none
  (null: a face with its eyes already closed needs no blink, the mood's own picture serves), or borrow another face's frame in a region
  ({"from": "neutral", "region": [...]}: wide-open eyes the model will not shut blink with the neutral's closed ones), or have its own
  region ({"words": ..., "region": [...]}: a grin larger than the neutral's mouth talks within all of it, or its edge flickers), and with
  the sheet given a box of it as picture 2 ({"ref": [...]}: the sheet's speaking face, so a smile opens and closes at its own width);
  `moodSeeds` a mood's own seed where the person's drew it badly; `moodFeatures` a mood's own regions (a grin wider than the mouth's);
  `moodTouch` a second pass over one feature of a mood ({"words", "features", "seed"}: one seed drew the eyes the sheet's way, another the mouth);
  `moodKeepAlso` a mood's own words for what stays (the brows it moves are not kept); `featuresBlur` the softness of the features' edge (a soft one over finely drawn eyes leaves the old lines showing through the new);
- with the design sheet given, a mood with a box in `moodRefs` is drawn after that face of the sheet (picture 2 of the edit: the
  expression the designer drew), its words a help.
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def load(path: str) -> dict:
    return json.load(open(path, encoding="utf-8"))


def cut(person: dict, src: str, work: str) -> None:
    from rembg import new_session, remove
    from scipy import ndimage as ndi
    os.makedirs(work, exist_ok=True)
    img = Image.open(src).convert("RGB")
    if person.get("mirror"):  # drawn facing the other way: every own portrait faces right, toward the dialogue's text
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    raw = remove(img, session=new_session("isnet-anime"), post_process_mask=False, alpha_matting=True,
                 alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=20, alpha_matting_erode_size=6)
    a = np.array(raw)[..., 3].astype(np.float32) / 255
    a[a < 0.08] = 0
    c = np.array(img).astype(np.float32)
    rgb = np.clip(np.where(a[..., None] > 0.02, (c - (1 - a[..., None]) * 255) / np.maximum(a[..., None], 0.02), 0), 0, 255)
    # the white caught in black hair's edge
    L = rgb.mean(axis=2)
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    dist = ndi.distance_transform_edt(a > 0.3)
    dark = (L < 95) & (a > 0.5)
    keep = np.zeros_like(a, bool)
    for x0, y0, x1, y1 in person["keep"]:
        keep[y0:y1, x0:x1] = True
    lab, n = ndi.label((L > 120) & (a > 0.3))
    sizes = ndi.sum(np.ones_like(L), lab, index=np.arange(1, n + 1))
    big = np.isin(lab, np.where(sizes > 2500)[0] + 1)
    cand = (dist <= 22) & (a > 0.02) & (L > 120) & (sat < 0.10) & ~keep & ~big & (ndi.binary_dilation(dark, iterations=12) | (dist <= 2.5))
    cnt = ndi.uniform_filter(dark.astype(np.float32), 15) + 1e-6
    hair = np.stack([ndi.uniform_filter(rgb[..., k] * dark, 15) / cnt for k in range(3)], axis=2)
    hair = np.where((cnt > 0.02)[..., None], hair, np.array([28, 28, 36], np.float32))
    key = np.clip((255 - L) / np.maximum(255 - hair.mean(axis=2), 1), 0, 1)
    a[cand] = np.minimum(a[cand], key[cand])
    rgb[cand] = hair[cand]
    a[a < 0.06] = 0
    Image.fromarray(np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8), "RGBA").save(os.path.join(work, "neutral.png"))
    print("cut:", int(cand.sum()), "edge pixels keyed out of the hair")


def ellipse_mask(size, ellipses, blur):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for cx, cy, rx, ry in ellipses:
        d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur))


def moods(person: dict, work: str, only: list[str] | None = None, frames_only: list[str] | None = None, sheet: str | None = None) -> None:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cg"))
    import cg  # noqa: E402  (ComfyUI: run, the Qwen model files)
    base = Image.open(os.path.join(work, "neutral.png")).convert("RGBA")
    on_white = Image.new("RGBA", base.size, (255, 255, 255, 255))
    on_white.alpha_composite(base)
    on_white = on_white.convert("RGB")
    crop_box = tuple(person["faceCrop"])
    fx0, fy0, fx1, fy1 = person["face"]
    face = Image.new("L", (crop_box[2] - crop_box[0], crop_box[3] - crop_box[1]), 0)
    ImageDraw.Draw(face).ellipse((fx0 - crop_box[0], fy0 - crop_box[1], fx1 - crop_box[0], fy1 - crop_box[1]), fill=255)
    face = face.filter(ImageFilter.GaussianBlur(9))
    if person.get("features"):  # only the eyes and brows, the mouth and cheeks: the outline and the hair over the face stay the drawing's own
        face = ellipse_mask(base.size, person["features"], person.get("featuresBlur", 6)).crop(crop_box)
    b = np.array(base).astype(np.float32)
    solid = np.clip((b[..., 3] / 255 - 0.9) / 0.1, 0, 1)[..., None]
    def keep_for(mood: str | None) -> str:
        # what this person wears on the face, kept where it is (Nessa's glasses); a mood may say its own (brows the mood moves)
        own = mood in person.get("moodKeepAlso", {})  # such a mood may move the brows and open the eyes wider
        also = person["moodKeepAlso"][mood] if own else person.get("keepAlso")
        return (" Keep everything else exactly the same: the face's shape and angle, " + ("the eyes' colour, " if own else "the eyes' size, shape and colour, ")
                + (also + ", " if also else "") + "the hair and bangs, the line art and the colouring, the framing.")
    keep_words = keep_for(None)
    def edit_face(face_on_white: Image.Image, prompt: str, ref: Image.Image | None = None, seed: int | None = None) -> Image.Image:
        c = face_on_white.crop(crop_box)
        name = cg.comfy.upload(c.resize((c.width * 3, c.height * 3), Image.LANCZOS))
        refs = {"image2": ["13", 0]} if ref is not None else {}
        enc = lambda t: {"class_type": "TextEncodeQwenImageEditPlusSized", "inputs": {"clip": ["4", 0], "prompt": t, "vae": ["5", 0], "image1": ["6", 0], **refs}}  # noqa: E731
        g = {
            "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": cg.comfy.UNET}},
            "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": cg.comfy.LORA, "strength_model": 1.0}},
            "3": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["2", 0], "shift": 3.1}},
            "4": {"class_type": "CLIPLoader", "inputs": {"clip_name": cg.comfy.CLIP, "type": "qwen_image"}},
            "5": {"class_type": "VAELoader", "inputs": {"vae_name": cg.comfy.VAE}},
            "6": {"class_type": "LoadImage", "inputs": {"image": name}},
            "7": enc(prompt),
            "8": enc(person.get("negative", "deformed face, extra eyes, text, watermark")),
            "9": {"class_type": "VAEEncode", "inputs": {"pixels": ["6", 0], "vae": ["5", 0]}},
            "10": {"class_type": "KSampler", "inputs": {"model": ["3", 0], "positive": ["7", 0], "negative": ["8", 0], "latent_image": ["9", 0], "seed": seed if seed is not None else person.get("seed", 7),
                                                        "steps": cg.comfy.STEPS, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
            "11": {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["5", 0]}},
            "12": {"class_type": "SaveImage", "inputs": {"images": ["11", 0], "filename_prefix": "lsw-portrait"}},
        }
        if ref is not None:
            g["13"] = {"class_type": "LoadImage", "inputs": {"image": cg.comfy.upload(ref.resize((ref.width * 2, ref.height * 2), Image.LANCZOS))}}
        edited = cg.run(g).resize((crop_box[2] - crop_box[0], crop_box[3] - crop_box[1]), Image.LANCZOS)
        whole = face_on_white.copy()
        whole.paste(edited, crop_box[:2])
        return whole

    def solid_paste(whole: Image.Image, under: np.ndarray) -> Image.Image:
        """An edit of the picture on white, kept only where the cut is solid (the edges stay the cut's own colour)."""
        e = np.array(whole).astype(np.float32)
        out = under.copy()
        out[..., :3] = e * solid + under[..., :3] * (1 - solid)
        return Image.fromarray(out.astype(np.uint8), "RGBA")

    # each mood: the face alone edited, pasted back through the face's ellipse
    for mood, words in person["moods"].items():
        if frames_only is not None or (only and mood not in only):
            continue
        box = person.get("moodRefs", {}).get(mood) if sheet else None
        if box:
            ref = Image.open(sheet).convert("RGB").crop(tuple(box))
            edited = edit_face(on_white, "Picture 2 is the same woman drawn by the designer with the expression wanted. Change only the facial "
                               f"expression of the woman in picture 1 to picture 2's expression: {words}. Do not copy picture 2's angle, framing, "
                               "hands or hair." + keep_for(mood), ref, person.get("moodSeeds", {}).get(mood))
        else:
            edited = edit_face(on_white, f"Change only her facial expression: {words}." + keep_for(mood), None, person.get("moodSeeds", {}).get(mood))
        whole = on_white.copy()
        own = person.get("moodFeatures", {}).get(mood)  # a mood whose features reach further (a wide grin)
        whole.paste(edited.crop(crop_box), crop_box[:2], ellipse_mask(base.size, own, person.get("featuresBlur", 6)).crop(crop_box) if own else face)
        result = solid_paste(whole, b)
        touch = person.get("moodTouch", {}).get(mood)
        if touch:  # a second pass over one feature (a mouth after the sheet's), the rest of the first kept
            again = Image.new("RGBA", result.size, (255, 255, 255, 255)); again.alpha_composite(result); again = again.convert("RGB")
            ref = Image.open(sheet).convert("RGB").crop(tuple(person["moodRefs"][mood])) if sheet and mood in person.get("moodRefs", {}) else None
            lead = ("Picture 2 is the same woman drawn by the designer with the expression wanted. " if ref is not None else "")
            edited = edit_face(again, lead + touch["words"] + keep_for(mood), ref, touch.get("seed"))
            whole = again.copy()
            whole.paste(edited.crop(crop_box), crop_box[:2], ellipse_mask(base.size, touch["features"], person.get("featuresBlur", 6)).crop(crop_box))
            result = solid_paste(whole, np.array(result).astype(np.float32))
        result.save(os.path.join(work, f"{mood}.png"))
        print("mood:", mood)
    # every face's blink and talk: only the eyes' or the mouth's region of an edit of that face
    no_blush = " Do not add any blush or redness to the cheeks or under the eyes: the skin there stays exactly as it is."
    for mood in ["neutral", *person["moods"]]:
        if only and mood not in only:
            continue
        pic = Image.open(os.path.join(work, f"{mood}.png")).convert("RGBA")
        white = Image.new("RGBA", pic.size, (255, 255, 255, 255))
        white.alpha_composite(pic)
        white = white.convert("RGB")
        for frame, words in person["frames"].items():
            if frames_only and frame not in frames_only:
                continue
            words = person.get("moodFrames", {}).get(mood, {}).get(frame, words)
            if words is None:  # no such frame for this face: its own picture
                pic.save(os.path.join(work, f"{mood}-{frame}.png"))
                print("frame:", mood, frame, "(the mood itself)")
                continue
            region_of, frame_seed, frame_ref = person["eyes" if frame == "blink" else "mouth"], None, None
            if isinstance(words, dict) and "words" in words:  # its own words, region and seed (a grin larger than the neutral's mouth)
                if sheet and words.get("ref"):  # the designer's face for this frame (the sheet's open mouth), picture 2
                    frame_ref = Image.open(sheet).convert("RGB").crop(tuple(words["ref"]))
                region_of, frame_seed, words = words.get("region", region_of), words.get("seed"), words["words"]
            if isinstance(words, dict):  # this face's frame borrowed from another's, in its region (wide eyes the model will not shut)
                region = ellipse_mask(pic.size, words.get("region", person["eyes" if frame == "blink" else "mouth"]), 4)
                out = pic.copy()
                out.paste(Image.open(os.path.join(work, f"{words['from']}-{frame}.png")).convert("RGBA"), (0, 0), region)
                out.save(os.path.join(work, f"{mood}-{frame}.png"))
                print("frame:", mood, frame, "(from", words["from"] + ")")
                continue
            extra = no_blush if frame == "blink" and mood not in person.get("blushes", []) else ""
            lead = "Picture 2 is the same woman drawn by the designer with the mouth wanted. " if frame_ref is not None else ""
            edited = edit_face(white, lead + words + extra + keep_words.replace("the eyes' size, shape and colour, ", "the expression's eyebrows, mouth and blush, "), frame_ref, frame_seed)
            region = ellipse_mask(pic.size, region_of, 4)
            out = pic.copy()
            out.paste(solid_paste(edited, np.array(pic).astype(np.float32)), (0, 0), region)
            out.save(os.path.join(work, f"{mood}-{frame}.png"))
            print("frame:", mood, frame)


def ship(person: dict, work: str, assets: str) -> None:
    os.makedirs(assets, exist_ok=True)
    names = [f"{m}{f}" for m in ["neutral", *person["moods"]] for f in ["", *(f"-{k}" for k in person["frames"])]]
    for n in names:
        im = Image.open(os.path.join(work, f"{n}.png")).convert("RGBA").crop(tuple(person["bust"]))
        im.resize((person["out"], person["out"]), Image.LANCZOS).save(os.path.join(assets, f"{n}.webp"), quality=92, method=6)
    if person.get("panel"):  # the figure with what spreads beside it (a fairy's wings), for a panel of the game's own
        for m in ["neutral", *person["moods"]]:
            im = Image.open(os.path.join(work, f"{m}.png")).convert("RGBA").crop(tuple(person["panel"]))
            im.resize((person["panelOut"], person["panelOut"]), Image.LANCZOS).save(os.path.join(assets, f"{m}-panel.webp"), quality=90, method=6)
            names.append(f"{m}-panel")
    print("shipped:", ", ".join(names), "→", assets)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "cut":
        cut(load(sys.argv[2]), sys.argv[3], sys.argv[4])
    elif cmd == "moods":
        flag = next((a for a in sys.argv[4:] if a.startswith("--frames")), None)
        named = [a for a in sys.argv[4:] if not a.startswith("--")]
        kinds = flag.split("=", 1)[1].split(",") if flag and "=" in flag else []
        sheet = next((a.split("=", 1)[1] for a in sys.argv[4:] if a.startswith("--sheet=")), None)
        moods(load(sys.argv[2]), sys.argv[3], named or None, kinds if flag else None, sheet)
    elif cmd == "ship":
        ship(load(sys.argv[2]), sys.argv[3], sys.argv[4])
    else:
        raise SystemExit(__doc__)
