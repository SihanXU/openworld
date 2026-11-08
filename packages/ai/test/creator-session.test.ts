import { afterEach, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { Game, RuleLibrary, creationMaps, decodeRawChunk, workshopPackages, type Ontology, type WorldIndex } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { CreatorSession, creatorDigest } from '../src/service/creator-session.ts'
import { CreatorCoordinator } from '../src/service/creator.ts'
import { OpenAICompatModel, ScriptedModel } from '../src/models/model.ts'
import { sourceVersion } from '../src/agent/source-version.ts'
import { adoptCreatorDrafts } from '@openworld/runtime/src/creator.ts'

const root = resolve(import.meta.dirname, '../../..'), directories: string[] = []
afterEach(() => { for (const dir of directories.splice(0)) { if (!relative(resolve(root, '.tmp'), dir).startsWith('..')) rmSync(dir, { recursive: true, force: true }) } })
const GOODS = 'item/material/seed'
const onto: Ontology = { ...structuredClone(STDLIB_ONTOLOGY as Ontology), types: { ...STDLIB_ONTOLOGY.types,
  'item/material': { id: 'item/material', name: 'Material' }, [GOODS]: { id: GOODS, name: 'Seed', props: { value: 2 } },
  'item/misc/token': { id: 'item/misc/token', name: 'Token', props: { value: 2 } },
}, terrains: { grass: { id: 'grass', name: 'Grass', tags: ['ground'] } } }
const plan = { version: 1, uses: [{ id: 'inspect', label: { en: 'Examine', zh: '查看' }, capability: 'inspect', target: 'self' }] }

it('exposes an interrupted order as resumable after the service restarts', () => {
  mkdirSync(resolve(root, '.tmp'), { recursive: true })
  const data = mkdtempSync(resolve(root, '.tmp/creator-restart-')); directories.push(data)
  const options = { root, data, gameModule: 'unused', worldDirectory: 'unused' }
  const first = new CreatorCoordinator(options)
  const job = first.jobs.create('Keep this order')
  const folder = resolve(data, 'runs', job.id)
  mkdirSync(folder, { recursive: true })
  writeFileSync(resolve(folder, 'result.json'), JSON.stringify({ id: job.id, status: 'running', order: job.order }))
  const restarted = new CreatorCoordinator(options)
  expect(restarted.status(job.id)).toMatchObject({ id: job.id, status: 'failed', error: expect.stringContaining('Resume the retained job'), task: { id: job.id } })
})
async function fixture() {
  mkdirSync(resolve(root, '.tmp'), { recursive: true })
  const dir = mkdtempSync(resolve(root, '.tmp/creator-session-')); directories.push(dir)
  const raw = { map: { id: 'home', name: 'Workshop', kind: 'workshop', width: 7, height: 7, rows: Array(7).fill('.......'), portals: [] }, entities: [] }
  const index: WorldIndex = { name: 'Creator test', version: 'creator-test', seed: 11, start: { map: 'home', x: 3, y: 3 },
    maps: [{ id: 'home', name: 'Workshop', kind: 'workshop', width: 7, height: 7, portals: [], npcs: 0, items: 0 }],
    npcs: [], player: { id: 'player', type: 'actor/person/player', place: { on: 'none' } }, stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 1, fixtures: 0 } }
  const game = Game.create(index, structuredClone(onto), new RuleLibrary(structuredClone(STDLIB_RULES)))
  game.loadChunk(decodeRawChunk(raw, { '.': 'grass' }))
  game.engine.author(() => { for (let i = 0; i < 6; i++) game.engine.world.create(GOODS, { on: 'inside', holder: 'player' }) })
  writeFileSync(resolve(dir, 'game.ts'), `import { STDLIB_RULES } from '@openworld/stdlib'; export default {id:'fixture',ontology:()=>(${JSON.stringify(onto)}),rules:STDLIB_RULES,terrainChars:{'.':'grass'}}`)
  mkdirSync(resolve(dir, 'world/maps'), { recursive: true })
  writeFileSync(resolve(dir, 'world/index.json'), JSON.stringify(index)); writeFileSync(resolve(dir, 'world/maps/home.json'), JSON.stringify(raw))
  const config = { root, gameModule: resolve(dir, 'game.ts'), worldDirectory: resolve(dir, 'world'), directory: resolve(dir, 'session'), jobId: 'session_test', save: game.save() }
  const session = await CreatorSession.open(config)
  const call = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(await session.tools().find(t => t.name === name)!.run(args))
  return { session, call, config }
}

