// OpenWorld with nobody at the page: a new game in the Ford, ticked at the game's pace, with the agent protocol served
// over HTTP on 127.0.0.1 (docs/agent-play-guide.md). The player waits where the agents will sit.
//
//   npm run agents -- [--port 8788] [--at pasture,20,5]

import '@openworld/modules'
import { AgentHost, Game, RuleLibrary } from '@openworld/engine'
import { agentServer, localDispatch, runClock } from '@openworld/bridge'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from './demo/world.ts'

const flag = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`)
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback
}
const port = Number(flag('port', '8788'))
const [map, x, y] = flag('at', 'pasture,20,5').split(',')

const { index, chunks } = buildFord()
const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
for (const c of chunks) game.loadChunk(decodeChunk(c))
const eng = game.engine
eng.controls.sync()
eng.author(() => {
  eng.quests.put('descent', 'done')
  eng.world.setFact('seen.arrival', true)
  eng.teleport(eng.world.player, { map, x: Number(x), y: Number(y) })
})

const host = new AgentHost(eng)
const clock = runClock(eng, () => void host.tick())
const log = (line: string) => console.log(new Date().toISOString().slice(11, 19), line)
const server = agentServer(localDispatch(host), { log, seats: () => host.seats() })
server.listen(port, '127.0.0.1', () => console.log(`OpenWorld agent host: http://127.0.0.1:${port}  (GET /spec, POST /seat); the player waits at ${map} (${x},${y})`))
process.on('SIGINT', () => (clock.stop(), server.close(), process.exit(0)))
