// A creature kind's own piece of gear (its trophy), found on felling one (Diablo's and Dungeon Fighter's named drops,
// with a pity count): the kind names its piece and how often a felling finds it (its type's `trophy` and
// `trophyChance` props, the game's data); the game's defeat rule passes them to the feller (notify what = defeat,
// params trophy, trophyChance) and the feller's own rule takes it (`trophy`). By that chance, or surely once the feller
// has felled so many of the kind without one (`Ontology.loot.pity`; the count is the feller's own, `trophy.<type>`).
// Made, it rolls its extras as all gear does (engine affixes.ts).

import { rollAffixes, type EffectImpl, type Engine, type Text } from '@openworld/engine'

/** How many of a kind one fells without its piece before the next surely gives it, unless the game says. */
export const PITY = 50

/**
 * The pieces the game's own kinds name as their trophies. Only these are ever made: an event naming another type
 * (a patch's emit, a prop a rule set on a creature) finds nothing, and neither does a kind the AI made (a learned type),
 * so no rule can put into a bag what the game's own felling could not.
 */
export function trophyTypes(eng: Engine): Set<string> {
  const learned = new Set(eng.lib.types.map((t) => t.id))
  const out = new Set<string>()
  for (const t of Object.values(eng.world.onto.data.types)) {
    const piece = t.props?.trophy
    if (typeof piece === 'string' && !learned.has(t.id)) out.add(piece)
  }
  return out
}

/** A word with `{item}` filled by the piece's name, in each language. */
function fill(t: Text, name: (l: 'en' | 'zh') => string): Text {
  if (typeof t === 'string') return t.replaceAll('{item}', name('en'))
  return { en: t.en.replaceAll('{item}', name('en')), zh: (t.zh ?? t.en).replaceAll('{item}', name('zh')) }
}

/** `trophy {}`: the host felled a creature whose kind keeps a piece (params trophy, trophyChance); it may come to its bag. */
export const trophy: EffectImpl = (fx, eff, ev) => {
  const eng = fx.eng
  const w = eng.world
  const host = fx.hostEntity(ev)
  const type = String(ev.params?.trophy ?? '')
  if (!host || !type || !w.onto.hasType(type) || !trophyTypes(eng).has(type)) return
  const key = `trophy.${type}`
  const count = w.num(host, key) + 1
  const loot = w.onto.data.loot
  // the felling hand's luck widens the chance (World.stat `luck`: a tenth of luck, a tenth more often)
  const chance = Number(ev.params?.trophyChance ?? 0) * (1 + Math.max(0, w.stat(host, 'luck')))
  // a chance site of its own (World.chance): the sandbox's repeat check explores both of its outcomes
  if (count < (loot?.pity ?? PITY) && !w.chance(eff, Number.isFinite(chance) ? Math.min(1, chance) : 0)) return w.setProp(host, key, count)
  w.setProp(host, key, 0)
  const def = w.onto.resolve(type)
  const slot = def.props.slot
  // (a trophy's level is its kind's: the type's; it rolls the table's count of extras, as wide as its level, having no quality)
  const made = w.create(type, { on: 'inside', holder: host.id }, { props: typeof slot === 'string' ? rollAffixes(w.onto.data, slot, () => w.rand(), { level: Number(def.props.level) || 1 }) : {} })
  eng.touch({ e: made.id })
  const p = w.posOf(host)
  if (p) w.fx.push({ t: 'pickup', item: made.id, sprite: def.sprite ?? type, name: def.name ?? type, map: p.map, x: p.x, y: p.y })
  // what the one at the keys is told, in the game's own words
  if (loot?.found && host.id === w.state.player) w.fx.push({ t: 'log', text: fill(loot.found, (l) => eng.nameOf({ e: made.id }, l)), tone: 'good' })
}
