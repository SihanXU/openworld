// The templates (wiki/pages/帮助/格式手册.md lists them all). Every data template reads the game model:
// a table here is the game's own numbers, never a copy that can go stale. Each edition builds them in its own
// language (lang.ts `L`, game.ts `say`); a template and its keyword arguments answer to either language's name.

import { gearProps, type CreatureSkill, type Effect, type Entity, type QuestDef, type QuestReward, type QuestTrigger, type Text } from '@openworld/engine'
import { BASE_RULES, CREATURE_ROLES, REGION_BY_ID, REGIONS } from '@openworld-game/content'
import {
  EFFICIENCY, ELEMENT_NAMES, ELEMENTS, LEGENDARY_ARMS, MATERIALS, QUALITIES, RELICS, VOWS, enOf, groupName, isAccessory, kindName, say, zh,
  type BossEnt, type CreatureEnt, type Ent, type Game, type ItemEnt, type MapEnt, type PersonEnt, type QuestEnt, type Sprite,
} from './game.ts'
import { L, lang, linkHref } from './lang.ts'
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
  /** Whether a page of that title exists in this edition (a Chinese title resolved to the English page). */
  has(title: string): boolean
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
  if (!rows.length) return `<p class="empty">${L('（无）', '(none)')}</p>`
  return `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

const secs = (ticks: number) => `${+(ticks / 10).toFixed(1)}${L(' 秒', ' s')}`
const cells = (n: number | string) => L(`${n} 格`, Number(n) === 1 ? '1 cell' : `${n} cells`)
const join = (xs: string[], sep = L('、', ', ')) => xs.filter(Boolean).join(sep) || '—'
/** An aside in brackets, and a quotation, as each edition writes them. */
const par = (x: string) => L(`（${x}）`, ` (${x})`)
const quot = (x: string) => L(`「${x}」`, `“${x}”`)
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

export function entLink(ctx: Ctx, e: Ent | undefined, opts: { icon?: number; count?: number; text?: string } = {}): string {
  if (!e) return ''
  const icon = opts.icon === 0 ? '' : fit(e.sprite, opts.icon ?? 20, 'inline')
  const count = opts.count && opts.count > 1 ? `<span class="count">×${opts.count}</span>` : ''
  return `<span class="ent">${icon}${ctx.link(e.title, opts.text ?? e.name)}${count}</span>`
}
export function typeLink(ctx: Ctx, type: string, opts: { icon?: number; count?: number } = {}): string {
  const e = ctx.g.byId.get(type) ?? ctx.g.entOfType(type)
  if (e && (e.id === type || type.startsWith(e.id + '/'))) return entLink(ctx, e, opts)
  const name = ctx.g.typeName(type)
  return `<span class="ent">${esc(name)}${opts.count && opts.count > 1 ? `<span class="count">×${opts.count}</span>` : ''}</span>`
}
const mapLink = (ctx: Ctx, id?: string) => (id ? (ctx.g.mapOf(id) ? entLink(ctx, ctx.g.mapOf(id), { icon: 0 }) : esc(id)) : '—')
const personLink = (ctx: Ctx, id?: string) => entLink(ctx, ctx.g.byId.get(id ?? '')) || esc(id ?? '')
/** The infobox row that names a thing in the other edition's language. */
const otherName = (e: Ent): [string, string] => [L('英文名', 'Chinese name'), esc(L(e.en, e.zh))]

// ------------------------------------------------------------------------------------------ the stall (content homestead.ts)

/** The stall's shelves as its panel names them (client ui/menu.ts SHELVES): the Chinese names are also the keys {{货摊表|…}} takes. */
const SHELF: Record<string, string> = { farm: '农业', ranch: '牧业', fish: '渔业', sell: '出售' }
const SHELF_EN: Record<string, string> = { farm: 'Farm', ranch: 'Ranch', fish: 'Fishing', sell: 'Selling' }
const shelfName = (k: string) => L(SHELF[k] ?? k, SHELF_EN[k] ?? k)
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
  // a made thing's name as the game composes it: quality + material + form (精良铁剑, 木棍棒; Fine Iron Sword, Wooden Club)
  const prefixes = [
    ...QUALITIES.map((q) => q.zh).filter(Boolean), ...Object.values(MATERIALS).map((m) => m.zh),
    ...QUALITIES.map((q) => q.en).filter(Boolean).map((x) => `${x} `), ...Object.values(MATERIALS).map((m) => `${m.en} `),
  ].sort((a, b) => b.length - a.length)
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

/** Ways of getting a thing that only a rule's outcome gives (no makeup, recipe or map says so), as the pages name them (`page` a Chinese title). */
const RULE_WAYS = (): Record<string, { way: string; page: string; text: string }> => ({
  'core/fish': { way: L('钓鱼', 'Fishing'), page: '钓鱼', text: L('用鱼竿在水里钓到', 'Caught in water with a fishing rod') },
  'home/milk': { way: L('挤奶', 'Milking'), page: '动物', text: L('拿空木桶给吃饱的牛挤奶', 'Milk a well-fed cow into an empty bucket') },
  'smelt/ore': { way: L('熔炼', 'Smelting'), page: '熔炉', text: L('拿着矿石右键点着的熔炉，熔成锭', 'Right-click a lit furnace holding ore to smelt it into ingots') },
  'use/cook': { way: L('烹饪', 'Cooking'), page: '烹饪', text: L('拿着生的东西右键点着的营火、火盆等炊具，烤熟', 'Right-click a lit campfire, brazier or other cooker holding something raw to cook it') },
  'element/cook': { way: L('烹饪', 'Cooking'), page: '烹饪', text: L('被火烧到（放进点着的炊具、被火焰打中）也会熟', 'Fire cooks it too (put in a lit cooker, or struck by flame)') },
})
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
  for (const p of g.people) for (const l of p.def?.lines ?? []) if (l.key.startsWith('given:')) push(given, l.key.slice(6), { person: p, text: say(l.text) })
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

const TOOL_ZH: Record<string, string> = { axe: '斧', pickaxe: '镐', shovel: '铲', hammer: '锤', hoe: '锄', sickle: '镰' }

/** A thing's numbers as rows; `brief` (a list's cell) leaves out what it may be made of. */
function itemStats(ctx: Ctx, e: ItemEnt, brief = false): [string, string][] {
  const p = e.props
  const rows: [string, string][] = []
  if (typeof p.power === 'number') rows.push([L('攻击', 'Attack'), String(p.power)])
  if (typeof p.range === 'number') rows.push([L('射程', 'Range'), cells(p.range)])
  if (typeof p.def === 'number') rows.push([L('防御', 'Defence'), String(p.def)])
  if (typeof p.atk === 'number' && p.slot) rows.push([L('攻击加成', 'Attack bonus'), `+${p.atk}`])
  if (p.slot) rows.push([L('穿戴部位', 'Slot'), T(ctx, '装备栏', String(p.slot))])
  if (feeds(e)) rows.push([L('饱食度', 'Hunger'), `+${p.food}`])
  if (typeof p.heal === 'number' && (e.tags.includes('drinkable') || e.tags.includes('medicinal') || e.id.startsWith('item/potion'))) rows.push([L('生命', 'Health'), `+${p.heal + 1}`])
  if (typeof p.capacity === 'number') rows.push([L('容量', 'Capacity'), cells(p.capacity)])
  if (typeof p.maxHp === 'number') rows.push([L('耐久', 'Durability'), String(p.maxHp)])
  if (typeof p.critChance === 'number') rows.push([L('暴击率', 'Crit chance'), `+${Math.round(p.critChance * 100)}%`])
  if (typeof p.lifesteal === 'number') rows.push([L('吸血', 'Lifesteal'), String(p.lifesteal)])
  if (typeof p.xpRate === 'number') rows.push([L('经验', 'Experience'), `${p.xpRate > 0 ? '+' : ''}${Math.round(p.xpRate * 100)}%`])
  if (typeof p.handsRange === 'number') rows.push([L('交互距离', 'Reach'), p.handsRange === 0 ? L('站在上面', 'Standing on it') : cells(p.handsRange)])
  if (p.element) rows.push([L('元素', 'Element'), T(ctx, '元素', String(p.element))])
  const prof = e.tags.find((t) => t.startsWith('profession:'))?.slice(11)
  if (prof) rows.push([L('职业', 'Profession'), ctx.link(say(ctx.g.professions.find((x) => x.id === prof)?.name) || prof)])
  const tools = e.tags.filter((t) => t.startsWith('tool:')).map((t) => t.slice(5))
  if (tools.length) rows.push([L('工具能力', 'Tool use'), tools.map((t) => L(TOOL_ZH[t] ?? t, t)).join(L('、', ', '))])
  if (brief) return rows
  if (e.form?.materials?.length) rows.push([L('可能的材质', 'Materials'), e.form.materials.map((m) => (MATERIALS[m] ? say(MATERIALS[m]) : m)).join(L('、', ', '))])
  if (e.form?.elemental) rows.push([L('可带元素', 'Elemental'), L('是', 'Yes')])
  return rows
}

function qualityName(id?: string): string {
  return say(QUALITIES.find((q) => q.id === id))
}

// ------------------------------------------------------------------------------------------ infoboxes

function infobox(ctx: Ctx, title: string, image: string, rows: [string, string][], caption = ''): string {
  return `<aside class="infobox"><div class="ib-title">${esc(title.charAt(0).toUpperCase() + title.slice(1))}</div>${image ? `<div class="ib-image">${image}</div>` : ''}${caption ? `<div class="ib-caption">${caption}</div>` : ''}<table class="ib">${rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table></aside>`
}

function itemInfobox(ctx: Ctx, e: ItemEnt): string {
  const rows: [string, string][] = [[L('类别', 'Category'), ctx.link(groupPage(e), e.groupName)], ...itemStats(ctx, e)]
  if (e.quality) rows.push([L('品质', 'Quality'), ctx.link('品质', qualityName(e.quality))])
  if (e.form?.origin) {
    rows.push([L('产地', 'Origin'), regionLink(ctx, e.form.origin)])
    const named = e.form.named ? par(ctx.link('地区物产', L('名品', 'named piece'))) : ''
    rows.push([L('类属', 'Kind of'), L(`${typeLink(ctx, e.form.base!)}的一种${named}`, `A kind of ${typeLink(ctx, e.form.base!)}${named}`)])
  }
  if (e.relic) rows.push([L('圣痕之力', 'Stigma power'), `<b>${esc(e.relic.name)}</b>${L('：', ': ')}${esc(e.relic.text)}`])
  if (e.vow) rows.push([L('誓言', 'Vow'), `<b>${esc(e.vow.name)}</b>${L('：', ': ')}${esc(e.vow.text)}`])
  const s = e.recipe?.station
  const make = e.recipe ? `${s === 'hands' || !s ? L('手工', 'By hand') : L(`${STATION_PAGE[s] ?? s}旁`, `At the ${s}`)}${par(ctx.link('制作'))}` : e.placement ? ctx.link('建造', L('建造模式', 'Build mode')) : ''
  if (make) rows.push([L('制作', 'Made'), make])
  if (e.makeup.length) rows.push([L('构成', 'Made of'), e.makeup.map((m) => typeLink(ctx, m.type, { count: m.count })).join(' ')])
  const offers = offersOf(ctx.g, e.id)
  if (offers.length) rows.push([ctx.link('货摊', L('货摊卖', 'Stall sells')), offers.map((r) => L(`${coins(ctx, priceOf(r))} / ${r.count ?? 1} 个`, `${coins(ctx, priceOf(r))} for ${r.count ?? 1}`)).join('<br>')])
  const back = buysBack(ctx.g, e.id)
  if (back) rows.push([ctx.link('货摊', L('货摊收', 'Stall buys')), L(`每个 ${coins(ctx, back.count ?? 1)}`, `${coins(ctx, back.count ?? 1)} each`)])
  rows.push(otherName(e))
  rows.push([L('编号', 'ID'), `<code>${esc(e.id)}</code>`])
  return infobox(ctx, e.name, fit(e.sprite, 64), rows)
}

function personInfobox(ctx: Ctx, p: PersonEnt): string {
  const d = p.def
  const rows: [string, string][] = [
    [L('身份', 'Role'), esc(p.roleName)],
    [L('年龄', 'Age'), p.age ? L(`${p.age} 岁`, String(p.age)) : ''],
    [L('住在', 'Lives in'), p.home ? mapLink(ctx, p.home) : p.kind === 'companion' ? L('跟着玩家', 'Follows the player') : L('只在剧情中出场', 'Appears only in the story')],
    [L('喜爱礼物', 'Favourite gift'), p.favourite ? `${typeLink(ctx, p.favourite, { icon: 16 })}${par(ctx.link('友谊', L('送礼', 'gifts')))}` : ''],
  ]
  if (d) rows.push([L('性格', 'Temperament'), Object.values(d.temperament).map((v) => esc(T(ctx, '性格', v))).join(L('、', ', '))])
  const qs = idx(ctx.g).personQuests.get(p.id) ?? []
  if (qs.length) rows.push([L('任务', 'Quests'), qs.map((q) => entLink(ctx, q, { icon: 0 })).join('<br>')])
  rows.push(otherName(p))
  rows.push([L('编号', 'ID'), `<code>${esc(p.id)}</code>`])
  return infobox(ctx, p.name, fit(p.face, 96, 'face'), rows)
}

/** A minor monster's role, as the infobox says it (content levels.ts). */
const ROLE_ZH: Record<string, string> = { swarm: '群怪', fighter: '战士', caster: '法术', brute: '肉盾', elite: '精英' }
const ROLE_EN: Record<string, string> = { swarm: 'Swarm', fighter: 'Fighter', caster: 'Caster', brute: 'Brute', elite: 'Elite' }

function creatureInfobox(ctx: Ctx, c: CreatureEnt): string {
  const p = c.props
  const role = CREATURE_ROLES[c.id]
  const rows: [string, string][] = [
    [L('类别', 'Family'), esc(c.groupName)],
    [L('等级', 'Level'), p.level && role ? L(`${p.level} 级 · ${ROLE_ZH[role]}`, `${p.level} · ${ROLE_EN[role]}`) : ''],
    [L('生命', 'Health'), String(p.maxHp ?? p.hp ?? '—')],
    [L('攻击', 'Attack'), String(p.atk ?? '—')],
    [L('防御', 'Defence'), String(p.def ?? 0)],
    [L('速度', 'Speed'), p.speed ? L(`每 ${p.speed} tick 走一格`, `One cell every ${p.speed} ticks`) : ''],
    [L('元素', 'Element'), p.element ? T(ctx, '元素', String(p.element)) : L('无', 'None')],
    [L('飞行', 'Flying'), p.stance === 'air' ? L('是（不碰地面）', 'Yes (never touches the ground)') : ''],
    [L('射程', 'Range'), typeof p.range === 'number' ? cells(p.range) : ''],
    [L('经验', 'Experience'), String(p.maxHp ?? p.hp ?? '—')],
    [L('出没', 'Found in'), join(whereCreature(ctx, c.id).map((w) => mapLink(ctx, w)))],
    [L('掉落', 'Drops'), c.makeup.length ? c.makeup.map((m) => typeLink(ctx, m.type, { count: Math.floor(m.count * ctx.g.ontology.params!.recovery!) || 1 })).join(' ') : L('无', 'None')],
    [L('专属装备', 'Trophy'), typeof p.trophy === 'string' ? `${typeLink(ctx, p.trophy)}${par(trophyOdds(ctx, p))}` : ''],
    otherName(c),
    [L('编号', 'ID'), `<code>${esc(c.id)}</code>`],
  ]
  return infobox(ctx, c.name, fit(c.sprite, 96), rows)
}

function bossInfobox(ctx: Ctx, b: BossEnt): string {
  const d = b.def
  const camp = campaign(ctx, b)
  const rows: [string, string][] = [
    [L('印', 'Seal'), b.seal ? esc(b.seal) : ''],
    [L('生命', 'Health'), camp ? L(`战役 ${camp.hp} · 挑战 ${d.hp}`, `Campaign ${camp.hp} · Challenge ${d.hp}`) : L(`${d.hp}（首领挑战）`, `${d.hp} (Boss Challenge)`)],
    [L('护甲', 'Armour'), camp ? L(`战役 ${camp.def} · 挑战 ${d.defense}`, `Campaign ${camp.def} · Challenge ${d.defense}`) : String(d.defense)],
    [L('占地', 'Size'), L(`${d.footprint[0]} × ${d.footprint[1]} 格`, `${d.footprint[0]} × ${d.footprint[1]} cells`)],
    [L('视野', 'Sight'), cells(d.encounter.sight ?? 12)],
    [L('阶段', 'Phases'), d.encounter.phases.slice(1).map((ph, i) => L(`第${'二三四五'[i] ?? i + 2}阶段：生命低于 ${Math.round(ph.at * 100)}%`, `Phase ${i + 2}: below ${Math.round(ph.at * 100)}% health`)).join('<br>')],
    [L('技能', 'Skills'), d.skills.map((s) => esc(say(s.name))).join('<br>')],
    [L('出没', 'Found in'), camp ? mapLink(ctx, camp.map) : ctx.link('首领挑战')],
    otherName(b),
    [L('编号', 'ID'), `<code>${esc(d.id)}</code>`],
  ]
  return infobox(ctx, b.name, fit(b.sprite, 160), rows)
}

function campaign(ctx: Ctx, b: BossEnt): { map: string; hp: number; def: number } | undefined {
  for (const m of ctx.g.maps) for (const e of m.entities) if (e.type === b.def.type) return { map: m.id, hp: Number(e.props?.maxHp ?? e.props?.hp), def: Number(e.props?.def ?? b.def.defense) }
  return undefined
}

function mapInfobox(ctx: Ctx, m: MapEnt): string {
  const map = m.map
  const links = [...new Set((map.portals ?? []).map((p: any) => p.to))] as string[]
  const wps = ctx.g.waypoints.filter((w) => w.map === m.id)
  const rows: [string, string][] = [
    [L('类型', 'Type'), esc(T(ctx, '地图类型', String(map.kind)))],
    [L('大小', 'Size'), L(`${map.width} × ${map.height} 格`, `${map.width} × ${map.height} cells`)],
    [L('区域', 'Zone'), map.zone ? ctx.link('和平区域与战斗区域', T(ctx, '区域', map.zone)) : ctx.link('和平区域与战斗区域', L('战斗区域', 'Combat zone'))],
    [L('光照', 'Light'), map.light ? esc(T(ctx, '光照', map.light)) : L('室外（随昼夜变化）', 'Outdoor (follows day and night)')],
    [L('音乐', 'Music'), map.music ? esc(T(ctx, '音乐', String(map.music).toLowerCase())) : '—'],
    [L('传送雕像', 'Waypoints'), wps.length ? wps.map((w) => esc(say(w.name))).join(L('、', ', ')) : L('无', 'None')],
    [L('相连', 'Connects to'), join(links.map((l) => mapLink(ctx, l)))],
    otherName(m),
    [L('编号', 'ID'), `<code>${esc(m.id)}</code>`],
  ]
  return infobox(ctx, m.name, `<img class="map-thumb" src="/wiki/_/maps/${m.id}.png" alt="${escapeAttr(L(`${m.name}的地形图`, `Terrain map of ${m.name}`))}">`, rows)
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

const KIND_ZH: Record<string, string> = { main: '主线', side: '支线', favor: '委托', guide: '指引' }
const KIND_EN: Record<string, string> = { main: 'Main', side: 'Side', favor: 'Favour', guide: 'Guide' }
const questKind = (k: string) => L(KIND_ZH[k] ?? k, KIND_EN[k] ?? k)
/** When a radiant favour is offered (zh: what happens; en: the whole clause). */
const NEWS_ZH: Record<string, string> = { hungry: '有人饿着肚子又没钱买吃的', deed: '有人当着失主的面拿走了东西', morning: '每天早上', night: '每天傍晚', begin: '新游戏开始' }
const NEWS_EN: Record<string, string> = { hungry: 'when someone is hungry with no money for food', deed: 'when someone takes a thing in front of its owner', morning: 'every morning', night: 'every evening', begin: 'when a new game begins' }

/** A quest's trigger, in words (what has to be so). */
/** A quest's alias in words (docs/quests.md §2.2): a fixed person or thing by its link, a place by its map's, a thing the quest
 *  makes by its name, a role filled as the quest begins (radiant) by the word for it (译名.json 任务词, `alias:<name>`). */
function aliasWords(ctx: Ctx, d: QuestDef | undefined, a: string, html = true, depth = 0): string {
  const x = d?.aliases?.[a]
  const word = (t: string) => (html ? esc(t) : t)
  if (!x) return word(a)
  if (x.id) { const e = ctx.g.byId.get(x.id); return html ? personLink(ctx, x.id) : e?.name ?? x.id }
  if (x.place) { const m = x.place.split(':')[0]; return html ? mapLink(ctx, m) : ctx.g.mapOf(m)?.name ?? m }
  if (x.make?.name && depth < 2) return word(fill(ctx, d, x.make.name, depth + 1))
  if (x.make) return html ? typeLink(ctx, x.make.type, { icon: 0 }) : ctx.g.entOfType(x.make.type)?.name ?? x.make.type
  const w = T(ctx, '任务词', `alias:${a}`)
  return word(L(`〈${w}〉`, `‹${w}›`))
}

/** A quest's words, its aliases named (plain text, to be escaped). */
function fill(ctx: Ctx, d: QuestDef | undefined, t: Text | undefined, depth = 0): string {
  return say(t).replace(/\{(\w+)\}/g, (_, a: string) => aliasWords(ctx, d, a, false, depth))
}

/** A class a trigger or a count names: its kind's link, else the words for its tags. */
function selectorWords(ctx: Ctx, d: QuestDef | undefined, x: string | { type?: string; tags?: string[] }, count = 1): string {
  if (typeof x === 'string') return aliasWords(ctx, d, x)
  if (x.type) return typeLink(ctx, x.type, { icon: 0, count: count > 1 ? count : undefined })
  const tags = (x.tags ?? []).map((t) => esc(T(ctx, '任务词', `tag:${t}`))).join(L('、', ', ')) || L('要的东西', 'the things wanted')
  return count > 1 ? L(`${count} 个${tags}`, `${count} ${tags}`) : tags
}

/** What a stage or an objective waits for, in words (docs/quests.md §2.4). */
function triggerWords(ctx: Ctx, t: QuestTrigger | undefined, d?: QuestDef): string {
  if (!t) return '—'
  if ('all' in t) return t.all.map((x) => triggerWords(ctx, x, d)).join(L('，并且', ', and '))
  if ('any' in t) return t.any.map((x) => triggerWords(ctx, x, d)).join(L('，或者', ', or '))
  if ('not' in t) return L(`不再是「${triggerWords(ctx, t.not, d)}」`, `No longer “${triggerWords(ctx, t.not, d)}”`)
  if ('done' in t) { const q = entLink(ctx, ctx.g.byId.get(t.done), { icon: 0 }) || esc(t.done); return L(`完成${q}`, `${q} completed`) }
  if ('quest' in t)
    return Object.entries(t.quest)
      .map(([id, c]) => {
        const name = entLink(ctx, ctx.g.byId.get(id), { icon: 0 }) || esc(id)
        // a quest at stage 0 has not begun (the guides wait on the tutorial's not having: a game proper)
        if (c === 0 || (typeof c === 'object' && c !== null && 'eq' in c && c.eq === 0)) return L(`${name}没有开始（不在新手教程里）`, `${name} not begun (outside the tutorial)`)
        if (typeof c === 'object' && c !== null && 'gte' in c && typeof c.gte === 'number') return L(`${name}进行到第 ${c.gte} 阶段`, `${name} at stage ${c.gte}`)
        return L(`${name}进行到一定阶段`, `${name} far enough along`)
      })
      .join(L('，', ', '))
  if ('fact' in t) return Object.keys(t.fact).map((f) => esc(T(ctx, '条件', `fact:${f}`))).join(L('，', ', '))
  if ('step' in t) return esc(T(ctx, '条件', `fact:seen.${t.step}`))
  if ('enter' in t) { const m = mapLink(ctx, t.enter.split(':')[0]); return L(`来到${m}`, `Reach ${m}`) }
  if ('talk' in t) {
    const topic = t.topic ? d?.topics?.find((x) => x.id === t.topic) : undefined
    const who = aliasWords(ctx, d, t.talk)
    const saying = topic ? L(`，说「${esc(say(topic.label))}」`, `, saying “${esc(say(topic.label))}”`) : ''
    return L(`和${who}说话${saying}`, `Talk to ${who}${saying}`)
  }
  if ('carry' in t) { const s = selectorWords(ctx, d, t.carry, t.count ?? 1); return L(`身上带着${s}`, `Carry ${s}`) }
  if ('give' in t) { const s = selectorWords(ctx, d, t.give), to = aliasWords(ctx, d, t.to); return L(`把${s}交给${to}（<kbd>G</kbd>）`, `Give ${s} to ${to} (<kbd>G</kbd>)`) }
  if ('kill' in t) { const s = selectorWords(ctx, d, t.kill); const at = t.map ? par(mapLink(ctx, t.map)) : ''; return L(`打倒${s}${at}`, `Defeat ${s}${at}`) }
  if ('gone' in t) { const s = aliasWords(ctx, d, t.gone); return L(`${s}死去或毁掉`, `${s} dies or is destroyed`) }
  if ('objectives' in t) {
    const names = t.objectives === 'all' ? L('全部目标', 'All objectives') : t.objectives.map((id) => quot(esc(fill(ctx, d, d?.objectives?.find((o) => o.id === id)?.text) || id))).join(L('、', ', '))
    return L(`${names}完成`, `${names} complete`)
  }
  return L('剧情推进到这一步', 'The story reaches this point')
}

function questInfobox(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  const giver = questGiver(d)
  const r = questRewards(d)
  const s = d.start
  const take = 'auto' in s ? L('自动开始', 'Starts by itself')
    : 'news' in s ? L(`随机委托（${esc(NEWS_ZH[s.news] ?? s.news)}时出现，委托板上也有）`, `Radiant favour (offered ${esc(NEWS_EN[s.news] ?? s.news)}; also on the notice board)`)
      : 'offer' in s ? L(`找${personLink(ctx, giver)}（<kbd>E</kbd>，在对话里接受）`, `Talk to ${personLink(ctx, giver)} (<kbd>E</kbd>; accept in the conversation)`)
        : L('由剧情开始', 'Begun by the story')
  const reqs = 'auto' in s ? triggerWords(ctx, s.auto, d) : 'offer' in s && !('news' in s) ? [s.level ? L(`等级 ${s.level}`, `Level ${s.level}`) : '', s.when ? triggerWords(ctx, s.when, d) : ''].filter(Boolean).join(L('，', ', ')) || '—' : '—'
  const rows: [string, string][] = [
    [L('类型', 'Type'), ctx.link('任务', questKind(d.kind))],
    [L('委托人', 'Giver'), giver ? personLink(ctx, giver) : '—'],
    [L('接取', 'Start'), take],
    [L('前置', 'Requires'), reqs],
    ...(d.deadline ? [[L('期限', 'Time limit'), L(`${d.deadline} 小时`, `${d.deadline} hours`)] as [string, string]] : []),
    ...(d.repeat ? [[L('重复', 'Repeats'), d.repeat === 'daily' ? L('每天一次', 'Once a day') : L('可以再接', 'Can be taken again')] as [string, string]] : []),
    [L('经验', 'Experience'), r.xp ? `+${r.xp}` : '—'],
    [L('奖励', 'Rewards'), join((r.items ?? []).map((it) => rewardItem(ctx, it)), '<br>')],
    otherName(q),
    [L('编号', 'ID'), `<code>${esc(d.id)}</code>`],
  ]
  return infobox(ctx, q.name, '', rows)
}

function rewardItem(ctx: Ctx, it: NonNullable<QuestReward['items']>[number]): string {
  const base = typeLink(ctx, it.type, { count: it.count })
  if (!it.name) return base
  const q = it.tags?.find((t) => t.startsWith('quality:'))?.slice(8)
  // (its vow by name; the small extras it rolled are its own, not the author's word)
  const stats = Object.entries(it.props ?? {}).filter(([k]) => k !== 'slot' && k !== 'vow' && !k.startsWith('sub:')).map(([k, v]) => `${T(ctx, '属性', k)} ${v}`).join(L('，', ', '))
  const vow = typeof it.props?.vow === 'string' ? VOWS[it.props.vow] : undefined
  const sep = L('，', ', ')
  return `<b>${esc(say(it.name))}</b>${q ? par(esc(qualityName(q))) : ''}${L('：', ': ')}${base}${stats ? `${sep}${esc(stats)}` : ''}${vow ? `${sep}${L('誓言', 'vow ')}${quot(esc(say(vow)))}` : ''}`
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
    if (t.props?.babyType === type) {
      const breed = ctx.link('动物', L('繁殖', 'Breeding'))
      li.push(`<li>${L(`${breed}：两只吃饱的${typeLink(ctx, t.id)}挨在一起时生下`, `${breed}: born when two well-fed ${typeLink(ctx, t.id)} stand side by side`)}</li>`)
      short.add(L('繁殖', 'breeding'))
    }
    if ((t.stage as any)?.into === type && t.id.startsWith('actor/')) {
      const h = ctx.g.values['幼崽长大']?.value ?? '?'
      li.push(`<li>${L(`由${typeLink(ctx, t.id)}长大（${h} 个游戏小时）`, `Grows up from ${typeLink(ctx, t.id)} (${h} in-game hours)`)}</li>`)
      short.add(L('长大', 'growing up'))
    }
  }
  for (const it of ctx.g.items) if (it.props.animalType === type) { li.push(`<li>${L(`把${entLink(ctx, it)}放到地上，里面的动物走出来`, `Put ${entLink(ctx, it)} down: the animal inside walks out`)}</li>`); short.add(L('装箱', 'crate')) }
  return { li, short: [...short] }
}

function sources(ctx: Ctx, e: ItemEnt): string {
  const I = idx(ctx.g)
  const out: string[] = []
  const sep = L('、', ', '), col = L('：', ': ')
  const placed = [...(ctx.g.placed.get(e.id) ?? [])].filter(([m]) => ctx.g.mapOf(m))
  if (placed.length) out.push(`<li>${L('放在地图上', 'Placed on maps')}${col}${placed.map(([m, n]) => `${mapLink(ctx, m)}${n > 1 ? ` ×${n}` : ''}`).join(sep)}</li>`)
  const carried = I.carried.get(e.id) ?? []
  if (carried.length) out.push(`<li>${L('有人带着', 'Carried by')}${col}${[...new Set(carried.map((c) => c.who))].map((w) => (w.startsWith('npc.') ? personLink(ctx, w) : typeLink(ctx, w))).join(sep)}</li>`)
  if (e.recipe) out.push(`<li>${ctx.link('制作')}${col}${e.recipe.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' + ')}${e.recipe.count && e.recipe.count > 1 ? ` → ×${e.recipe.count}` : ''}</li>`)
  if (e.placement) out.push(`<li>${ctx.link('建造', L('建造模式', 'Build mode'))}${col}${e.placement.needs.map((n) => `${esc(say(n.name))}×${n.count}`).join(' + ')}</li>`)
  const from = (I.madeFrom.get(e.id) ?? []).filter((m) => m.src !== e.id)
  if (from.length) {
    const r = ctx.g.ontology.params?.recovery ?? 0.5
    const srcs = from.map((m) => (m.src.startsWith('tile/') ? `${esc(say(ctx.g.terrains.find((t) => `tile/${t.id}` === m.src)?.name) || m.src)}${par(L('地形', 'terrain'))}` : typeLink(ctx, m.src))).join(sep)
    out.push(`<li>${L(`打坏或收获时留下（构成 × ${r * 100}%）`, `Left when broken or harvested (makeup × ${r * 100}%)`)}${col}${srcs}</li>`)
  }
  const yields = I.yields.get(e.id) ?? []
  if (yields.length) out.push(`<li>${L('产出', 'Produced by')}${col}${yields.map((y) => typeLink(ctx, y)).join(sep)}</li>`)
  const appear = I.appearOn.get(e.id) ?? []
  if (appear.length) out.push(`<li>${L(`地面会自己长出（${ctx.link('采集')}）`, `Grows from the ground (${ctx.link('采集')})`)}${col}${appear.map((a) => `${mapLink(ctx, a.map)}${par(L(`最多 ${a.max}`, `up to ${a.max}`))}`).join(sep)}</li>`)
  const reward = I.reward.get(e.id) ?? []
  if (reward.length) out.push(`<li>${L('任务奖励', 'Quest reward')}${col}${reward.map((q) => entLink(ctx, q, { icon: 0 })).join(sep)}</li>`)
  const ways = RULE_WAYS()
  for (const id of I.ruleMade.get(e.id) ?? []) if (ways[id]) out.push(`<li>${ctx.link(ways[id].page, ways[id].way)}${col}${esc(ways[id].text)}</li>`)
  for (const r of offersOf(ctx.g, e.id)) {
    const stall = ctx.link('货摊'), n = r.count ?? 1
    out.push(`<li>${L(`在${stall}买（${shelfName(r.group ?? '')}）：${coins(ctx, priceOf(r))}买 ${n} 个`, `Bought at the ${stall} (${shelfName(r.group ?? '')}): ${n} for ${coins(ctx, priceOf(r))}`)}</li>`)
  }
  if (e.id === ctx.g.coin) {
    const stall = ctx.link('货摊'), list = ctx.g.shop.filter((r) => r.group === 'sell').map((r) => typeLink(ctx, r.needs[0].type)).join(sep), money = ctx.link('金钱')
    out.push(`<li>${L(`把东西卖给${stall}：${list}（见${money}）`, `Sell things to the ${stall}: ${list} (see ${money})`)}</li>`)
  }
  if (e.form?.origin) {
    const where = `${regionLink(ctx, e.form.origin)}${e.form.origin === 'holy' ? '' : L(`和${regionLink(ctx, 'holy')}`, ` and ${regionLink(ctx, 'holy')}`)}`
    out.push(`<li>${L(`${where}的背景地点里有存货：人家、店铺、铁匠铺、旅店、神殿和箱子（${ctx.link('地区物产')}）`, `In stock at the backdrop places of ${where}: homes, shops, smithies, inns, temples and chests (${ctx.link('地区物产')})`)}</li>`)
  }
  if (!out.length) out.push(`<li>${L('游戏里目前没有固定的获得方式。', 'There is no set way to get it in the game yet.')}</li>`)
  return `<ul class="facts">${out.join('')}</ul>`
}

/** A region by its id: its page (by its Chinese title, which either edition resolves), or its name. */
function regionLink(ctx: Ctx, id: string): string {
  const key = zh(REGION_BY_ID[id]?.name) || id
  return ctx.has(key) ? ctx.link(key) : esc(say(REGION_BY_ID[id]?.name) || id)
}

/** The regional forms (content goods.ts) of a base form, by region: the line's piece, the local kinds, the named. */
function regionalOf(ctx: Ctx, base: string): string {
  const of = ctx.g.items.filter((x) => x.form?.base === base)
  if (!of.length) return ''
  const rows = REGIONS.map((r) => [regionLink(ctx, r.id), of.filter((x) => x.form!.origin === r.id).map((x) => `${ctx.link(x.title, x.name)}${x.form!.named ? par(L('名品', 'named')) : ''}`).join(L('、', ', ')) || '—'])
  return `<p>${L(`各地的做法（${ctx.link('地区物产')}）：和它一样用，名字、材质、身价和出处不同。`, `Regional makes (${ctx.link('地区物产')}): used the same way, with their own names, materials, worth and origins.`)}</p>` + table([L('地区', 'Region'), L('变体', 'Variants')], rows)
}

/** Every region's goods (content goods.ts): its line, its local kinds, its named pieces. A region by its id or its name in either language. */
function regionalGoods(ctx: Ctx, region?: string): string {
  const items = ctx.g.items.filter((x) => x.form?.origin)
  const want = region?.trim().toLowerCase()
  return REGIONS.filter((r) => !want || r.id === want || zh(r.name) === region?.trim() || enOf(r.name).toLowerCase() === want).map((r) => {
    const own = items.filter((x) => x.form!.origin === r.id)
    const line = own.filter((x) => x.form!.line)
    const named = own.filter((x) => x.form!.named)
    const local = own.filter((x) => !named.includes(x) && !line.includes(x))
    const links = (xs: ItemEnt[]) => xs.map((x) => ctx.link(x.title, x.name)).join(L('、', ', ')) || '—'
    return `<h3>${regionLink(ctx, r.id)}${par(L(`${own.length} 种`, `${own.length} kinds`))}</h3>` + table(['', ''], [[L('名品', 'Named pieces'), links(named)], [L('地方物产', 'Local goods'), links(local)], [L('本地做的装备与工具', 'Local gear and tools'), links(line)]])
  }).join('')
}

function uses(ctx: Ctx, e: ItemEnt): string {
  const I = idx(ctx.g)
  const out: string[] = []
  const sep = L('、', ', '), col = L('：', ': ')
  const recipe = (key: string) => {
    const [kind, id] = key.split(':')
    if (kind === 'recipe') { const r = ctx.g.recipes.find((x) => x.id === id)!; return typeLink(ctx, String((r.make as any).type)) }
    const p = ctx.g.placements.find((x) => x.id === id)!
    return `${esc(say(p.name))}${par(ctx.link('建造', L('建造模式', 'Build mode')))}`
  }
  const ing = Object.entries(Object.fromEntries([...I.ingredient].filter(([t]) => matchesPrefix(e.id, t)))).flatMap(([, v]) => v)
  if (ing.length) out.push(`<li>${L('做成', 'Made into')}${col}${[...new Set(ing)].map(recipe).join(sep)}</li>`)
  const toolUses = e.tags.flatMap((t) => I.tool.get(t) ?? [])
  if (toolUses.length) out.push(`<li>${L('作为工具（带着即可，不消耗）', 'As a tool (carried, not used up)')}${col}${[...new Set(toolUses)].map(recipe).join(sep)}</li>`)
  const needs = [...I.questNeeds].filter(([t]) => matchesPrefix(e.id, t)).flatMap(([, q]) => q)
  if (needs.length) out.push(`<li>${L('任务需要', 'Needed for quests')}${col}${[...new Set(needs)].map((q) => entLink(ctx, q, { icon: 0 })).join(sep)}</li>`)
  if (feeds(e)) {
    const how = e.tags.includes('edible') ? L('吃下', 'Eat') : L('喝下', 'Drink')
    out.push(`<li>${how}${L('（拿在手上左键，或右键点自己）', ' (left-click it in hand, or right-click yourself)')}${col}${ctx.link('饱食度')} +${e.props.food}</li>`)
  }
  const given = [...I.given].filter(([t]) => matchesPrefix(e.id, t)).flatMap(([, v]) => v)
  for (const g of given) out.push(`<li>${L(`交给${entLink(ctx, g.person)}（<kbd>G</kbd>）`, `Give to ${entLink(ctx, g.person)} (<kbd>G</kbd>)`)}${col}${quot(esc(g.text))}</li>`)
  const back = buysBack(ctx.g, e.id)
  if (back) out.push(`<li>${L(`卖给${ctx.link('货摊')}：每个 ${coins(ctx, back.count ?? 1)}`, `Sell to the ${ctx.link('货摊')}: ${coins(ctx, back.count ?? 1)} each`)}</li>`)
  if (e.id === ctx.g.coin) {
    const stall = ctx.link('货摊'), list = ctx.g.shop.filter((r) => r.group !== 'sell').map((r) => typeLink(ctx, String((r.make as any).type))).join(sep), money = ctx.link('金钱')
    out.push(`<li>${L(`在${stall}买东西：${list}（见${money}）`, `Buy at the ${stall}: ${list} (see ${money})`)}</li>`)
  }
  // a region's make is its base to every rule (content goods.ts): what its base is for, it is for
  if (e.form?.base) {
    const base = typeLink(ctx, e.form.base), name = esc(ctx.g.typeName(e.form.base))
    out.unshift(`<li>${L(`和${base}一样：世界对它的规则就是对${name}的规则。`, `Works like ${base}: the world's rules for ${name} are its rules.`)}</li>`)
  }
  if (!out.length) {
    const learn = ctx.link('世界会学')
    return `<p class="empty">${L(`游戏数据里没有记录它的固定用途。拿着它右键点别的东西，世界可能会学会新的用法（见${learn}）。`, `The game data records no set use for it. Right-click something else while holding it, and the world may learn a new use (see ${learn}).`)}</p>`
  }
  return `<ul class="facts">${out.join('')}</ul>`
}

function recipeBlock(ctx: Ctx, e: ItemEnt): string {
  if (e.recipe) {
    const r = e.recipe
    return table([L('材料', 'Ingredients'), L('工具（不消耗）', 'Tools (not used up)'), L('地点', 'Station'), L('等级', 'Level'), L('产量', 'Yield')], [[
      r.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' '),
      join((r.tools ?? []).map((t) => toolName(t))),
      stationCell(ctx, r.station),
      String(r.level ?? 1),
      `×${r.count ?? 1}`,
    ]])
  }
  if (e.placement) {
    const p = e.placement
    const mode = ctx.link('建造', L('建造模式', 'Build mode'))
    return `<p>${L(`在${mode}（<kbd>B</kbd>）里搭建：`, `Built in ${mode} (<kbd>B</kbd>): `)}${esc(say(p.description))}</p>` + table([L('需要', 'Needs'), L('数量', 'Count'), L('消耗', 'Consumed')], p.needs.map((n) => [esc(say(n.name)), String(n.count), n.consume ? L('是', 'Yes') : L('否（工具）', 'No (tool)')]))
  }
  return `<p class="empty">${L('不能制作。', 'Cannot be made.')}</p>`
}
/** How often a kind's own piece of gear drops (its `trophyChance`), and the felling that brings it surely (the loot module's pity, 50 by default). */
const trophyOdds = (ctx: Ctx, p: Record<string, any>) => {
  const chance = Number(p.trophyChance ?? 0)
  const pity = Number(ctx.g.ontology.loot?.pity ?? 50)
  return chance >= 1 ? L('必掉', 'always drops') : L(`每只 ${Math.round(chance * 100)}%，连续 ${pity - 1} 只没掉时第 ${pity} 只必掉`, `${Math.round(chance * 100)}% a kill; certain on the ${ordinal(pity)} if the ${pity - 1} before gave none`)
}
/** The page of the station a recipe is made beside (its fixture's): the workbench, the anvil, the forge, the loom. */
const STATION_PAGE: Record<string, string> = { workbench: '工作台', anvil: '铁砧', forge: '熔炉', loom: '织布机', cauldron: '坩埚' }
const stationCell = (ctx: Ctx, station: string | undefined) => (!station || station === 'hands' ? L('手工', 'By hand') : STATION_PAGE[station] ? ctx.link(STATION_PAGE[station]) : esc(station))
const TOOL_NAME: Record<string, string> = { 'tool:axe': '斧头', 'tool:pickaxe': '镐', 'tool:hammer': '锤子', 'tool:hoe': '锄头', 'tool:sickle': '镰刀', 'tool:shovel': '铲子' }
const toolName = (t: string) => (TOOL_NAME[t] ? L(TOOL_NAME[t], t.slice(5)) : t)

function variants(ctx: Ctx, e: ItemEnt): string {
  const regional = regionalOf(ctx, e.id)
  const own = materialVariants(ctx, e)
  return own || regional ? own + regional : `<p class="empty">${L('只有一种。', 'Comes in one kind only.')}</p>`
}

function materialVariants(ctx: Ctx, e: ItemEnt): string {
  const f = e.form
  if (!f?.materials?.length || (typeof e.props.power !== 'number' && typeof e.props.def !== 'number')) return ''
  const qs = QUALITIES.filter((q) => ['crude', 'common', 'fine', 'masterwork', 'vowed'].includes(q.id))
  const key = typeof e.props.power === 'number' ? 'power' : 'def'
  const rows = f.materials.map((m) => [
    esc(say(MATERIALS[m])),
    ...qs.map((q) => String(gearProps(e.props, MATERIALS[m] as any, { factor: q.factor } as any)[key] ?? '—')),
  ])
  const what = key === 'power' ? L('攻击', 'Attack') : L('防御', 'Defence')
  return `<p>${L(`${what}随材质和品质变化（${ctx.link('材质')}、${ctx.link('品质')}）：`, `${what} by material and quality (${ctx.link('材质')}, ${ctx.link('品质')}):`)}</p>` + table([L('材质', 'Material'), ...qs.map((q) => say(q) || L('普通', 'Common'))], rows)
}

function schedule(ctx: Ctx, p: PersonEnt): string {
  const d = p.def
  if (!d) return `<p class="empty">${L('没有固定日程。', 'No set schedule.')}</p>`
  const order = (k: string) => (k === 'default' ? 0 : k === 'rain' ? 1 : k === 'storm' ? 2 : 3)
  return Object.entries(d.schedules).sort(([a], [b]) => order(a) - order(b)).map(([k, slots]) => {
    const label = T(ctx, '条件', k)
    const rows = slots.map(([from, to, anchor, act]) => [`${String(from).padStart(2, '0')}:00–${String(to).padStart(2, '0')}:00`, mapLink(ctx, anchor.split(':')[0]), esc(T(ctx, '活动', act))])
    return `<details class="sched"${k === 'default' ? ' open' : ''}><summary>${esc(label)}</summary>${table([L('时间', 'Time'), L('地点', 'Place'), L('在做什么', 'Doing')], rows)}</details>`
  }).join('')
}

const MOOD: Record<string, string> = { happy: '♥', sad: '…', angry: '!!', surprised: '!', shy: '♡', neutral: '' }
function dialogue(ctx: Ctx, p: PersonEnt): string {
  const d = p.def
  if (!d?.lines.length) return `<p class="empty">${L('没有台词。', 'No lines.')}</p>`
  const groups = new Map<string, typeof d.lines>()
  for (const l of d.lines) { if (!groups.has(l.key)) groups.set(l.key, []); groups.get(l.key)!.push(l) }
  const rank = (k: string) => (k === 'greeting:first' ? 0 : k === 'default' ? 1 : k.startsWith('hour:') ? 2 : k.startsWith('weather:') ? 3 : k.startsWith('fact:') ? 4 : k.startsWith('topic:') ? 5 : 6)
  return [...groups].sort(([a], [b]) => rank(a) - rank(b)).map(([k, lines]) =>
    `<div class="dlg"><div class="dlg-key">${esc(T(ctx, '条件', k))}</div>${lines.map((l) => `<blockquote class="line">${fit(p.face, 32, 'face')}<span>${quot(esc(say(l.text)))}${l.mood && MOOD[l.mood] ? `<span class="mood">${MOOD[l.mood]}</span>` : ''}${l.once ? `<span class="once">${L('只说一次', 'said once')}</span>` : ''}</span></blockquote>`).join('')}</div>`,
  ).join('')
}

function ties(ctx: Ctx, p: PersonEnt): string {
  const col = L('：', ': ')
  const own = Object.entries(p.def?.ties ?? {}).map(([id, rel]) => `<li>${personLink(ctx, id)}${col}${esc(T(ctx, '关系', rel))}</li>`)
  const back = ctx.g.people.filter((o) => o.def?.ties[p.id]).map((o) => `<li>${personLink(ctx, o.id)}${L(' 眼中：', ' sees them as: ')}${esc(T(ctx, '关系', o.def!.ties[p.id]))}</li>`)
  return own.length || back.length ? `<details class="spoiler"><summary>${L('人物数据里记的关系', 'Relationships in the character data')}<span class="spoiler-hint">${L('（可能剧透，点开查看）', ' (may spoil: click to show)')}</span></summary><div class="spoiler-body"><ul class="facts">${[...own, ...back].join('')}</ul></div></details>` : `<p class="empty">${L('游戏数据里没有记录。', 'Nothing recorded in the game data.')}</p>`
}

/** What a boss's skill lands, as its own rule says (the `kit` branch of its `act/use` answer): the unleash in it. */
function landingOf(type: string, id: string): Extract<Effect, { op: 'unleash' }> | undefined {
  const rule = BASE_RULES.find((r) => r.on === 'act/use' && r.host?.type === type)
  let t: any = rule?.tree
  while (t && typeof t === 'object' && 'if' in t) t = t.if?.param?.key === 'kit' && t.if.param.cmp === id ? t.then : t.else
  const effects: any[] = t && typeof t === 'object' && 'do' in t ? t.do : []
  return effects.find((e) => e.op === 'unleash')
}

function bossSkills(ctx: Ctx, b: BossEnt): string {
  const d = b.def, phases = d.encounter.phases
  const usedIn = (id: string) => join(phases.flatMap((ph, i) => [ph.rotation.includes(id) ? L(`${i + 1}阶段轮转`, `phase ${i + 1} rotation`) : '', ph.enter === id ? L(`${i + 1}阶段开场`, `opens phase ${i + 1}`) : '']).filter(Boolean).concat(d.encounter.reactive?.includes(id) ? [L('随时应对', 'reactive')] : []))
  const rows = d.skills.map((k) => {
    const u = landingOf(d.type, k.id)
    const mul = u?.power && typeof u.power === 'object' && 'mul' in u.power ? u.power.mul ?? 1 : 0
    const last = phases[phases.length - 1]
    return [
      `<b>${esc(say(k.name))}</b>`, usedIn(k.id) || '—',
      esc(T(ctx, '形状', k.shape)), esc(T(ctx, '瞄准', k.aim)), cells(k.radius),
      mul ? `${Math.round(d.atk * mul)}${par(L(`攻击 ×${mul}`, `attack ×${mul}`))}` : '—', mul && (last.powerMul ?? 1) !== 1 ? String(Math.round(d.atk * mul * (last.powerMul ?? 1))) : '—',
      secs(k.windup), secs(k.recovery ?? 0),
      join([u?.coat ? ctx.link('状态', say(ctx.g.ontology.statuses?.[u.coat]?.name) || u.coat) : '', u?.push ? L(`击退 ${u.push} 格`, `knocks back ${cells(u.push)}`) : '', u?.pull ? L('拉近', 'pulls in') : '', k.move === 'blink' ? L('瞬移到目标旁', 'blinks beside the target') : '', k.then ? `${L('接着：', 'then: ')}${esc(say(d.skills.find((s) => s.id === k.then)?.name ?? ''))}` : '', u?.leave ? L('留下东西', 'leaves something behind') : '']),
    ]
  })
  return table([L('技能', 'Skill'), L('何时', 'When'), L('形状', 'Shape'), L('瞄准', 'Aim'), L('半径', 'Radius'), L('伤害（挑战）', 'Damage (challenge)'), L('末阶段伤害', 'Final-phase damage'), L('前摇', 'Wind-up'), L('后摇', 'Recovery'), L('效果', 'Effects')], rows)
}

/** A creature kind's own skills (the kits module, content kits.ts): the nearest kit its type or an ancestor names. */
function creatureSkills(ctx: Ctx, c: CreatureEnt): string {
  const kits = (ctx.g.ontology as { kits?: Record<string, CreatureSkill[]> }).kits ?? {}
  let kit: CreatureSkill[] | undefined
  for (let t = c.id; t && !kit; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : '') kit = kits[t]
  if (!kit?.length) return `<p class="empty">${L('没有自己的技能：只会普通攻击。', 'No skills of its own: only plain attacks.')}</p>`
  const move = (k: CreatureSkill) => join([k.move === 'leap' ? L('跳到目标处', 'leaps to the target') : k.move === 'dash' ? L('沿直线冲过去', 'dashes in a straight line') : k.move === 'blink' ? L('瞬移到目标旁', 'blinks beside the target') : L('原地', 'stays put'), k.back ? L(`命中后后跳 ${k.back} 格`, `hops back ${cells(k.back)} after a hit`) : ''])
  const before = (k: CreatureSkill) => kit!.find((o) => o.then === k.id)
  const when = (k: CreatureSkill) => {
    // a skill whose range never holds is only ever the next of a chain (the cyclops's aftershock)
    if (k.range && k.range[1] === 0) return before(k) ? L(`只接在「${esc(say(before(k)!.name))}」后面`, `only after “${esc(say(before(k)!.name))}”`) : '—'
    return join([!k.range ? L('首领战轮到它时', 'when its turn comes in a boss fight') : k.range[0] === k.range[1] ? L(`相距 ${k.range[0]} 格`, `${cells(k.range[0])} away`) : L(`相距 ${k.range[0]}–${k.range[1]} 格`, `${k.range[0]}–${k.range[1]} cells away`), k.aligned ? L('同一行或同一列', 'in the same row or column') : '', k.below !== undefined ? L(`生命低于 ${Math.round(k.below * 100)}%`, `below ${Math.round(k.below * 100)}% health`) : '', k.chance !== undefined && k.chance < 1 ? L(`每秒 ${Math.round(k.chance * 100)}% 几率`, `${Math.round(k.chance * 100)}% chance a second`) : '', k.steady ? L('被控制也不会打断', 'not interrupted by crowd control') : ''])
  }
  const marks = (k: CreatureSkill) => (k.radius ? [esc(T(ctx, '形状', k.shape)), cells(k.radius), esc(T(ctx, '瞄准', k.aim))].join(L('，', ', ')) : L('不标格子', 'marks no cells'))
  const next = (k: CreatureSkill) => (k.then ? L(`，接着放「${esc(say(kit!.find((o) => o.id === k.then)?.name ?? k.then))}」`, `, then “${esc(say(kit!.find((o) => o.id === k.then)?.name ?? k.then))}”`) : '')
  const rows = kit.map((k) => [`<b>${esc(say(k.name))}</b>`, when(k), marks(k), move(k) + next(k), secs(k.windup), k.cooldown ? secs(k.cooldown) : '—'])
  return table([L('技能', 'Skill'), L('什么时候用', 'When'), L('标记的格子', 'Marked cells'), L('怎么过去', 'Movement'), L('前摇', 'Wind-up'), L('冷却', 'Cooldown')], rows)
}

function mapView(ctx: Ctx, m: MapEnt): string {
  const W = m.map.width, H = m.map.height
  const pins: string[] = []
  const pin = (x: number, y: number, html: string, title: string, cls: string) =>
    pins.push(`<span class="pin ${cls}" style="left:${((x + 0.5) / W) * 100}%;top:${((y + 0.5) / H) * 100}%" title="${escapeAttr(title)}">${html}</span>`)
  for (const p of ctx.g.people) if (p.entity.place.on === 'tile' && p.entity.place.map === m.id) pin(p.entity.place.x, p.entity.place.y, `<a href="${linkHref(p.title)}"></a>`, p.name, 'person hot')
  for (const e of m.entities) {
    if (e.place.on !== 'tile') continue
    if (e.type.startsWith('actor/creature/')) {
      const c = ctx.g.entOfType(e.type)
      if (c) pin(e.place.x, e.place.y, `<a href="${linkHref(c.title)}"></a>`, c.name, 'creature hot')
    } else if (e.type === 'fixture/sacred/waypoint') pin(e.place.x, e.place.y, '◆', L('传送雕像', 'Waypoint statue'), 'waypoint')
  }
  const seen = new Set<string>()
  for (const p of m.map.portals ?? []) {
    if (seen.has(p.to)) continue
    seen.add(p.to)
    const to = say(p.label) || p.to
    pin(p.x, p.y, '➜', L(`通往${to}`, `To ${to}`), 'portal')
  }
  const caption = L(
    `${esc(m.name)}（${W} × ${H} 格），世界开始时的样子。人物和生物画在开局的位置，鼠标移上去显示名字、点击打开页面；◆ 是传送雕像，➜ 是出口。`,
    `${esc(m.name)} (${W} × ${H} cells) as the world begins. People and creatures are drawn where they start: hover for a name, click to open the page; ◆ is a waypoint statue, ➜ an exit.`,
  )
  return `<figure class="mapview"><div class="mapbox" style="aspect-ratio:${W}/${H}"><img src="/wiki/_/maps/${m.id}.png" alt="${escapeAttr(L(`${m.name}地形图`, `Terrain map of ${m.name}`))}">${pins.join('')}</div><figcaption>${caption}</figcaption></figure>`
}

function mapPeople(ctx: Ctx, m: MapEnt): string {
  const ids = [...(idx(ctx.g).mapPeople.get(m.id) ?? [])]
  if (!ids.length) return `<p class="empty">${L('没有人住在这里。', 'No one lives here.')}</p>`
  return `<ul class="gallery">${ids.map((id) => { const p = ctx.g.byId.get(id) as PersonEnt; return `<li>${fit(p.face, 48, 'face')}${ctx.link(p.title, p.name)}<small>${p.home === m.id ? L('住在这里', 'lives here') : L('按日程来这里', 'comes by on schedule')}</small></li>` }).join('')}</ul>`
}

function mapCreatures(ctx: Ctx, m: MapEnt): string {
  const rows: string[][] = []
  const counts = new Map<string, number>()
  for (const e of m.entities) if (e.type.startsWith('actor/creature/') && e.place.on === 'tile') counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  for (const [t, n] of counts) rows.push([typeLink(ctx, t), L(`开局 ${n} 只`, `${n} at the start`)])
  for (const a of m.map.appear ?? []) for (const t of Object.keys(a.types)) if (t.startsWith('actor/')) rows.push([typeLink(ctx, t), L(`每 ${secs(a.every)} 可能再出现一只，最多 ${a.max} 只${a.night ? '（夜里）' : ''}`, `May reappear every ${secs(a.every)}, up to ${a.max}${a.night ? ' (at night)' : ''}`)])
  const night = (ctx.g.ontology.appear ?? []).filter((a: any) => (!a.where?.zone || a.where.zone === (m.map.zone ?? 'combat')) && (!a.where?.light || a.where.light === (m.map.light ?? 'outdoor')))
  for (const a of night) rows.push([Object.keys(a.types).map((t) => typeLink(ctx, t)).join(' '), L(`${ctx.link('夜行生物')}：入夜后出现，最多 ${a.max} 只，天亮消失`, `${ctx.link('夜行生物')}: out at nightfall, up to ${a.max}, gone at daybreak`)])
  return table([L('生物', 'Creature'), L('数量', 'Numbers')], rows)
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
  const growth = (m.map.appear ?? []).flatMap((a: any) => Object.keys(a.types).filter((t) => !t.startsWith('actor/')).map((t) => `${typeLink(ctx, t)}${par(L(`最多 ${a.max}，每 ${secs(a.every)} 一份`, `up to ${a.max}, one every ${secs(a.every)}`))}`))
  const none = `<p class="empty">${L('无', 'None')}</p>`
  return `<h4>${L('物品', 'Items')}</h4>${items.size ? `<p class="chips">${[...items].map(([t, n]) => typeLink(ctx, t, { count: n })).join(' ')}</p>` : none}`
    + `<h4>${L('设施与摆设', 'Fixtures and furnishings')}</h4>${fixtures.size ? `<p class="chips">${[...fixtures].sort((a, b) => b[1] - a[1]).map(([t, n]) => typeLink(ctx, t, { count: n })).join(' ')}</p>` : none}`
    + (growth.length ? `<h4>${L('会自己长出来的', 'Grows by itself')}</h4><p class="chips">${growth.join(' ')}</p>` : '')
}

function mapLinks(ctx: Ctx, m: MapEnt): string {
  const by = new Map<string, { label: string; n: number; x: number; y: number }>()
  for (const p of m.map.portals ?? []) {
    const k = p.to
    if (!by.has(k)) by.set(k, { label: say(p.label), n: 0, x: p.x, y: p.y })
    by.get(k)!.n++
  }
  const side = (x: number, y: number) => (x === 0 ? L('西边', 'West edge') : x === m.map.width - 1 ? L('东边', 'East edge') : y === 0 ? L('北边', 'North edge') : y === m.map.height - 1 ? L('南边', 'South edge') : L(`地图内 (${x}, ${y})`, `Inside the map (${x}, ${y})`))
  const rows = [...by].map(([to, v]) => [mapLink(ctx, to), side(v.x, v.y), L(`${v.n} 格宽`, `${cells(v.n)} wide`)])
  return table([L('通往', 'Leads to'), L('位置', 'Position'), L('出口', 'Exit')], rows)
}

function questGoals(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  return `<ol class="goals">${(d.objectives ?? []).map((o) => {
    const c = o.count
    const at = c && 'kill' in c && c.map ? par(mapLink(ctx, c.map)) : ''
    const detail = c && 'kill' in c ? L(`打倒 ${selectorWords(ctx, d, c.kill, o.need ?? 1)}${at}`, `Defeat ${selectorWords(ctx, d, c.kill, o.need ?? 1)}${at}`)
      : c && 'carry' in c ? L(`带着 ${selectorWords(ctx, d, c.carry, o.need ?? 1)}`, `Carry ${selectorWords(ctx, d, c.carry, o.need ?? 1)}`)
        : c && 'fact' in c ? L(`${esc(T(ctx, '条件', `fact:${c.fact}`))}达到 ${o.need ?? 1}`, `${esc(T(ctx, '条件', `fact:${c.fact}`))} reaches ${o.need ?? 1}`)
          : o.talk && typeof o.target === 'string' && !o.on ? L(`和${aliasWords(ctx, d, o.target)}说话`, `Talk to ${aliasWords(ctx, d, o.target)}`)
            : o.on ? triggerWords(ctx, o.on, d)
              : L('剧情推进到这一步', 'The story reaches this point')
    return `<li><b>${esc(fill(ctx, d, o.text))}</b>${o.optional ? L('（可选）', ' (optional)') : ''}<br><small>${detail}</small></li>`
  }).join('')}</ol>`
}

/** The quest's stages, as the journal logs them (docs/quests.md §2.5): each line in order, how it ends. */
function questStages(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  const rows = d.stages.filter((s) => s.log).map((s) => [String(s.n), esc(fill(ctx, d, s.log)), s.on ? triggerWords(ctx, s.on, d) : L('任务开始', 'The quest begins'), s.complete ? L('完成', 'Completes') : s.failed ? L('失败', 'Fails') : ''])
  return rows.length ? table([L('阶段', 'Stage'), L('日志', 'Journal'), L('什么时候', 'When'), ''], rows) : `<p class="empty">${L('这个任务没有日志。', 'This quest has no journal entries.')}</p>`
}

function questReward(ctx: Ctx, q: QuestEnt): string {
  const r = questRewards(q.def)
  const out: string[] = []
  if (r?.xp) out.push(`<li>${L('经验', 'Experience')} +${r.xp}${par(ctx.link('等级与经验'))}</li>`)
  for (const it of r?.items ?? []) out.push(`<li>${rewardItem(ctx, it)}</li>`)
  return out.length ? `<ul class="facts">${out.join('')}</ul>` : `<p class="empty">${L('没有物品奖励。', 'No item rewards.')}</p>`
}

function questTalk(ctx: Ctx, q: QuestEnt): string {
  const d = q.def
  const giverId = questGiver(d)
  const giver = ctx.g.byId.get(giverId ?? '') as PersonEnt | undefined
  const person = (alias?: string) => (ctx.g.byId.get(d.aliases?.[alias ?? '']?.id ?? '') as PersonEnt | undefined) ?? giver
  const line = (label: string, t?: Text, who = giver) => (t && say(t) ? `<div class="dlg"><div class="dlg-key">${label}</div><blockquote class="line">${fit(who?.face, 32, 'face')}<span>${quot(esc(fill(ctx, d, t)))}</span></blockquote></div>` : '')
  const talks = (d.objectives ?? []).filter((o) => o.say).map((o) => {
    const a = typeof o.target === 'string' ? o.target : undefined
    const whom = a ? fill(ctx, d, `{${a}}`) : giver?.name ?? ''
    return line(L(`和${whom}说话时`, `When talking to ${whom}`), o.say, person(a))
  })
  const stages = d.stages.filter((s) => s.say).map((s) => line(s.complete ? L('交付时', 'On handing in') : L(`第 ${s.n} 阶段`, `Stage ${s.n}`), s.say, person(s.by)))
  const parts = [line(L('提出委托时', 'When offering'), d.offer), line(L('接受时', 'On accepting'), d.accepted), line(L('拒绝时', 'On declining'), d.declined), line(L('还没完成时', 'While unfinished'), d.waiting), ...talks, ...stages].filter(Boolean)
  return parts.join('') || `<p class="empty">${L('这个任务没有对话。', 'This quest has no dialogue.')}</p>`
}

// ------------------------------------------------------------------------------------------ lists

function itemTable(ctx: Ctx, cat: string, written: string, arg: string): string {
  const g = ctx.g
  let list: ItemEnt[]
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
  if (!list.length) { ctx.error(L(`{{${written}|${arg}}}：没有这一类`, `{{${written}|${arg}}}: no such category`)); return '' }
  // (the regions' goods are the base forms' variants: listed on their bases' pages and on 地区物产, not here)
  const regional = list.filter((e) => (e as ItemEnt).form?.origin).length
  list = list.filter((e) => !(e as ItemEnt).form?.origin)
  const note = regional ? `<p>${L(`另有 ${regional} 种各地的变体，列在各自的原型页面和${ctx.link('地区物产')}里。`, `Another ${regional} regional variants are listed on their base forms' pages and in ${ctx.link('地区物产')}.`)}</p>` : ''
  const rows = list.map((e) => [fit(e.sprite, 32), ctx.link(e.title, e.name), esc(e.groupName), itemStats(ctx, e, true).map(([k, v]) => `${k} ${v}`).join(L('，', ', ')) || '—', howToGet(ctx, e)])
  return table(['', L('名称', 'Name'), L('类别', 'Category'), L('属性', 'Stats'), L('获得', 'Obtained')], rows, 'wikitable sortable') + note
}

function howToGet(ctx: Ctx, e: ItemEnt): string {
  const I = idx(ctx.g)
  const ways: string[] = []
  if (e.recipe) ways.push(L('制作', 'Crafting'))
  if (e.placement) ways.push(L('建造', 'Building'))
  if ([...(ctx.g.placed.get(e.id) ?? [])].some(([m]) => ctx.g.mapOf(m))) ways.push(L('地图上', 'On maps'))
  if ((I.madeFrom.get(e.id) ?? []).length || (I.yields.get(e.id) ?? []).length) ways.push(L('采集/掉落', 'Gathering/drops'))
  if ((I.appearOn.get(e.id) ?? []).length) ways.push(L('地面产出', 'Grows from the ground'))
  if ((I.reward.get(e.id) ?? []).length) ways.push(L('任务奖励', 'Quest reward'))
  if ((I.carried.get(e.id) ?? []).length) ways.push(L('别人带着', 'Carried by others'))
  const rw = RULE_WAYS()
  for (const id of I.ruleMade.get(e.id) ?? []) if (rw[id]) ways.push(rw[id].way)
  if (offersOf(ctx.g, e.id).length) ways.push(L('货摊', 'Stall'))
  if (e.id === ctx.g.coin) ways.push(L('卖东西', 'Selling'))
  return ways.join(L('、', ', ')) || `<span class="muted">${L('目前拿不到', 'Not obtainable yet')}</span>`
}

function lists(ctx: Ctx, name: string, args: string[], written: string): string | undefined {
  const g = ctx.g
  const sep = L('、', ', ')
  switch (name) {
    case '物品表': return itemTable(ctx, argOf(name, args[0]) || '全部', written, args[0] ?? '')
    case '地区物产': return regionalGoods(ctx, args[0])
    case '居民表': return table(['', L('名字', 'Name'), L('身份', 'Role'), L('年龄', 'Age'), L('住在', 'Lives in'), L('任务', 'Quests')], g.people.map((p) => [fit(p.face, 40, 'face'), ctx.link(p.title, p.name), esc(p.roleName), p.age ? String(p.age) : '—', p.home ? mapLink(ctx, p.home) : p.kind === 'companion' ? L('跟着玩家', 'Follows the player') : L('只在剧情中', 'Story only'), String((idx(g).personQuests.get(p.id) ?? []).length || '—')]), 'wikitable sortable')
    case '怪物表': return table(['', L('名字', 'Name'), L('类别', 'Family'), L('生命', 'Health'), L('攻击', 'Attack'), L('防御', 'Defence'), L('元素', 'Element'), L('出没', 'Found in')], g.creatures.map((c) => {
      const where = join([...whereCreature(ctx, c.id).map((m) => mapLink(ctx, m)), ...bornOf(ctx, c.id).short])
      return [fit(c.sprite, 32), ctx.link(c.title, c.name), esc(c.groupName), String(c.props.maxHp ?? '—'), String(c.props.atk ?? '—'), String(c.props.def ?? 0), c.props.element ? T(ctx, '元素', String(c.props.element)) : '—', where === '—' ? `<span class="muted">${L('游戏里目前不会出现', 'Not in the game yet')}</span>` : where]
    }), 'wikitable sortable')
    // what every kind leaves, from its makeup at the world's recovery rate (the game's own numbers, never a copy)
    case '掉落表': {
      const r = g.ontology.params?.recovery ?? 0.5
      return table(['', L('怪物', 'Monster'), L('留下', 'Drops')], g.creatures.filter((c) => c.makeup.length).map((c) => [fit(c.sprite, 32), ctx.link(c.title, c.name), c.makeup.map((m) => typeLink(ctx, m.type, { count: Math.max(1, Math.floor(m.count * r)) })).join(sep)]), 'wikitable sortable')
    }
    case '首领表': return table(['', L('名字', 'Name'), L('印', 'Seal'), L('生命（挑战）', 'Health (challenge)'), L('技能', 'Skills'), L('在哪里打', 'Fought at')], g.bosses.map((b) => { const c = campaign(ctx, b); return [fit(b.sprite, 48), ctx.link(b.title, b.name), esc(b.seal ?? ''), String(b.def.hp), b.def.skills.map((s) => esc(say(s.name))).join(sep), c ? `${mapLink(ctx, c.map)}${sep}${ctx.link('首领挑战')}` : ctx.link('首领挑战')] }))
    case '地点表': return table([L('名称', 'Name'), L('类型', 'Type'), L('大小', 'Size'), L('区域', 'Zone'), L('相连', 'Connects to')], g.maps.map((m) => [ctx.link(m.title, m.name), esc(T(ctx, '地图类型', m.map.kind)), `${m.map.width}×${m.map.height}`, m.map.zone ? esc(T(ctx, '区域', m.map.zone)) : L('战斗区域', 'Combat zone'), join([...new Set((m.map.portals ?? []).map((p: any) => p.to))].map((t) => mapLink(ctx, t as string)))]), 'wikitable sortable')
    // the continent's regions and the backdrop's places in one (docs/continent.md): no page each, a row each
    case '地区表': {
      const regions = (g.index.regions ?? []) as { id: string; name: { zh?: string; en: string }; backdrop?: boolean }[]
      const sum = (r: string, k: 'rooms' | 'people' | 'goods') => g.backdrop.filter((p) => p.region === r).reduce((n, p) => n + p[k], 0)
      const n = (v: number) => v.toLocaleString('en')
      return table([L('地区', 'Region'), L('English', 'Chinese'), L('背景地点', 'Backdrop places'), L('房间', 'Rooms'), L('居民', 'Residents'), L('货物', 'Goods'), L('剧情', 'Story')], regions.map((r) => [ctx.has(zh(r.name)) ? ctx.link(zh(r.name)) : esc(say(r.name)), esc(L(r.name.en, zh(r.name))), n(g.backdrop.filter((p) => p.region === r.id).length), n(sum(r.id, 'rooms')), n(sum(r.id, 'people')), n(sum(r.id, 'goods')), r.backdrop ? `<span class="muted">${L('尚未开放', 'Not open yet')}</span>` : L('可玩', 'Playable')]), 'wikitable')
    }
    case '地区地点': {
      const region = args[0] ?? ''
      const KIND: Record<string, string> = { village: '村庄', town: '城镇', city: '城市', farm: '农庄', mill: '磨坊', camp: '营地', ruin: '遗迹', shrine: '神龛', cave: '洞窟', mine: '矿坑', tower: '塔', graveyard: '墓园', fort: '要塞', battlefield: '古战场', cathedral: '修道院', seat: '持印者之座' }
      const KIND_EN: Record<string, string> = { village: 'Village', town: 'Town', city: 'City', farm: 'Farm', mill: 'Mill', camp: 'Camp', ruin: 'Ruin', shrine: 'Shrine', cave: 'Cave', mine: 'Mine', tower: 'Tower', graveyard: 'Graveyard', fort: 'Fort', battlefield: 'Old battlefield', cathedral: 'Monastery', seat: "Seal-bearer's seat" }
      const places = g.backdrop.filter((p) => p.region === region)
      const n = (v: number) => (v ? v.toLocaleString('en') : '—')
      const rows = places.map((p) => [esc(p.name), esc(L(p.en, p.zh)), esc(L(KIND[p.kind] ?? p.kind, KIND_EN[p.kind] ?? p.kind)) + (p.depths ? L('（下有深处）', ' (with depths below)') : ''), `${p.width}×${p.height}`, n(p.rooms), n(p.households), n(p.people), n(p.goods)])
      const total = (k: 'rooms' | 'people' | 'goods') => places.reduce((s, p) => s + p[k], 0).toLocaleString('en')
      return rows.length
        ? `<p>${L(`${places.length} 个背景地点，${total('rooms')} 个房间，${total('people')} 位居民，${total('goods')} 件货物。`, `${places.length} backdrop places, ${total('rooms')} rooms, ${total('people')} residents, ${total('goods')} goods.`)}</p>${table([L('名称', 'Name'), L('English', 'Chinese'), L('种类', 'Kind'), L('大小', 'Size'), L('房间', 'Rooms'), L('住户', 'Households'), L('居民', 'Residents'), L('货物', 'Goods')], rows, 'wikitable sortable')}`
        : `<p class="muted">${L('这个地区还没有背景地点。', 'This region has no backdrop places yet.')}</p>`
    }
    case '任务表': {
      const kind = ({ 主线: 'main', 支线: 'side', 委托: 'favor', 指引: 'guide' } as Record<string, string>)[argOf(name, args[0])] ?? ''
      const qs = g.quests.filter((q) => !kind || q.def.kind === kind)
      return table([L('任务', 'Quest'), L('委托人', 'Giver'), L('目标', 'Objectives'), L('奖励', 'Rewards')], qs.map((q) => { const r = questRewards(q.def); const giver = questGiver(q.def); return [ctx.link(q.title, q.name), giver ? personLink(ctx, giver) : 'news' in q.def.start ? L('随机', 'Radiant') : '—', (q.def.objectives ?? []).filter((o) => o.id !== 'back').map((x) => esc(say(x.text))).join('<br>'), [r.xp ? `${L('经验', 'Experience')} +${r.xp}` : '', ...(r.items ?? []).map((it) => rewardItem(ctx, it))].filter(Boolean).join('<br>') || '—'] }))
    }
    case '货摊表': {
      // the stall's shelves (content homestead.ts): one shelf, the three that sell (买), what it buys back (出售), or all
      const want = argOf(name, args[0])
      const groups = want === '买' ? ['farm', 'ranch', 'fish'] : want ? Object.keys(SHELF).filter((k) => SHELF[k] === want) : Object.keys(SHELF)
      if (!groups.length) { ctx.error(L(`{{${written}|${args[0]?.trim()}}}：没有这一栏（农业、牧业、渔业、出售、买）`, `{{${written}|${args[0]?.trim()}}}: no such shelf (farm, ranch, fish, sell, buy)`)); return '' }
      const buy = g.shop.filter((r) => r.group !== 'sell' && groups.includes(r.group ?? ''))
      const sell = g.shop.filter((r) => r.group === 'sell' && groups.includes('sell'))
      const thing = (type: string) => { const e = g.entOfType(type); return [fit(e?.sprite, 32), typeLink(ctx, type, { icon: 0 })] }
      return (buy.length ? table(['', L('东西', 'Item'), L('货架', 'Shelf'), L('一次买', 'Bundle'), L('价格', 'Price'), L('每个约', 'Each (approx.)')], buy.map((r) => [...thing(String((r.make as any).type)), shelfName(r.group ?? ''), L(`${r.count ?? 1} 个`, String(r.count ?? 1)), coins(ctx, priceOf(r)), `${+(priceOf(r) / (r.count ?? 1)).toFixed(1)}`]), 'wikitable sortable') : '')
        + (sell.length ? table(['', L('东西', 'Item'), L('卖一个得', 'Sells for')], sell.map((r) => [...thing(r.needs[0].type), coins(ctx, r.count ?? 1)]), 'wikitable sortable') : '')
    }
    case '配方表': return table(['', L('名称', 'Name'), L('材料', 'Ingredients'), L('工具（不消耗）', 'Tools (not used up)'), L('地点', 'Station'), L('等级', 'Level'), L('产量', 'Yield')], g.recipes.map((r) => { const e = g.entOfType(String((r.make as any).type)); return [fit(e?.sprite, 32), e ? ctx.link(e.title, say(r.name) || e.name) : esc(say(r.name)), r.needs.map((n) => typeLink(ctx, n.type, { count: n.count })).join(' '), join((r.tools ?? []).map(toolName)), stationCell(ctx, r.station), String(r.level ?? 1), `×${r.count ?? 1}`] }), 'wikitable sortable')
    case '建造表': {
      const rows = g.placements.map((p) => { const e = p.result ? g.entOfType(String(p.result)) : undefined; return [fit(e?.sprite ?? (p.sprite.startsWith('item:') ? g.items.find((i) => i.form?.sprite === p.sprite)?.sprite : undefined), 32), e ? ctx.link(e.title, say(p.name)) : esc(say(p.name)), p.category === 'building' ? L('建筑', 'Building') : L('种植', 'Planting'), p.needs.map((n) => `${esc(say(n.name))}×${n.count}${n.consume ? '' : L('（工具）', ' (tool)')}`).join(sep), esc(say(p.description))] })
      const structures = g.structures.map((s) => ctx.link(s.title, s.name)).join(sep)
      return table(['', L('名称', 'Name'), L('分页', 'Tab'), L('需要', 'Needs'), L('说明', 'Description')], rows)
        + `<p>${L(`另外，身上带着或能现做的${structures}、${ctx.link('床')}、${ctx.link('工作台')}也会出现在建筑分页里（见${ctx.link('楼层')}）。`, `The Building tab also offers, when you carry them or can make them on the spot: ${structures}, ${ctx.link('床')} and ${ctx.link('工作台')} (see ${ctx.link('楼层')}).`)}</p>`
    }
    case '技能树': {
      // a branch or a profession by its id or its name in either language
      const key = args[0]?.trim() ?? ''
      const named = (x: { id: string; name: Text }) => x.id === key || zh(x.name) === key || enOf(x.name).toLowerCase() === key.toLowerCase()
      const branch = g.branches.find(named)
      const prof = g.professions.find(named)
      const list = prof ? g.skills.filter((s) => s.profession === prof.id) : branch ? g.skills.filter((s) => s.branch === branch.id && !s.profession) : []
      if (!branch && !prof) { ctx.error(L(`{{${written}|${key}}}：没有这个分支或职业`, `{{${written}|${key}}}: no such branch or profession`)); return '' }
      if (!list.length) return `<p class="empty">${L('这个分支还没有技能（游戏里显示「技能待设计」）。', 'This branch has no skills yet (the game shows “Skills to be designed”).')}</p>`
      const nameOf = (id: string) => say(g.skills.find((s) => s.id === id)?.name) || id
      return table(['', L('技能', 'Skill'), L('前置', 'Requires'), L('点数', 'Points'), L('类型', 'Type'), L('效果', 'Effect')], list.map((s) => [fit(iconOf(s.icon), 40), `<b id="${escapeAttr(skillAnchor(say(s.name)))}">${esc(say(s.name))}</b>`, join((s.requires ?? []).map(nameOf)), String(s.cost ?? 1), s.active ? L('主动', 'Active') : s.ability ? L('能力', 'Ability') : L('加成', 'Bonus'), esc(say(s.doc))]))
    }
    case '职业表': return table(['', L('职业', 'Profession'), L('说明', 'Description'), L('起始装备', 'Starting gear')], g.professions.map((p) => [fit(iconOf(p.icon), 40), ctx.link(say(p.name)), esc(say(p.doc)), join([p.weapon, (p as any).offhand].filter(Boolean).map((w: any) => `${typeLink(ctx, w.type)}${par(esc(say(w.name)))}`))]))
    case '恩赐表': return table([L('恩赐', 'Boon'), L('效果', 'Effect'), L('来源', 'Source')], g.boons.map((b: any) => [`<b>${esc(say(b.name))}</b>`, esc(say(b.doc ?? b.text ?? b.description) || JSON.stringify(b.lead ?? {})), b.from ? esc(String(b.from)) : ctx.link('白骑士·阿尔贝里克')]))
      + `<p>${L('五个位置里其余四个目前是封印的（待设计）。', 'The other four of the five slots are sealed for now (to be designed).')}</p>`
    case '状态表': {
      const st = (c: string) => say(g.ontology.statuses?.[c]?.name) || c
      return table([L('状态', 'Status'), L('持续', 'Duration'), L('效果', 'Effect')], g.statuses.map((s) => [`<b>${esc(say(s.name))}</b>`, s.duration ? secs(s.duration) : L('一直持续，直到被解除', 'Until removed'), join([s.immobilize ? L('不能行动', 'cannot act') : '', s.clears?.length ? L(`解除${s.clears.map(st).join('、')}`, `removes ${s.clears.map(st).join(', ')}`) : '', s.wards?.length ? L(`防止${s.wards.map(st).join('、')}`, `prevents ${s.wards.map(st).join(', ')}`) : '', (s as any).every ? L(`每 ${secs((s as any).every)} 生效一次`, `takes effect every ${secs((s as any).every)}`) : '', (s as any).moveDelay ? L(`移动慢 ${(s as any).moveDelay} 倍`, `moves ${(s as any).moveDelay}× slower`) : '', s.props?.resFire ? L(`火焰抗性 ${s.props.resFire}%`, `fire resistance ${s.props.resFire}%`) : '', s.pose ? L(`画成${POSE_ZH[s.pose] ?? s.pose}的姿势`, `drawn ${s.pose === 'lie' ? 'lying' : s.pose === 'sit' ? 'sitting' : s.pose === 'kneel' ? 'kneeling' : 'leaning'}`) : '', s.untilMove ? L('一走动就结束', 'ends as one moves on') : ''])]), 'wikitable sortable')
    }
    case '元素表': return table([L('元素', 'Element'), L('武器名缀', 'Weapon affix'), L('代码', 'Code')], ELEMENTS.map((el) => [esc(T(ctx, '元素', el)), esc(say(ELEMENT_NAMES[el])), `<code>${el}</code>`]))
    case '地形表': return table(['', L('地形', 'Terrain'), L('性质', 'Properties'), L('耐久', 'Durability'), L('打坏后留下', 'Leaves when broken')], g.terrains.map((t) => [`<span class="swatch" style="background:${t.color ?? '#999'}"></span>`, `<b>${esc(say(t.name))}</b>`, join([t.solid ? L('挡路', 'solid') : L('可通行', 'passable'), t.liquid ? L('液体', 'liquid') : '', (t.tags ?? []).includes('flammable') ? L('可燃', 'flammable') : '', (t.tags ?? []).includes('slippery') ? L('滑', 'slippery') : '', (t.tags ?? []).includes('diggable') ? L('可开垦', 'tillable') : '', (t.tags ?? []).includes('overworld') ? L('大地图', 'world map') : '']), t.props?.maxHp ? String(t.props.maxHp) : L('打不坏', 'Unbreakable'), join((t.makeup ?? []).map((m) => typeLink(ctx, m.type, { count: m.count })))]), 'wikitable sortable')
    case '材质表': return table([L('材质', 'Material'), L('攻击系数', 'Attack ×'), L('防御系数', 'Defence ×'), L('价值系数', 'Value ×'), L('类别', 'Category'), L('硬度', 'Hardness')], Object.values(MATERIALS).map((m) => [`<span class="swatch" style="background:${m.color}"></span> ${esc(say(m))}`, `×${m.attack}`, `×${m.defence}`, `×${m.value}`, esc(m.category), String(m.hardness)]), 'wikitable sortable')
    case '品质表': {
      const HOW: Record<string, [string, string]> = {
        crude: ['制作者等级低于配方等级', "Crafter's level below the recipe's"], common: ['制作者等级达到配方等级', "Crafter's level at the recipe's"],
        fine: ['制作者等级比配方高 3 级以上', "Crafter's level 3 or more above the recipe's"], masterwork: ['制作者等级比配方高 6 级以上', "Crafter's level 6 or more above the recipe's"],
        vowed: ['只能找到，不能制作', 'Only found, never made'], legendary: ['只有持印者才有，不能制作', 'Only the Seal-bearers have them; never made'],
      }
      return table([L('品质', 'Quality'), L('攻防系数', 'Attack/defence ×'), L('怎么得到', 'How obtained')], QUALITIES.map((q) => [`<b class="q-${q.id}">${esc(say(q) || L('普通', 'Common'))}</b>`, `×${q.factor}`, HOW[q.id] ? L(...HOW[q.id]) : '']))
    }
    case '装备栏表': return table([L('部位', 'Slot'), L('可穿戴', 'Worn')], Object.entries(ctx.tr['装备栏'] ?? {}).map(([slot, name]) => [esc(name), join(g.items.filter((e) => e.props.slot === slot).map((e) => entLink(ctx, e)), ' ')]))
    case '作物表': {
      const crops = g.fixtures.filter((f) => f.group === '作物' && f.id.split('/').length === 3)
      // what the produce feeds, and the stall's prices: its seeds (count for price) and one of the produce bought back
      const food = (t?: string) => { const e = t ? g.byId.get(t) as ItemEnt | undefined : undefined; return e && feeds(e) ? `+${e.props.food}` : '—' }
      const seedPrice = (t?: string) => (t ? offersOf(g, t).map((r) => L(`${priceOf(r)} / ${r.count ?? 1} 个`, `${priceOf(r)} for ${r.count ?? 1}`)).join('<br>') : '') || '—'
      const sellPrice = (t?: string) => { const r = t ? buysBack(g, t) : undefined; return r ? String(r.count ?? 1) : '—' }
      return table(['', L('作物', 'Crop'), L('每阶段（游戏小时）', 'Per stage (in-game hours)'), L('产物', 'Produce'), L('饱食度', 'Hunger'), L('种子', 'Seeds'), L('收获后', 'After harvest'), `${L('种子价', 'Seed price')}${par(ctx.link(g.typeName(g.coin)))}`, L('产物卖价', 'Produce sells for')], crops.map((c) => [fit(c.sprite, 32), ctx.link(c.title, c.name), String(c.props.growHours ?? 2), c.props.yieldType ? typeLink(ctx, String(c.props.yieldType)) : '—', food(c.props.yieldType), c.props.seedType ? typeLink(ctx, String(c.props.seedType)) : '—', c.props.regrowType ? L('重新长回幼株', 'Grows back from a sprout') : c.type.tags?.includes('perennial') ? L('重新长回', 'Grows back') : L('没了', 'Gone'), seedPrice(c.props.seedType), sellPrice(c.props.yieldType)]), 'wikitable sortable')
    }
    case '食物表': return table(['', L('食物', 'Food'), L('饱食度', 'Hunger'), L('获得', 'Obtained')], g.items.filter(feeds).sort((a, b) => b.props.food - a.props.food).map((e) => [fit(e.sprite, 32), ctx.link(e.title, e.name), `+${e.props.food}`, howToGet(ctx, e)]), 'wikitable sortable')
    case '传送雕像表': return table([L('传送雕像', 'Waypoint statue'), L('所在地点', 'Location')], g.waypoints.map((w) => [`◆ ${esc(say(w.name))}`, mapLink(ctx, w.map)]))
    case '配乐表': return table([L('地点', 'Location'), L('音乐', 'Music')], g.maps.map((m) => [mapLink(ctx, m.id), m.map.music ? esc(`${T(ctx, '音乐', String(m.map.music).toLowerCase())}${par(m.map.music)}`) : '—']))
    case '效率表': {
      const cats = ['wood', 'plant', 'stone', 'ore', 'soil', 'flesh', 'bone', 'crystal']
      const cz: Record<string, string> = { wood: '木', plant: '植物', stone: '石', ore: '矿', soil: '土', flesh: '血肉/皮毛', bone: '骨', crystal: '晶' }
      const ce: Record<string, string> = { wood: 'Wood', plant: 'Plant', stone: 'Stone', ore: 'Ore', soil: 'Soil', flesh: 'Flesh/hide', bone: 'Bone', crystal: 'Crystal' }
      const rz: Record<string, string> = { 'tool:axe': '斧', 'tool:pickaxe': '镐', 'tool:shovel': '铲', 'tool:hammer': '锤', 'edge:cut': '刃（砍）', 'edge:blunt': '钝（砸）', 'edge:pierce': '尖（刺）', 'edge:dig': '挖', 'edge:magic': '法术' }
      const re: Record<string, string> = { 'tool:axe': 'Axe', 'tool:pickaxe': 'Pickaxe', 'tool:shovel': 'Shovel', 'tool:hammer': 'Hammer', 'edge:cut': 'Edge (cut)', 'edge:blunt': 'Blunt (smash)', 'edge:pierce': 'Point (pierce)', 'edge:dig': 'Dig', 'edge:magic': 'Magic' }
      return table([L('器具', 'Tool'), ...cats.map((c) => L(cz[c], ce[c]))], Object.entries(EFFICIENCY).map(([k, row]) => [esc(L(rz[k] ?? k, re[k] ?? k)), ...cats.map((c) => String(row[c] ?? '—'))]))
    }
    case '房间用途表': return table([L('用途', 'Use'), L('条件', 'Condition'), L('效果', 'Effect')], (g.ontology.roomRoles ?? []).map((r: any) => [
      esc(T(ctx, '房间用途', r.role)),
      r.needs.type ? L(`里面有${typeLink(ctx, r.needs.type)}`, `Holds ${typeLink(ctx, r.needs.type)}`) + (r.count ? ` ×${r.count}` : '')
        : L(`里面有带「${r.needs.tags?.join('、')}」的东西（如${ctx.link('营火')}、${ctx.link('壁炉')}）`, `Holds something tagged “${r.needs.tags?.join(', ')}” (such as ${ctx.link('营火')} or ${ctx.link('壁炉')})`),
      r.props?.rest ? L(`在这里睡觉恢复损失生命的 ${r.props.rest * 100}%`, `Sleeping here restores ${r.props.rest * 100}% of lost health`) : L('目前只是标签', 'Only a label for now'),
    ]))
    case '夜行生物表': return table([L('生物', 'Creature'), L('权重', 'Weight'), L('上限', 'Cap'), L('间隔', 'Interval'), L('在哪里', 'Where')], (g.ontology.appear ?? []).flatMap((a: any) => Object.entries(a.types).map(([t, w]) => [typeLink(ctx, t), `${Math.round(Number(w) * 100)}%`, String(a.max), secs(a.every), L(`${a.where?.zone === 'combat' ? '战斗区域' : '所有区域'}、${a.where?.light === 'outdoor' ? '室外地图' : '所有地图'}，入夜后`, `${a.where?.zone === 'combat' ? 'Combat zones' : 'All zones'}, ${a.where?.light === 'outdoor' ? 'outdoor maps' : 'all maps'}, after nightfall`)])))
    case '传说武器表': return table([L('职业', 'Profession'), L('传说武器', 'Legendary weapon'), L('圣痕之力', 'Stigma power')], Object.entries(LEGENDARY_ARMS).flatMap(([prof, arms]) => arms.map((t) => { const e = g.byId.get(t) as ItemEnt | undefined; return [ctx.link(say(g.professions.find((p) => p.id === prof)?.name) || prof), entLink(ctx, e) || esc(t), e?.relic ? `<b>${esc(e.relic.name)}</b>${L('：', ': ')}${esc(e.relic.text)}` : '—'] })))
    case '圣痕之力表': return table([L('圣痕之力', 'Stigma power'), L('效果', 'Effect'), L('持有它的', 'Held by')], Object.entries(RELICS).map(([id, r]) => [`<b>${esc(say(r))}</b>`, esc(say(r.text)), join(g.items.filter((e) => e.props.relic === id).map((e) => entLink(ctx, e)))]))
    case '誓言表': return table([L('誓言', 'Vow'), L('效果', 'Effect')], Object.values(VOWS).map((v) => [`<b>${esc(say(v))}</b>`, esc(say(v.text))]))
    case '版本历史': return table([L('日期', 'Date'), L('合并', 'PR'), L('内容', 'Change')], ctx.history.map((h) => [h.date, `<a href="https://github.com/SihanXU/symbolic-world/pull/${h.pr}">#${h.pr}</a>`, esc(h.title)]))
    case '数值表': return ctx.values()
    case '门户': return ctx.portal()
  }
  return undefined
}

