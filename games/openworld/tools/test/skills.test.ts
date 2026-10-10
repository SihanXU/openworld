// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import { Engine, Game, RuleLibrary, buildSandbox, cannotLearn, combatDelay, combatStrike, snapshot, type Ref, type Scenario } from '@openworld/engine'
import { BASE_RULES, SKILLS, SKILL_DIRECTIONS, SKILL_BRANCHES, SKILL_BY_ID, skillsForProfession, branchesForProfession, buildOntology } from '@openworld-game/content'
import { layoutBranches, layoutSkills } from '@openworld/runtime/src/ui/skillLayout.ts'
import { buildFord } from '../src/demo/world.ts'
import { FRONT, ORIGIN } from '../src/coverage.ts'

const onto = buildOntology()
const lib = new RuleLibrary(BASE_RULES)

function setup(extra: Scenario['entities'] = [], front = 'grass'): Engine {
  const terrain = Array.from({ length: 3 }, () => Array(3).fill('grass'))
  terrain[FRONT.y][FRONT.x] = front
  const sc: Scenario = { terrain, entities: [{ key: 'actor', type: 'actor/person/player', ...ORIGIN }, ...extra], event: {} }
  const start = buildSandbox(sc, onto, lib)
  const eng = new Engine(structuredClone(start.world.state), start.world.onto.data, lib)
  eng.world.state.player = 'actor'
  eng.world.get('actor')!.facing = 'up'
  return eng
}

/** Learn a skill and everything before it, with the points it takes. */
function learn(eng: Engine, id: string): void {
  const p = eng.world.get('actor')!
  const s = SKILL_BY_ID[id]
  for (const r of s.requires ?? []) if (!(p.tags ?? []).includes(`skill:${r}`)) learn(eng, r)
  ;(p.props ??= {}).skillPoints = Number(p.props.skillPoints ?? 0) + (s.cost ?? 1)
  expect(eng.controls.learn(s)).toBe(true)
}

