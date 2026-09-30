import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, compareSpec, patternsOverlap, specOf } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

describe('the Hearthvale opening', () => {
  it('talking to the elder starts the slime errand, and only the first time', () => {
    const eng = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { quest: 0, slimes: 0 } },
          { key: 'npc.maren', type: 'actor/person/elder', x: 2, y: 1 },
        ],
        event: {},
      },
      onto,
      lib(),
    )
    const r = eng.interact('interact', 'actor', { e: 'npc.maren' })
    expect(r.rule?.id).toBe('story/maren-1')
    expect(eng.world.num(eng.world.get('actor')!, 'quest')).toBe(1)
    // second time: ordinary talk
    expect(eng.interact('interact', 'actor', { e: 'npc.maren' }).rule?.id).toBe('core/talk')
  })

  it('the third slime defeated advances to the smith', () => {
    const eng = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 3, props: { quest: 1, slimes: 0, atk: 50 } },
          { key: 's1', type: 'actor/creature/slime/green_slime', x: 1, y: 2 },
          { key: 's2', type: 'actor/creature/slime/green_slime', x: 2, y: 2 },
          { key: 's3', type: 'actor/creature/slime/green_slime', x: 3, y: 2 },
        ],
        event: {},
      },
      onto,
      lib(),
    )
    for (const k of ['s1', 's2', 's3']) eng.queue({ kind: 'hit', roles: { actor: { e: 'actor' }, target: { e: k } }, power: 50 })
    const p = eng.world.get('actor')!
    expect(eng.world.num(p, 'slimes')).toBe(3)
    expect(eng.world.num(p, 'quest')).toBe(2)
  })

  it('story rules never tie with base rules', () => {
    const all = [...BASE_RULES, ...STORY_RULES]
    const ties: string[] = []
    for (const a of STORY_RULES)
      for (const b of all) {
        if (a === b || a.on !== b.on || a.compose || b.compose) continue
        if (compareSpec(specOf(a), specOf(b)) === 0 && patternsOverlap(a, b, onto)) ties.push(`${a.id} ~ ${b.id}`)
      }
    expect(ties).toEqual([])
  })
})
