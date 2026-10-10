// Review harness using the real engine, map, HUD and Phaser renderer. No save/storage calls.
import Phaser from 'phaser'
import { snapshot, type Game, type Dir, type Frame, type WorldIndex } from '@lsw/engine'
import { BOSSES, BOSS_BY_ID, BOSS_ARENA, PROFESSION_BY_ID, SKILL_PROFESSIONS, type RawChunk } from '@lsw/content'
import { WorldScene } from './render/scene.ts'
import { Hud } from './ui/hud.ts'
import { esc, locale, tx } from './ui/common.ts'
import { skillPng } from './ui/skillIcons.ts'
import { CHALLENGE_LOADOUTS, challengeOutcome, createBossChallenge } from './boss-challenge.ts'
import { CATALOG } from './assets/catalog.ts'
import { bossPreviewMode, bossPreviewModes, previewBoss, type BossPreviewMode } from './boss-preview.ts'
import { createBossStudio } from './boss-studio.ts'
import './styles.css'
import './ui/game.css'
import './boss-gallery.css'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T
window.addEventListener('error', (event) => { $('studioStatus').textContent = `Preview error: ${event.message}` })
window.addEventListener('unhandledrejection', (event) => { $('studioStatus').textContent = `Preview error: ${String(event.reason)}` })
const params = new URLSearchParams(location.search)
const challenge = params.get('challenge') === '1'
let choosing = challenge, finished = false, profession = 'assassin', startedAt = 0
const victories = new Set<string>()
const select = $<HTMLSelectElement>('bossSelect'), modeControls = $('modeSelect')
let mode: BossPreviewMode = 'live'
const facing = $<HTMLSelectElement>('facingSelect')
locale.value = 'zh'
for (const boss of BOSSES) { const option = new Option(tx(boss.name), boss.id); select.add(option) }
select.value = BOSS_BY_ID[params.get('boss') ?? ''] ? params.get('boss')! : 'pride'
const scene = new WorldScene()
const noop = () => {}
const hud = new Hud({ select: noop, answer: noop, advance: noop, openJournal: noop, toggleInventory: noop, toggleCraft: noop, toggleOptions: noop, toggleSkills: noop, toggleQuests: noop, toggleSkillPanel: noop, toggleBuilding: noop, talk: noop, closeTalk: noop }, (id) => scene.screenOf(id), (x, y) => scene.screenOfTile(x, y))
hud.paintIcons = (items) => {
  for (const item of items) {
    const d = CATALOG.items[item.sprite]
    if (!d || !scene.textures?.exists(d.img)) continue
    for (const slot of document.querySelectorAll(`[data-icon="${CSS.escape(item.id)}"]`)) {
      const canvas = document.createElement('canvas'); canvas.width = d.w; canvas.height = d.h
      canvas.getContext('2d')!.drawImage(scene.textures.get(d.img).getSourceImage() as HTMLImageElement, d.x, d.y, d.w, d.h, 0, 0, d.w, d.h)
      slot.replaceChildren(canvas)
    }
  }
}
let game: Game, currentFrame: Frame, ready = false, paused = false
let index: WorldIndex, raw: RawChunk
const keys = new Set<string>()
const dirOf: Record<string, Dir> = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }
let attack = false
const bossEntity = () => game.engine.world.get(BOSS_ARENA.id)
const clearInput = () => { keys.clear(); attack = false }
// Local review instrumentation, matching main.ts's development-only scene hook.
if (import.meta.env.DEV) Object.assign(window, { bossStudio: { scene, advance: (ticks: number) => {
  for (let i = 0; i < ticks; i++) game.engine.tick()
  render()
}, get frame() { return currentFrame } } })

