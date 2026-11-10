import { artProblems, OntologyIndex, type Ontology, type PixelArt, type ResearchArtReview, type ResearchSketch, type TypeDef } from '@openworld/engine'
import { parseJson, type Model } from '../models/model.ts'
import { ART_SYSTEM, artEditUser, artUser } from './prompts.ts'

export interface ArtReference { type: string; art: PixelArt }

/** Choose by the actual ancestry/render key, never by a new item's imaginative name. */
export function artReference(type: TypeDef, ontology: Ontology, references: Record<string, PixelArt> = {}): ArtReference | undefined {
  const index = new OntologyIndex(ontology)
  const ancestors = type.id.split('/').map((_, i, all) => all.slice(0, i + 1).join('/'))
  const sprite = type.sprite ?? [...ancestors].reverse().map(id => ontology.types[id]?.sprite).find(Boolean)
  const parts = type.id.split('/')
  const common = (id: string) => { const other = id.split('/'); let n = 0; while (n < other.length && other[n] === parts[n]) n++; return n }
  const candidates = Object.entries(references).filter(([id, art]) => id in ontology.types && !artProblems(art).length && (common(id) >= 2 || (sprite && index.resolve(id).sprite === sprite)))
  candidates.sort(([a], [b]) => Number(index.resolve(b).sprite === sprite && !!sprite) - Number(index.resolve(a).sprite === sprite && !!sprite) || common(b) - common(a) || a.split('/').length - b.split('/').length || a.localeCompare(b))
  const first = candidates[0]
  return first ? { type: first[0], art: first[1] } : undefined
}

/** Syntax and geometry establish a readable object, not its semantic identity. The model reviews that separately. */
export function artShapeProblems(art: PixelArt, reference?: PixelArt): string[] {
  const problems = artProblems(art)
  if (problems.length) return problems
  const points = new Set<number>()
  art.grid.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') points.add(y * 16 + x) }))
  if (points.size > 224) problems.push('The icon fills almost the entire square; remove the background/badge and leave a transparent silhouette')
  const remaining = new Set(points), sizes: number[] = []
  while (remaining.size) {
    const todo = [remaining.values().next().value!]; remaining.delete(todo[0]); let size = 0
    while (todo.length) { const p = todo.pop()!; size++; const x = p % 16, y = Math.floor(p / 16)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * 16 + x + dx; if (x + dx >= 0 && x + dx < 16 && y + dy >= 0 && y + dy < 16 && remaining.delete(q)) todo.push(q) }
    }
    sizes.push(size)
  }
  if (Math.max(...sizes) < points.size * 0.85) problems.push('The object is fragmented into unrelated islands; join its structural parts and remove stray decoration')
  if (reference && !artProblems(reference).length) {
    const ref = new Set<number>(); reference.grid.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') ref.add(y * 16 + x) }))
    const intersection = [...points].filter(p => ref.has(p)).length
    const overlap = intersection / (points.size + ref.size - intersection)
    if (overlap < 0.9) problems.push(`Reference silhouette IoU ${overlap.toFixed(3)} is below 0.900; preserve the source pose, outline and internal transparent openings, changing palette/interior details only`)
  }
  return problems
}

const readArt = (raw: unknown): PixelArt | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<PixelArt>
  return { grid: value.grid ?? [], palette: value.palette ?? {} }
}
const parse = (raw: string): unknown => { try { return parseJson(raw) } catch { return undefined } }
const CHECKS = ['recognizable', 'structure', 'style', 'material'] as const

