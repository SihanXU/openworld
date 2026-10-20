import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, snapshot, type Entity } from '@openworld/engine'
import { kitPattern, kitsOf } from '@openworld/modules'
import { BASE_RULES, KITS, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// The creatures' own skills (docs/creatures.md, content kits.ts, the kits module): a kind's kit is taken up by its
// behaviour (it stands and marks the cells), and the act the wind-up ends in is answered by its own rule.

const onto = buildOntology()

/** The Ford with nobody about but the player, standing in the open with a clear row east of them. */
function arena() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player
  const map = w.posOf(p)!.map
  // a row of eight cells open to walk (and the rows beside it), nothing standing on it
  const m = w.map(map)!
  const open = (x: number, y: number) => w.passable(map, x, y) && w.entitiesAt(map, x, y).every((e) => w.isTerrain(e))
  let row: { x: number; y: number } | undefined
  for (let y = 2; y < m.height - 2 && !row; y++)
    for (let x = 2; x < m.width - 9 && !row; x++)
      if ([0, 1, 2, 3, 4, 5, 6, 7].every((i) => [-1, 0, 1].every((dy) => open(x + i, y + dy)))) row = { x, y }
  if (!row) throw new Error('no open row')
  eng.author(() => {
    for (const e of w.entitiesOnMap(map)) if (e !== p && w.isAgent(e) && e.place.on === 'tile') w.destroy(e)
    w.place(p, { on: 'tile', map, x: row!.x, y: row!.y })
    p.facing = 'right'
  })
  /** One of a kind `dx` cells east of the player, hostile at once. */
  const spawn = (type: string, dx: number, props: Record<string, number> = {}) => {
    let c!: Entity
    const at = { map, x: row!.x + dx, y: row!.y }
    eng.author(() => {
      c = w.create(type, { on: 'tile', ...at }, { props, ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, home: at } })
    })
    return c
  }
  const run = (ticks: number, until?: () => boolean) => {
    for (let i = 0; i < ticks; i++) {
      eng.tick()
      if (until?.()) return true
    }
    return false
  }
  return { g, eng, w, p, map, row, spawn, run }
}

