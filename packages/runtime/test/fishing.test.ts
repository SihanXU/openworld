import { describe, expect, it } from 'vitest'
import * as protocol from '../src/protocol.ts'

type Input = { t: 'attack'; on: boolean } | { t: 'key'; key: 'use' | 'take' }
const route = protocol.routeFishingWorkerInput as ((active: boolean, input: Input) => unknown) | undefined
const FishingInputLatch = protocol.FishingInputLatch

describe('fishing input routing', () => {
  it('routes a stale attack press to fishing when the worker session is active', () => {
    expect(route?.(true, { t: 'attack', on: true })).toEqual({ kind: 'fishing', action: 'press' })
    expect(route?.(true, { t: 'attack', on: false })).toEqual({ kind: 'fishing', action: 'release' })
  })

  it('blocks a stale use action while fishing and preserves normal inactive behavior', () => {
    expect(route?.(true, { t: 'key', key: 'use' })).toEqual({ kind: 'ignore' })
    expect(route?.(false, { t: 'key', key: 'use' })).toEqual({ kind: 'game' })
    expect(route?.(false, { t: 'attack', on: true })).toEqual({ kind: 'game' })
  })

  it('deduplicates held button edges and clears them on release or blur', () => {
    const held = new FishingInputLatch()
    expect(held.press('space')).toBe(true)
    expect(held.press('space')).toBe(false)
    expect(held.press('mouse')).toBe(false)
    expect(held.release('space')).toBe('held')
    expect(held.release('mouse')).toBe('last')
    expect(held.release('space')).toBe('none')
    expect(held.press('mouse')).toBe(true)
    expect(held.clear()).toEqual(['mouse'])
    expect(held.press('mouse')).toBe(true)
  })

  it('keeps a fishing Space key sequence consumed until physical keyup', () => {
    const routeSpace = protocol.routeSpaceKeyDown
    expect(routeSpace(true, false, false)).toBe('fishing-press')
    expect(routeSpace(true, true, true)).toBe('ignore')
    expect(routeSpace(false, true, true)).toBe('ignore')
    expect(routeSpace(false, false, true)).toBe('ignore')
    expect(routeSpace(false, false, false)).toBe('attack')
  })

  it('routes Escape to cancel during fishing and to the menu otherwise', () => {
    expect(protocol.routeFishingEscape(true)).toBe('cancel')
    expect(protocol.routeFishingEscape(false)).toBe('menu')
  })
})
