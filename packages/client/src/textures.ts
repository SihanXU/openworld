// Bridges the procedural art module into Phaser textures, generating lazily and caching
// by key so thousands of distinct NPC looks / item variants cost only what is on screen.

import Phaser from 'phaser'
import type { Appearance } from '@lsw/engine'
import { MATERIALS, TERRAINS } from '@lsw/content'
import {
  characterSheet,
  creatureSheet,
  fixtureSheet,
  iconSheet,
  overlaySheet,
  particleSheet,
  terrainSheet,
  type Sheet,
} from './art/index.ts'

export const TILE = 16

export class Textures {
  private made = new Set<string>()
  /** terrain id -> [first tile index, variants]. */
  terrainIndex: Record<string, { first: number; variants: number; anim?: [number, number] }> = {}
  constructor(private scene: Phaser.Scene) {}

  private register(key: string, sheet: Sheet): string {
    if (this.made.has(key) || this.scene.textures.exists(key)) {
      this.made.add(key)
      return key
    }
    const tex = this.scene.textures.addCanvas(key, sheet.canvas)
    if (tex) for (const f of sheet.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h)
    this.made.add(key)
    return key
  }

  terrain(): string {
    const key = 'terrain'
    if (this.made.has(key)) return key
    const sheet = terrainSheet(TERRAINS.map((t) => ({ id: t.id, color: t.color, tags: t.tags })))
    const cols = sheet.canvas.width / TILE
    const idx = (name: string) => {
      const f = sheet.frames.find((x: Sheet['frames'][number]) => x.name === name)
      return f ? (f.y / TILE) * cols + f.x / TILE : -1
    }
    for (const t of TERRAINS) {
      const n = sheet.variants[t.id] ?? 1
      const a0 = idx(`${t.id}#anim0`)
      const a1 = idx(`${t.id}#anim1`)
      this.terrainIndex[t.id] = { first: idx(`${t.id}#0`), variants: n, anim: a0 >= 0 && a1 >= 0 ? [a0, a1] : undefined }
    }
    this.register(key, sheet)
    return key
  }

  /** Tile index for a terrain at a position (stable per-position variant). */
  tileFor(terrain: string, x: number, y: number): number {
    const t = this.terrainIndex[terrain] ?? this.terrainIndex.void
    if (!t || t.first < 0) return 0
    let h = (x * 73856093) ^ (y * 19349663)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    const v = ((h ^ (h >>> 16)) >>> 0) % Math.max(1, t.variants)
    return t.first + v
  }

  character(look: Appearance, role: string): string {
    const key = `char:${look.skin}.${look.hair}.${look.hairStyle}.${look.top}.${look.bottom}.${role}`
    if (!this.made.has(key)) this.register(key, characterSheet(look, role))
    return key
  }

  creature(sprite: string, variant: string): string {
    const key = `cre:${sprite}:${variant}`
    if (!this.made.has(key)) this.register(key, creatureSheet(sprite, variant))
    return key
  }

  fixture(sprite: string): string {
    const key = `fix:${sprite}`
    if (!this.made.has(key)) this.register(key, fixtureSheet(sprite))
    return key
  }

  icon(sprite: string, tags: string[] = []): string {
    const mat = tags.find((t) => t.startsWith('material:'))?.slice(9)
    const el = tags.find((t) => t.startsWith('element:'))?.slice(8)
    const key = `ico:${sprite}:${mat ?? ''}:${el ?? ''}`
    if (!this.made.has(key)) this.register(key, iconSheet(sprite, { material: mat ? MATERIALS[mat]?.color : undefined, element: el }))
    return key
  }

  overlay(name: string): string {
    const key = `ovl:${name}`
    if (!this.made.has(key)) this.register(key, overlaySheet(name))
    return key
  }

  overlayFrames(name: string): string[] {
    const tex = this.scene.textures.get(this.overlay(name))
    return tex.getFrameNames().filter((n) => n !== '__BASE').sort()
  }

  particles(): string {
    const key = 'particles'
    if (!this.made.has(key)) this.register(key, particleSheet())
    return key
  }

  frameNames(key: string): string[] {
    return this.scene.textures.get(key).getFrameNames()
  }
}
