import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildModSpec, buildSandbox, type ModRequest, type Rule, type Scenario } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, collectPatch, dockerAvailable, materializeWorld, type ChatMessage } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const REPO = fileURLToPath(new URL('../../..', import.meta.url))
const DOCKER = await dockerAvailable()

/** The player holds a stone out to a creature: the creature is offered it, and its nature (fibrous, edible) says nothing about a stone. */
function request(host = 'actor/creature/slime/green_slime'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: host, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  // the stone held out to it, as a stone used on it does
  eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { actor: { e: 'actor' }, item: { e: 'held' }, source: { e: 'held' } }, params: {}, cause: 'actor', origin: 'player' })
  return port.records[0].request
}

/** The green slime's own answer (design.md §5.16): placed at the hole the request names; what narrows it is in its tree. */
const RULE: Rule = {
  id: 'patch/stone-stills-creature',
  host: { type: 'actor/creature/slime/green_slime' },
  on: 'impulse/offered',
  hole: 'core/offered',
  at: [],
  doc: 'A green slime offered a stone is weighed down by it for a while.',
  tree: {
    if: { all: [{ is: { role: 'item', sel: { tags: ['stone'] } } }, { not: { has: { role: 'host', status: 'frozen' } } }] },
    then: {
      do: [
        { op: 'addStatus', status: 'frozen', duration: 30 },
        { op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' },
        { op: 'vfx', fx: 'dust' },
        { op: 'log', text: { en: 'You weigh {host} down with {item}.', zh: '你用{item}压住了{host}。' } },
      ],
    },
    else: { undefined: true },
  },
  tests: [
    {
      name: 'another slime, another stone',
      given: {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'r', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
          { key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
        ],
        event: { kind: 'impulse/offered', host: 's', actor: 'actor', item: 'r', source: 'r' },
      },
      expect: [{ key: 's', hasStatus: 'frozen' }],
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
    return call('submit', { summary: 'stone stills creatures' })
  })
  return { model, tests: () => lastTests }
}

function setup(model?: ScriptedModel) {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-repo-modder-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: false } }, 'test: no auditor')
  return { library, state, modder: new Modder({ library, state, model, profile: 'offline' }) }
}

