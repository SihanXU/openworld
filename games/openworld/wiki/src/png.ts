// PNG in and out, with Node alone: an image's size from its header, a decoder for the images the wiki
// scales (8-bit RGB/RGBA/greyscale/palette, non-interlaced), and the tools' encoder.

import { existsSync, readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
export { png as encodePng } from '../../tools/src/art/png.ts'

export function pngSize(file: URL | string): [number, number] | undefined {
  if (!existsSync(file)) return undefined
  const b = readFileSync(file)
  if (b.length < 24 || b.readUInt32BE(12) !== 0x49484452) return undefined
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

export interface Image { w: number; h: number; rgba: Uint8Array }

export function decodePng(buf: Buffer): Image {
  let pos = 8
  let w = 0, h = 0, depth = 8, color = 6, interlace = 0
  let palette: Buffer | undefined
  let trns: Buffer | undefined
  const idat: Buffer[] = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12] }
    else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (interlace) throw new Error('interlaced PNG not supported')
  const channels = color === 6 ? 4 : color === 2 ? 3 : color === 4 ? 2 : 1
  const bpp = Math.max(1, (channels * depth) >> 3)
  const stride = Math.ceil((w * channels * depth) / 8)
  const raw = inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = out.subarray(y * stride, (y + 1) * stride)
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : undefined
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      let v = src[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      row[x] = v & 255
    }
  }
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4
    const r = out.subarray(y * stride)
    if (depth === 8 && color === 6) { rgba[o] = r[x * 4]; rgba[o + 1] = r[x * 4 + 1]; rgba[o + 2] = r[x * 4 + 2]; rgba[o + 3] = r[x * 4 + 3] }
    else if (depth === 8 && color === 2) { rgba[o] = r[x * 3]; rgba[o + 1] = r[x * 3 + 1]; rgba[o + 2] = r[x * 3 + 2]; rgba[o + 3] = 255 }
    else if (depth === 8 && color === 4) { rgba[o] = rgba[o + 1] = rgba[o + 2] = r[x * 2]; rgba[o + 3] = r[x * 2 + 1] }
    else if (depth === 8 && color === 0) { rgba[o] = rgba[o + 1] = rgba[o + 2] = r[x]; rgba[o + 3] = 255 }
    else if (color === 3) {
      const per = 8 / depth
      const i = (r[Math.floor(x / per)] >> ((per - 1 - (x % per)) * depth)) & ((1 << depth) - 1)
      rgba[o] = palette![i * 3]; rgba[o + 1] = palette![i * 3 + 1]; rgba[o + 2] = palette![i * 3 + 2]; rgba[o + 3] = trns && i < trns.length ? trns[i] : 255
    } else throw new Error(`PNG colour type ${color} depth ${depth} not supported`)
  }
  return { w, h, rgba }
}

/** Scale an image down to fit `max` pixels wide (box filter). */
export function shrink(img: Image, max: number): Image {
  if (img.w <= max) return img
  const s = img.w / max
  const w = max, h = Math.round(img.h / s)
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * s), x1 = Math.max(x0 + 1, Math.floor((x + 1) * s))
    const y0 = Math.floor(y * s), y1 = Math.max(y0 + 1, Math.floor((y + 1) * s))
    let r = 0, g = 0, b = 0, a = 0, n = 0
    for (let yy = y0; yy < y1 && yy < img.h; yy++) for (let xx = x0; xx < x1 && xx < img.w; xx++) {
      const o = (yy * img.w + xx) * 4
      const al = img.rgba[o + 3]
      r += img.rgba[o] * al; g += img.rgba[o + 1] * al; b += img.rgba[o + 2] * al; a += al; n++
    }
    const o = (y * w + x) * 4
    rgba[o] = a ? r / a : 0; rgba[o + 1] = a ? g / a : 0; rgba[o + 2] = a ? b / a : 0; rgba[o + 3] = n ? a / n : 0
  }
  return { w, h, rgba }
}
