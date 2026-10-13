// The wayside shrines (content/src/pilgrimage.ts): a shrine takes what its suffering asks, is lit by it, and the
// offering is used up — but it will not take what is not the bearer's to give away: the tags a merchant will not
// buy either (social.ts `buys`). Without that, a quest item merely tagged `metal` — the ninth nail — could be fed
// to the Nails shrine and the errand it belongs to left uncompletable, with nothing said.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, type Engine } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** The Nails shrine on grass, the player beside it with one thing in hand. Strict: state changes only in outcomes. */
function shrine(offering: string, tags: string[] = []): Engine {
  const row = ['grass', 'grass', 'grass']
  return buildSandbox(
    {
      terrain: Array.from({ length: 3 }, () => [...row]),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 1 },
        { key: 'shrine', type: 'fixture/sacred/wayshrine/nails', x: 1, y: 1 },
        { key: 'gift', type: offering, x: 0, y: 1, heldBy: 'actor', tags },
      ],
      event: {},
    },
    onto,
    lib(),
  )
}

const lit = (eng: Engine) => eng.world.hasStatus({ e: 'shrine' }, 'lit')
/** Lay what is held on the shrine; what the events of it reached. */
const offered = (eng: Engine) => {
  eng.trace = []
  eng.act('put', 'actor', { e: 'shrine' })
}
/** Anything that reached an undefined outcome (the AI's place to answer): empty when a rule answered. */
const holes = (eng: Engine) => eng.trace.filter((t) => !t.defined).map((t) => `${t.ev.kind} ${t.rule}`)

describe('a wayside shrine', () => {
  it('takes what its suffering asks: the offering is used up, the shrine is lit, the story keeps it', () => {
    const eng = shrine('item/misc/bell')
    expect(eng.world.hasTag(eng.world.get('gift')!, 'metal'), 'a bell is what the Nails shrine asks for').toBe(true)
    offered(eng)
    expect(lit(eng)).toBe(true)
    expect(eng.world.get('gift'), 'the offering is gone').toBeUndefined()
    expect(eng.world.fact('ch1.shrines.nails')).toBe(1)
    expect(holes(eng)).toEqual([])
  })

  it('will not take the ninth nail: it is not the bearer\'s to give away', () => {
    const eng = shrine('item/misc/ninth_nail')
    const nail = eng.world.get('gift')!
    expect(eng.world.hasTag(nail, 'metal'), 'the nail is what the Nails shrine asks for').toBe(true)
    expect(eng.world.hasTag(nail, 'important'), 'and it is not for giving away').toBe(true)
    offered(eng)
    expect(lit(eng), 'nothing kindles').toBe(false)
    expect(eng.world.get('gift'), 'the nail is still in hand').toBe(nail)
    expect(eng.world.fact('ch1.shrines.nails')).toBeUndefined()
    // the refusal is a rule's answer, not a hole for the world to learn
    expect(holes(eng)).toEqual([])
  })

  it('will not take what an under-way quest keeps: a favour\'s stolen thing', () => {
    // the very same bell as the first case, one tag different: what a quest alias with `keep` carries
    // (quests.ts tagsOf) — a favour is a thing a thief took, and any of it that is not edible may be metal.
    const eng = shrine('item/misc/bell', ['quest-item'])
    const bell = eng.world.get('gift')!
    expect(eng.world.hasTag(bell, 'metal'), 'the bell is what the Nails shrine asks for').toBe(true)
    expect(eng.world.hasTag(bell, 'quest-item'), 'and a quest keeps it').toBe(true)
    offered(eng)
    expect(lit(eng), 'nothing kindles').toBe(false)
    expect(eng.world.get('gift'), 'the bell is still in hand').toBe(bell)
    expect(holes(eng)).toEqual([])
  })

  it('says what it asks when given what it does not want', () => {
    const eng = shrine('item/food/bread')
    offered(eng)
    expect(lit(eng)).toBe(false)
    expect(eng.world.get('gift'), 'the bread is not taken either').toBeDefined()
    expect(holes(eng)).toEqual([])
  })
})
