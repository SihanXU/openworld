import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchWindow } from '../src/ui/research.ts'

vi.mock('../src/game.ts', () => ({ game: () => ({ items: { forms: {} } }), ontology: () => ({ types: {} }) }))
vi.mock('../src/ui/common.ts', () => ({ locale: { value: 'en' }, tx: (t: unknown) => (typeof t === 'string' ? t : (t as { en?: string })?.en ?? '') }))

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
    const button = () => ({ disabled: false, hidden: false, textContent: '' })
    Object.assign(w, { input: button(), sendButton: button(), changeButton: button(), makeButton: button() })
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
    w.receive({ t: 'research', who: 'npc.garrick', reply: 'An iron axe, then.' })
    expect(announce).toHaveBeenCalledWith('npc.garrick', false)
    // answered: the next walk away ends the talk as before
    expect((w as unknown as { pending?: string }).pending).toBeUndefined()
    w.close()
    expect(cancel).toHaveBeenCalled()
    expect((w as unknown as { kept: Map<string, unknown> }).kept.get('npc.garrick')).toMatchObject({ reply: 'An iron axe, then.' })
  })

  it('a problem that comes after one walked away is said as one', () => {
    const { w, announce } = panel(false, true)
    w.receive({ t: 'research', who: 'npc.garrick', problem: 'unreachable' })
    expect(announce).toHaveBeenCalledWith('npc.garrick', true)
  })
})
