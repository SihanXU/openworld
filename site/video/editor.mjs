// The OpenWorld Editor filmed for a film's shot: an isolated headless Chrome opens a project at 1920 x 1080, the
// script's steps are done in it (the pointer moved, a button pressed, a mode chosen) and frames are taken as they go.
// Nothing is saved: the steps only look and choose (the right button picks a cell, a mode is opened, a kind's holes are
// read). A step that makes something (a rule written by hand) the editor saves at once: never press one.
//   node site/video/editor.mjs [--url http://localhost:5175/editor/?project=openworld] [--out games/openworld/public/world/trailer-editor]
//                              [--look]   (one frame after loading and after each step, to find where things are)
// (npm run editor first). The frames and their list (frames.json) are what the stage's editor shot shows (trailer/intro.ts).
import { spawn } from 'node:child_process'
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const URL = arg('url', 'http://localhost:5175/editor/?project=openworld')
const OUT = arg('out', 'games/openworld/public/world/trailer-editor')
const LOOK = process.argv.includes('--look')
const PORT = 9337
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = await mkdtemp(join(tmpdir(), 'lsw-editor-'))
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--mute-audio', '--force-device-scale-factor=1', '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore' })
let pages
for (let i = 0; i < 50; i++) { try { pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break } catch { await pause(200) } }
const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl)
await new Promise((res) => ws.addEventListener('open', res, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { const c = pending.get(d.id); pending.delete(d.id); d.error ? c.rej(new Error(JSON.stringify(d.error))) : c.res(d.result) }
})
const call = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })) })
const js = async (expression) => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value

await call('Page.enable')
await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await call('Page.navigate', { url: URL })
// the project compiled and the map drawn
for (let i = 0; i < 120 && !(await js(`!!document.querySelector('canvas')`).catch(() => false)); i++) await pause(250)
await pause(6000)

const frames = []
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
async function shot() {
  const s = await call('Page.captureScreenshot', { format: 'jpeg', quality: 90 })
  const name = `${String(frames.length).padStart(3, '0')}.jpg`
  await writeFile(join(OUT, name), Buffer.from(s.data, 'base64'))
  frames.push(name)
}
let at = [960, 540]
const mouse = (type, [x, y], o = {}) => call('Input.dispatchMouseEvent', { type, x, y, button: o.button ?? 'none', buttons: o.buttons ?? 0, clickCount: o.clicks ?? 0 })
/** The pointer drawn on the page (headless Chrome draws none): a small arrow where the mouse is. */
const pointer = ([x, y]) => js(`(() => { let p = document.getElementById('film-pointer'); if (!p) { p = document.createElement('div'); p.id = 'film-pointer'; p.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;width:0;height:0;border-left:13px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent;transform:rotate(-30deg);transform-origin:0 0;filter:drop-shadow(0 0 1px #000) drop-shadow(0 1px 2px #000)'; document.body.append(p) } p.style.left = '${x}px'; p.style.top = '${y}px'; return true })()`)
/** The pointer glides to a point over `n` frames. */
async function glide(to, n) {
  const from = at
  for (let i = 1; i <= n; i++) {
    const k = i / n, e = k * k * (3 - 2 * k)
    const p = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]
    await mouse('mouseMoved', p)
    await pointer(p)
    await pause(40)
    if (!LOOK) await shot()
  }
  at = to
}
async function click(p, button = 'left', hold = 2) {
  await glide(p, 0 || 1)
  const b = button === 'right' ? 2 : 1
  await mouse('mousePressed', p, { button, buttons: b, clicks: 1 })
  await mouse('mouseReleased', p, { button, buttons: 0, clicks: 1 })
  await pause(350)
  for (let i = 0; i < hold; i++) if (!LOOK) { await shot(); await pause(60) }
}
/** Where an element whose text is `text` is (its middle), on the page now. */
const where = (text) => js(`(() => { const all = [...document.querySelectorAll('button, a, [role=tab], .tab, li, div, span')].filter((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(text)}); const e = all[0]; if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })()`)

// the steps: over the map (the right button picks the chair's cell), then the holes the world has, and one read
const SCRIPT = JSON.parse(arg('steps', 'null')) ?? [
  ['glide', [1240, 620], 4],
  ['pick', [1040, 508]],
  ['hold', 4],
  ['mode', '空洞 · AI'],
  ['mode', '统计空洞'],
  ['until', '.tree-row[data-kind]', 120000],
  ['kind', 'fixture/furniture/chair'],
  ['hold', 8],
  ['hover', '手写'],
  ['hold', 18],
]
if (LOOK) await shot()
for (const [what, a, b] of SCRIPT) {
  if (what === 'glide') await glide(a, b)
  else if (what === 'hold') { for (let i = 0; i < a; i++) { if (!LOOK) await shot(); await pause(80) } }
  else if (what === 'pick') {
    // the right button on the cell the stage's chair stands on: its place on screen, from the editor's canvas
    const p = a
    await glide(p, 6)
    await click(p, 'right')
  } else if (what === 'mode') {
    const p = await where(a)
    if (p) { await glide(p, 7); await click(p) } else console.log('no', a)
  } else if (what === 'until') {
    // waited for (the count is made as the frames go on: what it shows while it counts is filmed too)
    const t0 = Date.now()
    while (Date.now() - t0 < b && !(await js(`!!document.querySelector(${JSON.stringify(a)})`))) await pause(250)
    console.log(`waited ${((Date.now() - t0) / 1000).toFixed(0)} s for ${a}`)
  } else if (what === 'hover') {
    // the pointer rests on a button, never pressing it (手写 makes a rule in the project, and the editor saves it)
    const p = await where(a)
    if (p) await glide(p, 7); else console.log('no', a)
  } else if (what === 'kind') {
    // a kind of thing in the count's list, brought into view and chosen: its holes in the middle
    const p = await js(`(() => { const e = document.querySelector('.tree-row[data-kind=${JSON.stringify(a)}]'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })()`)
    if (p) { await glide(p, 7); await click(p) } else console.log('no kind', a)
  }
  if (LOOK) await shot()
}
await writeFile(join(OUT, 'frames.json'), JSON.stringify(frames))
console.log(`${frames.length} frames → ${OUT}`)
ws.close(); chrome.kill()
