// The active boss art. Alberic uses the delivered pixel sheets, and Matthias, Ele, Nacht, the Witnesses and Astra the same
// sheets redrawn; the other bosses keep their atlases.
import type { ActorDef, FxDef } from './types.ts'
import delivery from './boss01_01.json'

// The kits in play (content/src/bosses.ts); the removed kits' art stays in public/assets/lsw/Bosses.
export const SIN_SKILLS: Record<string, string[]> = {
  alberic: ['arrow', 'volley', 'thorns'], lust: ['petal', 'lure', 'thorns'], envy: ['daggers', 'mirror', 'blink'], pride: ['wing', 'mirror', 'crown'],
  matthias: ['sword', 'lash', 'charge', 'threads', 'post'],
  ele: ['weigh', 'pan', 'grain', 'famine', 'lighter'],
  nacht: ['reap', 'charge', 'nails', 'knell', 'reins'],
  witnesses: ['howlong', 'robes', 'hands', 'lance', 'myriad'],
  astra: ['crown', 'welts', 'weight', 'nails', 'lance', 'night'],
}
export const SIN_ACTORS: Record<string, ActorDef> = Object.fromEntries(Object.keys(SIN_SKILLS).map((id) => [
  `boss:sin:${id}`, { dir: `lsw/Bosses/${id}`, sheet: 'actions.png', cols: 4, rows: 5, anchorY: id === 'envy' ? 29 : id === 'alberic' ? 46 : 93, scale: id === 'envy' ? 1.25 : id === 'alberic' ? 1.5 : id === 'pride' ? 2 : 1.75 },
]))
export const SIN_FX: Record<string, FxDef> = Object.fromEntries(Object.entries(SIN_SKILLS).flatMap(([id, skills]) => skills.map((skill) => [
  `sin:${id}:${skill}`, { img: `lsw/Bosses/${id}/effect-${skill}.png`, fw: 64, fh: 64, frames: 4, fps: 12, scale: id === 'envy' ? 1 : 1.5 },
])))

/** Original delivery metadata is the source of frame dimensions, timing and hit/recovery boundaries. */
export const ALBERIC_DELIVERY = delivery
export const ALBERIC_CLIPS = ALBERIC_DELIVERY.animations
export type AlbericClip = keyof typeof ALBERIC_CLIPS
export type AlbericWalkClip = 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right'
export type AlbericAttackClip = 'attack_down' | 'attack_left' | 'attack_right'
export const albericFrameMs = (clip: AlbericClip): number => ALBERIC_CLIPS[clip].frame_ms
const ALBERIC_DIR = 'lsw/Bosses/alberic/v3' // Existing effects are unchanged.

/**
 * The bosses drawn on strips in the delivery's layout (an idle, four walks, three attacks: ALBERIC_CLIPS), by kit: the
 * folder of their sheets. The later Seal-bearers' and Astra's are Alberic's redrawn (games/openworld/tools/src/art/
 * matthias.py, ele.py, nacht.py, witnesses.py, astra.py over stripkit.py), frame for frame, so they keep his clips'
 * frames, timings and hit frames; a wider body keeps its own frame and anchor (STRIP_LAYOUTS).
 */
