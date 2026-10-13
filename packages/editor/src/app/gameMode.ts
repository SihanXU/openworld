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
import { enOf, esc, textOf, toast, tx, zhOf } from './ui.ts'

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type Tab = 'game' | 'params' | 'cover' | 'words' | 'factions' | 'ontology' | 'tables'

const TABS: [Tab, string][] = [['game', 'The game'], ['params', 'World parameters'], ['cover', 'Cover'], ['words', 'Interface words'], ['factions', 'Factions'], ['ontology', 'More of the ontology'], ['tables', 'Player\'s tables']]

/** The world's parameters (the engine's WorldParams), each with what it does. */
const PARAMS: [key: string, doc: string, json?: boolean][] = [
  ['recovery', 'The share of its makeup a thing leaves when it breaks (0–1).'],
  ['safeFall', 'A drop of this many levels or less does no harm.'],
  ['fallDamage', 'The harm of each level fallen beyond the safe height.'],
  ['reach', 'How far a hand or a used thing reaches when the thing does not say (cells round).'],
  ['carry', 'How far one takes and puts things, F and G (cells round).'],
  ['riseHour', 'The hour one rises after a night\'s sleep.'],
  ['rest', 'How much of what is missing a night\'s sleep gives back outside a room that says more (0–1).'],
  ['storeys', 'How many storeys may stand above the ground.'],
  ['roomSize', 'The largest a room may be, in cells (larger is out of doors).'],
  ['rainCost', 'How much longer a long step takes in rain, a storm or snow.'],
  ['spawnMax', 'How many things one effect may make at once (a guard; default 64).'],
  ['nightFact', 'The story\'s fact that lengthens the night by so many hours (none: the night keeps its length).'],
  ['slotCount', 'Wearing slots of a kind, where more than one: {"wear:ring": 2}.', true],
]

/** The ontology's parts the other tabs do not edit, with what each is. */
const PARTS: [key: keyof OntologyPart & string, doc: string][] = [
  ['periods', 'Clocks that send time/period events to the hosts they name.'],
  ['appear', 'What appears by itself on any map its `where` fits (the night\'s walkers), besides each map\'s own.'],
  ['thresholds', 'Numeric lines that are events when a prop crosses them.'],
  ['laws', 'The laws a map\'s `law` names: what is forbidden there, and its fine.'],
  ['deeds', 'What people take as deeds, and how they judge them (the society module).'],
  ['talk', 'The verbs of the talk panel, each offered when its condition holds.'],
  ['social', 'The numbers of the people\'s social life (the society module).'],
  ['materials', 'The materials things are made of.'],
  ['qualities', 'The qualities made things have.'],
  ['sets', 'Sets of gear (each piece\'s `set` prop): worn together, so many pieces give each bonus.'],
  ['affixes', 'The small extras a piece of gear rolls as it is made: how many, and the pool they come from.'],
  ['loot', 'A creature kind\'s own piece (its `trophy` prop): how many fellings make it sure, and what the finder is told (the loot module).'],
  ['efficiency', 'How well an instrument works on a material category, by its capabilities.'],
  ['resistances', 'Each element\'s resistance: the stat that takes a share of its harm away.'],
  ['professions', 'Professions by id, for their names.'],
  ['roomRoles', 'What makes a room what it is (a bedroom: a bed in it), and what the role gives.'],
  ['goals', 'The order goals are tried in for a thing whose type does not say.'],
  ['elements', 'The elements.'],
  ['vfx', 'The effects rules may show (their pictures in the catalogue\'s Effects).'],
  ['instanceTags', 'Tags a thing may carry beyond its type\'s (materials, qualities).'],
  ['looks', 'The look table: bodies, parts and colours people are drawn from.'],
]

/** The player's tables (a bundle's `client`): what its panels show. */
const TABLES: [key: string, doc: string][] = [
  ['items', 'Item forms and materials by name, relics, the coin.'],
  ['crafting', 'Recipes, the stations\' names, what is placed and built.'],
  ['skills', 'The skill tree: skills, directions, branches, professions (the classes module).'],
  ['boons', 'The companion\'s powers (the boons module).'],
  ['looks', 'The look table, the slots, the parts\' names, the player\'s first look.'],
  ['dev', 'The Mod Console\'s shortcuts (development only).'],
]

