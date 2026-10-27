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
import { CASTLE } from './castle.ts'
import { HALL_SHELLS } from './halls.ts'
import { REGIONS } from './regions.ts'
import { WORKS } from './works.ts'
import { WILDS } from './wilds.ts'
import { FIRSTLIGHT_BUILDINGS } from './firstlight.ts'
import { CHAPTER1_BUILDINGS } from './chapter1.ts'
import { PILGRIMAGE_BUILDINGS, PILGRIMAGE_PROPS } from './pilgrimage.ts'
import { fountain, grandFountain } from '../kit.ts'

export const MODELS: Record<string, () => Model> = {
  abbey_church: abbeyChurch,
  ...CLOSE,
  ...FORT,
  ...CASTLE,
  ...HALL_SHELLS,
  ...REGIONS,
  ...WORKS,
  ...WILDS,
  ...FIRSTLIGHT_BUILDINGS,
  ...CHAPTER1_BUILDINGS,
  ...PILGRIMAGE_BUILDINGS,
  ...TOWN,
  ...MARKET,
  ...INSIDE,
  ...DECOR,
  town_fountain: () => fountain({ name: 'town_fountain' }),
  town_fountain_grand: () => grandFountain('town_fountain_grand'),
}

export const PROPS = { ...INSIDE_PROPS, ...STREET_PROPS, ...PILGRIMAGE_PROPS }
