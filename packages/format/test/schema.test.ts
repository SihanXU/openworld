// The project's JSON Schemas (schema.ts) hold the files written by hand and the files the editor saves.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import { createGenerator } from 'ts-json-schema-generator'
import { describe, expect, it } from 'vitest'
import { SCHEMAS } from '../src/schema.ts'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const SCHEMA = join(ROOT, 'packages/format/schema')
const STARTER = join(ROOT, 'games/starter')
const ajv = new Ajv({ allErrors: true, strict: false })
const schema = (name: string) => ajv.compile(JSON.parse(readFileSync(join(SCHEMA, `${name}.schema.json`), 'utf8')))
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'))
const dir = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => join(d, f)) : [])

/** What a file's schema says of it: nothing when it holds. */
function problems(name: string, file: string): string[] {
  const v = schema(name)
  return v(json(file)) ? [] : (v.errors ?? []).slice(0, 5).map((e) => `${file}: ${e.instancePath} ${e.message} ${JSON.stringify(e.params)}`)
}

describe('the schemas', () => {
  it('are the engine\'s types as they are now (npm run schema writes them)', () => {
    const src = join(ROOT, 'packages/format/src')
    const gen = createGenerator({ path: join(src, 'files.ts'), tsconfig: join(ROOT, 'packages/format/tsconfig.schema.json'), skipTypeCheck: true, additionalProperties: false, expose: 'export', topRef: true, jsDoc: 'extended' })
    for (const [name, type] of Object.entries(SCHEMAS)) expect(JSON.stringify(gen.createSchema(type), null, 2) + '\n', name).toBe(readFileSync(join(SCHEMA, `${name}.schema.json`), 'utf8'))
  }, 60_000)
})

describe.skipIf(!existsSync(STARTER))('the schemas and the files', () => {
  it('hold every file of the starter, and the standard library', () => {
    const found = [
      ...problems('game', join(STARTER, 'game.json')),
      ...dir(join(STARTER, 'ontology')).flatMap((f) => problems('ontology', f)),
      ...dir(join(STARTER, 'rules')).flatMap((f) => problems('rules', f)),
      ...dir(join(STARTER, 'maps')).flatMap((f) => problems('map', f)),
      ...dir(join(STARTER, 'people')).flatMap((f) => problems('person', f)),
      ...dir(join(STARTER, 'quests')).flatMap((f) => problems('quest', f)),
      ...dir(join(STARTER, 'story')).flatMap((f) => problems('story', f)),
      ...problems('ontology', join(ROOT, 'packages/stdlib/ontology.json')),
      ...problems('rules', join(ROOT, 'packages/stdlib/rules.json')),
    ]
    expect(found).toEqual([])
  })

  it('refuse what is not a project file: an effect no engine knows, a map without its rows', () => {
    expect(schema('rules')([{ id: 'x', on: 'act/use', tree: { do: [{ op: 'explode' }] } }])).toBe(false)
    const map = json(join(STARTER, 'maps/glade.json'))
    delete map.map.rows
    expect(schema('map')(map)).toBe(false)
  })
})
