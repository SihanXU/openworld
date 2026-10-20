// The game's words in the editor (docs/engine-split.md §19): written where they are said, in the game's source
// language alone (game.json `languages`), one field each; their translations are the Localization mode's, in the
// tables (`locales/<code>.json`). A source text changed keeps its translations, to be looked at again. What the
// game would show in another language is the preview language's (a line's preview, a playtest), apart from the
// editor's own language (lang.ts).

import type { Text } from '@openworld/engine'
import { languagesOf, sourceOf, textsOf, translated, wordsIn, type LocaleFile, type Languages } from '@openworld/format'
import { uiLang } from './lang.ts'
import type { Store } from './store.ts'

let store: Store | undefined
let preview: string | undefined

/** The project the editor shows (its languages, its tables). */
export function useProject(s: Store): void {
  store = s
}

export const languages = (): Languages => languagesOf(store?.game ?? {})
export const sourceLang = (): string => languages().source
/** The languages a preview may be in: the source and its translations. */
export const gameLangs = (): string[] => [languages().source, ...languages().translations]
export const previewLang = (): string => (preview && gameLangs().includes(preview) ? preview : languages().source)
export const setPreviewLang = (l: string): void => void (preview = l)

/** Its own name, for the editor's lists of a game's languages. */
export const LANG_NAMES: Record<string, string> = { en: 'English', zh: '中文', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', ru: 'Русский', pt: 'Português', it: 'Italiano' }
export const langName = (code: string): string => LANG_NAMES[code] ?? code

/** A game's text as the editor shows it: as written, in the source language. */
export const tx = (t: Text | undefined): string => sourceOf(t, sourceLang())

/** The tables of the project, by language (kept while the project stands still: a list of a thousand names asks a thousand times). */
export function tables(): Map<string, { file: string; data: LocaleFile }> {
  if (!kept || kept.store !== store || kept.revision !== store?.revision) kept = { store, revision: store?.revision, tables: new Map((store?.list<LocaleFile>('locales') ?? []).map((f) => [f.data.language, f])) }
  return kept.tables
}
let kept: { store?: Store; revision?: number; tables: Map<string, { file: string; data: LocaleFile }> } | undefined

/** A game's text as a language says it (the preview): its table's translation, a place's own where given; else as written. */
export function inLang(t: Text | undefined, lang: string = previewLang(), place?: string): string {
  const src = tx(t)
  if (lang === sourceLang()) return src
  return wordsIn(t, lang, sourceLang()) || translated(tables().get(lang)?.data, src, place) || src
}

/** A game text as the editor shows it in its lists and palettes: in the editor's language when the game has it, else as written. */
export const shown = (t: Text | undefined): string => inLang(t, gameLangs().includes(uiLang()) ? uiLang() : sourceLang())

/**
 * A text's source words written (one field's change): a plain string — or, for an older project's text that keeps
 * its translations inside it, those kept beside the new words. A translation the old words had in a table is kept
 * for the new ones, to be looked at again (the Localization mode's "needs review"). The text to write.
 */
export function written(old: Text | undefined, v: string): Text | undefined {
  const next = v.trim()
  const src = sourceLang()
  const was = tx(old)
  if (store && was && next && was !== next) {
    for (const [, f] of tables()) {
      if (f.data.entries[was] === undefined || f.data.entries[next] !== undefined) continue
      store.change<LocaleFile>(f.file, `${f.data.language}: the translation kept for the new words`, (d) => {
        d.entries[next] = d.entries[was]
        d.review = [...new Set([...(d.review ?? []), next])]
      })
    }
  }
  if (!next) return undefined
  if (old && typeof old === 'object') return { ...old, [src]: next, ...(src === 'en' ? {} : { en: (old as { en: string }).en || next }) } as Text
  return next
}

/**
 * A text made with its words in several languages (a crowd's names, a template's): its source words to write, each
 * translation the game keeps put into that language's table (where the table has none for those words yet).
 */
export function adopt(t: Text | undefined): string | undefined {
  if (t === undefined || typeof t === 'string') return t
  const src = sourceLang()
  const all = t as Record<string, string | undefined>
  const words = all[src] ?? t.en
  if (!store || !words) return words
  for (const l of languages().translations) {
    const said = all[l]
    if (!said) continue
    const f = tables().get(l)
    if (!f) store.add(`locales/${l}.json`, { language: l, entries: { [words]: said } } satisfies LocaleFile, `${l}: a table`)
    else if (f.data.entries[words] === undefined) store.change<LocaleFile>(f.file, `${l}: ${words}`, (d) => void (d.entries[words] = said))
  }
  return words
}

/**
 * Every text of a file's data made with its words in several languages (a quest the editor makes, with the words it
 * knows): each left as its source words, the translations put into the tables (adopt). The data, changed in place.
 */
export function adoptTexts<T>(file: string, data: T): T {
  for (const at of textsOf(file, data)) {
    let o: Record<string | number, unknown> = data as never
    for (const k of at.path.slice(0, -1)) o = o[k] as Record<string | number, unknown>
    const last = at.path[at.path.length - 1]
    if (at.prop) {
      // a thing's written words: `text` the English, `text_<code>` beside it
      const all: Record<string, string> = { en: String(o.text) }
      for (const [k, v] of Object.entries(o)) if (k.startsWith('text_') && typeof v === 'string') (all[k.slice(5)] = v), delete o[k]
      o.text = adopt(all as unknown as Text) ?? ''
    } else if (typeof at.text === 'object') o[last] = adopt(at.text)
  }
  return data
}

/** Edits made together (a text's words and the translations kept for them): one Undo. */
export const together = <T>(fn: () => T): T => (store ? store.batch('', fn) : fn())
