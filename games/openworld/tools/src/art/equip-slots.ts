// The empty equipment slots' silhouettes (16x16 each, in the order of the bag's paper doll): what goes there, drawn as
// a soft embossed shape the colour of the slot's own shadow — a helmet, an earring, a necklace, a pauldron, a
// breastplate, a gauntlet, a ring, a belt, a sword, a boot, a shield.
//
//   npx tsx games/openworld/tools/src/art/equip-slots.ts

import { Raster, writeAtlas, type Palette } from './raster.ts'

const PAL: Palette = {
  m: [122, 88, 52, 255], // the shape
  d: [92, 62, 34, 255], // its shaded side
  h: [255, 246, 220, 255], // the lit edge (the emboss)
}

const icon = (draw: (r: Raster) => void): Raster => {
  const r = new Raster(16, 16)
  draw(r)
  // shade the right and lower edge, light the upper left: pressed into the paper
  const out = new Raster(16, 16)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const v = r.get(x, y)
      if (v) out.set(x, y, r.get(x + 1, y) && r.get(x, y + 1) ? v : 'd')
      else if (r.get(x + 1, y + 1)) out.set(x, y, 'h')
    }
  return out
}

const head = icon((r) => {
  r.ellipse(8, 8, 6, 6, 'm')
  r.rect(2, 8, 13, 5, 'm')
  r.rect(4, 8, 3, 2, null as unknown as string)
  r.rect(10, 8, 3, 2, null as unknown as string)
  r.rect(7, 8, 2, 5, 'm')
})
const ear = icon((r) => {
  r.line(8, 2, 8, 5, 'm')
  r.line(7, 2, 9, 2, 'm')
  r.ellipse(8, 7, 2, 2, 'm')
  r.poly([[5.5, 9], [10.5, 9], [8, 14.5]], 'm')
})
const neck = icon((r) => {
  for (let a = 0; a <= 12; a++) {
    const t = (Math.PI * a) / 12
    r.set(8 - Math.cos(t) * 6, 2 + Math.sin(t) * 7, 'm')
  }
  r.poly([[8, 9], [11, 12], [8, 15], [5, 12]], 'm')
})
const shoulders = icon((r) => {
  r.ellipse(8, 9, 7, 5, 'm')
  r.rect(1, 9, 15, 4, null as unknown as string)
  r.ellipse(8, 11, 5.5, 2.5, 'm')
  r.rect(1, 12, 15, 4, null as unknown as string)
})
const body = icon((r) => {
  r.poly([[3, 2], [6, 2], [8, 4], [10, 2], [13, 2], [14, 6], [12, 7], [12, 14], [4, 14], [4, 7], [2, 6]], 'm')
  r.line(8, 6, 8, 13, 'd')
})
const hands = icon((r) => {
  // a gauntlet: four fingers apart, a thumb out to the side, the cuff
  r.rect(4, 7, 8, 5, 'm')
  for (const [x, top] of [[4, 3], [6, 2], [8, 2], [10, 3]] as const) r.rect(x, top, 1, 7 - top + 1, 'm')
  for (const x of [5, 7, 9]) r.rect(x, 6, 1, 1, 'm')
  r.poly([[11.5, 8], [14.5, 5.5], [15, 7], [12, 11]], 'm')
  r.rect(3, 12, 10, 3, 'm')
})
const ring = icon((r) => {
  r.ellipse(8, 10, 5, 4.5, 'm')
  r.ellipse(8, 10, 3, 2.5, null as unknown as string)
  r.poly([[6, 5], [10, 5], [8, 2]], 'm')
  r.rect(6, 4, 5, 2, 'm')
})
const waist = icon((r) => {
  r.rect(1, 6, 15, 4, 'm')
  r.rect(6, 4, 5, 8, 'm')
  r.rect(7, 6, 3, 4, null as unknown as string)
  r.rect(8, 7, 1, 2, 'm')
})
const weapon = icon((r) => {
  r.line(13, 2, 5, 10, 'm', 2)
  r.line(3, 8, 8, 13, 'm', 2)
  r.line(4, 11, 2, 13, 'm', 2)
})
const feet = icon((r) => {
  r.rect(5, 2, 5, 9, 'm')
  r.poly([[5, 9], [10, 9], [14, 11], [14, 14], [4, 14], [4, 11]], 'm')
})
const arm = icon((r) => {
  r.poly([[3, 2], [13, 2], [13, 8], [8, 15], [3, 8]], 'm')
  r.line(8, 4, 8, 12, 'd')
  r.line(5, 6, 11, 6, 'd')
})

/** In the bag's order: ear head neck / shoulders body hands / ring waist ring / weapon feet arm (the second ring shares the first's). */
writeAtlas('Ui/EquipSlots.png', [[ear, head, neck, shoulders, body, hands, ring, waist, weapon, feet, arm]], PAL)
