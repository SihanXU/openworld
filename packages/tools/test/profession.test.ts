import { describe, expect, it } from 'vitest'
import { Game, MAINHAND, OFFHAND, PROFESSION_LEVEL, RuleLibrary, canWield, combatDamage, combatDelay, combatStrike, offhandOf, rangeBonus, snapshot, weaponOf, type Engine, type Entity, type MapData } from '@lsw/engine'
import { BASE_RULES, LEGENDARY_ARMS, PROFESSION_BY_ID, PROLOGUE_DONE, SKILLS, SKILL_BY_ID, SKILL_PROFESSIONS, STORY_RULES, buildOntology, createBoss, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

// Professions (docs/skill-tree.md): none at the start; Bram in Firstlight Village sets you on one
// from level 5; a change gives the profession branch's points back. Each new tree's talents.

function world(): Engine {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  return game.engine
}

/** The player beside Bram, at a level and with points. */
function atBram(eng: Engine, level: number, points = 0): Entity {
  const w = eng.world
  const bram = w.get('npc.bram')!
  const at = w.posOf(bram)!
  eng.author(() => eng.teleport(w.player, { map: at.map, x: at.x, y: at.y + 1 }))
  Object.assign((w.player.props ??= {}), { level, skillPoints: points })
  return bram
}

/** How many of a type the player carries, in hand or bag. */
const carries = (eng: Engine, type: string) => [eng.world.player.held, ...(eng.world.player.contents ?? [])].filter((id) => eng.world.get(id)?.type === type).length
const learnAll = (eng: Engine, ids: string[]) => ids.forEach((id) => expect(eng.controls.learn(SKILL_BY_ID[id]), id).toBe(true))
const weapon = (eng: Engine, type: string, props: Record<string, number | string> = {}) => eng.author(() => eng.world.create(type, { on: 'hand', holder: eng.world.state.player }, { props: { power: 3, ...props } }))

describe('professions', () => {

  it('an older save\'s Bram, who still kept a bed and milled about, keeps his spot when it is loaded (the world says his days and what he is)', () => {
    const { index, chunks } = buildFord()
    const onto = buildOntology()
    const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
    const game = Game.create(index, onto, lib())
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const saved = structuredClone(game.save())
    // as a save from before: no tag, a night in bed
    const old = saved.state.entities['npc.bram']
    old.tags = (old.tags ?? []).filter((t) => t !== 'stationary')
    old.npc!.schedule = [{ from: 22, to: 6, map: 'meadow', anchor: 'drill.bed', activity: 'sleep' } as never, ...old.npc!.schedule]
    const loaded = Game.load(saved, index, onto, lib())
    const bram = loaded.engine.world.get('npc.bram')!
    expect(bram.tags).toContain('stationary')
    expect(bram.npc!.schedule).toEqual(index.npcs.find((n) => n.id === 'npc.bram')!.npc!.schedule)
  })
  it('none at the start: no profession skill can be learned', () => {
    const eng = world()
    const p = eng.world.player
    expect(eng.world.prop(p, 'profession')).toBeUndefined()
    p.props!.skillPoints = 5
    for (const prof of SKILL_PROFESSIONS) expect(eng.controls.learn(SKILLS.find((s) => s.profession === prof.id && !s.requires?.length)!)).toBe(false)
  })

  it('every profession has a tree of at least twenty: talents, seven active skills (one an ultimate), enhancements, a capstone; and a starter weapon', () => {
    for (const id of ['assassin', 'warrior', 'ranger', 'mage']) {
      const own = SKILLS.filter((s) => s.profession === id)
      expect(PROFESSION_BY_ID[id]?.weapon, id).toBeDefined()
      expect(own.length, id).toBeGreaterThanOrEqual(20)
      expect(own.filter((s) => s.active), id).toHaveLength(7)
      expect(own.filter((s) => s.modifies), id).toHaveLength(5)
      // two ultimates: an active and a capstone talent, two points each, joining two arms
      expect(own.filter((s) => (s.cost ?? 1) === 2 && (s.requires?.length ?? 0) === 2).length, id).toBeGreaterThanOrEqual(3)
      // what an enhancement strengthens is the profession's own active skill
      for (const m of own.filter((s) => s.modifies)) expect(SKILLS.find((s) => s.id === m.modifies!.skill)?.profession, m.id).toBe(id)
    }
  })

  it('Bram, in Firstlight Village, opens the choice when spoken to', () => {
    const eng = world()
    const bram = atBram(eng, 1)
    expect(eng.world.posOf(bram)?.map).toBe('meadow')
    eng.world.fx.length = 0
    eng.interact('interact', eng.world.state.player, { e: bram.id }, { instrument: null })
    expect(eng.world.fx.some((x) => x.t === 'panel' && x.panel === 'profession')).toBe(true)
  })

  it(`is chosen from level ${PROFESSION_LEVEL}, beside a trainer`, () => {
    const eng = world()
    const w = eng.world
    atBram(eng, PROFESSION_LEVEL - 1)
    expect(eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)).toBe('level')
    eng.author(() => eng.teleport(w.player, { map: 'ford', x: 14, y: 17 }))
    w.player.props!.level = PROFESSION_LEVEL
    expect(eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)).toBe('trainer')
    atBram(eng, PROFESSION_LEVEL)
    expect(eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)).toBeUndefined()
    expect(w.prop(w.player, 'profession')).toBe('warrior')
    // sword and shield: the shield is worn in the off hand at once
    expect(carries(eng, 'item/weapon/blade/sword')).toBe(1)
    expect(carries(eng, 'item/armor/shield')).toBe(1)
    expect(offhandOf(w, w.player)?.type).toBe('item/armor/shield')
  })

  it('a change gives the profession branch back: skills unlearned, grants undone, points returned, shared skills kept', () => {
    const eng = world()
    const w = eng.world
    const p = w.player
    atBram(eng, 9, 8)
    eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)
    const maxHp = w.num(p, 'maxHp')
    learnAll(eng, ['vitality', 'warrior-arms', 'bulwark', 'unbreakable'])
    expect(w.num(p, 'maxHp')).toBe(maxHp + 4 + 10)
    expect(p.props!.skillPoints).toBe(4)
    expect(eng.controls.takeProfession(PROFESSION_BY_ID.ranger, SKILLS)).toBeUndefined()
    expect(p.props!.skillPoints).toBe(7)
    expect(w.num(p, 'maxHp')).toBe(maxHp + 4)
    expect(p.tags).toContain('skill:vitality')
    for (const id of ['warrior-arms', 'bulwark', 'unbreakable']) expect(p.tags).not.toContain(`skill:${id}`)
    expect(carries(eng, 'item/weapon/ranged/bow')).toBe(1)
    // the ranger cannot wear the warrior's shield: it came off into the bag
    expect(w.prop(p, OFFHAND)).toBeUndefined()
    expect(carries(eng, 'item/armor/shield')).toBe(1)
    // back to the warrior: the sword and shield were handed over once already
    eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)
    expect(carries(eng, 'item/weapon/blade/sword')).toBe(1)
    expect(carries(eng, 'item/armor/shield')).toBe(1)
  })
})

