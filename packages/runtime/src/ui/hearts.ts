// A person's regard toward the one at the keys as ten hearts in the talk panel (hud.ts): a heart for every ten points,
// rounded — whole from its fifth point, half before it. A liking fades a little each day, so full regard is a mark it
// keeps for a while (a home ground's 95, OpenWorld's: content social.ts residence), and 95 reads ten whole hearts.

/** Each of the ten hearts for a regard (−100..100; below nothing shows): whole, half, or empty. */
export function heartsOf(regard: number): ('on' | 'half' | '')[] {
  const r = Math.max(0, Math.min(100, regard))
  return Array.from({ length: 10 }, (_, i) => (r >= (i + 1) * 10 - 5 ? 'on' : r > i * 10 ? 'half' : ''))
}
