// Fixtures: 16x16 (tall ones 16x32, frame 'base' then). States: 'base', 'open' for
// containers, 'lit' for lightables. Top-down 3/4 view: objects show a lighter top face and
// a front face; each object layer is outlined and composited over a soft ground shadow.

import { OUTLINE, Pix, mix, pack, shade, type Sheet } from './core.ts'

interface Ramp {
  deep: string
  dark: string
  base: string
  light: string
  hi: string
}
const r5 = (deep: string, dark: string, base: string, light: string, hi: string): Ramp => ({ deep, dark, base, light, hi })

const WOOD = r5('#3a2216', '#5e3a22', '#8a5a34', '#aa7644', '#c89458')
const DWOOD = r5('#26160e', '#3e2616', '#5a3822', '#74492c', '#8e5c3a')
const STONE = r5('#3e3e48', '#5c5e68', '#80838c', '#a2a5ad', '#c8cbd0')
const METAL = r5('#22242c', '#3c404a', '#5a5f6a', '#868c96', '#b8bec6')
const GOLD = r5('#6a4a14', '#a87c20', '#e0b040', '#f5d466', '#fff2b0')
const CLAY = r5('#5a2a1a', '#8a4428', '#b86a44', '#d08a5a', '#e8ae7c')
const STRAW = r5('#6a5020', '#a8862e', '#d4b04a', '#e8cc6a', '#f8e8a0')
const FIRE = { dark: '#c8321e', base: '#f07a28', light: '#ffc848', hi: '#fff4b0' }
const WATER = r5('#1f4a8a', '#2e64b0', '#3d7fd6', '#6aa6ec', '#c0e2fa')

type Draw = (q: Pix) => void

/** Draw an object layer, outline it, and put it over a soft shadow. */
function obj(w: number, h: number, draw: Draw, shadow?: [number, number, number, number], post?: Draw): Pix {
  const q = new Pix(w, h)
  draw(q)
  q.outline(OUTLINE, 0.78)
  const p = new Pix(w, h)
  if (shadow) p.ellipse(shadow[0], shadow[1], shadow[2], shadow[3], '#000000', 0.22)
  p.blit(q)
  if (post) post(p)
  return p
}

/** A box in 3/4 view: top face then front face. */
function block(q: Pix, x: number, y: number, w: number, topH: number, frontH: number, r: Ramp): void {
  for (let j = 0; j < topH; j++)
    for (let i = 0; i < w; i++) q.set(x + i, y + j, j === 0 ? r.hi : i === w - 1 ? r.base : r.light)
  for (let j = 0; j < frontH; j++)
    for (let i = 0; i < w; i++) {
      const yy = y + topH + j
      let c = r.base
      if (j === 0) c = r.dark
      else if (j === frontH - 1) c = r.dark
      else if (i === w - 1) c = r.dark
      else if (i === 0) c = mix(r.base, r.light, 0.5)
      q.set(x + i, yy, c)
    }
}

function flameGrid(size: 'small' | 'mid' | 'big', f: number): string[] {
  if (size === 'small')
    return f === 0 ? ['.F.', '.F.', 'fHf', 'fHf', '.f.'] : ['..F', '.F.', 'fHf', 'fHf', '.f.']
  if (size === 'mid')
    return f === 0
      ? ['..F..', '..FF.', '.fFf.', '.fHFf', 'fFHHf', 'fFHFf', '.rfr.']
      : ['.F...', '.FF..', '.fFf.', 'fFHf.', 'fFHHf', 'fFHFf', '.rfr.']
  return f === 0
    ? ['...F....', '...FF...', '..fFF.F.', '..fFHfF.', '.fFHHFf.', '.fFHHHFf', 'rfFHHHFf', 'rfFHHFfr', '.rrffrr.']
    : ['....F...', '..F.FF..', '..fFFf..', '.fFHHf..', '.fFHHFf.', 'ffFHHHFf', 'rfFHHHFf', 'rfFHHFfr', '.rrffrr.']
}

function flame(p: Pix, cx: number, bottom: number, size: 'small' | 'mid' | 'big', f = 0): void {
  const g = flameGrid(size, f)
  const w = g[0].length
  const pal = { F: FIRE.light, H: FIRE.hi, f: FIRE.base, r: FIRE.dark }
  p.stamp(g, pal, Math.round(cx - w / 2), bottom - g.length + 1)
}

function glow(p: Pix, cx: number, cy: number, r: number, c = '#ffc848', a = 0.16): void {
  p.ellipse(cx, cy, r, r, c, a)
  p.ellipse(cx, cy, r * 0.6, r * 0.6, c, a)
}

// ---------------------------------------------------------------------------------------
// Containers

function chest(open: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      if (!open) {
        // lid
        q.hline(3, 12, 3, WOOD.hi)
        for (let y = 4; y <= 6; y++) for (let x = 2; x <= 13; x++) q.set(x, y, x === 13 ? WOOD.dark : y === 4 ? WOOD.light : WOOD.base)
        q.hline(2, 13, 7, WOOD.deep)
      } else {
        // lid swung back, showing its dark underside
        q.hline(3, 12, 1, WOOD.dark)
        for (let y = 2; y <= 4; y++) for (let x = 2; x <= 13; x++) q.set(x, y, DWOOD.deep)
        q.hline(2, 13, 5, WOOD.dark)
        for (let y = 6; y <= 7; y++) for (let x = 3; x <= 12; x++) q.set(x, y, '#1c1216')
        for (const [x, y] of [
          [4, 7],
          [5, 6],
          [6, 7],
          [9, 7],
          [10, 6],
          [11, 7],
        ])
          q.set(x, y, y === 6 ? GOLD.light : GOLD.base)
        q.set(7, 6, '#9ff0ff')
        q.vline(2, 6, 7, WOOD.base)
        q.vline(13, 6, 7, WOOD.dark)
      }
      for (let y = 8; y <= 12; y++) for (let x = 2; x <= 13; x++) q.set(x, y, x === 13 || y === 12 ? WOOD.dark : x === 2 ? WOOD.light : WOOD.base)
      q.hline(2, 13, 8, open ? WOOD.light : WOOD.base)
      // iron bands
      for (const x of [4, 11]) {
        for (let y = open ? 5 : 4; y <= 12; y++) q.set(x, y, y === 7 ? METAL.deep : METAL.base)
        q.set(x, 8, METAL.light)
      }
      // lock
      q.set(7, open ? 8 : 7, GOLD.light)
      q.set(8, open ? 8 : 7, GOLD.base)
      q.set(7, open ? 9 : 8, GOLD.base)
      q.set(8, open ? 9 : 8, GOLD.dark)
      if (!open) q.set(7, 9, GOLD.dark)
    },
    [8, 13, 7, 2],
  )
}

