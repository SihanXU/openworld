// The map's tools, as the author meets them (§16 E1, the map's feel): each layer has a few tools in a strip of
// icons — select, the brush, the eraser, the eyedropper, the templates — and a tool's own choices (the brush's shape
// and size, which template) in the bar above the map. What can be laid is chosen in the palette on the left, by
// kind: the ground's terrains in groups (ground, water, plants and rock, building parts; the overworld's own only on
// an overworld map). Pure: mapMode.ts draws them.

import type { TerrainDef } from '@openworld/engine'
import type { IconName } from './icons.ts'
import { phrase } from './lang.ts'

export type LayerId = 'ground' | 'height' | 'things' | 'marks'
export type Tool =
  | 'pencil' | 'rect' | 'ellipse' | 'fill' | 'select' | 'building' | 'room' | 'path' | 'organic' | 'eyedrop'
  | 'pick' | 'put' | 'putRect' | 'erase' | 'scatter' | 'yard' | 'quick'
  | 'mark' | 'portal' | 'anchor' | 'region' | 'start'

/** One of a group's tools: what it does, its key, its icon (a brush's shapes have one; a template is named). */
export interface ToolDef {
  id: Tool
  label: string
  tip: string
  key?: string
  icon?: IconName
}

/** A tool in the strip: its icon, its key, and the choices it offers in the bar (one alone: no choice). */
export interface ToolGroup {
  id: 'select' | 'brush' | 'erase' | 'eyedrop' | 'stamp' | 'mark'
  icon: IconName
  label: string
  tip: string
  key: string
  tools: ToolDef[]
}

export interface Layer {
  id: LayerId
  label: string
  tip: string
  groups: ToolGroup[]
}

const eyedropper = (tip: string): ToolGroup => ({ id: 'eyedrop', icon: 'pick', label: phrase('Eyedropper'), tip, key: 'I', tools: [{ id: 'eyedrop', label: phrase('Eyedropper'), tip }] })
const shapes = (what: 'ground' | 'height'): ToolDef[] => [
  { id: 'pencil', label: phrase('Free'), tip: what === 'ground' ? phrase('paint cells as you drag, as wide as the size') : phrase('paint heights as you drag, as wide as the size'), key: 'P', icon: 'free' },
  { id: 'rect', label: phrase('Rectangle'), tip: phrase('drag a box: painted whole'), key: 'R', icon: 'rect' },
  { id: 'ellipse', label: phrase('Ellipse'), tip: phrase('drag a box: the ellipse in it'), key: 'E', icon: 'ellipse' },
  { id: 'fill', label: phrase('Fill'), tip: what === 'ground' ? phrase('the cells joined to this one by the same ground') : phrase('the cells joined to this one at the same height'), key: 'F', icon: 'fill' },
]

export const LAYERS: Layer[] = [
  {
    id: 'ground', label: phrase('Ground'), tip: phrase('the ground: terrain, buildings, rooms'),
    groups: [
      { id: 'select', icon: 'select', label: phrase('Select'), tip: phrase('drag a box: Ctrl+C copy, Ctrl+X cut, Ctrl+V paste, Delete takes its things away; drag it (or the arrows) to move it'), key: 'S', tools: [{ id: 'select', label: phrase('Select'), tip: phrase('drag a box: Ctrl+C copy, Ctrl+X cut, Ctrl+V paste, Delete takes its things away; drag it (or the arrows) to move it') }] },
      { id: 'brush', icon: 'brush', label: phrase('Brush'), tip: phrase('paint the ground chosen on the left: free, a rectangle, an ellipse or a fill'), key: 'B', tools: shapes('ground') },
      eyedropper(phrase('click a cell: its ground is chosen (the right button does it with any tool)')),
      {
        id: 'stamp', icon: 'stamp', label: phrase('Templates'), tip: phrase('lay a whole piece at once: a building, a room, a path, a patch'), key: 'T',
        tools: [
          { id: 'building', label: phrase('Building'), tip: phrase('a building from the catalogue: click where its top left goes; then make the room behind its door') },
          { id: 'room', label: phrase('Room'), tip: phrase('drag a box: walls round a floor; click one of its walls for a doorway'), key: 'O' },
          { id: 'path', label: phrase('Path'), tip: phrase('a curved path through the points you click') },
          { id: 'organic', label: phrase('Patch'), tip: phrase('an organic patch of ground (drag its box): a pond, a clearing') },
        ],
      },
    ],
  },
  {
    id: 'height', label: phrase('Height'), tip: phrase('the ground\'s height in half levels'),
    groups: [
      { id: 'select', icon: 'select', label: phrase('Select'), tip: phrase('drag a box: copy, cut, paste, move (as on the ground)'), key: 'S', tools: [{ id: 'select', label: phrase('Select'), tip: phrase('drag a box: copy, cut, paste, move (as on the ground)') }] },
      { id: 'brush', icon: 'brush', label: phrase('Brush'), tip: phrase('paint the height chosen on the left: free, a rectangle, an ellipse or a fill'), key: 'B', tools: shapes('height') },
      eyedropper(phrase('click a cell: its height is chosen (the right button does it with any tool)')),
    ],
  },
  {
    id: 'things', label: phrase('Things'), tip: phrase('the things on the map, and the people standing there'),
    groups: [
      { id: 'select', icon: 'select', label: phrase('Select'), tip: phrase('click a thing or a person: drag to move, the arrows nudge, Delete removes, Ctrl+C / Ctrl+V copy; a double click opens it'), key: 'S', tools: [{ id: 'pick', label: phrase('Select'), tip: phrase('click a thing or a person: drag to move, the arrows nudge, Delete removes, Ctrl+C / Ctrl+V copy; a double click opens it') }] },
      {
        id: 'brush', icon: 'brush', label: phrase('Brush'), tip: phrase('set down the kind chosen on the left: one a cell as you drag, or one in every cell of a box'), key: 'B',
        tools: [
          { id: 'put', label: phrase('Free'), tip: phrase('the kind chosen, in each cell clicked or dragged over'), key: 'P', icon: 'free' },
          { id: 'putRect', label: phrase('Rectangle'), tip: phrase('one in every cell of a box'), key: 'R', icon: 'rect' },
        ],
      },
      { id: 'erase', icon: 'erase', label: phrase('Erase'), tip: phrase('take away the things in the cells (drag; as wide as the size)'), key: 'X', tools: [{ id: 'erase', label: phrase('Erase'), tip: phrase('take away the things in the cells (drag; as wide as the size)') }] },
      eyedropper(phrase('click a thing: its kind is chosen (the right button does it with any tool)')),
      {
        id: 'stamp', icon: 'stamp', label: phrase('Templates'), tip: phrase('lay a whole piece at once: a door, a chest, a merchant…, things scattered, a yard'), key: 'T',
        tools: [
          { id: 'quick', label: phrase('Quick'), tip: phrase('a door, a chest, a sign, a bed, a person, a merchant or a quest giver: choose it, fill it in, click where it goes'), key: 'Q' },
          { id: 'scatter', label: phrase('Scatter'), tip: phrase('small things by a mask (drag a box): on the ground you name') },
          { id: 'yard', label: phrase('Yard'), tip: phrase('a fenced yard of the kind chosen (drag its box), a gate at its foot') },
        ],
      },
    ],
  },
  {
    id: 'marks', label: phrase('Marks'), tip: phrase('portals, anchors, areas and where the game begins'),
    groups: [
      { id: 'select', icon: 'select', label: phrase('Select'), tip: phrase('click a portal, an anchor or the start: drag one to move it, the arrows nudge'), key: 'S', tools: [{ id: 'mark', label: phrase('Select'), tip: phrase('click a portal, an anchor or the start: drag one to move it, the arrows nudge') }] },
      {
        id: 'mark', icon: 'mark', label: phrase('Place a mark'), tip: phrase('a portal, an anchor, an area or the start'), key: 'M',
        tools: [
          { id: 'portal', label: phrase('Portal'), tip: phrase('a way to another map'), key: 'T' },
          { id: 'anchor', label: phrase('Anchor'), tip: phrase('a named spot (people\'s days, scenes)'), key: 'A' },
          { id: 'region', label: phrase('Area'), tip: phrase('a named area (drag a rectangle)'), key: 'R' },
          { id: 'start', label: phrase('Start'), tip: phrase('where a new game begins') },
        ],
      },
    ],
  },
]

