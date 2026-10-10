import { afterEach, describe, expect, it, vi } from 'vitest'
import { AfterSave } from '../src/afterSave.ts'

describe('back to the title after the save is written', () => {
  afterEach(() => vi.useRealTimers())

  it('waits for the save, then runs once', () => {
    vi.useFakeTimers()
    const a = new AfterSave()
    const run = vi.fn()
    a.then(run)
    vi.advanceTimersByTime(500)
    expect(run).not.toHaveBeenCalled()
    a.written()
    a.written()
    vi.advanceTimersByTime(5000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('goes on after a while when no save comes (nothing to save)', () => {
    vi.useFakeTimers()
    const a = new AfterSave()
    const run = vi.fn()
    a.then(run, 2000)
    vi.advanceTimersByTime(1999)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('a save with nothing waiting does nothing', () => {
    const a = new AfterSave()
    expect(() => a.written()).not.toThrow()
  })
})
