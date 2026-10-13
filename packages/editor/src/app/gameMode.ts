// The Game mode (docs/engine-split.md §15, RPG Maker's System tab): what the game is — its name, version and
// seed, the engine's modules it uses, where and when a new game begins, the player, the standard library taken
// or not —; the world's parameters; its cover; the interface's words it says its own way; and every other part
// of its ontology (factions, periods, what appears by itself, thresholds, laws, materials …) and of the player's
// tables (the client/ files: item forms, recipes, skills, boons, looks), each as the project writes it beside
// what the standard library gives.

import { STDLIB_ONTOLOGY } from '@openworld/stdlib'
import { registeredModules, type FactionDef, type Text } from '@openworld/engine'
import type { GameJson, OntologyPart } from '@openworld/format'
import { STRINGS } from '@openworld/runtime/src/ui/common.ts'
import type { Ctx, Mode } from './context.ts'
import { phrase } from './lang.ts'
import { esc, t, textField, toast, tx } from './ui.ts'
import { sourceLang, together, written } from './words.ts'

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type Tab = 'game' | 'params' | 'cover' | 'words' | 'factions' | 'ontology' | 'tables'

const TABS: [Tab, string][] = [['game', phrase('The game')], ['params', phrase('World parameters')], ['cover', phrase('Cover')], ['words', phrase('Interface words')], ['factions', phrase('Factions')], ['ontology', phrase('More of the ontology')], ['tables', phrase('Player\'s tables')]]

/** The world's parameters (the engine's WorldParams), each with what it does. */
const PARAMS: [key: string, doc: string, json?: boolean][] = [
  ['recovery', phrase('The share of its makeup a thing leaves when it breaks (0–1).')],
  ['safeFall', phrase('A drop of this many levels or less does no harm.')],
  ['fallDamage', phrase('The harm of each level fallen beyond the safe height.')],
  ['reach', phrase('How far a hand or a used thing reaches when the thing does not say (cells round).')],
  ['carry', phrase('How far one takes and puts things, F and G (cells round).')],
  ['riseHour', phrase('The hour one rises after a night\'s sleep.')],
  ['rest', phrase('How much of what is missing a night\'s sleep gives back outside a room that says more (0–1).')],
  ['storeys', phrase('How many storeys may stand above the ground.')],
  ['roomSize', phrase('The largest a room may be, in cells (larger is out of doors).')],
  ['rainCost', phrase('How much longer a long step takes in rain, a storm or snow.')],
  ['spawnMax', phrase('How many things one effect may make at once (a guard; default 64).')],
  ['nightFact', phrase('The story\'s fact that lengthens the night by so many hours (none: the night keeps its length).')],
  ['slotCount', phrase('Wearing slots of a kind, where more than one: {"wear:ring": 2}.'), true],
]

/** The ontology's parts the other tabs do not edit, with what each is. */
const PARTS: [key: keyof OntologyPart & string, doc: string][] = [
  ['periods', phrase('Clocks that send time/period events to the hosts they name.')],
  ['appear', phrase('What appears by itself on any map its `where` fits (the night\'s walkers), besides each map\'s own.')],
  ['thresholds', phrase('Numeric lines that are events when a prop crosses them.')],
  ['laws', phrase('The laws a map\'s `law` names: what is forbidden there, and its fine.')],
  ['deeds', phrase('What people take as deeds, and how they judge them (the society module).')],
  ['talk', phrase('The verbs of the talk panel, each offered when its condition holds.')],
  ['social', phrase('The numbers of the people\'s social life (the society module).')],
  ['materials', phrase('The materials things are made of.')],
  ['qualities', phrase('The qualities made things have.')],
  ['sets', phrase('Sets of gear (each piece\'s `set` prop): worn together, so many pieces give each bonus.')],
  ['affixes', phrase('The small extras a piece of gear rolls as it is made: how many, and the pool they come from.')],
  ['loot', phrase('A creature kind\'s own piece (its `trophy` prop): how many fellings make it sure, and what the finder is told (the loot module).')],
  ['efficiency', phrase('How well an instrument works on a material category, by its capabilities.')],
  ['resistances', phrase('Each element\'s resistance: the stat that takes a share of its harm away.')],
  ['professions', phrase('Professions by id, for their names.')],
  ['roomRoles', phrase('What makes a room what it is (a bedroom: a bed in it), and what the role gives.')],
  ['goals', phrase('The order goals are tried in for a thing whose type does not say.')],
  ['elements', phrase('The elements.')],
  ['vfx', phrase('The effects rules may show (their pictures in the catalogue\'s Effects).')],
  ['instanceTags', phrase('Tags a thing may carry beyond its type\'s (materials, qualities).')],
  ['looks', phrase('The look table: bodies, parts and colours people are drawn from.')],
]