describe('creature kits', () => {
  it('every kit belongs to a kind of the world, and every skill of it has its kind\'s rule to answer it', () => {
    for (const [type, kit] of Object.entries(KITS)) {
      expect(onto.types[type], type).toBeDefined()
      for (const s of kit) {
        // a rule on the kind (or an ancestor) that names the skill's id
        const answered = BASE_RULES.some((r) => r.on === 'act/use' && r.host && 'type' in r.host && typeof r.host.type === 'string' && (type === r.host.type || type.startsWith(r.host.type + '/')) && JSON.stringify(r.tree).includes(`"cmp":"${s.id}"`))
        expect(answered, `${type} ${s.id}`).toBe(true)
        // a minor monster's skill is taken up by its conditions: it names the range it may be
        expect(s.range, `${type} ${s.id}`).toBeDefined()
        expect(s.range![0]).toBeLessThanOrEqual(s.range![1])
        expect(s.windup).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('the cells a skill marks: a line ahead, a disk around its aim that spares itself when it is its own', () => {
    const o = { map: 'm', x: 5, y: 5 }, aim = { map: 'm', x: 8, y: 5 }
    expect(kitPattern(KITS['actor/creature/undead/skeleton'][0], o, aim)).toEqual([[6, 5], [7, 5], [8, 5], [9, 5], [10, 5]])
    const slam = kitPattern(KITS['actor/creature/golem'][0], o, aim)
    expect(slam).not.toContainEqual([5, 5])
    expect(slam).toContainEqual([7, 5])
    expect(kitPattern(KITS['actor/creature/imp'][0], o, aim)).toContainEqual([8, 5])
  })

  it('a skill is wound up on marked cells the frame shows, then lands: a skeleton\'s bone hits from five cells off', () => {
    const { eng, w, p, spawn, run } = arena()
    const s = spawn('actor/creature/undead/skeleton', 4)
    expect(run(40, () => kitsOf(eng).pending.has(s.id))).toBe(true)
    const f = snapshot(eng)
    expect(f.telegraphs?.[0]).toMatchObject({ who: s.id })
    expect(f.telegraphs![0].tiles).toContainEqual([w.posOf(p)!.x, w.posOf(p)!.y])
    const hp = w.num(p, 'hp')
    expect(run(20, () => !kitsOf(eng).pending.has(s.id))).toBe(true)
    expect(w.num(p, 'hp')).toBeLessThan(hp)
  })

  it('stepping off the marked cells dodges it', () => {
    const { eng, w, p, map, row, spawn, run } = arena()
    const s = spawn('actor/creature/undead/skeleton', 4)
    run(40, () => kitsOf(eng).pending.has(s.id))
    eng.author(() => w.place(p, { on: 'tile', map, x: row.x, y: row.y + 1 }))
    const hp = w.num(p, 'hp')
    run(20, () => !kitsOf(eng).pending.has(s.id))
    expect(w.num(p, 'hp')).toBe(hp)
  })

  it('stunned in its wind-up, it loses the skill', () => {
    const { eng, w, p, spawn, run } = arena()
    const s = spawn('actor/creature/undead/skeleton', 4)
    run(40, () => kitsOf(eng).pending.has(s.id))
    eng.author(() => eng.applyStatus({ e: s.id }, 'stunned', 30))
    const hp = w.num(p, 'hp')
    run(1)
    expect(kitsOf(eng).pending.has(s.id)).toBe(false)
    run(10)
    expect(w.num(p, 'hp')).toBe(hp)
  })

  it('a wolf lunges along the row to the player, bites and opens a bleed', () => {
    const { eng, w, p, spawn, run } = arena()
    const wolf = spawn('actor/creature/beast/wolf', 3)
    const from = w.posOf(wolf)!.x
    expect(run(60, () => !!p.statuses?.bleeding)).toBe(true)
    expect(w.posOf(wolf)!.x).toBeLessThan(from)
    void eng
  })

  it('a boar that charges into nothing but a wall is stunned itself', () => {
    const { eng, w, map, row, spawn, run } = arena()
    const boar = spawn('actor/creature/beast/boar', 4)
    run(40, () => kitsOf(eng).pending.has(boar.id))
    // the player is gone from the row: a boulder stands in the way, two cells off
    eng.author(() => {
      w.place(w.player, { on: 'tile', map, x: row.x, y: row.y + 1 })
      w.create('fixture/nature/boulder', { on: 'tile', map, x: row.x + 2, y: row.y })
    })
    expect(run(20, () => !!boar.statuses?.stunned)).toBe(true)
  })

  it('a spider\'s web leaves the player webbed, wading slowly', () => {
    const { w, p, spawn, run } = arena()
    spawn('actor/creature/spider', 3)
    expect(run(80, () => !!p.statuses?.webbed)).toBe(true)
    expect(w.onto.status('webbed')?.moveDelay).toBeGreaterThan(1)
  })

  it('a slime hops onto the player\'s side', () => {
    const { w, p, spawn, run } = arena()
    const s = spawn('actor/creature/slime/fire_slime', 3)
    const hp = w.num(p, 'hp')
    expect(run(120, () => w.num(p, 'hp') < hp)).toBe(true)
    const a = w.posOf(s)!, b = w.posOf(p)!
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
  })

  it('a hurt wolf howls: the beasts near are frenzied, itself too', () => {
    const { w, spawn, run } = arena()
    const wolf = spawn('actor/creature/beast/wolf', 5, { hp: 15 })
    const boar = spawn('actor/creature/beast/boar', 7)
    expect(run(40, () => !!wolf.statuses?.frenzied)).toBe(true)
    expect(boar.statuses?.frenzied).toBeDefined()
    expect(w.stat(wolf, 'atk', 0)).toBeGreaterThan(w.num(wolf, 'atk'))
  })

  it('a crab, hurt, shells up', () => {
    const { spawn, run } = arena()
    const crab = spawn('actor/creature/crab', 2, { hp: 5 })
    expect(run(40, () => !!crab.statuses?.shelled)).toBe(true)
  })

  it('the elites: the Slime King, hurt, splits off two green slimes, once', () => {
    const { eng, w, map, spawn, run } = arena()
    const king = spawn('actor/creature/slime/king_slime', 3, { hp: 40 })
    const greens = () => w.entitiesOnMap(map).filter((e) => e.type === 'actor/creature/slime/green_slime').length
    expect(run(60, () => greens() === 2)).toBe(true)
    expect(w.prop(king, 'split')).toBe(1)
    // spent, it is never wound up again (its `spent` prop), and no more come off it
    let again = false
    run(1200, () => ((again ||= kitsOf(eng).pending.get(king.id)?.skill.id === 'split'), false))
    expect(again).toBe(false)
    expect(w.entitiesOnMap(map).filter((e) => e.type === 'actor/creature/slime/green_slime').length).toBeLessThanOrEqual(2)
  })

  it('the elites: the barrow warden\'s Shield Charge is followed at once by its Vigil Sweep', () => {
    const { eng, spawn, run } = arena()
    const warden = spawn('actor/creature/undead/warden', 4)
    const seen: string[] = []
    run(120, () => {
      const p = kitsOf(eng).pending.get(warden.id)
      if (p && seen[seen.length - 1] !== p.skill.id) seen.push(p.skill.id)
      return seen.includes('vigil_sweep') && seen.includes('shield_charge')
    })
    expect(seen.slice(0, 2)).toEqual(['shield_charge', 'vigil_sweep'])
  })

  it('the elites: the cyclops\'s aftershock comes only after its stomp', () => {
    const { eng, spawn, run } = arena()
    const cyclops = spawn('actor/creature/cyclops', 1)
    const seen: string[] = []
    run(200, () => {
      const p = kitsOf(eng).pending.get(cyclops.id)
      if (p && seen[seen.length - 1] !== p.skill.id) seen.push(p.skill.id)
      return seen.includes('aftershock')
    })
    const i = seen.indexOf('aftershock')
    expect(i).toBeGreaterThan(0)
    expect(seen[i - 1]).toBe('stomp')
  })

  it('tactics: an imp come too close steps back to where its fire reaches', () => {
    const { w, p, spawn, run } = arena()
    const imp = spawn('actor/creature/imp/fire_imp', 1)
    const dist = () => Math.abs(w.posOf(imp)!.x - w.posOf(p)!.x) + Math.abs(w.posOf(imp)!.y - w.posOf(p)!.y)
    expect(run(40, () => dist() >= 2)).toBe(true)
  })

  it('tactics: a wolf badly hurt runs from its foe', () => {
    const { w, p, spawn, run } = arena()
    const wolf = spawn('actor/creature/beast/wolf', 2, { hp: 5 })
    const d0 = Math.abs(w.posOf(wolf)!.x - w.posOf(p)!.x) + Math.abs(w.posOf(wolf)!.y - w.posOf(p)!.y)
    const away = () => Math.abs(w.posOf(wolf)!.x - w.posOf(p)!.x) + Math.abs(w.posOf(wolf)!.y - w.posOf(p)!.y)
    expect(run(30, () => wolf.ai?.state === 'flee' && away() > d0)).toBe(true)
  })

  it('tactics: a wolf badly hurt with nowhere to run (its leash) turns and fights', () => {
    const { eng, w, p, map, row, run } = arena()
    const at = { map, x: row.x + 1, y: row.y }
    const wolf = eng.author(() => w.create('actor/creature/beast/wolf', { on: 'tile', ...at }, { props: { hp: 5 }, ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, leash: 0, home: at } }))
    const hp0 = w.num(p, 'hp')
    let fled = false
    run(60, () => ((fled ||= wolf.ai?.state === 'flee'), false))
    expect(fled).toBe(false)
    expect(w.num(p, 'hp')).toBeLessThan(hp0)
  })

  it('tactics: two wolves of a pack come at their foe from both sides', () => {
    const { w, p, spawn, run } = arena()
    const a = spawn('actor/creature/beast/wolf', 1)
    const b = spawn('actor/creature/beast/wolf', 4)
    const side = (e: typeof a) => Math.sign(w.posOf(e)!.x - w.posOf(p)!.x) || Math.sign(w.posOf(e)!.y - w.posOf(p)!.y) * 10
    const beside = (e: typeof a) => Math.abs(w.posOf(e)!.x - w.posOf(p)!.x) + Math.abs(w.posOf(e)!.y - w.posOf(p)!.y) === 1
    // on opposite sides: the plain threat goal brings the second to any free side, the pack goal to the far one
    expect(run(200, () => beside(a) && beside(b) && side(b) === -side(a))).toBe(true)
  })
})
