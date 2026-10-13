// Small DOM helpers for the editor's panels.

import type { Text } from '@openworld/engine'
import { tx } from './words.ts'

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export { t } from './lang.ts'
export { tx } from './words.ts'

/** A field for a game's text: its words in the game's source language (words.ts), the one field there is. */
export function textField(attrs: string, text: Text | undefined, o: { area?: boolean; rows?: number; placeholder?: string } = {}): string {
  const v = tx(text)
  const ph = o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''
  return o.area ? `<textarea ${attrs} rows="${o.rows ?? 2}"${ph}>${esc(v)}</textarea>` : `<input ${attrs} value="${esc(v)}"${ph}>`
}

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

/** A short note at the foot of the window. */
export function toast(msg: string, tone: 'ok' | 'warn' | 'error' = 'ok'): void {
  const box = document.getElementById('toasts')
  if (!box) return
  const t = html(`<div class="toast ${tone}">${esc(msg)}</div>`)
  box.appendChild(t)
  setTimeout(() => t.remove(), tone === 'error' ? 8000 : 3500)
}
