// What a container's capacity counts: slots, not things. A slot holds a stack of one kind — the same
// type, name, tags and statuses (stacks.ts) — up to STACK_MAX, and a kind beyond that takes the next
// slot. The chest panel draws its cells by that same key, so what the rule calls full is what the
// panel shows taken. Played through the same entry point as the player's keys (storage.test.ts).

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, countAt, itemInfo, slotsOf, snapshot, splitStacks, stackKey, type Engine, type Id, type Key, type Scenario, type ScenarioEntity } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()

/** The player at (2,2) facing up, at whatever stands at (2,1); `held` is what is in their hand. */
function play(front: Omit<ScenarioEntity, 'x' | 'y'>[], held?: string | Omit<ScenarioEntity, 'key' | 'x' | 'y' | 'heldBy'>): Engine {
  const rows = Array.from({ length: 5 }, () => Array(5).fill('grass'))
  const sc: Scenario = {
    terrain: rows,
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      ...(held ? [{ ...(typeof held === 'string' ? { type: held } : held), key: 'held', x: 2, y: 2, heldBy: 'actor' }] : []),
      ...front.map((e) => ({ ...e, x: 2, y: 1 })),
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE_RULES))
  eng.world.get('actor')!.facing = 'up'
  return eng
}

/** Press a key at the tile in front: the rules it resolved to. An input that would change nothing is not offered. */
function press(eng: Engine, key: Key): { rules: string[]; offered: boolean } {
  const plan = eng.controls.plan(key)
  eng.trace.length = 0
  let offered = false
  if (plan) {
    offered = true
    eng.controls.run(plan, true)
  } else if (key === 'put' || key === 'take') {
    const front = eng.world.front(eng.world.player)!
    const target = eng.controls.layers(front)[0]
    if (target) eng.act(key, eng.world.state.player, target, { instrument: key === 'put' ? (eng.world.player.held ? { e: eng.world.player.held } : null) : null })
  }
  return { rules: eng.trace.filter((t) => t.defined && t.rule).map((t) => t.rule!), offered }
}

/** A chest, and whatever it already holds. */
const chest = (inside: ScenarioEntity[], statuses = ['open']): Omit<ScenarioEntity, 'x' | 'y'>[] => [
  { key: 'chest', type: 'fixture/container/chest', statuses },
  ...inside.map((e, i) => ({ ...e, key: `i${i}`, inside: 'chest' })),
]

/** n things of one type, each told apart from the rest by its tag: n kinds. */
const kinds = (n: number, type = 'item/material/stone'): ScenarioEntity[] =>
  Array.from({ length: n }, (_, i) => ({ key: '', type, x: 0, y: 0, tags: [`kind${i}`] }))

/** n stones of one kind (no tag tells them apart). */
const stones = (n: number): ScenarioEntity[] => Array.from({ length: n }, () => ({ key: '', type: 'item/material/stone', x: 0, y: 0 }))

const inside = (eng: Engine, holder: Id = 'chest') => eng.world.get(holder)!.contents ?? []

/** The cells the panel would draw for a container: one per kind, by the key it groups with. */
const cells = (eng: Engine, holder: Id = 'chest') => splitStacks(inside(eng, holder).map((id) => itemInfo(eng, id)!)).length

