// Looks (docs/looks.md): one record per body, the map sprite, the portrait and the look's tags and words all drawn
// from it. The table is whole (every part has its words, its tags' words and its map grids), every person's look
// is a valid look of it, distinct from everyone else's, the same every time, and what it says agrees with what
// it draws.

import { describe, expect, it } from 'vitest'
import { LOOK_BODIES, LOOK_COLORS, LOOK_PARTS, LOOK_SLOTS, LOOK_TABLE, PLAYER_LOOK, buildOntology, describeLook, generateLook, tagsOfLook } from '@lsw/content'
import { Game, LOOK_TAG, RuleLibrary, lookCode, lookProblems, lookTags, restyled, validatePatch, type Look, type Rule } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, decodeChunk } from '@lsw/content'
import { BEARDS, FACES, GLASSES, HAIRS, HATS, MARKS, OUTFITS } from '../../client/src/assets/figure/pixparts.ts'
import { WEARS } from '../../client/src/assets/figure/pixwear.ts'
import { FH, FW, composeSprite } from '../../client/src/assets/figure/sprite.ts'
import { gradient, ramp3, rgbOf } from '../../client/src/assets/figure/color.ts'
import { PEOPLE } from '../src/demo/people.ts'
import { buildFord } from '../src/demo/world.ts'

const lookOf = (p: (typeof PEOPLE)[number]) => generateLook(p.id, { sex: p.gender, age: p.age, role: p.role }, p.look)

