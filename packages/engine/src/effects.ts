// The fixed, typed set of effect primitives (design.md §6.1). Every primitive writes only the
// rule's host, spawns, or presents; `emit` sends an event to others, which answer for
// themselves. New behaviour is data (rules); only a new primitive is an engine change.

import type { Engine } from './engine.ts'
import { matchSelector } from './rules.ts'
import type { AiData, Amount, Effect, EmitTo, Entity, GameEvent, Impulse, Place, Pos, PropValue, Ref, RoleName, RoleRef, Text } from './types.ts'
import { GIVEN_LINE, chooseLine, raiseTopic } from './people.ts'
import { TICKS_PER_HOUR } from './calendar.ts'
import { gainXp, learnSkill } from './progression.ts'
import { cannotChoose, chooseProfession } from './profession.ts'
import { forageMap } from './forage.ts'
import { appear } from './nightspawn.ts'
import { releaseSkill } from './bosses.ts'
import { WriteError } from './world.ts'

export const PRIMITIVES: Record<Effect['op'], string> = {
  spawn: 'spawn {type, at: role ref, into?: tile|contents|hand, count?, still?} — create new things at a role\'s place (its tile, contents or hand); type may be "@prop:<role>.<key>" (a crop\'s yieldType); count may read a prop or a param; items on the ground pop out for the magnet unless still (then they are taken with F)',
  destroy: 'destroy {} — the host is gone (with what it holds); the essential (people) never are: they go down instead',
  transform: 'transform {into} — the host becomes another type ("@prop:key" reads the type from its own prop, e.g. emptyType). A cell is made of things (tile/<terrain>: the floor, what roots in the soil, what fills the volume): water becoming ice is the water transforming; becoming a type whose space in its cell another thing holds (rock into gravel, where a floor is), the host is gone instead',
  move: 'move {to: role ref, into?: tile|contents|hand} — the host moves itself to a role\'s tile, contents or hand',
  step: 'step {dir?} — the host steps one tile (dir, or the act\'s `dir` param): walls and the solid stop it (a bump), portals carry it',
  addStatus: 'addStatus {status, duration?} — the host gains a status (a threshold/gain event follows)',
  removeStatus: 'removeStatus {status} — the host loses a status (threshold/lose)',
  setProp: 'setProp {key, value}',
  addProp: 'addProp {key, delta, min?, max?} — delta and max are Amounts',
  addTag: 'addTag {tag}',
  removeTag: 'removeTag {tag}',
  hurt: 'hurt {amount, element?, pierce?} — the host loses health (its defence applies unless pierce); at none, threshold/cross "defeated"',
  heal: 'heal {amount}',
  feed: 'feed {amount} — the host\'s hunger rises by amount, up to its maxHunger',
  gainXp: 'gainXp {amount} — the host gains experience; enough raises its level (props xp, level, skillPoints)',
  foe: 'foe {} — whoever started the chain (the one who struck) becomes the host\'s foe, attacked on sight',
  open: 'open {} — the host opens or closes (toggles the `open` status)',
  dropContents: 'dropContents {still?} — the host spills what it holds onto its tile',
  goto: 'goto {anchor, hours, activity?} — the host (a person) leaves its schedule for a named anchor of its map for some hours',
  topic: "topic {id, days?} — the story's only: something happened that people will talk about (default 4 days); it keeps topic.<id> (the day) and topic.<id>.days as its own props. Others notify the story",
  scene: 'scene {id} — the story\'s only: play a scripted scene',
  craft: 'craft {} — the host uses up what the act\'s recipe needs from what it carries and gets what it makes',
  forage: 'forage {} — the world\'s: what the active map yields by itself appears on its ground',
  lightning: 'lightning {power} — the world\'s: a bolt seeks what stands tall near the player and emits element lightning to it',
  ashore: 'ashore {} — the host gets out of where it cannot be, to the nearest free tile',
  fallback: 'fallback {} — the story\'s: run the broken invariant\'s authored fallback',
  emit: 'emit {impulse, to, params?, item?, other?, chance?, filter?} — send an impulse (strike, element, coat, restore, push, taken, receive, offered, handle, notify) to a role, "story", "world", {named: id}, {area: {at?, radius}}, {line: {from?, away, length, over?}} or {map: true}; params are values, Amounts or {typeOf: role} (what kind of thing a role is, kept even after it is gone); filter and chance pick who receives it; the receiver answers for itself',
  vfx: 'vfx {at?, fx} — play a visual effect (at the host unless at names a role)',
  say: 'say {text, who?} — the host says a line ("@line": one of its own lines for the moment; "@given": its line for the item it was given); text fills {host} {actor} {target} {instrument} {other} {item} and {role.key}',
  log: 'log {text} — a message line ({role} = names, {role.key} = that role\'s prop, {param.key} = an event param)',
  emote: 'emote {mood: neutral|happy|sad|angry|surprised|shy} — an emote bubble over the host',
  quest: 'quest {} — the host (a person) is spoken to about quests: business with the speaker (a quest to hand in, to take on, a talk goal) is told to the story; else the host says how a quest goes, or its line (quests.ts)',
  quests: "quests {} — the story's: a quest's business it is told of is settled (notify what = quest: between the source, a giver, and the actor; what = defeat: the actor felled a thing of param type) — its facts change, the giver takes what was brought, the taker is told its reward",
  learn: 'learn {} — the host learns what its act names: param skill (spending its skill points) or param profession (at a trainer; a change gives back the profession branch)',
  appear: "appear {types, ring, cap, tag} — the world's: one creature of a weighted type appears on a free tile ring[0]–ring[1] tiles from the player, under the open sky of a map that is not peaceful, unless cap of those tagged tag already walk it",
  release: "release {} — the host's encounter skill lands on the cells its act telegraphed (params skill, ox, oy, ax, ay): a strike to each foe there, a push or pull and a coat as the skill says; the host heals or blinks itself",
  panel: "panel {panel} — the host (a trainer) opens one of the player's panels when the player spoke to it: 'profession'",
}

