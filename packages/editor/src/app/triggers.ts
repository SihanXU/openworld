// Triggers as forms (docs/engine-split.md §16 E2, RPG Maker's event conditions): a story step's `when` (StepCond:
// the map, an area, the hour, the weather, facts, quests' stages and objectives, what one carries or holds, a step
// played, a spot, something near …) and a quest's triggers (QuestTrigger: a word with someone, a felling, a place
// entered, things carried or given, facts, other quests, a step — and all, any, not of them), each condition a row
// with its own fields; what has no form yet is kept as JSON beside it.

import { WEATHERS, type Cmp, type QuestDef, type QuestTrigger, type Selector, type StepCond } from '@openworld/engine'
import type { PersonFile, StoryFile } from '@openworld/format'
import type { Ctx } from './context.ts'
import { Form, setKey, valueOf } from './form.ts'
import { factUses } from './usage.ts'
import { esc, toast, tx } from './ui.ts'

// ------------------------------------------------------------------ what the forms choose from

/** The project's names a trigger's fields offer: maps and their areas, quests, steps, people, kinds, statuses, facts. */
export function namesOf(ctx: Ctx) {
  const maps = ctx.store.maps().map((m) => m.data)
  const quests = ctx.store.list<QuestDef>('quests').map((q) => q.data)
  return {
    maps: maps.map((m) => m.map.id),
    regions: (map?: string) => Object.keys(maps.find((m) => m.map.id === map)?.map.regions ?? {}),
    anchors: (map?: string) => Object.keys(maps.find((m) => m.map.id === map)?.map.anchors ?? {}),
    quests: quests.map((q) => q.id),
    quest: (id: string) => quests.find((q) => q.id === id),
    steps: ctx.store.list<StoryFile>('story').flatMap((f) => (f.data.steps ?? []).map((s) => s.id)),
    people: ctx.store.list<PersonFile>('people').map((p) => p.data),
  }
}

/** The datalists the forms' fields name (kinds, facts, statuses, people, things on the maps), drawn once in a panel. */
export function datalists(ctx: Ctx): string {
  const onto = ctx.onto()
  const files = [...ctx.store.list('story'), ...ctx.store.list('quests'), ...ctx.store.list('people'), ...ctx.store.maps(), ...ctx.store.list('rules')]
  const facts = [...factUses(files).keys()].sort()
  const things = ctx.store.maps().flatMap((m) => m.data.entities.filter((e) => e.place.on === 'tile').map((e) => e.id))
  const opts = (xs: string[]) => xs.map((x) => `<option value="${esc(x)}">`).join('')
  return `<datalist id="dlKinds">${opts(Object.keys(onto.types).sort())}</datalist><datalist id="dlFacts">${opts(facts)}</datalist><datalist id="dlStatuses">${opts(Object.keys(onto.statuses).sort())}</datalist><datalist id="dlPeople">${opts(namesOf(ctx).people.map((p) => p.id))}</datalist><datalist id="dlThings">${opts([...namesOf(ctx).people.map((p) => p.id), ...things])}</datalist>`
}

// ------------------------------------------------------------------ comparisons

const OPS: [string, string][] = [['eq', 'is'], ['ne', 'is not'], ['gt', 'over'], ['gte', 'at least'], ['lt', 'under'], ['lte', 'at most']]

function cmpParts(c: Cmp | undefined): [string, string] {
  if (c && typeof c === 'object') {
    const [k, v] = Object.entries(c)[0] ?? ['eq', '']
    return [k, String(v ?? '')]
  }
  return ['eq', c === undefined ? '' : String(c)]
}
function cmpOf(op: string, value: string): Cmp {
  const v = valueOf(value)
  if (op === 'eq') return v
  return { [op]: op === 'ne' ? v : Number(v) || 0 } as Cmp
}

/** A comparison: what it is to be, and the value. */
export function cmpField(f: Form, c: Cmp | undefined, set: (c: Cmp) => void): string {
  const [op, v] = cmpParts(c)
  let cur = { op, v }
  return `${f.select(OPS, op, (o) => ((cur = { ...cur, op: o }), set(cmpOf(cur.op, cur.v))))} ${f.text(v, (x) => ((cur = { ...cur, v: x }), set(cmpOf(cur.op, cur.v))), { placeholder: 'value' })}`
}

