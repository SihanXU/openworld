// The frames and the sound made into a video: the music where the film says it comes in, every cue at its moment,
// mixed by ffmpeg; H.264 for anywhere (X, the page, YouTube), and a short cut if asked.
//   node site/video/encode.mjs [--dir var/video/trailer] [--name trailer] [--from s --to s] [--size 360|720|1080] [--voice file]
// A voice (a voiceover the film is timed to) is laid from the film's start, over everything.
// 360p unless asked (a draft); never larger than the frames were taken.
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const DIR = arg('dir', 'var/video/trailer')
const NAME = arg('name', 'trailer')
const AUDIO = 'assets/ninja-adventure/Ninja Adventure - Asset Pack/Audio'
const { fps, frames, cues, music } = JSON.parse(readFileSync(join(DIR, 'cues.json'), 'utf8'))
const from = Number(arg('from', 0)), to = Number(arg('to', frames / fps))
const SIZE = Number(arg('size', 360))
const length = to - from

// the inputs: the frames, the music, each cue's file
const inputs = ['-framerate', String(fps), '-start_number', String(Math.round(from * fps)), '-i', join(DIR, 'frames', '%05d.png')]
const filters = []
const mix = []
let n = 1
if (music && music.at < to) {
  inputs.push('-ss', String(music.from + Math.max(0, from - music.at)), '-i', join(AUDIO, music.file))
  const delay = Math.max(0, music.at - from) * 1000
  const [fo0, fo1] = music.fadeOut
  filters.push(`[${n}:a]volume=0.85,adelay=${delay}|${delay},afade=t=out:st=${fo0 - from}:d=${fo1 - fo0}[m]`)
  mix.push('[m]')
  n++
}
const VOICE = arg('voice')
if (VOICE) {
  inputs.push('-ss', String(from), '-i', VOICE)
  filters.push(`[${n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.0[v]`)
  mix.push('[v]')
  n++
}
for (const c of cues) {
  if (c.at < from || c.at >= to) continue
  const file = join(AUDIO, c.file)
  if (!existsSync(file)) { console.log('missing', c.file); continue }
  inputs.push('-i', file)
  const d = Math.round((c.at - from) * 1000)
  const cut = c.dur ? `,atrim=0:${c.dur},afade=t=out:st=${Math.max(0, c.dur - 0.4)}:d=0.4` : ''
  filters.push(`[${n}:a]volume=${c.vol}${cut},adelay=${d}|${d}[c${n}]`)
  mix.push(`[c${n}]`)
  n++
}
// the mix is as long as the film: a silence of its length first, and the mix ends with it (padding after the mix
// lost everything past the cues' last start once a voice was in it)
filters.push(`anullsrc=r=48000:cl=stereo,atrim=0:${length}[z]`)
filters.push(`[z]${mix.join('')}amix=inputs=${mix.length + 1}:duration=first:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${Math.max(0, length - 0.8)}:d=0.8,aresample=48000[a]`)

const out = join(DIR, `${NAME}-${SIZE}p.mp4`)
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]', '-vf', `scale=-2:${SIZE}:flags=lanczos`,
  '-frames:v', String(Math.round(length * fps)), '-c:v', 'libx264', '-preset', 'slow', '-crf', SIZE > 720 ? '17' : '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)
console.log(`→ ${out}`)