function barrel(open: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      const widths = [8, 10, 10, 11, 11, 11, 11, 10, 10, 8]
      for (let j = 0; j < widths.length; j++) {
        const y = 4 + j
        const w = widths[j]
        const x0 = Math.round(8 - w / 2)
        for (let i = 0; i < w; i++) {
          const x = x0 + i
          let c = WOOD.base
          if (i === 0) c = WOOD.light
          else if (i === w - 1 || i === w - 2) c = WOOD.dark
          else if ((x - x0) % 3 === 2) c = mix(WOOD.base, WOOD.dark, 0.6)
          q.set(x, y, c)
        }
      }
      // hoops
      for (const y of [5, 11]) {
        const w = widths[y - 4]
        const x0 = Math.round(8 - w / 2)
        for (let i = 0; i < w; i++) q.set(x0 + i, y, i === 0 ? METAL.light : i >= w - 2 ? METAL.dark : METAL.base)
      }
      // top ellipse
      q.ellipse(8, 3.5, 4.5, 1.8, WOOD.dark)
      q.ellipse(8, 3.5, 3.5, 1.2, open ? '#1c1418' : WOOD.light)
      if (open) {
        q.set(6, 3, WATER.base)
        q.set(7, 3, WATER.light)
        q.set(8, 3, WATER.base)
      } else {
        q.hline(6, 9, 3, WOOD.hi)
      }
    },
    [8, 14, 6, 1.6],
  )
}

function crate(open: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      block(q, 2, 3, 12, 3, 8, WOOD)
      if (open) {
        for (let y = 3; y <= 5; y++) for (let x = 3; x <= 12; x++) q.set(x, y, '#2a1c14')
        for (const [x, y] of [
          [4, 4],
          [6, 5],
          [9, 4],
          [11, 5],
          [7, 4],
        ])
          q.set(x, y, STRAW.light)
        q.set(5, 5, STRAW.base)
        q.set(10, 3, STRAW.base)
      } else {
        q.hline(2, 13, 4, WOOD.dark)
      }
      // front planks and brace
      q.hline(2, 13, 9, WOOD.dark)
      for (let i = 0; i < 6; i++) q.set(4 + i * 1.5, 13 - i, WOOD.light)
      for (let i = 0; i < 6; i++) q.set(5 + i * 1.5, 13 - i, WOOD.dark)
      q.vline(2, 6, 13, WOOD.light)
      q.vline(13, 6, 13, WOOD.deep)
      for (const [x, y] of [
        [3, 7],
        [12, 7],
        [3, 12],
        [12, 12],
      ])
        q.set(x, y, METAL.dark)
    },
    [8, 14, 7, 1.6],
  )
}

function pot(open: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.ellipse(8, 9.5, 5.2, 4.6, (x, y, nx, ny) => {
        const l = -nx * 0.6 - ny * 0.5
        return l > 0.45 ? CLAY.hi : l > 0.05 ? CLAY.light : l > -0.45 ? CLAY.base : CLAY.dark
      })
      // band
      for (let x = 3; x <= 13; x++) if (q.alpha(x, 9)) q.set(x, 9, x < 6 ? CLAY.light : CLAY.dark)
      for (let x = 4; x <= 12; x += 2) if (q.alpha(x, 10)) q.set(x, 10, CLAY.deep)
      // neck and rim
      q.rect(6, 4, 5, 2, CLAY.base)
      q.set(6, 4, CLAY.light)
      q.set(10, 5, CLAY.dark)
      q.hline(5, 11, 3, CLAY.light)
      q.hline(5, 11, 4, CLAY.base)
      if (open) {
        q.hline(6, 10, 3, '#241416')
        q.set(5, 3, CLAY.hi)
      } else {
        q.hline(6, 10, 2, CLAY.dark)
        q.set(8, 1, CLAY.base)
        q.hline(6, 10, 2, CLAY.base)
        q.set(7, 2, CLAY.hi)
      }
    },
    [8, 14, 5, 1.5],
  )
}

function sack(open: boolean): Pix {
  const B = r5('#5a4428', '#8a6c40', '#b8965a', '#d0b074', '#e6cc94')
  return obj(
    16,
    16,
    (q) => {
      q.ellipse(8, 10, 5.5, 4.5, (x, y, nx, ny) => {
        const l = -nx * 0.6 - ny * 0.6
        return l > 0.4 ? B.light : l > -0.3 ? B.base : B.dark
      })
      q.rect(5, 13, 7, 1, B.dark)
      if (open) {
        q.ellipse(8, 5.5, 4, 1.8, B.base)
        q.ellipse(8, 5.5, 3, 1, STRAW.light)
        q.set(7, 5, STRAW.hi)
        q.set(9, 6, STRAW.base)
        q.rect(6, 7, 5, 1, B.dark)
      } else {
        q.rect(7, 4, 3, 2, B.base)
        q.set(6, 3, B.light)
        q.set(8, 3, B.base)
        q.set(10, 3, B.dark)
        q.hline(6, 10, 6, '#6a3a22')
        q.set(10, 7, '#6a3a22')
      }
      // patch
      q.set(10, 10, B.deep)
      q.set(11, 10, B.dark)
      q.set(10, 11, B.dark)
    },
    [8, 14, 6, 1.5],
  )
}

