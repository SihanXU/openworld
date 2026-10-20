// A game's words and their translations (docs/engine-split.md §19; the way Unreal keeps a native culture and its
// translations apart, Unity its string tables, gettext its catalogues). A project's words are written in one
// language, its source (game.json `languages.source`); each language it is translated into has a table of its own,
// `locales/<code>.json`: a source text and its translation (`entries`, one translation wherever the text is said),
// and, for the few places one text must be said otherwise, a translation by place (`at`: a file and the path in it,
// with the source it was made for). Where a file holds words is read from the format's JSON Schemas — a field of
// the engine's type `Text` — never guessed from the words; and a thing's written words (`props.text`, which the
// engine reads beside `text_<code>`) are words too. The compiler hands the engine and the runtime every text in all
// its languages, as they read it (`{ en, zh }`); the files keep the source alone.

import type { Text } from '@openworld/engine'
import game from '../schema/game.schema.json'
import learned from '../schema/learned.schema.json'
import map from '../schema/map.schema.json'
import ontology from '../schema/ontology.schema.json'
import person from '../schema/person.schema.json'
import quest from '../schema/quest.schema.json'
import rules from '../schema/rules.schema.json'
import story from '../schema/story.schema.json'
import type { GameJson, Project, Sourced } from './project.ts'

/** A translation table: one language's (docs/engine-split.md §19). */
export interface LocaleFile {
  /** Its language's code ('zh', 'en', 'ja'). */
  language: string
  /** A source text, and how this language says it (wherever the text is said). */
  entries: Record<string, string>
  /** The source texts whose translation is to be looked at again (made for an earlier source, or guessed). */
  review?: string[]
  /** One place that says a source text otherwise: `file#path`, the source it was made for, and its words. */
  at?: Record<string, { source: string; text: string }>
}

export interface Languages {
  /** The language the game's words are written in. */
  source: string
  /** The languages they are translated into (a table each). */
  translations: string[]
}

export const languagesOf = (g: Pick<GameJson, 'languages'>): Languages => ({ source: g.languages?.source ?? 'en', translations: (g.languages?.translations ?? []).filter((l) => l !== (g.languages?.source ?? 'en')) })

// ------------------------------------------------------------------ where a file holds words

type Path = (string | number)[]
interface Schema {
  $ref?: string
  anyOf?: Schema[]
  oneOf?: Schema[]
  type?: string | string[]
  properties?: Record<string, Schema>
  required?: string[]
  additionalProperties?: boolean | Schema
  items?: Schema | Schema[]
  const?: unknown
  enum?: unknown[]
  definitions?: Record<string, Schema>
}

