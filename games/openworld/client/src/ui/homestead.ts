/// <reference types="vite/client" />

// The Held Ground's panel (its steward's talk opens it: "The Held Ground…", `panel: haven`; content haven.ts): how far
// the land holds, drawn as a round chart beside the ground's stock, and three tabs of what it can grow into — the LAND
// (rings of mist lifted, one after another), new GROUNDS (places of their own with what their ground is good for: a
// quarry, a timberland, a lake, hot springs), BUILDINGS (a plot at the heart built into a workshop, a storehouse…).
// Materials are handed into the stock to whoever opened the panel (the fx's `by`): drag a stack from the pack beneath
// onto a card's slot (as many as that widening still lacks), or click a stack (all that the open widenings lack of it,
// together). The stock is one pile every card draws on (ui/stock.ts): a card shows it beside what it needs, and one whose
// land is reached and whose needs the stock holds is built with its button; an opened ground can be gone to from its card.
// Its opening page is today's residence overview; Residents shows beds and the existing routine, while Upgrades keeps the
// land, grounds and building tracks. OpenWorld's own panel (ui/panels.ts), drawn into the host the runtime gives it.

import type { Frame, ItemInfo } from '@openworld/engine'
import { COIN, HAVEN_UPGRADES } from '@openworld-game/content'
import { esc, locale, tx } from '@openworld/runtime/src/ui/common.ts'
import type { GamePanel, PanelContext } from '@openworld/runtime/src/ui/panels.ts'
import css from './homestead.css?inline'
import { stockView, type StockView, type WideningState } from './stock.ts'
import { useStyle } from './style.ts'
import { reconcileResidentWorkDraft, residentWorkAssignment, residentWorkDraftDiffersFromOrder, residentWorkDraftForOrder, type ResidentWorkDraft } from './workDraft.ts'

type Upgrade = (typeof HAVEN_UPGRADES)[number]
type Track = Upgrade['track']
type Page = 'today' | 'residents' | 'upgrades'

/** The panel's title, and the story's facts it reads: how far the land goes, and the stock's (`<STOCK><type>`). */
const TITLE = { en: 'The Held Ground', zh: '誓守之地 · 领地经营' }
const SIZE = 'haven.size'
const STOCK = 'haven.stock.'
/** What the steward is asked (content haven.ts `haven/steward`): `say: haven`, choice `build:<id>` or `go:<id>`. */
const VERB = 'haven'

const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const TRACKS: [Track, string, string, string][] = [['land', 'Land', '土地', '⛰'], ['zone', 'Grounds', '新区域', '🗺'], ['building', 'Buildings', '建筑', '🏠']]

class HomesteadPanel implements GamePanel {
  private sig = ''
  private track: Track = 'land'
  private page: Page = 'today'
  /** Who opened the panel (its steward): what is handed and asked goes to them. */
  private steward?: string
  private last?: Frame
  private workDrafts = new Map<string, ResidentWorkDraft>()

  constructor(private ctx: PanelContext) {
    useStyle('homestead', css)
  }

  private get host(): HTMLElement {
    return this.ctx.host
  }

  show(f: Frame | undefined, opened: { by?: string }): void | false {
    if (!f || !opened.by) return false
    this.steward = opened.by
    this.page = 'today'
    this.sig = ''
    this.workDrafts.clear()
    this.render(f)
  }

