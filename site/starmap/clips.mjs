// The event clips cut from the stage's frames (node site/video/export.mjs --url ".../trailer.html?film=events"
// --size 720 --out var/video/events first): each shot's frames, the middle of the picture taken (a closer look
// than the renderer's nearest zoom), as JPEGs in site/starmap/clips/<id>/, and clips.json saying how many.
//   node site/starmap/clips.mjs [--from var/video/events]
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const FROM = arg('from', 'var/video/events')
const OUT = 'site/starmap/clips'
const { fps, shots, size } = JSON.parse(readFileSync(join(FROM, 'cues.json'), 'utf8'))
// the watched four are drawn large; the rest flash past small
const LARGE = new Set(['tree', 'camp', 'theft', 'hesper'])
const h = size ?? 720, w = Math.round((h * 16) / 9)
rmSync(OUT, { recursive: true, force: true })
const list = {}
for (const s of shots) {
  const dir = join(OUT, s.id)
  mkdirSync(dir, { recursive: true })
  const [ow, oh] = LARGE.has(s.id) ? [640, 360] : [320, 180]
  // the middle half of the picture, both ways
  const vf = `crop=${w / 2}:${h / 2}:${w / 4}:${h / 4},scale=${ow}:${oh}:flags=lanczos`
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-start_number', String(s.start), '-i', join(FROM, 'frames', '%05d.png'), '-frames:v', String(s.frames), '-vf', vf, '-q:v', LARGE.has(s.id) ? '4' : '5', join(dir, '%03d.jpg')], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(1)
  list[s.id] = { frames: s.frames, fps, w: ow, h: oh }
}
writeFileSync(join(OUT, 'clips.json'), JSON.stringify(list, null, 1))
console.log(`${shots.length} clips → ${OUT}`)
