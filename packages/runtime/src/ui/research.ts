import type { Frame, ItemInfo, PixelArt, ResearchDesign, ResearchMissing } from '@openworld/engine'
import type { FromWorker, WorkshopView } from '../protocol.ts'
import { game, ontology } from '../game.ts'
import { locale, tx } from './common.ts'

const say = (en: string, zh: string) => locale.value === 'zh' ? zh : en

export interface ResearchActions {
  ask(message: string): void
  confirm(token: string): void
  cancel(): void
  trial?(id: string, revision: number): void
  adopt?(id: string, revision: number): void
  list?(): void
  open?(id: string): void
  kind?(kind: 'item' | 'map'): void
  extend?(): void
  use?(id: string, use: string, target: string): void
  export?(id: string): void
  import?(): void
  disable?(id: string): void
}

/** Only an actual report for this revision establishes what has been tried. */
export function workshopTrial(view: WorkshopView): WorkshopView['trial'] {
  return view.trial?.revision === view.revision ? view.trial : undefined
}

export function canAdoptWorkshop(view: WorkshopView): boolean {
  return !view.adopted && workshopTrial(view)?.passed === true
}

export function workshopUseState(view: WorkshopView, use: WorkshopView['uses'][number]): WorkshopView['uses'][number]['status'] {
  const checked = workshopTrial(view)?.checks.find((check) => check.id === use.id)
  return checked ? (checked.passed ? 'tested' : 'failed') : use.status === 'tested' ? 'ready' : use.status
}

export function canUseWorkshop(view: WorkshopView, use: WorkshopView['uses'][number]): boolean {
  return !!view.adopted && use.status === 'tested' && workshopUseState(view, use) === 'tested'
}

