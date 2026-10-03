/// <reference types="vite/client" />

// Original, full-colour illustrated pixel art only. Every skill has a distinct PNG;
// no generic SVG glyphs are substituted, even when an image fails to load.

export const SKILL_ART_KEYS = [
  'origin', 'sword', 'shield', 'hammer', 'sweep', 'heart', 'drumstick', 'hardy', 'renew',
  'magnet', 'axe', 'pack', 'flame', 'swift', 'farming', 'ranching', 'smithing',
  'assassin', 'dagger', 'critical', 'shadow', 'combo',
  'quick-hands', 'battle-tempo', 'evasive-step', 'pursuit', 'windrunner',
  'executioner', 'deadly-focus', 'defiance', 'last-stand', 'blade-mastery',
  'shadow-recovery', 'death-dance',
] as const

const known = new Set<string>(SKILL_ART_KEYS)
const artKey = (key: string | undefined): string => key && known.has(key) ? key : 'origin'

export const skillPng = (key: string): string => `${import.meta.env.BASE_URL}assets/lsw/skills/${artKey(key)}.png`

export const skillArt = (key: string | undefined): string => {
  const icon = artKey(key)
  return `<span class="sk-art"><img class="sk-png" data-icon="${icon}" src="${skillPng(icon)}" alt="" draggable="false"></span>`
}

/** A failed request gets our illustrated origin emblem, never a line-art version. */
export function bindSkillArt(host: ParentNode): void {
  host.querySelectorAll<HTMLImageElement>('img.sk-png').forEach((img) => {
    img.onerror = () => {
      if (img.dataset.icon !== 'origin' && img.dataset.fallback !== 'origin') {
        img.dataset.fallback = 'origin'
        img.src = skillPng('origin')
      } else img.hidden = true
    }
  })
}
