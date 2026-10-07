// The proven shackles, closed: what the validator says about a patch is what the sandbox shows
// when the patch is simply run, both ways. A family of patches (gates, yields, a host that turns
// into another and back, an answer that sets itself off) is enumerated; for each, the validator's
// verdict on termination and on endless yield is compared with brute force: the event run on and
// on, far past the checks' own bounds.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, scenarioEvent, validatePatch, type Effect, type Engine, type GameEvent, type Patch, type Rule, type Scenario, type Tree } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { WorldLibrary } from '@lsw/modder'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STATUE = 'fixture/sacred/statue'
const ALTAR = 'fixture/sacred/altar'
const STICK: Effect = { op: 'spawn', type: 'item/material/stick', at: 'host' }

/** A blow with an axe on a statue (which cannot break): the hole `impulse/strike` on the statue. */
function blowOnStatue(): Scenario {
  const eng = buildSandbox(
    {
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'axe', type: 'item/weapon/blade/axe', x: 2, y: 2, heldBy: 'actor' },
        { key: 'statue', type: STATUE, x: 2, y: 1 },
      ],
      event: {},
    },
    onto,
    new RuleLibrary(BASE),
  )
  const port = new ModPort(eng)
  eng.act('use', 'actor', { e: 'statue' })
  return port.records.find((r) => r.event.kind === 'impulse/strike')!.request.scenario
}
const SCENE = blowOnStatue()

const rule = (id: string, host: string, tree: Tree): Rule => ({ id, host: { type: host }, on: 'impulse/strike', tree, source: { origin: 'patch' } })

/** The family: a gate (none, a counter, a status, a status that runs out) around effects. */
function family(): { name: string; patch: Patch }[] {
  const gates: { name: string; wrap: (fx: Effect[]) => Tree; mark: Effect[] }[] = [
    { name: 'always', wrap: (fx) => ({ do: fx }), mark: [] },
    ...[3, 20, 100].map((n) => ({ name: `count<${n}`, wrap: (fx: Effect[]): Tree => ({ if: { prop: { role: 'host', key: 'n', default: 0, cmp: { lt: n } } }, then: { do: fx }, else: { do: [] } }), mark: [{ op: 'addProp', key: 'n', delta: 1 } as Effect] })),
    { name: 'once', wrap: (fx) => ({ if: { not: { has: { role: 'host', status: 'notched' } } }, then: { do: fx }, else: { do: [] } }), mark: [{ op: 'addStatus', status: 'notched' }] },
    { name: 'a while', wrap: (fx) => ({ if: { not: { has: { role: 'host', status: 'stirred' } } }, then: { do: fx }, else: { do: [] } }), mark: [{ op: 'addStatus', status: 'stirred', duration: 50 }] },
  ]
  const bodies: { name: string; fx: Effect[]; flip?: boolean }[] = [
    { name: 'a stick', fx: [STICK] },
    { name: 'two sticks', fx: [STICK, STICK] },
    { name: 'a line', fx: [{ op: 'log', text: 'It rings.' }] },
    { name: 'echo', fx: [{ op: 'emit', impulse: 'strike', to: 'host' }] },
    { name: 'a stick and echo', fx: [STICK, { op: 'emit', impulse: 'strike', to: 'host' }] },
    { name: 'flip with a stick', fx: [STICK, { op: 'transform', into: ALTAR }], flip: true },
    { name: 'flip quietly', fx: [{ op: 'transform', into: ALTAR }], flip: true },
  ]
  const out: { name: string; patch: Patch }[] = []
  for (const g of gates)
    for (const b of bodies) {
      const rules = [rule('patch/statue', STATUE, g.wrap([...b.fx, ...g.mark]))]
      // the altar turns back into the statue on a blow, with what the statue's answer gives
      if (b.flip) rules.push(rule('patch/altar', ALTAR, g.wrap([...b.fx.filter((e) => e.op !== 'transform'), { op: 'transform', into: STATUE }, ...g.mark])))
      out.push({ name: `${g.name}: ${b.name}`, patch: { artifacts: rules.map((r) => ({ kind: 'rule', rule: r })) } })
    }
  return out
}

function patched(patch: Patch): RuleLibrary {
  const lib = new RuleLibrary(BASE)
  for (const a of patch.artifacts) if (a.kind === 'rule') lib.add(a.rule)
  return lib
}

/** The request's own event (the blow on the statue, by the scene's keys). */
const strike = (eng: Engine): GameEvent => scenarioEvent(SCENE, eng)
const hostOf = (eng: Engine) => (strike(eng).host as { e: string }).e

/** Brute force, termination: one blow, followed through 500 ticks; does its chain end (5,000 events at most)? */
function endsByForce(patch: Patch): boolean {
  const eng = buildSandbox(SCENE, onto, patched(patch))
  let n = 0
  const ROOT = -7
  eng.onDispatch = (x) => void (x.chain === ROOT && n++)
  eng.queue({ ...strike(eng), chain: ROOT })
  eng.flush()
  for (let t = 0; t < 500 && n < 5000 && eng.waiting(ROOT); t++) eng.tick()
  // (a chain the runtime guards had to stop, setting its rule aside, did not end by itself)
  return n < 5000 && !eng.waiting(ROOT) && !Object.keys(eng.world.state.quarantine ?? {}).length
}

