// The shared library's log as a service keeps it (library.ts): what survives a restart, what a client
// is told about the log itself, and what a commit refuses.

import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { SelfState } from '@openworld/ai'
import { Modder, WorldLibrary, createModderServer } from '@openworld/ai'

/** These commit and replay in the sandbox: under a full parallel run, slow. */
const SLOW = { timeout: 120_000 }

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const SLIME = 'actor/creature/slime/green_slime'
const STONE = 'item/material/stone'

/** The player holds a stone out to a creature: the creature's hole `core/offered` (as in modder.test.ts). */
function request(host = SLIME): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: host, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { actor: { e: 'actor' }, item: { e: 'held' }, source: { e: 'held' } }, params: {}, cause: 'actor', origin: 'player' })
  return port.records[0].request
}

/** The creature offered a stone is weighed down by it (a learned rule, placed where the request fell undefined). */
function bind(id: string, req: ModRequest, effects: unknown[] = [{ op: 'addStatus', status: 'frozen', duration: 30 }, { op: 'log', text: { en: 'You weigh {host} down.', zh: '你压住了{host}。' } }]): Patch {
  const rule: Rule = { id, host: { type: 'x' }, on: 'x', doc: 'a creature offered a stone is weighed down', tree: { if: { is: { role: 'item', sel: { tags: ['stone'] } } }, then: { do: effects as never }, else: { undefined: true } } }
  return placePatch({ artifacts: [{ kind: 'rule', rule }] }, req).patch
}

const dir = () => mkdtempSync(join(tmpdir(), 'lsw-library-'))

describe('the log after a restart', () => {
  it('a torn last line does not swallow the next commit, and no seq is used twice', SLOW, () => {
    const file = join(dir(), 'library.jsonl')
    const slime = request()
    const first = new WorldLibrary(onto, BASE, file)
    expect(first.commit(bind('patch/a', slime), slime).seq).toBe(1)
    // the service stopped in the middle of writing the next entry
    appendFileSync(file, '{"seq":2,"at":"2026-10-')
    const wolf = request('actor/creature/beast/wolf')
    const second = new WorldLibrary(onto, BASE, file)
    expect(second.seq).toBe(1)
    expect(second.commit(bind('patch/b', wolf), wolf).seq).toBe(2)
    const third = new WorldLibrary(onto, BASE, file)
    expect(third.log.map((e) => e.seq)).toEqual([1, 2])
    expect(third.patchRules().map((r) => r.id).sort()).toEqual(['patch/a', 'patch/b'])
    expect(readFileSync(file, 'utf8').endsWith('\n')).toBe(true)
  })
})

describe("the log's identity", () => {
  it('is kept across restarts, is another when the log is begun anew, and is said in /patches and /health', SLOW, async () => {
    const d = dir()
    const file = join(d, 'library.jsonl')
    const slime = request()
    const first = new WorldLibrary(onto, BASE, file)
    expect(typeof first.logId).toBe('string')
    expect(first.logId.length).toBeGreaterThan(0)
    first.commit(bind('patch/a', slime), slime)
    expect(new WorldLibrary(onto, BASE, file).logId).toBe(first.logId)
    // the log reset (its file gone): a client holding seq 1 of the old one must not take seq 1 of the new one for it
    rmSync(file)
    const reset = new WorldLibrary(onto, BASE, file)
    expect(reset.logId).not.toBe(first.logId)
    expect(new WorldLibrary(onto, BASE, file).logId).toBe(reset.logId)

    const server = createModderServer(new Modder({ library: reset, state: SelfState.open(join(d, 'modder-state')) })).listen(0, '127.0.0.1')
    await new Promise((r) => server.once('listening', r))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      expect(await (await fetch(`${base}/patches?since=0`)).json()).toEqual({ seq: 0, log: reset.logId, entries: [] })
      expect((await (await fetch(`${base}/health`)).json()).library).toMatchObject({ seq: 0, log: reset.logId })
    } finally {
      server.close()
    }
  })
})

describe('a covered reply', () => {
  it('ships only what the library still holds of the patch that answers', SLOW, () => {
    const library = new WorldLibrary(onto, BASE, join(dir(), 'library.jsonl'))
    const slime = request()
    const wolf = request('actor/creature/beast/wolf')
    // one patch, two rules (one each)
    const both: Patch = { note: 'stones weigh creatures down', artifacts: [...bind('patch/slime', slime).artifacts, ...bind('patch/wolf', wolf).artifacts] }
    expect(library.commit(both).ok).toBe(true)
    expect(library.covering(slime)?.patch.artifacts.map((a) => (a.kind === 'rule' ? a.rule.id : a.kind))).toEqual(['patch/slime', 'patch/wolf'])
    // the wolf's rule rolled back: a covered reply must not bring it back to the client
    expect(library.remove('patch/wolf')).toBe(true)
    const c = library.covering(slime)
    expect(c?.rule).toBe('patch/slime')
    expect(c?.patch.artifacts.map((a) => (a.kind === 'rule' ? a.rule.id : a.kind))).toEqual(['patch/slime'])
    expect(c?.patch.note).toBe('stones weigh creatures down')
  })
})

describe('the commit barrier', () => {
  /** A stone held out to a creature by one of the world's people (the player did not act): a world event's question. */
  function worldRequest(): ModRequest {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'held', type: STONE, x: 2, y: 2, heldBy: 'actor' },
        { key: 'it', type: SLIME, x: 2, y: 1 },
        { key: 'trainer', type: 'actor/person/trainer', x: 3, y: 1 },
      ],
      event: {},
    }
    const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
    const port = new ModPort(eng)
    eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { actor: { e: 'trainer' }, item: { e: 'held' }, source: { e: 'held' } }, params: {}, cause: 'trainer', origin: 'world' })
    eng.flush()
    expect(port.records[0].request.origin).toBe('world')
    return port.records[0].request
  }

  it("refuses a topic the story raises itself, as every client does (the game's protected facts)", SLOW, () => {
    const slime = request()
    const story = bind('patch/news', slime, [{ op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'topic', value: 'first_seal' } }])
    const free = new WorldLibrary(onto, BASE, join(dir(), 'library.jsonl'))
    expect(free.validate(story, slime).ok).toBe(true)
    const library = new WorldLibrary(onto, BASE, join(dir(), 'library.jsonl'), { protectedFacts: ['topic.first_seal'] })
    const c = library.commit(story, slime)
    expect(c.ok).toBe(false)
    expect(c.result.errors.join()).toMatch(/the story raises the topic "first_seal" itself/)
    expect(library.seq).toBe(0)
  })

  it("holds a world event's answer to the world's boundaries: it may not hurt a person", SLOW, () => {
    const req = worldRequest()
    const harm = bind('patch/slime-lashes', req, [{ op: 'emit', impulse: 'strike', to: 'actor', params: { power: 5 } }])
    const library = new WorldLibrary(onto, BASE, join(dir(), 'library.jsonl'))
    // the same answer to a player's offer is the player's own doing
    const player = request()
    expect(library.validate(bind('patch/slime-lashes', player, [{ op: 'emit', impulse: 'strike', to: 'actor', params: { power: 5 } }]), player).ok).toBe(true)
    const c = library.commit(harm, req)
    expect(c.ok).toBe(false)
    expect(c.result.errors.join()).toMatch(/a world event may not hurt a person/)
  })
})
