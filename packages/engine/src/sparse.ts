// A map's things as what differs from its file (docs/continent.md §9). A map's chunk is the record of the things its
// file makes: each is made the first time the map is loaded (marked `from` it), and from then on the file stays its
// record — a save keeps only what differs from it (a merge patch: a person moved and hungrier is a few props), and what
// is gone stays gone. A map out of the player's way can be put away: its things leave memory with it (its file's as
// what differs, the rest whole — what was made or brought there, its changed cells) and come back when its file comes
// again, as they were. What the world needs wherever it is stays: the player, their companions, the people who travel,
// what a quest under way names, what the world's invariants look for, what is waiting for an outcome.
//
// This is loading, the author's: no event is made, nothing is gone, nothing's clock runs while it is put away (a map
// put away is dormant; its timers catch up and its inbox is read when it is entered, design.md §5.12).

import type { Engine, MapChunk } from './engine.ts'
import type { ChunkState, Entity, Id, Selector, WorldState } from './types.ts'
import { matchSelector } from './rules.ts'
import { regionId } from './world.ts'

type Json = Record<string, unknown>

/**
 * The index's people — the people who travel, and what they carry (WorldIndex.npcs) — are a file too: what of them a
 * save keeps is what differs from the index, under this key among the chunks (never a map's: they are never put away).
 */
export const ROSTER = '@people'

/** The index's people as records, each with what it carries (`_items`), every one marked from the roster. */
function rosterRecords(npcs: (Entity & { _items?: Entity[] })[]): Entity[] {
  return npcs.flatMap(({ _items, ...rest }) => {
    const out = [rest as Entity, ...(_items ?? [])].map((e) => ({ ...structuredClone(e), from: ROSTER }))
    // (a record as it is once made: what it carries in its own list, as being put inside it gives it)
    const by = new Map(out.map((e) => [e.id, e]))
    for (const e of out) {
      const h = e.place.on === 'inside' || e.place.on === 'hand' ? by.get(e.place.holder) : undefined
      if (h && e.place.on === 'inside' && !h.contents?.includes(e.id)) (h.contents ??= []).push(e.id)
      if (h && e.place.on === 'hand') h.held = e.id
    }
    return out
  })
}
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** RFC 7386: `base` with `patch` laid over it (a key set to null is taken away; arrays replace). A new object. */
export function mergePatch<T>(base: T, patch: Json): T {
  const out: Json = isObject(base) ? { ...base } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k]
    else if (isObject(v)) out[k] = mergePatch(out[k], v)
    else out[k] = v
  }
  return out as T
}

/** The merge patch that makes `base` into `now` (undefined: they are the same). */
export function diffPatch(base: unknown, now: unknown): Json | undefined {
  if (!isObject(base) || !isObject(now)) return undefined
  let out: Json | undefined
  for (const [k, v] of Object.entries(now)) {
    if (v === undefined) continue
    const b = base[k]
    if (isObject(v) && isObject(b)) {
      const d = diffPatch(b, v)
      if (d) (out ??= {})[k] = d
    } else if (JSON.stringify(v) !== JSON.stringify(b)) (out ??= {})[k] = isObject(v) ? structuredClone(v) : Array.isArray(v) ? structuredClone(v) : v
  }
  for (const k of Object.keys(base)) if (base[k] !== undefined && (!(k in now) || now[k] === undefined)) (out ??= {})[k] = null
  return out
}

/** The selectors of the world's `exists` conditions (what an invariant looks for anywhere): what is never put away. */
function existsSelectors(x: unknown, out: Selector[] = []): Selector[] {
  if (Array.isArray(x)) for (const v of x) existsSelectors(v, out)
  else if (isObject(x)) {
    for (const [k, v] of Object.entries(x)) {
      if (k === 'exists' && isObject(v)) out.push(v as Selector)
      else existsSelectors(v, out)
    }
  }
  return out
}

/**
 * Every thing a state holds, wherever it is kept: among its things, and put away with a map — whole, or as what differs
 * from its file (a patch: its own type and statuses, when they changed). What asks whether any thing is of a kind
 * (a learned kind forgotten, a save's own kinds) reads this, not the things in memory alone.
 */
export function everyThing(state: WorldState): Pick<Entity, 'type' | 'statuses'>[] {
  const out: Pick<Entity, 'type' | 'statuses'>[] = Object.values(state.entities)
  for (const c of Object.values(state.chunks ?? {})) {
    out.push(...(c.things ?? []))
    for (const p of Object.values(c.changed ?? {})) if (typeof p.type === 'string' || isObject(p.statuses)) out.push({ type: typeof p.type === 'string' ? p.type : '', statuses: isObject(p.statuses) ? (p.statuses as Record<string, number>) : undefined })
  }
  return out
}

