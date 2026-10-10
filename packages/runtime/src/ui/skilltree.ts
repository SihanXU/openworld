// The skill tree page (K, or its button bottom right): a field the player drags and zooms, the
// start in the middle and every branch growing outward from it. The layout is radial by the
// tree's own shape — each branch a sector, a node's children sharing its slice by how many
// leaves they carry — so the tree can grow without the page changing. What a node does shows
// on hover; a click learns it when it is ready.

import type { Frame, SkillDef } from '@openworld/engine'
import { SKILLS, SKILL_DIRECTIONS, SKILL_BRANCHES, SKILL_BY_ID, branchesForProfession, skillsForProfession, type SkillDirection } from '@openworld-game/content'
import { $, esc, locale, t, tx } from './common.ts'
import { bindSkillArt, skillArt } from './skillIcons.ts'
import { layoutBranches, layoutSkills } from './skillLayout.ts'
import { skillbarHint } from './skillbar.ts'

export { layoutSkills } from './skillLayout.ts'

const ZOOM: [number, number] = [0.2, 2]

export class SkillTree {
  private pan = { x: 0, y: 0 }
  private zoom = 1
  private sig = ''
  private frame?: Frame
  private drag?: { id: number; x: number; y: number; px: number; py: number; moved: boolean }
  private suppressClick = false
  /** The skill node under the pointer (the skill bar's Shift+1–6 sets it). */
  hovered?: string
  private direction: SkillDirection = 'combat'
  private profession = ''
  private layout = layoutSkills()
  private branches = layoutBranches('combat')

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
      <div class="sk-zoom"><button class="sk-btn" id="skZoomOut">−</button><button class="sk-btn" id="skZoomIn">+</button></div>
      <div class="sk-tip hidden" id="skTip"></div>`
    $('#skDirections').onclick = (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>('[data-direction]')
      const direction = SKILL_DIRECTIONS.find((d) => d.id === button?.dataset.direction)?.id
      if (direction && direction !== this.direction) {
        this.direction = direction
        this.layout = layoutSkills(SKILLS, direction, this.profession)
        this.branches = layoutBranches(direction)
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
    $('#skZoomIn').onclick = () => this.zoomBy(1.35)
    $('#skZoomOut').onclick = () => this.zoomBy(1 / 1.35)
    $('#skClose').onclick = () => this.close()
  }

  /** Back to the middle, zoomed so the whole tree fits (never past 1). */
  center(): void {
    const r = $('#skView').getBoundingClientRect()
    const positions = [{ x: 0, y: 0 }, ...this.branches.values(), ...this.layout.values()]
    const minX = Math.min(...positions.map((p) => p.x)) - 110
    const maxX = Math.max(...positions.map((p) => p.x)) + 110
    const minY = Math.min(...positions.map((p) => p.y)) - 70
    const maxY = Math.max(...positions.map((p) => p.y)) + 110
    this.zoom = Math.max(ZOOM[0], Math.min(1, (r.width - 32) / (maxX - minX), (r.height - 32) / (maxY - minY)))
    this.pan = { x: r.width / 2 - ((minX + maxX) / 2) * this.zoom, y: r.height / 2 - ((minY + maxY) / 2) * this.zoom }
    this.apply()
  }

  /** Opened: draw it afresh, centred. */
  open(f?: Frame): void {
    this.sig = ''
    if (f) this.render(f)
    this.center()
  }

  private apply(): void {
    $('#skWorld').style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`
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
      this.layout = layoutSkills(SKILLS, this.direction, profession)
      this.hideTip()
    }
    const branchDefs = branchesForProfession(profession)
    $('.sk-bar .sk-title').textContent = t('skills')
    $('#skPoints').innerHTML = `${t('skillPoints')}: <b>${points}</b>`
    $('#skPoints').classList.toggle('has', points > 0)
    $('#skHint').textContent = t('skillHint')
    $('#skCenter').textContent = `◎ ${t('skillCenter')}`
    $('#skZoomIn').setAttribute('aria-label', t('skillZoomIn'))
    $('#skZoomOut').setAttribute('aria-label', t('skillZoomOut'))
    $('#skDirections').setAttribute('aria-label', t('skillDirections'))
    $('#skDirections').innerHTML = SKILL_DIRECTIONS.map((d) => {
      const branches = branchDefs.filter((b) => b.direction === d.id)
      const selected = this.direction === d.id
      return `<button class="sk-direction ${d.id}${selected ? ' selected' : ''}" data-direction="${d.id}" aria-pressed="${selected}"><span class="sk-direction-icon">${skillArt(d.icon)}</span><span><b>${esc(tx(d.name))}</b><small>${branches.map((b) => esc(tx(b.name))).join(' · ')}</small></span></button>`
    }).join('')

    const visible = SKILLS.filter((s) => this.layout.has(s.id))
    const at = (id: string) => this.layout.get(id)!
    const state = (s: SkillDef) =>
      have.has(s.id) ? 'learned' : (s.requires ?? []).some((r) => !have.has(r)) ? 'locked' : points >= (s.cost ?? 1) ? 'ready' : 'waiting'
    // the links: a soft curve from the parent out to the child
    const links = visible.flatMap((s) => (s.requires?.length ? s.requires.map(at) : [this.branches.get(s.branch)!]).map((a) => {
      const b = at(s.id)
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08
      const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.08
      const st = state(s)
      return `<path class="sk-line ${st === 'learned' ? 'learned' : st === 'ready' ? 'ready' : 'locked'} ${s.branch}" d="M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}"/>`
    })).join('')
    const nodes = visible.map((s) => {
      const p = at(s.id)
      return `<button class="sk-node ${state(s)} ${s.branch}${s.ability ? ' ability' : ''}${(s.cost ?? 1) > 1 ? ' capstone' : ''}" data-skill="${s.id}" style="left:${p.x}px;top:${p.y}px" aria-label="${esc(tx(s.name))}">${skillArt(s.icon)}${(s.cost ?? 1) > 1 ? `<span class="sk-cost">${s.cost}</span>` : ''}</button>`
    }).join('')
    const hubs = branchDefs.filter((b) => b.direction === this.direction).map((b) => {
      const p = this.branches.get(b.id)!
      const own = visible.filter((s) => s.branch === b.id)
      const pending = own.length === 0
      return `<button class="sk-node hub ${b.id}${pending ? ' pending' : ''}" data-branch="${b.id}" style="left:${p.x}px;top:${p.y}px" aria-label="${esc(tx(b.name))}">${skillArt(b.icon)}<span class="sk-node-name">${esc(tx(b.name))}${pending ? `<small>${t('skillPending')}</small>` : ''}</span></button>`
    }).join('')
    const trunks = branchDefs.filter((b) => b.direction === this.direction).map((b) => {
      const p = this.branches.get(b.id)!
      return `<path class="sk-line trunk ${b.id}" d="M0 0 L${p.x} ${p.y}"/>`
    }).join('')
    const direction = SKILL_DIRECTIONS.find((d) => d.id === this.direction)!
    const origin = `<button class="sk-node origin" data-origin="1" style="left:0;top:0" aria-label="${esc(tx(direction.name))}">${skillArt('origin')}<span class="sk-lv">${level}</span><span class="sk-node-name">${esc(tx(direction.name))}</span></button>`
    $('#skWorld').innerHTML = `<svg class="sk-links" aria-hidden="true">${trunks}${links}</svg>${origin}${hubs}${nodes}`

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
      const branch = branchesForProfession(this.profession).find((s) => s.id === b.dataset.branch)!
      const direction = SKILL_DIRECTIONS.find((d) => d.id === branch.direction)!
      const own = skillsForProfession(this.profession).filter((s) => s.branch === branch.id)
      // no profession yet: where to get one
      if (branch.id === 'profession' && !own.length) return `<span class="sk-path">${esc(tx(direction.name))} / ${t('skillProfession')}</span><b>${esc(tx(branch.name))}</b><span class="sk-doc">${t('skillNoProfession')}</span>`
      return `<span class="sk-path">${esc(tx(direction.name))} / ${t(branch.id === 'profession' ? 'skillProfession' : 'skillBranch')}</span><b>${esc(tx(branch.name))}</b><span class="sk-doc">${own.length ? own.map((s) => esc(tx(s.name))).join(' · ') : t('skillPending')}</span>${own.length ? `<span class="sk-foot">${own.filter((s) => f.player.skills.includes(s.id)).length} / ${own.length} ${t('learnedSkill')}</span>` : ''}`
    }
    const s = SKILL_BY_ID[b.dataset.skill!]
    const have = new Set(f.player.skills)
    const missing = (s.requires ?? []).filter((r) => !have.has(r))
    const cost = s.cost ?? 1
    const foot = have.has(s.id)
      ? `✓ ${t('learnedSkill')}`
      : missing.length
        ? t('needsSkill').replace('{s}', missing.map((r) => tx(SKILL_BY_ID[r].name)).join(', '))
        : points >= cost
          ? `${t('learn')} · ${cost} ${t('skillPoints')}`
          : t('noPoints')
    const branch = branchesForProfession(this.profession).find((b) => b.id === s.branch)!
    const direction = SKILL_DIRECTIONS.find((d) => d.id === branch.direction)!
    return `<span class="sk-path">${esc(tx(direction.name))} / ${s.profession ? `${t('skillProfession')} · ` : ''}${esc(tx(branch.name))}</span><b>${esc(tx(s.name))}</b>${s.active ? `<span class="sk-tag">${locale.value === 'zh' ? '主动技能' : 'Active'}</span>` : s.ability ? `<span class="sk-tag">${t('ability')}</span>` : ''}<span class="sk-doc">${esc(tx(s.doc))}</span><span class="sk-foot">${esc(foot)}</span>${s.active && have.has(s.id) ? `<span class="sk-foot">${skillbarHint(locale.value === 'zh')}</span>` : ''}`
  }

  private showTip(b: HTMLElement): void {
    if (!this.frame) return
    const tip = $('#skTip')
    tip.className = `sk-tip ${[...b.classList].filter((c) => SKILL_BRANCHES.some((x) => x.id === c) || c === 'ready').join(' ')}`
    tip.innerHTML = this.tipHtml(b)
    const r = b.getBoundingClientRect()
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    // beside the node, on the side with room; kept on screen
    let x = r.right + 12
    if (x + w > innerWidth - 8) x = r.left - 12 - w
    const y = Math.min(innerHeight - h - 8, Math.max(8, r.top + r.height / 2 - h / 2))
    tip.style.left = `${Math.max(8, x)}px`
    tip.style.top = `${y}px`
  }

  private hideTip(): void {
    $('#skTip').classList.add('hidden')
  }
}
