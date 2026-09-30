// Creatures: 16x16, 2-frame idle animation. Frames: idle0/idle1 plus left*/right*/down*/up*
// aliases (side-view animals face left in idle/left and are mirrored for right).
// `variant` is an element ('fire', 'ice', …) or a type leaf ('frost_wolf', 'stone_golem', …).

import { ELEMENT_COLORS, OUTLINE, Pix, mix, pack, shade, type Sheet } from './core.ts'

type Pal = Record<string, string>

interface Def {
  frames: [string[], string[]?]
  pal: Pal
  /** Side view (faces left) → right frames are mirrored. */
  side?: boolean
  /** Hovering creature: gets a ground shadow and bobs as a whole. */
  float?: boolean
  alpha?: number
  /** Rows at/after which the "breathing" transform keeps pixels fixed (legs). */
  legRow?: number
}

const VARIANT_ELEMENT: Record<string, string> = {
  fire_slime: 'fire',
  frost_slime: 'ice',
  spark_slime: 'lightning',
  water_slime: 'water',
  green_slime: '',
  frost_wolf: 'ice',
  ice_golem: 'ice',
  stone_golem: 'earth',
  fire_imp: 'fire',
  storm_wisp: 'lightning',
}

function elementOf(variant: string): string {
  const v = (variant || '').toLowerCase()
  if (v in ELEMENT_COLORS) return v
  if (v in VARIANT_ELEMENT) return VARIANT_ELEMENT[v]
  for (const e of Object.keys(ELEMENT_COLORS)) if (v.includes(e)) return e
  if (v.includes('frost')) return 'ice'
  if (v.includes('storm') || v.includes('spark')) return 'lightning'
  if (v.includes('stone') || v.includes('rock')) return 'earth'
  return ''
}

const body = (base: string, light = 0.3, dark = 0.3): Pal => ({ B: base, L: shade(base, light), W: shade(base, light * 2), b: shade(base, -dark), d: shade(base, -dark * 1.8) })

// ---------------------------------------------------------------------------------------
// Grids

const SLIME: [string[], string[]] = [
  [
    '................',
    '................',
    '................',
    '................',
    '.......BB.......',
    '......BBBB......',
    '.....BWLBBB.....',
    '....BWLBBBBB....',
    '...BBLBBBBBBb...',
    '..BBLBBBBBBBBb..',
    '..BBBeEBBeEBBb..',
    '..BBBEEBBEEBBb..',
    '..BBBBBBBBBBbb..',
    '..bBBBBBBBBbbb..',
    '...bbbbbbbbbb...',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......BB.......',
    '.....BBBBBB.....',
    '....BWLBBBBB....',
    '...BWLBBBBBBb...',
    '..BBLBBBBBBBBb..',
    '.BBBBeEBBeEBBBb.',
    '.BBBBEEBBEEBBBb.',
    '.BBBBBBBBBBBBbb.',
    '.bbBBBBBBBBBbbb.',
    '..bbbbbbbbbbbb..',
    '................',
  ],
]

const WOLF: string[] = [
  '................',
  '................',
  '................',
  '..B.B...........',
  '..BbB...........',
  '.BBBBB..........',
  '.BEBBBB......BT.',
  'KBBBBBBBBBBBBBT.',
  '.bbWBBLLLLBBBbT.',
  '...WWBBBBBBBBb..',
  '...WBBbbbbBBBb..',
  '...BB.b...BB.b..',
  '...BB.b...BB.b..',
  '...dd.d...dd.d..',
  '................',
  '................',
]
const WOLF1: string[] = [
  '................',
  '................',
  '................',
  '................',
  '..B.B...........',
  '..BbB...........',
  '.BBBBB.......BT.',
  '.BEBBBBBBBBBBBT.',
  'KBBBBBBLLLLBBbT.',
  '.bbWBBBBBBBBBb..',
  '...WBBbbbbBBBb..',
  '...BB.b...BB.b..',
  '...BB.b...BB.b..',
  '...dd.d...dd.d..',
  '................',
  '................',
]

