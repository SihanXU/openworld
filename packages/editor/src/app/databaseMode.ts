// The database (docs/engine-split.md §6, RPG Maker's database): the type tree — every kind of thing, item, actor
// and fixture, each inheriting its parent's tags and props —, the statuses, the terrains with the character a
// map writes them by, and the recipes the types' makeup gives. A type the project does not write is the
// standard library's; changing it writes the project's own over it.

import { OntologyIndex, deriveRecipes, type StatusDef, type TerrainDef, type TypeDef } from '@openworld/engine'
import type { Ctx, Mode } from './context.ts'
import { entryFile, removeEntry, setEntry, type Section } from './ontologyFiles.ts'
import { enOf, esc, parseValue, textOf, toast, tx, zhOf } from './ui.ts'

type Tab = 'types' | 'statuses' | 'terrains' | 'recipes'

/** The fields each kind of entry is edited by (the rest in its JSON). */
const FIELDS: Record<Section, [key: string, hint: string][]> = {
  types: [['tags', 'tags, comma separated'], ['props', 'props (JSON: {"hp": 10})'], ['sprite', 'sprite key (item:axe)'], ['solid', 'solid (true/false)'], ['makeup', 'makeup (JSON: [{"type": "item/material/log", "count": 2}])'], ['station', 'made at (hands, or a station)'], ['tools', 'tools its making needs (comma separated)'], ['yields', 'how many one making gives'], ['stage', 'stage (JSON: {"into": "…", "lasts": 9600})']],
  statuses: [['duration', 'ticks (none: until removed)'], ['clears', 'statuses it clears (comma separated)'], ['wards', 'statuses it wards off'], ['immobilize', 'holds still (true/false)'], ['moveDelay', 'step slower by (×)'], ['every', 'ticks between its periods'], ['overlay', 'picture drawn over it (fire, wet, ice …)'], ['props', 'what it adds to its holder (JSON)']],
  terrains: [['tags', 'tags, comma separated'], ['solid', 'solid (true/false)'], ['liquid', 'liquid (true/false)'], ['space', 'its space (floor, soil, volume)'], ['color', 'colour (#rrggbb)'], ['props', 'props (JSON)'], ['makeup', 'makeup (JSON)'], ['stage', 'stage (JSON)']],
}
const LISTS = new Set(['tags', 'clears', 'wards', 'tools'])

export class DatabaseMode implements Mode {
  id = 'database'
  label = 'Database'
  private tab: Tab = 'types'
  private sel?: string
  private filter = ''

