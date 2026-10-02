// The heads-up display (design.md §5.3): the clock box top right with the journal button under
// it, the health bar bottom right, the toolbar at the bottom,
// messages bottom left, the map name as it fades in, the two keys' labels over the target, the
// dialogue box and the yes/no question, speech bubbles and floating numbers.

import type { Frame, FxEvent, ItemInfo, KeyView, Text, WorldIndex } from '@lsw/engine'
import { OBJECTIVES } from '@lsw/content'
import { $, MOOD_GLYPH, SLOT_KEYS, controlsTable, esc, locale, t, tx } from './common.ts'

export interface HudSend {
  select(slot: number): void
  answer(yes: boolean): void
  advance(): void
  openMenu(tab?: string): void
  openJournal(): void
}

export class Hud {
  frame?: Frame
  muted = (() => {
    try {
      return localStorage.getItem('lsw.muted') === '1'
    } catch {
      return false
    }
  })()
  onSound?: (muted: boolean) => void
  /** Set by main.ts: paints item icons (from Phaser textures) into [data-icon] slots. */
  paintIcons?: (items: ItemInfo[]) => void
  facesetOf?: (id: string) => HTMLCanvasElement | undefined
  /** Set by main.ts: the threads' docs, for the "a new thread is woven" message. */
  threadDoc?: (rule: string) => string | undefined
  modderOnline = false

  private bubbles = new Map<string, { el: HTMLElement; until: number; who: string }>()
  private floaters: { el: HTMLElement; born: number; who: string }[] = []
  private flyers: { el: HTMLElement; born: number; from: { x: number; y: number } }[] = []
  private dotEls = new Map<string, HTMLElement>()

  constructor(
    private send: HudSend,
    private screenOf: (id: string) => { x: number; y: number } | undefined,
    private screenOfTile: (x: number, y: number) => { x: number; y: number },
  ) {
    this.build()
  }

  // ---------------------------------------------------------------- skeleton

  private build(): void {
    $('#hud').innerHTML = `
      <div class="clockbox wood" id="clockbox">
        <div class="cb-date" id="cbDate"></div>
        <div class="cb-mid"><div class="dial" id="dial"><div class="hand" id="dialHand"></div></div><span class="cb-icons" id="cbIcons"></span></div>
        <div class="cb-time" id="cbTime"></div>
        <button class="jbtn" id="jbtn" title="F">!</button>
        <button class="mbtn" id="mbtn" title="Esc">☰</button>
      </div>
      <div class="objective" id="objective"><div class="ob-title" id="obTitle"></div></div>
      <div class="bars" id="bars">
        <div class="vbar hp hidden" id="hpBar" title=""><div class="fill" id="hpFill"></div><span>HP</span></div>
      </div>
      <div class="toolbar wood" id="toolbar"></div>
      <div class="msgs" id="msgs"></div>
      <div class="mapname" id="mapname"></div>
      <div class="keys" id="keys"></div>
      <div class="chooser hidden" id="chooser"></div>
      <div class="dialog hidden" id="dialog"><div class="face" id="dFace"></div><div class="dtext"><div class="dname" id="dName"></div><div class="dline" id="dLine"></div><div class="dchoices hidden" id="dChoices"></div></div><div class="dmore" id="dMore">▼</div></div>
      <div class="fade hidden" id="fade"><div id="fadeText"></div></div>
      <div class="card hidden" id="card"><div class="card-text" id="cardText"></div><div class="dmore">▼</div></div>`
    $('#jbtn').onclick = () => this.send.openJournal()
    $('#mbtn').onclick = () => this.send.openMenu()
    $('#dialog').onclick = (e) => {
      if ((e.target as HTMLElement).closest('[data-yes]')) return
      this.advanceDialog()
    }
    $('#card').onclick = () => this.advanceDialog()
  }

  // ---------------------------------------------------------------- intro

