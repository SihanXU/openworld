import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { CreatorPreview, creatorObservationScript, previewCandidateHash, recordedPreviewMatches } from '../src/service/creator-preview.ts'
import type { CreatorSession } from '../src/service/creator-session.ts'

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'creator-preview-'))
  const save = { world: 'test', state: { tick: 0 }, library: {}, savedAt: 'old' }
  const checkpoint = vi.fn()
  const session = { config: { root: directory, directory, worldDirectory: directory }, game: { save: () => structuredClone(save) }, definition: { id: 'test' }, checkpoint } as unknown as CreatorSession
  return { directory, save, session, checkpoint }
}

describe('native creator preview evidence', () => {
  it('pins candidate content independently of save read timestamps', () => {
    const { save } = fixture()
    expect(previewCandidateHash(save)).toBe(previewCandidateHash({ ...save, savedAt: 'new' } as typeof save))
    expect(previewCandidateHash(save)).not.toBe(previewCandidateHash({ ...save, state: { tick: 1 } }))
    expect(previewCandidateHash(save)).not.toBe(previewCandidateHash({ ...save, library: { rules: [] } }))
  })

  it('matches the exact recorded input after a fresh restore changes only library bookkeeping', () => {
    const { directory, save } = fixture()
    const opened = { ...save, library: { log: 'old', version: 1, rules: ['fire'] } }
    const file = join(directory, 'opened.json'); writeFileSync(file, JSON.stringify({ slot: { save: opened } }))
    const restored = { ...opened, library: { ...opened.library, log: 'new', version: 53 } }
    expect(recordedPreviewMatches(directory, restored, previewCandidateHash(opened), file)).toBe(true)
    expect(recordedPreviewMatches(directory, { ...restored, state: { tick: 2 } }, previewCandidateHash(opened), file)).toBe(false)
    expect(recordedPreviewMatches(directory, { ...restored, library: { ...restored.library, rules: ['ice'] } }, previewCandidateHash(opened), file)).toBe(false)
    expect(recordedPreviewMatches(directory, restored, 'wrong snapshot', file)).toBe(false)
  })

  it('observes the native decoder merged HP/status/FX and forwards original input unchanged', async () => {
    const sent: unknown[] = []
    class NativeWorker extends EventTarget { postMessage(message: unknown) { sent.push(message) } }
    const base = { tick: 1, map: 'room', player: { id: 'p', x: 2, y: 3, hp: 10, statuses: [], props: {}, worn: {}, slots: [] }, entities: [{ id: 'target', x: 3, y: 3, hp: 8, statuses: [] }], fx: [] }
    const w: any = { Worker: NativeWorker, lsw: { frame: base } }
    vi.stubGlobal('window', w)
    try {
      runInNewContext(creatorObservationScript(), { window: w, setTimeout, structuredClone })
      w.__creatorObservation.reset()
      const worker = new w.Worker()
      // The real main-thread handler is installed after the observer; it decodes a sparse worker delta.
      worker.addEventListener('message', () => { w.lsw.frame = { ...base, tick: 2, player: { ...base.player, hp: 7, statuses: ['burning'] }, entities: [{ ...base.entities[0], hp: 3 }], fx: [{ kind: 'hit' }] } })
      const input = { t: 'key', key: 'use', down: true }
      worker.postMessage(input)
      worker.dispatchEvent(new MessageEvent('message', { data: { t: 'frame', delta: { tick: 2 } } }))
      await new Promise(resolve => setTimeout(resolve, 10))
      const o = w.__creatorObservation
      worker.dispatchEvent(new MessageEvent('message', { data: { t: 'error', code: 'action-refused', message: 'Target out of reach' } }))
      expect(o.refusals).toEqual([{ t: 'error', code: 'action-refused', message: 'Target out of reach' }])
      expect(o.errors).toHaveLength(0)
      expect(sent[0]).toBe(input)
      expect(o.changes).toHaveLength(1)
      expect(o.changes[0].changes).toEqual(expect.arrayContaining([expect.objectContaining({ who: 'player', after: expect.objectContaining({ hp: 7, statuses: ['burning'] }) }), expect.objectContaining({ who: 'target', after: expect.objectContaining({ hp: 3 }) })]))
      expect(o.fx[0].fx).toEqual([{ kind: 'hit' }])
      for (let i = 0; i < 200; i++) worker.postMessage({ t: 'key', key: String(i) })
      expect(o.inputs).toHaveLength(160)
      expect(w.lsw.frame.player.hp).toBe(7)
    } finally { vi.unstubAllGlobals() }
  })

  it('waits for the exact visible entity and stage without sending game commands', async () => {
    const { session, directory } = fixture()
    const preview = new CreatorPreview(session, { clientDirectory: directory })
    const stage = { id: 'crop-1', type: 'fixture/crop/sunflower/ripe' }
    const page = {
      waitForFunction: vi.fn(async (matches, target, options) => {
        expect(options.timeout).toBe(45000)
        vi.stubGlobal('window', { lsw: { frame: { entities: [{ ...stage, id: 'other' }, { ...stage, type: 'fixture/crop/sunflower/young' }] } } })
        expect(matches(target)).toBe(false)
        ;(window as any).lsw.frame.entities.push(stage)
        expect(matches(target)).toBe(true)
      }),
      waitForTimeout: vi.fn(),
    }
    Object.assign(preview, { page })
    try {
      await (preview as unknown as { input(a: object): Promise<void> }).input({ action: 'wait', ...stage })
      expect(page.waitForFunction).toHaveBeenCalledOnce()
    } finally { vi.unstubAllGlobals() }
  })

  it('aims at the rendered target without using the held item', async () => {
    const { session, directory, save, checkpoint } = fixture()
    const preview = new CreatorPreview(session, { clientDirectory: directory })
    const move = vi.fn(), click = vi.fn()
    Object.assign(preview, { page: { viewportSize: () => ({ width: 800, height: 600 }), evaluate: async () => ({ x: 40, y: 50 }), mouse: { move, click }, waitForTimeout: vi.fn() } })
    await (preview as unknown as { input(a: object): Promise<void> }).input({ action: 'aim', id: 'seed' })
    expect(move).toHaveBeenCalledExactlyOnceWith(40, 50)
    expect(click).not.toHaveBeenCalled()
    const journal = join(directory, 'playtest', 'latest-inputs.json')
    expect(JSON.parse(readFileSync(journal, 'utf8')).actions).toEqual([expect.objectContaining({ action: 'aim', id: 'seed' })])
    const resumed = new CreatorPreview(session, { clientDirectory: directory }, { sourceVersion: () => 'source' })
    Object.assign(resumed, { page: (preview as any).page, openedSourceHash: 'source', openedCandidateHash: previewCandidateHash(save) })
    vi.spyOn(resumed, 'open').mockResolvedValue({ inputGuide: { hands: 'Use the actual hands binding' } })
    expect(await resumed.replay()).toMatchObject({ replayed: 1, inputGuide: { hands: 'Use the actual hands binding' } })
    expect(move).toHaveBeenCalledTimes(2)
    expect(checkpoint).not.toHaveBeenCalled()
  })

  it('keeps the full native input journal when replay stops partway', async () => {
    const { session, directory, save } = fixture()
    const preview = new CreatorPreview(session, { clientDirectory: directory }, { sourceVersion: () => 'source' })
    mkdirSync(join(directory, 'playtest'))
    const journal = join(directory, 'playtest', 'latest-inputs.json')
    const recorded = JSON.stringify({ actions: [{ action: 'aim', id: 'visible' }, { action: 'aim', id: 'missing' }] })
    writeFileSync(journal, recorded)
    Object.assign(preview, { openedSourceHash: 'source', openedCandidateHash: previewCandidateHash(save), page: {
      viewportSize: () => ({ width: 800, height: 600 }), evaluate: async (_: unknown, id: string) => id === 'visible' ? { x: 40, y: 50 } : undefined,
      mouse: { move: vi.fn() }, waitForTimeout: vi.fn(),
    } })
    vi.spyOn(preview, 'open').mockResolvedValue({})
    await expect(preview.replay()).rejects.toThrow('not rendered')
    expect(readFileSync(journal, 'utf8')).toBe(recorded)
  })

  it('closes a started server on browser launch failure and allows another attempt', async () => {
    const { session, directory } = fixture(), close = vi.fn(async () => {})
    const preview = new CreatorPreview(session, { clientDirectory: directory }, { sourceVersion: () => 'source', createServer: async () => ({ listen: async () => {}, close, resolvedUrls: { local: ['http://127.0.0.1:1234/'] } }) as any, launchBrowser: async () => { throw new Error('launch failed') } })
    await expect(preview.open()).rejects.toThrow('launch failed')
    await expect(preview.open()).rejects.toThrow('launch failed')
    expect(close).toHaveBeenCalledTimes(2)
  })

  it('rejects stale evidence before screenshot and records the opened source identity', async () => {
    const { session, directory, save, checkpoint } = fixture(), screenshot = vi.fn()
    const preview = new CreatorPreview(session, { clientDirectory: directory }, { sourceVersion: () => 'new-source' })
    Object.assign(preview as any, { openedSourceHash: 'opened-source', openedCandidateHash: previewCandidateHash(save), page: { screenshot } })
    await expect(preview.evidence()).rejects.toThrow('source or save changed')
    expect(screenshot).not.toHaveBeenCalled()
    expect(checkpoint).toHaveBeenCalledWith('browser-play', false, expect.objectContaining({ sourceHash: 'opened-source' }))
  })

  it('cancellation closes both resources without sending game commands', async () => {
    const { session, directory } = fixture(), browserClose = vi.fn(async () => {}), serverClose = vi.fn(async () => {})
    const preview = new CreatorPreview(session, { clientDirectory: directory })
    Object.assign(preview as any, { browser: { close: browserClose }, server: { close: serverClose } })
    const controller = new AbortController()
    const operation = preview.withSignal(controller.signal, async () => { controller.abort(); return 'ignored' })
    await expect(operation).rejects.toThrow('cancelled')
    expect(browserClose).toHaveBeenCalledOnce(); expect(serverClose).toHaveBeenCalledOnce()
  })
})
