# The portrait pipeline's model (docs/looks.md §4)

The look portraits' parts are drawn by **Qwen-Image-Edit-2511** (Apache-2.0), run locally in ComfyUI, then cut
into layers and cleaned by `extract.py`. Everything it needs is open-licensed; nothing leaves the machine.

| What | File | Source | Licence |
|---|---|---|---|
| Transformer (GGUF Q4_K_M, 13.2 GB) | `models/unet/qwen-image-edit-2511-Q4_K_M.gguf` | `unsloth/Qwen-Image-Edit-2511-GGUF` | Apache-2.0 |
| Text encoder (Qwen2.5-VL 7B fp8, 9.4 GB) | `models/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors` | `Comfy-Org/Qwen-Image_ComfyUI` | Apache-2.0 |
| VAE (254 MB) | `models/vae/qwen_image_vae.safetensors` | `Comfy-Org/Qwen-Image_ComfyUI` | Apache-2.0 |
| Lightning LoRA, 4 steps (850 MB; 8 steps with `LSW_QWEN_STEPS=8`) | `models/loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` | `lightx2v/Qwen-Image-Edit-2511-Lightning` | Apache-2.0 |

Set up once (Windows, an NVIDIA GPU with 16 GB; 32 GB RAM):

```bash
git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git && cd ComfyUI
git clone --depth 1 https://github.com/city96/ComfyUI-GGUF.git custom_nodes/ComfyUI-GGUF
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install --python .venv/Scripts/python.exe -r requirements.txt -r custom_nodes/ComfyUI-GGUF/requirements.txt
sh download.sh   # the four files above, into models/
.venv/Scripts/python.exe main.py --listen 127.0.0.1 --port 8188
```

Copy `comfy_node.py` to `custom_nodes/lsw_nodes/__init__.py`: the stock edit encoder scales its reference picture
to a megapixel; this one keeps it at the input's size, so a 768x768 edit (`LSW_QWEN_SIZE`, the game's portrait
canvas) keeps every pixel where it was, which the layer cut needs, at half the cost of 1024.

`comfy.py` talks to it (`LSW_COMFY`, default `http://127.0.0.1:8188`); `batch.py` runs `parts.py`'s jobs (a job
waits for the picture it edits; `bases.py` clears the ground under each base); `build.py` cuts the pictures into the
game's layers and writes the manifest; `npx tsx games/openworld/tools/src/art/looks/review.ts` composes everyone's
portrait and sprite with the client's own code for review, `trial.ts` single looks full-size.

## Where it runs

Not on a laptop: a 768x1536 edit takes 4–5 minutes on a throttled laptop GPU, and a library run of hours cooks it
(2026-10-18). The team's GPU server (`ssh lmmslab-03`, 3090s, shared — ask which card) does one in about 33 s:

- ComfyUI at `/mnt/data2/lmmslab-03/sihan-video/ComfyUI` (with ComfyUI-GGUF and `lsw_nodes`), the model files above
  fetched there from `hf-mirror.com` (an upload from the laptop runs at well under 1 MB/s);
- the pipeline's scripts in `/mnt/data2/lmmslab-03/lsw-portraits/pipeline/`, the work dir (`lib/`, `parts/`,
  `jobs.json`) in `.../work/`; `run_server.sh` as `.../lsw_run.sh`;
- `nohup sh lsw_run.sh <gpu> > run.log 2>&1 &` starts one ComfyUI on that card, runs the batch and stops both when
  it ends; `kill $(cat run.pid)` stops it early. Check `nvidia-smi` afterwards: nothing may keep holding the card;
- the way back is slow too (about 0.2 MB/s), so the checking and the cut run there: `sheets.py work sheets` makes a
  small JPEG of each kind of part to look at, `build.py work out` cuts them, and only `out/` (the layers and the
  manifest, about 40 MB) comes back into `games/openworld/public/assets/lsw/Looks/portrait`.
