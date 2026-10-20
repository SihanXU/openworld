// A panel drawn again whole (innerHTML) loses where its lists were scrolled to, and a click or an autosave looks like
// the page jumping. Each scrolled element is found again after the drawing by its place in the panel (the chain of
// child indices from the panel), and scrolled back; only within one mode (another's lists start at the top).

let lastMode = ''

/** The chain of child indices from a root to an element, as a key. */
function pathOf(root: HTMLElement, el: Element): string {
  const at: number[] = []
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) at.push(e.parentElement ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0)
  return at.reverse().join('.')
}

function find(root: HTMLElement, path: string): HTMLElement | undefined {
  let e: Element | undefined = root
  for (const i of path ? path.split('.').map(Number) : []) e = e?.children[i]
  return e as HTMLElement | undefined
}

/** Draw (`fn`), keeping the scroll of every scrolled element in the panels (theirs too). */
export function keepScroll(mode: string, roots: HTMLElement[], fn: () => void): void {
  const same = mode === lastMode
  lastMode = mode
  const kept = same
    ? roots.map((root) => [root, ...root.querySelectorAll<HTMLElement>('*')].filter((e) => e.scrollTop > 0 || e.scrollLeft > 0).map((e) => ({ root, path: pathOf(root, e), top: e.scrollTop, left: e.scrollLeft })))
    : []
  fn()
  for (const list of kept)
    for (const k of list) {
      const e = find(k.root, k.path)
      if (e) (e.scrollTop = k.top), (e.scrollLeft = k.left)
    }
}
