// The fixed, typed set of effect primitives. New behaviour is data (rules); only a new
// primitive is an engine change.

import type { Engine } from './engine.ts'
import { matchSelector } from './rules.ts'
import type { Amount, Effect, Entity, GameEvent, Place, Pos, Ref, RoleRef, Rule, Text } from './types.ts'
import { NO_EXPIRY } from './world.ts'
import { GIFT_LINES, MOOD_OF, befriend, chooseLine, giveGift, memoryOf, raiseTopic } from './people.ts'

export const PRIMITIVES: Record<Effect['op'], string> = {
  spawn: 'spawn {type, at, into?: tile|contents|hand, count?: number | {prop, of}} — create new entities; type may be "@prop:<role>.<key>" (a crop\'s yieldType), count may read a prop (the planks in a frame)',
  destroy: 'destroy {of} — remove an entity (and everything it holds)',
  transform: 'transform {of, into} — change an entity\'s type in place',
  moveTo: 'moveTo {of, to, into?: tile|contents|hand} — move an entity to a role\'s tile / contents / hand',
  addStatus: 'addStatus {of, status, duration?} — apply a status to an entity or tile (emits a `status` event)',
  removeStatus: 'removeStatus {of, status}',
  setProp: 'setProp {of, key, value}',
  addProp: 'addProp {of, key, delta, min?, max?}',
  addTag: 'addTag {of, tag}',
  removeTag: 'removeTag {of, tag}',
  damage: 'damage {of, amount, element?, mul?, pierce?} — reduce hp (defense applies unless pierce)',
  heal: 'heal {of, amount}',
  setTerrain: 'setTerrain {of: tile role, terrain}',
  spread: 'spread {from, status, radius, chance?, filter?, hit?} — propagate a status to nearby tiles/entities',
  hit: 'hit {of, element?, power, by?} — emit a hit event (elemental reactions resolve it)',
  push: 'push {of, away, tiles} — shove an actor away from another role',
  vfx: 'vfx {at, fx} — play a visual effect',
  say: 'say {who, text} — speech bubble ("@line" = one of the NPC\'s own lines; text fills {target}, {target.planks} …)',
  log: 'log {text} — message log line ({actor}/{target}/{instrument} = names, {target.key} = that role\'s prop)',
  open: 'open {of} — toggle a container open/closed',
  dropContents: 'dropContents {of} — spill everything inside onto the tile',
  setFact: 'setFact {key, value} — set a world fact (people, schedules and scenes read facts)',
  addFact: 'addFact {key, delta} — add to a numeric world fact',
  topic: 'topic {id, days?} — something happened that people will talk about while it is fresh (default 4 days)',
  befriend: 'befriend {who, amount, daily?} — change the player\'s friendship with a person (daily: at most once a day)',
  gift: 'gift {to, item} — the player gives a person an item: their taste decides the friendship and the reaction',
  sleep: 'sleep {} — the player sleeps until the next morning',
  mail: 'mail {id} — a letter arrives in the player\'s mailbox',
  scene: 'scene {id} — play a scripted scene',
}

export class EffectRunner {
  constructor(private eng: Engine) {}

  private ref(ev: GameEvent, r: RoleRef): Ref | undefined {
    const w = this.eng.world
    if (r.startsWith('tileOf:')) {
      const role = r.slice(7) as 'actor' | 'target' | 'instrument'
      const p = w.refPos(ev.roles[role])
      return p ? { tile: p } : undefined
    }
    return ev.roles[r as 'actor' | 'target' | 'instrument']
  }

  private entity(ev: GameEvent, r: RoleRef): Entity | undefined {
    const ref = this.ref(ev, r)
    return ref && 'e' in ref ? this.eng.world.get(ref.e) : undefined
  }

  private pos(ev: GameEvent, r: RoleRef): Pos | undefined {
    return this.eng.world.refPos(this.ref(ev, r))
  }

  amount(ev: GameEvent, a: Amount): number {
    if (typeof a === 'number') return a
    if (a === 'power') return ev.power ?? 1
    const v = this.eng.world.view(ev.roles[a.of])
    const base = Number(v?.props[a.prop] ?? 0)
    return base * (a.mul ?? 1) + (a.add ?? 0)
  }

