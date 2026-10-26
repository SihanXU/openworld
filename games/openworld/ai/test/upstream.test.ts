// The upstream loop's task (docs/upstream.md §3): the issue quotes the hole and the evidence; the
// generated promotion test fails on the content as it is (the scenes are still holes) and passes
// once a class rule answers them; the regression and the bounds refuse what reaches too far.
// No model: the agent is never run here.

import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, buildSandbox, placePatch, type Patch, type Scenario, type Tree } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { WorldLibrary, candidates } from '@openworld/ai'
import { UPSTREAM, branchFor, checkBounds, compareSweeps, holeSource, leafTypes, promotionTest, upstreamTask, type SweepMap } from '../src/upstream.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const SLIME = 'actor/creature/slime'
const RULES = 'games/openworld/content/src/rules.ts'

const scene = (type: string): Scenario => ({
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type, x: 2, y: 1 },
  ],
  event: {},
})

const SEIZE: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'addStatus', status: 'frozen', duration: 30 }, { op: 'log', text: 'It seizes up around the stone.' }] }, else: { undefined: true } }

/** Three slimes that learned, one by one, to seize up around a stone held out to them. */
function slimeLibrary(): WorldLibrary {
  const library = new WorldLibrary(onto, BASE)
  for (const short of ['green_slime', 'fire_slime', 'frost_slime']) {
    const eng = buildSandbox(scene(`${SLIME}/${short}`), onto, library.lib)
    const port = new ModPort(eng)
    eng.act('use', 'actor', { e: 'it' })
    const req = port.records[0].request
    const draft: Patch = { artifacts: [{ kind: 'rule', rule: { id: `patch/${short}-stone`, host: { type: 'x' }, on: 'x', label: { en: 'Press {instrument} to {target}', zh: '把{instrument}按在{target}上' }, tree: SEIZE } }] }
    const r = library.commit(placePatch(draft, req).patch, req)
    expect(r.result.errors).toEqual([])
  }
  return library
}

/** The class rule a proposal would add, as the agent would write it in the GENERAL block. */
const CLASS_RULE = `  rule({
    id: 'slime/offered-stone',
    label: L('Press {instrument} to {target}', '把{instrument}按在{target}上'),
    doc: 'A stone held out to a slime: its jelly seizes up around it (the class rule the three slimes learned one by one).',
    host: { type: '${SLIME}' },
    on: 'impulse/offered',
    tree: IF(is('item', { type: '${STONE}' }), DO(add('frozen', 30), log('{host} seizes up around the stone.', '{host}裹住石头，僵住了。')), 'inherit'),
  }),
`