  render(f: Frame): void {
    this.last = f
    const zh = locale.value === 'zh'
    const view = stockView(HAVEN_UPGRADES, f.facts, { size: SIZE, stock: STOCK })
    const { size, rows } = view
    // what is carried, by kind
    const carried = new Map<string, { item: ItemInfo; count: number }>()
    for (const s of f.player.slots) {
      if (!s || s.worn) continue
      const c = carried.get(s.item.type)
      if (c) c.count += s.count
      else carried.set(s.item.type, { item: s.item, count: s.count })
    }
    const materials = new Set(HAVEN_UPGRADES.flatMap((u) => u.needs.map((n) => n.type)))
    const names = new Map(HAVEN_UPGRADES.flatMap((u) => u.needs.map((n) => [n.type, n.text] as const)))
    const sig = JSON.stringify([locale.value, this.page, this.track, f.residence, size, rows.map((r) => [r.state, r.buildable, r.needs.map((n) => n.stock)]), [...carried].map(([t, c]) => t + c.count)])
    if (sig === this.sig) return
    this.sig = sig
    if (this.page !== 'upgrades') {
      this.renderOverview(f, zh)
      return
    }
    const label: Record<WideningState, string> = zh ? { done: '已完成', open: '可扩建', locked: '未解锁' } : { done: 'Done', open: 'Open', locked: 'Locked' }
    const verb: Record<Track, string> = zh ? { land: '扩建！', zone: '开辟！', building: '建造！' } : { land: 'Widen!', zone: 'Open!', building: 'Build!' }
    const list = rows.filter((r) => r.u.track === this.track)
    const cards = list.map((r, i) => {
      const live = r.state === 'open'
      const needs = r.needs.map((n) => {
        const pct = Math.min(100, Math.round((100 * n.stock) / n.count))
        const full = n.lack === 0
        const have = carried.get(n.type)?.count ?? 0
        const slot = live
          ? `<div class="hs-drop${full ? ' full' : ''}${!full && have ? ' can' : ''}" data-type="${esc(n.type)}" data-lack="${n.lack}" title="${zh ? (full ? '库存已够' : have ? '拖入或点击放入库存' : '身上没有') : full ? 'Enough in stock' : have ? 'Drop or click to stock it' : 'None carried'}"><span class="icon" data-icon="need:${esc(n.type)}"></span>${full ? '<i class="hs-tick">✓</i>' : ''}</div>`
          : `<span class="icon" data-icon="need:${esc(n.type)}"></span>`
        return `<div class="hs-need${full ? ' full' : ''}">
          ${slot}
          <div class="hs-need-mid"><span class="hs-need-name">${esc(tx(n.text))}${live && !full ? `<small>${zh ? '身上' : 'carried'} ${have}</small>` : ''}</span><span class="hs-bar"><i style="width:${pct}%"></i></span></div>
          <b title="${zh ? '库存 / 所需' : 'in stock / needed'}">${n.stock}/${n.count}</b></div>`
      }).join('')
      const req = r.state === 'locked' ? `<span class="hs-req">${r.u.track === 'land' ? (zh ? '先完成上一级' : 'The one before first') : zh ? `需要土地 ${ROMAN[r.u.land - 1] ?? r.u.land} 级` : `Needs land ${r.u.land}`}</span>` : ''
      const act = r.buildable
        ? `<button class="hs-btn go" data-build="${esc(r.u.id)}">${verb[r.u.track]}</button>`
        : live
          ? `<button class="hs-btn" disabled>${zh ? '库存不够' : 'Not all in stock'}</button>`
          : r.state === 'done' && r.u.map
            ? `<button class="hs-btn" data-go="${esc(r.u.id)}">${zh ? '前往 ➜' : 'Go ➜'}</button>`
            : ''
      const reward = r.u.coins ? `<span class="hs-reward">${zh ? '奖励' : 'Reward'}：<span class="icon" data-icon="need:${COIN}"></span><b>${r.u.coins}</b></span>` : '<span></span>'
      return `<div class="hs-card ${r.state}${r.buildable ? ' buildable' : ''}">
        <div class="hs-badge">${r.u.track === 'land' ? ROMAN[i] ?? i + 1 : TRACKS.find((t) => t[0] === r.u.track)![3]}</div>
        <div class="hs-main">
          <div class="hs-top"><b>${esc(tx(r.u.name))}</b>${req}<span class="hs-chip ${r.state}">${label[r.state]}</span></div>
          <ul class="hs-unlocks">${r.u.unlocks.map((u) => `<li>${esc(tx(u))}</li>`).join('')}</ul>
          ${r.state === 'done' ? '' : `<div class="hs-needs">${needs}</div>`}
          <div class="hs-foot">${reward}${act}</div>
        </div>
      </div>`
    }).join('')
    const tabs = TRACKS.map(([t, en, zh2, ic]) => {
      const n = rows.filter((r) => r.u.track === t)
      return `<button class="cx-tab hs-tab${t === this.track ? ' on' : ''}" data-track="${t}">${ic} ${zh ? zh2 : en} <small>${n.filter((r) => r.state === 'done').length}/${n.length}</small>${n.some((r) => r.buildable) ? '<i class="hs-dot"></i>' : ''}</button>`
    }).join('')
    const stockChips = [...materials].map((type) => `<span class="hs-stock-chip${view.stock(type) ? '' : ' none'}" title="${esc(tx(names.get(type)!))}"><span class="icon" data-icon="need:${esc(type)}"></span><b>${view.stock(type)}</b></span>`).join('')
    const pack = [...carried.values()]
      .sort((a, b) => Number(view.lacking(b.item.type) > 0) - Number(view.lacking(a.item.type) > 0))
      .map((c) => `<div class="hs-item${materials.has(c.item.type) ? ' mat' : ''}${view.lacking(c.item.type) > 0 ? ' want' : ''}" data-drag="${esc(c.item.id)}" data-type="${esc(c.item.type)}" title="${esc(tx(c.item.name))}"><div class="icon" data-icon="${esc(c.item.id)}"></div>${c.count > 1 ? `<span class="count">${c.count}</span>` : ''}</div>`)
      .join('')
    const lands = rows.filter((r) => r.u.track === 'land').length
    this.host.innerHTML = `<div class="sheet wood hs-sheet">
      <div class="tabs-row"><b class="sheet-title">⚑ ${esc(tx(TITLE))}</b>${this.pageTabs(zh)}<button class="x" data-close>✕</button></div>
      <div class="tab-body hs-body">
        <div class="hs-left">
          <canvas class="hs-chart" width="220" height="220"></canvas>
          <div class="hs-level"><span>${zh ? '土地等级' : 'Land'}</span><b>${size}</b><small>/ ${lands}</small></div>
          <div class="hs-pips">${rows.filter((r) => r.u.track === 'land').map((r) => `<i class="${r.state === 'done' ? 'on' : ''}"></i>`).join('')}</div>
          <div class="hs-stock"><span class="hs-stock-title">${zh ? '领地库存' : 'Stock'}</span><div class="hs-stock-chips">${stockChips}</div></div>
          <p class="hs-note">${zh ? '材料交给阿尔贝里克存进领地库存：把行囊里的材料拖到卡片的材料槽上，或直接点一下行囊里的材料。库存是同一份：每张卡片看的都是它，建造哪一项就从中取走哪一项要的材料。' : 'Hand materials to Alberic into the stock: drag from the pack onto a card\'s slot, or click a stack in the pack. The stock is one pile: every card counts the same stock, and building one takes what it asks from it.'}</p>
        </div>
        <div class="hs-right">
          <div class="cx-tabs hs-tabs">${tabs}</div>
          <div class="hs-track">${cards}</div>
          <div class="hs-pack"><span class="hs-pack-title">${zh ? '行囊' : 'Pack'}</span><div class="hs-pack-items">${pack || `<span class="muted small">${zh ? '身上没有东西' : 'Nothing carried'}</span>`}</div></div>
        </div>
      </div></div>`
    this.chart(this.host.querySelector<HTMLCanvasElement>('.hs-chart')!, size, lands)
    this.wirePages()
    this.wire(view, carried, materials)
    this.ctx.paint([...carried.values()].map((c) => c.item))
  }

