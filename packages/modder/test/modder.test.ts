import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type ModRequest, type Patch, type Rule, type Scenario, type Tree, type Cond } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, createModderServer, narrowKinds, scriptFromFile, signatureOf, type ChatMessage, type ChatOptions, type Model, type Script } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]

/**
 * A real ModRequest: the player puts a rope on a creature. The act is defined (the creature is
 * offered the rope), but no rule says how a creature takes being offered one: the hole is
 * `core/offered`, the event `impulse/offered`, hosted by the creature, with the rope as its item.
 */
function request(host = 'actor/creature/slime/green_slime', item = 'item/tool/rope'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: item, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: host, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  eng.act('put', 'actor', { e: 'it' })
  const rec = port.records[0]
  expect(rec?.request).toMatchObject({ event: { kind: 'impulse/offered', host: { type: host } }, hole: { rule: 'core/offered' } })
  return rec.request
}

/** The other input: the rope USED on the creature, a hole in the rope's own nature (`core/use`). */
function useRequest(host = 'actor/creature/slime/green_slime'): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: host, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  const rec = port.records[0]
  expect(rec.request).toMatchObject({ event: { kind: 'act/use', host: { type: 'item/tool/rope' } }, hole: { rule: 'core/use' } })
  return rec.request
}

const FIBER: Cond = { is: { role: 'item', sel: { tags: ['fiber'] } } }

/** The creature's nature when offered something fibrous: it is lashed down, and the rope goes onto it. */
function bindTree(): Tree {
  return {
    if: FIBER,
    then: {
      do: [
        { op: 'addStatus', status: 'frozen', duration: 30 },
        { op: 'emit', impulse: 'taken', to: 'item', params: { into: 'contents' }, other: 'host' },
        { op: 'vfx', fx: 'dust' },
        { op: 'log', text: { en: 'You lash {host} down with {item}.', zh: '你用{item}捆住了{host}。' } },
      ],
    },
  }
}

