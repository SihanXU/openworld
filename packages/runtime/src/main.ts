// Boot: Phaser (render) + engine Worker (simulation) + DOM UI, wired by messages. The input
// (design.md §5.2): four inputs, one verb each — E hands, F take, left click use, right click
// put — aimed at the pointed tile within two rings (E, F: else the tile in front); Esc menu, I
// inventory, J journal, M map.

import Phaser from 'phaser'
import { CEILING, type Dir, type Frame, type ItemInfo, type Key, type LibraryData, type Mood, type SaveData, type Text } from '@openworld/engine'
import { catalog, hasModule, libraryKey, newWorker, savesKey, worldBase } from './game.ts'
import type { FromWorker, Tile, ToWorker } from './protocol.ts'
import { cssAssetUrl, registerArt } from './render/assets.ts'
import { WorldScene } from './render/scene.ts'
import { kvGet, kvSet } from './storage.ts'
import { writeSlot, type Slot } from './saves.ts'
import { Cover } from './ui/cover.ts'
import { DeathScreen } from './ui/death.ts'
import { locale, t, tx } from './ui/common.ts'
import { ModConsole } from './ui/dev.ts'
import { Hud } from './ui/hud.ts'
import { BuildingMode, setLearnedPlaceables } from './ui/building.ts'
import { LessonGuide } from './ui/lesson.ts'
import { Menu, setLearnedRecipes } from './ui/menu.ts'
import { PeoplePanels } from './ui/people.ts'
import { SkillBar } from './ui/skillbar.ts'
import { Tooltip, setLearnedStatuses } from './ui/tooltip.ts'
import { Minimap } from './ui/worldmap.ts'
import { AfterSave } from './afterSave.ts'
import './styles.css'
import './ui/game.css'
import './ui/polish.css'

const PARAMS = new URLSearchParams(location.search)
/** Where this game's saves are kept (its own, beside other games' on the same page). */
const WORLD = savesKey()
/** The modder service: ?modder=<url> (or =off), else VITE_MODDER_URL, else a local one in development. */
const MODDER = PARAMS.get('modder') === 'off' ? undefined : PARAMS.get('modder') || import.meta.env.VITE_MODDER_URL || (import.meta.env.DEV ? 'http://localhost:8787' : undefined)
const scene = new WorldScene()
const worker = newWorker()
const send = (m: ToWorker) => worker.postMessage(m)
// dev-only hook for scripted testing from the console
// development: lsw.god() toggles the player's invulnerability (lsw.god(true) / lsw.god(false)); ?god=1 turns it on at start
if (import.meta.env.DEV) (window as unknown as { lsw: unknown }).lsw = { send, scene, god: (on?: boolean) => send({ t: 'debug', op: 'god', on }) }
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
  wear: (item, putOn) => send({ t: 'wear', item, putOn }),
  craft: (id, all) => send({ t: 'craft', id, all }),
  learn: (id) => send({ t: 'learn', id }),
  setSkill: (slot, id) => send({ t: 'setSkill', slot, id }),
  atlas: () => send({ t: 'atlas' }),
  travel: (waypoint) => send({ t: 'travel', waypoint }),
  profession: (id) => send({ t: 'profession', id }),
  speak: (who, verb, choice) => send({ t: 'speak', who, verb, ...(choice && { choice }) }),
  offer: (target, item, count) => send({ t: 'offer', target, item, count }),
  track: (id) => send({ t: 'track', id }),
  board: (who, ref) => send({ t: 'board', who, ref }),
  boon: (id) => send({ t: 'boon', id }),
  transfer: (from, item, all) => send({ t: 'transfer', from, item, all }),
  closePanel: () => send({ t: 'closePanel' }),
  save: () => send({ t: 'save' }),
  // back to the cover: the game is saved to its slot first, and the cover reads the slot once it is written
  newGame: () => {
    afterSave.then(() => void cover.show())
    send({ t: 'save' })
  },
  toggleLocale: () => {
    locale.set(locale.value === 'en' ? 'zh' : 'en')
    hud.relabel()
    minimap.relabel()
  },
  toggleSound: () => hud.toggleSound(),
  devConsole: () => dev.toggle(true),
  keyOnItem: (key, item) => send({ t: 'keyOnItem', key, item }),
})
// (dev: the panels, for checking them by hand)
if (import.meta.env.DEV) Object.assign((window as unknown as { lsw: object }).lsw, { menu })

