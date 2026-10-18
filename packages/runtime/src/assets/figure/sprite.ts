// A look's map sprite (docs/looks.md §3.2): a 16x32 anime chibi in the sheet layout the renderer reads (columns
// down, up, left, right; rows the walk, row 0 standing), composed from code-drawn grids and painted in the look's
// colours. Pure: the client turns the pixels into a texture, the wiki and the review sheets into PNGs.
//
// A body template draws the bald figure per facing and walk frame with region letters (skin, torso, arms, hands,
// legs, feet); an outfit says what colour key each region is painted in and draws over it (an apron, a skirt);
// the head's parts (hair, eyes, beard, hat, glasses) are drawn once per facing and follow the head as it bobs.
// Left is right mirrored. A dark outline is drawn round the whole figure last, in the pack's manner.

import type { Look } from '@openworld/engine'
import { BASES, BASE_H, BASE_PALETTE, BASE_W, type BaseFacing } from './bases.ts'
import { BASE_HAIRS, HAIR_PALETTE } from './basehair.ts'
import { hexRgb, keyRgb, ramp3, retone, type RGB } from './color.ts'
import { BEARDS, FACES, GLASSES, HAIRS, HATS, MARKS, OUTFITS, type Facing, type Grid, type HeadPart, type OutfitPix } from './pixparts.ts'
import { WEARS } from './pixwear.ts'

/** The new figures (24x36 bases, `bases.ts`), shown with `?figures=new` until their walk and their parts are drawn. */
export const NEW_FIGURES = typeof location !== 'undefined' && new URLSearchParams(location.search).get('figures') === 'new'
/** The 16x32 figures' frame. */
const OW = 16
const OH = 32
export const FW = NEW_FIGURES ? BASE_W : OW
export const FH = NEW_FIGURES ? BASE_H : OH
/** Where a frame's feet stand: the row the renderer puts on the bearer's place. */
export const ANCHOR_Y = NEW_FIGURES ? 35 : 30
/** The sheet's rows: the four of the walk, and (the new figures) the one a figure stands in when it is not walking. */
export const ROWS = NEW_FIGURES ? 5 : 4
export const IDLE_ROW = NEW_FIGURES ? 4 : 0

/** The outline and the fixed inks. */
const INK: Record<string, RGB> = { k: [26, 22, 30], w: [250, 250, 246], b: [236, 140, 132], p: [150, 62, 70] }

// ---------------------------------------------------------------- body templates
// s a S: skin (mid, light, shade) · t u T: torso · r R: arms · n: hands · l L: legs · f: feet

/** Rows of a template, a frame per walk step; '.' clear. Frames 1 and 3 step (the body one lower). */
interface Template {
  /** Per facing: the four walk frames. */
  frames: Record<Facing, Grid[]>
  /** Where the head's parts are drawn (their grid's top-left), per facing at frame 0. */
  head: Record<Facing, [number, number]>
  /** How far each walk frame moves the head (the bob). */
  bob: number[]
}

const ADULT_HEAD_DOWN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....aassss.....',
  '...aassssssss...',
  '..asssssssssss..',
  '..ssssssssssss..',
  '..ssssssssssss..',
  '..ssssssssssss..',
  '..ssssssssssss..',
  '..ssssssssssss..',
  '..ssssssssssss..',
  '...ssssssssss...',
  '....SssssssS....',
]
const ADULT_HEAD_SIDE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....aassss.....',
  '...aassssssss...',
  '..asssssssssss..',
  '..sssssssssssss.',
  '..sssssssssssss.',
  '..sssssssssssss.',
  '..ssssssssssssss',
  '..sssssssssssss.',
  '..sssssssssssss.',
  '...sssssssssss..',
  '....SsssssssS...',
]

const join = (head: Grid, body: Grid): Grid => [...head, ...body]
const down = (g: Grid): Grid => ['................', ...g.slice(0, -1)]

