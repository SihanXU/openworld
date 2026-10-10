// What waits for the game's save to be written: back to the title, whose slots are read from storage.
// Opened at once, the title read the slot before the save arrived, and Continue loaded the minutes before.

export class AfterSave {
  private next?: { run: () => void; timer: ReturnType<typeof setTimeout> }

  /** Run `fn` once the coming save is written, or after `ms` if none comes (nothing was saved: a fall). */
  then(fn: () => void, ms = 2000): void {
    this.cancel()
    this.next = { run: fn, timer: setTimeout(() => this.written(), ms) }
  }

  /** A save is written: what waited for it runs, once. */
  written(): void {
    const n = this.next
    if (!n) return
    clearTimeout(n.timer)
    this.next = undefined
    n.run()
  }

  cancel(): void {
    if (this.next) clearTimeout(this.next.timer)
    this.next = undefined
  }
}
