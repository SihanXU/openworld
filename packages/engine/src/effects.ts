// The fixed, typed set of effect primitives (design.md §6.1). Every primitive writes only the
// rule's host, spawns, or presents; `emit` sends an event to others, which answer for
// themselves. New behaviour is data (rules); only a new primitive is an engine change.

import type { Engine } from './engine.ts'
import { evalCond, matchSelector, rolesOf } from './rules.ts'
import type { AiData, Amount, Effect, EmitTo, Entity, GameEvent, Impulse, Place, Pos, PropValue, Ref, RoleName, RoleRef, Text } from './types.ts'
import { GIVEN_LINE, chooseLine, raiseTopic } from './people.ts'
import { TICKS_PER_HOUR } from './calendar.ts'
import { gainXp, learnSkill } from './progression.ts'
import { cannotChoose, chooseProfession } from './profession.ts'
import { appear } from './appear.ts'
import { releaseSkill } from './bosses.ts'
import { WriteError } from './world.ts'
import { madeOf, qualityFor } from './recipes.ts'

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
  hurt: 'hurt {amount, element?, pierce?, blow?} — the host loses health, or durability (hp; its defence applies unless pierce); at none, threshold/cross "broken". blow: a strike\'s — times how well the instrument (what struck, else the striker\'s own body) works on the host\'s material (the efficiency table), and nothing if the instrument is softer than it ("too hard")',
  wear: 'wear — the host (an actor) puts on the thing of its own it is offered (param item, by its slot prop: a helmet on the head), what was in that slot coming off; offered what it wears, it takes it off (world-model.md §6.8)',
  sleep: 'sleep — the host sleeps until it is time to rise (time passes at once for the one at the keys), and wakes with what it was missing given back as its room says (a bedroom: all; elsewhere: half)',
  fall: 'fall — with nothing under it on its storey, the host drops to the first floor below, struck by the drop beyond the safe height (the root of contact/end on)',
  breakdown: 'breakdown — the host breaks into what it is made of (its makeup × the world\'s recovery rate, in its material), what it holds spills out, and it is gone (the root outcome of broken for anything with a makeup)',
  heal: 'heal {amount}',
  feed: 'feed {amount} — the host\'s hunger rises by amount, up to its maxHunger',
  gainXp: 'gainXp {amount} — the host gains experience; enough raises its level (props xp, level, skillPoints)',
  foe: 'foe {} — whoever started the chain (the one who struck) becomes the host\'s foe, attacked on sight',
  open: 'open {} — the host opens or closes (toggles the `open` status)',
  dropContents: 'dropContents {still?} — the host spills what it holds (its bag and its hand) onto its tile',
  goto: 'goto {anchor, hours, activity?} — the host (a person) leaves its schedule for a named anchor of its map for some hours',
  topic: "topic {id, days?} — the story's only: something happened that people will talk about (default 4 days); it keeps topic.<id> (the day) and topic.<id>.days as its own props. Others notify the story",
  scene: 'scene {id} — the story\'s only: play a scripted scene',
  craft: 'craft {} — the host uses up what the act\'s recipe needs from what it carries and gets what it makes',
  grow: 'grow — the host\'s stage clock ran out (param status): it becomes what its stage says next and leaves what the stage yields; a condition the stage needs, unmet, makes it wait (world-model.md §6.5; the root of time/timer)',
  lightning: 'lightning {power} — the world\'s: a bolt seeks what stands tall near the player and emits element lightning to it',
  ashore: 'ashore {} — the host gets out of where it cannot be, to the nearest free tile',
  fallback: 'fallback {} — the story\'s: run the broken invariant\'s authored fallback',
  emit: 'emit {impulse, to, params?, item?, other?, chance?, filter?} — send an impulse (strike, element, coat, restore, push, taken, receive, offered, handle, notify) to a role, "story", "world", {named: id}, {area: {at?, radius}}, {line: {from?, away, length, over?}} or {map: true}; params are values, Amounts, {typeOf: role} (what kind of thing a role is, kept even after it is gone) or {idOf: role} (which thing it is); filter and chance pick who receives it; the receiver answers for itself',
  vfx: 'vfx {at?, fx} — play a visual effect (at the host unless at names a role)',
  say: 'say {text, who?} — the host says a line ("@line": one of its own lines for the moment; "@given": its line for the item it was given); text fills {host} {actor} {target} {instrument} {other} {item} and {role.key}',
  log: 'log {text} — a message line ({role} = names, {role.key} = that role\'s prop, {param.key} = an event param)',
  emote: 'emote {mood: neutral|happy|sad|angry|surprised|shy} — an emote bubble over the host',
  quest: 'quest {} — the host (a person) is spoken to about quests: business with the speaker (a quest to hand in, to take on, a talk goal) is told to the story; else the host says how a quest goes, or its line (quests.ts)',
  quests: "quests {} — the story's: a quest's business it is told of is settled (notify what = quest: between the source, a giver, and the actor; what = defeat: the actor felled a thing of param type) — its facts change, the giver takes what was brought, the taker is told its reward",
  learn: 'learn {} — the host learns what its act names: param skill (spending its skill points) or param profession (at a trainer; a change gives back the profession branch)',
  appear: "appear {what?} — the world's: what appears by itself on the active map now (the map's own appearances and the world's that fit it, each at its pace, hours and weather, up to its max), or only the appearance given (world-model.md §6.9)",
  release: "release {} — the host's encounter skill lands on the cells its act telegraphed (params skill, ox, oy, ax, ay): a strike to each foe there, a push or pull and a coat as the skill says; the host heals or blinks itself",
  panel: "panel {panel} — the host (a trainer) opens one of the player's panels when the player spoke to it: 'profession'",
}

