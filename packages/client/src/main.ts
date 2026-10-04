// Boot: Phaser (render) + engine Worker (simulation) + DOM UI, wired by messages. The input
// (design.md §5.2): four inputs, one verb each — E hands, F take, left click use, right click
// put — aimed at the pointed tile within two rings (E, F: else the tile in front); Esc menu, I
// inventory, J journal, M map.

import Phaser from 'phaser'
import type { Dir, Frame, ItemInfo, Key, LibraryData, SaveData, Text } from '@lsw/engine'
import { CATALOG } from './assets/catalog.ts'
import type { FromWorker, Tile, ToWorker } from './protocol.ts'
import { assetUrl, registerArt } from './render/assets.ts'
import { WorldScene } from './render/scene.ts'
import { kvGet, kvSet } from './storage.ts'
import { writeSlot, type Slot } from './saves.ts'
import { Cover } from './ui/cover.ts'
import { locale, t, tx } from './ui/common.ts'
import { ModConsole } from './ui/dev.ts'
import { Hud } from './ui/hud.ts'
import { BuildingMode } from './ui/building.ts'
import { Menu, type Tab } from './ui/menu.ts'
import { Tooltip } from './ui/tooltip.ts'
import { Minimap } from './ui/worldmap.ts'
import './styles.css'
import './ui/game.css'

const PARAMS = new URLSearchParams(location.search)
const WORLD = 'world'
/** The modder service: ?modder=<url> (or =off), else VITE_MODDER_URL, else a local one in development. */
const MODDER = PARAMS.get('modder') === 'off' ? undefined : PARAMS.get('modder') || import.meta.env.VITE_MODDER_URL || (import.meta.env.DEV ? 'http://localhost:8787' : undefined)
const scene = new WorldScene()
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const send = (m: ToWorker) => worker.postMessage(m)
// dev-only hook for scripted testing from the console
if (import.meta.env.DEV) (window as unknown as { lsw: unknown }).lsw = { send, scene }
document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'

const dev = new ModConsole({
  patch: (id, patch) => send({ t: 'patch', id, patch }),
  debug: (op) => send({ t: 'debug', ...op }),
  dismiss: (id) => send({ t: 'dismiss', id }),
  removeRule: (id) => send({ t: 'removeRule', id }),
  spec: () => send({ t: 'spec' }),
  save: () => send({ t: 'save' }),
  newGame: () => send({ t: 'newGame' }),
})

const menu = new Menu({
  swap: (a, b) => send({ t: 'swap', a, b }),
  quickMove: (slot) => send({ t: 'quickMove', slot }),
  drop: (slot, all) => send({ t: 'drop', slot, all }),
  organize: () => send({ t: 'organize' }),
  craft: (id) => send({ t: 'craft', id }),
  learn: (id) => send({ t: 'learn', id }),
  atlas: () => send({ t: 'atlas' }),
  travel: (waypoint) => send({ t: 'travel', waypoint }),
  profession: (id) => send({ t: 'profession', id }),
  transfer: (from, item, all) => send({ t: 'transfer', from, item, all }),
  closePanel: () => send({ t: 'closePanel' }),
  save: () => send({ t: 'save' }),
  // back to the cover: the game is saved to its slot first
  newGame: () => {
    send({ t: 'save' })
    void cover.show()
  },
  toggleLocale: () => {
    locale.set(locale.value === 'en' ? 'zh' : 'en')
    hud.relabel()
  },
  toggleSound: () => hud.toggleSound(),
  devConsole: () => dev.toggle(true),
  keyOnItem: (key, item) => send({ t: 'keyOnItem', key, item }),
})

