import { mountWindow } from '@openworld/runtime/src/ui/components/index.ts'
/// <reference types="vite/client" />

// The companion's panel (2026-10-12; E on Lumi, or a woken waypoint statue): the fairy herself, her portrait drawn
// with her wings and her light, and two pages — the road (the main quest's stage, its hint in her words, its objectives,
// and beside it her guides: the teaching quests she begins herself, content quests/guides.ts), and the seals' powers she
// has taken up (the boons module): five slots, the ones not yet found
// sealed, the one she carries, and the choice of another — only beside a woken statue. OpenWorld's own panel
// (ui/panels.ts: `companion` opens it on the road, `boons` on the powers), drawn into the host the runtime gives it.

import type { Frame, JournalQuest, Mood, Text } from '@openworld/engine'
import { BOON_BY_ID, COMPANION_LOOK } from '@openworld-game/content'
import type { PortraitSet } from '@openworld/runtime/src/assets/types.ts'
import { portraitOf, preparePortrait } from '@openworld/runtime/src/assets/figure/index.ts'
import { catalog } from '@openworld/runtime/src/game.ts'
import { assetUrl } from '@openworld/runtime/src/render/assets.ts'
import { esc, locale, t, tx } from '@openworld/runtime/src/ui/common.ts'
import { keys } from '@openworld/runtime/src/keymap.ts'
import type { GamePanel, PanelContext } from '@openworld/runtime/src/ui/panels.ts'
import { KNOWLEDGE, KNOWLEDGE_GROUPS } from './knowledge.ts'
import css from './companion.css?inline'
import { useStyle } from './style.ts'

/** How many powers the journey holds: one for each seal. */
const SEALS = 5
const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const ORDINAL = ['一', '二', '三', '四', '五']
/** Each seal's instrument (docs/lore.md §4, the Five Sufferings). */
const RELIC: [string, string][] = [['the Crown of Thorns', '荆棘冠'], ['the Scourging Post', '鞭刑柱'], ['the Scales of Hunger', '饥刑之秤'], ['the Nailing Tree', '钉刑圣木'], ['the Heart-Piercing Lance', '穿心圣枪']]
/**
 * How each seal stirs her (the powers page: the seal carried, or the one pointed at) — a suffering, never a joy: the
 * Crown wears the self's borders thin, and she goes blank, far away; the Scourging Post hurts; the Scales of Hunger
 * leave her light, giddy, shy of it; the Nailing Tree holds her fast, steeled; the Lance opens the heart, and she
 * starts at it.
 */
const SEAL_MOOD: Mood[] = ['neutral', 'sad', 'shy', 'angry', 'surprised']
/** The word under her name. */
const EPITHET = { en: 'your little fairy', zh: '随行的小精灵' }

export type CompanionTab = 'guide' | 'powers' | 'knowledge'

class CompanionPanel implements GamePanel {
  private sig = ''
  private tab: CompanionTab = 'guide'
  /** Her own portrait's set (docs/cast/lumi.md), when the catalogue has one with a panel picture: shown in place of her look's, its own wings drawn. */
  private own?: PortraitSet
  private knowledge = 'waypoints'
  private frame?: Frame
  private keymap = JSON.stringify(keys.map)

  constructor(private ctx: PanelContext) {
    useStyle('companion', css)
    keys.onChange(() => {
      this.keymap = JSON.stringify(keys.map)
      this.sig = ''
    })
  }

  private get host(): HTMLElement {
    return this.ctx.host
  }

  private get open(): boolean {
    return !this.host.classList.contains('hidden')
  }

  /** Spoken to, she opens on the road; a woken waypoint statue opens her panel on the powers. */
  show(f: Frame | undefined, opened: { panel: string }): void | false {
    if (!f) return false
    this.tab = opened.panel === 'boons' ? 'powers' : 'guide'
    this.sig = ''
    this.render(f)
  }

