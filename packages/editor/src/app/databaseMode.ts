// The database (docs/engine-split.md §6, RPG Maker's database): the type tree — every kind of thing, item, actor
// and fixture, each inheriting its parent's tags and props —, the statuses, the terrains with the character a
// map writes them by, and the recipes the types' makeup gives. A type the project does not write is the
// standard library's; changing it writes the project's own over it.

import { OntologyIndex, deriveRecipes, type StatusDef, type TerrainDef, type TypeDef } from '@openworld/engine'
import type { Ctx, Mode } from './context.ts'
import { entryFile, removeEntry, setEntry, type Section } from './ontologyFiles.ts'
import { phrase } from './lang.ts'
import { esc, parseValue, t, textField, toast, tx } from './ui.ts'
import { together, written } from './words.ts'

type Tab = 'types' | 'statuses' | 'terrains' | 'recipes'

/** The fields each kind of entry is edited by (the rest in its JSON). */
const FIELDS: Record<Section, [key: string, hint: string][]> = {
  types: [['tags', phrase('tags, comma separated')], ['props', phrase('props (JSON: {"hp": 10})')], ['sprite', phrase('sprite key (item:axe)')], ['solid', phrase('solid (true/false)')], ['makeup', phrase('makeup (JSON: [{"type": "item/material/log", "count": 2}])')], ['station', phrase('made at (hands, or a station)')], ['tools', phrase('tools its making needs (comma separated)')], ['yields', phrase('how many one making gives')], ['stage', phrase('stage (JSON: {"into": "…", "lasts": 9600})')]],
  statuses: [['duration', phrase('ticks (none: until removed)')], ['clears', phrase('statuses it clears (comma separated)')], ['wards', phrase('statuses it wards off')], ['immobilize', phrase('holds still (true/false)')], ['moveDelay', phrase('step slower by (×)')], ['every', phrase('ticks between its periods')], ['overlay', phrase('picture drawn over it (fire, wet, ice …)')], ['props', phrase('what it adds to its holder (JSON)')]],
  terrains: [['tags', phrase('tags, comma separated')], ['solid', phrase('solid (true/false)')], ['liquid', phrase('liquid (true/false)')], ['space', phrase('its space (floor, soil, volume)')], ['color', phrase('colour (#rrggbb)')], ['props', phrase('props (JSON)')], ['makeup', phrase('makeup (JSON)')], ['stage', phrase('stage (JSON)')]],
}
const LISTS = new Set(['tags', 'clears', 'wards', 'tools'])

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
    el.innerHTML = `<h3>${esc(def.id)}</h3>
      <p class="muted">${file ? t('written in {file}', { file: `<code>${esc(file)}</code>` }) : t('the standard library\'s: a change writes the project\'s own over it')}</p>
      <div class="cols"><div>
        <label>${t('name')} ${textField('data-f="name"', def.name)}</label>
        ${FIELDS[section].map(([k, hint]) => `<label>${esc(t(hint))} <input data-f="${k}" value="${esc(fieldText(own[k], LISTS.has(k)))}"></label>`).join('')}
        ${section === 'terrains' ? `<label>${t('map character')} <input data-f="char" maxlength="1" value="${esc(chars[0] ?? '')}"></label>` : ''}
        ${section === 'types' && (def as TypeDef).sprite ? `<p><a id="dbPic">${t('The picture of {sprite} →', { sprite: esc((def as TypeDef).sprite) })}</a></p>` : ''}
        <button id="dbDel" class="danger" ${file ? '' : 'disabled'}>${t('Remove {id}', { id: esc(def.id) })}${file ? '' : ` ${t('(the library\'s)')}`}</button>
      </div><div>
        <h3>JSON</h3><textarea id="dbJson" rows="16">${esc(JSON.stringify(def, null, 2))}</textarea><button id="dbApply">${t('Apply the JSON')}</button>
        ${resolved ? `<h3>${t('As the world sees it')}</h3><p class="muted">${t('tags')}</p><p>${esc([...resolved.tags].join(', ') || '—')}</p><p class="muted">${t('props')}</p><p><code>${esc(JSON.stringify(resolved.props))}</code></p>` : ''}
        <h3>${t('Rules on it')}</h3><ul class="things">${ctx.store.compiled().bundle.rules.filter((r) => r.host?.type && (r.host.type === def.id || def.id.startsWith(r.host.type + '/'))).map((r) => `<li><a data-rule="${esc(r.id)}">${esc(r.id)}</a> <small>${esc(r.on)}${r.host?.type === def.id ? '' : ` · ${t('{type}\'s', { type: esc(r.host?.type) })}`}</small></li>`).join('') || `<li class="muted">${t('none of its own')}</li>`}</ul>
      </div></div>`
    const write = (d: Record<string, unknown>, why: string) => setEntry(ctx.store, section, d as never, why)
    el.querySelectorAll<HTMLInputElement>('[data-f]').forEach((inp) => (inp.onchange = () => together(() => {
      const k = inp.dataset.f!
      const d = structuredClone(def) as unknown as Record<string, unknown>
      if (k === 'name') d.name = written(def.name, inp.value) ?? def.id.split('/').pop()
      else if (k === 'char') {
        const c = inp.value
        if (c.length !== 1) return toast(t('A map writes a terrain by one character.'), 'warn')
        const taken = ctx.store.game.terrainChars[c]
        if (taken && taken !== def.id) return toast(t('"{c}" is {taken}\'s already.', { c, taken }), 'warn')
        return ctx.store.change('game.json', t('{id} is "{c}"', { id: def.id, c }), (g: { terrainChars: Record<string, string> }) => { for (const [x, y] of Object.entries(g.terrainChars)) if (y === def.id) delete g.terrainChars[x]; g.terrainChars[c] = def.id })
      } else {
        const v = LISTS.has(k) ? inp.value.split(',').map((x) => x.trim()).filter(Boolean) : parseValue(inp.value)
        if (v === undefined || (Array.isArray(v) && !v.length)) delete d[k]
        else d[k] = v
      }
      write(d, `${def.id}: ${k}`)
    })))
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

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const onto = ctx.onto()
    const tabs: [Tab, string][] = [['types', t('Types')], ['statuses', t('Statuses')], ['terrains', t('Terrains')], ['recipes', t('Recipes')]]
    const ids = this.tab === 'recipes' ? [] : Object.keys(onto[this.tab]).sort()
    const shown = ids.filter((id) => !this.filter || id.includes(this.filter) || tx((onto[this.tab as Section] as Record<string, { name?: never }>)[id]?.name).toLowerCase().includes(this.filter.toLowerCase()))
    const depth = (id: string) => (this.tab === 'types' ? id.split('/').length - 1 : 0)
    left.innerHTML = `<div class="tools">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${this.tab === 'recipes' ? '' : `<input id="dbFilter" placeholder="${t('filter')}" value="${esc(this.filter)}">
      <div class="palette list" style="max-height:60vh">${shown.map((id) => `<div class="tree-row ${id === this.sel ? 'on' : ''}" data-id="${esc(id)}" style="padding-left:${depth(id) * 10 + 3}px">${esc(this.tab === 'types' ? id.split('/').pop() : id)}<small>${esc(tx((onto[this.tab as Section] as Record<string, { name?: never }>)[id]?.name))}${entryFile(ctx.store, this.tab as Section, id) ? '' : ` · ${t('library')}`}</small></div>`).join('')}</div>
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

const fieldText = (v: unknown, list: boolean): string => (v === undefined ? '' : list && Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : JSON.stringify(v))
