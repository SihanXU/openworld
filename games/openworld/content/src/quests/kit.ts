// The quests' authoring kit (docs/quests.md): an errand — someone asks for things, kills, words with others or a
// place reached, and pays on hand-in — written as what it asks, made into a quest with aliases, objectives and
// stages (begun, all of it done, handed in; and, if the story goes past it first, closed).

import type { AliasDef, ObjectiveDef, PropValue, QuestDef, QuestReward, QuestStage, QuestTrigger, Selector, Text } from '@openworld/engine'

export const L = (en: string, zh: string): Text => ({ en, zh })

/** A named piece of gear a quest pays (docs/chapter-1.md §11, the chapter's gear): its slot, its tier, what it gives. */
export const gear = (type: string, slot: string, en: string, zh: string, quality: string, props: Record<string, number> = {}) =>
  ({ type, count: 1, name: L(en, zh), tags: quality === 'common' ? [] : [`quality:${quality}`], props: { slot, ...props } as Record<string, PropValue> })

/** What an errand asks, each an objective. */
export type Ask = { id: string; text: Text; where?: string; optional?: boolean } & (
  /** Things to bring (taken by the giver on hand-in, unless `keep`). */
  | { carry: Selector; count: number; keep?: boolean }
  /** Things of a class to fell (on a map). */
  | { kill: Selector; count: number; map?: string }
  /** Someone to speak to: they say their line. */
  | { talk: string; line: Text }
  /** A number the story keeps reaches `count`. */
  | { fact: string; count?: number }
  /** A step of the story has played (a place reached, a thing read). */
  | { step: string }
)

export interface Errand {
  id: string
  kind?: 'side' | 'favor'
  title: Text
  summary: Text
  giver: string
  /** Offered once this holds (and from this level). */
  when?: QuestTrigger
  level?: number
  offer: Text
  waiting?: Text
  done: Text
  asks: Ask[]
  reward: QuestReward
  /** The story has gone past it: it is closed (its reward's facts kept, nothing paid) — unless all of it was done. */
  skip?: QuestTrigger
  repeat?: 'daily'
  aliases?: Record<string, AliasDef>
  /** Log lines: begun, all of it done, handed in. */
  logs?: [Text, Text?, Text?]
}

/** An errand as a quest: aliases (the giver, the people to speak to, the places), objectives, stages 10 / 20 / 100 (and 110). */
export function errand(e: Errand): QuestDef {
  const aliases: Record<string, AliasDef> = { giver: { id: e.giver, essential: true }, ...e.aliases }
  const objectives: ObjectiveDef[] = []
  for (const a of e.asks) {
    const where = a.where ? `at_${a.id}` : undefined
    if (where) aliases[where] = { place: a.where }
    const base = { id: a.id, text: a.text, ...(a.optional && { optional: true }) }
    if ('carry' in a) objectives.push({ ...base, count: { carry: a.carry }, need: a.count, ...(where && { target: where }) })
    else if ('kill' in a) objectives.push({ ...base, count: { kill: a.kill, ...(a.map && { map: a.map }) }, need: a.count, ...(where && { target: where }) })
    else if ('talk' in a) {
      aliases[a.id] = { id: a.talk, essential: true }
      objectives.push({ ...base, target: a.id, talk: true, on: { talk: a.id }, say: a.line })
    } else if ('fact' in a) objectives.push({ ...base, ...((a.count ?? 1) > 1 ? { count: { fact: a.fact }, need: a.count } : { on: { fact: { [a.fact]: { gte: 1 } } } }), ...(where && { target: where }) })
    else objectives.push({ ...base, on: { step: a.step }, ...(where && { target: where }) })
  }
  const ids = e.asks.filter((a) => !a.optional).map((a) => a.id)
  objectives.push({ id: 'back', text: L('Back to {giver}', '回去找{giver}'), target: 'giver', talk: true })
  const take = e.asks.flatMap((a) => ('carry' in a && !a.keep ? [{ match: a.carry, count: a.count }] : []))
  const [begun, all, handed] = e.logs ?? [e.summary]
  const facts = e.reward.facts
  const stages: QuestStage[] = [
    { n: 10, log: begun, show: e.asks.map((a) => a.id) },
    { n: 20, on: { objectives: ids }, show: ['back'], log: all ?? L('All of it done. Back to {giver}.', '都办齐了。回去找{giver}。') },
    { n: 100, on: { all: [{ talk: 'giver' }, { objectives: ids }] }, done: ['back'], say: e.done, take, reward: e.reward, complete: true, log: handed ?? L('Handed in to {giver}.', '交给了{giver}。') },
    ...(e.skip
      ? [
          { n: 105, on: { all: [e.skip, { objectives: ids }] }, reward: e.reward, complete: true, log: L('All of it done as the road went on.', '路走下去，这件事也一起办完了。') } as QuestStage,
          { n: 110, on: e.skip, ...(facts && { reward: { facts } }), complete: true, log: L('The road went past it.', '路已经走过了这里。') } as QuestStage,
        ]
      : []),
  ]
  return {
    id: e.id,
    kind: e.kind ?? 'side',
    title: e.title,
    summary: e.summary,
    aliases,
    objectives,
    stages,
    // (not offered once the story has gone past it)
    start: { offer: 'giver', ...((e.when || e.skip) && { when: e.when && e.skip ? { all: [e.when, { not: e.skip }] } : (e.when ?? { not: e.skip! }) }), ...(e.level && { level: e.level }) },
    offer: e.offer,
    ...(e.waiting && { waiting: e.waiting }),
    ...(e.repeat && { repeat: e.repeat }),
  }
}
