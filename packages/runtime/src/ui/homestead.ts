// The home ground's panel (its steward's talk opens it: Alberic, "The Held Ground…"): how far the land holds, drawn as a
// round chart beside the ground's stock, and three tabs of what it can grow into — the LAND (rings of mist lifted, one
// after another), new GROUNDS (places of their own with what their ground is good for: a quarry, a timberland, a lake,
// hot springs), BUILDINGS (a plot at the heart built into a workshop, a storehouse…). Materials are handed to the
// steward into the stock: drag a stack from the pack beneath onto a card's slot (as many as it still lacks), or click a
// stack (all of it that any upgrade asks for). An upgrade whose land is reached and whose needs the stock holds is built
// with its button; an opened ground can be gone to from its card.

import type { Frame, ItemInfo } from '@openworld/engine'
import { game } from '../game.ts'
import { esc, locale, tx } from './common.ts'

type Home = NonNullable<ReturnType<typeof game>['homestead']>
type Upgrade = Home['upgrades'][number]
type Track = Upgrade['track']
type State = 'done' | 'ready' | 'active' | 'locked'

const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const TRACKS: [Track, string, string, string][] = [['land', 'Land', '土地', '⛰'], ['zone', 'Grounds', '新区域', '🗺'], ['building', 'Buildings', '建筑', '🏠']]

export class HomesteadPanel {
  private sig = ''
  private track: Track = 'land'

  constructor(
    private host: HTMLElement,
    private send: { say(who: string, verb: string, choice?: string): void; offer(target: string, item: string, count: number): void },
    private close: () => void,
    private paint: (items: ItemInfo[]) => void,
  ) {}

  get open(): boolean {
    return !this.host.classList.contains('hidden')
  }

  show(f?: Frame): void {
    this.host.classList.remove('hidden')
    this.sig = ''
    if (f) this.render(f)
  }

