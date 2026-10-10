// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EntitySnap } from '@openworld/engine'
import { bossPreviewMode, bossPreviewModes, previewBoss } from '@openworld/runtime/src/boss-preview.ts'
import { bossAnimationFrame } from '@openworld/runtime/src/render/boss-animation.ts'
import { ALBERIC_CLIPS, albericFrameMs } from '@openworld/runtime/src/assets/bosses.ts'

const entity = (kit = 'alberic'): EntitySnap => ({
  id: 'test.boss', type: 'actor/creature/sin/alberic', sprite: 'boss:sin:alberic', x: 10, y: 10,
  name: 'White Knight', tags: ['agent'], statuses: [], facing: 'down',
  boss: { kit, phase: 1, color: 0xf2ead2, footprint: [3, 2], enrageAt: 0.5,
    action: 'attack', skill: 'thorns', progress: 0.4,
    warning: { name: 'Thorns', tiles: [[10, 14]], progress: 0.8 } },
})

describe('Boss Studio direct action controls', () => {
  it('offers every preview as a visible choice without an OS-native popup', () => {
    expect(bossPreviewModes('alberic').map((m) => m.value))
      .toEqual(['live', 'idle', 'walk', 'attack', 'cast', 'volley', 'hurt', 'death'])
    expect(bossPreviewModes('alberic').filter((m) => m.value !== 'live').map((m) => m.label.match(/(\d+) 帧/)![1]))
      .toEqual(['8', '10', '12', '12', '12', '8', '12'])
    expect(bossPreviewModes('alberic').filter((m) => m.value !== 'live').map((m) => m.label.match(/(\d+) FPS/)![1]))
      .toEqual(['8', '12', '12', '12', '12', '16', '10'])
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
    ['idle', 0], ['walk', 1], ['attack', 2], ['cast', 3], ['volley', 4], ['hurt', 5], ['death', 6],
  ] as const)('immediately applies %s to the render snapshot instead of the pending combat action', (mode, row) => {
    const original = entity(), frameEntity = structuredClone(original)
    previewBoss(frameEntity, mode, 0)
    expect(frameEntity.boss!.progress).toBe(0)
    expect(frameEntity.boss!.warning).toBeUndefined()
    expect(bossAnimationFrame(frameEntity.boss!, 0)).toEqual({ col: 0, row })
    expect(original.boss!.action).toBe('attack')
    expect(original.boss!.warning).toBeDefined()
    expect(original.boss!.progress).toBe(0.4)
  })

  it('restarts one-shot animations from their first frame instead of the wall-clock remainder', () => {
    const e = entity()
    // death at 10 fps: the eighth pose after 800 ms; the arrow at 12 fps: its release half after 500 ms
    previewBoss(e, 'death', 800)
    expect(bossAnimationFrame(e.boss!, 0).col).toBe(24)
    previewBoss(e, 'cast', 0)
    expect(bossAnimationFrame(e.boss!, 0)).toEqual({ row: 3, col: 0 })
    previewBoss(e, 'cast', 500)
    expect(bossAnimationFrame(e.boss!, 0)).toEqual({ row: 3, col: 16 })
    previewBoss(e, 'cast', 1000)
    expect(bossAnimationFrame(e.boss!, 0)).toEqual({ row: 3, col: 0 })
    previewBoss(e, 'death', 30000)
    expect(bossAnimationFrame(e.boss!, 0)).toEqual({ row: 6, col: 31 })
  })

  it('returns to the real encounter untouched in live mode and tolerates missing actors', () => {
    const e = entity(), before = structuredClone(e)
    previewBoss(e, 'live', 1000)
    expect(e).toEqual(before)
    expect(() => previewBoss(undefined, 'death', 100)).not.toThrow()
  })

  it.each([['idle', 'idle'], ['walk', 'walk'], ['attack', 'thorns'], ['cast', 'arrow'], ['volley', 'volley'], ['hurt', 'hurt'], ['death', 'death']] as const)(
    'shows the %s clip at its own pace independently of display refresh rate', (mode, id) => {
      const e = entity(), frames = new Set<number>()
      const ms = albericFrameMs(id), clip = ALBERIC_CLIPS[id], duration = clip.length * ms
      // loops run on the screen's clock; one-shots on the preview's own time
      const at = (t: number) => (id === 'idle' || id === 'walk' ? t : 99999)
      for (let i = 0; i * 1000 / 60 < duration; i++) {
        const time = i * 1000 / 60
        previewBoss(e, mode, time)
        frames.add(bossAnimationFrame(e.boss!, time).col)
      }
      expect([...frames]).toEqual(clip)
      for (let i = 0; i < clip.length; i++) {
        previewBoss(e, mode, i * ms + 1)
        expect(bossAnimationFrame(e.boss!, at(i * ms + 1)).col).toBe(clip[i])
        previewBoss(e, mode, (i + 1) * ms - 1)
        expect(bossAnimationFrame(e.boss!, at((i + 1) * ms - 1)).col).toBe(clip[i])
      }
    })
})
