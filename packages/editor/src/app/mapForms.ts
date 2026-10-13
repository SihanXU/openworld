// A map's settings as forms (docs/engine-split.md §16 E1, RPG Maker's map properties): its name and group, kind,
// light, zone and music; the law kept here, fish in its water; and what appears on it by itself (MapData.appear:
// the ground's yield, creatures that come back) — each entry its kinds with their weights, the grounds, how many
// and how often, the hours, the night, the weather, and a creature's behaviour.

import { WEATHERS, type AppearDef, type RawChunk } from '@openworld/engine'
import type { Catalog } from '@openworld/runtime/src/assets/types.ts'
import type { Ctx } from './context.ts'
import { enOf, esc, textOf, tx, zhOf } from './ui.ts'

const KINDS = ['village', 'town', 'wild', 'forest', 'dungeon', 'cave', 'interior', 'overworld']
const BEHAVIOURS: NonNullable<AppearDef['ai']>['behaviour'][] = ['melee', 'ranged', 'passive']
const TEMPERS: NonNullable<AppearDef['ai']>['temper'][] = ['wary', 'aggressive', 'nocturnal']

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
    <label>name <input data-m="en" value="${esc(enOf(m.name))}"> <input data-m="zh" value="${esc(zhOf(m.name))}" placeholder="中文"></label>
    <label>group <input data-m="region" list="mfGroups" value="${esc(m.region ?? '')}" placeholder="(none)"><datalist id="mfGroups">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
    <label>kind <input data-m="kind" list="mfKinds" value="${esc(m.kind)}"><datalist id="mfKinds">${KINDS.map((k) => `<option value="${k}">`).join('')}</datalist></label>
    <label>light <select data-m="light">${['outdoor', 'indoor', 'dark'].map((l) => opt(l, m.light ?? 'outdoor')).join('')}</select></label>
    <label>zone <select data-m="zone" title="peaceful: nothing comes out at night; combat: the night's walkers do">${['peaceful', 'combat'].map((l) => opt(l, m.zone ?? 'combat')).join('')}</select></label>
    <label>music <select data-m="music">${opt('', m.music, '(none)')}${[...new Set([...music, ...(m.music ? [m.music] : [])])].map((k) => opt(k, m.music)).join('')}</select></label>
    <label>law kept here <select data-m="law">${opt('', m.law, '(none)')}${[...new Set([...laws, ...(m.law ? [m.law] : [])])].map((k) => opt(k, m.law)).join('')}</select></label>
    <label class="chip"><input type="checkbox" data-m="fish" ${m.fish ? 'checked' : ''}> fish in its water (worth a line)</label>
    <details ${m.appear?.length ? 'open' : ''}><summary>What appears here by itself (${m.appear?.length ?? 0})</summary>
      <p class="muted">The ground's yield and creatures that come back: on the grounds named, up to so many at once, one more every so many ticks while there are fewer.</p>
      ${(m.appear ?? []).map((a, i) => appearForm(ctx, a, i)).join('')}
      <button id="apAdd">+ What appears</button>
    </details>`
}

function appearForm(ctx: Ctx, a: AppearDef, i: number): string {
  const onto = ctx.onto()
  const terrains = Object.keys(onto.terrains)
  const creature = Object.keys(a.types).some((t) => t.startsWith('actor/'))
  const chip = (field: string, v: string, on: boolean, label = v) => `<label class="chip"><input type="checkbox" data-ap="${i}" data-f="${field}" value="${esc(v)}" ${on ? 'checked' : ''}>${esc(label)}</label>`
  return `<div class="box appear">
    <div class="row"><b>${i + 1}.</b><span class="grow"></span><a data-ap-del="${i}" class="x" title="remove">✕</a></div>
    <table class="sched">${Object.entries(a.types).map(([t, w]) => `<tr><td><input data-ap="${i}" data-type="${esc(t)}" list="apTypes" value="${esc(t)}"></td><td><input type="number" min="0" step="1" data-ap="${i}" data-weight="${esc(t)}" value="${w}" title="weight"></td><td><a data-ap="${i}" data-type-del="${esc(t)}" class="x">✕</a></td></tr>`).join('')}
      <tr><td colspan="3"><input data-ap="${i}" data-type-add list="apTypes" placeholder="+ a kind (type)"></td></tr></table>
    <div class="chips">on ${terrains.map((t) => chip('on', t, !!a.on?.includes(t), tx(onto.terrains[t]?.name) || t)).join('')}</div>
    <label>at most <input type="number" min="1" data-ap="${i}" data-f="max" value="${a.max}"> · every <input type="number" min="1" data-ap="${i}" data-f="every" value="${a.every}"> ticks</label>
    <label>hours <input type="number" min="0" max="23" data-ap="${i}" data-f="from" value="${a.hours?.[0] ?? ''}" placeholder="any"> to <input type="number" min="0" max="24" data-ap="${i}" data-f="to" value="${a.hours?.[1] ?? ''}" placeholder="any"> <label class="chip inline"><input type="checkbox" data-ap="${i}" data-f="night" ${a.night ? 'checked' : ''}>at night</label></label>
    <div class="chips">weather ${WEATHERS.map((w) => chip('weather', w, !!a.weather?.includes(w))).join('')}</div>
    <label>tag <input data-ap="${i}" data-f="tag" value="${esc(a.tag ?? '')}" placeholder="(counted by its kinds)"></label>
    ${creature ? `<label>behaviour <select data-ap="${i}" data-f="behaviour">${BEHAVIOURS.map((b) => opt(b, a.ai?.behaviour ?? 'melee')).join('')}</select> <select data-ap="${i}" data-f="temper">${TEMPERS.map((b) => opt(b, a.ai?.temper ?? 'wary')).join('')}</select> sight <input type="number" min="1" data-ap="${i}" data-f="sight" value="${a.ai?.sight ?? 4}"> leash <input type="number" min="1" data-ap="${i}" data-f="leash" value="${a.ai?.leash ?? 8}"></label>` : ''}
  </div>`
}

/** The settings' fields wired to the map file. */
export function wireMapSettings(ctx: Ctx, root: HTMLElement, edit: Edit): void {
  const types = Object.keys(ctx.onto().types).filter((t) => /^(item|fixture|actor\/creature)\//.test(t)).sort()
  if (!root.querySelector('#apTypes')) root.insertAdjacentHTML('beforeend', `<datalist id="apTypes">${types.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>`)
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-m]').forEach((el) => (el.onchange = () => edit('the map\'s settings', (c) => {
    const k = el.dataset.m!
    const m = c.map as unknown as Record<string, unknown>
    if (k === 'en' || k === 'zh') c.map.name = textOf(k === 'en' ? el.value : enOf(c.map.name), k === 'zh' ? el.value : zhOf(c.map.name))
    else if (k === 'fish') (el as HTMLInputElement).checked ? (c.map.fish = true) : delete c.map.fish
    else if (el.value.trim()) m[k] = el.value.trim()
    else if (k !== 'kind') delete m[k]
  })))
  const at = (el: HTMLElement, why: string, fn: (a: AppearDef) => void) => edit(why, (c) => { const a = c.map.appear?.[Number(el.dataset.ap)]; if (a) fn(a) })
  root.querySelector<HTMLButtonElement>('#apAdd')?.addEventListener('click', () => edit('what appears', (c) => (c.map.appear ??= []).push({ types: {}, max: 3, every: 600 })))
  root.querySelectorAll<HTMLElement>('[data-ap-del]').forEach((a) => (a.onclick = () => edit('what appears, removed', (c) => {
    c.map.appear?.splice(Number(a.dataset.apDel), 1)
    if (!c.map.appear?.length) delete c.map.appear
  })))
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-ap]').forEach((el) => {
    if (el instanceof HTMLAnchorElement) return
    el.onchange = () => {
      const v = el.value.trim()
      if (el.dataset.typeAdd !== undefined) return v && at(el, 'what appears: a kind', (a) => (a.types[v] ??= 1))
      if (el.dataset.type !== undefined) return at(el, 'what appears: a kind', (a) => { const w = a.types[el.dataset.type!]; delete a.types[el.dataset.type!]; if (v) a.types[v] = w })
      if (el.dataset.weight !== undefined) return at(el, 'what appears: a weight', (a) => (a.types[el.dataset.weight!] = Math.max(0, Number(v) || 0)))
      const f = el.dataset.f!
      const box = el as HTMLInputElement
      at(el, `what appears: ${f}`, (a) => {
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
  root.querySelectorAll<HTMLElement>('[data-type-del]').forEach((a) => (a.onclick = () => at(a, 'what appears: a kind removed', (x) => delete x.types[a.dataset.typeDel!])))
}
