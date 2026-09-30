// Standalone art preview: renders every terrain variant, a crowd of characters, every
// creature x variant, every fixture state, every item icon, overlays, particles, and a small
// composed scene so the whole set can be eyeballed together.

import { PERSON_ROLES, TERRAINS } from '../../../content/src/ontology.ts'
import { FORMS, MATERIALS } from '../../../content/src/items.ts'
import {
  CLOTH_COLORS,
  FIXTURE_KEYS,
  HAIR_COLORS,
  HAIR_STYLE_COUNT,
  OVERLAY_KEYS,
  SKIN_TONES,
  characterSheet,
  creatureSheet,
  fixtureSheet,
  iconSheet,
  overlaySheet,
  particleSheet,
  terrainSheet,
  type Sheet,
} from './index.ts'

// URL options: ?z=6 (zoom), ?only=Terrain (section title prefix), ?still (no animation)
const params = new URLSearchParams(location.search)
const Z = Number(params.get('z') ?? 3) || 3
const ONLY = (params.get('only') ?? '').toLowerCase()
const root = document.getElementById('root')!

function section(title: string, note?: string): HTMLElement {
  if (ONLY && !title.toLowerCase().startsWith(ONLY)) return document.createElement('div')
  const h = document.createElement('h2')
  h.textContent = title
  root.appendChild(h)
  if (note) {
    const n = document.createElement('div')
    n.className = 'note'
    n.textContent = note
    root.appendChild(n)
  }
  const g = document.createElement('div')
  g.className = 'grid'
  root.appendChild(g)
  return g
}

function frameCanvas(sheet: Sheet, name: string, z = Z, bg?: string): HTMLCanvasElement {
  const f = sheet.frames.find((x) => x.name === name)!
  const c = document.createElement('canvas')
  c.width = f.w * z
  c.height = f.h * z
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.drawImage(sheet.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w * z, f.h * z)
  return c
}

function cell(parent: HTMLElement, label: string, canvases: HTMLCanvasElement[], checker = true): HTMLElement {
  const d = document.createElement('div')
  d.className = 'cell'
  const fr = document.createElement('div')
  fr.className = 'frames'
  for (const c of canvases) {
    if (checker) c.classList.add('checker')
    fr.appendChild(c)
  }
  d.appendChild(fr)
  const l = document.createElement('div')
  l.className = 'label'
  l.textContent = label
  d.appendChild(l)
  parent.appendChild(d)
  return d
}

/** Animate a set of canvases cycling through frames. */
const animators: (() => void)[] = []
function animated(sheet: Sheet, names: string[], z = Z): HTMLCanvasElement {
  const f0 = sheet.frames.find((x) => x.name === names[0])!
  const c = document.createElement('canvas')
  c.width = f0.w * z
  c.height = f0.h * z
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  let i = 0
  const draw = () => {
    const f = sheet.frames.find((x) => x.name === names[i % names.length])!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(sheet.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w * z, f.h * z)
    i++
  }
  draw()
  animators.push(draw)
  return c
}
if (!params.has('still')) setInterval(() => animators.forEach((a) => a()), 220)

// deterministic pseudo-random for the preview itself
let seed = 12345
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const ri = (n: number) => Math.floor(rand() * n)

// ---------------------------------------------------------------------------------------
// 0. Composed scene

