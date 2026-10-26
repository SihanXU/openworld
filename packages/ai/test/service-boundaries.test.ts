// The service's boundaries, on the engine and the standard library alone (no game): what a page on another site may
// do through the browser of someone on this machine (server.ts), what a world repository may write and read on the
// host (repo.ts: its folder only, never through a link the agent made), and what the player's own modder commits
// (localModder.ts: judged with the story's protected facts, as the engine's worker judges what it takes).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModPort, RuleLibrary, buildModSpec, buildSandbox, placePatch, type ModRequest, type Ontology, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { DockerEnv, Modder, ScriptedModel, SelfState, WorldLibrary, collectPatch, createModderServer, materializeWorld, type ChatMessage } from '../src/index.ts'
import { LocalModder, type ModderStore, type StoreKey } from '../src/player/localModder.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))

const SLOW = { timeout: 180_000 }
const STD = STDLIB_ONTOLOGY as Ontology
const STONE = 'item/stone'
const TREE = 'fixture/tree'
const onto: Ontology = {
  ...STD,
  types: { ...STD.types, [STONE]: { id: STONE, name: { en: 'stone', zh: '石头' } }, [TREE]: { id: TREE, name: { en: 'tree', zh: '树' } } },
  terrains: { ...STD.terrains, grass: { id: 'grass', name: { en: 'grass', zh: '草' } } },
} as Ontology
const BASE = STDLIB_RULES

/** A stone in the player's hand used on a tree: the port's request for the hole it reaches. */
function request(): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: TREE, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  eng.act('use', 'actor', { e: 'it' })
  return port.records[0].request
}

/** The stone used on a tree does `effects`, placed where the request fell undefined. */
const answer = (id: string, req: ModRequest, effects: unknown[] = [{ op: 'log', text: { en: 'The stone knocks on {target}.', zh: '石头敲了敲{target}。' } }]): Patch =>
  placePatch({ artifacts: [{ kind: 'rule', rule: { id, host: { type: 'x' }, on: 'x', label: 'Use {instrument} on {target}', tree: { if: { is: { role: 'target', sel: { type: TREE } } }, then: { do: effects as never }, else: { undefined: true } } } as Rule }] }, req).patch

const scratch = (prefix: string) => mkdtempSync(join(tmpdir(), prefix))

/** One request handed to the server as if it came over a socket from `from` (as service-guards.test.ts does). */
function call(server: Server, c: { method?: string; path: string; headers?: Record<string, string>; body?: unknown; from?: string }): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const raw = c.body === undefined ? [] : [Buffer.from(JSON.stringify(c.body))]
    const req = Object.assign(Readable.from(raw), { method: c.method ?? 'GET', url: c.path, headers: c.headers ?? {}, socket: { remoteAddress: c.from ?? '127.0.0.1' } })
    let status = 0
    const res = {
      setHeader() {},
      writeHead(code: number) {
        status = code
        return res
      },
      end(b?: string) {
        resolve({ status, body: b ? JSON.parse(String(b)) : {} })
      },
    }
    server.emit('request', req, res)
  })
}

describe('a page on another site, through the browser of someone on this machine', () => {
  it('is one client for /fault whatever client ids it sends (it cannot retire a learned rule alone)', SLOW, async () => {
    const dir = scratch('lsw-boundaries-')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), revise: false, faults: { remove: 2 } }, 'test: the service boundaries')
    const server = createModderServer(new Modder({ library, state }))
    const req = request()
    expect(library.commit(answer('patch/knock', req), req).ok).toBe(true)
    // a simple POST (no preflight): text/plain, with the page's Origin, from the loopback address
    const fault = (client: string, origin = 'https://evil.example') => call(server, { method: 'POST', path: '/fault', headers: { origin, 'content-type': 'text/plain' }, body: { rule: 'patch/knock', reason: 'x', client } })
    await fault('a')
    expect((await fault('b')).body).toMatchObject({ counted: 1, removed: false })
    expect(library.lib.rules.has('patch/knock')).toBe(true)
    // the editor or the game on this machine still tells its clients apart
    expect((await fault('c', 'http://localhost:5173')).body).toMatchObject({ counted: 2, removed: true })
  })
})

