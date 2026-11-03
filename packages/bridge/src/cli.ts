// The relay on its own: agents speak to it, and a page opened with `?agents=http://127.0.0.1:8789` hosts the seats.
//
//   npx tsx packages/bridge/src/cli.ts [--port 8789]

import { agentServer } from './http.ts'
import { pageRelay } from './relay.ts'

const flag = process.argv.indexOf('--port')
const port = Number(flag >= 0 ? process.argv[flag + 1] : 8789)
const relay = pageRelay()
const log = (line: string) => console.log(new Date().toISOString().slice(11, 19), line)

agentServer(relay.dispatch, { log, extra: relay.extra }).listen(port, '127.0.0.1', () => {
  console.log(`OpenWorld agent relay: http://127.0.0.1:${port}  (open the game with ?agents=http://127.0.0.1:${port})`)
})