function render(): void {
  currentFrame = snapshot(game.engine)
  const previewEntity = currentFrame.entities.find((e) => e.id === BOSS_ARENA.id)
  if (!challenge && previewEntity?.boss?.kit === 'alberic' && facing.value !== 'auto') previewEntity.facing = facing.value as Dir
  // Clear combat warnings in the displayed snapshot. The scene advances the isolated clip.
  previewBoss(previewEntity, mode, 0)
  scene.applyFrame(currentFrame)
  const b = bossEntity(), state = b?.boss
  $('studioStatus').textContent = mode !== 'live'
    ? `动作预览 · ${bossPreviewModes(select.value).find((m) => m.value === mode)!.label} · 战斗已暂停`
    : b ? `${state?.pending ? tx(BOSS_BY_ID[select.value].skills[state.pending.skill].name) : state?.action} · Tick ${currentFrame.tick} · HP ${currentFrame.player.hp}` : '领主已击败 · 可重新开始'
  $('studioStatus').dataset.ready = 'true'
}

function paintModes(): void {
  modeControls.replaceChildren(...bossPreviewModes(select.value).map(({ value, label }) => {
    const button = document.createElement('button')
    button.type = 'button'; button.dataset.mode = value; button.textContent = label
    button.setAttribute('aria-pressed', String(mode === value))
    return button
  }))
}

function chooseMode(value: string): void {
  mode = bossPreviewMode(value, select.value)
  clearInput()
  // Keep focused buttons in place; rebuilding them during every tick loses focus/clicks.
  for (const button of modeControls.querySelectorAll<HTMLButtonElement>('[data-mode]'))
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
  if (!game) return
  // Inspection must still work after the real encounter has killed/despawned its actor.
  const boss = bossEntity()
  if (mode !== 'live' && (!boss || game.engine.world.num(boss, 'hp') <= 0)) reset()
  else { scene.setBossPreview(BOSS_ARENA.id, mode); render() }
}

function reset(): void {
  if (!index || !raw || !ready) return
  game = challenge ? createBossChallenge(index, raw, profession, select.value) : createBossStudio(index, raw, select.value)
  scene.setMap(game.engine.world.map(BOSS_ARENA.map)!)
  finished = false; startedAt = game.engine.world.state.tick
  $('challengeResult').classList.add('hidden')
  if (challenge) {
    mode = 'live'; paused = choosing
    $('pauseFight').textContent = '暂停'
    $('challengeRole').textContent = `${tx(PROFESSION_BY_ID[profession].name)} · Lv.20 · ${tx(game.engine.world.get(game.engine.world.player.held)?.name ?? '')}`
    $('challengeCount').textContent = `本次已击败 ${victories.size} / ${BOSSES.length}`
  }
  const boss = BOSS_BY_ID[select.value]
  $('facingControl').classList.toggle('hidden', challenge || boss.id !== 'alberic')
  mode = bossPreviewMode(mode, boss.id)
  scene.setBossPreview(BOSS_ARENA.id, mode)
  paintModes()
  $('bossInfo').textContent = `${boss.footprint.join(' × ')} 格碰撞体 · ${boss.hp} 生命 · ${boss.defense} 防御`
  $('skillButtons').replaceChildren(...boss.skills.map((s, i) => {
    const button = document.createElement('button')
    button.dataset.skill = s.id
    button.textContent = `${i + 1}. ${tx(s.name)} · ${(s.windup / 10).toFixed(1)}s`
    button.disabled = challenge
    button.onclick = () => {
      const e = bossEntity()
      if (!e || game.engine.world.num(e, 'hp') <= 0) return
      delete e.boss!.pending; e.boss!.nextSkill = i; e.boss!.nextAt = 0
      const at = game.engine.world.posOf(e)!
      game.engine.author(() => game.engine.teleport(game.engine.world.player, { ...at, y: at.y + Math.min(4, s.radius) }))
      paused = false; $('pauseFight').textContent = '暂停'; chooseMode('live')
    }
    return button
  }))
  keys.clear(); attack = false
  if (!challenge && params.has('shot')) {
    const e = bossEntity()!, b = e.boss!
    b.nextSkill = Math.min(2, Math.max(0, Number(params.get('skill') ?? 0)))
    for (let i = 0; i < 120 && !b.pending; i++) game.engine.tick()
    const count = params.get('shot') === 'impact' ? b.pending!.releaseAt - game.engine.world.state.tick : 8
    for (let i = 0; i < count; i++) game.engine.tick()
    paused = true
  }
  render()
}

