// Postures (design.md §5.17): a thing whose use is a posture asks the one who used it to take it (the settle
// impulse), and every actor answers: it goes onto the thing's cell, holds the posture's status, and is drawn in
// that pose, until it moves on. A chair's learned answer is then one rule on the chair's side.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, snapshot, validatePatch, type Engine, type Rule } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const SIT: Rule = {
  id: 'patch/chair-sit',
  host: { type: 'fixture/furniture/chair' },
  on: 'impulse/handle',
  hole: 'core/handle',
  at: [],
  doc: 'A chair is sat on.',
  tree: { do: [{ op: 'emit', impulse: 'settle', to: 'actor', params: { pose: 'sit' } }, { op: 'log', text: { en: 'You sit down.', zh: '你坐了下来。' } }], label: { en: 'Sit on {target}', zh: '坐到{target}上' } },
  source: { origin: 'patch' },
}

/** The tutorial's clearing, a chair beside the player at (20, 12), and a person beside it. */
function room(): { eng: Engine; chair: string; person: string } {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]), 'tutorial')
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const w = eng.world
  const p = w.player
  const { chair, person } = eng.author(() => {
    eng.teleport(p, { map: 'tutorial', x: 20, y: 12 })
    w.clearStatus({ e: p.id }, 'out_cold')
    const chair = w.create('fixture/furniture/chair', { on: 'tile', map: 'tutorial', x: 21, y: 12 })
    const person = w.create('actor/person', { on: 'tile', map: 'tutorial', x: 21, y: 13 })
    return { chair: chair.id, person: person.id }
  })
  eng.tick()
  return { eng, chair, person }
}

describe('postures', () => {
  it('a chair that asks to be sat on seats whoever uses it, drawn sitting, until they walk off', () => {
    const { eng, chair } = room()
    const w = eng.world
    const p = w.player
    eng.lib.add(SIT)
    eng.act('hands', p.id, { e: chair }, { instrument: null })
    eng.tick()
    expect(w.hasStatus({ e: p.id }, 'seated')).toBe(true)
    expect(w.posOf(p)).toMatchObject({ x: 21, y: 12 })
    expect(snapshot(eng).entities.find((e) => e.id === p.id)?.pose).toBe('sit')
    // a step off the chair stands one up
    eng.act('move', p.id, { e: p.id }, { instrument: null, params: { dir: 'left' } })
    eng.tick()
    expect(w.posOf(p)).toMatchObject({ x: 20, y: 12 })
    expect(w.hasStatus({ e: p.id }, 'seated')).toBe(false)
    expect(snapshot(eng).entities.find((e) => e.id === p.id)?.pose).toBeUndefined()
  })

  it('anyone answers it, not the player only; a chair taken is not sat on twice', () => {
    const { eng, chair, person } = room()
    const w = eng.world
    eng.lib.add(SIT)
    eng.act('hands', person, { e: chair }, { instrument: null })
    eng.tick()
    expect(w.hasStatus({ e: person }, 'seated')).toBe(true)
    expect(w.posOf(w.get(person)!)).toMatchObject({ x: 21, y: 12 })
    // the player tries the same chair: it holds a body already, so they sit where they are, beside it
    const p = w.player
    eng.act('hands', p.id, { e: chair }, { instrument: null })
    eng.tick()
    expect(w.posOf(p)).toMatchObject({ x: 20, y: 12 })
  })

  it('a thing that is no actor has no answer of its own to a settle (the root leaves it open)', () => {
    const { eng, chair } = room()
    const res = eng.resolveEvent({ kind: 'impulse/settle', host: { e: chair }, roles: { source: { e: chair } }, params: { pose: 'sit' } })
    expect(res.defined).toBe(false)
  })

  it('the validator takes a learned status with a pose the world can draw, and refuses one it cannot', () => {
    const onto = buildOntology()
    const lib = new RuleLibrary([...BASE_RULES])
    const status = (pose: string) => ({ kind: 'status' as const, status: { id: `meditating_${pose}`, name: { en: 'meditating', zh: '冥想' }, pose, untilMove: true } })
    const rule = (pose: string) => ({ kind: 'rule' as const, rule: { ...SIT, id: `patch/x-${pose}`, tree: { do: [{ op: 'emit' as const, impulse: 'settle' as const, to: 'actor' as const, params: { pose: 'kneel', status: `meditating_${pose}` } }, { op: 'log' as const, text: { en: 'You kneel.', zh: '你跪下。' } }] } } })
    expect(validatePatch({ artifacts: [status('kneel'), rule('kneel')] }, { ontology: onto, library: lib }).errors).toEqual([])
    expect(validatePatch({ artifacts: [status('handstand'), rule('handstand')] }, { ontology: onto, library: lib }).errors.join(' ')).toMatch(/pose "handstand"/)
  })
})