const hud = new Hud(
  {
    select: (slot) => send({ t: 'select', slot }),
    answer: (yes) => send({ t: 'answer', yes }),
    advance: () => send({ t: 'advance' }),
    openMenu: (tab) => menu.open(tab as Tab | undefined),
    openJournal: () => (menu.openJournal(), hud.seenJournal()),
    toggleInventory: () => menu.toggle('inventory'),
    toggleSkills: () => menu.toggleSkills(),
    toggleQuests: () => menu.toggleQuests(),
    toggleBuilding: () => toggleBuilding(),
  },
  (id) => scene.screenOf(id),
  (x, y) => scene.screenOfTile(x, y),
)
menu.muted = hud.muted
const minimap = new Minimap(() => menu.toggleMap())
const building = new BuildingMode(send, (x, y) => ({ ...scene.screenOfTile(x, y), scale: scene.cameras.main.zoom }))
function toggleBuilding(): void {
  if (menu.anyOpen || dev.open || hud.dialogOpen || hud.questionShown || hud.chooserOpen || !lastFrame || !document.getElementById('intro')!.classList.contains('hidden')) return
  if (pressing) { clearTimeout(pressing.timer); pressing = undefined }
  setAttack(false)
  building.toggle()
}

/** Minecraft's tooltip over any item in the toolbar, the bag, a chest or the crafting panel. */
const tooltip = new Tooltip(() => ({
  atk: Number(lastFrame?.player.props.atk ?? 0),
  nameOf: (id) => {
    const e = lastFrame?.entities.find((x) => x.id === id)
    return e ? tx(e.name) : undefined
  },
}))
menu.registerTip = (key, info) => tooltip.register(key, info)
document.documentElement.style.setProperty('--drum-icon', `url("${assetUrl(CATALOG.ui.drumstick.img)}")`)
hud.threadDoc = (rule) => menu.library?.patches.find((r) => r.id === rule)?.doc

/** The latest frame (for aiming the chooser), and the chooser's handler (set below). */
let lastFrame: Frame | undefined
let onChoices: ((key: Key, tile: Tile | undefined, list: { layer: number; name: Text; label?: Text; unknown?: boolean }[]) => void) | undefined

