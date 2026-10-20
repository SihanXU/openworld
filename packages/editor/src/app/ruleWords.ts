// A rule's conditions and effects in words (the Rules mode's outline): "the target is a creature", "its hp > 0",
// "it is hurt by the power given", "tells: …", in place of their JSON. The common kinds are said; the rest keep
// their JSON. Every phrase carries its JSON as its title, for the exact form.

import type { Cmp, Cond, Effect, Selector } from '@openworld/engine'
import { phrase, t } from './lang.ts'
import { esc, tx } from './ui.ts'

const ROLES: Record<string, string> = { host: phrase('it'), actor: phrase('the one who acts'), target: phrase('the target'), instrument: phrase('what is used') }
const role = (r: unknown): string => (typeof r === 'string' ? (ROLES[r] ? t(ROLES[r]) : esc(r)) : esc(JSON.stringify(r)))

/** A value, or a reference to the event's parameter or a role's prop. */
function value(v: unknown): string {
  if (v && typeof v === 'object' && 'param' in v) return t('the {p} given', { p: esc(String((v as { param: unknown }).param)) })
  if (v && typeof v === 'object' && 'prop' in v) return t('its {p}', { p: esc(String((v as { prop: unknown }).prop)) })
  if (v && typeof v === 'object' && 'en' in v) return `“${esc(tx(v as never))}”`
  if (v === '') return t('(empty)')
  return esc(typeof v === 'string' ? v : JSON.stringify(v))
}

const CMPS: Record<string, string> = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' }
function cmp(c: Cmp | undefined): string {
  if (!c) return t('is set')
  return Object.entries(c as Record<string, unknown>).map(([k, v]) => (k === 'in' && Array.isArray(v) ? t('is one of {list}', { list: esc(v.join(', ')) }) : `${CMPS[k] ?? esc(k)} ${value(v)}`)).join(` ${t('and')} `)
}

function selector(s: Selector): string {
  const parts = [
    s.type && t('a {type}', { type: esc(s.type.split('/').slice(-2).join('/')) }),
    s.tags?.length && t('with {tags}', { tags: esc(s.tags.join(', ')) }),
    s.notTags?.length && t('without {tags}', { tags: esc(s.notTags.join(', ')) }),
    s.status?.length && t('that is {status}', { status: esc(s.status.join(', ')) }),
  ].filter(Boolean)
  return parts.join(' ') || esc(JSON.stringify(s))
}

/** A condition in words (the JSON as its title). */
export function condWords(c: Cond): string {
  const o = c as Record<string, unknown>
  const said = ((): string | undefined => {
    if ('all' in o) return (o.all as Cond[]).map(condWords).join(` <span class="k">${t('and')}</span> `)
    if ('any' in o) return `(${(o.any as Cond[]).map(condWords).join(` <span class="k">${t('or')}</span> `)})`
    if ('not' in o) return `<span class="k">${t('not')}</span> ${condWords(o.not as Cond)}`
    if ('is' in o) { const x = o.is as { role: string; sel: Selector }; return t('{who} is {what}', { who: role(x.role), what: selector(x.sel) }) }
    if ('none' in o) return t('{who} is empty', { who: role(o.none) })
    if ('same' in o && Array.isArray(o.same)) return t('{a} and {b} are one', { a: role(o.same[0]), b: role(o.same[1]) })
    if ('has' in o) { const x = o.has as { role: string; status?: string; tag?: string }; return x.status ? t('{who} is {status}', { who: role(x.role), status: esc(x.status) }) : t('{who} has {tag}', { who: role(x.role), tag: esc(x.tag ?? '') }) }
    if ('prop' in o) { const x = o.prop as { role: string; key: string; cmp?: Cmp }; return t('{who}\'s {key} {cmp}', { who: role(x.role), key: esc(x.key), cmp: cmp(x.cmp) }) }
    if ('param' in o) { const x = o.param as { key: string; cmp: Cmp }; return t('the {p} given {cmp}', { p: esc(x.key), cmp: cmp(x.cmp) }) }
    if ('chance' in o) return t('by chance ({n}%)', { n: Math.round(Number(o.chance) * 100) })
    if ('hour' in o) { const x = o.hour as { from: number; to: number }; return t('between {from}h and {to}h', { from: x.from, to: x.to }) }
    if ('night' in o) return o.night ? t('at night') : t('by day')
    if ('outdoors' in o) return t('out under the sky')
    if ('weather' in o && Array.isArray(o.weather)) return t('in {w} weather', { w: esc(o.weather.join(', ')) })
    if ('topic' in o) return t('while “{topic}” is fresh', { topic: esc(String(o.topic)) })
    return undefined
  })()
  return `<span class="c" title="${esc(JSON.stringify(c))}">${said ?? esc(JSON.stringify(c))}</span>`
}

/** An effect in words (the JSON as its title). */
export function effectWords(e: Effect): string {
  const { op, ...r } = e as Effect & Record<string, unknown>
  const said = ((): string | undefined => {
    switch (op) {
      case 'log': return t('tells: {text}', { text: value(r.text) })
      case 'say': return t('says: {text}', { text: value(r.text) })
      case 'emit': return t('sends {what} to {to}', { what: `<b>${esc(String(r.impulse))}</b>`, to: role(r.to) }) + (r.params && typeof r.params === 'object' ? ` (${Object.entries(r.params).map(([k, v]) => `${esc(k)} ${value(v)}`).join(', ')})` : '')
      case 'spawn': return t('makes {n} × {type}', { n: value(r.count ?? 1), type: esc(String(r.type)) })
      case 'transform': return t('becomes {into}', { into: esc(String(r.into)) })
      case 'destroy': return t('is gone')
      case 'addStatus': return t('becomes {status}', { status: esc(String(r.status)) })
      case 'removeStatus': return t('is no longer {status}', { status: esc(String(r.status)) })
      case 'hurt': return t('is hurt by {n}', { n: value(r.amount) })
      case 'heal': return t('is healed by {n}', { n: value(r.amount) })
      case 'setProp': return t('its {key} becomes {v}', { key: esc(String(r.key)), v: value(r.value) })
      case 'addProp': return t('its {key} grows by {v}', { key: esc(String(r.key)), v: value(r.by ?? r.value) })
      case 'vfx': return t('a {fx} is shown', { fx: esc(String(r.fx)) })
      default: return undefined
    }
  })()
  return `<span class="e" title="${esc(JSON.stringify(e))}">${said ?? `${esc(String(op))} ${esc(Object.keys(r).length ? JSON.stringify(r) : '')}`}</span>`
}
