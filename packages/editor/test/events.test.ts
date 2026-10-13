// OpenWorld's events as the editor makes them (src/app/events.ts, docs/engine-split.md §16 E2): a door and its way
// back, a chest and what it holds, a sign, a merchant, a favour, its own kind; where things are used (usage.ts);
// and a story made of them alone — a villager's favour on the starter, played on the kernel to its end.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, decodeRawChunk, snapshot, type Engine, type Entity, type RawChunk } from '@openworld/engine'
import type { PersonFile, StoryFile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { chest, door, favourQuest, merchant, ownKindId, ownKindRule, person, personId, questId, sign } from '../src/app/events.ts'
import { idsOf } from '../src/app/mapEdit.ts'
import { setEntry } from '../src/app/ontologyFiles.ts'
import { Store } from '../src/app/store.ts'
import { factUses, usesOf } from '../src/app/usage.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const blank = (id: string, w = 10, h = 8): RawChunk => ({ map: { id, name: id, kind: 'wild', width: w, height: h, rows: Array.from({ length: h }, () => '.'.repeat(w)), portals: [] }, entities: [] })
const chars = { '.': 'grass', X: 'wall', D: 'door' }

describe('quick events', () => {
  it('a door leads to a cell of another map, and its way back to the cell before it', () => {
    const a = blank('a')
    const b = blank('b')
    door(a, { x: 3, y: 2 }, { map: 'b', x: 5, y: 5 }, chars, { chunk: b, at: { x: 5, y: 6 } })
    expect(a.map.rows[2][3]).toBe('D')
    expect(a.map.portals).toEqual([{ x: 3, y: 2, to: 'b', tx: 5, ty: 5 }])
    expect(b.map.portals).toEqual([{ x: 5, y: 6, to: 'a', tx: 3, ty: 3 }])
    // laid again: the portal there is replaced, not doubled
    door(a, { x: 3, y: 2 }, { map: 'b', x: 1, y: 1 }, chars)
    expect(a.map.portals).toEqual([{ x: 3, y: 2, to: 'b', tx: 1, ty: 1 }])
  })

  it('a chest holds what it is given; a sign says its words in both languages', () => {
    const a = blank('a')
    const taken = idsOf([a])
    const id = chest(a, 'fixture/container/chest', { x: 1, y: 1 }, [{ type: 'item/material/stone', count: 2 }, { type: 'item/tool/axe', count: 1 }], taken)
    expect(id).toBe('a.chest1')
    expect(a.entities.filter((e) => e.place.on === 'inside' && e.place.holder === id).map((e) => e.type)).toEqual(['item/material/stone', 'item/material/stone', 'item/tool/axe'])
    const s = sign(a, 'fixture/sign', { x: 2, y: 1 }, { en: 'North: the well.', zh: '往北：井。' }, taken)
    expect(a.entities.find((e) => e.id === s)!.props).toEqual({ text: 'North: the well.', text_zh: '往北：井。' })
  })

  it('a merchant carries their stock and a purse of the coin; a favour is a quest of the starter\'s shape', () => {
    const m = merchant({ id: 'npc.ada', name: 'Ada', type: 'actor/person', at: { map: 'a', x: 1, y: 1 }, stock: [{ type: 'item/food/bread', count: 2 }], purse: 3, coin: 'item/misc/coin' })
    expect(m.tags).toEqual(['merchant'])
    expect(m.props).toEqual({ purse: 3, stock: 'item/food/bread*2' })
    expect(m._items!.map((e) => e.type)).toEqual(['item/food/bread', 'item/food/bread', 'item/misc/coin', 'item/misc/coin', 'item/misc/coin'])
    expect(personId('Old Tom', new Set(['npc.old_tom']))).toBe('npc.old_tom2')
    expect(questId('Three Stones', new Set())).toBe('three_stones')
    const q = favourQuest({ id: 'q', title: 'Q', giver: 'npc.ada', favour: { kind: 'talk', to: 'npc.mira', toName: 'Mira' }, ask: 'Tell Mira.', thanks: 'Thank you.', reward: { xp: 5 } })
    expect(q.aliases).toMatchObject({ giver: { id: 'npc.ada' }, other: { id: 'npc.mira' } })
    expect(q.stages.at(-1)).toMatchObject({ n: 100, on: { talk: 'other' }, complete: true, by: 'other' })
  })

  it('its own kind: a child type, free; a first rule for it on the hand', () => {
    const e: Entity = { id: 'glade.sign', type: 'fixture/sign', name: 'Old Sign', place: { on: 'none' } }
    expect(ownKindId(e, { 'fixture/sign': {} })).toBe('fixture/sign/old_sign')
    expect(ownKindId(e, { 'fixture/sign/old_sign': {} })).toBe('fixture/sign/old_sign_2')
    expect(ownKindRule('fixture/sign/old_sign', 'Old Sign')).toMatchObject({ host: { type: 'fixture/sign/old_sign' }, on: 'impulse/handle' })
  })
})

describe.skipIf(!existsSync(STARTER))('on the starter', () => {
  const fresh = () => new Store('starter', readProject(STARTER))

  it('finds where each fact is set and read, and every place an id is named', () => {
    const s = fresh()
    const files = () => [...s.list('story'), ...s.list('quests'), ...s.list('people'), ...s.maps(), ...s.list('rules')]
    s.change<StoryFile>('story/story.json', 'a step', (f) => f.steps!.push({ id: 'later', when: { map: 'glade', facts: { 'glade.arrived': 1 } }, facts: { 'glade.later': true } }))
    const facts = factUses(files())
    expect(facts.get('glade.arrived')?.map((u) => u.how).sort()).toEqual(['read', 'set'])
    expect(facts.get('glade.arrived')?.find((u) => u.how === 'set')).toMatchObject({ file: 'story/story.json', at: 'arrive' })
    expect(facts.get('glade.later')?.[0]).toMatchObject({ how: 'set', at: 'later' })
    const mira = usesOf(files(), 'npc.mira')
    expect(mira.map((u) => u.file)).toEqual(expect.arrayContaining(['quests/firewood.json', 'people/mira.json']))
    const axe = usesOf(files(), 'item/tool', true)
    expect(axe.some((u) => u.file === 'maps/glade.json' && u.at === 'glade.axe')).toBe(true)
  })

  it('a batch is undone and made again as one', () => {
    const s = fresh()
    s.batch('a quest giver', () => {
      s.add('people/npc.tom.json', person({ id: 'npc.tom', name: 'Tom', type: 'actor/person/villager', at: { map: 'glade', x: 5, y: 5 } }), 'a person')
      s.change<RawChunk>('maps/glade.json', 'a chest', (c) => chest(c, 'fixture/container/chest', { x: 4, y: 4 }, [], idsOf([c])))
    })
    expect(s.next().undo).toBe('a quest giver')
    s.undo()
    expect(s.get('people/npc.tom.json')).toBeUndefined()
    expect(s.get<RawChunk>('maps/glade.json')!.entities.some((e) => e.id === 'glade.chest1')).toBe(false)
    s.redo()
    expect(s.get('people/npc.tom.json')).toBeDefined()
    expect(s.get<RawChunk>('maps/glade.json')!.entities.some((e) => e.id === 'glade.chest1')).toBe(true)
  })

  it('a story made of quick events alone plays to its end: a villager asks for two stones, they are brought, she rewards', () => {
    const s = fresh()
    const taken = idsOf(s.maps().map((m) => m.data), s.list<PersonFile>('people').map((p) => p.data.id))
    const id = personId('Tess', taken)
    s.batch('a quest giver', () => {
      s.add(`people/${id}.json`, person({ id, name: { en: 'Tess', zh: '苔丝' }, type: 'actor/person/villager', at: { map: 'glade', x: 12, y: 9 }, line: 'Lovely day.' }), 'a person')
      s.add('quests/stones.json', favourQuest({ id: 'stones', title: 'Two Stones', giver: id, favour: { kind: 'bring', what: 'item/material/stone', count: 2 }, ask: 'Could you bring me two stones?', thanks: 'Just what I needed.', reward: { xp: 15, items: [{ type: 'item/tool/axe', count: 1 }] } }), 'a favour')
    })
    // its own kind for the sign, and the sign's words
    s.change<RawChunk>('maps/glade.json', 'its own kind', (c) => { const e = c.entities.find((x) => x.id === 'glade.sign')!; const t = ownKindId(e, s.compiled().bundle.ontology.types); setEntry(s, 'types', { id: t, name: 'the old sign' } as never, 'a kind'); e.type = t })
    const c = s.compiled()
    expect(c.problems.filter((p) => p.level === 'error')).toEqual([])
    expect(c.bundle.ontology.types['fixture/sign/sign']).toBeDefined()
    // played: Tess spoken to, the stones carried, back to her
    const game = Game.create(c.index, structuredClone(c.bundle.ontology), new RuleLibrary(c.bundle.rules))
    for (const ch of c.chunks) game.loadChunk(decodeRawChunk(structuredClone(ch), c.bundle.terrainChars))
    const eng: Engine = game.engine
    const w = eng.world
    for (let i = 0; i < 200 && (w.scene || w.fact('glade.arrived') !== 1); i++) (eng.tick(), w.scene?.waiting === 'advance' && eng.story.advance())
    const p = w.player
    const talk = () => { const at = w.posOf(w.get(id)!)!; eng.author(() => eng.teleport(p, { map: at.map, x: at.x, y: at.y + 1 })); eng.act('hands', p.id, { e: id }); eng.tick() }
    const journal = () => snapshot(eng).quests.journal.find((q) => q.quest === 'stones')
    talk()
    expect(journal()?.state).toBe('active')
    eng.author(() => { for (let i = 0; i < 2; i++) w.create('item/material/stone', { on: 'inside', holder: p.id }) })
    eng.tick()
    talk()
    expect(journal()?.state).toBe('done')
    expect(eng.controls.count('item/material/stone')).toBe(0)
    expect(eng.controls.count('item/tool/axe')).toBeGreaterThan(0)
  })
})
