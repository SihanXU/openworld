// Boot: Phaser (render) + engine Worker (simulation) + DOM HUD, wired by messages.

import Phaser from 'phaser'
import type { Dir, ItemInfo, LibraryData, SaveData, Text } from '@lsw/engine'
import { CATALOG } from './assets/catalog.ts'
import { Hud } from './hud.ts'
import type { FromWorker, ToWorker } from './protocol.ts'
import { WorldScene } from './render/scene.ts'
import { stacks } from './stacks.ts'
import { kvGet, kvSet } from './storage.ts'
import './styles.css'

const REGION_NAMES: Record<string, Text> = {
  frostfang: { en: 'Frostfang Hold', zh: '霜牙领' },
  crownlands: { en: 'Argent Crownlands', zh: '银冠京畿' },
  tidewatch: { en: 'Tidewatch', zh: '潮汐湾' },
  verdant: { en: 'Verdant Reach', zh: '苍翠林域' },
  ashen: { en: 'Ashen Waste', zh: '灰烬荒原' },
  ringed: { en: 'the Ringed Ruins', zh: '环冠遗墟' },
}

// ?world=saenvar loads the 460-map generated world instead of the hand-crafted demo
const PARAMS = new URLSearchParams(location.search)
const WORLD = PARAMS.get('world') === 'saenvar' ? 'world-saenvar' : 'world'
/** The modder service: ?modder=<url> (or =off), else VITE_MODDER_URL, else a local one in development. */
const MODDER = PARAMS.get('modder') === 'off' ? undefined : PARAMS.get('modder') || import.meta.env.VITE_MODDER_URL || (import.meta.env.DEV ? 'http://localhost:8787' : undefined)
const scene = new WorldScene()
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const send = (m: ToWorker) => worker.postMessage(m)
// dev-only hook for scripted testing from the console
if (import.meta.env.DEV) (window as unknown as { lsw: unknown }).lsw = { send, scene }

const hud = new Hud(
  {
    hold: (item) => send({ t: 'hold', item }),
    patch: (id, patch) => send({ t: 'patch', id, patch }),
    dismiss: (id) => send({ t: 'dismiss', id }),
    removeRule: (id) => send({ t: 'removeRule', id }),
    spec: () => send({ t: 'spec' }),
    save: () => send({ t: 'save' }),
    newGame: () => send({ t: 'newGame' }),
    advance: () => send({ t: 'advance' }),
    readMail: (id) => send({ t: 'readMail', id }),
  },
  (id) => scene.screenOf(id),
  (x, y) => scene.screenOfTile(x, y),
)

scene.hooks = {
  onFrame: (f) => hud.onFrame(f),
  onFx: (fx, f) => hud.onFx(fx, f),
  onReady: () => scene.setMuted(hud.muted),
}
hud.onSound = (m) => scene.setMuted(m)

/** Copy a region of a loaded Phaser texture into a fresh canvas (for DOM icons/portraits). */
function crop(img: string, x: number, y: number, w: number, h: number): HTMLCanvasElement | undefined {
  if (!scene.textures?.exists(img)) return undefined
  const src = scene.textures.get(img).getSourceImage() as HTMLImageElement
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(src, x, y, w, h, 0, 0, w, h)
  return c
}
hud.facesetOf = (id) => {
  const path = scene.facesetOf(id)
  if (!path || !scene.textures.exists(path)) return undefined
  const src = scene.textures.get(path).getSourceImage() as HTMLImageElement
  return crop(path, 0, 0, src.width, src.height)
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#0b0d12',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene],
  input: { keyboard: false },
})

// ------------------------------------------------------------------ icons in the DOM

hud.paintIcons = (items: ItemInfo[]) => {
  for (const it of items) {
    const d = CATALOG.items[it.sprite]
    if (!d) continue
    const c = crop(d.img, d.x, d.y, d.w, d.h)
    if (!c) continue
    document.querySelectorAll<HTMLElement>(`[data-icon="${CSS.escape(it.id)}"]`).forEach((slot) => {
      const copy = document.createElement('canvas')
      copy.width = c.width
      copy.height = c.height
      copy.getContext('2d')!.drawImage(c, 0, 0)
      slot.replaceChildren(copy)
    })
  }
}

// ------------------------------------------------------------------ worker messages

let fps = 0
let introShown = false
let frames = 0
let last = performance.now()

