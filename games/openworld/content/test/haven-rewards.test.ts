import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox } from '@openworld/engine'
import { BASE_RULES, HAVEN_UPGRADES, STORY_RULES, buildOntology } from '../src/index.ts'

const rewardUpgrades = HAVEN_UPGRADES.filter((upgrade) => upgrade.coins > 0)

function havenFor(upgradeId: string, land = 2) {
  const upgrade = HAVEN_UPGRADES.find((candidate) => candidate.id === upgradeId)!
  const eng = buildSandbox({
    terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 1, y: 2 },
      { key: 'steward', type: 'actor/person/steward', x: 1, y: 1, tags: ['haven-steward'] },
    ],
    event: {},
  }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const w = eng.world
  eng.author(() => {
    w.setFact('haven.size', land)
    for (const need of upgrade.needs) w.setProp(w.get('steward')!, `haven.stock.${need.type}`, need.count)
  })
  return { eng, upgrade, w }
}

describe('the Held Ground upgrade rewards', () => {
  it.each(rewardUpgrades)('grants $id its full reward only once', (upgrade) => {
    const land = upgrade.track === 'land' ? upgrade.value - 1 : upgrade.land
    const { eng, w } = havenFor(upgrade.id, land)
    const countCoins = () => eng.controls.count('item/misc/thornmark')

    eng.controls.talk('steward', 'haven', `build:${upgrade.id}`)
    for (let i = 0; i < 5; i++) eng.tick()

    expect(w.fact(upgrade.fact)).toBe(upgrade.value)
    expect(countCoins()).toBe(upgrade.coins)
    for (const need of upgrade.needs) expect(w.prop(w.get('steward')!, `haven.stock.${need.type}`)).toBe(0)

    eng.author(() => {
      for (const need of upgrade.needs) w.setProp(w.get('steward')!, `haven.stock.${need.type}`, need.count)
    })
    eng.controls.talk('steward', 'haven', `build:${upgrade.id}`)
    for (let i = 0; i < 5; i++) eng.tick()

    expect(w.fact(upgrade.fact)).toBe(upgrade.value)
    expect(countCoins()).toBe(upgrade.coins)
    for (const need of upgrade.needs) expect(w.prop(w.get('steward')!, `haven.stock.${need.type}`)).toBe(need.count)
  })

  it.each([
    { label: 'land is too low', land: 1, short: undefined },
    { label: 'stock is short', land: 2, short: 'item/material/iron_ingot' },
  ])('does not spend stock or grant coins when $label', ({ land, short }) => {
    const { eng, upgrade, w } = havenFor('lodge3', land)
    if (short) eng.author(() => w.setProp(w.get('steward')!, `haven.stock.${short}`, 1))
    const stockBefore = Object.fromEntries(upgrade.needs.map((need) => [
      need.type,
      w.prop(w.get('steward')!, `haven.stock.${need.type}`),
    ]))

    eng.controls.talk('steward', 'haven', `build:${upgrade.id}`)
    for (let i = 0; i < 5; i++) eng.tick()

    expect(w.fact(upgrade.fact)).toBeUndefined()
    expect(eng.controls.count('item/misc/thornmark')).toBe(0)
    expect(Object.fromEntries(upgrade.needs.map((need) => [
      need.type,
      w.prop(w.get('steward')!, `haven.stock.${need.type}`),
    ]))).toEqual(stockBefore)
  })
})
