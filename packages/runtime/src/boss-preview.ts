import type { EntitySnap } from '@lsw/engine'
import { ALBERIC_CLIPS, ALBERIC_CLIP_FPS, albericFrameMs } from './assets/bosses.ts'

export type BossPreviewMode = 'live' | 'idle' | 'walk' | 'attack' | 'cast' | 'volley' | 'hurt' | 'death'

/** Shared by the visible controls and the snapshot-only animation preview. */
export function bossPreviewModes(kit: string): { value: BossPreviewMode; label: string }[] {
  const alberic = kit === 'alberic'
  const frames = (clip: keyof typeof ALBERIC_CLIPS, legacy = 4) =>
    alberic ? `${ALBERIC_CLIPS[clip].length} 帧 · ${ALBERIC_CLIP_FPS[clip]} FPS` : `${legacy} 帧`
  return [
    { value: 'live', label: '实战 · 完整循环' },
    { value: 'idle', label: `待机 · ${frames('idle')}` },
    { value: 'walk', label: `移动 · ${frames('walk')}` },
    { value: 'attack', label: `${alberic ? '荆冠·屈膝' : '攻击'} · ${frames('thorns')}` },
    { value: 'cast', label: `${alberic ? '征服之矢' : '施法'} · ${frames('arrow')}` },
    ...(alberic ? [{ value: 'volley' as const, label: `白羽箭雨 · ${frames('volley')}` }] : []),
    { value: 'hurt', label: `受击 · ${frames('hurt', 2)}` },
    { value: 'death', label: `${alberic ? '摘冠与倒下' : '死亡'} · ${frames('death', 2)}` },
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
  if (boss.kit === 'alberic') boss.skill = mode === 'volley' ? 'volley' : mode === 'cast' ? 'arrow' : 'thorns'
  const clip = mode === 'attack' ? 'thorns' : mode === 'cast' ? 'arrow' : mode
  const duration = boss.kit === 'alberic' ? ALBERIC_CLIPS[clip].length * albericFrameMs(clip) : 1800
  const elapsed = Math.max(0, elapsedMs)
  // A death preview stays on the fallen pose; clicking it again restarts from frame one.
  boss.progress = mode === 'death' ? Math.min(1, elapsed / duration) : elapsed % duration / duration
  if (boss.kit === 'alberic') {
    const cycle = mode === 'death' ? Math.min(elapsed, duration) : elapsed % duration
    boss.animationElapsedMs = boss.action === 'attack' || boss.action === 'cast' ? cycle % (duration / 2) : cycle
  }
  delete boss.warning
}
