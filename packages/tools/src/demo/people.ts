// The twelve people of Hearthvale (docs/game-design.md §5), one record per file in people/.

import type { PersonDef } from './person.ts'
import { brann } from './people/brann.ts'
import { fenn } from './people/fenn.ts'
import { garrick } from './people/garrick.ts'
import { hollis } from './people/hollis.ts'
import { lio } from './people/lio.ts'
import { maren } from './people/maren.ts'
import { mira } from './people/mira.ts'
import { oda } from './people/oda.ts'
import { pip } from './people/pip.ts'
import { sera } from './people/sera.ts'
import { tamsin } from './people/tamsin.ts'
import { wren } from './people/wren.ts'

export const PEOPLE: PersonDef[] = [maren, mira, lio, tamsin, wren, pip, brann, oda, hollis, sera, garrick, fenn]
