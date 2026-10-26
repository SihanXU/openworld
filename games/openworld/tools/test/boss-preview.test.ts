// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EntitySnap } from '@openworld/engine'
import { bossPreviewMode, bossPreviewModes, previewBoss } from '@openworld/runtime/src/boss-preview.ts'
import { bossAnimationFrame } from '@openworld/runtime/src/render/boss-animation.ts'
import { ALBERIC_CLIPS } from '@openworld/runtime/src/assets/bosses.ts'

const entity = (kit = 'alberic'): EntitySnap => ({
  id: 'test.boss', type: 'actor/creature/sin/alberic', sprite: 'boss:sin:alberic', x: 10, y: 10,
  name: 'White Knight', tags: ['agent'], statuses: [], facing: 'down',
  boss: { kit, phase: 1, color: 0xf2ead2, footprint: [3, 2], enrageAt: 0.5,
    action: 'attack', skill: 'thorns', progress: 0.4,
    warning: { name: 'Thorns', tiles: [[10, 14]], progress: 0.8 } },
})

describe('Boss Studio direct action controls', () => {
  it('shows the delivered cadence and explicitly labels borrowed and missing actions', () => {
    const modes = bossPreviewModes('alberic')
    expect(modes.map((m) => m.value)).toEqual(['live', 'idle', 'walk', 'attack', 'cast', 'volley', 'hurt', 'death'])
    expect(modes.find((m) => m.value === 'idle')!.label).toContain('8 帧 · 150 ms/帧')
    expect(modes.find((m) => m.value === 'attack')!.label).toContain('10 帧 · 80 ms/帧')
    expect(modes.find((m) => m.value === 'walk')!.label).toContain('借用待机')
    for (const value of ['cast', 'volley']) expect(modes.find((m) => m.value === value)!.label).toContain('借用攻击')
    for (const value of ['hurt', 'death']) expect(modes.find((m) => m.value === value)!.label).toContain('待机静帧回退')
    const html = readFileSync(new URL('../../client/boss-gallery.html', import.meta.url), 'utf8')
    expect(html).toContain('id="modeSelect" class="studio-modes" role="group"')
    expect(html).not.toContain('<select id="modeSelect"')
    const css = readFileSync(new URL('../../client/src/boss-gallery.css', import.meta.url), 'utf8')
    expect(css).toContain('button[aria-pressed="true"]')
    expect(css).toContain('.studio-modes button:focus-visible')
  })

  it('keeps the selected action when valid and falls back when switching to another kit', () => {
    for (const { value } of bossPreviewModes('alberic')) expect(bossPreviewMode(value, 'alberic')).toBe(value)
    expect(bossPreviewMode('volley', 'pride')).toBe('live')
    expect(bossPreviewMode('unknown', 'alberic')).toBe('live')
    for (const kit of ['lust', 'envy', 'pride']) {
      expect(bossPreviewModes(kit).map((m) => m.value)).not.toContain('volley')
      expect(bossPreviewModes(kit).find((m) => m.value === 'death')!.label).toContain('2 帧')
    }
  })

  it.each([
    ['idle', 'idle'], ['walk', 'idle'], ['attack', 'attack_down'], ['cast', 'attack_down'],
    ['volley', 'attack_down'], ['hurt', 'idle'], ['death', 'idle'],
  ] as const)('immediately applies %s to the render snapshot instead of the pending combat action', (mode, clip) => {
    const original = entity(), frameEntity = structuredClone(original)
    previewBoss(frameEntity, mode, 0)
    expect(frameEntity.boss!.progress).toBe(0)
    expect(frameEntity.boss!.warning).toBeUndefined()
    expect(bossAnimationFrame(frameEntity.boss!, 0)).toEqual({ col: 0, row: 0, clip, flipX: false })
    expect(original.boss!.action).toBe('attack')
    expect(original.boss!.warning).toBeDefined()
    expect(original.boss!.progress).toBe(0.4)
  })

  it('restarts an 800 ms attack exactly and uses a fixed frontal pose for absent hurt/death sheets', () => {
    const e = entity()
    for (const [ms, col] of [[0, 0], [399, 4], [400, 5], [719, 8], [720, 9], [799, 9], [800, 0]]) {
      previewBoss(e, 'cast', ms)
      expect(bossAnimationFrame(e.boss!, 99999)).toEqual({ row: 0, col, clip: 'attack_down', flipX: false })
    }
    for (const mode of ['hurt', 'death'] as const) for (const ms of [0, 80, 800, 30000]) {
      previewBoss(e, mode, ms)
      expect(bossAnimationFrame(e.boss!, ms)).toEqual({ row: 0, col: 0, clip: 'idle', flipX: false })
    }
  })

  it('returns to the real encounter untouched in live mode and tolerates missing actors', () => {
    const e = entity(), before = structuredClone(e)
    previewBoss(e, 'live', 1000)
    expect(e).toEqual(before)
    expect(() => previewBoss(undefined, 'death', 100)).not.toThrow()
  })

  it.each(['idle', 'walk', 'attack', 'cast', 'volley'] as const)(
    'shows every delivered %s frame at its own pace at 20, 60 and 144 Hz', (mode) => {
      const e = entity(), loops = mode === 'idle' || mode === 'walk'
      const clip = loops ? ALBERIC_CLIPS.idle : ALBERIC_CLIPS.attack_down
      const ms = clip.frame_ms, duration = clip.frames * ms, indices = Array.from({ length: clip.frames }, (_, i) => i)
      for (const fps of [20, 60, 144]) {
        const frames = new Set<number>()
        for (let i = 0; i * 1000 / fps < duration; i++) {
          const time = i * 1000 / fps
          previewBoss(e, mode, time)
          frames.add(bossAnimationFrame(e.boss!, time).col)
        }
        expect([...frames]).toEqual(indices)
      }
      for (let i = 0; i < clip.frames; i++) for (const time of [i * ms + 1, (i + 1) * ms - 1]) {
        previewBoss(e, mode, time)
        expect(bossAnimationFrame(e.boss!, loops ? time : 99999).col).toBe(i)
      }
    })
})
