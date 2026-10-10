// Export (docs/engine-split.md §15): the project as a game anyone can play — the engine's player and the game
// compiled beside it, a folder any web server serves, and its zip (itch.io takes it as an HTML game).

import { call, desktop } from './api.ts'
import { chooseFolder, modal } from './dialogs.ts'
import type { Store } from './store.ts'
import { $, esc, toast } from './ui.ts'

interface Exported {
  dir: string
  files: number
  bytes: number
  zip?: { file: string; bytes: number }
  warnings: string[]
  url: string
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

export function exportDialog(key: string, store: Store): void {
  const errors = store.compiled().problems.filter((p) => p.level === 'error')
  const m = modal(
    'Export the game',
    `<p class="muted">The engine's player with the game beside it: a folder of plain files any web server serves (open its index.html there), and a zip of it for itch.io and the like. It plays without the AI (a modder may be named with <code>?modder=&lt;url&gt;</code>).</p>
    ${errors.length ? `<p class="warn">The project has ${errors.length} error(s): fix them first (the problems panel).</p>` : ''}
    <label>Into the folder <span class="row"><input id="exFolder" placeholder="beside the project: &lt;id&gt;-export" spellcheck="false"><button id="exChoose">Choose…</button></span></label>
    <label class="inline"><input type="checkbox" id="exZip" checked> and a zip of it</label>
    <div class="row end"><button id="exGo" class="on" ${errors.length ? 'disabled' : ''}>Export</button></div>
    <div id="exOut"></div>`,
    { wide: true },
  )
  $<HTMLButtonElement>('#exChoose', m.el).onclick = async () => {
    const f = await chooseFolder({ title: 'Where the exported game goes (an empty folder, or an earlier export)' })
    if (f) $<HTMLInputElement>('#exFolder', m.el).value = f
  }
  $<HTMLButtonElement>('#exGo', m.el).onclick = async () => {
    const out = $('#exOut', m.el)
    out.innerHTML = '<p class="muted">Exporting…</p>'
    try {
      const r = await call<Exported>(`/api/projects/${encodeURIComponent(key)}/export`, { body: { folder: $<HTMLInputElement>('#exFolder', m.el).value.trim() || undefined, zip: $<HTMLInputElement>('#exZip', m.el).checked } })
      out.innerHTML = `<div class="box"><b class="ok">Exported.</b> ${r.files} files, ${mb(r.bytes)}<br><code>${esc(r.dir)}</code>${r.zip ? `<br>zip: <code>${esc(r.zip.file)}</code> (${mb(r.zip.bytes)})` : ''}
        ${r.warnings.length ? `<ul class="problems-inline">${r.warnings.map((w) => `<li class="warning">${esc(w)}</li>`).join('')}</ul>` : ''}
        <div class="row"><a href="${esc(r.url)}" target="_blank" rel="noopener">▶ Play the export</a>${desktop() ? ' <button id="exShow">Show the folder</button>' : ''}</div></div>`
      out.querySelector<HTMLButtonElement>('#exShow')?.addEventListener('click', () => void desktop()?.showFolder(r.dir))
    } catch (e) {
      out.innerHTML = `<pre class="warn">${esc((e as Error).message)}</pre>`
      toast('The export failed.', 'error')
    }
  }
}