  private pageTabs(zh: boolean): string {
    const pages: [Page, string, string][] = [['today', 'Today', '今日经营'], ['residents', 'Residents', '居民与床位'], ['upgrades', 'Upgrades', '扩建']]
    return `<nav class="hs-pages">${pages.map(([page, en, zh2]) => `<button class="cx-tab hs-page${this.page === page ? ' on' : ''}" data-page="${page}">${zh ? zh2 : en}</button>`).join('')}</nav>`
  }

  private renderOverview(f: Frame, zh: boolean): void {
    const residence = f.residence
    const n = (value: number | undefined) => value === undefined ? '—' : String(value)
    const stat = (label: string, value: number | undefined) => `<div class="hs-stat"><span>${label}</span><b>${n(value)}</b></div>`
    let body: string
    if (this.page === 'today') {
      const work = residence?.work
      const ready = !!residence?.active && !!residence?.onMap && !!work
      const notice = !residence
        ? (zh ? '领地经营数据尚未配置。' : 'Residence work data is not configured.')
        : !residence.active || !residence.onMap
          ? (zh ? '你已离开领地；工作总览暂停，返回后重新读取。' : 'Away from the Held Ground. The work overview is paused and will refresh when you return.')
          : !work
            ? (zh ? '此领地尚未配置实时经营数据。' : 'Live work data is not configured for this residence.')
            : ''
      const metrics = ready ? [
        work.crops && `<section class="hs-overview-card"><h3>${zh ? '作物' : 'Crops'}</h3><div class="hs-stats">${stat(zh ? '在地作物' : 'Planted', work.crops.total)}${stat(zh ? '成熟可收' : 'Ready', work.crops.ripe)}${stat(zh ? '待浇水' : 'Needs water', work.crops.needsWater)}</div></section>`,
        work.livestock && `<section class="hs-overview-card"><h3>${zh ? '牲畜' : 'Livestock'}</h3><div class="hs-stats">${stat(zh ? '在地牲畜' : 'Kept', work.livestock.total)}${stat(zh ? '待喂养' : 'Needs feed', work.livestock.unfed)}${stat(zh ? '可挤奶' : 'Ready to milk', work.livestock.milkable)}</div></section>`,
        `<section class="hs-overview-card"><h3>${zh ? '地面收集物' : 'Loose goods'}</h3><div class="hs-stats">${stat(zh ? '待拾鸡蛋' : 'Eggs to gather', work.groundEggs)}</div></section>`,
      ].filter((html): html is string => !!html).join('') : ''
      const warehouses = ready ? (work.warehouses ?? []).map((box) => `<article class="hs-warehouse">
        <div class="hs-warehouse-head"><b>${esc(tx(box.name))}</b><span>${box.usedSlots}/${box.capacity ?? '—'} ${zh ? '格' : 'slots'}</span></div>
        <p>${box.contents.length ? box.contents.map((item) => `${esc(tx(item.name))} ×${item.count}`).join(' · ') : (zh ? '空' : 'Empty')}</p>
      </article>`).join('') : ''
      body = `<div class="hs-overview">
        ${notice ? `<p class="hs-alert">${esc(notice)}</p>` : ''}
        ${metrics ? `<div class="hs-overview-grid">${metrics}</div>` : ''}
        ${ready ? `<section class="hs-overview-card hs-storage"><h3>${zh ? '实体仓库与箱子' : 'Actual storage containers'}</h3>${warehouses || `<p class="muted">${zh ? '没有可用容器。' : 'No eligible containers.'}</p>`}</section>` : ''}
        ${ready ? `<p class="hs-note">${zh ? '领地库存账仅用于扩建材料；上方容器显示的是实体物资。作物、牲畜与鸡蛋只统计地面对象，不含箱内物品。' : 'The building stock ledger is for upgrade materials. Containers above show real contents. Crop, livestock and egg counts include only objects on the ground, never contents inside a container.'}</p>` : ''}
      </div>`
    } else {
      const residents = residence?.residents ?? []
      const names = new Map(residents.map((person) => [person.id, tx(person.name)]))
      const beds = residence?.beds
      const bedNumbers = new Map((beds?.slots ?? []).map((bed, i) => [bed.anchor, i + 1]))
      const residentRows = !residence
        ? `<li class="muted">${zh ? '居民数据尚未配置。' : 'Resident data is not configured.'}</li>`
        : residents.length
        ? residents.map((person) => {
          const bed = bedNumbers.get(person.slot)
          const location = bed ? (zh ? `床位 ${bed}` : `Bed ${bed}`) : (zh ? '床位信息暂缺' : 'Bed not listed')
          return `<li><b>${esc(tx(person.name))}</b><span>${location}</span></li>`
        }).join('')
        : `<li class="muted">${zh ? '暂无已入住居民。' : 'No residents have moved in.'}</li>`
      const bedRows = !residence
        ? `<li class="muted">${zh ? '床位数据尚未配置。' : 'Bed data is not configured.'}</li>`
        : beds?.slots.length
        ? beds.slots.map((bed, i) => `<li><b>${zh ? `床位 ${i + 1}` : `Bed ${i + 1}`}</b><span>${bed.resident ? esc(names.get(bed.resident) ?? bed.resident) : (zh ? '空床' : 'Available')}</span></li>`).join('')
        : `<li class="muted">${zh ? '暂无开放床位。' : 'No open beds yet.'}</li>`
      const schedule = !residence
        ? (zh ? '领地居民与床位信息不可用。' : 'Residence data is unavailable.')
        : zh
          ? '居民按现有昼夜作息生活：21:00–07:00休息，白天活动。只有你在领地且时钟运行时岗位才会推进；关闭此面板才能继续时间。离开领地期间岗位暂停。'
          : 'Residents keep their current routine and sleep from 21:00 to 07:00. Work advances only while you are on the Held Ground and the clock runs; close this panel to let time pass. Orders pause while you are away.'
      const work = residence?.work
      const targetList = work?.crops?.targets ?? []
      const animals = work?.livestock?.animals ?? []
      const warehouses = work?.warehouses ?? []
      const groundVisible = !!residence?.active && !!residence.onMap && !!work
      const status = (value: string) => ({ working: zh ? '工作中' : 'Working', paused: zh ? '已暂停' : 'Paused', revoked: zh ? '已撤销' : 'Revoked', recovery: zh ? '待取回' : 'Recovery needed' }[value] ?? value)
      const workKind = (value: 'harvest' | 'feed') => value === 'feed' ? (zh ? '喂养员' : 'Feeder') : (zh ? '手工采收员' : 'Hand harvester')
      const workRows = residents.map((person) => {
        const order = person.order
        let draft = this.workDrafts.get(person.id)
        if (!draft) {
          draft = order
            ? residentWorkDraftForOrder(order)
            : { kind: 'harvest', warehouse: '', cells: new Set(), animalIds: new Set(), editing: false }
          this.workDrafts.set(person.id, draft)
        }
        const targetKeys = new Set(targetList.map((target) => `${target.x},${target.y}`))
        const orderKeys = new Set((order?.cells ?? []).map((cell) => `${cell.x},${cell.y}`))
        const animalKeys = new Set(animals.map((animal) => animal.id))
        const selectableAnimalIds = new Set(animals.filter((animal) => animal.selectable).map((animal) => animal.id))
        const { unavailableWarehouse, removedDraftCell, removedDraftAnimal } = reconcileResidentWorkDraft(draft, {
          groundVisible,
          targetKeys,
          previouslyAuthorizedKeys: orderKeys,
          animalIds: animalKeys,
          selectableAnimalIds,
          selectableWarehouses: new Set(warehouses.filter((box) => box.selectable).map((box) => box.id)),
        })
        const cargo = new Map<string, { name: ItemInfo['name']; count: number }>()
        for (const item of order?.cargo ?? []) {
          const row = cargo.get(item.type)
          if (row) row.count++
          else cargo.set(item.type, { name: item.name, count: 1 })
        }
        const cargoLabel = [...cargo.values()].map((item) => `${esc(tx(item.name))} ×${item.count}`).join(' · ')
        const assignedCells = order?.cells.map((cell) => {
          const key = `${cell.x},${cell.y}`
          return groundVisible && !targetKeys.has(key)
            ? `${zh ? '已授权田块' : 'Authorized plot'} (${cell.x}, ${cell.y})${zh ? '，当前空田' : ' · currently empty'}`
            : `(${cell.x}, ${cell.y})`
        }).join(' · ')
        const animalsById = new Map(animals.map((animal) => [animal.id, animal]))
        const assignedAnimals = (order?.animalIds ?? []).map((id) => {
          const animal = animalsById.get(id)
          return animal
            ? `${tx(animal.name)} · (${animal.x}, ${animal.y}) · ${animal.fed ? (zh ? '已饱食' : 'Fed') : (zh ? '待喂养' : 'Needs feed')}${animal.selectable ? '' : ` · ${zh ? '当前不可委任' : 'currently unavailable'}`}`
            : undefined
        }).filter((label): label is string => !!label)
        const unavailableAssignedAnimals = (order?.animalIds ?? []).filter((id) => !animalsById.has(id)).length
        if (unavailableAssignedAnimals) assignedAnimals.push(`${zh ? '原授权动物暂不可用' : 'Previously authorized animal unavailable'}${unavailableAssignedAnimals > 1 ? ` ×${unavailableAssignedAnimals}` : ''}`)
        const assignedWarehouse = warehouses.find((box) => box.id === order?.warehouse)
        const editable = !!person.eligible && !!residence?.active && !!residence.onMap && (!order || (!!draft.editing && !['revoked', 'recovery'].includes(order.status)))
        const plotOptions = [
          ...targetList.map((target) => `<label><input type="checkbox" data-work-cell="${esc(person.id)}" value="${target.x},${target.y}" ${draft!.cells.has(`${target.x},${target.y}`) ? 'checked' : ''}> (${target.x}, ${target.y}) · ${esc(tx(target.name))}${target.ripe ? (zh ? ' · 成熟' : ' · ripe') : ''}</label>`),
          ...(order?.kind === 'harvest' ? order.cells : []).filter((cell) => !targetKeys.has(`${cell.x},${cell.y}`)).map((cell) => `<label class="muted"><input type="checkbox" data-work-cell="${esc(person.id)}" value="${cell.x},${cell.y}" ${draft!.cells.has(`${cell.x},${cell.y}`) ? 'checked' : ''}> ${zh ? `已授权田块 (${cell.x}, ${cell.y})，当前空田` : `Authorized plot (${cell.x}, ${cell.y}) · currently empty`}</label>`),
        ].join('')
        const ownerLabel = (animal: typeof animals[number]) => {
          const label = { mine: zh ? '玩家所有' : 'Player-owned', ours: zh ? '领地所有' : 'Held Ground-owned', nobody: zh ? '无归属，不可委任' : 'Unowned · unavailable', another: zh ? '他人所有，不可委任' : 'Owned by someone else · unavailable' }[animal.owner]
          return !animal.selectable && (animal.owner === 'mine' || animal.owner === 'ours')
            ? `${label} · ${zh ? '当前不可委任' : 'unavailable for assignment'}`
            : label
        }
        const animalOptions = animals.map((animal) => `<label class="${animal.selectable ? '' : 'muted'}"><input type="checkbox" data-work-animal="${esc(person.id)}" value="${esc(animal.id)}" ${draft!.animalIds.has(animal.id) ? 'checked' : ''} ${animal.selectable ? '' : 'disabled'}> ${esc(tx(animal.name))} · (${animal.x}, ${animal.y}) · ${animal.fed ? (zh ? '已饱食' : 'Fed') : (zh ? '待喂养' : 'Needs feed')} · ${esc(ownerLabel(animal))}</label>`).join('')
        const validWarehouse = warehouses.some((box) => box.id === draft!.warehouse && box.selectable)
        const validCells = [...draft.cells].some((key) => targetKeys.has(key) || orderKeys.has(key))
        const validAnimals = draft.animalIds.size > 0 && [...draft.animalIds].every((id) => selectableAnimalIds.has(id))
        const validTargets = draft.kind === 'harvest' ? validCells : validAnimals
        const hasCargo = !!order && (order.cargo.length > 0 || !!order.pendingAnimalId)
        const changesWithCargo = !!order && hasCargo && residentWorkDraftDiffersFromOrder(draft, order)
        const editWarning = `${unavailableWarehouse ? `<p class="hs-alert">${zh ? '所选仓库已消失、上锁或不可用；请重新选择仓库。' : 'The selected warehouse is missing, locked, or unavailable. Choose another.'}</p>` : ''}${removedDraftCell ? `<p class="hs-alert">${zh ? '有未确认的田块已不再可授权，已从草稿移除。' : 'A draft plot is no longer available and was removed.'}</p>` : ''}${removedDraftAnimal ? `<p class="hs-alert">${zh ? '有已消失或不再归领地所有的动物，已从未确认草稿移除。' : 'A missing or no-longer-owned animal was removed from the draft.'}</p>` : ''}${changesWithCargo ? `<p class="hs-alert">${zh ? '岗位物资仍在途中；请先继续送回仓库或撤销后取回，再更换岗位、仓库或授权对象。' : 'Work cargo is still in transit. Return or recover it before changing the job, warehouse, or authorized targets.'}</p>` : ''}`
        const cropPicker = `<div class="hs-work-plots"><b>${zh ? '授权田块（按格子）' : 'Authorized plots (by cell)'}</b>${plotOptions || `<span class="muted">${zh ? (order?.kind === 'harvest' ? '原授权田块已空；新种下作物后也可再授权。' : '当前没有可授权作物；种下作物后再委派。') : (order?.kind === 'harvest' ? 'Existing plots are empty; authorize newly planted crops here.' : 'No crops to authorize yet; plant crops before assigning.')}</span>`}</div><small>${zh ? '按原手采规则：基础 1 份作物，居民自身的采收特长可增加产量，另返 1 粒种子；不使用镰刀，不播种、浇水或施肥。' : 'Original hand-pick yield: base 1 crop; the resident’s own harvest skill may add yield, plus 1 returned seed. No sickle, sowing, watering, or fertilizing.'}</small>`
        const animalPicker = `<div class="hs-work-plots hs-work-animals"><b>${zh ? '授权动物（默认不勾选）' : 'Authorized animals (none by default)'}</b>${animalOptions || `<span class="muted">${zh ? '当前没有可显示的领地牲畜。' : 'No livestock is currently listed for this residence.'}</span>`}</div><small>${zh ? '每只动物每次消耗仓库中 1 份真实饲料。已饱食的自家动物仍保留授权，只在未饱食时取料；正常喂食可能触发繁殖，不会自动挤奶或出售鸡蛋。' : 'Each animal uses one real feed item from the warehouse per feeding. Fed owned animals may stay authorized and are fed only when hungry; normal feeding may trigger breeding. No automatic milking or egg sales.'}</small>`
        const selectors = editable ? `<div class="hs-work-select">${editWarning}<label>${zh ? '岗位' : 'Job'} <select data-work-kind="${esc(person.id)}"><option value="harvest" ${draft.kind === 'harvest' ? 'selected' : ''}>${zh ? '手工采收员' : 'Hand harvester'}</option><option value="feed" ${draft.kind === 'feed' ? 'selected' : ''}>${zh ? '喂养员' : 'Feeder'}</option></select></label><label>${zh ? '实体仓库' : 'Real warehouse'} <select data-work-warehouse="${esc(person.id)}"><option value="">${zh ? '请选择仓库' : 'Choose a warehouse'}</option>${warehouses.map((box) => `<option value="${esc(box.id)}" ${box.id === draft!.warehouse ? 'selected' : ''} ${box.selectable ? '' : 'disabled'}>${esc(tx(box.name))} · (${box.x}, ${box.y})${box.selectable ? '' : ` — ${esc(tx(box.unavailableReason!))}`}</option>`).join('')}</select></label>
          ${draft.kind === 'harvest' ? cropPicker : animalPicker}
          <button class="hs-btn go" data-work-assign="${esc(person.id)}" ${!validWarehouse || !validTargets || changesWithCargo ? 'disabled' : ''}>${zh ? (order ? '保存岗位配置' : `委派${workKind(draft.kind)}`) : (order ? 'Save work assignment' : `Assign ${workKind(draft.kind).toLowerCase()}`)}</button>${order ? `<button class="hs-btn" data-work-edit="${esc(person.id)}" data-edit="cancel">${zh ? '取消修改' : 'Cancel changes'}</button>` : ''}</div>` : ''
        const orderTargets = order?.kind === 'feed'
          ? `${zh ? '授权动物' : 'Authorized animals'}: ${esc(assignedAnimals.join(' · ') || '—')}`
          : `${zh ? '授权田块' : 'Authorized plots'}: ${esc(assignedCells || '—')}`
        const controls = order ? `<div class="hs-work-current"><b>${esc(workKind(order.kind))} · ${esc(status(order.status))}</b>${assignedWarehouse ? `<span>${esc(tx(assignedWarehouse.name))} · (${assignedWarehouse.x}, ${assignedWarehouse.y})</span>` : `<span>${zh ? '指定仓库当前不可用' : 'Selected warehouse is unavailable'}</span>`}<span>${orderTargets}</span>${order.blockedReason ? `<p class="hs-alert">${esc(tx(order.blockedReason))}</p>` : ''}${cargoLabel ? `<p>${zh ? '在途任务物资' : 'Task cargo'}: ${cargoLabel}</p>` : ''}<div class="hs-work-buttons">${order.status === 'working' ? `<button class="hs-btn" data-work-op="pause" data-worker="${esc(person.id)}">${zh ? '暂停' : 'Pause'}</button>` : order.status === 'paused' ? `<button class="hs-btn go" data-work-op="resume" data-worker="${esc(person.id)}">${zh ? '继续' : 'Resume'}</button>` : ''}${!draft.editing && person.eligible && !['revoked', 'recovery'].includes(order.status) ? `<button class="hs-btn" data-work-edit="${esc(person.id)}" data-edit="start">${zh ? '修改配置' : 'Change assignment'}</button>` : ''}<button class="hs-btn" data-work-op="revoke" data-worker="${esc(person.id)}">${zh ? '撤销岗位' : 'Revoke'}</button>${order.cargo.length ? `<button class="hs-btn" data-work-op="drop" data-worker="${esc(person.id)}">${zh ? '放下任务物资供取回' : 'Put task cargo down for recovery'}</button>` : ''}</div>${draft.editing ? selectors : ''}</div>` : person.eligible ? selectors : `<p class="muted">${esc(tx(person.eligibilityReason ?? { en: 'Not eligible for a work order.', zh: '目前不符合岗位条件。' }))}</p>`
        return `<li class="hs-resident-work"><div><b>${esc(tx(person.name))}</b><span>${zh ? `床位 ${bedNumbers.get(person.slot) ?? '—'}` : `Bed ${bedNumbers.get(person.slot) ?? '—'}`}</span></div>${controls}</li>`
      }).join('')
      const recoveries = (residence?.recoveries ?? []).map((recovery) => {
        const items = new Map<string, { name: ItemInfo['name']; count: number }>()
        for (const item of recovery.cargo) {
          const row = items.get(item.type)
          if (row) row.count++
          else items.set(item.type, { name: item.name, count: 1 })
        }
        const list = [...items.values()].map((item) => `${esc(tx(item.name))} ×${item.count}`).join(' · ')
        return `<li class="hs-resident-work"><div><b>${esc(tx(recovery.name))}</b><span>${status(recovery.status)} · (${recovery.x}, ${recovery.y})</span><small>${zh ? '物资将放在该居民/遗体脚边' : 'Cargo will be placed at this resident/body’s feet'}</small><span>${list}</span>${recovery.blockedReason ? `<p>${esc(tx(recovery.blockedReason))}</p>` : ''}</div><button class="hs-btn" data-work-op="drop" data-worker="${esc(recovery.id)}">${zh ? '放下任务物资供取回' : 'Put task cargo down for recovery'}</button></li>`
      }).join('')
      body = `<div class="hs-overview hs-residents">
        ${residence ? '' : `<p class="hs-alert">${zh ? '领地居民数据尚未配置。' : 'Residence data is not configured.'}</p>`}
        <div class="hs-overview-grid">
          <section class="hs-overview-card"><h3>${zh ? (residence ? `居民 · ${residents.length}` : '居民') : (residence ? `Residents · ${residents.length}` : 'Residents')}</h3><ul class="hs-list">${residentRows}</ul></section>
          <section class="hs-overview-card"><h3>${zh ? '床位' : 'Beds'}</h3><div class="hs-stats">${stat(zh ? '总数' : 'Total', beds?.total)}${stat(zh ? '已入住' : 'Occupied', beds?.occupied)}${stat(zh ? '空床' : 'Available', beds?.empty)}</div><ul class="hs-list">${bedRows}</ul></section>
        </div>
        <p class="hs-note">${esc(schedule)}</p>
        <section class="hs-overview-card hs-work-orders"><h3>${zh ? '居民岗位' : 'Resident work assignments'}</h3>${!residence?.active || !residence.onMap ? `<p class="hs-alert">${zh ? '你不在领地；岗位暂停。' : 'You are away; work orders are paused.'}</p>` : ''}<ul class="hs-list">${workRows || `<li class="muted">${zh ? '暂无已入住居民。' : 'No residents have moved in.'}</li>`}</ul></section>
        ${recoveries ? `<section class="hs-overview-card hs-work-orders"><h3>${zh ? '待取回的岗位物资' : 'Recoverable work cargo'}</h3><ul class="hs-list">${recoveries}</ul></section>` : ''}
      </div>`
    }
    this.host.innerHTML = `<div class="sheet wood hs-sheet">
      <div class="tabs-row"><b class="sheet-title">⚑ ${esc(tx(TITLE))}</b>${this.pageTabs(zh)}<button class="x" data-close>✕</button></div>
      <div class="tab-body">${body}</div></div>`
    this.wirePages()
    this.host.querySelector<HTMLElement>('[data-close]')!.onclick = () => this.ctx.close()
    this.wireWork()
  }

