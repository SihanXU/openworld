// The agent protocol (docs/agent-players.md §3.3) played by a scripted bot: it is seated in a body of the player's own
// kind beside the player, acts through the seat's keys, is told what it sees, and leaves with its body.

import { describe, expect, it } from 'vitest'
import { AgentHost, INPUT_DOCS, PROTOCOL, type ClientMsg, type ServerMsg } from '@openworld/engine'
import { DIRS, played, ticks, untilReady } from './seats.ts'

const hello = (extra: Partial<Extract<ClientMsg, { t: 'hello' }>> = {}): ClientMsg => ({ t: 'hello', protocol: PROTOCOL, name: 'Bot', ...extra })

function one(answer: ServerMsg[]): ServerMsg {
  expect(answer).toHaveLength(1)
  return answer[0]
}

function seated(host: AgentHost, conn: string, extra = {}) {
  const welcome = one(host.handle(conn, hello(extra)))
  if (welcome.t !== 'welcome') throw new Error(`no seat: ${JSON.stringify(welcome)}`)
  return welcome
}

describe('the agent protocol', () => {
  it('seats a hello beside the player in a body of the player\'s kind, with the spec of the inputs', () => {
    const eng = played()
    const welcome = seated(new AgentHost(eng), 'a')
    const body = eng.world.get(welcome.seat)!
    expect(body.type).toBe(eng.world.player.type)
    expect(eng.world.posOf(body)!.map).toBe(eng.world.posOf(eng.world.player)!.map)
    expect(eng.seats.has(body.id)).toBe(true)
    expect(welcome.inputs).toEqual(INPUT_DOCS)
    for (const input of welcome.inputs) expect(input.doc.length).toBeGreaterThan(5)
  })

  it('acts through the seat\'s keys and is told what it sees, pushed on its own beat and when asked', () => {
    const eng = played()
    const host = new AgentHost(eng)
    const body = eng.world.get(seated(host, 'a', { every: 4 }).seat)!
    untilReady(eng, body.id)
    const start = { ...eng.world.posOf(body)! }
    const moved = DIRS.some((dir) => {
      expect(one(host.handle('a', { t: 'act', id: 7, input: { t: 'move', dir } }))).toMatchObject({ t: 'result', id: 7, ok: true })
      ticks(eng, 12)
      host.handle('a', { t: 'act', input: { t: 'move', dir: null } })
      const now = eng.world.posOf(body)!
      return now.x !== start.x || now.y !== start.y
    })
    expect(moved).toBe(true)
    const pushed = Array.from({ length: 8 }, () => (eng.tick(), host.tick())).flat()
    expect(pushed.filter((p) => p.msg.t === 'observation')).toHaveLength(2)
    const asked = one(host.handle('a', { t: 'observe', id: 'q', text: true }))
    expect(asked).toMatchObject({ t: 'observation', id: 'q' })
    if (asked.t === 'observation') expect(asked.text).toContain('Map (@ you')
  })

  it('holds a key for the seconds it is told and lets it go', () => {
    const eng = played()
    const host = new AgentHost(eng)
    const body = eng.world.get(seated(host, 'a').seat)!
    untilReady(eng, body.id)
    const dir = DIRS.find((d) => host.handle('a', { t: 'act', input: { t: 'move', dir: d }, hold: 0.5 })[0].t === 'result')!
    ticks(eng, 4)
    host.tick()
    ticks(eng, 20)
    host.tick()
    const rested = { ...eng.world.posOf(body)! }
    ticks(eng, 20)
    expect(eng.world.posOf(body)).toMatchObject(rested)
    expect(dir).toBeDefined()
  })

  it('refuses another protocol, an act before hello, a second hello, a full house and a malformed input', () => {
    const eng = played()
    const host = new AgentHost(eng, 2)
    expect(one(host.handle('x', { t: 'hello', protocol: 99 })).t).toBe('error')
    expect(one(host.handle('x', { t: 'act', input: { t: 'dash' } })).t).toBe('error')
    expect(one(host.handle('x', { t: 'observe' })).t).toBe('error')
    seated(host, 'a')
    expect(one(host.handle('a', hello())).t).toBe('error')
    seated(host, 'b')
    expect(one(host.handle('c', hello()))).toMatchObject({ t: 'error', reason: 'no free seat' })
    expect(one(host.handle('a', { t: 'act', input: { t: 'nope' } as never }))).toMatchObject({ t: 'result', ok: false })
  })

  it('draws a visitor as the skin it names and refuses a name that is no skin\'s', () => {
    const eng = played()
    const host = new AgentHost(eng)
    expect(eng.world.get(seated(host, 'a', { skin: 'whale' }).seat)!.look).toBe('skin.whale')
    expect(one(host.handle('b', hello({ skin: '../etc' }))).t).toBe('error')
    expect(eng.world.get(seated(host, 'c').seat)!.look).toBeUndefined()
  })

  it('takes its body with it when it leaves or loses it, and the seat is free again', () => {
    const eng = played()
    const host = new AgentHost(eng, 1)
    const welcome = seated(host, 'a')
    expect(one(host.handle('a', { t: 'bye' })).t).toBe('ended')
    expect(eng.world.get(welcome.seat)).toBeUndefined()
    expect(eng.seats.size).toBe(0)
    const second = seated(host, 'b')
    eng.author(() => eng.world.destroy(eng.world.get(second.seat)!))
    expect(host.tick()).toEqual([{ conn: 'b', msg: { t: 'ended', why: 'your body is gone' } }])
  })
})
