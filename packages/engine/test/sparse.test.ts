import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, decodeRawChunk, type Entity, type Ontology, type RawChunk, type WorldIndex } from '../src/index.ts'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'

// A save kept as what differs from its map's file (sparse.ts), loaded onto a newer revision of that file which puts
// things the save already knows into a fixture the save has never seen. The authored link must not hold a thing the
// player had taken, moved or destroyed: where the save left it wins, and the new fixture holds only the rest.

const CHAR = { '.': 'grass' }
const copy = <T>(v: T): T => structuredClone(v)
const ontology = (): Ontology => ({
  ...copy(STDLIB_ONTOLOGY as Ontology),
  terrains: { ...copy(STDLIB_ONTOLOGY.terrains!), grass: { id: 'grass', name: 'Grass', tags: ['ground'], color: '#74835a' } },
})
const library = () => new RuleLibrary(copy(STDLIB_RULES))
const field = (id: string) => ({ id, name: id, kind: 'wild', width: 6, height: 4, rows: Array(4).fill('......'), portals: [] })
const item = (id: string, x: number): Entity => ({ id, type: 'item/misc', place: { on: 'tile', map: 'room', x, y: 1 } })

const ITEMS = ['taken', 'moved', 'broken', 'kept']
/** The file the save was made on: four loose things in a row. */
const ROOM: RawChunk = { map: field('room'), entities: ITEMS.map((id, i) => item(id, i + 1)) }
/** Its next revision: a chest added, and the same four things put in it. */
const REVISED: RawChunk = {
  map: field('room'),
  entities: [
    { id: 'chest', type: 'fixture/container', place: { on: 'tile', map: 'room', x: 2, y: 2 } },
    ...ITEMS.map((id): Entity => ({ id, type: 'item/misc', place: { on: 'inside', holder: 'chest' } })),
  ],
}
const YARD: RawChunk = { map: field('yard'), entities: [] }
const index: WorldIndex = {
  name: 'A revised map under a save', version: 'sparse-tests-v1', seed: 3,
  start: { map: 'room', x: 1, y: 2 },
  maps: [field('room'), field('yard')].map(({ rows: _, ...m }) => ({ ...m, npcs: 0, items: 0 })),
  npcs: [], player: { id: 'player', type: 'actor/person/player', place: { on: 'none' } },
  stats: { maps: 2, npcs: 0, creatures: 0, items: 4, itemKinds: 1, fixtures: 0 },
}

/**
 * A game on the first file: one thing taken into the hand, one destroyed, (on the player's map) one moved, the rest
 * left alone; saved with the room as the player's map (lean) or put away (the player in the yard); loaded on the
 * revision. (A thing moved on a map put away is not covered: the save keeps it as a patch against the first file's
 * place, which the revision's place under it does not answer.)
 */
function resume(room: 'lean' | 'away') {
  const onto = ontology()
  const game = Game.create(index, onto, library())
  game.loadChunk(decodeRawChunk(copy(ROOM), CHAR))
  game.loadChunk(decodeRawChunk(copy(YARD), CHAR))
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    eng.teleport(w.player, { map: 'room', x: 1, y: 2 })
    w.place(w.get('taken')!, { on: 'hand', holder: w.player.id })
    if (room === 'lean') w.place(w.get('moved')!, { on: 'tile', map: 'room', x: 5, y: 3 })
    w.destroy(w.get('broken')!)
    if (room === 'away') eng.teleport(w.player, { map: 'yard', x: 1, y: 1 })
  })
  const save = copy(game.save())
  expect(save.state.chunks?.room?.[room]).toBe(true)
  const loaded = Game.load(save, index, onto, library())
  for (const c of room === 'away' ? [YARD, REVISED] : [REVISED, YARD]) loaded.loadChunk(decodeRawChunk(copy(c), CHAR))
  return loaded.engine.world
}

describe('a save loaded onto a revised map file that puts its things in a new fixture (sparse.ts)', () => {
  it('keeps what the player took, moved or destroyed where the save left it, on the player\'s own map', () => {
    const w = resume('lean')
    expect(w.get('chest')?.contents).toEqual(['kept'])
    expect(w.get('kept')?.place).toEqual({ on: 'inside', holder: 'chest' })
    expect(w.get('taken')?.place).toEqual({ on: 'hand', holder: 'player' })
    expect(w.player.held).toBe('taken')
    expect(w.get('moved')?.place).toEqual({ on: 'tile', map: 'room', x: 5, y: 3 })
    expect(w.get('broken')).toBeUndefined()
  })

  it('keeps what the player took or destroyed where the save left it, on a map the save put away', () => {
    const w = resume('away')
    expect(w.get('chest')?.contents).toEqual(['moved', 'kept'])
    for (const id of ['moved', 'kept']) expect(w.get(id)?.place).toEqual({ on: 'inside', holder: 'chest' })
    expect(w.get('taken')?.place).toEqual({ on: 'hand', holder: 'player' })
    expect(w.player.held).toBe('taken')
    expect(w.get('broken')).toBeUndefined()
  })
})
