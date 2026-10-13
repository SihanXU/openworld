// Standing your ground, stealth and perception left the gear (2026-10-12): luck came in their place. A save's pieces
// that rolled one of the three as an extra (engine affixes.ts) have luck instead, as much as the pool gives; a piece
// that carries one as its own (Brother Odo's pauldrons) has defence, dodge or luck for it.

import type { Game } from '@openworld/engine'

export const STATS_LAYOUT = 'content.stats-luck-v1'

const GONE = ['sub:holdFast', 'sub:stealth', 'sub:perception']

export function migrateStats(game: Game): void {
  const w = game.engine.world
  if (w.fact(STATS_LAYOUT)) return
  for (const e of Object.values(w.state.entities)) {
    const props = e.props
    if (!props || !GONE.some((k) => k in props)) continue
    let luck = typeof props['sub:luck'] === 'number' ? props['sub:luck'] : 0
    for (const k of GONE)
      if (k in props) {
        luck += 0.05
        delete props[k]
      }
    props['sub:luck'] = Math.min(0.15, Math.round(luck * 100) / 100)
  }
  for (const e of Object.values(w.state.entities)) {
    const props = e.props
    if (!props || (typeof props.slot !== 'string' && !w.onto.resolve(e.type).props.slot)) continue
    const n = (k: string) => (typeof props[k] === 'number' ? (props[k] as number) : 0)
    if (n('holdFast')) props.def = n('def') + Math.max(1, Math.round(n('holdFast') * 12))
    if (n('stealth')) props.dodge = Math.round((n('dodge') + 0.01 * n('stealth')) * 100) / 100
    if (n('perception')) props.luck = Math.round((n('luck') + 0.05) * 100) / 100
    for (const k of ['holdFast', 'stealth', 'perception']) delete props[k]
  }
  w.setFact(STATS_LAYOUT, true)
}
