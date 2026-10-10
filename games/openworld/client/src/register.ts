// The game handed to the runtime (packages/runtime/src/game.ts): every page and the worker import this first.

import { useGame } from '@openworld/runtime/src/game.ts'
import { CLIENT_GAME } from './game.ts'

useGame(CLIENT_GAME)
