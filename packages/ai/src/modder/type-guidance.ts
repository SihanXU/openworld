import { creationPlanProblems, isPrivateName, OntologyIndex, type Ontology, type ResearchCatalogue, type ResearchPlan, type ResearchReply, type Rule, type Text, type TypeDef } from '@openworld/engine'

export interface ResearchTypeGuidance {
  requirements: { capability: string; description?: Text; missingOnBareItem: string[] }[]
  examples: { type: string; family: string; name?: Text; tags: string[]; props: TypeDef['props']; usable?: boolean; requiredProfession?: string }[]
  families: { id: string; leastValue?: number }[]
  consumers: { id: string; host: Rule['host']; doc?: string }[]
  jointExamples: boolean
  catalogue: TypeDef[]
}

export interface EquipmentRequirement { type: string; profession: string }
/** Native classes read the first inherited profession tag. Compact descendants that share the same requirement. */
export function researchEquipmentRequirements(ontology: Ontology): EquipmentRequirement[] {
  if (!ontology.modules?.includes('classes')) return []
  const index = new OntologyIndex(ontology), requirements: EquipmentRequirement[] = []
  for (const id of Object.keys(ontology.types).filter(id => id.startsWith('item/')).sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))) {
    const profession = index.resolve(id).tags.find(tag => tag.startsWith('profession:'))?.slice('profession:'.length)
    if (profession && !requirements.some(r => id.startsWith(`${r.type}/`) && r.profession === profession)) requirements.push({ type: id, profession })
  }
  return requirements
}

/** A cross-profession proposal is allowed, with the native requirement stated before the player accepts it. */
export function researchEquipmentNotice(reply: ResearchReply, type: TypeDef, catalogue: ResearchCatalogue, ontology: Ontology): string[] {
  if (!catalogue.actor || !ontology.modules?.includes('classes')) return []
  const index = new OntologyIndex(ontology)
  const inherited = type.id in ontology.types ? index.resolve(type.id).tags : type.id.split('/').flatMap((_, i, parts) => ontology.types[parts.slice(0, i + 1).join('/')]?.tags ?? [])
  const required = [...inherited, ...(type.tags ?? [])].find(tag => tag.startsWith('profession:'))?.slice('profession:'.length)
  if (!required || required === catalogue.actor.profession) return []
  const name = ontology.professions?.[required]?.name
  const names = [required, ...(typeof name === 'string' ? [name] : name ? [name.en, name.zh ?? ''] : [])].filter(Boolean)
  const said = (typeof reply.reply === 'string' ? reply.reply : `${reply.reply.en} ${reply.reply.zh ?? ''}`).toLowerCase()
  return names.some(word => said.includes(word.toLowerCase())) ? [] : [`This item requires profession ${required} for native fighting or wearing; the player is ${catalogue.actor.profession ?? 'without a profession'}. For the player's own use, give a compatible interpretation or ask one useful choice with design null; a warning alone does not make it usable. Preserve an incompatible item only for an explicit gift, collection or future cross-profession request, with its requirement stated.`]
}

/** A small closure of actual working kinds, selected by the registered capability checks rather than item names. */
export function researchTypeGuidance(ontology: Ontology, plan: ResearchPlan | undefined, catalogue: ResearchCatalogue, intent: string, rules: Rule[], authored: (id: string) => boolean): ResearchTypeGuidance | undefined {
  if (!plan?.uses.length) return undefined
  const index = new OntologyIndex(ontology)
  const professionGated = ontology.modules?.includes('classes')
  const uses = [...new Map(plan.uses.map(use => [use.capability, use])).values()]
  const bare: TypeDef = { id: 'item/creation_probe', props: {}, tags: [] }
  const requirements = uses.map(use => ({ capability: use.capability, description: catalogue.capabilities?.find(c => c.id === use.capability)?.description, missingOnBareItem: creationPlanProblems({ version: 1, uses: [use] }, bare, ontology) }))
  const terms = [...new Set(intent.toLowerCase().match(/[a-z]{3,}|[\u4e00-\u9fff]{2,}/g) ?? [])]
  const words = (t: Text | undefined) => typeof t === 'string' ? t : `${t?.en ?? ''} ${t?.zh ?? ''}`
  const relevant = (id: string) => terms.reduce((n, term) => n + (id.toLowerCase().includes(term) ? 1 : 0), 0)
  const records = Object.keys(ontology.types).filter(id => /^item\/(tool|weapon|armor|clothing|food|potion|vessel|light|misc)\//.test(id) && authored(id) && !isPrivateName(id)).map(id => {
    const resolved = index.resolve(id)
    const type: TypeDef = { id, tags: resolved.tags, props: resolved.props }
    const requiredProfession = professionGated ? resolved.tags.find(tag => tag.startsWith('profession:'))?.slice('profession:'.length) : undefined
    return { id, type, name: ontology.types[id].name, family: id.split('/').slice(0, 2).join('/'), value: typeof resolved.props.value === 'number' ? resolved.props.value : Infinity, score: relevant(`${id} ${words(ontology.types[id].name)}`), ordinary: !resolved.tags.includes('quality:legendary') && resolved.props.relic === undefined, ...(requiredProfession && { requiredProfession }), ...(catalogue.actor && { usable: !requiredProfession || requiredProfession === catalogue.actor.profession }) }
  }).filter(r => r.ordinary)
  const fitting = records.filter(r => !creationPlanProblems(plan, r.type, ontology).length)
  const ranked = (fitting.length ? fitting : records).sort((a, b) => b.score - a.score || Number(b.usable ?? false) - Number(a.usable ?? false) || a.value - b.value || a.id.localeCompare(b.id))
  const selected: typeof ranked = [], perFamily = new Map<string, number>()
  for (const r of ranked) {
    if ((perFamily.get(r.family) ?? 0) >= 2) continue
    selected.push(r); perFamily.set(r.family, (perFamily.get(r.family) ?? 0) + 1)
    if (selected.length >= 8) break
  }
  const examples = selected.map(r => ({ type: r.id, family: r.family, name: r.name, tags: r.type.tags ?? [], props: Object.fromEntries(Object.entries(r.type.props ?? {}).slice(0, 18)), ...(r.requiredProfession && { requiredProfession: r.requiredProfession }), ...(r.usable !== undefined && { usable: r.usable }) }))
  const families = [...perFamily.keys()].map(id => {
    const values = records.filter(r => r.family === id && Number.isFinite(r.value)).map(r => r.value)
    return { id, ...(values.length && { leastValue: Math.min(...values) }) }
  })
  const consumers = rules.filter(rule => ['act/use', 'act/put'].includes(rule.on) && selected.some(r => rule.host?.tags?.length ? rule.host.tags.every(tag => r.type.tags?.includes(tag)) : rule.host?.type && rule.host.type !== 'item' && (r.id === rule.host.type || r.id.startsWith(`${rule.host.type}/`)))).slice(0, 6).map(rule => ({ id: rule.id, host: rule.host, ...(rule.doc && { doc: rule.doc.slice(0, 360) }) }))
  const closure = new Set<string>()
  const include = (id: string) => { for (const ancestor of id.split('/').map((_, i, all) => all.slice(0, i + 1).join('/'))) if (ontology.types[ancestor]) closure.add(ancestor) }
  for (const r of selected) include(r.id)
  for (const id of catalogue.materials) include(id)
  for (const id of catalogue.prototypes.filter(id => relevant(`${id} ${words(ontology.types[id]?.name)}`) > 0).slice(0, 6)) include(id)
  return { requirements, examples, families, consumers, jointExamples: !!fitting.length, catalogue: [...closure].map(id => ontology.types[id]) }
}
