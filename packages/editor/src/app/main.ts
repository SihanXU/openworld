// The OpenWorld Editor (docs/engine-split.md §6, P4–P6, §15): RPG Maker's feel over OpenWorld's model. Without
// `?project=` it shows the projects it knows, makes a new one from a template and opens any folder (home.ts);
// with it, it edits that project — its maps, its people, (P5) its database, rules, story and quests, (P6) its
// holes with the AI, its pictures and sounds — on the runtime's own renderer, plays it from any cell, and exports
// it as a game anyone can play.

import '@openworld/modules'
import { useGame } from '@openworld/runtime/src/game.ts'
import { clientGameOf } from '@openworld/runtime/src/bundle.ts'
import { Canvas, ZOOMS } from './canvas.ts'
import type { PersonFile } from '@openworld/format'
import type { RawChunk } from '@openworld/engine'
import type { Ctx, Mode } from './context.ts'
import { MapMode } from './mapMode.ts'
import { mapTree, paintMinis } from './mapTree.ts'
import { PeopleMode } from './peopleMode.ts'
import { ProblemsPanel } from './problems.ts'
import { Store } from './store.ts'
import { $, esc, t, toast, tx } from './ui.ts'
import { loadUiLang } from './lang.ts'
import { settingsDialog } from './dialogs.ts'
import { gameLangs, langName, previewLang, setPreviewLang, useProject } from './words.ts'
import { home } from './home.ts'
import { exportDialog } from './exportDialog.ts'
import { MODES as MORE } from './modes.ts'
import { icon } from './icons.ts'
import { navGroups } from './nav.ts'
import { keepScroll } from './scroll.ts'
import './editor.css'

const PARAMS = new URLSearchParams(location.search)
/** How long after the last edit the project saves itself. */
const AUTOSAVE_MS = 1500
const project = PARAMS.get('project')

// the editor's own language first (its settings): every panel is drawn in it
void loadUiLang().then(() => {
  if (!project) void home()
  else void openProject(project).catch((e: Error) => {
    document.body.innerHTML = `<div class="home"><h1>${t('OpenWorld Editor')}</h1><p class="warn">${esc(e.message)}</p><p><a href="./">${t('Back to the projects')}</a></p></div>`
  })
})

// ------------------------------------------------------------------ a project