export const STRIP_BOSSES: Record<string, string> = {
  alberic: 'lsw/Bosses/alberic/boss01_01', matthias: 'lsw/Bosses/matthias', ele: 'lsw/Bosses/ele', nacht: 'lsw/Bosses/nacht',
  witnesses: 'lsw/Bosses/witnesses', astra: 'lsw/Bosses/astra',
}
/** A strip boss whose frames are not the delivery's 60x76: Nacht on his horse, the Witnesses three abreast. */
export const STRIP_LAYOUTS: Record<string, { frame: [number, number]; anchor: [number, number]; scale: number }> = {
  nacht: { frame: [96, 100], anchor: [48, 95], scale: 1.75 },
  witnesses: { frame: [90, 80], anchor: [45, 75], scale: 2 },
}
export const isStripBoss = (kit: string): boolean => kit in STRIP_BOSSES
for (const [kit, dir] of Object.entries(STRIP_BOSSES)) {
  const layout = STRIP_LAYOUTS[kit]
  const anchor = layout?.anchor ?? ALBERIC_DELIVERY.anchor
  SIN_ACTORS[`boss:sin:${kit}`] = {
    dir, sheet: ALBERIC_CLIPS.idle.sheet,
    cols: ALBERIC_CLIPS.idle.frames, rows: 1,
    // The delivery names an anchor pixel; the pivot is its horizontal centre and lower edge.
    anchorX: anchor[0] + 0.5, anchorY: anchor[1] + 1, scale: layout?.scale ?? 2,
    clips: Object.fromEntries(Object.entries(ALBERIC_CLIPS).map(([name, clip]) => [name, {
      sheet: clip.sheet, frames: clip.frames, frameWidth: layout?.frame[0] ?? clip.frame_w, frameHeight: layout?.frame[1] ?? clip.frame_h,
      frameMs: clip.frame_ms, loop: clip.loop,
    }])),
  }
}
SIN_FX['sin:alberic:arrow'] = { img: `${ALBERIC_DIR}/effect-arrow.png`, fw: 96, fh: 96, frames: 6, fps: 12, beam: true }
SIN_FX['sin:alberic:volley'] = { img: `${ALBERIC_DIR}/effect-volley.png`, fw: 96, fh: 96, frames: 6, fps: 10, scale: 0.65, originY: 0.85 }
SIN_FX['sin:alberic:thorns'] = { img: `${ALBERIC_DIR}/effect-thorns.png`, fw: 64, fh: 64, frames: 6, fps: 10, scale: 0.625, originY: 0.85 }
// Matthias's effects are played on every cell they strike (their skills' `fxPlacement: 'pattern'`), so each is small and
// sits on its cell; the threads strike down onto their spot.
const MATTHIAS_DIR = STRIP_BOSSES.matthias
SIN_FX['sin:matthias:sword'] = { img: `${MATTHIAS_DIR}/effect-sword.png`, fw: 64, fh: 64, frames: 5, fps: 14, scale: 0.6, originY: 0.7 }
SIN_FX['sin:matthias:lash'] = { img: `${MATTHIAS_DIR}/effect-lash.png`, fw: 64, fh: 64, frames: 5, fps: 14, scale: 0.6, originY: 0.85 }
SIN_FX['sin:matthias:charge'] = { img: `${MATTHIAS_DIR}/effect-charge.png`, fw: 64, fh: 64, frames: 5, fps: 12, scale: 0.6, originY: 0.75 }
SIN_FX['sin:matthias:threads'] = { img: `${MATTHIAS_DIR}/effect-threads.png`, fw: 64, fh: 64, frames: 6, fps: 12, scale: 0.75, originY: 0.9 }
SIN_FX['sin:matthias:post'] = { img: `${MATTHIAS_DIR}/effect-post.png`, fw: 64, fh: 64, frames: 6, fps: 12, scale: 0.6, originY: 0.6 }
// The later bosses' effects, drawn in the same way (a 64x64 frame, played on each cell a skill strikes): how many frames
// each strip holds, and where on its cell it sits (originY: the frame's height that lies on the cell's foot).
const LATER_FX: Record<string, Record<string, [frames: number, originY: number, scale?: number]>> = {
  ele: { weigh: [5, 0.7], pan: [6, 0.8], grain: [6, 0.9], famine: [6, 0.9], lighter: [6, 0.65, 0.75] },
  nacht: { reap: [5, 0.7], charge: [5, 0.7], nails: [6, 0.9], knell: [6, 0.6], reins: [6, 0.85] },
  witnesses: { howlong: [6, 0.6, 0.75], robes: [6, 0.75], hands: [5, 0.85], lance: [5, 0.9], myriad: [6, 0.75, 0.75] },
  astra: { crown: [6, 0.65, 0.75], welts: [5, 0.6], weight: [5, 0.8], nails: [5, 0.9], lance: [5, 0.5], night: [6, 0.75] },
}
for (const [kit, skills] of Object.entries(LATER_FX))
  for (const [skill, [frames, originY, scale]] of Object.entries(skills))
    SIN_FX[`sin:${kit}:${skill}`] = { img: `${STRIP_BOSSES[kit]}/effect-${skill}.png`, fw: 64, fh: 64, frames, fps: 12, scale: scale ?? 0.6, originY }
