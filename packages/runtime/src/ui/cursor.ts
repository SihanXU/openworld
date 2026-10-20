// The pointer and the tip, as in Stardew Valley. The right click is the action: one input that does what the
// thing it is aimed at calls for (the engine's Controls chooses it: the frame's keys.action), and the cursor shows
// it at once: a glove over what it opens, reads or picks up (or where what is held is set down: a bed, a
// workbench), a speech bubble over someone to talk to, a "?" where the world has never seen the act (the modder
// will be asked), a "!" where only F would take it (a theft), and a faded arrow where nothing under the pointer is
// within reach (the act goes to the spot the scene frames instead). The pictures are the game's own (its
// catalogue's `ui.cursorHand` and `ui.emoteDots`): without them, the arrow.
// The tip says what each input would do at the framed spot, in the answering rules' own labels (foreseeable,
// design.md §5.2): with the pointer, the action, the left click and E, F, G, R where they do something else; without
// it (the keys walked last), E, F, G and R in front. It stands over the frame (render/scene.ts focusRect) once the player
// has stopped and the frame has rested a moment, so it never lurches with the steps nor flickers as the pointer sweeps.

import type { Frame, KeyView } from '@openworld/engine'
import type { SpriteDef } from '../assets/types.ts'
import { catalog } from '../game.ts'
import { assetUrl } from '../render/assets.ts'
import { esc, t, tx } from './common.ts'

type Mark = 'arrow' | 'hand' | 'talk'
type Badge = '?' | '!'
interface Look {
  mark: Mark
  badge?: Badge
  /** Nothing under the pointer is within reach. */
  far?: boolean
}
type Art = HTMLCanvasElement | HTMLImageElement
type Keys = Frame['keys']

/** Screen pixels per pixel of art, and the cursor image's side. */
const PX = 2
const SIZE = 40
/** How long the frame rests on a spot before the tip comes (ms): a pointer sweeping over things shows none. */
const DWELL_MS = 160

const INK: Record<string, string> = { K: '#2a1608', W: '#fff6dd', S: '#d9c49a', Y: '#ffd34a', R: '#e8483c' }
const ARROW = [
  'K.........',
  'KK........',
  'KWK.......',
  'KWWK......',
  'KWWWK.....',
  'KWWWWK....',
  'KWWWWWK...',
  'KWWWWWWK..',
  'KWWWWWWWK.',
  'KWWWWWSSSK',
  'KWWWWWKKKK',
  'KWWKWWK...',
  'KWK.KWWK..',
  'KK..KWWK..',
  'K....KWWK.',
  '.....KSSK.',
  '......KK..',
]
const BADGE: Record<Badge, string[]> = {
  '?': ['.KKKKK.', 'KYYYYYK', 'KYKKKYK', 'KKK.KYK', '..KKYYK', '..KYYK.', '..KYK..', '..KKK..', '..KYK..', '..KKK..'],
  '!': ['KKKK', 'KRRK', 'KRRK', 'KRRK', 'KRRK', 'KKKK', 'KRRK', 'KKKK'],
}
/** Where each mark points, in pixels of its art (the bubble's with the outline it is given). */
const HOT: Record<Mark, [number, number]> = { arrow: [0, 0], hand: [6, 1], talk: [2, 2] }

function drawn(rows: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = rows[0]!.length
  c.height = rows.length
  const g = c.getContext('2d')!
  rows.forEach((row, y) => [...row].forEach((ch, x) => INK[ch] && ((g.fillStyle = INK[ch]), g.fillRect(x, y, 1, 1))))
  return c
}

/** An image with a dark one-pixel outline around it (the pack's bubbles have none, and vanish on a pale floor). */
function outlined(img: Art): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.width + 2
  c.height = img.height + 2
  const g = c.getContext('2d')!
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) g.drawImage(img, dx, dy)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = INK.K!
  g.fillRect(0, 0, c.width, c.height)
  g.globalCompositeOperation = 'source-over'
  g.drawImage(img, 1, 1)
  return c
}

