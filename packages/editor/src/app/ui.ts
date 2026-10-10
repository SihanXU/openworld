// Small DOM helpers for the editor's panels.

import type { Text } from '@openworld/engine'

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** A text in the editor's language (English, with the Chinese beside it where there is one). */
export const tx = (t: Text | undefined): string => (t === undefined ? '' : typeof t === 'string' ? t : t.zh && t.zh !== t.en ? `${t.en} · ${t.zh}` : t.en)

/** An element from HTML (the first). */
export function html<T extends HTMLElement = HTMLElement>(s: string): T {
  const t = document.createElement('template')
  t.innerHTML = s.trim()
  return t.content.firstElementChild as T
}

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const e = root.querySelector<T>(sel)
  if (!e) throw new Error(`no ${sel}`)
  return e
}

/** A field's value, read back as JSON when it is one (a number, a list, an object), else as text. */
export function parseValue(s: string): unknown {
  const t = s.trim()
  if (t === '') return undefined
  try {
    return JSON.parse(t)
  } catch {
    return s
  }
}

/** A bilingual text from two fields (a plain string when only one is given). */
export const textOf = (en: string, zh: string): Text => (zh.trim() ? { en: en.trim(), zh: zh.trim() } : en.trim())
export const enOf = (t: Text | undefined): string => (t === undefined ? '' : typeof t === 'string' ? t : t.en)
export const zhOf = (t: Text | undefined): string => (t === undefined || typeof t === 'string' ? '' : t.zh ?? '')

/** A short note at the foot of the window. */
export function toast(msg: string, tone: 'ok' | 'warn' | 'error' = 'ok'): void {
  const box = document.getElementById('toasts')
  if (!box) return
  const t = html(`<div class="toast ${tone}">${esc(msg)}</div>`)
  box.appendChild(t)
  setTimeout(() => t.remove(), tone === 'error' ? 8000 : 3500)
}
