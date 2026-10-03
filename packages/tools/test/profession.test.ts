import { describe, expect, it } from 'vitest'
import { Game, PROFESSION_LEVEL, RuleLibrary, combatDamage, combatStrike, rangeBonus, type Engine, type Entity } from '@lsw/engine'
import { BASE_RULES, PROFESSION_BY_ID, SKILLS, SKILL_BY_ID, SKILL_PROFESSIONS, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
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
  eng.teleport(w.player, { map: at.map, x: at.x, y: at.y + 1 })
  Object.assign((w.player.props ??= {}), { level, skillPoints: points })
  return bram
}

/** How many of a type the player carries, in hand or bag. */
const carries = (eng: Engine, type: string) => [eng.world.player.held, ...(eng.world.player.contents ?? [])].filter((id) => eng.world.get(id)?.type === type).length
const learnAll = (eng: Engine, ids: string[]) => ids.forEach((id) => expect(eng.controls.learn(SKILL_BY_ID[id]), id).toBe(true))
const weapon = (eng: Engine, type: string, props: Record<string, number | string> = {}) => eng.world.create(type, { on: 'hand', holder: eng.world.state.player }, { props: { power: 3, ...props } })

describe('professions', () => {
  it('none at the start: no profession skill can be learned', () => {
    const eng = world()
    const p = eng.world.player
    expect(eng.world.prop(p, 'profession')).toBeUndefined()
    p.props!.skillPoints = 5
    for (const prof of SKILL_PROFESSIONS) expect(eng.controls.learn(SKILLS.find((s) => s.profession === prof.id && !s.requires?.length)!)).toBe(false)
  })

  it('every profession has a six-skill tree and a starter weapon', () => {
    for (const id of ['assassin', 'warrior', 'ranger', 'mage']) {
      expect(PROFESSION_BY_ID[id]?.weapon, id).toBeDefined()
      expect(SKILLS.filter((s) => s.profession === id), id).toHaveLength(6)
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
    eng.teleport(w.player, { map: 'ford', x: 14, y: 17 })
    w.player.props!.level = PROFESSION_LEVEL
    expect(eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)).toBe('trainer')
    atBram(eng, PROFESSION_LEVEL)
    expect(eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)).toBeUndefined()
    expect(w.prop(w.player, 'profession')).toBe('warrior')
    expect(carries(eng, 'item/weapon/blunt/mace')).toBe(1)
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
    // back to the warrior: the mace was handed over once already
    eng.controls.takeProfession(PROFESSION_BY_ID.warrior, SKILLS)
    expect(carries(eng, 'item/weapon/blunt/mace')).toBe(1)
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
    const slime = w.create('actor/creature/slime/green_slime', { on: 'tile', map: pos.map, x: pos.x + 1, y: pos.y }, { props: { hp: 50, maxHp: 50 } })
    return { eng, w, p: w.player, slime }
  }
  const power = (f: ReturnType<typeof fighter>, held: Entity, range = 1) => combatStrike(f.w, f.p, f.slime, 3, range, held, true).power

  it('warrior: arms training, bulwark, retaliation', () => {
    const f = fighter('warrior', ['warrior-arms', 'bulwark', 'retaliation'])
    const mace = weapon(f.eng, 'item/weapon/blunt/mace')
    f.p.held = mace.id
    expect(power(f, mace)).toBe(4)
    expect(combatDamage(f.w, f.p, 10, f.slime, false)).toBe(9) // −15% (and retaliation is now ready)
    expect(power(f, mace)).toBeCloseTo(4 * 1.4)
  })

  it('ranger: archery reach and power, steady aim, sniper', () => {
    const f = fighter('ranger', ['ranger-archery', 'steady-aim', 'sniper'])
    const bow = weapon(f.eng, 'item/weapon/ranged/bow', { range: 6 })
    expect(rangeBonus(f.w, f.p, bow)).toBe(1)
    f.w.state.tick += 20 // stood still a while
    const pos = f.w.posOf(f.p)!
    f.w.place(f.slime, { on: 'tile', map: pos.map, x: pos.x + 4, y: pos.y })
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
    const wand = weapon(f.eng, 'item/weapon/magic/wand', { range: 5, element: 'fire' })
    f.p.held = wand.id
    expect(power(f, wand, 5)).toBeCloseTo(4 * 1.25)
    expect(combatDamage(f.w, f.p, 10, f.slime, false)).toBe(8)
    expect(rangeBonus(f.w, f.p, wand)).toBe(0)
  })
})
