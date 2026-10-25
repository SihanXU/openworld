// Fresh screenshots of the running game (dev client on :5173) through an isolated headless Chrome.
// node site/tools/shots.mjs var/site-shots [name...]  (npm run dev:client first; a playtest at each cell, god on, no modder)
import { spawn } from 'node:child_process'
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.argv[2]
const ONLY = process.argv.slice(3)
const PORT = 9333
const W = 1600, H = 1000
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = await mkdtemp(join(tmpdir(), 'lsw-shots-'))
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { stdio: 'ignore' })
let pages
for (let i = 0; i < 50; i++) { try { pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break } catch { await pause(200) } }
const page = pages.find((p) => p.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res) => ws.addEventListener('open', res, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { const c = pending.get(d.id); pending.delete(d.id); d.error ? c.rej(new Error(JSON.stringify(d.error))) : c.res(d.result) }
  if (d.method === 'Runtime.exceptionThrown') console.log('  page error:', d.params.exceptionDetails.exception?.description?.slice(0, 200))
})
const call = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })) })
const js = async (expression) => {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result.value
}
const key = async (k, code, vk) => {
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk })
  await pause(60)
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk })
}
const clean = `(() => { for (const id of ['labels','hud','dev','intro','loading']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden' } return true })()`

await call('Runtime.enable'); await call('Page.enable')
await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await mkdir(OUT, { recursive: true })

const base = 'http://localhost:5173/'
const at = (map, x, y, extra = '') => `${base}?playtest=1&god=1&modder=off&at=${map},${x},${y}${extra}`
const send = (o) => `window.lsw.send(${JSON.stringify(o)})`

const SHOTS = [
  { name: 'village-day', url: at('meadow', 22, 15), before: [send({ t: 'debug', op: 'hour', hour: 11 })], wait: 6000, clean: true },
  { name: 'village-hud', url: at('meadow', 22, 15), before: [send({ t: 'debug', op: 'hour', hour: 15 })], wait: 6000 },
  { name: 'village-night', url: at('meadow', 22, 15), before: [send({ t: 'debug', op: 'hour', hour: 21 })], wait: 6000, clean: true },
  { name: 'ford', url: at('ford', 24, 15), before: [send({ t: 'debug', op: 'hour', hour: 10 })], wait: 6000, clean: true },
  { name: 'forest', url: at('forest', 20, 15), before: [send({ t: 'debug', op: 'hour', hour: 16 })], wait: 6000, clean: true },
  { name: 'haven', url: at('haven', 24, 20), before: [send({ t: 'debug', op: 'hour', hour: 10 })], wait: 6000, clean: true },
  { name: 'emberfall', url: at('emberfall', 31, 8), before: [send({ t: 'debug', op: 'hour', hour: 19 })], wait: 6000, clean: true },
  { name: 'overworld', url: at('overworld', 32, 24), before: [send({ t: 'debug', op: 'hour', hour: 12 })], wait: 6000, clean: true },
  { name: 'worldmap', url: at('meadow', 22, 15), wait: 6000, keys: [['m', 'KeyM', 77]], after: 1500 },
  { name: 'boss', url: at('eastroad', 30, 12), before: [send({ t: 'debug', op: 'hour', hour: 14 }), send({ t: 'debug', op: 'summon', kit: 'alberic', map: 'eastroad', x: 36, y: 13, from: [30, 12] })], wait: 9000 },
  { name: 'opening', url: `${base}?playtest=1&god=1&modder=off`, wait: 12000 },
  { name: 'title', url: base, wait: 8000 },
  { name: 'overworld-ford', url: at('overworld', 7, 7), before: [send({ t: 'debug', op: 'hour', hour: 12 })], wait: 6000, clean: true },
  { name: 'creator', url: base, wait: 6000, before: [`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'New game')?.click()`], after: 2500 },
]

for (const s of SHOTS) {
  if (ONLY.length && !ONLY.includes(s.name)) continue
  console.log('shot', s.name)
  await call('Page.navigate', { url: s.url })
  for (let i = 0; i < 80; i++) { await pause(250); if (await js(`!!document.querySelector('#game canvas') && !document.getElementById('loading')`).catch(() => false)) break }
  await pause(2500)
  for (const b of s.before ?? []) { await js(b); await pause(400) }
  await pause(s.wait)
  for (const [k, c, v] of s.keys ?? []) await key(k, c, v)
  if (s.after) await pause(s.after)
  if (s.clean) { await js(clean); await pause(300) }
  const shot = await call('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(OUT, `${s.name}.png`), Buffer.from(shot.data, 'base64'))
}
ws.close()
chrome.kill()
