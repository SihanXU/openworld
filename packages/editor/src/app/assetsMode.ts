// The Assets mode (docs/engine-split.md §15, RPG Maker's resource manager and its database's pictures): the
// game's catalogue — the picture of every item, fixture, creature and character, the looks of the ground,
// rooms, effects, music and sounds (the runtime's assets/types.ts) — each entry cut from a picture on a grid;
// the project's pictures and sounds, imported from the disk (under assets/own/); the pack the editor ships
// (the Ninja Adventure pack's subset, CC0), a file of which is copied into the project when it is used; and
// what the game's types name that no picture answers yet.

import type { ActorDef, Catalog, FxDef, SpriteDef } from '@openworld/runtime/src/assets/types.ts'
import type { AssetFile } from '../server/assets.ts'
import { call } from './api.ts'
import type { Ctx, Mode } from './context.ts'
import { Sheet, drawGrid, drawSprite, type Rect } from './sheet.ts'
import { phrase } from './lang.ts'
import { esc, t, toast } from './ui.ts'

type CatId = 'items' | 'fixtures' | 'creatures' | 'characters' | 'roles' | 'blobs' | 'plain' | 'terrainObjects' | 'decals' | 'rooms' | 'prefabs' | 'fx' | 'music' | 'sfx' | 'ui'
type Kind = 'sprite' | 'fixture' | 'actor' | 'roles' | 'blob' | 'plain' | 'sprites' | 'room' | 'prefab' | 'fx' | 'sound'

const CATS: { id: CatId; label: string; kind: Kind; doc: string }[] = [
  { id: 'items', label: phrase('Items'), kind: 'sprite', doc: phrase('An item\'s icon by its sprite key (a type\'s `sprite`, item:axe): one cell, its anchor where it stands.') },
  { id: 'fixtures', label: phrase('Fixtures'), kind: 'fixture', doc: phrase('A fixture\'s picture by its sprite key (fixture:chest): as it is, open, lit, turned across, and looks of its own picked per thing.') },
  { id: 'creatures', label: phrase('Creatures'), kind: 'actor', doc: phrase('A creature\'s sheet by its sprite key (creature:slime, or creature:slime:fire for one element\'s): columns the directions (down, up, left, right), rows the frames.') },
  { id: 'characters', label: phrase('Characters'), kind: 'actor', doc: phrase('A person\'s sheet (where the game has no look table): columns the directions, rows the frames (walk, then the rest); a portrait beside it.') },
  { id: 'roles', label: phrase('Roles'), kind: 'roles', doc: phrase('The characters a person of a role is drawn as, one picked per person (the player\'s role is `player`).') },
  { id: 'blobs', label: phrase('Ground: autotiles'), kind: 'blob', doc: phrase('A terrain drawn by the autotiler from a 47-tile block (laid out as the pack\'s TilesetFloor.png columns 0-9, rows 7-11): its top-left cell.') },
  { id: 'plain', label: phrase('Ground: tiles'), kind: 'plain', doc: phrase('A terrain drawn as plain tiles, one of these picked per cell.') },
  { id: 'terrainObjects', label: phrase('Ground: objects'), kind: 'sprites', doc: phrase('A terrain whose cells each carry a thing drawn on the ground (a tree, a rock, flowers): one of these picked per cell.') },
  { id: 'decals', label: phrase('Ground: decals'), kind: 'sprites', doc: phrase('Small things scattered on plain ground for variety (pebbles, leaves).') },
  { id: 'rooms', label: phrase('Rooms'), kind: 'room', doc: phrase('A room\'s walls, nine-slice: a square block of cells whose ring is the wall.') },
  { id: 'prefabs', label: phrase('Buildings'), kind: 'prefab', doc: phrase('A building stamped on a map: its picture over tiles, each tile # solid, . free, D the door, a space nothing.') },
  { id: 'fx', label: phrase('Effects'), kind: 'fx', doc: phrase('An effect the rules name (steam, fire_burst), and the statuses\' overlays (ovl:burning): its frames in a row.') },
  { id: 'music', label: phrase('Music'), kind: 'sound', doc: phrase('Music by a map\'s mood (a map\'s `music`).') },
  { id: 'sfx', label: phrase('Sounds'), kind: 'sound', doc: phrase('Sounds by event (step, take, hit …).') },
  { id: 'ui', label: phrase('Interface'), kind: 'sprite', doc: phrase('The interface\'s pictures (the dialogue box, the hearts, the marks).') },
]
const catOf = (id: CatId) => CATS.find((c) => c.id === id)!
/** A fixture's part, in the editor's words. */
const partName = (p: string) => ({ base: t('as it is'), open: t('open'), lit: t('lit'), across: t('turned across') })[p] ?? p
const EMPTY: Catalog = { blobs: {}, plain: {}, decals: {}, terrainObjects: {}, prefabs: {}, rooms: {}, fixtures: {}, items: {}, characters: {}, roles: {}, creatures: {}, fx: {}, ui: {}, music: {}, sfx: {} }

/** The game's own art: under its assets/ as written; any other path is the pack's, under assets/na/ (render/assets.ts). */
const OWN = /^(lsw|own)\//
/** A project file's path as a catalogue writes it. */
const catalogPath = (file: string) => (file.startsWith('na/') ? file.slice(3) : file)

type View = { cat: CatId; key?: string } | { files: 'project' | 'pack'; back?: { cat: CatId; key?: string } }

export class AssetsMode implements Mode {
  id = 'assets'
  label = phrase('Assets')
  private view: View = { cat: 'items' }
  private files?: AssetFile[]
  private pack?: AssetFile[]
  private filter = ''
  private sheet = new Sheet()
  /** The part of an entry a cut writes (a fixture's base, open, lit, across or a variant; a list's index; + a new one). */
  private part = 'base'
  private loading = false

