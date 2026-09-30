// Seeded PRNG (mulberry32). The state lives in WorldState.rng so every run is replayable.

export function nextRandom(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** A standalone generator for offline content generation. */
export class Rng {
  private s: { rng: number }
  constructor(seed: number) {
    this.s = { rng: seed | 0 }
  }
  next(): number {
    return nextRandom(this.s)
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1))
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)]
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
}