describe('a container the host is about to read (env.ts halt)', () => {
  it('is frozen: nothing it still runs changes the workspace while the host reads it, and it is removed as before', async () => {
    const tmp = scratch('lsw-halt-')
    const image = join(tmp, 'image')
    mkdirSync(image)
    mkdirSync(join(tmp, 'work'))
    process.env.FAKE_DOCKER_STATE = join(tmp, 'docker')
    try {
      const env = await DockerEnv.start({ image, root: join(tmp, 'work'), docker: [process.execPath, fileURLToPath(new URL('./fake-docker.mjs', import.meta.url))], owner: '4242:4242' })
      expect((await env.exec('true')).code).toBe(0)
      env.halt()
      expect((await env.exec('true')).code).not.toBe(0)
      await env.dispose()
      const calls = readFileSync(join(tmp, 'docker', 'calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)[0])
      expect(calls.slice(-5)).toEqual(['pause', 'exec', 'unpause', 'exec', 'rm'])
    } finally {
      delete process.env.FAKE_DOCKER_STATE
    }
  })
})

describe('a world repository keeps to its folder (repo.ts)', () => {
  const base = () => new RuleLibrary(BASE)
  const open = (lib = base()) => materializeWorld({ request: request(), library: lib, ontology: onto, base: onto, spec: buildModSpec(onto, lib), isolation: 'none' })
  let tmp: string | undefined
  afterEach(() => {
    if (tmp) vi.unstubAllEnvs()
    tmp = undefined
  })
  /** os.tmpdir() under a folder of this test's own: what a repository leaves there is seen. */
  const ownTmp = () => {
    tmp = scratch('lsw-boundaries-tmp-')
    vi.stubEnv('TMPDIR', tmp)
    return tmp
  }

  it('never writes a rule outside it, whatever its id (one held from before the validator refused such ids)', SLOW, async () => {
    const at = ownTmp()
    const lib = base()
    lib.add({ ...(answer('patch/../../../escaped', request()).artifacts[0] as { rule: Rule }).rule, source: { origin: 'patch' } })
    await expect(open(lib)).rejects.toThrow(/outside the repository/)
    expect(existsSync(join(at, 'escaped.json'))).toBe(false)
    // and the folder it began went with the attempt
    expect(readdirSync(at)).toEqual([])
  })

  it('removes its folder when its sandbox cannot start', SLOW, async () => {
    const at = ownTmp()
    vi.stubEnv('PATH', '/nonexistent') // no docker: the container cannot start
    const lib = base()
    await expect(materializeWorld({ request: request(), library: lib, ontology: onto, base: onto, spec: buildModSpec(onto, lib), isolation: 'docker' })).rejects.toThrow()
    expect(readdirSync(at)).toEqual([])
  })

  it('does not follow a link the agent made: a file elsewhere on the host never enters the patch', SLOW, async () => {
    const outside = scratch('lsw-boundaries-host-')
    writeFileSync(join(outside, 'secret.json'), JSON.stringify({ id: 'patch/leak', SECRET: 'host-only-value' }))
    const repo = await open()
    try {
      // in a container the agent has a shell: the link dangles there and is real on the host, where the patch is collected
      symlinkSync(join(outside, 'secret.json'), join(repo.dir, 'rules/patch/leak.json'))
      symlinkSync(outside, join(repo.dir, 'types/elsewhere'))
      const got = collectPatch(repo.dir)
      expect(JSON.stringify(got)).not.toContain('host-only-value')
      expect(got.patch).toBeUndefined()
      expect(got.problems.join('\n')).toMatch(/rules\/patch\/leak\.json is a symbolic link[\s\S]*types\/elsewhere is a symbolic link/)
    } finally {
      await repo.dispose()
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('reports a link loop or its own files overwritten as problems, never a throw', SLOW, async () => {
    const repo = await open()
    try {
      symlinkSync('.', join(repo.dir, 'rules/patch/loop'))
      expect(collectPatch(repo.dir).problems.join('\n')).toMatch(/rules\/patch\/loop is a symbolic link/)
      writeFileSync(join(repo.dir, '.lsw/manifest.json'), 'oops')
      const got = collectPatch(repo.dir)
      expect(got.patch).toBeUndefined()
      expect(got.problems.join('\n')).toMatch(/\.lsw\/manifest\.json is the harness's and cannot be read/)
    } finally {
      await repo.dispose()
    }
  })

  it('an offline episode whose agent broke the harness\'s files is recorded as failed', SLOW, async () => {
    vi.stubEnv('LSW_ISOLATION', 'none')
    const call = (name: string, args: Record<string, unknown>) => ({ content: '', toolCalls: [{ id: `${name}-1`, name, args }] })
    const model = new ScriptedModel((messages: ChatMessage[], opts) => {
      if (opts.purpose === 'reflect') return { lessons: {} }
      const done = messages.filter((m) => m.role === 'tool').map((m) => (m as { name: string }).name)
      if (!done.includes('write_file')) return call('write_file', { path: '.lsw/manifest.json', content: 'oops' })
      return call('submit', { summary: 'done' })
    })
    const dir = scratch('lsw-boundaries-modder-')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    const modder = new Modder({ library, state, model, profile: 'offline' })
    try {
      const reply = await modder.resolve({ request: request() }, 'offline')
      expect(reply.outcome).toBe('failed')
      expect(state.episode(reply.episode!)).toMatchObject({ kind: 'world-repo', outcome: 'failed' })
      expect(reply.diagnostics?.join('\n')).toMatch(/\.lsw\/manifest\.json is the harness's/)
    } finally {
      await modder.settled()
      vi.unstubAllEnvs()
    }
  })
})

describe("the player's own modder (localModder.ts)", () => {
  const store = (): ModderStore => {
    const data = new Map<StoreKey, unknown>()
    return { get: async <T>(k: StoreKey) => data.get(k) as T | undefined, set: async (k, v) => void data.set(k, v), del: async (k) => void data.delete(k) }
  }

  it("commits only what the engine takes: it judges with the story's protected facts the page hands it", SLOW, async () => {
    const h = new LocalModder({ store: store(), post: () => undefined })
    await h.handle({ t: 'game', ontology: onto, rules: BASE })
    await h.handle({ t: 'facts', protectedFacts: ['ford.'] })
    const req = request()
    // the stone hands the story a fact of its own (as ai-guards.test.ts's chain does)
    const story = answer('patch/hand', req, [{ op: 'emit', impulse: 'handle', to: 'story', params: { 'fact.ford.crossed': 1 } }])
    expect(new WorldLibrary(onto, BASE).validate(story, req).ok).toBe(true)
    const c = (h as unknown as { library: WorldLibrary }).library.commit(story, req)
    expect(c.ok).toBe(false)
    expect(c.result.errors.join()).toMatch(/ford\.crossed/)
  })
})
