// A language's translation as the Localization mode works on it (docs/engine-split.md §19): every source text of the
// project once, with the places that say it, its translation in the language's table (and the places that say it
// otherwise), and how it stands — to translate, to look at again, done; the table's entries no text says any more
// (a source changed since: their translations offered for the words like them). And the table as translators take it
// and give it back: CSV (a spreadsheet's) and gettext's PO. Pure.

import { filesOf, languagesOf, placeOf, sourceOf, textsOf, wordsIn, type LocaleFile } from './texts.ts'
import type { Project } from './project.ts'

export type RowState = 'missing' | 'review' | 'done'

/** A source text of the project, as a language's table has it. */
export interface TextRow {
  source: string
  /** Where it is said (`file#path`, as a table's `at` names a place). */
  places: string[]
  /** The table's translation (wherever it is said); '' where it has none. */
  translation: string
  /** The places that say it otherwise, and how. */
  own: { place: string; text: string }[]
  /** Its words in this language kept inside the text itself (an older project's), where the table has none. */
  inline?: string
  state: RowState
}

/** Every source text of the project, as a language's table has it; the table's entries no text says; its places no longer saying their source. */
export function localeRows(p: Project, lang: string): { rows: TextRow[]; unused: { source: string; text: string }[]; stale: string[] } {
  const langs = languagesOf(p.game)
  const table = (p.locales ?? []).find((f) => f.data.language === lang)?.data
  const review = new Set(table?.review ?? [])
  const by = new Map<string, TextRow>()
  const said = new Map<string, string>()
  for (const f of filesOf(p))
    for (const at of textsOf(f.file, f.data)) {
      const src = sourceOf(at.text, langs.source)
      if (!src.trim()) continue
      const place = placeOf(f.file, at.path)
      said.set(place, src)
      let row = by.get(src)
      if (!row) by.set(src, (row = { source: src, places: [], translation: table?.entries[src] ?? '', own: [], state: 'missing' }))
      row.places.push(place)
      const own = table?.at?.[place]
      if (own && own.source === src && own.text) row.own.push({ place, text: own.text })
      // words kept inside the text (a thing's written words: its `text_<code>` prop)
      let inside = ''
      if (at.prop) {
        let o: unknown = f.data
        for (const k of at.path.slice(0, -1)) o = (o as Record<string | number, unknown>)[k]
        inside = String((o as Record<string, unknown>)[`text_${lang}`] ?? '')
      } else inside = wordsIn(at.text, lang, langs.source)
      if (inside && inside !== src && !row.inline) row.inline = inside
    }
  for (const row of by.values()) {
    const all = row.translation || row.own.length === row.places.length || row.inline
    row.state = !all ? 'missing' : review.has(row.source) ? 'review' : 'done'
  }
  const unused = Object.entries(table?.entries ?? {}).filter(([s]) => !by.has(s)).map(([source, text]) => ({ source, text }))
  const stale = Object.entries(table?.at ?? {}).filter(([place, a]) => said.get(place) !== a.source).map(([place]) => place)
  return { rows: [...by.values()], unused, stale }
}

/** The languages an older project keeps inside its texts (`{ en, zh }`, a thing's `text_zh`), and how many texts each. */
export function inlineLanguages(p: Project): Record<string, number> {
  const source = languagesOf(p.game).source
  const out: Record<string, number> = {}
  for (const f of filesOf(p))
    for (const at of textsOf(f.file, f.data)) {
      let langs: string[] = []
      if (at.prop) {
        let o: unknown = f.data
        for (const k of at.path.slice(0, -1)) o = (o as Record<string | number, unknown>)[k]
        langs = Object.keys(o as object).filter((k) => k.startsWith('text_')).map((k) => k.slice(5))
      } else if (typeof at.text === 'object') langs = Object.keys(at.text).filter((k) => k !== source && (at.text as Record<string, unknown>)[k])
      for (const l of langs) if (l !== source) out[l] = (out[l] ?? 0) + 1
    }
  return out
}

/** How alike two texts are (0–1: the share of their letter pairs in common), for the translations of words that changed. */
export function likeness(a: string, b: string): number {
  const pairs = (s: string) => {
    const t = s.toLowerCase().replace(/\s+/g, ' ')
    const m = new Map<string, number>()
    for (let i = 0; i < t.length - 1; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1)
    return m
  }
  const x = pairs(a)
  const y = pairs(b)
  let both = 0
  let n = 0
  for (const [k, v] of x) (both += Math.min(v, y.get(k) ?? 0)), (n += v)
  for (const v of y.values()) n += v
  return n ? (2 * both) / n : a === b ? 1 : 0
}

/** The table's entries no text says any more that are most like a source text (a translation to begin from). */
export function suggestions(source: string, unused: { source: string; text: string }[], n = 2): { source: string; text: string; like: number }[] {
  return unused.map((u) => ({ ...u, like: likeness(source, u.source) })).filter((u) => u.like >= 0.5).sort((a, b) => b.like - a.like).slice(0, n)
}

// ------------------------------------------------------------------ CSV

