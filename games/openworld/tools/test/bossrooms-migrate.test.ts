import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@openworld/engine'
import { ABBOT_ID, ALBERIC_ID, BASE_RULES, BOSS_ROOMS, BOSS_ROOMS_LAYOUT, CH1, ORDER_SEAL, STORY_RULES, buildOntology, decodeChunk, migrateBossRooms } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// An older save, from before the bosses had rooms of their own (docs/boss-rooms.md), loaded (migrateBossRooms): a boss
// it held alive goes to its post in its arena; one that had fallen where it stood stays fallen — the arena's fresh copy
// is not had, and the story knows of its fall, so the fogs of its room lift (none seals a player in with no one there).

function older(maps: string[]) {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const w = game.engine.world
  const chunk = (id: string) => decodeChunk(chunks.find((c) => c.map.id === id)!)
  for (const id of maps) game.loadChunk(chunk(id))
  w.author(() => w.setFact(BOSS_ROOMS_LAYOUT, false))
  const arenas = BOSS_ROOMS.map((r) => chunk(r.arena))
  const migrate = () => game.engine.author(() => migrateBossRooms(game, arenas))
  /** The boss fell where it stood: gone from the map's record, as a save keeps it. */
  const fell = (map: string, id: string) =>
    w.author(() => {
      const e = w.get(id)
      if (e) w.destroy(e)
      ;((w.state.chunks ??= {})[map] ??= {}).gone = [...(w.state.chunks[map].gone ?? []), id]
    })
  return { game, w, chunk, arenas, migrate, fell }
}

describe('the bosses moved into rooms of their own (an older save)', () => {
  it('the knight alive on the East Road goes to his post in the Kingdom', () => {
    const { w, arenas, migrate } = older(['eastroad'])
    const post = arenas.find((c) => c.map.id === 'kingdom')!.entities.find((e) => e.id === ALBERIC_ID)!
    w.author(() => w.add({ ...structuredClone(post), place: { on: 'tile', map: 'eastroad', x: 20, y: 12 } }))
    migrate()
    expect(w.get(ALBERIC_ID)?.place).toMatchObject({ on: 'tile', map: 'kingdom' })
    expect(w.fact(CH1.knight)).toBeFalsy()
  })

  it('the knight fallen there is not had again in the Kingdom', () => {
    const { game, w, chunk, migrate, fell } = older(['eastroad'])
    fell('eastroad', ALBERIC_ID)
    w.author(() => w.setFact(CH1.knight, 1))
    migrate()
    // (and when the Kingdom is entered, as its file comes)
    game.loadChunk(chunk('kingdom'))
    expect(w.get(ALBERIC_ID)).toBeUndefined()
  })

  it('the warden fallen in its sanctum: the story knows, and its fogs lift', () => {
    const { w, migrate, fell } = older(['sanctum'])
    fell('sanctum', 'barrow.warden')
    migrate()
    expect(w.fact(BOSS_ROOMS.find((r) => r.boss === 'warden')!.fact)).toBeTruthy()
  })

  it('Prior Wendel fallen in the crypt is not had again in his tomb, nor his seal twice', () => {
    const { w, migrate, fell } = older(['abbey.crypt'])
    fell('abbey.crypt', ABBOT_ID)
    // the seal he left, carried
    w.author(() => w.add({ id: 'abbey.crypt~ie', type: ORDER_SEAL, place: { on: 'inside', holder: w.player.id } }))
    migrate()
    expect(w.get(ABBOT_ID)).toBeUndefined()
    expect(w.fact(BOSS_ROOMS.find((r) => r.boss === 'wendel')!.fact)).toBeTruthy()
    expect(Object.values(w.state.entities).filter((e) => e.type === ORDER_SEAL).map((e) => e.id)).toEqual(['abbey.crypt~ie'])
  })

  it('a boss whose ground the save never reached is left to its arena, and nothing is told', () => {
    const { w, migrate } = older([])
    migrate()
    for (const r of BOSS_ROOMS) expect(w.fact(r.fact), r.boss).toBeFalsy()
    expect(w.state.loadedMaps).not.toContain('kingdom')
  })
})
