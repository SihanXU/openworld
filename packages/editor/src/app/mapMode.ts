// The map (docs/engine-split.md §6, RPG Maker's map and tiles): paint terrain and heights, set things down and
// take them away, lay portals, name anchors and areas, say where the game begins; select a cell to see and
// change what is there. Every stroke is the format's data: a map file's rows, heights, portals, anchors,
// regions and entities with ids of their own.

import type { Entity, Portal, RawChunk } from '@openworld/engine'
import { paintOrganic, paintPath, scatter, yard } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import { esc, parseValue, textOf, toast, tx, enOf, zhOf } from './ui.ts'

type Tool = 'select' | 'terrain' | 'height' | 'thing' | 'erase' | 'portal' | 'anchor' | 'region' | 'start' | 'path' | 'organic' | 'scatter' | 'yard'
const TOOLS: [Tool, string, string][] = [
  ['select', 'Select', 'see and change what is in a cell'],
  ['terrain', 'Terrain', 'paint the ground (drag)'],
  ['height', 'Height', 'paint the ground\'s height in half levels (drag)'],
  ['thing', 'Thing', 'set a thing down'],
  ['erase', 'Erase', 'take the things in a cell away'],
  ['portal', 'Portal', 'a way to another map'],
  ['anchor', 'Anchor', 'a named spot (people\'s days, scenes)'],
  ['region', 'Area', 'a named area (drag a rectangle)'],
  ['start', 'Start', 'where a new game begins'],
  // the builder's brushes (format/src/brushes.ts): each stroke from a seed of its own, kept in the map
  ['path', 'Path', 'a curved path through the points you click'],
  ['organic', 'Patch', 'an organic patch of ground (drag its box): a pond, a clearing'],
  ['scatter', 'Scatter', 'small things by a mask (drag a box): on the ground you name'],
  ['yard', 'Yard', 'a fenced yard of the thing chosen (drag its box), a gate at its foot'],
]
const TERRAIN_TOOLS = new Set<Tool>(['terrain', 'path', 'organic'])
const THING_TOOLS = new Set<Tool>(['thing', 'scatter', 'yard'])
/** What can be set down: the kinds of things the inputs and the world handle. */
const PLACEABLE = /^(fixture|item|actor\/creature|structure)\//

export class MapMode implements Mode {
  id = 'map'
  label = 'Map'
  private tool: Tool = 'select'
  private char = '.'
  private height = 0
  private thing = ''
  private filter = ''
  private stroke = 0
  private drag?: { x: number; y: number; to: { x: number; y: number } }
  /** The path brush's points, and the brushes' settings. */
  private points: [number, number][] = []
  private width = 2
  private edge = ''
  private rough = 0.22
  private only = ''
  private density = 0.15

