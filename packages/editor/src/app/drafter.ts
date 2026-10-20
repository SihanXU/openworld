// The AI drafter (the editor's AI plan): a button at the bottom right of every page opens it; the author says in a
// sentence what to add — a new thing, a person, a map — and the modder drafts it from what the game has. A thing is
// checked by the engine (it can be had, it is good for something, its numbers sit among its kind: format/src/things.ts)
// and taken into learned/ and the modder's library; a person or a map is compiled with the project first, its problems
// said, and taken in as the game's own file. What it drafts first follows the page: a person on People, a map on the
// Map, a thing elsewhere.

import type { Patch, PixelArt, RawChunk, TypeDef } from '@openworld/engine'
import { checkThings, makingStock, type PersonFile, type Problem, type ThingReport } from '@openworld/format'
import type { Ctx } from './context.ts'
import { setDown } from './events.ts'
import { icon } from './icons.ts'
import { idsOf } from './mapEdit.ts'
import { holesMode } from './modes.ts'
import { phrase } from './lang.ts'
import { takeThing } from './newThing.ts'
import { esc, t, toast, tx } from './ui.ts'
import { adoptTexts, shown } from './words.ts'
import { fileOf, mapContext, personContext, problemsWith } from './drafts.ts'

const MODDER = 'openworld.editor.modder'

export type DraftKind = 'thing' | 'person' | 'map'
const KINDS: [DraftKind, string, string][] = [
  ['thing', phrase('A thing'), phrase('a lantern of slime gel that glows at night')],
  ['person', phrase('A person'), phrase('a gardener who worries about her beans, up at dawn')],
  ['map', phrase('A map'), phrase('a clearing in a pine wood with a woodcutter\'s hut and a stream')],
]

interface Draft {
  kind: DraftKind
  intent: string
  state: 'drafting' | 'checking' | 'drafted' | 'failed' | 'taken'
  since: number
  patch?: Patch
  look?: string
  reports?: ThingReport[]
  /** A person's or a map's file, and its problems compiled with the project. */
  data?: Record<string, unknown>
  file?: string
  problems?: Problem[]
  errors?: string[]
}

/** A 16×16 picture as an image the page can show (each character a palette colour, "." none). */
export function artUrl(art: PixelArt, scale = 8): string {
  const c = document.createElement('canvas')
  c.width = c.height = 16 * scale
  const g = c.getContext('2d')!
  art.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = art.palette[ch]
    if (ch === '.' || !col) return
    g.fillStyle = col
    g.fillRect(x * scale, y * scale, scale, scale)
  }))
  return c.toDataURL()
}

const CHECK_NAMES: Record<ThingReport['checks'][number]['id'], string> = {
  valid: phrase('The engine takes it'),
  obtainable: phrase('A player can have it'),
  useful: phrase('It is good for something'),
  numbers: phrase('Its numbers sit among its kind'),
}

export class Drafter {
  private open = false
  private kind: DraftKind = 'thing'
  private intent: Partial<Record<DraftKind, string>> = {}
  private draft?: Draft
  private tick?: ReturnType<typeof setInterval>

  constructor(private ctx: () => Ctx, private fab: HTMLElement, private drawer: HTMLElement, private page: () => string) {
    fab.innerHTML = `${icon('stamp', 18)}<span>${t('Draft with AI')}</span>`
    fab.title = t('Say what to add, and the AI drafts it: a thing, a person, a map')
    fab.onclick = () => this.toggle(this.page())
  }

  private get modder(): string {
    try {
      return localStorage.getItem(MODDER) ?? 'http://localhost:8787'
    } catch {
      return 'http://localhost:8787'
    }
  }

  /** Opened on a page, it drafts what that page makes (until the author chooses another). */
  toggle(mode?: string): void {
    this.open = !this.open
    // (a draft still to read or take keeps its kind; once taken or failed, the page says what comes next)
    const pending = this.draft && this.draft.state !== 'taken' && this.draft.state !== 'failed'
    if (this.open && !pending) this.kind = mode === 'people' ? 'person' : mode === 'map' ? 'map' : this.kind
    this.draw()
  }