  private text(ev: GameEvent, who: Entity | undefined, t: Text): Text {
    if (t === '@line') {
      const lines = who?.npc?.lines
      if (lines?.length) return lines[Math.floor(this.eng.world.rand() * lines.length)]
      const own = who && this.eng.world.prop(who, 'text')
      if (typeof own === 'string') return own
      return { en: '…', zh: '……' }
    }
    if (typeof t === 'string' && t.includes('{')) return this.fill(ev, t)
    if (typeof t === 'object') return { en: this.fill(ev, t.en), zh: t.zh ? this.fill(ev, t.zh, 'zh') : undefined }
    return t
  }

  /** Role names as they were when the rule started (set by run). */
  private names?: Map<string, string>

  /**
   * Substitute {target} / {instrument} / {actor} with display names, and {target.key} with a prop.
   * Names are the ones the roles had when the rule started: "you pour out {instrument}" still
   * reads right after the bottle was emptied or destroyed earlier in the same rule.
   */
  private fill(ev: GameEvent, s: string, locale: 'en' | 'zh' = 'en'): string {
    return s.replace(/\{(actor|target|instrument)(?:\.(\w+))?\}/g, (_, role: 'actor' | 'target' | 'instrument', key?: string) => {
      if (!key) return this.names?.get(`${role}:${locale}`) ?? this.eng.nameOf(ev.roles[role], locale)
      const v = this.eng.world.view(ev.roles[role])?.props[key]
      return v === undefined ? '?' : String(v)
    })
  }

  run(rule: Rule, ev: GameEvent): void {
    const outer = this.names
    if (rule.do.some((e) => e.op === 'log' || e.op === 'say')) {
      this.names = new Map()
      for (const role of ['actor', 'target', 'instrument'] as const)
        if (ev.roles[role]) for (const l of ['en', 'zh'] as const) this.names.set(`${role}:${l}`, this.eng.nameOf(ev.roles[role], l))
    }
    try {
      for (const eff of rule.do) {
        try {
          this.apply(eff, ev)
        } catch (err) {
          this.eng.world.fx.push({ t: 'log', text: `rule ${rule.id}: ${(err as Error).message}`, tone: 'warn' })
        }
      }
    } finally {
      this.names = outer
    }
  }

