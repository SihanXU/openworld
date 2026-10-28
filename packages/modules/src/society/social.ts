// The people's social life (docs/npc-sandbox.md): whose things are, what people take as deeds when they see
// them, whether they know who did it, what they remember and think of each other, what they tell each other,
// the watches that keep the law, and the prices of things. Mechanisms only: what is a deed, what it costs and
// who answers how are data (the world's `deeds`, `laws`, `social`, `talk`, and the rules). What writes here
// writes a host's own record, and only the primitives call it, inside the host's outcome (effects.ts); the
// clock's rounds (gossip, looking about) only make events.
//
// Nothing here asks whether one is the player (CLAUDE.md): anyone can steal, see, tell, be wanted.

import { DIRS, TICKS_PER_DAY, evalCond, textOf, favouriteOf, isA, levelFactor, toldFavourite, weaponOf, type DeedDef, type DeedMemory, type Engine, type Entity, type GameEvent, type Id, type LawDef, type Look, type NpcMemory, type Pos, type PropValue, type Ref, type Roles, type SocialParams, type TalkOption, type TalkVerb, type Text } from '@openworld/engine'
import { authorizedResidentWorkTake } from './resident-work.ts'

/** The social numbers when the world gives none (the content gives its own). */
export const SOCIAL_DEFAULTS: SocialParams = {
  coin: 'item/coin',
  regardStart: 0,
  regardTie: 30,
  talk: 2,
  fade: 0.1,
  gossipEvery: 150,
  gossipDays: 3,
  perceiveEvery: 10,
  fearTicks: 600,
  markup: 0.25,
  markdown: 0.5,
  fence: 0.5,
}

/** How likely two people near each other are to talk over a round of gossip (the rest of the time, they go about their day). */
const GOSSIP_CHANCE = 0.35

/** The resident thing of a watch: its ledger is its props (`bounty:<id>`, `pardon:<id>`, `charged:<deed key>`). */
export const lawId = (id: string) => `law.${id}`
export const bountyKey = (actor: Id) => `bounty:${actor}`
export const pardonKey = (actor: Id) => `pardon:${actor}`

/** How a thing's owner stands to someone: theirs, their household's, another's, nobody's. */
export type Relation = 'mine' | 'ours' | 'another' | 'nobody'
/** Whose a deed was against, as one who sees it stands to them: oneself, one's household, one's kin, someone else, no one. */
export type Victim = 'me' | 'ours' | 'kin' | 'other' | 'none'


/**
 * People of one place know each other by sight: the backdrop's people (`npc.fidelity: 'local'`, docs/continent.md §9),
 * made with their map by its file, are its neighbours — what they need not come to know, nor keep a record of.
 */
function neighbours(a: Entity, b: Entity | undefined): boolean {
  return !!b && a.npc?.fidelity === 'local' && b.npc?.fidelity === 'local' && !!a.from && a.from === b.from
}

export class Social {
  constructor(private eng: Engine) {}

  get params(): SocialParams {
    return { ...SOCIAL_DEFAULTS, ...(this.eng.world.onto.data.social ?? {}) }
  }

  private get w() {
    return this.eng.world
  }

  // ---------------------------------------------------------------- whose things are (§2.1)

  /** The household one belongs to (`household:<h>`), if any. */
  householdOf(e: Entity | undefined): string | undefined {
    const h = e && this.w.prop(e, 'household')
    return typeof h === 'string' && h ? `household:${h}` : undefined
  }

  /**
   * Whose a thing is: its own `owner` prop ('' nobody's); else what holds it — what a person carries is
   * theirs, what a container holds is the container's owner's; else, lying in a region with an owner (a
   * house, a yard), the region's. Nobody owns a body that acts.
   */
  ownerOf(e: Entity, depth = 0): string | undefined {
    const w = this.w
    const own = w.prop(e, 'owner')
    if (typeof own === 'string') return own || undefined
    if (depth > 16) return undefined
    if (e.place.on === 'inside' || e.place.on === 'hand') {
      const holder = w.get(e.place.holder)
      if (!holder) return undefined
      if (w.isAgent(holder)) return holder.id
      return this.ownerOf(holder, depth + 1)
    }
    if (e.place.on === 'tile' && !w.isAgent(e)) {
      for (const r of w.regionsAt(e.place.map, e.place.x, e.place.y, e.place.z ?? 0)) {
        const o = w.prop(r, 'owner')
        if (typeof o === 'string' && o) return o
      }
    }
    return undefined
  }

  /** How an owner stands to someone. */
  relation(owner: string | undefined, to: Entity): Relation {
    if (!owner) return 'nobody'
    if (owner === to.id) return 'mine'
    if (owner === this.householdOf(to)) return 'ours'
    return 'another'
  }

  /** Is the thing someone's own (theirs or their household's)? */
  owns(who: Entity, thing: Entity): boolean {
    const r = this.relation(this.ownerOf(thing), who)
    return r === 'mine' || r === 'ours'
  }

  /** Is the thing another's than someone's (it would be stolen in their hands)? */
  isAnothers(thing: Entity, who: Entity): boolean {
    return this.relation(this.ownerOf(thing), who) === 'another'
  }

  /** The living people an owner names: the person, or the household's members. */
  peopleOf(owner: string): Entity[] {
    const w = this.w
    if (!owner.startsWith('household:')) {
      const e = w.get(owner)
      return e && w.isAgent(e) ? [e] : []
    }
    const h = owner.slice('household:'.length)
    // (by the household's own index, not every thing in the world)
    return w.withProp('household', h).filter((e) => e.npc && e.place.on !== 'none')
  }

  /** An owner's name: a person's, or a household's. */
  ownerName(owner: string, locale: 'en' | 'zh'): string {
    if (!owner.startsWith('household:')) return this.eng.nameOf({ e: owner }, locale)
    const first = this.peopleOf(owner)[0]
    const name = first ? this.eng.nameOf({ e: first.id }, locale) : owner.slice(10)
    return locale === 'zh' ? `${name}家` : `${name}'s household`
  }