function wardrobe(open: boolean): Pix {
  return obj(
    16,
    32,
    (q) => {
      // crown
      q.hline(1, 14, 8, WOOD.hi)
      q.hline(1, 14, 9, WOOD.light)
      q.hline(1, 14, 10, WOOD.dark)
      for (let y = 11; y <= 29; y++) for (let x = 2; x <= 13; x++) q.set(x, y, x === 13 ? WOOD.dark : x === 2 ? WOOD.light : WOOD.base)
      q.hline(2, 13, 29, WOOD.dark)
      q.set(2, 30, WOOD.dark)
      q.set(13, 30, WOOD.deep)
      if (!open) {
        q.vline(7, 11, 28, WOOD.deep)
        q.vline(8, 11, 28, WOOD.light)
        for (const x of [3, 9]) {
          q.rect(x + 1, 13, 3, 6, WOOD.dark)
          q.rect(x + 1, 21, 3, 6, WOOD.dark)
          q.hline(x + 1, x + 3, 13, WOOD.deep)
          q.hline(x + 1, x + 3, 21, WOOD.deep)
        }
        q.set(6, 20, GOLD.light)
        q.set(9, 20, GOLD.light)
      } else {
        for (let y = 12; y <= 28; y++) for (let x = 3; x <= 12; x++) q.set(x, y, '#1e1418')
        q.hline(3, 12, 12, WOOD.dark)
        q.hline(3, 12, 13, METAL.base)
        const cols = ['#c0403a', '#3d6fd0', '#e0b83e', '#4f9a44']
        cols.forEach((c, i) => {
          const x = 4 + i * 2
          for (let y = 14; y <= 21 + (i % 2) * 3; y++) q.set(x, y, y === 14 ? METAL.light : c)
          q.set(x + 1, 16, shade(c, -0.3))
        })
        // doors swung open to the sides
        q.vline(0, 11, 29, WOOD.light)
        q.vline(1, 11, 29, WOOD.base)
        q.vline(14, 11, 29, WOOD.dark)
        q.vline(15, 11, 29, WOOD.base)
      }
    },
    [8, 30, 7, 1.6],
  )
}

function shelf(books: boolean): Pix {
  return obj(
    16,
    32,
    (q) => {
      q.hline(1, 14, 7, WOOD.hi)
      q.hline(1, 14, 8, WOOD.dark)
      for (let y = 9; y <= 29; y++) {
        q.set(2, y, WOOD.light)
        q.set(13, y, WOOD.dark)
        for (let x = 3; x <= 12; x++) q.set(x, y, DWOOD.deep)
      }
      const shelves = [15, 22, 29]
      for (const y of shelves) {
        q.hline(2, 13, y, WOOD.light)
        q.hline(3, 12, y - 1, '#140c0c')
      }
      q.hline(2, 13, 30, WOOD.dark)
      const bookCols = ['#b83a3a', '#3a5ab0', '#4f8a3a', '#c89a38', '#7a3a9a', '#2f8a84', '#8e4a2a', '#d8d0b8']
      const tops = [9, 16, 23]
      tops.forEach((ty, si) => {
        if (books) {
          let x = 3
          let k = si * 3
          while (x <= 12) {
            const w = (k * 7) % 3 === 0 ? 2 : 1
            const hgt = 4 + ((k * 5) % 3)
            const c = bookCols[(k * 5 + si) % bookCols.length]
            for (let i = 0; i < w && x + i <= 12; i++)
              for (let y = ty + 6 - hgt; y <= ty + 4; y++) q.set(x + i, y + 1, y === ty + 6 - hgt ? shade(c, 0.3) : i === w - 1 && w > 1 ? shade(c, -0.25) : c)
            if (hgt > 4) q.set(x, ty + 3, GOLD.light)
            x += w + ((k * 3) % 4 === 0 ? 1 : 0)
            k++
          }
        } else {
          // jars and pots
          const items = [
            ['#b86a44', '#d08a5a'],
            ['#8fc8e0', '#dff4ff'],
            ['#6a8a4a', '#9aba6a'],
          ]
          for (let i = 0; i < 3; i++) {
            const [c, l] = items[(i + si) % 3]
            const x = 3 + i * 3 + (si % 2)
            q.rect(x, ty + 2, 2, 3, c)
            q.set(x, ty + 2, l)
            q.set(x, ty + 1, shade(c, -0.3))
            q.set(x + 1, ty + 1, shade(c, -0.3))
          }
        }
      })
    },
    [8, 30, 7, 1.6],
  )
}

// ---------------------------------------------------------------------------------------
// Furniture

function table(): Pix {
  return obj(
    16,
    16,
    (q) => {
      for (let y = 3; y <= 8; y++) for (let x = 1; x <= 14; x++) q.set(x, y, y === 3 ? WOOD.hi : x === 14 ? WOOD.base : (y + x * 3) % 7 === 0 ? WOOD.base : WOOD.light)
      q.hline(1, 14, 9, WOOD.base)
      q.hline(1, 14, 10, WOOD.dark)
      for (const x of [2, 12]) {
        q.rect(x, 11, 2, 4, WOOD.dark)
        q.set(x, 11, WOOD.base)
      }
      // a cup on the table
      q.set(10, 5, '#e8e4dc')
      q.set(10, 6, '#b8b4ac')
      q.set(11, 5, '#b8b4ac')
    },
    [8, 14, 7, 1.5],
  )
}

function chair(): Pix {
  return obj(
    16,
    16,
    (q) => {
      // backrest
      q.rect(4, 1, 8, 2, WOOD.light)
      q.hline(4, 11, 1, WOOD.hi)
      q.vline(4, 3, 8, WOOD.base)
      q.vline(11, 3, 8, WOOD.dark)
      q.vline(7, 3, 7, WOOD.dark)
      q.vline(8, 3, 7, WOOD.base)
      // seat
      q.rect(4, 8, 8, 3, WOOD.light)
      q.hline(4, 11, 8, WOOD.hi)
      q.hline(4, 11, 11, WOOD.dark)
      q.rect(4, 12, 1, 3, WOOD.dark)
      q.rect(11, 12, 1, 3, WOOD.deep)
    },
    [8, 14, 5, 1.3],
  )
}

function bed(): Pix {
  const blanket = r5('#5a1e2a', '#8e2a3c', '#b83a4a', '#d05a64', '#e88a8a')
  return obj(
    16,
    16,
    (q) => {
      // headboard
      q.rect(1, 0, 14, 3, WOOD.base)
      q.hline(1, 14, 0, WOOD.hi)
      q.hline(1, 14, 2, WOOD.dark)
      // frame
      q.rect(1, 3, 14, 12, WOOD.dark)
      // sheet + pillow
      q.rect(2, 3, 12, 4, '#ece8e0')
      q.rect(4, 3, 8, 3, '#ffffff')
      q.hline(4, 11, 5, '#d0ccc4')
      // blanket
      for (let y = 7; y <= 13; y++) for (let x = 2; x <= 13; x++) q.set(x, y, y === 7 ? blanket.hi : x === 13 ? blanket.dark : (x + y) % 6 === 0 ? blanket.light : blanket.base)
      q.hline(2, 13, 8, blanket.light)
      q.hline(2, 13, 14, blanket.deep)
      q.set(1, 15, WOOD.dark)
      q.set(14, 15, WOOD.deep)
    },
  )
}