/** NPC sketches alone get one generation and one combined inspection/repair, independent of rule-pipeline budgets. */
export async function reviewedArt(model: Model, type: TypeDef, what: string, reference?: ArtReference, base?: PixelArt, preserve = false): Promise<ResearchSketch> {
  const name = typeof type.name === 'object' ? { en: type.name.en, zh: type.name.zh ?? type.name.en } : { en: type.name ?? type.id, zh: type.name ?? type.id }
  const review: ResearchArtReview = { ...(reference && { reference }), checks: [], issues: [], accepted: false, silhouette: preserve ? 'preserve' : 'free' }
  const shape = (art: PixelArt) => artShapeProblems(art, preserve ? reference?.art : undefined)
  const fallback = (): ResearchSketch => {
    const original = preserve && reference && review.original && !shape(review.original).length ? review.original : undefined
    review.fallback = original ? 'original' : preserve && reference ? 'reference' : 'none'
    return { ...(original ? { art: original } : preserve && reference ? { art: reference.art } : {}), review }
  }
  const source = base ?? (preserve ? reference?.art : undefined)
  const prompt = source ? artEditUser({ id: type.id, name }, what, source) : artUser({ id: type.id, name }, what)
  const opts = { json: true, temperature: 0.3, purpose: 'art', reasoning: 'low', deadlineMs: 90_000 } as const
  try {
    const first = await model.chat([{ role: 'system', content: ART_SYSTEM }, { role: 'user', content: `${prompt}\nThe actual family is ${type.id.split('/').slice(0, -1).join('/')}. ${reference ? `Original game visual reference: ${JSON.stringify(reference)}.` : ''} ${preserve ? 'This is a conservative source-icon edit: keep the EXACT source pose, outer alpha silhouette and internal transparent openings. Change palette/material and a few interior detail pixels only; no front-facing redesign of angled gear.' : 'The reference supplies style only: draw the intended physical form, not the reference object (a jar of jam is not a pile of berries).'} Show the requested material on its main functional component; secondary grips/straps may remain wood, leather or cloth. Do not turn the item into a lump of its material or a generic symbol.` }], opts)
    const original = readArt(parse(first.content))
    if (original) review.original = original
    const problems = original ? shape(original) : ['The generator did not return a pixel-art object']
    review.checks.push({ stage: 'original', problems })
    const inspection = await model.chat([{ role: 'system', content: 'You inspect a 16x16 JRPG inventory icon as a pixel artist. Read the actual character grids, not just their label. Answer JSON only.' }, { role: 'user', content: JSON.stringify({ item: { id: type.id, name, description: what }, reference, original, deterministicProblems: problems, preserveSourceSilhouette: preserve, criteria: { recognizable: 'At inventory size the object reads as its actual family, rather than a blob, material lump or generic symbol.', structure: preserve ? 'Keep the EXACT source pose, outer alpha mask and internal transparent holes. Angled body gear stays angled; retain its neck/arm voids. A blade keeps its continuous pointed blade, transverse guard and short grip. Change palette and small interior details only; never replace gear with a front-facing rectangle/sack.' : 'The intended physical form and functional parts must read clearly. Style references do not dictate shape: a jam jar can differ from a berry-pile reference.', style: 'Match the source flat palette, outline and top-left light; no text or loose decorations hiding the object. Preserve source transparency.', material: 'Requested material applies to the main functional component: a steel blade may have a warm wood/leather grip, and armour may have cloth/leather straps. Do not require every component to be steel or recolor the item into a solid material lump.' }, instruction: 'Inspect the original against all four criteria. If it passes, omit repaired. Otherwise give concrete issues with pixel regions/parts, repair ONCE, and inspect the repaired grid. finalChecks describe the FINAL candidate, not the original. Return {issues:string[],finalChecks:{recognizable:boolean,structure:boolean,style:boolean,material:boolean},repaired?:{grid:string[],palette:{char:hex}}}. Do not return a separate accepted flag. Failed final criteria must be false; do not approve by the name alone.' }) }], { ...opts, purpose: 'art-review' })
    const result = parse(inspection.content) as { accepted?: unknown; issues?: unknown; finalChecks?: Record<string, unknown>; repaired?: unknown } | undefined
    review.issues = Array.isArray(result?.issues) ? result.issues.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, 500)).slice(0, 8) : ['The inspection did not return its concrete findings']
    review.criteria = { recognizable: result?.finalChecks?.recognizable === true, structure: result?.finalChecks?.structure === true, style: result?.finalChecks?.style === true, material: result?.finalChecks?.material === true }
    const repaired = readArt(result?.repaired)
    if (repaired) review.repaired = repaired
    const final = repaired ?? original
    const finalProblems = final ? shape(final) : ['No final icon']
    if (repaired) review.checks.push({ stage: 'repair', problems: finalProblems })
    if (CHECKS.every(key => result?.finalChecks?.[key] === true) && !finalProblems.length && final) { review.accepted = true; return { art: final, review } }
    review.issues.push(...finalProblems, ...CHECKS.filter(key => result?.finalChecks?.[key] !== true).map(key => `Final inspection did not pass ${key}`))
    return fallback()
  } catch (error) {
    review.issues.push(`Artist unavailable: ${String((error as Error).message).slice(0, 300)}`)
    return fallback()
  }
}
