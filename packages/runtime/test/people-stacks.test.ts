import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Frame, ItemInfo } from '@openworld/engine'
import { PeoplePanels, type PeopleSend } from '../src/ui/people.ts'
import { locale } from '../src/ui/common.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))
// Keep real stack rendering; shared window chrome and focus are covered by browser tests.
vi.mock('../src/ui/components/index.ts', () => ({ mountWindow: (surface: HTMLElement) => surface }))

class PanelElement {
  innerHTML = ''
  onclick?: () => void
  classList = { toggle: () => {} }
  querySelectorAll(selector: string) {
    const action = selector.slice('[data-'.length, -1)
    return [...this.innerHTML.matchAll(new RegExp(`data-${action}="([^"]+)"`, 'g'))].map((match) => ({
      dataset: { [action]: match[1] },
      onclick: undefined as (() => void) | undefined,
    }))
  }
}

/** Only the DOM used by these panels; assertions inspect the real rendered rows. */
function panels() {
  const elements = new Map(['tradePanel', 'tradeSheet', 'tradeX', 'pocketsPanel', 'pocketsSheet', 'pocketsX'].map((id) => [`#${id}`, new PanelElement()]))
  vi.stubGlobal('document', {
    createElement: () => new PanelElement(),
    body: { appendChild: () => {} },
    querySelector: (selector: string) => elements.get(selector) ?? null,
  })
  const send: PeopleSend = { trade: vi.fn(), closeTrade: vi.fn(), pocket: vi.fn(), closePockets: vi.fn(), gift: vi.fn(), closeGift: vi.fn() }
  return { view: new PeoplePanels(send), html: (sheet: string) => elements.get(`#${sheet}`)!.innerHTML }
}

// Stack keys are opaque identities supplied by the worker, including on a page with no World of its own.
const item = (id: string, type: string, key: string): ItemInfo => ({ id, type, stackKey: key, name: 'Thing', sprite: '', tags: [], statuses: [], props: {} })
const frame = (more: Pick<Frame, 'trade' | 'pockets'>): Frame => ({
  tick: 0, hour: 12, night: { dusk: 21, dawn: 6 }, calendar: { day: 1, hour: 12, minute: 0, weather: 'sun' }, map: 'test',
  player: {
    id: 'player', x: 0, y: 0, facing: 'down', hp: 40, maxHp: 40, hunger: 0, maxHunger: 0,
    statuses: [], props: {}, skills: [], stations: [], skillbar: [], actives: [], inventory: [], slots: [], selected: 0,
    worn: {}, stats: { atk: 1, def: 0, critChance: 0, power: 1 }, purse: 100,
  },
  facts: {}, entities: [], tiles: [], fx: [], quests: { marks: {}, journal: [], targets: [], board: [] },
  ...more,
})
const trade = (goods: NonNullable<Frame['trade']>['goods'], offers: NonNullable<Frame['trade']>['offers'] = []): NonNullable<Frame['trade']> => ({ who: 'merchant', name: 'Merchant', goods, offers, purse: 100, theirs: 100 })
const buttons = (html: string, action: string) => [...html.matchAll(new RegExp(`data-${action}="([^"]+)"`, 'g'))].map((match) => match[1])

afterEach(() => {
  vi.unstubAllGlobals()
  locale.value = 'en'
})

describe('people panels preserve the worker stack identities', () => {
  it.each(['item/weapon/sword', 'item/tool/pickaxe', 'item/armor/helmet', 'item/valuable/ring'])('shows each %s separately when buying', (type) => {
    const { view, html } = panels()
    view.onFrame(frame({ trade: trade([
      { item: item('first', type, 'piece:first'), price: 10, count: 1 },
      { item: item('second', type, 'piece:second'), price: 10, count: 1 },
    ]) }))
    expect(buttons(html('tradeSheet'), 'buy')).toEqual(['first', 'second'])
    expect(html('tradeSheet')).not.toContain('×2')
  })

  it('keeps same-price equipment offers individually selectable when selling', () => {
    const { view, html } = panels()
    view.onFrame(frame({ trade: trade([], [
      { item: item('first', 'item/weapon/sword', 'piece:first'), price: 10, count: 1 },
      { item: item('second', 'item/weapon/sword', 'piece:second'), price: 10, count: 1 },
    ]) }))
    expect(buttons(html('tradeSheet'), 'sell')).toEqual(['first', 'second'])
    expect(html('tradeSheet')).not.toContain('×2')
  })

  it('keeps worn and spare pieces separate in another person\'s pockets', () => {
    const { view, html } = panels()
    view.onFrame(frame({ pockets: { id: 'person', name: 'Person', contents: [
      { ...item('worn', 'item/armor/helmet', 'piece:worn'), worn: true },
      item('spare', 'item/armor/helmet', 'piece:spare'),
    ] } }))
    expect(buttons(html('pocketsSheet'), 'take')).toEqual(['worn', 'spare'])
    expect(html('pocketsSheet')).not.toContain('×2')
  })

  it('does not merge same-name things with different individual state', () => {
    const { view, html } = panels()
    view.onFrame(frame({ trade: trade([
      { item: item('letter-a', 'item/document/letter', 'letter:text-a'), price: 1 },
      { item: item('letter-b', 'item/document/letter', 'letter:text-b'), price: 1 },
    ]) }))
    expect(buttons(html('tradeSheet'), 'buy')).toEqual(['letter-a', 'letter-b'])
  })

  it('still combines identical materials and sums already compressed quantities', () => {
    const { view, html } = panels()
    view.onFrame(frame({ trade: trade([
      { item: item('stones-a', 'item/material/stone', 'stone'), price: 1, count: 999 },
      { item: item('stones-b', 'item/material/stone', 'stone'), price: 1, count: 2001 },
    ]) }))
    expect(buttons(html('tradeSheet'), 'buy')).toEqual(['stones-a'])
    expect(html('tradeSheet')).toContain('×3000')
  })

  it('keeps different prices and ownership warnings separate for one material', () => {
    const { view, html } = panels()
    view.onFrame(frame({ trade: trade([], [
      { item: item('cheap', 'item/material/stone', 'stone'), price: 1 },
      { item: item('dear', 'item/material/stone', 'stone'), price: 2 },
      { item: { ...item('stolen', 'item/material/stone', 'stone'), steal: true }, price: 1 },
    ]) }))
    expect(buttons(html('tradeSheet'), 'sell')).toEqual(['cheap', 'dear', 'stolen'])
    expect(html('tradeSheet')).toContain('not yours')
  })
})
