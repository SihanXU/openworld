// Asking a service until it answers: one that is not up yet (started after the page, or starting
// again) is asked again after a while, each while twice the last up to a cap, and the asking stops
// once it answers or is called off.

/**
 * Try `attempt` now and, while it fails, again after `ms`, then twice as long each time up to `max`; `stop()` calls off
 * the tries still to come. A try under way when it is called off learns it from `live()` (it acts on nothing then).
 */
export function untilUp(attempt: (live: () => boolean) => Promise<boolean>, ms: number, max = ms): { stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let wait = ms
  const go = async (): Promise<void> => {
    if (stopped || (await attempt(() => !stopped)) || stopped) return
    timer = setTimeout(() => void go(), wait)
    wait = Math.min(max, wait * 2)
  }
  void go()
  return {
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  }
}