const ADULT_DOWN_0 = join(ADULT_HEAD_DOWN, [
  '......SSSS......',
  '....rttttttr....',
  '...rruttttTrr...',
  '...rRttttttRr...',
  '...rRttttttRr...',
  '...nnttttttnn...',
  '....TttttttT....',
  '....llllllll....',
  '....lll..lll....',
  '....lll..lll....',
  '....lll..lll....',
  '....LLL..LLL....',
  '....fff..fff....',
  '................',
  '................',
  '................',
])
// a step: the body one lower, one foot planted and the other lifted
const ADULT_DOWN_1 = join(down(ADULT_HEAD_DOWN), [
  '................',
  '......SSSS......',
  '....rttttttr....',
  '...rruttttTrr...',
  '...rRttttttRr...',
  '...nnttttttRr...',
  '....TttttttTnn..',
  '....llllllll....',
  '....lll..lll....',
  '....LLL..lll....',
  '....fff..LLL....',
  '.........fff....',
  '................',
  '................',
  '................',
  '................',
])
const ADULT_DOWN_3 = ADULT_DOWN_1.map((r) => [...r].reverse().join('').replace(/n/g, 'n'))
const ADULT_SIDE_0 = join(ADULT_HEAD_SIDE, [
  '......SSS.......',
  '.....uttttt.....',
  '.....ttrrtt.....',
  '.....ttrRtt.....',
  '.....ttrRtt.....',
  '.....ttnntT.....',
  '.....TTttTT.....',
  '.....llllll.....',
  '.....lllll......',
  '.....lllll......',
  '.....lllll......',
  '.....LLLLL......',
  '.....ffffff.....',
  '................',
  '................',
  '................',
])
const ADULT_SIDE_1 = join(down(ADULT_HEAD_SIDE), [
  '................',
  '......SSS.......',
  '.....uttttt.....',
  '....rrttttt.....',
  '....rRttttrr....',
  '....nnttttRn....',
  '.....TttttT.....',
  '....llllllll....',
  '...llll..lll....',
  '...LLL....lll...',
  '..fff......LLL..',
  '...........ffff.',
  '................',
  '................',
  '................',
  '................',
])
const ADULT_SIDE_3 = join(down(ADULT_HEAD_SIDE), [
  '................',
  '......SSS.......',
  '.....uttttt.....',
  '.....tttttrr....',
  '...rrttttRn.....',
  '...nRttttt......',
  '....nTttttT.....',
  '....llllllll....',
  '....lll..llll...',
  '...lll....LLL...',
  '..LLL......fff..',
  '..ffff..........',
  '................',
  '................',
  '................',
  '................',
])

const ADULT: Template = {
  head: { down: [0, 0], up: [0, 0], side: [0, 0] },
  bob: [0, 1, 0, 1],
  frames: { down: [ADULT_DOWN_0, ADULT_DOWN_1, ADULT_DOWN_0, ADULT_DOWN_3], up: [], side: [ADULT_SIDE_0, ADULT_SIDE_1, ADULT_SIDE_0, ADULT_SIDE_3] },
}
// the back: the front's silhouette, the head all skin (the hair covers it) and no hands' fronts
ADULT.frames.up = ADULT.frames.down.map((g, i) => (i === 1 ? ADULT.frames.down[3] : i === 3 ? ADULT.frames.down[1] : g))

