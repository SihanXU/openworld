// The companion's panel (2026-10-12; E on her, or a woken waypoint statue): the fairy herself, her portrait drawn
// with her wings and her light, and two pages — what the main road asks now (the main quest's stage, its hint in her
// words, its objectives), and the seals' powers she has taken up (engine/src/boons.ts): five slots, the ones not yet
// found sealed, the one she carries, and the choice of another — only beside a woken statue.

import type { Frame, JournalQuest, Mood } from '@openworld/engine'
import { portraitOf, preparePortrait } from '../assets/figure/index.ts'
import { game } from '../game.ts'
import { $, esc, locale, t, tx } from './common.ts'

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

export type CompanionTab = 'guide' | 'powers'

export class CompanionPanel {
  private sig = ''
  private tab: CompanionTab = 'guide'
  private frame?: Frame

  constructor(
    private host: HTMLElement,
    private choose: (id: string) => void,
    private close: () => void,
    private openQuests: () => void,
  ) {}

  get open(): boolean {
    return !this.host.classList.contains('hidden')
  }

  show(f: Frame | undefined, tab: CompanionTab): void {
    this.tab = tab
    this.host.classList.remove('hidden')
    this.sig = ''
    if (f) this.render(f)
  }

  render(f: Frame): void {
    this.frame = f
    const b = f.player.boons
    const main = mainQuest(f)
    const sig = `${locale.value}|${this.tab}|${b?.unlocked.join()}|${b?.active}|${b?.atWaypoint}|${JSON.stringify(main)}`
    if (sig === this.sig) return
    this.sig = sig
    const zh = locale.value === 'zh'
    const me = f.entities.find((e) => e.tags.includes('companion'))
    const name = me?.name ? tx(me.name) : zh ? '露米' : 'Lumi'
    const epithet = game().companion?.epithet
    const tab = (id: CompanionTab, icon: string, en: string, zh2: string) =>
      `<button class="lm-tab${this.tab === id ? ' on' : ''}" data-tab="${id}"><i>${icon}</i>${zh ? zh2 : en}</button>`
    this.host.innerHTML = `<div class="sheet wood lm-sheet">
      <aside class="lm-stage">
        <div class="lm-sky"></div>
        <div class="lm-halo"></div>
        <div class="lm-figure">${WINGS}<div class="lm-bust" id="lmBust"></div></div>
        ${Array.from({ length: 9 }, (_, i) => `<span class="lm-mote" style="--i:${i}"></span>`).join('')}
        <div class="lm-plate"><b>${esc(name)}</b><small>${epithet ? esc(tx(epithet)) : ''}</small></div>
      </aside>
      <section class="lm-main">
        <div class="lm-head">
          <div class="lm-tabs">${tab('guide', '✦', 'The Road', '主线指引')}${tab('powers', '✧', "The Seals' Powers", '印之力量')}</div>
          <button class="lm-x" id="lmClose" title="${zh ? '关闭' : 'Close'}">✕</button>
        </div>
        <div class="lm-body">${this.tab === 'guide' ? this.guide(main, name) : this.powers(f)}</div>
      </section>
    </div>`
    // her face: on the road, glad when nothing presses; on the powers, as the seal she carries stirs her
    const seal = b?.active ? game().boons[b.active]?.seal : undefined
    const carried = seal ? seal - 1 : b?.active ? (b.unlocked ?? []).indexOf(b.active) : -1
    const rest = this.tab === 'guide' ? (main ? undefined : 'happy') : carried >= 0 ? SEAL_MOOD[carried] : undefined
    this.drawBust(rest)
    if (this.tab === 'powers') this.stirred(rest, epithet ? tx(epithet) : '')
    $('#lmClose', this.host).onclick = () => this.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((el) => (el.onclick = () => ((this.tab = el.dataset.tab as CompanionTab), (this.sig = ''), this.render(f))))
    this.host.querySelectorAll<HTMLButtonElement>('[data-boon]').forEach((el) => (el.onclick = () => this.choose(el.dataset.boon!)))
    const log = this.host.querySelector<HTMLButtonElement>('#lmLog')
    if (log) log.onclick = () => this.openQuests()
  }

  /** On the powers page: a seal pointed at shows on her face, and its name under hers; away, the carried one's. */
  private stirred(rest: Mood | undefined, epithet: string): void {
    const look = game().companion?.look
    if (look) for (const m of SEAL_MOOD) void preparePortrait(look, m)
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
    const look = game().companion?.look
    const slot = this.host.querySelector('#lmBust')
    if (!look || !slot) return
    const bust = portraitOf(look, mood)
    if (bust) {
      bust.className = 'lm-portrait'
      slot.replaceChildren(bust)
    } else
      void preparePortrait(look, mood).then((ok) => {
        if (ok && this.open && this.frame) ((this.sig = ''), this.render(this.frame))
      })
  }