async function openProject(id: string): Promise<void> {
  const store = await Store.open(id)
  useProject(store)
  // the runtime's renderer reads the game it is handed: the project as compiled now, its assets where it is served
  useGame(clientGameOf(store.compiled().bundle, `/games/${encodeURIComponent(id)}/bundle.json`))
  document.body.innerHTML = `<div class="editor">
    <header><a href="./" class="home-link">${t('OpenWorld Editor')}</a> <b id="gameName"></b> <nav id="modes"></nav>
      <span class="grow"></span><span id="status" class="muted"></span>
      <button id="undo" class="ic"></button><button id="redo" class="ic"></button><button id="save" title="Ctrl+S">${t('Save')}</button><span id="previewLang"></span><button id="play" title="${t('Save, and play from the start (or the selected cell)')}">${icon('play', 16)} ${t('Playtest')}</button><button id="export" title="${t('Save, and make the game a folder anyone can play')}">${t('Export…')}</button><button id="settings" title="${t('The editor\'s settings: its own language')}">⚙</button></header>
    <aside id="left"></aside><main id="canvas"><div id="statusbar"><span id="sbCell" class="muted"></span><span class="grow"></span><button id="sbGrid" title="${t('the grid (G)')}">${t('Grid')}</button><span class="sep"></span><button id="sbOut" title="${t('zoom out (-)')}">−</button>${ZOOMS.map((z) => `<button data-zoom="${z}">${z * 100}%</button>`).join('')}<button id="sbIn" title="${t('zoom in (+)')}">+</button><button id="sbFit" title="${t('the whole map (0)')}">${t('Fit')}</button></div></main><main id="center" class="hidden"></main><aside id="right"></aside>
    <div id="toolbar" class="hidden"></div><div id="toolstrip" class="hidden"></div>
    <footer id="problems"></footer><div id="toasts"></div></div>`
  const canvas = new Canvas($('#canvas'))
  const modes: Mode[] = [new MapMode(), new PeopleMode(), ...MORE]
  let mode = modes[0]
  const problems = new ProblemsPanel($('#problems'), () => ctx)
  const ctx: Ctx = {
    store,
    canvas,
    map: store.game.start.map,
    sel: {},
    onto: () => store.compiled().bundle.ontology,
    showMap(m, at) {
      if (!store.mapFile(m)) return
      if (ctx.map !== m) ctx.sel = { person: ctx.sel.person }
      ctx.map = m
      canvas.show(store.compiled(), m, at ?? (store.game.start.map === m ? store.game.start : undefined))
      ctx.refresh()
    },
    refresh,
    async playtest(at, o) {
      await save()
      const where = at ?? (o?.scene ? undefined : ctx.sel.cell ? { map: ctx.map, ...ctx.sel.cell } : undefined)
      window.open(`/runtime/play/?game=/games/${encodeURIComponent(id)}/&playtest=1&modder=off&lang=${encodeURIComponent(previewLang())}${where ? `&at=${encodeURIComponent(`${where.map},${where.x},${where.y}`)}` : ''}${o?.scene ? `&scene=${encodeURIComponent(o.scene)}` : ''}`, '_blank')
    },
    open(m, file, at) {
      const next = modes.find((x) => x.id === m)
      if (!next) return
      if (picking) endPick(undefined)
      mode = next
      if (file || at) next.focus?.(ctx, file ?? '', at)
      refresh()
    },
    pick(why, map) {
      picking?.done(undefined)
      return new Promise((done) => {
        picking = { why, done }
        if (map && store.mapFile(map)) ctx.map = map
        canvas.show(store.compiled(), ctx.map)
        refresh()
      })
    },
  }
  // a cell asked for (a scene's move, a trigger's spot): the canvas shown with the maps to choose among, until one is clicked or Esc
  let picking: { why: string; done: (p?: { map: string; x: number; y: number }) => void; hover?: { x: number; y: number } } | undefined
  function endPick(p?: { map: string; x: number; y: number }): void {
    const k = picking
    picking = undefined
    k?.done(p)
    refresh()
  }
  function pickPanel(): void {
    const left = $('#left')
    left.innerHTML = `<h3>${t('Pick a cell')}</h3><p>${esc(t('{why}: click it on the map.', { why: picking!.why }))}</p><button id="pkCancel">${t('Cancel (Esc)')}</button><h3>${t('Maps')}</h3>${mapTree(ctx)}`
    paintMinis(ctx, left)
    left.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) => (b.onclick = () => ctx.showMap(b.dataset.map!)))
    $<HTMLButtonElement>('#pkCancel').onclick = () => endPick(undefined)
    $('#right').innerHTML = `<p class="muted">${t('The cell you click is written into the field that asked for it.')}</p>`
    canvas.setOverlay((g, T) => {
      const h = picking?.hover
      if (h) (g.fillStyle(0xffd23f, 0.35), g.fillRect(h.x * T, h.y * T, T, T), g.lineStyle(2, 0xffd23f, 1), g.strokeRect(h.x * T, h.y * T, T, T))
    })
  }
  // the renderer loads the game's pictures as it starts: a changed catalogue starts it again (when it is next shown)
  let pictures = false
  function refresh(): void {
    $('#gameName').textContent = tx(store.game.name)
    // the modes in the groups an author works in; the rest under More
    const nav = navGroups(modes.map((m) => m.id))
    const btn = (id: string) => { const m = modes.find((x) => x.id === id)!; return `<button data-mode="${m.id}" class="${m === mode ? 'on' : ''}">${esc(t(m.label))}</button>` }
    const inMore = nav.more.includes(mode.id)
    $('#modes').innerHTML = `${nav.groups.map((g) => `<span class="ngrp">${g.map(btn).join('')}</span>`).join('')}${nav.more.length ? `<span class="more"><button id="moreBtn" class="${inMore ? 'on' : ''}">${inMore ? esc(t(mode.label)) : t('More')} ▾</button><span class="menu" hidden>${nav.more.map(btn).join('')}</span></span>` : ''}`
    const menu = document.querySelector<HTMLElement>('#modes .menu')
    document.querySelector<HTMLButtonElement>('#moreBtn')?.addEventListener('click', (e) => { e.stopPropagation(); if (menu) menu.hidden = !menu.hidden })
    // the preview language: what a line's preview and a playtest say (the game's languages; not the editor's own)
    const langs = gameLangs()
    $('#previewLang').innerHTML = langs.length > 1 ? `<select id="pvLang" title="${t('The language the game is previewed and playtested in (its words as translated); the editor\'s own language is in its settings')}">${langs.map((l) => `<option value="${esc(l)}" ${l === previewLang() ? 'selected' : ''}>${esc(t('play in {lang}', { lang: langName(l) }))}</option>`).join('')}</select>` : ''
    const pv = document.querySelector<HTMLSelectElement>('#pvLang')
    if (pv) pv.onchange = () => (setPreviewLang(pv.value), refresh())
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => (b.onclick = () => ctx.open(b.dataset.mode!)))
    // a mode with a middle of its own draws there; the canvas waits (and keeps its place) behind it
    const center = $('#center')
    const main = picking ? undefined : mode.main
    $('#canvas').classList.toggle('hidden', !!main)
    center.classList.toggle('hidden', !main)
    if (picking) pickPanel()
    else if (main) keepScroll(mode.id, [center], () => main.call(mode, ctx, center))
    else if (pictures) {
      pictures = false
      useGame(clientGameOf(store.compiled().bundle, `/games/${encodeURIComponent(id)}/bundle.json`))
      canvas.reset()
    }
    if (!picking) {
      // (drawn again whole: each list keeps where it was scrolled to, as long as it is the same mode's)
      keepScroll(mode.id, [$('#left'), $('#right'), center], () => mode.render(ctx, $('#left'), $('#right')))
      canvas.setOverlay(mode.overlay?.(ctx))
    }
    // the strip of tools and their bar: over the canvas, while a mode on it has them
    const tools = !picking && !main && mode.toolbar
    $('#toolstrip').classList.toggle('hidden', !tools)
    $('#toolbar').classList.toggle('hidden', !tools)
    if (tools) mode.toolbar!(ctx, $('#toolstrip'), $('#toolbar'))
    const n = store.unsaved()
    $('#status').textContent = n ? t('{n} unsaved', { n }) : autosaved ? t('saved automatically') : t('saved')
    $<HTMLButtonElement>('#save').classList.toggle('hidden', !n)
    const next = store.next()
    $<HTMLButtonElement>('#undo').disabled = !next.undo
    $<HTMLButtonElement>('#undo').innerHTML = icon('undo', 16)
    $<HTMLButtonElement>('#undo').setAttribute('aria-label', t('Undo'))
    $<HTMLButtonElement>('#undo').title = next.undo ? t('Undo: {what} (Ctrl+Z)', { what: next.undo }) : t('Nothing to undo')
    $<HTMLButtonElement>('#redo').disabled = !next.redo
    $<HTMLButtonElement>('#redo').innerHTML = icon('redo', 16)
    $<HTMLButtonElement>('#redo').setAttribute('aria-label', t('Redo'))
    $<HTMLButtonElement>('#redo').title = next.redo ? t('Redo: {what} (Ctrl+Y)', { what: next.redo }) : t('Nothing to redo')
  }
  // the status bar: the cell under the pointer (its ground, height and things), the zoom, the grid
  function cellInfo(c: { x: number; y: number }): string {
    const f = store.mapFile(ctx.map)
    const ch = f ? store.get<RawChunk>(f) : undefined
    if (!ch || c.x < 0) return ''
    const char = ch.map.rows[c.y]?.[c.x] ?? ''
    const terrain = store.game.terrainChars[char] ?? '?'
    const things = ch.entities.filter((e) => e.place.on === 'tile' && e.place.x === c.x && e.place.y === c.y)
    const people = store.list<PersonFile>('people').filter((p) => p.data.place.on === 'tile' && p.data.place.map === ctx.map && p.data.place.x === c.x && p.data.place.y === c.y)
    const what = [...people.map((p) => tx(p.data.name) || p.data.id), ...things.map((e) => e.type.split('/').pop())]
    return `${esc(ctx.map)} · <b>${c.x}, ${c.y}</b> · ${esc(tx(ctx.onto().terrains[terrain]?.name) || terrain)} <code>${esc(char)}</code> · ${t('height {h}', { h: ch.map.heights?.[c.y]?.[c.x] ?? '0' })}${what.length ? ` · ${esc(what.join(', '))}` : ''}`
  }
  function zoomShown(): void {
    const z = canvas.zoom
    document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => b.classList.toggle('on', Math.abs(Number(b.dataset.zoom) - z) < 0.01))
    $('#sbGrid').classList.toggle('on', canvas.grid)
  }
  canvas.onView = zoomShown
  const step = (dir: 1 | -1) => canvas.zoomTo(dir > 0 ? (ZOOMS.find((z) => z > canvas.zoom + 0.01) ?? ZOOMS[ZOOMS.length - 1]) : ([...ZOOMS].reverse().find((z) => z < canvas.zoom - 0.01) ?? ZOOMS[0]))
  const grid = () => ((canvas.grid = !canvas.grid), canvas.redraw(), zoomShown())
  document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => (b.onclick = () => canvas.zoomTo(Number(b.dataset.zoom))))
  $<HTMLButtonElement>('#sbIn').onclick = () => step(1)
  $<HTMLButtonElement>('#sbOut').onclick = () => step(-1)
  $<HTMLButtonElement>('#sbFit').onclick = () => canvas.fit()
  $<HTMLButtonElement>('#sbGrid').onclick = grid
  // one save at a time: an autosave, Ctrl+S and a playtest's never write the files at once
  let saving: Promise<void> | undefined
  async function save(): Promise<void> {
    while (saving) await saving.catch(() => undefined)
    if (!store.unsaved()) return
    saving = store.save()
    try {
      await saving
    } catch (e) {
      toast((e as Error).message, 'error')
      throw e
    } finally {
      saving = undefined
    }
  }
  // the project saved by itself a moment after the author stops editing (a page closed or reloaded loses nothing)
  let autosaved = false
  let autosave = 0
  const soon = () => {
    clearTimeout(autosave)
    autosave = window.setTimeout(() => void save().then(() => ((autosaved = true), refresh())).catch(() => undefined), AUTOSAVE_MS)
  }
  canvas.onCell = (c, ev) => {
    if (ev === 'hover' || ev === 'drag' || ev === 'rdrag' || ev === 'leave') $('#sbCell').innerHTML = cellInfo(c)
    if (picking) {
      if (ev === 'hover' || ev === 'leave') (picking.hover = ev === 'leave' ? undefined : c), canvas.redraw()
      if (ev === 'down') endPick({ map: ctx.map, ...c })
      return
    }
    mode.cell?.(ctx, c, ev)
  }
  // the canvas follows the project: drawn again a frame after an edit (a stroke is many)
  let redraw = 0
  store.on((why, file) => {
    if (why !== 'saved' && store.unsaved()) soon()
    // (`compiled`: the whole project compiled again once editing rested, its problems with it)
    if (why !== 'saved' && (!file || file === store.mapFile(ctx.map) || file.startsWith('people/') || file === 'game.json' || file.startsWith('ontology/'))) {
      cancelAnimationFrame(redraw)
      redraw = requestAnimationFrame(() => canvas.show(store.compiled(), ctx.map))
    }
    if (file === 'catalog.json') pictures = true
    if (why.startsWith('undo: ')) toast(t('Undone: {what}', { what: why.slice(6) }))
    if (why.startsWith('redo: ')) toast(t('Made again: {what}', { what: why.slice(6) }))
    problems.soon()
    refresh()
  })
  $<HTMLButtonElement>('#undo').onclick = () => store.undo() ?? toast(t('Nothing to undo.'), 'warn')
  $<HTMLButtonElement>('#redo').onclick = () => store.redo() ?? toast(t('Nothing to redo.'), 'warn')
  $<HTMLButtonElement>('#save').onclick = () => void save().then(() => ((autosaved = false), refresh(), toast(t('Saved.'))))
  $<HTMLButtonElement>('#settings').onclick = () => settingsDialog()
  $<HTMLButtonElement>('#play').onclick = () => void ctx.playtest()
  $<HTMLButtonElement>('#export').onclick = () => void save().then(() => exportDialog(id, store))
  // the keys: Ctrl+S anywhere; the rest only while no field is being typed in (a field's own Ctrl+Z is its own)
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 's') return (e.preventDefault(), void save().then(() => ((autosaved = false), refresh(), toast(t('Saved.')))))
    const el = e.target as HTMLElement
    if (picking && e.key === 'Escape') return endPick(undefined)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable) return
    if (mod && k === 'z' && !e.shiftKey) return (e.preventDefault(), void store.undo())
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) return (e.preventDefault(), void store.redo())
    if (!picking && mode.keydown?.(ctx, e)) return e.preventDefault()
    if ((mode.main && !picking) || mod || e.altKey) return
    if (k === 'g') grid()
    else if (k === '+' || k === '=') step(1)
    else if (k === '-') step(-1)
    else if (k === '0') canvas.fit()
  })
  document.addEventListener('click', () => { const m = document.querySelector<HTMLElement>('#modes .menu'); if (m) m.hidden = true })
  window.addEventListener('beforeunload', (e) => { if (store.unsaved()) e.preventDefault() })
  ctx.showMap(ctx.map)
  problems.update()
}

