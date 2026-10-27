import { describe, expect, it } from 'vitest'
import { buildSandbox, ModPort, RuleLibrary, type Patch, type TypeDef } from '@openworld/engine'
import { ScriptedModel } from '@openworld/ai'
import { BASE, noAudit, onto, quiet, testModder } from './fixtures.ts'

const invention: TypeDef = {
  id: 'item/tool/sickle/invention_save_test', name: { en: 'Fordreed Sickle', zh: '渡苇镰刀' }, researched: true,
  makeup: [{ type: 'item/material/log', count: 4 }, { type: 'item/material/stick', count: 2 }, { type: 'item/material/grass', count: 1 }],
  station: 'hands', props: { value: 10, material: 'wood' },
}
function asking(target: 'self' | 'road' = 'self') {
  const lib = new RuleLibrary(BASE)
  lib.addType(invention)
  const eng = buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: invention.id, heldBy: 'actor', x: 2, y: 2 },
  ], terrain: Array.from({ length: 5 }, () => Array(5).fill('path')), event: {} }, onto, lib)
  const port = new ModPort(eng)
  eng.act('use', 'actor', target === 'self' ? { e: 'actor' } : eng.world.cellRef('sandbox', 2, 1))
  const request = port.records[0].request
  return { eng, port, body: { request, workspace: { patches: { rules: lib.patches(), types: lib.types, statuses: lib.statuses } } } }
}

