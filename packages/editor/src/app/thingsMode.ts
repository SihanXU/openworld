// A new thing, asked for in a sentence (the editor's AI plan, M1): the modder drafts its type and draws its icon,
// made of what a player of this game can have (the editor counts that, format/src/things.ts); the engine checks
// that it holds, can be had, is good for something and sits among its kind; the author takes it into the game (a
// learned/ file, and the modder's library, so its holes can be asked next), sets one down by the start, and plays.

import type { Patch, PixelArt, TypeDef } from '@openworld/engine'
import { checkThings, obtainable, type LearnedFile, type ThingReport } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import type { HolesMode } from './holesMode.ts'
import { setDown } from './events.ts'
import { idsOf } from './mapEdit.ts'
import { phrase } from './lang.ts'
import { esc, t, toast, tx } from './ui.ts'
import { takeThing } from './newThing.ts'
import type { PersonFile } from '@openworld/format'
import type { RawChunk } from '@openworld/engine'

const MODDER = 'openworld.editor.modder'

interface Draft {
  intent: string
  state: 'drafting' | 'checking' | 'drafted' | 'failed' | 'taken'
  since: number
  patch?: Patch
  look?: string
  reports?: ThingReport[]
  errors?: string[]
  /** The learned/ file it was taken into. */
  file?: string
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

export class ThingsMode implements Mode {
  id = 'things'
  label = phrase('New thing · AI')
  private draft?: Draft
  private intent = ''
  private tick?: ReturnType<typeof setInterval>

  constructor(private holes: () => HolesMode) {}

