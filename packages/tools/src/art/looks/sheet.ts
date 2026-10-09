// A review sheet of looks' map sprites (docs/looks.md §4): every facing and walk frame, enlarged, on the
// ground's green — what the art pipeline and the reviewer look at.
//
//   npx tsx packages/tools/src/art/looks/sheet.ts <out.png> [scale]

import { readFileSync, writeFileSync } from 'node:fs'
import type { Look } from '@lsw/engine'
import { FH, FW, composeSprite } from '../../../../client/src/assets/figure/sprite.ts'
import { png } from '../png.ts'

export function spriteSheet(looks: Look[], scale = 6): { w: number; h: number; rgba: Uint8Array } {
  const cw = FW * 4 * scale + 12
  const ch = FH * 4 * scale + 12
  const w = cw * looks.length + 12
  const h = ch + 12
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) rgba.set([86, 120, 76, 255], i * 4)
  looks.forEach((look, n) => {
    const s = composeSprite(look)
    for (let y = 0; y < FH * 4; y++)
      for (let x = 0; x < FW * 4; x++) {
        const k = (y * FW * 4 + x) * 4
        if (!s[k + 3]) continue
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const X = 12 + n * cw + x * scale + dx
            const Y = 12 + y * scale + dy
            rgba.set([s[k], s[k + 1], s[k + 2], 255], (Y * w + X) * 4)
          }
      }
  })
  return { w, h, rgba }
}

if (process.argv[1]?.endsWith('sheet.ts')) {
  const out = process.argv[2] ?? 'looks-sheet.png'
  const scale = Number(process.argv[3] ?? 6)
  const L = (body: string, parts: Record<string, string>, colors: Record<string, string>): Look => ({ body, parts, colors })
  const looks: Look[] = process.argv[4]
    ? JSON.parse(readFileSync(process.argv[4], 'utf8'))
    : [
        L('woman', { hair: 'hair.long', face: 'face.soft', outfit: 'outfit.dress' }, { skin: 'fair', hair: 'copper', eyes: 'leaf', 'outfit.1': 'woad', 'outfit.2': 'linen' }),
        L('man', { hair: 'hair.short', face: 'face.keen', outfit: 'outfit.tunic' }, { skin: 'warm', hair: 'umber', eyes: 'bark', 'outfit.1': 'moss', 'outfit.2': 'umber', 'outfit.3': 'leather' }),
        L('woman', { hair: 'hair.bob', face: 'face.bright', outfit: 'outfit.dress' }, { skin: 'light', hair: 'black', eyes: 'amber', 'outfit.1': 'madder', 'outfit.2': 'ivory' }),
        L('woman', { hair: 'hair.bun', face: 'face.weary', outfit: 'outfit.dress' }, { skin: 'tan', hair: 'silver', eyes: 'storm', 'outfit.1': 'plum', 'outfit.2': 'undyed' }),
        L('man', { hair: 'hair.short', face: 'face.stern', outfit: 'outfit.tunic' }, { skin: 'brown', hair: 'snow', eyes: 'sky', 'outfit.1': 'russet', 'outfit.2': 'slate', 'outfit.3': 'darkleather' }),
      ]
  const s = spriteSheet(looks, scale)
  writeFileSync(out, png(s.w, s.h, s.rgba))
  console.log(out, looks.map((l) => JSON.stringify(l)).join('\n'))
}
