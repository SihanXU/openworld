// Where the society module keeps its systems: on the world (World.ext), so its conditions reach them too.

import type { Engine, World } from '@openworld/engine'
import type { Conduct } from './conduct.ts'
import type { Social } from './social.ts'

export const socialIn = (w: World): Social | undefined => w.ext.get('society.social') as Social | undefined
export const socialOf = (eng: Engine): Social => socialIn(eng.world)!
export const conductOf = (eng: Engine): Conduct => eng.world.ext.get('society.conduct') as Conduct