/** A record of comparisons (facts, props, quests' stages): a row each, a row to add one. */
function cmpRows(f: Form, rec: Record<string, Cmp> | undefined, set: (r: Record<string, Cmp> | undefined) => void, key: (cur: string | undefined, put: (k: string) => void) => string): string {
  const rows = Object.entries(rec ?? {}).map(([k, c]) => `<div class="row">${key(k, (nk) => set(setKey(rec, k, nk, c)))} ${cmpField(f, c, (nc) => set(setKey(rec, k, k, nc)))} ${f.link('✕', () => set(setKey(rec, k, undefined, undefined)), { cls: 'x' })}</div>`)
  return `${rows.join('')}<div class="row add">${key(undefined, (nk) => nk && set(setKey(rec, undefined, nk, 1)))}</div>`
}

// ------------------------------------------------------------------ a step's trigger

/** The conditions a step's trigger may have, by its key, with their names. */
const STEP_KINDS: [keyof StepCond, string][] = [
  ['map', 'on the map'], ['region', 'in the area'], ['spot', 'near a spot'], ['hour', 'between the hours'], ['weather', 'in the weather'],
  ['facts', 'the story\'s facts'], ['quest', 'a quest\'s stage'], ['objectives', 'a quest\'s objective done'], ['after', 'after a step'], ['morningAfter', 'the morning after a step'],
  ['carrying', 'carrying'], ['holding', 'holding'], ['statuses', 'with a status'], ['props', 'one\'s own numbers'], ['skill', 'a skill learned'], ['near', 'near a thing'], ['room', 'a room on the map'], ['on', 'things on cells'],
]

/** What a new condition starts as. */
function stepStart(k: keyof StepCond, ctx: Ctx): StepCond[keyof StepCond] {
  const n = namesOf(ctx)
  switch (k) {
    case 'map': return ctx.map
    case 'region': return n.regions(ctx.map)[0] ?? ''
    case 'spot': return { x: 0, y: 0, r: 1 }
    case 'hour': return { from: 6, to: 18 }
    case 'weather': return ['rain']
    case 'facts': return {}
    case 'quest': return n.quests[0] ? { [n.quests[0]]: { gte: 10 } } : {}
    case 'objectives': return []
    case 'after': case 'morningAfter': return n.steps[0] ?? ''
    case 'carrying': case 'holding': return 'item/'
    case 'statuses': return {}
    case 'props': return {}
    case 'skill': return true
    case 'near': return { type: 'fixture/', r: 3 }
    case 'room': return 'bedroom'
    case 'on': return { type: 'item/', cells: [] }
  }
}

