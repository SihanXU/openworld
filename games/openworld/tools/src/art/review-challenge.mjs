// Isolated local Chrome only: same setup as review-bosses.mjs, starting at the title.
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const origin = 'http://127.0.0.1:5184'
const pages = await (await fetch('http://127.0.0.1:9227/json/list')).json()
const page = pages.find((p) => p.type === 'page' && p.url.startsWith(origin))
assert(page, 'Open the isolated game on localhost:5184 first')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let serial = 0
const pending = new Map(), errors = []
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const callback = pending.get(message.id); pending.delete(message.id)
    if (message.error) callback?.reject(new Error(JSON.stringify(message.error)))
    else callback?.resolve(message.result)
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(message.params.response.url)
})
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const wait = async (expression) => {
  for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await delay(100) }
  throw new Error('Timeout: ' + expression)
}
const click = (id) => evaluate(`document.getElementById('${id}').click()`)
const screenshot = async (name) => {
  const { data } = await call('Page.captureScreenshot', { format: 'png' })
  await writeFile(`docs/boss-review/challenge-${name}.png`, Buffer.from(data, 'base64'))
}
const key = (type, code, value) => call('Input.dispatchKeyEvent', { type, code, key: value, windowsVirtualKeyCode: code === 'Space' ? 32 : code === 'KeyW' ? 87 : 27 })

try {
  await call('Runtime.enable'); await call('Network.enable'); await call('Page.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await call('Page.navigate', { url: origin + '/' })
  await wait("!!document.getElementById('cvChallenge')")
  if (await evaluate("document.getElementById('cvLang').textContent === '中文'")) await click('cvLang')
  assert(await evaluate("[...document.querySelectorAll('.cv-menu button')].every(b => b.getBoundingClientRect().bottom < innerHeight - 25)"), 'Title menu clipped')
  await mkdir('docs/boss-review', { recursive: true })
  await screenshot('title')
  await click('cvChallenge')
  await wait("!!document.getElementById('startChallenge') && !document.getElementById('startChallenge').disabled")
  assert.equal(await evaluate("document.querySelectorAll('[name=challengeProfession]').length"), 4)
  assert.equal(await evaluate("document.getElementById('challengeBoss').options.length"), 7)
  const tick = await evaluate('window.bossStudio.frame.tick')
  await delay(400)
  assert.equal(await evaluate('window.bossStudio.frame.tick'), tick, 'Lobby must pause')
  await screenshot('lobby')
  assert(await evaluate("document.querySelector('#challengeLobby .challenge-sheet').getBoundingClientRect().bottom <= innerHeight - 20"), 'Desktop lobby clipped')
  for (const profession of ['assassin', 'ranger', 'mage', 'warrior']) {
    await evaluate(`document.querySelector('[name=challengeProfession][value=${profession}]').checked = true`)
    await click('startChallenge')
    await delay(150)
    const player = await evaluate('window.bossStudio.frame.player')
    assert.equal(player.props.profession, profession)
    assert.equal(player.skills.length, 10)
    assert(player.held, 'Weapon must be equipped')
    assert.equal(await evaluate("document.querySelectorAll('#skillButtons button:disabled').length"), 3)
    assert(await evaluate("document.getElementById('enrageBoss').classList.contains('hidden')"))
    console.log(profession, player.hp, JSON.stringify(player.held.name))
    if (profession !== 'warrior') await click('changeChallenge')
  }
  await key('keyDown', 'KeyW', 'w'); await delay(800); await key('keyUp', 'KeyW', 'w')
  assert((await evaluate('window.bossStudio.frame.player.y')) < 19, 'Movement failed')
  await screenshot('battle')
  // A short burst damages the enlarged boss, but no longer ends the encounter.
  await key('keyDown', 'KeyW', 'w'); await key('keyDown', 'Space', ' ')
  await delay(1000)
  await key('keyUp', 'KeyW', 'w'); await key('keyUp', 'Space', ' ')
  assert(await evaluate("Number(document.getElementById('sinTrack').getAttribute('aria-valuenow')) < 1400"), 'Combat did not damage boss')
  assert(await evaluate("document.getElementById('sinTrack').getAttribute('aria-valuemax') === '1400'"), 'Old boss stats')
  assert(await evaluate("document.getElementById('sinBoss').getBoundingClientRect().width > 650"), 'Encounter plate too small')
  assert(await evaluate("parseFloat(document.getElementById('sinDamage').style.width) >= parseFloat(document.getElementById('sinHealth').style.width)"), 'Damage trail below actual HP')
  await screenshot('damage')
  await click('resetFight')
  assert(await evaluate("document.activeElement.id !== 'resetFight'"), 'Retry must restore keyboard controls')
  await key('keyDown', 'Escape', 'Escape'); await key('keyUp', 'Escape', 'Escape')
  const pausedTick = await evaluate('window.bossStudio.frame.tick')
  await delay(400)
  assert.equal(await evaluate('window.bossStudio.frame.tick'), pausedTick, 'Escape must pause')
  await click('changeChallenge')
  assert((await evaluate("document.getElementById('challengeLobby').textContent")).includes('已击败 0 / 7'))
  await evaluate("document.querySelector('[name=challengeProfession][value=assassin]').checked = true; document.getElementById('challengeBoss').value = 'pride'")
  await click('startChallenge')
  // Accelerate the real encounter while deliberately standing in its telegraphs.
  await wait("(window.bossStudio.advance(10), !document.getElementById('challengeResult').classList.contains('hidden'))")
  assert.equal(await evaluate("document.getElementById('resultTitle').textContent"), '挑战失败')
  assert.equal(await evaluate("document.getElementById('nextChallenge')"), null)
  await screenshot('defeat')
  await click('retryChallenge')
  assert(await evaluate('window.bossStudio.frame.player.hp === window.bossStudio.frame.player.maxHp'))
  assert((await evaluate('window.bossStudio.frame.tick')) <= tick + 1, 'Retry must reset the encounter clock')
  await click('changeChallenge')
  await call('Emulation.setDeviceMetricsOverride', { width: 760, height: 700, deviceScaleFactor: 1, mobile: false })
  await delay(200)
  assert(await evaluate("document.querySelector('#challengeLobby .challenge-sheet').getBoundingClientRect().right <= innerWidth"), 'Narrow lobby overflows horizontally')
  await evaluate("document.getElementById('startChallenge').scrollIntoView({block: 'center'})")
  assert(await evaluate("document.getElementById('startChallenge').getBoundingClientRect().bottom < innerHeight"), 'Start button inaccessible in narrow viewport')
  assert.deepEqual(errors, [])
  console.log('PASS: title entry, paused lobby, four loadouts, movement/attacks, giant health/epic bar/damage trail, defeat, retry, pause, session counter, narrow layout; no JS/HTTP errors.')
} finally { ws.close() }
