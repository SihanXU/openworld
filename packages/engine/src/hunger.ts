// Hunger (Minecraft's food bar): an actor with `maxHunger` grows hungrier over time; food
// restores it (the `feed` primitive, which the eating rule uses). Well fed (90 % and up), it
// slowly heals; starving (0), it slowly loses health, but starvation alone never takes the last
// point (Minecraft's normal difficulty). Any actor carrying `maxHunger` is subject to it.

import type { Engine } from './engine.ts'
import type { Entity } from './types.ts'

/** One point of hunger every 300 ticks: a full bar (20) lasts ten game hours, ten minutes of play. */
export const HUNGER_EVERY = 300
/** Healing when well fed, and harm when starving, every this many ticks. */
export const HUNGER_EFFECT_EVERY = 80

export function hungerTick(eng: Engine, active: string): void {
  const w = eng.world
  const t = w.state.tick
  const effect = t % HUNGER_EFFECT_EVERY === 0
  for (const e of w.entitiesOnMap(active)) {
    if (e.place.on !== 'tile' || w.kindOf(e) !== 'actor') continue
    const max = w.num(e, 'maxHunger')
    if (max <= 0 || w.hasStatus({ e: e.id }, 'down')) continue
    // an iron stomach (the skill) slows the drain: `hungerEvery` ticks a point
    const drain = t % Math.max(1, w.num(e, 'hungerEvery', HUNGER_EVERY)) === 0
    if (!drain && !effect) continue
    let hunger = w.num(e, 'hunger', max)
    if (drain) hunger = setHunger(e, hunger - 1, max)
    if (!effect) continue
    const hp = w.num(e, 'hp')
    // second wind (the skill): healing starts at half a bar
    // Second Wind heals from half a bar, Regeneration from a quarter
    const wellFed = w.hasTag(e, 'skill:regeneration') ? 0.25 : w.hasTag(e, 'skill:second-wind') ? 0.5 : 0.9
    if (hunger >= max * wellFed && hp < w.num(e, 'maxHp', 1)) {
      ;(e.props ??= {}).hp = hp + 1
      w.fx.push({ t: 'damage', who: e.id, amount: -1 })
    } else if (hunger <= 0 && hp > 1) eng.damage(e, 1, undefined, true)
  }
}

/** Set an actor's hunger within [0, max]; returns the new value. */
export function setHunger(e: Entity, value: number, max: number): number {
  const v = Math.max(0, Math.min(max, Math.round(value)))
  ;(e.props ??= {}).hunger = v
  return v
}
