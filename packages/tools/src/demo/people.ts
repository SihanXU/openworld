// The two people of the Ford (docs/game-design.md §5), one record per file in people/.

import type { PersonDef } from './person.ts'
import { hesper } from './people/hesper.ts'
import { tobin } from './people/tobin.ts'

export const PEOPLE: PersonDef[] = [hesper, tobin]
