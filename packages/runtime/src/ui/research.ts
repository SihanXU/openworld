import type { Frame, ItemInfo, PixelArt, ResearchDesign } from '@openworld/engine'
import type { FromWorker } from '../protocol.ts'
import { game, ontology } from '../game.ts'
import { locale, tx } from './common.ts'

const say = (en: string, zh: string) => locale.value === 'zh' ? zh : en

/** Why not, in the craftsperson's words (never the engine's or the provider's diagnostics). */
const PROBLEM: Record<NonNullable<Extract<FromWorker, { t: 'research' }>['problem']>, [string, string]> = {
  busy: ['Give me a moment, I am still thinking over the last one.', '稍等，上一个想法我还在琢磨。'],
  off: ['Making new things is switched off in the AI settings.', '设置里关掉了 AI 造物，新配方研制用不了。'],
  offline: ['Connect an AI model in the settings, and we can talk it over.', '先在设置里连上 AI 模型，我们再细聊。'],
  unreachable: ['I cannot reach the AI service just now. Check the connection, then tell me your idea again.', '暂时连不上 AI 服务。检查连接后，可以重新说说你的想法。'],
  locked: ['We have not learned that craft yet. Let us try something we already know how to make.', '这门手艺还没学会。先试试我们已经会做的东西吧。'],
  cheap: ['That is too little to make it from. Use more, or think of something simpler.', '这点材料还不够做成它。多用些材料，或者换个简单些的设计吧。'],
  material: ['It needs a material to begin with: wood, stone, metal, cloth. Berries will not hold an edge.', '得先有一样能当主材的东西：木头、石头、金属、布都行，浆果可撑不起刀刃。'],
  station: ['This needs its workbench nearby before we can try it.', '得在对应的工作台旁边，才能试做这个。'],
  needs: ['You are still short of materials, tools or the skill. Once you have them, we try again.', '还缺材料、工具或相应的手艺。准备齐了，我们再试。'],
  identity: ['This plan will not do as it stands. Try another idea.', '这张图纸还不能用。换个想法，再试一次吧。'],
  refused: ['This plan will not do as it stands. Try another idea.', '这张图纸还不能用。换个想法，再试一次吧。'],
  unmade: ['It did not come out, and nothing was used up. Try another idea.', '没做出来，材料一样没少。换个想法再试吧。'],
  design: ['This plan will not do as it stands. Try another idea.', '这张图纸还不能用。换个想法，再试一次吧。'],
}

/**
 * An icon as a 16x16 pixel grid of at most 8 colours (the most used; the rest go to the nearest of them): what a
 * variant's icon is edited from. Undefined for a picture with too little drawn in it.
 */
