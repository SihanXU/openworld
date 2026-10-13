// The rules (docs/engine-split.md §6: event pages become a type's rules — host × event kind → condition tree). A
// rule is shown as its tree and written as JSON, checked as it is typed: the patch validator's checks that hold
// for base rules, and the ties with every other rule (design.md §5.6). "Which rule answers here" puts an act
// in a sandbox — who does it, to what, with what in hand — and says which rule decides, where in its tree, and
// what the chain did; the sandbox replays any scenario.

import { RuleLibrary, buildModSpec, buildSandbox, scenarioEvent, type Cond, type Effect, type Rule, type Scenario, type Tree } from '@openworld/engine'
import { ruleProblems } from '@openworld/format'
import { STDLIB_RULES } from '@openworld/stdlib'
import type { Ctx, Mode } from './context.ts'
import { esc, toast, tx } from './ui.ts'

const VERBS: [string, string][] = [['use', 'use (left click)'], ['hands', 'hands (E)'], ['take', 'take (F)'], ['put', 'put (G)'], ['self', 'use on oneself (right click)']]

export class RulesMode implements Mode {
  /** Begin a rule here (the holes' "answer by hand"): written into the project's first rules file, and chosen. */
  startWith(ctx: Ctx, rule: Rule): void {
    const file = ctx.store.list<Rule[]>('rules')[0]?.file ?? 'rules/rules.json'
    this.sel = rule.id
    this.draft = undefined
    if (!ctx.store.get(file)) ctx.store.add(file, [rule], `a new rule ${rule.id}`)
    else ctx.store.change<Rule[]>(file, `a new rule ${rule.id}`, (rs) => rs.push(rule))
  }

  /** Show the rules whose id, kind or host has this (a thing's own kind: the rules on it). */
  filterBy(text: string): void {
    this.filter = text
  }

  id = 'rules'
  label = 'Rules'
  private sel?: string
  private filter = ''
  private draft?: string
  private ask = { actor: 'actor/person/player', verb: 'use', target: '', instrument: '' }
  private answer?: string
  private scenario?: string
  private replayed?: string

