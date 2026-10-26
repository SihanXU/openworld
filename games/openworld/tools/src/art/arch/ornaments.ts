// What is laid on the buildings' faces (oblique.ts `Ornament`): the windows, portals, rose windows, statues in their
// niches, clocks, signs and banners, drawn pixel by pixel in the palette's keys (materials.ts). Each is made at the
// size asked for, so a window fits its bay; each is placed by its bottom-left corner on the face it lies on.

import { inArch, type ArchKind } from './shapes.ts'
import { hash } from './materials.ts'
import type { Ornament } from './oblique.ts'

/** A picture being drawn: a grid of palette keys (null: nothing). */
export class Pic {
  px: (string | null)[]
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Array(w * h).fill(null)
  }
  get(x: number, y: number) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]
  }
  set(x: number, y: number, k: string | null) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = k
  }
  rect(x: number, y: number, w: number, h: number, k: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, k)
  }
  /** Every pixel for which `f(u, v)` (u from the left, v from the bottom) gives a key. */
  fill(f: (u: number, v: number) => string | null | undefined) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const k = f(x, this.h - 1 - y)
        if (k) this.px[y * this.w + x] = k
      }
  }
  /** Laid on a face: its bottom-left at (x, z) of the face y. */
  at(x: number, y: number, z: number, free = false): Ornament {
    const keys: Record<string, string> = {}
    const back: Record<string, string> = {}
    let next = 33
    const rows: string[] = []
    for (let j = 0; j < this.h; j++) {
      let line = ''
      for (let i = 0; i < this.w; i++) {
        const k = this.px[j * this.w + i]
        if (!k) {
          line += ' '
          continue
        }
        if (!back[k]) {
          let c = String.fromCharCode(next++)
          if (c === ' ') c = String.fromCharCode(next++)
          back[k] = c
          keys[c] = k
        }
        line += back[k]
      }
      rows.push(line)
    }
    return { x, y, z, rows, keys, free }
  }
}

/** The arch's outline test on the picture's own (u, v): u from its middle. */
const arch = (kind: ArchKind, w: number, h: number) => (u: number, v: number) => inArch(kind, w, h, u - (w - 1) / 2, v)

/** Glass in a window, a scheme of colours: the border, the field, the medallions. */
export type Glass = 'blue' | 'red' | 'gold' | 'violet' | 'green'
const FIELD: Record<Glass, [string, string, string]> = {
  blue: ['B2', 'B1', 'E1'],
  red: ['E2', 'E1', 'Y1'],
  gold: ['Y2', 'Y1', 'B1'],
  violet: ['U2', 'U1', 'Y1'],
  green: ['V2', 'V1', 'E1'],
}

/**
 * A lancet: a tall pointed window of `lights` lights under one arch (one, two with a mullion and an oculus over them,
 * three), its stone frame in the wall's ramp, leaded glass in panes with medallions, a sill.
 */
export function lancet(w: number, h: number, glass: Glass = 'blue', lights = 1, wall = 's'): Pic {
  const p = new Pic(w, h)
  const [border, field, medal] = FIELD[glass]
  const outer = arch('pointed', w, h)
  const inner = arch('pointed', w - 2, h - 2)
  p.fill((u, v) => {
    if (!outer(u, v)) return null
    if (v === 0) return wall + '1'
    if (!inner(u - 1, v - 1)) return wall + '3'
    // the lead between the panes
    if (v % 5 === 0) return 'n3'
    const gu = u - 1
    const gw = w - 2
    if (lights >= 2) {
      const mid = (gw - 1) / 2
      // the mullion up to the springing, the oculus over it
      const spring = h - 2 - gw * 0.9
      if (Math.abs(gu - mid) < 0.6 && v < spring) return wall + '2'
      if (v >= spring) {
        const oc = Math.hypot(gu - mid, v - (spring + gw * 0.38))
        if (oc < gw * 0.24) return oc > gw * 0.18 ? wall + '2' : 'Y1'
      }
    }
    const edge = gu === 0 || gu === gw - 1
    if (edge) return border
    // a medallion every so often up the light
    const m = Math.floor(v / 10)
    const cv = m * 10 + 5
    if (Math.abs(v - cv) < 3 && hash(m, w, 1) < 0.7) return Math.abs(v - cv) < 2 ? medal : 'Y2'
    return hash(Math.floor(gu / 2), Math.floor(v / 3), 9) < 0.18 ? border : field
  })
  return p
}