const terr = terrainSheet(TERRAINS.map((t) => ({ id: t.id, color: t.color, tags: t.tags })))
{
  const g = section('Scene mock-up', 'A small hand-placed map mixing terrain, fixtures, NPCs and creatures (2×).')
  const W = 30
  const H = 18
  const map: string[][] = []
  for (let y = 0; y < H; y++) {
    map.push([])
    for (let x = 0; x < W; x++) map[y].push('grass')
  }
  const fill = (x0: number, y0: number, x1: number, y1: number, t: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (map[y]?.[x]) map[y][x] = t
  }
  // forest top-left, pines top-right
  fill(0, 0, 7, 4, 'tree')
  fill(0, 5, 3, 7, 'tree')
  fill(22, 0, 29, 3, 'pine')
  fill(24, 4, 29, 5, 'pine')
  fill(20, 0, 21, 2, 'snow')
  // river with bridge
  fill(12, 0, 14, 17, 'water')
  fill(13, 0, 13, 17, 'deepwater')
  fill(11, 0, 11, 17, 'sand')
  fill(15, 0, 15, 17, 'sand')
  fill(11, 9, 15, 10, 'bridge')
  // path
  fill(0, 9, 29, 10, 'path')
  fill(11, 9, 15, 10, 'bridge')
  // house: roof, walls, door
  fill(3, 11, 9, 12, 'roof')
  fill(3, 13, 9, 14, 'wall')
  map[14][6] = 'door'
  fill(3, 15, 9, 17, 'floor_wood')
  fill(5, 16, 7, 16, 'carpet')
  // town square cobble + flowers + dirt/farm
  fill(17, 11, 24, 17, 'cobble')
  fill(25, 11, 29, 14, 'farmland')
  fill(25, 15, 29, 17, 'drygrass')
  fill(16, 4, 19, 7, 'flowers')
  fill(8, 5, 10, 7, 'dirt')
  map[6][9] = 'rock'
  map[5][18] = 'bush'
  map[3][9] = 'stump'
  fill(0, 11, 1, 17, 'gravel')
  map[15][1] = 'mud'
  map[16][1] = 'mud'
  // lava/ash corner
  fill(26, 6, 29, 8, 'ash')
  map[7][28] = 'lava'
  map[7][29] = 'lava'
  map[6][27] = 'charred_tree'

  const T = 16
  const Zs = Number(params.get('sz') ?? 2) || 2
  const c = document.createElement('canvas')
  c.id = 'scene'
  c.width = W * T * Zs
  c.height = H * T * Zs
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const tile = (name: string, x: number, y: number) => {
    const f = terr.frames.find((q) => q.name === name)
    if (f) ctx.drawImage(terr.canvas, f.x, f.y, 16, 16, x * T * Zs, y * T * Zs, T * Zs, T * Zs)
  }
  const hash = (x: number, y: number) => {
    let h = (x * 73856093) ^ (y * 19349663)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h ^ (h >>> 16)) >>> 0
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tile(`${map[y][x]}#${hash(x, y) % (terr.variants[map[y][x]] ?? 1)}`, x, y)

  const sprite = (s: Sheet, name: string, tx: number, ty: number) => {
    const f = s.frames.find((q) => q.name === name)!
    ctx.drawImage(s.canvas, f.x, f.y, f.w, f.h, tx * T * Zs, (ty * T + T - f.h) * Zs, f.w * Zs, f.h * Zs)
  }
  // fixtures
  sprite(fixtureSheet('fixture:well'), 'base', 20, 13)
  sprite(fixtureSheet('fixture:lamppost'), 'lit', 17, 11)
  sprite(fixtureSheet('fixture:lamppost'), 'base', 24, 11)
  sprite(fixtureSheet('fixture:stall'), 'base', 22, 16)
  sprite(fixtureSheet('fixture:stall'), 'base', 23, 16)
  sprite(fixtureSheet('fixture:barrel'), 'base', 18, 16)
  sprite(fixtureSheet('fixture:crate'), 'base', 19, 16)
  sprite(fixtureSheet('fixture:campfire'), 'lit', 9, 7)
  sprite(fixtureSheet('fixture:sign'), 'base', 10, 8)
  sprite(fixtureSheet('fixture:chest'), 'base', 4, 15)
  sprite(fixtureSheet('fixture:bed'), 'base', 8, 15)
  sprite(fixtureSheet('fixture:table'), 'base', 6, 17)
  sprite(fixtureSheet('fixture:bookshelf'), 'base', 3, 16)
  sprite(fixtureSheet('fixture:haystack'), 'base', 27, 16)
  sprite(fixtureSheet('fixture:fence'), 'base', 25, 15)
  sprite(fixtureSheet('fixture:fence'), 'base', 26, 15)
  sprite(fixtureSheet('fixture:fence'), 'base', 28, 15)
  sprite(fixtureSheet('fixture:boulder'), 'base', 5, 7)
  sprite(fixtureSheet('fixture:gravestone'), 'base', 1, 12)
  sprite(fixtureSheet('fixture:mushroom_ring'), 'base', 2, 8)
  sprite(fixtureSheet('fixture:statue'), 'base', 21, 12)
  sprite(fixtureSheet('fixture:logpile'), 'base', 10, 11)
  sprite(fixtureSheet('fixture:dummy'), 'base', 16, 14)
  // characters
  const people: [string, number, number, string][] = [
    ['player', 8, 9, 'down0'],
    ['guard', 16, 10, 'left1'],
    ['merchant', 22, 15, 'down0'],
    ['farmer', 26, 12, 'right0'],
    ['child', 19, 12, 'down2'],
    ['mage', 17, 6, 'down0'],
    ['noble', 23, 13, 'up0'],
    ['fisher', 15, 13, 'left0'],
    ['priest', 20, 11, 'down1'],
  ]
  people.forEach(([role, x, y, fr], i) => {
    const look = { skin: i * 3 + 1, hair: i * 5 + 2, hairStyle: i * 7, top: i * 11 + 3, bottom: i * 5 + 1 }
    if (role === 'player') Object.assign(look, { skin: 1, hair: 2, hairStyle: 0, top: 0, bottom: 1 })
    sprite(characterSheet(look, role), fr, x, y)
  })
  sprite(creatureSheet('creature:slime', ''), 'idle0', 3, 9)
  sprite(creatureSheet('creature:slime', 'fire'), 'idle1', 27, 9)
  sprite(creatureSheet('creature:wolf', ''), 'right0', 18, 2)
  sprite(creatureSheet('creature:bat', ''), 'idle0', 25, 7)
  sprite(creatureSheet('creature:crab', ''), 'idle0', 15, 5)
  // overlays on the player's neighbour
  cell(g, 'scene', [c], false)
}

