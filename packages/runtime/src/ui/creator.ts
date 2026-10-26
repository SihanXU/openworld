// The character creator (docs/looks.md §5): a look made by hand — the body, a part per slot, the colours — shown
// as it will be in the game, the standing portrait and the map sprite walking round, with the words the world will
// use for it. The new-game panel makes the player's look with it; the dev page (looks.html) makes anyone's and
// copies the record for a person's file.

import { game } from '../game.ts'
import type { Look, Mood } from '@openworld/engine'
import { FH, FW, composeSprite } from '../assets/figure/sprite.ts'
import { portraitOf, preparePortrait } from '../assets/figure/index.ts'
import { esc, locale, tx } from './common.ts'

/** Slots a look may leave empty. */
const OPTIONAL = new Set(['hat', 'beard', 'mark', 'glasses', 'age', 'legs', 'shoes'])
/** The colour rows: a key, the families offered, and its label. */
const COLOUR_ROWS: [string, string[], string, string][] = [
  ['hair', ['hair'], 'Hair colour', '发色'],
  ['eyes', ['eyes'], 'Eyes', '瞳色'],
  ['skin', ['skin'], 'Skin', '肤色'],
  ['outfit.1', ['cloth', 'leather'], 'Clothes primary colour', '服装主色'],
  ['outfit.2', ['cloth'], 'Clothes secondary colour', '服装副色'],
  ['hat.1', ['cloth', 'leather', 'metal'], 'Hat', '帽子'],
  ['legs.1', ['cloth'], 'Stockings', '袜子'],
  ['shoes.1', ['leather', 'cloth'], 'Shoes', '鞋子'],
]
const SLOT_NAMES: Record<string, [string, string]> = {
  hair: ['Hair', '发型'], face: ['Face', '五官'], beard: ['Beard', '胡子'], age: ['Age', '年纪'], mark: ['Mark', '印记'],
  glasses: ['Glasses', '眼镜'], hat: ['Hat', '帽子'], cloak: ['Cloak', '披挂'], armour: ['Armour', '甲胄'], outfit: ['Outfit', '服装'],
  legs: ['Legs', '腿'], shoes: ['Shoes', '鞋'],
}
const MOODS: Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']
const MOOD_NAMES: Record<Mood, [string, string]> = {
  neutral: ['Calm', '平静'], happy: ['Happy', '开心'], sad: ['Sad', '难过'],
  angry: ['Angry', '生气'], surprised: ['Surprised', '惊讶'], shy: ['Shy', '害羞'],
}
const CLOTHING = new Set(['hat', 'cloak', 'armour', 'outfit', 'legs', 'shoes'])
const CREATOR_TABS = [
  ['appearance', 'Features', '容貌'], ['clothing', 'Clothing', '穿着'], ['palette', 'Colours', '配色'],
] as const
type CreatorTab = typeof CREATOR_TABS[number][0]
let creatorId = 0

/** Tiny, original icons use the same pixel grid as the rest of the controls. */
function pixelIcon(kind: CreatorTab | 'dice'): string {
  const shapes = {
    appearance: '<path d="M5 2h6v1h2v8h-2v2H5v-2H3V3h2z"/><path fill="var(--ui-paper-light,#fff0c7)" d="M5 5h6v5H5zM6 11h4v1H6z"/><path d="M5 6h2v2H5zM9 6h2v2H9zM7 9h2v1H7zM4 13h8v2H4z"/>',
    clothing: '<path d="M5 2h2v2h2V2h2l4 3-2 4-2-1v7H5V8L3 9 1 5z"/><path fill="var(--ui-paper-light,#fff0c7)" d="M7 6h2v6H7z"/>',
    palette: '<path d="M5 1h6v1h2v2h2v7h-2v3H7v-3H3V9H1V5h2V3h2z"/><path fill="var(--ui-paper-light,#fff0c7)" d="M4 5h2v2H4zM7 3h2v2H7zM11 5h2v2h-2zM10 9h2v2h-2z"/>',
    dice: '<path d="M2 1h12v1h1v12h-1v1H2v-1H1V2h1z"/><path fill="var(--ui-paper-light,#fff0c7)" d="M3 3h10v10H3z"/><path d="M4 4h2v2H4zM10 4h2v2h-2zM7 7h2v2H7zM4 10h2v2H4zM10 10h2v2h-2z"/>',
  }
  return `<svg class="cr-icon" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" shape-rendering="crispEdges">${shapes[kind]}</svg>`
}

