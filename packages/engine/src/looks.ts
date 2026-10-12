// Looks (docs/looks.md): what a body is drawn from. A look is a body, a part per slot and a colour per colour
// key; the world's table (Ontology.looks) says which bodies, parts and colours there are. The engine checks a
// look against the table and derives the look's tags from it (`look:*` on the bearer), so the tags, the map
// sprite and the portrait all come from one record and cannot disagree. Pure: no pictures here.

import type { Look, LookTable } from './types.ts'

/** The prefix of the tags a look gives its bearer. */
export const LOOK_TAG = 'look:'

/** The colour a key of a look has: its own, else the part's default, else none. */
export function lookColor(look: Look, key: string, table?: LookTable): string | undefined {
  const own = look.colors[key]
  if (own) return own
  const dot = key.indexOf('.')
  if (dot < 0 || !table) return undefined
  const part = table.parts[look.parts[key.slice(0, dot)] ?? '']
  return part?.colors?.[key.slice(dot + 1)]
}

/** The tags a look gives its bearer: its body's, its parts', and what its colours say of the keys they colour (silver hair: grey-haired). */
export function lookTags(look: Look, table: LookTable): string[] {
  const tags = new Set<string>(table.bodies[look.body]?.tags ?? [])
  for (const id of Object.values(look.parts)) for (const t of table.parts[id]?.tags ?? []) tags.add(t)
  const keys = new Set([...Object.keys(look.colors), ...Object.entries(look.parts).flatMap(([slot, id]) => Object.keys(table.parts[id]?.colors ?? {}).map((n) => `${slot}.${n}`))])
  for (const key of keys) {
    const c = lookColor(look, key, table)
    for (const t of (c && table.colors[c]?.tags?.[key]) ?? []) tags.add(t)
  }
  return [...tags].sort()
}

/** What is wrong with a look against the table (nothing: an empty list). */
export function lookProblems(look: Look, table: LookTable): string[] {
  const out: string[] = []
  if (!table.bodies[look.body]) out.push(`no body ${look.body}`)
  for (const [slot, id] of Object.entries(look.parts)) {
    const p = table.parts[id]
    if (!p) out.push(`no part ${id}`)
    else if (p.slot !== slot) out.push(`${id} is a ${p.slot}, not a ${slot}`)
    else if (p.bodies && !p.bodies.includes(look.body)) out.push(`${id} is not drawn for the body ${look.body}`)
  }
  for (const [key, c] of Object.entries(look.colors)) {
    const [slot] = key.split('.')
    if (!['skin', 'hair', 'eyes'].includes(key) && !(key.includes('.') && look.parts[slot])) out.push(`colour key ${key} colours nothing`)
    if (!/^#[0-9a-f]{6}$/i.test(c) && !table.colors[c]) out.push(`no colour ${c}`)
  }
  return out
}

/** A look with some parts and colours changed (`null`: the slot left empty). */
export function restyled(look: Look, change: { body?: string; parts?: Record<string, string | null>; colors?: Record<string, string | null> }): Look {
  const parts = { ...look.parts }
  for (const [k, v] of Object.entries(change.parts ?? {})) v ? (parts[k] = v) : delete parts[k]
  const colors = { ...look.colors }
  for (const [k, v] of Object.entries(change.colors ?? {})) v ? (colors[k] = v) : delete colors[k]
  return { body: change.body ?? look.body, parts, colors, own: true }
}

/**
 * A look with what its bearer wears on it (docs/looks.md §5): each worn thing that says the part it is worn as
 * (its type's `look` prop) takes that part's slot, painted in its material's colour (the table's `materials`) — an
 * iron helmet is the helm, iron-grey. The bearer's own look is unchanged; this is what is seen.
 */
export function wornLook(look: Look, worn: { part: string; material?: string }[], table: LookTable): Look {
  if (!worn.length) return look
  const parts = { ...look.parts }
  const colors = { ...look.colors }
  for (const w of worn) {
    const p = table.parts[w.part]
    if (!p || (p.bodies && !p.bodies.includes(look.body))) continue
    parts[p.slot] = w.part
    const c = w.material && table.materials?.[w.material]
    if (c) colors[`${p.slot}.1`] = c
    else delete colors[`${p.slot}.1`]
  }
  return { ...look, parts, colors }
}

/** A short code of a look (the client's key for its pictures): the same look, the same code. */
export function lookCode(look: Look): string {
  const kv = (o: Record<string, string>) => Object.keys(o).sort().map((k) => `${k}=${o[k]}`).join(',')
  return `${look.body}|${kv(look.parts)}|${kv(look.colors)}`
}

/** A look in plain words for the modder (its body, then each part in its colour): "woman; hair: bun (silver); …". */
export function lookWords(look: Look, table: LookTable): string {
  const en = (t: { en?: string } | string | undefined) => (typeof t === 'string' ? t : (t?.en ?? ''))
  const name = (c: string | undefined) => (c ? (table.colors[c] ? en(table.colors[c].name) : c) : '')
  const out = [en(table.bodies[look.body]?.name) || look.body]
  for (const [slot, id] of Object.entries(look.parts)) {
    const p = table.parts[id]
    if (!p) continue
    const key = p.uses?.includes('hair') && slot !== 'face' ? 'hair' : slot === 'face' ? 'eyes' : p.colors?.['1'] ? `${slot}.1` : undefined
    const c = key && name(lookColor(look, key, table))
    out.push(`${slot}: ${en(p.name)}${c ? ` (${c})` : ''}`)
  }
  return out.join('; ')
}