scene.hooks = {
  onFrame: (f) => {
    lastFrame = f
    hud.onFrame(f)
    menu.onFrame(f)
    tooltip.onFrame(f)
    dev.onFrame(f)
    building.onFrame(f)
    if (import.meta.env.DEV) (window as unknown as { lsw: { frame?: unknown } }).lsw.frame = f
    syncPause()
  },
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
const faceset = (id: string) => {
  const path = scene.facesetOf(id)
  if (!path || !scene.textures.exists(path)) return undefined
  const src = scene.textures.get(path).getSourceImage() as HTMLImageElement
  return crop(path, 0, 0, src.width, src.height)
}
hud.facesetOf = faceset
menu.facesetOf = faceset

const paintIcons = (items: ItemInfo[]) => {
  for (const it of items) {
    const d = it.sprite.startsWith('art:') && scene.textures.exists(it.sprite) ? { img: it.sprite, x: 0, y: 0, w: 16, h: 16 } : CATALOG.items[it.sprite]
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
  // portraits in the Social tab, by character look
  document.querySelectorAll<HTMLElement>('[data-look]:empty').forEach((el) => {
    const a = CATALOG.characters[el.dataset.look!]
    const path = a?.faceset ? `${a.dir}/${a.faceset}` : undefined
    if (!path || !scene.textures.exists(path)) return
    const src = scene.textures.get(path).getSourceImage() as HTMLImageElement
    const c = crop(path, 0, 0, src.width, src.height)
    if (c) el.appendChild(c)
  })
}
hud.paintIcons = paintIcons
menu.paintIcons = paintIcons
building.paint = (sprite) => {
  const d = CATALOG.fixtures[sprite]?.base ?? CATALOG.items[sprite]
  return d ? crop(d.img, d.x, d.y, d.w, d.h) : undefined
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

// ------------------------------------------------------------------ worker messages

let fps = 0
let frames = 0
let last = performance.now()

worker.onmessage = (ev: MessageEvent<FromWorker>) => {
  const m = ev.data
  switch (m.t) {
    case 'placement':
      building.onPreview(m.preview)
      break
    case 'ready':
      dev.stats = m.stats
      cover.hide()
      // a slot's save from another version of the world cannot be played on: a new game began instead
      if (startingFrom && !m.resumed) hud.message(t('cvIncompatible'), 'warn')
      // the slot is filled at once (a new game) or refreshed (a loaded one)
      send({ t: 'save' })
      break
    case 'map':
      hud.setMapName(m.map.name)
      scene.setMap(m.map)
      minimap.setMap(m.map)
      break
    case 'atlas':
      menu.worldmap.onAtlas(m.atlas)
      break
    case 'frame':
      if (building.open) m.frame.keys = undefined
      scene.applyFrame(m.frame)
      minimap.onFrame(m.frame)
      // a rule opened one of the player's panels (a trainer: the choice of profession)
      if (m.frame.fx.some((x) => x.t === 'panel' && x.panel === 'profession')) menu.openProfession()
      reaim()
      dev.setPerf(m.perf, fps)
      break
    case 'records':
      dev.setRecords(m.records, m.library)
      menu.library = m.library
      break
    case 'spec':
      dev.setSpec(m.spec)
      break
    case 'validation':
      dev.showValidation(m.id, m.result)
      break
    case 'saved':
      if (slot) void writeSlot(WORLD, slot, { save: m.save, summary: m.summary, savedAt: m.save.savedAt })
      void kvSet('library', m.library)
      if (!cover.open && !quietSave) hud.message(t('savedSlot').replace('{n}', String(slot ?? '')), 'good')
      quietSave = false
      break
    case 'library':
      void kvSet('library', m.library)
      break
    case 'modder':
      dev.setModder(m)
      hud.modderOnline = m.online
      break
    case 'art':
      for (const a of m.arts) registerArt(scene, a.id, a.art)
      break
    case 'creating':
      hud.message(`✦ ${t('creating')}: ${m.names.map((n) => tx(n)).join(locale.value === 'zh' ? '、' : ', ')}…`, 'ai')
      break
    case 'loading':
      break
    case 'choices':
      onChoices?.(m.key, m.tile, m.list)
      break
    case 'error':
      console.error(m.message)
      if (import.meta.env.DEV) hud.message(m.message.split('\n')[0], 'warn')
      break
  }
}

// ------------------------------------------------------------------ the cover and the save slots

/** The slot being played (autosaves and the menu's Save write to it). */
let slot: Slot | undefined
/** The save the slot started from (undefined: a new game). */
let startingFrom: SaveData | undefined
/** The save right after loading is not announced. */
let quietSave = false

const cover = new Cover(WORLD, {
  start: async (s, data) => {
    slot = s
    startingFrom = data?.save
    quietSave = true
    const library = await kvGet<LibraryData>('library')
    const base = new URL(`${import.meta.env.BASE_URL}${WORLD}/`, location.href).href
    send({ t: 'init', base, save: data?.save, library, modder: MODDER })
  },
  toggleLocale: () => {
    locale.set(locale.value === 'en' ? 'zh' : 'en')
    hud.relabel()
  },
})
void cover.show()

// ------------------------------------------------------------------ time stops while something is open

let pausedNow = false
function syncPause(): void {
  const on = menu.anyOpen || hud.dialogOpen || hud.chooserOpen || dev.open || !document.getElementById('intro')!.classList.contains('hidden')
  if (on && building.open) building.toggle(false)
  if (on !== pausedNow) {
    pausedNow = on
    send({ t: 'pause', on })
    if (on) stopMoving()
  }
}

// ------------------------------------------------------------------ keyboard

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}
const SLOT_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0']
const held: Dir[] = []
let sentDir: Dir | null = null
let shift = false
const syncMove = () => {
  const d = held.length ? held[held.length - 1] : null
  if (d !== sentDir) {
    sentDir = d
    send({ t: 'move', dir: d, walk: shift })
  }
}
let attacking = false
const setAttack = (on: boolean) => {
  if (on === attacking) return
  attacking = on
  send({ t: 'attack', on })
}
const stopMoving = () => {
  held.length = 0
  syncMove()
  setAttack(false)
}

const typing = () => {
  const a = document.activeElement
  return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')
}

// The four inputs (design.md §5.2): E hands, F take, left click use, right click put. A short
// press acts on the top of what is drawn where the pointer is; a long press opens the chooser
// of all of it (people, things, items, the ground, oneself), so every event is reachable.
const LONG_MS = 380
const KEY_OF: Record<string, Key> = { KeyE: 'hands', KeyF: 'take' }
const KEY_NAME: Record<Key, string> = { hands: 'E', take: 'F', use: 'L', put: 'R' }
let pressing: { key: Key; tile?: Tile; timer: ReturnType<typeof setTimeout>; long: boolean } | undefined

function press(key: Key, tile: Tile | undefined): void {
  if (pressing) return
  const p = { key, tile, long: false, timer: setTimeout(() => ((p.long = true), send({ t: 'choices', key, tile })), LONG_MS) }
  pressing = p
}
function release(key: Key): void {
  const p = pressing
  if (!p || p.key !== key) return
  clearTimeout(p.timer)
  pressing = undefined
  if (!p.long) send({ t: 'key', key, tile: p.tile })
}
/** The chooser's list arrived (after a long press): pick a layer, then the input acts on it. */
onChoices = (key, tile, list) =>
  hud.showChooser(KEY_NAME[key] === 'L' ? t('lmb') : KEY_NAME[key] === 'R' ? t('rmb') : KEY_NAME[key], tile ?? aimFront(), list, (layer) => send({ t: 'key', key, tile, layer }))

/** The tile in front of the player (for placing the chooser when the keyboard aims). */
function aimFront(): Tile {
  const f = lastFrame
  if (!f) return { x: 0, y: 0 }
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[f.player.facing] as [number, number]
  return { x: f.player.x + dx, y: f.player.y + dy }
}

window.addEventListener('keydown', (e) => {
  if (typing()) {
    if (e.key === 'Escape') (document.activeElement as HTMLElement).blur()
    return
  }
  if (!document.getElementById('intro')!.classList.contains('hidden')) return
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shift = true
  // the layer chooser: a number picks, Esc closes
  if (hud.chooserOpen) {
    e.preventDefault()
    if (e.code === 'Escape') return hud.closeChooser()
    const n = Number(e.key)
    if (n >= 1 && n <= 9) return hud.chooseNth(n)
    return
  }
  // a yes/no question: arrows choose, E confirms, Esc says no
  if (hud.questionShown) {
    e.preventDefault()
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) return hud.moveChoice()
    if (e.code === 'KeyE' || e.code === 'KeyF') return hud.confirmChoice()
    if (e.code === 'Escape') return hud.answer(false)
    return
  }
  // an open dialogue: E (or Esc) moves it on — unless a menu lies over it (Esc closes that first)
  if (hud.dialogOpen && !menu.anyOpen && (e.code === 'KeyE' || e.code === 'Escape')) {
    e.preventDefault()
    return hud.advanceDialog()
  }
  if (e.code === 'Backquote') return dev.toggle()
  if (e.code === 'KeyB' && !e.repeat) return void (e.preventDefault(), toggleBuilding())
  // Esc closes what is open, else opens the menu; I the inventory, K the skill tree, J the journal (and the Threadbook)
  if (e.code === 'Escape') {
    e.preventDefault()
    if (building.open) return building.toggle(false)
    if (dev.open) return dev.toggle(false)
    if (menu.anyOpen) return menu.close()
    return menu.open('options')
  }
  if (e.code === 'KeyI') return menu.toggle('inventory')
  if (e.code === 'KeyC') return menu.toggle('craft')
  if (e.code === 'KeyK') return menu.toggleSkills()
  if (e.code === 'KeyM') return menu.toggleMap()
  if (e.code === 'KeyL') return menu.toggleQuests()
  if (e.code === 'KeyQ' && !e.repeat && !menu.anyOpen && !dev.open) return send({ t: 'dash' })
  if (e.code === 'KeyJ') return menu.journalOpen ? menu.close() : (menu.openJournal(), hud.seenJournal())
  if (menu.anyOpen || dev.open) return
  const dir = KEY_DIR[e.code]
  if (dir) {
    if (!held.includes(dir)) held.push(dir)
    syncMove()
    e.preventDefault()
    return
  }
  if (building.open) {
    if (e.code === 'KeyE' && !e.repeat) building.place()
    if (['KeyE', 'KeyF', 'Space', 'Tab'].includes(e.code)) e.preventDefault()
    return
  }
  // Space: the attack key, a blow ahead on the press and again while it is held
  if (e.code === 'Space') return void (e.preventDefault(), setAttack(true))
  if (e.repeat) return
  // Tab: the next row of the bag becomes the toolbar (Shift+Tab: the previous one)
  if (e.code === 'Tab') return void (e.preventDefault(), send({ t: 'row', dir: e.shiftKey ? -1 : 1 }))
  const key = KEY_OF[e.code]
  if (key) return press(key, mouseTile)
  const slot = SLOT_CODES.indexOf(e.code)
  if (slot >= 0) send({ t: 'select', slot })
})
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') return setAttack(false)
  const key = KEY_OF[e.code]
  if (key) return release(key)
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    shift = false
    sentDir = null
    syncMove()
  }
  const dir = KEY_DIR[e.code]
  if (!dir) return
  const i = held.indexOf(dir)
  if (i >= 0) held.splice(i, 1)
  syncMove()
})
window.addEventListener('blur', () => stopMoving())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && slot && !cover.open) send({ t: 'save' })
})