const iconOf = (icon?: string): Sprite => ({ url: `/assets/lsw/skills/${icon ?? 'origin'}.png`, x: 0, y: 0, w: 32, h: 32, iw: 32, ih: 32 })
/** The id a skill's row carries in {{技能树}}, and {{技能}} links to: by its name in the edition. */
const skillAnchor = (name: string) => `${L('技能-', 'skill-')}${name}`

// ------------------------------------------------------------------------------------------ navboxes

export function navbox(ctx: Ctx, name: string): string {
  const g = ctx.g
  const rows: [string, string][] = []
  const links = (es: Ent[]) => es.map((e) => ctx.link(e.title, e.name)).join(' • ')
  const titled = (ts: string[]) => ts.map((t) => ctx.link(t)).join(' • ')
  /** Things by their group (a stable key), each row headed by the group as the edition names it. */
  const byGroup = (es: Ent[]) => {
    const by = new Map<string, Ent[]>()
    for (const e of es) { if (!by.has(e.group)) by.set(e.group, []); by.get(e.group)!.push(e) }
    for (const [, xs] of by) rows.push([esc(xs[0].groupName), links(xs)])
  }
  switch (name) {
    case '居民': {
      const by = new Map<string, Ent[]>()
      for (const p of g.people) { const k = p.home ?? (p.kind === 'companion' ? '同伴' : '只在剧情中'); if (!by.has(k)) by.set(k, []); by.get(k)!.push(p) }
      const label = (k: string) => (k === '同伴' ? L('同伴', 'Companions') : k === '只在剧情中' ? L('只在剧情中', 'Story only') : k)
      for (const [k, es] of by) rows.push([g.mapOf(k) ? mapLink(ctx, k) : esc(label(k)), links(es)])
      break
    }
    case '物品': {
      // (the regions' goods by their regions, not one by one: they are a thousand)
      byGroup(g.items.filter((x) => !x.form?.origin))
      rows.push([groupName('建筑件'), links(g.structures)])
      if (ctx.has('地区物产')) rows.push([ctx.link('地区物产'), REGIONS.map((r) => regionLink(ctx, r.id)).join(' • ')])
      rows.push([L('分类', 'Categories'), titled(['物品', '武器', '工具', '防具', '饰品', '食物', '材料', '种子', '建筑件', '家具与设施', '剧情物品', '文书', '材质', '品质', '遗誓', '圣痕', '传说武器'].filter((t) => ctx.has(t)))])
      break
    }
    case '设施': byGroup(g.fixtures); break
    case '怪物': {
      byGroup(g.creatures)
      rows.push([groupName('首领'), links(g.bosses)])
      break
    }
    case '地点': {
      const by = new Map<string, Ent[]>()
      for (const m of g.maps) { const k = T(ctx, '地图类型', m.map.kind); if (!by.has(k)) by.set(k, []); by.get(k)!.push(m) }
      for (const [k, es] of by) rows.push([esc(k), links(es)])
      break
    }
    case '任务': {
      for (const k of ['main', 'side', 'favor', 'guide']) rows.push([questKind(k), links(g.quests.filter((q) => q.def.kind === k))])
      if (ctx.has('主线流程')) rows.push([L('攻略', 'Walkthrough'), ctx.link('主线流程')])
      break
    }
    default: {
      // a navbox of hand pages: every page that carries it, by directory
      const members = [...ctx.pages.values()].filter((p) => p.navboxes.has(name)).map((p) => p.title).sort((a, b) => a.localeCompare(b, lang()))
      if (!members.length) return ''
      rows.push(['', titled(members)])
    }
  }
  const head = ctx.has(name) ? ctx.link(name) : esc(name)
  return `<table class="navbox"><tr><th colspan="2" class="nb-title">${head}</th></tr>${rows.map(([h, v]) => `<tr>${h ? `<th>${h}</th><td>` : '<td colspan="2">'}${v}</td></tr>`).join('')}</table>`
}

