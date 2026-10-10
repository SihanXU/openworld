import { describe, expect, it } from 'vitest'
import { FACE_FIXES, faceStrip, facesets, sourceOf, stripOf } from '../src/art/faces.ts'
import { readPng } from '../src/art/png.ts'
import { CATALOG, faceFrame } from '@openworld/runtime/src/assets/catalog.ts'
import FACES from '@openworld/runtime/src/assets/faces.json'

const manifest = FACES as Record<string, { strip: string; moods: string[] }>
const frame = (im: { w: number; h: number; rgba: Uint8Array }, i: number, w: number) => {
  const out = new Uint8Array(w * im.h * 4)
  for (let y = 0; y < im.h; y++) out.set(im.rgba.subarray((y * im.w + i * w) * 4, (y * im.w + (i + 1) * w) * 4), y * w * 4)
  return out
}

describe('portrait moods (tools/src/art/faces.ts)', () => {
  const paths = facesets()

  it('gives most of the people a face per mood, and the manifest lists exactly what the generator draws', () => {
    const drawn = Object.fromEntries(paths.flatMap((p) => {
      const r = faceStrip(p)
      return r ? [[p, { strip: `lsw/${stripOf(p)}`, moods: r.moods }]] : []
    }))
    expect(manifest).toEqual(drawn)
    expect(Object.keys(drawn).length).toBeGreaterThanOrEqual(40)
    for (const [p, f] of Object.entries(FACE_FIXES)) if (f === 'skip') expect(manifest[p], p).toBeUndefined()
  })

  it('draws each mood at the source size, the first frame the source itself, the same every time and as committed', () => {
    for (const p of Object.keys(manifest)) {
      const src = readPng(sourceOf(p))
      const a = faceStrip(p)!
      const b = faceStrip(p)!
      expect(a.strip.h, p).toBe(src.h)
      expect(a.strip.w, p).toBe(src.w * (a.moods.length + 1))
      expect(Buffer.from(a.strip.rgba).equals(Buffer.from(b.strip.rgba)), `${p} deterministic`).toBe(true)
      expect(Buffer.from(frame(a.strip, 0, src.w)).equals(Buffer.from(src.rgba)), `${p} neutral`).toBe(true)
      for (let i = 1; i <= a.moods.length; i++) expect(Buffer.from(frame(a.strip, i, src.w)).equals(Buffer.from(src.rgba)), `${p} ${a.moods[i - 1]} differs`).toBe(false)
      const disk = readPng(stripOf(p))
      expect(Buffer.from(disk.rgba).equals(Buffer.from(a.strip.rgba)), `${p} committed strip is stale (npm run art:faces)`).toBe(true)
    }
  })

  it('the catalogue picks the mood\'s frame, and the plain faceset for a mood the face lacks', () => {
    const villager = CATALOG.characters.Villager
    expect(faceFrame(villager, 'happy')).toEqual({ img: 'lsw/Faces/Actor/Character/Villager/Faceset.png', frame: 1, frames: 6 })
    expect(faceFrame(villager, 'shy')).toEqual({ img: 'lsw/Faces/Actor/Character/Villager/Faceset.png', frame: 5, frames: 6 })
    expect(faceFrame(villager, 'neutral')).toEqual({ img: 'Actor/Character/Villager/Faceset.png', frame: 0, frames: 1 })
    expect(faceFrame(villager)).toEqual({ img: 'Actor/Character/Villager/Faceset.png', frame: 0, frames: 1 })
    // OldMan2 has no angry face: the plain one
    const old = CATALOG.characters.OldMan2
    expect(old.faces?.moods).not.toContain('angry')
    expect(faceFrame(old, 'angry')).toEqual({ img: 'Actor/Character/OldMan2/Faceset.png', frame: 0, frames: 1 })
    // a helmet has no moods at all
    expect(CATALOG.characters.Knight.faces).toBeUndefined()
    expect(faceFrame(CATALOG.characters.Knight, 'sad')).toEqual({ img: 'Actor/Character/Knight/Faceset.png', frame: 0, frames: 1 })
    // every actor whose faceset has moods carries them
    for (const a of [...Object.values(CATALOG.characters), ...Object.values(CATALOG.creatures)])
      if (a.faceset) expect(a.faces, a.dir).toEqual(manifest[`${a.dir}/${a.faceset}`])
  })
})