  private get modder(): string {
    try {
      return localStorage.getItem(MODDER) ?? 'http://localhost:8787'
    } catch {
      return 'http://localhost:8787'
    }
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const busy = this.draft?.state === 'drafting'
    const examples = [phrase('a lantern of slime gel that glows at night'), phrase('a stone hammer, heavier than the axe'), phrase('a wooden shield bound with gel')]
    left.innerHTML = `<h3>${t('A new thing')}</h3>
      <p class="muted">${t('Say what it is. The AI drafts its kind, what it is made of and its icon, from what a player of this game can have; the engine checks it before you take it in.')}</p>
      <textarea id="nIntent" rows="4" placeholder="${t('a lantern of slime gel that glows at night')}" ${busy ? 'disabled' : ''}>${esc(this.intent)}</textarea>
      <button id="nDraft" class="on" ${busy ? 'disabled' : ''}>${busy ? t('Drafting…') : t('Draft it')}</button>
      <p class="muted">${t('For instance:')}</p>
      <ul class="things">${examples.map((x, i) => `<li><a data-ex="${i}">${esc(t(x))}</a></li>`).join('')}</ul>`
    const area = left.querySelector<HTMLTextAreaElement>('#nIntent')!
    area.oninput = () => (this.intent = area.value)
    left.querySelector<HTMLButtonElement>('#nDraft')!.onclick = () => void this.ask(ctx)
    left.querySelectorAll<HTMLElement>('[data-ex]').forEach((a) => (a.onclick = () => ((this.intent = t(examples[Number(a.dataset.ex)])), ctx.refresh())))
    const mine = ctx.store.list<LearnedFile>('learned').flatMap((l) => (l.data.types ?? []).map((ty) => ({ ty, file: l.file })))
    right.innerHTML = `<h3>${t('The modder')}</h3>
      <p class="muted">${t('At {url} (set in the Holes · AI mode).', { url: `<code>${esc(this.modder)}</code>` })}</p>
      <h3>${t('New things in this game')}</h3>
      <ul class="things">${mine.map(({ ty, file }) => `<li>${ty.art ? `<img class="px" src="${artUrl(ty.art, 2)}" alt="">` : ''} ${esc(tx(ty.name ?? ty.id))} <small>${esc(ty.id)}</small> <a data-unlearn="${esc(file)}" class="x">✕</a></li>`).join('') || `<li class="muted">${t('None yet.')}</li>`}</ul>`
    right.querySelectorAll<HTMLElement>('[data-unlearn]').forEach((a) => (a.onclick = () => ctx.store.remove(a.dataset.unlearn!, t('leave {file}', { file: a.dataset.unlearn! }))))
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const d = this.draft
    if (!d) return void (el.innerHTML = `<p class="muted">${t('Say on the left what the new thing is, and draft it.')}</p>`)
    const head = `<h3>“${esc(d.intent)}”</h3>`
    if (d.state === 'drafting') return void (el.innerHTML = `${head}<p>${t('The AI is drafting it and drawing its icon… {s} s', { s: Math.round((Date.now() - d.since) / 1000) })}</p>`)
    if (d.state === 'checking') return void (el.innerHTML = `${head}<p>${t('The engine is checking it: can it be had, is it good for something…')}</p>`)
    if (d.state === 'failed') return void (el.innerHTML = `${head}<p class="warn">${t('No draft.')}</p><ul>${(d.errors ?? []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`)
    const types = (d.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'type' ? [a.type] : []))
    el.innerHTML = `${head}${d.look ? `<p class="muted">${esc(d.look)}</p>` : ''}
      ${types.map((ty) => this.card(ty, d.reports?.find((r) => r.type === ty.id))).join('')}
      ${d.state === 'taken'
        ? `<p>${t('Taken in: {file}.', { file: `<code>${esc(d.file ?? '')}</code>` })}</p>
           <button id="nPlace">${t('Set one down by the start')}</button> <button id="nHoles">${t('Its holes: ask the AI what it does')}</button> <button id="nPlay" class="on">${t('Play it')}</button>`
        : `<button id="nTake" class="on" ${d.reports?.every((r) => r.checks.find((c) => c.id === 'valid')?.ok) ? '' : 'disabled'}>${t('Take it into the game')}</button> <button id="nAgain">${t('Draft again')}</button> <button id="nLeave">${t('Leave it')}</button>`}`
    el.querySelector<HTMLButtonElement>('#nTake')?.addEventListener('click', () => void this.take(ctx))
    el.querySelector<HTMLButtonElement>('#nAgain')?.addEventListener('click', () => void this.ask(ctx))
    el.querySelector<HTMLButtonElement>('#nLeave')?.addEventListener('click', () => ((this.draft = undefined), ctx.refresh()))
    el.querySelector<HTMLButtonElement>('#nPlace')?.addEventListener('click', () => this.place(ctx, types.at(-1)!.id))
    el.querySelector<HTMLButtonElement>('#nHoles')?.addEventListener('click', () => void this.holes().focus(ctx, types.at(-1)!.id))
    el.querySelector<HTMLButtonElement>('#nPlay')?.addEventListener('click', () => void ctx.playtest())
  }

  /** One new type as the author reads it: its icon, names, kind, how it is made, its numbers, and the checks. */
  private card(ty: TypeDef, r?: ThingReport): string {
    const name = ty.name && typeof ty.name === 'object' ? (ty.name as Record<string, string>) : { en: String(ty.name ?? ty.id) }
    const made = ty.makeup?.length ? `${ty.station === 'hands' || !ty.station ? t('by hand') : t('at a {station}', { station: esc(ty.station) })}: ${ty.makeup.map((m) => `${m.count} × <code>${esc(m.type)}</code>`).join(' + ')}` : t('not made by anyone')
    return `<div class="box thing-card">
      <div class="thing-head">${ty.art ? `<img class="px big" src="${artUrl(ty.art)}" alt="">` : `<div class="px big none">${t('no icon')}</div>`}
        <div><h3>${Object.values(name).map(esc).join(' · ')}</h3><p><code>${esc(ty.id)}</code></p>
        <p>${(ty.tags ?? []).map((g) => `<span class="chip">${esc(g)}</span>`).join(' ')}</p>
        <p>${t('Made {how}', { how: made })}</p>
        ${ty.props && Object.keys(ty.props).length ? `<p class="muted">${Object.entries(ty.props).map(([k, v]) => `${esc(k)} ${esc(JSON.stringify(v))}`).join(' · ')}</p>` : ''}</div></div>
      ${r ? `<table class="sched">${r.checks.map((c) => `<tr><td>${c.ok ? '<span class="ok">✓</span>' : '<span class="warn">✗</span>'}</td><td><b>${t(CHECK_NAMES[c.id])}</b></td><td><small>${c.detail.map(esc).join('<br>')}</small></td></tr>`).join('')}</table>` : ''}
    </div>`
  }