  private wireWork(): void {
    const steward = this.steward
    if (!steward) return
    const send = (choice: Record<string, unknown>) => this.ctx.send.speak(steward, 'resident-work', JSON.stringify({ v: 1, ...choice }))
    this.host.querySelectorAll<HTMLSelectElement>('[data-work-warehouse]').forEach((select) => select.onchange = () => {
      const draft = this.workDrafts.get(select.dataset.workWarehouse!)
      if (draft) draft.warehouse = select.value
      this.sig = ''
      this.render(this.last!)
    })
    this.host.querySelectorAll<HTMLSelectElement>('[data-work-kind]').forEach((select) => select.onchange = () => {
      const draft = this.workDrafts.get(select.dataset.workKind!)
      if (draft && (select.value === 'harvest' || select.value === 'feed')) draft.kind = select.value
      this.sig = ''
      this.render(this.last!)
    })
    this.host.querySelectorAll<HTMLInputElement>('[data-work-cell]').forEach((input) => input.onchange = () => {
      const cells = this.workDrafts.get(input.dataset.workCell!)?.cells
      if (cells) input.checked ? cells.add(input.value) : cells.delete(input.value)
      this.sig = ''
      this.render(this.last!)
    })
    this.host.querySelectorAll<HTMLInputElement>('[data-work-animal]').forEach((input) => input.onchange = () => {
      const animalIds = this.workDrafts.get(input.dataset.workAnimal!)?.animalIds
      if (animalIds) input.checked ? animalIds.add(input.value) : animalIds.delete(input.value)
      this.sig = ''
      this.render(this.last!)
    })
    this.host.querySelectorAll<HTMLButtonElement>('[data-work-assign]').forEach((button) => button.onclick = () => {
      const worker = button.dataset.workAssign!
      const draft = this.workDrafts.get(worker)
      if (!draft) return
      send(residentWorkAssignment(worker, draft))
      draft.editing = false
      this.sig = ''
      this.render(this.last!)
    })
    this.host.querySelectorAll<HTMLButtonElement>('[data-work-edit]').forEach((button) => button.onclick = () => {
      const worker = button.dataset.workEdit!
      const draft = this.workDrafts.get(worker)
      const person = this.last?.residence?.residents.find((row) => row.id === worker)
      if (!draft || !person) return
      if (button.dataset.edit === 'cancel') {
        if (person.order) Object.assign(draft, residentWorkDraftForOrder(person.order))
        else Object.assign(draft, { kind: 'harvest', warehouse: '', cells: new Set<string>(), animalIds: new Set<string>(), editing: false })
      } else {
        if (person.order) Object.assign(draft, residentWorkDraftForOrder(person.order))
        draft.editing = true
      }
      this.sig = ''
      this.render(this.last!)
    })
    this.host.querySelectorAll<HTMLButtonElement>('[data-work-op]').forEach((button) => button.onclick = () => {
      send({ op: button.dataset.workOp, worker: button.dataset.worker })
      this.sig = ''
      this.render(this.last!)
    })
  }