/** A sprite of the game's catalogue, cut out of its sheet (none when the game has no such picture). */
async function picture(d: SpriteDef | undefined): Promise<HTMLCanvasElement | undefined> {
  if (!d) return undefined
  const img = new Image()
  img.src = assetUrl(d.img)
  try {
    await img.decode()
  } catch {
    return undefined
  }
  const c = document.createElement('canvas')
  c.width = d.w
  c.height = d.h
  c.getContext('2d')!.drawImage(img, d.x, d.y, d.w, d.h, 0, 0, d.w, d.h)
  return c
}

/** The keys' spot: where the act would be done. */
function spotOf(k: Keys): { x: number; y: number } | undefined {
  const v = k && (k.hands ?? k.take ?? k.put ?? k.use ?? k.primary ?? k.action)
  return v && { x: v.x, y: v.y }
}

/** The mark for the action (eating and drinking keep the arrow, as in Stardew; where only F would take it, a "!"). */
function lookOf(k: Keys): Look {
  const v = k?.action
  if (!v) return { mark: 'arrow', badge: k?.take?.steal ? '!' : undefined }
  const badge: Badge | undefined = v.unknown ? '?' : undefined
  if (v.act === 'self') return { mark: 'arrow', badge }
  return { mark: v.person ? 'talk' : 'hand', badge }
}

const same = (a: KeyView, b: KeyView | undefined) => !!b && a.x === b.x && a.y === b.y && JSON.stringify(a.label) === JSON.stringify(b.label)

/**
 * The tip's lines: what each input would do. With the pointer, the action and the left click, then E, F, G and R
 * where each does something the clicks do not (and F where only it would take: a theft); without it, E, F, G and R
 * in front. A bare hand on the bare ground goes unsaid unless it does something there (touching the floor, or a
 * touch the world has never seen, would be said at every step: the frame's faint corners and amber say it).
 */
function linesOf(k: Keys, pointer: boolean): string {
  if (!k) return ''
  const line = (key: string, v: KeyView | undefined) =>
    v ? `<div class="kl${v.unknown ? ' unknown' : ''}${v.steal ? ' steal' : ''}"><kbd>${esc(key)}</kbd> ${esc(tx(v.label))}${v.unknown ? ' <span class="q">?</span>' : ''}</div>` : ''
  const hands = k.hands?.ground && (k.hands.unknown || k.hands.idle) ? undefined : k.hands
  const act = k.action
  const other = (v: KeyView | undefined) => (pointer && act && v && same(act, v) ? undefined : v)
  // R where it is not what the left click already does (a tool's work, a weapon's blow)
  const use = pointer && k.use && same(k.use, k.primary) ? undefined : other(k.use)
  return (pointer ? line(t('rmb'), act) + line(t('lmb'), k.primary) : '') + line('E', other(hands)) + line('F', other(k.take)) + line('G', other(k.put)) + line('R', use)
}

export class Cursor {
  private art: Partial<Record<Mark, Art>> = { arrow: drawn(ARROW) }
  private badges: Record<Badge, Art> = { '?': drawn(BADGE['?']), '!': drawn(BADGE['!']) }
  private images = new Map<string, { url: string; hot: [number, number] }>()
  private css = ''
  private look: Look = { mark: 'arrow' }
  /** The tip over the frame, what it says, and since when. */
  private tip = document.createElement('div')
  private said = ''
  private since = 0
  /** The pointer aims at something out of reach: the scene frames the spot the act goes to instead. */
  far = false
  /** The look the pointer shows (for the dev console). */
  shown = ''