const hud = new Hud(
  {
    select: (slot) => send({ t: 'select', slot }),
    answer: (yes) => send({ t: 'answer', yes }),
    advance: () => send({ t: 'advance' }),
    openJournal: () => (menu.openJournal(), hud.seenJournal(), (codexSeen = -1)),
    toggleInventory: () => openPanel('bag', () => menu.toggle('inventory')),
    toggleCraft: () => openPanel('craft', () => menu.toggle('craft')),
    toggleOptions: () => menu.toggle('options'),
    toggleSkills: () => menu.toggleSkills(),
    toggleQuests: () => (menu.toggleQuests(), document.getElementById('questBtn')?.classList.remove('flash')),
    toggleSkillPanel: () => menu.toggleSkillPanel(),
    toggleBuilding: () => toggleBuilding(),
    talk: (verb) => send({ t: 'talk', verb }),
    closeTalk: () => send({ t: 'closeTalk' }),
  },
  (id) => scene.screenOf(id),
  (x, y) => scene.screenOfTile(x, y),
  { feetOf: (id) => scene.feetOf(id), still: (ms) => scene.playerStill(ms) },
)
menu.muted = hud.muted
/** A merchant's trade and a person's pockets (docs/npc-sandbox.md §2.10). */
const people = new PeoplePanels({
  trade: (item, buy) => send({ t: 'trade', item, buy }),
  closeTrade: () => send({ t: 'closeTrade' }),
  pocket: (item, take) => send({ t: 'pocket', item, take }),
  closePockets: () => send({ t: 'closePockets' }),
})
/** The skill bar, bottom left (Shift+1–6). */
const skillbar = new SkillBar({ cast: (slot) => send({ t: 'cast', slot }), set: (slot, id) => send({ t: 'setSkill', slot, id }) })
const minimap = new Minimap(() => openPanel('map', () => menu.toggleMap()))
/** The tutorial's lessons (docs/prologue.md, the drills): the spotlight, the key to press, the tick. */
const lessons = new LessonGuide({ of: (id) => scene.screenOf(id), ofTile: (x, y) => scene.screenOfTile(x, y), cells: (c) => scene.setLessonCells(c) })
/**
 * Open a panel the player asked for (the bag, crafting, the map): unless a lesson at hand locks it;
 * opened, the story hears of it (a lesson may wait on it). Closing is never locked.
 */
function openPanel(what: 'bag' | 'craft' | 'map', open: () => void): void {
  if (!menu.anyOpen && !lessons.allows(what)) return
  const was = menu.anyOpen
  open()
  if (!was && menu.anyOpen) send({ t: 'ui', what })
}
const building = new BuildingMode(send, (x, y) => ({ ...scene.screenOfTile(x, y), scale: scene.cameras.main.zoom }))
// the palette opened or shut: the left click's ceiling (R by hand) is let go, the palette has its own
building.onView = (open, ceilings) => {
  if (handUp) ((handUp = false), send({ t: 'handUp', up: false }))
  scene.setBuildView(open, ceilings)
}
function toggleBuilding(): void {
  if (menu.anyOpen || dev.open || hud.dialogOpen || hud.questionShown || hud.chooserOpen || !lastFrame || !document.getElementById('intro')!.classList.contains('hidden')) return
  if (!building.open && !lessons.allows('build')) return
  if (pressing) { clearTimeout(pressing.timer); pressing = undefined }
  setAttack(false)
  building.toggle()
  if (building.open) send({ t: 'ui', what: 'build' })
}

