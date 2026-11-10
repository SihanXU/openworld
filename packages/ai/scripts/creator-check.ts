// Fresh-process restoration checks the candidate with its own workspace dependencies and mechanism registry.
import { readFileSync } from 'node:fs'
import { CreatorSession, type CreatorSessionConfig } from '../src/service/creator-session.ts'
console.log = (...args: unknown[]) => console.error(...args)
const config = JSON.parse(readFileSync(process.argv[2], 'utf8')) as CreatorSessionConfig
const session = await CreatorSession.open(config)
process.stdout.write(JSON.stringify({ save: session.game.save(), drafts: session.state.published ? session.integrationDrafts() : session.state.drafts, checks: session.state.checks, published: session.state.published }))
