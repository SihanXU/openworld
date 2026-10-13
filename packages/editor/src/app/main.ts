// The OpenWorld Editor (docs/engine-split.md §6, P4–P6, §15): RPG Maker's feel over OpenWorld's model. Without
// `?project=` it shows the projects it knows, makes a new one from a template and opens any folder (home.ts);
// with it, it edits that project — its maps, its people, (P5) its database, rules, story and quests, (P6) its
// holes with the AI, its pictures and sounds — on the runtime's own renderer, plays it from any cell, and exports
// it as a game anyone can play.

import '@openworld/modules'
import { useGame } from '@openworld/runtime/src/game.ts'
import { clientGameOf } from '@openworld/runtime/src/bundle.ts'
import { Canvas, ZOOMS } from './canvas.ts'
import type { PersonFile } from '@openworld/format'
import type { RawChunk } from '@openworld/engine'
import type { Ctx, Mode } from './context.ts'
import { MapMode } from './mapMode.ts'
import { PeopleMode } from './peopleMode.ts'
import { ProblemsPanel } from './problems.ts'
import { Store } from './store.ts'
import { $, esc, toast, tx } from './ui.ts'
import { home } from './home.ts'
import { exportDialog } from './exportDialog.ts'
import { MODES as MORE } from './modes.ts'
import './editor.css'

const PARAMS = new URLSearchParams(location.search)
const project = PARAMS.get('project')

if (!project) void home()
else void openProject(project).catch((e: Error) => {
  document.body.innerHTML = `<div class="home"><h1>OpenWorld Editor</h1><p class="warn">${esc(e.message)}</p><p><a href="./">Back to the projects</a></p></div>`
})

// ------------------------------------------------------------------ a project

