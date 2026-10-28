// The shared library's log as a service keeps it (library.ts): what survives a restart, what a client
// is told about the log itself, and what a commit refuses.

import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, placePatch, holeKey, validatePatch, compose, locate, patchKey, restoreLibrary, withArtifacts, type ModRequest, type Patch, type Rule, type Scenario, type Cond, type Tree } from '@openworld/engine'
import { SelfState, Modder, WorldLibrary, createModderServer, ScriptedModel, auditOf, askedCounts, candidates, lowestCommonAncestor, normalKey, normalizeTree, probe, type ChatMessage, type ChatOptions, type LogStore } from '@openworld/ai'
import { spawnSync } from 'node:child_process'
import { BASE, SEIZE, slimeLibrary, DEAD_TREE, SLIME, SLOW, STONE, ask, offerRequest, onto, patchOf, useRequest, useScene } from './fixtures.ts'

/** These commit and replay in the sandbox: under a full parallel run, slow. */
/** The creature offered a stone is weighed down by it (a learned rule, placed where the request fell undefined). */
function bind(id: string, req: ModRequest, effects: unknown[] = [{ op: 'addStatus', status: 'frozen', duration: 30 }, { op: 'log', text: { en: 'You weigh {host} down.', zh: '你压住了{host}。' } }]): Patch {
  const rule: Rule = { id, host: { type: 'x' }, on: 'x', doc: 'a creature offered a stone is weighed down', tree: { if: { is: { role: 'item', sel: { tags: ['stone'] } } }, then: { do: effects as never }, else: { undefined: true } } }
  return placePatch({ artifacts: [{ kind: 'rule', rule }] }, req).patch
}

const dir = () => mkdtempSync(join(tmpdir(), 'lsw-library-'))

describe('the log after a restart', () => {
  it('a torn last line does not swallow the next commit, and no seq is used twice', SLOW, () => {
    const file = join(dir(), 'library.jsonl')
    const slime = offerRequest()
    const first = new WorldLibrary(onto, BASE, file)
    expect(first.commit(bind('patch/a', slime), slime).seq).toBe(1)
    // the service stopped in the middle of writing the next entry
    appendFileSync(file, '{"seq":2,"at":"2026-10-')
    const wolf = offerRequest('actor/creature/beast/wolf')
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
    const slime = offerRequest()
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
    const slime = offerRequest()
    const wolf = offerRequest('actor/creature/beast/wolf')
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
    const slime = offerRequest()
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
    const player = offerRequest()
    expect(library.validate(bind('patch/slime-lashes', player, [{ op: 'emit', impulse: 'strike', to: 'actor', params: { power: 5 } }]), player).ok).toBe(true)
    const c = library.commit(harm, req)
    expect(c.ok).toBe(false)
    expect(c.result.errors.join()).toMatch(/a world event may not hurt a person/)
  })
})

// The shared library's log stays what every client can trust (design.md §9): a patch takes the place only of
// the earlier answer to its own question (never a base rule, never another question's answer, whatever a
// request names), a revision under an old id is judged as itself, an entry is in force only once written,
// and one process writes a log.

const STICK = 'item/material/stick'

/** An answer placed where the request fell undefined. */
const answerTo = (req: ModRequest, id: string, text = 'You knock it on the tree.'): Rule => ({
  id,
  host: { type: req.event.host!.type! },
  on: 'act/use',
  hole: holeKey(req.hole.rule, req.hole.path),
  at: req.hole.at,
  label: { en: 'Use {instrument}', zh: '使用{instrument}' },
  tree: { do: [{ op: 'log', text: { en: text, zh: '你敲了敲树。' } }] },
})

describe('what a patch takes the place of', () => {
  it('not the answer to another question, though the request names it as the one it asks about again', () => {
    const library = new WorldLibrary(onto, BASE)
    const stone = useRequest(DEAD_TREE, STONE)
    expect(library.commit(patchOf(answerTo(stone, 'patch/stone')), stone).ok).toBe(true)
    const stick = { ...useRequest(DEAD_TREE, STICK), again: { rule: 'patch/stone', times: 3 } }
    const c = library.commit(patchOf(answerTo(stick, 'patch/stick')), stick, new Date(), ['patch/stone'])
    expect(c.ok).toBe(true)
    // the stone's answer is no revision's to remove, and the log does not say it was replaced
    expect(library.lib.rules.has('patch/stone')).toBe(true)
    expect(library.since(0).find((e) => e.seq === c.seq)).not.toHaveProperty('replaces')
  })

  it('every rule of the answer a revision revises: a helper the revision leaves out goes too', () => {
    const library = new WorldLibrary(onto, BASE)
    const stone = useRequest(DEAD_TREE, STONE)
    const stick = useRequest(DEAD_TREE, STICK)
    // the answer to the stone, with a helper elsewhere (the stick's place)
    expect(library.commit(patchOf(answerTo(stone, 'patch/stone'), answerTo(stick, 'patch/helper')), stone).result.errors).toEqual([])
    const c = library.commit(patchOf(answerTo(stone, 'patch/stone-2', 'You tap the tree.')), stone, new Date(), ['patch/stone', 'patch/helper'])
    expect(c.result.errors).toEqual([])
    expect(library.lib.rules.has('patch/stone')).toBe(false)
    expect(library.lib.rules.has('patch/helper')).toBe(false)
  })

  it('never a base rule: a patch under its id is refused, and the base rule stays', () => {
    const library = new WorldLibrary(onto, BASE)
    const req = useRequest()
    const c = library.commit(patchOf(answerTo(req, 'core/put')), req, new Date(), ['core/put'])
    expect(c.ok).toBe(false)
    expect(c.result.errors.join('\n')).toMatch(/id already exists in the library/)
    expect(library.lib.rules.get('core/put')?.source?.origin).toBe('base')
    expect(library.lib.clone().rules.get('core/put')?.source?.origin).toBe('base')
  })

  it('a request asked "again" about another question\'s answer leaves that answer in the library', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-integrity-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const stone = useRequest(DEAD_TREE, STONE)
    expect(library.commit(patchOf(answerTo(stone, 'patch/someone-else')), stone).ok).toBe(true)
    // a client asks about a stick, saying it asks again about the stone's answer
    const req = { ...useRequest(DEAD_TREE, STICK), again: { rule: 'patch/someone-else', times: 3 } }
    const model = new ScriptedModel((_m: ChatMessage[], opts: ChatOptions) => (opts.purpose === 'design' ? { patch: patchOf(answerTo(req, 'patch/stick', 'The stick taps it.')), summary: 'a stick on a dead tree' } : {}))
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
    const first: Rule = { ...answerTo(req, 'patch/x'), tree: { do: [{ op: 'emote', mood: 'smug' as never }] } }
    const revised = answerTo(req, 'patch/x')
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
    const stone = useRequest(DEAD_TREE, STONE)
    full = true
    expect(() => library.commit(patchOf(answerTo(stone, 'patch/a')), stone)).toThrow(/ENOSPC/)
    expect(library.lib.rules.has('patch/a')).toBe(false)
    expect(library.since(0)).toEqual([])
    full = false
    const stick = useRequest(DEAD_TREE, STICK)
    expect(library.commit(patchOf(answerTo(stick, 'patch/b')), stick).seq).toBe(1)
    // the log on disk and the library in memory say the same
    expect(new WorldLibrary(onto, BASE, store).since(0).map((e) => e.seq)).toEqual(library.since(0).map((e) => e.seq))
  })
})

