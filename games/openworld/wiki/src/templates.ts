// The templates (wiki/pages/帮助/格式手册.md lists them all). Every data template reads the game model:
// a table here is the game's own numbers, never a copy that can go stale.

import { gearProps, type Entity, type QuestDef, type QuestReward, type QuestTrigger, type Text } from '@openworld/engine'
import { BASE_RULES } from '@openworld-game/content'
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
  return `<span class="spr ${cls}${s.smooth ? ' smooth' : ''}" style="width:${s.w * k}px;height:${s.h * k}px;background-image:url('${s.url}');background-position:-${s.x * k}px -${s.y * k}px;background-size:${s.iw * k}px ${s.ih * k}px"></span>`
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

// ------------------------------------------------------------------------------------------ the stall (content homestead.ts)

/** The stall's shelves as its panel names them (client ui/menu.ts SHELVES). */
const SHELF: Record<string, string> = { farm: '农业', ranch: '牧业', fish: '渔业', sell: '出售' }
/** What the stall sells of a thing: its offers (count for price). */
const offersOf = (g: Game, type: string) => g.shop.filter((r) => r.group !== 'sell' && String((r.make as any).type) === type)
/** What the stall pays for one of a thing. */
const buysBack = (g: Game, type: string) => g.shop.find((r) => r.group === 'sell' && r.needs[0]?.type === type)
const priceOf = (r: { needs: { type: string; count: number }[] }) => r.needs[0]?.count ?? 0
/** So many of the stall's coin, its icon linked. */
const coins = (ctx: Ctx, n: number) => `${n} ${entLink(ctx, ctx.g.byId.get(ctx.g.coin))}`

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
  /** type → the base rules whose outcome brings one into being (a spawn, or a transform into it), by rule id */
  ruleMade: Map<string, string[]>
}
let IDX: Indices | undefined

/** Ways of getting a thing that only a rule's outcome gives (no makeup, recipe or map says so), as the pages name them. */
const RULE_WAYS: Record<string, { way: string; page: string; text: string }> = {
  'core/fish': { way: '钓鱼', page: '钓鱼', text: '用鱼竿在水里钓到' },
  'home/milk': { way: '挤奶', page: '动物', text: '拿空木桶给吃饱的牛挤奶' },
  'smelt/ore': { way: '熔炼', page: '熔炉', text: '拿着矿石对点着的熔炉按左键，熔成锭' },
  'use/cook': { way: '烹饪', page: '烹饪', text: '拿着生的东西对点着的营火、火盆等炊具按左键，烤熟' },
  'element/cook': { way: '烹饪', page: '烹饪', text: '被火烧到（放进点着的炊具、被火焰打中）也会熟' },
}
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
    for (const it of questRewards(q.def).items ?? []) push(reward, it.type, q)
    for (const o of q.def.objectives ?? []) if (o.count && 'carry' in o.count && typeof o.count.carry === 'object' && o.count.carry.type) push(questNeeds, o.count.carry.type, q)
    const who = new Set(Object.values(q.def.aliases ?? {}).map((a) => a.id).filter((id): id is string => !!id && id.startsWith('npc.')))
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
  const ruleMade = new Map<string, string[]>()
  const made = (type: string, rule: string) => { if (!(ruleMade.get(type) ?? []).includes(rule)) push(ruleMade, type, rule) }
  // what a rule's host may be: the kinds its selector names (a type prefix and the tags it needs)
  const hosts = (h: { type?: string; tags?: string[] } | undefined) =>
    Object.values(g.types).filter((t) => (!h?.type || matchesPrefix(t.id, h.type)) && (h?.tags ?? []).every((x) => (t.tags ?? []).includes(x)))
  const walk = (n: any, r: (typeof BASE_RULES)[number]): void => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach((x) => walk(x, r))
    const into = n.op === 'spawn' ? n.type : n.op === 'transform' ? n.into : undefined
    if (typeof into === 'string' && !into.startsWith('@')) made(into, r.id)
    // a kind read off the host's own prop (`@prop:smelts`, `@prop:host.babyType`): each host kind's own
    else if (typeof into === 'string' && into.startsWith('@prop:')) {
      const key = into.slice(6).replace(/^host\./, '')
      for (const t of hosts(r.host as any)) if (typeof t.props?.[key] === 'string') made(t.props[key] as string, r.id)
    }
    for (const v of Object.values(n)) walk(v, r)
  }
  for (const r of BASE_RULES) walk(r.tree, r)
  IDX = { madeFrom, reward, ingredient, tool, questNeeds, appearOn, carried, yields, given, personQuests, mapPeople, ruleMade }
  IDX_FOR = g
  return IDX
}