  showIntro(name: Text, stats: WorldIndex['stats'], resumed: boolean, onStart: (fresh: boolean) => void): void {
    const zh = locale.value === 'zh'
    const n = (x: number) => x.toLocaleString('en-US')
    $('#intro').innerHTML = `
      <div class="intro-card">
        <div class="kicker">OpenWorld</div>
        <h1>${esc(tx(name))}</h1>
        <p class="lede">${zh ? '一个渡口，在地图的尽头。河对岸，什么都还没写成。你可以做任何事——这个世界从没见过的事，它会学会，并且记住。' : 'A ford at the edge of the map. Past the river, nothing is written yet. Do anything you like — what the world has never seen, it learns, and remembers.'}</p>
        <div class="stats${import.meta.env.DEV ? '' : ' hidden'}">
          <div><b>${n(stats.maps)}</b><span>maps</span></div><div><b>${n(stats.npcs)}</b><span>people</span></div>
          <div><b>${n(stats.creatures)}</b><span>creatures</span></div><div><b>${n(stats.items)}</b><span>items</span></div>
          <div><b>${n(stats.itemKinds)}</b><span>item kinds</span></div><div><b>${n(stats.fixtures)}</b><span>fixtures</span></div>
        </div>
        <div class="controls-mini">${controlsTable(import.meta.env.DEV)}</div>
        <div class="credit">${zh ? '美术与音乐：' : 'Art & music: '}<a href="https://pixel-boy.itch.io/ninja-adventure-asset-pack" target="_blank" rel="noopener">Ninja Adventure</a> by Pixel-boy &amp; AAA (CC0)</div>
        <div class="intro-actions">
          ${resumed ? `<button id="iCont" class="primary">${zh ? '继续' : 'Continue'}</button><button id="iNew">${zh ? '新游戏' : 'New game'}</button>` : `<button id="iCont" class="primary">${zh ? '开始' : 'Start'}</button>`}
        </div>
      </div>`
    $('#intro').classList.remove('hidden')
    const go = (fresh: boolean) => {
      $('#intro').classList.add('hidden')
      onStart(fresh)
    }
    $('#iCont').onclick = () => go(false)
    const nb = document.querySelector<HTMLButtonElement>('#iNew')
    if (nb) nb.onclick = () => go(true)
  }

  // ---------------------------------------------------------------- per frame

  onFrame(f: Frame): void {
    this.frame = f
    this.renderClock(f)
    this.renderBars(f)
    this.renderToolbar(f)
    this.renderObjective(f)
    this.renderKeys(f)
    this.renderScene(f)
    this.renderQuestion(f)
    // while the world learns an act: the one acting is at work on it (a working bubble), the
    // things it is done to shimmer with dots
    const frozen = new Set(f.entities.filter((e) => e.frozen).map((e) => e.id))
    for (const id of frozen)
      if (!this.dotEls.has(id)) {
        const el = document.createElement('div')
        const actor = f.entities.find((e) => e.id === id)?.kind === 'actor'
        el.className = actor ? 'pending-dots working' : 'pending-dots'
        el.innerHTML = actor ? '<span class="gear">✦</span><i></i><i></i><i></i>' : '…'
        $('#labels').appendChild(el)
        this.dotEls.set(id, el)
      }
    for (const [id, el] of this.dotEls) if (!frozen.has(id)) (el.remove(), this.dotEls.delete(id))
  }

