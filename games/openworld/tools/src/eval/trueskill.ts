// TrueSkill over pairwise choices (paper §7.1): the model judge's (controlled.ts) and the people's (study.ts).

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
