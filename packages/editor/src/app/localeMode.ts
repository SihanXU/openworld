// The Localization mode (docs/engine-split.md §19; Unreal's Localization Dashboard and translation editor, Unity's
// string tables, RPG Maker's language packs): the game's languages — the one its words are written in, the ones
// they are translated into —, and a language's table as rows, a source text each: where it is said, its
// translation, how it stands (to translate, to look at again, done), the places that say it otherwise, and the
// translation of words like it that the table no longer uses. Its tables go out to translators as CSV or gettext's
// PO and come back; an older project's translations kept inside its texts move into the tables.

import { extractLocales, inlineLanguages, localeRows, suggestions, switchSource, toCsv, toPo, fromCsv, fromPo, withImported, type Compiled, type GameJson, type LocaleFile, type TextRow } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import { phrase } from './lang.ts'
import { atOf, modeOf, pathOf } from './usage.ts'
import { modal } from './dialogs.ts'
import { $, esc, t, toast } from './ui.ts'
import { LANG_NAMES, langName, languages, tables } from './words.ts'

type Show = 'all' | 'missing' | 'review' | 'done' | 'own'
const SHOWN: [Show, string][] = [['all', phrase('every text')], ['missing', phrase('to translate')], ['review', phrase('to look at again')], ['done', phrase('done')], ['own', phrase('said otherwise somewhere')]]
const PAGE = 100

export class LocaleMode implements Mode {
  id = 'locales'
  label = phrase('Localization')
  private lang = ''
  private show: Show = 'all'
  private filter = ''
  private shown = PAGE
  private memo?: { at: Compiled; lang: string; rows: ReturnType<typeof localeRows> }

