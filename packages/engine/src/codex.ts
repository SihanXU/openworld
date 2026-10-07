// The codex (图鉴): what the player has come to know of the world's things — every kind of item
// they have carried, every person and every kind of creature they have seen near them. It is the
// reader's record, kept beside the world's state (not in it, never an outcome), and saved with the
// game like the library. Which entries there are is the world's content (`WorldIndex.codex`, the
// people of `npcs` and `companions`); the codex only marks the ones met.

import type { Entity, Id, PropValue, Text } from './types.ts'
import type { World } from './world.ts'
import type { WorldIndex } from './game.ts'

/** How near (tiles, on the same map) a person or a creature must come to be seen. */
export const CODEX_SIGHT = 6

export interface CodexData {
  items: string[]
  people: Id[]
  creatures: string[]
}

/** One entry as the codex panel shows it (a known one with its name and picture, else a shadow). */
export interface CodexEntry {
  id: string
  name: Text
  /** Render key (an item's or a creature's sprite). */
  sprite?: string
  /** A person's look (their portrait) and type (their role picks a look when they have none). */
  look?: string
  type?: string
  known: boolean
  /** An item's kind (`weapon`, `food` … the second step of its type). */
  group?: string
  /** What the panel lists beside a known entry: a creature's hp, attack and defence; a person's map. */
  stats?: Record<string, PropValue>
  where?: Text
}

export interface CodexView {
  items: CodexEntry[]
  people: CodexEntry[]
  creatures: CodexEntry[]
}

export class Codex {
  items = new Set<string>()
  people = new Set<Id>()
  creatures = new Set<string>()
  /** Bumped whenever an entry is first met (the panel re-reads then). */
  version = 0

  static from(d?: CodexData): Codex {
    const c = new Codex()
    for (const x of d?.items ?? []) c.items.add(x)
    for (const x of d?.people ?? []) c.people.add(x)
    for (const x of d?.creatures ?? []) c.creatures.add(x)
    return c
  }

  toJSON(): CodexData {
    return { items: [...this.items], people: [...this.people], creatures: [...this.creatures] }
  }

  private add(set: Set<string>, id: string): void {
    if (set.has(id)) return
    set.add(id)
    this.version++
  }

  /** Mark what the player carries and who and what stands near them now. */
  record(w: World): void {
    const p = w.player
    const pos = p && w.posOf(p)
    if (!pos) return
    // carried: the bag and the hands, and whatever is inside those
    const carried = (holder: Id, depth: number): void => {
      if (depth > 3) return
      for (const e of Object.values(w.state.entities)) {
        if ((e.place.on !== 'inside' && e.place.on !== 'hand') || e.place.holder !== holder) continue
        if (e.type.startsWith('item/')) this.add(this.items, e.type)
        if (e.contents?.length) carried(e.id, depth + 1)
      }
    }
    carried(p.id, 0)
    for (const e of w.entitiesOnMap(pos.map)) {
      if (e.id === p.id || !e.type.startsWith('actor/')) continue
      const q = w.posOf(e)
      if (!q || Math.max(Math.abs(q.x - pos.x), Math.abs(q.y - pos.y)) > CODEX_SIGHT) continue
      if (e.type.startsWith('actor/creature/')) this.add(this.creatures, e.type)
      else this.add(this.people, e.id)
    }
  }

  /** Every entry of the world's codex, the met ones marked. */
  view(w: World, index: WorldIndex): CodexView {
    // a type's name, or its nearest ancestor's
    const nameOf = (type: string): Text => {
      for (let t = type; t; t = t.slice(0, Math.max(0, t.lastIndexOf('/')))) {
        const n = w.onto.data.types[t]?.name
        if (n) return n
      }
      return { en: type.split('/').pop() ?? type }
    }
    const mapName = (e: Entity): Text | undefined => {
      const m = e.place.on === 'tile' ? e.place.map : undefined
      return m ? index.maps.find((x) => x.id === m)?.name : undefined
    }
    const items = (index.codex?.items ?? []).map((type): CodexEntry => {
      const t = w.onto.resolve(type)
      return { id: type, name: nameOf(type), sprite: t.sprite ?? type, known: this.items.has(type), group: type.split('/')[1] }
    })
    const people = [...(index.companions ?? []), ...index.npcs].map((n): CodexEntry => {
      const live = w.get(n.id) ?? n
      return { id: n.id, name: live.name ?? n.name ?? { en: n.id }, look: n.look, type: n.type, sprite: w.onto.resolve(n.type).sprite, known: this.people.has(n.id), where: mapName(n) }
    })
    const creatures = (index.codex?.creatures ?? []).map((type): CodexEntry => {
      const t = w.onto.resolve(type)
      const pr = t.props
      return { id: type, name: nameOf(type), sprite: t.sprite ?? type, known: this.creatures.has(type), stats: { hp: pr.maxHp ?? pr.hp ?? 0, atk: pr.atk ?? 0, def: pr.def ?? 0 } }
    })
    return { items, people, creatures }
  }
}
