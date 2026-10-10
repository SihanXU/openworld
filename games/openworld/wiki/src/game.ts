// The game as the wiki reads it: every page's facts come from here, built from the same content and
// world the game runs (never from the design notes). One model, normalized for the templates: items,
// fixtures and structures, people, creatures, bosses, maps, quests, recipes, skills, statuses…

import {
  APPEAR_EVERY, BOON_REACH, CODEX_SIGHT, HUNGER_EFFECT_EVERY, HUNGER_EVERY, HUNGRY_BELOW, HUNGRY_PACE, MAGNET, PROFESSION_LEVEL,
  ROW, SLOT_COUNT, TICKS_PER_HOUR, TICKS_PER_MINUTE, nightHours,
  type BossDef, type Entity, type Look, type PlacementRecipe, type QuestDef, type Recipe, type SkillDef, type StatusDef, type TerrainDef, type Text, type TypeDef,
} from '@lsw/engine'
import {
  BOONS, BOSSES, COIN, EFFICIENCY, ELEMENT_NAMES, ELEMENTS, FALL_DAMAGE, FED_FOR, FORMS, LAYS_EVERY, LEGENDARY_ARMS, MATERIALS, NIGHT_CAP, NIGHT_EVERY, PLACEMENTS,
  QUALITIES, RECIPES, RECOVERY, RELICS, ROOM_SIZE, SAFE_FALL, SKILL_BRANCHES, SKILL_DIRECTIONS, SKILL_PROFESSIONS, SKILLS, STOREYS, TERRAIN_CHARS,
  TERRAINS, TREE_GROWS, VOW_TRAITS, buildOntology, type Form, LOOK_BODIES, LOOK_PARTS,
} from '@lsw/content'
import { buildFord } from '../../tools/src/demo/world.ts'
import { PEOPLE } from '../../tools/src/demo/people.ts'
import type { PersonDef } from '../../tools/src/demo/person.ts'
import { CATALOG } from '../../client/src/assets/catalog.ts'
import { pngSize } from './png.ts'
import { FACE_PX, lookUrls } from './looks.ts'

export const zh = (t?: Text | string): string => (t == null ? '' : typeof t === 'string' ? t : t.zh || t.en)
export const enOf = (t?: Text | string): string => (t == null ? '' : typeof t === 'string' ? t : t.en)

// ------------------------------------------------------------------------------------------ sprites

/** A picture on the page: a rectangle of an image the game itself serves (/assets/…). */
export interface Sprite { url: string; x: number; y: number; w: number; h: number; iw: number; ih: number; /** drawn smooth (a painted portrait), not as pixels */ smooth?: boolean }

const ASSETS = new URL('../../client/public/assets/', import.meta.url)
const assetPath = (img: string) => (img.startsWith('lsw/') ? img : `na/${img}`)
const sizes = new Map<string, [number, number]>()
function sizeOf(img: string): [number, number] {
  const p = assetPath(img)
  if (!sizes.has(p)) sizes.set(p, pngSize(new URL(p, ASSETS)) ?? [16, 16])
  return sizes.get(p)!
}
const pic = (img: string, x: number, y: number, w: number, h: number): Sprite => {
  const [iw, ih] = sizeOf(img)
  return { url: `/assets/${assetPath(img)}`, x, y, w, h, iw, ih }
}
const whole = (img: string): Sprite => {
  const [iw, ih] = sizeOf(img)
  return { url: `/assets/${assetPath(img)}`, x: 0, y: 0, w: iw, h: ih, iw, ih }
}

