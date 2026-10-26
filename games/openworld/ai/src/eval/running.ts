// The running world (paper §7.2): as Generative Agents run Smallville for two game days and measure what spreads, the
// world runs with explorers at the keys (play.ts's: a bag of what the world places, walking, travelling, using,
// handing, taking and putting), each in a world of their own, and one modder at the default tier answering every
// undefined outcome into one shared library that every world syncs from, as the game's worker syncs from the service.
// A player's act that waits for its answer pauses that player's world, for 20 s at most, then the hole's default runs
// and the late answer still teaches the library (the worker's loop). What the world did by itself is read from the
// engines: the answers learned and where they were used (in the world that asked, in the others), the chains in which
// a learned rule's outcome went on to the base rules, the deeds people remember and the watches' bounties, the
// quests' stages. Costs model calls: --budget stops asking once the model's spend reaches it (the default runs, as
// with no model). Revisions after shipping are off, to spend the budget on questions.
//
//   LSW_MODEL_BACKEND=anthropic npx tsx games/openworld/ai/src/eval/running.ts [--players 3] [--hours 24] [--budget 15] [--out var/eval/running]

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AI_WAIT_MS, Game, RuleLibrary, TICKS_PER_HOUR, type MapChunk } from '@openworld/engine'
import { BASE_RULES, FORMS, GAME, STORY_RULES, buildOntology, decodeChunk, wildChunkFor } from '@openworld-game/content'
import { modelFromEnv, openModder } from '@openworld/ai'
import type { Model } from '@openworld/ai'
import { buildFord } from '../../../tools/src/demo/world.ts'
import { flags, sleep } from '../cli.ts'

const opt = flags(process.argv.slice(2))
const PLAYERS = Number(opt('players', '3'))
const HOURS = Number(opt('hours', '24'))
const BUDGET = Number(opt('budget', '15'))
const OUT = opt('out', 'var/eval/running')!
mkdirSync(OUT, { recursive: true })

// ---------------------------------------------------------------- the modder, with a budget

const inner = modelFromEnv()
if (!inner) throw new Error('no model (LSW_MODEL_BACKEND=anthropic)')
let spent = 0
let refused = 0
const model: Model = {
  name: inner.name,
  async chat(messages, o) {
    if (spent >= BUDGET) {
      refused++
      throw new Error(`the budget of $${BUDGET} is spent`)
    }
    const r = await inner.chat(messages, o)
    spent += r.usage?.cost ?? 0
    return r
  },
}
const modder = openModder({ game: GAME, data: join(OUT, 'modder'), model })
const { library, state } = modder.opts
const h = state.harness()
state.setHarness({ ...h, revise: false }, 'the running world: no revisions after shipping')

// ---------------------------------------------------------------- the worlds

const world = buildFord()
const raw = new Map([...world.chunks, ...world.backdrop].map((c) => [c.map.id, c]))
const onto = buildOntology()
const PLAYED = world.chunks.map((c) => c.map.id).filter((id) => !['tutorial', 'offstage', 'overworld'].includes(id) && !id.startsWith('haven'))
const PLACES = world.backdrop.map((c) => c.map.id)
const KINDS = new Set(FORMS.map((f) => f.id))
const CARRY = [...world.chunks, ...world.backdrop].flatMap((c) => c.entities.filter((e) => e.type.startsWith('item/') && KINDS.has(e.type)).map((e) => e.type))
const BAG = 10

/** Which world asked for each learned rule. */
const askedBy = new Map<string, number>()
interface Tally {
  acts: number
  raised: number
  /** events answered by a learned rule: its own world's (the one that asked), another's */
  ownFired: number
  otherFired: number
  /** learned rules another world asked for, used here */
  borrowed: Set<string>
  /** chains in which a learned rule answered and a base rule answered after it */
  crossed: number
  crossedBy: Record<string, number>
  waited: number[]
  lateDefaults: number
}

