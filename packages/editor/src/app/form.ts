// A form drawn as HTML and wired after it is in the page (docs/engine-split.md §16 E2): each control is given what
// it does when changed or clicked, by an id of the form's; nested forms (a quest's triggers in triggers) are
// functions that add their controls to the same form. The editor draws its panels anew after every edit, so a
// control writes its value and the panel is drawn again from the project.

import type { Text } from '@openworld/engine'
import { esc, t, textField } from './ui.ts'
import { together, written } from './words.ts'

type On = (el: HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement) => void

export class Form {
  private n = 0
  private handlers = new Map<string, On>()

  /** A control's id, and what it does. */
  on(fn: On): string {
    const id = `f${this.n++}`
    this.handlers.set(id, fn)
    return id
  }

  /** Wire the controls drawn under an element (buttons and links on a click, the rest on a change). */
  wire(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-f]').forEach((el) => {
      const fn = this.handlers.get(el.dataset.f!)
      if (!fn) return
      const click = el.tagName === 'BUTTON' || el.tagName === 'A'
      if (click) el.onclick = (e) => (e.preventDefault(), fn(el as never))
      else (el as HTMLInputElement).onchange = () => fn(el as never)
    })
  }

  text(value: string | undefined, set: (v: string) => void, o: { placeholder?: string; list?: string; wide?: boolean; title?: string } = {}): string {
    return `<input data-f="${this.on((el) => set(el.value.trim()))}" value="${esc(value ?? '')}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.list ? ` list="${esc(o.list)}"` : ''}${o.wide ? ' class="wide"' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>`
  }

  num(value: number | undefined, set: (v: number | undefined) => void, o: { min?: number; max?: number; step?: number; placeholder?: string } = {}): string {
    return `<input type="number" data-f="${this.on((el) => set(el.value === '' ? undefined : Number(el.value)))}" value="${value ?? ''}"${o.min !== undefined ? ` min="${o.min}"` : ''}${o.max !== undefined ? ` max="${o.max}"` : ''}${o.step !== undefined ? ` step="${o.step}"` : ''}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}>`
  }

  select(options: (string | [string, string])[], cur: string | undefined, set: (v: string) => void, o: { none?: string } = {}): string {
    const opts = options.map((x) => (typeof x === 'string' ? [x, x] : x))
    const known = opts.some(([v]) => v === (cur ?? ''))
    return `<select data-f="${this.on((el) => set(el.value))}">${o.none !== undefined ? `<option value="">${esc(o.none)}</option>` : ''}${!known && cur ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ''}${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
  }

  check(on: boolean | undefined, label: string, set: (v: boolean) => void): string {
    return `<label class="chip"><input type="checkbox" data-f="${this.on((el) => set(el.checked))}" ${on ? 'checked' : ''}>${esc(label)}</label>`
  }

  /** A game's text: one field, its words in the game's source language (its translations are the Localization mode's). */
  words(text: Text | undefined, set: (t: Text | undefined) => void, o: { placeholder?: string; area?: boolean } = {}): string {
    return textField(`data-f="${this.on((el) => together(() => set(written(text, el.value))))}" class="words"`, text, { area: o.area, placeholder: o.placeholder })
  }

  button(label: string, fn: () => void, o: { cls?: string; title?: string } = {}): string {
    return `<button data-f="${this.on(() => fn())}"${o.cls ? ` class="${o.cls}"` : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${esc(label)}</button>`
  }

  link(label: string, fn: () => void, o: { cls?: string; title?: string } = {}): string {
    return `<a data-f="${this.on(() => fn())}"${o.cls ? ` class="${o.cls}"` : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${esc(label)}</a>`
  }

  /** A value written as JSON (the "advanced" field): read back on change, and refused when it is not JSON. */
  json(value: unknown, set: (v: unknown) => void, bad: (msg: string) => void, rows = 3): string {
    return `<textarea class="json" rows="${rows}" data-f="${this.on((el) => {
      const typed = el.value.trim()
      if (!typed) return set(undefined)
      try {
        set(JSON.parse(typed))
      } catch (e) {
        bad(t('not JSON: {why}', { why: (e as Error).message }))
      }
    })}">${esc(value === undefined ? '' : JSON.stringify(value))}</textarea>`
  }
}

/** A value typed in a field: a number, true or false, else the text. */
export function valueOf(s: string): string | number | boolean {
  const t = s.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t !== '' && Number.isFinite(Number(t))) return Number(t)
  return t
}

/** A record's entries changed one at a time: the key renamed, the value set, the entry removed (none: the record gone). */
export function setKey<V>(rec: Record<string, V> | undefined, old: string | undefined, key: string | undefined, value: V | undefined): Record<string, V> | undefined {
  const out: Record<string, V> = {}
  for (const [k, v] of Object.entries(rec ?? {})) {
    if (k === old) {
      if (key && value !== undefined) out[key] = value
    } else out[k] = v
  }
  if (old === undefined && key && value !== undefined) out[key] = value
  return Object.keys(out).length ? out : undefined
}
