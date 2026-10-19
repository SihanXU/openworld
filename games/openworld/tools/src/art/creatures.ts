// The project's own sprites for the minor monsters the pack has no fitting sheet for (docs/creatures.md §6, Looks): the zombie
// (it was the pack's caveman tinted green), the stone and the ice golem (the pack's statue), the giant crab (the pack's
// mollusc) and the storm wisp (the pack's flame, tinted). Drawn by code on the bosses' raster (raster.ts): each part on
// its own in its middle tone, lit from the top left and shaded to the bottom right, outlined in the pack's dark line, and
// laid over the parts before it — so an arm, a head, a claw reads apart from the body. Sheets in the pack's layout:
// 16x16 frames, columns down / up / left / right (right is left mirrored), rows the walk.
//
//   npx tsx games/openworld/tools/src/art/creatures.ts

import { Raster, writeAtlas, type Palette, type RGBA } from './raster.ts'

type View = 'down' | 'up' | 'side'
type Tones = Record<string, [string, string]>

const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a]

/**
 * The pack's three tones: every pixel of a middle key with its edge above or to its left turns to its light key, with its
 * edge below or to its right to its dark key. `tones` maps a middle key to [light, dark].
 */
function shade(r: Raster, tones: Tones): void {
  const src = [...r.px]
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= r.w || y >= r.h ? null : src[y * r.w + x])
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const k = at(x, y)
      const t = k && tones[k]
      if (!t) continue
      const lit = at(x, y - 1) !== k || at(x - 1, y) !== k
      const dim = at(x, y + 1) !== k || at(x + 1, y) !== k
      if (dim && !lit) r.set(x, y, t[1])
      else if (lit && !dim) r.set(x, y, t[0])
    }
}

/** Parts drawn on their own, each shaded and outlined, then laid over one another in order (the later on top). */
function layers(parts: ((r: Raster) => void)[], tones: Tones, skip: string[] = []): Raster {
  const out = new Raster(16, 16)
  for (const draw of parts) {
    const r = new Raster(16, 16)
    draw(r)
    shade(r, tones)
    r.outline('k', skip)
    for (let i = 0; i < r.px.length; i++) if (r.px[i] !== null) out.px[i] = r.px[i]
  }
  return out
}

/** Four rows of the walk: each view's frame, drawn by `draw` at a step 0–3; the right column is the left mirrored. */
function sheetOf(draw: (view: View, step: number) => Raster): Raster[][] {
  return [0, 1, 2, 3].map((step) => {
    const side = draw('side', step)
    return [draw('down', step), draw('up', step), side, side.flip()]
  })
}

/** A walk's bob: the body is a pixel higher on the second and fourth steps. */
const bobOf = (step: number) => (step % 2 === 1 ? -1 : 0)
/** Which foot is lifted: the left on step 1, the right on step 3. */
const liftOf = (step: number): [number, number] => (step === 1 ? [-1, 0] : step === 3 ? [0, -1] : [0, 0])

// ------------------------------------------------------------------ the golems (stone, and the same body in ice)

const GOLEM_TONES: Tones = { b: ['c', 'a'], B: ['C', 'A'] }

function golem(view: View, step: number): Raster {
  const b = bobOf(step)
  const [l0, l1] = liftOf(step)
  if (view === 'side') {
    // facing left: the far leg, the broad body, the head thrust forward, the near arm swinging with the walk
    const r = layers([
      (r) => r.rect(9 + (step === 3 ? 1 : 0), 12 + l1, 3, 3, 'B'),
      (r) => r.rect(5 + (step === 1 ? -1 : 0), 12 + l0, 3, 3, 'B'),
      (r) => {
        r.ellipse(9, 8.5 + b, 4.4, 4, 'b')
        r.set(9, 5 + b, 'm'), r.set(10, 5 + b, 'm'), r.set(11, 6 + b, 'm')
      },
      (r) => {
        r.ellipse(5, 5 + b, 2.3, 2, 'b')
        r.set(5, 3 + b, 'm'), r.set(6, 3 + b, 'm')
      },
      (r) => r.ellipse(8 + (step === 1 ? 1 : step === 3 ? -1 : 0), 9.5 + b, 1.6, 2.6, 'B'),
    ], GOLEM_TONES)
    r.set(4, 5 + b, 'e')
    r.set(11, 9 + b, 'x')
    return r
  }
  const r = layers([
    (r) => {
      r.rect(4, 12 + l0, 3, 3, 'B')
      r.rect(9, 12 + l1, 3, 3, 'B')
    },
    (r) => {
      r.ellipse(8, 8.6 + b, 4.6, 3.9, 'b')
      r.set(5, 6 + b, 'm'), r.set(6, 6 + b, 'm'), r.set(10, 5 + b, 'm'), r.set(11, 6 + b, 'm')
    },
    (r) => {
      r.ellipse(8, 3.6 + b, 2.4, 2, 'b')
      r.set(7, 2 + b, 'm'), r.set(8, 2 + b, 'm')
    },
    (r) => r.ellipse(2.6, 9.4 + b + (step === 1 ? 1 : 0), 1.5, 2.6, 'B'),
    (r) => r.ellipse(13.4, 9.4 + b + (step === 3 ? 1 : 0), 1.5, 2.6, 'B'),
  ], GOLEM_TONES)
  if (view === 'down') {
    // two eyes in the stone, the rune core lit in its chest
    r.set(7, 4 + b, 'e'), r.set(9, 4 + b, 'e')
    r.rect(7, 8 + b, 2, 2, 'x')
    r.set(7, 8 + b, 'X')
  } else {
    // its back: a crack down the stone, more moss
    r.set(8, 7 + b, 'a'), r.set(8, 8 + b, 'a'), r.set(9, 9 + b, 'a'), r.set(6, 9 + b, 'm'), r.set(10, 10 + b, 'm')
  }
  return r
}

