import { ResearchWindow, pixelArtOf } from './ui/research.ts'
// Boot: Phaser (render) + engine Worker (simulation) + DOM UI, wired by messages. The input
// (design.md §5.2): four inputs, one verb each — E hands, F take, left click use, right click
// put — aimed at the pointed tile within two rings (E, F: else the tile in front); Esc menu, I
// inventory, J journal, M map.

import Phaser from 'phaser'
import { CEILING, type Dir, type Frame, type FxEvent, type ItemInfo, type Key, type LibraryData, type Mood, type PixelArt, type Text } from '@openworld/engine'
import { catalog, game, hasModule, libraryKey, newWorker, savesKey, worldBase } from './game.ts'
import { FishingInputLatch, routeFishingEscape, routeSpaceKeyDown, type FromWorker, type Tile, type ToWorker } from './protocol.ts'
import { assetUrl, cssAssetUrl, registerArt } from './render/assets.ts'
import { WorldScene } from './render/scene.ts'
import { kvGet, kvSet } from './storage.ts'
import { LOCAL_MODDER } from './modderProtocol.ts'
import { ai } from './ai.ts'
import { OwnModel, namedModder, ownModel } from './ownModel.ts'
import { writeSlot, type Slot } from './saves.ts'
import { Cover } from './ui/cover.ts'
import { DeathScreen } from './ui/death.ts'
import { locale, relabelKeys, t, tx } from './ui/common.ts'
import { actionOf, codeLabel, keys, setLayout, type Action } from './keymap.ts'
import { PanelTabs, type Panel } from './ui/paneltabs.ts'
import { Cursor } from './ui/cursor.ts'
import { ModConsole } from './ui/dev.ts'
import { Hud } from './ui/hud.ts'
import { FishingHud } from './ui/fishing.ts'
import { BuildingMode, setLearnedPlaceables } from './ui/building.ts'
import { LessonGuide } from './ui/lesson.ts'
import { Menu, setLearnedRecipes } from './ui/menu.ts'
import { PeoplePanels } from './ui/people.ts'
import { SkillBar } from './ui/skillbar.ts'
import { Tooltip, setLearnedStatuses } from './ui/tooltip.ts'
import { Minimap } from './ui/worldmap.ts'
import { AfterSave } from './afterSave.ts'
import { FrameDecoder } from './frameDelta.ts'
// the title's wordmark (and the map's marks) in Pixelify Sans, bundled: no font is asked of another site
import '@fontsource/pixelify-sans/latin-700.css'
import './styles.css'
import './ui/game.css'
import './ui/polish.css'
import './ui/fishing.css'
import './ui/research.css'

const PARAMS = new URLSearchParams(location.search)
/** Where this game's saves are kept (its own, beside other games' on the same page). */
const WORLD = savesKey()
/** The modder service: ?modder=<url> (or =off), else VITE_MODDER_URL, else a local one in development. */
const MODDER = PARAMS.get('modder') === 'off' ? undefined : PARAMS.get('modder') || import.meta.env.VITE_MODDER_URL || (import.meta.env.DEV ? 'http://localhost:8787' : undefined)
const scene = new WorldScene()
const worker = newWorker()
const send = (m: ToWorker) => worker.postMessage(m)