export function itemSprite(key?: string): Sprite | undefined {
  const d = key ? CATALOG.items[key] : undefined
  return d ? pic(d.img, d.x, d.y, d.w, d.h) : undefined
}
export function fixtureSprite(key?: string): Sprite | undefined {
  const f = key ? CATALOG.fixtures[key] : undefined
  const d = f?.base ?? f?.variants?.[0]
  return d ? pic(d.img, d.x, d.y, d.w, d.h) : undefined
}
/** The first frame (facing down) of an actor sheet. */
function actorSprite(def?: { dir: string; sheet: string; cols: number; rows: number }): Sprite | undefined {
  if (!def) return undefined
  const img = `${def.dir}/${def.sheet}`
  const [iw, ih] = sizeOf(img)
  return { url: `/assets/${assetPath(img)}`, x: 0, y: 0, w: Math.floor(iw / def.cols), h: Math.floor(ih / def.rows), iw, ih }
}
export function creatureSprite(type: TypeDef | undefined, element?: string): Sprite | undefined {
  if (!type?.sprite) return undefined
  const leaf = type.id.split('/').pop()
  const key = [`${type.sprite}:${leaf}`, element && `${type.sprite}:${element}`, type.sprite].find((k) => k && CATALOG.creatures[k as string]) as string | undefined
  return actorSprite(key ? CATALOG.creatures[key] : undefined)
}
export function faceSprite(look?: string): Sprite | undefined {
  const c = look ? CATALOG.characters[look] : undefined
  if (!c) return undefined
  return c.faceset ? whole(`${c.dir}/${c.faceset}`) : actorSprite(c)
}
export function bodySprite(look?: string): Sprite | undefined {
  return actorSprite(look ? CATALOG.characters[look] : undefined)
}
export const skillIcon = (icon?: string): Sprite => whole(`lsw/skills/${icon ?? 'origin'}.png`)

// ------------------------------------------------------------------------------------------ the model

export type Kind = 'item' | 'fixture' | 'structure' | 'person' | 'companion' | 'creature' | 'boss' | 'map' | 'quest'

export const KIND_ZH: Record<Kind, string> = {
  item: '物品', fixture: '设施', structure: '建筑件', person: '人物', companion: '人物', creature: '怪物', boss: '首领', map: '地点', quest: '任务',
}

/** Something the game holds that gets a page of its own. */
export interface Ent {
  kind: Kind
  id: string
  zh: string
  en: string
  /** The page title (its zh name; disambiguated when two things share one). */
  title: string
  sprite?: Sprite
  /** The category it is listed under (an item's codex group, a creature's family, a quest's kind…). */
  group: string
}

export interface ItemEnt extends Ent {
  kind: 'item' | 'fixture' | 'structure'
  type: TypeDef
  form?: Form
  tags: string[]
  props: Record<string, any>
  /** What it is made of (and so what it leaves when broken). */
  makeup: { type: string; count: number }[]
  recipe?: Recipe
  placement?: PlacementRecipe
  relic?: { zh: string; text: string }
  quality?: string
}

export interface PersonEnt extends Ent {
  kind: 'person' | 'companion'
  def?: PersonDef
  entity: Entity
  role: string
  roleZh: string
  age?: number
  /** How they look (docs/looks.md): a look record (the game composes both pictures from it), or a drawn sheet's key. */
  look?: string | Look
  face?: Sprite
  body?: Sprite
  /** Where they are when the world begins. */
  home?: string
}

export interface CreatureEnt extends Ent {
  kind: 'creature'
  type: TypeDef
  props: Record<string, any>
  tags: string[]
  makeup: { type: string; count: number }[]
}

export interface BossEnt extends Ent {
  kind: 'boss'
  def: BossDef
  type?: TypeDef
  seal?: string
}

export interface MapEnt extends Ent {
  kind: 'map'
  map: any
  entities: Entity[]
}

export interface QuestEnt extends Ent {
  kind: 'quest'
  def: QuestDef
}

