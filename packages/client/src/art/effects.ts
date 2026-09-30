// Status overlays (16x16 animated, frames f0…) and small VFX particle textures.

import { Pix, pack, type Sheet } from './core.ts'

const FIRE = { dark: '#c8321e', base: '#f07a28', light: '#ffc848', hi: '#fff4b0' }

const TONGUES: string[][] = [
  ['..F..', '.fF..', '.fHf.', 'fFHFf', 'fFHHf', '.fff.'],
  ['.F...', '.Ff..', '.fHf.', 'fFHf.', 'fFHHf', '.fff.'],
  ['...F.', '..Ff.', '.fHf.', '.fHFf', 'fFHHf', '.fff.'],
  ['..F..', '..F..', '.fFf.', 'fFHFf', 'fHHFf', '.fff.'],
]

function tongue(p: Pix, cx: number, bottom: number, f: number, alpha = 0.95): void {
  const g = TONGUES[f % TONGUES.length]
  const pal: Record<string, string> = { F: FIRE.light, H: FIRE.hi, f: FIRE.base }
  for (let j = 0; j < g.length; j++)
    for (let i = 0; i < g[j].length; i++) {
      const c = pal[g[j][i]]
      if (c) p.set(cx - 2 + i, bottom - g.length + 1 + j, c, alpha)
    }
}

function fireFrames(): Pix[] {
  return [0, 1, 2, 3].map((f) => {
    const p = new Pix(16, 16)
    p.ellipse(8, 12, 7, 4, FIRE.base, 0.18)
    tongue(p, 4, 15, f)
    tongue(p, 8, 13 - (f % 2), f + 1)
    tongue(p, 12, 15, f + 2)
    tongue(p, 6, 9 + (f % 2), f + 3, 0.8)
    const emb: [number, number][] = [
      [3, 5 - f],
      [11, 7 - f],
      [8, 3 + ((f * 3) % 4)],
    ]
    for (const [x, y] of emb) if (y >= 0) p.set(x, y, FIRE.light, 0.9)
    // dark red edges
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        if (!p.alpha(x, y) && (p.alpha(x, y + 1) > 200 || p.alpha(x - 1, y) > 200 || p.alpha(x + 1, y) > 200) && p.get(x, y + 1) !== null) {
          if (p.get(x, y + 1) === FIRE.base || p.get(x - 1, y) === FIRE.base || p.get(x + 1, y) === FIRE.base) p.set(x, y, FIRE.dark, 0.7)
        }
    return p
  })
}

function wetFrames(): Pix[] {
  const drops: [number, number][] = [
    [3, 4],
    [7, 1],
    [11, 6],
    [13, 2],
    [5, 9],
  ]
  return [0, 1, 2].map((f) => {
    const p = new Pix(16, 16)
    drops.forEach(([x, y0], i) => {
      const y = (y0 + f * 4 + i * 2) % 14
      p.set(x, y, '#dff4ff', 0.9)
      p.set(x, y + 1, '#6ab0f0', 0.85)
      p.set(x, y + 2, '#3d7fd6', 0.6)
    })
    // small puddle ripple at the feet
    p.hline(5, 10, 15, '#6ab0f0')
    p.set(4 + f, 15, '#dff4ff', 0.8)
    return p
  })
}

function iceFrames(): Pix[] {
  return [0, 1].map((f) => {
    const p = new Pix(16, 16)
    // translucent shell
    p.ellipse(8, 9, 7, 7, '#bfe8ff', 0.32)
    p.ellipse(8, 9, 7, 7, (x, y, nx, ny) => (nx * nx + ny * ny > 0.72 ? '#e8f8ff' : null), 0.45)
    // crystals along the bottom and sides
    const spikes: [number, number, number][] = [
      [2, 14, 3],
      [4, 15, 4],
      [7, 15, 2],
      [11, 15, 4],
      [13, 14, 3],
      [1, 9, 2],
      [14, 8, 2],
    ]
    for (const [x, y, h] of spikes)
      for (let k = 0; k < h; k++) {
        p.set(x, y - k, k === h - 1 ? '#ffffff' : '#9fd8f2', 0.9)
        if (k < h - 1) p.set(x + 1, y - k, '#6aaad8', 0.8)
      }
    // moving glint
    const g = f === 0 ? [4, 5] : [10, 4]
    p.set(g[0], g[1], '#ffffff')
    p.set(g[0] + 1, g[1] + 1, '#ffffff', 0.8)
    p.set(g[0] - 1, g[1] - 1, '#ffffff', 0.5)
    return p
  })
}

