// The colours a look paints with (docs/looks.md §3): one colour per key, and from it the ramps the two pictures
// need — the map sprite's tones (an authored ramp moved onto it, or four steps of `shade`), and a gradient for the
// portrait's shaded layers. Both come from the same colour, so the hair on the map and in the portrait cannot
// disagree. Pure: Node and browser.

import { game } from '../../game.ts'
import { lookColor, type Look } from '@openworld/engine'

export type RGB = [number, number, number]

export const hexRgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB

/** A colour of a look by id or `#rrggbb` (an unknown one: a grey, so a missing colour shows as missing). */
export function rgbOf(c: string | undefined): RGB {
  if (c && game().looks.colors[c]) return hexRgb(game().looks.colors[c].hex)
  if (c && /^#[0-9a-f]{6}$/i.test(c)) return hexRgb(c)
  return [128, 128, 128]
}

/** The colour a key of a look has (its own, else its part's default). */
export const keyRgb = (look: Look, key: string): RGB => rgbOf(lookColor(look, key, game().looks.table))

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function fromHsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** Toward a hue by up to `by` degrees along the short way round. */
const towards = (h: number, target: number, by: number) => {
  const d = ((target - h + 540) % 360) - 180
  return h + Math.sign(d) * Math.min(Math.abs(d), by)
}

/**
 * A colour's shade at a lightness step (-2 deepest shadow … 0 the colour … +2 highlight): shadows cooler and
 * richer, lights warmer — the hue shift painters (and the pack) use, rather than mixing with black and white.
 */
export function shade(rgb: RGB, step: number): RGB {
  const [h, s, l] = toHsl(rgb)
  if (step === 0) return rgb
  if (step < 0) {
    const k = -step
    return fromHsl(towards(h, 255, 7 * k), s + 0.04 * k * (1 - s), l * (1 - 0.24 * k))
  }
  return fromHsl(towards(h, 55, 8 * step), s * (1 - 0.06 * step), l + (1 - l) * 0.3 * step)
}

/**
 * An authored tone moved onto another colour: its hue, saturation and lightness taken relative to the authored
 * reference (the skin's mid tone, the eyes' bright one), so the reference becomes the key and the ramp keeps its
 * steps — darker tones by ratio, lighter ones toward white — for a pale skin and a deep one alike.
 */
export function retone(tone: RGB, ref: RGB, key: RGB): RGB {
  const [ht, st, lt] = toHsl(tone)
  const [hr, sr, lr] = toHsl(ref)
  const [hk, sk, lk] = toHsl(key)
  const l = lt <= lr ? (lr ? lk * (lt / lr) : lk) : lk + (1 - lk) * ((lt - lr) / (1 - lr || 1))
  return fromHsl(hk + (ht - hr), sr ? sk * (st / sr) : st, l)
}

/**
 * The portrait's gradient (256 steps) for a colour: a shaded layer's value v (0 the darkest line … ~150 the
 * shadow … 180 the colour … 230 the light … 255 a highlight) becomes a colour. The stops are the art's values
 * after normalising (portrait/extract.py), so a layer painted in any colour is repainted in this one.
 */
export function gradient(rgb: RGB): Uint8Array {
  const stops: [number, RGB][] = [
    [0, shade(shade(rgb, -2), -1)],
    [70, shade(rgb, -2)],
    [140, shade(rgb, -1)],
    [180, rgb],
    [225, shade(rgb, 1)],
    [255, shade(rgb, 2)],
  ]
  const out = new Uint8Array(256 * 3)
  for (let v = 0; v < 256; v++) {
    let i = 0
    while (i < stops.length - 2 && v > stops[i + 1][0]) i++
    const [v0, c0] = stops[i]
    const [v1, c1] = stops[i + 1]
    const t = v1 === v0 ? 0 : Math.max(0, Math.min(1, (v - v0) / (v1 - v0)))
    for (let k = 0; k < 3; k++) out[v * 3 + k] = Math.round(c0[k] + (c1[k] - c0[k]) * t)
  }
  return out
}
