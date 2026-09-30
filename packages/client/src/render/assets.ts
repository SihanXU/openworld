// Loading and slicing the Ninja Adventure pack at runtime from the catalogue.

import Phaser from 'phaser'
import type { ActorDef, Catalog, FxDef, SpriteDef } from '../assets/types.ts'

// encodeURI, not encodeURIComponent: folders like "Hit & Impact" must keep a raw '&' for Vite.
export const assetUrl = (path: string) => encodeURI(`${import.meta.env.BASE_URL}assets/na/${path}`)

/** Every image path the catalogue references (loaded up front; the pack subset is small). */
export function imagePaths(c: Catalog): string[] {
  const s = new Set<string>()
  const sd = (d?: SpriteDef) => d && s.add(d.img)
  for (const b of Object.values(c.blobs)) s.add(b.img)
  for (const list of Object.values(c.plain)) for (const [img] of list) s.add(img)
  for (const list of Object.values(c.decals)) list.forEach(sd)
  for (const list of Object.values(c.terrainObjects)) list.forEach(sd)
  for (const p of Object.values(c.prefabs)) s.add(p.img)
  for (const r of Object.values(c.rooms)) s.add(r.img)
  for (const f of Object.values(c.fixtures)) (sd(f.base), sd(f.open), sd(f.lit))
  for (const i of Object.values(c.items)) sd(i)
  for (const a of [...Object.values(c.characters), ...Object.values(c.creatures)]) {
    s.add(`${a.dir}/${a.sheet}`)
    if (a.faceset) s.add(`${a.dir}/${a.faceset}`)
  }
  for (const f of Object.values(c.fx)) s.add(f.img)
  for (const u of Object.values(c.ui)) sd(u)
  return [...s]
}

export function preloadCatalog(scene: Phaser.Scene, c: Catalog): void {
  for (const p of imagePaths(c)) if (!scene.textures.exists(p)) scene.load.image(p, assetUrl(p))
  for (const [k, p] of Object.entries(c.sfx)) scene.load.audio(`sfx:${k}`, assetUrl(p))
}

/** Register a SpriteDef's frames on its image texture; returns frame names. */
export function spriteFrames(scene: Phaser.Scene, key: string, d: SpriteDef): string[] {
  const tex = scene.textures.get(d.img)
  const n = d.frames ?? 1
  const names: string[] = []
  for (let i = 0; i < n; i++) {
    const name = `${key}#${i}`
    if (!tex.has(name)) tex.add(name, 0, d.x + i * (d.step ?? d.w), d.y, d.w, d.h)
    names.push(name)
  }
  return names
}

/** Actor sheet: frame name `${key}:${col},${row}` (col = direction, row = frame). */
export function actorFrames(scene: Phaser.Scene, key: string, a: ActorDef): { img: string; fw: number; fh: number } {
  const img = `${a.dir}/${a.sheet}`
  const tex = scene.textures.get(img)
  const src = tex.getSourceImage() as HTMLImageElement
  const fw = Math.floor(src.width / a.cols)
  const fh = Math.floor(src.height / a.rows)
  for (let r = 0; r < a.rows; r++)
    for (let c = 0; c < a.cols; c++) {
      const name = `${key}:${c},${r}`
      if (!tex.has(name)) tex.add(name, 0, c * fw, r * fh, fw, fh)
    }
  return { img, fw, fh }
}

export const DIR_COL: Record<string, number> = { down: 0, up: 1, left: 2, right: 3 }

/** Register an FX animation; returns the animation key. */
export function fxAnim(scene: Phaser.Scene, key: string, f: FxDef, repeat = 0): string {
  const animKey = `fx:${key}:${repeat}`
  if (scene.anims.exists(animKey)) return animKey
  const tex = scene.textures.get(f.img)
  const frames: { key: string; frame: string }[] = []
  for (let i = 0; i < f.frames; i++) {
    const name = `${key}#${i}`
    if (!tex.has(name)) tex.add(name, 0, f.vertical ? 0 : i * f.fw, f.vertical ? i * f.fh : 0, f.fw, f.fh)
    frames.push({ key: f.img, frame: name })
  }
  scene.anims.create({ key: animKey, frames, frameRate: f.fps, repeat })
  return animKey
}
