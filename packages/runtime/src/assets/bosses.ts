// The active boss art. Alberic uses the delivered pixel sheets; the other bosses keep their atlases.
import type { ActorDef, FxDef } from './types.ts'
import delivery from './boss01_01.json'

// The kits in play (content/src/bosses.ts); the removed kits' art stays in public/assets/lsw/Bosses.
export const SIN_SKILLS: Record<string, string[]> = {
  alberic: ['arrow', 'volley', 'thorns'], lust: ['petal', 'lure', 'thorns'], envy: ['daggers', 'mirror', 'blink'], pride: ['wing', 'mirror', 'crown'],
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
export type AlbericAttackClip = Exclude<AlbericClip, 'idle'>
export const albericFrameMs = (clip: AlbericClip): number => ALBERIC_CLIPS[clip].frame_ms
const ALBERIC_DIR = 'lsw/Bosses/alberic/v3' // Existing effects are unchanged.
SIN_ACTORS['boss:sin:alberic'] = {
  dir: 'lsw/Bosses/alberic/boss01_01', sheet: ALBERIC_CLIPS.idle.sheet,
  cols: ALBERIC_CLIPS.idle.frames, rows: 1,
  // The delivery names an anchor pixel; the pivot is its horizontal centre and lower edge.
  anchorX: ALBERIC_DELIVERY.anchor[0] + 0.5, anchorY: ALBERIC_DELIVERY.anchor[1] + 1, scale: 2,
  clips: Object.fromEntries(Object.entries(ALBERIC_CLIPS).map(([name, clip]) => [name, {
    sheet: clip.sheet, frames: clip.frames, frameWidth: clip.frame_w, frameHeight: clip.frame_h,
    frameMs: clip.frame_ms, loop: clip.loop,
  }])),
}
SIN_FX['sin:alberic:arrow'] = { img: `${ALBERIC_DIR}/effect-arrow.png`, fw: 96, fh: 96, frames: 6, fps: 12, beam: true }
SIN_FX['sin:alberic:volley'] = { img: `${ALBERIC_DIR}/effect-volley.png`, fw: 96, fh: 96, frames: 6, fps: 10, scale: 0.65, originY: 0.85 }
SIN_FX['sin:alberic:thorns'] = { img: `${ALBERIC_DIR}/effect-thorns.png`, fw: 64, fh: 64, frames: 6, fps: 10, scale: 0.625, originY: 0.85 }