function bindRule(id = 'patch/rope-binds-creature', host = 'actor/creature', testHost = 'actor/creature/beast/wolf'): Rule {
  return {
    id,
    host: { type: host, notStatus: ['frozen'] },
    on: 'impulse/offered',
    doc: 'A creature offered a rope is lashed down with it for a while.',
    tree: bindTree(),
    tests: [
      {
        name: 'another creature',
        given: {
          entities: [
            { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
            { key: 'r', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
            { key: 'w', type: testHost, x: 2, y: 1 },
          ],
          // the player's act: putting the rope on it (the creature is offered it, and answers)
          event: { kind: 'act/put', actor: 'actor', target: 'w', instrument: 'r' },
        },
        expect: [{ key: 'w', hasStatus: 'frozen' }, { key: 'r', exists: true }],
      },
    ],
  }
}

const patchOf = (...rules: Rule[]): Patch => ({ note: 'rope binds', artifacts: rules.map((rule) => ({ kind: 'rule' as const, rule })) })

interface Calls {
  design: number
  review: number
  reflect: number
  log: { purpose?: string; messages: ChatMessage[] }[]
}

/**
 * A scripted modder: on each design turn it first searches the rule library, then answers
 * with the next draft. Review ships unless told otherwise; reflection adds a lesson.
 */
function scripted(drafts: (Patch | string)[], over: Partial<Record<'review' | 'reflect', (n: number, m: ChatMessage[]) => object>> = {}): { model: ScriptedModel; calls: Calls } {
  const calls: Calls = { design: 0, review: 0, reflect: 0, log: [] }
  let next = 0
  const script: Script = (messages: ChatMessage[], opts: ChatOptions) => {
    calls.log.push({ purpose: opts.purpose, messages: [...messages] })
    const last = messages[messages.length - 1]
    if (opts.purpose === 'review') {
      const n = calls.review++
      return over.review?.(n, messages) ?? { verdict: 'ship', notes: [] }
    }
    if (opts.purpose === 'reflect') return over.reflect?.(calls.reflect, messages) ?? { lessons: { add: [{ text: 'Select a rope-like item by its fiber tag, not its type.', terms: ['kind:impulse/offered', 'item#fiber'] }] }, skill: null }
    calls.design++
    if (last.role === 'user') return { content: '', toolCalls: [{ id: `c${calls.design}`, name: 'search_rules', args: { on: 'impulse/offered', tag: 'fiber' } }] }
    const d = drafts[Math.min(next++, drafts.length - 1)]
    return typeof d === 'string' ? d : { patch: d, summary: 'rope binds creatures' }
  }
  return { model: new ScriptedModel(script), calls }
}

/** The offline profile by default: the full loop (tools, blocking review, model-written tests). */
function setup(model?: Model, dir = mkdtempSync(join(tmpdir(), 'lsw-modder-')), profile: 'live' | 'offline' = 'offline') {
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  // these tests drive the patch pipeline (json); the repo-form agent has its own tests
  state.setHarness({ ...state.harness(), offline: { ...state.harness().offline, design: { ...state.harness().offline.design, mode: 'json' } } }, 'test: json pipeline offline')
  const modder = new Modder({ library, state, model, profile })
  return { dir, library, state, modder }
}

describe('the modder pipeline', () => {
  it('designs with tools, validates, commits to the shared library and records the episode', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const { modder, library, state, dir } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    expect(reply.patch?.artifacts[0]).toMatchObject({ kind: 'rule', rule: { id: 'patch/rope-binds-creature' } })
    expect(library.lib.rules.get('patch/rope-binds-creature')?.source?.author).toBe('modder')
    expect(calls.review).toBe(1)

    // the log is append-only and rebuilds the same library
    const again = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(again.lib.rules.has('patch/rope-binds-creature')).toBe(true)
    expect(again.regression).toHaveLength(1)

    const ep = state.episode(reply.episode!)!
    expect(ep.outcome).toBe('accepted')
    expect(ep.tools.map((t) => t.name)).toEqual(['search_rules'])
    expect(ep.attempts).toHaveLength(1)
    expect(ep.usage.calls).toBe(3) // tool turn, answer, review

    await modder.settled()
    const lessons = state.lessons()
    expect(lessons).toHaveLength(1)
    expect(lessons[0].episodes).toEqual([ep.id])
    expect(readFileSync(join(state.dir, 'memory/lessons.md'), 'utf8')).toContain('fiber tag')
    expect(readFileSync(join(state.dir, 'journal.jsonl'), 'utf8')).toMatch(/"kind":"lesson.add"/)
  })

  it('feeds the validator\'s diagnostics back and repairs', async () => {
    const bad = bindRule()
    bad.tree = { if: FIBER, then: { do: [{ op: 'addStatus', status: 'hogtied' }] } }
    const { model, calls } = scripted([patchOf(bad), patchOf(bindRule())])
    const { modder, state } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.attempts.map((a) => a.phase)).toEqual(['design', 'repair'])
    expect(ep.attempts[0].errors.join()).toMatch(/unknown status "hogtied"/)
    // the repair turn showed the model exactly what the validator said
    const repairTurn = calls.log.find((c) => c.purpose === 'design' && c.messages.some((m) => m.role === 'user' && m.content.startsWith('The validator rejected')))
    expect(repairTurn?.messages.find((m) => m.content.startsWith('The validator rejected'))?.content).toContain('hogtied')
  })

  it('gives up after the harness\'s repair budget, leaving the library untouched', async () => {
    const bad = bindRule()
    bad.tree = { if: FIBER, then: { do: [{ op: 'addStatus', status: 'hogtied' }] } }
    const { model } = scripted([patchOf(bad)])
    const { modder, library, state } = setup(model)
    state.setHarness({ ...state.harness(), offline: { ...state.harness().offline, repair: { maxRounds: 1 } } }, 'test: one repair round')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('failed')
    expect(reply.patch).toBeNull()
    expect(reply.diagnostics?.join()).toMatch(/hogtied/)
    expect(state.episode(reply.episode!)!.attempts).toHaveLength(2)
    expect(library.patchRules()).toHaveLength(0)
    expect(state.harness().version).toBe(3) // the setup's change and this one
    expect(readFileSync(join(state.dir, 'harness/CHANGELOG.md'), 'utf8')).toContain('one repair round')
  })

  it('answers a covered event from the shared library without a model call', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const { modder, state } = setup(model)
    await modder.resolve({ request: request() })
    const before = calls.design
    const reply = await modder.resolve({ request: request('actor/creature/slime/frost_slime') })
    expect(reply.outcome).toBe('covered')
    expect(reply.patch?.artifacts[0]).toMatchObject({ rule: { id: 'patch/rope-binds-creature' } })
    expect(calls.design).toBe(before)
    expect(state.stats()).toMatchObject({ episodes: 2, covered: 1, accepted: 1 })
  })

  it('works a class once when the same request arrives twice at the same time', async () => {
    const { model, calls } = scripted([patchOf(bindRule())])
    const { modder } = setup(model)
    const [a, b] = await Promise.all([modder.resolve({ request: request() }), modder.resolve({ request: request() })])
    expect([a.outcome, b.outcome].sort()).toEqual(['accepted', 'covered'])
    expect(calls.design).toBe(2) // one episode: a tool turn and an answer
  })

  it('without a model answers only from the library', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const first = setup(model)
    await first.modder.resolve({ request: request() })
    const offline = setup(undefined, first.dir)
    expect((await offline.modder.resolve({ request: request('actor/creature/slime/fire_slime') })).outcome).toBe('covered')
    expect((await offline.modder.resolve({ request: request('actor/creature/slime/fire_slime', 'item/tool/shovel') })).outcome).toBe('unavailable')
  })

  it('revises after a reviewer\'s notes', async () => {
    const narrow = bindRule('patch/rope-binds-slime', 'actor/creature/slime/green_slime', 'actor/creature/slime/green_slime')
    const { model, calls } = scripted([patchOf(narrow), patchOf(bindRule())], {
      review: (n) => (n === 0 ? { verdict: 'revise', notes: ['Too narrow: any creature can be tied up.'] } : { verdict: 'ship', notes: [] }),
    })
    const { modder, state, library } = setup(model)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.attempts.map((a) => [a.phase, a.review?.verdict])).toEqual([
      ['design', 'revise'],
      ['review', undefined],
    ])
    expect(calls.review).toBe(1) // the harness allows one review round: the revision ships unreviewed
    expect(library.lib.rules.has('patch/rope-binds-creature')).toBe(true)
    expect(library.lib.rules.has('patch/rope-binds-slime')).toBe(false)
  })

  it('writes a skill once work recurs, offers it, and books its outcomes', async () => {
    const skill = { name: 'Bind with fiber', description: 'Tying things up with rope-like items.', triggers: ['item#fiber'], body: '1. Host the rule on the creature class; select the item by the fiber tag.\n2. Freeze the host for a while; take the rope onto it (emit taken to the item).' }
    let reads = 0
    const calls = { design: 0 }
    const model = new ScriptedModel((messages, opts) => {
      const last = messages[messages.length - 1]
      if (opts.purpose === 'review') return { verdict: 'ship' }
      if (opts.purpose === 'reflect') return { lessons: {}, skill }
      calls.design++
      const user = messages.find((m, i) => i > 0 && m.role === 'user')!.content
      if (last.role === 'user' && user.includes('- bind-with-fiber:')) return { content: '', toolCalls: [{ id: `r${++reads}`, name: 'read_skill', args: { name: 'bind-with-fiber' } }] }
      // write the rule for the host's family (slimes, beasts) or, failing that, its own type
      const type = /"host":\{"role":"host"[^}]*?"type":"([^"]+)"/.exec(user)![1]
      const family = type.split('/').slice(0, 3).join('/')
      const cls = family === 'actor/creature/slime' || family === 'actor/creature/beast' ? family : type
      const other = cls === type ? type : cls === 'actor/creature/slime' ? 'actor/creature/slime/frost_slime' : 'actor/creature/beast/frost_wolf'
      return { patch: patchOf(bindRule(`patch/rope-binds-${cls.split('/').pop()}`, cls, other)) }
    })
    const { modder, state } = setup(model)
    state.setHarness({ ...state.harness(), reflect: { enabled: true, skillMinRecurrence: 1 } }, 'test: skills after one similar episode')

    await modder.resolve({ request: request() })
    await modder.settled()
    expect(state.skills()).toHaveLength(0) // nothing similar before: no skill yet

    await modder.resolve({ request: request('actor/creature/beast/wolf') })
    await modder.settled()
    expect(state.skills().map((s) => s.name)).toEqual(['bind-with-fiber'])
    expect(readFileSync(join(state.dir, 'skills/bind-with-fiber/SKILL.md'), 'utf8')).toMatch(/^---\nname: bind-with-fiber/)

    const third = await modder.resolve({ request: request('actor/creature/beast/boar', 'item/tool/rope') })
    // the beast rule covers the boar; a new class then: another kind of creature, the same rope
    expect(third.outcome).toBe('covered')
    const golem = Object.keys(onto.types).find((t) => t.startsWith('actor/creature/') && !t.startsWith('actor/creature/slime') && !t.startsWith('actor/creature/beast') && !Object.keys(onto.types).some((o) => o.startsWith(t + '/')))!
    const r4 = await modder.resolve({ request: request(golem) })
    expect(state.episode(r4.episode!)!.skillsRead).toEqual(['bind-with-fiber'])
    expect(state.skill('bind-with-fiber')).toMatchObject({ uses: 1, accepted: 1 })
    await modder.settled()
    expect(state.skill('bind-with-fiber')!.version).toBe(2) // revised by name after use
  })

  it('snapshots the self-state and renders it as one transferable document', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder, state } = setup(model)
    await modder.resolve({ request: request() })
    await modder.settled()
    const to = state.snapshot('checkpoint-1')
    expect(existsSync(join(to, 'memory/lessons.json'))).toBe(true)
    expect(JSON.parse(readFileSync(join(to, 'meta.json'), 'utf8')).stats.accepted).toBe(1)
    expect(readFileSync(join(to, 'SELF.md'), 'utf8')).toContain('fiber tag')
    expect(() => state.snapshot('checkpoint-1')).toThrow(/exists/)
  })

  it('files requests of one class of outcome under one key', () => {
    expect(signatureOf(request()).key).toBe(signatureOf(request()).key)
    expect(signatureOf(request()).key).not.toBe(signatureOf(request('actor/creature/beast/wolf')).key)
    expect(signatureOf(request()).key).not.toBe(signatureOf(request(undefined, 'item/tool/shovel')).key)
    expect(signatureOf(request()).terms).toEqual(expect.arrayContaining(['kind:impulse/offered', 'hole:core/offered', 'host:actor/creature/slime', 'item#fiber']))
  })
})

