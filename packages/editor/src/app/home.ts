// The editor's first page (docs/engine-split.md §15): the projects it knows — the recent ones, wherever they are,
// and the ones on its shelves (the repository's games/ in development) — a new project from a template in a
// folder of the author's choosing, and any folder opened as a project.

import type { Text } from '@openworld/engine'
import { call } from './api.ts'
import { chooseFolder, modal } from './dialogs.ts'
import { $, esc, textOf, toast, tx } from './ui.ts'

interface ProjectInfo {
  key: string
  id: string
  name: Text
  modules: string[]
  maps: number
  people: number
  dir: string
  shelf?: string
  opened?: number
  missing?: boolean
}

interface WorkspaceView {
  projects: ProjectInfo[]
  templates: { id: string; name: Text; doc: Text }[]
  projectsDir: string
  pack: boolean
  shell: 'browser' | 'desktop'
}

const go = (key: string) => (location.search = `?project=${encodeURIComponent(key)}`)

function card(p: ProjectInfo): string {
  const when = p.opened ? new Date(p.opened).toLocaleDateString() : ''
  return `<div class="card ${p.missing ? 'missing' : ''}" data-key="${esc(p.key)}">
    <b>${esc(tx(p.name))}</b>
    <small>${p.missing ? '<span class="warn">its folder is gone</span>' : `${p.maps} maps · ${p.people} people · ${p.modules.length ? esc(p.modules.join(', ')) : 'the kernel alone'}`}</small>
    <small class="path" title="${esc(p.dir)}">${esc(p.dir)}</small>
    ${p.shelf ? '' : `<small>${when ? `opened ${esc(when)}` : ''} <a class="x" data-forget="${esc(p.key)}" title="Take it off the list (its files stay)">forget</a></small>`}
  </div>`
}

export async function home(): Promise<void> {
  const ws = await call<WorkspaceView>('/api/workspace')
  const recent = ws.projects.filter((p) => !p.shelf)
  const shelved = ws.projects.filter((p) => p.shelf)
  document.body.innerHTML = `<div class="home">
    <h1>OpenWorld Editor</h1>
    <p class="muted">Make a game on the OpenWorld engine: maps, people, a database of things, rules, a story, quests — and the holes where the AI answers. A project is a folder of plain files; play it from any cell, export it as a game anyone can play.</p>
    <div class="home-actions"><button id="newProject" class="on">New project…</button> <button id="openProject">Open project…</button></div>
    <h2>Recent projects</h2>
    ${recent.length ? `<div class="cards">${recent.map(card).join('')}</div>` : '<p class="muted">None yet: make one, or open a project\'s folder.</p>'}
    ${shelved.length ? `<h2>Games in this repository</h2><div class="cards">${shelved.map(card).join('')}</div>` : ''}
    <div id="toasts"></div></div>`
  document.querySelectorAll<HTMLElement>('.card').forEach((c) => {
    c.onclick = (e) => {
      if ((e.target as HTMLElement).dataset.forget || c.classList.contains('missing')) return
      go(c.dataset.key!)
    }
  })
  document.querySelectorAll<HTMLElement>('[data-forget]').forEach((a) => {
    a.onclick = async () => {
      await call(`/api/projects/${encodeURIComponent(a.dataset.forget!)}`, { method: 'DELETE' })
      void home()
    }
  })
  $<HTMLButtonElement>('#openProject').onclick = async () => {
    const path = await chooseFolder({ title: 'Open a project (a folder with a game.json)', project: true })
    if (!path) return
    try {
      go((await call<ProjectInfo>('/api/projects/open', { body: { path } })).key)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  $<HTMLButtonElement>('#newProject').onclick = () => newProject(ws)
}

/** A game's id from its name: lower case letters, digits and -, a letter first. */
export const idOf = (name: string): string => {
  const k = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return /^[a-z]/.test(k) ? k : k ? `game-${k}`.slice(0, 40) : ''
}

function newProject(ws: WorkspaceView): void {
  const m = modal(
    'New project',
    `<div class="templates">${ws.templates.map((t, i) => `<label class="template"><input type="radio" name="tpl" value="${esc(t.id)}" ${i === 0 ? 'checked' : ''}><b>${esc(tx(t.name))}</b><small>${esc(tx(t.doc))}</small></label>`).join('')}</div>
    <div class="cols"><label>Name <input id="npName" placeholder="My Game"></label><label>名称 (Chinese, optional) <input id="npZh" placeholder="我的游戏"></label></div>
    <label>Id <input id="npId" placeholder="my-game"> <small class="muted">its folder's name too, unless you name another</small></label>
    <label>In the folder <span class="row"><input id="npFolder" value="${esc(ws.projectsDir)}" spellcheck="false"><button id="npChoose">Choose…</button></span></label>
    <p class="muted" id="npWhere"></p>
    <div class="row end"><button id="npMake" class="on">Make it</button></div>`,
    { wide: true },
  )
  const name = $<HTMLInputElement>('#npName', m.el)
  const id = $<HTMLInputElement>('#npId', m.el)
  const folder = $<HTMLInputElement>('#npFolder', m.el)
  let typedId = false
  const where = () => ($('#npWhere', m.el).textContent = id.value ? `The project will be ${folder.value.replace(/[\\/]+$/, '')}${folder.value.includes('\\') ? '\\' : '/'}${id.value}` : '')
  name.oninput = () => { if (!typedId) id.value = idOf(name.value); where() }
  id.oninput = () => ((typedId = true), where())
  folder.oninput = where
  $<HTMLButtonElement>('#npChoose', m.el).onclick = async () => {
    const f = await chooseFolder({ title: 'Where the project goes', start: folder.value })
    if (f) (folder.value = f), where()
  }
  $<HTMLButtonElement>('#npMake', m.el).onclick = async () => {
    const template = m.el.querySelector<HTMLInputElement>('input[name=tpl]:checked')?.value
    try {
      const p = await call<ProjectInfo>('/api/projects', { body: { template, id: id.value.trim(), name: textOf(name.value || id.value, $<HTMLInputElement>('#npZh', m.el).value), folder: folder.value.trim() } })
      go(p.key)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  name.focus()
}
