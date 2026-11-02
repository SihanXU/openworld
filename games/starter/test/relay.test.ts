// A game in a page and an agent outside it (packages/bridge/src/relay.ts, runtime/src/agentLink.ts): the "page" polls
// the relay and serves its agent host, and the agent speaks plain HTTP to the relay as if the game were there.

import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentHost } from '@openworld/engine'
import { agentServer, pageRelay } from '@openworld/bridge'
import { linkAgents } from '../../../packages/runtime/src/agentLink.ts'
import { played } from './seats.ts'

const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach((stop) => stop()))

async function relay(): Promise<string> {
  const r = pageRelay()
  const server = agentServer(r.dispatch, { extra: r.extra })
  await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening))
  cleanup.push(() => server.close())
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, ...(body !== undefined && { body: JSON.stringify(body) }) })
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() }
}

describe('the relay', () => {
  it('says so when no game is connected', async () => {
    const r = await call(`${await relay()}/seat`, 'POST', { name: 'Lost' })
    expect(r.status).toBe(503)
    expect(r.body.error).toMatch(/no game/)
  })

  it('carries an agent\'s hello, act, observe and leave to the page\'s game and back', async () => {
    const url = await relay()
    const eng = played()
    const host = new AgentHost(eng)
    cleanup.push(linkAgents(url, () => host).stop)
    const timer = setInterval(() => (eng.tick(), host.tick()), 20)
    cleanup.push(() => clearInterval(timer))

    let seat = await call(`${url}/seat`, 'POST', { name: 'Remote' })
    for (let i = 0; i < 50 && seat.status === 503; i++) {
      await new Promise((r) => setTimeout(r, 40))
      seat = await call(`${url}/seat`, 'POST', { name: 'Remote' })
    }
    expect(seat.status).toBe(200)
    const { token, seat: actor } = seat.body
    expect(eng.world.get(actor)?.name).toMatchObject({ en: 'Remote' })
    expect((await call(`${url}/seat/${token}/observe?text=1`, 'GET')).body).toContain('Tick')
    expect((await call(`${url}/seat/${token}/act`, 'POST', { input: { t: 'move', dir: 'right' }, hold: 0.3 })).body).toMatchObject({ t: 'result', ok: true })
    expect((await call(`${url}/seat/${token}`, 'DELETE')).body).toEqual({ ended: true })
    expect(eng.world.get(actor)).toBeUndefined()
  })
})
