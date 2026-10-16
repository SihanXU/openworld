// The item tooltip (ui/tooltip.ts): its words come from the game — a rolled extra's name from the world's table of
// them (Ontology.affixes), a trophy's from the interface words a game may say its own way — and a piece's critical
// chance is said once, wherever it is worn (an off-hand piece's was said twice).

import { describe, expect, it, vi } from 'vitest'
import type { ItemInfo, Ontology } from '@openworld/engine'
import { game, useGame, type ClientGame } from '../src/game.ts'
import { tooltipHtml } from '../src/ui/tooltip.ts'

// (the tooltip reaches the renderer's text helper; only Phaser's browser base is mocked)
vi.mock('phaser', () => ({ default: { Scene: class {} } }))

const onto = (more: Partial<Ontology> = {}): Ontology => ({ types: {}, statuses: {}, terrains: {}, elements: [], vfx: [], ...more }) as Ontology
function play(o: Ontology, texts?: ClientGame['texts']): void {
  useGame({ id: 'test', ontology: () => o, items: { forms: {}, materials: {}, relics: {}, coin: 'item/coin' }, skills: { all: [], professions: [] }, ...(texts && { texts }) } as unknown as ClientGame)
}
const item = (type: string, props: ItemInfo['props'], tags: string[] = []): ItemInfo => ({ id: 'it', type, sprite: '', name: 'Thing', tags, statuses: [], props })
const text = (html: string) => html.replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean)
const times = (lines: string[], word: string) => lines.filter((l) => l.includes(word)).length

describe('the item tooltip', () => {
  it('renders the current game item descriptions as escaped text', () => {
    play(onto())
    Object.assign(game(), { describeItem: (it: ItemInfo) => [{ en: `Charges: ${it.props.charges} <safe>` }] })
    const ctx = { atk: 1, nameOf: () => undefined }
    const html = tooltipHtml(item('item/tool', { charges: 3 }), ctx)
    expect(html).toContain('Charges: 3 &lt;safe&gt;')
    expect(tooltipHtml(item('item/tool', { charges: 0 }), ctx)).toContain('Charges: 0')
  })
  it("says a piece's critical chance once, in the off hand, on the body or in the main hand", () => {
    play(onto())
    const ctx = { atk: 1, nameOf: () => undefined }
    for (const slot of ['arm', 'body', 'weapon', undefined]) {
      const lines = text(tooltipHtml(item('item/armor/shield', { ...(slot && { slot }), critChance: 0.05, ...(slot === 'weapon' && { power: 3 }) }), ctx))
      expect(times(lines, 'Critical Chance'), String(slot)).toBe(1)
    }
  })

  it("names a rolled extra as the world's table does, a share as a percentage; one it does not name, by its key", () => {
    play(onto({ affixes: { count: 1, pool: [{ key: 'critChance', min: 0.01, max: 0.05, step: 0.01, name: { en: 'Keen Edge', zh: '锋锐' }, percent: true }, { key: 'atk', min: 1, max: 3, step: 1 }] } }))
    const lines = text(tooltipHtml(item('item/armor/ring', { slot: 'ring', 'sub:critChance': 0.03, 'sub:atk': 2, 'sub:moveHaste': 0.02 }), { atk: 1, nameOf: () => undefined }))
    expect(lines).toContain('+3% Keen Edge')
    expect(lines).toContain('+2 Atk')
    expect(lines).toContain('+0.02 MoveHaste')
  })

  it("calls a trophy as the game calls it, and says whose it is", () => {
    const o = onto({ types: { 'actor/creature/wolf': { id: 'actor/creature/wolf', name: 'Wolf', props: { trophy: 'item/armor/fang' } } } })
    play(o)
    expect(text(tooltipHtml(item('item/armor/fang', {}, ['trophy']), { atk: 1, nameOf: () => undefined }))).toContain('✧ Trophy · dropped by Wolf')
    play(o, { tipTrophy: { en: 'Wolf-sign', zh: '狼印' } })
    expect(text(tooltipHtml(item('item/armor/fang', {}, ['trophy']), { atk: 1, nameOf: () => undefined }))).toContain('✧ Wolf-sign · dropped by Wolf')
  })

  it("tells a quality's lore only where the game has words for it", () => {
    play(onto())
    expect(text(tooltipHtml(item('item/armor/helm', {}, ['quality:vowed']), { atk: 1, nameOf: () => undefined })).join(' ')).not.toContain('Vowbound')
    play(onto(), { 'tier:vowed': { en: 'Vowbound — it still remembers.' } })
    expect(text(tooltipHtml(item('item/armor/helm', {}, ['quality:vowed']), { atk: 1, nameOf: () => undefined }))).toContain('Vowbound — it still remembers.')
  })
})
