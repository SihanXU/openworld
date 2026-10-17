// The two boss fights redesigned on the one skill system (docs/skills.md, docs/bosses.md): the White Knight — his
// rotation, the hilt that answers one who stands too close, the briars none cross that do not kneel, the hedge he
// closes as he holds — and the dragon of Cinder Peak — the breath the pillars shelter from, the embers it leaves, the
// dive that stuns it on a rock, the brood it calls once, the ash that falls at the last.
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, snapshot, type MapData } from '@openworld/engine'
import { castNow, encounter, kitsOf, ready } from '@openworld/modules'
import { BASE_RULES, BOSS_BY_ID, EMBERS, HEDGE, SPROUT, STORY_RULES, buildOntology, createBoss } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
function arena(id: string, playerAt = { x: 16, y: 21 }) {
  const { index } = buildFord()
  const at = { map: 'arena', ...playerAt }
  Object.assign(index, { start: at, npcs: [], companions: [], steps: [], quests: [], invariants: [], waypoints: [] })
  index.player.place = { on: 'tile', ...at }
  index.player.props = { ...index.player.props, hp: 1000, maxHp: 1000, def: 0 }
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES])), eng = game.engine, w = eng.world
  const map: MapData = { id: 'arena', name: 'Arena', kind: 'wild', width: 40, height: 40, terrain: Array(1600).fill('grass'), portals: [], light: 'indoor' }
  game.loadChunk({ map, entities: [createBoss(id, { map: 'arena', x: 16, y: 16 })] })
  const boss = w.get(`sin.${id}`)!, player = w.player
  const ticks = (n: number) => { for (let i = 0; i < n; i++) eng.tick() }
  const pending = () => kitsOf(eng).pending.get(boss.id)
  /** Tick until the boss winds a skill up; its id. */
  const next = (most = 200) => {
    for (let i = 0; i < most && !pending(); i++) eng.tick()
    return pending()?.skill.id
  }
  /** Let the wind-up under way land (and any skill chained after it). */
  const land = () => { for (let i = 0; i < 200 && pending(); i++) eng.tick() }
  const place = (x: number, y: number) => w.author(() => w.place(player, { on: 'tile', map: 'arena', x, y }))
  const heal = () => w.author(() => w.setProp(player, 'hp', 1000))
  return { game, index, map, eng, w, boss, player, ticks, pending, next, land, place, heal }
}
const of = (w: ReturnType<typeof arena>['w'], type: string) => w.entitiesOnMap('arena').filter((e) => e.type === type)

