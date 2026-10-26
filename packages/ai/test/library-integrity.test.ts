// The shared library's log stays what every client can trust (design.md §9): a patch takes the place only of
// the earlier answer to its own question (never a base rule, never another question's answer, whatever a
// request names), a revision under an old id is judged as itself, an entry is in force only once written,
// and one process writes a log.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, holeKey, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, auditOf, type ChatMessage, type ChatOptions, type LogStore } from '../src/index.ts'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STONE = 'item/material/stone'
const STICK = 'item/material/stick'
const DEAD_TREE = 'fixture/nature/dead_tree'

/** A held thing used on a dead tree: the request the port raises (its hole read off the real library). */
function useRequest(held = STONE): ModRequest {
  const sc: Scenario = {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' },
      { key: 'it', type: DEAD_TREE, x: 2, y: 1 },
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE))
  const port = new ModPort(eng)
  expect(eng.act('use', 'actor', { e: 'it' }).defined).toBe(false)
  return port.records[0].request
}

/** An answer placed where the request fell undefined. */
const answer = (req: ModRequest, id: string, text = 'You knock it on the tree.'): Rule => ({
  id,
  host: { type: req.event.host!.type! },
  on: 'act/use',
  hole: holeKey(req.hole.rule, req.hole.path),
  at: req.hole.at,
  label: { en: 'Use {instrument}', zh: '使用{instrument}' },
  tree: { do: [{ op: 'log', text: { en: text, zh: '你敲了敲树。' } }] },
})
const patchOf = (...rules: Rule[]): Patch => ({ artifacts: rules.map((rule) => ({ kind: 'rule' as const, rule })) })

describe('what a patch takes the place of', () => {
  it('not the answer to another question, though the commit names it', () => {
    const library = new WorldLibrary(onto, BASE)
    const stone = useRequest(STONE)
    expect(library.commit(patchOf(answer(stone, 'patch/stone')), stone).ok).toBe(true)
    const stick = useRequest(STICK)
    const c = library.commit(patchOf(answer(stick, 'patch/stick')), stick, new Date(), ['patch/stone'])
    expect(c.ok).toBe(true)
    // the stone's answer is no revision's to remove, and the log does not say it was replaced
    expect(library.lib.rules.has('patch/stone')).toBe(true)
    expect(library.since(0).find((e) => e.seq === c.seq)).not.toHaveProperty('replaces')
  })

  it('never a base rule: a patch under its id is refused, and the base rule stays', () => {
    const library = new WorldLibrary(onto, BASE)
    const req = useRequest()
    const c = library.commit(patchOf(answer(req, 'core/put')), req, new Date(), ['core/put'])
    expect(c.ok).toBe(false)
    expect(c.result.errors.join('\n')).toMatch(/id already exists in the library/)
    expect(library.lib.rules.get('core/put')?.source?.origin).toBe('base')
    expect(library.lib.clone().rules.get('core/put')?.source?.origin).toBe('base')
  })

  it('a request asked "again" about another question\'s answer leaves that answer in the library', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-integrity-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const stone = useRequest(STONE)
    expect(library.commit(patchOf(answer(stone, 'patch/someone-else')), stone).ok).toBe(true)
    // a client asks about a stick, saying it asks again about the stone's answer
    const req = { ...useRequest(STICK), again: { rule: 'patch/someone-else', times: 3 } }
    const model = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => (opts.purpose === 'design' ? { patch: patchOf(answer(req, 'patch/stick', 'The stick taps it.')), summary: 'a stick on a dead tree' } : {}))
    const state = SelfState.open(join(dir, 'modder-state'))
    const h = state.harness()
    state.setHarness({ ...h, audit: { ...auditOf(h), rounds: 0 }, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false }, 'test: the commit alone')
    const modder = new Modder({ library, state, model, profile: 'live' })
    expect((await modder.resolve({ request: req })).outcome).toBe('accepted')
    await modder.settled()
    expect(library.lib.rules.has('patch/stick')).toBe(true)
    expect(library.lib.rules.has('patch/someone-else')).toBe(true)
  })
})

describe('prune and a revision under the same id', () => {
  it('keeps a valid revision whose earlier version (under its id) the validator no longer takes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-integrity-'))
    const req = useRequest()
    const at = new Date().toISOString()
    // the first version came in under an older validator (a mood it no longer knows); the revision reuses its id
    const first: Rule = { ...answer(req, 'patch/x'), tree: { do: [{ op: 'emote', mood: 'smug' as never }] } }
    const revised = answer(req, 'patch/x')
    const log = [
      { seq: 1, at, patch: patchOf(first), rules: ['patch/x'], scenario: req.scenario },
      { seq: 2, at, remove: 'patch/x' },
      { seq: 3, at, patch: patchOf(revised), rules: ['patch/x'], scenario: req.scenario, replaces: ['patch/x'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.prune()).toEqual([])
    expect(library.lib.rules.get('patch/x')?.tree).toEqual(revised.tree)
  })
})

describe('an entry is in force only once written', () => {
  it('a commit the log could not keep is not in force, not served, and takes no seq', () => {
    const lines: string[] = []
    let full = false
    const store: LogStore = {
      id: 'log-1',
      lines: () => [...lines],
      append(line) {
        if (full) throw new Error('ENOSPC: no space left on device')
        lines.push(line)
      },
    }
    const library = new WorldLibrary(onto, BASE, store)
    const stone = useRequest(STONE)
    full = true
    expect(() => library.commit(patchOf(answer(stone, 'patch/a')), stone)).toThrow(/ENOSPC/)
    expect(library.lib.rules.has('patch/a')).toBe(false)
    expect(library.since(0)).toEqual([])
    full = false
    const stick = useRequest(STICK)
    expect(library.commit(patchOf(answer(stick, 'patch/b')), stick).seq).toBe(1)
    // the log on disk and the library in memory say the same
    expect(new WorldLibrary(onto, BASE, store).since(0).map((e) => e.seq)).toEqual(library.since(0).map((e) => e.seq))
  })
})

describe('one process writes a log', () => {
  it('a log another live process holds is refused; one whose holder is gone is taken over', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-integrity-'))
    const file = join(dir, 'library.jsonl')
    // the service, in another process (this one's parent stands for it: alive, and not this process)
    writeFileSync(`${file}.lock`, `${process.ppid}\n`)
    expect(() => new WorldLibrary(onto, BASE, file)).toThrow(/open in another process/)
    // a service that was killed: its pid is no process now
    const gone = spawnSync(process.execPath, ['-e', '']).pid
    writeFileSync(`${file}.lock`, `${gone}\n`)
    const library = new WorldLibrary(onto, BASE, file)
    expect(readFileSync(`${file}.lock`, 'utf8').trim()).toBe(String(process.pid))
    const req = useRequest()
    expect(library.commit(patchOf(answer(req, 'patch/a')), req).seq).toBe(1)
  })
})