  render(f: Frame): void {
    this.last = f
    const home = game().homestead
    if (!home) return
    const zh = locale.value === 'zh'
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
    const size = num(f.facts[home.size])
    const stock = (type: string) => num(f.facts[`${home.stock}${type}`])
    // what is carried, by kind
    const carried = new Map<string, { item: ItemInfo; count: number }>()
    for (const s of f.player.slots) {
      if (!s || s.worn) continue
      const c = carried.get(s.item.type)
      if (c) c.count += s.count
      else carried.set(s.item.type, { item: s.item, count: s.count })
    }
    const materials = new Set(home.upgrades.flatMap((u) => u.needs.map((n) => n.type)))
    const names = new Map(home.upgrades.flatMap((u) => u.needs.map((n) => [n.type, n.text] as const)))
    const rows = home.upgrades.map((u) => {
      const needs = u.needs.map((n) => ({ ...n, have: Math.min(n.count, stock(n.type)), carried: carried.get(n.type)?.count ?? 0 }))
      const done = num(f.facts[u.fact]) >= u.value
      const open = size >= u.land && (u.track !== 'land' || size === u.value - 1)
      const state: State = done ? 'done' : !open ? 'locked' : needs.every((n) => n.have >= n.count) ? 'ready' : 'active'
      return { u, state, needs }
    })
    const sig = JSON.stringify([locale.value, this.track, size, rows.map((r) => [r.state, r.needs.map((n) => [n.have, n.carried])]), [...carried].map(([t, c]) => t + c.count)])
    if (sig === this.sig) return
    this.sig = sig
    const label: Record<State, string> = zh ? { done: '已完成', ready: '可建造', active: '收集中', locked: '未解锁' } : { done: 'Done', ready: 'Ready', active: 'Gathering', locked: 'Locked' }
    const verb: Record<Track, string> = zh ? { land: '扩建！', zone: '开辟！', building: '建造！' } : { land: 'Widen!', zone: 'Open!', building: 'Build!' }
    const list = rows.filter((r) => r.u.track === this.track)
    const cards = list.map((r, i) => {
      const needs = r.needs.map((n) => {
        const pct = Math.round((100 * n.have) / n.count)
        const full = n.have >= n.count
        const live = r.state === 'active' || r.state === 'ready'
        const slot = live
          ? `<div class="hs-drop${full ? ' full' : ''}${!full && n.carried ? ' can' : ''}" data-type="${n.type}" data-lack="${n.count - n.have}" title="${zh ? (full ? '库存已够' : n.carried ? '拖入或点击放入库存' : '身上没有') : full ? 'Enough in stock' : n.carried ? 'Drop or click to stock it' : 'None carried'}"><span class="icon" data-icon="need:${n.type}"></span>${full ? '<i class="hs-tick">✓</i>' : ''}</div>`
          : `<span class="icon" data-icon="need:${n.type}"></span>`
        return `<div class="hs-need${full ? ' full' : ''}">
          ${slot}
          <div class="hs-need-mid"><span class="hs-need-name">${esc(tx(n.text))}${live && !full ? `<small>${zh ? '身上' : 'carried'} ${n.carried}</small>` : ''}</span><span class="hs-bar"><i style="width:${pct}%"></i></span></div>
          <b>${n.have}/${n.count}</b></div>`
      }).join('')
      const req = r.state === 'locked' ? `<span class="hs-req">${r.u.track === 'land' ? (zh ? '先完成上一级' : 'The one before first') : zh ? `需要土地 ${ROMAN[r.u.land - 1] ?? r.u.land} 级` : `Needs land ${r.u.land}`}</span>` : ''
      const act = r.state === 'ready'
        ? `<button class="hs-btn go" data-build="${r.u.id}">${verb[r.u.track]}</button>`
        : r.state === 'active'
          ? `<button class="hs-btn" disabled>${zh ? '材料未齐' : 'Not all in stock'}</button>`
          : r.state === 'done' && r.u.map
            ? `<button class="hs-btn" data-go="${r.u.id}">${zh ? '前往 ➜' : 'Go ➜'}</button>`
            : ''
      const reward = r.u.coins ? `<span class="hs-reward">${zh ? '奖励' : 'Reward'}：<span class="icon" data-icon="need:${game().items.coin}"></span><b>${r.u.coins}</b></span>` : '<span></span>'
      return `<div class="hs-card ${r.state}">
        <div class="hs-badge">${r.u.track === 'land' ? ROMAN[i] ?? i + 1 : TRACKS.find((t) => t[0] === r.u.track)![3]}</div>
        <div class="hs-main">
          <div class="hs-top"><b>${esc(tx(r.u.name))}</b>${req}<span class="hs-chip ${r.state}">${label[r.state]}</span></div>
          <ul class="hs-unlocks">${r.u.unlocks.map((u) => `<li>${esc(tx(u))}</li>`).join('')}</ul>
          ${r.state === 'done' ? '' : `<div class="hs-needs">${needs}</div>`}
          <div class="hs-foot">${reward}${act}</div>
        </div>
      </div>`
    }).join('')
    const tabs = TRACKS.map(([t, en, zh2, ic]) => {
      const n = rows.filter((r) => r.u.track === t)
      const ready = n.some((r) => r.state === 'ready')
      return `<button class="cx-tab hs-tab${t === this.track ? ' on' : ''}" data-track="${t}">${ic} ${zh ? zh2 : en} <small>${n.filter((r) => r.state === 'done').length}/${n.length}</small>${ready ? '<i class="hs-dot"></i>' : ''}</button>`
    }).join('')
    const stockChips = [...materials].map((type) => `<span class="hs-stock-chip${stock(type) ? '' : ' none'}" title="${esc(tx(names.get(type)!))}"><span class="icon" data-icon="need:${type}"></span><b>${stock(type)}</b></span>`).join('')
    const wanted = new Set(rows.filter((r) => r.state === 'active').flatMap((r) => r.needs.filter((n) => n.have < n.count).map((n) => n.type)))
    const pack = [...carried.values()]
      .sort((a, b) => Number(wanted.has(b.item.type)) - Number(wanted.has(a.item.type)))
      .map((c) => `<div class="hs-item${materials.has(c.item.type) ? ' mat' : ''}${wanted.has(c.item.type) ? ' want' : ''}" data-drag="${c.item.id}" data-type="${c.item.type}" title="${esc(tx(c.item.name))}"><div class="icon" data-icon="${c.item.id}"></div>${c.count > 1 ? `<span class="count">${c.count}</span>` : ''}</div>`)
      .join('')
    const lands = rows.filter((r) => r.u.track === 'land').length
    this.host.innerHTML = `<div class="sheet wood hs-sheet">
      <div class="tabs-row"><b class="sheet-title">⚑ ${esc(tx(home.title))}</b><button class="x" id="hsClose">✕</button></div>
      <div class="tab-body hs-body">
        <div class="hs-left">
          <canvas class="hs-chart" width="220" height="220"></canvas>
          <div class="hs-level"><span>${zh ? '土地等级' : 'Land'}</span><b>${size}</b><small>/ ${lands}</small></div>
          <div class="hs-pips">${rows.filter((r) => r.u.track === 'land').map((r) => `<i class="${r.state === 'done' ? 'on' : ''}"></i>`).join('')}</div>
          <div class="hs-stock"><span class="hs-stock-title">${zh ? '领地库存' : 'Stock'}</span><div class="hs-stock-chips">${stockChips}</div></div>
          <p class="hs-note">${zh ? '材料交给阿尔贝里克存进领地库存：把行囊里的材料拖到卡片的材料槽上，或直接点一下行囊里的材料。库存够了就能建造。' : 'Hand materials to Alberic into the stock: drag from the pack onto a card\'s slot, or click a stack in the pack. Build once the stock holds enough.'}</p>
        </div>
        <div class="hs-right">
          <div class="cx-tabs hs-tabs">${tabs}</div>
          <div class="hs-track">${cards}</div>
          <div class="hs-pack"><span class="hs-pack-title">${zh ? '行囊' : 'Pack'}</span><div class="hs-pack-items">${pack || `<span class="muted small">${zh ? '身上没有东西' : 'Nothing carried'}</span>`}</div></div>
        </div>
      </div></div>`
    this.chart(this.host.querySelector<HTMLCanvasElement>('.hs-chart')!, size, lands)
    this.wire(home, carried, materials, rows)
    this.paint([...carried.values()].map((c) => c.item))
  }

