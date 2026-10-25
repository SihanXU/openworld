// Frames of the trailer stage taken one by one in an isolated headless Chrome, then made into a video.
//   node site/video/export.mjs [--from s] [--to s] [--every n] [--size 360|720|1080] [--out var/video/trailer] [--url …]
// Drafts are 360p (the default: frames of 640 x 360); --size 1080 for a final.
// (npm run dev:client first). Frames go to <out>/frames; the video is made by site/video/encode.mjs.
import { spawn } from 'node:child_process'
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const URL = arg('url', 'http://localhost:5173/trailer.html')
const OUT = arg('out', 'var/video/trailer')
const EVERY = Number(arg('every', 1))
// the stage is always laid out at 1920 x 1080; a frame is taken scaled down to the size asked
const SIZE = Number(arg('size', 360))
const SCALE = SIZE / 1080
const PORT = 9335
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = await mkdtemp(join(tmpdir(), 'lsw-video-'))
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
  if (d.method === 'Runtime.exceptionThrown') console.log('page error:', d.params.exceptionDetails.exception?.description?.split('\n').slice(0, 3).join(' | '))
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.log('console:', d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
})
const call = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })) })
const js = async (expression) => {
  const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails))
  return r.result.value
}

await call('Runtime.enable'); await call('Page.enable')
await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await call('Page.navigate', { url: URL + (URL.includes('?') ? '&' : '?') + 'export' })
for (let i = 0; i < 200 && !(await js('!!window.stage').catch(() => false)); i++) await pause(150)
await js('stage.ready')
await js('document.fonts.ready.then(() => true)')
const { fps, frames, shots, cues, music } = await js('({ fps: stage.fps, frames: stage.frames, shots: stage.shots, cues: stage.cues, music: stage.music })')
await mkdir(OUT, { recursive: true })
await writeFile(join(OUT, 'cues.json'), JSON.stringify({ fps, frames, shots, cues, music, size: SIZE }, null, 1))
// a look inside: --eval <expression> --at <seconds> renders that frame and prints what the expression gives
if (arg('eval')) {
  await js(`stage.render(${Math.round(Number(arg('at', 0)) * fps)})`)
  console.log(JSON.stringify(await js(`(() => { const c = stage.cut; const w = c.eng.world; return ${arg('eval')} })()`), null, 1))
  ws.close(); chrome.kill(); process.exit(0)
}
const from = Math.round(Number(arg('from', 0)) * fps), to = Math.min(frames, Math.round(Number(arg('to', frames / fps)) * fps))
console.log(`${frames} frames at ${fps} fps (${(frames / fps).toFixed(1)} s); taking ${from}..${to} every ${EVERY}`)
console.log(shots.map((s) => `${s.id}@${(s.start / fps).toFixed(2)}`).join('  '))
const dir = join(OUT, 'frames')
if (from === 0) await rm(dir, { recursive: true, force: true })
await mkdir(dir, { recursive: true })
const t0 = Date.now()
for (let f = from; f < to; f += EVERY) {
  // the dev server may reload the page under us (a dependency optimised): wait for the stage again and go on
  for (let attempt = 0; ; attempt++) {
    try { await js(`stage.render(${f})`); break } catch (e) {
      if (attempt > 3) throw e
      console.log(`  page reloaded at ${(f / fps).toFixed(2)} s; waiting for the stage`)
      for (let i = 0; i < 200 && !(await js('!!window.stage').catch(() => false)); i++) await pause(150)
      await js('stage.ready'); await js('document.fonts.ready.then(() => true)')
    }
  }
  const shot = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: SCALE } })
  await writeFile(join(dir, `${String(f).padStart(5, '0')}.png`), Buffer.from(shot.data, 'base64'))
  if ((f - from) % (fps * 2 * EVERY) === 0) console.log(`  ${(f / fps).toFixed(1)} s  (${((Date.now() - t0) / 1000).toFixed(0)} s elapsed)`)
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
ws.close(); chrome.kill()
