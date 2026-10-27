// Older saves brought up to the world as it is now (content migrate*.ts, game.ts upgradeSave; the client's upgrade
// hooks, games/openworld/client/src/game.ts): what a save already holds is the save's, so what the maps or the content
// changed since must be brought to it by hand — the Held Ground's plots and Firstlight's loom, the merchants' goods, the
// forged sets' pieces.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { socialOf } from '@openworld/modules'
import { BASE_RULES, GAME, PLOTS_LAYOUT, SET_DEFS, STOCK_LAYOUT, STORY_RULES, buildOntology, decodeChunk, migratePlots, migrateStock, migrateTents } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

function game() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, lib())
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const chunk = (id: string) => decodeChunk(chunks.find((c) => c.map.id === id)!)
  return { g, index, chunks, chunk, eng: g.engine, w: g.engine.world }
}

describe('the Held Ground\'s plots and Firstlight\'s loom in an older save', () => {
  it('a save that had been to both before they were staked out (fb7bb3a) gets every plot and the loom where the maps have them, the waypoint statue moved aside for it; a building already paid for rises on its plot', () => {
    const { g, chunk, eng, w } = game()
    const plots = structuredClone(Object.values(w.state.entities).filter((e) => e.type.startsWith('fixture/build/plot/')))
    expect(plots.map((e) => e.id).sort()).toEqual(['apothecary', 'arcane', 'kitchen', 'lodge1', 'lodge2', 'lodge3', 'loom', 'storehouse', 'workshop'].map((id) => `haven.plot.${id}`))
    const statue = (w.get('wp.village')!.place as { x: number; y: number })
    const loom = (w.get('village.loom')!.place as { x: number; y: number })
    // as such a save has them: no plots, no loom, the statue where the loom stands now; the workshop's materials
    // already handed over (the steward's build set its fact, but there was no plot to rise on)
    eng.author(() => {
      for (const e of [...plots.map((x) => w.get(x.id)!), w.get('village.loom')!]) w.destroy(e)
      w.place(w.get('wp.village')!, { on: 'tile', map: 'meadow', x: loom.x, y: loom.y })
      w.setFact('haven.build.workshop', 1)
    })
    expect(w.state.loadedMaps).toEqual(expect.arrayContaining(['haven', 'meadow']))
    eng.author(() => migratePlots(g, [chunk('haven'), chunk('meadow')]))
    expect(w.fact(PLOTS_LAYOUT)).toBe(true)
    for (const p of plots) expect([p.id, w.get(p.id)?.type, w.get(p.id)?.place]).toEqual([p.id, p.type, p.place])
    expect(w.get('village.loom')).toMatchObject({ type: 'fixture/craft/loom', place: { map: 'meadow', x: loom.x, y: loom.y } })
    expect(w.get('wp.village')!.place).toMatchObject({ map: 'meadow', x: statue.x, y: statue.y })
    // the plot paid for becomes its building at its next look
    eng.author(() => eng.teleport(w.player, { map: 'haven', x: 24, y: 22 }))
    for (let i = 0; i < 60 && w.get('haven.plot.workshop')!.type !== 'fixture/craft/workbench'; i++) eng.tick()
    expect(w.get('haven.plot.workshop')!.type).toBe('fixture/craft/workbench')
    expect(w.get('haven.plot.kitchen')!.type).toBe('fixture/build/plot/kitchen')
  })

  it('a map the save has not been to is left to come as it is built; a save marked as the world is now is left alone', () => {
    const { g, chunk, eng, w } = game()
    eng.author(() => {
      w.destroy(w.get('haven.plot.loom')!)
      w.destroy(w.get('village.loom')!)
      w.state.loadedMaps = w.state.loadedMaps.filter((m) => m !== 'meadow')
    })
    eng.author(() => migratePlots(g, [chunk('haven'), chunk('meadow')]))
    expect([!!w.get('haven.plot.loom'), !!w.get('village.loom')]).toEqual([true, false])
    eng.author(() => w.destroy(w.get('haven.plot.loom')!))
    eng.author(() => migratePlots(g, [chunk('haven')]))
    expect(w.get('haven.plot.loom')).toBeUndefined()
  })
})

