// The AI drafter (drafter.ts): what the modder is told the game has for a person and a map, where a draft goes, and
// its problems compiled with the project before it is taken in. On the starter: a glade, a cottage joined by a door.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readProject } from '@openworld/format/src/node.ts'
import { Store } from '../src/app/store.ts'
import { useProject } from '../src/app/words.ts'
import { draftRequest, fileOf, mapContext, personContext, problemsWith } from '../src/app/drafts.ts'
import type { Ctx } from '../src/app/context.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const ctxOf = (): Ctx => {
  const store = new Store('starter', readProject(STARTER))
  useProject(store)
  return { store, map: 'glade', sel: {}, onto: () => store.compiled().bundle.ontology } as unknown as Ctx
}

describe('the AI drafter', () => {
  it('tells the modder a person\'s spots on the map and the maps its doors join, the kinds of people, a sample', () => {
    const c = personContext(ctxOf())
    expect(c.anchors).toEqual(expect.arrayContaining(['glade:garden', 'cottage:bed']))
    expect(c.kinds.map((k) => k.id)).toContain('actor/person/villager')
    expect(c.kinds.map((k) => k.id)).not.toContain('actor/person/player')
    expect((c.sample as { id: string }).id).toBe('npc.mira')
    expect(c.taken).toEqual(['npc.mira'])
  })

  it('never offers a person a cell one arrives on: the game\'s start, a portal\'s landing', () => {
    const ctx = ctxOf()
    const { map, x, y } = ctx.store.game.start
    ctx.store.change<{ map: { anchors: Record<string, [number, number]> } }>(ctx.store.mapFile(map)!, 'a spot on the start', (c) => (c.map.anchors.spawn = [x, y]))
    expect(personContext(ctx).anchors).not.toContain(`${map}:spawn`)
    expect(personContext(ctx).anchors).toContain(`${map}:garden`)
    // the cottage's door is where one lands coming in from the glade
    const glade = ctx.store.get<{ map: { portals: { to: string; tx: number; ty: number }[] } }>(ctx.store.mapFile('glade')!)!
    const into = glade.map.portals.find((p) => p.to === 'cottage')!
    ctx.store.change<{ map: { anchors: Record<string, [number, number]> } }>(ctx.store.mapFile('cottage')!, 'a spot at the door', (c) => (c.map.anchors.inside = [into.tx, into.ty]))
    expect(personContext(ctx).anchors).not.toContain('cottage:inside')
  })

  it('tells it a map\'s ground by character, the kinds of things the maps hold, the ids taken', () => {
    const c = mapContext(ctxOf())
    expect(c.chars).toEqual(expect.arrayContaining([expect.objectContaining({ char: '.', terrain: 'grass' })]))
    expect(c.chars.some((x) => x.terrain === 'void')).toBe(false)
    expect(c.things.map((x) => x.id)).toContain('fixture/container/chest')
    expect(c.taken).toEqual(expect.arrayContaining(['glade', 'cottage']))
  })

  it('puts a person and a map where the game keeps them, and says a draft\'s problems before it is taken in', () => {
    const ctx = ctxOf()
    const tova = { id: 'npc.tova', type: 'actor/person/villager', name: 'Tova', place: { on: 'tile', map: 'glade', x: 5, y: 5 }, npc: { role: 'villager', schedule: [{ from: 0, to: 24, at: 'glade:garden', activity: 'weed' }], person: { lines: [{ key: 'default', text: 'Beans.' }] } } }
    expect(fileOf('person', tova)).toBe('people/tova.json')
    expect(fileOf('map', { map: { id: 'clearing' } })).toBe('maps/clearing.json')
    expect(problemsWith(ctx, 'person', 'people/tova.json', tova).filter((p) => p.level === 'error')).toEqual([])
    expect(problemsWith(ctx, 'person', 'people/tova.json', { ...tova, type: 'actor/person/wizard' }).length).toBeGreaterThan(0)
    // nothing was written
    expect(ctx.store.get('people/tova.json')).toBeUndefined()
  })

  it('asks a draft first; a later message in the chat revises the draft held: the first ask kept, the draft sent back without its pictures', () => {
    expect(draftRequest('person', 'a gardener', 'd1')).toEqual({ path: '/draft', body: { kind: 'person', intent: 'a gardener', id: 'd1' } })
    const tova = { id: 'npc.tova', name: 'Tova' }
    expect(draftRequest('person', 'make her old', 'd2', { intent: 'a gardener', data: tova })).toEqual({ path: '/draft', body: { kind: 'person', intent: 'a gardener', previous: tova, feedback: 'make her old', id: 'd2' } })
    const art = { grid: ['k'], palette: { k: '#000' } }
    const patch = { artifacts: [{ kind: 'type' as const, type: { id: 'item/material/frost_ingot', art, sprite: 'art:item/material/frost_ingot' } }] }
    const r = draftRequest('thing', 'make it blue', 'd3', { intent: 'a cold ingot', patch: patch as never })
    expect(r.path).toBe('/create')
    expect(r.body).toMatchObject({ intent: 'a cold ingot', feedback: 'make it blue', id: 'd3' })
    expect(JSON.stringify(r.body.previous)).not.toContain('#000')
    expect(JSON.stringify(r.body.previous)).toContain('item/material/frost_ingot')
  })
})
