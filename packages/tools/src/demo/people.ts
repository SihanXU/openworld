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
import { ilse } from './people/ilse.ts'
import { joss } from './people/joss.ts'
import { pell } from './people/pell.ts'
import { brin } from './people/brin.ts'
import { alberic } from './people/alberic.ts'
import { tam } from './people/tam.ts'
import { nessa } from './people/nessa.ts'
import { fennick } from './people/fennick.ts'
import { edda } from './people/edda.ts'
import { severin } from './people/severin.ts'
import { courier } from './people/courier.ts'

// Chapter 1's (docs/chapter-1.md): the village's six, and the two the scenes bring on
export const PEOPLE: PersonDef[] = [hesper, tobin, mara, garrick, wren, bram, rowan, marta, mia, holt, gus, lina, oskar, ilse, joss, pell, nessa, fennick, edda, brin, tam, alberic, severin, courier]
