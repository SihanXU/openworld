// The cover (title screen): the mountain at dawn — the plateau the game begins on, ridges behind
// it, clouds drifting by, Pip flapping across — the title, and the menu: continue the latest
// slot, a new game in a slot, load a slot, controls, language. The slot panel shows each of the
// three slots' summary, and writes a slot out to a file or reads one back (saves.ts).

import { game } from '../game.ts'
import type { Difficulty, Look } from '@openworld/engine'
import { Creator } from './creator.ts'
import type { SaveSummary } from '../protocol.ts'
import { SLOTS, deleteSlot, exportSlot, listSlots, pickSaveFile, writeSlot, type Slot, type SlotData } from '../saves.ts'
import { $, controlsTable, esc, locale, t, tx } from './common.ts'

const FAIRY = `${import.meta.env.BASE_URL}assets/lsw/Companion/Fairy/SpriteSheet.png`

/** The scene behind the title: ridges in four depths, the plateau with its shelter, pines. */
const SCENE = `
<svg class="cv-land" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="cvSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3f6b"/><stop offset="0.45" stop-color="#7f8fc0"/><stop offset="0.75" stop-color="#f2a988"/><stop offset="1" stop-color="#fbd59a"/>
    </linearGradient>
    <linearGradient id="cvSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfdcec"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#cvSky)"/>
  <circle cx="1180" cy="560" r="90" fill="#ffe7b0" opacity="0.85"/>
  <path d="M0 640 L140 520 L260 590 L420 450 L560 560 L700 470 L860 590 L1010 480 L1180 600 L1330 500 L1480 590 L1600 540 L1600 900 L0 900Z" fill="#a3afd3"/>
  <path d="M0 700 L180 600 L330 660 L470 560 L620 680 L760 610 L900 700 L1060 620 L1220 700 L1380 610 L1600 690 L1600 900 L0 900Z" fill="#6f7fae"/>
  <!-- the plateau: a flat snow top, a shelter, the cut down its face (low, under the menu) -->
  <g transform="translate(0 130)">
  <path d="M420 900 L560 520 L640 470 L1000 470 L1080 520 L1240 900Z" fill="#46557e"/>
  <path d="M560 520 L640 470 L1000 470 L1080 520 L1040 540 L980 515 L900 535 L820 512 L740 538 L660 516 L600 540Z" fill="url(#cvSnow)"/>
  <rect x="690" y="440" width="44" height="30" fill="#7a4a2a"/><path d="M684 442 L712 422 L740 442Z" fill="#a8432f"/>
  <path d="M820 535 L812 620 L830 700 L815 800 L826 900" stroke="#c9a86a" stroke-width="6" fill="none" opacity="0.7" stroke-linecap="round"/>
  </g>
  <path d="M0 790 L160 730 L320 780 L520 720 L700 800 L900 740 L1100 800 L1300 730 L1600 790 L1600 900 L0 900Z" fill="#2d3c5e"/>
  <g fill="#1d2a45">${pines()}</g>
</svg>`

function pines(): string {
  let out = ''
  for (let i = 0; i < 26; i++) {
    const x = (i * 67 + (i % 3) * 23) % 1600
    const h = 60 + ((i * 37) % 50)
    const y = 900 - ((i * 13) % 40)
    out += `<path d="M${x} ${y - h} L${x - h * 0.32} ${y} L${x + h * 0.32} ${y}Z"/>`
  }
  return out
}

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
  toggleLocale(): void
}

