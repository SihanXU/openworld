import { describe, expect, it, vi } from 'vitest'
import { Engine, RuleLibrary, buildSandbox, snapshot, tickAt } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'
import { fishingActive, fishingInput } from '@openworld/modules'

function fishingPond(enabled = true) {
  const ontology = buildOntology() as ReturnType<typeof buildOntology> & { fishing?: { maps: string[] } }
  ontology.fishing = { maps: enabled ? ['sandbox'] : [], extraType: 'item/food/fish/raw' }
  const eng = buildSandbox({
    terrain: [['grass', 'water', 'grass'], ['grass', 'grass', 'grass'], ['grass', 'grass', 'grass']],
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 1, y: 1, props: { fishExtra: 2 } },
      { key: 'rod', type: 'item/tool/fishing_rod', x: 1, y: 1, heldBy: 'actor', props: { bait: 1 } },
    ],
    event: {},
  }, ontology, new RuleLibrary(BASE_RULES))
  eng.author(() => { eng.world.state.tick = tickAt(1, 12) })
  eng.controls.sync()
  vi.spyOn(eng.world, 'rand').mockReturnValue(0)
  return eng
}

describe('the Held Ground fishing fight', () => {
  it('keeps a caught candidate hidden while the configured map waits for a bite', () => {
    const eng = fishingPond()
    const plan = eng.controls.plan('use', { x: 1, y: 0 })!

    eng.controls.run(plan, true)

    expect(snapshot(eng).fishing).toMatchObject({ phase: 'waiting', bait: 0 })
    expect(eng.controls.count('item/food/fish/raw')).toBe(0)
    expect(eng.controls.count('item/food/fish/carp')).toBe(0)
    expect(eng.world.get('rod')?.props?.bait).toBe(0)
  })

  it('lands a hidden candidate once after the bite and a player-controlled fight', () => {
    const eng = fishingPond()
    vi.spyOn(eng.world, 'rand').mockReturnValue(0.5)
    const plan = eng.controls.plan('use', { x: 1, y: 0 })!
    eng.controls.run(plan, true)

    for (let i = 0; i < 25 && snapshot(eng).fishing?.phase === 'waiting'; i++) eng.tick()
    expect(snapshot(eng).fishing?.phase).toBe('bite')
    expect(eng.controls.count('item/food/fish/raw')).toBe(0)
    fishingInput(eng, 'press')
    expect(snapshot(eng).fishing?.phase).toBe('fight')

    for (let i = 0; i < 300 && fishingActive(eng); i++) {
      const view = snapshot(eng).fishing
      if (view?.phase !== 'fight') continue
      fishingInput(eng, view.bar < view.fish ? 'press' : 'release')
      eng.tick()
    }

    expect(fishingActive(eng)).toBe(false)
    expect(eng.controls.count('item/food/fish/raw')).toBe(3)
    expect(fishingInput(eng, 'press')).toBe(false)
    for (let i = 0; i < 5; i++) eng.tick()
    expect(eng.controls.count('item/food/fish/raw')).toBe(3)
  })

  it('requires a fresh press after the bite, ignores foreign actor events, and cancels without a catch', () => {
    const eng = fishingPond()
    const plan = eng.controls.plan('use', { x: 1, y: 0 })!
    eng.controls.run(plan, true)
    fishingInput(eng, 'press')
    const remaining = snapshot(eng).fishing?.remaining
    eng.author(() => eng.world.add({ id: 'other', type: 'actor/person/player', place: { on: 'tile', map: 'sandbox', x: 2, y: 2 }, props: { hp: 20, maxHp: 20 } }))
    eng.queue({ kind: 'impulse/notify', host: { e: 'other' }, roles: { source: { e: 'other' } }, params: { what: 'fishing-step' }, origin: 'world' })
    expect(snapshot(eng).fishing?.remaining).toBe(remaining)
    eng.queue({ kind: 'impulse/notify', host: { e: 'other' }, roles: { source: { e: 'other' } }, params: { what: 'fishing-input', action: 'cancel' }, origin: 'world' })
    expect(fishingActive(eng)).toBe(true)

    for (let i = 0; i < 25 && snapshot(eng).fishing?.phase === 'waiting'; i++) eng.tick()
    expect(snapshot(eng).fishing?.phase).toBe('bite')
    fishingInput(eng, 'press')
    expect(snapshot(eng).fishing?.phase).toBe('bite')
    fishingInput(eng, 'release')
    fishingInput(eng, 'press')
    expect(snapshot(eng).fishing?.phase).toBe('fight')
    fishingInput(eng, 'cancel')
    expect(fishingActive(eng)).toBe(false)
    for (let i = 0; i < 5; i++) eng.tick()
    expect(eng.controls.count('item/food/fish/raw')).toBe(0)
  })

  it('keeps the legacy immediate catch outside configured maps', () => {
    const eng = fishingPond(false)
    const plan = eng.controls.plan('use', { x: 1, y: 0 })!
    eng.controls.run(plan, true)

    expect(fishingActive(eng)).toBe(false)
    expect(eng.controls.count('item/food/fish/carp')).toBe(1)
    expect(eng.controls.count('item/food/fish/raw')).toBe(2)
  })

  it('does not restore an unfinished line or refund bait after the world is loaded again', () => {
    const eng = fishingPond()
    const plan = eng.controls.plan('use', { x: 1, y: 0 })!
    eng.controls.run(plan, true)
    expect(fishingActive(eng)).toBe(true)
    expect(eng.world.get('rod')?.props?.bait).toBe(0)

    const loaded = new Engine(structuredClone(eng.world.state), structuredClone(eng.world.onto.data), new RuleLibrary(BASE_RULES))
    expect(fishingActive(loaded)).toBe(false)
    expect(loaded.world.get('rod')?.props?.bait).toBe(0)
    for (let i = 0; i < 200; i++) loaded.tick()
    expect(loaded.controls.count('item/food/fish/raw')).toBe(0)
  })
})
