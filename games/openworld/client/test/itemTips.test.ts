import { describe, expect, it, vi } from 'vitest'
import { textOf, type ItemInfo } from '@openworld/engine'
import { CLIENT_GAME } from '../src/game.ts'

vi.mock('phaser', () => ({ default: { Scene: class {} } }))

const tips = (type: string, props: ItemInfo['props'] = {}) => {
  const form = CLIENT_GAME.items.forms[type]
  const item: ItemInfo = { id: 'it', type, name: type, sprite: '', tags: form?.tags ?? [], statuses: [], props: { ...form?.props, ...props } }
  return (CLIENT_GAME.describeItem?.(item) ?? []).map((t) => textOf(t, 'en')).join('\n')
}

describe('the game item descriptions', () => {
  it('says the seed growth times and whether it bears again', () => {
    expect(tips('item/seed/turnip')).toContain('1 h per stage')
    expect(tips('item/seed/pumpkin')).toContain('8 h from seed')
    expect(tips('item/seed/tomato')).toContain('Bears again')
    expect(tips('item/seed/carrot')).not.toContain('Bears again')
  })
  it('shows the rod bait count, including an unbaited rod', () => {
    expect(tips('item/tool/fishing_rod', { bait: 3 })).toContain('Bait remaining: 3 casts')
    expect(tips('item/tool/fishing_rod')).toContain('Bait remaining: 0 casts')
  })
})