  constructor(
    /** The elements over the world, which show the cursor. */
    private over: HTMLElement[],
    /** The layer over the world the tip stands in (its coordinates the scene's view). */
    layer: HTMLElement,
    /** Where on screen the scene frames the spot the inputs act on (the tip stands over it). */
    private framed: () => { x: number; y: number; w: number; h: number } | undefined,
    /** The player has stopped (walking, the tip waits: what is in front changes at every step). */
    private settled: () => boolean,
    /** Where the player is on screen (the tip goes on the frame's far side from them, clear of their head). */
    private me: () => { x: number; y: number } | undefined,
  ) {
    this.tip.className = 'vtip off'
    layer.appendChild(this.tip)
    // the glove and the speech bubble ("…"), if the game has them
    const ui = catalog().ui
    void picture(ui.cursorHand).then((c) => c && ((this.art.hand = c), this.show(this.look)))
    void picture(ui.emoteDots).then((c) => c && ((this.art.talk = outlined(c)), this.show(this.look)))
    this.show(this.look)
  }

  /** What the keys would do now, and the cell the pointer aims at (none: it aims at nothing, the keys act in front). */
  update(keys: Keys, aim: { x: number; y: number } | undefined): void {
    const at = spotOf(keys)
    this.far = !!aim && !!at && (at.x !== aim.x || at.y !== aim.y)
    this.show(!aim ? { mark: 'arrow' } : this.far ? { mark: 'arrow', far: true } : lookOf(keys))
    const said = linesOf(keys, !!aim)
    if (said === this.said) return
    this.said = said
    this.since = performance.now()
    this.tip.innerHTML = said
    this.tip.classList.add('off')
  }

  /** Every animation frame: the tip over the frame, once the player stands and the frame has rested. */
  tick(): void {
    const p = this.said && this.settled() && performance.now() - this.since >= DWELL_MS ? this.framed() : undefined
    this.tip.classList.toggle('off', !p)
    if (!p) return
    const view = (this.tip.offsetParent as HTMLElement | null) ?? document.body
    const w = this.tip.offsetWidth
    const h = this.tip.offsetHeight
    // on the frame's far side from the player — under a spot below them, else over it — clear of what is in it and
    // of their head; inside the view; whole pixels (a half blurs the text)
    const me = this.me()
    // (the frame's top under the middle of the player's cell: the spot is below them)
    const below = (!!me && p.y > me.y) || p.y - h - 6 < 4
    const x = Math.max(4, Math.min(view.clientWidth - w - 4, p.x + p.w / 2 - w / 2))
    const y = below && p.y + p.h + 6 + h <= view.clientHeight - 4 ? p.y + p.h + 6 : p.y - h - 6
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }

  private show(look: Look): void {
    this.look = look
    // until the glove and the bubble have loaded, the arrow
    const img = this.image(look) ?? this.image({ mark: 'arrow', badge: look.badge, far: look.far })
    const css = img ? `url("${img.url}") ${img.hot[0]} ${img.hot[1]}, auto` : 'auto'
    this.shown = keyOf(look)
    if (css === this.css) return
    this.css = css
    for (const el of this.over) el.style.cursor = css
  }

  /** The cursor image for a look, drawn once (none until its art has loaded). */
  private image(look: Look): { url: string; hot: [number, number] } | undefined {
    const key = keyOf(look)
    const known = this.images.get(key)
    if (known) return known
    const art = this.art[look.mark]
    if (!art) return undefined
    const c = document.createElement('canvas')
    c.width = c.height = SIZE
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.globalAlpha = look.far ? 0.45 : 1
    g.drawImage(art, 0, 0, art.width * PX, art.height * PX)
    g.globalAlpha = 1
    const b = look.badge && this.badges[look.badge]
    if (b) g.drawImage(b, SIZE - b.width * PX, SIZE - b.height * PX, b.width * PX, b.height * PX)
    const made = { url: c.toDataURL('image/png'), hot: [HOT[look.mark][0] * PX, HOT[look.mark][1] * PX] as [number, number] }
    this.images.set(key, made)
    return made
  }
}

const keyOf = (l: Look) => `${l.mark}|${l.badge ?? ''}|${l.far ? 'far' : ''}`