describe('the skill tree', () => {
  it('is well formed: unique ids, known requirements, every branch ends in an ability', () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length)
    for (const s of SKILLS) {
      expect(SKILL_BRANCHES.some((b) => b.id === s.branch)).toBe(true)
      for (const r of s.requires ?? []) {
        expect(SKILL_BY_ID[r], `${s.id} needs ${r}`).toBeDefined()
        expect(SKILL_BY_ID[r].branch, `${s.id} must not depend on another branch`).toBe(s.branch)
      }
    }
    for (const b of new Set(SKILLS.map((s) => s.branch))) expect(SKILLS.filter((s) => s.branch === b).at(-1)!.ability).toBe(true)
  })

  it('has two directions and eight branch entrances, including a profession slot', () => {
    expect(SKILL_DIRECTIONS.map((d) => d.id)).toEqual(['combat', 'life'])
    expect(SKILL_BRANCHES.filter((b) => b.direction === 'combat').map((b) => b.id)).toEqual(['swiftness', 'survival', 'damage', 'profession'])
    expect(SKILL_BRANCHES.filter((b) => b.direction === 'life').map((b) => b.id)).toEqual(['gathering', 'agriculture', 'husbandry', 'smithing'])
    for (const direction of SKILL_DIRECTIONS) {
      const hubs = layoutBranches(direction.id)
      const nodes = layoutSkills(SKILLS, direction.id, 'assassin')
      expect([...hubs.keys()]).toEqual(SKILL_BRANCHES.filter((b) => b.direction === direction.id).map((b) => b.id))
      expect([...nodes.keys()].sort()).toEqual(skillsForProfession('assassin').filter((s) => hubs.has(s.branch)).map((s) => s.id).sort())
      for (const s of SKILLS.filter((s) => nodes.has(s.id))) {
        const child = nodes.get(s.id)!
        for (const parent of s.requires?.length ? s.requires.map((r) => nodes.get(r)!) : [hubs.get(s.branch)!])
          expect(Math.hypot(child.x, child.y)).toBeGreaterThan(Math.hypot(parent.x, parent.y))
      }
    }
    const combat = skillsForProfession('assassin').filter((s) => layoutBranches('combat').has(s.branch))
    // 48 talents, and the active skills: everyone's four and the profession's four (actives.ts)
    expect(combat.filter((s) => !s.active)).toHaveLength(48)
    expect(combat.filter((s) => s.active)).toHaveLength(8)
    for (const b of layoutBranches('combat').keys()) expect(combat.some((s) => s.branch === b && (s.requires?.length ?? 0) > 1 && s.cost === 2)).toBe(true)
  })

  it('has no cycles and no overlapping icon positions', () => {
    const visit = (id: string, seen = new Set<string>()) => {
      expect(seen.has(id), `cycle through ${id}`).toBe(false)
      for (const r of SKILL_BY_ID[id].requires ?? []) visit(r, new Set([...seen, id]))
    }
    for (const s of SKILLS) visit(s.id)
    for (const direction of SKILL_DIRECTIONS) {
      const places = [...layoutSkills(SKILLS, direction.id).values(), ...layoutBranches(direction.id).values()]
      for (let i = 0; i < places.length; i++) for (const p of places.slice(i + 1)) expect(Math.hypot(p.x - places[i].x, p.y - places[i].y)).toBeGreaterThan(64)
    }
  })

  it('filters the profession tree and rejects learning for another profession in the engine', () => {
    const eng = setup()
    const p = eng.world.player
    // nobody starts with a profession (a trainer sets you on one, docs/skill-tree.md)
    expect(snapshot(eng).player.props.profession).toBeUndefined()
    p.props!.profession = 'assassin'
    p.props!.skillPoints = 10
    expect(eng.controls.learn(SKILL_BY_ID['assassin-training'])).toBe(true)
    p.props!.profession = 'warrior'
    expect(cannotLearn(p, SKILL_BY_ID.ambush)).toBe('profession')
    expect(eng.controls.learn(SKILL_BY_ID.ambush)).toBe(false)
    expect(p.props!.skillPoints).toBe(9)
    expect(skillsForProfession('warrior').filter((s) => s.profession).every((s) => s.profession === 'warrior')).toBe(true)
    for (const profession of ['warrior', '', 'unknown']) {
      expect(skillsForProfession(profession).some((s) => s.profession && s.profession !== profession)).toBe(false)
      expect(layoutSkills(SKILLS, 'combat', profession).has('assassin-training')).toBe(false)
      expect(layoutBranches('combat').has('profession')).toBe(true)
    }
    expect(branchesForProfession('assassin').find((b) => b.id === 'profession')!.name.zh).toBe('刺客')
  })

  it('starts without a profession and migrates old saves without replacing a chosen profession or tags', () => {
    const { index } = buildFord()
    const game = Game.create(index, onto, new RuleLibrary(BASE_RULES))
    const p = game.engine.world.player
    expect(p.props!.profession).toBeUndefined()
    p.tags = ['skill:iron-stomach', 'skill:strength']
    p.props!.hungerEvery = 150
    const loaded = Game.load(structuredClone(game.save()), index, onto)
    expect(loaded.engine.world.player.props!.profession).toBeUndefined()
    // the early absolute 150 is Iron Stomach's 450 on the old pace, 720 on today's (480 + 240)
    expect(loaded.engine.world.player.props!.hungerEvery).toBe(720)
    expect(loaded.engine.world.player.tags).toEqual(p.tags)
    loaded.engine.world.player.props!.profession = 'warrior'
    expect(Game.load(structuredClone(loaded.save()), index, onto).engine.world.player.props!.profession).toBe('warrior')
  })

  it('needs both arms and two points for a capstone', () => {
    const eng = setup()
    const p = eng.world.player
    learn(eng, 'battle-tempo')
    p.props!.skillPoints = 2
    expect(eng.controls.learn(SKILL_BY_ID.windrunner)).toBe(false)
    learn(eng, 'pursuit')
    p.props!.skillPoints = 1
    expect(eng.controls.learn(SKILL_BY_ID.windrunner)).toBe(false)
    p.props!.skillPoints = 2
    expect(eng.controls.learn(SKILL_BY_ID.windrunner)).toBe(true)
    expect(p.props!.skillPoints).toBe(0)
  })

  it('spends points, needs what comes before, and is learned once', () => {
    const eng = setup()
    const p = eng.world.get('actor')!
    expect(cannotLearn(p, SKILL_BY_ID.strength)).toBe('points')
    p.props!.skillPoints = 2
    expect(cannotLearn(p, SKILL_BY_ID['heavy-blows'])).toBe('requires')
    const atk = eng.world.num(p, 'atk')
    expect(eng.controls.learn(SKILL_BY_ID.strength)).toBe(true)
    expect(eng.world.num(p, 'atk')).toBe(atk + 1)
    expect(p.props!.skillPoints).toBe(1)
    expect(eng.controls.learn(SKILL_BY_ID.strength)).toBe(false)
    expect(eng.controls.learn(SKILL_BY_ID['heavy-blows'])).toBe(true)
    expect(p.props!.skillPoints).toBe(0)
  })

  it('keeps defence in survival and does not gate it on damage skills', () => {
    const eng = setup()
    const p = eng.world.get('actor')!
    p.props!.skillPoints = 3
    eng.controls.learn(SKILL_BY_ID.strength)
    expect(cannotLearn(p, SKILL_BY_ID.toughness)).toBe('requires')
    eng.controls.learn(SKILL_BY_ID.vitality)
    const def = eng.world.num(p, 'def')
    expect(eng.controls.learn(SKILL_BY_ID.toughness)).toBe(true)
    expect(eng.world.num(p, 'def')).toBe(def + 1)
  })

  it('vitality fills the health it adds', () => {
    const eng = setup()
    const p = eng.world.get('actor')!
    const [hp, max] = [eng.world.num(p, 'hp'), eng.world.num(p, 'maxHp')]
    learn(eng, 'vitality')
    expect([eng.world.num(p, 'hp'), eng.world.num(p, 'maxHp')]).toEqual([hp + 4, max + 4])
  })

  it('a big pack adds a row to the bag', () => {
    const eng = setup()
    eng.controls.sync()
    const n = eng.world.get('actor')!.slots!.length
    learn(eng, 'big-pack')
    expect(eng.world.get('actor')!.slots!.length).toBe(n + 10)
  })

  it('a firemaker lights a campfire with a plain stick (and nobody else does)', () => {
    for (const skilled of [false, true]) {
      const eng = setup([{ key: 'fire', type: 'fixture/light/campfire', ...FRONT }])
      if (skilled) learn(eng, 'firemaker')
      eng.world.author(() => eng.world.add({ id: 'stick', type: 'item/material/stick', place: { on: 'hand', holder: 'actor' } }))
      eng.interact('interact', 'actor', { e: 'fire' })
      expect(eng.world.hasStatus({ e: 'fire' }, 'lit')).toBe(skilled)
    }
  })

  it('a woodcutter fells a tree for one more log', () => {
    const logs = (skilled: boolean) => {
      const eng = setup([], 'tree')
      if (skilled) learn(eng, 'woodcutter')
      eng.world.author(() => eng.world.add({ id: 'axe', type: 'item/weapon/blade/axe', place: { on: 'hand', holder: 'actor' } }))
      const map = eng.world.posOf(eng.world.get('actor')!)!.map
      const tree = eng.world.cellRef(map, FRONT.x, FRONT.y)
      // one blow from falling
      eng.world.author(() => eng.world.setProp(eng.world.get(tree.e)!, 'hp', 1))
      eng.interact('interact', 'actor', tree)
      return eng.world.entitiesAt(map, FRONT.x, FRONT.y).filter((e) => e.type === 'item/material/log').length
    }
    expect(logs(true)).toBe(logs(false) + 1)
  })

  it('a sweep also strikes the creatures beside the tile ahead', () => {
    const hurt = (skilled: boolean) => {
      const eng = setup([
        { key: 'a', type: 'actor/creature/slime/green_slime', ...FRONT },
        { key: 'b', type: 'actor/creature/slime/green_slime', x: FRONT.x - 1, y: FRONT.y },
        { key: 'c', type: 'actor/creature/slime/green_slime', x: FRONT.x + 1, y: FRONT.y },
      ])
      if (skilled) learn(eng, 'sweep')
      const full = eng.world.num(eng.world.get('b')!, 'hp')
      eng.world.author(() => eng.world.add({ id: 'mace', type: 'item/weapon/blunt/mace', place: { on: 'hand', holder: 'actor' } }))
      eng.attack(eng.world.get('actor')!)
      // hurt, or felled outright
      return ['b', 'c'].filter((id) => { const e = eng.world.get(id); return !e || eng.world.num(e, 'hp') < full }).length
    }
    expect(hurt(false)).toBe(0)
    expect(hurt(true)).toBe(2)
  })
})