const cell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** A language's table as a spreadsheet: a row a source (`place` empty), a row for each place that says it otherwise; its state and places as a note. */
export function toCsv(rows: TextRow[], lang: string): string {
  const out = [['place', 'source', lang, 'note'].map(cell).join(',')]
  for (const r of rows) {
    out.push([cell(''), cell(r.source), cell(r.translation || r.inline || ''), cell(`${r.state} · ${r.places.length} · ${r.places.slice(0, 3).join(' ')}`)].join(','))
    for (const o of r.own) out.push([cell(o.place), cell(r.source), cell(o.text), cell('')].join(','))
  }
  return `${out.join('\r\n')}\r\n`
}

/** A spreadsheet's rows (RFC 4180: quoted cells, doubled quotes, line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') (cur += '"'), i++
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') row.push(cur), (cur = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cur), rows.push(row), (row = []), (cur = '')
    } else cur += c
  }
  if (cur || row.length) row.push(cur), rows.push(row)
  return rows.filter((r) => r.some((x) => x !== ''))
}

/** What a translator gave back: a source and its translation, by place where it says so; the source texts marked to look at again. */
export interface Imported {
  entries: Record<string, string>
  at: Record<string, { source: string; text: string }>
  review: string[]
}

/** A spreadsheet back: by its header's names (place, source, the language's code) where it has them, else the first columns source and translation. */
export function fromCsv(text: string, lang: string): Imported {
  const rows = parseCsv(text)
  const head = rows[0]?.map((h) => h.trim().toLowerCase()) ?? []
  const has = head.includes('source')
  const col = (name: string, fallback: number) => (has ? head.indexOf(name) : fallback)
  const [ip, is, it] = [col('place', -1), col('source', 0), has ? (head.indexOf(lang) >= 0 ? head.indexOf(lang) : head.indexOf('translation')) : 1]
  const out: Imported = { entries: {}, at: {}, review: [] }
  for (const r of has ? rows.slice(1) : rows) {
    const source = r[is] ?? ''
    const words = it >= 0 ? (r[it] ?? '') : ''
    if (!source || !words) continue
    const place = ip >= 0 ? (r[ip] ?? '').trim() : ''
    if (place) out.at[place] = { source, text: words }
    else out.entries[source] = words
  }
  return out
}

// ------------------------------------------------------------------ gettext's PO

const po = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`

/** A language's table as gettext's catalogue: an entry a source (its places as references), a place that says it otherwise by its context; to look at again: fuzzy. */
export function toPo(rows: TextRow[], lang: string, source: string): string {
  const out = [`msgid ""`, `msgstr ""`, po(`Language: ${lang}\n`), po('MIME-Version: 1.0\n'), po('Content-Type: text/plain; charset=UTF-8\n'), po('Content-Transfer-Encoding: 8bit\n'), po(`X-Source-Language: ${source}\n`), '']
  for (const r of rows) {
    for (const p of r.places.slice(0, 8)) out.push(`#: ${p}`)
    if (r.state === 'review') out.push('#, fuzzy')
    out.push(`msgid ${po(r.source)}`, `msgstr ${po(r.translation || r.inline || '')}`, '')
    for (const o of r.own) out.push(`msgctxt ${po(o.place)}`, `msgid ${po(r.source)}`, `msgstr ${po(o.text)}`, '')
  }
  return out.join('\n')
}

const unpo = (s: string) => s.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))

/** A gettext catalogue back: each entry's source and translation (by its context's place, where it has one); a fuzzy one to look at again. */
export function fromPo(text: string): Imported {
  const out: Imported = { entries: {}, at: {}, review: [] }
  let e: { ctxt?: string; id?: string; str?: string; fuzzy?: boolean; key?: 'ctxt' | 'id' | 'str' } = {}
  const done = () => {
    if (e.id && e.str) {
      if (e.ctxt) out.at[e.ctxt] = { source: e.id, text: e.str }
      else out.entries[e.id] = e.str
      if (e.fuzzy) out.review.push(e.id)
    }
    e = {}
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) { done(); continue }
    if (line.startsWith('#,')) { if (e.id !== undefined) done(); e.fuzzy = line.includes('fuzzy'); continue }
    if (line.startsWith('#')) continue
    const m = line.match(/^(msgctxt|msgid|msgstr)\s+"(.*)"$/)
    if (m) {
      const key = m[1] === 'msgctxt' ? 'ctxt' : m[1] === 'msgid' ? 'id' : 'str'
      if ((key === 'ctxt' || key === 'id') && e.str !== undefined) { const f = e.fuzzy; done(); e.fuzzy = f }
      e[key] = unpo(m[2])
      e.key = key
      continue
    }
    const more = line.match(/^"(.*)"$/)
    if (more && e.key) e[e.key] = (e[e.key] ?? '') + unpo(more[1])
  }
  done()
  return out
}

/** A table with what a translator gave back put in: their words over the table's; what they marked to look at again marked so (the rest they gave, no longer). */
export function withImported(t: LocaleFile, got: Imported): LocaleFile {
  const next: LocaleFile = { ...t, entries: { ...t.entries, ...got.entries }, ...(Object.keys({ ...t.at, ...got.at }).length && { at: { ...t.at, ...got.at } }) }
  const given = new Set([...Object.keys(got.entries), ...Object.values(got.at).map((a) => a.source)])
  const review = [...new Set([...(t.review ?? []).filter((s) => !given.has(s)), ...got.review])]
  if (review.length) next.review = review
  else delete next.review
  return next
}
