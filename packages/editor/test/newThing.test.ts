// A new thing taken into the game (the AI plan's M1): the file the game ships with is written in the game's language,
// and the modder is told of it with every name the draft had (its library asks for both), the draft left as it was.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { TypeDef } from '@openworld/engine'
import type { LearnedFile, LocaleFile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { Store } from '../src/app/store.ts'
import { useProject } from '../src/app/words.ts'
import { takeThing } from '../src/app/newThing.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))

describe('a new thing taken into the game', () => {
  it('is written in the game\'s language, and sent to the modder with both names', () => {
    const s = new Store('starter', readProject(STARTER))
    useProject(s)
    const lamp: TypeDef = { id: 'fixture/furniture/gel_lamp', name: { en: 'Gel Lamp', zh: '凝胶灯' }, tags: ['portable'], makeup: [{ type: 'item/material/gel', count: 2 }], station: 'hands' }
    const draft = [structuredClone(lamp)]
    const { file, sent } = takeThing(s, draft)
    expect(file).toBe('learned/thing-furniture-gel_lamp.json')
    expect(s.get<LearnedFile>(file)!.types![0].name).toBe('Gel Lamp')
    expect(s.get<LocaleFile>('locales/zh.json')!.entries['Gel Lamp']).toBe('凝胶灯')
    expect(sent.artifacts).toEqual([{ kind: 'type', type: lamp }])
    expect(draft).toEqual([lamp])
  })
})
