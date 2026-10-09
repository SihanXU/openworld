"""A small client for a local ComfyUI running Qwen-Image-Edit-2511 (Apache-2.0) — docs/looks.md §4.

The art pipeline's only contact with the model: `edit(image, prompt, seed)` returns the edited picture,
`draw(prompt, seed)` draws one from nothing. Models (see setup.md): the GGUF transformer, the fp8 Qwen2.5-VL
text encoder, the VAE and the Lightning 8-step LoRA, in ComfyUI's models folders.

    python -I comfy.py --draw "prompt" out.png
    python -I comfy.py --edit in.png "prompt" out.png
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
import urllib.request
import uuid

from PIL import Image

HOST = os.environ.get("LSW_COMFY", "http://127.0.0.1:8188")
UNET = os.environ.get("LSW_QWEN_UNET", "qwen-image-edit-2511-Q4_K_M.gguf")
CLIP = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
VAE = "qwen_image_vae.safetensors"
STEPS = int(os.environ.get("LSW_QWEN_STEPS", "4"))
LORA = f"Qwen-Image-Edit-2511-Lightning-{STEPS}steps-V1.0-bf16.safetensors"
# square, and the reference latent at the same size (comfy_node.py), so an edit keeps every pixel in its place
SIZE = int(os.environ.get("LSW_QWEN_SIZE", "768"))


def _post(path: str, body: bytes, ctype: str) -> dict:
    req = urllib.request.Request(HOST + path, data=body, headers={"Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())


def _get(path: str) -> bytes:
    with urllib.request.urlopen(HOST + path, timeout=600) as r:
        return r.read()


def upload(img: Image.Image) -> str:
    """Upload a picture to ComfyUI's input folder; its name there."""
    name = f"lsw-{uuid.uuid4().hex[:12]}.png"
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "PNG")
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
        + buf.getvalue()
        + f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{boundary}--\r\n".encode()
    )
    return _post("/upload/image", body, f"multipart/form-data; boundary={boundary}")["name"]


def _graph(prompt: str, seed: int, image: str | None, negative: str) -> dict:
    g: dict = {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": UNET}},
        "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": LORA, "strength_model": 1.0}},
        "3": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["2", 0], "shift": 3.1}},
        "4": {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "qwen_image"}},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "7": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["4", 0], "prompt": prompt, "vae": ["5", 0]}},
        "8": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["4", 0], "prompt": negative, "vae": ["5", 0]}},
        "10": {"class_type": "KSampler", "inputs": {"model": ["3", 0], "positive": ["7", 0], "negative": ["8", 0], "latent_image": ["9", 0],
                                                    "seed": seed, "steps": STEPS, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "11": {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["5", 0]}},
        "12": {"class_type": "SaveImage", "inputs": {"images": ["11", 0], "filename_prefix": "lsw"}},
    }
    if image:
        g["6"] = {"class_type": "LoadImage", "inputs": {"image": image}}
        for k in ("7", "8"):
            g[k] = {"class_type": "TextEncodeQwenImageEditPlusSized", "inputs": {**g[k]["inputs"], "image1": ["6", 0]}}
        g["9"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["6", 0], "vae": ["5", 0]}}
    else:
        g["9"] = {"class_type": "EmptySD3LatentImage", "inputs": {"width": SIZE, "height": SIZE, "batch_size": 1}}
    return g


def run(prompt: str, seed: int = 0, image: Image.Image | None = None, negative: str = "") -> Image.Image:
    """Queue one generation and wait for its picture."""
    name = upload(image.resize((SIZE, SIZE), Image.LANCZOS) if image.size != (SIZE, SIZE) else image) if image is not None else None
    client = uuid.uuid4().hex
    pid = _post("/prompt", json.dumps({"prompt": _graph(prompt, seed, name, negative), "client_id": client}).encode(), "application/json")["prompt_id"]
    t0 = time.time()
    while True:
        h = json.loads(_get(f"/history/{pid}"))
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st.get("messages", []))[:2000])
            outs = [o for n in h[pid]["outputs"].values() for o in n.get("images", [])]
            if outs:
                o = outs[0]
                data = _get(f"/view?filename={o['filename']}&subfolder={o['subfolder']}&type={o['type']}")
                print(f"  generated in {time.time() - t0:.0f}s", file=sys.stderr)
                return Image.open(io.BytesIO(data)).convert("RGB")
        time.sleep(1.0)


def edit(image: Image.Image, prompt: str, seed: int = 0) -> Image.Image:
    return run(prompt, seed, image)


def draw(prompt: str, seed: int = 0) -> Image.Image:
    return run(prompt, seed)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "--draw":
        draw(a[1], int(os.environ.get("SEED", "0"))).save(a[2])
    elif a[0] == "--edit":
        edit(Image.open(a[1]).convert("RGB"), a[2], int(os.environ.get("SEED", "0"))).save(a[3])
