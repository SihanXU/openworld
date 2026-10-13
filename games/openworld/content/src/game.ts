// This game as the engine and the services around it read it (engine/src/gamedef.ts, docs/engine-split.md):
// what the modder and the runtime are handed instead of importing the content.

import type { Engine, GameDef } from '@openworld/engine'
import { HUNGER_EVERY } from '@openworld/modules'
import { STORY_RULES } from './ford.ts'
import { TERRAIN_CHARS, buildOntology } from './ontology.ts'
import { BASE_RULES } from './rules.ts'

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
    }
    // The First Seal's stage 40 (across the river) showed the White Knight until the Pilgrim's Road came between them
    // (2026-10-12, docs/chapter-1.md §14): it shows the oath at the Pilgrims' Rest now, and the knight from stage 80. A
    // save at that stage from before shows what the stage shows now (the oath's own fact moves it on, as ever).
    const seal = w.get('quest.first_seal')
    if (seal && w.prop(seal, 'state') === 'active' && w.prop(seal, 'stage') === 40 && w.prop(seal, 'obj.oath') === undefined) {
      w.setProp(seal, 'obj.oath', 'shown')
      if (w.prop(seal, 'obj.knight') === 'shown') w.setProp(seal, 'obj.knight', undefined)
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
