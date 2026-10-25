// Every music file the catalogue plays, its loudness measured (ffmpeg's EBU R128 filter: integrated LUFS) into
// games/openworld/client/src/loudness.json, which the runtime's music director reads to bring every piece to one
// loudness (docs/music.md). `npm run loudness` after a piece is added or changed; the music test fails on one unmeasured.
//   npm run loudness              measure what is not measured yet
//   npm run loudness -- --all     measure every file again

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import '../../../client/src/register.ts'
import { CATALOG } from '../../../client/src/catalog.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const OUT = join(ROOT, 'games', 'openworld', 'client', 'src', 'loudness.json')
/** Where a catalogue path is: the project's own art, or the pack's subset copied into public/assets/na (npm run assets). */
export const fileOf = (p: string) => join(ROOT, 'games', 'openworld', 'public', 'assets', p.startsWith('lsw/') ? '' : 'na', p)

/** Every file the music cues name. */
export function musicFiles(): string[] {
  const files = new Set<string>()
  for (const cue of Object.values(CATALOG.music)) for (const f of typeof cue === 'string' ? [cue] : (cue.tracks ?? [])) files.add(f)
  return [...files].sort()
}

/** One file's integrated loudness (LUFS): ffmpeg writes its summary to stderr. */
function measure(file: string): number {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' })
  const m = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/.exec(r.stderr ?? '')
  if (r.status !== 0 || !m) throw new Error(`ffmpeg could not measure ${file}: ${r.error?.message ?? r.stderr?.slice(-300)}`)
  return Number(m[1])
}

function main(): void {
  const all = process.argv.includes('--all')
  const before: Record<string, number> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const table: Record<string, number> = {}
  for (const p of musicFiles()) {
    if (!all && before[p] !== undefined) {
      table[p] = before[p]
      continue
    }
    const f = fileOf(p)
    if (!existsSync(f)) throw new Error(`missing ${p} (npm run assets first)`)
    const lufs = measure(f)
    table[p] = lufs
    console.log(`${lufs.toFixed(1).padStart(6)} LUFS  ${p}`)
  }
  writeFileSync(OUT, `${JSON.stringify(table, null, 2)}\n`)
  console.log(`${Object.keys(table).length} files → ${OUT}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