const BOAR: string[] = [
  '................',
  '................',
  '................',
  '................',
  '.....KKKKKK.....',
  '....BBBBBBBBB...',
  '..BBBBLLLBBBBb..',
  '.BEBBLLBBBBBBbT.',
  'PPBBBBBBBBBBBbb.',
  'PPWBBBBBBBBBBbb.',
  '..WBBbBBBBBBbbb.',
  '..bbbbbbbbbbbb..',
  '..BB.bb...BB.bb.',
  '..dd.dd...dd.dd.',
  '................',
  '................',
]
const BOAR1: string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....KKKKKK.....',
  '...BBBBBBBBBB...',
  '..BBBBLLLBBBBbT.',
  '.BEBBLLBBBBBBbb.',
  'PPBBBBBBBBBBBbb.',
  'PPWBBbBBBBBBbbb.',
  '..Wbbbbbbbbbbb..',
  '..BB.bb...BB.bb.',
  '..dd.dd...dd.dd.',
  '................',
  '................',
]

const BAT: [string[], string[]] = [
  [
    '................',
    '................',
    '..w..........w..',
    '..ww..B..B..ww..',
    '..wWw.BBBB.wWw..',
    '..wWWWBEEBWWWw..',
    '...wWWBBBBWWw...',
    '...w.wBFFBw.w...',
    '......BBBB......',
    '.......BB.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '......B..B......',
    '......BBBB......',
    '...wwWBEEBWww...',
    '..wWWWBBBBWWWw..',
    '.wWWWwBFFBwWWWw.',
    '.w.ww.BBBB.ww.w.',
    '.......BB.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
]

const SKELETON: [string[], string[]] = [
  [
    '................',
    '.....WWWWWW.....',
    '....WWWWWWWWb...',
    '....WKKWWKKWb...',
    '....WKRWWKRWb...',
    '....WWWKKWWWb...',
    '.....WTWTWTb....',
    '......bWWb......',
    '....WWWbbWWW....',
    '...W.WbWWbW.W...',
    '...W.WbWWbW.W...',
    '...b..WbbW..b...',
    '.....WW..WW.....',
    '.....W....W.....',
    '....WW....WW....',
    '................',
  ],
  [
    '................',
    '................',
    '.....WWWWWW.....',
    '....WWWWWWWWb...',
    '....WKKWWKKWb...',
    '....WKRWWKRWb...',
    '....WWWKKWWWb...',
    '.....WTWTWTb....',
    '....WWbWWbWW....',
    '...W.WbWWbW.W...',
    '...W.WbWWbW.W...',
    '...b..WbbW..b...',
    '.....WW..WW.....',
    '.....W....W.....',
    '....WW....WW....',
    '................',
  ],
]

const GHOST: [string[], string[]] = [
  [
    '................',
    '......WWWW......',
    '....WWWWWWWW....',
    '...WLLWWWWWWB...',
    '...WLKKWWKKWB...',
    '...WWKKWWKKWB...',
    '..WWWWWWWWWWBB..',
    '..WWWWWKKWWWBB..',
    '..WWWWWKKWWWBB..',
    '..WWWWWWWWWWBB..',
    '..WWWWWWWWWBBB..',
    '..BWWWWWWWWBBb..',
    '..B.BWW.BWW.b...',
    '......B...B.....',
    '................',
    '................',
  ],
  [
    '................',
    '......WWWW......',
    '....WWWWWWWW....',
    '...WLLWWWWWWB...',
    '...WLKKWWKKWB...',
    '...WWKKWWKKWB...',
    '..WWWWWWWWWWBB..',
    '..WWWWWKKWWWBB..',
    '..WWWWWWWWWWBB..',
    '..WWWWWWWWWWBB..',
    '..WWWWWWWWWBBB..',
    '..BWWWWWWWWBBb..',
    '...BWW.BWW.BBb..',
    '....B...B...b...',
    '................',
    '................',
  ],
]

const GOLEM: string[] = [
  '................',
  '.....BBBBBB.....',
  '....BLLLLLBb....',
  '....BEEBBEEb....',
  '....BBBBBBBb....',
  '..LLLbbbbbbLL...',
  '.LLBBBBBBBBBBb..',
  '.BBbBLLAALBbBb..',
  '.BBbBBBAABBbBb..',
  '.BBb.BBBBBb.Bb..',
  '.LLb.BBBBBb.Lb..',
  '.bbb.bb..bb.bb..',
  '.....BB..BB.....',
  '....LBB..BBb....',
  '....bbb..bbb....',
  '................',
]

const IMP: [string[], string[]] = [
  [
    '................',
    '................',
    '....K......K....',
    '....KB....BK....',
    '.....BBBBBB.....',
    '....BLBBBBBb....',
    '....BYEBBYEb....',
    '....BBBBBBBb....',
    '..w..BTKKTB..w..',
    '.wWw.BBBBBb.wWw.',
    '.wWWBBLBBBBbWWw.',
    '..w.BBBBBBBb.w..',
    '.....BBBBBb..T..',
    '.....BB..Bb.TT..',
    '.....dd..dd.....',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '....K......K....',
    '....KB....BK....',
    '.....BBBBBB.....',
    '....BLBBBBBb....',
    '....BYEBBYEb....',
    '.w..BBBBBBBb..w.',
    '.wW..BTKKTB..Ww.',
    '.wWWBBBBBBBbWWw.',
    '..wWBBLBBBBbWw..',
    '.....BBBBBb.T...',
    '.....BB..BbT....',
    '.....dd..dd.....',
    '................',
  ],
]

const CRAB: [string[], string[]] = [
  [
    '................',
    '................',
    '................',
    '..CC........CC..',
    '.CLCC......CCLC.',
    '.CC.C.E..E.C.CC.',
    '..CCC.K..K.CCC..',
    '....BBBBBBBB....',
    '...BLLBBBBBBb...',
    '..BLBBBBBBBBBb..',
    '..BBBBBBBBBBBb..',
    '...bBBBBBBBBb...',
    '..b.b.bbbb.b.b..',
    '.b..b......b..b.',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '.CCC........CCC.',
    '.CLCC.E..E.CCLC.',
    '..CCC.K..K.CCC..',
    '....BBBBBBBB....',
    '...BLLBBBBBBb...',
    '..BLBBBBBBBBBb..',
    '..BBBBBBBBBBBb..',
    '...bBBBBBBBBb...',
    '..b.b.bbbb.b.b..',
    '..b.b......b.b..',
    '................',
    '................',
  ],
]

// ---------------------------------------------------------------------------------------

function defFor(kind: string, el: string, variant: string): Def {
  const E = el ? ELEMENT_COLORS[el] : undefined
  switch (kind) {
    case 'slime': {
      const base = !el ? '#5ec85a' : el === 'fire' ? '#ee5a2a' : el === 'ice' ? '#9fd8f0' : el === 'lightning' ? '#f0cc34' : el === 'water' ? '#3f8ee8' : el === 'earth' ? '#a8804a' : '#8fe0b0'
      const p = body(base, 0.32, 0.32)
      return { frames: SLIME, pal: { ...p, W: el === 'fire' ? '#fff0a0' : '#f4fff0', E: '#1e1a2a', e: '#ffffff' } }
    }
    case 'wolf': {
      const base = el === 'ice' ? '#cfe4f2' : el === 'fire' ? '#b8502a' : el === 'lightning' ? '#c8b050' : '#8a8490'
      const p = body(base, 0.28, 0.3)
      return {
        frames: [WOLF, WOLF1],
        side: true,
        legRow: 11,
        pal: { ...p, W: el === 'ice' ? '#ffffff' : '#e4dcd0', E: E ? E.light : '#f0d040', K: '#221c24', T: el === 'ice' ? '#ffffff' : shade(base, 0.2) },
      }
    }
    case 'boar': {
      const base = el === 'ice' ? '#9ab0c0' : '#6e4a32'
      const p = body(base, 0.25, 0.32)
      return { frames: [BOAR, BOAR1], side: true, legRow: 12, pal: { ...p, K: '#2a1c16', P: '#d8928a', W: '#f4f0e0', E: '#1a1418', T: shade(base, -0.4) } }
    }
    case 'bat': {
      const base = el ? mix('#6a4a8a', ELEMENT_COLORS[el].base, 0.5) : '#5e4478'
      return {
        frames: BAT,
        float: true,
        pal: { B: base, W: shade(base, 0.25), w: shade(base, -0.3), E: E ? E.light : '#ff5a5a', F: '#f4f0e8' },
      }
    }
    case 'skeleton': {
      return { frames: SKELETON, pal: { W: '#ece6d4', b: '#b0a890', K: '#221c26', R: E ? E.base : '#e8403a', T: '#221c26' } }
    }
    case 'ghost': {
      const base = el === 'fire' ? '#ffd0a8' : el === 'lightning' ? '#fff6c0' : '#dff0ff'
      return { frames: GHOST, float: true, alpha: 0.88, pal: { W: base, L: '#ffffff', B: shade(base, -0.25), b: shade(base, -0.45), K: '#2a2440' } }
    }
    case 'golem': {
      const base = el === 'ice' ? '#9fd4ec' : el === 'fire' ? '#6a4a44' : el === 'lightning' ? '#7a7a8a' : el === 'earth' ? '#8a7a64' : '#848078'
      const p = body(base, 0.28, 0.3)
      const glow = E ? E.light : '#8ff0ff'
      return { frames: [GOLEM], legRow: 12, pal: { ...p, E: glow, A: E ? E.base : '#5ad0e8' } }
    }
    case 'imp': {
      const base = el === 'ice' ? '#5a8ac8' : el === 'lightning' ? '#8a6ac8' : '#d0443a'
      const p = body(base, 0.28, 0.3)
      return { frames: IMP, float: true, pal: { ...p, K: '#2a1418', Y: '#fff0a0', E: '#2a1418', T: shade(base, -0.2), W: '#4a2a3a', w: '#2a1824' } }
    }
    case 'crab': {
      const base = el === 'ice' ? '#7ab8e0' : el === 'lightning' ? '#d8b040' : '#d8603a'
      const p = body(base, 0.28, 0.32)
      return { frames: CRAB, pal: { ...p, C: shade(base, 0.08), E: '#1a1418', K: shade(base, -0.4) } }
    }
    default:
      void variant
      return defFor('slime', el, variant)
  }
}

/** Wisp: drawn procedurally (glowing orb with a flickering flame tongue). */
function wispFrame(el: string, f: number): Pix {
  const col = el ? ELEMENT_COLORS[el] : { base: '#5ab8f0', light: '#dff6ff', dark: '#2a6ab8', glow: '#8fd8ff' }
  const p = new Pix(16, 16)
  const cy = 8 + (f ? 0 : 0)
  // halo
  p.ellipse(8, cy + 1, 6.5, 6.5, col.glow, 0.18)
  p.ellipse(8, cy + 1, 5, 5, col.glow, 0.22)
  // flame tongues
  const tongue = f === 0 ? [[7, 2], [8, 3], [6, 4], [9, 4]] : [[8, 2], [7, 3], [9, 4], [6, 5]]
  for (const [x, y] of tongue) p.set(x, y, col.base)
  p.ellipse(8, cy + 1.5, 3.6, 3.8, col.base)
  p.ellipse(8, cy + 1, 2.6, 3, col.light)
  p.ellipse(7.5, cy + 0.5, 1.2, 1.4, '#ffffff')
  // eyes
  p.set(7, cy + 1, col.dark)
  p.set(9, cy + 1, col.dark)
  if (el === 'lightning' || el === 'fire') {
    const sp = f === 0 ? [[3, 5], [12, 9], [4, 12]] : [[12, 4], [3, 10], [11, 13]]
    for (const [x, y] of sp) {
      p.set(x, y, col.light)
      p.set(x + 1, y, col.base, 0.7)
    }
  }
  // ground shadow
  p.ellipse(8, 14.5, 3.5, 1, '#000000', 0.25)
  return p
}

/** Generic idle transform: body rows above `legRow` sink by 1 pixel. */
function breathe(src: Pix, legRow: number): Pix {
  const p = new Pix(16, 16)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const c = src.get(x, y)
      if (!c) continue
      if (y < legRow) p.set(x, y + 1, c)
      else if (!p.alpha(x, y)) p.set(x, y, c)
    }
  return p
}

