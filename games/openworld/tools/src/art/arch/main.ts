// The project's buildings drawn (docs/showcase.md §3): every model rendered in the oblique view, cut into a strip a
// footprint row, the strips packed into one sheet a building (public/assets/lsw/Buildings/<name>.png), and what the
// catalogue and the map builder need of them written beside the catalogue (client/src/buildings.json): each strip's
// rectangle in the sheet, the cells it stands on, and the doors.
//
//   npx tsx games/openworld/tools/src/art/arch/main.ts [name …]

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writePng } from '../png.ts'
import { render, slices, T, type Model } from './oblique.ts'
import { MODELS, PROPS } from './buildings/index.ts'
import { INSIDE } from './buildings/inside.ts'

export interface BuildingSlice {
  row: number
  col: number
  tw: number
  th: number
  x: number
  y: number
  grid: string[]
}
export interface BuildingEntry {
  img: string
  w: number
  d: number
  slices: BuildingSlice[]
  /** The door cells, in the footprint, west to east and north to south. */
  doors: [number, number][]
  ground?: boolean
  terrain?: string
  /** Its shadow on the ground: its rectangle in the sheet (cells `tw` by `th`), laid `dx`, `dy` cells from the footprint's top-left. */
  shadow?: { x: number; y: number; tw: number; th: number; dx: number; dy: number }
  /** The cells north of the footprint its picture hides whole (row 0 the one just north of it): '#' hidden. */
  cover?: string[]
}

/** The cells north of the footprint the picture covers (each wholly opaque), nearest row first. */
function coverOf(r: ReturnType<typeof render>): string[] {
  const out: string[] = []
  for (let k = 1; k * T <= r.top; k++) {
    let line = ''
    for (let c = 0; c < r.w; c++) {
      let n = 0
      for (let py = r.top - k * T; py < r.top - (k - 1) * T; py++) for (let px = c * T; px < (c + 1) * T; px++) if (r.rgba[(py * r.pw + px) * 4 + 3] > 0) n++
      line += n === T * T ? '#' : ' '
    }
    if (!line.includes('#')) break
    out.push(line)
  }
  return out
}

const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), '../../../../client/src/buildings.json')

function build(m: Model, indoor: boolean): BuildingEntry {
  const r = render(m)
  const cut = slices(r, m.footprint)
  // (its shadow packed as one more strip; none for what stands indoors)
  const sh = indoor ? undefined : r.shadow
  if (sh) cut.push({ slice: { row: -1, col: sh.cx0, tw: sh.cw, th: sh.ch, ax: 0, ay: 0, grid: [] }, rgba: sh.rgba })
  // shelf-packed into a sheet a few strips wide
  const width = Math.max(...cut.map((c) => c.slice.tw)) * T * 2
  let x = 0
  let y = 0
  let shelf = 0
  const placed = cut.map((c) => {
    const w = c.slice.tw * T
    const h = c.slice.th * T
    if (x + w > width) (x = 0), (y += shelf), (shelf = 0)
    const at = { x, y }
    x += w
    shelf = Math.max(shelf, h)
    return at
  })
  const W = width
  const H = y + shelf
  const sheet = new Uint8Array(W * H * 4)
  cut.forEach((c, i) => {
    const w = c.slice.tw * T
    const h = c.slice.th * T
    for (let j = 0; j < h; j++) sheet.set(c.rgba.subarray(j * w * 4, (j + 1) * w * 4), ((placed[i].y + j) * W + placed[i].x) * 4)
  })
  const img = `lsw/Buildings/${m.name}.png`
  writePng(`Buildings/${m.name}.png`, W, H, sheet)
  const doors: [number, number][] = []
  m.footprint.forEach((row, y) => [...row].forEach((c, x) => c === 'D' && doors.push([x, y])))
  return {
    img,
    w: m.footprint[0].length,
    d: m.footprint.length,
    ...(m.ground && { ground: true }),
    ...(m.terrain && { terrain: m.terrain }),
    slices: cut.filter((c) => c.slice.row >= 0).map((c, i) => ({ row: c.slice.row, col: c.slice.col, tw: c.slice.tw, th: c.slice.th, x: placed[i].x, y: placed[i].y, grid: c.slice.grid })),
    doors,
    ...(!indoor && { cover: coverOf(r) }),
    ...(sh && { shadow: { x: placed[cut.length - 1].x, y: placed[cut.length - 1].y, tw: sh.cw, th: sh.ch, dx: sh.cx0, dy: sh.cy0 } }),
  }
}

/** A fixture's picture (catalog `fixture:<name>`): its rectangle in the props' sheet, its anchor on its own cell. */
export interface PropEntry {
  img: string
  x: number
  y: number
  w: number
  h: number
  ax: number
  ay: number
}

/** The furniture drawn whole, packed into one sheet (Buildings/props.png), each anchored on its footprint's own cell. */
function buildProps(): Record<string, PropEntry> {
  const done = Object.entries(PROPS).map(([name, make]) => {
    const m = make()
    const r = render(m)
    const w = m.footprint[0].length
    return { name, r, ax: (Math.floor(w / 2) + 0.5) * T, ay: r.ph }
  })
  const W = 512
  let x = 0
  let y = 0
  let shelf = 0
  const at = done.map((d) => {
    if (x + d.r.pw > W) (x = 0), (y += shelf), (shelf = 0)
    const p = { x, y }
    x += d.r.pw
    shelf = Math.max(shelf, d.r.ph)
    return p
  })
  const H = y + shelf
  const sheet = new Uint8Array(W * H * 4)
  done.forEach((d, i) => {
    for (let j = 0; j < d.r.ph; j++) sheet.set(d.r.rgba.subarray(j * d.r.pw * 4, (j + 1) * d.r.pw * 4), ((at[i].y + j) * W + at[i].x) * 4)
  })
  writePng('Buildings/props.png', W, H, sheet)
  return Object.fromEntries(done.map((d, i) => [d.name, { img: 'lsw/Buildings/props.png', x: at[i].x, y: at[i].y, w: d.r.pw, h: d.r.ph, ax: d.ax, ay: d.ay }]))
}

const only = process.argv.slice(2)
const saved = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
const manifest: Record<string, BuildingEntry> = saved.buildings ?? {}
for (const [name, make] of Object.entries(MODELS)) {
  if (only.length && !only.includes(name)) continue
  const t = Date.now()
  const m = make()
  if (m.name !== name) throw new Error(`model ${name} names itself ${m.name}`)
  manifest[name] = build(m, name in INSIDE)
  console.log(`${name}: ${manifest[name].slices.length} strips, ${Date.now() - t} ms`)
}
for (const name of Object.keys(manifest)) if (!MODELS[name]) delete manifest[name]
const props = !only.length || only.includes('props') ? buildProps() : saved.props ?? {}
writeFileSync(MANIFEST, JSON.stringify({ buildings: Object.fromEntries(Object.entries(manifest).sort()), props }, null, 1) + '\n')
