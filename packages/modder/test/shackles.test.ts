import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type ModRequest, type Patch, type Tree } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { Modder, ScriptedModel, SelfState, WorldLibrary, type ChatMessage, type ChatOptions } from '../src/index.ts'

// The shackles in the loop: what the validator proves wrong goes back to the designer as its
// certificate (the round of a chain that never ends, the cycle of an endless yield), and a draft
// that answers it ships.

const onto = buildOntology()
const BASE = [...BASE_RULES, ...STORY_RULES]
const STATUE = 'fixture/sacred/statue'

/** A blow with an axe on a statue (which cannot break): the hole `impulse/strike`. */
function blowOnStatue(): ModRequest {
  const eng = buildSandbox(
    {
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'axe', type: 'item/weapon/blade/axe', x: 2, y: 2, heldBy: 'actor' },
        { key: 'statue', type: STATUE, x: 2, y: 1 },
      ],
      event: {},
    },
    onto,
    new RuleLibrary(BASE),
  )
  const port = new ModPort(eng)
  eng.act('use', 'actor', { e: 'statue' })
  return port.records.find((r) => r.event.kind === 'impulse/strike')!.request
}

const answer = (id: string, tree: Tree): Patch => ({ artifacts: [{ kind: 'rule', rule: { id, host: { type: STATUE }, on: 'impulse/strike', doc: 'a blow on a statue', tree } }] })
const STICK = { op: 'spawn' as const, type: 'item/material/stick', at: 'host' as const }

/** A designer that answers with the drafts in turn, and keeps what it was told. */
function designer(drafts: Patch[]) {
  const told: string[] = []
  let n = 0
  const model = new ScriptedModel((messages: ChatMessage[], opts: ChatOptions) => {
    if (opts.purpose !== 'design') return {}
    told.push(String(messages[messages.length - 1].content))
    return { patch: drafts[Math.min(n++, drafts.length - 1)], summary: 'a blow on a statue' }
  })
  return { model, told }
}

function setup(model: ScriptedModel) {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-shackles-'))
  const library = new WorldLibrary(onto, BASE, join(dir, 'library.jsonl'))
  const state = SelfState.open(join(dir, 'modder-state'))
  const h = state.harness()
  state.setHarness({ ...h, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false }, 'test: the shackles alone')
  return { library, state, modder: new Modder({ library, state, model, profile: 'live' }) }
}

describe('the shackles in the loop', () => {
  it('a chain that never ends goes back to the designer with its round; the gated draft ships', async () => {
    const echo = answer('patch/statue-echo', { do: [{ op: 'emit', impulse: 'strike', to: 'host' }] })
    const rings = answer('patch/statue-rings', { if: { prop: { role: 'host', key: 'rung', default: 0, cmp: { lt: 3 } } }, then: { do: [{ op: 'addProp', key: 'rung', delta: 1 }, { op: 'emit', impulse: 'strike', to: 'host' }] }, else: { do: [] } })
    const { model, told } = designer([echo, rings])
    const { library, state, modder } = setup(model)
    const reply = await modder.resolve({ request: blowOnStatue() })
    expect(reply.outcome).toBe('accepted')
    expect(told[1]).toMatch(/chain: the triggering event sets off events that never end: it sets off the same event on the same world again: impulse\/strike on fixture\/sacred\/statue → impulse\/strike on fixture\/sacred\/statue/)
    expect(state.episode(reply.episode!)!.attempts.map((a) => a.errors.some((e) => e.startsWith('chain:')))).toEqual([true, false])
    expect([...library.lib.rules.keys()].filter((id) => id.startsWith('patch/'))).toEqual(['patch/statue-rings'])
  })

  it('an endless yield goes back with its cycle; a store that runs out ships', async () => {
    const farm = answer('patch/statue-sticks', { do: [STICK] })
    const chips = answer('patch/statue-chips', { if: { prop: { role: 'host', key: 'chipped', default: 0, cmp: { lt: 20 } } }, then: { do: [STICK, { op: 'addProp', key: 'chipped', delta: 1 }] }, else: { do: [] } })
    const { model, told } = designer([farm, chips])
    const { library, modder } = setup(model)
    const reply = await modder.resolve({ request: blowOnStatue() })
    expect(reply.outcome).toBe('accepted')
    expect(told[1]).toMatch(/endless yield: .*every 1 replay\(s\) come back to where they began and make 1 thing/)
    expect([...library.lib.rules.keys()].filter((id) => id.startsWith('patch/'))).toEqual(['patch/statue-chips'])
  })

  it('a designer that keeps the loop fails the request, and the library stays clean', async () => {
    const echo = answer('patch/statue-echo', { do: [{ op: 'emit', impulse: 'strike', to: 'host' }] })
    const { model } = designer([echo])
    const { library, modder } = setup(model)
    const reply = await modder.resolve({ request: blowOnStatue() })
    expect(reply.outcome).toBe('failed')
    expect(reply.diagnostics?.join()).toMatch(/chain:/)
    expect([...library.lib.rules.keys()].filter((id) => id.startsWith('patch/'))).toEqual([])
  })
})
