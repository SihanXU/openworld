// Quests (docs/quests.md): content lays out who gives what, what it asks and what it pays; the
// story keeps the state in its facts (design.md §5.5: the story's facts belong to the story).
//
//   q.<id>              'active' | 'done'
//   q.<id>.by           who took it on (their defeats count, they hand it in)
//   q.<id>.<goal>       a defeat goal's count, or 1 when a talk goal is met
//   q.<id>.day          the day a repeatable quest was last handed in
//
// Every change is an outcome (design.md §5.13, A2–A3): a person spoken to (the `quest` primitive,
// the person's own rule) tells the story there is business between them and the speaker; the
// story's `quests` primitive settles it — and counts a defeat it is told of — writing only its
// facts. What it pays goes as the world's other changes go: the reward is spawned into the
// taker's bag, the taker is notified of its experience and stage (and answers itself), and what
// was to be brought is taken by the giver.
//
// A quest is `available` when its requirements hold and it is not active (a repeatable one: not
// handed in today), `ready` when every goal is met, and handed in to its giver (or `turnIn`).
// The story's own pass, now and then (`advance`): a quest the story has gone past is done (`skipWhen`), an
// `auto` one available is taken on, a `self` one ready completes — so a main line never waits on a word.
// E on a person who has something for you does it: hand in what is ready, else meet a talk goal
// (a quest under way sent you to them), else take on what is offered, else they just talk. People with a quest to give show "!",
// with one to take back "?".

import type { Engine } from './engine.ts'
import { cmp } from './rules.ts'
import type { Cmp, Entity, GameEvent, Id, PropValue, Text } from './types.ts'

export type QuestKind = 'main' | 'side' | 'repeat'

export type QuestGoal =
  /** Fell creatures of a type (a prefix), optionally on one map. */
  | { id: string; kind: 'defeat'; type: string; map?: string; count: number; label: Text }
  /** Have things of a type (and, if given, with these tags) on you when you hand in (taken by the giver if `consume`). */
  | { id: string; kind: 'carry'; type: string; tags?: string[]; count: number; consume?: boolean; label: Text }
  /** Speak to someone (E) while the quest is active: they say `line`. */
  | { id: string; kind: 'talk'; npc: Id; line: Text; label: Text }
  /** A world fact reaches a value. */
  | { id: string; kind: 'fact'; fact: string; count: number; label: Text }

export interface QuestDef {
  id: string
  kind: QuestKind
  title: Text
  /** What it is about, for the quest log. */
  summary: Text
  giver: Id
  /** Who takes it back (default: the giver). */
  turnIn?: Id
  requires?: { facts?: Record<string, Cmp>; quests?: string[]; level?: number }
  /** Taken on by itself as soon as it is available (a main line that carries on with no word from anyone). */
  auto?: boolean
  /** Complete by itself once every goal is met, with no handing in (its giver need not be spoken to). */
  self?: boolean
  /**
   * The story has gone past it: when these facts hold it is done, whatever its goals (its reward's
   * facts are set, nothing is paid) — the player who skips ahead finds the road behind them closed.
   */
  skipWhen?: Record<string, Cmp>
  /** Said by the giver when the quest is taken on. */
  offer: Text
  /** Said by the giver when spoken to before it is done. */
  waiting?: Text
  /** Said when it is handed in. */
  done: Text
  goals: QuestGoal[]
  /** What it pays; an item may be a named piece (its own name, tags such as its quality, props such as its defence). */
  reward?: { xp?: number; items?: { type: string; count: number; name?: Text; tags?: string[]; props?: Record<string, PropValue> }[]; facts?: Record<string, PropValue>; props?: Record<string, PropValue> }
}

export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done'

export interface QuestView {
  id: string
  kind: QuestKind
  title: Text
  summary: Text
  status: QuestStatus
  giver: Id
  goals: { label: Text; have: number; need: number }[]
}

