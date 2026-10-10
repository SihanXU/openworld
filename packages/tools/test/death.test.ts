// Death and rising again (after Minecraft): the one at the keys, felled, lies fallen and the frame
// says so — by whom, and at what difficulty; the death screen's choice is the story telling them to
// rise, and they do so themselves: where they fell (easy), or at home leaving what they carried
// bundled where they fell (normal) — but not what they wear, the weapon in their hand, nor what is
// important; a hand on the bundle gives it all back. A bed slept in or a waypoint woken is one's
// home. Hardcore has one life.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, difficultyOf, snapshot, textOf, type Engine } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { AT, buildFord } from '../src/demo/world.ts'

function ford(difficulty?: 'easy' | 'normal' | 'hardcore'): Engine {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
    if (difficulty) w.setFact('game.difficulty', difficulty)
    eng.teleport(w.player, { map: 'ford', x: AT.spawn[0], y: AT.spawn[1] })
    w.create('item/food/bread', { on: 'inside', holder: 'player' })
  })
  eng.controls.sync()
  return eng
}

/** A slime strikes the player down. */
function fall(eng: Engine): { x: number; y: number } {
  const w = eng.world
  const p = w.player
  const at = w.posOf(p)!
  const slime = eng.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: 'ford', x: at.x + 1, y: at.y }))
  eng.author(() => w.setProp(p, 'hp', 1))
  eng.act('use', slime.id, { e: p.id }, { instrument: null, params: { attack: true, power: 50 } })
  expect(w.hasStatus({ e: p.id }, 'down')).toBe(true)
  return { x: at.x, y: at.y }
}

