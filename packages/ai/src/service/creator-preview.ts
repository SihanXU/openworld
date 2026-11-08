// Play candidate code through native controls; the injected observer only reads merged runtime frames.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute, relative, resolve } from 'node:path'
import type { Browser, Page } from '@playwright/test'
import type { InlineConfig, ViteDevServer } from 'vite'
import type { AgentTool } from '../agent/tools.ts'
import type { CreatorSession } from './creator-session.ts'
import { sourceVersion } from '../agent/source-version.ts'

export interface CreatorPreviewOptions { clientDirectory: string; browserChannel?: string }
export interface CreatorPreviewDependencies {
  createServer?: (options: InlineConfig) => Promise<ViteDevServer>
  launchBrowser?: (channel: string) => Promise<Browser>
  sourceVersion?: (root: string) => string
}
// savedAt changes whenever a save is read. Pin the actual candidate content instead.
export const previewCandidateHash = (save: { world?: string; state: unknown; library?: unknown }): string =>
  createHash('sha256').update(JSON.stringify({ world: save.world, state: save.state, library: save.library })).digest('hex')

/** Restoring re-registers the same rules under a fresh library log identity/version. */
export function previewGameplayHash(save: { world?: string; state: unknown; library?: unknown }): string {
  const { log: _log, version: _version, ...rules } = (save.library ?? {}) as Record<string, unknown>
  return previewCandidateHash({ world: save.world, state: save.state, library: rules })
}
export function recordedPreviewMatches(directory: string, candidate: { world?: string; state: unknown; library?: unknown }, expected?: string, snapshot?: string): boolean {
  if (!expected) return false
  if (previewCandidateHash(candidate) === expected) return true
  try {
    const root = realpathSync(directory), file = realpathSync(snapshot ?? resolve(directory, 'preview.openworld-save.json')), within = relative(root, file)
    if (isAbsolute(within) || within.startsWith('..')) return false
    const { slot: { save } } = JSON.parse(readFileSync(file, 'utf8'))
    return previewCandidateHash(save) === expected && previewGameplayHash(save) === previewGameplayHash(candidate)
  } catch { return false }
}

