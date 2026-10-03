// The people of the demo, one record per file in people/: the Ford's two (docs/game-design.md §5)
// and Emberfall's three (docs/main-quest.md).

import type { PersonDef } from './person.ts'
import { hesper } from './people/hesper.ts'
import { tobin } from './people/tobin.ts'
import { garrick } from './people/garrick.ts'
import { mara } from './people/mara.ts'
import { wren } from './people/wren.ts'
import { bram } from './people/bram.ts'
import { rowan } from './people/rowan.ts'
import { marta } from './people/marta.ts'
import { mia } from './people/mia.ts'
import { holt } from './people/holt.ts'
import { gus } from './people/gus.ts'
import { lina } from './people/lina.ts'
import { oskar } from './people/oskar.ts'

export const PEOPLE: PersonDef[] = [hesper, tobin, mara, garrick, wren, bram, rowan, marta, mia, holt, gus, lina, oskar]