export class Chunks {
  /** Each file thing kept in memory as its file made it (its JSON), by id: what a save tells its changes from. */
  private made = new Map<Id, string>()
  /** The things put away, by id → the map they went with (what is known of them: an event for one waits in its inbox). */
  private awayIdx?: Map<Id, string>

  constructor(private eng: Engine) {}

  /** The map a thing was put away with, if it was (and is known to be). */
  awayAt(id: Id): string | undefined {
    if (!this.awayIdx) {
      this.awayIdx = new Map()
      for (const [map, c] of Object.entries(this.eng.world.state.chunks ?? {})) {
        if (!c.away) continue
        for (const id of Object.keys(c.changed ?? {})) this.awayIdx.set(id, map)
        for (const t of c.things ?? []) this.awayIdx.set(t.id, map)
      }
    }
    return this.awayIdx.get(id)
  }

  /** Is a map's data and its things out of memory (put away, or loaded from a save that put it away)? */
  away(map: string): boolean {
    return !!this.eng.world.state.chunks?.[map]?.away
  }

  /**
   * A map's file has come (the author's, on loading): the first time, its things are made; a map put away gets its
   * things back as they were; an older save's map (all its things among the state's) is kept as what differs from now
   * on, what its file has and the state has not being gone. True when things came (their relations are to be seeded).
   */
  arrive(chunk: MapChunk): boolean {
    const w = this.eng.world
    const s = w.state
    const id = chunk.map.id
    const first = !s.loadedMaps.includes(id)
    if (first) s.loadedMaps.push(id)
    const older = !first && !s.chunks?.[id]
    const cs: ChunkState = ((s.chunks ??= {})[id] ??= {})
    let came = false
    const gone = new Set(cs.gone ?? [])
    // (a record as it is once made: what its file puts in it in its own list, as being put inside it gives it)
    const inside = new Map<Id, Id[]>()
    const inHand = new Map<Id, Id>()
    for (const raw of chunk.entities) {
      if (raw.place.on === 'inside') (inside.get(raw.place.holder) ?? inside.set(raw.place.holder, []).get(raw.place.holder)!).push(raw.id)
      if (raw.place.on === 'hand') inHand.set(raw.place.holder, raw.id)
    }
    for (const raw of chunk.entities) {
      const rec: Entity = { ...structuredClone(raw), from: id }
      const kids = inside.get(raw.id)?.filter((k) => !rec.contents?.includes(k))
      if (kids?.length) rec.contents = [...(rec.contents ?? []), ...kids]
      if (inHand.has(raw.id) && !rec.held) rec.held = inHand.get(raw.id)
      const json = JSON.stringify(rec)
      const kept = s.entities[raw.id]
      if (kept) {
        // an older save's own: it was the file's (the state keeps it whole, now told from its file)
        if (older && kept.from === undefined) kept.from = id
        if (kept.from === id) this.made.set(raw.id, json)
        continue
      }
      if (older) {
        // what its file has and an older save has not, it lost before it was kept this way: it stays gone
        ;(cs.gone ??= []).push(raw.id)
        continue
      }
      if (gone.has(raw.id)) continue
      // a map in memory has all of its things: one not among them is gone, or put away with another map (but a map a
      // save kept lean: its unchanged ones its file brings)
      if (!first && !cs.away && !cs.lean) continue
      const elsewhere = this.awayAt(raw.id)
      if (elsewhere !== undefined && elsewhere !== id) continue
      const patch = cs.changed?.[raw.id]
      this.made.set(raw.id, json)
      w.add(patch ? mergePatch(rec, patch) : rec, { again: !first })
      this.awayIdx?.delete(raw.id)
      came = true
    }
    if (cs.away) {
      for (const t of cs.things ?? []) {
        if (s.entities[t.id]) continue
        w.add(t, { again: true })
        this.awayIdx?.delete(t.id)
        came = true
      }
      delete cs.away
      delete cs.changed
      delete cs.things
    }
    delete cs.lean
    return came
  }

  /** A new game: the index's people are made, told from the index from now on (the caller holds the author's hand). */
  makeRoster(npcs: (Entity & { _items?: Entity[] })[]): void {
    const w = this.eng.world
    ;(w.state.chunks ??= {})[ROSTER] = {}
    for (const rec of rosterRecords(npcs)) {
      this.made.set(rec.id, JSON.stringify(rec))
      w.add(rec)
    }
  }

