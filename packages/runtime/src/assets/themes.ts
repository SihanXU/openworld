// Fixtures drawn by the theme of the map they stand on (Catalog.fixtureThemes): a room's furniture plain in a farmhouse,
// rich in a lord's seat. Both renderers ask (scene.ts textureFor, the wiki's render-map).

import type { Catalog, SpriteDef, ThemeLook } from './types.ts'

/** FNV-1a over a string: a map's pick among the themes of several. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const compiled = new WeakMap<object, { re: RegExp; themes: string[] }[]>()
const themes = new WeakMap<object, Map<string, string | undefined>>()

/** A map's theme: the first rule whose pattern matches its id; of several, the one its id picks. None: no rule. */
export function mapTheme(catalog: Catalog, mapId: string | undefined): string | undefined {
  const t = catalog.fixtureThemes
  if (!t || !mapId) return undefined
  let byMap = themes.get(t)
  if (!byMap) themes.set(t, (byMap = new Map()))
  if (byMap.has(mapId)) return byMap.get(mapId)
  let rules = compiled.get(t)
  if (!rules) compiled.set(t, (rules = t.rules.map((r) => ({ re: new RegExp(r.match), themes: r.theme.split(' ').filter(Boolean) }))))
  const rule = rules.find((r) => r.re.test(mapId))
  const theme = rule ? rule.themes[hash(mapId) % rule.themes.length] : undefined
  byMap.set(mapId, theme)
  return theme
}

/**
 * A fixture's look on a map by the map's theme (by its sprite key), lit or not, facing west or not; none when the theme
 * gives it none. Of a list of sets, the map's: the same place in every list.
 */
export function themedFixture(catalog: Catalog, sprite: string, mapId: string | undefined, lit: boolean, facing?: string): { key: string; def: SpriteDef; scale?: number } | undefined {
  const theme = mapTheme(catalog, mapId)
  const looks = theme ? catalog.fixtureThemes?.looks[sprite]?.[theme] : undefined
  if (!looks) return undefined
  const set = Array.isArray(looks) ? hash(`${mapId}/set`) % looks.length : -1
  const look: ThemeLook | undefined = Array.isArray(looks) ? looks[set] : looks
  if (!look) return undefined
  const def = (lit && look.lit) || (facing === 'left' && look.left) || look.sprite
  const state = def === look.lit ? ':lit' : def === look.left ? ':left' : ''
  return { key: `theme:${sprite}:${theme}${set >= 0 ? `:${set}` : ''}${state}`, def, scale: look.scale }
}