  /** How a deed's victim stands to someone who sees it. */
  victim(against: string | undefined, seer: Entity): Victim {
    if (!against) return 'none'
    if (against === seer.id) return 'me'
    const mine = this.householdOf(seer)
    if (mine && against === mine) return 'ours'
    for (const p of this.peopleOf(against)) {
      if (seer.npc?.person?.ties?.[p.id]) return 'kin'
      if (mine && this.householdOf(p) === mine) return 'ours'
    }
    return 'other'
  }

  // ---------------------------------------------------------------- memory and regard (§2.4)

  /** A person's own record, made on first need: only an outcome of theirs calls this. */
  record(e: Entity): NpcMemory | undefined {
    if (!e.npc) return undefined
    return (e.npc.memory ??= {})
  }

  /** Where one's regard toward another starts: higher toward those one is tied to, or shares a household with. */
  regardStart(of: Entity, toward: Id): number {
    const p = this.params
    const other = this.w.get(toward)
    const mine = this.householdOf(of)
    const kin = !!of.npc?.person?.ties?.[toward] || (!!other && !!mine && mine === this.householdOf(other))
    return kin ? p.regardTie : p.regardStart
  }

  /** What one thinks of another (−100..100): what it came to when it last changed, faded back toward its start since. */
  regard(of: Entity | undefined, toward: Id | undefined): number {
    if (!of || !toward || of.id === toward) return 0
    const m = of.npc?.memory
    const start = this.regardStart(of, toward)
    const v = m?.regard?.[toward]
    if (v === undefined) return start
    const days = Math.max(0, (this.w.state.tick - (m?.regardAt?.[toward] ?? this.w.state.tick)) / TICKS_PER_DAY)
    // a grudge heals at `fade`; a liking wears off slower (`fadeUp`): a friend made stays one
    const fade = v > start ? (this.params.fadeUp ?? this.params.fade) : this.params.fade
    return Math.round((start + (v - start) * Math.pow(1 - fade, days)) * 10) / 10
  }

  /** One's regard toward another changes (an outcome of theirs): losses in full, gains harder the higher it is (Elin's affinity). */
  changeRegard(of: Entity, toward: Id, delta: number): number {
    const m = this.record(of)
    if (!m || of.id === toward || !Number.isFinite(delta)) return 0
    const now = this.regard(of, toward)
    const d = delta > 0 ? delta * (100 / (100 + Math.max(0, now) * 2)) * this.kinship(of, toward) : delta
    const next = Math.max(-100, Math.min(100, Math.round((now + d) * 10) / 10))
    ;(m.regard ??= {})[toward] = next
    ;(m.regardAt ??= {})[toward] = this.w.state.tick
    return next - now
  }

  // ---------------------------------------------------------------- good and evil, faith

  /**
   * Where one stands between good and evil (−1..1): its own `alignment`, else read from its honesty (the honest good,
   * a thief like Vigo evil, a peddler who bends the truth in between).
   */
  alignment(e: Entity): number {
    const own = this.w.prop(e, 'alignment')
    if (typeof own === 'number') return Math.max(-1, Math.min(1, own))
    return Math.max(-1, Math.min(1, (this.w.num(e, 'honesty', 1) - 0.5) * 2))
  }

  /**
   * How much faster a liking grows between like and like: the other's karma (−100..100) against one's alignment — the
   * good warm sooner to the good and slower to the wicked, the wicked the other way (at most 1.6×, at least 0.4×).
   */
  kinship(of: Entity, toward: Id): number {
    const other = this.w.get(toward)
    if (!other) return 1
    const k = Math.max(-100, Math.min(100, this.w.num(other, 'karma'))) / 100
    return Math.max(0.25, 1 + 0.6 * k * this.alignment(of))
  }

  /** One's karma or faith moves (−100..100), and the one at the keys is told. */
  moral(e: Entity, key: 'karma' | 'faith', delta: number): number {
    if (!Number.isFinite(delta) || !delta) return 0
    const now = this.w.num(e, key)
    const next = Math.max(-100, Math.min(100, Math.round(now + delta)))
    if (next === now) return 0
    this.w.setProp(e, key, next)
    if (e.id === this.w.state.player) {
      const d = next - now
      const text =
        key === 'karma'
          ? d > 0 ? { en: `Your heart grows lighter (good +${d}).`, zh: `你的心轻了一些（善 +${d}）。` } : { en: `Something in you darkens (evil +${-d}).`, zh: `你心里有什么暗了下去（恶 +${-d}）。` }
          : d > 0 ? { en: `Your faith deepens (+${d}).`, zh: `你的信念更坚定了（+${d}）。` } : { en: `Your faith wavers (${d}).`, zh: `你的信念动摇了（${d}）。` }
      this.w.fx.push({ t: 'log', text, tone: d > 0 ? 'good' : 'bad' })
    }
    return next - now
  }

  /**
   * One saw its own deed (the `conscience` primitive, its own outcome): its karma falls by a quarter of what the deed
   * weighs with people (murder 25, theft 4) — seen by anyone or not. A blow against one who fought it first is no sin.
   */
  conscience(e: Entity, seen: GameEvent): number {
    const def = this.sin(e, seen)
    return def ? this.moral(e, 'karma', -this.weighs(def)) : 0
  }

  /** The deed one's own seen act holds, as one's conscience takes it (a blow against one who fought it first is none). */
  private sin(e: Entity, seen: GameEvent): DeedDef | undefined {
    const def = this.deedIn(seen)
    if (!def || seen.params?.own !== true) return undefined
    const victim = seen.roles.target ? this.w.get(seen.roles.target.e) : undefined
    return def.violent && victim?.ai?.foes?.includes(e.id) ? undefined : def
  }

  /** How much a deed weighs on its doer's karma: a quarter of what it weighs with people, one at least. */
  private weighs(def: DeedDef): number {
    return Math.max(1, Math.round(def.weight / 4))
  }

  /**
   * What one's own act would cost its karma, foreseen (the controls ask first, Engine.guilt): the deed, and how far
   * the karma would fall from where it stands (none at the floor). Nothing written.
   */
  guilt(e: Entity, seen: GameEvent): { def: DeedDef; toll: number } | undefined {
    const def = this.sin(e, seen)
    if (!def) return undefined
    const now = this.w.num(e, 'karma')
    const toll = now - Math.max(-100, Math.min(100, Math.round(now - this.weighs(def))))
    return toll > 0 ? { def, toll } : undefined
  }