export interface Game {
  version: string
  ontology: ReturnType<typeof buildOntology>
  types: Record<string, TypeDef>
  items: ItemEnt[]
  fixtures: ItemEnt[]
  structures: ItemEnt[]
  people: PersonEnt[]
  creatures: CreatureEnt[]
  bosses: BossEnt[]
  maps: MapEnt[]
  quests: QuestEnt[]
  /** What is made (the crafting panel, a workbench): not the stall's trade. */
  recipes: Recipe[]
  /** The Held Ground's stall (content homestead.ts): its offers (groups farm, ranch, fish) and what it buys back (group sell). */
  shop: Recipe[]
  /** The stall's coin. */
  coin: string
  placements: PlacementRecipe[]
  skills: SkillDef[]
  branches: typeof SKILL_BRANCHES
  directions: typeof SKILL_DIRECTIONS
  professions: typeof SKILL_PROFESSIONS
  boons: typeof BOONS
  statuses: StatusDef[]
  terrains: TerrainDef[]
  waypoints: { id: string; map: string; x: number; y: number; name: Text }[]
  /** Every entity by id (type id, npc id, map id, quest id, boss id). */
  byId: Map<string, Ent>
  /** By page title and by zh name (a name may be shared: titles are unique, names are not). */
  byTitle: Map<string, Ent>
  byName: Map<string, Ent[]>
  /** Named numbers from the code, for {{数值|…}}. */
  values: Record<string, { value: string; note: string; source: string }>
  index: any
  chunks: { map: any; entities: Entity[] }[]
  /** Who stands where at the start, and which maps each item, fixture and creature is on (counts). */
  placed: Map<string, Map<string, number>>
  /** Where a map's place on the world map is. */
  mapOf: (id: string) => MapEnt | undefined
  /** The look parts (docs/looks.md), each with a sample look that wears it and its two pictures. */
  lookParts: LookPartEnt[]
  typeName: (type: string) => string
  entOfType: (type: string) => Ent | undefined
}

/** A look part on the wiki: what it is, and a sample look that wears it (its portrait and sprite). */
export interface LookPartEnt {
  id: string
  slot: string
  name: Text
  say: Text
  tags: string[]
  bodies: string[]
  sample: Look
  face: Sprite
  body: Sprite
}

/** A sample look for a part: the part on a plain body (the first it is drawn for), in plain colours. */
function sampleLook(id: string): Look {
  const p = LOOK_PARTS[id]
  const body = p.bodies?.[0] ?? 'woman'
  const child = LOOK_BODIES[body]?.age === 'child'
  const parts: Record<string, string> = {
    face: child ? 'face.child' : 'face.soft',
    outfit: { woman: 'outfit.dress', man: 'outfit.tunic', girl: 'outfit.pinafore', boy: 'outfit.smock' }[body] ?? 'outfit.dress',
  }
  if (p.slot !== 'hair' && p.slot !== 'hat') parts.hair = child ? 'hair.childbob' : body === 'man' ? 'hair.short' : 'hair.bob'
  parts[p.slot] = id
  return { body, parts, colors: { skin: 'light', hair: 'chestnut', eyes: 'hazel' } }
}

// item groups: the codex's (the game's own grouping, client ui/menu.ts GROUPS)
export const ITEM_GROUPS: Record<string, string> = {
  weapon: '武器', armor: '护甲', clothing: '衣物', tool: '工具', light: '照明', vessel: '容器', food: '食物', potion: '药水', material: '材料',
  seed: '种子', gem: '宝石', valuable: '珍宝', relic: '圣物', document: '文书', key: '钥匙', misc: '杂物',
}
const FIXTURE_GROUPS: [string, string][] = [
  ['fixture/container', '容器'], ['fixture/furniture', '家具'], ['fixture/light', '光源'], ['fixture/water', '水源'], ['fixture/craft', '工作站'],
  ['fixture/sacred', '圣所'], ['fixture/chalk', '粉笔画'], ['fixture/nature', '自然物'], ['fixture/crop', '作物'], ['fixture/build', '半成品'],
  ['fixture/ferry', '渡口设施'], ['fixture/sign', '告示'], ['fixture/fence', '围栏'],
]
const ACCESSORY_SLOTS = new Set(['ring', 'neck', 'ear', 'waist', 'shoulders'])
export const isAccessory = (e: ItemEnt) => ACCESSORY_SLOTS.has(String(e.props.slot ?? ''))

const KIND_ORDER: Kind[] = ['person', 'companion', 'boss', 'creature', 'map', 'item', 'structure', 'fixture', 'quest']