describe('a container counts its slots, not its things', () => {
  it('twelve of one kind are one slot: the chest still takes the one in hand', () => {
    const eng = play(chest(stones(12)), 'item/material/stone')
    expect(press(eng, 'put').rules).toContain('core/taken')
    expect(inside(eng)).toHaveLength(13)
    expect(cells(eng)).toBe(1)
  })

  it('twelve kinds fill a chest of twelve; a thirteenth kind is refused, and the panel shows it full', () => {
    const eng = play(chest(kinds(12)), 'item/food/apple')
    const put = press(eng, 'put')
    expect(put.rules).toContain('core/receive-store')
    expect(put.offered).toBe(false)
    expect(inside(eng)).toHaveLength(12)
    expect(cells(eng)).toBe(12)
  })

  it('a kind the chest already holds takes no new slot: a stack with room still takes one more', () => {
    const eng = play(chest(kinds(12)), { type: 'item/material/stone', tags: ['kind0'] })
    expect(press(eng, 'put').rules).toContain('core/taken')
    expect(inside(eng)).toHaveLength(13)
    expect(cells(eng)).toBe(12)
  })

  it('the same type under another name is another slot: the dawnbloom and the herb', () => {
    const herb: ScenarioEntity = { key: '', type: 'item/material/herb', x: 0, y: 0 }
    // eleven kinds and a herb named Dawnbloom: twelve slots, every one taken
    const named = play(chest([...kinds(11), herb]), 'item/material/herb')
    named.author(() => {
      named.world.get('i11')!.name = 'Dawnbloom'
    })
    // the herb in hand is not the dawnbloom's kind: it would be the thirteenth slot, and there is no room
    expect(press(named, 'put').rules).toContain('core/receive-store')
    expect(inside(named)).toHaveLength(12)
    expect(cells(named)).toBe(12)
    // unnamed, it is the kind already there: no new slot, and the chest takes it
    const plain = play(chest([...kinds(11), herb]), 'item/material/herb')
    expect(press(plain, 'put').rules).toContain('core/taken')
    expect(inside(plain)).toHaveLength(13)
    expect(cells(plain)).toBe(12)
  })

  it('a stack past STACK_MAX takes the next slot', () => {
    expect(slotsOf(Array.from({ length: 999 }, () => 'a'))).toBe(1)
    expect(slotsOf(Array.from({ length: 1000 }, () => 'a'))).toBe(2)
    expect(slotsOf(['a', 'b', 'a'])).toBe(2)
  })

  it('a full stack refuses another item when no second slot is available', () => {
    const eng = play(chest(stones(999)), 'item/material/stone')
    eng.author(() => (eng.world.get('chest')!.props ??= {}).capacity = 1)
    expect(press(eng, 'put').offered).toBe(false)
    expect(inside(eng)).toHaveLength(999)
    expect(eng.world.player.held).toBe('held')
  })

  it('counts the added item as a new slot only at the 999-item boundary', () => {
    const countWithAdding = (n: number) => {
      const eng = play(chest(stones(n)), 'item/material/stone')
      const w = eng.world
      return countAt(w.view({ e: 'chest' })!, 'contents', undefined, w, { stacks: true, adding: w.view({ e: 'held' })! })
    }
    expect(countWithAdding(998)).toBe(1)
    expect(countWithAdding(999)).toBe(2)
  })

  it('clicking the second chest slot transfers only its one item, not all 1000', () => {
    const eng = play(chest(stones(1000)))
    eng.controls.transfer('chest', 'chest', 'i999', true)
    expect(inside(eng)).toHaveLength(999)
    expect(eng.world.get('i999')!.place).toEqual({ on: 'hand', holder: 'actor' })
  })

  it('clicking the first chest slot transfers its 999 items and leaves the second slot', () => {
    const eng = play(chest(stones(1000)))
    eng.controls.transfer('chest', 'chest', 'i0', true)
    expect(inside(eng)).toEqual(['i999'])
  })

  it('deposits 1678 carried coins into two retrievable slots without rebuilding every prior item view', () => {
    const n = 1678
    const eng = play([
      ...chest([]),
      ...Array.from({ length: n }, (_, i) => ({ key: `coin${i}`, type: 'item/misc/thornmark', inside: 'actor' })),
    ])
    eng.controls.sync()
    const w = eng.world
    const view = w.view
    let views = 0
    w.view = (ref) => {
      views++
      return view.call(w, ref)
    }
    try {
      eng.controls.transfer('chest', 'bag', 'coin0', true)
    } finally {
      w.view = view
    }
    expect(inside(eng)).toHaveLength(n)
    expect(eng.controls.carried(true).size).toBe(0)
    // Close and reopen the panel: use the frame's identity, just as the rendered cells do.
    snapshot(eng)
    const slots = splitStacks(snapshot(eng, { panel: 'chest' }).container!.contents)
    expect(slots.map((s) => s.length)).toEqual([999, 679])
    eng.controls.transfer('chest', 'chest', slots[1][0].id, true)
    expect(inside(eng)).toHaveLength(999)
    expect([...eng.controls.carried(true).values()].flat()).toHaveLength(679)
    eng.controls.transfer('chest', 'chest', slots[0][0].id, true)
    expect(inside(eng)).toHaveLength(0)
    const carried = [...eng.controls.carried(true).values()].flat()
    expect(carried).toHaveLength(n)
    expect(new Set(carried.map((e) => e.id)).size).toBe(n)
    // Work budget, not a machine-dependent time limit: unfiltered capacity counts must not
    // build n*(n-1)/2 full views. Leave ample room for the per-item rules and their impulses.
    expect(views).toBeLessThan(n * 128)
  })

  it('a stale contents reference to a removed item does not occupy a slot', () => {
    const eng = play(chest(kinds(12)), 'item/food/apple')
    eng.author(() => {
      eng.world.get('i0')!.place = { on: 'none' }
    })
    expect(press(eng, 'put').rules).toContain('core/taken')
    expect(eng.world.get('held')!.place).toEqual({ on: 'inside', holder: 'chest' })
  })

  it('recounts changed stack identities and appended contents', () => {
    const eng = play(chest(stones(2)))
    const w = eng.world
    const chestView = w.view({ e: 'chest' })!
    const count = () => countAt(chestView, 'contents', undefined, w, { stacks: true })
    expect(count()).toBe(1)
    eng.author(() => { w.get('i0')!.name = 'custom stone' })
    expect(count()).toBe(2)
    eng.author(() => {
      w.addTag(w.get('i1')!, 'marked')
      w.setStatus({ e: 'i0' }, 'marked', -1)
      w.create('item/material/stone', { on: 'inside', holder: 'chest' })
    })
    expect(count()).toBe(3)
  })

  it('the frame preserves the bag stack identity even when a custom name equals the default', () => {
    const eng = play(chest(stones(2)))
    eng.author(() => eng.world.get('i1')!.name = itemInfo(eng, 'i0')!.name)
    expect(eng.controls.key(eng.world.get('i0')!)).not.toBe(eng.controls.key(eng.world.get('i1')!))
    for (const id of ['i0', 'i1']) expect(stackKey(itemInfo(eng, id)!)).toBe(eng.controls.key(eng.world.get(id)!))
  })

  it('keeps empty identities fast while immediately separating added names, tags, and statuses', () => {
    const plain = { type: 'item/material/stone' }
    expect(stackKey(plain)).toBe(stackKey({ ...plain, tags: [], statuses: new Set() }))
    expect(stackKey(plain)).not.toBe(stackKey({ ...plain, name: 'named' }))
    expect(stackKey(plain)).not.toBe(stackKey({ ...plain, tags: ['marked'] }))
    expect(stackKey(plain)).not.toBe(stackKey({ ...plain, statuses: ['marked'] }))
  })

  it('capacity uses the same instance tags as the bag, even when a tag is inherited too', () => {
    const eng = play(chest(stones(2)), 'item/food/apple')
    eng.author(() => {
      (eng.world.get('chest')!.props ??= {}).capacity = 2
      eng.world.get('i1')!.tags = ['stone']
    })
    expect(cells(eng)).toBe(2)
    expect(press(eng, 'put').offered).toBe(false)
    expect(inside(eng)).toHaveLength(2)
  })
})
