import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const rings = [
  { ring: 1, materials: ['10 Logs', '10 Stones'], prerequisite: 'Prerequisite: none' },
  { ring: 2, materials: ['20 Planks', '5 Iron ore'], prerequisite: 'Land level ≥ 1' },
  { ring: 3, materials: ['30 Planks', '30 Stones', '3 Gold ore'], prerequisite: 'Land level ≥ 2' },
] as const

describe('the Held Ground mist', () => {
  it.each(rings)('right-clicking ring $ring explains its data-backed land upgrade without changing it', ({ ring, materials, prerequisite }) => {
    const eng = buildSandbox({
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'rod', type: 'item/tool/fishing_rod', x: 2, y: 2, heldBy: 'actor' },
        { key: 'mist', type: 'fixture/nature/mist', x: 2, y: 1, props: { ring } },
      ],
      residents: { story: { 'haven.size': ring - 1 } },
      event: {},
    }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    eng.controls.sync()

    const plan = eng.controls.plan('hands', { x: 2, y: 1 })!
    expect(plan).toMatchObject({ key: 'hands', verb: 'hands', target: { e: 'mist' } })
    expect(plan.instrument).toBeUndefined()
    const event = eng.actEvent(plan.verb!, 'actor', plan.target, plan.instrument)
    expect(event).toMatchObject({
      kind: 'act/hands', host: { e: 'actor' }, roles: { actor: { e: 'actor' }, target: { e: 'mist' } }, params: { verb: 'hands' },
    })
    eng.controls.run(plan)

    expect(plan.unknown).toBeFalsy()
    const firstGuide = JSON.stringify(eng.world.fx.find((fx) => fx.t === 'log')?.text)
    expect(firstGuide).toContain(`Ring ${ring}`)
    expect(firstGuide).toContain('Alberic')
    expect(firstGuide).toContain(prerequisite)
    for (const material of materials) expect(firstGuide).toContain(material)
    expect(firstGuide).toContain('completion reward')
    expect(eng.world.fact('haven.size')).toBe(ring - 1)
    expect(eng.world.get('mist')).toBeDefined()

    const hands = eng.controls.plan('hands')!
    expect(hands).toMatchObject({ verb: 'hands', target: { e: 'mist' } })
    expect(hands.unknown).toBeFalsy()
    expect(hands.instrument).toBeUndefined()
    eng.controls.run(hands)
    expect(eng.world.fx.filter((fx) => fx.t === 'log' && JSON.stringify(fx.text).includes('Alberic'))).toHaveLength(2)
  })

  it('leaves an unknown tool use on the mist unanswered', () => {
    const eng = buildSandbox({
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'rod', type: 'item/tool/fishing_rod', x: 2, y: 2, heldBy: 'actor' },
        { key: 'mist', type: 'fixture/nature/mist', x: 2, y: 1, props: { ring: 1 } },
      ],
      residents: { story: { 'haven.size': 0 } },
      event: {},
    }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    eng.controls.sync()

    expect(eng.controls.plan('use', { x: 2, y: 1 })).toMatchObject({ verb: 'use', target: { e: 'mist' }, instrument: { e: 'rod' }, unknown: true })
  })

  it('still lifts a ring on its existing time period once the land reaches it', () => {
    const eng = buildSandbox({
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'mist', type: 'fixture/nature/mist', x: 2, y: 1, props: { ring: 1 } },
      ],
      residents: { story: { 'haven.size': 1 } },
      event: {},
    }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    eng.author(() => { eng.world.state.tick = 29 })

    eng.tick()

    expect(eng.trace.some((t) => t.ev.kind === 'time/period' && t.ev.host.e === 'mist' && t.rule === 'haven/mist-lifts')).toBe(true)
    expect(eng.world.get('mist')).toBeUndefined()
  })
})
