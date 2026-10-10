// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, bossPattern, encounter, snapshot, type Engine, type MapData } from '@openworld/engine'
import { combatDelay } from '@openworld/modules'

/** The encounter goal of every sin on a map, alone (world-model.md §6.10): what the bosses do this tick. */
const stepBosses = (eng: Engine, map: string) => {
  for (const e of eng.world.entitiesOnMap(map)) encounter(eng, e, map)
}
import { BASE_RULES, BOSSES, BOSS_BY_ID, BOSS_LAYOUT, STORY_RULES, buildOntology, createBoss, migrateBosses } from '@openworld-game/content'
import { SIN_ACTORS, SIN_FX } from '@openworld/runtime/src/assets/bosses.ts'
import { bossAnimationFrame } from '@openworld/runtime/src/render/boss-animation.ts'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const library = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
function arena(id = 'pride') {
  const { index } = buildFord()
  const at = { map: 'arena', x: 16, y: 20 }
  Object.assign(index, { start: at, npcs: [], companions: [], steps: [], quests: [], invariants: [], waypoints: [] })
  index.player.place = { on: 'tile', ...at }
  index.player.props = { ...index.player.props, hp: 1000, maxHp: 1000, def: 0 }
  const game = Game.create(index, onto, library()), eng = game.engine, w = eng.world
  const map: MapData = { id: 'arena', name: 'Arena', kind: 'wild', width: 40, height: 40, terrain: Array(1600).fill('grass'), portals: [], light: 'indoor' }
  game.loadChunk({ map, entities: [createBoss(id, { map: 'arena', x: 16, y: 16 })] })
  const boss = w.get(`sin.${id}`)!, player = w.player
  const ticks = (n: number) => { for (let i = 0; i < n; i++) eng.tick() }
  return { game, index, eng, w, boss, player, map, ticks }
}

