// What the paper's evaluations share: the situations and answers as their files hold them, a seeded draw (the same
// draws every run), a shuffle, means and percentiles, and TrueSkill over pairwise choices (paper §7.1): the model
// judge's (controlled.ts) and the people's (study.ts).

import type { Cell } from '../../../tools/src/coverage.ts'

/** A situation: an undefined cell, or a held-out one (the authored rule removed). */
export interface Item {
  id: string
  set: 'heldout' | 'undefined'
  cell: Cell
  /** the authored rule removed (held-out situations) */
  heldOut?: string
}

/** One condition's answer to a situation. */
export interface Answer {
  item: string
  cond: string
  sentence: string
  /** the modder's: accepted, valid at its first answer, after repairs; the player's wait; cost */
  accepted?: boolean
  firstValid?: boolean
  ms?: number
  cost?: number
  calls?: number
  rules?: string[]
  route?: string[]
  error?: string
}

export interface Rating { item: string; cond: string; sense: number; fit: number }

/** A seeded draw in [0, 1) (Park and Miller's minimal standard): the same numbers from the same seed. */
export function minstd(seed: number): () => number {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** A shuffled copy (Fisher-Yates over the draw given). */
export function shuffled<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

/** The p-th percentile (0 to 1) of the values, by rank. */
export const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]

/** One choice between two conditions on one situation. */
export interface Choice {
  item: string
  a: string
  b: string
  winner: string
}

/** Two-player TrueSkill without draws (Herbrich et al. 2006): mu 25, sigma 25/3, beta sigma/2. */
export function trueskill(choices: Choice[]): Record<string, { mu: number; sigma: number }> {
  const s: Record<string, { mu: number; sigma: number }> = {}
  const get = (k: string) => (s[k] ??= { mu: 25, sigma: 25 / 3 })
  const beta = 25 / 6
  const pdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)
  const cdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))
  for (const c of choices) {
    const w = get(c.winner), l = get(c.winner === c.a ? c.b : c.a)
    const cc = Math.sqrt(2 * beta * beta + w.sigma ** 2 + l.sigma ** 2)
    const t = (w.mu - l.mu) / cc
    const v = pdf(t) / Math.max(cdf(t), 1e-12)
    const ww = v * (v + t)
    w.mu += (w.sigma ** 2 / cc) * v
    l.mu -= (l.sigma ** 2 / cc) * v
    w.sigma = Math.sqrt(w.sigma ** 2 * (1 - (w.sigma ** 2 / cc ** 2) * ww))
    l.sigma = Math.sqrt(l.sigma ** 2 * (1 - (l.sigma ** 2 / cc ** 2) * ww))
  }
  return s
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return x >= 0 ? y : -y
}