describe('one process writes a log', () => {
  it('a log another live process holds is read freely but not written; one whose holder is gone is taken over', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-integrity-'))
    const file = join(dir, 'library.jsonl')
    const req = useRequest()
    // the service, in another process (this one's parent stands for it: alive, and not this process)
    writeFileSync(`${file}.lock`, `${process.ppid}\n`)
    const reader = new WorldLibrary(onto, BASE, file)
    expect(reader.since(0)).toEqual([])
    expect(() => reader.commit(patchOf(answerTo(req, 'patch/a')), req)).toThrow(/open in another process/)
    // a service that was killed: its pid is no process now
    const gone = spawnSync(process.execPath, ['-e', '']).pid
    writeFileSync(`${file}.lock`, `${gone}\n`)
    const library = new WorldLibrary(onto, BASE, file)
    expect(library.commit(patchOf(answerTo(req, 'patch/a')), req).seq).toBe(1)
    expect(readFileSync(`${file}.lock`, 'utf8').trim()).toBe(String(process.pid))
  })

  it('a log written since it was read is not written: no seq is taken twice', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'lsw-integrity-')), 'library.jsonl')
    const stone = useRequest(DEAD_TREE, STONE)
    const stick = useRequest(DEAD_TREE, STICK)
    const service = new WorldLibrary(onto, BASE, file)
    // another library over the file (a command line beside the service) writes first
    expect(new WorldLibrary(onto, BASE, file).commit(patchOf(answerTo(stone, 'patch/stone')), stone).seq).toBe(1)
    expect(() => service.commit(patchOf(answerTo(stick, 'patch/stick')), stick)).toThrow(/written by another process/)
    expect(readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l).seq)).toEqual([1])
  })
})

// The shared library holds only what the validator, as it is now, takes: a patch it grew stricter
// than (or whose hole the content came to answer) is rolled back before any client syncs it.

/** The stone used on a dead tree: the hole in `core/use` a held thing with a target falls into (read off a real request, never hard-coded). */
const USE_HOLE = (() => {
  const { hole } = ask().req!
  return holeKey(hole.rule, hole.path)
})()
const ON_DEAD_TREE: Cond = { is: { role: 'target', sel: { type: DEAD_TREE } } }
/** The branch key of a condition not taken (as `locate` reads a path). */
const not = (c: Cond) => `!${JSON.stringify(c)}`

/** A learned rule of the stone's own (design.md §5.16): a first answer, or one placed at the open leaf of the answer before it. */
const learned = (id: string, type?: object, at: string[] = []): Patch => ({
  artifacts: [
    ...(type ? [{ kind: 'type' as const, type: type as never }] : []),
    { kind: 'rule', rule: { id, host: { type: STONE }, on: 'act/use', hole: USE_HOLE, at, label: { en: 'Use {instrument}', zh: '使用{instrument}' }, tree: { if: ON_DEAD_TREE, then: { do: [{ op: 'log', text: { en: 'You knock the stone on it.', zh: 'You knock the stone on it.' } }] }, else: { undefined: true } } } },
  ],
})

