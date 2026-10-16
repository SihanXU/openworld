// Quests (docs/quests.md): Bethesda's model on our event model. A quest is content (`QuestDef`); a quest
// under way is a resident thing, `quest.<id>` (a radiant one `quest.<id>.<n>`), whose props are its state:
// the stage it stands at and when each was reached, its aliases (who and what it is about), its
// objectives, its counts, who took it on. Like any thing it answers events with its rules — read
// anything, write only itself (design.md §5.6): it **sees news** (a `seen` event: what happened to its
// aliases, what the taker did) and answers by moving on (`advance`: its triggers are data); anything
// else that wants it to move on **notifies** it (`stage`, `accept`, `decline`, `fail`), and it answers.
//
// The engine turns what happens into news after every outcome (who was spoken to, felled, gone, what
// the taker carries and where they are, the story's facts, the steps played, the social world's
// deeds), and only the quests that listen see it; the story sees what any quest begins on and is the
// Story Manager: it begins the `auto` quests whose trigger holds and makes the radiant offers whose
// aliases fill. Nothing here polls.

import type { Engine } from './engine.ts'
import { cmp, matchSelector } from './rules.ts'
import { TICKS_PER_HOUR } from './calendar.ts'
import { regionId } from './world.ts'
import type { Cmp, Effect, Entity, GameEvent, Id, Lesson, PropValue, Selector, Text } from './types.ts'

/** The main line, someone's errand, a radiant favour, or a guide: the companion's teaching of one of the game's systems, told beside the main line in her panel. */
export type QuestKind = 'main' | 'side' | 'favor' | 'guide'

/** What makes a stage or an objective hold (docs/quests.md §2.2): data, each kind listening for some news. */
export type QuestTrigger =
  /** The taker speaks to the alias (E; with `topic`, one of the quest's topics in the talk panel). */
  | { talk: string; topic?: string }
  /** The alias, or one of a class (felled by the taker), is brought down (its `broken` line crossed). */
  | { kill: string | Selector; map?: string }
  /** The alias is dead or destroyed. */
  | { gone: string }
  /** The taker is on this map, or in this area (`map:region`). */
  | { enter: string }
  /** The taker holds this many (1) of a class, or the alias itself. */
  | { carry: string | Selector; count?: number }
  /** The taker hands the alias (or one of a class) to an alias (G). */
  | { give: string | Selector; to: string }
  /** The story's facts. */
  | { fact: Record<string, Cmp> }
  /** Other quests' stages (0 before they begin). */
  | { quest: Record<string, Cmp> }
  /** Another quest is over (done). */
  | { done: string }
  /** A step of the story has played. */
  | { step: string }
  /** These objectives of this quest are done (their counts met): all of them, or the ones named. */
  | { objectives: string[] | 'all' }
  | { all: QuestTrigger[] }
  | { any: QuestTrigger[] }
  | { not: QuestTrigger }

/** What happened, as the quests hear it (docs/quests.md §2.3). */
export type NewsKind = 'begin' | 'talk' | 'kill' | 'gone' | 'enter' | 'carry' | 'give' | 'fact' | 'quest' | 'step' | 'deed' | 'wanted' | 'hungry' | 'night' | 'morning'

export interface News {
  kind: NewsKind
  /** Who did it, or whom it concerns (the taker, for enter and carry). */
  actor?: Id
  /** Who was spoken to, felled, gone, given to; whom a deed was against. */
  target?: Id
  item?: Id
  /** A place entered (`map` or `map:region`), a fact's key, a quest's id, a step's id. */
  key?: string
  /** A talk's topic; a deed's id. */
  topic?: string
  /** What was felled (it may be gone by the time the news is heard). */
  type?: string
  tags?: string[]
  map?: string
}

/** Who or what a quest is about (Skyrim's aliases), filled when it begins or is offered. */
export interface AliasDef {
  /** A specific thing. */
  id?: Id
  /** The first, nearest or a random thing matching (never another alias's), on a map or near another alias. */
  find?: Selector & { map?: string; near?: string; pick?: 'nearest' | 'random'; person?: boolean }
  /** A thing made when the quest begins: in an alias's bag, or at a spot. */
  make?: { type: string; in?: string; at?: { map: string; x: number; y: number }; name?: Text; props?: Record<string, PropValue>; tags?: string[] }
  /** A role of the news that began it (radiant). */
  from?: 'actor' | 'target' | 'item'
  /** What the alias must be (a thing found or taken from the news): else the quest does not begin. */
  match?: Selector
  /** A place: a map, or a named area (`map:region`). */
  place?: string
  /** It may stay empty (else a quest that cannot fill it does not begin). */
  optional?: boolean
  /** While the quest runs, they cannot die (they go down). */
  essential?: boolean
  /** While the quest runs, a quest item (no merchant buys it). */
  keep?: boolean
}

export interface ObjectiveDef {
  id: string
  /** What it asks ({alias} names an alias). */
  text: Text
  /** What it points at (aliases): markers on the minimap and the world map, '?' over one to speak to. */
  target?: string | string[]
  /** A person to speak to (a '?' over the target). */
  talk?: boolean
  /** It counts by itself: what the taker holds now, what they fell, a number the story keeps. */
  count?: { carry: string | Selector } | { kill: Selector; map?: string } | { fact: string }
  need?: number
  /** It is done when this holds (and its target says `say`). */
  on?: QuestTrigger
  say?: Text
  optional?: boolean
}

export interface QuestReward {
  xp?: number
  /** Things made into the taker's bag; an item may be a named piece (its name, tags such as its quality, props such as its defence). */
  items?: { type: string; count: number; name?: Text; tags?: string[]; props?: Record<string, PropValue> }[]
  /** Facts the story is told to keep. */
  facts?: Record<string, PropValue>
  /** What aliases think of the taker after. */
  regard?: Record<string, number>
  /** How the deed weighs on the taker's good and evil (their `karma`); unsaid, a kindness to someone (regard given) is +3. */
  karma?: number
  /** How it weighs on the taker's faith (their `faith`). */
  faith?: number
}

export interface QuestStage {
  n: number
  /** What sets it (news it listens for, state it holds on); without one, only a notice (`stage`) sets it. */
  on?: QuestTrigger
  /** The stages it may follow (default: any lower). */
  from?: number[]
  /** The journal's line. */
  log?: Text
  /** What the companion tells while it is the stage (default: its log). */
  hint?: Text
  show?: string[]
  done?: string[]
  fail?: string[]
  /** A line said on reaching it, by an alias (default: the one spoken to, else the giver). */
  say?: Text
  by?: string
  /** Things handed over on reaching it: from an alias (default the taker) to an alias (default the giver). */
  take?: { match: string | Selector; count: number; from?: string; to?: string }[]
  reward?: QuestReward
  /** Effects run as the quest's own outcome (a scene, another quest begun, news for the story). */
  do?: Effect[]
  /** The tutorial's drills while it is the stage (docs/prologue.md). */
  lessons?: Lesson[]
  complete?: boolean
  /** Reaching it fails the quest. */
  failed?: boolean
}

/** A topic of the quest's in the talk panel (Bethesda's quest dialogue): with an alias, at some stages. */
export interface QuestTopic {
  id: string
  /** Whose talk panel it shows in. */
  with: string
  /** At which stages (default: whenever the quest runs). */
  at?: Cmp
  label: Text
}

