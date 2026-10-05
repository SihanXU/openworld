// Placement is an input planner, not a second crafting system. Every change is made
// by an existing interaction rule. A sandbox rehearsal prevents partial spending.
import { Engine } from './engine.ts'
import { matchSelector } from './rules.ts'
import type { Id, Pos, Ref, Selector, Text, Verb } from './types.ts'

export interface PlacementNeed {
  match: Selector
  name: Text
  sprite: string
  count: number
  consume?: boolean
}
export interface PlacementRecipe {
  id: string
  category: 'building' | 'farming'
  name: Text
  description: Text
  sprite: string
  site: Selector
  /** Test the ground, entities, or both (water sources). */
  target: 'tile' | 'entity' | 'either'
  empty?: 'all' | 'non-actors'
  excludeTerrain?: string[]
  needs: PlacementNeed[]
  steps: { need: number; verb: Verb; rule: string | string[]; target?: 'tile' }[]
  /** The first placed material becomes the building through the rules. */
  result?: string
}
export interface PlacementPreview {
  id: string
  at: Pos
  ok: boolean
  reason: Text
  have: number[]
}

function plan(eng: Engine, actorId: Id, recipe: PlacementRecipe, at: Pos) {
  const w = eng.world
  const actor = w.get(actorId)
  const carried = [...new Set([...(actor?.contents ?? []), ...(actor?.held ? [actor.held] : [])])]
    .filter((id) => {
      const e = w.get(id)
      return !!e && !e.frozenBy && (e.place.on === 'inside' || e.place.on === 'hand') && e.place.holder === actorId
    })
  const reserved = new Set<Id>()
  const pools = recipe.needs.map((n) => {
    const ids = carried.filter((id) => !reserved.has(id) && matchSelector(n.match, w.view({ e: id })))
    for (const id of ids.slice(0, n.count)) reserved.add(id)
    return ids
  })
  const preview: PlacementPreview = { id: recipe.id, at, ok: false, reason: '', have: pools.map((p) => p.length) }
  const fail = (en: string, zh: string) => ({ preview: { ...preview, reason: { en, zh } }, pools, target: undefined as Ref | undefined })
  if (!actor || actor.place.on !== 'tile' || eng.busy(actor)) return fail('Cannot act right now.', '现在无法操作。')
  if (!Number.isInteger(at.x) || !Number.isInteger(at.y) || !w.inBounds(at.map, at.x, at.y)) return fail('Outside the map.', '目标在地图外。')
  if (actor.place.map !== at.map || Math.max(Math.abs(actor.place.x - at.x), Math.abs(actor.place.y - at.y)) > 1)
    return fail('Move next to the target.', '请走到目标格旁边。')
  const es = w.entitiesAt(at.map, at.x, at.y)
  // what stands or lies there (not what makes up the cell)
  if (recipe.empty && es.some((e) => !w.isTerrain(e) && (recipe.empty === 'all' || !w.isAgent(e)))) return fail('This tile is occupied.', '这格有东西，无法放置。')
  if (recipe.excludeTerrain?.includes(w.terrainAt(at.map, at.x, at.y))) return fail('Already prepared.', '这格已经是耕地了。')
  // the cell is what makes it up on top; an entity is what else stands there
  const top = w.cellTop(at.map, at.x, at.y)
  const tile: Ref | undefined = top && { e: top.id }
  const entity = es.find((e) => !w.isTerrain(e) && !e.frozenBy && matchSelector(recipe.site, w.view({ e: e.id })))
  const target: Ref | undefined = recipe.target !== 'tile' && entity ? { e: entity.id }
    : recipe.target !== 'entity' && tile && matchSelector(recipe.site, w.view(tile)) ? tile : undefined
  if (!target) return fail('Not a suitable target.', '目标不适合此操作。')
  const missing = recipe.needs.findIndex((n, i) => pools[i].length < n.count)
  if (missing >= 0) return fail('Missing materials or tool.', '背包中缺少材料或工具。')
  return { preview: { ...preview, ok: true, reason: { en: 'Left click / E to place.', zh: '左键 / E 放置。' } }, pools, target }
}

export function previewPlacement(eng: Engine, actorId: Id, recipe: PlacementRecipe, at: Pos): PlacementPreview {
  return plan(eng, actorId, recipe, at).preview
}

/** Works for any actor, with only their own bag/hand; no special player privilege. */
export function performPlacement(eng: Engine, actorId: Id, recipe: PlacementRecipe, at: Pos): PlacementPreview {
  const p = plan(eng, actorId, recipe, at)
  if (!p.preview.ok || !p.target) return p.preview
  const offsets = recipe.needs.map(() => 0)
  const steps = recipe.steps.map((s) => ({ ...s, instrument: p.pools[s.need][recipe.needs[s.need].consume ? offsets[s.need]++ : 0] }))
  const run = (on: Engine): boolean => {
    let work = p.target!
    for (const s of steps) {
      if (!s.instrument) return false
      const top = on.world.cellTop(at.map, at.x, at.y)
      const target: Ref | undefined = s.target === 'tile' ? top && { e: top.id } : work
      if (!target) return false
      // the earlier `interact` is `use` with something in hand (design.md §5.14)
      const verb = (s.verb as string) === 'interact' ? 'use' : s.verb
      const event = on.actEvent(verb, actorId, target, { e: s.instrument })
      // the step is the act and what its impulses meet: a rule it names (or, ending in '/', any of that family) answers along the chain
      const allowed = Array.isArray(s.rule) ? s.rule : [s.rule]
      const named = (ids: string[]) => ids.some((id) => allowed.some((a) => (a.endsWith('/') ? id.startsWith(a) : id === a)))
      const dry = on.preview(event)
      if (!dry.defined || dry.unknown || !named(dry.rules)) return false
      // the trace keeps only its last entries: what this act added is counted, not found by position
      const mark = on.traced
      on.act(verb, actorId, target, { instrument: { e: s.instrument } })
      if (!named(on.trace.slice(Math.max(0, on.trace.length - (on.traced - mark))).map((t) => t.rule ?? ''))) return false
      if (recipe.result && s.target === 'tile') work = { e: s.instrument }
    }
    return !recipe.result || on.world.get(work.e)?.type === recipe.result
  }
  const rehearsal = new Engine(structuredClone(eng.world.state), structuredClone(eng.world.onto.data), eng.lib)
  rehearsal.loadInvariants(eng.invariants, eng.protectedFacts)
  if (!run(rehearsal)) return { ...p.preview, ok: false, reason: { en: 'The world rules do not allow this recipe.', zh: '当前世界规则不支持此配方，材料未扣除。' } }
  if (!run(eng)) throw new Error(`Placement diverged from rehearsal: ${recipe.id}`)
  eng.controls.sync()
  return { ...p.preview, reason: { en: 'Done.', zh: '完成。' } }
}