/** Why not, in the craftsperson's words (never the engine's or the provider's diagnostics). */
const PROBLEM: Record<NonNullable<Extract<FromWorker, { t: 'research' }>['problem']>, [string, string]> = {
  away: ['Come over here, with your hands free, and we can try it.', '走近些，手头的事放一放，我们再试。'],
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

/** What a trial still lacks, said plainly: "You still need: 1 Iron Ingot, a Smith Hammer to carry." (else the general line) */
export function missingLine(m: ResearchMissing | undefined): string | undefined {
  const types = ontology().types as Record<string, { name?: unknown; tags?: string[] } | undefined>
  const name = (id: string) => tx(types[id]?.name as never) || id.split('/').pop()!.replace(/_/g, ' ')
  // a tool by its tag: the plainest thing that carries it (a smith's hammer, not a warhammer)
  const tool = (tag: string) => {
    const ids = Object.keys(types).filter((id) => types[id]?.tags?.includes(`tool:${tag}`)).sort((a, b) => +!a.startsWith('item/tool/') - +!b.startsWith('item/tool/') || a.length - b.length)
    return ids.length ? name(ids[0]) : tag
  }
  const parts = [
    ...(m?.needs ?? []).map((n) => `${n.count} ${name(n.type)}`),
    ...(m?.tools ?? []).map((t) => say(`a ${tool(t)} to carry`, `随身带一把${tool(t)}`)),
    ...(m?.skill ? [say(`the ${m.skill} skill`, `${m.skill}手艺`)] : []),
  ]
  return parts.length ? say(`You still need: ${parts.join(', ')}. Once you have everything, we try again.`, `还缺：${parts.join('、')}。准备齐了，我们再试。`) : undefined
}

/**
 * Where a sprite sits in the 16x16 grid: as it is, centred, when it fits; else scaled down whole. Never stretched
 * (a 7x21 spear stretched to 16x16 is a hammer, and the artist keeps the shape it is given).
 */
export function fitIcon(w: number, h: number): { x: number; y: number; w: number; h: number } {
  if (!(w > 0 && h > 0)) return { x: 0, y: 0, w: 16, h: 16 }
  const k = Math.min(1, 16 / w, 16 / h)
  const dw = Math.max(1, Math.round(w * k))
  const dh = Math.max(1, Math.round(h * k))
  return { x: Math.floor((16 - dw) / 2), y: Math.floor((16 - dh) / 2), w: dw, h: dh }
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
  const { width, height } = src as { width: number; height: number }
  const at = fitIcon(width, height)
  ctx.drawImage(src, at.x, at.y, at.w, at.h)
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
  private tools = document.createElement('div')
  private itemButton = document.createElement('button')
  private mapButton = document.createElement('button')
  private extendButton = document.createElement('button')
  private trialButton = document.createElement('button')
  private notebook = document.createElement('details')
  private notebookTitle = document.createElement('summary')
  private notebookList = document.createElement('div')
  private bookTools = document.createElement('div')
  private importButton = document.createElement('button')
  private plan?: WorkshopView
  private planWho?: string
  private savedViews: WorkshopView[] = []
  private selectedKind: 'item' | 'map' = 'item'
  private hasHeld = false
  private who?: string
  private waiting = false
  /** The craftsperson thinking over the last idea (the question outlives the panel: one may walk away meanwhile). */
  private pending?: string
  private creatorProgress?: NonNullable<Extract<FromWorker, { t: 'research' }>['creatorProgress']>
  /** A reply that came after the player walked away, kept for that craftsperson until they talk again. */
  private kept = new Map<string, Extract<FromWorker, { t: 'research' }>>()
  /** Says that a craftsperson has an idea ready (the HUD's message line). */
  announce?: (who: string, problem: boolean) => void
  /** The thinking began or ended: the pause follows it (a paused world sends no frames to follow it by). */
  changed?: () => void
  private token?: string
  /** What the line says and the card shows, in whichever language is on (relabel says them again). */
  private lineOf?: () => string
  private design?: ResearchDesign
  /** The craftsperson is drawing the draft's picture (it is tried once it is drawn). */
  private sketching = false
  paintIcons?: (items: ItemInfo[]) => void

  constructor(private actions: ResearchActions) {
    this.root.id = 'recipeResearch'
    this.root.hidden = true
    this.line.className = 'research-line'
    this.line.setAttribute('aria-live', 'polite')
    this.input.maxLength = 1000
    this.input.rows = 2
    this.composer.className = 'research-composer'
    this.composer.append(this.input, this.sendButton)
    this.tools.className = 'research-tools'
    this.itemButton.dataset.researchKind = 'item'
    this.mapButton.dataset.researchKind = 'map'
    this.extendButton.className = 'research-extend'
    this.tools.append(this.itemButton, this.mapButton, this.extendButton)
    this.itemButton.onclick = () => this.chooseKind('item')
    this.mapButton.onclick = () => this.chooseKind('map')
    this.extendButton.onclick = () => {
      if (this.waiting || !this.actions.extend || !this.hasHeld) return
      this.clearPlan()
      this.selectedKind = 'item'
      this.labels()
      this.setLine(() => say('What else could the thing in your hand do?', '手里的东西还能做些什么？一起想想。'))
      this.actions.extend()
      this.input.focus()
    }
    this.trialButton.className = 'research-trial'
    this.trialButton.dataset.researchAction = 'trial'
    this.makeButton.dataset.researchAction = 'adopt'
    this.trialButton.onclick = () => {
      if (!this.plan || this.waiting || !this.actions.trial) return
      this.busy(true)
      this.setLine(() => say('Let’s try the design before we keep it.', '先试一遍，看看会发生什么。'))
      this.actions.trial(this.plan.id, this.plan.revision)
    }
    this.notebook.className = 'research-notebook'
    this.notebookTitle.onclick = () => { if (!this.notebook.open) this.actions.list?.() }
    this.notebookList.className = 'research-notebook-list'
    this.bookTools.className = 'research-book-tools'
    this.importButton.dataset.researchImport = ''
    this.importButton.onclick = () => { if (!this.waiting) this.actions.import?.() }
    this.bookTools.append(this.importButton)
    this.notebook.append(this.notebookTitle, this.bookTools, this.notebookList)
    this.actionsRow.className = 'dchoices research-actions'
    this.actionsRow.append(this.backButton, this.changeButton, this.trialButton, this.makeButton)
    this.root.append(this.tools, this.line, this.card, this.composer, this.actionsRow, this.notebook)
    document.querySelector('#dialog .dtext')!.append(this.root)
    this.backButton.onclick = () => this.close()
    this.sendButton.onclick = () => this.ask()
    this.changeButton.onclick = () => {
      this.composer.hidden = false
      this.changeButton.hidden = true
      this.input.focus()
    }
    this.makeButton.onclick = () => {
      if (this.plan && !this.creatorOffer) {
        if (this.waiting || !this.actions.adopt || !canAdoptWorkshop(this.plan)) return
        this.busy(true)
        this.setLine(() => say('Let’s keep this design.', '就把这张图纸记下来。'))
        this.actions.adopt(this.plan.id, this.plan.revision)
        return
      }
      if (!this.token || this.waiting) return
      const token = this.token
      this.token = undefined
      this.busy(true)
      this.setLine(() => this.creatorOffer ? say('Loading the design into your save…', '正在把这份设计接入你的存档……') : say('Let’s see how it turns out…', '来，试试看……'))
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
    this.hasHeld = !!frame.player?.held
    const plan = this.planWho === frame.talk.who ? this.plan : undefined
    const design = plan ? this.design : undefined
    const kept = this.kept.get(frame.talk.who)
    // a draft worked out while one was away is taken up where it was; anything else starts afresh (one talk at a time:
    // what another craftsperson kept goes with it)
    const still = !kept && this.pending === frame.talk.who
    if (!kept && !still && !plan) {
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
    this.creatorOffer = false
    this.input.value = ''
    this.design = undefined
    this.plan = undefined
    this.sketching = false
    this.made = false
    this.labels()
    this.setLine(() => say('Got something in mind? Let’s work out a design together.', '想做点什么新东西？说来听听，我们一起琢磨。'))
    this.line.classList.remove('research-error')
    this.composer.hidden = false
    this.changeButton.hidden = true
    this.busy(still)
    if (still && this.creatorProgress) this.showCreatorProgress()
    else if (still) this.setLine(() => say('Still thinking it over…', '还在琢磨呢……'))
    else this.input.focus()
    if (kept) {
      this.kept.delete(kept.who)
      this.receive(kept)
    }
    if (plan) {
      this.design = design
      this.workshop(plan)
    }
    this.renderSaved()
  }

  /** The language was switched: everything shown, said again in it. */
  relabel(): void {
    if (!this.open) return
    this.labels()
    if (this.lineOf) this.line.textContent = this.lineOf()
    this.card.replaceChildren()
    if (this.plan) this.renderWorkshop()
    else if (this.design) this.preview(this.design)
    this.renderSaved()
  }

  private made = false
  private creatorOffer = false
  private labels(): void {
    this.input.setAttribute('aria-label', say('Your idea', '你的想法'))
    this.input.placeholder = this.selectedKind === 'map' ? say('A place to explore, a path, a little workshop…', '想去怎样的地方？小路、工坊、树林……') : say('“Make jam”, or tell me what else it could do…', '“做果酱”，或者说说你希望它还能做什么……')
    this.backButton.textContent = this.creatorOffer ? say('Load later', '暂不加载')
      : this.creatorProgress && this.pending === this.who ? say('Come back later', '先去忙，稍后回来') : say('Back', '先聊别的')
    this.changeButton.textContent = this.made ? say('Another idea', '再想一个') : say('Change the idea', '改改想法')
    this.makeButton.textContent = this.creatorOffer ? say('Load into this save', '加载到当前存档') : this.plan
      ? this.plan.adopted ? say('Adopted', '已采用')
        : this.plan.kind === 'map' ? say('Adopt & enter', '采用并进入')
        : this.plan.kind === 'uses' ? say('Adopt new uses', '采用新用途')
        : say('Adopt & make', '采用并制作')
      : this.sketching ? say('Sketching…', '画图样中……') : say('Try making it', '试做')
    this.sendButton.textContent = this.waiting ? say('Thinking…', '琢磨中……') : say('Share your idea', '说说想法')
    if (this.itemButton) {
      this.itemButton.textContent = say('Things', '物件')
      this.mapButton.textContent = say('Places', '地图')
      this.extendButton.textContent = say('Add uses to what I hold', '给手里的东西添用途')
      this.itemButton.setAttribute('aria-pressed', String(this.selectedKind === 'item'))
      this.mapButton.setAttribute('aria-pressed', String(this.selectedKind === 'map'))
      this.tools.hidden = !this.actions.kind && !this.actions.extend
      this.itemButton.hidden = this.mapButton.hidden = !this.actions.kind
      this.extendButton.hidden = !this.actions.extend
      this.itemButton.disabled = this.mapButton.disabled = this.waiting
      this.extendButton.disabled = this.waiting || !this.hasHeld
      this.extendButton.title = this.hasHeld ? '' : say('Hold the thing you want to improve.', '先把想改进的东西拿在手里。')
      this.trialButton.textContent = say('Try it out', '试验')
      this.notebookTitle.textContent = say('Idea book', '创意册')
      this.notebook.hidden = !this.actions.list && !this.actions.open && !this.actions.import && !this.actions.export && !this.actions.disable
      this.importButton.textContent = say('Import an idea', '导入创意')
      this.importButton.disabled = this.waiting || !this.actions.import
      this.bookTools.hidden = !this.actions.import
    }
  }

  private setLine(line: () => string): void {
    this.lineOf = line
    this.line.textContent = line()
  }

  follow(frame: Frame): void {
    this.hasHeld = !!frame.player?.held
    if (this.extendButton) this.extendButton.disabled = this.waiting || !this.hasHeld
    if (this.open && (!frame.talk || frame.talk.who !== this.who || frame.talk.arrest || frame.question)) this.close()
  }

  close(): void {
    // walking away while the craftsperson thinks: the answer still comes, and is kept for when one talks again
    if (!this.pending) this.actions.cancel()
    this.hide()
    document.querySelector<HTMLButtonElement>('#dChoices [data-verb="research"]')?.focus()
  }

  /** Return to world targeting without cancelling or altering a kept design. */
  hide(): void {
    this.who = this.token = undefined
    this.waiting = false
    this.root.hidden = true
    document.getElementById('dialog')!.classList.remove('researching')
    this.changed?.()
  }

  private busy(value: boolean): void {
    this.waiting = value
    this.root.classList.toggle('creator-working', value && !!this.creatorProgress)
    this.input.disabled = this.sendButton.disabled = this.changeButton.disabled = value
    this.labels()
    this.makeButton.disabled = this.plan && !this.creatorOffer ? value || !this.actions.adopt || !canAdoptWorkshop(this.plan) : value || !this.token || this.sketching
    this.makeButton.hidden = this.plan && !this.creatorOffer ? false : !this.token
    if (this.trialButton) {
      this.trialButton.hidden = !this.plan
      this.trialButton.disabled = value || !this.actions.trial || !!this.plan?.adopted
    }
    this.notebookList?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = value || (!!button.dataset.researchSaved && !this.actions.open) })
    this.changed?.()
  }

  private ask(): void {
    const message = this.input.value.trim()
    if (!message || this.waiting) return
    this.token = this.design = undefined
    this.sketching = false
    this.card.hidden = true
    this.input.value = ''
    this.setLine(() => say('Hmm… let me think about that.', '嗯……让我想想。'))
    this.line.classList.remove('research-error')
    this.creatorProgress = undefined
    this.pending = this.who
    this.busy(true)
    this.actions.ask(message)
  }

  private clearPlan(): void {
    this.plan = this.design = undefined
    this.token = undefined
    this.creatorOffer = false
    this.sketching = false
    this.made = false
    this.card.replaceChildren()
    this.card.hidden = true
    this.composer.hidden = false
    this.changeButton.hidden = true
    this.busy(false)
  }

  private chooseKind(kind: 'item' | 'map'): void {
    if (this.waiting || !this.actions.kind) return
    this.clearPlan()
    this.selectedKind = kind
    this.labels()
    this.setLine(() => kind === 'map'
      ? say('What sort of place shall we make?', '想造一处怎样的地方？')
      : say('What shall we make, and what might it do?', '想做什么？也可以一起想想它的用途。'))
    this.actions.kind(kind)
    this.input.focus()
  }

  /** A structured draft or an actual trial result for its current revision. */
  workshop(view: WorkshopView): void {
    if (this.plan?.id === view.id && this.plan.revision > view.revision) return
    this.planWho = this.who ?? this.pending ?? this.planWho
    this.plan = view
    this.selectedKind = view.kind === 'map' ? 'map' : 'item'
    this.pending = undefined
    this.waiting = false
    if (!this.open) return
    this.card.hidden = false
    this.composer.hidden = false
    this.changeButton.hidden = true
    if (view.adopted) this.setLine(() => view.kind === 'map'
      ? say('The place is ready. Let’s go and see it.', '地方准备好了，去看看吧。')
      : view.kind === 'uses' ? say('Those uses are part of it now. Try them in the world.', '新用途记好了，回到世界里试试吧。')
      : say('Made, and written in your recipe book.', '做出来了，配方也记好了。'))
    this.renderWorkshop()
    this.busy(false)
  }

  saved(views: WorkshopView[]): void {
    this.savedViews = [...views]
    this.renderSaved()
  }

  private renderSaved(): void {
    if (!this.notebookList) return
    this.notebookList.replaceChildren()
    if (!this.savedViews.length) {
      const empty = document.createElement('small')
      empty.textContent = say('Kept designs will be waiting here.', '记下来的创意会放在这里。')
      this.notebookList.append(empty)
      return
    }
    for (const view of this.savedViews) {
      const entry = document.createElement('div')
      entry.className = 'research-saved-entry'
      const button = document.createElement('button')
      button.className = 'research-saved'
      button.dataset.researchSaved = view.id
      const title = document.createElement('strong')
      title.textContent = tx(view.title)
      const note = document.createElement('small')
      note.textContent = (view.kind === 'map' ? say('Place', '地图') : view.kind === 'uses' ? say('New uses', '用途') : say('Thing', '物件')) + ' · ' + say('draft ', '第') + view.revision + say('', '稿') + ' · ' + (view.adopted ? say('adopted', '已采用') : say('in progress', '琢磨中'))
      button.append(title, note)
      button.disabled = !this.actions.open || this.waiting
      button.onclick = () => {
        if (this.waiting || !this.actions.open) return
        this.busy(true)
        this.actions.open(view.id)
      }
      entry.append(button)
      if (view.adopted && (this.actions.export || this.actions.disable)) {
        const tools = document.createElement('div')
        tools.className = 'research-book-actions'
        if (this.actions.export) {
          const send = document.createElement('button')
          send.dataset.researchExport = view.id
          send.textContent = say('Export', '导出')
          send.disabled = this.waiting
          send.onclick = () => { if (!this.waiting) this.actions.export?.(view.id) }
          tools.append(send)
        }
        if (this.actions.disable) {
          const disable = document.createElement('button')
          disable.dataset.researchDisable = view.id
          disable.textContent = say('Disable', '停用')
          disable.disabled = this.waiting
          disable.onclick = () => { if (!this.waiting) this.actions.disable?.(view.id) }
          tools.append(disable)
        }
        entry.append(tools)
      }
      this.notebookList.append(entry)
    }
  }

  private renderWorkshop(): void {
    const view = this.plan
    if (!view) return
    this.card.replaceChildren()
    this.card.className = 'research-recipe research-workshop'
    if (this.design && view.kind !== 'map') {
      this.preview(this.design)
      this.card.classList.add('research-workshop')
    } else {
      const title = document.createElement('strong')
      title.className = 'research-recipe-head'
      title.textContent = tx(view.title)
      if (view.picture) title.prepend(picture(view.picture))
      this.card.append(title)
    }
    const version = document.createElement('small')
    version.className = 'research-version'
    version.textContent = say('Draft ', '第') + view.revision + say('', '稿') + (view.adopted ? say(' · kept', ' · 已采用') : '')
    this.card.append(version)
    if (view.summary) {
      const summary = document.createElement('p')
      summary.className = 'research-summary'
      summary.textContent = tx(view.summary)
      this.card.append(summary)
    }
    if (view.map) this.mapPreview(view)
    const uses = document.createElement('ul')
    uses.className = 'research-uses'
    uses.setAttribute('aria-label', say('What it could do', '用途'))
    for (const use of view.uses) {
      const state = workshopUseState(view, use)
      const row = document.createElement('li')
      row.className = 'research-use research-use--' + state
      const top = document.createElement('div')
      top.className = 'research-use-head'
      const title = document.createElement('strong')
      title.textContent = tx(use.label)
      const badge = document.createElement('span')
      badge.className = 'research-use-state'
      badge.textContent = state === 'tested' ? say('Verified', '已验证') : state === 'failed' ? say('Needs changes', '需修改') : state === 'pending' ? say('To develop', '待补全') : say('To try', '待试验')
      top.append(title, badge)
      row.append(top)
      const target = document.createElement('small')
      target.textContent = say('On: ', '对象：') + tx(use.target)
      row.append(target)
      if (use.effect) { const line = document.createElement('p'); line.textContent = tx(use.effect); row.append(line) }
      if (use.feedback) { const line = document.createElement('small'); line.textContent = tx(use.feedback); row.append(line) }
      if (this.actions.use && canUseWorkshop(view, use)) {
        const act = document.createElement('button')
        act.className = 'research-use-action'
        act.dataset.researchUse = use.id
        act.textContent = say('Use', '使用')
        act.disabled = this.waiting
        act.onclick = () => {
          if (this.waiting || !this.plan?.adopted || this.plan.id !== view.id || this.plan.revision !== view.revision || !canUseWorkshop(this.plan, use)) return
          this.actions.use?.(view.id, use.id, use.targetId ?? 'self')
        }
        row.append(act)
      }
      uses.append(row)
    }
    this.card.append(uses)
    const trial = workshopTrial(view)
    if (trial) {
      const report = document.createElement('details')
      report.open = !trial.passed
      report.className = 'research-trial-report ' + (trial.passed ? 'passed' : 'failed')
      report.setAttribute('aria-live', 'polite')
      const title = document.createElement('summary')
      title.textContent = trial.passed ? say('The trial worked', '试验通过') : say('The trial needs changes', '试验还没通过')
      report.append(title)
      for (const check of trial.checks) {
        const line = document.createElement('p')
        line.className = check.passed ? 'passed' : 'failed'
        const label = document.createElement('strong')
        label.textContent = (check.passed ? '✓ ' : '× ') + tx(check.label)
        const observed = document.createElement('span')
        observed.textContent = tx(check.observed)
        line.append(label, observed)
        report.append(line)
      }
      this.card.append(report)
    }
    const note = document.createElement('small')
    note.className = 'research-adopt-note'
    note.textContent = view.adopted ? say('You can come back to develop this idea further.', '以后还可以拿着这份创意，继续添用途。')
      : trial?.passed ? say('Keep this version when you are happy with the result.', '满意这次结果，就采用这份设计。')
      : say('Try the design first. Adopting it keeps it in your world.', '先试验，再采用；采用后才会记进你的世界。')
    this.card.append(note)
  }

  private mapPreview(view: WorkshopView): void {
    const map = view.map!
    const canvas = document.createElement('canvas')
    const w = Math.max(1, Math.min(96, map.width)), h = Math.max(1, Math.min(96, map.height))
    canvas.width = w * 4
    canvas.height = h * 4
    canvas.className = 'research-map-preview'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', say('A sketch of the place', '地方的布局草图'))
    const ctx = canvas.getContext('2d')
    if (ctx) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = map.rows[y]?.[x] ?? ' '
      ctx.fillStyle = /[~w]/.test(c) ? '#7297aa' : /[#^]/.test(c) ? '#8b7964' : /[Tt]/.test(c) ? '#55734f' : /[+:dD]/.test(c) ? '#c1aa76' : c === ' ' ? '#e6d5ad' : '#91a16b'
      ctx.fillRect(x * 4, y * 4, 4, 4)
    }
    this.card.append(canvas)
  }

  private showCreatorProgress(): void {
    const phase = this.creatorProgress
    this.setLine(() => phase === 'queued'
      ? say('I’ve written down your order. You can come back while I work.', '订单记下了。你可以先去忙，晚点再回来。')
      : phase === 'repairing'
        ? say('The first try turned up a problem. I’m adjusting the design.', '试做时发现了点问题，我正在调整。')
        : say('I’m working on the design and trying it out. Come back whenever you like.', '我正在做设计和试验。你可以先去忙，随时回来看看。'))
    this.busy(true)
  }

  receive(m: Extract<FromWorker, { t: 'research' }>): void {
    if (m.creatorProgress) {
      if (this.pending !== m.who) return
      this.creatorProgress = m.creatorProgress
      if (this.open && m.who === this.who) this.showCreatorProgress()
      return
    }
    if (m.who === this.pending) this.creatorProgress = undefined
    if (m.who === this.pending) this.pending = undefined
    if (!this.open || m.who !== this.who) {
      // (an answer for one who is not being talked to: kept, and said on the message line; a made thing needs no keeping)
      if (!m.made) {
        this.kept.set(m.who, m)
        this.announce?.(m.who, !!m.problem)
      }
      return
    }
    this.setLine(() => (m.made ? say('There! Your new creation is in your bag. I’ve written down the recipe for you.', '成了！东西收好，配方也给你记下了。') : m.problem ? (m.problem === 'needs' && missingLine(m.missing)) || say(...PROBLEM[m.problem]) : tx(m.reply)))
    this.line.classList.toggle('research-error', !!m.problem)
    this.token = m.token
    this.creatorOffer = !!m.creatorOffer
    this.design = m.design ?? (this.plan ? this.design : undefined)
    this.sketching = !!m.design && !!m.sketching
    this.made = !!m.made
    this.card.replaceChildren()
    this.card.hidden = !m.design && !this.plan
    if (this.plan) this.renderWorkshop()
    else if (m.design) this.preview(m.design)
    this.composer.hidden = this.plan ? false : !!m.design || !!m.made
    this.changeButton.hidden = !this.composer.hidden
    this.busy(false)
    if (m.design || m.creatorOffer) this.makeButton.focus()
    else if (m.made) this.backButton.focus()
    else this.input.focus()
  }

  /** The draft's picture is drawn: shown on its card, and it can be tried. */
  sketched(m: Extract<FromWorker, { t: 'researchSketched' }>): void {
    const kept = this.kept.get(m.who)
    // (drawn while one was away: kept with the reply)
    if (kept && kept.token === m.token) return void this.kept.set(m.who, { ...kept, design: m.design, sketching: false })
    if (!this.open || m.who !== this.who || !this.sketching || m.token !== this.token) return
    this.design = m.design
    this.sketching = false
    this.card.replaceChildren()
    if (this.plan) this.renderWorkshop()
    else this.preview(m.design)
    this.busy(this.waiting)
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
    // not drawn yet: its kind's icon, faded, while the craftsperson sketches
    const shown = art ? picture(art) : icon(kind)
    if (this.sketching) shown.classList.add('research-sketching')
    heading.append(shown, title)
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
    note.textContent = this.plan ? say('Adopting and making it uses these materials. The trial leaves your bag unchanged.', '采用并制作时才用掉这些材料；试验不会动你的背包。') : say('Materials are used only when the trial succeeds. Tools and workshop requirements still apply.', '试制成功才会用掉材料；仍需对应的工具与工坊。')
    this.card.append(heading, subtitle, ingredients, note)
    if (this.sketching) {
      const sketch = document.createElement('small')
      sketch.className = 'research-sketch-note'
      sketch.textContent = say('Sketching the pattern…', '正在画图样……')
      this.card.insertBefore(sketch, ingredients)
    }
    this.paintIcons?.(icons)
  }
}