describe('the White Knight', () => {
  it('takes his first phase\'s skills up in turn, and answers one who stands too close without losing his place', () => {
    const { w, boss, next, land, place, heal, eng } = arena('alberic')
    const rotation = BOSS_BY_ID.alberic.encounter.phases[0].rotation
    // at a distance his hilt cannot reach: the rotation, in order
    for (const id of rotation.slice(0, 3)) {
      place(16, 21)
      heal()
      expect(next()).toBe(id)
      land()
    }
    expect(boss.boss!.step).toBe(3)
    // beside him (he walked up for his thorns): his hilt drives one back, and the rotation waits where it was
    const at = w.posOf(boss)!
    place(at.x, at.y + 1)
    eng.setCooldown(`kit:${boss.id}:hilt`, 0)
    expect(next()).toBe('hilt')
    land()
    expect(boss.boss!.step).toBe(3)
  })

  it('grows a line of briars that makes those who wade in kneel — once, and then they are steadied — and that withers', () => {
    const { eng, w, boss, player, ticks, place, land } = arena('alberic')
    place(16, 21)
    castNow(eng, boss, 'toll')
    land()
    const briars = of(w, SPROUT)
    expect(briars.length).toBeGreaterThan(5)
    // struck where it grew: cut, kneeling
    expect(w.num(player, 'hp')).toBeLessThan(1000)
    expect(player.statuses?.knelt).toBeDefined()
    // not again so soon: no hold follows a hold
    ticks(12)
    const sprout = briars.find((b) => w.posOf(b)!.y === 23)!
    place(17, 23)
    eng.author(() => eng.removeStatus({ e: player.id }, 'knelt'))
    const hp = w.num(player, 'hp')
    expect(eng.step(player, 'left')).toBe(true)
    expect(w.posOf(player)).toMatchObject({ x: w.posOf(sprout)!.x, y: 23 })
    ticks(1)
    expect(w.num(player, 'hp')).toBeLessThan(hp)
    expect(player.statuses?.knelt).toBeUndefined()
    // a while later, one who wades in kneels
    eng.author(() => eng.removeStatus({ e: player.id }, 'steadied'))
    place(17, 24)
    eng.step(player, 'left')
    ticks(1)
    expect(player.statuses?.knelt).toBeDefined()
    // they wither in twelve seconds
    ticks(130)
    expect(of(w, SPROUT)).toHaveLength(0)
  })

  it('looses a second arrow aimed where one stands when the first has landed', () => {
    const { eng, w, boss, pending, place, ticks } = arena('alberic')
    place(16, 21)
    castNow(eng, boss, 'arrow_twice')
    place(21, 16)
    ticks(pending()!.releaseAt - w.state.tick)
    const second = pending()!
    expect(second.skill.id).toBe('arrow_again')
    // aimed afresh: the line runs east now, toward where the foe stands
    expect(second.tiles.every(([x]) => x > 16)).toBe(true)
  })

  it('at half health holds: his second phase opens once with the hedge he closes round himself, steady through a stun', () => {
    const { eng, w, boss, player, next, land, ticks, place } = arena('alberic')
    place(16, 21)
    w.author(() => w.setProp(boss, 'hp', BOSS_BY_ID.alberic.hp * 0.45))
    expect(next()).toBe('hold')
    expect(boss.boss!.phase).toBe(2)
    // stunned in it, he keeps it: its wind-up waits
    const releaseAt = kitsOf(eng).pending.get(boss.id)!.releaseAt
    eng.author(() => eng.applyStatus({ e: boss.id }, 'stunned', 5))
    ticks(3)
    expect(kitsOf(eng).pending.get(boss.id)?.skill.id).toBe('hold')
    expect(kitsOf(eng).pending.get(boss.id)!.releaseAt).toBe(releaseAt + 3)
    land()
    expect(of(w, HEDGE).length).toBeGreaterThan(20)
    expect(w.fx.some((f) => f.t === 'say' && f.who === boss.id)).toBe(true)
    // healed above half he stays in his second phase, and holds no second time
    w.author(() => w.setProp(boss, 'hp', BOSS_BY_ID.alberic.hp))
    w.author(() => w.setProp(player, 'hp', 1000))
    const second = BOSS_BY_ID.alberic.encounter.phases[1].rotation
    expect(second).toContain(next())
    expect(boss.boss!.phase).toBe(2)
  })
})

