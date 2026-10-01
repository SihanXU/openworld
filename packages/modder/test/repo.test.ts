import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildModSpec, buildSandbox, type ModRequest, type Rule, type Scenario } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, collectPatch, materializeWorld, type ChatMessage } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]

function request(target = 'actor/creature/slime/green_slime'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: target, x: 2, y: 1 },
    ],
    event: { verb: 'interact', actor: 'actor', target: 'it', instrument: 'held' },
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  eng.interact('interact', 'actor', { e: 'it' })
  return port.records[0].request
}

const RULE: Rule = {
  id: 'patch/rope-binds-creature',
  on: 'interaction',
  doc: 'A rope lashes a creature down for a while.',
  when: { verb: ['interact'], instrument: { tags: ['fiber'] }, target: { type: 'actor/creature', notStatus: ['frozen'] } },
  do: [
    { op: 'addStatus', of: 'target', status: 'frozen', duration: 30 },
    { op: 'destroy', of: 'instrument' },
    { op: 'vfx', at: 'target', fx: 'dust' },
    { op: 'log', text: { en: 'You lash {target} down with the rope.', zh: '你用绳子捆住了{target}。' } },
  ],
  tests: [
    {
      name: 'a wolf too',
      given: {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'r', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
          { key: 'w', type: 'actor/creature/beast/wolf', x: 2, y: 1 },
        ],
        event: { verb: 'interact', actor: 'actor', target: 'w', instrument: 'r' },
      },
      expect: [{ key: 'w', hasStatus: 'frozen' }],
    },
  ],
}

const call = (name: string, args: Record<string, unknown>) => ({ content: '', toolCalls: [{ id: `${name}-${Math.random().toString(36).slice(2, 6)}`, name, args }] })

/** The modder working a world repository: reads the issue, writes a rule, runs the validator, submits. */
function worldEngineer(rule: Rule = RULE) {
  let lastTests = ''
  const model = new ScriptedModel((messages: ChatMessage[], opts) => {
    if (opts.purpose === 'reflect') return { lessons: {} }
    const done = messages.filter((m) => m.role === 'tool').map((m) => (m as { name: string }).name)
    const last = messages.at(-1)!
    if (last.role === 'tool' && (last as { name: string }).name === 'run_tests') lastTests = last.content
    if (!done.includes('read_file')) return call('read_file', { path: 'ISSUE.md' })
    if (!done.includes('write_file')) return call('write_file', { path: `rules/${rule.id}.json`, content: JSON.stringify(rule, null, 2) })
    if (!done.includes('run_tests')) return call('run_tests', {})
    return call('submit', { summary: 'rope binds creatures' })
  })
  return { model, tests: () => lastTests }
}

function setup(model?: ScriptedModel) {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-repo-modder-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  return { library, state, modder: new Modder({ library, state, model, profile: 'offline' }) }
}

describe('a world task as a repository', () => {
  it('lays the world out as files, and turns what the agent added into a patch', () => {
    const lib = new RuleLibrary(BASE)
    const repo = materializeWorld({ request: request(), library: lib, ontology: onto, spec: buildModSpec(onto, lib) })
    try {
      expect(readFileSync(join(repo.dir, 'ISSUE.md'), 'utf8')).toMatch(/Undefined interaction: you interact → green slime holding Rope/)
      expect(existsSync(join(repo.dir, 'rules/core/ignite.json'))).toBe(true)
      expect(readFileSync(join(repo.dir, 'MODSPEC.md'), 'utf8')).toMatch(/## Effect primitives/)
      expect(collectPatch(repo.dir)).toEqual({ patch: undefined, problems: [] })
      writeFileSync(join(repo.dir, 'rules/patch/rope-binds-creature.json'), JSON.stringify(RULE))
      writeFileSync(join(repo.dir, 'rules/core/ignite.json'), '{}')
      const c = collectPatch(repo.dir)
      expect(c.patch?.artifacts).toHaveLength(1)
      expect(c.problems.join()).toMatch(/rules\/core\/ignite.json is part of the world/)
    } finally {
      repo.dispose()
    }
  })

  it('runs the validator as the repository\'s tests', { timeout: 120_000 }, () => {
    const lib = new RuleLibrary(BASE)
    const repo = materializeWorld({ request: request(), library: lib, ontology: onto, spec: buildModSpec(onto, lib) })
    try {
      const fail = (() => {
        try {
          execSync('node validate.mjs', { cwd: repo.dir, encoding: 'utf8', stdio: 'pipe' })
          return ''
        } catch (err) {
          return String((err as { stdout: string }).stdout)
        }
      })()
      expect(fail).toMatch(/FAILED: 0 artifact\(s\)/)
      writeFileSync(join(repo.dir, 'rules/patch/rope-binds-creature.json'), JSON.stringify(RULE))
      const ok = execSync('node validate.mjs', { cwd: repo.dir, encoding: 'utf8', stdio: 'pipe' })
      expect(ok).toMatch(/PASSED: 1 artifact/)
      expect(ok).toMatch(/resolved by patch\/rope-binds-creature/)
    } finally {
      repo.dispose()
    }
  })

  it('the offline modder works the request as a repository and commits what it wrote', { timeout: 180_000 }, async () => {
    const { model, tests } = worldEngineer()
    const { modder, library, state } = setup(model)
    const reply = await modder.resolve({ request: request() }, 'offline')
    expect(tests()).toMatch(/PASSED/)
    expect(reply.outcome).toBe('accepted')
    expect(library.lib.rules.get('patch/rope-binds-creature')?.source?.author).toBe('modder')
    const ep = state.episode(reply.episode!)!
    expect(ep).toMatchObject({ kind: 'world-repo', outcome: 'accepted', rules: ['patch/rope-binds-creature'] })
    expect(ep.tools.map((t) => t.name)).toEqual(['read_file', 'write_file', 'run_tests', 'submit'])
    // replays for the outer loop see the world before this answer
    await modder.settled()
    const task = await modder.taskSource().replay(ep)
    expect(task).toBeTruthy()
    expect(existsSync(join(task!.env.root, 'rules/patch/rope-binds-creature.json'))).toBe(false)
    await modder.taskSource().cleanup?.(task!)
  })
})
