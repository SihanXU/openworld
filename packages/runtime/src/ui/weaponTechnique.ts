import type { WeaponMode } from '@openworld/engine'
import { $, locale, relabelKeys } from './common.ts'

const LABELS: Record<WeaponMode, readonly [string, string]> = {
  pierce: ['Pierce', '穿刺'],
  wave: ['Sword wave', '剑气'],
  beam: ['Beam', '光束'],
}

export class WeaponTechniqueHud {
  private root = document.createElement('div')
  private buttons = new Map<WeaponMode, HTMLButtonElement>()

  constructor(choose: (mode: WeaponMode) => void) {
    this.root.id = 'weapon-technique'
    this.root.hidden = true
    this.root.setAttribute('role', 'group')
    for (const mode of ['pierce', 'wave', 'beam'] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.mode = mode
      button.setAttribute('aria-pressed', 'false')
      button.onclick = () => choose(mode)
      this.root.append(button)
      this.buttons.set(mode, button)
    }
    for (const action of ['weaponMode', 'weaponBeam']) {
      const key = document.createElement('kbd')
      key.dataset.kbd = action
      this.root.append(key)
    }
    $('#hud').append(this.root)
    this.relabel()
  }

  relabel(): void {
    const zh = locale.value === 'zh'
    this.root.setAttribute('aria-label', zh ? '武器技法' : 'Weapon techniques')
    for (const [mode, button] of this.buttons) {
      const label = LABELS[mode][Number(zh)]
      button.textContent = label
      button.title = zh ? `${label} · 按住左键攻击` : `${label} · Hold left click to attack`
    }
    relabelKeys(this.root)
  }

  render(mode?: WeaponMode): void {
    this.root.hidden = !mode
    if (mode === this.root.dataset.mode) return
    this.root.dataset.mode = mode ?? ''
    for (const [key, button] of this.buttons) button.setAttribute('aria-pressed', String(key === mode))
  }
}
