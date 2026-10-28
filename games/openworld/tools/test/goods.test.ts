import { describe, expect, it } from 'vitest'
import { OntologyIndex, Rng, type Entity } from '@openworld/engine'
import { FORMS, FORM_BY_ID, REGION_GOODS, REGIONS, buildOntology, makeItem } from '@openworld-game/content'
import { BUILDINGS, CATALOG } from '../../client/src/catalog.ts'
import { buildFord } from '../src/demo/world.ts'
import { readContinent } from '../src/demo/overworld.ts'

// The continent's goods and their stock (docs/continent.md §10): about a thousand kinds of thing, from the base forms
// and each region's own; tens of thousands of them kept in the backdrop's houses, shops and chests, by region and
// what a place is; never past what a container holds; none on the played maps.

const world = buildFord()
const onto = new OntologyIndex(buildOntology())
const regional = FORMS.filter((f) => f.origin)
const stockOf = (chunks: { entities: Entity[] }[]) => chunks.flatMap((c) => c.entities).filter((e) => e.type.startsWith('item/'))

describe('the goods (content goods.ts)', () => {
  it('are about a thousand kinds with the base forms, every region its own, each named once in both languages', () => {
    expect(FORMS.length).toBeGreaterThanOrEqual(950)
    expect(FORMS.length).toBeLessThan(1200)
    for (const r of REGIONS) expect([r.id, regional.filter((f) => f.origin === r.id).length > 90]).toEqual([r.id, true])
    expect(Object.keys(REGION_GOODS).sort()).toEqual(REGIONS.map((r) => r.id).sort())
    const twice = (k: (f: (typeof FORMS)[number]) => string) => FORMS.map(k).filter((n, i, all) => all.indexOf(n) !== i)
    expect(twice((f) => f.id)).toEqual([])
    expect(twice((f) => f.en.toLowerCase())).toEqual([])
    expect(twice((f) => f.zh)).toEqual([])
    for (const f of regional) expect([f.id, /[一-鿿]/.test(f.zh), /^[A-Z]/.test(f.en)]).toEqual([f.id, true, true])
  })

  it('each has a picture the client has, and a worth; a named piece three times its base\'s, its gear fine', () => {
    for (const f of FORMS) expect([f.id, !!CATALOG.items[f.sprite]]).toEqual([f.id, true])
    for (const f of regional) {
      const base = onto.resolve(f.base!)
      expect([f.id, Number(onto.resolve(f.id).props.value)]).toEqual([f.id, Math.round(Number(base.props.value) * (f.named ? 3 : 1) * 100) / 100])
      if (f.named && /^item\/(weapon|armor|clothing|tool|valuable)\//.test(f.id)) expect([f.id, onto.resolve(f.id).tags.includes('quality:fine'), JSON.stringify(makeItem(new Rng(1), f).name ?? '').includes('Fine')]).toEqual([f.id, true, false])
    }
  })

  it('a piece whose name says what it is made of is of that alone, and not named for it twice', () => {
    const bow = FORM_BY_ID['item/weapon/ranged/bow/frostfang_pine_longbow']
    expect(bow.materials).toEqual(['wood'])
    const it = makeItem(new Rng(3), bow, { quality: 'common', element: null })
    expect(it.name).toBeUndefined()
    expect(it.tags).toContain('material:wood')
    const line = makeItem(new Rng(3), FORM_BY_ID['item/weapon/blade/sword/palefen_fenland_sword'], { material: 'iron', quality: 'common' })
    expect(line.name).toEqual({ en: 'Iron Fenland Sword', zh: '铁苍沼剑' })
  })

  it('none is laid on the played maps: the Ford rolls what it rolled before', () => {
    expect(regional.every((f) => !Object.keys(f.where ?? {}).length)).toBe(true)
    expect(stockOf(world.chunks).filter((e) => FORM_BY_ID[e.type]?.origin)).toEqual([])
  })
})

describe('the backdrop\'s stock (tools/src/demo/continent/stock.ts)', () => {
  const items = stockOf(world.backdrop)

  it('holds tens of thousands of things, of most of the kinds, every region its own goods most', () => {
    expect(items.length).toBeGreaterThan(20_000)
    expect(new Set(items.map((e) => e.type)).size).toBeGreaterThan(600)
    for (const r of REGIONS) {
      const here = world.backdrop.filter((c) => c.map.region === r.id).flatMap((c) => c.entities).filter((e) => e.type.startsWith('item/'))
      const own = here.filter((e) => FORM_BY_ID[e.type]?.origin === r.id).length
      const others = here.filter((e) => FORM_BY_ID[e.type]?.origin && FORM_BY_ID[e.type].origin !== r.id).length
      expect([r.id, here.length > 1000, own > others]).toEqual([r.id, true, true])
      // only the Holy City keeps the other regions' goods (the pilgrims bring them)
      if (r.id !== 'holy') expect([r.id, others]).toEqual([r.id, 0])
    }
  })

  it('every settlement\'s houses keep their stores, and no container holds more kinds than it has slots', () => {
    const c = readContinent()
    const byId = new Map(world.backdrop.map((ch) => [ch.map.id, ch]))
    for (const p of c.places.filter((x) => ['village', 'town', 'city'].includes(x.kind))) {
      const ch = byId.get(p.id)!
      // (a building of the project's own is many strips, `<name>@<row>`: one house, if it has a door — a showcase's street)
      const own = new Set((ch.map.stamps ?? []).filter((s) => s.key.includes('@') && !s.key.endsWith('@shadow') && BUILDINGS[s.key.split('@')[0]].doors.length).map((s) => {
        const [name, row] = s.key.split('@')
        const sl = BUILDINGS[name].slices.find((x) => x.row === Number(row))!
        return `${name} ${s.x - sl.col},${s.y - Number(row) + sl.th - 1}`
      }))
      const houses = (ch.map.stamps ?? []).filter((s) => !/^(rail|stonewall|fence)/.test(s.key) && !s.key.includes('@')).length + own.size
      // (a house's stores are in the room behind its door, phase B: the place's map and its rooms together)
      const maps = [ch, ...world.backdrop.filter((r) => r.map.kind === 'interior' && r.map.id.startsWith(`${p.id}.`))]
      const stores = maps.flatMap((m) => m.entities.filter((e) => e.place.on === 'tile' && e.type.startsWith('fixture/container/') && m.entities.some((i) => i.place.on === 'inside' && i.place.holder === e.id)))
      expect([p.id, stores.length >= houses]).toEqual([p.id, true])
    }
    const over: string[] = []
    for (const ch of world.backdrop) {
      const inside = new Map<string, Set<string>>()
      for (const e of ch.entities) if (e.place.on === 'inside') {
        const k = `${e.type}|${JSON.stringify(e.name ?? '')}|${[...(e.tags ?? [])].sort().join(',')}`
        inside.set(e.place.holder, (inside.get(e.place.holder) ?? new Set()).add(k))
      }
      for (const box of ch.entities) {
        const cap = Number(box.props?.capacity ?? onto.resolve(box.type).props.capacity ?? 0)
        const n = inside.get(box.id)?.size ?? 0
        if (cap && n > cap) over.push(`${ch.map.id} ${box.id} ${box.type}: ${n} > ${cap}`)
      }
    }
    expect(over).toEqual([])
  })

  it('a place keeps what it is for: a smithy arms, a larder food, a temple its books and candles, the dark finer things', () => {
    const inBox = (type: string) => world.backdrop.flatMap((ch) => {
      const boxes = new Set(ch.entities.filter((e) => e.type === type).map((e) => e.id))
      return ch.entities.filter((e) => e.place.on === 'inside' && boxes.has(e.place.holder))
    })
    const share = (xs: Entity[], p: RegExp) => xs.filter((e) => p.test(e.type)).length / Math.max(1, xs.length)
    expect(share(inBox('fixture/container/barrel'), /^item\/(food|material|seed)\//)).toBe(1)
    expect(share(inBox('fixture/container/bookshelf'), /^item\/(document|armor\/tome|misc\/(ink|feather_quill))/)).toBe(1)
    const fine = (xs: Entity[]) => xs.filter((e) => e.tags?.some((t) => t === 'quality:fine' || t === 'quality:masterwork' || t === 'quality:vowed')).length / Math.max(1, xs.length)
    const dark = world.backdrop.filter((ch) => ch.map.zone === 'combat').flatMap((ch) => ch.entities.filter((e) => e.place.on === 'inside'))
    const homes = world.backdrop.filter((ch) => ch.map.kind === 'village').flatMap((ch) => ch.entities.filter((e) => e.place.on === 'inside'))
    expect(fine(dark)).toBeGreaterThan(fine(homes))
  })
})
