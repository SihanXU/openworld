import { describe, expect, it } from 'vitest'
import type { MapData } from '@openworld/engine'
import { MapEnvironmentView, environmentLook, fireflyFrame, streamFrame, waterfallLevel } from '../src/render/environment.ts'

const map: MapData = { id: 'forest', name: 'Forest', kind: 'workshop', width: 3, height: 3, terrain: ['grass', 'water', 'grass', 'grass', 'bridge', 'grass', 'flowers', 'water', 'grass'], portals: [], environment: { palette: 'verdant', water: 'stream', fireflies: true } }
describe('native map environment consumer', () => {
  it('animates water and fireflies by presentation time without changing the map', () => {
    const before = JSON.stringify(map)
    expect(streamFrame(map, 0)).toHaveLength(2)
    expect(streamFrame(map, 200)).not.toEqual(streamFrame(map, 0))
    expect(fireflyFrame(map, 200)).not.toEqual(fireflyFrame(map, 0))
    expect(JSON.stringify(map)).toBe(before)
    expect(environmentLook(map)?.tint).toBe('#b6ce80')
    expect(environmentLook({ ...map, environment: undefined })).toBeUndefined()
    expect(waterfallLevel([{ tags: ['waterfall'], x: 1, y: 1 }], 1, 1)).toBe(1)
    expect(waterfallLevel([], 1, 1)).toBe(0)
  })
  it('draws through the graphics consumer and destroys its layers on map leave', () => {
    const calls: string[] = []
    const scene = { add: { graphics: () => {
      const g: any = {}
      for (const key of ['setDepth', 'clear', 'fillStyle', 'fillRect', 'fillCircle', 'destroy']) g[key] = () => { calls.push(key); return g }
      return g
    } } }
    const view = new MapEnvironmentView(scene as never)
    view.update(map, [], 200)
    expect(calls.filter(c => c === 'fillRect').length).toBeGreaterThan(2)
    view.update({ ...map, environment: undefined }, [], 300)
    expect(calls.filter(c => c === 'destroy')).toHaveLength(2)
  })
})