export type QuestStart =
  /** Begins by itself as soon as this holds (a main line that never waits on a word). */
  | { auto: QuestTrigger }
  /** An alias offers it (E): accept or decline, once `when` holds. */
  | { offer: string; when?: QuestTrigger; level?: number }
  /** Radiant: on this news, if `when` holds and its aliases fill, the Story Manager makes an offer (at most `most` at once). */
  | { news: NewsKind; when?: QuestTrigger; chance?: number; most?: number; offer: string }
  /** Begun only by an effect (`startQuest`). */
  | { manual: true }

export interface QuestDef {
  id: string
  kind: QuestKind
  title: Text
  /** What it is about, for the journal ({alias} names an alias). */
  summary: Text
  aliases?: Record<string, AliasDef>
  objectives?: ObjectiveDef[]
  /** The first is where it begins. */
  stages: QuestStage[]
  start: QuestStart
  topics?: QuestTopic[]
  /** Game hours: past them an active quest fails (an offer is withdrawn). */
  deadline?: number
  /** May begin again once over: each day, or at once. */
  repeat?: 'daily' | 'always'
  /** The giver's lines: offering, on being accepted or declined, while it runs. */
  offer?: Text
  accepted?: Text
  declined?: Text
  waiting?: Text
}

export type QuestState = 'offered' | 'active' | 'done' | 'failed'

/** A quest as the journal shows it. */
export interface JournalQuest {
  id: Id
  quest: string
  kind: QuestKind
  title: Text
  summary: Text
  state: QuestState
  tracked: boolean
  giver?: Text
  objectives: { id: string; text: Text; state: 'open' | 'done' | 'failed'; have?: number; need?: number; where?: Text; optional?: boolean }[]
  log: { stage: number; text: Text; tick: number }[]
  /** Under way: its stage's hint, how to go on (what a companion tells; the companion's panel). */
  hint?: Text
}

/** An offer, as the talk panel and the notice board show it. */
export interface QuestOffer {
  /** The quest under way's id (a radiant offer) or the definition's (an authored one). */
  ref: string
  title: Text
  summary: Text
  giver?: Id
}

/** Where a tracked objective points (a marker). */
export interface QuestTarget {
  objective: string
  text: Text
  map: string
  x: number
  y: number
}

const QUEST_TYPE = 'resident/quest'
/** How many times a quest may move on from one look (a stage reached, then the next already holding …). */
const CHAIN = 12

export const questId = (id: string, n?: number) => (n === undefined ? `quest.${id}` : `quest.${id}.${n}`)

function txt(t: Text, l: 'en' | 'zh'): string {
  return typeof t === 'string' ? t : (l === 'zh' ? t.zh : undefined) ?? t.en
}

export class Quests {
  defs: QuestDef[] = []
  private byId = new Map<string, QuestDef>()
  /** News waiting to be heard (made by outcomes, heard after them). */
  private pending: News[] = []
  private flushing = false
  /** The derived tags of what quests under way hold (essential people, kept things), by id. */
  private tagCache?: Map<Id, string[]>
  private lastHour = -1

  constructor(private eng: Engine) {}

  load(defs: QuestDef[] | undefined): void {
    this.defs = defs ?? []
    this.byId = new Map(this.defs.map((d) => [d.id, d]))
    this.tagCache = undefined
  }

  private get w() {
    return this.eng.world
  }

  def(id: string | undefined): QuestDef | undefined {
    return id ? this.byId.get(id) : undefined
  }

  // ---------------------------------------------------------------- the quests under way

  /** Every quest thing in the world (offered, under way, over). */
  all(): Entity[] {
    return this.w.residents().filter((e) => e.type === QUEST_TYPE)
  }

  /** The quests of a definition (the authored one's single thing first). */
  of(id: string): Entity[] {
    return this.all().filter((e) => e.props?.quest === id)
  }

  defOf(q: Entity): QuestDef | undefined {
    return this.def(String(q.props?.quest ?? ''))
  }

  stateOf(q: Entity | undefined): QuestState | undefined {
    const s = q?.props?.state
    return typeof s === 'string' ? (s as QuestState) : undefined
  }

  /** An authored quest's stage (0 before it begins). */
  stage(id: string): number {
    const q = this.w.get(questId(id))
    return typeof q?.props?.stage === 'number' ? q.props.stage : 0
  }

  /** Is an objective of an authored quest done (`quest.objective`)? */
  done(ref: string): boolean {
    const i = ref.indexOf('.')
    const q = this.w.get(questId(ref.slice(0, i)))
    const o = q && this.defOf(q)?.objectives?.find((x) => x.id === ref.slice(i + 1))
    return !!q && !!o && this.objectiveDone(q, o)
  }

  /** Is an authored quest over (done)? */
  isDone(id: string): boolean {
    return this.stateOf(this.w.get(questId(id))) === 'done'
  }

  active(): Entity[] {
    return this.all().filter((q) => this.stateOf(q) === 'active')
  }

  alias(q: Entity, name: string): string | undefined {
    if (name === 'player') return typeof q.props?.by === 'string' ? q.props.by : this.w.state.player
    const v = q.props?.[`alias.${name}`]
    return typeof v === 'string' && v ? v : undefined
  }

  /** An alias's thing (none for a place). */
  aliasEntity(q: Entity, name: string): Entity | undefined {
    const id = this.alias(q, name)
    return id ? this.w.get(id) : undefined
  }

  taker(q: Entity): Entity | undefined {
    return this.aliasEntity(q, 'player')
  }

  /** The giver: the alias who offers it, else `giver`. */
  giverAlias(d: QuestDef): string {
    return 'offer' in d.start ? d.start.offer : d.aliases?.giver ? 'giver' : 'player'
  }

  // ---------------------------------------------------------------- reading the world for a trigger

  private carried(by: Entity | undefined): Entity[] {
    if (!by) return []
    return [by.held, ...(by.contents ?? [])].map((id) => this.w.get(id)).filter((e): e is Entity => !!e && !e.frozenBy)
  }

  /** How many of a class (or the alias's own thing) one holds. */
  private holding(q: Entity, by: Entity | undefined, what: string | Selector): number {
    const items = this.carried(by)
    if (typeof what === 'string') {
      const id = this.alias(q, what)
      return items.filter((e) => e.id === id).length
    }
    return items.filter((e) => matchSelector(what, this.w.view({ e: e.id }))).length
  }

  /** Does the thing match a class (its view now, or what the news kept of it)? */
  private matches(sel: Selector, id: Id | undefined, news?: News): boolean {
    const v = id ? this.w.view({ e: id }) : undefined
    if (v) return matchSelector(sel, v)
    if (!news?.type) return false
    return matchSelector(sel, { ref: { e: id ?? '' }, id: id ?? '', type: news.type, tags: new Set(news.tags ?? []), statuses: new Set(), props: {}, entity: undefined as never })
  }

  /** Is the taker in a place (`map`, or `map:region`)? */
  private within(by: Entity | undefined, place: string): boolean {
    const at = this.w.posOf(by)
    if (!at || !by) return false
    const i = place.indexOf(':')
    if (i < 0) return at.map === place
    return at.map === place.slice(0, i) && this.w.within(by, regionId(place.slice(0, i), place.slice(i + 1)))
  }