describe('the Mod port with the modder plugged in', () => {
  it('a game engine raises, the modder patches, the held event re-resolves', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder } = setup(model)
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
        { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
      ],
      event: {},
    }
    const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
    const port = new ModPort(eng)
    let done!: () => void
    const finished = new Promise<void>((r) => (done = r))
    port.provider = { resolve: async (req) => (await modder.resolve({ request: req })).patch }
    port.onChange = () => port.records[0]?.status === 'patched' && done()
    eng.act('put', 'actor', { e: 'slime' })
    // while the outcome waits, its participants are held — the one who started the chain too
    expect(port.records[0]).toMatchObject({ status: 'pending', request: { event: { kind: 'impulse/offered' } } })
    expect(eng.world.get('slime')!.frozenBy).toBe(port.records[0].id)
    expect(eng.world.get('actor')!.frozenBy).toBe(port.records[0].id)
    await finished
    expect(eng.world.hasStatus({ e: 'slime' }, 'frozen')).toBe(true)
    expect(eng.world.get('rope')?.place).toEqual({ on: 'inside', holder: 'slime' })
    expect(eng.world.get('actor')!.frozenBy).toBeUndefined()

    // the same shared patch arriving again (sync after reply) is a no-op
    const twice = port.submit(undefined, port.records[0].patch!)
    expect(twice.ok).toBe(true)
    expect(twice.warnings).toContain('already in the library')
  })
})

