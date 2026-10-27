// The trailer's stage: the real engine and the real renderer (WorldScene, the world filter, the game's art), with
// every shot staged by a script and time stepped frame by frame, so a frame is the same however it is reached.
// Preview: the page plays it (the bar under it scrubs). Export: site/video/export.mjs calls `stage.render(f)` and
// takes each frame. Development only; nothing here is part of the game.
import '../register.ts'
// the same idle phases and dust every time a frame is made (the renderer draws a few things with Math.random)
let seed = 7
Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
import Phaser from 'phaser'
import '@openworld/runtime/src/styles.css'
import '@openworld/runtime/src/ui/game.css'
import '@openworld/runtime/src/ui/polish.css'
import { Game, RuleLibrary, snapshot, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk, type RawChunk } from '@openworld-game/content'
import { WorldScene } from '@openworld/runtime/src/render/scene.ts'
import { FILM as TRAILER, MUSIC as TRAILER_MUSIC, type Shot, type Cut } from './film.ts'
import { EVENTS_FILM } from './events.ts'
import { INTRO_FILM } from './intro.ts'
import { SURVEY_FILM } from './survey.ts'
import { EXPLAIN_FILM } from './explainfilm.ts'
import { PLACES_FILM, TOUR_FILM } from './tour.ts'
import { SCALE_FILM } from './scalefilm.ts'

// which film the stage plays (?film=): the trailer, the star map's event clips (each shot one clip, no music), or the
// channel's opening (timed to its voiceover)
const FILMS: Record<string, { shots: Shot[]; music?: typeof TRAILER_MUSIC }> = { trailer: { shots: TRAILER, music: TRAILER_MUSIC }, events: { shots: EVENTS_FILM }, intro: { shots: INTRO_FILM }, survey: { shots: SURVEY_FILM }, explain: { shots: EXPLAIN_FILM }, tour: { shots: TOUR_FILM }, places: { shots: PLACES_FILM }, scale: { shots: SCALE_FILM } }
const CHOSEN = FILMS[new URLSearchParams(location.search).get('film') ?? 'trailer'] ?? FILMS.trailer
const FILM = CHOSEN.shots
const MUSIC = CHOSEN.music
import { Overlay } from './overlay.ts'

export const FPS = 30
const W = 1920, H = 1080
/** The engine's ticks are a tenth of a second: one every third frame. */
const PER_TICK = 3

const frameEl = document.getElementById('frame')!
const overlay = new Overlay(document.getElementById('overlay')!)
const scene = new WorldScene()
let phaser: Phaser.Game
let index: WorldIndex
const maps = new Map<string, RawChunk>()
const base = `${import.meta.env.BASE_URL}world/`
const loadMap = async (id: string): Promise<RawChunk> => {
  if (!maps.has(id)) maps.set(id, await fetch(`${base}maps/${id}.json`).then((r) => r.json()))
  return maps.get(id)!
}

/** The film laid out: where each shot begins, in frames. */
const starts: number[] = []
let seconds = 0
for (const s of FILM) (starts.push(Math.round(seconds * FPS)), (seconds += s.seconds))
const total = Math.round(seconds * FPS)

