// The active skills and the skill bar (engine/src/actives.ts, docs/skill-tree.md): a learned active skill goes in
// the bar's first empty slot; one is cast from its slot, does what it says, and rests for its cooldown; another
// profession's skill is not cast. Every one of the twenty does what it says on a field of slimes.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, castLeft, knownActives, combatDamage, combatDelay, combatStrike, snapshot, textOf, type Engine, type Entity, type MapData } from '@lsw/engine'
import { ACTIVE_SKILLS, BASE_RULES, PROLOGUE_DONE, SKILLS, SKILL_BY_ID, STORY_RULES, buildOntology, decodeChunk, skillBook } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

/** An open field of grass (an arena, as the boss tests have), the player in its middle facing right, every skill known to the engine. */
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
    ;(w.player.props ??= {}).prologue = PROLOGUE_DONE
    w.setFact('seen.arrival', true)
    eng.teleport(w.player, { map: 'arena', x, y })
  })
  w.player.facing = 'right'
  eng.controls.sync()
  return { eng, p: w.player, x, y }
}

/** The player knows a skill (and its profession, if it has one), and it sits in the bar's first slot. */
function know(eng: Engine, id: string): void {
  const w = eng.world
  const def = SKILL_BY_ID[id]
  eng.author(() => {
    if (def.profession) w.setProp(w.player, 'profession', def.profession)
    w.addTag(w.player, `skill:${id}`)
  })
  expect(eng.controls.setSkill(0, id)).toBe(true)
}

const slime = (eng: Engine, x: number, y: number) => eng.author(() => eng.world.create('actor/creature/slime/green_slime', { on: 'tile', map: 'arena', x, y }, { props: { hp: 200, maxHp: 200 } }))
const hurt = (eng: Engine, e: Entity) => eng.world.num(e, 'hp') < 200

describe('the skill bar', () => {
  it('a learned active skill goes in the first empty slot; slots swap; an unlearned or passive skill is not set', () => {
    const { eng, p } = field()
    eng.author(() => eng.world.setProp(p, 'skillPoints', 10))
    expect(eng.controls.learn(SKILL_BY_ID['light-footed'])).toBe(true)
    expect(eng.controls.skillbar()).toEqual([null, null, null, null, null, null])
    expect(eng.controls.learn(SKILL_BY_ID['gale-step'])).toBe(true)
    expect(eng.controls.skillbar()[0]).toBe('gale-step')
    expect(eng.controls.learn(SKILL_BY_ID.strength)).toBe(true)
    expect(eng.controls.learn(SKILL_BY_ID.cleave)).toBe(true)
    expect(eng.controls.skillbar().slice(0, 2)).toEqual(['gale-step', 'cleave'])
    // moved to another slot: what was there takes its place
    expect(eng.controls.setSkill(1, 'gale-step')).toBe(true)
    expect(eng.controls.skillbar().slice(0, 2)).toEqual(['cleave', 'gale-step'])
    expect(eng.controls.setSkill(5, 'whirlwind')).toBe(false)
    expect(eng.controls.setSkill(5, 'strength')).toBe(false)
    expect(eng.controls.setSkill(0, null)).toBe(true)
    expect(eng.controls.skillbar()[0]).toBeNull()
  })

  it('a cast rests for its cooldown (shown in the frame), and another profession\'s skill is not cast', () => {
    const { eng, p, x, y } = field()
    know(eng, 'whirlwind')
    const s = slime(eng, x + 1, y)
    expect(eng.controls.cast(0)).toBe(true)
    expect(hurt(eng, s)).toBe(true)
    expect(castLeft(eng, p, 'whirlwind')).toBe(SKILL_BY_ID.whirlwind.active!.cooldown)
    expect(snapshot(eng).player.skillbar[0]).toEqual({ id: 'whirlwind', left: 80, cooldown: 80, usable: true })
    // resting: not cast again
    const hp = eng.world.num(s, 'hp')
    expect(eng.controls.cast(0)).toBe(false)
    expect(eng.world.num(s, 'hp')).toBe(hp)
    for (let i = 0; i < 80; i++) eng.tick()
    expect(castLeft(eng, p, 'whirlwind')).toBe(0)
    // a warrior's skill, the player now a mage: not cast
    know(eng, 'shield-bash')
    eng.author(() => eng.world.setProp(p, 'profession', 'mage'))
    expect(eng.controls.cast(0)).toBe(false)
  })
})

