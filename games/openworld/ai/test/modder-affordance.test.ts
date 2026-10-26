// What a thing affords (design.md §5.17): the modder judges it before it designs; a use must change the scene that
// asked (a chair "sat on" by a line alone is sent back); words are provisional, asked again when the player keeps
// trying, and the answer then takes their place, final; the request says whose the thing is and who is near.

import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGAIN_AFTER, ModPort, RuleLibrary, buildSandbox, placePatch, type ModRequest, type Patch, type Rule, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { ScriptedModel, SelfState, auditOf, type ChatMessage, type ChatOptions } from '@openworld/ai'
import { Modder, WorldLibrary, judge, statedAffordance } from '@openworld/ai'

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const CHAIR = 'fixture/furniture/chair'

const scene = (owner?: string): Scenario => ({
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'chair', type: CHAIR, x: 2, y: 1, ...(owner && { props: { owner } }) },
  ],
  event: {},
})

/** A bare hand on the chair: the port's request for the hole it reaches. */
function ask(lib = new RuleLibrary(BASE), owner?: string) {
  const eng = buildSandbox(scene(owner), onto, lib)
  const port = new ModPort(eng)
  eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
  return { eng, port, req: port.records[0]?.request as ModRequest }
}

const line = { op: 'log' as const, text: { en: 'The chair creaks.', zh: '椅子吱呀一声。' } }
const sit = { op: 'emit' as const, impulse: 'settle' as const, to: 'actor' as const, params: { pose: 'sit' } }
const answer = (id: string, effects: Rule['tree']): Patch => ({ artifacts: [{ kind: 'rule', rule: { id, host: { type: CHAIR }, on: 'impulse/handle', doc: 'A chair.', label: { en: 'Sit on {target}', zh: '坐到{target}上' }, tree: effects } }] })

