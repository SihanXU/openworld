// What the world learned that the main thread shows: the recipes of learned things (a patch's type
// with a station and a makeup is crafted like the content's own, world-model.md §6.4).

import { deriveRecipes, namesClash, newStatusProblems, newTypeProblems, type Engine, type Entity, type LibraryData, type Patch, type Recipe, type SaveData, type StatusDef, type TypeDef } from '@openworld/engine'
import { recipeById } from './game.ts'

/** The recipes whose result is a type a patch brought (the engine derives them when the patch lands). */
export function learnedRecipes(eng: Engine): Recipe[] {
  const learned = new Set(eng.lib.types.map((t) => t.id))
  return [...eng.recipes.values()].filter((r) => learned.has(r.make.type))
}

/** A recipe by id: the game's, else one the engine holds (a learned thing's). */
export function recipeOf(eng: Engine | undefined, id: string): Recipe | undefined {
  return recipeById()[id] ?? eng?.recipes.get(id)
}

/** The types a learned type names: what it is made of, what it becomes (by its stage, or a prop a rule turns it by: cookedType, cropType), what it leaves. */
const named = (t: TypeDef): string[] => [
  ...(t.makeup ?? []).map((m) => m.type),
  ...(t.stage?.into ? [t.stage.into] : []),
  ...(t.stage?.yields ?? []).map((y) => y.type),
  ...Object.values(t.props ?? {}).filter((v): v is string => typeof v === 'string' && v.includes('/')),
]

/** A type and the kinds it is a kind of (item/food/jam: item, item/food, item/food/jam). */
const kinds = (id: string): string[] => id.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'))

/** Is a learned type still wanted here: a thing is of it or of a kind of it, or another learned type is a kind of it or names it. */
function wanted(id: string, entities: Entity[], learned: TypeDef[]): boolean {
  const under = (t: string) => t === id || t.startsWith(`${id}/`)
  return entities.some((e) => under(e.type)) || learned.some((t) => t.id !== id && (under(t.id) || named(t).includes(id)))
}

/**
 * The shared library rolled a learned type back (with the patch that brought it): forget it, with its
 * recipe, unless something here is made of it already (that thing keeps what it is). Returns whether it went.
 */
export function forgetType(eng: Engine, id: string): boolean {
  const w = eng.world
  if (!eng.lib.types.some((t) => t.id === id)) return false
  if (wanted(id, Object.values(w.state.entities), eng.lib.types)) return false
  eng.lib.removeType(id)
  w.onto.removeType(id)
  for (const [rid, r] of eng.recipes) if (r.make.type === id) eng.recipes.delete(rid)
  return true
}

/**
 * The shared library is the one source of what a learned thing is: a synced patch that brings a type (or
 * status) this client learned differently (one it kept for a thing it holds when the library forgot it,
 * before the corrected one came) replaces it, so the patch is taken and what it made becomes the new kind.
 * Returns how to put the old ones back, should the patch not be taken after all.
 */