// ------------------------------------------------------------------------------------------ the dispatcher

const BLOCK = new Set([
  '信息框', '引言', '小作品', '规划中', '待设计', '开发者', '主条目', '另见', '导航框', '日程表', '对话', '人际关系', '相关任务', '肖像', '来源', '用途', '配方', '变体',
  '出没', '掉落', '首领技能', '怪物技能', '地图', '相连地点', '居民', '生物', '物品分布', '任务目标', '任务奖励', '任务对话', '任务阶段', '物品表', '居民表', '怪物表', '掉落表', '首领表', '地点表', '任务表', '地区表', '地区地点',
  '配方表', '建造表', '技能树', '职业表', '恩赐表', '状态表', '元素表', '地形表', '材质表', '品质表', '装备栏表', '作物表', '食物表', '传送雕像表', '配乐表', '效率表',
  '房间用途表', '夜行生物表', '传说武器表', '圣痕之力表', '誓言表', '货摊表', '地区物产', '版本历史', '数值表', '门户', '原文', '图', '剧透',
])

/** The templates' English names (lower case, words by spaces) → the canonical Chinese ones: either works in either edition. */
export const TEMPLATE_EN: Record<string, string> = {
  key: '键', item: '物品', person: '人物', monster: '怪物', place: '地点', status: '状态', skill: '技能', value: '数值', image: '图',
  stub: '小作品', planned: '规划中', tbd: '待设计', dev: '开发者', main: '主条目', 'see also': '另见', quote: '引言', navbox: '导航框', original: '原文',
  infobox: '信息框', schedule: '日程表', dialogue: '对话', relationships: '人际关系', 'related quests': '相关任务', 'look parts': '外观部件', portrait: '肖像',
  sources: '来源', uses: '用途', recipe: '配方', variants: '变体', habitat: '出没', drops: '掉落', 'boss skills': '首领技能', 'monster skills': '怪物技能',
  map: '地图', connections: '相连地点', residents: '居民', creatures: '生物', 'map items': '物品分布', objectives: '任务目标', rewards: '任务奖励',
  'quest dialogue': '任务对话', stages: '任务阶段', spoiler: '剧透',
  'item table': '物品表', 'regional goods': '地区物产', 'resident table': '居民表', 'monster table': '怪物表', 'drop table': '掉落表', 'boss table': '首领表',
  'location table': '地点表', 'region table': '地区表', 'region places': '地区地点', 'quest table': '任务表', 'stall table': '货摊表', 'recipe table': '配方表',
  'building table': '建造表', 'skill tree': '技能树', 'profession table': '职业表', 'boon table': '恩赐表', 'status table': '状态表', 'element table': '元素表',
  'terrain table': '地形表', 'substance table': '材质表', 'quality table': '品质表', 'slot table': '装备栏表', 'crop table': '作物表', 'food table': '食物表',
  'waypoint table': '传送雕像表', 'music table': '配乐表', 'efficiency table': '效率表', 'room table': '房间用途表', 'night creature table': '夜行生物表',
  'legendary arms table': '传说武器表', 'stigma table': '圣痕之力表', 'vow table': '誓言表', 'version history': '版本历史', 'value table': '数值表', portal: '门户',
}

