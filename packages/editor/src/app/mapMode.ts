// The map (docs/engine-split.md §6, §16 E1; RPG Maker's map and tiles, used as RPG Maker is used). Four layers —
// the ground, its height, the things on it, and the marks (portals, anchors, areas, the start) — each with its
// tools: a pencil with a brush size, a rectangle, an ellipse, a flood fill, a selection to copy, cut, paste, clear
// and drag; buildings from the catalogue and rooms' walls, an interior made behind a door; the builder's brushes
// (a path, a patch, things scattered, a yard). The right button picks what is under it (dragged: a block to stamp);
// things are dragged to move and nudged with the arrows. Every stroke is the format's data: a map file's rows,
// heights, stamps, rooms, portals, anchors, regions and entities with ids of their own (mapEdit.ts).

import type { Entity, Portal, RawChunk, Rule } from '@openworld/engine'
import { paintOrganic, paintPath, scatter, yard, type PersonFile } from '@openworld/format'
import type { Catalog } from '@openworld/runtime/src/assets/types.ts'
import type { CellEvent } from './canvas.ts'
import type { Ctx, Mode } from './context.ts'
import { contents, ownKindId, ownKindRule } from './events.ts'
import { Form } from './form.ts'
import { mapSettings, wireMapSettings } from './mapForms.ts'
import { rulesMode } from './modes.ts'
import { setEntry } from './ontologyFiles.ts'
import { QuickEvents, type QuickKind } from './quickEvents.ts'
import { mapTree, overview, paintMinis } from './mapTree.ts'
import {
  EditError,
  boxOf,
  brushCells,
  charOf,
  clearBlock,
  copyBlock,
  copyThing,
  duplicateMap,
  ellipseCells,
  floodCells,
  groundAround,
  idsOf,
  interiorBehind,
  moveBlock,
  moveThing,
  newId,
  paint,
  pasteBlock,
  rectCells,
  removeStamp,
  removeThings,
  room,
  roomAt,
  stampAt,
  stampBuilding,
  thingsIn,
  valueAt,
  type Block,
  type Box,
  type Cell,
  type Prefab,
} from './mapEdit.ts'
import { paintPics, prefabPic, terrainPic, typePic, type Pic } from './thumbs.ts'
import { enOf, esc, parseValue, textOf, toast, tx, zhOf } from './ui.ts'

type LayerId = 'ground' | 'height' | 'things' | 'marks'
type Tool =
  | 'pencil' | 'rect' | 'ellipse' | 'fill' | 'select' | 'building' | 'room' | 'path' | 'organic'
  | 'pick' | 'put' | 'putRect' | 'erase' | 'scatter' | 'yard' | 'quick'
  | 'mark' | 'portal' | 'anchor' | 'region' | 'start'

/** A layer's tools: the tool, its name, what it does, its key. */
const LAYERS: { id: LayerId; label: string; tip: string; tools: [Tool, string, string, string?][] }[] = [
  {
    id: 'ground', label: 'Ground', tip: 'the ground: terrain, buildings, rooms',
    tools: [
      ['pencil', 'Pencil', 'paint cells (drag); the brush size below', 'P'],
      ['rect', 'Rectangle', 'drag a box: painted whole', 'R'],
      ['ellipse', 'Ellipse', 'drag a box: the ellipse in it', 'E'],
      ['fill', 'Fill', 'the cells joined to this one by the same ground', 'F'],
      ['select', 'Select', 'drag a box: Ctrl+C copy, Ctrl+X cut, Ctrl+V paste, Delete takes its things away; drag it (or the arrows) to move it', 'S'],
      ['building', 'Building', 'a building from the catalogue: click where its top left goes; then make the room behind its door', 'B'],
      ['room', 'Room', 'drag a box: walls round a floor; click one of its walls for a doorway', 'O'],
      ['path', 'Path', 'a curved path through the points you click'],
      ['organic', 'Patch', 'an organic patch of ground (drag its box): a pond, a clearing'],
    ],
  },
  {
    id: 'height', label: 'Height', tip: 'the ground\'s height in half levels',
    tools: [
      ['pencil', 'Pencil', 'paint heights (drag); the brush size below', 'P'],
      ['rect', 'Rectangle', 'drag a box', 'R'],
      ['ellipse', 'Ellipse', 'drag a box: the ellipse in it', 'E'],
      ['fill', 'Fill', 'the cells joined to this one at the same height', 'F'],
      ['select', 'Select', 'drag a box: copy, cut, paste, move (as on the ground)', 'S'],
    ],
  },
  {
    id: 'things', label: 'Things', tip: 'the things on the map, and the people standing there',
    tools: [
      ['pick', 'Select', 'click a thing or a person: drag to move, the arrows nudge, Delete removes, Ctrl+C / Ctrl+V copy; a double click opens it', 'S'],
      ['quick', 'Quick', 'a door, a chest, a sign, a bed, a person, a merchant or a quest giver: choose it, fill it in, click where it goes', 'Q'],
      ['put', 'Set down', 'the kind chosen, in each cell clicked or dragged over', 'P'],
      ['putRect', 'Rectangle', 'one in every cell of a box', 'R'],
      ['erase', 'Erase', 'take away the things in the cells (drag; the brush size)', 'X'],
      ['scatter', 'Scatter', 'small things by a mask (drag a box): on the ground you name'],
      ['yard', 'Yard', 'a fenced yard of the kind chosen (drag its box), a gate at its foot'],
    ],
  },
  {
    id: 'marks', label: 'Marks', tip: 'portals, anchors, areas and where the game begins',
    tools: [
      ['mark', 'Select', 'click a portal, an anchor or the start: drag one to move it, the arrows nudge', 'S'],
      ['portal', 'Portal', 'a way to another map', 'T'],
      ['anchor', 'Anchor', 'a named spot (people\'s days, scenes)', 'A'],
      ['region', 'Area', 'a named area (drag a rectangle)', 'R'],
      ['start', 'Start', 'where a new game begins'],
    ],
  },
]
const layerOf = (id: LayerId) => LAYERS.find((l) => l.id === id)!
/** What can be set down: the kinds of things the inputs and the world handle. */
const PLACEABLE = /^(fixture|item|actor\/creature|structure)\//
/** Tools that paint the chosen ground (the eyedropper leaves them as they are). */
const PAINTS = new Set<Tool>(['pencil', 'rect', 'ellipse', 'fill', 'path', 'organic'])
const SIZED = new Set<Tool>(['pencil', 'erase'])

/** What was copied last (any map's): a block, or a thing alone. */
let clipboard: Block | undefined

export class MapMode implements Mode {
  id = 'map'
  label = 'Map'
  private layer: LayerId = 'ground'
  private tools: Record<LayerId, Tool> = { ground: 'pencil', height: 'pencil', things: 'pick', marks: 'mark' }
  private char = '.'
  private height = 0
  private thing = ''
  private filter = ''
  private size = 1
  private prefab = ''
  private style = ''
  private floor = ''
  private markName = ''
  private stroke = 0
  /** A box being dragged out, and a right-button drag (a block picked). */
  private drag?: { from: Cell; to: Cell }
  private rpick?: { from: Cell; to: Cell }
  /** The selection on the ground or height layer, and it being dragged. */
  private selBox?: Box
  private moving?: { from: Cell; to: Cell }
  /** A thing, a person or a mark being dragged. */
  private grab?: { kind: 'entity' | 'person' | 'portal' | 'anchor' | 'start'; id: string; from: Cell; to: Cell }
  /** A block being pasted: it follows the pointer, a click lays it (again and again, until Esc). */
  private paste?: Block
  private hover?: Cell
  /** The path brush's points, and the brushes' settings. */
  private points: [number, number][] = []
  private width = 2
  private edge = ''
  private rough = 0.22
  private only = ''
  private density = 0.15
  /** The world overview in the middle instead of the map. */
  main?: (ctx: Ctx, el: HTMLElement) => void
  /** The Things layer's quick events. */
  private quick = new QuickEvents()

  private get tool(): Tool {
    return this.tools[this.layer]
  }
  private set tool(t: Tool) {
    this.tools[this.layer] = t
  }

