// Small helpers shared by the agent, the modder and their command lines.

/** Overlap of two term sets, weighted toward the smaller one (a short lesson can match a long request). */
export function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const sb = new Set(b)
  let n = 0
  for (const t of a) if (sb.has(t)) n++
  return n / Math.sqrt(a.length * b.length)
}

/** Plain lowercase words of a text, for term-based retrieval of free-form tasks. */
export function wordsOf(text: string, max = 40): string[] {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'when', 'into', 'should', 'would', 'which', 'there', 'their', 'have', 'has', 'are', 'was', 'not', 'but', 'you', 'your'])
  const out = new Set<string>()
  for (const w of text.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/g) ?? []) if (!stop.has(w)) out.add(`w:${w}`)
  return [...out].slice(0, max)
}

export function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} more characters)` : s
}

/** A JSON value as a record keeps it: whole, or its text cut at `max` characters. */
export function clipJson(x: unknown, max: number): unknown {
  const s = JSON.stringify(x ?? {})
  return s.length > max ? `${s.slice(0, max)}…` : x
}

/** A command line's `--k <value>`: the value (undefined when `--k` comes last), or `d` when there is no `--k`. */
export const flags = (argv: string[]) => (k: string, d?: string): string | undefined => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
