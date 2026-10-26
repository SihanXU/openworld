"""The event CGs' pipeline (docs/character-art.md §4): a shot drawn to its written spec, the person made themself again from their portrait,
then refined at the game's size. Runs against a local ComfyUI (`LSW_COMFY`, the portrait pipeline's client: ../looks/portrait/comfy.py).

    python -I cg.py draw   <shots.json> <shot> <portrait.png> <out dir> [--seeds 1,2,3,4]
    python -I cg.py refix  <shots.json> <shot> <portrait.png> <drawn.png> …        (the identity pass again, with the shot's own words)
    python -I cg.py detail <shots.json> <shot> <chosen.png> [--denoise 0.2]

The drawing pass is Neta Lumina (Apache-2.0): it is given only the composition, the light and a short sketch of the person, so the camera,
the framing and the atmosphere come out as the spec says. The identity pass is Qwen-Image-Edit-2511 (Apache-2.0), given the drawn picture
and the person's portrait (`npx tsx ../looks/person.ts <id> <dir>`) and every feature in words; it changes the person and nothing else. Its
lessons (2026-10-24): a face close-up as a second reference makes a second person; a long drawing prompt bends small props (a pocket watch
became a hand mirror); glasses pushed up need saying "the only pair, nothing over the eyes", or a pair is added. The detail pass draws the
chosen picture again at 1920x1088 at a low strength: 0.2 sharpens lines and props and keeps the face; 0.3 already moves the eyes' colour.
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
import uuid

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "looks", "portrait"))
import comfy  # noqa: E402  (the portrait pipeline's client: host, upload, the Qwen model files)

NETA = os.environ.get("LSW_NETA", "neta-lumina-v1.0-all-in-one.safetensors")
W, H = 1664, 928  # the drawing size (16:9, about 1.5 megapixels)
GAME = (1920, 1080)
# Neta Lumina expects its prompts after this system line (its model card)
SYS = "You are an assistant designed to generate anime images based on textual prompts. <Prompt Start> "
LOOK = ("A soft, luminous Japanese visual novel event CG: delicate clean anime line art, gentle painterly gradients, tender rich colours, soft "
        "glowing light with bloom and light haze, shallow depth of field with a soft blurred foreground, cinematic composition, beautiful, elegant, dreamy.")
NEG_DRAW = (SYS + "photo, realistic, 3d, harsh shadows, oversaturated, lowres, blurry face, text, watermark, extra people, deformed hands, "
            "full body, wide shot, two pairs of glasses")
NEG_FIX = "photo, realistic, 3d render, extra people, deformed hands, text, watermark, chibi, child"
KEEP = ("Keep everything else of picture 1 exactly as it is: the composition, the camera angle, the framing, her pose and gesture, the light and "
        "its colours, the background and the blur. There is only one person in the picture.")


def run(graph: dict) -> Image.Image:
    """Queue a graph and wait for its first picture."""
    pid = comfy._post("/prompt", json.dumps({"prompt": graph, "client_id": uuid.uuid4().hex}).encode(), "application/json")["prompt_id"]
    while True:
        h = json.loads(comfy._get(f"/history/{pid}"))
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st.get("messages", []))[:2000])
            outs = [o for n in h[pid]["outputs"].values() for o in n.get("images", [])]
            if outs:
                o = outs[0]
                return Image.open(io.BytesIO(comfy._get(f"/view?filename={o['filename']}&subfolder={o['subfolder']}&type={o['type']}"))).convert("RGB")
        time.sleep(0.5)


def neta(prompt: str, seed: int, image: str | None = None, denoise: float = 1.0, size: tuple[int, int] = (W, H)) -> dict:
    """Neta Lumina: from nothing (a new shot), or over a picture at a strength (the detail pass)."""
    g = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": NETA}},
        "9": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 4.0}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": SYS + prompt}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": NEG_DRAW}},
        "5": {"class_type": "EmptySD3LatentImage", "inputs": {"width": size[0], "height": size[1], "batch_size": 1}},
        "6": {"class_type": "KSampler", "inputs": {"model": ["9", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["5", 0], "seed": seed,
                                                   "steps": 30, "cfg": 4.5, "sampler_name": "res_multistep", "scheduler": "linear_quadratic", "denoise": denoise}},
        "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": "lsw-cg"}},
    }
    if image:
        g["4"] = {"class_type": "LoadImage", "inputs": {"image": image}}
        g["5"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}}
    return g


def qwen(drawn: str, portrait: str, prompt: str, seed: int) -> dict:
    """Qwen-Image-Edit: picture 1 the drawn shot, picture 2 the person's portrait; the person made themself, the rest kept."""
    enc = lambda text: {"class_type": "TextEncodeQwenImageEditPlus",  # noqa: E731
                        "inputs": {"clip": ["4", 0], "prompt": text, "vae": ["5", 0], "image1": ["6", 0], "image2": ["13", 0]}}
    return {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": comfy.UNET}},
        "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": comfy.LORA, "strength_model": 1.0}},
        "3": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["2", 0], "shift": 3.1}},
        "4": {"class_type": "CLIPLoader", "inputs": {"clip_name": comfy.CLIP, "type": "qwen_image"}},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": comfy.VAE}},
        "6": {"class_type": "LoadImage", "inputs": {"image": drawn}},
        "13": {"class_type": "LoadImage", "inputs": {"image": portrait}},
        "7": enc(prompt),
        "8": enc(NEG_FIX),
        "9": {"class_type": "VAEEncode", "inputs": {"pixels": ["6", 0], "vae": ["5", 0]}},
        "10": {"class_type": "KSampler", "inputs": {"model": ["3", 0], "positive": ["7", 0], "negative": ["8", 0], "latent_image": ["9", 0], "seed": seed,
                                                    "steps": comfy.STEPS, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "11": {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["5", 0]}},
        "12": {"class_type": "SaveImage", "inputs": {"images": ["11", 0], "filename_prefix": "lsw-cg"}},
    }


