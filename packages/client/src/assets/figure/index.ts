// A look in the game (docs/looks.md §3): its map sheet as a texture, its portrait as a canvas. Both are composed
// on demand and kept by the look's code, so a crowd of thousands costs only the looks on the map now.

import Phaser from 'phaser'
import type { Look, Mood } from '@lsw/engine'
import { figureId } from './ids.ts'
import type { ActorDef } from '../types.ts'
import { FH, FW, composeSprite } from './sprite.ts'
import { composePortrait, portraitFiles, type LayerPixels, type PortraitManifest } from './portrait.ts'

export { crowdLook, figureId } from './ids.ts'

/** The map sheet of a look: composed once into a canvas texture (`fig/<id>`), 4 facings by 4 walk frames of 16x32. */
export function figureDef(scene: Phaser.Scene, look: Look): { key: string; def: ActorDef } {
  const id = figureId(look)
  const img = `fig/${id}`
  if (!scene.textures.exists(img)) {
    const c = document.createElement('canvas')
    c.width = FW * 4
    c.height = FH * 4
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(composeSprite(look)), c.width, c.height), 0, 0)
    scene.textures.addCanvas(img, c)
  }
  return { key: `fig:${id}`, def: { dir: 'fig', sheet: id, cols: 4, rows: 4, anchorY: 30 } }
}

// ---------------------------------------------------------------- portraits

const ROOT = 'assets/lsw/Looks/portrait'
let manifest: PortraitManifest | undefined
let manifestLoading: Promise<PortraitManifest | undefined> | undefined
const layers = new Map<string, LayerPixels>()
const loading = new Map<string, Promise<void>>()
const busts = new Map<string, HTMLCanvasElement>()

function loadManifest(): Promise<PortraitManifest | undefined> {
  manifestLoading ??= fetch(`${ROOT}/manifest.json`)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((m) => (manifest = m))
    .catch(() => undefined)
  return manifestLoading
}

function pixelsOf(src: string): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => {
      const c = document.createElement('canvas')
      c.width = im.width
      c.height = im.height
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.drawImage(im, 0, 0)
      resolve(g.getImageData(0, 0, im.width, im.height).data)
    }
    im.onerror = reject
    im.src = src
  })
}

function loadLayer(file: string): Promise<void> {
  if (layers.has(file)) return Promise.resolve()
  let p = loading.get(file)
  if (!p) {
    p = Promise.all([pixelsOf(`${ROOT}/${file}.png`), pixelsOf(`${ROOT}/${file}.z.png`)])
      .then(([paint, value]) => void layers.set(file, { paint, value }))
      .catch(() => undefined)
    loading.set(file, p)
  }
  return p
}

/** Fetch what a look's portrait needs (when its bearer comes onto the map), so the dialogue box has it ready. */
export async function preparePortrait(look: Look, mood?: Mood): Promise<boolean> {
  const m = manifest ?? (await loadManifest())
  if (!m) return false
  await Promise.all(portraitFiles(m, look, mood).map(loadLayer))
  return true
}

/**
 * What a status shows on the portrait (the overlays the map draws on the sprite, statuses' `overlay`): a wash of
 * colour over the figure and where it sits — wet from the top, fire from below, ice and oil all over.
 */
const WASH: Record<string, { color: string; from: 'top' | 'bottom' | 'all'; alpha: number; mode: GlobalCompositeOperation }> = {
  wet: { color: '#5a8fd8', from: 'top', alpha: 0.32, mode: 'source-atop' },
  fire: { color: '#ff7a1a', from: 'bottom', alpha: 0.45, mode: 'source-atop' },
  flame: { color: '#ffb340', from: 'bottom', alpha: 0.25, mode: 'source-atop' },
  ice: { color: '#bfe6ff', from: 'all', alpha: 0.42, mode: 'source-atop' },
  spark: { color: '#fff07a', from: 'all', alpha: 0.28, mode: 'source-atop' },
  oil: { color: '#2a2230', from: 'bottom', alpha: 0.35, mode: 'source-atop' },
  mend: { color: '#9cf2a8', from: 'bottom', alpha: 0.22, mode: 'source-atop' },
}

function washed(bust: HTMLCanvasElement, overlays: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = bust.width
  c.height = bust.height
  const g = c.getContext('2d')!
  g.drawImage(bust, 0, 0)
  for (const o of overlays) {
    const w = WASH[o]
    if (!w) continue
    const grad = g.createLinearGradient(0, w.from === 'bottom' ? c.height : 0, 0, w.from === 'bottom' ? 0 : c.height)
    grad.addColorStop(0, w.color)
    grad.addColorStop(w.from === 'all' ? 1 : 0.7, w.from === 'all' ? w.color : 'transparent')
    g.globalCompositeOperation = w.mode
    g.globalAlpha = w.alpha
    g.fillStyle = grad
    g.fillRect(0, 0, c.width, c.height)
  }
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  return c
}

/** The portrait of a look in a mood (with what its statuses show), if its layers are here (else undefined, and they are fetched for next time). */
export function portraitOf(look: Look, mood?: Mood, overlays: string[] = []): HTMLCanvasElement | undefined {
  const bust = bustOf(look, mood)
  return bust && overlays.some((o) => WASH[o]) ? washed(bust, overlays) : bust
}

function bustOf(look: Look, mood?: Mood): HTMLCanvasElement | undefined {
  const key = `${figureId(look)}|${mood ?? 'neutral'}`
  const done = busts.get(key)
  if (done) return done
  const m = manifest
  if (!m) {
    void loadManifest()
    return undefined
  }
  const files = portraitFiles(m, look, mood)
  if (files.some((f) => !layers.has(f))) {
    void preparePortrait(look, mood)
    return undefined
  }
  const c = document.createElement('canvas')
  c.width = m.size
  c.height = m.size
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(composePortrait(m, look, mood, (f) => layers.get(f))), m.size, m.size), 0, 0)
  busts.set(key, c)
  return c
}
