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
  /** Slots this layer alone is drawn over (a coat's hem over the riding boots, while its trousers stay under them). */
  above?: string[]
}

/** A part's portrait for a body: its layers, and per mood the layers that replace them (a face's smile). */
export interface PortraitPart {
  layers: PortraitLayer[]
  moods?: Partial<Record<Mood, PortraitLayer[]>>
  /** A hat the hair goes under: the hair shows only below its lower edge. */
  covers?: boolean
  /** Slots it is drawn over, though they come later in the stack (a long skirt over the shoes). */
  above?: string[]
  /** A boot that encloses the leg: below its top edge, nothing drawn under it shows (the trousers, the stockings, the
   * leg go into it), only what is drawn over it (a coat's hem). */
  encloses?: boolean
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
/** How far either side of an enclosing boot's box what goes into it is hidden (a trouser leg wider than the shaft). */
const BOOT_MARGIN = 8
/** How steeply hair beside a covering hat comes out from under its brim (rows down per column away from the hat). */
const HAT_SLOPE = 1.5

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
  encloses?: boolean
}

function partsOf(m: PortraitManifest, look: Look, mood: Mood | undefined): Drawn[] {
  const out: Drawn[] = []
  const body = m.bodies[look.body]
  if (body) out.push({ slot: 'body', layers: body.layers })
  for (const [slot, id] of Object.entries(look.parts)) {
    const p = m.parts[id]?.[look.body]
    if (!p) continue
    out.push({ slot, layers: (mood && mood !== 'neutral' && p.moods?.[mood]) || p.layers, covers: p.covers, above: p.above, encloses: p.encloses })
  }
  return out
}

/**
 * Where an enclosing boot hides what is drawn under it (1), on the canvas, or undefined when no part encloses: below
 * the boot's rim and outside its outline — a trouser leg wider than the shaft, a stocking beside it, the trousers
 * between the two boots — while inside the outline (the opening, the leg going in) what is under it shows. The outline
 * is, per boot (each 8-connected piece) and per row, what lies between its leftmost and rightmost pixel; the rim, per
 * column, the outline's highest row there; in the few columns beside a boot (`BOOT_MARGIN`) the nearest rim, and
 * between the boots the lower of the two rims beside the gap.
 */
function bootMask(parts: Drawn[], get: (file: string) => LayerPixels | undefined, S: number, SH: number): Uint8Array | undefined {
  const layers = parts.filter((p) => p.encloses).flatMap((p) => p.layers)
  if (!layers.length) return undefined
  const inside = new Uint8Array(S * SH)
  const rim = new Int32Array(S).fill(SH)
  let x0 = S
  let x1 = 0
  for (const l of layers) {
    const px = get(l.file)
    if (!px) continue
    // each boot: an 8-connected piece of the layer's coverage
    const piece = new Int32Array(l.w * l.h)
    let n = 0
    for (let s0 = 0; s0 < l.w * l.h; s0++) {
      if (piece[s0] || px.value[s0 * 4 + 3] === 0) continue
      piece[s0] = ++n
      const stack = [s0]
      while (stack.length) {
        const i = stack.pop()!
        const x = i % l.w
        const y = (i - x) / l.w
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= l.w || yy >= l.h) continue
            const j = yy * l.w + xx
            if (!piece[j] && px.value[j * 4 + 3] > 0) ((piece[j] = n), stack.push(j))
          }
      }
    }
    // per boot and row, from its leftmost pixel to its rightmost
    for (let y = 0; y < l.h; y++) {
      const lo = new Int32Array(n + 1).fill(l.w)
      const hi = new Int32Array(n + 1).fill(-1)
      for (let x = 0; x < l.w; x++) {
        const c = piece[y * l.w + x]
        if (c) ((lo[c] = Math.min(lo[c], x)), (hi[c] = Math.max(hi[c], x)))
      }
      for (let c = 1; c <= n; c++)
        for (let x = lo[c]; x <= hi[c]; x++) {
          const ox = l.x + x
          const oy = l.y + y
          if (ox < 0 || ox >= S || oy < 0 || oy >= SH) continue
          inside[oy * S + ox] = 1
          if (oy < rim[ox]) rim[ox] = oy
          x0 = Math.min(x0, ox)
          x1 = Math.max(x1, ox)
        }
    }
  }
  if (x0 > x1) return undefined
  const top = Int32Array.from(rim)
  // beside a boot, the nearest rim; between the boots, the lower of the rims either side of the gap
  for (let x = Math.max(0, x0 - BOOT_MARGIN); x <= Math.min(S - 1, x1 + BOOT_MARGIN); x++) {
    if (rim[x] < SH) continue
    let near = SH
    for (let d = 1; d <= BOOT_MARGIN && near === SH; d++) near = Math.min(x - d >= 0 ? rim[x - d] : SH, x + d < S ? rim[x + d] : SH)
    if (near < SH) {
      top[x] = near
      continue
    }
    if (x < x0 || x > x1) continue
    let l = x
    while (l > x0 && rim[l] >= SH) l--
    let r = x
    while (r < x1 && rim[r] >= SH) r++
    top[x] = Math.max(rim[l], rim[r])
  }
  const hide = new Uint8Array(S * SH)
  for (let x = 0; x < S; x++) for (let y = top[x]; y < SH; y++) if (!inside[y * S + x]) hide[y * S + x] = 1
  return hide
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
  // and beside it a line sloping down from its brim's ends: hair wider than the hat (spikes, waves, a bun) is under it
  // above that line, and below it falls out from under the hat, widening as it goes down (the sideburns, what falls to
  // the shoulders) — else it stuck out round the hat and the hat sat perched on the hair rather than on the head
  let first = -1
  let last = -1
  for (let x = 0; x < S; x++) if (under[x] >= 0) ((first = first < 0 ? x : first), (last = x))
  if (first >= 0) {
    for (let x = 0; x < first; x++) under[x] = under[first] + Math.round((first - x) * HAT_SLOPE)
    for (let x = last + 1; x < S; x++) under[x] = under[last] + Math.round((x - last) * HAT_SLOPE)
    for (let x = first; x <= last; x++)
      if (under[x] < 0) {
        let l = x
        while (under[l] < 0) l--
        let r = x
        while (under[r] < 0) r++
        under[x] = Math.max(under[l], under[r])
      }
  }
  // enclosing boots: what is drawn under them, below their rim and outside their outline, is in the boot
  const boot = bootMask(parts, get, S, SH)
  // a layer's place: its own, or just over the last slot its part says it is drawn over
  const place = (l: PortraitLayer, above?: string[]) => Math.max(zOf(l.z), ...[...(above ?? []), ...(l.above ?? [])].map((s) => zOf(s) + 0.5))
  const stack = parts.flatMap(({ slot, layers, above }) => layers.map((l) => ({ slot, l, at: place(l, above) })))
  stack.sort((a, b) => a.at - b.at)
  for (const { slot, l, at } of stack) {
    const px = get(l.file)
    if (!px) continue
    const inBoot = at < zOf('shoes')
    const zg = l.zones.map((k) => grad(k.startsWith('.') ? slot + k : k))
    for (let y = 0; y < l.h; y++) {
      const oy = l.y + y
      if (oy < 0 || oy >= SH) continue
      for (let x = 0; x < l.w; x++) {
        const ox = l.x + x
        if (ox < 0 || ox >= S) continue
        if (slot === 'hair' && oy < under[ox]) continue
        if (inBoot && boot && boot[oy * S + ox]) continue
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
