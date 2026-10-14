// The editor's own words (docs/engine-split.md §19): the language of its panels, a setting of the editor's — kept
// with its recent projects, never in a project, and never the game's (a game's words and their translations are
// words.ts'). English as its code writes it; Chinese from the table (zh.ts).

import { ZH } from './zh.ts'

export type UiLang = 'en' | 'zh'
let current: UiLang = 'en'

export const uiLang = (): UiLang => current
export const UI_LANGS: [UiLang, string][] = [['en', 'English'], ['zh', '中文']]

/** The editor's language, from its settings (else the system's). */
export async function loadUiLang(): Promise<void> {
  try {
    const s = (await (await fetch('/api/settings')).json()) as { lang?: UiLang }
    current = s.lang ?? (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en')
  } catch {
    current = navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en'
}

/** Set the editor's language, and keep it in its settings. */
export async function setUiLang(l: UiLang): Promise<void> {
  current = l
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
  await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-openworld-editor': '1' }, body: JSON.stringify({ lang: l }) }).catch(() => {})
}

/** The editor's words: the English as written, in Chinese from the table when the editor is; `{name}` slots filled from `vars`. */
export function t(en: string, vars?: Record<string, string | number>): string {
  const s = current === 'zh' ? (ZH[en] ?? en) : en
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

/** A phrase kept in a table (a tool's name, a mode's label): put into the editor's language where it is shown, by `t`. */
export const phrase = (en: string): string => en