/** Serialized by Playwright. Keep this function self-contained and do not issue engine commands here. */
export function installCreatorObservation(): void {
  const w = window as any
  const o = w.__creatorObservation = { inputs: [] as any[], errors: [] as any[], refusals: [] as any[], changes: [] as any[], fx: [] as any[], saveSummaries: [] as any[], lastSave: undefined as any }
  const push = (a: any[], v: any, max: number) => { a.push(v); if (a.length > max) a.splice(0, a.length - max) }
  const name = (v: any) => typeof v === 'string' ? v : v?.zh ?? v?.en
  const entity = (e: any) => ({ id: e.id, type: e.type, name: name(e.name), x: e.x, y: e.y, z: e.z, hp: e.hp, maxHp: e.maxHp, statuses: e.statuses })
  const item = (i: any) => i && ({ id: i.id, type: i.type, name: name(i.name), count: i.count, amount: i.amount })
  let last: any, lastFx: string | undefined
  const compact = () => {
    const f = w.lsw?.frame
    if (!f) return undefined
    const p = f.player
    const entities = [...(f.entities ?? [])].sort((a: any, b: any) => Math.hypot(a.x - (p?.x ?? 0), a.y - (p?.y ?? 0)) - Math.hypot(b.x - (p?.x ?? 0), b.y - (p?.y ?? 0))).slice(0, 32).map(entity)
    return { map: f.map, tick: f.tick, entityCount: f.entities?.length ?? 0, entities, player: p && { ...entity(p), hunger: p.hunger, maxHunger: p.maxHunger, facing: p.facing, selected: p.selected, held: item(p.held), worn: Object.fromEntries(Object.entries(p.worn ?? {}).map(([slot, value]) => [slot, item(value)])), props: Object.fromEntries(Object.entries(p.props ?? {}).slice(0, 32)), slots: (p.slots ?? []).map((slot: any, index: number) => slot && ({ slot: index, item: item(slot.item), count: slot.count, worn: slot.worn })).filter(Boolean).slice(0, 30) } }
  }
  const flush = () => {
    const now = compact()
    if (!now) return undefined
    if (last) {
      const changes: any[] = []
      const diff = (who: string, before: any, after: any) => {
        const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
        if (keys.length) changes.push({ who, before: Object.fromEntries(keys.map(key => [key, before?.[key] ?? null])), after: Object.fromEntries(keys.map(key => [key, after?.[key] ?? null])) })
      }
      diff('player', last.player, now.player)
      for (const e of now.entities) {
        if (e.id === now.player?.id) continue
        const before = last.entities.find((v: any) => v.id === e.id)
        if (before) diff(e.id, before, e)
      }
      for (const before of last.entities) if (!now.entities.some((e: any) => e.id === before.id)) changes.push({ who: before.id, before, after: null, reason: 'left-observation-window' })
      if (changes.length) push(o.changes, { tick: now.tick, map: now.map, changes: changes.slice(0, 12) }, 80)
    }
    last = now
    const fx = w.lsw?.frame?.fx
    const key = JSON.stringify([now.tick, fx])
    if (fx?.length && key !== lastFx) push(o.fx, { tick: now.tick, fx: fx.slice(0, 24) }, 80)
    lastFx = key
    return now
  }
  Object.assign(o, { flush, reset: () => { o.inputs.length = o.errors.length = o.refusals.length = o.changes.length = o.fx.length = o.saveSummaries.length = 0; o.lastSave = undefined; last = compact(); lastFx = undefined } })
  const Native = w.Worker
  w.Worker = class extends Native {
    constructor(...args: any[]) {
      super(...args)
      this.addEventListener('message', (e: any) => {
        if (e.data?.t === 'saved') { o.lastSave = e.data; push(o.saveSummaries, { t: 'saved', at: Date.now() }, 8) }
        if (e.data?.t === 'error') {
          const refusal = e.data.code === 'action-refused' || e.data.message === 'Carry the required item and choose a reachable target for this use'
          push(refusal ? o.refusals : o.errors, e.data, 30)
        }
        // The worker message can be a delta. Wait until the native main-thread decoder has merged it.
        if (e.data?.t === 'frame') setTimeout(flush, 0)
      })
    }
    postMessage(message: any, ...args: any[]) {
      if (message && !['view', 'aim', 'pause', 'save'].includes(message.t)) push(o.inputs, message.t === 'init' ? { t: 'init', resumed: !!message.save } : structuredClone(message), 160)
      return super.postMessage(message, ...args)
    }
  }
}

// tsx/esbuild can add lexical __name calls inside a serialized function. Keep that helper local to the script.
export const creatorObservationScript = (): string => `(() => { function __name(value) { return value } (${installCreatorObservation.toString()})(); })()`

// Link candidate workspace packages explicitly: a worktree can share node_modules with its parent.
function workspaceAliases(root: string): { find: RegExp; replacement: string }[] {
  const aliases: { find: RegExp; replacement: string }[] = []
  const add = (directory: string) => {
    try {
      const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
      if (typeof pkg.name !== 'string' || typeof pkg.main !== 'string') return
      const name = pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      aliases.push({ find: new RegExp(`^${name}$`), replacement: resolve(directory, pkg.main) }, { find: new RegExp(`^${name}/`), replacement: resolve(directory) + '/' })
    } catch { /* Not every directory is a workspace package. */ }
  }
  for (const base of ['packages', 'games']) {
    try { for (const entry of readdirSync(resolve(root, base), { withFileTypes: true })) if (entry.isDirectory()) {
      const directory = resolve(root, base, entry.name)
      add(directory)
      if (base === 'games') for (const child of readdirSync(directory, { withFileTypes: true })) if (child.isDirectory()) add(resolve(directory, child.name))
    } } catch { /* A minimal fixture need not contain both workspace roots. */ }
  }
  return aliases
}

function previewFileRoots(root: string, world: string): string[] {
  const roots = new Set([root, world])
  try { roots.add(realpathSync(world)) } catch { /* A missing world is diagnosed by the native loader. */ }
  const modules = resolve(root, 'node_modules')
  try {
    for (const name of readdirSync(modules)) {
      const path = resolve(modules, name)
      try { const actual = realpathSync(path); if (actual !== path) roots.add(actual) } catch { /* Broken links fail at import. */ }
    }
  } catch { /* A fixture may not have dependencies. */ }
  return [...roots]
}