const CHILD_HEAD_DOWN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....asssss.....',
  '....aassssss....',
  '...asssssssss...',
  '...ssssssssss...',
  '...ssssssssss...',
  '...ssssssssss...',
  '...ssssssssss...',
  '...ssssssssss...',
  '....ssssssss....',
  '.....SssssS.....',
]
const CHILD_HEAD_SIDE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....asssss.....',
  '....aassssss....',
  '...asssssssss...',
  '...sssssssssss..',
  '...sssssssssss..',
  '...ssssssssssss.',
  '...sssssssssss..',
  '...sssssssssss..',
  '....sssssssss...',
  '.....SssssS.....',
]
const CHILD: Template = {
  head: { down: [0, 0], up: [0, 0], side: [0, 0] },
  bob: [0, 1, 0, 1],
  frames: {
    down: [
      join(CHILD_HEAD_DOWN, ['......SSSS......', '....rrttttrr....', '....rttttttr....', '....nttttttn....', '.....TttttT.....', '.....ll..ll.....', '.....ll..ll.....', '.....ff..ff.....', '................', '................', '................', '................']),
      join(['................', ...CHILD_HEAD_DOWN], ['......SSSS......', '....rrttttrr....', '....nttttttr....', '.....TttttTn....', '.....ll..ll.....', '.....ff..ll.....', '.........ff.....', '................', '................', '................', '................']),
      join(CHILD_HEAD_DOWN, ['......SSSS......', '....rrttttrr....', '....rttttttr....', '....nttttttn....', '.....TttttT.....', '.....ll..ll.....', '.....ll..ll.....', '.....ff..ff.....', '................', '................', '................', '................']),
      join(['................', ...CHILD_HEAD_DOWN], ['......SSSS......', '....rrttttrr....', '....rttttttn....', '....nTttttT.....', '.....ll..ll.....', '.....ll..ff.....', '.....ff.........', '................', '................', '................', '................']),
    ],
    up: [],
    side: [
      join(CHILD_HEAD_SIDE, ['......SSS.......', '.....uttttt.....', '.....ttrrtt.....', '.....ttnntT.....', '.....TTttTT.....', '......llll......', '......llll......', '......fffff.....', '................', '................', '................', '................']),
      join(['................', ...CHILD_HEAD_SIDE], ['......SSS.......', '.....utttttr....', '....rrttttRn....', '....nTttttT.....', '....ll....ll....', '....ff....fff...', '................', '................', '................', '................', '................']),
      join(CHILD_HEAD_SIDE, ['......SSS.......', '.....uttttt.....', '.....ttrrtt.....', '.....ttnntT.....', '.....TTttTT.....', '......llll......', '......llll......', '......fffff.....', '................', '................', '................', '................']),
      join(['................', ...CHILD_HEAD_SIDE], ['......SSS.......', '.....uttttt.....', '....nRttttrr....', '.....TttttTn....', '....ll....ll....', '...fff....ff....', '................', '................', '................', '................', '................']),
    ],
  },
}
CHILD.frames.up = CHILD.frames.down.map((g, i) => (i === 1 ? CHILD.frames.down[3] : i === 3 ? CHILD.frames.down[1] : g))

/** Each body's template. */
export const TEMPLATES: Record<string, Template> = { woman: ADULT, man: ADULT, girl: CHILD, boy: CHILD }

// ---------------------------------------------------------------- composing

const SKIN_REGIONS: Record<string, [string, number]> = { a: ['skin', 0], s: ['skin', 1], S: ['skin', 2], n: ['skin', 1] }
const DEFAULT_CLOTHES: Record<string, [string, number]> = {
  t: ['outfit.1', 1], u: ['outfit.1', 0], T: ['outfit.1', 2], r: ['outfit.1', 1], R: ['outfit.1', 2],
  l: ['outfit.2', 1], L: ['outfit.2', 2], f: ['outfit.3', 2],
}
const PART_LETTERS: Record<string, [string, number]> = {
  h: ['hair', 0], H: ['hair', 1], q: ['hair', 2], e: ['eyes', 1],
  c: ['.1', 0], C: ['.1', 1], x: ['.1', 2], d: ['.2', 0], D: ['.2', 1], y: ['.2', 2], m: ['.3', 0], M: ['.3', 1], z: ['.3', 2],
}

/** The sheet of a look: four facings (down, up, left, right) by ROWS frames (the walk, then idle), each FW x FH. */
export function composeSprite(look: Look): Uint8Array {
  return NEW_FIGURES ? composeBase(look) : composeOld(look)
}

/**
 * The new figures: an adult is its base, the skin and the eyes repainted in the look's own colours, and its hair
 * (`basehair.ts`) in the look's hair colour (the other parts are not drawn yet); a child is the 16x32 figure with its
 * feet on the new soles, standing in its first frame.
 */
