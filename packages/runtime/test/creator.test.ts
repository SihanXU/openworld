import { describe, expect, it, vi } from 'vitest'
import {
  Game, RuleLibrary, creationMaps, decodeRawChunk, restoreWorkshopPackages, workshopPackages,
  type Ontology, type RawChunk, type ResearchPlan, type ResearchReply, type WorldIndex,
} from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { CreationWorkshop } from '../src/workshop.ts'
import { admitCreatorJob, adoptCreatorDrafts, creatorDiscussionOrder, retainedCreatorOrder, type CreatorReferences } from '../src/creator.ts'
import type { CreatorDraft } from '../src/modderProtocol.ts'
import type { ModderLink } from '../src/modderLink.ts'
import type { FromWorker } from '../src/protocol.ts'

const copy = <T,>(value: T): T => structuredClone(value)
const L = (en: string, zh: string) => ({ en, zh })
it('hands the original idea, NPC suggestions and player choices to the coding job without summarizing them away', () => {
  const history = [{ player: '做一个花园', npc: L('Decorative, or a place to grow sunflowers?', '观赏，还是可以种向日葵？') }]
  const order = creatorDiscussionOrder('按你说的，要播种浇水收获花和种子', history)
  expect(order).toContain(JSON.stringify({ history, player: '按你说的，要播种浇水收获花和种子' }))
  expect(creatorDiscussionOrder('给现有剑追加融合用途', [])).toBe('给现有剑追加融合用途')
})
it('does not reuse an older garden job when a new discussion ends with the same confirmation', () => {
  const old = { id: 'old_garden', order: '好', kind: 'map' as const, status: 'ready' as const }
  const history = [{ player: '这次要可以种植的向日葵花园', npc: L('With sunflower seeds?', '带向日葵种子吗？') }]
  expect(retainedCreatorOrder([old], '好', 'map', undefined, history)).toBeUndefined()
  expect(retainedCreatorOrder([old], '好', 'map', undefined, [])).toBe(old)
})
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

function candidate(t: ReturnType<typeof fixture>, cost = 2): CreatorDraft {
  t.workshop.reset()
  const reply = proposal()
  if (reply.design?.kind !== 'new' || !reply.design.type) throw new Error('Missing test design')
  reply.design.type.makeup = [{ type: GOODS, count: cost }]
  t.workshop.proposal(t.game(), reply)
  return { kind: 'item', title: reply.design.name, item: copy(t.workshop.active!.item!) }
}

describe('autonomous candidates rebase through native live admission', () => {
  it('adopts the draft against live resources while retaining live state and the native save lifecycle', () => {
    const source = fixture(), target = fixture(), draft = candidate(source)
    target.game().engine.author(() => target.game().engine.world.setFact('test.live', 'newer-than-candidate'))
    const result = adoptCreatorDrafts(target.game(), target.workshop, { first: draft }, [], CHARS)
    expect(result).toEqual([{ id: draft.item!.id, revision: draft.item!.revision, kind: 'item' }])
    expect(target.game().engine.world.fact('test.live')).toBe('newer-than-candidate')
    expect(Object.values(target.game().engine.world.state.entities).filter(e => e.type === GOODS)).toHaveLength(4)
    expect(workshopPackages(target.game().engine)).toHaveLength(1)
    const restored = Game.load(target.game().save(), target.index, target.onto, new RuleLibrary(copy(STDLIB_RULES)))
    expect(restoreWorkshopPackages(restored.engine)).toEqual([])
    expect(workshopPackages(restored.engine)[0].id).toBe(draft.item!.id)
  })

  it('rejects a candidate after current materials changed, without mutating the live world', () => {
    const source = fixture(), target = fixture(), draft = candidate(source, 7), before = snapshot(target.game())
    expect(() => adoptCreatorDrafts(target.game(), target.workshop, { first: draft }, [], CHARS)).toThrow(/current world refused/)
    expect(snapshot(target.game())).toEqual(before)
    expect(target.changed).not.toHaveBeenCalled()
  })

  it('preflights the whole sequence so a later refusal cannot leave an earlier item installed', () => {
    const source = fixture(), target = fixture(), first = candidate(source, 2), later = candidate(source, 5), before = snapshot(target.game())
    expect(() => adoptCreatorDrafts(target.game(), target.workshop, { first, later }, [], CHARS)).toThrow(/current world refused/)
    expect(snapshot(target.game())).toEqual(before)
    expect(target.changed).not.toHaveBeenCalled()
  })

  it('retries the same published job after spending materials, source reload and save reload', () => {
    const source = fixture(), target = fixture(), draft = candidate(source, 6)
    const game = target.game(), eng = game.engine, state = eng.world.state as typeof eng.world.state & CreatorReferences
    eng.author(() => {
      state.creatorJobs = [{ id: 'same-job', order: 'Make a bead', status: 'ready', kind: 'item', requiresReload: true }]
      const seed = Object.values(state.entities).find(e => e.type === GOODS)!
      eng.world.place(seed, { on: 'tile', map: 'home', x: 1, y: 1 })
    })
    const denied = admitCreatorJob(game, state.creatorJobs![0], true, () =>
      adoptCreatorDrafts(game, target.workshop, { first: draft }, [], CHARS))
    expect(denied).toMatchObject({ ok: false, reason: expect.stringMatching(/current world refused/) })
    expect(workshopPackages(eng)).toHaveLength(0)
    expect(target.changed).not.toHaveBeenCalled()
    const restored = Game.load(game.save(), target.index, target.onto, new RuleLibrary(copy(STDLIB_RULES)))
    const restoredState = restored.engine.world.state as typeof restored.engine.world.state & CreatorReferences
    const ref = restoredState.creatorJobs![0]
    expect(ref).toMatchObject({ id: 'same-job', status: 'ready', sourceLoaded: true, admissionError: expect.any(String) })
    expect(ref.requiresReload).toBeUndefined()
    restored.engine.author(() => {
      const seed = Object.values(restoredState.entities).find(e => e.type === GOODS && e.place.on === 'tile')!
      restored.engine.world.place(seed, { on: 'inside', holder: 'player' })
    })
    const workshop = new CreationWorkshop({ current: () => restored, link: () => undefined, chars: () => CHARS, recipes: () => [], post: () => {}, changed: () => {}, kept: () => {} })
    const admitted = admitCreatorJob(restored, ref, false, () =>
      adoptCreatorDrafts(restored, workshop, { first: draft }, [], CHARS))
    expect(admitted.ok).toBe(true)
    expect(ref).toMatchObject({ id: 'same-job', applied: true, sourceLoaded: true })
    expect(ref.admissionError).toBeUndefined()
    expect(workshopPackages(restored.engine)).toHaveLength(1)
    expect(Object.values(restoredState.entities).filter(e => e.type === GOODS)).toHaveLength(0)
  })

  it('adopts connected map content through the same bundle admission', () => {
    const target = fixture(), map: CreatorDraft = { kind: 'map', title: L('A garden', '花园'), map: { id: 'creator_garden', revision: 1, raw: region() } }
    adoptCreatorDrafts(target.game(), target.workshop, { garden: map }, [], CHARS)
    const installed = creationMaps(target.game().engine)[0]
    expect(installed.enabled).toBe(true)
    expect(target.game().engine.world.posOf(target.game().engine.world.player)?.map).toBe(installed.raw.map.id)
    expect(target.game().engine.world.state.maps.home.portals).toHaveLength(1)
  })
})