  render(f: Frame): void {
    this.frame = f
    const b = f.player.boons
    const road = roadOf(f)
    const sig = `${locale.value}|${this.keymap}|${this.tab}|${this.knowledge}|${b?.unlocked.join()}|${b?.active}|${b?.atWaypoint}|${JSON.stringify(road)}`
    if (sig === this.sig) return
    this.sig = sig
    const zh = locale.value === 'zh'
    const me = f.entities.find((e) => e.tags.includes('companion'))
    const name = me?.name ? tx(me.name) : zh ? '露米' : 'Lumi'
    const set = me ? catalog().portraits?.[me.id] : undefined
    this.own = set?.panel ? set : undefined
    const epithet = tx(EPITHET)
    const tab = (id: CompanionTab, icon: string, en: string, zh2: string) =>
      `<button class="lm-tab${this.tab === id ? ' on' : ''}" data-tab="${id}" aria-pressed="${this.tab === id}"><i>${icon}</i>${zh ? zh2 : en}</button>`
    this.host.innerHTML = `<div class="sheet wood lm-sheet">
      <header class="ui-window-head"><b>${esc(name)}</b><button class="x" data-close>×</button></header>
      <div class="lm-layout">
      <aside class="lm-stage">
        <div class="lm-sky"></div>
        <div class="lm-halo"></div>
        <div class="lm-figure${this.own ? ' own' : ''}">${this.own ? '' : WINGS}<div class="lm-bust" data-bust></div></div>
        ${Array.from({ length: 9 }, (_, i) => `<span class="lm-mote" style="--i:${i}"></span>`).join('')}
        <div class="lm-plate"><b>${esc(name)}</b><small>${esc(epithet)}</small></div>
      </aside>
      <section class="lm-main">
        <div class="lm-head">
          <div class="lm-tabs">${tab('guide', '✦', 'The Road', '主线指引')}${tab('powers', '✧', "The Seals' Powers", '印之力量')}${tab('knowledge', '▤', 'Knowledge', '知识')}</div>
        </div>
        <div class="lm-body">${this.tab === 'guide' ? this.guide(road, name) : this.tab === 'powers' ? this.powers(f) : this.readKnowledge()}</div>
      </section>
      </div>
    </div>`
    mountWindow(this.host.querySelector<HTMLElement>('.sheet')!, { size: 'lg', view: this.tab, onClose: () => this.ctx.close() })
    // her face: on the road, glad when nothing presses; on the powers, as the seal she carries stirs her
    const seal = b?.active ? BOON_BY_ID[b.active]?.seal : undefined
    const carried = seal ? seal - 1 : b?.active ? (b.unlocked ?? []).indexOf(b.active) : -1
    const rest = this.tab === 'guide' ? (road.main || road.guides.length ? undefined : 'happy') : this.tab === 'powers' && carried >= 0 ? SEAL_MOOD[carried] : undefined
    this.drawBust(rest)
    if (this.tab === 'powers') this.stirred(rest, epithet)
    this.host.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.ctx.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((el) => (el.onclick = () => ((this.tab = el.dataset.tab as CompanionTab), (this.sig = ''), this.render(f))))
    this.host.querySelectorAll<HTMLButtonElement>('[data-knowledge]').forEach((el) => (el.onclick = () => {
      this.knowledge = el.dataset.knowledge!
      this.sig = ''
      this.render(f)
      this.host.querySelector('.lm-body')?.scrollTo(0, 0)
      this.host.querySelector<HTMLButtonElement>(`[data-knowledge="${CSS.escape(this.knowledge)}"]`)?.focus({ preventScroll: true })
    }))
    this.host.querySelectorAll<HTMLButtonElement>('[data-boon]').forEach((el) => (el.onclick = () => this.ctx.send.boon(el.dataset.boon!)))
    this.host.querySelectorAll<HTMLButtonElement>('[data-log]').forEach((el) => (el.onclick = () => this.ctx.openQuests()))
  }

  /** Quick answers she has learned along the way, in three small reference shelves. */
  private readKnowledge(): string {
    const zh = locale.value === 'zh'
    const current = KNOWLEDGE.find((entry) => entry.id === this.knowledge) ?? KNOWLEDGE[0]
    const shelves = KNOWLEDGE_GROUPS.map((group) => {
      const entries = KNOWLEDGE.filter((entry) => entry.group === group.id)
      if (!entries.length) return ''
      return `<section class="lm-kb-shelf"><h4>${esc(tx(group.title))}</h4>${entries.map((entry) =>
        `<button class="lm-kb-link${entry.id === current.id ? ' on' : ''}" data-knowledge="${entry.id}" aria-pressed="${entry.id === current.id}"${entry.id === current.id ? ' aria-current="page"' : ''}><span>${esc(tx(entry.title))}</span><small>${esc(tx(entry.summary))}</small></button>`,
      ).join('')}</section>`
    }).join('')
    const sections = current.sections.map((section) => `<section class="lm-kb-section"><h4>${esc(tx(section.title))}</h4><p>${esc(tx(section.body))}</p></section>`).join('')
    return `<div class="lm-knowledge">
      <nav class="lm-kb-nav" aria-label="${zh ? '知识分类' : 'Knowledge topics'}">${shelves}</nav>
      <article class="lm-kb-article" aria-labelledby="lm-kb-title">
        <header class="lm-kb-heading"><span>${esc(tx(KNOWLEDGE_GROUPS.find((g) => g.id === current.group)!.title))}</span><h3 id="lm-kb-title">${esc(tx(current.title))}</h3><p>${esc(tx(current.summary))}</p></header>
        ${sections}
        <aside class="lm-kb-tip"><b>${zh ? '露米的小建议' : 'A little tip from Lumi'}</b><p>${esc(tx(current.tip))}</p></aside>
      </article>
    </div>`
  }

