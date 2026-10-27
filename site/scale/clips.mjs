// The scale film's scenes, 1,024 of them, none like another (likeness.mjs), cut from the stage's frames:
//   the first 64, two seconds each at 15 frames a second, from ?film=scale (export.mjs --every 2 --size 720 --out
//   var/video/scale): one sheet of its frames each (assets/clips/<id>.jpg), at the size its window needs — the one the
//   film opens on large, the three it splits into and the twelve after smaller, the next forty-eight smaller still;
//   the other 960, a moment on each map, 0.8 s at 10 frames a second, from ?film=scale-scenes (shots.ts; export.mjs
//   --every 3 --clip-w 240 into var/scale/scenes/p<n>): 240 x 135 for the 256 level's windows, 128 x 72 for the 1,024's,
//   32 to a sheet (assets/clips/deep-<n>.jpg, a clip a row), their sorts spread through the order.
// clips.json says which, in the film's order.
//   node site/scale/clips.mjs
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { alike, signature } from './likeness.mjs'

const FROM = 'var/video/scale', DEEP = 'var/scale/scenes'
const OUT = 'site/scale/assets/clips'
const TMP = 'var/scale/cut'
const COUNT = 1024
const { fps, shots } = JSON.parse(readFileSync(join(FROM, 'cues.json'), 'utf8'))
const RATE = 15, LONGEST = 2
// the moments of the story's longer shots: the two seconds round what happens in them
const WINDOW = { tree: 0.3, camp: 0.4, theft: 0.6 }
/** A window's size by the level it first appears at. */
const size = (k) => (k === 0 ? [960, 540] : k < 4 ? [640, 360] : k < 16 ? [480, 270] : k < 64 ? [256, 144] : k < 256 ? [240, 135] : [128, 72])
const frame = (dir, f) => join(dir, 'frames', `${String(f).padStart(5, '0')}.png`)
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) process.exit(1) }
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const list = [], taken = []

// ------------------------------------------------------------------ the first 64

shots.forEach((s, k) => {
  // the frames taken are every other one of the film's: the first of them in the shot's window
  let from = s.start + Math.round((WINDOW[s.id] ?? 0) * fps)
  from += from % (fps / RATE)
  const n = Math.min(Math.floor((s.frames - (from - s.start)) / (fps / RATE)), LONGEST * RATE)
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  for (let i = 0; i < n; i++) {
    const src = frame(FROM, from + i * (fps / RATE))
    if (!existsSync(src)) throw new Error(`no frame ${src} (${s.id}): export with --every 2`)
    copyFileSync(src, join(TMP, `${String(i).padStart(3, '0')}.png`))
  }
  const [w, h] = size(k), cols = 6, rows = Math.ceil(n / cols)
  ffmpeg(['-i', join(TMP, '%03d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', k === 0 ? '4' : k < 16 ? '6' : '5', join(OUT, `${s.id}.jpg`)])
  taken.push({ id: s.id, sig: signature(frame(FROM, from + Math.floor(n / 2) * (fps / RATE))) })
  list.push({ id: s.id, sheet: `${s.id}.jpg`, y: 0, frames: n, fps: RATE, w, h, cols })
})

// ------------------------------------------------------------------ the rest: a moment on each map

const entries = JSON.parse(readFileSync('games/openworld/client/src/trailer/scaleshots.json', 'utf8'))
const kindOf = new Map(entries.map((e) => [e.map, e]))
const moments = []
for (const part of readdirSync(DEEP)) {
  const cues = JSON.parse(readFileSync(join(DEEP, part, 'cues.json'), 'utf8'))
  for (const s of cues.shots) {
    const at = []
    for (let f = s.start; f < s.start + s.frames; f++) if (existsSync(frame(join(DEEP, part), f))) at.push(frame(join(DEEP, part), f))
    if (at.length) moments.push({ id: s.id, map: s.id.slice(2), frames: at })
  }
}
// by sort (a town, a village, the open country, a hall or a home), each spread evenly through the order, its regions
// taking turns; a room with no one in it last
const hashOf = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000 }
const sortOf = (e) => (e.kind === 'interior' ? (/(home|house|tent|cell)/.test(e.map) ? 'home' : 'room') : e.made ? 'hand' : e.kind)
const bySort = new Map()
for (const m of moments) { const e = kindOf.get(m.map); if (e) bySort.set(sortOf(e), [...(bySort.get(sortOf(e)) ?? []), m]) }
const placed = []
for (const [, l] of bySort) {
  const regions = new Map()
  for (const m of l) { const r = kindOf.get(m.map).region ?? ''; regions.set(r, [...(regions.get(r) ?? []), m]) }
  const turns = []
  for (let k = 0; turns.length < l.length; k++) for (const r of regions.values()) if (r[k]) turns.push(r[k])
  turns.forEach((m, k) => { const e = kindOf.get(m.map); placed.push([(k + 0.5 + hashOf(m.id) * 0.3) / turns.length + (e.people === 0 && e.kind === 'interior' ? 1 : 0), m]) })
}
placed.sort((a, b) => a[0] - b[0])
const chosen = []
let passed = 0
for (const [, m] of placed) {
  if (taken.length === COUNT) break
  const sig = signature(m.frames[Math.floor(m.frames.length / 2)])
  if (taken.some((t) => alike(t.sig, sig))) { passed++; continue }
  taken.push({ id: m.id, sig })
  chosen.push(m)
}
if (taken.length < COUNT) throw new Error(`only ${taken.length} scenes unlike each other`)
// 32 to a sheet, a clip a row of its frames
const PER = 32
for (let b = 0; b < chosen.length; b += PER) {
  const batch = chosen.slice(b, b + PER), k0 = 64 + b
  const [w, h] = size(k0), n = Math.min(...batch.map((m) => m.frames.length))
  const name = `deep-${b / PER}.jpg`
  writeFileSync(join(OUT, 'frames.txt'), batch.flatMap((m) => m.frames.slice(0, n)).map((f) => `file '${resolve(f).replace(/\\/g, '/')}'`).join('\n'))
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', join(OUT, 'frames.txt'), '-vf', `scale=${w}:${h}:flags=lanczos,tile=${n}x${batch.length}`, '-frames:v', '1', '-q:v', '5', join(OUT, name)])
  batch.forEach((m, r) => list.push({ id: m.id, sheet: name, y: r * h, frames: n, fps: 10, w, h, cols: n }))
}
rmSync(join(OUT, 'frames.txt'), { force: true })
rmSync(TMP, { recursive: true, force: true })
writeFileSync(join(OUT, 'clips.json'), JSON.stringify(list))
console.log(`${list.length} clips, none alike → ${OUT} (${passed} passed over as like one taken)`)
