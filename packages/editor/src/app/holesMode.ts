// The AI as co-author (docs/engine-split.md §6, P6): the holes panel. For every kind the author sees which acts on
// it are still undefined — where, in play, the AI answers — and answers one: by hand (a rule of the project's),
// or by asking the modder (the offline profile: more care, review before it ships). A patch the modder gives is
// read as its tree, replayed in the sandbox with it, and taken into the game (learned/: the patches the game
// ships with, every new game and save beginning from them) or left. "Written large offline and patched free
// online by one mechanism" (design.md §10).

import { buildRequest, buildSandbox, restoreLibrary, scenarioEvent, validatePatch, type ModProgress, type Patch, type ResolveReply, type Rule } from '@openworld/engine'
import { holeScenario, holesByType, holesFor, targetsOf, type HoleCell, type HoleReport, type LearnedFile } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import { outline, replayed, type RulesMode } from './rulesMode.ts'
import { esc, toast, tx } from './ui.ts'

const MODDER = 'openworld.editor.modder'

interface Asked {
  cell: HoleCell
  state: 'asking' | 'answered' | 'failed'
  stage?: string
  reply?: ResolveReply
  replay?: string
  error?: string
}

export class HolesMode implements Mode {
  id = 'holes'
  label = 'Holes · AI'
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

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const r = this.report
    const by = r ? [...holesByType(r)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) : []
    const shown = by.filter(([t]) => !this.filter || t.includes(this.filter))
    const stale = r && this.countedAt !== ctx.store.compiled()
    left.innerHTML = `<h3>The holes</h3>
      <p class="muted">Every bare hand, every thing in hand and every thing used on oneself, on every kind of thing: what is undefined is where the AI answers in play.</p>
      <button id="hCount" ${this.counting ? 'disabled' : ''}>${this.counting ? `Counting… ${this.counting.done}/${this.counting.of}` : r ? 'Count again' : 'Count the holes'}</button>
      ${r ? `<p>${r.cells.length} holes in ${r.checked} acts${stale ? ' <span class="warn">(before the last edits)</span>' : ''}</p>
        <input id="hFilter" placeholder="filter kinds" value="${esc(this.filter)}">
        <div class="palette list" style="max-height:52vh">${shown.map(([t, n]) => `<div class="tree-row ${t === this.sel ? 'on' : ''}" data-kind="${esc(t)}">${esc(t)}<small>${n}</small></div>`).join('')}</div>` : ''}`
    left.querySelector<HTMLButtonElement>('#hCount')!.onclick = () => void this.count(ctx)
    left.querySelectorAll<HTMLElement>('[data-kind]').forEach((x) => (x.onclick = () => ((this.sel = x.dataset.kind), (this.asked = undefined), ctx.refresh())))
    const f = left.querySelector<HTMLInputElement>('#hFilter')
    if (f) f.oninput = () => { this.filter = f.value; ctx.refresh(); const g = document.querySelector<HTMLInputElement>('#hFilter'); g?.focus(); g?.setSelectionRange(f.value.length, f.value.length) }
    right.innerHTML = `<h3>The modder</h3>
      <p class="muted">The service that answers holes for this game (<code>npm run modder -- serve 8787 --game games/${esc(ctx.store.id)}</code>).</p>
      <label>at <input id="hModder" value="${esc(this.modder)}"></label><button id="hHealth">Is it there?</button>
      <label>how <select id="hProfile"><option value="offline" ${this.profile === 'offline' ? 'selected' : ''}>offline: an agent on the world, with tools (more care)</option><option value="live" ${this.profile === 'live' ? 'selected' : ''}>live: one call, as in play</option></select></label>
      ${this.health ? `<p>${this.health}</p>` : ''}
      <h3>Taken in</h3><ul class="things">${ctx.store.list<LearnedFile>('learned').flatMap((l) => (l.data.rules ?? []).map((r) => `<li>${esc(r.id)} <small>${esc(l.file)}</small> <a data-unlearn="${esc(l.file)}" class="x">✕</a></li>`)).join('') || '<li class="muted">No patch yet: the game ships with its base rules alone.</li>'}</ul>`
    const m = right.querySelector<HTMLInputElement>('#hModder')!
    m.onchange = () => { this.modder = m.value.trim().replace(/\/+$/, ''); try { localStorage.setItem(MODDER, this.modder) } catch { /* a private window */ } }
    right.querySelector<HTMLSelectElement>('#hProfile')!.onchange = (e) => (this.profile = (e.target as HTMLSelectElement).value as 'offline' | 'live')
    right.querySelector<HTMLButtonElement>('#hHealth')!.onclick = async () => {
      try {
        const h = (await (await fetch(`${this.modder}/health`, { signal: AbortSignal.timeout(3000) })).json()) as { game?: string | null; model?: string | null; library?: { patches: number } }
        this.health = `${h.game ? `for <b>${esc(h.game)}</b>` : 'for an unnamed game'}${h.game && h.game !== ctx.store.game.id ? ` <span class="warn">— not this one (${esc(ctx.store.game.id)})</span>` : ''} · model ${esc(h.model ?? 'none')} · ${h.library?.patches ?? 0} patches`
      } catch (e) {
        this.health = `<span class="warn">No modder at ${esc(this.modder)} (${esc((e as Error).message)}).</span>`
      }
      ctx.refresh()
    }
    right.querySelectorAll<HTMLElement>('[data-unlearn]').forEach((a) => (a.onclick = () => ctx.store.remove(a.dataset.unlearn!, `leave ${a.dataset.unlearn}`)))
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const r = this.report
    if (!r) return void (el.innerHTML = '<p class="muted">Count the holes (left) to see where the world has no answer yet.</p>')
    if (!this.sel) return void (el.innerHTML = '<p class="muted">Choose a kind on the left: its holes as what is acted on, and as what is held.</p>')
    const cells = r.cells.filter((c) => c.target === this.sel || c.hand === this.sel)
    const a = this.asked
    el.innerHTML = `<h3>${esc(this.sel)}</h3><p class="muted">${cells.length} holes</p>
      <table class="sched"><tr><th>act</th><th>in hand</th><th>on</th><th>falls into</th><th></th></tr>
      ${cells.slice(0, 300).map((c, i) => `<tr><td>${esc(c.verb)}</td><td>${esc(c.hand || '—')}</td><td>${esc(c.target)}</td><td><small>${esc(c.kind)} · ${esc(c.rule)}${c.path.length ? ` › ${esc(c.path.length)} branches` : ''}</small></td><td><button data-ask="${i}">Ask the AI</button> <button data-hand="${i}">By hand</button></td></tr>`).join('')}</table>
      ${cells.length > 300 ? `<p class="muted">… and ${cells.length - 300} more</p>` : ''}
      ${a ? this.review(a) : ''}`
    el.querySelectorAll<HTMLButtonElement>('[data-ask]').forEach((b) => (b.onclick = () => void this.ask(ctx, cells[Number(b.dataset.ask)])))
    el.querySelectorAll<HTMLButtonElement>('[data-hand]').forEach((b) => (b.onclick = () => this.byHand(ctx, cells[Number(b.dataset.hand)])))
    el.querySelector<HTMLButtonElement>('#pReplay')?.addEventListener('click', () => { if (this.asked?.reply?.patch) (this.asked.replay = this.replayWith(ctx, this.asked.cell, this.asked.reply.patch)), ctx.refresh() })
    el.querySelector<HTMLButtonElement>('#pTake')?.addEventListener('click', () => this.take(ctx))
    el.querySelector<HTMLButtonElement>('#pLeave')?.addEventListener('click', () => ((this.asked = undefined), ctx.refresh()))
  }

  /** What the modder answered, to read before it is taken. */
  private review(a: Asked): string {
    const c = a.cell
    const head = `<div class="box"><h3>${esc(c.verb)} ${esc(c.hand || 'a bare hand')} → ${esc(c.target)}</h3>`
    if (a.state === 'asking') return `${head}<p>Asking the modder… ${esc(a.stage ?? '')}</p></div>`
    if (a.state === 'failed' || !a.reply?.patch) return `${head}<p class="warn">${esc(a.error ?? `No patch (${a.reply?.outcome ?? 'no answer'})`)}${a.reply?.diagnostics?.length ? `: ${esc(a.reply.diagnostics.join('; '))}` : ''}</p></div>`
    const p = a.reply.patch
    const rules = p.artifacts.flatMap((x) => (x.kind === 'rule' ? [x.rule] : []))
    const others = p.artifacts.filter((x) => x.kind !== 'rule')
    return `${head}<p class="muted">${esc(a.reply.outcome)}${a.reply.episode ? ` · episode ${esc(a.reply.episode)}` : ''}${p.note ? ` · ${esc(p.note)}` : ''}</p>
      ${rules.map((r) => `<p><b>${esc(r.id)}</b> on <code>${esc(r.on)}</code> for <code>${esc(JSON.stringify(r.host ?? {}))}</code>${r.doc ? ` — ${esc(r.doc)}` : ''}</p><div class="outline">${outline(r.tree)}</div>`).join('')}
      ${others.length ? `<p class="muted">and ${others.map((x) => esc(x.kind === 'type' ? `the type ${x.type.id}` : x.kind === 'status' ? `the status ${x.status.id}` : '')).join(', ')}</p>` : ''}
      <button id="pReplay">Replay it in the sandbox</button> <button id="pTake" class="on">Take it into the game</button> <button id="pLeave">Leave it</button>
      ${a.replay ? `<div class="outline">${a.replay}</div>` : ''}</div>`
  }

  /** Ask the modder for the hole's patch: the request the game would make there, in the offline profile. */
  private async ask(ctx: Ctx, cell: HoleCell): Promise<void> {
    const c = ctx.store.compiled()
    // asked at the high tier (the engine's quality.ts): an answer the author takes into the game serves every setting
    const sc = { ...holeScenario(cell), tier: 'high' as const }
    const eng = buildSandbox(sc, structuredClone(c.bundle.ontology), restoreLibrary(c.bundle.rules, c.bundle.learned, structuredClone(c.bundle.ontology)))
    const p = eng.preview(scenarioEvent(sc, eng))
    if (!p.hole) return toast('That is no hole any more (count again).', 'warn')
    const id = `editor-${Date.now().toString(36)}`
    const request = buildRequest(eng, p.hole.ev, p.hole.res, id)
    this.asked = { cell, state: 'asking' }
    ctx.refresh()
    const poll = setInterval(async () => {
      try {
        const pr = (await (await fetch(`${this.modder}/progress?id=${encodeURIComponent(id)}`)).json()) as ModProgress
        if (this.asked?.state === 'asking' && pr.stage) (this.asked.stage = pr.stage + (pr.creating?.length ? `: ${pr.creating.map((t) => tx(t)).join(', ')}` : '')), ctx.refresh()
      } catch { /* it answers when it answers */ }
    }, 1500)
    try {
      const r = await fetch(`${this.modder}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request, profile: this.profile }) })
      const reply = (await r.json()) as ResolveReply & { error?: string }
      this.asked = { cell, state: reply.patch ? 'answered' : 'failed', reply, error: reply.error }
      if (reply.patch) this.asked.replay = this.replayWith(ctx, cell, reply.patch)
    } catch (e) {
      this.asked = { cell, state: 'failed', error: `No modder at ${this.modder}: ${(e as Error).message}` }
    } finally {
      clearInterval(poll)
    }
    ctx.refresh()
  }

  /** The hole's act replayed with the patch in the library (as the game would have it, taken in). */
  private replayWith(ctx: Ctx, cell: HoleCell, patch: Patch): string {
    const c = ctx.store.compiled()
    const lib = restoreLibrary(c.bundle.rules, c.bundle.learned, structuredClone(c.bundle.ontology))
    const res = validatePatch(patch, { ontology: structuredClone(c.bundle.ontology), library: lib })
    if (!res.ok) return `<span class="h">The patch does not hold here: ${esc(res.errors.join('; '))}</span>`
    for (const x of patch.artifacts) {
      if (x.kind === 'type') lib.addType(x.type)
      else if (x.kind === 'status') lib.addStatus(x.status)
      else if (x.kind === 'rule') lib.add(x.rule)
    }
    return replayed(ctx, holeScenario(cell), lib)
  }

  /** Take the patch into the game: a learned/ file of the project, which the game ships with. */
  private take(ctx: Ctx): void {
    const p = this.asked?.reply?.patch
    if (!p) return
    // a patch, taken in by its author: its source says so
    const rules = p.artifacts.flatMap((x) => (x.kind === 'rule' ? [{ ...x.rule, source: { ...x.rule.source, origin: 'patch' as const, at: x.rule.source?.at ?? new Date().toISOString(), note: x.rule.source?.note ?? `taken in the editor${this.asked?.reply?.episode ? ` (episode ${this.asked.reply.episode})` : ''}` } }] : []))
    const data: LearnedFile = {
      rules,
      ...(p.artifacts.some((x) => x.kind === 'type') && { types: p.artifacts.flatMap((x) => (x.kind === 'type' ? [x.type] : [])) }),
      ...(p.artifacts.some((x) => x.kind === 'status') && { statuses: p.artifacts.flatMap((x) => (x.kind === 'status' ? [x.status] : [])) }),
    }
    const name = (rules[0]?.id ?? `patch-${Date.now()}`).replace(/[^A-Za-z0-9._-]+/g, '-')
    const file = `learned/${name}.json`
    if (ctx.store.get(file)) ctx.store.change<LearnedFile>(file, `take ${name} again`, (d) => Object.assign(d, data))
    else ctx.store.add(file, data, `take ${name} into the game`)
    if (this.report) this.report = { ...this.report, cells: this.report.cells.filter((c) => c !== this.asked!.cell) }
    this.asked = undefined
    toast(`Taken in: ${file}. Save, and the game ships with it.`)
  }

  /** Answer the hole by hand: a rule of the project's for the kind the hole's event is of, on its exact kind. */
  private byHand(ctx: Ctx, cell: HoleCell): void {
    const leaf = cell.host.split('/').pop()
    const rule: Rule = { id: `${leaf}/${cell.kind.split('/').pop()}${cell.hand ? `-${cell.hand.split('/').pop()}` : ''}`, doc: `What ${cell.host} does on ${cell.kind}${cell.hand ? ` with ${cell.hand}` : ''}.`, host: { type: cell.host }, on: cell.kind, tree: { do: [{ op: 'log', text: { en: 'Something happens.', zh: '发生了点什么。' } }] } }
    this.rules().startWith(ctx, rule)
    ctx.open('rules')
  }
}