function bench(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.rect(1, 7, 14, 3, WOOD.light)
      q.hline(1, 14, 7, WOOD.hi)
      q.hline(1, 14, 10, WOOD.dark)
      for (const x of [2, 12]) q.rect(x, 11, 2, 3, WOOD.dark)
    },
    [8, 13.5, 7, 1.2],
  )
}

function counter(): Pix {
  return obj(
    16,
    16,
    (q) => {
      for (let y = 3; y <= 6; y++) for (let x = 0; x <= 15; x++) q.set(x, y, y === 3 ? WOOD.hi : WOOD.light)
      q.hline(0, 15, 7, WOOD.dark)
      for (let y = 8; y <= 14; y++) for (let x = 0; x <= 15; x++) q.set(x, y, WOOD.base)
      for (const x0 of [1, 9]) {
        q.rect(x0 + 1, 9, 5, 4, WOOD.dark)
        q.hline(x0 + 1, x0 + 5, 9, DWOOD.dark)
        q.vline(x0 + 5, 10, 12, WOOD.light)
        q.hline(x0 + 2, x0 + 5, 12, WOOD.light)
      }
      q.hline(0, 15, 14, WOOD.dark)
      // a few coins on top
      q.set(11, 4, GOLD.light)
      q.set(12, 5, GOLD.base)
    },
  )
}

function stall(): Pix {
  const red = '#c83a3a'
  const white = '#f2ece0'
  return obj(
    16,
    32,
    (q) => {
      // posts
      q.vline(1, 8, 28, WOOD.dark)
      q.vline(14, 8, 28, WOOD.deep)
      // awning: stripes
      for (let y = 3; y <= 8; y++)
        for (let x = 0; x <= 15; x++) {
          const stripe = Math.floor((x + (y < 5 ? 0 : 0)) / 2) % 2 === 0
          let c = stripe ? red : white
          if (y === 3) c = stripe ? shade(red, 0.25) : '#ffffff'
          if (y === 8) c = stripe ? shade(red, -0.3) : '#c8c0b0'
          q.set(x, y, c)
        }
      // scalloped edge
      for (let x = 0; x <= 15; x++) if (x % 2 === 0) q.set(x, 9, Math.floor(x / 2) % 2 === 0 ? shade(red, -0.3) : '#c8c0b0')
      // counter
      for (let y = 20; y <= 22; y++) for (let x = 0; x <= 15; x++) q.set(x, y, y === 20 ? WOOD.hi : WOOD.light)
      for (let y = 23; y <= 29; y++) for (let x = 0; x <= 15; x++) q.set(x, y, y === 23 ? WOOD.dark : x % 4 === 3 ? WOOD.dark : WOOD.base)
      // goods: apples, bread, a jar
      for (const [x, c, l] of [
        [2, '#d83a3a', '#ff8a7a'],
        [4, '#d83a3a', '#ff8a7a'],
        [3, '#e8a030', '#ffd070'],
      ] as [number, string, string][]) {
        q.set(x, 19, c)
        q.set(x + 1, 19, shade(c, -0.25))
        q.set(x, 18, l)
      }
      q.rect(7, 18, 4, 2, '#c88a44')
      q.hline(7, 10, 18, '#e8b064')
      q.rect(12, 17, 2, 3, '#8fc8e0')
      q.set(12, 17, '#dff4ff')
      q.hline(12, 13, 16, '#8a5a34')
    },
    [8, 30, 7.5, 1.5],
  )
}

// ---------------------------------------------------------------------------------------
// Lights

function campfire(lit: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      // stone ring
      const stones: [number, number][] = [
        [3, 10],
        [5, 12],
        [8, 13],
        [11, 12],
        [13, 10],
        [12, 8],
        [4, 8],
      ]
      for (const [x, y] of stones) {
        q.set(x, y, STONE.light)
        q.set(x + 1, y, STONE.base)
        q.set(x, y + 1, STONE.base)
        q.set(x + 1, y + 1, STONE.dark)
      }
      // logs crossed
      q.line(4, 12, 11, 7, WOOD.base)
      q.line(4, 11, 11, 6, WOOD.light)
      q.line(5, 7, 12, 12, WOOD.dark)
      q.line(5, 6, 12, 11, WOOD.base)
      q.set(4, 11, WOOD.hi)
      q.set(12, 12, '#d8b080')
      if (!lit) {
        q.set(8, 9, '#3a3432')
        q.set(7, 10, '#2a2422')
      }
    },
    [8, 12.5, 6, 2],
    lit
      ? (p) => {
          glow(p, 8, 8, 7.5)
          const f = new Pix(16, 16)
          flame(f, 8.5, 10, 'big', 0)
          f.outline(FIRE.dark, 0.35)
          p.blit(f)
          p.set(6, 1, FIRE.light)
          p.set(11, 3, FIRE.base)
        }
      : undefined,
  )
}

function brazier(lit: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      // tripod legs
      q.line(5, 10, 3, 14, METAL.dark)
      q.line(10, 10, 12, 14, METAL.deep)
      q.vline(8, 10, 14, METAL.dark)
      // bowl
      q.ellipse(8, 7.5, 5.5, 1.6, METAL.dark)
      q.ellipse(8, 7.2, 4.5, 1, lit ? '#e8642a' : '#2a2224')
      for (let x = 3; x <= 12; x++) {
        q.set(x, 9, x < 6 ? METAL.light : METAL.base)
        if (x > 3 && x < 12) q.set(x, 10, METAL.dark)
      }
      q.set(3, 8, METAL.light)
      q.set(13, 8, METAL.dark)
      if (lit) {
        q.set(6, 7, '#ffd35a')
        q.set(9, 7, '#ffd35a')
      } else {
        q.set(7, 7, '#4a3a36')
        q.set(9, 7, '#4a3a36')
      }
    },
    [8, 14.5, 5, 1.2],
    lit
      ? (p) => {
          glow(p, 8, 5, 7)
          const f = new Pix(16, 16)
          flame(f, 8.5, 7, 'mid', 0)
          f.outline(FIRE.dark, 0.35)
          p.blit(f)
        }
      : undefined,
  )
}

