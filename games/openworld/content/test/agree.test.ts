// Lines are written about anyone, and a name slot reads "you" when it is the player: what follows
// agrees with it ("Suds and a splash: {actor} comes up clean" must not read "you comes").

import { describe, expect, it } from 'vitest'
import { RuleLibrary, agreeYou, buildSandbox, textOf, type Rule } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const Y = '\u0001you\u0002'

describe('a line about the player', () => {
  it('agrees with "you": the verb after it, the possessive, a sentence it opens', () => {
    expect(agreeYou(`Suds and a splash: ${Y} comes up clean.`)).toBe('Suds and a splash: you come up clean.')
    // (only the verb right after it: a second one joined by "and" is the line's to avoid, as the ModSpec asks)
    expect(agreeYou(`${Y} is soaked. ${Y} carries the scar; ${Y} goes on.`)).toBe('You are soaked. You carry the scar; you go on.')
    expect(agreeYou(`${Y}'s hands are warm.`)).toBe('Your hands are warm.')
    expect(agreeYou(`A warm glow mends ${Y}.`)).toBe('A warm glow mends you.')
    // no verb after it: left as it is
    expect(agreeYou(`Nothing for ${Y} across the river; ${Y} always know.`)).toBe('Nothing for you across the river; you always know.')
    // the verbs that end oddly
    expect(agreeYou(`${Y} dies. ${Y} lies down; ${Y} freezes, ${Y} dozes, ${Y} aches.`)).toBe('You die. You lie down; you freeze, you doze, you ache.')
    // "you" that is no subject: what follows is not its verb (a review found "hands you thi map")
    expect(agreeYou(`He hands ${Y} this map, gives ${Y} his word and tells ${Y} stories.`)).toBe('He hands you this map, gives you his word and tells you stories.')
    expect(agreeYou(`Beside ${Y} lies a stone.`)).toBe('Beside you lies a stone.')
    // the curly possessive, and a line that opens with a quote
    expect(agreeYou(`${Y}\u2019s cloak.`)).toBe('Your cloak.')
    expect(agreeYou(`"${Y} is late," she says.`)).toBe('"You are late," she says.')
    // the negatives and the -oes verbs
    expect(agreeYou(`${Y} doesn't move. ${Y} isn't hurt; ${Y} wasn\u2019t seen, and ${Y} hasn't a scratch. ${Y} echoes it.`)).toBe("You don't move. You aren't hurt; you weren\u2019t seen, and you haven't a scratch. You echo it.")
    expect(agreeYou(`${Y} tiptoes past; ${Y} vetoes it.`)).toBe('You tiptoe past; you veto it.')
    // nothing marked: nothing touched ("the slime comes" is about someone else)
    expect(agreeYou('The slime comes closer.')).toBe('The slime comes closer.')
  })

  it('reads right in the log of an outcome, and about anyone else as written', () => {
    const rule: Rule = { id: 'test/wash', host: { type: 'item/misc/soap' }, on: 'act/use', doc: 'd', tree: { do: [{ op: 'log', text: { en: 'Suds and a splash: {target} comes up clean.', zh: '{target}洗得干干净净。' } }] }, source: { origin: 'base' } }
    const run = (on: 'actor' | 'npc') => {
      const eng = buildSandbox({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'npc', type: 'actor/person/herbalist', x: 3, y: 2 }, { key: 'soap', type: 'item/misc/soap', x: 2, y: 2, heldBy: 'actor' }], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, rule]))
      eng.act('use', 'actor', { e: on }, { instrument: { e: 'soap' } })
      const log = eng.world.fx.find((f) => f.t === 'log' && textOf(f.text).startsWith('Suds'))
      return log && log.t === 'log' ? [textOf(log.text), textOf(log.text, 'zh')] : undefined
    }
    expect(run('actor')).toEqual(['Suds and a splash: you come up clean.', '你洗得干干净净。'])
    // about another, as written
    expect(run('npc')?.[0]).toMatch(/^Suds and a splash: (?!you).+ comes up clean\.$/)
  })
})