describe('the original boss encounters', () => {
  it('authors four different kits, three multi-tile bodies, and one single-tile assassin', () => {
    expect(BOSSES.map((b) => b.id).sort()).toEqual(['alberic', 'envy', 'lust', 'pride'])
    expect(BOSSES.filter((b) => b.footprint[0] * b.footprint[1] === 1).map((b) => b.id)).toEqual(['envy'])
    expect(new Set(BOSSES.flatMap((b) => b.skills.map((s) => s.fx))).size).toBe(12)
    for (const b of BOSSES) {
      expect(b.skills).toHaveLength(3)
      expect(onto.types[`actor/creature/sin/${b.id}`].footprint).toEqual(b.footprint)
      for (const skill of b.skills) { expect(skill.windup).toBeGreaterThanOrEqual(10); expect(onto.vfx).toContain(skill.fx) }
    }
  })

  it('indexes the entire body, blocks movement at its edge, and accepts an edge attack', () => {
    const { eng, w, boss, player } = arena()
    expect(w.occupiedCells(boss)).toHaveLength(20)
    for (const [x, y] of w.occupiedCells(boss)) expect(w.actorAt('arena', x, y)?.id).toBe(boss.id)
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: 13, y: 15 }))
    expect(eng.step(player, 'right')).toBe(false)
    player.facing = 'right'
    eng.playerAttack({ e: boss.id })
    expect(w.num(boss, 'hp')).toBeLessThan(BOSS_BY_ID.pride.hp)
    expect(w.entitiesOnMap('arena').filter((e) => e.id === boss.id)).toHaveLength(1)
    // A wall under only the far side still prevents movement.
    w.author(() => w.setTerrain('arena', 19, 15, 'wall'))
    expect(eng.step(boss, 'right')).toBe(false)
    w.author(() => w.setTerrain('arena', 19, 15, 'grass'))
    expect(eng.step(boss, 'right')).toBe(true)
    expect(w.actorAt('arena', 14, 16)).toBeUndefined()
    w.author(() => w.transform(boss, 'actor/creature/sin/envy'))
    expect(w.actorAt('arena', 18, 16)).toBeUndefined()
    w.author(() => w.destroy(boss))
    expect(w.actorAt('arena', 17, 16)).toBeUndefined()
  })

  it('warns before release, locks its aim, and lets the player dodge without a tracking hit', () => {
    const { eng, w, boss, player, ticks } = arena()
    boss.boss!.nextSkill = 1
    ticks(1)
    const pending = structuredClone(boss.boss!.pending!)
    expect(pending).toBeDefined()
    expect(w.num(player, 'hp')).toBe(1000)
    expect(snapshot(eng).entities.find((e) => e.id === boss.id)!.boss!.warning!.tiles).toEqual(pending.tiles)
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: 20, y: 19 }))
    ticks(pending.releaseAt - w.state.tick)
    expect(w.num(player, 'hp')).toBe(1000)
    expect(boss.boss!.pending).toBeUndefined()
    expect(boss.boss!.nextSkill).toBe(2)
    expect(w.fx.some((f) => f.t === 'vfx' && f.fx === 'sin:pride:mirror')).toBe(true)
  })

  it.each(BOSSES.flatMap((b) => b.skills.map((s, i) => [b.id, s.id, i] as const)))('%s / %s resolves the same advertised cells and emits its own art', (id, _skillId, skillIndex) => {
    const { eng, w, boss, player } = arena(id)
    const skill = BOSS_BY_ID[id].skills[skillIndex]
    const origin = w.posOf(boss)!, aim = { map: 'arena', x: 16, y: 19 }
    const tiles = bossPattern(skill, origin, aim)
    const hit = tiles.find(([x, y]) => y > origin.y && w.walkable('arena', x, y, player.id))!
    expect(hit).toBeDefined()
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: hit[0], y: hit[1] }))
    const before = w.num(boss, 'hp') - 100
    ;(boss.props ??= {}).hp = before
    boss.boss!.pending = { skill: skillIndex, target: player.id, origin, aim, tiles, releaseAt: w.state.tick }
    boss.boss!.action = skill.action
    stepBosses(eng, 'arena')
    expect(w.num(player, 'hp')).toBe(1000 - skill.damage)
    expect(w.fx.filter((f) => f.t === 'damage' && f.who === player.id)).toHaveLength(1)
    expect(w.fx.some((f) => f.t === 'vfx' && f.fx === skill.fx)).toBe(true)
    if (skill.status) expect(player.statuses?.[skill.status]).toBeGreaterThan(w.state.tick)
    if (skill.heal) expect(w.num(boss, 'hp')).toBe(before + skill.heal)
    if (skill.blink) expect(w.posOf(boss)).not.toEqual(origin)
    expect(boss.boss!.nextAt).toBe(w.state.tick + skill.recovery)
    expect(boss.boss!.nextSkill).toBe((skillIndex + 1) % 3)
  })

  it('uses factions, not player identity, and damages a large victim only once', () => {
    const { eng, w, boss, player } = arena()
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: 35, y: 35 }))
    const victim = w.author(() => w.add({ ...createBoss('lust', { map: 'arena', x: 16, y: 21 }, 'folk.guard'), ai: undefined, tags: ['faction:folk'] }))
    boss.boss!.nextSkill = 1
    stepBosses(eng, 'arena')
    const pending = boss.boss!.pending!
    expect(pending.target).toBe(victim.id)
    w.state.tick = pending.releaseAt
    stepBosses(eng, 'arena')
    expect(w.fx.filter((f) => f.t === 'damage' && f.who === victim.id)).toHaveLength(1)
    expect(w.num(victim, 'hp')).toBe(BOSS_BY_ID.lust.hp - BOSS_BY_ID.pride.skills[1].damage + BOSS_BY_ID.lust.defense)
    expect(w.num(player, 'hp')).toBe(1000)
  })

  it('never casts out of range while movement is cooling down; second phase shortens warning', () => {
    const { eng, w, boss, player } = arena()
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: 16, y: 24 }))
    eng.setCooldown(boss.id, 30)
    stepBosses(eng, 'arena')
    expect(boss.boss!.pending).toBeUndefined()
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: 16, y: 20 }))
    ;(boss.props ??= {}).hp = 50
    stepBosses(eng, 'arena')
    expect(boss.boss!.phase).toBe(2)
    expect(boss.boss!.pending!.releaseAt - w.state.tick).toBe(Math.round(BOSS_BY_ID.pride.skills[0].windup * 0.8))
    expect(snapshot(eng).entities.find((e) => e.id === boss.id)!.hostile).toBe(true)
  })

  it('slows movement without slowing attacks, and preserves locked casts through saves', () => {
    const { game, index, eng, w, boss, player, map, ticks } = arena()
    const base = combatDelay(w, player, 4, 'move')
    eng.author(() => eng.applyStatus({ e: player.id }, 'mired'))
    expect(combatDelay(w, player, 4, 'move')).toBeGreaterThan(base)
    expect(combatDelay(w, player, 5, 'attack')).toBe(5)
    ticks(1)
    const saved = structuredClone(game.save())
    const loaded = Game.load(saved, index, onto, library())
    loaded.loadMapData(map)
    expect(loaded.engine.world.get(boss.id)?.boss).toEqual(boss.boss)
    const n = boss.boss!.pending!.releaseAt - w.state.tick
    ticks(n)
    for (let i = 0; i < n; i++) loaded.engine.tick()
    expect(loaded.engine.world.num(loaded.engine.world.player, 'hp')).toBe(w.num(player, 'hp'))
    expect(loaded.engine.world.get(boss.id)?.boss).toEqual(boss.boss)
  })

  it('makes awakening hit harder and recover sooner, while retaining the locked warning', () => {
    const { eng, w, boss, player, ticks } = arena()
    boss.props = { hp: BOSS_BY_ID.pride.hp * 0.4 }
    boss.boss!.nextSkill = 1
    ticks(1)
    const pending = structuredClone(boss.boss!.pending!)
    const skill = BOSS_BY_ID.pride.skills[1]
    expect(pending.releaseAt - w.state.tick).toBe(Math.round(skill.windup * 0.8))
    expect(snapshot(eng).entities.find((e) => e.id === boss.id)!.boss!.enrageAt).toBe(0.5)
    ticks(pending.releaseAt - w.state.tick)
    expect(w.num(player, 'hp')).toBe(1000 - Math.round(skill.damage * 1.35))
    expect(boss.boss!.nextAt! - w.state.tick).toBe(Math.round(skill.recovery * 0.65))
  })

  it('routes a wide body around an obstacle instead of clipping its side or getting stuck', () => {
    const { eng, w, boss, player, ticks } = arena()
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: 16, y: 24 }))
    for (let x = 14; x <= 18; x++) w.author(() => w.setTerrain('arena', x, 17, 'wall'))
    stepBosses(eng, 'arena')
    expect(boss.ai!.detour?.path.length).toBeGreaterThan(0)
    for (let i = 0; i < 100 && !boss.boss!.pending; i++) {
      ticks(1)
      const at = w.posOf(boss)!
      expect(w.fits(boss, at.map, at.x, at.y)).toBe(true)
    }
    expect(boss.boss!.pending).toBeDefined()
  })

  it('pulls before applying entrancement, and returns home after losing its foe', () => {
    const { eng, w, boss, player, ticks } = arena('lust')
    boss.boss!.nextSkill = 1
    ticks(1)
    const release = boss.boss!.pending!.releaseAt
    ticks(release - w.state.tick)
    expect(w.posOf(player)?.y).toBe(19)
    expect(eng.busy(player)).toBe(true)
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: 36, y: 36 }))
    w.author(() => w.place(boss, { on: 'tile', map: 'arena', x: 22, y: 20 }))
    ticks(120)
    expect(boss.boss!.pending).toBeUndefined()
    const at = w.posOf(boss)!, home = boss.ai!.home
    expect(Math.abs(at.x - home.x) + Math.abs(at.y - home.y)).toBeLessThanOrEqual(1)
  })

  it('cancels defeated casts, grants loot once, plays death, then removes the body', () => {
    const { eng, w, boss, player, ticks } = arena()
    ticks(1)
    eng.damage(boss, 10000, undefined, true, { e: player.id })
    expect(w.fact('sins.defeated.pride')).toBe(1)
    expect(boss.statuses?.down).toBeDefined()
    const loot = () => w.entitiesOnMap('arena').filter((e) => e.type === 'item/material/iron_ore').length
    expect(loot()).toBe(4)
    const xp = w.num(player, 'xp')
    eng.damage(boss, 10000, undefined, true, { e: player.id })
    expect(w.num(player, 'xp')).toBe(xp)
    expect(loot()).toBe(4)
    ticks(1)
    expect(boss.boss!.action).toBe('death')
    expect(boss.boss!.pending).toBeUndefined()
    expect(snapshot(eng).entities.find((e) => e.id === boss.id)!.boss!.action).toBe('death')
    ticks(20)
    expect(w.get(boss.id)).toBeUndefined()
    expect(w.actorAt('arena', 16, 16)).toBeUndefined()
  })
})

