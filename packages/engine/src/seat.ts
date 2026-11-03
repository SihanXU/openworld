// A seat is an actor whose keys somebody else holds (docs/agent-players.md): the primary seat is the world's player,
// any other is kept by a person or an agent through the same Controls, so it can do what any player can and no more.
// An actor under no seat is an ordinary one under its goals.

import { Controls, type Key } from './controls.ts'
import type { Engine } from './engine.ts'
import type { Aim, Dir, Id, Plan } from './types.ts'
import type { Writer } from './world.ts'

export type SeatInput =
  | { t: 'move'; dir: Dir | null; walk?: boolean; run?: boolean; steps?: number }
  | { t: 'dash' }
  | { t: 'attack'; on: boolean }
  | { t: 'primary'; on: boolean; tile?: Aim }
  | { t: 'key'; key: Key; tile?: Aim; layer?: number }
  | { t: 'keyOnItem'; key: Plan['key']; item: Id }
  | { t: 'useItemOnHeldItem'; instrument: Id; target: Id }
  | { t: 'select'; slot: number }
  | { t: 'cycle'; dir: 1 | -1 }
  | { t: 'row'; dir: 1 | -1 }
  | { t: 'swap'; a: number; b: number }
  | { t: 'quickMove'; slot: number }
  | { t: 'drop'; slot: number; all?: boolean }
  | { t: 'wear'; item?: Id; putOn?: boolean }
  | { t: 'craft'; id: string; at?: Id }
  | { t: 'cast'; slot: number }
  | { t: 'toggle'; what: 'drawn' | 'sneaking' }
  | { t: 'transfer'; from: 'chest' | 'bag'; item: Id; all?: boolean }
  | { t: 'closePanel' }

export type SeatResult = { ok: true } | { ok: false; reason: string }

const OK: SeatResult = { ok: true }
const no = (reason: string): SeatResult => ({ ok: false, reason })

const MAX_STEPS = 64
const STUCK_TICKS = 20

export class Seat {
  readonly controls: Controls
  panel: Id | undefined
  private dir: Dir | null = null
  private walk = false
  private run = false
  private steps = 0
  private last = ''
  private stuck = 0
  private attacking = false
  private swinging: Plan | undefined
  private swingAt: Aim | undefined

  constructor(
    private eng: Engine,
    readonly actor: Id,
    hand: Writer,
  ) {
    this.controls = new Controls(eng, hand, actor)
  }

  move(dir: Dir | null, walk = false, run = false, steps = 0): void {
    this.dir = dir
    this.walk = walk
    this.run = run
    this.steps = dir ? Math.max(0, Math.min(MAX_STEPS, Math.floor(steps))) : 0
    this.stuck = 0
    this.last = this.cell()
    if (dir) this.eng.moveSeat(this.actor, dir, walk, run)
    this.counted()
  }

  attack(on: boolean): void {
    this.attacking = on
    if (on) this.controls.strike()
  }

  press(): void {
    if (this.dir) {
      this.eng.moveSeat(this.actor, this.dir, this.walk, this.run)
      this.counted()
    }
    if (this.attacking) this.controls.strike()
    if (this.swinging) this.controls.again(this.swinging, this.swingAt)
  }

  input(m: SeatInput): SeatResult {
    const eng = this.eng
    const c = this.controls
    const me = eng.world.get(this.actor)
    if (!me) return no('no one is there')
    switch (m.t) {
      case 'move':
        this.move(m.dir, m.walk, m.run, m.steps)
        return OK
      case 'attack':
        this.attack(m.on)
        return OK
      case 'dash':
        eng.hooks.seat.dash?.(me)
        return OK
      case 'cast':
        eng.hooks.seat.cast?.(me, m.slot)
        return OK
      case 'primary': {
        if (!m.on) {
          this.swinging = undefined
          return OK
        }
        if (this.panel) return no('a container is open')
        this.swinging = c.planFor('primary', m.tile)
        this.swingAt = m.tile
        if (!this.swinging) return no('nothing there to do')
        this.open(c.swing(this.swinging))
        return OK
      }
      case 'key': {
        if (this.panel) return no('a container is open')
        const plan = c.planFor(m.key, m.tile, m.layer)
        if (!plan) return no('nothing there to do')
        this.open(c.run(plan))
        return OK
      }
      case 'keyOnItem': {
        const plan = c.planOnItem(m.key, m.item)
        if (!plan) return no('that does nothing')
        c.run(plan)
        return OK
      }
      case 'useItemOnHeldItem':
        c.useItemOnHeldItem(m.instrument, m.target)
        return OK
      case 'select':
        c.select(m.slot)
        return OK
      case 'cycle':
        c.cycle(m.dir)
        return OK
      case 'row':
        c.nextRow(m.dir)
        return OK
      case 'swap':
        c.swap(m.a, m.b)
        return OK
      case 'quickMove':
        c.quickMove(m.slot)
        return OK
      case 'drop':
        c.drop(m.slot, m.all ?? true)
        return OK
      case 'wear':
        c.wear(m.item, m.putOn)
        return OK
      case 'craft': {
        const recipe = eng.recipes.get(m.id)
        if (!recipe) return no('no such recipe')
        return c.craft(recipe, m.at) ? OK : no('it cannot be made now')
      }
      case 'toggle':
        c.toggle(m.what)
        return OK
      case 'transfer':
        if (!this.panel) return no('no container is open')
        c.transfer(this.panel, m.from, m.item, m.all ?? false)
        return OK
      case 'closePanel':
        if (this.panel && eng.world.hasStatus({ e: this.panel }, 'open')) eng.interact('interact', this.actor, { e: this.panel }, { instrument: null })
        this.panel = undefined
        return OK
      default:
        return no(`no such input: ${String((m as { t?: unknown }).t)}`)
    }
  }

  private cell(): string {
    const at = this.eng.world.posOf(this.eng.world.get(this.actor)!)
    return at ? `${at.map}:${at.x}:${at.y}` : ''
  }

  private counted(): void {
    if (!this.steps || !this.dir) return
    const now = this.cell()
    if (now !== this.last) {
      this.last = now
      this.stuck = 0
      if (--this.steps <= 0) this.dir = null
    } else if (++this.stuck > STUCK_TICKS) {
      this.dir = null
      this.steps = 0
    }
  }

  private open(out: { panel?: Id }): void {
    if (out.panel) this.panel = out.panel
  }
}
