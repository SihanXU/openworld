import { describe, expect, it } from 'vitest'
import { ACTIONS, PRESETS, actionOf, bind, changed, equal, fillKeys, holder, lessonKey, parse, presetOf, reset, serialize, unbind, type Keymap } from '../src/keymap.ts'

const A = () => PRESETS.a()

describe('the keyboard map', () => {
  it('the default is the left hand on the keys: E, F, G, R act, Space strikes, Tab opens the bag (I too), Shift+Tab brings the next row', () => {
    const m = A()
    expect(actionOf(m, 'KeyE', false)).toBe('hands')
    expect(actionOf(m, 'KeyR', false)).toBe('use')
    expect(actionOf(m, 'Space', false)).toBe('attack')
    expect(actionOf(m, 'Tab', false)).toBe('bag')
    expect(actionOf(m, 'KeyI', false)).toBe('bag')
    expect(actionOf(m, 'Tab', true)).toBe('row')
    expect(actionOf(m, 'ArrowUp', false)).toBe('up')
    expect(m.action).toEqual([])
  })

  it('Shift held: a Shift-bound key first (Shift+1 casts), else the plain one (Shift+W still walks up)', () => {
    const m = A()
    expect(actionOf(m, 'Digit1', true)).toBe('cast1')
    expect(actionOf(m, 'Digit1', false)).toBe('slot1')
    expect(actionOf(m, 'Digit7', true)).toBe('slot7')
    expect(actionOf(m, 'KeyW', true)).toBe('up')
    expect(actionOf(m, 'ShiftLeft', true)).toBe('walk')
  })

  it('no key is two actions\', in either preset', () => {
    for (const p of ['a', 'b'] as const) {
      const m = PRESETS[p]()
      const all = ACTIONS.flatMap((a) => m[a].map((b) => `${b.shift ? 'S+' : ''}${b.code}`))
      expect(new Set(all).size).toBe(all.length)
    }
  })

  it('preset B puts the right hand on J (strike), K (the action) and L (dash), and gives up the panels those keys opened', () => {
    const m = PRESETS.b()
    expect(actionOf(m, 'KeyJ', false)).toBe('attack')
    expect(actionOf(m, 'KeyK', false)).toBe('action')
    expect(actionOf(m, 'KeyL', false)).toBe('dash')
    expect(m.journal).toEqual([])
    expect(actionOf(m, 'Space', false)).toBe('attack')
    expect(presetOf(m)).toBe('b')
    expect(presetOf(A())).toBe('a')
  })

  it('binding a key another action holds trades them; the same action\'s other slot trades in place; a reserved key is refused', () => {
    const { map, swapped } = bind(A(), 'hands', 0, { code: 'KeyF' })
    expect(swapped).toBe('take')
    expect(actionOf(map, 'KeyF', false)).toBe('hands')
    expect(actionOf(map, 'KeyE', false)).toBe('take')
    // a free key: nothing traded
    const free = bind(A(), 'dash', 1, { code: 'KeyZ' })
    expect(free.swapped).toBeUndefined()
    expect(free.map.dash.map((b) => b.code)).toEqual(['KeyQ', 'KeyZ'])
    // the action's own other key into this slot: the two slots trade
    const own = bind(A(), 'up', 0, { code: 'ArrowUp' })
    expect(own.map.up.map((b) => b.code)).toEqual(['ArrowUp', 'KeyW'])
    // a key into an empty action whose holder has nothing to take back: the holder loses it
    const action = bind(A(), 'action', 0, { code: 'KeyE' })
    expect(action.swapped).toBe('hands')
    expect(action.map.hands).toEqual([])
    expect(bind(A(), 'hands', 0, { code: 'Escape' }).map.hands).toEqual(A().hands)
    expect(bind(A(), 'hands', 0, { code: 'ShiftLeft', shift: true }).map.hands).toEqual(A().hands)
    expect(unbind(A(), 'bag', 1).bag).toEqual([{ code: 'Tab' }])
  })

  it('an action back to its default: its keys again, taken from whoever holds one now; changed says which differ', () => {
    let m = bind(A(), 'take', 0, { code: 'KeyT' }).map
    expect(changed(m, 'take')).toBe(true)
    expect(changed(m, 'hands')).toBe(false)
    // F went to the hands meanwhile
    m = bind(m, 'hands', 1, { code: 'KeyF' }).map
    const back = reset(m, 'take')
    expect(back.took).toEqual(['hands'])
    expect(back.map.take).toEqual([{ code: 'KeyF' }])
    expect(back.map.hands).toEqual([{ code: 'KeyE' }])
    expect(changed(back.map, 'take')).toBe(false)
    expect(equal(back.map, A())).toBe(true)
    expect(equal(m, A())).toBe(false)
    // a trade undone from either side: the hands took G (put got E); the hands set back, put has G again
    const traded = bind(A(), 'hands', 0, { code: 'KeyG' }).map
    expect(traded.put).toEqual([{ code: 'KeyE' }])
    const undone = reset(traded, 'hands')
    expect(undone.map.hands).toEqual([{ code: 'KeyE' }])
    expect(undone.map.put).toEqual([{ code: 'KeyG' }])
    expect(equal(undone.map, A())).toBe(true)
  })

  it('read back from storage: what it names well, the default for the rest, never one key twice; nonsense is the default', () => {
    const m = bind(A(), 'attack', 0, { code: 'KeyJ' }).map
    expect(parse(JSON.parse(serialize(m)))).toEqual(m)
    expect(parse('nonsense')).toEqual(A())
    expect(parse({ keys: { hands: [{ code: 'Escape' }], take: 'x' } }).hands).toEqual([])
    expect(parse({ keys: { take: 'x' } }).take).toEqual(A().take)
    const twice = parse({ keys: { hands: [{ code: 'KeyQ' }] } })
    expect(holder(twice, { code: 'KeyQ' })).toBe('hands')
    expect(twice.dash).toEqual([])
  })

  it('a text\'s keys are the keys that do it now; a lesson\'s key, written as the default\'s, is shown as the key now', () => {
    let m: Keymap = A()
    expect(fillKeys('Press {key:take} to take, {key:move} to walk, {key:slots} to hold, {key:casts} to cast.', m, 'en')).toBe('Press F to take, WASD to walk, 1–0 to hold, Shift+1–6 to cast.')
    expect(fillKeys('按 {key:attack} 攻击，{key:nothing} 不变', m, 'zh')).toBe('按 空格 攻击，{key:nothing} 不变')
    expect(fillKeys('{key:action}', m, 'zh')).toBe('（未设按键）')
    // an aside naming a key the map leaves unbound goes
    expect(fillKeys('进行中的任务（{key:journal}）', PRESETS.b(), 'zh')).toBe('进行中的任务')
    expect(fillKeys('the skill tree ({key:skills}).', PRESETS.b(), 'en')).toBe('the skill tree.')
    expect(fillKeys('the skill tree ({key:skills}).', m, 'en')).toBe('the skill tree (K).')
    m = bind(m, 'take', 0, { code: 'KeyT' }).map
    expect(fillKeys('{key:take}', m, 'en')).toBe('T')
    expect(lessonKey('F', m, 'en')).toBe('T')
    expect(lessonKey('I', m, 'en')).toBe('Tab')
    expect(lessonKey('WASD', m, 'en')).toBe('WASD')
    expect(lessonKey('hold E', m, 'zh')).toBe('长按 E')
    expect(lessonKey('LMB', m, 'en')).toBe('LMB')
  })
})
