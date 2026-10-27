// The walls of the showcase's halls (docs/showcase.md §3.6; the user's word of 2026-10-26: "内饰怎么全是方块"): each hall
// from its plan (plans.ts HALLS) as the nave is (shell.ts), every step of its walls a face, and every face dressed by the
// hall's style — its windows, what hangs between them (tapestries, banners, paintings, shelves of books and of jars,
// a trophy of arms, niches of bones), pilasters, sconces, and on the face at its head the hall's own feature: a great
// hearth, a canopy over a dais, a window of glass, the bells' frame, a wall of books.

import type { Model, Ornament } from '../oblique.ts'
import { archNS, backOf, box, recess, type Solid } from '../shapes.ts'
import { banner, door, lancet, picture, sconce, statue, window, type Glass } from '../ornaments.ts'
import { shell, type Dress, type Face } from '../shell.ts'
import { HALLS, type HallPlan } from '../plans.ts'
import { S } from '../kit.ts'
import { hash } from '../materials.ts'
import { fire, skulls, tapestry } from './inside.ts'

type Hang = 'tapestry' | 'banner' | 'painting' | 'shelves' | 'books' | 'jars' | 'trophy' | 'niches' | 'timbers' | 'veins' | 'tools' | 'crystals' | 'none'

interface Style {
  wall: string
  trim: string
  h: number
  windows: 'lancet' | 'round' | 'rect' | 'none'
  glass?: Glass
  /** What hangs between the windows, by turns. */
  hang: Hang[]
  /** The head face's feature. */
  feature: 'hearth' | 'canopy' | 'window' | 'books' | 'ossuary' | 'gate' | 'none'
  pilasters?: string
}

/** A painting in its gilt frame: a landscape or a saint, by its seed. */
function painting(w: number, h: number, seed: number): Ornament[] {
  const rows: string[] = []
  const saint = hash(seed, 1) < 0.4
  for (let j = 0; j < h; j++) {
    let l = ''
    for (let i = 0; i < w; i++) {
      if (i < 2 || j < 2 || i >= w - 2 || j >= h - 2) l += (i + j) % 3 ? 'a' : 'A'
      else if (saint) l += Math.hypot(i - w / 2, j - h * 0.35) < w * 0.16 ? 'y' : Math.abs(i - w / 2) < w * 0.22 && j > h * 0.42 ? 'r' : j < h / 2 ? 'b' : 'B'
      else l += j < h * 0.45 ? (Math.hypot(i - w * 0.7, j - h * 0.25) < 2.5 ? 'y' : 's') : j < h * 0.65 ? (hash(i, j, seed) < 0.5 ? 'g' : 'G') : 'G'
    }
    rows.push(l)
  }
  return [{ x: 0, y: 0, z: 0, rows, keys: { a: 'a1', A: 'a2', y: 'Y0', r: 'E2', b: 'B2', B: 'B3', s: 'q1', g: 'V1', G: 'V2' } }]
}

/** Shelves of books up a wall: boards and the books' spines, many colours, a few leaning. */
function books(w: number, h: number, seed: number) {
  const p: string[] = []
  const COL = 'rRbBgGyYuUpk'
  for (let j = 0; j < h; j++) {
    let l = ''
    for (let i = 0; i < w; i++) {
      if (i === 0 || i === w - 1 || j % 9 === 8 || j === 0) l += 'w'
      else {
        const book = Math.floor(i / 2)
        const shelf = Math.floor(j / 9)
        l += hash(book, shelf, seed) < 0.08 ? ' ' : COL[Math.floor(hash(book, shelf, seed + 1) * COL.length)]
      }
    }
    p.push(l)
  }
  return { rows: p, keys: { w: 'w3', r: 'E1', R: 'E2', b: 'B1', B: 'B2', g: 'V1', G: 'V2', y: 'Y1', Y: 'a2', u: 'U1', U: 'U2', p: 'cw1', k: 'n2' } }
}