/** Primitives only the story's and the world's rules may use. */
export const RESIDENT_ONLY = new Set<Effect['op']>(['topic', 'scene', 'lightning', 'fallback', 'quests', 'appear'])

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
    if (t === '@hint') return this.eng.story.hint() ?? { en: '…', zh: '……' }
    // what the story asks for now (the companion's guide)
    if (t === '@objective') return this.eng.story.objective() ?? { en: 'Nothing presses now. Go where you like!', zh: '现在没什么急事。想去哪就去哪吧！' }
    // a guide: what the story asks for now, else the latest beat's line
    if (t === '@guide') return this.eng.story.objective() ?? this.eng.story.hint() ?? { en: 'Nothing presses now. Go where you like!', zh: '现在没什么急事。想去哪就去哪吧！' }
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
        const taken = p && w.spacesOf({ ...host, type: into }).some((s) => w.entitiesAt(p.map, p.x, p.y, p.z ?? 0).some((o) => o.id !== host.id && w.spacesOf(o).includes(s)))
        if (taken) {
          if (w.hasTag(host, 'essential')) return
          eng.touch({ e: host.id }, true)
          w.destroy(host)
          return
        }
        w.transform(host, into)
        delete host.name
        // a thing become another is whole as what it is now (a felled tree's stump, a regrown tree)
        if (host.props?.hp !== undefined && w.onto.resolve(into).props.maxHp !== undefined) w.setProp(host, 'hp', undefined)
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
        // stairs set down go up the way the one who set them faced (away from them)
        const setter = ev.cause ? w.get(ev.cause) : undefined
        if (place.on === 'tile' && w.hasTag(host, 'stairs') && setter?.facing) host.facing = setter.facing
        eng.touch({ e: host.id })
        return
      }
      case 'step': {
        if (!host) return
        // a step to a place (a scene's direction, a person arriving through a portal), or one tile
        const p = ev.params
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return eng.placeSelf(host, { map: String(p.map ?? w.posOf(host)?.map ?? eng.activeMap), x: p.x, y: p.y })
        // to a map with no place named: in through what sent it (a site, world-model.md §5.6)
        if (typeof p?.map === 'string') return eng.enterFrom(host, p.map, ev.roles.source && w.get(ev.roles.source.e))
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
      case 'hurt': {
        // harm done in answer to an element is that element's (what resists it takes a share away)
        const element = eff.element ?? (ev.kind === 'impulse/element' && typeof ev.params?.element === 'string' ? ev.params.element : undefined)
        if (host) eng.hurt(host, this.amount(ev, eff.amount), element, eff.pierce, ev, eff.blow)
        return
      }
      case 'wear': {
        // one's own thing put on, or one held out to one (it comes to one as one takes it): worn in its slot
        // (what was there comes off), or taken off when it is on
        const item = ev.roles.item && 'e' in ev.roles.item ? w.get(ev.roles.item.e) : undefined
        const own = !!item && (item.place.on === 'inside' || item.place.on === 'hand') && item.place.holder === host?.id
        if (!host || !item || (!own && ev.kind !== 'impulse/offered')) return
        const slot = w.prop(item, 'slot')
        if (typeof slot !== 'string') return
        const key = `wear:${slot}`
        const on = w.prop(host, key) === item.id
        if (on) w.setProp(host, key, undefined)
        else eng.setProp(host, key, item.id, ev)
        w.fx.push({ t: 'log', text: on ? { en: `You take off ${eng.nameOf({ e: item.id }, 'en')}.`, zh: `你脱下了${eng.nameOf({ e: item.id }, 'zh')}。` } : { en: `You put on ${eng.nameOf({ e: item.id }, 'en')}.`, zh: `你穿上了${eng.nameOf({ e: item.id }, 'zh')}。` } })
        return
      }
      case 'sleep': {
        // until it is time to rise; what a night gives back: as much as the best room it lies in says (a bedroom all)
        if (!host) return
        const params = w.onto.data.params
        const at = w.posOf(host)
        const rest = Math.max(params?.rest ?? 0.5, ...(at ? w.regionsAt(at.map, at.x, at.y, at.z).map((r) => w.num(r, 'rest', 0)) : []))
        const missing = w.num(host, 'maxHp', 1) - w.num(host, 'hp', w.num(host, 'maxHp', 1))
        if (missing > 0) eng.setProp(host, 'hp', w.num(host, 'hp') + Math.ceil(missing * Math.min(1, rest)), ev)
        w.fx.push({ t: 'log', text: rest >= 1 ? { en: 'You sleep soundly, and wake rested.', zh: '你睡得很沉，醒来精神饱满。' } : { en: 'You sleep, after a fashion.', zh: '你勉强睡了一觉。' } })
        // the one at the keys sleeps the night through (the clock runs at once), asleep all the while:
        // lying still, and growing hungry slower (the hunger period's pace, data)
        if (host.id === w.state.player) w.setStatus({ e: host.id }, 'asleep', w.state.tick + eng.sleepUntil(params?.riseHour ?? 6))
        return
      }
      case 'fall': {
        // nothing under it on its storey: it drops to the first floor below, struck by the drop
        if (!host || host.place.on !== 'tile' || !host.place.z || w.occupant(host.place.map, host.place.x, host.place.y, 'floor', host.place.z)) return
        if (w.stanceOf(host) === 'air') return
        const { map, x, y } = host.place
        let z = host.place.z - 1
        while (z > 0 && !w.occupant(map, x, y, 'floor', z)) z--
        const levels = host.place.z - z
        eng.touch({ e: host.id })
        // the cell it lands in may be taken (a hen under the floor, a boulder): it comes down beside it
        let to = { map, x, y }
        if (w.clashesAt(map, x, y, z, w.spacesOf(host), host.id).length) to = eng.nearestFree({ map, x, y }, host) ?? to
        w.place(host, { on: 'tile', ...to, ...(z && to.x === x && to.y === y && { z }) })
        eng.touch({ e: host.id })
        eng.fallBy(host, levels, ev)
        return
      }
      case 'breakdown': {
        if (!host) return
        if (w.hasTag(host, 'essential')) return
        const at = w.posOf(host)
        const rate = w.onto.data.params?.recovery ?? 1
        const material = [...(host.tags ?? []), ...w.onto.resolve(host.type).tags].find((t) => t.startsWith('material:'))
        if (at)
          for (const part of w.onto.resolve(host.type).makeup ?? []) {
            // the expected count: whole parts, and the fraction by chance
            const expect = (part.count * (part.chance ?? 1) * rate) / (w.onto.resolve(host.type).yields ?? 1)
            const n = w.luck !== undefined ? Math.ceil(expect) : Math.floor(expect) + (w.rand() < expect - Math.floor(expect) ? 1 : 0)
            for (let i = 0; i < n; i++) {
              const made = w.create(part.type, { on: 'tile', map: at.map, x: at.x, y: at.y, ...(at.z && { z: at.z }) }, material && w.onto.resolve(part.type).tags.includes('portable') ? { tags: [material] } : {})
              eng.touch({ e: made.id })
              // it pops out for the magnet, as anything a rule drops (what a body leaves lies still: taken with F)
              if (w.isPortable(made) && !eff.still) made.dropped = true
            }
          }
        // what it held spills where it stood
        for (const id of [...(host.contents ?? []), ...(host.held ? [host.held] : [])]) {
          const c = w.get(id)
          if (!c || !at) continue
          w.place(c, { on: 'tile', map: at.map, x: at.x, y: at.y, ...(at.z && { z: at.z }) })
          eng.touch({ e: c.id })
          if (!eff.still) c.dropped = true
        }
        eng.touch({ e: host.id }, true)
        w.destroy(host)
        return
      }
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
        // what it holds: its bag, and its hand
        for (const id of [...(host.contents ?? []), ...(host.held ? [host.held] : [])]) {
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
        appear(eng, eff.what)
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
        eng.story.start(eff.id)
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
        // the tools it needs, carried (not used up)
        if (!(r.tools ?? []).every((tag) => carried.some((e) => !e.frozenBy && w.hasTag(e, tag)))) {
          w.fx.push({ t: 'log', text: { en: 'You need the right tool for that.', zh: '缺少需要的工具。' } })
          return
        }
        // a station's recipe is made beside one (a workbench within reach); the hands' anywhere
        if (r.station && r.station !== 'hands') {
          const p = w.posOf(host)
          let near = false
          for (let dy = -1; dy <= 1 && p && !near; dy++)
            for (let dx = -1; dx <= 1 && !near; dx++) near = [...w.entitiesAt(p.map, p.x + dx, p.y + dy), ...w.coveringAt(p.map, p.x + dx, p.y + dy)].some((e) => w.hasTag(e, `station:${r.station}`))
          if (!near) {
            w.fx.push({ t: 'log', text: { en: `That is made at a ${r.station}.`, zh: `这要在${r.station === 'workbench' ? '工作台' : r.station}旁边做。` } })
            return
          }
        }
        // the main ingredient (the first) gives what is made its material
        let material: string | undefined
        for (const [i, n] of r.needs.entries()) {
          // the bag's first: the hand keeps what it holds while there are others of its kind
          const pool = carried.filter((e) => e.type === n.type && !e.frozenBy).sort((a, b) => Number(a.id === host.held) - Number(b.id === host.held))
          for (const e of pool.slice(0, n.count)) {
            if (i === 0) material ??= w.materialOf(e)?.id
            eng.touch({ e: e.id }, true)
            w.destroy(e)
          }
        }
        const quality = qualityFor(w.onto.data, w.num(host, 'level', 1), r.level ?? 1)
        const look = r.make.tags || r.make.name ? r.make : madeOf(w.onto.data, w.onto, r.make.type, material, quality)
        let made = w.create(r.make.type, { on: 'inside', holder: host.id }, structuredClone(look))
        eng.touch({ e: made.id })
        for (let i = 1; i < (r.count ?? 1); i++) (made = w.create(r.make.type, { on: 'inside', holder: host.id }, structuredClone(look))), eng.touch({ e: made.id })
        const p = w.posOf(host)
        if (p) w.fx.push({ t: 'pickup', item: made.id, sprite: r.sprite, name: r.name, map: p.map, x: p.x, y: p.y })
        return
      }
      case 'grow': {
        // a stage's clock ran out (world-model.md §6.5): it becomes the next, leaving what the stage yields
        if (!host) return
        const st = w.onto.resolve(host.type).stage
        const clock = st?.clock ?? 'stage'
        if (!st || ev.params?.status !== clock) return
        if (st.needs && !evalCond(st.needs, rolesOf(ev, w), w, ev)) {
          // not yet (no light, someone standing on it): it waits, and looks again
          w.setStatus({ e: host.id }, clock, w.state.tick + (st.wait ?? st.lasts ?? TICKS_PER_HOUR))
          return
        }
        for (const y of st.yields ?? []) this.apply({ op: 'spawn', type: y.type, at: 'tileOf:host', count: y.count ?? 1, still: true }, ev)
        if (st.fx) this.apply({ op: 'vfx', fx: st.fx, at: 'tileOf:host' }, ev)
        if (st.into) this.apply({ op: 'transform', into: st.into }, ev)
        // a stage with nothing next begins again (a hen lays, and lays again)
        else if (st.lasts) w.setStatus({ e: host.id }, clock, w.state.tick + st.lasts)
        return
      }
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
      if (eff.chance !== undefined && w.luck === undefined && w.rand() >= eff.chance) continue
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
  param(ev: GameEvent, v: PropValue | Amount | { typeOf: RoleName } | { idOf: RoleName }): PropValue | undefined {
    if (typeof v !== 'object' || v === null) return v
    if ('typeOf' in v) return this.eng.world.view(this.roleRef(ev, v.typeOf))?.type
    // which thing a role is (a bed: the place one sleeps is one's home)
    if ('idOf' in v) return this.roleRef(ev, v.idOf)?.e
    if ('param' in v && v.mul === undefined && v.add === undefined) return ev.params?.[v.param]
    // a role's prop passed on as it is (a word too: a site's map)
    if ('prop' in v && v.mul === undefined && v.add === undefined) return this.eng.world.view(this.roleRef(ev, v.of))?.props[v.prop]
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
      // the sky's: only what is out under it (world-model.md §5.3: rain does not fall under a roof)
      const under = (e: Entity) => {
        const at = w.posOf(e)
        return !!at && !w.covered(at.map, at.x, at.y, at.z)
      }
      return w.entitiesOnMap(map).filter((e) => !self({ e: e.id }) && (!to.sky || under(e))).map((e) => ({ e: e.id }))
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
    // onto a cell (or what makes one up: it holds nothing): it comes to rest on the lowest storey
    // from there with room for it and something to hold it (building is this, world-model.md §6.6)
    if (into === 'tile' || w.isTerrain(holder)) {
      const p = w.posOf(holder)
      if (!p) return undefined
      const thing = moving ? w.get(moving) : undefined
      const z = thing ? w.settleZ(thing, p.map, p.x, p.y, p.z ?? 0) : (p.z ?? 0)
      if (z === undefined) return undefined
      return { on: 'tile', map: p.map, x: p.x, y: p.y, ...(z && { z }) }
    }
    if (into === 'hand' && (!holder.held || holder.held === moving)) return { on: 'hand', holder: holder.id }
    return { on: 'inside', holder: holder.id }
  }
}