  private key(ctx: Ctx): string {
    return ctx.store.id
  }
  private catalog(ctx: Ctx): Catalog {
    return { ...EMPTY, ...(ctx.store.get<Catalog>('catalog.json') ?? {}) }
  }
  private edit(ctx: Ctx, why: string, fn: (c: Catalog) => void): void {
    if (ctx.store.get('catalog.json') === undefined) ctx.store.add('catalog.json', structuredClone(EMPTY), t('a catalogue'))
    ctx.store.change<Catalog>('catalog.json', why, (c) => {
      for (const k of Object.keys(EMPTY) as (keyof Catalog)[]) (c as unknown as Record<string, unknown>)[k] ??= {}
      fn(c)
    })
  }

  /** A picture's URL: the project's own, the project's copy of the pack's, or (not taken yet) the pack's. */
  private url(ctx: Ctx, path: string): string {
    const k = encodeURIComponent(this.key(ctx))
    if (OWN.test(path)) return encodeURI(`/games/${k}/assets/${path}`)
    if (!this.files || this.files.some((f) => f.path === `na/${path}`)) return encodeURI(`/games/${k}/assets/na/${path}`)
    return encodeURI(`/pack/${path}`)
  }

  private async load(ctx: Ctx, again = false): Promise<void> {
    if (this.loading || (this.files && !again)) return
    this.loading = true
    try {
      this.files = await call<AssetFile[]>(`/api/projects/${encodeURIComponent(this.key(ctx))}/assets`)
      this.pack ??= await call<AssetFile[]>('/api/pack').catch(() => [])
    } catch (e) {
      toast((e as Error).message, 'error')
      this.files ??= []
    } finally {
      this.loading = false
    }
    ctx.refresh()
  }

  focus(ctx: Ctx, _file: string, at?: string): void {
    const m = at?.match(/^([a-zA-Z]+):(.+)$/)
    if (m && CATS.some((c) => c.id === m[1])) void this.openEntry(ctx, m[1] as CatId, m[2])
  }

