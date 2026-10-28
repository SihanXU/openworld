// Research's authority stays with the game. The model chooses names, known capabilities and
// ingredients; this module supplies identities, inherited behavior, costs and progression gates.
import { Engine } from './engine.ts'
import { ModPort, type Patch } from './mod.ts'
import { RuleLibrary } from './rules.ts'
import { INVENTION, readResearchReply, type NewDesign, type ResearchCatalogue, type ResearchDesign, type VariantDesign } from './research.ts'
import type { OntologyIndex } from './ontology.ts'
import type { Recipe, TypeDef } from './types.ts'

/** The tag of a person one may talk a new recipe over with (the content says who: a smith, an innkeeper…). */
export const CRAFTSPERSON = 'craftsperson'

/** Why a recipe was refused, as a code: the panel says it in the player's language (runtime ui/research.ts). */
export type ResearchProblemCode = 'locked' | 'identity' | 'cheap' | 'material' | 'refused' | 'station' | 'needs' | 'unmade'

export class ResearchProblem extends Error {
  constructor(readonly code: ResearchProblemCode, message: string) {
    super(message)
  }
}

const form = /^(item\/(tool|weapon|armor|clothing|food))\//
/** The families a new kind may join: what a craftsperson makes, never a key, a relic, a document or a valuable. */
const NEW_FAMILIES = /^item\/(tool|weapon|armor|clothing|food|potion|vessel|light|misc)(\/|$)/
const text = (x: unknown) => typeof x === 'string' ? x : ''

const worth = (onto: OntologyIndex, type: string): number => {
  const v = onto.resolve(type).props.value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}
const price = (eng: Engine, type: string) => worth(eng.world.onto, type)

/**
 * The crafts research may build on: the game's own recipes (`known`, what the crafting panel offers) and those the
 * engine holds (derived from the types, and a learned thing's). The engine alone holds only the game's recipes crafted
 * so far, so a craftsperson's offer would follow what one happened to make.
 */
const recipesOf = (eng: Engine, known: Iterable<Recipe> = []) => [...known, ...eng.recipes.values()]
/** A base recipe is made of goods: materials, food, gems (a shop's offer, paid for in coin, is no craft). */
const GOODS = /^item\/(material|food|gem)\//

function reference(eng: Engine, type: string, known?: Iterable<Recipe>): Recipe | undefined {
  const w = eng.world
  if (!form.test(type) || eng.lib.types.some((t) => t.id === type) || !w.onto.data.types[type]) return
  if (!w.onto.resolve(type).tags.includes('portable')) return
  return recipesOf(eng, known).find((r) => r.make.type === type && r.needs.length > 0 && r.needs.every((n) => GOODS.test(n.type)) &&
    !r.make.props && !r.make.tags && !r.bonus &&
    (!r.skill || w.hasTag(w.player, `skill:${r.skill}`)) &&
    (!r.unlockedBy || (w.story && w.num(w.story, r.unlockedBy.fact, 0) >= (r.unlockedBy.level ?? 1))) &&
    r.needs.every((n) => price(eng, n.type) > 0))
}

/** Only actual inventory materials and currently unlocked craft families are offered. */
export function researchCatalogue(eng: Engine, known?: Iterable<Recipe>): ResearchCatalogue {
  const w = eng.world
  const materials = [...new Set([w.player.held, ...(w.player.contents ?? [])].flatMap((id) => {
    const e = w.get(id)
    return e && !e.frozenBy && /^(item\/material|item\/food)\//.test(e.type) && price(eng, e.type) > 0 ? [e.type] : []
  }))].slice(0, 80)
  const prototypes = [...new Set(recipesOf(eng, known).map((r) => r.make.type))].filter((id) => reference(eng, id, known)).slice(0, 80)
  return { materials, prototypes, stations: ['hands', ...w.stationsNear(w.player)], guidance: {
    materials: materials.map((type) => ({ type, value: price(eng, type), available: eng.controls.count(type) })),
    prototypes: prototypes.map((type) => {
      const r = reference(eng, type, known)!
      return { type, minCost: Math.max(price(eng, type), r.needs.reduce((n, m) => n + price(eng, m.type) * m.count, 0) / (r.count ?? 1)), station: r.station ?? 'hands' }
    }),
  } }
}

/** The id a proposal's kind takes: its prototype's (a variant) or its parent's (a new kind) child, named apart. */
export function inventionId(design: ResearchDesign, token: string): string {
  const parent = design.kind === 'new' ? (design.type?.id ?? 'item/misc/x').split('/').slice(0, -1).join('/') : design.prototype
  return `${parent}${INVENTION}${token.replaceAll('-', '_')}`
}

/** Prepare a recipe, without changing the world. Recomputed at confirmation, not trusted from a UI. */
export function researchPatch(eng: Engine, proposed: unknown, id: string, known?: Iterable<Recipe>): { patch: Patch; design: ResearchDesign } {
  const design = readResearchReply({ reply: 'draft', design: proposed }, researchCatalogue(eng, known)).design!
  const type = design.kind === 'new' ? newKind(eng, design, id, known) : variant(eng, design, id, known)
  return { design, patch: { artifacts: [{ kind: 'type', type }], author: 'player-research', note: 'A recipe developed in conversation and trial-crafted by the player.' } }
}

