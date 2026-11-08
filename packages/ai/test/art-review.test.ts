import { describe, expect, it } from 'vitest'
import { readResearchRequest, type Ontology, type PixelArt } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { MemFiles } from '../src/agent/files.ts'
import { SelfState } from '../src/agent/state.ts'
import { WorldLibrary } from '../src/library/library.ts'
import { ScriptedModel } from '../src/models/model.ts'
import { artReference, artShapeProblems, reviewedArt } from '../src/modder/art-review.ts'
import { Modder } from '../src/modder/pipeline.ts'
import swordReplay from '../fixtures/art-review/sword.json'
import armorReplay from '../fixtures/art-review/armor.json'

const art = (pixel: (x: number, y: number) => boolean): PixelArt => ({ grid: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => pixel(x, y) ? 'k' : '.').join('')), palette: { k: '#141b1b' } })
const blade = art((x, y) => (x >= 7 && x <= 8 && y >= 1 && y <= 14) || (y === 10 && x >= 4 && x <= 11))
const torso = art((x, y) => (y >= 4 && y <= 12 && x >= 4 && x <= 11) || (y >= 4 && y <= 6 && x >= 2 && x <= 13))
const checks = { recognizable: true, structure: true, style: true, material: true }
const type = { id: 'item/weapon/blade/novel_name', name: { en: 'Unusual Name', zh: '别名' } }
const reference = { type: 'item/weapon/blade/sword', art: blade }
const ontology: Ontology = { ...STDLIB_ONTOLOGY as Ontology, types: { ...STDLIB_ONTOLOGY.types,
  'item/weapon/blade/sword': { id: 'item/weapon/blade/sword', sprite: 'item:sword' },
  'item/armor/breastplate': { id: 'item/armor/breastplate', sprite: 'item:armor' },
  'item/tool/hammer': { id: 'item/tool/hammer', name: { en: 'Hammer', zh: '锤' }, props: { value: 1 } },
  'item/material/log': { id: 'item/material/log', props: { value: 2, material: 'wood' } },
} }

