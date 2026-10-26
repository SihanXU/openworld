// Every building the oblique renderer draws, by the name the catalogue and the maps know it by; and the furniture it
// draws whole, as fixtures' pictures.

import type { Model } from '../oblique.ts'
import { abbeyChurch } from './abbey.ts'
import { CLOSE } from './close.ts'
import { FORT } from './fort.ts'
import { TOWN } from './town.ts'
import { MARKET } from './market.ts'
import { INSIDE, PROPS as INSIDE_PROPS } from './inside.ts'
import { STREET_PROPS } from './street.ts'
import { DECOR } from './decor.ts'
import { fountain, grandFountain } from '../kit.ts'

export const MODELS: Record<string, () => Model> = {
  abbey_church: abbeyChurch,
  ...CLOSE,
  ...FORT,
  ...TOWN,
  ...MARKET,
  ...INSIDE,
  ...DECOR,
  town_fountain: () => fountain({ name: 'town_fountain' }),
  town_fountain_grand: () => grandFountain('town_fountain_grand'),
}

export const PROPS = { ...INSIDE_PROPS, ...STREET_PROPS }
