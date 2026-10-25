// The database (docs/engine-split.md §6, RPG Maker's database): the type tree — every kind of thing, item, actor
// and fixture, each inheriting its parent's tags and props —, the statuses, the terrains with the character a
// map writes them by, and the recipes the types' makeup gives. A type the project does not write is the
// standard library's; changing it writes the project's own over it.

import { OntologyIndex, deriveRecipes, type StatusDef, type TerrainDef, type TypeDef } from '@openworld/engine'
import type { Ctx, Mode } from './context.ts'
import { entryFile, removeEntry, setEntry, type Section } from './ontologyFiles.ts'
import { phrase } from './lang.ts'
import { esc, parseValue, t, textField, toast, tx } from './ui.ts'
import { shown, together, written } from './words.ts'
import { paintPics, typePic, type Pic } from './thumbs.ts'
import type { Catalog } from '@openworld/runtime/src/assets/types.ts'

type Tab = 'types' | 'statuses' | 'terrains' | 'recipes'

/** How a field is edited: words in a list, a yes or no, a number, words, a colour, one of some, a table of numbers and words, what it is made of, or (advanced) JSON. */
type Kind = 'list' | 'bool' | 'number' | 'text' | 'color' | 'props' | 'makeup' | 'json' | `choice:${string}`

/** The fields each kind of entry is edited by, as forms (the whole entry is in its JSON too, under Advanced). */
const FIELDS: Record<Section, [key: string, label: string, kind: Kind][]> = {
  types: [['tags', phrase('Tags'), 'list'], ['props', phrase('Properties'), 'props'], ['sprite', phrase('Picture (sprite key)'), 'text'], ['solid', phrase('Solid: nothing walks through it'), 'bool'], ['makeup', phrase('Made of'), 'makeup'], ['station', phrase('Made at (hands, or a station)'), 'text'], ['tools', phrase('Tools its making needs'), 'list'], ['yields', phrase('How many one making gives'), 'number'], ['stage', phrase('Becomes in time (JSON)'), 'json']],
  statuses: [['duration', phrase('Lasts (ticks; empty: until removed)'), 'number'], ['clears', phrase('Statuses it clears'), 'list'], ['wards', phrase('Statuses it wards off'), 'list'], ['immobilize', phrase('Holds its holder still'), 'bool'], ['moveDelay', phrase('Steps slower by (×)'), 'number'], ['every', phrase('Ticks between its periods'), 'number'], ['overlay', phrase('Picture drawn over it (fire, wet, ice …)'), 'text'], ['pose', phrase('Posture its holder is drawn in (sit, lie, kneel, lean)'), 'text'], ['untilMove', phrase('Ends as its holder moves on'), 'bool'],['props', phrase('What it adds to its holder'), 'props']],
  terrains: [['tags', phrase('Tags'), 'list'], ['solid', phrase('Solid: nothing walks through it'), 'bool'], ['liquid', phrase('Liquid'), 'bool'], ['space', phrase('The space it takes'), 'choice:floor,soil,volume'], ['color', phrase('Colour'), 'color'], ['props', phrase('Properties'), 'props'], ['makeup', phrase('Made of'), 'makeup'], ['stage', phrase('Becomes in time (JSON)'), 'json']],
}
const SPACES: Record<string, string> = { floor: phrase('a floor (walked on)'), soil: phrase('rooted in the soil'), volume: phrase('fills its cell') }

export class DatabaseMode implements Mode {
  id = 'database'
  label = phrase('Database')
  private tab: Tab = 'types'
  private sel?: string
  private filter = ''

