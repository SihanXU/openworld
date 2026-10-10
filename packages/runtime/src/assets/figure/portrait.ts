// A look's portrait (docs/looks.md §3.1): the anime bust drawn in the dialogue box, the codex and the wiki,
// composed from the parts' layers and repainted in the look's colours — the same colours the map sprite is
// painted in, so the two cannot disagree. Pure: images come in decoded (the client fetches them, the wiki and the
// review sheets read PNGs), the bust goes out as RGBA.
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
}

/** What the art pipeline wrote (public/assets/lsw/Looks/portrait/manifest.json). */
export interface PortraitManifest {
  /** The canvas's side in pixels. */
  size: number
  /** Each body's own bust. */
  bodies: Record<string, PortraitPart>
  /** Each part's portrait per body it is drawn for (`*`: any body with the shared adult head). */
  parts: Record<string, Record<string, PortraitPart>>
  /** Which bodies share a head (their head parts are drawn once, for the first). */
  heads: Record<string, string>
}

/** The stack, back to front. */
export const LAYER_Z = ['hairBack', 'body', 'outfit', 'armour', 'cloak', 'age', 'face', 'mark', 'beard', 'glasses', 'hair', 'hat'] as const

/** A decoded layer: the paint and the value map, both RGBA of the layer's box. */
export interface LayerPixels {
  paint: Uint8ClampedArray | Uint8Array
  value: Uint8ClampedArray | Uint8Array
}

/** The slots a look's parts are drawn from, in the manifest's terms: the body, then its parts. */
function partsOf(m: PortraitManifest, look: Look, mood: Mood | undefined): { slot: string; layers: PortraitLayer[]; covers?: boolean }[] {
  const out: { slot: string; layers: PortraitLayer[]; covers?: boolean }[] = []
  const body = m.bodies[look.body]
  if (body) out.push({ slot: 'body', layers: body.layers })
  const head = m.heads[look.body] ?? look.body
  for (const [slot, id] of Object.entries(look.parts)) {
    const per = m.parts[id]
    const p = per?.[look.body] ?? per?.[head] ?? per?.['*']
    if (!p) continue
    out.push({ slot, layers: (mood && mood !== 'neutral' && p.moods?.[mood]) || p.layers, covers: p.covers })
  }
  return out
}

/** Every layer file a look's portrait needs (to fetch them before composing). */
export function portraitFiles(m: PortraitManifest, look: Look, mood?: Mood): string[] {
  return partsOf(m, look, mood).flatMap((p) => p.layers.map((l) => l.file))
}

/** The bust of a look in a mood, `m.size` square, RGBA; layers not loaded yet are left out. */
export function composePortrait(m: PortraitManifest, look: Look, mood: Mood | undefined, get: (file: string) => LayerPixels | undefined): Uint8ClampedArray {
  const S = m.size
  const out = new Uint8ClampedArray(S * S * 4)
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
  const stack = parts.flatMap(({ slot, layers }) => layers.map((l) => ({ slot, l })))
  stack.sort((a, b) => LAYER_Z.indexOf(a.l.z as (typeof LAYER_Z)[number]) - LAYER_Z.indexOf(b.l.z as (typeof LAYER_Z)[number]))
  for (const { slot, l } of stack) {
    const px = get(l.file)
    if (!px) continue
    const zg = l.zones.map((k) => grad(k.startsWith('.') ? slot + k : k))
    for (let y = 0; y < l.h; y++) {
      const oy = l.y + y
      if (oy < 0 || oy >= S) continue
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
