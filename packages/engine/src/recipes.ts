// Recipes, derived (world-model.md §6.4, Elin's RecipeManager.BuildList): a thing whose type
// names a station and a makeup can be made there from what it is made of. Nothing else lists
// recipes: a new type (a patch's) with both is craftable from birth. What is made takes its main
// ingredient's material (the first part of its makeup), a quality from its maker's level against
// the recipe's, and its power from its form, material and quality.

import type { OntologyIndex } from './ontology.ts'
import type { Entity, MaterialDef, Ontology, PropValue, QualityDef, Recipe, Text } from './types.ts'

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
      level: def.craftLevel ?? 1,
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
/**
 * What a thing's material and quality make of its form's power and defence (world-model.md §6.8, after
 * Elin's ApplyMaterial): the form's number times the material's factor and the quality's, whole, at least 1.
 */
export function gearProps(form: Record<string, PropValue>, m?: MaterialDef, q?: QualityDef): Record<string, number> {
  const out: Record<string, number> = {}
  const f = q?.factor ?? 1
  if (typeof form.power === 'number') out.power = Math.max(1, Math.round(form.power * (m?.attack ?? 1) * f))
  if (typeof form.def === 'number') out.def = Math.max(1, Math.round(form.def * (m?.defence ?? 1) * f))
  return out
}

export function madeOf(data: Ontology, onto: OntologyIndex, type: string, material?: string, quality?: string): Omit<Entity, 'id' | 'place'> {
  const r = onto.resolve(type)
  // a material that is the thing's own (a plank is wood) does not name it again: one kind of plank
  const m = material && r.props.material !== material ? data.materials?.[material] : undefined
  const q = quality ? data.qualities?.find((x) => x.id === quality) : undefined
  const tags = [...(m ? [`material:${m.id}`, ...(m.tags ?? [])] : []), ...(q?.tag ? [q.tag] : [])]
  const props: Record<string, PropValue> = {}
  Object.assign(props, gearProps(r.props, m, q))
  const base = r.name ?? { en: type.split('/').pop()!, zh: type.split('/').pop()! }
  const say = (x: Text | undefined, l: 'en' | 'zh') => (x === undefined ? '' : typeof x === 'string' ? x : (x[l] ?? x.en))
  const en = [say(q?.name, 'en'), say(m?.name, 'en'), say(base, 'en')].filter(Boolean).join(' ')
  const zh = [say(q?.name, 'zh'), say(m?.name, 'zh'), say(base, 'zh')].filter(Boolean).join('')
  const named = !!(m?.name || say(q?.name, 'en'))
  return { type, ...(named && { name: { en, zh } as Text }), ...(tags.length && { tags }), ...(Object.keys(props).length && { props }) }
}