export class Cover {
  private slots: (SlotData | undefined)[] = []
  private panel: 'new' | 'load' | 'help' | undefined
  /** The difficulty a new game starts at (Minecraft's choice): normal unless chosen. */
  private difficulty: Difficulty = 'normal'

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
    document.getElementById('loading')?.remove()
    $('#intro').classList.remove('hidden')
    this.render()
  }

  hide(): void {
    $('#intro').classList.add('hidden')
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

  private render(): void {
    const latest = this.latest()
    const zh = locale.value === 'zh'
    $('#intro').innerHTML = `
      <div class="cover">
        ${SCENE}
        <div class="cv-cloud c1"></div><div class="cv-cloud c2"></div><div class="cv-cloud c3"></div>
        <div class="cv-pip" style="background-image:url('${FAIRY}')"></div>
        <div class="cv-main">
          <div class="cv-kicker">${zh ? '一个规则即代码的世界' : 'A world whose rules are code'}</div>
          <h1 class="cv-title">OpenWorld</h1>
          <div class="cv-sub">${zh ? '这个世界从没见过的事，它会学会，并且记住。' : 'What the world has never seen, it learns — and remembers.'}</div>
          <div class="cv-menu">
            ${latest ? `<button class="cv-btn primary" id="cvContinue">${t('cvContinue')}<small>${esc(this.line(this.slots[latest - 1]!.summary))}</small></button>` : ''}
            <button class="cv-btn${latest ? '' : ' primary'}" id="cvNew">${t('newGame')}</button>
            <button class="cv-btn" id="cvLoad" ${this.slots.some(Boolean) ? '' : 'disabled'}>${t('cvLoad')}</button>
            <button class="cv-btn" id="cvTutorial">${zh ? '新手教程' : 'Tutorial'}<small>${zh ? '从零学起 · 独立于主线和存档' : 'Learn the ropes · Separate from the story and saves'}</small></button>
            <button class="cv-btn cv-challenge" id="cvChallenge">${zh ? '首领挑战' : 'Boss Challenge'}<small>${zh ? '选择职业 · 挑战首领 · 独立于存档' : 'Choose a profession · The bosses · Separate from saves'}</small></button>
            <button class="cv-btn" id="cvHelp">${t('controls')}</button>
            <button class="cv-btn small" id="cvLang">${zh ? 'English' : '中文'}</button>
          </div>
          <div class="cv-status"></div>
        </div>
        ${this.panel ? `<div class="cv-panel wood">${this.panelHtml()}</div>` : ''}
        <div class="cv-foot">${zh ? '美术与音乐：' : 'Art & music: '}<a href="https://pixel-boy.itch.io/ninja-adventure-asset-pack" target="_blank" rel="noopener">Ninja Adventure</a> (CC0)</div>
      </div>`
    const go = (slot: Slot) => (this.busy(), this.on.start(slot, this.slots[slot - 1]))
    document.querySelector<HTMLButtonElement>('#cvContinue')?.addEventListener('click', () => latest && go(latest))
    $('#cvNew').onclick = () => ((this.panel = 'new'), this.render())
    $('#cvLoad').onclick = () => ((this.panel = 'load'), this.render())
    $('#cvHelp').onclick = () => ((this.panel = 'help'), this.render())
    $('#cvTutorial').onclick = () => (this.busy(), this.on.tutorial())
    $('#cvChallenge').onclick = () => location.assign(`${import.meta.env.BASE_URL}boss-gallery.html?challenge=1`)
    $('#cvLang').onclick = () => (this.on.toggleLocale(), this.render())
    if (this.panel) this.wirePanel()
  }

  /** "Cloudtop · Day 1 13:00 · Lv 2 · Make a stone axe" */
  private line(s: SaveSummary | undefined): string {
    if (!s) return t('cvOldSave')
    if (s.ended) return locale.value === 'zh' ? `极限 · 已终结 · ${tx(s.map)} · 第 ${s.day} 天` : `Hardcore · ended · ${tx(s.map)} · day ${s.day}`
    const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`
    return [tx(s.map), `${t('cvDay').replace('{n}', String(s.day))} ${time}`, `Lv ${s.level}`, s.objective ? tx(s.objective) : s.quest && tx(s.quest)].filter(Boolean).join(' · ')
  }

  private panelHtml(): string {
    const head = `<div class="cv-phead"><b>${this.panel === 'help' ? t('controls') : this.panel === 'new' ? t('cvPickNew') : t('cvPickLoad')}</b><button class="x" id="cvClose">✕</button></div>`
    if (this.panel === 'help') return head + `<div class="cv-help">${controlsTable(import.meta.env.DEV)}</div>`
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
    const maker = this.panel === 'new' ? `<div class="cv-sub">${zh ? '你的样子' : 'Your look'}</div><div id="cvCreator"></div>` : ''
    const pick = this.panel === 'new' ? `<div class="cv-diff">${levels.map(([id, name, note]) => `<button class="cv-btn small${this.difficulty === id ? ' primary' : ''}" data-diff="${id}">${name}<small>${note}</small></button>`).join('')}</div>` : ''
    // a new game begins on the plateau, at the foot of the mountain: the tutorial is its own, from the title
    return head + maker + pick + `<div class="cv-slots">${cards}</div><div class="cv-note muted">${t('cvNote')}</div>`
  }

  /** The look a new game's traveller is made with (the new-game panel's creator). */
  private look: Look = game().looks.player
  private creator?: Creator

  private wirePanel(): void {
    this.creator?.dispose()
    const maker = document.getElementById('cvCreator')
    this.creator = maker ? new Creator(maker, this.look, (look) => (this.look = look)) : undefined
    $('#cvClose').onclick = () => ((this.panel = undefined), this.render())
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
