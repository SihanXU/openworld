// The editor's dialogs: a modal box, and choosing a folder — the system's own dialog in the desktop shell, else
// the editor's (the folders of the disk as the service lists them).

import { call, desktop } from './api.ts'
import { $, esc, html } from './ui.ts'

/** A modal box; closed by its own buttons, Escape or a click beside it. */
export function modal(title: string, body: string, opts: { wide?: boolean } = {}): { el: HTMLElement; close(): void; closed: Promise<void> } {
  let done!: () => void
  const closed = new Promise<void>((ok) => (done = ok))
  const back = html(`<div class="modal-back"><div class="modal ${opts.wide ? 'wide' : ''}"><header><b>${esc(title)}</b><span class="grow"></span><button data-close title="Close">×</button></header><div class="modal-body">${body}</div></div></div>`)
  const close = () => (back.remove(), window.removeEventListener('keydown', key), done())
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close() })
  back.querySelector<HTMLButtonElement>('[data-close]')!.onclick = close
  window.addEventListener('keydown', key)
  document.body.appendChild(back)
  return { el: back.querySelector<HTMLElement>('.modal-body')!, close, closed }
}

interface Listing {
  path: string
  parent?: string
  dirs: { name: string; project: boolean }[]
  home: string
  projects: string
}

/**
 * A folder chosen by the author (none: they gave up). `project`: a folder that is a project is chosen by a click
 * on it (opening one); else the folder one is in is chosen (where a new project or an export goes).
 */
export async function chooseFolder(o: { title: string; start?: string; project?: boolean }): Promise<string | undefined> {
  const d = desktop()
  if (d) return d.pickFolder({ title: o.title, defaultPath: o.start })
  return new Promise((ok) => {
    let chosen: string | undefined
    const m = modal(o.title, `<div class="fs"><div class="fs-path"><input id="fsPath" spellcheck="false"><button id="fsGo">Go</button></div><div id="fsList" class="fs-list"></div><div class="fs-foot"><button id="fsHome">Home</button><button id="fsProjects">Projects folder</button><span class="grow"></span><button id="fsNew">New folder…</button><button id="fsPick" class="on">${o.project ? 'Open this folder' : 'Choose this folder'}</button></div></div>`, { wide: true })
    void m.closed.then(() => ok(chosen))
    let at: Listing
    const show = async (path?: string) => {
      try {
        at = await call<Listing>(`/api/fs${path ? `?path=${encodeURIComponent(path)}` : ''}`)
      } catch (e) {
        return void ($('#fsList', m.el).textContent = (e as Error).message)
      }
      $<HTMLInputElement>('#fsPath', m.el).value = at.path
      $('#fsList', m.el).innerHTML =
        (at.parent ? `<a class="fs-dir" data-to="${esc(at.parent)}">⬆ ..</a>` : '') +
        at.dirs.map((x) => `<a class="fs-dir ${x.project ? 'project' : ''}" data-name="${esc(x.name)}">${x.project ? '★' : '📁'} ${esc(x.name)}${x.project ? ' <small>a project</small>' : ''}</a>`).join('') +
        (at.dirs.length ? '' : '<p class="muted">No folders here.</p>')
      m.el.querySelectorAll<HTMLElement>('.fs-dir').forEach((a) => {
        a.onclick = () => {
          const to = a.dataset.to ?? `${at.path.replace(/[\\/]+$/, '')}${at.path.includes('\\') ? '\\' : '/'}${a.dataset.name}`
          if (o.project && a.classList.contains('project')) return void ((chosen = to), m.close())
          void show(to)
        }
      })
    }
    $<HTMLButtonElement>('#fsGo', m.el).onclick = () => void show($<HTMLInputElement>('#fsPath', m.el).value)
    $<HTMLInputElement>('#fsPath', m.el).onkeydown = (e) => { if (e.key === 'Enter') void show($<HTMLInputElement>('#fsPath', m.el).value) }
    $<HTMLButtonElement>('#fsHome', m.el).onclick = () => void show(at?.home)
    $<HTMLButtonElement>('#fsProjects', m.el).onclick = () => void show(at?.projects)
    $<HTMLButtonElement>('#fsNew', m.el).onclick = () => {
      const name = prompt('A new folder here, named:')?.trim()
      if (!name) return
      // (a folder that does not exist yet is chosen as it is: the service makes it when it writes there)
      chosen = `${at.path.replace(/[\\/]+$/, '')}${at.path.includes('\\') ? '\\' : '/'}${name}`
      m.close()
    }
    $<HTMLButtonElement>('#fsPick', m.el).onclick = () => ((chosen = at?.path), m.close())
    void show(o.start)
  })
}