/** A rose window of radius r: a stone ring, twelve petals of tracery, the glass between in turns, a gold boss. */
export function rose(r: number, wall = 's'): Pic {
  // Chartres's and Notre-Dame's: an oculus in the middle, twelve lancet petals radiating from it — deep blue glass
  // with a ruby border and a gold knot at each tip — a ring, and twenty-four small foiled lights round the rim
  const d = r * 2 + 1
  const p = new Pic(d, d)
  const inner = r * 0.62
  p.fill((u, v) => {
    const x = u - r
    const y = v - r
    const dist = Math.hypot(x, y)
    if (dist > r) return null
    if (dist > r - 1.5) return wall + '3'
    const a = (Math.atan2(y, x) / (Math.PI * 2) + 1.25) % 1
    // the oculus: a gold boss in a blue ring
    if (dist < r * 0.13) return dist < r * 0.07 ? 'a0' : 'Y1'
    if (dist < r * 0.18) return wall + '2'
    if (dist < inner) {
      // a petal: a pointed lancet along its spoke, tracery between
      const f = (a * 12) % 1
      const off = Math.abs(f - 0.5) * 2 // 0 on the petal's spine, 1 on the tracery between
      const along = (dist - r * 0.18) / (inner - r * 0.18)
      const width = along < 0.75 ? 0.62 : 0.62 * (1 - (along - 0.75) / 0.25)
      if (off > width) return wall + '2'
      if (off > width - 0.16) return 'E1'
      if (along > 0.62 && along < 0.74 && off < 0.25) return 'Y1'
      return along < 0.3 ? 'B2' : 'B1'
    }
    if (dist < inner + 1.2) return wall + '2'
    // the rim's small lights, two to each petal
    const f = (a * 24) % 1
    const off = Math.abs(f - 0.5) * 2
    const along = (dist - inner - 1.2) / (r - 1.5 - inner - 1.2)
    const round = Math.hypot(off * 0.9, (along - 0.5) * 1.6)
    if (round > 0.78) return wall + '2'
    return Math.floor(a * 24) % 2 ? 'E1' : 'B1'
  })
  return p
}

/** A statue in a pointed niche: the niche dark, the figure pale stone or gold, its head, its folds, a halo. */
export function niche(w: number, h: number, gold = false, wall = 's'): Pic {
  const p = new Pic(w, h)
  const outer = arch('pointed', w, h)
  const inner = arch('pointed', w - 2, h - 1)
  const fig = gold ? 'a' : 's'
  const cx = (w - 1) / 2
  p.fill((u, v) => {
    if (!outer(u, v)) return null
    if (!inner(u - 1, v)) return wall + '3'
    const x = u - cx
    // a robed figure: a narrow column of a body, a head, a halo behind
    const head = Math.hypot(x, v - (h - 7)) < 1.8
    const halo = Math.hypot(x, v - (h - 7)) < 3 && v > h - 8
    const body = v >= 1 && v < h - 8 && Math.abs(x) <= 1.5 + v * 0.06
    if (head) return fig + '1'
    if (body) return Math.abs(x) > 1 ? fig + '3' : (v % 3 === 0 ? fig + '2' : fig + '1')
    if (halo) return gold ? 'a0' : 'a2'
    return 'n2'
  })
  return p
}

/**
 * A great portal: archivolts stepping in (each ring a tone darker, statues in the jambs), a tympanum over the door
 * (a figure in glory, gold on dark), the doors of planks with iron, a trumeau with its statue between them.
 */
export function portal(w: number, h: number, rings = 4, wall = 's'): Pic {
  const p = new Pic(w, h)
  const tymp = Math.round(h * 0.42)
  for (let k = 0; k < rings; k++) {
    const a = arch('pointed', w - k * 4, h - k * 3)
    const key = wall + Math.min(4, 1 + (k % 2) + Math.floor(k / 2))
    p.fill((u, v) => (a(u - k * 2, v) ? key : null))
  }
  // the jamb statues, two a side (none when the rings are the wall's own recess)
  const iw = w - rings * 4
  const ih = h - rings * 3
  const ox = rings * 2
  for (const side of rings ? [0, 1] : [])
    for (let k = 0; k < 2; k++) {
      const x = side ? w - 3 - k * 2 - 1 : 1 + k * 2
      for (let v = 2; v < ih * 0.55; v++) p.set(x, h - 1 - v, v > ih * 0.5 ? wall + '0' : v % 2 ? wall + '1' : wall + '2')
    }
  // the opening: the tympanum over the lintel, the doors under it
  const inner = arch('pointed', iw, ih)
  const lintel = ih - tymp
  p.fill((u, v) => {
    const x = u - ox
    if (!inner(x, v)) return null
    const cx = (iw - 1) / 2
    if (v >= lintel) {
      if (v === lintel) return wall + '2'
      // the figure in glory: an almond of gold rays, a seated figure
      const dy = v - (lintel + tymp * 0.45)
      const al = (x - cx) ** 2 / (iw * 0.16) ** 2 + dy ** 2 / (tymp * 0.38) ** 2
      if (al < 0.45) return Math.hypot(x - cx, dy - tymp * 0.15) < 1.6 ? 'a0' : 'a1'
      if (al < 1) return 'a2'
      return 'n2'
    }
    // the trumeau and its statue
    if (Math.abs(x - cx) < 1.6) return v > lintel - 6 ? wall + '1' : wall + '2'
    // the doors: planks, iron bands, a ring
    const band = v % 8 === 4
    if (band) return 'i2'
    if (Math.abs(x - cx) < 3 && v === Math.round(lintel * 0.45)) return 'i1'
    return (x % 3 === 0 ? 'w3' : 'w2')
  })
  return p
}