function live(design: (n: number, messages: ChatMessage[]) => object) {
  let n = 0
  const prompts: ChatMessage[][] = []
  const model = new ScriptedModel((messages: ChatMessage[], opts: ChatOptions) => {
    if (opts.purpose === 'review') return { verdict: 'ship', notes: [] }
    if (opts.purpose === 'reflect') return { lessons: {}, skill: null }
    prompts.push([...messages])
    return design(n++, messages)
  })
  const dir = mkdtempSync(join(tmpdir(), 'lsw-afford-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  state.setHarness({ ...state.harness(), audit: { ...auditOf(state.harness()), enabled: false } }, 'test: no audit')
  const modder = new Modder({ library, state, model, profile: 'live' })
  return { modder, library, state, prompts, calls: () => n }
}

describe('the judgment', () => {
  it('is read from the answer, and held to what the rule does', () => {
    expect(statedAffordance({ affords: 'use', patch: {} })).toBe('use')
    expect(statedAffordance({ patch: { affords: 'Words' } })).toBe('words')
    expect(statedAffordance({ patch: {} })).toBeUndefined()
    const { req, eng } = ask()
    const place = (p: Patch) => placePatch(p, req).patch
    // a use whose rule only speaks is a mismatch; one that seats the actor is not
    expect(judge(place(answer('patch/a', { do: [line] })), req, 'use', eng.lib, onto).mismatch).toMatch(/changes nothing/)
    const real = judge(place(answer('patch/b', { do: [sit, line] })), req, 'use', eng.lib, onto)
    expect(real.mismatch).toBeUndefined()
    expect((real.patch.artifacts[0] as { rule: Rule }).rule.affords).toBe('use')
    // words that change the world are a use; nothing said, the rule says
    expect(judge(place(answer('patch/c', { do: [sit] })), req, 'words', eng.lib, onto).affords).toBe('use')
    expect(judge(place(answer('patch/d', { do: [line] })), req, undefined, eng.lib, onto).affords).toBe('words')
    expect(judge(place(answer('patch/e', { do: [] })), req, undefined, eng.lib, onto).affords).toBe('none')
  })

  it('a use that only speaks is sent back once; the real one ships, judged so', async () => {
    const { modder, library, prompts } = live((n) => ({ affords: 'use', patch: n === 0 ? answer('patch/chair-sit', { do: [line] }) : answer('patch/chair-sit', { do: [sit, line] }) }))
    const { req } = ask()
    const r = await modder.resolve({ request: req })
    expect(r.outcome).toBe('accepted')
    expect(prompts).toHaveLength(2)
    expect(prompts[1].at(-1)!.content).toMatch(/You judged this a use/)
    expect(library.lib.rules.get('patch/chair-sit')).toMatchObject({ affords: 'use' })
    // the prompt asked for the judgment, and told of the posture
    expect(prompts[0][0].content).toMatch(/"affords": "use" \| "words" \| "none"/)
    expect(prompts[0][0].content).toMatch(/emit settle to the actor/)
    await modder.settled()
  })

  it('a use that speaks twice is kept as words: provisional, so it can grow', async () => {
    const { modder, library } = live(() => ({ affords: 'use', patch: answer('patch/chair-words', { do: [line] }) }))
    const { req } = ask()
    expect((await modder.resolve({ request: req })).outcome).toBe('accepted')
    expect(library.lib.rules.get('patch/chair-words')).toMatchObject({ affords: 'words' })
    expect(library.lib.rules.get('patch/chair-words')?.reasked).toBeUndefined()
    await modder.settled()
  })
})

describe('words are provisional', () => {
  const words: Rule = { id: 'patch/chair-words', host: { type: CHAIR }, on: 'impulse/handle', hole: 'core/handle', at: [], affords: 'words', tree: { do: [line] }, source: { origin: 'patch' } }

  it('the third try in a row asks again, held like a hole, and the answer takes their place', async () => {
    const lib = new RuleLibrary(BASE)
    lib.add(words)
    const eng = buildSandbox(scene(), onto, lib)
    const port = new ModPort(eng)
    const asked: ModRequest[] = []
    port.provider = { resolve: async (req) => (asked.push(req), { ...answer('patch/chair-sit', { do: [sit, line] }), artifacts: answer('patch/chair-sit', { do: [sit, line] }).artifacts.map((a) => (a.kind === 'rule' ? { ...a, rule: { ...a.rule, affords: 'use' as const, reasked: true } } : a)) }) }
    for (let i = 1; i < AGAIN_AFTER; i++) {
      eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
      eng.tick()
    }
    expect(asked).toHaveLength(0)
    expect(eng.world.hasStatus({ e: 'actor' }, 'seated')).toBe(false)
    eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
    expect(asked).toHaveLength(1)
    expect(asked[0].again).toMatchObject({ rule: 'patch/chair-words', times: AGAIN_AFTER, said: expect.stringMatching(/creaks/) })
    expect(asked[0].hole).toMatchObject({ rule: 'core/handle', at: [] })
    await new Promise((r) => setTimeout(r, 0))
    // the provisional words are gone; the answer stands in their place and the act it was asked for is done
    expect(eng.lib.rules.has('patch/chair-words')).toBe(false)
    expect(eng.lib.rules.get('patch/chair-sit')).toMatchObject({ affords: 'use', reasked: true })
    expect(eng.world.hasStatus({ e: 'actor' }, 'seated')).toBe(true)
  })

  it('tries spread out do not count, and a refused answer leaves the words where they were', async () => {
    const lib = new RuleLibrary(BASE)
    lib.add(words)
    const eng = buildSandbox(scene(), onto, lib)
    const port = new ModPort(eng)
    let asked = 0
    port.provider = { resolve: async () => (asked++, answer('patch/bad', { do: [{ op: 'emit', impulse: 'settle', to: 'actor', params: { pose: 'handstand' } }, { op: 'nonsense' } as never] })) }
    eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
    eng.world.state.tick += 5000
    eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
    eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
    expect(asked).toBe(0)
    eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
    expect(asked).toBe(1)
    await new Promise((r) => setTimeout(r, 0))
    expect(eng.lib.rules.get('patch/chair-words')).toBeDefined()
    expect(eng.lib.rules.has('patch/bad')).toBe(false)
  })

  it('the service answers it in the words\' place, final; it is not covered by them', async () => {
    const { modder, library, prompts } = live(() => ({ affords: 'use', patch: answer('patch/chair-sit', { do: [sit, line] }) }))
    const { req: first } = ask()
    expect(library.commit(placePatch({ artifacts: [{ kind: 'rule', rule: { ...words, source: undefined } }] }, first).patch, first).ok).toBe(true)
    const lib = library.lib.clone()
    const eng = buildSandbox(scene(), onto, lib)
    const port = new ModPort(eng)
    const asked: ModRequest[] = []
    port.provider = { resolve: async (r) => (asked.push(r), null) }
    for (let i = 0; i < AGAIN_AFTER; i++) eng.act('hands', 'actor', { e: 'chair' }, { instrument: null })
    const again = asked[0]
    const r = await modder.resolve({ request: again })
    expect(r.outcome).toBe('accepted')
    expect(prompts[0].at(-1)!.content).toMatch(/# Asked again[\s\S]*creaks/)
    expect(library.lib.rules.has('patch/chair-words')).toBe(false)
    expect(library.lib.rules.get('patch/chair-sit')).toMatchObject({ affords: 'use', reasked: true })
    // a fresh question about the chair is covered by the answer now
    expect((await modder.resolve({ request: ask().req })).outcome).toBe('covered')
    await modder.settled()
  })
})

describe('the request says whose the thing is', () => {
  it('another\'s chair, and who is near', () => {
    expect(ask().req.context.whose).toMatch(/nobody's/)
    expect(ask(undefined, 'npc.marta').req.context.whose).toMatch(/someone else's/)
  })
})
