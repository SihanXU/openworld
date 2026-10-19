import { describe, expect, it, vi } from 'vitest'
import { Engine, RuleLibrary, buildSandbox, snapshot, tickAt } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'
import { fishingActive, fishingInput } from '@openworld/modules'

function fishingPond(enabled = true, random = 0) {
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
  vi.spyOn(eng.world, 'rand').mockReturnValue(random)
  return eng
}

type ProjectedFishingView = NonNullable<ReturnType<typeof snapshot>['fishing']> & {
  fishItem?: { id: string; type: string; sprite: string; name: unknown }
}

function fishingView(eng: ReturnType<typeof fishingPond>): ProjectedFishingView | undefined {
  return snapshot(eng).fishing as ProjectedFishingView | undefined
}

function cast(eng: ReturnType<typeof fishingPond>): void {
  const plan = eng.controls.plan('use', { x: 1, y: 0 })!
  eng.controls.run(plan, true)
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

  it('gives an ordinary catch a two-second bite window and shows its real item only in the fight', () => {
    const eng = fishingPond(true, 0.5)
    cast(eng)
    expect(fishingView(eng)?.phase).toBe('waiting')
    expect(fishingView(eng)?.fishItem).toBeUndefined()

    for (let i = 0; i < 30 && fishingView(eng)?.phase === 'waiting'; i++) eng.tick()
    expect(fishingView(eng)?.phase).toBe('bite')
    expect(fishingView(eng)?.remaining).toBe(2)
    expect(fishingView(eng)?.fishItem).toBeUndefined()

    fishingInput(eng, 'press')
    const fight = fishingView(eng)
    expect(fight?.phase).toBe('fight')
    expect(fight?.barSize).toBeCloseTo(0.4)
    expect(fight?.fishItem).toMatchObject({ type: 'item/food/fish/raw' })
    const caughtType = fight!.fishItem!.type
    expect(fight!.fishItem!.sprite).toBe(eng.world.onto.resolve(caughtType).sprite ?? caughtType)

    for (let i = 0; i < 300 && fishingActive(eng); i++) {
      const view = fishingView(eng)
      if (view?.phase !== 'fight') continue
      fishingInput(eng, view.bar < view.fish ? 'press' : 'release')
      eng.tick()
    }

    expect(fishingActive(eng)).toBe(false)
    expect(eng.controls.count(caughtType)).toBe(caughtType === 'item/food/fish/raw' ? 3 : 1)
  })

  it('gives a rare candidate the narrower 34 percent control zone', () => {
    const eng = fishingPond(true, 0)
    cast(eng)
    for (let i = 0; i < 30 && fishingView(eng)?.phase === 'waiting'; i++) eng.tick()
    expect(fishingView(eng)?.phase).toBe('bite')
    fishingInput(eng, 'press')

    const fight = fishingView(eng)
    expect(fight?.fishItem?.type).toBe('item/food/fish/carp')
    expect(fight?.fishItem?.type).not.toBe('item/food/fish/raw')
    expect(fight?.barSize).toBeCloseTo(0.34)
  })

  it('moves the fish in bounded smooth increments instead of three-tick jumps', () => {
    const eng = fishingPond(true, 0.5)
    cast(eng)
    for (let i = 0; i < 30 && fishingView(eng)?.phase === 'waiting'; i++) eng.tick()
    fishingInput(eng, 'press')
    fishingInput(eng, 'release')

    const positions = [fishingView(eng)!.fish]
    for (let i = 0; i < 12 && fishingActive(eng); i++) {
      eng.tick()
      const view = fishingView(eng)
      if (view?.phase === 'fight') positions.push(view.fish)
    }
    const deltas = positions.slice(1).map((position, i) => Math.abs(position - positions[i]!))
    let movingRun = 0
    let longestMovingRun = 0
    for (const delta of deltas) {
      movingRun = delta > 0.00001 ? movingRun + 1 : 0
      longestMovingRun = Math.max(longestMovingRun, movingRun)
    }

    expect(positions.every((position) => position >= 0.04 && position <= 0.96)).toBe(true)
    expect(Math.max(...deltas)).toBeLessThanOrEqual(0.05)
    expect(longestMovingRun).toBeGreaterThanOrEqual(4)
  })

  it('loses less progress on a miss than it gains on a controlled tick', () => {
    const eng = fishingPond(true, 0.5)
    cast(eng)
    for (let i = 0; i < 30 && fishingView(eng)?.phase === 'waiting'; i++) eng.tick()
    fishingInput(eng, 'press')

    const startingProgress = fishingView(eng)!.progress
    eng.tick()
    const successDelta = fishingView(eng)!.progress - startingProgress
    expect(successDelta).toBeGreaterThan(0)

    let failedDelta = 0
    for (let i = 0; i < 20 && fishingActive(eng); i++) {
      fishingInput(eng, 'release')
      const before = fishingView(eng)?.progress
      eng.tick()
      const after = fishingView(eng)?.progress
      if (before !== undefined && after !== undefined && after < before) {
        failedDelta = after - before
        break
      }
    }
    expect(failedDelta).toBeLessThan(0)
    expect(successDelta).toBeGreaterThan(Math.abs(failedDelta))
  })

  it('lets an unattended fish escape without awarding the chosen fish or extra fish', () => {
    const eng = fishingPond(true, 0.5)
    cast(eng)
    for (let i = 0; i < 30 && fishingView(eng)?.phase === 'waiting'; i++) eng.tick()
    expect(fishingView(eng)?.phase).toBe('bite')
    fishingInput(eng, 'press')
    fishingInput(eng, 'release')

    for (let i = 0; i < 500 && fishingActive(eng); i++) {
      fishingInput(eng, 'release')
      eng.tick()
    }

    expect(fishingActive(eng)).toBe(false)
    expect(eng.controls.count('item/food/fish/raw')).toBe(0)
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