/** A wooden door under an arch (a house's, a tower's): planks, iron, a step. */
export function door(w: number, h: number, kind: ArchKind = 'round', wall = 's'): Pic {
  const p = new Pic(w, h)
  const outer = arch(kind, w, h)
  const inner = arch(kind, w - 2, h - 1)
  p.fill((u, v) => {
    if (!outer(u, v)) return null
    if (!inner(u - 1, v)) return wall + '3'
    if (v % 7 === 3) return 'i2'
    if (u === Math.floor(w * 0.7) && v === Math.floor(h * 0.4)) return 'a1'
    return u % 3 === 0 ? 'w3' : 'w1'
  })
  return p
}

/** A dark opening (a gateway's mouth, an arcade's arch, a belfry's louvre): the arch, the dark, louvres if asked. */
export function opening(w: number, h: number, kind: ArchKind = 'pointed', louvres = false, wall = 's'): Pic {
  const p = new Pic(w, h)
  const outer = arch(kind, w, h)
  const inner = arch(kind, w - 2, h - 1)
  p.fill((u, v) => {
    if (!outer(u, v)) return null
    if (!inner(u - 1, v)) return wall + '3'
    if (louvres && v % 3 === 0) return 'w2'
    return v < 3 ? 'n3' : 'n2'
  })
  return p
}

/** A house's window: a frame, panes, shutters if asked, a sill; lit warm if asked. */
export function window(w: number, h: number, shutters = false, lit = false, frame = 'w2'): Pic {
  const W = shutters ? w + 4 : w
  const p = new Pic(W, h)
  const ox = shutters ? 2 : 0
  p.rect(ox, 0, w, h, frame)
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) p.set(ox + x, y, x === Math.floor(w / 2) || y === Math.floor(h / 2) ? frame : lit ? (y < h / 2 ? 'Y0' : 'Y1') : y < 2 ? 'q0' : 'B0')
  if (shutters) for (let y = 0; y < h; y++) (p.set(0, y, 'cg2'), p.set(1, y, y % 2 ? 'cg1' : 'cg2'), p.set(W - 1, y, 'cg2'), p.set(W - 2, y, y % 2 ? 'cg1' : 'cg2'))
  p.rect(ox - 1, h - 1, w + 2, 1, 's1')
  return p
}

/** A clock: a gold-rimmed face, its hours, two hands. */
export function clock(r: number): Pic {
  const d = r * 2 + 1
  const p = new Pic(d, d)
  p.fill((u, v) => {
    const x = u - r
    const y = v - r
    const dist = Math.hypot(x, y)
    if (dist > r) return null
    if (dist > r - 1.2) return 'a2'
    const a = Math.atan2(y, x)
    const hour = Math.abs(((a / (Math.PI * 2)) * 12 + 12.5) % 1 - 0.5) < 0.08 && dist > r - 2.6
    if (hour) return 'k'
    if ((Math.abs(x) < 0.6 && y > 0 && y < r - 2) || (Math.abs(y) < 0.6 && x > 0 && x < r - 3)) return 'k'
    return 'p0'
  })
  return p
}

/** A statue alone (for the back of a niche the wall's recess makes): a robed figure, its halo, pale stone or gold. */
export function statue(w: number, h: number, gold = false): Pic {
  const p = new Pic(w, h)
  const fig = gold ? 'a' : 's'
  const cx = (w - 1) / 2
  p.fill((u, v) => {
    const x = u - cx
    const head = Math.hypot(x, v - (h - 4)) < 1.7
    const halo = Math.hypot(x, v - (h - 4)) < 2.9 && v > h - 5
    const body = v >= 0 && v < h - 5 && Math.abs(x) <= 1.4 + v * 0.07
    if (head) return fig + '1'
    if (body) return Math.abs(x) > 1 ? fig + '3' : v % 3 === 0 ? fig + '2' : fig + '1'
    if (halo) return gold ? 'a0' : 'a2'
    return null
  })
  return p
}