describe('Alberic visual timing and locked effects', () => {
  it.each([1, 2])('keeps the bow drawn until release in phase %s and preserves the animation through saves', (phase) => {
    const { game, index, map, eng, w, boss, ticks } = arena('alberic')
    if (phase === 2) boss.props = { hp: BOSS_BY_ID.alberic.hp * 0.4 }
    boss.boss!.nextSkill = 1
    ticks(1)
    const snap = () => snapshot(eng).entities.find((e) => e.id === boss.id)!.boss!
    const pending = boss.boss!.pending!
    expect(snap().skill).toBe('volley')
    expect(bossAnimationFrame(snap(), 0, 0, 'up')).toEqual({ col: 0, row: 18 })
    ticks(pending.releaseAt - w.state.tick - 1)
    expect(snap().progress).toBeLessThan(0.5)
    expect(bossAnimationFrame(snap(), 0).col).toBe(15)
    expect(bossAnimationFrame(snap(), 0).col).toBeLessThan(16)
    const loaded = Game.load(structuredClone(game.save()), index, onto, library())
    loaded.loadMapData(map)
    expect(snapshot(loaded.engine).entities.find((e) => e.id === boss.id)!.boss).toEqual(snap())
    ticks(1)
    expect(snap().skill).toBe('volley')
    expect(snap().warning).toBeUndefined()
    expect(bossAnimationFrame(snap(), 0)).toEqual({ col: 16, row: 4 })
    const afterRelease = Game.load(structuredClone(game.save()), index, onto, library())
    afterRelease.loadMapData(map)
    expect(snapshot(afterRelease.engine).entities.find((e) => e.id === boss.id)!.boss!.skill).toBe('volley')
  })

  it('places thorns only on the advertised ring, never in its safe interior', () => {
    const { eng, w, boss, ticks } = arena('alberic')
    boss.boss!.nextSkill = 2
    ticks(1)
    const pending = structuredClone(boss.boss!.pending!)
    ticks(pending.releaseAt - w.state.tick)
    const effects = w.fx.filter((f) => f.t === 'vfx').filter((f) => f.fx === 'sin:alberic:thorns')
    expect(effects.map((f) => [f.x, f.y])).toEqual(pending.tiles)
    expect(effects.every((f) => Math.max(Math.abs(f.x - pending.origin.x), Math.abs(f.y - pending.origin.y)) === 4)).toBe(true)
    expect(snapshot(eng).entities.find((e) => e.id === boss.id)!.boss!.skill).toBe('thorns')
  })

  it.each([[4, 0, 0], [-4, 0, 180], [0, 4, 90], [0, -4, -90]])('aims the beam along the locked direction (%s,%s)', (dx, dy, angle) => {
    const { eng, w, boss, player, ticks } = arena('alberic')
    const origin = w.posOf(boss)!
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: origin.x + dx, y: origin.y + dy }))
    ticks(1)
    const pending = structuredClone(boss.boss!.pending!)
    // Moving after the tell must not rotate the eventual shot.
    w.author(() => w.place(player, { on: 'tile', map: 'arena', x: origin.x + 5, y: origin.y + 5 }))
    ticks(pending.releaseAt - w.state.tick)
    const effects = w.fx.filter((f) => f.t === 'vfx' && f.fx === 'sin:alberic:arrow')
    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({ angle, span: 8, x: origin.x + Math.sign(dx) * 4.5, y: origin.y + Math.sign(dy) * 4.5 })
    expect(w.num(player, 'hp')).toBe(1000)
    expect(snapshot(eng).entities.find((e) => e.id === boss.id)!.boss!.skill).toBe('arrow')
  })

  it('plays the twelve-pose death at 10 fps and holds it until the original despawn tick', () => {
    const { eng, w, boss, player, ticks } = arena('alberic')
    ticks(1)
    eng.damage(boss, 10000, undefined, true, { e: player.id })
    ticks(1)
    const pose = () => bossAnimationFrame(snapshot(eng).entities.find((e) => e.id === boss.id)!.boss!, 0)
    expect(pose()).toEqual({ row: 6, col: 0 })
    for (const col of [12, 24, 31]) { ticks(4); expect(pose()).toEqual({ row: 6, col }) }
    ticks(4)
    expect(pose()).toEqual({ row: 6, col: 31 })
    ticks(4)
    expect(w.get(boss.id)).toBeUndefined()
  })
})

