import { describe, expect, it, vi } from 'vitest'
import { snapshot, type EntitySnap } from '@lsw/engine'
import { BOSSES, BOSS_ARENA } from '@lsw/content'
import { createBossStudio } from '../../client/src/boss-studio.ts'
import { createBossChallenge } from '../../client/src/boss-challenge.ts'
import { previewBoss } from '../../client/src/boss-preview.ts'
import { WorldScene } from '../../client/src/render/scene.ts'
import { BossAnimationClock } from '../../client/src/render/boss-animation.ts'
import { ALBERIC_CLIPS } from '../../client/src/assets/bosses.ts'
import { buildFord } from '../src/demo/world.ts'

// Exercise the actual scene frame-selection branches, with only Phaser's browser base mocked.
vi.mock('phaser', () => ({ default: { Scene: class {} } }))

const { index, chunks } = buildFord()
const raw = chunks.find((c) => c.map.id === BOSS_ARENA.map)!
const factories = [
  { name: 'studio', create: createBossStudio },
  { name: 'challenge', create: (settings: typeof index, map: typeof raw, boss: string) => createBossChallenge(settings, map, 'assassin', boss) },
]

function renderedScene(entity: EntitySnap, bossAnimation?: BossAnimationClock) {
  const body = { setFrame: vi.fn().mockReturnThis(), setFlipX: vi.fn().mockReturnThis() }
  const scene = new WorldScene()
  Object.assign(scene, { drawWeather: vi.fn(), views: new Map([[entity.id, {
    snap: entity, body, actor: { key: 'cre:boss:sin:alberic', rows: 21, cols: 32 }, phase: 0, movingUntil: 0, bossAnimation,
  }]]) })
  return { scene, frame: (time: number) => {
    scene.update(time)
    return body.setFrame.mock.calls.at(-1)![0] as string
  } }
}

function renderedFrame(entity: EntitySnap, time = 0, bossAnimation?: BossAnimationClock): string {
  return renderedScene(entity, bossAnimation).frame(time)
}

describe.each(factories)('$name bootstrap with outdated generated world data', ({ create }) => {
  it.each(['missing', 'old', 'outdated-skill'] as const)('loads current boss definitions when index.bosses is %s', (version) => {
    const stale = structuredClone(index)
    if (version === 'missing') delete stale.bosses
    else if (version === 'old') stale.bosses = stale.bosses!.filter((b) => b.id !== 'alberic')
    else stale.bosses!.find((b) => b.id === 'alberic')!.skills[0].id = 'obsolete'
    const before = JSON.stringify({ stale, raw })
    const game = create(stale, raw, 'alberic')
    expect(game.engine.bossKits.alberic).toEqual(BOSSES.find((b) => b.id === 'alberic'))
    const boss = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    expect(boss.boss).toMatchObject({ kit: 'alberic', action: 'idle' })
    expect(JSON.stringify({ stale, raw })).toBe(before)
    expect(game.engine.bossKits.alberic).not.toBe(BOSSES.find((b) => b.id === 'alberic'))
  })
})