  // ------------------------------------------------------------------ the left: the catalogue's kinds, the files, what is missing

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    void this.load(ctx)
    const c = this.catalog(ctx)
    const on = 'cat' in this.view ? this.view.cat : undefined
    const missing = this.missing(ctx)
    left.innerHTML = `<h3>${t('Catalogue')}</h3><div class="palette">${CATS.map((x) => `<button data-cat="${x.id}" class="${on === x.id ? 'on' : ''}">${esc(t(x.label))}<small>${Object.keys(c[x.id] ?? {}).length}</small></button>`).join('')}</div>
      <h3>${t('Files')}</h3><div class="palette">
        <button data-files="project" class="${'files' in this.view && this.view.files === 'project' ? 'on' : ''}">${t('The project\'s')}<small>${this.files?.length ?? '…'}</small></button>
        <button data-files="pack" class="${'files' in this.view && this.view.files === 'pack' ? 'on' : ''}">${t('The pack (CC0)')}<small>${this.pack?.length ?? '…'}</small></button>
        <button id="asImport">${t('Import pictures and sounds…')}</button></div>
      <input type="file" id="asFile" multiple accept="image/png,image/webp,image/gif,image/jpeg,audio/ogg,audio/wav,audio/mpeg" hidden>
      <h3>${t('Needs a picture')}</h3>${missing.length ? `<ul class="things">${missing.map((m) => `<li><a data-need="${esc(m.cat)}|${esc(m.key)}">${esc(m.key)}</a> <small class="muted">${esc(m.why === 'ground' ? t('ground') : m.why)}</small></li>`).join('')}</ul>` : `<p class="muted">${t('Every type and terrain has a picture.')}</p>`}`
    left.querySelectorAll<HTMLElement>('[data-cat]').forEach((b) => (b.onclick = () => ((this.view = { cat: b.dataset.cat as CatId }), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-files]').forEach((b) => (b.onclick = () => ((this.view = { files: b.dataset.files as 'project' | 'pack' }), ctx.refresh())))
    left.querySelectorAll<HTMLElement>('[data-need]').forEach((a) => (a.onclick = () => { const [cat, key] = a.dataset.need!.split('|'); void this.openEntry(ctx, cat as CatId, key) }))
    const input = left.querySelector<HTMLInputElement>('#asFile')!
    left.querySelector<HTMLButtonElement>('#asImport')!.onclick = () => input.click()
    input.onchange = () => void this.import(ctx, [...(input.files ?? [])])
    this.renderRight(ctx, right)
  }

  /** The sprite keys the types name and the terrains with no look: what the renderer would draw with a stand-in. */
  private missing(ctx: Ctx): { cat: CatId; key: string; why: string }[] {
    const c = this.catalog(ctx)
    const onto = ctx.onto()
    const out = new Map<string, { cat: CatId; key: string; why: string }>()
    for (const t of Object.values(onto.types)) {
      const s = t.sprite
      if (!s) continue
      const cat: CatId | undefined = s.startsWith('item:') ? 'items' : s.startsWith('fixture:') ? 'fixtures' : s.startsWith('creature:') ? 'creatures' : undefined
      if (cat && !c[cat][s] && !out.has(s)) out.set(s, { cat, key: s, why: t.id })
    }
    for (const id of Object.keys(onto.terrains)) {
      if (id === 'void' || c.blobs[id] || c.plain[id] || c.terrainObjects[id]) continue
      // a terrain no map writes needs no look
      if (!Object.values(ctx.store.game.terrainChars).includes(id)) continue
      out.set(`ground:${id}`, { cat: 'plain', key: id, why: 'ground' })
    }
    return [...out.values()]
  }

  private renderRight(ctx: Ctx, right: HTMLElement): void {
    if (!('cat' in this.view) || !this.view.key) return void (right.innerHTML = `<h3>${t('Assets')}</h3><p class="muted">${'cat' in this.view ? esc(t(catOf(this.view.cat).doc)) : t('The project\'s files are in its assets/ folder: the pack\'s under na/, what you import under own/. A pack file is copied into the project when an entry uses it.')}</p>`)
    const { cat, key } = this.view
    const entry = (this.catalog(ctx)[cat] as Record<string, unknown>)[key]
    const users = Object.values(ctx.onto().types).filter((t) => t.sprite === key).map((t) => t.id)
    right.innerHTML = `<h3>${esc(key)}</h3><p class="muted">${esc(t(catOf(cat).doc))}</p>
      ${users.length ? `<p>${t('Drawn for {list}', { list: users.map((u) => `<code>${esc(u)}</code>`).join(', ') })}</p>` : ''}
      ${entry === undefined ? `<p class="warn">${t('Not made yet: cut it from a picture (the middle) to make it.')}</p>` : `<h3>JSON</h3><textarea id="asJson" rows="18">${esc(JSON.stringify(entry, null, 2))}</textarea><button id="asApply">${t('Apply the JSON')}</button>
      <div class="row"><button id="asCopy">${t('Duplicate…')}</button><button id="asDel" class="danger">${t('Delete {key}', { key: esc(key) })}</button></div>`}`
    right.querySelector<HTMLButtonElement>('#asApply')?.addEventListener('click', () => {
      try {
        const v = JSON.parse(right.querySelector<HTMLTextAreaElement>('#asJson')!.value)
        this.edit(ctx, t('{id}: its JSON', { id: key }), (c) => ((c[cat] as Record<string, unknown>)[key] = v))
      } catch (e) {
        toast(t('not JSON: {why}', { why: (e as Error).message }), 'error')
      }
    })
    right.querySelector<HTMLButtonElement>('#asCopy')?.addEventListener('click', () => {
      const to = prompt(t('The new entry\'s key:'), `${key}2`)?.trim()
      if (!to) return
      if ((this.catalog(ctx)[cat] as Record<string, unknown>)[to] !== undefined) return toast(t('{key} exists.', { key: to }), 'warn')
      this.edit(ctx, t('{key}: a copy of {of}', { key: to, of: key }), (c) => ((c[cat] as Record<string, unknown>)[to] = structuredClone(entry)))
      this.view = { cat, key: to }
      ctx.refresh()
    })
    right.querySelector<HTMLButtonElement>('#asDel')?.addEventListener('click', () => {
      this.edit(ctx, t('{key} deleted', { key }), (c) => delete (c[cat] as Record<string, unknown>)[key])
      this.view = { cat }
      ctx.refresh()
    })
  }

  // ------------------------------------------------------------------ the middle

  main(ctx: Ctx, el: HTMLElement): void {
    if ('files' in this.view) return this.filesView(ctx, el, this.view)
    if (!this.view.key) return this.catView(ctx, el, this.view.cat)
    this.entryView(ctx, el, this.view.cat, this.view.key)
  }

  /** A kind's entries, each drawn small. */
  private catView(ctx: Ctx, el: HTMLElement, cat: CatId): void {
    const c = this.catalog(ctx)
    const entries = Object.entries(c[cat] as Record<string, unknown>)
    el.innerHTML = `<h3>${esc(t(catOf(cat).label))}</h3><p class="muted">${esc(t(catOf(cat).doc))}</p>
      <div class="row"><input id="asNew" placeholder="${esc(t('a new entry\'s key ({example})', { example: cat === 'items' ? 'item:apple' : cat === 'fixtures' ? 'fixture:well' : cat === 'creatures' ? 'creature:bat' : cat === 'roles' ? 'farmer' : t('its name') }))}"><button id="asMake">${t('New entry')}</button></div>
      <div class="as-grid">${entries.map(([k]) => `<a class="as-tile" data-key="${esc(k)}"><canvas data-thumb="${esc(k)}"></canvas><span>${esc(k)}</span></a>`).join('') || `<p class="muted">${t('None yet.')}</p>`}</div>`
    el.querySelectorAll<HTMLElement>('[data-key]').forEach((a) => (a.onclick = () => void this.openEntry(ctx, cat, a.dataset.key!)))
    el.querySelector<HTMLButtonElement>('#asMake')!.onclick = () => {
      const k = el.querySelector<HTMLInputElement>('#asNew')!.value.trim()
      if (!k) return
      if (catOf(cat).kind === 'roles') this.edit(ctx, t('the role {key}', { key: k }), (x) => (x.roles[k] ??= []))
      void this.openEntry(ctx, cat, k)
    }
    for (const [k, v] of entries) {
      const canvas = el.querySelector<HTMLCanvasElement>(`canvas[data-thumb="${CSS.escape(k)}"]`)
      if (canvas) void this.thumb(ctx, canvas, cat, v)
    }
  }

  /** A small picture of an entry. */
  private async thumb(ctx: Ctx, c: HTMLCanvasElement, cat: CatId, v: unknown): Promise<void> {
    const kind = catOf(cat).kind
    const sprite = (s: SpriteDef | undefined) => s && s.img ? drawSprite(c, this.url(ctx, s.img), { ...s, frames: 1 }, s.w > 32 ? 1 : 2) : undefined
    if (kind === 'sprite') return sprite(v as SpriteDef)
    if (kind === 'fixture') return sprite((v as { base: SpriteDef }).base)
    if (kind === 'sprites') return sprite((v as SpriteDef[])[0])
    if (kind === 'fx') { const f = v as FxDef; return f.img ? drawSprite(c, this.url(ctx, f.img), { x: 0, y: 0, w: f.fw, h: f.fh }, f.fw > 32 ? 1 : 2) : undefined }
    if (kind === 'actor') { const a = v as ActorDef; return drawSprite(c, this.url(ctx, `${a.dir}/${a.sheet}`), { x: 0, y: 0, w: 16, h: 16 }, 2) }
    if (kind === 'plain') { const t = (v as [string, number, number][])[0]; return t ? drawSprite(c, this.url(ctx, t[0]), { x: t[1] * 16, y: t[2] * 16, w: 16, h: 16 }, 2) : undefined }
    if (kind === 'blob') { const b = v as { img: string; col: number; row: number }; return drawSprite(c, this.url(ctx, b.img), { x: b.col * 16, y: b.row * 16, w: 48, h: 48 }, 1) }
    if (kind === 'room') { const r = v as { img: string; col: number; row: number; size: number }; return drawSprite(c, this.url(ctx, r.img), { x: r.col * 16, y: r.row * 16, w: r.size * 16, h: r.size * 16 }, 1) }
    if (kind === 'prefab') { const p = v as { img: string; x: number; y: number; tw: number; th: number }; return drawSprite(c, this.url(ctx, p.img), { x: p.x, y: p.y, w: p.tw * 16, h: p.th * 16 }, 1) }
    c.width = 0
  }

  /** Open an entry (made or to be made), its picture in the sheet with its own rectangle on it. */
  private async openEntry(ctx: Ctx, cat: CatId, key: string): Promise<void> {
    this.view = { cat, key }
    this.part = catOf(cat).kind === 'sprites' || catOf(cat).kind === 'plain' ? '+' : 'base'
    const v = (this.catalog(ctx)[cat] as Record<string, unknown>)[key]
    const at = v === undefined ? undefined : this.placeOf(cat, v, this.part)
    if (at) await this.sheet.open(this.url(ctx, at.img), at.img, at.rect)
    ctx.refresh()
  }

  /** Where in its picture an entry's part is. */
  private placeOf(cat: CatId, v: unknown, part: string): { img: string; rect?: Rect } | undefined {
    const kind = catOf(cat).kind
    const sp = (s?: SpriteDef) => (s?.img ? { img: s.img, rect: { x: s.x, y: s.y, w: s.w, h: s.h } } : undefined)
    if (kind === 'sprite') return sp(v as SpriteDef)
    if (kind === 'fixture') { const f = v as Record<string, unknown>; return sp((part.startsWith('v') && part !== 'v+' ? (f.variants as SpriteDef[])?.[Number(part.slice(1))] : (f[part] as SpriteDef)) ?? (f.base as SpriteDef)) }
    if (kind === 'sprites') { const l = v as SpriteDef[]; return sp(l[Number(part)] ?? l[0]) }
    if (kind === 'plain') { const t = (v as [string, number, number][])[Number(part)] ?? (v as [string, number, number][])[0]; return t ? { img: t[0], rect: { x: t[1] * 16, y: t[2] * 16, w: 16, h: 16 } } : undefined }
    if (kind === 'blob' || kind === 'room') { const b = v as { img: string; col: number; row: number; size?: number }; return { img: b.img, rect: { x: b.col * 16, y: b.row * 16, w: (b.size ?? 1) * 16, h: (b.size ?? 1) * 16 } } }
    if (kind === 'fx') { const f = v as FxDef; return { img: f.img, rect: { x: 0, y: 0, w: f.fw, h: f.fh } } }
    if (kind === 'actor') { const a = v as ActorDef; return { img: `${a.dir}/${a.sheet}` } }
    if (kind === 'prefab') { const p = v as { img: string; x: number; y: number; tw: number; th: number }; return { img: p.img, rect: { x: p.x, y: p.y, w: p.tw * 16, h: p.th * 16 } } }
    return undefined
  }

  /** A cut from the sheet written into the entry, by its kind (made by the first cut). */
  private cut(ctx: Ctx, cat: CatId, key: string, r: Rect, img: string, size: { w: number; h: number }): void {
    const kind = catOf(cat).kind
    const sprite = (old?: SpriteDef): SpriteDef => {
      const same = old && old.w === r.w && old.h === r.h
      return { ...(old ?? {}), img, x: r.x, y: r.y, w: r.w, h: r.h, ax: same ? old.ax : r.w / 2, ay: same ? old.ay : r.h }
    }
    this.edit(ctx, t('{key}: cut from {img}', { key, img }), (c) => {
      const into = c[cat] as Record<string, unknown>
      const v = into[key]
      if (kind === 'sprite') into[key] = sprite(v as SpriteDef)
      else if (kind === 'fixture') {
        const f = (v ?? {}) as Record<string, unknown>
        if (this.part === 'v+') (f.variants = [...((f.variants as SpriteDef[]) ?? []), sprite()]), (this.part = `v${(f.variants as SpriteDef[]).length - 1}`)
        else if (this.part.startsWith('v')) (f.variants as SpriteDef[])[Number(this.part.slice(1))] = sprite((f.variants as SpriteDef[])[Number(this.part.slice(1))])
        else f[this.part] = sprite(f[this.part] as SpriteDef)
        f.base ??= f[this.part] ?? sprite()
        into[key] = f
      } else if (kind === 'sprites') {
        const l = ((v as SpriteDef[]) ?? []).slice()
        if (this.part === '+') (l.push(sprite()), (this.part = String(l.length - 1)))
        else l[Number(this.part)] = sprite(l[Number(this.part)])
        into[key] = l
      } else if (kind === 'plain') {
        const l = ((v as [string, number, number][]) ?? []).slice()
        for (let y = r.y; y < r.y + r.h; y += 16) for (let x = r.x; x < r.x + r.w; x += 16) l.push([img, x / 16, y / 16])
        into[key] = l
      } else if (kind === 'blob') into[key] = { ...(v as object), img, col: r.x / 16, row: r.y / 16 }
      else if (kind === 'room') into[key] = { img, col: r.x / 16, row: r.y / 16, size: Math.max(3, Math.round(Math.max(r.w, r.h) / 16)) }
      else if (kind === 'fx') {
        const f = v as FxDef | undefined
        into[key] = { fps: 12, ...(f ?? {}), img, fw: r.w, fh: r.h, frames: Math.max(1, Math.floor(size.w / r.w)) }
      } else if (kind === 'actor') {
        const a = v as ActorDef | undefined
        const slash = img.lastIndexOf('/')
        into[key] = { ...(a ?? {}), dir: img.slice(0, Math.max(0, slash)), sheet: img.slice(slash + 1), cols: Math.max(1, Math.round(size.w / r.w)), rows: Math.max(1, Math.round(size.h / r.h)) }
      } else if (kind === 'prefab') {
        const tw = Math.max(1, Math.round(r.w / 16))
        const th = Math.max(1, Math.round(r.h / 16))
        const p = v as { grid?: string[] } | undefined
        into[key] = { ...(p ?? {}), img, x: r.x, y: r.y, tw, th, grid: p?.grid?.length === th && p.grid[0]?.length === tw ? p.grid : Array.from({ length: th }, () => '#'.repeat(tw)) }
      }
    })
  }

  /** An entry: its fields, how it looks, and the picture it is cut from. */
  private entryView(ctx: Ctx, el: HTMLElement, cat: CatId, key: string): void {
    const kind = catOf(cat).kind
    const v = (this.catalog(ctx)[cat] as Record<string, unknown>)[key]
    const pictures = (this.files ?? []).filter((f) => f.kind === (kind === 'sound' ? 'sound' : 'image'))
    const parts = this.partsOf(kind, v)
    el.innerHTML = `<div class="row"><a data-back>${esc(t(catOf(cat).label))}</a> <span class="muted">›</span> <b>${esc(key)}</b>${v === undefined ? ` <span class="warn">${t('(to be made)')}</span>` : ''}</div>
      <div class="as-entry"><div class="as-form">${this.form(kind, v)}</div><div class="as-preview" id="asPreview"></div></div>
      ${kind === 'roles' || kind === 'sound' ? '' : `<h3>${t('Picture')}</h3>
      <div class="row"><select id="asPic"><option value="">${t('— the project\'s pictures —')}</option>${pictures.map((f) => `<option value="${esc(f.path)}" ${this.sheet.path === catalogPath(f.path) ? 'selected' : ''}>${esc(f.path)}${f.w ? ` (${f.w}×${f.h})` : ''}</option>`).join('')}</select><button id="asFromPack">${t('From the pack…')}</button><button id="asImport2">${t('Import…')}</button></div>
      ${parts.length ? `<div class="row as-parts">${t('a cut sets:')} ${parts.map(([p, label]) => `<button data-part="${esc(p)}" class="${this.part === p ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>` : ''}
      <div id="asSheet" class="as-sheet"></div>`}`
    el.querySelector<HTMLElement>('[data-back]')!.onclick = () => ((this.view = { cat }), ctx.refresh())
    this.bindForm(ctx, el, cat, key, kind, v)
    void this.preview(ctx, el.querySelector<HTMLElement>('#asPreview')!, kind, v)
    if (kind === 'roles' || kind === 'sound') return
    el.querySelector<HTMLSelectElement>('#asPic')!.onchange = async (e) => {
      const f = (e.target as HTMLSelectElement).value
      if (!f) return
      await this.sheet.open(this.url(ctx, catalogPath(f)), catalogPath(f))
      ctx.refresh()
    }
    el.querySelector<HTMLButtonElement>('#asFromPack')!.onclick = () => ((this.view = { files: 'pack', back: { cat, key } }), ctx.refresh())
    el.querySelector<HTMLButtonElement>('#asImport2')!.onclick = () => document.querySelector<HTMLInputElement>('#asFile')?.click()
    el.querySelectorAll<HTMLElement>('[data-part]').forEach((b) => (b.onclick = async () => {
      this.part = b.dataset.part!
      const at = v === undefined ? undefined : this.placeOf(cat, v, this.part)
      if (at && !this.part.endsWith('+')) await this.sheet.open(this.url(ctx, at.img), at.img, at.rect)
      ctx.refresh()
    }))
    this.sheet.onCut = (r) => {
      if (!this.sheet.path) return
      const img = el.querySelector<HTMLCanvasElement>('#shCanvas')
      const size = { w: (img?.width ?? r.w) / this.sheet.zoom, h: (img?.height ?? r.h) / this.sheet.zoom }
      this.cut(ctx, cat, key, r, this.sheet.path, size)
    }
    this.sheet.mount(el.querySelector<HTMLElement>('#asSheet')!)
  }

  /** The parts of an entry a cut may set. */
  private partsOf(kind: Kind, v: unknown): [string, string][] {
    if (kind === 'fixture') {
      const f = (v ?? {}) as { variants?: SpriteDef[] }
      return [['base', t('as it is')], ['open', t('open')], ['lit', t('lit')], ['across', t('turned across')], ...(f.variants ?? []).map((_, i): [string, string] => [`v${i}`, t('look {n}', { n: i + 1 })]), ['v+', t('+ a look')]]
    }
    if (kind === 'sprites') return [...((v as SpriteDef[]) ?? []).map((_, i): [string, string] => [String(i), `#${i + 1}`]), ['+', t('+ another')]]
    return []
  }

  /** An entry's fields, by its kind. */
  private form(kind: Kind, v: unknown): string {
    const num = (k: string, val: unknown, hint = k) => `<label class="inline">${esc(hint === k ? hint : t(hint))} <input type="number" data-k="${esc(k)}" value="${esc(val ?? '')}"></label>`
    const bool = (k: string, val: unknown, hint: string) => `<label class="inline"><input type="checkbox" data-k="${esc(k)}" ${val ? 'checked' : ''}> ${esc(t(hint))}</label>`
    const text = (k: string, val: unknown, hint = k) => `<label>${esc(hint === k ? hint : t(hint))} <input data-k="${esc(k)}" value="${esc(val ?? '')}"></label>`
    if (v === undefined && kind !== 'sound' && kind !== 'roles') return `<p class="muted">${t('Open a picture below and drag over it: the cut makes this entry.')}</p>`
    switch (kind) {
      case 'sprite': {
        const s = v as SpriteDef
        return `<p><code>${esc(s.img)}</code></p><div>${num('x', s.x)}${num('y', s.y)}${num('w', s.w)}${num('h', s.h)}</div><div>${num('ax', s.ax, phrase('anchor x'))}${num('ay', s.ay, phrase('anchor y'))}</div><div>${num('frames', s.frames)}${num('step', s.step)}${num('fps', s.fps)}</div>`
      }
      case 'fixture': {
        const f = v as { ground?: boolean; loose?: boolean; open?: SpriteDef; lit?: SpriteDef; across?: SpriteDef; variants?: SpriteDef[] }
        return `<p class="muted">${t('Its parts: {list}.', { list: [t('as it is'), f.open && t('open'), f.lit && t('lit'), f.across && t('turned across'), f.variants?.length && t('{n} looks', { n: f.variants.length })].filter(Boolean).join(', ') })}</p>${bool('ground', f.ground, phrase('drawn flat on the ground'))}<br>${bool('loose', f.loose, phrase('set a little off the grid'))}
          ${['open', 'lit', 'across'].filter((p) => (f as Record<string, unknown>)[p]).map((p) => `<button data-drop="${p}">${t('no {part}', { part: partName(p) })}</button>`).join(' ')} ${f.variants?.length ? `<button data-drop="variants">${t('no looks')}</button>` : ''}`
      }
      case 'actor': {
        const a = v as ActorDef
        return `<p><code>${esc(a.dir)}/${esc(a.sheet)}</code></p><div>${num('cols', a.cols, phrase('columns (directions)'))}${num('rows', a.rows, phrase('rows (frames)'))}</div>${text('faceset', a.faceset, phrase('portrait (a file in its folder)'))}<div>${num('scale', a.scale)}${num('anchorY', a.anchorY, phrase('anchor y'))}</div>${text('tint', a.tint !== undefined ? `#${a.tint.toString(16).padStart(6, '0')}` : '', phrase('tint (#rrggbb)'))}`
      }
      case 'blob': {
        const b = v as { img: string; col: number; row: number }
        return `<p><code>${esc(b.img)}</code></p>${num('col', b.col)}${num('row', b.row)}<p class="muted">${t('The block\'s top-left cell: drag over it in the picture.')}</p>`
      }
      case 'room': {
        const r = v as { img: string; col: number; row: number; size: number }
        return `<p><code>${esc(r.img)}</code></p>${num('col', r.col)}${num('row', r.row)}${num('size', r.size, phrase('size (cells)'))}`
      }
      case 'fx': {
        const f = v as FxDef
        return `<p><code>${esc(f.img)}</code></p><div>${num('fw', f.fw, phrase('frame w'))}${num('fh', f.fh, phrase('frame h'))}${num('frames', f.frames)}${num('fps', f.fps)}${num('scale', f.scale)}</div>${bool('vertical', f.vertical, phrase('frames in a column'))} ${bool('add', f.add, phrase('drawn additively (fire, sparks)'))}`
      }
      case 'plain':
      case 'sprites': {
        const n = (v as unknown[]).length
        return `<p>${kind === 'plain' ? t('{n} tiles, one picked per cell. A cut adds every cell of it.', { n }) : t('{n} pictures, one picked per cell. A cut adds one, or sets the one chosen.', { n })}</p>${n ? `<button data-drop="last">${t('Take the last away')}</button> <button data-drop="all">${t('Clear')}</button>` : ''}`
      }
      case 'prefab': {
        const p = v as { grid: string[]; terrain?: string; ground?: boolean }
        return `<p class="muted">${t('Each tile: # solid, . free, D the door, a space nothing.')}</p><textarea data-k="grid" rows="${Math.min(12, p.grid.length + 1)}">${esc(p.grid.join('\n'))}</textarea>${text('terrain', p.terrain, phrase('the solid cells\' terrain (default wall)'))}${bool('ground', p.ground, phrase('drawn as ground'))}`
      }
      case 'sound':
        return this.soundForm(v as string | undefined)
      case 'roles':
        return `<p class="muted">${t('Its characters (one picked per person):')}</p><div id="asRoleChars"></div>`
    }
  }

  private soundForm(path: string | undefined): string {
    const sounds = [...(this.files ?? []).filter((f) => f.kind === 'sound').map((f) => ({ path: catalogPath(f.path), from: 'project' })), ...(this.pack ?? []).filter((f) => f.kind === 'sound' && !(this.files ?? []).some((x) => x.path === `na/${f.path}`)).map((f) => ({ path: f.path, from: 'pack' }))]
    return `<label>${t('the sound')} <select data-k="sound"><option value="">—</option>${sounds.map((s) => `<option value="${esc(s.path)}" ${s.path === path ? 'selected' : ''}>${esc(s.path)}${s.from === 'pack' ? ` ${t('(pack)')}` : ''}</option>`).join('')}</select></label>${path ? `<button id="asPlay">▶ ${t('Play')}</button>` : ''}`
  }

  private bindForm(ctx: Ctx, el: HTMLElement, cat: CatId, key: string, kind: Kind, v: unknown): void {
    const set = (why: string, fn: (entry: Record<string, unknown>, into: Record<string, unknown>) => void) => this.edit(ctx, `${key}: ${why}`, (c) => { const into = c[cat] as Record<string, unknown>; fn(into[key] as Record<string, unknown>, into) })
    el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-k]').forEach((inp) => (inp.onchange = async () => {
      const k = inp.dataset.k!
      if (k === 'sound') {
        const p = inp.value
        if (!p) return
        if (!OWN.test(p) && !(this.files ?? []).some((f) => f.path === `na/${p}`)) await this.take(ctx, [p])
        return this.edit(ctx, `${key}: ${p}`, (c) => ((c[cat] as Record<string, string>)[key] = p))
      }
      set(k, (e) => {
        if (inp instanceof HTMLInputElement && inp.type === 'checkbox') (inp.checked ? (e[k] = true) : delete e[k])
        else if (k === 'grid') e.grid = inp.value.split('\n')
        else if (k === 'tint') (inp.value.trim() ? (e.tint = parseInt(inp.value.replace('#', ''), 16)) : delete e.tint)
        else if (inp instanceof HTMLInputElement && inp.type === 'number') (inp.value === '' ? delete e[k] : (e[k] = Number(inp.value)))
        else inp.value.trim() ? (e[k] = inp.value.trim()) : delete e[k]
      })
    }))
    el.querySelectorAll<HTMLElement>('[data-drop]').forEach((b) => (b.onclick = () => {
      const d = b.dataset.drop!
      if (kind === 'plain' || kind === 'sprites') return this.edit(ctx, d === 'all' ? t('{key}: cleared', { key }) : t('{key}: one less', { key }), (c) => { const l = (c[cat] as Record<string, unknown[]>)[key]; if (d === 'all') l.length = 0; else l.pop() })
      set(t('no {part}', { part: d }), (e) => delete e[d])
      this.part = 'base'
    }))
    el.querySelector<HTMLButtonElement>('#asPlay')?.addEventListener('click', () => void new Audio(this.url(ctx, v as string)).play().catch((e: Error) => toast(e.message, 'warn')))
    const chars = el.querySelector<HTMLElement>('#asRoleChars')
    if (chars) {
      const have = new Set((v as string[] | undefined) ?? [])
      chars.innerHTML = Object.keys(this.catalog(ctx).characters).map((c) => `<label class="inline"><input type="checkbox" data-char="${esc(c)}" ${have.has(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('<br>') || `<p class="muted">${t('No characters yet: make one under Characters.')}</p>`
      chars.querySelectorAll<HTMLInputElement>('[data-char]').forEach((b) => (b.onchange = () => this.edit(ctx, t('the role {key}', { key }), (c) => {
        const l = new Set(c.roles[key] ?? [])
        if (b.checked) l.add(b.dataset.char!)
        else l.delete(b.dataset.char!)
        c.roles[key] = [...l]
      })))
    }
  }

  /** How an entry looks. */
  private async preview(ctx: Ctx, el: HTMLElement, kind: Kind, v: unknown): Promise<void> {
    if (v === undefined) return
    const canvas = (label = '') => { const box = document.createElement('div'); box.className = 'as-shot'; box.innerHTML = `<canvas></canvas><small>${esc(label)}</small>`; el.appendChild(box); return box.querySelector('canvas')! }
    const sprite = (s: SpriteDef | undefined, label: string) => s?.img && drawSprite(canvas(label), this.url(ctx, s.img), s, s.w > 32 ? 2 : 4)
    if (kind === 'sprite') await sprite(v as SpriteDef, t('as drawn, its anchor marked'))
    else if (kind === 'fixture') {
      const f = v as Record<string, SpriteDef> & { variants?: SpriteDef[] }
      for (const p of ['base', 'open', 'lit', 'across']) await sprite(f[p], partName(p))
      for (const [i, s] of (f.variants ?? []).entries()) await sprite(s, t('look {n}', { n: i + 1 }))
    } else if (kind === 'sprites') for (const [i, s] of (v as SpriteDef[]).entries()) await sprite(s, `#${i + 1}`)
    else if (kind === 'plain') for (const [i, [img, col, row]] of (v as [string, number, number][]).entries()) await drawSprite(canvas(`#${i + 1}`), this.url(ctx, img), { x: col * 16, y: row * 16, w: 16, h: 16 }, 3)
    else if (kind === 'actor') { const a = v as ActorDef; await drawGrid(canvas(t('{cols} directions × {rows} frames', { cols: a.cols, rows: a.rows })), this.url(ctx, `${a.dir}/${a.sheet}`), a.cols, a.rows, 2); if (a.faceset) await drawSprite(canvas(t('portrait')), this.url(ctx, `${a.dir}/${a.faceset}`), { x: 0, y: 0, w: 38, h: 38 }, 2) }
    else if (kind === 'blob') { const b = v as { img: string; col: number; row: number }; await drawSprite(canvas(t('the block')), this.url(ctx, b.img), { x: b.col * 16, y: b.row * 16, w: 160, h: 80 }, 2) }
    else if (kind === 'room') { const r = v as { img: string; col: number; row: number; size: number }; await drawSprite(canvas(t('the walls')), this.url(ctx, r.img), { x: r.col * 16, y: r.row * 16, w: r.size * 16, h: r.size * 16 }, 2) }
    else if (kind === 'fx') { const f = v as FxDef; await drawSprite(canvas(t('{n} frames at {fps}/s', { n: f.frames, fps: f.fps })), this.url(ctx, f.img), { x: 0, y: 0, w: f.fw, h: f.fh, frames: Math.min(f.frames, 8), ...(f.vertical && { step: 0 }) }, f.fw > 32 ? 1 : 3) }
    else if (kind === 'prefab') { const p = v as { img: string; x: number; y: number; tw: number; th: number }; await drawSprite(canvas(t('{w}×{h} tiles', { w: p.tw, h: p.th })), this.url(ctx, p.img), { x: p.x, y: p.y, w: p.tw * 16, h: p.th * 16 }, 2) }
  }

  // ------------------------------------------------------------------ the files

  private filesView(ctx: Ctx, el: HTMLElement, view: { files: 'project' | 'pack'; back?: { cat: CatId; key?: string } }): void {
    const list = (view.files === 'project' ? this.files : this.pack) ?? []
    const q = this.filter.toLowerCase()
    const shown = list.filter((f) => !q || f.path.toLowerCase().includes(q))
    const url = (f: AssetFile) => (view.files === 'pack' ? encodeURI(`/pack/${f.path}`) : encodeURI(`/games/${encodeURIComponent(this.key(ctx))}/assets/${f.path}`))
    el.innerHTML = `<h3>${view.files === 'project' ? t('The project\'s pictures and sounds') : t('The pack: Ninja Adventure (CC0, by Pixel-boy and AAA)')}</h3>
      <p class="muted">${view.back ? (view.files === 'pack' ? t('Choose a picture for {what}: it is copied into the project.', { what: `<b>${esc(view.back.key ?? view.back.cat)}</b>` }) : t('Choose a picture for {what}.', { what: `<b>${esc(view.back.key ?? view.back.cat)}</b>` })) : view.files === 'project' ? t('Under assets/: the pack\'s under na/, yours under own/ (imported), the game\'s own under lsw/.') : t('A file of the pack is copied into the project (its assets/na/) when an entry uses it.')}</p>
      <div class="row"><input id="asFilter" placeholder="${t('filter by name (Character, Tileset, Monster …)')}" value="${esc(this.filter)}">${view.back ? `<button id="asBack">${t('Back')}</button>` : ''}</div>
      <div class="as-files">${shown.slice(0, 400).map((f) => `<a class="as-file" data-path="${esc(f.path)}" title="${esc(f.path)}">${f.kind === 'image' ? `<img src="${esc(url(f))}" loading="lazy">` : '<span class="as-note">♪</span>'}<small>${esc(f.path.split('/').slice(-2).join('/'))}${f.w ? ` · ${f.w}×${f.h}` : ''}</small>${view.files === 'project' && f.path.startsWith('own/') ? `<button data-rm="${esc(f.path)}" title="${t('Remove it from the project')}">×</button>` : ''}</a>`).join('') || `<p class="muted">${t('Nothing here.')}</p>`}</div>
      ${shown.length > 400 ? `<p class="muted">${t('{n} more: narrow the filter.', { n: shown.length - 400 })}</p>` : ''}`
    const filter = el.querySelector<HTMLInputElement>('#asFilter')!
    filter.oninput = () => { this.filter = filter.value; this.filesView(ctx, el, view); el.querySelector<HTMLInputElement>('#asFilter')!.focus() }
    el.querySelector<HTMLButtonElement>('#asBack')?.addEventListener('click', () => ((this.view = view.back!), ctx.refresh()))
    el.querySelectorAll<HTMLElement>('[data-rm]').forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation()
      if (!confirm(t('Remove {file} from the project\'s files?', { file: b.dataset.rm! }))) return
      await call(`/api/projects/${encodeURIComponent(this.key(ctx))}/assets/${b.dataset.rm}`, { method: 'DELETE' }).catch((x: Error) => toast(x.message, 'error'))
      await this.load(ctx, true)
    }))
    el.querySelectorAll<HTMLElement>('[data-path]').forEach((a) => (a.onclick = async () => {
      const f = list.find((x) => x.path === a.dataset.path)!
      if (f.kind === 'sound') return void new Audio(url(f)).play().catch(() => {})
      const path = view.files === 'pack' ? f.path : catalogPath(f.path)
      if (view.files === 'pack') await this.take(ctx, [f.path])
      await this.sheet.open(this.url(ctx, path), path)
      this.view = view.back ?? { cat: 'items' }
      ctx.refresh()
    }))
  }

  /** Pack files copied into the project. */
  private async take(ctx: Ctx, paths: string[]): Promise<void> {
    try {
      await call(`/api/projects/${encodeURIComponent(this.key(ctx))}/assets/from-pack`, { body: { paths } })
      await this.load(ctx, true)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  /** Files from the disk, imported under own/ (a picture opened in the sheet). */
  private async import(ctx: Ctx, files: File[]): Promise<void> {
    let last: string | undefined
    for (const f of files) {
      const name = f.name.replace(/[^A-Za-z0-9._-]+/g, '_')
      try {
        await call(`/api/projects/${encodeURIComponent(this.key(ctx))}/assets/own/${encodeURIComponent(name)}`, { method: 'PUT', raw: await f.arrayBuffer() })
        if (f.type.startsWith('image/')) last = `own/${name}`
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`, 'error')
      }
    }
    await this.load(ctx, true)
    toast(t('Imported {n} file(s) under own/.', { n: files.length }))
    if (last) {
      await this.sheet.open(this.url(ctx, last), last, undefined, true)
      if ('files' in this.view) this.view = this.view.back ?? { files: 'project' }
      ctx.refresh()
    }
  }
}
