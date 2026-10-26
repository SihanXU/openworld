// The solids a building is modelled with (oblique.ts renders them): boxes, roofs, spires, towers, arches cut out of
// walls. Units are pixels, x east, y south, z up; a cell is 16 by 16 and a storey 16 high. A solid is its bounds and a
// test of whether a point is inside it; what it is made of (`mat`) says how it is drawn.

export type Bounds = [number, number, number, number, number, number]

export interface Solid {
  /** [x0, y0, z0, x1, y1, z1]: no point outside it is inside the solid. */
  b: Bounds
  inside(x: number, y: number, z: number): boolean
  /** The material its surface is drawn in (materials.ts), unless `paint` says otherwise for a point. */
  mat: string
  /** A material for a point of its surface (a band of moulding, a window's glass), if not `mat`. */
  paint?: (x: number, y: number, z: number) => string | undefined
  /** The material of its upright faces, if not `mat` (a roof's gable ends are wall, not slates). */
  side?: string
  /** No void cuts it (a door set at the back of a portal's recess). */
  uncut?: boolean
}

const within = (b: Bounds, x: number, y: number, z: number) => x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]

/** A box from (x0, y0, z0) to (x1, y1, z1). */
export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: string): Solid {
  const b: Bounds = [x0, y0, z0, x1, y1, z1]
  return { b, mat, inside: (x, y, z) => within(b, x, y, z) }
}

/**
 * A gable roof over the rectangle, its eaves at z0 and its ridge `rise` above them, the ridge along `along` ('y': the
 * ridge runs north–south, the slopes face west and east; 'x': it runs east–west, the slopes face south and north).
 * `over` lets the eaves hang past the walls.
 */
export function gable(x0: number, y0: number, x1: number, y1: number, z0: number, rise: number, along: 'x' | 'y', mat: string, side?: string): Solid {
  const b: Bounds = [x0, y0, z0, x1, y1, z0 + rise]
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const half = along === 'y' ? (x1 - x0) / 2 : (y1 - y0) / 2
  return {
    b,
    mat,
    side,
    inside: (x, y, z) => {
      if (!within(b, x, y, z)) return false
      const d = along === 'y' ? Math.abs(x - cx) : Math.abs(y - cy)
      return z - z0 <= rise * (1 - d / half)
    },
  }
}

/** A hipped roof: four slopes up to a ridge (or a point, when square). */
export function hip(x0: number, y0: number, x1: number, y1: number, z0: number, rise: number, mat: string): Solid {
  const b: Bounds = [x0, y0, z0, x1, y1, z0 + rise]
  const hw = (x1 - x0) / 2
  const hd = (y1 - y0) / 2
  const cx = x0 + hw
  const cy = y0 + hd
  const s = rise / Math.min(hw, hd)
  return { b, mat, inside: (x, y, z) => within(b, x, y, z) && z - z0 <= s * Math.min(hw - Math.abs(x - cx), hd - Math.abs(y - cy)) }
}

/** A lean-to roof against a wall: high at the side `high` faces, down to z0 at the other. */
export function leanTo(x0: number, y0: number, x1: number, y1: number, z0: number, rise: number, high: 'n' | 's' | 'e' | 'w', mat: string): Solid {
  const b: Bounds = [x0, y0, z0, x1, y1, z0 + rise]
  return {
    b,
    mat,
    inside: (x, y, z) => {
      if (!within(b, x, y, z)) return false
      const f = high === 'n' ? (y1 - y) / (y1 - y0) : high === 's' ? (y - y0) / (y1 - y0) : high === 'w' ? (x1 - x) / (x1 - x0) : (x - x0) / (x1 - x0)
      return z - z0 <= rise * f
    },
  }
}

/** A spire of `sides` faces (4 a pyramid, 8 an octagon, 0 a cone) on a base of radius r at z0, its point `rise` up. */
export function spire(cx: number, cy: number, r: number, z0: number, rise: number, sides: 0 | 4 | 8, mat: string): Solid {
  const b: Bounds = [cx - r, cy - r, z0, cx + r, cy + r, z0 + rise]
  return {
    b,
    mat,
    inside: (x, y, z) => {
      if (!within(b, x, y, z)) return false
      const dx = Math.abs(x - cx)
      const dy = Math.abs(y - cy)
      const d = sides === 0 ? Math.hypot(dx, dy) : sides === 4 ? Math.max(dx, dy) : Math.max(dx, dy, (dx + dy) / Math.SQRT2)
      return d <= r * (1 - (z - z0) / rise)
    },
  }
}

