import { describe, expect, it } from 'vitest'
import type { ItemInfo } from '@openworld/engine'
import { itemIconSignature, useGame, type ClientGame } from '../src/game.ts'

const rod: ItemInfo = {
  id: 'rod', type: 'item/tool/fishing_rod', name: 'Fishing Rod', sprite: 'item:rod',
  tags: ['tool:fishing'], statuses: [], props: { bait: 3 },
}

describe('item icon cache identity', () => {
  it('invalidates the HUD and inventory signature when a loaded bait changes or runs out', () => {
    useGame({
      id: 'test',
      itemIconDecoration: (item: ItemInfo) => Number(item.props.bait) > 0
        ? { sprite: item.props.baitKey === 'masterwork' ? 'item:masterwork-bait' : 'item:bait', x: 0.64, y: 0.63, size: 0.34 }
        : undefined,
    } as unknown as ClientGame)

    const key = () => itemIconSignature([rod])
    const ordinary = key()
    expect(key()).toBe(ordinary)

    rod.props.baitKey = 'masterwork'
    const masterwork = key()
    expect(masterwork).not.toBe(ordinary)

    rod.props.bait = 0
    expect(key()).not.toBe(masterwork)
  })
})
