// The world's clock for a host with no page: the engine ticked at the game's pace, an opening scene read to its end
// because nobody is at the primary seat. A page does both itself.

import { TICKS_PER_SECOND, type Engine } from '@openworld/engine'

const STEP_MS = 1000 / TICKS_PER_SECOND
const POLL_MS = 20
const MAX_CATCH_UP = 20
const RESET_AFTER_MS = 1000

export interface Clock {
  stop(): void
}

export function runClock(eng: Engine, after: () => void = () => {}): Clock {
  let next = Date.now()
  const timer = setInterval(() => {
    for (let n = 0; Date.now() >= next && n < MAX_CATCH_UP; n++) {
      next += STEP_MS
      if (eng.world.scene?.waiting === 'advance') eng.story.advance()
      eng.tick()
      after()
    }
    if (Date.now() - next > RESET_AFTER_MS) next = Date.now()
  }, POLL_MS)
  return { stop: () => clearInterval(timer) }
}