  /** On the powers page: a seal pointed at shows on her face, and its name under hers; away, the carried one's. */
  private stirred(rest: Mood | undefined, epithet: string): void {
    if (this.own) for (const m of SEAL_MOOD) new Image().src = this.ownUrl(m)
    else for (const m of SEAL_MOOD) void preparePortrait(COMPANION_LOOK, m)
    const under = this.host.querySelector<HTMLElement>('.lm-plate small')
    const zh = locale.value === 'zh'
    this.host.querySelectorAll<HTMLElement>('[data-seal]').forEach((el) => {
      const i = Number(el.dataset.seal)
      el.onmouseenter = () => {
        this.drawBust(SEAL_MOOD[i])
        if (under) under.textContent = zh ? `第${ORDINAL[i]}印 · ${RELIC[i][1]}` : `Seal ${ROMAN[i]} · ${RELIC[i][0]}`
        this.host.querySelector('.lm-plate')?.classList.add('stirred')
      }
      el.onmouseleave = () => {
        this.drawBust(rest)
        if (under) under.textContent = epithet
        this.host.querySelector('.lm-plate')?.classList.remove('stirred')
      }
    })
  }

  /** Her portrait, once its layers are here (they are fetched the first time). */
  private drawBust(mood?: Mood): void {
    const slot = this.host.querySelector('[data-bust]')
    if (!slot) return
    if (this.own?.panelLayers) return this.drawLayered(slot, mood)
    if (this.own) {
      const img = new Image()
      img.className = 'lm-portrait'
      img.alt = ''
      img.src = this.ownUrl(mood)
      slot.replaceChildren(img)
      return
    }
    const bust = portraitOf(COMPANION_LOOK, mood)
    if (bust) {
      bust.className = 'lm-portrait'
      slot.replaceChildren(bust)
    } else
      void preparePortrait(COMPANION_LOOK, mood).then((ok) => {
        if (ok && this.open && this.frame) ((this.sig = ''), this.render(this.frame))
      })
  }