/** A shelf of jars and pots on brackets (a kitchen's, a cellar's). */
function jars(w: number, seed: number) {
  const p: string[] = []
  for (let j = 0; j < 10; j++) {
    let l = ''
    for (let i = 0; i < w; i++) {
      if (j === 9 || j === 4) l += 'w'
      else {
        const k = Math.floor(i / 4)
        const top = j < 4 ? 0 : 5
        const hh = 1 + Math.floor(hash(k, top, seed) * 3)
        l += (j - top) >= 4 - hh && i % 4 !== 3 ? (hash(k, top, seed + 2) < 0.5 ? 't' : hash(k, top, seed + 3) < 0.5 ? 'c' : 'g') : ' '
      }
    }
    p.push(l)
  }
  return { rows: p, keys: { w: 'w2', t: 't2', c: 'cw1', g: 'V2' } }
}

/** A trophy of arms: a shield of the garrison's colours, two swords crossed behind it. */
function trophy() {
  return picture(['i          i', ' i        i ', '  i aaaa i  ', '   iUUUUi   ', '   aUyyUa   ', '   aUyyUa   ', '   aUUUUa   ', '  i aUUa i  ', ' i   aa   i ', 'i          i'], { i: 'i1', a: 'a2', U: 'U1', y: 'a0' })
}

/** Ore in a face of rock: a band of glints, copper and iron and a little gold, along the seam. */
function veins(w: number, h: number, seed: number) {
  const rows: string[] = []
  for (let j = 0; j < h; j++) {
    let l = ''
    for (let i = 0; i < w; i++) {
      const band = Math.abs(j - h / 2 - (i - w / 2) * 0.45 - Math.sin(i / 4 + seed) * 2) < 3
      const r = hash(i, j, seed + 900)
      l += band && r < 0.35 ? (r < 0.06 ? 'a' : r < 0.2 ? 'c' : 'i') : r < 0.02 ? 'i' : ' '
    }
    rows.push(l)
  }
  return { rows, keys: { a: 'a1', c: 'c1', i: 'i0' } }
}

/** A farm's tools hung on the wall: a scythe, a rake, a pitchfork, a saw, a coil of rope. */
function tools() {
  return picture(
    [
      'wwwwwwwwwwwwwwwwwwwwwwww',
      ' i     w     i i i   ww ',
      ' ii    w     i i i  w  w',
      '  i    w     iiiii  w  w',
      '  w   www      w     ww ',
      '  w  w w w     w        ',
      '  w    w       w   iiii ',
      '  w    w       w   iiii ',
      '  w    w       w   iiii ',
      '  w    w       w   iiii ',
      '  w    w       w     w  ',
      '  w    w       w     w  ',
    ],
    { w: 'w2', i: 'i1' },
  )
}