const STONE: Palette = { k: hex('#26221f'), a: hex('#5c5650'), b: hex('#8a837a'), c: hex('#b7afa3'), A: hex('#4a4540'), B: hex('#726b63'), C: hex('#9a9288'), m: hex('#6f9a4a'), e: hex('#ffd36a'), x: hex('#e89a2c'), X: hex('#ffe9a8') }
const ICE: Palette = { k: hex('#1d2f44'), a: hex('#5b8fbf'), b: hex('#8fc4ec'), c: hex('#d6f0ff'), A: hex('#4a78a8'), B: hex('#72aad8'), C: hex('#b4dcf6'), m: hex('#ffffff'), e: hex('#e8fbff'), x: hex('#3ad6ff'), X: hex('#d4fbff') }

// ------------------------------------------------------------------ the zombie: one of the dead in a pilgrim's rags

const ZOMBIE_TONES: Tones = { g: ['G', 'd'], r: ['s', 'q'], R: ['s', 'q'] }

function zombie(view: View, step: number): Raster {
  const b = bobOf(step)
  const [l0, l1] = liftOf(step)
  if (view === 'side') {
    // facing left: the arms held out before it, the shamble's lean
    const r = layers([
      (r) => r.rect(8 + (step === 1 ? 1 : step === 3 ? -1 : 0), 12 + l1, 2, 3, 'R'),
      (r) => r.rect(7 + (step === 1 ? -1 : step === 3 ? 1 : 0), 12 + l0, 2, 3, 'R'),
      (r) => r.rect(6, 7 + b, 5, 5, 'r'),
      (r) => r.ellipse(7.5, 4 + b, 2.4, 2.4, 'g'),
      (r) => r.line(6, 8 + b, 2, 8 + b + (step % 2), 'g', 2),
    ], ZOMBIE_TONES)
    // its hair hangs lank; a tear in the rags shows the grey beneath
    r.set(8, 2 + b, 'h'), r.set(9, 3 + b, 'h'), r.set(9, 4 + b, 'h'), r.set(8, 3 + b, 'h')
    r.set(6, 4 + b, 'e')
    r.set(9, 9 + b, 'g')
    return r
  }
  const r = layers([
    (r) => {
      r.rect(5, 12 + l0, 2, 3, 'R')
      r.rect(9, 12 + l1, 2, 3, 'R')
    },
    (r) => r.rect(5, 7 + b, 6, 5, 'r'),
    (r) => r.ellipse(8, 4 + b, 2.6, 2.5, 'g'),
    // arms hang forward and low, one a little ahead of the other with the walk
    (r) => r.rect(3, 7 + b, 2, 5 + (step === 1 ? 1 : 0), 'g'),
    (r) => r.rect(11, 7 + b, 2, 5 + (step === 3 ? 1 : 0), 'g'),
  ], ZOMBIE_TONES)
  if (view === 'down') {
    r.set(7, 4 + b, 'e'), r.set(9, 4 + b, 'e')
    r.set(8, 6 + b, 'd')
    r.set(6, 2 + b, 'h'), r.set(9, 2 + b, 'h'), r.set(10, 3 + b, 'h')
    // the rags torn, a rope belt
    r.set(7, 10 + b, 'g'), r.set(9, 8 + b, 'g')
    for (let x = 5; x <= 10; x++) r.set(x, 9 + b, x % 2 ? 'h' : 'q')
  } else {
    // the back of its head, its hair matted
    for (let x = 6; x <= 10; x++) for (let y = 2; y <= 4; y++) if (r.get(x, y + b) && r.get(x, y + b) !== 'k') r.set(x, y + b, (x + y) % 3 ? 'h' : 'd')
    r.set(7, 10 + b, 'q'), r.set(8, 8 + b, 'q')
  }
  return r
}

const ZOMBIE: Palette = { k: hex('#1c1a1a'), g: hex('#8aa37c'), G: hex('#b2c6a0'), d: hex('#5c7352'), r: hex('#7a6248'), s: hex('#9c8462'), q: hex('#54422f'), R: hex('#4a4038'), h: hex('#2e2a26'), e: hex('#e8d86a') }

