// npm run wiki:build -- [--out <dir>] [--ref <branch>] [--strict]
// Builds the whole wiki, both editions, into a directory served at /wiki (default games/openworld/wiki/out): the
// Chinese at /wiki/, the English at /wiki/en/. With --strict a build with errors writes nothing and exits 1, so a
// server keeps the last good version.

import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TERRAIN_CHARS } from '@openworld-game/content'
import { encodePng } from './png.ts'
import { lookPngs, lookUrls } from './looks.ts'
import { pageHtml } from './layout.ts'
import { renderMap } from './render-map.ts'
import { plain } from './markup.ts'
import { L, setLang, titlePath } from './lang.ts'
import { ROOT, TYPE_EN, WIKI, buildSite, pageSummary, pairEditions, type Built } from './site.ts'

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

/** Both editions into one directory: the Chinese at its root, the English under en/, the pictures and scripts shared. */
export function writeSite(editions: Built[], out: string): void {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(join(out, '_', 'maps'), { recursive: true })
  for (const b of editions) {
    setLang(b.lang)
    const root = b.lang === 'zh' ? out : join(out, 'en')
    for (const p of b.pages.values()) {
      const f = join(root, ...titlePath(p.title).split('/'), 'index.html')
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, pageHtml(b, p))
    }
    const home = b.byKey.get('p:首页')
    if (home) writeFileSync(join(root, 'index.html'), pageHtml(b, home))
    const index = [...b.pages.values()].filter((p) => !p.key.startsWith('c:') && p.key !== 's:随机页面' && p.key !== 's:搜索').map((p) => ({
      t: p.title, a: p.aliases, k: p.special ? L('特殊', 'Special') : b.lang === 'en' ? TYPE_EN[p.type] ?? p.type : p.type, s: pageSummary(p).slice(0, 100), x: plain(p.html).slice(0, 1600), st: p.stub ? 1 : 0,
    }))
    writeFileSync(join(out, '_', b.lang === 'zh' ? 'search.json' : `search.${b.lang}.json`), JSON.stringify(index))
  }
  setLang('zh')
  const b = editions[0]
  // each map as the game draws it; its ground colours if that fails
  for (const m of b.game.maps) {
    let png: Buffer
    try { png = renderMap(b.game, m.id).png } catch (e) { console.warn(`地图 ${m.id} 画不出来，改用地形色：${(e as Error).message}`); png = mapPng(b, m.map) }
    writeFileSync(join(out, '_', 'maps', `${m.id}.png`), png)
  }
  // each person's look as the game draws it (docs/looks.md): the portrait, the sprite and its head
  mkdirSync(join(out, '_', 'looks'), { recursive: true })
  for (const p of [...b.game.people.map((p) => ({ look: p.look })), ...b.game.lookParts.map((l) => ({ look: l.sample }))]) {
    if (typeof p.look !== 'object') continue
    const urls = lookUrls(p.look)
    const { face, body, head } = lookPngs(p.look)
    if (face) writeFileSync(join(out, urls.face.replace('/wiki/', '')), face)
    writeFileSync(join(out, urls.body.replace('/wiki/', '')), body)
    writeFileSync(join(out, urls.head.replace('/wiki/', '')), head)
  }
  // the team's images (wiki/images): the setting's illustrations among them
  const img = join(out, '_', 'img')
  mkdirSync(img, { recursive: true })
  if (existsSync(join(WIKI, 'images'))) cpSync(join(WIKI, 'images'), img, { recursive: true })
  for (const f of ['wiki.css', 'wiki.js']) cpSync(join(HERE, '..', 'assets', f), join(out, '_', f))
}

/** Both editions, the English after the Chinese it translates, each told where its pages are in the other. */
export function buildBoth(opts: { ref?: string } = {}): [Built, Built] {
  const zh = buildSite({ ...opts, lang: 'zh' })
  const en = buildSite({ ...opts, lang: 'en', zh })
  pairEditions(zh, en)
  setLang('zh')
  return [zh, en]
}

function main(): void {
  const args = process.argv.slice(2)
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
  const out = opt('--out') ?? join(ROOT, 'games', 'openworld', 'wiki', 'out')
  const strict = args.includes('--strict')
  const check = args.includes('--check')
  const t0 = Date.now()
  const editions = buildBoth({ ref: opt('--ref') })
  const errors: string[] = []
  for (const b of editions) {
    const tag = b.lang === 'zh' ? '中文' : 'English'
    for (const w of b.warnings) console.warn(`提醒（${tag}）：${w}`)
    for (const e of b.errors) console.error(`错误（${tag}）：${e}`)
    if (b.missingTr.size) console.warn(`缺译名（${tag}）：${[...b.missingTr].map(([s, k]) => `${s}(${[...k].join(', ')})`).join('; ')}`)
    const tr = b.lang === 'en' ? [...b.pages.values()].filter((p) => p.source) : []
    const count = (s: string) => tr.filter((p) => p.translation === s).length
    console.log(`${tag}：${b.pages.size} 页，${b.errors.length} 个错误，${b.warnings.length} 个提醒，${b.redLinks.size} 个红链${b.lang === 'en' ? `；译文 ${count('current')} 篇最新、${count('outdated')} 篇过时、${count('missing')} 篇未译` : ''}`)
    errors.push(...b.errors)
  }
  console.log(`（${Date.now() - t0} ms）`)
  if (check) { process.exitCode = errors.length ? 1 : 0; return }
  const hard = errors.filter((e) => !e.startsWith('完备性：'))
  if (strict && hard.length) { console.error(`有 ${hard.length} 个错误，没有写出网站（完备性缺口不挡发布，只挡 CI）。`); process.exitCode = 1; return }
  const tmp = out + '.tmp'
  writeSite(editions, tmp)
  rmSync(out + '.old', { recursive: true, force: true })
  if (existsSync(out)) renameSync(out, out + '.old')
  renameSync(tmp, out)
  rmSync(out + '.old', { recursive: true, force: true })
  console.log(`写到 ${out}（${Date.now() - t0} ms）`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