  /**
   * A save loaded: the index's people as it left them — what differs from the index laid over it, the gone left gone. A
   * save from before keeps its people whole (they are told from the index no more). The caller holds the author's hand.
   */
  loadRoster(npcs: (Entity & { _items?: Entity[] })[]): void {
    const w = this.eng.world
    const cs = w.state.chunks?.[ROSTER]
    if (!cs) return
    const gone = new Set(cs.gone ?? [])
    for (const rec of rosterRecords(npcs)) {
      const kept = w.state.entities[rec.id]
      if (kept) {
        if (kept.from === ROSTER) this.made.set(rec.id, JSON.stringify(rec))
        continue
      }
      if (gone.has(rec.id) || this.awayAt(rec.id) !== undefined) continue
      const patch = cs.changed?.[rec.id]
      this.made.set(rec.id, JSON.stringify(rec))
      w.add(patch ? mergePatch(rec, patch) : rec, { again: true })
    }
    delete cs.changed
  }

  /** Is a thing of the index's people gone (dead and done with, eaten, sold and used up)? */
  rosterGone(id: Id): boolean {
    return !!this.eng.world.state.chunks?.[ROSTER]?.gone?.includes(id)
  }

  /** What is never put away: the player, companions, people who travel, a quest's, an invariant's, one waiting for an outcome. */
  private keeper(): (e: Entity) => boolean {
    const eng = this.eng
    const w = eng.world
    const aliased = eng.quests.aliasedIds()
    const sought = existsSelectors(eng.invariants)
    return (e) =>
      e.id === w.state.player ||
      e.props?.companion !== undefined ||
      !!e.frozenBy ||
      (!!e.npc && e.npc.fidelity !== 'local') ||
      aliased.has(e.id) ||
      (sought.length > 0 && sought.some((sel) => { const v = w.view({ e: e.id }); return !!v && matchSelector(sel, v) }))
  }

  /** A thing and all it holds, at any depth. */
  private tree(e: Entity, seen = new Set<Entity>()): Entity[] {
    const w = this.eng.world
    seen.add(e)
    for (const id of [...(e.contents ?? []), ...(e.held ? [e.held] : [])]) {
      const c = w.state.entities[id]
      if (c && seen.size < 4096 && !seen.has(c)) this.tree(c, seen)
    }
    return [...seen]
  }

  /** What of a map would be put away: its things that may go (each with all it holds), its file's as what differs. */
  private plan(map: string, keeps: (e: Entity) => boolean): { out: Entity[]; changed: Record<Id, Json>; things: Entity[] } {
    const w = this.eng.world
    const out: Entity[] = []
    const taken = new Set<Entity>()
    const changed: Record<Id, Json> = {}
    const things: Entity[] = []
    for (const root of w.entitiesOnMap(map)) {
      const tree = this.tree(root)
      if (tree.some(keeps)) continue
      for (const e of tree) {
        out.push(e)
        taken.add(e)
        const made = e.from === map ? this.made.get(e.id) : undefined
        if (!made) things.push(e)
        else {
          const now = JSON.stringify(e)
          if (now === made) continue
          const d = diffPatch(JSON.parse(made), JSON.parse(now))
          if (d) changed[e.id] = d
        }
      }
    }
    // its own people who went where nothing is in memory (into a house not entered since): they go with their place
    const st = w.state
    for (const e of w.people()) {
      if (e.npc?.fidelity !== 'local' || e.from !== map || e.place.on !== 'tile' || e.place.map === map || taken.has(e)) continue
      const there = st.chunks?.[e.place.map]
      if (w.map(e.place.map) || (there && !there.away)) continue
      const tree = this.tree(e)
      if (tree.some(keeps)) continue
      for (const t of tree) {
        out.push(t)
        taken.add(t)
        const made = t.from === map ? this.made.get(t.id) : undefined
        if (!made) things.push(t)
        else {
          const d = diffPatch(JSON.parse(made), JSON.parse(JSON.stringify(t)))
          if (d) changed[t.id] = d
        }
      }
    }
    // its changed cells (a felled tree, a laid floor, a destroyed one's record): whole
    for (const c of w.keptCells(map)) if (!taken.has(c)) (out.push(c), things.push(c))
    return { out, changed, things }
  }

