// The story's news is its own: the topics it raises when they happen (the crown, the slain dragon)
// may not be raised by a patch, or people would speak of them before they happened. A patch raises
// topics of its own (design.md §5, legibility).

import { describe, expect, it } from 'vitest'
import { RuleLibrary, storyTopics, validatePatch, type Effect, type Patch } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

const { index } = buildFord()
const onto = buildOntology()

/** A feather used on anything raises a topic, by a notice to the story or (hosted by the story) itself. */
const patch = (effect: Effect, host = { type: 'item/material/feather' }, on = 'act/use'): Patch => ({
  artifacts: [{ kind: 'rule', rule: { id: 'patch/test-topic', doc: 'A test.', host, on, tree: { do: [{ op: 'say', text: { en: 'News!', zh: '新闻！' } }, effect] }, source: { origin: 'patch' } } as never }],
})
const notify = (value: string): Effect => ({ op: 'emit', impulse: 'notify', to: 'story', params: { what: 'topic', value } })
const check = (p: Patch, world = false) => validatePatch(p, { ontology: onto, library: new RuleLibrary([...BASE_RULES, ...STORY_RULES]), protectedFacts: index.protectedFacts, world }).errors

describe("the story's topics", () => {
  it('are collected from its steps and its own rules, and protected in the world', () => {
    const topics = storyTopics(index.steps ?? [], STORY_RULES)
    expect(topics).toEqual(expect.arrayContaining(['crossed', 'crown', 'dragon_slain', 'flame_stolen', 'winch_mended', 'tree_felled']))
    // a witness's "that is mine" is anyone's news, not the story's
    expect(topics).not.toContain('theft')
    for (const t of topics) expect(index.protectedFacts).toContain(`topic.${t}`)
  })

  it("a patch may not raise one, by a notice or as the story's own effect, for the player or the world", () => {
    for (const world of [false, true]) {
      expect(check(patch(notify('dragon_slain')), world).join('\n')).toMatch(/raises the topic "dragon_slain" itself/)
      expect(check(patch({ op: 'topic', id: 'crown' }, { type: 'resident/story' }, 'impulse/notify'), world).join('\n')).toMatch(/raises the topic "crown" itself/)
    }
  })

  it('a topic of its own is news a patch may raise, a near name included', () => {
    expect(check(patch(notify('feather_rumour'))).filter((e) => e.includes('raises the topic'))).toEqual([])
    expect(check(patch(notify('crown_polished'))).filter((e) => e.includes('raises the topic'))).toEqual([])
    expect(check(patch(notify('theft'))).filter((e) => e.includes('raises the topic'))).toEqual([])
  })
})
