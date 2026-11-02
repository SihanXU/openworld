import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { setPowersOf, vowsOf } from '@openworld/modules'
import { BASE_RULES, BOSSES, FORM_BY_ID, MAIN_GEAR_SETS, MAIN_SETS, QUESTS, SET_PIECES, SET_POWERS, STORY_RULES, buildOntology, decodeChunk, piecesOnMap } from '@openworld-game/content'
import { CATALOG } from '../../client/src/catalog.ts'
import { SET_SPOTS } from '../src/demo/sets/index.ts'
import { buildFord } from '../src/demo/world.ts'

// The main line's sets (docs/sets.md): at least thirty, spread over the chapters; every piece a type of its own with its
// words and its picture, found in the world where its set's file says; worn together, a set's numbers and its power.

const onto = buildOntology()
const ART = fileURLToPath(new URL('../../public/assets/', import.meta.url))

describe('the main line\'s sets (docs/sets.md)', () => {
  it('there are at least thirty, and every chapter has its own: four at the least, the two across the line beside them', () => {
    expect(MAIN_SETS.length).toBeGreaterThanOrEqual(30)
    for (const ch of ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'fin'] as const) expect(MAIN_SETS.filter((s) => s.chapter === ch).length, ch).toBeGreaterThanOrEqual(4)
    // a chapter's sets are of its levels: the later the chapter, the higher
    const levels = (ch: string) => MAIN_SETS.filter((s) => s.chapter === ch).map((s) => s.level)
    const order = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'fin']
    for (let i = 1; i < order.length; i++) expect(Math.min(...levels(order[i])), order[i]).toBeGreaterThanOrEqual(Math.max(...levels(order[i - 1])) - 3)
    // and every profession is served in every chapter (a set leaning its way, or one for anyone)
    for (const ch of order) for (const lean of ['assassin', 'warrior', 'ranger', 'mage']) expect(MAIN_SETS.some((s) => s.chapter === ch && (s.lean === lean || s.lean === 'any')), `${ch} ${lean}`).toBe(true)
  })

  it('every piece is a type of its own: its slot its form\'s, one to a slot in its set, its words in both languages, its picture drawn', () => {
    const types = new Set<string>()
    for (const p of SET_PIECES) {
      expect(types.has(p.type), p.type).toBe(false)
      types.add(p.type)
      expect(onto.types[p.type], p.type).toBeDefined()
      expect(FORM_BY_ID[p.piece.form]?.props?.slot, `${p.type}: its form's slot`).toBe(p.piece.slot)
      expect(p.piece.text.length, p.type).toBeGreaterThan(40)
      expect(p.piece.textZh.length, p.type).toBeGreaterThan(15)
      expect(CATALOG.items[p.sprite], `${p.type}: ${p.sprite}`).toBeDefined()
      expect(existsSync(`${ART}lsw/Items/Sets/${p.set.id}/${p.piece.slot}.png`), `${p.type}: its picture`).toBe(true)
      expect(Number(p.props.level), p.type).toBeGreaterThanOrEqual(1)
    }
    for (const s of MAIN_SETS) expect(new Set(s.pieces.map((p) => p.slot)).size, s.id).toBe(s.pieces.length)
  })

  it('every bonus says what it gives, and every power it grants is one the world knows', () => {
    for (const s of MAIN_GEAR_SETS) {
      expect(s.bonuses.length, s.id).toBeGreaterThanOrEqual(2)
      for (const b of s.bonuses) {
        expect(b.pieces, s.id).toBeLessThanOrEqual(s.pieces)
        expect(typeof b.text === 'object' && b.text.en.length > 3 && (b.text.zh ?? '').length > 2, s.id).toBe(true)
        if (b.power) expect(SET_POWERS[b.power], `${s.id}: ${b.power}`).toBeDefined()
      }
    }
    // every set power is worn by some set
    for (const id of Object.keys(SET_POWERS)) expect(MAIN_GEAR_SETS.some((s) => s.bonuses.some((b) => b.power === id)), id).toBe(true)
  })

  it('every piece is found where its set\'s file says: on a map\'s bones or in its chest, in a person\'s stock, in a quest\'s reward, from a boss', () => {
    const { index, chunks } = buildFord()
    const things = chunks.flatMap((c) => (c.entities ?? []).map((e) => ({ map: c.map.id, e: e as Entity })))
    const byId = new Map(things.map((t) => [t.e.id, t]))
    for (const p of SET_PIECES) {
      const [kind, where] = [p.piece.from.slice(0, p.piece.from.indexOf(':')), p.piece.from.slice(p.piece.from.indexOf(':') + 1)]
      if (kind === 'map') {
        const found = things.find((t) => t.map === where && t.e.type === p.type)
        expect(found, `${p.type} on ${where}`).toBeDefined()
        // it lies in something one opens (a pilgrim's bones, a chest) on that map
        const holder = found!.e.place.on === 'inside' ? byId.get(found!.e.place.holder) : undefined
        expect(holder?.map, `${p.type}: held on ${where}`).toBe(where)
      } else if (kind === 'npc') {
        const npc = index.npcs.find((n) => n.id === where)
        expect(String(npc?.props?.stock ?? ''), `${p.type} sold by ${where}`).toContain(p.type)
      } else if (kind === 'quest') {
        const q = QUESTS.find((x) => x.id === where)
        expect(q, where).toBeDefined()
        expect(q!.stages.some((s) => s.reward?.items?.some((it) => it.type === p.type)), `${p.type} paid by ${where}`).toBe(true)
      } else if (kind === 'boss') {
        const boss = BOSSES.find((b) => b.id === where)
        expect(onto.types[boss!.type].props?.trophy, `${p.type} dropped by ${where}`).toBe(p.type)
        expect(onto.types[boss!.type].props?.trophyChance).toBe(1)
      } else throw new Error(`${p.type}: from ${p.piece.from}`)
    }
    // and every map that holds pieces has a spot for each, no more
    for (const [map, spots] of Object.entries(SET_SPOTS)) expect(spots.length, map).toBe(piecesOnMap(map).length)
  }, 240_000)

  it('worn together, a set gives its numbers as its pieces reach them (one to a slot), its vow and its power, and at night what it gives then', () => {
    const { index, chunks } = buildFord()
    const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) g.loadChunk(decodeChunk(c))
    const eng = g.engine, w = eng.world, p = w.player
    const wear = (types: string[]) =>
      eng.author(() => {
        for (const k of Object.keys(p.props ?? {})) if (k.startsWith('wear:')) w.setProp(p, k, undefined)
        for (const t of types) {
          const it = w.create(t, { on: 'inside', holder: p.id })
          w.setProp(p, `wear:${w.prop(it, 'slot')}`, it.id)
        }
      })
    const set = (id: string) => MAIN_GEAR_SETS.find((s) => s.id === id)!
    const pieces = (id: string) => SET_PIECES.filter((x) => x.set.id === id).map((x) => x.type)
    // the Watch: none worn, then two (its first bonus), then all six (its vow)
    wear([])
    const bare = w.stat(p, 'def')
    wear(pieces('watch').slice(0, 2))
    const two = pieces('watch').slice(0, 2).reduce((n, t) => n + Number(onto.types[t].props?.def ?? 0), 0)
    expect(w.stat(p, 'def')).toBe(bare + two + set('watch').bonuses[0].props.def)
    expect(vowsOf(w, p).has('holdfast')).toBe(false)
    wear(pieces('watch'))
    expect(vowsOf(w, p).has('holdfast')).toBe(true)
    // the Vigil's night: its two pieces' night defence counts only after dark
    wear(pieces('vigil').slice(0, 2))
    const night = set('vigil').bonuses[0].props['night:def']
    const day = w.stat(p, 'def')
    eng.author(() => (w.isNight = () => true))
    expect(w.stat(p, 'def')).toBeGreaterThanOrEqual(day + night)
    // the Five Seals: all five give the Night Kept, its own power
    wear(pieces('fiveseals'))
    expect(setPowersOf(w, p).has('nightkept')).toBe(true)
    wear(pieces('fiveseals').slice(0, 4))
    expect(setPowersOf(w, p).has('nightkept')).toBe(false)
  }, 240_000)
})
