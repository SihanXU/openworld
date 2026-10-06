// Original imagegen art. Keep the v5 source atlas; play curated 8–12-pose clips at 20 fps.
import type { ActorDef, FxDef } from './types.ts'

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

// Versioned assets preserve the previous hand-drawn atlas and avoid stale browser caches.
export const ALBERIC_ATLAS_COLUMNS = 32
export const ALBERIC_FPS = 20
export const ALBERIC_FRAME_MS = 1000 / ALBERIC_FPS
// Atlas columns, not copies or new drawings. The three skill clips split before column 16.
export const ALBERIC_CLIPS = {
  idle: [0, 4, 8, 12, 16, 20, 24, 28],
  walk: [0, 3, 6, 10, 13, 16, 19, 22, 26, 29],
  thorns: [0, 3, 6, 9, 12, 15, 16, 19, 22, 25, 28, 31],
  arrow: [0, 3, 6, 9, 12, 15, 16, 19, 22, 25, 28, 31],
  volley: [0, 3, 6, 9, 12, 15, 16, 19, 22, 25, 28, 31],
  hurt: [0, 4, 8, 12, 16, 21, 26, 31],
  death: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 31],
} as const
const ALBERIC_DIR = 'lsw/Bosses/alberic/v3' // Existing effects are unchanged.
SIN_ACTORS['boss:sin:alberic'] = { dir: 'lsw/Bosses/alberic/v5', sheet: 'actions.png', cols: ALBERIC_ATLAS_COLUMNS, rows: 21, anchorY: 88, scale: 1.25 }
SIN_FX['sin:alberic:arrow'] = { img: `${ALBERIC_DIR}/effect-arrow.png`, fw: 96, fh: 96, frames: 6, fps: 12, beam: true }
SIN_FX['sin:alberic:volley'] = { img: `${ALBERIC_DIR}/effect-volley.png`, fw: 96, fh: 96, frames: 6, fps: 10, scale: 0.65, originY: 0.85 }
SIN_FX['sin:alberic:thorns'] = { img: `${ALBERIC_DIR}/effect-thorns.png`, fw: 64, fh: 64, frames: 6, fps: 10, scale: 0.625, originY: 0.85 }
