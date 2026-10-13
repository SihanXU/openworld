// OpenWorld as a bundle (src/bundle.ts): the engine's player, given only its data, has the game its own app
// has — the same tables, and the same answers from the ones it works out (a profession's tree, a station's name).

import { describe, expect, it, vi } from 'vitest'
import { clientGameOf } from '@openworld/runtime/src/bundle.ts'
import type { ClientGame } from '@openworld/runtime/src/game.ts'
import { openworldBundle } from '../src/bundle.ts'
import { CLIENT_GAME } from '../src/game.ts'
import plugin from '../src/plugin.ts'

// (a panel reaches the renderer's text helper; only Phaser's browser base is mocked)
vi.mock('phaser', () => ({ default: { Scene: class {} } }))

describe('OpenWorld from its bundle', () => {
  const bundle = JSON.parse(JSON.stringify(openworldBundle({ name: { en: 'OpenWorld', zh: 'OpenWorld' }, version: 'test' })))
  const g = clientGameOf(bundle, 'https://example.org/games/openworld/bundle.json')

  it('has its tables as its app has them', () => {
    expect(g.items).toEqual(CLIENT_GAME.items)
    expect(g.skills.all).toEqual(CLIENT_GAME.skills.all)
    expect(g.skills.professions).toEqual(CLIENT_GAME.skills.professions)
    expect(g.boons).toEqual(CLIENT_GAME.boons)
    expect(g.crafting.recipes).toEqual(CLIENT_GAME.crafting.recipes)
    expect(g.looks.parts).toEqual(CLIENT_GAME.looks.parts)
    expect(g.looks.player).toEqual(CLIENT_GAME.looks.player)
    expect([...g.looks.worn].sort()).toEqual([...CLIENT_GAME.looks.worn].sort())
    expect(g.ontology()).toEqual(CLIENT_GAME.ontology())
    expect(bundle.game.modules).toEqual(['classes', 'bosses', 'waypoints', 'boons', 'needs', 'society', 'loot'])
  })

  it('has its shops, each shelf saying whether it buys from one', () => {
    expect(g.crafting.shops).toEqual(CLIENT_GAME.crafting.shops)
    expect(g.crafting.shops!.map((s) => s.station)).toEqual(['stall', 'store', 'books'])
    expect(g.crafting.shops!.flatMap((s) => s.shelves.filter((x) => x.sell).map((x) => x.group))).toEqual(['sell', 'store-sell'])
  })

  it('its plugin brings its own panels (code, not data): the companion under two keys, the Held Ground', () => {
    expect(bundle.client.panels).toBeUndefined()
    const more = plugin(g) as Partial<ClientGame>
    expect(Object.keys(more.panels ?? {})).toEqual(['companion', 'boons', 'haven'])
    expect(more.panels!.companion).toBe(more.panels!.boons)
  })

  it('each of its panels loads when it is first opened, and makes a panel', async () => {
    for (const make of new Set(Object.values(CLIENT_GAME.panels ?? {}))) {
      const panel = await make({ host: {} as HTMLElement, send: {} as never, close: () => {}, paint: () => {}, openQuests: () => {} })
      expect(typeof panel.show).toBe('function')
      expect(typeof panel.render).toBe('function')
    }
  })

  it('works out what its app computes, the same', () => {
    for (const p of ['', ...CLIENT_GAME.skills.professions.map((x) => x.id)]) {
      expect(g.skills.branchesFor(p), p).toEqual(CLIENT_GAME.skills.branchesFor(p))
      expect(g.skills.forProfession(p).map((s) => s.id), p).toEqual(CLIENT_GAME.skills.forProfession(p).map((s) => s.id))
    }
    for (const r of CLIENT_GAME.crafting.recipes) if (r.station) expect(g.crafting.stationName(r.station)).toEqual(CLIENT_GAME.crafting.stationName(r.station))
  })
})
