import type { EntitySnap } from '@openworld/engine'
import { ALBERIC_CLIPS } from './assets/bosses.ts'
import { albericAttackClip, albericWalkClip } from './render/boss-animation.ts'

export type BossPreviewMode = 'live' | 'idle' | 'walk' | 'attack' | 'cast' | 'volley' | 'hurt' | 'death'

/** Shared by the visible controls and the snapshot-only animation preview. */
export function bossPreviewModes(kit: string): { value: BossPreviewMode; label: string }[] {
  if (kit === 'alberic') {
    const idle = ALBERIC_CLIPS.idle, walk = ALBERIC_CLIPS.walk_down, attack = ALBERIC_CLIPS.attack_down
    const idleTiming = `${idle.frames} 帧 · ${idle.frame_ms} ms/帧`
    const walkTiming = `四向 ${walk.frames} 帧 · ${walk.frame_ms} ms/帧`
    const attackTiming = `${attack.frames} 帧 · ${attack.frame_ms} ms/帧`
    return [
      { value: 'live', label: '实战 · 完整循环' },
      { value: 'idle', label: `待机 · ${idleTiming}` },
      { value: 'walk', label: `移动 · ${walkTiming}` },
      { value: 'attack', label: `攻击 · ${attackTiming}` },
      { value: 'cast', label: `征服之矢 · 借用攻击 ${attackTiming}` },
      { value: 'volley', label: `白羽箭雨 · 借用攻击 ${attackTiming}` },
      { value: 'hurt', label: '受击 · 待机静帧回退' },
      { value: 'death', label: '死亡 · 待机静帧回退' },
    ]
  }
  return [
    { value: 'live', label: '实战 · 完整循环' },
    { value: 'idle', label: '待机 · 4 帧' },
    { value: 'walk', label: '移动 · 4 帧' },
    { value: 'attack', label: '攻击 · 4 帧' },
    { value: 'cast', label: '施法 · 4 帧' },
    { value: 'hurt', label: '受击 · 2 帧' },
    { value: 'death', label: '死亡 · 2 帧' },
  ]
}

export function bossPreviewMode(value: string, kit: string): BossPreviewMode {
  return bossPreviewModes(kit).find((m) => m.value === value)?.value ?? 'live'
}

/** Mutate only a fresh render snapshot, never the actual boss or saved encounter. */
export function previewBoss(entity: EntitySnap | undefined, mode: BossPreviewMode, elapsedMs: number): void {
  const boss = entity?.boss
  if (!boss || mode === 'live') return
  boss.action = mode === 'volley' ? 'cast' : mode
  if (boss.kit === 'alberic') boss.skill = boss.clip = mode === 'volley' ? 'volley' : mode === 'cast' ? 'arrow' : 'thorns'
  const elapsed = Math.max(0, elapsedMs)
  if (boss.kit === 'alberic') {
    const strike = boss.action === 'attack' || boss.action === 'cast'
    const clip = strike ? ALBERIC_CLIPS[albericAttackClip(entity!.facing)]
      : mode === 'walk' ? ALBERIC_CLIPS[albericWalkClip(entity!.facing)] : ALBERIC_CLIPS.idle
    const duration = clip.frames * clip.frame_ms
    const cycle = mode === 'death' ? Math.min(elapsed, duration) : elapsed % duration
    if (strike && 'hit_frame' in clip) {
      // The engine encodes anticipation and recovery in separate progress halves. A preview
      // maps the actual delivered hit boundary into those halves, even for unequal segments.
      const hitAt = clip.hit_frame * clip.frame_ms
      boss.progress = cycle < hitAt ? cycle / hitAt / 2 : 0.5 + (cycle - hitAt) / (duration - hitAt) / 2
      boss.animationElapsedMs = cycle < hitAt ? cycle : cycle - hitAt
    } else {
      boss.progress = cycle / duration
      boss.animationElapsedMs = cycle
    }
    delete boss.warning
    return
  }
  // A death preview stays on the fallen pose; clicking it again restarts from frame one.
  const duration = 1800
  boss.progress = mode === 'death' ? Math.min(1, elapsed / duration) : elapsed % duration / duration
  delete boss.warning
}