/** Keyword arguments in English (lower case) → the Chinese ones, by canonical template. */
export const ARG_EN: Record<string, Record<string, string>> = {
  物品表: {
    all: '全部', weapons: '武器', armour: '防具', armor: '防具', accessories: '饰品', 'light sources': '光源', 'story items': '剧情物品', structures: '建筑件',
    furniture: '家具', fixtures: '设施', containers: '容器', tools: '工具', food: '食物', materials: '材料', seeds: '种子', documents: '文书', gems: '宝石',
    valuables: '珍宝', relics: '圣物', potions: '药水', clothing: '衣物', keys: '钥匙', miscellany: '杂物', misc: '杂物', lighting: '照明', 'water sources': '水源',
    workstations: '工作站', shrines: '圣所', 'chalk drawings': '粉笔画', nature: '自然物', crops: '作物', 'unfinished builds': '半成品', 'ferry fixtures': '渡口设施',
    notices: '告示', fences: '围栏',
  },
  任务表: { main: '主线', side: '支线', favor: '委托', favour: '委托', guide: '指引' },
  货摊表: { farm: '农业', ranch: '牧业', fish: '渔业', sell: '出售', buy: '买' },
  导航框: { residents: '居民', items: '物品', fixtures: '设施', monsters: '怪物', locations: '地点', quests: '任务' },
  外观部件: { hair: '发型', face: '五官', beard: '胡子', age: '年纪', mark: '印记', glasses: '眼镜', hat: '帽子', cloak: '披挂', armour: '甲胄', outfit: '服装' },
}
/** A keyword argument as the canonical template reads it (trimmed; an English one turned Chinese). */
const argOf = (tpl: string, a: string | undefined): string => (a == null ? '' : ARG_EN[tpl]?.[a.trim().toLowerCase()] ?? a.trim())
/** A template's name as written → its canonical Chinese name (unknown names stay as they are). */
const templateName = (n: string): string => TEMPLATE_EN[n.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ')] ?? n

export function runTemplate(ctx: Ctx, call: TemplateCall): { html: string; block: boolean } {
  const written = call.name
  const name = templateName(written)
  const { args } = call
  const block = BLOCK.has(name)
  const out = (html: string) => ({ html, block })
  const e = ctx.page.ent
  const need = (kinds: Ent['kind'][]): any => {
    if (e && kinds.includes(e.kind)) return e
    const ks = [...new Set(kinds.map(kindName))].join('/')
    ctx.error(L(`{{${written}}} 只能用在${ks}页面上（要先在开头写「对象」）`, `{{${written}}} only works on ${ks} pages (give the page its “object” at the top first)`))
    return undefined
  }
  const sep = L('、', ', ')
  switch (name) {
    // inline
    case '键': return out(`<kbd>${esc(args[0] ?? '')}</kbd>`)
    case '物品': {
      const x = find(ctx, args[0] ?? '', ['item', 'fixture', 'structure'])
      if (!x) { ctx.error(L(`{{${written}|${args[0]}}}：游戏里没有这个物品`, `{{${written}|${args[0]}}}: no such item in the game`)); return out(esc(args[0] ?? '')) }
      const a = args[0]?.trim() ?? ''
      return out(entLink(ctx, x, { count: Number(args[1]) || undefined, text: [x.name, x.zh, x.en, x.title].includes(a) ? undefined : a }))
    }
    case '人物': { const x = find(ctx, args[0] ?? '', ['person', 'companion']) ?? find(ctx, args[0] ?? '', ['boss']); if (!x) ctx.error(L(`{{${written}|${args[0]}}}：没有这个人`, `{{${written}|${args[0]}}}: no such person`)); return out(x ? entLink(ctx, x) : esc(args[0] ?? '')) }
    case '怪物': { const x = find(ctx, args[0] ?? '', ['creature', 'boss']); if (!x) ctx.error(L(`{{${written}|${args[0]}}}：没有这种怪物`, `{{${written}|${args[0]}}}: no such monster`)); return out(x ? entLink(ctx, x) : esc(args[0] ?? '')) }
    case '地点': { const x = find(ctx, args[0] ?? '', ['map']); if (!x) ctx.error(L(`{{${written}|${args[0]}}}：没有这个地点`, `{{${written}|${args[0]}}}: no such place`)); return out(x ? entLink(ctx, x, { icon: 0 }) : esc(args[0] ?? '')) }
    case '状态': {
      const a = args[0]?.trim() ?? ''
      const s = ctx.g.statuses.find((x) => zh(x.name) === a || enOf(x.name).toLowerCase() === a.toLowerCase() || x.id === a)
      if (!s) ctx.error(L(`{{${written}|${args[0]}}}：没有这个状态`, `{{${written}|${args[0]}}}: no such status`))
      return out(`<span class="status">${ctx.link('状态', s ? say(s.name) : args[0])}</span>`)
    }
    case '技能': {
      const a = args[0]?.trim() ?? ''
      const s = ctx.g.skills.find((x) => zh(x.name) === a || enOf(x.name).toLowerCase() === a.toLowerCase() || x.id === a)
      if (!s) { ctx.error(L(`{{${written}|${args[0]}}}：没有这个技能`, `{{${written}|${args[0]}}}: no such skill`)); return out(esc(args[0] ?? '')) }
      const prof = s.profession ? ctx.g.professions.find((p) => p.id === s.profession) : undefined
      const page = prof ? say(prof.name) : '技能'
      // the page resolved as any link is (a Chinese title in the English edition), the anchor added to its href
      const a2 = ctx.link(page, say(s.name)).replace(/href="([^"#]*)"/, (_, h: string) => `href="${h}#${encodeURIComponent(skillAnchor(say(s.name)))}"`)
      return out(`<span class="ent">${fit(iconOf(s.icon), 20, 'inline')}${a2}</span>`)
    }
    case '数值': {
      const v = ctx.g.values[args[0] ?? '']
      if (!v) { ctx.error(L(`{{${written}|${args[0]}}}：没有这个数值（见格式手册的数值表）`, `{{${written}|${args[0]}}}: no such value (see the value table in the format guide)`)); return out(esc(args[0] ?? '')) }
      return out(`<span class="value" title="${escapeAttr(`${v.note}${par(v.source)}`)}">${esc(v.value)}</span>`)
    }
    case '图': return out(`<figure class="pic${args[2] ? ` ${esc(args[2])}` : ''}"><img src="/wiki/_/img/${encodeURIComponent(args[0] ?? '')}" alt="${escapeAttr(args[1] ?? '')}" loading="lazy">${args[1] ? `<figcaption>${ctx.inline(args[1])}</figcaption>` : ''}</figure>`)
    // banners
    case '小作品': return out(`<div class="banner stub">${L('这一页还没写完。欢迎<a href="#edit" class="edit-link">补充</a>。', 'This page is unfinished. You can help by <a href="#edit" class="edit-link">expanding it</a>.')}</div>`)
    case '规划中': return out(`<div class="banner planned">${L('<b>规划中</b>：这里写的是已经定下来的设计，游戏里还没有做出来。', '<b>Planned</b>: what is written here is settled design, not yet in the game. ')}${args[0] ? ctx.inline(args[0]) : ''}</div>`)
    case '待设计': return out(`<div class="banner tbd">${L('<b>待设计</b>：这部分还没有设计，下面只记录已经确定的内容。想提议，点页面上方的「讨论」。', '<b>To be designed</b>: this part is not designed yet; below is only what is settled. To make a proposal, click “Talk” at the top of the page. ')}${args[0] ? ctx.inline(args[0]) : ''}</div>`)
    case '开发者': return out(`<div class="banner dev">${L('<b>开发者功能</b>：只在开发版里有，正式游戏里没有。', '<b>Developer feature</b>: only in development builds, not in the released game.')}</div>`)
    case '主条目': return out(`<div class="hatnote">${L('主条目：', 'Main article: ')}${args.map((a) => ctx.link(a)).join(sep)}</div>`)
    case '另见': return out(`<div class="hatnote">${L('另见：', 'See also: ')}${args.map((a) => ctx.link(a)).join(sep)}</div>`)
    case '引言': return out(`<blockquote class="quote"><p>${quot(ctx.inline(args[0] ?? ''))}</p>${args[1] ? `<footer>— ${ctx.inline(args[1])}</footer>` : ''}</blockquote>`)
    case '导航框': return out(navbox(ctx, argOf(name, args[0])))
    case '原文': return out(ctx.include(args[0] ?? ''))
    // entity
    case '信息框': {
      if (!e) { ctx.error(L(`{{${written}}} 要在开头写「对象」`, `{{${written}}} needs the page's “object” at the top`)); return out('') }
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
    case '相关任务': {
      const p = need(['person', 'companion'])
      const qs = p ? idx(ctx.g).personQuests.get(p.id) ?? [] : []
      return out(qs.length ? `<ul class="facts">${qs.map((q) => `<li>${entLink(ctx, q, { icon: 0 })}${par(`${questKind(q.def.kind)}${questGiver(q.def) === p!.id ? L('，委托人', ', giver') : ''}`)}</li>`).join('')}</ul>` : `<p class="empty">${L('没有和这个人有关的任务。', 'No quests involve this person.')}</p>`)
    }
    case '外观部件': {
      // every part of the look table (docs/looks.md), by slot: a sample portrait and sprite, its words, whom it fits, its tags
      const SLOT_ZH: Record<string, string> = { hair: '发型', face: '五官', beard: '胡子', age: '年纪', mark: '印记', glasses: '眼镜', hat: '帽子', cloak: '披挂', armour: '甲胄', outfit: '服装' }
      const SLOT_EN: Record<string, string> = { hair: 'Hair', face: 'Face', beard: 'Beard', age: 'Age', mark: 'Mark', glasses: 'Glasses', hat: 'Hat', cloak: 'Cloak', armour: 'Armour', outfit: 'Outfit' }
      const BODY_ZH: Record<string, string> = { woman: '女人', man: '男人', girl: '女孩', boy: '男孩' }
      const slot = argOf(name, args[0])
      const parts = ctx.g.lookParts.filter((l) => !slot || l.slot === slot || SLOT_ZH[l.slot] === slot)
      return out(table(['', L('部件', 'Part'), L('槽位', 'Slot'), L('适合', 'Fits'), L('标签', 'Tags'), L('说法', 'Wording')], parts.map((l) => [
        `${fit(l.face, 72, 'face')}${fit(l.body, 48)}`, esc(say(l.name)), esc(L(SLOT_ZH[l.slot] ?? l.slot, SLOT_EN[l.slot] ?? l.slot)), esc(l.bodies.map((b) => L(BODY_ZH[b] ?? b, b)).join(sep)),
        l.tags.length ? l.tags.map((t) => `<code>${esc(t)}</code>`).join(' ') : '—', esc(say(l.say).replace('{c}', L('某', 'some'))),
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
      if (x.kind === 'boss') { const c = campaign(ctx, x as BossEnt); return out(`<ul class="facts">${c ? `<li>${L('战役：', 'Campaign: ')}${mapLink(ctx, c.map)}</li>` : ''}<li>${ctx.link('首领挑战')}</li></ul>`) }
      const ws = whereCreature(ctx, x.id)
      const born = bornOf(ctx, x.id).li.join('')
      const at = (m: string) => {
        const n = ctx.g.placed.get(x.id)?.get(m)
        const a = (idx(ctx.g).appearOn.get(x.id) ?? []).find((y) => y.map === m)
        const start = n ? L(`：开局 ${n} 只`, `: ${n} at the start`) : ''
        const again = a ? `${n ? L('，', ', ') : L('：', ': ')}${L(`会重新出现（最多 ${a.max} 只，每 ${secs(a.every)} 一次）`, `respawns (up to ${a.max}, once every ${secs(a.every)})`)}` : ''
        return `<li>${mapLink(ctx, m)}${start}${again}</li>`
      }
      const night = (ctx.g.ontology.appear ?? []).some((a: any) => a.types[x.id]) ? `<li>${ctx.link('夜行生物')}${L('：战斗区域的室外地图，入夜后', ': outdoor maps in combat zones, after nightfall')}</li>` : ''
      return out(ws.length || born ? `<ul class="facts">${ws.map(at).join('')}${night}${born}</ul>` : `<p class="empty">${L('游戏里目前不会出现。', 'Not in the game yet.')}</p>`)
    }
    case '掉落': {
      const x = need(['creature', 'boss'])
      if (!x) return out('')
      if (x.kind === 'boss') return out(`<ul class="facts"><li>${typeLink(ctx, 'item/material/iron_ore', { count: 4 })}</li><li>${L(`打倒它的人所属职业的一件${ctx.link('传说武器')}（世界里还没出现过的那件）`, `A ${ctx.link('传说武器')} of the slayer's profession (one not yet in the world)`)}</li><li>${L('经验：等于它的生命上限', 'Experience: equal to its maximum health')}</li></ul>`)
      const c = x as CreatureEnt
      const r = ctx.g.ontology.params?.recovery ?? 0.5
      const carried = new Map<string, number>()
      for (const m of ctx.g.maps) for (const en of m.entities) if (en.place.on === 'inside' && m.entities.find((h) => h.id === (en.place as any).holder)?.type === c.id) carried.set(en.type, (carried.get(en.type) ?? 0) + 1)
      const lines = [
        ...c.makeup.map((m) => `<li>${typeLink(ctx, m.type, { count: Math.max(1, Math.floor(m.count * r)) })}${par(L(`构成 ${m.count} × ${r * 100}%`, `makeup ${m.count} × ${r * 100}%`))}</li>`),
        ...[...carried].map(([t, n]) => `<li>${typeLink(ctx, t, { count: n })}${par(L('身上带着的', 'carried'))}</li>`),
        ...(typeof c.props.trophy === 'string' ? [`<li>${typeLink(ctx, c.props.trophy)}${par(L(`${ctx.link('专属掉落', '专属装备')}，直接进打倒它的人的背包：${trophyOdds(ctx, c.props)}`, `${ctx.link('专属掉落', 'trophy')}, straight into the slayer's bag: ${trophyOdds(ctx, c.props)}`))}</li>`] : []),
        `<li>${L(`经验 ${c.props.maxHp ?? '—'}（等于生命上限，见${ctx.link('等级与经验')}）`, `Experience ${c.props.maxHp ?? '—'} (its maximum health; see ${ctx.link('等级与经验')})`)}</li>`,
      ]
      return out(`<ul class="facts">${lines.join('')}</ul>`)
    }
    case '首领技能': { const x = need(['boss']); return out(x ? bossSkills(ctx, x as BossEnt) : '') }
    case '怪物技能': { const x = need(['creature']); return out(x ? creatureSkills(ctx, x as CreatureEnt) : '') }
    case '地图': { const x = need(['map']); return out(x ? mapView(ctx, x as MapEnt) : '') }
    case '相连地点': { const x = need(['map']); return out(x ? mapLinks(ctx, x as MapEnt) : '') }
    case '居民': { const x = need(['map']); return out(x ? mapPeople(ctx, x as MapEnt) : '') }
    case '生物': { const x = need(['map']); return out(x ? mapCreatures(ctx, x as MapEnt) : '') }
    case '物品分布': { const x = need(['map']); return out(x ? mapItems(ctx, x as MapEnt) : '') }
    case '任务目标': { const x = need(['quest']); return out(x ? questGoals(ctx, x as QuestEnt) : '') }
    case '任务奖励': { const x = need(['quest']); return out(x ? questReward(ctx, x as QuestEnt) : '') }
    case '任务对话': { const x = need(['quest']); return out(x ? questTalk(ctx, x as QuestEnt) : '') }
    case '任务阶段': { const x = need(['quest']); return out(x ? questStages(ctx, x as QuestEnt) : '') }
    case '剧透': ctx.error(L(`{{${written}|…}} 和 {{/${written}}} 要各自单独占一行`, `{{${written}|…}} and {{/${written}}} must each stand on a line of their own`)); return out('')
  }
  const l = lists(ctx, name, args, written)
  if (l !== undefined) return out(l)
  ctx.error(L(`不认识的模板 {{${written}}}`, `unknown template {{${written}}}`))
  return { html: `<span class="error">{{${esc(written)}}}</span>`, block: false }
}

export { linkHref } from './lang.ts'

/** A posture's name (StatusDef.pose). */
const POSE_ZH: Record<string, string> = { sit: '坐', lie: '躺', kneel: '跪', lean: '倚' }