  /**
   * A map's named areas as its file has them (`MapData.regions`, `regionProps`): made again from the file when it comes
   * back (`Engine.mapArrived`), so they leave with it and only one that changed is kept. A town has dozens (every house's
   * shell, docs/building.md §10).
   */
  private fileRegions(map: string, keeps: (e: Entity) => boolean): Entity[] {
    const w = this.eng.world
    const data = w.map(map)
    const out: Entity[] = []
    for (const [name, r] of Object.entries(data?.regions ?? {})) {
      const e = w.state.entities[regionId(map, name)]
      if (!e || keeps(e)) continue
      const asFile: Entity = { id: e.id, type: 'region', place: { on: 'area', map, rects: [r] }, ...(data!.regionProps?.[name] && { props: data!.regionProps[name] }) }
      if (JSON.stringify(e) === JSON.stringify(asFile)) out.push(e)
    }
    return out
  }

  /** The maps a save puts away: those kept as what differs from their files, but the player's and one a step waits for. */
  private savable(): string[] {
    const s = this.eng.world.state
    const here = this.eng.activeMap
    return Object.entries(s.chunks ?? {})
      .filter(([m, c]) => m !== ROSTER && !c.away && m !== here && m !== this.eng.pendingTransition?.map)
      .map(([m]) => m)
  }

  /** The things of a map that are as its file has them, each with all it holds (a tree only when all of it is): what a lean save leaves out. */
  private unchanged(map: string, keeps: (e: Entity) => boolean): Entity[] {
    const w = this.eng.world
    const out: Entity[] = []
    for (const root of w.entitiesOnMap(map)) {
      const tree = this.tree(root)
      if (tree.every((e) => !keeps(e) && e.from === map && this.made.get(e.id) === JSON.stringify(e))) out.push(...tree)
    }
    return out
  }

  /**
   * The state as a save keeps it (a copy; the live state is not touched): every map but the player's put away — its
   * file's things as what differs from it, what is as its file has it left out —; the player's lean (its things as its
   * file has them left out, the rest whole: a save loads onto its map with the map's data alone); the index's people as
   * what differs from the index; map data left out.
   */
  packed(): WorldState {
    const w = this.eng.world
    const s = w.state
    const keeps = this.keeper()
    const entities = { ...s.entities }
    const relations = s.relations && { ...s.relations }
    const chunks: Record<string, ChunkState> = { ...s.chunks }
    for (const map of this.savable()) {
      const { out, changed, things } = this.plan(map, keeps)
      for (const e of [...out, ...this.fileRegions(map, keeps)]) (delete entities[e.id], relations && delete relations[e.id])
      chunks[map] = { ...chunks[map], away: true, ...(Object.keys(changed).length && { changed }), ...(things.length && { things }) }
    }
    const here = this.eng.activeMap
    if (chunks[here] && !chunks[here].away) {
      const lean = this.unchanged(here, keeps)
      for (const e of lean) (delete entities[e.id], relations && delete relations[e.id])
      if (lean.length) chunks[here] = { ...chunks[here], lean: true }
    }
    // the index's people, wherever they are: what differs from the index
    if (chunks[ROSTER]) {
      const changed: Record<Id, Json> = {}
      for (const e of Object.values(entities)) {
        const made = e.from === ROSTER ? this.made.get(e.id) : undefined
        if (!made) continue
        delete entities[e.id]
        if (relations) delete relations[e.id]
        const now = JSON.stringify(e)
        if (now === made) continue
        const d = diffPatch(JSON.parse(made), JSON.parse(now))
        if (d) changed[e.id] = d
      }
      chunks[ROSTER] = { ...chunks[ROSTER], ...(Object.keys(changed).length && { changed }) }
    }
    return { ...s, entities, maps: {}, ...(relations && { relations }), ...(Object.keys(chunks).length && { chunks }) }
  }

  /**
   * Put a map away (the host's, when it is far behind: Game.trim): its things leave memory with its data, to come back
   * as they were when its file comes again. False when it cannot be (the player's map, an older save's whole map). The
   * caller holds the author's hand.
   */
  putAway(map: string): boolean {
    const eng = this.eng
    const w = eng.world
    const s = w.state
    const cs = s.chunks?.[map]
    if (!cs || cs.away || map === ROSTER || map === eng.activeMap || map === eng.pendingTransition?.map) return false
    const keeps = this.keeper()
    const { out, changed, things } = this.plan(map, keeps)
    for (const e of this.fileRegions(map, keeps)) w.takeOut(e)
    const idx = this.awayIdx
    for (const e of out) {
      w.takeOut(e)
      if (s.relations) delete s.relations[e.id]
      this.made.delete(e.id)
      idx?.set(e.id, map)
    }
    cs.away = true
    if (Object.keys(changed).length) cs.changed = changed
    if (things.length) cs.things = things
    delete s.maps[map]
    w.forgetMap(map)
    return true
  }
}
