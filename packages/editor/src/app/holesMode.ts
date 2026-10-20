// The AI as co-author (docs/engine-split.md §6, P6): the holes panel. For every kind the author sees which acts on
// it are still undefined — where, in play, the AI answers — and answers one: by hand (a rule of the project's),
// or by asking the modder (the offline profile: more care, review before it ships). A patch the modder gives is
// read as its tree, replayed in the sandbox with it, and taken into the game (learned/: the patches the game
// ships with, every new game and save beginning from them) or left. "Written large offline and patched free
// online by one mechanism" (design.md §10).

import { buildRequest, buildSandbox, restoreLibrary, scenarioEvent, validatePatch, type ModProgress, type Patch, type ResolveReply, type Rule, type Scenario, type ValidationResult } from '@openworld/engine'
import { holeScenario, holesByType, holesFor, targetsOf, type Compiled, type HoleCell, type HoleReport, type LearnedFile } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import { outline, replayed, type RulesMode } from './rulesMode.ts'
import { phrase } from './lang.ts'
import { esc, t, toast, tx } from './ui.ts'
import { adoptTexts } from './words.ts'

const MODDER = 'openworld.editor.modder'

interface Asked {
  cell: HoleCell
  /** The scene the question was asked in (the request's): its answer is judged and replayed in it, as the game would. */
  scenario: Scenario
  state: 'asking' | 'answered' | 'failed'
  stage?: string
  reply?: ResolveReply
  /** Whether the answer holds where it was asked (validated in its scene). */
  holds?: ValidationResult
  replay?: string
  error?: string
}

/**
 * Does an answer hold where it was asked, as the game would judge it: validated in the request's scene (the
 * triggering event replayed: it is undefined without the patch, and resolves to it with it), against the game's
 * library with the patches it ships with.
 */
export function answerHolds(c: Compiled, scenario: Scenario, patch: Patch): ValidationResult {
  try {
    const lib = restoreLibrary(c.bundle.rules, c.bundle.learned, structuredClone(c.bundle.ontology))
    return validatePatch(patch, { ontology: structuredClone(c.bundle.ontology), library: lib, scenario })
  } catch (e) {
    return { ok: false, errors: [(e as Error).message], warnings: [] }
  }
}

export class HolesMode implements Mode {
  id = 'holes'
  label = phrase('Holes · AI')
  private report?: HoleReport
  private counting?: { done: number; of: number }
  private countedAt?: unknown
  private sel?: string
  private filter = ''
  private asked?: Asked
  private modder = (() => { try { return localStorage.getItem(MODDER) ?? 'http://localhost:8787' } catch { return 'http://localhost:8787' } })()
  private health?: string
  /** How the modder works on it: offline (an agent on the world as a repository, its tools, more care) or live (one call, as in play). */
  private profile: 'offline' | 'live' = 'offline'

  constructor(private rules: () => RulesMode) {}

  /** Count every hole of the project, a few kinds at a time (the window stays the author's while it counts). */
  private async count(ctx: Ctx): Promise<void> {
    const c = ctx.store.compiled()
    const targets = targetsOf(c.bundle.ontology)
    const cells: HoleCell[] = []
    let checked = 0
    this.counting = { done: 0, of: targets.length }
    ctx.refresh()
    for (let i = 0; i < targets.length; i += 8) {
      const r = holesFor(c.bundle.ontology, c.bundle.rules, { targets: targets.slice(i, i + 8), learned: c.bundle.learned })
      cells.push(...r.cells)
      checked += r.checked
      this.counting = { done: Math.min(targets.length, i + 8), of: targets.length }
      ctx.refresh()
      await new Promise((ok) => setTimeout(ok))
    }
    const self = holesFor(c.bundle.ontology, c.bundle.rules, { verbs: ['self'], learned: c.bundle.learned })
    this.report = { cells: [...cells, ...self.cells], checked: checked + self.checked }
    this.countedAt = c
    this.counting = undefined
    ctx.refresh()
  }