function lamppost(lit: boolean): Pix {
  return obj(
    16,
    32,
    (q) => {
      // base
      q.rect(5, 28, 6, 2, METAL.base)
      q.hline(5, 10, 28, METAL.light)
      q.rect(6, 26, 4, 2, METAL.dark)
      // pole
      for (let y = 10; y <= 26; y++) {
        q.set(7, y, METAL.light)
        q.set(8, y, METAL.dark)
      }
      q.hline(6, 9, 18, METAL.base)
      // lantern
      q.hline(5, 10, 2, METAL.base)
      q.hline(6, 9, 1, METAL.dark)
      q.set(7, 0, METAL.dark)
      q.set(8, 0, METAL.dark)
      q.hline(4, 11, 3, METAL.dark)
      for (let y = 4; y <= 8; y++) {
        q.set(5, y, METAL.dark)
        q.set(10, y, METAL.deep)
        for (let x = 6; x <= 9; x++) q.set(x, y, lit ? (y < 6 ? '#fff4b0' : '#ffd35a') : x === 6 ? '#8a98a8' : '#56606e')
        q.set(7.5, y, METAL.dark)
      }
      q.hline(5, 10, 9, METAL.dark)
      if (lit) {
        q.set(7, 5, '#ffffff')
      } else {
        q.set(6, 4, '#c0ccd8')
      }
    },
    [8, 30, 4, 1.2],
    lit ? (p) => glow(p, 8, 6, 7.5, '#ffd35a', 0.18) : undefined,
  )
}

function candles(lit: boolean): Pix {
  const wax = '#f4e4be'
  const waxD = '#cfae7c'
  const waxL = '#fff6e0'
  // [x, top] of each 2-px wide candle
  const cs: [number, number][] = [
    [4, 7],
    [7, 4],
    [10, 6],
  ]
  return obj(
    16,
    16,
    (q) => {
      // candlestick plate
      q.ellipse(8, 13, 5.5, 1.6, GOLD.dark)
      q.hline(3, 12, 12, GOLD.base)
      q.hline(4, 9, 12, GOLD.light)
      for (const [x, top] of cs) {
        for (let y = top; y <= 11; y++) {
          q.set(x, y, y === top ? waxL : wax)
          q.set(x + 1, y, y === top ? wax : waxD)
        }
        // a drip
        q.set(x, top + 2, waxL)
      }
    },
    [8, 13.5, 5.5, 1.2],
    (p) => {
      for (const [x, top] of cs) p.set(x, top - 1, '#3a2a2a')
      if (!lit) return
      glow(p, 8, 4, 6.5, '#ffd35a', 0.14)
      for (const [x, top] of cs) {
        p.set(x, top - 2, FIRE.base)
        p.set(x + 1, top - 2, FIRE.dark, 0.7)
        p.set(x, top - 3, FIRE.light)
        p.set(x, top - 4, FIRE.hi, 0.85)
        p.set(x - 1, top - 2, FIRE.base, 0.5)
      }
    },
  )
}

function fireplace(lit: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      // stone surround
      for (let y = 1; y <= 14; y++)
        for (let x = 0; x <= 15; x++) {
          const row = Math.floor((y - 1) / 3)
          const off = row % 2 ? 2 : 0
          const mortar = (y - 1) % 3 === 2 || (x + off) % 5 === 4
          q.set(x, y, mortar ? STONE.dark : (x + y) % 5 === 0 ? STONE.light : STONE.base)
        }
      // mantel
      q.rect(0, 1, 16, 2, WOOD.base)
      q.hline(0, 15, 1, WOOD.hi)
      q.hline(0, 15, 3, WOOD.dark)
      // opening
      for (let y = 6; y <= 14; y++) for (let x = 3; x <= 12; x++) q.set(x, y, '#18100e')
      q.hline(4, 11, 5, '#18100e')
      q.hline(3, 12, 14, STONE.dark)
      // logs
      q.hline(4, 11, 13, WOOD.dark)
      q.hline(5, 10, 12, WOOD.base)
      if (lit) {
        for (let x = 4; x <= 11; x++) q.set(x, 13, x % 2 ? '#ff8a2a' : '#c8321e')
      }
      // hearth step
      q.hline(1, 14, 15, STONE.light)
    },
    undefined,
    lit
      ? (p) => {
          const f = new Pix(16, 16)
          flame(f, 8, 12, 'big', 1)
          p.blit(f)
          p.ellipse(8, 13, 7, 3, '#ffb040', 0.18)
        }
      : undefined,
  )
}

// ---------------------------------------------------------------------------------------
// Water

function well(): Pix {
  return obj(
    16,
    32,
    (q) => {
      // roof
      for (let y = 4; y <= 9; y++) {
        const w = 3 + (y - 4) * 2
        for (let x = 8 - Math.ceil(w / 2); x <= 7 + Math.ceil(w / 2); x++) q.set(x, y, (x + y) % 3 === 0 ? '#84302a' : y === 9 ? '#6a2420' : '#a8432f')
      }
      q.hline(1, 14, 10, '#5a1f1c')
      q.set(7, 3, '#a8432f')
      q.set(8, 3, '#84302a')
      // posts
      q.vline(2, 11, 22, WOOD.base)
      q.vline(13, 11, 22, WOOD.dark)
      // crank beam + rope + bucket
      q.hline(2, 13, 13, WOOD.light)
      q.vline(8, 14, 17, '#c8b080')
      q.rect(7, 18, 3, 2, WOOD.base)
      q.hline(7, 9, 18, METAL.light)
      // stone ring
      for (let y = 20; y <= 29; y++)
        for (let x = 1; x <= 14; x++) {
          const mortar = y % 3 === 1 || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0
          q.set(x, y, mortar ? STONE.dark : x < 4 ? STONE.light : STONE.base)
        }
      q.ellipse(8, 20.5, 6.5, 2.2, STONE.light)
      q.ellipse(8, 20.8, 5, 1.4, WATER.dark)
      q.hline(6, 9, 21, WATER.light)
    },
    [8, 30, 7.5, 1.6],
  )
}

function fountain(): Pix {
  return obj(
    16,
    16,
    (q) => {
      // basin
      q.ellipse(8, 10, 7.4, 4.5, STONE.base)
      for (let y = 11; y <= 14; y++) for (let x = 1; x <= 14; x++) if (q.alpha(x, y)) q.set(x, y, y >= 13 ? STONE.dark : STONE.base)
      q.rect(1, 10, 14, 3, STONE.base)
      q.hline(1, 14, 13, STONE.dark)
      q.ellipse(8, 9, 7, 3, STONE.light)
      q.ellipse(8, 9.2, 5.8, 2.2, WATER.base)
      q.hline(4, 7, 9, WATER.light)
      q.set(11, 10, WATER.light)
      // spout column
      q.rect(7, 4, 2, 5, STONE.light)
      q.set(8, 5, STONE.dark)
      q.set(8, 6, STONE.dark)
      q.rect(6, 3, 4, 1, STONE.base)
    },
    [8, 14, 7.5, 1.5],
    (p) => {
      // water jets
      for (const [x, y] of [
        [7, 1],
        [8, 1],
        [6, 2],
        [9, 2],
        [5, 3],
        [10, 3],
        [5, 5],
        [10, 5],
      ])
        p.set(x, y, WATER.hi, 0.9)
      p.set(4, 7, WATER.light, 0.9)
      p.set(11, 7, WATER.light, 0.9)
    },
  )
}

