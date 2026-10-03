// Quests (docs/quests.md): content lays out who gives what, what it asks and what it pays; the
// engine keeps the state in world facts and answers the player's word to a person.
//
//   q.<id>              'active' | 'done'
//   q.<id>.<goal>       a defeat goal's count, or 1 when a talk goal is met
//   q.<id>.day          the day a repeatable quest was last handed in
//
// A quest is `available` when its requirements hold and it is not active (a repeatable one: not
// handed in today), `ready` when every goal is met, and handed in to its giver (or `turnIn`).
// E on a person who has something for you does it: hand in what is ready, else take on what is
// offered, else meet a talk goal, else they just talk. People with a quest to give show "!",
// with one to take back "?".

import type { Engine } from './engine.ts'
import { cmp } from './rules.ts'
import { gainXp } from './progression.ts'
import type { Cmp, Entity, GameEvent, Id, PropValue, Text } from './types.ts'

export type QuestKind = 'main' | 'side' | 'repeat'

export type QuestGoal =
  /** Fell creatures of a type (a prefix), optionally on one map. */
  | { id: string; kind: 'defeat'; type: string; map?: string; count: number; label: Text }
  /** Have things of a type on you when you hand in (taken by the giver if `consume`). */
  | { id: string; kind: 'carry'; type: string; count: number; consume?: boolean; label: Text }
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
  /** Said by the giver when the quest is taken on. */
  offer: Text
  /** Said by the giver when spoken to before it is done. */
  waiting?: Text
  /** Said when it is handed in. */
  done: Text
  goals: QuestGoal[]
  reward?: { xp?: number; items?: { type: string; count: number }[]; facts?: Record<string, PropValue>; props?: Record<string, PropValue> }
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

  private carried(type: string): Entity[] {
    const p = this.w.player
    return [p.held, ...(p.contents ?? [])].map((id) => this.w.get(id)).filter((e): e is Entity => !!e && e.type.startsWith(type) && !e.frozenBy)
  }

  /** How far a goal is: have / need. */
  progress(q: QuestDef, g: QuestGoal): { have: number; need: number } {
    const w = this.w
    switch (g.kind) {
      case 'defeat':
        return { have: Math.min(g.count, Number(w.fact(`q.${q.id}.${g.id}`) ?? 0)), need: g.count }
      case 'carry':
        return { have: Math.min(g.count, this.carried(g.type).length), need: g.count }
      case 'talk':
        return { have: w.fact(`q.${q.id}.${g.id}`) ? 1 : 0, need: 1 }
      case 'fact':
        return { have: Math.min(g.count, Number(w.fact(g.fact) ?? 0)), need: g.count }
    }
  }

  status(q: QuestDef): QuestStatus {
    const w = this.w
    const state = w.fact(`q.${q.id}`)
    if (state === 'active') return q.goals.every((g) => { const p = this.progress(q, g); return p.have >= p.need }) ? 'ready' : 'active'
    if (state === 'done' && (q.kind !== 'repeat' || w.fact(`q.${q.id}.day`) === w.calendar().day)) return 'done'
    const r = q.requires
    if (r?.level && w.num(w.player, 'level', 1) < r.level) return 'locked'
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

  /**
   * The player speaks to a person (the quest/talk rule). True if a quest answered: handed in,
   * taken on, or a talk goal met. Otherwise the person just talks.
   */
  talk(npc: Id): boolean {
    const w = this.w
    const say = (text: Text) => w.fx.push({ t: 'say', who: npc, text })
    // hand in what is ready
    for (const q of this.defs)
      if ((q.turnIn ?? q.giver) === npc && this.status(q) === 'ready') {
        this.complete(q)
        say(q.done)
        return true
      }
    // take on what is offered
    for (const q of this.defs)
      if (q.giver === npc && this.status(q) === 'available') {
        w.setFact(`q.${q.id}`, 'active')
        for (const g of q.goals) if (g.kind === 'defeat' || g.kind === 'talk') w.setFact(`q.${q.id}.${g.id}`, 0)
        say(q.offer)
        w.fx.push({ t: 'log', text: { en: `Quest taken: ${txt(q.title, 'en')}`, zh: `接受任务：${txt(q.title, 'zh')}` }, tone: 'good' })
        return true
      }
    // a talk goal: someone the quest sent you to
    for (const q of this.defs) {
      if (this.status(q) !== 'active') continue
      for (const g of q.goals)
        if (g.kind === 'talk' && g.npc === npc && !w.fact(`q.${q.id}.${g.id}`)) {
          w.setFact(`q.${q.id}.${g.id}`, 1)
          say(g.line)
          return true
        }
    }
    // the giver of a quest still under way says how it goes
    for (const q of this.defs)
      if (q.giver === npc && this.status(q) === 'active' && q.waiting) {
        say(q.waiting)
        return true
      }
    return false
  }

  private complete(q: QuestDef): void {
    const w = this.w
    const p = w.player
    // what was to be brought is handed over
    for (const g of q.goals) if (g.kind === 'carry' && g.consume) for (const e of this.carried(g.type).slice(0, g.count)) w.destroy(e)
    w.setFact(`q.${q.id}`, 'done')
    if (q.kind === 'repeat') w.setFact(`q.${q.id}.day`, w.calendar().day)
    const r = q.reward
    for (const [k, v] of Object.entries(r?.facts ?? {})) w.setFact(k, v)
    for (const [k, v] of Object.entries(r?.props ?? {})) (p.props ??= {})[k] = v
    for (const it of r?.items ?? []) for (let i = 0; i < it.count; i++) w.create(it.type, { on: 'inside', holder: p.id })
    w.fx.push({ t: 'log', text: { en: `Quest complete: ${txt(q.title, 'en')}`, zh: `完成任务：${txt(q.title, 'zh')}` }, tone: 'good' })
    if (r?.xp) {
      const up = gainXp(w, p, r.xp)
      w.fx.push({ t: 'log', text: { en: `+${r.xp} XP`, zh: `+${r.xp} 经验` }, tone: 'good' })
      if (up) w.fx.push({ t: 'levelup', level: w.num(p, 'level', 1) })
    }
    this.eng.controls.sync()
  }

  /** A creature fell: count it for the player's defeat goals. */
  onDefeat(ev: GameEvent): void {
    const w = this.w
    const by = ev.roles.actor
    const t = ev.host
    if (!by || !('e' in by) || by.e !== w.state.player || !t || !('e' in t)) return
    const victim = w.get(t.e)
    const at = victim && w.posOf(victim)
    if (!victim || !at) return
    for (const q of this.defs) {
      if (this.status(q) !== 'active') continue
      for (const g of q.goals)
        if (g.kind === 'defeat' && victim.type.startsWith(g.type) && (!g.map || g.map === at.map)) {
          const key = `q.${q.id}.${g.id}`
          const n = Number(w.fact(key) ?? 0)
          if (n < g.count) w.write(() => w.setFact(key, n + 1))
        }
    }
  }
}

function txt(t: Text, l: 'en' | 'zh'): string {
  return typeof t === 'string' ? t : (l === 'zh' ? t.zh : undefined) ?? t.en
}
