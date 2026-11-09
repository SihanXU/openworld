import { afterEach, expect, it, vi } from 'vitest'
import { EquipmentGestures } from '../src/equipment-gesture.ts'

afterEach(() => vi.useRealTimers())

function setup() {
  vi.useFakeTimers()
  const gestures = new EquipmentGestures<number>(() => Date.now())
  const cast = vi.fn((_aim: number, _double: boolean) => true)
  const right = { button: 'right' as const, scope: 'finger', aim: 1, double: true, repeat: true, held: true, perform: cast }
  return { gestures, cast, right }
}

it('commits a hold once after the double window, follows aim, and stops when released', () => {
  const { gestures, cast, right } = setup()
  gestures.press(right)
  vi.advanceTimersByTime(219)
  expect(cast).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(cast).toHaveBeenNthCalledWith(1, 1, false)
  vi.advanceTimersByTime(145)
  gestures.step(4)
  expect(cast).toHaveBeenNthCalledWith(2, 4, false)
  gestures.release('right')
  vi.advanceTimersByTime(500)
  gestures.step(9)
  expect(cast).toHaveBeenCalledTimes(2)
})

it('resolves two right presses as a single double gesture with no held attack afterward', () => {
  const { gestures, cast, right } = setup()
  gestures.press({ ...right })
  gestures.release('right')
  vi.advanceTimersByTime(75)
  gestures.press({ ...right, aim: 2 })
  vi.advanceTimersByTime(400)
  gestures.step(7)
  expect(cast.mock.calls).toEqual([[2, true]])
})

it('releases a pending red tap before accepting the following blue tap', () => {
  const { gestures, cast, right } = setup()
  gestures.press({ ...right, scope: 'shades', repeat: false })
  gestures.release('right')
  gestures.press({ ...right, scope: 'shades', button: 'left', aim: 7, repeat: false })
  expect(cast.mock.calls).toEqual([[1, false]])
  vi.advanceTimersByTime(220)
  expect(cast.mock.calls).toEqual([[1, false], [7, false]])
})

it('commits a pending click before switching modes', () => {
  const { gestures, cast, right } = setup()
  gestures.press({ ...right, scope: 'shades', repeat: false })
  gestures.release('right')
  gestures.press({ ...right, button: 'mode', scope: 'shades', aim: 2, double: false, repeat: false })
  vi.advanceTimersByTime(220)
  expect(cast.mock.calls).toEqual([[1, false], [2, false]])
})
