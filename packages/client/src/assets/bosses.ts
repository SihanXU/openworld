// Original imagegen art: columns are time, rows idle / walk / attack / cast / hurt+death.
import type { ActorDef, FxDef } from './types.ts'

export const SIN_SKILLS: Record<string, string[]> = {
  greed: ['stamp', 'coins', 'chains'], gluttony: ['bite', 'soup', 'gulp'],
  sloth: ['stomp', 'dream', 'shell'], lust: ['petal', 'lure', 'thorns'],
  wrath: ['cleave', 'fissure', 'rage'], envy: ['daggers', 'mirror', 'blink'],
  pride: ['wing', 'mirror', 'crown'],
}
export const SIN_ACTORS: Record<string, ActorDef> = Object.fromEntries(Object.keys(SIN_SKILLS).map((id) => [
  `boss:sin:${id}`, { dir: `lsw/Bosses/${id}`, sheet: 'actions.png', cols: 4, rows: 5, anchorY: id === 'envy' ? 29 : 93, scale: id === 'envy' ? 1.25 : id === 'sloth' ? 2.25 : id === 'pride' ? 2 : 1.75 },
]))
export const SIN_FX: Record<string, FxDef> = Object.fromEntries(Object.entries(SIN_SKILLS).flatMap(([id, skills]) => skills.map((skill) => [
  `sin:${id}:${skill}`, { img: `lsw/Bosses/${id}/effect-${skill}.png`, fw: 64, fh: 64, frames: 4, fps: 12, scale: id === 'envy' ? 1 : 1.5 },
])))
