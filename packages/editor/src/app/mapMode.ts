// The map (docs/engine-split.md §6, §16 E1; RPG Maker's map and tiles, used as RPG Maker is used). Four layers —
// the ground, its height, the things on it, and the marks (portals, anchors, areas, the start). Each layer's tools
// are a strip of icons beside the map (mapTools.ts): select, a brush whose shape (free, a rectangle, an ellipse, a
// fill) and size are chosen in the bar above the map, an eraser, an eyedropper, and the templates that lay a whole
// piece (a building from the catalogue, a room's walls, the builder's path and patch, quick events, things
// scattered, a yard). What is laid is chosen on the left, by kind, above the maps; the right shows the cell and
// what is selected, and the map's own settings open in a dialog. The right button picks what is under it
// (dragged: a block to stamp); things are dragged to move and nudged with the arrows. Every stroke is the format's
// data: a map file's rows, heights, stamps, rooms, portals, anchors, regions and entities (mapEdit.ts).

import { OntologyIndex, type Entity, type Portal, type RawChunk, type Rule } from '@openworld/engine'
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
import { icon } from './icons.ts'
import { MAX_HEIGHT, cliffs, heightCss, heightHex, heightWords, sculpt, type HeightMode } from './heights.ts'
import { LAYERS, groupOf, layerOf, terrainPalette, toolDef, toolForKey, type LayerId, type Tool, type TerrainGroup } from './mapTools.ts'
import { phrase } from './lang.ts'
import { esc, parseValue, t, textField, toast, tx } from './ui.ts'
import { adoptTexts, shown, together, written } from './words.ts'
import { modal } from './dialogs.ts'

/** What can be set down: the kinds of things the inputs and the world handle. */
const PLACEABLE = /^(fixture|item|actor\/creature|structure)\//
/** Tools that paint the chosen ground (the eyedropper leaves them as they are). */
const PAINTS = new Set<Tool>(['pencil', 'rect', 'ellipse', 'fill', 'path', 'organic'])
const SIZED = new Set<Tool>(['pencil', 'erase'])

/** What was copied last (any map's): a block, or a thing alone. */
let clipboard: Block | undefined

