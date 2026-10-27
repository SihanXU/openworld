// The scale film's scenes cut from the stage's frames (node site/video/export.mjs --url ".../trailer.html?film=scale"
// --every 2 --size 720 --out var/video/scale first): each shot two seconds at 15 frames a second, as one sheet of its
// frames (site/scale/assets/clips/<id>.jpg), at the size its window in the mosaic needs: the one the film opens on
// large, the three it splits into and the twelve after smaller, the last level's forty-eight smallest. clips.json says
// which, in the film's order.
//   node site/scale/clips.mjs [--from var/video/scale]
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const FROM = arg('from', 'var/video/scale')
const OUT = 'site/scale/assets/clips'
const TMP = join(FROM, 'cut')
const { fps, shots } = JSON.parse(readFileSync(join(FROM, 'cues.json'), 'utf8'))
const RATE = 15, LONGEST = 2
// the moments of the story's longer shots: the two seconds round what happens in them
const WINDOW = { tree: 0.3, camp: 0.4, theft: 0.6 }
/** A window's size by the level it first appears at. */
const size = (k) => (k === 0 ? [960, 540] : k < 4 ? [640, 360] : k < 16 ? [480, 270] : [256, 144])
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const list = []
shots.forEach((s, k) => {
  // the frames taken are every other one of the film's: the first of them in the shot's window
  let from = s.start + Math.round((WINDOW[s.id] ?? 0) * fps)
  from += from % (fps / RATE)
  const n = Math.min(Math.floor((s.frames - (from - s.start)) / (fps / RATE)), LONGEST * RATE)
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  for (let i = 0; i < n; i++) {
    const f = from + i * (fps / RATE), src = join(FROM, 'frames', `${String(f).padStart(5, '0')}.png`)
    if (!existsSync(src)) throw new Error(`no frame ${f} (${s.id}): export with --every 2`)
    copyFileSync(src, join(TMP, `${String(i).padStart(3, '0')}.png`))
  }
  const [w, h] = size(k), cols = 6, rows = Math.ceil(n / cols)
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(TMP, '%03d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', k === 0 ? '4' : k < 16 ? '6' : '5', join(OUT, `${s.id}.jpg`)], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(1)
  list.push({ id: s.id, frames: n, fps: RATE, w, h, cols })
})
rmSync(TMP, { recursive: true, force: true })
writeFileSync(join(OUT, 'clips.json'), JSON.stringify(list))
console.log(`${list.length} clips → ${OUT}`)
