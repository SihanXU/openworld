// The quest system (docs/quests.md) on the real Ford: what the demo's requirements do not reach — a quest that makes
// what it is about and keeps it, protects the people it names while it runs and fails when one of them dies, the
// journal's tracking and markers, the Story Manager's caps, the step conditions on quests, and the validator's word
// that no patch hosts a quest.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, tickAt, validatePatch, type Engine, type QuestDef } from '@lsw/engine'
import { BASE_RULES, CH1, QUESTS, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const L = (en: string, zh: string) => ({ en, zh })

/** A quest of the test's own: Cass's errand — a letter made in the player's bag, to carry to Gus; Cass may not die meanwhile. */
const ERRAND: QuestDef = {
  id: 't_letter',
  kind: 'side',
  title: L('A Test Letter', '测试信'),
  summary: L('{cass} wants {letter} carried to {gus}.', '{cass}想把{letter}捎给{gus}。'),
  aliases: {
    cass: { id: 'npc.cass', essential: true },
    gus: { id: 'npc.gus' },
    tam: { id: 'npc.tam' },
    letter: { make: { type: 'item/document/letter', in: 'player', name: L("Cass's letter", '卡丝的信') }, keep: true },
  },
  objectives: [
    { id: 'carry', text: L('The letter to {gus}', '把信交给{gus}'), target: 'gus', on: { give: 'letter', to: 'gus' } },
    { id: 'tam', text: L('Tell {tam}', '告诉{tam}'), target: 'tam', talk: true, optional: true, on: { talk: 'tam' }, say: L('Noted.', '知道了。') },
  ],
  stages: [
    { n: 10, show: ['carry', 'tam'], log: L('Cass gave me a letter.', '卡丝给了我一封信。') },
    { n: 100, on: { objectives: ['carry'] }, complete: true, log: L('Delivered.', '送到了。') },
    { n: 200, on: { gone: 'cass' }, failed: true, log: L('Cass is gone.', '卡丝不在了。') },
    { n: 210, on: { gone: 'tam' }, failed: true, log: L('Tam is gone.', '塔姆不在了。') },
  ],
  start: { manual: true },
}

function world(extra: QuestDef[] = []): { game: Game; eng: Engine } {
  const { index, chunks } = buildFord()
  index.quests = [...QUESTS, ...extra]
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  game.mods.provider = undefined
  const eng = game.engine
  eng.author(() => {
    eng.quests.put('descent', 'done')
    eng.world.setFact('seen.arrival', true)
    eng.world.setFact('seen.village_arrival', true)
    eng.teleport(eng.world.player, { map: 'meadow', x: 20, y: 12 })
  })
  eng.world.state.tick = tickAt(1, 12)
  eng.npcs.begin('meadow')
  return { game, eng }
}
const ticks = (eng: Engine, n: number) => {
  for (let i = 0; i < n; i++) {
    if (eng.world.scene) eng.story.advance()
    eng.tick()
  }
}
/** The story begins a quest (as a rule of its would): its outcome. */
const begin = (eng: Engine, id: string) => eng.script([{ op: 'startQuest', id }], { actor: { e: 'player' } }, 'test')

describe('a quest makes what it is about, and keeps the people it names', () => {
  it('makes the letter in the bag, a quest item; Cass essential while it runs, mortal again once it is over', () => {
    const { eng } = world([ERRAND])
    const w = eng.world
    const cass = w.get('npc.cass')!
    expect(w.hasTag(cass, 'essential')).toBe(false)
    begin(eng, 't_letter')
    ticks(eng, 2)
    const q = w.get('quest.t_letter')!
    expect(eng.quests.stateOf(q)).toBe('active')
    const letter = w.get(String(q.props?.['alias.letter']))!
    expect(letter.place).toMatchObject({ holder: 'player' })
    expect(JSON.stringify(letter.name)).toContain('卡丝的信')
    expect(w.hasTag(letter, 'quest-item')).toBe(true)
    expect(eng.social.buys(w.get('npc.tobin')!, letter, w.player)).toBe(false)
    expect(w.hasTag(cass, 'essential')).toBe(true)
    // the journal names the aliases in its words
    const j = eng.quests.journal().find((x) => x.id === q.id)!
    expect(JSON.stringify(j.summary)).toContain('格斯')
    // handed to Gus (G): delivered; Cass mortal again
    const gus = w.get('npc.gus')!
    eng.author(() => { w.place(gus, { on: 'tile', map: 'meadow', x: 20, y: 13 }); w.player.facing = 'down' })
    eng.controls.sync()
    eng.controls.select(w.player.slots!.indexOf(eng.controls.key(letter)))
    eng.act('put', 'player', { e: gus.id }, { instrument: { e: letter.id } })
    ticks(eng, 3)
    expect(eng.quests.stateOf(q)).toBe('done')
    expect(w.hasTag(cass, 'essential')).toBe(false)
  })

  it('protects the people it names: Cass brought to nothing goes down instead of dying', () => {
    const { eng } = world([ERRAND])
    const w = eng.world
    begin(eng, 't_letter')
    ticks(eng, 2)
    const cass = w.get('npc.cass')!
    eng.author(() => w.place(cass, { on: 'tile', map: 'meadow', x: 22, y: 12 }))
    eng.damage(cass, 999, undefined, true, { e: 'player' })
    ticks(eng, 3)
    expect(w.get('npc.cass')?.npc).toBeDefined()
    expect(w.hasStatus({ e: 'npc.cass' }, 'down')).toBe(true)
  })

  it('fails when someone it names (and does not protect) dies: its log says why', () => {
    const { eng } = world([ERRAND])
    const w = eng.world
    begin(eng, 't_letter')
    ticks(eng, 2)
    const tam = w.get('npc.tam')!
    expect(w.hasTag(tam, 'essential')).toBe(false)
    eng.author(() => w.place(tam, { on: 'tile', map: 'meadow', x: 22, y: 12 }))
    eng.damage(tam, 999, undefined, true, { e: 'player' })
    ticks(eng, 3)
    expect(w.get('npc.tam')?.npc).toBeUndefined()
    const q = w.get('quest.t_letter')!
    expect(eng.quests.stateOf(q)).toBe('failed')
    expect(JSON.stringify(eng.quests.journal().find((x) => x.id === q.id)!.log.at(-1)!.text)).toContain('塔姆不在了')
  })
})

describe('the journal follows one quest', () => {
  it('points at a named area of a map not loaded here (the barrow mouth, from the village), not at the map\'s middle', () => {
    const { eng } = world()
    ticks(eng, 5)
    // as the client keeps them: only the map one stands on
    for (const id of Object.keys(eng.world.state.maps)) if (id !== 'meadow') delete eng.world.state.maps[id]
    const mouth = eng.quests.targets().find((t) => t.objective === 'mouth')!
    expect(mouth.map).toBe('hollow')
    // the hollow's `mouth` area: [22, 22, 11, 6]
    expect(mouth.x >= 22 && mouth.x < 33 && mouth.y >= 22 && mouth.y < 28, `${mouth.x},${mouth.y}`).toBe(true)
  })

  it('tracks the latest main quest by default, the one chosen after; the markers and the companion follow it', () => {
    const { eng } = world([ERRAND])
    const w = eng.world
    ticks(eng, 5)
    expect(eng.quests.tracked()?.id).toBe('quest.rescue')
    expect(eng.quests.targets().every((t) => ['hollow', 'barrow', 'ossuary', 'sanctum'].includes(t.map))).toBe(true)
    begin(eng, 't_letter')
    ticks(eng, 2)
    // a side quest begun does not take the place of the main one
    expect(eng.quests.tracked()?.id).toBe('quest.rescue')
    eng.controls.track('quest.t_letter')
    expect(eng.quests.tracked()?.id).toBe('quest.t_letter')
    expect(eng.quests.targets().map((t) => t.objective).sort()).toEqual(['carry', 'tam'])
    expect(JSON.stringify(eng.story.objective())).toContain('测试信')
    // a talk objective: '?' over the one to speak to; spoken to, they say their line and it is done
    expect(eng.quests.mark('npc.tam')).toBe('?')
    const tam = w.get('npc.tam')!
    eng.author(() => w.place(tam, { on: 'tile', map: 'meadow', x: 20, y: 11 }))
    w.fx.length = 0
    eng.interact('interact', 'player', { e: tam.id }, { instrument: null })
    ticks(eng, 2)
    expect(w.fx.some((x) => x.t === 'say' && x.who === tam.id && JSON.stringify(x.text).includes('知道了'))).toBe(true)
    expect(eng.quests.done('t_letter.tam')).toBe(true)
    // untracked: back to the main line
    eng.controls.track(undefined)
    expect(eng.quests.tracked()?.id).toBe('quest.rescue')
  })
})

describe('the Story Manager', () => {
  it('makes one offer for one thing (two hungry pieces of news about Vigo are one favour), and no more than its cap', () => {
    const { eng } = world()
    const q = eng.quests
    for (let i = 0; i < 3; i++) q.news({ kind: 'hungry', target: 'npc.vigo' })
    ticks(eng, 2)
    expect(q.of('meal').length).toBe(1)
    for (const id of ['npc.tam', 'npc.cass']) q.news({ kind: 'hungry', target: id })
    ticks(eng, 2)
    // `most: 2` at once
    expect(q.of('meal').filter((x) => q.stateOf(x) === 'offered').length).toBe(2)
  })

  it('steps of the story wait on quests: a stage, an objective done', () => {
    const { eng } = world()
    const w = eng.world
    expect(eng.story.met({ quest: { first_seal: { gte: 30 } } })).toBe(false)
    eng.author(() => eng.quests.put('first_seal', 30))
    expect(eng.story.met({ quest: { first_seal: { gte: 30 } } })).toBe(true)
    expect(eng.story.met({ objectives: ['rescue.warden'] })).toBe(false)
    eng.author(() => (eng.quests.put('rescue', 10), w.setProp(w.get('quest.rescue')!, 'count.warden', 1)))
    expect(eng.story.met({ objectives: ['rescue.warden'] })).toBe(true)
  })
})

describe('the main line when the road runs ahead of it', () => {
  it('the vigil, all of it brought as the knight falls, still pays; the First Seal keeps its steps in order', () => {
    const { eng } = world()
    const w = eng.world
    const q = eng.quests
    eng.author(() => {
      q.put('rescue', 'done')
      q.put('vigil', 10)
      q.put('first_seal', 10)
      for (let i = 0; i < 2; i++) w.create('item/vessel/flask/oil', { on: 'inside', holder: 'player' })
      for (let i = 0; i < 3; i++) w.create('item/material/herb', { on: 'inside', holder: 'player' })
      w.setFact('seen.chapel_bell', true)
      // across the river before the night of thanks
      w.setFact('ford.crossed', 1)
    })
    ticks(eng, 3)
    // the First Seal waits for the night of thanks and the letter before it counts the river
    expect(w.num(w.get('quest.first_seal')!, 'stage')).toBe(10)
    eng.author(() => w.setFact(CH1.flameStolen, 1))
    ticks(eng, 2)
    expect(w.num(w.get('quest.first_seal')!, 'stage')).toBe(20)
    eng.author(() => w.setFact(CH1.letter, 1))
    ticks(eng, 2)
    expect(w.num(w.get('quest.first_seal')!, 'stage')).toBe(40)
    const log = q.journal().find((j) => j.id === 'quest.first_seal')!.log.map((l) => JSON.stringify(l.text))
    expect(log.some((l) => l.includes('朝圣令'))).toBe(true)
    // the knight falls with the vigil still open, all three brought: paid, the oil and dawnbloom taken
    eng.author(() => w.setFact(CH1.knight, 1))
    ticks(eng, 3)
    const vigil = w.get('quest.vigil')!
    expect(q.stateOf(vigil)).toBe('done')
    expect(w.num(vigil, 'stage')).toBe(105)
    expect(eng.controls.count('item/vessel/flask/oil')).toBe(0)
    expect(eng.controls.count('item/clothing/cloak')).toBe(1)
  })
})

describe('a quest is the content\'s', () => {
  it('no patch hosts a rule on one, nor uses its primitives elsewhere', () => {
    const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])
    const host = validatePatch({ artifacts: [{ kind: 'rule', rule: { id: 'p/q', host: { type: 'resident/quest' }, on: 'impulse/notify', tree: { do: [{ op: 'stage', n: 100 }] }, source: { origin: 'patch' } } }] }, { ontology: onto, library: lib })
    expect(host.errors.join('\n')).toContain('a quest is the content')
    const use = validatePatch({ artifacts: [{ kind: 'rule', rule: { id: 'p/s', host: { type: 'actor/person' }, on: 'impulse/notify', tree: { do: [{ op: 'startQuest', id: 'meal' }] }, source: { origin: 'patch' } } }] }, { ontology: onto, library: lib })
    expect(use.errors.join('\n')).toContain("startQuest is the story's and the world's only")
  })
})
