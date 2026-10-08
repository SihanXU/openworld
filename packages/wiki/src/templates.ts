// The templates (wiki/pages/帮助/格式手册.md lists them all). Every data template reads the game model:
// a table here is the game's own numbers, never a copy that can go stale.

import { gearProps, type Entity, type QuestDef, type Text } from '@lsw/engine'
import {
  EFFICIENCY, ELEMENT_NAMES, ELEMENTS, LEGENDARY_ARMS, MATERIALS, QUALITIES, RELICS, VOW_TRAITS, isAccessory, zh,
  type BossEnt, type CreatureEnt, type Ent, type Game, type ItemEnt, type MapEnt, type PersonEnt, type QuestEnt, type Sprite,
} from './game.ts'
import { escapeAttr, escapeHtml, type TemplateCall } from './markup.ts'

export interface Translations { [section: string]: Record<string, string> }

export interface PageRef {
  title: string
  type: string
  ent?: Ent
  dir?: string
  navboxes: Set<string>
  summary?: string
  stub: boolean
}

export interface Ctx {
  g: Game
  tr: Translations
  page: PageRef
  pages: Map<string, PageRef>
  link(target: string, text?: string): string
  inline(md: string): string
  error(msg: string): void
  missing(section: string, key: string): void
  history: { date: string; pr: string; title: string; branch: string }[]
  values(): string
  portal(): string
  include(path: string): string
}

// ------------------------------------------------------------------------------------------ helpers

export const esc = escapeHtml
const T = (ctx: Ctx, section: string, key: string): string => {
  const v = ctx.tr[section]?.[key]
  if (v == null) { ctx.missing(section, key); return key }
  return v
}

/** A sprite, scaled, as a CSS-cropped span. */
export function spr(s: Sprite | undefined, scale = 2, cls = ''): string {
  if (!s) return ''
  const k = scale
  return `<span class="spr ${cls}" style="width:${s.w * k}px;height:${s.h * k}px;background-image:url('${s.url}');background-position:-${s.x * k}px -${s.y * k}px;background-size:${s.iw * k}px ${s.ih * k}px"></span>`
}
/** Fit a sprite into a box of `box` pixels (whole multiples where possible). */
export function fit(s: Sprite | undefined, box: number, cls = ''): string {
  if (!s) return ''
  const k = Math.max(0.5, Math.min(8, Math.floor((box / Math.max(s.w, s.h)) * 2) / 2))
  return spr(s, k, cls)
}

