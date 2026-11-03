import { fileURLToPath } from 'node:url'
import { Game, RuleLibrary, decodeRawChunk, type Dir, type Engine, type Entity } from '@openworld/engine'
import { compileProject } from '@openworld/format/src/node.ts'

const compiled = compileProject(fileURLToPath(new URL('..', import.meta.url)))

export const DIRS: Dir[] = ['right', 'left', 'down', 'up']

export function played(): Engine {
  const { bundle, index, chunks } = compiled
  const game = Game.create(index, structuredClone(bundle.ontology), new RuleLibrary(bundle.rules))
  for (const c of chunks) game.loadChunk(decodeRawChunk(c, bundle.terrainChars))
  game.engine.controls.sync()
  const eng = game.engine
  for (let i = 0; i < 200 && (eng.world.scene || eng.world.fact('glade.arrived') !== 1); i++) {
    eng.tick()
    if (eng.world.scene?.waiting === 'advance') eng.story.advance()
  }
  return eng
}

export const put = (eng: Engine, e: Entity, x: number, y: number) => eng.author(() => eng.teleport(e, { map: 'glade', x, y }))

export const ticks = (eng: Engine, n: number) => {
  for (let i = 0; i < n; i++) eng.tick()
}

export const untilReady = (eng: Engine, id: string) => {
  for (let i = 0; i < 40 && !eng.ready(id); i++) eng.tick()
}

export function standBeside(eng: Engine, e: Entity, target: Entity): void {
  const at = eng.world.posOf(target)!
  const sides = [[-1, 0, 'right'], [1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']] as const
  const side = sides.find(([dx, dy]) => {
    put(eng, e, at.x + dx, at.y + dy)
    const now = eng.world.posOf(e)!
    return now.x === at.x + dx && now.y === at.y + dy
  })!
  e.facing = side[2]
}
