// A new thing taken into the game (thingsMode.ts, the AI plan's M1), as data: the learned/ file the game ships with
// (its words in the game's language, the other languages into the tables) and the patch the modder is told of,
// which keeps every name the draft had (the modder's library asks a new type for its name in both languages).

import type { Patch, TypeDef } from '@openworld/engine'
import type { LearnedFile } from '@openworld/format'
import { t } from './lang.ts'
import type { Store } from './store.ts'
import { adoptTexts } from './words.ts'

export function takeThing(store: Store, types: TypeDef[]): { file: string; sent: Patch } {
  const sent: Patch = { artifacts: structuredClone(types).map((type) => ({ kind: 'type' as const, type })) }
  // named by the whole id: item/tool/maul and item/weapon/maul are two things, never one file
  const name = `thing-${types.at(-1)!.id.split('/').slice(1).join('-')}`.replace(/[^A-Za-z0-9._-]+/g, '-')
  const file = `learned/${name}.json`
  const data: LearnedFile = { rules: [], types: structuredClone(types) }
  store.batch(t('take {name} into the game', { name }), () => {
    adoptTexts(file, data)
    if (store.get(file)) store.change<LearnedFile>(file, t('take {name} again', { name }), (x) => Object.assign(x, data))
    else store.add(file, data, t('take {name} into the game', { name }))
  })
  return { file, sent }
}