/**
 * The crockets of a spire: small leaves of stone budding along its two edges as seen from the south, every `every` up
 * its height, and the gabled lucarnes at its foot. Free ornaments on the spire's own silhouette.
 */
export function crockets(cx: number, cy: number, r: number, z0: number, rise: number, every = 9, wall = 's'): Ornament[] {
  const out: Ornament[] = []
  const leaf = (flip: boolean) => {
    const p = new Pic(3, 3)
    p.set(flip ? 2 : 0, 0, wall + '1')
    p.set(1, 1, wall + '1')
    p.set(flip ? 0 : 2, 1, wall + '2')
    p.set(1, 2, wall + '3')
    return p
  }
  for (let z = z0 + every; z < z0 + rise - every; z += every) {
    const half = r * (1 - (z - z0) / rise)
    out.push(leaf(false).at(cx - half - 2, cy, z, true))
    out.push(leaf(true).at(cx + half - 1, cy, z, true))
  }
  return out
}

/** Draws a picture from rows of characters and what each stands for. */
export function picture(rows: string[], keys: Record<string, string>): Pic {
  const p = new Pic(Math.max(...rows.map((r) => r.length)), rows.length)
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== ' ' && p.set(i, j, keys[ch])))
  return p
}

/** A lantern on an iron bracket beside a door, its glass lit warm. */
export function lantern(flip = false): Pic {
  const rows = ['iiiiiii  ', 'i   ii   ', 'i  iiii  ', 'i iiiiii ', '   iYyi  ', '   iYYi  ', '   iyYi  ', '   iYYi  ', '  iiiiii ', '   iiii  ', '    ii   ']
  return picture(flip ? rows.map((r) => [...r].reverse().join('')) : rows, { i: 'i3', y: 'Y0', Y: 'a0' })
}

/** A window box of flowers under a sill: its planks, the green, the blooms in a colour. */
export function flowerBox(w: number, bloom: string): Pic {
  const p = new Pic(w, 5)
  for (let x = 0; x < w; x++) {
    p.set(x, 4, 'w3')
    p.set(x, 3, 'w2')
    p.set(x, 2, x % 2 ? 'v2' : 'v1')
    if (x % 3 !== 1) p.set(x, 1, x % 3 ? bloom : 'v1')
    if (x % 3 === 0) p.set(x, 0, bloom)
  }
  return p
}

/** A balcony's railing of turned timber: a top rail, balusters, a bottom rail. */
export function railing(w: number, h = 10): Pic {
  const p = new Pic(w, h)
  for (let x = 0; x < w; x++) {
    p.set(x, 0, 'w1')
    p.set(x, 1, 'w3')
    p.set(x, h - 1, 'w3')
    if (x % 3 === 1) for (let y = 2; y < h - 1; y++) p.set(x, y, y % 3 ? 'w1' : 'w2')
  }
  return p
}

/** A window of a house: its frame, panes, shutters painted a colour, a sill, a box of flowers under it if asked. */
export function houseWindow(w: number, h: number, shutter: string, bloom?: string, lit = false, more: { curtain?: string; awning?: [string, string] } = {}): Pic {
  const W = w + 6
  const top = more.awning ? 5 : 0
  const H = top + h + (bloom ? 5 : 1)
  const p = new Pic(W, H)
  const body = new Pic(W, h + (bloom ? 5 : 1))
  drawHouseWindow(body, w, h, shutter, bloom, lit, more.curtain)
  for (let y = 0; y < body.h; y++) for (let x = 0; x < W; x++) if (body.get(x, y)) p.set(x, y + top, body.get(x, y))
  if (more.awning) {
    const aw = windowAwning(W - 2, ...more.awning)
    for (let y = 0; y < aw.h; y++) for (let x = 0; x < aw.w; x++) if (aw.get(x, y)) p.set(x + 1, y + top - 3 + 1, aw.get(x, y))
  }
  return p
}

function drawHouseWindow(p: Pic, w: number, h: number, shutter: string, bloom: string | undefined, lit: boolean, curtain?: string): void {
  const W = w + 6
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1
      const bar = x === Math.floor(w / 2) || y === Math.floor(h / 2)
      p.set(3 + x, y, edge ? 'w3' : bar ? 'w2' : lit ? (y < h / 2 ? 'Y0' : 'Y1') : y < h / 3 ? 'q0' : x < w / 2 ? 'B0' : 'q1')
    }
  for (let y = 0; y < h; y++) {
    p.set(0, y, shutter + '2')
    p.set(1, y, y % 3 ? shutter + '1' : shutter + '2')
    p.set(2, y, 'k')
    p.set(W - 3, y, 'k')
    p.set(W - 2, y, y % 3 ? shutter + '1' : shutter + '2')
    p.set(W - 1, y, shutter + '2')
  }
  for (let x = 1; x < W - 1; x++) p.set(x, h, 's1')
  if (curtain) curtains(p, 3, w, h, curtain)
  if (bloom) {
    const fb = flowerBox(w + 2, bloom)
    for (let y = 0; y < fb.h; y++) for (let x = 0; x < fb.w; x++) {
      const k = fb.get(x, y)
      if (k) p.set(2 + x, h + y, k)
    }
  }
}