/** Minecraft's tooltip over any item in the toolbar, the bag, a chest or the crafting panel. */
const tooltip = new Tooltip(() => ({
  atk: Number(lastFrame?.player.props.atk ?? 0),
  profession: typeof lastFrame?.player.props.profession === 'string' ? lastFrame.player.props.profession : undefined,
  // a set's pieces worn, one per slot (World.stat: two of its rings count once)
  sets: Object.fromEntries(
    Object.entries(
      Object.values(lastFrame?.player.worn ?? {}).reduce<Record<string, Set<string>>>((n, it) => (typeof it.props.set === 'string' && (n[it.props.set] ??= new Set()).add(String(it.props.slot)), n), {}),
    ).map(([id, slots]) => [id, slots.size]),
  ),
  nameOf: (id) => {
    const e = lastFrame?.entities.find((x) => x.id === id)
    return e ? tx(e.name) : undefined
  },
}))
menu.registerTip = (key, info) => tooltip.register(key, info)
if (catalog().ui.drumstick) document.documentElement.style.setProperty('--drum-icon', cssAssetUrl(catalog().ui.drumstick.img))
// what a new thread is called in the player's language: its doc is the model's English (the
// Threadbook's), so in Chinese its label says it, when it names no one ("拔草"), else nothing more
hud.threadDoc = (rule) => {
  const r = menu.library?.patches.find((x) => x.id === rule)
  if (!r || locale.value !== 'zh') return r?.doc
  const l = r.label && tx(r.label)
  return l && !l.includes('{') ? l : undefined
}

/** The latest frame (for aiming the chooser), and the chooser's handler (set below). */
let lastFrame: Frame | undefined
let onChoices: ((key: Key, tile: Tile | undefined, list: { layer: number; name: Text; label?: Text; unknown?: boolean }[]) => void) | undefined

