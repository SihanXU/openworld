// Authored-content migration for the people's trade (2026-10-11): every person sells what fits who they are, and the
// merchants of before sell more. A person's goods are its `stock` ("type*count|…": what each morning's restock fills
// back to), and loading a save only gives a person the props it never had (engine game.ts) — so one who already traded
// in an older save would keep its shorter list for good. Each such list takes in what the world's has now: every kind
// it sells, at least as many. It is the author's, run on loading (the caller holds the author's hand: `engine.author`),
// never game code.
import type { Game, WorldIndex } from '@openworld/engine'

/** Saves marked with it have the people's stock as the world has it now. */
export const STOCK_LAYOUT = 'content.stock-v2'

const parse = (s: string): Map<string, number> => new Map(s.split('|').filter(Boolean).map((part) => {
  const [type, n] = part.split('*')
  return [type, Math.max(1, Number(n) || 1)] as const
}))

export function migrateStock(game: Game, index: WorldIndex): void {
  const w = game.engine.world
  if (w.fact(STOCK_LAYOUT)) return
  for (const n of index.npcs) {
    const now = n.props?.stock
    const e = w.get(n.id)
    const kept = e?.props?.stock
    if (!e || typeof now !== 'string' || typeof kept !== 'string' || kept === now) continue
    const goods = parse(kept)
    for (const [type, count] of parse(now)) goods.set(type, Math.max(count, goods.get(type) ?? 0))
    w.setProp(e, 'stock', [...goods].map(([type, count]) => `${type}*${count}`).join('|'))
  }
  w.setFact(STOCK_LAYOUT, true)
}