/** Primitives only the story's and the world's rules may use. */
export const RESIDENT_ONLY = new Set<Effect['op']>(['topic', 'scene', 'forage', 'lightning', 'fallback', 'quests', 'appear'])

export class EffectRunner {
  constructor(private eng: Engine) {}

  private ref(ev: GameEvent, r: RoleRef): Ref | undefined {
    const w = this.eng.world
    // the cell under a role: what makes it up on top
    if (r.startsWith('tileOf:')) {
      const p = w.refPos(this.roleRef(ev, r.slice(7) as RoleName))
      const top = p && w.cellTop(p.map, p.x, p.y)
      return top ? { e: top.id } : undefined
    }
    return this.roleRef(ev, r as RoleName)
  }

  private roleRef(ev: GameEvent, r: RoleName): Ref | undefined {
    return r === 'host' ? ev.host : ev.roles[r]
  }

  private hostEntity(ev: GameEvent): Entity | undefined {
    return 'e' in ev.host ? this.eng.world.get(ev.host.e) : undefined
  }

  private pos(ev: GameEvent, r: RoleRef): Pos | undefined {
    return this.eng.world.refPos(this.ref(ev, r))
  }

  amount(ev: GameEvent, a: Amount): number {
    if (typeof a === 'number') return a
    if ('param' in a) {
      const v = ev.params?.[a.param]
      return (typeof v === 'number' ? v : 0) * (a.mul ?? 1) + (a.add ?? 0)
    }
    const v = this.eng.world.view(this.roleRef(ev, a.of))
    const base = Number(v?.props[a.prop] ?? 0)
    return base * (a.mul ?? 1) + (a.add ?? 0)
  }

