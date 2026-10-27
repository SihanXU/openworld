import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, CH1, PART_TWO, STORY_RULES, UNTOLD, buildOntology, decodeChunk, migratePartTwo } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { OVERWORLD } from '../src/demo/overworld.ts'

// Release 1's reach (docs/release-1.md §1): Part One is the west bank, the Ford and the Pilgrim's Road to the White
// Knight, and the Held Ground after him; the road on east to Emberfall and the continent beyond the river wait for Part
// Two. Every way a player has from the start — a map's ways, its doors, its edges out onto the world map and the world
// map's open cells and places, the Oath-Thorn's pocket — followed as the engine follows it, with every other gate the
// story keeps opened: what is reached is Part One, and only Part Two's fact widens it.

function game() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  return game
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

/** The maps one can come to from `start`, and the world map's cells one walks, with the story's facts as they stand. */
function reach(g: Game, start: string): { maps: Set<string>; cells: Set<string> } {
  const w = g.engine.world
  const open = (f?: string) => !f || !!w.fact(f)
  const sites = new Map<string, string[]>()
  for (const e of Object.values(w.state.entities)) {
    if (!e.type.startsWith('site') || e.place.on !== 'tile' || e.place.map !== OVERWORLD || typeof e.props?.map !== 'string') continue
    const k = `${e.place.x},${e.place.y}`
    sites.set(k, [...(sites.get(k) ?? []), e.props.map])
  }
  const siteOf = (map: string) => w.map(map)?.site
  const maps = new Set<string>()
  const cells = new Set<string>()
  const mapQueue: string[] = []
  const cellQueue: [number, number][] = []
  const toMap = (id: string) => {
    if (maps.has(id)) return
    maps.add(id)
    mapQueue.push(id)
  }
  const toCell = (x: number, y: number) => {
    const k = `${x},${y}`
    if (cells.has(k) || !w.inBounds(OVERWORLD, x, y) || !w.passable(OVERWORLD, x, y)) return
    cells.add(k)
    cellQueue.push([x, y])
  }
  toMap(start)
  while (mapQueue.length || cellQueue.length) {
    while (mapQueue.length) {
      const id = mapQueue.pop()!
      const m = w.map(id)
      // a wilderness is made as it is entered: it leads back onto its own cell
      if (!m) continue
      for (const p of m.portals) if (open(p.opensWhen)) toMap(p.to)
      // the Oath-Thorn, given where the knight fell: into the Held Ground from anywhere
      if (w.fact(CH1.knight)) toMap('haven')
      const site = m.site
      if (site?.map !== OVERWORLD) continue
      // off an edge (engine.ts leaveByEdge): from a cell one can stand on that is no way of the map's own
      const parts = new Set(w.partsOf(id)?.filter((p) => p >= 0))
      for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++) {
          if (x !== 0 && y !== 0 && x !== m.width - 1 && y !== m.height - 1) continue
          if (!w.passable(id, x, y) || m.portals.some((p) => p.x === x && p.y === y)) continue
          if (parts.size <= 1) {
            // onto the place's own cell, or one beside it if it cannot be stood on
            if (w.passable(OVERWORLD, site.x, site.y)) toCell(site.x, site.y)
            else for (const [dx, dy] of STEPS) toCell(site.x + dx, site.y + dy)
            continue
          }
          // a map a barrier parts: only onto a cell beside it that this part's ways lead to
          const part = w.partAt(id, x, y)
          for (const p of m.portals) {
            if (w.partAt(id, p.x, p.y) !== part) continue
            const to = siteOf(p.to)
            if (to?.map === OVERWORLD && Math.abs(to.x - site.x) + Math.abs(to.y - site.y) <= 2) toCell(to.x, to.y)
          }
        }
    }
    while (cellQueue.length) {
      const [x, y] = cellQueue.pop()!
      for (const id of sites.get(`${x},${y}`) ?? []) toMap(id)
      for (const [dx, dy] of STEPS) toCell(x + dx, y + dy)
    }
  }
  return { maps, cells }
}

/** Every gate the story keeps on a way or a place, opened but Part Two's and the untold places'. */
function openTheRest(g: Game): void {
  const w = g.engine.world
  const facts = new Set<string>()
  for (const m of Object.values(w.state.maps)) for (const p of m.portals) if (p.opensWhen) facts.add(p.opensWhen)
  for (const e of Object.values(w.state.entities)) if (typeof e.props?.opensWhen === 'string') facts.add(e.props.opensWhen)
  facts.delete(PART_TWO)
  facts.delete(UNTOLD)
  facts.delete(CH1.knight)
  g.engine.author(() => { for (const f of facts) w.setFact(f, 1) })
}

