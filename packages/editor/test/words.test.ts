// The editor's two languages (docs/engine-split.md §19): its own words, every phrase its code says in the Chinese
// table with its slots (src/app/lang.ts, zh.ts); and a game's words, one field each in the game's source language,
// their translations kept for words changed and moved into the tables (src/app/words.ts).

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readProject } from '@openworld/format/src/node.ts'
import type { LocaleFile, PersonFile } from '@openworld/format'
import type { QuestDef } from '@openworld/engine'
import { ZH } from '../src/app/zh.ts'
import { Store } from '../src/app/store.ts'
import { adopt, adoptTexts, inLang, sourceLang, together, tx, useProject, written } from '../src/app/words.ts'

const APP = fileURLToPath(new URL('../src/app/', import.meta.url))
const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe("the editor's own words", () => {
  const files = readdirSync(APP).filter((f) => f.endsWith('.ts') && f !== 'zh.ts')
  const said = new Map<string, string>()
  for (const f of files)
    for (const m of readFileSync(APP + f, 'utf8').matchAll(/(?<![A-Za-z0-9_.])(?:t|phrase)\(\s*'((?:[^'\\]|\\.)*)'/g)) said.set(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'), f)

  it('every phrase the code says is in the Chinese table, with the same slots', () => {
    expect(said.size).toBeGreaterThan(1000)
    const missing = [...said].filter(([k]) => ZH[k] === undefined).map(([k, f]) => `${f}: ${k}`)
    expect(missing).toEqual([])
    const wrong = [...said.keys()].filter((k) => slots(k).join() !== slots(ZH[k]).join())
    expect(wrong).toEqual([])
  })

  it('the table says nothing the code does not', () => {
    expect(Object.keys(ZH).filter((k) => !said.has(k))).toEqual([])
  })

  it('no panel writes a game text as two fields, one a language each', () => {
    for (const f of files) expect(readFileSync(APP + f, 'utf8'), f).not.toMatch(/placeholder="中文"|data-l="zh"|data-[a-z]+="zh"|textOf\(|zhOf\(/)
  })
})

describe("a game's words", () => {
  const open = () => {
    const s = new Store('starter', readProject(STARTER))
    useProject(s)
    return s
  }
  const zh = (s: Store) => s.get<LocaleFile>('locales/zh.json')!

  it('are shown and written in the source language; a changed text keeps its translation, to be looked at again', () => {
    const s = open()
    expect(sourceLang()).toBe('en')
    const mira = s.list<PersonFile>('people').find((p) => p.data.id.includes('mira'))!
    const line = mira.data.npc!.person!.lines![0]
    const was = tx(line.text)
    const said = zh(s).entries[was]
    expect(said).toBeTruthy()
    expect(inLang(line.text, 'zh')).toBe(said)
    const next = together(() => written(line.text, `${was} Truly.`))
    expect(next).toBe(`${was} Truly.`)
    expect(zh(s).entries[`${was} Truly.`]).toBe(said)
    expect(zh(s).review).toContain(`${was} Truly.`)
    // the words and their translation kept: one Undo
    s.change<PersonFile>(mira.file, 'a line', (p) => (p.npc!.person!.lines![0].text = next!))
    expect(s.unsaved()).toBe(2)
  })

  it("made with the editor's words in several languages: the source's written, the others into the tables", () => {
    const s = open()
    expect(adopt({ en: 'A Favour', zh: '一个忙' })).toBe('A Favour')
    expect(zh(s).entries['A Favour']).toBe('一个忙')
    const q = adoptTexts('quests/x.json', { id: 'x', kind: 'side', title: { en: 'Firewood Again', zh: '又是柴火' }, aliases: {}, stages: [{ n: 10, log: { en: 'Go.', zh: '去吧。' } }], start: { manual: true } } as QuestDef)
    expect(q.title).toBe('Firewood Again')
    expect(q.stages[0].log).toBe('Go.')
    expect(zh(s).entries['Firewood Again']).toBe('又是柴火')
    // a table's own translation is not overwritten
    adopt({ en: 'A Favour', zh: '别的' })
    expect(zh(s).entries['A Favour']).toBe('一个忙')
  })

  it('a batch of edits is said once, as one', () => {
    const s = open()
    const heard: string[] = []
    s.on((why) => heard.push(why))
    s.batch('both', () => {
      s.change<LocaleFile>('locales/zh.json', 'a', (d) => (d.entries.x = 'x'))
      s.set('locales/ja.json', { language: 'ja', entries: {} }, 'b')
    })
    expect(heard).toEqual(['both'])
    expect(s.undo()).toBe('both')
    expect(s.get('locales/ja.json')).toBeUndefined()
    expect(zh(s).entries.x).toBeUndefined()
  })
})