scene.hooks = {
  onFrame: (f) => {
    lastFrame = f
    const was = death.open
    // the title or the load panel is over the world (one chose to load a save, or to go back): the
    // world behind it may still lie fallen, but the death screen is not shown over them
    // (the cover opens a moment after the choice: a frame meanwhile may have shown it again)
    if (!cover.open) death.onFrame(f)
    else if (death.open) death.hide()
    // a hardcore game's one life is spent: its slot keeps the end
    if (!was && death.open && f.fallen?.difficulty === 'hardcore') send({ t: 'save' })
    hud.onFrame(f)
    skillbar.onFrame(f)
    menu.onFrame(f)
    tooltip.onFrame(f)
    dev.onFrame(f)
    building.onFrame(f)
    lessons.onFrame(f)
    if (import.meta.env.DEV) (window as unknown as { lsw: { frame?: unknown } }).lsw.frame = f
    syncPause()
  },
  onFx: (fx, f) => (hud.onFx(fx, f), lessons.onFx(fx)),
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
const faceset = (id: string, mood?: Mood) => {
  // a look's portrait, the anime bust (docs/looks.md); while its layers are still coming, the sprite's head
  const bust = scene.portraitOf(id, mood)
  if (bust) {
    const c = document.createElement('canvas')
    c.width = bust.width
    c.height = bust.height
    c.getContext('2d')!.drawImage(bust, 0, 0)
    c.dataset.bust = '1'
    return c
  }
  const look = scene.lookOf(id)
  if (look?.img.startsWith('fig/')) return crop(look.img, 0, 4, 16, 16)
  const f = scene.faceOf(id, mood)
  if (!f || !scene.textures.exists(f.img)) return undefined
  const src = scene.textures.get(f.img).getSourceImage() as HTMLImageElement
  const w = src.width / f.frames
  return crop(f.img, f.frame * w, 0, w, src.height)
}
hud.facesetOf = faceset
menu.facesetOf = faceset

const paintIcons = (items: ItemInfo[]) => {
  for (const it of items) {
    // an item's own icon, else (a thing that is built: a workbench, a bed) the picture it stands as
    const d = it.sprite.startsWith('art:') && scene.textures.exists(it.sprite) ? { img: it.sprite, x: 0, y: 0, w: 16, h: 16 } : (catalog().items[it.sprite] ?? catalog().fixtures[it.sprite]?.base)
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
    const a = catalog().characters[el.dataset.look!]
    const path = a?.faceset ? `${a.dir}/${a.faceset}` : undefined
    if (!path || !scene.textures.exists(path)) return
    const src = scene.textures.get(path).getSourceImage() as HTMLImageElement
    const c = crop(path, 0, 0, src.width, src.height)
    if (c) el.appendChild(c)
  })
}
hud.paintIcons = paintIcons
menu.paintIcons = paintIcons
people.paintIcons = paintIcons
building.paint = (sprite, across) => {
  // a learned thing's own picture (a texture `art:<id>`)
  if (sprite.startsWith('art:') && scene.textures.exists(sprite)) return crop(sprite, 0, 0, 16, 16)
  const f = catalog().fixtures[sprite]
  const d = (across && f?.across) || f?.base || catalog().items[sprite]
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
      if (import.meta.env.DEV && PARAMS.get('god') === '1') send({ t: 'debug', op: 'god', on: true })
      break
    case 'map':
      hud.setMapName(m.map.name)
      scene.setMap(m.map)
      minimap.setMap(m.map)
      break
    case 'atlas':
      menu.worldmap.onAtlas(m.atlas)
      break
    case 'codex':
      menu.onCodex(m.codex)
      break
    case 'frame':
      // the tutorial on its own ends where its way out leads: back to the title
      if (tutorialRun && m.frame.map !== 'tutorial' && !cover.open) {
        tutorialRun = false
        hud.message(locale.value === 'zh' ? '教程完成！从标题页开始新游戏，进入主线。' : 'Tutorial complete! Start a new game from the title for the story.', 'good')
        void cover.show()
        break
      }
      hud.setLearning(m.learning)
      // the ceiling (R) is for a floor in hand: another thing taken in hand lays on one's storey again
      if (handUp && !laysInHand(m.frame)) setHandUp(false)
      if (building.open) m.frame.keys = undefined
      scene.applyFrame(m.frame)
      minimap.onFrame(m.frame)
      people.onFrame(m.frame)
      // a rule opened one of the player's panels (a trainer: the choice of profession)
      if (m.frame.fx.some((x) => x.t === 'panel' && x.panel === 'profession')) menu.openProfession()
      // the home ground's heart: its widenings
      if (m.frame.fx.some((x) => x.t === 'panel' && x.panel === 'haven')) menu.openHomestead()
      // the commission board read (docs/quests.md §3): the favours on offer
      const board = m.frame.fx.find((x) => x.t === 'panel' && x.panel === 'board')
      if (board && board.t === 'panel' && board.by) menu.openBoard(board.by)
      // the companion spoken to: her panel, on the road; a woken waypoint statue: on the seals' powers
      if (m.frame.fx.some((x) => x.t === 'panel' && x.panel === 'companion')) menu.openCompanion('guide')
      else if (m.frame.fx.some((x) => x.t === 'panel' && x.panel === 'boons')) menu.openCompanion('powers')
      // a shop: the Held Ground's stall, a store's counter, a bookstand (`shop:<station>`), on its shelves
      const shop = m.frame.fx.find((x) => x.t === 'panel' && (x.panel === 'shop' || x.panel.startsWith('shop:')))
      if (shop && shop.t === 'panel') menu.openShop(shop.panel === 'shop' ? 'stall' : shop.panel.slice(5))
      reaim()
      dev.setPerf(m.perf, fps)
      // the open codex follows what is met
      if (menu.journalOpen && m.codex !== codexSeen) ((codexSeen = m.codex), send({ t: 'codex' }))
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
      void (slot ? writeSlot(WORLD, slot, { save: m.save, summary: m.summary, savedAt: m.save.savedAt }) : Promise.resolve()).then(() => afterSave.written())
      void kvSet(libraryKey(), m.library).then(storeSeq)
      // the tutorial on its own keeps no save; an automatic save says nothing
      if (!cover.open && !quietSave && !m.auto) hud.message(slot ? t('savedSlot').replace('{n}', String(slot)) : locale.value === 'zh' ? '教程不保存进度。' : 'The tutorial keeps no save.', slot ? 'good' : undefined)
      quietSave = false
      break
    case 'library':
      setLearnedStatuses(m.statuses ?? m.library.statuses ?? [])
      void kvSet(libraryKey(), m.library).then(storeSeq)
      break
    case 'synced':
      // a position is only worth the library it was reached with: stored after it, if it changed
      syncedTo = { url: m.url, seq: m.seq }
      if (!m.changed) void storeSeq()
      break
    case 'modder':
      dev.setModder(m)
      hud.modderOnline = m.online
      break
    case 'art':
      for (const a of m.arts) registerArt(scene, a.id, a.art)
      break
    case 'recipes':
      setLearnedRecipes(m.recipes)
      setLearnedPlaceables(m.recipes)
      if (menu.menuOpen && (menu.tab === 'craft' || menu.tab === 'shop')) menu.render()
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
      // a slot that could not start leaves the cover up: it says why, instead of loading for ever
      if (!document.getElementById('intro')!.classList.contains('hidden')) cover.failed(m.message.split('\n')[0].replace(/^Error: /, ''))
      else if (import.meta.env.DEV) hud.message(m.message.split('\n')[0], 'warn')
      break
  }
}