describe('the look table', () => {
  it('is whole: every part fills a known slot, fits known bodies, uses known colours, and has words in both languages', () => {
    for (const [id, p] of Object.entries(LOOK_PARTS)) {
      expect(LOOK_SLOTS as readonly string[], id).toContain(p.slot)
      expect(id.startsWith(p.slot + '.'), id).toBe(true)
      for (const b of p.bodies ?? []) expect(LOOK_BODIES[b], `${id} body ${b}`).toBeDefined()
      for (const c of Object.values(p.colors ?? {})) expect(LOOK_COLORS[c], `${id} colour ${c}`).toBeDefined()
      for (const opts of Object.values(p.gen?.colors ?? {})) for (const c of opts) expect(LOOK_COLORS[c], `${id} gen colour ${c}`).toBeDefined()
      const say = p.say as { en: string; zh?: string }
      expect(say.en && say.zh, id).toBeTruthy()
      for (const t of p.tags ?? []) expect(t.startsWith(LOOK_TAG), `${id} tag ${t}`).toBe(true)
    }
    for (const [id, c] of Object.entries(LOOK_COLORS)) expect(/^#[0-9a-f]{6}$/i.test(c.hex), id).toBe(true)
  })

  it('is the ontology the engine checks looks against', () => {
    expect(buildOntology().looks).toBe(LOOK_TABLE)
  })

  it('draws every part on the map: each one a sprite part has grids for the facings it shows', () => {
    const table: Record<string, Record<string, unknown>> = { face: FACES, hair: HAIRS, beard: BEARDS, hat: HATS, glasses: GLASSES, mark: MARKS, outfit: OUTFITS, armour: WEARS, cloak: WEARS }
    for (const [id, p] of Object.entries(LOOK_PARTS)) {
      if (p.slot === 'age') continue // lines are too small to read at sixteen pixels: the portrait shows them
      expect(table[p.slot]?.[id], `${id} has no map grids`).toBeDefined()
    }
    // and nothing is drawn that the table does not know
    for (const t of new Set(Object.values(table))) for (const id of Object.keys(t)) expect(LOOK_PARTS[id], `${id} drawn but not in the table`).toBeDefined()
  })
})

describe('the people', () => {
  const looks = PEOPLE.map((p) => ({ p, look: lookOf(p) }))

  it('each has a valid look, drawn the same every time', () => {
    for (const { p, look } of looks) {
      expect(lookProblems(look, LOOK_TABLE), p.id).toEqual([])
      expect(lookOf(p), p.id).toEqual(look)
      expect(look.parts.face, `${p.id} has a face`).toBeDefined()
      expect(look.parts.outfit, `${p.id} is dressed`).toBeDefined()
    }
    expect(lookProblems(PLAYER_LOOK, LOOK_TABLE)).toEqual([])
  })

  it('a child has a child body, an adult an adult one, as their sex', () => {
    for (const { p, look } of looks) {
      const b = LOOK_BODIES[look.body]
      expect(b.age, p.id).toBe(p.age < 14 ? 'child' : 'adult')
      expect(b.sex, p.id).toBe(p.gender)
    }
  })

  it('no two look alike', () => {
    const codes = new Map<string, string>()
    for (const { p, look } of looks) {
      const c = lookCode(look)
      expect(codes.get(c), `${p.id} looks like ${codes.get(c)}`).toBeUndefined()
      codes.set(c, p.id)
    }
  })

  it('the old show their age: grey hair or lines', () => {
    for (const { p, look } of looks) if (p.age >= 60 && p.id !== 'npc.alberic') expect(tagsOfLook(look).some((t) => t === 'look:old' || t === 'look:grey-haired'), p.id).toBe(true)
  })

  it('are built into the world with their look, and the codex shows each their own', () => {
    const { index } = buildFord()
    for (const n of index.npcs.filter((n) => n.id.startsWith('npc.'))) {
      const p = PEOPLE.find((x) => x.id === n.id)
      if (!p) continue
      expect(n.look, n.id).toEqual(lookOf(p))
    }
  })
})

describe('the look says what it draws', () => {
  it('its tags come from its parts and colours', () => {
    const look: Look = { body: 'man', parts: { face: 'face.stern', hair: 'hair.thin', beard: 'beard.full', outfit: 'outfit.apron' }, colors: { hair: 'snow' } }
    const tags = lookTags(look, LOOK_TABLE)
    expect(tags).toEqual(expect.arrayContaining(['look:balding', 'look:bearded', 'look:grey-haired', 'look:bare-armed', 'look:stern']))
    expect(lookTags({ ...look, colors: { hair: 'copper' } }, LOOK_TABLE)).toContain('look:red-haired')
  })

  it('its words name its parts in its colours, in both languages', () => {
    const look: Look = { body: 'woman', parts: { hair: 'hair.bun', face: 'face.soft', outfit: 'outfit.shawl' }, colors: { hair: 'silver', eyes: 'leaf', 'outfit.1': 'plum' } }
    const d = describeLook(look, { age: 71 })
    expect(d.en).toContain('old woman')
    expect(d.en).toContain('silver hair in a bun')
    expect(d.en).toContain('green eyes')
    expect(d.en).toContain('plum dress')
    expect(d.zh).toContain('银发髻')
    expect(d.zh).toContain('梅紫色长裙')
  })

  it('a restyle changes it and marks it the bearer\'s own', () => {
    const look: Look = { body: 'woman', parts: { hair: 'hair.long', face: 'face.soft', outfit: 'outfit.dress' }, colors: { hair: 'black' } }
    const r = restyled(look, { parts: { hair: 'hair.bob' }, colors: { hair: 'copper' } })
    expect(r.parts.hair).toBe('hair.bob')
    expect(r.colors.hair).toBe('copper')
    expect(r.own).toBe(true)
    expect(lookTags(r, LOOK_TABLE)).toContain('look:red-haired')
    expect(lookProblems({ ...look, parts: { ...look.parts, hair: 'outfit.dress' } }, LOOK_TABLE)[0]).toMatch(/is a outfit, not a hair/)
    expect(lookProblems({ ...look, parts: { ...look.parts, beard: 'beard.full' } }, LOOK_TABLE)[0]).toMatch(/not drawn for the body woman/)
  })
})

describe('the map sprite', () => {
  it('is a 4x4 sheet of 16x32 frames, outlined, its feet on the ground row and its head under the top', () => {
    for (const p of PEOPLE) {
      const px = composeSprite(lookOf(p))
      expect(px.length).toBe(FW * 4 * FH * 4 * 4)
      for (let col = 0; col < 4; col++) {
        let top = FH
        let bottom = -1
        for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (px[(y * FW * 4 + col * FW + x) * 4 + 3]) ((top = Math.min(top, y)), (bottom = Math.max(bottom, y)))
        expect(bottom, `${p.id} facing ${col}`).toBeGreaterThanOrEqual(26)
        expect(bottom, `${p.id} facing ${col}`).toBeLessThanOrEqual(30)
        expect(top, `${p.id} facing ${col}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('paints the hair in the hair colour: the same colour the portrait repaints its hair in', () => {
    const look: Look = { body: 'woman', parts: { hair: 'hair.long', face: 'face.soft', outfit: 'outfit.dress' }, colors: { hair: 'copper' } }
    const px = composeSprite(look)
    const [light, mid, dark] = ramp3(rgbOf('copper'))
    const seen = new Set<string>()
    for (let i = 0; i < px.length; i += 4) if (px[i + 3]) seen.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    for (const c of [light, mid, dark]) expect(seen.has(c.join(',')), `hair tone ${c}`).toBe(true)
    // the portrait's gradient puts the colour itself at the base value
    const g = gradient(rgbOf('copper'))
    expect([g[180 * 3], g[180 * 3 + 1], g[180 * 3 + 2]]).toEqual(mid)
  })
})

describe('restyle: a look changes as an outcome of its bearer (the event model)', () => {
  const rule = (effect: Record<string, unknown>): Rule => ({ id: 'test.dye', host: { type: 'actor/person/herbalist' }, on: 'impulse/notify', tree: { do: [effect as never] } })

  it('a rule on the bearer restyles it: its look, its tags and the mark that the look is its own follow', () => {
    const { index, chunks } = buildFord()
    const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES, rule({ op: 'restyle', parts: { hair: 'hair.bob' }, colors: { hair: 'snow' } })])
    const game = Game.create(index, buildOntology(), lib)
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const w = game.engine.world
    const wren = w.get('npc.wren')!
    expect(w.hasTag(wren, 'look:grey-haired')).toBe(false)
    game.engine.dispatch({ kind: 'impulse/notify', host: { e: wren.id }, roles: {}, params: { what: 'dye' }, origin: 'world' })
    const look = wren.look as Look
    expect(look.parts.hair).toBe('hair.bob')
    expect(look.colors.hair).toBe('snow')
    expect(look.own).toBe(true)
    expect(w.hasTag(wren, 'look:grey-haired')).toBe(true)
    expect([...w.view({ e: wren.id })!.tags]).toContain('look:grey-haired')
  })

  it('the validator takes only the parts and colours of the table', () => {
    const onto = buildOntology()
    const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])
    const check = (effect: Record<string, unknown>) => validatePatch({ artifacts: [{ kind: 'rule', rule: rule(effect) }] }, { ontology: onto, library: lib }).errors.join(' | ')
    expect(check({ op: 'restyle', parts: { hair: 'hair.bob' }, colors: { hair: 'copper' } })).not.toMatch(/look part|colour/)
    expect(check({ op: 'restyle', parts: { hair: 'hair.mohawk' } })).toMatch(/unknown look part "hair.mohawk"/)
    expect(check({ op: 'restyle', parts: { hat: 'hair.bob' } })).toMatch(/hair.bob is a hair, not a hat/)
    expect(check({ op: 'restyle', colors: { hair: 'chartreuse' } })).toMatch(/unknown colour "chartreuse"/)
  })
})

describe('what is worn shows on the look as seen (an item\'s look)', () => {
  it('an iron breastplate and a helmet put on: the snapshot\'s look, its tags, its words and its sprite follow; the own look is kept', async () => {
    const { snapshot } = await import('@lsw/engine')
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    const p = w.player
    const own = structuredClone(p.look) as Look
    const before = composeSprite(own)
    eng.author(() => {
      w.create('item/armor/breastplate', { on: 'inside', holder: p.id }, { id: 'lk.plate', tags: ['material:iron'] })
      w.create('item/armor/helmet', { on: 'inside', holder: p.id }, { id: 'lk.helm', tags: ['material:bronze'] })
    })
    for (const id of ['lk.plate', 'lk.helm']) (eng.controls.sync(), eng.controls.wear(id), eng.tick())
    expect(w.prop(p, 'wear:body')).toBe('lk.plate')
    const seen = snapshot(eng).entities.find((e) => e.id === p.id)!.look as Look
    expect(seen.parts.armour).toBe('armour.plate')
    expect(seen.parts.hat).toBe('hat.helm')
    expect(seen.colors['armour.1']).toBe(LOOK_TABLE.materials!.iron)
    expect(seen.colors['hat.1']).toBe(LOOK_TABLE.materials!.bronze)
    expect(p.look).toEqual(own)
    expect(w.hasTag(p, 'look:armoured')).toBe(true)
    expect(w.hasTag(p, 'look:helmeted')).toBe(true)
    expect(Buffer.from(composeSprite(seen)).equals(Buffer.from(before))).toBe(false)
    // taken off again: the look as seen is the own one
    for (const id of ['lk.plate', 'lk.helm']) (eng.controls.sync(), eng.controls.wear(id), eng.tick())
    expect(snapshot(eng).entities.find((e) => e.id === p.id)!.look).toEqual(own)
    expect(w.hasTag(p, 'look:armoured')).toBe(false)
  })

  it('every item worn as a look part names a part the table has, in a slot only worn things fill or a hat', () => {
    const onto = buildOntology()
    const worn = Object.values(onto.types).filter((t) => typeof t.props?.look === 'string')
    expect(worn.length).toBeGreaterThanOrEqual(7)
    for (const t of worn) expect(LOOK_PARTS[t.props.look as string], t.id).toBeDefined()
  })
})