describe('library prune', () => {
  it('of two learned things by one name, forgets the later (the other name), keeping the one learned first', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const bead = (id: string) => ({ id, name: { en: id.endsWith('glass_bead') ? 'Glass Bead' : 'Glassy Bead', zh: '玻璃珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    // the second came in under an older validator that did not compare Chinese names
    const log = [
      { seq: 1, at, patch: { artifacts: [{ kind: 'type', type: bead('item/material/glass_bead') }] }, rules: [] },
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: bead('item/material/glassy_bead') }] }, rules: [] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    library.prune()
    expect(library.lib.types.map((t) => t.id)).toEqual(['item/material/glass_bead'])
  })

  it('keeps a revised thing made of something learned after it was first brought', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const bead = (made: string) => ({ id: 'item/material/glass_bead', name: { en: 'Glass Bead', zh: '玻璃珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: made, count: 1 }] })
    const grit = { id: 'item/material/grit', name: { en: 'Grit', zh: '砂砾' }, tags: [], props: { material: 'stone' }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const log = [
      { seq: 1, at, patch: learned('patch/stone-bead', bead('item/material/stone')), rules: ['patch/stone-bead'] },
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: grit }] }, rules: [] },
      { seq: 3, at, patch: learned('patch/stone-bead-2', bead('item/material/grit')), rules: ['patch/stone-bead-2'], replaces: ['patch/stone-bead'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    library.prune()
    expect(library.lib.types.map((t) => t.id).sort()).toEqual(['item/material/glass_bead', 'item/material/grit'])
  })

  it('takes learned first by when it was first brought, not by a revision\'s redefinition; a kind of a forgotten thing goes with it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const bead = (id: string, en: string, tags: string[] = []) => ({ id, name: { en, zh: '玻璃珠' }, tags, props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    const blue = { id: 'item/material/glassy_bead/blue', name: { en: 'Blue Bead', zh: '蓝珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const log = [
      { seq: 1, at, patch: learned('patch/stone-bead', bead('item/material/glass_bead', 'Glass Bead')), rules: ['patch/stone-bead'] },
      // under an older validator: the same Chinese name, and a kind of it in the same patch
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: bead('item/material/glassy_bead', 'Glassy Bead') }, { kind: 'type', type: blue }] }, rules: [] },
      // the first bead's answer revised, the bead defined again (it moves to the end of the library's types)
      { seq: 3, at, patch: learned('patch/stone-bead-2', bead('item/material/glass_bead', 'Glass Bead', ['shiny'])), rules: ['patch/stone-bead-2'], replaces: ['patch/stone-bead'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    library.prune()
    expect(library.lib.types.map((t) => t.id)).toEqual(['item/material/glass_bead'])
  })

  it('rolls back what no longer holds, and keeps what does: the types a patch brought are its own, not "a type that exists already"', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    // a new kind of bead, named and made of what it is made of: valid now
    const bead = { id: 'item/material/glass_bead', name: { en: 'Glass Bead', zh: '玻璃珠' }, tags: [], props: { material: 'glass' }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    // an older one with no material: the validator has since grown stricter
    const old = { id: 'item/material/clay_bead', name: { en: 'Clay Bead', zh: '陶珠' }, tags: [], props: {} }
    const log = [
      { seq: 1, at, patch: learned('patch/stone-bead', bead), rules: ['patch/stone-bead'] },
      { seq: 2, at, patch: { artifacts: [{ kind: 'type', type: old }] }, rules: [] },
      { seq: 3, at, patch: learned('patch/stone-clay', old, [not(ON_DEAD_TREE)]), rules: ['patch/stone-clay'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const gone = library.prune()
    expect(gone.map((g) => g.rules)).toEqual([['patch/stone-clay']])
    expect(gone[0].reason).toMatch(/material/)
    expect(library.lib.rules.has('patch/stone-bead')).toBe(true)
    expect(library.lib.rules.has('patch/stone-clay')).toBe(false)
    // and once is enough: nothing more to roll back
    expect(library.prune()).toEqual([])
  })

  it('takes the types a rolled-back patch brought with it, so no later answer makes them and a corrected one can be defined', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    // a food the validator has since learned to refuse: nothing can eat it (no edible)
    const jam = (tags: string[]) => ({ id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags, props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    writeFileSync(join(dir, 'library.jsonl'), JSON.stringify({ seq: 1, at, patch: learned('patch/stone-jam', jam(['sweet'])), rules: ['patch/stone-jam'] }) + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.lib.types.map((t) => t.id)).toContain('item/food/stone_jam')
    expect(library.prune().map((g) => g.rules)).toEqual([['patch/stone-jam']])
    expect(library.lib.rules.has('patch/stone-jam')).toBe(false)
    expect(library.lib.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
    expect(library.since(1)).toEqual([expect.objectContaining({ remove: 'patch/stone-jam' }), expect.objectContaining({ removeType: 'item/food/stone_jam' })])
    // a client that still holds the forgotten thing (something of it in its world) does not bring it back in its workspace
    const stale = library.workspace({ patches: { types: [jam(['sweet']) as never], rules: [{ ...(learned('patch/stone-jam', jam(['sweet'])).artifacts[1] as { rule: object }).rule, source: { origin: 'patch' } } as never], statuses: [] } })
    expect(stale.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
    expect(stale.rules.has('patch/stone-jam')).toBe(false)
    // the corrected thing takes the id again
    expect(library.validate(learned('patch/stone-jam-2', jam(['edible', 'sweet']))).errors).toEqual([])
    // and the log, read again from its file, comes back to the same library
    const again = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(again.lib.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
  })

  it('forgets a refused type a rule rolled back before still left behind, and the later answer that made it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const jam = { id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags: ['sweet'], props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const makes = learned('patch/stone-makes-jam')
    ;(makes.artifacts[0] as { rule: { tree: object } }).rule.tree = { if: ON_DEAD_TREE, then: { do: [{ op: 'spawn', type: 'item/food/stone_jam', at: 'actor', into: 'hand' }, { op: 'destroy' }] }, else: { undefined: true } }
    const log = [
      { seq: 1, at, patch: learned('patch/stone-jam', jam), rules: ['patch/stone-jam'] },
      // rolled back by an earlier prune, which left the type in the library
      { seq: 2, at, remove: 'patch/stone-jam' },
      { seq: 3, at, patch: makes, rules: ['patch/stone-makes-jam'] },
    ]
    writeFileSync(join(dir, 'library.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.lib.rules.has('patch/stone-makes-jam')).toBe(true)
    const gone = library.prune()
    expect(library.lib.types.map((t) => t.id)).not.toContain('item/food/stone_jam')
    expect(gone.map((g) => g.rules)).toEqual([['patch/stone-makes-jam']])
    expect(gone[0].reason).toMatch(/stone_jam/)
  })

  it('lets a revision define again what the patch it replaces made (a food made without its tag), and keeps it in the library', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const jam = (tags: string[]) => ({ id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags, props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] })
    const makes = (id: string, type: object) => {
      const p = learned(id, type)
      ;(p.artifacts[1] as { rule: { tree: object } }).rule.tree = { if: ON_DEAD_TREE, then: { do: [{ op: 'spawn', type: 'item/food/stone_jam', at: 'actor' }, { op: 'destroy' }] }, else: { undefined: true } }
      return p
    }
    writeFileSync(join(dir, 'library.jsonl'), JSON.stringify({ seq: 1, at, patch: makes('patch/stone-jam', jam(['sweet'])), rules: ['patch/stone-jam'] }) + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const revised = makes('patch/stone-jam-2', jam(['edible', 'sweet']))
    // as a new answer the id is taken; in place of the old one it is the revision's to define again
    expect(library.validate(revised).errors.join()).toMatch(/exists already/)
    expect(library.validate(revised, undefined, undefined, ['patch/stone-jam']).errors).toEqual([])
    library.commit(revised, undefined, undefined, ['patch/stone-jam'])
    expect(library.lib.types.find((t) => t.id === 'item/food/stone_jam')?.tags).toContain('edible')
    // and it holds when the library is pruned again (as every start of the service does), read back from its file too
    expect(library.prune()).toEqual([])
    const again = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(again.prune()).toEqual([])
    expect(again.lib.rules.has('patch/stone-jam-2')).toBe(true)
    expect(again.lib.types.find((t) => t.id === 'item/food/stone_jam')?.tags).toContain('edible')
  })

  it('a revision that goes on making the same thing need not define it again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-prune-'))
    const at = new Date().toISOString()
    const jam = { id: 'item/food/stone_jam', name: { en: 'Stone Jam', zh: '石头酱' }, tags: ['edible'], props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/material/stone', count: 1 }] }
    const makes = (id: string, type?: object) => {
      const p = learned(id, type)
      ;(p.artifacts.at(-1) as { rule: { tree: object } }).rule.tree = { if: ON_DEAD_TREE, then: { do: [{ op: 'spawn', type: 'item/food/stone_jam', at: 'actor' }, { op: 'destroy' }] }, else: { undefined: true } }
      return p
    }
    writeFileSync(join(dir, 'library.jsonl'), JSON.stringify({ seq: 1, at, patch: makes('patch/stone-jam', jam), rules: ['patch/stone-jam'] }) + '\n')
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    expect(library.validate(makes('patch/stone-jam-2'), undefined, undefined, ['patch/stone-jam']).errors).toEqual([])
  })
})

// Learned rules take one leaf (design.md §5.16): one tree per (type, kind, hole), grown by answers
// in order; a second answer fills an open leaf of the first; sibling types are not reached; an
// answer set aside at runtime opens its leaves again; the request says where the next answer goes.

// (a creature used on would be offered the thing: `core/use` answers it; a dead tree and a beehive are its hole)
const HIVE = 'fixture/nature/beehive'

const is = (type: string): Cond => ({ is: { role: 'target', sel: { type } } })
const rule = (id: string, tree: Rule['tree']): Patch => ({ artifacts: [{ kind: 'rule', rule: { id, host: { type: 'x' }, on: 'x', label: { en: 'Use {instrument} on {target}', zh: 'Use {instrument} on {target}' }, tree } }] })

describe('one tree per (type, kind, hole)', () => {
  it('the first answer is the tree; the request for a case it left open says where the next goes', () => {
    const { port, req } = ask(DEAD_TREE)
    expect(req.hole.at).toEqual([])
    // the dead tree's case answered, the rest left open
    const first = placePatch(rule('patch/stone-tree', { if: is(DEAD_TREE), then: { do: [{ op: 'log', text: { en: 'tree', zh: 'tree' } }] }, else: { undefined: true } }), req).patch
    const r = (first.artifacts[0] as { rule: Rule }).rule
    expect(r).toMatchObject({ host: { type: STONE }, on: 'act/use', hole: holeKey(req.hole.rule, req.hole.path), at: [] })
    expect(port.submit(req.id, first).ok).toBe(true)
    const lib = port['eng'].lib
    // a beehive reaches the open leaf: still a hole, and the request's `at` is the path to that leaf
    const hive = ask(HIVE, lib.clone())
    expect(hive.res.defined).toBe(false)
    expect(hive.req.hole.at).toEqual(['!' + JSON.stringify(is(DEAD_TREE))])
    expect(hive.req.hole.at).toEqual(hive.res.open?.path)
    // the second answer replaces that leaf; the dead tree's answer is untouched
    const second = placePatch(rule('patch/stone-hive', { do: [{ op: 'log', text: { en: 'hive', zh: 'hive' } }] }), hive.req).patch
    expect(hive.port.submit(hive.req.id, second).ok).toBe(true)
    const key = patchKey(STONE, 'act/use', hive.req.hole.rule + (hive.req.hole.path.length ? '#' + hive.req.hole.path.join('&') : ''))
    const tree = hive.eng.lib.tree(key)!
    expect(locate(tree, [])).toBeUndefined() // the root is a branch now
    expect(locate(tree, hive.req.hole.at)?.leaf).toEqual({ do: [{ op: 'log', text: { en: 'hive', zh: 'hive' } }] })
    expect(hive.eng.resolveEvent(hive.eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' })).rule?.id).toBe('patch/stone-hive')
    const again = ask(DEAD_TREE, hive.eng.lib.clone())
    expect(again.res.defined).toBe(true)
    expect(again.eng.resolveEvent(again.eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' })).rule?.id).toBe('patch/stone-tree')
  })

  it('an answer at a leaf already answered is refused; a first answer with a path is refused', () => {
    const { port, req, eng } = ask(DEAD_TREE)
    const first = placePatch(rule('patch/a', { do: [{ op: 'log', text: { en: 'a', zh: 'a' } }] }), req).patch
    expect(port.submit(req.id, first).ok).toBe(true)
    const again = { ...first, artifacts: [{ kind: 'rule' as const, rule: { ...(first.artifacts[0] as { rule: Rule }).rule, id: 'patch/b' } }] }
    expect(validatePatch(again, { ontology: onto, library: eng.lib }).errors.join()).toMatch(/already answered/)
    const deep = { artifacts: [{ kind: 'rule' as const, rule: { ...(first.artifacts[0] as { rule: Rule }).rule, id: 'patch/c', hole: 'core/handle', at: ['x'] } }] }
    expect(validatePatch(deep, { ontology: onto, library: eng.lib }).errors.join()).toMatch(/no tree at this hole yet/)
  })

  it('two rules of one patch cannot take the same leaf', () => {
    const { req, eng } = ask(DEAD_TREE)
    const r = (placePatch(rule('patch/a', { do: [] }), req).patch.artifacts[0] as { rule: Rule }).rule
    const twice: Patch = { artifacts: [{ kind: 'rule', rule: r }, { kind: 'rule', rule: { ...r, id: 'patch/b' } }] }
    expect(validatePatch(twice, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()).toMatch(/"patch\/b".at: that leaf is already answered/)
  })

  it('a learned rule never inherits, and names one type only', () => {
    const { req, eng } = ask(DEAD_TREE)
    const bad = (r: Partial<Rule>) => validatePatch({ artifacts: [{ kind: 'rule', rule: { ...(placePatch(rule('patch/x', { do: [] }), req).patch.artifacts[0] as { rule: Rule }).rule, ...r } }] }, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()
    expect(bad({ tree: { if: is(HIVE), then: { do: [] }, else: 'inherit' } })).toMatch(/never inherits/)
    expect(bad({ tree: { if: is(HIVE), then: { do: [] } } })).toMatch(/never inherits/)
    expect(bad({ host: { type: 'item/material' } })).toMatch(/host of the triggering event is a item\/material\/stone/)
    expect(bad({ host: { type: STONE, tags: ['stone'] } })).toMatch(/host must be exactly/)
    expect(bad({ on: 'act' })).toMatch(/exact event kind/)
    expect(bad({ tree: { undefined: true } })).toMatch(/no leaf answers/)
  })

  it('composes in order, keeps each leaf\'s answer, and lists what lost its place', () => {
    const root: Rule = { id: 'r', host: { type: STONE }, on: 'act/use', hole: 'h', at: [], tree: { if: is(DEAD_TREE), then: { do: [] }, else: { undefined: true } }, source: { origin: 'patch' } }
    const no = ['!' + JSON.stringify(is(DEAD_TREE))]
    const second: Rule = { id: 's', host: { type: STONE }, on: 'act/use', hole: 'h', at: no, tree: { do: [{ op: 'log', text: { en: 's', zh: 's' } }] }, source: { origin: 'patch' } }
    const third: Rule = { id: 't', host: { type: STONE }, on: 'act/use', hole: 'h', at: no, tree: { do: [] }, source: { origin: 'patch' } }
    const c = compose([root, second, third])
    expect(c.stale).toEqual([{ id: 't', why: 'its leaf is already answered by "s"' }])
    expect(c.owner.get(locate(c.tree, no)!.leaf as object)).toBe('s')
    expect(c.owner.get(locate(c.tree, [JSON.stringify(is(DEAD_TREE))])!.leaf as object)).toBe('r')
    // in a library: remove the root and the second has no place
    const lib = new RuleLibrary(BASE)
    lib.add(root)
    lib.add(second)
    expect(lib.stale()).toEqual([])
    lib.remove('r')
    expect(lib.stale()).toEqual([{ id: 's', why: 'placed below a leaf, but no answer holds the tree yet' }])
  })

  it('the shared library covers the same key, not a sibling type', () => {
    const library = new WorldLibrary(onto, BASE)
    const { req } = ask(DEAD_TREE)
    // the dead tree's case answered, the rest left open: a beehive is not covered
    expect(library.commit(placePatch(rule('patch/stone-tree', { if: is(DEAD_TREE), then: { do: [{ op: 'log', text: { en: 'tree', zh: 'tree' } }] }, else: { undefined: true } }), req).patch, req).ok).toBe(true)
    expect(library.covering(ask(DEAD_TREE).req)?.rule).toBe('patch/stone-tree')
    expect(library.covering(ask(HIVE).req)).toBeUndefined()
    expect(library.asked).toHaveLength(1)
  })

  it('a leaf cannot be open and an answer at once; at run time such a leaf is open', () => {
    const { req, eng, port } = ask(DEAD_TREE)
    const both = placePatch({ artifacts: [{ kind: 'rule', rule: { id: 'patch/both', host: { type: 'x' }, on: 'x', label: { en: 'x', zh: 'x' }, tree: { undefined: true, do: [{ op: 'nosuchop' } as never] } } }] }, req).patch
    expect(validatePatch(both, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()).toMatch(/never both/)
    // slipped in by hand: the engine reads it as open, so nothing it carries runs
    eng.lib.add({ ...(both.artifacts[0] as { rule: Rule }).rule, source: { origin: 'patch' } })
    const res = eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'it' }, { e: 'held' }))
    expect(res.defined).toBe(false)
    expect(port.records).toHaveLength(1)
  })

  it('a question asked before the tree grew is still placed: where the event falls undefined now', () => {
    const first = ask(DEAD_TREE)
    const stale = ask(HIVE) // asked while the stone's tree was empty: at []
    expect(stale.req.hole.at).toEqual([])
    const a = placePatch(rule('patch/a', { if: is(DEAD_TREE), then: { do: [] }, else: { undefined: true } }), first.req).patch
    expect(first.port.submit(first.req.id, a).ok).toBe(true)
    // the library grew under the second question: its answer goes to the open leaf, not to the root
    const b = placePatch(rule('patch/b', { do: [{ op: 'log', text: { en: 'b', zh: 'b' } }] }), stale.req, { ontology: onto, library: first.eng.lib })
    expect(b.fixes.join()).toMatch(/placed where the event falls undefined now/)
    expect((b.patch.artifacts[0] as { rule: Rule }).rule.at).toEqual(['!' + JSON.stringify(is(DEAD_TREE))])
    const v = validatePatch(b.patch, { ontology: onto, library: first.eng.lib, scenario: stale.req.scenario })
    expect(v.errors).toEqual([])
  })

  it('a rule naming a hole that is not an open leaf of a base rule is refused', () => {
    const { req, eng } = ask(DEAD_TREE)
    const r = (placePatch(rule('patch/x', { do: [] }), req).patch.artifacts[0] as { rule: Rule }).rule
    const bad = (hole: string) => validatePatch({ artifacts: [{ kind: 'rule', rule: { ...r, hole } }] }, { ontology: onto, library: eng.lib }).errors.join()
    expect(bad('core/nothing-of-the-kind')).toMatch(/no base rule/)
    expect(bad('core/use')).toMatch(/not an open leaf/) // the root of act/use branches before its hole
    expect(bad('use/eat')).toMatch(/not an open leaf/)
  })

  it('a learned rule set aside at run time leaves the library, and its leaf takes a new answer', () => {
    const { req, eng, port } = ask(DEAD_TREE)
    expect(port.submit(req.id, placePatch(rule('patch/a', { do: [{ op: 'log', text: { en: 'a', zh: 'a' } }] }), req).patch).ok).toBe(true)
    expect(eng.fault('patch/a', 'it ran away', true)).toBe(true)
    expect(eng.lib.rules.has('patch/a')).toBe(false)
    expect(eng.world.state.quarantine?.['patch/a']).toBeDefined()
    const again = ask(DEAD_TREE, eng.lib.clone())
    expect(again.res.defined).toBe(false)
    expect(again.port.submit(again.req.id, placePatch(rule('patch/b', { do: [] }), again.req).patch).ok).toBe(true)
  })

  it('a revision takes its predecessor\'s place, so what grew below it stays', () => {
    const lib = new RuleLibrary(BASE)
    const h = holeKey(ask(DEAD_TREE).req.hole.rule, ask(DEAD_TREE).req.hole.path)
    const no = ['!' + JSON.stringify(is(DEAD_TREE))]
    const root = (id: string): Rule => ({ id, host: { type: STONE }, on: 'act/use', hole: h, at: [], tree: { if: is(DEAD_TREE), then: { do: [] }, else: { undefined: true } }, source: { origin: 'patch' } })
    lib.add(root('r1'))
    lib.add({ id: 's', host: { type: STONE }, on: 'act/use', hole: h, at: no, tree: { do: [{ op: 'log', text: { en: 's', zh: 's' } }] }, source: { origin: 'patch' } })
    lib.remove('r1')
    expect(lib.stale().map((x) => x.id)).toEqual(['s'])
    lib.add(root('r2'), undefined, 'r1')
    expect(lib.stale()).toEqual([])
    expect(locate(lib.tree(patchKey(STONE, 'act/use', h))!, no)?.leaf).toEqual({ do: [{ op: 'log', text: { en: 's', zh: 's' } }] })
    // a save restored without the root drops what grew below it, and says so
    const dropped: string[] = []
    const back = restoreLibrary(BASE, { ...lib.toJSON(), rules: lib.toJSON().rules.filter((r) => r.id !== 'r2') }, onto, [], (id, why) => dropped.push(`${id}: ${why}`))
    expect(back.rules.has('s')).toBe(false)
    expect(dropped.join()).toMatch(/^s: /)
  })

  it('a boss offered a handful of grass is not lashed down', () => {
    const king = buildSandbox(useScene('actor/creature/slime/king_slime', 'item/material/grass'), onto, new RuleLibrary(BASE))
    new ModPort(king)
    king.act('use', 'actor', { e: 'it' })
    expect(king.world.hasStatus({ e: 'it' }, 'frozen')).toBe(false)
    const green = buildSandbox(useScene('actor/creature/slime/green_slime', 'item/material/grass'), onto, new RuleLibrary(BASE))
    green.act('use', 'actor', { e: 'it' })
    expect(green.world.hasStatus({ e: 'it' }, 'frozen')).toBe(true)
  })
})

// The upstream loop's detector (docs/upstream.md §2): sibling types whose learned rules answer one
// hole alike make a candidate for a base rule on their class; a differing tree stays apart; a hole
// a class keeps falling into is a candidate even before its answers converge.

const SLIMES = 'actor/creature/slime'
const OFFERED_HOLE = 'core/offered'

const SOAK: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'addStatus', status: 'wet', duration: 30 }] }, else: { undefined: true } }


describe('the lowest common ancestor', () => {
  it('is the deepest shared prefix below the root, never the root alone', () => {
    expect(lowestCommonAncestor([`${SLIMES}/green_slime`, `${SLIMES}/fire_slime`, `${SLIMES}/frost_slime`])).toBe(SLIMES)
    expect(lowestCommonAncestor([`${SLIMES}/green_slime`, 'actor/creature/wolf'])).toBe('actor/creature')
    expect(lowestCommonAncestor([`${SLIMES}/green_slime`, 'actor/person/villager'])).toBeUndefined()
    expect(lowestCommonAncestor([`${SLIMES}/green_slime`])).toBe(`${SLIMES}/green_slime`)
    expect(lowestCommonAncestor([])).toBeUndefined()
  })
})

describe('tree equivalence', () => {
  it('keeps the conditions and the effects, drops the wording, and abstracts the host\'s own type', () => {
    const a: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'transform', into: `${SLIMES}/green_slime` }, { op: 'log', text: { en: 'green', zh: 'green' } }, { op: 'vfx', fx: 'dust' }], label: { en: 'Press', zh: 'Press' } }, else: { undefined: true } }
    const b: Tree = { if: { is: { role: 'item', sel: { type: STONE } } }, then: { do: [{ op: 'transform', into: `${SLIMES}/fire_slime` }, { op: 'log', text: { en: 'fire', zh: '火' } }, { op: 'vfx', fx: 'smoke' }], label: { en: 'Push', zh: 'Push' }, confirm: 'Sure?' }, else: { undefined: true } }
    expect(normalKey(a, `${SLIMES}/green_slime`)).toBe(normalKey(b, `${SLIMES}/fire_slime`))
    expect(JSON.stringify(normalizeTree(a, `${SLIMES}/green_slime`))).toContain('"@host"')
    // the op of what is said stays: a silent rule is not an equivalent one
    const silent: Tree = { ...(a as { if: never; then: never; else: never }), then: { do: [{ op: 'transform', into: `${SLIMES}/green_slime` }, { op: 'vfx', fx: 'dust' }] } }
    expect(normalKey(silent, `${SLIMES}/green_slime`)).not.toBe(normalKey(a, `${SLIMES}/green_slime`))
    expect(normalKey(SEIZE, 'x')).not.toBe(normalKey(SOAK, 'x'))
  })
})

describe('candidates', () => {
  it('S1: three slimes answering alike make one candidate on their class; a differing sibling is not in the cluster', () => {
    const library = slimeLibrary({ [`${SLIMES}/green_slime`]: SEIZE, [`${SLIMES}/fire_slime`]: SEIZE, [`${SLIMES}/frost_slime`]: SEIZE, [`${SLIMES}/spark_slime`]: SOAK })
    expect(library.asked).toHaveLength(4)
    const found = candidates(library, onto)
    expect(found).toHaveLength(1)
    const c = found[0]
    expect(c).toMatchObject({ signal: 'S1', kind: 'impulse/offered', hole: OFFERED_HOLE, ancestor: SLIMES })
    expect(c.types).toEqual([`${SLIMES}/fire_slime`, `${SLIMES}/frost_slime`, `${SLIMES}/green_slime`])
    expect(c.rules.map((r) => r.id).sort()).toEqual(['patch/fire_slime-stone', 'patch/frost_slime-stone', 'patch/green_slime-stone'])
    // the class reaches four types here (the spark slime asked too): three of them answer alike
    expect(c.share).toBeCloseTo(0.75)
    expect(c.normalized).toBe(normalKey(SEIZE, `${SLIMES}/green_slime`))
  })

  it('S1 needs K types and a share S of what the class reaches at the hole', () => {
    const library = slimeLibrary({ [`${SLIMES}/green_slime`]: SEIZE, [`${SLIMES}/fire_slime`]: SEIZE, [`${SLIMES}/frost_slime`]: SEIZE })
    expect(candidates(library, onto)[0].share).toBe(1)
    expect(candidates(library, onto, undefined, { K: 4 })).toEqual([])
    // the sweep says all six slimes reach this hole: three alike is one half, the threshold
    const counts = askedCounts(library)
    for (const t of ['spark_slime', 'water_slime', 'king_slime']) counts.set(`${SLIMES}/${t}|impulse/offered|${OFFERED_HOLE}`, 0)
    const [c] = candidates(library, onto, counts)
    expect(c.share).toBe(0.5)
    expect(candidates(library, onto, counts, { S: 0.6 })).toEqual([])
  })

  it('S2: a class asked N times at one hole, with no cluster, is a candidate on the narrowest class that qualifies', () => {
    const library = slimeLibrary({ [`${SLIMES}/green_slime`]: SEIZE, [`${SLIMES}/fire_slime`]: SOAK })
    const counts = askedCounts(library)
    expect([...counts.values()]).toEqual([1, 1])
    counts.set(`${SLIMES}/frost_slime|impulse/handle|core/handle`, 2)
    counts.set(`${SLIMES}/water_slime|impulse/handle|core/handle`, 2)
    counts.set(`${SLIMES}/king_slime|impulse/handle|core/handle`, 1)
    const found = candidates(library, onto, counts)
    expect(found.map((c) => c.signal)).toEqual(['S2'])
    expect(found[0]).toMatchObject({ kind: 'impulse/handle', hole: 'core/handle', ancestor: SLIMES, asked: 5, rules: [] })
    expect(found[0].normalized).toBeUndefined()
    expect(found[0].types).toEqual([`${SLIMES}/frost_slime`, `${SLIMES}/king_slime`, `${SLIMES}/water_slime`])
    // four questions are not five
    counts.set(`${SLIMES}/king_slime|impulse/handle|core/handle`, 0)
    expect(candidates(library, onto, counts)).toEqual([])
  })
})

// The god loop held to review (docs/design.md §5.16, the artifact's §11): what a learned rule may
// tell the story, what the validator knows of tags, what the repeat check counts, what the probe
// finds without a model, faults reported by clients, scenes not held up by the world's questions.

describe("a learned rule and the story's records", () => {
  it('may notify only a topic: the quest stage, a defeat, a reward are the game\'s own news', () => {
    const { req, eng } = ask(DEAD_TREE)
    const says = (what: string) => validatePatch(placePatch(rule('patch/news', { do: [{ op: 'emit', impulse: 'notify', to: 'actor', params: { what, value: 9 } }] }), req).patch, { ontology: onto, library: eng.lib, scenario: req.scenario }).errors.join()
    expect(says('quest')).toMatch(/may notify only a topic/)
    expect(says('defeat')).toMatch(/may notify only a topic/)
    expect(says('status')).toMatch(/may notify only a topic/)
    expect(says('topic')).toBe('')
  })

  it('and the records trust only their own sources: news of a stage from a stone changes nothing', () => {
    const { req, eng, port } = ask(DEAD_TREE)
    // the validator refuses it; slipped past it (a hand-built rule), the person's own rule ignores news from a thing
    const sneaked: Rule = { ...(placePatch(rule('patch/news', { do: [{ op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'quest', value: 9 } }] }), req).patch.artifacts[0] as { rule: Rule }).rule, source: { origin: 'patch' } }
    eng.lib.add(sneaked)
    eng.act('use', 'actor', { e: 'it' })
    expect(eng.world.player.props?.quest).toBeUndefined()
    expect(port.records).toHaveLength(1)
  })
})