const nameText = (n: VariantDesign['name']) => (typeof n === 'string' ? { en: n, zh: n } : n)
const costOf = (eng: Engine, ingredients: { type: string; count: number }[]) => ingredients.reduce((n, m) => n + price(eng, m.type) * m.count, 0)
const costIn = (onto: OntologyIndex, ingredients: { type: string; count: number }[]) => ingredients.reduce((n, m) => n + worth(onto, m.type) * m.count, 0)

/** A variant: the prototype's behaviour, skill, station and unlock; the first ingredient's material; the inputs' worth. */
function variant(eng: Engine, design: VariantDesign, id: string, known?: Iterable<Recipe>): TypeDef {
  const base = reference(eng, design.prototype, known)
  if (!base) throw new ResearchProblem('locked', 'This craft is not unlocked')
  if (!id.startsWith(`${design.prototype}${INVENTION}`) || eng.world.onto.data.types[id]) throw new ResearchProblem('identity', 'Invalid invention identity')
  const cost = costOf(eng, design.ingredients)
  const baseline = base.needs.reduce((n, m) => n + price(eng, m.type) * m.count, 0) / (base.count ?? 1)
  // A new material combination may not cheaply bypass an established production chain.
  if (cost < Math.max(baseline, price(eng, design.prototype))) throw new ResearchProblem('cheap', 'The proposed materials are too cheap for this craft; add materials or choose a simpler item')
  const original = eng.world.onto.resolve(design.prototype)
  const first = eng.world.onto.resolve(design.ingredients[0].type)
  const material = text(first.props.material || original.props.material)
  if (!material) throw new ResearchProblem('material', 'The first ingredient gives the item its material: begin with wood, stone, metal, cloth or the like')
  return {
    id, name: nameText(design.name), researched: true, makeup: design.ingredients,
    station: base.station ?? 'hands', craftLevel: base.level ?? 1,
    ...(base.skill && { craftSkill: base.skill }),
    ...(base.unlockedBy && { unlockedBy: structuredClone(base.unlockedBy) }),
    ...(base.tools && { tools: [...base.tools] }),
    // Cap resale at both the original item's worth and the inputs. Effects are inherited;
    // the model cannot choose arbitrary properties, tags, scripts or story facts.
    props: { value: Math.min(price(eng, design.prototype), cost), material },
    ...(design.art && { art: design.art }),
  }
}

/**
 * A new kind (the service designed it from the craftsperson's idea): a child of a family a craftsperson makes, held
 * to what its family already has: every number no higher than the best of the family worth no more than what goes
 * into it, no key and no tag the family has not, no more tools in one than one of the family is; worth no more than
 * what goes into it. What it does
 * beyond what it inherits is asked act by act, for this save alone.
 */
function newKind(eng: Engine, design: NewDesign, id: string, known?: Iterable<Recipe>): TypeDef {
  const recipes = recipesOf(eng, known)
  return newKindIn(eng.world.onto, design, id, (k) => !eng.lib.types.some((l) => l.id === k), (k) => recipes.some((r) => r.make.type === k && r.needs.length > 0 && r.needs.every((n) => GOODS.test(n.type))))
}

/**
 * The same bounds, of an ontology alone (the AI service holds its design to them before it answers, so a craftsperson
 * offers nothing the game then refuses). `authored`: a kind the content made, not a library's; `crafted`: a kind the
 * game's recipes make (a thing of it is made at that craft, with its tools, skill and unlock: a variant of it).
 */