describe('each active skill does what it says', () => {
  /** What each does, on slimes set round the player (who stands at x, y facing right). */
  const CASES: Record<string, (eng: Engine, p: Entity, x: number, y: number) => () => void> = {
    whirlwind: (eng, _p, x, y) => {
      const ring = [slime(eng, x + 1, y), slime(eng, x - 1, y + 1), slime(eng, x, y - 1)]
      return () => expect(ring.every((s) => hurt(eng, s))).toBe(true)
    },
    cleave: (eng, _p, x, y) => {
      const s = slime(eng, x + 1, y)
      return () => expect(200 - eng.world.num(s, 'hp')).toBeGreaterThanOrEqual(2)
    },
    'gale-step': (eng, p) => () => expect(p.combat?.hasteUntil).toBeGreaterThan(eng.world.state.tick),
    mend: (eng, p) => {
      eng.author(() => eng.world.setProp(p, 'hp', 1))
      return () => expect(eng.world.num(p, 'hp')).toBeGreaterThan(1)
    },
    'shadow-strike': (eng, p, x, y) => {
      const s = slime(eng, x + 3, y)
      s.facing = 'left'
      return () => {
        expect(hurt(eng, s)).toBe(true)
        // behind it: the side it does not face
        expect(eng.world.posOf(p)).toMatchObject({ x: x + 4, y })
      }
    },
    envenom: (eng, p) => () => expect(p.combat?.envenomHits).toBe(5),
    'smoke-bomb': (eng, p) => () => expect(p.combat?.veilUntil).toBeGreaterThan(eng.world.state.tick),
    flurry: (eng, _p, x, y) => {
      const s = slime(eng, x + 1, y)
      return () => expect(200 - eng.world.num(s, 'hp')).toBeGreaterThanOrEqual(4)
    },
    'shield-bash': (eng, _p, x, y) => {
      const s = slime(eng, x + 1, y)
      return () => expect([hurt(eng, s), eng.world.hasStatus({ e: s.id }, 'stunned')]).toEqual([true, true])
    },
    charge: (eng, p, x, y) => {
      const s = slime(eng, x + 3, y)
      return () => expect([hurt(eng, s), eng.world.posOf(p)?.x]).toEqual([true, x + 2])
    },
    'war-cry': (eng, p) => () => expect(p.combat?.rallyUntil).toBeGreaterThan(eng.world.state.tick),
    earthsplitter: (eng, _p, x, y) => {
      const hit = [slime(eng, x + 2, y), slime(eng, x + 3, y + 1)]
      return () => expect(hit.every((s) => hurt(eng, s))).toBe(true)
    },
    multishot: (eng, _p, x, y) => {
      const lines = [slime(eng, x + 3, y), slime(eng, x + 3, y + 1), slime(eng, x + 2, y - 1)]
      return () => expect(lines.every((s) => hurt(eng, s))).toBe(true)
    },
    'leap-shot': (eng, p, x, y) => {
      const s = slime(eng, x + 3, y)
      return () => expect([hurt(eng, s), eng.world.posOf(p)?.x, p.facing]).toEqual([true, x - 2, 'right'])
    },
    'piercing-arrow': (eng, _p, x, y) => {
      const row = [slime(eng, x + 1, y), slime(eng, x + 2, y), slime(eng, x + 3, y)]
      return () => expect(row.every((s) => hurt(eng, s))).toBe(true)
    },
    'arrow-rain': (eng, _p, x, y) => {
      const s = slime(eng, x + 3, y)
      const t = slime(eng, x + 3, y + 1)
      return () => {
        for (let i = 0; i < 25; i++) eng.tick()
        expect([hurt(eng, s), hurt(eng, t)]).toEqual([true, true])
      }
    },
    fireball: (eng, _p, x, y) => {
      const s = slime(eng, x + 3, y)
      const t = slime(eng, x + 4, y + 1)
      return () => expect([hurt(eng, s), hurt(eng, t)]).toEqual([true, true])
    },
    'frost-nova': (eng, _p, x, y) => {
      const s = slime(eng, x + 2, y)
      return () => expect([hurt(eng, s), eng.world.hasStatus({ e: s.id }, 'frozen')]).toEqual([true, true])
    },
    'chain-lightning': (eng, _p, x, y) => {
      const chain = [slime(eng, x + 2, y), slime(eng, x + 3, y + 2), slime(eng, x + 4, y + 4)]
      return () => expect(chain.every((s) => hurt(eng, s))).toBe(true)
    },
    blink: (eng, p, x, y) => {
      slime(eng, x + 2, y)
      return () => expect(eng.world.posOf(p)).toMatchObject({ x: x + 4, y })
    },
  }

  it('there is a case for every one of the twenty', () => {
    expect(ACTIVE_SKILLS.map((s) => s.id).sort()).toEqual(Object.keys(CASES).sort())
  })

  for (const def of ACTIVE_SKILLS)
    it(`${def.id} (${textOf(def.name, 'zh')})`, () => {
      const { eng, p, x, y } = field()
      // a weapon that reaches: a bow for the ranger, a staff for the mage; else the bare hand
      if (def.profession === 'ranger' || def.profession === 'mage')
        eng.author(() => eng.world.create(def.profession === 'ranger' ? 'item/weapon/ranged/bow' : 'item/weapon/magic/staff', { on: 'hand', holder: p.id }, { props: { power: 3, range: 6 } }))
      know(eng, def.id)
      const check = CASES[def.id](eng, p, x, y)
      expect(eng.controls.cast(0), def.id).toBe(true)
      eng.tick()
      check()
      expect(castLeft(eng, p, def.id)).toBeGreaterThan(0)
    })
})

