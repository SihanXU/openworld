import { afterEach, describe, expect, it, vi } from 'vitest'
import { untilUp } from '../src/untilUp.ts'

describe('asking a service until it answers', () => {
  afterEach(() => vi.useRealTimers())

  it('asks again every while until it answers, then no more', async () => {
    vi.useFakeTimers()
    const answers = [false, false, true]
    const attempt = vi.fn(async () => answers.shift() ?? true)
    untilUp(attempt, 5000)
    await vi.advanceTimersByTimeAsync(0)
    expect(attempt).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(4999)
    expect(attempt).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(attempt).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(attempt).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(attempt).toHaveBeenCalledTimes(3)
  })

  it('waits twice as long after each failure, up to its cap (a page with no service near is not busy asking)', async () => {
    vi.useFakeTimers()
    const start = Date.now()
    const at: number[] = []
    untilUp(async () => (at.push(Date.now() - start), false), 5000, 20_000)
    await vi.advanceTimersByTimeAsync(80_000)
    expect(at).toEqual([0, 5000, 15_000, 35_000, 55_000, 75_000])
  })

  it('stops asking when called off (another game connects anew)', async () => {
    vi.useFakeTimers()
    const attempt = vi.fn(async () => false)
    const asking = untilUp(attempt, 5000)
    await vi.advanceTimersByTimeAsync(5000)
    expect(attempt).toHaveBeenCalledTimes(2)
    asking.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(attempt).toHaveBeenCalledTimes(2)
  })

  it('tells a try under way that it was called off (a newer connection must not be met by an older probe)', async () => {
    vi.useFakeTimers()
    let answer: (v: boolean) => void = () => {}
    let live: () => boolean = () => true
    const asking = untilUp((l) => ((live = l), new Promise<boolean>((r) => (answer = r))), 5000)
    expect(live()).toBe(true)
    asking.stop()
    expect(live()).toBe(false)
    answer(false)
    await vi.advanceTimersByTimeAsync(60_000)
  })
})