describe('the dragon of Cinder Peak', () => {
  it('is fought as a boss: its plate, its three phases', () => {
    const { eng, boss } = arena('dragon')
    expect(snapshot(eng).entities.find((e) => e.id === boss.id)!.boss).toMatchObject({ kit: 'dragon', phases: 3, thresholds: [0.5, 0.25], footprint: [2, 2] })
  })

  it('breathes a cone the rock shelters from, leaving embers that burn those who step on them and die down', () => {
    const { eng, w, boss, player, pending, land, place, ticks } = arena('dragon')
    // a rock pillar two cells before its mouth
    w.author(() => w.setTerrain('arena', 16, 18, 'rock'))
    place(16, 20)
    castNow(eng, boss, 'breath')
    const cells = new Set(pending()!.tiles.map(([x, y]) => `${x},${y}`))
    expect(cells.has('16,18')).toBe(false)
    expect(cells.has('16,20')).toBe(false)
    expect(cells.has('15,19')).toBe(true)
    land()
    expect(w.num(player, 'hp')).toBe(1000)
    const embers = of(w, EMBERS)
    expect(embers.length).toBeGreaterThan(3)
    expect(embers.every((e) => w.hasStatus({ e: e.id }, 'burning'))).toBe(true)
    // into the embers: burnt
    const ember = embers.find((e) => w.posOf(e)!.y === 19 && w.posOf(e)!.x === 15)!
    expect(ember).toBeDefined()
    place(14, 19)
    expect(eng.step(player, 'right')).toBe(true)
    ticks(1)
    expect(player.statuses?.burning).toBeDefined()
    // they die down
    ticks(50)
    expect(of(w, EMBERS)).toHaveLength(0)
  })

  it('dives down the row, and a dive that meets only a rock leaves it stunned', () => {
    const { eng, w, boss, player, place, land, ticks } = arena('dragon')
    place(30, 16)
    w.author(() => w.setTerrain('arena', 20, 15, 'rock'))
    w.author(() => w.setTerrain('arena', 20, 16, 'rock'))
    castNow(eng, boss, 'dive')
    land()
    expect(w.posOf(boss)!.x).toBeLessThan(20)
    expect(boss.statuses?.stunned).toBeDefined()
    expect(w.num(player, 'hp')).toBe(1000)
    // what it flew over burns
    expect(of(w, EMBERS).length).toBeGreaterThan(0)
    ticks(1)
  })

  it('strikes from its body\'s edge on every side: the dive and the bite reach one to its right, above, left or below', () => {
    // its 2x2 body stands on 16–17 × 15–16: no skill begins from a corner of itself
    for (const [x, y] of [[23, 16], [16, 9], [10, 16], [16, 22]]) {
      const { eng, w, boss, player, place, land } = arena('dragon')
      place(x, y)
      castNow(eng, boss, 'dive')
      land()
      expect(w.num(player, 'hp'), `the dive at ${x},${y}`).toBeLessThan(1000)
      expect(boss.statuses?.stunned, `the dive at ${x},${y}`).toBeUndefined()
    }
    for (const [x, y] of [[18, 16], [16, 14], [15, 16], [16, 17]]) {
      const { eng, w, boss, player, place, land } = arena('dragon')
      place(x, y)
      const bite = kitsOf(eng).skillOf(boss, 'bite')!
      expect(ready(eng, boss, bite, w.posOf(boss)!, w.posOf(player)!), `the bite ready at ${x},${y}`).toBe(true)
      castNow(eng, boss, 'bite')
      land()
      expect(w.num(player, 'hp'), `the bite at ${x},${y}`).toBeLessThan(1000)
    }
  })

  it('calls its brood even when a save was taken while it called: a lost wind-up gives the opening back', () => {
    const { game, index, map, w, boss, next, place } = arena('dragon')
    place(16, 21)
    w.author(() => w.setProp(boss, 'hp', BOSS_BY_ID.dragon.hp * 0.45))
    expect(next()).toBe('brood')
    const loaded = Game.load(structuredClone(game.save()), index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    loaded.loadMapData(map)
    const eng = loaded.engine, again = eng.world.get(boss.id)!
    expect(kitsOf(eng).pending.get(again.id)).toBeUndefined()
    for (let i = 0; i < 200 && !kitsOf(eng).pending.get(again.id); i++) eng.tick()
    expect(kitsOf(eng).pending.get(again.id)?.skill.id).toBe('brood')
    for (let i = 0; i < 200 && kitsOf(eng).pending.get(again.id); i++) eng.tick()
    expect(of(eng.world, 'actor/creature/whelp')).toHaveLength(3)
  })

  it('calls its brood once as its second phase opens, and never again in a world whose brood has come', () => {
    const a = arena('dragon')
    a.place(16, 21)
    a.w.author(() => a.w.setProp(a.boss, 'hp', BOSS_BY_ID.dragon.hp * 0.45))
    expect(a.next()).toBe('brood')
    a.land()
    expect(of(a.w, 'actor/creature/whelp')).toHaveLength(3)
    expect(a.w.fact('mq.whelps')).toBe(1)
    const b = arena('dragon')
    b.w.author(() => b.w.setFact('mq.whelps', 1))
    b.w.author(() => b.w.setProp(b.boss, 'hp', BOSS_BY_ID.dragon.hp * 0.45))
    expect(b.next()).toBe('brood')
    b.land()
    expect(of(b.w, 'actor/creature/whelp')).toHaveLength(0)
  })

  it('opens every phase a blow skipped, in order: a dragon struck from full to a fifth still calls its brood', () => {
    const { w, boss, next, land, place } = arena('dragon')
    place(16, 21)
    w.author(() => w.setProp(boss, 'hp', BOSS_BY_ID.dragon.hp * 0.2))
    expect(next()).toBe('brood')
    expect(boss.boss!.phase).toBe(3)
    land()
    expect(next()).toBe('ashfall')
  })

  it('at a quarter, the ash falls in two waves, the second aimed afresh', () => {
    const { eng, w, boss, pending, next, place, ticks } = arena('dragon')
    place(16, 21)
    Object.assign(boss.boss!, { phase: 2, opened: 2 })
    w.author(() => w.setProp(boss, 'hp', BOSS_BY_ID.dragon.hp * 0.2))
    expect(next()).toBe('ashfall')
    expect(boss.boss!.phase).toBe(3)
    place(26, 26)
    ticks(pending()!.releaseAt - w.state.tick)
    expect(pending()?.skill.id).toBe('ashfall_again')
    expect(pending()!.aim).toMatchObject({ x: 26, y: 26 })
    encounter(eng, boss, 'arena')
  })
})