describe('Boss Studio actions reach the rendered sprite', () => {
  it.each([
    ['idle', 'idle', 0], ['walk', 'walk', 1], ['attack', 'thorns', 2], ['cast', 'arrow', 3],
    ['volley', 'volley', 4], ['hurt', 'hurt', 5], ['death', 'death', 6],
  ] as const)('renders the isolated %s clip without combat extrapolation or repeated snapshots', (mode, id, row) => {
    const game = createBossStudio(index, raw, 'alberic')
    game.engine.tick()
    const e = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    expect(e.boss!.warning).toBeDefined()
    const before = JSON.stringify(e), clip = ALBERIC_CLIPS[id], duration = clip.length * 50
    const clock = new BossAnimationClock()
    clock.receive(e.boss!, 0)
    const elapsed = vi.spyOn(clock, 'elapsed'), progress = vi.spyOn(clock, 'progress')
    const { scene, frame } = renderedScene(e, clock)
    for (const [facing, base] of [['down', 0], ['right', 7], ['up', 14], ['left', 7]] as const) {
      e.facing = facing
      scene.setBossPreview(e.id, mode)
      // A stale combat sample and a delayed first render must not skip the first pose.
      expect(frame(10000)).toBe(`cre:boss:sin:alberic:0,${row + base}`)
      for (let i = 0; i < clip.length; i++) {
        for (const within of [0, 49])
          expect(frame(10000 + i * 50 + within)).toBe(`cre:boss:sin:alberic:${clip[i]},${row + base}`)
      }
      expect(frame(10000 + duration)).toBe(`cre:boss:sin:alberic:${mode === 'death' ? 31 : 0},${row + base}`)
      expect(frame(10000 + duration * 50)).toBe(`cre:boss:sin:alberic:${mode === 'death' ? 31 : 0},${row + base}`)
      // Clicking the selected action again restarts a held death as well as a loop.
      scene.setBossPreview(e.id, mode)
      expect(frame(99999)).toBe(`cre:boss:sin:alberic:0,${row + base}`)
    }
    e.facing = 'down'
    expect(elapsed).not.toHaveBeenCalled()
    expect(progress).not.toHaveBeenCalled()
    expect(JSON.stringify(e)).toBe(before)
    scene.setBossPreview(e.id, 'live')
    // The untouched encounter is still winding up its arrow, not the selected preview action.
    expect(frame(99999)).toBe('cre:boss:sin:alberic:0,3')
  })

  it('keeps a preview on its render timeline when changing facing', () => {
    const game = createBossStudio(index, raw, 'alberic')
    const e = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    const { scene, frame } = renderedScene(e)
    scene.setBossPreview(e.id, 'walk')
    expect(frame(1000)).toBe('cre:boss:sin:alberic:0,1')
    e.facing = 'up'
    expect(frame(1250)).toBe('cre:boss:sin:alberic:16,15')
  })

  it.each([[0, 'arrow', 3], [1, 'volley', 4], [2, 'thorns', 2]] as const)(
    'plays real skill %s at 20 fps, holds its tell, then restarts recovery at the hit', (skill, id, row) => {
      const game = createBossStudio(index, raw, 'alberic')
      const w = game.engine.world, boss = w.get(BOSS_ARENA.id)!
      boss.boss!.nextSkill = skill
      game.engine.tick()
      const windup = boss.boss!.pending!.releaseAt - w.state.tick
      const clock = new BossAnimationClock(), clip = ALBERIC_CLIPS[id]
      for (let tick = 0; tick < windup; tick++) {
        if (tick) game.engine.tick()
        const e = snapshot(game.engine).entities.find((entity) => entity.id === boss.id)!
        e.facing = 'down'
        expect(e.boss!.animationElapsedMs).toBe(tick * 100)
        expect(e.boss!.warning).toBeDefined()
        clock.receive(e.boss!, tick * 100)
        for (const subframe of [0, 49, 50, 99]) {
          const time = tick * 100 + subframe
          expect(renderedFrame(e, time, clock)).toBe(
            `cre:boss:sin:alberic:${clip[Math.min(5, Math.floor(time / 50))]},${row}`)
        }
      }
      game.engine.tick()
      const e = snapshot(game.engine).entities.find((entity) => entity.id === boss.id)!
      e.facing = 'down'
      expect(e.boss!.warning).toBeUndefined()
      expect(e.boss!.animationElapsedMs).toBe(0)
      clock.receive(e.boss!, windup * 100)
      expect(renderedFrame(e, windup * 100, clock)).toBe(`cre:boss:sin:alberic:16,${row}`)
      expect(renderedFrame(e, windup * 100 + 50, clock)).toBe(`cre:boss:sin:alberic:19,${row}`)
    })

  it('draws sub-tick intermediate poses on the real scene update path', () => {
    const game = createBossStudio(index, raw, 'alberic')
    const e = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    const clock = new BossAnimationClock()
    previewBoss(e, 'hurt', 0)
    clock.receive(e.boss!, 0)
    previewBoss(e, 'hurt', 100)
    clock.receive(e.boss!, 100)
    expect(renderedFrame(e, 100, clock)).toBe('cre:boss:sin:alberic:8,5')
    expect(renderedFrame(e, 149, clock)).toBe('cre:boss:sin:alberic:8,5')
    expect(renderedFrame(e, 150, clock)).toBe('cre:boss:sin:alberic:12,5')
    expect(e.boss!.progress).toBe(0.25)
  })

  it('switches from a real pending cast to every selected action despite an old world index', () => {
    const stale = structuredClone(index)
    stale.bosses = stale.bosses!.filter((b) => b.id !== 'alberic')
    const game = createBossStudio(stale, raw, 'alberic')
    const w = game.engine.world, boss = w.get(BOSS_ARENA.id)!
    game.engine.tick()
    expect(boss.boss!.pending).toBeDefined()
    const engineState = JSON.stringify(boss), tick = w.state.tick
    for (const [mode, row] of [
      ['idle', 0], ['walk', 1], ['attack', 2], ['cast', 3], ['volley', 4], ['hurt', 5], ['death', 6],
    ] as const) {
      for (const [facing, base] of [['down', 0], ['right', 7], ['up', 14], ['left', 7]] as const) {
        const e = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
        e.facing = facing
        previewBoss(e, mode, 0)
        expect(renderedFrame(e)).toBe(`cre:boss:sin:alberic:0,${base + row}`)
        expect(e.boss!.warning).toBeUndefined()
        if (mode === 'idle') {
          expect(ALBERIC_CLIPS.idle.map((_, i) => {
            previewBoss(e, mode, i * 50)
            return renderedFrame(e, i * 50)
          })).toEqual(ALBERIC_CLIPS.idle.map((col) => `cre:boss:sin:alberic:${col},${base}`))
        }
      }
    }
    expect(w.state.tick).toBe(tick)
    expect(JSON.stringify(boss)).toBe(engineState)
    const live = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    previewBoss(live, 'live', 0)
    expect(live.boss!.action).toBe('cast')
    expect(live.boss!.warning).toBeDefined()
    expect(renderedFrame(live)).toBe('cre:boss:sin:alberic:0,3')
  })
})