export class Quests {
  defs: QuestDef[] = []

  constructor(private eng: Engine) {}

  load(defs: QuestDef[] | undefined): void {
    this.defs = defs ?? []
  }

  private get w() {
    return this.eng.world
  }

  private carried(type: string, by: Entity = this.w.player, tags: string[] = []): Entity[] {
    return [by.held, ...(by.contents ?? [])].map((id) => this.w.get(id))
      .filter((e): e is Entity => !!e && e.type.startsWith(type) && !e.frozenBy && tags.every((t) => this.w.hasTag(e, t)))
  }

  /** Who took a quest on (the player, for a save from before it was kept). */
  private taker(q: QuestDef): Entity | undefined {
    const by = this.w.fact(`q.${q.id}.by`)
    return this.w.get(typeof by === 'string' ? by : this.w.state.player)
  }

  /** How far a goal is: have / need (what is carried, on the one who took it on). */
  progress(q: QuestDef, g: QuestGoal): { have: number; need: number } {
    const w = this.w
    switch (g.kind) {
      case 'defeat':
        return { have: Math.min(g.count, Number(w.fact(`q.${q.id}.${g.id}`) ?? 0)), need: g.count }
      case 'carry': {
        const t = this.taker(q)
        return { have: Math.min(g.count, t ? this.carried(g.type, t, g.tags).length : 0), need: g.count }
      }
      case 'talk':
        return { have: w.fact(`q.${q.id}.${g.id}`) ? 1 : 0, need: 1 }
      case 'fact':
        return { have: Math.min(g.count, Number(w.fact(g.fact) ?? 0)), need: g.count }
    }
  }

  /** Where a quest stands; whether it is open to `who` (by default the player, whose log and marks these are). */
  status(q: QuestDef, who: Entity = this.w.player): QuestStatus {
    const w = this.w
    const state = w.fact(`q.${q.id}`)
    if (state === 'active') return q.goals.every((g) => { const p = this.progress(q, g); return p.have >= p.need }) ? 'ready' : 'active'
    if (state === 'done' && (q.kind !== 'repeat' || w.fact(`q.${q.id}.day`) === w.calendar().day)) return 'done'
    const r = q.requires
    if (r?.level && w.num(who, 'level', 1) < r.level) return 'locked'
    for (const [k, c] of Object.entries(r?.facts ?? {})) if (!cmp(w.fact(k) ?? 0, c)) return 'locked'
    for (const id of r?.quests ?? []) if (w.fact(`q.${id}`) !== 'done') return 'locked'
    return 'available'
  }

  /** The mark over a person: '!' (a quest to give), '?' (one to take back), or none. */
  mark(npc: Id): '!' | '?' | undefined {
    let give = false
    for (const q of this.defs) {
      const s = this.status(q)
      if (s === 'ready' && (q.turnIn ?? q.giver) === npc) return '?'
      if (s === 'available' && q.giver === npc) give = true
    }
    return give ? '!' : undefined
  }

  /** The quest log: what the player has taken on (and, finished today, the repeatable ones). */
  log(): QuestView[] {
    return this.defs
      .map((q) => ({ q, status: this.status(q) }))
      .filter(({ status }) => status === 'active' || status === 'ready')
      .map(({ q, status }) => ({ id: q.id, kind: q.kind, title: q.title, summary: q.summary, status, giver: q.giver, goals: q.goals.map((g) => ({ label: g.label, ...this.progress(q, g) })) }))
  }

  /** The quests the player has finished, by title (the log's last part: what one has done, at the finale too). */
  done(): Pick<QuestView, 'id' | 'kind' | 'title'>[] {
    return this.defs.filter((q) => this.w.fact(`q.${q.id}`) === 'done').map((q) => ({ id: q.id, kind: q.kind, title: q.title }))
  }

