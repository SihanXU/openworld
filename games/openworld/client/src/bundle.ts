// OpenWorld as a bundle (docs/engine-split.md P3): what the engine's player fetches to play this game with no
// game in its own build — the ontology, the rules, the catalogue and the panels' tables as data (written to
// public/bundle.json by scripts/bundle.ts, beside the world gen:world writes), and the game's code as its
// plugin (plugin.ts). The wiki reads the game through it too.

import type { WorldIndex } from '@openworld/engine'
import { FORMAT, type Bundle } from '@openworld/format'
import type { ClientTables } from '@openworld/runtime/src/bundle.ts'
import { CLIENT_GAME as g } from './game.ts'

/** The game's bundle, for its world (its name and content version). */
export function openworldBundle(index: Pick<WorldIndex, 'name' | 'version'>): Bundle {
  const ontology = g.ontology()
  const stations = [...new Set([...g.crafting.recipes.map((r) => r.station), ...g.crafting.placements.map((p) => (p as { station?: string }).station)].filter((s): s is string => !!s))]
  const client: ClientTables = {
    items: g.items,
    crafting: { recipes: g.crafting.recipes, stations: Object.fromEntries(stations.map((s) => [s, g.crafting.stationName(s)])), placements: g.crafting.placements, buildings: g.crafting.buildings },
    skills: { all: g.skills.all, directions: [...g.skills.directions], branches: g.skills.branches, professions: g.skills.professions },
    boons: g.boons,
    looks: { table: g.looks.table, slots: [...g.looks.slots], worn: [...g.looks.worn], parts: g.looks.parts, player: g.looks.player },
    ...(g.cover && { cover: g.cover }),
    ...(g.dev && { dev: g.dev }),
  }
  const bundle: Bundle = {
    format: FORMAT,
    game: { id: g.id, name: index.name, version: index.version, modules: ontology.modules ?? [], plugins: ['plugin.js'] },
    ontology,
    rules: g.rules,
    terrainChars: g.terrainChars,
    catalog: g.catalog,
    client: client as Record<string, unknown>,
  }
  return bundle
}
