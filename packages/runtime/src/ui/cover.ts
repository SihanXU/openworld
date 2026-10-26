// The cover (title screen): the game's world itself behind it — a place of the game's, drawn live by the renderer
// under a camera drifting slowly about it (the worker's backdrop, a world with no story) —, a shade over its left side,
// the title large and the menu under it: continue the latest slot, a new game in a slot, load a slot, settings. The
// game's companion flies beside the line chosen; the keys move it (up, down, Enter). The slot panel shows each of the
// three slots' summary, and writes a slot out to a file or reads one back (saves.ts); the settings hold the language,
// the sound, the world filter, the keys, the AI setting and the credits.

import { assetsBase, game, type CoverScene } from '../game.ts'
import type { Difficulty, Look } from '@openworld/engine'
import { Creator } from './creator.ts'
import { KeysPage } from './keyspage.ts'
import { OwnModel, ownModel } from '../ownModel.ts'
import type { AiOptions } from './quality.ts'
import type { SaveSummary } from '../protocol.ts'
import { SLOTS, deleteSlot, exportSlot, listSlots, pickSaveFile, writeSlot, type Slot, type SlotData } from '../saves.ts'
import { $, esc, locale, prefs, t, tx, volumeRows, wireVolumes } from './common.ts'

/** The companion beside the menu (the game's, when its cover says so): the sheet it names in the game's assets, or OpenWorld's fairy. */
const companionSheet = (c: string | boolean) => `${assetsBase()}${typeof c === 'string' ? c : 'lsw/Companion/Fairy/SpriteSheet.png'}`

/** Where the place behind the title stands on the screen: right of the menu, a little below the middle. */
const SCENE_AT: [number, number] = [0.64, 0.52]
/**
 * How long one place shows before the next (through black): the world's clock runs there (a game hour a minute), so
 * the hour the place was chosen at would soon pass — its people gone to bed — were it kept.
 */
const SCENE_MS = 90_000
/** The veil's fall before the next place (as long as its CSS transition). */
const VEIL_MS = 1600

/** How a new game begins: its difficulty, and where (a start of the world's other than its own: the tutorial, played on its own from the title). */
export interface NewGame {
  difficulty: Difficulty
  start?: string
  /** How the player looks (docs/looks.md): made in the new-game panel. */
  look?: Look
}

export interface CoverHandlers {
  /** Start a slot: from its save, or a new game in it (any save there is overwritten). */
  start(slot: Slot, data: SlotData | undefined, game?: NewGame): void
  /** The tutorial, on its own: no slot is written, and walking out of it ends it (back to the title). */
  tutorial(): void
  /** The world behind the title: at this place, the traveller (the latest save's look) standing there. */
  backdrop(scene: CoverScene, at: [number, number], look?: Look): void
  toggleLocale(): void
  toggleSound(): void
  muted(): boolean
  /** The music's or the ambience's level changed (prefs): to the sound. */
  levels(): void
  /** The title's own music while the cover is up. */
  titleMusic(on: boolean): void
  /** The AI setting (the options' section, the same one). */
  ai: AiOptions
}

type Item = 'continue' | 'new' | 'load' | 'settings'
/** model: the first offer of a model to ask, when there is none (docs/byok.md) */
type Panel = 'new' | 'load' | 'settings' | 'keys' | 'model'

export class Cover {
  private slots: (SlotData | undefined)[] = []
  private panel: Panel | undefined
  /** The line the companion is beside (the keys move it, the pointer too). */
  private chosen: Item = 'new'
  /** The difficulty a new game starts at (Minecraft's choice): normal unless chosen. */
  private difficulty: Difficulty = 'normal'
  /** The place behind has drawn its first frame (its time there has begun), and the veil over it is lifted. */
  private drawn = false
  private lit = false
  private keysPage = new KeysPage(() => ((this.panel = 'settings'), this.render()))
  /** The place behind the title now (an index into the game's scenes), and the timer that moves to the next. */
  private scene = -1
  private next?: ReturnType<typeof setTimeout>
  private readonly onKey = (e: KeyboardEvent) => this.key(e)

  constructor(
    private world: string,
    private on: CoverHandlers,
  ) {}

  get open(): boolean {
    return !$('#intro').classList.contains('hidden')
  }