describe('the validator and the repeat check', () => {
  it('knows every tag the world has: a tag nothing carries is refused, a family made at run time is not', () => {
    const { req, eng } = ask(DEAD_TREE)
    const withTag = (tag: string) => validatePatch(placePatch(rule('patch/tag', { if: { has: { role: 'target', tag } }, then: { do: [] }, else: { undefined: true } }), req).patch, { ontology: onto, library: eng.lib }).errors.join()
    expect(withTag('heavy')).toBe('')
    expect(withTag('nosuchtag')).toMatch(/no thing in the world carries the tag "nosuchtag"/)
    expect(withTag('skill:whatever')).toBe('')
  })

  it('counts experience gained for nothing as a yield', () => {
    const { req, eng } = ask(DEAD_TREE)
    const xp = placePatch(rule('patch/xp', { do: [{ op: 'emit', impulse: 'notify', to: 'actor', params: { what: 'topic' } }] }), req).patch
    expect(validatePatch(xp, { ontology: onto, library: eng.lib, scenario: req.scenario }).ok).toBe(true)
    // a hand-built rule that raises the actor's xp through its own hands (the host writes only itself: here the host is the stone, so it cannot;
    // the probe below shows the farm when a receiver does)
    const found = probe(req, onto, eng.lib, withArtifacts(eng.lib, xp))
    expect(found).toEqual([])
  })

  it('the probe finds a farm without a model: a thing made on every use that costs nothing', () => {
    const { req, eng } = ask(DEAD_TREE)
    const farm = placePatch(rule('patch/farm', { do: [{ op: 'spawn', type: STONE, at: 'actor', into: 'contents' }] }), req).patch
    const found = probe(req, onto, eng.lib, withArtifacts(eng.lib, farm))
    expect(found.map((f) => f.kind)).toEqual(['farm'])
    expect(found[0].evidence).toMatch(/with the patch/)
    const fair = placePatch(rule('patch/fair', { do: [{ op: 'spawn', type: STONE, at: 'actor', into: 'contents' }, { op: 'destroy' }] }), req).patch
    expect(probe(req, onto, eng.lib, withArtifacts(eng.lib, fair))).toEqual([])
  })
})

