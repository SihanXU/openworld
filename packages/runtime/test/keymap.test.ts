import { describe, expect, it } from 'vitest'
import { ACTIONS, actionOf, bind, changed, defaultKeys, equal, fillKeys, holder, lessonKey, parse, reset, serialize, unbind, type Keymap } from '../src/keymap.ts'

const A = () => defaultKeys()

describe('the keyboard map', () => {
  it('the default is the left hand on the keys: E the hand, G put, R turns, Space strikes, Tab opens the bag (I too), Shift+Tab brings the next row', () => {
    const m = A()
    expect(actionOf(m, 'KeyE', false)).toBe('hands')
    expect(actionOf(m, 'KeyG', false)).toBe('put')
    expect(actionOf(m, 'KeyR', false)).toBe('rotate')
    expect(actionOf(m, 'Space', false)).toBe('attack')
    expect(actionOf(m, 'Tab', false)).toBe('bag')
    expect(actionOf(m, 'KeyI', false)).toBe('bag')
    expect(actionOf(m, 'Tab', true)).toBe('row')
    expect(actionOf(m, 'ArrowUp', false)).toBe('up')
  })

  it('the clicks are the mouse\'s alone: no key takes, uses or stands in for a click', () => {
    for (const gone of ['take', 'use', 'action', 'primary', 'secondary']) expect(ACTIONS as readonly string[]).not.toContain(gone)
    expect(actionOf(A(), 'KeyF', false)).toBeUndefined()
  })

  it('Shift held: a Shift-bound key first (Shift+1 casts), else the plain one (Shift+W still walks up)', () => {
    const m = A()
    expect(actionOf(m, 'Digit1', true)).toBe('cast1')
    expect(actionOf(m, 'Digit1', false)).toBe('slot1')
    expect(actionOf(m, 'Digit7', true)).toBe('slot7')
    expect(actionOf(m, 'KeyW', true)).toBe('up')
    expect(actionOf(m, 'ShiftLeft', true)).toBe('walk')
  })

  it('no key is two actions\'', () => {
    const m = A()
    const all = ACTIONS.flatMap((a) => m[a].map((b) => `${b.shift ? 'S+' : ''}${b.code}`))
    expect(new Set(all).size).toBe(all.length)
  })

  it('binding a key another action holds trades them; the same action\'s other slot trades in place; a reserved key is refused', () => {
    const { map, swapped } = bind(A(), 'hands', 0, { code: 'KeyG' })
    expect(swapped).toBe('put')
    expect(actionOf(map, 'KeyG', false)).toBe('hands')
    expect(actionOf(map, 'KeyE', false)).toBe('put')
    // a free key: nothing traded
    const free = bind(A(), 'dash', 1, { code: 'KeyZ' })
    expect(free.swapped).toBeUndefined()
    expect(free.map.dash.map((b) => b.code)).toEqual(['KeyQ', 'KeyZ'])
    // the action's own other key into this slot: the two slots trade
    const own = bind(A(), 'up', 0, { code: 'ArrowUp' })
    expect(own.map.up.map((b) => b.code)).toEqual(['ArrowUp', 'KeyW'])
    // a key into an empty action whose holder has nothing to take back: the holder loses it
    const emptied = unbind(A(), 'rotate', 0)
    const took = bind(emptied, 'rotate', 0, { code: 'KeyE' })
    expect(took.swapped).toBe('hands')
    expect(took.map.hands).toEqual([])
    expect(bind(A(), 'hands', 0, { code: 'Escape' }).map.hands).toEqual(A().hands)
    expect(bind(A(), 'hands', 0, { code: 'ShiftLeft', shift: true }).map.hands).toEqual(A().hands)
    expect(unbind(A(), 'bag', 1).bag).toEqual([{ code: 'Tab' }])
  })

  it('an action back to its default: its keys again, taken from whoever holds one now; changed says which differ', () => {
    let m = bind(A(), 'put', 0, { code: 'KeyT' }).map
    expect(changed(m, 'put')).toBe(true)
    expect(changed(m, 'hands')).toBe(false)
    // G went to the hands meanwhile
    m = bind(m, 'hands', 1, { code: 'KeyG' }).map
    const back = reset(m, 'put')
    expect(back.took).toEqual(['hands'])
    expect(back.map.put).toEqual([{ code: 'KeyG' }])
    expect(back.map.hands).toEqual([{ code: 'KeyE' }])
    expect(changed(back.map, 'put')).toBe(false)
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

  it('read back from storage: what it names well, the default for the rest, never one key twice; nonsense and the old actions are dropped', () => {
    const m = bind(A(), 'attack', 0, { code: 'KeyJ' }).map
    expect(parse(JSON.parse(serialize(m)))).toEqual(m)
    expect(parse('nonsense')).toEqual(A())
    expect(parse({ keys: { hands: [{ code: 'Escape' }], put: 'x' } }).hands).toEqual([])
    expect(parse({ keys: { put: 'x' } }).put).toEqual(A().put)
    // a map stored before the clicks were the mouse's alone (F took, R used): what it named is gone, the rest kept
    const old = parse({ keys: { take: [{ code: 'KeyF' }], use: [{ code: 'KeyR' }], hands: [{ code: 'KeyE' }] } })
    expect(old).toEqual(A())
    const twice = parse({ keys: { hands: [{ code: 'KeyQ' }] } })
    expect(holder(twice, { code: 'KeyQ' })).toBe('hands')
    expect(twice.dash).toEqual([])
  })

  it('a text\'s keys are the keys that do it now; a lesson\'s key, written as the default\'s, is shown as the key now', () => {
    let m: Keymap = A()
    expect(fillKeys('Press {key:hands} to pick up, {key:move} to walk, {key:slots} to hold, {key:casts} to cast.', m, 'en')).toBe('Press E to pick up, WASD to walk, 1–0 to hold, Shift+1–6 to cast.')
    expect(fillKeys('按 {key:attack} 攻击，{key:nothing} 不变', m, 'zh')).toBe('按 空格 攻击，{key:nothing} 不变')
    // an aside naming a key the map leaves unbound goes
    const none = unbind(unbind(m, 'journal', 0), 'skills', 0)
    expect(fillKeys('{key:journal}', none, 'zh')).toBe('（未设按键）')
    expect(fillKeys('进行中的任务（{key:journal}）', none, 'zh')).toBe('进行中的任务')
    expect(fillKeys('the skill tree ({key:skills}).', none, 'en')).toBe('the skill tree.')
    expect(fillKeys('the skill tree ({key:skills}).', m, 'en')).toBe('the skill tree (K).')
    m = bind(m, 'hands', 0, { code: 'KeyT' }).map
    expect(fillKeys('{key:hands}', m, 'en')).toBe('T')
    expect(lessonKey('E', m, 'en')).toBe('T')
    expect(lessonKey('I', m, 'en')).toBe('Tab')
    expect(lessonKey('WASD', m, 'en')).toBe('WASD')
    expect(lessonKey('hold E', m, 'zh')).toBe('长按 T')
    expect(lessonKey('LMB', m, 'en')).toBe('LMB')
  })
})