describe('the service', () => {
  it('serves resolve, the patch log and health over HTTP', async () => {
    const { model } = scripted([patchOf(bindRule())])
    const { modder } = setup(model)
    const server = createModderServer(modder).listen(0)
    await new Promise((r) => server.once('listening', r))
    const base = `http://localhost:${(server.address() as AddressInfo).port}`
    try {
      const health = await (await fetch(`${base}/health`)).json()
      expect(health).toMatchObject({ ok: true, model: 'scripted', library: { seq: 0 } })
      const reply = await (await fetch(`${base}/resolve`, { method: 'POST', body: JSON.stringify({ request: request() }) })).json()
      expect(reply.outcome).toBe('accepted')
      const log = await (await fetch(`${base}/patches?since=0`)).json()
      expect(log.seq).toBe(1)
      expect(log.entries[0].rules).toEqual(['patch/rope-binds-creature'])
      expect(log.entries[0].scenario).toBeUndefined()
      expect((await (await fetch(`${base}/patches?since=1`)).json()).entries).toEqual([])
    } finally {
      server.close()
    }
  })
})

describe('the offline script (fixtures/offline.json, for `serve --script`)', () => {
  it('answers a rope put on or used on a creature, live, and the patch covers the rest of the class', async () => {
    const model = scriptFromFile(fileURLToPath(new URL('../fixtures/offline.json', import.meta.url)))
    for (const first of ['put', 'use'] as const) {
      const { modder } = setup(model, undefined, 'live')
      const reply = await modder.resolve({ request: first === 'put' ? request() : useRequest() })
      expect(reply.outcome).toBe('accepted')
      expect(reply.patch?.artifacts.map((a) => (a.kind === 'rule' ? a.rule.id : a.kind))).toEqual(['patch/fiber-binds-creature', 'patch/fiber-lashes-creature'])
      expect((await modder.resolve({ request: first === 'put' ? useRequest() : request() })).outcome).toBe('covered')
      expect((await modder.resolve({ request: request('actor/creature/beast/wolf') })).outcome).toBe('covered')
      await modder.settled()
    }
  })
})