function extras(p: Pix, kind: string, el: string, f: number): void {
  if (kind === 'slime') {
    if (el === 'fire') {
      const pts = f === 0 ? [[6, 2], [10, 3], [8, 1]] : [[7, 3], [9, 1], [11, 2]]
      pts.forEach(([x, y], i) => p.set(x, y + (f ? 1 : 0), i === 2 ? '#fff4a0' : '#ffb03a'))
    } else if (el === 'lightning') {
      const pts = f === 0 ? [[2, 6], [3, 5], [13, 8], [12, 7]] : [[13, 5], [12, 4], [2, 9], [3, 8]]
      for (const [x, y] of pts) p.set(x, y, '#fffbc8')
    } else if (el === 'ice') {
      // frost crystal on the crown
      const y0 = f ? 3 : 2
      p.set(7, y0, '#ffffff')
      p.set(8, y0 + 1, '#ffffff')
      p.set(6, y0 + 1, '#dff6ff')
    } else if (el === 'water') {
      const y = f ? 8 : 7
      p.set(10, y, '#e0f4ff')
      p.set(11, y + 1, '#8cc8ff')
      p.set(9, y + 1, '#8cc8ff')
    } else if (el === 'wind') {
      p.set(1, 9 + f, '#e8fff2')
      p.set(2, 8 + f, '#e8fff2')
      p.set(14, 10 - f, '#e8fff2')
    }
  } else if (kind === 'golem' && el) {
    const c = ELEMENT_COLORS[el]
    if (el === 'ice') {
      p.over(5, 2, '#ffffff')
      p.over(2, 6, '#ffffff')
    }
    if (f === 1) {
      p.over(7, 7, c.light)
      p.over(8, 8, c.light)
    }
  } else if (kind === 'imp' && el === 'fire') {
    const y = f ? 2 : 1
    p.set(4, y, '#ffb03a')
    p.set(11, y, '#ffb03a')
  } else if (kind === 'wolf' && el === 'ice') {
    p.set(6, 5 + f, '#ffffff')
  }
}

