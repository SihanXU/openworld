// The AI drafter (the editor's AI plan): a button at the bottom right of every page opens it, a chat. The author says in
// a sentence what to add — a new thing, a person, a map — and the modder drafts it from what the game has; each step
// shows as it comes (the AI's answer summed up with its JSON, what the engine sent back, the pictures drawn: never the
// model's thinking), and a later message asks for a change to the draft held. A thing is
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
import { draftRequest, fileOf, mapContext, personContext, problemsWith, type Step } from './drafts.ts'

const MODDER = 'openworld.editor.modder'

export type DraftKind = 'thing' | 'person' | 'map'
const KINDS: [DraftKind, string, string][] = [
  ['thing', phrase('A thing'), phrase('a lantern of slime gel that glows at night')],
  ['person', phrase('A person'), phrase('a gardener who worries about her beans, up at dawn')],
  ['map', phrase('A map'), phrase('a clearing in a pine wood with a woodcutter\'s hut and a stream')],
]

interface Draft {
  kind: DraftKind
  /** What the conversation first asked for (a revision keeps it). */
  intent: string
  state: 'drafting' | 'checking' | 'drafted' | 'failed' | 'taken' | 'left'
  since: number
  patch?: Patch
  look?: string
  reports?: ThingReport[]
  /** A person's or a map's file, and its problems compiled with the project. */
  data?: Record<string, unknown>
  file?: string
  problems?: Problem[]
  errors?: string[]
  usage?: { calls: number; input: number; output: number }
}

/** One message of the author's and what came of it: the modder's steps, then the draft. */
interface Turn {
  said: string
  id: string
  steps: Step[]
  draft: Draft
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

const WHO: Record<Step['who'], string> = { ai: phrase('AI'), engine: phrase('Engine'), artist: phrase('Artist') }
/** The modder's own words for a step, in the editor's language (the AI's summaries stay as written). */
const STEP_WORDS: Record<string, string> = {
  'sent back to the AI': phrase('sent back to the AI'),
  'its shape holds': phrase('its shape holds'),
  'the engine takes it': phrase('The engine takes it'),
  drawn: phrase('drawn'),
  'no draft held after three tries': phrase('no draft held after three tries'),
}

/** What a draft is waiting on, by its last step: the artist drawing, the AI mending what was sent back, or drafting. */
const waitWords = (turn: Turn, s: number): string => {
  const last = turn.steps.at(-1)
  return last?.who === 'artist' ? t('Drawing it… {s} s', { s }) : last?.problems?.length ? t('The AI is mending it… {s} s', { s }) : t('The AI is drafting it… {s} s', { s })
}

export class Drafter {
  private open = false
  private kind: DraftKind = 'thing'
  /** A conversation for each kind, and what is typed in its box. */
  private chats: Record<DraftKind, Turn[]> = { thing: [], person: [], map: [] }
  private typed: Partial<Record<DraftKind, string>> = {}
  /** The JSON an author opened (kept open as the chat is drawn again). */
  private opened = new Set<string>()
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

  private get turns(): Turn[] {
    return this.chats[this.kind]
  }

  private get busy(): boolean {
    return Object.values(this.chats).some((c) => c.some((x) => x.draft.state === 'drafting' || x.draft.state === 'checking'))
  }

