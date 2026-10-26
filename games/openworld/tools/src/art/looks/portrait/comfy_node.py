"""LSW's one node: Qwen-Image-Edit-Plus text encoding with the reference latent at the input's own size, so an edit
at 768x768 keeps every pixel in place (the stock node scales the reference to a megapixel). A second picture, optional, is
a reference the prompt can point at ("picture 2": a style to draw in), encoded at its own size too; the edit is still of picture 1."""

import math

import comfy.utils
import node_helpers


class TextEncodeQwenImageEditPlusSized:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"clip": ("CLIP",), "prompt": ("STRING", {"multiline": True}), "vae": ("VAE",), "image1": ("IMAGE",)},
                "optional": {"image2": ("IMAGE",)}}

    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "encode"
    CATEGORY = "lsw"

    def encode(self, clip, prompt, vae, image1, image2=None):
        llama_template = "<|im_start|>system\nDescribe the key features of the input image (color, shape, size, texture, objects, background), then explain how the user's text instruction should alter or modify the image. Generate a new image that meets the user's requirements while maintaining consistency with the original input where appropriate.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n"
        images_vl, ref_latents, lead = [], [], ""
        for n, image in enumerate([image1] + ([image2] if image2 is not None else []), 1):
            samples = image.movedim(-1, 1)
            total = 384 * 384
            scale_by = math.sqrt(total / (samples.shape[3] * samples.shape[2]))
            s = comfy.utils.common_upscale(samples, round(samples.shape[3] * scale_by), round(samples.shape[2] * scale_by), "area", "disabled")
            images_vl.append(s.movedim(1, -1))
            w, h = samples.shape[3] // 8 * 8, samples.shape[2] // 8 * 8
            ref = comfy.utils.common_upscale(samples, w, h, "area", "disabled")
            ref_latents.append(vae.encode(ref.movedim(1, -1)[:, :, :, :3]))
            lead += f"Picture {n}: <|vision_start|><|image_pad|><|vision_end|>"
        tokens = clip.tokenize(lead + prompt, images=images_vl, llama_template=llama_template)
        conditioning = clip.encode_from_tokens_scheduled(tokens)
        conditioning = node_helpers.conditioning_set_values(conditioning, {"reference_latents": ref_latents}, append=True)
        return (conditioning,)


NODE_CLASS_MAPPINGS = {"TextEncodeQwenImageEditPlusSized": TextEncodeQwenImageEditPlusSized}