it('gives a resumed executor its actionable task and retained native inputs before the full guide', async () => {
  const { session, config } = await fixture()
  session.close()
  const data = resolve(config.directory, 'resume-jobs')
  let received = ''
  const coordinator = new CreatorCoordinator({ root, data, gameModule: config.gameModule, worldDirectory: config.worldDirectory,
    executeAgent: async request => { received = request.order; throw new Error('Stop after inspecting executor input') },
  })
  const job = coordinator.jobs.create('Make a garden')
  coordinator.jobs.plan(job.id, { tasks: [{ id: 'discover', kind: 'research', title: 'Discover existing crops' }, { id: 'play', kind: 'verification', title: 'Plant and harvest', dependsOn: ['discover'] }] })
  await coordinator.jobs.verify(job.id, 'discover', 'actual', () => ({ ok: true, summary: 'Existing crops found' }))
  const folder = resolve(data, 'runs', job.id), host = resolve(folder, 'host')
  mkdirSync(resolve(host, 'playtest'), { recursive: true })
  writeFileSync(resolve(host, 'playtest/latest-inputs.json'), JSON.stringify({ actions: [{ action: 'key', key: 'e' }] }))
  for (const [file, value] of Object.entries({ 'result.json': { id: job.id, status: 'failed', order: job.order, runs: [] }, 'order.json': { order: job.order, save: config.save }, 'baseline.json': {}, 'context.json': { ...config, directory: host, jobId: job.id, jobStore: resolve(data, 'tasks') } })) writeFileSync(resolve(folder, file), JSON.stringify(value))
  coordinator.resume(job.id)
  await coordinator.wait(job.id)
  expect(received.indexOf('Continue task play')).toBeLessThan(received.indexOf('Player order:'))
  expect(received).toContain('Start with replay_playtest')
  expect(received).toContain('"id":"discover","status":"verified"')
})

it.each([false, true])('recovers source publication without rerunning the agent (defer=%s)', async defer => {
  const { session, config } = await fixture()
  session.close()
  const data = resolve(config.directory, 'jobs'), live = resolve(data, 'live'), workspace = resolve(data, 'candidate')
  for (const dir of [live, workspace]) mkdirSync(resolve(dir, 'packages'), { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: workspace })
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '--no-gpg-sign', '-qm', 'fixture baseline'], { cwd: workspace })
  const a = 'packages/花园.ts', b = 'packages/second.ts'
  const hash = (s: string) => createHash('sha256').update(s).digest('hex')
  const baseline = { [b]: hash('original B') }
  writeFileSync(resolve(workspace, a), 'approved A'); writeFileSync(resolve(workspace, b), 'approved B')
  writeFileSync(resolve(live, a), 'approved A'); writeFileSync(resolve(live, b), 'unrelated change')
  const coordinator = new CreatorCoordinator({ root: live, data, gameModule: 'unused', worldDirectory: 'unused', cli: 'must-not-run' })
  const job = coordinator.jobs.create('Continue the approved change')
  const folder = resolve(data, 'runs', job.id)
  mkdirSync(folder, { recursive: true })
  const write = (name: string, value: unknown) => writeFileSync(resolve(folder, name), JSON.stringify(value))
  write('order.json', { order: job.order, save: config.save, deferSource: defer })
  write('context.json', { root: workspace })
  write('baseline.json', baseline)
  write('publication.json', { save: config.save, drafts: {}, checks: [{ kind: 'types', passed: true, result: { sourceHash: sourceVersion(workspace) } }] })
  write('result.json', { id: job.id, status: 'repairing', order: job.order, runs: [] })
  write('source-promotion.json', { status: 'prepared', desired: { [a]: hash('approved A'), [b]: hash('approved B') } })
  writeFileSync(resolve(workspace, b), 'unverified B')
  coordinator.resume(job.id)
  expect(await coordinator.wait(job.id)).toMatchObject({ status: 'failed', error: 'The verified workspace changed before publication', runs: [] })
  expect(readFileSync(resolve(live, b), 'utf8')).toBe('unrelated change')
  writeFileSync(resolve(workspace, b), 'approved B')
  coordinator.resume(job.id)
  if (defer) {
    expect(await coordinator.wait(job.id)).toMatchObject({ status: 'ready', candidate: { needsPublication: true }, runs: [] })
    expect(() => coordinator.approve(job.id)).toThrow(b)
    expect(coordinator.status(job.id).candidate?.needsPublication).toBe(true)
  } else expect(await coordinator.wait(job.id)).toMatchObject({ status: 'failed', error: expect.stringContaining(b), runs: [] })
  expect(readFileSync(resolve(live, b), 'utf8')).toBe('unrelated change')
  writeFileSync(resolve(live, b), 'original B')
  if (defer) coordinator.approve(job.id)
  else coordinator.resume(job.id)
  expect(await coordinator.wait(job.id)).toMatchObject({ id: job.id, status: 'ready', runs: [], candidate: { sourceChanged: true } })
  expect(readFileSync(resolve(live, a), 'utf8')).toBe('approved A')
  expect(readFileSync(resolve(live, b), 'utf8')).toBe('approved B')
})