async function player(p: number): Promise<{ game: Game; tally: Tally }> {
  let s = p + 1
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]
  const game = Game.create(world.index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  game.keepMaps = 8
  const eng = game.engine
  const w = eng.world
  const tally: Tally = { acts: 0, raised: 0, ownFired: 0, otherFired: 0, borrowed: new Set(), crossed: 0, crossedBy: {}, waited: [], lateDefaults: 0 }
  // the shared library: answers asked here come back with their patch; everyone's come by the sync
  game.mods.provider = {
    resolve: async (request) => {
      try {
        const r = await modder.resolve({ request }, 'live')
        for (const id of (r.episode && state.episode(r.episode)?.rules) ?? []) if (!askedBy.has(id)) askedBy.set(id, p)
        return r.patch
      } catch {
        return null
      }
    },
  }
  let seq = 0
  const sync = () => {
    for (const e of library.since(seq)) {
      seq = Math.max(seq, e.seq)
      if ('remove' in e) {
        if (eng.lib.rules.get(e.remove as string)?.source?.origin === 'patch') eng.lib.remove(e.remove as string)
      } else if ('patch' in e && e.patch) game.mods.submit(undefined, e.patch, e.scenario, e.replaces, e.request)
    }
  }
  const chunkOf = (id: string): MapChunk => {
    const file = raw.get(id)
    if (file) return decodeChunk(structuredClone(file))
    if (!w.map('overworld')) game.loadChunk(chunkOf('overworld'))
    return wildChunkFor(w, id)!
  }
  const arrive = (id: string) => {
    if (!w.map(id)) game.loadChunk(chunkOf(id))
    for (const n of game.neededMaps()) game.loadChunk(chunkOf(n))
  }
  arrive(w.state.spawn.map)
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
  })
  const travel = () => {
    const to = rnd() < 0.5 ? pick(PLAYED) : pick(PLACES)
    arrive(to)
    const m = w.map(to)!
    for (let k = 0; k < 200; k++) {
      const x = Math.floor(rnd() * m.width), y = Math.floor(rnd() * m.height)
      if (w.fits(w.player, to, x, y)) {
        eng.author(() => eng.teleport(w.player, { map: to, x, y }))
        break
      }
    }
    game.trim()
  }
  travel()
  const bag = Array.from({ length: BAG }, () => pick(CARRY))
  let made = 0
  let mark = eng.traced
  const chains = new Map<number, { learned: boolean; crossed: boolean }>()
  const read = () => {
    const fresh = eng.trace.slice(Math.max(0, eng.trace.length - (eng.traced - mark)))
    mark = eng.traced
    for (const t of fresh) {
      if (!t.rule || t.ev.kind.startsWith('time/')) continue
      const learned = eng.lib.rules.get(t.rule)?.source?.origin === 'patch'
      if (learned) {
        const by = askedBy.get(t.rule)
        if (by === undefined || by === p) tally.ownFired++
        else (tally.otherFired++, tally.borrowed.add(t.rule))
      }
      const c = t.ev.chain
      if (c === undefined) continue
      const ch = chains.get(c) ?? { learned: false, crossed: false }
      if (learned) ch.learned = true
      else if (ch.learned && !ch.crossed) {
        ch.crossed = true
        tally.crossed++
        tally.crossedBy[t.rule] = (tally.crossedBy[t.rule] ?? 0) + 1
      }
      chains.set(c, ch)
    }
    if (chains.size > 5000) chains.clear()
  }
  for (let hr = 0; hr < HOURS; hr++) {
    if (hr % 2 === 0 && hr) travel()
    for (let k = 0; k < 2; k++) bag[Math.floor(rnd() * BAG)] = pick(CARRY)
    for (let t = 0; t < TICKS_PER_HOUR; t++) {
      // the player's act waits for its outcome: this world pauses with it, so long, then the default runs
      const asking = game.mods.asking
      if (asking) {
        const since = Date.now()
        while (game.mods.asking?.id === asking.id && Date.now() - since < AI_WAIT_MS) await sleep(100)
        tally.waited.push(Date.now() - since)
        if (game.mods.asking?.id === asking.id) (game.mods.fallback(asking.id), tally.lateDefaults++)
        read()
      }
      if (t % 10 === 0 && rnd() < 0.6) eng.movePlayer(pick(['up', 'down', 'left', 'right'] as const), true)
      if (t % 30 === 15 && !w.state.question) {
        const at = w.posOf(w.player)
        if (at) {
          const near = w.entitiesOnMap(at.map).filter((e) => e.id !== w.player.id && e.place.on === 'tile' && Math.abs((e.place as any).x - at.x) + Math.abs((e.place as any).y - at.y) <= 2)
          const target = near.length && rnd() < 0.8 ? { e: pick(near).id } : (w.cellRef(at.map, at.x, Math.max(0, at.y - 1)) as any)
          const r = rnd()
          try {
            if (r < 0.7) {
              const id = `carry.${made++}`
              eng.author(() => w.add({ id, type: pick(bag), place: { on: 'hand', holder: w.player.id } }))
              eng.act('use', w.player.id, target, { instrument: { e: id } })
              const held = w.get(id)
              if (held && held.place.on === 'hand' && !held.frozenBy) eng.author(() => w.destroy(held))
            } else if (r < 0.85) eng.act('hands', w.player.id, target)
            else if (r < 0.93) eng.act('take', w.player.id, target)
            else {
              const id = `carry.${made++}`
              eng.author(() => w.add({ id, type: pick(bag), place: { on: 'hand', holder: w.player.id } }))
              eng.act('put', w.player.id, target, { instrument: { e: id } })
            }
            tally.acts++
          } catch {
            // an act the world refuses is no situation
          }
        }
      }
      if (w.scene) eng.story.advance()
      eng.tick()
      for (const n of game.neededMaps()) arrive(n)
      read()
      if (t % 50 === 0) {
        sync()
        await sleep(0)
      }
    }
    tally.raised = game.mods.records.length
    console.log(`[${p}] hour ${hr + 1}: ${tally.acts} acts, ${tally.raised} undefined, learned ${library.lib.patches().length} rules in all, fired here ${tally.ownFired}+${tally.otherFired} (borrowed ${tally.borrowed.size}), crossed ${tally.crossed}, spent $${spent.toFixed(2)}`)
  }
  sync()
  return { game, tally }
}

