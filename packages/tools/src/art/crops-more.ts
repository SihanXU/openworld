// The homestead's further crops (docs/homestead.md), in the illustrated crops' style (lsw/Crops/<id>/): each takes the
// sprout and the young plant of an illustrated crop of its habit (leafy: the carrot's; sprawling: the pumpkin's;
// climbing: the tomato's), and draws its own produce — on the ripe plant, on the seed sack, and as the produce icon.
//
//   npx tsx packages/tools/src/art/crops-more.ts

import { readPng, writePng } from './png.ts'

type RGB = [number, number, number]
type Shape = 'root' | 'round' | 'head' | 'melon' | 'cob' | 'berries' | 'heart' | 'pepper' | 'drop'
interface Crop { id: string; habit: 'leafy' | 'sprawl' | 'climb'; shape: Shape; light: RGB; dark: RGB; accent?: RGB }

const CROPS: Crop[] = [
  { id: 'parsnip', habit: 'leafy', shape: 'root', light: [241, 227, 176], dark: [196, 170, 112] },
  { id: 'potato', habit: 'leafy', shape: 'round', light: [196, 146, 90], dark: [130, 88, 48] },
  { id: 'radish', habit: 'leafy', shape: 'round', light: [222, 60, 84], dark: [150, 30, 52], accent: [246, 240, 230] },
  { id: 'cauliflower', habit: 'sprawl', shape: 'head', light: [246, 242, 228], dark: [204, 196, 172], accent: [92, 150, 70] },
  { id: 'melon', habit: 'sprawl', shape: 'melon', light: [140, 198, 84], dark: [60, 120, 44] },
  { id: 'corn', habit: 'climb', shape: 'cob', light: [244, 210, 80], dark: [196, 150, 36], accent: [110, 160, 70] },
  { id: 'blueberry', habit: 'climb', shape: 'berries', light: [96, 128, 222], dark: [44, 62, 142] },
  { id: 'strawberry', habit: 'sprawl', shape: 'heart', light: [230, 62, 62], dark: [160, 30, 36], accent: [250, 228, 120] },
  { id: 'pepper', habit: 'climb', shape: 'pepper', light: [228, 56, 44], dark: [156, 28, 24], accent: [92, 150, 70] },
  { id: 'eggplant', habit: 'climb', shape: 'drop', light: [124, 72, 160], dark: [72, 36, 100], accent: [92, 150, 70] },
]
const BASE = { leafy: 'carrot', sprawl: 'pumpkin', climb: 'tomato' } as const
const INK: RGB = [36, 20, 16]

class Img {
  constructor(public w: number, public h: number, public px: Uint8Array = new Uint8Array(w * h * 4)) {}
  static of(path: string): Img {
    const { w, h, rgba } = readPng(path)
    return new Img(w, h, rgba)
  }
  copy(): Img {
    return new Img(this.w, this.h, Uint8Array.from(this.px))
  }
  get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.px[(y * this.w + x) * 4 + 3]
  }
  set(x: number, y: number, c: RGB, a = 255): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px.set([c[0], c[1], c[2], a], (y * this.w + x) * 4)
  }
  /** An ellipse, lit from the top left: the light colour, its lower right in the dark, an ink rim. */
  blob(cx: number, cy: number, rx: number, ry: number, light: RGB, dark: RGB): void {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const d = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2
        if (d <= 1) this.set(x, y, (x - cx) + (y - cy) > (rx + ry) * 0.25 ? dark : light)
        else if (d <= 1.55 && this.get(x, y) === 0) this.set(x, y, INK)
      }
  }
}