  /** The language worked on: the one chosen, else the first the game is translated into. */
  private target(): string {
    const l = languages().translations
    if (!l.includes(this.lang)) this.lang = l[0] ?? ''
    return this.lang
  }
  private rows(ctx: Ctx): ReturnType<typeof localeRows> {
    const at = ctx.store.compiled()
    if (this.memo?.at !== at || this.memo.lang !== this.lang) this.memo = { at, lang: this.lang, rows: localeRows(ctx.store.project(), this.lang) }
    return this.memo.rows
  }
  /** The target's table (made, where it has none yet), changed. */
  private table(ctx: Ctx, why: string, fn: (t: LocaleFile) => void): void {
    const l = this.lang
    const f = tables().get(l)
    if (!f) {
      const d: LocaleFile = { language: l, entries: {} }
      fn(d)
      return ctx.store.add(`locales/${l}.json`, d, why)
    }
    ctx.store.change<LocaleFile>(f.file, why, (d) => {
      fn(d)
      if (d.review && !d.review.length) delete d.review
      if (d.at && !Object.keys(d.at).length) delete d.at
    })
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const langs = languages()
    const lang = this.target()
    const counts = (l: string) => {
      const rs = l === lang ? this.rows(ctx).rows : localeRows(ctx.store.project(), l).rows
      return { done: rs.filter((r) => r.state === 'done').length, review: rs.filter((r) => r.state === 'review').length, all: rs.length }
    }
    const others = Object.keys(LANG_NAMES).filter((l) => l !== langs.source && !langs.translations.includes(l))
    left.innerHTML = `<h3>${t('Languages')}</h3>
      <p>${t('Written in {lang}', { lang: `<b>${esc(langName(langs.source))}</b>` })} <a id="lcSwitch" class="x" title="${t('every text then written in another of its languages, this one a translation')}">${t('change…')}</a></p>
      <div class="palette list">${langs.translations.map((l) => { const c = counts(l); return `<div class="tree-row ${l === lang ? 'on' : ''}" data-lang="${esc(l)}">${esc(langName(l))} (${esc(l)})<small>${t('{done} of {all} done', c)}${c.review ? ` · ${t('{n} to look at again', { n: c.review })}` : ''} <a class="x" data-unlang="${esc(l)}" title="${t('no longer translated into it')}">✕</a></small></div>` }).join('') || `<p class="muted">${t('Not translated yet: add a language.')}</p>`}</div>
      <div class="row"><select id="lcAdd"><option value="">${t('+ a language')}</option>${others.map((l) => `<option value="${esc(l)}">${esc(langName(l))} (${esc(l)})</option>`).join('')}<option value="?">${t('another (its code)…')}</option></select></div>
      ${lang ? `<h3>${t('Show')}</h3><select id="lcShow">${SHOWN.map(([k, l]) => `<option value="${k}" ${k === this.show ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}</select>
      <input id="lcFilter" placeholder="${t('words, or where (maps/, people/ …)')}" value="${esc(this.filter)}">` : ''}`
    left.querySelectorAll<HTMLElement>('[data-lang]').forEach((r) => (r.onclick = (e) => { if ((e.target as HTMLElement).dataset.unlang) return; this.lang = r.dataset.lang!; this.shown = PAGE; ctx.refresh() }))
    left.querySelectorAll<HTMLElement>('[data-unlang]').forEach((a) => (a.onclick = () => this.dropLang(ctx, a.dataset.unlang!)))
    $<HTMLSelectElement>('#lcAdd', left).onchange = (e) => {
      let l = (e.target as HTMLSelectElement).value
      if (l === '?') l = prompt(t('The language\'s code (ja, pt-BR …):'))?.trim() ?? ''
      if (l) this.addLang(ctx, l)
    }
    $<HTMLElement>('#lcSwitch', left).onclick = () => this.switchDialog(ctx)
    const show = left.querySelector<HTMLSelectElement>('#lcShow')
    if (show) show.onchange = () => ((this.show = show.value as Show), (this.shown = PAGE), ctx.refresh())
    const f = left.querySelector<HTMLInputElement>('#lcFilter')
    if (f) f.oninput = () => { this.filter = f.value; this.shown = PAGE; ctx.refresh(); const g = document.querySelector<HTMLInputElement>('#lcFilter'); g?.focus(); g?.setSelectionRange(f.value.length, f.value.length) }
    this.tools(ctx, right)
  }

  /** The right: what the mode is, the table out and back, the older project's texts, the entries no text says. */
  private tools(ctx: Ctx, right: HTMLElement): void {
    const lang = this.lang
    const r = lang ? this.rows(ctx) : undefined
    // (an older project's translations kept inside its texts, in any language, declared or not)
    const inside = Object.entries(inlineLanguages(ctx.store.project()))
    right.innerHTML = `<h3>${t('Localization')}</h3><p class="muted">${t('The game\'s words are written once, in its own language, wherever they are said; each language it is translated into has a table: a text and its translation, wherever it is said, and a place that says it otherwise where it must. The game is played in any of them; the editor speaks its own language, whatever the game\'s.')}</p>
      ${inside.length ? `<div class="box">${inside.map(([l, n]) => `<p>${t('{n} texts keep their {lang} words inside them (an older project\'s way).', { n, lang: esc(langName(l)) })}</p>`).join('')}<button id="lcMove">${t('Move them into the tables')}</button></div>` : ''}
      ${lang ? `<h3>${t('The {lang} table', { lang: esc(langName(lang)) })}</h3>
      <p class="muted">${t('Out to a translator, and back: a spreadsheet (CSV) or gettext (PO, what Poedit and Weblate read).')}</p>
      <div class="row"><button id="lcCsv">${t('Export CSV')}</button><button id="lcPo">${t('Export PO')}</button></div>
      <div class="row"><button id="lcImport">${t('Import CSV or PO…')}</button><input type="file" id="lcFile" accept=".csv,.po,.txt" hidden></div>
      ${r!.unused.length || r!.stale.length ? `<div class="box"><p>${t('{n} translations no text says any more (its words changed or went); they are offered for words like theirs.', { n: r!.unused.length + r!.stale.length })}</p><button id="lcClean">${t('Remove them')}</button></div>` : ''}` : ''}`
    right.querySelector<HTMLButtonElement>('#lcCsv')?.addEventListener('click', () => download(`${ctx.store.id}-${lang}.csv`, toCsv(this.rows(ctx).rows, lang), 'text/csv'))
    right.querySelector<HTMLButtonElement>('#lcPo')?.addEventListener('click', () => download(`${ctx.store.id}-${lang}.po`, toPo(this.rows(ctx).rows, lang, languages().source), 'text/x-gettext-translation'))
    const file = right.querySelector<HTMLInputElement>('#lcFile')
    right.querySelector<HTMLButtonElement>('#lcImport')?.addEventListener('click', () => file?.click())
    if (file) file.onchange = async () => {
      const f = file.files?.[0]
      if (!f) return
      const text = await f.text()
      const got = /\.po$/i.test(f.name) || /^\s*(#|msgid)/m.test(text.slice(0, 400)) ? fromPo(text) : fromCsv(text, lang)
      const n = Object.keys(got.entries).length + Object.keys(got.at).length
      if (!n) return toast(t('Nothing in {file} to take.', { file: f.name }), 'warn')
      this.table(ctx, t('{lang}: {n} translations from {file}', { lang, n, file: f.name }), (d) => {
        const next = withImported(d, got)
        d.entries = next.entries
        d.at = next.at
        d.review = next.review
      })
      toast(t('{n} translations taken from {file}.', { n, file: f.name }))
    }
    right.querySelector<HTMLButtonElement>('#lcMove')?.addEventListener('click', () => this.moveInline(ctx))
    right.querySelector<HTMLButtonElement>('#lcClean')?.addEventListener('click', () => {
      const { unused, stale } = this.rows(ctx)
      if (!confirm(t('Remove {n} translations no text says any more?', { n: unused.length + stale.length }))) return
      this.table(ctx, t('{lang}: the unused translations removed', { lang }), (d) => {
        for (const u of unused) delete d.entries[u.source]
        for (const p of stale) delete d.at?.[p]
        d.review = d.review?.filter((s) => !unused.some((u) => u.source === s))
      })
    })
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const lang = this.target()
    if (!lang) return void (el.innerHTML = `<p class="muted">${t('The game is written in {lang} and translated into nothing yet: add a language on the left, and its table is made.', { lang: esc(langName(languages().source)) })}</p>`)
    const { rows, unused } = this.rows(ctx)
    const q = this.filter.trim().toLowerCase()
    const shown = rows.filter((r) => (this.show === 'all' || (this.show === 'own' ? r.own.length > 0 : r.state === this.show)) && (!q || r.source.toLowerCase().includes(q) || r.translation.toLowerCase().includes(q) || r.places.some((p) => p.startsWith(q))))
    const done = rows.filter((r) => r.state === 'done').length
    el.innerHTML = `<div class="row"><h3 class="grow">${t('{source} → {lang}', { source: esc(langName(languages().source)), lang: esc(langName(lang)) })} <small class="muted">${t('{done} of {all} done', { done, all: rows.length })}</small></h3><span class="muted">${t('{n} shown', { n: shown.length })}</span></div>
      <div class="lc-bar"><div style="width:${rows.length ? Math.round((done / rows.length) * 100) : 0}%"></div></div>
      <div class="lc-rows">${shown.slice(0, this.shown).map((r) => this.row(r, rows.indexOf(r), unused)).join('') || `<p class="muted">${t('No text here.')}</p>`}</div>
      ${shown.length > this.shown ? `<button id="lcMore">${t('{n} more…', { n: shown.length - this.shown })}</button>` : ''}`
    const rowOf = (el: HTMLElement) => rows[Number(el.closest<HTMLElement>('[data-row]')!.dataset.row)]
    el.querySelectorAll<HTMLTextAreaElement>('textarea[data-tr]').forEach((ta) => (ta.onchange = () => {
      const r = rowOf(ta)
      const v = ta.value.trim()
      this.table(ctx, t('{lang}: {words}', { lang, words: clip(r.source) }), (d) => {
        if (v) d.entries[r.source] = v
        else delete d.entries[r.source]
        d.review = d.review?.filter((s) => s !== r.source)
      })
    }))
    el.querySelectorAll<HTMLInputElement>('input[data-own]').forEach((inp) => (inp.onchange = () => {
      const r = rowOf(inp)
      const place = inp.dataset.own!
      const v = inp.value.trim()
      this.table(ctx, t('{lang}: {words} at one place', { lang, words: clip(r.source) }), (d) => {
        if (v) (d.at ??= {})[place] = { source: r.source, text: v }
        else delete d.at?.[place]
      })
    }))
    el.querySelectorAll<HTMLElement>('[data-ok]').forEach((b) => (b.onclick = () => { const r = rowOf(b); this.table(ctx, t('{lang}: {words} looked at', { lang, words: clip(r.source) }), (d) => (d.review = d.review?.filter((s) => s !== r.source))) }))
    el.querySelectorAll<HTMLElement>('[data-use]').forEach((b) => (b.onclick = () => { const r = rowOf(b); const w = b.dataset.use!; this.table(ctx, t('{lang}: {words}', { lang, words: clip(r.source) }), (d) => { d.entries[r.source] = w; d.review = [...new Set([...(d.review ?? []), r.source])] }) }))
    el.querySelectorAll<HTMLElement>('[data-place]').forEach((a) => (a.onclick = () => this.openPlace(ctx, a.dataset.place!)))
    el.querySelector<HTMLButtonElement>('#lcMore')?.addEventListener('click', () => ((this.shown += PAGE), ctx.refresh()))
  }

  /** A source text's row: its words and places, its translation, its state, its suggestions, the places that say it otherwise. */
  private row(r: TextRow, i: number, unused: { source: string; text: string }[]): string {
    const state = { missing: t('to translate'), review: t('to look at again'), done: t('done') }[r.state]
    const sug = r.state === 'missing' ? suggestions(r.source, unused) : []
    const places = r.places.slice(0, 4).map((p) => `<a data-place="${esc(p)}" title="${esc(p)}">${esc(p.split('#')[0])}</a>`).join(' · ') + (r.places.length > 4 ? ` · ${t('{n} more', { n: r.places.length - 4 })}` : '')
    return `<div class="lc-row ${r.state}" data-row="${i}">
      <div class="lc-src"><div>${esc(r.source)}</div><small class="muted">${places}</small></div>
      <div class="lc-tr"><textarea data-tr rows="${Math.min(4, Math.max(1, Math.ceil(r.source.length / 60)))}" placeholder="${esc(r.inline ?? '')}">${esc(r.translation)}</textarea>
        ${r.inline && !r.translation ? `<small class="muted">${t('kept inside the text: {words}', { words: esc(r.inline) })}</small>` : ''}
        ${sug.map((s) => `<small class="lc-sug">${t('for "{source}":', { source: esc(s.source) })} <a data-use="${esc(s.text)}">${esc(s.text)}</a></small>`).join('')}
        ${r.places.length > 1 || r.own.length ? `<details ${r.own.length ? 'open' : ''}><summary>${t('said otherwise at a place ({n})', { n: r.own.length })}</summary>${r.places.map((p) => `<label class="lc-own"><small>${esc(p)}</small><input data-own="${esc(p)}" value="${esc(r.own.find((o) => o.place === p)?.text ?? '')}" placeholder="${esc(r.translation)}"></label>`).join('')}</details>` : ''}</div>
      <div class="lc-state"><span class="chip ${r.state}">${esc(state)}</span>${r.state === 'review' ? `<button data-ok>${t('It is right')}</button>` : ''}</div></div>`
  }

  /** A place (file#path) opened where it is edited. */
  private openPlace(ctx: Ctx, place: string): void {
    const [file, path] = place.split('#')
    const data = file === 'game.json' ? ctx.store.game : ctx.store.get(file)
    ctx.open(modeOf(file), file, data === undefined ? undefined : atOf(file, data, pathOf(path ?? '')))
  }

  private addLang(ctx: Ctx, l: string): void {
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(l)) return toast(t('A language\'s code: two or three letters, a region after a dash (pt-BR).'), 'warn')
    if (l === languages().source || languages().translations.includes(l)) return
    ctx.store.batch(t('translated into {lang}', { lang: langName(l) }), () => {
      ctx.store.change<GameJson>('game.json', t('translated into {lang}', { lang: langName(l) }), (g) => (g.languages = { source: languages().source, translations: [...languages().translations, l] }))
      if (!tables().has(l)) ctx.store.add(`locales/${l}.json`, { language: l, entries: {} } satisfies LocaleFile, t('the {lang} table', { lang: langName(l) }))
    })
    this.lang = l
  }

  private dropLang(ctx: Ctx, l: string): void {
    if (!confirm(t('No longer translate the game into {lang}? Its table goes too (Undo brings it back).', { lang: langName(l) }))) return
    ctx.store.batch(t('no longer translated into {lang}', { lang: langName(l) }), () => {
      ctx.store.change<GameJson>('game.json', t('no longer translated into {lang}', { lang: langName(l) }), (g) => (g.languages = { source: languages().source, translations: languages().translations.filter((x) => x !== l) }))
      const f = tables().get(l)
      if (f) ctx.store.remove(f.file, t('the {lang} table', { lang: langName(l) }))
    })
  }

  /** Write the game in another language: every text's words in it become its words, its former words a translation. */
  private switchDialog(ctx: Ctx): void {
    const langs = languages()
    const m = modal(t('Write the game in another language'), `<p class="muted">${t('Every text\'s words in the language chosen become its words (where its table has them), and its words now go into the table of the language it was written in. A text with no words in it stays as it is, to translate.')}</p>
      <label>${t('written in')} <select id="lcTo">${[...langs.translations, ...Object.keys(LANG_NAMES).filter((l) => l !== langs.source && !langs.translations.includes(l))].map((l) => `<option value="${esc(l)}">${esc(langName(l))}</option>`).join('')}</select></label>
      <div class="row end"><button id="lcGo" class="on">${t('Change it')}</button></div>`)
    $<HTMLButtonElement>('#lcGo', m.el).onclick = () => {
      const to = $<HTMLSelectElement>('#lcTo', m.el).value
      m.close()
      const p = structuredClone(ctx.store.project())
      const { changed } = switchSource(p, to)
      const files = new Map([['game.json', p.game] as [string, unknown], ...[...p.ontology, ...p.rules, ...p.maps, ...p.people, ...p.quests, ...p.story, ...(p.learned ?? []), ...(p.client ?? [])].map((f): [string, unknown] => [f.file, f.data])])
      ctx.store.batch(t('written in {lang}', { lang: langName(to) }), () => {
        for (const f of changed) ctx.store.set(f, files.get(f), t('written in {lang}', { lang: langName(to) }))
        const now = new Set((p.locales ?? []).map((f) => f.file))
        for (const f of p.locales ?? []) ctx.store.set(f.file, f.data, t('written in {lang}', { lang: langName(to) }))
        for (const f of ctx.store.list('locales')) if (!now.has(f.file)) ctx.store.remove(f.file, t('written in {lang}', { lang: langName(to) }))
      })
      this.lang = langs.source
      toast(t('The game is written in {lang} now: {n} files changed.', { lang: langName(to), n: changed.length }))
    }
  }

  /** An older project's translations kept inside its texts, moved into the tables. */
  private moveInline(ctx: Ctx): void {
    const p = structuredClone(ctx.store.project())
    const { changed, tables: made, skipped } = extractLocales(p)
    const files = new Map([['game.json', p.game] as [string, unknown], ...[...p.ontology, ...p.rules, ...p.maps, ...p.people, ...p.quests, ...p.story, ...(p.learned ?? []), ...(p.client ?? [])].map((f): [string, unknown] => [f.file, f.data])])
    const langs = languages()
    ctx.store.batch(t('the translations moved into the tables'), () => {
      for (const f of changed) ctx.store.set(f, files.get(f), t('the translations moved into the tables'))
      for (const tb of made) if (tb.language !== langs.source) ctx.store.set(tables().get(tb.language)?.file ?? `locales/${tb.language}.json`, tb, t('the translations moved into the tables'))
      const missing = made.map((x) => x.language).filter((l) => l !== langs.source && !langs.translations.includes(l))
      if (missing.length) ctx.store.change<GameJson>('game.json', t('the translations moved into the tables'), (g) => (g.languages = { source: langs.source, translations: [...langs.translations, ...missing] }))
    })
    this.lang ||= made.find((x) => x.language !== langs.source)?.language ?? ''
    toast(t('{n} files now say their words once; the translations are in the tables.', { n: changed.length }) + (skipped.length ? ` ${t('{n} texts have no words in the language the game is written in: left as they are.', { n: skipped.length })}` : ''))
  }

  focus(_ctx: Ctx, file: string): void {
    const l = file.match(/^locales\/(.+)\.json$/)?.[1]
    if (l) this.lang = l
  }
}

const clip = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s)

/** A file given to the author to save. */
function download(name: string, text: string, type: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000)
}
