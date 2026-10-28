import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchWindow } from '../src/ui/research.ts'

vi.mock('../src/game.ts', () => ({ game: () => ({ items: { forms: {} } }), ontology: () => ({ types: {} }) }))
vi.mock('../src/ui/common.ts', () => {
  const locale = { value: 'en' }
  return { locale, tx: (t: unknown) => (typeof t === 'string' ? t : ((t as Record<string, string> | undefined)?.[locale.value] ?? (t as { en?: string })?.en ?? '')) }
})

afterEach(() => vi.unstubAllGlobals())

/** The panel's state alone, without its elements: open or not, thinking or not. */
function panel(open: boolean, pending: boolean) {
  const element = { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }, focus: vi.fn() }
  vi.stubGlobal('document', { getElementById: () => element, querySelector: () => element })
  const cancel = vi.fn()
  const w = Object.assign(Object.create(ResearchWindow.prototype), {
    root: { hidden: !open }, kept: new Map(), waiting: pending, pending: pending ? 'npc.garrick' : undefined, who: open ? 'npc.garrick' : undefined, actions: { ask: vi.fn(), confirm: vi.fn(), cancel },
  }) as ResearchWindow
  const announce = vi.fn()
  const changed = vi.fn()
  w.announce = announce
  w.changed = changed
  return { w, cancel, announce, changed }
}

describe('a craftsperson thinking holds no one up', () => {
  it('walking away while they think leaves the question asked: the world goes on, nothing is cancelled', () => {
    const { w, cancel, changed } = panel(true, true)
    expect(w.thinking).toBe(true)
    w.close()
    expect(cancel).not.toHaveBeenCalled()
    expect(w.thinking).toBe(false)
    // a paused world sends no frames: the window itself says the pause has to follow
    expect(changed).toHaveBeenCalled()
    // the talk ending closes the panel again (Back, then Goodbye): the question is still being thought over
    w.close()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('the thinking beginning or ending is said, so the pause follows it', () => {
    const { w, changed } = panel(true, false)
    ;(w as unknown as { pending?: string }).pending = 'npc.garrick'
    const button = () => ({ disabled: false, hidden: false, textContent: '', setAttribute: vi.fn() })
    Object.assign(w, { input: button(), sendButton: button(), changeButton: button(), makeButton: button(), backButton: button() })
    ;(w as unknown as { busy(v: boolean): void }).busy(true)
    expect(w.thinking).toBe(true)
    expect(changed).toHaveBeenCalledTimes(1)
    ;(w as unknown as { pending?: string }).pending = undefined
    ;(w as unknown as { busy(v: boolean): void }).busy(false)
    expect(w.thinking).toBe(false)
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('walking away when nothing is being thought over ends the talk as before', () => {
    const { w, cancel } = panel(true, false)
    w.close()
    expect(cancel).toHaveBeenCalled()
  })

  it('an answer that comes after one walked away is kept for that craftsperson and said on the message line', () => {
    const { w, announce, cancel } = panel(false, true)
    w.receive({ t: 'research', who: 'npc.garrick', reply: { en: 'An iron axe, then.', zh: 'An iron axe, then.' } })
    expect(announce).toHaveBeenCalledWith('npc.garrick', false)
    // answered: the next walk away ends the talk as before
    expect((w as unknown as { pending?: string }).pending).toBeUndefined()
    w.close()
    expect(cancel).toHaveBeenCalled()
    expect((w as unknown as { kept: Map<string, unknown> }).kept.get('npc.garrick')).toMatchObject({ reply: { en: 'An iron axe, then.', zh: 'An iron axe, then.' } })
  })

  it('a problem that comes after one walked away is said as one', () => {
    const { w, announce } = panel(false, true)
    w.receive({ t: 'research', who: 'npc.garrick', problem: 'unreachable' })
    expect(announce).toHaveBeenCalledWith('npc.garrick', true)
  })

  it('a reply is said again in the other language when the language is switched', async () => {
    const { locale } = (await import('../src/ui/common.ts')) as unknown as { locale: { value: string } }
    const { w } = panel(true, false)
    const el = () => ({ disabled: false, hidden: false, textContent: '', setAttribute: vi.fn(), replaceChildren: vi.fn(), focus: vi.fn(), classList: { toggle: vi.fn() } })
    const parts = { input: el(), sendButton: el(), changeButton: el(), makeButton: el(), backButton: el(), line: el(), card: el(), composer: el() }
    Object.assign(w, parts)
    w.receive({ t: 'research', who: 'npc.garrick', reply: { en: 'An iron axe, then.', zh: '那就打一把铁斧。' } })
    expect(parts.line.textContent).toBe('An iron axe, then.')
    locale.value = 'zh'
    w.relabel()
    expect(parts.line.textContent).toBe('那就打一把铁斧。')
    expect(parts.backButton.textContent).toBe('先聊别的')
    locale.value = 'en'
  })

  it('a draft whose picture is still being sketched is shown, and tried only once it is drawn', () => {
    const { w } = panel(true, false)
    const el = () => ({ disabled: false, hidden: false, textContent: '', setAttribute: vi.fn(), replaceChildren: vi.fn(), focus: vi.fn(), classList: { toggle: vi.fn() } })
    const parts = { input: el(), sendButton: el(), changeButton: el(), makeButton: el(), backButton: el(), line: el(), card: el(), composer: el() }
    Object.assign(w, parts)
    const shown: unknown[] = []
    Object.assign(w, { preview: (d: unknown) => shown.push(d) })
    const design = { name: { en: 'Stone Axe', zh: '石斧' }, prototype: 'item/tool/axe', ingredients: [{ type: 'item/material/stone', count: 3 }] }
    w.receive({ t: 'research', who: 'npc.garrick', reply: { en: 'A stone axe.', zh: '石斧。' }, design, token: 't1', sketching: true })
    expect(parts.makeButton.disabled).toBe(true)
    expect(parts.makeButton.textContent).toBe('Sketching…')
    // (another draft's picture changes nothing)
    w.sketched({ t: 'researchSketched', who: 'npc.garrick', token: 't0', design })
    expect(parts.makeButton.disabled).toBe(true)
    const drawn = { ...design, art: { grid: [], palette: {} } }
    w.sketched({ t: 'researchSketched', who: 'npc.garrick', token: 't1', design: drawn })
    expect(parts.makeButton.disabled).toBe(false)
    expect(parts.makeButton.textContent).toBe('Try making it')
    expect(shown.at(-1)).toBe(drawn)
    expect(parts.line.textContent).toBe('A stone axe.')
  })

  it('a picture drawn after one walked away is kept with the reply', () => {
    const { w } = panel(false, true)
    const design = { name: { en: 'Stone Axe', zh: '石斧' }, prototype: 'item/tool/axe', ingredients: [{ type: 'item/material/stone', count: 3 }] }
    w.receive({ t: 'research', who: 'npc.garrick', reply: { en: 'A stone axe.', zh: '石斧。' }, design, token: 't1', sketching: true })
    const drawn = { ...design, art: { grid: [], palette: {} } }
    w.sketched({ t: 'researchSketched', who: 'npc.garrick', token: 't1', design: drawn })
    expect((w as unknown as { kept: Map<string, unknown> }).kept.get('npc.garrick')).toMatchObject({ design: drawn, sketching: false })
  })
})