  /**
   * What a person spoken to has with the speaker: something to hand in, to take on, a talk goal
   * (the story settles these), or only a word on how it goes. Read only: the person's own rule.
   */
  business(npc: Id, who: Entity): 'story' | Text | undefined {
    const w = this.w
    for (const q of this.defs) {
      const s = this.status(q, who)
      if ((q.turnIn ?? q.giver) === npc && s === 'ready' && this.taker(q)?.id === who.id) return 'story'
      if (q.giver === npc && s === 'available') return 'story'
      if (s === 'active' && q.goals.some((g) => g.kind === 'talk' && g.npc === npc && !w.fact(`q.${q.id}.${g.id}`))) return 'story'
    }
    for (const q of this.defs) if (q.giver === npc && this.status(q, who) === 'active' && q.waiting) return q.waiting
    return undefined
  }

  /**
   * The story's `quests` primitive (its outcome, on a notice): a word between a giver (the
   * source) and the one who spoke (the actor) — hand in what is ready, else meet a talk goal,
   * else take on what is offered; or a defeat (the actor felled a thing of type `param type`).
   */
  settle(ev: GameEvent): void {
    const w = this.w
    // the story's own pass (no notice: the story looking at its quests)
    if (!ev.params?.what) return this.advance(ev)
    const who = ev.roles.actor && 'e' in ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
    if (!who) return
    if (ev.params?.what === 'defeat') return this.defeat(who, String(ev.params.type ?? ''))
    const npc = ev.roles.source && 'e' in ev.roles.source ? ev.roles.source.e : undefined
    if (!npc) return
    const say = (text: Text) => w.fx.push({ t: 'say', who: npc, text })
    // hand in what is ready
    for (const q of this.defs)
      if ((q.turnIn ?? q.giver) === npc && this.status(q, who) === 'ready' && this.taker(q)?.id === who.id) {
        this.complete(q, who, npc, ev)
        say(q.done)
        return
      }
    // a talk goal: someone a quest under way sent them to (before their own errand)
    for (const q of this.defs) {
      if (this.status(q, who) !== 'active') continue
      for (const g of q.goals)
        if (g.kind === 'talk' && g.npc === npc && !w.fact(`q.${q.id}.${g.id}`)) {
          w.setFact(`q.${q.id}.${g.id}`, 1)
          say(g.line)
          return
        }
    }
    // take on what is offered
    for (const q of this.defs)
      if (q.giver === npc && this.status(q, who) === 'available') {
        this.take(q, who)
        say(q.offer)
        return
      }
  }

  /** The story's facts: a quest taken on by `who`. */
  private take(q: QuestDef, who: Entity): void {
    const w = this.w
    w.setFact(`q.${q.id}`, 'active')
    w.setFact(`q.${q.id}.by`, who.id)
    for (const g of q.goals) if (g.kind === 'defeat' || g.kind === 'talk') w.setFact(`q.${q.id}.${g.id}`, 0)
    w.fx.push({ t: 'log', text: { en: `Quest taken: ${txt(q.title, 'en')}`, zh: `接受任务：${txt(q.title, 'zh')}` }, tone: 'good' })
  }

  /** Has the story gone past a quest (its `skipWhen` holds)? */
  private passed(q: QuestDef): boolean {
    const w = this.w
    return !!q.skipWhen && Object.entries(q.skipWhen).every(([k, c]) => cmp(w.fact(k) ?? 0, c))
  }

  /** Is there anything for the story's own pass to do? (Read only: the story looks before it acts.) */
  due(): boolean {
    for (const q of this.defs) {
      const s = this.status(q)
      if (s !== 'done' && this.passed(q)) return true
      if ((q.auto && s === 'available') || (q.self && s === 'ready')) return true
    }
    return false
  }

