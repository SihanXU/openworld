import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// What the page needs to draw a minor monster's blows (runtime scene.ts: struck back from the striker, white for a moment,
// a lunge for a blow dealt bare, a felling's burst): a landed blow names who dealt it and whether it felled, and the felled
// one is gone in the same frame; a monster's own blow is a swing that names it.

const onto = buildOntology()
const WOLF = 'actor/creature/beast/wolf'

function setup(hp: number, ai = false) {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player, at = w.posOf(p)!
  let foe!: Entity
  eng.author(() => (foe = w.create(WOLF, { on: 'tile', map: at.map, x: at.x, y: at.y + 1 }, { props: { hp, maxHp: 200, def: 0 }, facing: 'up', ...(ai && { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5, home: { map: at.map, x: at.x, y: at.y + 1 }, leash: 6 } }) })))
  w.fx.length = 0
  return { eng, w, p, foe }
}

function strike(hp: number) {
  const { eng, w, p, foe } = setup(hp)
  eng.queue({ kind: 'impulse/strike', host: { e: foe.id }, roles: { actor: { e: p.id } }, params: { power: 20, edge: 'blunt' }, cause: p.id, origin: 'player' })
  eng.tick()
  return { hit: w.fx.find((f) => f.t === 'damage' && f.who === foe.id), gone: !w.get(foe.id), p }
}

describe('what a minor monster is drawn by', () => {
  it('a landed blow names who dealt it, and only a felling blow says so', () => {
    const { hit, gone, p } = strike(200)
    expect(hit).toMatchObject({ t: 'damage', by: p.id })
    expect(hit && 'fell' in hit).toBe(false)
    expect(gone).toBe(false)
  })

  it('a felling blow says so, and the felled is gone from the same frame', () => {
    const { hit, gone } = strike(5)
    expect(hit).toMatchObject({ t: 'damage', fell: true })
    expect(gone).toBe(true)
  })

  it('a monster striking bare makes a swing that names it', () => {
    const { eng, w, foe } = setup(200, true)
    let swing
    for (let i = 0; i < 60 && !swing; i++) {
      eng.tick()
      swing = w.fx.find((f) => f.t === 'vfx' && f.fx.startsWith('swing:') && f.who === foe.id)
      w.fx.length = 0
    }
    expect(swing).toBeDefined()
  })
})