it('makes a map loadable without a source transaction when the agent only wrote scratch files', async () => {
  const { session, call, config } = await fixture()
  const raw = { map: { id: 'garden', name: 'Garden', kind: 'workshop', width: 7, height: 7, rows: Array(7).fill('.......'), portals: [] }, entities: [] }
  const draft = await call('propose_content', { kind: 'map', key: 'garden', raw })
  expect((await call('adopt_content', { id: draft.id })).ok).toBe(true)
  expect((await call('publish_content')).ok).toBe(true)
  const candidate = { save: session.game.save(), drafts: session.integrationDrafts() }
  session.close()

  const data = resolve(config.directory, 'map-jobs'), workspace = resolve(data, 'candidate')
  mkdirSync(workspace, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: workspace })
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '--no-gpg-sign', '-qm', 'fixture baseline'], { cwd: workspace })
  writeFileSync(resolve(workspace, 'scratch.txt'), 'Layout notes for the garden')
  const coordinator = new CreatorCoordinator({ root, data, gameModule: 'unused', worldDirectory: 'unused', cli: 'must-not-run' })
  const job = coordinator.jobs.create('Make a garden')
  const folder = resolve(data, 'runs', job.id)
  mkdirSync(folder, { recursive: true })
  for (const [name, value] of Object.entries({
    'order.json': { order: job.order, save: config.save, deferSource: true },
    'context.json': { root: workspace },
    'baseline.json': {},
    'publication.json': { ...candidate, checks: [{ kind: 'types', passed: true, result: { sourceHash: sourceVersion(workspace) } }] },
    'result.json': { id: job.id, status: 'repairing', order: job.order, runs: [] },
  })) writeFileSync(resolve(folder, name), JSON.stringify(value))
  coordinator.resume(job.id)
  const ready = await coordinator.wait(job.id)
  expect(ready).toMatchObject({ status: 'ready', runs: [], candidate: { sourceChanged: false } })
  expect(ready.candidate?.needsPublication).toBeUndefined()
  expect(existsSync(resolve(folder, 'source-promotion.json'))).toBe(false)

  const live = await CreatorSession.open({ ...config, directory: resolve(data, 'live') })
  adoptCreatorDrafts(live.game, live.workshop, ready.candidate!.drafts, [], { '.': 'grass' })
  expect(creationMaps(live.engine)).toMatchObject([{ raw: { map: { name: 'Garden' } } }])
  live.close()
})

