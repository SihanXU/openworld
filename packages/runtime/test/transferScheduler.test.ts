import { describe, expect, it } from 'vitest'
import { createTransferScheduler } from '../src/transferScheduler.ts'

type FakePort = {
  onmessage: ((event: MessageEvent) => void) | null
  postMessage: (value: unknown) => void
  close: () => void
}

function fakeChannel() {
  const pending: (() => void)[] = []
  const port1: FakePort = { onmessage: null, postMessage: () => {}, close: () => {} }
  const port2: FakePort = { onmessage: null, postMessage: () => pending.push(() => port1.onmessage?.({} as MessageEvent)), close: () => {} }
  return {
    channel: { port1, port2 },
    flushOne() { pending.shift()?.() },
    get pending() { return pending.length },
  }
}

describe('transfer scheduler', () => {
  it('runs scheduled callbacks FIFO and lets later callbacks run after one throws', () => {
    const fake = fakeChannel()
    const schedule = createTransferScheduler(() => fake.channel)
    const seen: string[] = []
    schedule(() => { seen.push('first'); throw new Error('callback failed') })
    schedule(() => { seen.push('second') })
    expect(fake.pending).toBe(1)
    expect(() => fake.flushOne()).toThrow('callback failed')
    expect(seen).toEqual(['first'])
    expect(fake.pending).toBe(1)
    fake.flushOne()
    expect(seen).toEqual(['first', 'second'])
    expect(fake.pending).toBe(0)
  })

  it('cancels a scheduled callback without disturbing the remaining FIFO order', () => {
    const fake = fakeChannel()
    const schedule = createTransferScheduler(() => fake.channel)
    const seen: string[] = []
    const cancel = schedule(() => seen.push('cancelled'))
    schedule(() => seen.push('kept'))
    cancel()
    fake.flushOne()
    expect(seen).toEqual(['kept'])
    expect(fake.pending).toBe(0)
  })
})
