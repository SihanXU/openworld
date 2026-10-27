// Copies every Ninja Adventure file referenced by the asset catalogue from the unzipped pack
// (assets/ninja-adventure/Ninja Adventure - Asset Pack/) to games/openworld/public/assets/na/,
// keeping the same relative paths. Stale copies are removed first.
//
//   npx tsx games/openworld/tools/src/copyAssets.ts

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOG } from '../../client/src/catalog.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const PACK = join(ROOT, 'assets', 'ninja-adventure', 'Ninja Adventure - Asset Pack')
const OUT = join(ROOT, 'games', 'openworld', 'public', 'assets', 'na')

/** Every pack-relative file path the catalogue references. */
export function catalogPaths(): string[] {
  const paths = new Set<string>()
  const c = CATALOG
  for (const b of Object.values(c.blobs)) paths.add(b.img)
  for (const tiles of Object.values(c.plain)) for (const [img] of tiles) paths.add(img)
  for (const list of [...Object.values(c.decals), ...Object.values(c.terrainObjects)]) for (const s of list) paths.add(s.img)
  for (const p of Object.values(c.prefabs)) paths.add(p.img)
  for (const r of Object.values(c.rooms)) paths.add(r.img)
  for (const f of Object.values(c.fixtures)) for (const s of [f.base, f.open, f.lit, ...(f.variants ?? [])]) if (s) paths.add(s.img)
  for (const s of [...Object.values(c.items), ...Object.values(c.ui)]) paths.add(s.img)
  for (const a of [...Object.values(c.characters), ...Object.values(c.creatures)]) {
    paths.add(`${a.dir}/${a.sheet}`)
    for (const clip of Object.values(a.clips ?? {})) paths.add(`${a.dir}/${clip.sheet}`)
    if (a.faceset) paths.add(`${a.dir}/${a.faceset}`)
  }
  for (const f of Object.values(c.fx)) paths.add(f.img)
  // a music cue is a file or its pieces (docs/music.md)
  for (const cue of Object.values(c.music)) for (const p of typeof cue === 'string' ? [cue] : (cue.tracks ?? [])) paths.add(p)
  for (const p of Object.values(c.sfx)) paths.add(p)
  // the project's own art (public/assets/lsw/) is not the pack's
  return [...paths].filter((p) => !p.startsWith('lsw/')).sort()
}

/**
 * Pack files no catalogue entry names but the project's own tools read from `na/`: the trailer's music
 * (client/src/trailer/film.ts `MUSIC.file`) and the six item-and-weapon skill icons the gear-icon tool cuts
 * (tools/src/art/gear-icons.ts `ICONS` plus the shield). They are copied too, so running this script does
 * not delete them.
 */
export const KEEP = [
  'Audio/Musics/1 - Adventure Begin.ogg',
  'Ui/Skill Icon/Items & Weapon/Amulet.png',
  'Ui/Skill Icon/Items & Weapon/Armor.png',
  'Ui/Skill Icon/Items & Weapon/Boot.png',
  'Ui/Skill Icon/Items & Weapon/Helmet.png',
  'Ui/Skill Icon/Items & Weapon/Ring.png',
]

function main(): void {
  if (!existsSync(PACK)) throw new Error(`pack not found: ${PACK}`)
  const paths = [...new Set([...catalogPaths(), ...KEEP])].sort()
  const missing = paths.filter((p) => !existsSync(join(PACK, p)))
  if (missing.length) {
    console.error('Missing files referenced by the catalogue:\n  ' + missing.join('\n  '))
    process.exit(1)
  }
  rmSync(OUT, { recursive: true, force: true })
  let bytes = 0
  for (const p of paths) {
    const dst = join(OUT, p)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(join(PACK, p), dst)
    bytes += statSync(dst).size
  }
  console.log(`copied ${paths.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB -> ${OUT}`)
}

// run when this file is the command, not when a test imports its lists
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
