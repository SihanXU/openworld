// The project's JSON Schemas, generated from the engine's types (docs/engine-split.md P3): what each kind of
// project file may hold, for the editor's forms and for any author's editor. `npm run schema` writes them to
// packages/format/schema/; a test holds the starter's files to them.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from 'ts-json-schema-generator'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const OUT = join(HERE, '..', 'schema')

/** Each kind of project file, and the type its file is (a list of one, for the rules). */
export const SCHEMAS = { game: 'GameJson', ontology: 'OntologyPart', rules: 'RuleFile', map: 'MapFile', person: 'PersonFile', quest: 'QuestFile', story: 'StoryFile', learned: 'LearnedFile' } as const

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true })
  const gen = createGenerator({ path: join(HERE, 'files.ts'), tsconfig: join(HERE, '..', 'tsconfig.schema.json'), skipTypeCheck: true, additionalProperties: false, expose: 'export', topRef: true, jsDoc: 'extended' })
  for (const [name, type] of Object.entries(SCHEMAS)) {
    const schema = gen.createSchema(type)
    writeFileSync(join(OUT, `${name}.schema.json`), JSON.stringify(schema, null, 2) + '\n')
    console.log(`${name}.schema.json ← ${type}`)
  }
}