/** Ivy climbing a wall from its foot: leaves in two greens on a few runners. */
export function ivy(w: number, h: number, seed: number): Pic {
  const p = new Pic(w, h)
  for (let r = 0; r < 3; r++) {
    let x = Math.floor(hash(seed, r, 3) * w)
    for (let y = h - 1; y > h * (0.3 + hash(seed, r, 4) * 0.4); y--) {
      x = Math.max(0, Math.min(w - 1, x + (hash(seed, r, y) < 0.3 ? -1 : hash(seed, r, y) > 0.7 ? 1 : 0)))
      p.set(x, y, 'v3')
      if (hash(seed, x, y) < 0.6) p.set(x + (y % 2 ? 1 : -1), y, y % 3 ? 'v1' : 'v2')
    }
  }
  return p
}

/** Quoins up a corner of a wall: long and short dressed stones by turns, a shade lighter than the wall. */
export function quoins(h: number, ramp = 's'): Pic {
  const p = new Pic(8, h)
  for (let y = 0; y < h; y++) {
    const course = Math.floor(y / 7)
    const len = course % 2 ? 5 : 8
    for (let x = 0; x < len; x++) p.set(x, h - 1 - y, y % 7 === 6 ? ramp + '3' : ramp + '1')
  }
  return p
}

// ---------------------------------------------------------------------------------------------- a street's clutter
// What makes a front look lived in (docs/showcase.md §3.6, the user's ask of 2026-10-25: "极繁主义, every detail full"):
// the curtains, the little awnings, the baskets of flowers, the pipes, the bills pasted up, the damp, the moss, the
// roses, the smoke, the birds, the washing.

/** Curtains drawn back inside a window's panes: a drape down each side in a colour, its tie, a pelmet. */
export function curtains(p: Pic, ox: number, w: number, h: number, ramp: string): void {
  for (let y = 1; y < h - 1; y++) {
    const tie = y === Math.floor(h * 0.55)
    const width = y < h * 0.55 ? 2 : 1 + (y % 2)
    for (let x = 0; x < width; x++) {
      p.set(ox + 1 + x, y, tie ? ramp + '3' : ramp + (x ? '1' : '2'))
      p.set(ox + w - 2 - x, y, tie ? ramp + '3' : ramp + (x ? '1' : '2'))
    }
  }
  for (let x = 1; x < w - 1; x++) p.set(ox + x, 1, ramp + '2')
}

/** A small striped awning over a window: its canvas sloping out, a scalloped edge. */
export function windowAwning(w: number, a: string, b: string): Pic {
  const p = new Pic(w, 5)
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < w; x++) {
      if (y === 4 && x % 3 === 1) continue
      const inset = y < 1 ? 1 : 0
      if (x < inset || x >= w - inset) continue
      p.set(x, y, Math.floor(x / 2) % 2 ? (y < 3 ? b + '1' : b + '2') : y < 3 ? a + '1' : a + '2')
    }
  return p
}

/** A basket of flowers hung on chains from a wall bracket, trailing. */
export function hangingBasket(bloom: string, seed = 0): Pic {
  const rows = ['iiiiii ', '    i  ', '   i i ', '  i   i', ' vXvXvv', 'wwwwwww', ' wwwww ', ' v X v ', '  v X  ', '  X    ']
  const p = picture(rows, { i: 'i3', v: 'v2', X: bloom, w: 'w2' })
  if (hash(seed, 1) < 0.5) p.set(5, 8, 'v1')
  return p
}

/** A drainpipe down a wall from the eaves: its hopper, the pipe on brackets, the shoe at its foot. */
export function drainpipe(h: number): Pic {
  const p = new Pic(4, h)
  p.rect(0, 0, 4, 2, 'r4')
  p.rect(1, 2, 2, 1, 'r4')
  for (let y = 3; y < h - 2; y++) (p.set(1, y, 'r3'), p.set(2, y, 'r4'))
  for (let y = 6; y < h - 2; y += 9) p.rect(0, y, 4, 1, 'i3')
  p.rect(1, h - 2, 3, 2, 'r4')
  return p
}

