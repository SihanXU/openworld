// A map's settings as forms (docs/engine-split.md §16 E1, RPG Maker's map properties): its name and group, kind,
// light, zone and music; the law kept here, fish in its water; and what appears on it by itself (MapData.appear:
// the ground's yield, creatures that come back) — each entry its kinds with their weights, the grounds, how many
// and how often, the hours, the night, the weather, and a creature's behaviour.

import { WEATHERS, type AppearDef, type RawChunk } from '@openworld/engine'
import type { Catalog } from '@openworld/runtime/src/assets/types.ts'
import type { Ctx } from './context.ts'
import { phrase } from './lang.ts'
import { esc, t, textField, tx } from './ui.ts'
import { together, written } from './words.ts'

const KINDS = ['village', 'town', 'wild', 'forest', 'dungeon', 'cave', 'interior', 'overworld']
const BEHAVIOURS: NonNullable<AppearDef['ai']>['behaviour'][] = ['melee', 'ranged', 'passive']
const TEMPERS: NonNullable<AppearDef['ai']>['temper'][] = ['wary', 'aggressive', 'nocturnal']
/** The words for the format's values, in the editor's language. */
const WORDS = [phrase('outdoor'), phrase('indoor'), phrase('dark'), phrase('peaceful'), phrase('combat'), phrase('melee'), phrase('ranged'), phrase('passive'), phrase('wary'), phrase('aggressive'), phrase('nocturnal')]
const said = (v: string) => (WORDS.includes(v) ? t(v) : v)

type Edit = (why: string, fn: (c: RawChunk) => void) => void

const opt = (v: string, cur: string | undefined, label = v) => `<option value="${esc(v)}" ${v === (cur ?? '') ? 'selected' : ''}>${esc(label)}</option>`

/** The map's settings, as a form. */
export function mapSettings(ctx: Ctx, ch: RawChunk): string {
  const m = ch.map
  const onto = ctx.onto()
  const music = Object.keys(ctx.store.get<Catalog>('catalog.json')?.music ?? {})
  const laws = Object.keys(onto.laws ?? {})
  const groups = [...new Set(ctx.store.maps().map((x) => x.data.map.region).filter(Boolean))] as string[]
  return `<h3>${esc(m.id)}</h3>
    <label>${t('name')} ${textField('data-m="name"', m.name)}</label>
    <label>${t('group')} <input data-m="region" list="mfGroups" value="${esc(m.region ?? '')}" placeholder="${t('(none)')}"><datalist id="mfGroups">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
    <label>${t('kind')} <input data-m="kind" list="mfKinds" value="${esc(m.kind)}"><datalist id="mfKinds">${KINDS.map((k) => `<option value="${k}">`).join('')}</datalist></label>
    <label>${t('light')} <select data-m="light">${['outdoor', 'indoor', 'dark'].map((l) => opt(l, m.light ?? 'outdoor', said(l))).join('')}</select></label>
    <label>${t('zone')} <select data-m="zone" title="${t('peaceful: nothing comes out at night; combat: the night\'s walkers do')}">${['peaceful', 'combat'].map((l) => opt(l, m.zone ?? 'combat', said(l))).join('')}</select></label>
    <label>${t('music')} <select data-m="music">${opt('', m.music, t('(none)'))}${[...new Set([...music, ...(m.music ? [m.music] : [])])].map((k) => opt(k, m.music)).join('')}</select></label>
    <label>${t('law kept here')} <select data-m="law">${opt('', m.law, t('(none)'))}${[...new Set([...laws, ...(m.law ? [m.law] : [])])].map((k) => opt(k, m.law)).join('')}</select></label>
    <label class="chip"><input type="checkbox" data-m="fish" ${m.fish ? 'checked' : ''}> ${t('fish in its water (worth a line)')}</label>
    <details ${m.appear?.length ? 'open' : ''}><summary>${t('What appears here by itself ({n})', { n: m.appear?.length ?? 0 })}</summary>
      <p class="muted">${t('The ground\'s yield and creatures that come back: on the grounds named, up to so many at once, one more every so many ticks while there are fewer.')}</p>
      ${(m.appear ?? []).map((a, i) => appearForm(ctx, a, i)).join('')}
      <button id="apAdd">${t('+ What appears')}</button>
    </details>`
}

