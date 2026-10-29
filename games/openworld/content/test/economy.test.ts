// The standard prices (docs/economy.md, prices.ts): every item has one; what is made is worth what it took and the
// work once; and nothing bought, made or turned into something else, and sold again, gives back more than it cost — at
// full regard with the merchant on both sides, at any quality and level a maker reaches, with every knack that raises
// what the stall pays. (What a knack adds to a making's yield — a smelter's extra bar, a cheesemaker's cheese — is the
// knack's gain, beyond this.)
import { describe, expect, it } from 'vitest'
import { OntologyIndex, buildSandbox, levelFactor, RuleLibrary, type Recipe } from '@openworld/engine'
import { socialOf } from '@openworld/modules'
import { BASE_RULES, COIN, DISCOUNT, FORMS, LABOUR, LIFE_SKILLS, MADE_QUALITY, MARKDOWN, MARKUP, MATERIALS, RECIPES, buildOntology, madeOfMain, priceOf, pricedFrom, rawOf, valueOf } from '../src/index.ts'

const onto = buildOntology()
const index = new OntologyIndex(onto)
const factor = (m: unknown) => (typeof m === 'string' && MATERIALS[m]?.value) || 1
/** What a merchant asks one it holds in full regard for a thing of this worth, and what it pays (social.ts). */
const buyBest = (worth: number) => Math.max(1, Math.round(worth * (1 + MARKUP) * (1 - DISCOUNT)))
const sellBest = (worth: number) => Math.floor(worth * MARKDOWN * (1 + (DISCOUNT * 2) / 3))
/** A thing's worth as the society module reads it: rounded, at least one. */
const worth = (v: number) => Math.max(1, Math.round(v))

/** The most a knack adds to a stat, every skill that grants it taken. */
const knack = (stat: string) => LIFE_SKILLS.reduce((n, s) => n + (Number(s.grant?.[stat]) || 0), 0)
const shop = (r: Recipe) => r.make.type === COIN || r.needs.some((n) => n.type === COIN)
const stallPays = new Map(RECIPES.filter((r) => r.make.type === COIN).map((r) => [r.needs[0].type, Math.floor((r.count ?? 1) * (1 + (r.bonus ? knack(r.bonus) : 0)))]))
const shelfAsks = new Map<string, number>()
for (const r of RECIPES) if (r.needs.length === 1 && r.needs[0].type === COIN) shelfAsks.set(r.make.type, Math.min(shelfAsks.get(r.make.type) ?? Infinity, r.needs[0].count / (r.count ?? 1)))

/** The least one pays for a thing, and the most one gets for it. */
const cost = (type: string) => Math.min(buyBest(worth(priceOf(type))), shelfAsks.get(type) ?? Infinity)
const gain = (type: string, w = worth(priceOf(type))) => Math.max(sellBest(w), stallPays.get(type) ?? 0)