describe('the new trees', () => {
  /** A player of a profession with these skills, a target slime beside them. */
  function fighter(profession: string, skills: string[]) {
    const eng = world()
    const w = eng.world
    atBram(eng, 20, 30)
    eng.controls.takeProfession(PROFESSION_BY_ID[profession], SKILLS)
    learnAll(eng, skills)
    const pos = w.posOf(w.player)!
    const slime = w.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: pos.map, x: pos.x + 1, y: pos.y }, { props: { hp: 50, maxHp: 50 } }))
    return { eng, w, p: w.player, slime }
  }
  const power = (f: ReturnType<typeof fighter>, held: Entity, range = 1) => combatStrike(f.w, f.p, f.slime, 3, range, held, true).power

  it('warrior: arms training, bulwark, retaliation', () => {
    const f = fighter('warrior', ['warrior-arms', 'bulwark', 'retaliation'])
    const sword = weapon(f.eng, 'item/weapon/blade/sword')
    f.p.held = sword.id
    expect(power(f, sword)).toBe(4)
    expect(f.eng.author(() => combatDamage(f.eng, f.p, 10, f.slime, false))).toBe(9) // −15% (and retaliation is now ready; the shield's defence is the blow's, later)
    expect(power(f, sword)).toBeCloseTo(4 * 1.4)
  })

  it('a common weapon takes no profession talent: the mace is no warrior weapon', () => {
    const f = fighter('warrior', ['warrior-arms', 'bulwark', 'retaliation'])
    const mace = weapon(f.eng, 'item/weapon/blunt/mace')
    f.p.held = mace.id
    expect(canWield(f.w, f.p, mace)).toBe(true)
    expect(power(f, mace)).toBe(3)
    f.eng.author(() => combatDamage(f.eng, f.p, 10, f.slime, false)) // retaliation ready, but not for a mace
    expect(power(f, mace)).toBe(3)
  })

  it('ranger: archery reach and power, steady aim, sniper', () => {
    const f = fighter('ranger', ['ranger-archery', 'steady-aim', 'sniper'])
    const bow = weapon(f.eng, 'item/weapon/ranged/bow', { range: 6 })
    expect(rangeBonus(f.w, f.p, bow)).toBe(1)
    f.w.state.tick += 20 // stood still a while
    const pos = f.w.posOf(f.p)!
    f.w.author(() => f.w.place(f.slime, { on: 'tile', map: pos.map, x: pos.x + 4, y: pos.y }))
    expect(power(f, bow, 7)).toBeCloseTo(4 * (1 + 0.3 + 0.25))
  })

  it("ranger: hunter's mark makes every third hit on one target critical", () => {
    const f = fighter('ranger', ['ranger-archery', 'steady-aim', 'sniper', 'fleet-archer', 'quick-draw', 'hunters-mark'])
    const bow = weapon(f.eng, 'item/weapon/ranged/bow', { range: 6 })
    f.p.combat = { markTarget: f.slime.id, markHits: 2 }
    expect(combatStrike(f.w, f.p, f.slime, 3, 7, bow, true).critical).toBe(true)
  })

  it('mage: focus, elemental attunement, mana shield, archmage reach', () => {
    const f = fighter('mage', ['mage-focus', 'elemental-attunement', 'mana-shield'])
    const staff = weapon(f.eng, 'item/weapon/magic/staff', { range: 4, element: 'fire' })
    f.p.held = staff.id
    expect(power(f, staff, 4)).toBeCloseTo(4 * 1.25)
    expect(f.eng.author(() => combatDamage(f.eng, f.p, 10, f.slime, false))).toBe(8)
    expect(rangeBonus(f.w, f.p, staff)).toBe(0)
    // the wand is common to all: no focus, no attunement, no mana shield
    const wand = weapon(f.eng, 'item/weapon/magic/wand', { range: 5, element: 'fire' })
    expect(power(f, wand, 5)).toBe(3)
    expect(f.eng.author(() => combatDamage(f.eng, f.p, 10, f.slime, false))).toBe(10)
  })
})