/** A step's trigger as rows of conditions; `set` is given the whole trigger after each change (none: always). */
export function stepCondForm(f: Form, ctx: Ctx, when: StepCond | undefined, set: (c: StepCond | undefined) => void): string {
  const c: StepCond = when ?? {}
  const n = namesOf(ctx)
  const put = <K extends keyof StepCond>(k: K, v: StepCond[K] | undefined) => {
    const next = { ...c }
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length && k !== 'objectives')) delete next[k]
    else next[k] = v
    set(Object.keys(next).length ? next : undefined)
  }
  const row = (k: keyof StepCond, label: string, body: string) => `<div class="cond"><span class="lbl">${esc(label)}</span>${body}${f.link('✕', () => put(k, undefined), { cls: 'x', title: 'remove the condition' })}</div>`
  const rows: string[] = []
  for (const [k, label] of STEP_KINDS) {
    if (c[k] === undefined) continue
    const v = c[k] as never
    switch (k) {
      case 'map': rows.push(row(k, label, f.select(n.maps, c.map, (x) => put('map', x)))); break
      case 'region': rows.push(row(k, label, f.select(n.regions(c.map ?? ctx.map), c.region, (x) => put('region', x), { none: '(choose)' }))); break
      case 'spot': {
        const s = c.spot!
        rows.push(row(k, label, `${f.num(s.x, (x) => put('spot', { ...s, x: x ?? 0 }))} ${f.num(s.y, (y) => put('spot', { ...s, y: y ?? 0 }))} within ${f.num(s.r ?? 1, (r) => put('spot', { ...s, r: r ?? 1 }), { min: 0 })} ${f.button('Pick on the map', () => void ctx.pick(`the spot of the step's trigger`, c.map).then((p) => p && put('spot', { x: p.x, y: p.y, r: s.r ?? 1 })))}`))
        break
      }
      case 'hour': {
        const h = c.hour!
        rows.push(row(k, label, `${f.num(h.from, (x) => put('hour', { ...h, from: x ?? 0 }), { min: 0, max: 23 })} to ${f.num(h.to, (x) => put('hour', { ...h, to: x ?? 24 }), { min: 0, max: 24 })}`))
        break
      }
      case 'weather': rows.push(row(k, label, `<span class="chips">${WEATHERS.map((w) => f.check(c.weather!.includes(w), w, (on) => put('weather', on ? [...new Set([...c.weather!, w])] : c.weather!.filter((x) => x !== w)))).join('')}</span>`)); break
      case 'facts': rows.push(row(k, label, `<div class="rows">${cmpRows(f, c.facts, (r) => put('facts', r ?? {}), (cur, putK) => f.text(cur, putK, { placeholder: cur === undefined ? '+ a fact' : 'fact', list: 'dlFacts' }))}</div>`)); break
      case 'props': rows.push(row(k, label, `<div class="rows">${cmpRows(f, c.props, (r) => put('props', r ?? {}), (cur, putK) => f.text(cur, putK, { placeholder: cur === undefined ? '+ a number (level, hp …)' : 'prop' }))}</div>`)); break
      case 'quest': rows.push(row(k, label, `<div class="rows">${cmpRows(f, c.quest, (r) => put('quest', r ?? {}), (cur, putK) => f.select(n.quests, cur, putK, { none: cur === undefined ? '+ a quest' : '(choose)' }))}</div>`)); break
      case 'objectives': {
        const all = n.quests.flatMap((q) => (n.quest(q)?.objectives ?? []).map((o) => `${q}.${o.id}`))
        rows.push(row(k, label, `<span class="chips">${all.map((o) => f.check(c.objectives!.includes(o), o, (on) => put('objectives', on ? [...c.objectives!, o] : c.objectives!.filter((x) => x !== o)))).join('') || '<span class="muted">no quest has objectives yet</span>'}</span>`))
        break
      }
      case 'after': case 'morningAfter': rows.push(row(k, label, f.select(n.steps, v, (x) => put(k, x)))); break
      case 'carrying': rows.push(row(k, label, f.text(([] as string[]).concat(c.carrying!).join(', '), (x) => { const l = x.split(',').map((s) => s.trim()).filter(Boolean); put('carrying', l.length > 1 ? l : l[0]) }, { list: 'dlKinds', placeholder: 'a kind (item/food); several by commas' }))); break
      case 'holding': rows.push(row(k, label, f.text(c.holding, (x) => put('holding', x), { list: 'dlKinds' }))); break
      case 'room': rows.push(row(k, label, f.text(c.room, (x) => put('room', x), { placeholder: 'bedroom, kitchen …' }))); break
      case 'skill': rows.push(row(k, label, f.text(c.skill === true ? '' : String(c.skill), (x) => put('skill', x || true), { placeholder: 'any skill, or its id' }))); break
      case 'statuses': {
        const st = c.statuses ?? {}
        rows.push(row(k, label, `<div class="rows">${Object.entries(st).map(([s, want]) => `<div class="row">${f.select([['true', 'has'], ['false', 'has not']], String(want), (x) => put('statuses', { ...st, [s]: x === 'true' }))} ${f.text(s, (ns) => { const r = { ...st }; delete r[s]; if (ns) r[ns] = want; put('statuses', r) }, { list: 'dlStatuses' })} ${f.link('✕', () => { const r = { ...st }; delete r[s]; put('statuses', r) }, { cls: 'x' })}</div>`).join('')}<div class="row add">${f.text('', (ns) => ns && put('statuses', { ...st, [ns]: true }), { list: 'dlStatuses', placeholder: '+ a status' })}</div></div>`))
        break
      }
      case 'near': {
        const nr = c.near!
        rows.push(row(k, label, `${f.text(nr.type, (t) => put('near', { ...nr, type: t }), { list: 'dlKinds' })} within ${f.num(nr.r, (r) => put('near', { ...nr, r: r ?? 1 }), { min: 0 })} ${f.text(nr.status ?? '', (s) => put('near', { ...nr, ...(s ? { status: s } : { status: undefined }) }), { list: 'dlStatuses', placeholder: 'with a status' })}`))
        break
      }
      case 'on': rows.push(row(k, label, f.json(c.on, (x) => put('on', x as StepCond['on']), (m) => toast(m, 'error'), 2))); break
    }
  }
  const free = STEP_KINDS.filter(([k]) => c[k] === undefined)
  return `<div class="conds">${rows.join('') || '<p class="muted">Always (no condition): it plays as soon as the game begins.</p>'}
    <div class="row add">${f.select(free.map(([k, l]) => [k, l]), '', (k) => k && put(k as keyof StepCond, stepStart(k as keyof StepCond, ctx) as never), { none: '+ a condition' })}</div></div>`
}

// ------------------------------------------------------------------ a quest's trigger

const Q_KINDS: [string, string][] = [
  ['talk', 'spoken to'], ['give', 'given to'], ['carry', 'carrying'], ['kill', 'felled'], ['gone', 'dead or gone'], ['enter', 'entering a place'],
  ['objectives', 'objectives done'], ['fact', 'the story\'s facts'], ['quest', 'another quest\'s stage'], ['done', 'another quest done'], ['step', 'a step played'],
  ['all', 'all of these'], ['any', 'any of these'], ['not', 'not this'],
]
const qKind = (t: QuestTrigger): string => Object.keys(t)[0]

function qStart(k: string, q: QuestDef, ctx: Ctx): QuestTrigger {
  const n = namesOf(ctx)
  const alias = Object.keys(q.aliases ?? {})[0] ?? 'giver'
  switch (k) {
    case 'talk': return { talk: alias }
    case 'give': return { give: { type: 'item/' }, to: alias }
    case 'carry': return { carry: { type: 'item/' }, count: 1 }
    case 'kill': return { kill: { type: 'actor/creature/' } }
    case 'gone': return { gone: alias }
    case 'enter': return { enter: ctx.map }
    case 'objectives': return { objectives: 'all' }
    case 'fact': return { fact: {} }
    case 'quest': return { quest: n.quests[0] ? { [n.quests[0]]: { gte: 10 } } : {} }
    case 'done': return { done: n.quests.find((x) => x !== q.id) ?? '' }
    case 'step': return { step: n.steps[0] ?? '' }
    case 'all': return { all: [{ talk: alias }] }
    case 'any': return { any: [{ talk: alias }] }
    default: return { not: { talk: alias } }
  }
}

/** One of the quest's aliases (or the taker), or a kind of thing (a class): what a talk, a felling, a gift is about. */
function aliasOrKind(f: Form, q: QuestDef, v: string | Selector, set: (v: string | Selector) => void): string {
  const aliases = ['player', ...Object.keys(q.aliases ?? {})]
  if (typeof v === 'string') return `${f.select([...aliases.map((a): [string, string] => [a, `{${a}}`]), ['?kind', 'a kind of thing…']], v, (x) => set(x === '?kind' ? { type: 'item/' } : x))}`
  const plain = Object.keys(v).every((k) => k === 'type')
  return `${f.select([...aliases.map((a): [string, string] => [a, `{${a}}`]), ['?kind', 'a kind of thing']], '?kind', (x) => set(x === '?kind' ? v : x))} ${plain ? f.text(v.type, (t) => set({ ...v, type: t }), { list: 'dlKinds' }) : f.json(v, (x) => set(x as Selector), (m) => toast(m, 'error'), 1)}`
}

/** A quest's trigger as a form (all, any and not nest); `set` is given it after each change (none: removed). */
export function questTriggerForm(f: Form, ctx: Ctx, q: QuestDef, t: QuestTrigger | undefined, set: (t: QuestTrigger | undefined) => void, depth = 0): string {
  const n = namesOf(ctx)
  if (!t) return `<span class="trig">${f.select(Q_KINDS, '', (k) => k && set(qStart(k, q, ctx)), { none: '+ a trigger' })}</span>`
  const k = qKind(t)
  const aliases = Object.keys(q.aliases ?? {})
  const kind = f.select(Q_KINDS, k, (nk) => nk !== k && set(qStart(nk, q, ctx)))
  const x = t as Record<string, unknown>
  let body = ''
  switch (k) {
    case 'talk': body = `${f.select(aliases, String(x.talk), (a) => set({ ...(t as { talk: string }), talk: a }))}`; break
    case 'gone': body = f.select(aliases, String(x.gone), (a) => set({ gone: a })); break
    case 'give': { const g = t as { give: string | Selector; to: string }; body = `${aliasOrKind(f, q, g.give, (v) => set({ ...g, give: v }))} to ${f.select(aliases, g.to, (a) => set({ ...g, to: a }))}`; break }
    case 'carry': { const c = t as { carry: string | Selector; count?: number }; body = `${f.num(c.count ?? 1, (v) => set({ ...c, count: v ?? 1 }), { min: 1 })} × ${aliasOrKind(f, q, c.carry, (v) => set({ ...c, carry: v }))}`; break }
    case 'kill': { const c = t as { kill: string | Selector; map?: string }; body = `${aliasOrKind(f, q, c.kill, (v) => set({ ...c, kill: v }))} on ${f.select(n.maps, c.map, (m) => set({ ...c, ...(m ? { map: m } : { map: undefined }) }), { none: 'any map' })}`; break }
    case 'enter': {
      const places = n.maps.flatMap((m) => [m, ...n.regions(m).map((r) => `${m}:${r}`)])
      body = f.select(places, String(x.enter), (p) => set({ enter: p }))
      break
    }
    case 'objectives': {
      const o = (t as { objectives: string[] | 'all' }).objectives
      const ids = (q.objectives ?? []).map((ob) => ob.id)
      body = `${f.check(o === 'all', 'all of them', (on) => set({ objectives: on ? 'all' : [] }))} ${o === 'all' ? '' : `<span class="chips">${ids.map((id) => f.check(o.includes(id), id, (on) => set({ objectives: on ? [...o, id] : o.filter((y) => y !== id) }))).join('')}</span>`}`
      break
    }
    case 'fact': body = `<div class="rows">${cmpRows(f, (t as { fact: Record<string, Cmp> }).fact, (r) => set({ fact: r ?? {} }), (cur, putK) => f.text(cur, putK, { placeholder: cur === undefined ? '+ a fact' : 'fact', list: 'dlFacts' }))}</div>`; break
    case 'quest': body = `<div class="rows">${cmpRows(f, (t as { quest: Record<string, Cmp> }).quest, (r) => set({ quest: r ?? {} }), (cur, putK) => f.select(n.quests, cur, putK, { none: cur === undefined ? '+ a quest' : '(choose)' }))}</div>`; break
    case 'done': body = f.select(n.quests, String(x.done), (v) => set({ done: v })); break
    case 'step': body = f.select(n.steps, String(x.step), (v) => set({ step: v })); break
    case 'all': case 'any': {
      const list = x[k] as QuestTrigger[]
      body = `<div class="nest">${list.map((s, i) => `<div class="row">${questTriggerForm(f, ctx, q, s, (ns) => set({ [k]: ns ? list.map((y, j) => (j === i ? ns : y)) : list.filter((_, j) => j !== i) } as QuestTrigger), depth + 1)}</div>`).join('')}<div class="row">${questTriggerForm(f, ctx, q, undefined, (ns) => ns && set({ [k]: [...list, ns] } as QuestTrigger), depth + 1)}</div></div>`
      break
    }
    case 'not': body = `<div class="nest">${questTriggerForm(f, ctx, q, x.not as QuestTrigger, (ns) => set(ns ? { not: ns } : undefined), depth + 1)}</div>`; break
    default: body = f.json(t, (v) => set(v as QuestTrigger), (m) => toast(m, 'error'), 2)
  }
  return `<span class="trig">${kind} ${body} ${f.link('✕', () => set(undefined), { cls: 'x', title: 'remove' })}</span>`
}

/** A person's name, for the forms' lists. */
export const nameOf = (ctx: Ctx, id: string) => tx(namesOf(ctx).people.find((p) => p.id === id)?.name) || id
