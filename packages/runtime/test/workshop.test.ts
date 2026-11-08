import { describe, expect, it, vi } from 'vitest'
import {
  Game, RuleLibrary, creationMaps, decodeRawChunk, restoreWorkshopPackages, workshopPackages,
  type Ontology, type RawChunk, type ResearchPlan, type ResearchReply, type WorldIndex,
} from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { CreationWorkshop } from '../src/workshop.ts'
import type { ModderLink } from '../src/modderLink.ts'
import type { FromWorker } from '../src/protocol.ts'
import { sharedPart } from '../src/learned.ts'

const copy = <T,>(value: T): T => structuredClone(value)
const L = (en: string, zh: string) => ({ en, zh })
const GOODS = 'item/material/seed'
const CHARS = { '.': 'grass', '#': 'wall' }
const HOME: RawChunk = { map: { id: 'home', name: 'Workshop', kind: 'workshop', width: 7, height: 7, rows: Array(7).fill('.......'), portals: [] }, entities: [] }
const PLAN: ResearchPlan = { version: 1, uses: [{ id: 'inspect', label: L('Inspect the bead', '查看珠子'), capability: 'inspect', target: 'self' }] }
const proposal = (): ResearchReply => ({
  reply: L('A seed bead to examine.', '做一颗可以查看的种子珠。'), plan: copy(PLAN),
  design: { kind: 'new', name: L('Seed Bead', '种子珠'), idea: 'a small bead made from two seeds', type: {
    id: 'item/misc/seed_bead', name: L('Seed Bead', '种子珠'), props: { value: 2 }, makeup: [{ type: GOODS, count: 2 }], station: 'hands',
  } },
})
const region = (name = 'Seed garden'): RawChunk => ({
  map: { id: 'model_region', name, kind: 'wild', width: 7, height: 7, rows: ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'], portals: [] },
  entities: [{ id: 'model_seed', type: GOODS, place: { on: 'tile', map: 'model_region', x: 2, y: 2 } }],
})

function fixture() {
  const onto: Ontology = { ...copy(STDLIB_ONTOLOGY as Ontology), types: {
    ...copy(STDLIB_ONTOLOGY.types!),
    'item/material': { id: 'item/material', name: L('Material', '材料') },
    [GOODS]: { id: GOODS, name: L('Seed', '种子'), props: { value: 2 } },
    'item/misc/token': { id: 'item/misc/token', name: L('Carved Token', '雕刻筹码'), props: { value: 2 } },
  }, terrains: {
    grass: { id: 'grass', name: 'Grass', tags: ['ground'], color: '#74835a' },
    wall: { id: 'wall', name: 'Wall', tags: ['solid'], solid: true, color: '#766955' },
  } }
  const index: WorldIndex = { name: 'Workshop test', version: 'workshop-test-v1', seed: 11, start: { map: 'home', x: 3, y: 3 },
    maps: [{ id: 'home', name: 'Workshop', kind: 'workshop', width: 7, height: 7, portals: [], npcs: 0, items: 0 }],
    npcs: [], player: { id: 'player', type: 'actor/person/player', place: { on: 'none' } },
    stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 2, fixtures: 0 },
  }
  let current = Game.create(index, onto, new RuleLibrary(copy(STDLIB_RULES)))
  current.loadChunk(decodeRawChunk(copy(HOME), CHARS))
  current.engine.author(() => { for (let n = 0; n < 6; n++) current.engine.world.create(GOODS, { on: 'inside', holder: 'player' }) })
  const messages: FromWorker[] = [], changed = vi.fn(), kept = vi.fn()
  const draft = vi.fn<NonNullable<ModderLink['draft']>>(async () => ({ draft: copy(region()) as unknown as Record<string, unknown>, diagnostics: [] }))
  // Only AI proposals are controlled here; every trial, craft, admission and save uses the real engine.
  const link: ModderLink = { where: 'test:', draft, health: async () => ({ model: 'proposal-fixture' }), resolve: async () => ({ outcome: 'unavailable', patch: null }), progress: async () => ({ stage: 'queued' }), patches: async () => ({ seq: 0, entries: [] }), fault: () => undefined }
  const workshop = new CreationWorkshop({ current: () => current, link: () => link, chars: () => CHARS, recipes: () => [], post: message => messages.push(copy(message)), changed, kept })
  const view = () => messages.filter((message): message is Extract<FromWorker, { t: 'workshop' }> => message.t === 'workshop').at(-1)!.view
  const book = () => messages.filter((message): message is Extract<FromWorker, { t: 'workshopSaved' }> => message.t === 'workshopSaved').at(-1)!.views
  return { workshop, messages, changed, kept, draft, view, book, onto, index, game: () => current, current: (game: Game) => { current = game } }
}
function snapshot(game: Game) {
  const eng = game.engine
  return copy({ state: eng.world.state, library: eng.lib.toJSON(), types: eng.world.onto.data.types, statuses: eng.world.onto.data.statuses, recipes: [...eng.recipes], maps: eng.maps, graph: eng.graph })
}
function sharedData(game: Game) {
  const { version: _version, ...data } = sharedPart(game.engine.lib.toJSON(), { types: new Set(), statuses: new Set() })
  return copy(data)
}
function adopt(t: ReturnType<typeof fixture>) {
  t.workshop.proposal(t.game(), proposal())
  const { id, revision } = t.view()
  t.workshop.trial(id, revision)
  expect(t.view().trial?.passed).toBe(true)
  t.workshop.adopt(id, revision)
  return { id, revision, typeId: t.workshop.active!.item!.typeId }
}

