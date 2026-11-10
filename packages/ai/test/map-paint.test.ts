import { describe, expect, it } from 'vitest'
import { compileMapPaint, mapProblems, settleMap, type DraftContext } from '../src/modder/drafts.ts'
import { draftUser } from '../src/modder/prompts.ts'
const ctx: DraftContext = { chars: ['.', '~', 'B', 'T'].map(char => ({ char, terrain: char })), maxSize: [24, 20], things: [{ id: 'fixture/nature/waterfall' }], environment: { palette: ['verdant'], water: ['stream'], fireflies: 'boolean' }, activities: { garden: 'Real crops', crossing: 'Connected banks' } }
const draft = () => ({
  map: { id: 'a_forest', name: 'A forest', width: 24, height: 12, environment: { palette: 'verdant', water: 'stream', fireflies: true },
    paint: { base: '.', strokes: [
      { op: 'rect', char: '~', x: 10, y: 0, w: 2, h: 12 },
      { op: 'path', char: 'B', points: [[9, 6], [12, 6]], width: 1 },
    ] },
  },
  entities: [{ id: 'a_forest.fall', type: 'fixture/nature/waterfall', place: { on: 'tile', map: 'old_id', x: 10, y: 2 } }],
})
describe('bounded map paint compiler', () => {
  it('produces deterministic exact rows and ordered crossings while preserving layout metadata and input', () => {
    const raw = draft(), before = JSON.stringify(raw)
    expect(mapProblems(raw, ctx)).toEqual([])
    const result = compileMapPaint(raw, ctx) as any
    expect(result.map.rows).toHaveLength(12)
    expect(result.map.rows.every((r: string) => r.length === 24)).toBe(true)
    expect(result.map.rows[5].slice(10, 12)).toBe('~~')
    expect(result.map.rows[6].slice(9, 13)).toBe('BBBB')
    expect(result.map.environment).toEqual(raw.map.environment)
    expect(result.entities).toEqual(raw.entities)
    expect(result.map.paint).toBeUndefined()
    expect(JSON.stringify(raw)).toBe(before)
    expect(compileMapPaint(raw, ctx)).toEqual(result)
    const settled = settleMap(raw, ctx) as any
    expect(settled.entities[0].place.map).toBe('a_forest')
    expect(settled.map.rows).toEqual(result.map.rows)
  })
  it.each([
    { op: 'rect', char: '~', x: 23, y: 1, w: 2, h: 1 },
    { op: 'path', char: '~', points: [[0, 0], [24, 5]], width: 1 },
    { op: 'path', char: '~', points: [[0, 0], [1, 1]], width: 7 },
    { op: 'rect', char: '?', x: 1, y: 1, w: 2, h: 1 },
    { op: 'rect', char: '~', x: 1.5, y: 1, w: 2, h: 1 },
    { op: 'script', char: '.', code: 'changeWorld()' },
  ])('rejects invalid data instead of cropping it: %j', bad => {
    const raw: any = draft(); raw.map.paint.strokes = [bad]
    expect(mapProblems(raw, ctx)[0]).toMatch(/^map.paint:/)
  })
  it('bounds stroke count and refuses conflicting rows', () => {
    const raw: any = draft(); raw.map.paint.strokes = Array(65).fill({ op: 'rect', char: '.', x: 1, y: 1, w: 1, h: 1 })
    expect(mapProblems(raw, ctx).join(' ')).toContain('64 strokes')
    raw.map.rows = Array(12).fill('.'.repeat(24))
    expect(mapProblems(raw, ctx).join(' ')).toContain('not both')
  })
  it('never truncates old rows and sends paint/activity/environment instructions to the model', () => {
    const raw = { map: { id: 'legacy', name: 'Legacy', width: 8, height: 8, rows: Array(8).fill('.'.repeat(9)) }, entities: [] }
    expect(mapProblems(raw, ctx)).toHaveLength(8)
    expect((settleMap(raw, ctx) as any).map.rows[0]).toHaveLength(9)
    const prompt = draftUser('map', 'A forest', ctx)
    for (const word of ['paint', 'strokes', 'rect', 'path', 'verdant', 'Connected banks']) expect(prompt).toContain(word)
  })
})
