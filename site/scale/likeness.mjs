// How alike two pictures look, for the scale film's "no picture twice": a picture's signature is its gradient hash
// (16 x 16 of grey, each cell brighter or darker than its right-hand neighbour: the layout of the thing) and its
// colour (the mean colour of each of 4 x 4 cells). Two pictures are alike when both are close: much the same layout in
// much the same colours. Pictures are read through ffmpeg (any file it reads, a part of it cut out first).
import { spawnSync } from 'node:child_process'

/** The pixels of a picture (or of a part of it: crop = [x, y, w, h]) brought to w x h, RGB. */
export function pixels(file, w, h, crop) {
  const vf = [crop && `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}`, `scale=${w}:${h}:flags=area`, 'format=rgb24'].filter(Boolean).join(',')
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', vf, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 })
  if (r.status !== 0 || r.stdout.length !== w * h * 3) throw new Error(`cannot read ${file}`)
  return r.stdout
}

/** A picture's signature: { hash: 256 bits as 0/1, colour: 16 RGB means }. */
export function signature(file, crop) {
  const g = pixels(file, 17, 16, crop), c = pixels(file, 4, 4, crop)
  const grey = (i) => 0.299 * g[i * 3] + 0.587 * g[i * 3 + 1] + 0.114 * g[i * 3 + 2]
  const hash = new Uint8Array(256)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) hash[y * 16 + x] = grey(y * 17 + x + 1) > grey(y * 17 + x) ? 1 : 0
  return { hash: [...hash], colour: [...c] }
}

/** How far apart: the bits that differ of 256, and the mean colour difference (0–255). */
export function distance(a, b) {
  let bits = 0
  for (let i = 0; i < 256; i++) if (a.hash[i] !== b.hash[i]) bits++
  let col = 0
  for (let i = 0; i < 48; i++) col += Math.abs(a.colour[i] - b.colour[i])
  return { bits, colour: col / 48 }
}
/** Alike: within BITS of each other's layout and COLOUR of each other's colours, or within SAME of each other's layout
 *  whatever their colours (the same view in other light or another season). Measured on the film's own pictures: a hall
 *  furnished twice alike with other people in it comes within 22–40 bits and 3–6 of colour, the same window of a place
 *  in summer and in snow within 10 bits; two halls of different plans 44 bits or more apart, two places' windows more. */
export const BITS = 40, COLOUR = 7, SAME = 16
export const alike = (a, b) => { const d = distance(a, b); return (d.bits <= BITS && d.colour <= COLOUR) || d.bits <= SAME }
