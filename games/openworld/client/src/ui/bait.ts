import { mountWindow } from '@openworld/runtime/src/ui/components/index.ts'
/// <reference types="vite/client" />

import type { Frame, ItemInfo } from '@openworld/engine'
import { stackKey } from '@openworld/engine'
import { esc, locale, tx } from '@openworld/runtime/src/ui/common.ts'
import type { GamePanel, PanelContext } from '@openworld/runtime/src/ui/panels.ts'
import css from './bait.css?inline'
import { useStyle } from './style.ts'

const BAIT = 'item/misc/bait'

type Choice = { item: ItemInfo; count: number; key: string; casts: number }

class BaitPanel implements GamePanel {
  private rod?: string
  private selected = ''
  private sig = ''
  private pending = false

  constructor(private ctx: PanelContext) {
    useStyle('bait', css)
  }

  show(f: Frame | undefined, opened: { by?: string }): void | false {
    const rod = f?.player.held
    if (!rod || !opened.by || rod.id !== opened.by || !rod.tags.includes('tool:fishing')) return false
    this.rod = rod.id
    this.pending = false
    this.selected = ''
    this.sig = ''
    this.render(f!)
  }

  render(f: Frame): void {
    const rod = f.player.held
    if (!rod || rod.id !== this.rod || !rod.tags.includes('tool:fishing')) return this.ctx.close()
    const choices = new Map<string, Choice>()
    for (const slot of f.player.slots) {
      if (!slot || !slot.item.tags.includes('bait')) continue
      const key = slot.item.stackKey ?? stackKey(slot.item)
      const choice = choices.get(key)
      if (choice) choice.count += slot.count
      else choices.set(key, { item: slot.item, count: slot.count, key, casts: Math.max(0, Math.floor(Number(slot.item.props.casts) || 0)) })
    }
    const options = [...choices.values()]
    if (this.selected && !options.some((c) => c.item.id === this.selected)) this.selected = ''
    if (options.length === 1 && !this.selected) this.selected = options[0].item.id
    const remaining = Math.max(0, Math.floor(Number(rod.props.bait) || 0))
    const loadedKey = typeof rod.props.baitKey === 'string' ? rod.props.baitKey : remaining > 0 ? stackKey({ type: BAIT }) : ''
    const sig = JSON.stringify([locale.value, this.rod, remaining, loadedKey, this.pending, this.selected, options.map((c) => [c.item.id, c.key, c.count, c.casts, c.item.name, c.item.tags])])
    if (sig === this.sig) return
    this.sig = sig
    const zh = locale.value === 'zh'
    const rows = options.map((c) => {
      const locked = remaining > 0 && c.key !== loadedKey
      const selected = c.item.id === this.selected
      return `<button class="bait-choice${selected ? ' selected' : ''}${locked ? ' locked' : ''}" data-bait="${esc(c.item.id)}" ${locked ? 'disabled' : ''} aria-pressed="${selected}">
        <span class="icon" data-icon="${esc(c.item.id)}"></span><span class="bait-copy"><b>${esc(tx(c.item.name))}</b><small>+${c.casts} ${zh ? '次抛竿' : `casts`} · ${zh ? '持有' : 'carried'} ${c.count}</small>${locked ? `<small>${zh ? `先用完当前鱼饵（还剩 ${remaining} 次）` : `Use the current bait first (${remaining} casts left)`}</small>` : ''}</span>
      </button>`
    }).join('')
    this.ctx.host.innerHTML = `<section class="sheet wood bait-sheet" role="dialog" aria-modal="true" aria-labelledby="bait-title">
      <header><b id="bait-title">${zh ? '选择鱼饵' : 'Choose bait'}</b><button class="x" data-close aria-label="${zh ? '关闭' : 'Close'}">✕</button></header>
      <p class="bait-intro">${remaining ? (zh ? `鱼竿还可挂饵抛竿 ${remaining} 次；用完后才能换其他鱼饵。` : `This rod has ${remaining} baited casts left. Spend them before changing bait.`) : (zh ? '选一份鱼饵挂到手里的鱼竿上。确认后会消耗一份，并增加该鱼饵标注的抛竿次数。' : 'Choose bait for the rod in your hand. Confirming spends one and adds the casts shown for that bait.')}</p>
      <div class="bait-options">${rows || `<p class="bait-empty">${zh ? '行囊里没有鱼饵。' : 'There is no bait in your pack.'}</p>`}</div>
      <footer><button class="bait-cancel" data-close>${zh ? '取消' : 'Cancel'}</button><button class="bait-confirm primary" data-confirm ${!this.selected || this.pending || !options.some((c) => c.item.id === this.selected && !(remaining > 0 && c.key !== loadedKey)) ? 'disabled' : ''}>${zh ? '确认装饵' : 'Confirm bait'}</button></footer>
    </section>`
    mountWindow(this.ctx.host.querySelector<HTMLElement>('.sheet')!, { onClose: () => this.ctx.close() })
    this.ctx.paint(options.map((c) => c.item))
    this.ctx.host.querySelectorAll<HTMLElement>('[data-bait]').forEach((button) => {
      button.onclick = () => {
        this.selected = button.dataset.bait ?? ''
        this.sig = ''
        this.render(f)
      }
    })
    this.ctx.host.querySelectorAll<HTMLElement>('[data-close]').forEach((button) => (button.onclick = () => this.ctx.close()))
    this.ctx.host.querySelector<HTMLElement>('[data-confirm]')?.addEventListener('click', () => {
      const choice = options.find((c) => c.item.id === this.selected)
      if (!choice || this.pending || (remaining > 0 && choice.key !== loadedKey) || !this.rod) return
      this.pending = true
      this.ctx.send.useItemOnHeldItem(choice.item.id, this.rod)
      this.ctx.close()
    })
  }
}

export const baitPanel = (ctx: PanelContext): GamePanel => new BaitPanel(ctx)