describe('standard prices', () => {
  it('prices every item, and every made one from what it took', () => {
    for (const f of FORMS) {
      const v = index.resolve(f.id).props.value
      expect(typeof v === 'number' && v > 0 && Number.isFinite(v), f.id).toBe(true)
      expect(v, f.id).toBe(valueOf(f.id))
    }
    for (const r of RECIPES.filter((r) => !shop(r) && r.make.type.startsWith('item/'))) expect(pricedFrom(r.make.type), r.id).toBeDefined()
  })

  it('counts the work once: a made thing is worth what the world gave for its makings, and a quarter', () => {
    // the plank is a log split in two; the bucket three planks and a grass handle, never the planks' price
    expect(rawOf('item/material/plank')).toBeCloseTo(rawOf('item/material/log') / 2)
    expect(rawOf('item/vessel/bucket/empty')).toBeCloseTo(3 * rawOf('item/material/plank') + rawOf('item/material/grass'))
    // (made of wood, as its planks are)
    expect(valueOf('item/vessel/bucket/empty') * MATERIALS.wood.value).toBeCloseTo(LABOUR * rawOf('item/vessel/bucket/empty'), 1)
    // a bar is what its ore was; gold five times iron, as its material is
    expect(rawOf('item/material/gold_ingot')).toBeCloseTo(MATERIALS.gold.value * rawOf('item/material/iron_ingot'))
  })

  it('makes nothing dearer than it took: whatever is made, at any quality and level, sells for less than its makings cost', () => {
    const levels = onto.params!.gearLevels!
    for (const r of RECIPES.filter((r) => !shop(r) && r.make.type.startsWith('item/'))) {
      const paid = r.needs.reduce((n, x) => n + x.count * cost(x.type), 0)
      const made = index.resolve(r.make.type)
      const main = madeOfMain(r)
      const plain = valueOf(r.make.type) * factor(main)
      const gear = typeof made.props.slot === 'string'
      for (const q of onto.qualities!) {
        // as its maker would make it, and as the world's bound holds it (params.made: its standard price and its quality's share)
        const as = worth(plain * (q.value ?? 1) * (gear ? levelFactor(levels, levels.max) : 1))
        const bound = Math.max(1, Math.floor(worth(plain) * (MADE_QUALITY[q.id] ?? 1)))
        const got = (r.count ?? 1) * gain(r.make.type, Math.min(as, bound))
        expect(got, `${r.id} (${q.id}): ${got} for makings bought at ${paid}`).toBeLessThanOrEqual(paid)
      }
    }
  })

  it('turns nothing into something dearer: cooking, smelting, filling, curdling give back no more than they take', () => {
    for (const f of FORMS) {
      for (const key of ['cookedType', 'smelts', 'waterType']) {
        const into = f.props?.[key]
        if (typeof into !== 'string') continue
        expect(gain(into), `${f.id} → ${into}`).toBeLessThanOrEqual(cost(f.id))
      }
    }
    // a bucket of milk over a fire: two cheeses and the bucket back
    expect(2 * gain('item/food/cheese') + gain('item/vessel/bucket/empty')).toBeLessThanOrEqual(cost('item/vessel/bucket/milk'))
  })

  it('trades nothing round: no shelf sells for less than a merchant pays, no buyer pays more than a merchant asks', () => {
    for (const r of RECIPES.filter(shop)) {
      if (r.make.type === COIN) {
        const type = r.needs[0].type
        expect(stallPays.get(type)!, `${r.id} pays more than it would cost`).toBeLessThanOrEqual(buyBest(worth(priceOf(type))))
      } else {
        const type = r.make.type
        const each = r.needs[0].count / Math.floor((r.count ?? 1) * (1 + (r.bonus ? knack(r.bonus) : 0)))
        expect(gain(type), `${r.id} sells for less than it fetches`).toBeLessThanOrEqual(each)
      }
    }
  })

  it('holds a level-twenty master smith to the standard price of what they forge', () => {
    const eng = buildSandbox({
      terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { level: 20 } },
        { key: 'anvil', type: 'fixture/craft/anvil/smith', x: 2, y: 1 },
        { key: 'hammer', type: 'item/tool/smith_hammer', inside: 'actor', x: 2, y: 2 },
        ...Array.from({ length: 2 }, (_, i) => ({ key: `ingot${i}`, type: 'item/material/iron_ingot', inside: 'actor', x: 2, y: 2 })),
        { key: 'plank', type: 'item/material/plank', inside: 'actor', x: 2, y: 2 },
      ], event: {},
    }, onto, new RuleLibrary(BASE_RULES))
    eng.controls.sync()
    const recipe = RECIPES.find((r) => r.id === 'smith/sword-iron')!
    expect(eng.controls.craftAll({ ...recipe, unlockedBy: undefined })).toBe(1)
    const sword = eng.world.ofType('item/weapon/blade/sword')[0]
    expect(sword.props?.level).toBe(20)
    const quality = onto.qualities!.find((q) => q.tag && sword.tags?.includes(q.tag))?.id ?? 'common'
    const most = Math.floor(worth(valueOf('item/weapon/blade/sword')) * (MADE_QUALITY[quality] ?? 1))
    expect(socialOf(eng).value(sword)).toBe(Math.max(1, most))
  })
})
