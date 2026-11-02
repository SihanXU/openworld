// The advancements (docs/advancement.md): a path of three at level 10, the profession's mastery at 16, at a trainer;
// a path's skills learned only on it, the mastery's only once advanced so far; a change of path gives its points back.
// The new skills do what they say on a field of slimes: the passives in data, the buffs, the fields and traps, the
// detonations, the leaps, the beasts and the dead called and commanded, the marks, the wards, what a Demon Hunter shares
// with those who follow.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, cannotLearn, textOf, type Engine, type Entity, type MapData } from '@openworld/engine'
import { ADVANCE_LEVELS, ADVANCE_POINTS, advanceProfession, cast, combatDamage, combatStrike, effectiveActive, setSkill, thirdOf } from '@openworld/modules'
import { ADVANCEMENT_SKILLS, BASE_RULES, HAZARDS, MASTERIES, PATHS, SKILLS, SKILL_BY_ID, SKILL_PROFESSIONS, STORY_RULES, SUMMONS, branchesForProfession, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

function field(): { eng: Engine; p: Entity; x: number; y: number } {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const map: MapData = { id: 'arena', name: 'Arena', kind: 'wild', width: 30, height: 30, terrain: Array(900).fill('grass'), portals: [] }
  game.loadMapData(map)
  const eng = game.engine
  const w = eng.world
  for (const s of SKILLS) eng.skills.set(s.id, s)
  const [x, y] = [15, 15]
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
    eng.teleport(w.player, { map: 'arena', x, y })
  })
  w.player.facing = 'right'
  eng.controls.sync()
  return { eng, p: w.player, x, y }
}
/** The player knows a skill (its profession and path theirs), in the bar's first slot if it is cast. */
function know(eng: Engine, id: string): void {
  const w = eng.world
  const def = SKILL_BY_ID[id]
  eng.author(() => {
    if (def.profession) w.setProp(w.player, 'profession', def.profession)
    if (def.path) w.setProp(w.player, 'path', def.path)
    w.addTag(w.player, `skill:${id}`)
  })
  if (def.active) expect(setSkill(eng, 0, id)).toBe(true)
}
const slime = (eng: Engine, x: number, y: number, props: Record<string, number> = {}) => eng.author(() => eng.world.create('actor/creature/slime/green_slime', { on: 'tile', map: 'arena', x, y }, { props: { hp: 200, maxHp: 200, ...props } }))
const lost = (eng: Engine, e: Entity) => 200 - eng.world.num(e, 'hp')

