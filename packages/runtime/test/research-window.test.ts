import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchWindow, canAdoptWorkshop, canUseWorkshop, fitIcon, missingLine, workshopTrial, workshopUseState } from '../src/ui/research.ts'
import type { WorkshopView } from '../src/protocol.ts'

vi.mock('../src/game.ts', () => ({ game: () => ({ items: { forms: {} } }), ontology: () => ({ types: {} }) }))
vi.mock('../src/ui/common.ts', () => {
  const locale = { value: 'en' }
  return { locale, tx: (t: unknown) => (typeof t === 'string' ? t : ((t as Record<string, string> | undefined)?.[locale.value] ?? (t as { en?: string })?.en ?? '')) }
})

afterEach(() => vi.unstubAllGlobals())

const workshop = (more: Partial<WorkshopView> = {}): WorkshopView => ({
  id: 'jam', revision: 2, kind: 'item', title: { en: 'Berry jam', zh: '浆果果酱' },
  uses: [{ id: 'eat', label: 'Eat', target: 'Yourself', status: 'tested' }],
  ...more,
})

describe('a design is adopted after its own actual trial', () => {
  it('does not treat the model saying tested as an actual trial', () => {
    const view = workshop()
    expect(workshopTrial(view)).toBeUndefined()
    expect(workshopUseState(view, view.uses[0])).toBe('ready')
    expect(canAdoptWorkshop(view)).toBe(false)
  })

  it('invalidates the prior revision trial after a natural-language revision', () => {
    const view = workshop({ trial: { revision: 1, passed: true, checks: [{ id: 'eat', label: 'Eat', passed: true, observed: 'Food 10 → 13.' }] } })
    expect(workshopTrial(view)).toBeUndefined()
    expect(workshopUseState(view, view.uses[0])).toBe('ready')
    expect(canAdoptWorkshop(view)).toBe(false)
  })

  it('marks only the branch reproduced by a matching trial', () => {
    const view = workshop({
      uses: [
        { id: 'eat', label: 'Eat', target: 'Yourself', status: 'ready' },
        { id: 'throw', label: 'Throw', target: 'A nearby creature', status: 'pending' },
      ],
      trial: { revision: 2, passed: true, checks: [{ id: 'eat', label: 'Eat', passed: true, observed: 'One jar consumed; food 10 → 13.' }] },
    })
    expect(workshopUseState(view, view.uses[0])).toBe('tested')
    expect(workshopUseState(view, view.uses[1])).toBe('pending')
    expect(canAdoptWorkshop(view)).toBe(true)
    expect(canAdoptWorkshop({ ...view, adopted: true })).toBe(false)
  })

  it('keeps a failed trial actionable without enabling adoption', () => {
    const view = workshop({ trial: { revision: 2, passed: false, checks: [{ id: 'eat', label: 'Eat', passed: false, observed: 'The jar was not consumed.' }] } })
    expect(workshopUseState(view, view.uses[0])).toBe('failed')
    expect(canAdoptWorkshop(view)).toBe(false)
  })

  it('ignores a late trial view for an older draft of the same idea', () => {
    const view = workshop()
    const w = Object.assign(Object.create(ResearchWindow.prototype), { plan: view }) as ResearchWindow
    w.workshop(workshop({ revision: 1, trial: { revision: 1, passed: true, checks: [] } }))
    expect((w as unknown as { plan: WorkshopView }).plan).toBe(view)
  })

  it('offers an adopted use only after that exact branch was verified in this revision', () => {
    const view = workshop({ adopted: true, trial: { revision: 2, passed: true, checks: [{ id: 'eat', label: 'Eat', passed: true, observed: 'One jar consumed.' }] } })
    expect(canUseWorkshop(view, view.uses[0])).toBe(true)
    for (const status of ['pending', 'failed', 'ready'] as const)
      expect(canUseWorkshop(view, { ...view.uses[0], status })).toBe(false)
    expect(canUseWorkshop({ ...view, adopted: false }, view.uses[0])).toBe(false)
    expect(canUseWorkshop({ ...view, trial: { ...view.trial!, revision: 1 } }, view.uses[0])).toBe(false)
    expect(canUseWorkshop({ ...view, trial: { ...view.trial!, checks: [] } }, view.uses[0])).toBe(false)
  })
})

