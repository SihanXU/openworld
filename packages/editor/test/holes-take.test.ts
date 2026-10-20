// An answer to a hole is taken into the game only if it holds where it was asked: judged as the game judges it, in
// the request's scene (the hole's act replayed: undefined without it, answered by it with it), not on its own.

import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildRequest, buildSandbox, placePatch, restoreLibrary, scenarioEvent, validatePatch, type ModRequest, type Patch, type Rule } from '@openworld/engine'
import { holeScenario, holesFor, type HoleCell, type LearnedFile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { Store } from '../src/app/store.ts'
import { useProject } from '../src/app/words.ts'
import { HolesMode, answerHolds } from '../src/app/holesMode.ts'
import type { Ctx } from '../src/app/context.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))

/** A hole of the starter's, and the request the editor makes there (asked at the high tier). */
function asked(s: Store): { cell: HoleCell; request: ModRequest } {
  const c = s.compiled()
  const cell = holesFor(c.bundle.ontology, c.bundle.rules, { targets: ['fixture/furniture/table'], hands: ['item/tool/axe'], verbs: ['use'], learned: c.bundle.learned }).cells[0]
  const sc = { ...holeScenario(cell), tier: 'high' as const }
  const eng = buildSandbox(sc, structuredClone(c.bundle.ontology), restoreLibrary(c.bundle.rules, c.bundle.learned, structuredClone(c.bundle.ontology)))
  const p = eng.preview(scenarioEvent(sc, eng))
  return { cell, request: buildRequest(eng, p.hole!.ev, p.hole!.res, 'editor-test') }
}

const answer = (request: ModRequest, tier?: string): Patch => {
  const rule = { id: 'table-axe', doc: 'An axe on a table.', tree: { do: [{ op: 'log', text: { en: 'Chips fly.', zh: '木屑飞溅。' } }] } } as unknown as Rule
  const placed = placePatch({ artifacts: [{ kind: 'rule', rule }] }, request).patch
  if (tier) for (const a of placed.artifacts) if (a.kind === 'rule') (a.rule as { tier?: string }).tier = tier
  return placed
}

describe('an answer to a hole', () => {
  beforeAll(() => {
    // (the editor's toasts: no page here)
    ;(globalThis as { document?: unknown }).document ??= { getElementById: () => null }
  })

  it('holds only in the scene it was asked in: one placed at another tier is no answer there', () => {
    const s = new Store('starter', readProject(STARTER))
    const { request } = asked(s)
    const c = s.compiled()
    expect(answerHolds(c, request.scenario, answer(request)).errors).toEqual([])
    const wrong = answer(request, 'medium')
    // on its own the validator takes it; in the request's scene it does not answer the hole
    expect(validatePatch(wrong, { ontology: structuredClone(c.bundle.ontology), library: restoreLibrary(c.bundle.rules, c.bundle.learned, structuredClone(c.bundle.ontology)) }).ok).toBe(true)
    expect(answerHolds(c, request.scenario, wrong).ok).toBe(false)
  })

  it('is not taken into the game unless it holds there, and the panel says why', () => {
    const s = new Store('starter', readProject(STARTER))
    useProject(s)
    const { cell, request } = asked(s)
    const ctx = { store: s, refresh: () => undefined, open: () => undefined, onto: () => s.compiled().bundle.ontology } as unknown as Ctx
    const mode = new HolesMode(() => undefined as never) as unknown as { asked?: unknown; review(a: unknown): string; take(ctx: Ctx): void; replayWith(ctx: Ctx, a: unknown, p: Patch): string }
    const learned = () => s.list<LearnedFile>('learned').map((l) => l.file)
    const before = learned()

    const wrong = answer(request, 'medium')
    const a = { cell, scenario: request.scenario, state: 'answered', reply: { patch: wrong, outcome: 'answered' } }
    mode.asked = a
    mode.replayWith(ctx, a, wrong)
    expect(mode.review(a)).toMatch(/id="pTake"[^>]*disabled/)
    expect(mode.review(a)).toMatch(/does not hold here/)
    mode.take(ctx)
    expect(learned()).toEqual(before)

    const right = answer(request)
    const b = { cell, scenario: request.scenario, state: 'answered', reply: { patch: right, outcome: 'answered' } }
    mode.asked = b
    mode.replayWith(ctx, b, right)
    expect(mode.review(b)).not.toMatch(/id="pTake"[^>]*disabled/)
    mode.take(ctx)
    expect(learned()).toEqual([...before, 'learned/table-axe.json'])
  })
})
