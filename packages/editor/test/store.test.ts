// The project open in the editor (src/app/store.ts): edits in memory, unsaved until saved, a stroke undone at
// once, and the compiler's view of the project as it is now.

import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RawChunk } from '@openworld/engine'
import { compile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { Store } from '../src/app/store.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))

describe.skipIf(!existsSync(STARTER))('the editor\'s store', () => {
  const fresh = () => new Store('starter', readProject(STARTER))

  it('keeps an edit unsaved, and the compiled project shows it', () => {
    const s = fresh()
    expect(s.unsaved()).toBe(0)
    s.change<RawChunk>('maps/glade.json', 'paint', (c) => (c.map.rows[2] = 'T~' + c.map.rows[2].slice(2)))
    expect(s.unsaved()).toBe(1)
    expect(s.compiled().chunks.find((c) => c.map.id === 'glade')?.map.rows[2].startsWith('T~')).toBe(true)
  })

  it('undoes a stroke, however many cells it painted, at once; and a change that changes nothing is no edit', () => {
    const s = fresh()
    const before = JSON.stringify(s.get('maps/glade.json'))
    for (let x = 1; x < 6; x++) s.change<RawChunk>('maps/glade.json', 'paint', (c) => (c.map.rows[2] = c.map.rows[2].slice(0, x) + '~' + c.map.rows[2].slice(x + 1)), 7)
    s.change<RawChunk>('maps/glade.json', 'nothing', () => {})
    expect(s.undo()).toBe('paint')
    expect(JSON.stringify(s.get('maps/glade.json'))).toBe(before)
    expect(s.undo()).toBeUndefined()
  })

  it('makes an undone edit again, until another edit; a stroke again at once; an added or removed file too', () => {
    const s = fresh()
    const before = JSON.stringify(s.get('maps/glade.json'))
    for (let x = 1; x < 4; x++) s.change<RawChunk>('maps/glade.json', 'paint', (c) => (c.map.rows[2] = c.map.rows[2].slice(0, x) + '~' + c.map.rows[2].slice(x + 1)), 3)
    const after = JSON.stringify(s.get('maps/glade.json'))
    expect(s.redo()).toBeUndefined()
    s.undo()
    expect(s.next()).toEqual({ redo: 'paint' })
    expect(s.redo()).toBe('paint')
    expect(JSON.stringify(s.get('maps/glade.json'))).toBe(after)
    s.undo()
    expect(JSON.stringify(s.get('maps/glade.json'))).toBe(before)
    // another edit: what was undone is not made again
    s.change<RawChunk>('maps/glade.json', 'other', (c) => (c.map.name = 'X'))
    expect(s.redo()).toBeUndefined()
    s.add('people/npc.ada.json', { id: 'npc.ada', type: 'actor/person', place: { on: 'none' } }, 'a person')
    s.undo()
    expect(s.get('people/npc.ada.json')).toBeUndefined()
    s.redo()
    expect(s.get('people/npc.ada.json')).toBeDefined()
    s.remove('people/mira.json', 'remove Mira')
    s.undo()
    s.redo()
    expect(s.get('people/mira.json')).toBeUndefined()
    expect(s.unsaved()).toBe(3)
  })

  it('adds and removes files, and undoes either', () => {
    const s = fresh()
    s.add('people/npc.ada.json', { id: 'npc.ada', type: 'actor/person', place: { on: 'none' } }, 'a person')
    expect(s.list('people').map((p) => p.file)).toContain('people/npc.ada.json')
    s.remove('people/mira.json', 'remove Mira')
    expect(s.compiled().index.npcs.map((n) => n.id)).toEqual(['npc.ada'])
    s.undo()
    s.undo()
    expect(s.list('people').map((p) => p.file)).toEqual(['people/mira.json'])
  })

  it('after a stroke on a map, compiles that map alone and keeps the rest; the whole once editing rests, and says so', async () => {
    const s = fresh()
    s.rest = 20
    const said: string[] = []
    s.on((why) => said.push(why))
    const first = s.compiled()
    s.change<RawChunk>('maps/glade.json', 'paint', (c) => (c.map.rows[2] = 'T~' + c.map.rows[2].slice(2)))
    const quick = s.compiled()
    // the map as it is now; the bundle and the problems as the last whole compile had them (a new compile, all the same)
    expect(quick).not.toBe(first)
    expect(quick.chunks.find((c) => c.map.id === 'glade')?.map.rows[2].startsWith('T~')).toBe(true)
    expect(quick.bundle).toBe(first.bundle)
    expect(s.compiled()).toBe(quick)
    await new Promise((r) => setTimeout(r, 60))
    expect(said).toContain('compiled')
    const whole = s.compiled()
    expect(whole.bundle).not.toBe(first.bundle)
    expect(whole.chunks.find((c) => c.map.id === 'glade')?.map.rows[2].startsWith('T~')).toBe(true)
    // anything but maps changed: the whole at once
    s.remove('people/mira.json', 'remove Mira')
    expect(s.compiled().index.npcs).toEqual([])
  })

  it('keeps the compiled project while nothing changed (a save changes nothing), and compiles what changed again', async () => {
    const s = fresh()
    s.rest = 20
    const first = s.compiled()
    expect(s.compiled()).toBe(first)
    // saving: the listeners told, the compiled kept (the files are as they were)
    const said: string[] = []
    s.on((why) => said.push(why))
    s.change<RawChunk>('maps/glade.json', 'paint', (c) => (c.map.rows[2] = 'T~' + c.map.rows[2].slice(2)))
    await new Promise((r) => setTimeout(r, 60))
    const whole = s.compiled()
    expect(whole).not.toBe(first)
    ;(globalThis as { fetch?: unknown }).fetch = async () => new Response('{}', { headers: { 'content-type': 'application/json' } })
    await s.save()
    expect(said).toContain('saved')
    expect(s.unsaved()).toBe(0)
    expect(s.compiled()).toBe(whole)
    // the maps compiled whole again are the kept objects where the map is as it was, new where it changed
    expect(whole.chunks.find((c) => c.map.id === 'cottage')).toBe(first.chunks.find((c) => c.map.id === 'cottage'))
    expect(whole.chunks.find((c) => c.map.id === 'glade')).not.toBe(first.chunks.find((c) => c.map.id === 'glade'))
    expect(whole.chunks.find((c) => c.map.id === 'glade')?.map.rows[2].startsWith('T~')).toBe(true)
    // a person changed: the world anew, as a fresh compile has it
    s.change<{ place: { x: number } }>('people/mira.json', 'move', (p) => (p.place.x += 1))
    const moved = s.compiled()
    expect(moved).not.toBe(whole)
    expect(moved.index.npcs[0].place).toMatchObject({ x: (first.index.npcs[0].place as { x: number }).x + 1 })
    expect(moved).toEqual(compile(s.project()))
  })
})