/** The player's tables (a bundle's `client`): what its panels show. */
const TABLES: [key: string, doc: string][] = [
  ['items', phrase('Item forms and materials by name, relics, the coin.')],
  ['crafting', phrase('Recipes, the stations\' names, the shops and their shelves, what is placed and built.')],
  ['skills', phrase('The skill tree: skills, directions, branches, professions (the classes module).')],
  ['boons', phrase('The companion\'s powers (the boons module).')],
  ['looks', phrase('The look table, the slots, the parts\' names, the player\'s first look.')],
  ['dev', phrase('The Mod Console\'s shortcuts (development only).')],
]

export class GameMode implements Mode {
  id = 'game'
  label = phrase('Game')
  private tab: Tab = 'game'
  private part: string = PARTS[0][0]
  private table: string = TABLES[0][0]
  private filter = ''

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    left.innerHTML = `<h3>${t('Game')}</h3><div class="palette">${TABS.map(([k, label]) => `<button data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${esc(t(label))}</button>`).join('')}</div>
      ${this.tab === 'ontology' ? `<h3>${t('Parts')}</h3><div class="palette list">${PARTS.map(([k]) => `<button data-part="${k}" class="${k === this.part ? 'on' : ''}">${esc(k)}</button>`).join('')}</div>` : ''}
      ${this.tab === 'tables' ? `<h3>${t('Tables')}</h3><div class="palette">${TABLES.map(([k]) => `<button data-table="${k}" class="${k === this.table ? 'on' : ''}">${esc(k)}</button>`).join('')}</div>` : ''}`
    left.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => ((this.tab = b.dataset.tab as Tab), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-part]').forEach((b) => (b.onclick = () => ((this.part = b.dataset.part!), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-table]').forEach((b) => (b.onclick = () => ((this.table = b.dataset.table!), ctx.refresh())))
    const g = ctx.store.game
    const s = ctx.store.compiled().index.stats
    right.innerHTML = `<h3>${esc(tx(g.name))}</h3><p class="muted"><code>${esc(g.id)}</code> · ${t('version {v}', { v: esc(g.version) })}</p>
      <p>${t('{maps} maps · {people} people · {creatures} creatures · {items} items ({kinds} kinds) · {fixtures} fixtures', { maps: s.maps, people: s.npcs, creatures: s.creatures, items: s.items, kinds: s.itemKinds, fixtures: s.fixtures })}</p>
      <p class="muted">${(g.modules ?? []).length ? t('Modules: {list}', { list: esc((g.modules ?? []).join(', ')) }) : t('The kernel alone: no module.')}</p>`
  }

  main(ctx: Ctx, el: HTMLElement): void {
    if (this.tab === 'game') this.gameTab(ctx, el)
    else if (this.tab === 'params') this.paramsTab(ctx, el)
    else if (this.tab === 'cover') this.coverTab(ctx, el)
    else if (this.tab === 'words') this.wordsTab(ctx, el)
    else if (this.tab === 'factions') this.factionsTab(ctx, el)
    else if (this.tab === 'ontology') this.partTab(ctx, el)
    else this.tableTab(ctx, el)
  }

  private game(ctx: Ctx, why: string, fn: (g: GameJson) => void): void {
    ctx.store.change<GameJson>('game.json', why, fn)
  }

  // ------------------------------------------------------------------ the game

  private gameTab(ctx: Ctx, el: HTMLElement): void {
    const g = ctx.store.game
    const maps = ctx.store.maps().map((m) => m.data.map)
    const mods = registeredModules()
    const on = new Set(g.modules ?? [])
    const player = g.player as { name?: Text; tags?: string[] }
    el.innerHTML = `<h3>${t('The game')}</h3>
      <div class="cols"><div>
        <label>${t('name')} ${textField('data-g="name"', g.name)}</label>
        <label>${t('id')} <input value="${esc(g.id)}" disabled> <small class="muted">${t('(its saves are kept by it)')}</small></label>
        <label>${t('version')} <input data-g="version" value="${esc(g.version)}"></label>
        <label>${t('seed')} <input type="number" data-g="seed" value="${esc(g.seed)}"> <small class="muted">${t('what every wild map and every random choice grows from')}</small></label>
        <label><input type="checkbox" data-g="stdlib" ${g.stdlib === false ? '' : 'checked'}> ${t('the standard library (the kernel\'s types, statuses and the roots of the rules)')}</label>
      </div><div>
        <h3>${t('A new game')}</h3>
        <label>${t('begins on')} <select data-g="startMap">${maps.map((m) => `<option value="${esc(m.id)}" ${m.id === g.start.map ? 'selected' : ''}>${esc(m.id)} — ${esc(tx(m.name))}</option>`).join('')}</select>
          ${t('at')} <input type="number" data-g="startX" value="${g.start.x}"> <input type="number" data-g="startY" value="${g.start.y}"></label>
        <label>${t('at the hour')} <input type="number" min="0" max="23" data-g="startHour" value="${esc(g.startHour ?? '')}" placeholder="8"></label>
        <label>${t('the world map is laid out from')} <select data-g="origin"><option value="">${t('(the start\'s map)')}</option>${maps.map((m) => `<option ${m.id === g.origin ? 'selected' : ''}>${esc(m.id)}</option>`).join('')}</select></label>
        <h3>${t('The player')}</h3>
        <label>${t('name')} ${textField('data-p="name"', player.name)}</label>
        <label>${t('tags')} <input data-p="tags" value="${esc((player.tags ?? []).join(', '))}"> <small class="muted">faction:folk …</small></label>
      </div></div>
      <h3>${t('The engine\'s modules')}</h3>
      <p class="muted">${t('The systems the game uses beyond the kernel, as RPG Maker ships its battle system: each brings its effects, conditions, goals and panels. A module a chosen one needs comes with it.')}</p>
      <div class="mods">${mods.map((m) => `<label class="mod"><input type="checkbox" data-mod="${esc(m.id)}" ${on.has(m.id) ? 'checked' : ''}><b>${esc(m.id)}</b>${m.needs?.length ? `<small>${t('needs {list}', { list: esc(m.needs.join(', ')) })}</small>` : ''}<small title="${esc((m.spec?.rules ?? []).join('\n'))}">${esc(clip((m.spec?.rules ?? [])[0] ?? `${Object.keys(m.spec?.primitives ?? {}).length} primitives, ${Object.keys(m.goals ?? {}).length} goals`, 150))}</small></label>`).join('')}</div>`
    const val = (k: string) => el.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-g="${k}"]`)!
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-g]').forEach((inp) => (inp.onchange = () => together(() => {
      const k = inp.dataset.g!
      const name = k === 'name' ? written(g.name, inp.value) : undefined
      this.game(ctx, t('the game: {field}', { field: k }), (x) => {
        if (k === 'name') x.name = name ?? x.id
        else if (k === 'version') x.version = inp.value.trim() || '1'
        else if (k === 'seed') x.seed = Number(inp.value) || 0
        else if (k === 'stdlib') (inp as HTMLInputElement).checked ? delete x.stdlib : (x.stdlib = false)
        else if (k === 'startMap' || k === 'startX' || k === 'startY') x.start = { ...x.start, map: val('startMap').value, x: Number(val('startX').value), y: Number(val('startY').value) }
        else if (k === 'startHour') inp.value === '' ? delete x.startHour : (x.startHour = Number(inp.value))
        else if (k === 'origin') inp.value ? (x.origin = inp.value) : delete x.origin
      })
    })))
    el.querySelectorAll<HTMLInputElement>('[data-p]').forEach((inp) => (inp.onchange = () => together(() => {
      const name = inp.dataset.p === 'name' ? written(player.name, inp.value) : undefined
      this.game(ctx, t('the player'), (x) => {
        const p = x.player as { name?: Text; tags?: string[] }
        if (inp.dataset.p === 'tags') p.tags = inp.value.split(',').map((y) => y.trim()).filter(Boolean)
        else if (name === undefined) delete p.name
        else p.name = name
      })
    })))
    el.querySelectorAll<HTMLInputElement>('[data-mod]').forEach((b) => (b.onchange = () => this.game(ctx, b.checked ? t('the module {id}', { id: b.dataset.mod! }) : t('no module {id}', { id: b.dataset.mod! }), (x) => {
      const want = new Set(x.modules ?? [])
      if (b.checked) want.add(b.dataset.mod!)
      else want.delete(b.dataset.mod!)
      // in the registry's order, each after what it needs (the engine orders them so too); one this editor does not know is kept
      x.modules = [...mods.map((m) => m.id).filter((id) => want.has(id)), ...[...want].filter((id) => !mods.some((m) => m.id === id))]
    })))
  }

  // ------------------------------------------------------------------ the world's parameters

  private paramsTab(ctx: Ctx, el: HTMLElement): void {
    const own = (ctx.store.game.params ?? {}) as Record<string, unknown>
    const all = (ctx.onto().params ?? {}) as unknown as Record<string, unknown>
    el.innerHTML = `<h3>${t('World parameters')}</h3><p class="muted">${t('The numbers the engine runs the world by. A value here is the game\'s own (game.json); an empty one takes what the ontology gives (shown).')}</p>
      <table class="sched params">${PARAMS.map(([k, doc, json]) => `<tr><td><b>${esc(k)}</b><br><small class="muted">${esc(t(doc))}</small></td><td><input data-k="${esc(k)}" ${json ? 'class="wide"' : ''} value="${esc(own[k] === undefined ? '' : json ? JSON.stringify(own[k]) : own[k])}" placeholder="${esc(all[k] === undefined ? '—' : json ? JSON.stringify(all[k]) : all[k])}"></td></tr>`).join('')}</table>`
    el.querySelectorAll<HTMLInputElement>('[data-k]').forEach((inp) => (inp.onchange = () => {
      const k = inp.dataset.k!
      const json = PARAMS.find((p) => p[0] === k)?.[2]
      let v: unknown = inp.value.trim()
      try {
        if (v !== '' && json) v = JSON.parse(v as string)
        else if (v !== '' && k !== 'nightFact') v = Number(v)
      } catch {
        return toast(t('{key}: not JSON', { key: k }), 'error')
      }
      if (typeof v === 'number' && Number.isNaN(v)) return toast(t('{key}: a number', { key: k }), 'warn')
      this.game(ctx, t('the parameter {key}', { key: k }), (x) => {
        const p = (x.params ??= {} as GameJson['params']) as Record<string, unknown>
        if (v === '') delete p[k]
        else p[k] = v
      })
    }))
  }

  // ------------------------------------------------------------------ the player's tables (client/)

  /** The client file that has a table (or the one it would go in). */
  private clientFile(ctx: Ctx, key: string): string {
    return ctx.store.list<Record<string, unknown>>('client').find((f) => key in f.data)?.file ?? `client/${key}.json`
  }
  private client<T>(ctx: Ctx, key: string): T | undefined {
    return ctx.store.list<Record<string, unknown>>('client').find((f) => key in f.data)?.data[key] as T | undefined
  }
  private setClient(ctx: Ctx, key: string, why: string, value: unknown): void {
    const file = this.clientFile(ctx, key)
    if (!ctx.store.get(file)) return ctx.store.add(file, { [key]: value }, why)
    ctx.store.change<Record<string, unknown>>(file, why, (d) => (value === undefined ? delete d[key] : (d[key] = value)))
  }

  private coverTab(ctx: Ctx, el: HTMLElement): void {
    const c = (this.client<Record<string, unknown>>(ctx, 'cover') ?? {}) as { title?: Text; kicker?: Text; subtitle?: Text; credit?: Text | false; tutorial?: boolean; art?: boolean; companion?: boolean | string }
    const line = (k: 'title' | 'kicker' | 'subtitle', hint: string) => `<label>${esc(hint)} ${textField(`data-c="${k}"`, c[k])}</label>`
    el.innerHTML = `<h3>${t('The cover')}</h3><p class="muted">${t('The title screen: what it says, what it offers. Written in {file}.', { file: `<code>${esc(this.clientFile(ctx, 'cover'))}</code>` })}</p>
      ${line('title', t('title (default: the game\'s name)'))}${line('kicker', t('the line above it'))}${line('subtitle', t('the line below it'))}
      <label>${t('credits at its foot')} ${textField('data-c="credit"', c.credit === false ? undefined : c.credit, { placeholder: 'Art & music: Ninja Adventure (CC0)' })}</label>
      <label><input type="checkbox" data-c="nocredit" ${c.credit === false ? 'checked' : ''}> ${t('no credits line')}</label>
      <label><input type="checkbox" data-c="tutorial" ${c.tutorial ? 'checked' : ''}> ${t('a tutorial run (the world has a start named {name})', { name: '<code>tutorial</code>' })}</label>
      <label><input type="checkbox" data-c="art" ${c.art ? 'checked' : ''}> ${t('the mountain at dawn behind the title')}</label>
      <label>${t('a companion flying across: its sheet')} <input data-c="companion" value="${esc(typeof c.companion === 'string' ? c.companion : '')}" placeholder="${t('own/companion.png (in the game\'s assets)')}"></label>`
    el.querySelectorAll<HTMLInputElement>('[data-c]').forEach((inp) => (inp.onchange = () => together(() => {
      const next = structuredClone(c) as Record<string, unknown>
      const k = inp.dataset.c!
      if (k === 'title' || k === 'kicker' || k === 'subtitle') next[k] = written(c[k], inp.value)
      else if (k === 'credit') next.credit = written(c.credit || undefined, inp.value)
      else if (k === 'nocredit') next.credit = inp.checked ? false : undefined
      else if (k === 'companion') next.companion = inp.value.trim() || undefined
      else next[k] = inp.checked || undefined
      for (const x of Object.keys(next)) if (next[x] === undefined) delete next[x]
      this.setClient(ctx, 'cover', t('the cover: {field}', { field: k }), Object.keys(next).length ? next : undefined)
    })))
  }

  private wordsTab(ctx: Ctx, el: HTMLElement): void {
    const own = this.client<Record<string, Text>>(ctx, 'texts') ?? {}
    const q = this.filter.toLowerCase()
    const keys = Object.keys(STRINGS).filter((k) => !q || k.toLowerCase().includes(q) || STRINGS[k].some((w) => w.toLowerCase().includes(q)) || tx(own[k]).toLowerCase().includes(q))
    // the engine's own words for a key, in the language the game is written in (English where it has none)
    const theirs = (k: string) => STRINGS[k][sourceLang() === 'zh' ? 1 : 0]
    el.innerHTML = `<h3>${t('Interface words')}</h3><p class="muted">${t('What the player\'s panels say, by key: write the game\'s own words over the engine\'s (a module\'s panel speaking of your game\'s people and places), in the game\'s language; they are translated with the rest of its words. {own} of {all} are the game\'s own.', { own: Object.keys(own).length, all: Object.keys(STRINGS).length })}</p>
      <input id="wdFilter" placeholder="${t('filter (a key, or words)')}" value="${esc(this.filter)}">
      <table class="sched words">${keys.slice(0, 150).map((k) => `<tr><td><code>${esc(k)}</code><br><small class="muted">${esc(theirs(k))}</small></td><td>${textField(`data-w="${esc(k)}"`, own[k], { placeholder: theirs(k) })}</td></tr>`).join('')}</table>
      ${keys.length > 150 ? `<p class="muted">${t('{n} more: narrow the filter.', { n: keys.length - 150 })}</p>` : ''}`
    const f = el.querySelector<HTMLInputElement>('#wdFilter')!
    f.oninput = () => { this.filter = f.value; this.wordsTab(ctx, el); el.querySelector<HTMLInputElement>('#wdFilter')!.focus() }
    el.querySelectorAll<HTMLInputElement>('[data-w]').forEach((inp) => (inp.onchange = () => together(() => {
      const k = inp.dataset.w!
      const next = { ...own }
      const v = written(own[k], inp.value)
      if (v === undefined) delete next[k]
      else next[k] = v
      this.setClient(ctx, 'texts', t('the words: {key}', { key: k }), Object.keys(next).length ? next : undefined)
    })))
  }

  // ------------------------------------------------------------------ the ontology's other parts

  /** The project's file that writes a part of the ontology (or where it would go). */
  private ontoFile(ctx: Ctx, key: string): string {
    const files = ctx.store.list<OntologyPart>('ontology')
    return files.find((f) => (f.data as Record<string, unknown>)[key] !== undefined)?.file ?? files.find((f) => f.file === 'ontology/world.json')?.file ?? 'ontology/world.json'
  }
  private setOnto(ctx: Ctx, key: string, why: string, value: unknown): void {
    const file = this.ontoFile(ctx, key)
    if (!ctx.store.get(file)) return void (value !== undefined && ctx.store.add(file, { [key]: value }, why))
    ctx.store.change<Record<string, unknown>>(file, why, (d) => (value === undefined ? delete d[key] : (d[key] = value)))
  }

  private factionsTab(ctx: Ctx, el: HTMLElement): void {
    const file = this.ontoFile(ctx, 'factions')
    const own = ((ctx.store.get<Record<string, unknown>>(file) ?? {}).factions ?? {}) as Record<string, FactionDef>
    const all = ctx.onto().factions ?? {}
    const ids = Object.keys(all)
    el.innerHTML = `<h3>${t('Factions')}</h3><p class="muted">${t('An actor belongs to those its {tag} tags name; its members attack those it is hostile to, on sight, when their temper says so. Written in {file}.', { tag: '<code>faction:&lt;id&gt;</code>', file: `<code>${esc(file)}</code>` })}</p>
      <div class="factions">${ids.map((id) => `<div class="box faction"><div class="row"><b>${esc(id)}</b>${own[id] ? '' : ` <small class="muted">${t('(the library\'s)')}</small>`}<span class="grow"></span>${own[id] ? `<a class="x" data-fdel="${esc(id)}">${t('remove')}</a>` : ''}</div>
        <div class="row">${textField(`data-fn="${esc(id)}"`, all[id].name, { placeholder: t('name') })}</div>
        <div class="chips"><span class="muted">${t('attacks on sight:')}</span> ${ids.filter((x) => x !== id).map((x) => `<label class="chip"><input type="checkbox" data-fh="${esc(id)}" value="${esc(x)}" ${all[id].hostile?.includes(x) ? 'checked' : ''}>${esc(x)}</label>`).join('') || '—'}</div></div>`).join('')}</div>
      <div class="row"><input id="fnNew" placeholder="${t('a new faction\'s id (bandits)')}"><button id="fnMake">${t('New faction')}</button></div>`
    const write = (id: string, why: string, fn: (f: FactionDef) => void) => {
      const next = structuredClone(own)
      next[id] = structuredClone(next[id] ?? all[id] ?? {})
      fn(next[id])
      this.setOnto(ctx, 'factions', why, next)
    }
    el.querySelectorAll<HTMLInputElement>('[data-fn]').forEach((inp) => (inp.onchange = () => together(() => {
      const id = inp.dataset.fn!
      const name = written(all[id]?.name, inp.value) ?? id
      write(id, t('the faction {id}: its name', { id }), (f) => (f.name = name))
    })))
    el.querySelectorAll<HTMLInputElement>('[data-fh]').forEach((b) => (b.onchange = () => write(b.dataset.fh!, t('the faction {id}: whom it attacks', { id: b.dataset.fh! }), (f) => {
      const h = new Set(f.hostile ?? [])
      if (b.checked) h.add(b.value)
      else h.delete(b.value)
      f.hostile = [...h]
    })))
    el.querySelectorAll<HTMLElement>('[data-fdel]').forEach((a) => (a.onclick = () => {
      const next = structuredClone(own)
      delete next[a.dataset.fdel!]
      this.setOnto(ctx, 'factions', t('no faction {id}', { id: a.dataset.fdel! }), Object.keys(next).length ? next : undefined)
    }))
    el.querySelector<HTMLButtonElement>('#fnMake')!.onclick = () => {
      const id = el.querySelector<HTMLInputElement>('#fnNew')!.value.trim()
      if (!/^[a-z][a-z0-9_-]*$/.test(id)) return toast(t('A faction\'s id: lower case letters, digits, _ and -.'), 'warn')
      if (all[id]) return toast(t('There is a faction {id} already.', { id }), 'warn')
      write(id, t('a new faction {id}', { id }), (f) => (f.name = id))
    }
  }

  /** A part of the ontology as JSON: the project's own (edited), the library's beside it, what the game gets. */
  private partTab(ctx: Ctx, el: HTMLElement): void {
    const key = this.part
    const doc = PARTS.find((p) => p[0] === key)?.[1] ?? ''
    const file = this.ontoFile(ctx, key)
    const own = (ctx.store.get<Record<string, unknown>>(file) ?? {})[key]
    const lib = ctx.store.game.stdlib === false ? undefined : (STDLIB_ONTOLOGY as Record<string, unknown>)[key]
    const merged = (ctx.onto() as unknown as Record<string, unknown>)[key]
    el.innerHTML = `<h3>${esc(key)}</h3><p class="muted">${esc(t(doc))} ${t('The project\'s part is in {file}; the compiler puts it over the standard library\'s.', { file: `<code>${esc(file)}</code>` })}</p>
      <div class="cols"><div><h3>${t('The project\'s')}</h3><textarea id="ptJson" rows="22" placeholder="${t('(none)')}">${esc(own === undefined ? '' : JSON.stringify(own, null, 2))}</textarea><button id="ptApply">${t('Apply')}</button> <small class="muted">${t('empty: none of the project\'s own')}</small></div>
      <div><h3>${t('The standard library\'s')}</h3><pre class="json">${esc(lib === undefined ? t('(none)') : JSON.stringify(lib, null, 2))}</pre>
      <h3>${t('What the game gets')}</h3><pre class="json">${esc(merged === undefined ? t('(none)') : JSON.stringify(merged, null, 2))}</pre></div></div>`
    el.querySelector<HTMLButtonElement>('#ptApply')!.onclick = () => {
      const text = el.querySelector<HTMLTextAreaElement>('#ptJson')!.value.trim()
      try {
        this.setOnto(ctx, key, t('the ontology\'s {key}', { key }), text ? JSON.parse(text) : undefined)
      } catch (e) {
        toast(t('not JSON: {why}', { why: (e as Error).message }), 'error')
      }
    }
  }

  private tableTab(ctx: Ctx, el: HTMLElement): void {
    const key = this.table
    const doc = TABLES.find((p) => p[0] === key)?.[1] ?? ''
    const v = this.client<unknown>(ctx, key)
    el.innerHTML = `<h3>${esc(key)}</h3><p class="muted">${esc(t(doc))} ${t('In {file}: the player\'s panels read it (the engine does not).', { file: `<code>${esc(this.clientFile(ctx, key))}</code>` })}</p>
      <textarea id="tbJson" rows="28" placeholder="${t('(none)')}">${esc(v === undefined ? '' : JSON.stringify(v, null, 2))}</textarea><button id="tbApply">${t('Apply')}</button>`
    el.querySelector<HTMLButtonElement>('#tbApply')!.onclick = () => {
      const text = el.querySelector<HTMLTextAreaElement>('#tbJson')!.value.trim()
      try {
        this.setClient(ctx, key, t('the table {key}', { key }), text ? JSON.parse(text) : undefined)
      } catch (e) {
        toast(t('not JSON: {why}', { why: (e as Error).message }), 'error')
      }
    }
  }
}
