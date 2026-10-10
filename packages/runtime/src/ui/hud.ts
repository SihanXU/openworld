// The heads-up display (design.md §5.3): the clock box top right with the journal button under
// it, the bag and skill tree buttons bottom right, the toolbar at the bottom with health, hunger and experience above it (Minecraft's way),
// messages bottom left, the map name as it fades in, the two keys' labels over the target, the
// dialogue box and the yes/no question, speech bubbles and floating numbers.

import { xpToNext, type Frame, type FxEvent, type ItemInfo, type KeyView, type Mood, type Text } from '@openworld/engine'
import { catalog, game, hasModule, ontology } from '../game.ts'
import { assetUrl, cssAssetUrl } from '../render/assets.ts'
import { $, MOOD_GLYPH, SLOT_KEYS, esc, locale, prefs, t, tx } from './common.ts'
import { skillPng } from './skillIcons.ts'

export interface HudSend {
  select(slot: number): void
  answer(yes: boolean): void
  advance(): void
  openJournal(): void
  toggleInventory(): void
  toggleCraft(): void
  toggleOptions(): void
  toggleSkills(): void
  toggleBuilding(): void
  toggleQuests(): void
  toggleSkillPanel(): void
  /** The talk panel (docs/npc-sandbox.md §2.9): a verb said, the talk closed. */
  talk(verb: string): void
  closeTalk(): void
}

export class Hud {
  frame?: Frame
  /** The development warning that no one learns (no model) is said once a session. */
  private warnedNoModder = false
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
  /** A portrait, for a line's mood when the face has one. */
  facesetOf?: (id: string, mood?: Mood) => HTMLCanvasElement | undefined
  /** Set by main.ts: the threads' docs, for the "a new thread is woven" message. */
  threadDoc?: (rule: string) => string | undefined
  modderOnline = false