/** A face's dressing by its hall's style: windows and hangings by turns, pilasters, sconces; the head face's feature. */
function dresser(st: Style, plan: HallPlan): (f: Face) => Dress {
  const head = Math.min(...plan.plan.map((row, y) => (row.includes('.') ? y : Infinity))) - 1
  return (f) => {
    const y = (f.y + 1) * S
    const len = f.x1 - f.x0 + 1
    const x0 = f.x0 * S
    const x1 = (f.x1 + 1) * S
    const mid = (x0 + x1) / 2
    const h = len <= 2 ? Math.round(st.h * 0.8) : st.h
    const solids: Solid[] = []
    const voids: Solid[] = []
    const orn: Ornament[] = []
    const seed = f.x0 * 31 + f.y * 7
    // the pilasters between the bays, a string course
    if (st.pilasters && len > 3) for (let x = f.x0; x <= f.x1 + 1; x += 3) {
      const px = Math.min(x, f.x1 + 1) * S
      solids.push(box(px - 3, y - 2, 0, px + 3, y + 3, h - 4, st.pilasters))
    }
    if (len > 2) solids.push(box(x0, y - 2, Math.round(h * 0.42), x1, y + 2, Math.round(h * 0.42) + 3, st.trim))
    const hangAt = (kind: Hang, cx: number, k: number) => {
      if (kind === 'tapestry') orn.push(tapestry(20, Math.round(h * 0.34), seed + k).at(cx - 10, y, 10))
      else if (kind === 'banner') orn.push(banner(10, Math.round(h * 0.3), k % 2 ? 'U' : 'E').at(cx - 5, y, Math.round(h * 0.2)))
      else if (kind === 'painting') orn.push(...painting(18, 14, seed + k).map((o) => ({ ...o, x: cx - 9, y, z: 18 })))
      else if (kind === 'books' || kind === 'shelves') {
        const bk = books(28, Math.min(46, Math.round(h * 0.4)), seed + k)
        orn.push({ x: cx - 14, y, z: 2, ...bk })
      } else if (kind === 'jars') orn.push({ x: cx - 12, y, z: 14, ...jars(24, seed + k) })
      else if (kind === 'trophy') orn.push(trophy().at(cx - 6, y, 22))
      else if (kind === 'tools') orn.push(tools().at(cx - 12, y, 14))
      else if (kind === 'crystals') {
        // crystals grown out of the rock's face, lit from within, and the ice they glaze it with
        const rows: string[] = []
        for (let j = 0; j < 26; j++) rows.push(Array.from({ length: 22 }, (_, i) => { const t = 25 - j; const spike = [3, 8, 12, 17].some((sx, n) => Math.abs(i - sx) <= Math.max(0, (8 + n * 3 + (seed % 5) - t) / 4) && t < 8 + n * 3 + (seed % 5)); return spike ? (hash(i, j, seed) < 0.3 ? 'w' : i % 2 ? 'b' : 'u') : ' ' }).join(''))
        orn.push({ x: cx - 11, y, z: Math.round(h * 0.05), rows, keys: { b: 'B0', u: 'U0', w: 'cw0' } })
      }
      else if (kind === 'veins') orn.push({ x: cx - 12, y, z: Math.round(h * 0.15), ...veins(24, Math.round(h * 0.5), seed + k) })
      else if (kind === 'timbers') {
        // a set of timbers against the rock: two props, the cap over them, a lantern hung from it
        const t = Math.round(h * 0.72)
        solids.push(box(cx - 13, y - 3, 0, cx - 9, y + 2, t, 'timber'), box(cx + 9, y - 3, 0, cx + 13, y + 2, t, 'timber'), box(cx - 16, y - 3, t, cx + 16, y + 2, t + 5, 'timber'))
        if (k % 2 === 0) orn.push(sconce().at(cx - 3, y + 2, t - 14))
      }
      else if (kind === 'niches') {
        voids.push(...recess(cx, y, 8, 14, 20, 5, 'round'))
        orn.push(skulls(10).at(cx - 5, backOf(y, 5), 9))
      }
    }
    // the head face: the hall's feature in its middle
    const featureHere = f.y === head && len >= 4 && st.feature !== 'none'
    if (featureHere) {
      if (st.feature === 'hearth') {
        solids.push(box(mid - 30, y, 0, mid + 30, y + 10, 50, st.trim), box(mid - 24, y, 50, mid + 24, y + 6, h, st.wall), box(mid - 32, y, 48, mid + 32, y + 12, 54, st.trim))
        voids.push(archNS(mid, y + 2, y + 11, 0, 40, 32, 'flat'))
        orn.push(fire(34).at(mid - 17, y + 3, 0))
        orn.push(trophy().at(mid - 6, y + 6, 66))
      } else if (st.feature === 'canopy') {
        // a cloth of estate over the dais: crimson, fringed, a gilt valance, the arms on it
        const rows: string[] = []
        for (let j = 0; j < Math.round(h * 0.55); j++) rows.push(Array.from({ length: 40 }, (_, i) => (j < 4 ? (i % 4 < 2 ? 'a' : 'A') : i === 0 || i === 39 ? 'a' : Math.hypot(i - 20, j - 18) < 6 ? 'y' : (i + j) % 7 ? 'r' : 'R')).join(''))
        orn.push({ x: mid - 20, y, z: 8, rows, keys: { a: 'a1', A: 'a2', r: 'E2', R: 'E3', y: 'a0' } })
        for (const k of [-1, 1]) orn.push(banner(10, 40, 'U').at(mid + k * 34 - 5, y, 14))
      } else if (st.feature === 'window') {
        voids.push(...recess(mid, y, Math.round(h * 0.3), 30, Math.round(h * 0.6), 5, 'pointed', 2, 3))
        orn.push(lancet(22, Math.round(h * 0.6) - 4, st.glass ?? 'blue', 3).at(mid - 11, y - 5, Math.round(h * 0.3)))
        for (const k of [-1, 1]) orn.push(statue(10, 30, true).at(mid + k * 30 - 5, y, 6))
      } else if (st.feature === 'books') {
        for (let x = x0 + 4; x < x1 - 30; x += 32) orn.push({ x, y, z: 2, ...books(30, Math.round(h * 0.7), seed + x) })
      } else if (st.feature === 'gate') {
        // the sealed gate of the old works: its arch in rings, the iron door shut, a guardian either side
        const gh = Math.round(h * 0.62)
        voids.push(...recess(mid, y, 0, 40, gh, 6, 'round', 3, 3))
        orn.push(door(32, gh - 6, 'round', 'g').at(mid - 16, backOf(y, 6) - 1, 0))
        for (const k of [-1, 1]) orn.push(statue(12, 46).at(mid + k * 34 - 6, y, 4))
        solids.push(box(mid - 44, y - 2, gh + 10, mid + 44, y + 3, gh + 16, st.trim))
      } else if (st.feature === 'ossuary') {
        for (let x = x0 + 12; x < x1 - 12; x += 16) {
          voids.push(...recess(x, y, 6, 12, 18, 5, 'round'), ...recess(x, y, 30, 12, 16, 5, 'round'))
          orn.push(skulls(10).at(x - 5, backOf(y, 5), 7), skulls(10).at(x - 5, backOf(y, 5), 31))
        }
      }
    }
    // the bays along the face: a window high, a hanging under it, a sconce between
    let k = 0
    for (let c = f.x0; c <= f.x1; c += 2) {
      const cx = c * S + (len % 2 ? S / 2 : S)
      if (cx > x1 - 8) continue
      if (featureHere && Math.abs(cx - mid) < 44) continue
      if (st.windows !== 'none' && len >= 2) {
        const wz = Math.round(h * 0.5)
        if (st.windows === 'lancet') {
          voids.push(...recess(cx, y, wz, 12, Math.round(h * 0.38), 4, 'pointed', 2, 2))
          orn.push(lancet(8, Math.round(h * 0.38) - 2, st.glass ?? 'blue', 1).at(cx - 4, backOf(y, 4), wz))
        } else if (st.windows === 'round') {
          voids.push(...recess(cx, y, wz, 12, Math.round(h * 0.3), 4, 'round'))
          orn.push(window(8, Math.round(h * 0.28), false, hash(seed, c) < 0.3).at(cx - 4, backOf(y, 4), wz))
        } else orn.push(window(10, 14, true, hash(seed, c) < 0.3).at(cx - 7, y, wz))
      }
      hangAt(st.hang[(k + Math.floor(seed / 7)) % st.hang.length], cx, k)
      if (k % 2 && cx + S < x1) orn.push(sconce().at(cx + S - 3, y, Math.round(h * 0.36)))
      k++
    }
    return { h, solids, voids, ornaments: orn }
  }
}