it('returns the NPC reply when the discussion log cannot be written', async () => {
  mkdirSync(resolve(root, '.tmp'), { recursive: true })
  const data = mkdtempSync(resolve(root, '.tmp/creator-discussion-')); directories.push(data)
  writeFileSync(resolve(data, 'discussions'), 'A file prevents creating the log directory')
  const expected = { ready: false, reply: { en: 'What would you like to plant?', zh: '你想种什么？' } }
  const model = new ScriptedModel(() => expected)
  const chat = vi.spyOn(OpenAICompatModel.prototype, 'chat').mockImplementation(model.chat.bind(model))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const coordinator = new CreatorCoordinator({ root, data, gameModule: 'unused', worldDirectory: 'unused', environment: { ANTHROPIC_API_KEY: 'test' } })
    await expect(coordinator.discuss({ message: '做个花园', kind: 'map', history: [] })).resolves.toEqual(expected)
    expect(warn).toHaveBeenCalledWith('Could not save creator discussion log:', expect.any(String))
  } finally { chat.mockRestore(); warn.mockRestore() }
})

it('queries real state, isolates a failed craft, adopts a corrected tree once, and restores its package', async () => {
  const { session, call, config } = await fixture()
  const raw = { map: { id: 'garden', name: 'Garden', kind: 'workshop', width: 7, height: 7, rows: Array(7).fill('.......'), portals: [] }, entities: [] }
  const garden = await call('propose_content', { kind: 'map', key: 'garden', raw })
  const found = await call('search_world', { query: 'seed', kinds: ['entity', 'type'] })
  expect(JSON.stringify(found)).toContain(GOODS)
  const design = (count: number) => ({ kind: 'new', name: { en: 'Seed bead', zh: '种子珠' }, idea: 'A carved seed bead', type: {
    id: 'item/misc/seed_bead', name: { en: 'Seed bead', zh: '种子珠' }, props: { value: 2 }, makeup: [{ type: GOODS, count }], station: 'hands' } })
  const before = creatorDigest({ state: session.engine.world.state, library: session.engine.lib.toJSON() })
  const bad = await call('propose_content', { kind: 'item', key: 'bead', design: design(60), plan })
  expect(bad.ok, JSON.stringify(bad)).toBe(true)
  const refused = await call('trial_content', { id: bad.id })
  expect(refused.ok).toBe(false); expect(refused.isolated).toBe(true)
  expect(creatorDigest({ state: session.engine.world.state, library: session.engine.lib.toJSON() })).toBe(before)
  const good = await call('propose_content', { kind: 'item', key: 'bead', design: design(2), plan })
  expect(good.id).toBe(bad.id); expect(good.draft.item.revision).toBe(2)
  const ready = await call('trial_content', { id: good.id }); expect(ready.ok, JSON.stringify(ready)).toBe(true)
  const adopted = await call('adopt_content', { id: good.id })
  expect(adopted.ok, JSON.stringify(adopted)).toBe(true)
  expect(session.engine.controls.count(GOODS)).toBe(4)
  expect((await call('adopt_content', { id: good.id })).ok).toBe(false)
  expect(session.engine.controls.count(GOODS)).toBe(4)
  const revised = await call('propose_content', { kind: 'uses', subject: good.id, plan })
  expect((await call('adopt_content', { id: revised.id })).ok).toBe(true)
  expect(session.engine.controls.count(GOODS)).toBe(4)
  const extraUse = { ...plan.uses[0], id: 'inspect_back' }
  const appended = await call('propose_content', { kind: 'uses', operation: 'append', subject: good.id, plan: { version: 1, uses: [extraUse] } })
  expect((await call('adopt_content', { id: appended.id })).ok).toBe(true)
  expect((await call('adopt_content', { id: garden.id })).ok).toBe(true)
  expect((await call('publish_content')).ok).toBe(true)
  const drafts = session.integrationDrafts()
  expect(Object.keys(drafts)).toEqual([`${good.id}@3`, good.id, garden.id])
  const live = await fixture()
  adoptCreatorDrafts(live.session.game, live.session.workshop, drafts, [], { '.': 'grass' })
  expect(live.session.engine.controls.count(GOODS)).toBe(4)
  expect(workshopPackages(live.session.engine).filter(p => p.enabled)).toMatchObject([{ id: good.id, revision: 4 }])
  expect(creationMaps(live.session.engine).map(m => m.id)).toContain(garden.id)
  live.session.close()
  const restored = await CreatorSession.open(config)
  expect(restored.engine.controls.count(GOODS)).toBe(4)
  expect(workshopPackages(restored.engine).filter(p => p.enabled)).toMatchObject([{ id: good.id, revision: 4 }])
  expect((await call('use_content', { id: good.id, use: 'inspect' })).ok).toBe(true)
  restored.close(); session.close()
})