describe('the OpenAI-compatible adapter', () => {
  it('speaks tool calls on the wire and drives a full episode', async () => {
    const bodies: Record<string, unknown>[] = []
    const { createServer } = await import('node:http')
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw)
        bodies.push(body)
        const last = body.messages[body.messages.length - 1]
        const text = (m: { content?: string }) => m.content ?? ''
        let message: Record<string, unknown>
        if (!body.tools) message = { content: text(body.messages[0]).includes('review') ? '{"verdict":"ship"}' : '{"lessons":{}}' }
        else if (last.role === 'user') message = { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_type', arguments: '{"id":"item/tool/rope"}' } }] }
        else message = { content: '```json\n' + JSON.stringify({ patch: patchOf(bindRule()) }) + '\n```' }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.0005 } }))
      })
    }).listen(0)
    await new Promise((r) => server.once('listening', r))
    try {
      const { OpenAICompatModel } = await import('@lsw/agent')
      const model = new OpenAICompatModel({ baseUrl: `http://localhost:${(server.address() as AddressInfo).port}/v1`, apiKey: 'test', model: 'mock-1' })
      const { modder, state } = setup(model)
      const reply = await modder.resolve({ request: request() })
      expect(reply.outcome).toBe('accepted')
      // the tool call went out with its schema, and its result came back as a tool message
      expect((bodies[0].tools as { function: { name: string } }[]).map((t) => t.function.name)).toContain('dry_run')
      const second = bodies[1].messages as { role: string; tool_call_id?: string; content: string }[]
      expect(second.at(-2)).toMatchObject({ role: 'assistant' })
      expect(second.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
      expect(second.at(-1)!.content).toContain('fiber')
      const ep = state.episode(reply.episode!)!
      expect(ep.model).toBe('mock-1')
      expect(ep.usage).toMatchObject({ calls: 3, input: 300, output: 60 })
      expect(ep.usage.cost).toBeCloseTo(0.0015)
    } finally {
      server.close()
    }
  })
})