/** A round tower (or column), r about (cx, cy), from z0 to z1; `half` keeps only the half to the north or south. */
export function drum(cx: number, cy: number, r: number, z0: number, z1: number, mat: string, half?: 'n' | 's'): Solid {
  const b: Bounds = [cx - r, half === 's' ? cy : cy - r, z0, cx + r, half === 'n' ? cy : cy + r, z1]
  return { b, mat, inside: (x, y, z) => within(b, x, y, z) && Math.hypot(x - cx, y - cy) <= r }
}

/** An octagonal tower from z0 to z1. */
export function octagon(cx: number, cy: number, r: number, z0: number, z1: number, mat: string): Solid {
  const b: Bounds = [cx - r, cy - r, z0, cx + r, cy + r, z1]
  return {
    b,
    mat,
    inside: (x, y, z) => {
      if (!within(b, x, y, z)) return false
      const dx = Math.abs(x - cx)
      const dy = Math.abs(y - cy)
      return Math.max(dx, dy, (dx + dy) / Math.SQRT2) <= r
    },
  }
}

/** A half cone over a half drum: an apse's roof, its round side to the north or south. */
export function halfCone(cx: number, cy: number, r: number, z0: number, rise: number, half: 'n' | 's', mat: string): Solid {
  const b: Bounds = [cx - r, half === 's' ? cy : cy - r, z0, cx + r, half === 'n' ? cy : cy + r, z0 + rise]
  return { b, mat, inside: (x, y, z) => within(b, x, y, z) && Math.hypot(x - cx, y - cy) <= r * (1 - (z - z0) / rise) }
}

/**
 * The shape of an arch in a wall's face, as a test on (u, z): u across the opening from its middle, z up from its sill.
 * `pointed` a gothic arch (two arcs struck from the springing on the other side), `round` a semicircle, `flat` a
 * lintel.
 */
export type ArchKind = 'pointed' | 'round' | 'flat' | 'circle'
export function inArch(kind: ArchKind, w: number, h: number, u: number, z: number): boolean {
  const hw = w / 2
  if (Math.abs(u) > hw || z < 0) return false
  if (kind === 'flat') return z <= h
  if (kind === 'circle') return Math.hypot(u, z - h / 2) <= hw
  const spring = kind === 'round' ? h - hw : h - hw * 1.6
  if (z <= spring) return true
  if (kind === 'round') return Math.hypot(u, z - spring) <= hw
  // a pointed arch: arcs of radius 1.6·hw (a little sharper than equilateral) struck from across the opening
  const r = hw * 1.6
  const c = hw - r // the centre of the arc for the right half sits r in from the left jamb
  return Math.hypot(Math.abs(u) - c, z - spring) <= r && z - spring <= Math.sqrt(r * r - c * c) + 0.01
}

/**
 * An opening cut through a wall that faces south (or north): an arch of width w and height h, its middle at x = cx and
 * its sill at z0, through the wall from y0 to y1. A void: what it cuts is not there.
 */
export function archNS(cx: number, y0: number, y1: number, z0: number, w: number, h: number, kind: ArchKind): Solid {
  const b: Bounds = [cx - w / 2, y0, z0, cx + w / 2, y1, z0 + h]
  return { b, mat: 'void', inside: (x, y, z) => within(b, x, y, z) && inArch(kind, w, h, x - cx, z - z0) }
}

/**
 * A recess in a south face (a portal, a niche, a belfry's opening): `rings` arches one inside another, each smaller and
 * deeper than the last, as a cathedral's archivolts step in to the door — `depth` deep in all, its middle at cx, its
 * sill at z0. Voids; a door or a statue is set at its back (`backOf`).
 */
