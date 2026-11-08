import { expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, registerWorkshopPackage, runWorkshopUse, trialWorkshopPackage, workshopFlights, type WorkshopDraft } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

it('a person following the player actually takes twice as long between steps when coated with sticky', () => {
  const walk = (sticky: boolean) => {
    const eng = buildSandbox({ terrain: Array.from({ length: 4 }, () => Array(10).fill('grass')), entities: [
      { key: 'actor', type: 'actor/person/player', x: 0, y: 1, props: { hunger: 100, maxHunger: 100 } },
      { key: 'berry', type: 'item/food/berries', x: 0, y: 1, heldBy: 'actor' },
    ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const w = eng.world
    const npc = eng.author(() => w.add({ id: 'follower', type: 'actor/person/villager', place: { on: 'tile', map: 'sandbox', x: 1, y: 1 }, props: { follow: 'actor', hunger: 100, maxHunger: 100, age: 30 }, npc: { role: 'villager', schedule: [] } }))
    const draft: WorkshopDraft = { id: 'movement-coating', revision: 1, typeId: 'item/food/berries', plan: { version: 1, uses: [{ id: 'throw', label: { en: 'Throw sticky coating', zh: '投掷黏稠涂层' }, capability: 'throw-coat', target: 'person', params: { substance: 'sticky', duration: 100, power: 0 } }] } }
    const report = trialWorkshopPackage(eng, draft)
    expect(report.errors).toEqual([])
    expect(registerWorkshopPackage(eng, draft, report).ok).toBe(true)
    if (sticky) {
      expect(runWorkshopUse(eng, draft.id, 'throw', { e: npc.id }, 'berry')).toBe(true)
      for (let i = 0; i < 5 && workshopFlights(eng).length; i++) eng.tick()
      expect(eng.combat.delay(npc, 1, 'move')).toBe(2)
    }
    eng.author(() => eng.teleport(w.player, { map: 'sandbox', x: 8, y: 1 }))
    const moves: { tick: number; x: number }[] = []
    let x = w.posOf(npc)!.x
    for (let i = 0; i < 30 && moves.length < 2; i++) {
      eng.tick()
      const next = w.posOf(npc)!.x
      if (next !== x) { moves.push({ tick: w.state.tick, x: next }); x = next }
    }
    expect(moves).toHaveLength(2)
    return moves
  }
  const normal = walk(false), coated = walk(true)
  expect(normal[1].tick - normal[0].tick).toBe(4)
  expect(coated[1].tick - coated[0].tick).toBe(8)
  expect(coated[0].x).toBe(normal[0].x)
})
