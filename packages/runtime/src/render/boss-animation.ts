import type { Dir, EntitySnap } from '@openworld/engine'
import { ALBERIC_CLIPS, albericFrameMs } from '../assets/bosses.ts'

/** Pure atlas selection: wind-up is [0,.5), release/recovery [.5,1], never an early shot. */
export function bossAnimationFrame(boss: NonNullable<EntitySnap['boss']>, time: number, offset = 0, facing: Dir = 'down'): { col: number; row: number } {
  const { action } = boss
  const progress = Math.max(0, Math.min(1, Number.isFinite(boss.progress) ? boss.progress : 0))
  if (boss.kit === 'alberic') {
    const row = action === 'idle' ? 0 : action === 'walk' ? 1 : action === 'hurt' ? 5 : action === 'death' ? 6
      : boss.skill === 'volley' ? 4 : action === 'cast' ? 3 : 2
    const id = action === 'idle' || action === 'walk' || action === 'hurt' || action === 'death'
      ? action : row === 4 ? 'volley' : row === 3 ? 'arrow' : 'thorns'
    const clip = ALBERIC_CLIPS[id]
    const frameMs = albericFrameMs(id)
    const elapsed = Number.isFinite(boss.animationElapsedMs) ? Math.max(0, boss.animationElapsedMs!) : undefined
    let pose: number
    if (action === 'idle' || action === 'walk') {
      // loops run on the screen's clock: the simulation's 10 Hz steps (and a lagging tick) would make them stutter
      pose = Math.floor(Math.max(0, time + offset) / frameMs) % clip.length
    } else if (action === 'attack' || action === 'cast') {
      // Play the anticipation at the clip's pace, then hold the drawn weapon until the engine
      // releases. Recovery starts at the actual hit, never by looping through a timer.
      const windingUp = !!boss.warning || progress < 0.5, half = clip.length / 2
      const step = elapsed === undefined ? Math.floor((windingUp ? progress : progress - 0.5) * clip.length)
        : Math.floor(elapsed / frameMs)
      pose = (windingUp ? 0 : half) + Math.min(half - 1, Math.max(0, step))
    } else {
      pose = Math.min(clip.length - 1, Math.floor(elapsed === undefined ? progress * clip.length : elapsed / frameMs))
    }
    const col = clip[pose]!
    // Three genuinely drawn overhead directions; left mirrors right, never the front/back.
    const direction = facing === 'up' ? 2 : facing === 'left' || facing === 'right' ? 1 : 0
    return { col, row: row + direction * 7 }
  }
  // Keep the previous 20-frame layouts, pacing and two-frame deaths intact.
  const row = action === 'idle' ? 0 : action === 'walk' ? 1 : action === 'attack' ? 2 : action === 'cast' ? 3 : 4
  const col = action === 'death' ? progress < 0.6 ? 2 : 3 : action === 'hurt' ? Math.floor(time / 100) % 2
    : action === 'idle' || action === 'walk' ? Math.floor((time + offset) / (action === 'walk' ? 150 : 260)) % 4
    : Math.min(3, Math.floor(progress * 4))
  return { col, row }
}

/** Advance the pose between 10 Hz snapshots, without predicting a hit or changing simulation.
 * A stopped/delayed simulation can extrapolate at most one tick. Telegraphs cannot enter
 * release poses until an authoritative snapshot actually removes the warning.
 */
export class BossAnimationClock {
  private sample?: { key: string; at: number; progress: number; rate: number; limit: number; elapsed?: number }

  receive(boss: NonNullable<EntitySnap['boss']>, time: number): void {
    const strike = boss.action === 'attack' || boss.action === 'cast'
    const pending = strike && (!!boss.warning || boss.progress < 0.5)
    const key = `${boss.kit}:${boss.action}:${strike ? boss.skill : ''}:${pending}`
    const progress = Math.max(0, Math.min(1, Number.isFinite(boss.progress) ? boss.progress : 0))
    const elapsed = Number.isFinite(boss.animationElapsedMs) ? Math.max(0, boss.animationElapsedMs!) : undefined
    const previous = this.sample
    // Repeated paused snapshots must not rewind the already-drawn in-between pose.
    if (previous?.key === key && previous.progress === progress && previous.elapsed === elapsed) return
    const rate = previous?.key === key && time > previous.at && progress > previous.progress
      ? (progress - previous.progress) / (time - previous.at) : 0
    this.sample = { key, progress, at: time, rate, limit: pending ? 0.5 - Number.EPSILON : 1, elapsed }
  }

  progress(time: number): number {
    const s = this.sample
    return s ? Math.min(s.limit, s.progress + s.rate * Math.max(0, Math.min(100, time - s.at))) : 0
  }

  elapsed(time: number): number | undefined {
    const s = this.sample
    // Authoritative phase time makes a 50 ms pose possible even inside the first tick.
    // As with progress, a stalled/paused simulation advances at most one extra tick.
    return s?.elapsed === undefined ? undefined : s.elapsed + Math.max(0, Math.min(100, time - s.at))
  }
}
