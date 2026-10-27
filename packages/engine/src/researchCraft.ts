// Research's authority stays with the game. The model chooses names, known capabilities and
// ingredients; this module supplies identities, inherited behavior, costs and progression gates.
import { Engine } from './engine.ts'
import { ModPort, type Patch } from './mod.ts'
import { RuleLibrary } from './rules.ts'
import { INVENTION, readResearchReply, type ResearchCatalogue, type ResearchDesign } from './research.ts'
import type { Recipe, TypeDef } from './types.ts'

/** The tag of a person one may talk a new recipe over with (the content says who: a smith, an innkeeper…). */
export const CRAFTSPERSON = 'craftsperson'

const form = /^(item\/(tool|weapon|armor|clothing|food))\//
const text = (x: unknown) => typeof x === 'string' ? x : ''

function price(eng: Engine, type: string): number {
  const v = eng.world.onto.resolve(type).props.value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

function reference(eng: Engine, type: string): Recipe | undefined {
  const w = eng.world
  if (!form.test(type) || eng.lib.types.some((t) => t.id === type) || !w.onto.data.types[type]) return
  if (!w.onto.resolve(type).tags.includes('portable')) return
  return [...eng.recipes.values()].find((r) => r.make.type === type && r.needs.length > 0 &&
    !r.make.props && !r.make.tags && !r.bonus &&
    (!r.skill || w.hasTag(w.player, `skill:${r.skill}`)) &&
    (!r.unlockedBy || (w.story && w.num(w.story, r.unlockedBy.fact, 0) >= (r.unlockedBy.level ?? 1))) &&
    r.needs.every((n) => price(eng, n.type) > 0))
}

/** Only actual inventory materials and currently unlocked craft families are offered. */
export function researchCatalogue(eng: Engine): ResearchCatalogue {
  const w = eng.world
  const materials = [...new Set([w.player.held, ...(w.player.contents ?? [])].flatMap((id) => {
    const e = w.get(id)
    return e && !e.frozenBy && /^(item\/material|item\/food)\//.test(e.type) && price(eng, e.type) > 0 ? [e.type] : []
  }))].slice(0, 80)
  const prototypes = [...new Set([...eng.recipes.values()].map((r) => r.make.type))].filter((id) => reference(eng, id)).slice(0, 80)
  return { materials, prototypes, guidance: {
    materials: materials.map((type) => ({ type, value: price(eng, type), available: eng.controls.count(type) })),
    prototypes: prototypes.map((type) => {
      const r = reference(eng, type)!
      return { type, minCost: Math.max(price(eng, type), r.needs.reduce((n, m) => n + price(eng, m.type) * m.count, 0) / (r.count ?? 1)), station: r.station ?? 'hands' }
    }),
  } }
}

/** Prepare a recipe, without changing the world. Recomputed at confirmation, not trusted from a UI. */
export function researchPatch(eng: Engine, proposed: unknown, id: string): { patch: Patch; design: ResearchDesign } {
  const design = readResearchReply({ reply: 'draft', design: proposed }, researchCatalogue(eng)).design!
  const base = reference(eng, design.prototype)
  if (!base) throw new Error('This craft is not unlocked')
  if (!id.startsWith(`${design.prototype}${INVENTION}`) || eng.world.onto.data.types[id]) throw new Error('Invalid invention identity')
  const cost = design.ingredients.reduce((n, m) => n + price(eng, m.type) * m.count, 0)
  const baseline = base.needs.reduce((n, m) => n + price(eng, m.type) * m.count, 0) / (base.count ?? 1)
  // A new material combination may not cheaply bypass an established production chain.
  if (cost < Math.max(baseline, price(eng, design.prototype))) throw new Error('The proposed materials are too cheap for this craft; add materials or choose a simpler item')
  const original = eng.world.onto.resolve(design.prototype)
  const first = eng.world.onto.resolve(design.ingredients[0].type)
  const type: TypeDef = {
    id, name: typeof design.name === 'string' ? { en: design.name, zh: design.name } : design.name, researched: true, makeup: design.ingredients,
    station: base.station ?? 'hands', craftLevel: base.level ?? 1,
    ...(base.skill && { craftSkill: base.skill }),
    ...(base.unlockedBy && { unlockedBy: structuredClone(base.unlockedBy) }),
    ...(base.tools && { tools: [...base.tools] }),
    // Cap resale at both the original item's worth and the inputs. Effects are inherited;
    // the model cannot choose arbitrary properties, tags, scripts or story facts.
    props: { value: Math.min(price(eng, design.prototype), cost), ...(text(first.props.material || original.props.material) && { material: text(first.props.material || original.props.material) }) },
  }
  return { design, patch: { artifacts: [{ kind: 'type', type }], author: 'player-research', note: 'A recipe developed in conversation and trial-crafted by the player.' } }
}

function stationReady(eng: Engine, r: Recipe): boolean {
  return !r.station || r.station === 'hands' || eng.world.stationsNear(eng.world.player).has(r.station)
}

/** Validate and replay the real craft on an isolated state before the synchronous live craft.
 * No arbitrary effects or actor writes: both trials use the game's normal crafting event.
 */
export function trialResearch(eng: Engine, port: ModPort, proposed: unknown, id: string): TypeDef {
  const { patch } = researchPatch(eng, proposed, id)
  const type = (patch.artifacts[0] as { kind: 'type'; type: TypeDef }).type
  const trial = new Engine(structuredClone(eng.world.state), eng.world.onto.data, RuleLibrary.fromJSON(eng.lib.toJSON()))
  trial.quality = { ...eng.quality }
  trial.tier = eng.tier
  trial.loadInvariants(structuredClone(eng.invariants), [...eng.protectedFacts])
  for (const [key, skill] of eng.skills) trial.skills.set(key, structuredClone(skill))
  for (const [key, recipe] of eng.recipes) trial.recipes.set(key, structuredClone(recipe))
  const trialPort = new ModPort(trial)
  const checked = trialPort.submit(undefined, patch)
  if (!checked.ok) throw new Error(checked.errors.join('; '))
  const r = trial.recipes.get(id)!
  if (!stationReady(trial, r)) throw new Error('Stand beside the required crafting station to try this recipe')
  if (!trial.controls.canCraft(r)) throw new Error('You need the recipe materials, tools and skills before trying it')
  if (!trial.controls.craft(r) || trial.controls.count(id) < 1) throw new Error('The trial did not produce an item; nothing was consumed')
  // No await between replay and real submission/craft: inventory and unlocks cannot race.
  const committed = port.submit(undefined, patch)
  if (!committed.ok) throw new Error(committed.errors.join('; '))
  if (!eng.controls.craft(eng.recipes.get(id)!) || eng.controls.count(id) < 1) {
    eng.lib.removeType(id)
    eng.world.onto.removeType(id)
    eng.recipes.delete(id)
    throw new Error('The item was not made; the recipe was not learned')
  }
  return type
}
