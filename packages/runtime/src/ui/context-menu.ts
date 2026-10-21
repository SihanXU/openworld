/** The short-lived item popup: it owns its outside listener and invalidates actions on close. */
export type ContextMenuRow = [label: string, action: () => void]

export class ContextMenu {
  private popup?: HTMLElement
  private outsideMouseDown?: (event: MouseEvent) => void

  show(x: number, y: number, rows: ContextMenuRow[]): void {
    this.close()

    const popup = document.createElement('div')
    popup.className = 'ctx'
    popup.style.left = `${x}px`
    popup.style.top = `${y}px`
    for (const [label, action] of rows) {
      const row = document.createElement('div')
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
    popup?.remove()
  }
}
