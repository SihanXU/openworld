// A look's names (docs/looks.md): pure, for the game, the wiki and the review sheets alike.

import { generateLook } from '@openworld-game/content'
import { lookCode, type Look } from '@openworld/engine'

/** A short name for a look (its textures'): the same look, the same name. */
export function figureId(look: Look): string {
  const s = lookCode(look)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** A person no one gave a look (one a rule or the modder brought): a look drawn from their id, as the world draws the crowd's. */
export function crowdLook(id: string, type: string, age = 30): Look {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return generateLook(id, { sex: h & 1 ? 'female' : 'male', age, role: type.split('/').pop() })
}