function table(head: string[], rows: string[][], cls = 'wikitable'): string {
  if (!rows.length) return `<p class="empty">（无）</p>`
  return `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

const secs = (ticks: number) => `${+(ticks / 10).toFixed(1)} 秒`
const join = (xs: string[], sep = '、') => xs.filter(Boolean).join(sep) || '—'

export function entLink(ctx: Ctx, e: Ent | undefined, opts: { icon?: number; count?: number; text?: string } = {}): string {
  if (!e) return ''
  const icon = opts.icon === 0 ? '' : fit(e.sprite, opts.icon ?? 20, 'inline')
  const count = opts.count && opts.count > 1 ? `<span class="count">×${opts.count}</span>` : ''
  return `<span class="ent">${icon}${ctx.link(e.title, opts.text ?? e.zh)}${count}</span>`
}
export function typeLink(ctx: Ctx, type: string, opts: { icon?: number; count?: number } = {}): string {
  const e = ctx.g.byId.get(type) ?? ctx.g.entOfType(type)
  if (e && (e.id === type || type.startsWith(e.id + '/'))) return entLink(ctx, e, opts)
  const name = ctx.g.typeName(type)
  return `<span class="ent">${esc(name)}${opts.count && opts.count > 1 ? `<span class="count">×${opts.count}</span>` : ''}</span>`
}
const mapLink = (ctx: Ctx, id?: string) => (id ? (ctx.g.mapOf(id) ? entLink(ctx, ctx.g.mapOf(id), { icon: 0 }) : esc(id)) : '—')
const personLink = (ctx: Ctx, id?: string) => entLink(ctx, ctx.g.byId.get(id ?? '')) || esc(id ?? '')

/** The entity a name or an id points to (for {{物品|…}} and friends). */
function find(ctx: Ctx, key: string, kinds: string[]): Ent | undefined {
  const k = key.trim()
  const byId = ctx.g.byId.get(k)
  if (byId && kinds.includes(byId.kind)) return byId
  const t = ctx.g.byTitle.get(k)
  if (t && kinds.includes(t.kind)) return t
  const named = (ctx.g.byName.get(k) ?? []).find((e) => kinds.includes(e.kind))
  if (named || !kinds.includes('item')) return named
  // a made thing's name as the game composes it: quality + material + form (精良铁剑, 木棍棒, 石斧)
  const prefixes = [...QUALITIES.map((q) => q.zh).filter(Boolean), ...Object.values(MATERIALS).map((m) => m.zh)].sort((a, b) => b.length - a.length)
  let rest = k
  for (let i = 0; i < 3; i++) {
    const p = prefixes.find((x) => rest.startsWith(x) && rest.length > x.length)
    if (!p) break
    rest = rest.slice(p.length)
    const hit = (ctx.g.byName.get(rest) ?? []).find((e) => kinds.includes(e.kind))
    if (hit) return hit
  }
  return undefined
}

// ------------------------------------------------------------------------------------------ reverse indices

interface Indices {
  /** type → what leaves it when broken or felled (makeup), with counts */
  madeFrom: Map<string, { src: string; count: number }[]>
  reward: Map<string, QuestEnt[]>
  ingredient: Map<string, string[]>
  tool: Map<string, string[]>
  questNeeds: Map<string, QuestEnt[]>
  appearOn: Map<string, { map: string; max: number; every: number; night?: boolean }[]>
  carried: Map<string, { who: string; count: number }[]>
  yields: Map<string, string[]>
  given: Map<string, { person: PersonEnt; text: string }[]>
  personQuests: Map<string, QuestEnt[]>
  mapPeople: Map<string, Set<string>>
}
let IDX: Indices | undefined
let IDX_FOR: Game | undefined

function idx(g: Game): Indices {
  if (IDX && IDX_FOR === g) return IDX
  const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { if (!m.has(k)) m.set(k, []); m.get(k)!.push(v) }
  const madeFrom = new Map<string, { src: string; count: number }[]>()
  for (const t of Object.values(g.types)) for (const p of t.makeup ?? []) push(madeFrom, p.type, { src: t.id, count: p.count })
  for (const t of g.terrains) for (const p of t.makeup ?? []) push(madeFrom, p.type, { src: `tile/${t.id}`, count: p.count })
  const reward = new Map<string, QuestEnt[]>()
  const questNeeds = new Map<string, QuestEnt[]>()
  const personQuests = new Map<string, QuestEnt[]>()
  for (const q of g.quests) {
    for (const it of q.def.reward?.items ?? []) push(reward, it.type, q)
    for (const goal of q.def.goals) if (goal.kind === 'carry') push(questNeeds, goal.type, q)
    const who = new Set([q.def.giver, q.def.turnIn, ...q.def.goals.map((x) => (x.kind === 'talk' ? x.npc : undefined))].filter(Boolean) as string[])
    for (const w of who) push(personQuests, w, q)
  }
  const ingredient = new Map<string, string[]>()
  const tool = new Map<string, string[]>()
  for (const r of g.recipes) {
    for (const n of r.needs) push(ingredient, n.type, `recipe:${r.id}`)
    for (const t of r.tools ?? []) push(tool, t, `recipe:${r.id}`)
  }
  for (const p of g.placements) for (const n of p.needs) {
    if (n.match.type) push(ingredient, n.match.type, `placement:${p.id}`)
    for (const t of n.match.tags ?? []) push(tool, t, `placement:${p.id}`)
  }
  const appearOn = new Map<string, { map: string; max: number; every: number; night?: boolean }[]>()
  for (const m of g.maps) for (const a of m.map.appear ?? []) for (const t of Object.keys(a.types ?? {})) push(appearOn, t, { map: m.id, max: a.max, every: a.every, night: a.night })
  const carried = new Map<string, { who: string; count: number }[]>()
  const all: Entity[] = [...g.index.npcs, ...g.chunks.flatMap((c) => c.entities)]
  const byId = new Map(all.map((e) => [e.id, e]))
  for (const e of all) if ((e.place.on === 'inside' || e.place.on === 'hand') && byId.has(e.place.holder)) {
    const h = byId.get(e.place.holder)!
    if (h.type.startsWith('actor/')) push(carried, e.type, { who: h.id.startsWith('npc.') ? h.id : h.type, count: Number(e.props?.count ?? 1) || 1 })
  }
  const yields = new Map<string, string[]>()
  for (const t of Object.values(g.types)) {
    for (const y of (t.stage as any)?.yields ?? []) push(yields, y.type, t.id)
    const yt = t.props?.yieldType
    if (typeof yt === 'string' && t.id.split('/').length === 3) push(yields, yt, t.id)
  }
  const given = new Map<string, { person: PersonEnt; text: string }[]>()
  for (const p of g.people) for (const l of p.def?.lines ?? []) if (l.key.startsWith('given:')) push(given, l.key.slice(6), { person: p, text: zh(l.text) })
  const mapPeople = new Map<string, Set<string>>()
  for (const p of g.people) {
    const maps = new Set<string>()
    if (p.home) maps.add(p.home)
    for (const slots of Object.values(p.def?.schedules ?? {})) for (const s of slots) maps.add(s[2].split(':')[0])
    for (const m of maps) { if (!mapPeople.has(m)) mapPeople.set(m, new Set()); mapPeople.get(m)!.add(p.id) }
  }
  IDX = { madeFrom, reward, ingredient, tool, questNeeds, appearOn, carried, yields, given, personQuests, mapPeople }
  IDX_FOR = g
  return IDX
}

const matchesPrefix = (type: string, prefix: string) => type === prefix || type.startsWith(prefix + '/')

// ------------------------------------------------------------------------------------------ item facts

function itemStats(ctx: Ctx, e: ItemEnt): [string, string][] {
  const p = e.props
  const rows: [string, string][] = []
  if (typeof p.power === 'number') rows.push(['攻击', String(p.power)])
  if (typeof p.range === 'number') rows.push(['射程', `${p.range} 格`])
  if (typeof p.def === 'number') rows.push(['防御', String(p.def)])
  if (typeof p.atk === 'number' && p.slot) rows.push(['攻击加成', `+${p.atk}`])
  if (p.slot) rows.push(['穿戴部位', T(ctx, '装备栏', String(p.slot))])
  if (typeof p.food === 'number') rows.push(['饱食度', `+${p.food}`])
  if (typeof p.heal === 'number' && (e.tags.includes('drink') || e.tags.includes('medicinal') || e.id.startsWith('item/potion'))) rows.push(['生命', `+${p.heal + 1}`])
  if (typeof p.capacity === 'number') rows.push(['容量', `${p.capacity} 格`])
  if (typeof p.maxHp === 'number') rows.push(['耐久', String(p.maxHp)])
  if (typeof p.critChance === 'number') rows.push(['暴击率', `+${Math.round(p.critChance * 100)}%`])
  if (typeof p.lifesteal === 'number') rows.push(['吸血', String(p.lifesteal)])
  if (typeof p.xpRate === 'number') rows.push(['经验', `${p.xpRate > 0 ? '+' : ''}${Math.round(p.xpRate * 100)}%`])
  if (typeof p.handsRange === 'number') rows.push(['交互距离', p.handsRange === 0 ? '站在上面' : `${p.handsRange} 格`])
  if (p.element) rows.push(['元素', T(ctx, '元素', String(p.element))])
  const prof = e.tags.find((t) => t.startsWith('profession:'))?.slice(11)
  if (prof) rows.push(['职业', ctx.link(ctx.g.professions.find((x) => x.id === prof)?.name.zh ?? prof)])
  const tools = e.tags.filter((t) => t.startsWith('tool:')).map((t) => t.slice(5))
  if (tools.length) rows.push(['工具能力', tools.map((t) => ({ axe: '斧', pickaxe: '镐', shovel: '铲', hammer: '锤', hoe: '锄', sickle: '镰' } as Record<string, string>)[t] ?? t).join('、')])
  if (e.form?.materials?.length) rows.push(['可能的材质', e.form.materials.map((m) => MATERIALS[m]?.zh ?? m).join('、')])
  if (e.form?.elemental) rows.push(['可带元素', '是'])
  return rows
}

function qualityName(id?: string): string {
  return QUALITIES.find((q) => q.id === id)?.zh ?? ''
}

// ------------------------------------------------------------------------------------------ infoboxes

function infobox(ctx: Ctx, title: string, image: string, rows: [string, string][], caption = ''): string {
  return `<aside class="infobox"><div class="ib-title">${esc(title)}</div>${image ? `<div class="ib-image">${image}</div>` : ''}${caption ? `<div class="ib-caption">${caption}</div>` : ''}<table class="ib">${rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table></aside>`
}

function itemInfobox(ctx: Ctx, e: ItemEnt): string {
  const rows: [string, string][] = [['类别', ctx.link(groupPage(e), e.group)], ...itemStats(ctx, e)]
  if (e.quality) rows.push(['品质', ctx.link('品质', qualityName(e.quality))])
  if (e.relic) rows.push(['圣痕之力', `<b>${esc(e.relic.zh)}</b>：${esc(e.relic.text)}`])
  const make = e.recipe ? `${e.recipe.station === 'hands' || !e.recipe.station ? '手工' : '工作台旁'}（${ctx.link('制作')}）` : e.placement ? ctx.link('建造', '建造模式') : ''
  if (make) rows.push(['制作', make])
  if (e.makeup.length) rows.push(['构成', e.makeup.map((m) => typeLink(ctx, m.type, { count: m.count })).join(' ')])
  rows.push(['英文名', esc(e.en)])
  rows.push(['编号', `<code>${esc(e.id)}</code>`])
  return infobox(ctx, e.zh, fit(e.sprite, 64), rows)
}

function personInfobox(ctx: Ctx, p: PersonEnt): string {
  const d = p.def
  const rows: [string, string][] = [
    ['身份', esc(p.roleZh)],
    ['年龄', p.age ? `${p.age} 岁` : ''],
    ['住在', p.home ? mapLink(ctx, p.home) : p.kind === 'companion' ? '跟着玩家' : '只在剧情中出场'],
  ]
  if (d) rows.push(['性格', Object.values(d.temperament).map((v) => esc(T(ctx, '性格', v))).join('、')])
  const qs = idx(ctx.g).personQuests.get(p.id) ?? []
  if (qs.length) rows.push(['任务', qs.map((q) => entLink(ctx, q, { icon: 0 })).join('<br>')])
  rows.push(['英文名', esc(p.en)])
  rows.push(['编号', `<code>${esc(p.id)}</code>`])
  return infobox(ctx, p.zh, fit(p.face, 96, 'face'), rows)
}

function creatureInfobox(ctx: Ctx, c: CreatureEnt): string {
  const p = c.props
  const rows: [string, string][] = [
    ['类别', esc(c.group)],
    ['生命', String(p.maxHp ?? p.hp ?? '—')],
    ['攻击', String(p.atk ?? '—')],
    ['防御', String(p.def ?? 0)],
    ['速度', p.speed ? `每 ${p.speed} tick 走一格` : ''],
    ['元素', p.element ? T(ctx, '元素', String(p.element)) : '无'],
    ['飞行', p.stance === 'air' ? '是（不碰地面）' : ''],
    ['射程', typeof p.range === 'number' ? `${p.range} 格` : ''],
    ['经验', String(p.maxHp ?? p.hp ?? '—')],
    ['出没', join(whereCreature(ctx, c.id).map((w) => mapLink(ctx, w)))],
    ['掉落', c.makeup.length ? c.makeup.map((m) => typeLink(ctx, m.type, { count: Math.floor(m.count * ctx.g.ontology.params!.recovery!) || 1 })).join(' ') : '无'],
    ['英文名', esc(c.en)],
    ['编号', `<code>${esc(c.id)}</code>`],
  ]
  return infobox(ctx, c.zh, fit(c.sprite, 96), rows)
}

function bossInfobox(ctx: Ctx, b: BossEnt): string {
  const d = b.def
  const camp = campaign(ctx, b)
  const rows: [string, string][] = [
    ['印', b.seal ? esc(b.seal) : ''],
    ['生命', camp ? `战役 ${camp.hp} · 挑战 ${d.hp}` : `${d.hp}（首领挑战）`],
    ['护甲', camp ? `战役 ${camp.def} · 挑战 ${d.defense}` : String(d.defense)],
    ['占地', `${d.footprint[0]} × ${d.footprint[1]} 格`],
    ['视野', `${d.sight} 格`],
    ['第二阶段', `生命低于 ${Math.round(d.enrageAt * 100)}%`],
    ['技能', d.skills.map((s) => esc(zh(s.name))).join('<br>')],
    ['出没', camp ? mapLink(ctx, camp.map) : ctx.link('首领挑战')],
    ['英文名', esc(b.en)],
    ['编号', `<code>${esc(d.id)}</code>`],
  ]
  return infobox(ctx, b.zh, fit(b.sprite, 160), rows)
}

function campaign(ctx: Ctx, b: BossEnt): { map: string; hp: number; def: number } | undefined {
  for (const m of ctx.g.maps) for (const e of m.entities) if (e.type === `actor/creature/sin/${b.id}`) return { map: m.id, hp: Number(e.props?.maxHp ?? e.props?.hp), def: Number(e.props?.def ?? b.def.defense) }
  return undefined
}

function mapInfobox(ctx: Ctx, m: MapEnt): string {
  const map = m.map
  const links = [...new Set((map.portals ?? []).map((p: any) => p.to))] as string[]
  const wps = ctx.g.waypoints.filter((w) => w.map === m.id)
  const rows: [string, string][] = [
    ['类型', esc(T(ctx, '地图类型', String(map.kind)))],
    ['大小', `${map.width} × ${map.height} 格`],
    ['区域', map.zone ? ctx.link('和平区域与战斗区域', T(ctx, '区域', map.zone)) : ctx.link('和平区域与战斗区域', '战斗区域')],
    ['光照', map.light ? esc(T(ctx, '光照', map.light)) : '室外（随昼夜变化）'],
    ['音乐', map.music ? esc(T(ctx, '音乐', String(map.music).toLowerCase())) : '—'],
    ['传送雕像', wps.length ? wps.map((w) => esc(zh(w.name))).join('、') : '无'],
    ['相连', join(links.map((l) => mapLink(ctx, l)))],
    ['英文名', esc(m.en)],
    ['编号', `<code>${esc(m.id)}</code>`],
  ]
  return infobox(ctx, m.zh, `<img class="map-thumb" src="/wiki/_/maps/${m.id}.png" alt="${escapeAttr(m.zh)}的地形图">`, rows)
}

function questInfobox(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  const req = d.requires ?? {}
  const reqs = [
    ...(req.quests ?? []).map((id) => entLink(ctx, ctx.g.byId.get(id), { icon: 0 })),
    req.level ? `等级 ${req.level}` : '',
    ...Object.keys(req.facts ?? {}).map((f) => esc(T(ctx, '条件', `fact:${f}`))),
  ].filter(Boolean)
  const rows: [string, string][] = [
    ['类型', ctx.link('任务', ({ main: '主线', side: '支线', repeat: '重复' } as Record<string, string>)[d.kind] ?? d.kind)],
    ['委托人', personLink(ctx, d.giver)],
    ['交付给', d.turnIn ? personLink(ctx, d.turnIn) : d.self ? '自动完成' : personLink(ctx, d.giver)],
    ['接取', d.auto ? '自动接取' : `找${personLink(ctx, d.giver)}（{{键|E}}）`.replace('{{键|E}}', '<kbd>E</kbd>')],
    ['前置', join(reqs)],
    ['经验', d.reward?.xp ? `+${d.reward.xp}` : '—'],
    ['奖励', join((d.reward?.items ?? []).map((it) => rewardItem(ctx, it)), '<br>')],
    ['英文名', esc(q.en)],
    ['编号', `<code>${esc(d.id)}</code>`],
  ]
  return infobox(ctx, q.zh, '', rows)
}

function rewardItem(ctx: Ctx, it: NonNullable<QuestDef['reward']>['items'] extends (infer X)[] | undefined ? X : never): string {
  const base = typeLink(ctx, it.type, { count: it.count })
  if (!it.name) return base
  const q = it.tags?.find((t) => t.startsWith('quality:'))?.slice(8)
  const stats = Object.entries(it.props ?? {}).filter(([k]) => k !== 'slot').map(([k, v]) => `${T(ctx, '属性', k)} ${v}`).join('，')
  return `<b>${esc(zh(it.name))}</b>${q ? `（${esc(qualityName(q))}）` : ''}：${base}${stats ? `，${esc(stats)}` : ''}`
}

const groupPage = (e: ItemEnt): string => {
  if (e.kind === 'structure') return '建筑件'
  if (e.kind === 'fixture') return '家具与设施'
  if (e.group === '护甲' || e.group === '衣物') return isAccessory(e) ? '饰品' : '防具'
  return ({ 武器: '武器', 工具: '工具', 食物: '食物', 材料: '材料', 种子: '种子', 圣物: '剧情物品', 文书: '文书', 照明: '工具', 容器: '工具' } as Record<string, string>)[e.group] ?? '物品'
}

// ------------------------------------------------------------------------------------------ entity sections

function whereCreature(ctx: Ctx, type: string): string[] {
  const maps = new Set<string>()
  for (const [m] of ctx.g.placed.get(type) ?? []) maps.add(m)
  for (const a of idx(ctx.g).appearOn.get(type) ?? []) maps.add(a.map)
  return [...maps].filter((m) => ctx.g.mapOf(m))
}

function sources(ctx: Ctx, e: ItemEnt): string {
  const I = idx(ctx.g)
  const out: string[] = []
  const placed = [...(ctx.g.placed.get(e.id) ?? [])].filter(([m]) => ctx.g.mapOf(m))
  if (placed.length) out.push(`<li>放在地图上：${placed.map(([m, n]) => `${mapLink(ctx, m)}${n > 1 ? ` ×${n}` : ''}`).join('、')}</li>`)
  const carried = I.carried.get(e.id) ?? []
  if (carried.length) out.push(`<li>有人带着：${[...new Set(carried.map((c) => c.who))].map((w) => (w.startsWith('npc.') ? personLink(ctx, w) : typeLink(ctx, w))).join('、')}</li>`)
  if (e.recipe) out.push(`<li>${ctx.link('制作')}：${e.recipe.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' + ')}${e.recipe.count && e.recipe.count > 1 ? ` → ×${e.recipe.count}` : ''}</li>`)
  if (e.placement) out.push(`<li>${ctx.link('建造', '建造模式')}：${e.placement.needs.map((n) => `${esc(zh(n.name))}×${n.count}`).join(' + ')}</li>`)
  const from = (I.madeFrom.get(e.id) ?? []).filter((m) => m.src !== e.id)
  if (from.length) {
    const r = ctx.g.ontology.params?.recovery ?? 0.5
    out.push(`<li>打坏或收获时留下（构成 × ${r * 100}%）：${from.map((m) => (m.src.startsWith('tile/') ? `${esc(zh(ctx.g.terrains.find((t) => `tile/${t.id}` === m.src)?.name) || m.src)}（地形）` : typeLink(ctx, m.src))).join('、')}</li>`)
  }
  const yields = I.yields.get(e.id) ?? []
  if (yields.length) out.push(`<li>产出：${yields.map((y) => typeLink(ctx, y)).join('、')}</li>`)
  const appear = I.appearOn.get(e.id) ?? []
  if (appear.length) out.push(`<li>地面会自己长出（${ctx.link('采集')}）：${appear.map((a) => `${mapLink(ctx, a.map)}（最多 ${a.max}）`).join('、')}</li>`)
  const reward = I.reward.get(e.id) ?? []
  if (reward.length) out.push(`<li>任务奖励：${reward.map((q) => entLink(ctx, q, { icon: 0 })).join('、')}</li>`)
  if (!out.length) out.push(`<li>游戏里目前没有固定的获得方式。</li>`)
  return `<ul class="facts">${out.join('')}</ul>`
}

function uses(ctx: Ctx, e: ItemEnt): string {
  const I = idx(ctx.g)
  const out: string[] = []
  const recipe = (key: string) => {
    const [kind, id] = key.split(':')
    if (kind === 'recipe') { const r = ctx.g.recipes.find((x) => x.id === id)!; return typeLink(ctx, String((r.make as any).type)) }
    const p = ctx.g.placements.find((x) => x.id === id)!
    return `${esc(zh(p.name))}（${ctx.link('建造', '建造模式')}）`
  }
  const ing = Object.entries(Object.fromEntries([...I.ingredient].filter(([t]) => matchesPrefix(e.id, t)))).flatMap(([, v]) => v)
  if (ing.length) out.push(`<li>做成：${[...new Set(ing)].map(recipe).join('、')}</li>`)
  const toolUses = e.tags.flatMap((t) => I.tool.get(t) ?? [])
  if (toolUses.length) out.push(`<li>作为工具（带着即可，不消耗）：${[...new Set(toolUses)].map(recipe).join('、')}</li>`)
  const needs = [...I.questNeeds].filter(([t]) => matchesPrefix(e.id, t)).flatMap(([, q]) => q)
  if (needs.length) out.push(`<li>任务需要：${[...new Set(needs)].map((q) => entLink(ctx, q, { icon: 0 })).join('、')}</li>`)
  if (typeof e.props.food === 'number') out.push(`<li>吃下（拿在手上，右键点自己）：${ctx.link('饱食度')} +${e.props.food}</li>`)
  const given = [...I.given].filter(([t]) => matchesPrefix(e.id, t)).flatMap(([, v]) => v)
  for (const g of given) out.push(`<li>交给${entLink(ctx, g.person)}（{{键|G}}）：「${esc(g.text)}」</li>`.replace('{{键|G}}', '<kbd>G</kbd>'))
  if (!out.length) return `<p class="empty">游戏数据里没有记录它的固定用途。拿着它对别的东西按左键，世界可能会学会新的用法（见[[世界会学]]）。</p>`.replace('[[世界会学]]', ctx.link('世界会学'))
  return `<ul class="facts">${out.join('')}</ul>`
}

function recipeBlock(ctx: Ctx, e: ItemEnt): string {
  if (e.recipe) {
    const r = e.recipe
    return table(['材料', '工具（不消耗）', '地点', '等级', '产量'], [[
      r.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' '),
      join((r.tools ?? []).map((t) => toolName(t))),
      !r.station || r.station === 'hands' ? '手工' : ctx.link('工作台'),
      String(r.level ?? 1),
      `×${r.count ?? 1}`,
    ]])
  }
  if (e.placement) {
    const p = e.placement
    return `<p>在${ctx.link('建造', '建造模式')}（<kbd>B</kbd>）里搭建：${esc(zh(p.description))}</p>` + table(['需要', '数量', '消耗'], p.needs.map((n) => [esc(zh(n.name)), String(n.count), n.consume ? '是' : '否（工具）']))
  }
  return `<p class="empty">不能制作。</p>`
}
const toolName = (t: string) => ({ 'tool:axe': '斧头', 'tool:pickaxe': '镐', 'tool:hammer': '锤子', 'tool:hoe': '锄头', 'tool:sickle': '镰刀', 'tool:shovel': '铲子' } as Record<string, string>)[t] ?? t

function variants(ctx: Ctx, e: ItemEnt): string {
  const f = e.form
  if (!f?.materials?.length || (typeof e.props.power !== 'number' && typeof e.props.def !== 'number')) return `<p class="empty">只有一种。</p>`
  const qs = QUALITIES.filter((q) => ['crude', 'common', 'fine', 'masterwork', 'vowed'].includes(q.id))
  const key = typeof e.props.power === 'number' ? 'power' : 'def'
  const rows = f.materials.map((m) => [
    esc(MATERIALS[m].zh),
    ...qs.map((q) => String(gearProps(e.props, MATERIALS[m] as any, { factor: q.factor } as any)[key] ?? '—')),
  ])
  return `<p>${key === 'power' ? '攻击' : '防御'}随材质和品质变化（${ctx.link('材质')}、${ctx.link('品质')}）：</p>` + table(['材质', ...qs.map((q) => q.zh || '普通')], rows)
}

function schedule(ctx: Ctx, p: PersonEnt): string {
  const d = p.def
  if (!d) return `<p class="empty">没有固定日程。</p>`
  const order = (k: string) => (k === 'default' ? 0 : k === 'rain' ? 1 : k === 'storm' ? 2 : 3)
  return Object.entries(d.schedules).sort(([a], [b]) => order(a) - order(b)).map(([k, slots]) => {
    const label = T(ctx, '条件', k)
    const rows = slots.map(([from, to, anchor, act]) => [`${String(from).padStart(2, '0')}:00–${String(to).padStart(2, '0')}:00`, mapLink(ctx, anchor.split(':')[0]), esc(T(ctx, '活动', act))])
    return `<details class="sched"${k === 'default' ? ' open' : ''}><summary>${esc(label)}</summary>${table(['时间', '地点', '在做什么'], rows)}</details>`
  }).join('')
}

const MOOD: Record<string, string> = { happy: '♥', sad: '…', angry: '!!', surprised: '!', shy: '♡', neutral: '' }
function dialogue(ctx: Ctx, p: PersonEnt): string {
  const d = p.def
  if (!d?.lines.length) return `<p class="empty">没有台词。</p>`
  const groups = new Map<string, typeof d.lines>()
  for (const l of d.lines) { if (!groups.has(l.key)) groups.set(l.key, []); groups.get(l.key)!.push(l) }
  const rank = (k: string) => (k === 'greeting:first' ? 0 : k === 'default' ? 1 : k.startsWith('hour:') ? 2 : k.startsWith('weather:') ? 3 : k.startsWith('fact:') ? 4 : k.startsWith('topic:') ? 5 : 6)
  return [...groups].sort(([a], [b]) => rank(a) - rank(b)).map(([k, lines]) =>
    `<div class="dlg"><div class="dlg-key">${esc(T(ctx, '条件', k))}</div>${lines.map((l) => `<blockquote class="line">${fit(p.face, 32, 'face')}<span>「${esc(zh(l.text))}」${l.mood && MOOD[l.mood] ? `<span class="mood">${MOOD[l.mood]}</span>` : ''}${l.once ? '<span class="once">只说一次</span>' : ''}</span></blockquote>`).join('')}</div>`,
  ).join('')
}

function ties(ctx: Ctx, p: PersonEnt): string {
  const own = Object.entries(p.def?.ties ?? {}).map(([id, rel]) => `<li>${personLink(ctx, id)}：${esc(T(ctx, '关系', rel))}</li>`)
  const back = ctx.g.people.filter((o) => o.def?.ties[p.id]).map((o) => `<li>${personLink(ctx, o.id)} 眼中：${esc(T(ctx, '关系', o.def!.ties[p.id]))}</li>`)
  return own.length || back.length ? `<details class="spoiler"><summary>人物数据里记的关系<span class="spoiler-hint">（可能剧透，点开查看）</span></summary><div class="spoiler-body"><ul class="facts">${[...own, ...back].join('')}</ul></div></details>` : `<p class="empty">游戏数据里没有记录。</p>`
}

function bossSkills(ctx: Ctx, b: BossEnt): string {
  const s = b.def.skills
  const rows = s.map((k) => [
    `<b>${esc(zh(k.name))}</b>`,
    esc(T(ctx, '形状', k.shape)), esc(T(ctx, '瞄准', k.aim)), `${k.radius} 格`,
    String(k.damage), `${Math.round(k.damage * 1.35)}`,
    secs(k.windup), secs(Math.max(8, Math.round(k.windup * 0.8))), secs(k.recovery),
    join([k.status ? ctx.link('状态', zh(ctx.g.ontology.statuses?.[k.status]?.name) || k.status) : '', k.shift === 'push' ? '击退一格' : k.shift === 'pull' ? '拉近' : '', k.blink ? '瞬移到目标旁' : '']),
  ])
  return table(['技能', '形状', '瞄准', '半径', '伤害', '二阶段伤害', '前摇', '二阶段前摇', '后摇', '效果'], rows)
}

function mapView(ctx: Ctx, m: MapEnt): string {
  const W = m.map.width, H = m.map.height
  const pins: string[] = []
  const pin = (x: number, y: number, html: string, title: string, cls: string) =>
    pins.push(`<span class="pin ${cls}" style="left:${((x + 0.5) / W) * 100}%;top:${((y + 0.5) / H) * 100}%" title="${escapeAttr(title)}">${html}</span>`)
  for (const p of ctx.g.people) if (p.entity.place.on === 'tile' && p.entity.place.map === m.id) pin(p.entity.place.x, p.entity.place.y, `<a href="${linkHref(p.title)}"></a>`, p.zh, 'person hot')
  for (const e of m.entities) {
    if (e.place.on !== 'tile') continue
    if (e.type.startsWith('actor/creature/')) {
      const c = ctx.g.entOfType(e.type)
      if (c) pin(e.place.x, e.place.y, `<a href="${linkHref(c.title)}"></a>`, c.zh, 'creature hot')
    } else if (e.type === 'fixture/sacred/waypoint') pin(e.place.x, e.place.y, '◆', '传送雕像', 'waypoint')
  }
  const seen = new Set<string>()
  for (const p of m.map.portals ?? []) {
    if (seen.has(p.to)) continue
    seen.add(p.to)
    pin(p.x, p.y, '➜', `通往${zh(p.label) || p.to}`, 'portal')
  }
  return `<figure class="mapview"><div class="mapbox" style="aspect-ratio:${W}/${H}"><img src="/wiki/_/maps/${m.id}.png" alt="${escapeAttr(m.zh)}地形图">${pins.join('')}</div><figcaption>${esc(m.zh)}（${W} × ${H} 格），世界开始时的样子。人物和生物画在开局的位置，鼠标移上去显示名字、点击打开页面；◆ 是传送雕像，➜ 是出口。</figcaption></figure>`
}

function mapPeople(ctx: Ctx, m: MapEnt): string {
  const ids = [...(idx(ctx.g).mapPeople.get(m.id) ?? [])]
  if (!ids.length) return `<p class="empty">没有人住在这里。</p>`
  return `<ul class="gallery">${ids.map((id) => { const p = ctx.g.byId.get(id) as PersonEnt; return `<li>${fit(p.face, 48, 'face')}${ctx.link(p.title, p.zh)}<small>${p.home === m.id ? '住在这里' : '按日程来这里'}</small></li>` }).join('')}</ul>`
}

function mapCreatures(ctx: Ctx, m: MapEnt): string {
  const rows: string[][] = []
  const counts = new Map<string, number>()
  for (const e of m.entities) if (e.type.startsWith('actor/creature/') && e.place.on === 'tile') counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  for (const [t, n] of counts) rows.push([typeLink(ctx, t), `开局 ${n} 只`])
  for (const a of m.map.appear ?? []) for (const t of Object.keys(a.types)) if (t.startsWith('actor/')) rows.push([typeLink(ctx, t), `每 ${secs(a.every)} 可能再出现一只，最多 ${a.max} 只${a.night ? '（夜里）' : ''}`])
  const night = (ctx.g.ontology.appear ?? []).filter((a: any) => (!a.where?.zone || a.where.zone === (m.map.zone ?? 'combat')) && (!a.where?.light || a.where.light === (m.map.light ?? 'outdoor')))
  for (const a of night) rows.push([Object.keys(a.types).map((t) => typeLink(ctx, t)).join(' '), `${ctx.link('夜行生物')}：入夜后出现，最多 ${a.max} 只，天亮消失`])
  return table(['生物', '数量'], rows)
}

function mapItems(ctx: Ctx, m: MapEnt): string {
  const items = new Map<string, number>(), fixtures = new Map<string, number>()
  for (const e of m.entities) {
    if (e.type.startsWith('item/')) items.set(e.type, (items.get(e.type) ?? 0) + (Number(e.props?.count ?? 1) || 1))
    else if (e.type.startsWith('fixture/') || e.type.startsWith('structure/')) {
      const ent = ctx.g.entOfType(e.type)
      if (ent) fixtures.set(ent.id, (fixtures.get(ent.id) ?? 0) + 1)
    }
  }
  const growth = (m.map.appear ?? []).flatMap((a: any) => Object.keys(a.types).filter((t) => !t.startsWith('actor/')).map((t) => `${typeLink(ctx, t)}（最多 ${a.max}，每 ${secs(a.every)} 一份）`))
  return `<h4>物品</h4>${items.size ? `<p class="chips">${[...items].map(([t, n]) => typeLink(ctx, t, { count: n })).join(' ')}</p>` : '<p class="empty">无</p>'}`
    + `<h4>设施与摆设</h4>${fixtures.size ? `<p class="chips">${[...fixtures].sort((a, b) => b[1] - a[1]).map(([t, n]) => typeLink(ctx, t, { count: n })).join(' ')}</p>` : '<p class="empty">无</p>'}`
    + (growth.length ? `<h4>会自己长出来的</h4><p class="chips">${growth.join(' ')}</p>` : '')
}

function mapLinks(ctx: Ctx, m: MapEnt): string {
  const by = new Map<string, { label: string; n: number; x: number; y: number }>()
  for (const p of m.map.portals ?? []) {
    const k = p.to
    if (!by.has(k)) by.set(k, { label: zh(p.label), n: 0, x: p.x, y: p.y })
    by.get(k)!.n++
  }
  const side = (x: number, y: number) => (x === 0 ? '西边' : x === m.map.width - 1 ? '东边' : y === 0 ? '北边' : y === m.map.height - 1 ? '南边' : `地图内 (${x}, ${y})`)
  const rows = [...by].map(([to, v]) => [mapLink(ctx, to), side(v.x, v.y), `${v.n} 格宽`])
  return table(['通往', '位置', '出口'], rows)
}

function questGoals(ctx: Ctx, q: QuestEnt): string {
  return `<ol class="goals">${q.def.goals.map((g) => {
    const detail = g.kind === 'defeat' ? `打倒 ${typeLink(ctx, g.type, { count: g.count })}${g.map ? `（${mapLink(ctx, g.map)}）` : ''}`
      : g.kind === 'carry' ? `带着 ${typeLink(ctx, g.type, { count: g.count })}${g.consume ? '（交付时收走）' : ''}`
        : g.kind === 'talk' ? `和${personLink(ctx, g.npc)}说话`
          : '剧情推进到这一步'
    return `<li><b>${esc(zh(g.label))}</b><br><small>${detail}</small></li>`
  }).join('')}</ol>`
}

function questReward(ctx: Ctx, q: QuestEnt): string {
  const r = q.def.reward
  const out: string[] = []
  if (r?.xp) out.push(`<li>经验 +${r.xp}（${ctx.link('等级与经验')}）</li>`)
  for (const it of r?.items ?? []) out.push(`<li>${rewardItem(ctx, it)}</li>`)
  return out.length ? `<ul class="facts">${out.join('')}</ul>` : `<p class="empty">没有物品奖励。</p>`
}

function questTalk(ctx: Ctx, q: QuestEnt): string {
  const giver = ctx.g.byId.get(q.def.giver) as PersonEnt | undefined
  const line = (label: string, t?: Text, who = giver) => (t && zh(t) ? `<div class="dlg"><div class="dlg-key">${label}</div><blockquote class="line">${fit(who?.face, 32, 'face')}<span>「${esc(zh(t))}」</span></blockquote></div>` : '')
  const talks = q.def.goals.filter((g) => g.kind === 'talk').map((g: any) => line(`和${zh(ctx.g.byId.get(g.npc)?.zh)}说话时`, g.line, ctx.g.byId.get(g.npc) as PersonEnt))
  const parts = [line('接任务时', q.def.offer), line('还没完成时', q.def.waiting), ...talks, line('交付时', q.def.done)].filter(Boolean)
  return parts.join('') || `<p class="empty">这个任务没有对话。</p>`
}

// ------------------------------------------------------------------------------------------ lists

function itemTable(ctx: Ctx, cat: string): string {
  const g = ctx.g
  let list: ItemEnt[]
  const groups = new Set(Object.values({ ...{} }))
  void groups
  switch (cat) {
    case '全部': list = [...g.items]; break
    case '防具': list = g.items.filter((e) => (e.group === '护甲' || e.group === '衣物') && !isAccessory(e)); break
    case '饰品': list = g.items.filter((e) => (e.group === '护甲' || e.group === '衣物') && isAccessory(e)); break
    case '光源': list = [...g.items.filter((e) => e.group === '照明'), ...g.fixtures.filter((e) => e.group === '光源')]; break
    case '剧情物品': list = g.items.filter((e) => e.group === '圣物' || e.tags.includes('story') || e.id.startsWith('item/relic')); break
    case '建筑件': list = g.structures; break
    case '家具': list = g.fixtures.filter((e) => e.group === '家具'); break
    case '设施': list = g.fixtures; break
    case '容器': list = [...g.items.filter((e) => e.group === '容器'), ...g.fixtures.filter((e) => e.group === '容器')]; break
    default: list = [...g.items, ...g.fixtures].filter((e) => e.group === cat)
  }
  if (!list.length) { ctx.error(`{{物品表|${cat}}}：没有这一类`); return '' }
  const rows = list.map((e) => [fit(e.sprite, 32), ctx.link(e.title, e.zh), esc(e.group), itemStats(ctx, e).filter(([k]) => !['可能的材质', '可带元素'].includes(k)).map(([k, v]) => `${k} ${v}`).join('，') || '—', howToGet(ctx, e)])
  return table(['', '名称', '类别', '属性', '获得'], rows, 'wikitable sortable')
}

function howToGet(ctx: Ctx, e: ItemEnt): string {
  const I = idx(ctx.g)
  const ways: string[] = []
  if (e.recipe) ways.push('制作')
  if (e.placement) ways.push('建造')
  if ([...(ctx.g.placed.get(e.id) ?? [])].some(([m]) => ctx.g.mapOf(m))) ways.push('地图上')
  if ((I.madeFrom.get(e.id) ?? []).length || (I.yields.get(e.id) ?? []).length) ways.push('采集/掉落')
  if ((I.appearOn.get(e.id) ?? []).length) ways.push('地面产出')
  if ((I.reward.get(e.id) ?? []).length) ways.push('任务奖励')
  if ((I.carried.get(e.id) ?? []).length) ways.push('别人带着')
  return ways.join('、') || '<span class="muted">目前拿不到</span>'
}

function lists(ctx: Ctx, name: string, args: string[]): string | undefined {
  const g = ctx.g
  switch (name) {
    case '物品表': return itemTable(ctx, args[0] ?? '全部')
    case '居民表': return table(['', '名字', '身份', '年龄', '住在', '任务'], g.people.map((p) => [fit(p.face, 40, 'face'), ctx.link(p.title, p.zh), esc(p.roleZh), p.age ? String(p.age) : '—', p.home ? mapLink(ctx, p.home) : p.kind === 'companion' ? '跟着玩家' : '只在剧情中', String((idx(g).personQuests.get(p.id) ?? []).length || '—')]), 'wikitable sortable')
    case '怪物表': return table(['', '名字', '类别', '生命', '攻击', '防御', '元素', '出没'], g.creatures.map((c) => [fit(c.sprite, 32), ctx.link(c.title, c.zh), esc(c.group), String(c.props.maxHp ?? '—'), String(c.props.atk ?? '—'), String(c.props.def ?? 0), c.props.element ? T(ctx, '元素', String(c.props.element)) : '—', join(whereCreature(ctx, c.id).map((m) => mapLink(ctx, m))) === '—' ? '<span class="muted">游戏里目前不会出现</span>' : join(whereCreature(ctx, c.id).map((m) => mapLink(ctx, m)))]), 'wikitable sortable')
    case '首领表': return table(['', '名字', '印', '生命（挑战）', '技能', '在哪里打'], g.bosses.map((b) => { const c = campaign(ctx, b); return [fit(b.sprite, 48), ctx.link(b.title, b.zh), esc(b.seal ?? ''), String(b.def.hp), b.def.skills.map((s) => esc(zh(s.name))).join('、'), c ? `${mapLink(ctx, c.map)}、${ctx.link('首领挑战')}` : ctx.link('首领挑战')] }))
    case '地点表': return table(['名称', '类型', '大小', '区域', '相连'], g.maps.map((m) => [ctx.link(m.title, m.zh), esc(T(ctx, '地图类型', m.map.kind)), `${m.map.width}×${m.map.height}`, m.map.zone ? esc(T(ctx, '区域', m.map.zone)) : '战斗区域', join([...new Set((m.map.portals ?? []).map((p: any) => p.to))].map((t) => mapLink(ctx, t as string)))]), 'wikitable sortable')
    case '任务表': {
      const kind = ({ 主线: 'main', 支线: 'side', 重复: 'repeat' } as Record<string, string>)[args[0] ?? ''] ?? ''
      const qs = g.quests.filter((q) => !kind || q.def.kind === kind)
      return table(['任务', '委托人', '目标', '奖励'], qs.map((q) => [ctx.link(q.title, q.zh), personLink(ctx, q.def.giver), q.def.goals.map((x) => esc(zh(x.label))).join('<br>'), [q.def.reward?.xp ? `经验 +${q.def.reward.xp}` : '', ...(q.def.reward?.items ?? []).map((it) => rewardItem(ctx, it))].filter(Boolean).join('<br>') || '—']))
    }
    case '配方表': return table(['', '名称', '材料', '工具（不消耗）', '地点', '等级', '产量'], g.recipes.map((r) => { const e = g.entOfType(String((r.make as any).type)); return [fit(e?.sprite, 32), e ? ctx.link(e.title, e.zh) : esc(zh(r.name)), r.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' '), join((r.tools ?? []).map(toolName)), !r.station || r.station === 'hands' ? '手工' : ctx.link('工作台'), String(r.level ?? 1), `×${r.count ?? 1}`] }), 'wikitable sortable')
    case '建造表': return table(['', '名称', '分页', '需要', '说明'], g.placements.map((p) => { const e = p.result ? g.entOfType(String(p.result)) : undefined; return [fit(e?.sprite ?? (p.sprite.startsWith('item:') ? g.items.find((i) => i.form?.sprite === p.sprite)?.sprite : undefined), 32), e ? ctx.link(e.title, zh(p.name)) : esc(zh(p.name)), p.category === 'building' ? '建筑' : '种植', p.needs.map((n) => `${esc(zh(n.name))}×${n.count}${n.consume ? '' : '（工具）'}`).join('、'), esc(zh(p.description))] }))
      + `<p>另外，身上带着或能现做的${g.structures.map((s) => ctx.link(s.title, s.zh)).join('、')}、${ctx.link('床')}、${ctx.link('工作台')}也会出现在建筑分页里（见${ctx.link('楼层')}）。</p>`
    case '技能树': {
      const key = args[0] ?? ''
      const branch = g.branches.find((b) => b.name.zh === key || b.id === key)
      const prof = g.professions.find((p) => p.name.zh === key || p.id === key)
      const list = prof ? g.skills.filter((s) => s.profession === prof.id) : branch ? g.skills.filter((s) => s.branch === branch.id && !s.profession) : []
      if (!branch && !prof) { ctx.error(`{{技能树|${key}}}：没有这个分支或职业`); return '' }
      if (!list.length) return `<p class="empty">这个分支还没有技能（游戏里显示「技能待设计」）。</p>`
      const nameOf = (id: string) => zh(g.skills.find((s) => s.id === id)?.name) || id
      return table(['', '技能', '前置', '点数', '类型', '效果'], list.map((s) => [fit(iconOf(s.icon), 40), `<b id="技能-${escapeAttr(zh(s.name))}">${esc(zh(s.name))}</b>`, join((s.requires ?? []).map(nameOf)), String(s.cost ?? 1), s.ability ? '能力' : '加成', esc(zh(s.doc))]))
    }
    case '职业表': return table(['', '职业', '说明', '起始装备'], g.professions.map((p) => [fit(iconOf(p.icon), 40), ctx.link(p.name.zh), esc(zh(p.doc)), join([p.weapon, (p as any).offhand].filter(Boolean).map((w: any) => `${typeLink(ctx, w.type)}（${esc(zh(w.name))}）`))]))
    case '恩赐表': return table(['恩赐', '效果', '来源'], g.boons.map((b: any) => [`<b>${esc(zh(b.name))}</b>`, esc(zh(b.doc ?? b.text ?? b.description) || JSON.stringify(b.lead ?? {})), b.from ? esc(String(b.from)) : ctx.link('白骑士·阿尔贝里克')]))
      + `<p>五个位置里其余四个目前是封印的（待设计）。</p>`
    case '状态表': return table(['状态', '持续', '效果'], g.statuses.map((s) => [`<b>${esc(zh(s.name))}</b>`, s.duration ? secs(s.duration) : '一直持续，直到被解除', join([s.immobilize ? '不能行动' : '', s.clears?.length ? `解除${s.clears.map((c) => zh(g.ontology.statuses?.[c]?.name) || c).join('、')}` : '', s.wards?.length ? `防止${s.wards.map((c) => zh(g.ontology.statuses?.[c]?.name) || c).join('、')}` : '', (s as any).every ? `每 ${secs((s as any).every)} 生效一次` : '', (s as any).moveDelay ? `移动慢 ${(s as any).moveDelay} 倍` : '', s.props?.resFire ? `火焰抗性 ${s.props.resFire}%` : ''])]), 'wikitable sortable')
    case '元素表': return table(['元素', '武器名缀', '代码'], ELEMENTS.map((el) => [esc(T(ctx, '元素', el)), esc(ELEMENT_NAMES[el]?.zh ?? ''), `<code>${el}</code>`]))
    case '地形表': return table(['', '地形', '性质', '耐久', '打坏后留下'], g.terrains.map((t) => [`<span class="swatch" style="background:${t.color ?? '#999'}"></span>`, `<b>${esc(zh(t.name))}</b>`, join([t.solid ? '挡路' : '可通行', t.liquid ? '液体' : '', (t.tags ?? []).includes('flammable') ? '可燃' : '', (t.tags ?? []).includes('slippery') ? '滑' : '', (t.tags ?? []).includes('diggable') ? '可开垦' : '', (t.tags ?? []).includes('overworld') ? '大地图' : '']), t.props?.maxHp ? String(t.props.maxHp) : '打不坏', join((t.makeup ?? []).map((m) => typeLink(ctx, m.type, { count: m.count })))]), 'wikitable sortable')
    case '材质表': return table(['材质', '攻击系数', '防御系数', '价值系数', '类别', '硬度'], Object.values(MATERIALS).map((m) => [`<span class="swatch" style="background:${m.color}"></span> ${esc(m.zh)}`, `×${m.attack}`, `×${m.defence}`, `×${m.value}`, esc(m.category), String(m.hardness)]), 'wikitable sortable')
    case '品质表': return table(['品质', '攻防系数', '怎么得到'], QUALITIES.map((q) => [`<b class="q-${q.id}">${esc(q.zh || '普通')}</b>`, `×${q.factor}`, ({ crude: '制作者等级低于配方等级', common: '制作者等级达到配方等级', fine: '制作者等级比配方高 3 级以上', masterwork: '制作者等级比配方高 6 级以上', vowed: '只能找到，不能制作', legendary: '只有持印者才有，不能制作' } as Record<string, string>)[q.id] ?? '']))
    case '装备栏表': return table(['部位', '可穿戴'], Object.entries(ctx.tr['装备栏'] ?? {}).map(([slot, name]) => [esc(name), join(g.items.filter((e) => e.props.slot === slot).map((e) => entLink(ctx, e)), ' ')]))
    case '作物表': {
      const crops = g.fixtures.filter((f) => f.group === '作物' && f.id.split('/').length === 3)
      return table(['', '作物', '产物', '种子', '收获后'], crops.map((c) => [fit(c.sprite, 32), ctx.link(c.title, c.zh), c.props.yieldType ? typeLink(ctx, String(c.props.yieldType)) : '—', c.props.seedType ? typeLink(ctx, String(c.props.seedType)) : '—', c.props.regrowType ? '重新长回幼株' : c.type.tags?.includes('perennial') ? '重新长回' : '没了']))
    }
    case '食物表': return table(['', '食物', '饱食度', '获得'], g.items.filter((e) => typeof e.props.food === 'number').sort((a, b) => b.props.food - a.props.food).map((e) => [fit(e.sprite, 32), ctx.link(e.title, e.zh), `+${e.props.food}`, howToGet(ctx, e)]), 'wikitable sortable')
    case '传送雕像表': return table(['传送雕像', '所在地点'], g.waypoints.map((w) => [`◆ ${esc(zh(w.name))}`, mapLink(ctx, w.map)]))
    case '配乐表': return table(['地点', '音乐'], g.maps.map((m) => [mapLink(ctx, m.id), m.map.music ? esc(`${T(ctx, '音乐', String(m.map.music).toLowerCase())}（${m.map.music}）`) : '—']))
    case '效率表': {
      const cats = ['wood', 'plant', 'stone', 'ore', 'soil', 'flesh', 'bone', 'crystal']
      const cz: Record<string, string> = { wood: '木', plant: '植物', stone: '石', ore: '矿', soil: '土', flesh: '血肉/皮毛', bone: '骨', crystal: '晶' }
      const rz: Record<string, string> = { 'tool:axe': '斧', 'tool:pickaxe': '镐', 'tool:shovel': '铲', 'tool:hammer': '锤', 'edge:cut': '刃（砍）', 'edge:blunt': '钝（砸）', 'edge:pierce': '尖（刺）', 'edge:dig': '挖', 'edge:magic': '法术' }
      return table(['器具', ...cats.map((c) => cz[c])], Object.entries(EFFICIENCY).map(([k, row]) => [esc(rz[k] ?? k), ...cats.map((c) => String(row[c] ?? '—'))]))
    }
    case '房间用途表': return table(['用途', '条件', '效果'], (g.ontology.roomRoles ?? []).map((r: any) => [esc(T(ctx, '房间用途', r.role)), r.needs.type ? `里面有${typeLink(ctx, r.needs.type)}` + (r.count ? ` ×${r.count}` : '') : `里面有带「${r.needs.tags?.join('、')}」的东西（如${ctx.link('篝火')}、${ctx.link('壁炉')}）`, r.props?.rest ? `在这里睡觉恢复损失生命的 ${r.props.rest * 100}%` : '目前只是标签']))
    case '夜行生物表': return table(['生物', '权重', '上限', '间隔', '在哪里'], (g.ontology.appear ?? []).flatMap((a: any) => Object.entries(a.types).map(([t, w]) => [typeLink(ctx, t), `${Math.round(Number(w) * 100)}%`, String(a.max), secs(a.every), `${a.where?.zone === 'combat' ? '战斗区域' : '所有区域'}、${a.where?.light === 'outdoor' ? '室外地图' : '所有地图'}，入夜后`])))
    case '传说武器表': return table(['职业', '传说武器', '圣痕之力'], Object.entries(LEGENDARY_ARMS).flatMap(([prof, arms]) => arms.map((t) => { const e = g.byId.get(t) as ItemEnt | undefined; return [ctx.link(g.professions.find((p) => p.id === prof)?.name.zh ?? prof), entLink(ctx, e) || esc(t), e?.relic ? `<b>${esc(e.relic.zh)}</b>：${esc(e.relic.text)}` : '—'] })))
    case '圣痕之力表': return table(['圣痕之力', '效果', '持有它的'], Object.entries(RELICS).map(([id, r]) => [`<b>${esc(r.zh)}</b>`, esc(r.text.zh), join(g.items.filter((e) => e.props.relic === id).map((e) => entLink(ctx, e)))]))
    case '遗誓特质表': return table(['特质'], VOW_TRAITS.map((t) => [Object.entries(t).map(([k, v]) => `${T(ctx, '属性', k.replace('night:', ''))}${k.startsWith('night:') ? '（夜里）' : ''} +${v < 1 ? `${Math.round(v * 100)}%` : v}`).join('')]))
    case '版本历史': return table(['日期', '合并', '内容'], ctx.history.map((h) => [h.date, `<a href="https://github.com/SihanXU/symbolic-world/pull/${h.pr}">#${h.pr}</a>`, esc(h.title)]))
    case '数值表': return ctx.values()
    case '门户': return ctx.portal()
  }
  return undefined
}

