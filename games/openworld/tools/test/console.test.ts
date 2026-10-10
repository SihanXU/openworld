// The Mod Console's template (packages/runtime/src/ui/template.ts) is where a person starts a patch
// by hand: for every kind of hole the Ford reaches, it must already be a valid patch.

// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, validatePatch, type Key } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { template } from '@openworld/runtime/src/ui/template.ts'
import { AT, STAND, buildFord } from '../src/demo/world.ts'

describe('the Mod Console template', () => {
  it('is a valid patch for an undefined act, a strike and a handle', () => {
    const onto = buildOntology()
    const { index, chunks } = buildFord()
    const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])
    const game = Game.create(index, onto, lib)
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    const press = (key: Key, held: string | undefined, at: readonly [number, number], target: readonly [number, number], facing: 'up' | 'right' = 'up') => {
      eng.author(() => {
        const e = held ? w.create(held, { on: 'hand', holder: 'player' }) : undefined
        w.player.held = e?.id
        w.author(() => w.place(w.player, { on: 'tile', map: 'ford', x: at[0], y: at[1] }))
        w.player.facing = facing
      })
      eng.controls.run(eng.controls.plan(key, { x: target[0], y: target[1] })!, true)
    }
    press('use', 'item/food/bread', STAND.winch, AT.winch)
    press('use', 'item/weapon/blade/axe', STAND.winch, AT.winch)
    press('hands', undefined, STAND.raft, AT.raft, 'right')
    const kinds = game.mods.records.map((r) => r.request.event.kind)
    expect(kinds).toEqual(['act/use', 'impulse/strike', 'impulse/handle'])
    for (const r of game.mods.records) {
      const patch = template({ id: r.id, request: r.request, status: r.status } as Parameters<typeof template>[0])
      const res = validatePatch(patch, { ontology: onto, library: lib, scenario: r.request.scenario })
      expect([r.request.event.kind, res.errors]).toEqual([r.request.event.kind, []])
    }
  })
})
