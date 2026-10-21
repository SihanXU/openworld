// The wiki's two editions: Chinese, the source the team writes (wiki/pages, served at /wiki/), and English, its
// translation (wiki/en/pages, served at /wiki/en/). A build is one edition at a time: everything that writes a word
// asks `L` (the generator's own words) or `say` (the game's, which carries both languages) for the edition's.

export type Lang = 'zh' | 'en'

let LANG: Lang = 'zh'

export const setLang = (l: Lang): void => { LANG = l }
export const lang = (): Lang => LANG

/** One of the generator's own phrases, in the edition's language. */
export const L = (zh: string, en: string): string => (LANG === 'en' ? en : zh)

/** Where an edition's pages are served. */
export const BASE: Record<Lang, string> = { zh: '/wiki/', en: '/wiki/en/' }

/**
 * A title's path under its edition (the file written and the URL that serves it). Chinese titles only turn `/` into
 * `／`, as they always have; English ones use `_` for spaces, a directory for `Special:` and `Category:`, and the
 * full-width forms of the characters a file name cannot hold. wiki.js repeats this.
 */
export function titlePath(title: string, l: Lang = LANG): string {
  const t = title.replace(/\//g, '／')
  if (l === 'zh') return t
  const m = t.match(/^(Special|Category):(.*)$/)
  const clean = (s: string) => s.replace(/:/g, '：').replace(/\?/g, '？').replace(/\*/g, '＊').replace(/"/g, '＂').replace(/</g, '＜').replace(/>/g, '＞').replace(/\|/g, '｜').replace(/\\/g, '＼').replace(/ /g, '_')
  return m ? `${m[1]}/${clean(m[2])}` : clean(t)
}

export const linkHref = (title: string, l: Lang = LANG): string => `${BASE[l]}${titlePath(title, l).split('/').map(encodeURIComponent).join('/')}`
