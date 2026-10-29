// Where an element is carried and the answer the base would give does not read it, the outcome is undefined (the AI
// answers: a fire axe burns, a frost one freezes; with no model, the answer as it was runs). The cases the world was
// found to get wrong: a hen struck down by a fire axe came out raw (every step of the chain defined, so nothing was
// ever asked); a rope held out to a fire slime lashed it down as it does a green one. And what must stay as it is: a
// plain axe, a person pushed.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, scenarioEvent, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const player = { key: 'actor', type: 'actor/person/player', x: 2, y: 2 }

/** Play the event and the chain it starts; what each event was answered by (undefined: a question), and what is left. */
function play(sc: Scenario) {
  const eng = buildSandbox(sc, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const mark = eng.traced
  eng.dispatch(scenarioEvent(sc, eng))
  for (let t = 0; t < 10; t++) eng.tick()
  const chain = eng.trace.slice(Math.max(0, eng.trace.length - (eng.traced - mark))).filter((e) => !e.ev.kind.startsWith('time/') && !e.ev.kind.startsWith('contact/'))
  return { asked: chain.filter((e) => !e.defined).map((e) => `${e.ev.kind} ${e.rule}`), answered: chain.filter((e) => e.defined).map((e) => e.rule), left: Object.values(eng.world.state.entities).map((e) => e.type) }
}

const axe = (element?: string) => ({ key: 'axe', type: 'item/weapon/blade/axe', x: 2, y: 2, heldBy: 'actor', ...(element && { props: { element } }) })
const swing = (target: { key: string; type: string; x: number; y: number }, element?: string): Scenario => ({ entities: [player, axe(element), target], event: { kind: 'act/use', host: 'axe', actor: 'actor', instrument: 'axe', target: target.key } })
const rope = (slime: string): Scenario => ({ entities: [player, { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' }, { key: 'slime', type: `actor/creature/slime/${slime}`, x: 3, y: 2 }], event: { kind: 'act/use', host: 'rope', actor: 'actor', instrument: 'rope', target: 'slime' } })
const hen = { key: 'hen', type: 'actor/creature/animal/chicken', x: 3, y: 2 }

describe('an element the answer does not read', () => {
  it('asks what a weapon of an element does, whatever it strikes; with no model it is the blow it was', () => {
    const fire = play(swing(hen, 'fire'))
    expect(fire.asked).toEqual(['act/use use/blade'])
    // (the hole's default: the blow as before, the hen felled, its meat raw)
    expect(fire.left).toContain('item/food/chicken/raw')
    for (const target of [{ key: 'wolf', type: 'actor/creature/beast/wolf', x: 3, y: 2 }, { key: 'barrel', type: 'fixture/container/barrel', x: 3, y: 2 }]) expect(play(swing(target, 'ice')).asked, target.type).toEqual(['act/use use/blade'])
    // a plain axe strikes as it always has: nothing asked
    const plain = play(swing(hen))
    expect(plain.asked).toEqual([])
    expect(plain.answered.slice(0, 2)).toEqual(['use/blade', 'combat/struck'])
  })

  it('asks what a rope held out to a slime of an element does; a green slime is lashed down as before', () => {
    for (const s of ['fire_slime', 'frost_slime', 'spark_slime']) expect(play(rope(s)).asked, s).toEqual(['impulse/offered creature/offered'])
    const green = play(rope('green_slime'))
    expect(green.asked).toEqual([])
    expect(green.answered).toContain('creature/offered')
  })

  it('asks nothing of what has a defined answer and no element: a person pushed, a wolf struck with a plain axe', () => {
    expect(play({ entities: [player, { key: 'p', type: 'actor/person/ferrykeeper', x: 3, y: 2 }], event: { kind: 'impulse/push', host: 'p', source: 'actor', params: { dir: 'right' } } }).asked).toEqual([])
    expect(play(swing({ key: 'wolf', type: 'actor/creature/beast/wolf', x: 3, y: 2 })).asked).toEqual([])
  })
})