  // ---------------------------------------------------------------- gifts (§2.15)

  /** The kind of thing one likes best (its `favourite` prop, an item type of the world's), if any. */
  favourite(e: Entity): string | undefined {
    return favouriteOf(this.w, e)
  }

  /** Whether one has told another what one likes best (said in a chat, people.ts). */
  toldFavourite(e: Entity, who: Id): boolean {
    return toldFavourite(e, who)
  }

  /** A thing is of the kind one likes best (the type, or a kind of it). */
  isFavourite(e: Entity, thing: Entity): boolean {
    const f = this.favourite(e)
    return !!f && isA(thing.type, f)
  }

  /**
   * How warmly one would take a thing as a gift (the gift panel's hearts): by its worth — 1 a trifle (under 5),
   * 2 a kindness (under 20), 3 a treasure — and 4 the kind one likes best.
   */
  giftWarmth(e: Entity, thing: Entity): number {
    if (this.isFavourite(e, thing)) return 4
    const v = this.value(thing)
    return v < 5 ? 1 : v < 20 ? 2 : 3
  }

  /** A word for a regard (the talk panel names it). */
  regardWord(r: number): Text {
    if (r <= -60) return { en: 'hostile', zh: '敌视' }
    if (r <= -20) return { en: 'cold', zh: '冷淡' }
    if (r < 20) return { en: 'neutral', zh: '一般' }
    if (r < 50) return { en: 'friendly', zh: '友好' }
    return { en: 'close', zh: '亲近' }
  }

  /** Does one know another by sight? */
  knows(seer: Entity | undefined, who: Id | undefined): boolean {
    if (!seer || !who) return false
    if (seer.id === who) return true
    const other = this.w.get(who)
    const mine = this.householdOf(seer)
    return !!seer.npc?.memory?.met?.includes(who) || !!seer.npc?.person?.ties?.[who] || (!!other && !!mine && mine === this.householdOf(other)) || neighbours(seer, other)
  }

  /** One comes to know another by sight (an outcome of theirs). */
  meet(seer: Entity, who: Id): void {
    const m = this.record(seer)
    if (!m || seer.id === who || neighbours(seer, this.w.get(who))) return
    const met = (m.met ??= [])
    if (!met.includes(who)) met.push(who)
  }

  /** Is a deed one knows of settled: forgiven, given back, or paid for at the watch where it was done? */
  settled(d: DeedMemory): boolean {
    if (d.settled) return true
    if (!d.by) return false
    const law = this.lawAt(d.map)
    const e = law && this.w.get(lawId(law.id))
    const pardon = e ? this.w.num(e, pardonKey(d.by), -1) : -1
    return pardon >= d.tick
  }

  /** The worst unsettled deed one holds against another: done to them, their household or their kin (one deed, or any). */
  grudge(of: Entity | undefined, toward: Id | undefined, deed?: string): DeedMemory | undefined {
    if (!of || !toward) return undefined
    const defs = this.w.onto.data.deeds ?? []
    const rank = (d: DeedMemory) => defs.find((x) => x.id === d.deed)?.rank ?? 99
    return (of.npc?.memory?.deeds ?? [])
      .filter((d) => d.by === toward && (!deed || d.deed === deed) && ['me', 'ours', 'kin'].includes(this.victim(d.against, of)) && !this.settled(d))
      .sort((a, b) => rank(a) - rank(b))[0]
  }

  /** Does one fear another now (they saw them do violence, or were cowed)? */
  fears(e: Entity, o: Entity | Id): boolean {
    const id = typeof o === 'string' ? o : o.id
    const until = e.npc?.memory?.afraid?.[id]
    return until !== undefined && until > this.w.state.tick
  }

  /** One fears another for a while (an outcome of theirs). */
  frighten(e: Entity, of: Id): void {
    if (this.eng.isProtected(e)) return
    const m = this.record(e)
    if (!m || e.id === of) return
    ;(m.afraid ??= {})[of] = this.w.state.tick + this.params.fearTicks
  }

  // ---------------------------------------------------------------- seeing who (§2.3)

  /** How hidden the doer's face is from where one stands (a hood, a helmet, the dark, distance): 0, bare; 1 and more, unseen. */
  hidden(doer: Entity, at: Pos, d: number): number {
    const w = this.w
    const lit = !w.isNight() || this.eng.fires(at.map).some((f) => Math.max(Math.abs(f.x - at.x), Math.abs(f.y - at.y)) <= 4)
    let h = 0
    if (w.hasTag(doer, 'look:hooded')) h += 0.5
    if (w.hasTag(doer, 'look:helmeted')) h += 0.35
    if (w.hasTag(doer, 'masked')) h += 1
    if (!lit) h += 0.35
    if (d > 4) h += 0.25
    return h
  }

  /**
   * Does the seer know who the doer is? One they know they recognise unless the face is hidden; a stranger they
   * know only close, face bare, in the light (and remember from then on).
   */
  recognises(seer: Entity, doer: Entity, at: Pos): boolean {
    const sp = this.w.posOf(seer)
    if (!sp) return false
    const d = Math.max(Math.abs(sp.x - at.x), Math.abs(sp.y - at.y))
    const h = this.hidden(doer, at, d)
    if (h >= 1) return false
    if (this.knows(seer, doer.id)) return this.w.rand() >= h
    return d <= 2 && h < 0.3
  }

  /** How alike a remembered look and one seen are (0..1): what shows from afar — the hat or hood, the cloak, the outfit and its colour, the hair where it shows, a beard. */
  likeness(a: Look, b: Look): number {
    if (a.body !== b.body) return 0
    let n = 0
    let same = 0
    const cmp = (x: string | undefined, y: string | undefined, weight: number) => {
      n += weight
      if (x === y) same += weight
    }
    cmp(a.parts.hat, b.parts.hat, 2)
    cmp(a.parts.cloak, b.parts.cloak, 1)
    cmp(a.parts.outfit, b.parts.outfit, 2)
    cmp(a.colors['outfit.1'], b.colors['outfit.1'], 1)
    if (!a.parts.hat && !b.parts.hat) {
      cmp(a.parts.hair, b.parts.hair, 1)
      cmp(a.colors.hair, b.colors.hair, 1)
    }
    cmp(a.parts.beard, b.parts.beard, 1)
    return n ? same / n : 0
  }

