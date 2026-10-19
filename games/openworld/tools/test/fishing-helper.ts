import { snapshot, type Engine, type FishingView } from '@openworld/engine'
import { fishingActive, fishingInput } from '@openworld/modules'

export type FishingOutcome =
  | { status: 'caught'; fishType: string }
  | { status: 'missed' | 'escaped' | 'no-session'; fishType?: string }

interface FishingOptions {
  /** Advance one game tick, including any story input the scenario needs. */
  tick?: () => void
  maxWaitTicks?: number
  maxFightTicks?: number
}

/** Complete one real fishing line using only the renderer's fish/bar projection and input edges. */
export function completeFishing(eng: Engine, options: FishingOptions = {}): FishingOutcome {
  const tick = options.tick ?? (() => eng.tick())
  const maxWaitTicks = options.maxWaitTicks ?? 40
  const maxFightTicks = options.maxFightTicks ?? 300
  let elapsed = 0
  let phase: FishingView['phase'] | undefined
  let fishType: string | undefined
  let fishCountBefore: number | undefined

  const advance = (where: string) => {
    const limit = maxWaitTicks + maxFightTicks + 2
    if (elapsed >= limit) {
      throw new Error(`Fishing timed out ${where} after ${elapsed} engine ticks (phase=${phase ?? 'none'}, active=${fishingActive(eng)})`)
    }
    tick()
    elapsed++
  }
  const ended = (): FishingOutcome => {
    if (fishType && fishCountBefore !== undefined && eng.controls.count(fishType) > fishCountBefore) {
      return { status: 'caught', fishType }
    }
    return phase === 'waiting'
      ? { status: 'missed', ...(fishType ? { fishType } : {}) }
      : { status: 'escaped', ...(fishType ? { fishType } : {}) }
  }

  if (!fishingActive(eng)) return { status: 'no-session' }

  let reachedBite = false
  for (let i = 0; i < maxWaitTicks; i++) {
    const view = snapshot(eng).fishing
    if (!fishingActive(eng)) return phase === 'waiting' ? ended() : { status: 'no-session' }
    if (!view) {
      throw new Error(`Fishing session has no view while waiting for a bite (active=true, tick=${elapsed})`)
    }
    phase = view.phase
    if (view.phase === 'bite') {
      reachedBite = true
      break
    }
    if (view.phase !== 'waiting') {
      throw new Error(`Fishing entered ${view.phase} before a bite (tick=${elapsed})`)
    }
    advance('waiting for a bite')
    if (!fishingActive(eng)) return ended()
  }
  if (!reachedBite) {
    const view = snapshot(eng).fishing
    throw new Error(`Fishing did not reach a bite within ${maxWaitTicks} ticks (phase=${view?.phase ?? 'none'}, active=${fishingActive(eng)})`)
  }

  fishingInput(eng, 'press')
  if (snapshot(eng).fishing?.phase === 'bite') advance('starting the fight')

  for (let i = 0; i < maxFightTicks; i++) {
    const view = snapshot(eng).fishing
    if (!fishingActive(eng)) return ended()
    if (!view) {
      // The engine hides the view while it dispatches the successful landing event.
      advance('settling the catch')
      if (!fishingActive(eng)) return ended()
      continue
    }
    phase = view.phase
    if (view.phase !== 'fight') {
      throw new Error(`Fishing returned to ${view.phase} after the bite (tick=${elapsed})`)
    }
    if (fishType === undefined && view.fishItem) {
      fishType = view.fishItem.type
      fishCountBefore = eng.controls.count(fishType)
    }
    fishingInput(eng, view.bar < view.fish ? 'press' : 'release')
    advance('controlling the fight')
    if (!fishingActive(eng)) return ended()
  }

  const view = snapshot(eng).fishing
  throw new Error(`Fishing fight did not end within ${maxFightTicks} ticks (phase=${view?.phase ?? 'none'}, progress=${view?.progress ?? 'hidden'}, fish=${fishType ?? 'unknown'})`)
}