it('inspects and revises an installed region in a new job, retaining its package identity and entrance', async () => {
  const { session, call, config } = await fixture()
  const raw = { map: { id: 'garden', name: 'Garden', kind: 'workshop', width: 7, height: 7, rows: Array(7).fill('.......'), portals: [] }, entities: [] }
  const first = await call('propose_content', { kind: 'map', key: 'garden', raw })
  const adopted = await call('adopt_content', { id: first.id }); expect(adopted.ok, JSON.stringify(adopted)).toBe(true)
  const old = creationMaps(session.engine)[0], next = await CreatorSession.open({ ...config, directory: resolve(config.directory, '../revision'), jobId: 'map_revision', save: session.game.save(), target: { kind: 'map', id: old.id, operation: 'revise' } })
  const ask = async (name: string, args: Record<string, unknown> = {}) => JSON.parse(await next.tools().find(t => t.name === name)!.run(args))
  const inspected = await ask('inspect_map', { id: old.raw.map.id }); expect(inspected.package).toMatchObject({ id: old.id, revision: 1, source: old.source })
  const revision = await ask('propose_content', { kind: 'map', operation: 'revise', raw: { ...raw, map: { ...raw.map, name: 'Orchard' } } })
  expect(revision.draft.map).toMatchObject({ id: old.id, revision: 2 })
  const changed = await ask('adopt_content', { id: old.id }); expect(changed.ok, JSON.stringify(changed)).toBe(true)
  const latest = creationMaps(next.engine).find(m => m.revision === 2)!
  expect(latest).toMatchObject({ id: old.id, source: old.source, raw: { map: { name: 'Orchard' } } })
  expect(next.engine.world.posOf(next.engine.world.player)?.map).toBe(latest.raw.map.id)
  next.close(); session.close()
})