describe('save-private research answers', () => {
  it('answers an ordinary act for everyone though the save holds an invention: shared, recorded, designed without it', async () => {
    const lib = new RuleLibrary(BASE)
    lib.addType(invention)
    const eng = buildSandbox({ entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: 'item/material/stone', heldBy: 'actor', x: 2, y: 2 },
      { key: 'invention', type: invention.id, inside: 'actor', x: 2, y: 2 },
    ], event: {} }, onto, lib)
    const port = new ModPort(eng)
    eng.act('use', 'actor', { e: 'actor' })
    const request = port.records[0].request
    expect(request.event.host?.type).toBe('item/material/stone')
    const model = new ScriptedModel(() => ({ artifacts: [{ kind: 'rule', rule: {
      id: 'patch/ordinary-stone-private-save', host: { type: 'item/material/stone' }, on: 'act/use', tree: { do: [{ op: 'log', text: 'You weigh the stone in your hand.' }] },
    } }] }))
    const { modder, library, state } = testModder({ model, harness: h => ({ ...quiet(h), ...noAudit(h) }) })
    const reply = await modder.resolve({ request, workspace: { patches: { rules: lib.patches(), types: lib.types, statuses: lib.statuses } } })
    expect(reply.outcome, JSON.stringify(reply)).toBe('accepted')
    expect(reply.patch?.scope).toBeUndefined()
    expect(port.submit(request.id, reply.patch!).errors).toEqual([])
    // the shared library has it, and the modder remembers the work
    expect(library.lib.rules.has('patch/ordinary-stone-private-save')).toBe(true)
    expect(library.lib.types.some((t) => t.id === invention.id)).toBe(false)
    expect(state.episodes()).toHaveLength(1)
  })
  it('native admission records every new definition on the private rule even if unused', () => {
    const { eng, port, body } = asking()
    const patch: Patch = { scope: 'save', artifacts: [
      { kind: 'type', type: { id: 'item/material/private_reed_tie', name: { en: 'Private Reed Tie', zh: '私人苇绳' }, props: { material: 'plant' }, makeup: [{ type: 'item/material/grass', count: 1 }], station: 'hands' } },
      { kind: 'status', status: { id: 'private_reed_care', name: { en: 'Reed Care', zh: '苇绳养护' } } },
      { kind: 'rule', rule: { id: 'patch/private-care-definitions', host: { type: invention.id }, on: 'act/use', tree: { do: [{ op: 'log', text: 'The edge is sound.' }] } } },
    ] }
    const result = port.submit(body.request.id, patch)
    expect(result.errors).toEqual([])
    expect(eng.lib.rules.get('patch/private-care-definitions')?.source?.local).toEqual({ types: ['item/material/private_reed_tie'], statuses: ['private_reed_care'] })
    expect(eng.lib.types.some(t => t.id === 'item/material/private_reed_tie')).toBe(true)
    expect(eng.lib.statuses.some(s => s.id === 'private_reed_care')).toBe(true)
  })
  it('answers a researched type without committing its kind or rule to the shared library', async () => {
    const { eng, port, body } = asking()
    let draft: Patch = { artifacts: [{ kind: 'rule', rule: {
      id: 'patch/sickle-care', host: { type: invention.id }, on: 'act/use',
      label: { en: 'Inspect {instrument}', zh: '查看{instrument}' },
      tree: { do: [{ op: 'log', text: 'The wooden edge is still sound.' }] },
    } }] }
    const model = new ScriptedModel(() => draft)
    const { modder, library, state } = testModder({ model, harness: h => ({ ...quiet(h), ...noAudit(h) }) })
    const reply = await modder.resolve(body)
    expect(reply.outcome, reply.diagnostics?.join()).toBe('accepted')
    expect(reply.patch?.scope).toBe('save')
    expect(library.seq).toBe(0)
    expect(library.lib.types).toEqual([])
    expect(library.lib.rules.has('patch/sickle-care')).toBe(false)
    expect(state.episodes()).toEqual([])
    // named apart from anything the shared library may hold
    const own = (reply.patch!.artifacts[0] as { rule: { id: string } }).rule.id
    expect(own).toMatch(/^patch\/save-[0-9a-f]+\/sickle-care$/)
    expect(port.submit(body.request.id, reply.patch!).ok).toBe(true)
    expect(eng.lib.rules.get(own)?.source?.local).toEqual({ types: [], statuses: [] })
    expect(eng.world.fx.some(f => f.t === 'log' && String(f.text).includes('wooden edge'))).toBe(true)
    expect(library.commit(reply.patch!, body.request).ok).toBe(false)
    // Reuse through the service must not write a covered episode containing private data either.
    body.workspace.patches.rules = eng.lib.patches()
    const again = await modder.resolve(body)
    expect(again.outcome, JSON.stringify(again)).toBe('covered')
    expect(again.patch?.scope).toBe('save')
    expect(state.episodes()).toEqual([])
    expect(library.seq).toBe(0)
    draft = { artifacts: [{ kind: 'rule', rule: {
      id: 'patch/sickle-care-revised', host: { type: invention.id }, on: 'act/use',
      tree: { do: [{ op: 'log', text: 'The inspected edge remains sound.' }] },
    } }] }
    const revised = await modder.resolve({ ...body, request: { ...body.request, again: { rule: own, said: 'The wooden edge is still sound.', times: 3 } } })
    expect(revised.outcome, JSON.stringify(revised)).toBe('accepted')
    expect(revised.patch?.scope).toBe('save')
    expect(library.seq).toBe(0)
    expect(state.episodes()).toEqual([])
  })
  it('keeps a canonical receiver answer private when the instrument is a researched form', async () => {
    const { body } = asking('road')
    expect(body.request.event.host?.type).toBe('tile/path')
    const model = new ScriptedModel(() => ({ artifacts: [{ kind: 'rule', rule: {
      id: 'patch/private-road-scrape', host: { type: 'tile/path' }, on: 'impulse/strike',
      tree: { do: [{ op: 'log', text: 'The wooden sickle brushes the hard road.' }] },
    } }] }))
    const { modder, library } = testModder({ model, harness: h => ({ ...quiet(h), ...noAudit(h) }) })
    const reply = await modder.resolve(body)
    expect(reply.outcome, reply.diagnostics?.join()).toBe('accepted')
    expect(reply.patch?.scope).toBe('save')
    expect(library.seq).toBe(0)
  })

  it.each([false, true])('keeps follow-ups to a private status on an ordinary item private (source retired: %s)', async (retired) => {
    const { eng, port, body } = asking()
    expect(port.submit(body.request.id, { scope: 'save', artifacts: [
      { kind: 'status', status: { id: 'private_reed_care', name: { en: 'Reed Care', zh: '苇绳养护' } } },
      { kind: 'rule', rule: { id: 'patch/private-status-source', host: { type: invention.id }, on: 'act/use', tree: { do: [{ op: 'log', text: 'The edge is sound.' }] } } },
    ] }).errors).toEqual([])
    const next = buildSandbox({ entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'held', type: 'item/material/stone', heldBy: 'actor', x: 2, y: 2, statuses: ['private_reed_care'] },
    ], event: {} }, onto, eng.lib)
    const nextPort = new ModPort(next)
    next.act('use', 'actor', { e: 'actor' })
    const request = nextPort.records[0].request
    if (retired) next.lib.remove('patch/private-status-source')
    const model = new ScriptedModel(() => ({ artifacts: [{ kind: 'rule', rule: {
      id: 'patch/private-status-follow-up', host: { type: 'item/material/stone' }, on: 'act/use',
      tree: { if: { is: { role: 'host', sel: { status: ['private_reed_care'] } } }, then: { do: [{ op: 'log', text: 'The cared-for stone is smooth.' }] }, else: { undefined: true } },
    } }] }))
    const { modder, library, state } = testModder({ model, harness: h => ({ ...quiet(h), ...noAudit(h) }) })
    const reply = await modder.resolve({ request, workspace: { patches: { rules: next.lib.patches(), types: next.lib.types, statuses: next.lib.statuses, ...(retired && { local: { types: [], statuses: ['private_reed_care'] } }) } } })
    expect(reply.outcome, JSON.stringify(reply)).toBe('accepted')
    expect(reply.patch?.scope).toBe('save')
    expect(nextPort.submit(request.id, reply.patch!).errors).toEqual([])
    expect(library.seq).toBe(0)
    expect(state.episodes()).toEqual([])
  })

  it('the shared library never takes a name only one save may hold, so the two never meet', () => {
    const { library } = testModder()
    const rule = { id: 'patch/save-0123abcd/sickle-care', host: { type: 'item/tool/sickle' }, on: 'act/use', tree: { do: [{ op: 'log', text: 'x' }] } }
    expect(library.validate({ artifacts: [{ kind: 'rule', rule }] } as Patch).errors.join()).toMatch(/only one save may hold/)
    expect(library.validate({ artifacts: [{ kind: 'type', type: invention }] }).errors.join()).toMatch(/only one save may hold/)
  })

  it('an answer for one save makes no kinds or statuses of its own (their names could meet the shared library\'s)', async () => {
    const { body } = asking()
    const model = new ScriptedModel(() => ({ artifacts: [
      { kind: 'status', status: { id: 'honed', name: { en: 'Honed', zh: '磨利' } } },
      { kind: 'rule', rule: { id: 'patch/sickle-hone', host: { type: invention.id }, on: 'act/use', tree: { do: [{ op: 'addStatus', status: 'honed', duration: 10 }] } } },
    ] }))
    const { modder, library } = testModder({ model, harness: h => ({ ...quiet(h), ...noAudit(h) }) })
    const reply = await modder.resolve(body)
    expect(reply.patch).toBeNull()
    expect(reply.diagnostics?.join()).toMatch(/may not make new kinds or statuses/)
    expect(library.seq).toBe(0)
  })

  it('rejects invalid private definitions before calling the model and leaves shared state untouched', async () => {
    const { body } = asking()
    body.workspace.patches.types[0] = { ...invention, makeup: [{ type: 'item/material/missing_private_input', count: 1 }] }
    let calls = 0
    const model = new ScriptedModel(() => { calls++; return {} })
    const { modder, library } = testModder({ model })
    const reply = await modder.resolve(body)
    expect(reply.outcome).toBe('failed')
    expect(reply.patch).toBeNull()
    expect(calls).toBe(0)
    expect(library.seq).toBe(0)
    expect(library.lib.types).toEqual([])
  })

})
