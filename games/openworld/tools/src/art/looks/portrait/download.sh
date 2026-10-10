#!/bin/sh
# Qwen-Image-Edit-2511 (Apache-2.0) for ComfyUI: GGUF Q4_K_M transformer, fp8 text encoder, VAE, Lightning 8-step LoRA.
set -e
M=${COMFY:-.}/models
HF=https://huggingface.co
get() { echo "== $2"; curl -L -C - --retry 5 --retry-delay 5 -s -S -o "$2" "$1"; ls -la "$2"; }
get $HF/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors $M/vae/qwen_image_vae.safetensors
get $HF/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors $M/loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors
get $HF/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors $M/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors
get $HF/unsloth/Qwen-Image-Edit-2511-GGUF/resolve/main/qwen-image-edit-2511-Q4_K_M.gguf $M/unet/qwen-image-edit-2511-Q4_K_M.gguf
echo DONE