  /**
   * Her own panel picture in its layers (the set's `panelLayers`): her wings behind, fluttering about their roots (the
   * stylesheet's), her body, and her closed eyes over it, shown for a moment now and then — a blink. A mood changes only
   * the body and the eyes, so the wings keep their beat.
   */
  private drawLayered(slot: Element, mood?: Mood): void {
    const own = this.own!
    const m = mood && own.moods.includes(mood) ? mood : 'neutral'
    let box = slot.querySelector<HTMLElement>('.lm-own')
    if (!box) {
      box = document.createElement('div')
      box.className = 'lm-own'
      const layer = (cls: string, src: string) => {
        const img = new Image()
        img.className = cls
        img.alt = ''
        img.draggable = false
        img.src = assetUrl(`${own.dir}/${src}`)
        return img
      }
      box.append(layer('lm-own-wing left', 'panel-wings-left.webp'), layer('lm-own-wing right', 'panel-wings-right.webp'), layer('lm-portrait lm-own-body', `${m}-panel-body.webp`), layer('lm-own-blink', `${m}-panel-blink.webp`))
      slot.replaceChildren(box)
      // her other moods' pictures fetched now, so a mood is never a blank while it loads
      for (const o of own.moods) for (const f of ['panel-body', 'panel-blink']) new Image().src = assetUrl(`${own.dir}/${o}-${f}.webp`)
    } else {
      const body = box.querySelector<HTMLImageElement>('.lm-own-body')!
      const blink = box.querySelector<HTMLImageElement>('.lm-own-blink')!
      const src = assetUrl(`${own.dir}/${m}-panel-body.webp`)
      if (!body.src.endsWith(src.replace(/^\.\//, ''))) {
        body.src = src
        blink.src = assetUrl(`${own.dir}/${m}-panel-blink.webp`)
        // the face's own little flash as it changes (the stylesheet's lmFace)
        body.style.animation = 'none'
        void body.offsetWidth
        body.style.animation = ''
      }
    }
    this.blinking()
  }

  private blinkTimer?: ReturnType<typeof setTimeout>
  /** Now and then, while her panel is open, she blinks (sometimes twice). */
  private blinking(): void {
    if (this.blinkTimer || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const shut = (box: HTMLElement, ms: number) => {
      box.classList.add('blink')
      setTimeout(() => box.classList.remove('blink'), ms)
    }
    const next = () => {
      this.blinkTimer = setTimeout(() => {
        const box = this.host.querySelector<HTMLElement>('.lm-own')
        if (!box || !this.open) return void (this.blinkTimer = undefined)
        shut(box, 130)
        if (Math.random() < 0.25) setTimeout(() => shut(box, 110), 290)
        next()
      }, 2600 + Math.random() * 2400)
    }
    next()
  }

  /** Her own panel picture in a mood (any it lacks, its neutral). */
  private ownUrl(mood?: Mood): string {
    const own = this.own!
    return assetUrl(`${own.dir}/${mood && own.moods.includes(mood) ? mood : 'neutral'}-panel.webp`)
  }

  /**
   * The road: what she says to do now (the tracked quest's hint when it is one of hers or the main's, else the main
   * road's), the main quest's objectives, and beside it each guide under way — the lessons she began herself, each
   * with her tip for it.
   */
  private guide(road: Road, name: string): string {
    const zh = locale.value === 'zh'
    const { main, guides } = road
    if (!main && !guides.length)
      return `<div class="lm-say"><span class="lm-who">${esc(name)}</span><p>${zh ? '现在没什么急事。想去哪就去哪吧！我跟着你。' : 'Nothing presses now. Go where you like — I’m right behind you!'}</p></div>`
    const spoken = guides.find((q) => q.tracked) ?? main ?? guides[0]
    const open = spoken.objectives.filter((o) => o.state === 'open' && !o.optional)
    const words = spoken.hint ? tx(spoken.hint) : open[0] ? tx(open[0].text) : tx(spoken.summary)
    const cards = [...(main ? [this.card(main, zh ? '主线' : 'Main quest', '')] : []), ...guides.map((q) => this.card(q, zh ? '指引 · 露米的教学' : 'Guide · a lesson of Lumi’s', 'guide', q === spoken ? undefined : q.hint))]
    return `<div class="lm-say"><span class="lm-who">${esc(name)}</span><p>${esc(words)}</p></div>${cards.join('')}`
  }

  /** One quest on the road: its kind, its title, what it is about, its objectives (and her tip, when it is not the one she speaks). */
  private card(q: JournalQuest, kicker: string, cls: string, hint?: Text): string {
    const zh = locale.value === 'zh'
    const objectives = q.objectives
      .filter((o) => o.state !== 'failed')
      .map((o) => {
        const done = o.state === 'done'
        const bar = o.need ? `<span class="lm-bar"><i style="width:${Math.round((100 * Math.min(o.have ?? 0, o.need)) / o.need)}%"></i></span><em>${o.have ?? 0}/${o.need}</em>` : ''
        return `<li class="${done ? 'done' : ''}${o.optional ? ' opt' : ''}"><span class="lm-check">${done ? '✓' : ''}</span><span class="lm-obj">${esc(tx(o.text))}${o.optional ? `<small>${zh ? '（可选）' : ' (optional)'}</small>` : ''}${o.where && !done ? `<span class="lm-where">⌖ ${esc(tx(o.where))}</span>` : ''}</span>${bar}</li>`
      })
      .join('')
    return `<div class="lm-quest ${cls}">
        <div class="lm-kicker">${kicker}${q.tracked ? `<span class="lm-tracked">${zh ? '追踪中' : 'Tracked'}</span>` : ''}</div>
        <h3>${esc(tx(q.title))}</h3>
        <p class="lm-summary">${esc(tx(q.summary))}</p>
        ${hint ? `<p class="lm-hint">${esc(tx(hint))}</p>` : ''}
        <ul class="lm-objs">${objectives}</ul>
        <button class="cv-btn small lm-log" data-log>${zh ? '打开任务日志' : 'Open the quest log'}</button>
      </div>`
  }

  /** The five seals' powers: found and carried, found, or still sealed. */
  private powers(f: Frame): string {
    const zh = locale.value === 'zh'
    const b = f.player.boons
    const unlocked = b?.unlocked ?? []
    // each power in its seal's place (a boon names its seal; one that does not, the next free place)
    const at: (string | undefined)[] = Array.from({ length: SEALS }, () => undefined)
    for (const id of unlocked) {
      const n = (BOON_BY_ID[id]?.seal ?? 0) - 1
      at[n >= 0 && n < SEALS && !at[n] ? n : at.findIndex((x) => !x)] = id
    }
    const cards = Array.from({ length: SEALS }, (_, i) => {
      const def = BOON_BY_ID[at[i] ?? '']
      const seal = zh ? `第${ORDINAL[i]}印 · ${RELIC[i][1]}` : `Seal ${ROMAN[i]} · ${RELIC[i][0]}`
      if (!def)
        return `<div class="lm-seal sealed" data-seal="${i}"><div class="lm-medal"><b>${ROMAN[i]}</b><i>🔒︎</i></div>
          <div class="lm-seal-body"><small>${seal}</small><b>${t('boonSealed')}</b></div></div>`
      const mine = def.id === b?.active
      const action = mine
        ? `<span class="lm-carried">✦ ${t('boonCarried')}</span>`
        : `<button class="cv-btn primary small" data-boon="${esc(def.id)}" ${b?.atWaypoint ? '' : 'disabled'}>${t('boonCarry')}</button>`
      return `<div class="lm-seal${mine ? ' mine' : ''}" data-seal="${i}"><div class="lm-medal"><b>${ROMAN[i]}</b></div>
        <div class="lm-seal-body"><small>${seal}</small><b>${esc(tx(def.name))}</b><p>${esc(tx(def.doc))}</p></div>
        <div class="lm-seal-act">${action}</div></div>`
    }).join('')
    const note = `${t('boonSealedDoc')} ${b?.atWaypoint ? t('boonOne') : t('boonAway')}`
    return `<div class="lm-note${b?.atWaypoint ? ' near' : ''}">${note}</div><div class="lm-seals">${cards}</div>`
  }
}

/** Her panel (ui/panels.ts). */
export const companionPanel = (ctx: PanelContext): GamePanel => new CompanionPanel(ctx)

/** What "the road" means: the main quest under way (else the tracked one, if it is not a guide), and her guides under way. */
interface Road {
  main?: JournalQuest
  guides: JournalQuest[]
}

function roadOf(f: Frame): Road {
  const active = (f.quests?.journal ?? []).filter((q) => q.state === 'active')
  const guides = active.filter((q) => q.kind === 'guide')
  return { main: active.find((q) => q.kind === 'main') ?? active.find((q) => q.tracked && q.kind !== 'guide'), guides }
}

/**
 * Her wings: glassy, lavender into pink, veined, drawn behind the bust from her shoulders and beating slowly — each an
 * upper wing and a smaller lower one, in mirror.
 */
const WINGS = `<svg class="lm-wings" viewBox="0 0 360 320" aria-hidden="true">
  <defs>
    <linearGradient id="lmWingUp" x1="1" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#f6eaff" stop-opacity="0.85"/>
      <stop offset="0.45" stop-color="#cdb8ff" stop-opacity="0.6"/>
      <stop offset="0.8" stop-color="#ffc6ec" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#b9e4ff" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="lmWingDown" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3e8ff" stop-opacity="0.8"/>
      <stop offset="0.5" stop-color="#d9c4ff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffd2ef" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <g class="lm-wing left">
    <path d="M180 170 C140 120 70 40 28 52 C2 60 6 118 40 150 C70 178 130 182 180 176 Z" fill="url(#lmWingUp)" stroke="#e9f6ff" stroke-opacity="0.9" stroke-width="2"/>
    <path d="M178 172 C140 140 95 100 52 82 M176 174 C130 160 90 140 44 128" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.2" fill="none"/>
    <path d="M180 184 C150 192 96 204 70 228 C52 250 92 268 128 252 C156 238 176 212 182 190 Z" fill="url(#lmWingDown)" stroke="#e9f6ff" stroke-opacity="0.85" stroke-width="2"/>
    <circle cx="62" cy="96" r="7" fill="#fff4c4" fill-opacity="0.4"/>
  </g>
  <g class="lm-wing right">
    <path d="M180 170 C220 120 290 40 332 52 C358 60 354 118 320 150 C290 178 230 182 180 176 Z" fill="url(#lmWingUp)" stroke="#e9f6ff" stroke-opacity="0.9" stroke-width="2"/>
    <path d="M182 172 C220 140 265 100 308 82 M184 174 C230 160 270 140 316 128" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.2" fill="none"/>
    <path d="M180 184 C210 192 264 204 290 228 C308 250 268 268 232 252 C204 238 184 212 178 190 Z" fill="url(#lmWingDown)" stroke="#e9f6ff" stroke-opacity="0.85" stroke-width="2"/>
    <circle cx="298" cy="96" r="7" fill="#fff4c4" fill-opacity="0.4"/>
  </g>
</svg>`