  /** Is the stranger a deed was remembered by this one (how they look now is like enough)? */
  matches(mem: DeedMemory, who: Entity): boolean {
    const look = this.w.seenLook(who)
    return !!mem.desc && !!look && typeof look === 'object' && this.likeness(mem.desc, look) >= 0.8
  }

  /** A doer's look in words, as a stranger is remembered ("someone in a hood and a long cloak, with a full beard"). */
  describe(doer: Entity, locale: 'en' | 'zh'): string {
    const w = this.w
    const look = w.seenLook(doer)
    const table = w.onto.data.looks
    if (!look || typeof look === 'string' || !table) return locale === 'zh' ? '一个陌生人' : 'a stranger'
    const name = (slot: string) => {
      const p = look.parts[slot] ? table.parts[look.parts[slot]] : undefined
      return p ? (typeof p.name === 'string' ? p.name : locale === 'zh' ? (p.name.zh ?? p.name.en) : p.name.en) : undefined
    }
    const a = (s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`)
    const worn = ['hat', 'cloak', 'outfit'].map(name).filter((x): x is string => !!x)
    const bare = [...(look.parts.hat ? [] : [name('hair')]), name('beard')].filter((x): x is string => !!x)
    if (locale === 'zh') return worn.length || bare.length ? `一个${[...worn, ...bare].join('、')}的人` : '一个陌生人'
    if (!worn.length && !bare.length) return 'a stranger'
    return `someone${worn.length ? ` in ${worn.map(a).join(' and ')}` : ''}${bare.length ? `${worn.length ? ',' : ''} with ${bare.join(' and ')}` : ''}`
  }

  // ---------------------------------------------------------------- deeds (§2.2)

  /** The deed a seen event holds, as the world's deeds say: the worst (lowest rank) whose condition fits. */
  deedIn(seen: GameEvent): DeedDef | undefined {
    const w = this.w
    if (authorizedResidentWorkTake(this.eng, seen)) return undefined
    const defs = [...(w.onto.data.deeds ?? [])].sort((a, b) => a.rank - b.rank)
    if (!defs.length) return undefined
    const roles: Roles = { host: w.view(seen.host), actor: w.view(seen.roles.actor), target: w.view(seen.roles.target), instrument: w.view(seen.roles.instrument) }
    const deed = defs.find((d) => evalCond(d.when, roles, w, seen))
    const actor = roles.actor?.entity, target = roles.target?.entity
    // A responding person's explicit foes come from being struck or called to help. Counting
    // that response as a fresh assault makes witnesses recruit everyone against the defenders.
    if (deed?.violent && actor?.npc && target && actor.ai?.foes?.includes(target.id)) return undefined
    return deed
  }

  /** A deed's key: the same deed known by many is one (the watch charges it once). */
  key(d: Pick<DeedMemory, 'deed' | 'tick' | 'by' | 'thing'>): string {
    return `${d.deed}@${d.tick}@${d.by ?? ''}@${d.thing ?? ''}`
  }

  /**
   * A seer takes in what it saw (the `witness` primitive, its own outcome): the deed in it remembered — who did
   * it, or how they looked — its regard toward the doer falls by what the deed weighs with it, and violence
   * makes it afraid of them. Returns the memory made, if the act was a deed (and not the same one again).
   */
  judge(seer: Entity, seen: GameEvent): DeedMemory | undefined {
    const eng = this.eng
    const w = this.w
    const m = this.record(seer)
    const doer = seen.roles.actor ? w.get(seen.roles.actor.e) : undefined
    if (!m || !doer || doer.id === seer.id) return undefined
    const def = this.deedIn(seen)
    if (!def) return undefined
    const at = { map: String(seen.params?.map ?? w.posOf(doer)?.map ?? ''), x: Number(seen.params?.x ?? 0), y: Number(seen.params?.y ?? 0) }
    const thing = seen.roles.target ? w.get(seen.roles.target.e) : undefined
    // a thing the act broke is gone by now: a cell's keeps its record, and says what it was (a house's wall)
    const was = !thing && seen.roles.target ? w.state.entities[seen.roles.target.e] : undefined
    const wasName = was && (was.name ?? w.onto.resolve(was.type).name)
    const known = this.recognises(seer, doer, at)
    const whose = seen.params?.whose
    const against = typeof whose === 'string' && whose ? whose : thing && seen.params?.person === true ? thing.id : undefined
    const value = seen.params?.value
    const look = known ? undefined : w.seenLook(doer)
    const mem: DeedMemory = {
      deed: def.id,
      ...(known ? { by: doer.id } : { ...(look && typeof look === 'object' && { desc: structuredClone(look) }), words: this.describe(doer, 'en') }),
      ...(against && { against }),
      ...(thing && { thing: thing.id, what: { en: eng.nameOf({ e: thing.id }, 'en'), zh: eng.nameOf({ e: thing.id }, 'zh') } }),
      ...(was && wasName && { thing: was.id, what: { en: textOf(wasName, 'en'), zh: textOf(wasName, 'zh') } }),
      ...at,
      tick: w.state.tick,
      firsthand: true,
      fine: def.fine === 'value' ? Math.max(5, Math.round((typeof value === 'number' ? value : 4) / 2)) : def.fine,
    }
    // one act, one deed: the same deed by the same hand on the same thing a moment ago is the same deed (a
    // presence, as long as it is not settled: one trespass, however long one stays)
    const window = mem.thing ? 30 : 600
    if ((m.deeds ?? []).some((d) => d.deed === mem.deed && (d.thing ?? '') === (mem.thing ?? '') && (d.by ?? '') === (mem.by ?? '') && w.state.tick - d.tick < window && !this.settled(d))) return undefined
    ;(m.deeds ??= []).push(mem)
    if (m.deeds.length > 40) m.deeds.splice(0, m.deeds.length - 40)
    if (known) {
      this.meet(seer, doer.id)
      this.changeRegard(seer, doer.id, -this.share(seer, against) * def.weight)
    }
    if (def.violent) this.frighten(seer, doer.id)
    // a thing of theirs taken by someone they know, not the one at the keys: news for the quests (a favour to get it back)
    const victim = this.victim(against, seer)
    if (known && thing && doer.id !== w.state.player && (def.id === 'theft' || def.id === 'pickpocket') && (victim === 'me' || victim === 'ours'))
      eng.quests.news({ kind: 'deed', actor: doer.id, target: seer.id, item: thing.id, topic: def.id })
    return mem
  }

  /** How much a deed against `against` weighs with someone: all of it against them or theirs, much for kin, half for one who keeps the watch, a little for anyone. */
  share(seer: Entity, against: string | undefined): number {
    const v = this.victim(against, seer)
    if (v === 'me' || v === 'ours') return 1
    if (v === 'kin') return 0.6
    if (this.w.prop(seer, 'watch')) return 0.5
    return 0.25
  }

  /** A remembered stranger is known again (the `witness` primitive, on one who matches): their deeds are theirs now. */
  attribute(seer: Entity, who: Entity): DeedMemory[] {
    const m = seer.npc?.memory
    const out: DeedMemory[] = []
    for (const d of m?.deeds ?? []) {
      if (d.by || this.settled(d) || !this.matches(d, who)) continue
      d.by = who.id
      delete d.desc
      const def = this.w.onto.data.deeds?.find((x) => x.id === d.deed)
      if (def) this.changeRegard(seer, who.id, -this.share(seer, d.against) * def.weight)
      out.push(d)
    }
    if (out.length) this.meet(seer, who.id)
    return out
  }

  /** One's deeds known of another, settled (an outcome of theirs): all, or one kind. */
  settle(of: Entity, toward: Id, deed?: string): number {
    let n = 0
    for (const d of of.npc?.memory?.deeds ?? []) if (d.by === toward && !d.settled && (!deed || d.deed === deed)) (d.settled = true), n++
    return n
  }

  /** A deed in words, as the world's deeds tell it ("Vigo picked Marta's pocket", "有个陌生人偷了赫斯珀的面包"). */
  deedWords(d: DeedMemory, locale: 'en' | 'zh', listener?: Id): string {
    const eng = this.eng
    const def = this.w.onto.data.deeds?.find((x) => x.id === d.deed)
    const pick = (t: Text | undefined) => (t === undefined ? undefined : typeof t === 'string' ? t : locale === 'zh' ? (t.zh ?? t.en) : t.en)
    const who = d.by ? (d.by === listener ? (locale === 'zh' ? '你' : 'you') : eng.nameOf({ e: d.by }, locale)) : locale === 'zh' ? (d.desc && this.w.onto.data.looks ? '有个陌生人' : '有人') : (d.words ?? 'someone')
    const whom = d.against ? (d.against === listener ? (locale === 'zh' ? '你' : 'you') : this.ownerName(d.against, locale)) : locale === 'zh' ? '别人' : 'someone'
    const what = pick(d.what) ?? (locale === 'zh' ? '东西' : 'something')
    const told = pick(def?.told) ?? (locale === 'zh' ? '{who}犯了{deed}' : '{who}: {deed}')
    const s = told.replace('{who}', who).replace('{whom}', whom).replace('{what}', what).replace('{deed}', pick(def?.name) ?? d.deed)
    return locale === 'zh' ? s : s[0].toUpperCase() + s.slice(1)
  }

  // ---------------------------------------------------------------- news (§2.5)

  /** The fresh deeds one could tell another: not told them yet, not their own doing, not settled. */
  tellable(teller: Entity, listener: Entity): DeedMemory[] {
    const fresh = this.params.gossipDays * TICKS_PER_DAY
    return (teller.npc?.memory?.deeds ?? []).filter((d) => this.w.state.tick - d.tick <= fresh && !d.told?.includes(listener.id) && d.by !== listener.id && !this.settled(d))
  }

  /** The teller marks what it tells as told to the listener (its own outcome): the deeds told. */
  tell(teller: Entity, listener: Entity): DeedMemory[] {
    const out = this.tellable(teller, listener)
    for (const d of out) (d.told ??= []).push(listener.id)
    return out
  }

  /** The listener takes in the deeds the teller told it (by their keys; its own outcome): second-hand, lighter. */
  hear(listener: Entity, teller: Entity, keys: string[]): DeedMemory[] {
    const m = this.record(listener)
    if (!m) return []
    const got: DeedMemory[] = []
    for (const d of teller.npc?.memory?.deeds ?? []) {
      const k = this.key(d)
      if (!keys.includes(k) || (m.deeds ?? []).some((x) => this.key(x) === k)) continue
      const heard: DeedMemory = { ...structuredClone(d), firsthand: false, told: [teller.id] }
      ;(m.deeds ??= []).push(heard)
      got.push(heard)
      const def = this.w.onto.data.deeds?.find((x) => x.id === d.deed)
      if (d.by && def) this.changeRegard(listener, d.by, -this.share(listener, d.against) * def.weight * 0.5)
    }
    if (m.deeds && m.deeds.length > 40) m.deeds.splice(0, m.deeds.length - 40)
    return got
  }

  // ---------------------------------------------------------------- the law (§2.7)

  /** The watch that keeps the law on a map, if any. */
  lawAt(map: string | undefined): LawDef | undefined {
    const id = map ? this.w.map(map)?.law : undefined
    return id ? this.w.onto.data.laws?.[id] : undefined
  }

  /** The watch where a thing is. */
  lawHere(e: Entity | undefined): LawDef | undefined {
    return this.lawAt(this.w.posOf(e)?.map)
  }

  /** What an actor owes a watch. */
  bounty(law: string | undefined, actor: Id): number {
    const e = law ? this.w.get(lawId(law)) : undefined
    return e ? this.w.num(e, bountyKey(actor), 0) : 0
  }

  /** What an actor owes the watch of the map it is on (the HUD's "wanted"). */
  bountyHere(actor: Entity): number {
    return this.bounty(this.lawHere(actor)?.id, actor.id)
  }

  /** Is a bounty past what its watch pardons (a murderer's: no talk or coin buys it off)? */
  unpardonable(law: LawDef | undefined, bounty: number): boolean {
    return !!law?.unpardonable && bounty >= law.unpardonable
  }

  /** Where a watch keeps those who will not pay: its jail (an anchor of a map). */
  jailOf(law: LawDef | undefined): Pos | undefined {
    if (!law?.jail) return undefined
    const a = this.w.map(law.jail.map)?.anchors?.[law.jail.anchor]
    return a ? { map: law.jail.map, x: a[0], y: a[1] } : undefined
  }

  /** How long a bounty keeps one in the cells (hours): an hour for each twenty, a day at most (Skyrim's day a hundred, shortened). */
  jailHours(bounty: number): number {
    return Math.max(1, Math.min(24, Math.ceil(bounty / 20)))
  }

  // ---------------------------------------------------------------- trade (§2.10)

  /**
   * What a thing is worth: its `value`, times what its material, quality and level (a piece of gear's) make of it — or,
   * made, what its making fixed (`worth`: params.made, no more than what it took and the work).
   */
  value(thing: Entity): number {
    const w = this.w
    if (typeof thing.props?.worth === 'number') return Math.max(1, Math.round(thing.props.worth))
    let v = w.num(thing, 'value', 2)
    const m = w.materialOf(thing)
    if (m?.value) v *= m.value
    const tags = [...(thing.tags ?? []), ...w.onto.resolve(thing.type).tags]
    const q = (w.onto.data.qualities ?? []).find((x) => x.tag && tags.includes(x.tag))
    if (q?.value) v *= q.value
    if (typeof w.prop(thing, 'slot') === 'string') v *= levelFactor(w.onto.data.params?.gearLevels, w.num(thing, 'level', 1))
    return Math.max(1, Math.round(v))
  }

  /** The coin of the world. */
  isCoin(e: Entity): boolean {
    return e.type === this.params.coin
  }

  /** The coins one carries. */
  coins(e: Entity): Entity[] {
    const w = this.w
    return [...(e.contents ?? []), ...(e.held ? [e.held] : [])].map((id) => w.get(id)).filter((c): c is Entity => !!c && this.isCoin(c) && !c.frozenBy)
  }

  /** How much coin one carries. */
  purse(e: Entity): number {
    return this.coins(e).length
  }

  /**
   * What a merchant's regard does to its prices (a share): off what it asks one it likes — `discount` at full regard,
   * in proportion below — and on for one it does not (a fifth at −50 and under).
   */
  regardDiscount(merchant: Entity, other: Id): number {
    const r = Math.max(-50, Math.min(100, this.regard(merchant, other)))
    return r >= 0 ? ((this.params.discount ?? 0.2) * r) / 100 : r / 250
  }

  /** What a seller asks a buyer for a thing: its worth and the markup, less for one it likes, more for one it does not. */
  priceToBuy(thing: Entity, seller: Entity, buyer: Entity): number {
    const f = (1 + this.params.markup) * (1 - this.regardDiscount(seller, buyer.id))
    return Math.max(1, Math.round(this.value(thing) * f))
  }

  /**
   * What a buyer pays a seller for a thing: its worth less the markdown, better for one it likes (two thirds of its
   * discount); a fence pays its share for what is not the seller's. A thing worth less than a coin to it fetches none
   * (and it does not buy it: `buys`): a merchant never pays more than a thing is worth to it.
   */
  priceToSell(thing: Entity, seller: Entity, buyer: Entity): number {
    const d = this.regardDiscount(buyer, seller.id)
    let f = this.params.markdown * (1 + (d > 0 ? (d * 2) / 3 : d))
    if (this.isAnothers(thing, seller)) f *= this.params.fence
    return Math.floor(this.value(thing) * f)
  }

  /** Will a merchant buy this thing from this seller: the seller's to sell (or a fence's eye), not coin, not what binds or matters, not its own back, worth a coin? */
  buys(merchant: Entity, thing: Entity, seller: Entity): boolean {
    const w = this.w
    if (!w.hasTag(merchant, 'merchant') || this.isCoin(thing) || thing.frozenBy) return false
    // what a quest under way keeps (docs/quests.md: an alias's `keep`) is not for sale
    if (w.hasTag(thing, 'quest-item')) return false
    if (w.hasTag(thing, 'important') || w.hasTag(thing, 'bound') || w.hasTag(thing, 'relic')) return false
    if (w.worn(seller).some((x) => x.id === thing.id)) return false
    if (this.owns(merchant, thing) && !this.owns(seller, thing)) return false
    if (this.isAnothers(thing, seller) && !w.hasTag(merchant, 'fence')) return false
    // nor what is not worth a coin to it
    return this.priceToSell(thing, seller, merchant) > 0
  }

  /**
   * What a merchant offers: what it carries that is its own to sell (not coin, not what it wears). One hungry keeps
   * its food: where everyone sells, the hungry would otherwise buy the loaf off each other faster than they eat it.
   */
  stock(merchant: Entity): Entity[] {
    const w = this.w
    const worn = new Set(w.worn(merchant).map((x) => x.id))
    const keepsFood = w.hasStatus({ e: merchant.id }, 'hungry')
    return (merchant.contents ?? [])
      .map((id) => w.get(id))
      .filter((e): e is Entity => !!e && !this.isCoin(e) && !worn.has(e.id) && !e.frozenBy && this.owns(merchant, e) && !(keepsFood && w.hasTag(e, 'edible')))
  }

  // ---------------------------------------------------------------- noticing (§2.3)

  /**
   * Does a seer notice an act at all? Openly done, yes. Sneaking, the doer is seen only within half the seer's
   * sight and in front of it, and then by a roll; a hand in a pocket is felt by its owner more often than it is
   * seen by others (Elin's check: the seer's perception against the doer's stealth, twice for what is worn).
   */
  notices(seer: Entity, doer: Entity, facts: { from?: PropValue; whose?: PropValue; worn?: PropValue }, d: number, sight: number): boolean {
    const w = this.w
    const sneaking = w.hasStatus({ e: doer.id }, 'sneaking')
    const pocket = facts.from === 'person'
    if (!sneaking && !pocket) return true
    if (sneaking) {
      if (d > Math.ceil(sight / 2)) return false
      const sp = w.posOf(seer)
      const dp = w.posOf(doer)
      const [fx, fy] = DIRS[seer.facing ?? 'down']
      // behind the seer: unseen
      if (sp && dp && (dp.x - sp.x) * fx + (dp.y - sp.y) * fy < 0) return false
    }
    const victim = facts.whose === seer.id || (!!this.householdOf(seer) && facts.whose === this.householdOf(seer))
    const perception = w.stat(seer, 'perception', 10)
    const stealth = w.stat(doer, 'stealth', 0) + w.num(doer, 'level', 1)
    let chance = pocket ? (victim ? 0.6 : 0.3) : 0.55
    if (facts.worn === true) chance *= 2
    chance *= (perception + 10) / 20
    chance *= Math.max(0.1, 1 - stealth / 60)
    if (!sneaking) chance = Math.max(chance, 0.6)
    return w.rand() < Math.min(0.95, chance)
  }

  /**
   * One's might in a scuffle (the `rob` roll): its level, its attack and the weapon it fights with, its defence and
   * its body — the numbers a fight is reckoned by (engine.ts, World.stat), read as they stand now.
   */
  might(e: Entity): number {
    const w = this.w
    const weapon = weaponOf(w, e)
    const attack = w.stat(e, 'atk', 1) + (weapon ? w.num(weapon, 'power', 0) : 0)
    const base = w.num(e, 'level', 1) * 2 + attack * 2 + w.stat(e, 'def') + w.num(e, 'maxHp', 1) / 10
    // one who fights (a guard, the smith) stands its ground: half again
    return w.prop(e, 'fights') === true || !!w.prop(e, 'watch') ? base * 1.5 : base
  }

  /** One's nimbleness (the `steal` roll): its stealth, its dodge, how fast it moves, and what its levels taught it. */
  nimbleness(e: Entity): number {
    const w = this.w
    return w.stat(e, 'stealth') + w.stat(e, 'dodge') + w.stat(e, 'moveHaste') / 2 + (w.num(e, 'level', 1) - 1) * 2
  }

  /**
   * A roll of one prevailing over another (the `sway` condition): persuading by regard and the speaker's level, cowing
   * by levels and arms; robbing by might alone — no roll: the robber's must be `robEdge` times the victim's (one who
   * is overwhelmed gives up what it has) —; stealing by the thief's nimbleness against the victim's perception.
   */
  sway(of: Entity, by: Entity, how: 'persuade' | 'intimidate' | 'rob' | 'steal', bonus = 0): boolean {
    const w = this.w
    const lv = (e: Entity) => w.num(e, 'level', 1)
    let chance: number
    if (how === 'rob') return this.might(by) >= this.might(of) * (this.params.robEdge ?? 2) + bonus
    if (how === 'persuade') chance = 0.3 + this.regard(of, by.id) / 200 + (lv(by) - 1) * 0.03 + w.stat(by, 'speech') / 100
    else if (how === 'steal') chance = 0.2 + this.nimbleness(by) / 100 - (w.stat(of, 'perception', 10) - 10) / 100 + (w.hasStatus({ e: by.id }, 'sneaking') ? 0.1 : 0)
    else {
      const armed = w.hasStatus({ e: by.id }, 'drawn') ? 0.15 : 0
      const brave = w.prop(of, 'fights') === true || !!w.prop(of, 'watch') ? 0.3 : 0
      chance = 0.35 + (lv(by) - lv(of)) * 0.08 + armed - brave + (this.fears(of, by) ? 0.25 : 0)
    }
    return w.rand() < Math.max(0.05, Math.min(0.95, chance + bonus))
  }

  // ---------------------------------------------------------------- the clock's own rounds

  /**
   * A round of gossip on the active map: of two people awake and near each other, the one with something fresh
   * to tell is reminded of it (a `notify` chat to the teller, who answers by telling: its own outcome).
   */
  gossip(active: string): void {
    const eng = this.eng
    const w = this.w
    const people = w.entitiesOnMap(active).filter((e) => e.npc && e.place.on === 'tile' && !eng.asleep(e) && !eng.busy(e) && !e.ai)
    for (const teller of people) {
      // not every meeting is for talk: now and then (GOSSIP_CHANCE)
      if (!teller.npc?.memory?.deeds?.length || teller.place.on !== 'tile' || w.rand() >= GOSSIP_CHANCE) continue
      const tp = teller.place
      const listener = people.find((o) => o.id !== teller.id && o.place.on === 'tile' && Math.max(Math.abs(o.place.x - tp.x), Math.abs(o.place.y - tp.y)) <= 3 && this.tellable(teller, o).length)
      if (!listener) continue
      eng.offer({ kind: 'impulse/notify', host: { e: teller.id }, roles: { other: { e: listener.id } }, params: { what: 'chat' }, origin: 'world' })
    }
  }

  /**
   * A look about on the active map: people see who is where they should not be, a stranger they remember
   * doing something, a blade drawn near them, one their watch wants, a face close by — each a `seen` of a
   * presence (params act `presence`), whose answer is the seer's rules'.
   */
  perceive(active: string): void {
    const eng = this.eng
    const w = this.w
    const actors = w.entitiesOnMap(active).filter((e) => e.place.on === 'tile' && w.isAgent(e) && w.hasTag(e, 'person') && !w.hasStatus({ e: e.id }, 'down'))
    for (const seer of actors) {
      if (!seer.npc || seer.place.on !== 'tile' || eng.asleep(seer) || eng.busy(seer)) continue
      const sp = seer.place
      const sight = eng.sightOf(seer, sp)
      for (const o of actors) {
        if (o.id === seer.id || o.place.on !== 'tile') continue
        const op = o.place
        const d = Math.max(Math.abs(op.x - sp.x), Math.abs(op.y - sp.y))
        if (d > sight) continue
        const facts = this.presence(seer, o, d)
        if (!facts || !eng.lineOfSight(active, sp, op) || !this.notices(seer, o, {}, d, sight)) continue
        eng.offer({ kind: 'seen', host: { e: seer.id }, roles: { actor: { e: o.id } }, params: { act: 'presence', map: active, x: op.x, y: op.y, defined: true, ...facts }, origin: o.id === w.state.player ? 'player' : 'world', cause: o.id })
      }
    }
  }

  /** What a seer makes of another's presence, if anything worth an answer. */
  private presence(seer: Entity, o: Entity, d: number): Record<string, PropValue> | undefined {
    const w = this.w
    const at = w.posOf(o)!
    const facts: Record<string, PropValue> = {}
    // in a place that is the seer's (or its household's) and not theirs, by night or behind its door: a trespass
    for (const r of w.regionsAt(at.map, at.x, at.y, at.z ?? 0)) {
      const owner = w.prop(r, 'owner')
      if (typeof owner !== 'string' || !owner) continue
      if (this.relation(owner, o) !== 'another' || this.relation(owner, seer) === 'another') continue
      if (w.isNight() || w.prop(r, 'private') === true) (facts.trespass = true), (facts.whose = owner)
    }
    // a stranger remembered by their look, now close: it was them
    if (d <= 4 && (seer.npc?.memory?.deeds ?? []).some((x) => !x.by && !this.settled(x) && this.matches(x, o))) facts.suspect = true
    // a blade drawn near them
    if (d <= 3 && w.hasStatus({ e: o.id }, 'drawn')) facts.drawn = true
    // one their watch wants
    const law = this.lawAt(at.map)
    const b = law && w.prop(seer, 'watch') === law.id ? this.bounty(law.id, o.id) : 0
    if (b > 0 && (this.knows(seer, o.id) || d <= 3)) facts.wanted = b
    // close and in the light, face bare: a face learnt
    if (d <= 2 && !this.knows(seer, o.id) && this.hidden(o, at, d) < 0.3) facts.meet = true
    return Object.keys(facts).length ? facts : undefined
  }

  // ---------------------------------------------------------------- the talk panel (§2.9)

  /** The verbs of the talk panel that fit now, for a speaker and the one spoken to (`arrest`: a guard has stopped the speaker). */
  verbs(person: Entity, speaker: Entity, arrest = false): TalkOption[] {
    const w = this.w
    const roles: Roles = { host: w.view({ e: person.id }), actor: w.view({ e: speaker.id }), story: w.view({ e: 'story' }), world: w.view({ e: 'world' }) }
    const bounty = this.bounty(this.lawHere(person)?.id, speaker.id)
    const fill = (t: Text): Text => {
      const f = (s: string, l: 'en' | 'zh') => s.replace('{bounty}', String(bounty)).replace('{bribe}', String(Math.round(bounty * 1.5))).replace('{name}', this.eng.nameOf({ e: person.id }, l))
      return typeof t === 'string' ? f(t, 'en') : { en: f(t.en, 'en'), ...(t.zh && { zh: f(t.zh, 'zh') }) }
    }
    const fits = (v: TalkVerb) => !!v.arrest === arrest && evalCond(v.when, roles, w)
    const saved = w.state.rng
    try {
      // the quests' first (docs/quests.md §2.4): their offers to take on or turn down, the topics of those under way
      const quests: TalkOption[] = arrest ? [] : this.questVerbs(person, speaker)
      return [...quests, ...(w.onto.data.talk ?? []).filter(fits).map((v) => ({ id: v.id, label: fill(v.label), ...(v.group && { group: v.group }), ...(v.choices && { choices: v.choices.filter((c) => evalCond(c.when, roles, w)).map((c) => ({ id: c.id, label: fill(c.label) })) }) }))]
    } finally {
      // offering a verb rolls nothing
      w.state.rng = saved
    }
  }

  /** A person's quest verbs for a speaker: `quest:<ref>:accept|decline` for each offer, `quest:<ref>:<topic>` for each topic. */
  questVerbs(person: Entity, speaker: Entity): TalkOption[] {
    const q = this.eng.quests
    const name = (t: Text, l: 'en' | 'zh') => (typeof t === 'string' ? t : (l === 'zh' ? t.zh : undefined) ?? t.en)
    const out: TalkOption[] = []
    for (const o of q.offers(person.id, speaker)) {
      out.push({ id: `quest:${o.ref}:accept`, group: 'quest', label: { en: `Accept: ${name(o.title, 'en')}`, zh: `接受「${name(o.title, 'zh')}」` } })
      out.push({ id: `quest:${o.ref}:decline`, group: 'quest', label: { en: `Not now (${name(o.title, 'en')})`, zh: `拒绝「${name(o.title, 'zh')}」` } })
    }
    for (const t of q.topics(person.id, speaker)) out.push({ id: `quest:${t.ref}:${t.topic}`, group: 'quest', label: t.label })
    return out
  }

  /** The one the talk is with, as the panel shows them: their regard word, what they hold against the speaker, what the speaker owes here, the verbs. */
  talkView(person: Entity, speaker: Entity, arrest = false): { who: Id; regard: Text; affection: number; grudge?: Text; bounty?: number; arrest?: boolean; verbs: TalkOption[] } {
    const g = this.grudge(person, speaker.id)
    const b = this.bountyHere(speaker)
    return {
      who: person.id,
      regard: this.regardWord(this.regard(person, speaker.id)),
      affection: this.regard(person, speaker.id),
      ...(g && { grudge: { en: this.deedWords(g, 'en', speaker.id), zh: this.deedWords(g, 'zh', speaker.id) } }),
      ...(b > 0 && { bounty: b }),
      ...(arrest && { arrest }),
      verbs: this.verbs(person, speaker, arrest),
    }
  }

  // ---------------------------------------------------------------- a home ground's residents (moveIn)

  /** The beds of the home ground open now (their facts hold) and on its map, and who sleeps in each. */
  residenceBeds(): { anchor: string; at: [number, number]; day: [number, number]; who?: Id }[] {
    const r = this.params.residence
    const anchors = r && this.w.map(r.map)?.anchors
    if (!r || !anchors) return []
    const taken = new Map<string, Id>()
    for (const e of this.w.people()) if (e.npc?.resident?.map === r.map) taken.set(e.npc.resident.slot, e.id)
    return r.slots
      .filter((b) => anchors[b.anchor] && (!b.when || !!this.w.fact(b.when)))
      .map((b) => ({ anchor: b.anchor, at: anchors[b.anchor], day: anchors[`${b.anchor}.day`] ?? anchors[b.anchor], ...(taken.has(b.anchor) && { who: taken.get(b.anchor) }) }))
  }

  /** A ref's entity. */
  get(ref: Ref | undefined): Entity | undefined {
    return ref ? this.w.get(ref.e) : undefined
  }
}