  private clockSig = ''
  private renderClock(f: Frame): void {
    const c = f.calendar
    const hh = Math.floor(f.hour)
    const mm = Math.floor((f.hour - hh) * 6) * 10 // Stardew's clock moves in 10-minute steps
    const zh = locale.value === 'zh'
    const time = zh ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`
    const sig = `${locale.value}|${c.day}|${c.weather}|${time}`
    if (sig === this.clockSig) return
    this.clockSig = sig
    $('#cbDate').textContent = zh ? `第 ${c.day} 天` : `Day ${c.day}`
    const night = f.hour < 6 || f.hour >= 19
    const weather = { sun: night ? '☾' : '☀', cloud: '☁', rain: '☂', storm: '⚡', fog: '≋' }[c.weather] ?? '☀'
    $('#cbIcons').innerHTML = `<span title="${esc(t(`weather.${c.weather}`))}">${weather}</span>`
    $('#cbTime').textContent = time
    // the dial: the hand sweeps from 6 am (left) over noon (top) to 2 am (right), like Stardew's
    const frac = Math.min(1, Math.max(0, (((f.hour - 6 + 24) % 24) / 20)))
    $<HTMLDivElement>('#dialHand').style.transform = `rotate(${-90 + frac * 180}deg)`
  }

  private renderBars(f: Frame): void {
    const p = f.player
    // health shows only when it is not full, or where it is dangerous
    const showHp = p.hp < p.maxHp || f.entities.some((e) => e.hostile)
    $('#hpBar').classList.toggle('hidden', !showHp)
    $<HTMLDivElement>('#hpFill').style.height = `${Math.max(0, (100 * p.hp) / p.maxHp)}%`
    $('#hpBar').title = `${t('health')} ${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`
  }

  private barSig = ''
  private renderToolbar(f: Frame): void {
    const row = f.player.slots.slice(0, SLOT_KEYS.length)
    // the toolbar moves to the top when the player walks near the bottom edge
    const me = this.screenOf(f.player.id)
    const top = !!me && me.y > window.innerHeight * 0.78
    $('#toolbar').classList.toggle('top', top)
    const sig = `${f.player.selected}|${row.map((s) => (s ? `${s.item.id}:${s.count}` : '')).join(',')}`
    if (sig === this.barSig) return
    this.barSig = sig
    $('#toolbar').innerHTML = row
      .map(
        (s, i) =>
          `<div class="slot${i === f.player.selected ? ' sel' : ''}" data-slot="${i}" title="${s ? esc(tx(s.item.name)) : ''}">` +
          `<span class="key">${SLOT_KEYS[i]}</span>${s ? `<div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}` : ''}</div>`,
      )
      .join('')
    $('#toolbar')
      .querySelectorAll<HTMLElement>('[data-slot]')
      .forEach((el) => (el.onclick = () => this.send.select(Number(el.dataset.slot))))
    this.paintIcons?.(row.filter(Boolean).map((s) => s!.item))
  }

  private obSig = ''
  private renderObjective(f: Frame): void {
    const stage = Number(f.player.props.quest ?? -1)
    const sig = `${locale.value}|${stage}`
    if (sig === this.obSig) return
    const changed = this.obSig !== '' && !this.obSig.endsWith(`|${stage}`)
    this.obSig = sig
    const o = OBJECTIVES[stage]
    $('#objective').classList.toggle('hidden', !o || !tx(o.title))
    if (!o) return
    $('#obTitle').textContent = tx(o.title)
    // a new objective: the journal button flashes (Stardew's "!")
    if (changed) $('#jbtn').classList.add('flash')
  }

  /** Called when the journal opens. */
  seenJournal(): void {
    $('#jbtn').classList.remove('flash')
  }

  private keySig = ''
  private renderKeys(f: Frame): void {
    const k = this.dialogOpen || f.question || f.scene ? undefined : f.keys
    const sig = k ? `${locale.value}|${JSON.stringify(k)}` : ''
    if (sig !== this.keySig) {
      this.keySig = sig
      const line = (key: string, v?: KeyView) =>
        v ? `<div class="kl${v.unknown ? ' unknown' : ''}"><kbd>${key}</kbd> ${esc(tx(v.label))}${v.unknown ? ` <span class="q">?</span>` : ''}</div>` : ''
      // every input's label is shown (foreseeable); a bare-handed left click is the same event as E, so they share a line
      const same = !!k?.hands && !!k?.use && JSON.stringify(k.hands.label) === JSON.stringify(k.use.label)
      $('#keys').innerHTML = k ? line(same ? `E · ${t('lmb')}` : 'E', k.hands) + line('F', k.take) + (same ? '' : line(t('lmb'), k.use)) + line(t('rmb'), k.put) : ''
    }
    const at = k?.hands ?? k?.take ?? k?.use ?? k?.put
    const el = $('#keys')
    el.classList.toggle('hidden', !at)
    if (at) {
      const s = this.screenOfTile(at.x, at.y)
      el.style.transform = `translate(${s.x}px, ${s.y - 30}px) translate(-50%, -100%)`
    }
  }

  // ---------------------------------------------------------------- the layer chooser (a long press)

  private pick?: (layer: number) => void
  private pickLayers: number[] = []

  get chooserOpen(): boolean {
    return !$('#chooser').classList.contains('hidden')
  }

  /** Everything at the tile, with what the input would do to each: click one (or press its number). */
  showChooser(key: string, tile: { x: number; y: number }, list: { layer: number; name: Text; label?: Text; unknown?: boolean }[], pick: (layer: number) => void): void {
    const el = $('#chooser')
    this.pick = pick
    this.pickLayers = list.map((c) => c.layer)
    el.innerHTML =
      `<div class="ch-head"><kbd>${esc(key)}</kbd> ${t('chooseTarget')}</div>` +
      list
        .map(
          (c, i) =>
            `<div class="ch-row${c.unknown ? ' unknown' : ''}" data-layer="${c.layer}"><kbd>${i + 1}</kbd> <b>${esc(tx(c.name))}</b>${c.label ? ` · ${esc(tx(c.label))}` : ''}${c.unknown ? ' <span class="q">?</span>' : ''}</div>`,
        )
        .join('')
    el.querySelectorAll<HTMLElement>('[data-layer]').forEach((row) => (row.onclick = () => this.choose(Number(row.dataset.layer))))
    const s = this.screenOfTile(tile.x, tile.y)
    el.style.transform = `translate(${s.x}px, ${s.y + 14}px) translate(-50%, 0)`
    el.classList.remove('hidden')
  }

  /** The n-th row (1-based), from a number key. */
  chooseNth(n: number): void {
    const layer = this.pickLayers[n - 1]
    if (layer !== undefined) this.choose(layer)
  }

  choose(layer: number): void {
    const pick = this.pick
    this.closeChooser()
    pick?.(layer)
  }

  closeChooser(): void {
    $('#chooser').classList.add('hidden')
    this.pick = undefined
  }

  // ---------------------------------------------------------------- dialogue and questions

  private typer?: ReturnType<typeof setInterval>
  private typedAll = true
  private fullText = ''
  /** The dialog shows a scene's line: advancing it moves the scene on. */
  private sceneDialog = false
  /** Who the open dialog belongs to while their name is still unknown (not yet in a frame). */
  private dialogUnnamed?: string
  private questionOpen = false

  get dialogOpen(): boolean {
    return !$('#dialog').classList.contains('hidden') || this.cardOpen
  }

  private cardOpen = false
  /** A full-screen card in a scene (the ending): E or a click moves on. */
  private openCard(text: string): void {
    if (this.cardOpen) return
    this.cardOpen = true
    $('#cardText').textContent = text
    $('#card').classList.remove('hidden')
  }

  get questionShown(): boolean {
    return this.questionOpen
  }

  openDialog(who: string, name: string, text: string, scene = false): void {
    this.sceneDialog = scene
    this.dialogUnnamed = name ? undefined : who
    const face = $('#dFace')
    face.replaceChildren()
    const c = this.facesetOf?.(who)
    if (c) face.appendChild(c)
    face.classList.toggle('hidden', !c)
    $('#dName').textContent = name
    $('#dChoices').classList.add('hidden')
    $('#dMore').classList.remove('hidden')
    this.type(text)
    $('#dialog').classList.remove('hidden')
  }

  private type(text: string): void {
    const line = $('#dLine')
    line.textContent = ''
    clearInterval(this.typer)
    this.fullText = text
    this.typedAll = false
    let i = 0
    this.typer = setInterval(() => {
      i += 2
      line.textContent = text.slice(0, i)
      if (i >= text.length) (clearInterval(this.typer), (this.typedAll = true))
    }, 22)
  }

  /** E (or a click) on an open dialog: the first press finishes the typing, the next moves on. */
  advanceDialog(): void {
    if (this.questionOpen) return
    if (this.cardOpen) {
      this.cardOpen = false
      $('#card').classList.add('hidden')
      return this.send.advance()
    }
    if (!this.typedAll) {
      clearInterval(this.typer)
      $('#dLine').textContent = this.fullText
      this.typedAll = true
      return
    }
    $('#dialog').classList.add('hidden')
    if (this.sceneDialog) {
      this.sceneDialog = false
      this.send.advance()
    }
  }

  private renderScene(f: Frame): void {
    if (this.cardOpen && f.scene?.waiting !== 'advance') {
      this.cardOpen = false
      $('#card').classList.add('hidden')
    }
    if (this.cardOpen) return
    if (this.sceneDialog && f.scene?.waiting !== 'advance') {
      this.sceneDialog = false
      $('#dialog').classList.add('hidden')
    } else if (this.dialogUnnamed) {
      const who = f.entities.find((e) => e.id === this.dialogUnnamed)
      if (who) {
        $('#dName').textContent = tx(who.name)
        const c = this.facesetOf?.(who.id)
        if (c) ($('#dFace').replaceChildren(c), $('#dFace').classList.remove('hidden'))
        this.dialogUnnamed = undefined
      }
    } else if (!this.sceneDialog && f.scene?.waiting === 'advance' && f.scene.line) {
      // the say event was missed (loading, a reload): show the waiting line from the frame
      const l = f.scene.line
      if (l.card) return this.openCard(tx(l.text))
      const who = f.entities.find((e) => e.id === l.who)
      this.openDialog(l.who, who ? tx(who.name) : '', tx(l.text), true)
    }
  }

  private qSig = ''
  private qChoice = 0
  private renderQuestion(f: Frame): void {
    const q = f.question
    const sig = q ? `${locale.value}|${tx(q.text)}` : ''
    if (sig === this.qSig) return
    this.qSig = sig
    this.questionOpen = !!q
    if (!q) {
      if (!this.sceneDialog && !$('#dChoices').classList.contains('hidden')) $('#dialog').classList.add('hidden')
      return
    }
    this.qChoice = 0
    $('#dFace').classList.add('hidden')
    $('#dName').textContent = ''
    $('#dMore').classList.add('hidden')
    clearInterval(this.typer)
    $('#dLine').textContent = tx(q.text)
    this.typedAll = true
    this.renderChoices()
    $('#dialog').classList.remove('hidden')
  }

  private renderChoices(): void {
    const ch = $('#dChoices')
    ch.classList.remove('hidden')
    ch.innerHTML = [t('yes'), t('no')].map((l, i) => `<button data-yes="${i === 0 ? 1 : 0}" class="${i === this.qChoice ? 'on' : ''}">${l}</button>`).join('')
    ch.querySelectorAll<HTMLButtonElement>('[data-yes]').forEach((b) => (b.onclick = () => this.answer(b.dataset.yes === '1')))
  }

  /** Arrows move between yes and no; E confirms; Esc says no. */
  moveChoice(): void {
    this.qChoice = 1 - this.qChoice
    this.renderChoices()
  }

  confirmChoice(): void {
    this.answer(this.qChoice === 0)
  }

  answer(yes: boolean): void {
    if (!this.questionOpen) return
    this.questionOpen = false
    $('#dialog').classList.add('hidden')
    this.send.answer(yes)
  }

  // ---------------------------------------------------------------- fx

  onFx(fx: FxEvent, frame?: Frame): void {
    switch (fx.t) {
      case 'log':
        return void this.message(tx(fx.text), fx.tone)
      case 'say': {
        const text = tx(fx.text)
        const who = frame?.entities.find((e) => e.id === fx.who)
        const p = frame?.player
        if (fx.mood && fx.mood !== 'neutral') this.bubble(fx.who, MOOD_GLYPH[fx.mood])
        if (fx.scene) return this.openDialog(fx.who, who ? tx(who.name) : '', text, true)
        const near = who && p && who.id !== p.id && Math.abs(who.x - p.x) + Math.abs(who.y - p.y) <= 2 && (who.look || who.appearance)
        if (near) return this.openDialog(fx.who, tx(who.name), text)
        return this.bubble(fx.who, text)
      }
      case 'emote':
        return this.bubble(fx.who, MOOD_GLYPH[fx.mood])
      case 'card':
        return this.openCard(tx(fx.text))
      case 'fade':
        return void $('#fade').classList.toggle('hidden', fx.dir !== 'out')
      case 'damage':
        return this.floater(fx.who, fx.amount < 0 ? `+${-fx.amount}` : `-${fx.amount}`, fx.amount < 0 ? 'heal' : fx.element ?? 'hit')
      case 'pickup':
        return this.pickup(fx)
      case 'undefined':
        // the clean game: a light cue the first moments the valley works something out (design.md §5.9)
        if (this.modderOnline) return void this.message(`✦ ${t('learning')}`, 'ai')
        if (import.meta.env.DEV) return void this.message(`⚠ ${fx.summary}`, 'ai')
        return
      case 'patched': {
        const doc = this.threadDoc?.(fx.rule)
        return void this.message(`✦ ${t('learned')}${doc ? ` — ${doc}` : ''}`, 'good')
      }
    }
  }

  private pickupSig = new Map<string, { el: HTMLElement; n: number; at: number }>()
  /** An item flies from where it lay to the toolbar, and a "+n name" message stacks up. */
  private pickup(fx: Extract<FxEvent, { t: 'pickup' }>): void {
    const from = this.screenOfTile(fx.x, fx.y)
    const el = document.createElement('div')
    el.className = 'flyer'
    el.innerHTML = `<div class="icon" data-icon="${fx.item}"></div>`
    $('#labels').appendChild(el)
    this.flyers.push({ el, born: performance.now(), from })
    this.paintIcons?.([{ id: fx.item, type: '', sprite: fx.sprite, name: fx.name, tags: [], statuses: [] }])
    const name = tx(fx.name)
    const prev = this.pickupSig.get(name)
    if (prev && performance.now() - prev.at < 2500) {
      prev.n++
      prev.at = performance.now()
      prev.el.textContent = `+${prev.n} ${name}`
      return
    }
    const msg = this.message(`+1 ${name}`, 'good')
    this.pickupSig.set(name, { el: msg, n: 1, at: performance.now() })
  }

  message(text: string, tone?: string): HTMLElement {
    const el = document.createElement('div')
    el.className = `msg ${tone ?? ''}`
    el.textContent = text
    const box = $('#msgs')
    box.appendChild(el)
    while (box.children.length > 6) box.firstElementChild!.remove()
    setTimeout(() => el.classList.add('fade'), 5000)
    setTimeout(() => el.remove(), 6000)
    return el
  }

  setMapName(name: Text): void {
    const el = $('#mapname')
    el.textContent = tx(name)
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
  }

  bubble(who: string, text: string): void {
    this.bubbles.get(who)?.el.remove()
    const el = document.createElement('div')
    el.className = 'bubble'
    el.textContent = text
    $('#labels').appendChild(el)
    this.bubbles.set(who, { el, until: performance.now() + 2600 + text.length * 45, who })
  }

  floater(who: string, text: string, kind: string): void {
    const el = document.createElement('div')
    el.className = `floater f-${kind}`
    el.textContent = text
    $('#labels').appendChild(el)
    this.floaters.push({ el, born: performance.now(), who })
  }

  /** Reposition the DOM labels to follow sprites (every animation frame). */
  tickLabels(): void {
    const now = performance.now()
    for (const [id, b] of this.bubbles) {
      const p = this.screenOf(b.who)
      if (!p || now > b.until) {
        b.el.remove()
        this.bubbles.delete(id)
        continue
      }
      b.el.style.transform = `translate(${p.x}px, ${p.y - 30}px) translate(-50%, -100%)`
    }
    this.floaters = this.floaters.filter((f) => {
      const age = now - f.born
      const p = this.screenOf(f.who)
      if (age > 900 || !p) return void f.el.remove(), false
      f.el.style.transform = `translate(${p.x}px, ${p.y - 26 - age / 25}px) translate(-50%, -100%)`
      f.el.style.opacity = String(1 - age / 900)
      return true
    })
    // picked-up items arc to the player, then shrink into the bag
    const me = this.frame ? this.screenOf(this.frame.player.id) : undefined
    this.flyers = this.flyers.filter((f) => {
      const k = Math.min(1, (now - f.born) / 450)
      if (k >= 1 || !me) return void f.el.remove(), false
      const x = f.from.x + (me.x - f.from.x) * k
      const y = f.from.y + (me.y - 12 - f.from.y) * k - Math.sin(k * Math.PI) * 28
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${1 - k * 0.4})`
      return true
    })
    for (const [id, el] of this.dotEls) {
      const p = this.screenOf(id)
      if (p) el.style.transform = `translate(${p.x}px, ${p.y - 28}px) translate(-50%, -100%)`
    }
  }

  toggleSound(): void {
    this.muted = !this.muted
    try {
      localStorage.setItem('lsw.muted', this.muted ? '1' : '0')
    } catch {
      /* private mode */
    }
    this.onSound?.(this.muted)
  }

  /** Re-render everything that carries words (the language changed). */
  relabel(): void {
    this.clockSig = this.obSig = this.keySig = this.barSig = ''
    if (this.frame) this.onFrame(this.frame)
  }
}