  /** How far a counting objective is (have / need). */
  progress(q: Entity, o: ObjectiveDef): { have: number; need: number } | undefined {
    const need = o.need ?? 1
    const c = o.count
    if (!c) return undefined
    if ('carry' in c) return { have: Math.min(need, this.holding(q, this.taker(q), c.carry)), need }
    if ('kill' in c) return { have: Math.min(need, this.w.num(q, `count.${o.id}`)), need }
    return { have: Math.min(need, Number(this.w.fact(c.fact) ?? 0)), need }
  }

  /** Is an objective done (marked, or its count met)? */
  objectiveDone(q: Entity, o: ObjectiveDef): boolean {
    const s = q.props?.[`obj.${o.id}`]
    if (s === 'done') return true
    if (s === 'failed') return false
    const p = this.progress(q, o)
    return !!p && p.have >= p.need
  }

  /** Does a trigger hold now, for this quest (with the news being heard, if any)? */
  holds(t: QuestTrigger | undefined, q: Entity, news?: News): boolean {
    if (!t) return false
    const w = this.w
    const by = this.alias(q, 'player')
    if ('all' in t) return t.all.every((x) => this.holds(x, q, news))
    if ('any' in t) return t.any.some((x) => this.holds(x, q, news))
    if ('not' in t) return !this.holds(t.not, q, news)
    if ('talk' in t) return news?.kind === 'talk' && news.actor === by && news.target === this.alias(q, t.talk) && (t.topic ?? undefined) === (news.topic ?? undefined)
    if ('kill' in t) {
      if (news?.kind !== 'kill') return false
      if (t.map && news.map !== t.map) return false
      if (typeof t.kill === 'string') return news.target === this.alias(q, t.kill)
      return news.actor === by && this.matches(t.kill, news.target, news)
    }
    if ('gone' in t) return news?.kind === 'gone' && news.target === this.alias(q, t.gone)
    if ('enter' in t) return this.within(w.get(by), t.enter)
    if ('carry' in t) return this.holding(q, w.get(by), t.carry) >= (t.count ?? 1)
    if ('give' in t) {
      if (news?.kind !== 'give' || news.actor !== by || news.target !== this.alias(q, t.to)) return false
      return typeof t.give === 'string' ? news.item === this.alias(q, t.give) : this.matches(t.give, news.item, news)
    }
    if ('fact' in t) return Object.entries(t.fact).every(([k, c]) => cmp(w.fact(k) ?? 0, c))
    if ('quest' in t) return Object.entries(t.quest).every(([id, c]) => cmp(this.stage(id), c))
    if ('done' in t) return this.isDone(t.done)
    if ('step' in t) return !!w.fact(`seen.${t.step}`)
    if ('objectives' in t) {
      const d = this.defOf(q)
      const list = t.objectives === 'all' ? (d?.objectives ?? []).filter((o) => !o.optional && this.shown(q, o)) : (d?.objectives ?? []).filter((o) => (t.objectives as string[]).includes(o.id))
      return list.every((o) => this.objectiveDone(q, o))
    }
    return false
  }

  /** The news a trigger listens for (its state is looked at again when one comes). */
  listens(t: QuestTrigger | undefined, out = new Set<NewsKind>()): Set<NewsKind> {
    if (!t) return out
    if ('all' in t) t.all.forEach((x) => this.listens(x, out))
    else if ('any' in t) t.any.forEach((x) => this.listens(x, out))
    else if ('not' in t) this.listens(t.not, out)
    else if ('talk' in t) out.add('talk')
    else if ('kill' in t) out.add('kill')
    else if ('gone' in t) out.add('gone')
    else if ('enter' in t) out.add('enter')
    else if ('carry' in t) out.add('carry')
    else if ('give' in t) out.add('give')
    else if ('fact' in t) out.add('fact')
    else if ('quest' in t || 'done' in t || 'objectives' in t) out.add('quest')
    // (a step played is the story's fact `seen.<id>`: either news may bring it)
    else if ('step' in t) (out.add('step'), out.add('fact'))
    return out
  }

  /** Is an objective shown (by a stage, or every one when no stage shows any)? */
  shown(q: Entity, o: ObjectiveDef): boolean {
    const s = q.props?.[`obj.${o.id}`]
    if (s === 'shown' || s === 'done' || s === 'failed') return true
    const d = this.defOf(q)
    return !!d && !d.stages.some((st) => st.show?.length)
  }

  /** The stages a quest may reach next: above its stage, from where it stands. */
  private next(q: Entity, d: QuestDef): QuestStage[] {
    const at = this.w.num(q, 'stage')
    return d.stages.filter((s) => s.n > at && s.on && (!s.from || s.from.includes(at)))
  }

  /** What a quest under way listens for now: its next stages', its open objectives', its counts'. */
  private listening(q: Entity, d: QuestDef): Set<NewsKind> {
    const out = new Set<NewsKind>()
    for (const s of this.next(q, d)) this.listens(s.on, out)
    for (const o of d.objectives ?? []) {
      if (!this.shown(q, o) || q.props?.[`obj.${o.id}`] === 'done') continue
      this.listens(o.on, out)
      if (o.count && 'kill' in o.count) out.add('kill')
      if (o.count && 'carry' in o.count) out.add('carry')
      if (o.count && 'fact' in o.count) out.add('fact')
    }
    // an alias gone: an offer is withdrawn
    if (this.stateOf(q) === 'offered') out.add('gone')
    return out
  }

  /** Does this news concern the quest (its aliases, the class it counts)? */
  private concerns(q: Entity, n: News): boolean {
    if (n.kind === 'talk' || n.kind === 'give' || n.kind === 'enter' || n.kind === 'carry') return n.actor === this.alias(q, 'player')
    if (n.kind === 'kill' || n.kind === 'gone') {
      const d = this.defOf(q)
      const ids = Object.keys(d?.aliases ?? {}).map((a) => this.alias(q, a))
      if (n.target && ids.includes(n.target)) return true
      return n.kind === 'kill' && n.actor === this.alias(q, 'player')
    }
    return true
  }

  // ---------------------------------------------------------------- news

  /** Something happened (an outcome's, the clock's): heard once the outcome is over. */
  news(n: News): void {
    if (!this.defs.length) return
    this.pending.push(n)
  }

  /** Is this thing one a quest under way names (an alias)? */
  aliased(id: Id): boolean {
    for (const q of this.all()) {
      const s = this.stateOf(q)
      if (s !== 'active' && s !== 'offered') continue
      for (const [k, v] of Object.entries(q.props ?? {})) if (k.startsWith('alias.') && v === id) return true
    }
    return false
  }

  /** Does any quest begin on this news (the story listens for it)? */
  private begins(kind: NewsKind): boolean {
    for (const d of this.defs) {
      const s = d.start
      if ('news' in s && s.news === kind) return true
      if ('auto' in s && (kind === 'begin' || this.listens(s.auto).has(kind))) return true
    }
    return false
  }