/** A world for a shot: the game's index, its map, no story to take the stage, the hour the shot asks. */
async function makeGame(shot: Shot): Promise<Game> {
  const settings = structuredClone(index)
  const start = { map: shot.map, x: shot.at[0], y: shot.at[1] }
  Object.assign(settings, { start, steps: [], quests: [], invariants: [], startHour: shot.hour ?? 10 })
  settings.player.place = { on: 'tile', ...start }
  if (shot.facing) settings.player.facing = shot.facing
  const game = Game.create(settings, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const chunk = decodeChunk(structuredClone(await loadMap(shot.map)))
  if (shot.chunk) shot.chunk(chunk)
  game.loadChunk(chunk)
  // the player takes no harm on the stage
  game.engine.author(() => game.engine.world.setProp(game.engine.world.player, 'invulnerable', true))
  for (let i = 0; i < (shot.warm ?? 0); i++) game.engine.tick()
  return game
}

/** The shot on the stage now and how far into it. */
let cur: Cut | undefined
let curIndex = -1
let last = -1

async function enter(i: number): Promise<void> {
  const shot = FILM[i]
  const game = await makeGame(shot)
  cur = { shot, game, eng: game.engine, scene, k: 0, t: 0, frame: snapshot(game.engine), memo: {} }
  curIndex = i
  shot.setup?.(cur)
  cur.frame = snapshot(game.engine)
  shot.edit?.(cur.frame, cur)
  scene.setMap(game.engine.world.map(shot.map)!)
  scene.applyFrame(cur.frame)
  await shot.ready?.(cur)
  // the renderer lays the ground near the camera a piece at a time: let it lay all it will show before the shot's
  // first frame (steps just before the shot's time, so nothing is seen to move)
  const cam = shot.camera(cur)
  const t0 = starts[i] * (1000 / FPS)
  for (let n = 40; n > 0; n--) {
    scene.zoomTo(cam.zoom)
    scene.lookAtPoint(cam.x, cam.y)
    phaser.step(t0 - n * 4, 4)
  }
}

/** One frame of the shot: the world ticks when its tenth of a second comes, the camera goes where the shot says. */
function advance(c: Cut, global: number): void {
  if (c.k % PER_TICK === 0 && c.k > 0 && !c.shot.still?.(c)) {
    c.shot.tick?.(c)
    c.eng.tick()
  }
  if (c.k % PER_TICK === 0 || c.k === 0) {
    c.frame = snapshot(c.eng)
    c.shot.edit?.(c.frame, c)
    scene.applyFrame(c.frame)
  }
  const cam = c.shot.camera(c)
  scene.zoomTo(cam.zoom)
  scene.lookAtPoint(cam.x, cam.y)
  c.shot.before?.(c)
  phaser.step(global * (1000 / FPS), 1000 / FPS)
  overlay.begin()
  c.shot.overlay?.(overlay, c)
  overlay.end()
}

/** The frame `f` drawn: on from the last one, or the shot begun again and run up to it (a frame is the same either way). */
async function render(f: number): Promise<void> {
  f = Math.max(0, Math.min(total - 1, f))
  let i = starts.findIndex((s, j) => f >= s && (j === FILM.length - 1 || f < starts[j + 1]))
  if (i !== curIndex || f <= last || !cur) {
    await enter(i)
    for (let g = starts[i]; g < f; g++) step(g)
  } else for (let g = last + 1; g < f; g++) step(g)
  step(f)
  last = f
  function step(g: number): void {
    cur!.k = g - starts[i]
    cur!.t = cur!.k / FPS
    advance(cur!, g)
  }
}

// ------------------------------------------------------------------ the page

const exporting = new URLSearchParams(location.search).has('export')
if (exporting) document.body.classList.add('export')
function fit(): void {
  const s = exporting ? 1 : Math.min(innerWidth / W, (innerHeight - 40) / H)
  frameEl.style.transform = `scale(${s})`
}
addEventListener('resize', fit)
fit()

const ready = new Promise<void>((resolve) => {
  scene.hooks = {
    onFrame: () => {},
    onFx: () => {},
    onReady: () => {
      scene.setMuted(true)
      scene.setFreeCamera(true)
      // the stage keeps the time from here on
      phaser.loop.stop()
      resolve()
    },
  }
})
phaser = new Phaser.Game({ type: Phaser.WEBGL, parent: 'game', pixelArt: true, backgroundColor: '#000000', width: W, height: H, scale: { mode: Phaser.Scale.NONE }, scene: [scene], input: { keyboard: false, mouse: false, touch: false }, audio: { noAudio: true }, render: { preserveDrawingBuffer: true } })

const seek = document.getElementById('seek') as HTMLInputElement
const clock = document.getElementById('clock')!
let playing = false, at = 0
seek.max = String(total - 1)
async function show(f: number): Promise<void> {
  await render(f)
  at = f
  seek.value = String(f)
  clock.textContent = `${(f / FPS).toFixed(2)}s / ${(total / FPS).toFixed(1)}s · ${FILM[curIndex].id}`
}
seek.oninput = () => { playing = false; void show(Number(seek.value)) }
document.getElementById('play')!.onclick = () => { playing = !playing; if (playing) loop() }
let lastTime = 0
function loop(t = performance.now()): void {
  if (!playing) return
  if (t - lastTime >= 1000 / FPS - 2) { lastTime = t; void show(at + 1 >= total ? 0 : at + 1) }
  requestAnimationFrame(loop)
}

;(window as unknown as { stage: unknown }).stage = {
  fps: FPS,
  frames: total,
  shots: FILM.map((s, i) => ({ id: s.id, start: starts[i], frames: (starts[i + 1] ?? total) - starts[i] })),
  cues: FILM.flatMap((s, i) => (s.sounds ?? []).map(([t, file, vol, dur]) => ({ at: starts[i] / FPS + t, file, vol: vol ?? 0.5, dur }))),
  music: MUSIC,
  ready: (async () => {
    index = await fetch(`${base}index.json`).then((r) => r.json())
    // the fonts the overlay writes in, loaded before any frame (a font still loading draws its words blank)
    await Promise.all(['400 30px "Pixelify Sans"', '600 30px "Pixelify Sans"', '400 16px "Fusion Pixel"'].map((f) => document.fonts.load(f)))
    await ready
    await show(Number(new URLSearchParams(location.search).get('f') ?? 0))
  })(),
  render: (f: number) => render(f),
  /** The shot on the stage (for looking into it from the console). */
  get cut() { return cur },
}