  /** Open at one kind's holes, counted for it alone: a new thing taken in, whose acts are asked here. */
  focus(ctx: Ctx, type: string): void {
    const c = ctx.store.compiled()
    const on = holesFor(c.bundle.ontology, c.bundle.rules, { targets: [type], learned: c.bundle.learned })
    const held = holesFor(c.bundle.ontology, c.bundle.rules, { hands: [type], verbs: ['use', 'self'], learned: c.bundle.learned })
    this.report = { cells: [...on.cells, ...held.cells], checked: on.checked + held.checked }
    this.countedAt = c
    this.sel = type
    this.asked = undefined
    ctx.open('holes')
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const r = this.report
    const by = r ? [...holesByType(r)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) : []
    const shown = by.filter(([t]) => !this.filter || t.includes(this.filter))
    const stale = r && this.countedAt !== ctx.store.compiled()
    left.innerHTML = `<h3>${t('The holes')}</h3>
      <p class="muted">${t('Every bare hand, every thing in hand and every thing used on oneself, on every kind of thing: what is undefined is where the AI answers in play.')}</p>
      <button id="hCount" ${this.counting ? 'disabled' : ''}>${this.counting ? t('Counting… {done}/{of}', { done: this.counting.done, of: this.counting.of }) : r ? t('Count again') : t('Count the holes')}</button>
      ${r ? `<p>${t('{n} holes in {acts} acts', { n: r.cells.length, acts: r.checked })}${stale ? ` <span class="warn">${t('(before the last edits)')}</span>` : ''}</p>
        <input id="hFilter" placeholder="${t('filter kinds')}" value="${esc(this.filter)}">
        <div class="palette list" style="max-height:52vh">${shown.map(([t, n]) => `<div class="tree-row ${t === this.sel ? 'on' : ''}" data-kind="${esc(t)}">${esc(t)}<small>${n}</small></div>`).join('')}</div>` : ''}`
    left.querySelector<HTMLButtonElement>('#hCount')!.onclick = () => void this.count(ctx)
    left.querySelectorAll<HTMLElement>('[data-kind]').forEach((x) => (x.onclick = () => ((this.sel = x.dataset.kind), (this.asked = undefined), ctx.refresh())))
    const f = left.querySelector<HTMLInputElement>('#hFilter')
    if (f) f.oninput = () => { this.filter = f.value; ctx.refresh(); const g = document.querySelector<HTMLInputElement>('#hFilter'); g?.focus(); g?.setSelectionRange(f.value.length, f.value.length) }
    right.innerHTML = `<h3>${t('The modder')}</h3>
      <p class="muted">${t('The service that answers holes for this game ({command}).', { command: `<code>npm run modder -- serve 8787 --game games/${esc(ctx.store.id)}</code>` })}</p>
      <label>${t('at')} <input id="hModder" value="${esc(this.modder)}"></label><button id="hHealth">${t('Is it there?')}</button>
      <label>${t('how')} <select id="hProfile"><option value="offline" ${this.profile === 'offline' ? 'selected' : ''}>${t('offline: an agent on the world, with tools (more care)')}</option><option value="live" ${this.profile === 'live' ? 'selected' : ''}>${t('live: one call, as in play')}</option></select></label>
      ${this.health ? `<p>${this.health}</p>` : ''}
      <h3>${t('Taken in')}</h3><ul class="things">${ctx.store.list<LearnedFile>('learned').flatMap((l) => (l.data.rules ?? []).map((r) => `<li>${esc(r.id)} <small>${esc(l.file)}</small> <a data-unlearn="${esc(l.file)}" class="x">✕</a></li>`)).join('') || `<li class="muted">${t('No patch yet: the game ships with its base rules alone.')}</li>`}</ul>`
    const m = right.querySelector<HTMLInputElement>('#hModder')!
    m.onchange = () => { this.modder = m.value.trim().replace(/\/+$/, ''); try { localStorage.setItem(MODDER, this.modder) } catch { /* a private window */ } }
    right.querySelector<HTMLSelectElement>('#hProfile')!.onchange = (e) => (this.profile = (e.target as HTMLSelectElement).value as 'offline' | 'live')
    right.querySelector<HTMLButtonElement>('#hHealth')!.onclick = async () => {
      try {
        const h = (await (await fetch(`${this.modder}/health`, { signal: AbortSignal.timeout(3000) })).json()) as { game?: string | null; model?: string | null; library?: { patches: number } }
        this.health = `${h.game ? t('for {game}', { game: `<b>${esc(h.game)}</b>` }) : t('for an unnamed game')}${h.game && h.game !== ctx.store.game.id ? ` <span class="warn">${t('— not this one ({id})', { id: esc(ctx.store.game.id) })}</span>` : ''} · ${t('model {model}', { model: esc(h.model ?? t('none')) })} · ${t('{n} patches', { n: h.library?.patches ?? 0 })}`
      } catch (e) {
        this.health = `<span class="warn">${esc(t('No modder at {url} ({why}).', { url: this.modder, why: (e as Error).message }))}</span>`
      }
      ctx.refresh()
    }
    right.querySelectorAll<HTMLElement>('[data-unlearn]').forEach((a) => (a.onclick = () => ctx.store.remove(a.dataset.unlearn!, t('leave {file}', { file: a.dataset.unlearn! }))))
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const r = this.report
    if (!r) return void (el.innerHTML = `<p class="muted">${t('Count the holes (left) to see where the world has no answer yet.')}</p>`)
    if (!this.sel) return void (el.innerHTML = `<p class="muted">${t('Choose a kind on the left: its holes as what is acted on, and as what is held.')}</p>`)
    const cells = r.cells.filter((c) => c.target === this.sel || c.hand === this.sel)
    const a = this.asked
    el.innerHTML = `<h3>${esc(this.sel)}</h3><p class="muted">${t('{n} holes', { n: cells.length })}</p>
      <table class="sched"><tr><th>${t('act')}</th><th>${t('in hand')}</th><th>${t('on')}</th><th>${t('falls into')}</th><th></th></tr>
      ${cells.slice(0, 300).map((c, i) => `<tr><td>${esc(c.verb)}</td><td>${esc(c.hand || '—')}</td><td>${esc(c.target)}</td><td><small>${esc(c.kind)} · ${esc(c.rule)}${c.path.length ? ` › ${t('{n} branches', { n: c.path.length })}` : ''}</small></td><td><button data-ask="${i}">${t('Ask the AI')}</button> <button data-hand="${i}">${t('By hand')}</button></td></tr>`).join('')}</table>
      ${cells.length > 300 ? `<p class="muted">${t('… and {n} more', { n: cells.length - 300 })}</p>` : ''}
      ${a ? this.review(a) : ''}`
    el.querySelectorAll<HTMLButtonElement>('[data-ask]').forEach((b) => (b.onclick = () => void this.ask(ctx, cells[Number(b.dataset.ask)])))
    el.querySelectorAll<HTMLButtonElement>('[data-hand]').forEach((b) => (b.onclick = () => this.byHand(ctx, cells[Number(b.dataset.hand)])))
    el.querySelector<HTMLButtonElement>('#pReplay')?.addEventListener('click', () => { if (this.asked?.reply?.patch) (this.asked.replay = this.replayWith(ctx, this.asked, this.asked.reply.patch)), ctx.refresh() })
    el.querySelector<HTMLButtonElement>('#pTake')?.addEventListener('click', () => this.take(ctx))
    el.querySelector<HTMLButtonElement>('#pLeave')?.addEventListener('click', () => ((this.asked = undefined), ctx.refresh()))
  }

