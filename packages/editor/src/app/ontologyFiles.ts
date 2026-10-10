// Where an entry of the ontology (a type, a status, a terrain) is written in the project: in which file, as an
// item of a list or a key of a record (an ontology file may hold either, format/src/project.ts). An entry the
// project does not write is the standard library's; changing it writes the project's own over it.

import type { OntologyPart } from '@openworld/format'
import type { Store } from './store.ts'

export type Section = 'types' | 'statuses' | 'terrains'
type Entry = { id: string }

/** The project file that writes this entry, if any. */
export function entryFile(store: Store, section: Section, id: string): string | undefined {
  for (const f of store.list<OntologyPart>('ontology')) {
    const v = f.data[section] as Entry[] | Record<string, Entry> | undefined
    if (Array.isArray(v) ? v.some((x) => x.id === id) : v && id in v) return f.file
  }
  return undefined
}

/** The file new entries of a section go in: the first that has the section, else `ontology/<section>.json`. */
function homeOf(store: Store, section: Section): string {
  return store.list<OntologyPart>('ontology').find((f) => f.data[section])?.file ?? `ontology/${section}.json`
}

/** Write an entry (its whole definition) where it is written, or where its section's new ones go. */
export function setEntry(store: Store, section: Section, def: Entry, why: string): void {
  const file = entryFile(store, section, def.id) ?? homeOf(store, section)
  if (!store.get(file)) store.add(file, { [section]: [] }, `a new file ${file}`)
  store.change<OntologyPart>(file, why, (part) => {
    const v = (part[section] ??= [] as never) as Entry[] | Record<string, Entry>
    if (Array.isArray(v)) {
      const i = v.findIndex((x) => x.id === def.id)
      if (i >= 0) v[i] = def
      else v.push(def)
    } else v[def.id] = def
  })
}

export function removeEntry(store: Store, section: Section, id: string, why: string): void {
  const file = entryFile(store, section, id)
  if (!file) return
  store.change<OntologyPart>(file, why, (part) => {
    const v = part[section] as Entry[] | Record<string, Entry>
    if (Array.isArray(v)) v.splice(v.findIndex((x) => x.id === id), 1)
    else delete v[id]
  })
}