describe('boss encounter assets and compatibility', () => {
  it('ships 732 body frames and 54 skill-effect frames, all as RGBA PNGs', () => {
    expect(Object.values(SIN_ACTORS).reduce((n, a) => n + a.cols! * a.rows!, 0)).toBe(732)
    expect(Object.values(SIN_FX).reduce((n, f) => n + f.frames, 0)).toBe(54)
    for (const b of BOSSES) {
      const actor = SIN_ACTORS[`boss:sin:${b.id}`], cell = b.id === 'envy' ? 32 : b.id === 'alberic' ? 128 : 96
      expect(actor.scale).toBeGreaterThanOrEqual(b.id === 'envy' || b.id === 'alberic' ? 1.25 : 1.75)
      const files = [[`${actor.dir}/${actor.sheet}`, cell * actor.cols!, cell * actor.rows!], ...b.skills.map((s) => {
        const fx = SIN_FX[s.fx]
        return [fx.img, fx.fw * fx.frames, fx.fh]
      })] as [string, number, number][]
      for (const [path, width, height] of files) {
        const bytes = readFileSync(new URL(`../../public/assets/${path}`, import.meta.url))
        expect(bytes.readUInt32BE(16), path).toBe(width)
        expect(bytes.readUInt32BE(20), path).toBe(height)
        expect(bytes[25], path).toBe(6)
        expect(bytes.length).toBeGreaterThan(500)
      }
    }
  })

  it('clears the removed kits\' bodies from an older save, once, without touching its progress', () => {
    const { index } = buildFord(), game = Game.create(index, onto, library()), w = game.engine.world
    const map: MapData = { id: 'arena', name: 'Arena', kind: 'wild', width: 40, height: 40, terrain: Array(1600).fill('grass'), portals: [], light: 'indoor' }
    game.loadChunk({ map, entities: [createBoss('pride', { map: 'arena', x: 16, y: 16 })] })
    // a body of the removed Gilt Tollkeeper, as an older save holds it
    w.author(() => w.add({ id: 'eastroad.sin.greed', type: 'actor/creature/sin/greed', place: { on: 'tile', map: 'arena', x: 30, y: 30 }, props: { hp: 700 } }))
    ;(w.player.props ??= {}).quest = 6
    w.author(() => w.setFact('mq.smith', 3))
    game.engine.author(() => migrateBosses(game))
    expect(w.get('eastroad.sin.greed')).toBeUndefined()
    expect(w.get('sin.pride')).toBeDefined()
    expect(w.fact(BOSS_LAYOUT)).toBe(true)
    const state = structuredClone(w.state)
    game.engine.author(() => migrateBosses(game))
    expect(w.state).toEqual(state)
    expect(w.num(w.player, 'quest')).toBe(6)
    expect(w.fact('mq.smith')).toBe(3)
  })
})
