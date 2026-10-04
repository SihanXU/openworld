import { describe, expect, it } from 'vitest'
import { CELL_SPACES, Game, RuleLibrary, TICKS_PER_HOUR, cellId, parseCellId, type Space } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

// A cell is made of things (world-model.md §4.6, §5.2): its floor, what roots in its soil, what
// fills its volume, each with an id derived from its place. They live in the map's data until one
// changes, then the state keeps it under the same id. These tests hold the checks of §10.2 that
// this makes: one reference form, exclusivity, and a save of only what changed.

function ford() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  return { game, index, chunks, eng: game.engine, w: game.engine.world }
}

describe('cells are things (world-model.md §4.6)', () => {
  it('one reference form: a cell thing has one id, the same before and after it changes', () => {
    const { eng, w } = ford()
    // a tree on the Ford: what fills its cell
    const map = w.map('ford')!
    const i = map.terrain.findIndex((t) => t === 'tree')
    const [x, y] = [i % map.width, Math.floor(i / map.width)]
    const ref = w.cellRef('ford', x, y)
    expect(ref.e).toBe(cellId('ford', x, y, 'volume'))
    const before = w.get(ref.e)!
    expect(before.type).toBe('tile/tree')
    expect(w.isStatic(before)).toBe(true)
    // it changes: the state keeps it, under the same id
    eng.author(() => w.setStatus(ref, 'notched', -1))
    const after = w.get(ref.e)!
    expect(after).toBe(before)
    expect(w.isStatic(after)).toBe(false)
    expect(w.state.entities[ref.e]).toBe(after)
    expect(w.entitiesAt('ford', x, y).filter((e) => e.id === ref.e)).toHaveLength(1)
    // under it, the ground its neighbours show; the floor's id is its own
    const floor = w.occupant('ford', x, y, 'floor')!
    expect(floor.id).toBe(cellId('ford', x, y, 'floor'))
    expect(w.isSolidTerrain(floor.type.slice(5))).toBe(false)
    // gone, it stays gone: the map's data does not bring it back
    eng.author(() => w.destroy(after))
    expect(w.get(ref.e)).toBeUndefined()
    w.reindex()
    expect(w.get(ref.e)).toBeUndefined()
    expect(w.terrainAt('ford', x, y)).toBe(floor.type.slice(5))
  })

  it('exclusivity: in every cell of every map each space has at most one occupant, before and after two days', () => {
    const { eng, w } = ford()
    const check = () => {
      const bad: string[] = []
      for (const m of w.state.loadedMaps) {
        const data = w.map(m)!
        for (let y = 0; y < data.height; y++)
          for (let x = 0; x < data.width; x++) {
            const n: Partial<Record<Space, number>> = {}
            for (const e of w.entitiesAt(m, x, y)) for (const s of w.spacesOf(e)) n[s] = (n[s] ?? 0) + 1
            for (const [s, k] of Object.entries(n)) if (k! > 1) bad.push(`${m} ${x},${y} ${s}: ${w.entitiesAt(m, x, y).filter((e) => w.spacesOf(e).includes(s as Space)).map((e) => e.type).join(', ')}`)
            // and every cell has its floor
            if (!w.occupant(m, x, y, 'floor')) bad.push(`${m} ${x},${y}: no floor`)
          }
      }
      return bad
    }
    expect(check()).toEqual([])
    for (let t = 0; t < TICKS_PER_HOUR * 48; t++) {
      if (w.scene) eng.scenes.advance()
      eng.tick()
    }
    expect(check()).toEqual([])
  })

  it('a save keeps only the cells that changed', () => {
    const { game, eng, w } = ford()
    const kept = () => Object.keys(game.save().state.entities).filter((id) => parseCellId(id))
    expect(kept()).toEqual([])
    const map = w.map('ford')!
    const i = map.terrain.findIndex((t) => t === 'grass')
    const [x, y] = [i % map.width, Math.floor(i / map.width)]
    eng.author(() => w.setTerrain('ford', x, y, 'farmland'))
    expect(kept()).toEqual([cellId('ford', x, y, 'floor')])
    // and loading it again gives the same cell
    const again = Game.load(structuredClone(game.save()), buildFord().index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of buildFord().chunks) again.loadChunk(decodeChunk(c))
    expect(again.engine.world.terrainAt('ford', x, y)).toBe('farmland')
    expect(again.engine.world.get(cellId('ford', x, y, 'floor'))?.type).toBe('tile/farmland')
  })

  it('an older save: its tile overrides become the cells’ things, its tile relations start again', () => {
    const { game, index, chunks, w } = ford()
    const map = w.map('ford')!
    const tree = map.terrain.findIndex((t) => t === 'tree')
    const grass = map.terrain.findIndex((t) => t === 'grass')
    const at = (i: number) => [i % map.width, Math.floor(i / map.width)] as const
    const [tx, ty] = at(tree)
    const [gx, gy] = at(grass)
    const old = structuredClone(game.save()) as ReturnType<Game['save']> & { state: { tiles?: unknown } }
    old.state.tiles = {
      [`ford:${tx}:${ty}`]: { terrain: 'stump', statuses: { regrowing: 999 } },
      [`ford:${gx}:${gy}`]: { statuses: { wet: -1 } },
    }
    old.state.relations = { player: [`on|t|ford:${gx}:${gy}#grass`] }
    const loaded = Game.load(old, index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) loaded.loadChunk(decodeChunk(c))
    const lw = loaded.engine.world
    expect(lw.terrainAt('ford', tx, ty)).toBe('stump')
    expect(lw.hasStatus(lw.cellRef('ford', tx, ty), 'regrowing')).toBe(true)
    expect(lw.hasStatus(lw.cellRef('ford', gx, gy), 'wet')).toBe(true)
    expect(Object.values(lw.state.relations ?? {}).flat().some((k) => k.includes('|t|'))).toBe(false)
    expect('tiles' in lw.state).toBe(false)
    // the tree under the stump is gone, not waiting under it
    expect(lw.occupant('ford', tx, ty, 'volume')).toBeUndefined()
    expect(CELL_SPACES).toEqual(['floor', 'soil', 'volume'])
  })
})
