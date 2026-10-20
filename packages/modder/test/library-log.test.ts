// The shared library's log as a service keeps it (library.ts): what survives a restart, what a client
// is told about the log itself, and what a commit refuses.

import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { WorldLibrary } from '../src/index.ts'

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
  it('a torn last line does not swallow the next commit, and no seq is used twice', () => {
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