  /** What a player of this game can have, as the modder is told it: id, name and own numbers. */
  private had(ctx: Ctx): { had: { id: string; name?: string; props?: Record<string, unknown> }[]; stations: string[] } {
    const c = ctx.store.compiled()
    const have = obtainable(c)
    const onto = ctx.onto()
    const ids = [...have.keys()].filter((id) => !id.startsWith('tile/') && !id.startsWith('actor/'))
    const stations = [...new Set(ids.flatMap((id) => (onto.types[id]?.tags ?? []).filter((g) => g.startsWith('station:')).map((g) => g.slice(8))))]
    return { had: ids.map((id) => ({ id, name: tx(onto.types[id]?.name ?? id), props: onto.types[id]?.props })), stations }
  }

  private async ask(ctx: Ctx): Promise<void> {
    const intent = this.intent.trim()
    if (!intent) return toast(t('Say what the new thing is first.'), 'warn')
    this.draft = { intent, state: 'drafting', since: Date.now() }
    this.tick = setInterval(() => ctx.refresh(), 1000)
    ctx.refresh()
    try {
      const r = await fetch(`${this.modder}/create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent, ...this.had(ctx) }) })
      const reply = (await r.json()) as { patch: Patch | null; diagnostics?: string[]; look?: string; error?: string }
      if (!reply.patch) this.draft = { intent, state: 'failed', since: Date.now(), errors: reply.diagnostics?.length ? reply.diagnostics : [reply.error ?? t('no answer')] }
      else {
        // (a large world's acts take seconds to count: the page says so before it counts)
        this.draft = { intent, state: 'checking', since: Date.now(), patch: reply.patch, look: reply.look }
        ctx.refresh()
        await new Promise((ok) => setTimeout(ok, 30))
        this.draft = { ...this.draft, state: 'drafted', reports: checkThings(ctx.store.compiled(), reply.patch) }
      }
    } catch (e) {
      this.draft = { intent, state: 'failed', since: Date.now(), errors: [t('No modder at {url} ({why}).', { url: this.modder, why: (e as Error).message })] }
    } finally {
      clearInterval(this.tick)
    }
    ctx.refresh()
  }

  /** Into the game: a learned/ file with its types (its words in the game's language), and the modder's library. */
  private async take(ctx: Ctx): Promise<void> {
    const d = this.draft
    const types = (d?.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'type' ? [a.type] : []))
    if (!d || !types.length) return
    const { file, sent } = takeThing(ctx.store, types)
    try {
      const r = (await (await fetch(`${this.modder}/adopt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patch: sent }) })).json()) as { ok?: boolean; errors?: string[] }
      if (!r.ok) toast(t('The modder did not take it: {why}', { why: (r.errors ?? []).join('; ') }), 'warn')
    } catch (e) {
      toast(t('No modder at {url} ({why}).', { url: this.modder, why: (e as Error).message }), 'warn')
    }
    this.draft = { ...d, state: 'taken', file }
    toast(t('Taken in: {file}. Save, and the game ships with it.', { file }))
    ctx.refresh()
  }

  /** One of it on the ground beside where the game begins, to find at once in a playtest. */
  private place(ctx: Ctx, type: string): void {
    const start = ctx.store.game.start
    const file = ctx.store.mapFile(start.map)
    if (!file) return toast(t('The start map is missing.'), 'warn')
    const taken = idsOf(ctx.store.maps().map((m) => m.data), ctx.store.list<PersonFile>('people').map((p) => p.data.id))
    ctx.store.change<RawChunk>(file, t('set down {kind} by the start', { kind: type }), (ch) => void setDown(ch, type, { x: start.x + 1, y: start.y }, taken))
    toast(t('Set down by the start: it lies one step to the right.'))
  }
}
