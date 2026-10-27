import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cover, type CoverHandlers } from '../src/ui/cover.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))
vi.mock('../src/game.ts', () => ({
  game: () => ({ cover: { scenes: [{ map: 'village', x: 1, y: 1 }, { map: 'castle', x: 1, y: 1 }] } }),
  assetsBase: () => '',
  gameIfAny: () => undefined,
}))

function cover() {
  const element = { classList: { contains: () => false, add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }, querySelectorAll: () => [], querySelector: () => ({ textContent: '' }) }
  vi.stubGlobal('document', { querySelector: () => element })
  const on = { backdrop: vi.fn() }
  // Exercise the title's lifecycle without rendering the unrelated menu and character creator.
  const c = Object.assign(Object.create(Cover.prototype), {
    on: on as unknown as CoverHandlers, drawn: false, lit: false, loading: false, booting: false, scene: 0,
  }) as Cover
  return { c, on }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('title scenes while a slot loads', () => {
  it('does not switch to the next scene during a slow slot load, including the veil interval', () => {
    vi.useFakeTimers()
    const { c, on } = cover()
    c.worldShown()
    vi.advanceTimersByTime(10_001)
    c.busy()
    expect(c.starting).toBe(true)
    vi.advanceTimersByTime(30_000)
    expect(on.backdrop).not.toHaveBeenCalled()
  })

  it('does not schedule a late backdrop frame once the player has chosen a slot', () => {
    vi.useFakeTimers()
    const { c, on } = cover()
    c.busy()
    c.worldShown()
    vi.advanceTimersByTime(30_000)
    expect(on.backdrop).not.toHaveBeenCalled()
  })

  it('continues cycling scenes while the title is idle', () => {
    vi.useFakeTimers()
    const { c, on } = cover()
    c.worldShown()
    vi.advanceTimersByTime(11_600)
    expect(on.backdrop).toHaveBeenCalledOnce()
    expect(on.backdrop.mock.calls[0][0].map).toBe('castle')
  })
})