const iconOf = (icon?: string): Sprite => ({ url: `/assets/lsw/skills/${icon ?? 'origin'}.png`, x: 0, y: 0, w: 32, h: 32, iw: 32, ih: 32 })

// ------------------------------------------------------------------------------------------ navboxes

export function navbox(ctx: Ctx, name: string): string {
  const g = ctx.g
  const rows: [string, string][] = []
  const links = (es: Ent[]) => es.map((e) => ctx.link(e.title, e.zh)).join(' • ')
  const titled = (ts: string[]) => ts.map((t) => ctx.link(t)).join(' • ')
  switch (name) {
    case '居民': {
      const by = new Map<string, Ent[]>()
      for (const p of g.people) { const k = p.home ?? (p.kind === 'companion' ? '同伴' : '只在剧情中'); if (!by.has(k)) by.set(k, []); by.get(k)!.push(p) }
      for (const [k, es] of by) rows.push([g.mapOf(k) ? mapLink(ctx, k) : esc(k), links(es)])
      break
    }
    case '物品': {
      const by = new Map<string, Ent[]>()
      for (const e of [...g.items]) { if (!by.has(e.group)) by.set(e.group, []); by.get(e.group)!.push(e) }
      for (const [k, es] of by) rows.push([esc(k), links(es)])
      rows.push(['建筑件', links(g.structures)])
      rows.push(['分类', titled(['物品', '武器', '工具', '防具', '饰品', '食物', '材料', '种子', '建筑件', '家具与设施', '剧情物品', '文书', '材质', '品质', '遗誓', '圣痕', '传说武器'].filter((t) => ctx.pages.has(t)))])
      break
    }
    case '设施': {
      const by = new Map<string, Ent[]>()
      for (const e of g.fixtures) { if (!by.has(e.group)) by.set(e.group, []); by.get(e.group)!.push(e) }
      for (const [k, es] of by) rows.push([esc(k), links(es)])
      break
    }
    case '怪物': {
      const by = new Map<string, Ent[]>()
      for (const e of g.creatures) { if (!by.has(e.group)) by.set(e.group, []); by.get(e.group)!.push(e) }
      for (const [k, es] of by) rows.push([esc(k), links(es)])
      rows.push(['首领', links(g.bosses)])
      break
    }
    case '地点': {
      const by = new Map<string, Ent[]>()
      for (const m of g.maps) { const k = T(ctx, '地图类型', m.map.kind); if (!by.has(k)) by.set(k, []); by.get(k)!.push(m) }
      for (const [k, es] of by) rows.push([esc(k), links(es)])
      break
    }
    case '任务': {
      for (const [k, z] of [['main', '主线'], ['side', '支线'], ['repeat', '重复']]) rows.push([z, links(g.quests.filter((q) => q.def.kind === k))])
      if (ctx.pages.has('主线流程')) rows.push(['攻略', ctx.link('主线流程')])
      break
    }
    default: {
      // a navbox of hand pages: every page that carries it, by directory
      const members = [...ctx.pages.values()].filter((p) => p.navboxes.has(name)).map((p) => p.title).sort((a, b) => a.localeCompare(b, 'zh'))
      if (!members.length) return ''
      rows.push(['', titled(members)])
    }
  }
  return `<table class="navbox"><tr><th colspan="2" class="nb-title">${ctx.link(name === '居民' ? '居民' : name === '物品' ? '物品' : name === '怪物' ? '怪物' : name === '地点' ? '地点' : name === '任务' ? '任务' : name)}</th></tr>${rows.map(([h, v]) => `<tr>${h ? `<th>${h}</th><td>` : '<td colspan="2">'}${v}</td></tr>`).join('')}</table>`
}