function trough(): Pix {
  return obj(
    16,
    16,
    (q) => {
      block(q, 1, 7, 14, 3, 4, WOOD)
      for (let x = 2; x <= 13; x++) {
        q.set(x, 8, WATER.base)
        q.set(x, 9, WATER.dark)
      }
      q.hline(3, 6, 8, WATER.light)
      q.hline(1, 14, 12, WOOD.dark)
      q.rect(2, 14, 2, 1, WOOD.dark)
      q.rect(12, 14, 2, 1, WOOD.deep)
    },
    [8, 14, 7.5, 1.3],
  )
}

// ---------------------------------------------------------------------------------------
// Signs, crafting, sacred, nature

function sign(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.rect(7, 9, 2, 6, WOOD.dark)
      q.set(7, 9, WOOD.base)
      q.rect(2, 3, 12, 7, WOOD.light)
      q.hline(2, 13, 3, WOOD.hi)
      q.hline(2, 13, 9, WOOD.dark)
      q.vline(13, 3, 9, WOOD.base)
      for (const [y, a, b] of [
        [5, 4, 11],
        [7, 4, 9],
      ])
        q.hline(a, b, y, WOOD.deep)
    },
    [8, 14.5, 3, 1],
  )
}

function noticeboard(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.rect(1, 12, 2, 3, WOOD.dark)
      q.rect(13, 12, 2, 3, WOOD.deep)
      q.rect(0, 1, 16, 12, WOOD.base)
      q.hline(0, 15, 1, WOOD.hi)
      q.hline(0, 15, 12, WOOD.dark)
      q.rect(1, 2, 14, 10, '#b88a5a')
      // papers
      const papers: [number, number, number, number][] = [
        [2, 3, 4, 5],
        [7, 2, 3, 4],
        [11, 4, 3, 5],
        [6, 7, 4, 4],
      ]
      papers.forEach(([x, y, w, h], i) => {
        q.rect(x, y, w, h, i === 2 ? '#f0e0a0' : '#f4f0e4')
        q.vline(x + w - 1, y + 1, y + h - 1, '#c8c0a8')
        for (let k = 1; k < h - 1; k += 2) q.hline(x + 1, x + w - 2, y + k, '#8a8480')
        q.set(x + (w >> 1), y, '#d83a3a')
      })
    },
    [8, 14.5, 7, 1],
  )
}

function anvil(): Pix {
  return obj(
    16,
    16,
    (q) => {
      // stump
      q.rect(4, 11, 8, 4, WOOD.base)
      q.vline(4, 11, 14, WOOD.light)
      q.vline(11, 11, 14, WOOD.dark)
      q.hline(4, 11, 11, '#c89a62')
      // anvil
      q.hline(1, 13, 5, METAL.hi)
      q.hline(1, 14, 6, METAL.light)
      q.hline(2, 14, 7, METAL.base)
      q.hline(3, 12, 8, METAL.dark)
      q.rect(6, 9, 4, 2, METAL.dark)
      q.hline(4, 11, 10, METAL.base)
      q.set(1, 6, METAL.base)
      q.set(0, 6, METAL.dark)
    },
    [8, 14.5, 6, 1.2],
  )
}

function forge(lit: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      for (let y = 2; y <= 14; y++)
        for (let x = 1; x <= 14; x++) {
          const mortar = y % 3 === 1 || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0
          q.set(x, y, mortar ? '#4a3e3a' : x < 4 ? '#8a6a5a' : '#6e5448')
        }
      // chimney hood
      q.rect(4, 0, 8, 3, '#5a4a44')
      q.hline(4, 11, 0, '#7a6a64')
      // mouth
      q.ellipse(8, 10.5, 4.2, 3.2, '#1a100e')
      q.hline(4, 12, 14, '#3a2e2a')
      if (lit) {
        q.ellipse(8, 11.5, 3.2, 2, '#e8642a')
        q.hline(6, 10, 12, '#ffd35a')
        q.set(8, 11, '#fff4b0')
      } else {
        q.hline(6, 10, 12, '#3a3230')
        q.set(7, 11, '#4a3a36')
      }
    },
    [8, 14.5, 7, 1.2],
    lit
      ? (p) => {
          p.ellipse(8, 11, 6, 4, '#ff9a3c', 0.2)
          const f = new Pix(16, 16)
          flame(f, 8, 11, 'mid', 1)
          p.blit(f)
        }
      : undefined,
  )
}

function cauldron(lit: boolean): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.ellipse(8, 9.5, 6, 4.5, (x, y, nx, ny) => {
        const l = -nx * 0.6 - ny * 0.5
        return l > 0.5 ? '#6a6e7a' : l > 0 ? '#44485a' : l > -0.5 ? '#30323e' : '#22242c'
      })
      q.rect(3, 13, 2, 2, '#22242c')
      q.rect(11, 13, 2, 2, '#22242c')
      q.ellipse(8, 5.8, 5.5, 1.8, '#44485a')
      q.ellipse(8, 5.8, 4.3, 1.1, lit ? '#6ac84a' : '#4a8a3a')
      q.set(6, 5, '#b8f08a')
      q.set(10, 6, '#b8f08a')
      q.set(1, 7, '#5a5e6a')
      q.set(14, 7, '#30323e')
    },
    [8, 14.5, 6, 1.4],
    (p) => {
      // bubbles
      p.set(7, 3, '#b8f08a', 0.9)
      p.set(9, 2, '#dfffc0', 0.8)
      if (lit) {
        p.ellipse(8, 15, 4, 1.2, '#ff9a3c', 0.35)
        p.set(6, 15, FIRE.base)
        p.set(7, 14, FIRE.light)
        p.set(8, 15, FIRE.light)
        p.set(9, 14, FIRE.base)
        p.set(10, 15, FIRE.base)
      }
    },
  )
}

