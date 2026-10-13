// Gear's rolled extras (2026-10-11): a piece of gear made in the world — forged, dropped, stocked, laid on a map — has its
// main stats from its form, material and quality (fixed), and a few small extras rolled when it is made, from the
// world's table (Ontology.affixes): each a `sub:<key>` prop, read by World.stat as the key itself is.

import type { Ontology, Text } from './types.ts'

/** One extra a piece may roll: a stat key, its range and step, the slots it may roll on (all, if none), how often. */
export interface AffixDef {
  key: string
  min: number
  max: number
  step: number
  slots?: string[]
  weight?: number
  /** What a tooltip calls it (default: its key), and whether its value is a share, shown as a percentage (0.05: 5%). */
  name?: Text
  percent?: boolean
}

/** The world's table of extras: how many a piece rolls, and the pool they come from. */
export interface AffixTable {
  count: number
  pool: AffixDef[]
}

/** A rolled extra's prop. */
export const SUB = 'sub:'

/**
 * The extras a piece for `slot` rolls: so many different ones from the pool — the table's count, or what the world
 * gives a piece of its quality (params.gearLevels.affixCount: a finer piece rolls more) — each a value in its range on
 * its step; a piece's level widens the range (×(1 + affixPerLevel·(level − 1)), on the step).
 */
export function rollAffixes(data: Pick<Ontology, 'affixes' | 'params'>, slot: string, rand: () => number, opts: { quality?: string; level?: number } = {}): Record<string, number> {
  const table = data.affixes
  if (!table) return {}
  const g = data.params?.gearLevels
  const count = (opts.quality ? g?.affixCount?.[opts.quality] : undefined) ?? table.count
  const level = Math.min(g?.max ?? 1, Math.max(1, Math.round(Number(opts.level) || 1)))
  const f = 1 + (g?.affixPerLevel ?? 0) * (level - 1)
  const pool = table.pool.filter((a) => !a.slots || a.slots.includes(slot))
  const out: Record<string, number> = {}
  for (let i = 0; i < count && pool.length; i++) {
    const total = pool.reduce((n, a) => n + (a.weight ?? 1), 0)
    let r = rand() * total
    const k = pool.findIndex((a) => (r -= a.weight ?? 1) < 0)
    const a = pool.splice(k < 0 ? pool.length - 1 : k, 1)[0]
    const onStep = (v: number) => Math.round(v / a.step) * a.step
    const min = Math.max(a.step, onStep(a.min * f))
    const max = Math.max(min, onStep(a.max * f))
    const steps = Math.max(0, Math.round((max - min) / a.step))
    out[SUB + a.key] = Math.round((min + a.step * Math.floor(rand() * (steps + 1))) * 1000) / 1000
  }
  return out
}

/** Whether a thing's props already carry rolled extras. */
export const hasAffixes = (props: Record<string, unknown> | undefined) => !!props && Object.keys(props).some((k) => k.startsWith(SUB))