const SCHEMAS: [RegExp, Schema][] = [
  [/^game\.json$/, game as unknown as Schema],
  [/^ontology\//, ontology as unknown as Schema],
  [/^rules\//, rules as unknown as Schema],
  [/^maps\//, map as unknown as Schema],
  [/^people\//, person as unknown as Schema],
  [/^quests\//, quest as unknown as Schema],
  [/^story\//, story as unknown as Schema],
  [/^learned\//, learned as unknown as Schema],
  // the player's tables have no schema (free tables the runtime's panels read); its words are the cover's and the
  // interface's own (ClientGame.texts), the ones the editor writes
  [/^client\//, { properties: { cover: { properties: { title: { $ref: '#/definitions/Text' }, kicker: { $ref: '#/definitions/Text' }, subtitle: { $ref: '#/definitions/Text' }, credit: { $ref: '#/definitions/Text' } } }, texts: { additionalProperties: { $ref: '#/definitions/Text' } } } }],
]
const TEXT = '#/definitions/Text'

/** A path into a file, as the tables write it (`steps[1].script[0].text`). */
export const pathText = (p: Path): string => p.map((k) => (typeof k === 'number' ? `[${k}]` : `.${k}`)).join('').replace(/^\./, '')
/** A place of the project, as a table's `at` names it. */
export const placeOf = (file: string, p: Path): string => `${file}#${pathText(p)}`

function deref(root: Schema, s: Schema): Schema {
  let n = s
  for (let i = 0; n.$ref && n.$ref !== TEXT && i < 20; i++) n = root.definitions?.[n.$ref.slice('#/definitions/'.length)] ?? {}
  return n
}
const isText = (v: unknown): v is Text => typeof v === 'string' || (!!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as { en?: unknown }).en === 'string')
const typeOk = (t: string | string[] | undefined, v: unknown) => {
  if (!t) return true
  const ts = Array.isArray(t) ? t : [t]
  const k = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v
  return ts.includes(k) || (k === 'integer' && ts.includes('number'))
}

/** Could a value be of this schema (its shape at the top: its type, its required keys, the keys that tell union branches apart)? */
function fits(root: Schema, s0: Schema, v: unknown, depth = 0, deep = 2): boolean {
  if (s0.$ref === TEXT) return isText(v)
  const s = deref(root, s0)
  if (s.$ref === TEXT) return isText(v)
  if (s.anyOf || s.oneOf) return (s.anyOf ?? s.oneOf)!.some((b) => fits(root, b, v, depth, deep))
  if (s.const !== undefined) return v === s.const
  if (s.enum) return s.enum.includes(v)
  if (!typeOk(s.type, v)) return false
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    if (s.required?.some((k) => !(k in o))) return false
    if (s.additionalProperties === false && s.properties && Object.keys(o).some((k) => !(k in s.properties!))) return false
    // the keys that name a branch (an effect's op, a command's kind): their values must fit
    if (depth < deep) for (const [k, p] of Object.entries(s.properties ?? {})) if (k in o && !fits(root, p, o[k], depth + 1, deep)) return false
  }
  return true
}

/** Every text in a value of a schema: its path, and the text. */
function walk(root: Schema, s0: Schema, v: unknown, path: Path, out: { path: Path; text: Text }[]): void {
  if (v === undefined || v === null) return
  if (s0.$ref === TEXT || deref(root, s0).$ref === TEXT) return void (isText(v) && out.push({ path, text: v }))
  const s = deref(root, s0)
  const union = s.anyOf ?? s.oneOf
  if (union) {
    // the branch the value is (its keys' values telling them apart), else the one its shape alone fits
    const b = union.find((x) => fits(root, x, v)) ?? union.find((x) => fits(root, x, v, 0, 1)) ?? union.find((x) => fits(root, x, v, 0, 0))
    if (b) walk(root, b, v, path, out)
    return
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      const item = Array.isArray(s.items) ? s.items[i] : s.items
      if (item) walk(root, item, x, [...path, i], out)
    })
    return
  }
  if (typeof v !== 'object') return
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const p = s.properties?.[k] ?? (typeof s.additionalProperties === 'object' ? s.additionalProperties : undefined)
    if (p) walk(root, p, x, [...path, k], out)
    // a thing's written words (a sign, a letter): the engine reads `text` and, beside it, `text_<code>`
    if (k === 'props' && x && typeof x === 'object' && typeof (x as Record<string, unknown>).text === 'string') out.push({ path: [...path, 'props', 'text'], text: (x as Record<string, string>).text })
  }
}

/** A text found in a file: where (its path), what it is, and whether it is a thing's written words (`props.text`). */
export interface TextAt {
  path: Path
  text: Text
  /** A thing's written words: the other languages are its `text_<code>` props, not an object. */
  prop?: boolean
}

/** Every text a project file holds (none for a file of no schema: the catalogue, the client's other tables). */
export function textsOf(file: string, data: unknown): TextAt[] {
  const root = SCHEMAS.find(([re]) => re.test(file))?.[1]
  if (!root) return []
  const out: { path: Path; text: Text }[] = []
  walk(root, root, data, [], out)
  return out.map((t) => (t.path.length >= 2 && t.path[t.path.length - 1] === 'text' && t.path[t.path.length - 2] === 'props' ? { ...t, prop: true } : t))
}

/** Every file of a project the compiler reads, with its path. */
export function filesOf(p: Project): Sourced<unknown>[] {
  return [{ file: 'game.json', data: p.game }, ...p.ontology, ...p.rules, ...p.maps, ...p.people, ...p.quests, ...p.story, ...(p.learned ?? []), ...(p.client ?? [])]
}

// ------------------------------------------------------------------ a text's words

/** A text's words in a language ('' where it has none): a plain string is the source language's. */
export function wordsIn(t: Text | undefined, lang: string, source: string): string {
  if (t === undefined) return ''
  if (typeof t === 'string') return lang === source ? t : ''
  return ((t as Record<string, string | undefined>)[lang] ?? '').trim() ? (t as Record<string, string>)[lang] : ''
}

/** A text's source words (a plain string, or the source language's words of an object; else its English). */
export const sourceOf = (t: Text | undefined, source: string): string => (t === undefined ? '' : typeof t === 'string' ? t : wordsIn(t, source, source) || t.en)

/** How a table says a text at a place: its own translation there, else the table's for its source; none: ''. */
export function translated(table: LocaleFile | undefined, source: string, place?: string): string {
  if (!table || !source) return ''
  const own = place ? table.at?.[place] : undefined
  if (own && own.source === source && own.text) return own.text
  return table.entries[source] ?? ''
}

/** A value at a path. */
function getAt(o: unknown, p: Path): unknown {
  let v = o
  for (const k of p) v = v && typeof v === 'object' ? (v as Record<string | number, unknown>)[k] : undefined
  return v
}
function setAt(o: unknown, p: Path, value: unknown): void {
  let v = o as Record<string | number, unknown>
  for (const k of p.slice(0, -1)) v = v[k] as Record<string | number, unknown>
  v[p[p.length - 1]] = value
}

/**
 * The project with every text in all its languages, as the engine and the runtime read it (the compiler's step):
 * a source text with translations becomes `{ en, zh, … }` — `en` the English, else the source's words, as every
 * reader's fallback —; a thing's written words get their `text_<code>` props. Words a file already holds in
 * another language (an older project's) are kept where no table says otherwise. A new project; the given is untouched.
 */
export function applyLocales(p: Project, keep?: Keep): Project {
  const langs = languagesOf(p.game)
  const tables = new Map((p.locales ?? []).map((f) => [f.data.language, f.data]))
  if (!langs.translations.some((l) => tables.has(l))) return p
  // (a file as the tables were applied to it last time, where the file, game.json and the tables are as they were)
  const kept = keep && tablesSame(p, keep) ? keep.cache.files : undefined
  const files = new Map<string, Localized>()
  const localize = <T>(file: string, data: T): T => {
    const had = kept?.get(file)
    if (had && had.data !== undefined && keep!.same(file)) return void files.set(file, had), had.data as T
    const out = structuredClone(data)
    const sources: [string, string][] = []
    put(file, out, sources)
    files.set(file, { data: out, sources })
    return out
  }
  const put = (file: string, data: unknown, sources: [string, string][]) => {
    for (const at of textsOf(file, data)) {
      const src = sourceOf(at.text, langs.source)
      const place = placeOf(file, at.path)
      sources.push([place, src])
      if (!src) continue
      if (at.prop) {
        // the engine reads `text` as the English (every reader's fallback) and `text_<code>` beside it
        const props = getAt(data, at.path.slice(0, -1)) as Record<string, unknown>
        const words: Record<string, string> = { [langs.source]: src }
        for (const l of langs.translations) {
          const w = translated(tables.get(l), src, place)
          if (w) words[l] = w
        }
        props.text = words.en || src
        for (const [l, w] of Object.entries(words)) if (l !== 'en') props[`text_${l}`] = w
        continue
      }
      const words: Record<string, string> = {}
      for (const l of new Set([langs.source, ...langs.translations, 'en', 'zh'])) {
        const w = (l === langs.source ? src : translated(tables.get(l), src, place)) || wordsIn(at.text, l, langs.source)
        if (w) words[l] = w
      }
      words.en ||= src
      const keys = Object.keys(words)
      setAt(data, at.path, keys.length === 1 ? words.en : words)
    }
  }
  const each = <T>(fs: Sourced<T>[] | undefined) => fs?.map((f) => ({ ...f, data: localize(f.file, f.data) }))
  const out: Project = { ...p, game: localize('game.json', p.game), ontology: each(p.ontology)!, rules: each(p.rules)!, maps: each(p.maps)!, people: each(p.people)!, quests: each(p.quests)!, story: each(p.story)! }
  if (p.learned) out.learned = each(p.learned)
  if (p.client) out.client = each(p.client)
  // (the tables and the files of no words — the catalogue, the extras — as given: nothing of them is written to)
  if (keep) (keep.cache.files = files), (keep.cache.tables = (p.locales ?? []).map((f) => f.file))
  return out
}

/** A file as the tables were applied to it, and its texts' places and source words (`data` none: the places alone). */
interface Localized {
  data?: unknown
  sources: [string, string][]
}

/**
 * What applying the tables keeps from one time to the next (the editor's: a stroke changes one map of a thousand):
 * each file as the tables were applied to it. Valid for a file while the file, game.json and the tables are as they
 * were — `same(file)` says so of a file; the tables and game.json it checks itself.
 */
export interface LocaleCache {
  files: Map<string, Localized>
  /** The table files it was filled with. */
  tables?: string[]
}
/** A cache to read and fill, and which files are as they were when it was filled. */
export interface Keep<C = LocaleCache> {
  cache: C
  same: (file: string) => boolean
}
/** The languages (game.json) and the tables, each and as a set, as they were. */
function tablesSame(p: Project, keep: Keep): boolean {
  return keep.same('game.json') && filesSame((p.locales ?? []).map((f) => f.file), keep.cache.tables, keep.same)
}
/** The same files, each as it was: no file added or removed, none changed. */
export const filesSame = (now: string[], then: string[] | undefined, same: (file: string) => boolean = () => true): boolean => !!then && now.length === then.length && now.every((f, i) => f === then[i] && same(f))

/**
 * Translations kept inside the texts (`{ en, zh }`, a thing's `text_zh`: an older project's) moved into the tables:
 * each text left as its source words, each other language's words written in that language's table — by source
 * text, or by place where one source is said two ways. The files changed (in place) and the tables made or added to.
 */
export function extractLocales(p: Project, tables: LocaleFile[] = (p.locales ?? []).map((f) => structuredClone(f.data))): { changed: string[]; tables: LocaleFile[]; skipped: { file: string; path: string }[] } {
  const langs = languagesOf(p.game)
  const changed = new Set<string>()
  const skipped: { file: string; path: string }[] = []
  const table = (l: string) => {
    let t = tables.find((x) => x.language === l)
    if (!t) tables.push((t = { language: l, entries: {} }))
    return t
  }
  // first the words each source is most often said with, so that a place says otherwise only where it must
  const seen = new Map<string, Map<string, number>>()
  const each = (fn: (file: string, data: unknown, at: TextAt, src: string, words: Record<string, string>) => void) => {
    for (const f of filesOf(p)) {
      for (const at of textsOf(f.file, f.data)) {
        let src = sourceOf(at.text, langs.source)
        const words: Record<string, string> = {}
        if (at.prop) {
          // a thing's written words: `text` the English, `text_<code>` each other language's
          const props = getAt(f.data, at.path.slice(0, -1)) as Record<string, unknown>
          const all: Record<string, string> = { en: String(props.text) }
          for (const [k, v] of Object.entries(props)) if (k.startsWith('text_') && typeof v === 'string' && v.trim()) all[k.slice(5)] = v
          src = all[langs.source] || src
          for (const [k, v] of Object.entries(all)) if (k !== langs.source && v !== src) words[k] = v
          if (!Object.keys(words).length && src === props.text && Object.keys(all).length === 1) continue
        } else if (typeof at.text === 'object') for (const [k, v] of Object.entries(at.text)) if (k !== langs.source && typeof v === 'string' && v.trim() && v !== src) words[k] = v
        if (!Object.keys(words).length && typeof at.text === 'string') continue
        if (!src || (typeof at.text === 'object' && !wordsIn(at.text, langs.source, langs.source) && langs.source !== 'en')) {
          skipped.push({ file: f.file, path: pathText(at.path) })
          continue
        }
        fn(f.file, f.data, at, src, words)
      }
    }
  }
  each((_file, _data, _at, src, words) => {
    for (const [l, w] of Object.entries(words)) {
      const k = `${l}\u0000${src}`
      const m = seen.get(k) ?? new Map<string, number>()
      m.set(w, (m.get(w) ?? 0) + 1)
      seen.set(k, m)
    }
  })
  for (const [k, m] of seen) {
    const [l, src] = k.split('\u0000')
    const t = table(l)
    if (t.entries[src] === undefined) t.entries[src] = [...m].sort((a, b) => b[1] - a[1])[0][0]
  }
  each((file, data, at, src, words) => {
    for (const [l, w] of Object.entries(words)) {
      const t = table(l)
      if (t.entries[src] !== w) (t.at ??= {})[placeOf(file, at.path)] = { source: src, text: w }
    }
    if (at.prop) {
      const props = getAt(data, at.path.slice(0, -1)) as Record<string, unknown>
      for (const k of Object.keys(props)) if (k.startsWith('text_')) delete props[k]
      props.text = src
    } else setAt(data, at.path, src)
    changed.add(file)
  })
  for (const t of tables) if (t.at && !Object.keys(t.at).length) delete t.at
  return { changed: [...changed], tables, skipped }
}

/** What is amiss in the tables: one for a language the game does not name, a place's translation whose place no longer says its source. */
export function localeProblems(p: Project, keep?: Keep): { level: 'warning'; code: string; message: string; file?: string; at?: string }[] {
  const langs = languagesOf(p.game)
  const out: ReturnType<typeof localeProblems> = []
  const sources = new Map<string, string>()
  if ((p.locales ?? []).some((f) => f.data.at && Object.keys(f.data.at).length))
    for (const f of filesOf(p)) {
      // (the places as `applyLocales` found them, for a file as it was; else walked here)
      const kept = keep?.cache.files.get(f.file)
      const places = kept && keep!.same(f.file) ? kept.sources : textsOf(f.file, f.data).map((t): [string, string] => [placeOf(f.file, t.path), sourceOf(t.text, langs.source)])
      for (const [place, src] of places) sources.set(place, src)
    }
  for (const f of p.locales ?? []) {
    const l = f.data.language
    if (l === langs.source || !langs.translations.includes(l)) out.push({ level: 'warning', code: 'locale', message: `${f.file}: the game is not translated into ${l} (game.json languages)`, file: f.file })
    for (const [place, a] of Object.entries(f.data.at ?? {}))
      if (sources.get(place) !== a.source) out.push({ level: 'warning', code: 'locale', message: `${f.file}: the translation for ${place} was made for "${a.source}", which is no longer said there`, file: f.file, at: place })
  }
  return out
}

/**
 * The project written in another source language (the game's words then said first in it): each text's words in that
 * language become its words, where it has them, and the former source's go into that language's table. The project
 * changed in place (its game.json's `languages` too); the files changed and the tables.
 */
export function switchSource(p: Project, to: string): { changed: string[]; tables: LocaleFile[] } {
  const from = languagesOf(p.game)
  if (from.source === to) return { changed: [], tables: (p.locales ?? []).map((f) => f.data) }
  const inline = applyLocales({ ...p, game: { ...p.game, languages: { source: from.source, translations: [...new Set([...from.translations, to])] } } })
  inline.game.languages = { source: to, translations: [from.source, ...from.translations.filter((l) => l !== to)] }
  const r = extractLocales(inline, [])
  // (back into the project given: its files and its game.json)
  const byFile = new Map(filesOf(inline).map((f) => [f.file, f.data]))
  for (const group of [p.ontology, p.rules, p.maps, p.people, p.quests, p.story, p.learned ?? [], p.client ?? []] as Sourced<unknown>[][]) for (const f of group) if (byFile.has(f.file)) f.data = byFile.get(f.file)
  p.game = inline.game
  p.locales = r.tables.map((t) => ({ file: `locales/${t.language}.json`, data: t }))
  return { changed: [...new Set([...r.changed, 'game.json'])], tables: r.tables }
}
