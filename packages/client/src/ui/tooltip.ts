// Minecraft's item tooltip: hover an item in the toolbar, the bag, a chest or the crafting panel
// and a dark purple-bordered box follows the cursor. The name in its rarity's colour; what kind
// of thing it is; "When held:" with its attack in dark green; what a tool does and what food
// restores in blue and gold; its traits as purple italic lore; statuses and an owner in red.

import type { Frame, ItemInfo } from '@lsw/engine'
import { MATERIALS, PROFESSION_BY_ID, STATUSES } from '@lsw/content'
import { esc, locale, tx } from './common.ts'

const L = (en: string, zh: string) => (locale.value === 'zh' ? zh : en)

/** Minecraft's rarity colours, by quality. */
const QUALITY_COLOR: Record<string, string> = { crude: '#aaaaaa', fine: '#ffff55', masterwork: '#55ffff', legendary: '#ff55ff' }
const ELEMENT: Record<string, [string, string, string]> = {
  fire: ['Fire', '火', '#ff5555'],
  water: ['Water', '水', '#5555ff'],
  ice: ['Ice', '冰', '#55ffff'],
  lightning: ['Lightning', '雷', '#ffff55'],
  wind: ['Wind', '风', '#55ff55'],
  earth: ['Earth', '土', '#ffaa00'],
}
/** What kind of thing it is, by the type's family. */
const KIND: Record<string, [string, string]> = {
  weapon: ['Weapon', '武器'],
  tool: ['Tool', '工具'],
  food: ['Food', '食物'],
  potion: ['Potion', '药水'],
  material: ['Material', '材料'],
  seed: ['Seed', '种子'],
  armor: ['Armour', '护甲'],
  clothing: ['Clothing', '衣物'],
  light: ['Light', '照明'],
  vessel: ['Vessel', '容器'],
  valuable: ['Valuable', '贵重品'],
  book: ['Reading', '读物'],
  scroll: ['Reading', '读物'],
}
/** What a tag lets it do (blue lines, the tool's abilities). */
const ABILITY: [string, string, string][] = [
  ['tool:axe', 'Fells trees, splits logs', '砍树、劈木头'],
  ['tool:pickaxe', 'Breaks rock and boulders', '凿开岩石和巨石'],
  ['tool:hoe', 'Tills the soil', '耕地'],
  ['tool:shovel', 'Digs up stumps and plants', '挖出树桩和作物'],
  ['tool:sickle', 'Harvests crops', '收割作物'],
  ['tool:fishing', 'Fishes in water', '在水边钓鱼'],
  ['tool:hammer', 'Finishes what is built', '完成搭建'],
  ['key', 'Opens what is locked', '打开锁住的东西'],
  ['fire-source', 'Sets things alight', '能点燃东西'],
  ['cookable', 'Can be cooked over a fire', '可以用火烤熟'],
  ['plantable', 'Can be planted', '可以种下'],
  ['fuel', 'Burns as fuel', '可以当燃料'],
]
/** Traits worth knowing (purple italic, Minecraft's lore). */
const TRAIT: Record<string, [string, string]> = {
  flammable: ['Flammable', '易燃'],
  fragile: ['Fragile', '易碎'],
  heavy: ['Heavy', '沉重'],
  sharp: ['Sharp', '锋利'],
  magical: ['Magical', '魔法'],
  arcane: ['Arcane', '奥术'],
  conductive: ['Conducts lightning', '导电'],
  holy: ['Holy', '神圣'],
  precious: ['Precious', '贵重'],
  liquid: ['Liquid', '液体'],
  raw: ['Raw', '生的'],
  cooked: ['Cooked', '熟的'],
}

export interface TipContext {
  /** The holder's own attack, added to a weapon's power (the engine's blow: atk + power). */
  atk: number
  /** A person's name by id (an owner). */
  nameOf: (id: string) => string | undefined
  /** The player's profession: whether a profession weapon is theirs to fight with. */
  profession?: string
}

