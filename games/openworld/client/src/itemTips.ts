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
    out.push({ en: 'Deep water: more golden carp, and pike. Eels at night; catfish in rain.', zh: '深水更容易出金鳞鲤，还能钓狗鱼；夜里有鳗鱼，雨天有鲶鱼。' })
  }
  if (item.type === 'item/vessel/bucket/empty') out.push({ en: 'Fill at water to water crops, or milk a fed cow.', zh: '对水使用可装水浇地，也可给喂饱的牛挤奶。' })
  return out
}