  /** What the modder answered, to read before it is taken. */
  private review(a: Asked): string {
    const c = a.cell
    const head = `<div class="box"><h3>${esc(c.verb)} ${esc(c.hand || t('a bare hand'))} → ${esc(c.target)}</h3>`
    if (a.state === 'asking') return `${head}<p>${t('Asking the modder…')} ${esc(a.stage ?? '')}</p></div>`
    if (a.state === 'failed' || !a.reply?.patch) return `${head}<p class="warn">${esc(a.error ?? t('No patch ({why})', { why: a.reply?.outcome ?? t('no answer') }))}${a.reply?.diagnostics?.length ? `: ${esc(a.reply.diagnostics.join('; '))}` : ''}</p></div>`
    const p = a.reply.patch
    const rules = p.artifacts.flatMap((x) => (x.kind === 'rule' ? [x.rule] : []))
    const others = p.artifacts.filter((x) => x.kind !== 'rule')
    return `${head}<p class="muted">${esc(a.reply.outcome)}${a.reply.episode ? ` · ${t('episode {id}', { id: esc(a.reply.episode) })}` : ''}${p.note ? ` · ${esc(p.note)}` : ''}</p>
      ${rules.map((r) => `<p>${t('{rule} on {kind} for {host}', { rule: `<b>${esc(r.id)}</b>`, kind: `<code>${esc(r.on)}</code>`, host: `<code>${esc(JSON.stringify(r.host ?? {}))}</code>` })}${r.doc ? ` — ${esc(r.doc)}` : ''}</p><div class="outline">${outline(r.tree)}</div>`).join('')}
      ${others.length ? `<p class="muted">${t('and {list}', { list: others.map((x) => esc(x.kind === 'type' ? t('the type {id}', { id: x.type.id }) : x.kind === 'status' ? t('the status {id}', { id: x.status.id }) : '')).join(', ') })}</p>` : ''}
      ${a.holds && !a.holds.ok ? `<p class="warn">${esc(t('The patch does not hold here: {why}', { why: a.holds.errors.join('; ') }))}</p>` : ''}
      <button id="pReplay">${t('Replay it in the sandbox')}</button> <button id="pTake" class="on" ${a.holds?.ok ? '' : 'disabled'}>${t('Take it into the game')}</button> <button id="pLeave">${t('Leave it')}</button>
      ${a.replay ? `<div class="outline">${a.replay}</div>` : ''}</div>`
  }