function appearForm(ctx: Ctx, a: AppearDef, i: number): string {
  const onto = ctx.onto()
  const terrains = Object.keys(onto.terrains)
  const creature = Object.keys(a.types).some((k) => k.startsWith('actor/'))
  const chip = (field: string, v: string, on: boolean, label = v) => `<label class="chip"><input type="checkbox" data-ap="${i}" data-f="${field}" value="${esc(v)}" ${on ? 'checked' : ''}>${esc(label)}</label>`
  return `<div class="box appear">
    <div class="row"><b>${i + 1}.</b><span class="grow"></span><a data-ap-del="${i}" class="x" title="${t('remove')}">✕</a></div>
    <table class="sched">${Object.entries(a.types).map(([k, w]) => `<tr><td><input data-ap="${i}" data-type="${esc(k)}" list="apTypes" value="${esc(k)}"></td><td><input type="number" min="0" step="1" data-ap="${i}" data-weight="${esc(k)}" value="${w}" title="${t('weight')}"></td><td><a data-ap="${i}" data-type-del="${esc(k)}" class="x">✕</a></td></tr>`).join('')}
      <tr><td colspan="3"><input data-ap="${i}" data-type-add list="apTypes" placeholder="${t('+ a kind (type)')}"></td></tr></table>
    <div class="chips">${t('on')} ${terrains.map((k) => chip('on', k, !!a.on?.includes(k), tx(onto.terrains[k]?.name) || k)).join('')}</div>
    <label>${t('at most')} <input type="number" min="1" data-ap="${i}" data-f="max" value="${a.max}"> · ${t('every')} <input type="number" min="1" data-ap="${i}" data-f="every" value="${a.every}"> ${t('ticks')}</label>
    <label>${t('hours')} <input type="number" min="0" max="23" data-ap="${i}" data-f="from" value="${a.hours?.[0] ?? ''}" placeholder="${t('any')}"> ${t('to')} <input type="number" min="0" max="24" data-ap="${i}" data-f="to" value="${a.hours?.[1] ?? ''}" placeholder="${t('any')}"> <label class="chip inline"><input type="checkbox" data-ap="${i}" data-f="night" ${a.night ? 'checked' : ''}>${t('at night')}</label></label>
    <div class="chips">${t('weather')} ${WEATHERS.map((w) => chip('weather', w, !!a.weather?.includes(w))).join('')}</div>
    <label>${t('tag')} <input data-ap="${i}" data-f="tag" value="${esc(a.tag ?? '')}" placeholder="${t('(counted by its kinds)')}"></label>
    ${creature ? `<label>${t('behaviour')} <select data-ap="${i}" data-f="behaviour">${BEHAVIOURS.map((b) => opt(b, a.ai?.behaviour ?? 'melee', said(b))).join('')}</select> <select data-ap="${i}" data-f="temper">${TEMPERS.map((b) => opt(b, a.ai?.temper ?? 'wary', said(b))).join('')}</select> ${t('sight')} <input type="number" min="1" data-ap="${i}" data-f="sight" value="${a.ai?.sight ?? 4}"> ${t('leash')} <input type="number" min="1" data-ap="${i}" data-f="leash" value="${a.ai?.leash ?? 8}"></label>` : ''}
  </div>`
}