// ------------------------------------------------------------------ the giant crab (it walks sideways: one look every way)

const CRAB_TONES: Tones = { b: ['c', 'a'], l: ['c', 'a'] }

function crab(view: View, step: number): Raster {
  const b = bobOf(step)
  const leg = (r: Raster, x: number, y: number, side: number, i: number) => {
    const lift = (i + step) % 2
    r.line(x, y, x + side * 2, y + 1 - lift, 'l')
    r.set(x + side * 2, y + 2 - lift, 'l')
  }
  const up0 = step === 1 ? -1 : 0, up1 = step === 3 ? -1 : 0
  const r = layers([
    // three legs on each side, stepping in turn
    (r) => {
      for (let i = 0; i < 3; i++) leg(r, 4 - i, 10 + i + b, -1, i), leg(r, 11 + i, 10 + i + b, 1, i)
    },
    (r) => r.ellipse(8, 9.6 + b, 5.2, 3.4, 'b'),
    // the claws, each open, raised and lowered in turn
    (r) => {
      r.ellipse(2.4, 6.6 + b + up0, 2, 1.8, 'b')
      r.set(1, 5 + b + up0, null), r.set(2, 5 + b + up0, null)
    },
    (r) => {
      r.ellipse(13.6, 6.6 + b + up1, 2, 1.8, 'b')
      r.set(14, 5 + b + up1, null), r.set(13, 5 + b + up1, null)
    },
  ], CRAB_TONES)
  if (view === 'up') {
    // its back: the ridges of the shell
    r.set(6, 9 + b, 'a'), r.set(8, 8 + b, 'a'), r.set(10, 9 + b, 'a'), r.set(8, 10 + b, 'c')
  } else {
    // eyes on their stalks, a mouth of plates
    r.set(6, 6 + b, 'k'), r.set(10, 6 + b, 'k'), r.set(6, 5 + b, 'w'), r.set(10, 5 + b, 'w')
    r.set(7, 11 + b, 'a'), r.set(8, 11 + b, 'a'), r.set(9, 11 + b, 'a')
  }
  return r
}

const CRAB: Palette = { k: hex('#2a120c'), a: hex('#9a3a1e'), b: hex('#d8642e'), c: hex('#f6a463'), l: hex('#c4552a'), w: hex('#fff4e0') }

// ------------------------------------------------------------------ the storm wisp: a ball of lightning, a crackling tail

function wisp(view: View, step: number): Raster {
  // it floats: no walk, a slow rise and fall, and its tail crackles anew every frame
  const y = 7 + [0, -1, -1, 0][step]
  const tails: [number, number][][] = [
    [[8, y + 5], [7, y + 6], [8, y + 7], [9, y + 8]],
    [[8, y + 5], [9, y + 6], [8, y + 7], [7, y + 8]],
    [[7, y + 5], [8, y + 6], [9, y + 7], [8, y + 8]],
    [[9, y + 5], [8, y + 6], [7, y + 7], [8, y + 8]],
  ]
  const r = layers([
    (r) => {
      r.ellipse(8, y, 4.4, 4.2, 'b')
      r.ellipse(8, y, 3.2, 3, 'c')
      r.ellipse(7.4, y - 0.8, 1.5, 1.3, 'd')
    },
  ], {})
  for (const [x, ty] of tails[step]) r.set(x, ty, 'x')
  // a spark leaping off it, here or there
  const sparks: [number, number][] = [[2, y - 3], [13, y - 2], [3, y + 2], [13, y + 3]]
  r.set(sparks[step][0], sparks[step][1], 'x')
  // two dark eyes looking where it goes (none seen from behind; one from its side)
  if (view === 'down') r.set(6, y + 1, 'e'), r.set(10, y + 1, 'e')
  if (view === 'side') r.set(5, y + 1, 'e')
  return r
}

const WISP: Palette = { k: hex('#2a2a4a'), b: hex('#f2c230'), c: hex('#fff07a'), d: hex('#ffffff'), x: hex('#bff4ff'), e: hex('#4a3a10') }

// ------------------------------------------------------------------ written

export const CREATURE_SHEETS: [string, (v: View, s: number) => Raster, Palette][] = [
  ['Creature/StoneGolem/SpriteSheet.png', golem, STONE],
  ['Creature/IceGolem/SpriteSheet.png', golem, ICE],
  ['Creature/Zombie/SpriteSheet.png', zombie, ZOMBIE],
  ['Creature/Crab/SpriteSheet.png', crab, CRAB],
  ['Creature/StormWisp/SpriteSheet.png', wisp, WISP],
]

for (const [path, draw, pal] of CREATURE_SHEETS) writeAtlas(path, sheetOf(draw), pal)
console.log(`creature sheets written: ${CREATURE_SHEETS.length}`)