function sparkFrames(): Pix[] {
  const bolts: [number, number][][] = [
    [
      [3, 2],
      [5, 4],
      [3, 6],
      [5, 8],
    ],
    [
      [12, 3],
      [10, 5],
      [12, 7],
      [11, 9],
    ],
    [
      [7, 9],
      [9, 11],
      [7, 13],
      [8, 15],
    ],
  ]
  return [0, 1, 2].map((f) => {
    const p = new Pix(16, 16)
    const draw = (pts: [number, number][]) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i]
        const [x1, y1] = pts[i + 1]
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
        for (let k = 0; k <= n; k++) {
          const x = Math.round(x0 + ((x1 - x0) * k) / n)
          const y = Math.round(y0 + ((y1 - y0) * k) / n)
          p.set(x, y, '#fffbd0')
          p.set(x + 1, y, '#f5d63a', 0.7)
        }
      }
    }
    draw(bolts[f])
    draw(bolts[(f + 1) % 3].map(([x, y]) => [15 - x, y] as [number, number]))
    for (const [x, y] of [
      [2, 12],
      [13, 13],
      [8, 1],
    ])
      if ((x + y + f) % 2 === 0) p.set(x, y, '#fff07a', 0.9)
    p.ellipse(8, 8, 7, 7, '#fff07a', 0.08)
    return p
  })
}

function oilFrames(): Pix[] {
  return [0, 1].map((f) => {
    const p = new Pix(16, 16)
    // puddle under the entity
    p.ellipse(8, 14.5, 6, 1.6, '#2a2418', 0.75)
    p.set(5 + f * 3, 14, '#8a6ab0', 0.8)
    p.set(6 + f * 3, 14, '#6ab0a0', 0.8)
    p.set(7 + f * 3, 14, '#c8b060', 0.7)
    // drips
    for (const [x, y0] of [
      [4, 6],
      [11, 8],
      [8, 10],
    ]) {
      const y = y0 + f
      p.set(x, y, '#3a3222', 0.9)
      p.set(x, y + 1, '#1e1a12', 0.9)
      p.set(x, y - 1, '#6a5a3a', 0.6)
    }
    // glossy sheen
    p.set(3, 5 + f, '#e8d8a0', 0.5)
    p.set(12, 7 - f, '#e8d8a0', 0.5)
    return p
  })
}

function flameFrames(): Pix[] {
  const G: string[][] = [
    ['...F...', '...FF..', '..fFf..', '..fHFf.', '.fFHHf.', '.fFHFf.', '..rfr..'],
    ['..F....', '..FF...', '..fFf..', '.fFHf..', '.fFHHf.', '.fFHFf.', '..rfr..'],
    ['....F..', '...FF..', '..fFf..', '..fHFf.', '.fFHHf.', '.fFHHf.', '..rfr..'],
    ['...F...', '..FF...', '..fFFf.', '.fFHf..', '.fFHHf.', '.fFHFf.', '..rfr..'],
  ]
  return G.map((g, f) => {
    const p = new Pix(16, 16)
    p.ellipse(8, 9, 5, 5, FIRE.light, 0.12 + (f % 2) * 0.04)
    p.stamp(g, { F: FIRE.light, H: FIRE.hi, f: FIRE.base, r: FIRE.dark }, 5, 6)
    return p
  })
}

const OVERLAYS: Record<string, () => Pix[]> = {
  fire: fireFrames,
  burning: fireFrames,
  wet: wetFrames,
  ice: iceFrames,
  frozen: iceFrames,
  spark: sparkFrames,
  electrified: sparkFrames,
  oil: oilFrames,
  oiled: oilFrames,
  flame: flameFrames,
  lit: flameFrames,
}

export const OVERLAY_KEYS = ['fire', 'wet', 'ice', 'spark', 'oil', 'flame']

export function overlaySheet(overlay: string): Sheet {
  const make = OVERLAYS[(overlay || '').toLowerCase()] ?? sparkleFrames
  return pack(
    make().map((pix, i) => ({ name: `f${i}`, pix })),
    8,
  )
}

