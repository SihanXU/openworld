// The Ford baked into editable data (docs/engine-split.md P3): OpenWorld as a project in the format — game.json,
// the ontology, the rules, every map with the ids its builder gave, every person, quest and story step, the
// catalogue and the panels' tables — written to games/openworld/project/ (not committed: made anew from the
// builders, until the team makes these files the source and the editor edits them). The compiler makes the
// same world of it as gen:world does (tools/test/bake.test.ts).
//   tsx games/openworld/client/scripts/bake.ts [--out <dir>]

import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Ontology, Rule, WorldIndex } from '@openworld/engine'
import type { GameJson, Project } from '@openworld/format'
import { writeProjectFile } from '@openworld/format/src/node.ts'
import { extractLocales } from '@openworld/format'
import { BASE_RULES } from '@openworld-game/content'
import { buildFord } from '../../tools/src/demo/world.ts'
import { openworldBundle } from '../src/bundle.ts'

/** The Ford as a project, in memory: the same files bake() writes. */
export function fordProject(): Project {
  const { index, chunks: played, backdrop } = buildFord()
  // the played maps and the backdrop's (docs/continent.md): the project is the whole world
  const chunks = [...played, ...backdrop]
  const bundle = openworldBundle(index)
  const { modules, params, types, statuses, terrains, ...world } = bundle.ontology
  const game: GameJson = {
    id: bundle.game.id,
    name: index.name,
    version: index.version,
    doc: 'OpenWorld, the first game on the engine (docs/lore.md, docs/chapter-1.md), baked from its builders (games/openworld/tools/src/demo).',
    stdlib: false,
    modules: modules ?? [],
    seed: index.seed,
    start: index.start,
    // the world map is laid out from the Ford (tools/src/demo/world.ts placeMaps)
    origin: 'ford',
    order: { maps: chunks.map((c) => c.map.id), people: index.npcs.map((n) => n.id), quests: (index.quests ?? []).map((q) => q.id) },
    ...(index.begin && { begin: index.begin }),
    ...(index.starts && { starts: index.starts }),
    ...(index.startHour !== undefined && { startHour: index.startHour }),
    player: index.player,
    ...(index.companions && { companions: index.companions }),
    terrainChars: bundle.terrainChars,
    ...(params && { params }),
    plugins: bundle.game.plugins,
    // written in English, translated into Chinese (docs/engine-split.md §19): the builders' words in both, split below
    languages: { source: 'en', translations: ['zh'] },
  }
  const base = new Set(BASE_RULES.map((r) => r.id))
  const derived = new Set(['name', 'version', 'seed', 'start', 'begin', 'starts', 'startHour', 'maps', 'npcs', 'player', 'companions', 'stats', 'steps', 'invariants', 'protectedFacts', 'weather', 'quests'])
  const extra = Object.fromEntries(Object.entries(index).filter(([k]) => !derived.has(k))) as Partial<WorldIndex>
  const at = (file: string) => <T>(data: T) => ({ file, data })
  const p: Project = {
    game,
    ontology: [at('ontology/types.json')({ types }), at('ontology/statuses.json')({ statuses }), at('ontology/terrains.json')({ terrains }), at('ontology/world.json')(world as Partial<Ontology>)],
    rules: [at('rules/base.json')(bundle.rules.filter((r) => base.has(r.id)) as Rule[]), at('rules/story.json')(bundle.rules.filter((r) => !base.has(r.id)) as Rule[])],
    maps: chunks.map((c) => at(`maps/${c.map.id}.json`)(c)),
    people: index.npcs.map((n) => at(`people/${n.id}.json`)(n as never)),
    quests: (index.quests ?? []).map((q) => at(`quests/${q.id}.json`)(q)),
    story: [at('story/story.json')({ steps: index.steps, invariants: index.invariants, protectedFacts: index.protectedFacts, weather: index.weather })],
    catalog: bundle.catalog,
    client: Object.entries(bundle.client ?? {}).map(([k, v]) => at(`client/${k}.json`)({ [k]: v })),
    extra,
  }
  // the files say each text once, in English; its Chinese is the table's (the compiler gives the engine both again).
  // (a copy as the files are, sharing nothing: the builders' own data, which the content shares, is left as it is,
  // and a table one file holds and another shares — the client's looks, the ontology's — is each file's own)
  const own = JSON.parse(JSON.stringify(p)) as Project
  own.locales = extractLocales(own).tables.map((t) => at(`locales/${t.language}.json`)(t))
  return own
}

/** Write the project's files (the folder made anew). */
export function bake(out: string): Project {
  const p = fordProject()
  rmSync(out, { recursive: true, force: true })
  const write = (file: string, v: unknown) => (mkdirSync(join(out, file, '..'), { recursive: true }), writeProjectFile(join(out, file), v))
  write('game.json', p.game)
  for (const group of [p.ontology, p.rules, p.maps, p.people, p.quests, p.story, p.client ?? [], p.locales ?? []]) for (const f of group) write(f.file, f.data)
  write('catalog.json', p.catalog)
  write('extra.json', p.extra)
  return p
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--out')
  const out = i >= 0 ? process.argv[i + 1] : fileURLToPath(new URL('../../project', import.meta.url))
  const p = bake(out)
  console.log(`The Ford baked: ${p.maps.length} maps, ${p.people.length} people, ${p.quests.length} quests, ${p.rules.reduce((n, f) => n + f.data.length, 0)} rules → ${out}`)
}