function composeBase(look: Look): Uint8Array {
  const out = new Uint8Array(FW * 4 * FH * ROWS * 4)
  const base = BASES[look.body as 'woman' | 'man']
  if (!base) {
    const old = composeOld(look)
    // a child's soles' outline is the old frame's row 28; the bases' is row 34
    const dx = (FW - OW) / 2
    const dy = 34 - 28
    for (let col = 0; col < 4; col++)
      for (let row = 0; row < ROWS; row++) {
        const from = row === IDLE_ROW ? 0 : row
        for (let y = 0; y < OH && y + dy < FH; y++)
          for (let x = 0; x < OW; x++) {
            const i = ((from * OH + y) * OW * 4 + col * OW + x) * 4
            if (old[i + 3]) out.set(old.subarray(i, i + 4), ((row * FH + y + dy) * FW * 4 + col * FW + x + dx) * 4)
          }
      }
    return out
  }
  const skin = keyRgb(look, 'skin')
  const eyes = keyRgb(look, 'eyes')
  const J = hexRgb(BASE_PALETTE.J)
  const P = hexRgb(BASE_PALETTE.P)
  const color: Record<string, RGB> = {}
  for (const [k, hex] of Object.entries(BASE_PALETTE)) {
    const c = hexRgb(hex)
    color[k] = 'OHJFQ'.includes(k) ? retone(c, J, skin) : 'MP'.includes(k) ? retone(c, P, eyes) : c
  }
  const hair = BASE_HAIRS[look.parts.hair ?? '']
  if (hair) {
    const ref = hexRgb(HAIR_PALETTE.c)
    const key = keyRgb(look, 'hair')
    for (const [k, hex] of Object.entries(HAIR_PALETTE)) color[k] = retone(hexRgb(hex), ref, key)
  }
  for (let col = 0; col < 4; col++) {
    const facing: BaseFacing = col === 0 ? 'down' : col === 1 ? 'up' : 'left'
    const frames = base[facing]
    // the 3/4 view faces left; right is it mirrored
    const flip = col === 3
    for (let row = 0; row < ROWS; row++) {
      const cells = (row === IDLE_ROW ? frames.idle : frames.walk[row]).map((r) => [...r])
      if (hair) wearHair(cells, hair.grids[facing], hair.back[facing])
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const ch = cells[y][flip ? FW - 1 - x : x]
          if (ch === '.') continue
          const c = color[ch]
          out.set([c[0], c[1], c[2], 255], ((row * FH + y) * FW * 4 + col * FW + x) * 4)
        }
    }
  }
  return out
}

/** A hairstyle on a frame: set on the head wherever this frame carries it; below and right of `back` it hangs behind the body. */
function wearHair(cells: string[][], grid: string[], [backRow, backCol]: [number, number]): void {
  // the head's top: row 3 standing, a row lower on a step
  const dy = cells.findIndex((r) => r.some((ch) => ch !== '.')) - 3
  grid.forEach((line, y) =>
    [...line].forEach((ch, x) => {
      const Y = y + dy
      if (ch === '.' || Y < 0 || Y >= cells.length) return
      if (y >= backRow && x >= backCol && cells[Y][x] !== '.') return
      cells[Y][x] = ch
    }),
  )
}

