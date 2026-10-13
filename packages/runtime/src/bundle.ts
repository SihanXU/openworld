// A game as a bundle (docs/engine-split.md §5, P3): the player fetches a game by URL — `bundle.json`, its world
// beside it (`world/`), its pictures and sounds (`assets/`) — and plays it, with no game in its own build.
// Everything a bundle holds is data; what only code can do (a wilderness made by seed, the upgrades of older
// saves, a look generator of the game's own) comes from the game's plugins, scripts the bundle names, loaded
// here in the page and in the worker alike.

import { gameDefOf, type Bundle } from '@openworld/format'
import type { Look, LookTable, PlacementRecipe, Recipe, SkillDef, Text } from '@openworld/engine'
import type { Catalog } from './assets/types.ts'
import { pageUrl } from './game.ts'
import type { BoonInfo, ClientGame, CoverDef, DevShortcut, FormInfo, LookPartInfo, ProfessionCard, ShopDef, SkillBranchDef, SkillDirectionDef } from './game.ts'

type Words = { en: string; zh: string }

/** The tables a bundle's `client` holds for the player's panels (the project's client/*.json). All optional. */
export interface ClientTables {
  items?: { forms?: Record<string, FormInfo>; materials?: Record<string, Words>; relics?: Record<string, Words & { text: Words }>; vows?: Record<string, Words & { text: Words }>; coin?: string }
  crafting?: { recipes?: Recipe[]; stations?: Record<string, Words>; shops?: ShopDef[]; placements?: PlacementRecipe[]; buildings?: PlacementRecipe[] }
  skills?: { all?: SkillDef[]; directions?: SkillDirectionDef[]; branches?: SkillBranchDef[]; professions?: ProfessionCard[] }
  boons?: Record<string, BoonInfo>
  looks?: { table?: LookTable; slots?: string[]; worn?: string[]; parts?: Record<string, LookPartInfo>; player?: Look }
  cover?: CoverDef
  dev?: { shortcuts: DevShortcut[] }
  /** The interface's words the game says its own way (ClientGame.texts). */
  texts?: Record<string, { en: string; zh?: string }>
}

/**
 * A game's plugin (its default export): given the game as the bundle makes it, what its own code adds or puts
 * in its place (its wilderness, its save upgrades, its own panels). It runs in the page and in the worker, before
 * anything is drawn or played: a panel's code is best loaded when the panel is first opened (ui/panels.ts).
 */
export type GamePlugin = (game: ClientGame) => Partial<ClientGame> | void

const words = (t: Text | undefined, fallback: string): Words => (typeof t === 'object' && t ? { en: t.en, zh: t.zh ?? t.en } : { en: t ?? fallback, zh: t ?? fallback })

/** A look the table can make with no code of the game's: by a seed, a body and a part per slot, picked evenly. */
function plainLook(table: LookTable | undefined, seed: string): Look {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000
  const any = <T>(xs: T[]): T | undefined => xs[Math.floor(r() * xs.length)]
  const bodies = Object.keys(table?.bodies ?? {})
  const parts: Record<string, string> = {}
  for (const [id, p] of Object.entries(table?.parts ?? {})) if (!parts[p.slot] && r() < 0.5) parts[p.slot] = id
  const colors: Record<string, string> = {}
  for (const key of ['skin', 'hair', 'eyes']) { const c = any(Object.keys(table?.colors ?? {})); if (c) colors[key] = c }
  return { body: any(bodies) ?? 'woman', parts, colors }
}

/** The game a bundle is, at its URL (its folder: `bundle.json` in it), with what its plugins add. */
export function clientGameOf(b: Bundle, url: string): ClientGame {
  const base = new URL('.', new URL(url, pageUrl())).href
  const c = (b.client ?? {}) as ClientTables
  const table = c.looks?.table ?? b.ontology.looks
  const skills = c.skills ?? {}
  const branches = skills.branches ?? []
  const professions = skills.professions ?? []
  const stations = c.crafting?.stations ?? {}
  return {
    ...gameDefOf(b),
    catalog: (b.catalog ?? {}) as Catalog,
    assets: `${base}assets/`,
    world: `${base}world/`,
    cover: { title: b.game.name, ...c.cover },
    ...(c.dev && { dev: c.dev }),
    ...(c.texts && { texts: c.texts }),
    items: { forms: c.items?.forms ?? {}, materials: c.items?.materials ?? {}, relics: c.items?.relics ?? {}, ...(c.items?.vows && { vows: c.items.vows }), coin: c.items?.coin ?? b.ontology.social?.coin ?? 'item/coin' },
    crafting: {
      recipes: c.crafting?.recipes ?? [],
      stationName: (s) => stations[s] ?? words(b.ontology.types[`fixture/${s}`]?.name, s),
      ...(c.crafting?.shops && { shops: c.crafting.shops }),
      placements: c.crafting?.placements ?? [],
      buildings: c.crafting?.buildings ?? [],
    },
    skills: {
      all: skills.all ?? [],
      directions: skills.directions ?? [],
      branches,
      professions,
      // a profession's tree: its own branch named for it
      branchesFor: (p) => { const role = professions.find((x) => x.id === p); return branches.map((x) => (x.id === 'profession' && role ? { ...x, icon: role.icon, name: role.name } : x)) },
      forProfession: (p) => (skills.all ?? []).filter((s) => !s.profession || s.profession === p),
    },
    boons: c.boons ?? {},
    looks: {
      table: table ?? { slots: [], bodies: {}, parts: {}, colors: {} },
      slots: c.looks?.slots ?? table?.slots ?? [],
      worn: new Set(c.looks?.worn ?? []),
      bodies: table?.bodies ?? {},
      colors: table?.colors ?? {},
      parts: c.looks?.parts ?? table?.parts ?? {},
      player: c.looks?.player ?? plainLook(table, 'player'),
      generate: (seed) => plainLook(table, seed),
      describe: () => ({ en: '', zh: '' }),
    },
  }
}

/** Fetch a game's bundle by URL (its folder, or its bundle.json), and load its plugins. */
export async function loadBundle(url: string): Promise<ClientGame> {
  const at = new URL(url.endsWith('.json') ? url : url.replace(/\/?$/, '/bundle.json'), pageUrl()).href
  const res = await fetch(at)
  if (!res.ok) throw new Error(`no game at ${at} (${res.status})`)
  const bundle = (await res.json()) as Bundle
  let g = clientGameOf(bundle, at)
  for (const p of bundle.game.plugins ?? []) {
    const mod = (await import(/* @vite-ignore */ new URL(p, at).href)) as { default?: GamePlugin }
    const more = mod.default?.(g)
    if (more) g = { ...g, ...more }
  }
  return g
}
