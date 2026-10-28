// The scale film's scenes, 1,024 of them, cut from the stage's frames (site/scale/gen/main.ts made the list, every
// window unlike the others as drawn), none like another nor a view of the same (likeness.mjs, views.mjs):
//   the first 64, the scenes act's large ones (?film=scale-hero; export.mjs --every 2 --clip-w 960 --out
//   var/scale/hero), a second and a third each at 15 frames a second, one sheet each (assets/clips/<n>.jpg) a little
//   over the size its window needs: the one the film opens on large, the three it splits into and the twelve after
//   smaller, the next forty-eight smaller still;
//   the other 960 (?film=scale-scenes; --every 3 --clip-w 240, in parts, into var/scale/scenes/<part>), 0.8 s at 10
//   frames a second: 176 x 99 for the 256 level's windows, 96 x 54 for the 1,024's, 32 to a sheet
//   (assets/clips/deep-<n>.jpg, a clip a row), their sorts — the places, their seasons and festivals, the halls, the
//   halls made anew — spread through the order so every level holds them all.
// clips.json says which, in the film's order.  node site/scale/clips.mjs
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { alike, signature } from './likeness.mjs'
import { compOf, rectOf, sameView } from './views.mjs'

const HERO = 'var/scale/hero', DEEP = 'var/scale/scenes'
const OUT = 'site/scale/assets/clips'
const COUNT = 1024, N = 8
/** A window's size by the level it first appears at. */
const size = (k) => (k === 0 ? [960, 540] : k < 4 ? [640, 360] : k < 16 ? [480, 270] : k < 64 ? [256, 144] : k < 256 ? [176, 99] : [96, 54])
const frame = (dir, f) => join(dir, 'frames', `${String(f).padStart(5, '0')}.png`)
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) process.exit(1) }
const listOf = (files) => { const f = join(OUT, 'frames.txt'); writeFileSync(f, files.map((p) => `file '${resolve(p).replace(/\\/g, '/')}'`).join('\n')); return f }
/** A shot's frames as taken (every n-th of the film's). */
const framesOf = (dir, s) => { const out = []; for (let f = s.start; f < s.start + s.frames; f++) if (existsSync(frame(dir, f))) out.push(frame(dir, f)); return out }
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const list = [], taken = [], views = []
const { scenes } = JSON.parse(readFileSync('games/openworld/client/src/trailer/scaleshots.json', 'utf8'))
const entry = new Map(scenes.map((e) => [e.id, e]))
const viewOf = (e) => ({ comp: compOf(e), rect: rectOf(e) })

// ------------------------------------------------------------------ the first 64

// (one like one before it, or a view of the same, passed over: the deep ones fill its place)
// (the 64 were filmed from the list as it was then: what they were is looked up in the lists kept since)
const filmed = ['var/scale/scaleshots-filmed.json', 'var/scale/scaleshots-prev.json'].filter((f) => existsSync(f)).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).scenes)
for (const s of JSON.parse(readFileSync(join(HERO, 'cues.json'), 'utf8')).shots) {
  const fs = framesOf(HERO, s).slice(0, 20)
  const e = entry.get(s.id) ?? filmed.find((x) => x.id === s.id)
  const sig = signature(fs[Math.floor(fs.length / 2)]), view = viewOf(e)
  if (taken.some((t) => alike(t, sig)) || views.some((v) => sameView(v, view))) continue
  const k = list.length, [w, h] = size(k), cols = 6, rows = Math.ceil(fs.length / cols)
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', listOf(fs), '-vf', `scale=${w}:${h}:flags=lanczos,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', k === 0 ? '4' : k < 16 ? '6' : '5', join(OUT, `${k}.jpg`)])
  list.push({ id: s.id, sheet: `${k}.jpg`, y: 0, frames: fs.length, fps: 15, w, h, cols, ...view })
  taken.push(sig)
  views.push(view)
}

// ------------------------------------------------------------------ the rest

const moments = []
for (const part of readdirSync(DEEP).filter((d) => !d.endsWith('.log'))) {
  const dir = join(DEEP, part)
  if (!existsSync(join(dir, 'cues.json'))) continue
  for (const s of JSON.parse(readFileSync(join(dir, 'cues.json'), 'utf8')).shots) { const fs = framesOf(dir, s); if (fs.length >= N && entry.has(s.id)) moments.push({ id: s.id, e: entry.get(s.id), frames: fs }) }
}
const sortOf = (e) => (e.inside ? (e.src ? 'made hall' : 'hall') : e.variant ?? 'place')
const hashOf = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000 }
const bySort = new Map()
for (const m of moments) bySort.set(sortOf(m.e), [...(bySort.get(sortOf(m.e)) ?? []), m])
const placed = []
for (const [, l] of bySort) {
  // the places of a sort taking turns within it
  const fam = new Map()
  for (const m of l) fam.set(m.e.family, [...(fam.get(m.e.family) ?? []), m])
  const turns = []
  for (let k = 0; turns.length < l.length; k++) for (const f of fam.values()) if (f[k]) turns.push(f[k])
  turns.forEach((m, k) => placed.push([(k + 0.5 + hashOf(m.id) * 0.3) / turns.length, m]))
}
placed.sort((a, b) => a[0] - b[0])
// taken in that order, none like one taken before it (the 64 among them) as the stage drew it, nor a view of what one
// taken before is a view of (views.mjs)
const chosen = []
for (const [, m] of placed) {
  if (chosen.length === COUNT - list.length) break
  const sig = signature(m.frames[Math.floor(m.frames.length / 2)])
  const view = viewOf(m.e)
  if (taken.some((t) => alike(t, sig)) || views.some((v) => sameView(v, view))) continue
  taken.push(sig)
  views.push(view)
  chosen.push(m)
}
if (chosen.length < COUNT - list.length) throw new Error(`only ${list.length + chosen.length} scenes`)
const PER = 32
for (let b = 0; b < chosen.length; b += PER) {
  const batch = chosen.slice(b, b + PER), [w, h] = size(list.length), name = `deep-${b / PER}.jpg`
  ffmpeg(['-reinit_filter', '0', '-f', 'concat', '-safe', '0', '-i', listOf(batch.flatMap((m) => m.frames.slice(0, N))), '-vf', `scale=${w}:${h}:flags=lanczos:eval=frame,tile=${N}x${batch.length}`, '-frames:v', '1', '-q:v', '6', join(OUT, name)])
  batch.forEach((m, r) => list.push({ id: m.id, sheet: name, y: r * h, frames: N, fps: 10, w, h, cols: N, ...viewOf(m.e) }))
}
rmSync(join(OUT, 'frames.txt'), { force: true })
writeFileSync(join(OUT, 'clips.json'), JSON.stringify(list))
console.log(`${list.length} clips → ${OUT}`)