scene.hooks = { onFrame: (f) => hud.onFrame(f), onFx: (fx, f) => hud.onFx(fx, f), onReady: () => { scene.setMuted(true); ready = true; if (index) reset(); enableChallengeStart() } }
new Phaser.Game({ type: Phaser.WEBGL, parent: 'game', pixelArt: true, backgroundColor: '#101b20', scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight }, scene: [scene], input: { keyboard: false } })

select.onchange = () => challenge ? showLobby() : reset()
paintModes()
modeControls.onclick = (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]')
  if (button) chooseMode(button.dataset.mode!)
}
facing.onchange = () => { if (game) render() }
$('resetFight').onclick = () => { reset(); $('resetFight').blur() }
$('pauseFight').onclick = () => { if (choosing || finished || !game) return; clearInput(); paused = !paused; $('pauseFight').textContent = paused ? '继续' : '暂停'; $('pauseFight').blur() }
$('enrageBoss').onclick = () => { const e = bossEntity(); if (e) { (e.props ??= {}).hp = Math.floor(BOSS_BY_ID[select.value].hp * 0.4); game.engine.tick(); render() } }
window.addEventListener('keydown', (e) => {
  if (choosing || finished || !game) return
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement) return
  if (e.code === 'Escape') { e.preventDefault(); $('pauseFight').click(); return }
  if (dirOf[e.code]) { e.preventDefault(); keys.add(e.code) }
  if (e.code === 'Space') { e.preventDefault(); attack = true }
})
window.addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Space') attack = false })
$('game').addEventListener('pointerdown', () => { (document.activeElement as HTMLElement | null)?.blur() })
window.addEventListener('blur', () => {
  clearInput()
  if (challenge && !choosing && !finished) { paused = true; $('pauseFight').textContent = '继续' }
})
setInterval(() => {
  if (!game || !ready) return
  if (!paused && !choosing && !finished && mode === 'live') {
    const dir = dirOf[[...keys].at(-1) ?? '']
    if (dir) game.engine.movePlayer(dir)
    if (attack) game.engine.playerAttack()
    game.engine.tick()
    if (challenge) {
      const outcome = challengeOutcome(game)
      if (outcome) finishChallenge(outcome)
    }
  }
  if (mode === 'live') render()
  hud.tickLabels()
}, 100)

async function load(): Promise<void> {
  const base = `${import.meta.env.BASE_URL}world/`
  ;[index, raw] = await Promise.all([fetch(base + 'index.json').then((r) => r.json()), fetch(base + 'maps/eastroad.json').then((r) => r.json())])
  if (ready) reset()
  enableChallengeStart()
}
void load().catch((error: unknown) => { $('studioStatus').textContent = String(error) })

function enableChallengeStart(): void {
  const start = document.querySelector<HTMLButtonElement>('#startChallenge')
  if (start) { start.disabled = !ready || !index; start.textContent = start.disabled ? '加载战场…' : '开始挑战' }
}

