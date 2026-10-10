// The OpenWorld Editor (docs/engine-split.md §6, P4–P6): RPG Maker's feel over OpenWorld's model. Without
// `?project=` it lists the games and makes a new one from the starter; with it, it edits that project — its maps,
// its people, (P5) its database, rules, story and quests, (P6) its holes with the AI — on the runtime's own
// renderer, and plays it from any cell.

import '@openworld/modules'
import { useGame } from '@openworld/runtime/src/game.ts'
import { clientGameOf } from '@openworld/runtime/src/bundle.ts'
import type { Text } from '@openworld/engine'
import { Canvas } from './canvas.ts'
import type { Ctx, Mode } from './context.ts'
import { MapMode } from './mapMode.ts'
import { PeopleMode } from './peopleMode.ts'
import { ProblemsPanel } from './problems.ts'
import { Store } from './store.ts'
import { $, esc, toast, tx } from './ui.ts'
import { MODES as MORE } from './modes.ts'
import './editor.css'

const PARAMS = new URLSearchParams(location.search)
const project = PARAMS.get('project')

if (!project) void projectList()
else void openProject(project)

// ------------------------------------------------------------------ the games

async function projectList(): Promise<void> {
  const list = (await (await fetch('/api/projects')).json()) as { id: string; name: Text; modules: string[]; maps: number; people: number }[]
  document.body.innerHTML = `<div class="home">
    <h1>OpenWorld Editor</h1>
    <p class="muted">The games under <code>games/</code>. What you change is written to their files; commit them as any other change.</p>
    <div class="cards">${list.map((p) => `<a class="card" href="?project=${encodeURIComponent(p.id)}"><b>${esc(tx(p.name))}</b><small>${esc(p.id)} · ${p.maps} maps · ${p.people} people${p.modules.length ? ` · ${esc(p.modules.join(', '))}` : ' · the kernel alone'}</small></a>`).join('')}</div>
    <h2>New project</h2>
    <p class="muted">A copy of the starter (games/starter): a glade, a cottage, a villager with a day, an axe in a chest.</p>
    <label>id <input id="newId" placeholder="my-game"></label> <label>name <input id="newName" placeholder="My Game"></label> <button id="newGo">Make it</button>
    <div id="toasts"></div></div>`
  $<HTMLButtonElement>('#newGo').onclick = async () => {
    const id = $<HTMLInputElement>('#newId').value.trim()
    const r = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, name: $<HTMLInputElement>('#newName').value.trim() || id }) })
    const b = (await r.json()) as { error?: string }
    if (!r.ok) return toast(b.error ?? 'could not make it', 'error')
    location.search = `?project=${encodeURIComponent(id)}`
  }
}

// ------------------------------------------------------------------ a project

async function openProject(id: string): Promise<void> {
  const store = await Store.open(id)
  // the runtime's renderer reads the game it is handed: the project as compiled now, its assets where it is served
  useGame(clientGameOf(store.compiled().bundle, `/games/${encodeURIComponent(id)}/bundle.json`))
  document.body.innerHTML = `<div class="editor">
    <header><a href="./" class="home-link">OpenWorld Editor</a> <b>${esc(tx(store.game.name))}</b> <nav id="modes"></nav>
      <span class="grow"></span><span id="status" class="muted"></span>
      <button id="undo" title="Ctrl+Z">Undo</button><button id="save" title="Ctrl+S">Save</button><button id="play" title="Save, and play from the start (or the selected cell)">▶ Playtest</button></header>
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
  function refresh(): void {
    $('#modes').innerHTML = modes.map((m) => `<button data-mode="${m.id}" class="${m === mode ? 'on' : ''}">${esc(m.label)}</button>`).join('')
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => (b.onclick = () => ctx.open(b.dataset.mode!)))
    // a mode with a middle of its own draws there; the canvas waits (and keeps its place) behind it
    const center = $('#center')
    $('#canvas').classList.toggle('hidden', !!mode.main)
    center.classList.toggle('hidden', !mode.main)
    if (mode.main) mode.main(ctx, center)
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
    if (why.startsWith('undo')) toast(why)
    problems.soon()
    refresh()
  })
  $<HTMLButtonElement>('#undo').onclick = () => store.undo() ?? toast('Nothing to undo.', 'warn')
  $<HTMLButtonElement>('#save').onclick = () => void save().then(() => toast('Saved.'))
  $<HTMLButtonElement>('#play').onclick = () => void ctx.playtest()
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return
    if (e.key === 'z') (e.preventDefault(), store.undo())
    if (e.key === 's') (e.preventDefault(), void save().then(() => toast('Saved.')))
  })
  window.addEventListener('beforeunload', (e) => { if (store.unsaved()) e.preventDefault() })
  ctx.showMap(ctx.map)
  problems.update()
}

