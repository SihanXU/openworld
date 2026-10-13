// The Held Ground's stock against its widenings (ui/homestead.ts; content haven.ts): one pile of materials, kept in the
// story's facts (`haven.stock.<type>`), that every widening draws on as it is built. So a card shows the whole stock of
// a kind beside what it needs — never a share of its own: the same pile stands behind every card — and a widening can
// be built when the stock holds all it asks (what the steward checks); building one takes from what the others see.
// What the open widenings still lack of a kind, together, is what all of them ask less the stock, once.

import type { PropValue } from '@openworld/engine'

/** A widening as the panel reckons it (content HavenUpgrade). */
export interface Widening {
  id: string
  track: 'land' | 'zone' | 'building'
  needs: { type: string; count: number }[]
  /** The land it needs first (`size` at least). */
  land: number
  /** The fact it sets as it is done, and to what. */
  fact: string
  value: number
}

export type WideningState = 'done' | 'open' | 'locked'

export interface WideningView<U extends Widening> {
  u: U
  state: WideningState
  /** Open, and the stock holds all it asks: it can be built now (and building it takes that from the stock). */
  buildable: boolean
  /** Each thing it asks: the stock of that kind (the whole pile), and what the pile lacks for this widening alone. */
  needs: (U['needs'][number] & { stock: number; lack: number })[]
}

export interface StockView<U extends Widening> {
  /** How far the land goes. */
  size: number
  rows: WideningView<U>[]
  /** The stock of a kind. */
  stock(type: string): number
  /** What the open widenings lack of a kind, all together: what they ask of it less the stock (none below nothing). */
  lacking(type: string): number
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

/** The widenings against the stock, from the story's facts: the land's size at `keys.size`, the stock at `<keys.stock><type>`. */
export function stockView<U extends Widening>(upgrades: U[], facts: Record<string, PropValue>, keys: { size: string; stock: string }): StockView<U> {
  const size = num(facts[keys.size])
  const stock = (type: string) => num(facts[`${keys.stock}${type}`])
  const rows = upgrades.map((u): WideningView<U> => {
    const needs = u.needs.map((n) => ({ ...n, stock: stock(n.type), lack: Math.max(0, n.count - stock(n.type)) }))
    const done = num(facts[u.fact]) >= u.value
    // a ring of the land opens only after the one before it; the other tracks once the land reaches theirs
    const open = size >= u.land && (u.track !== 'land' || size === u.value - 1)
    const state: WideningState = done ? 'done' : open ? 'open' : 'locked'
    return { u, state, buildable: state === 'open' && needs.every((n) => n.lack === 0), needs }
  })
  const asked = new Map<string, number>()
  for (const r of rows) if (r.state === 'open') for (const n of r.needs) asked.set(n.type, (asked.get(n.type) ?? 0) + n.count)
  return { size, rows, stock, lacking: (type) => Math.max(0, (asked.get(type) ?? 0) - stock(type)) }
}