function loom(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.vline(2, 1, 14, WOOD.base)
      q.vline(13, 1, 14, WOOD.dark)
      q.hline(2, 13, 1, WOOD.light)
      q.hline(2, 13, 2, WOOD.dark)
      q.hline(2, 13, 11, WOOD.light)
      q.hline(2, 13, 12, WOOD.dark)
      for (let x = 3; x <= 12; x++) for (let y = 3; y <= 10; y++) q.set(x, y, y > 6 ? (x % 2 ? '#3d6fd0' : '#6aa6e0') : x % 2 ? '#e8e0cc' : '#d0c4a8')
      q.hline(3, 12, 7, '#e0b83e')
    },
    [8, 14.5, 7, 1.2],
  )
}

function altar(): Pix {
  return obj(
    16,
    16,
    (q) => {
      block(q, 1, 5, 14, 3, 7, STONE)
      // cloth
      q.rect(4, 5, 8, 3, '#8e2a3c')
      q.rect(5, 8, 6, 4, '#8e2a3c')
      q.vline(8, 8, 11, GOLD.base)
      q.hline(5, 10, 11, GOLD.light)
      // candles + chalice
      q.rect(2, 3, 1, 3, '#f2ead8')
      q.rect(13, 3, 1, 3, '#f2ead8')
      q.set(7, 4, GOLD.light)
      q.set(8, 4, GOLD.base)
      q.set(7, 3, GOLD.base)
      q.set(8, 3, GOLD.base)
    },
    [8, 14.5, 7.5, 1.2],
    (p) => {
      p.set(2, 2, FIRE.light)
      p.set(13, 2, FIRE.light)
      p.set(2, 1, FIRE.hi, 0.7)
      p.set(13, 1, FIRE.hi, 0.7)
    },
  )
}

function statue(): Pix {
  const S = r5('#4a4a54', '#6a6c76', '#8e9098', '#b0b2b8', '#d0d2d6')
  return obj(
    16,
    32,
    (q) => {
      // pedestal
      block(q, 2, 22, 12, 2, 7, STONE)
      // figure: robed hero holding a sword
      q.ellipse(8, 6.5, 2.6, 2.8, S.light)
      q.set(7, 5, S.hi)
      q.rect(5, 9, 6, 7, S.base)
      q.vline(5, 9, 15, S.light)
      q.vline(10, 9, 15, S.dark)
      q.rect(4, 15, 8, 6, S.base)
      q.vline(4, 15, 20, S.light)
      q.vline(11, 15, 20, S.dark)
      q.hline(4, 11, 21, S.dark)
      // arm raising sword
      q.set(11, 10, S.base)
      q.set(12, 9, S.base)
      q.vline(12, 2, 8, S.hi)
      q.hline(11, 13, 8, S.dark)
      q.set(8, 12, S.dark)
      q.set(7, 13, S.dark)
    },
    [8, 30, 7, 1.5],
  )
}

function gravestone(): Pix {
  return obj(
    16,
    16,
    (q) => {
      for (let y = 3; y <= 13; y++)
        for (let x = 4; x <= 11; x++) {
          if (y === 3 && (x === 4 || x === 11)) continue
          if (y === 3 && (x === 5 || x === 10)) continue
          if (y === 4 && (x === 4 || x === 11)) continue
          q.set(x, y, x === 11 || y === 13 ? STONE.dark : x === 4 || y <= 4 ? STONE.light : STONE.base)
        }
      q.vline(8, 6, 10, STONE.deep)
      q.hline(6, 10, 7, STONE.deep)
      q.set(5, 11, '#5a8a40')
      q.set(10, 12, '#5a8a40')
    },
    [8, 14, 5, 1.3],
    (p) => {
      p.set(3, 14, '#4f9a44')
      p.set(12, 14, '#4f9a44')
      p.set(4, 14, '#6fb856')
    },
  )
}

function sealStone(): Pix {
  const S = r5('#2a2e3a', '#3e4454', '#565e72', '#72809a', '#98a8c0')
  return obj(
    16,
    16,
    (q) => {
      for (let y = 1; y <= 14; y++) {
        const inset = y < 3 ? 3 - y + 1 : 0
        for (let x = 4 + inset; x <= 11 - inset; x++) q.set(x, y, x >= 10 - inset ? S.dark : x <= 5 + inset ? S.light : S.base)
      }
      q.hline(3, 12, 14, S.dark)
      q.hline(3, 12, 13, S.base)
    },
    [8, 14.5, 6, 1.3],
    (p) => {
      const rune = '#6ef0e8'
      for (const [x, y] of [
        [7, 4],
        [8, 4],
        [7, 5],
        [6, 6],
        [8, 6],
        [7, 7],
        [7, 9],
        [8, 10],
        [6, 10],
        [7, 11],
      ])
        p.set(x, y, rune)
      p.ellipse(7.5, 7.5, 4, 5, rune, 0.1)
    },
  )
}

function boulder(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.ellipse(8, 9, 6.8, 5.6, (x, y, nx, ny) => {
        const l = -nx * 0.55 - ny * 0.7 + ((x * 7 + y * 3) % 5 === 0 ? -0.3 : 0)
        return l > 0.55 ? STONE.hi : l > 0.1 ? STONE.light : l > -0.4 ? STONE.base : STONE.dark
      })
      q.set(8, 8, STONE.deep)
      q.set(9, 9, STONE.deep)
      q.set(9, 10, STONE.dark)
      q.set(4, 11, '#6a9a4a')
      q.set(5, 12, '#5a8a40')
    },
    [8, 14, 7, 1.6],
  )
}

function haystack(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.ellipse(8, 9, 7, 6, (x, y, nx, ny) => {
        const l = -nx * 0.5 - ny * 0.7
        const streak = (x * 3 + y * 5) % 7 === 0
        const c = l > 0.4 ? STRAW.hi : l > -0.1 ? STRAW.light : l > -0.5 ? STRAW.base : STRAW.dark
        return streak ? STRAW.dark : c
      })
      for (let x = 1; x <= 14; x++) if (q.alpha(x, 14)) q.set(x, 14, STRAW.deep)
      q.set(3, 15, STRAW.dark)
      q.set(12, 15, STRAW.dark)
    },
    [8, 14.5, 7.5, 1.4],
  )
}

function logpile(): Pix {
  return obj(
    16,
    16,
    (q) => {
      const ends: [number, number][] = [
        [3, 12],
        [7, 12],
        [11, 12],
        [5, 8],
        [9, 8],
        [7, 4],
      ]
      for (const [x, y] of ends) {
        q.ellipse(x + 1, y + 1, 2.2, 2.2, WOOD.dark)
        q.ellipse(x + 1, y + 1, 1.5, 1.5, '#c89a62')
        q.set(x + 1, y + 1, '#a07040')
        q.set(x, y, '#dcb480')
      }
    },
    [8, 14.5, 7, 1.3],
  )
}