/** The settings' fields wired to the map file. */
export function wireMapSettings(ctx: Ctx, root: HTMLElement, edit: Edit): void {
  const types = Object.keys(ctx.onto().types).filter((k) => /^(item|fixture|actor\/creature)\//.test(k)).sort()
  if (!root.querySelector('#apTypes')) root.insertAdjacentHTML('beforeend', `<datalist id="apTypes">${types.map((k) => `<option value="${esc(k)}">`).join('')}</datalist>`)
  const mapNow = () => { const f = ctx.store.mapFile(ctx.map); return f ? ctx.store.get<RawChunk>(f) : undefined }
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-m]').forEach((el) => (el.onchange = () => together(() => {
    const k = el.dataset.m!
    const name = k === 'name' ? written(mapNow()?.map.name, el.value) : undefined
    edit(t('the map\'s settings'), (c) => {
    const m = c.map as unknown as Record<string, unknown>
    if (k === 'name') c.map.name = name ?? c.map.id
    else if (k === 'fish') (el as HTMLInputElement).checked ? (c.map.fish = true) : delete c.map.fish
    else if (el.value.trim()) m[k] = el.value.trim()
    else if (k !== 'kind') delete m[k]
    })
  })))
  const at = (el: HTMLElement, why: string, fn: (a: AppearDef) => void) => edit(why, (c) => { const a = c.map.appear?.[Number(el.dataset.ap)]; if (a) fn(a) })
  root.querySelector<HTMLButtonElement>('#apAdd')?.addEventListener('click', () => edit(t('what appears'), (c) => (c.map.appear ??= []).push({ types: {}, max: 3, every: 600 })))
  root.querySelectorAll<HTMLElement>('[data-ap-del]').forEach((a) => (a.onclick = () => edit(t('what appears, removed'), (c) => {
    c.map.appear?.splice(Number(a.dataset.apDel), 1)
    if (!c.map.appear?.length) delete c.map.appear
  })))
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-ap]').forEach((el) => {
    if (el instanceof HTMLAnchorElement) return
    el.onchange = () => {
      const v = el.value.trim()
      if (el.dataset.typeAdd !== undefined) return v && at(el, t('what appears: a kind'), (a) => (a.types[v] ??= 1))
      if (el.dataset.type !== undefined) return at(el, t('what appears: a kind'), (a) => { const w = a.types[el.dataset.type!]; delete a.types[el.dataset.type!]; if (v) a.types[v] = w })
      if (el.dataset.weight !== undefined) return at(el, t('what appears: a weight'), (a) => (a.types[el.dataset.weight!] = Math.max(0, Number(v) || 0)))
      const f = el.dataset.f!
      const box = el as HTMLInputElement
      at(el, t('what appears: {field}', { field: f }), (a) => {
        if (f === 'on' || f === 'weather') {
          const list = new Set(a[f] ?? [])
          box.checked ? list.add(el.value) : list.delete(el.value)
          if (list.size) (a as unknown as Record<string, unknown>)[f] = [...list]
          else delete a[f]
        } else if (f === 'max' || f === 'every') a[f] = Math.max(1, Number(v) || 1)
        else if (f === 'from' || f === 'to') {
          const h: [number, number] = [...(a.hours ?? [0, 24])] as [number, number]
          if (v === '') delete a.hours
          else ((h[f === 'from' ? 0 : 1] = Number(v)), (a.hours = h))
        } else if (f === 'night') box.checked ? (a.night = true) : delete a.night
        else if (f === 'tag') v ? (a.tag = v) : delete a.tag
        else if (f === 'behaviour' || f === 'temper' || f === 'sight' || f === 'leash') {
          const ai = (a.ai ??= { behaviour: 'melee', temper: 'wary', sight: 4 })
          if (f === 'behaviour') ai.behaviour = v as typeof ai.behaviour
          else if (f === 'temper') ai.temper = v as typeof ai.temper
          else ai[f] = Math.max(1, Number(v) || 1)
        }
      })
    }
  })
  root.querySelectorAll<HTMLElement>('[data-type-del]').forEach((a) => (a.onclick = () => at(a, t('what appears: a kind removed'), (x) => delete x.types[a.dataset.typeDel!])))
}