describe('integrity', () => {
  it('rejects a catch-all that would answer for anything at all', () => {
    const { library } = setup()
    const catchAll: Rule = { id: 'patch/offered-nothing', on: 'impulse/offered', tree: { do: [{ op: 'log', text: 'Nothing happens.' }] } }
    expect(library.validate(patchOf(catchAll), request()).errors.join()).toMatch(/name the host/)
    // naming what the rule is about is enough
    const scoped: Rule = { ...catchAll, id: 'patch/creature-offered-nothing', host: { type: 'actor/creature' } }
    expect(library.validate(patchOf(scoped), request()).errors.join()).not.toMatch(/name the host/)
  })

  it('holds a patch to the event model: host-only effects, no holes, not the earlier shape', () => {
    const { library } = setup()
    const of = { ...bindRule(), tree: { if: FIBER, then: { do: [{ op: 'addStatus', of: 'item', status: 'wet' }] } } } as unknown as Rule
    expect(library.validate(patchOf(of), request()).errors.join()).toMatch(/effects act on the host only/)
    const hole: Rule = { ...bindRule(), tree: { if: FIBER, then: { undefined: true } } }
    expect(library.validate(patchOf(hole), request()).errors.join()).toMatch(/may not leave an outcome undefined/)
    const old = { id: 'patch/rope-binds', on: 'interaction', when: { verb: ['interact'] }, do: [{ op: 'addStatus', of: 'target', status: 'frozen' }] } as unknown as Rule
    expect(library.validate(patchOf(old), request()).errors.join()).toMatch(/earlier rule shape/)
    // a rule that does not answer the event that asked is no answer
    const elsewhere: Rule = { ...bindRule(), on: 'impulse/handle' }
    expect(library.validate(patchOf(elsewhere), request()).errors.join()).toMatch(/still undefined/)
  })
})

describe('deterministic repairs', () => {
  it('accepts a correct rule in the wrong wrapper without another model turn', async () => {
    const rule = bindRule()
    const { tree: _t, ...bare } = rule
    // a rule written in the flat form: its condition and effects beside the rule, not in a tree
    const flat = { ...bare, if: FIBER, do: (bindTree() as { then: { do: unknown[] } }).then.do }
    // effects keyed by their op ({"addStatus": {"status": …}}), as a live model wrote them
    const tree = bindTree() as { if: unknown; then: { do: { op: string }[] } }
    const keyed = { ...rule, tree: { ...tree, then: { do: tree.then.do.map(({ op, ...args }) => ({ [op]: args })) } } }
    // the shapes models actually produce: the rule as the artifact, or its fields spread on {kind:"rule"}
    for (const draft of [{ artifacts: [rule] }, { artifacts: [{ kind: 'rule', ...rule }] }, rule, { rules: [rule] }, { artifacts: [{ kind: 'rule', rule: flat }] }, { artifacts: [{ kind: 'rule', rule: keyed }] }]) {
      const { model, calls } = scripted([draft as unknown as Patch])
      const { modder, state, library } = setup(model)
      const reply = await modder.resolve({ request: request() })
      expect(reply.outcome).toBe('accepted')
      const ep = state.episode(reply.episode!)!
      expect(ep.attempts).toHaveLength(1)
      expect(ep.attempts[0].fixes?.length).toBeGreaterThan(0)
      expect(calls.design).toBe(2) // the tool turn and the answer: no repair round
      expect(library.lib.rules.get('patch/rope-binds-creature')!.tree).toEqual(bindTree())
    }
  })

  it('narrows a rule to the kind that was asked when its broader branch is what ties', async () => {
    const p = patchOf({ ...bindRule(), on: 'impulse' })
    const res = { ok: false, errors: ['rule "patch/rope-binds-creature" ties with "patch/creature-shrugs" (same kind, same specificity, overlapping hosts) — make it more specific or name a different host'], warnings: [], overrides: [] }
    const n = narrowKinds(p, request(), res)!
    expect(n.fixes[0]).toMatch(/narrowed/)
    expect((n.patch.artifacts[0] as { rule: Rule }).rule.on).toBe('impulse/offered')
    expect(narrowKinds(p, request(), { ...res, errors: ['unknown status "x"'] })).toBeUndefined()

    // in the pipeline: an earlier patch answers the whole impulse branch for the same class
    const { model, calls } = scripted([p])
    const { modder, state, library } = setup(model)
    const shrug: Rule = { id: 'patch/creature-shrugs', host: { type: 'actor/creature', notStatus: ['frozen'] }, on: 'impulse', doc: 'Wind ruffles a creature.', tree: { if: { param: { key: 'element', cmp: 'wind' } }, then: { do: [{ op: 'vfx', fx: 'dust' }] } } }
    expect(library.commit(patchOf(shrug)).ok).toBe(true)
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    expect(state.episode(reply.episode!)!.attempts[0].fixes?.join()).toMatch(/narrowed "patch\/rope-binds-creature" from impulse to impulse\/offered/)
    expect(library.lib.rules.get('patch/rope-binds-creature')!.on).toBe('impulse/offered')
    expect(calls.design).toBe(2) // no repair round
  })
})

