// Frames as what changed (docs/continent.md §9): a map with thousands of things (the overworld's places) would send
// every one of them ten times a second. The worker sends a thing only when it differs from what it last sent, and the
// ids of those no longer in the frame; the page puts the frame back together before anything reads it. A frame on a
// new map, and now and then one anyway, carries everything (a key frame).

import type { EntitySnap, Frame, Id } from '@openworld/engine'

/** A key frame at least this often (frames). */
const KEY_EVERY = 100

/** The worker's side: what it last sent of each thing. */
export class FrameEncoder {
  private sent = new Map<Id, string>()
  private map = ''
  private n = 0

  /** The frame as sent: its things only where changed (`gone`: the ids left out since), or whole (no `gone`). */
  encode(f: Frame): { frame: Frame; gone?: Id[] } {
    const key = f.map !== this.map || ++this.n >= KEY_EVERY
    const now = new Map<Id, string>()
    const changed: EntitySnap[] = []
    for (const e of f.entities) {
      const s = JSON.stringify(e)
      now.set(e.id, s)
      if (key || this.sent.get(e.id) !== s) changed.push(e)
    }
    const gone = key ? undefined : [...this.sent.keys()].filter((id) => !now.has(id))
    this.sent = now
    if (key) {
      this.map = f.map
      this.n = 0
      return { frame: f }
    }
    return { frame: { ...f, entities: changed }, gone }
  }

  /** Start again (a new game, a load): the next frame is a key frame. */
  reset(): void {
    this.sent.clear()
    this.map = ''
  }
}

/** The page's side: every thing of the frame, as last told. */
export class FrameDecoder {
  private all = new Map<Id, EntitySnap>()

  /** The whole frame: a key frame as it is, a frame of changes laid over the last. */
  decode(f: Frame, gone?: Id[]): Frame {
    if (!gone) {
      this.all = new Map(f.entities.map((e) => [e.id, e]))
      return f
    }
    for (const id of gone) this.all.delete(id)
    for (const e of f.entities) this.all.set(e.id, e)
    return { ...f, entities: [...this.all.values()] }
  }
}
