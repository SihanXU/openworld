// This game as the engine and the services around it read it (engine/src/gamedef.ts, docs/engine-split.md):
// what the modder and the runtime are handed instead of importing the content.

import type { Engine, GameDef } from '@openworld/engine'
import { HUNGER_EVERY } from '@openworld/modules'
import { STORY_RULES } from './ford.ts'
import { TERRAIN_CHARS, buildOntology } from './ontology.ts'
import { BASE_RULES } from './rules.ts'
import { SET_DEFS, setOfSlot } from './sets.ts'

/** The forged sets' ids (each profession's armour; its trinkets are `<id>_trinkets`). */
const FORGED = new Set(SET_DEFS.map((s) => s.id))

/** This game's own save history: what its older saves kept that the world reads otherwise now. */
function upgradeSave(eng: Engine): void {
    const w = eng.world
    for (const e of Object.values(w.state.entities)) {
      // Early Iron Stomach saves used its delta as an absolute interval (faster, not slower).
      if (e.tags?.includes('skill:iron-stomach') && e.props?.hungerEvery === 150) w.setProp(e, 'hungerEvery', 450)
      // Hunger's base pace was a point every 300 ticks (now HUNGER_EVERY): a skill's kept interval on
      // the old scale (300, 450, 600) is scaled to the new one.
      const every = e.props?.hungerEvery
      if (every === 300 || every === 450 || every === 600) w.setProp(e, 'hungerEvery', Math.round((every * HUNGER_EVERY) / 300))
      // the night-born were marked by a prop before they had a tag
      if (e.props?.nightborn) (w.setProp(e, 'nightborn', undefined), w.addTag(e, 'nightborn'))
      // a smith's Masterwork was its station's `<station>:masterwork` before the engine named the lift `<station>:lift`
      for (const [key, v] of Object.entries(e.props ?? {})) if (key.endsWith(':masterwork') && typeof v === 'number') (w.setProp(e, `${key.slice(0, -':masterwork'.length)}:lift`, v), w.setProp(e, key, undefined))
      // a forged piece carried its profession's one set whatever its slot; a profession's gear is two sets now, its armour
      // and its trinkets, and the weapon and the off hand are in neither (sets.ts): each piece takes its slot's
      const set = e.props?.set
      if (typeof set === 'string' && FORGED.has(set)) {
        const now = setOfSlot(set, String(w.prop(e, 'slot')))
        if (now !== set) w.setProp(e, 'set', now)
      }
    }
}

export const GAME: GameDef = {
  id: 'openworld',
  ontology: buildOntology,
  rules: [...BASE_RULES, ...STORY_RULES],
  terrainChars: TERRAIN_CHARS,
  upgradeSave,
}

export default GAME