  /** The main road: what she says to do now, and the quest's objectives. */
  private guide(q: JournalQuest | undefined, name: string): string {
    const zh = locale.value === 'zh'
    if (!q)
      return `<div class="lm-say"><span class="lm-who">${esc(name)}</span><p>${zh ? '现在没什么急事。想去哪就去哪吧！我跟着你。' : 'Nothing presses now. Go where you like — I’m right behind you!'}</p></div>`
    const open = q.objectives.filter((o) => o.state === 'open' && !o.optional)
    const words = q.hint ? tx(q.hint) : open[0] ? tx(open[0].text) : tx(q.summary)
    const objectives = q.objectives
      .filter((o) => o.state !== 'failed')
      .map((o) => {
        const done = o.state === 'done'
        const bar = o.need ? `<span class="lm-bar"><i style="width:${Math.round((100 * Math.min(o.have ?? 0, o.need)) / o.need)}%"></i></span><em>${o.have ?? 0}/${o.need}</em>` : ''
        return `<li class="${done ? 'done' : ''}${o.optional ? ' opt' : ''}"><span class="lm-check">${done ? '✓' : ''}</span><span class="lm-obj">${esc(tx(o.text))}${o.optional ? `<small>${zh ? '（可选）' : ' (optional)'}</small>` : ''}${o.where && !done ? `<span class="lm-where">⌖ ${esc(tx(o.where))}</span>` : ''}</span>${bar}</li>`
      })
      .join('')
    return `<div class="lm-say"><span class="lm-who">${esc(name)}</span><p>${esc(words)}</p></div>
      <div class="lm-quest">
        <div class="lm-kicker">${zh ? '主线' : 'Main quest'}${q.tracked ? `<span class="lm-tracked">${zh ? '追踪中' : 'Tracked'}</span>` : ''}</div>
        <h3>${esc(tx(q.title))}</h3>
        <p class="lm-summary">${esc(tx(q.summary))}</p>
        <ul class="lm-objs">${objectives}</ul>
        <button class="cv-btn small lm-log" id="lmLog">${zh ? '打开任务日志' : 'Open the quest log'}</button>
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
      const n = (game().boons[id]?.seal ?? 0) - 1
      at[n >= 0 && n < SEALS && !at[n] ? n : at.findIndex((x) => !x)] = id
    }
    const cards = Array.from({ length: SEALS }, (_, i) => {
      const def = game().boons[at[i] ?? '']
      const seal = zh ? `第${ORDINAL[i]}印 · ${RELIC[i][1]}` : `Seal ${ROMAN[i]} · ${RELIC[i][0]}`
      if (!def)
        return `<div class="lm-seal sealed" data-seal="${i}"><div class="lm-medal"><b>${ROMAN[i]}</b><i>🔒︎</i></div>
          <div class="lm-seal-body"><small>${seal}</small><b>${t('boonSealed')}</b></div></div>`
      const mine = def.id === b?.active
      const action = mine
        ? `<span class="lm-carried">✦ ${zh ? '携带中' : 'Carried'}</span>`
        : `<button class="cv-btn primary small" data-boon="${def.id}" ${b?.atWaypoint ? '' : 'disabled'}>${zh ? '携带' : 'Carry'}</button>`
      return `<div class="lm-seal${mine ? ' mine' : ''}" data-seal="${i}"><div class="lm-medal"><b>${ROMAN[i]}</b></div>
        <div class="lm-seal-body"><small>${seal}</small><b>${esc(tx(def.name))}</b><p>${esc(tx(def.doc))}</p></div>
        <div class="lm-seal-act">${action}</div></div>`
    }).join('')
    const note = `${t('boonSealedDoc')} ${b?.atWaypoint ? t('boonOne') : zh ? '只有在唤醒过的传送雕像旁才能切换携带的力量。' : 'A power can be changed only beside a woken waypoint statue.'}`
    return `<div class="lm-note${b?.atWaypoint ? ' near' : ''}">${note}</div><div class="lm-seals">${cards}</div>`
  }
}

/** The main quest under way, else the tracked one: what "the road" means. */
function mainQuest(f: Frame): JournalQuest | undefined {
  const active = (f.quests?.journal ?? []).filter((q) => q.state === 'active')
  return active.find((q) => q.kind === 'main') ?? active.find((q) => q.tracked)
}

/** Her wings: glassy, lavender into pink, veined, drawn behind the bust from her shoulders and beating slowly. */
const WINGS = `<svg class="lm-wings" viewBox="0 0 360 320" aria-hidden="true">
  <defs>
    <linearGradient id="lmWingUp" x1="1" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#f6eaff" stop-opacity="0.85"/>
      <stop offset="0.45" stop-color="#cdb8ff" stop-opacity="0.6"/>
      <stop offset="0.8" stop-color="#ffc6ec" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#b9e4ff" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <g class="lm-wing left">
    <path d="M180 170 C140 120 70 40 28 52 C2 60 6 118 40 150 C70 178 130 182 180 176 Z" fill="url(#lmWingUp)" stroke="#e9f6ff" stroke-opacity="0.9" stroke-width="2"/>
    <path d="M178 172 C140 140 95 100 52 82 M176 174 C130 160 90 140 44 128" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.2" fill="none"/>
    <circle cx="62" cy="96" r="7" fill="#fff4c4" fill-opacity="0.4"/>
  </g>
  <g class="lm-wing right">
    <path d="M180 170 C220 120 290 40 332 52 C358 60 354 118 320 150 C290 178 230 182 180 176 Z" fill="url(#lmWingUp)" stroke="#e9f6ff" stroke-opacity="0.9" stroke-width="2"/>
    <path d="M182 172 C220 140 265 100 308 82 M184 174 C230 160 270 140 316 128" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.2" fill="none"/>
    <path d="M180 184 C210 192 264 204 290 228 C308 250 268 268 232 252 C204 238 184 212 178 190 Z" fill="url(#lmWingDown)" stroke="#e9f6ff" stroke-opacity="0.85" stroke-width="2"/>
    <circle cx="298" cy="96" r="7" fill="#fff4c4" fill-opacity="0.4"/>
  </g>
</svg>`