  main(ctx: Ctx, el: HTMLElement): void {
    const onto = ctx.onto()
    if (this.tab === 'recipes') {
      const recipes = deriveRecipes(new OntologyIndex(onto))
      el.innerHTML = `<h3>${t('Recipes')}</h3><p class="muted">${t('What the types\' makeup gives (a type made at a station from what it is made of): change one in its type.')}</p>
        <table class="sched"><tr><th>${t('makes')}</th><th>${t('from')}</th><th>${t('at')}</th></tr>${recipes.map((r) => `<tr><td><a data-type="${esc(r.make.type)}">${esc(r.make.type)}</a>${(r.count ?? 1) > 1 ? ` ×${r.count}` : ''}</td><td>${esc(r.needs.map((n) => `${n.count} ${n.type}`).join(', '))}</td><td>${esc(r.station)}</td></tr>`).join('') || `<tr><td class="muted">${t('No type has a makeup and a station yet.')}</td></tr>`}</table>`
      el.querySelectorAll<HTMLElement>('[data-type]').forEach((a) => (a.onclick = () => ((this.tab = 'types'), (this.sel = a.dataset.type), ctx.refresh())))
      return
    }
    const section = this.tab
    const all = onto[section] as Record<string, TypeDef | StatusDef | TerrainDef>
    const def = this.sel ? all[this.sel] : undefined
    if (!def) return void (el.innerHTML = `<p class="muted">${t('Choose one on the left, or make a new one.')}</p>`)
    const file = entryFile(ctx.store, section, def.id)
    const own = { ...def } as Record<string, unknown>
    const resolved = section === 'types' ? new OntologyIndex(onto).resolve(def.id) : undefined
    const chars = Object.entries(ctx.store.game.terrainChars).filter(([, t]) => t === def.id).map(([c]) => c)
    const rules = ctx.store.compiled().bundle.rules.filter((r) => r.host?.type && (r.host.type === def.id || def.id.startsWith(r.host.type + '/')))
    const pics = new Map<string, Pic | undefined>()
    if (section === 'types') pics.set(`ty:${def.id}`, typePic(this.catalog(ctx), onto, def.id))
    el.innerHTML = `<div class="db-head">${section === 'types' ? `<canvas data-pic="ty:${esc(def.id)}" width="48" height="48"></canvas>` : section === 'terrains' ? `<span class="sw big" style="background:${esc((def as TerrainDef).color ?? '#555')}"></span>` : ''}
        <div><h2>${esc(shown(def.name) || def.id.split('/').pop())}</h2><p class="muted"><code>${esc(def.id)}</code> · ${file ? t('written in {file}', { file: `<code>${esc(file)}</code>` }) : t('the standard library\'s: a change writes the project\'s own over it')}</p></div></div>
      <div class="cols"><div class="db-form">
        <label>${t('name')} ${textField('data-f="name"', def.name)}</label>
        ${section === 'terrains' ? `<label>${t('map character')} <input data-f="char" maxlength="1" value="${esc(chars[0] ?? '')}"></label>` : ''}
        ${FIELDS[section].filter(([, , kind]) => kind !== 'json').map(([k, label, kind]) => this.field(ctx, k, t(label), kind, own[k])).join('')}
        ${section === 'types' && (def as TypeDef).sprite ? `<p><a id="dbPic">${t('The picture of {sprite} →', { sprite: esc((def as TypeDef).sprite) })}</a></p>` : ''}
        <details class="db-adv"><summary>${t('Advanced: the entry as JSON')}</summary>
          ${FIELDS[section].filter(([, , kind]) => kind === 'json').map(([k, label]) => `<label>${esc(t(label))} <textarea data-json="${k}" rows="3">${esc(own[k] === undefined ? '' : JSON.stringify(own[k]))}</textarea></label>`).join('')}
          <textarea id="dbJson" rows="14">${esc(JSON.stringify(def, null, 2))}</textarea><button id="dbApply">${t('Apply the JSON')}</button></details>
        <button id="dbDel" class="danger" ${file ? '' : 'disabled'}>${t('Remove {id}', { id: esc(def.id) })}${file ? '' : ` ${t('(the library\'s)')}`}</button>
      </div><div>
        ${resolved ? `<h3>${t('As the world sees it')}</h3><p class="muted">${t('Its own and what it inherits from its kinds above it.')}</p>
          <div class="chips">${[...resolved.tags].map((g) => `<span class="chip">${esc(g)}</span>`).join('') || '—'}</div>
          <table class="kv">${Object.entries(resolved.props).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(typeof v === 'string' ? v : JSON.stringify(v))}</td></tr>`).join('')}</table>` : ''}
        <h3>${t('Rules on it')}</h3><ul class="things rules">${rules.map((r) => `<li><a data-rule="${esc(r.id)}">${esc(shown(r.label) || r.doc || r.id)}</a><small>${esc(r.id)} · ${esc(r.on)}${r.host?.type === def.id ? '' : ` · ${t('{type}\'s', { type: esc(r.host?.type) })}`}</small></li>`).join('') || `<li class="muted">${t('none of its own')}</li>`}</ul>
      </div></div>
      <datalist id="dbTypes">${Object.keys(onto.types).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <datalist id="dbTags">${[...new Set(Object.values(onto.types).flatMap((x) => x.tags ?? []))].sort().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`
    paintPics(el, ctx.store.id, pics)
    const write = (d: Record<string, unknown>, why: string) => setEntry(ctx.store, section, d as never, why)
    const edit = (k: string, v: unknown) => together(() => {
      const d = structuredClone(def) as unknown as Record<string, unknown>
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) delete d[k]
      else d[k] = v
      write(d, `${def.id}: ${k}`)
    })
    el.querySelectorAll<HTMLInputElement>('[data-f]').forEach((inp) => (inp.onchange = () => together(() => {
      const k = inp.dataset.f!
      if (k === 'name') {
        const d = structuredClone(def) as unknown as Record<string, unknown>
        d.name = written(def.name, inp.value) ?? def.id.split('/').pop()
        return write(d, `${def.id}: ${k}`)
      }
      const c = inp.value
      if (c.length !== 1) return toast(t('A map writes a terrain by one character.'), 'warn')
      const taken = ctx.store.game.terrainChars[c]
      if (taken && taken !== def.id) return toast(t('"{c}" is {taken}\'s already.', { c, taken }), 'warn')
      ctx.store.change('game.json', t('{id} is "{c}"', { id: def.id, c }), (g: { terrainChars: Record<string, string> }) => { for (const [x, y] of Object.entries(g.terrainChars)) if (y === def.id) delete g.terrainChars[x]; g.terrainChars[c] = def.id })
    })))
    this.wireFields(el, own, edit)
    el.querySelector<HTMLElement>('#dbPic')?.addEventListener('click', () => {
      const sp = (def as TypeDef).sprite!
      ctx.open('assets', 'catalog.json', `${sp.startsWith('fixture:') ? 'fixtures' : sp.startsWith('creature:') ? 'creatures' : 'items'}:${sp}`)
    })
    el.querySelector<HTMLButtonElement>('#dbApply')!.onclick = () => {
      try {
        const d = JSON.parse(el.querySelector<HTMLTextAreaElement>('#dbJson')!.value) as Record<string, unknown>
        if (d.id !== def.id) return toast(t('The JSON keeps its id (make a new one for another).'), 'warn')
        write(d, t('{id}: its JSON', { id: def.id }))
      } catch (e) {
        toast(t('not JSON: {why}', { why: (e as Error).message }), 'error')
      }
    }
    el.querySelector<HTMLButtonElement>('#dbDel')!.onclick = () => (removeEntry(ctx.store, section, def.id, t('remove {id}', { id: def.id })), (this.sel = undefined))
    el.querySelectorAll<HTMLElement>('[data-rule]').forEach((a) => (a.onclick = () => ctx.open('rules', undefined, a.dataset.rule)))
  }

  /** One field as a form: chips, a box to tick, a number, words, a colour, a choice, a table, or the rows of a makeup. */
  private field(ctx: Ctx, k: string, label: string, kind: Kind, v: unknown): string {
    const head = `<span class="db-label">${esc(label)}</span>`
    if (kind === 'bool') return `<label class="chip db-bool"><input type="checkbox" data-bool="${k}" ${v ? 'checked' : ''}> ${esc(label)}</label>`
    if (kind === 'number') return `<label>${head}<input type="number" data-num="${k}" value="${esc(v ?? '')}"></label>`
    if (kind === 'text') return `<label>${head}<input data-text="${k}" value="${esc(v ?? '')}"></label>`
    if (kind === 'color') return `<label>${head}<input type="color" data-text="${k}" value="${esc(typeof v === 'string' ? v : '#888888')}"></label>`
    if (kind.startsWith('choice:')) return `<label>${head}<select data-text="${k}"><option value="">${t('(as its kind)')}</option>${kind.slice(7).split(',').map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${esc(t(SPACES[o] ?? o))}</option>`).join('')}</select></label>`
    if (kind === 'list') {
      const xs = Array.isArray(v) ? (v as string[]) : []
      return `<div class="db-field">${head}<div class="chips">${xs.map((x, i) => `<span class="chip">${esc(x)} <a class="x" data-chip-del="${k}" data-i="${i}">×</a></span>`).join('')}<input data-chip-add="${k}" placeholder="${t('+ add')}" list="dbTags"></div></div>`
    }
    if (kind === 'props') {
      const rows = v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>) : []
      return `<div class="db-field">${head}<table class="kv" data-props="${k}">${rows.map(([pk, pv]) => `<tr><td><input data-pk value="${esc(pk)}"></td><td><input data-pv value="${esc(typeof pv === 'string' ? pv : JSON.stringify(pv))}"></td><td><a class="x" data-row-del>×</a></td></tr>`).join('')}<tr class="add"><td><input data-pk placeholder="${t('name')}"></td><td><input data-pv placeholder="${t('value')}"></td><td></td></tr></table></div>`
    }
    // makeup: a row a part — its kind and how many
    const parts = Array.isArray(v) ? (v as { type: string; count: number }[]) : []
    return `<div class="db-field">${head}<table class="kv" data-makeup="${k}">${parts.map((p) => `<tr><td><input data-mt value="${esc(p.type)}" list="dbTypes"></td><td><input type="number" data-mc min="1" value="${p.count}"></td><td><a class="x" data-row-del>×</a></td></tr>`).join('')}<tr class="add"><td><input data-mt placeholder="${t('+ a part (a kind)')}" list="dbTypes"></td><td><input type="number" data-mc min="1" value="1"></td><td></td></tr></table></div>`
  }

  private wireFields(el: HTMLElement, own: Record<string, unknown>, edit: (k: string, v: unknown) => void): void {
    el.querySelectorAll<HTMLInputElement>('[data-bool]').forEach((b) => (b.onchange = () => edit(b.dataset.bool!, b.checked || undefined)))
    el.querySelectorAll<HTMLInputElement>('[data-num]').forEach((b) => (b.onchange = () => edit(b.dataset.num!, b.value === '' ? undefined : Number(b.value))))
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-text]').forEach((b) => (b.onchange = () => edit(b.dataset.text!, b.value.trim() || undefined)))
    el.querySelectorAll<HTMLInputElement>('[data-chip-add]').forEach((b) => (b.onchange = () => { const k = b.dataset.chipAdd!; const xs = Array.isArray(own[k]) ? [...(own[k] as string[])] : []; const add = b.value.split(',').map((x) => x.trim()).filter((x) => x && !xs.includes(x)); if (add.length) edit(k, [...xs, ...add]) }))
    el.querySelectorAll<HTMLElement>('[data-chip-del]').forEach((a) => (a.onclick = () => { const k = a.dataset.chipDel!; edit(k, (own[k] as string[]).filter((_, i) => i !== Number(a.dataset.i))) }))
    el.querySelectorAll<HTMLTextAreaElement>('[data-json]').forEach((b) => (b.onchange = () => { try { edit(b.dataset.json!, b.value.trim() ? JSON.parse(b.value) : undefined) } catch (e) { toast(t('not JSON: {why}', { why: (e as Error).message }), 'error') } }))
    // a table read back whole on any change: its rows (a row's ×: without it)
    const table = (sel: string, read: (tb: HTMLElement) => unknown) => el.querySelectorAll<HTMLElement>(sel).forEach((tb) => {
      const k = tb.dataset.props ?? tb.dataset.makeup!
      tb.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.onchange = () => edit(k, read(tb))))
      tb.querySelectorAll<HTMLElement>('[data-row-del]').forEach((a) => (a.onclick = () => { a.closest('tr')!.remove(); edit(k, read(tb)) }))
    })
    table('[data-props]', (tb) => Object.fromEntries([...tb.querySelectorAll('tr')].map((r) => [r.querySelector<HTMLInputElement>('[data-pk]')!.value.trim(), r.querySelector<HTMLInputElement>('[data-pv]')!.value]).filter(([pk]) => pk).map(([pk, pv]) => [pk, parseValue(pv) ?? pv])))
    table('[data-makeup]', (tb) => [...tb.querySelectorAll('tr')].map((r) => ({ type: r.querySelector<HTMLInputElement>('[data-mt]')!.value.trim(), count: Math.max(1, Number(r.querySelector<HTMLInputElement>('[data-mc]')!.value) || 1) })).filter((p) => p.type))
  }

  private catalog(ctx: Ctx): Catalog {
    return { prefabs: {}, rooms: {}, blobs: {}, plain: {}, terrainObjects: {}, fixtures: {}, items: {}, creatures: {}, music: {}, ...(ctx.store.get<Catalog>('catalog.json') ?? {}) } as Catalog
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const onto = ctx.onto()
    const tabs: [Tab, string][] = [['types', t('Types')], ['statuses', t('Statuses')], ['terrains', t('Terrains')], ['recipes', t('Recipes')]]
    const ids = this.tab === 'recipes' ? [] : Object.keys(onto[this.tab]).sort()
    const listed = ids.filter((id) => !this.filter || id.includes(this.filter) || tx((onto[this.tab as Section] as Record<string, { name?: never }>)[id]?.name).toLowerCase().includes(this.filter.toLowerCase()))
    const depth = (id: string) => (this.tab === 'types' ? id.split('/').length - 1 : 0)
    left.innerHTML = `<div class="tools">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${this.tab === 'recipes' ? '' : `<input id="dbFilter" placeholder="${t('filter')}" value="${esc(this.filter)}">
      <div class="palette list" style="max-height:60vh">${listed.map((id) => `<div class="tree-row ${id === this.sel ? 'on' : ''}" data-id="${esc(id)}" role="button" tabindex="0" style="padding-left:${depth(id) * 10 + 3}px">${esc(shown((onto[this.tab as Section] as Record<string, { name?: never }>)[id]?.name) || id.split('/').pop())}<small>${esc(this.tab === 'types' ? id.split('/').pop() : id)}${entryFile(ctx.store, this.tab as Section, id) ? '' : ` · ${t('library')}`}</small></div>`).join('')}</div>
      <details><summary>${this.tab === 'types' ? t('New type') : this.tab === 'statuses' ? t('New status') : t('New terrain')}</summary>
        <label>${t('id')} <input id="dbNewId" value="${esc(this.tab === 'types' && this.sel ? this.sel + '/' : '')}"></label>
        <label>${t('name')} <input id="dbNewName"></label>
        <button id="dbNew">${t('Make it')}</button></details>`}`
    left.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => ((this.tab = b.dataset.tab as Tab), (this.sel = undefined), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-id]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.id), ctx.refresh())))
    const f = left.querySelector<HTMLInputElement>('#dbFilter')
    if (f) f.oninput = () => { this.filter = f.value; ctx.refresh(); const g = document.querySelector<HTMLInputElement>('#dbFilter'); g?.focus(); g?.setSelectionRange(f.value.length, f.value.length) }
    left.querySelector<HTMLButtonElement>('#dbNew')?.addEventListener('click', () => {
      const id = left.querySelector<HTMLInputElement>('#dbNewId')!.value.trim().replace(/\/+$/, '')
      if (!/^[a-z][a-z0-9_]*(\/[a-z0-9_]+)*$/.test(id)) return toast(t('An id: lower case words, a type\'s path by "/" (item/food/apple).'), 'warn')
      const section = this.tab as Section
      if ((onto[section] as Record<string, unknown>)[id]) return toast(t('There is {id} already.', { id }), 'warn')
      const name = left.querySelector<HTMLInputElement>('#dbNewName')!.value.trim() || id.split('/').pop()!
      // (chosen first: the edit draws the panels again)
      this.sel = id
      setEntry(ctx.store, section, { id, name } as never, t('a new entry {id}', { id }))
    })
    right.innerHTML = `<h3>${this.tab === 'types' ? t('The type tree') : tabs.find(([k]) => k === this.tab)![1]}</h3><p class="muted">${esc(this.tab === 'types' ? t('A type inherits its parent\'s tags and props (item/food/apple is an item/food, an item). Rules are written for types, never for one thing.') : this.tab === 'statuses' ? t('A status is held for a while; rules answer its gaining, losing and periods.') : this.tab === 'terrains' ? t('A cell\'s ground: a map writes it by its character (game.json terrainChars). Its things are tile/<id> to the rules.') : t('Recipes come from the types: a type with a makeup and a station is made there.'))}</p>`
  }

  focus(_ctx: Ctx, _file: string, at?: string): void {
    if (at) this.sel = at
  }
}