// ------------------------------------------------------------------ the cover and the save slots

/** The slot being played (autosaves and the menu's Save write to it). */
let slot: Slot | undefined
/** What waits for the save being written (back to the title). */
const afterSave = new AfterSave()
/** How far the stored library has synced this modder's shared log (another service's position is no use). */
let syncedTo: { url: string; seq: number } | undefined
async function storeSeq(): Promise<void> {
  const s = syncedTo
  syncedTo = undefined
  if (s) await kvSet(`${libraryKey()}Seq`, s)
}
async function librarySeq(): Promise<number | undefined> {
  const s = await kvGet<{ url: string; seq: number }>(`${libraryKey()}Seq`)
  return s && MODDER && s.url === MODDER.replace(/\/+$/, '') ? s.seq : undefined
}
/** The save the slot started from (undefined: a new game). */
let startingFrom: SaveData | undefined
/** The save right after loading is not announced. */
let quietSave = false
/** The tutorial played on its own (from the title): no slot, and walking out of the clearing ends it. */
let tutorialRun = false
/** The codex version the open codex shows (-1: ask again on opening). */
let codexSeen = -1

const cover = new Cover(WORLD, {
  start: async (s, data, game) => {
    slot = s
    tutorialRun = false
    startingFrom = data?.save
    quietSave = true
    const library = await kvGet<LibraryData>(libraryKey())
    const base = worldBase()
    send({ t: 'init', base, save: data?.save, library, librarySeq: await librarySeq(), modder: MODDER, prefetch: PARAMS.get('prefetch') === '1', difficulty: game?.difficulty, start: game?.start, look: game?.look })
  },
  tutorial: async () => {
    // its own run: nothing is saved, and the story's main line is not reached from it
    slot = undefined
    tutorialRun = true
    startingFrom = undefined
    quietSave = true
    const library = await kvGet<LibraryData>(libraryKey())
    const base = worldBase()
    send({ t: 'init', base, library, librarySeq: await librarySeq(), modder: MODDER, start: 'tutorial' })
  },
  toggleLocale: () => {
    locale.set(locale.value === 'en' ? 'zh' : 'en')
    hud.relabel()
    minimap.relabel()
  },
})
/**
 * A playtest (the editor's, docs/engine-split.md P4): `?playtest=1`, a new game at once with nothing saved, at
 * the world's start or at the cell `?at=<map>,<x>,<y>`.
 */