  /** Ask the modder for the hole's patch: the request the game would make there, in the offline profile. */
  private async ask(ctx: Ctx, cell: HoleCell): Promise<void> {
    const c = ctx.store.compiled()
    // asked at the high tier (the engine's quality.ts): an answer the author takes into the game serves every setting
    const sc = { ...holeScenario(cell), tier: 'high' as const }
    const eng = buildSandbox(sc, structuredClone(c.bundle.ontology), restoreLibrary(c.bundle.rules, c.bundle.learned, structuredClone(c.bundle.ontology)))
    const p = eng.preview(scenarioEvent(sc, eng))
    if (!p.hole) return toast(t('That is no hole any more (count again).'), 'warn')
    const id = `editor-${Date.now().toString(36)}`
    const request = buildRequest(eng, p.hole.ev, p.hole.res, id)
    this.asked = { cell, scenario: request.scenario, state: 'asking' }
    ctx.refresh()
    const poll = setInterval(async () => {
      try {
        const pr = (await (await fetch(`${this.modder}/progress?id=${encodeURIComponent(id)}`)).json()) as ModProgress
        if (this.asked?.state === 'asking' && pr.stage) (this.asked.stage = pr.stage + (pr.creating?.length ? `: ${pr.creating.map((x) => tx(x)).join(', ')}` : '')), ctx.refresh()
      } catch { /* it answers when it answers */ }
    }, 1500)
    try {
      const r = await fetch(`${this.modder}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request, profile: this.profile }) })
      const reply = (await r.json()) as ResolveReply & { error?: string }
      this.asked = { cell, scenario: request.scenario, state: reply.patch ? 'answered' : 'failed', reply, error: reply.error }
      if (reply.patch) this.asked.replay = this.replayWith(ctx, this.asked, reply.patch)
    } catch (e) {
      this.asked = { cell, scenario: request.scenario, state: 'failed', error: t('No modder at {url} ({why}).', { url: this.modder, why: (e as Error).message }) }
    } finally {
      clearInterval(poll)
    }
    ctx.refresh()
  }

  /** The hole's act replayed with the patch in the library (as the game would have it, taken in), once it holds in the scene it was asked in. */
  private replayWith(ctx: Ctx, a: Asked, patch: Patch): string {
    const c = ctx.store.compiled()
    const res = (a.holds = answerHolds(c, a.scenario, patch))
    if (!res.ok) return `<span class="h">${esc(t('The patch does not hold here: {why}', { why: res.errors.join('; ') }))}</span>`
    const lib = restoreLibrary(c.bundle.rules, c.bundle.learned, structuredClone(c.bundle.ontology))
    for (const x of patch.artifacts) {
      if (x.kind === 'type') lib.addType(x.type)
      else if (x.kind === 'status') lib.addStatus(x.status)
      else if (x.kind === 'rule') lib.add(x.rule)
    }
    return replayed(ctx, a.scenario, lib)
  }

  /** Take the patch into the game: a learned/ file of the project, which the game ships with. Only one that holds where it was asked (judged again: the project may have changed since). */
  private take(ctx: Ctx): void {
    const a = this.asked
    const p = a?.reply?.patch
    if (!a || !p) return
    const holds = (a.holds = answerHolds(ctx.store.compiled(), a.scenario, p))
    if (!holds.ok) {
      ctx.refresh()
      return toast(t('The patch does not hold here: {why}', { why: holds.errors.join('; ') }), 'warn')
    }
    // a patch, taken in by its author: its source says so
    const rules = p.artifacts.flatMap((x) => (x.kind === 'rule' ? [{ ...x.rule, source: { ...x.rule.source, origin: 'patch' as const, at: x.rule.source?.at ?? new Date().toISOString(), note: x.rule.source?.note ?? `taken in the editor${this.asked?.reply?.episode ? ` (episode ${this.asked.reply.episode})` : ''}` } }] : []))
    const data: LearnedFile = {
      rules,
      ...(p.artifacts.some((x) => x.kind === 'type') && { types: p.artifacts.flatMap((x) => (x.kind === 'type' ? [x.type] : [])) }),
      ...(p.artifacts.some((x) => x.kind === 'status') && { statuses: p.artifacts.flatMap((x) => (x.kind === 'status' ? [x.status] : [])) }),
    }
    const name = (rules[0]?.id ?? `patch-${Date.now()}`).replace(/[^A-Za-z0-9._-]+/g, '-')
    const file = `learned/${name}.json`
    // (its words as the game writes them: in its language, the translations the modder gave into the tables)
    ctx.store.batch(t('take {name} into the game', { name }), () => {
      adoptTexts(file, data)
      if (ctx.store.get(file)) ctx.store.change<LearnedFile>(file, t('take {name} again', { name }), (d) => Object.assign(d, data))
      else ctx.store.add(file, data, t('take {name} into the game', { name }))
    })
    if (this.report) this.report = { ...this.report, cells: this.report.cells.filter((c) => c !== this.asked!.cell) }
    this.asked = undefined
    toast(t('Taken in: {file}. Save, and the game ships with it.', { file }))
  }

  /** Answer the hole by hand: a rule of the project's for the kind the hole's event is of, on its exact kind. */
  private byHand(ctx: Ctx, cell: HoleCell): void {
    const leaf = cell.host.split('/').pop()
    const rule: Rule = { id: `${leaf}/${cell.kind.split('/').pop()}${cell.hand ? `-${cell.hand.split('/').pop()}` : ''}`, doc: `What ${cell.host} does on ${cell.kind}${cell.hand ? ` with ${cell.hand}` : ''}.`, host: { type: cell.host }, on: cell.kind, tree: { do: [{ op: 'log', text: { en: 'Something happens.', zh: '发生了点什么。' } }] } }
    ctx.store.batch(t('a new rule {id}', { id: rule.id }), () => this.rules().startWith(ctx, adoptTexts('rules/rules.json', [rule])[0]))
    ctx.open('rules')
  }
}

