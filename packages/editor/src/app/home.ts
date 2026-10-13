// The editor's first page (docs/engine-split.md §15): the projects it knows — the recent ones, wherever they are,
// and the ones on its shelves (the repository's games/ in development) — a new project from a template in a
// folder of the author's choosing, and any folder opened as a project.

import type { Text } from '@openworld/engine'
import { call } from './api.ts'
import { chooseFolder, modal, settingsDialog } from './dialogs.ts'
import { uiLang } from './lang.ts'
import { $, esc, t, toast, tx } from './ui.ts'
import { LANG_NAMES, langName } from './words.ts'

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

/** A template's words are the editor's (not a game's): in the editor's language where they have it. */
const own = (x: Text): string => (typeof x === 'string' ? x : ((x as Record<string, string | undefined>)[uiLang()] ?? x.en))

function card(p: ProjectInfo): string {
  const when = p.opened ? new Date(p.opened).toLocaleDateString() : ''
  return `<div class="pcard ${p.missing ? 'missing' : ''}" data-key="${esc(p.key)}">
    <b>${esc(tx(p.name))}</b>
    <small>${p.missing ? `<span class="warn">${t('its folder is gone')}</span>` : `${t('{n} maps', { n: p.maps })} · ${t('{n} people', { n: p.people })} · ${p.modules.length ? esc(p.modules.join(', ')) : t('the kernel alone')}`}</small>
    <small class="path" title="${esc(p.dir)}">${esc(p.dir)}</small>
    ${p.shelf ? '' : `<small>${when ? esc(t('opened {when}', { when })) : ''} <a class="x" data-forget="${esc(p.key)}" title="${t('Take it off the list (its files stay)')}">${t('forget')}</a></small>`}
  </div>`
}

export async function home(): Promise<void> {
  const ws = await call<WorkspaceView>('/api/workspace')
  const recent = ws.projects.filter((p) => !p.shelf)
  const shelved = ws.projects.filter((p) => p.shelf)
  document.body.innerHTML = `<div class="home">
    <div class="row"><h1 class="grow">${t('OpenWorld Editor')}</h1><button id="settings" title="${t('The editor\'s settings: its own language')}">⚙</button></div>
    <p class="muted">${t('Make a game on the OpenWorld engine: maps, people, a database of things, rules, a story, quests — and the holes where the AI answers. A project is a folder of plain files; play it from any cell, export it as a game anyone can play.')}</p>
    <div class="home-actions"><button id="newProject" class="on">${t('New project…')}</button> <button id="openProject">${t('Open project…')}</button></div>
    <h2>${t('Recent projects')}</h2>
    ${recent.length ? `<div class="pcards">${recent.map(card).join('')}</div>` : `<p class="muted">${t('None yet: make one, or open a project\'s folder.')}</p>`}
    ${shelved.length ? `<h2>${t('Games in this repository')}</h2><div class="pcards">${shelved.map(card).join('')}</div>` : ''}
    <div id="toasts"></div></div>`
  document.querySelectorAll<HTMLElement>('.pcard').forEach((c) => {
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
    const path = await chooseFolder({ title: t('Open a project (a folder with a game.json)'), project: true })
    if (!path) return
    try {
      go((await call<ProjectInfo>('/api/projects/open', { body: { path } })).key)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  $<HTMLButtonElement>('#newProject').onclick = () => newProject(ws)
  $<HTMLButtonElement>('#settings').onclick = () => settingsDialog()
}

/** A game's id from its name: lower case letters, digits and -, a letter first. */
export const idOf = (name: string): string => {
  const k = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return /^[a-z]/.test(k) ? k : k ? `game-${k}`.slice(0, 40) : ''
}

function newProject(ws: WorkspaceView): void {
  const m = modal(
    t('New project'),
    `<div class="templates">${ws.templates.map((x, i) => `<label class="template"><input type="radio" name="tpl" value="${esc(x.id)}" ${i === 0 ? 'checked' : ''}><b>${esc(own(x.name))}</b><small>${esc(own(x.doc))}</small></label>`).join('')}</div>
    <div class="cols"><label>${t('Name')} <input id="npName" placeholder="${t('My Game')}"></label>
      <label>${t('Its words written in')} <select id="npSource">${Object.keys(LANG_NAMES).map((l) => `<option value="${l}" ${l === 'en' ? 'selected' : ''}>${esc(langName(l))}</option>`).join('')}</select></label></div>
    <p class="muted">${t('The language the game is written in: every name and line in the editor is in it; other languages are translations of it (the Localization mode). Whatever the editor speaks.')}</p>
    <label>${t('Id')} <input id="npId" placeholder="my-game"> <small class="muted">${t('its folder\'s name too, unless you name another')}</small></label>
    <label>${t('In the folder')} <span class="row"><input id="npFolder" value="${esc(ws.projectsDir)}" spellcheck="false"><button id="npChoose">${t('Choose…')}</button></span></label>
    <p class="muted" id="npWhere"></p>
    <div class="row end"><button id="npMake" class="on">${t('Make it')}</button></div>`,
    { wide: true },
  )
  const name = $<HTMLInputElement>('#npName', m.el)
  const id = $<HTMLInputElement>('#npId', m.el)
  const folder = $<HTMLInputElement>('#npFolder', m.el)
  let typedId = false
  const where = () => ($('#npWhere', m.el).textContent = id.value ? t('The project will be {dir}', { dir: `${folder.value.replace(/[\\/]+$/, '')}${folder.value.includes('\\') ? '\\' : '/'}${id.value}` }) : '')
  name.oninput = () => { if (!typedId) id.value = idOf(name.value); where() }
  id.oninput = () => ((typedId = true), where())
  folder.oninput = where
  $<HTMLButtonElement>('#npChoose', m.el).onclick = async () => {
    const f = await chooseFolder({ title: t('Where the project goes'), start: folder.value })
    if (f) (folder.value = f), where()
  }
  $<HTMLButtonElement>('#npMake', m.el).onclick = async () => {
    const template = m.el.querySelector<HTMLInputElement>('input[name=tpl]:checked')?.value
    try {
      const p = await call<ProjectInfo>('/api/projects', { body: { template, id: id.value.trim(), name: name.value.trim() || id.value, source: $<HTMLSelectElement>('#npSource', m.el).value, folder: folder.value.trim() } })
      go(p.key)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  name.focus()
}