  private file(ctx: Ctx): string | undefined {
    return ctx.store.mapFile(ctx.map)
  }
  private chunk(ctx: Ctx): RawChunk | undefined {
    const f = this.file(ctx)
    return f ? ctx.store.get<RawChunk>(f) : undefined
  }
  private edit(ctx: Ctx, why: string, fn: (c: RawChunk) => void, stroke?: number): void {
    const f = this.file(ctx)
    if (!f) return
    try {
      ctx.store.change<RawChunk>(f, why, fn, stroke)
    } catch (e) {
      if (e instanceof EditError) toast(e.message, 'warn')
      else throw e
    }
  }
  private catalog(ctx: Ctx): Catalog {
    return { prefabs: {}, rooms: {}, blobs: {}, plain: {}, terrainObjects: {}, fixtures: {}, items: {}, creatures: {}, music: {}, ...(ctx.store.get<Catalog>('catalog.json') ?? {}) } as Catalog
  }
  private prefabs(ctx: Ctx): Record<string, Prefab> {
    return this.catalog(ctx).prefabs
  }
  private taken(ctx: Ctx): Set<string> {
    return idsOf(ctx.store.maps().map((m) => m.data), ctx.store.list<PersonFile>('people').map((p) => p.data.id))
  }
  /** The ground a box's emptied cells get: what is around it (else the first terrain). */
  private background(ctx: Ctx, ch: RawChunk, b: Box): string {
    return groundAround(ch, b, ctx.store.game.terrainChars, Object.keys(ctx.store.game.terrainChars)[0] ?? '.')
  }

