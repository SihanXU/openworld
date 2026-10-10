// Writes OpenWorld's bundle (src/bundle.ts) beside the world gen:world wrote: public/bundle.json.
//   tsx games/openworld/client/scripts/bundle.ts   (npm run gen:world runs it)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { WorldIndex } from '@openworld/engine'
import { openworldBundle } from '../src/bundle.ts'

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url))
const index = JSON.parse(readFileSync(`${PUBLIC}world/index.json`, 'utf8')) as WorldIndex
const bundle = openworldBundle(index)
writeFileSync(`${PUBLIC}bundle.json`, JSON.stringify(bundle))
console.log(`OpenWorld's bundle: ${Object.keys(bundle.ontology.types).length} types, ${bundle.rules.length} rules, ${bundle.game.modules.length} modules → ${PUBLIC}bundle.json`)
