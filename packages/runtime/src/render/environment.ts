// Local time-driven scenery. It reads a model-authored map without changing layout or simulation.
import type { EntitySnap, MapData, RegionLook } from '@openworld/engine'
import type Phaser from 'phaser'

const TILE = 16
const WATER = new Set(['water', 'deepwater', 'spring'])
export const VERDANT_LOOK: RegionLook = { tint: '#b6ce80', tintAmount: 0.1, desat: -0.06, shade: 0.015 }
export const environmentLook = (map: MapData): RegionLook | undefined => map.environment?.palette === 'verdant' ? VERDANT_LOOK : undefined
const noise = (x: number, y: number) => ((x * 157 + y * 311 + 17) % 997) / 997
export interface EnvironmentPoint { x: number; y: number; alpha: number }

/** Pixel positions change with presentation time, independently of ticks and persistence. */
export function streamFrame(map: MapData, time: number): EnvironmentPoint[] {
  if (map.environment?.water !== 'stream') return []
  return map.terrain.flatMap((t, i) => {
    if (!WATER.has(t)) return []
    const x = i % map.width, y = Math.floor(i / map.width), phase = (time / 950 + noise(x, y)) % 1
    return [{ x: x * TILE + 3 + noise(y, x) * 8, y: y * TILE + phase * TILE, alpha: 0.15 + 0.18 * Math.sin(phase * Math.PI) }]
  })
}
export function fireflyFrame(map: MapData, time: number): EnvironmentPoint[] {
  if (!map.environment?.fireflies) return []
  const land = map.terrain.flatMap((t, i) => ['grass', 'flowers', 'path', 'farmland'].includes(t) ? [i] : [])
  const stride = Math.max(1, Math.floor(land.length / 24))
  return land.filter((_, i) => i % stride === 0).slice(0, 24).map((i, n) => {
    const x = i % map.width, y = Math.floor(i / map.width), phase = time / 900 + n * 1.9
    return { x: x * TILE + 8 + Math.sin(phase * 0.67) * 5, y: y * TILE + 2 + Math.cos(phase * 0.51) * 4, alpha: 0.2 + Math.max(0, Math.sin(phase)) * 0.8 }
  })
}
/** Reuse the water ambience bus, with a waterfall's actual distance. */
export function waterfallLevel(entities: Pick<EntitySnap, 'tags' | 'x' | 'y'>[], x: number, y: number): number {
  return Math.max(0, ...entities.filter(e => e.tags.includes('waterfall')).map(e => 1 - Math.hypot(e.x - x, e.y - y) / 10))
}

export class MapEnvironmentView {
  private water?: Phaser.GameObjects.Graphics
  private lights?: Phaser.GameObjects.Graphics
  constructor(private scene: Phaser.Scene) {}
  reset(): void { this.water?.destroy(); this.lights?.destroy(); this.water = this.lights = undefined }
  update(map: MapData, entities: EntitySnap[], time: number): void {
    const falls = entities.filter(e => e.tags.includes('waterfall'))
    if (!map.environment && !falls.length) { this.reset(); return }
    const water = this.water ??= this.scene.add.graphics().setDepth(0.8)
    const lights = this.lights ??= this.scene.add.graphics().setDepth(1e7 + 2)
    water.clear(); lights.clear()
    for (const p of streamFrame(map, time)) water.fillStyle(0xc9f3cc, p.alpha).fillRect(Math.round(p.x), Math.round(p.y), 5, 1)
    for (const f of falls) {
      const x = f.x * TILE + 8, y = f.y * TILE + 10
      lights.fillStyle(0x6baaaa, 0.72).fillRect(x - 6, y - 32, 12, 30)
      for (let n = 0; n < 7; n++) {
        const drop = (time / 16 + n * 5) % 28
        lights.fillStyle(n % 2 ? 0xbbe2c1 : 0xf1ffe0, 0.8).fillRect(x - 6 + n * 2, y - 31 + drop, 1, 7)
      }
      for (let n = 0; n < 6; n++) {
        const phase = time / 200 + n * 1.7
        lights.fillStyle(0xe4ffe0, 0.6).fillRect(Math.round(x + Math.sin(phase) * (5 + n)), Math.round(y + Math.cos(phase * 1.3) * 2), 2, 1)
      }
    }
    for (const p of fireflyFrame(map, time)) {
      lights.fillStyle(0x8acb51, p.alpha * 0.13).fillCircle(p.x, p.y, 4)
      lights.fillStyle(0xe6ff87, p.alpha).fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
    }
  }
}