  // ---------------------------------------------------------------- the left panel

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const onto = ctx.onto()
    const cat = this.catalog(ctx)
    const chars = Object.entries(ctx.store.game.terrainChars)
    if (!chars.some(([c]) => c === this.char)) this.char = chars[0]?.[0] ?? '.'
    if (!this.prefab || !cat.prefabs[this.prefab]) this.prefab = Object.keys(cat.prefabs)[0] ?? ''
    if (!this.style || !cat.rooms[this.style]) this.style = Object.keys(cat.rooms)[0] ?? ''
    if (!this.floor || !chars.some(([c]) => c === this.floor)) this.floor = charOf(ctx.store.game.terrainChars, 'floor') ?? this.char
    const pics = new Map<string, Pic | undefined>()
    const L = layerOf(this.layer)
    const parts: string[] = []
    parts.push(`<div class="layers">${LAYERS.map((l) => `<button data-layer="${l.id}" class="${l.id === this.layer ? 'on' : ''}" title="${esc(l.tip)}">${l.label}</button>`).join('')}</div>`)
    parts.push(`<div class="tools">${L.tools.map(([t, name, tip, key]) => `<button data-tool="${t}" class="${t === this.tool ? 'on' : ''}" title="${esc(tip)}${key ? ` (${key})` : ''}">${name}</button>`).join('')}</div>`)
    parts.push(`<p class="muted hint">${esc(L.tools.find(([t]) => t === this.tool)?.[2] ?? '')}</p>`)
    if (this.paste) parts.push(`<p class="pasting">Pasting a block ${this.paste.w}×${this.paste.h}: click where its top left goes. <a id="pasteOff">Done (Esc)</a></p>`)
    if (SIZED.has(this.tool)) parts.push(`<label>brush <span class="palette row inline">${[1, 2, 3, 4, 5].map((n) => `<button data-size="${n}" class="${n === this.size ? 'on' : ''}">${n}</button>`).join('')}</span></label>`)
    parts.push(this.brushOptions(chars))
    if (this.layer === 'ground' && this.tool === 'building') {
      const keys = Object.keys(cat.prefabs).sort()
      for (const k of keys) pics.set(`pf:${k}`, prefabPic(cat, k))
      parts.push(`<h3>Buildings</h3>${keys.length ? `<div class="palette grid">${keys.map((k) => `<button data-prefab="${esc(k)}" class="pic ${k === this.prefab ? 'on' : ''}" title="${esc(k)}"><canvas data-pic="pf:${esc(k)}" width="48" height="48"></canvas><small>${esc(k)}</small></button>`).join('')}</div>` : '<p class="muted">The catalogue has no buildings: cut one from a picture in the Assets mode (Buildings).</p>'}`)
    } else if (this.layer === 'ground' && this.tool === 'room') {
      parts.push(`<h3>Room</h3>${Object.keys(cat.rooms).length ? `<label>walls <select id="roomStyle">${Object.keys(cat.rooms).map((s) => `<option ${s === this.style ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>` : '<p class="muted">The catalogue has no room walls (Assets mode, Rooms): the walls are drawn as their terrain.</p>'}<label>floor <select id="roomFloor">${chars.map(([c, id]) => `<option value="${esc(c)}" ${c === this.floor ? 'selected' : ''}>${esc(tx(onto.terrains[id]?.name) || id)}</option>`).join('')}</select></label>`)
    } else if (this.layer === 'ground' && PAINTS.has(this.tool)) {
      for (const [, id] of chars) pics.set(`t:${id}`, terrainPic(cat, id))
      parts.push(`<h3>Ground</h3><div class="palette grid">${chars.map(([c, id]) => `<button data-char="${esc(c)}" class="pic ${c === this.char ? 'on' : ''}" title="${esc(id)} (${esc(c)}); right-click on the map picks one"><canvas data-pic="t:${esc(id)}" width="32" height="32" style="background:${esc(onto.terrains[id]?.color ?? '#555')}"></canvas><small>${esc(tx(onto.terrains[id]?.name) || id)}</small></button>`).join('')}</div>`)
    }
    if (this.layer === 'height' && this.tool !== 'select') parts.push(`<h3>Height</h3><div class="palette row">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => `<button data-height="${h}" class="${h === this.height ? 'on' : ''}">${h}</button>`).join('')}</div><p class="muted">Half levels: 2 is a level. One walks at most half a level up or down.</p>`)
    const quick = this.layer === 'things' && this.tool === 'quick' ? new Form() : undefined
    if (quick) parts.push(this.quick.panel(ctx, quick, () => ctx.refresh()))
    else if (this.layer === 'things' && this.tool !== 'pick' && this.tool !== 'erase') parts.push(this.thingPalette(ctx, pics))
    if (this.layer === 'marks' && (this.tool === 'anchor' || this.tool === 'region')) parts.push(`<label>its name <input id="markName" value="${esc(this.markName)}" placeholder="${this.tool === 'anchor' ? 'well (or the next spot)' : 'square (or the next area)'}"></label>`)
    parts.push(`<h3>Maps <a id="mOverview" class="x" title="every map, laid out by its edges, its portals' lines">world ▸</a></h3>${mapTree(ctx)}`)
    parts.push(`<details><summary>New map</summary>
        <label>id <input id="nmId" placeholder="meadow"></label>
        <label>name <input id="nmEn" placeholder="The Meadow"> <input id="nmZh" placeholder="草地"></label>
        <label>size <input id="nmW" type="number" value="24" min="4" max="200"> × <input id="nmH" type="number" value="16" min="4" max="200"></label>
        <label>ground <select id="nmFill">${chars.map(([c, id]) => `<option value="${esc(c)}">${esc(id)}</option>`).join('')}</select></label>
        <button id="nmMake">Make the map</button>
      </details>`)
    left.innerHTML = parts.join('')
    if (quick) {
      quick.wire(left)
      left.querySelectorAll<HTMLElement>('[data-quick]').forEach((b) => (b.onclick = () => ((this.quick.kind = b.dataset.quick as QuickKind), ctx.refresh())))
    }
    paintPics(left, ctx.store.id, pics)
    paintMinis(ctx, left)
    this.wireLeft(ctx, left)
    this.inspector(ctx, right)
    ctx.canvas.dim(this.layer === 'things' ? { ground: 0.55 } : this.layer === 'marks' ? { ground: 0.8, things: 0.6 } : { things: 0.45 })
  }

  private thingPalette(ctx: Ctx, pics: Map<string, Pic | undefined>): string {
    const onto = ctx.onto()
    const cat = this.catalog(ctx)
    const f = this.filter.toLowerCase()
    const things = Object.keys(onto.types).filter((t) => PLACEABLE.test(t) && (!f || t.includes(f) || tx(onto.types[t]?.name).toLowerCase().includes(f))).sort()
    // grouped as the type tree has them: the first two steps of a kind's path (fixture/furniture, item/tool …)
    const groups = new Map<string, string[]>()
    for (const t of things) {
      const g = t.split('/').slice(0, 2).join('/')
      groups.set(g, [...(groups.get(g) ?? []), t])
    }
    for (const t of things) pics.set(`ty:${t}`, typePic(cat, onto, t))
    return `<h3>Kinds of things</h3><input id="thingFilter" placeholder="filter kinds" value="${esc(this.filter)}">
      <div class="palette list things-pal">${[...groups].map(([g, ts]) => `<details ${f || ts.includes(this.thing) || things.length <= 40 ? 'open' : ''}><summary>${esc(g)} <small class="muted">${ts.length}</small></summary><div class="palette grid">${ts.map((t) => `<button data-thing="${esc(t)}" class="pic ${t === this.thing ? 'on' : ''}" title="${esc(t)}"><canvas data-pic="ty:${esc(t)}" width="32" height="32"></canvas><small>${esc(tx(onto.types[t]?.name) || t.split('/').pop())}</small></button>`).join('')}</div></details>`).join('')}</div>`
  }

  private brushOptions(chars: [string, string][]): string {
    const opt = (cur: string, none: string) => `<option value="">${none}</option>${chars.map(([c, id]) => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(id)}</option>`).join('')}`
    if (this.layer === 'ground' && this.tool === 'path') return `<p class="muted">${this.points.length} point${this.points.length === 1 ? '' : 's'}</p><label>width <input id="bWidth" type="number" min="1" max="6" value="${this.width}"></label><label>frayed with <select id="bEdge">${opt(this.edge, 'nothing')}</select></label><button id="bLay" ${this.points.length ? '' : 'disabled'}>Lay the path</button> <button id="bClear">Clear the points</button>`
    if (this.layer === 'ground' && this.tool === 'organic') return `<label>rough <input id="bRough" type="number" step="0.05" min="0" max="0.6" value="${this.rough}"></label><label>only over <select id="bOnly">${opt(this.only, 'anything')}</select></label>`
    if (this.layer === 'things' && this.tool === 'scatter') return `<label>chance a cell <input id="bDensity" type="number" step="0.05" min="0.01" max="1" value="${this.density}"></label><label>only on <select id="bOnly">${opt(this.only, 'any ground')}</select></label>`
    if (this.layer === 'things' && this.tool === 'yard') return '<p class="muted">Choose its fence (a fixture) below, then drag the yard\'s box.</p>'
    return ''
  }

  private wireLeft(ctx: Ctx, left: HTMLElement): void {
    const on = (sel: string, f: (b: HTMLElement) => void) => left.querySelectorAll<HTMLElement>(sel).forEach((b) => (b.onclick = () => f(b)))
    on('[data-layer]', (b) => this.setLayer(ctx, b.dataset.layer as LayerId))
    on('[data-tool]', (b) => this.setTool(ctx, b.dataset.tool as Tool))
    on('[data-char]', (b) => ((this.char = b.dataset.char!), ctx.refresh()))
    on('[data-height]', (b) => ((this.height = Number(b.dataset.height)), ctx.refresh()))
    on('[data-thing]', (b) => ((this.thing = b.dataset.thing!), this.tool === 'pick' && (this.tool = 'put'), ctx.refresh()))
    on('[data-size]', (b) => ((this.size = Number(b.dataset.size)), ctx.refresh()))
    on('[data-prefab]', (b) => ((this.prefab = b.dataset.prefab!), ctx.refresh()))
    on('[data-map]', (b) => ((this.main = undefined), (this.selBox = undefined), ctx.showMap(b.dataset.map!)))
    on('#pasteOff', () => ((this.paste = undefined), ctx.refresh()))
    on('#mOverview', () => this.showOverview(ctx))
    const sel = (id: string, f: (v: string) => void) => { const el = left.querySelector<HTMLSelectElement | HTMLInputElement>(id); if (el) el.onchange = () => f(el.value) }
    sel('#roomStyle', (v) => (this.style = v))
    sel('#roomFloor', (v) => (this.floor = v))
    sel('#markName', (v) => (this.markName = v.trim()))
    const filter = left.querySelector<HTMLInputElement>('#thingFilter')
    if (filter) filter.oninput = () => { this.filter = filter.value; const at = filter.selectionStart; ctx.refresh(); const f = document.querySelector<HTMLInputElement>('#thingFilter'); f?.focus(); f?.setSelectionRange(at, at) }
    left.querySelector<HTMLButtonElement>('#nmMake')!.onclick = () => this.newMap(ctx, left)
    const num = (id: string, f: (v: number) => void) => { const el = left.querySelector<HTMLInputElement>(id); if (el) el.onchange = () => f(Number(el.value)) }
    num('#bWidth', (v) => (this.width = Math.max(1, Math.min(6, v || 2))))
    num('#bRough', (v) => (this.rough = Math.max(0, Math.min(0.6, v))))
    num('#bDensity', (v) => (this.density = Math.max(0.01, Math.min(1, v || 0.15))))
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

  private setLayer(ctx: Ctx, l: LayerId): void {
    this.layer = l
    this.drag = this.moving = this.grab = undefined
    if (l !== 'ground' && l !== 'height') this.selBox = undefined
    ctx.refresh()
  }
  private setTool(ctx: Ctx, t: Tool): void {
    this.tool = t
    this.drag = this.moving = undefined
    if (t !== 'select') this.selBox = undefined
    ctx.refresh()
  }

  private showOverview(ctx: Ctx): void {
    this.main = (c, el) => overview(c, el, (id) => ((this.main = undefined), c.showMap(id)))
    ctx.refresh()
  }

  private newMap(ctx: Ctx, left: HTMLElement): void {
    const v = (id: string) => left.querySelector<HTMLInputElement>(id)!.value
    const id = v('#nmId').trim()
    if (!validId(id)) return toast('A map\'s id: lower case letters, digits, - and _.', 'warn')
    if (ctx.store.mapFile(id)) return toast(`There is a map ${id} already.`, 'warn')
    const w = Math.max(4, Math.min(200, Number(v('#nmW')) || 24))
    const h = Math.max(4, Math.min(200, Number(v('#nmH')) || 16))
    const fill = left.querySelector<HTMLSelectElement>('#nmFill')!.value
    const chunk: RawChunk = { map: { id, name: textOf(v('#nmEn') || id, v('#nmZh')), kind: 'wild', width: w, height: h, rows: Array.from({ length: h }, () => fill.repeat(w)), portals: [], anchors: {}, regions: {}, light: 'outdoor', zone: 'peaceful' }, entities: [] }
    ctx.store.add(`maps/${id}.json`, chunk, `a new map ${id}`)
    ctx.showMap(id)
  }

  // ---------------------------------------------------------------- the tool on a cell

  cell(ctx: Ctx, c: Cell, ev: CellEvent): void {
    if (ev === 'leave') return void ((this.hover = undefined), ctx.canvas.redraw())
    if (ev === 'hover' || ev === 'drag' || ev === 'rdrag') this.hover = c
    if (ev === 'hover') return void ((this.paste || this.preview()) && ctx.canvas.redraw())
    if (ev === 'rdown' || ev === 'rdrag' || ev === 'rup') return this.picker(ctx, c, ev)
    if (ev === 'double') return this.open(ctx, c)
    if (ev === 'down') this.stroke++
    const s = this.stroke
    // a block being pasted goes where it is clicked, whatever the tool
    if (this.paste) {
      if (ev !== 'down') return
      const b = this.paste
      this.edit(ctx, `paste ${b.w}×${b.h}`, (ch) => pasteBlock(ch, b, c, this.taken(ctx), this.prefabs(ctx)))
      return
    }
    const ground = this.layer === 'ground'
    const layer = ground ? 'ground' : 'height'
    const value = ground ? this.char : String(this.height)
    switch (this.tool) {
      case 'pencil':
        return this.edit(ctx, `paint ${value}`, (ch) => paint(ch, layer, brushCells(c, this.size), value), s)
      case 'fill':
        if (ev !== 'down') return
        return this.edit(ctx, `fill ${value}`, (ch) => paint(ch, layer, floodCells(ch, layer, c), value))
      case 'rect':
      case 'ellipse':
      case 'putRect':
      case 'region':
      case 'organic':
      case 'scatter':
      case 'yard':
      case 'room':
        return this.box(ctx, c, ev, (b, from) => this.boxDone(ctx, b, from, c, value))
      case 'select':
        return this.select(ctx, c, ev)
      case 'building': {
        if (ev !== 'down') return
        const p = this.prefabs(ctx)[this.prefab]
        if (!p) return toast('Choose a building first (or cut one in the Assets mode).', 'warn')
        let door: Cell | undefined
        this.edit(ctx, `the building ${this.prefab}`, (ch) => (door = stampBuilding(ch, this.prefab, p, c, ctx.store.game.terrainChars)))
        if (door) (ctx.sel = { cell: door }), toast('Its door is selected: make the room behind it on the right.'), ctx.refresh()
        return
      }
      case 'path':
        if (ev === 'down') (this.points.push([c.x, c.y]), ctx.refresh())
        return
      case 'pick':
        return this.pick(ctx, c, ev)
      case 'quick':
        if (ev === 'down') void this.quick.place(ctx, c).then((sel) => sel && ((ctx.sel = { cell: c, ...sel }), ctx.refresh()))
        return
      case 'put': {
        if (!this.thing) return ev === 'down' ? toast('Choose a kind of thing first.', 'warn') : undefined
        const ch = this.chunk(ctx)
        if (ev === 'drag' && ch?.entities.some((e) => e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y && e.type === this.thing)) return
        if (ev === 'up') return
        let made = ''
        this.edit(ctx, `set down ${this.thing}`, (x) => (made = this.setDown(ctx, x, c)), s)
        ctx.sel = { cell: c, entity: made }
        return ctx.refresh()
      }
      case 'erase':
        if (ev === 'up') return
        return this.edit(ctx, 'take away', (ch) => { const b = brushCells(c, this.size); const box = boxOf(b[0], b[b.length - 1]); removeThings(ch, thingsIn(ch, box).map((e) => e.id)) }, s)
      case 'mark':
        return this.markPick(ctx, c, ev)
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
        const ch = this.chunk(ctx)!
        const name = this.markName || nextName(Object.keys(ch.map.anchors ?? {}), 'spot')
        this.edit(ctx, `anchor ${name}`, (x) => ((x.map.anchors ??= {})[name] = [c.x, c.y]))
        this.markName = ''
        ctx.sel = { cell: c }
        return ctx.refresh()
      }
      case 'start':
        if (ev !== 'down') return
        return ctx.store.change('game.json', 'the start', (g: { start: { map: string; x: number; y: number } }) => (g.start = { map: ctx.map, x: c.x, y: c.y }))
    }
  }

  /** A box dragged out: its corners as the pointer goes, done on release. */
  private box(ctx: Ctx, c: Cell, ev: CellEvent, done: (b: Box, from: Cell) => void): void {
    if (ev === 'down') this.drag = { from: c, to: c }
    else if (this.drag) this.drag.to = c
    ctx.canvas.redraw()
    if (ev !== 'up' || !this.drag) return
    const d = this.drag
    this.drag = undefined
    done(boxOf(d.from, d.to), d.from)
    ctx.canvas.redraw()
  }

  private boxDone(ctx: Ctx, b: Box, from: Cell, to: Cell, value: string): void {
    const layer = this.layer === 'ground' ? 'ground' : 'height'
    const chars = ctx.store.game.terrainChars
    switch (this.tool) {
      case 'rect':
        return this.edit(ctx, `a rectangle of ${value}`, (ch) => paint(ch, layer, rectCells(from, to), value))
      case 'ellipse':
        return this.edit(ctx, `an ellipse of ${value}`, (ch) => paint(ch, layer, ellipseCells(from, to), value))
      case 'putRect':
        if (!this.thing) return toast('Choose a kind of thing first.', 'warn')
        return this.edit(ctx, `${b.w * b.h} × ${this.thing}`, (ch) => rectCells(from, to).forEach((c) => this.setDown(ctx, ch, c)))
      case 'region': {
        const ch = this.chunk(ctx)!
        const name = this.markName || nextName(Object.keys(ch.map.regions ?? {}), 'area')
        this.markName = ''
        return this.edit(ctx, `area ${name}`, (x) => ((x.map.regions ??= {})[name] = [b.x, b.y, b.w, b.h]))
      }
      case 'room': {
        const ch = this.chunk(ctx)!
        // a click on a room's wall: a doorway there (or the wall again)
        if (b.w === 1 && b.h === 1) {
          const i = roomAt(ch, from)
          const r = i !== undefined ? ch.map.rooms![i] : undefined
          const ring = r && (from.x === r.x || from.y === r.y || from.x === r.x + r.w - 1 || from.y === r.y + r.h - 1)
          if (!ring) return toast('Drag a room\'s box; click one of its walls for a doorway.', 'warn')
          const door = charOf(chars, 'door')
          const wall = charOf(chars, 'wall')
          if (!door || !wall) return toast('The game writes no character for a door or a wall.', 'warn')
          return this.edit(ctx, 'a doorway', (x) => paint(x, 'ground', [from], valueAt(x, 'ground', from) === door ? wall : door))
        }
        if (b.w < 3 || b.h < 3) return toast('A room is at least 3 cells a side.', 'warn')
        return this.edit(ctx, `a room ${b.w}×${b.h}`, (x) => room(x, this.style || 'wood', b, chars, this.floor))
      }
      case 'organic': {
        const seed = newSeed()
        return this.edit(ctx, `a patch (seed ${seed})`, (ch) => paintOrganic(ch, b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, this.char, seed, { rough: this.rough, ...(this.only && { only: [this.only] }) }))
      }
      case 'scatter':
      case 'yard': {
        if (!this.thing) return toast('Choose a kind of thing first.', 'warn')
        const seed = newSeed()
        const taken = this.taken(ctx)
        if (this.tool === 'scatter') return this.edit(ctx, `scatter ${this.thing} (seed ${seed})`, (ch) => scatter(ch, [b.x, b.y, b.w, b.h], this.thing, this.density, seed, taken, this.only ? { on: [this.only] } : {}))
        return this.edit(ctx, `a yard of ${this.thing}`, (ch) => yard(ch, [b.x, b.y, b.w, b.h], this.thing, taken, [[b.x + Math.floor(b.w / 2), b.y + b.h - 1]]))
      }
    }
  }

  /** A thing of the chosen kind set down in a cell; its id. */
  private setDown(ctx: Ctx, ch: RawChunk, c: Cell): string {
    const e: Entity = { id: newId(ch.map.id, this.thing, this.taken(ctx)), type: this.thing, place: { on: 'tile', map: ch.map.id, x: c.x, y: c.y } }
    if (this.thing.startsWith('actor/creature')) e.ai = { behaviour: 'melee', temper: 'wary', sight: 4, home: { map: ch.map.id, x: c.x, y: c.y }, leash: 6 }
    ch.entities.push(e)
    return e.id
  }

  /** The selection tool: a box dragged out; dragged from inside, the box's contents moved. */
  private select(ctx: Ctx, c: Cell, ev: CellEvent): void {
    const inBox = (b: Box | undefined) => b && c.x >= b.x && c.y >= b.y && c.x < b.x + b.w && c.y < b.y + b.h
    if (ev === 'down' && inBox(this.selBox)) return void (this.moving = { from: c, to: c })
    if (this.moving) {
      this.moving.to = c
      ctx.canvas.redraw()
      if (ev !== 'up') return
      const d = { x: this.moving.to.x - this.moving.from.x, y: this.moving.to.y - this.moving.from.y }
      this.moving = undefined
      if (d.x || d.y) this.moveSelection(ctx, d)
      return
    }
    this.box(ctx, c, ev, (b) => {
      this.selBox = b.w * b.h > 1 ? b : undefined
      ctx.sel = { cell: c }
      ctx.refresh()
    })
  }

  private moveSelection(ctx: Ctx, d: Cell): void {
    const b = this.selBox
    if (!b) return
    let now = b
    this.edit(ctx, `move ${b.w}×${b.h}`, (ch) => (now = moveBlock(ch, b, d, this.background(ctx, ch, b), this.prefabs(ctx))))
    this.selBox = now
    ctx.refresh()
  }

  /**
   * A double click (RPG Maker's on an event): a person opens in the people mode, a thing at its kind in the database
   * (its fields and the rules on it), a portal in its settings, a door that leads nowhere offers the room behind it.
   */
  private open(ctx: Ctx, c: Cell): void {
    if (!(this.tool === 'pick' || this.tool === 'mark' || this.tool === 'select')) return
    const ch = this.chunk(ctx)
    if (!ch) return
    const top = this.topAt(ctx, c)
    if (top?.kind === 'person') {
      const f = ctx.store.list<PersonFile>('people').find((p) => p.data.id === top.id)?.file
      ctx.sel = { person: top.id }
      return ctx.open('people', f)
    }
    const pi = ch.map.portals.findIndex((p) => p.x === c.x && p.y === c.y)
    if (pi >= 0 && (this.layer === 'marks' || !top)) return void ((this.layer = 'marks'), (this.tools.marks = 'mark'), (ctx.sel = { cell: c, portal: pi }), ctx.refresh())
    if (top?.kind === 'entity') {
      const e = ch.entities.find((x) => x.id === top.id)
      if (e) return ctx.open('database', '', e.type)
    }
    ctx.sel = { cell: c }
    ctx.refresh()
  }

  /** The top thing in a cell: a person standing there first, then the last thing set down. */
  private topAt(ctx: Ctx, c: Cell): { kind: 'entity' | 'person'; id: string } | undefined {
    const person = ctx.store.list<PersonFile>('people').find((p) => p.data.place.on === 'tile' && p.data.place.map === ctx.map && p.data.place.x === c.x && p.data.place.y === c.y)
    if (person) return { kind: 'person', id: person.data.id }
    const e = [...(this.chunk(ctx)?.entities ?? [])].reverse().find((x) => x.place.on === 'tile' && x.place.x === c.x && x.place.y === c.y)
    return e && { kind: 'entity', id: e.id }
  }

  /** The things layer's select: a thing or a person clicked, dragged to move. */
  private pick(ctx: Ctx, c: Cell, ev: CellEvent): void {
    if (ev === 'down') {
      const top = this.topAt(ctx, c)
      ctx.sel = top?.kind === 'entity' ? { cell: c, entity: top.id } : top?.kind === 'person' ? { cell: c, person: top.id } : { cell: c }
      this.grab = top && { ...top, from: c, to: c }
      return ctx.refresh()
    }
    if (!this.grab) return
    this.grab.to = c
    ctx.canvas.redraw()
    if (ev !== 'up') return
    const g = this.grab
    this.grab = undefined
    if (g.to.x === g.from.x && g.to.y === g.from.y) return
    this.moveTop(ctx, g.kind as 'entity' | 'person', g.id, g.to)
  }

  private moveTop(ctx: Ctx, kind: 'entity' | 'person', id: string, to: Cell): void {
    const m = ctx.canvas.map
    if (m && (to.x < 0 || to.y < 0 || to.x >= m.width || to.y >= m.height)) return
    if (kind === 'entity') this.edit(ctx, `move ${id}`, (ch) => moveThing(ch, id, to))
    else {
      const f = ctx.store.list<PersonFile>('people').find((p) => p.data.id === id)?.file
      if (f) ctx.store.change<PersonFile>(f, `move ${id}`, (p) => p.place.on === 'tile' && ((p.place.x = to.x), (p.place.y = to.y)))
    }
    ctx.sel = { ...ctx.sel, cell: to }
    ctx.refresh()
  }

  /** The marks layer's select: a portal, an anchor or the start, dragged to move. */
  private markPick(ctx: Ctx, c: Cell, ev: CellEvent): void {
    const ch = this.chunk(ctx)
    if (!ch) return
    if (ev === 'down') {
      const i = ch.map.portals.findIndex((p) => p.x === c.x && p.y === c.y)
      const a = Object.entries(ch.map.anchors ?? {}).find(([, [x, y]]) => x === c.x && y === c.y)?.[0]
      const st = ctx.store.game.start
      this.grab = i >= 0 ? { kind: 'portal', id: String(i), from: c, to: c } : a ? { kind: 'anchor', id: a, from: c, to: c } : st.map === ctx.map && st.x === c.x && st.y === c.y ? { kind: 'start', id: '', from: c, to: c } : undefined
      ctx.sel = i >= 0 ? { cell: c, portal: i } : { cell: c }
      return ctx.refresh()
    }
    if (!this.grab) return
    this.grab.to = c
    ctx.canvas.redraw()
    if (ev !== 'up') return
    const g = this.grab
    this.grab = undefined
    if (g.to.x !== g.from.x || g.to.y !== g.from.y) this.moveMark(ctx, g.kind, g.id, g.to)
  }

  private moveMark(ctx: Ctx, kind: string, id: string, to: Cell): void {
    if (kind === 'portal') this.edit(ctx, 'move a portal', (x) => { const p = x.map.portals[Number(id)]; if (p) (p.x = to.x), (p.y = to.y) })
    if (kind === 'anchor') this.edit(ctx, `move ${id}`, (x) => x.map.anchors && (x.map.anchors[id] = [to.x, to.y]))
    if (kind === 'start') ctx.store.change('game.json', 'the start', (g: { start: { map: string; x: number; y: number } }) => (g.start = { map: ctx.map, x: to.x, y: to.y }))
    ctx.sel = { ...ctx.sel, cell: to }
    ctx.refresh()
  }

  /** The right button: a click picks what is in the cell; a drag picks a block to paste. */
  private picker(ctx: Ctx, c: Cell, ev: CellEvent): void {
    if (ev === 'rdown') this.rpick = { from: c, to: c }
    else if (this.rpick) this.rpick.to = c
    ctx.canvas.redraw()
    if (ev !== 'rup' || !this.rpick) return
    const r = this.rpick
    this.rpick = undefined
    const ch = this.chunk(ctx)
    if (!ch) return
    if (r.from.x !== r.to.x || r.from.y !== r.to.y) {
      clipboard = this.paste = copyBlock(ch, boxOf(r.from, r.to), this.prefabs(ctx))
      toast(`Picked ${this.paste.w}×${this.paste.h}: click to lay it, Esc when done.`)
      return ctx.refresh()
    }
    if (this.layer === 'ground') {
      this.char = valueAt(ch, 'ground', c) ?? this.char
      if (!PAINTS.has(this.tool)) this.tool = 'pencil'
    } else if (this.layer === 'height') {
      this.height = Number(valueAt(ch, 'height', c) ?? 0)
      if (this.tool === 'select') this.tool = 'pencil'
    } else if (this.layer === 'things') {
      const top = this.topAt(ctx, c)
      const e = top?.kind === 'entity' ? ch.entities.find((x) => x.id === top.id) : undefined
      if (!e) return toast('No thing there to pick.', 'warn')
      this.thing = e.type
      if (this.tool === 'pick' || this.tool === 'erase') this.tool = 'put'
    }
    ctx.refresh()
  }

  /** The keyboard over the map (none while a field is being typed in). */
  keydown(ctx: Ctx, e: KeyboardEvent): boolean {
    const ch = this.chunk(ctx)
    if (!ch) return false
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (e.key === 'Escape') {
      if (this.main) return (this.main = undefined), ctx.refresh(), true
      this.paste = this.drag = this.moving = this.grab = this.rpick = this.selBox = undefined
      this.points = []
      ctx.refresh()
      return true
    }
    if (mod && k === 'c') return this.copy(ctx, ch, false)
    if (mod && k === 'x') return this.copy(ctx, ch, true)
    if (mod && k === 'v') {
      if (!clipboard) return toast('Nothing copied yet.', 'warn'), true
      this.paste = clipboard
      ctx.refresh()
      return true
    }
    if (mod && k === 'a' && (this.layer === 'ground' || this.layer === 'height')) {
      this.tool = 'select'
      this.selBox = { x: 0, y: 0, w: ch.map.width, h: ch.map.height }
      ctx.refresh()
      return true
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.layer === 'things' && ctx.sel.entity) {
        const id = ctx.sel.entity
        this.edit(ctx, `remove ${id}`, (x) => removeThings(x, [id]))
        ctx.sel = { cell: ctx.sel.cell }
        return true
      }
      if (this.selBox) {
        const b = this.selBox
        this.edit(ctx, `take away the things in ${b.w}×${b.h}`, (x) => removeThings(x, thingsIn(x, b).map((t) => t.id)))
        return true
      }
      return false
    }
    const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] as [number, number] | undefined
    if (arrow && !mod) {
      const [dx, dy] = arrow
      if (this.selBox) return this.moveSelection(ctx, { x: dx, y: dy }), true
      const c = ctx.sel.cell
      if (!c) return false
      const to = { x: c.x + dx, y: c.y + dy }
      if (this.layer === 'things' && ctx.sel.entity) return this.moveTop(ctx, 'entity', ctx.sel.entity, to), true
      if (this.layer === 'things' && ctx.sel.person) return this.moveTop(ctx, 'person', ctx.sel.person, to), true
      if (this.layer === 'marks' && ctx.sel.portal !== undefined) return this.moveMark(ctx, 'portal', String(ctx.sel.portal), to), true
      return false
    }
    if (mod || e.altKey) return false
    const t = layerOf(this.layer).tools.find(([, , , key]) => key?.toLowerCase() === k)
    if (t) return this.setTool(ctx, t[0]), true
    return false
  }

  private copy(ctx: Ctx, ch: RawChunk, cut: boolean): boolean {
    if (this.layer === 'things' && ctx.sel.entity) {
      const id = ctx.sel.entity
      clipboard = copyThing(ch, id)
      if (cut) (this.edit(ctx, `cut ${id}`, (x) => removeThings(x, [id])), (ctx.sel = { cell: ctx.sel.cell }))
      toast(`${cut ? 'Cut' : 'Copied'} ${id}: Ctrl+V, then click where it goes.`)
      return true
    }
    const b = this.selBox
    if (!b) return toast('Select a box first (the Select tool), or a thing on the Things layer.', 'warn'), true
    clipboard = copyBlock(ch, b, this.prefabs(ctx))
    if (cut) this.edit(ctx, `cut ${b.w}×${b.h}`, (x) => clearBlock(x, b, this.background(ctx, x, b), this.prefabs(ctx)))
    toast(`${cut ? 'Cut' : 'Copied'} ${b.w}×${b.h}: Ctrl+V, then click where it goes.`)
    return true
  }

  // ---------------------------------------------------------------- what is drawn over the map

  /** Something follows the pointer (a brush's square, a building's box). */
  private preview(): boolean {
    return SIZED.has(this.tool) || (this.layer === 'ground' && this.tool === 'building')
  }

  overlay(ctx: Ctx) {
    const ch = this.chunk(ctx)
    const start = ctx.store.game.start
    const onto = ctx.onto()
    const chars = ctx.store.game.terrainChars
    const colour = (c: string) => parseInt((onto.terrains[chars[c] ?? '']?.color ?? '#888888').replace('#', '').padEnd(6, '0').slice(0, 6), 16)
    const prefabs = this.prefabs(ctx)
    return (g: Phaser.GameObjects.Graphics, T: number) => {
      if (!ch) return
      const sel = ctx.sel
      const marks = this.layer === 'marks' ? 1 : 0.4
      const box = (b: Box, colour: number, alpha = 1, fill = 0) => {
        if (fill) (g.fillStyle(colour, fill), g.fillRect(b.x * T, b.y * T, b.w * T, b.h * T))
        g.lineStyle(this.layer === 'marks' ? 2 : 1, colour, alpha)
        g.strokeRect(b.x * T, b.y * T, b.w * T, b.h * T)
      }
      if (this.layer === 'height' && ch.map.heights)
        ch.map.heights.forEach((row, y) => [...row].forEach((h, x) => h !== '0' && (g.fillStyle(0xffffff, Math.min(0.6, Number(h) * 0.07)), g.fillRect(x * T, y * T, T, T))))
      for (const [, [x, y, w, h]] of Object.entries(ch.map.regions ?? {})) box({ x, y, w, h }, 0x4aa3ff, 0.8 * marks, 0.12 * marks)
      for (const [, [x, y]] of Object.entries(ch.map.anchors ?? {})) (g.fillStyle(0x3ff0e0, 0.9 * marks), g.fillCircle(x * T + T / 2, y * T + T / 2, 3))
      for (const p of ch.map.portals) (g.lineStyle(2, 0xff4fd8, 0.9 * marks), g.strokeRect(p.x * T + 1, p.y * T + 1, T - 2, T - 2))
      if (start.map === ch.map.id) (g.lineStyle(2, 0x6dff6d, marks), g.strokeCircle(start.x * T + T / 2, start.y * T + T / 2, T / 2 - 1))
      for (const [i, [px, py]] of this.points.entries()) (g.fillStyle(0xffd23f, 1), g.fillCircle(px * T + T / 2, py * T + T / 2, 3), i && (g.lineStyle(1, 0xffd23f, 0.8), g.lineBetween(this.points[i - 1][0] * T + T / 2, this.points[i - 1][1] * T + T / 2, px * T + T / 2, py * T + T / 2)))
      // a shape being dragged: its cells as they will be
      const d = this.drag
      if (d) {
        const cells = this.tool === 'ellipse' ? ellipseCells(d.from, d.to) : this.tool === 'rect' || this.tool === 'putRect' ? rectCells(d.from, d.to) : []
        const tint = this.layer === 'ground' ? colour(this.char) : 0xffffff
        for (const c of cells) (g.fillStyle(tint, 0.55), g.fillRect(c.x * T, c.y * T, T, T))
        box(boxOf(d.from, d.to), this.tool === 'room' ? 0xf0b85a : 0xffffff, 1)
      }
      if (this.rpick) box(boxOf(this.rpick.from, this.rpick.to), 0x3ff0e0, 1, 0.15)
      if (this.selBox) {
        box(this.selBox, 0xffd23f, 1, 0.08)
        const m = this.moving
        if (m) box({ ...this.selBox, x: this.selBox.x + m.to.x - m.from.x, y: this.selBox.y + m.to.y - m.from.y }, 0xffd23f, 0.7, 0.18)
      }
      if (this.grab && (this.grab.to.x !== this.grab.from.x || this.grab.to.y !== this.grab.from.y)) {
        const { from, to } = this.grab
        g.lineStyle(1, 0xffd23f, 0.8)
        g.lineBetween(from.x * T + T / 2, from.y * T + T / 2, to.x * T + T / 2, to.y * T + T / 2)
        box({ x: to.x, y: to.y, w: 1, h: 1 }, 0xffd23f, 1, 0.3)
      }
      const h = this.hover
      if (h && this.paste) {
        const b = this.paste
        if (!b.things) b.rows.forEach((row, j) => [...row].forEach((c, i) => (g.fillStyle(colour(c), 0.6), g.fillRect((h.x + i) * T, (h.y + j) * T, T, T))))
        for (const e of b.entities) if (e.place.on === 'tile') (g.fillStyle(0xffd23f, 0.9), g.fillCircle((h.x + e.place.x) * T + T / 2, (h.y + e.place.y) * T + T / 2, 3))
        box({ x: h.x, y: h.y, w: b.w, h: b.h }, 0x3ff0e0, 1)
      } else if (h && SIZED.has(this.tool) && !this.drag) {
        const cells = brushCells(h, this.size)
        box(boxOf(cells[0], cells[cells.length - 1]), this.tool === 'erase' ? 0xff6b6b : 0xffffff, 0.9)
      } else if (h && this.layer === 'ground' && this.tool === 'building' && prefabs[this.prefab]) {
        const p = prefabs[this.prefab]
        box({ x: h.x, y: h.y, w: p.tw, h: p.th }, 0xf0b85a, 1, 0.15)
        p.grid.forEach((row, j) => [...row].forEach((c, i) => c === 'D' && (g.fillStyle(0xff4fd8, 0.7), g.fillRect((h.x + i) * T + 3, (h.y + j) * T + 3, T - 6, T - 6))))
      }
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
    const chars = ctx.store.game.terrainChars
    const prefabs = this.prefabs(ctx)
    const parts: string[] = []
    if (this.selBox) {
      const b = this.selBox
      parts.push(`<h3>Selection ${b.w}×${b.h}</h3><p class="muted">at ${b.x}, ${b.y} · ${thingsIn(ch, b).length} things. Drag it, or the arrows, to move it.</p>
        <div class="row"><button id="sCopy" title="Ctrl+C">Copy</button><button id="sCut" title="Ctrl+X">Cut</button><button id="sFill" title="paint it with the ground chosen">Fill</button><button id="sThings" title="Delete">Take its things away</button></div>`)
    }
    if (c) {
      const ch2 = m.rows[c.y]?.[c.x]
      const terrain = chars[ch2 ?? '']
      const here = ch.entities.filter((e) => e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y)
      const people = ctx.store.list<PersonFile>('people').filter((p) => p.data.place.on === 'tile' && p.data.place.map === m.id && p.data.place.x === c.x && p.data.place.y === c.y)
      parts.push(`<h3>Cell ${c.x}, ${c.y}</h3>
        <p>${esc(tx(onto.terrains[terrain ?? '']?.name) || terrain)} <code>${esc(ch2)}</code> · height ${esc(m.heights?.[c.y]?.[c.x] ?? '0')}</p>
        <button id="playHere">▶ Playtest from here</button>
        <ul class="things">${here.map((e) => `<li><a data-entity="${esc(e.id)}" class="${ctx.sel.entity === e.id ? 'on' : ''}">${esc(e.id)}</a> <small>${esc(e.type)}</small></li>`).join('')}${people.map((p) => `<li><a data-person="${esc(p.data.id)}" class="${ctx.sel.person === p.data.id ? 'on' : ''}">${esc(tx(p.data.name) || p.data.id)}</a> <small>a person · <a data-person-open="${esc(p.data.id)}">open</a></small></li>`).join('')}</ul>`)
      // a door: where it leads, or the room behind it to make
      const pi = m.portals.findIndex((p) => p.x === c.x && p.y === c.y)
      if (terrain === 'door' && pi < 0) {
        const styles = Object.keys(this.catalog(ctx).rooms)
        const floors = Object.entries(chars)
        parts.push(`<div class="box"><b>A door that leads nowhere yet.</b>
          <label>the room behind it <input id="inW" type="number" min="4" max="40" value="9"> × <input id="inH" type="number" min="4" max="40" value="7"></label>
          <label>walls <select id="inStyle">${styles.map((s) => `<option ${s === this.style ? 'selected' : ''}>${esc(s)}</option>`).join('') || '<option value="wood">(none in the catalogue)</option>'}</select> floor <select id="inFloor">${floors.map(([k, id]) => `<option value="${esc(id)}" ${k === this.floor ? 'selected' : ''}>${esc(id)}</option>`).join('')}</select></label>
          <label>its name <input id="inEn" value="${esc(`${enOf(m.name)} house`)}"> <input id="inZh" placeholder="中文"></label>
          <button id="inMake">Make the room behind this door</button></div>`)
      }
      const si = stampAt(ch, prefabs, c)
      if (si !== undefined) parts.push(`<p>Building <b>${esc(m.stamps![si].key)}</b> at ${m.stamps![si].x}, ${m.stamps![si].y} <button id="stDel" class="danger">Remove it</button></p>`)
      const ri = roomAt(ch, c)
      if (ri !== undefined) parts.push(`<p>Room walls <b>${esc(m.rooms![ri].style)}</b> ${m.rooms![ri].w}×${m.rooms![ri].h} <button id="rmDel" class="danger" title="the frame's picture only: the walls stay as terrain">Remove the frame</button></p>`)
      const who = people.find((p) => p.data.id === ctx.sel.person)
      if (who) parts.push(`<div class="box"><b>${esc(tx(who.data.name) || who.data.id)}</b> <small class="muted">${esc(who.data.type)}</small><div class="row"><button data-person-open="${esc(who.data.id)}">Open in People</button><button id="pFind">Where they are used</button></div></div>`)
      const e = here.find((x) => x.id === ctx.sel.entity)
      if (e) parts.push(this.entityForm(ctx, ch, e, onto.types[e.type] ? '' : ' (no such type)'))
    }
    const pi = ctx.sel.portal
    const p = pi !== undefined ? m.portals[pi] : undefined
    if (p) parts.push(`<h3>Portal at ${p.x}, ${p.y}</h3>
      <label>to <select data-p="to">${ctx.store.maps().map((x) => `<option ${x.data.map.id === p.to ? 'selected' : ''}>${esc(x.data.map.id)}</option>`).join('')}</select> <a id="pGo">open ▸</a></label>
      <label>lands at <input data-p="tx" type="number" value="${p.tx}"> <input data-p="ty" type="number" value="${p.ty}"></label>
      <label>label <input data-p="en" value="${esc(enOf(p.label))}"> <input data-p="zh" value="${esc(zhOf(p.label))}"></label>
      <button id="pDel" class="danger">Remove the portal</button>`)
    parts.push(`<h3>Anchors</h3><ul class="things">${Object.entries(m.anchors ?? {}).map(([n, [x, y]]) => `<li><a data-anchor-go="${esc(n)}">${esc(n)}</a> <small>${x}, ${y}</small> <a data-anchor-del="${esc(n)}" class="x">✕</a></li>`).join('') || '<li class="muted">none</li>'}</ul>`)
    parts.push(`<h3>Areas</h3><ul class="things">${Object.entries(m.regions ?? {}).map(([n, [x, y, w, h]]) => `<li><a data-region-go="${esc(n)}">${esc(n)}</a> <small>${x}, ${y} · ${w}×${h}</small> <a data-region-del="${esc(n)}" class="x">✕</a></li>`).join('') || '<li class="muted">none</li>'}</ul>`)
    parts.push(mapSettings(ctx, ch))
    parts.push(`<details><summary>Size</summary><label><input id="rsW" type="number" value="${m.width}"> × <input id="rsH" type="number" value="${m.height}"></label><button id="rsGo">Resize (new cells: the first terrain)</button></details>`)
    parts.push(`<details><summary>Duplicate</summary><label>as <input id="dupId" value="${esc(nextName(ctx.store.maps().map((x) => x.data.map.id), `${m.id}_`))}"></label><button id="dupGo">Duplicate this map</button></details>`)
    parts.push(`<button id="delMap" class="danger">Delete this map</button>`)
    right.innerHTML = parts.join('')
    this.wireInspector(ctx, right, ch)
  }

  private wireInspector(ctx: Ctx, right: HTMLElement, ch: RawChunk): void {
    const m = ch.map
    const c = ctx.sel.cell
    const pi = ctx.sel.portal
    const click = (sel: string, f: (el: HTMLElement) => void) => right.querySelectorAll<HTMLElement>(sel).forEach((a) => (a.onclick = () => f(a)))
    const prefabs = this.prefabs(ctx)
    wireMapSettings(ctx, right, (why, fn) => this.edit(ctx, why, fn))
    click('[data-entity]', (a) => ((ctx.sel = { ...ctx.sel, entity: a.dataset.entity, person: undefined }), ctx.refresh()))
    click('[data-person]', (a) => ((ctx.sel = { ...ctx.sel, person: a.dataset.person, entity: undefined }), ctx.refresh()))
    click('[data-person-open]', (a) => { const f = ctx.store.list<PersonFile>('people').find((p) => p.data.id === a.dataset.personOpen)?.file; ctx.sel = { person: a.dataset.personOpen }; ctx.open('people', f) })
    click('#pFind', () => ctx.sel.person && ctx.open('find', '', ctx.sel.person))
    click('#playHere', () => c && void ctx.playtest({ map: m.id, ...c }))
    const box = () => this.selBox!
    click('#sCopy', () => this.copy(ctx, ch, false))
    click('#sCut', () => this.copy(ctx, ch, true))
    click('#sFill', () => this.edit(ctx, `fill ${box().w}×${box().h}`, (x) => paint(x, 'ground', rectCells(box(), { x: box().x + box().w - 1, y: box().y + box().h - 1 }), this.char)))
    click('#sThings', () => this.edit(ctx, 'take the things away', (x) => removeThings(x, thingsIn(x, box()).map((t) => t.id))))
    click('#stDel', () => c && this.edit(ctx, 'remove a building', (x) => { const i = stampAt(x, prefabs, c); const s = i !== undefined ? x.map.stamps![i] : undefined; if (s) removeStamp(x, prefabs, i!, this.background(ctx, x, { x: s.x, y: s.y, w: prefabs[s.key]?.tw ?? 1, h: prefabs[s.key]?.th ?? 1 })) }))
    click('#rmDel', () => c && this.edit(ctx, 'remove a room\'s frame', (x) => { const i = roomAt(x, c); if (i !== undefined) x.map.rooms!.splice(i, 1); if (!x.map.rooms?.length) delete x.map.rooms }))
    click('#inMake', () => c && this.makeInterior(ctx, right, c))
    this.wireEntity(ctx, right)
    right.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-p]').forEach((el) => (el.onchange = () => this.edit(ctx, 'the portal', (x) => {
      const q = x.map.portals[pi!] as Portal
      const k = el.dataset.p!
      if (k === 'to') q.to = el.value
      else if (k === 'tx' || k === 'ty') q[k] = Number(el.value)
      else { const en = k === 'en' ? el.value : enOf(q.label), zh = k === 'zh' ? el.value : zhOf(q.label); q.label = en ? textOf(en, zh) : undefined }
    })))
    click('#pGo', () => { const p = m.portals[pi!]; if (p) (ctx.showMap(p.to, { x: p.tx, y: p.ty }), (ctx.sel = { cell: { x: p.tx, y: p.ty } }), ctx.canvas.scene.lookAt(p.tx, p.ty), ctx.refresh()) })
    click('#pDel', () => (this.edit(ctx, 'remove a portal', (x) => x.map.portals.splice(pi!, 1)), (ctx.sel = { cell: c })))
    click('[data-anchor-go]', (a) => { const at = m.anchors?.[a.dataset.anchorGo!]; if (at) (ctx.sel = { cell: { x: at[0], y: at[1] } }), ctx.canvas.scene.lookAt(at[0], at[1]), ctx.refresh() })
    click('[data-region-go]', (a) => { const r = m.regions?.[a.dataset.regionGo!]; if (r) (ctx.canvas.scene.lookAt(r[0] + Math.floor(r[2] / 2), r[1] + Math.floor(r[3] / 2)), ctx.canvas.redraw()) })
    click('[data-anchor-del]', (a) => this.edit(ctx, 'remove an anchor', (x) => delete x.map.anchors?.[a.dataset.anchorDel!]))
    click('[data-region-del]', (a) => this.edit(ctx, 'remove an area', (x) => delete x.map.regions?.[a.dataset.regionDel!]))
    click('#rsGo', () => this.resize(ctx, Number(right.querySelector<HTMLInputElement>('#rsW')!.value), Number(right.querySelector<HTMLInputElement>('#rsH')!.value)))
    click('#dupGo', () => {
      const id = right.querySelector<HTMLInputElement>('#dupId')!.value.trim()
      if (!validId(id)) return toast('A map\'s id: lower case letters, digits, - and _.', 'warn')
      if (ctx.store.mapFile(id)) return toast(`There is a map ${id} already.`, 'warn')
      ctx.store.add(`maps/${id}.json`, duplicateMap(ch, id, textOf(`${enOf(m.name)} (copy)`, zhOf(m.name) ? `${zhOf(m.name)}（副本）` : ''), this.taken(ctx)), `duplicate ${m.id} as ${id}`)
      ctx.showMap(id)
    })
    click('#delMap', () => {
      if (!confirm(`Delete the map ${m.id}? (Undo brings it back; Save deletes its file.)`)) return
      const f = this.file(ctx)!
      ctx.store.remove(f, `delete ${m.id}`)
      const next = ctx.store.maps()[0]?.data.map.id
      if (next) ctx.showMap(next)
    })
  }

  /** The interior behind the selected door: a new map, a portal each way; then the new map shown. */
  private makeInterior(ctx: Ctx, right: HTMLElement, door: Cell): void {
    const v = (id: string) => right.querySelector<HTMLInputElement>(id)!.value.trim()
    const id = nextName(ctx.store.maps().map((x) => x.data.map.id), `${ctx.map}_room`)
    const spec = { id, name: textOf(v('#inEn') || id, v('#inZh')), w: Number(v('#inW')) || 9, h: Number(v('#inH')) || 7, style: v('#inStyle') || 'wood', floor: v('#inFloor') || 'floor', music: this.catalog(ctx).music.interior ? 'interior' : undefined }
    let inner: RawChunk | undefined
    this.edit(ctx, `the room behind ${door.x}, ${door.y}`, (ch) => (inner = interiorBehind(ch, door, spec, ctx.store.game.terrainChars)))
    if (!inner) return
    ctx.store.add(`maps/${id}.json`, inner, `a new interior ${id}`)
    toast(`${id}: the room behind the door, a portal each way.`)
    ctx.showMap(id)
    ctx.sel = { cell: { x: Math.floor(inner.map.width / 2), y: inner.map.height - 2 } }
    ctx.refresh()
  }

  private entityForm(ctx: Ctx, ch: RawChunk, e: Entity, warn: string): string {
    const held = ch.entities.filter((x) => (x.place.on === 'inside' || x.place.on === 'hand') && x.place.holder === e.id)
    const counts = new Map<string, number>()
    for (const h of held) counts.set(h.type, (counts.get(h.type) ?? 0) + 1)
    const own = ctx.onto().types[e.type]?.own === e.id
    return `<h3>${esc(e.id)}${esc(warn)}</h3>
      <div class="row"><button id="eKind" title="its kind's fields and the rules on it (a double click on the map)">Its kind</button><button id="eOwn" title="a child type for this one thing: rules written for it are its behaviour alone">${own ? 'Its rules' : 'A kind of its own'}</button><button id="eFind">Where it is used</button></div>
      <label>type <input data-e="type" value="${esc(e.type)}"></label>
      <label>name <input data-e="en" value="${esc(enOf(e.name))}"> <input data-e="zh" value="${esc(zhOf(e.name))}"></label>
      <label>at <input data-e="x" type="number" value="${e.place.on === 'tile' ? e.place.x : ''}"> <input data-e="y" type="number" value="${e.place.on === 'tile' ? e.place.y : ''}"></label>
      <label>tags <input data-e="tags" value="${esc((e.tags ?? []).join(', '))}"></label>
      <label>props <textarea data-e="props" rows="3">${esc(e.props ? JSON.stringify(e.props) : '')}</textarea></label>
      ${e.ai ? `<label>behaviour <textarea data-e="ai" rows="3">${esc(JSON.stringify(e.ai))}</textarea></label>` : ''}
      <details ${held.length ? 'open' : ''}><summary>What it holds (${held.length})</summary><ul class="things">${[...counts].map(([t, n]) => `<li>${n} × ${esc(t)} <a data-hold-del="${esc(t)}" class="x" title="one fewer">−</a><a data-hold-add="${esc(t)}" class="x" title="one more">+</a></li>`).join('')}</ul>
        <input id="eHoldAdd" list="dlHoldKinds" placeholder="+ a kind in it"><datalist id="dlHoldKinds">${Object.keys(ctx.onto().types).filter((t) => t.startsWith('item/')).map((t) => `<option value="${esc(t)}">`).join('')}</datalist></details>
      <button id="eDel" class="danger" title="Delete">Remove ${esc(e.id)}</button>`
  }

  /** A thing's own kind (E-b): a child type of its type made for it, the thing moved to it, a first rule for it (not for a person: theirs is their talk). */
  private ownKind(ctx: Ctx, id: string): void {
    const ch = this.chunk(ctx)
    const e = ch?.entities.find((x) => x.id === id)
    if (!e) return
    const onto = ctx.onto()
    if (onto.types[e.type]?.own !== e.id) {
      const type = ownKindId(e, onto.types)
      const name = e.name ?? textOf(`${tx(onto.types[e.type]?.name) || e.type.split('/').pop()} (${e.id})`, '')
      ctx.store.batch(`${e.id}: a kind of its own`, () => {
        setEntry(ctx.store, 'types', { id: type, name, own: e.id } as never, `the kind ${type}`)
        this.edit(ctx, `${e.id} is a ${type}`, (x) => { const t = x.entities.find((y) => y.id === id); if (t) t.type = type })
      })
      toast(`${e.id} is now its own kind, ${type}: the rules written for it are its behaviour alone.`)
      if (!type.startsWith('actor/')) rulesMode.startWith(ctx, ownKindRule(type, name))
      else rulesMode.filterBy(type)
      return ctx.open('rules')
    }
    const rule = [...ctx.store.list<Rule[]>('rules').flatMap((f) => f.data)].find((r) => r.host?.type === e.type)
    if (rule) return ctx.open('rules', '', rule.id)
    if (!e.type.startsWith('actor/')) rulesMode.startWith(ctx, ownKindRule(e.type, e.name ?? e.id))
    else rulesMode.filterBy(e.type)
    ctx.open('rules')
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
    right.querySelector<HTMLButtonElement>('#eDel')?.addEventListener('click', () => (this.edit(ctx, `remove ${id}`, (ch) => removeThings(ch, [id])), (ctx.sel = { cell: ctx.sel.cell })))
    const type = this.chunk(ctx)?.entities.find((x) => x.id === id)?.type
    right.querySelector<HTMLButtonElement>('#eKind')?.addEventListener('click', () => type && ctx.open('database', '', type))
    right.querySelector<HTMLButtonElement>('#eOwn')?.addEventListener('click', () => this.ownKind(ctx, id))
    right.querySelector<HTMLButtonElement>('#eFind')?.addEventListener('click', () => ctx.open('find', '', id))
    const hold = (t: string, more: boolean) => this.edit(ctx, `${more ? 'one more' : 'one fewer'} ${t} in ${id}`, (ch) => {
      if (more) return void ch.entities.push(...contents(id, ch.map.id, [{ type: t, count: 1 }], this.taken(ctx)))
      const last = [...ch.entities].reverse().find((x) => x.type === t && (x.place.on === 'inside' || x.place.on === 'hand') && x.place.holder === id)
      if (last) removeThings(ch, [last.id])
    })
    right.querySelectorAll<HTMLElement>('[data-hold-add]').forEach((a) => (a.onclick = () => hold(a.dataset.holdAdd!, true)))
    right.querySelectorAll<HTMLElement>('[data-hold-del]').forEach((a) => (a.onclick = () => hold(a.dataset.holdDel!, false)))
    const add = right.querySelector<HTMLInputElement>('#eHoldAdd')
    if (add) add.onchange = () => add.value.trim() && hold(add.value.trim(), true)
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
      const gone = ch.entities.filter((e) => e.place.on === 'tile' && (e.place.x >= w || e.place.y >= h)).map((e) => e.id)
      removeThings(ch, gone)
    })
  }

  focus(ctx: Ctx, file: string, at?: string): void {
    const m = ctx.store.get<RawChunk>(file)
    if (!m) return
    this.main = undefined
    ctx.showMap(m.map.id)
    const e = at && m.entities.find((x) => x.id === at)
    if (e && e.place.on === 'tile') (this.layer = 'things'), (ctx.sel = { cell: { x: e.place.x, y: e.place.y }, entity: e.id }), ctx.canvas.scene.lookAt(e.place.x, e.place.y)
    const cell = at?.match(/rows\[(\d+)\]/)
    if (cell) ctx.canvas.scene.lookAt(0, Number(cell[1]))
  }
}

/** A stroke's seed: shown to the author, kept in the map's strokes. */
const newSeed = () => Math.floor(Math.random() * 1e6)
const validId = (id: string) => /^[a-z][a-z0-9_-]*$/.test(id)
/** A name not yet taken: the base and the first number free. */
function nextName(taken: string[], base: string): string {
  for (let n = 1; ; n++) if (!taken.includes(`${base}${n}`)) return `${base}${n}`
}
