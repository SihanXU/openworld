// Rebase autonomous drafts through ordinary workshop admission; never replace the live world with a candidate save.
import { Engine, RuleLibrary, type Game, type Recipe } from '@openworld/engine'
import { CreationWorkshop } from './workshop.ts'
import type { CreatorDraft, CreatorJobStatus, CreatorDiscussionRequest } from './modderProtocol.ts'

/** Preserve the actual discussion, including accepted suggestions, instead of rewriting the player's order. */
export function creatorDiscussionOrder(message: string, history: CreatorDiscussionRequest['history']): string {
  return history.length ? `Implement the player's choices in this NPC discussion. Unaccepted suggestions are not requirements.\n${JSON.stringify({ history, player: message })}` : message
}

export type CreatorReference = {
  id: string; order: string; status: CreatorJobStatus['status']; kind: 'item' | 'uses' | 'map'
  subject?: string; awaitingApproval?: boolean; requiresReload?: boolean; sourceLoaded?: boolean; applied?: boolean; admissionError?: string
}
export type CreatorReferences = { creatorJobs?: CreatorReference[] }

/** A confirmation in a new discussion is not a retry of another discussion's identical final word. */
export function retainedCreatorOrder(refs: CreatorReference[], message: string, kind: CreatorReference['kind'], subject: string | undefined, history: CreatorDiscussionRequest['history']): CreatorReference | undefined {
  return history.length ? undefined : [...refs].reverse().find(r => r.order === message && r.subject === subject && r.kind === kind && !r.applied)
}

/** Source activation and save admission are separate. Retain a refused bundle for the same-order retry. */
export function admitCreatorJob<T>(owner: Game, ref: CreatorReference, freshSource: boolean, admit: () => T):
  { ok: true; value: T } | { ok: false; reason: string } {
  const finish = (error?: string) => owner.engine.author(() => {
    if (freshSource) ref.sourceLoaded = true
    delete ref.requiresReload
    if (error === undefined) { ref.applied = true; delete ref.admissionError }
    else ref.admissionError = error
  })
  let value: T
  try { value = admit() }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    finish(reason)
    return { ok: false, reason }
  }
  finish()
  return { ok: true, value }
}

function fork(owner: Game): Game {
  const eng = owner.engine
  const copy = new Engine(structuredClone(eng.world.state), structuredClone(eng.world.onto.data), RuleLibrary.fromJSON(structuredClone(eng.lib.toJSON())))
  copy.quality = { ...eng.quality }; copy.tier = eng.tier
  copy.loadInvariants(structuredClone(eng.invariants), [...eng.protectedFacts])
  copy.story.load(structuredClone([...eng.story.defs.values()]))
  copy.maps = structuredClone(eng.maps); copy.graph = structuredClone(eng.graph)
  for (const [id, recipe] of eng.recipes) copy.recipes.set(id, structuredClone(recipe))
  for (const [id, skill] of eng.skills) copy.skills.set(id, structuredClone(skill))
  // CreationWorkshop operates only on its owner's engine; the clone executes the same compilers and admissions.
  return { engine: copy } as Game
}

export function adoptCreatorDrafts(owner: Game, workshop: CreationWorkshop, drafts: Record<string, CreatorDraft>, recipes: Iterable<Recipe>, chars: Record<string, string>): { id: string; revision: number; kind: CreatorDraft['kind'] }[] {
  const candidates = Object.values(drafts)
  if (!candidates.length) throw new Error('The autonomous job returned no content drafts')
  const known = [...recipes], stagedOwner = fork(owner)
  const staged = new CreationWorkshop({ current: () => stagedOwner, link: () => undefined, chars: () => chars, recipes: () => known, post: () => {}, kept: () => {}, changed: () => {} })
  const apply = (target: CreationWorkshop, targetOwner: Game, record: CreatorDraft) => {
    const draft = record.item ?? record.map
    if (!draft || !record.item && !record.map || record.item && record.map) throw new Error('A creator candidate must own exactly one item/use or map draft')
    target.active = { owner: targetOwner, id: draft.id, revision: draft.revision, title: structuredClone(record.title), kind: record.kind,
      ...(record.item && { item: structuredClone(record.item) }), ...(record.map && { map: structuredClone(record.map) }) }
    target.trial(draft.id, draft.revision)
    if (record.item && !target.active.itemTrial?.ok || record.map && !target.active.mapTrial?.ok) throw new Error(`The current world refused ${draft.id}: ${JSON.stringify(target.active.itemTrial?.errors ?? target.active.mapTrial?.errors)}`)
    target.adopt(draft.id, draft.revision)
  }
  // Check the entire sequence against CURRENT inventory/dependencies before mutating any live definition or item.
  for (const record of candidates) apply(staged, stagedOwner, record)
  for (const record of candidates) apply(workshop, owner, record)
  return candidates.map(record => ({ id: (record.item ?? record.map)!.id, revision: (record.item ?? record.map)!.revision, kind: record.kind }))
}