export class CreatorPreview {
  private server?: ViteDevServer
  private browser?: Browser
  private page?: Page
  private errors: string[] = []
  private actions: unknown[] = []
  private openedSourceHash?: string
  private openedCandidateHash?: string
  private openId = ''
  private epoch = 0
  private opening = false
  constructor(private session: CreatorSession, private options: CreatorPreviewOptions, private deps: CreatorPreviewDependencies = {}) {}
  private sourceHash(): string { return (this.deps.sourceVersion ?? sourceVersion)(this.session.config.root) }
  private fresh(): void {
    if (this.openedSourceHash !== this.sourceHash() || this.openedCandidateHash !== previewCandidateHash(this.session.game.save())) throw new Error('Candidate source or save changed after opening. Call open_playtest again before acting or capturing evidence.')
  }
  async close(): Promise<void> {
    this.epoch++
    const browser = this.browser, server = this.server
    this.browser = undefined; this.page = undefined; this.server = undefined
    await Promise.allSettled([browser?.close(), server?.close()])
  }
  async withSignal<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
    if (signal.aborted) { await this.close(); throw new Error('Preview operation cancelled') }
    const abort = () => { void this.close() }
    signal.addEventListener('abort', abort, { once: true })
    try { const value = await run(); if (signal.aborted) throw new Error('Preview operation cancelled'); return value }
    finally { signal.removeEventListener('abort', abort) }
  }
  async open(): Promise<unknown> {
    if (this.opening) throw new Error('A preview is already opening')
    this.opening = true
    let stage = 'start preview'
    const rejected: { status: number; url: string }[] = []
    try {
      await this.close()
      const epoch = this.epoch, current = () => { if (epoch !== this.epoch) throw new Error('Preview opening cancelled') }
      this.errors = []; this.actions = []; this.openId = randomUUID()
      this.openedSourceHash = this.sourceHash()
      const save = this.session.game.save()
      this.openedCandidateHash = previewCandidateHash(save)
      const create = this.deps.createServer ?? (await import('vite')).createServer
      this.server = await create({ root: this.options.clientDirectory, configFile: resolve(this.options.clientDirectory, 'vite.config.ts'), configLoader: 'runner', logLevel: 'silent', resolve: { alias: workspaceAliases(this.session.config.root) }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: previewFileRoots(this.session.config.root, this.session.config.worldDirectory) } } })
      current(); await this.server.listen(); current()
      const origin = this.server.resolvedUrls?.local[0]
      if (!origin) throw new Error('Preview server did not expose a local URL')
      this.browser = await (this.deps.launchBrowser ?? (async channel => (await import('@playwright/test')).chromium.launch({ channel, headless: true })))(this.options.browserChannel ?? 'msedge')
      current()
      const context = await this.browser.newContext({ viewport: { width: 1365, height: 900 } })
      current()
      await context.route('**/*', route => {
        const u = new URL(route.request().url())
        if (route.request().method() === 'POST' || u.origin !== new URL(origin).origin && !['data:', 'blob:'].includes(u.protocol)) return route.abort()
        return route.continue()
      })
      await context.addInitScript({ content: creatorObservationScript() })
      this.page = await context.newPage(); current()
      this.page.on('pageerror', e => { this.errors.push(e.message); if (this.errors.length > 30) this.errors.shift() })
      this.page.on('response', r => { if (r.status() >= 400) { rejected.push({ status: r.status(), url: r.url() }); if (rejected.length > 12) rejected.shift() } })
      const file = resolve(this.session.config.directory, 'preview.openworld-save.json')
      mkdirSync(this.session.config.directory, { recursive: true })
      writeFileSync(file, JSON.stringify({ format: 'openworld-save', version: 1, world: this.session.definition.id, slot: { save, savedAt: save.savedAt } }))
      stage = 'title screen'
      await this.page.goto(origin + '?modder=off&lang=zh', { waitUntil: 'domcontentloaded' })
      await this.page.waitForFunction(() => ['#cvSkipModel', '#intro [data-item="new"]'].some(s => document.querySelector(s)?.getClientRects().length), null, { timeout: 60000 })
      if (await this.page.locator('#cvSkipModel').isVisible()) await this.page.locator('#cvSkipModel').click()
      await this.page.locator('#intro [data-item="new"]').click()
      if (await this.page.locator('#cvSkipModel').isVisible()) await this.page.locator('#cvSkipModel').click()
      if (await this.page.locator('#cvNext').isVisible()) await this.page.locator('#cvNext').click()
      stage = 'native save import'
      const picker = this.page.waitForEvent('filechooser')
      await this.page.locator('[data-act="import"][data-slot="3"]:visible').click()
      await (await picker).setFiles(file)
      await this.page.waitForSelector('[data-act="export"][data-slot="3"]:visible')
      await this.page.keyboard.press('Escape')
      stage = 'load imported save'
      await this.page.locator('#intro [data-item="continue"]').click()
      await this.page.waitForFunction(() => { const w = window as any; return !!w.__creatorObservation?.errors.length || !!w.lsw?.frame && document.getElementById('intro')?.classList.contains('hidden') }, null, { timeout: 60000 })
      const bootErrors: unknown[] = await this.page.evaluate(() => (window as any).__creatorObservation?.errors ?? [])
      if (bootErrors.length) throw new Error(`Game worker refused the preview: ${JSON.stringify(bootErrors)}`)
      current(); this.fresh()
      await this.page.evaluate(() => (window as any).__creatorObservation.reset())
      const view = await this.inspect()
      const keymap = await this.page.evaluate(() => (window as any).lsw?.keymap)
      return { ...(view as object), inputGuide: { keymap, hands: 'Aim at a rendered entity or tile, then press the hands binding to pick up, talk or harvest.', use: 'Select a toolbar slot with its binding. Right click the target to use the held item there. The row binding rotates another bag row into the toolbar.', movement: 'Hold a movement binding briefly, inspect the observed position, then continue.' } }
    } catch (error) {
      const report = { stage, error: String(error), pageErrors: this.errors.slice(-8), rejected }
      const directory = this.session.config.directory; mkdirSync(directory, { recursive: true })
      writeFileSync(resolve(directory, 'preview-start-error.json'), JSON.stringify(report, null, 2))
      await this.close()
      throw new Error(`Preview ${stage} failed: ${report.error}${report.pageErrors.length ? `; page: ${report.pageErrors.join('; ')}` : ''}${rejected.length ? `; requests: ${JSON.stringify(rejected)}` : ''}`)
    }
    finally { this.opening = false }
  }
  async inspect(): Promise<unknown> {
    if (!this.page) throw new Error('Open the candidate preview first')
    const view = await this.page.evaluate(() => {
      const o = (window as any).__creatorObservation
      return { frame: o.flush(), ui: document.body.innerText.slice(0, 4000), controls: [...document.querySelectorAll('button,[data-i],[data-wear],[data-ability]')].filter(e => e.getClientRects().length).slice(0, 48).map(e => ({ tag: e.tagName, id: e.id, text: e.textContent?.slice(0, 70), data: { ...(e as HTMLElement).dataset } })), errors: o.errors, refusals: o.refusals.slice(-5), recentChanges: o.changes.slice(-3), recentFx: o.fx.slice(-6), inputCount: o.inputs.length }
    })
    return { ...view, sourceHash: this.openedSourceHash, candidateHash: this.openedCandidateHash, stale: this.openedSourceHash !== this.sourceHash() || this.openedCandidateHash !== previewCandidateHash(this.session.game.save()) }
  }
  async act(a: Record<string, unknown>): Promise<unknown> {
    if (!this.page) throw new Error('Open the candidate preview first')
    this.fresh()
    await this.input(a)
    return this.inspect()
  }
  private async input(a: Record<string, unknown>, replaying = false): Promise<void> {
    if (!this.page) throw new Error('Open the candidate preview first')
    const page = this.page, key = () => { if (typeof a.key !== 'string' || !a.key.trim()) throw new Error('key must be a non-empty string'); return a.key }
    const duration = (max: number) => { const n = a.ms === undefined ? 250 : a.ms; if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('ms must be finite'); return Math.min(max, Math.max(0, n)) }
    const pointInput = async (point: { x: number; y: number } | undefined) => {
      const viewport = page.viewportSize()
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || viewport && (point.x < 0 || point.y < 0 || point.x >= viewport.width || point.y >= viewport.height)) throw new Error('The target is not rendered inside the current viewport')
      if (a.action === 'aim') await page.mouse.move(point.x, point.y)
      else await page.mouse.click(point.x, point.y, { button: a.button === 'right' ? 'right' : 'left' })
    }
    switch (a.action) {
      case 'key': await page.keyboard.press(key()); break
      case 'hold': { const k = key(), ms = duration(2500); await page.keyboard.down(k); try { await page.waitForTimeout(ms) } finally { await page.keyboard.up(k) } break }
      case 'click': if (typeof a.selector !== 'string' || !a.selector) throw new Error('selector must be non-empty'); await page.locator(a.selector).click({ button: a.button === 'right' ? 'right' : 'left', timeout: 10000 }); break
      case 'entity': if (typeof a.id !== 'string' || !a.id) throw new Error('id must be non-empty'); await pointInput(await page.evaluate(id => (window as any).lsw.scene.screenOf(id), a.id)); break
      case 'tile': if (!Number.isInteger(a.x) || !Number.isInteger(a.y)) throw new Error('x and y must be integer tile coordinates'); await pointInput(await page.evaluate(p => (window as any).lsw.scene.screenOfTile(p.x, p.y), { x: a.x as number, y: a.y as number })); break
      case 'aim':
        if (typeof a.id === 'string' && a.id) await pointInput(await page.evaluate(id => (window as any).lsw.scene.screenOf(id), a.id))
        else if (Number.isInteger(a.x) && Number.isInteger(a.y)) await pointInput(await page.evaluate(p => (window as any).lsw.scene.screenOfTile(p.x, p.y), { x: a.x as number, y: a.y as number }))
        else throw new Error('Aim needs an entity id or integer tile coordinates')
        break
      case 'wait':
        if (a.type === undefined) await page.waitForTimeout(duration(5000))
        else {
          if (typeof a.id !== 'string' || !a.id || typeof a.type !== 'string' || !a.type) throw new Error('An observed wait needs an entity id and target type')
          await page.waitForFunction(({ id, type }) => (window as any).lsw?.frame?.entities?.some((e: { id: string; type: string }) => e.id === id && e.type === type),
            { id: a.id, type: a.type }, { polling: 250, timeout: replaying ? 270000 : Math.max(1, a.ms === undefined ? 45000 : duration(45000)) }).catch(error => {
            if (error instanceof Error && error.name === 'TimeoutError') throw new Error(`Still waiting for ${a.id} to become ${a.type}; inspect the current stage or continue waiting`)
            throw error
          })
        }
        break
      default: throw new Error('Unknown preview action')
    }
    this.actions.push({ ...a, at: new Date().toISOString() })
    if (this.actions.length > 160) this.actions.shift()
    if (!replaying) this.recordInputs()
    await page.waitForTimeout(120)
  }
  private recordInputs(): void {
    const directory = resolve(this.session.config.directory, 'playtest')
    mkdirSync(directory, { recursive: true })
    const journal = resolve(directory, 'latest-inputs.json')
    writeFileSync(journal + '.tmp', JSON.stringify({ actions: this.actions, sourceHash: this.openedSourceHash, candidateHash: this.openedCandidateHash }))
    renameSync(journal + '.tmp', journal)
  }
  async replay(file?: string): Promise<unknown> {
    const journal = resolve(this.session.config.directory, 'playtest', 'latest-inputs.json')
    const evidence = file ?? (existsSync(journal) ? journal : ([...this.session.state.checks].reverse().find(c => c.kind === 'browser-play' && (c.result as { file?: string })?.file)?.result as { file?: string } | undefined)?.file)
    if (!evidence) throw new Error('Perform native inputs or capture a playtest before replaying it')
    const directory = realpathSync(resolve(this.session.config.directory, 'playtest')), actual = realpathSync(evidence), within = relative(directory, actual)
    if (isAbsolute(within) || within.startsWith('..') || !(actual.endsWith('evidence.json') || actual === resolve(directory, 'latest-inputs.json'))) throw new Error('Use retained playtest inputs or evidence for this job')
    const prior = JSON.parse(readFileSync(actual, 'utf8')) as { actions?: Record<string, unknown>[] }
    if (!Array.isArray(prior.actions) || !prior.actions.length || prior.actions.length > 160) throw new Error('Recorded playtest has no bounded native inputs')
    const opened = await this.open() as { inputGuide?: unknown }
    for (const action of prior.actions) await this.input(action, true)
    this.fresh()
    this.recordInputs()
    return { replayed: prior.actions.length, file: actual, inputGuide: opened.inputGuide, current: await this.inspect() }
  }
  async evidence(): Promise<unknown> {
    if (!this.page) throw new Error('Open and actually play the candidate before collecting evidence')
    const sourceHash = this.openedSourceHash, candidateHash = this.openedCandidateHash
    try {
      this.fresh()
      const dir = resolve(this.session.config.directory, 'playtest', this.openId); mkdirSync(dir, { recursive: true })
      const screenshot = resolve(dir, 'gameplay.png'), file = resolve(dir, 'evidence.json'), snapshotFile = resolve(dir, 'opened.openworld-save.json')
      await this.page.screenshot({ path: screenshot })
      const observation = await this.page.evaluate(() => { const o = (window as any).__creatorObservation; return { inputs: o.inputs, errors: o.errors, refusals: o.refusals, changes: o.changes, fx: o.fx, saveSummaries: o.saveSummaries, lastSave: o.lastSave, frame: o.flush() } })
      this.fresh()
      const ok = !this.errors.length && !observation.errors.length && this.actions.some((a: any) => a.action !== 'wait') && observation.inputs.length > 0
      copyFileSync(resolve(this.session.config.directory, 'preview.openworld-save.json'), snapshotFile)
      const report = { ok, meaning: 'Capture integrity; task outcomes require reading the observed transitions.', sourceHash, candidateHash, snapshotFile, screenshot, actions: this.actions, errors: this.errors, observation }
      writeFileSync(file, JSON.stringify(report, null, 2))
      this.session.checkpoint('browser-play', ok, { actions: this.actions.length, inputs: observation.inputs.length, changes: observation.changes.length, fx: observation.fx.length, file, screenshot, sourceHash, candidateHash, snapshotFile })
      return { ...report, file, observation: { frame: observation.frame, inputs: observation.inputs.slice(-30), errors: observation.errors, refusals: observation.refusals, changes: observation.changes.slice(-8), fx: observation.fx.slice(-16) } }
    } catch (error) { this.session.checkpoint('browser-play', false, { sourceHash, candidateHash, error: String(error) }); await this.close(); throw error }
  }
  tools(): AgentTool[] {
    const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[], run: (a: Record<string, unknown>) => Promise<unknown>): AgentTool => ({ name, description, parameters: { type: 'object', properties, required }, run: async a => JSON.stringify(await run(a)) })
    return [
      tool('open_playtest', 'Launch this candidate source and import its staged save through the native game file picker. Pins both source and save content. Reopen after either changes. Returns compact actual frame and visible controls.', {}, [], () => this.open()),
      tool('inspect_playtest', 'Read actual merged runtime frame, visible UI, recent HP/status/FX transitions and errors. Use rendered positions and controls to choose input.', {}, [], () => this.inspect()),
      tool('act_playtest', 'Perform native keyboard/mouse input. No engine state mutation. Use key/hold/click or rendered entity/tile targeting. Aim moves the pointer to an entity id or tile x/y without clicking, then a key can interact. A wait with id and type observes a rendered entity reaching that exact type for up to 45 seconds; otherwise wait is a short pause.', { action: { enum: ['key', 'hold', 'click', 'entity', 'tile', 'aim', 'wait'] }, key: { type: 'string' }, selector: { type: 'string' }, id: { type: 'string' }, type: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, ms: { type: 'number' }, button: { enum: ['left', 'right'] } }, ['action'], a => this.act(a)),
      tool('replay_playtest', 'Open the current candidate and replay actual native keyboard/mouse actions from the retained input journal or capture (latest by default). Reuse exercised branches after a host repair. Check current observations and add missing actions before capturing again.', { file: { type: 'string' } }, [], a => this.replay(typeof a.file === 'string' ? a.file : undefined)),
      tool('capture_playtest', 'Save native inputs, actual merged frame transitions, errors and a screenshot under the opened source/save fingerprints. Successful capture records evidence; assess each requested gameplay outcome from it.', {}, [], () => this.evidence()),
    ]
  }
}
