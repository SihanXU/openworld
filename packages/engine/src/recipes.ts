// Recipes, derived (world-model.md §6.4, Elin's RecipeManager.BuildList): a thing whose type
// names a station and a makeup can be made there from what it is made of. Nothing else lists
// recipes: a new type (a patch's) with both is craftable from birth. What is made takes its main
// ingredient's material (the first part of its makeup), a quality from its maker's level against
// the recipe's, and its power from its form, material and quality.

import type { OntologyIndex } from './ontology.ts'
import type { Entity, MaterialDef, Ontology, PropValue, QualityDef, Recipe, Text, WorldParams } from './types.ts'

/** Every recipe the types give: those with a station and a makeup. */
export function deriveRecipes(onto: OntologyIndex): Recipe[] {
  const out: Recipe[] = []
  for (const [id, def] of Object.entries(onto.data.types)) {
    if (!def.station || !def.makeup?.length) continue
    const r = onto.resolve(id)
    const main = onto.resolve(def.makeup[0].type).props.material
    out.push({
      id,
      name: madeOf(onto.data, onto, id, typeof main === 'string' ? main : undefined).name ?? r.name ?? { en: id, zh: id },
      sprite: r.sprite ?? id,
      needs: def.makeup.map((m) => ({ type: m.type, count: m.count })),
      make: { type: id },
      station: def.station,
      ...(def.unlockedBy && { unlockedBy: def.unlockedBy }),
      level: def.craftLevel ?? 1,
      ...(def.craftSkill && { skill: def.craftSkill }),
      ...(def.tools?.length && { tools: def.tools }),
      ...(def.yields && def.yields > 1 && { count: def.yields }),
    })
  }
  return out
}

/** The quality a maker reaches: by how far their level is above the recipe's. */
export function qualityFor(onto: Ontology, makerLevel: number, recipeLevel: number): string | undefined {
  const diff = makerLevel - recipeLevel
  let best: { id: string; from: number } | undefined
  for (const q of onto.qualities ?? []) if (q.from !== undefined && diff >= q.from && (!best || q.from > best.from)) best = { id: q.id, from: q.from }
  return best?.id
}

/**
 * A made thing's look as data: its type, its material's tags (and `material:<id>`), its quality's
 * tag, its name (quality, material, form) and its power (form + material + quality).
 */
/** Gear's levels as the world sets them (params.gearLevels). */
export type GearLevels = NonNullable<WorldParams['gearLevels']>

/** A level kept within the levels gear comes in (1 … max; 1 when the world has none). */
export function gearLevel(g: GearLevels | undefined, level: number | undefined): number {
  return Math.min(g?.max ?? 1, Math.max(1, Math.round(Number(level) || 1)))
}

/** What a level makes of a piece's main stats: ×(1 + perLevel·(level − 1)); of its shares (`share`), half as much. */
export function levelFactor(g: GearLevels | undefined, level: number | undefined, share = false): number {
  if (!g) return 1
  return 1 + (share ? g.perLevel / 2 : g.perLevel) * (gearLevel(g, level) - 1)
}

/** The stats a piece of gear's form may carry: its main ones (whole numbers), and the shares (a chance, a rate). */
export const GEAR_MAIN = ['power', 'def', 'atk'] as const
export const GEAR_SHARES = ['critChance', 'critDamage', 'dodge', 'cdr', 'xpRate', 'luck', 'moveHaste', 'attackHaste', 'block'] as const

/**
 * What a thing's material, quality and level make of its form's stats (world-model.md §6.8, after Elin's
 * ApplyMaterial): power and defence times the material's factor; those and attack times the quality's and the level's
 * (whole, at least 1); its shares (a hood's dodge, an earring's experience) times the quality's and half the level's, to
 * the hundredth. A level given is kept on the piece (`level`). So at one level a finer piece is the better, and at one
 * quality a higher one — never the other way about.
 */
export function gearProps(form: Record<string, PropValue>, m?: MaterialDef, q?: QualityDef, level?: number, g?: GearLevels): Record<string, number> {
  const out: Record<string, number> = {}
  const f = q?.factor ?? 1
  const lf = level !== undefined ? levelFactor(g, level) : 1
  const sf = level !== undefined ? levelFactor(g, level, true) : 1
  if (typeof form.power === 'number') out.power = Math.max(1, Math.round(form.power * (m?.attack ?? 1) * f * lf))
  if (typeof form.def === 'number') out.def = Math.max(1, Math.round(form.def * (m?.defence ?? 1) * f * lf))
  if (typeof form.atk === 'number') out.atk = Math.max(1, Math.round(form.atk * f * lf))
  for (const key of GEAR_SHARES) {
    const v = form[key]
    // (a cost — the Crown's experience — stays what it is: a quality lessens no price asked)
    if (typeof v === 'number' && v > 0) out[key] = Math.round(v * f * sf * 100) / 100
  }
  if (level !== undefined) out.level = gearLevel(g, level)
  return out
}

export function madeOf(data: Ontology, onto: OntologyIndex, type: string, material?: string, quality?: string, level?: number): Omit<Entity, 'id' | 'place'> {
  const r = onto.resolve(type)
  const researched = !!onto.data.types[type]?.researched
  // a material that is the thing's own (a plank is wood) does not name it again: one kind of plank
  // A researched form declares its material for admission but inherits unscaled prototype
  // stats. Its crafted entities must still receive the normal material factor and tags.
  const m = material && (researched || r.props.material !== material) ? data.materials?.[material] : undefined
  const q = quality ? data.qualities?.find((x) => x.id === quality) : undefined
  const tags = [...(m ? [`material:${m.id}`, ...(m.tags ?? [])] : []), ...(q?.tag ? [q.tag] : [])]
  const props: Record<string, PropValue> = {}
  // (only gear — a thing with a slot — has a level; a bucket does not)
  Object.assign(props, gearProps(r.props, m, q, typeof r.props.slot === 'string' ? level : undefined, data.params?.gearLevels))
  const base = r.name ?? { en: type.split('/').pop()!, zh: type.split('/').pop()! }
  const say = (x: Text | undefined, l: 'en' | 'zh') => (x === undefined ? '' : typeof x === 'string' ? x : (x[l] ?? x.en))
  // nor when its name already begins with it (a 木桶 of wood is not a 木木桶)
  const of = (l: 'en' | 'zh') => { const mn = say(m?.name, l); return researched || mn && say(base, l).toLowerCase().startsWith(mn.toLowerCase()) ? '' : mn }
  const en = [say(q?.name, 'en'), of('en'), say(base, 'en')].filter(Boolean).join(' ')
  const zh = [say(q?.name, 'zh'), of('zh'), say(base, 'zh')].filter(Boolean).join('')
  const named = !!(m?.name || say(q?.name, 'en'))
  return { type, ...(named && { name: { en, zh } as Text }), ...(tags.length && { tags }), ...(Object.keys(props).length && { props }) }
}
