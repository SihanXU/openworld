import { describe, expect, it } from 'vitest'
import { Engine, RuleLibrary, buildSandbox, type GameEvent, type Scenario, type UndefinedSink } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '@lsw/content'
import { FRONT, ORIGIN } from '../src/coverage.ts'

// The safe defaults (design.md §5.5, layer 3): what an undefined interaction does when nobody
// answers it. They never define the interaction — the Mod port is still asked first.

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
  eng.world.get('actor')!.facing = 'up'
  eng.world.add({ id: 'held', type: held, place: { on: 'hand', holder: 'actor' } })
  if (sink) eng.undefinedSink = sink
  return eng
}

describe('safe defaults', () => {
  it('a log put on a grass tuft is set down there with no modder, and can be taken back', () => {
    const eng = setup('fixture/nature/tuft', 'item/material/log')
    const res = eng.playerVerb('put')
    expect(res?.defined).toBe(false)
    const actor = eng.world.get('actor')!
    expect(actor.held).not.toBe('held')
    expect(eng.world.posOf(eng.world.get('held')!)).toMatchObject(FRONT)
    eng.playerVerb('take', false, 'held')
    expect(actor.held).toBe('held')
  })

  it('still asks the Mod port first: the default runs only when nobody answers', () => {
    const raised: GameEvent[] = []
    const eng = setup('fixture/nature/tuft', 'item/material/log', { raise: (ev) => void raised.push(ev), tick: () => {} })
    eng.playerVerb('put')
    expect(raised).toHaveLength(1)
    expect(eng.world.get('actor')!.held).toBe('held')
    eng.fallback(raised[0])
    expect(eng.world.get('actor')!.held).not.toBe('held')
  })

  it('bare hands on a fixture nothing defines examine it instead of "Nothing happens"', () => {
    const eng = setup('fixture/nature/boulder', 'item/material/log')
    eng.world.get('actor')!.held = undefined
    eng.world.destroy(eng.world.get('held')!)
    eng.world.fx.length = 0
    eng.interact('interact', 'actor', { e: 'target' }, { instrument: null, strict: true })
    expect(JSON.stringify(eng.world.fx)).toContain('这是')
  })

  it('a creature has no use for what is put on it: it stays in hand', () => {
    const eng = setup('actor/creature/slime/green_slime', 'item/material/log')
    eng.playerVerb('put')
    expect(eng.world.get('actor')!.held).toBe('held')
  })
})