worker.onmessage = (ev: MessageEvent<FromWorker>) => {
  const m = ev.data
  switch (m.t) {
    case 'ready':
      if (introShown) break // a later 'ready' is a restart (new game): no intro again
      introShown = true
      document.getElementById('loading')?.remove()
      hud.showIntro(m.name, m.stats, m.resumed, (fresh) => {
        if (fresh) send({ t: 'newGame' })
      })
      break
    case 'map':
      hud.setMapName(m.map.name, m.map.region ? hud.tx(REGION_NAMES[m.map.region]) : undefined)
      scene.setMap(m.map)
      break
    case 'frame':
      scene.applyFrame(m.frame)
      hud.setPerf(m.perf, fps)
      break
    case 'records':
      hud.setRecords(m.records, m.library)
      break
    case 'spec':
      hud.setSpec(m.spec)
      break
    case 'validation':
      hud.showValidation(m.id, m.result)
      break
    case 'saved':
      void kvSet(`save:${WORLD}`, m.save)
      void kvSet('library', m.library)
      hud.log(hud.t('saved'), 'good')
      break
    case 'library':
      void kvSet('library', m.library)
      break
    case 'modder':
      hud.setModder(m)
      break
    case 'loading':
      hud.hint(`${hud.t('loading')} ${m.what}…`)
      setTimeout(() => hud.hint(''), 800)
      break
    case 'error':
      console.error(m.message)
      hud.log(m.message.split('\n')[0], 'warn')
      break
  }
}

async function boot() {
  const [save, library] = await Promise.all([kvGet<SaveData>(`save:${WORLD}`), kvGet<LibraryData>('library')])
  // ?world=saenvar loads the 460-map generated world instead of the hand-crafted demo
  const base = new URL(`${import.meta.env.BASE_URL}${WORLD}/`, location.href).href
  send({ t: 'init', base, save, library, modder: MODDER })
}
void boot()

// ------------------------------------------------------------------ input

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
}
const held: Dir[] = []
let sentDir: Dir | null = null
const syncMove = () => {
  const d = held.length ? held[held.length - 1] : null
  if (d !== sentDir) {
    sentDir = d
    send({ t: 'move', dir: d })
  }
}
let pack: ItemInfo[][] = []
const origOnFrame = scene.hooks.onFrame
scene.hooks.onFrame = (f) => {
  pack = stacks(f.player.inventory)
  if (import.meta.env.DEV) (window as unknown as { lsw: { frame?: unknown } }).lsw.frame = f
  origOnFrame(f)
}

window.addEventListener('keydown', (e) => {
  if (hud.typing) {
    if (e.key === 'Escape') (document.activeElement as HTMLElement).blur()
    return
  }
  if (!document.getElementById('intro')!.classList.contains('hidden')) return
  if (hud.dialogOpen && ['KeyE', 'Space', 'Enter', 'Escape'].includes(e.code)) {
    e.preventDefault()
    return hud.closeDialog()
  }
  // Facing an open container, ↑↓ choose in its panel (WASD still walk; walking away closes it).
  if (hud.boxOpen && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
    e.preventDefault()
    return hud.boxMove(e.code === 'ArrowUp' ? -1 : 1)
  }
  const dir = KEY_DIR[e.code]
  if (dir) {
    if (!held.includes(dir)) held.push(dir)
    syncMove()
    e.preventDefault()
    return
  }
  if (e.repeat) return
  switch (e.code) {
    case 'KeyE':
      return send({ t: 'act', verb: 'interact' })
    case 'KeyF':
      return send({ t: 'act', verb: 'take', item: hud.boxOpen ? hud.boxPick() : undefined })
    case 'KeyG':
      return send({ t: 'act', verb: 'put' })
    case 'KeyU':
      return send({ t: 'act', verb: 'interact', self: true })
    case 'Space':
    case 'KeyJ':
      e.preventDefault()
      return send({ t: 'attack' })
    case 'KeyQ':
    case 'Digit0':
      return send({ t: 'hold', item: undefined })
    case 'Backquote':
      if (!import.meta.env.DEV) return
      return hud.toggleMods()
    case 'KeyH':
      return hud.toggle('#help')
    case 'KeyL':
      return hud.toggleLocale()
    case 'KeyM':
      return hud.toggleSound()
    case 'KeyB':
      return hud.toggleThreads()
    case 'KeyO':
      return hud.toggleMail()
    case 'Escape':
      return hud.closeAll()
  }
  if (e.code.startsWith('Digit')) {
    const i = Number(e.code.slice(5)) - 1
    if (pack[i]) send({ t: 'hold', item: pack[i][0].id })
  }
})
window.addEventListener('keyup', (e) => {
  const dir = KEY_DIR[e.code]
  if (!dir) return
  const i = held.indexOf(dir)
  if (i >= 0) held.splice(i, 1)
  syncMove()
})
window.addEventListener('blur', () => {
  held.length = 0
  syncMove()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') send({ t: 'save' })
})

// ------------------------------------------------------------------ per animation frame

function raf(now: number) {
  frames++
  if (now - last > 1000) {
    fps = (frames * 1000) / (now - last)
    frames = 0
    last = now
  }
  hud.tickLabels()
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)
