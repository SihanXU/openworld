// The skill tree page (K, or its button bottom right): a field the player drags and zooms. The start
// is in the middle and its four branches grow out from it, left, right, up and down, each in a panel
// of its own, its skills in rows outward by how deep they lie (skillLayout.ts, after Diablo II's and
// World of Warcraft's talent grids), joined by square elbows — so the tree can grow and still read in order.
// What a node does shows on hover; a click learns it when it is ready.

import { canvasWindow, placeFloating } from './components/index.ts'
import type { Frame, SkillDef } from '@openworld/engine'
import { game, skillById } from '../game.ts'
import { $, esc, locale, t, tx } from './common.ts'
import { bindSkillArt, skillArt } from './skillIcons.ts'
import { ROW, layoutTree, type TreeLayout, type Way } from './skillLayout.ts'
import { skillbarHint } from './skillbar.ts'

export { layoutSkills } from './skillLayout.ts'

const ZOOM: [number, number] = [0.12, 2]
/** The least the tree opens at: its skills' pictures still read (smaller, one zooms out oneself). */
const READABLE = 0.62

export class SkillTree {
  private pan = { x: 0, y: 0 }
  private zoom = 1
  private sig = ''
  private frame?: Frame
  private drag?: { id: number; x: number; y: number; px: number; py: number; moved: boolean }
  private suppressClick = false
  /** The branch closed in on (a tab, a hub), or none: the whole tree. */
  private focused?: string
  /** The skill node under the pointer (the skill bar's Shift+1–6 sets it). */
  hovered?: string
  /** The direction shown first: the game's first. */
  private direction: string = game().skills.directions[0]?.id ?? 'combat'
  private profession = ''
  private tree: TreeLayout = layoutTree(game().skills.all, this.direction)
  private get layout() {
    return this.tree.nodes
  }
  private get branches() {
    return this.tree.hubs
  }