const KINDS = ['slime', 'wolf', 'boar', 'bat', 'skeleton', 'ghost', 'golem', 'imp', 'wisp', 'crab']

export function creatureSheet(sprite: string, variant: string): Sheet {
  let kind = (sprite || '').split(':').pop()!.toLowerCase()
  if (!KINDS.includes(kind)) {
    kind = KINDS.find((k) => kind.includes(k)) ?? 'slime'
  }
  const el = elementOf(variant)
  const frames: Pix[] = []
  if (kind === 'wisp') {
    frames.push(wispFrame(el, 0), wispFrame(el, 1))
  } else {
    const def = defFor(kind, el, variant)
    for (let f = 0; f < 2; f++) {
      let p = new Pix(16, 16)
      const grid = def.frames[f] ?? def.frames[0]
      p.stamp(grid, def.pal)
      if (!def.frames[f]) p = breathe(p, def.legRow ?? 12)
      extras(p, kind, el, f)
      p.outline(OUTLINE, 0.8)
      if (def.alpha) p.fade(def.alpha)
      if (def.float) {
        const q = new Pix(16, 16)
        q.ellipse(8, 14.5, f ? 3 : 3.5, 1, '#000000', 0.25)
        q.blit(p, 0, f ? -1 : 0)
        p = q
      }
      frames.push(p)
    }
    if (def.side) {
      return pack(
        [
          { name: 'idle0', pix: frames[0] },
          { name: 'idle1', pix: frames[1] },
          { name: 'left0', pix: frames[0] },
          { name: 'left1', pix: frames[1] },
          { name: 'right0', pix: frames[0].flipped() },
          { name: 'right1', pix: frames[1].flipped() },
          { name: 'down0', pix: frames[0] },
          { name: 'down1', pix: frames[1] },
          { name: 'up0', pix: frames[0].flipped() },
          { name: 'up1', pix: frames[1].flipped() },
        ],
        10,
      )
    }
  }
  return pack(
    [
      { name: 'idle0', pix: frames[0] },
      { name: 'idle1', pix: frames[1] },
      { name: 'left0', pix: frames[0] },
      { name: 'left1', pix: frames[1] },
      { name: 'right0', pix: frames[0].flipped() },
      { name: 'right1', pix: frames[1].flipped() },
      { name: 'down0', pix: frames[0] },
      { name: 'down1', pix: frames[1] },
      { name: 'up0', pix: frames[0] },
      { name: 'up1', pix: frames[1] },
    ],
    10,
  )
}

export const CREATURE_KINDS = KINDS
