import { describe, expect, it } from 'vitest'
import { reconcileResidentWorkDraft, type ResidentWorkDraft } from '../src/ui/workDraft.ts'

describe('homestead resident-work draft reconciliation', () => {
  it('clears deleted or unavailable selections while retaining an existing order’s empty authorized plot', () => {
    const draft: ResidentWorkDraft = { warehouse: 'store-old', cells: new Set(['2,3', '4,5', '6,7']) }
    const result = reconcileResidentWorkDraft(draft, {
      groundVisible: true,
      targetKeys: new Set(['4,5']),
      previouslyAuthorizedKeys: new Set(['2,3']),
      selectableWarehouses: new Set(['store-new']),
    })

    expect(result).toEqual({ unavailableWarehouse: true, removedDraftCell: true })
    expect(draft.warehouse).toBe('')
    expect(draft.cells).toEqual(new Set(['2,3', '4,5']))
  })

  it('keeps drafts unchanged while away, when the work lists are not authoritative', () => {
    const draft: ResidentWorkDraft = { warehouse: 'store', cells: new Set(['2,3']) }
    const result = reconcileResidentWorkDraft(draft, {
      groundVisible: false,
      targetKeys: new Set(),
      previouslyAuthorizedKeys: new Set(),
      selectableWarehouses: new Set(),
    })

    expect(result).toEqual({ unavailableWarehouse: false, removedDraftCell: false })
    expect(draft).toEqual({ warehouse: 'store', cells: new Set(['2,3']) })
  })
})