export class MapMode implements Mode {
  id = 'map'
  label = phrase('Map')
  private layer: LayerId = 'ground'
  private tools: Record<LayerId, Tool> = { ground: 'pencil', height: 'pencil', things: 'pick', marks: 'mark' }
  private char = '.'
  private height = 0
  private thing = ''
  private filter = ''
  /** How the height brush paints (raising and lowering by default: the way terrain is shaped), and the cells a stroke raised. */
  private heightMode: HeightMode = 'raise'
  private sculpted = new Set<string>()
  /** The map's properties dialog, while it is open. */
  private props?: { el: HTMLElement; close(): void }
  private mapFilter = ''
  /** The ground palette's group opened (else the chosen ground's). */
  private terrainGroup?: TerrainGroup
  /** Each group's tool last used (a group's icon gives it back). */
  private last: Partial<Record<string, Tool>> = {}
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
    const parts: string[] = []
    // what is laid, by kind, above; the maps below (each part scrolls by itself)
    parts.push(`<div class="lp-top"><div class="layers">${LAYERS.map((l) => `<button data-layer="${l.id}" class="${l.id === this.layer ? 'on' : ''}" title="${esc(t(l.tip))}">${t(l.label)}</button>`).join('')}</div>`)
    if (this.paste) parts.push(`<p class="pasting">${t('Pasting a block {w}×{h}: click where its top left goes.', { w: this.paste.w, h: this.paste.h })} <a id="pasteOff">${t('Done (Esc)')}</a></p>`)
    if (this.layer === 'ground' && this.tool === 'building') {
      const keys = Object.keys(cat.prefabs).sort()
      for (const k of keys) pics.set(`pf:${k}`, prefabPic(cat, k))
      parts.push(`<h3>${t('Buildings')}</h3>${keys.length ? `<div class="palette grid">${keys.map((k) => `<button data-prefab="${esc(k)}" class="pic ${k === this.prefab ? 'on' : ''}" title="${esc(k)}"><canvas data-pic="pf:${esc(k)}" width="48" height="48"></canvas><small>${esc(k)}</small></button>`).join('')}</div>` : `<p class="muted">${t('The catalogue has no buildings: cut one from a picture in the Assets mode (Buildings).')}</p>`}`)
    } else if (this.layer === 'ground' && this.tool === 'room') {
      parts.push(`<h3>${t('Room')}</h3>${Object.keys(cat.rooms).length ? `<label>${t('walls')} <select id="roomStyle">${Object.keys(cat.rooms).map((s) => `<option ${s === this.style ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>` : `<p class="muted">${t('The catalogue has no room walls (Assets mode, Rooms): the walls are drawn as their terrain.')}</p>`}<label>${t('floor')} <select id="roomFloor">${chars.map(([c, id]) => `<option value="${esc(c)}" ${c === this.floor ? 'selected' : ''}>${esc(shown(onto.terrains[id]?.name) || id)}</option>`).join('')}</select></label>`)
    } else if (this.layer === 'ground') parts.push(this.groundPalette(ctx, chars, pics))
    if (this.layer === 'height') parts.push(this.heightPanel())
    const quick = this.layer === 'things' && this.tool === 'quick' ? new Form() : undefined
    if (quick) parts.push(this.quick.panel(ctx, quick, () => ctx.refresh()))
    else if (this.layer === 'things') parts.push(this.thingPalette(ctx, pics))
    if (this.layer === 'marks' && (this.tool === 'anchor' || this.tool === 'region')) parts.push(`<label>${t('its name')} <input id="markName" value="${esc(this.markName)}" placeholder="${this.tool === 'anchor' ? t('well (or the next spot)') : t('square (or the next area)')}"></label>`)
    if (this.layer === 'marks') parts.push(`<p class="muted">${t('Portals, anchors and areas are drawn over the map; choose one with Select to change it on the right.')}</p>`)
    parts.push(`</div><div class="lp-maps"><h3>${t('Maps')} <small class="muted">${ctx.store.maps().length}</small> <a id="mOverview" class="x" title="${t('every map, laid out by its edges, its portals\' lines')}">${t('world ▸')}</a></h3>
      <input id="mapFilter" placeholder="${t('find a map by its name or id')}" value="${esc(this.mapFilter)}">
      <div class="lp-tree">${mapTree(ctx)}</div>
      <details><summary>${t('New map')}</summary>
        <label>${t('id')} <input id="nmId" placeholder="meadow"></label>
        <label>${t('name')} <input id="nmName"></label>
        <label>${t('size')} <input id="nmW" type="number" value="24" min="4" max="200"> × <input id="nmH" type="number" value="16" min="4" max="200"></label>
        <label>${t('ground')} <select id="nmFill">${chars.map(([c, id]) => `<option value="${esc(c)}">${esc(shown(onto.terrains[id]?.name) || id)}</option>`).join('')}</select></label>
        <button id="nmMake">${t('Make the map')}</button>
      </details></div>`)
    left.innerHTML = parts.join('')
    if (quick) {
      quick.wire(left)
      left.querySelectorAll<HTMLElement>('[data-quick]').forEach((b) => (b.onclick = () => ((this.quick.kind = b.dataset.quick as QuickKind), ctx.refresh())))
    }
    paintPics(left, ctx.store.id, pics)
    paintMinis(ctx, left)
    this.wireLeft(ctx, left)
    this.filterMaps(left)
    this.inspector(ctx, right)
    ctx.canvas.dim(this.layer === 'things' ? { ground: 0.55 } : this.layer === 'marks' ? { ground: 0.8, things: 0.6 } : { things: 0.45 })
  }

  /** The height to paint: a slider over the levels, the horizon marked, a side view of where it stands, its colour on the map. */
  private heightPanel(): string {
    const ticks = Array.from({ length: MAX_HEIGHT + 1 }, (_, h) => h)
    return `<h3>${t('Height')}</h3>
      <ol class="howto">
        <li>${t('Choose the brush and <b>Raise ½</b> (above the map), and paint where the ground should rise: once is half a level, twice a whole level.')}</li>
        <li>${t('Half a level between neighbours is a slope one walks up; a whole level or more is a cliff (a red line on the map): no one climbs it, and a fall from it can hurt.')}</li>
        <li>${t('In the game higher ground is drawn lighter, a cliff with its rock face and shadow; it also hides what is behind it.')}</li>
        <li>${t('<b>Lower ½</b> takes it down again; to paint one exact height, choose it below (Set to).')}</li>
      </ol>
      <div class="hgt">
        <div class="hgt-now"><b id="hNum">${this.height}</b><span id="hWords">${esc(heightWords(this.height))}</span></div>
        <input id="hRange" type="range" min="0" max="${MAX_HEIGHT}" step="1" value="${this.height}" title="${t('[ lower, ] higher')}">
        <div class="hgt-ticks">${ticks.map((h) => `<span class="${h % 2 ? '' : 'lv'}" style="--c:${heightCss(h)}">${h === 0 ? t('horizon') : h}</span>`).join('')}</div>
        <canvas id="hSide" width="220" height="86"></canvas>
      </div>
      <p class="muted">${t('0 is the horizon, the ground every map stands on; 2 is a whole level.')}</p>`
  }

  /** The side view: a step for each height, the horizon's line, the one chosen lit. */
  private drawSide(left: HTMLElement): void {
    const cv = left.querySelector<HTMLCanvasElement>('#hSide')
    const g = cv?.getContext('2d')
    if (!cv || !g) return
    const n = MAX_HEIGHT + 1
    const w = cv.width / n
    const unit = 6
    const base = cv.height - 16
    g.clearRect(0, 0, cv.width, cv.height)
    for (let h = 0; h < n; h++) {
      g.fillStyle = h === this.height ? '#f0b85a' : h ? heightCss(h) : '#3a4256'
      g.globalAlpha = h === this.height ? 1 : 0.55
      g.fillRect(h * w + 1, base - h * unit, w - 2, h * unit + 6)
    }
    g.globalAlpha = 1
    // the horizon, and each whole level above it
    for (let lv = 0; lv <= MAX_HEIGHT; lv += 2) {
      g.strokeStyle = lv ? '#ffffff22' : '#8cc4ff'
      g.setLineDash(lv ? [2, 3] : [])
      g.beginPath()
      g.moveTo(0, base - lv * unit + 0.5)
      g.lineTo(cv.width, base - lv * unit + 0.5)
      g.stroke()
    }
    g.setLineDash([])
    g.fillStyle = '#8cc4ff'
    g.font = '11px sans-serif'
    g.fillText(t('horizon'), 2, base + 14)
  }

  private setHeight(ctx: Ctx, h: number): void {
    this.height = Math.max(0, Math.min(MAX_HEIGHT, h))
    this.heightMode = 'set'
    if (!PAINTS.has(this.tool)) return this.setTool(ctx, this.last['height:brush'] ?? 'pencil')
    ctx.refresh()
  }

  /** The ground's terrains in their groups, one group shown at a time (the chosen ground's, until another is opened). */
  private groundPalette(ctx: Ctx, chars: [string, string][], pics: Map<string, Pic | undefined>): string {
    const onto = ctx.onto()
    const cat = this.catalog(ctx)
    const groups = terrainPalette(chars, onto.terrains, this.chunk(ctx)?.map ?? {})
    if (!groups.length) return ''
    const mine = groups.find((g) => g.chars.some(([c]) => c === this.char))?.group
    const open = groups.find((g) => g.group === this.terrainGroup) ?? groups.find((g) => g.group === mine) ?? groups[0]
    for (const [, id] of open.chars) pics.set(`t:${id}`, terrainPic(cat, id))
    return `<div class="cats">${groups.map((g) => `<button data-tgroup="${g.group}" class="${g === open ? 'on' : ''}">${t(g.label)} <small>${g.chars.length}</small></button>`).join('')}</div>
      <div class="palette grid">${open.chars.map(([c, id]) => `<button data-char="${esc(c)}" class="pic ${c === this.char ? 'on' : ''}" title="${esc(shown(onto.terrains[id]?.name) || id)} (${esc(c)}) · ${t('right-click on the map picks one')}"><canvas data-pic="t:${esc(id)}" width="32" height="32" style="background:${esc(onto.terrains[id]?.color ?? '#555')}"></canvas><small>${esc(shown(onto.terrains[id]?.name) || id)}</small></button>`).join('')}</div>`
  }

  /** The strip of tools beside the map, and the chosen tool's choices in the bar above it. */
  toolbar(ctx: Ctx, strip: HTMLElement, bar: HTMLElement): void {
    const L = layerOf(this.layer)
    const g = groupOf(this.layer, this.tool)
    strip.innerHTML = L.groups.map((x) => `<button data-group="${x.id}" class="ib ${x === g ? 'on' : ''}" title="${esc(t(x.label))} (${x.key}): ${esc(t(x.tip))}" aria-label="${esc(t(x.label))}">${icon(x.icon)}<small>${x.key}</small></button>`).join('')
    const parts: string[] = []
    if (this.layer === 'height' && g.id === 'brush') parts.push(`<div class="seg">${([['raise', t('Raise ½')], ['lower', t('Lower ½')], ['set', t('Set to {h}', { h: this.height })]] as [HeightMode, string][]).map(([m, n]) => `<button data-hmode="${m}" class="${m === this.heightMode ? 'on' : ''}">${n}</button>`).join('')}</div>`)
    if (g.tools.length > 1) parts.push(`<div class="seg">${g.tools.map((x) => `<button data-tool="${x.id}" class="${x.id === this.tool ? 'on' : ''}" title="${esc(t(x.tip))}${x.key ? ` (${x.key})` : ''}">${x.icon ? icon(x.icon, 16) : ''}${t(x.label)}</button>`).join('')}</div>`)
    if (SIZED.has(this.tool)) parts.push(`<span class="lab">${t('size')}</span><div class="seg">${[1, 2, 3, 4, 5].map((n) => `<button data-size="${n}" class="${n === this.size ? 'on' : ''}">${n}</button>`).join('')}</div>`)
    parts.push(this.brushOptions(Object.entries(ctx.store.game.terrainChars)))
    parts.push(`<span class="hint">${esc(t(toolDef(this.layer, this.tool)?.tip ?? ''))}</span>`)
    bar.innerHTML = parts.join('')
    const on = (root: HTMLElement, sel: string, f: (b: HTMLElement) => void) => root.querySelectorAll<HTMLElement>(sel).forEach((b) => (b.onclick = () => f(b)))
    on(strip, '[data-group]', (b) => { const x = L.groups.find((y) => y.id === b.dataset.group)!; this.setTool(ctx, this.last[`${this.layer}:${x.id}`] ?? x.tools[0].id) })
    on(bar, '[data-tool]', (b) => this.setTool(ctx, b.dataset.tool as Tool))
    on(bar, '[data-size]', (b) => ((this.size = Number(b.dataset.size)), ctx.refresh()))
    on(bar, '[data-hmode]', (b) => ((this.heightMode = b.dataset.hmode as HeightMode), ctx.refresh()))
    this.wireBrush(ctx, bar)
  }

  /** The maps' list narrowed as one types (no drawing again: the field keeps its place). */
  private filterMaps(left: HTMLElement): void {
    const f = left.querySelector<HTMLInputElement>('#mapFilter')
    if (!f) return
    const apply = () => {
      const q = f.value.trim().toLowerCase()
      this.mapFilter = f.value
      left.querySelectorAll<HTMLElement>('[data-map]').forEach((b) => (b.hidden = !!q && !(b.dataset.map!.toLowerCase().includes(q) || (b.textContent ?? '').toLowerCase().includes(q))))
      left.querySelectorAll<HTMLDetailsElement>('details.group').forEach((d) => {
        const any = [...d.querySelectorAll<HTMLElement>('[data-map]')].some((b) => !b.hidden)
        d.hidden = !any
        if (q && any) d.open = true
      })
    }
    f.oninput = apply
    apply()
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
    // kinds drawn by one picture (the pack has fewer pictures than the world has kinds): told apart by their names, and said
    const idx = new OntologyIndex(onto)
    const spriteOf = (k: string) => idx.resolve(k).sprite ?? ''
    const bySprite = new Map<string, number>()
    for (const k of things) bySprite.set(spriteOf(k), (bySprite.get(spriteOf(k)) ?? 0) + 1)
    const name = (k: string) => shown(onto.types[k]?.name) || k.split('/').pop()!
    return `<h3>${t('Kinds of things')}</h3><input id="thingFilter" placeholder="${t('filter kinds')}" value="${esc(this.filter)}">
      <div class="palette list things-pal">${[...groups].map(([g, ts]) => `<details ${f || ts.includes(this.thing) || things.length <= 40 ? 'open' : ''}><summary>${esc(shown(onto.types[g]?.name) || g)} <small class="muted">${ts.length}</small></summary><div class="palette rows">${ts.map((k) => { const same = (bySprite.get(spriteOf(k)) ?? 1) - 1; return `<button data-thing="${esc(k)}" class="pic-row ${k === this.thing ? 'on' : ''}" title="${esc(k)}"><canvas data-pic="ty:${esc(k)}" width="32" height="32"></canvas><span>${esc(name(k))}<small>${esc(k.split('/').slice(2).join('/') || k)}${same ? ` · ${t('one picture with {n} others', { n: same })}` : ''}</small></span></button>` }).join('')}</div></details>`).join('')}</div>`
  }

  private brushOptions(chars: [string, string][]): string {
    const opt = (cur: string, none: string) => `<option value="">${none}</option>${chars.map(([c, id]) => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(id)}</option>`).join('')}`
    if (this.layer === 'ground' && this.tool === 'path') return `<p class="muted">${this.points.length === 1 ? t('{n} point', { n: 1 }) : t('{n} points', { n: this.points.length })}</p><label>${t('width')} <input id="bWidth" type="number" min="1" max="6" value="${this.width}"></label><label>${t('frayed with')} <select id="bEdge">${opt(this.edge, t('nothing'))}</select></label><button id="bLay" ${this.points.length ? '' : 'disabled'}>${t('Lay the path')}</button> <button id="bClear">${t('Clear the points')}</button>`
    if (this.layer === 'ground' && this.tool === 'organic') return `<label>${t('rough')} <input id="bRough" type="number" step="0.05" min="0" max="0.6" value="${this.rough}"></label><label>${t('only over')} <select id="bOnly">${opt(this.only, t('anything'))}</select></label>`
    if (this.layer === 'things' && this.tool === 'scatter') return `<label>${t('chance a cell')} <input id="bDensity" type="number" step="0.05" min="0.01" max="1" value="${this.density}"></label><label>${t('only on')} <select id="bOnly">${opt(this.only, t('any ground'))}</select></label>`
    if (this.layer === 'things' && this.tool === 'yard') return `<p class="muted">${t('Choose its fence (a fixture) below, then drag the yard\'s box.')}</p>`
    return ''
  }

  private wireLeft(ctx: Ctx, left: HTMLElement): void {
    const on = (sel: string, f: (b: HTMLElement) => void) => left.querySelectorAll<HTMLElement>(sel).forEach((b) => (b.onclick = () => f(b)))
    on('[data-layer]', (b) => this.setLayer(ctx, b.dataset.layer as LayerId))
    on('[data-tgroup]', (b) => ((this.terrainGroup = b.dataset.tgroup as TerrainGroup), ctx.refresh()))
    // a ground or a kind chosen: the brush paints it (unless a tool that uses it is in hand)
    on('[data-char]', (b) => ((this.char = b.dataset.char!), !PAINTS.has(this.tool) && this.setTool(ctx, this.last['ground:brush'] ?? 'pencil'), ctx.refresh()))
    // the height slider: its words and side view follow as it is dragged; let go, the brush is in hand
    const range = left.querySelector<HTMLInputElement>('#hRange')
    if (range) {
      this.drawSide(left)
      range.oninput = () => {
        this.height = Number(range.value)
        left.querySelector('#hNum')!.textContent = String(this.height)
        left.querySelector('#hWords')!.textContent = heightWords(this.height)
        this.drawSide(left)
      }
      range.onchange = () => this.setHeight(ctx, Number(range.value))
    }
    on('[data-thing]', (b) => ((this.thing = b.dataset.thing!), ['pick', 'erase', 'eyedrop'].includes(this.tool) && this.setTool(ctx, this.last['things:brush'] ?? 'put'), ctx.refresh()))
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
  }

  /** A template's own choices, in the bar: a path's width and edge, a patch's roughness, scattering's chance. */
  private wireBrush(ctx: Ctx, bar: HTMLElement): void {
    const sel = (id: string, f: (v: string) => void) => { const el = bar.querySelector<HTMLSelectElement | HTMLInputElement>(id); if (el) el.onchange = () => f(el.value) }
    const num = (id: string, f: (v: number) => void) => { const el = bar.querySelector<HTMLInputElement>(id); if (el) el.onchange = () => f(Number(el.value)) }
    num('#bWidth', (v) => (this.width = Math.max(1, Math.min(6, v || 2))))
    num('#bRough', (v) => (this.rough = Math.max(0, Math.min(0.6, v))))
    num('#bDensity', (v) => (this.density = Math.max(0.01, Math.min(1, v || 0.15))))
    sel('#bEdge', (v) => (this.edge = v))
    sel('#bOnly', (v) => (this.only = v))
    bar.querySelector<HTMLButtonElement>('#bClear')?.addEventListener('click', () => ((this.points = []), ctx.refresh()))
    bar.querySelector<HTMLButtonElement>('#bLay')?.addEventListener('click', () => {
      const seed = newSeed()
      this.edit(ctx, t('a path (seed {seed})', { seed }), (ch) => paintPath(ch, this.points, this.char, seed, { width: this.width, ...(this.edge && { edge: this.edge }) }))
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
    this.last[`${this.layer}:${groupOf(this.layer, t).id}`] = t
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
    if (!validId(id)) return toast(t('A map\'s id: lower case letters, digits, - and _.'), 'warn')
    if (ctx.store.mapFile(id)) return toast(t('There is a map {id} already.', { id }), 'warn')
    const w = Math.max(4, Math.min(200, Number(v('#nmW')) || 24))
    const h = Math.max(4, Math.min(200, Number(v('#nmH')) || 16))
    const fill = left.querySelector<HTMLSelectElement>('#nmFill')!.value
    const chunk: RawChunk = { map: { id, name: v('#nmName').trim() || id, kind: 'wild', width: w, height: h, rows: Array.from({ length: h }, () => fill.repeat(w)), portals: [], anchors: {}, regions: {}, light: 'outdoor', zone: 'peaceful' }, entities: [] }
    ctx.store.add(`maps/${id}.json`, chunk, t('a new map {id}', { id }))
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
      this.edit(ctx, t('paste {w}×{h}', { w: b.w, h: b.h }), (ch) => pasteBlock(ch, b, c, this.taken(ctx), this.prefabs(ctx)))
      return
    }
    const ground = this.layer === 'ground'
    const layer = ground ? 'ground' : 'height'
    const value = ground ? this.char : String(this.height)
    // the height brush raising or lowering: each cell once a stroke, by half a level
    const shape = !ground && this.layer === 'height' && this.heightMode !== 'set' ? (this.heightMode as 'raise' | 'lower') : undefined
    if (shape && (this.tool === 'pencil' || this.tool === 'fill')) {
      if (ev === 'down') this.sculpted = new Set()
      if (ev === 'up' || (this.tool === 'fill' && ev !== 'down')) return
      const why = shape === 'raise' ? t('raise the ground') : t('lower the ground')
      return this.edit(ctx, why, (ch) => sculpt(ch, this.tool === 'fill' ? floodCells(ch, 'height', c) : brushCells(c, this.size), shape, this.sculpted), s)
    }
    switch (this.tool) {
      case 'pencil':
        return this.edit(ctx, t('paint {value}', { value }), (ch) => paint(ch, layer, brushCells(c, this.size), value), s)
      case 'fill':
        if (ev !== 'down') return
        return this.edit(ctx, t('fill {value}', { value }), (ch) => paint(ch, layer, floodCells(ch, layer, c), value))
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
        if (!p) return toast(t('Choose a building first (or cut one in the Assets mode).'), 'warn')
        let door: Cell | undefined
        this.edit(ctx, t('the building {key}', { key: this.prefab }), (ch) => (door = stampBuilding(ch, this.prefab, p, c, ctx.store.game.terrainChars)))
        if (door) (ctx.sel = { cell: door }), toast(t('Its door is selected: make the room behind it on the right.')), ctx.refresh()
        return
      }
      case 'path':
        if (ev === 'down') (this.points.push([c.x, c.y]), ctx.refresh())
        return
      case 'pick':
        return this.pick(ctx, c, ev)
      case 'eyedrop':
        if (ev === 'down') this.pickAt(ctx, c)
        return
      case 'quick':
        if (ev === 'down') void this.quick.place(ctx, c).then((sel) => sel && ((ctx.sel = { cell: c, ...sel }), ctx.refresh()))
        return
      case 'put': {
        if (!this.thing) return ev === 'down' ? toast(t('Choose a kind of thing first.'), 'warn') : undefined
        const ch = this.chunk(ctx)
        if (ev === 'drag' && ch?.entities.some((e) => e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y && e.type === this.thing)) return
        if (ev === 'up') return
        let made = ''
        this.edit(ctx, t('set down {kind}', { kind: this.thing }), (x) => (made = this.setDown(ctx, x, c)), s)
        ctx.sel = { cell: c, entity: made }
        return ctx.refresh()
      }
      case 'erase':
        if (ev === 'up') return
        return this.edit(ctx, t('take away'), (ch) => { const b = brushCells(c, this.size); const box = boxOf(b[0], b[b.length - 1]); removeThings(ch, thingsIn(ch, box).map((e) => e.id)) }, s)
      case 'mark':
        return this.markPick(ctx, c, ev)
      case 'portal': {
        if (ev !== 'down') return
        const ch = this.chunk(ctx)!
        const i = ch.map.portals.findIndex((p) => p.x === c.x && p.y === c.y)
        if (i >= 0) return void ((ctx.sel = { cell: c, portal: i }), ctx.refresh())
        const to = ctx.store.maps().map((m) => m.data.map.id).find((m) => m !== ctx.map) ?? ctx.map
        this.edit(ctx, t('a portal'), (x) => x.map.portals.push({ x: c.x, y: c.y, to, tx: 0, ty: 0 }))
        ctx.sel = { cell: c, portal: ch.map.portals.length - 1 }
        return ctx.refresh()
      }
      case 'anchor': {
        if (ev !== 'down') return
        const ch = this.chunk(ctx)!
        const name = this.markName || nextName(Object.keys(ch.map.anchors ?? {}), 'spot')
        this.edit(ctx, t('anchor {name}', { name }), (x) => ((x.map.anchors ??= {})[name] = [c.x, c.y]))
        this.markName = ''
        ctx.sel = { cell: c }
        return ctx.refresh()
      }
      case 'start':
        if (ev !== 'down') return
        return ctx.store.change('game.json', t('the start'), (g: { start: { map: string; x: number; y: number } }) => (g.start = { map: ctx.map, x: c.x, y: c.y }))
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
      case 'ellipse': {
        const cells = this.tool === 'rect' ? rectCells(from, to) : ellipseCells(from, to)
        if (layer === 'height' && this.heightMode !== 'set') return this.edit(ctx, this.heightMode === 'raise' ? t('raise the ground') : t('lower the ground'), (ch) => sculpt(ch, cells, this.heightMode as 'raise' | 'lower'))
        return this.edit(ctx, this.tool === 'rect' ? t('a rectangle of {value}', { value }) : t('an ellipse of {value}', { value }), (ch) => paint(ch, layer, cells, value))
      }
      case 'putRect':
        if (!this.thing) return toast(t('Choose a kind of thing first.'), 'warn')
        return this.edit(ctx, `${b.w * b.h} × ${this.thing}`, (ch) => rectCells(from, to).forEach((c) => this.setDown(ctx, ch, c)))
      case 'region': {
        const ch = this.chunk(ctx)!
        const name = this.markName || nextName(Object.keys(ch.map.regions ?? {}), 'area')
        this.markName = ''
        return this.edit(ctx, t('area {name}', { name }), (x) => ((x.map.regions ??= {})[name] = [b.x, b.y, b.w, b.h]))
      }
      case 'room': {
        const ch = this.chunk(ctx)!
        // a click on a room's wall: a doorway there (or the wall again)
        if (b.w === 1 && b.h === 1) {
          const i = roomAt(ch, from)
          const r = i !== undefined ? ch.map.rooms![i] : undefined
          const ring = r && (from.x === r.x || from.y === r.y || from.x === r.x + r.w - 1 || from.y === r.y + r.h - 1)
          if (!ring) return toast(t('Drag a room\'s box; click one of its walls for a doorway.'), 'warn')
          const door = charOf(chars, 'door')
          const wall = charOf(chars, 'wall')
          if (!door || !wall) return toast(t('The game writes no character for a door or a wall.'), 'warn')
          return this.edit(ctx, t('a doorway'), (x) => paint(x, 'ground', [from], valueAt(x, 'ground', from) === door ? wall : door))
        }
        if (b.w < 3 || b.h < 3) return toast(t('A room is at least 3 cells a side.'), 'warn')
        return this.edit(ctx, t('a room {w}×{h}', { w: b.w, h: b.h }), (x) => room(x, this.style || 'wood', b, chars, this.floor))
      }
      case 'organic': {
        const seed = newSeed()
        return this.edit(ctx, t('a patch (seed {seed})', { seed }), (ch) => paintOrganic(ch, b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, this.char, seed, { rough: this.rough, ...(this.only && { only: [this.only] }) }))
      }
      case 'scatter':
      case 'yard': {
        if (!this.thing) return toast(t('Choose a kind of thing first.'), 'warn')
        const seed = newSeed()
        const taken = this.taken(ctx)
        if (this.tool === 'scatter') return this.edit(ctx, t('scatter {kind} (seed {seed})', { kind: this.thing, seed }), (ch) => scatter(ch, [b.x, b.y, b.w, b.h], this.thing, this.density, seed, taken, this.only ? { on: [this.only] } : {}))
        return this.edit(ctx, t('a yard of {kind}', { kind: this.thing }), (ch) => yard(ch, [b.x, b.y, b.w, b.h], this.thing, taken, [[b.x + Math.floor(b.w / 2), b.y + b.h - 1]]))
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
    this.edit(ctx, t('move {w}×{h}', { w: b.w, h: b.h }), (ch) => (now = moveBlock(ch, b, d, this.background(ctx, ch, b), this.prefabs(ctx))))
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
    if (kind === 'entity') this.edit(ctx, t('move {id}', { id }), (ch) => moveThing(ch, id, to))
    else {
      const f = ctx.store.list<PersonFile>('people').find((p) => p.data.id === id)?.file
      if (f) ctx.store.change<PersonFile>(f, t('move {id}', { id }), (p) => p.place.on === 'tile' && ((p.place.x = to.x), (p.place.y = to.y)))
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
    if (kind === 'portal') this.edit(ctx, t('move a portal'), (x) => { const p = x.map.portals[Number(id)]; if (p) (p.x = to.x), (p.y = to.y) })
    if (kind === 'anchor') this.edit(ctx, t('move {id}', { id }), (x) => x.map.anchors && (x.map.anchors[id] = [to.x, to.y]))
    if (kind === 'start') ctx.store.change('game.json', t('the start'), (g: { start: { map: string; x: number; y: number } }) => (g.start = { map: ctx.map, x: to.x, y: to.y }))
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
      toast(t('Picked {w}×{h}: click to lay it, Esc when done.', { w: this.paste.w, h: this.paste.h }))
      return ctx.refresh()
    }
    this.pickAt(ctx, r.from)
  }

  /** What is in a cell chosen (the eyedropper, a right click): its ground, its height, its top thing; the brush in hand. */
  private pickAt(ctx: Ctx, c: Cell): void {
    const ch = this.chunk(ctx)
    if (!ch) return
    if (this.layer === 'ground') {
      this.char = valueAt(ch, 'ground', c) ?? this.char
      this.terrainGroup = undefined
      if (!PAINTS.has(this.tool)) this.setTool(ctx, this.last['ground:brush'] ?? 'pencil')
    } else if (this.layer === 'height') {
      this.height = Number(valueAt(ch, 'height', c) ?? 0)
      if (!PAINTS.has(this.tool)) this.setTool(ctx, this.last['height:brush'] ?? 'pencil')
    } else if (this.layer === 'things') {
      const top = this.topAt(ctx, c)
      const e = top?.kind === 'entity' ? ch.entities.find((x) => x.id === top.id) : undefined
      if (!e) return toast(t('No thing there to pick.'), 'warn')
      this.thing = e.type
      if (['pick', 'erase', 'eyedrop'].includes(this.tool)) this.setTool(ctx, this.last['things:brush'] ?? 'put')
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
      if (!clipboard) return toast(t('Nothing copied yet.'), 'warn'), true
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
        this.edit(ctx, t('remove {id}', { id }), (x) => removeThings(x, [id]))
        ctx.sel = { cell: ctx.sel.cell }
        return true
      }
      if (this.selBox) {
        const b = this.selBox
        this.edit(ctx, t('take away the things in {w}×{h}', { w: b.w, h: b.h }), (x) => removeThings(x, thingsIn(x, b).map((t) => t.id)))
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
    if (this.layer === 'height' && (e.key === '[' || e.key === ']')) return this.setHeight(ctx, this.height + (e.key === ']' ? 1 : -1)), true
    const tool = toolForKey(this.layer, k, this.last)
    if (tool) return this.setTool(ctx, tool), true
    return false
  }

  private copy(ctx: Ctx, ch: RawChunk, cut: boolean): boolean {
    if (this.layer === 'things' && ctx.sel.entity) {
      const id = ctx.sel.entity
      clipboard = copyThing(ch, id)
      if (cut) (this.edit(ctx, t('cut {id}', { id }), (x) => removeThings(x, [id])), (ctx.sel = { cell: ctx.sel.cell }))
      toast(cut ? t('Cut {what}: Ctrl+V, then click where it goes.', { what: id }) : t('Copied {what}: Ctrl+V, then click where it goes.', { what: id }))
      return true
    }
    const b = this.selBox
    if (!b) return toast(t('Select a box first (the Select tool), or a thing on the Things layer.'), 'warn'), true
    clipboard = copyBlock(ch, b, this.prefabs(ctx))
    if (cut) this.edit(ctx, t('cut {w}×{h}', { w: b.w, h: b.h }), (x) => clearBlock(x, b, this.background(ctx, x, b), this.prefabs(ctx)))
    toast(cut ? t('Cut {what}: Ctrl+V, then click where it goes.', { what: `${b.w}×${b.h}` }) : t('Copied {what}: Ctrl+V, then click where it goes.', { what: `${b.w}×${b.h}` }))
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
      // the heights as their colours (the horizon bare), and the cliffs between cells red
      if (this.layer === 'height' && ch.map.heights) {
        ch.map.heights.forEach((row, y) => [...row].forEach((h, x) => { const c = heightHex(Number(h)); if (c !== undefined) (g.fillStyle(c, 0.42), g.fillRect(x * T, y * T, T, T)) }))
        g.lineStyle(2, 0xff4d4d, 0.95)
        for (const e of cliffs(ch.map.heights)) e.side === 'right' ? g.lineBetween((e.x + 1) * T, e.y * T, (e.x + 1) * T, (e.y + 1) * T) : g.lineBetween(e.x * T, (e.y + 1) * T, (e.x + 1) * T, (e.y + 1) * T)
      }
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
    if (!ch) return void (right.innerHTML = `<p class="muted">${t('No map.')}</p>`)
    const m = ch.map
    const onto = ctx.onto()
    const c = ctx.sel.cell
    const chars = ctx.store.game.terrainChars
    const prefabs = this.prefabs(ctx)
    const parts: string[] = []
    if (this.selBox) {
      const b = this.selBox
      parts.push(`<h3>${t('Selection {w}×{h}', { w: b.w, h: b.h })}</h3><p class="muted">${t('at {x}, {y} · {n} things. Drag it, or the arrows, to move it.', { x: b.x, y: b.y, n: thingsIn(ch, b).length })}</p>
        <div class="row"><button id="sCopy" title="Ctrl+C">${t('Copy')}</button><button id="sCut" title="Ctrl+X">${t('Cut')}</button><button id="sFill" title="${t('paint it with the ground chosen')}">${t('Fill')}</button><button id="sThings" title="Delete">${t('Take its things away')}</button></div>`)
    }
    if (c) {
      const ch2 = m.rows[c.y]?.[c.x]
      const terrain = chars[ch2 ?? '']
      const here = ch.entities.filter((e) => e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y)
      const people = ctx.store.list<PersonFile>('people').filter((p) => p.data.place.on === 'tile' && p.data.place.map === m.id && p.data.place.x === c.x && p.data.place.y === c.y)
      parts.push(`<h3>${t('Cell {x}, {y}', { x: c.x, y: c.y })}</h3>
        <p>${esc(tx(onto.terrains[terrain ?? '']?.name) || terrain)} <code>${esc(ch2)}</code> · ${esc(t('height {h}', { h: m.heights?.[c.y]?.[c.x] ?? '0' }))}</p>
        <button id="playHere">▶ ${t('Playtest from here')}</button>
        <ul class="things">${here.map((e) => `<li><a data-entity="${esc(e.id)}" class="${ctx.sel.entity === e.id ? 'on' : ''}">${esc(e.id)}</a> <small>${esc(e.type)}</small></li>`).join('')}${people.map((p) => `<li><a data-person="${esc(p.data.id)}" class="${ctx.sel.person === p.data.id ? 'on' : ''}">${esc(tx(p.data.name) || p.data.id)}</a> <small>${t('a person')} · <a data-person-open="${esc(p.data.id)}">${t('open')}</a></small></li>`).join('')}</ul>`)
      // a door: where it leads, or the room behind it to make
      const pi = m.portals.findIndex((p) => p.x === c.x && p.y === c.y)
      if (terrain === 'door' && pi < 0) {
        const styles = Object.keys(this.catalog(ctx).rooms)
        const floors = Object.entries(chars)
        parts.push(`<div class="box"><b>${t('A door that leads nowhere yet.')}</b>
          <label>${t('the room behind it')} <input id="inW" type="number" min="4" max="40" value="9"> × <input id="inH" type="number" min="4" max="40" value="7"></label>
          <label>${t('walls')} <select id="inStyle">${styles.map((s) => `<option ${s === this.style ? 'selected' : ''}>${esc(s)}</option>`).join('') || `<option value="wood">${t('(none in the catalogue)')}</option>`}</select> ${t('floor')} <select id="inFloor">${floors.map(([k, id]) => `<option value="${esc(id)}" ${k === this.floor ? 'selected' : ''}>${esc(id)}</option>`).join('')}</select></label>
          <label>${t('its name')} <input id="inName" placeholder="${esc(tx(m.name))}"></label>
          <button id="inMake">${t('Make the room behind this door')}</button></div>`)
      }
      const si = stampAt(ch, prefabs, c)
      if (si !== undefined) parts.push(`<p>${t('Building {key} at {x}, {y}', { key: `<b>${esc(m.stamps![si].key)}</b>`, x: m.stamps![si].x, y: m.stamps![si].y })} <button id="stDel" class="danger">${t('Remove it')}</button></p>`)
      const ri = roomAt(ch, c)
      if (ri !== undefined) parts.push(`<p>${t('Room walls')} <b>${esc(m.rooms![ri].style)}</b> ${m.rooms![ri].w}×${m.rooms![ri].h} <button id="rmDel" class="danger" title="${t('the frame\'s picture only: the walls stay as terrain')}">${t('Remove the frame')}</button></p>`)
      const who = people.find((p) => p.data.id === ctx.sel.person)
      if (who) parts.push(`<div class="box"><b>${esc(tx(who.data.name) || who.data.id)}</b> <small class="muted">${esc(who.data.type)}</small><div class="row"><button data-person-open="${esc(who.data.id)}">${t('Open in People')}</button><button id="pFind">${t('Where they are used')}</button></div></div>`)
      const e = here.find((x) => x.id === ctx.sel.entity)
      if (e) parts.push(this.entityForm(ctx, ch, e, onto.types[e.type] ? '' : ` ${t('(no such type)')}`))
    }
    const pi = ctx.sel.portal
    const p = pi !== undefined ? m.portals[pi] : undefined
    if (p) parts.push(`<h3>${t('Portal at {x}, {y}', { x: p.x, y: p.y })}</h3>
      <label>${t('to')} <select data-p="to">${ctx.store.maps().map((x) => `<option ${x.data.map.id === p.to ? 'selected' : ''}>${esc(x.data.map.id)}</option>`).join('')}</select> <a id="pGo">${t('open ▸')}</a></label>
      <label>${t('lands at')} <input data-p="tx" type="number" value="${p.tx}"> <input data-p="ty" type="number" value="${p.ty}"></label>
      <label>${t('label')} ${textField('data-p="label"', p.label)}</label>
      <button id="pDel" class="danger">${t('Remove the portal')}</button>`)
    if (this.layer === 'marks') {
      parts.push(`<h3>${t('Anchors')}</h3><ul class="things">${Object.entries(m.anchors ?? {}).map(([n, [x, y]]) => `<li><a data-anchor-go="${esc(n)}">${esc(n)}</a> <small>${x}, ${y}</small> <a data-anchor-del="${esc(n)}" class="x">✕</a></li>`).join('') || `<li class="muted">${t('none')}</li>`}</ul>`)
      parts.push(`<h3>${t('Areas')}</h3><ul class="things">${Object.entries(m.regions ?? {}).map(([n, [x, y, w, h]]) => `<li><a data-region-go="${esc(n)}">${esc(n)}</a> <small>${x}, ${y} · ${w}×${h}</small> <a data-region-del="${esc(n)}" class="x">✕</a></li>`).join('') || `<li class="muted">${t('none')}</li>`}</ul>`)
    }
    if (!c && !this.selBox && !p) parts.push(`<p class="muted">${t('Click a cell on the map: what is there, and what you select, show here.')}</p>`)
    // the map itself: its name, and its settings in a dialog of their own
    parts.unshift(`<div class="map-head"><b>${esc(shown(m.name) || m.id)}</b><small>${esc(m.id)} · ${m.width}×${m.height} · ${esc(m.kind)}</small><button id="mProps">${t('Map properties…')}</button></div>`)
    right.innerHTML = parts.join('')
    this.wireInspector(ctx, right, ch)
    if (this.props) this.fillProps(ctx, ch)
  }

  /** The map's settings, its size, a copy of it and its removal: a dialog kept up to date while it is open. */
  private openProps(ctx: Ctx): void {
    const ch = this.chunk(ctx)
    if (!ch) return
    const m = modal(t('Map properties'), '', { wide: true })
    this.props = m
    void m.closed.then(() => this.props === m && (this.props = undefined))
    this.fillProps(ctx, ch)
  }

  private fillProps(ctx: Ctx, ch: RawChunk): void {
    const el = this.props!.el
    const m = ch.map
    const keep = el.scrollTop
    el.innerHTML = `${mapSettings(ctx, ch)}
      <details><summary>${t('Size')}</summary><label><input id="rsW" type="number" value="${m.width}"> × <input id="rsH" type="number" value="${m.height}"></label><button id="rsGo">${t('Resize (new cells: the first terrain)')}</button></details>
      <details><summary>${t('Duplicate')}</summary><label>${t('as')} <input id="dupId" value="${esc(nextName(ctx.store.maps().map((x) => x.data.map.id), `${m.id}_`))}"></label><button id="dupGo">${t('Duplicate this map')}</button></details>
      <button id="delMap" class="danger">${t('Delete this map')}</button>`
    el.scrollTop = keep
    wireMapSettings(ctx, el, (why, fn) => this.edit(ctx, why, fn))
    const click = (sel: string, f: () => void) => el.querySelector<HTMLElement>(sel)?.addEventListener('click', f)
    click('#rsGo', () => this.resize(ctx, Number(el.querySelector<HTMLInputElement>('#rsW')!.value), Number(el.querySelector<HTMLInputElement>('#rsH')!.value)))
    click('#dupGo', () => {
      const id = el.querySelector<HTMLInputElement>('#dupId')!.value.trim()
      if (!validId(id)) return toast(t('A map\'s id: lower case letters, digits, - and _.'), 'warn')
      if (ctx.store.mapFile(id)) return toast(t('There is a map {id} already.', { id }), 'warn')
      // (its name as it is, in the game's language: the author renames it)
      ctx.store.add(`maps/${id}.json`, duplicateMap(ch, id, m.name, this.taken(ctx)), t('duplicate {map} as {id}', { map: m.id, id }))
      this.props?.close()
      ctx.showMap(id)
    })
    click('#delMap', () => {
      if (!confirm(t('Delete the map {id}? (Undo brings it back; Save deletes its file.)', { id: m.id }))) return
      const f = this.file(ctx)!
      this.props?.close()
      ctx.store.remove(f, t('delete {id}', { id: m.id }))
      const next = ctx.store.maps()[0]?.data.map.id
      if (next) ctx.showMap(next)
    })
  }

  private wireInspector(ctx: Ctx, right: HTMLElement, ch: RawChunk): void {
    const m = ch.map
    const c = ctx.sel.cell
    const pi = ctx.sel.portal
    const click = (sel: string, f: (el: HTMLElement) => void) => right.querySelectorAll<HTMLElement>(sel).forEach((a) => (a.onclick = () => f(a)))
    const prefabs = this.prefabs(ctx)
    click('#mProps', () => this.openProps(ctx))
    click('[data-entity]', (a) => ((ctx.sel = { ...ctx.sel, entity: a.dataset.entity, person: undefined }), ctx.refresh()))
    click('[data-person]', (a) => ((ctx.sel = { ...ctx.sel, person: a.dataset.person, entity: undefined }), ctx.refresh()))
    click('[data-person-open]', (a) => { const f = ctx.store.list<PersonFile>('people').find((p) => p.data.id === a.dataset.personOpen)?.file; ctx.sel = { person: a.dataset.personOpen }; ctx.open('people', f) })
    click('#pFind', () => ctx.sel.person && ctx.open('find', '', ctx.sel.person))
    click('#playHere', () => c && void ctx.playtest({ map: m.id, ...c }))
    const box = () => this.selBox!
    click('#sCopy', () => this.copy(ctx, ch, false))
    click('#sCut', () => this.copy(ctx, ch, true))
    click('#sFill', () => this.edit(ctx, t('fill {value}', { value: `${box().w}×${box().h}` }), (x) => paint(x, 'ground', rectCells(box(), { x: box().x + box().w - 1, y: box().y + box().h - 1 }), this.char)))
    click('#sThings', () => this.edit(ctx, t('take the things away'), (x) => removeThings(x, thingsIn(x, box()).map((t) => t.id))))
    click('#stDel', () => c && this.edit(ctx, t('remove a building'), (x) => { const i = stampAt(x, prefabs, c); const s = i !== undefined ? x.map.stamps![i] : undefined; if (s) removeStamp(x, prefabs, i!, this.background(ctx, x, { x: s.x, y: s.y, w: prefabs[s.key]?.tw ?? 1, h: prefabs[s.key]?.th ?? 1 })) }))
    click('#rmDel', () => c && this.edit(ctx, t('remove a room\'s frame'), (x) => { const i = roomAt(x, c); if (i !== undefined) x.map.rooms!.splice(i, 1); if (!x.map.rooms?.length) delete x.map.rooms }))
    click('#inMake', () => c && this.makeInterior(ctx, right, c))
    this.wireEntity(ctx, right)
    right.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-p]').forEach((el) => (el.onchange = () => together(() => {
      const k = el.dataset.p!
      const label = k === 'label' ? written(m.portals[pi!]?.label, el.value) : undefined
      this.edit(ctx, t('the portal'), (x) => {
        const q = x.map.portals[pi!] as Portal
        if (k === 'to') q.to = el.value
        else if (k === 'tx' || k === 'ty') q[k] = Number(el.value)
        else if (label === undefined) delete q.label
        else q.label = label
      })
    })))
    click('#pGo', () => { const p = m.portals[pi!]; if (p) (ctx.showMap(p.to, { x: p.tx, y: p.ty }), (ctx.sel = { cell: { x: p.tx, y: p.ty } }), ctx.canvas.scene.lookAt(p.tx, p.ty), ctx.refresh()) })
    click('#pDel', () => (this.edit(ctx, t('remove a portal'), (x) => x.map.portals.splice(pi!, 1)), (ctx.sel = { cell: c })))
    click('[data-anchor-go]', (a) => { const at = m.anchors?.[a.dataset.anchorGo!]; if (at) (ctx.sel = { cell: { x: at[0], y: at[1] } }), ctx.canvas.scene.lookAt(at[0], at[1]), ctx.refresh() })
    click('[data-region-go]', (a) => { const r = m.regions?.[a.dataset.regionGo!]; if (r) (ctx.canvas.scene.lookAt(r[0] + Math.floor(r[2] / 2), r[1] + Math.floor(r[3] / 2)), ctx.canvas.redraw()) })
    click('[data-anchor-del]', (a) => this.edit(ctx, t('remove an anchor'), (x) => delete x.map.anchors?.[a.dataset.anchorDel!]))
    click('[data-region-del]', (a) => this.edit(ctx, t('remove an area'), (x) => delete x.map.regions?.[a.dataset.regionDel!]))
  }

  /** The interior behind the selected door: a new map, a portal each way; then the new map shown. */
  private makeInterior(ctx: Ctx, right: HTMLElement, door: Cell): void {
    const v = (id: string) => right.querySelector<HTMLInputElement>(id)!.value.trim()
    const id = nextName(ctx.store.maps().map((x) => x.data.map.id), `${ctx.map}_room`)
    const spec = { id, name: v('#inName') || tx(ctx.store.get<RawChunk>(this.file(ctx)!)?.map.name) || id, w: Number(v('#inW')) || 9, h: Number(v('#inH')) || 7, style: v('#inStyle') || 'wood', floor: v('#inFloor') || 'floor', music: this.catalog(ctx).music.interior ? 'interior' : undefined }
    let inner: RawChunk | undefined
    this.edit(ctx, t('the room behind {x}, {y}', { x: door.x, y: door.y }), (ch) => (inner = interiorBehind(ch, door, spec, ctx.store.game.terrainChars)))
    if (!inner) return
    ctx.store.add(`maps/${id}.json`, inner, t('a new interior {id}', { id }))
    toast(t('{id}: the room behind the door, a portal each way.', { id }))
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
      <div class="row"><button id="eKind" title="${t('its kind\'s fields and the rules on it (a double click on the map)')}">${t('Its kind')}</button><button id="eOwn" title="${t('a child type for this one thing: rules written for it are its behaviour alone')}">${own ? t('Its rules') : t('A kind of its own')}</button><button id="eFind">${t('Where it is used')}</button></div>
      <label>${t('type')} <input data-e="type" value="${esc(e.type)}"></label>
      <label>${t('name')} ${textField('data-e="name"', e.name, { placeholder: tx(ctx.onto().types[e.type]?.name) })}</label>
      <label>${t('at')} <input data-e="x" type="number" value="${e.place.on === 'tile' ? e.place.x : ''}"> <input data-e="y" type="number" value="${e.place.on === 'tile' ? e.place.y : ''}"></label>
      <label>${t('tags')} <input data-e="tags" value="${esc((e.tags ?? []).join(', '))}"></label>
      <label>${t('props')} <textarea data-e="props" rows="3">${esc(e.props ? JSON.stringify(e.props) : '')}</textarea></label>
      ${e.ai ? `<label>${t('behaviour')} <textarea data-e="ai" rows="3">${esc(JSON.stringify(e.ai))}</textarea></label>` : ''}
      <details ${held.length ? 'open' : ''}><summary>${t('What it holds ({n})', { n: held.length })}</summary><ul class="things">${[...counts].map(([k, n]) => `<li>${n} × ${esc(k)} <a data-hold-del="${esc(k)}" class="x" title="${t('one fewer')}">−</a><a data-hold-add="${esc(k)}" class="x" title="${t('one more')}">+</a></li>`).join('')}</ul>
        <input id="eHoldAdd" list="dlHoldKinds" placeholder="${t('+ a kind in it')}"><datalist id="dlHoldKinds">${Object.keys(ctx.onto().types).filter((k) => k.startsWith('item/')).map((k) => `<option value="${esc(k)}">`).join('')}</datalist></details>
      <button id="eDel" class="danger" title="Delete">${t('Remove {id}', { id: esc(e.id) })}</button>`
  }

  /** A thing's own kind (E-b): a child type of its type made for it, the thing moved to it, a first rule for it (not for a person: theirs is their talk). */
  private ownKind(ctx: Ctx, id: string): void {
    const ch = this.chunk(ctx)
    const e = ch?.entities.find((x) => x.id === id)
    if (!e) return
    const onto = ctx.onto()
    if (onto.types[e.type]?.own !== e.id) {
      const type = ownKindId(e, onto.types)
      const name = e.name ?? `${tx(onto.types[e.type]?.name) || e.type.split('/').pop()} (${e.id})`
      ctx.store.batch(t('{id}: a kind of its own', { id: e.id }), () => {
        setEntry(ctx.store, 'types', { id: type, name, own: e.id } as never, t('the kind {type}', { type }))
        this.edit(ctx, t('{id} is a {type}', { id: e.id, type }), (x) => { const y = x.entities.find((z) => z.id === id); if (y) y.type = type })
      })
      toast(t('{id} is now its own kind, {type}: the rules written for it are its behaviour alone.', { id: e.id, type }))
      if (!type.startsWith('actor/')) rulesMode.startWith(ctx, adoptTexts('rules/own.json', [ownKindRule(type, name)])[0])
      else rulesMode.filterBy(type)
      return ctx.open('rules')
    }
    const rule = [...ctx.store.list<Rule[]>('rules').flatMap((f) => f.data)].find((r) => r.host?.type === e.type)
    if (rule) return ctx.open('rules', '', rule.id)
    if (!e.type.startsWith('actor/')) rulesMode.startWith(ctx, adoptTexts('rules/own.json', [ownKindRule(e.type, e.name ?? e.id)])[0])
    else rulesMode.filterBy(e.type)
    ctx.open('rules')
  }

  private wireEntity(ctx: Ctx, right: HTMLElement): void {
    const id = ctx.sel.entity
    if (!id) return
    const at = (fn: (e: Entity) => void) => this.edit(ctx, t('change {id}', { id }), (ch) => { const e = ch.entities.find((x) => x.id === id); if (e) fn(e) })
    right.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-e]').forEach((el) => (el.onchange = () => {
      const k = el.dataset.e!
      if (k === 'name') return together(() => { const v = written(this.chunk(ctx)?.entities.find((x) => x.id === id)?.name, el.value); at((e) => (v === undefined ? delete e.name : (e.name = v))) })
      try {
        at((e) => {
          if (k === 'type') e.type = el.value.trim()
          else if ((k === 'x' || k === 'y') && e.place.on === 'tile') { e.place[k] = Number(el.value); ctx.sel.cell = { x: e.place.x, y: e.place.y } }
          else if (k === 'tags') e.tags = el.value.split(',').map((x) => x.trim()).filter(Boolean)
          else if (k === 'props') e.props = (parseValue(el.value) as Entity['props']) ?? undefined
          else if (k === 'ai') e.ai = parseValue(el.value) as Entity['ai']
          if (e.tags && !e.tags.length) delete e.tags
        })
      } catch (err) {
        toast(String(err), 'error')
      }
    }))
    right.querySelector<HTMLButtonElement>('#eDel')?.addEventListener('click', () => (this.edit(ctx, t('remove {id}', { id }), (ch) => removeThings(ch, [id])), (ctx.sel = { cell: ctx.sel.cell })))
    const type = this.chunk(ctx)?.entities.find((x) => x.id === id)?.type
    right.querySelector<HTMLButtonElement>('#eKind')?.addEventListener('click', () => type && ctx.open('database', '', type))
    right.querySelector<HTMLButtonElement>('#eOwn')?.addEventListener('click', () => this.ownKind(ctx, id))
    right.querySelector<HTMLButtonElement>('#eFind')?.addEventListener('click', () => ctx.open('find', '', id))
    const hold = (k: string, more: boolean) => this.edit(ctx, more ? t('one more {kind} in {id}', { kind: k, id }) : t('one fewer {kind} in {id}', { kind: k, id }), (ch) => {
      if (more) return void ch.entities.push(...contents(id, ch.map.id, [{ type: k, count: 1 }], this.taken(ctx)))
      const last = [...ch.entities].reverse().find((x) => x.type === k && (x.place.on === 'inside' || x.place.on === 'hand') && x.place.holder === id)
      if (last) removeThings(ch, [last.id])
    })
    right.querySelectorAll<HTMLElement>('[data-hold-add]').forEach((a) => (a.onclick = () => hold(a.dataset.holdAdd!, true)))
    right.querySelectorAll<HTMLElement>('[data-hold-del]').forEach((a) => (a.onclick = () => hold(a.dataset.holdDel!, false)))
    const add = right.querySelector<HTMLInputElement>('#eHoldAdd')
    if (add) add.onchange = () => add.value.trim() && hold(add.value.trim(), true)
  }

  private resize(ctx: Ctx, w: number, h: number): void {
    if (!(w >= 4 && h >= 4 && w <= 400 && h <= 400)) return toast(t('A map is 4 to 400 cells a side.'), 'warn')
    const fill = Object.keys(ctx.store.game.terrainChars)[0] ?? '.'
    this.edit(ctx, t('resize to {w}×{h}', { w, h }), (ch) => {
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
