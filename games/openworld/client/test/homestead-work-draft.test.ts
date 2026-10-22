import { describe, expect, it } from 'vitest'
import { reconcileResidentWorkDraft, residentWorkAssignment, residentWorkDraftDiffersFromOrder, residentWorkDraftForOrder, type ResidentWorkDraft } from '../src/ui/workDraft.ts'

describe('homestead resident-work draft reconciliation', () => {
  it('clears deleted or unavailable selections while retaining an existing order’s empty authorized plot', () => {
    const draft: ResidentWorkDraft = { kind: 'harvest', warehouse: 'store-old', cells: new Set(['2,3', '4,5', '6,7']), animalIds: new Set() }
    const result = reconcileResidentWorkDraft(draft, {
      groundVisible: true,
      targetKeys: new Set(['4,5']),
      previouslyAuthorizedKeys: new Set(['2,3']),
      animalIds: new Set(),
      selectableAnimalIds: new Set(),
      selectableWarehouses: new Set(['store-new']),
    })

    expect(result).toEqual({ unavailableWarehouse: true, removedDraftCell: true, removedDraftAnimal: false })
    expect(draft.warehouse).toBe('')
    expect(draft.cells).toEqual(new Set(['2,3', '4,5']))
  })

  it('keeps drafts unchanged while away, when the work lists are not authoritative', () => {
    const draft: ResidentWorkDraft = { kind: 'harvest', warehouse: 'store', cells: new Set(['2,3']), animalIds: new Set() }
    const result = reconcileResidentWorkDraft(draft, {
      groundVisible: false,
      targetKeys: new Set(),
      previouslyAuthorizedKeys: new Set(),
      animalIds: new Set(),
      selectableAnimalIds: new Set(),
      selectableWarehouses: new Set(),
    })

    expect(result).toEqual({ unavailableWarehouse: false, removedDraftCell: false, removedDraftAnimal: false })
    expect(draft).toEqual({ kind: 'harvest', warehouse: 'store', cells: new Set(['2,3']), animalIds: new Set() })
  })

  it('keeps an authorized owned animal selected across fed and coordinate changes by stable id', () => {
    const draft: ResidentWorkDraft = { kind: 'feed', warehouse: 'store', cells: new Set(), animalIds: new Set(['cow-1']) }
    const result = reconcileResidentWorkDraft(draft, {
      groundVisible: true,
      targetKeys: new Set(),
      previouslyAuthorizedKeys: new Set(),
      animalIds: new Set(['cow-1', 'cow-2']),
      selectableAnimalIds: new Set(['cow-1', 'cow-2']),
      selectableWarehouses: new Set(['store']),
    })

    expect(result).toEqual({ unavailableWarehouse: false, removedDraftCell: false, removedDraftAnimal: false })
    expect(draft.animalIds).toEqual(new Set(['cow-1']))
  })

  it('removes disappeared and no-longer-selectable animals and a deleted warehouse from the visible draft', () => {
    const draft: ResidentWorkDraft = { kind: 'feed', warehouse: 'store-gone', cells: new Set(), animalIds: new Set(['cow-gone', 'wild-cow']) }
    const result = reconcileResidentWorkDraft(draft, {
      groundVisible: true,
      targetKeys: new Set(),
      previouslyAuthorizedKeys: new Set(),
      animalIds: new Set(['wild-cow']),
      selectableAnimalIds: new Set(),
      selectableWarehouses: new Set(),
    })

    expect(result).toEqual({ unavailableWarehouse: true, removedDraftCell: false, removedDraftAnimal: true })
    expect(draft).toMatchObject({ warehouse: '', animalIds: new Set() })
  })

  it('builds a single-kind payload and restores an edited order when changes are cancelled', () => {
    const harvestOrder = { kind: 'harvest' as const, warehouse: 'store', cells: [{ x: 2, y: 3 }], animalIds: [], status: 'working' as const, cargo: [] }
    const draft: ResidentWorkDraft = { kind: 'feed', warehouse: 'store-2', cells: new Set(['2,3']), animalIds: new Set(['cow-1']) }

    expect(residentWorkAssignment('worker', draft)).toEqual({ op: 'assign', kind: 'feed', worker: 'worker', warehouse: 'store-2', animalIds: ['cow-1'] })
    expect(residentWorkDraftForOrder(harvestOrder)).toEqual({ kind: 'harvest', warehouse: 'store', cells: new Set(['2,3']), animalIds: new Set(), editing: false })
    expect(residentWorkDraftDiffersFromOrder(draft, harvestOrder)).toBe(true)
    expect(residentWorkDraftDiffersFromOrder(residentWorkDraftForOrder(harvestOrder), harvestOrder)).toBe(false)
  })
})
