import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// What the page needs to draw a minor monster's blows (runtime scene.ts: struck back from the striker, white for a moment,
// a lunge for a blow dealt bare, a felling's burst): a landed blow names who dealt it and whether it felled, and the felled
// one is gone in the same frame; a monster's own blow is a swing that names it; one that takes a foe up says so once ("!",
// hud.ts), and again only after a while without one; one that loses a foe still about says that once too ("?").

const onto = buildOntology()
const WOLF = 'actor/creature/beast/wolf'

function setup(hp: number, ai = false, dy = 1) {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player, at = w.posOf(p)!
  let foe!: Entity
  eng.author(() => (foe = w.create(WOLF, { on: 'tile', map: at.map, x: at.x, y: at.y + dy }, { props: { hp, maxHp: 200, def: 0 }, facing: 'up', ...(ai && { ai: { behaviour: 'melee', temper: 'aggressive', sight: 5, home: { map: at.map, x: at.x, y: at.y + dy }, leash: 6 } }) })))
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

  it('a monster that takes a foe up shows it once, and again only after a while without one', () => {
    const { eng, w, foe } = setup(200, true)
    const notices = (ticks: number) => {
      let n = 0
      for (let i = 0; i < ticks; i++) {
        eng.tick()
        n += w.fx.filter((f) => f.t === 'emote' && f.who === foe.id && f.mood === 'surprised').length
        w.fx.length = 0
      }
      return n
    }
    expect(notices(80)).toBe(1)
    const sight = foe.ai!.sight
    eng.author(() => (foe.ai!.sight = 0))
    expect(notices(80)).toBe(0)
    expect(foe.ai!.state).not.toBe('chase')
    eng.author(() => (foe.ai!.sight = sight))
    expect(notices(40)).toBe(1)
  })

  it('a monster that loses its foe shows it once, and not again while it loses it over and over', () => {
    const { eng, w, foe } = setup(200, true)
    const lost = (ticks: number) => {
      let n = 0
      for (let i = 0; i < ticks; i++) {
        eng.tick()
        n += w.fx.filter((f) => f.t === 'lost' && f.who === foe.id).length
        w.fx.length = 0
      }
      return n
    }
    const sight = foe.ai!.sight
    expect(lost(40)).toBe(0)
    eng.author(() => (foe.ai!.sight = 0))
    expect(lost(10)).toBe(1)
    let flicker = 0, chased = 0
    for (let i = 0; i < 3; i++) {
      eng.author(() => (foe.ai!.sight = sight))
      flicker += lost(6)
      chased += +(foe.ai!.state === 'chase')
      eng.author(() => (foe.ai!.sight = 0))
      flicker += lost(6)
    }
    expect(chased).toBeGreaterThan(0)
    expect(flicker).toBe(0)
    expect(lost(80)).toBe(0)
    eng.author(() => (foe.ai!.sight = sight))
    lost(10)
    eng.author(() => (foe.ai!.sight = 0))
    expect(lost(10)).toBe(1)
  })

  it('one that opens with a skill has shown it by the time it winds up', () => {
    const { eng, w, foe } = setup(200, true, 3)
    let shown = false, wound = false
    for (let i = 0; i < 60 && !wound; i++) {
      eng.tick()
      shown ||= w.fx.some((f) => f.t === 'emote' && f.who === foe.id && f.mood === 'surprised')
      wound = w.fx.some((f) => f.t === 'say' && f.who === foe.id)
      w.fx.length = 0
    }
    expect(wound).toBe(true)
    expect(shown).toBe(true)
  })
})
