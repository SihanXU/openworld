// Orchestrates save-local creative drafts. AI proposes; engine compilers and isolated trials decide admission.
import {
  inventionId, researchCapabilities, appendWorkshopPlan, trialWorkshopPackage, registerWorkshopPackage, workshopPackages,
  trialCreationMap, adoptCreationMap, creationMaps,
  exportWorkshopPackage, prepareWorkshopImport, disableWorkshopPackage, disableCreationMap,
  type Game, type RawChunk, type ResearchDesign, type ResearchPlan, type ResearchReply, type ResearchRequest, type Text,
  type WorkshopDraft, type WorkshopTrialReport, type WorkshopPackage, type CreationMapDraft, type CreationMapTrial, type Recipe,
} from '@openworld/engine'
import type { ModderLink } from './modderLink.ts'
import type { FromWorker, WorkshopView } from './protocol.ts'

const L = (en: string, zh: string): Text => ({ en, zh })
/** Balance the map vocabulary so a long fixture list cannot crowd out food, materials or creatures. */
function mapThings(owner: Game, intent: string): { id: string; name: string }[] {
  const types = owner.engine.world.onto.data.types, ids = Object.keys(types)
  const parents = new Set(ids.map(id => id.slice(0, id.lastIndexOf('/'))))
  const utility = new Set(['fixture/water/well', 'item/tool/hoe', 'item/tool/sickle', 'item/vessel/bucket/water', 'item/vessel/bucket/empty'])
  const words = [...new Set([...(intent.toLowerCase().match(/[a-z]{3,}/g) ?? []), ...(intent.match(/[\u3400-\u9fff]+/g) ?? []).flatMap(chunk => [...chunk].slice(1).map((_, i) => chunk.slice(i, i + 2)))])]
  const groups: [string, number][] = [['fixture/nature', 8], ['fixture/furniture', 12], ['fixture/crop', 20], ['fixture/water', 2], ['fixture/chalk', 2], ['item/seed', 24], ['item/tool', 4], ['item/vessel/bucket', 2], ['item/material', 5], ['item/food', 6], ['actor/creature', 3]]
  return groups.flatMap(([parent, limit]) => ids.filter(id => id.startsWith(`${parent}/`) && (!parents.has(id) || utility.has(id)))
    .map(id => ({ id, name: typeof types[id].name === 'string' ? types[id].name as string : Object.values(types[id].name ?? {}).join(' / ') }))
    .map(row => {
      const family = types[row.id.slice(0, row.id.lastIndexOf('/'))]
      const familyWords = JSON.stringify(family?.name ?? '') + ' ' + String(family?.props?.mapAliases ?? '')
      return { ...row, score: words.filter(word => (row.id + ' ' + row.name).toLowerCase().includes(word)).length + 10 * words.filter(word => familyWords.toLowerCase().includes(word)).length + (row.id.endsWith('/ripe') ? 0.2 : 0) + (utility.has(row.id) ? 20 : 0) }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit).map(({ id, name }) => ({ id, name })))
}
type EvidenceState = Game['engine']['world']['state'] & { workshopEvidence?: Record<string, WorkshopTrialReport> }
interface Draft {
  owner: Game; id: string; revision: number; title: Text; kind: WorkshopView['kind'];
  item?: WorkshopDraft; map?: CreationMapDraft; itemTrial?: WorkshopTrialReport; mapTrial?: CreationMapTrial; adopted?: boolean;
}
export interface WorkshopOptions {
  current(): Game | undefined
  link(): ModderLink | undefined
  chars(): Record<string, string>
  recipes(): Iterable<Recipe>
  post(message: FromWorker): void
  changed(): void
  kept(type: string): void
}

export class CreationWorkshop {
  kind: 'item' | 'map' = 'item'
  active?: Draft
  constructor(private o: WorkshopOptions) {}
  reset(): void { this.active = undefined; this.kind = 'item' }
  context(): Pick<ResearchRequest, 'plan' | 'subject' | 'trialFeedback'> {
    const d = this.active
    if (!d || d.owner !== this.o.current() || !d.item) return {}
    const trial = !d.adopted && d.itemTrial && !d.itemTrial.ok ? d.itemTrial : undefined
    const comparisons = trial?.comparisons?.map(({ use, baseline }) =>
      baseline.ok ? `${use}: installed baseline passed in the same fixture` : `${use}: installed baseline also failed: ${baseline.errors.join(', ')}`) ?? []
    const failed = trial && [...comparisons, ...trial.errors].slice(0, 8).map(error => error.slice(0, 500))
    return { plan: d.item.plan, ...((d.kind === 'uses' || d.adopted) && { subject: { typeId: d.item.typeId, name: d.title, plan: d.item.plan } }), ...(failed?.length && { trialFeedback: { revision: d.revision, errors: failed } }) }
  }
  proposal(owner: Game, result: ResearchReply): void {
    let plan = result.plan
    if (!plan || (!result.design && this.active?.kind !== 'uses' && !this.active?.adopted)) return
    const old = this.active?.owner === owner ? this.active : undefined
    const extending = old?.kind === 'uses' || old?.adopted
    const id = old?.id ?? `craft_${crypto.randomUUID()}`
    const revision = old ? old.revision + 1 : 1
    const typeId = extending ? old!.item!.typeId : inventionId(result.design!, id.replaceAll('-', '_'))
    const base = extending ? workshopPackages(owner.engine).find(p => p.id === id && p.enabled) : undefined
    if (extending) plan = appendWorkshopPlan(base?.plan, plan)
    this.active = { owner, id, revision, title: extending ? old!.title : result.design!.name, kind: extending ? 'uses' : 'item',
      item: { id, revision, typeId, plan, ...(extending && { appendFrom: base?.revision ?? 0, dependsOn: base?.dependsOn, origin: base?.origin }), ...(!extending && result.design && { design: result.design }) } }
    this.publish()
  }
  picture(design: ResearchDesign): void {
    if (this.active?.item?.design && this.active.owner === this.o.current() && !this.active.adopted) {
      this.active.item.design = design; this.active.revision++; this.active.item.revision = this.active.revision; this.active.itemTrial = undefined; this.publish()
    }
  }
  private view(d: Draft): WorkshopView {
    const descriptors = researchCapabilities()
    const report = d.itemTrial
    const uses = (d.item?.plan.uses ?? []).map(u => {
      const cap = descriptors.find(c => c.id === u.capability), found = report?.uses.find(r => r.id === u.id)
      let effect = cap?.description
      if (u.capability === 'throw-coat' && cap) {
        const value = (key: string) => u.params?.[key] ?? cap.params[key]?.default
        const substance = String(value('substance')), seconds = Number(value('duration')) / 10, range = Number(value('range')), power = Number(value('power'))
        const name = ({ wet: '湿润', oiled: '油污', sticky: '黏稠减速' } as Record<string, string>)[substance] ?? substance
        effect = L(`One item · ${substance} for ${seconds}s · range ${range} tiles${power ? ` · impact ${power}` : ' · no impact damage'}`, `使用一件 · ${name} ${seconds}秒 · 最远${range}格${power ? ` · 冲击力${power}` : ' · 无冲击伤害'}`)
      }
      if (u.capability === 'channel' && cap) {
        const value = (key: string) => u.params?.[key] ?? cap.params[key]?.default
        const element = String(value('element')), cost = Number(value('cost')), cooldown = Number(value('cooldown')) / 10, range = Number(value('range')), variant = Number(value('variantChance'))
        const name = ({ fire: '御火', wind: '御气', water: '御水', earth: '御土' } as Record<string, string>)[element] ?? element
        const other = ({ fire: '御雷', water: '御冰' } as Record<string, string>)[element]
        const branchEn = other && variant > 0 ? ` · ${Math.round(variant * 100)}% ${element === 'fire' ? 'lightning' : 'ice'}` : ''
        const branchZh = other && variant > 0 ? ` · ${Math.round(variant * 100)}%${other}` : ''
        effect = L(`${element} · fullness ${cost} · range ${range} tiles · shared cooldown ${cooldown}s${branchEn}`, `${name} · 消耗饱食${cost} · 最远${range}格 · 元素共用冷却${cooldown}秒${branchZh}`)
      }
      if (u.capability === 'empower' && cap) {
        const value = (key: string) => Number(u.params?.[key] ?? cap.params[key]?.default)
        effect = L(`Four-element channeling for ${value('duration') / 10}s · fullness ${value('cost')} · cooldown ${value('cooldown') / 10}s`, `四元素同时施放${value('duration') / 10}秒 · 消耗饱食${value('cost')} · 冷却${value('cooldown') / 10}秒`)
      }
      return { id: u.id, label: u.label, target: L(u.target, ({ self: '自己', person: '居民', creature: '生物', item: '物品', ground: '地面' } as Record<string, string>)[u.target] ?? u.target), targetId: u.target,
        capability: u.capability, status: found ? found.ok ? 'tested' as const : 'failed' as const : 'ready' as const, effect, ...(u.params && { params: { ...u.params } }) }
    })
    const pending = (d.item?.plan.pending ?? []).map((p, i) => ({ id: `pending_${i}`, label: p.idea, target: L('To research', '继续研究'), status: 'pending' as const, effect: p.reason }))
    const checks = report?.uses.map(r => ({ id: r.id, label: uses.find(u => u.id === r.id)?.label ?? r.id, passed: r.ok,
      observed: r.ok ? this.observed(r.observed) : L(r.errors.join('; '), r.errors.join('；')) }))
    const definition = d.item?.design?.kind === 'new' ? d.item.design.type : undefined
    const art = definition?.art ?? (d.item?.design?.kind !== 'new' ? d.item?.design?.art : undefined) ?? (d.item && d.owner.engine.world.onto.data.types[d.item.typeId]?.art)
    return { id: d.id, revision: d.revision, kind: d.kind, title: d.title, typeId: d.item?.typeId, adopted: d.adopted, uses: [...uses, ...pending],
      ...(art && { picture: art }),
      ...(report && { trial: { revision: d.revision, passed: report.ok, checks: [...(checks ?? []), ...report.errors.map((s, i) => ({ id: `error_${i}`, label: L('Trial', '试验'), passed: false, observed: L(s, s) }))] } }),
      ...(d.map && { map: { width: d.map.raw.map.width, height: d.map.raw.map.height, rows: d.map.raw.map.rows }, uses: [{ id: 'navigation', label: L('Explore and return', '探索并返回'), target: L('This region', '这个区域'), status: d.mapTrial ? d.mapTrial.ok ? 'tested' : 'failed' : 'ready' }] }),
      ...(d.mapTrial && { trial: { revision: d.revision, passed: d.mapTrial.ok, checks: [...d.mapTrial.checks.map(c => ({ id: c.id, label: L('Region trial', '区域试验'), passed: c.ok, observed: L(c.observed, c.observed) })), ...d.mapTrial.errors.map((s, i) => ({ id: `error_${i}`, label: L('Region trial', '区域试验'), passed: false, observed: L(s, s) }))] } }),
    }
  }
  private observed(values: Record<string, unknown>): Text {
    const names: Record<string, string> = { hunger: '饱食', hp: '生命', food: '营养', moveDelay: '行动间隔', defense: '防护', sourceExists: '原物品' }
    const before = values.before as Record<string, unknown> | undefined, after = values.after as Record<string, unknown> | undefined
    const en: string[] = [], zh: string[] = []
    if (before && after) {
      for (const key of Object.keys(names)) if (before[key] !== after[key] && (typeof before[key] !== 'object' && typeof after[key] !== 'object')) {
        if (key === 'sourceExists' && !after[key]) { en.push('One source item used'); zh.push('已使用一个原物品') }
        else { en.push(`${key}: ${String(before[key] ?? '—')} → ${String(after[key] ?? '—')}`); zh.push(`${names[key]}：${String(before[key] ?? '—')} → ${String(after[key] ?? '—')}`) }
      }
      if (before.holder !== after.holder && after.holder === after.targetId) { en.push('Given to the recipient'); zh.push('已交给对方') }
      if (!before.worn && after.worn) { en.push('Equipped'); zh.push('已穿戴') }
      if (!before.inspected && after.inspected) { en.push('Examined and remembered'); zh.push('已查看并记下') }
      const added = (after.statuses as string[] | undefined)?.filter(s => !(before.statuses as string[] | undefined)?.includes(s)) ?? []
      if (added.length) { en.push(`Coating applied (${added.length})`); zh.push(`涂层已生效（${added.length}）`) }
      const a = before.targetProps as Record<string, unknown> | undefined, b = after.targetProps as Record<string, unknown> | undefined
      if (a && b && a.regard !== b.regard) { en.push(`Regard: ${a.regard ?? 0} → ${b.regard ?? 0}`); zh.push(`好感：${a.regard ?? 0} → ${b.regard ?? 0}`) }
    }
    return { en: en.join(' · ') || 'The action changed the expected state.', zh: zh.join(' · ') || '实际操作产生了预期变化。' }
  }
  publish(): void { if (this.active && this.active.owner === this.o.current()) this.o.post({ t: 'workshop', view: this.view(this.active) }) }
  trial(id: string, revision: number): void {
    const d = this.checked(id, revision)
    if (d.item) d.itemTrial = trialWorkshopPackage(d.owner.engine, d.item, this.o.recipes())
    if (d.map) d.mapTrial = trialCreationMap(d.owner.engine, d.map, this.o.chars())
    this.publish()
  }
  adopt(id: string, revision: number): void {
    const d = this.checked(id, revision), eng = d.owner.engine
    if (d.adopted) throw new Error('This revision has already been adopted')
    if (d.item) {
      if (!d.itemTrial?.ok) throw new Error('Try this design successfully before adopting it')
      const result = registerWorkshopPackage(eng, d.item, d.itemTrial, this.o.recipes())
      if (!result.ok) throw new Error(result.errors.join('; '))
      ;((eng.world.state as EvidenceState).workshopEvidence ??= {})[`${d.id}:${d.revision}`] = structuredClone(d.itemTrial)
      this.o.kept(d.item.typeId)
    }
    if (d.map) {
      if (!d.mapTrial?.ok) throw new Error('Try this region before adopting it')
      const map = adoptCreationMap(eng, d.map, d.mapTrial, this.o.chars())
      if (d.map.appendFrom === undefined) eng.author(() => eng.teleport(eng.world.player, { map: map.raw.map.id, x: map.entry[0], y: map.entry[1] }))
    }
    d.adopted = true
    this.o.changed(); this.publish(); this.list()
  }
  private checked(id: string, revision: number): Draft {
    const d = this.active
    if (!d || d.owner !== this.o.current() || d.id !== id || d.revision !== revision) throw new Error('This design has changed; open its current version')
    return d
  }
  private ofPackage(owner: Game, p: WorkshopPackage, editing = false): Draft {
    const evidence = (owner.engine.world.state as EvidenceState).workshopEvidence?.[`${p.id}:${p.revision}`]
    return { owner, id: p.id, revision: p.revision + (editing ? 1 : 0), kind: 'uses', title: owner.engine.world.onto.resolve(p.typeId).name ?? p.typeId,
      item: { id: p.id, revision: p.revision + (editing ? 1 : 0), typeId: p.typeId, plan: structuredClone(p.plan), dependsOn: p.dependsOn }, ...(editing ? {} : { itemTrial: evidence, adopted: true }) }
  }
  list(): void {
    const owner = this.o.current(); if (!owner) return
    const items = workshopPackages(owner.engine).filter(p => p.enabled).map(p => this.view(this.ofPackage(owner, p)))
    const records = creationMaps(owner.engine).filter(p => p.enabled)
    const maps = records.filter(p => p.revision === Math.max(...records.filter(r => r.id === p.id).map(r => r.revision))).map(p => this.view({ owner, ...p, title: p.raw.map.name, kind: 'map', map: p, adopted: true }))
    this.o.post({ t: 'workshopSaved', views: [...items, ...maps] })
  }
  open(id: string): void {
    const owner = this.o.current(); if (!owner) return
    const pack = workshopPackages(owner.engine).find(p => p.id === id && p.enabled)
    if (pack) { this.active = this.ofPackage(owner, pack); this.kind = 'item'; this.publish(); return }
    const map = creationMaps(owner.engine).filter(p => p.id === id && p.enabled).sort((a, b) => b.revision - a.revision)[0]
    if (map) { this.active = { owner, id, revision: map.revision, kind: 'map', title: map.raw.map.name, map, mapTrial: trialCreationMap(owner.engine, map, this.o.chars()), adopted: true }; this.kind = 'map'; this.publish() }
  }
  enter(id: string): boolean {
    const owner = this.o.current(); if (!owner) return false
    const map = creationMaps(owner.engine).filter(p => p.id === id && p.enabled).sort((a, b) => b.revision - a.revision)[0]
    if (!map) return false
    owner.engine.author(() => owner.engine.teleport(owner.engine.world.player, { map: map.raw.map.id, x: map.entry[0], y: map.entry[1] }))
    return true
  }
  extendHeld(): void {
    const owner = this.o.current(); if (!owner) return
    const w = owner.engine.world, held = w.get(w.player.held)
    if (!held) throw new Error('Hold the thing you want to give a new use')
    const existing = workshopPackages(owner.engine).find(p => p.typeId === held.type && p.enabled)
    if (existing) return this.open(existing.id)
    const id = `craft_${crypto.randomUUID()}`, plan: ResearchPlan = { version: 1, uses: [] }
    this.active = { owner, id, revision: 1, kind: 'uses', title: held.name ?? w.onto.resolve(held.type).name ?? held.type, item: { id, revision: 1, typeId: held.type, plan } }
    this.kind = 'item'; this.publish()
  }
  export(id: string): void {
    const owner = this.o.current(); if (!owner) return
    const map = creationMaps(owner.engine).filter(p => p.id === id && p.enabled).sort((a, b) => b.revision - a.revision)[0]
    const file = map ? { format: 'openworld-creation', schema: 1, manifest: { id, revision: map.revision, kind: 'map' }, raw: map.raw } : exportWorkshopPackage(owner.engine, id)
    this.o.post({ t: 'workshopExport', name: `${id}.json`, file })
  }
  import(file: unknown): void {
    const owner = this.o.current(); if (!owner) return
    if (file && typeof file === 'object' && (file as { manifest?: { kind?: unknown } }).manifest?.kind === 'map') {
      const data = file as { format?: unknown; schema?: unknown; raw?: unknown; manifest?: { id?: unknown; revision?: unknown; kind?: unknown } }
      if (data.format !== 'openworld-creation' || data.schema !== 1 || !data.manifest || typeof data.manifest.id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(data.manifest.id)) throw new Error('Invalid region package')
      if (Object.keys(data).some(k => !['format', 'schema', 'manifest', 'raw'].includes(k)) || Object.keys(data.manifest).some(k => !['id', 'revision', 'kind'].includes(k))) throw new Error('Unknown region package fields')
      const taken = new Set(creationMaps(owner.engine).map(p => p.id)); let id = `import_${data.manifest.id}`.slice(0, 58), n = 1
      while (taken.has(id)) id = `import_${data.manifest.id}`.slice(0, 54) + `_${n++}`
      const draft: CreationMapDraft = { id, revision: 1, raw: structuredClone(data.raw) as RawChunk }
      const report = trialCreationMap(owner.engine, draft, this.o.chars())
      if (!report.ok) throw new Error(report.errors.join('; '))
      this.active = { owner, id, revision: 1, title: draft.raw.map.name, kind: 'map', map: draft }
      this.kind = 'map'
    } else {
      const item = prepareWorkshopImport(owner.engine, file, this.o.recipes())
      this.active = { owner, id: item.id, revision: item.revision, title: item.design?.name ?? owner.engine.world.onto.resolve(item.typeId).name ?? item.typeId, kind: item.design ? 'item' : 'uses', item }
      this.kind = 'item'
    }
    this.publish()
  }
  disable(id: string): void {
    const owner = this.o.current(); if (!owner) return
    const eng = owner.engine
    if (creationMaps(eng).some(p => p.id === id && p.enabled)) disableCreationMap(eng, id)
    else {
      const pack = workshopPackages(eng).find(p => p.id === id)
      if (pack && creationMaps(eng).some(r => r.enabled && r.raw.entities.some(e => e.type === pack.typeId))) throw new Error('A created region still uses this design')
      const result = disableWorkshopPackage(eng, id)
      if (!result.ok) throw new Error(result.errors.join('; '))
    }
    if (this.active?.id === id) this.active = undefined
    this.o.changed(); this.list()
  }
  async map(message: string): Promise<void> {
    const owner = this.o.current(), link = this.o.link(); if (!owner || !link?.draft) throw new Error('Connect a model to sketch a region')
    const old = this.active?.owner === owner && this.active.kind === 'map' ? this.active : undefined
    const onto = owner.engine.world.onto, chars = this.o.chars()
    const palette = Object.entries(chars).filter(([, terrain]) => onto.data.terrains?.[terrain] && !terrain.startsWith('ow_')).map(([char, terrain]) => ({ char, terrain, name: terrain }))
    const things = mapThings(owner, message)
    const reply = await link.draft({ kind: 'map', intent: message, context: { chars: palette, things, maxSize: [24, 20], taken: Object.keys(owner.engine.maps), lang: 'en',
      environment: { palette: ['verdant'], water: ['stream'], fireflies: 'boolean' },
      activities: { garden: 'Use real fixture/crop/<species>/ripe for harvest, item/seed/<species>, hoe, water bucket or well and an empty farmland plot for sowing. Water each stage before it grows; decorative plants are not crops.', crossing: 'Use B/bridge across water. Both banks and every placed object must be reachable from entry. Place waterfall fixtures on water and pavilion fixtures on clear land.' },
    }, ...(old?.map && { previous: old.map.raw, feedback: message }) })
    if (owner !== this.o.current()) return
    if (!reply.draft) throw new Error(reply.diagnostics.join('; ') || 'The region was not drafted')
    const id = old?.id ?? `map_${crypto.randomUUID()}`, revision = old ? old.revision + 1 : 1
    const raw = reply.draft as unknown as RawChunk
    this.active = { owner, id, revision, kind: 'map', title: raw.map?.name ?? L('A new region', '新区域'), map: { id, revision, raw } }
    this.publish()
  }
}
