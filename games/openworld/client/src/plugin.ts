// OpenWorld's plugin (packages/runtime/src/bundle.ts): the code this game has beyond its bundle's data — its
// wilderness made by seed, the upgrades of older saves, its look generator, its dev summons — for the engine's
// player, which loads it in the page and in the worker.

import type { GamePlugin } from '@openworld/runtime/src/bundle.ts'
import { CLIENT_GAME } from './game.ts'

const plugin: GamePlugin = () => {
  // the bundle's pictures, sounds and world are where the player fetched them; the rest is the game's own
  const { catalog: _c, assets: _a, world: _w, ...code } = CLIENT_GAME
  return code
}
export default plugin
