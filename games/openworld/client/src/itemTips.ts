// The game's production details, kept outside the reusable runtime and the bundle's data tables.
import type { ItemInfo, Text } from '@openworld/engine'

export function describeItem(item: ItemInfo): Text[] {
  const out: Text[] = []
  const hours = item.props.growHours
  if (typeof hours === 'number' && hours > 0) {
    out.push({ en: `Growth: ${hours} h per stage · ${hours * 2} h from seed. Water each stage.`, zh: `生长：每阶段 ${hours} 游戏小时，播种后共 ${hours * 2} 小时成熟。每阶段需浇水。` })
    if (item.props.regrows || item.props.regrowType) out.push({ en: 'Bears again after harvest; water for another stage.', zh: '收获后会再生；再浇水可继续生长一阶段。' })
  }
  if (item.tags.includes('tool:fishing')) {
    const bait = Math.max(0, Math.floor(Number(item.props.bait) || 0))
    out.push({ en: `Bait remaining: ${bait} casts`, zh: `已挂鱼饵：还可甩 ${bait} 竿` })
    out.push({ en: 'Hold the rod and left-click water to cast.', zh: '手持鱼竿，左键点击水面抛竿。' })
    out.push({ en: 'Right-click yourself while holding the rod to choose and confirm bait. You can also hold bait and Shift+right-click the rod in your bag; each bait adds its listed number of casts.', zh: '手持鱼竿时右键点自己即可选择并确认鱼饵。也可手持鱼饵，在背包里 Shift+右键鱼竿；每份鱼饵会增加其标注的抛竿次数。' })
    out.push({ en: 'Deep water: more golden carp, and pike. Eels at night; catfish in rain.', zh: '深水更容易出金鳞鲤，还能钓狗鱼；夜里有鳗鱼，雨天有鲶鱼。' })
  }
  if (item.tags.includes('bait')) out.push({ en: `Adds ${Math.max(0, Math.floor(Number(item.props.casts) || 0))} baited casts. Bait of a different name or quality can only be used after the rod's current bait is spent.`, zh: `增加 ${Math.max(0, Math.floor(Number(item.props.casts) || 0))} 次挂饵抛竿。名称或品质不同的鱼饵，要等鱼竿上现有鱼饵用完后才能更换。` })
  if (item.type === 'item/vessel/bucket/empty') out.push({ en: 'Fill at water to water crops, or milk a fed cow.', zh: '对水使用可装水浇地，也可给喂饱的牛挤奶。' })
  return out
}

/** The bait shown on a rod is a sprite from the game's forms; legacy rods use the ordinary bait. */
export function fishingRodIconDecoration(item: ItemInfo, forms: Record<string, { sprite: string }>): { sprite: string; x: number; y: number; size: number } | undefined {
  if (!item.tags.includes('tool:fishing') || !(Number(item.props.bait) > 0)) return undefined
  const fallback = 'item/misc/bait'
  let type = fallback
  if (typeof item.props.baitKey === 'string') {
    try {
      const identity: unknown = JSON.parse(item.props.baitKey)
      if (Array.isArray(identity) && typeof identity[0] === 'string' && forms[identity[0]]) type = identity[0]
    } catch {
      // Old or unrecognized identity metadata keeps the familiar bait sprite.
    }
  }
  const sprite = forms[type]?.sprite ?? forms[fallback]?.sprite
  return sprite ? { sprite, x: 0.64, y: 0.63, size: 0.34 } : undefined
}

/** The game's context-menu wording for a bait held over a fishing rod. */
export function fishingBaitContextAction(key: 'use' | 'put', instrument: ItemInfo, target: ItemInfo): Text | false | undefined {
  if (!instrument.tags.includes('bait') || !target.tags.includes('tool:fishing')) return undefined
  if (key === 'put') return false
  const casts = Math.max(0, Math.floor(Number(instrument.props.casts) || 0))
  return { en: `Apply bait (+${casts} casts)`, zh: `装上鱼饵（+${casts}次）` }
}