// ---------------------------------------------------------------------------------------
// 1. Terrain

{
  const g = section('Terrain', 'Every variant of every terrain; animated liquids on the right of each group.')
  for (const t of TERRAINS) {
    const n = terr.variants[t.id]
    const cs: HTMLCanvasElement[] = []
    for (let v = 0; v < n; v++) cs.push(frameCanvas(terr, `${t.id}#${v}`))
    if (terr.frames.some((f) => f.name === `${t.id}#anim0`)) cs.push(animated(terr, [`${t.id}#anim0`, `${t.id}#anim1`]))
    cell(g, `${t.id} (${n})`, cs, false)
  }
  // 4x4 tiled patches to check seams between variants
  const g2 = section('Terrain patches', '6×4 patches using hash-picked variants to check for seams and repetition.')
  for (const id of ['grass', 'drygrass', 'flowers', 'dirt', 'path', 'cobble', 'sand', 'snow', 'ice', 'water', 'tree', 'pine', 'wall', 'roof', 'floor_wood', 'floor_stone', 'carpet', 'cave_floor', 'cave_wall', 'lava', 'farmland', 'gravel', 'bridge', 'woodwall', 'ash', 'mud']) {
    const c = document.createElement('canvas')
    c.width = 6 * 16 * 2
    c.height = 4 * 16 * 2
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 6; x++) {
        const v = (x * 7 + y * 13 + ((x * y) % 3)) % terr.variants[id]
        const f = terr.frames.find((q) => q.name === `${id}#${v}`)!
        ctx.drawImage(terr.canvas, f.x, f.y, 16, 16, x * 32, y * 32, 32, 32)
      }
    cell(g2, id, [c], false)
  }
}

// ---------------------------------------------------------------------------------------
// 2. Characters

{
  const g = section('Characters', `Palettes: ${SKIN_TONES.length} skin, ${HAIR_COLORS.length} hair, ${HAIR_STYLE_COUNT} hair styles, ${CLOTH_COLORS.length} clothing. Walk animations cycle stand/stepA/stand/stepB.`)
  const roles = ['player', ...PERSON_ROLES.map((r) => r[0])]
  const all: { role: string; look: { skin: number; hair: number; hairStyle: number; top: number; bottom: number } }[] = []
  for (const role of roles) all.push({ role, look: { skin: ri(10), hair: ri(16), hairStyle: ri(10), top: ri(26), bottom: ri(26) } })
  all[0].look = { skin: 1, hair: 2, hairStyle: 0, top: 0, bottom: 1 }
  for (let i = 0; i < 6; i++) all.push({ role: 'villager', look: { skin: ri(10), hair: ri(16), hairStyle: i + 4, top: ri(26), bottom: ri(26) } })
  for (const { role, look } of all) {
    const s = characterSheet(look, role)
    const cs = ['down', 'left', 'right', 'up'].map((d) => animated(s, [`${d}0`, `${d}1`, `${d}0`, `${d}2`]))
    cell(g, `${role} s${look.skin} h${look.hair} st${look.hairStyle} t${look.top} b${look.bottom}`, cs)
  }
  // full sheet for one character
  const g2 = section('Character sheet layout', 'down / left / right / up rows × stand, stepA, stepB columns.')
  for (const role of ['player', 'guard', 'mage', 'child']) {
    const s = characterSheet({ skin: 2, hair: 4, hairStyle: 2, top: 5, bottom: 13 }, role)
    const c = document.createElement('canvas')
    c.width = s.canvas.width * Z
    c.height = s.canvas.height * Z
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(s.canvas, 0, 0, c.width, c.height)
    cell(g2, role, [c])
  }
  // hair style grid
  const g3 = section('Hair styles', 'Each style front / side / back.')
  for (let hs = 0; hs < HAIR_STYLE_COUNT; hs++) {
    const s = characterSheet({ skin: hs % 10, hair: hs + 1, hairStyle: hs, top: hs * 3, bottom: 1 }, 'villager')
    cell(g3, `style ${hs}`, ['down0', 'left0', 'up0'].map((n) => frameCanvas(s, n)))
  }
}

// ---------------------------------------------------------------------------------------
// 3. Creatures

