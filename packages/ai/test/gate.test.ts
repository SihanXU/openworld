// The modder's gate (pipeline.ts): no more designs at once than the harness allows, live before offline.

import { describe, expect, it } from 'vitest'
import { Gate } from '../src/modder/pipeline.ts'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('the gate', () => {
  it('never lets more in than its limit: a turn that ends goes to the one waiting, not to one arriving then', async () => {
    const gate = new Gate(() => 1)
    let inside = 0
    let most = 0
    const enter = async (priority: number) => {
      const release = await gate.acquire(priority)
      most = Math.max(most, ++inside)
      return () => (inside--, release())
    }
    const first = await enter(0)
    const waiting = enter(0)
    await tick()
    first()
    // one arrives just as the first turn ends, before the waiting one has woken
    const late = enter(0)
    const second = await waiting
    await tick()
    expect(most).toBe(1)
    second()
    ;(await late)()
    expect(most).toBe(1)
  })

  it('wakes the waiting by priority: live (0) before offline (1)', async () => {
    const gate = new Gate(() => 1)
    const order: string[] = []
    const release = await gate.acquire(1)
    const offline = gate.acquire(1).then((r) => (order.push('offline'), r()))
    const live = gate.acquire(0).then((r) => (order.push('live'), r()))
    release()
    await Promise.all([offline, live])
    expect(order).toEqual(['live', 'offline'])
  })

  it('a turn ended twice frees one place, once', async () => {
    const gate = new Gate(() => 2)
    const a = await gate.acquire(0)
    a()
    a()
    const b = await gate.acquire(0)
    const c = await gate.acquire(0)
    let d = false
    void gate.acquire(0).then(() => (d = true))
    await tick()
    expect(d).toBe(false)
    b()
    c()
  })
})