async function openProject(id: string): Promise<void> {
  const store = await Store.open(id)
  // the runtime's renderer reads the game it is handed: the project as compiled now, its assets where it is served
  useGame(clientGameOf(store.compiled().bundle, `/games/${encodeURIComponent(id)}/bundle.json`))
  document.body.innerHTML = `<div class="editor">
    <header><a href="./" class="home-link">OpenWorld Editor</a> <b>${esc(tx(store.game.name))}</b> <nav id="modes"></nav>
      <span class="grow"></span><span id="status" class="muted"></span>
      <button id="undo" title="Ctrl+Z">Undo</button><button id="redo" title="Ctrl+Y or Ctrl+Shift+Z">Redo</button><button id="save" title="Ctrl+S">Save</button><button id="play" title="Save, and play from the start (or the selected cell)">▶ Playtest</button><button id="export" title="Save, and make the game a folder anyone can play">Export…</button></header>
    <aside id="left"></aside><main id="canvas"><div id="statusbar"><span id="sbCell" class="muted"></span><span class="grow"></span><button id="sbGrid" title="the grid (G)">Grid</button><span class="sep"></span><button id="sbOut" title="zoom out (-)">−</button>${ZOOMS.map((z) => `<button data-zoom="${z}">${z * 100}%</button>`).join('')}<button id="sbIn" title="zoom in (+)">+</button><button id="sbFit" title="the whole map (0)">Fit</button></div></main><main id="center" class="hidden"></main><aside id="right"></aside>
    <footer id="problems"></footer><div id="toasts"></div></div>`
  const canvas = new Canvas($('#canvas'))
  const modes: Mode[] = [new MapMode(), new PeopleMode(), ...MORE]
  let mode = modes[0]
  const problems = new ProblemsPanel($('#problems'), () => ctx)
  const ctx: Ctx = {
    store,
    canvas,
    map: store.game.start.map,
    sel: {},
    onto: () => store.compiled().bundle.ontology,
    showMap(m, at) {
      if (!store.mapFile(m)) return
      if (ctx.map !== m) ctx.sel = { person: ctx.sel.person }
      ctx.map = m
      canvas.show(store.compiled(), m, at ?? (store.game.start.map === m ? store.game.start : undefined))
      ctx.refresh()
    },
    refresh,
    async playtest(at) {
      await save()
      const where = at ?? (ctx.sel.cell ? { map: ctx.map, ...ctx.sel.cell } : undefined)
      window.open(`/runtime/play/?game=/games/${encodeURIComponent(id)}/&playtest=1&modder=off${where ? `&at=${encodeURIComponent(`${where.map},${where.x},${where.y}`)}` : ''}`, '_blank')
    },
    open(m, file, at) {
      const next = modes.find((x) => x.id === m)
      if (!next) return
      mode = next
      if (file) next.focus?.(ctx, file, at)
      refresh()
    },
  }
  // the renderer loads the game's pictures as it starts: a changed catalogue starts it again (when it is next shown)
  let pictures = false
  function refresh(): void {
    $('#modes').innerHTML = modes.map((m) => `<button data-mode="${m.id}" class="${m === mode ? 'on' : ''}">${esc(m.label)}</button>`).join('')
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => (b.onclick = () => ctx.open(b.dataset.mode!)))
    // a mode with a middle of its own draws there; the canvas waits (and keeps its place) behind it
    const center = $('#center')
    $('#canvas').classList.toggle('hidden', !!mode.main)
    center.classList.toggle('hidden', !mode.main)
    if (mode.main) mode.main(ctx, center)
    else if (pictures) {
      pictures = false
      useGame(clientGameOf(store.compiled().bundle, `/games/${encodeURIComponent(id)}/bundle.json`))
      canvas.reset()
    }
    mode.render(ctx, $('#left'), $('#right'))
    canvas.setOverlay(mode.overlay?.(ctx))
    const n = store.unsaved()
    $('#status').textContent = n ? `${n} unsaved` : 'saved'
    $<HTMLButtonElement>('#save').disabled = !n
    const next = store.next()
    $<HTMLButtonElement>('#undo').disabled = !next.undo
    $<HTMLButtonElement>('#undo').title = next.undo ? `Undo: ${next.undo} (Ctrl+Z)` : 'Nothing to undo'
    $<HTMLButtonElement>('#redo').disabled = !next.redo
    $<HTMLButtonElement>('#redo').title = next.redo ? `Redo: ${next.redo} (Ctrl+Y)` : 'Nothing to redo'
  }
  // the status bar: the cell under the pointer (its ground, height and things), the zoom, the grid
  function cellInfo(c: { x: number; y: number }): string {
    const f = store.mapFile(ctx.map)
    const ch = f ? store.get<RawChunk>(f) : undefined
    if (!ch || c.x < 0) return ''
    const char = ch.map.rows[c.y]?.[c.x] ?? ''
    const terrain = store.game.terrainChars[char] ?? '?'
    const things = ch.entities.filter((e) => e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y)
    const people = store.list<PersonFile>('people').filter((p) => p.data.place.on === 'tile' && p.data.place.map === ctx.map && p.data.place.x === c.x && p.data.place.y === c.y)
    const what = [...people.map((p) => tx(p.data.name) || p.data.id), ...things.map((e) => e.type.split('/').pop())]
    return `${esc(ctx.map)} · <b>${c.x}, ${c.y}</b> · ${esc(terrain)} <code>${esc(char)}</code> · height ${esc(ch.map.heights?.[c.y]?.[c.x] ?? '0')}${what.length ? ` · ${esc(what.join(', '))}` : ''}`
  }
  function zoomShown(): void {
    const z = canvas.zoom
    document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => b.classList.toggle('on', Math.abs(Number(b.dataset.zoom) - z) < 0.01))
    $('#sbGrid').classList.toggle('on', canvas.grid)
  }
  canvas.onView = zoomShown
  const step = (dir: 1 | -1) => canvas.zoomTo(dir > 0 ? (ZOOMS.find((z) => z > canvas.zoom + 0.01) ?? ZOOMS[ZOOMS.length - 1]) : ([...ZOOMS].reverse().find((z) => z < canvas.zoom - 0.01) ?? ZOOMS[0]))
  const grid = () => ((canvas.grid = !canvas.grid), canvas.redraw(), zoomShown())
  document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => (b.onclick = () => canvas.zoomTo(Number(b.dataset.zoom))))
  $<HTMLButtonElement>('#sbIn').onclick = () => step(1)
  $<HTMLButtonElement>('#sbOut').onclick = () => step(-1)
  $<HTMLButtonElement>('#sbFit').onclick = () => canvas.fit()
  $<HTMLButtonElement>('#sbGrid').onclick = grid
  async function save(): Promise<void> {
    try {
      if (store.unsaved()) await store.save()
    } catch (e) {
      toast((e as Error).message, 'error')
      throw e
    }
  }
  canvas.onCell = (c, ev) => {
    if (ev === 'hover' || ev === 'drag' || ev === 'rdrag' || ev === 'leave') $('#sbCell').innerHTML = cellInfo(c)
    mode.cell?.(ctx, c, ev)
  }
  // the canvas follows the project: drawn again a frame after an edit (a stroke is many)
  let redraw = 0
  store.on((why, file) => {
    if (why !== 'saved' && (!file || file === store.mapFile(ctx.map) || file.startsWith('people/') || file === 'game.json' || file.startsWith('ontology/'))) {
      cancelAnimationFrame(redraw)
      redraw = requestAnimationFrame(() => canvas.show(store.compiled(), ctx.map))
    }
    if (file === 'catalog.json') pictures = true
    if (why.startsWith('undo')) toast(why)
    problems.soon()
    refresh()
  })
  $<HTMLButtonElement>('#undo').onclick = () => store.undo() ?? toast('Nothing to undo.', 'warn')
  $<HTMLButtonElement>('#redo').onclick = () => store.redo() ?? toast('Nothing to redo.', 'warn')
  $<HTMLButtonElement>('#save').onclick = () => void save().then(() => toast('Saved.'))
  $<HTMLButtonElement>('#play').onclick = () => void ctx.playtest()
  $<HTMLButtonElement>('#export').onclick = () => void save().then(() => exportDialog(id, store))
  // the keys: Ctrl+S anywhere; the rest only while no field is being typed in (a field's own Ctrl+Z is its own)
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 's') return (e.preventDefault(), void save().then(() => toast('Saved.')))
    const t = e.target as HTMLElement
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable) return
    if (mod && k === 'z' && !e.shiftKey) return (e.preventDefault(), void store.undo())
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) return (e.preventDefault(), void store.redo())
    if (mode.keydown?.(ctx, e)) return e.preventDefault()
    if (mode.main || mod || e.altKey) return
    if (k === 'g') grid()
    else if (k === '+' || k === '=') step(1)
    else if (k === '-') step(-1)
    else if (k === '0') canvas.fit()
  })
  window.addEventListener('beforeunload', (e) => { if (store.unsaved()) e.preventDefault() })
  ctx.showMap(ctx.map)
  problems.update()
}

