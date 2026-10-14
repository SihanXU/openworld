// The game's probes (GameDef.probes; design.md §13, the AI setting): requests the game raises at holes of its own, which the
// modder's detection plays at every tier when its history has too few. The Ford's six kinds of hole
// (fordScenarios.ts), cells of the interaction sweep — the player's acts on things and on people and
// creatures — and what the world asks by itself over a day in Firstlight with nobody at the keys (as the
// headless check plays it), each raised through the engine's own path with no model connected, then
// frozen as data; one per kind of event, host and thing in it.
//
//   npm run probes        → games/openworld/content/src/probes.json

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Game, RuleLibrary, Rng, TICKS_PER_HOUR, categoryOfRequest, type AiCategory, type ModRequest } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from './demo/world.ts'
import { SCENARIOS, ready } from './fordScenarios.ts'
import { sweep } from './coverage.ts'
import { cellRequest } from './curriculum.ts'

/** Probes per kind of work (the detection plays up to this many of each). */
const PER = 4
const OUT = fileURLToPath(new URL('../../content/src/probes.json', import.meta.url))

const onto = buildOntology()
const probes: ModRequest[] = []
const count = (c: AiCategory) => probes.filter((p) => categoryOfRequest(p) === c).length
// one per kind of event and host: the questions as unlike as the game has them
const kindOf = (r: ModRequest) => `${r.event.kind}|${r.event.host?.type}|${r.event.roles.instrument?.type ?? r.event.roles.item?.type ?? r.event.roles.target?.type ?? ''}`
const fresh = (r: ModRequest) => count(categoryOfRequest(r)) < PER && !probes.some((p) => kindOf(p) === kindOf(r))
// what the detection reads of a request, and nothing of the moment it was raised at
const frozen = (req: ModRequest, id: string): ModRequest => {
  const { tier: _t, create: _c, ...rest } = req
  const { tier: _s, ...scenario } = req.scenario
  return { ...rest, id, scenario }
}

// the Ford's six kinds of hole, as a player meets them
for (const [i, sc] of SCENARIOS.entries()) {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const f = ready({ game, eng: game.engine })
  try {
    sc.act(f)
  } catch (err) {
    console.warn(`${sc.name}: ${(err as Error).message}`)
    continue
  }
  const rec = game.mods.records[0]
  if (!rec) console.warn(`${sc.name}: no request raised`)
  else if (fresh(rec.request)) probes.push(frozen(rec.request, `probe-ford-${i}`))
}

// cells of the sweep, spread over targets, for the kinds of work the Ford has too few of
const lib = new RuleLibrary(BASE_RULES)
const open = new Rng(7).shuffle(sweep(onto, BASE_RULES).cells.filter((c) => c.outcome === 'undefined'))
for (const cell of open) {
  if ((['things', 'people'] as AiCategory[]).every((c) => count(c) >= PER)) break
  const req = cellRequest(cell, onto, lib)
  if (!req || !fresh(req)) continue
  probes.push(frozen(req, `probe-cell-${probes.length}`))
}

// the world's own: a day in Firstlight with nobody at the keys (the headless check's), what it would have asked
{
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  eng.author(() => eng.teleport(eng.world.player, { map: 'meadow', x: 20, y: 14 }))
  for (let t = 0; t < TICKS_PER_HOUR * 24 && count('world') < PER; t++) {
    if (eng.world.scene) eng.story.advance()
    eng.tick()
    for (const rec of game.mods.records) if (rec.origin === 'world' && fresh(rec.request)) probes.push(frozen(rec.request, `probe-world-${probes.length}`))
  }
}

writeFileSync(OUT, JSON.stringify(probes, null, 1) + '\n')
console.log(`${probes.length} probes → ${OUT}: ${(['things', 'people', 'world'] as AiCategory[]).map((c) => `${c} ${count(c)}`).join(', ')}`)
for (const p of probes) console.log(`  [${categoryOfRequest(p)}] ${p.summary}`)