  /**
   * The news heard: each quest that listens sees it (a `seen` event: params `news` and its facts,
   * roles actor / target / item), and the story sees what any quest begins on (the Story Manager).
   */
  flush(): void {
    if (this.flushing || !this.pending.length) return
    this.flushing = true
    try {
      for (let guard = 0; this.pending.length && guard < 400; guard++) {
        const n = this.pending.shift()!
        const ev = (host: Id): GameEvent => ({
          kind: 'seen',
          host: { e: host },
          roles: { ...(n.actor && this.w.get(n.actor) && { actor: { e: n.actor } }), ...(n.target && this.w.get(n.target) && { target: { e: n.target } }), ...(n.item && this.w.get(n.item) && { item: { e: n.item } }) },
          params: { news: n.kind, ...(n.key !== undefined && { key: n.key }), ...(n.topic !== undefined && { topic: n.topic }), ...(n.type && { type: n.type }), ...(n.map && { map: n.map }), ...(n.actor && { by: n.actor }), ...(n.target && { of: n.target }), ...(n.item && { thing: n.item }), ...(n.tags && { tags: n.tags.join(',') }) },
          origin: 'world',
        })
        if (this.begins(n.kind) && this.w.get('story')) this.eng.queue(ev('story'))
        for (const q of this.all()) {
          const s = this.stateOf(q)
          if (s !== 'active' && s !== 'offered') continue
          const d = this.defOf(q)
          if (!d || !this.listening(q, d).has(n.kind) || !this.concerns(q, n)) continue
          this.eng.queue(ev(q.id))
        }
      }
    } finally {
      this.flushing = false
    }
  }

  /** The seen event's news, read back. */
  private newsOf(ev: GameEvent): News | undefined {
    const p = ev.params ?? {}
    if (typeof p.news !== 'string') return undefined
    const s = (v: PropValue | undefined) => (typeof v === 'string' && v ? v : undefined)
    return { kind: p.news as NewsKind, actor: s(p.by), target: s(p.of), item: s(p.thing), key: s(p.key), topic: s(p.topic), type: s(p.type), map: s(p.map), tags: typeof p.tags === 'string' && p.tags ? p.tags.split(',') : undefined }
  }

  /** The clock's news: the morning and the evening (radiant quests begin on them). */
  tick(): void {
    if (!this.defs.length) return
    const h = Math.floor(this.w.hour())
    if (h === this.lastHour) return
    const was = this.lastHour
    this.lastHour = h
    if (was < 0) return
    if (h === 6) this.news({ kind: 'morning' })
    if (h === 20) this.news({ kind: 'night' })
  }

  // ---------------------------------------------------------------- the quest's own outcomes

  /** `advance`: a quest sees news (its outcome): what it counts, the objectives it marks done, the stage it reaches. */
  advance(ev: GameEvent): void {
    const q = this.host(ev)
    const d = q && this.defOf(q)
    if (!q || !d) return
    const n = this.newsOf(ev)
    const state = this.stateOf(q)
    // an offer whose people are gone is withdrawn
    if (state === 'offered') {
      if (n?.kind === 'gone' && Object.keys(d.aliases ?? {}).some((a) => this.alias(q, a) === n.target)) this.withdraw(q)
      return
    }
    if (state !== 'active') return
    this.look(q, d, n, ev)
  }

  /** The quest looks at where it stands: counts, objectives, the next stage (and again, while one holds). */
  private look(q: Entity, d: QuestDef, n: News | undefined, ev: GameEvent): void {
    const w = this.w
    for (let i = 0; i < CHAIN; i++) {
      if (this.stateOf(q) !== 'active') return
      // counts: kills of a class by the taker
      if (n?.kind === 'kill' && n.actor === this.alias(q, 'player'))
        for (const o of d.objectives ?? []) {
          const c = o.count
          if (!c || !('kill' in c) || !this.shown(q, o) || q.props?.[`obj.${o.id}`] === 'done') continue
          if (c.map && n.map !== c.map) continue
          if (!this.matches(c.kill, n.target, n)) continue
          const have = w.num(q, `count.${o.id}`)
          if (have < (o.need ?? 1)) w.setProp(q, `count.${o.id}`, have + 1)
        }
      // objectives a trigger marks done (a word with someone: they say their line)
      for (const o of d.objectives ?? []) {
        if (!o.on || !this.shown(q, o) || q.props?.[`obj.${o.id}`] === 'done' || q.props?.[`obj.${o.id}`] === 'failed') continue
        if (!this.holds(o.on, q, n)) continue
        w.setProp(q, `obj.${o.id}`, 'done')
        if (o.say) this.say(q, o.say, typeof o.target === 'string' ? o.target : o.target?.[0], n)
        this.changed(q)
      }
      const s = this.next(q, d).find((st) => this.holds(st.on, q, n))
      if (!s) return
      // a stage the state alone reaches leaves the news unspent (a word with the giver, heard as everything came
      // together, is still the hand-in); one the news reached spends it, and the rest is the state, looked at again
      const spent = !this.holds(s.on, q)
      this.reach(q, d, s, ev, n)
      if (spent) n = undefined
    }
  }

  /** `stage`: a notice sets the quest's stage (Bethesda's SetStage, by notice: the quest answers). */
  setStage(ev: GameEvent, n: number): void {
    const q = this.host(ev)
    const d = q && this.defOf(q)
    if (!q || !d) return
    const s = d.stages.find((x) => x.n === n)
    if (!s || this.w.num(q, 'stage') >= n) return
    if (this.stateOf(q) === 'offered') this.w.setProp(q, 'state', 'active')
    if (this.stateOf(q) !== 'active') return
    this.reach(q, d, s, ev)
    this.look(q, d, undefined, ev)
  }

  /** A stage reached: the journal's line, the objectives, what is handed over and paid, said and done. */
  private reach(q: Entity, d: QuestDef, s: QuestStage, ev: GameEvent, n?: News): void {
    const w = this.w
    const eng = this.eng
    const taker = this.taker(q)
    w.setProp(q, 'stage', s.n)
    w.setProp(q, `stage.${s.n}`, w.state.tick)
    for (const id of s.show ?? []) if (!q.props?.[`obj.${id}`]) w.setProp(q, `obj.${id}`, 'shown')
    for (const id of s.done ?? []) w.setProp(q, `obj.${id}`, 'done')
    for (const id of s.fail ?? []) w.setProp(q, `obj.${id}`, 'failed')
    const depth = (ev.depth ?? 0) + 1
    const send = (kind: GameEvent['kind'], to: Id, params: Record<string, PropValue>, roles: GameEvent['roles'] = {}) =>
      eng.queue({ kind, host: { e: to }, roles, params, cause: ev.cause, origin: ev.origin, depth })
    // what is handed over: each thing moves itself into the one it goes to
    for (const t of s.take ?? []) {
      const to = this.alias(q, t.to ?? this.giverAlias(d))
      const from = t.from ? this.aliasEntity(q, t.from) : taker
      const items = this.carried(from).filter((e) => (typeof t.match === 'string' ? e.id === this.alias(q, t.match) : matchSelector(t.match, w.view({ e: e.id }))))
      if (to && from) for (const e of items.slice(0, t.count)) send('impulse/taken', e.id, { into: 'contents', quiet: true }, { other: { e: to }, actor: { e: to } })
    }
    const r = s.reward
    if (r && taker) {
      if (r.xp) send('impulse/notify', taker.id, { what: 'reward', xp: r.xp }, { source: { e: q.id } })
      for (const it of r.items ?? [])
        for (let i = 0; i < it.count; i++) {
          const made = w.create(it.type, { on: 'inside', holder: taker.id }, { ...(it.name && { name: it.name }), ...(it.tags && { tags: [...it.tags] }), ...(it.props && { props: { ...it.props } }) })
          eng.touch({ e: made.id })
        }
      for (const [a, delta] of Object.entries(r.regard ?? {})) {
        const who = this.alias(q, a)
        if (who && who !== taker.id) send('impulse/notify', who, { what: 'regard', delta }, { actor: { e: taker.id }, source: { e: q.id } })
      }
      const karma = r.karma ?? (Object.values(r.regard ?? {}).some((d) => d > 0) ? 3 : 0)
      if (karma) send('impulse/notify', taker.id, { what: 'karma', delta: karma }, { source: { e: q.id } })
      if (r.faith) send('impulse/notify', taker.id, { what: 'faith', delta: r.faith }, { source: { e: q.id } })
    }
    if (r?.facts && Object.keys(r.facts).length) send('impulse/notify', 'story', { what: 'facts', ...Object.fromEntries(Object.entries(r.facts).map(([k, v]) => [`fact.${k}`, v])) }, { source: { e: q.id } })
    if (s.say) this.say(q, s.say, s.by, n)
    if (s.do?.length) eng.effects.run(s.do, { ...ev, host: { e: q.id }, roles: { ...ev.roles, ...(taker && { target: { e: taker.id } }) } }, `quest/${d.id}`)
    const title = (l: 'en' | 'zh') => txt(d.title, l)
    if (s.failed) {
      w.setProp(q, 'state', 'failed')
      w.setProp(q, 'ended', w.state.tick)
      w.fx.push({ t: 'log', text: { en: `Quest failed: ${title('en')}`, zh: `任务失败：${title('zh')}` }, tone: 'bad' })
    } else if (s.complete) {
      w.setProp(q, 'state', 'done')
      w.setProp(q, 'ended', w.state.tick)
      if (d.repeat === 'daily') w.setProp(q, 'day', w.calendar().day)
      w.fx.push({ t: 'log', text: { en: `Quest complete: ${title('en')}`, zh: `完成任务：${title('zh')}` }, tone: 'good' })
    }
    if (s.failed || s.complete) if (w.hasStatus({ e: q.id }, 'due')) w.clearStatus({ e: q.id }, 'due')
    w.fx.push({ t: 'quest', id: q.id, stage: s.n, state: this.stateOf(q) ?? 'active' })
    this.changed(q)
  }

