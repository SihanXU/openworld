// The frame's numbers (engine snapshot.ts `player.stats`), on the kernel with no module: what the character sheet shows
// is what the engine fights with — World.stat (one's own, statuses, what is worn and rolled, a set's bonuses, the
// night's) and the power of the weapon a blow is struck with — never a sum of the worn things' props, which counted the
// weapon kept in the main hand and left out statuses, rolled extras and sets.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_HOUR, decodeRawChunk, snapshot, type Engine, type Frame, type Ontology } from '@openworld/engine'
import { compileProject } from '@openworld/format/src/node.ts'

const compiled = compileProject(fileURLToPath(new URL('..', import.meta.url)))
const { bundle, index } = compiled

/** The starter with a helm of a set, a blade, and a blessing: things its own world has none of. */
function geared(): Engine {
  const onto: Ontology = structuredClone(bundle.ontology)
  onto.types['item/armor'] = { id: 'item/armor', name: 'armour', tags: ['armor'] }
  onto.types['item/armor/helm'] = { id: 'item/armor/helm', name: 'Helm', props: { slot: 'head', def: 2, critChance: 0.05, 'night:def': 1, set: 'vigil' } }
  onto.types['item/weapon'] = { id: 'item/weapon', name: 'weapon', tags: ['weapon'] }
  // a blade's own atk and def count only as it strikes (combat), never as a stat of its bearer's
  onto.types['item/weapon/blade'] = { id: 'item/weapon/blade', name: 'Blade', props: { slot: 'weapon', power: 4, atk: 9, def: 9, critChance: 0.1 } }
  onto.statuses.blessed = { id: 'blessed', name: 'Blessed', props: { atk: 2, def: 1 } }
  onto.sets = [{ id: 'vigil', name: 'Vigil', pieces: 2, bonuses: [{ pieces: 1, props: { def: 3, critChance: 0.02 }, text: '' }] }]
  const game = Game.create(index, onto, new RuleLibrary(bundle.rules))
  for (const c of compiled.chunks) game.loadChunk(decodeRawChunk(c, bundle.terrainChars))
  const eng = game.engine
  const w = eng.world
  const p = w.player
  eng.author(() => {
    const helm = w.create('item/armor/helm', { on: 'inside', holder: p.id }, { props: { 'sub:atk': 1, 'sub:def': 2 } })
    const blade = w.create('item/weapon/blade', { on: 'inside', holder: p.id }, { props: { 'sub:atk': 2, 'sub:critChance': 0.03 } })
    w.setProp(p, 'wear:head', helm.id)
    w.setProp(p, 'wear:weapon', blade.id)
    w.setStatus({ e: p.id }, 'blessed', w.state.tick + 10_000)
  })
  eng.controls.sync()
  return eng
}

/** What the sheet once added up itself: one's own prop and every worn thing's. */
const summed = (f: Frame, key: string) => Number(f.player.props[key] ?? 0) + Object.values(f.player.worn).reduce((n, it) => n + Number(it.props[key] ?? 0), 0)

describe("the frame's numbers are the engine's", () => {
  it('atk, def and critical chance are World.stat, the power the weapon fought with', () => {
    const eng = geared()
    const w = eng.world
    const p = w.player
    const f = snapshot(eng)
    expect(f.player.stats).toEqual({ atk: w.stat(p, 'atk', 1), def: w.stat(p, 'def'), critChance: w.stat(p, 'critChance'), power: 4 })
    // the helm (2), its rolled 2, the blessing (1) and the set's one-piece bonus (3) on one's own; not the blade's 9
    expect(f.player.stats.def).toBe(w.num(p, 'def') + 2 + 2 + 1 + 3)
    expect(summed(f, 'def')).not.toBe(f.player.stats.def)
  })

  it('follows the night and what one stops wearing', () => {
    const eng = geared()
    const w = eng.world
    const p = w.player
    const day = snapshot(eng).player.stats.def
    // the helm's `night:def` counts after dark
    eng.author(() => {
      while (!w.isNight()) w.state.tick += TICKS_PER_HOUR
    })
    expect(snapshot(eng).player.stats).toMatchObject({ def: day + 1 })
    expect(snapshot(eng).player.stats.def).toBe(w.stat(p, 'def'))
    // the blade put away: no weapon, no power (the hand is bare)
    eng.author(() => w.setProp(p, 'wear:weapon', undefined))
    const f = snapshot(eng)
    expect(f.player.stats.power).toBe(0)
    expect(f.player.stats).toEqual({ atk: w.stat(p, 'atk', 1), def: w.stat(p, 'def'), critChance: w.stat(p, 'critChance'), power: 0 })
  })
})
