// Gear came in levels (2026-10-13, world-model.md §6.8): a piece from an older save that has none is stamped with its
// kind's (a monster's own piece, a Stigmatic arm: the type's level) or the first. Its numbers stay what they were: what
// one had is not taken away, nor made more.
//
// And the Vowbound came into their vows (2026-10-13, items.ts VOWS): a Vowbound piece from before has none, and the
// named ones were written with a number or two where a common piece rolled three extras. Each takes its vow (the story's
// own for a named piece, NAMED_VOWS; else one drawn from its id), its main stats are brought up to its tier's (never
// down), and it rolls the extras it never had.

import { gearProps, rollAffixes, type Game } from '@openworld/engine'
import { GEAR_LEVELS } from './gear.ts'
import { MATERIAL_DEFS, QUALITY_DEFS, VOW_IDS } from './items.ts'

export const GEAR_LAYOUT = 'content.gear-levels-v1'
export const VOWS_LAYOUT = 'content.gear-vows-v1'

/** The story's named Vowbound pieces' vows, by their English name (hollow.ts, quests/side.ts say the same). */
export const NAMED_VOWS: Record<string, string> = {
  "Brother Odo's Pauldrons": 'holdfast',
  "Sister Maren's Ring": 'mercy',
  "Tomas's Belt of Vigil": 'vigil',
  "Fennick's Squire Helm": 'ward',
  "Cassian's Prayer Cord": 'dawn',
}

export function migrateGear(game: Game): void {
  const w = game.engine.world
  if (w.fact(GEAR_LAYOUT)) return
  for (const e of Object.values(w.state.entities)) {
    const def = w.onto.resolve(e.type)
    const slot = e.props?.slot ?? def.props.slot
    if (typeof slot !== 'string' || typeof e.props?.level === 'number' || typeof def.props.level === 'number') continue
    w.setProp(e, 'level', 1)
  }
  w.setFact(GEAR_LAYOUT, true)
}

/** A number from a string (FNV-1a): which vow a nameless piece draws. */
const seedOf = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  return h
}

export function migrateVows(game: Game): void {
  const w = game.engine.world
  if (w.fact(VOWS_LAYOUT)) return
  const vowed = QUALITY_DEFS().find((q) => q.id === 'vowed')
  for (const e of Object.values(w.state.entities)) {
    const def = w.onto.resolve(e.type)
    const slot = e.props?.slot ?? def.props.slot
    const tags = [...(e.tags ?? []), ...def.tags]
    if (typeof slot !== 'string' || !tags.includes('quality:vowed')) continue
    const level = w.num(e, 'level', 1)
    // its vow
    if (typeof w.prop(e, 'vow') !== 'string') {
      const en = typeof e.name === 'object' ? e.name.en : undefined
      w.setProp(e, 'vow', (en && NAMED_VOWS[en]) ?? VOW_IDS[seedOf(e.id) % VOW_IDS.length])
    }
    // its numbers, up to its tier's in its material and level
    const material = tags.find((t) => t.startsWith('material:'))?.slice(9)
    const main = gearProps(def.props, material ? MATERIAL_DEFS[material] : undefined, vowed, level, GEAR_LEVELS)
    for (const [k, v] of Object.entries(main)) if (k !== 'level' && v > w.num(e, k)) w.setProp(e, k, v)
    // the extras it never rolled
    if (!Object.keys(e.props ?? {}).some((k) => k.startsWith('sub:'))) for (const [k, v] of Object.entries(rollAffixes(w.onto.data, slot, () => w.rand(), { quality: 'vowed', level }))) w.setProp(e, k, v)
  }
  w.setFact(VOWS_LAYOUT, true)
}
