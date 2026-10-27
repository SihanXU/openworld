import { describe, expect, it, vi } from 'vitest'
import { RuleLibrary, type Engine, type ModRequest, type Patch, type ResolveBody, type ResolveReply } from '@openworld/engine'
import { resolveForSave } from '../src/modderLink.ts'

// Only the library is read here; applying an answer remains the native mod port's job.
const owner = () => ({ lib: new RuleLibrary([]) }) as Engine
const request = { id: 'save-request' } as ModRequest
const patch: Patch = { scope: 'save', artifacts: [] }

describe('answers belong to their asking save and connection', () => {
  it('sends the asking save library, including set-aside private branches', async () => {
    const game = owner()
    game.lib.add({ id: 'private/branch', on: 'act/use', host: { type: 'item' }, tree: { do: [] }, source: { origin: 'patch', local: { types: ['item/private_child'], statuses: ['private_care'] } } })
    game.lib.setAside('private/branch')
    const resolve = vi.fn(async (_body: ResolveBody) => ({ outcome: 'accepted' as const, patch }))
    expect(await resolveForSave(game, { resolve }, () => true, request)).toBe(patch)
    const body = resolve.mock.calls[0]![0]
    expect(body.workspace?.patches?.aside?.[0]?.rule.id).toBe('private/branch')
    game.lib.remove('private/branch')
    await resolveForSave(game, { resolve }, () => true, request)
    const retired = resolve.mock.calls[1]![0].workspace?.patches
    expect(retired?.rules).toEqual([])
    expect(retired?.aside ?? []).toEqual([])
    expect(retired?.local).toEqual({ types: ['item/private_child'], statuses: ['private_care'] })
  })

  it.each(['save', 'connection'])('discards a late answer after the %s changes', async (changed) => {
    const game = owner()
    let finish!: (reply: ResolveReply) => void
    const to = { resolve: () => new Promise<ResolveReply>(r => { finish = r }) }
    let activeGame = game, activeConnection = to
    const pending = resolveForSave(game, to, () => activeGame === game && activeConnection === to, request)
    if (changed === 'save') activeGame = owner()
    else activeConnection = { resolve: async () => ({ outcome: 'accepted', patch }) }
    finish({ outcome: 'accepted', patch })
    expect(await pending).toBeNull()
  })

  it('does not call the old connection after the save is already gone', async () => {
    const resolve = vi.fn(async () => ({ outcome: 'accepted' as const, patch }))
    expect(await resolveForSave(owner(), { resolve }, () => false, request)).toBeNull()
    expect(resolve).not.toHaveBeenCalled()
  })
})
