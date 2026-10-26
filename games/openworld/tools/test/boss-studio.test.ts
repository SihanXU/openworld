// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { describe, expect, it, vi } from 'vitest'
import { snapshot, type EntitySnap } from '@openworld/engine'
import { castNow, kitsOf } from '@openworld/modules'
import { BOSS_ARENA } from '@openworld-game/content'
import { createBossStudio } from '../../client/src/boss-studio.ts'
import { createBossChallenge } from '../../client/src/boss-challenge.ts'
import { previewBoss, type BossPreviewMode } from '@openworld/runtime/src/boss-preview.ts'
import { WorldScene } from '@openworld/runtime/src/render/scene.ts'
import { BossAnimationClock } from '@openworld/runtime/src/render/boss-animation.ts'
import { ALBERIC_CLIPS, SIN_ACTORS } from '@openworld/runtime/src/assets/bosses.ts'
import { buildFord } from '../src/demo/world.ts'

// Exercise the actual scene frame-selection branches, with only Phaser's browser base mocked.
vi.mock('phaser', () => ({ default: { Scene: class {} } }))

const { index, chunks } = buildFord()
const raw = chunks.find((c) => c.map.id === BOSS_ARENA.map)!
const actor = SIN_ACTORS['boss:sin:alberic']!
const key = 'cre:boss:sin:alberic'
const factories = [
  { name: 'studio', create: createBossStudio },
  { name: 'challenge', create: (settings: typeof index, map: typeof raw, boss: string) => createBossChallenge(settings, map, 'assassin', boss) },
]

function renderedScene(entity: EntitySnap, bossAnimation?: BossAnimationClock) {
  const body = { texture: { key: `${actor.dir}/${actor.sheet}` },
    setFrame: vi.fn().mockReturnThis(), setTexture: vi.fn().mockReturnThis(), setFlipX: vi.fn().mockReturnThis() }
  body.setTexture.mockImplementation((img: string) => { body.texture.key = img; return body })
  const scene = new WorldScene()
  Object.assign(scene, { drawWeather: vi.fn(), views: new Map([[entity.id, {
    snap: entity, body, actor: { ...actor, key }, phase: 0, movingUntil: 0, bossAnimation,
  }]]) })
  return { scene, body, frame: (time: number) => {
    scene.update(time)
    return body.setTexture.mock.calls.at(-1)![1] as string
  } }
}

function renderedFrame(entity: EntitySnap, time = 0, bossAnimation?: BossAnimationClock): string {
  return renderedScene(entity, bossAnimation).frame(time)
}

const modes: BossPreviewMode[] = ['idle', 'walk', 'attack', 'cast', 'volley', 'hurt', 'death']
const attackMode = (mode: BossPreviewMode) => mode === 'attack' || mode === 'cast' || mode === 'volley'

describe.each(factories)('$name bootstrap', ({ create }) => {
  it('shows the boss as a boss before its first tick: its fight is its type\'s, whatever the world\'s index holds', () => {
    const before = JSON.stringify({ index, raw })
    const game = create(index, raw, 'alberic')
    const boss = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    expect(boss.boss).toMatchObject({ kit: 'alberic', action: 'idle', seal: 1, phases: 2, thresholds: [0.5] })
    expect(JSON.stringify({ index, raw })).toBe(before)
  })
})