  /** The drawer, drawn again when its own state changes (never on the project's: a field being typed keeps its place). */
  draw(): void {
    this.drawer.hidden = !this.open
    this.fab.classList.toggle('on', this.open)
    if (!this.open) return
    const ctx = this.ctx()
    const busy = this.draft?.state === 'drafting' || this.draft?.state === 'checking'
    const [, , example] = KINDS.find(([k]) => k === this.kind)!
    this.drawer.innerHTML = `<header><b>${t('Draft with AI')}</b><span class="grow"></span><button data-close title="${t('Close')}">×</button></header>
      <div class="dr-body">
        <div class="seg">${KINDS.map(([k, n]) => `<button data-kind="${k}" class="${k === this.kind ? 'on' : ''}" ${busy ? 'disabled' : ''}>${t(n)}</button>`).join('')}</div>
        <textarea id="drIntent" rows="3" placeholder="${esc(t(example))}" ${busy ? 'disabled' : ''}>${esc(this.intent[this.kind] ?? '')}</textarea>
        <div class="row"><button id="drGo" class="on" ${busy ? 'disabled' : ''}>${busy ? t('Drafting…') : t('Draft it')}</button><span class="muted">${esc(t('From what this game has; checked before you take it in.'))}</span></div>
        ${this.kind === 'person' && personContext(ctx).anchors.filter((a) => a.startsWith(`${ctx.map}:`)).length < 2 ? `<p class="warn">${t('This map has few named spots for a day: add some on the Marks layer first.')}</p>` : ''}
        <div id="drOut">${this.result(ctx)}</div>
      </div>`
    const area = this.drawer.querySelector<HTMLTextAreaElement>('#drIntent')!
    area.oninput = () => (this.intent[this.kind] = area.value)
    this.drawer.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.toggle(this.page())
    this.drawer.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) => (b.onclick = () => ((this.kind = b.dataset.kind as DraftKind), this.draw())))
    this.drawer.querySelector<HTMLButtonElement>('#drGo')!.onclick = () => void this.ask()
    this.wireResult(ctx)
  }

  // ---------------------------------------------------------------- what was drafted, to read and take in

  private result(ctx: Ctx): string {
    const d = this.draft
    if (!d || d.kind !== this.kind) return ''
    if (d.state === 'drafting') return `<p>${t('The AI is drafting it… {s} s', { s: Math.round((Date.now() - d.since) / 1000) })}</p>`
    if (d.state === 'checking') return `<p>${t('Checking it with the game…')}</p>`
    if (d.state === 'failed') return `<p class="warn">${t('No draft.')}</p><ul>${(d.errors ?? []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
    const taken = d.state === 'taken'
    const card = d.kind === 'thing' ? this.thingCards(d) : d.kind === 'person' ? this.personCard(ctx, d) : this.mapCard(ctx, d)
    const problems = d.problems?.length ? `<ul class="dr-problems">${d.problems.map((p) => `<li class="${p.level}">${esc(p.message)}</li>`).join('')}</ul>` : d.kind === 'thing' ? '' : `<p class="ok">${t('It compiles with the game, no problem.')}</p>`
    const blocked = d.kind === 'thing' ? !d.reports?.every((r) => r.checks.find((c) => c.id === 'valid')?.ok) : !!d.problems?.some((p) => p.level === 'error')
    const after = d.kind === 'thing'
      ? `<button id="drPlace">${t('Set one down by the start')}</button> <button id="drHoles">${t('Its holes: ask the AI what it does')}</button>`
      : d.kind === 'person' ? `<button id="drOpen">${t('Open them in People')}</button>` : `<button id="drOpen">${t('Open the map')}</button>`
    return `${d.look ? `<p class="muted">${esc(d.look)}</p>` : ''}${card}${problems}
      <div class="row">${taken ? `<span class="ok">${t('Taken in: {file}.', { file: `<code>${esc(d.file ?? '')}</code>` })}</span> ${after}` : `<button id="drTake" class="on" ${blocked ? 'disabled' : ''}>${t('Take it into the game')}</button><button id="drAgain">${t('Draft again')}</button><button id="drLeave">${t('Leave it')}</button>`}</div>`
  }

  private wireResult(ctx: Ctx): void {
    const on = (id: string, f: () => void) => this.drawer.querySelector<HTMLButtonElement>(id)?.addEventListener('click', f)
    on('#drTake', () => void this.take(ctx))
    on('#drAgain', () => void this.ask())
    on('#drLeave', () => ((this.draft = undefined), this.draw()))
    const d = this.draft
    if (!d) return
    const types = (d.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'type' ? [a.type] : []))
    on('#drPlace', () => this.placeThing(ctx, types.at(-1)!.id))
    on('#drHoles', () => holesMode.focus(ctx, types.at(-1)!.id))
    on('#drOpen', () => {
      if (d.kind === 'person') ((ctx.sel = { person: d.data!.id as string }), ctx.open('people', d.file))
      else (ctx.open('map'), ctx.showMap((d.data!.map as { id: string }).id))
    })
    // a drafted map's ground, drawn small
    const cv = this.drawer.querySelector<HTMLCanvasElement>('#drMap')
    if (cv && d.data) drawMap(ctx, cv, d.data as unknown as RawChunk)
  }

  /** A thing's new types as the author reads them: icon, names, kind, how it is made, its numbers, and the checks. */
  private thingCards(d: Draft): string {
    const types = (d.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'type' ? [a.type] : []))
    return types.map((ty) => {
      const r = d.reports?.find((x) => x.type === ty.id)
      const name = ty.name && typeof ty.name === 'object' ? (ty.name as Record<string, string>) : { en: String(ty.name ?? ty.id) }
      const made = ty.makeup?.length ? `${ty.station === 'hands' || !ty.station ? t('by hand') : t('at a {station}', { station: esc(ty.station) })}: ${ty.makeup.map((m) => `${m.count} × <code>${esc(m.type)}</code>`).join(' + ')}` : t('not made by anyone')
      return `<div class="box thing-card"><div class="thing-head">${ty.art ? `<img class="px big" src="${artUrl(ty.art)}" alt="">` : `<div class="px big none">${t('no icon')}</div>`}
          <div><h3>${Object.values(name).map(esc).join(' · ')}</h3><p><code>${esc(ty.id)}</code></p>
          <p>${(ty.tags ?? []).map((g) => `<span class="chip">${esc(g)}</span>`).join(' ')}</p><p>${t('Made {how}', { how: made })}</p>
          ${ty.props && Object.keys(ty.props).length ? `<p class="muted">${Object.entries(ty.props).map(([k, v]) => `${esc(k)} ${esc(typeof v === 'string' ? v : JSON.stringify(v))}`).join(' · ')}</p>` : ''}</div></div>
        ${r ? `<table class="sched">${r.checks.map((c) => `<tr><td>${c.ok ? '<span class="ok">✓</span>' : '<span class="warn">✗</span>'}</td><td><b>${t(CHECK_NAMES[c.id])}</b></td><td><small>${c.detail.map(esc).join('<br>')}</small></td></tr>`).join('')}</table>` : ''}</div>`
    }).join('')
  }

  private personCard(ctx: Ctx, d: Draft): string {
    const p = d.data as unknown as PersonFile
    const npc = p.npc ?? ({} as NonNullable<PersonFile['npc']>)
    return `<div class="box"><h3>${esc(shown(p.name) || p.id)} <small class="muted">${esc(shown(ctx.onto().types[p.type]?.name) || p.type)} · <code>${esc(p.id)}</code></small></h3>
      <table class="sched">${(npc.schedule ?? []).map((e) => `<tr><td>${e.from}–${e.to}</td><td><code>${esc(e.at)}</code></td><td>${esc(tx(e.activity as never) || '')}</td></tr>`).join('')}</table>
      <ul class="things">${(npc.person?.lines ?? []).map((l) => `<li>“${esc(tx(l.text))}” <small>${esc(l.key)}</small></li>`).join('')}</ul></div>`
  }

  private mapCard(_ctx: Ctx, d: Draft): string {
    const c = d.data as unknown as RawChunk
    return `<div class="box"><h3>${esc(tx(c.map.name) || c.map.id)} <small class="muted"><code>${esc(c.map.id)}</code> · ${c.map.width}×${c.map.height} · ${esc(c.map.kind)}</small></h3>
      <canvas id="drMap"></canvas>
      <p class="muted">${t('{n} things · spots: {anchors}', { n: c.entities.length, anchors: esc(Object.keys(c.map.anchors ?? {}).join(', ') || '—') })}</p></div>`
  }

  // ---------------------------------------------------------------- asking, checking, taking in

  private async ask(): Promise<void> {
    const ctx = this.ctx()
    const kind = this.kind
    const intent = (this.intent[kind] ?? '').trim()
    if (!intent) return toast(t('Say what it is first.'), 'warn')
    this.draft = { kind, intent, state: 'drafting', since: Date.now() }
    clearInterval(this.tick)
    this.tick = setInterval(() => this.draw(), 1000)
    this.draw()
    try {
      if (kind === 'thing') {
        const r = await fetch(`${this.modder}/create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent, ...this.had(ctx) }) })
        const reply = (await r.json()) as { patch: Patch | null; diagnostics?: string[]; look?: string; error?: string }
        if (!reply.patch) this.draft = { kind, intent, state: 'failed', since: Date.now(), errors: reply.diagnostics?.length ? reply.diagnostics : [reply.error ?? t('no answer')] }
        else {
          this.draft = { kind, intent, state: 'checking', since: Date.now(), patch: reply.patch, look: reply.look }
          this.draw()
          await new Promise((ok) => setTimeout(ok, 30))
          this.draft = { ...this.draft, state: 'drafted', reports: checkThings(ctx.store.compiled(), reply.patch) }
        }
      } else {
        const r = await fetch(`${this.modder}/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, intent, context: kind === 'person' ? personContext(ctx) : mapContext(ctx) }) })
        const reply = (await r.json()) as { draft: Record<string, unknown> | null; diagnostics?: string[]; error?: string }
        if (!reply.draft) this.draft = { kind, intent, state: 'failed', since: Date.now(), errors: reply.diagnostics?.length ? reply.diagnostics : [reply.error ?? t('no answer')] }
        else {
          this.draft = { kind, intent, state: 'checking', since: Date.now(), data: reply.draft }
          this.draw()
          await new Promise((ok) => setTimeout(ok, 30))
          const file = fileOf(kind, reply.draft)
          this.draft = { ...this.draft, state: 'drafted', file, problems: problemsWith(ctx, kind, file, reply.draft) }
        }
      }
    } catch (e) {
      this.draft = { kind, intent, state: 'failed', since: Date.now(), errors: [t('No modder at {url} ({why}).', { url: this.modder, why: (e as Error).message })] }
    } finally {
      clearInterval(this.tick)
    }
    this.draw()
  }

  /** What a player of this game can make things of, as the modder is told it: the things one can carry, and the stations. */
  private had(ctx: Ctx): { had: { id: string; name?: string; props?: Record<string, unknown> }[]; stations: string[] } {
    const { had, stations } = makingStock(ctx.store.compiled())
    const onto = ctx.onto()
    return { had: had.map((id) => ({ id, name: tx(onto.types[id]?.name ?? id), props: onto.types[id]?.props })), stations }
  }

  private async take(ctx: Ctx): Promise<void> {
    const d = this.draft
    if (!d) return
    if (d.kind === 'thing') {
      const types = (d.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'type' ? [a.type] : [])) as TypeDef[]
      if (!types.length) return
      const { file, sent } = takeThing(ctx.store, types)
      try {
        const r = (await (await fetch(`${this.modder}/adopt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patch: sent }) })).json()) as { ok?: boolean; errors?: string[] }
        if (!r.ok) toast(t('The modder did not take it: {why}', { why: (r.errors ?? []).join('; ') }), 'warn')
      } catch (e) {
        toast(t('No modder at {url} ({why}).', { url: this.modder, why: (e as Error).message }), 'warn')
      }
      this.draft = { ...d, state: 'taken', file }
    } else {
      // the game's own file: its words in the game's language, the translations the AI gave into the tables
      const file = d.file!
      ctx.store.add(file, adoptTexts(file, structuredClone(d.data!)), t('a drafted {kind}: {file}', { kind: t(d.kind === 'person' ? 'person' : 'map'), file }))
      this.draft = { ...d, state: 'taken' }
    }
    toast(t('Taken in: {file}.', { file: this.draft.file ?? '' }))
    this.draw()
  }

  /** One of a new thing on the ground beside where the game begins, to find at once in a playtest. */
  private placeThing(ctx: Ctx, type: string): void {
    const start = ctx.store.game.start
    const file = ctx.store.mapFile(start.map)
    if (!file) return toast(t('The start map is missing.'), 'warn')
    const taken = idsOf(ctx.store.maps().map((m) => m.data), ctx.store.list<PersonFile>('people').map((p) => p.data.id))
    ctx.store.change<RawChunk>(file, t('set down {kind} by the start', { kind: type }), (ch) => void setDown(ch, type, { x: start.x + 1, y: start.y }, taken))
    toast(t('Set down by the start: it lies one step to the right.'))
  }
}

/** A map's ground, a pixel a cell in its terrain's colour, its things as dots. */
function drawMap(ctx: Ctx, cv: HTMLCanvasElement, c: RawChunk): void {
  const s = Math.max(2, Math.floor(260 / Math.max(c.map.width, c.map.height)))
  cv.width = c.map.width * s
  cv.height = c.map.height * s
  const g = cv.getContext('2d')!
  const chars = ctx.store.game.terrainChars
  const onto = ctx.onto()
  c.map.rows.forEach((row, y) => [...row].forEach((ch, x) => ((g.fillStyle = onto.terrains[chars[ch] ?? '']?.color ?? '#333'), g.fillRect(x * s, y * s, s, s))))
  g.fillStyle = '#ffd23f'
  for (const e of c.entities) if (e.place.on === 'tile') g.fillRect(e.place.x * s + s / 4, e.place.y * s + s / 4, s / 2, s / 2)
}