export function takeDefinitions(eng: Engine, patch: Patch): { replaced: string[]; restore: () => void; done: () => string[] } {
  const w = eng.world
  const old: { types: TypeDef[]; statuses: StatusDef[] } = { types: [], statuses: [] }
  // a learned thing here with the name of one the patch brings under another id (one kept for what is made of
  // it after the library forgot it): stepped aside while the patch is judged, then back if still needed
  const incoming = (patch.artifacts ?? []).flatMap((a) => (a?.kind === 'type' && a.type?.id ? [a.type] : []))
  const aside = eng.lib.types.filter((t) => incoming.some((n) => n.id !== t.id && !incoming.some((m) => m.id === t.id) && namesClash(n, t)))
  for (const t of aside) {
    eng.lib.removeType(t.id)
    w.onto.removeType(t.id)
    for (const [rid, r] of eng.recipes) if (r.make.type === t.id) eng.recipes.delete(rid)
  }
  for (const a of patch.artifacts ?? []) {
    if (a?.kind === 'type' && a.type?.id) {
      const was = eng.lib.types.find((t) => t.id === a.type.id)
      if (!was || JSON.stringify(was) === JSON.stringify(a.type)) continue
      eng.lib.removeType(was.id)
      w.onto.removeType(was.id)
      // its recipe is the new definition's to make again (or not, if it has no station now)
      for (const [rid, r] of eng.recipes) if (r.make.type === was.id) eng.recipes.delete(rid)
      old.types.push(was)
    } else if (a?.kind === 'status' && a.status?.id) {
      const was = eng.lib.statuses.find((x) => x.id === a.status.id)
      if (!was || JSON.stringify(was) === JSON.stringify(a.status)) continue
      eng.lib.removeStatus(was.id)
      w.onto.removeStatus(was.id)
      old.statuses.push(was)
    }
  }
  const putBack = (types: TypeDef[]) => {
    for (const t of types) if (!eng.lib.types.some((x) => x.id === t.id)) (eng.lib.addType(t), w.onto.addType(t))
    if (types.length) for (const r of deriveRecipes(w.onto)) if (!eng.recipes.has(r.id)) eng.recipes.set(r.id, r)
  }
  const restore = () => {
    putBack([...old.types, ...aside])
    for (const st of old.statuses) if (!eng.lib.statuses.some((x) => x.id === st.id)) (eng.lib.addStatus(st), w.onto.addStatus(st))
  }
  // the patch taken: what stepped aside comes back only for what is made of it
  const done = () => {
    const back = aside.filter((t) => wanted(t.id, Object.values(w.state.entities), eng.lib.types))
    putBack(back)
    return back.map((t) => t.id)
  }
  return { replaced: [...old.types, ...old.statuses].map((d) => d.id), restore, done }
}

/** The shared library forgot a learned status: forgotten here too, unless something here has it. */
export function forgetStatus(eng: Engine, id: string): boolean {
  const w = eng.world
  if (!eng.lib.statuses.some((s) => s.id === id)) return false
  if (Object.values(w.state.entities).some((e) => e.statuses?.[id] !== undefined)) return false
  eng.lib.removeStatus(id)
  w.onto.removeStatus(id)
  return true
}

/**
 * The shared library as one save takes it up. The library is every save's, so a sync while another game
 * was played may have forgotten a learned kind that game had none of; this save's own things keep theirs:
 * the kinds they are (with the kinds those are kinds of, and what they are made of, become and leave) and
 * the statuses they have come back from the save's copy of the library. `kept` names them: they are this
 * save's, and are not written back to the shared library.
 */
export function withKept(shared: LibraryData | undefined, save: SaveData | undefined): { library: LibraryData | undefined; kept: { types: string[]; statuses: string[] } } {
  const own = save?.library
  const none = { types: [], statuses: [] }
  if (!shared || !own) return { library: shared ?? own, kept: none }
  const entities = Object.values(save.state.entities)
  const missing = (own.types ?? []).filter((t) => !shared.types.some((x) => x.id === t.id))
  const want = new Set(entities.flatMap((e) => kinds(e.type)))
  for (let grew = true; grew; ) {
    grew = false
    for (const t of missing) if (want.has(t.id)) for (const k of named(t).flatMap(kinds)) if (!want.has(k)) (want.add(k), (grew = true))
  }
  const types = missing.filter((t) => want.has(t.id))
  const had = new Set(entities.flatMap((e) => Object.keys(e.statuses ?? {})))
  const statuses = (own.statuses ?? []).filter((s) => had.has(s.id) && !shared.statuses.some((x) => x.id === s.id))
  if (!types.length && !statuses.length) return { library: shared, kept: none }
  return { library: { ...shared, types: [...shared.types, ...types], statuses: [...shared.statuses, ...statuses] }, kept: { types: types.map((t) => t.id), statuses: statuses.map((s) => s.id) } }
}

/** The library as the shared store keeps it: without what only this save keeps (`withKept`). */
export function sharedPart(lib: LibraryData, kept: { types: Set<string>; statuses: Set<string> }): LibraryData {
  if (!kept.types.size && !kept.statuses.size) return lib
  return { ...lib, types: lib.types.filter((t) => !kept.types.has(t.id)), statuses: lib.statuses.filter((s) => !kept.statuses.has(s.id)) }
}