  async show(panel?: 'load'): Promise<void> {
    this.slots = await listSlots(this.world)
    this.panel = panel
    this.chosen = this.latest() ? 'continue' : 'new'
    this.drawn = this.lit = false
    document.getElementById('loading')?.remove()
    $('#intro').classList.remove('hidden')
    document.getElementById('app')?.classList.add('on-cover')
    document.addEventListener('keydown', this.onKey)
    this.on.titleMusic(true)
    this.on.ai.also = () => this.aiChanged()
    this.render()
    // the first place: the one `?cover=<n>` names (to look at one), else any
    const asked = Number(new URLSearchParams(location.search).get('cover'))
    const n = game().cover?.scenes?.length ?? 0
    this.backdrop(Number.isInteger(asked) && asked >= 0 && asked < n ? asked : Math.floor(Math.random() * n))
  }

  hide(): void {
    $('#intro').classList.add('hidden')
    document.getElementById('app')?.classList.remove('on-cover')
    document.removeEventListener('keydown', this.onKey)
    this.on.titleMusic(false)
    this.keysPage.hide()
    this.creator?.dispose()
    this.creator = undefined
    this.on.ai.also = undefined
    clearTimeout(this.next)
  }

  /**
   * There is no model to ask (none chosen, no service answering): the first thing the title offers is to choose one, or
   * to play without AI. Not over a panel the player opened.
   */
  offerModel(): void {
    if (!this.open || this.panel) return
    this.panel = 'model'
    this.render()
  }

  /** The AI's state changed (a model chosen, a test, what it spent): the panel showing it is drawn again. */
  private aiChanged(): void {
    if (this.panel === 'model' && ownModel.ready) {
      // chosen: the offer is done, and the title says what answers now
      this.panel = undefined
      this.render()
      $('#intro').querySelector('.cv-status')!.textContent = t('aiUsing').replace('{model}', ownModel.status!.model!)
      return
    }
    if (this.panel === 'settings' || this.panel === 'model') this.render()
  }

  /** The world behind has drawn: the veil over it lifts (once each time the title opens). */
  worldShown(): void {
    if (this.drawn) return
    this.drawn = this.lit = true
    document.querySelector('#intro .cover')?.classList.add('lit')
    // the next place, after a while (through black)
    const n = game().cover?.scenes?.length ?? 0
    clearTimeout(this.next)
    this.next = setTimeout(() => {
      if (!this.open) return
      this.lit = false
      document.querySelector('#intro .cover')?.classList.remove('lit')
      this.next = setTimeout(() => this.open && this.backdrop((this.scene + 1) % n), VEIL_MS)
    }, SCENE_MS)
  }

