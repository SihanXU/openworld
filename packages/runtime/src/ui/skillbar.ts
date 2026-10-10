// The skill bar (bottom left): the six slots of active skills (engine actives.ts), cast with Shift+1–6 or a
// click. Each slot is a square, bevelled frame round the skill's picture, its key in the corner; while a skill
// rests, a dark sweep runs round it with the seconds left, and it flashes when it is ready again (after the
// skill bars of action games: Dungeon Fighter's). A learned active skill goes in the first empty slot by itself;
// one is moved by dragging it to another slot, set from the skill tree (hovering it, Shift+1–6), and taken out
// with a right click; all of it is managed in the skill panel (U, ui/skillpanel.ts).

import type { Frame } from '@openworld/engine'
import { SKILL_BY_ID } from '@openworld-game/content'
import { $, esc, locale, tx } from './common.ts'
import { skillPng } from './skillIcons.ts'

export const SKILLBAR_KEYS = ['1', '2', '3', '4', '5', '6']

export class SkillBar {
  private shown = ''
  private wasCooling: boolean[] = []

  constructor(private send: { cast: (slot: number) => void; set: (slot: number, id: string | null) => void }) {
    const bar = document.createElement('div')
    bar.className = 'skillbar'
    bar.id = 'skillbar'
    bar.innerHTML = SKILLBAR_KEYS.map((k, i) => `<div class="sb-slot empty" data-slot="${i}"><img class="sb-icon" alt="" draggable="false"><div class="sb-cd"></div><span class="sb-sec"></span><kbd>⇧${k}</kbd></div>`).join('')
    $('#hud').appendChild(bar)
    bar.querySelectorAll<HTMLElement>('.sb-slot').forEach((el) => {
      const i = Number(el.dataset.slot)
      el.onclick = () => this.send.cast(i)
      el.oncontextmenu = (e) => (e.preventDefault(), this.send.set(i, null))
      el.ondragstart = (e) => e.dataTransfer?.setData('text/skill', el.dataset.skill ?? '')
      el.ondragover = (e) => e.preventDefault()
      el.ondrop = (e) => {
        e.preventDefault()
        const id = e.dataTransfer?.getData('text/skill')
        if (id) this.send.set(i, id)
      }
    })
  }

  onFrame(f: Frame): void {
    const bar = f.player.skillbar ?? []
    const zh = locale.value === 'zh'
    // what is set where: redrawn only when it changes
    const sig = bar.map((s) => s?.id ?? '').join('|') + locale.value
    const slots = [...document.querySelectorAll<HTMLElement>('#skillbar .sb-slot')]
    if (sig !== this.shown) {
      this.shown = sig
      slots.forEach((el, i) => {
        const s = bar[i]
        const def = s ? SKILL_BY_ID[s.id] : undefined
        el.classList.toggle('empty', !def)
        el.draggable = !!def
        el.dataset.skill = def?.id ?? ''
        const img = el.querySelector<HTMLImageElement>('.sb-icon')!
        if (def) img.src = skillPng(def.icon ?? def.id)
        img.hidden = !def
        el.title = def ? `${tx(def.name)} — ${zh ? '冷却' : 'cooldown'} ${(def.active?.cooldown ?? 0) / 10}${zh ? ' 秒' : ' s'}\n${tx(def.doc)}\n${zh ? '右键移出技能栏' : 'Right click: take it out'}` : zh ? '空技能槽：学会主动技能后自动放入，或在技能树中悬停技能按 Shift+数字' : 'Empty: learned active skills go here; or hover one in the skill tree and press Shift+number'
      })
    }
    // the cooldowns: a dark sweep and the seconds left; a flash when it is ready again
    slots.forEach((el, i) => {
      const s = bar[i]
      const cooling = !!s && s.left > 0
      const cd = el.querySelector<HTMLElement>('.sb-cd')!
      const sec = el.querySelector<HTMLElement>('.sb-sec')!
      if (cooling) {
        const part = Math.min(1, s!.left / Math.max(1, s!.cooldown))
        cd.style.background = `conic-gradient(rgba(8, 6, 12, 0.72) ${part * 360}deg, transparent 0)`
        sec.textContent = s!.left >= 100 ? String(Math.ceil(s!.left / 10)) : (s!.left / 10).toFixed(1)
      } else {
        cd.style.background = ''
        sec.textContent = ''
      }
      el.classList.toggle('cooling', cooling)
      // a skill no longer had (the piece that lent it taken off): greyed, not cast
      el.classList.toggle('lost', !!s && !s.usable)
      if (this.wasCooling[i] && !cooling && s) {
        el.classList.remove('ready-flash')
        void el.offsetWidth
        el.classList.add('ready-flash')
      }
      this.wasCooling[i] = cooling
    })
  }
}

/** A hint for the skill tree's hover card: how an active skill gets into the bar. */
export const skillbarHint = (zh: boolean) => esc(zh ? '主动技能：悬停时按 Shift+1~6 放入技能栏' : 'Active: hover and press Shift+1–6 to set it in the skill bar')
