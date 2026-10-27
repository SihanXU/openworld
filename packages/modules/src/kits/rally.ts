// A boss made whole again (docs/boss-rooms.md §3): told the one it fought has fallen and gone (a rule of its own answers
// the impulse), it answers with `rally` — its health whole, its encounter's memory begun again (phase one, its openings
// to come), its wind-up dropped, and home to its post. It writes only its host.

import type { EffectRunner, GameEvent } from '@openworld/engine'
import { kitsOf } from './cast.ts'

export function rally(fx: EffectRunner, _eff: object, ev: GameEvent): void {
  const eng = fx.eng, w = eng.world
  const e = fx.hostEntity(ev)
  if (!e || e.place.on !== 'tile' || w.num(e, 'hp') <= 0) return
  kitsOf(eng).pending.delete(e.id)
  w.setProp(e, 'hp', w.num(e, 'maxHp', 1))
  e.boss = { phase: 1, action: 'idle' }
  const home = e.ai?.home
  const at = w.posOf(e)!
  if (home && (home.x !== at.x || home.y !== at.y) && w.fits(e, at.map, home.x, home.y)) eng.teleport(e, { map: at.map, x: home.x, y: home.y, z: at.z })
}