describe('idea book transfer and disabling remain worker decisions', () => {
  interface Node {
    children: Node[]
    dataset: Record<string, string>
    textContent: string
    hidden: boolean
    disabled: boolean
    onclick?: () => void
    append(...nodes: Node[]): void
    replaceChildren(...nodes: Node[]): void
  }
  const node = (): Node => ({
    children: [], dataset: {}, textContent: '', hidden: false, disabled: false,
    append(...nodes) { this.children.push(...nodes) },
    replaceChildren(...nodes) { this.children = [...nodes] },
    ...{ addEventListener: vi.fn(), setAttribute: vi.fn(), focus: vi.fn(), classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }, querySelectorAll: () => [] },
  })
  const descendants = (n: Node): Node[] => [n, ...n.children.flatMap(descendants)]

  it('dispatches exact package ids, offers transfer for adopted things and maps, and keeps rejected disable candidates visible', () => {
    const host = node()
    vi.stubGlobal('document', { createElement: node, querySelector: () => host })
    const send = vi.fn(), receive = vi.fn(), disable = vi.fn()
    const w = new ResearchWindow({
      ask: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), open: vi.fn(),
      export: send, import: receive, disable,
    })
    const views = [workshop({ adopted: true }), workshop({ id: 'garden', kind: 'map', adopted: true }), workshop({ id: 'unfinished', adopted: false })]
    w.saved(views)
    const parts = w as unknown as { importButton: Node; notebookList: Node; savedViews: WorkshopView[] }
    parts.importButton.onclick?.()
    expect(receive).toHaveBeenCalledTimes(1)
    const buttons = descendants(parts.notebookList)
    expect(buttons.filter(b => b.dataset.researchExport).map(b => b.dataset.researchExport)).toEqual(['jam', 'garden'])
    expect(buttons.filter(b => b.dataset.researchDisable).map(b => b.dataset.researchDisable)).toEqual(['jam', 'garden'])
    buttons.find(b => b.dataset.researchExport === 'garden')!.onclick?.()
    buttons.find(b => b.dataset.researchDisable === 'jam')!.onclick?.()
    expect(send).toHaveBeenCalledExactlyOnceWith('garden')
    expect(disable).toHaveBeenCalledExactlyOnceWith('jam')
    // No optimistic deletion: the worker can refuse because the package is still in use.
    expect(parts.savedViews).toEqual(views)
    expect(descendants(parts.notebookList).filter(b => b.dataset.researchSaved).map(b => b.dataset.researchSaved)).toEqual(['jam', 'garden', 'unfinished'])
  })
})

/** The panel's state alone, without its elements: open or not, thinking or not. */
function panel(open: boolean, pending: boolean) {
  const element = { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }, focus: vi.fn() }
  vi.stubGlobal('document', { getElementById: () => element, querySelector: () => element })
  const cancel = vi.fn()
  const w = Object.assign(Object.create(ResearchWindow.prototype), {
    root: { ...element, hidden: !open }, kept: new Map(), waiting: pending, pending: pending ? 'npc.garrick' : undefined, who: open ? 'npc.garrick' : undefined, actions: { ask: vi.fn(), confirm: vi.fn(), cancel },
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

  it('keeps a background order pending until its load offer arrives', () => {
    const { w, announce } = panel(false, true)
    w.receive({ t: 'research', who: 'npc.garrick', creatorProgress: 'running' })
    expect(announce).not.toHaveBeenCalled()
    expect((w as unknown as { pending?: string }).pending).toBe('npc.garrick')
    w.receive({ t: 'research', who: 'npc.garrick', creatorOffer: true, token: 'creator:garden' })
    expect(announce).toHaveBeenCalledExactlyOnceWith('npc.garrick', false)
    expect((w as unknown as { pending?: string }).pending).toBeUndefined()
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

describe('a prototype\'s icon as the artist is given it', () => {
  it('is never stretched: a narrow sprite keeps its shape, centred, and a tall one is scaled down whole', () => {
    expect(fitIcon(16, 16)).toEqual({ x: 0, y: 0, w: 16, h: 16 })
    expect(fitIcon(7, 14)).toEqual({ x: 4, y: 1, w: 7, h: 14 })
    // the spear (7x21): 5x16, not 16x16
    expect(fitIcon(7, 21)).toEqual({ x: 5, y: 0, w: 5, h: 16 })
    expect(fitIcon(32, 16)).toEqual({ x: 0, y: 4, w: 16, h: 8 })
  })
})

describe('what a trial lacks, said plainly', () => {
  it('names the goods, the tool to carry and the skill; nothing known, the general line', () => {
    expect(missingLine({ needs: [{ type: 'item/material/iron_ingot', count: 1 }], tools: ['hammer'] })).toBe('You still need: 1 iron ingot, a hammer to carry. Once you have everything, we try again.')
    expect(missingLine({})).toBeUndefined()
    expect(missingLine(undefined)).toBeUndefined()
  })
})