describe('death and rising again', () => {
  it('a fall is shown: who felled one, and the difficulty (normal for a game that never chose)', () => {
    const eng = ford()
    expect(difficultyOf(eng)).toBe('normal')
    fall(eng)
    const f = snapshot(eng)
    expect(f.fallen?.difficulty).toBe('normal')
    expect(textOf(f.fallen?.by)).toMatch(/slime/)
  })

  it('a fall names the harm that felled one, not an older blow (struck by a slime, then felled by the world)', () => {
    const eng = ford()
    const w = eng.world
    const p = w.player
    const at = w.posOf(p)!
    const slime = eng.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: 'ford', x: at.x + 1, y: at.y }))
    eng.author(() => w.setProp(p, 'hp', 40))
    eng.act('use', slime.id, { e: p.id }, { instrument: null, params: { attack: true, power: 5 } })
    expect(w.hasStatus({ e: p.id }, 'down')).toBe(false)
    // later: a harm from no one (a fall, the clock) fells them
    eng.damage(p, 999, undefined, true)
    expect(w.hasStatus({ e: p.id }, 'down')).toBe(true)
    expect(snapshot(eng).fallen?.by).toBeUndefined()
  })

  it('a wound from one now gone still names them (a bleed the slime opened, the slime gone)', () => {
    const eng = ford()
    const w = eng.world
    const p = w.player
    const at = w.posOf(p)!
    const slime = eng.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: 'ford', x: at.x + 1, y: at.y }))
    eng.author(() => w.setProp(p, 'hp', 40))
    eng.act('use', slime.id, { e: p.id }, { instrument: null, params: { attack: true, power: 5 } })
    eng.author(() => (eng.applyStatus({ e: p.id }, 'bleeding', 300, slime.id), w.setProp(p, 'hp', 2), w.destroy(w.get(slime.id)!)))
    for (let i = 0; i < 100 && !w.hasStatus({ e: p.id }, 'down'); i++) eng.tick()
    expect(w.hasStatus({ e: p.id }, 'down')).toBe(true)
    expect(textOf(snapshot(eng).fallen?.by)).toMatch(/slime/)
  })

  it('easy: one gets up where one fell, whole, with everything', () => {
    const eng = ford('easy')
    const at = fall(eng)
    const w = eng.world
    eng.respawn(false)
    eng.tick()
    const p = w.player
    expect(w.hasStatus({ e: p.id }, 'down')).toBe(false)
    expect(w.num(p, 'hp')).toBe(w.num(p, 'maxHp'))
    expect(w.posOf(p)).toMatchObject({ map: 'ford', x: at.x, y: at.y })
    expect(eng.controls.count('item/food/bread')).toBe(1)
    expect(snapshot(eng).fallen).toBeUndefined()
  })

  it('normal: one rises at home — the bed last slept in — and what one carried lies bundled where one fell', () => {
    const eng = ford('normal')
    const w = eng.world
    const p = w.player
    // a bed, slept in: home
    const here = w.posOf(p)!
    const bed = eng.author(() => w.create('fixture/furniture/bed', { on: 'tile', map: 'ford', x: here.x, y: here.y }))
    eng.act('hands', p.id, { e: bed.id }, { instrument: null })
    eng.tick()
    expect(w.prop(p, 'home')).toBe(bed.id)
    // away from it, a fall
    eng.author(() => eng.teleport(p, { map: 'ford', x: AT.winch[0], y: AT.winch[1] + 2 }))
    const at = fall(eng)
    eng.respawn(true)
    eng.tick()
    expect(w.hasStatus({ e: p.id }, 'down')).toBe(false)
    expect(w.num(p, 'hp')).toBe(w.num(p, 'maxHp'))
    const now = w.posOf(p)!
    expect(Math.max(Math.abs(now.x - here.x), Math.abs(now.y - here.y))).toBeLessThanOrEqual(1)
    expect(eng.controls.count('item/food/bread')).toBe(0)
    const bundles = w.placedAt('ford', at.x, at.y).filter((e) => e.type === 'item/misc/bundle')
    expect(bundles).toHaveLength(1)
    expect(bundles[0].contents?.map((id) => w.get(id)?.type)).toEqual(['item/food/bread'])
    expect(bundles[0].dropped).toBeFalsy()
  })

  it('normal: what one wears, the weapon in one\'s hand and what is important stay with one; a hand on the bundle gives back the rest', () => {
    const eng = ford('normal')
    const w = eng.world
    const p = w.player
    const [helmet, club, spare, thorn] = eng.author(() => {
      const helmet = w.create('item/armor/helmet', { on: 'inside', holder: 'player' })
      w.setProp(p, 'wear:head', helmet.id)
      return [helmet, w.create('item/weapon/blunt/club', { on: 'inside', holder: 'player' }), w.create('item/weapon/blunt/club', { on: 'inside', holder: 'player' }), w.create('item/relic/oath_thorn', { on: 'inside', holder: 'player' })]
    })
    eng.controls.sync()
    // the club in the hand (its stack's slot)
    for (let i = 0; i < 10 && w.get(w.player.held)?.type !== 'item/weapon/blunt/club'; i++) eng.controls.select(i)
    const inHand = w.player.held!
    expect(w.get(inHand)?.type).toBe('item/weapon/blunt/club')
    const at = fall(eng)
    eng.respawn(true)
    eng.tick()
    const mine = (id: string) => { const e = w.get(id)!; return (e.place.on === 'inside' || e.place.on === 'hand') && e.place.holder === p.id }
    expect([mine(helmet.id), mine(inHand), mine(thorn.id)]).toEqual([true, true, true])
    expect(w.prop(p, 'wear:head')).toBe(helmet.id)
    const other = inHand === club.id ? spare : club
    const bundle = w.placedAt('ford', at.x, at.y).find((e) => e.type === 'item/misc/bundle')!
    expect(bundle.contents?.map((id) => w.get(id)?.type).sort()).toEqual(['item/food/bread', 'item/weapon/blunt/club'])
    expect(mine(other.id)).toBe(false)
    // back where one fell, a hand on the bundle: all of it comes back, and the bundle is gone
    eng.author(() => eng.teleport(p, { map: 'ford', x: at.x, y: at.y + 1 }))
    eng.act('hands', p.id, { e: bundle.id }, { instrument: null })
    eng.tick()
    expect([w.get(bundle.id), mine(other.id), eng.controls.count('item/food/bread')]).toEqual([undefined, true, 1])
  })

  it('a bundle taken (F) opens as by a hand: all of it comes back', () => {
    const eng = ford('normal')
    const w = eng.world
    const p = w.player
    const at = fall(eng)
    eng.respawn(true)
    eng.tick()
    const bundle = w.placedAt('ford', at.x, at.y).find((e) => e.type === 'item/misc/bundle')!
    eng.author(() => eng.teleport(p, { map: 'ford', x: at.x, y: at.y + 1 }))
    eng.act('take', p.id, { e: bundle.id }, { instrument: null })
    eng.tick()
    expect([w.get(bundle.id), eng.controls.count('item/food/bread'), eng.controls.count('item/misc/bundle')]).toEqual([undefined, 1, 0])
  })

  it('a waypoint woken is home too; with no home one rises where the world began', () => {
    const eng = ford('normal')
    const w = eng.world
    const p = w.player
    expect(eng.homeOf(p)).toEqual(w.state.spawn)
    const stone = Object.values(w.state.entities).find((e) => e.type === 'fixture/sacred/waypoint' && e.place.on === 'tile')!
    const s = stone.place as { map: string; x: number; y: number }
    eng.author(() => eng.teleport(p, { map: s.map, x: s.x, y: s.y + 1 }))
    eng.act('hands', p.id, { e: stone.id }, { instrument: null })
    eng.tick()
    expect(w.prop(p, 'home')).toBe(stone.id)
  })
})