describe('profession weapons', () => {
  it('dagger, sword and shield, bow and staff each belong to one profession; the rest are common', () => {
    const eng = world()
    const w = eng.world
    const own: Record<string, string> = {
      'item/weapon/blade/dagger': 'assassin',
      'item/weapon/blade/sword': 'warrior',
      'item/weapon/blade/scimitar': 'warrior',
      'item/armor/shield': 'warrior',
      'item/weapon/ranged/bow': 'ranger',
      'item/weapon/magic/staff': 'mage',
    }
    const common = ['item/weapon/blade/axe', 'item/weapon/blunt/club', 'item/weapon/blunt/mace', 'item/weapon/blunt/warhammer', 'item/weapon/polearm/spear', 'item/weapon/polearm/halberd', 'item/weapon/magic/wand', 'item/weapon/blade/dragonsbane']
    const p = w.player
    for (const [type, profession] of [...Object.entries(own), ...Object.entries(LEGENDARY_ARMS).flatMap(([pr, arms]) => arms.map((a) => [a, pr]))]) {
      const item = eng.author(() => w.create(type, { on: 'inside', holder: p.id }))
      for (const other of SKILL_PROFESSIONS) {
        p.props!.profession = other.id
        expect(canWield(w, p, item), `${type} for ${other.id}`).toBe(other.id === profession)
      }
      delete p.props!.profession
      expect(canWield(w, p, item), `${type} without a profession`).toBe(false)
    }
    for (const type of common) {
      const item = eng.author(() => w.create(type, { on: 'inside', holder: p.id }))
      expect(canWield(w, p, item), type).toBe(true)
    }
  })

  it('another profession may carry the weapon, but its blow is refused (and said)', () => {
    const eng = world()
    const w = eng.world
    const p = w.player
    atBram(eng, 9)
    eng.controls.takeProfession(PROFESSION_BY_ID.ranger, SKILLS)
    // the ranger's bow, back in the bag
    eng.author(() => { if (p.held) w.place(w.get(p.held)!, { on: 'inside', holder: p.id }) })
    const pos = w.posOf(p)!
    p.facing = 'right'
    const slime = eng.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: pos.map, x: pos.x + 1, y: pos.y }, { props: { hp: 50, maxHp: 50 } }))
    const sword = eng.author(() => w.create('item/weapon/blade/sword', { on: 'hand', holder: p.id }, { props: { power: 4 } }))
    expect(eng.attack(p, { e: slime.id })).toBe(false)
    w.fx = []
    eng.playerAttack({ e: slime.id })
    expect(w.num(slime, 'hp')).toBe(50)
    expect(w.fx.some((f) => f.t === 'log' && typeof f.text !== 'string' && f.text.zh === '只有战士会用剑战斗。')).toBe(true)
    const plan = eng.controls.plan('use', { x: pos.x + 1, y: pos.y })
    expect(plan?.attack).toBe(true)
    expect(typeof plan?.label === 'string' ? plan.label : plan?.label.zh).toBe('只有战士会用剑')
    // the ranger's own bow strikes
    eng.author(() => w.place(sword, { on: 'inside', holder: p.id }))
    eng.author(() => w.create('item/weapon/ranged/bow', { on: 'hand', holder: p.id }, { props: { power: 3, range: 6 } }))
    expect(eng.attack(p, { e: slime.id })).toBe(true)
    expect(w.num(slime, 'hp')).toBeLessThan(50)
  })

  it('a bow looses an arrow (its missile: drawn as one in flight); a wand a bolt of its element', () => {
    const eng = world()
    const w = eng.world
    const p = w.player
    atBram(eng, 9)
    eng.controls.takeProfession(PROFESSION_BY_ID.ranger, SKILLS)
    // an open row in the village: the player, two empty cells, a slime
    const open = (x: number, y: number) => w.walkable('meadow', x, y) && !w.placedAt('meadow', x, y).length
    let at: [number, number] | undefined
    for (let y = 2; y < 30 && !at; y++) for (let x = 2; x < 36 && !at; x++) if ([0, 1, 2, 3].every((i) => open(x + i, y))) at = [x, y]
    eng.author(() => eng.teleport(p, { map: 'meadow', x: at![0], y: at![1] }))
    p.facing = 'right'
    const slime = eng.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: 'meadow', x: at![0] + 3, y: at![1] }, { props: { hp: 50, maxHp: 50 } }))
    eng.author(() => { if (p.held) w.place(w.get(p.held)!, { on: 'inside', holder: p.id }) })
    eng.author(() => w.create('item/weapon/ranged/bow', { on: 'hand', holder: p.id }, { props: { power: 3, range: 6 } }))
    w.fx = []
    expect(eng.attack(p, { e: slime.id })).toBe(true)
    expect(w.fx.find((f) => f.t === 'vfx' && f.fx.startsWith('bolt:'))).toMatchObject({ fx: 'bolt:none:right:3:arrow' })
    // a wand (anyone's): no missile of its own, the bolt of its element
    eng.author(() => { if (p.held) w.place(w.get(p.held)!, { on: 'inside', holder: p.id }) })
    eng.author(() => w.create('item/weapon/magic/wand', { on: 'hand', holder: p.id }, { props: { power: 3, range: 5, element: 'fire' } }))
    eng.setCooldown('atk:player', 0)
    w.fx = []
    expect(eng.attack(p, { e: slime.id })).toBe(true)
    expect(w.fx.find((f) => f.t === 'vfx' && f.fx.startsWith('bolt:'))).toMatchObject({ fx: 'bolt:fire:right:3' })
  })

  it('what is worn is on the body, not in the bag: putting it on frees its bag slot, taking it off takes one again; of two alike, the one not worn stays in the bag', () => {
    const eng = world()
    const w = eng.world
    const p = w.player
    const filled = () => snapshot(eng).player.slots.filter(Boolean).length
    const helmet = eng.author(() => w.create('item/armor/helmet', { on: 'inside', holder: p.id }, { props: { def: 1 } }))
    eng.controls.sync()
    const before = filled()
    eng.controls.wear(helmet.id, true)
    expect(w.prop(p, 'wear:head')).toBe(helmet.id)
    expect(filled()).toBe(before - 1)
    expect(snapshot(eng).player.worn.head?.id).toBe(helmet.id)
    eng.controls.wear(helmet.id)
    expect(w.prop(p, 'wear:head')).toBeUndefined()
    expect(filled()).toBe(before)
    // two rings alike: one worn, the other still a stack of one in the bag
    const [a, b] = eng.author(() => [0, 1].map(() => w.create('item/valuable/ring', { on: 'inside', holder: p.id }, { tags: ['material:gold'] })))
    eng.controls.sync()
    eng.controls.wear(a.id, true)
    const ring = snapshot(eng).player.slots.find((s) => s?.item.type === 'item/valuable/ring')
    expect([ring?.count, ring?.worn]).toEqual([1, undefined])
    void b
  })

  it('the main hand: a weapon readied there strikes while the hand holds something else; an empty hand strikes with it; its numbers count once', () => {
    const eng = world()
    const w = eng.world
    const p = w.player
    atBram(eng, 9)
    eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)
    // whatever the trainer handed over goes back to the bag; a sword readied in the main hand (the bag's Wear)
    eng.author(() => { if (p.held) w.place(w.get(p.held)!, { on: 'inside', holder: p.id }) })
    const sword = eng.author(() => w.create('item/weapon/blade/sword', { on: 'inside', holder: p.id }, { props: { power: 9 } }))
    const bread = eng.author(() => w.create('item/food/bread', { on: 'inside', holder: p.id }))
    eng.controls.sync()
    eng.controls.wear(sword.id, true)
    expect(w.prop(p, MAINHAND)).toBe(sword.id)
    // the hand takes up the bread: the sword is still the one fought with
    eng.author(() => w.place(bread, { on: 'hand', holder: p.id }))
    expect([w.get(p.held)?.type, weaponOf(w, p)?.id]).toEqual(['item/food/bread', sword.id])
    const pos = w.posOf(p)!
    p.facing = 'right'
    const slime = eng.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: pos.map, x: pos.x + 1, y: pos.y }, { props: { hp: 80, maxHp: 80 } }))
    const mark = eng.traced
    expect(eng.attack(p, { e: slime.id })).toBe(true)
    // the blow is the sword's: its power, and the act's instrument is the sword, not the bread
    expect(w.num(slime, 'hp')).toBeLessThanOrEqual(80 - 9)
    const blow = eng.trace.slice(-(eng.traced - mark)).find((t) => t.ev.kind === 'act/use' && t.ev.params?.attack)
    expect(blow?.ev.roles.instrument).toEqual({ e: sword.id })
    expect(w.get(bread.id)?.place).toMatchObject({ on: 'hand', holder: p.id })
    // an empty hand: a click on the slime is a blow with the sword (so its label says)
    eng.author(() => w.place(bread, { on: 'inside', holder: p.id }))
    const plan = eng.controls.plan('use', { x: pos.x + 1, y: pos.y })
    expect([plan?.attack, typeof plan?.label === 'string' ? plan.label : plan?.label.zh]).toEqual([true, '用剑打绿史莱姆'])
    // a weapon's own numbers count when it is fought with, not again for being worn (Galestring's haste)
    const legend = eng.author(() => w.create('item/weapon/ranged/bow/galestring', { on: 'inside', holder: p.id }))
    const bare = combatDelay(w, p, 100, 'attack')
    eng.author(() => w.setProp(p, 'profession', 'ranger'))
    eng.controls.wear(legend.id, true)
    expect(w.prop(p, MAINHAND)).toBe(legend.id)
    // (the sword it replaced is back in the bag; the hand is left empty, so the bow in the main hand is the one fought with)
    eng.controls.select(p.slots!.findIndex((k) => !k))
    expect(w.get(p.held)).toBeUndefined()
    expect(w.stat(p, 'attackHaste')).toBe(0)
    expect(combatDelay(w, p, 100, 'attack')).toBeLessThan(bare)
  })

  it('the off hand (the arm slot): only a warrior wears a shield; it blocks, and a profession change takes it off', () => {
    const eng = world()
    const w = eng.world
    const p = w.player
    const shield = eng.author(() => w.create('item/armor/shield', { on: 'inside', holder: p.id }, { props: { def: 2 } }))
    eng.controls.sync()
    // no profession: it will not go on
    eng.controls.wear(shield.id)
    expect(w.prop(p, OFFHAND)).toBeUndefined()
    atBram(eng, 9)
    eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)
    const starter = w.prop(p, OFFHAND) as string
    expect(w.get(starter)?.type).toBe('item/armor/shield')
    // wear the other one instead; the slot shows it, and its defence counts
    eng.controls.wear(shield.id)
    expect(w.prop(p, OFFHAND)).toBe(shield.id)
    expect(snapshot(eng).player.offhand).toMatchObject({ id: shield.id, works: true })
    expect(w.stat(p, 'def')).toBe(w.num(p, 'def') + 2)
    // the legendary wall turns blows aside: a block of 1 is held to half the blows
    const wall = eng.author(() => w.create('item/armor/shield/unfallen', { on: 'inside', holder: p.id }, { props: { block: 1 } }))
    eng.controls.wear(wall.id)
    expect(offhandOf(w, p)?.id).toBe(wall.id)
    const slime = eng.author(() => w.create('actor/creature/slime/green_slime', { on: 'tile', map: 'meadow', x: 1, y: 1 }))
    const blows = Array.from({ length: 20 }, () => eng.author(() => combatDamage(eng, p, 10, slime, false)))
    expect(blows.filter((d) => d === 0).length).toBeGreaterThan(0)
    expect(blows.filter((d) => d > 0).length).toBeGreaterThan(0)
    // taken off from the slot: offered again, it comes off
    eng.controls.wear()
    expect(w.prop(p, OFFHAND)).toBeUndefined()
    // a ranger: the shield comes off and no longer works
    eng.controls.wear(shield.id)
    eng.controls.takeProfession(PROFESSION_BY_ID.ranger, SKILLS)
    expect(w.prop(p, OFFHAND)).toBeUndefined()
    expect(offhandOf(w, p)).toBeUndefined()
  })

  it('a fallen sin leaves its feller the first legendary of their profession the world has not seen', () => {
    const { index } = buildFord()
    const at = { map: 'arena', x: 16, y: 20 }
    Object.assign(index, { start: at, npcs: [], companions: [], steps: [], quests: [], invariants: [], waypoints: [] })
    index.player.place = { on: 'tile', ...at }
    index.player.props = { ...index.player.props, hp: 1000, maxHp: 1000, prologue: PROLOGUE_DONE, profession: 'warrior' }
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const map: MapData = { id: 'arena', name: 'Arena', kind: 'wild', width: 40, height: 40, terrain: Array(1600).fill('grass'), portals: [], light: 'indoor' }
    game.loadChunk({ map, entities: [createBoss('pride', { map: 'arena', x: 16, y: 16 }), createBoss('envy', { map: 'arena', x: 30, y: 30 }), createBoss('lust', { map: 'arena', x: 6, y: 30 })] })
    const eng = game.engine
    const w = eng.world
    const dropped = (type: string) => w.entitiesOnMap('arena').filter((e) => e.type === type).length
    eng.damage(w.get('sin.pride')!, 10000, undefined, true, { e: w.player.id })
    expect(dropped('item/weapon/blade/sword/oathbrand')).toBe(1)
    eng.damage(w.get('sin.envy')!, 10000, undefined, true, { e: w.player.id })
    expect(dropped('item/armor/shield/unfallen')).toBe(1)
    expect(w.fact('legend.oathbrand')).toBe(1)
    expect(w.fact('legend.unfallen')).toBe(1)
    // both seen: the third sin leaves only its ordinary reward
    eng.damage(w.get('sin.lust')!, 10000, undefined, true, { e: w.player.id })
    expect(w.entitiesOnMap('arena').filter((e) => w.hasTag(e, 'legend')).length).toBe(2)
  })
})