export class GameMode implements Mode {
  id = 'game'
  label = 'Game'
  private tab: Tab = 'game'
  private part: string = PARTS[0][0]
  private table: string = TABLES[0][0]
  private filter = ''

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    left.innerHTML = `<h3>Game</h3><div class="palette">${TABS.map(([t, label]) => `<button data-tab="${t}" class="${t === this.tab ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>
      ${this.tab === 'ontology' ? `<h3>Parts</h3><div class="palette list">${PARTS.map(([k]) => `<button data-part="${k}" class="${k === this.part ? 'on' : ''}">${esc(k)}</button>`).join('')}</div>` : ''}
      ${this.tab === 'tables' ? `<h3>Tables</h3><div class="palette">${TABLES.map(([k]) => `<button data-table="${k}" class="${k === this.table ? 'on' : ''}">${esc(k)}</button>`).join('')}</div>` : ''}`
    left.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => ((this.tab = b.dataset.tab as Tab), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-part]').forEach((b) => (b.onclick = () => ((this.part = b.dataset.part!), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-table]').forEach((b) => (b.onclick = () => ((this.table = b.dataset.table!), ctx.refresh())))
    const g = ctx.store.game
    const s = ctx.store.compiled().index.stats
    right.innerHTML = `<h3>${esc(tx(g.name))}</h3><p class="muted"><code>${esc(g.id)}</code> · version ${esc(g.version)}</p>
      <p>${s.maps} maps · ${s.npcs} people · ${s.creatures} creatures · ${s.items} items (${s.itemKinds} kinds) · ${s.fixtures} fixtures</p>
      <p class="muted">${(g.modules ?? []).length ? `Modules: ${esc((g.modules ?? []).join(', '))}` : 'The kernel alone: no module.'}</p>`
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
    el.innerHTML = `<h3>The game</h3>
      <div class="cols"><div>
        <label>name <input data-g="en" value="${esc(enOf(g.name))}"> <input data-g="zh" value="${esc(zhOf(g.name))}" placeholder="中文"></label>
        <label>id <input value="${esc(g.id)}" disabled> <small class="muted">(its saves are kept by it)</small></label>
        <label>version <input data-g="version" value="${esc(g.version)}"></label>
        <label>seed <input type="number" data-g="seed" value="${esc(g.seed)}"> <small class="muted">what every wild map and every random choice grows from</small></label>
        <label><input type="checkbox" data-g="stdlib" ${g.stdlib === false ? '' : 'checked'}> the standard library (the kernel's types, statuses and the roots of the rules)</label>
      </div><div>
        <h3>A new game</h3>
        <label>begins on <select data-g="startMap">${maps.map((m) => `<option value="${esc(m.id)}" ${m.id === g.start.map ? 'selected' : ''}>${esc(m.id)} — ${esc(tx(m.name))}</option>`).join('')}</select>
          at <input type="number" data-g="startX" value="${g.start.x}"> <input type="number" data-g="startY" value="${g.start.y}"></label>
        <label>at the hour <input type="number" min="0" max="23" data-g="startHour" value="${esc(g.startHour ?? '')}" placeholder="8"></label>
        <label>the world map is laid out from <select data-g="origin"><option value="">(the start's map)</option>${maps.map((m) => `<option ${m.id === g.origin ? 'selected' : ''}>${esc(m.id)}</option>`).join('')}</select></label>
        <h3>The player</h3>
        <label>name <input data-p="en" value="${esc(enOf(player.name))}"> <input data-p="zh" value="${esc(zhOf(player.name))}" placeholder="中文"></label>
        <label>tags <input data-p="tags" value="${esc((player.tags ?? []).join(', '))}"> <small class="muted">faction:folk …</small></label>
      </div></div>
      <h3>The engine's modules</h3>
      <p class="muted">The systems the game uses beyond the kernel, as RPG Maker ships its battle system: each brings its effects, conditions, goals and panels. A module a chosen one needs comes with it.</p>
      <div class="mods">${mods.map((m) => `<label class="mod"><input type="checkbox" data-mod="${esc(m.id)}" ${on.has(m.id) ? 'checked' : ''}><b>${esc(m.id)}</b>${m.needs?.length ? `<small>needs ${esc(m.needs.join(', '))}</small>` : ''}<small title="${esc((m.spec?.rules ?? []).join('\n'))}">${esc(clip((m.spec?.rules ?? [])[0] ?? `${Object.keys(m.spec?.primitives ?? {}).length} primitives, ${Object.keys(m.goals ?? {}).length} goals`, 150))}</small></label>`).join('')}</div>`
    const val = (k: string) => el.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-g="${k}"]`)!
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-g]').forEach((inp) => (inp.onchange = () => {
      const k = inp.dataset.g!
      this.game(ctx, `the game: ${k}`, (x) => {
        if (k === 'en' || k === 'zh') x.name = textOf(val('en').value || x.id, val('zh').value)
        else if (k === 'version') x.version = inp.value.trim() || '1'
        else if (k === 'seed') x.seed = Number(inp.value) || 0
        else if (k === 'stdlib') (inp as HTMLInputElement).checked ? delete x.stdlib : (x.stdlib = false)
        else if (k === 'startMap' || k === 'startX' || k === 'startY') x.start = { ...x.start, map: val('startMap').value, x: Number(val('startX').value), y: Number(val('startY').value) }
        else if (k === 'startHour') inp.value === '' ? delete x.startHour : (x.startHour = Number(inp.value))
        else if (k === 'origin') inp.value ? (x.origin = inp.value) : delete x.origin
      })
    }))
    el.querySelectorAll<HTMLInputElement>('[data-p]').forEach((inp) => (inp.onchange = () => this.game(ctx, 'the player', (x) => {
      const p = x.player as { name?: Text; tags?: string[] }
      if (inp.dataset.p === 'tags') p.tags = inp.value.split(',').map((t) => t.trim()).filter(Boolean)
      else p.name = textOf(el.querySelector<HTMLInputElement>('[data-p="en"]')!.value || 'You', el.querySelector<HTMLInputElement>('[data-p="zh"]')!.value)
    })))
    el.querySelectorAll<HTMLInputElement>('[data-mod]').forEach((b) => (b.onchange = () => this.game(ctx, `${b.checked ? 'the module' : 'no module'} ${b.dataset.mod}`, (x) => {
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
    el.innerHTML = `<h3>World parameters</h3><p class="muted">The numbers the engine runs the world by. A value here is the game's own (game.json); an empty one takes what the ontology gives (shown).</p>
      <table class="sched params">${PARAMS.map(([k, doc, json]) => `<tr><td><b>${esc(k)}</b><br><small class="muted">${esc(doc)}</small></td><td><input data-k="${esc(k)}" ${json ? 'class="wide"' : ''} value="${esc(own[k] === undefined ? '' : json ? JSON.stringify(own[k]) : own[k])}" placeholder="${esc(all[k] === undefined ? '—' : json ? JSON.stringify(all[k]) : all[k])}"></td></tr>`).join('')}</table>`
    el.querySelectorAll<HTMLInputElement>('[data-k]').forEach((inp) => (inp.onchange = () => {
      const k = inp.dataset.k!
      const json = PARAMS.find((p) => p[0] === k)?.[2]
      let v: unknown = inp.value.trim()
      try {
        if (v !== '' && json) v = JSON.parse(v as string)
        else if (v !== '' && k !== 'nightFact') v = Number(v)
      } catch {
        return toast(`${k}: not JSON`, 'error')
      }
      if (typeof v === 'number' && Number.isNaN(v)) return toast(`${k}: a number`, 'warn')
      this.game(ctx, `the parameter ${k}`, (x) => {
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
    const t = (k: 'title' | 'kicker' | 'subtitle', hint: string) => `<label>${esc(hint)} <input data-c="${k}.en" value="${esc(enOf(c[k]))}"> <input data-c="${k}.zh" value="${esc(zhOf(c[k]))}" placeholder="中文"></label>`
    el.innerHTML = `<h3>The cover</h3><p class="muted">The title screen: what it says, what it offers. Written in <code>${esc(this.clientFile(ctx, 'cover'))}</code>.</p>
      ${t('title', 'title (default: the game\'s name)')}${t('kicker', 'the line above it')}${t('subtitle', 'the line below it')}
      <label>credits at its foot <input data-c="credit" value="${esc(c.credit === false ? '' : enOf(c.credit || undefined))}" placeholder="Art & music: Ninja Adventure (CC0)"></label>
      <label><input type="checkbox" data-c="nocredit" ${c.credit === false ? 'checked' : ''}> no credits line</label>
      <label><input type="checkbox" data-c="tutorial" ${c.tutorial ? 'checked' : ''}> a tutorial run (the world has a start named <code>tutorial</code>)</label>
      <label><input type="checkbox" data-c="art" ${c.art ? 'checked' : ''}> the mountain at dawn behind the title</label>
      <label>a companion flying across: its sheet <input data-c="companion" value="${esc(typeof c.companion === 'string' ? c.companion : '')}" placeholder="own/companion.png (in the game's assets)"></label>`
    el.querySelectorAll<HTMLInputElement>('[data-c]').forEach((inp) => (inp.onchange = () => {
      const next = structuredClone(c) as Record<string, unknown>
      const k = inp.dataset.c!
      const [f, lang] = k.split('.')
      if (lang) next[f] = el.querySelector<HTMLInputElement>(`[data-c="${f}.en"]`)!.value.trim() ? textOf(el.querySelector<HTMLInputElement>(`[data-c="${f}.en"]`)!.value, el.querySelector<HTMLInputElement>(`[data-c="${f}.zh"]`)!.value) : undefined
      else if (k === 'credit') next.credit = inp.value.trim() || undefined
      else if (k === 'nocredit') next.credit = inp.checked ? false : undefined
      else if (k === 'companion') next.companion = inp.value.trim() || undefined
      else next[k] = inp.checked || undefined
      for (const x of Object.keys(next)) if (next[x] === undefined) delete next[x]
      this.setClient(ctx, 'cover', `the cover: ${f}`, Object.keys(next).length ? next : undefined)
    }))
  }

  private wordsTab(ctx: Ctx, el: HTMLElement): void {
    const own = this.client<Record<string, { en: string; zh?: string }>>(ctx, 'texts') ?? {}
    const q = this.filter.toLowerCase()
    const keys = Object.keys(STRINGS).filter((k) => !q || k.toLowerCase().includes(q) || STRINGS[k].some((w) => w.toLowerCase().includes(q)))
    el.innerHTML = `<h3>Interface words</h3><p class="muted">What the player's panels say, by key: write the game's own words over the engine's (a module's panel speaking of your game's people and places). ${Object.keys(own).length} of ${Object.keys(STRINGS).length} are the game's own.</p>
      <input id="wdFilter" placeholder="filter (a key, or words)" value="${esc(this.filter)}">
      <table class="sched words">${keys.slice(0, 150).map((k) => `<tr><td><code>${esc(k)}</code><br><small class="muted">${esc(STRINGS[k][0])} · ${esc(STRINGS[k][1])}</small></td><td><input data-w="${esc(k)}" data-l="en" value="${esc(own[k]?.en ?? '')}" placeholder="${esc(STRINGS[k][0])}"><input data-w="${esc(k)}" data-l="zh" value="${esc(own[k]?.zh ?? '')}" placeholder="${esc(STRINGS[k][1])}"></td></tr>`).join('')}</table>
      ${keys.length > 150 ? `<p class="muted">${keys.length - 150} more: narrow the filter.</p>` : ''}`
    const f = el.querySelector<HTMLInputElement>('#wdFilter')!
    f.oninput = () => { this.filter = f.value; this.wordsTab(ctx, el); el.querySelector<HTMLInputElement>('#wdFilter')!.focus() }
    el.querySelectorAll<HTMLInputElement>('[data-w]').forEach((inp) => (inp.onchange = () => {
      const k = inp.dataset.w!
      const en = el.querySelector<HTMLInputElement>(`[data-w="${CSS.escape(k)}"][data-l="en"]`)!.value.trim()
      const zh = el.querySelector<HTMLInputElement>(`[data-w="${CSS.escape(k)}"][data-l="zh"]`)!.value.trim()
      const next = { ...own }
      if (en || zh) next[k] = { en: en || STRINGS[k][0], ...(zh && { zh }) }
      else delete next[k]
      this.setClient(ctx, 'texts', `the words: ${k}`, Object.keys(next).length ? next : undefined)
    }))
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
    el.innerHTML = `<h3>Factions</h3><p class="muted">An actor belongs to those its <code>faction:&lt;id&gt;</code> tags name; its members attack those it is hostile to, on sight, when their temper says so. Written in <code>${esc(file)}</code>.</p>
      <div class="factions">${ids.map((id) => `<div class="box faction"><div class="row"><b>${esc(id)}</b>${own[id] ? '' : ' <small class="muted">(the library\'s)</small>'}<span class="grow"></span>${own[id] ? `<a class="x" data-fdel="${esc(id)}">remove</a>` : ''}</div>
        <div class="row"><input data-fn="${esc(id)}" data-l="en" value="${esc(enOf(all[id].name))}" placeholder="name"><input data-fn="${esc(id)}" data-l="zh" value="${esc(zhOf(all[id].name))}" placeholder="中文"></div>
        <div class="chips"><span class="muted">attacks on sight:</span> ${ids.filter((x) => x !== id).map((x) => `<label class="chip"><input type="checkbox" data-fh="${esc(id)}" value="${esc(x)}" ${all[id].hostile?.includes(x) ? 'checked' : ''}>${esc(x)}</label>`).join('') || '—'}</div></div>`).join('')}</div>
      <div class="row"><input id="fnNew" placeholder="a new faction's id (bandits)"><button id="fnMake">New faction</button></div>`
    const write = (id: string, why: string, fn: (f: FactionDef) => void) => {
      const next = structuredClone(own)
      next[id] = structuredClone(next[id] ?? all[id] ?? {})
      fn(next[id])
      this.setOnto(ctx, 'factions', why, next)
    }
    el.querySelectorAll<HTMLInputElement>('[data-fn]').forEach((inp) => (inp.onchange = () => write(inp.dataset.fn!, `the faction ${inp.dataset.fn}: its name`, (f) => {
      const id = inp.dataset.fn!
      const en = el.querySelector<HTMLInputElement>(`[data-fn="${CSS.escape(id)}"][data-l="en"]`)!.value
      f.name = textOf(en || id, el.querySelector<HTMLInputElement>(`[data-fn="${CSS.escape(id)}"][data-l="zh"]`)!.value)
    })))
    el.querySelectorAll<HTMLInputElement>('[data-fh]').forEach((b) => (b.onchange = () => write(b.dataset.fh!, `the faction ${b.dataset.fh}: whom it attacks`, (f) => {
      const h = new Set(f.hostile ?? [])
      if (b.checked) h.add(b.value)
      else h.delete(b.value)
      f.hostile = [...h]
    })))
    el.querySelectorAll<HTMLElement>('[data-fdel]').forEach((a) => (a.onclick = () => {
      const next = structuredClone(own)
      delete next[a.dataset.fdel!]
      this.setOnto(ctx, 'factions', `no faction ${a.dataset.fdel}`, Object.keys(next).length ? next : undefined)
    }))
    el.querySelector<HTMLButtonElement>('#fnMake')!.onclick = () => {
      const id = el.querySelector<HTMLInputElement>('#fnNew')!.value.trim()
      if (!/^[a-z][a-z0-9_-]*$/.test(id)) return toast('A faction\'s id: lower case letters, digits, _ and -.', 'warn')
      if (all[id]) return toast(`There is a faction ${id} already.`, 'warn')
      write(id, `a new faction ${id}`, (f) => (f.name = id))
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
    el.innerHTML = `<h3>${esc(key)}</h3><p class="muted">${esc(doc)} The project's part is in <code>${esc(file)}</code>; the compiler puts it over the standard library's.</p>
      <div class="cols"><div><h3>The project's</h3><textarea id="ptJson" rows="22" placeholder="(none)">${esc(own === undefined ? '' : JSON.stringify(own, null, 2))}</textarea><button id="ptApply">Apply</button> <small class="muted">empty: none of the project's own</small></div>
      <div><h3>The standard library's</h3><pre class="json">${esc(lib === undefined ? '(none)' : JSON.stringify(lib, null, 2))}</pre>
      <h3>What the game gets</h3><pre class="json">${esc(merged === undefined ? '(none)' : JSON.stringify(merged, null, 2))}</pre></div></div>`
    el.querySelector<HTMLButtonElement>('#ptApply')!.onclick = () => {
      const text = el.querySelector<HTMLTextAreaElement>('#ptJson')!.value.trim()
      try {
        this.setOnto(ctx, key, `the ontology's ${key}`, text ? JSON.parse(text) : undefined)
      } catch (e) {
        toast(`Not JSON: ${(e as Error).message}`, 'error')
      }
    }
  }

  private tableTab(ctx: Ctx, el: HTMLElement): void {
    const key = this.table
    const doc = TABLES.find((p) => p[0] === key)?.[1] ?? ''
    const v = this.client<unknown>(ctx, key)
    el.innerHTML = `<h3>${esc(key)}</h3><p class="muted">${esc(doc)} In <code>${esc(this.clientFile(ctx, key))}</code>: the player's panels read it (the engine does not).</p>
      <textarea id="tbJson" rows="28" placeholder="(none)">${esc(v === undefined ? '' : JSON.stringify(v, null, 2))}</textarea><button id="tbApply">Apply</button>`
    el.querySelector<HTMLButtonElement>('#tbApply')!.onclick = () => {
      const text = el.querySelector<HTMLTextAreaElement>('#tbJson')!.value.trim()
      try {
        this.setClient(ctx, key, `the table ${key}`, text ? JSON.parse(text) : undefined)
      } catch (e) {
        toast(`Not JSON: ${(e as Error).message}`, 'error')
      }
    }
  }
}
