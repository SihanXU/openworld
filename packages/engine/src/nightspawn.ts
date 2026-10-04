// The night (docs/quests.md): in a combat zone (MapData.zone, the default) under the open sky,
// zombies and bats come out after dark around the player — a few at a time, never in sight of
// where they appear (6 to 10 tiles off) — and at dawn they crumble away. Peaceful zones (towns,
// camps) stay quiet.
//
// It is the world's (design.md §5.13, A2): a clock of its own (the `night` period, content) whose
// rule makes them `appear`; the night-born carry the `nightborn` tag, and their own rule on the
// `dawn` period crumbles them in daylight.

import type { Engine } from './engine.ts'
import type { Effect } from './types.ts'

/** How many night-born walk a map at once, and how often (ticks) another may come. */
export const NIGHT_CAP = 4
export const NIGHT_EVERY = 60

/**
 * The world's `appear` primitive: one creature of a weighted type on a free tile `ring` tiles
 * from the player, on the active map when it lies under the open sky and is not peaceful, unless
 * `cap` of those tagged `tag` already walk it. It comes with its behaviour, at home where it
 * appears.
 */
export function appear(eng: Engine, eff: Extract<Effect, { op: 'appear' }>): void {
  const w = eng.world
  const active = eng.activeMap
  const map = w.map(active)
  if (!map || (map.zone ?? 'combat') !== 'combat' || (map.light && map.light !== 'outdoor')) return
  const p = w.posOf(w.player)
  if (!p || p.map !== active) return
  const born = w.entitiesOnMap(active).filter((e) => e.place.on === 'tile' && w.hasTag(e, eff.tag))
  if (born.length >= eff.cap) return
  const kinds = Object.entries(eff.types)
  const total = kinds.reduce((a, [, share]) => a + share, 0)
  let roll = w.rand() * total
  const type = kinds.find(([, share]) => (roll -= share) < 0)?.[0] ?? kinds[0]?.[0]
  if (!type || !w.onto.hasType(type)) return
  const [near, far] = eff.ring
  for (let i = 0; i < 20; i++) {
    const a = w.rand() * Math.PI * 2
    const r = near + w.rand() * (far - near)
    const x = Math.round(p.x + Math.cos(a) * r)
    const y = Math.round(p.y + Math.sin(a) * r)
    if (!w.walkable(active, x, y) || w.entitiesAt(active, x, y).length) continue
    const made = w.create(type, { on: 'tile', map: active, x, y }, { facing: 'down', tags: [eff.tag], ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, leash: 14, home: { map: active, x, y } } })
    eng.touch({ e: made.id })
    return
  }
}