export function newKindIn(onto: OntologyIndex, design: NewDesign, id: string, authored: (type: string) => boolean, crafted: (type: string) => boolean = () => false): TypeDef {
  const t = design.type
  if (!t) throw new ResearchProblem('refused', 'The new thing has not been worked out yet')
  const parent = t.id.split('/').slice(0, -1).join('/')
  if (!NEW_FAMILIES.test(parent) || !onto.data.types[parent]) throw new ResearchProblem('refused', `A new thing joins a family a craftsperson makes, not ${parent}`)
  if (!id.startsWith(`${parent}${INVENTION}`) || onto.data.types[id]) throw new ResearchProblem('identity', 'Invalid invention identity')
  // what it inherits is its parent's: never a legend's, a relic's or another invention's (a child of Dragonsbane is Dragonsbane)
  const kind = onto.resolve(parent)
  if (!authored(parent) || kind.tags.includes('quality:legendary') || kind.props.relic !== undefined) throw new ResearchProblem('refused', `A new thing joins an ordinary family, not ${parent}`)
  // a kind of a thing the game crafts is made at that craft (its station, tools, skill, unlock): a variant of it, never around it
  if (crafted(parent)) throw new ResearchProblem('refused', `A ${parent.split('/').pop()} is made at its own craft: make a variant of ${parent}`)
  const family = parent.split('/').slice(0, 2).join('/')
  // its ordinary kin: what the content made, never a legend or a relic (a new thing is measured against the common run)
  const kin = Object.keys(onto.data.types)
    .filter((k) => k.startsWith(`${family}/`) && authored(k))
    .map((k) => onto.resolve(k))
    .filter((r) => !r.tags.includes('quality:legendary') && r.props.relic === undefined)
  // what goes into it buys its numbers: none above the best of its family worth no more than that (a stick buys no dragon's bane)
  const cost = costIn(onto, t.makeup ?? [])
  const within = kin.filter((r) => typeof r.props.value === 'number' && r.props.value <= cost)
  if (!within.length) {
    const least = Math.min(...kin.map((r) => r.props.value).filter((v): v is number => typeof v === 'number'))
    throw new ResearchProblem('cheap', `Nothing of its sort is made from so little (its makeup is worth ${cost}; the least of its sort is worth ${least})`)
  }
  const most = (k: string) => Math.max(0, ...within.map((r) => r.props[k]).filter((x): x is number => typeof x === 'number'))
  const props: TypeDef['props'] = {}
  // the numbers it inherits are bought the same way as its own (a sword's power is not had for a few ingots)
  for (const [k, v] of Object.entries(kind.props)) if (k !== 'value' && typeof v === 'number' && v > most(k)) props[k] = most(k)
  for (const [k, v] of Object.entries(t.props ?? {})) {
    if (k === 'value') continue
    // what it is made of: every new thing names it, and the engine holds it to the world's materials (newTypeProblems)
    if (k === 'material') {
      props[k] = v
      continue
    }
    const seen = kin.map((r) => r.props[k]).filter((x) => x !== undefined)
    if (!seen.length) throw new ResearchProblem('refused', `"${k}" is not something a ${family.split('/')[1]} has`)
    if (typeof v === 'number') props[k] = Math.min(v, most(k))
    else props[k] = v
  }
  const kinTags = new Set(kin.flatMap((r) => r.tags))
  const tags = (t.tags ?? []).filter((g) => kinTags.has(g))
  const tools = (tags: string[]) => tags.filter((g) => g.startsWith('tool:')).length
  if (tools(tags) > Math.max(0, ...kin.map((r) => tools(r.tags)))) throw new ResearchProblem('refused', 'One thing is one tool')
  props.value = Math.min(typeof t.props?.value === 'number' && t.props.value > 0 ? t.props.value : cost, cost)
  return {
    id, name: nameText(design.name), researched: true, makeup: t.makeup, station: t.station ?? 'hands',
    ...(tags.length && { tags }), props, ...(t.art && { art: t.art }),
  }
}

/** Is one of it made: in the bag, or at one's feet when the bag had no room (as any craft leaves it)? */
const madeOne = (eng: Engine, id: string) => eng.controls.count(id) > 0 || Object.values(eng.world.state.entities).some((e) => e.type === id)

function stationReady(eng: Engine, r: Recipe): boolean {
  return !r.station || r.station === 'hands' || eng.world.stationsNear(eng.world.player).has(r.station)
}

/** Validate and replay the real craft on an isolated state before the synchronous live craft.
 * No arbitrary effects or actor writes: both trials use the game's normal crafting event.
 */
export function trialResearch(eng: Engine, port: ModPort, proposed: unknown, id: string, known?: Iterable<Recipe>): TypeDef {
  const { patch } = researchPatch(eng, proposed, id, known)
  const type = (patch.artifacts[0] as { kind: 'type'; type: TypeDef }).type
  const trial = new Engine(structuredClone(eng.world.state), eng.world.onto.data, RuleLibrary.fromJSON(eng.lib.toJSON()))
  trial.quality = { ...eng.quality }
  trial.tier = eng.tier
  trial.loadInvariants(structuredClone(eng.invariants), [...eng.protectedFacts])
  for (const [key, skill] of eng.skills) trial.skills.set(key, structuredClone(skill))
  for (const [key, recipe] of eng.recipes) trial.recipes.set(key, structuredClone(recipe))
  const trialPort = new ModPort(trial)
  const checked = trialPort.submit(undefined, patch)
  if (!checked.ok) throw new ResearchProblem('refused', checked.errors.join('; '))
  const r = trial.recipes.get(id)!
  if (!stationReady(trial, r)) throw new ResearchProblem('station', 'Stand beside the required crafting station to try this recipe')
  if (!trial.controls.canCraft(r)) throw new ResearchProblem('needs', 'You need the recipe materials, tools and skills before trying it')
  if (!trial.controls.craft(r) || !madeOne(trial, id)) throw new ResearchProblem('unmade', 'The trial did not produce an item; nothing was consumed')
  // No await between replay and real submission/craft: inventory and unlocks cannot race.
  const committed = port.submit(undefined, patch)
  if (!committed.ok) throw new ResearchProblem('refused', committed.errors.join('; '))
  if (!eng.controls.craft(eng.recipes.get(id)!) || !madeOne(eng, id)) {
    eng.lib.removeType(id)
    eng.world.onto.removeType(id)
    eng.recipes.delete(id)
    throw new ResearchProblem('unmade', 'The item was not made; the recipe was not learned')
  }
  return type
}
