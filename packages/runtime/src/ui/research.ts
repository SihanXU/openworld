import type { Frame, ItemInfo, ResearchDesign } from '@openworld/engine'
import type { FromWorker } from '../protocol.ts'
import { game, ontology } from '../game.ts'
import { locale, tx } from './common.ts'

const say = (en: string, zh: string) => locale.value === 'zh' ? zh : en

/** Keep engine/provider diagnostics out of the character's dialogue. */
function problem(message: string): string {
  if (locale.value !== 'zh') return message
  if (message.includes('materials, tools and skills')) return '还缺材料、工具或相应的手艺。准备齐了，我们再试。'
  if (message.includes('crafting station')) return '得在对应的工作台旁边，才能试做这个。'
  if (message.includes('too cheap')) return '这点材料还不够做成它。多用些材料，或者换个简单些的设计吧。'
  if (message.includes('not unlocked')) return '这门手艺还没学会。先试试我们已经会做的东西吧。'
  if (message.includes(' / ')) return message.split(' / ').at(-1)!
  if (/fetch|network|connect|unavailable|timeout|timed out|abort/i.test(message)) return '暂时连不上 AI 服务。检查连接后，可以重新说说你的想法。'
  return '这张图纸还不能用。换个想法，再试一次吧。'
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

  show(frame: Frame): void {
    if (!frame.talk || frame.talk.arrest) return
    this.actions.cancel()
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
    this.busy(false)
    this.input.focus()
  }

  follow(frame: Frame): void {
    if (this.open && (!frame.talk || frame.talk.who !== this.who || frame.talk.arrest || frame.question)) this.close()
  }

  close(): void {
    this.actions.cancel()
    this.who = this.token = undefined
    this.root.hidden = true
    document.getElementById('dialog')!.classList.remove('researching')
    document.querySelector<HTMLButtonElement>('#dChoices [data-verb="research"]')?.focus()
  }

  private busy(value: boolean): void {
    this.waiting = value
    this.input.disabled = this.sendButton.disabled = this.changeButton.disabled = value
    this.sendButton.textContent = value ? say('Thinking…', '琢磨中……') : say('Share your idea', '说说想法')
    this.makeButton.disabled = value || !this.token
    this.makeButton.hidden = !this.token
  }

  private ask(): void {
    const message = this.input.value.trim()
    if (!message || this.waiting) return
    this.token = undefined
    this.card.hidden = true
    this.input.value = ''
    this.line.textContent = say('Hmm… let me think about that.', '嗯……让我想想。')
    this.line.classList.remove('research-error')
    this.busy(true)
    this.actions.ask(message)
  }

  receive(m: Extract<FromWorker, { t: 'research' }>): void {
    if (!this.open || m.who !== this.who) return
    this.line.textContent = m.made ? say('There! Your new creation is in your bag. I’ve written down the recipe for you.', '成了！东西收好，配方也给你记下了。') : m.error ? problem(m.reply) : m.reply
    this.line.classList.toggle('research-error', !!m.error)
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
    const heading = document.createElement('div')
    heading.className = 'research-recipe-head'
    const title = document.createElement('strong')
    title.textContent = tx(d.name)
    heading.append(icon(d.prototype), title)
    const subtitle = document.createElement('small')
    subtitle.textContent = `${name(d.prototype)} · ${say('Main material: ', '主材：')}${name(d.ingredients[0].type)}`
    const ingredients = document.createElement('div')
    ingredients.className = 'research-ingredients'
    for (const m of d.ingredients) {
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
