// The action and the pointer, as in Stardew Valley. The action (E, the right click) is one input that does
// what the thing it is aimed at calls for (actionOf), and the cursor shows it at once: a glove over what it
// opens, reads or picks up (or where what is held is set down: a chest, a torch), a speech bubble over someone
// to talk to, a heart over someone to hand what is held,
// a "?" where the world has never seen the act (the modder will be asked), a "!" where F would be a theft, and
// a faded arrow where nothing under the pointer is within reach (the act goes to the spot the scene outlines).
// The scene frames the spot the inputs act on, under the pointer or in front (render/scene.ts focusOn). When the
// pointer aims at nothing (the keys walked last, or it rests on the HUD), the keys act on the spot in front, and
// the same mark floats over its frame when it is a thing or someone (never on the bare ground), walking too.

import type { Frame, Key } from '@openworld/engine'
import { assetUrl } from '../render/assets.ts'
import { placeable } from './building.ts'

type Mark = 'arrow' | 'hand' | 'talk' | 'gift'
type Badge = '?' | '!'
interface Look {
  mark: Mark
  badge?: Badge
  /** Nothing under the pointer is within reach. */
  far?: boolean
}
type Art = HTMLCanvasElement | HTMLImageElement

/** Screen pixels per pixel of art, and the cursor image's side. */
const PX = 2
const SIZE = 40

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
const HOT: Record<Mark, [number, number]> = { arrow: [0, 0], hand: [6, 1], talk: [2, 2], gift: [2, 2] }

function drawn(rows: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = rows[0]!.length
  c.height = rows.length
  const g = c.getContext('2d')!
  rows.forEach((row, y) => [...row].forEach((ch, x) => INK[ch] && ((g.fillStyle = INK[ch]), g.fillRect(x, y, 1, 1))))
  return c
}

/** An image with a dark one-pixel outline around it (the pack's bubbles have none, and vanish on a pale floor). */
function outlined(img: HTMLImageElement): HTMLCanvasElement {
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

async function picture(path: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = assetUrl(path)
  await img.decode()
  return img
}

/** The keys' spot: where the act would be done. */
function spotOf(k: Frame['keys']): { x: number; y: number } | undefined {
  const v = k && (k.hands ?? k.take ?? k.put ?? k.use ?? k.self)
  return v && { x: v.x, y: v.y }
}

/**
 * The action, as Stardew's: to someone, a word, or what is held handed to them; what the hands do something
 * with is done (open, read, sleep, pick); what can be taken is picked up (never what is another's: that is F's
 * alone); on the open ground, what is held is set down if it is set in a place (a chest, a torch: the left
 * click's act),
 * else eaten, drunk or put on; on a thing, else the hands try it (an experiment). Nothing else: no act whose
 * outcome is unknown or nothing is made on the bare ground (dropping is the bag's: drag a thing out of it).
 */
export function actionOf(k: Frame['keys'], held: string | undefined): Key | undefined {
  if (!k) return undefined
  const h = k.hands
  if (h?.person) return held && k.put && !k.put.unknown ? 'put' : 'hands'
  if (h && !h.unknown && !h.ground) return 'hands'
  if (k.take && !k.take.ground && !k.take.steal) return 'take'
  if (held && placeable(held) && k.use?.ground && !k.use.unknown) return 'use'
  if (held && k.self && !k.self.unknown) return 'self'
  if (h && !h.ground) return 'hands'
  return undefined
}

/** The mark for the action (eating and drinking keep the arrow, as in Stardew). */
function lookOf(k: Frame['keys'], act: Key | undefined): Look {
  const v = act && k?.[act]
  const badge: Badge | undefined = k?.take?.steal ? '!' : v?.unknown ? '?' : undefined
  if (!act || !v || act === 'self') return { mark: 'arrow', badge: badge === '!' ? '!' : undefined }
  if (v.person) return { mark: act === 'put' ? 'gift' : 'talk', badge }
  return { mark: 'hand', badge }
}

const keyOf = (l: Look) => `${l.mark}|${l.badge ?? ''}|${l.far ? 'far' : ''}`

export class Cursor {
  private art: Partial<Record<Mark, Art>> = { arrow: drawn(ARROW) }
  private badges: Record<Badge, Art> = { '?': drawn(BADGE['?']), '!': drawn(BADGE['!']) }
  private images = new Map<string, { url: string; hot: [number, number] }>()
  private css = ''
  /** The mark over the spot in front, while the pointer aims at nothing. */
  private el = document.createElement('div')
  private front?: { x: number; y: number; look: Look }
  /** The pointer aims at something out of reach: the scene outlines the spot the act goes to instead. */
  far = false
  /** The look the pointer shows (for the dev console). */
  shown = ''

  /** The pointer aims at nothing: the keys act on the spot in front (the scene's frame goes along with the player). */
  ahead = false

  constructor(
    /** The elements over the world, which show the cursor. */
    private over: HTMLElement[],
    layer: HTMLElement,
    /** Where on screen the scene frames the spot the keys act on (the mark stands over it). */
    private framed: () => { x: number; y: number; w: number; h: number } | undefined,
    /** The player has stopped (walking, the mark waits: what is near changes at every step). */
    private settled: () => boolean,
  ) {
    this.el.className = 'vcursor off'
    layer.appendChild(this.el)
    void picture('Items/Action/Interact.png').then((img) => (this.art.hand = img))
    void picture('Ui/Emote/emote20.png').then((img) => (this.art.talk = outlined(img)))
    void picture('Ui/Emote/emote27.png').then((img) => (this.art.gift = outlined(img)))
    this.show({ mark: 'arrow' })
  }

  /** What the keys would do now; the type of what is held; the cell the pointer aims at (none: it aims at nothing). */
  update(keys: Frame['keys'], held: string | undefined, aim: { x: number; y: number } | undefined): void {
    const at = spotOf(keys)
    const act = actionOf(keys, held)
    const look = lookOf(keys, act)
    if (aim) {
      this.far = !!at && (at.x !== aim.x || at.y !== aim.y)
      this.show(this.far ? { mark: 'arrow', far: true } : look)
      this.front = undefined
      this.ahead = false
      return
    }
    this.far = false
    this.ahead = !!at
    this.show({ mark: 'arrow' })
    // the bare ground in front: no mark (one at every step would be noise)
    this.front = at && look.mark !== 'arrow' ? { ...at, look } : undefined
  }

  /** Every animation frame: the mark over the thing in front. */
  tick(): void {
    const f = this.front
    const img = f && this.settled() ? this.image(f.look) : undefined
    this.el.classList.toggle('off', !img)
    if (!f || !img) return
    const p = this.framed()
    if (!p) return void this.el.classList.add('off')
    const bg = `url("${img.url}")`
    if (this.el.style.backgroundImage !== bg) this.el.style.backgroundImage = bg
    // over the frame, not on what is in it (the thing stays in sight): the mark's own picture is its first 32 pixels
    this.el.style.transform = `translate(${Math.round(p.x + p.w / 2 - 16)}px, ${Math.round(p.y - 34)}px)`
  }

  private show(look: Look): void {
    // until the glove and the bubble have loaded, the arrow
    const img = this.image(look) ?? this.image({ mark: 'arrow', far: look.far })
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
