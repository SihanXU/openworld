// The starter as the engine's player takes it (packages/runtime/src/bundle.ts): its bundle is the whole game,
// its pictures and world beside it, the panels of the modules it does not use empty.

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compileProject } from '@openworld/format/src/node.ts'
import { clientGameOf } from '@openworld/runtime/src/bundle.ts'

const compiled = compileProject(fileURLToPath(new URL('..', import.meta.url)))

describe('the starter in the player', () => {
  const g = clientGameOf(compiled.bundle, 'https://example.org/games/starter/bundle.json')

  it('is fetched from where its bundle is: its assets and its world beside it', () => {
    expect(g.assets).toBe('https://example.org/games/starter/assets/')
    expect(g.world).toBe('https://example.org/games/starter/world/')
    expect(g.id).toBe('starter')
    expect(g.ontology().types['actor/person/villager']).toBeDefined()
    expect(g.cover?.title).toEqual({ en: 'The Glade', zh: '林间空地' })
  })

  it('has what a game without modules has: no skills, boons, recipes or looks of its own, and a catalogue for its content', () => {
    expect(g.skills.all).toEqual([])
    expect(g.boons).toEqual({})
    expect(g.crafting.recipes).toEqual([])
    expect(Object.keys(g.looks.bodies)).toEqual([])
    for (const key of ['item:axe', 'item:log', 'fixture:chest', 'creature:slime']) expect(g.catalog.items[key] ?? g.catalog.fixtures[key] ?? g.catalog.creatures[key], key).toBeDefined()
    expect(g.catalog.roles.villager?.length).toBeGreaterThan(0)
  })

  it('says the interface\'s words its own way where its client tables write them (ClientGame.texts), the engine\'s elsewhere', () => {
    expect(g.texts).toBeUndefined()
    const own = clientGameOf({ ...compiled.bundle, client: { ...compiled.bundle.client, texts: { newGame: { en: 'Begin', zh: '开始' } }, cover: { companion: 'own/bird.png', credit: false } } }, 'https://example.org/g/bundle.json')
    expect(own.texts).toEqual({ newGame: { en: 'Begin', zh: '开始' } })
    expect(own.cover).toMatchObject({ title: compiled.bundle.game.name, companion: 'own/bird.png', credit: false })
  })
})