  /** The story's own pass (an outcome of the story): past quests are done, `auto` ones taken on, `self` ones completed. */
  private advance(ev: GameEvent): void {
    const w = this.w
    const who = w.player
    for (const q of this.defs) {
      const s = this.status(q, who)
      if (s === 'done') continue
      // met in full as the story goes past it (its last goal is where the story now stands): it is completed, and pays
      if (s === 'ready' && this.passed(q)) {
        this.complete(q, this.taker(q) ?? who, q.turnIn ?? q.giver, ev)
        continue
      }
      if (this.passed(q)) {
        w.setFact(`q.${q.id}`, 'done')
        for (const [k, v] of Object.entries(q.reward?.facts ?? {})) w.setFact(k, v)
        w.fx.push({ t: 'log', text: { en: `Quest complete: ${txt(q.title, 'en')}`, zh: `完成任务：${txt(q.title, 'zh')}` }, tone: 'good' })
        continue
      }
      if (q.auto && s === 'available') this.take(q, who)
      else if (q.self && s === 'ready') this.complete(q, this.taker(q) ?? who, q.turnIn ?? q.giver, ev)
    }
  }

  /** The story's outcome: the facts change; the rest is sent (the giver takes, the taker is told) or spawned. */
  private complete(q: QuestDef, who: Entity, npc: Id, ev: GameEvent): void {
    const w = this.w
    const eng = this.eng
    const depth = (ev.depth ?? 0) + 1
    const send = (kind: 'impulse/taken' | 'impulse/notify', to: Id, params: Record<string, PropValue>, roles: GameEvent['roles'] = {}) =>
      eng.queue({ kind, host: { e: to }, roles, params, cause: ev.cause, origin: ev.origin, depth })
    // what was to be brought is taken by the giver (each thing moves itself into their bag)
    for (const g of q.goals)
      if (g.kind === 'carry' && g.consume) for (const e of this.carried(g.type, who, g.tags).slice(0, g.count)) send('impulse/taken', e.id, { into: 'contents', quiet: true }, { other: { e: npc }, actor: { e: npc } })
    w.setFact(`q.${q.id}`, 'done')
    if (q.kind === 'repeat') w.setFact(`q.${q.id}.day`, w.calendar().day)
    const r = q.reward
    for (const [k, v] of Object.entries(r?.facts ?? {})) w.setFact(k, v)
    // the taker's stage and experience: they are told, and keep it themselves
    for (const [what, value] of Object.entries(r?.props ?? {})) send('impulse/notify', who.id, { what, value }, { source: { e: npc } })
    if (r?.xp) send('impulse/notify', who.id, { what: 'reward', xp: r.xp }, { source: { e: npc } })
    // what it pays is spawned into their bag
    for (const it of r?.items ?? [])
      for (let i = 0; i < it.count; i++) {
        const made = w.create(it.type, { on: 'inside', holder: who.id }, { ...(it.name && { name: it.name }), ...(it.tags && { tags: [...it.tags] }), ...(it.props && { props: { ...it.props } }) })
        eng.touch({ e: made.id })
      }
    w.fx.push({ t: 'log', text: { en: `Quest complete: ${txt(q.title, 'en')}`, zh: `完成任务：${txt(q.title, 'zh')}` }, tone: 'good' })
  }

  /** The story's outcome: a thing of `type` felled by `who` counts for the defeat goals of the quests they took on. */
  private defeat(who: Entity, type: string): void {
    const w = this.w
    const at = w.posOf(who)
    if (!type || !at) return
    for (const q of this.defs) {
      if (this.status(q, who) !== 'active' || this.taker(q)?.id !== who.id) continue
      for (const g of q.goals)
        if (g.kind === 'defeat' && type.startsWith(g.type) && (!g.map || g.map === at.map)) {
          const key = `q.${q.id}.${g.id}`
          const n = Number(w.fact(key) ?? 0)
          if (n < g.count) w.setFact(key, n + 1)
        }
    }
  }
}

function txt(t: Text, l: 'en' | 'zh'): string {
  return typeof t === 'string' ? t : (l === 'zh' ? t.zh : undefined) ?? t.en
}