describe('the tail guard', () => {
  async function mock(handler: (n: number, body: Record<string, unknown>, res: import('node:http').ServerResponse) => void) {
    const { createServer } = await import('node:http')
    let n = 0
    const bodies: Record<string, unknown>[] = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw)
        bodies.push(body)
        handler(n++, body, res)
      })
    }).listen(0)
    await new Promise((r) => server.once('listening', r))
    const { OpenAICompatModel } = await import('@lsw/agent')
    const model = new OpenAICompatModel({ baseUrl: `http://localhost:${(server.address() as AddressInfo).port}/v1`, apiKey: 't', model: 'm', extraBody: { provider: { order: ['a', 'b'] } } })
    return { model, bodies, close: () => (server.closeAllConnections(), server.close()) }
  }
  const ok = (res: import('node:http').ServerResponse, text: string) => (res.writeHead(200, { 'Content-Type': 'application/json' }), res.end(JSON.stringify({ choices: [{ message: { content: text } }], provider: text })))

  it('hedges a stalled call to the next provider and takes the first answer', async () => {
    const m = await mock((n, _b, res) => (n === 0 ? undefined : ok(res, 'second')))
    try {
      const t0 = Date.now()
      const r = await m.model.chat([{ role: 'user', content: 'hi' }], { hedgeMs: 150, deadlineMs: 3000 })
      expect(r.content).toBe('second')
      expect(r.hedged).toBe(true)
      expect(Date.now() - t0).toBeLessThan(1500)
      expect((m.bodies[1].provider as { order: string[] }).order).toEqual(['b', 'a'])
    } finally {
      m.close()
    }
  })

  it('treats an empty body as a failure and asks again at once', async () => {
    const m = await mock((n, _b, res) => (n === 0 ? (res.writeHead(200), res.end('')) : ok(res, 'again')))
    try {
      const r = await m.model.chat([{ role: 'user', content: 'hi' }], { hedgeMs: 5000, deadlineMs: 8000 })
      expect(r.content).toBe('again')
    } finally {
      m.close()
    }
  })

  it('gives up a try at the deadline and retries', async () => {
    const m = await mock((n, _b, res) => (n < 2 ? undefined : ok(res, 'retry')))
    try {
      const r = await m.model.chat([{ role: 'user', content: 'hi' }], { hedgeMs: 50, deadlineMs: 300, retries: 1 })
      expect(r.content).toBe('retry')
    } finally {
      m.close()
    }
  })
})