/** One produce of a shape, about `s` across, centred at (cx, cy). */
function produce(img: Img, c: Crop, cx: number, cy: number, s: number): void {
  const r = s / 2
  const { light, dark } = c
  const acc = c.accent ?? light
  switch (c.shape) {
    case 'root': {
      for (let i = 0; i <= s; i++) img.blob(cx, cy - r + i, Math.max(0.4, r * 0.55 * (1 - i / (s + 1))), 0.6, light, dark)
      img.set(cx, Math.round(cy - r - 1), [92, 150, 70])
      break
    }
    case 'round':
      img.blob(cx, cy, r * 0.8, r * 0.7, light, dark)
      if (c.accent) img.set(cx, Math.round(cy + r * 0.7), acc)
      break
    case 'head':
      img.blob(cx - r * 0.6, cy + r * 0.3, r * 0.5, r * 0.35, acc, [60, 110, 50])
      img.blob(cx + r * 0.6, cy + r * 0.3, r * 0.5, r * 0.35, acc, [60, 110, 50])
      img.blob(cx, cy, r * 0.7, r * 0.6, light, dark)
      img.set(Math.round(cx - 1), Math.round(cy - 1), dark)
      img.set(Math.round(cx + 1), Math.round(cy), dark)
      break
    case 'melon':
      img.blob(cx, cy, r * 0.9, r * 0.75, light, dark)
      for (let x = -2; x <= 2; x += 2) for (let y = -r * 0.5; y <= r * 0.5; y++) img.set(Math.round(cx + x), Math.round(cy + y), dark)
      break
    case 'cob':
      img.blob(cx, cy, r * 0.4, r * 0.9, light, dark)
      img.blob(cx - r * 0.45, cy + r * 0.3, r * 0.25, r * 0.6, acc, [60, 110, 50])
      img.blob(cx + r * 0.45, cy + r * 0.3, r * 0.25, r * 0.6, acc, [60, 110, 50])
      break
    case 'berries':
      for (const [dx, dy] of [[-0.45, 0.2], [0.45, 0.2], [0, -0.35], [0, 0.6]] as const) img.blob(cx + dx * r, cy + dy * r, r * 0.38, r * 0.38, light, dark)
      break
    case 'heart':
      img.blob(cx - r * 0.3, cy - r * 0.2, r * 0.45, r * 0.45, light, dark)
      img.blob(cx + r * 0.3, cy - r * 0.2, r * 0.45, r * 0.45, light, dark)
      img.blob(cx, cy + r * 0.25, r * 0.45, r * 0.5, light, dark)
      img.set(Math.round(cx - 1), Math.round(cy), acc)
      img.set(Math.round(cx + 1), Math.round(cy + 1), acc)
      img.set(Math.round(cx), Math.round(cy - r * 0.7), [92, 150, 70])
      break
    case 'pepper':
      for (let i = 0; i <= s; i++) img.blob(cx - r * 0.3 + (i / s) * r * 0.6, cy - r + i, Math.max(0.5, r * 0.4 * (1 - i / (s + 2))), 0.6, light, dark)
      img.set(Math.round(cx - r * 0.3), Math.round(cy - r - 1), acc)
      break
    case 'drop':
      img.blob(cx, cy + r * 0.2, r * 0.6, r * 0.75, light, dark)
      img.blob(cx, cy - r * 0.6, r * 0.35, r * 0.2, acc, [60, 110, 50])
      break
  }
}

/** Where produce hangs on the ripe plant of a habit (16 x 24: the soil at the bottom). */
const ON_PLANT: Record<Crop['habit'], [number, number, number][]> = {
  leafy: [[8, 20, 4]],
  sprawl: [[8, 19, 6]],
  climb: [[5, 11, 4], [11, 14, 4], [7, 18, 3]],
}

const out = (id: string, part: string, img: Img) => writePng(`Crops/${id}/${part}.png`, img.w, img.h, img.px)

for (const c of CROPS) {
  const base = BASE[c.habit]
  out(c.id, 'sprout', Img.of(`Crops/${base}/sprout.png`))
  out(c.id, 'young', Img.of(`Crops/${base}/young.png`))
  // the ripe plant: the base's young plant, its produce on it
  const ripe = Img.of(`Crops/${base}/young.png`)
  for (const [x, y, s] of ON_PLANT[c.habit]) produce(ripe, c, x, y, s)
  out(c.id, 'ripe', ripe)
  // the produce, large; and the seed sack with it small on its front
  const icon = new Img(16, 16)
  produce(icon, c, 8, 8, 10)
  out(c.id, 'produce', icon)
  const seeds = Img.of('Crops/carrot/seeds.png')
  for (let y = 8; y <= 13; y++) for (let x = 5; x <= 10; x++) if (seeds.get(x, y)) seeds.set(x, y, [226, 186, 120])
  produce(seeds, c, 8, 11, 4)
  out(c.id, 'seeds', seeds)
}
console.log(`${CROPS.length} crops → public/assets/lsw/Crops`)
