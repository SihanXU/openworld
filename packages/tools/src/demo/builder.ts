// A small authoring DSL for hand-crafted maps: terrain painting, prefab stamps (houses),
// room frames, fixtures, items, creatures and portals — emitted as engine chunks.

import type { AiData, Entity, Portal, PropValue, Text } from '@lsw/engine'
import { CHAR_OF, FORM_BY_ID, makeItem, type RawChunk } from '@lsw/content'
import { Rng } from '@lsw/engine'
import type { PrefabDef } from '../../../client/src/assets/types.ts'

export const rng = new Rng(4242)

export type ItemSpec = string | { form: string; material?: string; quality?: string; element?: string | null; name?: Text; tags?: string[]; props?: Record<string, PropValue> }

export class MapBuilder {
  cells: string[][]
  portals: Portal[] = []
  entities: Entity[] = []
  stamps: { key: string; x: number; y: number }[] = []
  rooms: { style: string; x: number; y: number; w: number; h: number }[] = []
  private seq = 0
  /** Door tiles of stamped prefabs, by a name the author chooses. */
  doors: Record<string, [number, number]> = {}

  constructor(
    public id: string,
    public name: Text,
    public kind: string,
    public w: number,
    public h: number,
    fill = 'grass',
    public music?: string,
    public light: 'outdoor' | 'indoor' | 'dark' = 'outdoor',
    public region = 'frostfang',
  ) {
    this.cells = Array.from({ length: h }, () => Array(w).fill(fill))
  }

  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }
  get(x: number, y: number) {
    return this.in(x, y) ? this.cells[y][x] : 'void'
  }
  set(x: number, y: number, t: string) {
    if (this.in(x, y)) this.cells[y][x] = t
  }
  rect(x: number, y: number, w: number, h: number, t: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t)
  }
  /** Filled ellipse. */
  blob(cx: number, cy: number, rx: number, ry: number, t: string, only?: (cur: string) => boolean) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry)
        if (d <= 1 && (!only || only(this.get(x, y)))) this.set(x, y, t)
      }
  }
  border(t: string, thick = 2, gaps: [number, number, number, number][] = []) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const edge = x < thick || y < thick || x >= this.w - thick || y >= this.h - thick
        if (!edge) continue
        if (gaps.some(([gx, gy, gw, gh]) => x >= gx && x < gx + gw && y >= gy && y < gy + gh)) continue
        this.set(x, y, t)
      }
  }
  /** Horizontal-then-vertical road. */
  road(ax: number, ay: number, bx: number, by: number, t = 'path', width = 1, over?: (cur: string) => boolean) {
    const put = (x: number, y: number) => {
      for (let d = 0; d < width; d++) {
        for (const [px, py] of [[x + d, y], [x, y + d]]) if (!over || over(this.get(px, py))) this.set(px, py, t)
      }
    }
    let x = ax
    let y = ay
    while (x !== bx) (put(x, y), (x += Math.sign(bx - x)))
    while (y !== by) (put(x, y), (y += Math.sign(by - y)))
    put(bx, by)
  }
  /** Scatter terrain in a rect with probability p onto cells passing `only`. */
  scatter(x: number, y: number, w: number, h: number, t: string, p: number, only: (cur: string) => boolean = (c) => c === 'grass') {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (only(this.get(i, j)) && rng.chance(p)) this.set(i, j, t)
  }

  /** Stamp a prefab with its top-left at (x,y); solid cells become its terrain, the door 'door'. */
  prefab(key: string, def: PrefabDef, x: number, y: number, doorName?: string) {
    this.stamps.push({ key, x, y })
    def.grid.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c === '#') this.set(x + i, y + j, def.terrain ?? 'wall')
        if (c === 'D') {
          this.set(x + i, y + j, 'door')
          if (doorName) this.doors[doorName] = [x + i, y + j]
        }
      }),
    )
  }

  /** An interior room: walls on the frame, floor inside, a door in the bottom wall. */
  room(style: string, floor: string, doorX?: number) {
    this.rect(0, 0, this.w, this.h, 'wall')
    this.rect(1, 1, this.w - 2, this.h - 2, floor)
    this.rooms.push({ style, x: 0, y: 0, w: this.w, h: this.h })
    const dx = doorX ?? Math.floor(this.w / 2)
    this.set(dx, this.h - 1, 'door')
    this.doors.out = [dx, this.h - 1]
  }

  newId(prefix = '') {
    return `${this.id}~${prefix}${(++this.seq).toString(36)}`
  }

  fixture(type: string, x: number, y: number, extra: Partial<Entity> = {}, contents: ItemSpec[] = []): Entity {
    const e: Entity = { id: extra.id ?? this.newId(), type, place: { on: 'tile', map: this.id, x, y }, ...extra }
    this.entities.push(e)
    for (const it of contents) this.entities.push({ ...this.makeItem(it), id: this.newId('i'), place: { on: 'inside', holder: e.id } })
    return e
  }

  makeItem(spec: ItemSpec): Omit<Entity, 'id' | 'place'> {
    const s = typeof spec === 'string' ? { form: spec } : spec
    const form = FORM_BY_ID[s.form]
    if (!form) throw new Error(`unknown item form ${s.form}`)
    const it = makeItem(rng, form, { material: s.material, quality: s.quality ?? 'common', element: s.element === undefined ? null : s.element })
    if (s.name) it.name = s.name
    if (s.tags) it.tags = [...(it.tags ?? []), ...s.tags]
    if (s.props) it.props = { ...(it.props ?? {}), ...s.props }
    return it
  }

  item(spec: ItemSpec, x: number, y: number): Entity {
    const e: Entity = { ...this.makeItem(spec), id: this.newId('i'), place: { on: 'tile', map: this.id, x, y } }
    this.entities.push(e)
    return e
  }

  creature(kind: string, x: number, y: number, opts: Partial<AiData> & { id?: string; loot?: ItemSpec[] } = {}): Entity {
    const ranged = ['imp/fire_imp', 'wisp/storm_wisp', 'undead/ghost'].includes(kind)
    const e: Entity = {
      id: opts.id ?? this.newId('c'),
      type: `actor/creature/${kind}`,
      place: { on: 'tile', map: this.id, x, y },
      facing: 'down',
      ai: {
        behaviour: opts.behaviour ?? (ranged ? 'ranged' : 'melee'),
        hostile: opts.hostile ?? true,
        sight: opts.sight ?? 5,
        home: { map: this.id, x, y },
      },
    }
    this.entities.push(e)
    for (const it of opts.loot ?? []) this.entities.push({ ...this.makeItem(it), id: this.newId('i'), place: { on: 'inside', holder: e.id } })
    return e
  }

  /** One-way portal tile. */
  portal(x: number, y: number, to: string, tx: number, ty: number, label?: Text) {
    this.portals.push({ x, y, to, tx, ty, label })
  }

  /** Two-way link between a door here and the interior's door (arrive one tile inside/outside). */
  linkInterior(doorName: string, interior: MapBuilder) {
    const [x, y] = this.doors[doorName]
    const [ix, iy] = interior.doors.out
    this.portal(x, y, interior.id, ix, iy - 1, interior.name)
    interior.portal(ix, iy, this.id, x, y + 1, this.name)
  }

  chunk(): RawChunk {
    const rows = this.cells.map((r) =>
      r
        .map((t) => {
          const c = CHAR_OF[t]
          if (!c) throw new Error(`${this.id}: terrain ${t} has no char`)
          return c
        })
        .join(''),
    )
    return {
      map: {
        id: this.id,
        name: this.name,
        region: this.region,
        kind: this.kind,
        width: this.w,
        height: this.h,
        rows,
        portals: this.portals,
        stamps: this.stamps,
        rooms: this.rooms,
        music: this.music,
        light: this.light,
      },
      entities: this.entities,
    }
  }
}

/** Link two outdoor maps through edge openings of equal width (tiles listed in order). */
export function linkEdge(a: MapBuilder, aCells: [number, number][], aIn: [number, number], b: MapBuilder, bCells: [number, number][], bIn: [number, number]) {
  aCells.forEach(([x, y], i) => a.portal(x, y, b.id, bCells[i][0] + bIn[0], bCells[i][1] + bIn[1], b.name))
  bCells.forEach(([x, y], i) => b.portal(x, y, a.id, aCells[i][0] + aIn[0], aCells[i][1] + aIn[1], a.name))
}