describe('the live profile', () => {
  /** Live design calls carry no tools; offline ones do. */
  function liveModel(o: { live: (n: number) => unknown; offline?: (n: number, m: ChatMessage[]) => unknown; review?: (n: number, m: ChatMessage[]) => unknown }) {
    const n = { live: 0, offline: 0, review: 0 }
    const model = new ScriptedModel((messages, opts) => {
      if (opts.purpose === 'review') {
        const i = n.review++
        return (o.review?.(i, messages) ?? { verdict: 'ship' }) as object
      }
      if (opts.purpose === 'reflect') return {}
      if (opts.tools?.length || messages.some((m) => m.role === 'tool')) {
        n.offline++
        const last = messages[messages.length - 1]
        return last.role === 'user' ? { content: '', toolCalls: [{ id: 'x', name: 'get_type', args: { id: 'item/tool/rope' } }] } : (o.offline!(n.offline, messages) as object)
      }
      return o.live(n.live++) as object
    })
    return { model, n }
  }
  const noTests = (r: Rule): Rule => ({ ...r, tests: undefined })

  it('answers in one call without tools and writes the generalization test itself', async () => {
    const { model, n } = liveModel({ live: () => ({ patch: patchOf(noTests(bindRule())) }) })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('accepted')
    const ep = state.episode(reply.episode!)!
    expect(ep.usage.calls).toBe(1)
    expect(ep.profile).toBe('live')
    expect(ep.attempts[0].derived?.join()).toMatch(/derived a test on host/)
    const tests = library.lib.rules.get('patch/rope-binds-creature')!.tests!
    // the harness swapped the HOST for another instance of its class, from another branch of it
    expect(tests[0].name).toMatch(/^derived: host actor\/creature\//)
    expect(tests[0].given.event).toMatchObject({ kind: 'impulse/offered', host: 'host' })
    expect(tests[0].given.entities.find((e) => e.key === 'host')!.type).not.toMatch(/^actor\/creature\/slime/)
    expect(tests[0].expect).toContainEqual({ key: 'host', hasStatus: 'frozen' })
    await modder.settled()
    expect(n.review).toBe(1) // reviewed after the player had the patch
    expect(readFileSync(join(state.dir, 'journal.jsonl'), 'utf8')).toMatch(/"kind":"review"/)
  })

  it('works a failed live request again offline, in the background', async () => {
    const { model, n } = liveModel({ live: () => 'I am not sure.', offline: () => ({ patch: patchOf(bindRule()) }) })
    const { modder, state, library } = setup(model, undefined, 'live')
    const reply = await modder.resolve({ request: request() })
    expect(reply.outcome).toBe('failed') // the player gets the fallback now
    expect(n.live).toBe(2) // one answer and one repair, the live budget
    await modder.settled()
    expect(library.lib.rules.has('patch/rope-binds-creature')).toBe(true) // ...and the world learns it anyway
    const escalated = state.episodes().map((e) => state.episode(e.id)!).find((e) => e.escalatedFrom === reply.episode)!
    expect(escalated).toMatchObject({ profile: 'offline', outcome: 'accepted' })
  })

  it('revises a shipped rule when the late reviewer asks, replacing it in the shared library', async () => {
    const narrow = noTests(bindRule('patch/rope-binds-slime', 'actor/creature/slime', 'actor/creature/slime/frost_slime'))
    const { model } = liveModel({
      live: () => ({ patch: patchOf(narrow) }),
      review: (i) => (i === 0 ? { verdict: 'revise', notes: ['Any creature can be tied up, not just slimes.'] } : { verdict: 'ship' }),
      offline: (_i, messages) => {
        expect(messages[1].content).toContain('# Revision')
        return { patch: patchOf(bindRule()) }
      },
    })
    const { modder, state, library } = setup(model, undefined, 'live')
    const first = await modder.resolve({ request: request() })
    expect(library.lib.rules.has('patch/rope-binds-slime')).toBe(true)
    await modder.settled()
    expect(library.lib.rules.has('patch/rope-binds-slime')).toBe(false)
    expect(library.lib.rules.has('patch/rope-binds-creature')).toBe(true)
    expect(library.since(0).map((e) => ('remove' in e ? `-${e.remove}` : `+${e.rules.join()}`))).toEqual(['+patch/rope-binds-slime', '-patch/rope-binds-slime', '+patch/rope-binds-creature'])
    const rev = state.episodes().map((e) => state.episode(e.id)!).find((e) => e.revises === first.episode)!
    expect(rev.outcome).toBe('accepted')
  })

  it('flags a rule that changes nothing for the reviewer', async () => {
    const flavour: Rule = { id: 'patch/rope-on-creature-nothing', host: { type: 'actor/creature' }, on: 'impulse/offered', doc: 'Nothing.', tree: { if: FIBER, then: { do: [{ op: 'log', text: 'You wave the rope about.' }] } } }
    let seen = ''
    const { model } = liveModel({ live: () => ({ patch: patchOf(flavour) }), review: (_i, m) => ((seen = m[1].content), { verdict: 'ship' }) })
    const { modder } = setup(model, undefined, 'live')
    await modder.resolve({ request: request() })
    await modder.settled()
    expect(seen).toContain('changes nothing in the world')
  })
})