const matchesPrefix = (type: string, prefix: string) => type === prefix || type.startsWith(prefix + '/')

// ------------------------------------------------------------------------------------------ item facts

/**
 * Whether a thing's food number feeds whoever takes it, as the base rules have it: what is eaten (use/eat: edible),
 * and a drink carried in a vessel (use/drink-vessel: a bucket of milk). Other drinks only heal (use/drink).
 */
const feeds = (e: ItemEnt): boolean => typeof e.props.food === 'number' && (e.tags.includes('edible') || (e.tags.includes('drinkable') && e.id.startsWith('item/vessel/')))

function itemStats(ctx: Ctx, e: ItemEnt): [string, string][] {
  const p = e.props
  const rows: [string, string][] = []
  if (typeof p.power === 'number') rows.push(['攻击', String(p.power)])
  if (typeof p.range === 'number') rows.push(['射程', `${p.range} 格`])
  if (typeof p.def === 'number') rows.push(['防御', String(p.def)])
  if (typeof p.atk === 'number' && p.slot) rows.push(['攻击加成', `+${p.atk}`])
  if (p.slot) rows.push(['穿戴部位', T(ctx, '装备栏', String(p.slot))])
  if (feeds(e)) rows.push(['饱食度', `+${p.food}`])
  if (typeof p.heal === 'number' && (e.tags.includes('drinkable') || e.tags.includes('medicinal') || e.id.startsWith('item/potion'))) rows.push(['生命', `+${p.heal + 1}`])
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
  const make = e.recipe ? `${e.recipe.station === 'hands' || !e.recipe.station ? '手工' : `${STATION_PAGE[e.recipe.station] ?? e.recipe.station}旁`}（${ctx.link('制作')}）` : e.placement ? ctx.link('建造', '建造模式') : ''
  if (make) rows.push(['制作', make])
  if (e.makeup.length) rows.push(['构成', e.makeup.map((m) => typeLink(ctx, m.type, { count: m.count })).join(' ')])
  const offers = offersOf(ctx.g, e.id)
  if (offers.length) rows.push([ctx.link('货摊', '货摊卖'), offers.map((r) => `${coins(ctx, priceOf(r))} / ${r.count ?? 1} 个`).join('<br>')])
  const back = buysBack(ctx.g, e.id)
  if (back) rows.push([ctx.link('货摊', '货摊收'), `每个 ${coins(ctx, back.count ?? 1)}`])
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
    ['专属装备', typeof p.trophy === 'string' ? `${typeLink(ctx, p.trophy)}（${trophyOdds(ctx, p)}）` : ''],
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

/** What a quest pays (docs/quests.md): the reward of the stage that completes it (its first). */
function questRewards(d: QuestDef): QuestReward {
  return d.stages.find((s) => s.complete && s.reward)?.reward ?? {}
}

/** Who gives a quest: the alias who offers it, else its `giver` (a fixed person), if any. */
function questGiver(d: QuestDef): string | undefined {
  const name = 'offer' in d.start ? d.start.offer : 'giver'
  return d.aliases?.[name]?.id
}

const KIND_ZH: Record<string, string> = { main: '主线', side: '支线', favor: '委托' }
const NEWS_ZH: Record<string, string> = { hungry: '有人饿着肚子又没钱买吃的', deed: '有人当着失主的面拿走了东西', morning: '每天早上', night: '每天傍晚', begin: '新游戏开始' }

/** A quest's trigger, in words (what has to be so). */
/** A quest's alias in words (docs/quests.md §2.2): a fixed person or thing by its link, a place by its map's, a thing the quest
 *  makes by its name, a role filled as the quest begins (radiant) by the word for it (译名.json 任务词, `alias:<name>`). */
function aliasWords(ctx: Ctx, d: QuestDef | undefined, a: string, html = true, depth = 0): string {
  const x = d?.aliases?.[a]
  const word = (t: string) => (html ? esc(t) : t)
  if (!x) return word(a)
  if (x.id) { const e = ctx.g.byId.get(x.id); return html ? personLink(ctx, x.id) : e?.zh ?? x.id }
  if (x.place) { const m = x.place.split(':')[0]; return html ? mapLink(ctx, m) : ctx.g.mapOf(m)?.zh ?? m }
  if (x.make?.name && depth < 2) return word(fill(ctx, d, x.make.name, depth + 1))
  if (x.make) return html ? typeLink(ctx, x.make.type, { icon: 0 }) : ctx.g.entOfType(x.make.type)?.zh ?? x.make.type
  return word(`〈${T(ctx, '任务词', `alias:${a}`)}〉`)
}

/** A quest's words, its aliases named (plain text, to be escaped). */
function fill(ctx: Ctx, d: QuestDef | undefined, t: Text | undefined, depth = 0): string {
  return zh(t).replace(/\{(\w+)\}/g, (_, a: string) => aliasWords(ctx, d, a, false, depth))
}

/** A class a trigger or a count names: its kind's link, else the words for its tags. */
function selectorWords(ctx: Ctx, d: QuestDef | undefined, x: string | { type?: string; tags?: string[] }, count = 1): string {
  if (typeof x === 'string') return aliasWords(ctx, d, x)
  if (x.type) return typeLink(ctx, x.type, { icon: 0, count: count > 1 ? count : undefined })
  const tags = (x.tags ?? []).map((t) => esc(T(ctx, '任务词', `tag:${t}`))).join('、') || '要的东西'
  return count > 1 ? `${count} 个${tags}` : tags
}

/** What a stage or an objective waits for, in words (docs/quests.md §2.4). */
function triggerWords(ctx: Ctx, t: QuestTrigger | undefined, d?: QuestDef): string {
  if (!t) return '—'
  if ('all' in t) return t.all.map((x) => triggerWords(ctx, x, d)).join('，并且')
  if ('any' in t) return t.any.map((x) => triggerWords(ctx, x, d)).join('，或者')
  if ('not' in t) return `不再是「${triggerWords(ctx, t.not, d)}」`
  if ('done' in t) return `完成${entLink(ctx, ctx.g.byId.get(t.done), { icon: 0 }) || esc(t.done)}`
  if ('quest' in t) return Object.keys(t.quest).map((id) => `${entLink(ctx, ctx.g.byId.get(id), { icon: 0 }) || esc(id)}进行到一定阶段`).join('，')
  if ('fact' in t) return Object.keys(t.fact).map((f) => esc(T(ctx, '条件', `fact:${f}`))).join('，')
  if ('step' in t) return esc(T(ctx, '条件', `fact:seen.${t.step}`))
  if ('enter' in t) return `来到${mapLink(ctx, t.enter.split(':')[0])}`
  if ('talk' in t) {
    const topic = t.topic ? d?.topics?.find((x) => x.id === t.topic) : undefined
    return `和${aliasWords(ctx, d, t.talk)}说话${topic ? `，说「${esc(zh(topic.label))}」` : ''}`
  }
  if ('carry' in t) return `身上带着${selectorWords(ctx, d, t.carry, t.count ?? 1)}`
  if ('give' in t) return `把${selectorWords(ctx, d, t.give)}交给${aliasWords(ctx, d, t.to)}（<kbd>G</kbd>）`
  if ('kill' in t) return `打倒${selectorWords(ctx, d, t.kill)}${t.map ? `（${mapLink(ctx, t.map)}）` : ''}`
  if ('gone' in t) return `${aliasWords(ctx, d, t.gone)}死去或毁掉`
  if ('objectives' in t) {
    const names = t.objectives === 'all' ? '全部目标' : t.objectives.map((id) => `「${esc(fill(ctx, d, d?.objectives?.find((o) => o.id === id)?.text) || id)}」`).join('、')
    return `${names}完成`
  }
  return '剧情推进到这一步'
}

function questInfobox(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  const giver = questGiver(d)
  const r = questRewards(d)
  const s = d.start
  const take = 'auto' in s ? '自动开始' : 'news' in s ? `随机委托（${esc(NEWS_ZH[s.news] ?? s.news)}时出现，委托板上也有）` : 'offer' in s ? `找${personLink(ctx, giver)}（<kbd>E</kbd>，在对话里接受）` : '由剧情开始'
  const reqs = 'auto' in s ? triggerWords(ctx, s.auto, d) : 'offer' in s && !('news' in s) ? [s.level ? `等级 ${s.level}` : '', s.when ? triggerWords(ctx, s.when, d) : ''].filter(Boolean).join('，') || '—' : '—'
  const rows: [string, string][] = [
    ['类型', ctx.link('任务', KIND_ZH[d.kind] ?? d.kind)],
    ['委托人', giver ? personLink(ctx, giver) : '—'],
    ['接取', take],
    ['前置', reqs],
    ...(d.deadline ? [['期限', `${d.deadline} 小时`] as [string, string]] : []),
    ...(d.repeat ? [['重复', d.repeat === 'daily' ? '每天一次' : '可以再接'] as [string, string]] : []),
    ['经验', r.xp ? `+${r.xp}` : '—'],
    ['奖励', join((r.items ?? []).map((it) => rewardItem(ctx, it)), '<br>')],
    ['英文名', esc(q.en)],
    ['编号', `<code>${esc(d.id)}</code>`],
  ]
  return infobox(ctx, q.zh, '', rows)
}

function rewardItem(ctx: Ctx, it: NonNullable<QuestReward['items']>[number]): string {
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

/** How a creature comes about besides being placed or appearing: born to a pair fed (its parents' `babyType`), grown from young (their stage), let out of a crate (an item's `animalType`). */
function bornOf(ctx: Ctx, type: string): { li: string[]; short: string[] } {
  const li: string[] = []
  const short = new Set<string>()
  for (const t of Object.values(ctx.g.types)) {
    if (t.props?.babyType === type) { li.push(`<li>${ctx.link('动物', '繁殖')}：两只吃饱的${typeLink(ctx, t.id)}挨在一起时生下</li>`); short.add('繁殖') }
    if ((t.stage as any)?.into === type && t.id.startsWith('actor/')) { li.push(`<li>由${typeLink(ctx, t.id)}长大（${ctx.g.values['幼崽长大']?.value ?? '?'} 个游戏小时）</li>`); short.add('长大') }
  }
  for (const it of ctx.g.items) if (it.props.animalType === type) { li.push(`<li>把${entLink(ctx, it)}放到地上，里面的动物走出来</li>`); short.add('装箱') }
  return { li, short: [...short] }
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
  for (const id of I.ruleMade.get(e.id) ?? []) if (RULE_WAYS[id]) out.push(`<li>${ctx.link(RULE_WAYS[id].page, RULE_WAYS[id].way)}：${esc(RULE_WAYS[id].text)}</li>`)
  for (const r of offersOf(ctx.g, e.id)) out.push(`<li>在${ctx.link('货摊')}买（${SHELF[r.group ?? ''] ?? r.group}）：${coins(ctx, priceOf(r))}买 ${r.count ?? 1} 个</li>`)
  if (e.id === ctx.g.coin) out.push(`<li>把东西卖给${ctx.link('货摊')}：${ctx.g.shop.filter((r) => r.group === 'sell').map((r) => typeLink(ctx, r.needs[0].type)).join('、')}（见${ctx.link('金钱')}）</li>`)
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
  if (feeds(e)) out.push(`<li>${e.tags.includes('edible') ? '吃下' : '喝下'}（拿在手上，右键点自己）：${ctx.link('饱食度')} +${e.props.food}</li>`)
  const given = [...I.given].filter(([t]) => matchesPrefix(e.id, t)).flatMap(([, v]) => v)
  for (const g of given) out.push(`<li>交给${entLink(ctx, g.person)}（{{键|G}}）：「${esc(g.text)}」</li>`.replace('{{键|G}}', '<kbd>G</kbd>'))
  const back = buysBack(ctx.g, e.id)
  if (back) out.push(`<li>卖给${ctx.link('货摊')}：每个 ${coins(ctx, back.count ?? 1)}</li>`)
  if (e.id === ctx.g.coin) out.push(`<li>在${ctx.link('货摊')}买东西：${ctx.g.shop.filter((r) => r.group !== 'sell').map((r) => typeLink(ctx, String((r.make as any).type))).join('、')}（见${ctx.link('金钱')}）</li>`)
  if (!out.length) return `<p class="empty">游戏数据里没有记录它的固定用途。拿着它对别的东西按左键，世界可能会学会新的用法（见[[世界会学]]）。</p>`.replace('[[世界会学]]', ctx.link('世界会学'))
  return `<ul class="facts">${out.join('')}</ul>`
}

function recipeBlock(ctx: Ctx, e: ItemEnt): string {
  if (e.recipe) {
    const r = e.recipe
    return table(['材料', '工具（不消耗）', '地点', '等级', '产量'], [[
      r.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' '),
      join((r.tools ?? []).map((t) => toolName(t))),
      stationCell(ctx, r.station),
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
/** How often a kind's own piece of gear drops (its `trophyChance`), and the felling that brings it surely (the world's trophyPity, the engine's 50 by default). */
const trophyOdds = (ctx: Ctx, p: Record<string, any>) => {
  const chance = Number(p.trophyChance ?? 0)
  const pity = Number(ctx.g.ontology.params?.trophyPity ?? 50)
  return chance >= 1 ? '必掉' : `每只 ${Math.round(chance * 100)}%，连续 ${pity - 1} 只没掉时第 ${pity} 只必掉`
}
/** The page of the station a recipe is made beside (its fixture's): the workbench, the anvil, the forge, the loom. */
const STATION_PAGE: Record<string, string> = { workbench: '工作台', anvil: '铁砧', forge: '熔炉', loom: '织布机', cauldron: '坩埚' }
const stationCell = (ctx: Ctx, station: string | undefined) => (!station || station === 'hands' ? '手工' : STATION_PAGE[station] ? ctx.link(STATION_PAGE[station]) : esc(station))
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
  const d = q.def
  return `<ol class="goals">${(d.objectives ?? []).map((o) => {
    const c = o.count
    const detail = c && 'kill' in c ? `打倒 ${selectorWords(ctx, d, c.kill, o.need ?? 1)}${c.map ? `（${mapLink(ctx, c.map)}）` : ''}`
      : c && 'carry' in c ? `带着 ${selectorWords(ctx, d, c.carry, o.need ?? 1)}`
        : c && 'fact' in c ? `${esc(T(ctx, '条件', `fact:${c.fact}`))}达到 ${o.need ?? 1}`
          : o.talk && typeof o.target === 'string' && !o.on ? `和${aliasWords(ctx, d, o.target)}说话`
            : o.on ? triggerWords(ctx, o.on, d)
              : '剧情推进到这一步'
    return `<li><b>${esc(fill(ctx, d, o.text))}</b>${o.optional ? '（可选）' : ''}<br><small>${detail}</small></li>`
  }).join('')}</ol>`
}

/** The quest's stages, as the journal logs them (docs/quests.md §2.5): each line in order, how it ends. */
function questStages(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  const rows = d.stages.filter((s) => s.log).map((s) => [String(s.n), esc(fill(ctx, d, s.log)), s.on ? triggerWords(ctx, s.on, d) : '任务开始', s.complete ? '完成' : s.failed ? '失败' : ''])
  return rows.length ? table(['阶段', '日志', '什么时候', ''], rows) : `<p class="empty">这个任务没有日志。</p>`
}

function questReward(ctx: Ctx, q: QuestEnt): string {
  const r = questRewards(q.def)
  const out: string[] = []
  if (r?.xp) out.push(`<li>经验 +${r.xp}（${ctx.link('等级与经验')}）</li>`)
  for (const it of r?.items ?? []) out.push(`<li>${rewardItem(ctx, it)}</li>`)
  return out.length ? `<ul class="facts">${out.join('')}</ul>` : `<p class="empty">没有物品奖励。</p>`
}

function questTalk(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  const giverId = questGiver(d)
  const giver = ctx.g.byId.get(giverId ?? '') as PersonEnt | undefined
  const person = (alias?: string) => (ctx.g.byId.get(d.aliases?.[alias ?? '']?.id ?? '') as PersonEnt | undefined) ?? giver
  const line = (label: string, t?: Text, who = giver) => (t && zh(t) ? `<div class="dlg"><div class="dlg-key">${label}</div><blockquote class="line">${fit(who?.face, 32, 'face')}<span>「${esc(fill(ctx, d, t))}」</span></blockquote></div>` : '')
  const talks = (d.objectives ?? []).filter((o) => o.say).map((o) => { const a = typeof o.target === 'string' ? o.target : undefined; return line(`和${a ? fill(ctx, d, `{${a}}`) : zh(giver?.zh ?? '')}说话时`, o.say, person(a)) })
  const stages = d.stages.filter((s) => s.say).map((s) => line(s.complete ? '交付时' : `第 ${s.n} 阶段`, s.say, person(s.by)))
  const parts = [line('提出委托时', d.offer), line('接受时', d.accepted), line('拒绝时', d.declined), line('还没完成时', d.waiting), ...talks, ...stages].filter(Boolean)
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
  for (const id of I.ruleMade.get(e.id) ?? []) if (RULE_WAYS[id]) ways.push(RULE_WAYS[id].way)
  if (offersOf(ctx.g, e.id).length) ways.push('货摊')
  if (e.id === ctx.g.coin) ways.push('卖东西')
  return ways.join('、') || '<span class="muted">目前拿不到</span>'
}

function lists(ctx: Ctx, name: string, args: string[]): string | undefined {
  const g = ctx.g
  switch (name) {
    case '物品表': return itemTable(ctx, args[0] ?? '全部')
    case '居民表': return table(['', '名字', '身份', '年龄', '住在', '任务'], g.people.map((p) => [fit(p.face, 40, 'face'), ctx.link(p.title, p.zh), esc(p.roleZh), p.age ? String(p.age) : '—', p.home ? mapLink(ctx, p.home) : p.kind === 'companion' ? '跟着玩家' : '只在剧情中', String((idx(g).personQuests.get(p.id) ?? []).length || '—')]), 'wikitable sortable')
    case '怪物表': return table(['', '名字', '类别', '生命', '攻击', '防御', '元素', '出没'], g.creatures.map((c) => [fit(c.sprite, 32), ctx.link(c.title, c.zh), esc(c.group), String(c.props.maxHp ?? '—'), String(c.props.atk ?? '—'), String(c.props.def ?? 0), c.props.element ? T(ctx, '元素', String(c.props.element)) : '—', join([...whereCreature(ctx, c.id).map((m) => mapLink(ctx, m)), ...bornOf(ctx, c.id).short]) === '—' ? '<span class="muted">游戏里目前不会出现</span>' : join([...whereCreature(ctx, c.id).map((m) => mapLink(ctx, m)), ...bornOf(ctx, c.id).short])]), 'wikitable sortable')
    case '首领表': return table(['', '名字', '印', '生命（挑战）', '技能', '在哪里打'], g.bosses.map((b) => { const c = campaign(ctx, b); return [fit(b.sprite, 48), ctx.link(b.title, b.zh), esc(b.seal ?? ''), String(b.def.hp), b.def.skills.map((s) => esc(zh(s.name))).join('、'), c ? `${mapLink(ctx, c.map)}、${ctx.link('首领挑战')}` : ctx.link('首领挑战')] }))
    case '地点表': return table(['名称', '类型', '大小', '区域', '相连'], g.maps.map((m) => [ctx.link(m.title, m.zh), esc(T(ctx, '地图类型', m.map.kind)), `${m.map.width}×${m.map.height}`, m.map.zone ? esc(T(ctx, '区域', m.map.zone)) : '战斗区域', join([...new Set((m.map.portals ?? []).map((p: any) => p.to))].map((t) => mapLink(ctx, t as string)))]), 'wikitable sortable')
    case '任务表': {
      const kind = ({ 主线: 'main', 支线: 'side', 委托: 'favor' } as Record<string, string>)[args[0] ?? ''] ?? ''
      const qs = g.quests.filter((q) => !kind || q.def.kind === kind)
      return table(['任务', '委托人', '目标', '奖励'], qs.map((q) => { const r = questRewards(q.def); const giver = questGiver(q.def); return [ctx.link(q.title, q.zh), giver ? personLink(ctx, giver) : 'news' in q.def.start ? '随机' : '—', (q.def.objectives ?? []).filter((o) => o.id !== 'back').map((x) => esc(zh(x.text))).join('<br>'), [r.xp ? `经验 +${r.xp}` : '', ...(r.items ?? []).map((it) => rewardItem(ctx, it))].filter(Boolean).join('<br>') || '—'] }))
    }
    case '货摊表': {
      // the stall's shelves (content homestead.ts): one shelf, the three that sell (买), what it buys back (出售), or all
      const want = args[0]?.trim() ?? ''
      const groups = want === '买' ? ['farm', 'ranch', 'fish'] : want ? Object.keys(SHELF).filter((k) => SHELF[k] === want) : Object.keys(SHELF)
      if (!groups.length) { ctx.error(`{{货摊表|${want}}}：没有这一栏（农业、牧业、渔业、出售、买）`); return '' }
      const buy = g.shop.filter((r) => r.group !== 'sell' && groups.includes(r.group ?? ''))
      const sell = g.shop.filter((r) => r.group === 'sell' && groups.includes('sell'))
      const thing = (type: string) => { const e = g.entOfType(type); return [fit(e?.sprite, 32), typeLink(ctx, type, { icon: 0 })] }
      return (buy.length ? table(['', '东西', '货架', '一次买', '价格', '每个约'], buy.map((r) => [...thing(String((r.make as any).type)), SHELF[r.group ?? ''], `${r.count ?? 1} 个`, coins(ctx, priceOf(r)), `${+(priceOf(r) / (r.count ?? 1)).toFixed(1)}`]), 'wikitable sortable') : '')
        + (sell.length ? table(['', '东西', '卖一个得'], sell.map((r) => [...thing(r.needs[0].type), coins(ctx, r.count ?? 1)]), 'wikitable sortable') : '')
    }
    case '配方表': return table(['', '名称', '材料', '工具（不消耗）', '地点', '等级', '产量'], g.recipes.map((r) => { const e = g.entOfType(String((r.make as any).type)); return [fit(e?.sprite, 32), e ? ctx.link(e.title, zh(r.name) || e.zh) : esc(zh(r.name)), r.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' '), join((r.tools ?? []).map(toolName)), stationCell(ctx, r.station), String(r.level ?? 1), `×${r.count ?? 1}`] }), 'wikitable sortable')
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
      return table(['', '技能', '前置', '点数', '类型', '效果'], list.map((s) => [fit(iconOf(s.icon), 40), `<b id="技能-${escapeAttr(zh(s.name))}">${esc(zh(s.name))}</b>`, join((s.requires ?? []).map(nameOf)), String(s.cost ?? 1), s.active ? '主动' : s.ability ? '能力' : '加成', esc(zh(s.doc))]))
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
      // what the produce feeds, and the stall's prices: its seeds (count for price) and one of the produce bought back
      const food = (t?: string) => { const e = t ? g.byId.get(t) as ItemEnt | undefined : undefined; return e && feeds(e) ? `+${e.props.food}` : '—' }
      const seedPrice = (t?: string) => (t ? offersOf(g, t).map((r) => `${priceOf(r)} / ${r.count ?? 1} 个`).join('<br>') : '') || '—'
      const sellPrice = (t?: string) => { const r = t ? buysBack(g, t) : undefined; return r ? String(r.count ?? 1) : '—' }
      return table(['', '作物', '产物', '饱食度', '种子', '收获后', `种子价（${ctx.link(g.typeName(g.coin))}）`, '产物卖价'], crops.map((c) => [fit(c.sprite, 32), ctx.link(c.title, c.zh), c.props.yieldType ? typeLink(ctx, String(c.props.yieldType)) : '—', food(c.props.yieldType), c.props.seedType ? typeLink(ctx, String(c.props.seedType)) : '—', c.props.regrowType ? '重新长回幼株' : c.type.tags?.includes('perennial') ? '重新长回' : '没了', seedPrice(c.props.seedType), sellPrice(c.props.yieldType)]), 'wikitable sortable')
    }
    case '食物表': return table(['', '食物', '饱食度', '获得'], g.items.filter(feeds).sort((a, b) => b.props.food - a.props.food).map((e) => [fit(e.sprite, 32), ctx.link(e.title, e.zh), `+${e.props.food}`, howToGet(ctx, e)]), 'wikitable sortable')
    case '传送雕像表': return table(['传送雕像', '所在地点'], g.waypoints.map((w) => [`◆ ${esc(zh(w.name))}`, mapLink(ctx, w.map)]))
    case '配乐表': return table(['地点', '音乐'], g.maps.map((m) => [mapLink(ctx, m.id), m.map.music ? esc(`${T(ctx, '音乐', String(m.map.music).toLowerCase())}（${m.map.music}）`) : '—']))
    case '效率表': {
      const cats = ['wood', 'plant', 'stone', 'ore', 'soil', 'flesh', 'bone', 'crystal']
      const cz: Record<string, string> = { wood: '木', plant: '植物', stone: '石', ore: '矿', soil: '土', flesh: '血肉/皮毛', bone: '骨', crystal: '晶' }
      const rz: Record<string, string> = { 'tool:axe': '斧', 'tool:pickaxe': '镐', 'tool:shovel': '铲', 'tool:hammer': '锤', 'edge:cut': '刃（砍）', 'edge:blunt': '钝（砸）', 'edge:pierce': '尖（刺）', 'edge:dig': '挖', 'edge:magic': '法术' }
      return table(['器具', ...cats.map((c) => cz[c])], Object.entries(EFFICIENCY).map(([k, row]) => [esc(rz[k] ?? k), ...cats.map((c) => String(row[c] ?? '—'))]))
    }
    case '房间用途表': return table(['用途', '条件', '效果'], (g.ontology.roomRoles ?? []).map((r: any) => [esc(T(ctx, '房间用途', r.role)), r.needs.type ? `里面有${typeLink(ctx, r.needs.type)}` + (r.count ? ` ×${r.count}` : '') : `里面有带「${r.needs.tags?.join('、')}」的东西（如${ctx.link('营火')}、${ctx.link('壁炉')}）`, r.props?.rest ? `在这里睡觉恢复损失生命的 ${r.props.rest * 100}%` : '目前只是标签']))
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
      for (const [k, z] of [['main', '主线'], ['side', '支线'], ['favor', '委托']]) rows.push([z, links(g.quests.filter((q) => q.def.kind === k))])
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
  const head = ctx.pages.has(name) ? ctx.link(name) : esc(name)
  return `<table class="navbox"><tr><th colspan="2" class="nb-title">${head}</th></tr>${rows.map(([h, v]) => `<tr>${h ? `<th>${h}</th><td>` : '<td colspan="2">'}${v}</td></tr>`).join('')}</table>`
}

// ------------------------------------------------------------------------------------------ the dispatcher

const BLOCK = new Set([
  '信息框', '引言', '小作品', '规划中', '待设计', '开发者', '主条目', '另见', '导航框', '日程表', '对话', '人际关系', '相关任务', '肖像', '来源', '用途', '配方', '变体',
  '出没', '掉落', '首领技能', '地图', '相连地点', '居民', '生物', '物品分布', '任务目标', '任务奖励', '任务对话', '任务阶段', '物品表', '居民表', '怪物表', '首领表', '地点表', '任务表',
  '配方表', '建造表', '技能树', '职业表', '恩赐表', '状态表', '元素表', '地形表', '材质表', '品质表', '装备栏表', '作物表', '食物表', '传送雕像表', '配乐表', '效率表',
  '房间用途表', '夜行生物表', '传说武器表', '圣痕之力表', '遗誓特质表', '货摊表', '版本历史', '数值表', '门户', '原文', '图', '剧透',
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
    case '相关任务': { const p = need(['person', 'companion']); const qs = p ? idx(ctx.g).personQuests.get(p.id) ?? [] : []; return out(qs.length ? `<ul class="facts">${qs.map((q) => `<li>${entLink(ctx, q, { icon: 0 })}（${KIND_ZH[q.def.kind] ?? q.def.kind}${questGiver(q.def) === p!.id ? '，委托人' : ''}）</li>`).join('')}</ul>` : `<p class="empty">没有和这个人有关的任务。</p>`) }
    case '外观部件': {
      // every part of the look table (docs/looks.md), by slot: a sample portrait and sprite, its words, whom it fits, its tags
      const SLOT_ZH: Record<string, string> = { hair: '发型', face: '五官', beard: '胡子', age: '年纪', mark: '印记', glasses: '眼镜', hat: '帽子', cloak: '披挂', armour: '甲胄', outfit: '服装' }
      const BODY_ZH: Record<string, string> = { woman: '女人', man: '男人', girl: '女孩', boy: '男孩' }
      const slot = args[0]
      const parts = ctx.g.lookParts.filter((l) => !slot || l.slot === slot || SLOT_ZH[l.slot] === slot)
      return out(table(['', '部件', '槽位', '适合', '标签', '说法'], parts.map((l) => [
        `${fit(l.face, 72, 'face')}${fit(l.body, 48)}`, esc(zh(l.name)), esc(SLOT_ZH[l.slot] ?? l.slot), esc(l.bodies.map((b) => BODY_ZH[b] ?? b).join('、')),
        l.tags.length ? l.tags.map((t) => `<code>${esc(t)}</code>`).join(' ') : '—', esc(zh(l.say).replace('{c}', '某')),
      ]), 'wikitable sortable'))
    }
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
      const born = bornOf(ctx, x.id).li.join('')
      return out(ws.length || born ? `<ul class="facts">${ws.map((m) => { const n = ctx.g.placed.get(x.id)?.get(m); const a = (idx(ctx.g).appearOn.get(x.id) ?? []).find((y) => y.map === m); return `<li>${mapLink(ctx, m)}${n ? `：开局 ${n} 只` : ''}${a ? `${n ? '，' : '：'}会重新出现（最多 ${a.max} 只，每 ${secs(a.every)} 一次）` : ''}</li>` }).join('')}${(ctx.g.ontology.appear ?? []).some((a: any) => a.types[x.id]) ? `<li>${ctx.link('夜行生物')}：战斗区域的室外地图，入夜后</li>` : ''}${born}</ul>` : `<p class="empty">游戏里目前不会出现。</p>`)
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
        ...(typeof c.props.trophy === 'string' ? [`<li>${typeLink(ctx, c.props.trophy)}（${ctx.link('专属掉落', '专属装备')}，直接进打倒它的人的背包：${trophyOdds(ctx, c.props)}）</li>`] : []),
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
    case '任务阶段': { const x = need(['quest']); return out(x ? questStages(ctx, x as QuestEnt) : '') }
    case '剧透': ctx.error('{{剧透|…}} 和 {{/剧透}} 要各自单独占一行'); return out('')
  }
  const l = lists(ctx, name, args)
  if (l !== undefined) return out(l)
  ctx.error(`不认识的模板 {{${name}}}`)
  return { html: `<span class="error">{{${esc(name)}}}</span>`, block: false }
}

export const linkHref = (title: string) => `/wiki/${encodeURIComponent(title.replace(/\//g, '／'))}`