const playtest = PARAMS.get('playtest') === '1'
if (playtest) {
  // (no cover: the page's loading note goes as the cover's would)
  document.getElementById('loading')?.remove()
  const [map, x, y] = (PARAMS.get('at') ?? '').split(',')
  const at = map && Number.isFinite(Number(x)) && Number.isFinite(Number(y)) ? { map, x: Number(x), y: Number(y) } : undefined
  slot = undefined
  quietSave = true
  void (async () => send({ t: 'init', base: worldBase(), library: await kvGet<LibraryData>(libraryKey()), modder: MODDER, prefetch: PARAMS.get('prefetch') === '1', ...(at && { at }) }))()
} else void cover.show()

// the death screen: the world stops; rise again, load a save, or back to the title
const death = new DeathScreen({
  rise: (home) => send({ t: 'respawn', home }),
  load: () => void cover.show('load'),
  title: () => void cover.show(),
})

// ------------------------------------------------------------------ time stops while something is open

let pausedNow = false
function syncPause(): void {
  const on = menu.anyOpen || hud.dialogOpen || hud.chooserOpen || dev.open || death.open || !document.getElementById('intro')!.classList.contains('hidden')
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
scene.walking = () => held.length > 0
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

// The five inputs (design.md §5.2): E hands, F take, G put, left click use (the held thing, or a
// bare blow), right click use on oneself. A short press acts on the top of what is drawn where the
// pointer is; a long press opens the chooser of all of it the input reaches (people, things, items,
// the ground), so every event is reachable.
const LONG_MS = 380
const KEY_OF: Record<string, Key> = { KeyE: 'hands', KeyF: 'take', KeyG: 'put' }
const KEY_NAME: Record<Key, string> = { hands: 'E', take: 'F', put: 'G', use: 'L', self: 'R' }
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
/**
 * The chooser's list arrived (after a long press): pick a layer, then the input acts on it. Time
 * stood still while it was open: it runs again before the key goes (a key while paused is dropped).
 */
onChoices = (key, tile, list) =>
  // nothing the input reaches there (F held on a person): no list to choose from, and time does not stop for one
  list.length &&
  hud.showChooser(KEY_NAME[key] === 'L' ? t('lmb') : KEY_NAME[key] === 'R' ? t('rmb') : KEY_NAME[key], tile ?? aimFront(), list, (layer) => (syncPause(), send({ t: 'ui', what: 'chooser' }), send({ t: 'key', key, tile, layer })))

/** Esc held this long skips the lesson at hand (docs/prologue.md, the drills). */
const ESC_SKIP_MS = 2000
let escHold: ReturnType<typeof setTimeout> | undefined

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
  // the death screen and the title take no keys: their buttons are what may follow (no journal over them)
  if (death.open || cover.open) return
  // the world waits on the player's act: Esc does not wait (the act's default now)
  if (hud.learning && e.code === 'Escape') return void (e.preventDefault(), send({ t: 'skipLearning' }))
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
  // a talk open (docs/npc-sandbox.md §2.9): a number says that verb; Esc says goodbye (a guard's arrest must be answered)
  if (hud.talkOpen && !menu.anyOpen) {
    const n = Number(e.key)
    if (n >= 1 && n <= 9) return void (e.preventDefault(), hud.sayNth(n))
    if (e.code === 'Escape') return void (e.preventDefault(), hud.arrestOpen || send({ t: 'closeTalk' }))
  }
  // a merchant's trade or a person's pockets: Esc closes it
  if (people.open && e.code === 'Escape') return void (e.preventDefault(), people.close())
  if (people.open) return
  // a person's line open: F and G put it away and act (a turn-in's thanks does not hold up the next one)
  if (hud.dialogOpen && !menu.anyOpen && (e.code === 'KeyF' || e.code === 'KeyG') && hud.dismissLine()) syncPause()
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
    // a lesson at hand: held two seconds, Esc skips it; a short press still opens the menu (on release)
    if (lessons.active) {
      if (!e.repeat && !escHold) escHold = setTimeout(() => ((escHold = undefined), send({ t: 'lessonSkip' })), ESC_SKIP_MS)
      return
    }
    return menu.open('options')
  }
  if (e.code === 'KeyI') return openPanel('bag', () => menu.toggle('inventory'))
  if (e.code === 'KeyC') return openPanel('craft', () => menu.toggle('craft'))
  if (e.code === 'KeyK') return hasModule('classes') ? menu.toggleSkills() : undefined
  if (e.code === 'KeyM') return openPanel('map', () => menu.toggleMap())
  if (e.code === 'KeyL') return void (menu.toggleQuests(), document.getElementById('questBtn')?.classList.remove('flash'))
  if (e.code === 'KeyU') return hasModule('classes') ? menu.toggleSkillPanel() : undefined
  if (e.code === 'KeyQ' && !e.repeat && !menu.anyOpen && !dev.open) return send({ t: 'dash' })
  // X: draw one's weapon (a blow on a person is meant), or put it away; V: walk soft (docs/npc-sandbox.md)
  if (e.code === 'KeyX' && !e.repeat && !menu.anyOpen && !dev.open) return send({ t: 'toggle', what: 'drawn' })
  if (e.code === 'KeyV' && !e.repeat && !menu.anyOpen && !dev.open) return send({ t: 'toggle', what: 'sneaking' })
  if (e.code === 'KeyJ') return menu.journalOpen ? menu.close() : (menu.openJournal(), hud.seenJournal(), (codexSeen = -1))
  // Shift+1–6: the skill bar — over the skill tree, set the active skill under the pointer in that slot; else cast it
  const bar = e.shiftKey && !e.repeat ? SLOT_CODES.indexOf(e.code) : -1
  if (bar >= 0 && bar < 6) {
    e.preventDefault()
    if (menu.skillsOpen) {
      const id = menu.hoveredSkill()
      if (id) send({ t: 'setSkill', slot: bar, id })
      return
    }
    if (!menu.anyOpen && !dev.open) return send({ t: 'cast', slot: bar })
  }
  if (menu.anyOpen || dev.open) return
  const dir = KEY_DIR[e.code]
  if (dir) {
    if (!held.length) pointerStill = true
    if (!held.includes(dir)) held.push(dir)
    syncMove()
    e.preventDefault()
    return
  }
  if (building.open) {
    if (e.code === 'KeyE' && !e.repeat) building.place()
    // R: turn what is set down (stairs go up the way it points)
    if (e.code === 'KeyR' && !e.repeat) building.rotate()
    if (['KeyE', 'KeyF', 'KeyG', 'Space', 'Tab'].includes(e.code)) e.preventDefault()
    return
  }
  // R with a floor in hand: the left click lays it in the ceiling (as the palette's R), and back
  if (e.code === 'KeyR' && !e.repeat && laysInHand(lastFrame)) return void setHandUp(!handUp)
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
  if (e.code === 'Escape') {
    // released before the lesson was skipped: a short press, the menu
    if (escHold) (clearTimeout(escHold), (escHold = undefined), menu.open('options'))
    return
  }
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
  // the tab going to the background saves, said to no one (it comes and goes with every switch)
  if (document.visibilityState === 'hidden' && slot && !cover.open) (quietSave = true), send({ t: 'save' })
})