export const layerOf = (id: LayerId): Layer => LAYERS.find((l) => l.id === id)!
/** The group a tool is in, on its layer. */
export const groupOf = (layer: LayerId, tool: Tool): ToolGroup => layerOf(layer).groups.find((g) => g.tools.some((x) => x.id === tool)) ?? layerOf(layer).groups[0]
export const toolDef = (layer: LayerId, tool: Tool): ToolDef | undefined => layerOf(layer).groups.flatMap((g) => g.tools).find((x) => x.id === tool)

/**
 * The tool a key chooses on a layer: a group's key its tool (the one last used in it, else its first); else a
 * group's own tool by its key (P the free brush, R the rectangle …). None: the key is not a tool's.
 */
export function toolForKey(layer: LayerId, key: string, last: Partial<Record<string, Tool>> = {}): Tool | undefined {
  const k = key.toUpperCase()
  const L = layerOf(layer)
  const g = L.groups.find((x) => x.key === k)
  if (g) return last[`${layer}:${g.id}`] ?? g.tools[0].id
  return L.groups.flatMap((x) => x.tools).find((x) => x.key === k)?.id
}

// ---------------------------------------------------------------- the ground's palette

export type TerrainGroup = 'ground' | 'water' | 'nature' | 'building' | 'overworld'
export const TERRAIN_GROUPS: [TerrainGroup, string][] = [
  ['overworld', phrase('World map')],
  ['ground', phrase('Ground')],
  ['water', phrase('Water and liquids')],
  ['nature', phrase('Plants and rock')],
  ['building', phrase('Building parts')],
]
const BUILT = ['wall', 'floor', 'door', 'roof', 'stairs', 'indoor', 'bridge']

/** The group a terrain is shown in: by what it is (its tags, whether it is liquid, the space it takes). */
export function terrainGroup(def: TerrainDef | undefined): TerrainGroup {
  const tags = def?.tags ?? []
  if (tags.includes('overworld')) return 'overworld'
  if (def?.liquid) return 'water'
  if (tags.some((x) => BUILT.includes(x))) return 'building'
  if (def?.space === 'volume' || def?.space === 'soil') return 'nature'
  return 'ground'
}

/**
 * The palette's groups for a map: its game's terrains (character and id) in the groups they belong to, empty groups
 * left out; the overworld's own only on an overworld map (where they come first), and on another map only those it
 * already holds.
 */
export function terrainPalette(chars: [string, string][], terrains: Record<string, TerrainDef>, map: { kind?: string; rows?: string[] }): { group: TerrainGroup; label: string; chars: [string, string][] }[] {
  const world = map.kind === 'overworld'
  const used = new Set((map.rows ?? []).join(''))
  return TERRAIN_GROUPS.map(([group, label]) => ({
    group,
    label,
    chars: chars.filter(([c, id]) => terrainGroup(terrains[id]) === group && (group !== 'overworld' || world || used.has(c))),
  })).filter((g) => g.chars.length && (!world || g.group === 'overworld' || g.group === 'water' || g.chars.some(([c]) => used.has(c))))
}