  /** A line said for the quest: by an alias, else the one spoken to (the news's), else the giver. */
  private say(q: Entity, text: Text, by: string | undefined, n?: News): void {
    const d = this.defOf(q)
    const who = (by && this.alias(q, by)) ?? (n?.kind === 'talk' ? n.target : undefined) ?? (d && this.alias(q, this.giverAlias(d)))
    if (who && this.w.get(who)) this.w.fx.push({ t: 'say', who, text })
  }

  /** The quest changed: the others hear (their `quest` triggers), and what it holds is looked at again. */
  private changed(q: Entity): void {
    this.tagCache = undefined
    this.news({ kind: 'quest', key: String(q.props?.quest ?? '') })
  }

  private host(ev: GameEvent): Entity | undefined {
    const q = 'e' in ev.host ? this.w.get(ev.host.e) : undefined
    return q?.type === QUEST_TYPE ? q : undefined
  }

  /** `accept`: an offer taken on by the actor (its first stage). */
  accept(ev: GameEvent): void {
    const q = this.host(ev)
    const d = q && this.defOf(q)
    const who = ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : this.w.state.player
    if (!q || !d || this.stateOf(q) !== 'offered') return
    this.w.setProp(q, 'by', who)
    this.w.setProp(q, 'state', 'active')
    this.w.setProp(q, 'since', this.w.state.tick)
    this.make(q, d, who)
    if (d.deadline) this.w.setStatus({ e: q.id }, 'due', this.w.state.tick + Math.round(d.deadline * TICKS_PER_HOUR))
    this.w.fx.push({ t: 'log', text: { en: `Quest taken: ${txt(d.title, 'en')}`, zh: `接受任务：${txt(d.title, 'zh')}` }, tone: 'good' })
    this.reach(q, d, d.stages[0], ev)
    this.look(q, d, undefined, ev)
  }

  /** `decline`: an offer turned down (a radiant one is withdrawn). */
  decline(ev: GameEvent): void {
    const q = this.host(ev)
    if (q && this.stateOf(q) === 'offered') this.withdraw(q)
  }

  private withdraw(q: Entity): void {
    this.tagCache = undefined
    this.w.destroy(q)
  }

  /** `failQuest`: past its deadline (or told so): an offer is withdrawn; a quest under way fails (its failing stage, if it has one). */
  fail(ev: GameEvent): void {
    const q = this.host(ev)
    const d = q && this.defOf(q)
    if (!q || !d) return
    const s = this.stateOf(q)
    if (s === 'offered') return this.withdraw(q)
    if (s !== 'active') return
    // a failing stage for this (one with no trigger of its own: a deadline's, a notice's), else the quest simply fails
    const stage = d.stages.find((x) => x.failed && !x.on && x.n > this.w.num(q, 'stage'))
    if (stage) return this.reach(q, d, stage, ev)
    this.reach(q, d, { n: this.w.num(q, 'stage') + 1, failed: true, log: { en: 'It came to nothing.', zh: '这件事没能办成。' } }, ev)
  }

  // ---------------------------------------------------------------- beginning (the Story Manager)

  /** The latest of a definition's quests (the one a repeat is measured by). */
  latest(id: string): Entity | undefined {
    return this.of(id).sort((a, b) => this.w.num(b, 'since') - this.w.num(a, 'since') || this.w.num(b, 'n') - this.w.num(a, 'n'))[0]
  }

  /** May a definition begin (again) now? */
  private open(d: QuestDef): boolean {
    if ('news' in d.start) return true
    const q = this.latest(d.id)
    if (!q) return true
    const s = this.stateOf(q)
    if (s === 'active' || s === 'offered') return false
    if (d.repeat === 'always') return true
    if (d.repeat === 'daily') return q.props?.day !== this.w.calendar().day
    return false
  }

  /**
   * `begin`: the story sees news (its outcome): the `auto` quests whose trigger now holds begin; on a
   * radiant quest's news, if the roll and its cap allow and its aliases fill, an offer is made.
   */
  begin(ev: GameEvent): void {
    const n = this.newsOf(ev)
    for (const d of this.defs) {
      const s = d.start
      if (!this.open(d)) continue
      if ('auto' in s) {
        if (this.holds(s.auto, this.probe(d), n)) this.start(d, ev, { taker: this.w.state.player })
      } else if ('news' in s && n?.kind === s.news) {
        const live = this.of(d.id).filter((q) => ['offered', 'active'].includes(this.stateOf(q) ?? '')).length
        if (live >= (s.most ?? 1)) continue
        if (s.chance !== undefined && this.w.rand() >= s.chance) continue
        if (s.when && !this.holds(s.when, this.probe(d), n)) continue
        this.start(d, ev, { offer: true, news: n })
      }
    }
  }

  /**
   * A stand-in for a quest not yet begun: its triggers read the taker as the player, and an alias that names
   * one thing as that thing (a quest that begins when its giver is spoken to).
   */
  private probe(d: QuestDef): Entity {
    const fixed = Object.fromEntries(Object.entries(d.aliases ?? {}).flatMap(([k, a]) => (a.id ? [[`alias.${k}`, a.id]] : [])))
    return { id: questId(d.id), type: QUEST_TYPE, place: { on: 'resident' }, props: { quest: d.id, by: this.w.state.player, ...fixed } } as Entity
  }