export function loadGame(): Game {
  const ontology = buildOntology()
  const types = ontology.types
  const ids = Object.keys(types)
  const hasChildren = (id: string) => ids.some((x) => x.startsWith(id + '/'))
  const { index, chunks } = buildFord()
  const ents: Ent[] = []

  // ---- where things stand when the world begins
  const placed = new Map<string, Map<string, number>>()
  const holders = new Map<string, string>() // entity id → map it is on
  const mark = (type: string, map: string, n = 1) => {
    if (!placed.has(type)) placed.set(type, new Map())
    const m = placed.get(type)!
    m.set(map, (m.get(map) ?? 0) + n)
  }
  const allEntities: Entity[] = []
  for (const c of chunks) for (const e of c.entities) {
    allEntities.push(e)
    if (e.place.on === 'tile') holders.set(e.id, e.place.map)
  }
  for (const e of index.npcs) if (e.place.on === 'tile') holders.set(e.id, e.place.map)
  for (let pass = 0; pass < 3; pass++) for (const e of [...allEntities, ...index.npcs]) {
    if ((e.place.on === 'inside' || e.place.on === 'hand') && holders.has(e.place.holder)) holders.set(e.id, holders.get(e.place.holder)!)
  }
  for (const e of allEntities) {
    const m = holders.get(e.id)
    if (m) mark(e.type, m, Number(e.props?.count ?? 1) || 1)
  }

  // ---- items (the catalogue's forms), fixtures, structures
  // buying and selling are made at the stall as recipes are (content homestead.ts), but they are trade, not making
  const MADE = RECIPES.filter((r) => r.station !== 'stall')
  const SHOP = RECIPES.filter((r) => r.station === 'stall')
  const recipeOf = new Map(MADE.map((r) => [String((r.make as any).type), r]))
  const placementOf = new Map(PLACEMENTS.filter((p) => p.result).map((p) => [String(p.result), p]))
  const items: ItemEnt[] = FORMS.map((f) => {
    const t = types[f.id]
    const props = { ...(t?.props ?? {}), ...(f.props ?? {}) } as Record<string, any>
    const tags = [...new Set([...(t?.tags ?? []), ...(f.tags ?? [])])]
    const group = ITEM_GROUPS[f.id.split('/')[1]] ?? '杂物'
    const relicId = props.relic as string | undefined
    const q = tags.find((g) => g.startsWith('quality:'))?.slice(8)
    return {
      kind: 'item', id: f.id, zh: f.zh, en: f.en, title: f.zh, group, type: t, form: f, tags, props,
      makeup: (f.makeup ?? []) as any, recipe: recipeOf.get(f.id), sprite: itemSprite(f.sprite),
      relic: relicId && RELICS[relicId] ? { zh: RELICS[relicId].zh, text: RELICS[relicId].text.zh } : undefined,
      quality: q,
    } satisfies ItemEnt
  })
  ents.push(...items)

  const fixtureIds = ids.filter((id) => {
    if (!id.startsWith('fixture/')) return false
    const parts = id.split('/')
    // a crop is one page with its stages; the stages are not pages
    if (parts[1] === 'crop' && parts.length > 3) return false
    if (parts[1] === 'crop' && parts.length === 3) return true
    // a parent that is a thing of its own, not one of the groups (its own picture: the market stall, the trading stall under it) is a page too
    const thing = !FIXTURE_GROUPS.some(([g]) => g === id) && !!CATALOG.fixtures[types[id].sprite ?? '']
    return !hasChildren(id) || placed.has(id) || !!types[id].makeup || thing
  })
  const fixtures: ItemEnt[] = fixtureIds.map((id) => {
    const t = types[id]
    const group = FIXTURE_GROUPS.find(([p]) => id === p || id.startsWith(p + '/'))?.[1] ?? '设施'
    const ripe = id.startsWith('fixture/crop/') ? types[`${id}/ripe`] : undefined
    return {
      kind: 'fixture', id, zh: zh(t.name), en: (enOf(t.name) || id), title: zh(t.name), group, type: t, tags: t.tags ?? [], props: { ...(t.props ?? {}) },
      makeup: (t.makeup ?? []) as any, recipe: recipeOf.get(id), placement: placementOf.get(id),
      sprite: fixtureSprite(ripe?.sprite ?? t.sprite) ?? fixtureSprite(`fixture:${id.split('/').pop()}`),
    } satisfies ItemEnt
  })
  ents.push(...fixtures)

  const structures: ItemEnt[] = ids.filter((id) => id.startsWith('structure/') && id !== 'structure/door/open').map((id) => {
    const t = types[id]
    return {
      kind: 'structure', id, zh: zh(t.name), en: (enOf(t.name) || id), title: zh(t.name), group: '建筑件', type: t, tags: t.tags ?? [], props: { ...(t.props ?? {}) },
      makeup: (t.makeup ?? []) as any, recipe: recipeOf.get(id),
      sprite: itemSprite(t.sprite) ?? fixtureSprite(t.sprite),
    } satisfies ItemEnt
  })
  ents.push(...structures)

  // ---- people and the companion
  const defOf = new Map(PEOPLE.map((p) => [p.id, p]))
  const roleZh = (role: string) => {
    const t = types[`actor/person/${role}`]
    return t ? zh(t.name) : ({ herder: '牧人', miller: '磨坊主', steward: '守地人', stranger: '陌生人', host: '旅店老板', trainer: '职业导师' } as Record<string, string>)[role] ?? role
  }
  const people: PersonEnt[] = index.npcs.map((e: Entity) => {
    const def = defOf.get(e.id)
    const role = String((e as any).npc?.role ?? def?.role ?? e.type.split('/').pop())
    const look = (e as Entity).look
    // a look record: its portrait and sprite, composed by the game's code when the site is written (build.ts)
    const urls = typeof look === 'object' ? lookUrls(look) : undefined
    const face = urls ? { url: urls.face, x: 0, y: 0, w: FACE_PX, h: FACE_PX, iw: FACE_PX, ih: FACE_PX, smooth: true } : faceSprite(look as string | undefined)
    const body = urls ? { url: urls.body, x: 0, y: 0, w: 16, h: 32, iw: 16, ih: 32 } : bodySprite(look as string | undefined)
    return {
      kind: 'person', id: e.id, zh: zh(e.name), en: (enOf(e.name) || e.id), title: zh(e.name), group: e.place.on === 'tile' ? e.place.map : 'offstage',
      def, entity: e, role, roleZh: roleZh(role), age: def?.age ?? (Number(e.props?.age ?? 0) || undefined), look,
      face, body, sprite: face, home: e.place.on === 'tile' ? e.place.map : undefined,
    } satisfies PersonEnt
  })
  for (const c of index.companions ?? []) {
    const t = types[c.type]
    const fairy = CATALOG.creatures['creature:fairy']
    people.push({
      kind: 'companion', id: c.id, zh: zh(c.name), en: (enOf(c.name) || c.id), title: zh(c.name), group: 'companion', entity: c, role: 'companion', roleZh: zh(t?.name) || '同伴',
      look: undefined, face: fairy?.faceset ? whole(`${fairy.dir}/${fairy.faceset}`) : actorSprite(fairy), body: actorSprite(fairy),
      sprite: fairy?.faceset ? whole(`${fairy.dir}/${fairy.faceset}`) : actorSprite(fairy),
    })
  }
  ents.push(...people)

  // ---- creatures (every kind, leaves of the family tree, the bosses' own aside)
  const creatures: CreatureEnt[] = ids
    .filter((id) => id.startsWith('actor/creature/') && !id.startsWith('actor/creature/sin') && !hasChildren(id))
    .map((id) => {
      const t = types[id]
      // a kind inherits its family's numbers and tags
      const chain = id.split('/').map((_, i, a) => a.slice(0, i + 1).join('/')).filter((x) => types[x])
      const props: Record<string, any> = {}
      const tags: string[] = []
      let sprite = t
      for (const x of chain) {
        Object.assign(props, types[x].props ?? {})
        tags.push(...(types[x].tags ?? []))
        if (types[x].sprite) sprite = { ...types[x], id }
      }
      const family = types[chain[2]] ?? t
      return {
        kind: 'creature', id, zh: zh(t.name), en: (enOf(t.name) || id), title: zh(t.name), group: zh(family.name), type: t, props, tags: [...new Set(tags)],
        makeup: (t.makeup ?? []) as any, sprite: creatureSprite(sprite, props.element),
      } satisfies CreatureEnt
    })
  ents.push(...creatures)

  // ---- bosses (their kits; the campaign's own numbers are in the world)
  const bosses: BossEnt[] = BOSSES.map((b) => {
    const [name, seal] = zh(b.name).split(' · ')
    const t = types[`actor/creature/sin/${b.id}`]
    return { kind: 'boss', id: b.id, zh: name, en: enOf(b.name).split(' · ')[0], title: name, group: '首领', def: b, type: t, seal, sprite: bossSprite(b.id) } satisfies BossEnt
  })
  ents.push(...bosses)

  // ---- maps
  const maps: MapEnt[] = index.maps.filter((m: any) => m.id !== 'offstage').map((m: any) => {
    const c = chunks.find((x: any) => x.map.id === m.id)
    return { kind: 'map', id: m.id, zh: zh(m.name), en: (enOf(m.name) || m.id), title: zh(m.name), group: m.kind, map: c?.map ?? m, entities: c?.entities ?? [] } satisfies MapEnt
  })
  ents.push(...maps)

  // ---- quests
  const quests: QuestEnt[] = (index.quests ?? []).map((q: QuestDef) => ({
    kind: 'quest', id: q.id, zh: zh(q.title), en: enOf(q.title), title: zh(q.title), group: q.kind, def: q,
  }) satisfies QuestEnt)
  ents.push(...quests)

  // ---- titles: one per thing; a shared name goes to the first kind in KIND_ORDER, the rest say what they are
  const byName = new Map<string, Ent[]>()
  for (const e of ents) {
    if (!byName.has(e.zh)) byName.set(e.zh, [])
    byName.get(e.zh)!.push(e)
  }
  for (const [name, list] of byName) {
    if (list.length < 2) continue
    list.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    const used = new Set([name])
    for (const e of list.slice(1)) {
      let t = `${name}（${e.kind === 'fixture' ? e.group : KIND_ZH[e.kind]}）`
      if (used.has(t)) t = `${name}（${KIND_ZH[e.kind]}·${e.id.split('/').pop()}）`
      used.add(t)
      e.title = t
    }
  }
  const byId = new Map(ents.map((e) => [e.id, e]))
  for (const b of bosses) if (b.type) byId.set(b.type.id, b)
  const byTitle = new Map(ents.map((e) => [e.title, e]))

  const typeName = (type: string): string => {
    const e = byId.get(type)
    if (e) return e.zh
    const t = types[type]
    return t ? zh(t.name) : type.split('/').pop() ?? type
  }
  const entOfType = (type: string): Ent | undefined => {
    let id = type
    while (id) {
      const e = byId.get(id)
      if (e) return e
      id = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : ''
    }
    return undefined
  }

  const player = types['actor/person/player']
  const hours = nightHours(0)
  const v = (value: unknown, note: string, source: string) => ({ value: String(value), note, source })
  const values: Game['values'] = {
    玩家生命上限: v(player.props?.maxHp ?? 40, '玩家的最大生命值', 'content/src/ontology.ts'),
    玩家攻击: v(player.props?.atk ?? 2, '玩家空手的基础攻击', 'content/src/ontology.ts'),
    饱食度上限: v(player.props?.maxHunger ?? 20, '饱食度满值', 'content/src/ontology.ts'),
    初始饱食度: v(index.player?.props?.hunger ?? 12, '新游戏开始时的饱食度', 'tools/src/demo/world.ts'),
    饱食度下降间隔: v(HUNGER_EVERY / TICKS_PER_MINUTE, '吃饱时每隔多少游戏分钟饱食度 −1', 'engine/src/hunger.ts HUNGER_EVERY'),
    饿了阈值: v(`${Math.round(HUNGRY_BELOW * 100)}%`, '饱食度低于满值的这个比例时变为「饿了」', 'engine/src/hunger.ts HUNGRY_BELOW'),
    饿了减速: v(HUNGRY_PACE, '「饿了」之后饱食度下降慢多少倍', 'engine/src/hunger.ts HUNGRY_PACE'),
    睡眠减速: v((ontology.periods ?? []).find((p: any) => p.name === 'hunger')?.paceBy?.asleep ?? 4, '睡着时饱食度下降慢多少倍', 'content/src/ontology.ts periods'),
    回血间隔: v(HUNGER_EFFECT_EVERY / TICKS_PER_MINUTE, '每隔多少现实秒（游戏分钟）结算一次回血或饥饿伤害', 'engine/src/hunger.ts HUNGER_EFFECT_EVERY'),
    背包格数: v(SLOT_COUNT, '背包的格数', 'engine/src/controls.ts SLOT_COUNT'),
    快捷栏格数: v(ROW, '快捷栏（背包第一行）的格数', 'engine/src/controls.ts ROW'),
    磁吸距离: v(MAGNET, '掉落物自动飞进背包的距离（格）', 'engine/src/controls.ts MAGNET'),
    每游戏分钟tick: v(TICKS_PER_MINUTE, '1 游戏分钟 = 多少 tick（1 现实秒）', 'engine/src/calendar.ts'),
    一天现实分钟: v(24 * TICKS_PER_HOUR / TICKS_PER_MINUTE / 60, '一个游戏日相当于多少现实分钟', 'engine/src/calendar.ts'),
    入夜: v(`${hours.dusk}:00`, '夜晚开始（故事推进后会提前）', 'engine/src/calendar.ts nightHours'),
    天亮: v(`0${hours.dawn}:00`, '夜晚结束', 'engine/src/calendar.ts nightHours'),
    新游戏时刻: v(`${index.startHour ?? 13}:00`, '新游戏开始的时刻', 'tools/src/demo/world.ts START_HOUR'),
    回收比例: v(`${RECOVERY * 100}%`, '东西被打坏时，构成它的材料留下的比例', 'content/src/ontology.ts RECOVERY'),
    安全落差: v(SAFE_FALL, '掉下这么多层不受伤', 'content/src/ontology.ts SAFE_FALL'),
    坠落伤害: v(FALL_DAMAGE, '超过安全落差后每多一层的伤害', 'content/src/ontology.ts FALL_DAMAGE'),
    楼层上限: v(STOREYS, '地面以上最多能建几层', 'content/src/ontology.ts STOREYS'),
    房间最大格数: v(ROOM_SIZE, '超过这么多格就不算房间（算屋外）', 'content/src/ontology.ts ROOM_SIZE'),
    夜行生物上限: v(NIGHT_CAP, '一张地图同时游荡的夜行生物上限', 'content/src/ontology.ts NIGHT_CAP'),
    夜行生物间隔: v(NIGHT_EVERY / TICKS_PER_MINUTE, '每隔多少现实秒可能再出现一只夜行生物', 'content/src/ontology.ts NIGHT_EVERY'),
    树木再生: v(TREE_GROWS / (TICKS_PER_HOUR * 24), '树墩或树苗长成树要几个游戏日', 'content/src/ontology.ts TREE_GROWS'),
    下蛋间隔: v(LAYS_EVERY / TICKS_PER_HOUR, '母鸡每隔几个游戏小时下一个蛋', 'content/src/ontology.ts LAYS_EVERY'),
    地面产出间隔: v(APPEAR_EVERY / TICKS_PER_MINUTE, '树枝、石头、草这类地面产出每隔多少现实秒长出一份', 'engine/src/appear.ts APPEAR_EVERY'),
    职业等级: v(PROFESSION_LEVEL, '可以选择职业的等级', 'engine/src/profession.ts PROFESSION_LEVEL'),
    升级经验系数: v(20, '升到下一级需要 这个数 × 当前等级 的经验', 'engine/src/progression.ts xpToNext'),
    恩赐切换距离: v(BOON_REACH, '在已唤醒的传送雕像多少格内可以更换小啾的恩赐', 'engine/src/boons.ts BOON_REACH'),
    图鉴视距: v(CODEX_SIGHT, '人物或生物来到多少格内就算「见过」', 'engine/src/codex.ts CODEX_SIGHT'),
    交互距离: v(ontology.params?.reach ?? 1, '默认的 E 交互距离（格）', 'content/src/ontology.ts params.reach'),
    拿放距离: v(ontology.params?.carry ?? 1, 'F 拿、G 放的距离（格）', 'content/src/ontology.ts params.carry'),
    休息系数: v(ontology.params?.rest ?? 0.5, '不在卧室睡觉时恢复损失生命的比例', 'content/src/ontology.ts params.rest'),
    喂饱时长: v(FED_FOR / TICKS_PER_HOUR, '喂过饲料的动物「吃饱了」持续几个游戏小时；「挤过奶」「刚生过崽」也持续这么久', 'content/src/homestead.ts FED_FOR'),
    幼崽长大: v(Number((types['actor/creature/animal/calf']?.stage as any)?.lasts ?? 0) / TICKS_PER_HOUR, '小牛、小鸡长成牛、鸡要几个游戏小时', 'content/src/ontology.ts GROWS_UP'),
    鱼饵次数: v(FORMS.find((f) => f.id === 'item/misc/bait')?.props?.casts ?? 5, '一份鱼饵挂到鱼竿上能用几竿', 'content/src/items.ts item/misc/bait'),
    鱼竿距离: v(FORMS.find((f) => f.id === 'item/tool/fishing_rod')?.props?.range ?? 1, '鱼竿能甩到几格远（格）', 'content/src/items.ts item/tool/fishing_rod'),
    首领二阶段: v(`${Math.round((BOSSES[0]?.enrageAt ?? 0.5) * 100)}%`, '首领生命降到这个比例进入第二阶段', 'content/src/bosses.ts enrageAt'),
  }

  const g: Game = {
    version: index.version, ontology, types, items, fixtures, structures, people, creatures, bosses, maps, quests,
    recipes: MADE, shop: SHOP, coin: COIN, placements: PLACEMENTS, skills: SKILLS, branches: SKILL_BRANCHES, directions: SKILL_DIRECTIONS, professions: SKILL_PROFESSIONS,
    boons: BOONS, statuses: Object.values(ontology.statuses), terrains: TERRAINS, waypoints: index.waypoints ?? [],
    byId, byTitle, byName, values, index, chunks, placed,
    mapOf: (id) => maps.find((m) => m.id === id),
    lookParts: Object.entries(LOOK_PARTS).map(([id, p]) => {
      const sample = sampleLook(id)
      const urls = lookUrls(sample)
      return {
        id, slot: p.slot, name: p.name, say: p.say, tags: p.tags ?? [], bodies: p.bodies ?? Object.keys(LOOK_BODIES), sample,
        face: { url: urls.face, x: 0, y: 0, w: FACE_PX, h: FACE_PX, iw: FACE_PX, ih: FACE_PX, smooth: true },
        body: { url: urls.body, x: 0, y: 0, w: 16, h: 32, iw: 16, ih: 32 },
      }
    }),
    typeName, entOfType,
  }
  return g
}

function bossSprite(id: string): Sprite | undefined {
  const def = CATALOG.creatures[`boss:sin:${id}`]
  if (!def) return undefined
  const img = id === 'alberic' ? 'lsw/Bosses/alberic/v5/actions.png' : `${def.dir}/${def.sheet}`
  const [iw, ih] = sizeOf(img)
  if (id === 'alberic') return { url: `/assets/${assetPath(img)}`, x: 0, y: 0, w: Math.floor(iw / 32), h: Math.floor(ih / 21), iw, ih }
  return { url: `/assets/${assetPath(img)}`, x: 0, y: 0, w: Math.floor(iw / def.cols), h: Math.floor(ih / def.rows), iw, ih }
}

// re-exports the templates read
export { EFFICIENCY, ELEMENT_NAMES, ELEMENTS, LEGENDARY_ARMS, MATERIALS, QUALITIES, RELICS, TERRAIN_CHARS, VOW_TRAITS }