describe('NPC art references and bounded inspection', () => {
  it('chooses an actual family silhouette regardless of the invented name', () => {
    const refs = { 'item/armor/breastplate': torso, 'item/weapon/blade/sword': blade }
    expect(artReference(type, ontology, refs)).toEqual(reference)
    expect(artReference({ id: 'item/armor/new_gear', name: 'Steel sword' }, ontology, refs)?.art).toEqual(torso)
    expect(artReference({ id: 'item/vessel/new_jar' }, ontology, refs)).toBeUndefined()
  })

  it('retains reference icons without granting an unlisted variant prototype', () => {
    const body = { npc: 'Artist', message: 'Something new.', history: [], catalogue: { prototypes: [], materials: [], artReferences: { [reference.type]: blade } } }
    const request = readResearchRequest(body)
    expect(request.catalogue.artReferences).toEqual({ [reference.type]: blade })
    expect(request.catalogue.prototypes).toEqual([])
    expect(() => readResearchRequest({ ...body, catalogue: { ...body.catalogue, artReferences: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`item/weapon/ref_${i}`, blade])) } })).toThrow(/art references/)
  })

  it('detects a solid background, fragments and loss of the reference silhouette', () => {
    expect(artShapeProblems(art(() => true))).toEqual(expect.arrayContaining([expect.stringMatching(/background/)]))
    expect(artShapeProblems(art((x, y) => (x <= 3 || x >= 12) && y >= 4 && y <= 10)).join()).toMatch(/fragmented/)
    expect(artShapeProblems(art((x, y) => x <= 2 && y >= 3 && y <= 13), blade).join()).toMatch(/silhouette/)
    expect(artShapeProblems(blade, blade)).toEqual([])
  })

  it('inspects even a syntactically valid icon, then retains the original and single repaired grid', async () => {
    let calls = 0
    const original = art((x, y) => x >= 5 && x <= 10 && y >= 5 && y <= 10)
    const result = await reviewedArt(new ScriptedModel((messages, opts) => {
      calls++
      if (calls === 1) { expect(opts?.purpose).toBe('art'); expect(messages[1].content).toContain(reference.type); return original }
      expect(opts?.purpose).toBe('art-review')
      expect(messages[1].content).toContain('transverse guard')
      return { accepted: true, issues: ['Original central blob has no pointed blade or guard; extended the blade above row 10.'], finalChecks: checks, repaired: blade }
    }), type, 'a wooden short sword', reference, undefined, true)
    expect(calls).toBe(2)
    expect(result.art).toEqual(blade)
    expect(result.review).toMatchObject({ original, repaired: blade, reference, accepted: true, criteria: checks })
    expect(result.review?.checks.map(c => c.stage)).toEqual(['original', 'repair'])
  })

  it('explicitly retains a source-preserving original when final self-review refuses the result', async () => {
    let calls = 0
    const result = await reviewedArt(new ScriptedModel(() => ++calls === 1 ? blade : { issues: ['The grip is still a detached mark.'], finalChecks: { ...checks, structure: false } }), type, 'a sword', reference, undefined, true)
    expect(calls).toBe(2)
    expect(result.art).toEqual(blade)
    expect(result.review).toMatchObject({ accepted: false, fallback: 'original', original: blade })
  })

  it('reports the original-game fallback when neither generated candidate preserves the silhouette', async () => {
    let calls = 0
    const result = await reviewedArt(new ScriptedModel(() => ++calls === 1 ? art(() => true) : { issues: ['No readable blade.'], finalChecks: { ...checks, recognizable: false } }), type, 'A sword', reference, undefined, true)
    expect(calls).toBe(2)
    expect(result.art).toEqual(reference.art)
    expect(result.review).toMatchObject({ accepted: false, fallback: 'reference' })
    expect(result.review?.original).not.toEqual(result.art)
  })

  it('does not accept a model-approved invalid repair or retry it a third time', async () => {
    let calls = 0
    const result = await reviewedArt(new ScriptedModel(() => ++calls === 1 ? blade : { issues: [], finalChecks: checks, repaired: art(() => true) }), type, 'a sword', reference, undefined, true)
    expect(calls).toBe(2)
    expect(result.art).toEqual(blade)
    expect(result.review).toMatchObject({ accepted: false, fallback: 'original' })
    expect(result.review?.checks[1].problems.join()).toMatch(/background/)
  })

  it('does not silently accept an unreviewed original after provider failure', async () => {
    let calls = 0
    const result = await reviewedArt(new ScriptedModel(() => { if (++calls === 1) return blade; throw new Error('offline') }), type, 'a sword')
    expect(calls).toBe(2)
    expect(result.art).toBeUndefined()
    expect(result.review).toMatchObject({ accepted: false, fallback: 'none', original: blade })
  })

  it('accepts the real sword repair from final checks despite the old ambiguous original accepted:false', async () => {
    let calls = 0
    const result = await reviewedArt(new ScriptedModel(() => ++calls === 1 ? swordReplay.original : swordReplay.answer), type, 'A steel blade with a wooden grip', swordReplay.reference, undefined, true)
    expect(calls).toBe(2)
    expect(result.art).toEqual(swordReplay.answer.repaired)
    expect(result.review?.accepted).toBe(true)
    expect(result.review?.fallback).toBeUndefined()
  })

  it('rejects the real sack-shaped armor repair and retains the reference-preserving generated recolor', async () => {
    expect(artShapeProblems(armorReplay.original, armorReplay.reference.art)).toEqual([])
    expect(artShapeProblems(armorReplay.answer.repaired, armorReplay.reference.art).join()).toMatch(/IoU 0\.685.*0\.900/)
    let calls = 0
    const result = await reviewedArt(new ScriptedModel(() => ++calls === 1 ? armorReplay.original : armorReplay.answer), { id: 'item/armor/jerkin', name: 'Leather Jerkin' }, 'Leather body armour', armorReplay.reference, undefined, true)
    expect(calls).toBe(2)
    expect(result.art).toEqual(armorReplay.original)
    expect(result.art).not.toEqual(armorReplay.answer.repaired)
    expect(result.review).toMatchObject({ accepted: false, fallback: 'original', repaired: armorReplay.answer.repaired })
  })

  it('uses a berry-pile reference only for style when designing a new jar of jam', async () => {
    const berries = art((x, y) => x >= 2 && x <= 5 && y >= 3 && y <= 10)
    const jar = art((x, y) => x >= 8 && x <= 12 && y >= 3 && y <= 13)
    let calls = 0
    const result = await reviewedArt(new ScriptedModel((messages) => { calls++; if (calls === 1) { expect(messages[1].content).toContain('style only'); return jar } return { issues: [], finalChecks: checks } }), { id: 'item/food/jam', name: 'Jar of Jam' }, 'A small jam jar', { type: 'item/food/berries', art: berries })
    expect(result.review).toMatchObject({ accepted: true, silhouette: 'free' })
    expect(result.art).toEqual(jar)
  })

  it('keeps the existing asynchronous sketch handle and journals evidence without writing shared content', async () => {
    let release!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve })
    let artistCalls = 0
    const fs = new MemFiles(), state = SelfState.open('/artist', undefined, [], fs)
    const library = new WorldLibrary(ontology, STDLIB_RULES)
    const model = new ScriptedModel(async (_messages, opts) => {
      if (opts?.purpose === 'create') return { reply: { en: 'A wooden mallet.', zh: '木槌。' }, design: { name: { en: 'Wooden Mallet', zh: '木槌' }, prototype: 'item/tool/hammer', ingredients: [{ type: 'item/material/log', count: 1 }] } }
      artistCalls++
      if (opts?.purpose === 'art') { await waiting; return torso }
      return { accepted: true, issues: [], finalChecks: checks }
    })
    const modder = new Modder({ model, state, library })
    const reply = await modder.research({ npc: 'Carver', message: 'A wooden mallet.', history: [], create: 'medium', catalogue: { prototypes: ['item/tool/hammer'], materials: ['item/material/log'], icons: { 'item/tool/hammer': torso } } })
    expect(reply.sketch).toBeTruthy()
    expect(reply.design && 'art' in reply.design ? reply.design.art : undefined).toBeUndefined()
    release()
    const drawn = await modder.researchSketch({ sketch: reply.sketch })
    expect(drawn).toMatchObject({ art: torso, review: { accepted: true, original: torso } })
    expect(artistCalls).toBe(2)
    expect(fs.read('/artist/journal.jsonl')).toContain('art-review')
    expect(await modder.researchSketch({ sketch: reply.sketch })).toEqual({})
    expect(library.lib.types).toEqual([])
    expect(library.log).toEqual([])
  })
})