def portrait_on_cream(path: str) -> str:
    """A transparent portrait set on the portraits' cream ground and uploaded."""
    src = Image.open(path).convert("RGBA")
    ground = Image.new("RGBA", src.size, (242, 237, 224, 255))
    ground.alpha_composite(src)
    return comfy.upload(ground.convert("RGB"))


def shot_of(path: str, key: str) -> tuple[dict, dict]:
    book = json.load(open(path, encoding="utf-8"))
    return book, book["shots"][key]


def drawing_words(book: dict, shot: dict) -> str:
    return shot["draw"].replace("{who}", shot.get("who", book["who"])) + " " + LOOK


def identity_words(book: dict, shot: dict) -> str:
    return shot.get("identity", book["identity"]) + " " + KEEP


def arg(flag: str, default: str) -> str:
    a = sys.argv
    return a[a.index(flag) + 1] if flag in a else default


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    cmd, rest = sys.argv[1], [x for x in sys.argv[2:] if not x.startswith("--")]
    if cmd == "draw":
        shots, key, portrait, out = rest[:4]
        book, shot = shot_of(shots, key)
        who = portrait_on_cream(portrait)
        os.makedirs(out, exist_ok=True)
        for seed in [int(s) for s in arg("--seeds", "1,2,3,4").split(",")]:
            t = time.time()
            raw = run(neta(drawing_words(book, shot), seed))
            raw.save(os.path.join(out, f"{key}-s{seed}-raw.png"))
            run(qwen(comfy.upload(raw), who, identity_words(book, shot), seed)).save(os.path.join(out, f"{key}-s{seed}.png"))
            print(f"{key} seed {seed}: {time.time() - t:.0f}s", flush=True)
    elif cmd == "refix":
        shots, key, portrait, *drawn = rest
        book, shot = shot_of(shots, key)
        who = portrait_on_cream(portrait)
        for p in drawn:
            seed = int(p.split("-s")[-1].split("-")[0].split(".")[0])
            run(qwen(comfy.upload(Image.open(p).convert("RGB")), who, identity_words(book, shot), seed)).save(p.replace("-raw.png", ".png"))
            print(p, flush=True)
    elif cmd == "detail":
        shots, key, chosen = rest[:3]
        book, shot = shot_of(shots, key)
        d = float(arg("--denoise", str(shot.get("detail", 0.2))))
        img = comfy.upload(Image.open(chosen).convert("RGB").resize((GAME[0], 1088), Image.LANCZOS))
        words = drawing_words(book, shot) + " Fine crisp details, clean delicate line art, detailed eyes and hands."
        out = run(neta(words, 3, img, d, (GAME[0], 1088))).crop((0, 4, GAME[0], 4 + GAME[1]))
        p = chosen.replace(".png", f"-hd{int(d * 100)}.png")
        out.save(p)
        print(p)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