  private wirePages(): void {
    this.host.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((b) => (b.onclick = () => {
      this.page = b.dataset.page as Page
      this.sig = ''
      this.render(this.last!)
    }))
  }

  private wire(view: StockView<Upgrade>, carried: Map<string, { item: ItemInfo; count: number }>, materials: Set<string>): void {
    const steward = this.steward
    if (!steward) return
    this.host.querySelector<HTMLElement>('[data-close]')!.onclick = () => this.ctx.close()
    this.host.querySelectorAll<HTMLButtonElement>('[data-track]').forEach((b) => (b.onclick = () => ((this.track = b.dataset.track as Track), (this.sig = ''), this.render(this.last!))))
    this.host.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((b) => (b.onclick = () => this.ctx.send.speak(steward, VERB, `build:${b.dataset.build}`)))
    this.host.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => (b.onclick = () => (this.ctx.send.speak(steward, VERB, `go:${b.dataset.go}`), this.ctx.close())))
    const hand = (type: string, n: number) => {
      const c = carried.get(type)
      const k = Math.min(c?.count ?? 0, n)
      if (c && k > 0) this.ctx.send.offer(steward, c.item.id, k)
    }
    const drops = () => [...this.host.querySelectorAll<HTMLElement>('.hs-drop')]
    this.host.querySelectorAll<HTMLElement>('[data-drag]').forEach((el) => {
      el.addEventListener('pointerdown', (down) => {
        if (down.button !== 0) return
        const type = el.dataset.type!
        let ghost: HTMLElement | undefined
        const over = (x: number, y: number) => drops().find((d) => {
          const r = d.getBoundingClientRect()
          return d.dataset.type === type && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
        })
        const move = (e: PointerEvent) => {
          if (!ghost && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < 5) return
          if (!ghost) {
            ghost = el.cloneNode(true) as HTMLElement
            ghost.classList.add('hs-ghost')
            document.body.appendChild(ghost)
            drops().forEach((d) => d.classList.toggle('hot', d.dataset.type === type && !d.classList.contains('full')))
          }
          ghost.style.left = `${e.clientX}px`
          ghost.style.top = `${e.clientY}px`
          drops().forEach((d) => d.classList.toggle('over', d === over(e.clientX, e.clientY)))
        }
        const up = (e: PointerEvent) => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          drops().forEach((d) => d.classList.remove('hot', 'over'))
          if (ghost) {
            ghost.remove()
            const d = over(e.clientX, e.clientY)
            if (d) hand(type, Number(d.dataset.lack) || 0)
          } else if (materials.has(type)) hand(type, view.lacking(type))
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        down.preventDefault()
      })
    })
    drops().forEach((d) => d.addEventListener('click', () => hand(d.dataset.type!, Number(d.dataset.lack) || 0)))
  }

  /** The ground as a round chart: the held field round the sword, the mist beyond each ring not yet lifted. */
  private chart(c: HTMLCanvasElement, level: number, total: number): void {
    const g = c.getContext('2d')!
    const W = c.width
    const cx = W / 2
    const cy = W / 2
    const r0 = Math.round(W * 0.12)
    const step = (W / 2 - 12 - r0) / total
    const radius = (n: number) => r0 + n * step
    g.clearRect(0, 0, W, W)
    // the mist: the whole ground, pale and grey
    g.fillStyle = '#d9d4c6'
    g.beginPath()
    g.arc(cx, cy, radius(total), 0, Math.PI * 2)
    g.fill()
    // the held field: green out to the last ring lifted, each ring a shade lighter (what was won later)
    const greens = ['#7fae54', '#8fbb5e', '#a1c76b', '#b3d27a', '#c2dc88']
    for (let n = level; n >= 0; n--) {
      g.fillStyle = greens[n] ?? greens[greens.length - 1]
      g.beginPath()
      g.arc(cx, cy, radius(n), 0, Math.PI * 2)
      g.fill()
    }
    // trees and stones sprinkled in what is held, by a fixed pattern
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39996
      const d = r0 * 0.6 + (((i * 37) % 100) / 100) * (radius(level) - r0 * 0.6 - 6)
      if (d > radius(level) - 6) continue
      g.fillStyle = i % 3 === 0 ? '#9a9486' : '#4f7d36'
      g.beginPath()
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, i % 3 === 0 ? 2 : 3, 0, Math.PI * 2)
      g.fill()
    }
    // the rings: lifted ones a thin gold line, the standing ones dashed mist
    for (let n = 1; n <= total; n++) {
      g.save()
      g.beginPath()
      g.arc(cx, cy, radius(n), 0, Math.PI * 2)
      if (n <= level) {
        g.strokeStyle = 'rgba(217, 164, 65, 0.9)'
        g.lineWidth = 2
      } else {
        g.setLineDash([6, 5])
        g.strokeStyle = 'rgba(110, 104, 92, 0.85)'
        g.lineWidth = 3
      }
      g.stroke()
      g.restore()
      g.fillStyle = n <= level ? '#7a4a12' : '#6e685c'
      g.font = '700 12px "Pixelify Sans", sans-serif'
      g.textAlign = 'center'
      g.fillText(ROMAN[n - 1] ?? String(n), cx, cy - radius(n) + 14)
    }
    g.strokeStyle = '#4a2a14'
    g.lineWidth = 4
    g.beginPath()
    g.arc(cx, cy, radius(total) + 2, 0, Math.PI * 2)
    g.stroke()
    // the planted sword at the heart
    g.save()
    g.translate(cx, cy + 6)
    g.fillStyle = '#e8e4da'
    g.strokeStyle = '#3a2414'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(-3, -6)
    g.lineTo(3, -6)
    g.lineTo(3, 14)
    g.lineTo(0, 20)
    g.lineTo(-3, 14)
    g.closePath()
    g.fill()
    g.stroke()
    g.fillStyle = '#d9a441'
    g.fillRect(-10, -9, 20, 4)
    g.strokeRect(-10, -9, 20, 4)
    g.fillStyle = '#6b3d1c'
    g.fillRect(-2, -20, 4, 11)
    g.fillStyle = '#d9a441'
    g.beginPath()
    g.arc(0, -22, 3.5, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
}

/** The Held Ground's panel (ui/panels.ts). */
export const homesteadPanel = (ctx: PanelContext): GamePanel => new HomesteadPanel(ctx)