/** The tooltip's lines for an item. */
export function tooltipHtml(it: ItemInfo, ctx: TipContext): string {
  const p = it.props
  const tags = new Set(it.tags)
  const line = (text: string, color: string, cls = '') => `<div class="tl${cls ? ` ${cls}` : ''}" style="color:${color}">${text}</div>`
  const out: string[] = []
  // the name, in its rarity's colour
  const quality = it.tags.find((g) => g.startsWith('quality:'))?.slice(8)
  out.push(line(esc(tx(it.name)), QUALITY_COLOR[quality ?? ''] ?? '#ffffff', 'name'))
  const family = it.type.split('/')[1]
  if (KIND[family]) out.push(line(L(...KIND[family]), '#aaaaaa'))
  // when held: the blow it makes (Minecraft's attributes, dark green)
  const power = typeof p.power === 'number' ? p.power : undefined
  const range = typeof p.range === 'number' ? p.range : 1
  const element = typeof p.element === 'string' ? ELEMENT[p.element] : undefined
  if (power !== undefined || element) {
    out.push('<div class="gap"></div>', line(L('When held:', '拿在手上时：'), '#aaaaaa'))
    if (power !== undefined) out.push(line(` ${ctx.atk + power} ${L('Attack Damage', '攻击伤害')}`, '#00aa00'))
    if (range > 1) out.push(line(` ${range} ${L('Reach', '攻击距离')}`, '#00aa00'))
    if (element) out.push(line(` ${L('Element', '元素')}: ${L(element[0], element[1])}`, element[2]))
  }
  // a weapon's own traits (the legendary arms)
  const pct = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.round(v * 100) : 0)
  if (pct(p.critChance)) out.push(line(` +${pct(p.critChance)}% ${L('Critical Chance', '暴击率')}`, '#00aa00'))
  if (pct(p.attackHaste)) out.push(line(` +${pct(p.attackHaste)}% ${L('Attack Speed', '攻击速度')}`, '#00aa00'))
  if (typeof p.lifesteal === 'number' && p.lifesteal > 0) out.push(line(` +${p.lifesteal} ${L('Health per hit', '生命/每次命中')}`, '#00aa00'))
  // worn in the off hand (the arm slot): the shield's defence and block (at most half the blows)
  if (p.slot === 'arm') {
    out.push('<div class="gap"></div>', line(L('In the off hand:', '装备在副手时：'), '#aaaaaa'))
    if (typeof p.def === 'number' && p.def > 0) out.push(line(` +${p.def} ${L('Defence', '防御')}`, '#00aa00'))
    if (pct(p.block)) out.push(line(` ${Math.min(50, pct(p.block))}% ${L('Block Chance', '格挡率')}`, '#00aa00'))
  }
  // whose it is to fight with: a profession's own, or common to all (and no profession's talents)
  const need = it.tags.find((g) => g.startsWith('profession:'))?.slice(11)
  if (need) {
    const role = PROFESSION_BY_ID[need]
    const name = role ? L(role.name.en, role.name.zh) : need
    out.push(line(esc(L(`${name} only`, `${name}专属`)), ctx.profession === need ? '#ffaa00' : '#ff5555'))
  } else if (family === 'weapon') out.push(line(L('Common weapon: no profession talents', '通用武器：不受职业天赋加成'), '#aaaaaa'))
  // what it does
  const abilities = ABILITY.filter(([tag]) => tags.has(tag))
  // food: what it restores, with the hunger bar's drumsticks (Minecraft's AppleSkin)
  const food = typeof p.food === 'number' ? p.food : 0
  // food feeds only; medicine eaten and anything drunk (a potion) also heals (core/eat, core/eat-medicine, core/drink)
  const heals = tags.has('drinkable') || (tags.has('edible') && tags.has('medicinal'))
  const heal = heals && typeof p.heal === 'number' ? p.heal + 1 : 0
  const eats = tags.has('edible') || tags.has('drinkable')
  if (abilities.length || eats) out.push('<div class="gap"></div>')
  if (eats && food > 0) out.push(line(`${'<i class="tdrum"></i>'.repeat(Math.ceil(food / 2))} +${food} ${L('Hunger', '饱食度')}`, '#ffaa00'))
  if (eats && heal > 0) out.push(line(`+${heal} ${L('Health', '生命')}`, '#ff5555'))
  for (const [, en, zh] of abilities) out.push(line(L(en, zh), '#5555ff'))
  // traits: the material and what it is like
  const material = it.tags.find((g) => g.startsWith('material:'))?.slice(9)
  const traits = [material && MATERIALS[material] ? L(MATERIALS[material].en, MATERIALS[material].zh) : '', ...it.tags.filter((g) => TRAIT[g]).map((g) => L(...TRAIT[g]))].filter(Boolean)
  if (traits.length) out.push(line(esc([...new Set(traits)].join(' · ')), '#aa00aa', 'lore'))
  // what has happened to it, and whose it is
  for (const s of it.statuses) {
    const def = STATUSES.find((d) => d.id === s)
    out.push(line(esc(def ? tx(def.name) : s), '#ff5555'))
  }
  if (typeof p.owner === 'string' && p.owner) out.push(line(esc(L(`Belongs to ${ctx.nameOf(p.owner) ?? p.owner}`, `属于${ctx.nameOf(p.owner) ?? p.owner}`)), '#ff5555'))
  return out.join('')
}

