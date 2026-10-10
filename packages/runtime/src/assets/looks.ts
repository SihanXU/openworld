// Which character look a person is drawn with (the world's renderer and the codex alike).

import { CATALOG } from './catalog.ts'
import { hash2 } from './ground.ts'

/** A person's character look: their own, else one of their role's picked by their id (the world and the codex draw the same one). */
export function personLook(id: string, type: string, look?: string): string {
  const role = type.split('/').pop()!
  const pick = look ?? CATALOG.roles[role]?.[hash2(id.length, id.charCodeAt(id.length - 1)) % (CATALOG.roles[role]?.length || 1)]
  return pick && CATALOG.characters[pick] ? pick : (CATALOG.roles.villager?.[0] ?? Object.keys(CATALOG.characters)[0])
}
