// Whole-page screenshots of the site's pages at a desktop and a phone width, with the page's errors, for review.
// node site/tools/pages.mjs <base url> <outDir> page.html...
import { spawn } from 'node:child_process'
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [BASE, OUT, ...PAGES] = process.argv.slice(2)
const PORT = 9334
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = await mkdtemp(join(tmpdir(), 'lsw-pages-'))
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let pages
for (let i = 0; i < 50; i++) { try { pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break } catch { await pause(200) } }
const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl)
await new Promise((res) => ws.addEventListener('open', res, { once: true }))
let seq = 0
const pending = new Map(), errors = []
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { const c = pending.get(d.id); pending.delete(d.id); d.error ? c.rej(new Error(JSON.stringify(d.error))) : c.res(d.result) }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0])
  if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) errors.push(`${d.params.response.status} ${d.params.response.url}`)
})
const call = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })) })
await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable')
await mkdir(OUT, { recursive: true })
for (const [tag, w, h, mobile] of [['desk', 1440, 900, false], ['phone', 390, 844, true]]) {
  await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
  await call('Emulation.setTouchEmulationEnabled', { enabled: mobile })
  for (const p of PAGES) {
    errors.length = 0
    await call('Page.navigate', { url: BASE + p })
    await pause(2500)
    // lazy pictures: walk down the page so they load
    const height = (await call('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })).result.value
    for (let y = 0; y < height; y += h) { await call('Runtime.evaluate', { expression: `window.scrollTo(0, ${y})` }); await pause(150) }
    await call('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' }); await pause(800)
    const overflow = (await call('Runtime.evaluate', { expression: 'document.documentElement.scrollWidth - window.innerWidth', returnByValue: true })).result.value
    const shot = await call('Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(height, 16000), scale: 1 } })
    await writeFile(join(OUT, `${p.replace('.html', '').replaceAll('/', '-')}-${tag}.jpg`), Buffer.from(shot.data, 'base64'))
    console.log(`${p} ${tag}: height ${height}, horizontal overflow ${overflow}px${errors.length ? ', errors: ' + errors.join(' | ') : ''}`)
  }
}
ws.close(); chrome.kill()