/** Brute force, yield: up to 300 blows with no time between; how many things made in all, and in the last 50. */
function yieldByForce(patch: Patch): { total: number; late: number } {
  const eng = buildSandbox(SCENE, onto, patched(patch))
  const counts: number[] = []
  for (let i = 0; i < 300 && eng.world.get(hostOf(eng)); i++) {
    const before = new Set(Object.keys(eng.world.state.entities))
    eng.queue(strike(eng))
    eng.flush()
    counts.push(Object.keys(eng.world.state.entities).filter((id) => !before.has(id) && eng.world.get(id)?.type === 'item/material/stick').length)
    // (past a hundred the answer is in: a pile that big only slows the cell's contacts)
    if (counts.reduce((a, n) => a + n, 0) > 100) break
  }
  return { total: counts.reduce((a, n) => a + n, 0), late: counts.slice(-50).reduce((a, n) => a + n, 0) }
}

describe('the shackles agree with brute force (closed both ways)', () => {
  const cases = family()

  it(`termination: the validator refuses exactly the patches whose blow never stops (${cases.length} patches)`, () => {
    const wrong: string[] = []
    for (const c of cases) {
      const errs = validatePatch(c.patch, { ontology: onto, library: new RuleLibrary(BASE), scenario: SCENE }).errors.join('\n')
      const refused = /chain:/.test(errs)
      if (refused === endsByForce(c.patch)) wrong.push(`${c.name}: validator ${refused ? 'refused' : 'passed'}, brute force says it ${refused ? 'ends' : 'never ends'}`)
    }
    expect(wrong).toEqual([])
  }, 300_000)

  it('endless yield: the validator refuses exactly the patches that keep giving (or give more than a host may at once)', () => {
    const wrong: string[] = []
    for (const c of cases) {
      if (!endsByForce(c.patch)) continue // (a blow that never stops is the termination check's)
      const errs = validatePatch(c.patch, { ontology: onto, library: new RuleLibrary(BASE), scenario: SCENE }).errors.join('\n')
      const refused = /endless yield/.test(errs)
      const y = yieldByForce(c.patch)
      const endless = y.late > 0 || y.total > 64
      if (refused !== endless) wrong.push(`${c.name}: validator ${refused ? 'refused' : 'passed'}; brute force made ${y.total} (${y.late} in the last 50 blows)`)
    }
    expect(wrong).toEqual([])
  }, 300_000)

  it('the family covers both sides of each check (the agreement is not empty)', () => {
    const verdicts = cases.map((c) => validatePatch(c.patch, { ontology: onto, library: new RuleLibrary(BASE), scenario: SCENE }).errors.join('\n'))
    expect(verdicts.filter((e) => /chain:/.test(e)).length).toBeGreaterThanOrEqual(2)
    expect(verdicts.filter((e) => /endless yield/.test(e)).length).toBeGreaterThan(2)
    expect(verdicts.filter((e) => !/chain:|endless yield/.test(e)).length).toBeGreaterThan(10)
  }, 300_000)
})

describe('what the scene did not show, the world catches, and the hole opens again', () => {
  it('a loop that only starts beside an altar: shipped, stopped at runtime, set aside, and the class is asked again', () => {
    // valid on the request's scene (no altar there), it loops wherever an altar stands near
    const near = (host: string, other: string): Rule => rule(`patch/${host.split('/').at(-1)}-near`, host, { if: { count: { role: 'host', in: 'tile', cmp: { gte: 0 } } }, then: { do: [{ op: 'emit', impulse: 'strike', to: { area: { radius: 2 } }, filter: { type: other } }] }, else: { do: [] } })
    const patch: Patch = { artifacts: [{ kind: 'rule', rule: near(STATUE, ALTAR) }, { kind: 'rule', rule: near(ALTAR, STATUE) }] }
    expect(validatePatch(patch, { ontology: onto, library: new RuleLibrary(BASE), scenario: SCENE }).errors.join('\n')).not.toMatch(/chain:/)
    const eng = buildSandbox({ ...SCENE, entities: [...SCENE.entities, { key: 'altar', type: ALTAR, x: 4, y: 3 }] }, onto, patched(patch))
    const port = new ModPort(eng)
    eng.queue(strike(eng))
    for (let i = 0; i < 400; i++) eng.tick()
    expect(Object.keys(eng.world.state.quarantine ?? {}).length).toBeGreaterThan(0)
    // the hole is open again: the next blow on the statue is a question for the AI once more
    const before = port.records.length
    eng.act('use', 'actor', { e: 'host' })
    expect(port.records.length).toBe(before + 1)
    expect(port.records.at(-1)!.event.kind).toBe('impulse/strike')
  }, 60_000)

  it('the library audit finds a stored patch that makes something from nothing, with its cycle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-shackles-'))
    const farm: Patch = { artifacts: [{ kind: 'rule', rule: rule('patch/statue-sticks', STATUE, { do: [STICK] }) }] }
    // written to the log as an older modder would have (before the exact check)
    writeFileSync(join(dir, 'library.jsonl'), JSON.stringify({ seq: 1, at: new Date().toISOString(), patch: farm, rules: ['patch/statue-sticks'], scenario: SCENE }) + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.audit()).toEqual([{ rule: 'patch/statue-sticks', reason: expect.stringMatching(/endless yield: .*every 1 replay\(s\) come back to where they began and make 1 thing/) }])
  })
})
