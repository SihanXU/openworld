// Every map names a tune the client has: a name it does not know plays nothing, and the tune before
// it runs on (the maps once named 'Village' where the client knows 'village').

// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../client/src/catalog.ts'
import { buildFord } from '../src/demo/world.ts'

describe('music', () => {
  it('every map plays a tune the client has', () => {
    const { chunks } = buildFord()
    const tunes = CATALOG.music as Record<string, string>
    expect(chunks.filter((c) => !c.map.music || !tunes[c.map.music]).map((c) => `${c.map.id}: ${c.map.music}`)).toEqual([])
  })
})
