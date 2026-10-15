// What the minor monsters' and the bosses' skills share (docs/skills.md): the helpers both kits are written with, the
// colours of the marks, what clings to a body a skill strikes, and the one rule that makes a coat a status. Both
// designers add to this file; neither edits the other's (kits.ts the minor monsters', bosses.ts the bosses').

import type { Effect, KitSkill, Rule, StatusDef, Tree } from '@openworld/engine'

const L = (en: string, zh: string) => ({ en, zh })
const rule = (r: Omit<Rule, 'source'>): Rule => ({ ...r, source: { origin: 'base' } })

/** The colours of the marks: harm, what clings (a web, a mire, a kneel), what calls others or guards itself. */
export const HARM = 0xe0483c
export const CLING = 0xa968e0
export const CALL = 0xf0b030

/** A kit skill: its id, its name in both languages, and the rest of it. */
export const skill = (id: string, en: string, zh: string, s: Omit<KitSkill, 'id' | 'name'>): KitSkill => ({ id, name: L(en, zh), ...s })

/** A blow of so many times the act's power (its caster's attack, scaled by a boss's phase). */
export const POWER = (mul: number) => ({ param: 'power', mul })
/** The caster's own element (the act carries it). */
export const ELEMENT = { param: 'element' }

export const unleash = (u: Omit<Extract<Effect, { op: 'unleash' }>, 'op'>): Effect => ({ op: 'unleash', ...u })
export const DO = (...effects: Effect[]): Tree => ({ do: effects })

/** A kind's answer to its own skills: each skill's id → what lands; any other use is its plain blow (inherit). */
export const kitTree = (answers: [string, Tree][], otherwise: Tree = 'inherit'): Tree =>
  answers.reduceRight<Tree>((rest, [id, then]) => ({ if: { param: { key: 'kit', cmp: id } }, then, else: rest }), otherwise)

/** The rules that answer a kind's skills (`kit/<family>` for the minor monsters, `boss/<id>` for the bosses), one per host type. */
export const kitRule = (id: string, host: string | string[], doc: string, answers: [string, Tree][], otherwise?: Tree): Rule[] =>
  (Array.isArray(host) ? host : [host]).map((h, i) => rule({ id: i ? `${id}-${h.split('/').pop()}` : id, doc, host: { type: h }, on: 'act/use', tree: kitTree(answers, otherwise) }))

// ------------------------------------------------------------------ what clings

/** What skills leave on a body (a coat it answers for itself: body/afflict). */
export const SKILL_STATUSES: StatusDef[] = [
  // a sin's mire, a zombie's grasp: steps take longer
  { id: 'mired', name: L('Mired', '迟滞'), duration: 25, moveDelay: 1.7 },
  // a false promise: held a moment
  { id: 'entranced', name: L('Entranced', '迷眩'), duration: 8, immobilize: true },
  // a spider's bite: 1 a second through any defence, three seconds (body/poison)
  { id: 'poisoned', name: L('poisoned', '中毒'), duration: 30, every: 10 },
  // a spider's web: one wades through it at a third of the pace
  { id: 'webbed', name: L('webbed', '缠丝'), duration: 25, moveDelay: 3 },
  // a wolf's howl: the pack runs faster and bites harder
  { id: 'frenzied', name: L('frenzied', '狂热'), duration: 80, moveDelay: 0.6, props: { atk: 1 } },
  // a crab drawn into its shell: hard to hurt, slow to move
  { id: 'shelled', name: L('shelled', '缩壳'), duration: 40, moveDelay: 2, props: { def: 4 } },
  // just come back to one's feet: a skill cannot hold one again for a while (no hold follows a hold)
  { id: 'steadied', name: L('steadied', '定神'), duration: 45, wards: ['entranced', 'knelt', 'stunned'] },
]

/** Every coat a body takes as a status of its own (body/afflict): the bosses' and the minor monsters'. */
export const AFFLICTIONS = ['mired', 'entranced', 'webbed', 'poisoned', 'bleeding', 'stunned', 'frenzied', 'knelt']
/** The coats that hold a body where it is: once it is held, it is steadied a while after. */
export const HOLDS = ['entranced', 'knelt', 'stunned']

export const AFFLICTION_RULES: Rule[] = [
  rule({
    id: 'body/afflict',
    doc: 'What a skill leaves clinging to a body: a mire that slows it, a trance or a kneel or a stun that holds it (and steadies it a while after, so no hold follows a hold), a web, venom, a bleed, a beast\'s frenzy.',
    host: { type: 'actor' },
    on: 'impulse/coat',
    tree: AFFLICTIONS.reduceRight<Tree>((rest, status) => ({
      if: { param: { key: 'substance', cmp: status } },
      then: DO({ op: 'addStatus', status }, ...(HOLDS.includes(status) ? [{ op: 'addStatus', status: 'steadied' } as Effect] : [])),
      else: rest,
    }), 'inherit'),
  }),
  rule({
    id: 'body/poison',
    doc: 'A poisoned body loses 1 health a second, through any defence (a spider\'s venom).',
    host: { type: 'actor', status: ['poisoned'] },
    on: 'time/period',
    tree: { if: { param: { key: 'status', cmp: 'poisoned' } }, then: DO({ op: 'hurt', amount: 1, pierce: true }), else: 'inherit' },
  }),
]