  private file(ctx: Ctx): string | undefined {
    return ctx.store.mapFile(ctx.map)
  }
  private chunk(ctx: Ctx): RawChunk | undefined {
    const f = this.file(ctx)
    return f ? ctx.store.get<RawChunk>(f) : undefined
  }
  private edit(ctx: Ctx, why: string, fn: (c: RawChunk) => void, stroke?: number): void {
    const f = this.file(ctx)
    if (f) ctx.store.change<RawChunk>(f, why, fn, stroke)
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const onto = ctx.onto()
    const chars = Object.entries(ctx.store.game.terrainChars)
    if (!chars.some(([c]) => c === this.char)) this.char = chars[0]?.[0] ?? '.'
    const things = Object.keys(onto.types).filter((t) => PLACEABLE.test(t) && (!this.filter || t.includes(this.filter))).sort()
    left.innerHTML = `
      <div class="tools">${TOOLS.map(([t, name, tip]) => `<button data-tool="${t}" class="${t === this.tool ? 'on' : ''}" title="${esc(tip)}">${name}</button>`).join('')}</div>
      ${this.brushOptions(chars)}
      ${TERRAIN_TOOLS.has(this.tool) ? `<h3>Terrain</h3><div class="palette">${chars.map(([c, id]) => `<button data-char="${esc(c)}" class="${c === this.char ? 'on' : ''}" title="${esc(id)} (${esc(c)})"><span class="sw" style="background:${esc(onto.terrains[id]?.color ?? '#555')}"></span>${esc(tx(onto.terrains[id]?.name) || id)}</button>`).join('')}</div>` : ''}
      ${this.tool === 'height' ? `<h3>Height</h3><div class="palette row">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => `<button data-height="${h}" class="${h === this.height ? 'on' : ''}">${h}</button>`).join('')}</div><p class="muted">Half levels: 2 is a level. One walks at most half a level up or down.</p>` : ''}
      ${THING_TOOLS.has(this.tool) ? `<h3>Thing</h3><input id="thingFilter" placeholder="filter types" value="${esc(this.filter)}"><div class="palette list">${things.map((t) => `<button data-thing="${esc(t)}" class="${t === this.thing ? 'on' : ''}">${esc(t)}<small>${esc(tx(onto.types[t]?.name))}</small></button>`).join('')}</div>` : ''}
      <h3>Maps</h3>
      <div class="palette list">${ctx.store.maps().map((m) => `<button data-map="${esc(m.data.map.id)}" class="${m.data.map.id === ctx.map ? 'on' : ''}">${esc(m.data.map.id)}<small>${esc(tx(m.data.map.name))} · ${m.data.map.width}×${m.data.map.height}</small></button>`).join('')}</div>
      <details><summary>New map</summary>
        <label>id <input id="nmId" placeholder="meadow"></label>
        <label>name <input id="nmEn" placeholder="The Meadow"> <input id="nmZh" placeholder="草地"></label>
        <label>size <input id="nmW" type="number" value="24" min="4" max="200"> × <input id="nmH" type="number" value="16" min="4" max="200"></label>
        <label>ground <select id="nmFill">${chars.map(([c, id]) => `<option value="${esc(c)}">${esc(id)}</option>`).join('')}</select></label>
        <button id="nmMake">Make the map</button>
      </details>`
    left.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => (b.onclick = () => ((this.tool = b.dataset.tool as Tool), ctx.refresh())))
    left.querySelectorAll<HTMLButtonElement>('[data-char]').forEach((b) => (b.onclick = () => ((this.char = b.dataset.char!), ctx.refresh())))
    left.querySelectorAll<HTMLButtonElement>('[data-height]').forEach((b) => (b.onclick = () => ((this.height = Number(b.dataset.height)), ctx.refresh())))
    left.querySelectorAll<HTMLButtonElement>('[data-thing]').forEach((b) => (b.onclick = () => ((this.thing = b.dataset.thing!), ctx.refresh())))
    left.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) => (b.onclick = () => ctx.showMap(b.dataset.map!)))
    const filter = left.querySelector<HTMLInputElement>('#thingFilter')
    if (filter) filter.oninput = () => { this.filter = filter.value; const at = filter.selectionStart; ctx.refresh(); const f = document.querySelector<HTMLInputElement>('#thingFilter'); f?.focus(); f?.setSelectionRange(at, at) }
    left.querySelector<HTMLButtonElement>('#nmMake')!.onclick = () => this.newMap(ctx, left)
    this.wireBrush(ctx, left)
    this.inspector(ctx, right)
  }

  private brushOptions(chars: [string, string][]): string {
    const opt = (cur: string, none: string) => `<option value="">${none}</option>${chars.map(([c, id]) => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(id)}</option>`).join('')}`
    if (this.tool === 'path') return `<h3>Path</h3><p class="muted">Click its points on the map, then lay it.</p><label>width <input id="bWidth" type="number" min="1" max="6" value="${this.width}"></label><label>frayed with <select id="bEdge">${opt(this.edge, 'nothing')}</select></label><p>${this.points.length} point${this.points.length === 1 ? '' : 's'}</p><button id="bLay" ${this.points.length ? '' : 'disabled'}>Lay the path</button> <button id="bClear">Clear the points</button>`
    if (this.tool === 'organic') return `<h3>Patch</h3><label>rough <input id="bRough" type="number" step="0.05" min="0" max="0.6" value="${this.rough}"></label><label>only over <select id="bOnly">${opt(this.only, 'anything')}</select></label>`
    if (this.tool === 'scatter') return `<h3>Scatter</h3><label>chance a cell <input id="bDensity" type="number" step="0.05" min="0.01" max="1" value="${this.density}"></label><label>only on <select id="bOnly">${opt(this.only, 'any ground')}</select></label>`
    if (this.tool === 'yard') return '<h3>Yard</h3><p class="muted">Choose its fence (a fixture), then drag the yard\'s box.</p>'
    return ''
  }

  private wireBrush(ctx: Ctx, left: HTMLElement): void {
    const num = (id: string, f: (v: number) => void) => { const el = left.querySelector<HTMLInputElement>(id); if (el) el.onchange = () => f(Number(el.value)) }
    num('#bWidth', (v) => (this.width = Math.max(1, Math.min(6, v || 2))))
    num('#bRough', (v) => (this.rough = Math.max(0, Math.min(0.6, v))))
    num('#bDensity', (v) => (this.density = Math.max(0.01, Math.min(1, v || 0.15))))
    const sel = (id: string, f: (v: string) => void) => { const el = left.querySelector<HTMLSelectElement>(id); if (el) el.onchange = () => f(el.value) }
    sel('#bEdge', (v) => (this.edge = v))
    sel('#bOnly', (v) => (this.only = v))
    left.querySelector<HTMLButtonElement>('#bClear')?.addEventListener('click', () => ((this.points = []), ctx.refresh()))
    left.querySelector<HTMLButtonElement>('#bLay')?.addEventListener('click', () => {
      const seed = newSeed()
      this.edit(ctx, `a path (seed ${seed})`, (ch) => paintPath(ch, this.points, this.char, seed, { width: this.width, ...(this.edge && { edge: this.edge }) }))
      this.points = []
      ctx.refresh()
    })
  }

  /** The project's ids, so a brush's new things never take one. */
  private taken(ctx: Ctx): Set<string> {
    return new Set([...ctx.store.maps().flatMap((m) => m.data.entities.map((e) => e.id)), ...ctx.store.list<Entity>('people').map((p) => p.data.id)])
  }

  private newMap(ctx: Ctx, left: HTMLElement): void {
    const v = (id: string) => left.querySelector<HTMLInputElement>(id)!.value
    const id = v('#nmId').trim()
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) return toast('A map\'s id: lower case letters, digits, - and _.', 'warn')
    if (ctx.store.mapFile(id)) return toast(`There is a map ${id} already.`, 'warn')
    const w = Math.max(4, Math.min(200, Number(v('#nmW')) || 24))
    const h = Math.max(4, Math.min(200, Number(v('#nmH')) || 16))
    const fill = left.querySelector<HTMLSelectElement>('#nmFill')!.value
    const chunk: RawChunk = { map: { id, name: textOf(v('#nmEn') || id, v('#nmZh')), kind: 'wild', width: w, height: h, rows: Array.from({ length: h }, () => fill.repeat(w)), portals: [], anchors: {}, regions: {}, light: 'outdoor', zone: 'peaceful' }, entities: [] }
    ctx.store.add(`maps/${id}.json`, chunk, `a new map ${id}`)
    ctx.showMap(id)
  }

  // ---------------------------------------------------------------- the tool on a cell

  cell(ctx: Ctx, c: { x: number; y: number }, ev: 'down' | 'drag' | 'up' | 'hover'): void {
    if (ev === 'hover') return
    if (ev === 'down') this.stroke++
    const s = this.stroke
    switch (this.tool) {
      case 'select':
        if (ev === 'down') (ctx.sel = { cell: c }), ctx.refresh()
        return
      case 'terrain':
        return this.edit(ctx, `paint ${this.char}`, (ch) => { const r = ch.map.rows[c.y]; ch.map.rows[c.y] = r.slice(0, c.x) + this.char + r.slice(c.x + 1) }, s)
      case 'height':
        return this.edit(ctx, `height ${this.height}`, (ch) => {
          ch.map.heights ??= ch.map.rows.map((r) => '0'.repeat(r.length))
          const r = ch.map.heights[c.y]
          ch.map.heights[c.y] = r.slice(0, c.x) + String(this.height) + r.slice(c.x + 1)
        }, s)
      case 'thing':
        if (ev !== 'down') return
        if (!this.thing) return toast('Choose a kind of thing first.', 'warn')
        return this.edit(ctx, `set down ${this.thing}`, (ch) => {
          const e: Entity = { id: newId(ctx, this.thing), type: this.thing, place: { on: 'tile', map: ch.map.id, x: c.x, y: c.y } }
          if (this.thing.startsWith('actor/creature')) e.ai = { behaviour: 'melee', temper: 'wary', sight: 4, home: { map: ch.map.id, x: c.x, y: c.y }, leash: 6 }
          ch.entities.push(e)
          ctx.sel = { cell: c, entity: e.id }
        })
      case 'erase':
        return this.edit(ctx, 'take away', (ch) => (ch.entities = ch.entities.filter((e) => !(e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y))), s)
      case 'portal': {
        if (ev !== 'down') return
        const ch = this.chunk(ctx)!
        const i = ch.map.portals.findIndex((p) => p.x === c.x && p.y === c.y)
        if (i >= 0) return void ((ctx.sel = { cell: c, portal: i }), ctx.refresh())
        const to = ctx.store.maps().map((m) => m.data.map.id).find((m) => m !== ctx.map) ?? ctx.map
        this.edit(ctx, 'a portal', (x) => x.map.portals.push({ x: c.x, y: c.y, to, tx: 0, ty: 0 }))
        ctx.sel = { cell: c, portal: ch.map.portals.length - 1 }
        return ctx.refresh()
      }
      case 'anchor': {
        if (ev !== 'down') return
        const name = prompt('The anchor\'s name (a person\'s day names it as map:name):')?.trim()
        if (name) this.edit(ctx, `anchor ${name}`, (ch) => ((ch.map.anchors ??= {})[name] = [c.x, c.y]))
        return
      }
      case 'region': {
        if (ev === 'down') this.drag = { x: c.x, y: c.y, to: c }
        else if (this.drag) this.drag.to = c
        ctx.canvas.redraw()
        if (ev !== 'up' || !this.drag) return
        const d = this.drag
        this.drag = undefined
        const name = prompt('The area\'s name:')?.trim()
        if (name) this.edit(ctx, `area ${name}`, (ch) => ((ch.map.regions ??= {})[name] = [Math.min(d.x, d.to.x), Math.min(d.y, d.to.y), Math.abs(d.to.x - d.x) + 1, Math.abs(d.to.y - d.y) + 1]))
        ctx.canvas.redraw()
        return
      }
      case 'start':
        if (ev !== 'down') return
        return ctx.store.change('game.json', 'the start', (g: { start: { map: string; x: number; y: number } }) => (g.start = { map: ctx.map, x: c.x, y: c.y }))
      case 'path':
        if (ev === 'down') (this.points.push([c.x, c.y]), ctx.refresh())
        return
      case 'organic':
      case 'scatter':
      case 'yard': {
        if (ev === 'down') this.drag = { x: c.x, y: c.y, to: c }
        else if (this.drag) this.drag.to = c
        ctx.canvas.redraw()
        if (ev !== 'up' || !this.drag) return
        const d = this.drag
        this.drag = undefined
        const x = Math.min(d.x, d.to.x), y = Math.min(d.y, d.to.y), w = Math.abs(d.to.x - d.x) + 1, h = Math.abs(d.to.y - d.y) + 1
        const seed = newSeed()
        if (this.tool === 'organic') return this.edit(ctx, `a patch (seed ${seed})`, (ch) => paintOrganic(ch, x + w / 2, y + h / 2, w / 2, h / 2, this.char, seed, { rough: this.rough, ...(this.only && { only: [this.only] }) }))
        if (!this.thing) return toast('Choose a kind of thing first.', 'warn')
        const taken = this.taken(ctx)
        if (this.tool === 'scatter') return this.edit(ctx, `scatter ${this.thing} (seed ${seed})`, (ch) => scatter(ch, [x, y, w, h], this.thing, this.density, seed, taken, this.only ? { on: [this.only] } : {}))
        return this.edit(ctx, `a yard of ${this.thing}`, (ch) => yard(ch, [x, y, w, h], this.thing, taken, [[x + Math.floor(w / 2), y + h - 1]]))
      }
    }
  }

  overlay(ctx: Ctx) {
    const ch = this.chunk(ctx)
    const sel = ctx.sel
    const start = ctx.store.game.start
    return (g: Phaser.GameObjects.Graphics, T: number) => {
      // (the box being dragged, as it is now: the canvas draws this again while the pointer moves)
      const drag = this.drag
      if (!ch) return
      for (const [, [x, y, w, h]] of Object.entries(ch.map.regions ?? {})) (g.fillStyle(0x4aa3ff, 0.12), g.fillRect(x * T, y * T, w * T, h * T), g.lineStyle(1, 0x4aa3ff, 0.8), g.strokeRect(x * T, y * T, w * T, h * T))
      for (const [, [x, y]] of Object.entries(ch.map.anchors ?? {})) (g.fillStyle(0x3ff0e0, 0.9), g.fillCircle(x * T + T / 2, y * T + T / 2, 3))
      for (const p of ch.map.portals) (g.lineStyle(2, 0xff4fd8, 0.9), g.strokeRect(p.x * T + 1, p.y * T + 1, T - 2, T - 2))
      if (start.map === ch.map.id) (g.lineStyle(2, 0x6dff6d, 1), g.strokeCircle(start.x * T + T / 2, start.y * T + T / 2, T / 2 - 1))
      for (const [i, [px, py]] of this.points.entries()) (g.fillStyle(0xffd23f, 1), g.fillCircle(px * T + T / 2, py * T + T / 2, 3), i && (g.lineStyle(1, 0xffd23f, 0.8), g.lineBetween(this.points[i - 1][0] * T + T / 2, this.points[i - 1][1] * T + T / 2, px * T + T / 2, py * T + T / 2)))
      if (drag) { const x = Math.min(drag.x, drag.to.x), y = Math.min(drag.y, drag.to.y); g.lineStyle(1, 0xffffff, 1); g.strokeRect(x * T, y * T, (Math.abs(drag.to.x - drag.x) + 1) * T, (Math.abs(drag.to.y - drag.y) + 1) * T) }
      if (sel.cell) (g.lineStyle(2, 0xffd23f, 1), g.strokeRect(sel.cell.x * T, sel.cell.y * T, T, T))
    }
  }

  // ---------------------------------------------------------------- the inspector

  private inspector(ctx: Ctx, right: HTMLElement): void {
    const ch = this.chunk(ctx)
    if (!ch) return void (right.innerHTML = '<p class="muted">No map.</p>')
    const m = ch.map
    const onto = ctx.onto()
    const c = ctx.sel.cell
    const parts: string[] = []
    parts.push(`<h3>${esc(m.id)}</h3>
      <label>name <input data-m="en" value="${esc(enOf(m.name))}"> <input data-m="zh" value="${esc(zhOf(m.name))}"></label>
      <label>kind <input data-m="kind" value="${esc(m.kind)}"></label>
      <label>light <select data-m="light">${['outdoor', 'indoor', 'dark'].map((l) => `<option ${m.light === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>zone <select data-m="zone">${['peaceful', 'combat'].map((l) => `<option ${m.zone === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>music <input data-m="music" value="${esc(m.music ?? '')}"></label>`)
    if (c) {
      const ch2 = m.rows[c.y]?.[c.x]
      const terrain = ctx.store.game.terrainChars[ch2 ?? '']
      const here = ch.entities.filter((e) => e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y)
      const people = ctx.store.list<Entity>('people').filter((p) => p.data.place.on === 'tile' && p.data.place.map === m.id && p.data.place.x === c.x && p.data.place.y === c.y)
      parts.push(`<h3>Cell ${c.x}, ${c.y}</h3>
        <p>${esc(terrain)} <code>${esc(ch2)}</code> · height ${esc(m.heights?.[c.y]?.[c.x] ?? '0')}</p>
        <button id="playHere">Playtest from here</button>
        <ul class="things">${here.map((e) => `<li><a data-entity="${esc(e.id)}" class="${ctx.sel.entity === e.id ? 'on' : ''}">${esc(e.id)}</a> <small>${esc(e.type)}</small></li>`).join('')}${people.map((p) => `<li><a data-person="${esc(p.data.id)}">${esc(p.data.id)}</a> <small>a person</small></li>`).join('')}</ul>`)
      const e = here.find((x) => x.id === ctx.sel.entity)
      if (e) parts.push(this.entityForm(e, onto.types[e.type] ? '' : ' (no such type)'))
    }
    const pi = ctx.sel.portal
    const p = pi !== undefined ? m.portals[pi] : undefined
    if (p) parts.push(`<h3>Portal at ${p.x}, ${p.y}</h3>
      <label>to <select data-p="to">${ctx.store.maps().map((x) => `<option ${x.data.map.id === p.to ? 'selected' : ''}>${esc(x.data.map.id)}</option>`).join('')}</select></label>
      <label>lands at <input data-p="tx" type="number" value="${p.tx}"> <input data-p="ty" type="number" value="${p.ty}"></label>
      <label>label <input data-p="en" value="${esc(enOf(p.label))}"> <input data-p="zh" value="${esc(zhOf(p.label))}"></label>
      <button id="pDel" class="danger">Remove the portal</button>`)
    parts.push(`<h3>Anchors</h3><ul class="things">${Object.entries(m.anchors ?? {}).map(([n, [x, y]]) => `<li>${esc(n)} <small>${x}, ${y}</small> <a data-anchor-del="${esc(n)}" class="x">✕</a></li>`).join('') || '<li class="muted">none</li>'}</ul>`)
    parts.push(`<h3>Areas</h3><ul class="things">${Object.entries(m.regions ?? {}).map(([n, [x, y, w, h]]) => `<li>${esc(n)} <small>${x}, ${y} · ${w}×${h}</small> <a data-region-del="${esc(n)}" class="x">✕</a></li>`).join('') || '<li class="muted">none</li>'}</ul>`)
    parts.push(`<details><summary>Size</summary><label><input id="rsW" type="number" value="${m.width}"> × <input id="rsH" type="number" value="${m.height}"></label><button id="rsGo">Resize (new cells: the first terrain)</button></details>`)
    parts.push(`<button id="delMap" class="danger">Delete this map</button>`)
    right.innerHTML = parts.join('')

    right.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-m]').forEach((el) => (el.onchange = () => this.edit(ctx, 'the map', (x) => {
      const k = el.dataset.m!
      if (k === 'en' || k === 'zh') x.map.name = textOf(k === 'en' ? el.value : enOf(x.map.name), k === 'zh' ? el.value : zhOf(x.map.name))
      else (x.map as unknown as Record<string, unknown>)[k] = el.value || undefined
    })))
    right.querySelectorAll<HTMLElement>('[data-entity]').forEach((a) => (a.onclick = () => ((ctx.sel = { ...ctx.sel, entity: a.dataset.entity }), ctx.refresh())))
    right.querySelectorAll<HTMLElement>('[data-person]').forEach((a) => (a.onclick = () => ((ctx.sel = { person: a.dataset.person }), ctx.open('people'))))
    right.querySelector<HTMLButtonElement>('#playHere')?.addEventListener('click', () => c && void ctx.playtest({ map: m.id, ...c }))
    this.wireEntity(ctx, right)
    right.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-p]').forEach((el) => (el.onchange = () => this.edit(ctx, 'the portal', (x) => {
      const q = x.map.portals[pi!] as Portal
      const k = el.dataset.p!
      if (k === 'to') q.to = el.value
      else if (k === 'tx' || k === 'ty') q[k] = Number(el.value)
      else { const en = k === 'en' ? el.value : enOf(q.label), zh = k === 'zh' ? el.value : zhOf(q.label); q.label = en ? textOf(en, zh) : undefined }
    })))
    right.querySelector<HTMLButtonElement>('#pDel')?.addEventListener('click', () => (this.edit(ctx, 'remove a portal', (x) => x.map.portals.splice(pi!, 1)), (ctx.sel = { cell: c })))
    right.querySelectorAll<HTMLElement>('[data-anchor-del]').forEach((a) => (a.onclick = () => this.edit(ctx, 'remove an anchor', (x) => delete x.map.anchors?.[a.dataset.anchorDel!])))
    right.querySelectorAll<HTMLElement>('[data-region-del]').forEach((a) => (a.onclick = () => this.edit(ctx, 'remove an area', (x) => delete x.map.regions?.[a.dataset.regionDel!])))
    right.querySelector<HTMLButtonElement>('#rsGo')!.onclick = () => this.resize(ctx, Number(right.querySelector<HTMLInputElement>('#rsW')!.value), Number(right.querySelector<HTMLInputElement>('#rsH')!.value))
    right.querySelector<HTMLButtonElement>('#delMap')!.onclick = () => {
      if (!confirm(`Delete the map ${m.id}? (Undo brings it back; Save deletes its file.)`)) return
      const f = this.file(ctx)!
      ctx.store.remove(f, `delete ${m.id}`)
      const next = ctx.store.maps()[0]?.data.map.id
      if (next) ctx.showMap(next)
    }
  }

  private entityForm(e: Entity, warn: string): string {
    return `<h3>${esc(e.id)}${esc(warn)}</h3>
      <label>type <input data-e="type" value="${esc(e.type)}"></label>
      <label>name <input data-e="en" value="${esc(enOf(e.name))}"> <input data-e="zh" value="${esc(zhOf(e.name))}"></label>
      <label>at <input data-e="x" type="number" value="${e.place.on === 'tile' ? e.place.x : ''}"> <input data-e="y" type="number" value="${e.place.on === 'tile' ? e.place.y : ''}"></label>
      <label>tags <input data-e="tags" value="${esc((e.tags ?? []).join(', '))}"></label>
      <label>props <textarea data-e="props" rows="3">${esc(e.props ? JSON.stringify(e.props) : '')}</textarea></label>
      ${e.ai ? `<label>behaviour <textarea data-e="ai" rows="3">${esc(JSON.stringify(e.ai))}</textarea></label>` : ''}
      <button id="eDel" class="danger">Remove ${esc(e.id)}</button>`
  }

  private wireEntity(ctx: Ctx, right: HTMLElement): void {
    const id = ctx.sel.entity
    if (!id) return
    const at = (fn: (e: Entity) => void) => this.edit(ctx, `change ${id}`, (ch) => { const e = ch.entities.find((x) => x.id === id); if (e) fn(e) })
    right.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-e]').forEach((el) => (el.onchange = () => {
      const k = el.dataset.e!
      try {
        at((e) => {
          if (k === 'type') e.type = el.value.trim()
          else if (k === 'en' || k === 'zh') { const en = k === 'en' ? el.value : enOf(e.name), zh = k === 'zh' ? el.value : zhOf(e.name); e.name = en ? textOf(en, zh) : undefined }
          else if ((k === 'x' || k === 'y') && e.place.on === 'tile') { e.place[k] = Number(el.value); ctx.sel.cell = { x: e.place.x, y: e.place.y } }
          else if (k === 'tags') e.tags = el.value.split(',').map((t) => t.trim()).filter(Boolean)
          else if (k === 'props') e.props = (parseValue(el.value) as Entity['props']) ?? undefined
          else if (k === 'ai') e.ai = parseValue(el.value) as Entity['ai']
          if (e.tags && !e.tags.length) delete e.tags
        })
      } catch (err) {
        toast(String(err), 'error')
      }
    }))
    right.querySelector<HTMLButtonElement>('#eDel')?.addEventListener('click', () => (this.edit(ctx, `remove ${id}`, (ch) => (ch.entities = ch.entities.filter((x) => x.id !== id))), (ctx.sel = { cell: ctx.sel.cell })))
  }

  private resize(ctx: Ctx, w: number, h: number): void {
    if (!(w >= 4 && h >= 4 && w <= 400 && h <= 400)) return toast('A map is 4 to 400 cells a side.', 'warn')
    const fill = Object.keys(ctx.store.game.terrainChars)[0] ?? '.'
    this.edit(ctx, `resize to ${w}×${h}`, (ch) => {
      const m = ch.map
      const fit = (rows: string[] | undefined, f: string) => rows && Array.from({ length: h }, (_, y) => (rows[y] ?? '').slice(0, w).padEnd(w, f))
      m.rows = fit(m.rows, fill)!
      if (m.heights) m.heights = fit(m.heights, '0')
      m.width = w
      m.height = h
      ch.entities = ch.entities.filter((e) => e.place.on !== 'tile' || (e.place.x < w && e.place.y < h))
    })
  }

  focus(ctx: Ctx, file: string, at?: string): void {
    const m = ctx.store.get<RawChunk>(file)
    if (!m) return
    ctx.showMap(m.map.id)
    const e = at && m.entities.find((x) => x.id === at)
    if (e && e.place.on === 'tile') (ctx.sel = { cell: { x: e.place.x, y: e.place.y }, entity: e.id }), ctx.canvas.scene.lookAt(e.place.x, e.place.y)
    const cell = at?.match(/rows\[(\d+)\]/)
    if (cell) ctx.canvas.scene.lookAt(0, Number(cell[1]))
  }
}

/** A stroke's seed: shown to the author, kept in the map's strokes. */
const newSeed = () => Math.floor(Math.random() * 1e6)

/** A thing's new id: its map's, its kind's, a number no other thing has. */
function newId(ctx: Ctx, type: string): string {
  const taken = new Set([...ctx.store.maps().flatMap((m) => m.data.entities.map((e) => e.id)), ...ctx.store.list<Entity>('people').map((p) => p.data.id)])
  const base = `${ctx.map}.${type.split('/').pop()}`
  for (let n = 1; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`
}

