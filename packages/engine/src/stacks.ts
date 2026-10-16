// The bag's existing stack identity, shared with containers. A container splits a kind into
// slots of at most STACK_MAX; its panel, transfers and capacity check use that same grouping.
//
// A module of its own because both world.ts and rules.ts need it, and they import each other.

/** How many of one kind fit one container slot. */
export const STACK_MAX = 999

/** Whatever a stack key is read off: an entity, a view of one, or the frame's own item. */
export interface StackShape {
  type: string
  /** Frames carry the entity's identity rather than reconstructing it from display defaults. */
  stackKey?: string
  name?: unknown
  /** A view keeps the thing it is of here (a view names itself nothing). */
  entity?: { name?: unknown }
  tags?: readonly string[] | ReadonlySet<string> | Record<string, unknown>
  statuses?: readonly string[] | ReadonlySet<string> | Record<string, unknown>
}

/** The names of tags or statuses, sorted, however they were kept (a list, a set, or an object's keys). */
function names(v: StackShape['tags']): string[] {
  if (!v) return []
  const list = Array.isArray(v) ? v : v instanceof Set ? [...v] : Object.keys(v)
  return [...list].sort()
}

const plainKeys = new Map<string, string>()
function empty(v: StackShape['tags']): boolean {
  if (!v) return true
  if (Array.isArray(v)) return v.length === 0
  if (v instanceof Set) return v.size === 0
  return Object.keys(v).length === 0
}

/**
 * What makes things one stack: the same kind, the same name, the same tags and the same statuses —
 * how the bag's rows are drawn and how a container's slots are counted (`count … stacks`).
 *
 * Deliberately not in the key: props. Two things of a kind that differ only in what they carry
 * (durability, an affix) share a row — the bag's behaviour since it was built.
 */
export function stackKey(e: StackShape): string {
  if (e.stackKey !== undefined) return e.stackKey
  const name = (e.name ?? e.entity?.name) ?? null
  if (name === null && empty(e.tags) && empty(e.statuses)) {
    let key = plainKeys.get(e.type)
    if (key === undefined) plainKeys.set(e.type, (key = JSON.stringify([e.type, null, [], []])))
    return key
  }
  return JSON.stringify([e.type, name, names(e.tags), names(e.statuses)])
}

/** Stable groups for the container panel and the input that transfers one displayed slot. */
export function splitStacks<T extends StackShape>(items: Iterable<T>): T[][] {
  const by = new Map<string, T[]>()
  for (const item of items) {
    const key = stackKey(item)
    const group = by.get(key)
    if (group) group.push(item)
    else by.set(key, [item])
  }
  return [...by.values()].flatMap((group) =>
    Array.from({ length: Math.ceil(group.length / STACK_MAX) }, (_, i) => group.slice(i * STACK_MAX, (i + 1) * STACK_MAX)),
  )
}

/** The slots a list of stack keys takes: one per kind, and one more for each STACK_MAX beyond the first. */
export function slotsOf(keys: Iterable<string>): number {
  const by = new Map<string, number>()
  for (const k of keys) by.set(k, (by.get(k) ?? 0) + 1)
  let n = 0
  for (const c of by.values()) n += Math.ceil(c / STACK_MAX)
  return n
}
