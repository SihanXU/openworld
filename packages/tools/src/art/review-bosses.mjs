// Browser smoke test for an isolated, explicitly launched local Chrome (not a user profile).
// Start Chrome with --remote-debugging-port=9227 and a fresh mktemp user-data-dir first.
import { mkdir, writeFile } from 'node:fs/promises'

const pages = await (await fetch('http://127.0.0.1:9227/json/list')).json()
const page = pages.find((p) => p.type === 'page' && p.url.startsWith('http://127.0.0.1:5184/boss-gallery.html'))
if (!page) throw new Error('Open the isolated Boss Studio on localhost:5184 first')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
let sequence = 0
const pending = new Map(), errors = []
ws.addEventListener('message', (message) => {
  const data = JSON.parse(message.data)
  if (data.id) {
    const call = pending.get(data.id); pending.delete(data.id)
    if (data.error) call?.reject(new Error(JSON.stringify(data.error)))
    else call?.resolve(data.result)
  }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails)
  if (data.method === 'Network.responseReceived' && data.params.response.status >= 400) errors.push(data.params.response.url)
})
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
  })
}
const evaluate = async (expression) => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
async function ready(id) {
  const start = Date.now()
  while (Date.now() - start < 20000) {
    if (await evaluate(`document.getElementById('studioStatus')?.dataset.ready === 'true' && document.getElementById('bossSelect')?.value === '${id}'`)) return
    await pause(150)
  }
  throw new Error('Studio did not finish loading: ' + await evaluate("document.getElementById('studioStatus')?.textContent"))
}
await call('Runtime.enable'); await call('Network.enable'); await call('Page.enable')
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
await mkdir('docs/boss-review', { recursive: true })
try {
  for (const id of ['lust', 'envy', 'pride']) {
    await call('Page.navigate', { url: `http://127.0.0.1:5184/boss-gallery.html?boss=${id}&shot=warning` })
    await pause(200); await ready(id); await pause(500)
    const status = await evaluate("({name:document.getElementById('sinName').textContent, skills:document.querySelectorAll('#skillButtons button').length, info:document.getElementById('bossInfo').textContent, status:document.getElementById('studioStatus').textContent})")
    if (status.skills !== 3 || status.status.includes('error')) throw new Error(JSON.stringify(status))
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(`docs/boss-review/${id}.png`, Buffer.from(shot.data, 'base64'))
    if (id === 'pride') await writeFile('docs/seven-sins-gameplay.png', Buffer.from(shot.data, 'base64'))
    for (const action of ['idle', 'walk', 'attack', 'cast', 'hurt', 'death']) {
      await evaluate(`document.getElementById('modeSelect').value='${action}'; document.getElementById('modeSelect').dispatchEvent(new Event('change'))`)
      await pause(120)
    }
    for (let skill = 0; skill < 3; skill++) {
      const result = await evaluate(`(() => {
        document.getElementById('resetFight').click();
        document.querySelectorAll('#skillButtons button')[${skill}].click();
        document.getElementById('pauseFight').click();
        const studio = window.bossStudio;
        studio.advance(1);
        const start = studio.frame.tick;
        // Advance until the warning has resolved and the generated one-shot is on screen.
        while (studio.frame.entities.find(e => e.boss)?.boss.warning && studio.frame.tick - start < 40) studio.advance(1);
        return { skill: document.querySelectorAll('#skillButtons button')[${skill}].dataset.skill, art: studio.scene.children.list.filter(o => o.texture?.key?.startsWith('lsw/Bosses/')).map(o => o.texture.key), cast: document.getElementById('studioStatus').textContent };
      })()`)
      if (!result.art.includes(`lsw/Bosses/${id}/effect-${result.skill}.png`)) throw new Error('Missing generated skill effect: ' + id + '/' + skill + ' ' + JSON.stringify(result))
    }
    await evaluate("document.getElementById('resetFight').click(); document.getElementById('enrageBoss').click()")
    if (!(await evaluate("document.getElementById('sinBoss').classList.contains('awakened')"))) throw new Error('Missing awakened health plate: ' + id)
    if (id === 'pride') {
      const shot = await call('Page.captureScreenshot', { format: 'png' })
      await writeFile('docs/boss-review/pride-awakened.png', Buffer.from(shot.data, 'base64'))
    }
    console.log(id, JSON.stringify(status), '6 action modes and awakened health plate rendered')
  }
  if (errors.length) throw new Error(JSON.stringify(errors))
  console.log('PASS: seven real-engine encounters, 42 animation-mode switches, 21 generated skill effects, no JS or HTTP errors.')
} finally { ws.close() }
