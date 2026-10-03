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
]

export const CROP_STAGES = ['sprout', 'young', 'ripe'] as const
