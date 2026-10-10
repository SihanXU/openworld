// The codex's entries (engine codex.ts): every concrete kind of item (a type that carries its own
// picture) and every kind of creature, but the boss kits without a place in the story yet (they are
// fought only in the Boss Challenge, docs/bosses.md).

import { buildOntology } from './ontology.ts'

const CHALLENGE_ONLY = new Set(['actor/creature/sin/lust', 'actor/creature/sin/envy', 'actor/creature/sin/pride'])

export function codexEntries(): { items: string[]; creatures: string[] } {
  const types = Object.values(buildOntology().types)
  const ids = types.map((t) => t.id)
  const leaf = (id: string) => !ids.some((x) => x.startsWith(id + '/'))
  return {
    items: types.filter((t) => t.id.startsWith('item/') && t.sprite).map((t) => t.id),
    creatures: ids.filter((id) => id.startsWith('actor/creature/') && leaf(id) && !CHALLENGE_ONLY.has(id)),
  }
}
