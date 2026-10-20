// The service names its shared log (GET /patches `log`). A log made anew (the service started again on fresh data)
// is synced from its start, though it has already grown past where the stored library stood; a service that names
// none is synced as before.

import { describe, expect, it } from 'vitest'
import type { LibraryData } from '@openworld/engine'
import { LogPosition } from '../src/learned.ts'

const URL = 'http://m'
const lib: LibraryData = { rules: [], types: [], statuses: [], log: [], version: 3 }

/** A page loaded again: the library stored by the last one, and the position the main thread stored after it. */
function reload(before: LogPosition, seq = before.seq): LogPosition {
  const stored = before.stamp(lib)
  const at = new LogPosition()
  at.begin(URL, seq, structuredClone(stored))
  return at
}

describe('the shared log sync', () => {
  it('starts again from 0 when the service names another log, though that one has grown past the position', () => {
    const at = new LogPosition()
    at.begin(URL, 0)
    expect(at.restarts({ seq: 5, log: 'A' })).toBe(false)
    at.advance({ seq: 5, log: 'A' })
    // the service started again on fresh data: its log B is at 9 by the time the page loads again
    const next = reload(at)
    expect(next.seq).toBe(5)
    expect(next.restarts({ seq: 9, log: 'B' })).toBe(true)
    expect(next.seq).toBe(0)
    // from 0 in the new log, which is then the one the position counts in
    expect(next.restarts({ seq: 9, log: 'B' })).toBe(false)
    expect(next.advance({ seq: 9, log: 'B' })).toBe(true)
    expect(reload(next).log).toBe('B')
  })

  it('goes on in the same log', () => {
    const at = new LogPosition()
    at.begin(URL, 0)
    at.advance({ seq: 5, log: 'A' })
    const next = reload(at)
    expect(next.restarts({ seq: 7, log: 'A' })).toBe(false)
    expect(next.advance({ seq: 7, log: 'A' })).toBe(false)
    expect(next.seq).toBe(7)
  })

  it('keeps the old way with a service that names no log: only a shorter log is another one', () => {
    const at = new LogPosition()
    at.begin(URL, 5)
    expect(at.restarts({ seq: 9 })).toBe(false)
    at.advance({ seq: 9 })
    expect(at.stamp(lib)).toBe(lib)
    expect(at.restarts({ seq: 3 })).toBe(true)
    expect(at.seq).toBe(0)
  })

  it("never goes on past the position the library was stamped at, nor from another service's", () => {
    const at = new LogPosition()
    at.begin(URL, 0)
    at.advance({ seq: 5, log: 'A' })
    // the main thread's position stored further on than the library it goes with (stored apart)
    expect(reload(at, 8).seq).toBe(5)
    const other = new LogPosition()
    other.begin('http://other', 4, at.stamp(lib))
    expect([other.seq, other.log]).toEqual([4, undefined])
  })
})
