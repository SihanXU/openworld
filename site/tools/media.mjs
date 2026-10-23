// The page's one video: the trailer's middle, silent, a loop behind the page's head and its end (hero.mp4, from the
// frames site/video/export.mjs took at 720p into var/video/hero-a and hero-b), and its poster. The pieces' films are
// the pieces themselves (scale/, starmap/, explain/ ?embed), never videos on the page.  node site/tools/media.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'site/media'
mkdirSync(OUT, { recursive: true })
const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' })

const H264 = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']

// the hero: two runs of frames, one after the other, silent
{
  const list = join(OUT, 'hero.txt')
  const lines = ['hero-a', 'hero-b'].flatMap((d) => readdirSync(`var/video/${d}/frames`).sort().map((f) => `file '../../var/video/${d}/frames/${f}'\nduration ${1 / 30}`))
  writeFileSync(list, lines.join('\n') + '\n')
  ff('-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30`, '-an', ...H264(26), join(OUT, 'hero.mp4'))
  rmSync(list)
  ff('-ss', '0.4', '-i', join(OUT, 'hero.mp4'), '-frames:v', '1', '-q:v', '4', join(OUT, 'hero.jpg'))
}
