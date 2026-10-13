// A panel's own styles (its .css, imported as text), put in the page once, as the panel is first made: the panels load
// only in the page that opens them (ui/panels.ts), never in the worker, and their looks come with them.

const added = new Set<string>()

export function useStyle(id: string, css: string): void {
  if (added.has(id) || typeof document === 'undefined') return
  added.add(id)
  const el = document.createElement('style')
  el.dataset.panelStyle = id
  el.textContent = css
  document.head.appendChild(el)
}
