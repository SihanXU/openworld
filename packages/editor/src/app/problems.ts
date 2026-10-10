// The validation panel (docs/engine-split.md §6): what the compiler finds in the project as it is now, saved or
// not — references, sizes, portals, anchors, ties, rules — each a link to where it is.

import type { Problem } from '@openworld/format'
import type { Ctx } from './context.ts'
import { esc } from './ui.ts'

/** Which mode a file is edited in. */
export function modeOf(file: string | undefined): string | undefined {
  if (!file) return undefined
  if (file.startsWith('maps/')) return 'map'
  if (file.startsWith('people/')) return 'people'
  if (file.startsWith('rules/')) return 'rules'
  if (file.startsWith('quests/')) return 'quests'
  if (file.startsWith('story/')) return 'story'
  if (file.startsWith('ontology/')) return 'database'
  return undefined
}

export class ProblemsPanel {
  private open = false
  private problems: Problem[] = []
  private timer?: ReturnType<typeof setTimeout>

  constructor(private el: HTMLElement, private ctx: () => Ctx) {}

  /** Compile again a moment after the last edit (the compiler is quick; a stroke is many edits). */
  soon(): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.update(), 250)
  }

  update(): void {
    try {
      this.problems = this.ctx().store.compiled().problems
    } catch (e) {
      this.problems = [{ level: 'error', code: 'compile', message: (e as Error).message }]
    }
    this.render()
  }

  private render(): void {
    const errors = this.problems.filter((p) => p.level === 'error').length
    const warnings = this.problems.length - errors
    this.el.innerHTML = `<div class="ph"><button id="probToggle">${errors ? `<b class="err">${errors} error${errors > 1 ? 's' : ''}</b>` : '<b class="ok">no errors</b>'}${warnings ? ` · ${warnings} warning${warnings > 1 ? 's' : ''}` : ''} ${this.open ? '▾' : '▸'}</button></div>
      ${this.open ? `<ul>${this.problems.map((p, i) => `<li class="${p.level}"><a data-i="${i}">[${esc(p.code)}] ${esc(p.file ?? '')}${p.at ? ` (${esc(p.at)})` : ''}</a> ${esc(p.message)}</li>`).join('') || '<li class="muted">The compiler finds nothing wrong.</li>'}</ul>` : ''}`
    this.el.querySelector<HTMLButtonElement>('#probToggle')!.onclick = () => ((this.open = !this.open), this.render())
    this.el.querySelectorAll<HTMLElement>('[data-i]').forEach((a) => (a.onclick = () => {
      const p = this.problems[Number(a.dataset.i)]
      const mode = modeOf(p.file)
      if (mode) this.ctx().open(mode, p.file, p.at)
    }))
  }
}