// ------------------------------------------------------------------------------------------ the dispatcher

const BLOCK = new Set([
  '信息框', '引言', '小作品', '规划中', '待设计', '开发者', '主条目', '另见', '导航框', '日程表', '对话', '人际关系', '相关任务', '肖像', '来源', '用途', '配方', '变体',
  '出没', '掉落', '首领技能', '地图', '相连地点', '居民', '生物', '物品分布', '任务目标', '任务奖励', '任务对话', '物品表', '居民表', '怪物表', '首领表', '地点表', '任务表',
  '配方表', '建造表', '技能树', '职业表', '恩赐表', '状态表', '元素表', '地形表', '材质表', '品质表', '装备栏表', '作物表', '食物表', '传送雕像表', '配乐表', '效率表',
  '房间用途表', '夜行生物表', '传说武器表', '圣痕之力表', '遗誓特质表', '版本历史', '数值表', '门户', '原文', '图', '剧透',
])

export function runTemplate(ctx: Ctx, call: TemplateCall): { html: string; block: boolean } {
  const { name, args } = call
  const block = BLOCK.has(name)
  const out = (html: string) => ({ html, block })
  const e = ctx.page.ent
  const need = (kinds: Ent['kind'][]): any => {
    if (e && kinds.includes(e.kind)) return e
    ctx.error(`{{${name}}} 只能用在${kinds.map((k) => ({ item: '物品', fixture: '设施', structure: '建筑件', person: '人物', companion: '人物', creature: '怪物', boss: '首领', map: '地点', quest: '任务' } as Record<string, string>)[k]).join('/')}页面上（要先在开头写「对象」）`)
    return undefined
  }
  switch (name) {
    // inline
    case '键': return out(`<kbd>${esc(args[0] ?? '')}</kbd>`)
    case '物品': {
      const x = find(ctx, args[0] ?? '', ['item', 'fixture', 'structure'])
      if (!x) { ctx.error(`{{物品|${args[0]}}}：游戏里没有这个物品`); return out(esc(args[0] ?? '')) }
      return out(entLink(ctx, x, { count: Number(args[1]) || undefined, text: x.zh === args[0]?.trim() || x.title === args[0]?.trim() ? undefined : args[0]?.trim() }))
    }
    case '人物': { const x = find(ctx, args[0] ?? '', ['person', 'companion']) ?? find(ctx, args[0] ?? '', ['boss']); if (!x) ctx.error(`{{人物|${args[0]}}}：没有这个人`); return out(x ? entLink(ctx, x) : esc(args[0] ?? '')) }
    case '怪物': { const x = find(ctx, args[0] ?? '', ['creature', 'boss']); if (!x) ctx.error(`{{怪物|${args[0]}}}：没有这种怪物`); return out(x ? entLink(ctx, x) : esc(args[0] ?? '')) }
    case '地点': { const x = find(ctx, args[0] ?? '', ['map']); if (!x) ctx.error(`{{地点|${args[0]}}}：没有这个地点`); return out(x ? entLink(ctx, x, { icon: 0 }) : esc(args[0] ?? '')) }
    case '状态': {
      const s = ctx.g.statuses.find((x) => zh(x.name) === args[0] || x.id === args[0])
      if (!s) ctx.error(`{{状态|${args[0]}}}：没有这个状态`)
      return out(`<span class="status">${ctx.link('状态', s ? zh(s.name) : args[0])}</span>`)
    }
    case '技能': {
      const s = ctx.g.skills.find((x) => zh(x.name) === args[0] || x.id === args[0])
      if (!s) { ctx.error(`{{技能|${args[0]}}}：没有这个技能`); return out(esc(args[0] ?? '')) }
      const prof = s.profession ? ctx.g.professions.find((p) => p.id === s.profession)?.name.zh : undefined
      const page = prof ?? '技能'
      return out(`<span class="ent">${fit(iconOf(s.icon), 20, 'inline')}<a href="${linkHref(page)}#${encodeURIComponent('技能-' + zh(s.name))}">${esc(zh(s.name))}</a></span>`)
    }
    case '数值': {
      const v = ctx.g.values[args[0] ?? '']
      if (!v) { ctx.error(`{{数值|${args[0]}}}：没有这个数值（见格式手册的数值表）`); return out(esc(args[0] ?? '')) }
      return out(`<span class="value" title="${escapeAttr(`${v.note}（${v.source}）`)}">${esc(v.value)}</span>`)
    }
    case '图': return out(`<figure class="pic${args[2] ? ` ${esc(args[2])}` : ''}"><img src="/wiki/_/img/${encodeURIComponent(args[0] ?? '')}" alt="${escapeAttr(args[1] ?? '')}" loading="lazy">${args[1] ? `<figcaption>${ctx.inline(args[1])}</figcaption>` : ''}</figure>`)
    // banners
    case '小作品': return out(`<div class="banner stub">这一页还没写完。欢迎<a href="#edit" class="edit-link">补充</a>。</div>`)
    case '规划中': return out(`<div class="banner planned"><b>规划中</b>：这里写的是已经定下来的设计，游戏里还没有做出来。${args[0] ? ctx.inline(args[0]) : ''}</div>`)
    case '待设计': return out(`<div class="banner tbd"><b>待设计</b>：这部分还没有设计，下面只记录已经确定的内容。想提议，点页面上方的「讨论」。${args[0] ? ctx.inline(args[0]) : ''}</div>`)
    case '开发者': return out(`<div class="banner dev"><b>开发者功能</b>：只在开发版里有，正式游戏里没有。</div>`)
    case '主条目': return out(`<div class="hatnote">主条目：${args.map((a) => ctx.link(a)).join('、')}</div>`)
    case '另见': return out(`<div class="hatnote">另见：${args.map((a) => ctx.link(a)).join('、')}</div>`)
    case '引言': return out(`<blockquote class="quote"><p>「${ctx.inline(args[0] ?? '')}」</p>${args[1] ? `<footer>— ${ctx.inline(args[1])}</footer>` : ''}</blockquote>`)
    case '导航框': return out(navbox(ctx, args[0] ?? ''))
    case '原文': return out(ctx.include(args[0] ?? ''))
    // entity
    case '信息框': {
      if (!e) { ctx.error('{{信息框}} 要在开头写「对象」'); return out('') }
      if (e.kind === 'item' || e.kind === 'fixture' || e.kind === 'structure') return out(itemInfobox(ctx, e as ItemEnt))
      if (e.kind === 'person' || e.kind === 'companion') return out(personInfobox(ctx, e as PersonEnt))
      if (e.kind === 'creature') return out(creatureInfobox(ctx, e as CreatureEnt))
      if (e.kind === 'boss') return out(bossInfobox(ctx, e as BossEnt))
      if (e.kind === 'map') return out(mapInfobox(ctx, e as MapEnt))
      return out(questInfobox(ctx, e as QuestEnt))
    }
    case '日程表': { const p = need(['person', 'companion']); return out(p ? schedule(ctx, p as PersonEnt) : '') }
    case '对话': { const p = need(['person', 'companion']); return out(p ? dialogue(ctx, p as PersonEnt) : '') }
    case '人际关系': { const p = need(['person', 'companion']); return out(p ? ties(ctx, p as PersonEnt) : '') }
    case '相关任务': { const p = need(['person', 'companion']); const qs = p ? idx(ctx.g).personQuests.get(p.id) ?? [] : []; return out(qs.length ? `<ul class="facts">${qs.map((q) => `<li>${entLink(ctx, q, { icon: 0 })}（${({ main: '主线', side: '支线', repeat: '重复' } as Record<string, string>)[q.def.kind]}${q.def.giver === p!.id ? '，委托人' : ''}）</li>`).join('')}</ul>` : `<p class="empty">没有和这个人有关的任务。</p>`) }
    case '肖像': { const p = need(['person', 'companion']) as PersonEnt | undefined; return out(p ? `<div class="portraits">${fit(p.face, 128, 'face')}${fit(p.body, 96)}</div>` : '') }
    case '来源': { const x = need(['item', 'fixture', 'structure']); return out(x ? sources(ctx, x as ItemEnt) : '') }
    case '用途': { const x = need(['item', 'fixture', 'structure']); return out(x ? uses(ctx, x as ItemEnt) : '') }
    case '配方': { const x = need(['item', 'fixture', 'structure']); return out(x ? recipeBlock(ctx, x as ItemEnt) : '') }
    case '变体': { const x = need(['item']); return out(x ? variants(ctx, x as ItemEnt) : '') }
    case '出没': {
      const x = need(['creature', 'boss'])
      if (!x) return out('')
      if (x.kind === 'boss') { const c = campaign(ctx, x as BossEnt); return out(`<ul class="facts">${c ? `<li>战役：${mapLink(ctx, c.map)}</li>` : ''}<li>${ctx.link('首领挑战')}</li></ul>`) }
      const ws = whereCreature(ctx, x.id)
      return out(ws.length ? `<ul class="facts">${ws.map((m) => { const n = ctx.g.placed.get(x.id)?.get(m); const a = (idx(ctx.g).appearOn.get(x.id) ?? []).find((y) => y.map === m); return `<li>${mapLink(ctx, m)}${n ? `：开局 ${n} 只` : ''}${a ? `${n ? '，' : '：'}会重新出现（最多 ${a.max} 只，每 ${secs(a.every)} 一次）` : ''}</li>` }).join('')}${(ctx.g.ontology.appear ?? []).some((a: any) => a.types[x.id]) ? `<li>${ctx.link('夜行生物')}：战斗区域的室外地图，入夜后</li>` : ''}</ul>` : `<p class="empty">游戏里目前不会出现。</p>`)
    }
    case '掉落': {
      const x = need(['creature', 'boss'])
      if (!x) return out('')
      if (x.kind === 'boss') return out(`<ul class="facts"><li>${typeLink(ctx, 'item/material/iron_ore', { count: 4 })}</li><li>打倒它的人所属职业的一件${ctx.link('传说武器')}（世界里还没出现过的那件）</li><li>经验：等于它的生命上限</li></ul>`)
      const c = x as CreatureEnt
      const r = ctx.g.ontology.params?.recovery ?? 0.5
      const carried = new Map<string, number>()
      for (const m of ctx.g.maps) for (const en of m.entities) if (en.place.on === 'inside' && m.entities.find((h) => h.id === (en.place as any).holder)?.type === c.id) carried.set(en.type, (carried.get(en.type) ?? 0) + 1)
      const lines = [
        ...c.makeup.map((m) => `<li>${typeLink(ctx, m.type, { count: Math.max(1, Math.floor(m.count * r)) })}（构成 ${m.count} × ${r * 100}%）</li>`),
        ...[...carried].map(([t, n]) => `<li>${typeLink(ctx, t, { count: n })}（身上带着的）</li>`),
        `<li>经验 ${c.props.maxHp ?? '—'}（等于生命上限，见${ctx.link('等级与经验')}）</li>`,
      ]
      return out(`<ul class="facts">${lines.join('')}</ul>`)
    }
    case '首领技能': { const x = need(['boss']); return out(x ? bossSkills(ctx, x as BossEnt) : '') }
    case '地图': { const x = need(['map']); return out(x ? mapView(ctx, x as MapEnt) : '') }
    case '相连地点': { const x = need(['map']); return out(x ? mapLinks(ctx, x as MapEnt) : '') }
    case '居民': { const x = need(['map']); return out(x ? mapPeople(ctx, x as MapEnt) : '') }
    case '生物': { const x = need(['map']); return out(x ? mapCreatures(ctx, x as MapEnt) : '') }
    case '物品分布': { const x = need(['map']); return out(x ? mapItems(ctx, x as MapEnt) : '') }
    case '任务目标': { const x = need(['quest']); return out(x ? questGoals(ctx, x as QuestEnt) : '') }
    case '任务奖励': { const x = need(['quest']); return out(x ? questReward(ctx, x as QuestEnt) : '') }
    case '任务对话': { const x = need(['quest']); return out(x ? questTalk(ctx, x as QuestEnt) : '') }
    case '剧透': ctx.error('{{剧透|…}} 和 {{/剧透}} 要各自单独占一行'); return out('')
  }
  const l = lists(ctx, name, args)
  if (l !== undefined) return out(l)
  ctx.error(`不认识的模板 {{${name}}}`)
  return { html: `<span class="error">{{${esc(name)}}}</span>`, block: false }
}

export const linkHref = (title: string) => `/wiki/${encodeURIComponent(title.replace(/\//g, '／'))}`