  /** The draft a message would revise: the latest one drafted, unless one was taken since. */
  private held(turns = this.turns): Turn | undefined {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].draft.state === 'drafted') return turns[i]
      if (turns[i].draft.state === 'taken') return undefined
    }
    return undefined
  }

  /** Opened on a page, it drafts what that page makes (until the author chooses another). */
  toggle(mode?: string): void {
    this.open = !this.open
    // (a conversation with a draft still to read or take keeps its kind; else the page says what comes next)
    if (this.open && !this.held() && !this.busy) this.kind = mode === 'people' ? 'person' : mode === 'map' ? 'map' : this.kind
    this.draw()
  }

  /** The drawer's frame (drawn again on opening, a kind chosen, a new conversation: never as the chat moves, so the box keeps what is typed). */
  draw(): void {
    this.drawer.hidden = !this.open
    this.fab.classList.toggle('on', this.open)
    if (!this.open) return
    this.drawer.innerHTML = `<header><b>${t('Draft with AI')}</b><span class="grow"></span>
        <button data-new class="dr-new" title="${t('New conversation')}">${t('New')}</button><button data-close title="${t('Close')}">×</button></header>
      <div class="seg dr-kinds">${KINDS.map(([k, n]) => `<button data-kind="${k}" class="${k === this.kind ? 'on' : ''}">${t(n)}</button>`).join('')}</div>
      <div class="dr-chat" id="drChat"></div>
      <div class="dr-input"><textarea id="drSay" rows="2"></textarea><button id="drSend" class="on" title="${t('Send (Enter); Shift+Enter: a new line')}">↑</button></div>`
    const say = this.drawer.querySelector<HTMLTextAreaElement>('#drSay')!
    say.value = this.typed[this.kind] ?? ''
    say.oninput = () => (this.typed[this.kind] = say.value)
    // Enter sends; Shift+Enter a new line; never while an input method is still composing (Chinese, Japanese)
    say.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) (e.preventDefault(), void this.send())
    }
    this.drawer.querySelector<HTMLButtonElement>('#drSend')!.onclick = () => void this.send()
    this.drawer.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.toggle(this.page())
    this.drawer.querySelector<HTMLButtonElement>('[data-new]')!.onclick = () => {
      if (this.busy) return toast(t('Wait for the draft first.'), 'warn')
      this.chats[this.kind] = []
      this.draw()
    }
    this.drawer.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) => (b.onclick = () => ((this.kind = b.dataset.kind as DraftKind), this.draw())))
    this.chat()
    say.focus()
  }

  /** The conversation, drawn again as it moves (the JSON opened stays open; it follows the end when it was there). */
  private chat(): void {
    const box = this.drawer.querySelector<HTMLElement>('#drChat')
    if (!box) return
    const ctx = this.ctx()
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40
    const held = this.held()
    const [, , example] = KINDS.find(([k]) => k === this.kind)!
    const few = this.kind === 'person' && personContext(ctx).anchors.filter((a) => a.startsWith(`${ctx.map}:`)).length < 2
    box.innerHTML = (this.turns.length ? this.turns.map((turn, i) => this.turnHtml(ctx, turn, i, turn === held)).join('') : `<p class="muted dr-empty">${t('From what this game has; checked before you take it in.')}</p>`)
      + (few ? `<p class="warn">${t('This map has few named spots for a day: add some on the Marks layer first.')}</p>` : '')
    box.querySelectorAll<HTMLDetailsElement>('details[data-k]').forEach((d) => d.addEventListener('toggle', () => (d.open ? this.opened.add(d.dataset.k!) : this.opened.delete(d.dataset.k!))))
    const say = this.drawer.querySelector<HTMLTextAreaElement>('#drSay')
    if (say) (say.placeholder = held ? t('Say what to change in it…') : t(example)), (say.disabled = this.busy)
    const send = this.drawer.querySelector<HTMLButtonElement>('#drSend')
    if (send) send.disabled = this.busy
    this.wire(ctx)
    if (atEnd) box.scrollTop = box.scrollHeight
  }

  // ---------------------------------------------------------------- a turn: the author's message, the steps, the draft

  private turnHtml(ctx: Ctx, turn: Turn, i: number, held: boolean): string {
    const d = turn.draft
    const steps = turn.steps.map((s, j) => this.stepHtml(s, `${this.kind}:${turn.id}:${j}`)).join('')
    const secs = Math.round((Date.now() - d.since) / 1000)
    const waiting = d.state === 'drafting'
      ? `<div class="cc-line cc-wait"><span class="cc-dot">✻</span><span class="dr-wait" data-since="${d.since}">${waitWords(turn, secs)}</span></div>`
      : d.state === 'checking' ? `<div class="cc-line cc-wait"><span class="cc-dot">✻</span><span>${t('Checking it with the game…')}</span></div>` : ''
    const failed = d.state === 'failed' ? `<div class="cc-line cc-bad"><span class="cc-dot">⏺</span><div><b>${t('No draft.')}</b>${(turn.steps.length ? [] : d.errors ?? []).map((e) => `<div class="cc-sub">⎿ ${esc(e)}</div>`).join('')}</div></div>` : ''
    const card = d.state === 'drafted' || d.state === 'taken' ? this.cardHtml(ctx, d, i, held) : d.state === 'left' ? `<div class="cc-line muted"><span class="cc-dot">⏺</span><span>${t('Left it.')}</span></div>` : ''
    return `<div class="cc-user">${esc(turn.said)}</div>${steps}${waiting}${failed}${card}`
  }

  private stepHtml(s: Step, k: string): string {
    const text = STEP_WORDS[s.text] ? t(STEP_WORDS[s.text]) : s.text
    return `<div class="cc-line cc-${s.who}"><span class="cc-dot">⏺</span><div class="cc-text"><b>${t(WHO[s.who])}</b> ${esc(text).replace(/\n/g, '<br>')} <small class="muted">${(s.at / 1000).toFixed(1)} s</small>
      ${(s.problems ?? []).map((p) => `<div class="cc-sub">⎿ ${esc(p)}</div>`).join('')}
      ${s.data !== undefined ? `<details data-k="${esc(k)}" ${this.opened.has(k) ? 'open' : ''}><summary>JSON</summary><pre>${esc(JSON.stringify(s.data, null, 2))}</pre></details>` : ''}</div></div>`
  }

  /** The draft as the author reads it and takes it in (only the one held: an earlier one is folded away). */
  private cardHtml(ctx: Ctx, d: Draft, i: number, held: boolean): string {
    const card = d.kind === 'thing' ? this.thingCards(d) : d.kind === 'person' ? this.personCard(ctx, d) : this.mapCard(ctx, d, i)
    const problems = d.problems?.length ? `<ul class="dr-problems">${d.problems.map((p) => `<li class="${p.level}">${esc(p.message)}</li>`).join('')}</ul>` : d.kind === 'thing' ? '' : `<p class="ok">${t('It compiles with the game, no problem.')}</p>`
    const used = d.usage ? `<p class="muted">${t('{calls} calls · {input} tokens in, {output} out', { calls: d.usage.calls, input: d.usage.input, output: d.usage.output })}</p>` : ''
    const look = d.look ? `<p class="muted">${esc(d.look)}</p>` : ''
    if (d.state === 'drafted' && !held) return `<details class="cc-card old"><summary>${t('An earlier draft')}</summary>${look}${card}</details>`
    const blocked = d.kind === 'thing' ? !d.reports?.every((r) => r.checks.find((c) => c.id === 'valid')?.ok) : !!d.problems?.some((p) => p.level === 'error')
    const after = d.kind === 'thing'
      ? `<button data-act="place" data-i="${i}">${t('Set one down by the start')}</button> <button data-act="holes" data-i="${i}">${t('Its holes: ask the AI what it does')}</button>`
      : `<button data-act="open" data-i="${i}">${d.kind === 'person' ? t('Open them in People') : t('Open the map')}</button>`
    const row = d.state === 'taken'
      ? `<span class="ok">${t('Taken in: {file}.', { file: `<code>${esc(d.file ?? '')}</code>` })}</span> ${after}`
      : `<button data-act="take" class="on" ${blocked ? 'disabled' : ''}>${t('Take it into the game')}</button><button data-act="leave">${t('Leave it')}</button><span class="muted">${t('or say what to change.')}</span>`
    return `<div class="cc-card">${look}${card}${problems}${used}<div class="row">${row}</div></div>`
  }

  private wire(ctx: Ctx): void {
    const box = this.drawer.querySelector<HTMLElement>('#drChat')!
    box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => (b.onclick = () => {
      const turn = b.dataset.i ? this.turns[Number(b.dataset.i)] : this.held()
      if (!turn) return
      const d = turn.draft
      const types = (d.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'type' ? [a.type] : []))
      if (b.dataset.act === 'take') void this.take(ctx, turn)
      else if (b.dataset.act === 'leave') ((d.state = 'left'), this.chat())
      else if (b.dataset.act === 'place') this.placeThing(ctx, types.at(-1)!.id)
      else if (b.dataset.act === 'holes') holesMode.focus(ctx, types.at(-1)!.id)
      else if (d.kind === 'person') ((ctx.sel = { person: d.data!.id as string }), ctx.open('people', d.file))
      else (ctx.open('map'), ctx.showMap((d.data!.map as { id: string }).id))
    }))
    // a drafted map's ground, drawn small
    box.querySelectorAll<HTMLCanvasElement>('canvas.dr-map').forEach((cv) => {
      const d = this.turns[Number(cv.dataset.i)]?.draft
      if (d?.data) drawMap(ctx, cv, d.data as unknown as RawChunk)
    })
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

  private mapCard(_ctx: Ctx, d: Draft, i: number): string {
    const c = d.data as unknown as RawChunk
    return `<div class="box"><h3>${esc(tx(c.map.name) || c.map.id)} <small class="muted"><code>${esc(c.map.id)}</code> · ${c.map.width}×${c.map.height} · ${esc(c.map.kind)}</small></h3>
      <canvas class="dr-map" data-i="${i}"></canvas>
      <p class="muted">${t('{n} things · spots: {anchors}', { n: c.entities.length, anchors: esc(Object.keys(c.map.anchors ?? {}).join(', ') || '—') })}</p></div>`
  }

  // ---------------------------------------------------------------- asking (and following the steps), checking, taking in

  private async send(): Promise<void> {
    if (this.busy) return
    const ctx = this.ctx()
    const kind = this.kind
    const said = (this.typed[kind] ?? '').trim()
    if (!said) return toast(t('Say what it is first.'), 'warn')
    const held = this.held()
    const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const { path, body } = draftRequest(kind, said, id, held && { intent: held.draft.intent, patch: held.draft.patch, data: held.draft.data })
    const intent = held?.draft.intent ?? said
    const turn: Turn = { said, id, steps: [], draft: { kind, intent, state: 'drafting', since: Date.now() } }
    const turns = this.chats[kind]
    turns.push(turn)
    this.typed[kind] = ''
    const say = this.drawer.querySelector<HTMLTextAreaElement>('#drSay')
    if (say) say.value = ''
    this.chat()
    clearInterval(this.tick)
    // the steps as the modder keeps them, read while it works (a draft is minutes at most: no stream needed)
    this.tick = setInterval(() => void this.follow(turn), 800)
    const fail = (errors: string[]) => (turn.draft = { kind, intent, state: 'failed', since: Date.now(), errors })
    try {
      const extra = kind === 'thing' ? this.had(ctx) : { context: kind === 'person' ? personContext(ctx) : mapContext(ctx) }
      const r = await fetch(`${this.modder}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, ...extra }) })
      const reply = (await r.json()) as { patch?: Patch | null; draft?: Record<string, unknown> | null; diagnostics?: string[]; look?: string; error?: string; usage?: Draft['usage'] }
      clearInterval(this.tick)
      await this.follow(turn)
      const got = kind === 'thing' ? reply.patch : reply.draft
      if (!got) fail(reply.diagnostics?.length ? reply.diagnostics : [reply.error ?? t('no answer')])
      else {
        turn.draft = { kind, intent, state: 'checking', since: Date.now(), usage: reply.usage, ...(kind === 'thing' ? { patch: reply.patch!, look: reply.look } : { data: reply.draft! }) }
        this.chat()
        await new Promise((ok) => setTimeout(ok, 30))
        if (kind === 'thing') turn.draft = { ...turn.draft, state: 'drafted', reports: checkThings(ctx.store.compiled(), reply.patch!) }
        else {
          const file = fileOf(kind, reply.draft!)
          turn.draft = { ...turn.draft, state: 'drafted', file, problems: problemsWith(ctx, kind, file, reply.draft!) }
        }
      }
    } catch (e) {
      fail([t('No modder at {url} ({why}).', { url: this.modder, why: (e as Error).message })])
    } finally {
      clearInterval(this.tick)
    }
    if (this.open) this.chat()
  }

  /** The turn's steps so far, read from the modder; the chat drawn again when they moved, else only its clock. */
  private async follow(turn: Turn): Promise<void> {
    try {
      const r = (await (await fetch(`${this.modder}/trace?id=${encodeURIComponent(turn.id)}`)).json()) as { steps?: Step[] }
      if ((r.steps?.length ?? 0) > turn.steps.length) {
        turn.steps = r.steps!
        if (this.open) this.chat()
        return
      }
    } catch {
      // an older modder has no steps to show: the clock goes on
    }
    const w = this.drawer.querySelector<HTMLElement>('.dr-wait')
    if (w) w.textContent = waitWords(turn, Math.round((Date.now() - Number(w.dataset.since)) / 1000))
  }

  /** What a player of this game can make things of, as the modder is told it: the things one can carry, and the stations. */
  private had(ctx: Ctx): { had: { id: string; name?: string; props?: Record<string, unknown> }[]; stations: string[] } {
    const { had, stations } = makingStock(ctx.store.compiled())
    const onto = ctx.onto()
    return { had: had.map((id) => ({ id, name: tx(onto.types[id]?.name ?? id), props: onto.types[id]?.props })), stations }
  }

  private async take(ctx: Ctx, turn: Turn): Promise<void> {
    const d = turn.draft
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
      turn.draft = { ...d, state: 'taken', file }
    } else {
      // the game's own file: its words in the game's language, the translations the AI gave into the tables
      const file = d.file!
      ctx.store.add(file, adoptTexts(file, structuredClone(d.data!)), t('a drafted {kind}: {file}', { kind: t(d.kind === 'person' ? 'person' : 'map'), file }))
      turn.draft = { ...d, state: 'taken' }
    }
    toast(t('Taken in: {file}.', { file: turn.draft.file ?? '' }))
    this.chat()
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
