// What the service lets whom do (server.ts): a caller elsewhere, a page on another site, and the
// address the service is bound to.

import { mkdtempSync } from 'node:fs'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type ResolveBody, type ResolveReply, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { SelfState } from '@openworld/agent'
import { Modder, WorldLibrary, createModderServer } from '../src/index.ts'

/** These commit and replay in the sandbox: under a full parallel run, slow. */
const SLOW = { timeout: 120_000 }

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'

/** The stone used on a dead tree: a hole in the stone's own nature (`core/use`). */
function useRequest(): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: 'fixture/nature/dead_tree', x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  return port.records[0].request
}

const sapped = (id: string): Patch => ({
  artifacts: [{ kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', label: { en: 'Use {instrument} on {target}', zh: '对{target}使用{instrument}' }, tree: { if: { is: { role: 'target', sel: { type: 'fixture/nature/dead_tree' } } }, then: { do: [{ op: 'addStatus', status: 'wet', duration: 10 }, { op: 'log', text: { en: '{target} drips sap on {instrument}.', zh: '{target}的树液把{instrument}弄湿了。' } }] }, else: 'inherit' } } }],
})

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-service-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  state.setHarness({ ...state.harness(), revise: false, faults: { remove: 2 } }, 'test: the service guards')
  const modder = new Modder({ library, state })
  return { library, state, modder, server: createModderServer(modder) }
}

interface Call {
  method?: string
  path: string
  headers?: Record<string, string>
  body?: unknown
  /** The caller's address, as the socket gives it. */
  from?: string
}

/** One request handed to the server as if it came over a socket from `from` (no network: a caller elsewhere is simulated). */
function call(server: Server, c: Call): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const raw = c.body === undefined ? [] : [Buffer.from(typeof c.body === 'string' ? c.body : JSON.stringify(c.body))]
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

const JSON_HEADERS = { 'content-type': 'application/json' }

describe('a caller elsewhere', () => {
  it('is one client for /fault whatever client id it sends; a caller on this machine may tell its clients apart', SLOW, async () => {
    const { library, server } = setup()
    const req = useRequest()
    expect(library.commit(placePatch(sapped('patch/sap'), req).patch, req).ok).toBe(true)
    const fault = (from: string, client: string) => call(server, { method: 'POST', path: '/fault', headers: JSON_HEADERS, from, body: { rule: 'patch/sap', reason: 'a chain that does not end', client } })
    expect((await fault('203.0.113.7', 'x')).body).toMatchObject({ counted: 1, removed: false })
    // the same caller claiming to be another client is still the one
    expect((await fault('203.0.113.7', 'y')).body).toMatchObject({ counted: 1, removed: false })
    expect(library.lib.rules.has('patch/sap')).toBe(true)
    // another caller is another client
    expect((await fault('198.51.100.9', 'x')).body).toMatchObject({ counted: 2, removed: true })
    expect(library.lib.rules.has('patch/sap')).toBe(false)

    // a tool on this machine reporting for two clients of its own
    expect(library.commit(placePatch(sapped('patch/sap2'), req).patch, req).ok).toBe(true)
    const local = (client: string) => call(server, { method: 'POST', path: '/fault', headers: JSON_HEADERS, body: { rule: 'patch/sap2', reason: 'x', client } })
    expect((await local('a')).body).toMatchObject({ counted: 1 })
    expect((await local('b')).body).toMatchObject({ counted: 2, removed: true })
  })

  it('is answered live when it asks /resolve for the offline profile (the expensive one is this host\'s)', async () => {
    const { modder, server } = setup()
    const asked: (string | undefined)[] = []
    modder.resolve = async (_body: ResolveBody, profile?: 'live' | 'offline'): Promise<ResolveReply> => (asked.push(profile), { patch: null, outcome: 'unavailable' })
    const resolve = (from: string, headers: Record<string, string> = {}) => call(server, { method: 'POST', path: '/resolve', headers: { ...JSON_HEADERS, ...headers }, from, body: { request: {}, profile: 'offline' } })
    await resolve('203.0.113.7')
    await resolve('127.0.0.1')
    await resolve('::1', { origin: 'http://localhost:5173' })
    // a page on another site, through the browser of someone on this machine
    await resolve('127.0.0.1', { origin: 'https://example.com' })
    expect(asked).toEqual(['live', 'offline', 'offline', 'live'])
  })
})
