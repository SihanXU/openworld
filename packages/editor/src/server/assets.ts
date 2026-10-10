// A project's pictures and sounds, and the pack beside them (docs/engine-split.md §15): what the editor's Assets
// mode lists, imports and takes. A project's files are in its assets/: the pack's under na/ (a catalogue writes
// them bare, as the pack has them), its own art under own/ (what the author imports) and lsw/ (OpenWorld's). The
// pack — the Ninja Adventure pack's subset (CC0) the editor ships, as RPG Maker ships its runtime package — is
// read where the editor was installed; a file of it that a project uses is copied into the project, so a project
// is whole on its own.

import { copyFileSync, existsSync, mkdirSync, openSync, readSync, closeSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'

export type AssetKind = 'image' | 'sound' | 'other'

export interface AssetFile {
  /** From the assets folder, with / between folders. */
  path: string
  size: number
  kind: AssetKind
  /** A picture's size in pixels (PNG). */
  w?: number
  h?: number
}

const IMAGES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const SOUNDS = new Set(['.ogg', '.wav', '.mp3'])
export const kindOf = (path: string): AssetKind => (IMAGES.has(extname(path).toLowerCase()) ? 'image' : SOUNDS.has(extname(path).toLowerCase()) ? 'sound' : 'other')

/** A PNG's size, read from its header (none: not a PNG). */
export function pngSize(file: string): { w: number; h: number } | undefined {
  const fd = openSync(file, 'r')
  try {
    const b = Buffer.alloc(24)
    if (readSync(fd, b, 0, 24, 0) < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('latin1', 12, 16) !== 'IHDR') return undefined
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  } finally {
    closeSync(fd)
  }
}

/** Every picture and sound under a folder. */
export function listAssets(root: string): AssetFile[] {
  if (!existsSync(root)) return []
  const out: AssetFile[] = []
  for (const rel of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    const at = join(root, rel)
    const kind = kindOf(rel)
    if (kind === 'other' || !statSync(at).isFile()) continue
    const size = extname(rel).toLowerCase() === '.png' ? pngSize(at) : undefined
    out.push({ path: rel.split(sep).join('/'), size: statSync(at).size, kind, ...size })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

const cache = new Map<string, AssetFile[]>()
/** The pack's files (read once: it does not change while the editor runs). */
export function packFiles(pack: string | undefined): AssetFile[] {
  if (!pack) return []
  if (!cache.has(pack)) cache.set(pack, listAssets(pack))
  return cache.get(pack)!
}

/** A path inside a folder, refused when it would leave it or is not a picture or a sound. */
export function inside(root: string, rel: string): string {
  const clean = normalize(rel).split(sep).join('/')
  if (clean.startsWith('../') || clean === '..' || clean.startsWith('/') || /^[A-Za-z]:/.test(clean) || kindOf(clean) === 'other') throw new AssetError(`not a picture or a sound in the project: ${rel}`)
  return join(root, clean)
}

export class AssetError extends Error {}

/** The largest file the editor takes in (a sheet of pictures, a piece of music). */
export const MAX_ASSET = 32 * 1024 * 1024

/** A file the author imports: put under own/ in the project's assets (another of the same path is replaced). */
export function importAsset(assets: string, rel: string, data: Buffer): AssetFile {
  if (!rel.startsWith('own/')) throw new AssetError('imported pictures and sounds go under own/')
  if (data.length > MAX_ASSET) throw new AssetError(`${rel} is larger than ${MAX_ASSET >> 20} MB`)
  const at = inside(assets, rel)
  mkdirSync(dirname(at), { recursive: true })
  writeFileSync(at, data)
  return listAssets(assets).find((f) => f.path === rel)!
}

/** An imported file removed (only the author's own: the pack's and the game's art stay). */
export function removeAsset(assets: string, rel: string): void {
  if (!rel.startsWith('own/')) throw new AssetError('only the pictures and sounds under own/ are removed here')
  rmSync(inside(assets, rel), { force: true })
}

/** The pack's files a project takes (copied to its assets/na/, under the pack's paths); the ones it already had are left. */
export function takeFromPack(pack: string | undefined, assets: string, paths: string[]): string[] {
  if (!pack) throw new AssetError('this editor has no pack')
  const taken: string[] = []
  for (const p of paths) {
    const from = inside(pack, p)
    if (!existsSync(from)) throw new AssetError(`the pack has no ${p}`)
    const to = inside(join(assets, 'na'), p)
    if (existsSync(to)) continue
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
    taken.push(p)
  }
  return taken
}
