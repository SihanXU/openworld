import { describe, expect, it } from 'vitest'
import { Engine, RuleLibrary, buildSandbox, type GameEvent, type Resolution, type Scenario, type UndefinedSink } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '@lsw/content'
import { FRONT, ORIGIN } from '../src/coverage.ts'

// What happens when the world has no answer (design.md §5.9, the leaf's default): putting a thing
// on something nothing defines is undefined — the AI is asked first — and with no answer it is set
// down on that thing's tile (`fixture/receive`). The user asked for it: without a model, wood
// put on grass must still go down.

const onto = buildOntology()
const lib = new RuleLibrary(BASE_RULES)

function setup(target: string, held: string, sink?: UndefinedSink): Engine {
  const sc: Scenario = {
    terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
    entities: [{ key: 'actor', type: 'actor/person/player', ...ORIGIN }, { key: 'target', type: target, ...FRONT }],
    event: {},
  }
  const start = buildSandbox(sc, onto, lib)
  const eng = new Engine(structuredClone(start.world.state), start.world.onto.data, lib)
  eng.world.state.player = 'actor'
  eng.world.get('actor')!.facing = 'up'
  eng.world.write(() => eng.world.add({ id: 'held', type: held, place: { on: 'hand', holder: 'actor' } }))
  if (sink) eng.undefinedSink = sink
  return eng
}

describe('the defaults of undefined outcomes', () => {
  it('a log put on a grass tuft is set down there with no modder, and can be taken back', () => {
    const eng = setup('fixture/nature/tuft', 'item/material/log')
    eng.act('put', 'actor', { e: 'target' })
    const actor = eng.world.get('actor')!
    expect(actor.held).not.toBe('held')
    expect(eng.world.posOf(eng.world.get('held')!)).toMatchObject(FRONT)
    eng.act('take', 'actor', { e: 'held' }, { instrument: null })
    expect([actor.held, ...(actor.contents ?? [])]).toContain('held')
  })

  it('the AI is asked first: a modder holding the event keeps the log in hand until it answers', () => {
    const raised: [GameEvent, Resolution][] = []
    const eng = setup('fixture/nature/tuft', 'item/material/log', { raise: (ev, res) => (raised.push([ev, res]), true), tick: () => {} })
    eng.act('put', 'actor', { e: 'target' })
    expect(raised.map(([, r]) => r.hole?.rule.id)).toEqual(['fixture/receive'])
    expect(eng.world.get('actor')!.held).toBe('held')
  })

  it('a creature has no use for what is put on it: it stays in hand', () => {
    const eng = setup('actor/creature/slime/green_slime', 'item/material/log')
    eng.act('put', 'actor', { e: 'target' })
    expect(eng.world.get('actor')!.held).toBe('held')
  })
})
