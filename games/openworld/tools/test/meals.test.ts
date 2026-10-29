// Meals on the real demo world (design.md §5.18, docs/npc-sandbox.md §2.11): every household under a roof keeps a
// larder kept each morning, everyone who sleeps eats waking and before bed, and Firstlight's people go days — watched,
// and away while the player is elsewhere — without anyone starving.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_DAY, TICKS_PER_HOUR, type Engine, type Entity } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { HOUSEHOLDS } from '../src/demo/people.ts'

const world = buildFord()

function fresh(): Engine {
  const game = Game.create(world.index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of world.chunks) game.loadChunk(decodeChunk(structuredClone(c)))
  game.mods.provider = undefined
  const eng = game.engine
  eng.author(() => {
    eng.quests.put('descent', 'done')
    eng.world.setFact('seen.arrival', true)
    eng.teleport(eng.world.player, { map: 'meadow', x: 20, y: 14 })
  })
  return eng
}

/** Ticks on, the scenes let through; the lowest hunger each person came to. */
function live(eng: Engine, ticks: number, low: Map<string, number>): void {
  const w = eng.world
  const folk = w.people().filter((e) => e !== w.player && w.num(e, 'maxHunger') > 0)
  for (let t = 0; t < ticks; t++) {
    if (w.scene) eng.story.advance()
    eng.tick()
    if (t % 60 === 0) for (const e of folk) low.set(e.id, Math.min(low.get(e.id) ?? Infinity, w.num(e, 'hunger')))
  }
}

describe('meals', () => {
  it('every household whose home has a roof keeps a larder in food, kept each morning; everyone who sleeps eats twice a day', () => {
    const homes = world.chunks.flatMap((c) => Object.values(c.map.regionProps ?? {}).map((p) => ({ c, owner: p.owner })))
    let kept = 0
    for (const h of Object.keys(HOUSEHOLDS)) {
      // (its home: the room behind its door; the house's walls outside are its too, shells.ts)
      const home = homes.find((x) => x.owner === `household:${h}` && x.c.map.kind === 'interior')
      if (!home) continue
      kept++
      const larder = home.c.entities.find((e) => e.tags?.includes('larder'))
      expect(larder, `${h}'s larder`).toBeTruthy()
      expect(String(larder!.props?.stock)).toMatch(/item\/food\//)
      expect(home.c.entities.filter((e) => e.place.on === 'inside' && e.place.holder === larder!.id).length).toBeGreaterThan(0)
    }
    // (Marta's, the watch's, the elder's, the woodcutters', Joss's, the mill's, the pilgrims', the charcoal-burner's, the bend's)
    expect(kept).toBeGreaterThanOrEqual(8)
    for (const n of world.index.npcs as Entity[]) {
      const day = n.npc!.schedule
      if (!day.some((s) => s.activity === 'sleep')) continue
      expect(day.filter((s) => s.tends?.includes('hungry')).length, n.id).toBe(2)
    }
  })

  it('Firstlight goes two days watched and two away without anyone starving', { timeout: 300_000 }, () => {
    const eng = fresh()
    const w = eng.world
    const low = new Map<string, number>()
    live(eng, TICKS_PER_DAY * 2, low)
    // two days at the Ford: the village's maps sleep, its people's hunger waits for them to be seen again
    eng.author(() => eng.teleport(w.player, { map: 'ford', x: 10, y: 10 }))
    live(eng, TICKS_PER_DAY * 2, new Map())
    eng.author(() => eng.teleport(w.player, { map: 'meadow', x: 20, y: 14 }))
    live(eng, TICKS_PER_HOUR * 6, low)
    expect([...low].filter(([, h]) => h <= 0)).toEqual([])
  })
})