{
  const g = section('Creatures', 'idle0 / idle1 animated, plus the right-facing frame.')
  const variants: Record<string, string[]> = {
    slime: ['', 'fire', 'ice', 'lightning', 'water', 'earth', 'wind'],
    wolf: ['', 'frost_wolf', 'fire'],
    boar: ['', 'ice'],
    bat: ['', 'fire', 'lightning'],
    skeleton: ['', 'fire', 'ice'],
    ghost: ['', 'fire'],
    golem: ['', 'stone_golem', 'ice_golem', 'fire', 'lightning'],
    imp: ['', 'fire_imp', 'ice'],
    wisp: ['', 'storm_wisp', 'fire', 'ice'],
    crab: ['', 'ice', 'lightning'],
  }
  for (const [kind, vs] of Object.entries(variants))
    for (const v of vs) {
      const s = creatureSheet(`creature:${kind}`, v)
      cell(g, `${kind}${v ? ' · ' + v : ''}`, [animated(s, ['idle0', 'idle1']), frameCanvas(s, 'idle0'), frameCanvas(s, 'idle1'), frameCanvas(s, 'right0')])
    }
  const s = creatureSheet('creature:unknown_thing', '')
  cell(g, 'unknown key → fallback', [frameCanvas(s, 'idle0')])
}

// ---------------------------------------------------------------------------------------
// 4. Fixtures

{
  const g = section('Fixtures', 'base / open / lit.')
  for (const k of [...FIXTURE_KEYS, 'container', 'nature', 'mystery_object']) {
    const s = fixtureSheet(`fixture:${k}`)
    cell(
      g,
      k,
      s.frames.map((f) => frameCanvas(s, f.name)),
    )
  }
}

// ---------------------------------------------------------------------------------------
// 5. Icons

{
  const g = section('Item icons', 'Every sprite key in items.ts with its first material (if any).')
  const seen = new Set<string>()
  for (const f of FORMS) {
    if (seen.has(f.sprite)) continue
    seen.add(f.sprite)
    const mat = f.materials?.[0]
    const s = iconSheet(f.sprite, { material: mat ? MATERIALS[mat].color : undefined })
    cell(g, `${f.sprite.slice(5)}${mat ? ' · ' + mat : ''}`, [frameCanvas(s, 'icon')])
  }
  cell(g, 'unknown → pouch', [frameCanvas(iconSheet('item:unknown_thing'), 'icon')])

  const g2 = section('Icon materials & elements', 'Swords across materials, then elements on assorted gear.')
  for (const m of Object.keys(MATERIALS)) cell(g2, `sword · ${m}`, [frameCanvas(iconSheet('item:sword', { material: MATERIALS[m].color }), 'icon')])
  const els = ['fire', 'water', 'ice', 'lightning', 'wind', 'earth']
  const gear = ['item:sword', 'item:staff', 'item:wand', 'item:ring', 'item:gem', 'item:scroll', 'item:spear', 'item:amulet']
  gear.forEach((gk, i) => {
    for (const e of els) {
      if ((i + els.indexOf(e)) % 2) continue
      cell(g2, `${gk.slice(5)} · ${e}`, [frameCanvas(iconSheet(gk, { material: MATERIALS.steel.color, element: e }), 'icon')])
    }
  })
}

// ---------------------------------------------------------------------------------------
// 6. Overlays & particles

{
  const g = section('Status overlays', 'Animated, then each frame over a sample character.')
  const base = characterSheet({ skin: 3, hair: 1, hairStyle: 0, top: 2, bottom: 1 }, 'villager')
  for (const k of OVERLAY_KEYS) {
    const s = overlaySheet(k)
    const names = s.frames.map((f) => f.name)
    const combo = document.createElement('canvas')
    combo.width = 16 * Z
    combo.height = 16 * Z
    const ctx = combo.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    let i = 0
    const draw = () => {
      ctx.clearRect(0, 0, combo.width, combo.height)
      const bf = base.frames.find((f) => f.name === 'down0')!
      ctx.drawImage(base.canvas, bf.x, bf.y, 16, 16, 0, 0, 16 * Z, 16 * Z)
      const f = s.frames[i % s.frames.length]
      ctx.drawImage(s.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w * Z, f.h * Z)
      i++
    }
    draw()
    animators.push(draw)
    cell(g, `${k} (${names.length})`, [animated(s, names), combo, ...names.map((n) => frameCanvas(s, n))])
  }
  const g2 = section('Particles', 'White/natural; tinted by the client. Shown at 6×.')
  const ps = particleSheet()
  for (const f of ps.frames) cell(g2, `${f.name} ${f.w}×${f.h}`, [frameCanvas(ps, f.name, 6, '#2a2838')], false)
}

document.getElementById('bgToggle')?.addEventListener('change', (e) => {
  document.body.classList.toggle('light', (e.target as HTMLInputElement).checked)
})
