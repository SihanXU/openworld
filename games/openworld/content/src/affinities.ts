// What each minor kind makes of the elements (docs/creatures.md §15): its weaknesses and what it shrugs off, as the
// resistances the engine already reads (`res<Element>`, a share of a blow's harm: 100 none of it, below 0 more). They
// come from what a kind is, never from a list of kinds: its own element it is immune to, and each of its tags (inherited
// down the type tree) brings what that nature suffers or withstands. Of several, the strongest resistance and the worst
// weakness count, so a frost wolf is immune to ice and as weak to fire as any beast. After Pokémon's chart (a dragon
// fears the cold), Monster Hunter's weakness stars and Elin's resistances, kept to a few reads a player can learn by the
// look of a thing.

import type { TypeDef } from '@openworld/engine'
import { ELEMENTS } from './elements.ts'

type Affinity = Partial<Record<string, number>>

export const IMMUNE = 100
export const WEAK = -50

export const TAG_AFFINITY: Record<string, Affinity> = {
  fiery: { fire: IMMUNE, water: WEAK },
  icy: { ice: IMMUNE, fire: WEAK },
  charged: { lightning: IMMUNE, earth: WEAK },
  watery: { water: IMMUNE, lightning: WEAK },
  stone: { water: WEAK },
  construct: { lightning: 50 },
  flammable: { fire: WEAK },
  rotting: { fire: WEAK },
  robed: { fire: WEAK },
  bone: { earth: WEAK },
  spectral: { wind: WEAK },
  furry: { ice: 25 },
  dragon: { ice: WEAK },
}

const RES: Record<string, string> = { fire: 'resFire', water: 'resWater', ice: 'resIce', lightning: 'resLightning', wind: 'resWind', earth: 'resEarth' }

export function affinityOf(types: Record<string, TypeDef>, kind: string): Record<string, number> {
  const line = kind.split('/').map((_, i, parts) => types[parts.slice(0, i + 1).join('/')]).filter(Boolean)
  const element = line.map((t) => t.props?.element).filter((e) => typeof e === 'string').at(-1) as string | undefined
  const natures = [...new Set(line.flatMap((t) => t.tags ?? []))].map((t) => TAG_AFFINITY[t] ?? {})
  const sources: Affinity[] = element ? [{ [element]: IMMUNE }, ...natures] : natures
  const out: Record<string, number> = {}
  for (const e of ELEMENTS) {
    const values = sources.flatMap((s) => s[e] ?? [])
    const v = Math.max(0, ...values) + Math.min(0, ...values)
    if (v) out[RES[e]] = v
  }
  return out
}