const STYLES: Record<keyof typeof HALLS, Style> = {
  crypt: { wall: 'stone', trim: 'stone', h: 64, windows: 'none', hang: ['niches', 'niches', 'none'], feature: 'ossuary', pilasters: 'stone' },
  belfry: { wall: 'stone', trim: 'stone', h: 96, windows: 'lancet', glass: 'blue', hang: ['none', 'banner'], feature: 'window' },
  library: { wall: 'stone', trim: 'timber', h: 112, windows: 'lancet', glass: 'gold', hang: ['books', 'books', 'painting'], feature: 'books', pilasters: 'timber' },
  refectory: { wall: 'stone', trim: 'stone', h: 96, windows: 'lancet', glass: 'blue', hang: ['painting', 'tapestry', 'jars'], feature: 'window', pilasters: 'stone' },
  greathall: { wall: 'granite', trim: 'granite', h: 128, windows: 'round', hang: ['tapestry', 'trophy', 'banner'], feature: 'hearth', pilasters: 'granite' },
  solar: { wall: 'plasterWhite', trim: 'timber', h: 96, windows: 'round', hang: ['painting', 'tapestry', 'books'], feature: 'hearth', pilasters: 'timber' },
  council: { wall: 'stone', trim: 'stone', h: 120, windows: 'lancet', glass: 'red', hang: ['banner', 'painting', 'tapestry'], feature: 'canopy', pilasters: 'stone' },
  markethall: { wall: 'stone', trim: 'timber', h: 88, windows: 'round', hang: ['jars', 'banner', 'shelves'], feature: 'window', pilasters: 'timber' },
  inn: { wall: 'plasterOchre', trim: 'timber', h: 80, windows: 'rect', hang: ['painting', 'jars', 'trophy'], feature: 'hearth', pilasters: 'timber' },
  tavern: { wall: 'plaster', trim: 'timber', h: 72, windows: 'rect', hang: ['jars', 'painting', 'none'], feature: 'hearth', pilasters: 'timber' },
  seatavern: { wall: 'darkwood', trim: 'timber', h: 72, windows: 'rect', hang: ['trophy', 'jars', 'painting'], feature: 'hearth', pilasters: 'timber' },
  boathouse: { wall: 'darkwood', trim: 'timber', h: 104, windows: 'round', glass: 'blue', hang: ['trophy', 'none', 'jars'], feature: 'window', pilasters: 'timber' },
  longhall: { wall: 'darkwood', trim: 'timber', h: 120, windows: 'none', hang: ['trophy', 'tapestry', 'banner'], feature: 'hearth', pilasters: 'timber' },
  warhall: { wall: 'sandstone', trim: 'darkwood', h: 120, windows: 'round', hang: ['banner', 'trophy', 'tapestry'], feature: 'canopy', pilasters: 'sandstone' },
  armoury: { wall: 'sandstoneRough', trim: 'darkwood', h: 88, windows: 'rect', hang: ['trophy', 'trophy', 'shelves'], feature: 'hearth' },
  hospital: { wall: 'plasterRed', trim: 'timber', h: 80, windows: 'round', glass: 'red', hang: ['jars', 'none', 'shelves'], feature: 'window' },
  counting: { wall: 'plasterWhite', trim: 'timber', h: 104, windows: 'round', hang: ['shelves', 'painting', 'books'], feature: 'books', pilasters: 'timber' },
  granary: { wall: 'timber', trim: 'darkwood', h: 112, windows: 'none', hang: ['none', 'shelves', 'none'], feature: 'none', pilasters: 'darkwood' },
  poorhouse: { wall: 'plaster', trim: 'timber', h: 72, windows: 'rect', hang: ['none', 'jars', 'none'], feature: 'hearth' },
  ossuary: { wall: 'stone', trim: 'stone', h: 80, windows: 'none', hang: ['niches', 'niches', 'niches'], feature: 'ossuary', pilasters: 'stone' },
  healer: { wall: 'darkwood', trim: 'timber', h: 64, windows: 'rect', hang: ['jars', 'jars', 'shelves'], feature: 'hearth' },
  stiltinn: { wall: 'darkwood', trim: 'timber', h: 72, windows: 'rect', hang: ['jars', 'painting', 'trophy'], feature: 'hearth', pilasters: 'timber' },
  chapel: { wall: 'whiteStone', trim: 'whiteStone', h: 120, windows: 'lancet', glass: 'gold', hang: ['tapestry', 'painting', 'banner'], feature: 'window', pilasters: 'whiteStone' },
  barn: { wall: 'timber', trim: 'darkwood', h: 104, windows: 'none', hang: ['tools', 'none', 'none'], feature: 'none', pilasters: 'darkwood' },
  farmhouse: { wall: 'plasterOchre', trim: 'timber', h: 80, windows: 'rect', hang: ['jars', 'tools', 'painting'], feature: 'hearth', pilasters: 'timber' },
  mill: { wall: 'stone', trim: 'timber', h: 96, windows: 'round', hang: ['none', 'tools', 'shelves'], feature: 'none', pilasters: 'timber' },
  workings: { wall: 'sandstoneRough', trim: 'timber', h: 64, windows: 'none', hang: ['timbers', 'veins', 'timbers', 'none'], feature: 'none' },
  oldworks: { wall: 'sandstone', trim: 'sandstone', h: 112, windows: 'none', hang: ['niches', 'veins', 'trophy', 'none'], feature: 'gate', pilasters: 'sandstone' },
  manorhall: { wall: 'plasterWhite', trim: 'darkwood', h: 120, windows: 'rect', hang: ['painting', 'tapestry', 'trophy'], feature: 'hearth', pilasters: 'darkwood' },
  gallery: { wall: 'plasterRose', trim: 'timber', h: 96, windows: 'round', hang: ['painting', 'painting', 'books'], feature: 'window', glass: 'gold', pilasters: 'timber' },
  cellar: { wall: 'stone', trim: 'timber', h: 72, windows: 'none', hang: ['jars', 'shelves', 'none'], feature: 'hearth' },
  undercroft: { wall: 'graniteRough', trim: 'graniteRough', h: 64, windows: 'none', hang: ['niches', 'none', 'niches'], feature: 'ossuary', pilasters: 'graniteRough' },
  drowned: { wall: 'graniteRough', trim: 'graniteRough', h: 64, windows: 'none', hang: ['niches', 'veins', 'none'], feature: 'none', pilasters: 'graniteRough' },
  icecave: { wall: 'iceRock', trim: 'iceRock', h: 80, windows: 'none', hang: ['crystals', 'none', 'veins', 'crystals', 'none'], feature: 'none' },
  icelake: { wall: 'iceRock', trim: 'iceRock', h: 88, windows: 'none', hang: ['crystals', 'none', 'crystals', 'none'], feature: 'none' },
  towerhall: { wall: 'stone', trim: 'darkwood', h: 104, windows: 'lancet', glass: 'violet', hang: ['books', 'books', 'painting'], feature: 'books', pilasters: 'darkwood' },
  alchemy: { wall: 'stone', trim: 'darkwood', h: 96, windows: 'lancet', glass: 'green', hang: ['jars', 'jars', 'shelves'], feature: 'hearth', pilasters: 'darkwood' },
  observatory: { wall: 'stone', trim: 'darkwood', h: 112, windows: 'lancet', glass: 'blue', hang: ['painting', 'books', 'none'], feature: 'window', pilasters: 'darkwood' },
  towercellar: { wall: 'graniteRough', trim: 'graniteRough', h: 64, windows: 'none', hang: ['niches', 'jars', 'none'], feature: 'none' },
  chieflodge: { wall: 'darkwood', trim: 'timber', h: 72, windows: 'rect', hang: ['trophy', 'banner', 'none'], feature: 'hearth' },
  burrow: { wall: 'sandstoneRough', trim: 'timber', h: 64, windows: 'none', hang: ['timbers', 'none', 'veins'], feature: 'none' },
  garrison: { wall: 'granite', trim: 'darkwood', h: 96, windows: 'round', hang: ['trophy', 'banner', 'none'], feature: 'hearth', pilasters: 'granite' },
  flcook: { wall: 'plasterOchre', trim: 'timber', h: 72, windows: 'rect', hang: ['painting', 'jars', 'none'], feature: 'hearth', pilasters: 'timber' },
  flwatch: { wall: 'stone', trim: 'timber', h: 72, windows: 'rect', hang: ['trophy', 'banner', 'none'], feature: 'hearth', pilasters: 'timber' },
  flelder: { wall: 'plasterWhite', trim: 'darkwood', h: 80, windows: 'rect', hang: ['books', 'painting', 'books'], feature: 'books', pilasters: 'darkwood' },
  flwood: { wall: 'darkwood', trim: 'timber', h: 72, windows: 'rect', hang: ['tools', 'none', 'jars'], feature: 'hearth' },
  fllane: { wall: 'plaster', trim: 'timber', h: 72, windows: 'rect', hang: ['tools', 'shelves', 'none'], feature: 'none', pilasters: 'timber' },
  flcabin: { wall: 'timber', trim: 'darkwood', h: 64, windows: 'rect', hang: ['jars', 'none'], feature: 'hearth' },
  flstore: { wall: 'plaster', trim: 'timber', h: 72, windows: 'rect', hang: ['shelves', 'jars', 'shelves'], feature: 'none', pilasters: 'timber' },
  flsmithy: { wall: 'stone', trim: 'darkwood', h: 80, windows: 'rect', hang: ['trophy', 'tools', 'none'], feature: 'hearth', pilasters: 'darkwood' },
  flchurch: { wall: 'stone', trim: 'stone', h: 104, windows: 'lancet', glass: 'blue', hang: ['tapestry', 'banner', 'painting'], feature: 'window', pilasters: 'stone' },
  catacombs: { wall: 'whiteStone', trim: 'whiteStone', h: 64, windows: 'none', hang: ['niches', 'niches', 'none'], feature: 'ossuary', pilasters: 'whiteStone' },
}

/** Every hall's walls, `<hall>_shell`. */
export const HALL_SHELLS: Record<string, () => Model> = Object.fromEntries(
  (Object.keys(HALLS) as (keyof typeof HALLS)[]).map((k) => [`${k}_shell`, () => shell({ name: `${k}_shell`, plan: HALLS[k].plan, h: STYLES[k].h, wall: STYLES[k].wall, trim: STYLES[k].trim, dress: dresser(STYLES[k], HALLS[k]) })]),
)