  private text(ev: GameEvent, who: Entity | undefined, t: Text): Text {
    // a companion repeats the latest beat's line (companion.ts)
    if (t === '@hint') return this.eng.companions.hint() ?? { en: '…', zh: '……' }
    // what the story asks for now (the companion's guide)
    if (t === '@objective') return this.eng.companions.objective() ?? { en: 'Nothing presses now. Go where you like!', zh: '现在没什么急事。想去哪就去哪吧！' }
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

  /** Role names as they were when the outcome started (set by run). */
  private names?: Map<string, string>

  /**
   * Fill {host} {actor} {target} {instrument} {other} {item} {source} with display names,
   * {role.key} with a prop and {param.key} with an event parameter. Names are the ones the roles
   * had when the outcome started: "you pour out {instrument}" reads right after it was emptied.
   */
  private fill(ev: GameEvent, s: string, locale: 'en' | 'zh' = 'en'): string {
    return s.replace(/\{(host|actor|target|instrument|other|item|source|param)(?:\.(\w+))?\}/g, (_, role: RoleName | 'param', key?: string) => {
      if (role === 'param') return key && ev.params?.[key] !== undefined ? String(ev.params[key]) : '?'
      if (!key) return this.names?.get(`${role}:${locale}`) ?? this.eng.nameOf(this.roleRef(ev, role), locale)
      const v = this.eng.world.view(this.roleRef(ev, role))?.props[key]
      return v === undefined ? '?' : String(v)
    })
  }

  /** Run an outcome's effects on its event (the rule id names it in warnings). */
  run(effects: Effect[], ev: GameEvent, ruleId = '?'): void {
    const outer = this.names
    if (effects.some((e) => e.op === 'log' || e.op === 'say')) {
      this.names = new Map()
      for (const role of ['host', 'actor', 'target', 'instrument', 'other', 'item', 'source'] as RoleName[]) {
        const r = this.roleRef(ev, role)
        if (r) for (const l of ['en', 'zh'] as const) this.names.set(`${role}:${l}`, this.eng.nameOf(r, l))
      }
    }
    try {
      for (const eff of effects) {
        try {
          this.apply(eff, ev)
        } catch (err) {
          // a write outside an outcome or beyond its host is the engine's bug, not the rule's: it is not swallowed
          if (err instanceof WriteError) throw err
          this.eng.world.fx.push({ t: 'log', text: `rule ${ruleId}: ${(err as Error).message}`, tone: 'warn' })
        }
      }
    } finally {
      this.names = outer
    }
  }

  apply(eff: Effect, ev: GameEvent): void {
    const eng = this.eng
    const w = eng.world
    const host = this.hostEntity(ev)
    if (RESIDENT_ONLY.has(eff.op) && (!host || !w.isPlaceless(host))) throw new Error(`${eff.op} is the story's and the world's only`)
    switch (eff.op) {
      case 'spawn': {
        const type = this.typeOf(ev, eff.type)
        if (!type) return
        const at = this.ref(ev, eff.at)
        const into = eff.into ?? 'tile'
        const n = eff.count === undefined ? 1 : Math.max(0, Math.floor(this.amount(ev, eff.count)))
        for (let i = 0; i < n; i++) {
          let place = this.placeFor(at, into)
          if (!place) continue
          const made = w.create(type, place)
          // an actor never appears on top of another, or in a wall: it takes the nearest free tile
          if (place.on === 'tile' && w.isAgent(made) && !w.walkable(place.map, place.x, place.y, made.id)) {
            const free = eng.nearestFree({ map: place.map, x: place.x, y: place.y })
            if (free) w.place(made, (place = { on: 'tile', map: free.map, x: free.x, y: free.y }))
          }
          // a creature a rule brings (a dragon's whelps) comes with the behaviour its type names, at home where it appears
          if (place.on === 'tile' && w.isAgent(made) && w.hasTag(made, 'creature') && !made.ai) {
            const behaviour = (w.prop(made, 'behaviour') as AiData['behaviour'] | undefined) ?? 'melee'
            const temper = (w.prop(made, 'temper') as AiData['temper'] | undefined) ?? 'aggressive'
            made.facing = 'down'
            made.ai = { behaviour, temper, sight: w.num(made, 'sight', 6), home: { map: place.map, x: place.x, y: place.y } }
          }
          eng.touch({ e: made.id })
          // an item a rule drops on the ground pops out for the player's magnet (unless it lies still: taken with F)
          if (place.on === 'tile' && w.isPortable(made) && !eff.still) made.dropped = true
        }
        return
      }
      case 'destroy': {
        if (!host) return
        // the essential (people, the player) are never removed: they go down and come to
        if (w.hasTag(host, 'essential')) return
        eng.touch({ e: host.id }, true)
        w.destroy(host)
        return
      }
      case 'transform': {
        if (!host) return
        // `@prop:key` reads the target type from the host's own prop (e.g. emptyType)
        const into = eff.into.startsWith('@prop:') ? String(w.prop(host, eff.into.slice(6)) ?? '') : eff.into
        if (!into || !w.onto.hasType(into)) return
        // becoming a thing that takes a space of its cell another holds, it gives way: it is gone (rock
        // turning to gravel where there is a floor already), as one destroyed
        const p = host.place.on === 'tile' ? host.place : undefined
        const taken = p && w.spacesOf({ ...host, type: into }).some((s) => w.entitiesAt(p.map, p.x, p.y).some((o) => o.id !== host.id && w.spacesOf(o).includes(s)))
        if (taken) {
          if (w.hasTag(host, 'essential')) return
          eng.touch({ e: host.id }, true)
          w.destroy(host)
          return
        }
        w.transform(host, into)
        delete host.name
        eng.touch({ e: host.id })
        return
      }
      case 'move': {
        if (!host) return
        const place = this.placeFor(this.ref(ev, eff.to), eff.into ?? 'tile', host.id)
        if (!place) return
        eng.touch({ e: host.id })
        w.place(host, place)
        delete host.dropped
        eng.touch({ e: host.id })
        return
      }
      case 'step': {
        if (!host) return
        // a step to a place (a scene's direction, a person arriving through a portal), or one tile
        const p = ev.params
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return eng.placeSelf(host, { map: String(p.map ?? w.posOf(host)?.map ?? eng.activeMap), x: p.x, y: p.y })
        let dir = eff.dir ?? (p?.dir as Entity['facing'])
        // away from a role (a gust from the one who cast it)
        const from = eff.away && this.pos(ev, eff.away)
        const at = w.posOf(host)
        if (from && at) {
          const dx = at.x - from.x
          const dy = at.y - from.y
          dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
        }
        if (dir) for (let i = 0; i < (eff.tiles ?? 1); i++) if (!eng.stepSelf(host, dir, ev)) break
        return
      }
      case 'ashore': {
        const p = w.posOf(host)
        if (!host || !p || host.place.on !== 'tile') return
        const free = eng.nearestFree(p)
        if (!free) return
        eng.touch({ e: host.id })
        w.place(host, { on: 'tile', ...free })
        eng.touch({ e: host.id })
        return
      }
      case 'addStatus': {
        // who gave it: the act's doer, or whoever started the chain (a fire one set burns in their name)
        const by = ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : ev.cause
        return eng.applyStatus(ev.host, eff.status, eff.duration, by)
      }
      case 'removeStatus':
        return eng.removeStatus(ev.host, eff.status)
      case 'setProp': {
        if (!host) return
        const v = typeof eff.value === 'object' && eff.value !== null ? ev.params?.[eff.value.param] : eff.value
        if (v !== undefined) eng.setProp(host, eff.key, v, ev)
        return
      }
      case 'addProp': {
        if (!host) return
        let v = w.num(host, eff.key) + this.amount(ev, eff.delta)
        if (eff.min !== undefined) v = Math.max(eff.min, v)
        if (eff.max !== undefined) v = Math.min(this.amount(ev, eff.max), v)
        eng.setProp(host, eff.key, v, ev)
        return
      }
      case 'addTag':
        if (host) w.addTag(host, eff.tag)
        return
      case 'removeTag':
        if (host) w.removeTag(host, eff.tag)
        return
      case 'hurt':
        if (host) eng.hurt(host, this.amount(ev, eff.amount), eff.element, eff.pierce, ev)
        return
      case 'heal': {
        if (!host) return
        // whole points: a tenth of a body mends at least one
        const n = Math.ceil(this.amount(ev, eff.amount))
        eng.setProp(host, 'hp', Math.min(w.num(host, 'maxHp', 1), w.num(host, 'hp') + n), ev)
        w.fx.push({ t: 'damage', who: host.id, amount: -n })
        return
      }
      case 'feed': {
        // Hearty Meals (the skill): food fills half as much again
        const max = host ? w.num(host, 'maxHunger') : 0
        if (!host || max <= 0) return
        eng.setProp(host, 'hunger', Math.max(0, Math.min(max, Math.round(w.num(host, 'hunger', max) + this.amount(ev, eff.amount) * (w.hasTag(host, 'skill:hearty-meals') ? 1.5 : 1)))), ev)
        return
      }
      case 'gainXp': {
        // a thing that has a level can learn (any thing with the prop, not only people)
        if (!host || w.prop(host, 'level') === undefined) return
        const n = Math.round(this.amount(ev, eff.amount))
        if (n <= 0) return
        const up = gainXp(w, host, n)
        if (host.id !== w.state.player) return
        w.fx.push({ t: 'log', text: { en: `+${n} XP`, zh: `+${n} 经验` }, tone: 'good' })
        if (up) {
          w.fx.push({ t: 'levelup', level: w.num(host, 'level', 1) })
          const p = w.posOf(host)
          if (p) w.fx.push({ t: 'vfx', fx: 'sparkle', map: p.map, x: p.x, y: p.y })
        }
        return
      }
      case 'foe': {
        const by = ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : ev.cause
        if (!host?.ai || !by || by === host.id || !w.get(by)) return
        const foes = (host.ai.foes ??= [])
        if (!foes.includes(by)) foes.push(by)
        return
      }
      case 'open':
        if (w.hasStatus(ev.host, 'open')) eng.removeStatus(ev.host, 'open')
        else eng.applyStatus(ev.host, 'open')
        return
      case 'dropContents': {
        const p = w.posOf(host)
        if (!host || !p) return
        for (const id of [...(host.contents ?? [])]) {
          const c = w.get(id)
          if (!c) continue
          eng.touch({ e: c.id })
          w.place(c, { on: 'tile', map: p.map, x: p.x, y: p.y })
          eng.touch({ e: c.id })
          if (!eff.still) c.dropped = true
        }
        return
      }
      case 'goto': {
        const p = w.posOf(host)
        const a = p && w.map(p.map)?.anchors?.[eff.anchor]
        if (!host?.npc || !p || !a) return
        const hours = Math.max(0.1, Math.min(12, eff.hours))
        host.npc.override = { map: p.map, x: a[0], y: a[1], until: w.state.tick + Math.round(hours * TICKS_PER_HOUR), activity: eff.activity ?? eff.anchor }
        return
      }
      case 'topic': {
        const id = this.str(ev, eff.id)
        if (id && host) raiseTopic(eng, host, id, eff.days ?? (typeof ev.params?.days === 'number' ? ev.params.days : undefined))
        return
      }
      case 'quest': {
        // the host is spoken to; the one speaking is the act's actor (quests.ts): the story settles their business
        const a = ev.roles.actor
        const who = a && 'e' in a ? w.get(a.e) : undefined
        const business = host && who ? eng.quests.business(host.id, who) : undefined
        if (business === 'story')
          eng.queue({ kind: 'impulse/notify', host: { e: 'story' }, roles: { actor: a, source: ev.host }, params: { what: 'quest' }, cause: ev.cause, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
        else this.apply({ op: 'say', text: business ?? '@line' }, ev)
        return
      }
      case 'quests':
        eng.quests.settle(ev)
        return
      case 'learn': {
        // the host's own: its tags, props and points; a profession's starter weapon is made in its bag
        if (!host) return
        const skill = eng.skills.get(String(ev.params?.skill ?? ''))
        if (skill) {
          learnSkill(w, host, skill)
          return
        }
        const prof = eng.professions.get(String(ev.params?.profession ?? ''))
        if (!prof || cannotChoose(w, host, prof)) return
        const before = new Set(host.contents ?? [])
        chooseProfession(w, host, prof, [...eng.skills.values()])
        for (const id of host.contents ?? []) if (!before.has(id)) eng.touch({ e: id })
        return
      }
      case 'appear':
        appear(eng, eff)
        return
      case 'release':
        if (host) releaseSkill(eng, host, ev)
        return
      case 'panel': {
        // a panel is the player's: only when the player is the one who spoke
        const a = ev.roles.actor
        if (host && a && 'e' in a && a.e === w.state.player) w.fx.push({ t: 'panel', panel: eff.panel, by: host.id })
        return
      }
      case 'scene':
        eng.scenes.start(eff.id)
        return
      case 'fallback': {
        const inv = eng.invariants.find((i) => i.id === ev.params?.invariant)
        if (inv?.fallback?.length) this.run(inv.fallback, ev, `invariant/${inv.id}`)
        return
      }
      case 'craft': {
        const r = eng.recipes.get(String(ev.params?.recipe ?? ''))
        if (!host || !r) return
        const carried = [...(host.contents ?? []), ...(host.held ? [host.held] : [])].map((id) => w.get(id)!).filter(Boolean)
        if (!r.needs.every((n) => carried.filter((e) => e.type === n.type && !e.frozenBy).length >= n.count)) return
        for (const n of r.needs) {
          // the bag's first: the hand keeps what it holds while there are others of its kind
          const pool = carried.filter((e) => e.type === n.type && !e.frozenBy).sort((a, b) => Number(a.id === host.held) - Number(b.id === host.held))
          for (const e of pool.slice(0, n.count)) {
            eng.touch({ e: e.id }, true)
            w.destroy(e)
          }
        }
        const made = w.create(r.make.type, { on: 'inside', holder: host.id }, structuredClone(r.make))
        eng.touch({ e: made.id })
        const p = w.posOf(host)
        if (p) w.fx.push({ t: 'pickup', item: made.id, sprite: r.sprite, name: r.name, map: p.map, x: p.x, y: p.y })
        return
      }
      case 'forage':
        forageMap(eng, eng.activeMap)
        return
      case 'lightning':
        eng.lightning(eff.power, ev)
        return
      case 'emit':
        return this.emit(eff, ev)
      case 'vfx': {
        const p = this.pos(ev, eff.at ?? 'host')
        if (p) w.fx.push({ t: 'vfx', fx: eff.fx, map: p.map, x: p.x, y: p.y })
        return
      }
      case 'say': {
        const ref = eff.who && host && w.isPlaceless(host) ? this.roleRef(ev, eff.who) : ev.host
        const who = ref && 'e' in ref ? w.get(ref.e) : undefined
        if (!who) return
        if (eff.text === '@given') {
          const item = ev.roles.item && 'e' in ev.roles.item ? w.get(ev.roles.item.e) : undefined
          const line = who.npc?.person?.lines?.length && item ? chooseLine(eng, who, { given: item, record: who.id === host?.id }) : undefined
          w.fx.push({ t: 'say', who: who.id, text: line?.text ?? GIVEN_LINE, mood: line?.mood })
          return
        }
        // a person with a line book says the line for this moment (people.ts)
        const line = eff.text === '@line' && who.npc?.person?.lines?.length ? chooseLine(eng, who, { record: who.id === host?.id }) : undefined
        if (line) w.fx.push({ t: 'say', who: who.id, text: line.text, mood: line.mood })
        else w.fx.push({ t: 'say', who: who.id, text: this.text(ev, who, eff.text) })
        return
      }
      case 'log':
        w.fx.push({ t: 'log', text: this.text(ev, undefined, eff.text) })
        return
      case 'emote':
        if (host) w.fx.push({ t: 'emote', who: host.id, mood: eff.mood })
        return
    }
  }

  /** Send an impulse to its receivers; each answers for itself (design.md §5.8). */
  private emit(eff: Extract<Effect, { op: 'emit' }>, ev: GameEvent): void {
    const eng = this.eng
    const w = eng.world
    const params: Record<string, PropValue> = {}
    for (const [k, v] of Object.entries(eff.params ?? {})) {
      const x = this.param(ev, v)
      if (x !== undefined) params[k] = x
    }
    const item = eff.item ? this.roleRef(ev, eff.item) : undefined
    const other = eff.other ? this.roleRef(ev, eff.other) : undefined
    for (const to of this.receivers(eff.to, ev)) {
      const v = w.view(to)
      if (!v || (eff.filter && !matchSelector(eff.filter, v))) continue
      if (eff.chance !== undefined && w.rand() >= eff.chance) continue
      eng.queue({
        kind: `impulse/${eff.impulse as Impulse}`,
        host: to,
        roles: {
          source: ev.host,
          actor: ev.roles.actor ?? (ev.cause ? { e: ev.cause } : undefined),
          instrument: ev.roles.instrument,
          item,
          other,
        },
        params,
        cause: ev.cause,
        origin: ev.origin,
        depth: (ev.depth ?? 0) + 1,
      })
    }
  }

  /** An emitted param: a value, an Amount, a param passed on as it is (`{param}` alone: a string goes through), or what kind of thing a role is. */
  param(ev: GameEvent, v: PropValue | Amount | { typeOf: RoleName }): PropValue | undefined {
    if (typeof v !== 'object' || v === null) return v
    if ('typeOf' in v) return this.eng.world.view(this.roleRef(ev, v.typeOf))?.type
    if ('param' in v && v.mul === undefined && v.add === undefined) return ev.params?.[v.param]
    return this.amount(ev, v)
  }

  /** A string field that may read an event param: `@param:key`. */
  str(ev: GameEvent, s: string): string {
    return s.startsWith('@param:') ? String(ev.params?.[s.slice(7)] ?? '') : s
  }

  /** Who an emission reaches: a role, a resident, a named thing, or a place of the host's map. */
  private receivers(to: EmitTo, ev: GameEvent): Ref[] {
    const eng = this.eng
    const w = eng.world
    if (typeof to === 'string') {
      if (to === 'story' || to === 'world') return w.get(to) ? [{ e: to }] : []
      const r = this.ref(ev, to)
      return r ? [r] : []
    }
    if ('named' in to) return w.get(to.named) ? [{ e: to.named }] : []
    const self = (r: Ref) => r.e === ev.host.e
    // every thing in a cell: what stands there and what makes it up, top first
    const at = (map: string, x: number, y: number): Ref[] => (w.inBounds(map, x, y) ? w.entitiesAt(map, x, y).sort((a, b) => w.cellRank(b) - w.cellRank(a)).map((e) => ({ e: e.id })) : [])
    if ('map' in to) {
      const p = w.posOf(this.hostEntity(ev))
      const map = p?.map ?? eng.activeMap
      return w.entitiesOnMap(map).filter((e) => !self({ e: e.id })).map((e) => ({ e: e.id }))
    }
    if ('area' in to) {
      const c = this.pos(ev, to.area.at ?? 'host')
      if (!c) return []
      const out: Ref[] = []
      const r = Math.min(3, to.area.radius)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r && (dx || dy)) out.push(...at(c.map, c.x + dx, c.y + dy))
      return out.filter((x) => !self(x))
    }
    // a line from beyond `from`, away from `away` (a felled tree falls away from the axe)
    const from = this.pos(ev, to.line.from ?? 'host')
    const away = this.pos(ev, to.line.away)
    if (!from || !away || from.map !== away.map) return []
    const dx = Math.sign(from.x - away.x)
    const dy = dx === 0 ? Math.sign(from.y - away.y) : 0
    if (!dx && !dy) return []
    const out: Ref[] = []
    for (let i = 1; i <= Math.min(8, to.line.length); i++) {
      const x = from.x + dx * i
      const y = from.y + dy * i
      if (!w.inBounds(from.map, x, y)) break
      const tags = w.onto.terrain(w.terrainAt(from.map, x, y))?.tags ?? []
      if (to.line.over && !to.line.over.every((t) => tags.includes(t))) break
      out.push(...at(from.map, x, y))
    }
    return out
  }

  /** A type named outright, or read from a role's prop: `@prop:host.yieldType`. */
  private typeOf(ev: GameEvent, type: string): string | undefined {
    const m = /^@prop:(host|actor|target|instrument|other|item|source)\.(\w+)$/.exec(type)
    if (!m) return type
    const v = this.eng.world.view(this.roleRef(ev, m[1] as RoleName))?.props[m[2]]
    return typeof v === 'string' && this.eng.world.onto.hasType(v) ? v : undefined
  }

  /** Where `into` lands relative to a role: its tile, its contents, or its hand. */
  private placeFor(at: Ref | undefined, into: 'tile' | 'contents' | 'hand', moving?: string): Place | undefined {
    const w = this.eng.world
    if (!at) return undefined
    const holder = w.get(at.e)
    if (!holder) return undefined
    // onto a cell (or what makes one up: it holds nothing)
    if (into === 'tile' || w.isTerrain(holder)) {
      const p = w.posOf(holder)
      return p ? { on: 'tile', map: p.map, x: p.x, y: p.y } : undefined
    }
    if (into === 'hand' && (!holder.held || holder.held === moving)) return { on: 'hand', holder: holder.id }
    return { on: 'inside', holder: holder.id }
  }
}