describe('the merchants of an older save', () => {
  it('one who traded before keeps what it sold and sells what it sells now (every kind, at least as many); its next restock brings them', () => {
    const { g, index, eng, w } = game()
    const marta = w.get('npc.marta')!
    const tobin = w.get('npc.tobin')!
    const now = { marta: w.prop(marta, 'stock'), tobin: w.prop(tobin, 'stock') }
    // as their records were kept before every person traded (fb7bb3a): Marta's bread, Tobin's four things (one firework),
    // and something a save may hold that the world never gave (kept)
    eng.author(() => {
      w.setProp(marta, 'stock', 'item/food/bread*6')
      w.setProp(tobin, 'stock', 'item/vessel/flask/oil*2|item/clothing/hood*1|item/tool/lockpick*2|item/misc/firework*1|item/misc/dice*1')
      for (const id of [...(marta.contents ?? [])]) if (w.get(id)?.type === 'item/food/pie') w.destroy(w.get(id)!)
    })
    eng.author(() => migrateStock(g, index))
    expect(w.fact(STOCK_LAYOUT)).toBe(true)
    expect(w.prop(marta, 'stock')).toBe(now.marta)
    const tobins = new Map(String(w.prop(tobin, 'stock')).split('|').map((p) => p.split('*') as [string, string]))
    for (const part of String(now.tobin).split('|')) {
      const [type, n] = part.split('*')
      expect([type, tobins.get(type)]).toEqual([type, n])
    }
    expect(tobins.get('item/misc/dice')).toBe('1')
    // the next morning's restock (or asked to trade) fills to the list: pies again
    const s = socialOf(eng)
    expect(s.stock(marta).some((e) => e.type === 'item/food/pie')).toBe(false)
    const at = w.posOf(marta)!
    eng.author(() => (w.setProp(marta, 'restocked', -1), eng.travel(w.player, { map: at.map, x: at.x, y: at.y + 1 })))
    eng.controls.talk(marta.id, 'trade')
    expect(s.stock(marta).filter((e) => e.type === 'item/food/pie').length).toBe(2)
  })
})

describe('the forged sets\' pieces of an older save', () => {
  it('each piece takes its slot\'s set (the armour, the trinkets, none for the weapon and the off hand): a helmet with jewels, a blade and a shield is not the armour\'s six', () => {
    const { g, index, chunks, eng, w } = game()
    const p = w.player
    const set = SET_DEFS.find((s) => s.id === 'oathguard')!
    const worn = ['head', 'neck', 'ear', 'ring', 'weapon', 'arm']
    // as they were forged before a profession's gear was two sets (134c875): every piece its profession's one set
    const pieces: Entity[] = eng.author(() => {
      w.setProp(p, 'profession', 'warrior')
      return worn.map((slot) => {
        const piece = set.pieces.find((x) => x.slot === slot)!
        const e = w.create(piece.type, { on: 'inside', holder: p.id }, { props: { set: set.id, ...(piece.props ?? {}) } })
        w.setProp(p, `wear:${slot}`, e.id)
        return e
      })
    })
    expect(w.worn(p).length).toBe(6)
    // the armour's six pieces' bonus (each hit draws a health) from one helmet and five that are not armour
    expect(w.stat(p, 'lifesteal')).toBe(1)
    const loaded = Game.load(structuredClone(g.save()), index, onto, lib(), GAME.upgradeSave)
    for (const c of chunks) loaded.loadChunk(decodeChunk(c))
    const lw = loaded.engine.world
    expect(pieces.map((e) => lw.get(e.id)!.props?.set)).toEqual(['oathguard', 'oathguard_trinkets', 'oathguard_trinkets', 'oathguard_trinkets', undefined, undefined])
    expect(lw.stat(lw.player, 'lifesteal')).toBe(0)
    // the trinkets, three of three, give theirs
    const t3 = set.trinkets.find((b) => b.pieces === 3)!
    expect(lw.stat(lw.player, 'holdFast')).toBeCloseTo(t3.props.holdFast ?? 0, 5)
  })
})

describe('the tents’ rooms in an older save', () => {
  it('every tent that stands where its map has one takes the room behind its flap, the forest’s torn tent too', () => {
    const { g, chunk, eng, w } = game()
    const tents = Object.values(w.state.entities).filter((e) => e.type.startsWith('fixture/tent') && e.place.on === 'tile')
    expect(tents.map((e) => e.id).sort()).toEqual(['ford.tent', 'forest~1c', 'haven~8'])
    // as a save from before the rooms has them: no room behind the flap
    eng.author(() => {
      for (const t of tents) {
        delete t.props!.interior
        delete t.props!.interiorX
        delete t.props!.interiorY
      }
    })
    expect(w.get('forest~1c')!.props?.interior).toBeUndefined()
    eng.author(() => migrateTents(g, [chunk('ford'), chunk('forest'), chunk('haven')]))
    expect(Object.fromEntries(tents.map((t) => [t.id, t.props?.interior]))).toEqual({
      'ford.tent': 'ford.tentroom',
      'forest~1c': 'forest.tentroom',
      'haven~8': 'haven.tentroom',
    })
  })
})