const PILGRIMS_ROAD = ['waystation', 'waystation.chapel', 'waystation.hostel', 'pilgrimway', 'abbey', 'abbey.hall', 'abbey.crypt', 'kneelfield', 'eastroad', 'kingdom']
const PART_TWO_PLACES = ['emberfall', 'mine', 'pass', 'lair']

describe("release 1's reach (docs/release-1.md §1)", () => {
  it('Part One: the west bank, the Ford and the Pilgrim\'s Road to the knight, the Held Ground once he falls; never Emberfall, the dragon\'s country or the continent past the river, until Part Two opens', () => {
    const g = game()
    const w = g.engine.world
    openTheRest(g)
    // Part Two's: Emberfall and its rooms, its mine, the pass and the lair, and every backdrop place of the continent
    const partTwo = (got: Set<string>) => [...got].filter((id) => PART_TWO_PLACES.includes(id) || id.startsWith('emberfall.') || !!(w.map(id) as { backdrop?: boolean } | undefined)?.backdrop)
    // the world map east of the river: the cells one walks from the Pilgrims' Rest's (the river keeps them apart from
    // the west bank's: overworld.test.ts)
    const rest = w.get('site.waystation')!.place as { x: number; y: number }
    const far = new Set([`${rest.x},${rest.y}`])
    const queue = [[rest.x, rest.y]]
    while (queue.length) {
      const [x, y] = queue.pop()!
      for (const [dx, dy] of STEPS) {
        const k = `${x + dx},${y + dy}`
        if (far.has(k) || !w.inBounds(OVERWORLD, x + dx, y + dy) || !w.passable(OVERWORLD, x + dx, y + dy)) continue
        far.add(k)
        queue.push([x + dx, y + dy])
      }
    }
    expect(far.size).toBeGreaterThan(100)
    const east = (got: Set<string>) => [...got].filter((k) => far.has(k))

    // before the knight: the valley, the Ford, the Pilgrim's Road — and of the world map only the west bank's cells
    const before = reach(g, 'tutorial')
    expect(['meadow', 'ford', 'mill', 'dawnhill', 'barrow', ...PILGRIMS_ROAD].filter((id) => !before.maps.has(id))).toEqual([])
    expect(before.maps.has('haven')).toBe(false)
    expect(partTwo(before.maps)).toEqual([])
    expect(before.cells.size).toBeGreaterThan(10)
    expect(east(before.cells)).toEqual([])

    // past him: the Held Ground besides, and still nothing of Part Two, nor a step on the world map east of the river
    g.engine.author(() => w.setFact(CH1.knight, 1))
    const after = reach(g, 'tutorial')
    expect(after.maps.has('haven')).toBe(true)
    expect([...before.maps].filter((id) => !after.maps.has(id))).toEqual([])
    expect(partTwo(after.maps)).toEqual([])
    expect(east(after.cells)).toEqual([])

    // Part Two opened (the dev console's): the road on east, Emberfall and the dragon's country
    g.engine.author(() => w.setFact(PART_TWO, 1))
    const two = reach(g, 'tutorial')
    expect(PART_TWO_PLACES.filter((id) => !two.maps.has(id))).toEqual([])
  })

  it('an older save that began the Dragon Road before Part Two was sealed behind the knight has it put back, unbegun; with Part Two open it stays', () => {
    const g = game()
    const w = g.engine.world
    const begun = () => g.engine.author(() => { for (const id of ['first_seal', 'crown_home']) g.engine.quests.put(id, 'done'); g.engine.quests.put('dragon_road', 20) })
    begun()
    g.engine.author(() => w.setProp(w.player, 'track', 'quest.dragon_road'))
    g.engine.author(() => migratePartTwo(g))
    expect([w.get('quest.dragon_road'), g.engine.quests.stage('dragon_road'), w.fact('q.dragon_road'), w.player.props?.track]).toEqual([undefined, 0, undefined, undefined])
    expect(g.engine.quests.isDone('crown_home')).toBe(true)
    g.engine.author(() => w.setFact(PART_TWO, 1))
    begun()
    g.engine.author(() => migratePartTwo(g))
    expect(g.engine.quests.stage('dragon_road')).toBe(20)
  })
})