it('appends a placed object to an installed map while retaining its entrance, player and existing object state', async () => {
  const { session, call, config } = await fixture()
  const raw = { map: { id: 'garden', name: 'Garden', kind: 'workshop', width: 7, height: 7, rows: Array(7).fill('.......'), portals: [] },
    entities: [{ id: 'seed', type: GOODS, place: { on: 'tile', map: 'garden', x: 4, y: 4 } }] }
  const created = await call('propose_content', { kind: 'map', key: 'garden', raw })
  expect((await call('adopt_content', { id: created.id })).ok).toBe(true)
  const base = creationMaps(session.engine)[0], original = base.raw.entities[0]
  session.engine.author(() => session.engine.world.place(session.engine.world.get(original.id)!, { on: 'inside', holder: 'player' }))
  const position = session.engine.world.posOf(session.engine.world.player)
  const appendConfig = { ...config, directory: resolve(config.directory, '../append'), jobId: 'map_append', save: session.game.save(), target: { kind: 'map' as const, id: base.id } }
  const nextSession = await CreatorSession.open(appendConfig)
  const ask = async (name: string, args: Record<string, unknown>) => JSON.parse(await nextSession.tools().find(t => t.name === name)!.run(args))
  expect((await ask('propose_content', { kind: 'map', raw })).ok).toBe(false)
  expect((await ask('propose_content', { kind: 'map', operation: 'revise', raw })).ok).toBe(false)
  const proposed = await ask('propose_content', { kind: 'map', operation: 'append', subject: base.id,
    objects: [{ id: 'new-seed', type: GOODS, place: { on: 'tile', map: base.raw.map.id, x: 5, y: 5 } }] })
  expect(proposed.ok, JSON.stringify(proposed)).toBe(true)
  expect((await ask('adopt_content', { id: proposed.id })).ok).toBe(true)
  const next = creationMaps(nextSession.engine)[0]
  expect(next).toMatchObject({ revision: base.revision + 1, source: base.source, entry: base.entry, gate: base.gate })
  expect(next.raw.map).toEqual(base.raw.map)
  expect(nextSession.engine.world.posOf(nextSession.engine.world.player)).toEqual(position)
  expect(nextSession.engine.world.get(original.id)?.place).toEqual({ on: 'inside', holder: 'player' })
  const firstAddition = next.raw.entities.at(-1)!.id
  expect(nextSession.engine.world.get(firstAddition)?.place).toMatchObject({ map: base.raw.map.id, x: 5, y: 5 })
  const followUp = await ask('propose_content', { kind: 'map', subject: base.id,
    objects: [{ id: 'third-seed', type: GOODS, place: { on: 'tile', map: base.raw.map.id, x: 5, y: 4 } }] })
  expect(followUp.draft.map.appendFrom).toBe(next.revision)
  expect((await ask('adopt_content', { id: followUp.id })).ok).toBe(true)
  const third = creationMaps(nextSession.engine)[0], secondAddition = third.raw.entities.at(-1)!.id
  const reloaded = await CreatorSession.open(appendConfig)
  expect(reloaded.engine.world.get(original.id)?.place).toEqual({ on: 'inside', holder: 'player' })
  expect(reloaded.engine.world.get(firstAddition)?.place).toMatchObject({ map: base.raw.map.id, x: 5, y: 5 })
  const live = await CreatorSession.open({ ...appendConfig, directory: resolve(config.directory, '../append-live') })
  adoptCreatorDrafts(live.game, live.workshop, nextSession.integrationDrafts(), [], { '.': 'grass' })
  expect(live.engine.world.get(firstAddition)?.place).toMatchObject({ map: base.raw.map.id, x: 5, y: 5 })
  expect(live.engine.world.get(secondAddition)?.place).toMatchObject({ map: base.raw.map.id, x: 5, y: 4 })
  live.close(); reloaded.close(); nextSession.close(); session.close()
})

it('replays an explicit use revision and a subsequent append against the original save in order', async () => {
  const { session, call, config } = await fixture()
  const base = await call('propose_content', { kind: 'uses', subject: GOODS, plan })
  expect((await call('adopt_content', { id: base.id })).ok).toBe(true)
  const start = { ...config, jobId: 'mixed_uses', save: session.game.save() }
  const candidate = await CreatorSession.open({ ...start, directory: resolve(config.directory, '../mixed') })
  const ask = async (name: string, args: Record<string, unknown>) => JSON.parse(await candidate.tools().find(t => t.name === name)!.run(args))
  const revision = { ...plan, uses: plan.uses.map(use => ({ ...use, label: { en: 'Read the markings', zh: '阅读纹路' } })) }
  const revised = await ask('propose_content', { kind: 'uses', operation: 'revise', subject: base.id, plan: revision })
  expect((await ask('adopt_content', { id: revised.id })).ok).toBe(true)
  const newUse = { ...plan.uses[0], id: 'inspect_back' }
  const appended = await ask('propose_content', { kind: 'uses', operation: 'append', subject: base.id, plan: { version: 1, uses: [newUse] } })
  expect((await ask('adopt_content', { id: appended.id })).ok).toBe(true)
  const live = await CreatorSession.open({ ...start, directory: resolve(config.directory, '../mixed-live') })
  adoptCreatorDrafts(live.game, live.workshop, candidate.integrationDrafts(), [], { '.': 'grass' })
  expect(workshopPackages(live.engine).find(p => p.id === base.id && p.enabled)?.plan.uses).toEqual([...revision.uses, newUse])
  live.close(); candidate.close(); session.close()
})