// ------------------------------------------------------------------ mouse: aim at the pointed tile within two rings; left = use, right = put

let mouseTile: Tile | undefined
/** The pointer's screen point while it is over the world. */
let mouseAt: { x: number; y: number } | undefined
const aimSig = (a?: Tile) => (a ? `${a.x},${a.y}|${(a.stack ?? []).map((r) => r.e).join(' ')}` : '')
/** Aim at what is drawn under the pointer: it changes as things move, not only as the mouse does. */
function reaim(): void {
  const a = mouseAt ? scene.aimAtScreen(mouseAt.x, mouseAt.y) : undefined
  building.setAim(a)
  if (aimSig(a) === aimSig(mouseTile)) return
  mouseTile = a
  send({ t: 'aim', tile: a })
}
const gameEl = document.getElementById('game')!
window.addEventListener('mousemove', (e) => {
  // only over the world itself (the HUD's own panels take their own clicks)
  const over = e.target === gameEl || gameEl.contains(e.target as Node) || (e.target as HTMLElement).id === 'hud' || (e.target as HTMLElement).id === 'labels'
  mouseAt = over ? { x: e.clientX, y: e.clientY } : undefined
  reaim()
})
gameEl.addEventListener('contextmenu', (e) => e.preventDefault())
gameEl.addEventListener('mousedown', (e) => {
  if (hud.chooserOpen) return hud.closeChooser()
  if (hud.questionShown) return
  if (hud.dialogOpen) return hud.advanceDialog()
  if (menu.anyOpen || dev.open) return
  const tile = scene.aimAtScreen(e.clientX, e.clientY)
  if (building.open) {
    if (e.button === 0 && tile) building.place(tile)
    if (e.button === 2) building.toggle(false)
    return
  }
  if (e.button === 0) press('use', tile)
  if (e.button === 2) press('put', tile)
})
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) release('use')
  if (e.button === 2) release('put')
})
window.addEventListener(
  'wheel',
  (e) => {
    if (menu.anyOpen || dev.open || hud.dialogOpen || building.open) return
    if ((e.target as HTMLElement).closest('.overlay, .panel')) return
    send({ t: 'cycle', dir: e.deltaY > 0 ? 1 : -1 })
  },
  { passive: true },
)

// ------------------------------------------------------------------ per animation frame

function raf(now: number) {
  frames++
  if (now - last > 1000) {
    fps = (frames * 1000) / (now - last)
    frames = 0
    last = now
  }
  hud.tickLabels()
  building.tick()
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)