  constructor(
    host: HTMLElement,
    private learn: (id: string) => void,
    private close: () => void,
  ) {
    host.innerHTML = `
      <div class="sk-view" id="skView"><div class="sk-world" id="skWorld"></div></div>
      <div class="sk-bar wood">
        <span class="sk-title">${''}</span><span class="sk-points" id="skPoints"></span>
        <span class="sk-hint" id="skHint"></span>
        <button id="skCenter" class="sk-btn"></button><button class="x" id="skClose">✕</button>
      </div>
      <nav class="sk-directions" id="skDirections"></nav>
      <nav class="sk-branches" id="skBranches"></nav>
      <div class="sk-zoom"><button class="sk-btn" id="skZoomOut">−</button><button class="sk-btn" id="skZoomIn">+</button></div>
      <div class="sk-tip hidden" id="skTip"></div>`
    $('#skDirections').onclick = (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>('[data-direction]')
      const direction = game().skills.directions.find((d) => d.id === button?.dataset.direction)?.id
      if (direction && direction !== this.direction) {
        this.direction = direction
        this.tree = layoutTree(game().skills.all, direction, this.profession)
        this.sig = ''
        if (this.frame) this.render(this.frame)
        this.center()
        this.hideTip()
        $<HTMLButtonElement>(`[data-direction="${direction}"]`).focus()
      }
    }
    const view = $('#skView')
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y, moved: false }
    })
    view.addEventListener('pointermove', (e) => {
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) < 5) return
      if (!d.moved) (d.moved = true), view.setPointerCapture(e.pointerId), view.classList.add('dragging'), this.hideTip()
      this.pan = { x: d.px + dx, y: d.py + dy }
      this.apply()
    })
    const end = (e: PointerEvent) => {
      if (this.drag?.id !== e.pointerId) return
      this.suppressClick = this.drag.moved
      this.drag = undefined
      view.classList.remove('dragging')
    }
    view.addEventListener('pointerup', end)
    view.addEventListener('pointercancel', end)
    view.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = view.getBoundingClientRect()
        const cx = e.clientX - r.left
        const cy = e.clientY - r.top
        const z = Math.min(ZOOM[1], Math.max(ZOOM[0], this.zoom * Math.exp(-e.deltaY * 0.0015)))
        // zoom about the cursor: the point under it stays under it
        this.pan = { x: cx - ((cx - this.pan.x) * z) / this.zoom, y: cy - ((cy - this.pan.y) * z) / this.zoom }
        this.zoom = z
        this.apply()
        this.hideTip()
      },
      { passive: false },
    )
    $('#skCenter').onclick = () => this.center()
    $('#skBranches').onclick = (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('[data-focus]')
      if (!b) return
      if (b.dataset.focus) this.focus(b.dataset.focus)
      else this.center()
    }
    $('#skZoomIn').onclick = () => this.zoomBy(1.35)
    $('#skZoomOut').onclick = () => this.zoomBy(1 / 1.35)
    $('#skClose').onclick = () => this.close()
    canvasWindow(host, view, t('skills'), () => this.close(), (dx, dy) => { this.pan.x += dx; this.pan.y += dy; this.apply(); this.hideTip() })
  }

  /** Back to the start, zoomed so the whole tree fits — but never so small a skill cannot be read (then the top shows, the rest a drag away). */
  center(): void {
    const r = $('#skView').getBoundingClientRect()
    const panels = [...this.tree.panels.values()]
    const minX = Math.min(...panels.map((p) => p.x)) - 24
    const maxX = Math.max(...panels.map((p) => p.x + p.w)) + 24
    const minY = Math.min(-70, ...panels.map((p) => p.y)) - 24
    const maxY = Math.max(...panels.map((p) => p.y + p.h)) + 24
    // the whole tree below the branch tabs, if it can be read so; else the start in the middle at a size its skills
    // can be read at, the branches a drag away
    const top = this.top(r)
    const fit = Math.min(1, (r.width - 32) / (maxX - minX), (r.height - top - 16) / (maxY - minY))
    if (fit >= READABLE) {
      this.zoom = fit
      this.pan = { x: r.width / 2 - ((minX + maxX) / 2) * this.zoom, y: top - minY * this.zoom }
    } else {
      this.zoom = READABLE
      this.pan = { x: r.width / 2, y: top + (r.height - top) / 2 }
    }
    this.focused = undefined
    this.markTabs()
    this.apply()
  }

  /** Where the view is free of the bars over it (the branch tabs), from its top. */
  private top(r: DOMRect): number {
    const tabs = $('#skBranches').getBoundingClientRect()
    return Math.max(12, tabs.bottom - r.top + 16)
  }

  /** The branch tabs under the directions: the whole tree, or one branch closed in on. */
  private markTabs(): void {
    document.querySelectorAll<HTMLButtonElement>('#skBranches [data-focus]').forEach((b) => b.classList.toggle('selected', (b.dataset.focus || undefined) === this.focused))
  }

  /** Close in on one branch: its panel fills the view (a click on its hub). */
  focus(branch: string): void {
    const p = this.tree.panels.get(branch)
    if (!p) return
    const r = $('#skView').getBoundingClientRect()
    const top = this.top(r)
    this.zoom = Math.max(ZOOM[0], Math.min(1, (r.width - 48) / p.w, (r.height - top - 16) / p.h))
    this.pan = { x: r.width / 2 - (p.x + p.w / 2) * this.zoom, y: top - p.y * this.zoom }
    this.focused = branch
    this.markTabs()
    this.apply()
    this.hideTip()
  }

  /** Opened: draw it afresh, centred. */
  open(f?: Frame): void {
    this.sig = ''
    if (f) this.render(f)
    this.center()
  }

  private apply(): void {
    $('#skWorld').style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`
    // the stars behind slide slower than the tree (a little depth)
    $('#skView').style.backgroundPosition = `${Math.round(this.pan.x * 0.25)}px ${Math.round(this.pan.y * 0.25)}px`
    $<HTMLButtonElement>('#skZoomIn').disabled = this.zoom >= ZOOM[1]
    $<HTMLButtonElement>('#skZoomOut').disabled = this.zoom <= ZOOM[0]
  }

  /** Explicit controls keep the dense tree zoomable on touch screens without a wheel. */
  private zoomBy(factor: number): void {
    const r = $('#skView').getBoundingClientRect()
    const z = Math.min(ZOOM[1], Math.max(ZOOM[0], this.zoom * factor))
    this.pan = { x: r.width / 2 - ((r.width / 2 - this.pan.x) * z) / this.zoom, y: r.height / 2 - ((r.height / 2 - this.pan.y) * z) / this.zoom }
    this.zoom = z
    this.apply()
    this.hideTip()
  }

  render(f: Frame): void {
    this.frame = f
    const points = Number(f.player.props.skillPoints ?? 0)
    const level = Math.max(1, Number(f.player.props.level ?? 1))
    const have = new Set(f.player.skills)
    const profession = typeof f.player.props.profession === 'string' ? f.player.props.profession : ''
    const sig = `${locale.value}|${this.direction}|${profession}|${points}|${level}|${[...have].join()}`
    if (sig === this.sig) return
    this.sig = sig
    if (profession !== this.profession) {
      this.profession = profession
      this.tree = layoutTree(game().skills.all, this.direction, profession)
      this.hideTip()
    }
    const branchDefs = game().skills.branchesFor(profession)
    $('.sk-bar .sk-title').textContent = t('skills')
    $('#skPoints').innerHTML = `${t('skillPoints')}: <b>${points}</b>`
    $('#skPoints').classList.toggle('has', points > 0)
    $('#skHint').textContent = t('skillHint')
    $('#skCenter').textContent = `◎ ${t('skillCenter')}`
    $('#skZoomIn').setAttribute('aria-label', t('skillZoomIn'))
    $('#skZoomOut').setAttribute('aria-label', t('skillZoomOut'))
    $('#skDirections').setAttribute('aria-label', t('skillDirections'))
    // the branch tabs: the whole direction, then each branch (the profession's under its own name)
    const zh = locale.value === 'zh'
    $('#skBranches').innerHTML = `<button class="sk-tab" data-focus="">${zh ? '全部' : 'All'}</button>` + branchDefs.filter((b) => b.direction === this.direction).map((b) => `<button class="sk-tab ${b.id}" data-focus="${b.id}"><span class="sk-tab-icon">${skillArt(b.icon)}</span>${esc(tx(b.name))}</button>`).join('')
    bindSkillArt($('#skBranches'))
    this.markTabs()
    $('#skDirections').innerHTML = game().skills.directions.map((d) => {
      const branches = branchDefs.filter((b) => b.direction === d.id)
      const selected = this.direction === d.id
      return `<button class="sk-direction ${d.id}${selected ? ' selected' : ''}" data-direction="${d.id}" aria-pressed="${selected}"><span class="sk-direction-icon">${skillArt(d.icon)}</span><span><b>${esc(tx(d.name))}</b><small>${branches.map((b) => esc(tx(b.name))).join(' · ')}</small></span></button>`
    }).join('')

    const visible = game().skills.all.filter((s) => this.layout.has(s.id))
    const at = (id: string) => this.layout.get(id)!
    const state = (s: SkillDef) =>
      have.has(s.id) ? 'learned' : (s.requires ?? []).some((r) => !have.has(r)) ? 'locked' : points >= (s.cost ?? 1) ? 'ready' : 'waiting'
    // the links: square elbows — out from the one before, across half a row short of the skill, out into it
    const elbow = (a: { x: number; y: number }, b: { x: number; y: number }, way: Way) => {
      if (way === 'up' || way === 'down') {
        const mid = b.y - (way === 'down' ? 1 : -1) * (ROW / 2)
        return a.x === b.x ? `M${a.x} ${a.y} V${b.y}` : `M${a.x} ${a.y} V${mid} H${b.x} V${b.y}`
      }
      const mid = b.x - (way === 'right' ? 1 : -1) * (ROW / 2)
      return a.y === b.y ? `M${a.x} ${a.y} H${b.x}` : `M${a.x} ${a.y} H${mid} V${b.y} H${b.x}`
    }
    const links = visible.flatMap((s) => (s.requires?.length ? s.requires.filter((r) => this.layout.has(r)).map(at) : [this.branches.get(s.branch)!]).map((a) => {
      const st = state(s)
      return `<path class="sk-line ${st === 'learned' ? 'learned' : st === 'ready' ? 'ready' : 'locked'} ${s.branch}" d="${elbow(a, at(s.id), this.tree.ways.get(s.branch)!)}"/>`
    })).join('')
    const nodes = visible.map((s) => {
      const p = at(s.id)
      return `<button class="sk-node ${state(s)} ${s.branch}${s.ability ? ' ability' : ''}${(s.cost ?? 1) > 1 ? ' capstone' : ''}" data-skill="${s.id}" style="left:${p.x}px;top:${p.y}px" aria-label="${esc(tx(s.name))}">${skillArt(s.icon)}${(s.cost ?? 1) > 1 ? `<span class="sk-cost">${s.cost}</span>` : ''}</button>`
    }).join('')
    const hubs = branchDefs.filter((b) => b.direction === this.direction).map((b) => {
      const p = this.branches.get(b.id)!
      const own = visible.filter((s) => s.branch === b.id)
      const pending = own.length === 0
      return `<button class="sk-node hub ${b.id}${pending ? ' pending' : ''}" data-branch="${b.id}" data-way="${this.tree.ways.get(b.id)}" style="left:${p.x}px;top:${p.y}px" aria-label="${esc(tx(b.name))}">${skillArt(b.icon)}<span class="sk-node-name">${esc(tx(b.name))}${pending ? `<small>${t('skillPending')}</small>` : ''}</span></button>`
    }).join('')
    // the trunk: out from the start to each hub, its way
    const trunks = branchDefs.filter((b) => b.direction === this.direction).map((b) => `<path class="sk-line trunk ${b.id}" d="${elbow({ x: 0, y: 0 }, this.branches.get(b.id)!, this.tree.ways.get(b.id)!)}"/>`).join('')
    // each branch's panel, behind its hub and skills
    const panels = branchDefs.filter((b) => b.direction === this.direction).map((b) => {
      const p = this.tree.panels.get(b.id)!
      return `<div class="sk-panel ${b.id}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px"></div>`
    }).join('')
    const direction = game().skills.directions.find((d) => d.id === this.direction)!
    const origin = `<button class="sk-node origin" data-origin="1" style="left:0;top:0" aria-label="${esc(tx(direction.name))}">${skillArt('origin')}<span class="sk-lv">${level}</span><span class="sk-node-name">${esc(tx(direction.name))}</span></button>`
    $('#skWorld').innerHTML = `${panels}<svg class="sk-links" aria-hidden="true">${trunks}${links}</svg>${origin}${hubs}${nodes}`

    const world = $('#skWorld')
    bindSkillArt(world)
    bindSkillArt($('#skDirections'))
    world.querySelectorAll<HTMLButtonElement>('.sk-node').forEach((b) => {
      b.onpointerenter = () => ((this.hovered = b.dataset.skill), !this.drag?.moved && this.showTip(b))
      b.onpointerleave = () => ((this.hovered = undefined), this.hideTip())
      b.onfocus = () => this.showTip(b)
      b.onblur = () => this.hideTip()
      b.onclick = () => {
        if (this.suppressClick) return void (this.suppressClick = false)
        if (b.dataset.skill && b.classList.contains('ready')) this.learn(b.dataset.skill)
        // a hub: close in on its branch
        if (b.dataset.branch) this.focus(b.dataset.branch)
      }
    })
  }

  // ---------------------------------------------------------------- the hover card

  private tipHtml(b: HTMLElement): string {
    const f = this.frame!
    const points = Number(f.player.props.skillPoints ?? 0)
    if (b.dataset.origin) {
      const level = Math.max(1, Number(f.player.props.level ?? 1))
      return `<b>${t('level')} ${level}</b><span class="sk-doc">${t('skillOrigin')}</span><span class="sk-foot">${t('skillPoints')}: ${points}</span>`
    }
    if (b.dataset.branch) {
      const branch = game().skills.branchesFor(this.profession).find((s) => s.id === b.dataset.branch)!
      const direction = game().skills.directions.find((d) => d.id === branch.direction)!
      const own = game().skills.forProfession(this.profession).filter((s) => s.branch === branch.id)
      // no profession yet: where to get one
      if (branch.id === 'profession' && !own.length) return `<span class="sk-path">${esc(tx(direction.name))} / ${t('skillProfession')}</span><b>${esc(tx(branch.name))}</b><span class="sk-doc">${t('skillNoProfession')}</span>`
      return `<span class="sk-path">${esc(tx(direction.name))} / ${t(branch.id === 'profession' ? 'skillProfession' : 'skillBranch')}</span><b>${esc(tx(branch.name))}</b><span class="sk-doc">${own.length ? own.map((s) => esc(tx(s.name))).join(' · ') : t('skillPending')}</span>${own.length ? `<span class="sk-foot">${own.filter((s) => f.player.skills.includes(s.id)).length} / ${own.length} ${t('learnedSkill')}</span>` : ''}`
    }
    const s = skillById()[b.dataset.skill!]
    const have = new Set(f.player.skills)
    const missing = (s.requires ?? []).filter((r) => !have.has(r))
    const cost = s.cost ?? 1
    const foot = have.has(s.id)
      ? `✓ ${t('learnedSkill')}`
      : missing.length
        ? t('needsSkill').replace('{s}', missing.map((r) => tx(skillById()[r].name)).join(', '))
        : points >= cost
          ? `${t('learn')} · ${cost} ${t('skillPoints')}`
          : t('noPoints')
    const branch = game().skills.branchesFor(this.profession).find((b) => b.id === s.branch)!
    const direction = game().skills.directions.find((d) => d.id === branch.direction)!
    return `<span class="sk-path">${esc(tx(direction.name))} / ${s.profession ? `${t('skillProfession')} · ` : ''}${esc(tx(branch.name))}</span><b>${esc(tx(s.name))}</b>${s.active ? `<span class="sk-tag">${locale.value === 'zh' ? '主动技能' : 'Active'}</span>` : s.ability ? `<span class="sk-tag">${t('ability')}</span>` : ''}<span class="sk-doc">${esc(tx(s.doc))}</span><span class="sk-foot">${esc(foot)}</span>${s.active && have.has(s.id) ? `<span class="sk-foot">${skillbarHint(locale.value === 'zh')}</span>` : ''}`
  }

  private showTip(b: HTMLElement): void {
    if (!this.frame) return
    const tip = $('#skTip')
    tip.className = `sk-tip ${[...b.classList].filter((c) => game().skills.branches.some((x) => x.id === c) || c === 'ready').join(' ')}`
    tip.innerHTML = this.tipHtml(b)
    placeFloating(tip, b.getBoundingClientRect())
  }

  private hideTip(): void {
    $('#skTip').classList.add('hidden')
  }
}