/** A bill pasted on a wall: paper, its print, a torn corner; or a notice of the watch's on its board. */
export function poster(seed: number): Pic {
  const w = 6 + Math.floor(hash(seed, 2) * 3)
  const h = 8 + Math.floor(hash(seed, 3) * 3)
  const paper = ['cw0', 'cy0', 'pk0', 'cw1'][Math.floor(hash(seed, 4) * 4)]
  const ink = ['n1', 'E2', 'B2', 'U2'][Math.floor(hash(seed, 5) * 4)]
  const p = new Pic(w, h)
  p.rect(0, 0, w, h, paper)
  for (let y = 2; y < h - 1; y += 2) for (let x = 1; x < w - 1; x++) if (hash(seed, x, y) < 0.7) p.set(x, y, y === 2 ? ink : 'n2')
  if (hash(seed, 6) < 0.6) p.set(w - 1, h - 1, null), p.set(w - 2, h - 1, null), p.set(w - 1, h - 2, null)
  p.set(0, 0, 'i2')
  return p
}

/** A house's number on an enamel plaque. */
export function plaque(): Pic {
  return picture(['bbbbb', 'bwbwb', 'bbwbb', 'bbbbb'], { b: 'B2', w: 'cw0' })
}

/** Damp and soot on a wall: darker blots dithered, densest at the foot. */
export function stains(w: number, h: number, ramp: string, seed: number): Pic {
  const p = new Pic(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = h - 1 - y
      const blot = hash(Math.floor(x / 5), Math.floor(v / 4), seed) < 0.35
      const f = (1 - v / h) * 0.55
      if (blot && hash(x, y, seed + 1) < f) p.set(x, y, ramp + '3')
    }
  return p
}

/** Moss in tufts on stone or on a roof, two greens. */
export function moss(w: number, h: number, seed: number): Pic {
  const p = new Pic(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2))
    if (d < 1 && hash(x, y, seed) < 0.85 - d * 0.6) p.set(x, y, hash(x, y, seed + 2) < 0.4 ? 'v1' : 'v2')
  }
  return p
}

/** A climbing rose up a wall: runners in dark green, leaves, blooms in a colour. */
export function roses(w: number, h: number, bloom: string, seed: number): Pic {
  const p = ivy(w, h, seed)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p.get(x, y) && hash(x, y, seed + 7) < 0.22) p.set(x, y, bloom)
  return p
}

/** Smoke from a chimney: puffs of grey, thinning as they rise and drift. */
export function smoke(seed: number): Pic {
  const p = new Pic(12, 22)
  for (let k = 0; k < 5; k++) {
    const cx = 3 + k * 1.3 + hash(seed, k) * 2
    const cy = 19 - k * 4.2
    const r = 1.6 + k * 0.5
    for (let y = 0; y < 22; y++) for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d < r && hash(x, y, seed + k) < 0.9 - k * 0.14) p.set(x, y, d < r * 0.5 ? 'cw1' : 'cw2')
    }
  }
  return p
}

/** A pigeon, grey, its neck green and violet. */
export function bird(flip = false, seed = 0): Pic {
  const rows = hash(seed, 1) < 0.5 ? [' kgg ', 'kggVg', ' gggg', '  y y'] : ['  kg ', ' gVgg', 'ggggg', '  y y']
  return picture(flip ? rows.map((r) => [...r].reverse().join('')) : rows, { k: 'n3', g: 'g2', V: 'V1', y: 't1' })
}

/** A cat sitting, its tail curled round. */
export function cat(seed = 0): Pic {
  const c = ['po2', 'n2', 'pw1', 'g3'][Math.floor(hash(seed, 1) * 4)]
  return picture([' c c  ', ' ccc  ', ' cYc  ', '  cc  ', ' cccc ', ' cccc c', ' ccccc '], { c, Y: 'Y1' })
}

/** Washing on a line: the line, pegs, shirts and sheets in colours. */
export function laundry(w: number, seed: number): Pic {
  const p = new Pic(w, 12)
  const sag = (x: number) => Math.round(Math.sin((x / (w - 1)) * Math.PI) * 2)
  for (let x = 0; x < w; x++) p.set(x, sag(x), 'n2')
  const COL = ['cw0', 'cr1', 'cb1', 'cy1', 'pk1', 'cg1', 'cw1']
  let x = 2
  let k = 0
  while (x < w - 4) {
    const cw = 4 + Math.floor(hash(seed, k) * 4)
    const ch = 5 + Math.floor(hash(seed, k, 2) * 5)
    const col = COL[Math.floor(hash(seed, k, 3) * COL.length)]
    const shirt = hash(seed, k, 4) < 0.5
    for (let i = 0; i < cw && x + i < w - 1; i++) for (let j = 1; j <= ch; j++) {
      if (shirt && j > 3 && (i === 0 || i === cw - 1)) continue
      p.set(x + i, sag(x + i) + j, j === ch ? col.replace(/\d$/, '2') : col)
    }
    x += cw + 2
    k++
  }
  return p
}