describe('a world task as a repository', () => {
  it('lays the world out as files, and turns what the agent added into a patch', async () => {
    const lib = new RuleLibrary(BASE)
    const repo = await materializeWorld({ request: request(), library: lib, ontology: onto, spec: buildModSpec(onto, lib), isolation: 'none' })
    try {
      expect(readFileSync(join(repo.dir, 'ISSUE.md'), 'utf8')).toContain('# Undefined outcome: green slime is sent offered (the thing: Stone)')
      const issue = readFileSync(join(repo.dir, 'ISSUE.md'), 'utf8')
      expect(issue).toContain('- event: `impulse/offered`')
      expect(issue).toMatch(/- host \(the rule you write is its nature\): green slime — `actor\/creature\/slime\/green_slime`/)
      expect(issue).toContain('- undefined at: `rules/core/offered.json`')
      expect(existsSync(join(repo.dir, 'rules/core/offered.json'))).toBe(true)
      expect(JSON.parse(readFileSync(join(repo.dir, 'request.json'), 'utf8'))).toMatchObject({ event: { kind: 'impulse/offered' }, hole: { rule: 'core/offered' } })
      expect(readFileSync(join(repo.dir, 'MODSPEC.md'), 'utf8')).toMatch(/## Effect primitives/)
      expect(collectPatch(repo.dir)).toEqual({ patch: undefined, problems: [] })
      writeFileSync(join(repo.dir, 'rules/patch/stone-stills-creature.json'), JSON.stringify(RULE))
      writeFileSync(join(repo.dir, 'rules/core/offered.json'), '{}')
      const c = collectPatch(repo.dir)
      expect(c.patch?.artifacts).toHaveLength(1)
      expect(c.problems.join()).toMatch(/rules\/core\/offered.json is part of the world/)
    } finally {
      await repo.dispose()
    }
  })

  it('runs the validator as the repository\'s tests', { timeout: 120_000 }, async () => {
    const lib = new RuleLibrary(BASE)
    const repo = await materializeWorld({ request: request(), library: lib, ontology: onto, spec: buildModSpec(onto, lib), isolation: 'none' })
    try {
      // the task's own tests run the validator from the engine's code, not the workspace's file
      expect(repo.task.tests!.command).not.toMatch(/validate\.mjs/)
      const own = await repo.task.env.exec(repo.task.tests!.command, { timeoutMs: 120_000 })
      expect(own.stdout).toMatch(/FAILED: 0 artifact\(s\)/)
      const fail = (() => {
        try {
          execSync('node validate.mjs', { cwd: repo.dir, encoding: 'utf8', stdio: 'pipe' })
          return ''
        } catch (err) {
          return String((err as { stdout: string }).stdout)
        }
      })()
      expect(fail).toMatch(/FAILED: 0 artifact\(s\)/)
      writeFileSync(join(repo.dir, 'rules/patch/stone-stills-creature.json'), JSON.stringify(RULE))
      const ok = execSync('node validate.mjs', { cwd: repo.dir, encoding: 'utf8', stdio: 'pipe' })
      expect(ok).toMatch(/PASSED: 1 artifact/)
      expect(ok).toMatch(/resolved by patch\/stone-stills-creature/)
    } finally {
      await repo.dispose()
    }
  })

  // where a Docker daemon answers (the Linux host): the boundary itself, not a description of it
  it.runIf(DOCKER)('in a container: the engine is read-only, the secrets and the network are out of reach, the validator runs', { timeout: 300_000 }, async () => {
    const lib = new RuleLibrary(BASE)
    const repo = await materializeWorld({ request: request(), library: lib, ontology: onto, spec: buildModSpec(onto, lib), isolation: 'docker' })
    try {
      const env = repo.task.env
      expect(env.isolated).toBe(true)
      const write = await env.exec('echo x > /repo/packages/escaped.txt && echo WROTE || echo REFUSED')
      expect(write.stdout).toContain('REFUSED')
      expect(existsSync(join(REPO, 'packages', 'escaped.txt'))).toBe(false)
      expect((await env.exec('test -e /repo/.env && echo SEEN || echo HIDDEN; test -e /repo/var && echo SEEN || echo HIDDEN')).stdout.trim().split('\n')).toEqual(['HIDDEN', 'HIDDEN'])
      const net = await env.exec(`node -e "require('https').get('https://openrouter.ai', () => console.log('NET')).on('error', () => console.log('NONET'))"`, { timeoutMs: 30_000 })
      expect(net.stdout).toContain('NONET')
      // the workspace is the agent's: what it writes there is the host user's
      expect((await env.exec('echo ok > rules/patch/probe.txt && cat rules/patch/probe.txt')).stdout.trim()).toBe('ok')
      expect(readFileSync(join(repo.dir, 'rules/patch/probe.txt'), 'utf8').trim()).toBe('ok')
      const fail = await env.exec(repo.task.tests!.command, { timeoutMs: 180_000 })
      expect(fail.stdout).toMatch(/FAILED/)
      writeFileSync(join(repo.dir, 'rules/patch/stone-stills-creature.json'), JSON.stringify(RULE))
      const ok = await env.exec(repo.task.tests!.command, { timeoutMs: 180_000 })
      expect(ok.stdout).toMatch(/PASSED: 1 artifact/)
    } finally {
      await repo.dispose()
    }
  })

  // 2026-10-03: an offline revision ran `cd <the repository> && cat > dbg.ts …` on the host
  it('an agent that tries to write into the real repository cannot', { timeout: 300_000 }, async () => {
    const marker = `escaped-${Date.now()}.txt`
    const attempt = `cd ${JSON.stringify(REPO)} && echo x > ${marker}; echo done`
    let ran = false
    const model = new ScriptedModel((messages: ChatMessage[]) => {
      const done = messages.filter((m) => m.role === 'tool').map((m) => (m as { name: string }).name)
      if (!done.includes('run') && !ran) {
        ran = true
        return { content: '', toolCalls: [{ id: 'r', name: 'run', args: { command: attempt } }] }
      }
      return { content: '', toolCalls: [{ id: 's', name: 'submit', args: { summary: 'tried' } }] }
    })
    const { modder } = setup(model)
    await modder.resolve({ request: request() }, 'offline')
    // with a container the command ran there and could not reach the repository; without one there was no shell
    expect(existsSync(join(REPO, marker))).toBe(false)
  })

  it('the offline modder works the request as a repository and commits what it wrote', { timeout: 180_000 }, async () => {
    const { model, tests } = worldEngineer()
    const { modder, library, state } = setup(model)
    const reply = await modder.resolve({ request: request() }, 'offline')
    expect(tests()).toMatch(/PASSED/)
    expect(reply.outcome).toBe('accepted')
    expect(library.lib.rules.get('patch/stone-stills-creature')?.source?.author).toBe('modder')
    const ep = state.episode(reply.episode!)!
    expect(ep).toMatchObject({ kind: 'world-repo', outcome: 'accepted', rules: ['patch/stone-stills-creature'] })
    expect(ep.tools.map((t) => t.name)).toEqual(['read_file', 'write_file', 'run_tests', 'submit'])
    // replays for the outer loop see the world before this answer
    await modder.settled()
    const task = await modder.taskSource().replay(ep)
    expect(task).toBeTruthy()
    expect(existsSync(join(task!.env.root, 'rules/patch/stone-stills-creature.json'))).toBe(false)
    await modder.taskSource().cleanup?.(task!)
  })
})