// ---------------------------------------------------------------- run, then read the worlds

const runs = await Promise.all(Array.from({ length: PLAYERS }, (_, p) => player(p)))
await modder.settled()
const society = runs.map(({ game }) => {
  const w = game.engine.world
  const deeds = new Set<string>()
  let memories = 0
  for (const e of w.people()) for (const d of e.npc?.memory?.deeds ?? []) (memories++, deeds.add(`${d.deed}|${d.by ?? ''}|${d.thing ?? ''}|${d.tick}`))
  let bounties = 0
  for (const e of w.residents()) for (const [k, v] of Object.entries(e.props ?? {})) if (k.startsWith('bounty:') && Number(v) > 0) bounties++
  const quests = game.engine.quests.all().flatMap((q) => {
    const id = game.engine.quests.defOf(q)?.id
    return id ? [{ id, stage: game.engine.quests.stage(id) }] : []
  })
  return { deeds: deeds.size, memories, bounties, quests }
})
const episodes = state.episodes()
const result = {
  players: PLAYERS, hours: HOURS, budget: BUDGET, spent: +spent.toFixed(2), refusedCalls: refused,
  learned: library.lib.patches().length,
  answers: episodes.filter((e) => e.outcome === 'accepted').length,
  perPlayer: runs.map(({ tally }, p) => ({
    player: p, acts: tally.acts, undefined: tally.raised,
    firedOwn: tally.ownFired, firedOthers: tally.otherFired, borrowed: tally.borrowed.size,
    crossed: tally.crossed, crossedInto: Object.entries(tally.crossedBy).sort((a, b) => b[1] - a[1]).slice(0, 8),
    waits: tally.waited.length, waitMedianS: tally.waited.length ? +(tally.waited.sort((a, b) => a - b)[Math.floor(tally.waited.length / 2)] / 1000).toFixed(1) : 0, lateDefaults: tally.lateDefaults,
    ...society[p],
  })),
}
writeFileSync(join(OUT, 'running.json'), JSON.stringify(result, null, 1))
console.log(JSON.stringify(result, null, 1))
process.exit(0)