/** Pots of flowers and herbs in a row at the foot of a wall. */
export function pots(w: number, seed: number): Pic {
  const p = new Pic(w, 9)
  const BL = ['cr0', 'cy0', 'pk1', 'cw0', 'U1', 'cb0']
  let x = 0
  let k = 0
  while (x < w - 3) {
    const pw = 3 + Math.floor(hash(seed, k) * 3)
    const ph = 3 + Math.floor(hash(seed, k, 1) * 2)
    for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) p.set(x + i, 8 - j, j === ph - 1 ? 't1' : i === 0 ? 't3' : 't2')
    const bloom = BL[Math.floor(hash(seed, k, 2) * BL.length)]
    for (let i = 0; i < pw; i++) for (let j = ph; j < ph + 3 + (i % 2); j++) if (hash(seed, i, j + k) < 0.8) p.set(x + i, 8 - j, hash(i, j, seed + k) < 0.35 ? bloom : j % 2 ? 'v1' : 'v2')
    x += pw + (hash(seed, k, 5) < 0.5 ? 0 : 1)
    k++
  }
  return p
}

/** A weathervane: a gilt cock on a rod over the arms of the compass. */
export function weathervane(): Pic {
  return picture(['  aa   ', ' aaaa a', 'aaaaaaa', '  a a  ', '   i   ', 'iiiiiii', '   i   ', '   i   ', '   i   '], { a: 'a1', i: 'i3' })
}

/** A skylight in a roof: its frame, the glass catching the sky. */
export function skylight(): Pic {
  return picture(['wwwwww', 'wqqBBw', 'wqBBBw', 'wwwwww'], { w: 'w3', q: 'q0', B: 'B1' })
}

/** A string of small flags along a sagging line, every colour by turns. */
export function bunting(w: number, seed = 0): Pic {
  const p = new Pic(w, 9)
  const sag = (x: number) => Math.round(Math.sin((x / (w - 1)) * Math.PI) * 3)
  const COL = ['cr1', 'cy1', 'cb1', 'cg1', 'cw0', 'U1', 'pk1']
  for (let x = 0; x < w; x++) p.set(x, sag(x), 'n2')
  for (let x = 1, k = Math.floor(hash(seed, 9) * 7); x < w - 4; x += 5, k++) {
    const col = COL[k % COL.length]
    for (let j = 1; j <= 4; j++) for (let i = 0; i < 4 - (j - 1) * 0.9; i++) p.set(x + i + Math.floor((j - 1) / 2), sag(x) + j, col)
  }
  return p
}

/** A string of paper lanterns, warm, along a line. */
export function lanternString(w: number, seed = 0): Pic {
  const p = new Pic(w, 8)
  const sag = (x: number) => Math.round(Math.sin((x / (w - 1)) * Math.PI) * 2)
  for (let x = 0; x < w; x++) p.set(x, sag(x), 'n2')
  for (let x = 3; x < w - 3; x += 6) {
    const col = hash(seed, x) < 0.5 ? 'Y' : 'cr'
    p.rect(x - 1, sag(x) + 2, 3, 4, col + '0')
    p.rect(x, sag(x) + 2, 1, 4, col + '1')
    p.set(x, sag(x) + 1, 'n2')
  }
  return p
}

/** A crate of the trade's goods set out before a shop: its slats, its heap. */
export function produceCrate(goods: string, seed = 0): Pic {
  const p = new Pic(10, 9)
  p.rect(0, 4, 10, 5, 'w1')
  for (let x = 0; x < 10; x += 3) p.rect(x, 4, 1, 5, 'w3')
  p.rect(0, 6, 10, 1, 'w2')
  for (let y = 0; y < 5; y++) for (let x = 0; x < 10; x++) {
    const top = 4 - Math.round(Math.sin(((x + 0.5) / 10) * Math.PI) * 3)
    if (y >= top) p.set(x, y, hash(x, y, seed) < 0.3 ? goods.replace(/\d$/, '0') : goods)
  }
  return p
}

/** A slate board standing on the street, the day's wares chalked on it. */
export function chalkboard(seed = 0): Pic {
  const p = new Pic(8, 11)
  p.rect(0, 0, 8, 9, 'w2')
  p.rect(1, 1, 6, 7, 'n2')
  for (let y = 2; y < 7; y += 2) for (let x = 2; x < 6; x++) if (hash(seed, x, y) < 0.7) p.set(x, y, 'cw1')
  p.set(1, 9, 'w3'), p.set(6, 9, 'w3'), p.set(0, 10, 'w3'), p.set(7, 10, 'w3')
  return p
}

