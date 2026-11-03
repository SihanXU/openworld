// The agent protocol (docs/agent-players.md §3.3): transport-neutral JSON messages by which an outside agent takes a
// seat and plays it. The host seats each agent at an actor of the player's own kind, so a bot differs from a player
// only in whose keys move it: the same body and rules, the inputs of seat.ts, no debug, no writes.

import { INPUT_DOCS, type InputDoc } from './inputDocs.ts'
import type { Engine } from './engine.ts'
import { lookProblems } from './looks.ts'
import { describe, observe, type Observation } from './observe.ts'
import type { SeatInput } from './seat.ts'
import type { Id, Look } from './types.ts'

export { INPUT_DOCS, type InputDoc } from './inputDocs.ts'

export const PROTOCOL = 1
export const TICKS_PER_SECOND = 10

const MAX_SEATS = 8
const MAX_HOLD_SECONDS = 10
const DEFAULT_PUSH_EVERY = 5
const NAME_LENGTH = 40
const SKIN = /^[a-z][a-z0-9-]{0,23}$/
const SIDES: [number, number][] = [[2, 0], [-2, 0], [0, 2], [0, -2]]

type Hello = { t: 'hello'; protocol: number; name?: string; look?: Look; skin?: string; every?: number }

export type ClientMsg =
  | Hello
  | { t: 'act'; id?: string | number; input: SeatInput; hold?: number }
  | { t: 'observe'; id?: string | number; text?: boolean }
  | { t: 'bye' }

export type ServerMsg =
  | { t: 'welcome'; protocol: number; seat: Id; ticksPerSecond: number; inputs: InputDoc[] }
  | { t: 'result'; id?: string | number; ok: boolean; reason?: string }
  | { t: 'observation'; id?: string | number; observation: Observation; text?: string }
  | { t: 'error'; reason: string }
  | { t: 'ended'; why: string }

interface Conn {
  actor: Id
  every: number
}

const heldInput = (input: SeatInput): SeatInput | undefined => {
  if (input.t === 'move') return { t: 'move', dir: null }
  if (input.t === 'attack') return { t: 'attack', on: false }
  if (input.t === 'primary') return { t: 'primary', on: false }
  return undefined
}

const refuse = (reason: string): ServerMsg[] => [{ t: 'error', reason }]
const echoId = (msg: { id?: string | number }) => (msg.id !== undefined ? { id: msg.id } : {})

export class AgentHost {
  private conns = new Map<string, Conn>()
  private releases: { at: number; actor: Id; input: SeatInput }[] = []

  constructor(
    private eng: Engine,
    private max = MAX_SEATS,
  ) {}

  seats(): { conn: string; actor: Id }[] {
    return [...this.conns].map(([conn, c]) => ({ conn, actor: c.actor }))
  }

  handle(conn: string, msg: ClientMsg): ServerMsg[] {
    const seated = this.conns.get(conn)
    switch (msg.t) {
      case 'hello':
        return seated ? refuse('already seated') : this.hello(conn, msg)
      case 'act':
        return seated ? this.act(seated, msg) : refuse('no seat: say hello first')
      case 'observe': {
        const o = seated && observe(this.eng, seated.actor)
        return o ? [{ t: 'observation', ...echoId(msg), observation: o, ...(msg.text && { text: describe(o) }) }] : refuse('no seat: say hello first')
      }
      case 'bye':
        this.drop(conn)
        return [{ t: 'ended', why: 'you left' }]
      default:
        return refuse('unknown message')
    }
  }

  tick(): { conn: string; msg: ServerMsg }[] {
    const now = this.eng.world.state.tick
    this.releases = this.releases.filter((r) => r.at > now || (this.eng.seats.get(r.actor)?.input(r.input), false))
    const out: { conn: string; msg: ServerMsg }[] = []
    for (const [conn, c] of [...this.conns]) {
      if (!this.eng.world.get(c.actor)) {
        this.drop(conn)
        out.push({ conn, msg: { t: 'ended', why: 'your body is gone' } })
        continue
      }
      const o = c.every && now % c.every === 0 ? observe(this.eng, c.actor) : undefined
      if (o) out.push({ conn, msg: { t: 'observation', observation: o } })
    }
    return out
  }

  drop(conn: string): void {
    const c = this.conns.get(conn)
    if (!c) return
    this.conns.delete(conn)
    this.releases = this.releases.filter((r) => r.actor !== c.actor)
    this.eng.dismiss(c.actor)
  }

  private hello(conn: string, msg: Hello): ServerMsg[] {
    if (msg.protocol !== PROTOCOL) return refuse(`this game speaks protocol ${PROTOCOL}`)
    if (this.conns.size >= this.max) return refuse('no free seat')
    const name = (msg.name ?? 'Visitor').slice(0, NAME_LENGTH)
    const actor = this.admit(msg, name)
    if (typeof actor !== 'string') return refuse(actor.error)
    this.conns.set(conn, { actor, every: Math.max(0, Math.floor(msg.every ?? DEFAULT_PUSH_EVERY)) })
    this.eng.world.fx.push({ t: 'log', text: { en: `${name} sits down beside you.`, zh: `${name}在你身边坐下了。` } })
    return [{ t: 'welcome', protocol: PROTOCOL, seat: actor, ticksPerSecond: TICKS_PER_SECOND, inputs: INPUT_DOCS }]
  }

  private act(c: Conn, msg: Extract<ClientMsg, { t: 'act' }>): ServerMsg[] {
    const seat = this.eng.seats.get(c.actor)!
    let result: ReturnType<typeof seat.input>
    try {
      result = seat.input(msg.input)
    } catch {
      result = { ok: false, reason: 'that input was not understood' }
    }
    const hold = Math.min(MAX_HOLD_SECONDS, Number(msg.hold) || 0)
    const release = result.ok && hold > 0 ? heldInput(msg.input) : undefined
    if (release) this.releases.push({ at: this.eng.world.state.tick + Math.ceil(hold * TICKS_PER_SECOND), actor: c.actor, input: release })
    return [{ t: 'result', ...echoId(msg), ...result }]
  }

  private admit(msg: Hello, name: string): Id | { error: string } {
    const eng = this.eng
    const w = eng.world
    const table = w.onto.data.looks
    if (msg.skin !== undefined && !SKIN.test(msg.skin)) return { error: 'a skin is a short lower-case name' }
    const problems = msg.look && table ? lookProblems(msg.look, table) : []
    if (problems.length) return { error: `that look is not one the world knows: ${problems.join('; ')}` }
    const at = w.posOf(w.player)
    if (!at) return { error: 'the world is not ready' }
    const [dx, dy] = SIDES[this.conns.size % SIDES.length]
    const free = eng.nearestFree({ ...at, x: at.x + dx, y: at.y + dy }) ?? eng.nearestFree(at)
    if (!free) return { error: 'there is no room beside the player' }
    const look = msg.skin ? `skin.${msg.skin}` : msg.look && { ...structuredClone(msg.look), own: true }
    return eng.visit(free, { name, look })
  }
}