describe('the advancements (docs/advancement.md)', () => {
  it('every profession has three paths of six skills (three active, three passive), a mastery of five (two active), and four more first skills', () => {
    for (const prof of SKILL_PROFESSIONS) {
      expect(prof.paths?.map((p) => p.id), prof.id).toEqual(PATHS[prof.id].map((p) => p.id))
      expect(prof.paths).toHaveLength(3)
      for (const path of prof.paths!) {
        const own = ADVANCEMENT_SKILLS.filter((s) => s.path === path.id)
        expect(own, path.id).toHaveLength(6)
        expect(own.filter((s) => s.active).length, path.id).toBe(3)
        expect(own.every((s) => s.profession === prof.id && s.branch === 'path'), path.id).toBe(true)
        // one ultimate, two points, after the rest
        expect(own.filter((s) => (s.cost ?? 1) === 2 && s.active).length, path.id).toBe(1)
      }
      const mastery = ADVANCEMENT_SKILLS.filter((s) => s.profession === prof.id && s.tier === 3)
      expect(mastery, prof.id).toHaveLength(5)
      expect(mastery.filter((s) => s.active).length).toBe(2)
      expect(prof.mastery?.name).toEqual(MASTERIES[prof.id].name)
      expect(ADVANCEMENT_SKILLS.filter((s) => s.profession === prof.id && s.branch === 'profession')).toHaveLength(4)
    }
    // every requirement is a skill of the same profession
    for (const s of ADVANCEMENT_SKILLS) for (const r of s.requires ?? []) expect(SKILL_BY_ID[r]?.profession, `${s.id} ← ${r}`).toBe(s.profession)
  })

  it('the assassin\'s third takes its path\'s name — Hell Sovereign, Phantom, Ghostwail — its skills the assassin\'s own whatever the path', () => {
    const assassin = SKILL_PROFESSIONS.find((p) => p.id === 'assassin')!
    expect(assassin.paths!.map((p) => [p.id, textOf(p.name, 'zh'), p.third && textOf(p.third.name, 'zh')])).toEqual([['necromancer', '死灵术士', '地狱支配者'], ['shadowdancer', '影舞者', '幻影'], ['demonhunter', '猎魔人', '鬼泣']])
    expect(textOf(thirdOf(assassin, 'demonhunter')!.name, 'zh')).toBe('鬼泣')
    expect(thirdOf(assassin, 'demonhunter')?.doc).toEqual(MASTERIES.assassin.doc)
    expect(branchesForProfession('assassin', 'necromancer').find((b) => b.id === 'mastery')?.name.zh).toBe('地狱支配者')
    // (a profession whose paths name no third keeps its mastery's name)
    expect(branchesForProfession('warrior', 'berserker').find((b) => b.id === 'mastery')?.name.zh).toBe('典范')
    expect(ADVANCEMENT_SKILLS.filter((s) => s.profession === 'assassin' && s.tier === 3).every((s) => !s.path)).toBe(true)
  })

  it('a path\'s skill is learned only on that path, a mastery\'s only once advanced to the third', () => {
    const { eng, p } = field()
    const w = eng.world
    eng.author(() => (w.setProp(p, 'profession', 'assassin'), w.setProp(p, 'skillPoints', 20)))
    expect(cannotLearn(p, SKILL_BY_ID['shadow-poise'])).toBe('path')
    eng.author(() => w.setProp(p, 'path', 'necromancer'))
    expect(cannotLearn(p, SKILL_BY_ID['shadow-poise'])).toBe('path')
    expect(cannotLearn(p, SKILL_BY_ID['grave-pact'])).toBeUndefined()
    expect(cannotLearn(p, SKILL_BY_ID.lethality)).toBe('tier')
    eng.author(() => w.setProp(p, 'advancement', 3))
    expect(cannotLearn(p, SKILL_BY_ID.lethality)).toBeUndefined()
  })

  it('at a trainer: the second advancement at level 10 sets one on a path (+3 points), a change of path gives its points back, the third opens the mastery', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    const p = w.player
    const bram = w.get('npc.bram')!
    const at = w.posOf(bram)!
    eng.author(() => {
      eng.quests.put('descent', 'done')
      eng.teleport(p, { map: at.map, x: at.x + 1, y: at.y })
      w.setProp(p, 'profession', 'warrior')
      w.setProp(p, 'level', 9)
      w.setProp(p, 'skillPoints', 0)
    })
    const advance = (tier: number, path?: string) => advanceProfession(eng, tier, path, SKILL_PROFESSIONS, SKILLS)
    expect(advance(2, 'berserker')).toBe('level')
    eng.author(() => w.setProp(p, 'level', ADVANCE_LEVELS[2]))
    expect(advance(3)).toBe('order')
    expect(advance(2, 'pyromancer')).toBe('path')
    expect(advance(2, 'berserker')).toBeUndefined()
    expect([w.prop(p, 'path'), w.num(p, 'advancement'), w.num(p, 'skillPoints')]).toEqual(['berserker', 2, ADVANCE_POINTS])
    expect(eng.controls.learn(SKILL_BY_ID['blood-fury'])).toBe(true)
    expect(eng.controls.learn(SKILL_BY_ID['blood-rage'])).toBe(true)
    // a change of path: its two points back, its skills gone, no new points for a tier already reached
    expect(advance(2, 'sentinel')).toBeUndefined()
    expect([w.prop(p, 'path'), w.num(p, 'skillPoints'), w.hasTag(p, 'skill:blood-rage')]).toEqual(['sentinel', ADVANCE_POINTS, false])
    expect(advance(3)).toBe('level')
    eng.author(() => w.setProp(p, 'level', ADVANCE_LEVELS[3]))
    expect(advance(3)).toBeUndefined()
    expect([w.num(p, 'advancement'), w.num(p, 'skillPoints')]).toEqual([3, ADVANCE_POINTS * 2])
    expect(eng.controls.learn(SKILL_BY_ID['iron-body'])).toBe(true)
    // away from a trainer: no advancing
    eng.author(() => eng.teleport(p, { map: 'ford', x: 20, y: 18 }))
    expect(advance(2, 'thornknight')).toBe('trainer')
  }, 120_000)

  it('the passives in data pay under their condition: Hunter\'s Lore on the afflicted, Unyielding when hurt', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    know(eng, 'hunters-lore')
    const s = slime(eng, x + 1, y)
    const plain = combatStrike(w, p, s, 100, 1, undefined, false).power
    eng.author(() => eng.applyStatus({ e: s.id }, 'bleeding', 50))
    expect(combatStrike(w, p, s, 100, 1, undefined, false).power).toBeCloseTo(plain * 1.15, 5)
    // Unyielding: a third of health or less, a quarter less taken
    know(eng, 'unyielding')
    const before = combatDamage(eng, p, 40, s, false)
    eng.author(() => w.setProp(p, 'hp', 1))
    expect(combatDamage(eng, p, 40, s, false)).toBeLessThan(before)
  })

  it('a buff pays while it lasts, at its price: Blood Rage costs a share of health and strikes harder for 6 s', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    know(eng, 'blood-rage')
    const s = slime(eng, x + 1, y)
    const hp = w.num(p, 'hp')
    const plain = combatStrike(w, p, s, 100, 1, undefined, false).power
    expect(cast(eng, 0)).toBe(true)
    expect(w.num(p, 'hp')).toBeLessThan(hp)
    expect(combatStrike(w, p, s, 100, 1, undefined, false).power).toBeGreaterThan(plain * 1.35)
    for (let i = 0; i < 70; i++) eng.tick()
    expect(combatStrike(w, p, s, 100, 1, undefined, false).power).toBeCloseTo(plain, 5)
  })

  it('a field lays the game\'s hazards on its pattern, and they do what they say to a foe who walks in: Miasma poisons, a Snare holds and is spent', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    know(eng, 'miasma')
    expect(cast(eng, 0)).toBe(true)
    const clouds = w.entitiesOnMap('arena').filter((e) => e.type === HAZARDS.miasma)
    expect(clouds).toHaveLength(9)
    // a foe stepping into the cloud is poisoned; the caster's own cloud never hurts the caster
    const s = slime(eng, x + 3, y + 2)
    eng.act('move', s.id, { e: s.id }, { instrument: null, params: { map: 'arena', x: x + 3, y: y + 1 } })
    eng.tick()
    expect(w.hasStatus({ e: s.id }, 'poisoned')).toBe(true)
    know(eng, 'snare-trap')
    p.facing = 'down'
    expect(cast(eng, 0)).toBe(true)
    const snare = w.entitiesOnMap('arena').find((e) => e.type === HAZARDS.snare)!
    const t = slime(eng, x, y + 2)
    eng.act('move', t.id, { e: t.id }, { instrument: null, params: { map: 'arena', x, y: y + 1 } })
    eng.tick()
    expect(w.hasStatus({ e: t.id }, 'webbed')).toBe(true)
    expect(w.get(snare.id)).toBeUndefined()
  })

  it('a detonation bursts what is in its status and ends it (Combustion on the burning); a leap slams where it lands', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    know(eng, 'combustion')
    const s = slime(eng, x + 2, y)
    eng.author(() => eng.applyStatus({ e: s.id }, 'burning', 50))
    expect(cast(eng, 0)).toBe(true)
    expect(lost(eng, s)).toBeGreaterThan(0)
    expect(w.hasStatus({ e: s.id }, 'burning')).toBe(false)
    eng.author(() => w.destroy(s))
    know(eng, 'leap-of-ruin')
    const a = slime(eng, x + 4, y)
    expect(cast(eng, 0)).toBe(true)
    expect([lost(eng, a) > 0, w.posOf(p)!.x]).toEqual([true, x + 3])
  })

  it('the Necromancer fights through the dead it raises: stronger by the Grave Pact, every blow of theirs poisoned (Grave Toxin), a poisoned foe they fell bursts (Corpse Burst)', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    know(eng, 'raise-dead')
    expect(cast(eng, 0)).toBe(true)
    const raised = w.entitiesOnMap('arena').filter((e) => e.type === SUMMONS.skeleton)
    expect(raised).toHaveLength(2)
    expect(raised.every((e) => e.props?.companion === p.id && !eng.hostileTo(e, p))).toBe(true)
    const hp = w.num(raised[0], 'maxHp')
    know(eng, 'grave-pact')
    eng.setCooldown(`skill:raise-dead:${p.id}`, 0)
    expect(cast(eng, 0)).toBe(true)
    const bound = w.entitiesOnMap('arena').find((e) => e.type === SUMMONS.skeleton && !raised.includes(e))!
    expect(w.num(bound, 'maxHp')).toBe(Math.round(hp * 1.5))
    // the dead's blows poison; the Necromancer's own do not
    const s = slime(eng, x + 5, y + 5)
    expect(combatStrike(w, bound, s, 10, 1, undefined, true).afflict).toBeUndefined()
    know(eng, 'grave-toxin')
    expect(combatStrike(w, bound, s, 10, 1, undefined, true).afflict?.status).toBe('poisoned')
    expect(combatStrike(w, p, s, 10, 1, undefined, true).afflict).toBeUndefined()
    // a poisoned foe the dead fell bursts on those near it
    know(eng, 'corpse-burst')
    eng.author(() => {
      w.destroy(s)
      eng.teleport(bound, { map: 'arena', x: x + 5, y: y + 5 })
    })
    bound.facing = 'right'
    const weak = slime(eng, x + 6, y + 5, { hp: 1, maxHp: 1 })
    const near = slime(eng, x + 7, y + 5)
    eng.author(() => eng.applyStatus({ e: weak.id }, 'poisoned', 50))
    eng.setCooldown(`atk:${bound.id}`, 0)
    expect(eng.attack(bound, { e: weak.id })).toBe(true)
    eng.tick()
    expect(w.get(weak.id) === undefined || w.num(weak, 'hp') <= 0).toBe(true)
    expect([lost(eng, near) > 0, w.hasStatus({ e: near.id }, 'poisoned')]).toEqual([true, true])
  })

  it('the Demon Hunter: a sigil hexes the foe that walks in (weaker, softer); the Call of the Hunt and the Vigil are shared with those who follow', () => {
    const { eng, x, y } = field()
    const w = eng.world
    know(eng, 'binding-sigil')
    expect(cast(eng, 0)).toBe(true)
    expect(w.entitiesOnMap('arena').filter((e) => e.type === HAZARDS.sigil)).toHaveLength(9)
    const s = slime(eng, x + 3, y + 2, { atk: 6, def: 4 })
    const [atk, def] = [w.stat(s, 'atk'), w.stat(s, 'def')]
    eng.act('move', s.id, { e: s.id }, { instrument: null, params: { map: 'arena', x: x + 3, y: y + 1 } })
    eng.tick()
    expect(w.hasStatus({ e: s.id }, 'hexed')).toBe(true)
    expect([w.stat(s, 'atk'), w.stat(s, 'def')]).toEqual([atk - 2, def - 3])
    // one who follows the caster, near: struck harder while the call lasts, taking less with the vigil learned
    know(eng, 'raise-dead')
    expect(cast(eng, 0)).toBe(true)
    const ally = w.entitiesOnMap('arena').find((e) => e.type === SUMMONS.skeleton)!
    const plain = combatStrike(w, ally, s, 100, 1, undefined, false).power
    know(eng, 'hunt-call')
    expect(cast(eng, 0)).toBe(true)
    expect(combatStrike(w, ally, s, 100, 1, undefined, false).power).toBeCloseTo(plain * 1.2, 5)
    const taken = combatDamage(eng, ally, 40, s, false)
    know(eng, 'hunters-vigil')
    expect(combatDamage(eng, ally, 40, s, false)).toBeLessThan(taken)
    // far from the caster, nothing shared
    eng.author(() => eng.teleport(ally, { map: 'arena', x: x + 10, y }))
    expect(combatStrike(w, ally, s, 100, 1, undefined, false).power).toBeCloseTo(plain, 5)
  })

  it('a beast called fights for the caster (its companion, of the caster\'s side), and a Sic sends it at the foe ahead', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    know(eng, 'call-the-hound')
    expect(cast(eng, 0)).toBe(true)
    const hound = w.entitiesOnMap('arena').find((e) => e.type === SUMMONS.hound)!
    expect(hound.props?.companion).toBe(p.id)
    expect(eng.hostileTo(hound, p)).toBe(false)
    const s = slime(eng, x + 3, y)
    expect(eng.hostileTo(hound, s) || eng.hostileTo(s, hound)).toBe(true)
    know(eng, 'sic')
    expect(cast(eng, 0)).toBe(true)
    expect(lost(eng, s)).toBeGreaterThan(0)
    // its while out, it goes
    for (let i = 0; i < 420; i++) eng.tick()
    expect(w.get(hound.id)).toBeUndefined()
  })

  it('a mark makes its foe take more; a ward takes harm first; Time Warp halves the others\' rest; Ascendance builds with casts', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    const s = slime(eng, x + 3, y)
    const plain = combatStrike(w, p, s, 100, 1, undefined, false).power
    know(eng, 'death-mark')
    expect(cast(eng, 0)).toBe(true)
    expect(combatStrike(w, p, s, 100, 1, undefined, false).power).toBeCloseTo(plain * 1.3, 5)
    know(eng, 'mana-ward')
    expect(cast(eng, 0)).toBe(true)
    const hp = w.num(p, 'hp')
    expect(combatDamage(eng, p, 2, s, false)).toBe(0)
    expect(w.num(p, 'hp')).toBe(hp)
    know(eng, 'time-warp')
    eng.setCooldown(`skill:death-mark:${p.id}`, 100)
    expect(cast(eng, 0)).toBe(true)
    expect(eng.cooldown(`skill:death-mark:${p.id}`) - w.state.tick).toBe(50)
    // the passive cooldown share of a path: Lantern Soul at night
    know(eng, 'lantern-soul')
    eng.author(() => (w.isNight = () => true))
    expect(effectiveActive(eng, p, SKILL_BY_ID.blizzard).cooldown).toBeLessThan(SKILL_BY_ID.blizzard.active!.cooldown)
  })
})