/** A sconce on a wall: a gilt bracket, its candle, the flame. */
export function sconce(): Pic {
  const p = new Pic(7, 11)
  const rows = ['   y   ', '  yYy  ', '   y   ', '   c   ', '   c   ', ' aaaaa ', '  aAa  ', '   a   ', '   a   ', '  aAa  ', '   a   ']
  const K: Record<string, string> = { y: 'Y0', Y: 'a0', c: 'cw0', a: 'a2', A: 'a1' }
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== ' ' && p.set(i, j, K[ch])))
  return p
}

/**
 * A great window of a church's east end: three lancets under a pointed arch, an oculus over them, the stone tracery
 * between, the glass in the scheme's colours (the middle light gold, the Five Sufferings' own).
 */
export function greatWindow(w: number, h: number, wall = 's'): Pic {
  const p = new Pic(w, h)
  const outer = arch('pointed', w, h)
  const inner = arch('pointed', w - 4, h - 3)
  const lw = Math.floor((w - 8) / 3)
  const lh = Math.round(h * 0.62)
  const lights = [0, 1, 2].map((k) => ({ x0: 3 + k * (lw + 1), glass: (k === 1 ? 'gold' : 'blue') as Glass }))
  const lancets = lights.map((l) => lancet(lw, lh, l.glass, 1, wall))
  const oc = rose(Math.floor((w - 10) / 3.2), wall)
  p.fill((u, v) => (outer(u, v) ? (inner(u - 2, v) ? 'n2' : wall + '3') : null))
  lancets.forEach((pic, k) => {
    for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
      const key = pic.get(x, y)
      if (key) p.set(lights[k].x0 + x, h - 2 - pic.h + y, key)
    }
  })
  const ox = Math.round((w - oc.w) / 2)
  const oy = h - 2 - lh - oc.h - 1
  for (let y = 0; y < oc.h; y++) for (let x = 0; x < oc.w; x++) {
    const key = oc.get(x, y)
    if (key && oy + y >= 0) p.set(ox + x, oy + y, key)
  }
  return p
}

/** A cross on a spire's point, gold. */
export function cross(h = 9): Pic {
  const p = new Pic(5, h)
  p.rect(2, 0, 1, h, 'a1')
  p.rect(0, 2, 5, 1, 'a1')
  p.set(2, 0, 'a0')
  return p
}

/** A banner hung from a pole on a wall: a colour's ramp, a gold device in its middle, a swallow tail. */
export function banner(w: number, h: number, ramp: string): Pic {
  const p = new Pic(w, h)
  p.rect(0, 0, w, 1, 'w3')
  p.fill((u, v) => {
    const y = h - 1 - v
    if (y === 0) return null
    const tail = y > h - 4 && Math.abs(u - (w - 1) / 2) < (y - (h - 4)) * 0.9
    if (tail) return null
    if (Math.abs(u - (w - 1) / 2) < 1.2 && Math.abs(y - h * 0.45) < 2.5) return 'a1'
    return u === 0 ? ramp + '2' : ramp + '1'
  })
  return p
}

/** A sign hung from an iron bracket: a board with a mark of the trade on it. */
export function sign(mark: 'bread' | 'cup' | 'key' | 'boot' | 'fish' | 'scale' | 'book' | 'bed' | 'anvil' | 'cloth'): Pic {
  const p = new Pic(12, 11)
  p.rect(0, 0, 12, 1, 'i2')
  p.set(2, 1, 'i2')
  p.set(9, 1, 'i2')
  p.rect(1, 2, 10, 8, 'w1')
  p.rect(1, 9, 10, 1, 'w3')
  const M: Record<string, string[]> = {
    bread: ['  ####  ', ' ###### ', '########', ' ###### '],
    cup: [' ###### ', ' #####  ', '  ###   ', ' ##### '],
    key: ['##      ', '########', '##   # #'],
    boot: ['  ##    ', '  ##    ', '  ##### ', '  ######'],
    fish: ['  ####  #', ' ###### #', '  ####  #'],
    scale: ['   #    ', '########', ' #    # ', '###  ###'],
    book: ['########', '#  ##  #', '########'],
    bed: ['#       ', '########', '#      #'],
    anvil: ['########', '  ####  ', ' ###### '],
    cloth: [' ###### ', '########', ' ###### ', '########'],
  }
  const rows = M[mark]
  const oy = 3 + Math.floor((6 - rows.length) / 2)
  rows.forEach((r, j) => [...r].forEach((c, i) => c === '#' && p.set(2 + i, oy + j, mark === 'bread' ? 'h2' : 'n2')))
  return p
}