function moodIcon(mood: Mood): string {
  const mouth = {
    neutral: 'M6 11h4v1H6z', happy: 'M5 10h1v1h4v-1h1v2h-1v1H6v-1H5z',
    sad: 'M6 10h4v1h1v1h-1v-1H6v1H5v-1h1z', angry: 'M6 11h4v1H6z',
    surprised: 'M7 10h2v3H7z', shy: 'M6 11h4v1H6z',
  }
  const eyes = mood === 'happy' || mood === 'shy'
    ? 'M4 7h3v1H4zM9 7h3v1H9z'
    : mood === 'angry' ? 'M4 6h1v1h2v2H5V8H4zM11 6h1v2h-1v1H9V7h2z' : 'M5 7h2v2H5zM9 7h2v2H9z'
  return `<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="#8c4c2b" d="M4 1h8v1h2v2h1v9h-2v2H3v-2H1V4h1V2h2z"/><path fill="#f9cc7a" d="M4 3h8v1h1v8h-2v1H5v-1H3V4h1z"/><path fill="#fff0c7" d="M4 3h8v1H4z"/><path fill="#563329" d="${eyes}${mouth[mood]}"/>${mood === 'shy' ? '<path fill="#d77d69" d="M3 9h3v1H3zM10 9h3v1h-3z"/>' : ''}${mood === 'sad' ? '<path fill="#75b9c5" d="M11 9h1v3h-1z"/>' : ''}</svg>`
}

export class Creator {
  private frame = 0
  private timer?: ReturnType<typeof setInterval>
  private mood: Mood = 'neutral'
  private tab: CreatorTab = 'appearance'
  private readonly id = `creator-${++creatorId}`

  constructor(
    private root: HTMLElement,
    public look: Look,
    private onChange?: (look: Look) => void,
  ) {
    this.root.classList.add('creator-host')
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
    const ids = Object.entries(game().looks.parts).filter(([, p]) => p.slot === slot && !p.gen?.worn && (!p.bodies || p.bodies.includes(this.look.body))).map(([id]) => id)
    return OPTIONAL.has(slot) ? [null, ...ids] : ids
  }

