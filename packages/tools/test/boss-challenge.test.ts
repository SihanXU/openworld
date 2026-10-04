import { describe, expect, it } from 'vitest'
import { skillsOf } from '@lsw/engine'
import { BOSSES, BOSS_BY_ID, FIRST_BOSS, SKILLS, SKILL_PROFESSIONS } from '@lsw/content'
import { CHALLENGE_LOADOUTS, challengeOutcome, createBossChallenge } from '../../client/src/boss-challenge.ts'
import { CATALOG } from '../../client/src/assets/catalog.ts'
import { buildFord } from '../src/demo/world.ts'

const { index, chunks } = buildFord()
const raw = chunks.find((c) => c.map.id === FIRST_BOSS.map)!

describe('isolated profession boss challenges', () => {
  it.each(SKILL_PROFESSIONS.map((p) => p.id))('%s equips its weapon and learns only its own profession plus shared basics', (id) => {
    const before = JSON.stringify({ index, raw })
    const game = createBossChallenge(index, raw, id, 'greed'), w = game.engine.world, p = w.player
    expect(w.prop(p, 'profession')).toBe(id)
    expect(w.num(p, 'level')).toBe(20)
    expect(w.num(p, 'hp')).toBe(w.num(p, 'maxHp'))
    expect(w.num(p, 'maxHp')).toBeGreaterThan(CHALLENGE_LOADOUTS[id].hp)
    const own = SKILLS.filter((s) => s.profession === id)
    expect(skillsOf(p)).toEqual(expect.arrayContaining(own.map((s) => s.id)))
    expect(SKILLS.filter((s) => s.profession && s.profession !== id).some((s) => skillsOf(p).includes(s.id))).toBe(false)
    const weapon = w.get(p.held)!
    expect(weapon.type).toBe(SKILL_PROFESSIONS.find((p) => p.id === id)!.weapon!.type)
    expect(weapon.place).toEqual({ on: 'hand', holder: p.id })
    expect(CATALOG.characters[p.look!]).toBeDefined()
    if (id === 'mage') expect(w.prop(weapon, 'element')).toBe('fire')
    // Each real loadout can hurt a multi-cell body through the normal attack path.
    const boss = w.get(FIRST_BOSS.id)!
    w.author(() => w.place(p, { on: 'tile', map: FIRST_BOSS.map, x: 23, y: 16 }))
    p.facing = 'up'
    game.engine.playerAttack()
    expect(w.num(boss, 'hp')).toBeLessThan(BOSS_BY_ID.greed.hp)
    expect(JSON.stringify({ index, raw })).toBe(before)
  })

  it.each(BOSSES.map((b) => b.id))('loads %s alone, with no campaign exits or spawns', (id) => {
    const game = createBossChallenge(index, raw, 'assassin', id), w = game.engine.world
    expect(w.get(FIRST_BOSS.id)?.boss?.kit).toBe(id)
    expect(w.entitiesOnMap(FIRST_BOSS.map).filter((e) => w.kindOf(e) === 'actor')).toHaveLength(2)
    expect(w.fits(w.get(FIRST_BOSS.id)!, FIRST_BOSS.map, FIRST_BOSS.x, FIRST_BOSS.y)).toBe(true)
    expect(w.map(FIRST_BOSS.map)?.portals).toEqual([])
    expect(w.map(FIRST_BOSS.map)?.forage).toEqual([])
    expect(challengeOutcome(game)).toBeUndefined()
  })

  it('detects wins, losses, and a clean retry without carrying rewards or ailments', () => {
    const game = createBossChallenge(index, raw, 'mage', 'envy'), eng = game.engine, w = eng.world
    eng.damage(w.get(FIRST_BOSS.id)!, 9999, undefined, true, { e: w.player.id })
    expect(challengeOutcome(game)).toBe('victory')
    const retry = createBossChallenge(index, raw, 'warrior', 'envy')
    expect(challengeOutcome(retry)).toBeUndefined()
    expect(retry.engine.world.fact('sins.defeated.envy')).toBeUndefined()
    expect(retry.engine.world.num(retry.engine.world.player, 'xp')).toBe(0)
    retry.engine.damage(retry.engine.world.player, 9999, undefined, true)
    expect(challengeOutcome(retry)).toBe('defeat')
  })

  it('rejects unknown options instead of silently changing the selected profession or boss', () => {
    expect(() => createBossChallenge(index, raw, 'unknown', 'greed')).toThrow()
    expect(() => createBossChallenge(index, raw, 'assassin', 'unknown')).toThrow()
  })
})