describe('faults and scenes', () => {
  it('a learned rule set aside by enough clients leaves the shared library', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-fault-'))
    const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
    const state = SelfState.open(join(dir, 'modder-state'))
    state.setHarness({ ...state.harness(), revise: false, faults: { remove: 2 } }, 'test')
    const modder = new Modder({ library, state })
    const { req } = ask(DEAD_TREE)
    const p = placePatch(rule('patch/wobbly', { do: [{ op: 'log', text: { en: 'x', zh: 'x' } }] }), req).patch
    expect(library.commit(p, req).ok).toBe(true)
    expect(modder.fault('patch/wobbly', 'a chain that does not end', 'client-a')).toMatchObject({ counted: 1, removed: false })
    expect(library.lib.rules.has('patch/wobbly')).toBe(true)
    expect(modder.fault('patch/wobbly', 'a chain that does not end', 'client-b')).toMatchObject({ counted: 2, removed: true })
    expect(library.lib.rules.has('patch/wobbly')).toBe(false)
    expect(modder.fault('use/eat', 'x', 'client-a')).toMatchObject({ counted: 0, removed: false })
  })

  it("while a scene plays, the world's own question does not hold anyone: the default runs, the answer still applies", () => {
    const eng = buildSandbox(useScene(SLIME), onto, new RuleLibrary(BASE))
    const port = new ModPort(eng)
    let resolve!: (p: Patch | null) => void
    port.provider = { resolve: () => new Promise<Patch | null>((r) => (resolve = r)) }
    eng.world.scene = { id: 'x', step: 0 }
    // a world event the slime has no answer to: a stone held out to it by the world
    eng.queue({ kind: 'impulse/offered', host: { e: 'it' }, roles: { item: { e: 'held' }, source: { e: 'held' } }, params: {}, origin: 'world' })
    eng.flush()
    expect(port.records).toHaveLength(1)
    expect(port.records[0].status).toBe('fallback')
    expect(eng.world.get('it')!.frozenBy).toBeUndefined()
    const answer = placePatch({ artifacts: [{ kind: 'rule', rule: { id: 'patch/sniff', host: { type: 'x' }, on: 'x', tree: { do: [{ op: 'addStatus', status: 'stunned', duration: 5 }] } } }] }, port.records[0].request).patch
    resolve(answer)
    return new Promise<void>((done) => setTimeout(() => (expect(eng.world.hasStatus({ e: 'it' }, 'stunned')).toBe(true), done()), 20))
  })

  it('a stale hole key is told apart from a real one', () => {
    const { req, eng } = ask(DEAD_TREE)
    expect(holeKey(req.hole.rule, req.hole.path)).toMatch(/^core\/use#/)
    const r = (placePatch(rule('patch/x', { do: [] }), req).patch.artifacts[0] as { rule: Rule }).rule
    expect(validatePatch({ artifacts: [{ kind: 'rule', rule: { ...r, hole: 'core/use#!{"none":"instrument"}' } }] }, { ontology: onto, library: eng.lib }).errors.join()).toMatch(/not an open leaf/)
  })
})