  apply(eff: Effect, ev: GameEvent): void {
    const eng = this.eng
    const w = eng.world
    switch (eff.op) {
      case 'spawn': {
        const type = this.typeOf(ev, eff.type)
        if (!type) return
        const at = this.ref(ev, eff.at)
        const into = eff.into ?? 'tile'
        const n = eff.count === undefined ? 1 : Math.max(0, Math.floor(this.amount(ev, eff.count)))
        for (let i = 0; i < n; i++) {
          const place = this.placeFor(at, into)
          if (!place) continue
          const made = w.create(type, place)
          // an item a rule drops on the ground pops out for the player's magnet
          if (place.on === 'tile' && w.kindOf(made) === 'item') made.dropped = true
        }
        return
      }
      case 'destroy': {
        const e = this.entity(ev, eff.of)
        if (e && e.id !== w.state.player) w.destroy(e)
        return
      }
      case 'transform': {
        const e = this.entity(ev, eff.of)
        if (!e) return
        // `@prop:key` reads the target type from the entity's own prop (e.g. emptyType)
        const into = eff.into.startsWith('@prop:') ? String(w.prop(e, eff.into.slice(6)) ?? '') : eff.into
        if (!into || !w.onto.hasType(into)) return
        e.type = into
        delete e.name
        return
      }
      case 'moveTo': {
        const e = this.entity(ev, eff.of)
        const place = this.placeFor(this.ref(ev, eff.to), eff.into ?? 'tile', e?.id)
        if (e && place) w.place(e, place)
        return
      }
      case 'addStatus': {
        const r = this.ref(ev, eff.of)
        if (r) eng.applyStatus(r, eff.status, eff.duration)
        return
      }
      case 'removeStatus': {
        const r = this.ref(ev, eff.of)
        if (r) w.clearStatus(r, eff.status)
        return
      }
      case 'setProp': {
        const e = this.entity(ev, eff.of)
        if (e) (e.props ??= {})[eff.key] = eff.value
        return
      }
      case 'addProp': {
        const e = this.entity(ev, eff.of)
        if (!e) return
        let v = w.num(e, eff.key) + eff.delta
        if (eff.min !== undefined) v = Math.max(eff.min, v)
        if (eff.max !== undefined) v = Math.min(eff.max, v)
        ;(e.props ??= {})[eff.key] = v
        return
      }
      case 'addTag': {
        const e = this.entity(ev, eff.of)
        if (e && !e.tags?.includes(eff.tag)) (e.tags ??= []).push(eff.tag)
        return
      }
      case 'removeTag': {
        const e = this.entity(ev, eff.of)
        if (e?.tags) e.tags = e.tags.filter((t) => t !== eff.tag)
        return
      }
      case 'damage': {
        const e = this.entity(ev, eff.of)
        if (e) eng.damage(e, this.amount(ev, eff.amount) * (eff.mul ?? 1), eff.element, eff.pierce, ev.roles.actor)
        return
      }
      case 'heal': {
        const e = this.entity(ev, eff.of)
        if (!e) return
        const hp = Math.min(w.num(e, 'maxHp', 1), w.num(e, 'hp') + this.amount(ev, eff.amount))
        ;(e.props ??= {}).hp = hp
        w.fx.push({ t: 'damage', who: e.id, amount: -this.amount(ev, eff.amount) })
        return
      }
      case 'setTerrain': {
        const p = this.pos(ev, eff.of)
        if (p) w.setTerrain(p.map, p.x, p.y, eff.terrain)
        return
      }
      case 'spread': {
        const c = this.pos(ev, eff.from)
        if (!c) return
        for (let dy = -eff.radius; dy <= eff.radius; dy++)
          for (let dx = -eff.radius; dx <= eff.radius; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > eff.radius || (dx === 0 && dy === 0)) continue
            const x = c.x + dx
            const y = c.y + dy
            if (!w.inBounds(c.map, x, y)) continue
            const tileRef: Ref = { tile: { map: c.map, x, y } }
            const refs: Ref[] = [tileRef, ...w.entitiesAt(c.map, x, y).map((e) => ({ e: e.id }))]
            for (const r of refs) {
              const v = w.view(r)
              if (!v || !matchSelector(eff.filter, v)) continue
              if (eff.chance !== undefined && w.rand() >= eff.chance) continue
              if (eff.status) eng.applyStatus(r, eff.status)
              if (eff.hit && v.kind === 'actor')
                eng.queue({ kind: 'hit', roles: { actor: ev.roles.actor, target: r }, element: eff.hit.element, power: eff.hit.power })
            }
          }
        return
      }
      case 'hit': {
        const r = this.ref(ev, eff.of)
        if (r)
          eng.queue({
            kind: 'hit',
            roles: { actor: eff.by ? this.ref(ev, eff.by) : ev.roles.actor, target: r },
            element: eff.element,
            power: this.amount(ev, eff.power),
          })
        return
      }
      case 'push': {
        const e = this.entity(ev, eff.of)
        const from = this.pos(ev, eff.away)
        const p = w.posOf(e)
        if (!e || !from || !p || e.place.on !== 'tile') return
        const dx = Math.sign(p.x - from.x)
        const dy = dx === 0 ? Math.sign(p.y - from.y) || 1 : 0
        let x = p.x
        let y = p.y
        for (let i = 0; i < eff.tiles; i++) {
          if (!w.walkable(p.map, x + dx, y + dy, e.id)) break
          x += dx
          y += dy
        }
        if (x !== p.x || y !== p.y) w.place(e, { on: 'tile', map: p.map, x, y })
        return
      }
      case 'vfx': {
        const p = this.pos(ev, eff.at)
        if (p) w.fx.push({ t: 'vfx', fx: eff.fx, map: p.map, x: p.x, y: p.y })
        return
      }
      case 'say': {
        const who = this.entity(ev, eff.who)
        if (!who) return
        // a person with a line book says the line for this moment (people.ts)
        const line = eff.text === '@line' && who.npc?.person?.lines?.length ? chooseLine(this.eng, who) : undefined
        if (line) w.fx.push({ t: 'say', who: who.id, text: line.text, mood: line.mood })
        else w.fx.push({ t: 'say', who: who.id, text: this.text(ev, who, eff.text) })
        return
      }
      case 'log':
        w.fx.push({ t: 'log', text: this.text(ev, undefined, eff.text) })
        return
      case 'open': {
        const r = this.ref(ev, eff.of)
        if (!r) return
        if (w.hasStatus(r, 'open')) w.clearStatus(r, 'open')
        else w.setStatus(r, 'open', NO_EXPIRY)
        return
      }
      case 'dropContents': {
        const e = this.entity(ev, eff.of)
        const p = w.posOf(e)
        if (!e || !p) return
        for (const id of [...(e.contents ?? [])]) {
          const c = w.get(id)
          if (c) (w.place(c, { on: 'tile', map: p.map, x: p.x, y: p.y }), (c.dropped = true))
        }
        return
      }
      case 'setFact':
        w.setFact(eff.key, eff.value)
        return
      case 'addFact':
        w.setFact(eff.key, (Number(w.fact(eff.key)) || 0) + eff.delta)
        return
      case 'topic':
        raiseTopic(eng, eff.id, eff.days)
        return
      case 'befriend': {
        const who = this.entity(ev, eff.who)
        if (!who?.npc) return
        const mem = memoryOf(eng, who.id)
        const day = w.calendar().day
        if (eff.daily && mem.talked === day) return
        if (mem.talked === undefined) w.setFact(`met.${who.id}`, true)
        if (eff.daily) mem.talked = day
        befriend(eng, who.id, eff.amount)
        return
      }
      case 'gift': {
        const to = this.entity(ev, eff.to)
        const item = this.entity(ev, eff.item)
        if (!to || !item) return
        if (!to.npc) {
          w.place(item, { on: 'inside', holder: to.id })
          return
        }
        const r = giveGift(eng, to, item)
        if (r.taste !== 'limit') w.place(item, { on: 'inside', holder: to.id })
        const line = to.npc.person?.lines?.length ? chooseLine(eng, to, { gift: { taste: r.taste, item } }) : undefined
        w.fx.push({ t: 'say', who: to.id, text: line?.text ?? GIFT_LINES[r.taste], mood: line?.mood ?? MOOD_OF[r.taste] })
        if (r.taste === 'loved') w.fx.push({ t: 'emote', who: to.id, mood: 'happy' })
        return
      }
      case 'sleep':
        eng.sleep()
        return
      case 'mail':
        eng.deliver(eff.id)
        return
      case 'scene':
        eng.scenes.start(eff.id)
        return
    }
  }

  /** A type named outright, or read from a role's prop: `@prop:target.yieldType`. */
  private typeOf(ev: GameEvent, type: string): string | undefined {
    const m = /^@prop:(actor|target|instrument)\.(\w+)$/.exec(type)
    if (!m) return type
    const v = this.eng.world.view(ev.roles[m[1] as 'actor'])?.props[m[2]]
    return typeof v === 'string' && this.eng.world.onto.hasType(v) ? v : undefined
  }

  /** Where `into` lands relative to a role: its tile, its contents, or its hand. */
  private placeFor(at: Ref | undefined, into: 'tile' | 'contents' | 'hand', moving?: string): Place | undefined {
    const w = this.eng.world
    if (!at) return undefined
    if (into === 'tile' || 'tile' in at) {
      const p = w.refPos(at)
      return p ? { on: 'tile', map: p.map, x: p.x, y: p.y } : undefined
    }
    const holder = w.get(at.e)
    if (!holder) return undefined
    if (into === 'hand' && (!holder.held || holder.held === moving)) return { on: 'hand', holder: holder.id }
    return { on: 'inside', holder: holder.id }
  }
}