  private bubbles = new Map<string, { el: HTMLElement; until: number; who: string }>()
  private floaters: { el: HTMLElement; born: number; who: string }[] = []
  private flyers: { el: HTMLElement; born: number; from: { x: number; y: number } }[] = []
  private dotEls = new Map<string, HTMLElement>()
  private bossId = ''
  private bossHp = 0
  private bossTrail = 100
  private bossHitAt = 0
  private bossTick = 0

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
      </div>
      <div class="objective" id="objective"><div class="ob-title" id="obTitle"></div><div class="ob-progress" id="obProgress"></div></div>
      <div class="social-status" id="socialStatus"></div>
      <div class="sin-boss hidden" id="sinBoss">
        <div class="sin-crown" aria-hidden="true"><i></i><svg viewBox="0 0 80 34"><path d="M6 8 22 17 28 5 40 18 52 5 58 17 74 8 65 29 15 29Z"/><path d="M17 33H63M40 0V8M0 8H8M72 8H80"/></svg><i></i></div>
        <div class="sin-epithet" id="sinEpithet"></div>
        <div class="sin-title"><span id="sinName"></span></div>
        <div class="sin-meta"><span id="sinPhase"></span><span class="sin-seals" aria-hidden="true">${Array.from({ length: 4 }, (_, i) => `<i data-seal="${i}"></i>`).join('')}</span><span id="sinHp"></span></div>
        <div class="sin-frame"><div class="sin-track" id="sinTrack" role="progressbar" aria-valuemin="0"><div id="sinDamage"></div><div id="sinHealth"></div><div class="sin-grain"></div><i id="sinThreshold" title="Phase II"></i></div></div>
        <div class="sin-cast-row"><span id="sinCast"></span><span id="sinCastState"></span></div>
        <div class="sin-cast-track"><div id="sinCastProgress"></div></div>
      </div>
      <div class="hotbar" id="hotbar">
        <div class="vitals"><div class="hearts" id="hearts"></div><div class="food" id="food"></div></div>
        <div class="xpbar" id="xpBar"><div class="fill" id="xpFill"></div><span class="lv" id="xpLv"></span></div>
        <div class="barrow"><div class="toolbar wood" id="toolbar"></div><div class="toolbar wood offhand-bar" id="offhandBar"></div></div>
      </div>
      <div class="corner" id="corner">
        <button class="cbtn wood" id="questBtn" title="L"><img class="cb-icon" src="${assetUrl(catalog().ui.cornerQuests.img)}" alt=""><kbd>L</kbd><span class="badge hidden" id="questBadge"></span></button>
        <button class="cbtn wood" id="buildBtn" title="B"><img class="cb-icon" src="${assetUrl(catalog().ui.cornerBuild.img)}" alt=""><kbd>B</kbd></button>
        <button class="cbtn wood" id="bagBtn" title="I"><img class="cb-icon" src="${assetUrl(catalog().ui.cornerBag.img)}" alt=""><kbd>I</kbd></button>
        <button class="cbtn wood${hasModule('classes') ? '' : ' hidden'}" id="skillBtn" title="K"><img class="cb-icon" src="${assetUrl(catalog().ui.cornerSkills.img)}" alt=""><kbd>K</kbd><span class="badge hidden" id="skillBadge"></span></button>
        <button class="cbtn wood" id="jbtn" title="J"><img class="cb-icon" src="${assetUrl(catalog().ui.cornerJournal.img)}" alt=""><kbd>J</kbd></button>
        <button class="cbtn wood" id="craftBtn" title="C"><img class="cb-icon" src="${assetUrl(catalog().ui.cornerCraft.img)}" alt=""><kbd>C</kbd></button>
        <button class="cbtn wood${hasModule('classes') ? '' : ' hidden'}" id="skPanelBtn" title="U">${hasModule('classes') ? `<img class="cb-icon" src="${skillPng('whirlwind')}" alt="">` : ''}<kbd>U</kbd></button>
        <button class="cbtn wood" id="optionsBtn" title="Esc"><img class="cb-icon" src="${assetUrl(catalog().ui.cornerOptions.img)}" alt=""><kbd>Esc</kbd></button>
      </div>
      <div class="msgs" id="msgs"></div>
      <div class="mapname" id="mapname"></div>
      <div class="learning hidden" id="learning"></div>
      <div class="keys" id="keys"></div>
      <div class="chooser hidden" id="chooser"></div>
      <div class="dialog hidden" id="dialog"><div class="face" id="dFace"></div><div class="dtext"><div class="dname" id="dName"></div><div class="dline" id="dLine"></div><div class="dchoices hidden" id="dChoices"></div></div><div class="dmore" id="dMore">▼</div></div>
      <div class="fade hidden" id="fade"><div id="fadeText"></div></div>
      <div class="card hidden" id="card"><div class="card-text" id="cardText"></div><div class="dmore">▼</div></div>`
    $('#hotbar').style.setProperty('--heart', cssAssetUrl('Ui/Receptacle/Heart.png'))
    if (catalog().ui.drumstick) $('#hotbar').style.setProperty('--drum', cssAssetUrl(catalog().ui.drumstick.img))
    $('#jbtn').onclick = () => this.send.openJournal()
    $('#bagBtn').onclick = () => this.send.toggleInventory()
    $('#craftBtn').onclick = () => this.send.toggleCraft()
    $('#optionsBtn').onclick = () => this.send.toggleOptions()
    $('#buildBtn').onclick = () => this.send.toggleBuilding()
    $('#skillBtn').onclick = () => this.send.toggleSkills()
    $('#questBtn').onclick = () => this.send.toggleQuests()
    $('#skPanelBtn').onclick = () => this.send.toggleSkillPanel()
    $('#dialog').onclick = (e) => {
      if ((e.target as HTMLElement).closest('[data-yes]')) return
      this.advanceDialog()
    }
    $('#card').onclick = () => this.advanceDialog()
  }

  // ---------------------------------------------------------------- per frame

  onFrame(f: Frame): void {
    // the quest button's badge: how many quests are under way (red while someone waits for a word: a '?' in view)
    const under = (f.quests?.journal ?? []).filter((q) => q.state === 'active').length
    const waits = Object.values(f.quests?.marks ?? {}).includes('?')
    $('#questBadge').textContent = String(under)
    $('#questBadge').classList.toggle('hidden', !under)
    $('#questBadge').classList.toggle('calm', !waits)
    this.frame = f
    this.renderClock(f)
    this.renderBars(f)
    this.renderBoss(f)
    this.renderToolbar(f)
    this.renderObjective(f)
    this.renderKeys(f)
    this.renderScene(f)
    this.renderQuestion(f)
    this.renderTalk(f)
    this.renderSocial(f)
    // while the world learns an act: the one acting is at work on it (a working bubble), the
    // things it is done to shimmer with dots
    const frozen = new Set(f.entities.filter((e) => e.frozen).map((e) => e.id))
    for (const id of frozen)
      if (!this.dotEls.has(id)) {
        const el = document.createElement('div')
        const actor = !!f.entities.find((e) => e.id === id)?.tags.includes('agent')
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
    // the moon from sunset (two hours before the night's dusk) to an hour after its dawn: 19–6 at first, earlier as the night grows
    const { dusk, dawn } = f.night
    const night = f.hour < dawn + 1 || f.hour >= dusk - 2
    const weather = { sun: night ? '☾' : '☀', cloud: '☁', rain: '☂', storm: '⚡', fog: '≋' }[c.weather] ?? '☀'
    $('#cbIcons').innerHTML = `<span title="${esc(t(`weather.${c.weather}`))}">${weather}</span>`
    $('#cbTime').textContent = time
    // the dial: the hand sweeps from 6 am (left) over noon (top) to 2 am (right), like Stardew's
    const frac = Math.min(1, Math.max(0, (((f.hour - 6 + 24) % 24) / 20)))
    $<HTMLDivElement>('#dialHand').style.transform = `rotate(${-90 + frac * 180}deg)`
  }

  private statSig = ''
  /** Minecraft's status above the hotbar: ten hearts on the left, ten drumsticks on the right, the experience bar beneath them. */
  private renderBars(f: Frame): void {
    const p = f.player
    const level = Math.max(1, Number(p.props.level ?? 1))
    const xp = Number(p.props.xp ?? 0)
    const need = xpToNext(level)
    const points = Number(p.props.skillPoints ?? 0)
    const sig = `${locale.value}|${p.hp}|${p.maxHp}|${p.hunger}|${p.maxHunger}|${level}|${xp}|${points}`
    if (sig === this.statSig) return
    this.statSig = sig
    // health: each heart a tenth of maxHp, drawn in quarters (the pack's heart has five fills), emptying from the right
    const per = p.maxHp / 10
    const hp = Math.max(0, p.hp)
    $('#hearts').innerHTML = Array.from({ length: 10 }, (_, i) => {
      const q = Math.max(0, Math.min(4, Math.round(((hp - i * per) / per) * 4)))
      return `<i class="heart" style="background-position:${q * 25}% 0"></i>`
    }).join('')
    $('#hearts').title = `${t('health')} ${Math.round(hp)} / ${p.maxHp}`
    // hunger: each drumstick a tenth of maxHunger, in halves, emptying from the left (the row is mirrored)
    const hunger = p.maxHunger > 0 ? p.hunger : 0
    const fper = p.maxHunger / 10
    $('#food').classList.toggle('hidden', p.maxHunger <= 0)
    $('#food').innerHTML = Array.from({ length: 10 }, (_, i) => {
      const fill = Math.max(0, Math.min(1, Math.round(((hunger - i * fper) / fper) * 2) / 2))
      return `<i class="drum"><b style="width:${fill * 100}%"></b></i>`
    }).join('')
    $('#food').title = `${t('hunger')} ${Math.round(hunger)} / ${p.maxHunger}`
    $('#food').classList.toggle('starving', p.maxHunger > 0 && hunger <= 0)
    // experience toward the next level, the level on it
    $<HTMLDivElement>('#xpFill').style.width = `${Math.min(100, (100 * xp) / need)}%`
    $('#xpLv').textContent = String(level)
    // unspent skill points: a badge on the skill tree's button
    $('#skillBadge').textContent = String(points)
    $('#skillBadge').classList.toggle('hidden', points <= 0)
    $('#bagBtn').title = `${t('inventory')} (I)`
    $('#craftBtn').title = `${t('craft')} (C)`
    $('#optionsBtn').title = `${t('options')} (Esc)`
    $('#jbtn').title = `${t('codex')} (J)`
    $('#skillBtn').title = `${t('skills')} (K)${points ? ` · ${t('skillPoints')} ${points}` : ''}`
    $('#xpBar').title = `${t('level')} ${level} · ${t('xp')} ${xp} / ${need}${points ? ` · ${t('skillPoints')} ${points}` : ''}`
  }

  private renderBoss(f: Frame): void {
    const boss = f.entities.filter((e) => e.boss && (e.hp ?? 0) > 0 && Math.max(Math.abs(e.x - f.player.x), Math.abs(e.y - f.player.y)) <= 12)
      .sort((a, b) => Math.hypot(a.x - f.player.x, a.y - f.player.y) - Math.hypot(b.x - f.player.x, b.y - f.player.y))[0]
    $('#sinBoss').classList.toggle('hidden', !boss || !!f.scene)
    if (!boss?.boss) { this.bossId = ''; return }
    const b = boss.boss, zh = locale.value === 'zh'
    const panel = $('#sinBoss'), hp = Math.max(0, boss.hp ?? 0), max = boss.maxHp || 1, percent = Math.min(100, 100 * hp / max)
    const now = performance.now()
    if (this.bossId !== boss.id || f.tick < this.bossTick || hp > this.bossHp) this.bossTrail = percent
    else if (hp < this.bossHp) this.bossHitAt = now
    if (now - this.bossHitAt > 450) this.bossTrail = Math.max(percent, this.bossTrail - 2)
    this.bossId = boss.id; this.bossHp = hp; this.bossTick = f.tick
    panel.style.setProperty('--sin', `#${b.color.toString(16).padStart(6, '0')}`)
    panel.classList.toggle('awakened', b.phase > 1)
    panel.classList.toggle('casting', !!b.warning)
    panel.classList.toggle('struck', now - this.bossHitAt < 160)
    $('#sinEpithet').textContent = zh ? '首  领' : 'B O S S'
    $('#sinName').textContent = tx(boss.name)
    $('#sinPhase').textContent = b.phase > 1 ? zh ? 'Ⅱ / 觉醒' : 'II / AWAKENED' : zh ? 'Ⅰ / 降临' : 'I / ARRIVED'
    $('#sinHealth').style.width = `${percent}%`
    $('#sinDamage').style.width = `${this.bossTrail}%`
    $('#sinHp').textContent = `${Math.ceil(hp).toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`
    $('#sinTrack').setAttribute('aria-label', tx(boss.name))
    $('#sinTrack').setAttribute('aria-valuenow', String(Math.ceil(hp)))
    $('#sinTrack').setAttribute('aria-valuemax', String(max))
    $('#sinThreshold').style.left = `${b.enrageAt * 100}%`
    const sinIndex = ['alberic', 'lust', 'envy', 'pride'].indexOf(b.kit)
    panel.querySelectorAll('[data-seal]').forEach((e, i) => e.classList.toggle('active', i === sinIndex))
    $('#sinCast').textContent = b.warning ? tx(b.warning.name) : zh ? '观察起手 · 抓住收招空隙' : 'Watch the wind-up · Strike during recovery'
    $('#sinCastState').textContent = b.warning ? zh ? '蓄势 / 离开标记区域' : 'WIND-UP / EVADE' : b.phase > 1 ? zh ? '伤害与攻势强化' : 'EMPOWERED' : ' '
    $('#sinCastProgress').style.width = `${(b.warning?.progress ?? 0) * 100}%`
  }

  private barSig = ''
  private renderToolbar(f: Frame): void {
    const row = f.player.slots.slice(0, SLOT_KEYS.length)
    // the toolbar moves to the top when the player walks near the bottom edge
    const me = this.screenOf(f.player.id)
    const top = !!me && me.y > window.innerHeight * 0.78 && $('#sinBoss').classList.contains('hidden')
    $('#hotbar').classList.toggle('top', top)
    const off = f.player.offhand
    const sig = `${f.player.selected}|${row.map((s) => (s ? `${s.item.id}:${s.count}${s.worn ? 'w' : ''}` : '')).join(',')}|${off?.id}:${off?.works}`
    if (sig === this.barSig) return
    this.barSig = sig
    $('#toolbar').innerHTML = row
      .map(
        (s, i) =>
          `<div class="slot${i === f.player.selected ? ' sel' : ''}" data-slot="${i}"${s ? ` data-item="${s.item.id}"` : ''}>` +
          `<span class="key">${SLOT_KEYS[i]}</span>${s ? `<div class="icon" data-icon="${s.item.id}"></div>${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}${s.worn ? '<span class="worn"></span>' : ''}` : ''}</div>`,
      )
      .join('')
    $('#toolbar')
      .querySelectorAll<HTMLElement>('[data-slot]')
      .forEach((el) => (el.onclick = () => this.send.select(Number(el.dataset.slot))))
    // the off hand beside the toolbar (a shield worn there), greyed while it does not work
    $('#offhandBar').innerHTML = `<div class="slot${off && !off.works ? ' off' : ''}" title="${locale.value === 'zh' ? '副手' : 'Off hand'}"${off ? ` data-item="${off.id}"` : ''}>${off ? `<div class="icon" data-icon="${off.id}"></div>` : '<span class="ghost">🛡</span>'}</div>`
    this.paintIcons?.([...row.filter(Boolean).map((s) => s!.item), ...(off ? [off] : [])])
  }

  private obSig = ''
  /**
   * The tracker (docs/quests.md §2.5), top right under the clock: the quest followed, its open objectives with their
   * counts, and the map one is on when it is elsewhere. A quest reaching a stage flashes the journal's button.
   */
  private renderObjective(f: Frame): void {
    const q = f.quests?.journal.find((x) => x.id === f.quests.tracked)
    const open = (q?.objectives ?? []).filter((o) => o.state === 'open')
    const sig = `${locale.value}|${prefs.get('tracker')}|${q?.id}|${JSON.stringify(open)}`
    const moved = f.fx.some((x) => x.t === 'quest')
    if (moved) $('#questBtn').classList.add('flash')
    if (sig === this.obSig) return
    this.obSig = sig
    $('#objective').classList.toggle('hidden', !q || !prefs.get('tracker'))
    if (!q) return
    $('#obTitle').textContent = tx(q.title)
    $('#obProgress').innerHTML = open
      .slice(0, 4)
      .map((o) => `<div>· ${esc(tx(o.text))}${o.need ? ` ${o.have}/${o.need}` : ''}${o.where ? ` <em>→ ${esc(tx(o.where))}</em>` : ''}</div>`)
      .join('')
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
        v ? `<div class="kl${v.unknown ? ' unknown' : ''}${v.steal ? ' steal' : ''}"><kbd>${key}</kbd> ${esc(tx(v.label))}${v.unknown ? ` <span class="q">?</span>` : ''}</div>` : ''
      // what each input that reaches the spot would do (foreseeable): E, F, G, the left click there, the right click on oneself
      // (a left click on one's own place is the right click's act: one line for both)
      const same = !!k?.use && !!k?.self && JSON.stringify(k.use.label) === JSON.stringify(k.self.label) && k.use.x === k.self.x && k.use.y === k.self.y
      $('#keys').innerHTML = k ? line('E', k.hands) + line('F', k.take) + line('G', k.put) + line(same ? `${t('lmb')} · ${t('rmb')}` : t('lmb'), k.use) + (same ? '' : line(t('rmb'), k.self)) : ''
    }
    // over the target: what each key would do, where it would be done (the tile is outlined in the scene)
    const at = k?.hands ?? k?.take ?? k?.put ?? k?.use ?? k?.self
    const el = $('#keys')
    el.classList.toggle('hidden', !at)
    if (at) {
      const s = this.screenOfTile(at.x, at.y)
      // above the tile, or below it when there is no room above, or when someone's speech is there
      // (a companion's line beside the target would cover what the keys would do)
      const w = el.offsetWidth
      const top = s.y - 30 - el.offsetHeight
      const said = [...this.bubbles.values()].some((b) => {
        const r = b.el.getBoundingClientRect()
        return r.left < s.x + w / 2 && r.right > s.x - w / 2 && r.top < s.y - 30 && r.bottom > top
      })
      // nor over the one acting: the player just above the target (facing down) would be hidden by it
      const me = this.screenOfTile(f.player.x, f.player.y)
      const tile = Math.abs(this.screenOfTile(f.player.x + 1, f.player.y).x - me.x)
      const covers = me.y < s.y && Math.abs(me.x - s.x) < w / 2 + tile / 2 && me.y + tile / 2 > top
      const above = top >= 4 && !said && !covers
      el.style.transform = above ? `translate(${s.x}px, ${s.y - 30}px) translate(-50%, -100%)` : `translate(${s.x}px, ${s.y + 30}px) translate(-50%, 0)`
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
  /** Whose line is open, and its mood (the portrait). */
  private dialogWho?: string
  private dialogMood?: Mood
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

  openDialog(who: string, name: string, text: string, scene = false, mood?: Mood): void {
    this.sceneDialog = scene
    this.dialogUnnamed = name ? undefined : who
    this.dialogWho = who
    this.showFace(who, mood)
    $('#dName').textContent = name
    $('#dChoices').classList.add('hidden')
    $('#dMore').classList.remove('hidden')
    this.type(text)
    $('#dialog').classList.remove('hidden')
  }

  /** The open line's portrait, for its speaker's mood. */
  private showFace(who: string, mood?: Mood, tries = 0): void {
    this.dialogMood = mood
    const face = $('#dFace')
    face.replaceChildren()
    const c = this.facesetOf?.(who, mood)
    if (c) face.appendChild(c)
    face.classList.toggle('hidden', !c)
    // a look's portrait is a bust beside the box (docs/looks.md); while its layers are still coming, look again
    const bust = !!c?.dataset.bust
    face.classList.toggle('bust', bust)
    $('#dialog').classList.toggle('bust', bust)
    if (!bust && tries < 8) setTimeout(() => this.dialogWho === who && this.dialogMood === mood && !$('#dialog').classList.contains('hidden') && this.showFace(who, mood, tries + 1), 250)
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
  /**
   * A person's line (not a scene's, not a card, not a question) is put away at once: the next act
   * does not wait for it (handing the smith five ores is five G presses, not ten keys).
   */
  dismissLine(): boolean {
    if (this.questionOpen || this.cardOpen || this.sceneDialog || this.talkOpen || $('#dialog').classList.contains('hidden')) return false
    clearInterval(this.typer)
    this.typedAll = true
    $('#dialog').classList.add('hidden')
    return true
  }

  advanceDialog(): void {
    if (this.questionOpen) return
    // a talk stays open while one chooses (the line finishes typing; Esc or goodbye closes it)
    if (this.talkOpen) {
      if (!this.typedAll) (clearInterval(this.typer), ($('#dLine').textContent = this.fullText), (this.typedAll = true))
      return
    }
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
        this.showFace(who.id, this.dialogMood)
        this.dialogUnnamed = undefined
      }
    } else if (!this.sceneDialog && f.scene?.waiting === 'advance' && f.scene.line) {
      // the say event was missed (loading, a reload): show the waiting line from the frame
      const l = f.scene.line
      if (l.card) return this.openCard(tx(l.text))
      const who = f.entities.find((e) => e.id === l.who)
      this.openDialog(l.who, who ? tx(who.name) : '', tx(l.text), true, l.mood)
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

  // ---------------------------------------------------------------- the talk (docs/npc-sandbox.md §2.9)

  private talkSig = ''
  /** A talk with someone is open (its verbs under their line). */
  get talkOpen(): boolean {
    return !!this.frame?.talk
  }
  /** The talk is a guard's arrest: only its choices close it. */
  get arrestOpen(): boolean {
    return !!this.frame?.talk?.arrest
  }

  private renderTalk(f: Frame): void {
    const tk = f.talk
    const box = $('#dialog')
    const choices = $('#dChoices')
    if (!tk) {
      if (this.talkSig) {
        this.talkSig = ''
        choices.classList.add('hidden')
        if (!this.sceneDialog && !this.questionOpen) box.classList.add('hidden')
      }
      return
    }
    const sig = `${locale.value}|${JSON.stringify(tk)}|${choices.classList.contains('hidden')}|${box.classList.contains('hidden')}`
    if (sig === this.talkSig) return
    this.talkSig = sig
    const who = f.entities.find((e) => e.id === tk.who)
    const zh = locale.value === 'zh'
    // a talk the panel opened without a line (a guard stopping one): the guard's words
    if (box.classList.contains('hidden')) this.openDialog(tk.who, who ? tx(who.name) : '', tk.arrest ? (zh ? `你欠守卫队 ${tk.bounty ?? 0}。` : `You owe the watch ${tk.bounty ?? 0}.`) : '…')
    $('#dName').innerHTML = `${esc(who ? tx(who.name) : tx(tk.name))} <span class="regard r-${esc(tx(tk.regard).replace(/\s/g, ''))}">${esc(tx(tk.regard))}</span>${tk.grudge ? ` <span class="grudge">${esc(tx(tk.grudge))}</span>` : ''}${tk.bounty ? ` <span class="grudge">${zh ? '悬赏' : 'bounty'} ${tk.bounty}</span>` : ''}`
    const verbs = [...tk.verbs, ...(tk.arrest ? [] : [{ id: 'bye', label: { en: 'Goodbye.', zh: '再见。' } }])]
    choices.innerHTML = verbs.map((v, i) => `<button data-verb="${esc(v.id)}"><kbd>${i + 1}</kbd> ${esc(tx(v.label))}</button>`).join('')
    choices.classList.remove('hidden')
    choices.classList.add('talk')
    $('#dMore').classList.add('hidden')
    choices.querySelectorAll<HTMLButtonElement>('[data-verb]').forEach((b) => (b.onclick = (e) => (e.stopPropagation(), this.say(b.dataset.verb!))))
  }

  /** A verb of the open talk, chosen (a click, or its number). */
  say(verb: string): void {
    if (verb === 'bye') return this.send.closeTalk()
    this.send.talk(verb)
  }

  /** The n-th verb of the open talk (1-based), from a number key. */
  sayNth(n: number): void {
    const tk = this.frame?.talk
    if (!tk) return
    const verbs = [...tk.verbs.map((v) => v.id), ...(tk.arrest ? [] : ['bye'])]
    const v = verbs[n - 1]
    if (v) this.say(v)
  }

  /** The world's coin, by name (its item type's). */
  private coinName = (): string => tx(ontology().types[game().items.coin]?.name) || game().items.coin

  private socialSig = ''
  /** What the one at the keys is doing with the people: walking soft, a blade out, wanted (docs/npc-sandbox.md). */
  private renderSocial(f: Frame): void {
    const st = f.player.statuses
    const w = f.player.wanted
    const zh = locale.value === 'zh'
    const sig = `${locale.value}|${st.includes('sneaking')}|${st.includes('drawn')}|${w?.bounty ?? 0}|${f.player.purse}`
    if (sig === this.socialSig) return
    this.socialSig = sig
    const parts = [
      st.includes('sneaking') ? `<span class="ss sneak" title="V">👣 ${zh ? '潜行' : 'Sneaking'}</span>` : '',
      st.includes('drawn') ? `<span class="ss drawn" title="X">⚔ ${zh ? '已拔武器' : 'Weapon drawn'}</span>` : '',
      w ? `<span class="ss wanted">⚑ ${zh ? `${tx(w.by)}悬赏 ${w.bounty}` : `Wanted by ${tx(w.by)}: ${w.bounty}`}</span>` : '',
      // the purse is the society module's (its coin the world's): a game without it keeps none
      hasModule('society') ? `<span class="ss coin" title="${esc(this.coinName())}">⊕ ${f.player.purse}</span>` : '',
    ]
    $('#socialStatus').innerHTML = parts.join('')
  }

  // ---------------------------------------------------------------- fx

  onFx(fx: FxEvent, frame?: Frame): void {
    switch (fx.t) {
      case 'log':
        // the developer's lines (a patch the validator refused, a rule set aside) go to the console
        if (fx.tone === 'dev') return void console.info(`[world] ${tx(fx.text)}`)
        return void this.message(tx(fx.text), fx.tone)
      case 'say': {
        const text = tx(fx.text)
        const who = frame?.entities.find((e) => e.id === fx.who)
        const p = frame?.player
        if (fx.mood && fx.mood !== 'neutral') this.bubble(fx.who, MOOD_GLYPH[fx.mood])
        if (fx.scene) return this.openDialog(fx.who, who ? tx(who.name) : '', text, true, fx.mood)
        const near = who && p && who.id !== p.id && Math.abs(who.x - p.x) + Math.abs(who.y - p.y) <= 2 && (who.look || who.tags.includes('person'))
        // the one the talk is with answers in the talk's box, wherever they stand; one person telling
        // another is heard in passing (a bubble), however near
        const toAnother = !!fx.to && fx.to !== p?.id
        if ((near && !toAnother) || (frame?.talk && frame.talk.who === fx.who && !toAnother)) return this.openDialog(fx.who, who ? tx(who.name) : '', text, false, fx.mood)
        return this.bubble(fx.who, text)
      }
      case 'emote':
        // the speaker of the open line shows it on their face too
        if (fx.who === this.dialogWho && !$('#dialog').classList.contains('hidden') && !this.questionOpen) this.showFace(fx.who, fx.mood)
        return this.bubble(fx.who, MOOD_GLYPH[fx.mood])
      case 'card':
        return this.openCard(tx(fx.text))
      case 'fade':
        return void $('#fade').classList.toggle('hidden', fx.dir !== 'out')
      case 'damage':
        return this.floater(fx.who, fx.amount < 0 ? `+${-fx.amount}` : `-${fx.amount}`, fx.amount < 0 ? 'heal' : fx.element ?? 'hit')
      case 'pickup':
        return this.pickup(fx)
      case 'levelup':
        return void this.message(`★ ${t('levelUp').replace('{n}', String(fx.level))}`, 'good')
      case 'undefined':
        // the clean game: a light cue the first moments the valley works something out (design.md §5.11, legibility)
        if (fx.asked) return void this.message(`✦ ${t('learning')}`, 'ai')
        // no one to ask: in development say so plainly, once a session (npm run dev starts the modder too)
        if (import.meta.env.DEV && !this.warnedNoModder) {
          this.warnedNoModder = true
          // what was not learned is the model's English: the console's, not the player's log
          console.info(`[lsw] not learned (no modder): ${fx.summary}`)
          return void this.message(`⚠ ${t('noModder')}`, 'warn')
        }
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
    this.paintIcons?.([{ id: fx.item, type: '', sprite: fx.sprite, name: fx.name, tags: [], statuses: [], props: {} }])
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

  /** The world waits on the player's act (the model is working out its outcome): said plainly, mid-screen. */
  learning = false
  setLearning(l: { seconds: number; limit: number } | undefined): void {
    const el = $('#learning')
    this.learning = !!l
    el.classList.toggle('hidden', !l)
    if (!l) return
    const zh = locale.value === 'zh'
    el.textContent = zh
      ? `✦ 世界正在学习这件事…… ${l.seconds} 秒（最多 ${l.limit} 秒）· Esc 不等了`
      : `✦ The world is working this out… ${l.seconds}s (at most ${l.limit}s) · Esc: don't wait`
  }

  private mapName?: Text
  setMapName(name: Text): void {
    this.mapName = name
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
    if (this.mapName) $('#mapname').textContent = tx(this.mapName)
    if (this.frame) this.onFrame(this.frame)
  }
}