  private wire(home: Home, carried: Map<string, { item: ItemInfo; count: number }>, materials: Set<string>, rows: { u: Upgrade; state: State; needs: { type: string; count: number; have: number }[] }[]): void {
    this.host.querySelector<HTMLElement>('#hsClose')!.onclick = () => this.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-track]').forEach((b) => (b.onclick = () => ((this.track = b.dataset.track as Track), (this.sig = ''), this.render(this.last!))))
    this.host.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((b) => (b.onclick = () => this.send.say(home.steward, 'haven', `build:${b.dataset.build}`)))
    this.host.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => (b.onclick = () => (this.send.say(home.steward, 'haven', `go:${b.dataset.go}`), this.close())))
    // what the open upgrades still lack of a kind, in all (a click on a stack hands that many)
    const lacking = (type: string) => rows.filter((r) => r.state === 'active' || r.state === 'ready').reduce((n, r) => n + r.needs.filter((x) => x.type === type).reduce((m, x) => m + Math.max(0, x.count - x.have), 0), 0)
    const hand = (type: string, n: number) => {
      const c = carried.get(type)
      const k = Math.min(c?.count ?? 0, n)
      if (c && k > 0) this.send.offer(home.steward, c.item.id, k)
    }
    const drops = () => [...this.host.querySelectorAll<HTMLElement>('.hs-drop')]
    this.host.querySelectorAll<HTMLElement>('[data-drag]').forEach((el) => {
      el.addEventListener('pointerdown', (down) => {
        if (down.button !== 0) return
        const type = el.dataset.type!
        let ghost: HTMLElement | undefined
        const over = (x: number, y: number) => drops().find((d) => {
          const r = d.getBoundingClientRect()
          return d.dataset.type === type && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
        })
        const move = (e: PointerEvent) => {
          if (!ghost && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < 5) return
          if (!ghost) {
            ghost = el.cloneNode(true) as HTMLElement
            ghost.classList.add('hs-ghost')
            document.body.appendChild(ghost)
            drops().forEach((d) => d.classList.toggle('hot', d.dataset.type === type && !d.classList.contains('full')))
          }
          ghost.style.left = `${e.clientX}px`
          ghost.style.top = `${e.clientY}px`
          drops().forEach((d) => d.classList.toggle('over', d === over(e.clientX, e.clientY)))
        }
        const up = (e: PointerEvent) => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          drops().forEach((d) => d.classList.remove('hot', 'over'))
          if (ghost) {
            ghost.remove()
            const d = over(e.clientX, e.clientY)
            if (d) hand(type, Number(d.dataset.lack) || 0)
          } else if (materials.has(type)) hand(type, lacking(type))
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        down.preventDefault()
      })
    })
    drops().forEach((d) => d.addEventListener('click', () => hand(d.dataset.type!, Number(d.dataset.lack) || 0)))
  }

  private last?: Frame

  /** The ground as a round chart: the held field round the sword, the mist beyond each ring not yet lifted. */
  private chart(c: HTMLCanvasElement, level: number, total: number): void {
    const g = c.getContext('2d')!
    const W = c.width
    const cx = W / 2
    const cy = W / 2
    const r0 = Math.round(W * 0.12)
    const step = (W / 2 - 12 - r0) / total
    const radius = (n: number) => r0 + n * step
    g.clearRect(0, 0, W, W)
    // the mist: the whole ground, pale and grey
    g.fillStyle = '#d9d4c6'
    g.beginPath()
    g.arc(cx, cy, radius(total), 0, Math.PI * 2)
    g.fill()
    // the held field: green out to the last ring lifted, each ring a shade lighter (what was won later)
    const greens = ['#7fae54', '#8fbb5e', '#a1c76b', '#b3d27a', '#c2dc88']
    for (let n = level; n >= 0; n--) {
      g.fillStyle = greens[n] ?? greens[greens.length - 1]
      g.beginPath()
      g.arc(cx, cy, radius(n), 0, Math.PI * 2)
      g.fill()
    }
    // trees and stones sprinkled in what is held, by a fixed pattern
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39996
      const d = r0 * 0.6 + (((i * 37) % 100) / 100) * (radius(level) - r0 * 0.6 - 6)
      if (d > radius(level) - 6) continue
      g.fillStyle = i % 3 === 0 ? '#9a9486' : '#4f7d36'
      g.beginPath()
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, i % 3 === 0 ? 2 : 3, 0, Math.PI * 2)
      g.fill()
    }
    // the rings: lifted ones a thin gold line, the standing ones dashed mist
    for (let n = 1; n <= total; n++) {
      g.save()
      g.beginPath()
      g.arc(cx, cy, radius(n), 0, Math.PI * 2)
      if (n <= level) {
        g.strokeStyle = 'rgba(217, 164, 65, 0.9)'
        g.lineWidth = 2
      } else {
        g.setLineDash([6, 5])
        g.strokeStyle = 'rgba(110, 104, 92, 0.85)'
        g.lineWidth = 3
      }
      g.stroke()
      g.restore()
      g.fillStyle = n <= level ? '#7a4a12' : '#6e685c'
      g.font = '700 12px "Pixelify Sans", sans-serif'
      g.textAlign = 'center'
      g.fillText(ROMAN[n - 1] ?? String(n), cx, cy - radius(n) + 14)
    }
    g.strokeStyle = '#4a2a14'
    g.lineWidth = 4
    g.beginPath()
    g.arc(cx, cy, radius(total) + 2, 0, Math.PI * 2)
    g.stroke()
    // the planted sword at the heart
    g.save()
    g.translate(cx, cy + 6)
    g.fillStyle = '#e8e4da'
    g.strokeStyle = '#3a2414'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(-3, -6)
    g.lineTo(3, -6)
    g.lineTo(3, 14)
    g.lineTo(0, 20)
    g.lineTo(-3, 14)
    g.closePath()
    g.fill()
    g.stroke()
    g.fillStyle = '#d9a441'
    g.fillRect(-10, -9, 20, 4)
    g.strokeRect(-10, -9, 20, 4)
    g.fillStyle = '#6b3d1c'
    g.fillRect(-2, -20, 4, 11)
    g.fillStyle = '#d9a441'
    g.beginPath()
    g.arc(0, -22, 3.5, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
}
