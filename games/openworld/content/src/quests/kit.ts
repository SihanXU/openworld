// The quests' authoring kit (docs/quests.md): an errand — someone asks for things, kills, words with others or a
// place reached, and pays on hand-in — written as what it asks, made into a quest with aliases, objectives and
// stages (begun, all of it done, handed in; and, if the story goes past it first, closed).

import { Rng, gearProps, rollAffixes, type AliasDef, type ObjectiveDef, type PropValue, type QuestDef, type QuestReward, type QuestStage, type QuestTrigger, type Selector, type Text } from '@openworld/engine'
import { FORM_BY_ID, MATERIAL_DEFS, QUALITY_DEFS, VOW_IDS } from '../items.ts'
import { GEAR_LEVELS } from '../gear.ts'
import { AFFIX_TABLE } from '../trophies.ts'

export const L = (en: string, zh: string): Text => ({ en, zh })

/** A number from a name (FNV-1a): the seed of what a named piece rolls, the same every time the content is built. */
const seedOf = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  return h
}

/**
 * A named piece of gear a quest pays (docs/chapter-1.md §11, the chapter's gear): its slot, its tier, its level (1 … 20,
 * world-model.md §6.8), what it gives beyond its form. Its main stats are its form's at that quality and level, in its
 * form's first material (an iron helm, a leather belt), as any made piece's are: a finer piece at one level is the
 * better, so the author writes only what is its own (a vigil's `night:def`, an unusual dodge). Like any piece it rolls
 * its small extras (seeded by its name: the same piece in every game); a Vowbound one takes the vow the author names
 * (content VOWS), else one from its name.
 */
export const gear = (type: string, slot: string, en: string, zh: string, quality: string, props: Record<string, number> = {}, level = 1, material?: string, vow?: string) => {
  const form = FORM_BY_ID[type]
  if (!form) throw new Error(`gear: unknown form ${type}`)
  const mat = material ?? form.materials?.[0]
  const q = QUALITY_DEFS().find((x) => x.id === quality)
  const main = gearProps(form.props ?? {}, mat ? MATERIAL_DEFS[mat] : undefined, q, level, GEAR_LEVELS)
  // (what the form gives is computed, never written by hand: the author's number for it is dropped)
  const extras = Object.fromEntries(Object.entries(props).filter(([k]) => !(k in main)))
  const rng = new Rng(seedOf(en))
  const sworn = quality === 'vowed' ? { vow: vow ?? VOW_IDS[Math.floor(rng.next() * VOW_IDS.length)] } : {}
  const subs = rollAffixes({ affixes: AFFIX_TABLE, params: { gearLevels: GEAR_LEVELS } } as never, slot, () => rng.next(), { quality, level })
  return { type, count: 1, name: L(en, zh), tags: [...(quality === 'common' ? [] : [`quality:${quality}`]), ...(mat ? [`material:${mat}`, ...(MATERIAL_DEFS[mat]?.tags ?? [])] : [])], props: { slot, ...main, ...extras, ...sworn, ...subs } as Record<string, PropValue> }
}

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