/** The 64x128 sheet of the 16x32 figures: four facings by four walk frames, outlined. */
function composeOld(look: Look): Uint8Array {
  const FW = OW
  const FH = OH
  const tpl = TEMPLATES[look.body] ?? ADULT
  const out = new Uint8Array(FW * 4 * FH * 4 * 4)
  const ramps = new Map<string, [RGB, RGB, RGB]>()
  const tone = (key: string, t: number): RGB => {
    if (!ramps.has(key)) ramps.set(key, ramp3(keyRgb(look, key)))
    return ramps.get(key)![t]
  }
  const outfit = OUTFITS[look.parts.outfit ?? ''] ?? { regions: {} }
  const head = (slot: string, table: Record<string, HeadPart>) => {
    const id = look.parts[slot]
    return id ? { id, slot, part: table[id] } : undefined
  }
  const heads = [head('face', FACES), head('mark', MARKS), head('beard', BEARDS), head('hair', HAIRS), head('hat', HATS), head('glasses', GLASSES)].filter((h) => h?.part) as { id: string; slot: string; part: HeadPart }[]
  for (let col = 0; col < 4; col++) {
    const facing: Facing = col === 0 ? 'down' : col === 1 ? 'up' : 'side'
    const flip = col === 2
    for (let row = 0; row < 4; row++) {
      const px: (RGB | null)[] = Array(FW * FH).fill(null)
      const put = (x: number, y: number, c: RGB | null) => {
        if (x >= 0 && x < FW && y >= 0 && y < FH) px[y * FW + x] = c
      }
      const dy = tpl.bob[row] ?? 0
      const [hx, hy] = tpl.head[facing]
      const drawHead = (grid: Grid | undefined, slot: string) => {
        if (!grid) return
        grid.forEach((line, y) =>
          [...line].forEach((ch, x) => {
            if (ch === '.') return
            if (ch === '-') return put(hx + x, hy + y + dy, null)
            const ink = INK[ch]
            if (ink) return put(hx + x, hy + y + dy, ink)
            const l = PART_LETTERS[ch] ?? SKIN_REGIONS[ch]
            if (l) put(hx + x, hy + y + dy, tone(l[0].startsWith('.') ? slot + l[0] : l[0], l[1]))
          }),
        )
      }
      // what hangs behind: long hair, a cloak's back
      for (const h of heads) drawHead(h.part.back?.[facing], h.slot)
      // the figure
      const grid = tpl.frames[facing][row]
      grid.forEach((line, y) =>
        [...line].forEach((ch, x) => {
          if (ch === '.') return
          const reg = SKIN_REGIONS[ch] ?? outfit.regions[ch] ?? DEFAULT_CLOTHES[ch]
          if (reg) put(x, y, reg[0] === 'skin' ? tone('skin', reg[1]) : tone(reg[0], reg[1]))
        }),
      )
      // what the outfit draws over it, then what is worn over the outfit (a breastplate, a cloak)
      const overOf = (pix: OutfitPix, slot: string) => {
        const over = pix.over?.[facing] ?? (facing === 'up' ? pix.over?.down : undefined)
        const og = over && (typeof over[0] === 'string' ? (over as Grid) : (over as Grid[])[row])
        og?.forEach((line, y) =>
          [...line].forEach((ch, x) => {
            if (ch === '.') return
            if (ch === '-') return put(x, y, null)
            const ink = INK[ch]
            if (ink) return put(x, y, ink)
            const l = PART_LETTERS[ch] ?? SKIN_REGIONS[ch]
            if (l) put(x, y, tone(l[0].startsWith('.') ? slot + l[0] : l[0], l[1]))
          }),
        )
      }
      overOf(outfit, 'outfit')
      for (const slot of ['armour', 'cloak']) {
        const w = WEARS[look.parts[slot] ?? '']
        if (w) overOf(w, slot)
      }
      // the head's parts, front
      if (facing !== 'up') for (const h of heads) if (h.slot === 'face' || h.slot === 'mark') drawHead(h.part.front?.[facing], h.slot)
      for (const h of heads) if (h.slot !== 'face' && h.slot !== 'mark') drawHead(h.part.front?.[facing], h.slot)
      // the outline round the figure
      const solid = (x: number, y: number) => x >= 0 && x < FW && y >= 0 && y < FH && px[y * FW + x] !== null
      const lined = px.slice()
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++)
          if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) lined[y * FW + x] = INK.k
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const c = lined[y * FW + (flip ? FW - 1 - x : x)]
          if (!c) continue
          const i = ((row * FH + y) * FW * 4 + col * FW + x) * 4
          out.set([c[0], c[1], c[2], 255], i)
        }
    }
  }
  return out
}