/** The box that follows the cursor over anything marked `data-item` (an item id, or a key `register`ed). */
export class Tooltip {
  private el: HTMLDivElement
  private frame?: Frame
  private extra = new Map<string, ItemInfo>()
  private over?: string
  private sig = ''
  private at = { x: 0, y: 0 }

  constructor(private ctx: () => TipContext) {
    this.el = document.createElement('div')
    this.el.className = 'mctip hidden'
    document.body.appendChild(this.el)
    document.addEventListener('mousemove', (e) => this.move(e))
    document.addEventListener('mousedown', () => this.hide())
  }

  /** An item that is not in the frame (a recipe's result, a material it needs). */
  register(key: string, info: ItemInfo): void {
    this.extra.set(key, info)
  }

  onFrame(f: Frame): void {
    this.frame = f
    // the item under the cursor may have changed (it burned, it was eaten) or gone
    if (this.over) this.show(this.over)
  }

  private find(key: string): ItemInfo | undefined {
    const f = this.frame
    if (f) {
      for (const s of f.player.slots) if (s?.item.id === key) return s.item
      if (f.player.held?.id === key) return f.player.held
      if (f.player.offhand?.id === key) return f.player.offhand
      const c = f.container?.contents.find((i) => i.id === key)
      if (c) return c
    }
    return this.extra.get(key)
  }

  private move(e: MouseEvent): void {
    this.at = { x: e.clientX, y: e.clientY }
    const host = (e.target as HTMLElement | null)?.closest?.('[data-item]') as HTMLElement | null
    const key = host?.dataset.item
    if (!key) return this.hide()
    this.show(key)
  }

  private show(key: string): void {
    const it = this.find(key)
    if (!it) return this.hide()
    this.over = key
    const sig = `${key}|${locale.value}|${JSON.stringify(it)}`
    if (sig !== this.sig) {
      this.sig = sig
      this.el.innerHTML = tooltipHtml(it, this.ctx())
    }
    this.el.classList.remove('hidden')
    // Minecraft's place: up and to the right of the cursor, kept on screen
    const r = this.el.getBoundingClientRect()
    let x = this.at.x + 14
    let y = this.at.y - 14
    if (x + r.width > window.innerWidth - 4) x = this.at.x - 14 - r.width
    if (y + r.height > window.innerHeight - 4) y = window.innerHeight - 4 - r.height
    this.el.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`
  }

  hide(): void {
    if (!this.over) return
    this.over = undefined
    this.el.classList.add('hidden')
  }
}
