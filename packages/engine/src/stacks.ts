// The bag's existing stack identity, shared with containers. A container splits a kind into
// slots of at most STACK_MAX; its panel, transfers and capacity check use that same grouping.
//
// A module of its own because both world.ts and rules.ts need it, and they import each other.

/** How many of one kind fit one container slot. */
export const STACK_MAX = 999

/** Whatever a stack key is read off: an entity, a view of one, or the frame's own item. */
export interface StackShape {
  type: string
  /** The thing's own id: a piece (`isPiece`) is a stack of its own. */
  id?: string
  /** Its own props (never the type's): what it carries that its kind does not — a letter's text, a piece's wear. */
  props?: Record<string, unknown>
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
 * Which kinds are pieces: a tool, a weapon, anything worn — one to a slot, never stacked, each with what it
 * alone carries (its wear, its affixes). The world says, from its ontology (`World`: the tags `tool` and `weapon`,
 * a `slot` to be worn in); until a world is made, none is.
 */
let pieces: (type: string) => boolean = () => false
export function usePieces(test: (type: string) => boolean): void {
  pieces = test
}
export const isPiece = (type: string): boolean => pieces(type)

/** A piece no thing stands behind yet (a catch counted before it is caught): a slot of its own all the same. */
let unborn = 0

/**
 * Props that say whose a thing is, not what it is: a loaf bought (its owner the buyer) and a loaf found (no owner) are
 * the same loaf in one's bag; a stolen one is told apart where it matters (the views' `steal`).
 */
const WHOSE = new Set(['owner'])

/** A thing's own props as a sorted list, or nothing when it has none (beyond whose it is). */
function own(props: StackShape['props']): [string, unknown][] | undefined {
  if (!props) return undefined
  const keys = Object.keys(props).filter((k) => !WHOSE.has(k) && props[k] !== undefined)
  return keys.length ? keys.sort().map((k) => [k, props[k]]) : undefined
}

/**
 * What makes things one stack (how the bag's rows are drawn and how a container's slots are counted, `count …
 * stacks`): a piece (`isPiece`: a tool, a weapon, anything worn) is a stack of its own, one to a slot. Anything else
 * stacks with what is the same in every way: the same kind, name, tags and statuses, and the same props of its own
 * (two letters with different words are two rows), whoever owns it.
 */
export function stackKey(e: StackShape): string {
  if (e.stackKey !== undefined) return e.stackKey
  const piece = pieces(e.type)
  const name = (e.name ?? e.entity?.name) ?? null
  const mine = piece ? undefined : own(e.props)
  if (!piece && !mine && name === null && empty(e.tags) && empty(e.statuses)) {
    let key = plainKeys.get(e.type)
    if (key === undefined) plainKeys.set(e.type, (key = JSON.stringify([e.type, null, [], []])))
    return key
  }
  const key: unknown[] = [e.type, name, names(e.tags), names(e.statuses)]
  if (mine) key.push(mine)
  if (piece) key.push({ piece: e.id ?? `~${++unborn}` })
  return JSON.stringify(key)
}

/**
 * The key a thing had before pieces and own props were told apart (every axe one stack): an older save's bag slots
 * hold it, and the bag puts the first piece it now means back in that slot (`Controls.syncSlots`).
 */
export function oldStackKey(e: StackShape): string {
  const name = (e.name ?? e.entity?.name) ?? null
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