// ------------------------------------------------------------------ mouse: aim at the pointed tile (as far as an input reaches); left = use, right = on oneself

let mouseTile: Tile | undefined
/** The pointer's screen point while it is over the world. */
let mouseAt: { x: number; y: number } | undefined
/**
 * The pointer has not moved since the keys last began to walk. Until it does, it aims at nothing (the
 * spot in front is aimed at): the world scrolling under a still pointer is not the player pointing, the
 * spot toward it would change at every step, and one who walked up to something with the keys means it.
 */
let pointerStill = false
const aimSig = (a?: Tile) => (a ? `${a.x},${a.y}|${(a.stack ?? []).map((r) => r.e).join(' ')}` : '')
/** Aim at what is drawn under the pointer: it changes as things move, not only as the mouse does. */
function reaim(): void {
  const a = mouseAt && !pointerStill ? scene.aimAtScreen(mouseAt.x, mouseAt.y) : undefined
  building.setAim(a)
  if (aimSig(a) === aimSig(mouseTile)) return
  mouseTile = a
  send({ t: 'aim', tile: a })
  // building by hand, the left button held: each new cell the pointer enters gets one too
  if (handDrag && a) {
    const cell = handCell(a)
    if (cell !== handDrag) ((handDrag = cell), send({ t: 'key', key: 'use', tile: a, drag: true, ...(handUp && { layer: CEILING }) }))
  }
}