describe('what the buffs do in a fight', () => {
  it('Gale Step quickens the step, a War Cry guards and strengthens, a Smoke Bomb hides one, Envenom makes blows bleed', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    const s = slime(eng, x + 1, y)
    const step = combatDelay(w, p, 100, 'move')
    know(eng, 'gale-step')
    eng.controls.cast(0)
    expect(combatDelay(w, p, 100, 'move')).toBeLessThan(step)
    // a War Cry: blows taken lighter, blows dealt heavier
    const taken = eng.author(() => combatDamage(eng, p, 10, s, false))
    const dealt = combatStrike(w, p, s, 10, 1, undefined, false).power
    know(eng, 'war-cry')
    eng.controls.cast(0)
    expect(eng.author(() => combatDamage(eng, p, 10, s, false))).toBeLessThan(taken)
    expect(combatStrike(w, p, s, 10, 1, undefined, false).power).toBeGreaterThan(dealt)
    // Envenom: the next blows open a bleed, five of them
    know(eng, 'envenom')
    eng.controls.cast(0)
    expect(combatStrike(w, p, s, 10, 1, undefined, false).bleed).toBeGreaterThan(0)
    expect(p.combat?.envenomHits).toBe(4)
    // a Smoke Bomb: the slime, hostile and beside one, does not come at one
    eng.author(() => w.setProp(p, 'hp', 50))
    s.ai = { behaviour: 'melee', temper: 'aggressive', sight: 5, home: { map: 'arena', x: x + 1, y } }
    know(eng, 'smoke-bomb')
    eng.controls.cast(0)
    const hp = w.num(p, 'hp')
    for (let i = 0; i < 25; i++) eng.tick()
    expect(w.num(p, 'hp')).toBe(hp)
  })
})

describe('where active skills come from: the tree, a book, what one wears', () => {
  it('a skill book read (used on oneself) teaches its skill with no points, and is used up; one known, or another profession\'s, is not read', () => {
    const { eng, p } = field()
    const w = eng.world
    const give = (id: string) => eng.author(() => w.create('item/document/skillbook', { on: 'inside', holder: p.id }, skillBook(id)))
    const book = give('whirlwind')
    expect(w.num(p, 'skillPoints')).toBe(0)
    eng.act('use', p.id, { e: p.id }, { instrument: { e: book.id } })
    eng.tick()
    expect(knownActives(eng, p)).toEqual([{ id: 'whirlwind', source: 'book' }])
    expect(w.get(book.id)).toBeUndefined()
    expect(snapshot(eng).player.actives).toEqual([{ id: 'whirlwind', source: 'book' }])
    // known already: the second copy stays
    const again = give('whirlwind')
    eng.act('use', p.id, { e: p.id }, { instrument: { e: again.id } })
    eng.tick()
    expect(w.get(again.id)).toBeDefined()
    // a mage's book, the player no mage: not read
    const fire = give('fireball')
    eng.act('use', p.id, { e: p.id }, { instrument: { e: fire.id } })
    eng.tick()
    expect([w.get(fire.id) !== undefined, knownActives(eng, p).some((k) => k.id === 'fireball')]).toEqual([true, false])
    // what a book taught is cast like any other
    expect(eng.controls.setSkill(2, 'whirlwind')).toBe(true)
    expect(eng.controls.cast(2)).toBe(true)
  })

  it('a piece that lends a skill gives it while worn, whatever one\'s profession; taken off, the slot keeps it but it is not had', () => {
    const { eng, p, x, y } = field()
    const w = eng.world
    const helm = eng.author(() => w.create('item/armor/helmet', { on: 'inside', holder: p.id }, { props: { skill: 'fireball' } }))
    eng.controls.sync()
    expect(eng.controls.setSkill(0, 'fireball')).toBe(false)
    eng.controls.wear(helm.id, true)
    expect(knownActives(eng, p)).toEqual([{ id: 'fireball', source: 'gear', item: helm.id }])
    expect(eng.controls.setSkill(0, 'fireball')).toBe(true)
    const s = slime(eng, x + 3, y)
    expect(eng.controls.cast(0)).toBe(true)
    expect(hurt(eng, s)).toBe(true)
    // taken off: still in the slot, shown as not had, and not cast
    eng.controls.wear(helm.id)
    for (let i = 0; i < 70; i++) eng.tick()
    expect(snapshot(eng).player.skillbar[0]).toMatchObject({ id: 'fireball', usable: false })
    expect(eng.controls.cast(0)).toBe(false)
  })
})