  main(ctx: Ctx, el: HTMLElement): void {
    const onto = ctx.onto()
    if (this.tab === 'recipes') {
      const recipes = deriveRecipes(new OntologyIndex(onto))
      el.innerHTML = `<h3>Recipes</h3><p class="muted">What the types' makeup gives (a type made at a station from what it is made of): change one in its type.</p>
        <table class="sched"><tr><th>makes</th><th>from</th><th>at</th></tr>${recipes.map((r) => `<tr><td><a data-type="${esc(r.make.type)}">${esc(r.make.type)}</a>${(r.count ?? 1) > 1 ? ` ×${r.count}` : ''}</td><td>${esc(r.needs.map((n) => `${n.count} ${n.type}`).join(', '))}</td><td>${esc(r.station)}</td></tr>`).join('') || '<tr><td class="muted">No type has a makeup and a station yet.</td></tr>'}</table>`
      el.querySelectorAll<HTMLElement>('[data-type]').forEach((a) => (a.onclick = () => ((this.tab = 'types'), (this.sel = a.dataset.type), ctx.refresh())))
      return
    }
    const section = this.tab
    const all = onto[section] as Record<string, TypeDef | StatusDef | TerrainDef>
    const def = this.sel ? all[this.sel] : undefined
    if (!def) return void (el.innerHTML = `<p class="muted">Choose one on the left, or make a new one.</p>`)
    const file = entryFile(ctx.store, section, def.id)
    const own = { ...def } as Record<string, unknown>
    const resolved = section === 'types' ? new OntologyIndex(onto).resolve(def.id) : undefined
    const chars = Object.entries(ctx.store.game.terrainChars).filter(([, t]) => t === def.id).map(([c]) => c)
    el.innerHTML = `<h3>${esc(def.id)}</h3>
      <p class="muted">${file ? `written in <code>${esc(file)}</code>` : 'the standard library\'s: a change writes the project\'s own over it'}</p>
      <div class="cols"><div>
        <label>name <input data-f="en" value="${esc(enOf(def.name))}"> <input data-f="zh" value="${esc(zhOf(def.name))}"></label>
        ${FIELDS[section].map(([k, hint]) => `<label>${esc(hint)} <input data-f="${k}" value="${esc(fieldText(own[k], LISTS.has(k)))}"></label>`).join('')}
        ${section === 'terrains' ? `<label>map character <input data-f="char" maxlength="1" value="${esc(chars[0] ?? '')}"></label>` : ''}
        <button id="dbDel" class="danger" ${file ? '' : 'disabled'}>Remove ${esc(def.id)}${file ? '' : ' (the library\'s)'}</button>
      </div><div>
        <h3>JSON</h3><textarea id="dbJson" rows="16">${esc(JSON.stringify(def, null, 2))}</textarea><button id="dbApply">Apply the JSON</button>
        ${resolved ? `<h3>As the world sees it</h3><p class="muted">tags</p><p>${esc([...resolved.tags].join(', ') || '—')}</p><p class="muted">props</p><p><code>${esc(JSON.stringify(resolved.props))}</code></p>` : ''}
        <h3>Rules on it</h3><ul class="things">${ctx.store.compiled().bundle.rules.filter((r) => r.host?.type && (r.host.type === def.id || def.id.startsWith(r.host.type + '/'))).map((r) => `<li><a data-rule="${esc(r.id)}">${esc(r.id)}</a> <small>${esc(r.on)}${r.host?.type === def.id ? '' : ` · ${esc(r.host?.type)}'s`}</small></li>`).join('') || '<li class="muted">none of its own</li>'}</ul>
      </div></div>`
    const write = (d: Record<string, unknown>, why: string) => setEntry(ctx.store, section, d as never, why)
    el.querySelectorAll<HTMLInputElement>('[data-f]').forEach((inp) => (inp.onchange = () => {
      const k = inp.dataset.f!
      const d = structuredClone(def) as unknown as Record<string, unknown>
      if (k === 'en' || k === 'zh') d.name = textOf(k === 'en' ? inp.value : enOf(def.name), k === 'zh' ? inp.value : zhOf(def.name))
      else if (k === 'char') {
        const c = inp.value
        if (c.length !== 1) return toast('A map writes a terrain by one character.', 'warn')
        const taken = ctx.store.game.terrainChars[c]
        if (taken && taken !== def.id) return toast(`"${c}" is ${taken}'s already.`, 'warn')
        return ctx.store.change('game.json', `${def.id} is "${c}"`, (g: { terrainChars: Record<string, string> }) => { for (const [x, t] of Object.entries(g.terrainChars)) if (t === def.id) delete g.terrainChars[x]; g.terrainChars[c] = def.id })
      } else {
        const v = LISTS.has(k) ? inp.value.split(',').map((t) => t.trim()).filter(Boolean) : parseValue(inp.value)
        if (v === undefined || (Array.isArray(v) && !v.length)) delete d[k]
        else d[k] = v
      }
      write(d, `${def.id}: ${k}`)
    }))
    el.querySelector<HTMLButtonElement>('#dbApply')!.onclick = () => {
      try {
        const d = JSON.parse(el.querySelector<HTMLTextAreaElement>('#dbJson')!.value) as Record<string, unknown>
        if (d.id !== def.id) return toast('The JSON keeps its id (make a new one for another).', 'warn')
        write(d, `${def.id}: its JSON`)
      } catch (e) {
        toast(`Not JSON: ${(e as Error).message}`, 'error')
      }
    }
    el.querySelector<HTMLButtonElement>('#dbDel')!.onclick = () => (removeEntry(ctx.store, section, def.id, `remove ${def.id}`), (this.sel = undefined))
    el.querySelectorAll<HTMLElement>('[data-rule]').forEach((a) => (a.onclick = () => ctx.open('rules', undefined, a.dataset.rule)))
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const onto = ctx.onto()
    const tabs: [Tab, string][] = [['types', 'Types'], ['statuses', 'Statuses'], ['terrains', 'Terrains'], ['recipes', 'Recipes']]
    const ids = this.tab === 'recipes' ? [] : Object.keys(onto[this.tab]).sort()
    const shown = ids.filter((id) => !this.filter || id.includes(this.filter) || tx((onto[this.tab as Section] as Record<string, { name?: never }>)[id]?.name).toLowerCase().includes(this.filter.toLowerCase()))
    const depth = (id: string) => (this.tab === 'types' ? id.split('/').length - 1 : 0)
    left.innerHTML = `<div class="tools">${tabs.map(([t, n]) => `<button data-tab="${t}" class="${t === this.tab ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${this.tab === 'recipes' ? '' : `<input id="dbFilter" placeholder="filter" value="${esc(this.filter)}">
      <div class="palette list" style="max-height:60vh">${shown.map((id) => `<div class="tree-row ${id === this.sel ? 'on' : ''}" data-id="${esc(id)}" style="padding-left:${depth(id) * 10 + 3}px">${esc(this.tab === 'types' ? id.split('/').pop() : id)}<small>${esc(tx((onto[this.tab as Section] as Record<string, { name?: never }>)[id]?.name))}${entryFile(ctx.store, this.tab as Section, id) ? '' : ' · library'}</small></div>`).join('')}</div>
      <details><summary>New ${this.tab === 'types' ? 'type' : this.tab === 'statuses' ? 'status' : 'terrain'}</summary>
        <label>id <input id="dbNewId" value="${esc(this.tab === 'types' && this.sel ? this.sel + '/' : '')}"></label>
        <label>name <input id="dbNewEn"> <input id="dbNewZh"></label>
        <button id="dbNew">Make it</button></details>`}`
    left.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => ((this.tab = b.dataset.tab as Tab), (this.sel = undefined), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-id]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.id), ctx.refresh())))
    const f = left.querySelector<HTMLInputElement>('#dbFilter')
    if (f) f.oninput = () => { this.filter = f.value; ctx.refresh(); const g = document.querySelector<HTMLInputElement>('#dbFilter'); g?.focus(); g?.setSelectionRange(f.value.length, f.value.length) }
    left.querySelector<HTMLButtonElement>('#dbNew')?.addEventListener('click', () => {
      const id = left.querySelector<HTMLInputElement>('#dbNewId')!.value.trim().replace(/\/+$/, '')
      if (!/^[a-z][a-z0-9_]*(\/[a-z0-9_]+)*$/.test(id)) return toast('An id: lower case words, a type\'s path by "/" (item/food/apple).', 'warn')
      const section = this.tab as Section
      if ((onto[section] as Record<string, unknown>)[id]) return toast(`There is ${id} already.`, 'warn')
      const name = textOf(left.querySelector<HTMLInputElement>('#dbNewEn')!.value || id.split('/').pop()!, left.querySelector<HTMLInputElement>('#dbNewZh')!.value)
      // (chosen first: the edit draws the panels again)
      this.sel = id
      setEntry(ctx.store, section, { id, name } as never, `a new ${section.slice(0, -1)} ${id}`)
    })
    right.innerHTML = `<h3>${this.tab === 'types' ? 'The type tree' : this.tab}</h3><p class="muted">${this.tab === 'types' ? 'A type inherits its parent\'s tags and props (item/food/apple is an item/food, an item). Rules are written for types, never for one thing.' : this.tab === 'statuses' ? 'A status is held for a while; rules answer its gaining, losing and periods.' : this.tab === 'terrains' ? 'A cell\'s ground: a map writes it by its character (game.json terrainChars). Its things are tile/<id> to the rules.' : 'Recipes come from the types: a type with a makeup and a station is made there.'}</p>`
  }

  focus(_ctx: Ctx, _file: string, at?: string): void {
    if (at) this.sel = at
  }
}

const fieldText = (v: unknown, list: boolean): string => (v === undefined ? '' : list && Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : JSON.stringify(v))