describe('the runtime creation workshop coordinates real engine admission', () => {
  it('returns actual failed checks to NPC revisions and clears them when the draft changes', () => {
    const t = fixture(), bad = proposal()
    if (bad.design?.kind !== 'new' || !bad.design.type) throw new Error('Expected the seed-bead fixture')
    bad.design.type.makeup = [{ type: GOODS, count: 60 }]
    t.workshop.proposal(t.game(), bad)
    const {id, revision} = t.view()
    t.workshop.trial(id, revision)
    expect(t.view().trial?.passed).toBe(false)
    expect(t.workshop.context().trialFeedback).toEqual({ revision, errors: t.workshop.active!.itemTrial!.errors })
    t.workshop.proposal(t.game(), proposal())
    expect(t.workshop.context().trialFeedback).toBeUndefined()
    t.workshop.trial(id, t.view().revision)
    expect(t.view().trial?.passed).toBe(true)
    expect(t.workshop.context().trialFeedback).toBeUndefined()
  })
  it('proposes and trials without pollution, then spends exact materials and publishes the adopted book', () => {
    const t = fixture(), eng = t.game().engine, before = snapshot(t.game()), publicBefore = sharedData(t.game())
    t.workshop.proposal(t.game(), proposal())
    const { id, revision } = t.view(), typeId = t.workshop.active!.item!.typeId
    expect(snapshot(t.game())).toEqual(before)
    expect(t.workshop.context()).toEqual({ plan: PLAN })
    expect(t.view().trial).toBeUndefined()
    t.workshop.trial(id, revision)
    expect(t.view().trial?.passed).toBe(true)
    expect(t.view().uses[0].status).toBe('tested')
    expect(snapshot(t.game())).toEqual(before)
    expect(t.changed).not.toHaveBeenCalled()
    t.workshop.adopt(id, revision)
    expect(eng.controls.count(GOODS)).toBe(4)
    expect(eng.controls.count(typeId)).toBe(1)
    expect(workshopPackages(eng)).toHaveLength(1)
    expect(eng.lib.toJSON().version).toBeGreaterThan(before.library.version)
    expect(sharedData(t.game())).toEqual(publicBefore)
    expect(t.kept).toHaveBeenCalledExactlyOnceWith(typeId)
    expect(t.changed).toHaveBeenCalledTimes(1)
    expect(t.book()).toMatchObject([{ id, revision, adopted: true, trial: { revision, passed: true }, uses: [{ status: 'tested' }] }])
    const after = snapshot(t.game())
    expect(() => t.workshop.adopt(id, revision)).toThrow(/already been adopted/)
    expect(snapshot(t.game())).toEqual(after)
  })

  it('invalidates trial evidence when a picture or natural-language revision changes the draft', () => {
    const t = fixture(), before = snapshot(t.game())
    t.workshop.proposal(t.game(), proposal())
    const first = t.view()
    t.workshop.trial(first.id, first.revision)
    expect(t.view().trial?.passed).toBe(true)
    t.workshop.picture(proposal().design!)
    const pictured = t.view()
    expect(pictured.revision).toBe(first.revision + 1)
    expect(pictured.trial).toBeUndefined()
    expect(() => t.workshop.adopt(first.id, first.revision)).toThrow(/changed/)
    expect(() => t.workshop.adopt(pictured.id, pictured.revision)).toThrow(/Try this design/)
    t.workshop.trial(pictured.id, pictured.revision)
    t.workshop.proposal(t.game(), { ...proposal(), reply: L('A revised bead.', '修改后的珠子。') })
    const revised = t.view()
    expect(revised.id).toBe(first.id)
    expect(revised.revision).toBe(pictured.revision + 1)
    expect(revised.trial).toBeUndefined()
    expect(() => t.workshop.adopt(pictured.id, pictured.revision)).toThrow(/changed/)
    expect(() => t.workshop.adopt(revised.id, revised.revision)).toThrow(/Try this design/)
    expect(snapshot(t.game())).toEqual(before)
  })

  it('retains trial history without blocking retirement after the last live item is gone', () => {
    const t = fixture(), { id, typeId } = adopt(t), eng = t.game().engine
    expect(() => t.workshop.disable(id)).toThrow(/still references/)
    eng.author(() => { for (const e of Object.values(eng.world.state.entities)) if (e.type === typeId) eng.world.destroy(e) })
    const state = eng.world.state as typeof eng.world.state & { workshopEvidence?: unknown }
    const receipt = copy(state.workshopEvidence)
    expect(receipt).toBeDefined()
    t.workshop.disable(id)
    expect(workshopPackages(eng).find(p => p.id === id)?.enabled).toBe(false)
    expect(eng.world.onto.data.types[typeId]).toBeUndefined()
    expect(state.workshopEvidence).toEqual(receipt)
  })

  it('extends an adopted subject independently of its original materials and does not craft another copy', () => {
    const t = fixture(), made = adopt(t), eng = t.game().engine, w = eng.world
    eng.author(() => { for (const e of Object.values(w.state.entities)) if (e.type === GOODS) w.destroy(e) })
    t.workshop.open(made.id)
    expect(t.workshop.context()).toEqual({ plan: PLAN, subject: { typeId: made.typeId, name: proposal().design!.name, plan: PLAN } })
    expect(t.workshop.active!.item!.design).toBeUndefined()
    const extended: ResearchPlan = { version: 1, uses: [...PLAN.uses, { id: 'inspect_reverse', label: L('Inspect the reverse', '查看背面'), capability: 'inspect', target: 'self' }] }
    t.workshop.proposal(t.game(), { reply: L('Another detail to inspect.', '还可以查看另一处细节。'), plan: extended })
    const { id, revision } = t.view()
    expect(t.view().kind).toBe('uses')
    expect(t.workshop.context().subject).toMatchObject({ typeId: made.typeId, plan: extended })
    t.workshop.trial(id, revision)
    expect(t.view().trial?.passed).toBe(true)
    t.workshop.adopt(id, revision)
    expect(eng.controls.count(GOODS)).toBe(0)
    expect(eng.controls.count(made.typeId)).toBe(1)
    expect(t.book()).toMatchObject([{ id, revision, kind: 'uses', adopted: true }])
  })

  it('starts a uses-only subject from an ordinary held item without inventing a recipe', () => {
    const t = fixture(), eng = t.game().engine, w = eng.world
    const seed = Object.values(w.state.entities).find(e => e.type === GOODS)!
    eng.author(() => w.place(seed, { on: 'hand', holder: w.player.id }))
    t.workshop.extendHeld()
    expect(t.workshop.context()).toEqual({ plan: { version: 1, uses: [] }, subject: { typeId: GOODS, name: L('Seed', '种子'), plan: { version: 1, uses: [] } } })
    t.workshop.proposal(t.game(), { reply: L('Look at its markings.', '看看它的纹路。'), plan: PLAN })
    const { id, revision } = t.view()
    expect(t.workshop.active!.item!.design).toBeUndefined()
    t.workshop.trial(id, revision)
    expect(t.view().trial?.passed).toBe(true)
    t.workshop.adopt(id, revision)
    expect(eng.controls.count(GOODS)).toBe(6)
    expect(eng.lib.types).toEqual([])
    expect(t.book()).toMatchObject([{ id, kind: 'uses', adopted: true }])
  })

  it('restores the adopted idea book and its actual evidence after a full Game save/load', () => {
    const t = fixture(), made = adopt(t)
    const save = copy(t.game().save({ whole: true }))
    const loaded = Game.load(save, t.index, t.onto)
    loaded.loadChunk(decodeRawChunk(copy(HOME), CHARS))
    expect(restoreWorkshopPackages(loaded.engine)).toEqual([])
    t.current(loaded)
    t.workshop.reset()
    t.workshop.list()
    expect(t.book()).toMatchObject([{ id: made.id, revision: made.revision, adopted: true, trial: { passed: true }, uses: [{ status: 'tested' }] }])
    expect(loaded.engine.controls.count(GOODS)).toBe(4)
    expect(loaded.engine.controls.count(made.typeId)).toBe(1)
    t.workshop.open(made.id)
    expect(t.workshop.context().subject?.typeId).toBe(made.typeId)
    expect(t.view()).toMatchObject({ adopted: true, trial: { passed: true }, uses: [{ status: 'tested' }] })
    // Opening a saved design permits reuse; only a new proposal begins an untested revision.
    t.workshop.proposal(loaded, { reply: L('Keep examining it.', '继续看看。'), plan: PLAN })
    expect(t.view().trial).toBeUndefined()
    expect(t.view().adopted).not.toBe(true)
  })

  it('exports data and imports only a draft until its new destination trial and adoption', () => {
    const source = fixture(), made = adopt(source)
    source.workshop.export(made.id)
    const file = source.messages.find((message): message is Extract<FromWorker, { t: 'workshopExport' }> => message.t === 'workshopExport')!.file
    const target = fixture(), before = snapshot(target.game())
    target.workshop.import(copy(file))
    const imported = target.view()
    expect(imported.adopted).not.toBe(true)
    expect(imported.trial).toBeUndefined()
    expect(snapshot(target.game())).toEqual(before)
    expect(() => target.workshop.adopt(imported.id, imported.revision)).toThrow(/Try this design/)
    target.workshop.trial(imported.id, imported.revision)
    expect(target.view().trial?.passed).toBe(true)
    expect(snapshot(target.game())).toEqual(before)
    target.workshop.adopt(imported.id, imported.revision)
    expect(target.game().engine.controls.count(GOODS)).toBe(4)
    expect(target.game().engine.controls.count(target.workshop.active!.item!.typeId)).toBe(1)
  })

  it('keeps the final asynchronous icon through adoption, Game save/load and exported draft import', () => {
    const source = fixture(), reply = proposal()
    source.workshop.proposal(source.game(), reply)
    const art = { grid: Array.from({ length: 16 }, (_, y) => y >= 4 && y <= 11 ? '....kkkkkkkk....' : '................'), palette: { k: '#557755' } }
    if (reply.design?.kind !== 'new' || !reply.design.type) throw new Error('Expected new item fixture')
    source.workshop.picture({ ...reply.design, type: { ...reply.design.type, art } })
    const draft = source.view()
    expect(draft.picture).toEqual(art)
    source.workshop.trial(draft.id, draft.revision)
    expect(source.view().trial?.passed).toBe(true)
    source.workshop.adopt(draft.id, draft.revision)
    const loaded = Game.load(copy(source.game().save({ whole: true })), source.index, source.onto)
    loaded.loadChunk(decodeRawChunk(copy(HOME), CHARS))
    expect(restoreWorkshopPackages(loaded.engine)).toEqual([])
    source.current(loaded)
    source.workshop.reset()
    source.workshop.open(draft.id)
    expect(source.view().picture).toEqual(art)
    source.workshop.export(draft.id)
    const file = source.messages.filter((m): m is Extract<FromWorker, { t: 'workshopExport' }> => m.t === 'workshopExport').at(-1)!.file
    expect(file).toMatchObject({ typeDefinition: { art } })
    const target = fixture(), before = snapshot(target.game())
    target.workshop.import(copy(file))
    expect(target.view().picture).toEqual(art)
    expect(snapshot(target.game())).toEqual(before)
    expect(target.view().adopted).not.toBe(true)
  })

  it('keeps only the newest region in the book and leaves a refused disable candidate visible', async () => {
    const t = fixture(), before = snapshot(t.game())
    await t.workshop.map('A small seed garden.')
    let current = t.view()
    expect(t.draft).toHaveBeenCalledTimes(1)
    expect(snapshot(t.game())).toEqual(before)
    t.workshop.trial(current.id, current.revision)
    expect(t.view().trial?.passed).toBe(true)
    expect(snapshot(t.game())).toEqual(before)
    t.workshop.adopt(current.id, current.revision)
    expect(t.game().engine.activeMap).toBe(creationMaps(t.game().engine).at(-1)!.raw.map.id)
    t.draft.mockResolvedValueOnce({ draft: copy(region('Revised garden')) as unknown as Record<string, unknown>, diagnostics: [] })
    await t.workshop.map('Give it another name.')
    current = t.view()
    t.workshop.trial(current.id, current.revision)
    expect(t.view().trial?.passed).toBe(true)
    t.workshop.adopt(current.id, current.revision)
    expect(t.book()).toMatchObject([{ id: current.id, revision: current.revision, kind: 'map', adopted: true }])
    expect(t.book()).toHaveLength(1)
    const after = snapshot(t.game()), changes = t.changed.mock.calls.length
    expect(() => t.workshop.disable(current.id)).toThrow(/Return from this region/)
    expect(snapshot(t.game())).toEqual(after)
    expect(t.changed).toHaveBeenCalledTimes(changes)
    t.workshop.list()
    expect(t.book()).toMatchObject([{ id: current.id, revision: current.revision, adopted: true }])
  })

  it('imports an exported region into a different save as an unadopted draft', async () => {
    const source = fixture(), target = fixture()
    await source.workshop.map('A seed garden.')
    const current = source.view()
    source.workshop.trial(current.id, current.revision)
    source.workshop.adopt(current.id, current.revision)
    source.workshop.export(current.id)
    const exported = source.messages.find(m => m.t === 'workshopExport')
    expect(exported?.t).toBe('workshopExport')
    if (exported?.t !== 'workshopExport') throw new Error('Missing export')
    const sourceBefore = snapshot(source.game()), targetBefore = snapshot(target.game())
    target.workshop.import(copy(exported.file))
    const imported = target.view()
    expect(imported.id).not.toBe(current.id)
    expect(imported.trial).toBeUndefined()
    expect(snapshot(target.game())).toEqual(targetBefore)
    expect(() => target.workshop.adopt(imported.id, imported.revision)).toThrow(/Try this region/)
    target.workshop.trial(imported.id, imported.revision)
    expect(target.view().trial?.passed).toBe(true)
    expect(snapshot(target.game())).toEqual(targetBefore)
    target.workshop.adopt(imported.id, imported.revision)
    const region = creationMaps(target.game().engine)[0]
    expect(region.raw.map.id).not.toBe(creationMaps(source.game().engine)[0].raw.map.id)
    expect(region.raw.map.portals[0].to).toBe('home')
    expect(target.game().engine.activeMap).toBe(region.raw.map.id)
    expect(snapshot(source.game())).toEqual(sourceBefore)
  })

  it('keeps gatherable materials in map context when many fixture kinds exist', async () => {
    const t = fixture(), types = t.game().engine.world.onto.data.types
    for (let i = 0; i < 80; i++) types[`fixture/nature/tree_${i}`] = { id: `fixture/nature/tree_${i}`, name: `Tree ${i}` }
    await t.workshop.map('A seed garden with trees and a place to gather.')
    const things = t.draft.mock.calls[0]?.[0].context?.things ?? []
    expect(things.some((thing: { id: string }) => thing.id === GOODS)).toBe(true)
    expect(things.filter((thing: { id: string }) => thing.id.startsWith('fixture/nature/')).length).toBeLessThanOrEqual(10)
    expect(things.some((thing: { id: string }) => thing.id === 'item/material')).toBe(false)
  })
})
