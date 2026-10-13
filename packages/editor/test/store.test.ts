// The project open in the editor (src/app/store.ts): edits in memory, unsaved until saved, a stroke undone at
// once, and the compiler's view of the project as it is now.

import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RawChunk } from '@openworld/engine'
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
})
