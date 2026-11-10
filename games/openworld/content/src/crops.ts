// Vegetable families share the existing sow/water/grow/harvest rules. Artwork uses the
// same ids in the client catalogue; adding a family requires no actor-specific mechanic.
export interface VegetableCrop {
  id: string
  en: string
  zh: string
  food: number
  heal: number
  perennial?: boolean
}

export const VEGETABLE_CROPS: readonly VegetableCrop[] = [
  { id: 'carrot', en: 'Carrot', zh: '胡萝卜', food: 3, heal: 2 },
  { id: 'turnip', en: 'Turnip', zh: '芜菁', food: 4, heal: 2 },
  { id: 'tomato', en: 'Tomato', zh: '番茄', food: 2, heal: 3, perennial: true },
  { id: 'pumpkin', en: 'Pumpkin', zh: '南瓜', food: 6, heal: 3 },
  // the homestead's (docs/homestead.md), after Stardew's fields: roots, heads and melons, and five that bear again
  { id: 'parsnip', en: 'Parsnip', zh: '防风草', food: 2, heal: 1 },
  { id: 'potato', en: 'Potato', zh: '土豆', food: 4, heal: 2 },
  { id: 'radish', en: 'Radish', zh: '小萝卜', food: 2, heal: 2 },
  { id: 'cauliflower', en: 'Cauliflower', zh: '花椰菜', food: 5, heal: 3 },
  { id: 'melon', en: 'Melon', zh: '甜瓜', food: 6, heal: 4 },
  { id: 'corn', en: 'Corn', zh: '玉米', food: 3, heal: 2, perennial: true },
  { id: 'blueberry', en: 'Blueberries', zh: '蓝莓', food: 1, heal: 2, perennial: true },
  { id: 'strawberry', en: 'Strawberry', zh: '草莓', food: 2, heal: 2, perennial: true },
  { id: 'pepper', en: 'Hot Pepper', zh: '辣椒', food: 1, heal: 1, perennial: true },
  { id: 'eggplant', en: 'Eggplant', zh: '茄子', food: 3, heal: 2, perennial: true },
]

/** The four Firstlight's garden grows (illustrated, with their source atlases); the rest come from the Held Ground's stall. */
export const GARDEN_CROPS: readonly VegetableCrop[] = VEGETABLE_CROPS.slice(0, 4)

export const CROP_STAGES = ['sprout', 'young', 'ripe'] as const

/** Authored species vocabulary. Pack variants are references, not AI-generated species art. */
export const FLOWER_CROPS = [
  { id: 'sunflower', en: 'Sunflower', zh: '向日葵', aliases: ['sunflower', '向日葵'], perennial: false, flowerTile: [0, 11] },
  { id: 'orchid', en: 'Orchid', zh: '兰花', aliases: ['orchid', '兰花', '兰草'], perennial: true, flowerTile: [6, 11] },
  { id: 'sunrose', en: 'Sunrose', zh: '太阳花', aliases: ['sunrose', '太阳花', '松叶牡丹'], perennial: true, flowerTile: [1, 11] },
  { id: 'rose', en: 'Rose', zh: '玫瑰', aliases: ['rose', '玫瑰'], perennial: true, flowerTile: [3, 11] },
  { id: 'tulip', en: 'Tulip', zh: '郁金香', aliases: ['tulip', '郁金香'], perennial: true, flowerTile: [2, 11] },
] as const

export const GARDEN_SPECIES = [
  ...FLOWER_CROPS.map(c => ({ id: c.id as string, aliases: [...c.aliases] as string[] })),
  { id: 'wheat', aliases: ['wheat', '小麦', '麦子', '麦田'] },
]

/** Game hours per watered stage; other plants keep the two-hour pace. */
export const cropHours = (id: string): number =>
  ['turnip', 'parsnip', 'radish'].includes(id) ? 1 :
  ['pumpkin', 'cauliflower', 'melon', 'corn', 'blueberry'].includes(id) ? 4 : 2
