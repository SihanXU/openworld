// The is-a hierarchy. Type ids are slash paths, so `a isA b` is a prefix test; the
// registry merges tags/props/sprite down the chain and caches the result per type.

import type { Ontology, PropValue, Space, StatusDef, TerrainDef, TypeDef } from './types.ts'

export interface ResolvedType {
  id: string
  tags: string[]
  props: Record<string, PropValue>
  sprite?: string
  solid: boolean
  /** The base on the ground, [width, depth] (TypeDef.footprint). */
  footprint: [number, number]
  /** The stances it acts on (TypeDef.reach). */
  reach?: string[]
  /** The spaces it takes in its cell, if its type says (TypeDef.occupies). */
  occupies?: Space[]
  /** The terrain it is drawn as, if it makes up its cell (TypeDef.terrain). */
  terrain?: string
  name?: TypeDef['name']
  /** Ancestor chain from root to self (only registered ids). */
  chain: string[]
  depth: number
}

export function isA(type: string, ancestor: string): boolean {
  return type === ancestor || type.startsWith(ancestor + '/')
}

/** A terrain is a type of thing like any other (world-model.md §4.6): each is registered as `tile/<id>`, under `tile`. */
export function withTerrainTypes(data: Ontology): Ontology {
  data.types.tile ??= { id: 'tile' }
  for (const t of Object.values(data.terrains)) data.types[`tile/${t.id}`] ??= terrainType(t)
  return data
}

/** The type of the cell things made of a terrain: its space, what stands on it (a floor: the ground by default), whether it blocks. */
export function terrainType(t: TerrainDef): TypeDef {
  const space = t.space ?? 'floor'
  return { id: `tile/${t.id}`, name: t.name, tags: t.tags, solid: t.solid, occupies: [space], terrain: t.id, reach: t.reach ?? (space === 'floor' ? ['ground'] : []) }
}

export function typeDepth(type: string): number {
  return type.split('/').length
}

export class OntologyIndex {
  readonly data: Ontology
  private cache = new Map<string, ResolvedType>()

  constructor(data: Ontology) {
    this.data = data
    withTerrainTypes(data)
  }

  private biggest?: [number, number]
  /** The widest and deepest footprint of any type: how far around a tile a base can reach. */
  get maxFootprint(): [number, number] {
    if (!this.biggest) {
      let [w, d] = [1, 1]
      for (const t of Object.values(this.data.types)) if (t.footprint) [w, d] = [Math.max(w, t.footprint[0]), Math.max(d, t.footprint[1])]
      this.biggest = [w, d]
    }
    return this.biggest
  }

  /** Register (or replace) a type at runtime, e.g. from an accepted patch. */
  addType(def: TypeDef): void {
    this.data.types[def.id] = def
    this.cache.clear()
    this.biggest = undefined
  }

  addStatus(def: StatusDef): void {
    this.data.statuses[def.id] = def
  }

  hasType(id: string): boolean {
    return id in this.data.types
  }

  /** True when `id` is a registered type or a prefix of one (usable in a selector). */
  knowsTypePrefix(id: string): boolean {
    if (id in this.data.types) return true
    for (const t in this.data.types) if (t.startsWith(id + '/')) return true
    return false
  }

  status(id: string): StatusDef | undefined {
    return this.data.statuses[id]
  }

  terrain(id: string): TerrainDef | undefined {
    return this.data.terrains[id]
  }

  resolve(id: string): ResolvedType {
    const hit = this.cache.get(id)
    if (hit) return hit
    const parts = id.split('/')
    const chain: string[] = []
    const tags = new Set<string>()
    const props: Record<string, PropValue> = {}
    let sprite: string | undefined
    let solid = false
    let footprint: [number, number] = [1, 1]
    let reach: string[] | undefined
    let occupies: Space[] | undefined
    let terrain: string | undefined
    let name: TypeDef['name']
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/')
      const def = this.data.types[p]
      if (!def) continue
      chain.push(p)
      for (const t of def.tags ?? []) tags.add(t)
      Object.assign(props, def.props ?? {})
      if (def.sprite) sprite = def.sprite
      if (def.solid !== undefined) solid = def.solid
      if (def.footprint) footprint = def.footprint
      if (def.reach) reach = def.reach
      if (def.occupies) occupies = def.occupies
      if (def.terrain) terrain = def.terrain
      if (def.name) name = def.name
    }
    const r: ResolvedType = { id, tags: [...tags], props, sprite, solid, footprint, reach, occupies, terrain, name, chain, depth: parts.length }
    this.cache.set(id, r)
    return r
  }
}