/** An answer taken brings definitions from the library: what it brings that only this save kept is the library's again. Returns how to undo it, should the answer be refused. */
export function shareKept(kept: { types: Set<string>; statuses: Set<string> }, patch: Patch): () => void {
  const back: (() => void)[] = []
  for (const a of patch.artifacts ?? []) {
    const set = a?.kind === 'type' ? kept.types : a?.kind === 'status' ? kept.statuses : undefined
    const id = a?.kind === 'type' ? a.type?.id : a?.kind === 'status' ? a.status?.id : undefined
    if (set && id && set.delete(id)) back.push(() => set.add(id))
  }
  return () => back.forEach((f) => f())
}

/** The pictures of learned things the main thread has not got as they are now: new ones, and ones a definition taken again redrew. Marks them sent. */
export function artsToSend(types: TypeDef[], sent: Map<string, string>): { id: string; art: NonNullable<TypeDef['art']> }[] {
  const out: { id: string; art: NonNullable<TypeDef['art']> }[] = []
  for (const t of types) {
    if (!t.art) continue
    const sig = JSON.stringify(t.art)
    if (sent.get(t.id) === sig) continue
    sent.set(t.id, sig)
    out.push({ id: t.id, art: t.art })
  }
  return out
}

/**
 * On loading: a learned kind or status the checks no longer take (one an older client kept when the shared
 * library forgot it, or one restored past the checks of its time) is forgotten, as the shared library's
 * prune does, unless a thing here needs it. Each type is judged with its own rules, against the world and
 * the rest of what was learned, the later of two by one name being the other name. Returns what went.
 */
export function forgetInvalid(eng: Engine, kept: Set<string> = new Set()): string[] {
  const w = eng.world
  const gone: string[] = []
  // in the order they were first learned (a definition taken anew moves a type to the end of the list); what only
  // this save keeps comes last, giving way to the library's (a corrected kind beside the old one kept for its things)
  const first = (id: string) => ((i) => (i < 0 ? Infinity : i))(eng.lib.log.findIndex((e) => e.action === 'add' && e.type?.id === id))
  const rank = (id: string) => (kept.has(id) ? 1e9 : 0) + first(id)
  const learned = [...eng.lib.types].sort((a, b) => rank(a.id) - rank(b.id))
  for (const [i, t] of learned.entries()) {
    const full = { ...w.onto.data, types: { ...w.onto.data.types } }
    delete full.types[t.id]
    for (const later of learned.slice(i + 1)) if (namesClash(t, later)) delete full.types[later.id]
    const own = eng.lib.patches().filter((r) => r.host?.type === t.id)
    const patch: Patch = { artifacts: [{ kind: 'type', type: t }, ...own.map((rule) => ({ kind: 'rule' as const, rule }))] }
    if (newTypeProblems(t, full, patch).length && forgetType(eng, t.id)) gone.push(t.id)
  }
  for (const st of [...eng.lib.statuses]) if (newStatusProblems(st).length && forgetStatus(eng, st.id)) gone.push(st.id)
  // a learned rule that makes a kind forgotten here would make a thing of no kind: it goes too
  const forgotten = new Set(gone)
  for (const r of eng.lib.patches()) if (makes(r.tree).some((id) => forgotten.has(id))) (eng.lib.remove(r.id), gone.push(r.id))
  return gone
}

/** The kinds a tree's effects make (spawn, transform into, a bundle dropped), an open leaf's default too. */
function makes(t: unknown): string[] {
  if (!t || typeof t !== 'object') return []
  const n = t as { if?: unknown; then?: unknown; else?: unknown; do?: unknown; default?: unknown }
  if ('if' in n) return [...makes(n.then), ...makes(n.else)]
  const effects = [...(Array.isArray(n.do) ? n.do : []), ...(Array.isArray(n.default) ? n.default : [])]
  return effects.flatMap((e: { op?: string; type?: unknown; into?: unknown; bundle?: unknown }) =>
    e?.op === 'spawn' && typeof e.type === 'string' ? [e.type] : e?.op === 'transform' && typeof e.into === 'string' ? [e.into] : e?.op === 'dropContents' && typeof e.bundle === 'string' ? [e.bundle] : [],
  )
}