function mushroomRing(): Pix {
  const p = new Pix(16, 16)
  const spots: [number, number, number][] = [
    [7, 2, 0],
    [12, 4, 1],
    [13, 9, 0],
    [10, 13, 1],
    [4, 12, 0],
    [2, 7, 1],
    [4, 3, 1],
  ]
  const q = new Pix(16, 16)
  for (const [x, y, k] of spots) {
    const cap = k ? '#d83a3a' : '#c88a4a'
    q.set(x, y, cap)
    q.set(x + 1, y, shade(cap, -0.25))
    q.set(x - 1, y, shade(cap, 0.1))
    q.set(x, y - 1, shade(cap, 0.25))
    q.set(x, y + 1, '#f0e6d0')
    if (k) q.set(x - 1, y, '#ffffff')
  }
  q.outline(OUTLINE, 0.75)
  p.blit(q)
  return p
}

function beehive(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.rect(6, 12, 4, 3, WOOD.dark)
      q.ellipse(8, 7.5, 5.5, 5.5, (x, y, nx, ny) => {
        const band = y % 2 === 0
        const l = -nx * 0.6 - ny * 0.4
        return band ? (l > 0 ? STRAW.base : STRAW.dark) : l > 0.3 ? STRAW.hi : STRAW.light
      })
      q.rect(7, 9, 2, 2, '#2a1c14')
    },
    [8, 14.5, 5, 1.2],
    (p) => {
      for (const [x, y] of [
        [12, 3],
        [3, 5],
        [13, 8],
      ]) {
        p.set(x, y, '#f2c83a')
        p.set(x + 1, y, '#2a2020')
      }
    },
  )
}

function fence(): Pix {
  return obj(
    16,
    16,
    (q) => {
      for (const y of [6, 10]) {
        q.hline(0, 15, y, WOOD.light)
        q.hline(0, 15, y + 1, WOOD.dark)
      }
      for (const x of [3, 12]) {
        q.rect(x, 3, 2, 11, WOOD.base)
        q.vline(x, 3, 13, WOOD.light)
        q.set(x, 3, WOOD.hi)
        q.set(x + 1, 3, WOOD.base)
      }
    },
    [8, 14, 7, 0.8],
  )
}

function dummy(): Pix {
  return obj(
    16,
    16,
    (q) => {
      q.vline(8, 9, 14, WOOD.dark)
      q.vline(7, 9, 14, WOOD.base)
      // arms
      q.hline(2, 13, 6, WOOD.base)
      q.hline(2, 13, 7, WOOD.dark)
      // straw body
      q.rect(5, 5, 6, 6, STRAW.light)
      q.vline(10, 5, 10, STRAW.dark)
      q.hline(5, 10, 8, '#8a5a34')
      // head
      q.ellipse(8, 2.8, 2.6, 2.4, '#d8c8a0')
      q.set(7, 2, '#5a3a2a')
      q.set(9, 2, '#5a3a2a')
      q.set(8, 3, '#5a3a2a')
      // straw tufts
      q.set(2, 5, STRAW.light)
      q.set(13, 5, STRAW.light)
      q.set(5, 11, STRAW.base)
      q.set(10, 11, STRAW.base)
    },
    [8, 14.5, 4, 1.1],
  )
}

// ---------------------------------------------------------------------------------------

type Maker = { base: () => Pix; open?: () => Pix; lit?: () => Pix }

const MAKERS: Record<string, Maker> = {
  chest: { base: () => chest(false), open: () => chest(true) },
  barrel: { base: () => barrel(false), open: () => barrel(true) },
  crate: { base: () => crate(false), open: () => crate(true) },
  pot: { base: () => pot(false), open: () => pot(true) },
  wardrobe: { base: () => wardrobe(false), open: () => wardrobe(true) },
  shelf: { base: () => shelf(false), open: () => shelf(false) },
  bookshelf: { base: () => shelf(true), open: () => shelf(true) },
  sack: { base: () => sack(false), open: () => sack(true) },
  table: { base: table },
  chair: { base: chair },
  bed: { base: bed },
  bench: { base: bench },
  counter: { base: counter },
  stall: { base: stall },
  campfire: { base: () => campfire(false), lit: () => campfire(true) },
  brazier: { base: () => brazier(false), lit: () => brazier(true) },
  lamppost: { base: () => lamppost(false), lit: () => lamppost(true) },
  candles: { base: () => candles(false), lit: () => candles(true) },
  fireplace: { base: () => fireplace(false), lit: () => fireplace(true) },
  well: { base: well },
  fountain: { base: fountain },
  trough: { base: trough },
  sign: { base: sign },
  noticeboard: { base: noticeboard },
  anvil: { base: anvil },
  forge: { base: () => forge(false), lit: () => forge(true) },
  cauldron: { base: () => cauldron(false), lit: () => cauldron(true) },
  loom: { base: loom },
  altar: { base: altar },
  statue: { base: statue },
  gravestone: { base: gravestone },
  seal_stone: { base: sealStone },
  boulder: { base: boulder },
  haystack: { base: haystack },
  logpile: { base: logpile },
  mushroom_ring: { base: mushroomRing },
  beehive: { base: beehive },
  fence: { base: fence },
  dummy: { base: dummy },
}

const ALIASES: Record<string, string> = {
  fixture: 'crate',
  container: 'crate',
  furniture: 'table',
  light: 'candles',
  water: 'well',
  craft: 'anvil',
  workstation: 'anvil',
  sacred: 'altar',
  nature: 'boulder',
  box: 'crate',
  lamp: 'lamppost',
  torch: 'brazier',
  grave: 'gravestone',
  rock: 'boulder',
  hay: 'haystack',
  bookcase: 'bookshelf',
}

export const FIXTURE_KEYS = Object.keys(MAKERS)

export function fixtureSheet(sprite: string): Sheet {
  const key = (sprite || '').split(':').pop()!.split('/').pop()!.toLowerCase()
  const m = MAKERS[key] ?? MAKERS[ALIASES[key] ?? ''] ?? MAKERS[Object.keys(MAKERS).find((k) => key.includes(k)) ?? 'crate']
  const items: { name: string; pix: Pix }[] = [{ name: 'base', pix: m.base() }]
  if (m.open) items.push({ name: 'open', pix: m.open() })
  if (m.lit) items.push({ name: 'lit', pix: m.lit() })
  return pack(items, 4)
}
