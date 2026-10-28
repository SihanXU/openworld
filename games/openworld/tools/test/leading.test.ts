// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, textOf, tickAt, type Engine, type FxEvent } from '@openworld/engine'
import { BASE_RULES, QUESTS, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { VIGIL } from '../src/demo/quest/vigil.ts'

// Lumi leads the way (the engine's companion.ts, the game's leading.ts): five seconds of the player doing nothing with
// the vigil tracked, and she flies to the dawnbloom on Dawn Hill and calls out over it — the flower itself, not the
// hill's middle, as the quest's marker is too; the player walking off another way, she comes back; on another map she
// shows the way off it toward the quest; never in a scene, nor with the option off.

const onto = buildOntology()

function world(): Engine {
  const { index, chunks } = buildFord()
  index.quests = QUESTS
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  game.mods.provider = undefined
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    eng.quests.put('descent', 'done')
    eng.quests.put('rescue', 'done')
    eng.quests.put('vigil', 10)
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
    w.setProp(w.player, 'track', 'quest.vigil')
    // Lumi at the player's side
    const pip = w.get('pip')!
    w.setProp(pip, 'companion', w.state.player)
  })
  w.state.tick = tickAt(1, 10)
  return eng
}

/** Stand the player at a cell (and Lumi beside them), as if they had just walked there. */
function stand(eng: Engine, map: string, x: number, y: number): void {
  const w = eng.world
  eng.author(() => {
    const at = eng.nearestFree({ map, x, y }, w.player) ?? { map, x, y }
    eng.teleport(w.player, at)
    w.place(w.get('pip')!, { on: 'tile', map, x: at.x - 2, y: at.y })
  })
  eng.npcs.begin(map)
  eng.companions.stir()
}

/** Tick on, keeping what Lumi calls out. */
function wait(eng: Engine, n: number, said: string[] = []): string[] {
  const w = eng.world
  for (let i = 0; i < n; i++) {
    eng.tick()
    for (const f of w.drainFx() as FxEvent[]) if (f.t === 'say' && f.who === 'pip' && f.aside) said.push(textOf(f.text, 'zh'))
  }
  return said
}

const far = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

describe('Lumi leads the way', () => {
  it('to the dawnbloom itself: the marker on the flower, and she flies over it and calls out after five idle seconds', () => {
    const eng = world()
    const w = eng.world
    stand(eng, 'dawnhill', 25, 16)
    // the quest's marker is on a flower, not the hill's middle
    const bloom = eng.quests.targets().find((t) => t.objective === 'bloom')!
    expect(VIGIL.bloom.some(([x, y]) => bloom.map === 'dawnhill' && bloom.x === x && bloom.y === y)).toBe(true)
    // under five seconds: nothing yet
    expect(wait(eng, 45)).toEqual([])
    expect(eng.companions.pointing()).toBeUndefined()
    // then she goes, and over it she says so (the objective's own line)
    const said = wait(eng, 80)
    const spot = eng.companions.pointing()
    expect(spot, 'she shows a spot').toBeDefined()
    expect(VIGIL.bloom.some(([x, y]) => spot!.x === x && spot!.y === y)).toBe(true)
    expect(said.join('')).toContain('晨光花')
    expect(far(w.posOf(w.get('pip')!)!, spot!)).toBeLessThanOrEqual(1)
  })

  it('comes back when the player goes another way, and leads on while they follow', () => {
    const eng = world()
    const w = eng.world
    stand(eng, 'dawnhill', 20, 22)
    wait(eng, 60)
    const lead = eng.quests.lead()!
    expect(lead.kind).toBe('thing')
    // walking toward the flower: she keeps leading
    const toward = lead.x > w.posOf(w.player)!.x ? 'right' : 'left'
    for (let i = 0; i < 6; i++) (eng.movePlayer(toward), wait(eng, 3))
    // she is still out ahead of them, nearer the flower than they are
    expect(far(w.posOf(w.get('pip')!)!, lead)).toBeLessThan(far(w.posOf(w.player)!, lead))
    // turning back the other way: she gives it up and keeps up again
    const back = toward === 'right' ? 'left' : 'right'
    for (let i = 0; i < 8; i++) (eng.movePlayer(back), wait(eng, 3))
    expect(eng.companions.pointing()).toBeUndefined()
    expect(far(w.posOf(w.get('pip')!)!, w.posOf(w.player)!)).toBeLessThanOrEqual(4)
  })

  it('on a map without the quest’s spot, shows the way off it toward one (and the marker points there too)', () => {
    const eng = world()
    const w = eng.world
    stand(eng, 'meadow', 20, 12)
    const lead = eng.quests.lead()!
    expect(lead.kind).toBe('exit')
    const exit = eng.quests.targets().find((t) => t.way)
    expect(exit && { x: exit.x, y: exit.y }).toEqual({ x: lead.x, y: lead.y })
    const said = wait(eng, 50 + 20 * 6)
    expect(said.length, 'she calls out the way').toBeGreaterThan(0)
    const pip = w.posOf(w.get('pip')!)!
    // she is out toward the way off, nearer it than the player is
    expect(far(pip, lead)).toBeLessThan(far(w.posOf(w.player)!, lead))
  })

  it('never in a scene, nor with the option off', () => {
    const eng = world()
    stand(eng, 'dawnhill', 25, 16)
    eng.companions.guiding = false
    expect(wait(eng, 150)).toEqual([])
    expect(eng.companions.pointing()).toBeUndefined()
    eng.companions.guiding = true
    eng.companions.stir()
    eng.world.scene = { id: 'test', step: 0, waiting: 'advance' }
    expect(wait(eng, 150)).toEqual([])
    expect(eng.companions.pointing()).toBeUndefined()
  })
})
