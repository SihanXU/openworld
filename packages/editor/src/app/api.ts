// The editor's calls to its service (src/server/api.ts), and what the desktop shell adds where the editor runs in
// it (desktop/preload.cjs: the system's own folder dialog, a folder shown in the file manager).

import { HEADER } from '../server/headers.ts'

/** A call to the service: JSON both ways, every change carrying the editor's header; an error says the service's words. */
export async function call<T>(path: string, init: { method?: string; body?: unknown; raw?: Blob | ArrayBuffer } = {}): Promise<T> {
  const r = await fetch(path, {
    method: init.method ?? (init.body !== undefined || init.raw ? 'POST' : 'GET'),
    headers: { [HEADER]: '1', ...(init.body !== undefined && { 'content-type': 'application/json' }) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : init.raw ? { body: init.raw } : {}),
  })
  const text = await r.text()
  const value = text ? (() => { try { return JSON.parse(text) } catch { return { error: text } } })() : undefined
  if (!r.ok) throw new Error((value as { error?: string })?.error ?? `${r.status} ${r.statusText}`)
  return value as T
}

/** What the desktop shell gives the page (none in a browser). */
export interface Desktop {
  pickFolder(o?: { title?: string; defaultPath?: string }): Promise<string | undefined>
  showFolder(path: string): Promise<void>
}
export const desktop = (): Desktop | undefined => (globalThis as { openworld?: Desktop }).openworld