  /** Where each rule is: its project file, or the standard library. */
  private where(ctx: Ctx): Map<string, { file?: string; rule: Rule }> {
    const out = new Map<string, { file?: string; rule: Rule }>()
    if (ctx.store.game.stdlib !== false) for (const r of STDLIB_RULES) out.set(r.id, { rule: r })
    for (const f of ctx.store.list<Rule[]>('rules')) for (const r of f.data) out.set(r.id, { file: f.file, rule: r })
    return out
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const all = [...this.where(ctx).values()]
    const shown = all.filter(({ rule: r }) => !this.filter || [r.id, r.on, r.host?.type ?? '', ...(r.host?.tags ?? [])].some((s) => s.includes(this.filter)))
    const files = ctx.store.list<Rule[]>('rules').map((f) => f.file)
    const groups = [...new Set(shown.map((x) => x.file ?? 'the standard library'))]
    left.innerHTML = `<input id="ruFilter" placeholder="filter by id, kind, host" value="${esc(this.filter)}">
      <div class="palette list" style="max-height:62vh">${groups.map((g) => `<h3>${esc(g)}</h3>${shown.filter((x) => (x.file ?? 'the standard library') === g).map(({ rule: r }) => `<div class="tree-row ${r.id === this.sel ? 'on' : ''}" data-rule="${esc(r.id)}">${esc(r.id)}<small>${esc(r.on)}</small></div>`).join('')}`).join('')}</div>
      <details><summary>New rule</summary>
        <label>id <input id="ruNewId" placeholder="apple/eat"></label>
        <label>in <select id="ruNewFile">${[...files, 'rules/rules.json'].filter((f, i, a) => a.indexOf(f) === i).map((f) => `<option>${esc(f)}</option>`).join('')}</select></label>
        <button id="ruNew">Make it</button></details>`
    const f = left.querySelector<HTMLInputElement>('#ruFilter')!
    f.oninput = () => { this.filter = f.value; ctx.refresh(); const g = document.querySelector<HTMLInputElement>('#ruFilter'); g?.focus(); g?.setSelectionRange(f.value.length, f.value.length) }
    left.querySelectorAll<HTMLElement>('[data-rule]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.rule), (this.draft = undefined), ctx.refresh())))
    left.querySelector<HTMLButtonElement>('#ruNew')!.onclick = () => {
      const id = left.querySelector<HTMLInputElement>('#ruNewId')!.value.trim()
      if (!/^[a-z0-9][a-z0-9_./-]*$/.test(id)) return toast('A rule\'s id: lower case, "/" between its parts (apple/eat).', 'warn')
      if (this.where(ctx).has(id)) return toast(`There is a rule ${id} already.`, 'warn')
      const file = left.querySelector<HTMLSelectElement>('#ruNewFile')!.value
      this.sel = id
      this.draft = undefined
      const rule: Rule = { id, doc: 'What it is, in words.', host: { type: 'item' }, on: 'act/use', tree: { if: { same: ['actor', 'target'] }, then: { do: [{ op: 'log', text: { en: 'Nothing happens.', zh: '什么也没有发生。' } }] }, else: 'inherit' } }
      if (!ctx.store.get(file)) ctx.store.add(file, [rule], `a new rule ${id}`)
      else ctx.store.change<Rule[]>(file, `a new rule ${id}`, (rs) => rs.push(rule))
    }
    // the reference: what a rule may use (the ModSpec the AI is given, for this game)
    const spec = buildModSpec(ctx.onto())
    right.innerHTML = `<h3>What a rule may use</h3><p class="muted">The ModSpec of this game: its event kinds, primitives and conditions (its modules' among them).</p>
      <details><summary>Event kinds (${Object.keys(spec.events).length})</summary><ul class="things">${Object.entries(spec.events).map(([k, d]) => `<li><code>${esc(k)}</code> <small>${esc(d)}</small></li>`).join('')}</ul></details>
      <details><summary>Impulses (${Object.keys(spec.impulses).length})</summary><ul class="things">${Object.entries(spec.impulses).map(([k, d]) => `<li><code>${esc(k)}</code> <small>${esc(d)}</small></li>`).join('')}</ul></details>
      <details><summary>Primitives (${Object.keys(spec.primitives).length})</summary><ul class="things">${Object.entries(spec.primitives).map(([k, d]) => `<li><code>${esc(k)}</code> <small>${esc(d)}</small></li>`).join('')}</ul></details>
      <details><summary>Conditions (${spec.conditions.length})</summary><ul class="things">${spec.conditions.map((c) => `<li><small>${esc(c)}</small></li>`).join('')}</ul></details>
      <details><summary>The tree</summary><ul class="things">${Object.entries(spec.tree).map(([k, d]) => `<li><code>${esc(k)}</code> <small>${esc(d)}</small></li>`).join('')}</ul></details>`
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const where = this.where(ctx)
    const at = this.sel ? where.get(this.sel) : undefined
    const onto = ctx.onto()
    const types = Object.keys(onto.types).sort()
    const targets = [...types, ...Object.keys(onto.terrains).map((t) => `tile/${t}`)]
    const parts: string[] = []
    if (at) {
      const r = at.rule
      const text = this.draft ?? JSON.stringify(r, null, 2)
      parts.push(`<h3>${esc(r.id)}</h3><p class="muted">${at.file ? `in <code>${esc(at.file)}</code>` : 'the standard library\'s — <button id="ruOverride">Write the project\'s own over it</button>'} · host <code>${esc(JSON.stringify(r.host ?? {}))}</code> · on <code>${esc(r.on)}</code></p>
        ${r.doc ? `<p>${esc(r.doc)}</p>` : ''}
        <div class="cols"><div class="box outline">${outline(r.tree)}</div>
        <div><textarea id="ruJson" rows="18" ${at.file ? '' : 'readonly'}>${esc(text)}</textarea>
          <div id="ruCheck"></div>
          ${at.file ? '<button id="ruApply">Apply</button> <button id="ruDel" class="danger">Remove the rule</button>' : ''}</div></div>`)
    } else parts.push('<p class="muted">Choose a rule on the left, or make one.</p>')
    parts.push(`<div class="box"><h3>Which rule answers here?</h3>
      <label>who <input id="aActor" list="dlTypes" value="${esc(this.ask.actor)}"></label>
      <label>does <select id="aVerb">${VERBS.map(([v, n]) => `<option value="${v}" ${v === this.ask.verb ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>to <input id="aTarget" list="dlTargets" value="${esc(this.ask.target)}" placeholder="a type, or tile/<terrain>"></label>
      <label>with in hand <input id="aInstrument" list="dlTypes" value="${esc(this.ask.instrument)}" placeholder="nothing"></label>
      <button id="aGo">Ask</button>
      <datalist id="dlTypes">${types.map((t) => `<option value="${esc(t)}">`).join('')}</datalist><datalist id="dlTargets">${targets.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      ${this.answer ? `<div class="outline">${this.answer}</div>` : ''}</div>
      <div class="box"><h3>Sandbox</h3><p class="muted">A scenario: the cells, the things, one event (roles by key), ticks after it. Ask above to start from one.</p>
      <textarea id="sbJson" rows="10">${esc(this.scenario ?? '')}</textarea><button id="sbGo">Replay</button>
      ${this.replayed ? `<div class="outline">${this.replayed}</div>` : ''}</div>`)
    el.innerHTML = parts.join('')

    // live: the rule as typed, checked against the rest of the library
    const json = el.querySelector<HTMLTextAreaElement>('#ruJson')
    const check = el.querySelector<HTMLElement>('#ruCheck')
    const live = () => {
      if (!json || !check || !at) return
      this.draft = json.value
      let r: Rule
      try {
        r = JSON.parse(json.value) as Rule
      } catch (e) {
        return void (check.innerHTML = `<ul class="problems-inline"><li>Not JSON: ${esc((e as Error).message)}</li></ul>`)
      }
      const rules = [...ctx.store.compiled().bundle.rules.filter((x) => x.id !== at.rule.id), { ...r, source: { origin: 'base' as const } }]
      const found = ruleProblems(rules, structuredClone(onto), new Set([r.id]))
      check.innerHTML = found.length ? `<ul class="problems-inline">${found.map((p) => `<li class="${p.level}">${esc(p.message)}</li>`).join('')}</ul>` : '<p class="ok">The validator and the tie check find nothing.</p>'
    }
    if (json) json.oninput = () => live()
    live()
    el.querySelector<HTMLButtonElement>('#ruApply')?.addEventListener('click', () => {
      try {
        const r = JSON.parse(json!.value) as Rule
        this.sel = r.id
        this.draft = undefined
        ctx.store.change<Rule[]>(at!.file!, `rule ${r.id}`, (rs) => { const i = rs.findIndex((x) => x.id === at!.rule.id); rs[i] = r })
      } catch (e) {
        toast(`Not JSON: ${(e as Error).message}`, 'error')
      }
    })
    el.querySelector<HTMLButtonElement>('#ruDel')?.addEventListener('click', () => {
      if (!confirm(`Remove ${at!.rule.id}?`)) return
      ctx.store.change<Rule[]>(at!.file!, `remove ${at!.rule.id}`, (rs) => rs.splice(rs.findIndex((x) => x.id === at!.rule.id), 1))
      this.sel = undefined
    })
    el.querySelector<HTMLButtonElement>('#ruOverride')?.addEventListener('click', () => {
      const file = ctx.store.list<Rule[]>('rules')[0]?.file ?? 'rules/rules.json'
      const r = structuredClone(at!.rule)
      if (!ctx.store.get(file)) ctx.store.add(file, [r], `the project's own ${r.id}`)
      else ctx.store.change<Rule[]>(file, `the project's own ${r.id}`, (rs) => rs.push(r))
    })
    el.querySelector<HTMLButtonElement>('#aGo')!.onclick = () => {
      const v = (id: string) => el.querySelector<HTMLInputElement | HTMLSelectElement>(id)!.value.trim()
      this.ask = { actor: v('#aActor') || 'actor/person/player', verb: v('#aVerb'), target: v('#aTarget'), instrument: v('#aInstrument') }
      const sc = scenarioFor(this.ask)
      this.scenario = JSON.stringify(sc, null, 1)
      this.answer = answer(ctx, sc)
      this.replayed = replayed(ctx, sc)
      ctx.refresh()
    }
    el.querySelector<HTMLButtonElement>('#sbGo')!.onclick = () => {
      this.scenario = el.querySelector<HTMLTextAreaElement>('#sbJson')!.value
      try {
        this.replayed = replayed(ctx, JSON.parse(this.scenario) as Scenario)
      } catch (e) {
        this.replayed = `<span class="h">${esc((e as Error).message)}</span>`
      }
      ctx.refresh()
    }
  }

  focus(_ctx: Ctx, _file: string, at?: string): void {
    if (at) (this.sel = at), (this.draft = undefined)
  }
}

// ---------------------------------------------------------------- a tree in words

const cond = (c: Cond): string => `<span class="c">${esc(JSON.stringify(c))}</span>`
const effect = (e: Effect): string => { const { op, ...rest } = e as Effect & Record<string, unknown>; return `<span class="e">${esc(op)}</span> ${esc(Object.keys(rest).length ? JSON.stringify(rest) : '')}` }

/** A rule's tree, indented: IF / THEN / ELSE, the effects of each leaf, the holes the AI answers. */
export function outline(t: Tree, depth = 0): string {
  const pad = '&nbsp;'.repeat(depth * 2)
  if (t === 'inherit') return `${pad}<span class="i">inherit — the next rule up answers</span><br>`
  if ('if' in t) return `${pad}<span class="k">IF</span> ${cond(t.if)}<br>${outline(t.then, depth + 1)}${t.else !== undefined ? `${pad}<span class="k">ELSE</span><br>${outline(t.else, depth + 1)}` : `${pad}<span class="i">(else: nothing)</span><br>`}`
  if ('undefined' in t) return `${pad}<span class="h">UNDEFINED — the AI answers</span>${t.default?.length ? `; meanwhile ${t.default.map(effect).join('; ')}` : ''}<br>`
  const label = t.label ? ` <span class="i">“${esc(tx(t.label))}”</span>` : ''
  return `${pad}<span class="k">DO</span>${label} ${t.do.length ? t.do.map(effect).join('; ') : '<span class="i">nothing</span>'}<br>`
}

// ---------------------------------------------------------------- which rule answers here

/** A scenario of one act: the actor in the middle, the target before it (or a cell), the instrument in its hand. */
function scenarioFor(a: { actor: string; verb: string; target: string; instrument: string }): Scenario {
  const tile = a.target.startsWith('tile/')
  const entities: Scenario['entities'] = [{ key: 'actor', type: a.actor, x: 2, y: 2 }]
  if (a.target && !tile && a.verb !== 'self') entities.push({ key: 'target', type: a.target, x: 2, y: 1 })
  if (a.instrument) entities.push({ key: 'instrument', type: a.instrument, x: 2, y: 2, heldBy: 'actor' })
  const kind = a.verb === 'self' ? 'act/use' : `act/${a.verb}`
  const target = a.verb === 'self' ? 'actor' : tile ? 'tile:2,1' : a.target ? 'target' : 'tile:2,1'
  return {
    ...(tile && { cells: [{ x: 2, y: 1, type: a.target }] }),
    entities,
    event: { kind: kind as never, actor: 'actor', target, ...(a.instrument && { instrument: 'instrument' }) },
  }
}

function sandbox(ctx: Ctx, sc: Scenario, lib?: RuleLibrary) {
  const c = ctx.store.compiled()
  return buildSandbox(sc, structuredClone(c.bundle.ontology), lib ?? new RuleLibrary(c.bundle.rules))
}

/** Which rule decides the scenario's event, where in its tree, and whether it is a hole. */
function answer(ctx: Ctx, sc: Scenario): string {
  try {
    const eng = sandbox(ctx, sc)
    const res = eng.resolveEvent(scenarioEvent(sc, eng))
    const r = res.rule
    const hole = res.hole ? `<br><span class="h">a hole</span> in <b>${esc(res.hole.rule.id)}</b> at ${esc(res.hole.path.join(' › ') || 'its root')}: undefined — the AI answers here${res.hole.default.length ? `; meanwhile ${res.hole.default.map(effect).join('; ')}` : ''}` : ''
    return `<b>${esc(r?.id ?? '—')}</b> decides ${res.defined ? '' : '<span class="h">(undefined)</span>'}${r?.doc ? `<br><span class="i">${esc(r.doc)}</span>` : ''}${res.leaf ? `<br>${outline(res.leaf)}` : ''}${hole}`
  } catch (e) {
    return `<span class="h">${esc((e as Error).message)}</span>`
  }
}

/** The scenario replayed (with a library of its own: a patch under review in it): every rule the chain reached, what was said and shown, what changed. */
export function replayed(ctx: Ctx, sc: Scenario, lib?: RuleLibrary): string {
  try {
    const eng = sandbox(ctx, sc, lib)
    const w = eng.world
    const before = JSON.stringify(w.state.entities)
    const snap = new Map(Object.values(w.state.entities).map((e) => [e.id, JSON.stringify({ type: e.type, statuses: e.statuses, props: e.props, place: e.place })]))
    eng.trace = []
    const ev = scenarioEvent(sc, eng)
    const a = ev.kind.startsWith('act/') && ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : undefined
    if (a) eng.act(ev.kind.slice(4) as never, a, ev.roles.target!, { instrument: ev.roles.instrument ?? null, params: ev.params, reach: Infinity })
    else eng.queue(ev)
    for (let i = 0; i < (sc.ticks ?? 0); i++) eng.tick()
    const chain = eng.trace.map((t) => `${esc(t.ev.kind)} → <b>${esc(t.rule ?? '—')}</b>${t.defined ? '' : ' <span class="h">undefined</span>'}`)
    const said = w.fx.flatMap((f) => (f.t === "log" || f.t === "say" ? [`“${esc(tx(f.text))}”`] : []))
    const changed: string[] = []
    for (const e of Object.values(w.state.entities)) {
      const now = JSON.stringify({ type: e.type, statuses: e.statuses, props: e.props, place: e.place })
      if (!snap.has(e.id)) changed.push(`+ ${esc(e.id)} (${esc(e.type)})`)
      else if (snap.get(e.id) !== now) changed.push(`~ ${esc(e.id)} ${esc(now)}`)
    }
    for (const id of snap.keys()) if (!w.state.entities[id]) changed.push(`− ${esc(id)}`)
    return `<b>The chain</b><br>${chain.join('<br>') || '—'}<br><b>Said and shown</b><br>${said.join('<br>') || '—'}<br><b>Changed</b><br>${changed.join('<br>') || (JSON.stringify(w.state.entities) === before ? 'nothing' : '—')}`
  } catch (e) {
    return `<span class="h">${esc((e as Error).message)}</span>`
  }
}
