// A panel drawn again whole keeps where its lists were scrolled to (scroll.ts): on a click or an autosave the page
// no longer jumps back to the top. Checked over a small stand-in for the DOM (children, parents, scroll offsets).

import { describe, expect, it } from 'vitest'
import { keepScroll } from '../src/app/scroll.ts'

class El {
  children: El[] = []
  parentElement: El | null = null
  scrollTop = 0
  scrollLeft = 0
  add(...kids: El[]): this {
    for (const k of kids) (k.parentElement = this), this.children.push(k)
    return this
  }
  /** innerHTML's effect: every child new, scrolled to the top. */
  redraw(shape: (root: El) => void): void {
    this.children = []
    shape(this)
  }
  querySelectorAll(): El[] {
    return this.children.flatMap((c) => [c, ...c.querySelectorAll()])
  }
}
const panel = (root: El) => root.add(new El(), new El().add(new El(), new El()))
const list = (root: El) => root.children[1].children[1]

describe('a panel drawn again', () => {
  it('keeps the scroll of the panel and of a list inside it, in the same mode', () => {
    const root = panel(new El())
    keepScroll('database', [root as never], () => undefined)
    root.scrollTop = 40
    list(root).scrollTop = 1500
    keepScroll('database', [root as never], () => root.redraw(panel))
    expect(root.scrollTop).toBe(40)
    expect(list(root).scrollTop).toBe(1500)
  })

  it('starts another mode\'s lists at the top', () => {
    const root = panel(new El())
    keepScroll('database', [root as never], () => undefined)
    list(root).scrollTop = 1500
    keepScroll('story', [root as never], () => root.redraw(panel))
    expect(list(root).scrollTop).toBe(0)
  })
})
