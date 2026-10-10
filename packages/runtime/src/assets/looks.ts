// Which character look a person is drawn with (the world's renderer and the codex alike).

import type { Mood } from '@openworld/engine'
import { catalog } from '../game.ts'
import { hash2 } from './ground.ts'
import type { ActorDef } from './types.ts'

/** A person's character look: their own, else one of their role's picked by their id (the world and the codex draw the same one). */
export function personLook(id: string, type: string, look?: string): string {
  const role = type.split('/').pop()!
  const pick = look ?? catalog().roles[role]?.[hash2(id.length, id.charCodeAt(id.length - 1)) % (catalog().roles[role]?.length || 1)]
  return pick && catalog().characters[pick] ? pick : (catalog().roles.villager?.[0] ?? Object.keys(catalog().characters)[0])
}

/** The portrait for a line's mood: that frame of the face's strip, or the plain faceset (one frame) when it has no such mood. */
export function faceFrame(a: ActorDef | undefined, mood?: Mood): { img: string; frame: number; frames: number } | undefined {
  if (!a?.faceset) return undefined
  const i = mood && a.faces ? a.faces.moods.indexOf(mood) : -1
  return i >= 0 ? { img: a.faces!.strip, frame: i + 1, frames: a.faces!.moods.length + 1 } : { img: `${a.dir}/${a.faceset}`, frame: 0, frames: 1 }
}