  private set(change: Partial<Look>): void {
    this.look = { ...this.look, ...change }
    // a body changed: what does not fit it gives way to what does
    for (const slot of game().looks.slots) {
      const id = this.look.parts[slot]
      if (id && game().looks.parts[id]?.bodies && !game().looks.parts[id].bodies!.includes(this.look.body)) {
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
    const sex = game().looks.bodies[this.look.body]?.sex ?? 'female'
    const seed = Math.random().toString(36).slice(2)
    const age = game().looks.bodies[this.look.body]?.age === 'child' ? 9 : 18 + Math.floor(Math.random() * 30)
    this.set(game().looks.generate(seed, { sex, age, role: 'traveler' }, { body: this.look.body }))
  }

  private render(): void {
    const zh = this.zh()
    const active = document.activeElement as HTMLElement | null
    const focus = active && this.root.contains(active) ? active.dataset.crFocus : undefined
    const words = game().looks.describe(this.look)
    // (what only worn things fill — a breastplate, a cloak — is the things', not the creator's)
    const rows = game().looks.slots.filter((s) => s !== 'age' && !game().looks.worn.has(s))
      .filter((s) => this.options(s).filter(Boolean).length)
      .filter((s) => this.tab === 'clothing' ? CLOTHING.has(s) : !CLOTHING.has(s))
      .map((slot) => {
        const id = this.look.parts[slot]
        const name = id ? tx(game().looks.parts[id].name) : zh ? '无' : 'none'
        const label = SLOT_NAMES[slot]?.[zh ? 1 : 0] ?? slot
        const options = this.options(slot)
        const index = options.indexOf(id ?? null) + 1
        return `<div class="cr-row"><span class="cr-label">${esc(label)}</span>
          <span class="cr-pick"><button type="button" class="cr-arrow" data-step="${slot}" data-by="-1" data-cr-focus="${slot}-previous" aria-label="${esc(zh ? `上一款${label}` : `Previous ${label.toLowerCase()}`)}"><span class="cr-chevron cr-chevron--left" aria-hidden="true"></span></button><span class="cr-choice"><span class="cr-val">${esc(name)}</span><span class="cr-index">${index} / ${options.length}</span></span><button type="button" class="cr-arrow" data-step="${slot}" data-by="1" data-cr-focus="${slot}-next" aria-label="${esc(zh ? `下一款${label}` : `Next ${label.toLowerCase()}`)}"><span class="cr-chevron" aria-hidden="true"></span></button></span></div>`
      })
      .join('')
    const colours = COLOUR_ROWS.filter(([key]) => !key.includes('.') || this.look.parts[key.split('.')[0]])
      .map(([key, families, en, cn]) => {
        const sw = Object.entries(game().looks.colors)
          .filter(([, c]) => c.for.some((f) => families.includes(f)))
          .map(([id, c]) => `<button type="button" class="cr-sw${this.colourOf(key) === id ? ' on' : ''}" style="--cr-colour:${c.hex}" title="${esc(tx(c.name))}" aria-label="${esc(`${zh ? cn : en}: ${tx(c.name)}`)}" aria-pressed="${this.colourOf(key) === id}" data-cr-focus="${key}-${id}" data-key="${key}" data-colour="${id}"></button>`)
          .join('')
        return `<div class="cr-row cr-colour-row"><span class="cr-label">${zh ? cn : en}</span><span class="cr-sws" role="group" aria-label="${zh ? cn : en}">${sw}</span></div>`
      })
      .join('')
    const bodies = Object.entries(game().looks.bodies)
      .filter(([, b]) => b.age === 'adult')
      .map(([id, b]) => `<button type="button" class="cr-body${this.look.body === id ? ' primary' : ''}" data-body="${id}" data-cr-focus="body-${id}" aria-pressed="${this.look.body === id}">${esc(tx(b.name))}</button>`)
      .join('')
    const moods = MOODS.map((m) => `<button type="button" class="cr-mood${this.mood === m ? ' on' : ''}" data-mood="${m}" data-cr-focus="mood-${m}" aria-label="${MOOD_NAMES[m][zh ? 1 : 0]}" title="${MOOD_NAMES[m][zh ? 1 : 0]}" aria-pressed="${this.mood === m}">${moodIcon(m)}</button>`).join('')
    const tabs = CREATOR_TABS.map(([id, en, cn]) => `<button type="button" role="tab" class="cr-tab" id="${this.id}-${id}" aria-controls="${this.id}-panel" aria-selected="${this.tab === id}" tabindex="${this.tab === id ? 0 : -1}" data-cr-tab="${id}" data-cr-focus="tab-${id}">${pixelIcon(id)}<span>${zh ? cn : en}</span></button>`).join('')
    const body = `<div class="cr-row cr-body-row"><span class="cr-label">${zh ? '体型' : 'Body'}</span><span class="cr-bodies" role="group" aria-label="${zh ? '体型' : 'Body'}">${bodies}</span></div>`
    this.root.innerHTML = `<div class="creator">
      <div class="cr-preview"><div class="cr-scene"><div class="cr-scene-sun" aria-hidden="true"></div><div class="cr-scene-hills" aria-hidden="true"></div><div class="cr-scene-field" aria-hidden="true"></div><div class="cr-scene-path" aria-hidden="true"></div><canvas class="cr-bust" width="1" height="1" role="img" aria-label="${zh ? '角色立绘' : 'Character portrait'}"></canvas><div class="cr-sprite-frame"><canvas class="cr-sprite" width="${FW}" height="${FH}" role="img" aria-label="${zh ? '行走预览' : 'Walking preview'}"></canvas></div></div>
        <div class="cr-preview-details"><div class="cr-moods" role="group" aria-label="${zh ? '表情预览' : 'Preview expression'}">${moods}</div><div class="cr-words">${esc(zh ? words.zh : words.en)}</div><button type="button" class="cr-random" data-random data-cr-focus="random">${pixelIcon('dice')}<span>${zh ? '随机外观' : 'Surprise me'}</span></button></div></div>
      <div class="cr-controls"><div class="cr-tabs" role="tablist" aria-label="${zh ? '外观分类' : 'Appearance categories'}">${tabs}</div><div class="cr-panel" role="tabpanel" id="${this.id}-panel" aria-labelledby="${this.id}-${this.tab}">${this.tab === 'palette' ? colours : `${this.tab === 'appearance' ? body : ''}${rows}`}</div></div>
    </div>`
    this.root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => (b.onclick = () => this.step(b.dataset.step!, Number(b.dataset.by))))
    this.root.querySelectorAll<HTMLButtonElement>('[data-body]').forEach((b) => (b.onclick = () => this.set({ body: b.dataset.body! })))
    this.root.querySelectorAll<HTMLButtonElement>('[data-colour]').forEach((b) => (b.onclick = () => this.set({ colors: { ...this.look.colors, [b.dataset.key!]: b.dataset.colour! } })))
    this.root.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach((b) => (b.onclick = () => ((this.mood = b.dataset.mood as Mood), this.render())))
    const r = this.root.querySelector<HTMLButtonElement>('[data-random]')
    if (r) r.onclick = () => this.random()
    this.root.querySelectorAll<HTMLButtonElement>('[data-cr-tab]').forEach((button, index) => {
      button.onclick = () => { this.tab = button.dataset.crTab as CreatorTab; this.render() }
      button.onkeydown = (event) => {
        const next = event.key === 'ArrowRight' ? (index + 1) % CREATOR_TABS.length
          : event.key === 'ArrowLeft' ? (index + CREATOR_TABS.length - 1) % CREATOR_TABS.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? CREATOR_TABS.length - 1 : -1
        if (next < 0) return
        event.preventDefault()
        this.tab = CREATOR_TABS[next][0]
        this.render()
        this.root.querySelector<HTMLButtonElement>(`[data-cr-tab="${this.tab}"]`)?.focus({ preventScroll: true })
      }
    })
    if (focus) [...this.root.querySelectorAll<HTMLElement>('[data-cr-focus]')].find((el) => el.dataset.crFocus === focus)?.focus({ preventScroll: true })
    this.paintBust()
    this.tick()
  }

  private colourOf(key: string): string | undefined {
    if (this.look.colors[key]) return this.look.colors[key]
    const [slot, n] = key.split('.')
    return n ? game().looks.parts[this.look.parts[slot] ?? '']?.colors?.[n] : undefined
  }

  private paintBust(): void {
    const look = this.look
    const mood = this.mood
    const draw = () => {
      if (look !== this.look || mood !== this.mood) return
      const src = portraitOf(look, mood, [], 'full')
      const c = this.root.querySelector<HTMLCanvasElement>('.cr-bust')
      if (!src || !c) return
      c.width = src.width
      c.height = src.height
      c.getContext('2d')!.drawImage(src, 0, 0)
    }
    if (portraitOf(look, mood, [], 'full')) draw()
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