describe('Boss Studio actions reach the rendered sprite', () => {
  it.each(modes)('renders %s from separate delivery strips without combat extrapolation or extra mirroring', (mode) => {
    const game = createBossStudio(index, raw, 'alberic')
    game.engine.tick()
    const e = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    expect(e.boss!.warning).toBeDefined()
    const before = JSON.stringify(e)
    const clock = new BossAnimationClock()
    clock.receive(e.boss!, 0)
    const elapsed = vi.spyOn(clock, 'elapsed'), progress = vi.spyOn(clock, 'progress')
    const { scene, frame, body } = renderedScene(e, clock)
    for (const facing of ['down', 'right', 'up', 'left'] as const) {
      e.facing = facing
      scene.setBossPreview(e.id, mode)
      const id = attackMode(mode) ? facing === 'left' ? 'attack_left' : facing === 'right' ? 'attack_right' : 'attack_down' : 'idle'
      const clip = ALBERIC_CLIPS[id], staticPose = mode === 'hurt' || mode === 'death'
      const ms = clip.frame_ms, duration = clip.frames * ms
      // A stale combat sample and a delayed first render must not skip the first pose.
      expect(frame(10000)).toBe(`${key}:${id}:0`)
      for (let i = 0; i < clip.frames; i++) {
        for (const within of [0.5, ms - 0.5]) {
          expect(frame(10000 + i * ms + within)).toBe(`${key}:${id}:${staticPose ? 0 : i}`)
          expect(body.setTexture.mock.calls.at(-1)![0]).toBe(`${actor.dir}/${clip.sheet}`)
          expect(body.setFlipX.mock.calls.at(-1)![0]).toBe(false)
        }
      }
      expect(frame(10000 + duration)).toBe(`${key}:${id}:0`)
      expect(frame(10000 + duration * 50)).toBe(`${key}:${id}:0`)
      scene.setBossPreview(e.id, mode)
      expect(frame(99999)).toBe(`${key}:${id}:0`)
    }
    e.facing = 'down'
    expect(elapsed).not.toHaveBeenCalled()
    expect(progress).not.toHaveBeenCalled()
    expect(JSON.stringify(e)).toBe(before)
    scene.setBossPreview(e.id, 'live')
    expect(frame(99999)).toBe(`${key}:attack_down:0`)
  })

  it('keeps an attack on its render timeline when changing direction, including the frontal final frame', () => {
    const game = createBossStudio(index, raw, 'alberic')
    const e = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    const { scene, frame, body } = renderedScene(e)
    e.facing = 'right'
    scene.setBossPreview(e.id, 'attack')
    expect(frame(1000)).toBe(`${key}:attack_right:0`)
    e.facing = 'left'
    expect(frame(1400)).toBe(`${key}:attack_left:5`)
    expect(body.texture.key).toBe(`${actor.dir}/attack_left.png`)
    // Portraits always resolve a registered resting frame, even while the world sprite
    // has switched to a different directional texture with no base-atlas frame names.
    expect(scene.lookOf(e.id)).toEqual({ img: `${actor.dir}/idle.png`, frame: `${key}:idle:0` })
    expect(frame(1720)).toBe(`${key}:attack_left:9`)
    expect(body.setFlipX.mock.calls.at(-1)![0]).toBe(false)
    e.facing = 'up'
    expect(frame(1721)).toBe(`${key}:attack_down:9`)
  })

  it.each(['arrow', 'volley', 'thorns'])(
    'holds real skill %s before its hit and starts frame five at the authoritative release', (skill) => {
      const game = createBossStudio(index, raw, 'alberic')
      const w = game.engine.world, boss = w.get(BOSS_ARENA.id)!
      castNow(game.engine, boss, skill)
      const windup = kitsOf(game.engine).pending.get(boss.id)!.releaseAt - w.state.tick
      const clock = new BossAnimationClock(), clip = ALBERIC_CLIPS.attack_down
      for (let tick = 0; tick < windup; tick++) {
        if (tick) game.engine.tick()
        const e = snapshot(game.engine).entities.find((entity) => entity.id === boss.id)!
        e.facing = 'down'
        expect(e.boss!.animationElapsedMs).toBe(tick * 100)
        expect(e.boss!.warning).toBeDefined()
        clock.receive(e.boss!, tick * 100)
        for (const subframe of [0, 79, 80, 99]) {
          const time = tick * 100 + subframe
          expect(renderedFrame(e, time, clock)).toBe(
            `${key}:attack_down:${Math.min(clip.hit_frame - 1, Math.floor(time / clip.frame_ms))}`)
        }
      }
      game.engine.tick()
      const e = snapshot(game.engine).entities.find((entity) => entity.id === boss.id)!
      e.facing = 'down'
      expect(e.boss!.warning).toBeUndefined()
      expect(e.boss!.animationElapsedMs).toBe(0)
      clock.receive(e.boss!, windup * 100)
      expect(renderedFrame(e, windup * 100, clock)).toBe(`${key}:attack_down:5`)
      expect(renderedFrame(e, windup * 100 + clip.frame_ms, clock)).toBe(`${key}:attack_down:6`)
    })

  it('draws intermediate 80 ms poses on the real scene path between 10 Hz snapshots', () => {
    const game = createBossStudio(index, raw, 'alberic')
    const e = snapshot(game.engine).entities.find((e) => e.id === BOSS_ARENA.id)!
    const clock = new BossAnimationClock()
    previewBoss(e, 'attack', 0)
    clock.receive(e.boss!, 0)
    expect(renderedFrame(e, 79, clock)).toBe(`${key}:attack_down:0`)
    expect(renderedFrame(e, 80, clock)).toBe(`${key}:attack_down:1`)
    previewBoss(e, 'attack', 100)
    clock.receive(e.boss!, 100)
    expect(renderedFrame(e, 159, clock)).toBe(`${key}:attack_down:1`)
    expect(renderedFrame(e, 160, clock)).toBe(`${key}:attack_down:2`)
    expect(e.boss!.progress).toBe(0.125)
  })

  it('switches away from a real pending cast without mutating the encounter or saved skill', () => {
    const game = createBossStudio(index, raw, 'alberic')
    const w = game.engine.world, boss = w.get(BOSS_ARENA.id)!
    game.engine.tick()
    expect(kitsOf(game.engine).pending.get(boss.id)).toBeDefined()
    const engineState = JSON.stringify(boss), tick = w.state.tick
    for (const mode of modes) for (const facing of ['down', 'right', 'up', 'left'] as const) {
      const e = snapshot(game.engine).entities.find((e) => e.id === boss.id)!
      e.facing = facing
      previewBoss(e, mode, 0)
      const id = attackMode(mode) ? facing === 'left' ? 'attack_left' : facing === 'right' ? 'attack_right' : 'attack_down' : 'idle'
      expect(renderedFrame(e)).toBe(`${key}:${id}:0`)
      expect(e.boss!.warning).toBeUndefined()
    }
    expect(w.state.tick).toBe(tick)
    expect(JSON.stringify(boss)).toBe(engineState)
    const live = snapshot(game.engine).entities.find((e) => e.id === boss.id)!
    previewBoss(live, 'live', 0)
    expect(live.boss!.action).toBe('cast')
    expect(live.boss!.warning).toBeDefined()
    expect(renderedFrame(live)).toBe(`${key}:attack_down:0`)
  })
})
