// The character creator (docs/looks.md §5): a look made by hand — the body, a part per slot, the colours — shown
// as it will be in the game, the anime portrait and the map sprite walking round, with the words the world will
// use for it. The new-game panel makes the player's look with it; the dev page (looks.html) makes anyone's and
// copies the record for a person's file.

import { LOOK_BODIES, LOOK_COLORS, LOOK_PARTS, LOOK_SLOTS, WORN_SLOTS, describeLook, generateLook } from '@openworld-game/content'
import type { Look, Mood } from '@openworld/engine'
import { FH, FW, composeSprite } from '../assets/figure/sprite.ts'
import { portraitOf, preparePortrait } from '../assets/figure/index.ts'
import { esc, locale, tx } from './common.ts'

/** Slots a look may leave empty. */
const OPTIONAL = new Set(['hat', 'beard', 'mark', 'glasses', 'age'])
/** The colour rows: a key, the families offered, and its label. */
const COLOUR_ROWS: [string, string[], string, string][] = [
  ['hair', ['hair'], 'Hair colour', '发色'],
  ['eyes', ['eyes'], 'Eyes', '瞳色'],
  ['skin', ['skin'], 'Skin', '肤色'],
  ['outfit.1', ['cloth', 'leather'], 'Clothes', '衣服'],
  ['outfit.2', ['cloth'], 'Second colour', '配色'],
  ['hat.1', ['cloth', 'leather', 'metal'], 'Hat', '帽子'],
]
const SLOT_NAMES: Record<string, [string, string]> = {
  hair: ['Hair', '发型'], face: ['Face', '五官'], beard: ['Beard', '胡子'], age: ['Age', '年纪'], mark: ['Mark', '印记'],
  glasses: ['Glasses', '眼镜'], hat: ['Hat', '帽子'], cloak: ['Cloak', '披挂'], armour: ['Armour', '甲胄'], outfit: ['Outfit', '服装'],
}
const MOODS: Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']

export class Creator {
  private frame = 0
  private timer?: ReturnType<typeof setInterval>
  private mood: Mood = 'neutral'

  constructor(
    private root: HTMLElement,
    public look: Look,
    private onChange?: (look: Look) => void,
  ) {
    this.render()
    this.timer = setInterval(() => this.tick(), 180)
  }

  dispose(): void {
    clearInterval(this.timer)
  }

  private zh(): boolean {
    return locale.value === 'zh'
  }

  /** The parts a slot may take for the current body. */
  private options(slot: string): (string | null)[] {
    // (a part only worn things show — a circlet — is not offered: it comes with the thing)
    const ids = Object.entries(LOOK_PARTS).filter(([, p]) => p.slot === slot && !p.gen?.worn && (!p.bodies || p.bodies.includes(this.look.body))).map(([id]) => id)
    return OPTIONAL.has(slot) ? [null, ...ids] : ids
  }

  private set(change: Partial<Look>): void {
    this.look = { ...this.look, ...change }
    // a body changed: what does not fit it gives way to what does
    for (const slot of LOOK_SLOTS) {
      const id = this.look.parts[slot]
      if (id && LOOK_PARTS[id]?.bodies && !LOOK_PARTS[id].bodies!.includes(this.look.body)) {
        const parts = { ...this.look.parts }
        const opts = this.options(slot).filter(Boolean) as string[]
        if (OPTIONAL.has(slot) || !opts.length) delete parts[slot]
        else parts[slot] = opts[0]
        this.look = { ...this.look, parts }
      }
    }
    this.onChange?.(this.look)
    this.render()
  }

  private step(slot: string, by: number): void {
    const opts = this.options(slot)
    const i = opts.indexOf(this.look.parts[slot] ?? null)
    const next = opts[(i + by + opts.length) % opts.length]
    const parts = { ...this.look.parts }
    if (next) parts[slot] = next
    else delete parts[slot]
    this.set({ parts })
  }

  private random(): void {
    const sex = LOOK_BODIES[this.look.body]?.sex ?? 'female'
    const seed = Math.random().toString(36).slice(2)
    const age = LOOK_BODIES[this.look.body]?.age === 'child' ? 9 : 18 + Math.floor(Math.random() * 30)
    this.set(generateLook(seed, { sex, age, role: 'traveler' }, { body: this.look.body }))
  }

