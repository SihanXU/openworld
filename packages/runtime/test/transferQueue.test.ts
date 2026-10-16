import { afterEach, describe, expect, it, vi } from 'vitest'
import { TransferQueue } from '../src/transferQueue.ts'

describe('transfer queue', () => {
  afterEach(() => vi.useRealTimers())

  it('yields after at most 64 iterator steps so another message can run between batches', async () => {
    vi.useFakeTimers()
    let nexts = 0
    const queue = new TransferQueue((err) => { throw err })
    function* transfer() {
      for (let done = 1; done <= 130; done++) {
        nexts++
        yield { done, total: 130 }
      }
    }

    queue.enqueue(transfer(), 'chest', () => true)
    expect(queue.busy).toBe(true)
    let handledMessage = false
    setTimeout(() => { handledMessage = true }, 0)
    await vi.advanceTimersToNextTimerAsync()
    expect(nexts).toBe(64)
    expect(queue.progress).toEqual({ from: 'chest', done: 64, total: 130 })
    // The second batch remains a separate timer turn, leaving time for worker messages.
    expect(handledMessage).toBe(true)
    expect(nexts).toBe(64)
    await vi.advanceTimersToNextTimerAsync()
    expect(nexts).toBe(128)
    await vi.runAllTimersAsync()
    expect(nexts).toBe(130)
    expect(queue.busy).toBe(false)
    expect(queue.progress).toBeUndefined()
  })

  it('honors the time budget when the iterator steps take measurable time', async () => {
    vi.useFakeTimers()
    let now = 0
    let nexts = 0
    const queue = new TransferQueue((err) => { throw err }, () => now)
    function* transfer() {
      for (let done = 1; done <= 20; done++) {
        nexts++
        now += 3
        yield { done, total: 20 }
      }
    }

    queue.enqueue(transfer(), 'bag', () => true)
    await vi.advanceTimersToNextTimerAsync()
    expect(nexts).toBe(3)
    expect(now).toBe(9)
    expect(queue.progress).toEqual({ from: 'bag', done: 3, total: 20 })
  })

  it('runs queued transfers FIFO and clears progress after the last one', async () => {
    vi.useFakeTimers()
    const order: string[] = []
    const queue = new TransferQueue((err) => { throw err })
    function* transfer(label: string) {
      yield { done: 0, total: 1 }
      order.push(label)
      yield { done: 1, total: 1 }
    }

    queue.enqueue(transfer('first'), 'bag', () => true)
    queue.enqueue(transfer('second'), 'chest', () => true)
    await vi.runAllTimersAsync()
    expect(order).toEqual(['first', 'second'])
    expect(queue.busy).toBe(false)
    expect(queue.progress).toBeUndefined()
  })

  it('returns an invalidated active iterator and continues with the next task', async () => {
    vi.useFakeTimers()
    let valid = true
    let cleaned = 0
    let continued = false
    const queue = new TransferQueue((err) => { throw err })
    function* invalidated() {
      try {
        yield { done: 0, total: 3 }
        for (let done = 1; done <= 100; done++) yield { done, total: 100 }
      } finally {
        cleaned++
      }
    }
    function* next() {
      continued = true
      yield { done: 1, total: 1 }
    }

    queue.enqueue(invalidated(), 'chest', () => valid)
    await vi.advanceTimersToNextTimerAsync()
    expect(queue.progress).toEqual({ from: 'chest', done: 63, total: 100 })
    valid = false
    queue.enqueue(next(), 'bag', () => true)
    await vi.runAllTimersAsync()
    expect(cleaned).toBe(1)
    expect(continued).toBe(true)
    expect(queue.busy).toBe(false)
    expect(queue.progress).toBeUndefined()
  })

  it('returns a started iterator when validation throws, even if its cleanup also throws', async () => {
    vi.useFakeTimers()
    const validationError = new Error('validation failed')
    const cleanupError = new Error('cleanup failed')
    const onError = vi.fn()
    let validations = 0
    let cleaned = 0
    let continued = false
    const queue = new TransferQueue(onError)
    function* failingValidation() {
      try {
        for (let done = 0; done < 100; done++) yield { done, total: 100 }
      } finally {
        cleaned++
        throw cleanupError
      }
    }
    function* next() {
      continued = true
      yield { done: 1, total: 1 }
    }

    queue.enqueue(failingValidation(), 'chest', () => {
      validations++
      if (validations === 65) throw validationError
      return true
    })
    queue.enqueue(next(), 'bag', () => true)
    await vi.runAllTimersAsync()
    expect(cleaned).toBe(1)
    expect(onError).toHaveBeenNthCalledWith(1, validationError)
    expect(onError).toHaveBeenNthCalledWith(2, cleanupError)
    expect(continued).toBe(true)
    expect(queue.busy).toBe(false)
    expect(queue.progress).toBeUndefined()
  })

  it('cancel clears the timer, returns every iterator, and leaves no progress', async () => {
    vi.useFakeTimers()
    let cleaned = 0
    const queue = new TransferQueue((err) => { throw err })
    function* active() {
      try {
        while (true) yield { done: 1, total: 1000 }
      } finally {
        cleaned++
      }
    }
    const queued = {
      next: vi.fn(() => ({ done: false as const, value: { done: 0, total: 1 } })),
      return: vi.fn(() => ({ done: true as const, value: undefined })),
      [Symbol.iterator]() { return this },
    } as unknown as Generator<{ done: number; total: number }, void>

    queue.enqueue(active(), 'chest', () => true)
    queue.enqueue(queued, 'bag', () => true)
    await vi.advanceTimersToNextTimerAsync()
    expect(queue.busy).toBe(true)
    queue.cancel()
    expect(cleaned).toBe(1)
    expect(queued.return).toHaveBeenCalledTimes(1)
    expect(queue.busy).toBe(false)
    expect(queue.progress).toBeUndefined()
    await vi.runAllTimersAsync()
    expect(queued.next).not.toHaveBeenCalled()
  })

  it('reports a failing iterator without blocking later tasks or leaving stale busy state', async () => {
    vi.useFakeTimers()
    const error = new Error('transfer failed')
    const onError = vi.fn(() => { throw new Error('reporter failed') })
    let continued = false
    const queue = new TransferQueue(onError)
    function* broken() {
      yield { done: 0, total: 1 }
      throw error
    }
    function* next() {
      continued = true
      yield { done: 1, total: 1 }
    }

    queue.enqueue(broken(), 'chest', () => true)
    queue.enqueue(next(), 'bag', () => true)
    await vi.runAllTimersAsync()
    expect(onError).toHaveBeenCalledWith(error)
    expect(continued).toBe(true)
    expect(queue.busy).toBe(false)
    expect(queue.progress).toBeUndefined()
  })
})
