import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Engine, RuleLibrary, World } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '@openworld-game/content'

// Only outcomes and the clock change the state (design.md §5.13, A2), and an outcome writes only
// its host (A3). The world's mutators hold both checks at run time: they throw unless the one
// writer is lent to the caller, and, in an outcome, unless what they change is its host, held by
// it, or made by it (a fact: unless the host is the story or the world). These tests hold the
// rest: that nobody but the engine claims the writer, that game code never writes as the author,
// and that no game code changes the state behind the mutators' back (a prop, a tag, a fact set by
// hand).

const ROOT = join(import.meta.dirname, '..', '..', '..', '..')
/** The engine's modules: every folder of packages/modules/src, so a new module is scanned as soon as it is there. */
const MODULE_DIRS = readdirSync(join(ROOT, 'packages/modules/src'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `packages/modules/src/${d.name}`)
const GAME = ['packages/engine/src', ...MODULE_DIRS, 'games/openworld/content/src']
/** The client's code: the runtime and the game's own pages. */
const CLIENT = ['packages/runtime/src', 'games/openworld/client/src']

function sources(): { file: string; lines: string[] }[] {
  const out: { file: string; lines: string[] }[] = []
  for (const dir of GAME)
    for (const f of readdirSync(join(ROOT, dir)))
      if (f.endsWith('.ts')) out.push({ file: `${dir}/${f}`, lines: readFileSync(join(ROOT, dir, f), 'utf8').split(/\r?\n/) })
  return out
}

/** What changes the state behind the mutators: a thing's props, tags, statuses, place, contents; the things kept (entities). */
const WRITES: RegExp[] = [
  /\.(props|tags|statusBy|contents|held|place)!?\s*(\?\?)?=[^=]/,
  // a thing's statuses (not a rule library's status definitions)
  /(?<![\w.])(?!lib\b|cand\b|onto\b|this\b)\w+\.statuses!?(\[[^\]]+\])?\s*(\?\?)?=[^=]/,
  /\.(props|statusBy)!?(\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*(\?\?)?=[^=>]/,
  /\.tags!?\.(push|splice)\(/,
  /\(\s*[\w.!]+\.(props|tags|statuses) \?\?= /,
  /Object\.assign\([^,]*\.props/,
  /delete [\w.!]+\.(props|statuses|statusBy)\b/,
  /state\.entities!?(\.[\w$]+|\[[^\]]+\])!?\s*(\?\?)?=[^=]/,
  /delete [\w.!]*state\.entities/,
]

/**
 * Where each is allowed: the world (its mutators) and the effect runner (the primitives, in an
 * outcome) write; loading and building write as the author (Game, the sandbox) and so do the
 * content's migrations of older saves.
 */
const MAY_WRITE = ['packages/engine/src/world.ts', 'packages/engine/src/effects.ts', 'packages/engine/src/game.ts', 'packages/engine/src/sandbox.ts', 'packages/engine/src/sparse.ts', 'games/openworld/content/src/migrateFirstlight.ts', 'games/openworld/content/src/migrateBosses.ts']
const MAY_AUTHOR = ['packages/engine/src/engine.ts', 'packages/engine/src/game.ts', 'packages/engine/src/sandbox.ts']
const MAY_GRANT = ['packages/engine/src/engine.ts', 'packages/engine/src/world.ts']

const code = (l: string) => l.replace(/\/\/.*$/, '').trim()

describe('the state changes only in outcomes, and an outcome only its host (design.md §5.13, A2–A3)', () => {
  it('no game code changes props, tags, statuses, places or the kept things behind the mutators', () => {
    // every module is scanned, the ones the game names and the rest
    for (const m of ['classes', 'waypoints', 'boons', 'needs', 'society', 'loot', 'kits']) expect(MODULE_DIRS).toContain(`packages/modules/src/${m}`)
    const found: string[] = []
    for (const { file, lines } of sources()) {
      if (MAY_WRITE.includes(file)) continue
      lines.forEach((l, i) => {
        const c = code(l)
        if (c.startsWith('*') || c.startsWith('/*')) return
        if (WRITES.some((re) => re.test(c))) found.push(`${file}:${i + 1}: ${c.slice(0, 120)}`)
      })
    }
    expect(found).toEqual([])
  })

  it('the client changes the world only as the author (a new game, loading, the dev console) or through the input', () => {
    // a call of a world mutator or an engine move outside an author block
    const CALL = /\b(w|world|engine\.world|eng\.world|game\.engine\.world)\.(setFact|setStatus|clearStatus|setProp|addTag|removeTag|setTerrain|place|add|create|destroy|transform)\(|\b(eng|engine|game\.engine)\.(teleport|travel|applyStatus|removeStatus|hurt)\(/
    const found: string[] = []
    for (const src of CLIENT) {
      const dir = join(ROOT, src)
      const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts'))
      for (const f of files) {
        let depth = 0
        readFileSync(join(dir, f), 'utf8')
          .split(/\r?\n/)
          .forEach((l, i) => {
            const c = code(l)
            const opens = /author\(\(\) => \{/.test(c)
            if (depth === 0 && !opens && !c.includes('author(') && CALL.test(c)) found.push(`${src}/${f}:${i + 1}: ${c.slice(0, 120)}`)
            if (opens || depth > 0) depth += (c.match(/\{/g) ?? []).length - (c.match(/\}/g) ?? []).length
          })
      }
    }
    expect(found).toEqual([])
  })

  it('there are no kinds: no code branches on what kind of thing something is, no type or selector names one (world-model.md §4.2)', () => {
    const found: string[] = []
    for (const { file, lines } of sources())
      lines.forEach((l, i) => {
        const c = code(l)
        if (c.startsWith('*') || c.startsWith('/*')) return
        if (/\bkindOf\(/.test(c) || /\bkind: '(actor|item|fixture|tile|resident)'/.test(c) || /\bEntityKind\b/.test(c)) found.push(`${file}:${i + 1}: ${c.slice(0, 120)}`)
      })
    expect(found).toEqual([])
  })

  it('the scan sees the ways around the mutators, and not their definitions', () => {
    const hit = (c: string) => WRITES.some((re) => re.test(c))
    for (const c of [
      '(lead.props ??= {})[k] = v',
      'w.player.props!.quest = 0',
      "e.props.hp = hp + healed",
      'e.tags = (e.tags ?? []).filter((t) => t !== x)',
      ';(e.tags ??= []).push(skillTag(def.id))',
      'Object.assign(existing.props ??= {}, { hp: 1 })',
      'delete e.statuses',
      'target.statuses = {}',
      "w.state.entities['x'] = e",
      'delete w.state.entities[id]',
      'delete tile.statuses',
    ])
      expect(hit(c), c).toBe(true)
    for (const c of ['onto.statuses[s.id] = s', 'lib.statuses = [...this.statuses]', 'if (e.props?.hp === 1) x()', 'const props = { ...r.props }']) expect(hit(c), c).toBe(false)
  })

  it('only the engine claims the writer, and only loading and building write as the author', () => {
    const found: string[] = []
    for (const { file, lines } of sources())
      lines.forEach((l, i) => {
        const c = code(l)
        if (/\.grant\(\)/.test(c) && !MAY_GRANT.includes(file)) found.push(`${file}:${i + 1}: grant`)
        if (/\.author\(/.test(c) && !MAY_AUTHOR.includes(file)) found.push(`${file}:${i + 1}: author`)
      })
    expect(found).toEqual([])
  })

  it('the writer is held once; a write without it throws, and so does an outcome writing beyond its host', () => {
    const eng = new Engine({ tick: 0, seed: 1, rng: 1, player: 'p', entities: {}, maps: {}, loadedMaps: [], counter: 0, spawn: { map: 'm', x: 0, y: 0 } }, buildOntology(), new RuleLibrary(BASE_RULES))
    eng.ensureResidents()
    expect(() => eng.world.grant()).toThrow(/already held/)
    // a fact is the story's prop: kept outside an outcome, it throws like any other write
    expect(() => eng.world.setFact('x', 1)).toThrow(/outside an outcome/)
    expect(() => eng.world.add({ id: 'a', type: 'item/food/bread', place: { on: 'none' } })).toThrow(/outside an outcome/)
    eng.author(() => eng.world.setFact('x', 1))
    expect(eng.world.fact('x')).toBe(1)
    // an outcome writes its host, what it holds and what it makes — and nothing else (A3)
    const [a, b] = eng.author(() => [eng.world.create('item/food/bread', { on: 'none' }), eng.world.create('item/food/bread', { on: 'none' })])
    const inA = (f: () => void) => {
      const apply = eng.effects.apply
      eng.effects.apply = () => f()
      try {
        eng.run([{ op: 'log', text: '' }], { kind: 'time/period', host: { e: a.id }, roles: {}, params: {} }, 'test')
      } finally {
        eng.effects.apply = apply
      }
    }
    expect(() => inA(() => eng.world.setProp(a, 'x', 1))).not.toThrow()
    expect(() => inA(() => eng.world.setProp(b, 'x', 1))).toThrow(/writes only its host/)
    expect(() => inA(() => eng.world.setFact('y', 1))).toThrow(/writes only its host/)
    expect(() => inA(() => eng.world.setProp(eng.world.create('item/food/bread', { on: 'none' }), 'x', 1))).not.toThrow()
    // a world no engine holds cannot be written at all
    const loose = new World(eng.world.state, eng.world.onto)
    expect(() => loose.author(() => 0)).toThrow(/nobody may write it/)
  })
})

describe('the state is things and the clock (world-model.md §3)', () => {
  it('a played and saved Ford keeps nothing outside its things but the clock and the engine records', async () => {
    const { Game } = await import('@openworld/engine')
    const { STORY_RULES, decodeChunk } = await import('@openworld-game/content')
    const { buildFord } = await import('../src/demo/world.ts')
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    for (let i = 0; i < 600; i++) game.engine.tick()
    const state = game.save().state as unknown as Record<string, unknown>
    // the clock and the generator; the things; the maps' base data and what changed on their cells;
    // and the engine's own records (what is loaded, asked, frozen, related, reported), the clock's phase on each host
    // that keeps its own pace (paces) — no facts, topics, scenes, weather or memories beside the things they belong to
    const ALLOWED = ['tick', 'seed', 'rng', 'counter', 'player', 'spawn', 'entities', 'maps', 'tiles', 'loadedMaps', 'question', 'dormant', 'relations', 'reported', 'chunks', 'paces']
    expect(Object.keys(state).filter((k) => !ALLOWED.includes(k))).toEqual([])
    // the story and the world are things, and so are the maps' named areas
    const w = game.engine.world
    expect(w.get('story')?.place).toEqual({ on: 'resident' })
    expect(Object.values(w.state.entities).some((e) => e.type === 'region' && e.place.on === 'area')).toBe(true)
  })

  it("an older save's beats are steps of the story's one script: their records are seen.<id>, the latest step.last (world-model.md §6.12)", async () => {
    const { Game } = await import('@openworld/engine')
    const { STORY_RULES, decodeChunk } = await import('@openworld-game/content')
    const { buildFord } = await import('../src/demo/world.ts')
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const old = structuredClone(game.save())
    const story = old.state.entities.story
    story.props = { ...(story.props ?? {}), 'beat.see_waypoint': 40, 'beat.relic': 90, 'beat.last': 'relic' }
    const loaded = Game.load(old, index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const w = loaded.engine.world
    expect(w.fact('seen.see_waypoint')).toBe(40)
    expect(w.fact('seen.relic')).toBe(90)
    expect(w.fact('step.last')).toBe('relic')
    expect(Object.keys(w.story!.props ?? {}).filter((k) => k.startsWith('beat.'))).toEqual([])
    // what the companion repeats is the latest beat's hint
    expect(loaded.engine.story.hint()).toEqual(index.steps!.find((d) => d.id === 'relic')!.hint ?? index.steps!.find((d) => d.id === 'relic')!.say)
  })
})