describe('the upstream task', () => {
  it('quotes the hole and the class, and its promotion test fails until a base rule answers the scenes; then the whole verdict passes', { timeout: 600_000 }, async () => {
    const library = slimeLibrary()
    const [c] = candidates(library, onto)
    expect(c).toMatchObject({ signal: 'S1', ancestor: SLIME, hole: 'core/offered', kind: 'impulse/offered' })
    expect(await upstreamTask(c, { library, isolation: 'none' })).toBeUndefined() // unattended, no container: no task
    const t = (await upstreamTask(c, { library, isolation: 'none', localRun: true }))!
    try {
      const { task } = t
      expect(task.kind).toBe('upstream')
      expect(task.localRun).toBe(true)
      // the issue: the base rule quoted from its file, the class and its leaf types, each learned rule with its scene
      const src = holeSource('core/offered')!
      expect(src.file).toBe(RULES)
      expect(src.text).toMatch(/^rule\(\{ id: 'core\/offered'.*\}\)$/s)
      expect(task.statement).toContain(src.text)
      expect(task.statement).toContain(`${src.file}:${src.lines[0]}-${src.lines[1]}`)
      for (const leaf of leafTypes(onto, SLIME)) expect(task.statement).toContain(leaf)
      expect(task.statement).toMatch(/\*\*actor\/creature\/slime\/green_slime\*\*/)
      expect(task.statement).toContain('`patch/fire_slime-stone`')
      expect(task.statement).toMatch(/The scene that asked: impulse\/offered — host: actor\/creature\/slime\/frost_slime, actor: actor\/person\/player, instrument: item\/material\/stone/)
      expect(task.statement).toContain(`At most ${UPSTREAM.L} changed lines`)
      // the promotion test: the three scenes, their expectations without resolvedBy
      expect(t.cases.map((x) => x.type)).toEqual([`${SLIME}/green_slime`, `${SLIME}/fire_slime`, `${SLIME}/frost_slime`])
      for (const x of t.cases) expect(x.expect).toEqual([{ key: 'host', hasStatus: 'frozen' }])
      const test = join(t.workspace, 'games/openworld/content/test/promotion.test.ts')
      writeFileSync(test, promotionTest(t.cases))
      // on the content as it is, the scenes are still holes
      const before = await task.env.exec('npx vitest run games/openworld/content/test/promotion.test.ts', { timeoutMs: 300_000 })
      expect(before.code).not.toBe(0)
      expect(before.stdout + before.stderr).toMatch(/still a hole at core\/offered/)
      // a class rule on the slimes, written into the GENERAL block, answers them
      const rules = join(t.workspace, RULES)
      const text = readFileSync(rules, 'utf8')
      expect(text).toContain('const GENERAL: Rule[] = [\n')
      writeFileSync(rules, text.replace('const GENERAL: Rule[] = [\n', `const GENERAL: Rule[] = [\n${CLASS_RULE}`))
      const after = await task.env.exec('npx vitest run games/openworld/content/test/promotion.test.ts', { timeoutMs: 300_000 })
      expect(after.code, after.stdout.slice(-1500)).toBe(0)
      // and the engine cannot be written
      await expect(async () => writeFileSync(join(t.workspace, 'packages/engine/src/rules.ts'), 'x')).rejects.toThrow()
      // the whole verdict: bounds, promotion, no defined outcome changed, the content suite (the judge writes the promotion test itself: a test file in the tree is the agent's, out of bounds)
      rmSync(test)
      const v = await task.verdict!(task.env)
      expect(v.output).toMatch(/## bounds: pass/)
      expect(v.output).toMatch(/## promotion: pass/)
      expect(v.output).toMatch(/## coverage: pass\n[1-9]\d* cell\(s\) newly answered at core\/offered on actor\/creature\/slime/)
      expect(v.output).toMatch(/## content suite: pass/)
      expect(v.ok, v.output).toBe(true)
      // the judge's own files never enter the diff
      const diff = await task.env.exec('git add -A -N .; git diff --name-only')
      expect(diff.stdout.trim().split('\n')).toEqual([RULES])
    } finally {
      await t.dispose()
    }
  })

  it('names the branch after the hole and the class', () => {
    expect(branchFor({ hole: 'core/use#!{"none":"instrument"}', ancestor: SLIME })).toBe('upstream/core-use-none-instrument-actor-creature-slime')
  })
})

describe('the bounds', () => {
  const ok = { rulesBefore: 100, rulesAfter: 101, exportsBase: true, engineChanged: false }
  it('take one rule in rules.ts within L lines, and nothing in the engine', () => {
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n`, ...ok })).toEqual([])
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n3\t0\tgames/openworld/content/src/ontology.ts\n`, ...ok })).toEqual([])
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n2\t1\tpackages/engine/src/effects.ts\n`, ...ok, engineChanged: true }).join('\n')).toMatch(/effects\.ts: not a file a proposal may change[\s\S]*packages\/engine changed/)
    expect(checkBounds({ numstat: `70\t20\t${RULES}\n`, ...ok })).toEqual([`90 lines changed, more than ${UPSTREAM.L}`])
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n`, ...ok, rulesAfter: 102 })).toEqual(['2 new rule(s) in rules.ts, not one'])
    expect(checkBounds({ numstat: `4\t0\tgames/openworld/content/src/items.ts\n`, ...ok, rulesAfter: 100 }).join('\n')).toMatch(/rules\.ts: unchanged[\s\S]*0 new rule/)
    expect(checkBounds({ numstat: `9\t0\t${RULES}\n`, ...ok, exportsBase: false })).toEqual(['rules.ts no longer exports BASE_RULES'])
  })
})

describe('the coverage regression', () => {
  const c = { kind: 'impulse/offered', hole: 'core/offered', ancestor: SLIME }
  const open = `${SLIME}/green_slime|impulse/offered|core/offered`
  const before: SweepMap = {
    'item/tool/axe|fixture/nature/tree|use': { outcome: 'specific', rule: 'tree/chop' },
    '|tile:grass|hands': { outcome: 'generic', rule: 'tile/handle' },
    'item/material/stone|creature|use': { outcome: 'undefined', rule: 'core/use', open },
    'item/material/grass|creature|use': { outcome: 'undefined', rule: 'core/use', open: `${SLIME}/green_slime|impulse/offered|core/offered#x` },
    'item/material/stone|fixture/nature/dead_tree|use': { outcome: 'undefined', rule: 'core/use', open: 'item/material/stone|act/use|core/use#y' },
  }
  it('passes when every defined cell resolves as before and the gains are the candidate\'s', () => {
    const after: SweepMap = { ...before, 'item/material/stone|creature|use': { outcome: 'specific', rule: 'slime/offered-stone' } }
    expect(compareSweeps(before, after, c)).toEqual({ regressions: [], strays: [], gained: 1 })
  })
  it('reports a defined cell that changed hands or became a hole, and a gain beyond the proposal', () => {
    const after: SweepMap = {
      ...before,
      'item/tool/axe|fixture/nature/tree|use': { outcome: 'specific', rule: 'slime/offered-stone' },
      '|tile:grass|hands': { outcome: 'undefined', rule: 'core/handle' },
      'item/material/grass|creature|use': { outcome: 'specific', rule: 'slime/offered-stone' },
      'item/material/stone|fixture/nature/dead_tree|use': { outcome: 'specific', rule: 'slime/offered-stone' },
    }
    delete (after as Record<string, unknown>)['item/material/stone|creature|use']
    const d = compareSweeps(before, after, c)
    expect(d.regressions).toEqual(['item/tool/axe|fixture/nature/tree|use: was tree/chop, now slime/offered-stone', '|tile:grass|hands: was tile/handle, now undefined'])
    expect(d.strays).toEqual(['item/material/grass|creature|use: now slime/offered-stone (was open at actor/creature/slime/green_slime|impulse/offered|core/offered#x)', 'item/material/stone|fixture/nature/dead_tree|use: now slime/offered-stone (was open at item/material/stone|act/use|core/use#y)'])
    expect(d.gained).toBe(0)
  })
})