/** Fallback overlay for unknown names: a gentle twinkle. */
function sparkleFrames(): Pix[] {
  return [0, 1].map((f) => {
    const p = new Pix(16, 16)
    const pts: [number, number][] = f ? [[4, 4], [11, 9]] : [[10, 3], [5, 11]]
    for (const [x, y] of pts) {
      p.set(x, y, '#ffffff')
      p.set(x - 1, y, '#ffffff', 0.5)
      p.set(x + 1, y, '#ffffff', 0.5)
      p.set(x, y - 1, '#ffffff', 0.5)
      p.set(x, y + 1, '#ffffff', 0.5)
    }
    return p
  })
}

// ---------------------------------------------------------------------------------------
// Particles (white or natural colour; the client tints)

function particle(name: string): Pix {
  switch (name) {
    case 'dot': {
      const p = new Pix(3, 3)
      p.set(1, 1, '#ffffff')
      p.set(0, 1, '#ffffff', 0.6)
      p.set(2, 1, '#ffffff', 0.6)
      p.set(1, 0, '#ffffff', 0.6)
      p.set(1, 2, '#ffffff', 0.6)
      return p
    }
    case 'spark': {
      const p = new Pix(5, 5)
      p.set(2, 2, '#ffffff')
      for (const [x, y] of [
        [2, 0],
        [2, 1],
        [2, 3],
        [2, 4],
        [0, 2],
        [1, 2],
        [3, 2],
        [4, 2],
      ])
        p.set(x, y, '#ffffff', Math.abs(x - 2) + Math.abs(y - 2) === 1 ? 0.9 : 0.45)
      return p
    }
    case 'smoke': {
      const p = new Pix(8, 8)
      p.ellipse(4, 4, 4, 4, (x, y, nx, ny) => {
        const d = nx * nx + ny * ny
        return d < 0.25 ? '#ffffff' : d < 0.6 ? '#e8e8ee' : '#c8c8d0'
      }, 0.55)
      p.ellipse(3.2, 3.2, 1.6, 1.6, '#ffffff', 0.35)
      return p
    }
    case 'flake': {
      const p = new Pix(5, 5)
      for (const [x, y] of [
        [2, 0],
        [2, 4],
        [0, 2],
        [4, 2],
        [1, 1],
        [3, 3],
        [1, 3],
        [3, 1],
      ])
        p.set(x, y, '#ffffff', 0.8)
      p.set(2, 2, '#ffffff')
      p.set(2, 1, '#e8f4ff')
      p.set(2, 3, '#e8f4ff')
      p.set(1, 2, '#e8f4ff')
      p.set(3, 2, '#e8f4ff')
      return p
    }
    case 'drop': {
      const p = new Pix(3, 5)
      p.set(1, 0, '#bfe4ff')
      p.set(1, 1, '#8cc8ff')
      p.rect(0, 2, 3, 2, '#5aa0f0')
      p.set(0, 2, '#bfe4ff')
      p.set(1, 4, '#3d7fd6')
      return p
    }
    case 'leaf': {
      const p = new Pix(6, 5)
      p.stamp(['...GL.', '.GGGL.', 'GgGGG.', 'gGgG..', 'g.....'], { G: '#6ab84a', L: '#9ad870', g: '#3f7a34' })
      return p
    }
    case 'ring': {
      const p = new Pix(8, 8)
      p.ellipse(4, 4, 4, 4, (x, y, nx, ny) => (nx * nx + ny * ny > 0.5 ? '#ffffff' : null))
      return p
    }
    case 'star': {
      const p = new Pix(7, 7)
      p.stamp(['...W...', '...W...', '..WWW..', 'WWWXWWW', '..WWW..', '...W...', '...W...'], { W: '#fff8d8', X: '#ffffff' })
      p.set(3, 0, '#fff8d8', 0.6)
      p.set(0, 3, '#fff8d8', 0.6)
      p.set(6, 3, '#fff8d8', 0.6)
      p.set(3, 6, '#fff8d8', 0.6)
      return p
    }
    default: {
      const p = new Pix(2, 2)
      p.rect(0, 0, 2, 2, '#ffffff')
      return p
    }
  }
}

export const PARTICLE_KEYS = ['dot', 'spark', 'smoke', 'flake', 'drop', 'leaf', 'ring', 'star']

export function particleSheet(): Sheet {
  return pack(
    PARTICLE_KEYS.map((name) => ({ name, pix: particle(name) })),
    PARTICLE_KEYS.length,
  )
}
