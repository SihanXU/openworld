// The page's media, made from what the game's trailer stage filmed (site/video/export.mjs) and the game's own art:
//   hero.mp4, hero.jpg    the Holy City's six places as the title shows them, silent, a loop behind the page's head
//                         (?film=tour at 720p → var/video/tour/frames)
//   places/<id>.webp      every showcase place in one still, and its thumbnail <id>-s.webp, for the places gallery
//                         (?film=places --every 15 --size 1080 → var/video/places/frames, one frame a place)
//   cast/<id>/…           the cast's own portraits (the moods the page plays) and design sheets, for the cast section
// The pieces' films are the pieces themselves (scale/, starmap/, explain/ ?embed), never videos on the page.
// node site/tools/media.mjs
import { execFileSync } from 'node:child_process'
import { copyFileSync as copy, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'site/media'
mkdirSync(OUT, { recursive: true })
const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' })
const H264 = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']

// ------------------------------------------------------------------ the hero: the tour, silent, looped
{
  const frames = 'var/video/tour/frames'
  // pixel art compresses well as animation; under the hero's shade 32 looks as 24 does, at a quarter of the size
  ff('-framerate', '30', '-i', join(frames, '%05d.png'), '-an', '-tune', 'animation', ...H264(32), join(OUT, 'hero.mp4'))
  // the poster: the abbey's front, fully up out of the dark
  ff('-ss', '2', '-i', join(OUT, 'hero.mp4'), '-frames:v', '1', '-q:v', '3', join(OUT, 'hero.jpg'))
}

// ------------------------------------------------------------------ the places: one still each, in the order tour.ts films them
// (games/openworld/client/src/trailer/tour.ts: the Holy City's six, then the regions')
const PLACE_IDS = [
  'sunwell-abbey', 'north-gate', 'bell-ward', 'market', 'lamp-ward', 'lower-town',
  'rimeholm', 'warcombe', 'weighmarket', 'dusk-moorings', 'highheath-abbey', 'barleyridge', 'brandby-mine', 'bellwick',
  'ashengate', 'northmoor-cave', 'goldmere-tower', 'scarwell', 'frostbarrow',
]
{
  const frames = readdirSync('var/video/places/frames').filter((f) => f.endsWith('.png')).sort()
  if (frames.length !== PLACE_IDS.length) throw new Error(`${frames.length} stills for ${PLACE_IDS.length} places`)
  mkdirSync(join(OUT, 'places'), { recursive: true })
  frames.forEach((f, i) => {
    const src = join('var/video/places/frames', f), id = PLACE_IDS[i]
    ff('-i', src, '-c:v', 'libwebp', '-quality', '84', join(OUT, 'places', `${id}.webp`))
    ff('-i', src, '-vf', 'scale=480:-2:flags=lanczos', '-c:v', 'libwebp', '-quality', '80', join(OUT, 'places', `${id}-s.webp`))
  })
}

// ------------------------------------------------------------------ the cast: their own portraits and their design sheets
const CAST = ['lumi', 'ilse', 'nessa', 'lina', 'severin', 'tobin']
const MOODS = ['neutral', 'neutral-blink', 'happy', 'happy-blink', 'happy-talk']
for (const id of CAST) {
  mkdirSync(join(OUT, 'cast', id), { recursive: true })
  for (const m of MOODS) copy(join('games/openworld/public/assets/lsw/Portraits', id, `${m}.webp`), join(OUT, 'cast', id, `${m}.webp`))
  copy(join('docs/cast', `${id}-design.webp`), join(OUT, 'cast', `${id}-design.webp`))
}
