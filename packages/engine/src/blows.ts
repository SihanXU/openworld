// What one fights with, and the kernel's plain combat (module.ts `Combat`): a blow is the striker's attack
// and its weapon's power, a step's pace its base slowed by its statuses. A combat module (classes) brings
// its own: talents, professions' weapons, criticals.

import type { Engine } from './engine.ts'
import type { Combat } from './module.ts'
import type { Entity } from './types.ts'
import type { World } from './world.ts'

/** The main hand: the `weapon` slot of what is worn, where a weapon is kept ready while the hand holds something else. */
export const MAINHAND = 'wear:weapon'

/** The off hand: the `arm` slot of what is worn (world-model.md §6.8), where a shield goes. */
export const OFFHAND = 'wear:arm'

/** Stardew's line between tools and objects: tools are used (and swung), objects are given, placed or eaten. */
const TOOL_PREFIXES = ['item/weapon/', 'item/tool/', 'item/light/', 'item/vessel/bucket/', 'item/vessel/flask/', 'item/vessel/waterskin/']
export const isTool = (type: string) => TOOL_PREFIXES.some((p) => type.startsWith(p))

/**
 * What one fights with: a weapon in one's hand, else the one worn in the main hand (`World.worn`: still carried, one's
 * own to wield), else a tool the hand holds (a torch swung) — never an object it happens to hold (what was just picked
 * up is not swung: the bare body strikes).
 */
export function weaponOf(w: World, e: Entity): Entity | undefined {
  const held = w.get(e.held)
  if (held && w.hasTag(held, 'weapon')) return held
  return w.worn(e).find((it) => w.prop(it, 'slot') === 'weapon') ?? (held && isTool(held.type) ? held : undefined)
}

/** What is worn in the off hand and works there (`World.worn`: still carried, and the wearer's to wield). */
export function offhandOf(w: World, e: Entity): Entity | undefined {
  return w.worn(e).find((item) => w.prop(item, 'slot') === 'arm')
}

export function plainCombat(eng: Engine): Combat {
  const w = eng.world
  return {
    refuses: () => undefined,
    reach: () => 0,
    delay(e, base, kind) {
      if (kind === 'move') for (const id of Object.keys(e.statuses ?? {})) base *= w.onto.status(id)?.moveDelay ?? 1
      return Math.max(1, base)
    },
    strike: (_a, _v, base) => ({ power: base }),
    struck: () => {},
    besides: () => [],
    damage: (_e, harm) => harm,
    lethal: (_e, hp) => hp,
    wounded: () => {},
    stepped: () => {},
  }
}
