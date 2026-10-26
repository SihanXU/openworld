// The upstream loop's detector (docs/upstream.md §2): sibling types whose learned rules answer one
// hole alike make a candidate for a base rule on their class; a differing tree stays apart; a hole
// a class keeps falling into is a candidate even before its answers converge.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type Patch, type Scenario, type Tree } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { WorldLibrary, askedCounts, candidates, lowestCommonAncestor, normalKey, normalizeTree } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const SLIME = 'actor/creature/slime'
const OFFERED_HOLE = 'core/offered'

const scene = (type: string): Scenario => ({
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type, x: 2, y: 1 },
  ],
  event: {},
})

/** A stone used on a creature is held out to it (core/use): the creature's `offered` is the hole the port asks about. */
function askOffered(type: string, lib: RuleLibrary) {
  const eng = buildSandbox(scene(type), onto, lib)
  const port = new ModPort(eng)
  eng.act('use', 'actor', { e: 'it' })
  return port.records[0].request
}

const SEIZE: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'addStatus', status: 'frozen', duration: 30 }, { op: 'log', text: 'It seizes up around the stone.' }] }, else: { undefined: true } }
const SOAK: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'addStatus', status: 'wet', duration: 30 }] }, else: { undefined: true } }

/** The shared library with one learned answer per slime type at the offered hole, each in the scene that asked. */
export function slimeLibrary(answers: Record<string, Tree>): WorldLibrary {
  const library = new WorldLibrary(onto, BASE)
  for (const [type, tree] of Object.entries(answers)) {
    const req = askOffered(type, library.lib)
    const short = type.split('/').pop()!
    const draft: Patch = { artifacts: [{ kind: 'rule', rule: { id: `patch/${short}-stone`, host: { type: 'x' }, on: 'x', label: { en: 'Press {instrument} to {target}', zh: '把{instrument}按在{target}上' }, doc: `${short}: a stone held out`, tree } }] }
    const placed = placePatch(draft, req).patch
    const r = library.commit(placed, req)
    expect(r.result.errors, `${short}: ${r.result.errors.join('; ')}`).toEqual([])
  }
  return library
}

describe('the lowest common ancestor', () => {
  it('is the deepest shared prefix below the root, never the root alone', () => {
    expect(lowestCommonAncestor([`${SLIME}/green_slime`, `${SLIME}/fire_slime`, `${SLIME}/frost_slime`])).toBe(SLIME)
    expect(lowestCommonAncestor([`${SLIME}/green_slime`, 'actor/creature/wolf'])).toBe('actor/creature')
    expect(lowestCommonAncestor([`${SLIME}/green_slime`, 'actor/person/villager'])).toBeUndefined()
    expect(lowestCommonAncestor([`${SLIME}/green_slime`])).toBe(`${SLIME}/green_slime`)
    expect(lowestCommonAncestor([])).toBeUndefined()
  })
})

describe('tree equivalence', () => {
  it('keeps the conditions and the effects, drops the wording, and abstracts the host\'s own type', () => {
    const a: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'transform', into: `${SLIME}/green_slime` }, { op: 'log', text: 'green' }, { op: 'vfx', fx: 'dust' }], label: 'Press' }, else: { undefined: true } }
    const b: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'transform', into: `${SLIME}/fire_slime` }, { op: 'log', text: { en: 'fire', zh: '火' } }, { op: 'vfx', fx: 'smoke' }], label: 'Push', confirm: 'Sure?' }, else: { undefined: true } }
    expect(normalKey(a, `${SLIME}/green_slime`)).toBe(normalKey(b, `${SLIME}/fire_slime`))
    expect(JSON.stringify(normalizeTree(a, `${SLIME}/green_slime`))).toContain('"@host"')
    // the op of what is said stays: a silent rule is not an equivalent one
    const silent: Tree = { ...(a as { if: never; then: never; else: never }), then: { do: [{ op: 'transform', into: `${SLIME}/green_slime` }, { op: 'vfx', fx: 'dust' }] } }
    expect(normalKey(silent, `${SLIME}/green_slime`)).not.toBe(normalKey(a, `${SLIME}/green_slime`))
    expect(normalKey(SEIZE, 'x')).not.toBe(normalKey(SOAK, 'x'))
  })
})

describe('candidates', () => {
  it('S1: three slimes answering alike make one candidate on their class; a differing sibling is not in the cluster', () => {
    const library = slimeLibrary({ [`${SLIME}/green_slime`]: SEIZE, [`${SLIME}/fire_slime`]: SEIZE, [`${SLIME}/frost_slime`]: SEIZE, [`${SLIME}/spark_slime`]: SOAK })
    expect(library.asked).toHaveLength(4)
    const found = candidates(library, onto)
    expect(found).toHaveLength(1)
    const c = found[0]
    expect(c).toMatchObject({ signal: 'S1', kind: 'impulse/offered', hole: OFFERED_HOLE, ancestor: SLIME })
    expect(c.types).toEqual([`${SLIME}/fire_slime`, `${SLIME}/frost_slime`, `${SLIME}/green_slime`])
    expect(c.rules.map((r) => r.id).sort()).toEqual(['patch/fire_slime-stone', 'patch/frost_slime-stone', 'patch/green_slime-stone'])
    // the class reaches four types here (the spark slime asked too): three of them answer alike
    expect(c.share).toBeCloseTo(0.75)
    expect(c.normalized).toBe(normalKey(SEIZE, `${SLIME}/green_slime`))
  })

  it('S1 needs K types and a share S of what the class reaches at the hole', () => {
    const library = slimeLibrary({ [`${SLIME}/green_slime`]: SEIZE, [`${SLIME}/fire_slime`]: SEIZE, [`${SLIME}/frost_slime`]: SEIZE })
    expect(candidates(library, onto)[0].share).toBe(1)
    expect(candidates(library, onto, undefined, { K: 4 })).toEqual([])
    // the sweep says all six slimes reach this hole: three alike is one half, the threshold
    const counts = askedCounts(library)
    for (const t of ['spark_slime', 'water_slime', 'king_slime']) counts.set(`${SLIME}/${t}|impulse/offered|${OFFERED_HOLE}`, 0)
    const [c] = candidates(library, onto, counts)
    expect(c.share).toBe(0.5)
    expect(candidates(library, onto, counts, { S: 0.6 })).toEqual([])
  })

  it('S2: a class asked N times at one hole, with no cluster, is a candidate on the narrowest class that qualifies', () => {
    const library = slimeLibrary({ [`${SLIME}/green_slime`]: SEIZE, [`${SLIME}/fire_slime`]: SOAK })
    const counts = askedCounts(library)
    expect([...counts.values()]).toEqual([1, 1])
    counts.set(`${SLIME}/frost_slime|impulse/handle|core/handle`, 2)
    counts.set(`${SLIME}/water_slime|impulse/handle|core/handle`, 2)
    counts.set(`${SLIME}/king_slime|impulse/handle|core/handle`, 1)
    const found = candidates(library, onto, counts)
    expect(found.map((c) => c.signal)).toEqual(['S2'])
    expect(found[0]).toMatchObject({ kind: 'impulse/handle', hole: 'core/handle', ancestor: SLIME, asked: 5, rules: [] })
    expect(found[0].normalized).toBeUndefined()
    expect(found[0].types).toEqual([`${SLIME}/frost_slime`, `${SLIME}/king_slime`, `${SLIME}/water_slime`])
    // four questions are not five
    counts.set(`${SLIME}/king_slime|impulse/handle|core/handle`, 0)
    expect(candidates(library, onto, counts)).toEqual([])
  })
})