  /** The game behind could not start the chosen slot: say why, and give the buttons back. */
  failed(why: string): void {
    $('#intro').querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = false))
    $('#intro').querySelector('.cv-status')!.textContent = `${t('cvFailed')} ${why}`
  }

  /** The game behind is loading the chosen slot. */
  busy(): void {
    $('#intro').querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true))
    $('#intro').querySelector('.cv-status')!.textContent = t('cvLoading')
  }

  private latest(): Slot | undefined {
    let best: Slot | undefined
    for (const s of SLOTS) {
      const d = this.slots[s - 1]
      // a hardcore game that ended is not played on
      if (d && !d.summary?.ended && (!best || d.savedAt > this.slots[best - 1]!.savedAt)) best = s
    }
    return best
  }

  /** One of the game's places behind the title (the `n`th), the latest save's traveller standing in it. */
  private backdrop(n: number): void {
    const scene = game().cover?.scenes?.[n]
    if (!scene) return
    clearTimeout(this.next)
    this.scene = n
    this.drawn = false
    const latest = this.latest()
    const save = latest ? this.slots[latest - 1]!.save : undefined
    const look = save?.state?.entities?.[save.state.player]?.look
    this.on.backdrop(scene, SCENE_AT, typeof look === 'object' ? look : undefined)
  }

  private items(): Item[] {
    return [...(this.latest() ? ['continue' as const] : []), 'new', 'load', 'settings']
  }

  private render(): void {
    const latest = this.latest()
    // what the game's cover shows (ClientGame.cover): its title, its world behind, its companion
    const cv = game().cover ?? {}
    const title = esc(cv.title ? tx(cv.title) : game().id)
    const label: Record<Item, string> = { continue: t('cvContinue'), new: t('newGame'), load: t('cvLoad'), settings: t('cvSettings') }
    const line = (i: Item) => {
      const off = i === 'load' && !this.slots.some(Boolean)
      const note = i === 'continue' && latest ? `<small>${esc(this.line(this.slots[latest - 1]!.summary))}</small>` : ''
      return `<button class="cv-item${i === this.chosen ? ' on' : ''}" data-item="${i}" ${off ? 'disabled' : ''}>${label[i]}${note}</button>`
    }
    const pip = cv.companion ? `<span class="cv-pip" style="background-image:url('${encodeURI(companionSheet(cv.companion))}')"></span>` : ''
    $('#intro').innerHTML = `
      <div class="cover${cv.scenes?.length ? '' : ' plain'}${this.lit ? ' lit' : ''}${this.panel ? ' paneled' : ''}">
        <div class="cv-shade"></div>
        <div class="cv-motes">${'<i></i>'.repeat(18)}</div>
        <div class="cv-veil"></div>
        <div class="cv-bar top"></div><div class="cv-bar bottom"></div>
        <div class="cv-main">
          <h1 class="cv-title">${title}</h1>
          <div class="cv-rule"></div>
          <nav class="cv-menu">${pip}${this.items().map(line).join('')}</nav>
          <div class="cv-status"></div>
        </div>
        ${this.panel ? `<div class="cv-dim"></div><div class="cv-panel wood">${this.panelHtml()}</div>` : ''}
      </div>`
    $('#intro').querySelectorAll<HTMLButtonElement>('[data-item]').forEach((b) => {
      b.onmouseenter = () => this.choose(b.dataset.item as Item)
      b.onclick = () => this.act(b.dataset.item as Item)
    })
    this.placePip()
    if (this.panel) this.wirePanel()
  }

  /** The companion beside the line chosen. */
  private choose(i: Item): void {
    if (this.chosen === i) return
    this.chosen = i
    $('#intro').querySelectorAll<HTMLButtonElement>('[data-item]').forEach((b) => b.classList.toggle('on', b.dataset.item === i))
    this.placePip()
  }

  private placePip(): void {
    const pip = document.querySelector<HTMLElement>('#intro .cv-pip')
    const b = document.querySelector<HTMLElement>(`#intro [data-item="${this.chosen}"]`)
    if (pip && b) pip.style.top = `${b.offsetTop + Math.min(b.offsetHeight, 52) / 2}px`
  }

  private act(i: Item): void {
    const latest = this.latest()
    if (i === 'continue' && latest) return this.busy(), this.on.start(latest, this.slots[latest - 1])
    if (i === 'load' && !this.slots.some(Boolean)) return
    this.panel = i === 'continue' ? undefined : i
    this.render()
  }

  /** The keys on the cover: up and down choose a line, Enter (or Space) takes it, Esc closes a panel. */
  private key(e: KeyboardEvent): void {
    if (!this.open || (e.target as HTMLElement)?.closest?.('input, textarea, select')) return
    if (this.panel) {
      // (the keys page listens for keys itself, and leaves by its own buttons)
      if (e.key === 'Escape' && this.panel !== 'keys') (e.preventDefault(), (this.panel = undefined), this.render())
      return
    }
    const items = this.items().filter((i) => i !== 'load' || this.slots.some(Boolean))
    const at = items.indexOf(this.chosen)
    if (e.code === 'ArrowUp' || e.code === 'KeyW') (e.preventDefault(), this.choose(items[(at - 1 + items.length) % items.length]))
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') (e.preventDefault(), this.choose(items[(at + 1) % items.length]))
    else if (e.code === 'Enter' || e.code === 'Space') (e.preventDefault(), this.act(this.chosen))
  }

  /** "Cloudtop · Day 1 13:00 · Lv 2 · Make a stone axe" */
  private line(s: SaveSummary | undefined): string {
    if (!s) return t('cvOldSave')
    if (s.ended) return locale.value === 'zh' ? `极限 · 已终结 · ${tx(s.map)} · 第 ${s.day} 天` : `Hardcore · ended · ${tx(s.map)} · day ${s.day}`
    const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`
    return [tx(s.map), `${t('cvDay').replace('{n}', String(s.day))} ${time}`, `Lv ${s.level}`, s.objective ? tx(s.objective) : s.quest && tx(s.quest)].filter(Boolean).join(' · ')
  }

  private panelHtml(): string {
    const name = { settings: t('cvSettings'), keys: t('keysSet'), new: t('cvPickNew'), load: t('cvPickLoad'), model: t('aiFirstTitle') }[this.panel!]
    const head = `<div class="cv-phead"><b>${name}</b>${this.panel === 'keys' ? '' : '<button class="x" id="cvClose">✕</button>'}</div>`
    if (this.panel === 'keys') return head + '<div id="cvKeys"></div>'
    if (this.panel === 'settings') return head + this.settingsHtml()
    if (this.panel === 'model')
      return `${head}<div class="options cv-settings cv-model">
        ${this.on.ai.own.html(false)}
        <div class="cv-skip"><button class="cv-btn" id="cvSkipModel">${t('aiSkip')}</button><small>${t('aiSkipTip')}</small></div>
      </div>`
    const when = (iso: string) => new Date(iso).toLocaleString(locale.value === 'zh' ? 'zh-CN' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const cards = SLOTS.map((s) => {
      const d = this.slots[s - 1]
      const main = this.panel === 'new' ? `<button class="cv-btn primary" data-act="new" data-slot="${s}">${d ? t('cvOverwrite') : t('cvStartHere')}</button>` : d && !d.summary?.ended ? `<button class="cv-btn primary" data-act="load" data-slot="${s}">${t('cvLoadThis')}</button>` : ''
      return `<div class="cv-slot${d ? '' : ' empty'}">
        <div class="cv-sname">${t('cvSlot').replace('{n}', String(s))}</div>
        <div class="cv-sinfo">${d ? `<div>${esc(this.line(d.summary))}</div><div class="muted">${t('cvSavedAt')} ${when(d.savedAt)}</div>` : `<div class="muted">${t('cvEmpty')}</div>`}</div>
        <div class="cv-sacts">${main}
          ${d ? `<button class="cv-btn small" data-act="export" data-slot="${s}" title="${t('cvExportTip')}">${t('cvExport')}</button>` : ''}
          <button class="cv-btn small" data-act="import" data-slot="${s}" title="${t('cvImportTip')}">${t('cvImport')}</button>
          ${d ? `<button class="cv-btn small danger" data-act="delete" data-slot="${s}">${t('cvDelete')}</button>` : ''}
        </div>
      </div>`
    }).join('')
    // a new game's difficulty (Minecraft's): what a fall costs
    const zh = locale.value === 'zh'
    const levels: [Difficulty, string, string][] = [
      ['easy', zh ? '简单' : 'Easy', zh ? '倒下后原地起身，东西都在' : 'get up where you fell, with everything'],
      ['normal', zh ? '普通' : 'Normal', zh ? '在落脚处复活，身上的东西留在倒下的地方' : 'respawn at home; what you carried stays where you fell'],
      ['hardcore', zh ? '极限' : 'Hardcore', zh ? '只有一条命' : 'one life'],
    ]
    // a new game's traveller: their look, made here (docs/looks.md)
    // (a game without a look table keeps its travellers' sheets: nothing to make)
    const maker = this.panel === 'new' && Object.keys(game().looks.bodies).length ? `<div class="cv-plabel">${t('cvYourLook')}</div><div id="cvCreator"></div>` : ''
    const pick = this.panel === 'new' ? `<div class="cv-diff">${levels.map(([id, name, note]) => `<button class="cv-btn small${this.difficulty === id ? ' primary' : ''}" data-diff="${id}">${name}<small>${note}</small></button>`).join('')}</div>` : ''
    // the tutorial is its own run, offered as a new game begins: nothing saved, and walking out of it ends it
    const tutorial = this.panel === 'new' && game().cover?.tutorial ? `<button class="cv-btn cv-tutorial" id="cvTutorial">${t('cvTutorial')}<small>${t('cvTutorialTip')}</small></button>` : ''
    return head + tutorial + maker + pick + `<div class="cv-slots">${cards}</div><div class="cv-note muted">${t('cvNote')}</div>`
  }

  private settingsHtml(): string {
    const cv = game().cover ?? {}
    const zh = locale.value === 'zh'
    const filter = game().worldFilter ? `<div class="opt"><span>${t('optFilter')}</span><button id="cvFilter">${t({ off: 'filterOff', light: 'filterLight', full: 'filterFull' }[prefs.filter()])}</button></div>` : ''
    const credit = cv.credit === false ? '' : `<div class="cv-credit">${cv.credit ? esc(tx(cv.credit)) : `${zh ? '美术与音乐：' : 'Art & music: '}<a href="https://pixel-boy.itch.io/ninja-adventure-asset-pack" target="_blank" rel="noopener">Ninja Adventure</a> (CC0)`}</div>`
    return `<div class="options cv-settings">
      <div class="opt"><span>${t('language')}</span><button id="cvLang">${zh ? '中文 → English' : 'English → 中文'}</button></div>
      <div class="opt"><span>${t('sound')}</span><button id="cvSound">${this.on.muted() ? t('off') : t('on')}</button></div>
      ${volumeRows('cv')}
      ${filter}
      <div class="opt"><span>${t('controls')}</span><button id="cvKeysBtn">${t('keysSet')}</button></div>
      ${this.on.ai.html()}
      ${credit}
    </div>`
  }

  /** The look a new game's traveller is made with (the new-game panel's creator). */
  private look: Look = game().looks.player
  private creator?: Creator

  private wirePanel(): void {
    this.creator?.dispose()
    const maker = document.getElementById('cvCreator')
    this.creator = maker ? new Creator(maker, this.look, (look) => (this.look = look)) : undefined
    document.querySelector<HTMLButtonElement>('#cvClose')?.addEventListener('click', () => ((this.panel = undefined), this.render()))
    if (this.panel === 'keys') return this.keysPage.show($('#cvKeys'))
    this.keysPage.hide()
    if (this.panel === 'settings') {
      const host = $('#intro').querySelector<HTMLElement>('.cv-settings')!
      $('#cvLang').onclick = () => (this.on.toggleLocale(), this.render())
      $('#cvSound').onclick = () => (this.on.toggleSound(), this.render())
      wireVolumes(host, () => this.on.levels())
      document.querySelector<HTMLButtonElement>('#cvFilter')?.addEventListener('click', () => {
        const next = { off: 'light', light: 'full', full: 'off' } as const
        prefs.setFilter(next[prefs.filter()])
        this.render()
      })
      $('#cvKeysBtn').onclick = () => ((this.panel = 'keys'), this.render())
      this.on.ai.wire(host)
      void this.on.ai.refresh()
      return
    }
    if (this.panel === 'model') {
      ownModel.start()
      this.on.ai.own.wire($('#intro').querySelector<HTMLElement>('.cv-model')!)
      // no model, and not asked again (Settings still offers one); the ✕ and Esc only put it off until the next time
      $('#cvSkipModel').onclick = () => (OwnModel.skip(), (this.panel = undefined), this.render())
      return
    }
    document.querySelector<HTMLButtonElement>('#cvTutorial')?.addEventListener('click', () => (this.busy(), this.on.tutorial()))
    document.querySelectorAll<HTMLButtonElement>('#intro [data-diff]').forEach((b) => (b.onclick = () => ((this.difficulty = b.dataset.diff as Difficulty), this.render())))
    document.querySelectorAll<HTMLButtonElement>('#intro [data-act]').forEach((b) => {
      const slot = Number(b.dataset.slot) as Slot
      const d = this.slots[slot - 1]
      b.onclick = async () => {
        switch (b.dataset.act) {
          case 'load':
            if (d && !d.summary?.ended) (this.busy(), this.on.start(slot, d))
            return
          case 'new':
            if (d && !confirm(t('cvConfirmOverwrite').replace('{n}', String(slot)))) return
            this.busy()
            return this.on.start(slot, undefined, { difficulty: this.difficulty, look: this.look })
          case 'export':
            if (d) exportSlot(this.world, slot, d)
            return
          case 'import':
            try {
              const data = await pickSaveFile()
              if (d && !confirm(t('cvConfirmOverwrite').replace('{n}', String(slot)))) return
              await writeSlot(this.world, slot, data)
            } catch (err) {
              if ((err as Error).message !== 'no file') alert(`${t('cvBadFile')}\n${(err as Error).message}`)
              return
            }
            break
          case 'delete':
            if (!confirm(t('cvConfirmDelete').replace('{n}', String(slot)))) return
            await deleteSlot(this.world, slot)
            break
        }
        this.slots = await listSlots(this.world)
        this.render()
      }
    })
  }
}