  private render(): void {
    const zh = this.zh()
    const words = describeLook(this.look)
    // (what only worn things fill — a breastplate, a cloak — is the things', not the creator's)
    const rows = LOOK_SLOTS.filter((s) => s !== 'age' && !WORN_SLOTS.has(s))
      .filter((s) => this.options(s).filter(Boolean).length)
      .map((slot) => {
        const id = this.look.parts[slot]
        const name = id ? tx(LOOK_PARTS[id].name) : zh ? '无' : 'none'
        return `<div class="cr-row"><span class="cr-label">${zh ? SLOT_NAMES[slot][1] : SLOT_NAMES[slot][0]}</span>
          <button class="cv-btn small" data-step="${slot}" data-by="-1">◀</button><span class="cr-val">${esc(name)}</span><button class="cv-btn small" data-step="${slot}" data-by="1">▶</button></div>`
      })
      .join('')
    const colours = COLOUR_ROWS.filter(([key]) => !key.includes('.') || this.look.parts[key.split('.')[0]])
      .map(([key, families, en, cn]) => {
        const sw = Object.entries(LOOK_COLORS)
          .filter(([, c]) => c.for.some((f) => families.includes(f)))
          .map(([id, c]) => `<button class="cr-sw${this.colourOf(key) === id ? ' on' : ''}" style="background:${c.hex}" title="${esc(tx(c.name))}" data-key="${key}" data-colour="${id}"></button>`)
          .join('')
        return `<div class="cr-row"><span class="cr-label">${zh ? cn : en}</span><span class="cr-sws">${sw}</span></div>`
      })
      .join('')
    const bodies = Object.entries(LOOK_BODIES)
      .filter(([, b]) => b.age === 'adult')
      .map(([id, b]) => `<button class="cv-btn small${this.look.body === id ? ' primary' : ''}" data-body="${id}">${esc(tx(b.name))}</button>`)
      .join('')
    const moods = MOODS.map((m) => `<button class="cr-mood${this.mood === m ? ' on' : ''}" data-mood="${m}">${{ neutral: '😐', happy: '😊', sad: '😢', angry: '😠', surprised: '😮', shy: '😳' }[m]}</button>`).join('')
    this.root.innerHTML = `<div class="creator">
      <div class="cr-preview"><canvas class="cr-bust" width="1" height="1"></canvas><canvas class="cr-sprite" width="${FW}" height="${FH}"></canvas>
        <div class="cr-moods">${moods}</div><div class="cr-words">${esc(zh ? words.zh : words.en)}</div></div>
      <div class="cr-controls"><div class="cr-row"><span class="cr-label">${zh ? '身体' : 'Body'}</span>${bodies}<button class="cv-btn small" data-random>🎲 ${zh ? '随机' : 'Random'}</button></div>${rows}${colours}</div>
    </div>`
    this.root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => (b.onclick = () => this.step(b.dataset.step!, Number(b.dataset.by))))
    this.root.querySelectorAll<HTMLButtonElement>('[data-body]').forEach((b) => (b.onclick = () => this.set({ body: b.dataset.body! })))
    this.root.querySelectorAll<HTMLButtonElement>('[data-colour]').forEach((b) => (b.onclick = () => this.set({ colors: { ...this.look.colors, [b.dataset.key!]: b.dataset.colour! } })))
    this.root.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach((b) => (b.onclick = () => ((this.mood = b.dataset.mood as Mood), this.render())))
    const r = this.root.querySelector<HTMLButtonElement>('[data-random]')
    if (r) r.onclick = () => this.random()
    this.paintBust()
    this.tick()
  }

  private colourOf(key: string): string | undefined {
    if (this.look.colors[key]) return this.look.colors[key]
    const [slot, n] = key.split('.')
    return n ? LOOK_PARTS[this.look.parts[slot] ?? '']?.colors?.[n] : undefined
  }

  private paintBust(): void {
    const look = this.look
    const mood = this.mood
    const draw = () => {
      if (look !== this.look || mood !== this.mood) return
      const src = portraitOf(look, mood)
      const c = this.root.querySelector<HTMLCanvasElement>('.cr-bust')
      if (!src || !c) return
      c.width = src.width
      c.height = src.height
      c.getContext('2d')!.drawImage(src, 0, 0)
    }
    if (portraitOf(look, mood)) draw()
    else void preparePortrait(look, mood).then(draw)
  }

  /** The sprite walks round: each facing for a few steps. */
  private sheet?: { code: Look; px: Uint8Array }
  private tick(): void {
    // a panel closed under it: stop walking
    if (!this.root.isConnected) return this.dispose()
    const c = this.root.querySelector<HTMLCanvasElement>('.cr-sprite')
    if (!c) return
    if (this.sheet?.code !== this.look) this.sheet = { code: this.look, px: composeSprite(this.look) }
    this.frame++
    const col = [0, 3, 1, 2][Math.floor(this.frame / 12) % 4]
    const row = this.frame % 4
    const img = new ImageData(FW, FH)
    for (let y = 0; y < FH; y++) {
      const from = ((row * FH + y) * FW * 4 + col * FW) * 4
      img.data.set(this.sheet.px.subarray(from, from + FW * 4), y * FW * 4)
    }
    c.getContext('2d')!.putImageData(img, 0, 0)
  }
}