  /**
   * `startQuest`: a quest begins, or is offered (made by the outcome running: the story's, or a
   * quest's) — its aliases filled, else it does not begin. Its first stage is reached as its own
   * outcome (a notice), so what that stage says and does is the quest's.
   */
  start(d: QuestDef, ev: GameEvent, how: { taker?: Id; offer?: boolean; news?: News; giver?: Id }): Entity | undefined {
    const w = this.w
    const eng = this.eng
    const radiant = 'news' in d.start
    // the first of a definition is `quest.<id>`; a radiant one, or one begun again, is numbered
    const n = radiant || w.get(questId(d.id)) ? 1 + Math.max(0, ...this.of(d.id).map((q) => w.num(q, 'n'))) : undefined
    const id = questId(d.id, n)
    const fills: Record<string, string> = {}
    const taken = new Set<string>()
    const by = how.taker ?? w.state.player
    // the aliases that are found first, then the ones made (nothing is made for a quest that cannot begin)
    for (const [name, a] of Object.entries(d.aliases ?? {})) {
      let v: string | undefined
      if (a.id) v = w.get(a.id) && w.get(a.id)!.place.on !== 'none' ? a.id : undefined
      else if (a.place) v = a.place
      else if (a.from) v = how.news?.[a.from]
      else if (a.find) v = this.find(a.find, fills, taken, by)
      else if (a.make) continue
      if (name === 'giver' && how.giver) v = how.giver
      if (v && a.match && !matchSelector(a.match, w.view({ e: v }))) v = undefined
      if (!v && !a.optional) return undefined
      if (v) (fills[name] = v), taken.add(v)
    }
    // one quest of a kind about one thing at a time (two favours for one theft are one too many)
    if (radiant) for (const q of this.of(d.id)) if (['offered', 'active'].includes(this.stateOf(q) ?? '') && Object.entries(fills).every(([k, v]) => q.props?.[`alias.${k}`] === v)) return undefined
    const q = w.add({ id, type: QUEST_TYPE, name: d.title, place: { on: 'resident' }, props: { quest: d.id, state: how.offer ? 'offered' : 'active', stage: 0, by, since: w.state.tick, ...(n !== undefined && { n }) } })
    eng.touch({ e: q.id })
    for (const [k, v] of Object.entries(fills)) w.setProp(q, `alias.${k}`, v)
    // what is made for it is made when it is taken on (an offer turned down leaves nothing behind)
    if (!how.offer) this.make(q, d, by)
    this.tagCache = undefined
    if (how.offer) {
      // an offer waits a while for a word, then is withdrawn
      if (d.deadline) w.setStatus({ e: q.id }, 'due', w.state.tick + Math.round(d.deadline * TICKS_PER_HOUR))
      this.news({ kind: 'quest', key: d.id })
      return q
    }
    if (d.deadline) w.setStatus({ e: q.id }, 'due', w.state.tick + Math.round(d.deadline * TICKS_PER_HOUR))
    if (d.kind === 'guide') w.fx.push({ t: 'log', text: { en: `New guide: ${txt(d.title, 'en')}`, zh: `新的指引：${txt(d.title, 'zh')}` }, tone: 'good' })
    else if (d.kind !== 'main' || d.stages[0]?.log) w.fx.push({ t: 'log', text: { en: `Quest taken: ${txt(d.title, 'en')}`, zh: `接受任务：${txt(d.title, 'zh')}` }, tone: 'good' })
    // its first stage is its own outcome
    eng.queue({ kind: 'impulse/notify', host: { e: q.id }, roles: { actor: { e: by } }, params: { what: 'stage', n: d.stages[0].n }, cause: ev.cause, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
    return q
  }

  /** The aliases a quest makes (a letter to carry), made as it is taken on: in an alias's bag, or at a spot. */
  private make(q: Entity, d: QuestDef, by: Id): void {
    const w = this.w
    for (const [name, a] of Object.entries(d.aliases ?? {})) {
      const m = a.make
      if (!m || this.alias(q, name)) continue
      const holder = m.in ? (m.in === 'player' ? by : this.alias(q, m.in)) : undefined
      const place = holder ? ({ on: 'inside', holder } as const) : m.at ? ({ on: 'tile', map: m.at.map, x: m.at.x, y: m.at.y } as const) : undefined
      if (!place) continue
      const made = w.create(m.type, place, { ...(m.name && { name: this.fill(q, m.name) }), ...(m.tags && { tags: [...m.tags] }), ...(m.props && { props: { ...m.props } }) })
      this.eng.touch({ e: made.id })
      w.setProp(q, `alias.${name}`, made.id)
    }
  }

  /** The first (nearest to the taker, or a random) thing matching, not another alias's. */
  private find(f: NonNullable<AliasDef['find']>, fills: Record<string, string>, taken: Set<string>, by: Id): string | undefined {
    const w = this.w
    const near = f.near ? w.get(f.near === 'player' ? by : fills[f.near]) : w.get(by)
    const at = w.posOf(near)
    const out: { e: Entity; d: number }[] = []
    for (const e of Object.values(w.state.entities)) {
      if (taken.has(e.id) || e.id === by || e.place.on === 'none' || e.type === QUEST_TYPE) continue
      if (f.person && !e.npc) continue
      const p = w.posOf(e)
      if (f.map && p?.map !== f.map) continue
      if (!matchSelector(f, w.view({ e: e.id }))) continue
      out.push({ e, d: p && at && p.map === at.map ? Math.abs(p.x - at.x) + Math.abs(p.y - at.y) : 1e6 })
    }
    if (!out.length) return undefined
    if (f.pick === 'random') return out[Math.floor(w.rand() * out.length)].e.id
    out.sort((a, b) => a.d - b.d || (a.e.id < b.e.id ? -1 : 1))
    return out[0].e.id
  }

  /** A quest is offered by an alias (authored: its definition, when its trigger holds): may the speaker take it on? */
  private offerable(d: QuestDef, giver: Id, who: Entity): boolean {
    const s = d.start
    if (!('offer' in s) || 'news' in s) return false
    if (d.aliases?.[s.offer]?.id !== giver) return false
    if (!this.open(d)) return false
    if (s.level && this.w.num(who, 'level', 1) < s.level) return false
    return !s.when || this.holds(s.when, this.probe(d))
  }

  // ---------------------------------------------------------------- talking (docs/quests.md §2.4)

  /** The offers one has for a speaker: authored ones they give, radiant ones that sit with them. */
  offers(giver: Id, who: Entity): QuestOffer[] {
    const out: QuestOffer[] = []
    for (const d of this.defs) if (this.offerable(d, giver, who)) out.push({ ref: d.id, title: d.title, summary: d.summary, giver })
    for (const q of this.all()) {
      const d = this.defOf(q)
      if (!d || this.stateOf(q) !== 'offered' || this.alias(q, this.giverAlias(d)) !== giver) continue
      out.push({ ref: q.id, title: d.title, summary: this.fill(q, d.summary), giver })
    }
    return out
  }

  /** The radiant offers on the board: every one on offer, whoever offers it. */
  board(): QuestOffer[] {
    const out: QuestOffer[] = []
    for (const q of this.all()) {
      const d = this.defOf(q)
      if (!d || this.stateOf(q) !== 'offered') continue
      out.push({ ref: q.id, title: d.title, summary: this.fill(q, d.summary), giver: this.alias(q, this.giverAlias(d)) })
    }
    return out
  }

  /** The topics a person has for a speaker, of the quests under way (Bethesda's quest dialogue). */
  topics(person: Id, who: Entity): { ref: string; topic: string; label: Text }[] {
    const out: { ref: string; topic: string; label: Text }[] = []
    for (const q of this.active()) {
      const d = this.defOf(q)
      if (!d?.topics || this.alias(q, 'player') !== who.id) continue
      for (const t of d.topics) {
        if (this.alias(q, t.with) !== person) continue
        if (t.at !== undefined && !cmp(this.w.num(q, 'stage'), t.at)) continue
        // only a topic something answers now (a stage or an objective of the quest's waits on it)
        const n: News = { kind: 'talk', actor: who.id, target: person, topic: t.id }
        const answered = this.next(q, d).some((s) => this.holds(s.on, q, n)) || (d.objectives ?? []).some((o) => o.on && this.shown(q, o) && q.props?.[`obj.${o.id}`] !== 'done' && this.holds(o.on, q, n))
        if (answered) out.push({ ref: q.id, topic: t.id, label: t.label })
      }
    }
    return out
  }

  /**
   * What a person spoken to has with the speaker (read only: the person's `quest` primitive acts on it):
   * a quest under way that this word moves on (a hand-in, someone a quest sent them to), else offers,
   * else the line of a quest of theirs under way.
   */
  business(person: Id, who: Entity): { quest?: Entity; offers: QuestOffer[]; waiting?: Text } {
    const n: News = { kind: 'talk', actor: who.id, target: person }
    for (const q of this.active()) {
      const d = this.defOf(q)
      if (!d || this.alias(q, 'player') !== who.id) continue
      if (this.next(q, d).some((s) => this.holds(s.on, q, n))) return { quest: q, offers: [] }
      if ((d.objectives ?? []).some((o) => o.on && this.shown(q, o) && q.props?.[`obj.${o.id}`] !== 'done' && q.props?.[`obj.${o.id}`] !== 'failed' && this.holds(o.on, q, n))) return { quest: q, offers: [] }
    }
    const offers = this.offers(person, who)
    if (offers.length) return { offers }
    for (const q of this.active()) {
      const d = this.defOf(q)
      if (d?.waiting && this.alias(q, this.giverAlias(d)) === person && this.alias(q, 'player') === who.id) return { offers: [], waiting: d.waiting }
    }
    return { offers: [] }
  }

  /** What the giver says of an offer (its own line, else its summary). */
  offerLine(ref: string): Text | undefined {
    const q = this.w.get(ref)
    const d = q ? this.defOf(q) : this.def(ref)
    if (!d) return undefined
    return d.offer ? (q ? this.fill(q, d.offer) : d.offer) : q ? this.fill(q, d.summary) : d.summary
  }

  // ---------------------------------------------------------------- the player's view

  /** Text with its aliases named ({giver}, {item}). */
  fill(q: Entity, t: Text): Text {
    const name = (a: string, l: 'en' | 'zh') => {
      const id = this.alias(q, a)
      if (!id) return a
      const e = this.w.get(id)
      if (e) return this.eng.nameOf({ e: id }, l)
      const i = id.indexOf(':')
      const m = this.w.map(i < 0 ? id : id.slice(0, i)) ?? this.eng.maps[i < 0 ? id : id.slice(0, i)]
      return m ? txt(m.name, l) : id
    }
    const sub = (s: string, l: 'en' | 'zh') => s.replace(/\{(\w+)\}/g, (_, a: string) => name(a, l))
    return typeof t === 'string' ? sub(t, 'en') : { en: sub(t.en, 'en'), ...(t.zh && { zh: sub(t.zh, 'zh') }) }
  }

  /** The quest the player follows: the one they chose, else the latest main quest under way, else the latest under way. */
  tracked(): Entity | undefined {
    const w = this.w
    const mine = this.active().filter((q) => this.alias(q, 'player') === w.state.player)
    const chosen = w.prop(w.player, 'track')
    const pick = mine.find((q) => q.id === chosen)
    if (pick) return pick
    const latest = (list: Entity[]) => list.sort((a, b) => w.num(b, 'since') - w.num(a, 'since'))[0]
    return latest(mine.filter((q) => this.defOf(q)?.kind === 'main')) ?? latest(mine)
  }

  /** The objectives the journal shows of a quest. */
  private objectives(q: Entity, d: QuestDef): JournalQuest['objectives'] {
    const out: JournalQuest['objectives'] = []
    for (const o of d.objectives ?? []) {
      if (!this.shown(q, o)) continue
      const s = q.props?.[`obj.${o.id}`]
      const p = this.progress(q, o)
      const state = s === 'failed' ? 'failed' : this.objectiveDone(q, o) ? 'done' : 'open'
      const where = this.whereOf(q, o)
      out.push({ id: o.id, text: this.fill(q, o.text), state, ...(p && p.need > 1 && { have: p.have, need: p.need }), ...(where && { where }), ...(o.optional && { optional: true }) })
    }
    return out
  }

  /** The map an objective's target is on, when it is not the player's (the tracker names it). */
  private whereOf(q: Entity, o: ObjectiveDef): Text | undefined {
    const t = this.targetsOf(q, o)[0]
    const here = this.w.posOf(this.w.player)?.map
    if (!t || t.map === here) return undefined
    return this.w.map(t.map)?.name ?? this.eng.maps[t.map]?.name
  }

  /** The journal: every quest the player took on (under way, done, failed), with its log. */
  journal(): JournalQuest[] {
    const w = this.w
    const tracked = this.tracked()?.id
    const out: JournalQuest[] = []
    for (const q of this.all()) {
      const d = this.defOf(q)
      const state = this.stateOf(q)
      if (!d || !state || state === 'offered' || this.alias(q, 'player') !== w.state.player) continue
      const log: JournalQuest['log'] = []
      for (const s of d.stages) {
        const at = q.props?.[`stage.${s.n}`]
        if (typeof at === 'number' && s.log) log.push({ stage: s.n, text: this.fill(q, s.log), tick: at })
      }
      // a quest that failed with no failing stage of its own: it came to nothing
      if (state === 'failed' && !d.stages.some((s) => s.failed && typeof q.props?.[`stage.${s.n}`] === 'number'))
        log.push({ stage: this.w.num(q, 'stage'), text: { en: 'It came to nothing.', zh: '这件事没能办成。' }, tick: this.w.num(q, 'ended') })
      log.sort((a, b) => a.tick - b.tick || a.stage - b.stage)
      const giver = this.aliasEntity(q, this.giverAlias(d))
      const stage = state === 'active' ? d.stages.find((x) => x.n === w.num(q, 'stage')) : undefined
      const hint = stage && (stage.hint ?? stage.log)
      out.push({ id: q.id, quest: d.id, kind: d.kind, title: d.title, summary: this.fill(q, d.summary), state, tracked: q.id === tracked, ...(giver && giver.id !== w.state.player && { giver: { en: this.eng.nameOf({ e: giver.id }, 'en'), zh: this.eng.nameOf({ e: giver.id }, 'zh') } }), objectives: this.objectives(q, d), log, ...(hint && { hint: this.fill(q, hint) }) })
    }
    return out.sort((a, b) => w.num(w.get(b.id)!, 'since') - w.num(w.get(a.id)!, 'since'))
  }

  /** Where an objective points: its targets' places (an alias's thing, or what holds it; an area's middle). */
  private targetsOf(q: Entity, o: ObjectiveDef): { map: string; x: number; y: number }[] {
    const w = this.w
    const out: { map: string; x: number; y: number }[] = []
    for (const a of typeof o.target === 'string' ? [o.target] : (o.target ?? [])) {
      const id = this.alias(q, a)
      if (!id) continue
      const e = w.get(id)
      if (e) {
        const p = w.posOf(e)
        if (p && e.place.on !== 'resident') out.push({ map: p.map, x: p.x, y: p.y })
        continue
      }
      const i = id.indexOf(':')
      const map = i < 0 ? id : id.slice(0, i)
      // a map not loaded here yet: its middle, as the world's index knows it
      const m = w.map(map) ?? this.eng.maps[map]
      if (!m) continue
      const r = i < 0 ? undefined : m.regions?.[id.slice(i + 1)]
      out.push(r ? { map, x: r[0] + Math.floor(r[2] / 2), y: r[1] + Math.floor(r[3] / 2) } : { map, x: Math.floor(m.width / 2), y: Math.floor(m.height / 2) })
    }
    return out
  }

  /** The markers: the tracked quest's open objectives' targets. */
  targets(): QuestTarget[] {
    const q = this.tracked()
    const d = q && this.defOf(q)
    if (!q || !d) return []
    const out: QuestTarget[] = []
    const at = new Set<string>()
    for (const o of d.objectives ?? []) {
      if (!this.shown(q, o) || this.objectiveDone(q, o) || q.props?.[`obj.${o.id}`] === 'failed') continue
      // one marker for one spot (the beef and the eggs on one grassland)
      for (const t of this.targetsOf(q, o)) if (!at.has(`${t.map}:${t.x}:${t.y}`)) (at.add(`${t.map}:${t.x}:${t.y}`), out.push({ objective: o.id, text: this.fill(q, o.text), ...t }))
    }
    return out
  }

  /**
   * The mark over a person: '?' when a word with them moves a quest on now (a hand-in, someone a quest sent you to),
   * else '!' for an offer, else '?' when an open objective points at them as someone to speak to.
   */
  mark(person: Id): '!' | '?' | undefined {
    const w = this.w
    const who = w.player
    if (this.business(person, who).quest) return '?'
    if (this.offers(person, who).length) return '!'
    for (const q of this.active()) {
      const d = this.defOf(q)
      if (!d || this.alias(q, 'player') !== who.id) continue
      for (const o of d.objectives ?? [])
        if (o.talk && this.shown(q, o) && !this.objectiveDone(q, o) && q.props?.[`obj.${o.id}`] !== 'failed' && (typeof o.target === 'string' ? [o.target] : (o.target ?? [])).some((a) => this.alias(q, a) === person)) return '?'
    }
    return undefined
  }

  /** The tracked quest's objective, as the companion tells it: "Now: … (planks 1/3)". */
  objective(): Text | undefined {
    const q = this.tracked()
    const d = q && this.defOf(q)
    if (!q || !d) return undefined
    const open = this.objectives(q, d).filter((o) => o.state === 'open')
    const stage = d.stages.find((s) => s.n === this.w.num(q, 'stage'))
    const hint = stage?.hint ?? stage?.log
    const text = (l: 'en' | 'zh') => {
      const goals = open.map((o) => `${txt(o.text, l)}${o.need ? ` ${o.have}/${o.need}` : ''}`)
      const head = l === 'zh' ? `现在要：${txt(d.title, l)}。` : `Now: ${txt(d.title, l)}.`
      const body = goals.length ? (l === 'zh' ? goals.join('；') + '。' : goals.join('; ') + '.') : ''
      return [head, body, hint ? txt(this.fill(q, hint), l) : ''].filter(Boolean).join(l === 'zh' ? '' : ' ')
    }
    return { en: text('en'), zh: text('zh') }
  }

  /** The stage's hint of the tracked quest (the companion's word, between objectives). */
  hint(): Text | undefined {
    const q = this.tracked()
    const d = q && this.defOf(q)
    const s = d?.stages.find((x) => x.n === this.w.num(q!, 'stage'))
    return s && q ? (s.hint ?? s.log) && this.fill(q, (s.hint ?? s.log)!) : undefined
  }

  /** The lessons at hand: those of the current stage of the first quest under way that has any. */
  lessons(): Lesson[] {
    const qs = this.active().sort((a, b) => (this.defOf(a)?.kind === 'main' ? 0 : 1) - (this.defOf(b)?.kind === 'main' ? 0 : 1))
    for (const q of qs) {
      const d = this.defOf(q)
      const s = d?.stages.find((x) => x.n === this.w.num(q, 'stage'))
      if (s?.lessons?.length) return s.lessons
    }
    return []
  }

  // ---------------------------------------------------------------- what quests make of people and things

  /** The tags a quest under way gives a thing: `essential` to those it cannot lose, `quest-item` to what it keeps. */
  tagsOf(id: Id): string[] | undefined {
    if (!this.tagCache) {
      const m = new Map<Id, string[]>()
      for (const q of this.active()) {
        const d = this.defOf(q)
        for (const [name, a] of Object.entries(d?.aliases ?? {})) {
          if (!a.essential && !a.keep) continue
          const v = this.alias(q, name)
          if (!v) continue
          const tags = m.get(v) ?? []
          if (a.essential && !tags.includes('essential')) tags.push('essential')
          if (a.keep && !tags.includes('quest-item')) tags.push('quest-item')
          m.set(v, tags)
        }
      }
      this.tagCache = m
    }
    return this.tagCache.get(id)
  }

  /** The quests a summary names (a save's slot): the tracked one's title and its first open objective. */
  summary(): { title?: Text; objective?: Text } {
    const q = this.tracked()
    const d = q && this.defOf(q)
    if (!q || !d) return {}
    const open = this.objectives(q, d).find((o) => o.state === 'open')
    return { title: d.title, ...(open && { objective: open.text }) }
  }

  /** The author sets a quest where a test or the world's start wants it: under way at a stage (no outcome: no lines, no rewards), or over. */
  put(id: string, stage: number | 'done', taker: Id = this.w.state.player): Entity {
    const w = this.w
    const d = this.def(id)
    if (!d) throw new Error(`no quest ${id}`)
    let q = w.get(questId(id))
    if (!q) q = w.add({ id: questId(id), type: QUEST_TYPE, name: d.title, place: { on: 'resident' }, props: { quest: id, state: 'active', stage: 0, by: taker, since: w.state.tick } })
    for (const [name, a] of Object.entries(d.aliases ?? {})) if (a.id || a.place) w.setProp(q, `alias.${name}`, (a.id ?? a.place)!)
    const upto = stage === 'done' ? Math.max(...d.stages.filter((s) => s.complete).map((s) => s.n), ...d.stages.map((s) => s.n)) : stage
    for (const s of d.stages) {
      if (s.n > upto || s.failed) continue
      w.setProp(q, `stage.${s.n}`, w.state.tick)
      for (const o of s.show ?? []) w.setProp(q, `obj.${o}`, 'shown')
      for (const o of s.done ?? []) w.setProp(q, `obj.${o}`, 'done')
    }
    w.setProp(q, 'stage', stage === 'done' ? d.stages.find((s) => s.complete)?.n ?? upto : upto)
    w.setProp(q, 'state', stage === 'done' ? 'done' : 'active')
    this.tagCache = undefined
    // the others hear of it (what begins once it is over begins)
    this.news({ kind: 'quest', key: id })
    return q
  }
}
