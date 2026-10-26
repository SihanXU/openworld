import { mountCloseButton, windowManager } from './window.ts'

/** Measure canvas chrome instead of hard-coding its height; preserve the world point at the viewport's centre. */
export function canvasWindow(host: HTMLElement, view: HTMLElement, title: string, close: () => void, resized: (dx: number, dy: number) => void): void {
  host.classList.add('ui-canvas-window')
  host.tabIndex = -1
  host.setAttribute('role', 'dialog')
  host.setAttribute('aria-label', title)
  host.querySelectorAll<HTMLButtonElement>('.sk-bar .x').forEach(mountCloseButton)
  const chrome = [...host.querySelectorAll<HTMLElement>(':scope > .sk-bar,:scope > .sk-directions,:scope > .sk-branches')]
  let previous: { width: number; height: number } | undefined
  let pending = false
  const update = () => {
    pending = false
    if (!host.isConnected || host.classList.contains('hidden')) return
    const top = Math.max(0, ...chrome.map((node) => node.getBoundingClientRect().bottom - host.getBoundingClientRect().top)) + 12
    host.style.setProperty('--ui-canvas-top', `${top}px`)
    const rect = view.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    if (previous) resized((rect.width - previous.width) / 2, (rect.height - previous.height) / 2)
    previous = { width: rect.width, height: rect.height }
  }
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(update) } }
  const observer = new ResizeObserver(schedule)
  observer.observe(host); chrome.forEach((node) => observer.observe(node)); observer.observe(view)
  const visibility = new MutationObserver(schedule)
  visibility.observe(host, { attributes: true, attributeFilter: ['class'] })
  windowManager().register(host, host, { mode: 'modal', onClose: close })
}
