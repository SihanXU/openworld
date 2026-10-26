/** Screen-space placement shared by item tips, action menus and skill descriptions. */
export interface Rect { x: number; y: number; width: number; height: number }

export function fitFloating(anchor: Rect, size: { width: number; height: number }, viewport: Rect, gap = 8): { x: number; y: number } {
  const right = viewport.x + viewport.width - gap
  const bottom = viewport.y + viewport.height - gap
  let x = anchor.x + anchor.width + gap
  let y = anchor.y
  if (x + size.width > right) x = anchor.x - size.width - gap
  if (y + size.height > bottom) y = bottom - size.height
  return { x: Math.max(viewport.x + gap, Math.min(x, right - size.width)), y: Math.max(viewport.y + gap, y) }
}

export function visibleViewport(): Rect {
  const v = window.visualViewport
  return { x: v?.offsetLeft ?? 0, y: v?.offsetTop ?? 0, width: v?.width ?? innerWidth, height: v?.height ?? innerHeight }
}

export function placeFloating(element: HTMLElement, anchor: Rect): void {
  const viewport = visibleViewport()
  element.style.maxWidth = `${Math.max(0, viewport.width - 16)}px`
  element.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`
  const p = fitFloating(anchor, element.getBoundingClientRect(), viewport)
  element.style.left = `${p.x}px`
  element.style.top = `${p.y}px`
  element.style.transform = 'none'
}

/** Reposition after content, font, viewport or anchor changes. The owner must dispose on close. */
export function trackFloating(element: HTMLElement, anchor: () => Rect): () => void {
  const update = () => placeFloating(element, anchor())
  const resize = new ResizeObserver(update)
  resize.observe(element)
  window.addEventListener('resize', update)
  window.addEventListener('scroll', update, true)
  window.visualViewport?.addEventListener('resize', update)
  window.visualViewport?.addEventListener('scroll', update)
  update()
  return () => {
    resize.disconnect()
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update, true)
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
  }
}