export function recess(cx: number, yFace: number, z0: number, w: number, h: number, depth: number, kind: ArchKind, rings = 1, step = 4): Solid[] {
  const out: Solid[] = []
  for (let k = 0; k < rings; k++) out.push(archNS(cx, yFace - (depth * (k + 1)) / rings, yFace + 1, z0, w - 2 * k * step, h - k * step, kind))
  return out
}
/** The plane at the back of a recess: where its door or statue stands. */
export const backOf = (yFace: number, depth: number) => yFace - depth

/** A door set at the back of a recess: a slab no void cuts, in an arch's shape. */
export function doorSlab(cx: number, y: number, z0: number, w: number, h: number, kind: ArchKind, mat = 'door'): Solid {
  const b: Bounds = [cx - w / 2, y - 2, z0, cx + w / 2, y + 1, z0 + h]
  return { b, mat, uncut: true, inside: (x, yy, z) => within(b, x, yy, z) && inArch(kind, w, h, x - cx, z - z0) }
}

/** The same through a wall that faces east or west: its middle at y = cy, through it from x0 to x1. */
export function archEW(cy: number, x0: number, x1: number, z0: number, w: number, h: number, kind: ArchKind): Solid {
  const b: Bounds = [x0, cy - w / 2, z0, x1, cy + w / 2, z0 + h]
  return { b, mat: 'void', inside: (x, y, z) => within(b, x, y, z) && inArch(kind, w, h, y - cy, z - z0) }
}

/**
 * A flying buttress: a sloping beam from the top of an outer pier at (xp, z1) to the clerestory wall at (xw, z2), its
 * thickness `t` north–south about y = cy, with an arch under it. Seen from the south it is a rising bar with a curve
 * under it.
 */
export function flyer(xp: number, xw: number, cy: number, t: number, z1: number, z2: number, depth: number, mat: string): Solid {
  const x0 = Math.min(xp, xw)
  const x1 = Math.max(xp, xw)
  const b: Bounds = [x0, cy - t / 2, z1 - depth - 12, x1, cy + t / 2, Math.max(z1, z2) + 1]
  return {
    b,
    mat,
    inside: (x, y, z) => {
      if (!within(b, x, y, z)) return false
      const f = (x - xp) / (xw - xp)
      const top = z1 + (z2 - z1) * f
      // the underside: a quarter arc sagging from the pier's face to the wall
      const under = top - depth - 10 * Math.sin(Math.PI * Math.min(1, Math.max(0, f)))
      return z <= top && z >= under
    },
  }
}

/** Battlements along the top of a wall: merlons `mw` wide with gaps `gw` between, along x or y, on a wall top at z0. */
export function merlons(x0: number, y0: number, x1: number, y1: number, z0: number, h: number, mw: number, gw: number, along: 'x' | 'y', mat: string): Solid {
  const b: Bounds = [x0, y0, z0, x1, y1, z0 + h]
  const p = mw + gw
  return {
    b,
    mat,
    inside: (x, y, z) => {
      if (!within(b, x, y, z)) return false
      const u = along === 'x' ? x - x0 : y - y0
      return ((u % p) + p) % p < mw
    },
  }
}

/** Merlons round a drum's rim. */
export function ringMerlons(cx: number, cy: number, r: number, t: number, z0: number, h: number, n: number, mat: string): Solid {
  const b: Bounds = [cx - r, cy - r, z0, cx + r, cy + r, z0 + h]
  return {
    b,
    mat,
    inside: (x, y, z) => {
      if (!within(b, x, y, z)) return false
      const d = Math.hypot(x - cx, y - cy)
      if (d > r || d < r - t) return false
      const a = (Math.atan2(y - cy, x - cx) / (Math.PI * 2) + 1) % 1
      return (a * n) % 1 < 0.55
    },
  }
}

/** A solid moved by (dx, dy, dz). */
export function moved(s: Solid, dx: number, dy: number, dz: number): Solid {
  const [x0, y0, z0, x1, y1, z1] = s.b
  return { ...s, b: [x0 + dx, y0 + dy, z0 + dz, x1 + dx, y1 + dy, z1 + dz], inside: (x, y, z) => s.inside(x - dx, y - dy, z - dz), paint: s.paint && ((x, y, z) => s.paint!(x - dx, y - dy, z - dz)) }
}

/** The same solid in another material, or painted by a function of the point. */
export function as(s: Solid, mat: string, paint?: Solid['paint']): Solid {
  return { ...s, mat, paint }
}
