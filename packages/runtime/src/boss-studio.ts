// Disposable review encounter. Kept separate from the page so its real bootstrap is testable.
import { Game, RuleLibrary, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, BOSSES, BOSS_BY_ID, BOSS_ARENA, STORY_RULES, buildOntology, createBoss, decodeChunk, type RawChunk } from '@openworld-game/content'

export function createBossStudio(index: WorldIndex, raw: RawChunk, bossId: string): Game {
  if (!BOSS_BY_ID[bossId]) throw new Error('Unknown studio boss')
  const settings = structuredClone(index)
  // The generated map index can predate a new boss. Use the same current kits as
  // the selector and actor; otherwise snapshot() omits boss data and renders a normal creature.
  settings.bosses = structuredClone(BOSSES)
  Object.assign(settings, { start: { map: BOSS_ARENA.map, x: 23, y: 19 }, npcs: [], companions: [], steps: [], quests: [], invariants: [], waypoints: [], startHour: 12 })
  settings.player.place = { on: 'tile', ...settings.start }
  settings.player.facing = 'up'
  settings.player.props = { ...settings.player.props, hp: 200, maxHp: 200, maxHunger: 0, def: 0, atk: 8 }
  const game = Game.create(settings, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const chunk = decodeChunk(structuredClone(raw))
  chunk.entities = chunk.entities.filter((e) => !e.type.startsWith('actor/creature'))
  chunk.entities.push(createBoss(bossId, BOSS_ARENA, BOSS_ARENA.id))
  chunk.map.appear = []
  game.loadChunk(chunk)
  return game
}
