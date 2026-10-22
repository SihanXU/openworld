import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FxEvent } from '@openworld/engine'
import { Hud } from '../src/ui/hud.ts'
import { locale } from '../src/ui/common.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))

class Element {
  textContent = ''
  className = ''
  innerHTML = ''
  readonly children: Element[] = []
  readonly classList = { add: vi.fn() }
  appendChild(child: Element): void { this.children.push(child) }
}

/** Only the message and flying-icon DOM used by onFx; the rest of the HUD is not built. */
function hud() {
  const labels = new Element()
  const messages = new Element()
  vi.stubGlobal('document', {
    createElement: () => new Element(),
    querySelector: (selector: string) => selector === '#labels' ? labels : selector === '#msgs' ? messages : null,
  })
  vi.useFakeTimers()
  const now = vi.spyOn(performance, 'now').mockReturnValue(0)
  const view = Object.create(Hud.prototype) as Hud
  Object.assign(view, {
    screenOfTile: () => ({ x: 0, y: 0 }), flyers: [], pickupSig: new Map(),
  })
  return { view, labels, messages, now }
}

const pickup = (count?: number): FxEvent & { t: 'pickup' } => ({
  t: 'pickup', item: 'bait', sprite: 'item:bait', name: { en: 'Bait', zh: '鱼饵' },
  map: 'haven', x: 1, y: 1, ...(count === undefined ? {} : { count }),
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  locale.value = 'en'
})

describe('pickup quantity messages', () => {
  it('shows all five pieces in one event without creating five flyers', () => {
    const { view, labels, messages } = hud()
    view.onFx(pickup(5))
    expect(messages.children.map((el) => el.textContent)).toEqual(['+5 Bait'])
    expect(labels.children).toHaveLength(1)
  })

  it('sums quantities from consecutive batches, rather than counting events', () => {
    const { view, messages } = hud()
    view.onFx(pickup(5))
    view.onFx(pickup(3))
    expect(messages.children.map((el) => el.textContent)).toEqual(['+8 Bait'])
  })

  it('keeps old single-piece events compatible with counted batches', () => {
    const { view, messages } = hud()
    view.onFx(pickup())
    expect(messages.children[0].textContent).toBe('+1 Bait')
    view.onFx(pickup(5))
    expect(messages.children[0].textContent).toBe('+6 Bait')
  })

  it('starts a fresh quantity when the previous message aggregation expires', () => {
    const { view, messages, now } = hud()
    view.onFx(pickup(5))
    now.mockReturnValue(2600)
    view.onFx(pickup(2))
    expect(messages.children.map((el) => el.textContent)).toEqual(['+5 Bait', '+2 Bait'])
  })

  it('shows coin proceeds separately from purchased bait in the current language', () => {
    const { view, messages } = hud()
    locale.value = 'zh'
    view.onFx(pickup(5))
    view.onFx({ ...pickup(6), item: 'coin', sprite: 'item:coin', name: { en: 'Thornmark', zh: '晨辉币' } })
    expect(messages.children.map((el) => el.textContent)).toEqual(['+5 鱼饵', '+6 晨辉币'])
  })
})
