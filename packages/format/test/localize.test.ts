// A language's translation as the Localization mode works on it (src/localize.ts, docs/engine-split.md §19): every
// source text once with its places and state; the tables out to a spreadsheet and gettext and back, the same table.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readProject } from '../src/node.ts'
import { fromCsv, fromPo, likeness, localeRows, parseCsv, suggestions, toCsv, toPo, withImported } from '../src/localize.ts'
import type { LocaleFile } from '../src/texts.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))

describe('a language\'s rows', () => {
  it('every source text once, with its places, its translation and how it stands', () => {
    const p = readProject(STARTER)
    const { rows, unused, stale } = localeRows(p, 'zh')
    const zh = p.locales!.find((f) => f.data.language === 'zh')!.data
    // every entry of the starter's table is a text it says (one, "A new map", is the empty template's)
    expect(unused.map((u) => u.source)).toEqual(Object.keys(zh.entries).filter((s) => !rows.some((r) => r.source === s)))
    expect(stale).toEqual([])
    const sources = rows.map((r) => r.source)
    expect(new Set(sources).size).toBe(sources.length)
    expect(rows.every((r) => r.places.length > 0)).toBe(true)
    const glade = rows.find((r) => r.places.some((x) => x.startsWith('maps/glade.json#map.name')))!
    expect(glade.translation).toBe(zh.entries[glade.source])
    expect(glade.state).toBe('done')
    // a source with no translation is to translate; one marked is to look at again
    const q = structuredClone(p)
    const t = q.locales!.find((f) => f.data.language === 'zh')!.data
    delete t.entries[glade.source]
    t.review = [rows[1].source]
    const again = localeRows(q, 'zh').rows
    expect(again.find((r) => r.source === glade.source)!.state).toBe('missing')
    expect(again.find((r) => r.source === rows[1].source)!.state).toBe('review')
    // a language with no table: everything to translate
    expect(localeRows(p, 'ja').rows.every((r) => r.state === 'missing')).toBe(true)
  })

  it('offers the translation of words like the ones changed', () => {
    expect(likeness('A glade, and a cottage.', 'A glade, and a little cottage.')).toBeGreaterThan(0.8)
    expect(likeness('Fell the tree.', 'The ring is lost.')).toBeLessThan(0.5)
    expect(suggestions('Bring me three logs.', [{ source: 'Bring me two logs.', text: '给我带两根木头。' }, { source: 'Hello.', text: '你好。' }]).map((s) => s.text)).toEqual(['给我带两根木头。'])
  })
})

describe('out to translators and back', () => {
  const p = readProject(STARTER)
  const { rows } = localeRows(p, 'zh')
  const zh = p.locales!.find((f) => f.data.language === 'zh')!.data
  const blank: LocaleFile = { language: 'zh', entries: {} }

  it('a spreadsheet', () => {
    const csv = toCsv([...rows, { source: 'Say "hi",\nthen go.', places: ['story/x.json#steps[0].say'], translation: '说"嗨"，\n然后走。', own: [{ place: 'maps/m.json#map.name', text: '别处' }], state: 'review' }], 'zh')
    expect(parseCsv(csv)[0]).toEqual(['place', 'source', 'zh', 'note'])
    const back = fromCsv(csv, 'zh')
    expect(back.entries['Say "hi",\nthen go.']).toBe('说"嗨"，\n然后走。')
    expect(back.at['maps/m.json#map.name']).toEqual({ source: 'Say "hi",\nthen go.', text: '别处' })
    const table = withImported(blank, back)
    for (const r of rows) expect(table.entries[r.source]).toBe(zh.entries[r.source])
    // a plain two-column sheet (no header) is read as source and translation
    expect(fromCsv('Hello.,你好。\r\nBye.,再见。', 'zh').entries).toEqual({ 'Hello.': '你好。', 'Bye.': '再见。' })
  })

  it('gettext', () => {
    const marked = rows.map((r, i) => (i === 0 ? { ...r, state: 'review' as const } : r))
    const text = toPo([...marked, { source: 'Two\nlines "quoted"', places: ['a#b'], translation: '两行"引号"', own: [{ place: 'c#d', text: '别的' }], state: 'done' }], 'zh', 'en')
    expect(text).toContain('"Language: zh\\n"')
    const back = fromPo(text)
    expect(back.entries['Two\nlines "quoted"']).toBe('两行"引号"')
    expect(back.at['c#d']).toEqual({ source: 'Two\nlines "quoted"', text: '别的' })
    expect(back.review).toEqual([rows[0].source])
    const table = withImported({ ...blank, review: ['gone'] }, back)
    for (const r of rows) expect(table.entries[r.source]).toBe(zh.entries[r.source])
    expect(table.review).toEqual(['gone', rows[0].source])
    // a translator's own catalogue, wrapped lines
    expect(fromPo('msgid ""\nmsgstr ""\n\nmsgid "Hello, "\n"world."\nmsgstr "你好，"\n"世界。"\n').entries).toEqual({ 'Hello, world.': '你好，世界。' })
  })
})
