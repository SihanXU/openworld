import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

describe('equipping through the bag while the weapon is drawn', () => {
  it.each(['item/weapon/blade/sword', 'item/weapon/magic/staff', 'item/weapon/polearm/spear', 'item/weapon/blunt/mace'])('%s equips and comes off without striking its wearer', (type) => {
    const eng = buildSandbox({
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2, statuses: ['drawn'], props: { profession: type.includes('/magic/') ? 'mage' : 'warrior', level: 20 } },
        { key: 'weapon', type, x: 2, y: 2, inside: 'actor' },
      ],
      event: {},
    }, buildOntology(), new RuleLibrary(BASE_RULES))
    const w = eng.world, p = w.player
    eng.controls.sync()
    const hp = w.num(p, 'hp')
    eng.controls.wear('weapon', true)
    expect(w.num(p, 'hp')).toBe(hp)
    expect(w.prop(p, 'wear:weapon')).toBe('weapon')
    eng.controls.wear('weapon')
    expect(w.prop(p, 'wear:weapon')).toBeUndefined()
    expect(w.num(p, 'hp')).toBe(hp)
    expect(eng.trace.some((t) => t.ev.kind === 'impulse/strike')).toBe(false)
  })
})
