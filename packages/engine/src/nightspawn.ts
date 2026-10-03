// The night (docs/quests.md): in a combat zone (MapData.zone, the default) under the open sky,
// zombies and bats come out after dark around the player — a few at a time, never in sight of
// where they appear (6 to 10 tiles off) — and at dawn they crumble away. Peaceful zones (towns,
// camps) stay quiet. Night-born creatures carry `props.nightborn`.

import { isNight } from './calendar.ts'
import type { Engine } from './engine.ts'

/** How many night-born walk a map at once, and how often (ticks) another may come. */
export const NIGHT_CAP = 4
export const NIGHT_EVERY = 60

const KINDS: [string, number][] = [
  ['actor/creature/undead/zombie', 0.6],
  ['actor/creature/beast/bat', 0.4],
]

export function nightTick(eng: Engine, active: string): void {
  const w = eng.world
  const map = w.map(active)
  if (!map) return
  const born = w.entitiesOnMap(active).filter((e) => e.place.on === 'tile' && e.props?.nightborn)
  if (!isNight(w.hour())) {
    // dawn: one crumbles at a time
    if (born.length && w.state.tick % 5 === 0) {
      const e = born[0]
      w.fx.push({ t: 'vfx', fx: 'poof', map: active, x: (e.place as { x: number }).x, y: (e.place as { y: number }).y })
      w.destroy(e)
    }
    return
  }
  if ((map.zone ?? 'combat') !== 'combat' || (map.light && map.light !== 'outdoor')) return
  if (w.state.tick % NIGHT_EVERY || born.length >= NIGHT_CAP) return
  const p = w.posOf(w.player)
  if (!p || p.map !== active) return
  let roll = w.rand()
  const type = KINDS.find(([, share]) => (roll -= share) < 0)?.[0] ?? KINDS[0][0]
  for (let i = 0; i < 20; i++) {
    const a = w.rand() * Math.PI * 2
    const r = 6 + w.rand() * 4
    const x = Math.round(p.x + Math.cos(a) * r)
    const y = Math.round(p.y + Math.sin(a) * r)
    if (!w.walkable(active, x, y) || w.entitiesAt(active, x, y).length) continue
    w.create(type, { on: 'tile', map: active, x, y }, { facing: 'down', props: { nightborn: true }, ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, leash: 14, home: { map: active, x, y } } })
    return
  }
}