function duel(skills: string[] = []): Engine {
  const eng = setup([{ key: 'foe', type: 'actor/creature/slime/green_slime', ...FRONT }])
  const p = eng.world.player
  // the combat talents below are the assassin's (a profession a trainer gives, docs/skill-tree.md)
  Object.assign(p.props!, { hp: 40, maxHp: 40, atk: 10, def: 0, profession: 'assassin' })
  p.tags = skills.map((s) => `skill:${s}`)
  // an assassin's talents answer the dagger alone (profession.ts); this one adds no power of its own
  eng.world.author(() => eng.world.add({ id: 'dagger', type: 'item/weapon/blade/dagger', place: { on: 'hand', holder: 'actor' }, props: { power: 0 } }))
  const foe = eng.world.get('foe')!
  Object.assign(foe.props ??= {}, { hp: 200, maxHp: 200, def: 0 })
  foe.facing = 'down'
  return eng
}

function blow(eng: Engine, target: Ref = { e: 'foe' }): number {
  const victim = 'e' in target ? eng.world.get(target.e) : undefined
  const before = victim ? eng.world.num(victim, 'hp') : 0
  eng.attack(eng.world.player, target)
  return victim ? before - eng.world.num(victim, 'hp') : 0
}

describe('automatic combat talents', () => {
  it('fractional haste changes actual movement/attack cadence and survives save/load', () => {
    const eng = duel()
    const p = eng.world.player
    p.props!.moveHaste = 0.15
    p.props!.attackHaste = 0.15
    const total = (n: number, kind: 'move' | 'attack', base: number) => Array.from({ length: n }, () => combatDelay(eng.world, p, base, kind)).reduce((a, b) => a + b, 0)
    expect(total(115, 'move', 2)).toBe(200)
    expect(total(115, 'attack', 5)).toBe(500)
    total(1, 'attack', 5)
    const restored = new Engine(structuredClone(eng.world.state), onto, lib)
    expect(combatDelay(restored.world, restored.world.player, 5, 'attack')).toBe(combatDelay(eng.world, p, 5, 'attack'))
  })

  it('uses haste in real player input cooldowns, not just the stat calculation', () => {
    const eng = duel()
    const p = eng.world.player
    p.props!.attackHaste = 0.25
    eng.playerAttack({ e: 'foe' })
    expect(eng.cooldown('atk:' + p.id)).toBe(4)
    eng.world.state.tick = 3
    const hp = eng.world.num(eng.world.get('foe')!, 'hp')
    eng.playerAttack({ e: 'foe' })
    expect(eng.world.num(eng.world.get('foe')!, 'hp')).toBe(hp)
    eng.world.state.tick = 4
    eng.playerAttack({ e: 'foe' })
    expect(eng.world.num(eng.world.get('foe')!, 'hp')).toBe(hp - 10)
    p.props!.moveHaste = 0.15
    expect(eng.movePlayer('left')).toBe(true)
    expect(eng.cooldown(p.id)).toBe(5)
    expect(eng.movePlayer('right')).toBe(false)
  })

  it('battle tempo and evasive step require a successful, recent move', () => {
    const eng = duel(['battle-tempo', 'evasive-step'])
    const p = eng.world.player
    expect(combatDelay(eng.world, p, 5, 'attack')).toBe(5)
    expect(eng.step(p, 'up')).toBe(false)
    expect(p.combat?.lastMoveTick).toBeUndefined()
    expect(eng.step(p, 'left')).toBe(true)
    expect(combatDelay(eng.world, p, 5, 'attack')).toBe(4)
    eng.damage(p, 20, undefined, false, { e: 'foe' })
    expect(p.props!.hp).toBe(25)
    eng.world.state.tick = 6
    p.props!.hp = 40
    eng.damage(p, 20, undefined, false, { e: 'foe' })
    expect(p.props!.hp).toBe(20)
  })

  it('three successful steps charge only the primary melee hit, not sweep targets', () => {
    const eng = duel(['windrunner', 'sweep'])
    const p = eng.world.player
    const map = eng.world.posOf(p)!.map
    for (const x of [0, 2]) eng.world.author(() => eng.world.add({ id: `side${x}`, type: 'actor/creature/slime/green_slime', place: { on: 'tile', map, x, y: FRONT.y }, props: { hp: 200, maxHp: 200, def: 0 } }))
    eng.step(p, 'left')
    expect(eng.step(p, 'left')).toBe(false)
    eng.step(p, 'right')
    eng.step(p, 'right')
    expect(p.combat!.steps).toBe(3)
    eng.author(() => eng.teleport(p, { map, ...ORIGIN }))
    p.facing = 'up'
    expect(blow(eng)).toBe(15)
    expect(p.combat!.steps).toBe(0)
    expect(eng.world.get('side0')!.props!.hp).toBe(190)
    expect(eng.world.get('side2')!.props!.hp).toBe(190)
    expect(blow(eng)).toBe(10)
  })

  it('does not consume a charge or build combo points on an incapacitated target', () => {
    const eng = duel(['windrunner', 'relentless'])
    const p = eng.world.player
    p.combat = { steps: 3, comboHits: 1, comboTarget: 'foe', comboTick: 0 }
    eng.world.author(() => eng.world.setStatus({ e: 'foe' }, 'down', -1))
    expect(blow(eng)).toBe(0)
    expect(p.combat.steps).toBe(3)
    expect(p.combat.comboHits).toBeUndefined()
  })

  it('pursuit is a refreshing three-second reward for defeating a creature, not just hitting', () => {
    const eng = duel(['pursuit'])
    const p = eng.world.player
    blow(eng)
    expect(p.combat?.pursuitUntil).toBeUndefined()
    eng.world.get('foe')!.props!.hp = 1
    eng.world.state.tick = 10
    blow(eng)
    expect(p.combat!.pursuitUntil).toBe(40)
    expect(combatDelay(eng.world, p, 5, 'move')).toBe(4)
    eng.world.state.tick = 40
    expect(combatDelay(eng.world, p, 5, 'move')).toBe(5)
  })

  it('critical hits are deterministic, capped and stronger with deadly focus', () => {
    const eng = duel()
    const p = eng.world.player
    const seed = eng.world.state.rng
    expect(blow(eng)).toBe(10)
    expect(eng.world.state.rng).toBe(seed)
    p.props!.critChance = 1
    expect(blow(eng)).toBe(15)
    p.tags!.push('skill:deadly-focus')
    expect(blow(eng)).toBe(20)
    p.props!.critChance = 0.35
    const other = new Engine(structuredClone(eng.world.state), onto, lib)
    const run = (engine: Engine) => Array.from({ length: 4 }, () => combatStrike(engine.world, engine.world.player, engine.world.get('foe'), 10, 1, undefined, true).critical)
    expect(run(eng)).toEqual(run(other))
    expect(eng.world.state.rng).toBe(other.world.state.rng)
  })

  it('executioner has a precise 30% threshold and damage still respects defence', () => {
    const eng = duel(['executioner'])
    const foe = eng.world.get('foe')!
    foe.props!.hp = 61
    expect(blow(eng)).toBe(10)
    foe.props!.hp = 60
    foe.props!.def = 2
    expect(blow(eng)).toBe(11)
  })

  it('defiance mitigates low-health combat hits but not environmental or piercing damage', () => {
    const eng = duel(['defiance'])
    const p = eng.world.player
    for (const [by, pierce, expected] of [[{ e: 'foe' }, false, 6], [undefined, false, 4], [{ e: 'foe' }, true, 4]] as const) {
      p.props!.hp = 12
      eng.damage(p, 8, undefined, pierce, by)
      expect(p.props!.hp).toBe(expected)
    }
    p.props!.hp = 13
    eng.damage(p, 8, undefined, false, { e: 'foe' })
    expect(p.props!.hp).toBe(5)
  })

  it('last stand prevents one lethal combat hit and its 30-second cooldown survives saving', () => {
    const eng = duel(['last-stand'])
    const p = eng.world.player
    p.props!.hp = 10
    eng.damage(p, 99, undefined, false, { e: 'foe' })
    expect(p.props!.hp).toBe(1)
    expect(p.statuses?.down).toBeUndefined()
    const restored = new Engine(structuredClone(eng.world.state), onto, lib)
    const rp = restored.world.player
    restored.world.state.tick = 299
    rp.props!.hp = 10
    restored.damage(rp, 99, undefined, false, { e: 'foe' })
    expect(rp.statuses?.down).toBeDefined()
    delete rp.statuses!.down
    rp.props!.hp = 10
    restored.world.state.tick = 300
    restored.damage(rp, 99, undefined, false, { e: 'foe' })
    expect(rp.props!.hp).toBe(1)
    expect(rp.combat!.lastStandTick).toBe(300)
  })

  it('last stand never protects against environmental damage', () => {
    const eng = duel(['last-stand'])
    eng.damage(eng.world.player, 99, 'fire')
    expect(eng.world.player.statuses?.down).toBeDefined()
    expect(eng.world.player.combat?.lastStandTick).toBeUndefined()
  })

  it('iron stomach really slows hunger, and second wind heals at half a bar', () => {
    const eng = duel()
    const p = eng.world.player
    learn(eng, 'second-wind')
    expect(p.props!.hungerEvery).toBe(720)
    // fed (over six tenths), where hunger falls at its base pace
    p.props!.hunger = 16
    p.props!.hp = 10
    eng.world.state.tick = 79
    eng.tick() // the clock reaches 80: the body's periods come
    expect(p.props!.hp).toBe(11)
    eng.world.state.tick = 479
    eng.tick() // the clock reaches 480 (the base pace): nothing for an iron stomach
    expect(p.props!.hunger).toBe(16)
    eng.world.state.tick = 719
    eng.tick() // the clock reaches 720: its pace
    expect(p.props!.hunger).toBe(15)
  })

  it('assassin training needs a dagger, not a common blade, and the dagger fights for no other profession', () => {
    const eng = duel(['assassin-training'])
    const w = eng.world
    expect(blow(eng)).toBe(11)
    // a common blade (the axe) takes no profession talent
    w.author(() => w.place(w.get('dagger')!, { on: 'inside', holder: 'actor' }))
    w.author(() => w.add({ id: 'axe', type: 'item/weapon/blade/axe', place: { on: 'hand', holder: 'actor' }, props: { power: 0 } }))
    expect(blow(eng)).toBe(10)
    // another profession: the dagger's blow is refused
    w.author(() => w.place(w.get('axe')!, { on: 'inside', holder: 'actor' }))
    w.author(() => w.place(w.get('dagger')!, { on: 'hand', holder: 'actor' }))
    w.player.props!.profession = 'warrior'
    expect(blow(eng)).toBe(0)
  })

  it('ambush requires four seconds without attacking or taking combat damage', () => {
    const eng = duel(['ambush'])
    expect(blow(eng)).toBe(15)
    eng.world.state.tick = 1
    expect(blow(eng)).toBe(10)
    eng.world.state.tick = 41
    expect(blow(eng)).toBe(15)
    eng.world.state.tick = 50
    eng.damage(eng.world.player, 1, undefined, false, { e: 'foe' })
    eng.world.state.tick = 89
    expect(blow(eng)).toBe(10)
  })

  it('backstab uses the victim facing, not the attacker facing or a side hit', () => {
    const eng = duel(['backstab'])
    const foe = eng.world.get('foe')!
    for (const [facing, expected] of [['down', 10], ['left', 10], ['up', 14]] as const) {
      foe.facing = facing
      expect(blow(eng)).toBe(expected)
    }
  })

  it('relentless finishes every third hit, expires and resets on target change or a miss', () => {
    const eng = duel(['relentless'])
    expect([blow(eng), blow(eng), blow(eng)]).toEqual([10, 10, 16])
    expect(eng.world.player.combat!.comboHits).toBe(0)
    blow(eng)
    eng.world.state.tick = 21
    blow(eng)
    expect(eng.world.player.combat!.comboHits).toBe(1)
    const map = eng.world.posOf(eng.world.player)!.map
    eng.world.author(() => eng.world.add({ id: 'other', type: 'actor/creature/slime/green_slime', place: { on: 'tile', map, x: 0, y: FRONT.y }, props: { hp: 200, maxHp: 200, def: 0 } }))
    blow(eng, { e: 'other' })
    expect(eng.world.player.combat!.comboTarget).toBe('other')
    expect(eng.world.player.combat!.comboHits).toBe(1)
    blow(eng, eng.world.cellRef(map, 0, ORIGIN.y))
    expect(eng.world.player.combat!.comboHits).toBeUndefined()
  })

  it('sweep secondary targets never generate combo hits or inherit guaranteed opener criticals', () => {
    const eng = duel(['relentless', 'ambush', 'death-dance', 'sweep'])
    const map = eng.world.posOf(eng.world.player)!.map
    eng.world.author(() => eng.world.add({ id: 'side', type: 'actor/creature/slime/green_slime', place: { on: 'tile', map, x: 0, y: FRONT.y }, props: { hp: 200, maxHp: 200, def: 0 } }))
    expect(blow(eng)).toBe(23)
    expect(eng.world.player.combat!.comboHits).toBe(1)
    expect(eng.world.get('side')!.props!.hp).toBe(190)
  })

  it('ranged attacks reset melee combos without triggering assassin openers or mobility charges', () => {
    const eng = duel(['ambush', 'backstab', 'relentless', 'windrunner', 'death-dance'])
    eng.world.player.combat = { steps: 3, comboHits: 2, comboTarget: 'foe', comboTick: 0 }
    // a common ranged weapon (the wand; the bow is the ranger's)
    eng.world.author(() => eng.world.place(eng.world.get('dagger')!, { on: 'inside', holder: 'actor' }))
    eng.world.author(() => eng.world.add({ id: 'wand', type: 'item/weapon/magic/wand', place: { on: 'hand', holder: 'actor' } }))
    expect(blow(eng)).toBe(13)
    expect(eng.world.player.combat!.comboHits).toBeUndefined()
    expect(eng.world.player.combat!.steps).toBe(3)
  })

  it('shadow recovery heals only on a creature defeated with a dagger, capped at max health', () => {
    const eng = duel(['shadow-recovery'])
    const p = eng.world.player
    p.props!.hp = 39
    blow(eng)
    expect(p.props!.hp).toBe(39)
    eng.world.get('foe')!.props!.hp = 1
    blow(eng)
    expect(p.props!.hp).toBe(40)
    const ranged = duel(['shadow-recovery'])
    ranged.world.player.props!.hp = 20
    ranged.world.get('foe')!.props!.hp = 1
    ranged.world.author(() => ranged.world.place(ranged.world.get('dagger')!, { on: 'inside', holder: 'actor' }))
    ranged.world.author(() => ranged.world.add({ id: 'wand', type: 'item/weapon/magic/wand', place: { on: 'hand', holder: 'actor' } }))
    blow(ranged)
    expect(ranged.world.player.props!.hp).toBe(20)
    // a melee blow with another's weapon (the warrior's sword) is no assassin's
    const sword = duel(['shadow-recovery'])
    sword.world.player.props!.hp = 20
    sword.world.get('foe')!.props!.hp = 1
    sword.world.author(() => sword.world.place(sword.world.get('dagger')!, { on: 'inside', holder: 'actor' }))
    sword.world.author(() => sword.world.add({ id: 'sword', type: 'item/weapon/blade/sword', place: { on: 'hand', holder: 'actor' } }))
    blow(sword)
    expect(sword.world.player.props!.hp).toBe(20)
  })

  it('guaranteed criticals do not spend randomness and all assassin talents deactivate with the profession', () => {
    const eng = duel(['ambush', 'backstab', 'relentless', 'death-dance'])
    const seed = eng.world.state.rng
    expect(blow(eng)).toBe(23)
    expect(eng.world.state.rng).toBe(seed)
    eng.world.player.props!.profession = 'warrior'
    eng.world.author(() => eng.world.place(eng.world.get('dagger')!, { on: 'inside', holder: 'actor' })) // bare hands: the dagger is no warrior's
    eng.world.get('foe')!.facing = 'up'
    eng.world.state.tick = 100
    expect(blow(eng)).toBe(10)
  })

  it('an NPC with the same profession and talents gets the same backstab calculations', () => {
    const eng = duel()
    const map = eng.world.posOf(eng.world.player)!.map
    const npc = eng.world.author(() => eng.world.add({ id: 'npc', type: 'actor/person', place: { on: 'tile', map, x: 2, y: 1 }, props: { hp: 20, maxHp: 20, profession: 'assassin' }, tags: ['skill:backstab'] }))
    eng.world.player.facing = 'left'
    const dagger = eng.world.author(() => eng.world.add({ id: 'npc.dagger', type: 'item/weapon/blade/dagger', place: { on: 'hand', holder: 'npc' } }))
    expect(combatStrike(eng.world, npc, eng.world.player, 10, 1, dagger, true).power).toBe(14)
    expect(combatStrike(eng.world, npc, eng.world.player, 10, 1, undefined, true).power).toBe(10)
  })
})
