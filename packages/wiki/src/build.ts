// npm run wiki:build -- [--out <dir>] [--ref <branch>] [--strict]
// Builds the whole wiki into a directory served at /wiki (default packages/wiki/out). With --strict a
// build with errors writes nothing and exits 1, so a server keeps the last good version.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TERRAIN_CHARS } from '@lsw/content'
import { decodePng, encodePng, shrink } from './png.ts'
import { pageHtml } from './layout.ts'
import { renderMap } from './render-map.ts'
import { plain } from './markup.ts'
import { ROOT, WIKI, buildSite, pageSummary, type Built } from './site.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

const hex = (c: string): [number, number, number] => {
  const m = c.replace('#', '')
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]
}

/** A map's ground as a picture: one pixel a cell, its terrain's colour, shaded by height. */
function mapPng(b: Built, map: any): Buffer {
  const colors = new Map(b.game.terrains.map((t) => [t.id, hex(t.color ?? '#888888')]))
  const extra: Record<string, string> = { wall: '#5b4a3a', roof: '#8a4b3a', floor: '#c8a87a', farmland: '#6b4a2a', rock: '#77736c', cave_wall: '#3b3640', cave_floor: '#5e5864', lava: '#e0502a', mud: '#6d5a3a', ash: '#8a8580', gravel: '#9a958a', bridge: '#a77b4a', void: '#1d1b24' }
  const W = map.width, H = map.height
  const rgba = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    const row: string = map.rows[y] ?? ''
    const hrow: string = map.heights?.[y] ?? ''
    for (let x = 0; x < W; x++) {
      const t = TERRAIN_CHARS[row[x]] ?? 'grass'
      const c = colors.get(t) ?? (extra[t] ? hex(extra[t]) : [136, 136, 136])
      const h = Number(hrow[x] ?? 0) || 0
      const k = 1 + h * 0.06
      const o = (y * W + x) * 4
      rgba[o] = Math.min(255, c[0] * k); rgba[o + 1] = Math.min(255, c[1] * k); rgba[o + 2] = Math.min(255, c[2] * k); rgba[o + 3] = 255
    }
  }
  return encodePng(W, H, rgba)
}

export function writeSite(b: Built, out: string): void {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(join(out, '_', 'maps'), { recursive: true })
  const fileOf = (title: string) => join(out, title.replace(/\//g, '／'), 'index.html')
  for (const p of b.pages.values()) {
    const f = fileOf(p.title)
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, pageHtml(b, p))
  }
  const home = b.pages.get('首页')
  if (home) writeFileSync(join(out, 'index.html'), pageHtml(b, home))
  // each map as the game draws it; its ground colours if that fails
  for (const m of b.game.maps) {
    let png: Buffer
    try { png = renderMap(b.game, m.id).png } catch (e) { console.warn(`地图 ${m.id} 画不出来，改用地形色：${(e as Error).message}`); png = mapPng(b, m.map) }
    writeFileSync(join(out, '_', 'maps', `${m.id}.png`), png)
  }
  // the team's images (wiki/images), and the setting's illustrations (assets/concept), scaled for the web
  const img = join(out, '_', 'img')
  mkdirSync(img, { recursive: true })
  if (existsSync(join(WIKI, 'images'))) cpSync(join(WIKI, 'images'), img, { recursive: true })
  const CONCEPT = join(ROOT, 'assets', 'concept')
  for (const f of existsSync(CONCEPT) ? readdirSync(CONCEPT).filter((f) => f.endsWith('.png')) : []) {
    const target = join(img, f)
    if (existsSync(target)) continue
    try {
      const im = shrink(decodePng(readFileSync(join(CONCEPT, f))), 640)
      writeFileSync(target, encodePng(im.w, im.h, im.rgba))
    } catch { cpSync(join(CONCEPT, f), target) }
  }
  for (const f of ['wiki.css', 'wiki.js']) cpSync(join(HERE, '..', 'assets', f), join(out, '_', f))
  const index = [...b.pages.values()].filter((p) => !p.title.startsWith('分类：') && p.title !== '特殊：随机页面' && p.title !== '特殊：搜索').map((p) => ({
    t: p.title, a: p.aliases, k: p.special ? '特殊' : p.type, s: pageSummary(p).slice(0, 100), x: plain(p.html).slice(0, 1600), st: p.stub ? 1 : 0,
  }))
  writeFileSync(join(out, '_', 'search.json'), JSON.stringify(index))
}

function main(): void {
  const args = process.argv.slice(2)
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
  const out = opt('--out') ?? join(ROOT, 'packages', 'wiki', 'out')
  const strict = args.includes('--strict')
  const check = args.includes('--check')
  const t0 = Date.now()
  const b = buildSite({ ref: opt('--ref') })
  const n = b.pages.size
  for (const w of b.warnings) console.warn(`提醒：${w}`)
  for (const e of b.errors) console.error(`错误：${e}`)
  if (b.missingTr.size) console.warn(`缺译名：${[...b.missingTr].map(([s, k]) => `${s}(${[...k].join(', ')})`).join('; ')}`)
  console.log(`${n} 页，${b.errors.length} 个错误，${b.warnings.length} 个提醒，${b.redLinks.size} 个红链（${Date.now() - t0} ms）`)
  if (check) { process.exitCode = b.errors.length ? 1 : 0; return }
  const hard = b.errors.filter((e) => !e.startsWith('完备性：'))
  if (strict && hard.length) { console.error(`有 ${hard.length} 个错误，没有写出网站（完备性缺口不挡发布，只挡 CI）。`); process.exitCode = 1; return }
  const tmp = out + '.tmp'
  writeSite(b, tmp)
  rmSync(out + '.old', { recursive: true, force: true })
  if (existsSync(out)) renameSync(out, out + '.old')
  renameSync(tmp, out)
  rmSync(out + '.old', { recursive: true, force: true })
  console.log(`写到 ${out}（${Date.now() - t0} ms）`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
