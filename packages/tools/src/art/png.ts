// A minimal PNG writer for the project's own pixel art (RGBA, no filtering), into public/assets/lsw/.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

export const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../client/public/assets/lsw')

function crc32(buf: Uint8Array): number {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

export function png(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())])
}

/** Write an RGBA image to public/assets/lsw/<path>. */
export function writePng(path: string, w: number, h: number, rgba: Uint8Array): void {
  const p = join(OUT, path)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, png(w, h, rgba))
}

/** A 16x16 icon from a character grid and a palette of '#rrggbb' colours ('.' and unknown: clear). */
export function writeIcon(path: string, grid: string[], palette: Record<string, string>): void {
  const px = new Uint8Array(16 * 16 * 4)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const hex = palette[grid[y]?.[x] ?? '.']
      if (!hex) continue
      px.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], (y * 16 + x) * 4)
    }
  writePng(path, 16, 16, px)
}
