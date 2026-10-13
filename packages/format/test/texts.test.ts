// A game's words and their translations (src/texts.ts, docs/engine-split.md §19): where a file holds words, read
// from the schemas; translations kept inside texts moved into tables; the tables applied as the compiler hands the
// engine its texts — the same world either way.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from '../src/compile.ts'
import { readProject } from '../src/node.ts'
import { applyLocales, extractLocales, placeOf, switchSource, textsOf, translated, type LocaleFile } from '../src/texts.ts'
import type { Project } from '../src/project.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))

describe('where a file holds words', () => {
  it('finds the texts by the schemas, never an id that looks like words', () => {
    const story = { steps: [{ id: 'arrive', when: { map: 'glade' }, script: [{ say: 'player', text: 'A glade.' }, { fact: 'glade.arrived', value: 1 }, { move: 'npc.mira', x: 1, y: 2 }], say: 'Look.' }] }
    expect(textsOf('story/story.json', story).map((t) => [t.path.join('.'), t.text])).toEqual([['steps.0.script.0.text', 'A glade.'], ['steps.0.say', 'Look.']])
    // an effect's words, by its op; a condition's strings are not words
    const rules = [{ id: 'r', host: { type: 'item' }, on: 'act/use', tree: { if: { same: ['actor', 'target'] }, then: { do: [{ op: 'log', text: { en: 'Done.', zh: '好了。' } }, { op: 'setProp', key: 'name', value: 'Text' }] }, else: 'inherit' }, label: 'Use {target}' }]
    expect(textsOf('rules/r.json', rules).map((t) => t.path.join('.'))).toEqual(['0.tree.then.do.0.text', '0.label'])
    // a thing's written words; a person's name and lines
    const map = { map: { id: 'm', name: 'M', kind: 'wild', width: 1, height: 1, rows: ['.'], portals: [{ x: 0, y: 0, to: 'n', tx: 0, ty: 0, label: 'Out' }] }, entities: [{ id: 'm.sign', type: 'fixture/sign', place: { on: 'none' }, props: { text: 'North.', text_zh: '往北。' } }] }
    expect(textsOf('maps/m.json', map).map((t) => [t.path.join('.'), t.prop ?? false])).toEqual([['map.name', false], ['map.portals.0.label', false], ['entities.0.props.text', true]])
    expect(textsOf('catalog.json', {})).toEqual([])
  })
})

describe.skipIf(!STARTER)('the starter', () => {
  const english = (): Project => readProject(STARTER)
  /** The starter as an older project kept it: each text with its translation inside it, no table. */
  const inline = (): Project => ({ ...applyLocales(english()), locales: [] })

  it('its translations moved into a table, and applied again, make the same world', () => {
    expect(english().game.languages).toEqual({ source: 'en', translations: ['zh'] })
    const before = compile(inline())
    expect(compile(english()).bundle).toEqual(before.bundle)
    const p = inline()
    const old = structuredClone(p.locales ?? [])
    const { changed, tables, skipped } = extractLocales(p)
    expect(skipped).toEqual([])
    expect(changed.length).toBeGreaterThan(3)
    const zh = tables.find((t) => t.language === 'zh')!
    expect(Object.keys(zh.entries).length).toBeGreaterThan(20)
    // the files now say their words once, in English
    for (const f of [...p.story, ...p.quests, ...p.people, ...p.maps]) for (const t of textsOf(f.file, f.data)) expect(typeof t.text, `${f.file} ${t.path.join('.')}`).toBe('string')
    p.locales = [...old.filter((f) => f.data.language !== 'zh'), { file: 'locales/zh.json', data: zh }]
    const after = compile(p)
    expect(after.problems).toEqual(before.problems)
    expect(after.bundle).toEqual(before.bundle)
    expect(after.chunks).toEqual(before.chunks)
    expect(after.index).toEqual(before.index)
  })

  it('a place says a text otherwise where it must; a text no table knows stays as written', () => {
    const p = english()
    const table: LocaleFile = { language: 'zh', entries: { 'The Glade': '空地' }, at: { [placeOf('maps/glade.json', ['map', 'name'])]: { source: 'The Glade', text: '林间空地' } } }
    expect(translated(table, 'The Glade')).toBe('空地')
    expect(translated(table, 'The Glade', 'maps/glade.json#map.name')).toBe('林间空地')
    // a translation made for another source is not used
    expect(translated({ ...table, at: { 'maps/glade.json#map.name': { source: 'A Glade', text: '某空地' } } }, 'The Glade', 'maps/glade.json#map.name')).toBe('空地')
    p.maps.find((m) => m.data.map.id === 'glade')!.data.map.name = 'The Glade'
    p.locales = [{ file: 'locales/zh.json', data: table }]
    const out = applyLocales(p)
    expect(out.maps.find((m) => m.data.map.id === 'glade')!.data.map.name).toEqual({ en: 'The Glade', zh: '林间空地' })
    // the given project untouched
    expect(p.maps.find((m) => m.data.map.id === 'glade')!.data.map.name).toBe('The Glade')
  })

  it('written in Chinese instead, and back, it is the same world', () => {
    const before = compile(english())
    const p = english()
    switchSource(p, 'zh')
    expect(p.game.languages).toEqual({ source: 'zh', translations: ['en'] })
    expect(p.story[0].data.steps![0].script![0]).toEqual({ say: 'player', text: '一片空地，一间小屋。这里有人住。' })
    expect(p.locales!.find((f) => f.data.language === 'en')!.data.entries['一片空地，一间小屋。这里有人住。']).toBe('A glade, and a cottage. Someone lives here.')
    const zh = compile(p)
    expect(zh.chunks).toEqual(before.chunks)
    expect(zh.index.steps).toEqual(before.index.steps)
    switchSource(p, 'en')
    expect(compile(p).bundle.rules).toEqual(before.bundle.rules)
  })
})
