import type { Dir, EntitySnap } from '@openworld/engine'
import { ALBERIC_CLIPS, type AlbericClip, type AlbericAttackClip, type AlbericWalkClip } from '../assets/bosses.ts'

export interface BossAnimationFrame {
  col: number
  row: number
  /** A delivered strip, when the boss has separate animation textures. */
  clip?: AlbericClip
  /** Already drawn left-facing strips and asymmetric frontal poses must not be mirrored again. */
  flipX?: boolean
}

export const albericAttackClip = (facing: Dir): AlbericAttackClip =>
  facing === 'left' ? 'attack_left' : facing === 'right' ? 'attack_right' : 'attack_down'

export const albericWalkClip = (facing: Dir): AlbericWalkClip =>
  facing === 'left' ? 'walk_left' : facing === 'right' ? 'walk_right' : facing === 'up' ? 'walk_up' : 'walk_down'

/** Pure atlas selection: wind-up is [0,.5), release/recovery [.5,1], never an early shot. */
export function bossAnimationFrame(boss: NonNullable<EntitySnap['boss']>, time: number, offset = 0, facing: Dir = 'down'): BossAnimationFrame {
  const { action } = boss
  const progress = Math.max(0, Math.min(1, Number.isFinite(boss.progress) ? boss.progress : 0))
  if (boss.kit === 'alberic') {
    const elapsed = Number.isFinite(boss.animationElapsedMs) ? Math.max(0, boss.animationElapsedMs!) : undefined
    if (action === 'idle' || action === 'walk') {
      // Delivered strips already face each direction (left included), so they are never mirrored.
      // Loops run on the screen's clock, independently of the simulation's 10 Hz snapshots.
      const clipName = action === 'walk' ? albericWalkClip(facing) : 'idle'
      const clip = ALBERIC_CLIPS[clipName]
      return { col: Math.floor(Math.max(0, time + offset) / clip.frame_ms) % clip.frames, row: 0, clip: clipName, flipX: false }
    }
    if (action === 'attack' || action === 'cast') {
      const id = albericAttackClip(facing), clip = ALBERIC_CLIPS[id]
      // Hold the last anticipation pose until the engine releases. The hit pose starts on
      // that authoritative release; a longer telegraph never plays an early strike.
      const windingUp = !!boss.warning || progress < 0.5
      const start = windingUp ? 0 : clip.hit_frame
      const count = windingUp ? clip.hit_frame : clip.frames - clip.hit_frame
      const phase = windingUp ? progress * 2 : (progress - 0.5) * 2
      const step = elapsed === undefined ? Math.floor(phase * count) : Math.floor(elapsed / clip.frame_ms)
      return { col: start + Math.min(count - 1, Math.max(0, step)), row: 0, clip: id, flipX: false }
    }
    // No hurt/death sheet was delivered. Keep one registered pose while the existing hit
    // tint and despawn fade communicate those states, without switching character designs.
    return { col: 0, row: 0, clip: 'idle', flipX: false }
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