// ------------------------------------------------------------------ building by hand: the left click sets a built thing down (docs/building.md)

/** The left button is down on a cell where what is held is set down: the cell last built (`x,y`), so a drag builds a row. */
let handDrag: string | undefined
/** The left click lays the floor in hand in the ceiling (R), not on one's storey. */
let handUp = false
/** A floor is in hand (R lays it in the ceiling instead). */
const laysInHand = (f?: Frame) => f?.player.held?.type === 'structure/floor'
/** The cell a click builds in: laying the ceiling, the one whose ceiling is drawn at the pointer. */
const handCell = (a: Tile) => (handUp ? `${a.over?.x ?? a.x},${a.over?.y ?? a.y + 1}` : `${a.x},${a.y}`)
function setHandUp(up: boolean): void {
  handUp = up
  send({ t: 'handUp', up })
  // laying the ceiling, one sees one's own storey and the ceilings where they are drawn (as in the palette)
  if (!building.open) scene.setBuildView(up, up)
}
const gameEl = document.getElementById('game')!
window.addEventListener('mousemove', (e) => {
  // only over the world itself (the HUD's own panels take their own clicks)
  const over = e.target === gameEl || gameEl.contains(e.target as Node) || (e.target as HTMLElement).id === 'hud' || (e.target as HTMLElement).id === 'labels'
  if (!mouseAt || mouseAt.x !== e.clientX || mouseAt.y !== e.clientY) pointerStill = false
  mouseAt = over ? { x: e.clientX, y: e.clientY } : undefined
  reaim()
})
gameEl.addEventListener('contextmenu', (e) => e.preventDefault())
gameEl.addEventListener('mousedown', (e) => {
  if (hud.chooserOpen) return hud.closeChooser()
  if (hud.questionShown) return
  if (hud.dialogOpen) return hud.advanceDialog()
  if (menu.anyOpen || dev.open) return
  // a click points, as a move of the pointer does
  if (pointerStill) ((pointerStill = false), reaim())
  const tile = scene.aimAtScreen(e.clientX, e.clientY)
  if (building.open) {
    if (e.button === 0 && tile) building.press(tile)
    if (e.button === 2) building.toggle(false)
    return
  }
  // what is held sets down here (it builds): at once, and again in each cell dragged over (no chooser on a long press)
  if (e.button === 0 && tile && lastFrame?.keys?.use?.sets) {
    handDrag = handCell(tile)
    return send({ t: 'key', key: 'use', tile, ...(handUp && { layer: CEILING }) })
  }
  if (e.button === 0) press('use', tile)
  if (e.button === 2) press('self', tile)
})
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) building.release()
  if (e.button === 0) handDrag = undefined
  if (e.button === 0) release('use')
  if (e.button === 2) release('self')
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
  building.hand(handUp)
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)
