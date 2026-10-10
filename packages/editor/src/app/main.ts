// The OpenWorld Editor (docs/engine-split.md §6, P4–P6, §15): RPG Maker's feel over OpenWorld's model. Without
// `?project=` it shows the projects it knows, makes a new one from a template and opens any folder (home.ts);
// with it, it edits that project — its maps, its people, (P5) its database, rules, story and quests, (P6) its
// holes with the AI, its pictures and sounds — on the runtime's own renderer, plays it from any cell, and exports
// it as a game anyone can play.

import '@openworld/modules'
import { useGame } from '@openworld/runtime/src/game.ts'
import { clientGameOf } from '@openworld/runtime/src/bundle.ts'
import { Canvas } from './canvas.ts'
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
      <button id="undo" title="Ctrl+Z">Undo</button><button id="save" title="Ctrl+S">Save</button><button id="play" title="Save, and play from the start (or the selected cell)">▶ Playtest</button><button id="export" title="Save, and make the game a folder anyone can play">Export…</button></header>
    <aside id="left"></aside><main id="canvas"></main><main id="center" class="hidden"></main><aside id="right"></aside>
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
  }
  async function save(): Promise<void> {
    try {
      if (store.unsaved()) await store.save()
    } catch (e) {
      toast((e as Error).message, 'error')
      throw e
    }
  }
  canvas.onCell = (c, ev) => mode.cell?.(ctx, c, ev)
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
  $<HTMLButtonElement>('#save').onclick = () => void save().then(() => toast('Saved.'))
  $<HTMLButtonElement>('#play').onclick = () => void ctx.playtest()
  $<HTMLButtonElement>('#export').onclick = () => void save().then(() => exportDialog(id, store))
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return
    if (e.key === 'z') (e.preventDefault(), store.undo())
    if (e.key === 's') (e.preventDefault(), void save().then(() => toast('Saved.')))
  })
  window.addEventListener('beforeunload', (e) => { if (store.unsaved()) e.preventDefault() })
  ctx.showMap(ctx.map)
  problems.update()
}

