import { trackFloating } from './components/floating.ts'

/** The short-lived item popup: it owns its outside listener and invalidates actions on close. */
export type ContextMenuRow = [label: string, action: () => void]

export class ContextMenu {
  private popup?: HTMLElement
  private outsideMouseDown?: (event: MouseEvent) => void
  private keyDown?: (event: KeyboardEvent) => void
  private untrack?: () => void
  private previous?: HTMLElement

  show(x: number, y: number, rows: ContextMenuRow[]): void {
    this.close()

    const popup = document.createElement('div')
    popup.className = 'ctx'
    popup.style.left = `${x}px`
    popup.style.top = `${y}px`
    for (const [label, action] of rows) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'ctx-row'
      row.textContent = label
      row.onclick = () => {
        if (this.popup !== popup) return
        this.close()
        action()
      }
      popup.appendChild(row)
    }
    document.body.appendChild(popup)
    this.popup = popup
    if (typeof popup.getBoundingClientRect === 'function') {
      popup.setAttribute('role', 'menu')
      this.previous = document.activeElement as HTMLElement
      this.untrack = trackFloating(popup, () => ({ x, y, width: 0, height: 0 }))
      popup.querySelector('button')?.focus({ preventScroll: true })
      this.keyDown = (event) => {
        if (!['Escape', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'].includes(event.key)) return
        event.preventDefault(); event.stopImmediatePropagation()
        if (event.key === 'Escape' || event.key === 'Tab') return this.close()
        const buttons = [...popup.querySelectorAll('button')]
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length
        buttons[next]?.focus()
      }
      window.addEventListener('keydown', this.keyDown, true)
    }

    this.outsideMouseDown = (event) => {
      if (this.popup === popup && !popup.contains(event.target as Node)) this.close()
    }
    window.addEventListener('mousedown', this.outsideMouseDown)
  }

  close(): void {
    const popup = this.popup
    this.popup = undefined
    if (this.outsideMouseDown) window.removeEventListener('mousedown', this.outsideMouseDown)
    this.outsideMouseDown = undefined
    if (this.keyDown) window.removeEventListener('keydown', this.keyDown, true)
    this.keyDown = undefined
    this.untrack?.()
    this.untrack = undefined
    popup?.remove()
    if (this.previous?.isConnected) this.previous.focus({ preventScroll: true })
    this.previous = undefined
  }
}