export function pixelArtOf(src: CanvasImageSource): PixelArt | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 16
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0, 16, 16)
  const px = ctx.getImageData(0, 0, 16, 16).data
  const hex = (i: number) => `#${[px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  const count = new Map<string, number>()
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= 128) count.set(hex(i), (count.get(hex(i)) ?? 0) + 1)
  const kept = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c)
  if (!kept.length) return undefined
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const nearest = (c: string) => {
    const [r, g, b] = rgb(c)
    let best = 0
    let d = Infinity
    kept.forEach((k, n) => {
      const [kr, kg, kb] = rgb(k)
      const e = (kr - r) ** 2 + (kg - g) ** 2 + (kb - b) ** 2
      if (e < d) (d = e), (best = n)
    })
    return best
  }
  const CH = 'abcdefgh'
  const grid = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const i = (y * 16 + x) * 4
      return px[i + 3] < 128 ? '.' : CH[nearest(hex(i))]
    }).join(''),
  )
  if (grid.join('').replace(/\./g, '').length < 20) return undefined
  return { grid, palette: Object.fromEntries(kept.map((c, n) => [CH[n], c])) } as PixelArt
}

/** A drawn picture (16x16 pixels by a palette) as a canvas, for a thing no icon in the pack shows yet. */
function picture(art: PixelArt): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 16
  canvas.className = 'research-icon'
  const ctx = canvas.getContext('2d')!
  art.grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const hex = art.palette[ch]
      if (ch === '.' || !hex) return
      ctx.fillStyle = hex
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  return canvas
}

/** Lives inside the existing NPC dialogue, retaining its portrait and window/focus handling.
 * All untrusted conversation and design strings are rendered as text, never HTML.
 */
export class ResearchWindow {
  private root = document.createElement('section')
  private line = document.createElement('p')
  private input = document.createElement('textarea')
  private sendButton = document.createElement('button')
  private makeButton = document.createElement('button')
  private changeButton = document.createElement('button')
  private backButton = document.createElement('button')
  private card = document.createElement('div')
  private composer = document.createElement('div')
  private actionsRow = document.createElement('div')
  private who?: string
  private waiting = false
  /** The craftsperson thinking over the last idea (the question outlives the panel: one may walk away meanwhile). */
  private pending?: string
  /** A reply that came after the player walked away, kept for that craftsperson until they talk again. */
  private kept = new Map<string, Extract<FromWorker, { t: 'research' }>>()
  /** Says that a craftsperson has an idea ready (the HUD's message line). */
  announce?: (who: string, problem: boolean) => void
  /** The thinking began or ended: the pause follows it (a paused world sends no frames to follow it by). */
  changed?: () => void
  private token?: string
  paintIcons?: (items: ItemInfo[]) => void

  constructor(private actions: { ask(message: string): void; confirm(token: string): void; cancel(): void }) {
    this.root.id = 'recipeResearch'
    this.root.hidden = true
    this.line.className = 'research-line'
    this.line.setAttribute('aria-live', 'polite')
    this.input.maxLength = 1000
    this.input.rows = 2
    this.composer.className = 'research-composer'
    this.composer.append(this.input, this.sendButton)
    this.actionsRow.className = 'dchoices research-actions'
    this.actionsRow.append(this.backButton, this.changeButton, this.makeButton)
    this.root.append(this.line, this.card, this.composer, this.actionsRow)
    document.querySelector('#dialog .dtext')!.append(this.root)
    this.backButton.onclick = () => this.close()
    this.sendButton.onclick = () => this.ask()
    this.changeButton.onclick = () => {
      this.composer.hidden = false
      this.changeButton.hidden = true
      this.input.focus()
    }
    this.makeButton.onclick = () => {
      if (!this.token || this.waiting) return
      const token = this.token
      this.token = undefined
      this.busy(true)
      this.line.textContent = say('Let’s see how it turns out…', '来，试试看……')
      this.actions.confirm(token)
    }
    this.root.addEventListener('click', (e) => e.stopPropagation())
    this.root.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') { e.preventDefault(); this.close() }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target === this.input) { e.preventDefault(); this.ask() }
    })
  }

  get open(): boolean { return !this.root.hidden }

  /** The craftsperson is thinking: the world goes on meanwhile (and one may walk away; the answer is kept). */
  get thinking(): boolean { return this.open && !!this.pending && this.pending === this.who }

  show(frame: Frame): void {
    if (!frame.talk || frame.talk.arrest) return
    const kept = this.kept.get(frame.talk.who)
    // a draft worked out while one was away is taken up where it was; anything else starts afresh (one talk at a time:
    // what another craftsperson kept goes with it)
    const still = !kept && this.pending === frame.talk.who
    if (!kept && !still) {
      this.actions.cancel()
      this.kept.clear()
      this.pending = undefined
    }
    this.who = frame.talk.who
    this.root.hidden = false
    document.getElementById('dialog')!.classList.add('researching')
    this.card.replaceChildren()
    this.card.hidden = true
    this.token = undefined
    this.input.value = ''
    this.input.setAttribute('aria-label', say('Your idea', '你的想法'))
    this.input.placeholder = say('What would you like to make?', '想做什么？说说你的想法……')
    this.backButton.textContent = say('Back', '先聊别的')
    this.changeButton.textContent = say('Change the idea', '改改想法')
    this.makeButton.textContent = say('Try making it', '试做')
    this.line.textContent = say('Got something in mind? Let’s work out a design together.', '想做点什么新东西？说来听听，我们一起琢磨。')
    this.line.classList.remove('research-error')
    this.composer.hidden = false
    this.changeButton.hidden = true
    this.busy(still)
    if (still) this.line.textContent = say('Still thinking it over…', '还在琢磨呢……')
    else this.input.focus()
    if (kept) {
      this.kept.delete(kept.who)
      this.receive(kept)
    }
  }

  follow(frame: Frame): void {
    if (this.open && (!frame.talk || frame.talk.who !== this.who || frame.talk.arrest || frame.question)) this.close()
  }

  close(): void {
    // walking away while the craftsperson thinks: the answer still comes, and is kept for when one talks again
    if (!this.pending) this.actions.cancel()
    this.who = this.token = undefined
    this.waiting = false
    this.root.hidden = true
    document.getElementById('dialog')!.classList.remove('researching')
    this.changed?.()
    document.querySelector<HTMLButtonElement>('#dChoices [data-verb="research"]')?.focus()
  }

  private busy(value: boolean): void {
    this.waiting = value
    this.input.disabled = this.sendButton.disabled = this.changeButton.disabled = value
    this.sendButton.textContent = value ? say('Thinking…', '琢磨中……') : say('Share your idea', '说说想法')
    this.makeButton.disabled = value || !this.token
    this.makeButton.hidden = !this.token
    this.changed?.()
  }

  private ask(): void {
    const message = this.input.value.trim()
    if (!message || this.waiting) return
    this.token = undefined
    this.card.hidden = true
    this.input.value = ''
    this.line.textContent = say('Hmm… let me think about that.', '嗯……让我想想。')
    this.line.classList.remove('research-error')
    this.pending = this.who
    this.busy(true)
    this.actions.ask(message)
  }

  receive(m: Extract<FromWorker, { t: 'research' }>): void {
    if (m.who === this.pending) this.pending = undefined
    if (!this.open || m.who !== this.who) {
      // (an answer for one who is not being talked to: kept, and said on the message line; a made thing needs no keeping)
      if (!m.made) {
        this.kept.set(m.who, m)
        this.announce?.(m.who, !!m.problem)
      }
      return
    }
    this.line.textContent = m.made ? say('There! Your new creation is in your bag. I’ve written down the recipe for you.', '成了！东西收好，配方也给你记下了。') : m.problem ? say(...PROBLEM[m.problem]) : (m.reply ?? '')
    this.line.classList.toggle('research-error', !!m.problem)
    this.token = m.token
    this.card.replaceChildren()
    this.card.hidden = !m.design
    if (m.design) this.preview(m.design)
    this.composer.hidden = !!m.design || !!m.made
    this.changeButton.hidden = !this.composer.hidden
    this.changeButton.textContent = m.made ? say('Another idea', '再想一个') : say('Change the idea', '改改想法')
    this.busy(false)
    if (m.design) this.makeButton.focus()
    else if (m.made) this.backButton.focus()
    else this.input.focus()
  }

  private preview(d: ResearchDesign): void {
    this.card.className = 'research-recipe'
    const name = (id: string) => tx(ontology().types[id]?.name) || id.split('/').pop()!
    const icons: ItemInfo[] = []
    const icon = (type: string) => {
      const node = document.createElement('span')
      node.className = 'research-icon'
      node.setAttribute('aria-hidden', 'true')
      const form = game().items.forms[type]
      if (form) {
        const id = `research:${type}`
        node.dataset.icon = id
        icons.push({ id, type, sprite: form.sprite, name: name(type), tags: form.tags ?? [], statuses: [], props: form.props ?? {} })
      }
      return node
    }
    // a new kind is its parent's child; a variant, its prototype's
    const kind = d.kind === 'new' ? (d.type?.id ?? '').split('/').slice(0, -1).join('/') : d.prototype
    const needs = d.kind === 'new' ? (d.type?.makeup ?? []) : d.ingredients
    const art = d.kind === 'new' ? d.type?.art : d.art
    const heading = document.createElement('div')
    heading.className = 'research-recipe-head'
    const title = document.createElement('strong')
    title.textContent = tx(d.name)
    heading.append(art ? picture(art) : icon(kind), title)
    const subtitle = document.createElement('small')
    subtitle.textContent =
      d.kind === 'new'
        ? `${say('Something new', '新东西')} · ${name(kind)} · ${d.type?.station && d.type.station !== 'hands' ? d.type.station : say('by hand', '徒手')}`
        : `${name(d.prototype)} · ${say('Main material: ', '主材：')}${name(d.ingredients[0].type)}`
    const ingredients = document.createElement('div')
    ingredients.className = 'research-ingredients'
    for (const m of needs) {
      const chip = document.createElement('span')
      const label = document.createElement('span')
      label.textContent = `${name(m.type)} × ${m.count}`
      chip.append(icon(m.type), label)
      ingredients.append(chip)
    }
    const note = document.createElement('small')
    note.textContent = say('Materials are used only when the trial succeeds. Tools and workshop requirements still apply.', '试制成功才会用掉材料；仍需对应的工具与工坊。')
    this.card.append(heading, subtitle, ingredients, note)
    this.paintIcons?.(icons)
  }
}