function showLobby(): void {
  choosing = true; paused = true; clearInput()
  $('challengeResult').classList.add('hidden')
  $('challengeLobby').classList.remove('hidden')
  $('challengeLobby').innerHTML = `<div class="challenge-sheet">
    <div class="studio-kicker">SYMBOLIC WORLD / BOSS CHALLENGE</div><h1 id="challengeTitle">首领挑战</h1>
    <p class="challenge-lede">选择你的职业，挑战首领。</p>
    <p class="challenge-note">独立试炼角色 · 自动装备武器 · 职业天赋全部解锁 · 不影响正式存档</p>
    <fieldset class="challenge-professions"><legend>01 / 选择职业</legend>${SKILL_PROFESSIONS.map((p) => {
      const kit = CHALLENGE_LOADOUTS[p.id]
      return `<label class="challenge-profession"><input type="radio" name="challengeProfession" value="${p.id}" ${p.id === profession ? 'checked' : ''}>
        <div><img src="${skillPng(kit.icon)}" alt=""><b>${esc(tx(p.name))}</b><p>${esc(tx(kit.tip))}</p><small>Lv.20 · ${p.id === 'warrior' ? kit.hp + 14 : kit.hp + 4} 生命 · ${kit.def} 防御</small></div></label>`
    }).join('')}</fieldset>
    <label class="challenge-target">02 / 选择对手<select id="challengeBoss">${BOSSES.map((b) => `<option value="${b.id}" ${b.id === select.value ? 'selected' : ''}>${victories.has(b.id) ? '✓ ' : ''}${esc(tx(b.name))} · ${b.footprint.join('×')} 格</option>`).join('')}</select></label>
    <div class="challenge-footer"><a href="./">← 返回主页面</a><span>已击败 ${victories.size} / ${BOSSES.length}</span><button id="startChallenge" class="challenge-primary" disabled>加载战场…</button></div>
    <p class="challenge-note">WASD / 方向键移动 · 空格攻击 · 近战贴近敌人，远程沿面向方向射击 · Esc 暂停</p>
  </div>`
  $('startChallenge').onclick = () => {
    profession = document.querySelector<HTMLInputElement>('input[name="challengeProfession"]:checked')!.value
    select.value = $<HTMLSelectElement>('challengeBoss').value
    choosing = false; paused = false
    $('challengeLobby').classList.add('hidden')
    reset()
    ;(document.activeElement as HTMLElement | null)?.blur()
  }
  enableChallengeStart()
}

function finishChallenge(outcome: 'victory' | 'defeat'): void {
  finished = true; paused = true; clearInput()
  const won = outcome === 'victory'
  if (won) victories.add(select.value)
  $('challengeCount').textContent = `本次已击败 ${victories.size} / ${BOSSES.length}`
  const seconds = ((game.engine.world.state.tick - startedAt) / 10).toFixed(1)
  const next = BOSSES.find((b) => !victories.has(b.id))
  $('challengeResult').innerHTML = `<div class="challenge-sheet challenge-result"><div class="studio-kicker">${won ? 'VICTORY' : 'TRY AGAIN'}</div>
    <h1 id="resultTitle">${won ? victories.size === BOSSES.length ? '首领尽破' : '挑战成功' : '挑战失败'}</h1>
    <p>${esc(tx(PROFESSION_BY_ID[profession].name))} · ${esc(tx(BOSS_BY_ID[select.value].name))} · ${seconds} 秒</p>
    <p class="challenge-note">${won ? `本次已击败 ${victories.size} / ${BOSSES.length} 位领主` : '留意地面预警，离开标记格，再抓住收招空隙。'}</p>
    <div class="challenge-result-actions"><button id="retryChallenge">再次挑战</button><button id="chooseChallenge">更换职业 / 对手</button>${won && next ? '<button id="nextChallenge" class="challenge-primary">挑战下一位</button>' : ''}</div><a href="./">返回主页面 →</a></div>`
  $('challengeResult').classList.remove('hidden')
  $('retryChallenge').onclick = () => { reset(); (document.activeElement as HTMLElement | null)?.blur() }
  $('chooseChallenge').onclick = showLobby
  document.querySelector<HTMLButtonElement>('#nextChallenge')?.addEventListener('click', () => { select.value = next!.id; reset(); (document.activeElement as HTMLElement | null)?.blur() })
}

if (challenge) {
  document.body.classList.add('challenge-mode')
  document.title = '首领挑战 · OpenWorld'
  document.querySelector('#bossStudio h1')!.textContent = '首领挑战'
  document.querySelector('#bossStudio > p')!.textContent = '独立角色 · 不影响正式存档'
  $('modeControl').classList.add('hidden')
  $('enrageBoss').classList.add('hidden')
  const badge = document.createElement('div'); badge.id = 'challengeRole'; $('bossInfo').before(badge)
  const count = document.createElement('div'); count.id = 'challengeCount'; badge.after(count)
  const change = document.createElement('button'); change.id = 'changeChallenge'; change.textContent = '更换职业 / 对手'; change.onclick = showLobby
  document.querySelector('.studio-actions')!.append(change)
  document.querySelector('.studio-help')!.textContent = 'WASD / 方向键移动 · 空格攻击 · Esc 暂停。职业天赋自动生效；远程攻击沿角色面向方向发射。'
  showLobby()
}
