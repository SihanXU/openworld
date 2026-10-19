// A look's portrait (docs/looks.md §3.2): the full standing figure the creator and the wiki show, and its bust —
// the head and shoulders — in the dialogue box and the character sheet, composed from the parts' layers and
// repainted in the look's colours — the same colours the map sprite is painted in, so the two cannot disagree.
// Pure: images come in decoded (the client fetches them, the wiki and the review sheets read PNGs), the figure
// goes out as RGBA.
//
// A layer is two images cut by the art pipeline (tools/src/art/looks/portrait): its paint (RGBA, the generated
// colours) and its value map (R the shading value, G 40 × its zone, A coverage). Zone 0 keeps the paint; zone k
// is the layer's k-th colour key, repainted through that colour's gradient (color.ts).

import type { Look, Mood } from '@openworld/engine'
import { gradient, keyRgb } from './color.ts'

/** A layer of a part's portrait: where it sits on the canvas, what it is drawn over and the keys its zones paint. */
export interface PortraitLayer {
  /** The image pair's path under the portrait folder (`<file>.png`, `<file>.z.png`). */
  file: string
  x: number
  y: number
  w: number
  h: number
  /** Its place in the stack (LAYER_Z). */
  z: string
  /** Zone k (1-based) paints this colour key: `skin`, `hair`, `eyes`, or a part's own `.1` (its slot's). */
  zones: string[]
}

/** A part's portrait for a body: its layers, and per mood the layers that replace them (a face's smile). */
export interface PortraitPart {
  layers: PortraitLayer[]
  moods?: Partial<Record<Mood, PortraitLayer[]>>
  /** A hat the hair goes under: the hair shows only below its lower edge. */
  covers?: boolean
  /** Slots it is drawn over, though they come later in the stack (a long skirt over the shoes). */
  above?: string[]
}

/** A body's own figure, and its bust: the square the dialogue box shows (the head and the shoulders). */
export interface PortraitBody extends PortraitPart {
  bust: { x: number; y: number; w: number; h: number }
}

/** What the art pipeline wrote (public/assets/lsw/Looks/portrait/manifest.json). */
export interface PortraitManifest {
  /** The canvas in pixels: a full figure standing, its feet on one line for every body. */
  w: number
  h: number
  /** Each body's own figure and bust. */
  bodies: Record<string, PortraitBody>
  /** Each part's portrait per body it is drawn for (every body its own: a man's face is not a woman's). */
  parts: Record<string, Record<string, PortraitPart>>
}

/** The stack, back to front (boots over the trousers; a long skirt says it goes over the shoes). */
export const LAYER_Z = ['hairBack', 'body', 'legs', 'outfit', 'shoes', 'armour', 'cloak', 'age', 'face', 'mark', 'beard', 'glasses', 'hair', 'hat'] as const
const zOf = (z: string) => LAYER_Z.indexOf(z as (typeof LAYER_Z)[number])

/** A decoded layer: the paint and the value map, both RGBA of the layer's box. */
export interface LayerPixels {
  paint: Uint8ClampedArray | Uint8Array
  value: Uint8ClampedArray | Uint8Array
}

/** The slots a look's parts are drawn from, in the manifest's terms: the body, then its parts. */
interface Drawn {
  slot: string
  layers: PortraitLayer[]
  covers?: boolean
  above?: string[]
}

function partsOf(m: PortraitManifest, look: Look, mood: Mood | undefined): Drawn[] {
  const out: Drawn[] = []
  const body = m.bodies[look.body]
  if (body) out.push({ slot: 'body', layers: body.layers })
  for (const [slot, id] of Object.entries(look.parts)) {
    const p = m.parts[id]?.[look.body]
    if (!p) continue
    out.push({ slot, layers: (mood && mood !== 'neutral' && p.moods?.[mood]) || p.layers, covers: p.covers, above: p.above })
  }
  return out
}

/** The square of a look's figure its bust shows (the whole canvas for a body the manifest does not know). */
export function bustRect(m: PortraitManifest, look: Look): { x: number; y: number; w: number; h: number } {
  return m.bodies[look.body]?.bust ?? { x: 0, y: 0, w: m.w, h: m.w }
}

/** Every layer file a look's portrait needs (to fetch them before composing). */
export function portraitFiles(m: PortraitManifest, look: Look, mood?: Mood): string[] {
  return partsOf(m, look, mood).flatMap((p) => p.layers.map((l) => l.file))
}

/** The figure of a look in a mood, `m.w` by `m.h`, RGBA; layers not loaded yet are left out. */
export function composePortrait(m: PortraitManifest, look: Look, mood: Mood | undefined, get: (file: string) => LayerPixels | undefined): Uint8ClampedArray {
  const S = m.w
  const SH = m.h
  const out = new Uint8ClampedArray(S * SH * 4)
  const grads = new Map<string, Uint8Array>()
  const grad = (key: string) => {
    if (!grads.has(key)) grads.set(key, gradient(keyRgb(look, key)))
    return grads.get(key)!
  }
  const parts = partsOf(m, look, mood)
  // a covering hat: per column, the lowest row it covers; the hair above it there is under the hat
  const under = new Int32Array(S).fill(-1)
  for (const l of parts.find((p) => p.covers)?.layers ?? []) {
    const px = get(l.file)
    if (!px) continue
    for (let x = 0; x < l.w; x++)
      for (let y = l.h - 1; y >= 0; y--)
        if (px.value[(y * l.w + x) * 4 + 3] > 128) {
          under[l.x + x] = Math.max(under[l.x + x], l.y + y)
          break
        }
  }
  // a layer's place: its own, or just over the last slot its part says it is drawn over
  const place = (l: PortraitLayer, above?: string[]) => Math.max(zOf(l.z), ...(above ?? []).map((s) => zOf(s) + 0.5))
  const stack = parts.flatMap(({ slot, layers, above }) => layers.map((l) => ({ slot, l, at: place(l, above) })))
  stack.sort((a, b) => a.at - b.at)
  for (const { slot, l } of stack) {
    const px = get(l.file)
    if (!px) continue
    const zg = l.zones.map((k) => grad(k.startsWith('.') ? slot + k : k))
    for (let y = 0; y < l.h; y++) {
      const oy = l.y + y
      if (oy < 0 || oy >= SH) continue
      for (let x = 0; x < l.w; x++) {
        const ox = l.x + x
        if (ox < 0 || ox >= S) continue
        if (slot === 'hair' && oy < under[ox]) continue
        const i = (y * l.w + x) * 4
        const a = px.value[i + 3] / 255
        if (a <= 0) continue
        const zone = Math.round(px.value[i + 1] / 40)
        let r: number, g: number, b: number
        if (zone > 0 && zg[zone - 1]) {
          const v = px.value[i] * 3
          const gr = zg[zone - 1]
          r = gr[v]
          g = gr[v + 1]
          b = gr[v + 2]
        } else {
          r = px.paint[i]
          g = px.paint[i + 1]
          b = px.paint[i + 2]
        }
        const o = (oy * S + ox) * 4
        const da = out[o + 3] / 255
        const na = a + da * (1 - a)
        out[o] = (r * a + out[o] * da * (1 - a)) / na
        out[o + 1] = (g * a + out[o + 1] * da * (1 - a)) / na
        out[o + 2] = (b * a + out[o + 2] * da * (1 - a)) / na
        out[o + 3] = na * 255
      }
    }
  }
  return out
}