// The modder the engine asks (docs/byok.md): a service the page names (?modder=) first; else the player's own model,
// chosen in the options (its worker starts with the page when a model is kept in this browser); else the default
// service (VITE_MODDER_URL, the local one in development).
const NAMED = namedModder()
if (!NAMED && OwnModel.kept()) ownModel.start()
/** The modder now, as the engine's worker is told it: a port to the player's own (sent with the message), or an address ('': none). */
function modderNow(): { modder: string } | { modderPort: MessagePort } {
  if (NAMED) return { modder: MODDER ?? '' }
  if (ownModel.ready) return { modderPort: ownModel.port() }
  return { modder: MODDER ?? '' }
}
/** Where the modder now is (what a synced position is kept under). */
const modderWhere = (): string => (!NAMED && ownModel.ready ? LOCAL_MODDER : (MODDER ?? '').replace(/\/+$/, ''))
/** A game begun or loaded: the engine's worker is told the modder with it. */
function sendInit(m: Extract<ToWorker, { t: 'init' }>): void {
  const link = modderNow()
  worker.postMessage({ ...m, ...link }, 'modderPort' in link ? [link.modderPort] : [])
}
// the player chose another model, or none: the engine asks the modder that is now (a model of the same name: nothing to tell)
ownModel.listen((s, before) => {
  if (NAMED || s.model === before?.model) return
  const link = modderNow()
  worker.postMessage({ t: 'modder', ...('modderPort' in link ? { port: link.modderPort } : { url: link.modder }) }, 'modderPort' in link ? [link.modderPort] : [])
})
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
  moveSlot: (request, from, to, item, count, sourceCount) => send({ t: 'moveSlot', request, from, to, item, count, sourceCount }),
  quickMove: (slot) => send({ t: 'quickMove', slot }),
  drop: (slot, all, selection) => send({ t: 'drop', slot, all, ...(selection && { item: selection.item, count: selection.count, sourceCount: selection.sourceCount }) }),
  organize: () => send({ t: 'organize' }),
  wear: (item, putOn) => send({ t: 'wear', item, putOn }),
  craft: (id, all, at) => send({ t: 'craft', id, all, at }),
  cancelCraft: () => send({ t: 'cancelCraft' }),
  learn: (id) => send({ t: 'learn', id }),
  setSkill: (slot, id) => send({ t: 'setSkill', slot, id }),
  atlas: () => send({ t: 'atlas' }),
  travel: (waypoint) => send({ t: 'travel', waypoint }),
  profession: (id) => send({ t: 'profession', id }),
  restyle: (look) => send({ t: 'restyle', look }),
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
    fishingHud.relabel()
    relabelAll()
  },
  toggleSound: () => hud.toggleSound(),
  levels: () => scene.audio?.levels(),
  devConsole: () => dev.toggle(true),
  keyOnItem: (key, item) => send({ t: 'keyOnItem', key, item }),
  useItemOnHeldItem: (instrument, target) => send({ t: 'useItemOnHeldItem', instrument, target }),
  setQuality: (quality) => send({ t: 'quality', quality }),
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
    research: () => lastFrame && research.show(lastFrame),
    closeTalk: () => send({ t: 'closeTalk' }),
  },
  (id) => scene.screenOf(id),
  (x, y) => scene.screenOfTile(x, y),
)
const research = new ResearchWindow({ ask: (message) => send({ t: 'researchAsk', message }), confirm: (token) => send({ t: 'researchConfirm', token }), cancel: () => send({ t: 'researchCancel' }) })
const fishingHud = new FishingHud()
menu.muted = hud.muted
/** A merchant's trade and a person's pockets (docs/npc-sandbox.md §2.10). */
const people = new PeoplePanels({
  trade: (item, buy) => send({ t: 'trade', item, buy }),
  closeTrade: () => send({ t: 'closeTrade' }),
  pocket: (item, take) => send({ t: 'pocket', item, take }),
  closePockets: () => send({ t: 'closePockets' }),
  gift: (item) => send({ t: 'gift', item }),
  closeGift: () => send({ t: 'closeGift' }),
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
/** The panels a key opens (Tab's bag, whose tabs are the others; each its own key too: keymap.ts). */
const PANEL_OF: Partial<Record<Action, Panel>> = { bag: 'bag', craft: 'craft', skills: 'skills', skillPanel: 'skillPanel', quests: 'quests', journal: 'journal', map: 'map' }
/** A panel's key pressed: it opens, or shuts if it is the one open. */
function openTab(p: Panel): void {
  if (p === 'bag') return openPanel('bag', () => menu.toggle('inventory'))
  if (p === 'craft') return openPanel('craft', () => menu.toggle('craft'))
  if (p === 'skills') return hasModule('classes') ? menu.toggleSkills() : undefined
  if (p === 'map') return openPanel('map', () => menu.toggleMap())
  if (p === 'quests') return void (menu.toggleQuests(), document.getElementById('questBtn')?.classList.remove('flash'))
  if (p === 'skillPanel') return hasModule('classes') ? menu.toggleSkillPanel() : undefined
  if (menu.journalOpen) return menu.close()
  menu.openJournal()
  hud.seenJournal()
  codexSeen = -1
}
/** Tab's tabs over the open panel: one clicked, that panel instead. */
const panelTabs = new PanelTabs(
  () =>
    (
      [
        { id: 'bag', name: t('inventory'), action: 'bag' },
        { id: 'craft', name: t('craft'), action: 'craft' },
        ...(hasModule('classes')
          ? [
              { id: 'skills', name: locale.value === 'zh' ? '技能树' : 'Skill tree', action: 'skills' },
              { id: 'skillPanel', name: t('skills'), action: 'skillPanel' },
            ]
          : []),
        { id: 'quests', name: locale.value === 'zh' ? '任务' : 'Quests', action: 'quests' },
        { id: 'journal', name: t('codex'), action: 'journal' },
        { id: 'map', name: t('worldMap'), action: 'map' },
      ] as { id: Panel; name: string; action: Action }[]
    ),
  () => menu.page,
  (p) => {
    if (menu.page === p) return
    menu.close()
    openTab(p)
  },
)
/** Every key drawn on the screen, drawn again (the map changed, or the language). */
function relabelAll(): void {
  relabelKeys()
  panelTabs.relabel()
  skillbar.relabel()
}
keys.onChange(relabelAll)
relabelAll()
// the characters this keyboard's layout prints, where the browser tells (an AZERTY's A where QWERTY's Q is)
void (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard
  ?.getLayoutMap?.()
  .then((m) => (setLayout(m), relabelAll()))
  .catch(() => undefined)
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
  atk: lastFrame?.player.stats.atk ?? 0,
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
  paintIcon: (item) => paintIcons([item]),
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
    // (the world behind the title is only drawn: the game's panels hear nothing of it)
    if (backdropOn) return
    lastFrame = f
    research.follow(f)
    const was = death.open
    // the title or the load panel is over the world (one chose to load a save, or to go back): the
    // world behind it may still lie fallen, but the death screen is not shown over them
    // (the cover opens a moment after the choice: a frame meanwhile may have shown it again)
    if (!cover.open) death.onFrame(f)
    else if (death.open) death.hide()
    // a hardcore game's one life is spent: its slot keeps the end
    if (!was && death.open && f.fallen?.difficulty === 'hardcore') send({ t: 'save' })
    // the music stops while one lies fallen
    if (was !== death.open) scene.setDeathMusic(death.open)
    hud.onFrame(f)
    skillbar.onFrame(f)
    menu.onFrame(f)
    tooltip.onFrame(f)
    dev.onFrame(f)
    building.onFrame(f)
    lessons.onFrame(f)
    markKeys()
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
// people with a portrait of their own (docs/character-art.md): their pictures, fetched as the game starts so the first line shows them
const ownPortraits = new Map<string, HTMLImageElement>()
const ownPortrait = (path: string): HTMLImageElement | undefined => {
  let img = ownPortraits.get(path)
  if (!img) {
    img = new Image()
    img.src = assetUrl(path)
    ownPortraits.set(path, img)
  }
  return img.complete && img.naturalWidth ? img : undefined
}
for (const set of Object.values(catalog().portraits ?? {}))
  for (const m of set.moods) for (const name of [m, ...(set.blink ? [`${m}-blink`] : []), ...(set.talk ? [`${m}-talk`] : [])]) ownPortrait(`${set.dir}/${name}.webp`)
const faceset = (id: string, mood?: Mood, frame?: 'blink' | 'talk') => {
  // a portrait of their own: the mood's picture (any other mood its neutral), or that face's blink or open mouth
  const own = catalog().portraits?.[id]
  if (own) {
    const face = mood && own.moods.includes(mood) ? mood : 'neutral'
    const name = frame ? (own[frame] ? `${face}-${frame}` : undefined) : face
    const img = name && ownPortrait(`${own.dir}/${name}.webp`)
    if (!img) return undefined
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    c.dataset.bust = '1'
    c.dataset.own = '1'
    return c
  }
  if (frame) return undefined
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
    const decoration = game().itemIconDecoration?.(it)
    const decoDef = decoration && catalog().items[decoration.sprite]
    const deco = decoDef && crop(decoDef.img, decoDef.x, decoDef.y, decoDef.w, decoDef.h)
    document.querySelectorAll<HTMLElement>(`[data-icon="${CSS.escape(it.id)}"]`).forEach((slot) => {
      const copy = document.createElement('canvas')
      copy.width = c.width
      copy.height = c.height
      const context = copy.getContext('2d')!
      context.imageSmoothingEnabled = false
      context.drawImage(c, 0, 0)
      if (deco && decoration) {
        const size = decoration.size * Math.min(c.width, c.height)
        context.drawImage(deco, decoration.x * c.width, decoration.y * c.height, size, size)
      }
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
research.paintIcons = paintIcons
fishingHud.paintIcon = (item) => paintIcons([item])
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
/** The frames' things, put back together from what changed (frameDelta.ts). */
const frameThings = new FrameDecoder()
/** What the camera showed when the worker was last told (it sends what lies there). */
let viewSent = ''

/** The worker runs the world behind the title (the cover's backdrop) until a game it begins is ready: its frames are only drawn. */
let backdropOn = false
/** The place asked for has sent its map: frames from here on are its (those of the place before may still be on the way). */
let backdropHere = false

/** The backdrop's messages: its map and its frames drawn (and the pictures of learned kinds), nothing else heard. */
function onBackdrop(m: FromWorker): void {
  if (m.t === 'map') (scene.setLook(m.look), scene.setMap(m.map), (backdropHere = true))
  else if (m.t === 'art') for (const a of m.arts) registerArt(scene, a.id, a.art)
  else if (m.t === 'frame') {
    const frame = frameThings.decode(m.frame, m.gone)
    const v = scene.viewCells()
    const k = v && `${v.map}:${v.x}:${v.y}:${v.w}:${v.h}`
    if (v && k !== viewSent) (viewSent = k!), send({ t: 'view', ...v })
    scene.applyFrame(frame)
    // shown once it is really drawn: the place's own frame, on a scene whose pictures have loaded
    if (backdropHere && scene.loaded) cover.worldShown()
  } else if (m.t === 'error') {
    // the place behind could not be made: the title shows its menu over black rather than load for ever
    console.warn(`[backdrop] ${m.message}`)
    cover.reveal()
  }
}

worker.onmessage = (ev: MessageEvent<FromWorker>) => {
  const m = ev.data
  // the title's live backdrop owns the messages it draws, except a game starting (ready) or refusing to (incompatible)
  if (backdropOn && m.t !== 'ready' && m.t !== 'incompatible') return onBackdrop(m)
  switch (m.t) {
    case 'placement':
      building.onPreview(m.preview)
      break
    case 'incompatible': {
      // the chosen slot holds a save from another version of the world: nothing starts, and nothing is written over it
      slot = undefined
      quietSave = false
      void cover.show().then(() => cover.failed(t('cvIncompatible')))
      break
    }
    case 'ready':
      dev.stats = m.stats
      // (the title's camera gives way to the player's)
      backdropOn = false
      scene.setCinema(undefined)
      // (no place's music until the game's first map is drawn: not the backdrop's for a moment)
      scene.audio?.music.setPlace(undefined, '')
      cover.hide()
      // the slot is filled at once (a new game) or refreshed (a loaded one)
      send({ t: 'save' })
      if (import.meta.env.DEV && PARAMS.get('god') === '1') send({ t: 'debug', op: 'god', on: true })
      break
    case 'map':
      hud.setMapName(m.map.name)
      scene.setLook(m.look)
      scene.setMap(m.map)
      minimap.setMap(m.map)
      break
    case 'atlas':
      menu.worldmap.onAtlas(m.atlas)
      break
    case 'codex':
      menu.onCodex(m.codex)
      break
    case 'slotMove':
      menu.onMoveSlotResult(m.request, m.moved)
      break
    case 'frame':
      m.frame = frameThings.decode(m.frame, m.gone)
      {
        const v = scene.viewCells()
        const k = v && `${v.map}:${v.x}:${v.y}:${v.w}:${v.h}`
        if (v && k !== viewSent) (viewSent = k!), send({ t: 'view', ...v })
      }
      // the tutorial on its own ends where its way out leads: back to the title
      if (tutorialRun && m.frame.map !== 'tutorial' && !cover.open) {
        tutorialRun = false
        // the note belongs to the title, which is drawn over the HUD: put it where the player can read it
        const note = locale.value === 'zh' ? '教程完成！从标题页开始新游戏，进入主线。' : 'Tutorial complete! Start a new game from the title for the story.'
        void cover.show().then(() => cover.note(note))
        break
      }
      hud.setLearning(m.learning)
      menu.containerTransfer = m.transfer
      menu.crafting = m.crafting
      // the ceiling (R) is for a floor in hand: another thing taken in hand lays on one's storey again
      if (handUp && !laysInHand(m.frame)) setHandUp(false)
      const fishing = m.frame.fishing
      if (fishingWasActive && !fishing) {
        clearFishingInputs()
        setAttack(false)
      }
      fishingWasActive = !!fishing
      fishingHud.render(fishing)
      // The cast can start in the worker before its first fishing frame reaches a tab that just lost focus.
      if (fishing && (!document.hasFocus() || document.visibilityState === 'hidden')) {
        fishingBlurPaused = true
        syncPause()
      }
      if (building.open) m.frame.keys = undefined
      scene.applyFrame(m.frame)
      minimap.onFrame(m.frame)
      people.onFrame(m.frame)
      // a rule opened one of the player's panels: the runtime's own — a trainer's choice of profession, the commission
      // board's favours (docs/quests.md §3), a shop on its shelves (`shop:<station>`; `shop`: the game's first), a station's
      // recipes made at the thing opened (`station:<x>`: a forge, an anvil) —, else
      // one of the game's (ClientGame.panels, told whose rule opened it) or the runtime's for a module it uses
      const panels = m.frame.fx.filter((x): x is Extract<FxEvent, { t: 'panel' }> => x.t === 'panel')
      for (const x of panels) {
        if (x.panel === 'profession') menu.openProfession()
        else if (x.panel === 'board') x.by && menu.openBoard(x.by)
        else if (x.panel === 'shop' || x.panel.startsWith('shop:')) menu.openShop(x.panel === 'shop' ? undefined : x.panel.slice(5))
        else if (x.panel.startsWith('station:')) x.by && menu.openStation(x.panel.slice(8), x.by)
        else if (menu.openPanel(x.panel, x.by)) break
      }
      reaim()
      dev.setPerf(m.perf, fps)
      // the open codex follows what is met
      if (menu.journalOpen && m.codex !== codexSeen) ((codexSeen = m.codex), send({ t: 'codex' }))
      break
    case 'keys': {
      // what the keys would do where the pointer now aims, between frames
      aimsAnswered = Math.max(aimsAnswered, m.n ?? 0)
      if (lastFrame) lastFrame.keys = building.open ? undefined : m.keys
      markKeys()
      // the frame goes to the new spot at once, not with the next frame
      if (lastFrame) scene.focusOn(lastFrame)
      break
    }
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
      menu.ai.service = { url: m.url, online: m.online, model: m.model }
      break
    case 'art':
      for (const a of m.arts) registerArt(scene, a.id, a.art)
      break
    case 'research':
      research.receive(m)
      break
    case 'researchIcons': {
      // the icons the worker asked for, as pixel grids (a variant's icon is edited from its prototype's)
      const icons: Record<string, PixelArt> = {}
      for (const type of m.types) {
        const sprite = game().items.forms[type]?.sprite
        const d = sprite ? catalog().items[sprite] : undefined
        const c = d && crop(d.img, d.x, d.y, d.w, d.h)
        const art = c && pixelArtOf(c)
        if (art) icons[type] = art
      }
      send({ t: 'researchIcons', icons })
      break
    }
    case 'recipes':
      setLearnedRecipes(m.recipes)
      setLearnedPlaceables(m.recipes)
      if (menu.menuOpen && (menu.tab === 'craft' || menu.tab === 'shop' || menu.tab === 'station')) menu.render()
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
  return s && s.url && s.url === modderWhere() ? s.seq : undefined
}
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
    quietSave = true
    const library = await kvGet<LibraryData>(libraryKey())
    const base = worldBase()
    sendInit({ t: 'init', base, save: data?.save, library, librarySeq: await librarySeq(), prefetch: PARAMS.get('prefetch') === '1', quality: menu.ai.quality, difficulty: game?.difficulty, start: game?.start, look: game?.look })
  },
  tutorial: async (game) => {
    // its own run: nothing is saved, and the story's main line is not reached from it
    slot = undefined
    tutorialRun = true
    quietSave = true
    const library = await kvGet<LibraryData>(libraryKey())
    const base = worldBase()
    sendInit({ t: 'init', base, library, librarySeq: await librarySeq(), quality: menu.ai.quality, start: 'tutorial', difficulty: game?.difficulty, look: game?.look })
  },
  backdrop: async (s, at) => {
    backdropOn = true
    backdropHere = false
    scene.setCinema({ x: s.x, y: s.y, zoom: s.zoom, at })
    const [x, y] = s.stand ?? [s.x, s.y]
    const library = await kvGet<LibraryData>(libraryKey())
    // A title scene already reading storage must not replace the slot the player has since chosen.
    if (!cover.open || cover.starting) return
    send({ t: 'backdrop', base: worldBase(), at: { map: s.map, x, y }, hour: s.hour, library })
  },
  toggleLocale: () => {
    locale.set(locale.value === 'en' ? 'zh' : 'en')
    hud.relabel()
    minimap.relabel()
    fishingHud.relabel()
    relabelAll()
  },
  toggleSound: () => (hud.toggleSound(), (menu.muted = hud.muted)),
  muted: () => hud.muted,
  levels: () => scene.audio?.levels(),
  titleMusic: (on) => scene.setTitleMusic(on),
  ai: menu.ai,
})
// (dev: the cover, for checking it by hand)
if (import.meta.env.DEV) Object.assign((window as unknown as { lsw: object }).lsw, { cover })
/**
 * A playtest (the editor's, docs/engine-split.md P4): `?playtest=1`, a new game at once with nothing saved, at
 * the world's start or at the cell `?at=<map>,<x>,<y>`; with `?scene=<step>`, that step of the story begun at once
 * (§16 E2, "play from this scene").
 */
const playtest = PARAMS.get('playtest') === '1'
if (playtest) {
  // (no cover: the page's loading note goes as the cover's would)
  document.getElementById('loading')?.remove()
  const [map, x, y] = (PARAMS.get('at') ?? '').split(',')
  const at = map && Number.isFinite(Number(x)) && Number.isFinite(Number(y)) ? { map, x: Number(x), y: Number(y) } : undefined
  slot = undefined
  quietSave = true
  const scene = PARAMS.get('scene') ?? undefined
  void (async () => sendInit({ t: 'init', base: worldBase(), library: await kvGet<LibraryData>(libraryKey()), prefetch: PARAMS.get('prefetch') === '1', quality: menu.ai.quality, ...(at && { at }), ...(scene && { scene }) }))()
} else {
  void cover.show()
  // no model to ask: the first thing the title offers is to choose one, or to play without AI (docs/byok.md)
  void needsModel().then((needs) => needs && cover.offerModel())
}

/** Is there no model to ask: none chosen here, no service named, none skipped, the default service (if any) without one? */
async function needsModel(): Promise<boolean> {
  // (a build without the AI has no model to offer: the game plays without one)
  if (!ai || NAMED || OwnModel.kept() || OwnModel.skipped() || ownModel.ready) return false
  if (!MODDER) return true
  try {
    const health = (await (await fetch(`${MODDER.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(2500) })).json()) as { model?: string | null }
    return !health.model
  } catch {
    return true
  }
}

// the death screen: the world stops; rise again, load a save, or back to the title
const death = new DeathScreen({
  rise: (home) => send({ t: 'respawn', home }),
  load: () => void cover.show('load'),
  title: () => void cover.show(),
})

// ------------------------------------------------------------------ time stops while something is open

let pausedNow = false
let fishingBlurPaused = false
const pauseRequested = () => research.open || menu.anyOpen || hud.dialogOpen || hud.chooserOpen || dev.open || death.open || !document.getElementById('intro')!.classList.contains('hidden')
function syncPause(): void {
  const on = fishingBlurPaused || pauseRequested()
  if (on && building.open) building.toggle(false)
  if (on !== pausedNow) {
    pausedNow = on
    send({ t: 'pause', on })
    if (on) stopMoving()
  }
}

// ------------------------------------------------------------------ keyboard: every key is an action's (keymap.ts: the player's map, rebound in Options → Keys)

/** The action a key does now. */
const actOf = (e: KeyboardEvent): Action | undefined => actionOf(keys.map, e.code, e.shiftKey)
const DIR_OF: Partial<Record<Action, Dir>> = { up: 'up', down: 'down', left: 'left', right: 'right' }
/** The inputs a key makes (design.md §5.2): E the hand, G put (the clicks are the mouse's alone). */
const INPUT_OF: Partial<Record<Action, Key>> = { hands: 'hands', put: 'put' }
/** The toolbar slot (0–9) or the skill bar's (0–5) an action is, else -1. */
const slotOf = (a?: Action) => (a?.startsWith('slot') ? Number(a.slice(4)) - 1 : -1)
const castOf = (a?: Action) => (a?.startsWith('cast') ? Number(a.slice(4)) - 1 : -1)
const held: Dir[] = []
scene.walking = () => held.length > 0
let sentDir: Dir | null = null
/** The walk key is held (Shift by default): the steps go slower. */
let walkHeld = false
const syncMove = () => {
  const d = held.length ? held[held.length - 1] : null
  if (d !== sentDir) {
    sentDir = d
    send({ t: 'move', dir: d, walk: walkHeld })
  }
}
let attacking = false
const setAttack = (on: boolean) => {
  if (on === attacking) return
  attacking = on
  send({ t: 'attack', on })
}
/** The left button is down on the world for its act (a blow, a tool's work; an object used on oneself): held, a swing goes on. */
let swingingNow = false
const setSwing = (on: boolean, tile?: Tile) => {
  if (on === swingingNow) return
  swingingNow = on
  send({ t: 'primary', on, tile })
}
const fishingInputs = new FishingInputLatch()
let fishingWasActive = false
let fishingEscapeHeld = false
let suppressFishingSpace = false
const fishingView = () => lastFrame?.fishing
const fishingIsActive = () => !!fishingView()
const fishingPress = (source: 'mouse' | 'space') => {
  if (!fishingInputs.press(source)) return
  setAttack(false)
  send({ t: 'fishing', action: 'press' })
}
fishingHud.onPress = () => {
  if (!fishingIsActive() || pausedNow || pauseRequested() || hud.questionShown) return
  fishingPress('mouse')
}
const fishingRelease = (source: 'mouse' | 'space') => {
  const result = fishingInputs.release(source)
  if (result === 'last') send({ t: 'fishing', action: 'release' })
  return result !== 'none'
}
const clearFishingInputs = () => {
  if (fishingInputs.clear().length) send({ t: 'fishing', action: 'release' })
}
const stopMoving = () => {
  held.length = 0
  syncMove()
  setAttack(false)
  setSwing(false)
  clearFishingInputs()
}

const typing = () => {
  const a = document.activeElement
  return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')
}

// The inputs (design.md §5.2): E the hand (what lies loose is picked up, anything else handled: talk, open, read),
// G puts down, in or on, or hands over; the left click is the held thing's own use — a tool's work or a weapon's
// blow (nothing held: the main hand's weapon or the fist), anything else used on oneself (eat, drink, put on) —
// acting on the press and going on while held; the right click uses the held thing on what is aimed at (sow, feed,
// unlock, cook, the experiments; a built thing in hand is set up there, and dragged, a row). A press acts on the top
// of what is drawn where the pointer is; a long press of E or G, or Alt with a click, opens the chooser of all of it
// the input reaches (people, things, items, the ground, oneself, the ceiling), so every event is reachable.
const LONG_MS = 380
/** A key's press under way: its code, the input it is, where the pointer aimed. */
let pressing: { by: string; key: Key; tile?: Tile; timer: ReturnType<typeof setTimeout>; long: boolean } | undefined
/** What opened the chooser (its title). */
let chooserBy = ''

function press(by: string, key: Key, tile: Tile | undefined): void {
  if (pressing) return
  const p = { by, key, tile, long: false, timer: setTimeout(() => ((p.long = true), (chooserBy = by), send({ t: 'choices', key, tile })), LONG_MS) }
  pressing = p
}
function release(by: string): void {
  const p = pressing
  if (!p || p.by !== by) return
  clearTimeout(p.timer)
  pressing = undefined
  if (!p.long) send({ t: 'key', key: p.key, tile: p.tile })
}
/**
 * The chooser's list arrived (after a long press): pick a layer, then the input acts on it. Time
 * stood still while it was open: it runs again before the key goes (a key while paused is dropped).
 */
onChoices = (key, tile, list) =>
  // nothing the input reaches there (F held on a person): no list to choose from, and time does not stop for one
  list.length &&
  hud.showChooser(chooserBy === 'mouse0' ? t('lmb') : chooserBy === 'mouse2' ? t('rmb') : codeLabel(chooserBy, locale.value), tile ?? aimFront(), list, (layer) => (syncPause(), send({ t: 'ui', what: 'chooser' }), send({ t: 'key', key, tile, layer })))

/** Aims sent to the worker, and the last whose keys it has answered: until then, what the keys would do there is not known (the cursor and the frame wait). */
let aimsSent = 0
let aimsAnswered = 0

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
  if (research.open) return
  if (typing()) {
    if (e.key === 'Escape') (document.activeElement as HTMLElement).blur()
    return
  }
  if (!document.getElementById('intro')!.classList.contains('hidden')) return
  // the death screen and the title take no keys: their buttons are what may follow (no journal over them)
  if (death.open || cover.open) return
  // the world waits on the player's act: Esc does not wait (the act's default now)
  if (hud.learning && e.code === 'Escape') return void (e.preventDefault(), send({ t: 'skipLearning' }))
  const a = actOf(e)
  // the page's own use of these (focus, scrolling) never takes the game's keys
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault()
  if (a === 'walk') walkHeld = true
  // the layer chooser: a number picks, Esc closes
  if (hud.chooserOpen) {
    e.preventDefault()
    if (e.code === 'Escape') return hud.closeChooser()
    const n = Number(e.key)
    if (n >= 1 && n <= 9) return hud.chooseNth(n)
    return
  }
  // a yes/no question: the steps choose, the hand confirms, Esc says no
  if (hud.questionShown) {
    e.preventDefault()
    if (a && DIR_OF[a]) return hud.moveChoice()
    if (a === 'hands') return hud.confirmChoice()
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
  // a person's line open: put puts it away and acts (a turn-in's thanks does not hold up the next one)
  if (hud.dialogOpen && !menu.anyOpen && a === 'put' && hud.dismissLine()) syncPause()
  // an open dialogue: the hands (or Esc) move it on — unless a menu lies over it (Esc closes that first)
  if (hud.dialogOpen && !menu.anyOpen && (a === 'hands' || e.code === 'Escape')) {
    e.preventDefault()
    return hud.advanceDialog()
  }
  if (e.code === 'Backquote') return dev.toggle()
  if (a === 'build' && !e.repeat) return void (e.preventDefault(), toggleBuilding())
  // Esc closes what is open, else opens the menu
  if (e.code === 'Escape') {
    e.preventDefault()
    if (building.open) return building.toggle(false)
    if (dev.open) return dev.toggle(false)
    if (menu.anyOpen) return menu.close()
    if (routeFishingEscape(fishingIsActive()) === 'cancel') {
      fishingEscapeHeld = true
      clearFishingInputs()
      e.preventDefault()
      send({ t: 'fishing', action: 'cancel' })
      return
    }
    // a lesson at hand: held two seconds, Esc skips it; a short press still opens the menu (on release)
    if (lessons.active) {
      if (!e.repeat && !escHold) escHold = setTimeout(() => ((escHold = undefined), send({ t: 'lessonSkip' })), ESC_SKIP_MS)
      return
    }
    return menu.open('options')
  }
  // the panels (Tab's bag, whose tabs are the others; each its own key too)
  if (a && PANEL_OF[a] && !e.repeat) return openTab(PANEL_OF[a]!)
  if (a === 'dash' && !e.repeat && !menu.anyOpen && !dev.open) return send({ t: 'dash' })
  // draw one's weapon (a blow on a person is meant), or put it away; walk soft (docs/npc-sandbox.md)
  if (a === 'draw' && !e.repeat && !menu.anyOpen && !dev.open) return send({ t: 'toggle', what: 'drawn' })
  if (a === 'sneak' && !e.repeat && !menu.anyOpen && !dev.open) return send({ t: 'toggle', what: 'sneaking' })
  // the skill bar — over the skill tree, set the active skill under the pointer in that slot; else cast it
  const bar = e.repeat ? -1 : castOf(a)
  if (bar >= 0) {
    e.preventDefault()
    if (menu.skillsOpen) {
      const id = menu.hoveredSkill()
      if (id) send({ t: 'setSkill', slot: bar, id })
      return
    }
    if (!menu.anyOpen && !dev.open) return send({ t: 'cast', slot: bar })
  }
  if (menu.anyOpen || dev.open) return
  const dir = a && DIR_OF[a]
  if (dir) {
    if (!held.length) pointerStill = true
    if (!held.includes(dir)) held.push(dir)
    syncMove()
    // the keys aim at once (the spot in front is outlined from the first step)
    reaim()
    e.preventDefault()
    return
  }
  if (building.open) {
    if (a === 'hands' && !e.repeat) building.place()
    // the turn key: turn what is set up (stairs go up the way it points)
    if (a === 'rotate' && !e.repeat) building.rotate()
    if (a === 'hands' || a === 'put' || a === 'attack' || a === 'row' || a === 'rotate') e.preventDefault()
    return
  }
  // the turn key with a floor in hand: the right click lays it in the ceiling (as the palette's), and back
  if (a === 'rotate' && !e.repeat && laysInHand(lastFrame)) return void setHandUp(!handUp)
  // the attack key: a blow ahead on the press and again while it is held
  if (a === 'attack') {
    const route = routeSpaceKeyDown(fishingIsActive(), e.repeat, suppressFishingSpace)
    e.preventDefault()
    if (route === 'fishing-press') {
      suppressFishingSpace = true
      fishingPress('space')
    } else if (route === 'ignore') {
      if (fishingIsActive()) suppressFishingSpace = true
    } else setAttack(true)
    return
  }
  if (e.repeat) return
  // the next row of the bag becomes the toolbar
  if (a === 'row') return void (e.preventDefault(), send({ t: 'row', dir: 1 }))
  const input = a && INPUT_OF[a]
  if (input) return press(e.code, input, mouseTile)
  const slot = slotOf(a)
  if (slot >= 0) send({ t: 'select', slot })
})
window.addEventListener('keyup', (e) => {
  if (e.code === 'Escape' && fishingEscapeHeld) {
    fishingEscapeHeld = false
    return
  }
  if (e.code === 'Escape') {
    // released before the lesson was skipped: a short press, the menu
    if (escHold) (clearTimeout(escHold), (escHold = undefined), menu.open('options'))
    return
  }
  const a = actOf(e)
  if (a === 'attack') {
    suppressFishingSpace = false
    if (!fishingRelease('space')) setAttack(false)
    return
  }
  // a press under way ends on its own key's release (whatever the map says of it now)
  if (pressing?.by === e.code) return release(e.code)
  if (a === 'walk') {
    walkHeld = false
    sentDir = null
    syncMove()
  }
  const dir = a && DIR_OF[a]
  if (!dir) return
  const i = held.indexOf(dir)
  if (i >= 0) held.splice(i, 1)
  syncMove()
})
window.addEventListener('blur', () => {
  stopMoving()
  if (fishingIsActive() && !pauseRequested()) {
    fishingBlurPaused = true
    syncPause()
  }
})
const resumeFishingBlurPause = () => {
  if (!fishingBlurPaused) return
  if (!document.hasFocus() || document.visibilityState === 'hidden') return
  fishingBlurPaused = false
  syncPause()
}
window.addEventListener('focus', resumeFishingBlurPause)
document.addEventListener('visibilitychange', () => {
  // the tab going to the background saves, said to no one (it comes and goes with every switch)
  if (document.visibilityState === 'hidden' && slot && !cover.open) (quietSave = true), send({ t: 'save' })
  else resumeFishingBlurPause()
})


// ------------------------------------------------------------------ mouse: aim at the pointed tile (as far as an input reaches); left = the primary act, right = the action

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
  send({ t: 'aim', tile: a, n: ++aimsSent })
  // building by hand, the right button held: each new cell the pointer enters gets one too
  if (handDrag && a) {
    const cell = handCell(a)
    if (cell !== handDrag) ((handDrag = cell), send({ t: 'key', key: 'secondary', tile: a, drag: true, ...(handUp && { layer: CEILING }) }))
  }
}

// ------------------------------------------------------------------ building by hand: the right click sets a built thing up (docs/building.md)

/** The right button is down on a cell where what is held is set up: the cell last built (`x,y`), so a drag builds a row. */
let handDrag: string | undefined
/** The right click lays the floor in hand in the ceiling (the turn key), not on one's storey. */
let handUp = false
/** A floor is in hand (the turn key lays it in the ceiling instead). */
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
/** The pointer's mark (what the action would do at what it is over) and the tip over the frame (what each input would do): ui/cursor.ts. */
const cursor = new Cursor([gameEl], document.getElementById('labels')!, () => scene.focusRect(), () => scene.settled(), () => lastFrame && scene.screenOfTile(lastFrame.player.x, lastFrame.player.y))
scene.keysAhead = () => !mouseTile
scene.keysFresh = () => aimsAnswered >= aimsSent
if (import.meta.env.DEV) Object.assign((window as unknown as { lsw: object }).lsw, { cursor })
function markKeys(): void {
  // a frame made before the worker saw the latest aim tells the old spot's keys: the mark waits for the new
  if (aimsAnswered < aimsSent) return
  cursor.update(hud.dialogOpen ? undefined : lastFrame?.keys, mouseTile)
}
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
  if (e.button === 0 && fishingIsActive()) {
    fishingPress('mouse')
    return
  }
  // a click points, as a move of the pointer does
  if (pointerStill) ((pointerStill = false), reaim())
  const tile = scene.aimAtScreen(e.clientX, e.clientY)
  if (building.open) {
    if (e.button === 0 && tile) building.press(tile)
    if (e.button === 2) building.toggle(false)
    return
  }
  // Alt with a click: the chooser of every layer there the click reaches (the ceiling among them)
  if (e.altKey && (e.button === 0 || e.button === 2)) {
    chooserBy = `mouse${e.button}`
    return send({ t: 'choices', key: e.button === 0 ? 'primary' : 'secondary', ...(tile && { tile }) })
  }
  // the left click: the held thing's own use, at once, and while held a swing again at the pace of one
  if (e.button === 0) return setSwing(true, tile)
  if (e.button !== 2) return
  // the right click: what is held used there; a built thing set up — at once, and again in each cell dragged over
  const sets = !!tile && !!lastFrame?.keys?.secondary?.sets
  if (sets) handDrag = handCell(tile!)
  send({ t: 'key', key: 'secondary', ...(tile && { tile }), ...(sets && handUp && { layer: CEILING }) })
})
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) building.release()
  if (e.button === 2) handDrag = undefined
  if (e.button === 0) setSwing(false)
  if (e.button === 0) fishingRelease('mouse')
})
window.addEventListener(
  'wheel',
  (e) => {
    if (menu.anyOpen || dev.open || hud.dialogOpen || building.open) return
    if ((e.target as HTMLElement).closest('.overlay, .panel')) return
    // Shift: the bag's next (or last) row to the toolbar (a browser may turn a Shift wheel sideways)
    const d = e.deltaY || e.deltaX
    if (!d) return
    if (e.shiftKey) return send({ t: 'row', dir: d > 0 ? 1 : -1 })
    send({ t: 'cycle', dir: d > 0 ? 1 : -1 })
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
  panelTabs.sync()
  cursor.tick()
  building.tick()
  building.hand(handUp)
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)
