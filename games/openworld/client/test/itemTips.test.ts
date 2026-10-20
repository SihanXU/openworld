import { describe, expect, it, vi } from 'vitest'
import { textOf, type ItemInfo } from '@openworld/engine'
import { CLIENT_GAME } from '../src/game.ts'
import { fishingBaitContextAction, fishingRodIconDecoration } from '../src/itemTips.ts'

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

  it('decorates baited rods from their saved bait identity and removes it when spent', () => {
    const rod: ItemInfo = { id: 'rod', type: 'item/tool/fishing_rod', name: 'Fishing Rod', sprite: 'item:rod', tags: ['tool:fishing'], statuses: [], props: { bait: 3 } }
    const forms = { 'item/misc/bait': { sprite: 'item:bait' }, 'item/test/masterwork-bait': { sprite: 'item:masterwork-bait' } }
    expect(fishingRodIconDecoration(rod, forms)?.sprite).toBe('item:bait') // legacy save
    rod.props.baitKey = JSON.stringify(['item/test/masterwork-bait', 'Masterwork Bait', ['quality:masterwork'], []])
    expect(fishingRodIconDecoration(rod, forms)?.sprite).toBe('item:masterwork-bait')
    rod.props.bait = 0
    expect(fishingRodIconDecoration(rod, forms)).toBeUndefined()
  })

  it('names the legacy bait-on-rod action and hides only its meaningless put option', () => {
    const bait: ItemInfo = { id: 'bait', type: 'item/misc/bait', name: 'Masterwork Bait', sprite: 'item:bait', tags: ['bait', 'quality:masterwork'], statuses: [], props: { casts: 7 } }
    const rod: ItemInfo = { id: 'rod', type: 'item/tool/fishing_rod', name: 'Fishing Rod', sprite: 'item:rod', tags: ['tool:fishing'], statuses: [], props: {} }
    expect(fishingBaitContextAction('use', bait, rod)).toEqual({ en: 'Apply bait (+7 casts)', zh: '装上鱼饵（+7次）' })
    expect(fishingBaitContextAction('put', bait, rod)).toBe(false)
    expect(fishingBaitContextAction('put', rod, bait)).toBeUndefined()
  })
})
